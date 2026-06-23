// Shared CardSight pricing client — used by cardsight-identify (single market
// value at scan time) and cardsight-market (full price history / sales / graded
// breakdown on the card detail page).
//
// API contract confirmed against https://cardsight.ai/documentation/api-reference:
//   GET /v1/pricing/{card_id}?period=&parallel_id=&grade_id=&listing_type=&limit=
// Returns completed sales records grouped into `raw` (ungraded) and `graded`
// (by grading company + grade value) — not a precomputed low/median/high.

const CARDSIGHT_BASE = 'https://api.cardsight.ai'

export interface CardSightSaleRecord {
  title?: string
  price: number
  date: string
  source?: string
  listing_type?: string
  url?: string
  image_url?: string
  parallel_id?: string
  parallel_name?: string
}

export interface CardSightGradeBucket {
  grade_value: string
  grade_id: string
  period_days: number
  count: number
  records: CardSightSaleRecord[]
}

export interface CardSightGradedCompany {
  company_name: string
  company_id: string
  grades: CardSightGradeBucket[]
}

export interface CardSightPricingResponse {
  card?: { card_id: string; name?: string; number?: string; set?: any; parallel?: any }
  query?: Record<string, unknown>
  raw?: { period_days: number; count: number; records: CardSightSaleRecord[] }
  graded?: CardSightGradedCompany[]
  meta?: { sources?: { source: string; count: number }[]; last_sale_date?: string; total_records?: number }
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface CardSightPricingResult {
  data: CardSightPricingResponse | null
  status: number | null
  errorText?: string
}

export async function fetchCardSightPricing(
  cardId: string,
  apiKey: string,
  opts: { period?: string; listingType?: string; limit?: number } = {}
): Promise<CardSightPricingResult> {
  const url = new URL(`${CARDSIGHT_BASE}/v1/pricing/${cardId}`)
  if (opts.period) url.searchParams.set('period', opts.period)
  if (opts.listingType) url.searchParams.set('listing_type', opts.listingType)
  if (opts.limit) url.searchParams.set('limit', String(opts.limit))

  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`CardSight pricing failed for ${cardId} — HTTP ${res.status}:`, errorText)
      return { data: null, status: res.status, errorText }
    }

    return { data: await res.json(), status: res.status }
  } catch (err) {
    console.error(`CardSight pricing error for ${cardId}:`, err)
    return { data: null, status: null, errorText: err instanceof Error ? err.message : String(err) }
  }
}

// Median/low/high across raw (ungraded) completed sales — used as the card's
// headline "current market value".
export function summarizeRawPricing(data: CardSightPricingResponse | null): {
  median: number | null
  low: number | null
  high: number | null
} {
  const prices = (data?.raw?.records ?? [])
    .map((r) => r.price)
    .filter((p): p is number => typeof p === 'number')
  if (!prices.length) return { median: null, low: null, high: null }
  return { median: median(prices), low: Math.min(...prices), high: Math.max(...prices) }
}

// { PSA: { "9": 145.50, "10": 420 }, BGS: { ... } } — median price per
// company/grade, matching the shape GradingROICalculator expects.
export function summarizeGradedPricing(data: CardSightPricingResponse | null): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const company of data?.graded ?? []) {
    if (!company.company_name) continue
    for (const grade of company.grades ?? []) {
      const prices = (grade.records ?? [])
        .map((r) => r.price)
        .filter((p): p is number => typeof p === 'number')
      const med = median(prices)
      if (med == null) continue
      out[company.company_name] = out[company.company_name] ?? {}
      out[company.company_name][grade.grade_value] = med
    }
  }
  return out
}

// ── Live marketplace listings (active, not-yet-sold) ──────────────────────
// GET /v1/marketplace/{card_id} — same raw/graded grouping as pricing, but
// records are active listings: `condition`, `end_date`, `bid_count` instead
// of a completed `date`. Useful when completed-sales history (pricing) is
// thin, which is common for CardSight right now.

export interface CardSightListingRecord {
  title?: string
  price: number
  source?: string
  listing_type?: string
  url?: string
  image_url?: string
  condition?: string
  end_date?: string
  bid_count?: number
  parallel_id?: string
  parallel_name?: string
}

export interface CardSightListingGradeBucket {
  grade_value: string
  grade_id: string
  count: number
  records: CardSightListingRecord[]
}

export interface CardSightListingGradedCompany {
  company_name: string
  company_id: string
  grades: CardSightListingGradeBucket[]
}

export interface CardSightMarketplaceResponse {
  card?: { card_id: string; name?: string; number?: string; set?: any; parallel?: any }
  query?: Record<string, unknown>
  raw?: { count: number; records: CardSightListingRecord[] }
  graded?: CardSightListingGradedCompany[]
  meta?: { sources?: { source: string; count: number }[]; total_records?: number }
}

export interface CardSightMarketplaceResult {
  data: CardSightMarketplaceResponse | null
  status: number | null
  errorText?: string
}

export async function fetchCardSightMarketplace(
  cardId: string,
  apiKey: string,
  opts: { listingType?: string; limit?: number } = {}
): Promise<CardSightMarketplaceResult> {
  const url = new URL(`${CARDSIGHT_BASE}/v1/marketplace/${cardId}`)
  if (opts.listingType) url.searchParams.set('listing_type', opts.listingType)
  if (opts.limit) url.searchParams.set('limit', String(opts.limit))

  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`CardSight marketplace failed for ${cardId} — HTTP ${res.status}:`, errorText)
      return { data: null, status: res.status, errorText }
    }

    return { data: await res.json(), status: res.status }
  } catch (err) {
    console.error(`CardSight marketplace error for ${cardId}:`, err)
    return { data: null, status: null, errorText: err instanceof Error ? err.message : String(err) }
  }
}

// Median/low/high across active raw (ungraded) listing prices — used as a
// fallback "current market value" when there's no completed-sales history.
export function summarizeRawListings(data: CardSightMarketplaceResponse | null): {
  median: number | null
  low: number | null
  high: number | null
} {
  const prices = (data?.raw?.records ?? [])
    .map((r) => r.price)
    .filter((p): p is number => typeof p === 'number')
  if (!prices.length) return { median: null, low: null, high: null }
  return { median: median(prices), low: Math.min(...prices), high: Math.max(...prices) }
}
