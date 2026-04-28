-- =====================================================
-- SIGTS AUTH RECOVERY + MFA SUPPORT
-- =====================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    reset_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_mfa_configs (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    mfa_secret VARCHAR(128) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'authenticator' CHECK (method IN ('authenticator', 'sms')),
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa_configs(enabled);
