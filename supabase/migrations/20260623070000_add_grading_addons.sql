-- Per-card optional add-ons (Autograph, Oversized, Relabel, etc.) shown on
-- BGS's submission form, separate from the tier table — these stack on top
-- of whatever tier a card is submitted at, rather than being an alternative
-- tier choice.

CREATE TABLE IF NOT EXISTS grading_addons (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grading_service   VARCHAR NOT NULL CHECK (grading_service IN ('PSA','BGS','CGC','TAG','SGC')),
  name              VARCHAR NOT NULL,
  price             DECIMAL(10,2) NOT NULL,
  -- True for "from $X" pricing (Relabel, Recase) where the real cost can run
  -- higher — price is a floor, not a guaranteed flat fee.
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
  ('BGS', 'Recase (BGS Only)',     9.95, true);

-- Selected add-ons per submitted card — stored as an array of grading_addons
-- ids rather than a join table since a card typically picks 0-2 add-ons.
ALTER TABLE grading_bundle_items
  ADD COLUMN IF NOT EXISTS addon_ids UUID[] DEFAULT '{}';
