import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  User, Plug, CreditCard, Eye, EyeOff,
  Check, Loader2, AlertCircle, Tag, MapPin, Truck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-[#14314F]">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Integration card ──────────────────────────────────────────────────────────

interface IntegrationConfig {
  key: string
  label: string
  description: string
  docsUrl?: string
  fields: { key: string; label: string; placeholder?: string }[]
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    key: 'ebay',
    label: 'eBay',
    description: 'Connect your eBay seller account to publish listings.',
    fields: [],  // eBay uses OAuth — handled separately below
  },
  {
    key: 'shipstation',
    label: 'ShipStation',
    description: 'Create shipping labels for grading bundles and sold cards.',
    docsUrl: 'https://www.shipstation.com/docs/api/',
    fields: [
      { key: 'api_key',    label: 'API Key',    placeholder: 'ShipStation API Key' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'ShipStation API Secret' },
    ],
  },
  {
    key: 'shippo',
    label: 'Shippo',
    description: 'Alternative shipping label provider — pay per label.',
    docsUrl: 'https://docs.goshippo.com/',
    fields: [
      { key: 'api_key', label: 'API Token', placeholder: 'shippo_live_...' },
    ],
  },
  {
    key: 'easypost',
    label: 'EasyPost',
    description: 'Multi-carrier shipping with rate shopping.',
    docsUrl: 'https://docs.easypost.com/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'EZxxxxxxxx...' },
    ],
  },
]

function IntegrationCard({
  config, saved, onSave, onRemove,
}: {
  config: IntegrationConfig
  saved: Record<string, string>
  onSave: (key: string, values: Record<string, string>) => Promise<void>
  onRemove: (key: string) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map((f) => [f.key, saved[f.key] ?? '']))
  )
  const [saving, setSaving] = useState(false)
  const isConnected = config.fields.length > 0
    ? config.fields.every((f) => !!saved[f.key])
    : false

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(config.key, values) } finally { setSaving(false) }
  }

  const handleRemove = async () => {
    setSaving(true)
    try { await onRemove(config.key) } finally { setSaving(false) }
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{config.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
        </div>
        {isConnected
          ? <Badge className="bg-green-50 text-green-700 border-green-200">Connected</Badge>
          : <Badge variant="outline" className="text-gray-400">Not connected</Badge>}
      </div>

      {config.fields.length > 0 && (
        <div className="space-y-2">
          {config.fields.map((f) => (
            <PasswordField
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              placeholder={f.placeholder}
            />
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {isConnected ? 'Update' : 'Connect'}
            </Button>
            {isConnected && (
              <Button size="sm" variant="outline" onClick={handleRemove} disabled={saving}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      )}

      {config.docsUrl && (
        <p className="text-xs text-gray-400">
          <a href={config.docsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500">
            View API docs
          </a>
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth()
  const { plan, status } = useSubscription()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)

  // Profile
  const [fullName,  setFullName]  = useState('')
  const [shipFrom,  setShipFrom]  = useState({ name: '', company: '', street1: '', city: '', state: '', zip: '', country: 'US', phone: '' })

  // Integrations JSONB from profiles
  const [integrations, setIntegrations] = useState<Record<string, Record<string, string>>>({})

  // eBay OAuth
  const [ebayConnection,  setEbayConnection]  = useState<any>(null)
  const [connectingEbay,  setConnectingEbay]  = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: profile }, { data: ebay }] = await Promise.all([
        supabase.from('profiles').select('full_name, ship_from_address, integrations').eq('id', user.id).single(),
        supabase.from('marketplace_connections').select('*').eq('user_id', user.id).eq('platform', 'ebay').eq('is_active', true).maybeSingle(),
      ])
      if (profile) {
        setFullName(profile.full_name ?? '')
        if (profile.ship_from_address && Object.keys(profile.ship_from_address).length) {
          setShipFrom((prev) => ({ ...prev, ...profile.ship_from_address }))
        }
        setIntegrations(profile.integrations ?? {})
      }
      setEbayConnection(ebay)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Profile save ─────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ full_name: fullName, ship_from_address: shipFrom }).eq('id', user.id)
    if (error) toast({ title: 'Could not save profile', variant: 'destructive' })
    else toast({ title: 'Profile saved' })
  }

  // ── Integration save/remove ───────────────────────────────────────────────
  async function saveIntegration(providerKey: string, values: Record<string, string>) {
    if (!user) return
    const updated = { ...integrations, [providerKey]: values }
    const { error } = await supabase.from('profiles').update({ integrations: updated }).eq('id', user.id)
    if (error) toast({ title: 'Could not save integration', variant: 'destructive' })
    else { setIntegrations(updated); toast({ title: providerKey + ' connected' }) }
  }

  async function removeIntegration(providerKey: string) {
    if (!user) return
    const updated = { ...integrations }
    delete updated[providerKey]
    const { error } = await supabase.from('profiles').update({ integrations: updated }).eq('id', user.id)
    if (error) toast({ title: 'Could not remove integration', variant: 'destructive' })
    else { setIntegrations(updated); toast({ title: providerKey + ' disconnected' }) }
  }

  // ── eBay OAuth ───────────────────────────────────────────────────────────
  async function connectEbay() {
    setConnectingEbay(true)
    try {
      const { data, error } = await supabase.functions.invoke('ebay-oauth', { body: { action: 'authorize_url' } })
      if (error || data?.error) throw new Error(data?.error ?? error?.message)
      window.location.href = data.url
    } catch (err) {
      toast({ title: 'Could not start eBay connection', variant: 'destructive' })
      setConnectingEbay(false)
    }
  }

  async function disconnectEbay() {
    if (!user) return
    await supabase.from('marketplace_connections').update({ is_active: false }).eq('user_id', user.id).eq('platform', 'ebay')
    setEbayConnection(null)
    toast({ title: 'eBay disconnected' })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Settings</h2>
        <p className="text-gray-500 text-sm mt-0.5">Manage your profile, integrations, and billing</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5"><Plug className="w-3.5 h-3.5" />Integrations</TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />Billing</TabsTrigger>
        </TabsList>

        {/* ── Profile tab ────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Section title="Account" description="Your name and login email">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user?.email ?? ''} disabled className="text-gray-400" />
              </div>
            </div>
            <Button onClick={saveProfile} className="bg-[#14314F] hover:bg-[#14314F]/90 text-white">Save</Button>
          </Section>

          <Section
            title="Ship-From Address"
            description="Your return address — printed on every shipping label you create."
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <MapPin className="w-3.5 h-3.5" /> Used for grading submissions and sold card labels
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'name',    label: 'Full name',    col: 1 },
                { key: 'company', label: 'Company',      col: 1 },
                { key: 'street1', label: 'Address',      col: 2 },
                { key: 'city',    label: 'City',         col: 1 },
                { key: 'state',   label: 'State',        col: 1 },
                { key: 'zip',     label: 'ZIP',          col: 1 },
                { key: 'phone',   label: 'Phone',        col: 1 },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={(shipFrom as any)[key] ?? ''}
                    onChange={(e) => setShipFrom((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={label}
                  />
                </div>
              ))}
            </div>
            <Button onClick={saveProfile} className="bg-[#14314F] hover:bg-[#14314F]/90 text-white">Save address</Button>
          </Section>
        </TabsContent>

        {/* ── Integrations tab ───────────────────────────────────────────── */}
        <TabsContent value="integrations" className="space-y-4 mt-4">

          {/* eBay OAuth (special case) */}
          <Section title="eBay" description="Connect your eBay seller account to publish listings.">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Tag className="w-3.5 h-3.5" /> Required for publishing listings to eBay
            </div>
            {ebayConnection ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Check className="w-4 h-4" />
                  Connected{ebayConnection.store_name ? ' — ' + ebayConnection.store_name : ''}
                </div>
                <Button variant="outline" size="sm" onClick={disconnectEbay}>Disconnect</Button>
              </div>
            ) : (
              <Button
                onClick={connectEbay}
                disabled={connectingEbay}
                className="bg-[#14314F] hover:bg-[#14314F]/90 text-white"
              >
                {connectingEbay && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Connect eBay account
              </Button>
            )}
          </Section>

          {/* Shipping providers */}
          <Section title="Shipping" description="Connect a shipping provider to create labels for grading bundles and sold cards.">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <Truck className="w-3.5 h-3.5" /> Connect one or more providers — you can switch per label
            </div>
            <div className="space-y-3">
              {INTEGRATIONS.filter((i) => i.key !== 'ebay').map((config) => (
                <IntegrationCard
                  key={config.key}
                  config={config}
                  saved={integrations[config.key] ?? {}}
                  onSave={saveIntegration}
                  onRemove={removeIntegration}
                />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* ── Billing tab ────────────────────────────────────────────────── */}
        <TabsContent value="billing" className="space-y-4 mt-4">
          <Section title="Current Plan" description="Your active subscription">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[#14314F]">{plan?.name ?? 'Free'}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {plan?.price_monthly === 0 ? 'Free forever' : '$' + plan?.price_monthly + '/mo'}
                </p>
              </div>
              <Badge
                className={
                  status === 'active'   ? 'bg-green-50 text-green-700 border-green-200' :
                  status === 'trialing' ? 'bg-blue-50 text-blue-700 border-blue-200'   :
                  status === 'past_due' ? 'bg-red-50 text-red-700 border-red-200'      :
                  'bg-gray-100 text-gray-500'
                }
              >
                {status}
              </Badge>
            </div>

            {plan?.features && Object.keys(plan.features).length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan includes</p>
                {Object.entries(plan.features).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm text-gray-600">
                    {v === false
                      ? <AlertCircle className="w-3.5 h-3.5 text-gray-300" />
                      : <Check className="w-3.5 h-3.5 text-green-500" />}
                    <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                    {typeof v === 'number' && <span className="text-gray-400 ml-auto">{v === -1 ? 'Unlimited' : v}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <p className="text-sm text-gray-400 italic">Stripe billing portal coming soon — contact us to change your plan.</p>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
