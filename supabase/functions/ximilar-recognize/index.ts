import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ENDPOINTS = {
  sport: 'https://api.ximilar.com/collectibles/v2/sport_id',
  tcg:   'https://api.ximilar.com/collectibles/v2/tcg_id',
  ocr:   'https://api.ximilar.com/collectibles/v2/card_ocr_id',
}

const CATEGORY_HINTS: Record<string, Record<string, string>> = {
  sport: {
    'Top Category': 'Card',
    'Category': 'Card/Sport',
    'Side': 'front',
  },
  tcg: {
    'Top Category': 'Card',
    'Category': 'Card/Trading Card Game',
    'Side': 'front',
    'Alphabet': 'latin',
  },
  ocr: {
    'Top Category': 'Card',
    'Side': 'front',
  },
}

function hasIdentification(data: any): boolean {
  return data?.records?.some((r: any) => {
    const id = r?._identification
    if (!id) return false
    const bm = id.best_match ?? id
    return Object.values(bm).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    )
  }) ?? false
}
/**
 * Strip the data URL prefix if present so Ximilar receives raw base64.
 * e.g. "data:image/jpeg;base64,/9j/..." → "/9j/..."
 */
function cleanBase64(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith('data:')) {
    return value.slice(value.indexOf(',') + 1)
  }
  return value
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (payload: object) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { images, cardType = 'auto' } = await req.json()

    const XIMILAR_API_KEY = Deno.env.get('XIMILAR_API_KEY')
    if (!XIMILAR_API_KEY) return respond({ error: 'XIMILAR_API_KEY not configured' })

    const headers = {
      Authorization: `Token ${XIMILAR_API_KEY}`,
      'Content-Type': 'application/json',
    }

    const buildRecords = (type: string) => {
      const hints = CATEGORY_HINTS[type] ?? CATEGORY_HINTS.sport
      return images.map((img: { id: string; base64?: string; url?: string }) => ({
        _id: img.id,
        ...(img.base64 ? { _base64: img.base64 } : { _url: img.url }),
        ...hints,
      }))
    }

    const callEndpoint = async (type: string) => {
      const endpoint = ENDPOINTS[type as keyof typeof ENDPOINTS]
      const records = buildRecords(type)
      console.log(`Calling ${endpoint} with ${records.length} records, hints: ${JSON.stringify(CATEGORY_HINTS[type])}`)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records,
          rotate: true,       // auto-correct card rotation
          price_stats: true,  // include price data if available
        }),
      })

      const text = await res.text()
      if (!res.ok) {
        console.error(`${endpoint} error ${res.status}: ${text}`)
        return null
      }
      return JSON.parse(text)
    }

    // Determine endpoints to try in order
    const sequence: string[] =
      cardType === 'tcg'   ? ['tcg', 'ocr'] :
      cardType === 'sport' ? ['sport', 'ocr'] :
      ['sport', 'tcg', 'ocr'] // auto

    let lastResult: any = null

    for (const type of sequence) {
      const data = await callEndpoint(type)
      if (!data) continue

      if (hasIdentification(data)) {
        console.log(`Successfully identified via ${type}`)
        return respond({ ...data, _source: type })
      }

      lastResult = data
      console.log(`${type} returned no identification, trying next`)
    }

    // Return last result even if unidentified — UI handles it gracefully
    return respond({ ...(lastResult ?? { records: [] }), _source: 'unidentified' })

  } catch (err) {
    console.error('ximilar-recognize error:', err)
    return respond({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})