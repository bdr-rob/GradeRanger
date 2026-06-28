import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Minus, Loader2,
  DollarSign, BarChart2, Package, CheckCircle2, X,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLightbox } from '@/contexts/LightboxContext'
import AIReportViewer from '@/components/AIReportViewer'
import type { AIReport } from '@/types/cards'

interface CardRow {
  id: string
  player_name: string
  card_name: string | null
  year: string | null
  set_name: string | null
  status: string
  purchase_price: number | null
  market_value: number | null
  is_graded: boolean | null
  grading_company: string | null
  official_grade: string | null
  [key: string]: any
}

interface Snapshot {
  snapshot_date: string
  total_value: number
  total_cost: number
  card_count: number
}

function GradeBadge({ grade, onClick }: { grade: number; onClick: (e: React.MouseEvent) => void }) {
  const color =
    grade >= 9 ? '#22c55e' :
    grade >= 8 ? '#47682d' :
    grade >= 7 ? '#f59e0b' : '#ef4444'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      title="View AI grade report"
      className="flex items-center justify-center shrink-0 hover:scale-110 transition-transform"
    >
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle cx="18" cy="18" r="16" fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(grade / 10) * 100} 100`}
          transform="rotate(-90 18 18)"
          pathLength="100"
        />
        <text x="18" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
          {grade % 1 === 0 ? grade : grade.toFixed(1)}
        </text>
      </svg>
    </button>
  )
}

function fmt(n: number) { return '$' + Math.abs(n).toFixed(2) }

function PLCell({ value, cost }: { value: number | null; cost: number | null }) {
  if (value == null || cost == null || cost === 0) return <span className="text-gray-300">--</span>
  const diff = value - cost
  const pct  = ((diff / cost) * 100).toFixed(1)
  if (diff > 0) return (
    <span className="text-green-600 font-medium text-sm flex items-center gap-1 justify-end">
      <TrendingUp className="w-3 h-3" /> +{fmt(diff)} ({pct}%)
    </span>
  )
  if (diff < 0) return (
    <span className="text-red-500 font-medium text-sm flex items-center gap-1 justify-end">
      <TrendingDown className="w-3 h-3" /> -{fmt(diff)} ({pct}%)
    </span>
  )
  return <span className="text-gray-400 text-sm flex items-center gap-1 justify-end"><Minus className="w-3 h-3" /> $0.00</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    intake:     'bg-blue-50 text-blue-700',
    grading:    'bg-amber-50 text-amber-700',
    collection: 'bg-purple-50 text-purple-700',
    listed:     'bg-green-50 text-green-700',
    sold:       'bg-gray-100 text-gray-500',
  }
  return (
    <span className={'text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ' + (map[status] ?? 'bg-gray-100 text-gray-500')}>
      {status}
    </span>
  )
}

function StatCard({
  label, icon, value, sub, valueColor = 'text-[#14314F]',
}: { label: string; icon: React.ReactNode; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-white rounded-xl border px-5 py-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">{icon}{label}</div>
      <p className={'text-2xl font-bold ' + valueColor}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function CardTable({
  cards, onThumbClick, showStatus, onRowClick, aiReports, onGradeClick,
}: {
  cards: CardRow[]
  onThumbClick: (card: CardRow, e: React.MouseEvent) => void
  showStatus: boolean
  onRowClick: (card: CardRow) => void
  aiReports: Record<string, AIReport>
  onGradeClick: (report: AIReport) => void
}) {
  if (cards.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No cards yet.</div>
  }
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-12"></th>
            <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Card</th>
            {showStatus && <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>}
            <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">AI Grade</th>
            <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Cost</th>
            <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Value</th>
            <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">P&amp;L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {cards.map((card) => {
            const c = card as any
            const imgUrl = c.image_front_url || c.front_image_url || c.image_url || null
            const displayName = card.player_name +
              (card.card_name && card.card_name !== card.player_name ? ' - ' + card.card_name : '')
            const subtitle = [card.year, card.set_name].filter(Boolean).join(' · ') +
              (card.is_graded && card.grading_company && card.official_grade
                ? ' - ' + card.grading_company + ' ' + card.official_grade : '')
            return (
              <tr key={card.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onRowClick(card)}>
                <td className="px-4 py-2">
                  {imgUrl ? (
                    <div
                      className="w-8 h-10 rounded overflow-hidden cursor-pointer shrink-0"
                      onClick={(e) => { e.stopPropagation(); onThumbClick(card, e) }}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-10 rounded bg-gray-100 shrink-0" />
                  )}
                </td>
                <td className="px-4 py-2">
                  <p className="font-medium text-[#14314F] leading-tight">{displayName}</p>
                  {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                </td>
                {showStatus && (
                  <td className="px-4 py-2">
                    <StatusBadge status={card.status} />
                  </td>
                )}
                <td className="px-4 py-2 text-center">
                  {aiReports[card.id]?.overall_grade != null ? (
                    <div className="flex justify-center">
                      <GradeBadge
                        grade={aiReports[card.id].overall_grade as number}
                        onClick={() => onGradeClick(aiReports[card.id])}
                      />
                    </div>
                  ) : (
                    <span className="text-gray-200 text-xs">--</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {card.purchase_price != null ? '$' + card.purchase_price.toFixed(2) : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-[#14314F]">
                  {card.market_value != null ? '$' + card.market_value.toFixed(2) : <span className="text-gray-300 font-normal">--</span>}
                </td>
                <td className="px-4 py-2">
                  <PLCell value={card.market_value} cost={card.purchase_price} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function PortalPortfolio() {
  const { user } = useAuth()
  const { open: openLightbox } = useLightbox()
  const navigate = useNavigate()

  const [holdings,   setHoldings]   = useState<CardRow[]>([])
  const [soldCards,  setSoldCards]  = useState<CardRow[]>([])
  const [snapshots,  setSnapshots]  = useState<Snapshot[]>([])
  const [aiReports,  setAiReports]  = useState<Record<string, AIReport>>({})
  const [activeReport, setActiveReport] = useState<AIReport | null>(null)
  const [loading,    setLoading]    = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [holdingsRes, soldRes, snapshotsRes] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', user.id).neq('status', 'sold').order('created_at', { ascending: false }),
        supabase.from('cards').select('*').eq('user_id', user.id).eq('status', 'sold').order('updated_at', { ascending: false }),
        supabase.from('portfolio_snapshots').select('snapshot_date,total_value,total_cost,card_count').eq('user_id', user.id).order('snapshot_date', { ascending: true }),
      ])
      if (holdingsRes.data)  setHoldings(holdingsRes.data)
      if (soldRes.data)      setSoldCards(soldRes.data)
      if (snapshotsRes.data) setSnapshots(snapshotsRes.data)

      // Fetch latest AI report per card
      const allCardIds = [
        ...(holdingsRes.data ?? []),
        ...(soldRes.data ?? []),
      ].map((c) => c.id)
      if (allCardIds.length > 0) {
        const { data: reports } = await supabase
          .from('ai_reports')
          .select('*')
          .in('card_id', allCardIds)
          .order('created_at', { ascending: false })
        // Keep only the most recent report per card
        const byCard: Record<string, AIReport> = {}
        for (const r of reports ?? []) {
          if (!byCard[r.card_id]) byCard[r.card_id] = r as AIReport
        }
        setAiReports(byCard)
      }

      await supabase.functions.invoke('portfolio-snapshot')
      const { data: fresh } = await supabase
        .from('portfolio_snapshots')
        .select('snapshot_date,total_value,total_cost,card_count')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
      if (fresh) setSnapshots(fresh)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const totalValue    = holdings.reduce((s, c) => s + (c.market_value ?? c.purchase_price ?? 0), 0)
  const totalCost     = holdings.reduce((s, c) => s + (c.purchase_price ?? 0), 0)
  const unrealizedPnL = totalValue - totalCost
  const pnlPct        = totalCost > 0 ? ((unrealizedPnL / totalCost) * 100).toFixed(1) : null
  const realizedGains = soldCards.reduce((s, c) =>
    s + ((c.market_value ?? c.purchase_price ?? 0) - (c.purchase_price ?? 0)), 0)

  const chartData = snapshots.map((s) => ({ date: s.snapshot_date, value: s.total_value, cost: s.total_cost }))

  function handleThumbClick(card: CardRow, e: React.MouseEvent) {
    const c = card as any
    const url = c.image_front_url || c.front_image_url || c.image_url || null
    if (!url) return
    e.stopPropagation()
    const name = card.player_name +
      (card.card_name && card.card_name !== card.player_name ? ' - ' + card.card_name : '')
    openLightbox({ src: url, alt: name })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Portfolio</h2>
        <p className="text-gray-500 text-sm mt-0.5">Track your collection value over time</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Value" icon={<DollarSign className="w-4 h-4 text-[#47682d]" />} value={'$' + totalValue.toFixed(2)} />
        <StatCard label="Cost Basis"  icon={<Package    className="w-4 h-4 text-gray-400"   />} value={'$' + totalCost.toFixed(2)} />
        <StatCard
          label="Unrealized P&L"
          icon={unrealizedPnL >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          value={(unrealizedPnL >= 0 ? '+$' : '-$') + Math.abs(unrealizedPnL).toFixed(2)}
          sub={pnlPct ? pnlPct + '%' : undefined}
          valueColor={unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-500'}
        />
        <StatCard
          label="Holdings"
          icon={<BarChart2 className="w-4 h-4 text-blue-400" />}
          value={holdings.length + ' cards'}
          sub={soldCards.length > 0 ? soldCards.length + ' sold' : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border p-5">
        <p className="text-sm font-semibold text-[#14314F] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#47682d]" /> Portfolio Value Over Time
        </p>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v) => { try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return v } }}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => '$' + v} width={60} />
              <Tooltip
                formatter={(value: number, name: string) => ['$' + (value as number).toFixed(2), name === 'value' ? 'Market Value' : 'Cost Basis']}
                labelFormatter={(l) => { try { return new Date(l).toLocaleDateString() } catch { return l } }}
              />
              <Line type="monotone" dataKey="value" stroke="#14314F" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#47682d' }} name="value" />
              <Line type="monotone" dataKey="cost"  stroke="#d1d5db" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="cost" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <CheckCircle2 className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Snapshot saved for today.</p>
            <p className="text-xs text-gray-400 mt-1">Visit again tomorrow to see your portfolio trend.</p>
          </div>
        )}
      </div>

      <Tabs defaultValue="holdings">
        <TabsList>
          <TabsTrigger value="holdings">Holdings ({holdings.length})</TabsTrigger>
          <TabsTrigger value="sold">Sold ({soldCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <CardTable cards={holdings} onThumbClick={handleThumbClick} showStatus onRowClick={(c) => navigate('/portal/cards/' + c.id)} aiReports={aiReports} onGradeClick={setActiveReport} />
        </TabsContent>

        <TabsContent value="sold">
          {soldCards.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No sold cards yet.</div>
          ) : (
            <>
              {realizedGains !== 0 && (
                <div className={'mb-4 px-4 py-3 rounded-lg text-sm font-medium ' + (realizedGains >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                  Realized gains (est.): {realizedGains >= 0 ? '+' : '-'}{'$' + Math.abs(realizedGains).toFixed(2)}
                  <span className="font-normal text-xs ml-2 opacity-70">based on stored market value at time of sale</span>
                </div>
              )}
              <CardTable cards={soldCards} onThumbClick={handleThumbClick} showStatus={false} onRowClick={(c) => navigate('/portal/cards/' + c.id)} aiReports={aiReports} onGradeClick={setActiveReport} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Report modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActiveReport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-[#14314F]">AI Grade Report</h3>
              <button onClick={() => setActiveReport(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <AIReportViewer report={activeReport} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
