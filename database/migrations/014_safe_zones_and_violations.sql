-- Mandatory visitor-safety corridors (union) and violation log for ranger/IT review.
-- When at least one row has is_mandatory = true, in-park positions must fall inside
-- at least one mandatory polygon or a violation row is recorded (throttled in app).

BEGIN;

CREATE TABLE IF NOT EXISTS park_safe_zones (
    safe_zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    park_id UUID NOT NULL REFERENCES parks(park_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_park_safe_zones_park ON park_safe_zones(park_id);
CREATE INDEX IF NOT EXISTS idx_park_safe_zones_gist ON park_safe_zones USING GIST (boundary);

CREATE TABLE IF NOT EXISTS safe_zone_violations (
    violation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    violation_kind VARCHAR(40) NOT NULL DEFAULT 'outside_mandatory_union',
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_safe_zone_violations_created ON safe_zone_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safe_zone_violations_open ON safe_zone_violations(acknowledged, created_at DESC);

COMMIT;
