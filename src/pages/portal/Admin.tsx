import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShieldAlert, Users, DollarSign, Settings, CreditCard, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { GradingFeeSchedule, GradingService } from '@/types/cards';
import { GRADING_SERVICES } from '@/types/cards';

// ── Subscription plan types ───────────────────────────────────────────────────

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annual: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  features: Record<string, any>;
  is_active: boolean;
  sort_order: number;
}

const FEATURE_PRESETS: { key: string; label: string; type: 'boolean' | 'number' }[] = [
  { key: 'max_cards',   label: 'Max cards (-1 = unlimited)', type: 'number'  },
  { key: 'shipping',    label: 'Shipping labels',            type: 'boolean' },
  { key: 'portfolio',   label: 'Portfolio tracking',         type: 'boolean' },
  { key: 'grading',     label: 'Grading bundles',            type: 'boolean' },
  { key: 'analytics',   label: 'Advanced analytics',         type: 'boolean' },
  { key: 'multi_user',  label: 'Multi-user (future)',         type: 'boolean' },
]

function PlanForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<SubscriptionPlan>;
  onSave: (data: Partial<SubscriptionPlan>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,         setName]         = useState(initial?.name ?? '');
  const [description,  setDescription]  = useState(initial?.description ?? '');
  const [priceMonthly, setPriceMonthly] = useState((initial?.price_monthly ?? 0).toString());
  const [priceAnnual,  setPriceAnnual]  = useState((initial?.price_annual ?? '').toString());
  const [stripeMo,     setStripeMo]     = useState(initial?.stripe_price_id_monthly ?? '');
  const [stripeAn,     setStripeAn]     = useState(initial?.stripe_price_id_annual ?? '');
  const [sortOrder,    setSortOrder]    = useState((initial?.sort_order ?? 0).toString());
  const [features,     setFeatures]     = useState<Record<string, any>>(initial?.features ?? {});
  const [saving,       setSaving]       = useState(false);

  function setFeature(key: string, val: any) {
    setFeatures((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave({
      name, description: description || null,
      price_monthly: parseFloat(priceMonthly) || 0,
      price_annual:  priceAnnual ? parseFloat(priceAnnual) : null,
      stripe_price_id_monthly: stripeMo || null,
      stripe_price_id_annual:  stripeAn || null,
      sort_order: parseInt(sortOrder) || 0,
      features,
    });
    setSaving(false);
  }

  return (
    <div className="border rounded-xl p-5 space-y-4 bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>Plan name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pro" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
        </div>
        <div className="space-y-1.5">
          <Label>Monthly price ($)</Label>
          <Input type="number" step="0.01" value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Annual price ($ / yr, optional)</Label>
          <Input type="number" step="0.01" value={priceAnnual} onChange={(e) => setPriceAnnual(e.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label>Stripe price ID (monthly)</Label>
          <Input value={stripeMo} onChange={(e) => setStripeMo(e.target.value)} placeholder="price_..." />
        </div>
        <div className="space-y-1.5">
          <Label>Stripe price ID (annual)</Label>
          <Input value={stripeAn} onChange={(e) => setStripeAn(e.target.value)} placeholder="price_..." />
        </div>
        <div className="space-y-1.5">
          <Label>Sort order</Label>
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Features</p>
        <div className="grid grid-cols-2 gap-2">
          {FEATURE_PRESETS.map(({ key, label, type }) => (
            <div key={key} className="flex items-center gap-2">
              {type === 'boolean' ? (
                <button
                  type="button"
                  onClick={() => setFeature(key, !features[key])}
                  className={'w-8 h-4 rounded-full transition-colors ' + (features[key] ? 'bg-[#47682d]' : 'bg-gray-200')}
                >
                  <span className={'block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ' + (features[key] ? 'translate-x-4' : 'translate-x-0')} />
                </button>
              ) : (
                <Input
                  type="number"
                  className="h-6 w-20 text-xs"
                  value={features[key] ?? ''}
                  onChange={(e) => setFeature(key, parseInt(e.target.value))}
                  placeholder="-1"
                />
              )}
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !name} className="bg-[#14314F] text-white">
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Save plan
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  role: string;
  created_at: string;
}

function FeeRow({
  fee,
  onSave,
}: {
  fee: GradingFeeSchedule;
  onSave: (id: string, price: number, turnaround: number) => Promise<void>;
}) {
  const [price, setPrice] = useState(fee.price.toString());
  const [days, setDays] = useState((fee.turnaround_days ?? '').toString());
  const [saving, setSaving] = useState(false);

  return (
    <div className="grid grid-cols-4 gap-3 items-center py-2 border-b last:border-0">
      <span className="text-sm font-medium">{fee.grading_service} — {fee.tier_name}</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <Input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="pl-5 h-7 text-sm"
        />
      </div>
      <Input
        type="number"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        placeholder="Days"
        className="h-7 text-sm"
      />
      <Button
        size="sm"
        className="h-7 px-3 text-xs bg-[#47682d] text-white"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(fee.id, parseFloat(price) || 0, parseInt(days) || 0);
          setSaving(false);
        }}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
      </Button>
    </div>
  );
}

export default function AdminPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<GradingFeeSchedule[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [feeFilter,   setFeeFilter]   = useState<GradingService>('PSA');
  const [plans,       setPlans]       = useState<SubscriptionPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<string | null>(null); // plan id or 'new'

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data);
        setIsAdmin(data?.role === 'admin');
        setLoading(false);
        if (data?.role === 'admin') {
          loadFees();
          loadUsers();
          loadPlans();
        }
      });
  }, [user]);

  const loadFees = async () => {
    const { data } = await supabase
      .from('grading_fee_schedules')
      .select('*')
      .is('user_id', null)
      .order('grading_service')
      .order('price');
    setFees((data as GradingFeeSchedule[]) ?? []);
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data as Profile[]) ?? []);
  };

  const saveFee = async (id: string, price: number, turnaround_days: number) => {
    const { error } = await supabase
      .from('grading_fee_schedules')
      .update({ price, turnaround_days })
      .eq('id', id);

    if (error) toast({ title: 'Error saving fee', variant: 'destructive' });
    else {
      toast({ title: 'Fee updated' });
      await loadFees();
    }
  };

  const loadPlans = async () => {
    const { data } = await supabase.from('subscription_plans').select('*').order('sort_order');
    setPlans((data as SubscriptionPlan[]) ?? []);
  };

  const savePlan = async (id: string | null, data: Partial<SubscriptionPlan>) => {
    if (id) {
      const { error } = await supabase.from('subscription_plans').update(data).eq('id', id);
      if (error) toast({ title: 'Error saving plan', variant: 'destructive' });
      else toast({ title: 'Plan updated' });
    } else {
      const { error } = await supabase.from('subscription_plans').insert({ ...data, is_active: true });
      if (error) toast({ title: 'Error creating plan', variant: 'destructive' });
      else toast({ title: 'Plan created' });
    }
    setEditingPlan(null);
    await loadPlans();
  };

  const togglePlanActive = async (plan: SubscriptionPlan) => {
    await supabase.from('subscription_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    await loadPlans();
  };

  const assignUserPlan = async (userId: string, planId: string) => {
    const { error } = await supabase.from('profiles').update({ subscription_plan_id: planId }).eq('id', userId);
    if (error) toast({ title: 'Error assigning plan', variant: 'destructive' });
    else { toast({ title: 'Plan assigned' }); await loadUsers(); }
  };

  const updateUserRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) toast({ title: 'Error updating role', variant: 'destructive' });
    else { toast({ title: 'Role updated' }); await loadUsers(); }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#47682d]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="h-12 w-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Admin access required</h2>
        <p className="text-gray-500 text-sm">You don't have permission to view this page.</p>
      </div>
    );
  }

  const feesByService = fees.filter((f) => f.grading_service === feeFilter);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Admin portal</h2>
        <p className="text-gray-500 mt-1">Manage fees, users, and platform settings.</p>
      </div>

      <Tabs defaultValue="fees">
        <TabsList>
          <TabsTrigger value="fees" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Fee schedules
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Subscriptions
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Fee Schedules */}
        <TabsContent value="fees" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grading fee schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4 flex-wrap">
                {GRADING_SERVICES.map((svc) => (
                  <button
                    key={svc}
                    onClick={() => setFeeFilter(svc)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${feeFilter === svc ? 'bg-[#14314F] text-white border-[#14314F]' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {svc}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs text-gray-400 font-medium mb-1">
                <span>Service / Tier</span><span>Price</span><span>Days</span><span></span>
              </div>
              {feesByService.length === 0 ? (
                <p className="text-sm text-gray-400">No fees found for {feeFilter}.</p>
              ) : (
                feesByService.map((f) => <FeeRow key={f.id} fee={f} onSave={saveFee} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscriptions */}
        <TabsContent value="subscriptions" className="mt-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Subscription plans ({plans.length})</CardTitle>
              <Button size="sm" className="bg-[#14314F] text-white h-7 px-3 text-xs" onClick={() => setEditingPlan('new')}>
                <Plus className="w-3 h-3 mr-1" /> New plan
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {editingPlan === 'new' && (
                <PlanForm
                  onSave={(data) => savePlan(null, data)}
                  onCancel={() => setEditingPlan(null)}
                />
              )}
              {plans.map((plan) => (
                <div key={plan.id}>
                  {editingPlan === plan.id ? (
                    <PlanForm
                      initial={plan}
                      onSave={(data) => savePlan(plan.id, data)}
                      onCancel={() => setEditingPlan(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between rounded-xl border p-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#14314F]">{plan.name}</p>
                          <Badge className={plan.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400'}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {plan.price_monthly === 0
                            ? <Badge variant="outline">Free</Badge>
                            : <Badge variant="outline">${plan.price_monthly}/mo</Badge>}
                        </div>
                        {plan.description && <p className="text-xs text-gray-500">{plan.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(plan.features).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              {k}: {typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingPlan(plan.id)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => togglePlanActive(plan)}>
                          {plan.is_active ? <X className="w-3 h-3 text-gray-400" /> : <Check className="w-3 h-3 text-green-500" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {plans.length === 0 && editingPlan !== 'new' && (
                <p className="text-sm text-gray-400 text-center py-4">No plans yet — create one above.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{u.full_name ?? 'No name'}</p>
                      <p className="text-xs text-gray-500 font-mono">{u.id.slice(0, 16)}…</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="text-xs border rounded px-2 py-1 text-gray-600 h-7"
                        value={(u as any).subscription_plan_id ?? ''}
                        onChange={(e) => assignUserPlan(u.id, e.target.value)}
                      >
                        <option value="">Free (default)</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <Badge className={u.role === 'admin' ? 'bg-[#14314F] text-white' : 'bg-gray-100 text-gray-600'}>
                        {u.role}
                      </Badge>
                      {u.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => updateUserRole(u.id, u.role === 'admin' ? 'collector' : 'admin')}
                        >
                          {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                API keys and scanner settings are configured via environment variables on the server.
                Contact your system administrator to update these values.
              </p>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Grade Ranger AI API</Label>
                <Input disabled value="Configured via server environment" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">TCG API (market data)</Label>
                <Input disabled value="Configured via server environment" className="text-sm" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
