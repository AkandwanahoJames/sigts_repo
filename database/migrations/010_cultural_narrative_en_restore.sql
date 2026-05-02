-- Some deployments drifted: English body and optional media/metadata columns omitted from older baselines.

ALTER TABLE cultural_narratives
    ADD COLUMN IF NOT EXISTS narrative_en TEXT;

ALTER TABLE cultural_narratives
    ADD COLUMN IF NOT EXISTS audio_url TEXT;

ALTER TABLE cultural_narratives
    ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE cultural_narratives
    ADD COLUMN IF NOT EXISTS duration INTEGER;

ALTER TABLE cultural_narratives
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

COMMENT ON COLUMN cultural_narratives.narrative_en IS 'Primary English narrative body for storyteller content';
