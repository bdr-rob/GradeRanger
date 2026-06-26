-- "Prepare for listing" is a distinct earlier stage than actually being
-- live on a marketplace — a card can be priced/described and waiting to be
-- pushed (or manually posted) without being 'active' yet. Add 'draft' to
-- the allowed statuses.
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('draft','active','sold','expired','cancelled'));

ALTER TABLE listings ALTER COLUMN status SET DEFAULT 'draft';

-- What we'll push to eBay (or any marketplace) as the listing title/body —
-- generated from the card's CardSight data but editable before publish.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS title       VARCHAR,
  ADD COLUMN IF NOT EXISTS description TEXT;
