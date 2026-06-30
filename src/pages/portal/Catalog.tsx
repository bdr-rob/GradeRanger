import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Search, X, ListChecks, Download, CalendarDays, Layers, Hash,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'tcg' | 'sports';

interface TcgSet {
  id: string;
  game_name: string;
  game_slug: string;
  name: string;
  abbreviation: string | null;
  release_date: string | null;
  card_count: number | null;
  image_url: string | null;
}

interface SportsSet {
  id: string;
  name: string;
  year: string | null;
  category: string;
  image_url: string | null;
  sales_30day: number | null;
}

interface TcgCard {
  id: string;
  name: string;
  number: string | null;
  rarity: string | null;
  image_url: string | null;
}

interface SportsCard {
  id: string;
  player: string | null;
  number: string | null;
  variant: string | null;
  rookie: boolean | null;
  image_url: string | null;
  raw: any;
}

const PAGE_SIZE = 50;

const TCG_GAMES = [
  { slug: 'pokemon',             name: 'Pokemon' },
  { slug: 'magic',               name: 'Magic: The Gathering' },
  { slug: 'yugioh',              name: 'YuGiOh' },
  { slug: 'one-piece-card-game', name: 'One Piece' },
  { slug: 'lorcana-tcg',         name: 'Disney Lorcana' },
  { slug: 'digimon-card-game',   name: 'Digimon' },
];

const SPORTS_CATS = [
  'Baseball', 'Basketball', 'Football', 'Hockey',
  'Soccer', 'Golf', 'Tennis', 'UFC', 'Wrestling', 'Racing',
];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: filename,
  });
  a.click();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-[#14314F]">{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Catalog() {
  const { toast } = useToast();

  // Tab
  const [tab, setTab] = useState<Tab>('tcg');

  // TCG state
  const [tcgGame, setTcgGame]         = useState<string>('');
  const [tcgSearch, setTcgSearch]     = useState('');
  const [tcgSets, setTcgSets]         = useState<TcgSet[]>([]);
  const [tcgTotal, setTcgTotal]       = useState(0);
  const [tcgPage, setTcgPage]         = useState(0);
  const [tcgLoading, setTcgLoading]   = useState(false);

  // Sports state
  const [sportsCat, setSportsCat]         = useState<string>('');
  const [sportsSearch, setSportsSearch]   = useState('');
  const [sportsSets, setSportsSets]       = useState<SportsSet[]>([]);
  const [sportsTotal, setSportsTotal]     = useState(0);
  const [sportsPage, setSportsPage]       = useState(0);
  const [sportsLoading, setSportsLoading] = useState(false);

  // Stats
  const [tcgStats, setTcgStats]       = useState<{ sets: number; cards: number; games: number } | null>(null);
  const [sportsStats, setSportsStats] = useState<{ sets: number; cards: number } | null>(null);

  // Checklist dialog
  const [checklist, setChecklist]         = useState<{ name: string; type: Tab; setId: string } | null>(null);
  const [checklistCards, setChecklistCards] = useState<(TcgCard | SportsCard)[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  // ── Data fetchers ───────────────────────────────────────────────────────────

  const loadTcgStats = useCallback(async () => {
    const [{ count: sets }, { count: games }, { count: cards }] = await Promise.all([
      supabase.from('tcg_sets').select('*', { count: 'exact', head: true }),
      supabase.from('tcg_games').select('*', { count: 'exact', head: true }),
      supabase.from('tcg_cards').select('*', { count: 'exact', head: true }),
    ]);
    setTcgStats({ sets: sets ?? 0, games: games ?? 0, cards: cards ?? 0 });
  }, []);

  const loadSportsStats = useCallback(async () => {
    const [{ count: sets }, { count: cards }] = await Promise.all([
      supabase.from('ch_sets').select('*', { count: 'exact', head: true }),
      supabase.from('ch_cards').select('*', { count: 'exact', head: true }),
    ]);
    setSportsStats({ sets: sets ?? 0, cards: cards ?? 0 });
  }, []);

  const loadTcgSets = useCallback(async () => {
    setTcgLoading(true);
    try {
      let q = supabase.from('tcg_sets')
        .select('id, game_name, game_slug, name, abbreviation, release_date, card_count, image_url', { count: 'exact' });
      if (tcgGame) q = q.eq('game_slug', tcgGame);
      if (tcgSearch.trim()) q = q.ilike('name', `%${tcgSearch.trim()}%`);
      const { data, count, error } = await q
        .order('release_date', { ascending: false, nullsFirst: false })
        .range(tcgPage * PAGE_SIZE, tcgPage * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      setTcgSets((data ?? []) as TcgSet[]);
      setTcgTotal(count ?? 0);
    } catch (err) {
      toast({ title: 'Could not load TCG sets', variant: 'destructive' });
    } finally {
      setTcgLoading(false);
    }
  }, [tcgGame, tcgSearch, tcgPage, toast]);

  const loadSportsSets = useCallback(async () => {
    setSportsLoading(true);
    try {
      let q = supabase.from('ch_sets')
        .select('id, name, year, category, image_url, sales_30day', { count: 'exact' });
      if (sportsCat) q = q.eq('category', sportsCat);
      if (sportsSearch.trim()) q = q.ilike('name', `%${sportsSearch.trim()}%`);
      const { data, count, error } = await q
        .order('sales_30day', { ascending: false, nullsFirst: false })
        .range(sportsPage * PAGE_SIZE, sportsPage * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      setSportsSets((data ?? []) as SportsSet[]);
      setSportsTotal(count ?? 0);
    } catch (err) {
      toast({ title: 'Could not load sports sets', variant: 'destructive' });
    } finally {
      setSportsLoading(false);
    }
  }, [sportsCat, sportsSearch, sportsPage, toast]);

  // ── Checklist ───────────────────────────────────────────────────────────────

  const openChecklist = async (set: TcgSet | SportsSet, type: Tab) => {
    setChecklist({ name: set.name, type, setId: set.id });
    setChecklistCards([]);
    setChecklistLoading(true);
    try {
      if (type === 'tcg') {
        const { data } = await supabase
          .from('tcg_cards')
          .select('id, name, number, rarity, image_url')
          .eq('set_id', set.id)
          .order('number', { ascending: true });
        setChecklistCards((data ?? []) as TcgCard[]);
      } else {
        const { data } = await supabase
          .from('ch_cards')
          .select('id, player, number, variant, rookie, image_url, raw')
          .eq('set_name', (set as SportsSet).name)
          .order('number', { ascending: true });
        setChecklistCards((data ?? []) as SportsCard[]);
      }
    } catch {
      toast({ title: 'Could not load checklist', variant: 'destructive' });
    } finally {
      setChecklistLoading(false);
    }
  };

  const exportChecklist = () => {
    if (!checklist) return;
    if (checklist.type === 'tcg') {
      const cards = checklistCards as TcgCard[];
      downloadCsv(`${checklist.name.replace(/[^a-z0-9]+/gi, '_')}_checklist.csv`, [
        ['Number', 'Name', 'Rarity'],
        ...cards.map((c) => [c.number ?? '', c.name, c.rarity ?? '']),
      ]);
    } else {
      const cards = checklistCards as SportsCard[];
      downloadCsv(`${checklist.name.replace(/[^a-z0-9]+/gi, '_')}_checklist.csv`, [
        ['Number', 'Player', 'Variant', 'Rookie'],
        ...cards.map((c) => [c.number ?? '', c.player ?? '', c.variant ?? '', c.rookie ? 'Yes' : '']),
      ]);
    }
  };

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => { loadTcgStats(); loadSportsStats(); }, []);

  useEffect(() => {
    if (tab !== 'tcg') return;
    const t = setTimeout(loadTcgSets, 250);
    return () => clearTimeout(t);
  }, [tab, tcgGame, tcgSearch, tcgPage]);

  useEffect(() => {
    if (tab !== 'sports') return;
    const t = setTimeout(loadSportsSets, 250);
    return () => clearTimeout(t);
  }, [tab, sportsCat, sportsSearch, sportsPage]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#14314F]">Catalog</h1>
        <p className="text-sm text-gray-400 mt-1">Browse TCG and sports card sets synced weekly from TCG API and Card Hedger.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['tcg', 'sports'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-[#14314F] text-[#14314F]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'tcg' ? 'TCG' : 'Sports Cards'}
          </button>
        ))}
      </div>

      {/* ── TCG tab ─────────────────────────────────────────────────────────── */}
      {tab === 'tcg' && (
        <div className="space-y-5">
          {/* Stats */}
          {tcgStats && (
            <div className="grid grid-cols-3 gap-4">
              <StatPill label="Games" value={tcgStats.games} />
              <StatPill label="Sets" value={tcgStats.sets} />
              <StatPill label="Cards" value={tcgStats.cards} />
            </div>
          )}

          {/* Game filter + search */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => { setTcgGame(''); setTcgPage(0); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !tcgGame ? 'bg-[#14314F] text-white border-[#14314F]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {TCG_GAMES.map((g) => (
              <button
                key={g.slug}
                onClick={() => { setTcgGame(g.slug); setTcgPage(0); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  tcgGame === g.slug ? 'bg-[#14314F] text-white border-[#14314F]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {g.name}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={tcgSearch}
                onChange={(e) => { setTcgSearch(e.target.value); setTcgPage(0); }}
                placeholder="Search sets..."
                className="h-8 pl-8 text-sm w-56"
              />
            </div>
          </div>

          {/* Set grid */}
          {tcgLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sets...
            </div>
          ) : tcgSets.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {tcgTotal === 0 ? 'No sets synced yet — the weekly job runs every Monday.' : 'No sets match your search.'}
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-10"></th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Set</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Game</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Code</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Released</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Cards</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tcgSets.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2">
                          {s.image_url
                            ? <img src={s.image_url} alt="" className="w-8 h-8 object-contain rounded" />
                            : <div className="w-8 h-8 bg-gray-100 rounded" />}
                        </td>
                        <td className="px-4 py-2 font-medium text-[#14314F]">{s.name}</td>
                        <td className="px-4 py-2 text-gray-500">{s.game_name}</td>
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs">{s.abbreviation ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {s.release_date ? new Date(s.release_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">{s.card_count?.toLocaleString() ?? '—'}</td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => openChecklist(s, 'tcg')}
                            title="View checklist"
                            className="text-gray-300 hover:text-[#14314F] transition-colors"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={tcgPage} total={tcgTotal} onPage={setTcgPage} />
            </>
          )}
        </div>
      )}

      {/* ── Sports tab ──────────────────────────────────────────────────────── */}
      {tab === 'sports' && (
        <div className="space-y-5">
          {/* Stats */}
          {sportsStats && (
            <div className="grid grid-cols-2 gap-4">
              <StatPill label="Sets" value={sportsStats.sets} />
              <StatPill label="Cards indexed" value={sportsStats.cards} />
            </div>
          )}

          {/* Category filter + search */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => { setSportsCat(''); setSportsPage(0); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !sportsCat ? 'bg-[#14314F] text-white border-[#14314F]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {SPORTS_CATS.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSportsCat(cat); setSportsPage(0); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  sportsCat === cat ? 'bg-[#14314F] text-white border-[#14314F]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={sportsSearch}
                onChange={(e) => { setSportsSearch(e.target.value); setSportsPage(0); }}
                placeholder="Search sets..."
                className="h-8 pl-8 text-sm w-56"
              />
            </div>
          </div>

          {/* Set table */}
          {sportsLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sets...
            </div>
          ) : sportsSets.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {sportsTotal === 0 ? 'No sets synced yet — the weekly job runs every Monday.' : 'No sets match your search.'}
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-10"></th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Set</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Category</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Year</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">30d Sales</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sportsSets.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2">
                          {s.image_url
                            ? <img src={s.image_url} alt="" className="w-8 h-8 object-contain rounded" />
                            : <div className="w-8 h-8 bg-gray-100 rounded" />}
                        </td>
                        <td className="px-4 py-2 font-medium text-[#14314F]">{s.name}</td>
                        <td className="px-4 py-2 text-gray-500">{s.category}</td>
                        <td className="px-4 py-2 text-gray-500">{s.year ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {s.sales_30day != null ? s.sales_30day.toLocaleString() : '—'}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => openChecklist(s, 'sports')}
                            title="View checklist"
                            className="text-gray-300 hover:text-[#14314F] transition-colors"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={sportsPage} total={sportsTotal} onPage={setSportsPage} />
            </>
          )}
        </div>
      )}

      {/* ── Checklist dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!checklist} onOpenChange={(open) => { if (!open) { setChecklist(null); setChecklistCards([]); } }}>
        <DialogContent className="max-w-lg max-h-[75vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="truncate">{checklist?.name}</DialogTitle>
              {checklistCards.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportChecklist} className="h-7 text-xs shrink-0">
                  <Download className="w-3 h-3 mr-1" /> CSV
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {checklistLoading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 py-12">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : checklistCards.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                No cards indexed yet for this set.
              </p>
            ) : checklist?.type === 'tcg' ? (
              <div className="divide-y divide-gray-100">
                {(checklistCards as TcgCard[]).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2">
                    {c.image_url
                      ? <img src={c.image_url} alt="" className="w-8 h-10 object-contain shrink-0 rounded" />
                      : <div className="w-8 h-10 bg-gray-100 rounded shrink-0" />}
                    <span className="text-gray-400 text-xs w-10 shrink-0 font-mono">{c.number ?? '—'}</span>
                    <span className="flex-1 text-sm text-[#14314F] font-medium">{c.name}</span>
                    {c.rarity && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 shrink-0">{c.rarity}</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(checklistCards as SportsCard[]).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2">
                    {c.image_url
                      ? <img src={c.image_url} alt="" className="w-8 h-10 object-contain shrink-0 rounded" />
                      : <div className="w-8 h-10 bg-gray-100 rounded shrink-0" />}
                    <span className="text-gray-400 text-xs w-10 shrink-0 font-mono">{c.number ?? '—'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#14314F] font-medium truncate">{c.player ?? 'Unknown'}</p>
                      {c.variant && <p className="text-xs text-gray-400">{c.variant}</p>}
                    </div>
                    {c.rookie && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 shrink-0">RC</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const last = Math.ceil(total / PAGE_SIZE) - 1;
  return (
    <div className="flex items-center justify-between text-sm text-gray-500">
      <span>{(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= last} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
