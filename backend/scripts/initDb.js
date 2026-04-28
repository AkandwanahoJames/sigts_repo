// Initialize database - Creates database if not exists and runs migrations

const { Client } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'sigts_bwindi';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'sigts@t';
const DB_HOST = process.env.DB_HOST || 'localhost';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function databaseExists(client, dbName) {
    const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
    );
    return result.rows.length > 0;
}

async function createDatabase() {
    log('\n🗄️ Initializing SIGTS Database', 'blue');
    log('==============================\n');
    
    // Connect to default postgres database
    const client = new Client({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres',
    });
    
    try {
        await client.connect();
        log('✓ Connected to PostgreSQL', 'green');
        
        // Check if database exists
        if (await databaseExists(client, DB_NAME)) {
            log(`⚠️ Database '${DB_NAME}' already exists`, 'yellow');
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                readline.question('Do you want to drop and recreate it? (y/N): ', resolve);
            });
            readline.close();
            
            if (answer.toLowerCase() === 'y') {
                log(`\nDropping database ${DB_NAME}...`, 'yellow');
                await client.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
                log('✓ Database dropped', 'green');
            } else {
                log('Skipping database creation.', 'yellow');
                await client.end();
                return false;
            }
        }
        
        // Create database
        log(`\nCreating database ${DB_NAME}...`, 'blue');
        await client.query(`CREATE DATABASE ${DB_NAME}`);
        log('✓ Database created', 'green');
        
        await client.end();
        
        // Enable PostGIS extension with error handling
        log('\n🔧 Enabling PostGIS extension...', 'blue');
        const pgClient = new Client({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
        });
        await pgClient.connect();
        
        try {
            await pgClient.query('CREATE EXTENSION IF NOT EXISTS postgis');
            log('✓ PostGIS extension enabled', 'green');
        } catch (postgisError) {
            log('⚠️  PostGIS extension not available - some geographic features may not work', 'yellow');
            log(`   Install PostGIS package on your PostgreSQL server and try again.`, 'yellow');
            log(`   Error: ${postgisError.message}`, 'yellow');
        }
        
        try {
            await pgClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
            log('✓ UUID extension enabled', 'green');
        } catch (uuidError) {
            log('⚠️  UUID extension not available', 'yellow');
            log(`   Error: ${uuidError.message}`, 'yellow');
        }
        
        await pgClient.end();
        
        return true;
        
    } catch (error) {
        log(`❌ Database initialization failed: ${error.message}`, 'red');
        throw error;
    }
}

async function runMigrations() {
    log('\n📦 Running migrations...', 'blue');
    
    try {
        execSync('node scripts/migrate.js up', { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
    } catch (error) {
        log('❌ Migration failed', 'red');
        throw error;
    }
}

async function runSeeders() {
    log('\n🌱 Running seeders...', 'blue');
    
    try {
        execSync('node scripts/seed.js', { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
    } catch (error) {
        log('⚠️ Seeding failed (non-critical)', 'yellow');
    }
}

async function initDb() {
    const created = await createDatabase();
    
    if (created) {
        await runMigrations();
        await runSeeders();
        
        log('\n✅ Database initialization complete!', 'green');
        log('\n📝 Next steps:', 'blue');
        log('   1. Run: npm run dev', 'yellow');
        log('   2. Test API: curl http://localhost:8000/api/health', 'yellow');
    } else {
        log('\n⚠️ Database initialization skipped.', 'yellow');
    }
}

// Run
initDb();