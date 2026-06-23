import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Layers, Factory, CalendarDays, RefreshCw, Search, X, ListChecks, Download } from 'lucide-react';

interface CatalogStats {
  segments: { total: number; breakdown: { id: string; name: string; count: number }[] };
  manufacturers: { total: number; breakdown: { id: string; name: string; releaseCount: number }[] };
  releases: { total: number; bySegment: { segmentName: string; total: number }[] };
  sets: { total: number; identifiable: number };
  cards: { total: number; base: number; variations: number; parallels: number };
  parallels: { total: number; fullSet: number; partial: number };
}

interface CatalogSetRow {
  id: string;
  name: string;
  is_identifiable: boolean;
  card_count: number | null;
  parallel_count: number | null;
  release_id: string | null;
  release_name: string | null;
  release_year: string | null;
}

interface ChecklistCard {
  id: string;
  number?: string;
  name: string;
  setName?: string;
  attributes?: string[];
  parallels?: { id: string; name: string }[];
}

interface CardDetail {
  id: string;
  name: string;
  number?: string;
  description?: string;
  numberedTo?: number;
  parallelCount?: number;
  variationOf?: string;
  fields?: { key: string; value: string }[];
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface GlobalSearchResult {
  type: string;
  id: string;
  name: string;
  year?: string;
  setName?: string;
  releaseName?: string;
  manufacturerName?: string;
  parallelName?: string;
}

const PAGE_SIZE = 25;
const SYNC_TARGETS = ['sync_sets', 'sync_manufacturers', 'sync_releases'] as const;

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
          {icon} {label}
        </div>
        <p className="text-2xl font-bold text-[#14314F]">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Catalog() {
  const { toast } = useToast();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CatalogSetRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[] | null>(null);
  const [globalSearching, setGlobalSearching] = useState(false);

  const [segmentFilter, setSegmentFilter] = useState<{ id: string; name: string } | null>(null);

  const [checklist, setChecklist] = useState<{ setName: string; cards: ChecklistCard[] } | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);

  const [cardDetail, setCardDetail] = useState<CardDetail | null>(null);
  const [cardDetailLoading, setCardDetailLoading] = useState(false);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cardsight-catalog', {
        body: { action: 'stats' },
      });
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Catalog stats error:', err);
      toast({ title: 'Could not load catalog statistics', variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadRows() {
    setRowsLoading(true);
    try {
      const baseSelect = 'id, name, is_identifiable, card_count, parallel_count, release_id, release_name, release_year';

      // catalog_sets doesn't carry segment directly — when filtering by
      // segment, embed catalog_releases via its FK and let PostgREST do a
      // real SQL join, rather than fetching every matching release_id
      // client-side and passing a (potentially huge) list to .in(...).
      let query = segmentFilter
        ? supabase.from('catalog_sets').select(`${baseSelect}, catalog_releases!inner(segment_id)`, { count: 'exact' }).eq('catalog_releases.segment_id', segmentFilter.id)
        : supabase.from('catalog_sets').select(baseSelect, { count: 'exact' });

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,release_name.ilike.%${search.trim()}%`);
      }

      const { data, error, count } = await query
        .order('release_year', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (error) throw error;
      setRows((data ?? []) as unknown as CatalogSetRow[]);
      setRowsTotal(count ?? 0);
    } catch (err) {
      console.error('Catalog sets fetch error:', err);
      toast({ title: 'Could not load catalog sets', variant: 'destructive' });
      setRows([]);
      setRowsTotal(0);
    } finally {
      setRowsLoading(false);
    }
  }

  async function openChecklist(row: CatalogSetRow) {
    if (!row.release_id) {
      toast({ title: 'No release on file for this set', variant: 'destructive' });
      return;
    }
    setChecklistLoading(true);
    setChecklist({ setName: row.name, cards: [] });
    try {
      const { data, error } = await supabase.functions.invoke('cardsight-catalog', {
        body: { action: 'release_detail', release_id: row.release_id },
      });
      if (error) throw error;
      const cards: ChecklistCard[] = (data.cards ?? [])
        .filter((c: any) => c.setName === row.name)
        .map((c: any) => ({
          id: c.id, number: c.number, name: c.name, setName: c.setName,
          attributes: c.attributes ?? [], parallels: c.parallels ?? [],
        }));
      setChecklist({ setName: row.name, cards });
    } catch (err) {
      console.error('Checklist fetch error:', err);
      toast({ title: 'Could not load checklist', variant: 'destructive' });
      setChecklist(null);
    } finally {
      setChecklistLoading(false);
    }
  }

  function exportChecklist() {
    if (!checklist) return;
    const rows: (string | number)[][] = [
      ['Number', 'Name', 'Attributes', 'Parallels'],
      ...checklist.cards.map((c) => [
        c.number ?? '',
        c.name,
        (c.attributes ?? []).join('; '),
        (c.parallels ?? []).map((p) => p.name).join('; '),
      ]),
    ];
    downloadCsv(`${checklist.setName.replace(/[^a-z0-9]+/gi, '_')}_checklist.csv`, rows);
  }

  async function openCardDetail(card: ChecklistCard) {
    setCardDetailLoading(true);
    setCardDetail({ id: card.id, name: card.name, number: card.number });
    try {
      const { data, error } = await supabase.functions.invoke('cardsight-catalog', {
        body: { action: 'card_detail', card_id: card.id },
      });
      if (error) throw error;
      const d = data.card;
      setCardDetail({
        id: d.id, name: d.name, number: d.number, description: d.description,
        numberedTo: d.numberedTo, parallelCount: d.parallelCount, variationOf: d.variationOf,
        fields: d.fields ?? [],
      });
    } catch (err) {
      console.error('Card detail fetch error:', err);
      toast({ title: 'Could not load card detail', variant: 'destructive' });
      setCardDetail(null);
    } finally {
      setCardDetailLoading(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    try {
      for (const action of SYNC_TARGETS) {
        const label = action.replace('sync_', '');
        let startSkip = 0;
        let totalSynced = 0;
        // Chunked — each call only walks ~4k rows to stay under the function timeout.
        while (true) {
          setSyncStatus(`Syncing ${label}${totalSynced ? ` (${totalSynced})` : ''}…`);
          const { data, error } = await supabase.functions.invoke('cardsight-catalog', {
            body: { action, start_skip: startSkip },
          });
          if (error) throw error;
          totalSynced += data.synced ?? 0;
          if (data.done) break;
          startSkip = data.nextSkip;
        }
      }
      toast({ title: 'Catalog synced' });
      loadRows();
    } catch (err) {
      console.error('Catalog sync error:', err);
      toast({ title: 'Catalog sync failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
      setSyncStatus(null);
    }
  }

  async function runGlobalSearch(q: string) {
    if (!q.trim()) { setGlobalResults(null); return; }
    setGlobalSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('cardsight-catalog', {
        body: { action: 'search', q: q.trim(), take: 15 },
      });
      if (error) throw error;
      setGlobalResults(data.results ?? []);
    } catch (err) {
      console.error('Catalog search error:', err);
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setGlobalSearching(false);
    }
  }

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    const t = setTimeout(loadRows, 250); // debounce search
    return () => clearTimeout(t);
  }, [search, page, segmentFilter]);
  useEffect(() => {
    const t = setTimeout(() => runGlobalSearch(globalQuery), 350); // debounce — search may hit CardSight live
    return () => clearTimeout(t);
  }, [globalQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#14314F]">Catalog</h1>
          <p className="text-sm text-gray-400 mt-1">
            What CardSight can identify — browse coverage before you scan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runSync} disabled={syncing}>
          {syncing
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {syncStatus ?? 'Syncing…'}</>
            : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync from CardSight</>}
        </Button>
      </div>

      {/* ── Global search ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Search everything</CardTitle>
          <p className="text-xs text-gray-400">
            Cards, sets, releases, manufacturers, and parallels — checks the local catalog first, falls back to CardSight for card-level matches.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder='Try "aaron judge topps", "1952 mickey mantle", or "refractor"…'
              className="h-9 pl-8 text-sm"
            />
            {globalSearching && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
          </div>
          {globalResults && globalResults.length > 0 && (
            <div className="space-y-1">
              {globalResults.map((r) => (
                <div key={`${r.type}-${r.id}`} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">
                  <div>
                    <span className="font-medium text-[#14314F]">{r.name}</span>
                    {r.parallelName && <Badge variant="outline" className="ml-2 text-xs">{r.parallelName}</Badge>}
                    <span className="text-gray-400 ml-2">
                      {[r.year, r.setName, r.releaseName, r.manufacturerName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize text-gray-400">{r.type}</Badge>
                </div>
              ))}
            </div>
          )}
          {globalResults && globalResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No matches.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog statistics…
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Layers className="w-3.5 h-3.5" />} label="Segments" value={stats.segments.total} />
          <StatCard icon={<Factory className="w-3.5 h-3.5" />} label="Manufacturers" value={stats.manufacturers.total} />
          <StatCard
            icon={<CalendarDays className="w-3.5 h-3.5" />}
            label="Sets"
            value={stats.sets.total.toLocaleString()}
            sub={`${stats.sets.identifiable.toLocaleString()} identifiable`}
          />
          <StatCard
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Cards"
            value={stats.cards.total.toLocaleString()}
            sub={`${stats.cards.base.toLocaleString()} base · ${stats.cards.parallels.toLocaleString()} parallels`}
          />
        </div>
      ) : null}

      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Segments by card count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              {stats.segments.breakdown
                .filter((s) => s.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setPage(0); setSegmentFilter({ id: s.id, name: s.name }); }}
                    className={`flex items-center justify-between rounded px-1.5 py-0.5 -mx-1.5 transition-colors ${
                      segmentFilter?.id === s.id ? 'bg-[#14314F]/10' : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-gray-600">{s.name}</span>
                    <span className="font-semibold text-[#14314F]">{s.count.toLocaleString()}</span>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Set browser ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-gray-500">Browse sets</CardTitle>
              {segmentFilter && (
                <Badge variant="outline" className="text-xs gap-1 pr-1">
                  {segmentFilter.name}
                  <button onClick={() => { setPage(0); setSegmentFilter(null); }} className="hover:text-gray-700">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => { setPage(0); setSearch(e.target.value); }}
                placeholder="Search set or release name…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !rowsLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {rowsTotal === 0 && !search
                ? 'No sets synced yet — click "Sync from CardSight" above.'
                : 'No sets match your search.'}
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Release</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Set</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Year</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Cards</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Parallels</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Identifiable</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-gray-600">{row.release_name ?? '—'}</td>
                      <td className="px-4 py-2 font-medium text-[#14314F]">{row.name}</td>
                      <td className="px-4 py-2 text-gray-500">{row.release_year ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{row.card_count ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{row.parallel_count ?? '—'}</td>
                      <td className="px-4 py-2 text-right">
                        {row.is_identifiable
                          ? <Badge className="bg-[#47682d] text-white text-xs">Yes</Badge>
                          : <Badge variant="outline" className="text-xs text-gray-400">No</Badge>}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => openChecklist(row)}
                          title="View checklist"
                          className="text-gray-400 hover:text-[#14314F]"
                        >
                          <ListChecks className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rowsTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowsTotal)} of {rowsTotal.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= rowsTotal}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!checklist} onOpenChange={(open) => !open && setChecklist(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{checklist?.setName ?? 'Checklist'}</DialogTitle>
              {checklist && checklist.cards.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportChecklist} className="h-7 text-xs">
                  <Download className="w-3 h-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>
          </DialogHeader>
          {checklistLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading checklist…
            </div>
          ) : checklist && checklist.cards.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {checklist.cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCardDetail(c)}
                  className="w-full text-left py-1.5 hover:bg-gray-50 rounded px-1.5 -mx-1.5"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 w-10 shrink-0">{c.number ?? '—'}</span>
                    <span className="text-[#14314F]">{c.name}</span>
                  </div>
                  {((c.attributes?.length ?? 0) > 0 || (c.parallels?.length ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1 pl-10">
                      {c.parallels?.map((p) => (
                        <Badge key={p.id} className="bg-[#47682d] text-white text-[10px] px-1.5 py-0">{p.name}</Badge>
                      ))}
                      {c.attributes?.slice(0, 4).map((a) => (
                        <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400">{a}</Badge>
                      ))}
                      {(c.attributes?.length ?? 0) > 4 && (
                        <span className="text-[10px] text-gray-400">+{c.attributes!.length - 4} more</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No cards found for this set.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!cardDetail} onOpenChange={(open) => !open && setCardDetail(null)}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cardDetail?.number ? `#${cardDetail.number} ` : ''}{cardDetail?.name}</DialogTitle>
          </DialogHeader>
          {cardDetailLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading card detail…
            </div>
          ) : cardDetail ? (
            <div className="space-y-3 text-sm">
              {cardDetail.description && <p className="text-gray-600">{cardDetail.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {cardDetail.parallelCount != null && (
                  <div><span className="text-gray-400">Parallels</span><p className="font-medium text-[#14314F]">{cardDetail.parallelCount}</p></div>
                )}
                {cardDetail.numberedTo != null && (
                  <div><span className="text-gray-400">Numbered to</span><p className="font-medium text-[#14314F]">{cardDetail.numberedTo}</p></div>
                )}
              </div>
              {cardDetail.fields && cardDetail.fields.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  {cardDetail.fields.map((f) => (
                    <div key={f.key} className="flex justify-between text-xs">
                      <span className="text-gray-400">{f.key}</span>
                      <span className="text-gray-600">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
