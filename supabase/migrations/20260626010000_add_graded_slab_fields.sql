-- Adds cert_number column for slab OCR intake (slab_id endpoint).
-- is_graded, grading_company, and official_grade already exist in the initial schema.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS cert_number VARCHAR;
