-- Adds the CardSight-derived fields and purchase/market columns that the
-- card intake flow (CardReviewTable.tsx) writes on insert. These were
-- previously missing from the live `cards` table, causing every save to
-- fail with "Could not find the 'market_value' column of 'cards'".
-- All columns use IF NOT EXISTS so this is safe to re-run.

ALTER TABLE cards
  -- Purchase info (previously only tracked in a separate `purchases` table)
  ADD COLUMN IF NOT EXISTS purchase_price     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS purchase_location  VARCHAR,

  -- Identification metadata not covered by existing columns
  ADD COLUMN IF NOT EXISTS company            VARCHAR,

  -- CardSight identification & market pricing
  ADD COLUMN IF NOT EXISTS cardsight_card_id  VARCHAR,
  ADD COLUMN IF NOT EXISTS market_value       DECIMAL(10,2),

  -- Rich CardSight card data (mostly TCG/Pokémon fields)
  ADD COLUMN IF NOT EXISTS rarity             VARCHAR,
  ADD COLUMN IF NOT EXISTS language           VARCHAR,
  ADD COLUMN IF NOT EXISTS release_date       VARCHAR,
  ADD COLUMN IF NOT EXISTS series             VARCHAR,
  ADD COLUMN IF NOT EXISTS set_abbreviation   VARCHAR,
  ADD COLUMN IF NOT EXISTS artist             VARCHAR,
  ADD COLUMN IF NOT EXISTS hp                 VARCHAR,
  ADD COLUMN IF NOT EXISTS pokedex_number     VARCHAR,
  ADD COLUMN IF NOT EXISTS evolves_from       VARCHAR,
  ADD COLUMN IF NOT EXISTS flavor_text        TEXT,
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS attributes         TEXT[],
  ADD COLUMN IF NOT EXISTS release_name       VARCHAR;

CREATE INDEX IF NOT EXISTS idx_cards_cardsight_card_id ON cards(cardsight_card_id);
