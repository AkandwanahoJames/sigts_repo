const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sigts_bwindi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sigts@t',
});

// Migration table name
const MIGRATION_TABLE = 'schema_migrations';

// Migration files directory
const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

// Colors for console output
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

// Create migrations table if not exists
async function createMigrationsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            checksum VARCHAR(64) NOT NULL
        )
    `;
    await pool.query(query);
    log('✓ Migrations table ready', 'green');
}

// Get applied migrations
async function getAppliedMigrations() {
    const result = await pool.query(
        `SELECT migration_name FROM ${MIGRATION_TABLE} ORDER BY id`
    );
    return new Set(result.rows.map(row => row.migration_name));
}

// Calculate file checksum
function calculateChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
}

// Detect legacy/manual schema that predates migration tracking
async function hasLegacyBaselineSchema() {
    const requiredTables = ['users', 'parks', 'animals', 'tourists', 'tour_guides'];
    const result = await pool.query(
        `SELECT COUNT(*)::int AS present
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [requiredTables]
    );
    return result.rows[0]?.present === requiredTables.length;
}

// Apply a single migration
async function applyMigration(migrationFile, migrationName) {
    const filePath = path.join(MIGRATIONS_DIR, migrationFile);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = calculateChecksum(filePath);
    
    try {
        // Begin transaction
        await pool.query('BEGIN');
        
        // Execute migration SQL
        await pool.query(sql);
        
        // Record migration
        await pool.query(
            `INSERT INTO ${MIGRATION_TABLE} (migration_name, checksum) VALUES ($1, $2)`,
            [migrationName, checksum]
        );
        
        // Commit transaction
        await pool.query('COMMIT');
        
        log(`  ✓ Applied: ${migrationName}`, 'green');
        return true;
    } catch (error) {
        await pool.query('ROLLBACK');

        // Reconcile common legacy state: schema exists but migration tracking does not.
        if (
            migrationName === '001_initial_schema.sql' &&
            /already exists/i.test(error.message) &&
            await hasLegacyBaselineSchema()
        ) {
            await pool.query(
                `INSERT INTO ${MIGRATION_TABLE} (migration_name, checksum)
                 VALUES ($1, $2)
                 ON CONFLICT (migration_name) DO NOTHING`,
                [migrationName, checksum]
            );
            log(`  ⚠ Baseline detected, marked as applied: ${migrationName}`, 'yellow');
            return true;
        }

        log(`  ✗ Failed: ${migrationName} - ${error.message}`, 'red');
        return false;
    }
}

// Rollback a migration
async function rollbackMigration(migrationName) {
    // Get rollback SQL file (if exists)
    const rollbackFile = migrationName.replace('.sql', '_rollback.sql');
    const rollbackPath = path.join(MIGRATIONS_DIR, rollbackFile);
    
    if (!fs.existsSync(rollbackPath)) {
        log(`  ⚠ No rollback file found for ${migrationName}`, 'yellow');
        return false;
    }
    
    const sql = fs.readFileSync(rollbackPath, 'utf8');
    
    try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query(
            `DELETE FROM ${MIGRATION_TABLE} WHERE migration_name = $1`,
            [migrationName]
        );
        await pool.query('COMMIT');
        
        log(`  ✓ Rolled back: ${migrationName}`, 'green');
        return true;
    } catch (error) {
        await pool.query('ROLLBACK');
        log(`  ✗ Rollback failed: ${migrationName} - ${error.message}`, 'red');
        return false;
    }
}

// Main migration function
async function migrate(action = 'up', target = null) {
    log('\n📦 SIGTS Database Migration Tool', 'blue');
    log('================================\n');
    
    try {
        // Ensure migrations directory exists
        if (!fs.existsSync(MIGRATIONS_DIR)) {
            log(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`, 'red');
            process.exit(1);
        }
        
        // Get all migration files
        const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql') && !file.includes('_rollback'))
            .sort();
        
        if (migrationFiles.length === 0) {
            log('No migration files found.', 'yellow');
            return;
        }
        
        // Create migrations table
        await createMigrationsTable();
        
        // Get applied migrations
        const appliedMigrations = await getAppliedMigrations();
        
        if (action === 'up') {
            log(`Applying ${migrationFiles.length} migrations...\n`);
            
            let successCount = 0;
            for (const migrationFile of migrationFiles) {
                if (!appliedMigrations.has(migrationFile)) {
                    const success = await applyMigration(migrationFile, migrationFile);
                    if (success) successCount++;
                    else break;
                } else {
                    log(`  ○ Skipped (already applied): ${migrationFile}`, 'yellow');
                }
            }
            
            log(`\n✅ Migration complete. Applied ${successCount} new migration(s).`, 'green');
            
        } else if (action === 'down') {
            log(`Rolling back migrations...\n`);
            
            const appliedList = Array.from(appliedMigrations).sort().reverse();
            
            for (const migrationName of appliedList) {
                if (target && migrationName !== target) continue;
                
                const success = await rollbackMigration(migrationName);
                if (!success) break;
                if (target) break;
            }
            
            log(`\n✅ Rollback complete.`, 'green');
            
        } else if (action === 'status') {
            log('\nMigration Status:\n');
            log('Applied Migrations:', 'blue');
            for (const migration of appliedMigrations) {
                log(`  ✓ ${migration}`, 'green');
            }
            
            const pending = migrationFiles.filter(f => !appliedMigrations.has(f));
            if (pending.length > 0) {
                log('\nPending Migrations:', 'yellow');
                for (const migration of pending) {
                    log(`  ○ ${migration}`, 'yellow');
                }
            }
        }
        
    } catch (error) {
        log(`\n❌ Migration failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const action = args[0] || 'up';
const target = args[1];

// Run migration
migrate(action, target);