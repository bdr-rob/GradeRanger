import { supabase } from './supabase'

export type CardType = 'sport' | 'tcg' | 'slab' | 'ocr'
export type SlabMode = 'slab_id' | 'slab_grade'

export interface SlabResult {
  localId:          string
  image:            ScannedImage
  gradeCompany:     string
  gradeValue:       string
  certNumber:       string
  player:           string
  year:             string
  setName:          string
  cardNumber:       string
  confidence:       number
  purchasePrice:    string
  purchaseLocation: string
}

export interface ScannedImage {
  id: string
  base64: string
  preview: string
  backBase64?: string
  backPreview?: string
}

export interface XimilarMatch {
  // Core identity
  player:      string
  name:        string
  year:        string
  set_name:    string
  card_number: string
  sport:       string
  parallel:    string
  variation:   string
  company:     string
  full_name:   string
  // CardSight rich fields
  rarity:           string
  language:         string
  release_date:     string
  series:           string
  set_abbreviation: string
  artist:           string
  hp:               string
  pokedex_number:   string
  evolves_from:     string
  flavor_text:      string
  description:      string
  attributes:       string[]
  release_name:     string
}

export interface RecognizedCard {
  localId:          string
  image:            ScannedImage
  bestMatch:        XimilarMatch | null
  confidence:       number
  allMatches:       XimilarMatch[]
  purchasePrice:    string
  purchaseLocation: string
  confirmed:        boolean
  cardsightCardId:  string | null
  cardHedgeId:      string | null
  marketValue:      number | null
}

function emptyMatch(): XimilarMatch {
  return {
    player: '', name: '', year: '', set_name: '', card_number: '',
    sport: '', parallel: '', variation: '', company: '', full_name: '',
    rarity: '', language: '', release_date: '', series: '',
    set_abbreviation: '', artist: '', hp: '', pokedex_number: '',
    evolves_from: '', flavor_text: '', description: '',
    attributes: [], release_name: '',
  }
}

function parseCardSightDetection(detection: any): { match: XimilarMatch | null; confidence: number } {
  const card = detection?.card
  if (!card) return { match: null, confidence: 0 }

  // Convert fields[] array into a fast key→value lookup
  const f: Record<string, string> = {}
  for (const field of (card.fields ?? [])) {
    if (field.key) f[field.key] = field.value ?? ''
  }

  const match: XimilarMatch = {
    // Core identity
    player:           card.playerName   ?? card.player    ?? card.name ?? '',
    name:             card.name         ?? card.playerName ?? '',
    year:             String(card.year  ?? ''),
    set_name:         card.setName      ?? card.set       ?? '',
    card_number:      card.cardNumber   ?? card.number    ?? '',
    // No segment/sport name on the card object itself (only segmentId, a UUID) — leave for manual entry
    sport:            f['SPORT'] ?? f['SEGMENT'] ?? '',
    // card.parallel is an object ({id, name, ...}), not a string — extract the name
    parallel:         card.parallel?.name ?? '',
    // No variation description on the card object (variationOf is just a parent-card UUID)
    variation:        f['VARIATION'] ?? '',
    company:          card.manufacturer ?? card.brand     ?? card.company ?? '',
    full_name:        card.name         ?? card.playerName ?? '',
    // Rich fields from card.fields[]
    rarity:           f['RARITY']          ?? '',
    language:         f['LANGUAGE']        ?? '',
    release_date:     f['RELEASE_DATE']    ?? '',
    series:           f['SERIES']          ?? '',
    set_abbreviation: f['SET_ABBREVIATION'] ?? '',
    artist:           f['ARTIST']          ?? '',
    hp:               f['HP']              ?? '',
    pokedex_number:   f['POKEDEX_NUMBER']  ?? '',
    evolves_from:     f['EVOLVES_FROM']    ?? '',
    flavor_text:      f['FLAVOR_TEXT']     ?? '',
    // Direct card object fields
    description:      card.description  ?? '',
    attributes:       Array.isArray(card.attributes) ? card.attributes : [],
    release_name:     card.releaseName  ?? '',
  }

  const level = (detection.confidence ?? '').toLowerCase()
  const confidence = level === 'high' ? 0.95 : level === 'medium' ? 0.70 : 0.45
  return { match, confidence }
}

export async function recognizeSlab(
  image: ScannedImage,
  mode: SlabMode = 'slab_id',
): Promise<SlabResult> {
  const { data, error } = await supabase.functions.invoke('ximilar-recognize', {
    body: {
      mode,
      images: [{ id: image.id, base64: image.base64 }],
    },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  const info = data?.slabInfo ?? {}
  return {
    localId:          image.id,
    image,
    gradeCompany:     info.gradeCompany  ?? '',
    gradeValue:       info.gradeValue    ?? '',
    certNumber:       info.certNumber    ?? '',
    player:           info.player        ?? '',
    year:             info.year          ?? '',
    setName:          info.setName       ?? '',
    cardNumber:       info.cardNumber    ?? '',
    confidence:       info.confidence    ?? 0,
    purchasePrice:    '',
    purchaseLocation: '',
  }
}

export async function recognizeCards(
  images: ScannedImage[],
  _cardType: CardType = 'auto'
): Promise<RecognizedCard[]> {
  const { data, error } = await supabase.functions.invoke('cardsight-identify', {
    body: {
      images: images.map((img) => ({
        id:         img.id,
        base64:     img.base64,
        backBase64: img.backBase64,
      })),
    },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  const results: { id: string; data: any; cardsightCardId: string | null; marketValue: number | null }[] =
    data?.results ?? []
  const resultMap = new Map(results.map((r) => [r.id, r]))

  return images.map((img) => {
    const result    = resultMap.get(img.id)
    const detection = result?.data?.detections?.[0]
    const { match, confidence } = detection
      ? parseCardSightDetection(detection)
      : { match: null, confidence: 0 }

    return {
      localId:          img.id,
      image:            img,
      bestMatch:        match,
      confidence,
      allMatches:       match ? [match] : [],
      purchasePrice:    '',
      purchaseLocation: '',
      confirmed:        false,
      cardsightCardId:  result?.cardsightCardId ?? null,
      cardHedgeId:      null,
      marketValue:      result?.marketValue ?? null,
    }
  })
}