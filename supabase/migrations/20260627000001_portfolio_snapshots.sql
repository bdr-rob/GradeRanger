-- Portfolio snapshots: daily value history driven from the cards table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date  DATE        NOT NULL,
  total_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value    NUMERIC(12,2) NOT NULL DEFAULT 0,
  card_count     INTEGER     NOT NULL DEFAULT 0,
  realized_gains NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own snapshots"
  ON portfolio_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS portfolio_snapshots_user_date
  ON portfolio_snapshots(user_id, snapshot_date DESC);
