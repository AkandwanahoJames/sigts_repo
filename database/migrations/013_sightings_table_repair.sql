-- Some deployments skipped the core sightings DDL; animal list queries then fail
-- with "relation sightings does not exist" and the SPA stays on the loading screen.

CREATE TABLE IF NOT EXISTS sightings (
    sighting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    number_observed INTEGER DEFAULT 1,
    behavior TEXT,
    photo_urls TEXT[],
    video_url TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged')),
    verification_notes TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    animal_id UUID NOT NULL REFERENCES animals(animal_id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
    toursession_id UUID,
    tourguide_id UUID,
    tourist_id UUID,
    reported_by_tourist UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sightings_animal_id ON sightings(animal_id);
CREATE INDEX IF NOT EXISTS idx_sightings_location_id ON sightings(location_id);
CREATE INDEX IF NOT EXISTS idx_sightings_timestamp ON sightings(timestamp DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sightings_tour_session'
    ) THEN
        ALTER TABLE sightings
            ADD CONSTRAINT fk_sightings_tour_session
            FOREIGN KEY (toursession_id) REFERENCES tour_sessions(tour_session_id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sightings_tour_guide'
    ) THEN
        ALTER TABLE sightings
            ADD CONSTRAINT fk_sightings_tour_guide
            FOREIGN KEY (tourguide_id) REFERENCES tour_guides(tourguide_id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sightings_tourist'
    ) THEN
        ALTER TABLE sightings
            ADD CONSTRAINT fk_sightings_tourist
            FOREIGN KEY (tourist_id) REFERENCES tourists(tourist_id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
END $$;
