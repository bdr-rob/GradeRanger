import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Package, ChevronRight, Check, Truck, Award, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GradingBundleManager from '@/components/GradingBundleManager';
import type { GradingBundle, GradingBundleItem, Card } from '@/types/cards';

interface BundleWithItems extends GradingBundle {
  items: (GradingBundleItem & { card: Card })[];
}

// "Card Type/Attributes" on a submission form — sport/category, parallel,
// and any CardSight attributes (Rookie, Autograph, etc.) joined together.
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
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STEPS = ['building', 'submitted', 'at_grader', 'returned'] as const;
const STATUS_LABELS: Record<string, string> = {
  building: 'Building',
  submitted: 'Submitted',
  at_grader: 'At Grader',
  returned: 'Returned',
};
const STATUS_COLORS: Record<string, string> = {
  building: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  at_grader: 'bg-orange-100 text-orange-700',
  returned: 'bg-green-100 text-green-700',
};

function BundleDetail({ bundle, onUpdate }: { bundle: BundleWithItems; onUpdate: () => void }) {
  const { toast } = useToast();
  const [tracking, setTracking] = useState(bundle.tracking_number ?? '');
  const [savingTracking, setSavingTracking] = useState(false);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>(
    Object.fromEntries(bundle.items.map((i) => [i.id, String(i.quantity ?? 1)]))
  );
  const [declaredValueInputs, setDeclaredValueInputs] = useState<Record<string, string>>(
    Object.fromEntries(bundle.items.map((i) => [i.id, i.declared_value != null ? String(i.declared_value) : '']))
  );

  const totalFee = bundle.items.reduce((sum, item) => sum + (item.grading_fee ?? 0), 0);
  const totalDeclaredValue = bundle.items.reduce(
    (sum, item) => sum + (item.declared_value ?? 0) * (item.quantity ?? 1), 0
  );
  const currentStep = STATUS_STEPS.indexOf(bundle.status as typeof STATUS_STEPS[number]);

  const advanceStatus = async () => {
    const nextStatus = STATUS_STEPS[currentStep + 1];
    if (!nextStatus) return;
    const { error } = await supabase
      .from('grading_bundles')
      .update({
        status: nextStatus,
        ...(nextStatus === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
        ...(nextStatus === 'returned' ? { returned_at: new Date().toISOString() } : {}),
      })
      .eq('id', bundle.id);

    if (error) toast({ title: 'Error updating bundle', variant: 'destructive' });
    else { toast({ title: `Bundle marked as ${STATUS_LABELS[nextStatus]}` }); onUpdate(); }
  };

  const saveTracking = async () => {
    setSavingTracking(true);
    const { error } = await supabase
      .from('grading_bundles')
      .update({ tracking_number: tracking })
      .eq('id', bundle.id);

    if (error) toast({ title: 'Error saving tracking', variant: 'destructive' });
    else toast({ title: 'Tracking number saved' });
    setSavingTracking(false);
  };

  const saveGrade = async (itemId: string, cardId: string) => {
    const grade = gradeInputs[itemId];
    if (!grade) return;
    const { error } = await supabase
      .from('grading_bundle_items')
      .update({ official_grade: grade, graded_at: new Date().toISOString() })
      .eq('id', itemId);

    await supabase.from('cards').update({ official_grade: grade }).eq('id', cardId);

    if (error) toast({ title: 'Error saving grade', variant: 'destructive' });
    else { toast({ title: 'Grade saved' }); onUpdate(); }
  };

  const saveQuantity = async (itemId: string) => {
    const quantity = parseInt(quantityInputs[itemId]) || 1;
    const { error } = await supabase
      .from('grading_bundle_items')
      .update({ quantity })
      .eq('id', itemId);
    if (error) toast({ title: 'Error saving quantity', variant: 'destructive' });
    else onUpdate();
  };

  const saveDeclaredValue = async (itemId: string) => {
    const declared_value = parseFloat(declaredValueInputs[itemId]) || null;
    const { error } = await supabase
      .from('grading_bundle_items')
      .update({ declared_value })
      .eq('id', itemId);
    if (error) toast({ title: 'Error saving declared value', variant: 'destructive' });
    else onUpdate();
  };

  const exportSubmissionForm = () => {
    const rows: (string | number)[][] = [
      ['Year', 'Product', 'Card Number', 'Player/Character Name', 'Card Type/Attributes', 'Quantity', 'Declared Value'],
      ...bundle.items.map((item) => {
        const card = item.card as any;
        return [
          card?.year ?? '',
          card?.release_name ?? card?.set_name ?? '',
          card?.card_number ?? '',
          card?.player_name ?? card?.card_name ?? '',
          cardTypeAttributes(card ?? {}),
          item.quantity ?? 1,
          item.declared_value ?? '',
        ];
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

      {/* Advance button */}
      {bundle.status !== 'returned' && (
        <Button size="sm" variant="outline" onClick={advanceStatus}>
          {bundle.status === 'building' && <><Truck className="h-3.5 w-3.5 mr-1" />Mark as submitted</>}
          {bundle.status === 'submitted' && <><Award className="h-3.5 w-3.5 mr-1" />Mark as at grader</>}
          {bundle.status === 'at_grader' && <><Check className="h-3.5 w-3.5 mr-1" />Mark as returned</>}
        </Button>
      )}

      {/* Tracking */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Tracking number</Label>
          <Input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Enter tracking #"
            className="h-8 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={saveTracking} disabled={savingTracking}>
          {savingTracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>

      {/* Submission form */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-700">Submission form ({bundle.items.length} cards)</p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              Declared total: <span className="font-semibold">${totalDeclaredValue.toFixed(2)}</span>
              {' · '}Fees: <span className="font-semibold">${totalFee.toFixed(2)}</span>
            </p>
            {bundle.items.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportSubmissionForm} className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            )}
          </div>
        </div>

        {bundle.items.length === 0 ? (
          <p className="text-sm text-gray-400">No cards in this bundle yet.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Year</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Product</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Card #</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Player/Character</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Type/Attributes</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-20">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-28">Declared Value</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Grade</th>
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
                      <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={cardTypeAttributes(card ?? {})}>
                        {cardTypeAttributes(card ?? {})}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="1"
                          value={quantityInputs[item.id] ?? '1'}
                          onChange={(e) => setQuantityInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => saveQuantity(item.id)}
                          className="h-7 w-16 text-xs text-right ml-auto"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24 ml-auto">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={declaredValueInputs[item.id] ?? ''}
                            onChange={(e) => setDeclaredValueInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={() => saveDeclaredValue(item.id)}
                            className="h-7 pl-5 text-xs text-right"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.official_grade ? (
                          <Badge className="bg-[#47682d] text-white">Grade: {item.official_grade}</Badge>
                        ) : bundle.status === 'returned' ? (
                          <div className="flex gap-1 items-center justify-end">
                            <Input
                              className="h-7 w-16 text-xs"
                              placeholder="Grade"
                              value={gradeInputs[item.id] ?? ''}
                              onChange={(e) => setGradeInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                            <Button size="sm" className="h-7 px-2 text-xs bg-[#47682d] text-white" onClick={() => saveGrade(item.id, item.card_id)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GradingDecisionsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const bundleParam = searchParams.get('bundle');
  const [bundles, setBundles] = useState<BundleWithItems[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(bundleParam);
  const [loading, setLoading] = useState(true);

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

  const activeBundle = bundles.find((b) => b.id === selectedBundle);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#14314F]">Grading decisions</h2>
          <p className="text-gray-500 mt-1">Manage your grading bundles and submission tracking.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bundle list */}
        <div className="md:col-span-1 space-y-3">
          <GradingBundleManager />

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No bundles yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bundles.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBundle(b.id === selectedBundle ? null : b.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${b.id === selectedBundle ? 'border-[#14314F] bg-[#14314F]/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{b.name}</p>
                      <p className="text-xs text-gray-500">{b.grading_service} · {b.items?.length ?? 0} cards</p>
                    </div>
                    <Badge className={STATUS_COLORS[b.status]}>{STATUS_LABELS[b.status]}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bundle detail */}
        <div className="md:col-span-2">
          {activeBundle ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-[#14314F] mb-4">{activeBundle.name}</h3>
              <BundleDetail key={activeBundle.id} bundle={activeBundle} onUpdate={loadBundles} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-gray-200 text-gray-400">
              <div className="text-center">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a bundle to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
