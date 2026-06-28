import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus,
  RefreshCw, Loader2, DollarSign, BarChart2, Clock, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { getCardHedgeMarketPrice, computeMarketValue, CardHedgePrice } from '@/lib/cardhedge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricePoint { date: string; price: number }

interface SaleRow {
  date:   string
  grade:  string
  price:  number
  source: 'Card Hedger' | 'eBay'
  url?:   string
  title?: string
}

interface Props {
  card: any
  valuation?: any   // kept for caller compat; not used
  costBasis?: number
  gradedValues?: any
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADER_RE = /\b(PSA|BGS|CGC|SGC|CSG|HGA)\b/i

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

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function trimmedMedian(prices: number[]): number | null {
  if (prices.length === 0) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const trim   = Math.max(0, Math.floor(sorted.length * 0.1))
  const pool   = trim > 0 ? sorted.slice(trim, sorted.length - trim) : sorted
  return median(pool.length > 0 ? pool : sorted)
}

// ── eBay fetch ────────────────────────────────────────────────────────────────

async function fetchEbaySold(
  query: string,
  isGraded: boolean,
  gradeCompany?: string,
  gradeValue?: string,
): Promise<SaleRow[]> {
  // Build a targeted eBay query
  let q = query
  if (isGraded && gradeCompany && gradeValue) {
    q = `${query} ${gradeCompany} ${gradeValue}`
  }

  try {
    const { data, error } = await supabase.functions.invoke('ebay-search', { body: { q } })
    if (error || !data?.sold) return []

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    return (data.sold as any[])
      .filter((s) => {
        if (!s.price || s.price <= 0) return false
        // Date filter — keep last 90 days
        if (s.endDate && new Date(s.endDate) < cutoff) return false
        // For raw cards: exclude listings with grader names in the title
        if (!isGraded && GRADER_RE.test(s.title ?? '')) return false
        return true
      })
      .map((s) => ({
        date:   s.endDate ?? '',
        grade:  isGraded ? `${gradeCompany ?? ''} ${gradeValue ?? ''}`.trim() : 'Raw',
        price:  s.price,
        source: 'eBay' as const,
        url:    s.url,
        title:  s.title,
      }))
  } catch {
    return []
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketValuePanel({ card, costBasis = 0 }: Props) {
  const { toast } = useToast()

  const isGraded     = !!(card?.is_graded)
  const gradeCompany = card?.grading_company ?? ''
  const gradeValue   = card?.official_grade  ?? ''
  const gradeLabel   = gradeCompany && gradeValue ? `${gradeCompany} ${gradeValue}` : ''

  const cardHedgeId = card?.cardhedge_card_id ?? null
  const cardQuery   = [card?.year, card?.player_name, card?.card_name, card?.set_name]
    .filter(Boolean).join(' ').trim()
  const canFetch = !!(cardHedgeId || cardQuery)

  const [chPrices,      setChPrices]      = useState<CardHedgePrice[]>([])
  const [ebaySales,     setEbaySales]     = useState<SaleRow[]>([])
  const [chValue,       setChValue]       = useState<number | null>(null)
  const [ebayValue,     setEbayValue]     = useState<number | null>(null)
  const [combinedValue, setCombinedValue] = useState<number | null>(null)
  const [history,       setHistory]       = useState<PricePoint[]>([])
  const [loading,       setLoading]       = useState(false)
  const [lastFetched,   setLastFetched]   = useState<string | null>(null)

  async function fetchAll(force = false) {
    if (!canFetch) return
    setLoading(true)
    try {
      const [chResult, ebayRows] = await Promise.all([
        getCardHedgeMarketPrice({
          ...(cardHedgeId ? { cardHedgeId } : { query: cardQuery }),
          isGraded,
          gradeLabel: gradeLabel || undefined,
        }),
        fetchEbaySold(cardQuery, isGraded, gradeCompany || undefined, gradeValue || undefined),
      ])

      // Card Hedger
      setChPrices(chResult.prices)
      setChValue(chResult.marketValue)

      // eBay
      setEbaySales(ebayRows)
      const ebayMedian = trimmedMedian(ebayRows.map((s) => s.price))
      setEbayValue(ebayMedian)

      // Combined: weighted average (CH counts twice — more sales history depth)
      const sources = [
        ...(chResult.marketValue != null ? [chResult.marketValue, chResult.marketValue] : []),
        ...(ebayMedian           != null ? [ebayMedian]                                : []),
      ]
      setCombinedValue(sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : null)

      // Chart history: merge CH + eBay, sort by date
      const chPoints: PricePoint[] = [...chResult.prices]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ date: p.date, price: p.price }))
      setHistory(chPoints)

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
    if (!canFetch) return
    fetchAll()
  }, [cardHedgeId, cardQuery])

  // Merged sales table: CH prices + eBay rows, sorted newest first
  const allSales: SaleRow[] = [
    ...chPrices.slice(0, 20).map((p): SaleRow => ({
      date: p.date, grade: p.grade, price: p.price, source: 'Card Hedger',
    })),
    ...ebaySales.slice(0, 20),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30)

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
          onClick={() => fetchAll(true)}
          disabled={loading || !canFetch}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {!canFetch && (
        <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">
          No card details available — market data unavailable.
        </p>
      )}

      {/* ── Current Value ─────────────────────────────────────────────────────── */}
      {combinedValue != null && (
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Estimated Market Value
          </p>

          {/* Main combined estimate */}
          <div className="flex items-end gap-6">
            <div>
              <p className="text-3xl font-bold text-[#14314F]">${combinedValue.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {[chValue != null && 'Card Hedger', ebayValue != null && 'eBay comps'].filter(Boolean).join(' + ')} · trimmed median{isGraded && gradeLabel ? ` · ${gradeLabel}` : ' · raw'}
              </p>
            </div>
          </div>

          {/* Source breakdown */}
          <div className="flex gap-4 pt-1">
            {chValue != null && (
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Card Hedger</p>
                <p className="text-lg font-semibold text-[#14314F]">${chValue.toFixed(2)}</p>
              </div>
            )}
            {ebayValue != null && (
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">eBay Sold</p>
                <p className="text-lg font-semibold text-[#14314F]">${ebayValue.toFixed(2)}</p>
              </div>
            )}
          </div>

          {costBasis > 0 && (
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">vs. your cost (${costBasis.toFixed(2)})</span>
              <PLBadge current={combinedValue} cost={costBasis} />
            </div>
          )}

          {lastFetched && (
            <p className="text-xs text-gray-400">
              Updated {new Date(lastFetched).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* ── Price History Chart ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
          <BarChart2 className="w-3 h-3" /> Price History (Card Hedger)
        </p>
        {history.length > 1 ? (
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
                  type="monotone" dataKey="price" stroke="#14314F"
                  strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#47682d' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400">
              {loading ? 'Loading price history…' : 'No price history available yet.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Recent Sales (merged) ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Recent Sales
        </p>
        {allSales.length > 0 ? (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Grade</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Source</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allSales.map((sale, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-600 text-xs">
                      {sale.date ? new Date(sale.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {sale.grade
                        ? <Badge variant="outline" className="text-xs">{sale.grade}</Badge>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {sale.url ? (
                        <a
                          href={sale.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          {sale.source}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">{sale.source}</span>
                      )}
                    </td>
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
              {loading ? 'Loading recent sales…' : 'No recent sales data available.'}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
