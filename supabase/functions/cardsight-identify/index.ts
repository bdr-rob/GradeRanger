import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { fetchCardSightPricing, summarizeRawPricing } from '../_shared/cardsightPricing.ts'

const CARDSIGHT_BASE = 'https://api.cardsight.ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function base64ToUint8Array(base64: string): Uint8Array {
  const stripped = base64.replace(/^data:image\/[a-z+]+;base64,/, '')
  const binary = atob(stripped)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function identifyFromBase64(base64: string, apiKey: string): Promise<any> {
  const bytes = base64ToUint8Array(base64)
  const blob  = new Blob([bytes], { type: 'image/jpeg' })
  const form  = new FormData()
  form.append('image', blob, 'card.jpg')

  const res = await fetch(`${CARDSIGHT_BASE}/v1/identify/card`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`CardSight identify failed — HTTP ${res.status}:`, errText)
    return null
  }

  const json = await res.json()
  console.log('CardSight identify response:', JSON.stringify(json))
  return json
}

// GET /v1/pricing/{card_id} expects CardSight's own card UUID — that's
// cardObj.id, not the releaseId/segmentId groupings.
async function fetchMarketValue(cardId: string, apiKey: string): Promise<number | null> {
  const { data, status, errorText } = await fetchCardSightPricing(cardId, apiKey, { period: '1y' })
  if (!data) {
    console.error(`Pricing lookup failed for ${cardId} — status ${status}: ${errorText ?? ''}`)
    return null
  }
  return summarizeRawPricing(data).median
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('CARDSIGHT_API_KEY')
    if (!apiKey) return new Response(
      JSON.stringify({ error: 'CARDSIGHT_API_KEY not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    const body = await req.json()
    const images: { id: string; base64: string; backBase64?: string }[] = body.images ?? []
    if (!images.length) return new Response(
      JSON.stringify({ error: 'No images provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    console.log(`Processing ${images.length} image(s)`)

    const results = await Promise.all(
      images.map(async ({ id, base64, backBase64 }) => {
        console.log(`--- Processing image ${id} ---`)

        // Try front image first
        let data = await identifyFromBase64(base64, apiKey)
        const frontDetections = data?.detections?.length ?? 0
        console.log(`Front detections: ${frontDetections}`)

        // Only fall back to back image if front returned zero detections
        // NOTE: CardSight does NOT return a "success" field — check detections only
        if (backBase64 && frontDetections === 0) {
          console.log(`No detections on front for ${id} — trying back image...`)
          const backData = await identifyFromBase64(backBase64, apiKey)
          const backDetections = backData?.detections?.length ?? 0
          console.log(`Back detections: ${backDetections}`)
          if (backDetections > 0) data = backData
        }

        const detectionCount = data?.detections?.length ?? 0
        console.log(`Final detections for ${id}: ${detectionCount}`)

        const cardObj = data?.detections?.[0]?.card ?? null
        if (cardObj) console.log('Card object:', JSON.stringify(cardObj))

        // /v1/pricing/{card_id} expects CardSight's card UUID (cardObj.id) —
        // fall back to releaseId/segmentId only if a card somehow lacks one.
        const cardsightCardId: string | null =
          cardObj?.id ?? cardObj?.releaseId ?? cardObj?.segmentId ?? null

        console.log(`CardSight pricing ID: ${cardsightCardId ?? 'NONE'}`)

        const marketValue: number | null = cardsightCardId
          ? await fetchMarketValue(cardsightCardId, apiKey)
          : null

        console.log(`Market value resolved: ${marketValue ?? 'null'}`)

        return { id, data, cardsightCardId, marketValue }
      })
    )

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('cardsight-identify unhandled error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})