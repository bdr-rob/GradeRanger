import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BASE = 'https://api.cardhedger.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CACHE_1H  = 60 * 60 * 1000
const CACHE_24H = 24 * 60 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function respond(payload: object, status = 200) {
  return new Response(JSON.stringify(payload), {
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
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Card Hedger ${path} HTTP ${res.status}: ${text}`)
  return JSON.parse(text)
}

async function chGet(path: string, key: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-API-Key': key } })
  const text = await res.text()
  if (!res.ok) throw new Error(`Card Hedger ${path} HTTP ${res.status}: ${text}`)
  return JSON.parse(text)
}

async function getCached(
  table: string,
  match: Record<string, string>,
  maxAgeMs: number,
): Promise<any | null> {
  let q = db().from(table).select('data, fetched_at')
  for (const [k, v] of Object.entries(match)) q = (q as any).eq(k, v)
  const { data } = await (q as any).maybeSingle()
  if (!data) return null
  if (Date.now() - new Date(data.fetched_at).getTime() > maxAgeMs) return null
  return data.data
}

async function setCache(table: string, row: Record<string, any>): Promise<void> {
  await db().from(table).upsert({ ...row, fetched_at: new Date().toISOString() })
}

// ── Existing normalizers ──────────────────────────────────────────────────────

function parseGradeValue(g: string) { return (g ?? '').replace(/^[A-Za-z]+\s+/i, '').trim() }
function extractYear(t: string) { const m = (t ?? '').match(/\b(19|20)\d{2}\b/); return m ? m[0] : '' }

function normalizeImageMatchResponse(data: any) {
  const m = data?.best_match ?? null
  const mapCandidate = (c: any) => ({
    cardHedgeId: c.card_id ?? '', player: c.player ?? '', setName: c.set ?? '',
    cardNumber: c.number ?? '', variant: c.variant ?? '', category: c.category ?? '',
    description: c.description ?? '', cardImage: c.image ?? '',
    year: extractYear(c.set ?? c.description ?? ''),
  })
  if (!m) return { matched: false, candidates: (data?.candidates ?? []).map(mapCandidate) }
  return {
    matched: true, cardHedgeId: m.card_id ?? '', player: m.player ?? '',
    setName: m.set ?? '', cardNumber: m.number ?? '', variant: m.variant ?? '',
    category: m.category ?? '', description: m.description ?? '', cardImage: m.image ?? '',
    year: extractYear(m.set ?? m.description ?? ''), confidence: m.confidence ?? 0.9,
    candidates: (data?.candidates ?? []).map(mapCandidate),
  }
}

function normalizeCertResponse(data: any) {
  const ci = data?.cert_info ?? {}; const card = data?.card ?? {}
  const prices: { date: string; grade: string; price: number }[] =
    (data?.prices ?? []).map((p: any) => ({
      date: p.closing_date ?? '', grade: p.Grade ?? ci.grade ?? '',
      price: parseFloat(p.price) || 0,
    }))
  const gradeLabel = parseGradeValue(ci.grade ?? '')
  const pool = prices.filter((p) => !gradeLabel || p.grade.includes(gradeLabel) || p.grade === ci.grade)
  const vals = (pool.length >= 2 ? pool : prices).map((p) => p.price).sort((a, b) => a - b)
  const mid = Math.floor(vals.length / 2)
  const marketValue = vals.length === 0 ? null
    : vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  return {
    gradeCompany: (ci.grader ?? '').toUpperCase(), gradeValue: gradeLabel,
    certNumber: ci.cert ?? '', player: card.player ?? '',
    year: extractYear(card.set ?? '') || extractYear(ci.description ?? ''),
    setName: card.set ?? '', cardNumber: card.number ?? '', variant: card.variant ?? '',
    category: card.category ?? '', cardHedgeId: card.card_id ?? '',
    cardImage: card.image ?? '', marketValue, recentSales: prices,
    confidence: data?.match_confidence ?? (ci.gemrate_id ? 1 : 0.5),
    description: ci.description ?? card.description ?? '',
  }
}

function normalizePriceArray(raw: any[]) {
  return (raw ?? []).map((p: any) => ({
    date: p.closing_date ?? p.date ?? '', grade: p.Grade ?? p.grade ?? '',
    price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
  })).filter((p) => p.price > 0)
}

// ── Price history helpers ─────────────────────────────────────────────────────

// Fetch one year window and upsert into ch_price_history
async function fetchAndStoreWindow(
  cardId: string, grade: string, days: number, endDate: string | null, key: string,
): Promise<{ prices: any[]; stored: number }> {
  const body: any = { card_id: cardId, grade, days }
  if (endDate) body.end_date = endDate
  const data = await chPost('/v1/cards/prices-by-card', body, key)
  const prices: any[] = data?.prices ?? []
  if (prices.length === 0) return { prices: [], stored: 0 }

  const rows = prices.map((p: any) => ({
    card_id:    cardId,
    grade,
    price_date: (p.closing_date ?? '').slice(0, 10),
    price:      parseFloat(p.price) || null,
    raw:        p,
  })).filter((r) => r.price_date)

  if (rows.length > 0) {
    await db().from('ch_price_history').upsert(rows, { onConflict: 'card_id,grade,price_date' })
  }
  return { prices, stored: rows.length }
}

// Backfill all available history for a card+grade (2020 → today)
async function backfillPriceHistory(cardId: string, grade: string, key: string): Promise<number> {
  let total = 0

  // Current year to date
  const today = new Date()
  const daysThisYear = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const { prices: latest, stored: s0 } = await fetchAndStoreWindow(cardId, grade, daysThisYear, null, key)
  total += s0
  if (latest.length === 0) return total

  // Page back year by year until empty
  const LEAP_YEARS = new Set([2020, 2024, 2028])
  let year = today.getFullYear() - 1
  while (year >= 2020) {
    const days = LEAP_YEARS.has(year) ? 366 : 365
    const endDate = `${year}-12-31`
    const { prices, stored } = await fetchAndStoreWindow(cardId, grade, days, endDate, key)
    total += stored
    if (prices.length === 0) break
    year--
  }
  return total
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const key = Deno.env.get('CARDHEDGE_API_KEY')
    if (!key) return respond({ error: 'CARDHEDGE_API_KEY not configured' }, 500)

    const body = await req.json()
    const { mode } = body

    // ── Cert lookup ───────────────────────────────────────────────────────────
    if (mode === 'cert') {
      const { cert, grader = 'PSA', days = 180 } = body
      if (!cert) return respond({ error: 'cert is required' }, 400)
      const res = await fetch(`${BASE}/v1/cards/prices-by-cert`, {
        method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert: String(cert).trim(), grader, days }),
      })
      const text = await res.text()
      if (!res.ok) {
        const msg = res.status === 404 ? 'Cert number not found'
          : res.status === 429 ? 'Rate limit reached' : `Card Hedge error ${res.status}`
        return respond({ error: msg })
      }
      return respond({ ...normalizeCertResponse(JSON.parse(text)), _source: 'cert' })
    }

    // ── Cert OCR ──────────────────────────────────────────────────────────────
    if (mode === 'image') {
      const { image_base64, days = 180 } = body
      if (!image_base64) return respond({ error: 'image_base64 is required' }, 400)
      const res = await fetch(`${BASE}/v1/cards/prices-by-cert-ocr`, {
        method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64, days }),
      })
      const text = await res.text()
      if (!res.ok) return respond({ error: `Card Hedge OCR error ${res.status}` })
      return respond({ ...normalizeCertResponse(JSON.parse(text)), _source: 'image' })
    }

    // ── Image match ───────────────────────────────────────────────────────────
    if (mode === 'image-match') {
      const { image_base64, image_url, k = 10 } = body
      if (!image_base64 && !image_url) return respond({ error: 'image_base64 or image_url required' }, 400)
      const res = await fetch(`${BASE}/v1/cards/image-match`, {
        method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64, image_url, k }),
      })
      if (!res.ok) return respond({ error: `Card Hedge image-match error ${res.status}` })
      return respond(normalizeImageMatchResponse(await res.json()))
    }

    // ── Market / card-match ───────────────────────────────────────────────────
    if (mode === 'market') {
      const { query, category, card_id, cardHedgeId } = body
      const resolvedId = card_id || cardHedgeId
      if (resolvedId) {
        const data = await chPost('/v1/cards/card-details', { card_id: resolvedId }, key)
        const card = data?.cards?.[0]
        if (card) return respond({ card, prices: normalizePriceArray(card.prices ?? []) })
      }
      if (!query) return respond({ error: 'query or card_id required' }, 400)
      const data = await chPost('/v1/cards/card-match', { query, category }, key)
      return respond({ card: data?.card ?? null, prices: normalizePriceArray(data?.card?.prices ?? []), confidence: data?.confidence ?? 0 })
    }

    // ── Card search ───────────────────────────────────────────────────────────
    if (mode === 'search') {
      const { search, category, page = 1, page_size = 20 } = body
      const data = await chPost('/v1/cards/card-search', { search, category, page, page_size }, key)
      return respond(data)
    }

    // ── Batch cert lookup (up to 100) ─────────────────────────────────────────
    if (mode === 'batch_certs') {
      const { certs, grader = 'PSA' } = body
      if (!Array.isArray(certs) || certs.length === 0) return respond({ error: 'certs array required' }, 400)
      if (certs.length > 100) return respond({ error: 'Maximum 100 certs per request' }, 400)
      const data = await chPost('/v1/cards/details-by-certs', { certs, grader }, key)
      return respond(data)
    }

    // ── Price history (with DB storage + optional backfill) ───────────────────
    if (mode === 'prices_by_card') {
      const { card_id, grade, days = 180, end_date = null, backfill = false } = body
      if (!card_id) return respond({ error: 'card_id required' }, 400)
      if (!grade)   return respond({ error: 'grade required' }, 400)

      if (backfill) {
        // Check if we already have history; if so skip backfill
        const { count } = await db()
          .from('ch_price_history')
          .select('*', { count: 'exact', head: true })
          .eq('card_id', card_id).eq('grade', grade)
        if ((count ?? 0) === 0) {
          const stored = await backfillPriceHistory(card_id, grade, key)
          return respond({ ok: true, backfilled: true, stored })
        }
        return respond({ ok: true, backfilled: false, message: 'History already present' })
      }

      const { prices, stored } = await fetchAndStoreWindow(card_id, grade, days, end_date, key)
      return respond({ prices, stored })
    }

    // ── All prices across all grades (24h cache) ──────────────────────────────
    if (mode === 'all_prices') {
      const { card_id, force = false } = body
      if (!card_id) return respond({ error: 'card_id required' }, 400)

      if (!force) {
        const cached = await getCached('ch_price_cache', { card_id }, CACHE_24H)
        if (cached) return respond({ prices: cached, _source: 'cache' })
      }

      const data = await chPost('/v1/cards/all-prices-by-card', { card_id }, key)
      await setCache('ch_price_cache', { card_id, data: data?.prices ?? [] })
      return respond({ prices: data?.prices ?? [], _source: 'live' })
    }

    // ── Comparable sales (24h cache) ──────────────────────────────────────────
    if (mode === 'comps') {
      const { card_id, grade, count = 10, time_weighted = false, include_raw_prices = true, force = false } = body
      if (!card_id) return respond({ error: 'card_id required' }, 400)
      if (!grade)   return respond({ error: 'grade required' }, 400)

      const cacheKey = `${card_id}::${grade}::${count}::${time_weighted}`
      if (!force) {
        const { data: row } = await db().from('ch_comps_cache')
          .select('data, fetched_at').eq('card_id', card_id).eq('grade', grade).maybeSingle()
        if (row && Date.now() - new Date(row.fetched_at).getTime() < CACHE_24H) {
          return respond({ ...row.data, _source: 'cache' })
        }
      }

      const data = await chPost('/v1/cards/comps', { card_id, grade, count, time_weighted, include_raw_prices }, key)
      await db().from('ch_comps_cache').upsert(
        { card_id, grade, data, fetched_at: new Date().toISOString() },
        { onConflict: 'card_id,grade' },
      )
      return respond({ ...data, _source: 'live' })
    }

    // ── FMV for a single card+grade (24h cache) ───────────────────────────────
    if (mode === 'fmv') {
      const { card_id, grade, force = false } = body
      if (!card_id) return respond({ error: 'card_id required' }, 400)
      if (!grade)   return respond({ error: 'grade required' }, 400)

      if (!force) {
        const { data: row } = await db().from('ch_fmv_cache')
          .select('data, fetched_at').eq('card_id', card_id).eq('grade', grade).maybeSingle()
        if (row && Date.now() - new Date(row.fetched_at).getTime() < CACHE_24H) {
          return respond({ ...row.data, _source: 'cache' })
        }
      }

      const data = await chPost('/v1/cards/card-fmv', { card_id, grade }, key)
      await db().from('ch_fmv_cache').upsert(
        { card_id, grade, data, fetched_at: new Date().toISOString() },
        { onConflict: 'card_id,grade' },
      )
      return respond({ ...data, _source: 'live' })
    }

    // ── Batch FMV (up to 100 card+grade pairs) ────────────────────────────────
    if (mode === 'fmv_batch') {
      const { items } = body
      if (!Array.isArray(items) || items.length === 0) return respond({ error: 'items array required' }, 400)
      if (items.length > 100) return respond({ error: 'Maximum 100 items per request' }, 400)
      const data = await chPost('/v1/cards/card-fmv-batch', { items }, key)
      return respond(data)
    }

    // ── FMV by cert number ────────────────────────────────────────────────────
    if (mode === 'fmv_by_cert') {
      const { cert, grader = 'PSA' } = body
      if (!cert) return respond({ error: 'cert required' }, 400)
      const data = await chPost('/v1/cards/fmv-by-cert', { cert: String(cert).trim(), grader }, key)
      return respond(data)
    }

    // ── Top movers (1h cache per category) ────────────────────────────────────
    if (mode === 'top_movers') {
      const { category = '', count = 20, force = false } = body
      const cacheCategory = category ?? ''

      if (!force) {
        const { data: row } = await db().from('ch_top_movers_cache')
          .select('data, fetched_at').eq('category', cacheCategory).maybeSingle()
        if (row && Date.now() - new Date(row.fetched_at).getTime() < CACHE_1H) {
          return respond({ ...row.data, _source: 'cache' })
        }
      }

      const params = new URLSearchParams({ count: String(count) })
      if (category) params.set('category', category)
      const data = await chGet(`/v1/cards/top-movers?${params}`, key)
      await db().from('ch_top_movers_cache').upsert(
        { category: cacheCategory, data, fetched_at: new Date().toISOString() },
        { onConflict: 'category' },
      )
      return respond({ ...data, _source: 'live' })
    }

    // ── Total sales by player ─────────────────────────────────────────────────
    if (mode === 'player_sales') {
      const { players, days = 30 } = body
      if (!Array.isArray(players) || players.length === 0) return respond({ error: 'players array required' }, 400)
      if (players.length > 25) return respond({ error: 'Maximum 25 players per request' }, 400)
      const data = await chPost('/v1/cards/total-sales-by-player', { players, days }, key)
      return respond(data)
    }

    return respond({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('cardhedge error:', err)
    return respond({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
