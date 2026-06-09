-- Global Search: Full-text search vectors for cross-entity search
-- Uses triggers instead of generated columns because to_tsvector is not IMMUTABLE

-- Add search_vector columns (plain, not generated)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE tickets SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''));
UPDATE assets SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(hostname, '') || ' ' || coalesce(serial_number, '') || ' ' || coalesce(array_to_string(tags, ' '), ''));
UPDATE users SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(department, '') || ' ' || coalesce(title, ''));

-- Create GIN indexes for fast search
CREATE INDEX IF NOT EXISTS idx_tickets_search ON tickets USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_assets_search ON assets USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING GIN(search_vector);

-- Trigger functions to keep search_vector updated
CREATE OR REPLACE FUNCTION update_tickets_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '') || ' ' || coalesce(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_search_vector ON tickets;
CREATE TRIGGER trg_tickets_search_vector
  BEFORE INSERT OR UPDATE OF title, description, tags ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_tickets_search_vector();

CREATE OR REPLACE FUNCTION update_assets_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.display_name, '') || ' ' || coalesce(NEW.hostname, '') || ' ' || coalesce(NEW.serial_number, '') || ' ' || coalesce(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assets_search_vector ON assets;
CREATE TRIGGER trg_assets_search_vector
  BEFORE INSERT OR UPDATE OF name, display_name, hostname, serial_number, tags ON assets
  FOR EACH ROW EXECUTE FUNCTION update_assets_search_vector();

CREATE OR REPLACE FUNCTION update_users_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.email, '') || ' ' || coalesce(NEW.department, '') || ' ' || coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_search_vector ON users;
CREATE TRIGGER trg_users_search_vector
  BEFORE INSERT OR UPDATE OF name, email, department, title ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_search_vector();
