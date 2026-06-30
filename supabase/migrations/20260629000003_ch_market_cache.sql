-- Card Hedger market data cache tables.
-- ch_price_history   — permanent daily price points, backfilled from prices-by-card
-- ch_fmv_snapshots   — permanent weekly FMV snapshots (builds our YoY FMV history)
-- ch_price_cache     — all-grades snapshot per card (24h TTL, on-demand refresh)
-- ch_fmv_cache       — FMV per card+grade (24h TTL)
-- ch_comps_cache     — comparable sales per card+grade (24h TTL)
-- ch_top_movers_cache— top movers per category (1h TTL)

-- ── Permanent price history (from prices-by-card, daily points) ──────────────
CREATE TABLE IF NOT EXISTS ch_price_history (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id      TEXT NOT NULL,
  grade        TEXT NOT NULL,
  price_date   DATE NOT NULL,
  price        NUMERIC(12,2),
  raw          JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, grade, price_date)
);

CREATE INDEX IF NOT EXISTS idx_ch_price_history_card_grade ON ch_price_history(card_id, grade);
CREATE INDEX IF NOT EXISTS idx_ch_price_history_date       ON ch_price_history(price_date);

ALTER TABLE ch_price_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_price_history' AND policyname = 'Anyone can read ch_price_history') THEN
    CREATE POLICY "Anyone can read ch_price_history" ON ch_price_history FOR SELECT USING (true);
  END IF;
END $$;

-- ── Permanent weekly FMV snapshots (builds our own YoY FMV history) ──────────
CREATE TABLE IF NOT EXISTS ch_fmv_snapshots (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id           TEXT NOT NULL,
  grade             TEXT NOT NULL,
  snapshot_date     DATE NOT NULL,
  price             NUMERIC(12,2),
  price_low         NUMERIC(12,2),
  price_high        NUMERIC(12,2),
  confidence        NUMERIC(6,4),
  confidence_grade  TEXT,
  method            TEXT,
  raw               JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, grade, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ch_fmv_snapshots_card_grade ON ch_fmv_snapshots(card_id, grade);
CREATE INDEX IF NOT EXISTS idx_ch_fmv_snapshots_date       ON ch_fmv_snapshots(snapshot_date);

ALTER TABLE ch_fmv_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_fmv_snapshots' AND policyname = 'Anyone can read ch_fmv_snapshots') THEN
    CREATE POLICY "Anyone can read ch_fmv_snapshots" ON ch_fmv_snapshots FOR SELECT USING (true);
  END IF;
END $$;

-- ── All-grades price cache (24h TTL) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ch_price_cache (
  card_id    TEXT PRIMARY KEY,
  prices     JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ch_price_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_price_cache' AND policyname = 'Anyone can read ch_price_cache') THEN
    CREATE POLICY "Anyone can read ch_price_cache" ON ch_price_cache FOR SELECT USING (true);
  END IF;
END $$;

-- ── FMV cache per card+grade (24h TTL) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ch_fmv_cache (
  card_id    TEXT NOT NULL,
  grade      TEXT NOT NULL,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_id, grade)
);

ALTER TABLE ch_fmv_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_fmv_cache' AND policyname = 'Anyone can read ch_fmv_cache') THEN
    CREATE POLICY "Anyone can read ch_fmv_cache" ON ch_fmv_cache FOR SELECT USING (true);
  END IF;
END $$;

-- ── Comps cache per card+grade (24h TTL) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ch_comps_cache (
  card_id    TEXT NOT NULL,
  grade      TEXT NOT NULL,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_id, grade)
);

ALTER TABLE ch_comps_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_comps_cache' AND policyname = 'Anyone can read ch_comps_cache') THEN
    CREATE POLICY "Anyone can read ch_comps_cache" ON ch_comps_cache FOR SELECT USING (true);
  END IF;
END $$;

-- ── Top movers cache per category (1h TTL) ────────────────────────────────────
-- category = '' means all categories
CREATE TABLE IF NOT EXISTS ch_top_movers_cache (
  category   TEXT NOT NULL DEFAULT '',
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (category)
);

ALTER TABLE ch_top_movers_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_top_movers_cache' AND policyname = 'Anyone can read ch_top_movers_cache') THEN
    CREATE POLICY "Anyone can read ch_top_movers_cache" ON ch_top_movers_cache FOR SELECT USING (true);
  END IF;
END $$;
