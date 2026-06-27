import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://api.cardhedger.com'

function parseGradeValue(gradeStr: string): string {
  // "PSA 10" → "10", "BGS 9.5" → "9.5"
  return (gradeStr ?? '').replace(/^[A-Za-z]+\s+/i, '').trim()
}

function extractYear(text: string): string {
  const m = (text ?? '').match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : ''
}

function normalizeImageMatchResponse(data: any) {
  const m = data?.best_match ?? null
  if (!m) {
    return {
      matched: false,
      candidates: (data?.candidates ?? []).map((c: any) => ({
        cardHedgeId: c.card_id ?? '',
        player:      c.player  ?? '',
        setName:     c.set     ?? '',
        cardNumber:  c.number  ?? '',
        variant:     c.variant ?? '',
        category:    c.category ?? '',
        description: c.description ?? '',
        cardImage:   c.image   ?? '',
        year:        extractYear(c.set ?? c.description ?? ''),
      })),
    }
  }
  return {
    matched:     true,
    cardHedgeId: m.card_id  ?? '',
    player:      m.player   ?? '',
    setName:     m.set      ?? '',
    cardNumber:  m.number   ?? '',
    variant:     m.variant  ?? '',
    category:    m.category ?? '',
    description: m.description ?? '',
    cardImage:   m.image    ?? '',
    year:        extractYear(m.set ?? m.description ?? ''),
    confidence:  m.confidence ?? 0.9,
    candidates:  (data?.candidates ?? []).map((c: any) => ({
      cardHedgeId: c.card_id ?? '',
      player:      c.player  ?? '',
      setName:     c.set     ?? '',
      cardNumber:  c.number  ?? '',
      variant:     c.variant ?? '',
      category:    c.category ?? '',
      description: c.description ?? '',
      cardImage:   c.image   ?? '',
      year:        extractYear(c.set ?? c.description ?? ''),
    })),
  }
}

function normalizeCertResponse(data: any) {
  const ci   = data?.cert_info ?? {}
  const card = data?.card ?? {}
  const prices: { date: string; grade: string; price: number }[] =
    (data?.prices ?? []).map((p: any) => ({
      date:  p.closing_date ?? '',
      grade: p.Grade ?? ci.grade ?? '',
      price: parseFloat(p.price) || 0,
    }))

  const mostRecent = prices[0]?.price ?? null
  const grade      = ci.grade ?? ''
  const setName    = card.set ?? ''

  return {
    gradeCompany: (ci.grader ?? '').toUpperCase(),
    gradeValue:   parseGradeValue(grade),
    certNumber:   ci.cert   ?? '',
    player:       card.player ?? '',
    year:         extractYear(setName) || extractYear(ci.description ?? ''),
    setName,
    cardNumber:   card.number   ?? '',
    variant:      card.variant  ?? '',
    category:     card.category ?? '',
    cardHedgeId:  card.card_id  ?? '',
    cardImage:    card.image    ?? '',
    marketValue:  mostRecent,
    recentSales:  prices,
    confidence:   data?.match_confidence ?? (ci.gemrate_id ? 1 : 0.5),
    description:  ci.description ?? card.description ?? '',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (payload: object, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const CARDHEDGE_API_KEY = Deno.env.get('CARDHEDGE_API_KEY')
    if (!CARDHEDGE_API_KEY) return respond({ error: 'CARDHEDGE_API_KEY not configured' }, 500)

    const headers = {
      'X-API-Key':    CARDHEDGE_API_KEY,
      'Content-Type': 'application/json',
    }

    const body = await req.json()
    const { mode } = body

    // ── Cert number lookup (PSA / BGS / CGC / SGC) ──────────────────────────
    if (mode === 'cert') {
      const { cert, grader = 'PSA', days = 180 } = body
      if (!cert) return respond({ error: 'cert is required' }, 400)

      const res = await fetch(`${BASE}/v1/cards/prices-by-cert`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cert: String(cert).trim(), grader, days }),
      })
      const text = await res.text()
      if (!res.ok) {
        const msg = res.status === 404 ? 'Cert number not found'
          : res.status === 429 ? 'Rate limit reached — please try again shortly'
          : `Card Hedge API error ${res.status}`
        return respond({ error: msg })
      }
      const data = JSON.parse(text)
      return respond({ ...normalizeCertResponse(data), _source: 'cert' })
    }

    // ── Slab photo → OCR cert → lookup ──────────────────────────────────────
    if (mode === 'image') {
      const { image_base64, days = 180 } = body
      if (!image_base64) return respond({ error: 'image_base64 is required' }, 400)

      const res = await fetch(`${BASE}/v1/cards/prices-by-cert-ocr`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image_base64, days }),
      })
      const text = await res.text()
      if (!res.ok) {
        return respond({ error: `Card Hedge image OCR error ${res.status}` })
      }
      const data = JSON.parse(text)
      return respond({ ...normalizeCertResponse(data), _source: 'image' })
    }

    // ── Raw card image → AI identifies card + returns Card Hedger ID ─────────
    if (mode === 'image-match') {
      const { image_base64, image_url, k = 10 } = body
      if (!image_base64 && !image_url) return respond({ error: 'image_base64 or image_url required' }, 400)

      const res = await fetch(`${BASE}/v1/cards/image-match`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image_base64, image_url, k }),
      })
      if (!res.ok) return respond({ error: `Card Hedge image-match error ${res.status}` })
      const data = await res.json()
      return respond(normalizeImageMatchResponse(data))
    }

    // ── Market pricing by card description (replaces cardsight-market) ───────
    if (mode === 'market') {
      const { query, category, card_id, cardHedgeId } = body
      const resolvedCardId = card_id || cardHedgeId

      // If we have a cardhedge card_id, use card-details directly
      if (resolvedCardId) {
        const card_id = resolvedCardId
        const res = await fetch(`${BASE}/v1/cards/card-details`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ card_id }),
        })
        const data = await res.json()
        const card = data?.cards?.[0]
        if (card) return respond({ card, prices: card.prices ?? [] })
      }

      // Otherwise AI-match from description
      if (!query) return respond({ error: 'query or card_id required' }, 400)
      const res = await fetch(`${BASE}/v1/cards/card-match`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, category }),
      })
      const data = await res.json()
      return respond({ card: data?.card ?? null, prices: data?.card?.prices ?? [], confidence: data?.confidence ?? 0 })
    }

    // ── Card search ──────────────────────────────────────────────────────────
    if (mode === 'search') {
      const { search, category, page = 1, page_size = 20 } = body
      const res = await fetch(`${BASE}/v1/cards/card-search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ search, category, page, page_size }),
      })
      const data = await res.json()
      return respond(data)
    }

    return respond({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('cardhedge error:', err)
    return respond({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
