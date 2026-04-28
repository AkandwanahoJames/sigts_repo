-- =====================================================
-- SIGTS OPERATIONAL SCHEMA REPAIR
-- Idempotent repair migration for environments with partial schema state
-- =====================================================

-- Ensure seed-compatible column exists
ALTER TABLE parks
    ADD COLUMN IF NOT EXISTS entrance_fee JSONB DEFAULT '{}'::jsonb;

-- Ensure core operational route table exists
CREATE TABLE IF NOT EXISTS tour_routes (
    route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    path_geometry GEOMETRY(LINESTRING, 4326),
    distance_km DECIMAL(5,2),
    duration_hours DECIMAL(3,1),
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'moderate', 'difficult', 'expert')),
    elevation_profile JSONB,
    image_urls TEXT[]
);

-- Ensure guide schedule table exists
CREATE TABLE IF NOT EXISTS tour_sessions (
    tour_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    group_size INTEGER,
    vehicle_used VARCHAR(100),
    special_requests TEXT,
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    guide_notes TEXT,
    incidents_reported JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tourguide_id UUID NOT NULL REFERENCES tour_guides(tourguide_id) ON DELETE RESTRICT,
    route_id UUID NOT NULL REFERENCES tour_routes(route_id) ON DELETE RESTRICT,
    park_id UUID NOT NULL REFERENCES parks(park_id) ON DELETE RESTRICT
);

-- Ensure participants table exists
CREATE TABLE IF NOT EXISTS tour_participants (
    tour_session_id UUID NOT NULL REFERENCES tour_sessions(tour_session_id) ON DELETE CASCADE,
    tourist_id UUID NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pickup_location VARCHAR(200),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    feedback_date TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (tour_session_id, tourist_id)
);

-- Ensure guide shift table exists (used by guide operations)
CREATE TABLE IF NOT EXISTS guide_shifts (
    shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'absent')),
    notes TEXT,
    tourguide_id UUID NOT NULL REFERENCES tour_guides(tourguide_id) ON DELETE CASCADE,
    UNIQUE (tourguide_id, shift_date, start_time)
);

-- Ensure reporting table exists for admin dashboards and backups
CREATE TABLE IF NOT EXISTS park_performance_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(20) CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom', 'backup')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics JSONB NOT NULL,
    insights JSONB,
    recommendations JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    report_file TEXT,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    generated_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- Ensure admin stats dependency exists
CREATE TABLE IF NOT EXISTS content_updates (
    contentupdate_id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    version INTEGER DEFAULT 1,
    checksum VARCHAR(64),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (table_name, record_id)
);

-- Keep admin backup route compatible with report type validation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'park_performance_reports'
          AND constraint_name = 'park_performance_reports_report_type_check'
          AND constraint_type = 'CHECK'
    ) THEN
        ALTER TABLE park_performance_reports
            DROP CONSTRAINT park_performance_reports_report_type_check;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'park_performance_reports'
          AND constraint_name = 'park_performance_reports_report_type_check'
          AND constraint_type = 'CHECK'
    ) THEN
        ALTER TABLE park_performance_reports
            ADD CONSTRAINT park_performance_reports_report_type_check
            CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom', 'backup'));
    END IF;
END $$;

-- Recreate dependent foreign keys when running on partially created schemas
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sightings'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'sightings'
              AND constraint_name = 'fk_sightings_tour_session'
        ) THEN
            ALTER TABLE sightings
                ADD CONSTRAINT fk_sightings_tour_session
                FOREIGN KEY (toursession_id) REFERENCES tour_sessions(tour_session_id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_sessions_tourguide_id ON tour_sessions(tourguide_id);
CREATE INDEX IF NOT EXISTS idx_tour_sessions_status ON tour_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tour_sessions_scheduled_start ON tour_sessions(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tour_participants_tourist_id ON tour_participants(tourist_id);
CREATE INDEX IF NOT EXISTS idx_guide_shifts_tourguide_id ON guide_shifts(tourguide_id);
CREATE INDEX IF NOT EXISTS idx_guide_shifts_shift_date ON guide_shifts(shift_date);
