-- The original schema used 'owned' as a card status; the current schema uses
-- 'collection'. The constraint must be dropped first so the UPDATE isn't
-- blocked by the old allowed-values list.
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_status_check;

UPDATE cards SET status = 'collection' WHERE status = 'owned';

ALTER TABLE cards ADD CONSTRAINT cards_status_check
  CHECK (status IN ('intake','collection','grading','listed','sold','cancelled'));
