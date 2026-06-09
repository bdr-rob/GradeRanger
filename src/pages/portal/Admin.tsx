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
import { Loader2, ShieldAlert, Users, DollarSign, Settings } from 'lucide-react';
import type { GradingFeeSchedule, GradingService } from '@/types/cards';
import { GRADING_SERVICES } from '@/types/cards';

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
  const [feeFilter, setFeeFilter] = useState<GradingService>('PSA');

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
