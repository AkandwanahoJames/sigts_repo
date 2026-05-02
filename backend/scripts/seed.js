// scripts/seed.js
// Database seeder - Populates database with initial data
// Based on requirements from research findings

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { execFileSync } = require('child_process');
const { loadEnv } = require('../src/config/env');
const WILDLIFE_TOUR_THEME_ROWS = require('./data/wildlifeTourThemesRows');
loadEnv();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sigts_bwindi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sigts@t',
});

const SEEDS_DIR = path.join(__dirname, '../../database/seeds');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

async function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if data already exists
async function isDataSeeded(tableName) {
    const result = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    return parseInt(result.rows[0].count) > 0;
}

/**
 * Applies database/seeds/003_bwindi_extended_content.sql (UPDATE/INSERT merges).
 * Splits whole-line SQL comments away, then executes `;`-delimited statements.
 */
async function applyBwindiExtendedSeedFile() {
    const extPath = path.join(SEEDS_DIR, '003_bwindi_extended_content.sql');
    if (!fs.existsSync(extPath)) {
        log('  ○ Bwindi extended seed file missing; skipping merge pass', 'yellow');
        return;
    }
    log('\n📚 Merging Bwindi extended species + demo cultural narratives…', 'blue');
    const raw = fs.readFileSync(extPath, 'utf8');
    const noLineComments = raw
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n');

    const statements = noLineComments
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

    for (let i = 0; i < statements.length; i++) {
        await pool.query(statements[i]);
    }
    log(`  ✓ Applied ${statements.length} extended seed statements`, 'green');
}

async function seedWildlifeTourThemes() {
    log('\n🎙️ Seeding wildlife tour theme session briefings…', 'blue');
    let tableMissing = false;
    try {
        await pool.query('SELECT 1 FROM wildlife_tour_themes LIMIT 1');
    } catch (err) {
        if (String(err.message || '').includes('wildlife_tour_themes')) {
            tableMissing = true;
        } else {
            throw err;
        }
    }
    if (tableMissing) {
        log('  ○ Table wildlife_tour_themes missing. Run migration 009_wildlife_tour_themes.sql first.', 'yellow');
        return;
    }

    const upsertSql = `
        INSERT INTO wildlife_tour_themes (
            slug, session_title, subtitle, tourist_summary_en, guide_script_en, talking_points,
            safety_notes, etiquette_notes, suggested_duration_minutes, unesco_note, image_url, sort_order
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        ON CONFLICT (slug) DO UPDATE SET
            session_title = EXCLUDED.session_title,
            subtitle = EXCLUDED.subtitle,
            tourist_summary_en = EXCLUDED.tourist_summary_en,
            guide_script_en = EXCLUDED.guide_script_en,
            talking_points = EXCLUDED.talking_points,
            safety_notes = EXCLUDED.safety_notes,
            etiquette_notes = EXCLUDED.etiquette_notes,
            suggested_duration_minutes = EXCLUDED.suggested_duration_minutes,
            unesco_note = EXCLUDED.unesco_note,
            image_url = EXCLUDED.image_url,
            sort_order = EXCLUDED.sort_order,
            updated_at = CURRENT_TIMESTAMP`;

    for (const row of WILDLIFE_TOUR_THEME_ROWS) {
        await pool.query(upsertSql, [
            row.slug,
            row.session_title,
            row.subtitle,
            row.tourist_summary_en,
            row.guide_script_en,
            row.talking_points,
            row.safety_notes,
            row.etiquette_notes,
            row.suggested_duration_minutes,
            row.unesco_note,
            row.image_url,
            row.sort_order
        ]);
    }
    log(`  ✓ Upserted ${WILDLIFE_TOUR_THEME_ROWS.length} wildlife tour theme briefing rows`, 'green');
}

// Seed parks data
async function seedParks() {
    log('\n🌳 Seeding Parks...', 'blue');
    
    if (await isDataSeeded('parks')) {
        log('  ○ Parks already seeded, skipping...', 'yellow');
        return;
    }
    
    const query = `
        INSERT INTO parks (park_id, name, description, geofence_boundary, intranet_server_ip, established_date, area_sqkm, entrance_fee, opening_time, closing_time, emergency_phone, intranet_subnet)
        VALUES (
            gen_random_uuid(),
            'Bwindi Impenetrable National Park',
            'Bwindi Impenetrable National Park is a UNESCO World Heritage Site located in southwestern Uganda. It is renowned for its exceptional biodiversity, including over 120 mammal species, 350 bird species, and half of the world''s mountain gorilla population.',
            ST_GeomFromText('POLYGON((29.6 -1.0, 29.8 -1.0, 29.8 -1.2, 29.6 -1.2, 29.6 -1.0))', 4326),
            '192.168.100.10',
            '1991-01-01',
            331.00,
            '{"foreign_adult": 50, "foreign_child": 30, "east_african": 20000, "citizen": 5000}',
            '06:00:00',
            '19:00:00',
            '+256-78-XXX-XXXX',
            '192.168.100.0/24'
        )
    `;
    
    await pool.query(query);
    log('  ✓ Parks seeded', 'green');
}

// Seed animals data (base quartet + merged Bwindi catalogue from 003_* file)
async function seedAnimals() {
    log('\n🦁 Seeding Animals...', 'blue');

    let insertedBaseCount = 0;
    const needsBaseAnimals = !(await isDataSeeded('animals'));

    const animals = [
        {
            name: 'Mountain Gorilla',
            scientific_name: 'Gorilla beringei beringei',
            description: 'The mountain gorilla is one of the two subspecies of eastern gorilla. They have longer hair and shorter arms than their lowland cousins.',
            conservation_status: 'endangered',
            habitat: 'Montane forests at elevations of 2,200-4,300 meters',
            diet: 'Herbivore',
            lifespan: '35-40 years',
            fun_facts: ['Share 98.3% of human DNA', 'Can laugh, grieve, and use tools', 'Live in family groups led by a silverback']
        },
        {
            name: 'African Elephant',
            scientific_name: 'Loxodonta africana',
            description: 'The African elephant is the largest land mammal on Earth.',
            conservation_status: 'vulnerable',
            habitat: 'Savannas, forests, deserts, and marshes',
            diet: 'Herbivore',
            lifespan: '60-70 years',
            fun_facts: ['Elephants can\'t jump', 'Pregnancy lasts 22 months', 'Trunk has over 40,000 muscles']
        },
        {
            name: 'African Fish Eagle',
            scientific_name: 'Haliaeetus vocifer',
            description: 'The African fish eagle is a large bird of prey found throughout sub-Saharan Africa.',
            conservation_status: 'least_concern',
            habitat: 'Lakes, rivers, and wetlands',
            diet: 'Carnivore',
            lifespan: '12-15 years',
            fun_facts: ['Call is synonymous with African wilderness', 'Can spot fish from 500 meters away', 'Wingspan up to 2.4 meters']
        },
        {
            name: 'Great Blue Turaco',
            scientific_name: 'Corythaeola cristata',
            description: 'The great blue turaco is the largest species of turaco.',
            conservation_status: 'least_concern',
            habitat: 'Lowland and montane forests',
            diet: 'Frugivore',
            lifespan: '10-15 years',
            fun_facts: ['Can climb tree trunks like parrots', 'Plays important role in seed dispersal']
        }
    ];

    if (needsBaseAnimals) {
        for (const animal of animals) {
            await pool.query(
                `INSERT INTO animals (animal_id, name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
                [animal.name, animal.scientific_name, animal.description, animal.conservation_status,
                    animal.habitat, animal.diet, animal.lifespan, animal.fun_facts]
            );
            insertedBaseCount++;
        }
        log(`  ✓ Inserted ${insertedBaseCount} starter species`, 'green');
    } else {
        log('  ○ Base animals rowset already exists; merges will refresh imagery/text', 'yellow');
    }

    await applyBwindiExtendedSeedFile();
}

// Seed safety tips
async function seedSafetyTips() {
    log('\n⚠️ Seeding Safety Tips...', 'blue');
    
    if (await isDataSeeded('safety_tips')) {
        log('  ○ Safety tips already seeded, skipping...', 'yellow');
        return;
    }
    
    const tips = [
        { title: 'Gorilla Encounter Safety', content: 'Maintain at least 7 meters distance from gorillas. Do not make direct eye contact. Stay calm and follow guide instructions.', category: 'wildlife', priority: 1 },
        { title: 'Trail Safety', content: 'Stay on marked trails. Wear sturdy hiking boots. Carry at least 1 liter of water. Inform someone of your route.', category: 'driving', priority: 2 },
        { title: 'Health Precautions', content: 'Use insect repellent. Take malaria prophylaxis. Drink only bottled or boiled water.', category: 'health', priority: 2 },
        { title: 'Weather Awareness', content: 'Check weather forecast before hiking. Carry rain gear. Avoid exposed areas during lightning.', category: 'weather', priority: 3 }
    ];
    
    for (const tip of tips) {
        await pool.query(
            `INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
             VALUES (gen_random_uuid(), (SELECT park_id FROM parks LIMIT 1), $1, $2, $3, $4, true)`,
            [tip.title, tip.content, tip.category, tip.priority]
        );
    }
    
    log(`  ✓ Seeded ${tips.length} safety tips`, 'green');
}

// Seed FAQs
async function seedFAQs() {
    log('\n❓ Seeding FAQs...', 'blue');
    
    if (await isDataSeeded('faqs')) {
        log('  ○ FAQs already seeded, skipping...', 'yellow');
        return;
    }
    
    const faqs = [
        { question_en: 'What time does the park open?', answer_en: 'The park opens at 6:00 AM daily.', category: 'hours', sort_order: 1 },
        { question_en: 'How much is the entrance fee?', answer_en: 'Foreign adults: $50, Foreign children: $30, East African residents: 20,000 UGX, Ugandan citizens: 5,000 UGX.', category: 'fees', sort_order: 2 },
        { question_en: 'Where can I see gorillas?', answer_en: 'Gorillas are in Buhoma, Ruhija, Nkuringo, and Rushaga sectors.', category: 'wildlife', sort_order: 3 },
        { question_en: 'What should I pack?', answer_en: 'Long pants, waterproof jacket, hiking boots, insect repellent, sunscreen, water bottle.', category: 'preparation', sort_order: 4 }
    ];
    
    for (const faq of faqs) {
        await pool.query(
            `INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
             VALUES (gen_random_uuid(), (SELECT park_id FROM parks LIMIT 1), $1, $2, $3, $4, true)`,
            [faq.question_en, faq.answer_en, faq.category, faq.sort_order]
        );
    }
    
    log(`  ✓ Seeded ${faqs.length} FAQs`, 'green');
}

// Seed user
async function seedTestUser() {
    log('\n👤 Seeding Test User...', 'blue');
    
    const hashedPassword = await bcrypt.hash('Test123!', 12);
    
    // Check if user exists
    const existing = await pool.query('SELECT user_id FROM users WHERE username = $1', ['test_tourist']);
    
    if (existing.rows.length > 0) {
        log('  ○ Test user already exists, skipping...', 'yellow');
        return;
    }
    
    await pool.query(
        `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, user_type, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)`,
        ['test_tourist', hashedPassword, 'test@bwindi.go.ug', 'Test', 'Tourist', 'tourist']
    );
    
    log('  ✓ Test user created (username: test_tourist, password: Test123!)', 'green');
}

// Main seed function
async function seed() {
    log('\n🌱 SIGTS Database Seeder', 'blue');
    log('========================\n');
    
    try {
        // Test connection
        await pool.query('SELECT 1');
        log('✓ Database connection successful', 'green');
        
        // Run seeders
        await seedParks();
        await seedWildlifeTourThemes();
        await seedAnimals();
        await seedSafetyTips();
        await seedFAQs();
        await seedTestUser();
        try {
            log('\n🗺️ Seeding interactive map dataset...', 'blue');
            execFileSync(process.execPath, [path.join(__dirname, 'seedInteractiveData.js')], {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..'),
                env: process.env
            });
            log('  ✓ Interactive map dataset seeded', 'green');
        } catch (error) {
            log('  ⚠ Interactive map dataset failed; base seed remains available.', 'yellow');
        }
        
        log('\n✅ Seeding completed successfully!', 'green');
        
    } catch (error) {
        log(`\n❌ Seeding failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run seeder
seed();