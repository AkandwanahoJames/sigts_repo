-- Columns referenced by GET /api/animals, GET /api/animals/:id, and /api/sync/download
-- but missing from the original animals DDL (001_initial_schema.sql).

ALTER TABLE animals
    ADD COLUMN IF NOT EXISTS audio_call_url TEXT;

ALTER TABLE animals
    ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE animals
    ADD COLUMN IF NOT EXISTS category VARCHAR(100);
