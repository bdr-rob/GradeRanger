-- Replaces the placeholder PSA/CGC/BGS fee schedule rows with each
-- company's real current submission-form tiers/pricing, and adds the
-- columns needed to model them accurately:
--   is_active           — PSA has paused its "Value" tiers as of this
--                          writing; modeling this lets the tier picker grey
--                          them out instead of offering a tier you can't
--                          actually submit at.
--   max_value_per_card  — several CGC tiers cap the declared value they'll
--                          accept (e.g. Bulk tops out at $500/card).

ALTER TABLE grading_fee_schedules
  ADD COLUMN IF NOT EXISTS is_active          BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_value_per_card DECIMAL(12,2),
  -- CGC's "Unlimited Value" tier is $300 + 1% of the card's fair market
  -- value, not a flat fee — store the percentage so `price` stays an
  -- accurate base/flat component instead of silently underquoting it.
  ADD COLUMN IF NOT EXISTS fee_percent_of_value DECIMAL(5,2);

-- Clear out the old placeholder defaults for these three services (custom/
-- user-owned rows are untouched) before reinserting the real tiers.
DELETE FROM grading_fee_schedules
  WHERE grading_service IN ('PSA', 'CGC', 'BGS')
    AND is_custom = false
    AND user_id IS NULL;

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
  ('BGS', 'Priority',           124.95,  5, NULL, NULL, true, false);
