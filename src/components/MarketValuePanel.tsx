import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  TrendingUp, TrendingDown, Minus,
  RefreshCw, Loader2, DollarSign, BarChart2, Clock, Tag, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

interface PricePoint { date: string; price: number }
interface SaleRecord {
  date: string
  price: number
  condition?: string
  platform?: string
  grade?: string
}
interface ListingRecord {
  price: number
  title?: string
  platform?: string
  url?: string
  listingType?: string
  endDate?: string
  bidCount?: number
  condition?: string
  grade?: string
}

interface Props {
  card: any
  valuation?: any
  costBasis?: number
}

function normaliseHistory(raw: any): PricePoint[] | null {
  if (!raw) return null
  const arr = Array.isArray(raw) ? raw : raw.history ?? raw.data ?? raw.prices ?? []
  if (!arr.length) return null
  return arr.map((p: any) => ({
    date:  p.date ?? p.timestamp ?? p.soldAt ?? p.saleDate ?? '',
    price: parseFloat(p.price ?? p.value ?? p.marketValue ?? p.avgPrice ?? 0),
  })).filter((p: PricePoint) => p.date && p.price > 0)
}

function normaliseSales(raw: any): SaleRecord[] | null {
  if (!raw) return null
  const arr = Array.isArray(raw) ? raw : raw.sales ?? raw.data ?? raw.transactions ?? []
  if (!arr.length) return null
  return arr.slice(0, 20).map((s: any) => ({
    date:      s.date ?? s.soldAt ?? s.saleDate ?? s.timestamp ?? '',
    price:     parseFloat(s.price ?? s.salePrice ?? s.amount ?? 0),
    condition: s.condition ?? s.grade ?? null,
    platform:  s.platform ?? s.source ?? s.marketplace ?? null,
    grade:     s.grade ?? null,
  })).filter((s: SaleRecord) => s.price > 0)
}

function normaliseListings(raw: any): ListingRecord[] | null {
  if (!raw) return null
  const arr = Array.isArray(raw) ? raw : raw.listings ?? raw.data ?? []
  if (!arr.length) return null
  return arr.slice(0, 20).map((l: any) => ({
    price:       parseFloat(l.price ?? 0),
    title:       l.title ?? null,
    platform:    l.platform ?? l.source ?? null,
    url:         l.url ?? null,
    listingType: l.listingType ?? l.listing_type ?? null,
    endDate:     l.endDate ?? l.end_date ?? null,
    bidCount:    l.bidCount ?? l.bid_count ?? null,
    condition:   l.condition ?? null,
    grade:       l.grade ?? null,
  })).filter((l: ListingRecord) => l.price > 0)
}

function PLBadge({ current, cost }: { current: number; cost: number }) {
  const diff = current - cost
  const pct  = cost > 0 ? ((diff / cost) * 100).toFixed(1) : null
  if (diff > 0) return (
    <span className="text-green-600 font-medium text-sm flex items-center gap-1">
      <TrendingUp className="w-3 h-3" />
      +${diff.toFixed(2)}{pct ? ` (${pct}%)` : ''}
    </span>
  )
  if (diff < 0) return (
    <span className="text-red-500 font-medium text-sm flex items-center gap-1">
      <TrendingDown className="w-3 h-3" />
      ${diff.toFixed(2)}{pct ? ` (${pct}%)` : ''}
    </span>
  )
  return <span className="text-gray-400 text-sm flex items-center gap-1"><Minus className="w-3 h-3" />$0.00</span>
}

export default function MarketValuePanel({ card, valuation: initialValuation, costBasis = 0 }: Props) {
  const { toast } = useToast()
  const [valuation, setValuation]   = useState(initialValuation ?? null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(
    initialValuation?.raw_median ?? null
  )
  const [rawLow, setRawLow]   = useState<number | null>(initialValuation?.raw_low ?? null)
  const [rawHigh, setRawHigh] = useState<number | null>(initialValuation?.raw_high ?? null)
  // Pre-populate sub-data from the DB cache if it's still fresh (< 4 h).
  // On a fresh mount this means zero CardSight API calls for recently-viewed
  // cards — the edge function is only invoked when the cache is absent or stale.
  const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000
  const cachedFetchedAt  = initialValuation?.fetched_at ? new Date(initialValuation.fetched_at).getTime() : 0
  const cacheIsFresh     = Date.now() - cachedFetchedAt < CACHE_MAX_AGE_MS && initialValuation?.cached_history != null

  const [history, setHistory]   = useState<PricePoint[] | null>(
    cacheIsFresh ? normaliseHistory(initialValuation?.cached_history) : null
  )
  const [sales, setSales]       = useState<SaleRecord[] | null>(
    cacheIsFresh ? normaliseSales(initialValuation?.cached_sales) : null
  )
  const [listings, setListings] = useState<ListingRecord[] | null>(
    cacheIsFresh ? normaliseListings(initialValuation?.cached_listings) : null
  )
  const [usingListingsFallback, setUsingListingsFallback] = useState(
    cacheIsFresh ? (initialValuation?.data_source?.includes('listings') ?? false) : false
  )
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<string | null>(
    initialValuation?.fetched_at ?? null
  )

  const cardsightCardId = card?.cardsight_card_id ?? null

  async function fetchMarketData(force = false) {
    if (!cardsightCardId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cardsight-market', {
        body: { card_id: card.id, cardsight_card_id: cardsightCardId, force },
      })
      if (error) throw error

      if (data.currentPrice != null) setCurrentPrice(data.currentPrice)
      if (data.rawLow != null)       setRawLow(data.rawLow)
      if (data.rawHigh != null)      setRawHigh(data.rawHigh)
      setUsingListingsFallback(!!data.usingListingsFallback)

      const h = normaliseHistory(data.history)
      const s = normaliseSales(data.sales)
      const l = normaliseListings(data.listings)
      if (h) setHistory(h)
      if (s) setSales(s)
      if (l) setListings(l)

      setLastFetched(new Date().toISOString())

      if (force) toast({ title: 'Market data refreshed' })
    } catch (err) {
      if (force) toast({ title: 'Could not refresh market data', variant: 'destructive' })
      console.error('MarketValuePanel fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!cardsightCardId) return
    // Skip the live call when the DB already has fresh sub-data (history/
    // sales/listings) — those are now cached alongside the headline value
    // so we don't need to call CardSight on every page visit.
    if (cacheIsFresh) return
    fetchMarketData()
  }, [cardsightCardId])

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-[#14314F]">
          <TrendingUp className="h-4 w-4 text-[#47682d]" />
          Market Data
          {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={() => fetchMarketData(true)}
          disabled={loading || !cardsightCardId}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {!cardsightCardId && (
        <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">
          This card hasn't been identified by CardSight yet — market data unavailable.
          Re-scan the card to enable pricing.
        </p>
      )}

      {/* ── Current Value ────────────────────────────────────────────────────── */}
      {(currentPrice != null || rawLow != null) && (
        <div className="bg-gray-50 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Current Market Value
          </p>
          <div className="flex items-end gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Est. Value</p>
              <p className="text-3xl font-bold text-[#14314F]">
                {currentPrice != null ? `$${currentPrice.toFixed(2)}` : '—'}
              </p>
            </div>
            {(rawLow != null || rawHigh != null) && (
              <div className="flex gap-4 pb-1">
                {rawLow != null && (
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Low</p>
                    <p className="text-lg font-semibold text-gray-600">${rawLow.toFixed(2)}</p>
                  </div>
                )}
                {rawHigh != null && (
                  <div className="text-center">
                    <p className="text-xs text-gray-400">High</p>
                    <p className="text-lg font-semibold text-gray-600">${rawHigh.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* P&L vs cost basis */}
          {currentPrice != null && costBasis > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                vs. your cost (${costBasis.toFixed(2)})
              </span>
              <PLBadge current={currentPrice} cost={costBasis} />
            </div>
          )}

          {lastFetched && (
            <p className="text-xs text-gray-400 mt-2">
              Source: CardSight{usingListingsFallback ? ' (active listings — no completed sales yet)' : ''}
              {' · '}Updated {new Date(lastFetched).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* ── Price History Chart ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
          <BarChart2 className="w-3 h-3" /> Price History
        </p>
        {history && history.length > 1 ? (
          <div className="bg-gray-50 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => {
                    try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
                    catch { return v }
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => `$${v}`}
                  width={55}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                  labelFormatter={(label) => {
                    try { return new Date(label).toLocaleDateString() }
                    catch { return label }
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#14314F"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#47682d' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400">
              {loading
                ? 'Loading price history…'
                : cardsightCardId
                ? 'Price history not yet available from CardSight for this card.'
                : 'Scan the card to enable price history.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Recent Sales ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Recent Sales
        </p>
        {sales && sales.length > 0 ? (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Condition</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Platform</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-600">
                      {sale.date ? new Date(sale.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {sale.grade
                        ? <Badge variant="outline" className="text-xs">{sale.grade}</Badge>
                        : sale.condition
                        ? <span className="text-gray-500">{sale.condition}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{sale.platform ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#14314F]">
                      ${sale.price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400">
              {loading
                ? 'Loading recent sales…'
                : cardsightCardId
                ? 'No recent sales data available from CardSight for this card.'
                : 'Scan the card to enable recent sales.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Active Listings ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
          <Tag className="w-3 h-3" /> Active Listings
        </p>
        {listings && listings.length > 0 ? (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Condition</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Platform</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Type</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Price</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listings.map((listing, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      {listing.grade
                        ? <Badge variant="outline" className="text-xs">{listing.grade}</Badge>
                        : listing.condition
                        ? <span className="text-gray-500">{listing.condition}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{listing.platform ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 capitalize">
                      {listing.listingType ?? '—'}
                      {listing.listingType === 'auction' && listing.bidCount != null && (
                        <span className="text-gray-400"> · {listing.bidCount} bid{listing.bidCount !== 1 ? 's' : ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-[#14314F]">
                      ${listing.price.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {listing.url && (
                        <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#14314F]">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400">
              {loading
                ? 'Loading active listings…'
                : cardsightCardId
                ? 'No active listings found from CardSight for this card.'
                : 'Scan the card to enable active listings.'}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}