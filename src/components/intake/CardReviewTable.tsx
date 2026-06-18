import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { RecognizedCard } from '@/lib/ximilar'
import { lookupTcgPrice, TcgPriceResult } from '@/lib/tcgPrice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, AlertTriangle, CheckCircle2 } from 'lucide-react'

const PURCHASE_LOCATIONS = [
  'eBay', 'PWCC', 'Goldin', 'Heritage Auctions', 'Local Card Shop',
  'Card Show', 'Facebook Marketplace', 'Whatnot', 'Fanatics', 'Other',
]

interface CardState {
  player: string
  year: string
  set_name: string
  card_number: string
  sport: string
  parallel: string
  variation: string
  company: string
  purchasePrice: string
  purchaseLocation: string
}

interface Props {
  cards: RecognizedCard[]
  cardType: 'sport' | 'tcg'
  onSaved: () => void
}

function initState(card: RecognizedCard): CardState {
  return {
    player:           card.bestMatch?.player       ?? '',
    year:             card.bestMatch?.year         ?? '',
    set_name:         card.bestMatch?.set_name     ?? '',
    card_number:      card.bestMatch?.card_number  ?? '',
    sport:            card.bestMatch?.sport        ?? '',
    parallel:         card.bestMatch?.parallel     ?? '',
    variation:        card.bestMatch?.variation    ?? '',
    company:          card.bestMatch?.company      ?? '',
    purchasePrice:    card.purchasePrice           ?? '',
    purchaseLocation: card.purchaseLocation        ?? '',
  }
}

export default function CardReviewTable({ cards, cardType, onSaved }: Props) {
  const { user } = useAuth()
  const [cardStates, setCardStates] = useState<CardState[]>(() => cards.map(initState))
  const [saving, setSaving] = useState(false)
  const [backVisible, setBackVisible] = useState<boolean[]>(() => cards.map(() => false))
  const [marketPrices, setMarketPrices] = useState<Record<string, TcgPriceResult[]>>({})

  // Auto-fetch TCG market prices after identification
  useEffect(() => {
    if (cardType !== 'tcg') return
    cards.forEach(async (card) => {
      if (!card.bestMatch?.player) return
      const prices = await lookupTcgPrice(
        card.bestMatch.player,
        card.bestMatch.sport || 'pokemon',
        card.bestMatch.set_name
      )
      if (prices.length > 0) {
        setMarketPrices((prev) => ({ ...prev, [card.localId]: prices }))
      }
    })
  }, [cards, cardType])

  const update = (index: number, field: keyof CardState, value: string) => {
    setCardStates((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const toggleBack = (index: number) => {
    setBackVisible((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)

    try {
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        const state = cardStates[i]

        let frontUrl: string | null = null
        let backUrl: string | null = null

        if (card.image.base64) {
          const frontBytes = Uint8Array.from(atob(card.image.base64), (c) => c.charCodeAt(0))
          const frontPath = `${user.id}/${card.localId}_front.jpg`
          const { error: uploadErr } = await supabase.storage
            .from('card-images')
            .upload(frontPath, frontBytes, { contentType: 'image/jpeg', upsert: true })
          if (!uploadErr) {
            const { data } = supabase.storage.from('card-images').getPublicUrl(frontPath)
            frontUrl = data.publicUrl
          }
        }

        if (card.image.backBase64) {
          const backBytes = Uint8Array.from(atob(card.image.backBase64), (c) => c.charCodeAt(0))
          const backPath = `${user.id}/${card.localId}_back.jpg`
          const { error: uploadErr } = await supabase.storage
            .from('card-images')
            .upload(backPath, backBytes, { contentType: 'image/jpeg', upsert: true })
          if (!uploadErr) {
            const { data } = supabase.storage.from('card-images').getPublicUrl(backPath)
            backUrl = data.publicUrl
          }
        }

        const { error: insertErr } = await supabase.from('cards').insert({
          user_id:            user.id,
          player_name:        state.player       || null,
          year:               state.year         || null,
          card_set:           state.set_name     || null,
          card_number:        state.card_number  || null,
          sport:              state.sport        || null,
          parallel:           state.parallel     || null,
          variation:          state.variation    || null,
          company:            state.company      || null,
          purchase_price:     state.purchasePrice ? parseFloat(state.purchasePrice) : null,
          purchase_location:  state.purchaseLocation || null,
          front_image_url:    frontUrl,
          back_image_url:     backUrl,
          ximilar_confidence: card.confidence   || null,
          status:             'owned',
        })

        if (insertErr) {
          alert(`Save failed: ${insertErr.message}`)
          setSaving(false)
          return
        }
      }

      onSaved()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#14314F]">Review Identified Cards</h2>
          <p className="text-sm text-muted-foreground">Edit any fields before saving. Add purchase details per card.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#47682d] hover:bg-[#3a5525] text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : `Save ${cards.length} Card${cards.length !== 1 ? 's' : ''}`}
        </Button>
      </div>

      <div className="space-y-4">
        {cards.map((card, i) => {
          const state = cardStates[i]
          const identified = !!card.bestMatch
          const hasBack = !!card.image.backPreview
          const marketPrice = marketPrices[card.localId]?.[0]

          return (
            <div key={card.localId} className="border rounded-lg p-4 bg-white shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#14314F] text-white flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-[#14314F]">Card #{i + 1}</span>
                </div>
                {identified ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Identified ({Math.round(card.confidence * 100)}% confidence)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Not identified — fill in manually
                  </Badge>
                )}
              </div>

              <div className="flex gap-4">
                {/* Image */}
                <div className="flex-shrink-0">
                  <img
                    src={backVisible[i] && card.image.backPreview ? card.image.backPreview : card.image.preview}
                    alt={backVisible[i] ? 'Card back' : 'Card front'}
                    className="w-24 h-32 object-cover rounded border"
                  />
                  {hasBack && (
                    <button
                      onClick={() => toggleBack(i)}
                      className="mt-1 w-24 text-xs text-center text-[#14314F] underline"
                    >
                      {backVisible[i] ? 'Show front' : 'Show back'}
                    </button>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Player / Name</Label>
                    <Input value={state.player} onChange={(e) => update(i, 'player', e.target.value)} placeholder="e.g. Michael Jordan" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Year</Label>
                    <Input value={state.year} onChange={(e) => update(i, 'year', e.target.value)} placeholder="e.g. 1986" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Purchase Price ($)</Label>
                    <Input type="number" value={state.purchasePrice} onChange={(e) => update(i, 'purchasePrice', e.target.value)} placeholder="0.00" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Set</Label>
                    <Input value={state.set_name} onChange={(e) => update(i, 'set_name', e.target.value)} placeholder="e.g. Fleer" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Card #</Label>
                    <Input value={state.card_number} onChange={(e) => update(i, 'card_number', e.target.value)} placeholder="e.g. 57" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Purchase Location</Label>
                    <Select value={state.purchaseLocation} onValueChange={(v) => update(i, 'purchaseLocation', v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PURCHASE_LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sport / Category</Label>
                    <Input value={state.sport} onChange={(e) => update(i, 'sport', e.target.value)} placeholder="e.g. Basketball" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Parallel / Variation</Label>
                    <Input value={state.parallel} onChange={(e) => update(i, 'parallel', e.target.value)} placeholder="e.g. Gold Refractor" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Company</Label>
                    <Input value={state.company} onChange={(e) => update(i, 'company', e.target.value)} placeholder="e.g. Topps" className="mt-1" />
                  </div>
                </div>
              </div>

              {/* ← Market price goes HERE, full width, below the fields */}
              {cardType === 'tcg' && marketPrice && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <span className="font-medium text-blue-800">Market Price Reference: </span>
                  <span className="text-blue-700">
                    Market: ${marketPrice.market_price?.toFixed(2) ?? '—'} ·{' '}
                    Low: ${marketPrice.low_price?.toFixed(2) ?? '—'} ·{' '}
                    Median: ${marketPrice.median_price?.toFixed(2) ?? '—'}
                  </span>
                  <span className="text-blue-500 ml-1">({marketPrice.set_name})</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="w-full bg-[#47682d] hover:bg-[#3a5525] text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : `Save All ${cards.length} Cards to Portfolio`}
        </Button>
      </div>
    </div>
  )
}