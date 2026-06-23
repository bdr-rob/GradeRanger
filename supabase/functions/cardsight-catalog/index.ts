import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CARDSIGHT_BASE = 'https://api.cardsight.ai'
const PAGE_SIZE = 100
const MAX_PAGES_PER_CALL = 40 // ~4k rows/call — stays well under the edge function timeout
const RELEASES_PER_REFRESH_CALL = 5 // each release can itself be several pages of cards

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

// CardSight's catalog endpoints carry a tight sliding-window rate limit
// (x-ratelimit-limit: 4). A 429 here just means "wait a beat", so retry with
// backoff instead of failing the whole sync.
async function cardsightFetch(path: string, apiKey: string, attempt = 0): Promise<any> {
  const res = await fetch(`${CARDSIGHT_BASE}${path}`, { headers: { 'X-API-Key': apiKey } })

  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get('retry-after')) || 1
    await new Promise((r) => setTimeout(r, (retryAfter || 1) * 1000))
    return cardsightFetch(path, apiKey, attempt + 1)
  }

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`CardSight ${path} failed — HTTP ${res.status}: ${errorText}`)
  }
  return res.json()
}

// GET /v1/catalog/statistics — free endpoint, proxied live (changes rarely,
// CardSight itself caches it for an hour).
async function getStatistics(apiKey: string) {
  return cardsightFetch('/v1/catalog/statistics', apiKey)
}

// GET /v1/identify/check/set/{set_id} — free pre-flight check, proxied live.
async function checkSet(setId: string, apiKey: string) {
  return cardsightFetch(`/v1/identify/check/set/${setId}`, apiKey)
}

// Generic chunked paginate-and-upsert — used for sets/manufacturers/releases.
// Each call only walks MAX_PAGES_PER_CALL pages to stay under the edge
// function's execution timeout; pass `nextSkip` back as `start_skip` to
// resume, `done: true` means the full list has been synced.
async function syncPaginated(opts: {
  apiKey: string
  startSkip: number
  listPath: (skip: number) => string
  itemsKey: string
  table: string
  mapRow: (item: any) => Record<string, unknown>
}) {
  const { apiKey, startSkip, listPath, itemsKey, table, mapRow } = opts
  const client = sb()

  let skip = startSkip
  let totalCount = Infinity
  let synced = 0
  let pages = 0

  while (skip < totalCount && pages < MAX_PAGES_PER_CALL) {
    const page = await cardsightFetch(listPath(skip), apiKey)
    totalCount = page.total_count ?? 0
    pages++

    const items = page[itemsKey] ?? []
    if (!items.length) break

    const rows = items.map(mapRow)
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`${table} upsert failed at skip=${skip}: ${error.message}`)

    synced += rows.length
    skip += PAGE_SIZE
  }

  return { synced, totalCount, nextSkip: skip, done: skip >= totalCount }
}

function syncSets(apiKey: string, startSkip: number) {
  return syncPaginated({
    apiKey,
    startSkip,
    listPath: (skip) => `/v1/catalog/sets?take=${PAGE_SIZE}&skip=${skip}`,
    itemsKey: 'sets',
    table: 'catalog_sets',
    mapRow: (s) => ({
      id: s.id,
      name: s.name,
      is_identifiable: !!s.is_identifiable,
      card_count: s.cardCount ?? null,
      parallel_count: s.parallelCount ?? null,
      release_id: s.releaseId ?? null,
      release_name: s.releaseName ?? null,
      release_year: s.releaseYear ?? null,
      synced_at: new Date().toISOString(),
    }),
  })
}

function syncManufacturers(apiKey: string, startSkip: number) {
  return syncPaginated({
    apiKey,
    startSkip,
    listPath: (skip) => `/v1/catalog/manufacturers?take=${PAGE_SIZE}&skip=${skip}`,
    itemsKey: 'manufacturers',
    table: 'catalog_manufacturers',
    mapRow: (m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? null,
      synced_at: new Date().toISOString(),
    }),
  })
}

function syncReleases(apiKey: string, startSkip: number) {
  return syncPaginated({
    apiKey,
    startSkip,
    listPath: (skip) => `/v1/catalog/releases?take=${PAGE_SIZE}&skip=${skip}`,
    itemsKey: 'releases',
    table: 'catalog_releases',
    mapRow: (r) => ({
      id: r.id,
      name: r.name,
      year: r.year ?? null,
      is_identifiable: !!r.is_identifiable,
      description: r.description ?? null,
      manufacturer_id: r.manufacturerId ?? null,
      segment_id: r.segmentId ?? null,
      synced_at: new Date().toISOString(),
    }),
  })
}

function syncAttributes(apiKey: string, startSkip: number) {
  return syncPaginated({
    apiKey,
    startSkip,
    listPath: (skip) => `/v1/catalog/attributes?take=${PAGE_SIZE}&skip=${skip}`,
    itemsKey: 'attributes',
    table: 'catalog_attributes',
    mapRow: (a) => ({
      id: a.id,
      name: a.name ?? null,
      short_name: a.shortName ?? null,
      description: a.description ?? null,
      card_count: a.cardCount ?? null,
      synced_at: new Date().toISOString(),
    }),
  })
}

function syncFields(apiKey: string, startSkip: number) {
  return syncPaginated({
    apiKey,
    startSkip,
    listPath: (skip) => `/v1/catalog/fields?take=${PAGE_SIZE}&skip=${skip}`,
    itemsKey: 'fields',
    table: 'catalog_fields',
    mapRow: (f) => ({
      id: f.id,
      key: f.key,
      name: f.name ?? null,
      description: f.description ?? null,
      usage_count: f.usageCount ?? null,
      synced_at: new Date().toISOString(),
    }),
  })
}

// Local-first global search: tries catalog_sets/catalog_releases/
// catalog_manufacturers via ILIKE before spending a rate-limited live call.
// Only falls through to CardSight's /v1/catalog/search when the local
// catalog has no hits at all (e.g. a card name, which isn't synced locally).
async function search(apiKey: string, q: string, take: number) {
  const client = sb()
  const like = `%${q}%`

  const [{ data: sets }, { data: releases }, { data: manufacturers }] = await Promise.all([
    client.from('catalog_sets').select('id, name, release_name, release_year').or(`name.ilike.${like},release_name.ilike.${like}`).limit(take),
    client.from('catalog_releases').select('id, name, year').ilike('name', like).limit(take),
    client.from('catalog_manufacturers').select('id, name').ilike('name', like).limit(take),
  ])

  const localResults = [
    ...(sets ?? []).map((s) => ({ type: 'set', id: s.id, name: s.name, year: s.release_year, releaseName: s.release_name })),
    ...(releases ?? []).map((r) => ({ type: 'release', id: r.id, name: r.name, year: r.year })),
    ...(manufacturers ?? []).map((m) => ({ type: 'manufacturer', id: m.id, name: m.name })),
  ]

  if (localResults.length) return { results: localResults.slice(0, take), source: 'local' }

  // Local catalog doesn't cover individual cards/parallels, so a card-name
  // query (e.g. "charizard") legitimately needs the live endpoint.
  const live = await cardsightFetch(`/v1/catalog/search?q=${encodeURIComponent(q)}&take=${take}`, apiKey)
  return { results: live.results ?? [], source: 'live', totalCount: live.total_count }
}

// Walks /v1/catalog/releases/{id}/cards to completion and upserts the result
// into release_cards_cache. Shared by releaseDetail (one release, on demand)
// and refreshChecklists (many releases, on a schedule).
async function fetchAndCacheRelease(apiKey: string, releaseId: string) {
  const client = sb()

  let skip = 0
  let totalCount = Infinity
  const cards: any[] = []
  while (skip < totalCount && cards.length < 2000) {
    const page = await cardsightFetch(`/v1/catalog/releases/${releaseId}/cards?take=${PAGE_SIZE}&skip=${skip}`, apiKey)
    totalCount = page.total_count ?? 0
    cards.push(...(page.cards ?? []))
    if (!page.cards?.length) break
    skip += PAGE_SIZE
  }

  const fetchedAt = new Date().toISOString()
  const { error } = await client
    .from('release_cards_cache')
    .upsert({ release_id: releaseId, cards, fetched_at: fetchedAt }, { onConflict: 'release_id' })
  if (error) throw new Error(`release_cards_cache upsert failed: ${error.message}`)

  return { cards, fetchedAt }
}

// Cache-on-read for a release's full checklist — fetched live once via
// /v1/catalog/releases/{id}/cards (can be hundreds of cards, paginated),
// then served from release_cards_cache on every subsequent request.
async function releaseDetail(apiKey: string, releaseId: string, force: boolean) {
  if (!force) {
    const { data: cached } = await sb()
      .from('release_cards_cache')
      .select('cards, fetched_at')
      .eq('release_id', releaseId)
      .maybeSingle()
    if (cached) return { cards: cached.cards, fetchedAt: cached.fetched_at, source: 'cache' }
  }

  const { cards, fetchedAt } = await fetchAndCacheRelease(apiKey, releaseId)
  return { cards, fetchedAt, source: 'live' }
}

// Weekly maintenance: re-fetch every release whose checklist has already
// been cached at least once, so previously-viewed checklists don't go
// stale. Chunked by release count (not pages) since each release can itself
// span several pages of cards.
async function refreshChecklists(apiKey: string, startOffset: number) {
  const client = sb()

  const { data: releaseIds, error } = await client
    .from('release_cards_cache')
    .select('release_id')
    .order('release_id')
    .range(startOffset, startOffset + RELEASES_PER_REFRESH_CALL - 1)
  if (error) throw new Error(`release_cards_cache listing failed: ${error.message}`)

  let refreshed = 0
  for (const row of releaseIds ?? []) {
    await fetchAndCacheRelease(apiKey, row.release_id)
    refreshed++
  }

  const nextOffset = startOffset + (releaseIds?.length ?? 0)
  return { refreshed, nextOffset, done: (releaseIds?.length ?? 0) < RELEASES_PER_REFRESH_CALL }
}

// Cache-on-read for a single card's full detail (numberedTo, parallelCount,
// variationOf, etc.) — fetched live one card at a time when a user drills
// into a specific card, not synced in bulk (11.8M cards in the catalog).
async function cardDetail(apiKey: string, cardId: string, force: boolean) {
  const client = sb()

  if (!force) {
    const { data: cached } = await client
      .from('card_details_cache')
      .select('data, fetched_at')
      .eq('card_id', cardId)
      .maybeSingle()
    if (cached) return { card: cached.data, fetchedAt: cached.fetched_at, source: 'cache' }
  }

  const card = await cardsightFetch(`/v1/catalog/cards/${cardId}`, apiKey)
  const fetchedAt = new Date().toISOString()
  const { error } = await client
    .from('card_details_cache')
    .upsert({ card_id: cardId, data: card, fetched_at: fetchedAt }, { onConflict: 'card_id' })
  if (error) throw new Error(`card_details_cache upsert failed: ${error.message}`)

  return { card, fetchedAt, source: 'live' }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('CARDSIGHT_API_KEY')
    if (!apiKey) return json({ error: 'CARDSIGHT_API_KEY not set' }, 500)

    const { action, set_id, release_id, card_id, start_skip, start_offset, q, take, force } = await req.json().catch(() => ({}))

    switch (action) {
      case 'stats':
        return json(await getStatistics(apiKey))
      case 'check':
        if (!set_id) return json({ error: 'set_id required' }, 400)
        return json(await checkSet(set_id, apiKey))
      case 'sync_sets':
        return json(await syncSets(apiKey, start_skip ?? 0))
      case 'sync_manufacturers':
        return json(await syncManufacturers(apiKey, start_skip ?? 0))
      case 'sync_releases':
        return json(await syncReleases(apiKey, start_skip ?? 0))
      case 'sync_attributes':
        return json(await syncAttributes(apiKey, start_skip ?? 0))
      case 'sync_fields':
        return json(await syncFields(apiKey, start_skip ?? 0))
      case 'search':
        if (!q) return json({ error: 'q required' }, 400)
        return json(await search(apiKey, q, take ?? 20))
      case 'release_detail':
        if (!release_id) return json({ error: 'release_id required' }, 400)
        return json(await releaseDetail(apiKey, release_id, !!force))
      case 'refresh_checklists':
        return json(await refreshChecklists(apiKey, start_offset ?? 0))
      case 'card_detail':
        if (!card_id) return json({ error: 'card_id required' }, 400)
        return json(await cardDetail(apiKey, card_id, !!force))
      default:
        return json({ error: 'action must be one of: stats, check, sync_sets, sync_manufacturers, sync_releases, sync_attributes, sync_fields, search, release_detail, refresh_checklists, card_detail' }, 400)
    }
  } catch (err) {
    console.error('cardsight-catalog error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
