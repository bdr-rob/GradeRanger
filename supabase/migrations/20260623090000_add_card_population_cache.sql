-- Cache-on-read for CardSight's /v1/population/card/{card_id} — same tight
-- rate limit as the other catalog/pricing endpoints, and population counts
-- don't change minute to minute, so fetch live once and serve from here.
CREATE TABLE IF NOT EXISTS card_population_cache (
  card_id    UUID PRIMARY KEY,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE card_population_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read card_population_cache" ON card_population_cache
  FOR SELECT USING (true);
