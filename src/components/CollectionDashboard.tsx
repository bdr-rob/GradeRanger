import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ScanLine, Download, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';
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

function exportToCSV(cards: CardRow[]) {
  const rows = [
    ['ID', 'Name', 'Player', 'Year', 'Set', 'Status', 'Cost Basis', 'Estimated Value'],
    ...cards.map((c) => [
      c.internal_card_id ?? c.id,
      c.card_name,
      c.player_name ?? '',
      c.year ?? '',
      c.set_name ?? '',
      STATUS_LABELS[c.status],
      c.purchases?.cost_basis?.toFixed(2) ?? '0',
      c.market_valuations?.raw_median?.toFixed(2) ?? '0',
    ]),
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

  const loadCards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cards')
      .select('*, purchases(*), ai_reports(*), market_valuations(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as CardRow[];
    setCards(rows);

    // Compute summary
    const totalCost = rows.reduce((sum, c) => sum + (c.purchases?.cost_basis ?? 0), 0);
    const totalValue = rows.reduce((sum, c) => sum + (c.market_valuations?.raw_median ?? 0), 0);

    const byStatus: Record<string, number> = {};
    rows.forEach((c) => { byStatus[c.status] = (byStatus[c.status] ?? 0) + 1; });

    setSummary({
      total: rows.length,
      costBasis: totalCost,
      estimatedValue: totalValue,
      realizedProfit: 0, // TODO: sum from transactions
      byStatus,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const filtered = cards
    .filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q || c.card_name.toLowerCase().includes(q) || (c.player_name ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'value') return (b.market_valuations?.raw_median ?? 0) - (a.market_valuations?.raw_median ?? 0);
      if (sortBy === 'pl') {
        const plA = (a.market_valuations?.raw_median ?? 0) - (a.purchases?.cost_basis ?? 0);
        const plB = (b.market_valuations?.raw_median ?? 0) - (b.purchases?.cost_basis ?? 0);
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

      {/* Status breakdown */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.filter((s) => summary.byStatus[s]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${statusFilter === s ? STATUS_COLORS[s] + ' border-transparent' : 'bg-white border-gray-200 text-gray-600'}`}
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
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date added</SelectItem>
            <SelectItem value="value">Est. value</SelectItem>
            <SelectItem value="pl">P&amp;L</SelectItem>
          </SelectContent>
        </Select>
        <Button asChild className="bg-[#47682d] hover:bg-[#47682d]/90 text-white shrink-0">
          <Link to="/portal/intake">
            <ScanLine className="h-4 w-4 mr-2" />
            Quick scan
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => exportToCSV(filtered)}
          disabled={filtered.length === 0}
          className="shrink-0"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Card grid */}
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => {
            const costBasis = card.purchases?.cost_basis ?? 0;
            const estValue = card.market_valuations?.raw_median ?? 0;
            const pl = estValue - costBasis;

            return (
              <Link
                key={card.id}
                to={`/portal/cards/${card.id}`}
                className="bg-white rounded-xl border border-gray-200 p-3 hover:border-[#14314F]/30 hover:shadow-sm transition-all group"
              >
                <div className="flex gap-3">
                  {card.image_front_url ? (
                    <img
                      src={card.image_front_url}
                      alt={card.card_name}
                      className="w-16 h-20 object-contain rounded-lg border bg-gray-50 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-20 rounded-lg border bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-[#14314F] text-sm leading-tight group-hover:underline line-clamp-2">
                      {card.card_name}
                    </p>
                    {card.player_name && (
                      <p className="text-xs text-gray-500 truncate">{card.player_name}</p>
                    )}
                    <Badge className={`text-xs ${STATUS_COLORS[card.status]}`}>
                      {STATUS_LABELS[card.status]}
                    </Badge>
                    <div className="flex justify-between items-end pt-1">
                      <div>
                        <p className="text-xs text-gray-400">Cost</p>
                        <p className="text-sm font-semibold text-gray-700">${costBasis.toFixed(2)}</p>
                      </div>
                      {estValue > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">P&amp;L</p>
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
