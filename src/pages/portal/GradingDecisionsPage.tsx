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
import { Loader2, Package, ChevronRight, Check, Truck, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GradingBundleManager from '@/components/GradingBundleManager';
import type { GradingBundle, GradingBundleItem, Card } from '@/types/cards';

interface BundleWithItems extends GradingBundle {
  items: (GradingBundleItem & { card: Card })[];
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

  const totalFee = bundle.items.reduce((sum, item) => sum + (item.grading_fee ?? 0), 0);
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

      {/* Cards in bundle */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-700">Cards ({bundle.items.length})</p>
          <p className="text-sm text-gray-500">Total fees: <span className="font-semibold">${totalFee.toFixed(2)}</span></p>
        </div>

        {bundle.items.length === 0 ? (
          <p className="text-sm text-gray-400">No cards in this bundle yet.</p>
        ) : (
          <div className="space-y-2">
            {bundle.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2 bg-gray-50">
                {item.card?.image_front_url && (
                  <img src={item.card.image_front_url} alt="" className="w-10 h-12 object-contain rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <Link to={`/portal/cards/${item.card_id}`} className="text-sm font-medium text-[#14314F] hover:underline truncate block">
                    {item.card?.card_name ?? 'Card'}
                  </Link>
                  <p className="text-xs text-gray-400">{item.grading_fee != null ? `Fee: $${item.grading_fee.toFixed(2)}` : 'No fee set'}</p>
                </div>
                {item.official_grade ? (
                  <Badge className="bg-[#47682d] text-white">Grade: {item.official_grade}</Badge>
                ) : bundle.status === 'returned' ? (
                  <div className="flex gap-1 items-center">
                    <Input
                      className="h-7 w-20 text-xs"
                      placeholder="Grade"
                      value={gradeInputs[item.id] ?? ''}
                      onChange={(e) => setGradeInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <Button size="sm" className="h-7 px-2 text-xs bg-[#47682d] text-white" onClick={() => saveGrade(item.id, item.card_id)}>
                      Save
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
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
              <BundleDetail bundle={activeBundle} onUpdate={loadBundles} />
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
