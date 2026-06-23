-- Extends the catalog cache (see 20260623000000_add_catalog_sets.sql) to
-- manufacturers and releases, plus a cache-on-read table for release
-- checklists. CardSight's catalog endpoints are tightly rate-limited
-- (x-ratelimit-limit: 4, short sliding window), so anything with unbounded
-- cardinality — full checklists, free-text search — is fetched live once
-- and cached here rather than synced wholesale like sets/manufacturers/releases.

CREATE TABLE IF NOT EXISTS catalog_manufacturers (
  id          UUID PRIMARY KEY,
  name        VARCHAR NOT NULL,
  description TEXT,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE catalog_manufacturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read catalog_manufacturers" ON catalog_manufacturers
  FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS catalog_releases (
  id              UUID PRIMARY KEY,
  name            VARCHAR NOT NULL,
  year            VARCHAR,
  is_identifiable BOOLEAN NOT NULL DEFAULT FALSE,
  description     TEXT,
  manufacturer_id UUID,
  segment_id      UUID,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_releases_year ON catalog_releases(year);
CREATE INDEX IF NOT EXISTS idx_catalog_releases_manufacturer ON catalog_releases(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_releases_name ON catalog_releases USING gin (to_tsvector('english', name));

ALTER TABLE catalog_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read catalog_releases" ON catalog_releases
  FOR SELECT USING (true);

-- Cache-on-read: populated lazily by cardsight-catalog's release_detail
-- action the first time a release's checklist is requested, since syncing
-- every card up front (millions of rows) isn't worth it.
CREATE TABLE IF NOT EXISTS release_cards_cache (
  release_id UUID PRIMARY KEY,
  cards      JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE release_cards_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read release_cards_cache" ON release_cards_cache
  FOR SELECT USING (true);
