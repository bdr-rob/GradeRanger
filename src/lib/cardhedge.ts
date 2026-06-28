import { supabase } from './supabase'
import { ScannedImage, SlabResult, RecognizedCard, XimilarMatch } from './ximilar'
import { v4 as uuidv4 } from 'uuid'

export interface CardHedgePrice {
  date:  string
  grade: string
  price: number
}

export interface CardHedgeSlabResult extends SlabResult {
  cardHedgeId:  string
  cardImage:    string
  variant:      string
  category:     string
  description:  string
  recentSales:  CardHedgePrice[]
}

function invokeCardHedge(body: object) {
  return supabase.functions.invoke('cardhedge', { body })
}

function buildSlabResult(data: any, image: ScannedImage): CardHedgeSlabResult {
  return {
    localId:          image.id,
    image,
    gradeCompany:     data.gradeCompany     ?? '',
    gradeValue:       data.gradeValue       ?? '',
    certNumber:       data.certNumber       ?? '',
    player:           data.player           ?? '',
    year:             data.year             ?? '',
    setName:          data.setName          ?? '',
    cardNumber:       data.cardNumber       ?? '',
    confidence:       data.confidence       ?? 0,
    purchasePrice:    '',
    purchaseLocation: '',
    // Card Hedger extras
    cardHedgeId:      data.cardHedgeId      ?? '',
    cardImage:        data.cardImage        ?? '',
    variant:          data.variant          ?? '',
    category:         data.category         ?? '',
    description:      data.description      ?? '',
    marketValue:      data.marketValue      ?? null,
    recentSales:      data.recentSales      ?? [],
  }
}

/** Scan a slab photo → AI OCR reads cert → returns card details + price history */
export async function recognizeSlabFromImage(
  image: ScannedImage,
  days = 180,
): Promise<CardHedgeSlabResult> {
  const { data, error } = await invokeCardHedge({
    mode:         'image',
    image_base64: `data:image/jpeg;base64,${image.base64}`,
    days,
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return buildSlabResult(data, image)
}

/** Look up a cert number → returns card details + price history */
export async function recognizeSlabFromCert(
  cert: string,
  grader: string,
  days = 180,
): Promise<CardHedgeSlabResult> {
  const { data, error } = await invokeCardHedge({ mode: 'cert', cert, grader, days })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  // Cert path has no real image — create a placeholder
  const placeholder: ScannedImage = { id: uuidv4(), base64: '', preview: '' }
  return buildSlabResult(data, placeholder)
}

/** Identify a raw (ungraded) card from its image using Card Hedger image-match */
export async function recognizeRawCardFromImage(image: ScannedImage): Promise<RecognizedCard> {
  const { data, error } = await invokeCardHedge({
    mode:         'image-match',
    image_base64: `data:image/jpeg;base64,${image.base64}`,
  })

  if (error) throw new Error(error.message)

  const emptyMatch = (): XimilarMatch => ({
    player: '', name: '', year: '', set_name: '', card_number: '',
    sport: '', parallel: '', variation: '', company: '', full_name: '',
    rarity: '', language: '', release_date: '', series: '',
    set_abbreviation: '', artist: '', hp: '', pokedex_number: '',
    evolves_from: '', flavor_text: '', description: '', attributes: [], release_name: '',
  })

  if (!data?.matched) {
    return {
      localId: image.id, image,
      bestMatch: null, confidence: 0, allMatches: [],
      purchasePrice: '', purchaseLocation: '', confirmed: false,
      cardsightCardId: null, cardHedgeId: null, marketValue: null,
    }
  }

  const match: XimilarMatch = {
    ...emptyMatch(),
    player:      data.player      ?? '',
    name:        data.player      ?? '',
    year:        data.year        ?? '',
    set_name:    data.setName     ?? '',
    card_number: data.cardNumber  ?? '',
    parallel:    data.variant     ?? '',
    sport:       data.category    ?? '',
    description: data.description ?? '',
  }

  return {
    localId: image.id, image,
    bestMatch:       match,
    confidence:      data.confidence ?? 0.9,
    allMatches:      [match],
    purchasePrice:   '', purchaseLocation: '', confirmed: false,
    cardsightCardId: null,
    cardHedgeId:     data.cardHedgeId ?? null,
    marketValue:     null,
  }
}

// ── Market value helpers ──────────────────────────────────────────────────────

const GRADER_PATTERN = /\b(PSA|BGS|CGC|SGC|CSG|HGA|GAI|BCCG)\b/i
const RAW_PATTERN    = /\b(raw|ungraded|unslabbed)\b/i

/** True if a grade string looks like a graded slab (PSA 10, BGS 9.5, etc.) */
function isGradedSale(grade: string): boolean {
  return GRADER_PATTERN.test(grade) && !RAW_PATTERN.test(grade)
}

/** Median of a sorted numeric array */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Compute a robust market value from a price history array.
 *
 * Strategy:
 *  1. Prefer sales from the last 90 days; fall back to all-time if <3 results.
 *  2. Filter by grade type: raw cards exclude graded-slab sales; graded cards
 *     optionally filter to a matching grade label.
 *  3. Trimmed median (drop top+bottom 10%) to eliminate outliers.
 */
export function computeMarketValue(
  prices: CardHedgePrice[],
  opts: { isGraded?: boolean; gradeLabel?: string } = {},
): number | null {
  if (prices.length === 0) return null

  const { isGraded = false, gradeLabel } = opts

  // Step 1: grade filtering
  let filtered: CardHedgePrice[]
  if (isGraded && gradeLabel) {
    // Try to match same grade tier (e.g. "PSA 10")
    const same = prices.filter((p) => p.grade.toLowerCase().includes(gradeLabel.toLowerCase()))
    filtered = same.length >= 2 ? same : prices
  } else if (!isGraded) {
    // Raw cards: exclude graded-slab sales
    const rawOnly = prices.filter((p) => !isGradedSale(p.grade))
    filtered = rawOnly.length >= 2 ? rawOnly : prices
  } else {
    filtered = prices
  }

  // Step 2: 90-day window preference
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const recent = filtered.filter((p) => !p.date || new Date(p.date) >= cutoff)
  const pool   = recent.length >= 3 ? recent : filtered

  if (pool.length === 0) return null

  // Step 3: trimmed median
  const vals   = pool.map((p) => p.price).sort((a, b) => a - b)
  const trim   = Math.max(0, Math.floor(vals.length * 0.1))
  const trimmed = trim > 0 ? vals.slice(trim, vals.length - trim) : vals
  return median(trimmed.length > 0 ? trimmed : vals)
}

/** Get market pricing for an already-identified card */
export async function getCardHedgeMarketPrice(params: {
  cardHedgeId?: string
  query?: string
  category?: string
  isGraded?: boolean
  gradeLabel?: string
}): Promise<{ prices: CardHedgePrice[]; marketValue: number | null }> {
  const { isGraded, gradeLabel, ...invokeParams } = params
  const { data, error } = await invokeCardHedge({ mode: 'market', ...invokeParams })
  if (error || data?.error) return { prices: [], marketValue: null }
  const prices: CardHedgePrice[] = (data?.prices ?? []).map((p: any) => ({
    date:  p.date  ?? '',
    grade: p.grade ?? '',
    price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
  })).filter((p: CardHedgePrice) => p.price > 0)
  const marketValue = computeMarketValue(prices, { isGraded, gradeLabel })
  return { prices, marketValue }
}
