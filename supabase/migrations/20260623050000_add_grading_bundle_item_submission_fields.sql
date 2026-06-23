-- Submission-form fields for grading_bundle_items — quantity (almost always
-- 1, but PSA/CGC forms support multi-quantity lines for identical cards) and
-- declared_value (used for insurance/customs on the physical submission,
-- separate from grading_fee which is what we pay the grading company).
ALTER TABLE grading_bundle_items
  ADD COLUMN IF NOT EXISTS quantity       INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS declared_value DECIMAL(10,2);
