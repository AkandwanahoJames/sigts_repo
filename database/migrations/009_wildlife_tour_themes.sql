-- Session briefing content for UNESCO-aligned wildlife theme tiles on the Animals tab.
-- Enables guides/tourists to open scripted notes during live tour blocks.

CREATE TABLE IF NOT EXISTS wildlife_tour_themes (
    theme_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL UNIQUE,
    session_title VARCHAR(240) NOT NULL,
    subtitle VARCHAR(400),
    tourist_summary_en TEXT NOT NULL,
    guide_script_en TEXT,
    talking_points TEXT[] NOT NULL DEFAULT '{}'::text[],
    safety_notes TEXT,
    etiquette_notes TEXT,
    suggested_duration_minutes INTEGER NOT NULL DEFAULT 25,
    unesco_note TEXT,
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wildlife_tour_themes_slug_format CHECK (
        slug ~ '^[a-z0-9_]+$'
    )
);

CREATE INDEX IF NOT EXISTS idx_wildlife_tour_themes_sort
    ON wildlife_tour_themes (sort_order, slug);
