import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ENDPOINTS = {
  sport:      'https://api.ximilar.com/collectibles/v2/sport_id',
  tcg:        'https://api.ximilar.com/collectibles/v2/tcg_id',
  ocr:        'https://api.ximilar.com/collectibles/v2/card_ocr_id',
  slab_id:    'https://api.ximilar.com/collectibles/v2/slab_id',
  slab_grade: 'https://api.ximilar.com/collectibles/v2/slab_grade',
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
  // Slab endpoints don't require category hints — they accept slab photos directly
  slab_id:    {},
  slab_grade: {},
}

function hasIdentification(data: any): boolean {
  return data?.records?.some((r: any) => {
    const id = r?._objects?.[0]?._identification
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

/**
 * Parse slab_id / slab_grade response into a structured object.
 * Ximilar returns slab fields inside _objects[0]._identification.best_match
 * alongside card identity fields.
 */
function parseSlabResponse(data: any): {
  gradeCompany: string
  gradeValue: string
  certNumber: string
  player: string
  year: string
  setName: string
  cardNumber: string
  confidence: number
} {
  const record = data?.records?.[0]
  const obj = record?._objects?.[0]
  const id = obj?._identification
  const bm = id?.best_match ?? id ?? {}

  // Confidence: use _identification.confidence if present, else derive from score
  const rawConf = obj?.prob ?? obj?.score ?? 0
  const confidence = typeof rawConf === 'number' ? rawConf : 0

  return {
    gradeCompany: bm.company   ?? bm.grading_company ?? '',
    gradeValue:   bm.grade     ?? bm.official_grade  ?? '',
    certNumber:   bm.cert_number ?? bm.cert_no ?? bm.certification_number ?? '',
    player:       bm.player    ?? bm.player_name ?? bm.name ?? '',
    year:         String(bm.year ?? ''),
    setName:      bm.set_name  ?? bm.set ?? '',
    cardNumber:   bm.card_number ?? bm.number ?? '',
    confidence,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (payload: object) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { images, cardType = 'auto', mode } = await req.json()

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
        ...(img.base64 ? { _base64: cleanBase64(img.base64) } : { _url: img.url }),
        ...hints,
      }))
    }

    const callEndpoint = async (type: string, inputRecords?: any[]) => {
      const endpoint = ENDPOINTS[type as keyof typeof ENDPOINTS]
      const records = inputRecords ?? buildRecords(type)
      console.log(`Calling ${endpoint} with ${records.length} records`)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records,
          rotate: true,
          price_stats: true,
        }),
      })

      const text = await res.text()
      if (!res.ok) {
        console.error(`${endpoint} error ${res.status}: ${text}`)
        return null
      }
      return JSON.parse(text)
    }

    // ── Slab modes ─────────────────────────────────────────────────────────────
    if (mode === 'slab_id' || mode === 'slab_grade') {
      const data = await callEndpoint(mode)
      if (!data) return respond({ error: `Ximilar ${mode} call failed` })

      const slabInfo = parseSlabResponse(data)
      console.log(`${mode} parsed:`, JSON.stringify(slabInfo))
      return respond({ ...data, _source: mode, slabInfo })
    }

    // ── Raw card modes (existing logic) ────────────────────────────────────────
    const buildRawRecords = (type: string) => {
      const hints = CATEGORY_HINTS[type] ?? CATEGORY_HINTS.sport
      return images.map((img: { id: string; base64?: string; url?: string }) => ({
        _id: img.id,
        ...(img.base64 ? { _base64: cleanBase64(img.base64) } : { _url: img.url }),
        ...hints,
      }))
    }

    const callRawEndpoint = async (type: string, inputRecords?: any[]) => {
      const endpoint = ENDPOINTS[type as keyof typeof ENDPOINTS]
      const records = inputRecords ?? buildRawRecords(type)
      console.log(`Calling ${endpoint} with ${records.length} records, hints: ${JSON.stringify(CATEGORY_HINTS[type])}`)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records,
          rotate: true,
          price_stats: true,
        }),
      })

      const text = await res.text()
      if (!res.ok) {
        console.error(`${endpoint} error ${res.status}: ${text}`)
        return null
      }
      return JSON.parse(text)
    }

    const sequence: string[] =
      cardType === 'tcg'   ? ['tcg', 'ocr'] :
      cardType === 'sport' ? ['sport', 'ocr'] :
      ['sport', 'tcg', 'ocr'] // auto

    let lastResult: any = null
    let lastRecords: any[] | undefined = undefined

    for (const type of sequence) {
      const data = await callRawEndpoint(type, type === 'ocr' ? lastRecords : undefined)
      if (!data) continue

      if (hasIdentification(data)) {
        console.log(`Successfully identified via ${type}`)
        return respond({ ...data, _source: type })
      }

      lastResult = data
      lastRecords = data.records
      console.log(`${type} returned no identification, trying next`)
    }

    return respond({ ...(lastResult ?? { records: [] }), _source: 'unidentified' })

  } catch (err) {
    console.error('ximilar-recognize error:', err)
    return respond({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})
