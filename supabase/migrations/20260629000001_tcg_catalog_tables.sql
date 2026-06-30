-- TCG API catalog cache — replaces the broken CardSight sync.
-- Sets and cards are keyed by TCG API integer IDs (stored as TEXT for flexibility).

CREATE TABLE IF NOT EXISTS tcg_games (
  id          TEXT PRIMARY KEY,   -- TCG API game id (integer as text)
  name        VARCHAR NOT NULL,
  slug        VARCHAR NOT NULL,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tcg_games ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tcg_games' AND policyname = 'Anyone can read tcg_games') THEN
    CREATE POLICY "Anyone can read tcg_games" ON tcg_games FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tcg_sets (
  id             TEXT PRIMARY KEY,   -- TCG API set id
  game_id        TEXT NOT NULL,
  game_name      VARCHAR,
  game_slug      VARCHAR,
  name           VARCHAR NOT NULL,
  slug           VARCHAR,
  abbreviation   VARCHAR,
  release_date   DATE,
  card_count     INT,
  image_url      TEXT,
  synced_at      TIMESTAMPTZ DEFAULT NOW(),
  cards_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tcg_sets_game_id ON tcg_sets(game_id);
CREATE INDEX IF NOT EXISTS idx_tcg_sets_name ON tcg_sets USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_tcg_sets_release_date ON tcg_sets(release_date);

ALTER TABLE tcg_sets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tcg_sets' AND policyname = 'Anyone can read tcg_sets') THEN
    CREATE POLICY "Anyone can read tcg_sets" ON tcg_sets FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tcg_cards (
  id           TEXT PRIMARY KEY,   -- TCG API card id
  set_id       TEXT NOT NULL REFERENCES tcg_sets(id) ON DELETE CASCADE,
  game_id      TEXT,
  game_slug    VARCHAR,
  name         VARCHAR NOT NULL,
  number       VARCHAR,
  rarity       VARCHAR,
  product_type VARCHAR,
  printing     VARCHAR,
  foil_only    BOOLEAN,
  image_url    TEXT,
  metadata     JSONB,              -- attacks, hp, energy type, subtypes, etc.
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcg_cards_set_id  ON tcg_cards(set_id);
CREATE INDEX IF NOT EXISTS idx_tcg_cards_game_id ON tcg_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_tcg_cards_name    ON tcg_cards USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_tcg_cards_number  ON tcg_cards(number);

ALTER TABLE tcg_cards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tcg_cards' AND policyname = 'Anyone can read tcg_cards') THEN
    CREATE POLICY "Anyone can read tcg_cards" ON tcg_cards FOR SELECT USING (true);
  END IF;
END $$;
