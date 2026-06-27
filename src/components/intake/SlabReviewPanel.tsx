import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { CardHedgeSlabResult } from '@/lib/cardhedge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, Award, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react'
import { PURCHASE_LOCATIONS } from '@/lib/purchaseLocations'

const GRADING_COMPANIES = ['PSA', 'BECKETT', 'CGC', 'SGC', 'ACE', 'MANA', 'TAG']

interface Props {
  slab: CardHedgeSlabResult
  onSaved: () => void
  onBack: () => void
}

export default function SlabReviewPanel({ slab, onSaved, onBack }: Props) {
  const { user } = useAuth()

  const [gradeCompany,          setGradeCompany]          = useState(slab.gradeCompany)
  const [gradeValue,            setGradeValue]            = useState(slab.gradeValue)
  const [certNumber,            setCertNumber]            = useState(slab.certNumber)
  const [player,                setPlayer]                = useState(slab.player)
  const [year,                  setYear]                  = useState(slab.year)
  const [setName,               setSetName]               = useState(slab.setName)
  const [cardNumber,            setCardNumber]            = useState(slab.cardNumber)
  const [purchasePrice,         setPurchasePrice]         = useState(slab.purchasePrice)
  const [purchaseLocation,      setPurchaseLocation]      = useState(slab.purchaseLocation)
  const [purchaseOrder,         setPurchaseOrder]         = useState('')
  const [purchaseLocationOther, setPurchaseLocationOther] = useState('')
  const [saving,                setSaving]                = useState(false)
  const [error,                 setError]                 = useState<string | null>(null)

  const identified  = !!(gradeCompany && gradeValue)
  const recentSales = slab.recentSales?.slice(0, 5) ?? []
  const marketValue = slab.marketValue

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)

    try {
      let frontUrl: string | null = null
      if (slab.image.base64) {
        const bytes = Uint8Array.from(atob(slab.image.base64), (c) => c.charCodeAt(0))
        const path  = `${user.id}/${slab.localId}_front.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('card-images')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
        if (!uploadErr) {
          const { data } = supabase.storage.from('card-images').getPublicUrl(path)
          frontUrl = data.publicUrl
        }
      }

      const effectiveLocation = purchaseLocation === 'Other'
        ? (purchaseLocationOther || 'Other')
        : (purchaseLocation || null)

      const { error: insertError } = await supabase.from('cards').insert({
        user_id:           user.id,
        card_name:         player || setName || 'Graded Slab',
        player_name:       player           || null,
        year:              year             || null,
        set_name:          setName          || null,
        card_number:       cardNumber       || null,
        is_graded:         true,
        grading_company:   gradeCompany     || null,
        official_grade:    gradeValue       || null,
        cert_number:       certNumber       || null,
        purchase_price:    parseFloat(purchasePrice) || null,
        purchase_location: effectiveLocation,
        purchase_order:    purchaseOrder    || null,
        market_value:      marketValue      || null,
        front_image_url:   frontUrl         || slab.cardImage || null,
        status:            'intake',
      })

      if (insertError) { setError(insertError.message); return }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#14314F]">Review Graded Slab</h2>
          <p className="text-sm text-muted-foreground">Confirm details and add purchase info before saving.</p>
        </div>
        <button onClick={onBack} className="text-sm text-[#14314F] hover:underline">← Back</button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <div className="border rounded-lg p-5 bg-white shadow-sm space-y-5">
        {/* Confidence badge */}
        <div className="flex items-center gap-3">
          {identified ? (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Slab identified
              {slab.confidence > 0 && slab.confidence < 1 && ` (${Math.round(slab.confidence * 100)}% confidence)`}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Grade not detected — fill in manually
            </Badge>
          )}
          {marketValue != null && (
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              Market: ${marketValue.toFixed(2)}
            </Badge>
          )}
        </div>

        <div className="flex gap-5">
          {/* Slab / card image */}
          <div className="shrink-0">
            {slab.image.preview ? (
              <img src={slab.image.preview} alt="Slab" className="w-28 h-40 object-cover rounded border" />
            ) : slab.cardImage ? (
              <img src={slab.cardImage.startsWith('//') ? `https:${slab.cardImage}` : slab.cardImage}
                alt="Card" className="w-28 h-40 object-cover rounded border" />
            ) : (
              <div className="w-28 h-40 rounded border bg-gray-100 flex items-center justify-center">
                <Award className="w-8 h-8 text-gray-300" />
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {/* Grade section */}
            <div className="col-span-2">
              <div className="flex items-center gap-1.5 mb-3">
                <Award className="w-4 h-4 text-[#14314F]" />
                <span className="text-sm font-semibold text-[#14314F] uppercase tracking-wide">Grade Info</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Grading Company</Label>
                  <Select value={gradeCompany} onValueChange={setGradeCompany}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADING_COMPANIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Grade</Label>
                  <Input value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} placeholder="e.g. 9.5" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cert Number</Label>
                  <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="e.g. 12345678" className="mt-1" />
                </div>
              </div>
            </div>

            {/* Card identity */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Player / Name</Label>
              <Input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="e.g. Michael Jordan" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1986" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Set</Label>
              <Input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="e.g. Fleer" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Card #</Label>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="e.g. 57" className="mt-1" />
            </div>
          </div>
        </div>

        {/* Recent sales from Card Hedger */}
        {recentSales.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-[#14314F]" />
              <span className="text-sm font-semibold text-[#14314F] uppercase tracking-wide">Recent Sales</span>
            </div>
            <div className="space-y-1.5">
              {recentSales.map((sale, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 text-xs">
                    {sale.date ? new Date(sale.date).toLocaleDateString() : '—'}
                    {sale.grade && <span className="ml-2 text-gray-400">{sale.grade}</span>}
                  </span>
                  <span className="font-semibold text-gray-800">${sale.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchase details */}
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-[#14314F] uppercase tracking-wide mb-3">Purchase Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Purchase Price ($)</Label>
              <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" className="mt-1" />
              {marketValue != null && purchasePrice && parseFloat(purchasePrice) > 0 && (
                <p className={`text-xs mt-1 font-medium ${parseFloat(purchasePrice) <= marketValue ? 'text-green-600' : 'text-red-500'}`}>
                  {parseFloat(purchasePrice) <= marketValue
                    ? `↓ $${(marketValue - parseFloat(purchasePrice)).toFixed(2)} below market`
                    : `↑ $${(parseFloat(purchasePrice) - marketValue).toFixed(2)} above market`}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Order #</Label>
              <Input value={purchaseOrder} onChange={(e) => setPurchaseOrder(e.target.value)} placeholder="Optional" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Purchase Location</Label>
              <Select value={purchaseLocation} onValueChange={setPurchaseLocation}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select location..." /></SelectTrigger>
                <SelectContent>
                  {PURCHASE_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent>
              </Select>
              {purchaseLocation === 'Other' && (
                <Input value={purchaseLocationOther} onChange={(e) => setPurchaseLocationOther(e.target.value)} placeholder="Where did you buy it?" className="mt-1.5" />
              )}
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full bg-[#47682d] hover:bg-[#3a5525] text-white">
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Saving...' : 'Save Graded Slab to Pipeline'}
      </Button>
    </div>
  )
}
