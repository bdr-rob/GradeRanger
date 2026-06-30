import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TCGAPI_BASE = 'https://api.tcgapi.dev'

const GAMES = [
  { id: '55', slug: 'pokemon',            name: 'Pokemon' },
  { id: '12', slug: 'magic',              name: 'Magic: The Gathering' },
  { id: '36', slug: 'yugioh',             name: 'YuGiOh' },
  { id: '11', slug: 'one-piece-card-game',name: 'One Piece Card Game' },
  { id: '45', slug: 'lorcana-tcg',        name: 'Disney Lorcana' },
  { id: '44', slug: 'digimon-card-game',  name: 'Digimon Card Game' },
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

async function tcgFetch(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${TCGAPI_BASE}${path}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TCG API ${path} — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// Fetch all pages for a paginated endpoint
async function fetchAllPages(basePath: string, apiKey: string): Promise<any[]> {
  const results: any[] = []
  let page = 1
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?'
    const data = await tcgFetch(`${basePath}${sep}page=${page}&per_page=100`, apiKey)
    const items: any[] = data?.data ?? []
    results.push(...items)
    if (!data?.meta?.has_more && items.length < 100) break
    if (items.length === 0) break
    page++
  }
  return results
}

// Sync all sets for a single game, return list of set IDs needing card sync
async function syncSetsForGame(
  game: typeof GAMES[number],
  apiKey: string,
  client: ReturnType<typeof sb>,
): Promise<{ id: string; needsCardSync: boolean }[]> {
  const sets = await fetchAllPages(`/v1/sets?game=${game.slug}`, apiKey)
  if (sets.length === 0) return []

  const rows = sets.map((s: any) => ({
    id:           String(s.id),
    game_id:      game.id,
    game_name:    game.name,
    game_slug:    game.slug,
    name:         s.name ?? '',
    slug:         s.slug ?? null,
    abbreviation: s.abbreviation ?? null,
    release_date: s.release_date ?? null,
    card_count:   s.card_count ?? null,
    image_url:    s.image_url ?? null,
    synced_at:    new Date().toISOString(),
  }))

  await client.from('tcg_sets').upsert(rows, { onConflict: 'id' })

  // Determine which sets need card sync:
  // - sets with no cards yet, OR
  // - sets whose card_count changed since last sync (last_synced_at on set)
  const setIds = rows.map((r) => r.id)
  const { data: existing } = await client
    .from('tcg_sets')
    .select('id, cards_synced_at')
    .in('id', setIds)

  const syncedMap = Object.fromEntries((existing ?? []).map((e: any) => [e.id, e.cards_synced_at]))

  return rows.map((r) => ({
    id: r.id,
    needsCardSync: !syncedMap[r.id],
  }))
}

// Sync cards for a single set
async function syncCardsForSet(
  setId: string,
  gameId: string,
  gameSlug: string,
  apiKey: string,
  client: ReturnType<typeof sb>,
): Promise<number> {
  const cards = await fetchAllPages(`/v1/sets/${setId}/cards`, apiKey)
  if (cards.length === 0) return 0

  const rows = cards.map((c: any) => {
    // Separate known top-level fields from rich metadata
    const { id, name, number, rarity, product_type, foil_only, printing, image_url,
            set_id, set_name, game_id, game_slug,
            ...rest } = c
    return {
      id:           String(c.id),
      set_id:       setId,
      game_id:      gameId,
      game_slug:    gameSlug,
      name:         c.name ?? '',
      number:       c.number ? String(c.number) : null,
      rarity:       c.rarity ?? null,
      product_type: c.product_type ?? null,
      printing:     c.printing ?? null,
      foil_only:    c.foil_only ?? null,
      image_url:    c.image_url ?? null,
      metadata:     Object.keys(rest).length > 0 ? rest : null,
      synced_at:    new Date().toISOString(),
    }
  })

  // Upsert in batches of 500 to avoid payload limits
  for (let i = 0; i < rows.length; i += 500) {
    await client.from('tcg_cards').upsert(rows.slice(i, i + 500), { onConflict: 'id' })
  }

  // Mark set as having cards synced
  await client
    .from('tcg_sets')
    .update({ cards_synced_at: new Date().toISOString() })
    .eq('id', setId)

  return rows.length
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('TCGAPI_KEY')
    if (!apiKey) return json({ error: 'TCGAPI_KEY not set' }, 500)

    const client = sb()
    const body = await req.json().catch(() => ({}))

    // action=sync_sets  → sync set metadata for all games (fast, weekly)
    // action=sync_cards → sync card checklists for sets missing cards (slower)
    // action=sync_all   → both in sequence (called by GitHub Actions)
    // action=sync_game  → sync one game by slug (for manual/targeted runs)

    const action: string = body.action ?? 'sync_all'
    const gameFilter: string | null = body.game ?? null

    const targetGames = gameFilter
      ? GAMES.filter((g) => g.slug === gameFilter)
      : GAMES

    if (targetGames.length === 0) {
      return json({ error: `Unknown game slug: ${gameFilter}` }, 400)
    }

    // Upsert game records
    await client.from('tcg_games').upsert(
      GAMES.map((g) => ({ id: g.id, name: g.name, slug: g.slug, synced_at: new Date().toISOString() })),
      { onConflict: 'id' },
    )

    const summary: Record<string, { sets: number; cards: number }> = {}

    for (const game of targetGames) {
      console.log(`Syncing sets for ${game.name}...`)
      const setResults = await syncSetsForGame(game, apiKey, client)
      summary[game.slug] = { sets: setResults.length, cards: 0 }

      if (action === 'sync_sets') continue

      // Sync cards only for sets that don't have them yet
      const needsSync = setResults.filter((s) => s.needsCardSync)
      console.log(`${game.name}: ${needsSync.length}/${setResults.length} sets need card sync`)

      for (const { id } of needsSync) {
        try {
          const count = await syncCardsForSet(id, game.id, game.slug, apiKey, client)
          summary[game.slug].cards += count
          console.log(`  Set ${id}: ${count} cards synced`)
        } catch (err) {
          console.error(`  Set ${id} card sync failed:`, err)
        }
      }
    }

    return json({ ok: true, action, summary })
  } catch (err) {
    console.error('tcg-catalog error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
