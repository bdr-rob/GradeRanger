import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GAME_MAP: Record<string, string> = {
  pokemon: 'pokemon',
  'pokemon tcg': 'pokemon',
  magic: 'magic',
  'magic: the gathering': 'magic',
  'yu-gi-oh': 'yugioh',
  yugioh: 'yugioh',
  'one piece': 'onepiece',
  lorcana: 'lorcana',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (payload: object) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { cardName, game = 'pokemon', setName, cardNumber } = await req.json()

    const TCG_API_KEY = Deno.env.get('TCG_API_KEY')
    if (!TCG_API_KEY) return respond({ error: 'TCG_API_KEY not configured' })

    const normalizedGame = GAME_MAP[game.toLowerCase()] ?? 'pokemon'

    // Build search query — name + set gives more precise results
    const query = [cardName, setName].filter(Boolean).join(' ')

    const url = new URL('https://api.tcgapi.dev/v1/search')
    url.searchParams.set('q', query)
    url.searchParams.set('game', normalizedGame)

    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': TCG_API_KEY },
    })

    const data = await res.json()
    if (!res.ok) return respond({ error: `TCG API ${res.status}` })

    // Return top 5 matches with price data
    const cards = (data.data ?? []).slice(0, 5).map((c: any) => ({
      id: c.id,
      name: c.name,
      set_name: c.set_name,
      rarity: c.rarity,
      printing: c.printing,
      market_price: c.market_price,
      low_price: c.low_price,
      median_price: c.median_price,
      image_url: c.image_url,
    }))

    return respond({ cards, total: data.meta?.total ?? 0 })
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})