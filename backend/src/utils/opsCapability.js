const { pool } = require('../config/database');
const { logger } = require('./logger');

let ensured = false;

async function ensureOpsTables() {
    if (ensured) return true;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS report_schedules (
                schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(240) NOT NULL,
                cron_expression VARCHAR(120) NOT NULL DEFAULT '0 9 * * 1',
                metric_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
                email_recipients TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                last_run_at TIMESTAMP WITH TIME ZONE,
                last_report_summary JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS ops_training_jobs (
                job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                model_key VARCHAR(160) NOT NULL,
                status VARCHAR(40) NOT NULL DEFAULT 'queued',
                message TEXT,
                created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE
            );
        `);
        ensured = true;
        return true;
    } catch (error) {
        logger.warn('ensureOpsTables failed:', error.message);
        return false;
    }
}

module.exports = { ensureOpsTables };
