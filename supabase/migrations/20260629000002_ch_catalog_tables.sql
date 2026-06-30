-- Card Hedger catalog cache — sports card sets and their cards.
-- Kept separate from tcg_catalog tables intentionally.
-- Raw JSONB columns preserve the full API response so fields can be
-- surfaced in the UI without requiring a migration for each new field.

CREATE TABLE IF NOT EXISTS ch_sets (
  id           TEXT PRIMARY KEY,        -- Card Hedger set id
  name         VARCHAR NOT NULL,
  year         VARCHAR,
  set_type     VARCHAR,
  category     VARCHAR,
  image_url    TEXT,
  sales_30day  INTEGER,
  raw          JSONB NOT NULL,          -- full API response object
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ch_sets_category   ON ch_sets(category);
CREATE INDEX IF NOT EXISTS idx_ch_sets_year        ON ch_sets(year);
CREATE INDEX IF NOT EXISTS idx_ch_sets_sales       ON ch_sets(sales_30day DESC);
CREATE INDEX IF NOT EXISTS idx_ch_sets_name        ON ch_sets USING gin (to_tsvector('english', name));

ALTER TABLE ch_sets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_sets' AND policyname = 'Anyone can read ch_sets') THEN
    CREATE POLICY "Anyone can read ch_sets" ON ch_sets FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ch_cards (
  id           TEXT PRIMARY KEY,        -- Card Hedger card_id
  set_name     VARCHAR,
  category     VARCHAR,
  player       VARCHAR,
  number       VARCHAR,
  variant      VARCHAR,
  image_url    TEXT,
  rookie       BOOLEAN,
  sales_7day   INTEGER,
  sales_30day  INTEGER,
  raw          JSONB NOT NULL,          -- full API response object
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ch_cards_set_name   ON ch_cards(set_name);
CREATE INDEX IF NOT EXISTS idx_ch_cards_category   ON ch_cards(category);
CREATE INDEX IF NOT EXISTS idx_ch_cards_player     ON ch_cards(player);
CREATE INDEX IF NOT EXISTS idx_ch_cards_rookie     ON ch_cards(rookie);
CREATE INDEX IF NOT EXISTS idx_ch_cards_name       ON ch_cards USING gin (to_tsvector('english', coalesce(player, '') || ' ' || coalesce(set_name, '')));

ALTER TABLE ch_cards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ch_cards' AND policyname = 'Anyone can read ch_cards') THEN
    CREATE POLICY "Anyone can read ch_cards" ON ch_cards FOR SELECT USING (true);
  END IF;
END $$;
