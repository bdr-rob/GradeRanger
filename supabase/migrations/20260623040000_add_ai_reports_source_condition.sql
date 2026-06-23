-- Tracks which grading engine produced a report (ximilar vs the previous
-- claude-vision prompt) and Ximilar's verbal condition label (e.g. "Near
-- Mint"), which the Claude prompt never returned in a structured form.
ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS source           VARCHAR DEFAULT 'ximilar',
  ADD COLUMN IF NOT EXISTS condition_label  VARCHAR;
