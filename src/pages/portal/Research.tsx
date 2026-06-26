import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, ExternalLink, TrendingUp, Loader2, RefreshCw, ChevronRight } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface CatalogCard {
  id: string            // CardSight card UUID — used for marketplace lookup
  name: string
  setName?: string
  year?: string
  parallelName?: string
  releaseName?: string
  manufacturerName?: string
  type: string
}

interface MarketListing {
  title: string
  price: number
  source: string
  listing_type: string
  url: string
  image_url?: string
  condition?: string
  end_date?: string
  bid_count?: number
  parallel_name?: string
}

interface MarketGrade {
  grade_value: string
  count: number
  records: MarketListing[]
}

interface MarketCompany {
  company_name: string
  grades: MarketGrade[]
}

interface MarketData {
  card?: { name: string; number: string; set: { name: string; year: string } }
  raw?: { count: number; records: MarketListing[] }
  graded?: MarketCompany[]
  meta?: { total_records: number }
  source?: string
}

interface TcgCard {
  id: string | number
  name: string
  clean_name?: string
  set?: string
  number?: string
  rarity?: string
  image_url?: string
  market_price?: number
  price?: number
  low_price?: number
  foil_price?: number
  price_change_7d?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toFixed(2)}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString()
}

// Detect if a search term is likely a TCG card
const TCG_GAMES = ['pokemon', 'pikachu', 'charizard', 'magic', 'mtg', 'yugioh', 'yu-gi-oh',
  'lorcana', 'one piece', 'flesh and blood', 'fab', 'digimon', 'dragon ball',
  'eevee', 'mewtwo', 'blastoise', 'venusaur', 'snorlax', 'gengar', 'mew',
]
function looksLikeTCG(q: string) {
  const l = q.toLowerCase()
  return TCG_GAMES.some((k) => l.includes(k))
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ListingRow({ item, sold }: { item: MarketListing; sold?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50 border-b border-gray-50 last:border-0">
      {item.image_url && (
        <img src={item.image_url} alt="" className="w-10 h-10 object-contain rounded shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{item.title}</p>
        <p className="text-xs text-gray-400">
          {[item.source, item.condition, item.parallel_name].filter(Boolean).join(' · ')}
          {item.end_date && ` · ${sold ? 'Sold' : 'Ends'} ${fmtDate(item.end_date)}`}
          {item.listing_type === 'auction' && item.bid_count != null && ` · ${item.bid_count} bids`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-900">{fmt(item.price)}</p>
        <p className="text-xs text-gray-400 capitalize">{item.listing_type}</p>
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-gray-600">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}

function MarketSection({ data, onRefresh, loading }: {
  data: MarketData
  onRefresh: () => void
  loading: boolean
}) {
  const rawListings = (data.raw?.records ?? []).filter((r) => r.url && !r.url.includes('ebay.com/sch'))
  const totalRaw = rawListings.length
  const totalGraded = (data.graded ?? []).reduce((s, c) => s + c.grades.reduce((gs, g) => gs + g.count, 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Active Marketplace Listings</h3>
          {data.source === 'cache' && <span className="text-xs text-gray-400">(cached)</span>}
          <Badge variant="secondary">{data.meta?.total_records ?? 0} total</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Raw / ungraded */}
      {totalRaw > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Ungraded ({totalRaw})
          </p>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {rawListings.slice(0, 10).map((r, i) => <ListingRow key={i} item={r} />)}
          </div>
        </div>
      )}

      {/* Graded */}
      {(data.graded ?? []).map((company) => (
        <div key={company.company_name}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {company.company_name} Graded
          </p>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {company.grades.flatMap((g) =>
              g.records.map((r, i) => (
                <ListingRow key={`${g.grade_value}-${i}`} item={{ ...r, condition: `${company.company_name} ${g.grade_value}` }} />
              ))
            ).slice(0, 10)}
          </div>
        </div>
      ))}

      {totalRaw === 0 && totalGraded === 0 && (
        <p className="text-sm text-gray-400 italic">No active listings found for this card.</p>
      )}
    </div>
  )
}

function TcgResults({ cards }: { cards: TcgCard[] }) {
  if (!cards.length) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-700">TCG Market Prices</h3>
        <Badge variant="secondary">{cards.length}</Badge>
      </div>
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        {cards.slice(0, 10).map((card) => {
          const price = card.market_price ?? card.price
          const subtitle = [card.set, card.number, card.rarity].filter(Boolean).join(' · ')
          return (
            <div key={String(card.id)} className="flex items-center gap-3 px-3 py-2.5 bg-white border-b border-gray-50 last:border-0">
              {card.image_url && (
                <img src={card.image_url} alt="" className="w-8 h-12 object-contain rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{card.clean_name ?? card.name}</p>
                {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
              </div>
              <div className="shrink-0 text-right">
                {price != null && <p className="text-sm font-semibold text-gray-900">{fmt(price)}</p>}
                {card.price_change_7d != null && (
                  <p className={`text-xs ${card.price_change_7d >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {card.price_change_7d >= 0 ? '+' : ''}{card.price_change_7d.toFixed(1)}% 7d
                  </p>
                )}
                {card.foil_price != null && (
                  <p className="text-xs text-gray-400">foil {fmt(card.foil_price)}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Research() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [catalogResults, setCatalogResults] = useState<CatalogCard[]>([])
  const [tcgResults, setTcgResults] = useState<TcgCard[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selected card for marketplace drill-down
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [loadingMarket, setLoadingMarket] = useState(false)

  const isTCG = looksLikeTCG(query)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    setCatalogResults([])
    setTcgResults([])
    setSelectedCard(null)
    setMarketData(null)
    setSearched(true)

    try {
      const calls: Promise<any>[] = [
        supabase.functions.invoke('cardsight-catalog', {
          body: { action: 'search', q: query, take: 20 },
        }),
      ]

      if (isTCG) {
        calls.push(
          supabase.functions.invoke('tcgapi-search', { body: { action: 'search', q: query } })
        )
      }

      const [catalogRes, tcgRes] = await Promise.all(calls)

      if (catalogRes.error) {
        setError(`Catalog search failed: ${catalogRes.error.message}`)
      } else {
        // Only show card-type results (not sets/releases/manufacturers)
        const all = catalogRes.data?.results ?? []
        setCatalogResults(all.filter((r: CatalogCard) => r.type === 'card'))
      }

      if (tcgRes && !tcgRes.error) {
        const raw = tcgRes.data
        const cards = Array.isArray(raw) ? raw : (raw?.data ?? raw?.results ?? raw?.cards ?? [])
        setTcgResults(cards)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }

  async function loadMarketplace(card: CatalogCard, force = false) {
    setSelectedCard(card)
    setMarketData(null)
    setLoadingMarket(true)
    const { data, error } = await supabase.functions.invoke('cardsight-catalog', {
      body: { action: 'marketplace', card_id: card.id, force },
    })
    setLoadingMarket(false)
    if (error) {
      setError(`Marketplace load failed: ${error.message}`)
      return
    }
    setMarketData(data)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Research</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search the card catalog for active marketplace listings and pricing.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          placeholder="Player name, card name, set… e.g. Charizard, Ken Griffey Jr"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="flex-1"
        />
        <Button onClick={search} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {isTCG && query && (
        <p className="text-xs text-blue-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          TCG card detected — also searching TCG API
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Catalog results — step 1 */}
      {searched && !searching && catalogResults.length === 0 && tcgResults.length === 0 && (
        <p className="text-sm text-gray-400 italic">No cards found for "{query}".</p>
      )}

      {catalogResults.length > 0 && !selectedCard && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Catalog ({catalogResults.length})
          </p>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {catalogResults.map((card) => (
              <button
                key={card.id}
                onClick={() => loadMarketplace(card)}
                className="flex items-center gap-3 w-full px-3 py-2.5 bg-white hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{card.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[card.setName, card.year, card.parallelName, card.releaseName]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TCG results */}
      {tcgResults.length > 0 && !selectedCard && <TcgResults cards={tcgResults} />}

      {/* Marketplace drill-down — step 2 */}
      {selectedCard && (
        <div className="space-y-4">
          <button
            onClick={() => { setSelectedCard(null); setMarketData(null) }}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Back to results
          </button>
          <div className="bg-white border border-gray-100 rounded-lg px-4 py-3">
            <p className="font-semibold text-gray-900">{selectedCard.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {[selectedCard.setName, selectedCard.year, selectedCard.parallelName, selectedCard.releaseName]
                .filter(Boolean).join(' · ')}
            </p>
          </div>

          {loadingMarket && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading marketplace listings…
            </div>
          )}

          {marketData && (
            <MarketSection
              data={marketData}
              onRefresh={() => loadMarketplace(selectedCard, true)}
              loading={loadingMarket}
            />
          )}
        </div>
      )}
    </div>
  )
}
