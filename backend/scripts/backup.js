// Database backup utility - Creates automated backups

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { loadEnv } = require('../src/config/env');
loadEnv();

const execPromise = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_NAME = process.env.DB_NAME || 'sigts_bwindi';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'sigts@t';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

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

// Create backup
async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `sigts_backup_${timestamp}.sql`);
    
    log(`\n💾 Creating database backup...`, 'blue');
    log(`   Database: ${DB_NAME}`, 'yellow');
    log(`   Output: ${backupFile}`, 'yellow');
    
    // Set PGPASSWORD environment variable
    process.env.PGPASSWORD = DB_PASSWORD;
    
    try {
        const command = `pg_dump -U ${DB_USER} -h localhost -d ${DB_NAME} -F c -b -v -f "${backupFile}"`;
        await execPromise(command);
        
        // Get file size
        const stats = fs.statSync(backupFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        log(`✓ Backup created successfully!`, 'green');
        log(`   Size: ${fileSizeMB} MB`, 'green');
        
        return backupFile;
    } catch (error) {
        log(`❌ Backup failed: ${error.message}`, 'red');
        throw error;
    } finally {
        delete process.env.PGPASSWORD;
    }
}

// List existing backups
function listBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort()
        .reverse();
    
    log('\n📋 Existing Backups:', 'blue');
    
    if (files.length === 0) {
        log('  No backups found.', 'yellow');
    } else {
        files.forEach(file => {
            const filePath = path.join(BACKUP_DIR, file);
            const stats = fs.statSync(filePath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            const modified = stats.mtime.toLocaleString();
            log(`  ${file} (${fileSizeMB} MB) - ${modified}`, 'green');
        });
    }
}

// Clean old backups (keep only last N)
async function cleanOldBackups(keepCount = 7) {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();
    
    if (files.length <= keepCount) {
        log(`\n🧹 No old backups to clean (keeping ${keepCount} most recent)`, 'yellow');
        return;
    }
    
    const toDelete = files.slice(0, files.length - keepCount);
    
    log(`\n🧹 Cleaning old backups...`, 'blue');
    
    for (const file of toDelete) {
        const filePath = path.join(BACKUP_DIR, file);
        fs.unlinkSync(filePath);
        log(`  Deleted: ${file}`, 'yellow');
    }
    
    log(`✓ Cleaned ${toDelete.length} old backup(s)`, 'green');
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'backup';
    
    log('\n🔧 SIGTS Database Backup Tool', 'blue');
    log('=============================\n');
    
    try {
        if (command === 'backup') {
            await createBackup();
        } else if (command === 'list') {
            listBackups();
        } else if (command === 'clean') {
            const keepCount = parseInt(args[1]) || 7;
            await cleanOldBackups(keepCount);
        } else {
            log(`Unknown command: ${command}`, 'red');
            log('Usage: node scripts/backup.js [backup|list|clean] [keepCount]', 'yellow');
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

// Run
main();