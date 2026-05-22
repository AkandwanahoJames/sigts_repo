-- Repair missing visitor_flow table (required for §4.3.4 / analytics FR-11)
CREATE TABLE IF NOT EXISTS visitor_flow (
    flow_id BIGSERIAL PRIMARY KEY,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    departure_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    group_size INTEGER,
    tourist_id UUID REFERENCES tourists(tourist_id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
    tour_session_id UUID REFERENCES tour_sessions(tour_session_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_visitor_flow_location_id ON visitor_flow(location_id);
CREATE INDEX IF NOT EXISTS idx_visitor_flow_arrival_time ON visitor_flow(arrival_time DESC);
