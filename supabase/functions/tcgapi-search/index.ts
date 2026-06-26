import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TCGAPI_BASE = 'https://api.tcgapi.dev'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sb() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

async function tcgFetch(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${TCGAPI_BASE}${path}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TCG API ${path} failed — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// Search cards by name, optionally filtered by game
async function searchCards(q: string, game: string | null, apiKey: string) {
  const params = new URLSearchParams({ q })
  if (game) params.set('game', game)
  return tcgFetch(`/v1/search?${params}`, apiKey)
}

// Get prices for a specific card id, with 4h DB cache
async function getCardPrices(cardId: string, force: boolean, apiKey: string) {
  const client = sb()
  const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000

  if (!force) {
    const { data: cached } = await client
      .from('tcgapi_price_cache')
      .select('data, fetched_at')
      .eq('id', cardId)
      .maybeSingle()

    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MAX_AGE_MS) {
      return { ...cached.data, _source: 'cache' }
    }
  }

  const data = await tcgFetch(`/v1/cards/${cardId}/prices`, apiKey)
  await client.from('tcgapi_price_cache').upsert(
    { id: cardId, data, fetched_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
  return { ...data, _source: 'live' }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('TCGAPI_KEY')
    if (!apiKey) throw new Error('TCGAPI_KEY not set')

    const { action, q, game, card_id, force } = await req.json()

    switch (action) {
      case 'search':
        if (!q) return json({ error: 'q required' }, 400)
        return json(await searchCards(q, game ?? null, apiKey))

      case 'prices':
        if (!card_id) return json({ error: 'card_id required' }, 400)
        return json(await getCardPrices(card_id, force ?? false, apiKey))

      default:
        return json({ error: `Unknown action: ${action}. Valid: search, prices` }, 400)
    }
  } catch (err) {
    console.error('tcgapi-search error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
