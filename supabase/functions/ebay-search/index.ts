import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const FINDING_BASE = 'https://svcs.ebay.com/services/search/FindingService/v1'
const BROWSE_BASE  = 'https://api.ebay.com/buy/browse/v1'
const TOKEN_URL    = 'https://api.ebay.com/identity/v1/oauth2/token'
const BROWSE_SCOPE = 'https://api.ebay.com/oauth/api_scope'

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

// ── App token (Client Credentials) ──────────────────────────────────────────
// Edge functions are stateless so we fetch a fresh token each invocation.
// App tokens last 2 hours; this adds ~100ms but avoids storing tokens in DB.
async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  const creds = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(BROWSE_SCOPE)}`,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`eBay token error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.access_token as string
}

// ── Browse API — active listings ─────────────────────────────────────────────
interface BrowseItem {
  itemId: string
  title: string
  itemWebUrl: string
  price: { value: string }
  image?: { imageUrl: string }
  condition?: string
  itemEndDate?: string
  buyingOptions?: string[]
}

async function browseSearch(q: string, token: string): Promise<BrowseItem[]> {
  const params = new URLSearchParams({
    q,
    // Trading Cards (sports) + Collectible Card Games (TCG)
    category_ids: '261328,183050',
    limit: '20',
  })
  const res = await fetch(`${BROWSE_BASE}/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    console.error(`Browse API ${res.status}: ${await res.text()}`)
    return []
  }
  const data = await res.json()
  return data.itemSummaries ?? []
}

// ── Finding API — completed/sold listings ────────────────────────────────────
interface FindingItem {
  itemId: string[]
  title: string[]
  viewItemURL: string[]
  sellingStatus: { currentPrice: { __value__: string }[] }[]
  listingInfo: { endTime: string[] }[]
  condition?: { conditionDisplayName: string[] }[]
  galleryURL?: string[]
}

async function findSold(q: string, appId: string): Promise<FindingItem[]> {
  // Build URL manually — URLSearchParams encodes ( ) which breaks itemFilter syntax
  const url =
    `${FINDING_BASE}` +
    `?OPERATION-NAME=findCompletedItems` +
    `&SERVICE-VERSION=1.0.0` +
    `&SECURITY-APPNAME=${encodeURIComponent(appId)}` +
    `&RESPONSE-DATA-FORMAT=JSON` +
    `&REST-PAYLOAD` +
    `&keywords=${encodeURIComponent(q)}` +
    `&paginationInput.entriesPerPage=20` +
    `&sortOrder=EndTimeSoonest` +
    `&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true`

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Finding API ${res.status}`)
    return []
  }
  const data = await res.json()
  return data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const clientId     = Deno.env.get('EBAY_CLIENT_ID')
    const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET')
    if (!clientId || !clientSecret) throw new Error('EBAY_CLIENT_ID or EBAY_CLIENT_SECRET not set')

    const { q } = await req.json()
    if (!q) return json({ error: 'q required' }, 400)

    const [token, soldItems] = await Promise.all([
      getAppToken(clientId, clientSecret),
      findSold(q, clientId),
    ])

    const activeItems = await browseSearch(q, token)

    const sold = soldItems.map((i) => ({
      id: i.itemId?.[0],
      title: i.title?.[0],
      url: i.viewItemURL?.[0],
      price: parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? '0'),
      endDate: i.listingInfo?.[0]?.endTime?.[0] ?? null,
      condition: i.condition?.[0]?.conditionDisplayName?.[0] ?? null,
      image: i.galleryURL?.[0] ?? null,
      sold: true,
    }))

    const active = activeItems.map((i) => ({
      id: i.itemId,
      title: i.title,
      url: i.itemWebUrl,
      price: parseFloat(i.price?.value ?? '0'),
      endDate: i.itemEndDate ?? null,
      listingType: i.buyingOptions?.[0] ?? null,
      condition: i.condition ?? null,
      image: i.image?.imageUrl ?? null,
      sold: false,
    }))

    return json({ sold, active })
  } catch (err) {
    console.error('ebay-search error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
