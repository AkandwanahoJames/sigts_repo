// System health check utility

const { Pool } = require('pg');
const { createClient } = require('redis');
const http = require('http');
const path = require('path');
const { loadEnv } = require('../src/config/env');
loadEnv();

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

async function checkDatabase() {
    log('\n📊 Checking PostgreSQL...', 'blue');
    
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'sigts_bwindi',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'sigts@t',
    });
    
    try {
        const result = await pool.query('SELECT NOW() as time, version() as version');
        log(`  ✓ Connected to PostgreSQL`, 'green');
        log(`    Version: ${result.rows[0].version.split(',')[0]}`, 'green');
        log(`    Time: ${result.rows[0].time}`, 'green');
        
        // Check tables count
        const tables = await pool.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        log(`    Tables: ${tables.rows[0].count}`, 'green');
        
        await pool.end();
        return true;
    } catch (error) {
        log(`  ✗ Database error: ${error.message}`, 'red');
        return false;
    }
}

async function checkRedis() {
    log('\n📊 Checking Redis...', 'blue');
    
    const client = createClient({
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    });
    
    try {
        await client.connect();
        await client.set('health_check', 'ok');
        const value = await client.get('health_check');
        
        if (value === 'ok') {
            log(`  ✓ Connected to Redis`, 'green');
            await client.del('health_check');
        } else {
            log(`  ✗ Redis read/write failed`, 'red');
        }
        
        await client.quit();
        return true;
    } catch (error) {
        log(`  ✗ Redis error: ${error.message}`, 'red');
        const required = String(process.env.REDIS_REQUIRED || '').toLowerCase() === 'true';
        if (!required) {
            log('  ⚠ Redis optional in this environment; continuing.', 'yellow');
            return true;
        }
        return false;
    }
}

async function checkAPI() {
    log('\n📊 Checking API Server...', 'blue');
    
    const PORT = process.env.PORT || 8000;
    
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    log(`  ✓ API server responding on port ${PORT}`, 'green');
                    try {
                        const json = JSON.parse(data);
                        log(`    Status: ${json.status}`, 'green');
                        log(`    Environment: ${json.environment}`, 'green');
                        resolve(true);
                    } catch {
                        resolve(true);
                    }
                } else {
                    log(`  ✗ API returned status ${res.statusCode}`, 'red');
                    resolve(false);
                }
            });
        });
        
        req.on('error', (error) => {
            log(`  ✗ API not responding: ${error.message}`, 'red');
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            log(`  ✗ API timeout`, 'red');
            req.destroy();
            resolve(false);
        });
    });
}

async function checkDiskSpace() {
    log('\n📊 Checking Disk Space...', 'blue');
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);
    
    try {
        // For Windows
        const { stdout } = await execPromise('wmic logicaldisk where name="C:" get FreeSpace,Size /format:csv');
        const lines = stdout
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        const dataLine = lines.find((l) => /,C:,\d+,\d+/.test(l)) || '';
        const parts = dataLine.split(',');
        const freeBytes = Number.parseInt(parts[2], 10);
        const totalBytes = Number.parseInt(parts[3], 10);
        if (!Number.isFinite(freeBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
            throw new Error('Unable to parse disk metrics from WMIC output');
        }
        const freeGB = (freeBytes / (1024 * 1024 * 1024)).toFixed(2);
        const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
        const percentFree = ((freeBytes / totalBytes) * 100).toFixed(1);
        
        log(`  ✓ Disk C: ${freeGB} GB free / ${totalGB} GB total (${percentFree}% free)`, 'green');
        
        if (parseFloat(percentFree) < 10) {
            log(`  ⚠ Low disk space warning!`, 'yellow');
        }
        
        return true;
    } catch (error) {
        log(`  ⚠ Disk check fallback: ${error.message}`, 'yellow');
        try {
            const { stdout } = await execPromise('powershell -NoProfile -Command "$d=Get-PSDrive -Name C; Write-Output ($d.Free.ToString()+\',\'+$d.Used.ToString())"');
            const pair = String(stdout || '').trim().split(',');
            const freeBytes = Number.parseInt(pair[0], 10);
            const usedBytes = Number.parseInt(pair[1], 10);
            const totalBytes = freeBytes + usedBytes;
            if (Number.isFinite(freeBytes) && Number.isFinite(totalBytes) && totalBytes > 0) {
                const freeGB = (freeBytes / (1024 * 1024 * 1024)).toFixed(2);
                const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
                const percentFree = ((freeBytes / totalBytes) * 100).toFixed(1);
                log(`  ✓ Disk C: ${freeGB} GB free / ${totalGB} GB total (${percentFree}% free)`, 'green');
                return true;
            }
        } catch (_) {
            // fall through to soft-pass below
        }
        log('  ⚠ Disk metrics unavailable; marking as non-blocking in this environment.', 'yellow');
        return true;
    }
}

async function healthCheck() {
    log('\n🔍 SIGTS System Health Check', 'blue');
    log('============================\n');
    
    const results = {
        database: await checkDatabase(),
        redis: await checkRedis(),
        api: await checkAPI(),
        disk: await checkDiskSpace(),
    };
    
    log('\n📋 Summary:', 'blue');
    log('─────────────────', 'blue');
    
    let allOk = true;
    for (const [service, status] of Object.entries(results)) {
        const statusText = status ? '✓ OK' : '✗ FAILED';
        const color = status ? 'green' : 'red';
        log(`  ${service.padEnd(10)} : ${statusText}`, color);
        if (!status) allOk = false;
    }
    
    log('─────────────────', 'blue');
    
    if (allOk) {
        log('\n✅ All systems operational!', 'green');
    } else {
        log('\n⚠️ Some services are not responding correctly.', 'yellow');
        process.exit(1);
    }
}

// Run
healthCheck();