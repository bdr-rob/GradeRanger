import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus,
  RefreshCw, Loader2, DollarSign, BarChart2, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { getCardHedgeMarketPrice, CardHedgePrice } from '@/lib/cardhedge'

interface PricePoint { date: string; price: number }

interface Props {
  card: any
  valuation?: any   // kept for caller compatibility; not used
  costBasis?: number
  gradedValues?: any // kept for caller compatibility; not used
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

export default function MarketValuePanel({ card, costBasis = 0 }: Props) {
  const { toast } = useToast()
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [history, setHistory]           = useState<PricePoint[] | null>(null)
  const [sales, setSales]               = useState<CardHedgePrice[] | null>(null)
  const [loading, setLoading]           = useState(false)
  const [lastFetched, setLastFetched]   = useState<string | null>(null)

  const cardHedgeId = card?.cardhedge_card_id ?? null
  const cardQuery   = [card?.year, card?.player_name, card?.card_name, card?.set_name]
    .filter(Boolean).join(' ').trim()
  const canFetch = !!(cardHedgeId || cardQuery)

  async function fetchMarketData(force = false) {
    if (!canFetch) return
    setLoading(true)
    try {
      const params = cardHedgeId ? { cardHedgeId } : { query: cardQuery }
      const { prices, marketValue } = await getCardHedgeMarketPrice(params)

      setCurrentPrice(marketValue)

      // Build chart history from price data (sorted oldest → newest)
      const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date))
      setHistory(sorted.map((p) => ({ date: p.date, price: p.price })))
      setSales(prices.slice(0, 20))
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
    fetchMarketData()
  }, [cardHedgeId, cardQuery])

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

      {/* ── Current Value ────────────────────────────────────────────────────── */}
      {currentPrice != null && (
        <div className="bg-gray-50 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Current Market Value
          </p>
          <div className="flex items-end gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Est. Value</p>
              <p className="text-3xl font-bold text-[#14314F]">${currentPrice.toFixed(2)}</p>
            </div>
          </div>

          {costBasis > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                vs. your cost (${costBasis.toFixed(2)})
              </span>
              <PLBadge current={currentPrice} cost={costBasis} />
            </div>
          )}

          {lastFetched && (
            <p className="text-xs text-gray-400 mt-2">
              Source: Card Hedger · Updated {new Date(lastFetched).toLocaleDateString()}
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
                : canFetch
                ? 'Price history not yet available from Card Hedger for this card.'
                : 'No card details to look up pricing for.'}
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
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Grade</th>
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
                        : <span className="text-gray-300">—</span>}
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
              {loading
                ? 'Loading recent sales…'
                : canFetch
                ? 'No recent sales data available from Card Hedger for this card.'
                : 'No card details to look up sales for.'}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
