import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CH_BASE = 'https://api.cardhedger.com'

// Sports categories to sync — 100 most active sets per category per week.
// Card Hedger returns results ordered by sales volume so the most relevant
// sets are always captured within the 100-result limit.
const SPORTS_CATEGORIES = [
  'Baseball',
  'Basketball',
  'Football',
  'Hockey',
  'Soccer',
  'Golf',
  'Tennis',
  'UFC',
  'Wrestling',
  'Racing',
]

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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function chPost(path: string, body: object, apiKey: string): Promise<any> {
  const res = await fetch(`${CH_BASE}${path}`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Card Hedger ${path} — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function syncCategory(
  category: string,
  apiKey: string,
  client: ReturnType<typeof sb>,
): Promise<number> {
  const data = await chPost('/v1/cards/set-search', { category, count: 100 }, apiKey)
  const sets: any[] = data?.sets ?? []
  if (sets.length === 0) return 0

  const rows = sets.map((s: any) => ({
    id:          String(s.id),
    name:        s.name ?? '',
    year:        s.year ? String(s.year) : null,
    set_type:    s.set_type ?? null,
    category:    s.category ?? category,
    image_url:   s.image ? (s.image.startsWith('//') ? 'https:' + s.image : s.image) : null,
    sales_30day: s['30 Day Sales'] ?? null,
    raw:         s,
    synced_at:   new Date().toISOString(),
  }))

  await client.from('ch_sets').upsert(rows, { onConflict: 'id' })
  return rows.length
}

async function syncCardsForSet(
  setName: string,
  category: string,
  apiKey: string,
  client: ReturnType<typeof sb>,
): Promise<number> {
  let page = 1
  let total = 0

  while (true) {
    const data = await chPost(
      '/v1/cards/search-cards-wsort',
      { set: setName, category, page, page_size: 100, sort_by: 'description', sort_order: 'asc' },
      apiKey,
    )
    const cards: any[] = data?.cards ?? []
    if (cards.length === 0) break

    const rows = cards.map((c: any) => ({
      id:          String(c.card_id),
      set_name:    c.set ?? setName,
      category:    c.category ?? category,
      player:      c.player ?? null,
      number:      c.number ? String(c.number) : null,
      variant:     c.variant ?? null,
      image_url:   c.image ?? null,
      rookie:      c.rookie ?? null,
      sales_7day:  c['7 Day Sales'] ?? null,
      sales_30day: c['30 Day Sales'] ?? null,
      raw:         c,
      synced_at:   new Date().toISOString(),
    }))

    await client.from('ch_cards').upsert(rows, { onConflict: 'id' })
    total += rows.length

    if (page >= (data?.pages ?? 1)) break
    page++
  }

  return total
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('CARDHEDGE_API_KEY')
    if (!apiKey) return json({ error: 'CARDHEDGE_API_KEY not set' }, 500)

    const client = sb()
    const body = await req.json().catch(() => ({}))

    // action=sync_sets        → sync set metadata only for all categories (default weekly)
    // action=sync_cards       → sync cards for a specific set (on-demand)
    // action=sync_all         → sets + cards for all categories (expensive, first run)
    // category=Baseball       → limit set sync to one category
    // set_name=2024 Topps...  → sync cards for one specific set

    const action: string    = body.action    ?? 'sync_sets'
    const categoryFilter    = body.category  ?? null
    const setNameFilter     = body.set_name  ?? null

    const summary: Record<string, number> = {}

    // On-demand card sync for a specific set
    if (action === 'sync_cards' && setNameFilter) {
      const count = await syncCardsForSet(setNameFilter, categoryFilter ?? '', apiKey, client)
      return json({ ok: true, action, set: setNameFilter, cards_synced: count })
    }

    // Set sync
    const targetCategories = categoryFilter
      ? SPORTS_CATEGORIES.filter((c) => c.toLowerCase() === categoryFilter.toLowerCase())
      : SPORTS_CATEGORIES

    if (targetCategories.length === 0) {
      return json({ error: `Unknown category: ${categoryFilter}` }, 400)
    }

    for (const category of targetCategories) {
      console.log(`Syncing sets for ${category}...`)
      try {
        const count = await syncCategory(category, apiKey, client)
        summary[category] = count
        console.log(`  ${category}: ${count} sets`)
      } catch (err) {
        console.error(`  ${category} failed:`, err)
        summary[category] = -1
      }
    }

    // If sync_all, also pull cards for every set we just synced
    if (action === 'sync_all') {
      const { data: allSets } = await client
        .from('ch_sets')
        .select('name, category')
        .in('category', targetCategories)

      for (const s of allSets ?? []) {
        try {
          const count = await syncCardsForSet(s.name, s.category, apiKey, client)
          console.log(`  Cards: ${s.name} — ${count}`)
        } catch (err) {
          console.error(`  Cards failed for ${s.name}:`, err)
        }
      }
    }

    return json({ ok: true, action, summary })
  } catch (err) {
    console.error('ch-catalog error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
