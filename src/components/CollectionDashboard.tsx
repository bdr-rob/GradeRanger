import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ScanLine, Download, TrendingUp, TrendingDown, Minus, Package, LayoutGrid, List } from 'lucide-react';
import type { Card, Purchase, AIReport, MarketValuation, CardStatus } from '@/types/cards';
import { STATUS_LABELS, STATUS_COLORS } from '@/types/cards';

interface CardRow extends Card {
  purchases?: Purchase;
  ai_reports?: AIReport;
  market_valuations?: MarketValuation;
}

interface Summary {
  total: number;
  costBasis: number;
  estimatedValue: number;
  realizedProfit: number;
  byStatus: Record<string, number>;
}

function PLIndicator({ value }: { value: number }) {
  if (value > 0) return <span className="text-green-600 font-semibold flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+${value.toFixed(2)}</span>;
  if (value < 0) return <span className="text-red-500 font-semibold flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />${value.toFixed(2)}</span>;
  return <span className="text-gray-400 flex items-center gap-0.5"><Minus className="h-3 w-3" />$0.00</span>;
}

// Checks both image columns — fixes missing thumbnails
function CardThumbnail({ card, size = 'sm' }: { card: CardRow; size?: 'sm' | 'lg' }) {
  const url = (card as any).front_image_url ?? card.image_front_url ?? null;
  const dim = size === 'lg' ? 'w-16 h-20' : 'w-10 h-12';
  if (url) {
    return <img src={url} alt={card.card_name} className={`${dim} object-contain rounded border bg-gray-50 shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded border bg-gray-100 flex items-center justify-center shrink-0`}>
      <Package className={`${size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'} text-gray-300`} />
    </div>
  );
}

function exportToCSV(cards: CardRow[]) {
  const rows = [
    ['ID', 'Name', 'Player', 'Year', 'Set', 'Card #', 'Status', 'Cost', 'Est. Value', 'P&L'],
    ...cards.map((c) => {
      const cost = (c as any).purchase_price ?? c.purchases?.cost_basis ?? 0;
      const estVal = c.market_valuations?.raw_median ?? 0;
      return [
        c.internal_card_id ?? c.id,
        c.card_name,
        c.player_name ?? '',
        c.year ?? '',
        c.set_name ?? (c as any).card_set ?? '',
        c.card_number ?? '',
        STATUS_LABELS[c.status],
        cost.toFixed(2),
        estVal.toFixed(2),
        (estVal - cost).toFixed(2),
      ];
    }),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gradranger-collection-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CollectionDashboard() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CardStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'pl'>('date');
  const [view, setView] = useState<'table' | 'grid'>('table');

  const loadCards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cards')
      .select('*, purchases(*), ai_reports(*), market_valuations(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as CardRow[];
    setCards(rows);

    const totalCost = rows.reduce((sum, c) => sum + ((c as any).purchase_price ?? c.purchases?.cost_basis ?? 0), 0);
    const totalValue = rows.reduce((sum, c) => sum + (c.market_valuations?.raw_median ?? 0), 0);
    const byStatus: Record<string, number> = {};
    rows.forEach((c) => { byStatus[c.status] = (byStatus[c.status] ?? 0) + 1; });

    setSummary({ total: rows.length, costBasis: totalCost, estimatedValue: totalValue, realizedProfit: 0, byStatus });
    setLoading(false);
  }, [user]);

  useEffect(() => { loadCards(); }, [loadCards]);

  // Real-time: cards appear automatically after scanning
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('collection-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cards',
        filter: `user_id=eq.${user.id}`,
      }, () => { loadCards(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadCards]);

  const filtered = cards
    .filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q
        || c.card_name.toLowerCase().includes(q)
        || (c.player_name ?? '').toLowerCase().includes(q)
        || (c.set_name ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'value') return (b.market_valuations?.raw_median ?? 0) - (a.market_valuations?.raw_median ?? 0);
      if (sortBy === 'pl') {
        const plA = (a.market_valuations?.raw_median ?? 0) - ((a as any).purchase_price ?? a.purchases?.cost_basis ?? 0);
        const plB = (b.market_valuations?.raw_median ?? 0) - ((b as any).purchase_price ?? b.purchases?.cost_basis ?? 0);
        return plB - plA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const STATUS_ORDER: CardStatus[] = ['intake', 'collection', 'grading', 'listed', 'sold', 'cancelled'];

  return (
    <div className="space-y-6">
      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total cards', value: summary.total.toString() },
            { label: 'Cost basis', value: `$${summary.costBasis.toFixed(2)}` },
            { label: 'Est. portfolio value', value: `$${summary.estimatedValue.toFixed(2)}` },
            { label: 'Realized profit', value: `$${summary.realizedProfit.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-[#14314F] mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status pills */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.filter((s) => summary.byStatus[s]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                statusFilter === s ? STATUS_COLORS[s] + ' border-transparent' : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {STATUS_LABELS[s]}
              <span className="bg-white/60 rounded-full px-1.5 py-0.5 font-bold">{summary.byStatus[s]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <Input
          placeholder="Search cards…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date added</SelectItem>
            <SelectItem value="value">Est. value</SelectItem>
            <SelectItem value="pl">P&L</SelectItem>
          </SelectContent>
        </Select>
        {/* Grid / Table toggle */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-2 transition-colors ${view === 'table' ? 'bg-[#14314F] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-2 transition-colors ${view === 'grid' ? 'bg-[#14314F] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <Button asChild className="bg-[#47682d] hover:bg-[#47682d]/90 text-white shrink-0">
          <Link to="/portal/intake">
            <ScanLine className="h-4 w-4 mr-2" />Quick scan
          </Link>
        </Button>
        <Button variant="outline" onClick={() => exportToCSV(filtered)} disabled={filtered.length === 0} className="shrink-0">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading collection…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {cards.length === 0
              ? 'Your collection is empty. Add your first card with Quick Scan.'
              : 'No cards match your search.'}
          </p>
        </div>
      ) : view === 'table' ? (

        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs w-64">Card</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Set</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Year</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Predicted Grade</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">Est. Value</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((card) => {
                  const cost = (card as any).purchase_price ?? card.purchases?.cost_basis ?? 0;
                  const estVal = card.market_valuations?.raw_median ?? 0;
                  const pl = estVal - cost;
                  return (
                    <tr key={card.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <Link to={`/portal/cards/${card.id}`} className="flex items-center gap-3">
                          <CardThumbnail card={card} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-[#14314F] text-sm line-clamp-1 group-hover:underline">
                              {card.card_name}
                            </p>
                            {card.player_name && (
                              <p className="text-xs text-gray-400 truncate">{card.player_name}</p>
                            )}
                            {card.card_number && (
                              <p className="text-xs text-gray-400">#{card.card_number}</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">
                        {card.set_name ?? (card as any).card_set ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{card.year ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[card.status]}`}>
                          {STATUS_LABELS[card.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {card.ai_reports?.status === 'complete' && card.ai_reports.overall_grade != null ? (
                          <Badge className="bg-[#47682d] text-white text-xs">
                            {card.ai_reports.overall_grade.toFixed(1)}{card.ai_reports.condition_label ? ` · ${card.ai_reports.condition_label}` : ''}
                          </Badge>
                        ) : card.ai_reports?.status === 'processing' || card.ai_reports?.status === 'pending' ? (
                          <span className="text-xs text-gray-400">Grading…</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        ${cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {estVal > 0 ? `$${estVal.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PLIndicator value={pl} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* ── GRID VIEW ── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => {
            const cost = (card as any).purchase_price ?? card.purchases?.cost_basis ?? 0;
            const estVal = card.market_valuations?.raw_median ?? 0;
            const pl = estVal - cost;
            return (
              <Link
                key={card.id}
                to={`/portal/cards/${card.id}`}
                className="bg-white rounded-xl border border-gray-200 p-3 hover:border-[#14314F]/30 hover:shadow-sm transition-all group"
              >
                <div className="flex gap-3">
                  <CardThumbnail card={card} size="lg" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-[#14314F] text-sm leading-tight group-hover:underline line-clamp-2">
                      {card.card_name}
                    </p>
                    {card.player_name && (
                      <p className="text-xs text-gray-500 truncate">{card.player_name}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`text-xs ${STATUS_COLORS[card.status]}`}>
                        {STATUS_LABELS[card.status]}
                      </Badge>
                      {card.ai_reports?.status === 'complete' && card.ai_reports.overall_grade != null && (
                        <Badge className="bg-[#47682d] text-white text-xs">
                          {card.ai_reports.overall_grade.toFixed(1)}{card.ai_reports.condition_label ? ` · ${card.ai_reports.condition_label}` : ''}
                        </Badge>
                      )}
                      {(card.ai_reports?.status === 'processing' || card.ai_reports?.status === 'pending') && (
                        <span className="text-xs text-gray-400">Grading…</span>
                      )}
                    </div>
                    <div className="flex justify-between items-end pt-1">
                      <div>
                        <p className="text-xs text-gray-400">Cost</p>
                        <p className="text-sm font-semibold text-gray-700">${cost.toFixed(2)}</p>
                      </div>
                      {estVal > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">P&L</p>
                          <PLIndicator value={pl} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}