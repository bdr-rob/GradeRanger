-- ============================================================
-- Grade Ranger — Supabase Database Schema
-- Run this in your Supabase project: Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension (usually already on in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Shared trigger function (created first, used by all tables) ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── profiles ─────────────────────────────────────────────────
-- MUST be first — other policies reference this table.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       VARCHAR,
  full_name   VARCHAR,
  avatar_url  VARCHAR,
  role        VARCHAR DEFAULT 'collector' CHECK (role IN ('collector','admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read/update own profile" ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── cards ────────────────────────────────────────────────────
-- Central card record. One row per physical card.
CREATE TABLE IF NOT EXISTS cards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  internal_card_id  VARCHAR UNIQUE,
  card_name         VARCHAR NOT NULL DEFAULT '',
  player_name       VARCHAR,
  year              VARCHAR,
  set_name          VARCHAR,
  card_number       VARCHAR,
  variation         VARCHAR,
  sport             VARCHAR,
  is_graded         BOOLEAN DEFAULT FALSE,
  grading_company   VARCHAR,
  official_grade    VARCHAR,
  certified_id      VARCHAR,
  image_front_url   VARCHAR,
  image_back_url    VARCHAR,
  status            VARCHAR DEFAULT 'intake'
                      CHECK (status IN ('intake','collection','grading','listed','sold','cancelled')),
  scan_date         TIMESTAMPTZ DEFAULT NOW(),
  notes             TEXT,
  -- Purchase info (mirrors the `purchases` table for quick access on the card row)
  purchase_price    DECIMAL(10,2),
  purchase_location VARCHAR,
  company           VARCHAR,
  -- CardSight identification & market pricing
  cardsight_card_id VARCHAR,
  market_value      DECIMAL(10,2),
  -- Rich CardSight card data (mostly TCG/Pokémon fields)
  rarity            VARCHAR,
  language          VARCHAR,
  release_date      VARCHAR,
  series            VARCHAR,
  set_abbreviation  VARCHAR,
  artist            VARCHAR,
  hp                VARCHAR,
  pokedex_number    VARCHAR,
  evolves_from      VARCHAR,
  flavor_text       TEXT,
  description       TEXT,
  attributes        TEXT[],
  release_name      VARCHAR,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate a human-readable internal_card_id on insert
CREATE OR REPLACE FUNCTION generate_internal_card_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.internal_card_id IS NULL THEN
    NEW.internal_card_id := 'GR-' || UPPER(SUBSTRING(NEW.id::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_internal_card_id
  BEFORE INSERT ON cards
  FOR EACH ROW EXECUTE FUNCTION generate_internal_card_id();

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cards" ON cards
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── purchases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id         UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  purchase_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_cost   DECIMAL(10,2) DEFAULT 0,
  cost_basis      DECIMAL(10,2) GENERATED ALWAYS AS (purchase_price + COALESCE(shipping_cost, 0)) STORED,
  purchase_site   VARCHAR,
  purchase_order  VARCHAR,
  purchase_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchases" ON purchases
  USING (EXISTS (SELECT 1 FROM cards WHERE cards.id = purchases.card_id AND cards.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cards WHERE cards.id = purchases.card_id AND cards.user_id = auth.uid()));

-- ── ai_reports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id             UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  overall_grade       DECIMAL(4,1),
  confidence_score    DECIMAL(5,2),
  centering_lr        DECIMAL(5,2),
  centering_tb        DECIMAL(5,2),
  corner_score        DECIMAL(4,1),
  edge_score          DECIMAL(4,1),
  surface_score       DECIMAL(4,1),
  written_summary     TEXT,
  annotated_front_url VARCHAR,
  annotated_back_url  VARCHAR,
  raw_response        JSONB,
  status              VARCHAR DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','complete','failed')),
  error_code          VARCHAR,
  error_message       TEXT,
  source              VARCHAR DEFAULT 'ximilar',
  condition_label     VARCHAR,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai_reports" ON ai_reports
  USING (EXISTS (SELECT 1 FROM cards WHERE cards.id = ai_reports.card_id AND cards.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cards WHERE cards.id = ai_reports.card_id AND cards.user_id = auth.uid()));

-- ── market_valuations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_valuations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id         UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  raw_low         DECIMAL(10,2),
  raw_median      DECIMAL(10,2),
  raw_high        DECIMAL(10,2),
  graded_values   JSONB,
  data_source     VARCHAR,
  cached_history  JSONB,
  cached_sales    JSONB,
  cached_listings JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE market_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own market_valuations" ON market_valuations
  USING (EXISTS (SELECT 1 FROM cards WHERE cards.id = market_valuations.card_id AND cards.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cards WHERE cards.id = market_valuations.card_id AND cards.user_id = auth.uid()));

-- ── grading_bundles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_bundles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            VARCHAR NOT NULL,
  grading_service VARCHAR NOT NULL CHECK (grading_service IN ('PSA','BGS','CGC','TAG','SGC')),
  service_tier    VARCHAR,
  status          VARCHAR DEFAULT 'building'
                    CHECK (status IN ('building','submitted','at_grader','returned')),
  submitted_at    TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  tracking_number VARCHAR,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER grading_bundles_updated_at
  BEFORE UPDATE ON grading_bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE grading_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own grading_bundles" ON grading_bundles
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── grading_bundle_items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_bundle_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id       UUID REFERENCES grading_bundles(id) ON DELETE CASCADE NOT NULL,
  card_id         UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  grading_fee     DECIMAL(10,2),
  official_grade  VARCHAR,
  graded_at       TIMESTAMPTZ,
  quantity        INT DEFAULT 1,
  declared_value  DECIMAL(10,2),
  addon_ids       UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bundle_id, card_id)
);

ALTER TABLE grading_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bundle items" ON grading_bundle_items
  USING (EXISTS (SELECT 1 FROM grading_bundles WHERE grading_bundles.id = grading_bundle_items.bundle_id AND grading_bundles.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM grading_bundles WHERE grading_bundles.id = grading_bundle_items.bundle_id AND grading_bundles.user_id = auth.uid()));

-- ── listings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id             UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  marketplace         VARCHAR NOT NULL CHECK (marketplace IN ('tcgplayer','ebay','shopify','cardtrader','other')),
  listing_price       DECIMAL(10,2) NOT NULL,
  shipping_amount     DECIMAL(10,2) DEFAULT 0,
  title               VARCHAR,
  description         TEXT,
  external_listing_id VARCHAR,
  listing_url         VARCHAR,
  status              VARCHAR DEFAULT 'draft'
                        CHECK (status IN ('draft','active','sold','expired','cancelled')),
  listed_at           TIMESTAMPTZ DEFAULT NOW(),
  sold_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own listings" ON listings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id          UUID REFERENCES listings(id),
  card_id             UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  sale_price          DECIMAL(10,2) NOT NULL,
  marketplace_fee     DECIMAL(10,2) DEFAULT 0,
  shipping_paid       DECIMAL(10,2) DEFAULT 0,
  net_proceeds        DECIMAL(10,2) GENERATED ALWAYS AS (sale_price - COALESCE(marketplace_fee,0) - COALESCE(shipping_paid,0)) STORED,
  grading_fee_paid    DECIMAL(10,2) DEFAULT 0,
  cost_basis          DECIMAL(10,2) DEFAULT 0,
  net_profit_loss     DECIMAL(10,2) GENERATED ALWAYS AS (
    sale_price - COALESCE(marketplace_fee,0) - COALESCE(shipping_paid,0) - COALESCE(grading_fee_paid,0) - COALESCE(cost_basis,0)
  ) STORED,
  completed_at        TIMESTAMPTZ DEFAULT NOW(),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON transactions
  USING (EXISTS (SELECT 1 FROM cards WHERE cards.id = transactions.card_id AND cards.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cards WHERE cards.id = transactions.card_id AND cards.user_id = auth.uid()));

-- ── grading_addons ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_addons (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grading_service   VARCHAR NOT NULL CHECK (grading_service IN ('PSA','BGS','CGC','TAG','SGC')),
  name              VARCHAR NOT NULL,
  price             DECIMAL(10,2) NOT NULL,
  price_is_minimum  BOOLEAN DEFAULT FALSE,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grading_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read grading_addons" ON grading_addons
  FOR SELECT USING (true);

INSERT INTO grading_addons (grading_service, name, price, price_is_minimum) VALUES
  ('BGS', 'Autograph Card',        5.00, false),
  ('BGS', 'Oversized Card',        8.00, false),
  ('BGS', 'Relabel',               9.95, true),
  ('BGS', 'Graded Card Review',    0.00, false),
  ('BGS', 'Recase (BGS Only)',     9.95, true)
ON CONFLICT DO NOTHING;

-- ── grading_fee_schedules ────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_fee_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grading_service VARCHAR NOT NULL CHECK (grading_service IN ('PSA','BGS','CGC','TAG','SGC')),
  tier_name       VARCHAR NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  turnaround_days INT,
  is_active            BOOLEAN DEFAULT TRUE,
  max_value_per_card   DECIMAL(12,2),
  fee_percent_of_value DECIMAL(5,2),
  is_custom       BOOLEAN DEFAULT FALSE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER fee_schedules_updated_at
  BEFORE UPDATE ON grading_fee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE grading_fee_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform fees" ON grading_fee_schedules
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Admins manage platform fees" ON grading_fee_schedules
  FOR ALL USING (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.uid() = user_id
  );

-- ── catalog_sets ──────────────────────────────────────────────
-- Local cache of CardSight's /v1/catalog/sets, synced by the
-- cardsight-catalog edge function so the Catalog browser page can
-- search/filter without paginating CardSight live.
CREATE TABLE IF NOT EXISTS catalog_sets (
  id              UUID PRIMARY KEY,
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
CREATE POLICY "Anyone can read catalog_sets" ON catalog_sets
  FOR SELECT USING (true);

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

-- Lets PostgREST embed catalog_releases for segment-filtered queries
-- (catalog_sets.select('*, catalog_releases!inner(segment_id)')) instead of
-- filtering with a huge .in(release_id, [...]) list client-side.
ALTER TABLE catalog_sets
  ADD CONSTRAINT catalog_sets_release_id_fkey
  FOREIGN KEY (release_id) REFERENCES catalog_releases(id) NOT VALID;

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

CREATE TABLE IF NOT EXISTS card_population_cache (
  card_id    UUID PRIMARY KEY,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE card_population_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read card_population_cache" ON card_population_cache
  FOR SELECT USING (true);

-- ── marketplace_connections ──────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_connections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform         VARCHAR NOT NULL CHECK (platform IN ('ebay','shopify','cardtrader')),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  store_name       VARCHAR,
  external_user_id VARCHAR,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own connections" ON marketplace_connections
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── audit_log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id),
  action      VARCHAR NOT NULL,
  entity_type VARCHAR,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ── Seed: default grading fee schedules ─────────────────────
-- PSA/CGC/BGS reflect each company's real current submission-form tiers and
-- pricing (see migration 20260623060000). TAG/SGC are still placeholders —
-- update them here the same way once their real tiers are available.
INSERT INTO grading_fee_schedules
  (grading_service, tier_name, price, turnaround_days, max_value_per_card, fee_percent_of_value, is_active, is_custom) VALUES
  -- PSA — Value tiers currently paused by PSA
  ('PSA', 'Value Bulk',         25.00,  NULL,    NULL, NULL, false, false),
  ('PSA', 'Value Bulk Vintage', 25.00,  NULL,    NULL, NULL, false, false),
  ('PSA', 'Value',              33.00,  NULL,    NULL, NULL, false, false),
  ('PSA', 'Value Plus',         50.00,  NULL,    NULL, NULL, false, false),
  ('PSA', 'Value Max',          65.00,  NULL,    NULL, NULL, false, false),
  ('PSA', 'Regular',            80.00,  NULL,    NULL, NULL, true,  false),
  ('PSA', 'Express',           165.00,  NULL,    NULL, NULL, true,  false),
  ('PSA', 'Super Express',     330.00,  NULL,    NULL, NULL, true,  false),

  -- CGC
  ('CGC', 'Bulk',                                17.00, 120,    500.00, NULL, true, false),
  ('CGC', 'Economy',                             20.00,  65,   1000.00, NULL, true, false),
  ('CGC', 'Standard',                            55.00,  10,   3000.00, NULL, true, false),
  ('CGC', 'Express',                            100.00,   5,  10000.00, NULL, true, false),
  ('CGC', 'WalkThrough',                        300.00,   2, 100000.00, NULL, true, false),
  ('CGC', 'Unlimited Value',                    300.00,   2,       NULL, 1.00, true, false),
  ('CGC', 'Jumbo Card',                          20.00, 120,       NULL, NULL, true, false),
  ('CGC', 'TCG, Sports and Non-Sports Coin',     20.00, 120,       NULL, NULL, true, false),

  -- BGS — Base is priced separately with/without subgrades
  ('BGS', 'Base (No Subgrades)', 14.95, 75, NULL, NULL, true, false),
  ('BGS', 'Base (Subgrades)',    17.95, 75, NULL, NULL, true, false),
  ('BGS', 'Standard',            34.95, 45, NULL, NULL, true, false),
  ('BGS', 'Express',             79.95, 15, NULL, NULL, true, false),
  ('BGS', 'Priority',           124.95,  5, NULL, NULL, true, false),

  ('TAG', 'Standard',       35.00,   60, NULL, NULL, true, false),
  ('TAG', 'Express',        75.00,   10, NULL, NULL, true, false),
  ('SGC', 'Economy',        18.00,   90, NULL, NULL, true, false),
  ('SGC', 'Standard',       40.00,   45, NULL, NULL, true, false),
  ('SGC', 'Express',       100.00,   10, NULL, NULL, true, false)
ON CONFLICT DO NOTHING;

-- ── Indexes for performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_cardsight_card_id ON cards(cardsight_card_id);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_card_id ON purchases(card_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_card_id ON ai_reports(card_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON ai_reports(status);
CREATE INDEX IF NOT EXISTS idx_market_valuations_card_id ON market_valuations(card_id);
CREATE INDEX IF NOT EXISTS idx_market_valuations_fetched_at ON market_valuations(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_grading_bundles_user_id ON grading_bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON transactions(card_id);

-- ── Storage bucket for card images ──────────────────────────
-- Go to Supabase Dashboard → Storage → New bucket
-- Name: card-images   Type: Private
