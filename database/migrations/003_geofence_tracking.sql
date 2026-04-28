-- =====================================================
-- SIGTS GEOFENCE TRACKING SUPPORT
-- Adds location history + entry/exit event persistence
-- =====================================================

CREATE TABLE IF NOT EXISTS location_history (
    location_history_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy_meters DECIMAL(8,2),
    speed_kmh DECIMAL(8,2),
    heading_degrees DECIMAL(6,2),
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    inside_park BOOLEAN
);

CREATE TABLE IF NOT EXISTS geofence_events (
    geofence_event_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entry', 'exit')),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_history_user_time
    ON location_history(user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_history_inside_park
    ON location_history(inside_park, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_events_user_time
    ON geofence_events(user_id, event_time DESC);
