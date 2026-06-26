-- Cache for TCG API price lookups, keyed on tcgapi card id
CREATE TABLE IF NOT EXISTS tcgapi_price_cache (
  id            VARCHAR PRIMARY KEY,  -- tcgapi card id
  name          VARCHAR,
  game          VARCHAR,
  set_name      VARCHAR,
  data          JSONB NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tcgapi_price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON tcgapi_price_cache FOR SELECT USING (true);
