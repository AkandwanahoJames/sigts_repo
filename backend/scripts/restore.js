// Database restore utility

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');
const { loadEnv } = require('../src/config/env');
loadEnv();

const execPromise = promisify(exec);
const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_NAME = process.env.DB_NAME || 'sigts_bwindi';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'sigts@t';

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

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        log(`\n❌ Backup directory not found: ${BACKUP_DIR}`, 'red');
        return [];
    }
    
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort()
        .reverse();
    
    if (files.length === 0) {
        log('\n⚠️ No backup files found.', 'yellow');
        return [];
    }
    
    log('\n📋 Available Backups:', 'blue');
    files.forEach((file, index) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const modified = stats.mtime.toLocaleString();
        log(`  ${index + 1}. ${file} (${fileSizeMB} MB) - ${modified}`, 'green');
    });
    
    return files;
}

async function restoreBackup(backupFile) {
    const backupPath = path.join(BACKUP_DIR, backupFile);
    
    if (!fs.existsSync(backupPath)) {
        log(`❌ Backup file not found: ${backupFile}`, 'red');
        return false;
    }
    
    log(`\n⚠️ WARNING: This will overwrite the current database!`, 'red');
    log(`   Database: ${DB_NAME}`, 'yellow');
    log(`   Backup: ${backupFile}`, 'yellow');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
        rl.question('\nAre you sure? Type "yes" to continue: ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
        log('\nRestore cancelled.', 'yellow');
        return false;
    }
    
    log(`\n🔄 Restoring database from ${backupFile}...`, 'blue');
    
    process.env.PGPASSWORD = DB_PASSWORD;
    
    try {
        // Drop and recreate database
        await execPromise(`dropdb -U ${DB_USER} -h localhost ${DB_NAME}`);
        await execPromise(`createdb -U ${DB_USER} -h localhost ${DB_NAME}`);
        log('✓ Database recreated', 'green');
        
        // Restore
        const command = `pg_restore -U ${DB_USER} -h localhost -d ${DB_NAME} -c -v "${backupPath}"`;
        await execPromise(command);
        
        log('✓ Database restored successfully!', 'green');
        return true;
        
    } catch (error) {
        log(`❌ Restore failed: ${error.message}`, 'red');
        return false;
    } finally {
        delete process.env.PGPASSWORD;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const backupIndex = args[0] ? parseInt(args[0]) - 1 : null;
    
    log('\n💾 SIGTS Database Restore Tool', 'blue');
    log('==============================\n');
    
    const backups = listBackups();
    
    if (backups.length === 0) {
        process.exit(1);
    }
    
    let selectedBackup;
    
    if (backupIndex !== null && backupIndex >= 0 && backupIndex < backups.length) {
        selectedBackup = backups[backupIndex];
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question('\nEnter backup number to restore: ', resolve);
        });
        rl.close();
        
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < backups.length) {
            selectedBackup = backups[index];
        } else {
            log('❌ Invalid selection', 'red');
            process.exit(1);
        }
    }
    
    await restoreBackup(selectedBackup);
}

// Run
main();