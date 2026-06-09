import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus, Package, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GradingBundle, GradingService } from '@/types/cards';
import { GRADING_SERVICES, GRADING_SERVICE_TIERS } from '@/types/cards';

const BUNDLE_STATUS_COLORS: Record<string, string> = {
  building: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  at_grader: 'bg-orange-100 text-orange-700',
  returned: 'bg-green-100 text-green-700',
};

const BUNDLE_STATUS_LABELS: Record<string, string> = {
  building: 'Building',
  submitted: 'Submitted',
  at_grader: 'At Grader',
  returned: 'Returned',
};

interface Props {
  cardId?: string;
}

export default function GradingBundleManager({ cardId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bundles, setBundles] = useState<GradingBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addToOpen, setAddToOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New bundle form
  const [newName, setNewName] = useState('');
  const [newService, setNewService] = useState<GradingService>('PSA');
  const [newTier, setNewTier] = useState('Standard');
  const [selectedFee, setSelectedFee] = useState('50');
  const [selectedBundle, setSelectedBundle] = useState('');

  useEffect(() => {
    loadBundles();
  }, [user]);

  const loadBundles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('grading_bundles')
      .select('*, items:grading_bundle_items(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setBundles((data as GradingBundle[]) ?? []);
    setLoading(false);
  };

  const createBundle = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('grading_bundles').insert({
      user_id: user.id,
      name: newName.trim(),
      grading_service: newService,
      service_tier: newTier,
      status: 'building',
    });

    if (error) {
      toast({ title: 'Error creating bundle', variant: 'destructive' });
    } else {
      toast({ title: 'Bundle created' });
      setCreateOpen(false);
      setNewName('');
      await loadBundles();

      // If a cardId was passed, also add the card to this new bundle
      if (cardId) {
        const { data: latest } = await supabase
          .from('grading_bundles')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (latest) await addCardToBundle(latest.id);
      }
    }
    setSaving(false);
  };

  const addCardToBundle = async (bundleId: string) => {
    if (!cardId) return;
    const { error } = await supabase.from('grading_bundle_items').insert({
      bundle_id: bundleId,
      card_id: cardId,
      grading_fee: parseFloat(selectedFee) || 0,
    });

    if (error) {
      toast({ title: 'Error adding card to bundle', variant: 'destructive' });
    } else {
      await supabase.from('cards').update({ status: 'grading' }).eq('id', cardId);
      toast({ title: 'Card added to bundle' });
      setAddToOpen(false);
    }
  };

  const buildingBundles = bundles.filter((b) => b.status === 'building');

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading bundles…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#14314F]">Grading bundles</h3>
        <div className="flex gap-2">
          {cardId && buildingBundles.length > 0 && (
            <Dialog open={addToOpen} onOpenChange={setAddToOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-[#47682d] text-[#47682d]">
                  <Plus className="h-3 w-3 mr-1" />
                  Add to bundle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add card to a bundle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Select bundle</Label>
                    <Select onValueChange={setSelectedBundle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a bundle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildingBundles.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({b.grading_service} · {b.service_tier})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Grading fee for this card ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={selectedFee}
                      onChange={(e) => setSelectedFee(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-[#47682d] hover:bg-[#47682d]/90 text-white"
                    disabled={!selectedBundle || saving}
                    onClick={() => addCardToBundle(selectedBundle)}
                  >
                    Add to bundle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#14314F] hover:bg-[#14314F]/90 text-white">
                <Plus className="h-3 w-3 mr-1" />
                New bundle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create grading bundle</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Bundle name</Label>
                  <Input
                    placeholder="e.g. June 2026 PSA Batch"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Grading service</Label>
                  <Select value={newService} onValueChange={(v) => { setNewService(v as GradingService); setNewTier(GRADING_SERVICE_TIERS[v as GradingService][0]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADING_SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Service tier</Label>
                  <Select value={newTier} onValueChange={setNewTier}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADING_SERVICE_TIERS[newService].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {cardId && (
                  <div className="space-y-1">
                    <Label>Grading fee for this card ($)</Label>
                    <Input type="number" step="0.01" value={selectedFee} onChange={(e) => setSelectedFee(e.target.value)} />
                  </div>
                )}
                <Button
                  className="w-full bg-[#47682d] hover:bg-[#47682d]/90 text-white"
                  disabled={!newName.trim() || saving}
                  onClick={createBundle}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create bundle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {bundles.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No grading bundles yet. Create one to start organizing submissions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bundles.map((bundle) => (
            <Link
              key={bundle.id}
              to={`/portal/grading?bundle=${bundle.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:border-[#14314F]/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-[#14314F]">{bundle.name}</p>
                  <p className="text-xs text-gray-500">{bundle.grading_service} · {bundle.service_tier}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={BUNDLE_STATUS_COLORS[bundle.status]}>
                  {BUNDLE_STATUS_LABELS[bundle.status]}
                </Badge>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
