-- Extend market_valuations to cache the full processed market response
-- alongside the existing headline numbers. This lets MarketValuePanel serve
-- the price-history chart, recent-sales table, and active-listings table
-- directly from the DB on page load — eliminating the two CardSight API
-- calls that currently fire on every Market tab visit.
--
-- Staleness is checked against the existing fetched_at column; the edge
-- function only calls CardSight when the cached data is absent or older
-- than MARKET_CACHE_MAX_AGE_HOURS (default 4).
ALTER TABLE market_valuations
  ADD COLUMN IF NOT EXISTS cached_history  JSONB,
  ADD COLUMN IF NOT EXISTS cached_sales    JSONB,
  ADD COLUMN IF NOT EXISTS cached_listings JSONB;
