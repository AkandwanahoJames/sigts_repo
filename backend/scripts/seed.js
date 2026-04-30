// scripts/seed.js
// Database seeder - Populates database with initial data
// Based on requirements from research findings

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

// Seed animals data
async function seedAnimals() {
    log('\n🦁 Seeding Animals...', 'blue');
    
    if (await isDataSeeded('animals')) {
        log('  ○ Animals already seeded, skipping...', 'yellow');
        return;
    }
    
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
    
    for (const animal of animals) {
        await pool.query(
            `INSERT INTO animals (animal_id, name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
            [animal.name, animal.scientific_name, animal.description, animal.conservation_status,
             animal.habitat, animal.diet, animal.lifespan, animal.fun_facts]
        );
    }
    
    log(`  ✓ Seeded ${animals.length} animals`, 'green');
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

// Seed test user
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