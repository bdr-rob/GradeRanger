import { supabase } from './supabase'

export type CardType = 'sport' | 'tcg' | 'slab' | 'ocr'

export interface ScannedImage {
  id: string
  base64: string
  preview: string
  backBase64?: string
  backPreview?: string
}

export interface XimilarMatch {
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
  localId: string
  image: ScannedImage
  bestMatch: XimilarMatch | null
  confidence: number
  allMatches: XimilarMatch[]
  purchasePrice: string
  purchaseLocation: string
  confirmed: boolean
}

function parseIdentification(record: any): { match: XimilarMatch | null; confidence: number } {
  // Ximilar TCG/Sport returns _identification.best_match
  const id = record?._identification?.best_match ?? record?._identification ?? record?.identification
  if (!id) return { match: null, confidence: 0 }

  const match: XimilarMatch = {
    player:      id.name        ?? id.player        ?? id.Name        ?? '',
    name:        id.full_name   ?? id.name           ?? id.Name        ?? '',
    year:        id.year        ?? id.Year           ?? id.season      ?? '',
    set_name:    id.set_name    ?? id.Set            ?? id.set         ?? '',
    card_number: id.card_number ?? id.Number         ?? id.number      ?? '',
    sport:       id.subcategory ?? id.Subcategory    ?? id.game        ?? id.sport ?? '',
    parallel:    id.sub_set     ?? id.parallel       ?? id.Parallel    ?? '',
    variation:   id.variation   ?? id.Variation      ?? '',
    company:     id.company     ?? id.manufacturer   ?? id.Publisher   ?? '',
    full_name:   id.full_name   ?? id.Name           ?? '',
  }

  const confidence = record.magic_ai_used ? 0.75 : 0.95
  return { match, confidence }
}

export async function recognizeCards(
  images: ScannedImage[],
  cardType: CardType = 'sport'
): Promise<RecognizedCard[]> {
  const { data, error } = await supabase.functions.invoke('ximilar-recognize', {
    body: {
      images: images.map((img) => ({ id: img.id, base64: img.base64 })),
      cardType,
    },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  // AFTER
const records: any[] = data.records ?? []
const recordMap = new Map<string, any>()
for (const rec of records) {
  if (rec._id) recordMap.set(rec._id, rec)
}

return images.map((img, i) => {
  // ID-based lookup first, fall back to positional order if _id is missing
  const rec = recordMap.get(img.id) ?? records[i]
  const { match, confidence } = parseIdentification(rec)
  return {
    localId: img.id,
    image: img,
    bestMatch: match,
    confidence,
    allMatches: match ? [match] : [],
    purchasePrice: '',
    purchaseLocation: '',
    confirmed: false,
  }
})
}
