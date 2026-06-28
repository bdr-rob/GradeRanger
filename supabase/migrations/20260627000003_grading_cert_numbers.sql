-- Order number on the bundle (the submission # from PSA/CGC/BGS)
ALTER TABLE grading_bundles
  ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Cert number per card in the bundle (assigned by grader when grades return)
ALTER TABLE grading_bundle_items
  ADD COLUMN IF NOT EXISTS cert_number TEXT;
