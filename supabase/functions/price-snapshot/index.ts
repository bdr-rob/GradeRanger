import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Weekly job: fetch FMV for every graded card in users' collections and store
// a snapshot in ch_fmv_snapshots. Over time this builds a true YoY FMV history
// that extends beyond Card Hedger's 90-day window.
//
// Also backfills full price history (prices-by-card) for any card+grade that
// has no history yet — this seeds charts back to ~2020 for free.

const CH_BASE = 'https://api.cardhedger.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function db() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function chPost(path: string, body: object, key: string): Promise<any> {
  const res = await fetch(`${CH_BASE}${path}`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Card Hedger ${path} HTTP ${res.status}: ${text}`)
  return JSON.parse(text)
}

// Backfill price history year-by-year for a card+grade
async function backfillHistory(cardId: string, grade: string, key: string): Promise<number> {
  const today   = new Date()
  const LEAP    = new Set([2020, 2024, 2028])
  let total     = 0

  // Current year to date
  const daysYTD = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const ytd     = await chPost('/v1/cards/prices-by-card', { card_id: cardId, grade, days: daysYTD }, key)
  const ytdPrices: any[] = ytd?.prices ?? []
  if (ytdPrices.length === 0) return 0

  const storeRows = (prices: any[]) => prices.map((p: any) => ({
    card_id:    cardId,
    grade,
    price_date: (p.closing_date ?? '').slice(0, 10),
    price:      parseFloat(p.price) || null,
    raw:        p,
  })).filter((r) => r.price_date)

  const client = db()
  const ytdRows = storeRows(ytdPrices)
  if (ytdRows.length) {
    await client.from('ch_price_history').upsert(ytdRows, { onConflict: 'card_id,grade,price_date' })
    total += ytdRows.length
  }

  // Page back year by year
  let year = today.getFullYear() - 1
  while (year >= 2020) {
    const days    = LEAP.has(year) ? 366 : 365
    const endDate = `${year}-12-31`
    const data    = await chPost('/v1/cards/prices-by-card', { card_id: cardId, grade, days, end_date: endDate }, key)
    const prices: any[] = data?.prices ?? []
    if (prices.length === 0) break
    const rows = storeRows(prices)
    if (rows.length) {
      await client.from('ch_price_history').upsert(rows, { onConflict: 'card_id,grade,price_date' })
      total += rows.length
    }
    year--
  }
  return total
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const key = Deno.env.get('CARDHEDGE_API_KEY')
    if (!key) return json({ error: 'CARDHEDGE_API_KEY not set' }, 500)

    const client   = db()
    const today    = new Date().toISOString().slice(0, 10)
    const summary  = { cards_found: 0, fmv_snapshots: 0, history_backfilled: 0, errors: 0 }

    // 1. Collect all distinct cardhedge_card_id + grade combos from the cards table
    const { data: cardRows } = await client
      .from('cards')
      .select('cardhedge_card_id, official_grade, grading_company')
      .not('cardhedge_card_id', 'is', null)

    if (!cardRows || cardRows.length === 0) {
      return json({ ok: true, message: 'No cards with cardhedge_card_id found', summary })
    }

    // Build unique card+grade pairs
    const seen = new Set<string>()
    const pairs: { card_id: string; grade: string }[] = []

    for (const row of cardRows) {
      const cardId = row.cardhedge_card_id
      // Use official grade if present, otherwise 'Raw'
      const grade  = row.official_grade
        ? `${row.grading_company ?? 'PSA'} ${row.official_grade}`.trim()
        : 'Raw'
      const key2   = `${cardId}::${grade}`
      if (!seen.has(key2)) { seen.add(key2); pairs.push({ card_id: cardId, grade }) }
    }

    summary.cards_found = pairs.length

    // 2. Backfill price history for any card+grade with no history yet
    for (const { card_id, grade } of pairs) {
      const { count } = await client
        .from('ch_price_history')
        .select('*', { count: 'exact', head: true })
        .eq('card_id', card_id).eq('grade', grade)

      if ((count ?? 0) === 0) {
        try {
          const stored = await backfillHistory(card_id, grade, key)
          summary.history_backfilled += stored
        } catch (err) {
          console.error(`Backfill failed ${card_id} ${grade}:`, err)
          summary.errors++
        }
      }
    }

    // 3. Batch FMV snapshot — call fmv-batch in chunks of 100
    const BATCH = 100
    for (let i = 0; i < pairs.length; i += BATCH) {
      const chunk = pairs.slice(i, i + BATCH)
      try {
        const data = await chPost('/v1/cards/card-fmv-batch', { items: chunk }, key)
        const results: any[] = data?.results ?? []

        const snapshotRows = results
          .filter((r) => r.price != null)
          .map((r) => ({
            card_id:          r.card_id,
            grade:            r.grade,
            snapshot_date:    today,
            price:            r.price,
            price_low:        r.price_low ?? null,
            price_high:       r.price_high ?? null,
            confidence:       r.confidence ?? null,
            confidence_grade: r.confidence_grade ?? null,
            method:           r.method ?? null,
            raw:              r,
          }))

        if (snapshotRows.length > 0) {
          await client
            .from('ch_fmv_snapshots')
            .upsert(snapshotRows, { onConflict: 'card_id,grade,snapshot_date' })
          summary.fmv_snapshots += snapshotRows.length
        }
      } catch (err) {
        console.error(`FMV batch failed at offset ${i}:`, err)
        summary.errors++
      }
    }

    return json({ ok: true, date: today, summary })
  } catch (err) {
    console.error('price-snapshot error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
