-- Capability extensions aligned with §3.1 formerly-missing modules (minimal operational schema).

CREATE TABLE IF NOT EXISTS guide_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_guide_messages_recipient_created
    ON guide_messages (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guide_messages_sender_created
    ON guide_messages (from_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_alert_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(240) NOT NULL,
    metric_key VARCHAR(160) NOT NULL,
    comparator VARCHAR(8) NOT NULL CHECK (comparator IN ('gt', 'gte', 'lt', 'lte', 'eq')),
    threshold_numeric DOUBLE PRECISION NOT NULL DEFAULT 0,
    severity VARCHAR(32) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    notify_email VARCHAR(320),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
    status VARCHAR(40) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    message TEXT,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS sms_mfa_challenges (
    challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    code_hash VARCHAR(160) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_mfa_user_active
    ON sms_mfa_challenges (user_id, consumed, expires_at DESC);
