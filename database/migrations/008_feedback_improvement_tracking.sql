-- =====================================================
-- Migration 008: Feedback improvement tracking
-- =====================================================

ALTER TABLE feedback
    ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
    ADD COLUMN IF NOT EXISTS improvement_status VARCHAR(20) DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS improvement_notes TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'feedback'
          AND constraint_name = 'feedback_improvement_status_check'
    ) THEN
        ALTER TABLE feedback DROP CONSTRAINT feedback_improvement_status_check;
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feedback') THEN
        ALTER TABLE feedback
            ADD CONSTRAINT feedback_improvement_status_check
            CHECK (improvement_status IN ('new', 'in_review', 'planned', 'implemented', 'dismissed'));
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_improvement_status ON feedback(improvement_status);
