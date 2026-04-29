-- =====================================================
-- SIGTS FEEDBACK EXPANSION FOR CONTINUOUS IMPROVEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tourist_id UUID,
    tour_session_id UUID,
    tourguide_id UUID
);

-- Expand feedback categories to support functional requirement 3.1.1.12
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'feedback'
          AND constraint_name = 'feedback_category_check'
    ) THEN
        ALTER TABLE feedback DROP CONSTRAINT feedback_category_check;
    END IF;
EXCEPTION WHEN undefined_table THEN
    -- feedback table variant may not exist in all environments
    NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feedback') THEN
        ALTER TABLE feedback
            ADD CONSTRAINT feedback_category_check
            CHECK (category IN (
                'tour', 'guide', 'content', 'app', 'general',
                'bug_report', 'feature_suggestion', 'nps', 'survey', 'helpfulness'
            ));
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Add manager response and extra context fields
ALTER TABLE feedback
    ADD COLUMN IF NOT EXISTS response_text TEXT,
    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_content_id UUID,
    ADD COLUMN IF NOT EXISTS source_content_type VARCHAR(40),
    ADD COLUMN IF NOT EXISTS nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS helpfulness_rating INTEGER CHECK (helpfulness_rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_responded_at ON feedback(responded_at);
