import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Package, ChevronRight, Check, Truck, Award,
  Download, Plus, Search, X, ArrowRight, Upload, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ConfirmGradeDialog from '@/components/portal/ConfirmGradeDialog';
import type { GradingBundle, GradingBundleItem, Card, GradingAddon, GradingService } from '@/types/cards';
import { GRADING_SERVICES, GRADING_SERVICE_TIERS } from '@/types/cards';

// ── Types ────────────────────────────────────────────────────────────────────

interface BundleWithItems extends GradingBundle {
  items: (GradingBundleItem & { card: Card })[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STEPS = ['building', 'submitted', 'at_grader', 'returned'] as const;

const STATUS_LABELS: Record<string, string> = {
  building:  'Building',
  submitted: 'Submitted',
  at_grader: 'At Grader',
  returned:  'Returned',
};

const STATUS_COLORS: Record<string, string> = {
  building:  'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  at_grader: 'bg-orange-100 text-orange-700',
  returned:  'bg-green-100 text-green-700',
};

const COLUMN_HEADER_COLORS: Record<string, string> = {
  building:  'border-blue-300 bg-blue-50',
  submitted: 'border-amber-300 bg-amber-50',
  at_grader: 'border-orange-300 bg-orange-50',
  returned:  'border-green-300 bg-green-50',
};

const NEXT_ACTION: Record<string, { label: string; icon: React.ReactNode }> = {
  building:  { label: 'Mark submitted',  icon: <Truck  className="w-3 h-3" /> },
  submitted: { label: 'Mark at grader',  icon: <Award  className="w-3 h-3" /> },
  at_grader: { label: 'Mark returned',   icon: <Check  className="w-3 h-3" /> },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardTypeAttributes(card: any): string {
  const parts = [card.sport, card.parallel, card.variation].filter(Boolean);
  if (Array.isArray(card.attributes)) parts.push(...card.attributes);
  return parts.join(', ') || '—';
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── New Bundle Dialog ──────────────────────────────────────────────────────────

function NewBundleDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [service, setService]   = useState<GradingService>('PSA');
  const [tier, setTier]         = useState('Standard');
  const [saving, setSaving]     = useState(false);

  const tiers = GRADING_SERVICE_TIERS[service] ?? [];

  const create = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('grading_bundles').insert({
      user_id: user.id, name: name.trim(),
      grading_service: service, service_tier: tier, status: 'building',
    });
    if (error) {
      toast({ title: 'Error creating bundle', variant: 'destructive' });
    } else {
      toast({ title: 'Bundle created' });
      setName(''); setOpen(false); onCreated();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#14314F] hover:bg-[#0f2438] text-white">
          <Plus className="w-4 h-4 mr-1" /> New bundle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New grading bundle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Bundle name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. July PSA Submission" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Grading service</Label>
            <Select value={service} onValueChange={(v) => { setService(v as GradingService); setTier(GRADING_SERVICE_TIERS[v as GradingService]?.[0] ?? '') }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GRADING_SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Service tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={!name.trim() || saving} className="w-full bg-[#47682d] hover:bg-[#3a5525] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create bundle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Cards Dialog ──────────────────────────────────────────────────────────

function AddCardsDialog({ bundle, existingCardIds, onAdded }: {
  bundle: BundleWithItems; existingCardIds: Set<string>; onAdded: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [cards, setCards]       = useState<Card[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase.from('cards').select('*').eq('user_id', user.id)
      .not('status', 'in', '("listed","sold")')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCards((data ?? []) as Card[]); setLoading(false); });
  }, [open, user]);

  const filtered = cards.filter((c) => {
    if (existingCardIds.has(c.id)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (c.player_name ?? '').toLowerCase().includes(q) ||
      (c.card_name ?? '').toLowerCase().includes(q) ||
      ((c as any).set_name ?? (c as any).card_set ?? '').toLowerCase().includes(q);
  });

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    const rows = [...selected].map((cardId) => ({ bundle_id: bundle.id, card_id: cardId, grading_fee: 0 }));
    const { error } = await supabase.from('grading_bundle_items').insert(rows);
    if (error) {
      toast({ title: 'Error adding cards', variant: 'destructive' });
    } else {
      await Promise.all([...selected].map((id) => supabase.from('cards').update({ status: 'grading' }).eq('id', id)));
      toast({ title: `${selected.size} card${selected.size > 1 ? 's' : ''} added` });
      setSelected(new Set()); setOpen(false); onAdded();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-[#47682d] text-[#47682d] hover:bg-[#47682d]/5">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add cards
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add cards to "{bundle.name}"</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search by player, card name, or set…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-8 text-sm" autoFocus />
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
          {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
          {!loading && filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-6">{query ? 'No matching cards' : 'No cards available'}</p>}
          {filtered.map((card) => {
            const isSelected = selected.has(card.id);
            const imageUrl = (card as any).image_front_url ?? null;
            return (
              <label key={card.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-[#47682d]/10 border border-[#47682d]/30' : 'hover:bg-gray-50 border border-transparent'}`}>
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(card.id)} />
                {imageUrl ? <img src={imageUrl} alt="" className="w-8 h-11 object-contain rounded shrink-0 bg-gray-50" /> : <div className="w-8 h-11 rounded bg-gray-100 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{card.player_name || card.card_name}</p>
                  <p className="text-xs text-gray-400 truncate">{[(card as any).set_name ?? (card as any).card_set, card.year].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{card.status}</Badge>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-gray-500">{selected.size > 0 ? `${selected.size} selected` : 'Select cards above'}</p>
          <Button className="bg-[#47682d] hover:bg-[#47682d]/90 text-white" disabled={selected.size === 0 || saving} onClick={handleAdd}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add to bundle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Bundle Detail (modal content) ─────────────────────────────────────────────

function BundleDetail({ bundle, onUpdate }: { bundle: BundleWithItems; onUpdate: () => void }) {
  const { toast } = useToast();
  const [tracking,      setTracking]      = useState(bundle.tracking_number ?? '');
  const [orderNumber,   setOrderNumber]   = useState((bundle as any).order_number ?? '');
  const [savingTracking, setSavingTracking] = useState(false);
  const [certInputs,    setCertInputs]    = useState<Record<string, string>>(
    Object.fromEntries(bundle.items.map((i) => [i.id, (i as any).cert_number ?? '']))
  );
  const [fetchingGrade, setFetchingGrade] = useState<Record<string, boolean>>({});
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [confirmGradeCardId, setConfirmGradeCardId] = useState<string | null>(null);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>(
    Object.fromEntries(bundle.items.map((i) => [i.id, String(i.quantity ?? 1)]))
  );
  const [declaredValueInputs, setDeclaredValueInputs] = useState<Record<string, string>>(
    Object.fromEntries(bundle.items.map((i) => [i.id, i.declared_value != null ? String(i.declared_value) : '']))
  );
  const [addons, setAddons]           = useState<GradingAddon[]>([]);
  const [addonSelections, setAddonSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(bundle.items.map((i) => [i.id, i.addon_ids ?? []]))
  );

  useEffect(() => {
    supabase.from('grading_addons').select('*')
      .eq('grading_service', bundle.grading_service).eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => setAddons((data as GradingAddon[]) ?? []));
  }, [bundle.grading_service]);

  const addonCost = (itemId: string) =>
    (addonSelections[itemId] ?? []).reduce((sum, id) => sum + (addons.find((a) => a.id === id)?.price ?? 0), 0);

  const toggleAddon = async (itemId: string, addonId: string) => {
    const current = addonSelections[itemId] ?? [];
    const next = current.includes(addonId) ? current.filter((id) => id !== addonId) : [...current, addonId];
    setAddonSelections((prev) => ({ ...prev, [itemId]: next }));
    await supabase.from('grading_bundle_items').update({ addon_ids: next }).eq('id', itemId);
  };

  const totalFee = bundle.items.reduce((sum, item) => sum + (item.grading_fee ?? 0) + addonCost(item.id), 0);
  const totalDeclaredValue = bundle.items.reduce((sum, item) => sum + (item.declared_value ?? 0) * (item.quantity ?? 1), 0);
  const currentStep = STATUS_STEPS.indexOf(bundle.status as typeof STATUS_STEPS[number]);

  const advanceStatus = async () => {
    const nextStatus = STATUS_STEPS[currentStep + 1];
    if (!nextStatus) return;
    const { error } = await supabase.from('grading_bundles').update({
      status: nextStatus,
      ...(nextStatus === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
      ...(nextStatus === 'returned'  ? { returned_at:  new Date().toISOString() } : {}),
    }).eq('id', bundle.id);
    if (error) toast({ title: 'Error updating bundle', variant: 'destructive' });
    else { toast({ title: `Bundle moved to ${STATUS_LABELS[nextStatus]}` }); onUpdate(); }
  };

  const saveTracking = async () => {
    setSavingTracking(true);
    const { error } = await supabase.from('grading_bundles')
      .update({ tracking_number: tracking, order_number: orderNumber })
      .eq('id', bundle.id);
    if (error) toast({ title: 'Error saving', variant: 'destructive' });
    else toast({ title: 'Saved' });
    setSavingTracking(false);
  };

  const saveCert = async (itemId: string) => {
    const cert = certInputs[itemId]?.trim();
    await supabase.from('grading_bundle_items').update({ cert_number: cert || null }).eq('id', itemId);
  };

  const fetchGradeFromCert = async (itemId: string, cardId: string) => {
    const cert = certInputs[itemId]?.trim();
    if (!cert) { toast({ title: 'Enter a cert number first', variant: 'destructive' }); return; }
    setFetchingGrade((prev) => ({ ...prev, [itemId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('cardhedge', {
        body: { mode: 'cert', cert, grader: bundle.grading_service, days: 365 },
      });
      if (error || !data) throw new Error(error?.message ?? 'No data');
      const grade = data.grade ?? data.certGrade ?? '';
      const market = data.marketValue ?? null;
      if (!grade) { toast({ title: 'Grade not found for cert ' + cert, variant: 'destructive' }); return; }
      // Save cert + grade on item
      await supabase.from('grading_bundle_items').update({
        cert_number: cert, official_grade: grade, graded_at: new Date().toISOString(),
      }).eq('id', itemId);
      // Update the card itself
      await supabase.from('cards').update({
        official_grade: grade,
        grading_company: bundle.grading_service,
        is_graded: true,
        ...(market != null ? { market_value: market } : {}),
      }).eq('id', cardId);
      toast({ title: bundle.grading_service + ' ' + grade + ' fetched from cert ' + cert });
      onUpdate();
    } catch (err) {
      toast({ title: 'Could not fetch grade', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setFetchingGrade((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const importCertsFromCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { toast({ title: 'CSV appears empty', variant: 'destructive' }); return; }

      // Detect header row — find cert and card number columns
      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
      const certCol  = headers.findIndex((h) => h.includes('cert'));
      const cardCol  = headers.findIndex((h) => h.includes('card') && h.includes('#') || h === 'card number' || h === 'card#');
      const gradeCol = headers.findIndex((h) => h === 'grade' || h.includes('final grade'));
      if (certCol === -1) { toast({ title: 'No cert column found in CSV', variant: 'destructive' }); return; }

      let matched = 0;
      const newCerts: Record<string, string> = { ...certInputs };
      const newGrades: Record<string, string> = { ...gradeInputs };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
        const cert  = cols[certCol] ?? '';
        const cardNum = cardCol >= 0 ? cols[cardCol] ?? '' : '';
        const grade = gradeCol >= 0 ? cols[gradeCol] ?? '' : '';
        if (!cert) continue;

        // Match bundle item by card number, then fall back to row position
        const item = bundle.items.find((it) => cardNum && String((it.card as any)?.card_number) === cardNum)
          ?? bundle.items[i - 1];
        if (!item) continue;

        newCerts[item.id]  = cert;
        if (grade) newGrades[item.id] = grade;
        matched++;
      }

      setCertInputs(newCerts);
      setGradeInputs(newGrades);

      // Persist to DB
      await Promise.all(
        bundle.items.map(async (item) => {
          if (!newCerts[item.id]) return;
          await supabase.from('grading_bundle_items').update({
            cert_number: newCerts[item.id],
            ...(newGrades[item.id] ? { official_grade: newGrades[item.id], graded_at: new Date().toISOString() } : {}),
          }).eq('id', item.id);
          if (newGrades[item.id]) {
            await supabase.from('cards').update({
              official_grade: newGrades[item.id],
              grading_company: bundle.grading_service,
              is_graded: true,
            }).eq('id', item.card_id);
          }
        })
      );

      toast({ title: matched + ' cert' + (matched !== 1 ? 's' : '') + ' imported from CSV' });
      onUpdate();
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const removeItem = async (itemId: string, cardId: string) => {
    const { error } = await supabase.from('grading_bundle_items').delete().eq('id', itemId);
    if (error) toast({ title: 'Error removing card', variant: 'destructive' });
    else { await supabase.from('cards').update({ status: 'intake' }).eq('id', cardId); onUpdate(); }
  };

  const saveGrade = async (itemId: string, cardId: string) => {
    const grade = gradeInputs[itemId];
    if (!grade) return;
    await supabase.from('grading_bundle_items').update({ official_grade: grade, graded_at: new Date().toISOString() }).eq('id', itemId);
    await supabase.from('cards').update({ official_grade: grade }).eq('id', cardId);
    toast({ title: 'Grade saved' }); onUpdate();
  };

  const saveQuantity = async (itemId: string) => {
    const quantity = parseInt(quantityInputs[itemId]) || 1;
    await supabase.from('grading_bundle_items').update({ quantity }).eq('id', itemId);
    onUpdate();
  };

  const saveDeclaredValue = async (itemId: string) => {
    const declared_value = parseFloat(declaredValueInputs[itemId]) || null;
    await supabase.from('grading_bundle_items').update({ declared_value }).eq('id', itemId);
    onUpdate();
  };

  const exportSubmissionForm = () => {
    const rows: (string | number)[][] = [
      ['Year', 'Product', 'Card Number', 'Player/Character Name', 'Card Type/Attributes', 'Quantity', 'Declared Value', 'Add-ons'],
      ...bundle.items.map((item) => {
        const card = item.card as any;
        const addonNames = (addonSelections[item.id] ?? []).map((id) => addons.find((a) => a.id === id)?.name).filter(Boolean).join('; ');
        return [card?.year ?? '', card?.release_name ?? card?.set_name ?? '', card?.card_number ?? '', card?.player_name ?? card?.card_name ?? '', cardTypeAttributes(card ?? {}), item.quantity ?? 1, item.declared_value ?? '', addonNames];
      }),
    ];
    downloadCsv(`${bundle.name.replace(/[^a-z0-9]+/gi, '_')}_submission.csv`, rows);
  };

  return (
    <div className="space-y-5">
      {/* Status stepper */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentStep;
          return (
            <div key={step} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${done ? STATUS_COLORS[step] : 'bg-gray-100 text-gray-400'}`}>
                {done && i < currentStep && <Check className="h-3 w-3" />}
                {STATUS_LABELS[step]}
              </div>
              {i < STATUS_STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300" />}
            </div>
          );
        })}
      </div>

      {/* Advance + tracking row */}
      <div className="flex gap-3 flex-wrap items-end">
        {bundle.status !== 'returned' && (
          <Button size="sm" variant="outline" onClick={advanceStatus}>
            {NEXT_ACTION[bundle.status]?.icon}
            <span className="ml-1">{NEXT_ACTION[bundle.status]?.label}</span>
          </Button>
        )}
        <div className="flex gap-2 items-end flex-1 min-w-0 flex-wrap">
          <div className="flex-1 min-w-[140px] space-y-1">
            <Label className="text-xs">Tracking number</Label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Enter tracking #" className="h-8 text-sm" />
          </div>
          <div className="flex-1 min-w-[120px] space-y-1">
            <Label className="text-xs">Order / submission #</Label>
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. PSA-12345678" className="h-8 text-sm" />
          </div>
          <Button size="sm" variant="outline" onClick={saveTracking} disabled={savingTracking}>
            {savingTracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      {/* Submission form */}
      <div>
        <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-700">Cards ({bundle.items.length})</p>
          <div className="flex items-center gap-2">
            {bundle.status === 'building' && (
              <AddCardsDialog bundle={bundle} existingCardIds={new Set(bundle.items.map((i) => i.card_id))} onAdded={onUpdate} />
            )}
            <span className="text-xs text-gray-500">
              Declared: <strong>${totalDeclaredValue.toFixed(2)}</strong>
              {' · '}Fees: <strong>${totalFee.toFixed(2)}</strong>
            </span>
            {bundle.items.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportSubmissionForm} className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            )}
            {(bundle.status === 'returned' || bundle.status === 'at_grader') && (
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.txt" className="sr-only" onChange={importCertsFromCSV} />
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 h-7">
                  <Upload className="h-3 w-3" /> Import Certs
                </span>
              </label>
            )}
          </div>
        </div>

        {bundle.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
            <Package className="h-8 w-8 opacity-40" />
            <p className="text-sm">No cards in this bundle yet.</p>
            {bundle.status === 'building' && (
              <AddCardsDialog bundle={bundle} existingCardIds={new Set()} onAdded={onUpdate} />
            )}
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Year</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Product</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Card #</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Player/Character</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Type</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-20">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-28">Declared $</th>
                  {addons.length > 0 && <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Add-ons</th>}
                  {bundle.status !== 'building' && <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-36">Cert #</th>}
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Grade</th>
                  {bundle.status === 'building' && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bundle.items.map((item) => {
                  const card = item.card as any;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-gray-600">{card?.year ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{card?.release_name ?? card?.set_name ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{card?.card_number ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Link to={`/portal/cards/${item.card_id}`} className="font-medium text-[#14314F] hover:underline">
                          {card?.player_name ?? card?.card_name ?? 'Card'}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate" title={cardTypeAttributes(card ?? {})}>{cardTypeAttributes(card ?? {})}</td>
                      <td className="px-3 py-2">
                        <Input type="number" min="1" value={quantityInputs[item.id] ?? '1'}
                          onChange={(e) => setQuantityInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => saveQuantity(item.id)} className="h-7 w-16 text-xs text-right ml-auto" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24 ml-auto">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <Input type="number" step="0.01" min="0" placeholder="0.00"
                            value={declaredValueInputs[item.id] ?? ''}
                            onChange={(e) => setDeclaredValueInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={() => saveDeclaredValue(item.id)} className="h-7 pl-5 text-xs text-right" />
                        </div>
                      </td>
                      {addons.length > 0 && (
                        <td className="px-3 py-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#14314F] border border-gray-200 rounded px-2 py-1">
                                {(addonSelections[item.id]?.length ?? 0) > 0
                                  ? <>{addonSelections[item.id].length} selected <span className="text-gray-400">(+${addonCost(item.id).toFixed(2)})</span></>
                                  : <><Plus className="h-3 w-3" /> Add-ons</>}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2" align="start">
                              <div className="space-y-1">
                                {addons.map((addon) => (
                                  <label key={addon.id} className="flex items-center justify-between gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                    <span className="flex items-center gap-2">
                                      <Checkbox checked={(addonSelections[item.id] ?? []).includes(addon.id)} onCheckedChange={() => toggleAddon(item.id, addon.id)} />
                                      {addon.name}
                                    </span>
                                    <span className="text-xs text-gray-400">{addon.price_is_minimum ? 'from ' : ''}${addon.price.toFixed(2)}</span>
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </td>
                      )}
                      {bundle.status !== 'building' && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1 items-center w-36">
                            <Input
                              className="h-7 text-xs font-mono"
                              placeholder="Cert #"
                              value={certInputs[item.id] ?? ''}
                              onChange={(e) => setCertInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              onBlur={() => saveCert(item.id)}
                            />
                            {!item.official_grade && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-1.5 text-xs"
                                title="Fetch grade from Card Hedger"
                                disabled={fetchingGrade[item.id]}
                                onClick={() => fetchGradeFromCert(item.id, item.card_id)}
                              >
                                {fetchingGrade[item.id]
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <RefreshCw className="h-3 w-3" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        {item.official_grade ? (
                          <Badge className="bg-[#47682d] text-white">Grade: {item.official_grade}</Badge>
                        ) : bundle.status === 'returned' ? (
                          <div className="flex flex-col gap-1 items-end">
                            <div className="flex gap-1 items-center">
                              <Input className="h-7 w-16 text-xs" placeholder="Grade"
                                value={gradeInputs[item.id] ?? ''}
                                onChange={(e) => setGradeInputs((prev) => ({ ...prev, [item.id]: e.target.value }))} />
                              <Button size="sm" className="h-7 px-2 text-xs bg-[#47682d] text-white" onClick={() => saveGrade(item.id, item.card_id)}>Save</Button>
                            </div>
                            <button onClick={() => setConfirmGradeCardId(item.card_id)} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                              <Award className="w-3 h-3" /> Scan slab
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {bundle.status === 'building' && (
                        <td className="px-2 py-2">
                          <button onClick={() => removeItem(item.id, item.card_id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Remove">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmGradeCardId && (
        <ConfirmGradeDialog
          cardId={confirmGradeCardId}
          open={!!confirmGradeCardId}
          onOpenChange={(open) => { if (!open) setConfirmGradeCardId(null); }}
          onConfirmed={() => { setConfirmGradeCardId(null); onUpdate(); }}
        />
      )}
    </div>
  );
}

// ── Bundle Kanban Card ────────────────────────────────────────────────────────

function BundleCard({ bundle, onAdvance, onSelect }: {
  bundle: BundleWithItems;
  onAdvance: (bundle: BundleWithItems) => void;
  onSelect:  (bundle: BundleWithItems) => void;
}) {
  const nextAction = NEXT_ACTION[bundle.status];

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 space-y-2.5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => onSelect(bundle)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#14314F] leading-tight">{bundle.name}</p>
        <Package className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="font-medium">{bundle.grading_service}</span>
        {bundle.service_tier && <><span>·</span><span>{bundle.service_tier}</span></>}
      </div>

      <p className="text-xs text-gray-400">{bundle.items?.length ?? 0} card{(bundle.items?.length ?? 0) !== 1 ? 's' : ''}</p>

      {bundle.tracking_number && (
        <p className="text-xs text-gray-400 font-mono truncate">#{bundle.tracking_number}</p>
      )}

      {nextAction && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(bundle); }}
          className="flex items-center gap-1.5 text-xs text-[#14314F] border border-[#14314F]/20 rounded px-2 py-1 hover:bg-[#14314F]/5 transition-colors w-full justify-center"
        >
          {nextAction.icon}
          {nextAction.label}
          <ArrowRight className="w-3 h-3 ml-auto" />
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GradingDecisionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bundles, setBundles]           = useState<BundleWithItems[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<BundleWithItems | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);

  const loadBundles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('grading_bundles')
      .select('*, items:grading_bundle_items(*, card:cards(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setBundles((data as BundleWithItems[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadBundles(); }, [user]);

  const handleAdvance = async (bundle: BundleWithItems) => {
    const currentStep = STATUS_STEPS.indexOf(bundle.status as typeof STATUS_STEPS[number]);
    const nextStatus  = STATUS_STEPS[currentStep + 1];
    if (!nextStatus) return;
    const { error } = await supabase.from('grading_bundles').update({
      status: nextStatus,
      ...(nextStatus === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
      ...(nextStatus === 'returned'  ? { returned_at:  new Date().toISOString() } : {}),
    }).eq('id', bundle.id);
    if (error) toast({ title: 'Error updating bundle', variant: 'destructive' });
    else { toast({ title: `Moved to ${STATUS_LABELS[nextStatus]}` }); loadBundles(); }
  };

  const handleSelect = (bundle: BundleWithItems) => {
    setSelectedBundle(bundle);
    setDetailOpen(true);
  };

  const handleDetailUpdate = () => {
    loadBundles();
    // Refresh the selected bundle data after update
    if (selectedBundle) {
      supabase
        .from('grading_bundles')
        .select('*, items:grading_bundle_items(*, card:cards(*))')
        .eq('id', selectedBundle.id)
        .single()
        .then(({ data }) => { if (data) setSelectedBundle(data as BundleWithItems); });
    }
  };

  const columns = STATUS_STEPS.map((status) => ({
    status,
    bundles: bundles.filter((b) => b.status === status),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#14314F]">Grading</h2>
          <p className="text-gray-500 mt-1 text-sm">Track bundles through the grading pipeline.</p>
        </div>
        <NewBundleDialog onCreated={loadBundles} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-gray-400 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading bundles…</span>
        </div>
      ) : (
        /* Kanban board */
        <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
          {columns.map(({ status, bundles: colBundles }) => (
            <div key={status} className="flex flex-col gap-3">
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${COLUMN_HEADER_COLORS[status]}`}>
                <span className="text-xs font-semibold uppercase tracking-wide">{STATUS_LABELS[status]}</span>
                {colBundles.length > 0 && (
                  <span className="text-xs font-bold bg-white/60 rounded-full px-1.5 py-0.5">{colBundles.length}</span>
                )}
              </div>

              {/* Bundle cards */}
              <div className="flex flex-col gap-2 flex-1">
                {colBundles.length === 0 ? (
                  <div className="flex-1 rounded-lg border-2 border-dashed border-gray-100 flex items-center justify-center min-h-[120px]">
                    <p className="text-xs text-gray-300">No bundles</p>
                  </div>
                ) : (
                  colBundles.map((bundle) => (
                    <BundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onAdvance={handleAdvance}
                      onSelect={handleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bundle detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedBundle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedBundle.name}
                  <Badge className={STATUS_COLORS[selectedBundle.status]}>
                    {STATUS_LABELS[selectedBundle.status]}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <BundleDetail
                key={selectedBundle.id}
                bundle={selectedBundle}
                onUpdate={handleDetailUpdate}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
