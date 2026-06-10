-- User Acceptance Testing (UAT) instrument: System Usability Scale (SUS) + scripted task success.
-- Embedded in-app so UAT evidence is collected from real testers with reliability controls
-- (one current response per tester, server-computed SUS score, role + device provenance).

CREATE TABLE IF NOT EXISTS uat_responses (
    uat_response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(40) NOT NULL DEFAULT 'tourist',
    -- 10 SUS item answers (1=Strongly disagree .. 5=Strongly agree), stored as a JSON array of integers.
    sus_answers JSONB NOT NULL,
    -- SUS score (0-100), computed and validated server-side, never trusted from the client.
    sus_score NUMERIC(5,2) NOT NULL CHECK (sus_score >= 0 AND sus_score <= 100),
    -- Objective scripted-task outcomes: array of { id, label, completed }.
    task_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    task_completion_rate NUMERIC(5,2) CHECK (task_completion_rate >= 0 AND task_completion_rate <= 100),
    comment TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    device VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uat_responses_created ON uat_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uat_responses_role ON uat_responses (role);
