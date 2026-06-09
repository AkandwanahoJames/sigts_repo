-- Server-synced bookmarks, tour completion report notes (§4.4.3 gaps).

CREATE TABLE IF NOT EXISTS user_bookmarks (
    bookmark_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('animal', 'location', 'cultural', 'tab')),
    content_id VARCHAR(120) NOT NULL,
    title VARCHAR(320) NOT NULL DEFAULT '',
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_saved
    ON user_bookmarks (user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS tour_completion_reports (
    tour_session_id UUID PRIMARY KEY REFERENCES tour_sessions(tour_session_id) ON DELETE CASCADE,
    guide_notes TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
