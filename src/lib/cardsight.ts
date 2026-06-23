import { supabase } from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardSightCard {
  id?: string
  name?: string
  playerName?: string
  player?: string
  year?: string | number
  setName?: string
  set?: string
  cardNumber?: string
  number?: string
  sport?: string
  segment?: string
  category?: string
  manufacturer?: string
  brand?: string
  company?: string
  parallel?: string
  variation?: string
  shortPrint?: boolean
  rookie?: boolean
  // Pricing fields (may be present)
  marketValue?: number
  avgPrice?: number
  lastSalePrice?: number
  [key: string]: any
}

export interface CardSightDetection {
  confidence: 'High' | 'Medium' | 'Low' | string
  card: CardSightCard
}

export interface CardSightResponse {
  success: boolean
  requestId?: string
  detections?: CardSightDetection[]
  processingTime?: number
}

export interface CardMatch {
  player: string
  name: string
  year: string
  set_name: string
  card_number: string
  sport: string
  parallel: string
  variation: string
  company: string
  full_name: string
}

export interface RecognizedCard {
  id: string
  match: CardMatch | null
  confidence: number
  rawResponse?: CardSightResponse
}

export interface ScannedImage {
  id: string
  frontBase64: string
  frontPreview?: string
  backBase64?: string
  backPreview?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceToNumber(confidence: string | undefined): number {
  if (!confidence) return 0
  switch (confidence.toLowerCase()) {
    case 'high':   return 0.95
    case 'medium': return 0.70
    case 'low':    return 0.45
    default:       return 0.60
  }
}

function parseCardMatch(card: CardSightCard): CardMatch {
  const player =
    card.playerName ?? card.player ?? card.name ?? ''

  const name =
    card.name ?? card.playerName ?? card.player ?? ''

  const year = String(card.year ?? '')

  const set_name =
    card.setName ?? card.set ?? ''

  const card_number =
    card.cardNumber ?? card.number ?? ''

  const sport =
    card.sport ?? card.segment ?? card.category ?? ''

  const parallel =
    card.parallel ?? ''

  const variation =
    card.variation ?? ''

  const company =
    card.manufacturer ?? card.brand ?? card.company ?? ''

  const full_name =
    [player, year, set_name, card_number].filter(Boolean).join(' · ')

  return {
    player,
    name,
    year,
    set_name,
    card_number,
    sport,
    parallel,
    variation,
    company,
    full_name,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Identifies one or more scanned card images using CardSight AI.
 * Drops in as a replacement for the Ximilar recognizeCards() call.
 */
export async function recognizeCards(
  images: ScannedImage[]
): Promise<RecognizedCard[]> {
  if (!images.length) return []

  const { data: fnData, error } = await supabase.functions.invoke(
    'cardsight-identify',
    {
      body: {
        images: images.map((img) => ({
          id: img.id,
          frontBase64: img.frontBase64,
          backBase64: img.backBase64,
        })),
      },
    }
  )

  if (error) {
    console.error('CardSight edge function error:', error)
    throw error
  }

  const results: { id: string; data: CardSightResponse | null }[] =
    fnData?.results ?? []

  return results.map(({ id, data }) => {
    if (!data?.success || !data.detections?.length) {
      return { id, match: null, confidence: 0, rawResponse: data ?? undefined }
    }

    // Pick the first (best) detection
    const detection = data.detections[0]
    const match = parseCardMatch(detection.card)
    const confidence = confidenceToNumber(detection.confidence)

    return { id, match, confidence, rawResponse: data }
  })
}

/**
 * Get pricing for a specific card by its CardSight card ID.
 * Returns null if no pricing data is available.
 */
export async function getCardPricing(cardId: string): Promise<{
  marketValue: number | null
  avgPrice: number | null
  lastSalePrice: number | null
} | null> {
  try {
    const apiKey = import.meta.env.VITE_CARDSIGHT_API_KEY
    if (!apiKey) {
      console.warn('VITE_CARDSIGHT_API_KEY not set — cannot fetch pricing')
      return null
    }

    const response = await fetch(
      `https://api.cardsight.ai/v1/pricing/card/${cardId}`,
      { headers: { 'X-API-Key': apiKey } }
    )

    if (!response.ok) return null
    const data = await response.json()

    return {
      marketValue: data.marketValue ?? data.avgMarketValue ?? null,
      avgPrice: data.avgPrice ?? data.averagePrice ?? null,
      lastSalePrice: data.lastSalePrice ?? data.recentSalePrice ?? null,
    }
  } catch {
    return null
  }
}