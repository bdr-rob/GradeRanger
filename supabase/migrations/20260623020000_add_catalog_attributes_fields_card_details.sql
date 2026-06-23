-- Reference lookups (attributes ~1k rows, fields ~45 rows — small, full-synced
-- like manufacturers) plus a cache-on-read table for single-card detail
-- (/v1/catalog/cards/{id}), fetched live one card at a time when a user
-- drills into a specific card from a checklist.

CREATE TABLE IF NOT EXISTS catalog_attributes (
  id          UUID PRIMARY KEY,
  name        VARCHAR,
  short_name  VARCHAR,
  description TEXT,
  card_count  INT,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE catalog_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read catalog_attributes" ON catalog_attributes
  FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS catalog_fields (
  id          UUID PRIMARY KEY,
  key         VARCHAR NOT NULL,
  name        VARCHAR,
  description TEXT,
  usage_count INT,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE catalog_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read catalog_fields" ON catalog_fields
  FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS card_details_cache (
  card_id    UUID PRIMARY KEY,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE card_details_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read card_details_cache" ON card_details_cache
  FOR SELECT USING (true);
