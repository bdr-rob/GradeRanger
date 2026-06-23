-- cardsight-market upserts into market_valuations with
-- `onConflict: 'card_id'`, but there was no unique constraint to conflict
-- on — every upsert would actually fail. We keep one valuation row per
-- card (always the latest fetch) rather than a full history table, which
-- matches how MarketValuePanel already reads it (order by fetched_at desc,
-- limit 1).

ALTER TABLE market_valuations
  ADD CONSTRAINT market_valuations_card_id_key UNIQUE (card_id);
