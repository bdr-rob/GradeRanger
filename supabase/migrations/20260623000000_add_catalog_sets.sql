-- Local cache of CardSight's /v1/catalog/sets — a free but paginated (max
-- 100/page, ~49k total) endpoint. Synced periodically by the cardsight-catalog
-- edge function (action=sync) so the Catalog browser page can search/filter
-- without paginating CardSight live on every keystroke.

CREATE TABLE IF NOT EXISTS catalog_sets (
  id              UUID PRIMARY KEY,           -- CardSight set id
  name            VARCHAR NOT NULL,
  is_identifiable BOOLEAN NOT NULL DEFAULT FALSE,
  card_count      INT,
  parallel_count  INT,
  release_id      UUID,
  release_name    VARCHAR,
  release_year    VARCHAR,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_sets_release_year ON catalog_sets(release_year);
CREATE INDEX IF NOT EXISTS idx_catalog_sets_name ON catalog_sets USING gin (to_tsvector('english', name || ' ' || coalesce(release_name, '')));

ALTER TABLE catalog_sets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'catalog_sets' AND policyname = 'Anyone can read catalog_sets'
  ) THEN
    CREATE POLICY "Anyone can read catalog_sets" ON catalog_sets FOR SELECT USING (true);
  END IF;
END $$;
