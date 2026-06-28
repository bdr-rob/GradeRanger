-- Subscription plans (admin-managed, DB-driven)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT        NOT NULL,
  description     TEXT,
  price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_annual    NUMERIC(10,2),
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual  TEXT,
  features        JSONB       NOT NULL DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active plans (for upgrade flows)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_plans' AND policyname = 'Auth users read active plans') THEN
    CREATE POLICY "Auth users read active plans" ON subscription_plans FOR SELECT TO authenticated USING (is_active = TRUE);
  END IF;
END $$;

-- Only admins can write plans (enforced via profiles.role check in app layer)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_plans' AND policyname = 'Admins manage plans') THEN
    CREATE POLICY "Admins manage plans" ON subscription_plans FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;
END $$;

-- Seed a default free plan so every existing user has something to reference
INSERT INTO subscription_plans (name, description, price_monthly, features, is_active, sort_order)
VALUES ('Free', 'Get started with Grade Ranger', 0, '{"max_cards": 25, "shipping": false, "portfolio": true, "grading": true}', TRUE, 0)
ON CONFLICT DO NOTHING;

-- Extend profiles with subscription + shipping + integrations fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name        TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan_id   UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS ship_from_address      JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS integrations           JSONB DEFAULT '{}';

-- Shipping fields on grading_bundles
ALTER TABLE grading_bundles
  ADD COLUMN IF NOT EXISTS shipstation_order_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number      TEXT,
  ADD COLUMN IF NOT EXISTS label_url            TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at           TIMESTAMPTZ;

-- Shipping fields on cards (for sold card labels)
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS shipstation_order_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number      TEXT,
  ADD COLUMN IF NOT EXISTS label_url            TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at           TIMESTAMPTZ;
