-- Session activity heartbeat (used by authenticateJWT and idle timeout).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_time TIMESTAMPTZ;
