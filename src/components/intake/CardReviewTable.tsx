import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { RecognizedCard } from '@/lib/ximilar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, AlertTriangle, CheckCircle2 } from 'lucide-react'

const PURCHASE_LOCATIONS = [
  'eBay', 'PWCC', 'Goldin', 'Heritage Auctions', 'Local Card Shop',
  'Card Show', 'Facebook Marketplace', 'FaceBook Group','Whatnot', 'Fanatics', 'Other'
]

interface CardState {
  player: string
  year: string
  name: string
  set_name: string
  card_number: string
  sport: string
  parallel: string
  variation: string
  company: string
  purchasePrice: string
  purchaseLocation: string
  rarity: string
  language: string
  release_date: string
  series: string
  set_abbreviation: string
  artist: string
  hp: string
  pokedex_number: string
  evolves_from: string
  flavor_text: string
  description: string
  attributes: string[]
  release_name: string
}

interface Props {
  cards: RecognizedCard[]
  onSaved: () => void
}

function initState(card: RecognizedCard): CardState {
  return {
    player:           card.bestMatch?.player       ?? '',
    year:             card.bestMatch?.year         ?? '',
    set_name:         card.bestMatch?.set_name     ?? '',
    name: card.bestMatch?.name ?? card.bestMatch?.player ?? '',
    card_number:      card.bestMatch?.card_number  ?? '',
    sport:            card.bestMatch?.sport        ?? '',
    parallel:         card.bestMatch?.parallel     ?? '',
    variation:        card.bestMatch?.variation    ?? '',
    company:          card.bestMatch?.company      ?? '',
    purchasePrice:    card.purchasePrice           ?? '',
    purchaseLocation: card.purchaseLocation        ?? '',
    rarity:           card.bestMatch?.rarity           ?? '',
    language:         card.bestMatch?.language         ?? '',
    release_date:     card.bestMatch?.release_date     ?? '',
    series:           card.bestMatch?.series           ?? '',
    set_abbreviation: card.bestMatch?.set_abbreviation ?? '',
    artist:           card.bestMatch?.artist           ?? '',
    hp:               card.bestMatch?.hp               ?? '',
    pokedex_number:   card.bestMatch?.pokedex_number   ?? '',
    evolves_from:     card.bestMatch?.evolves_from     ?? '',
    flavor_text:      card.bestMatch?.flavor_text      ?? '',
    description:      card.bestMatch?.description      ?? '',
    attributes:       card.bestMatch?.attributes       ?? [],
    release_name:     card.bestMatch?.release_name     ?? '',
  }
}

export default function CardReviewTable({ cards, onSaved }: Props) {
  const { user } = useAuth()
  const [cardStates, setCardStates] = useState<CardState[]>(() => cards.map(initState))
  const [saving, setSaving] = useState(false)
  const [backVisible, setBackVisible] = useState<boolean[]>(() => cards.map(() => false))


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
          if (uploadErr) {
            console.error('Front image upload failed:', uploadErr.message)
            // Don't block the save — continue without image
          } else {
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
          if (uploadErr) {
            console.error('Back image upload failed:', uploadErr.message)
          } else {
            const { data } = supabase.storage.from('card-images').getPublicUrl(backPath)
            backUrl = data.publicUrl
          }
        }

        const { data: insertedCard, error: insertError } = await supabase
        .from('cards')
        .insert({
          user_id:          user.id,
      
          // Core identity
          card_name:        state.player || state.name || state.set_name || 'Unknown Card',
          player_name:      state.player,
          year:             state.year,
          set_name:         state.set_name,
          card_number:      state.card_number,
          sport:            state.sport,
          parallel:         state.parallel,
          variation:        state.variation,
          company:          state.company,
      
          // Purchase info
          purchase_price:    parseFloat(state.purchasePrice) || null,
          purchase_location: state.purchaseLocation || null,
      
          // CardSight IDs & market
          cardsight_card_id: card.cardsightCardId || null,
          market_value:      card.marketValue     || null,
      
          // Rich CardSight fields
          rarity:           state.rarity           || null,
          language:         state.language         || null,
          release_date:     state.release_date     || null,
          series:           state.series           || null,
          set_abbreviation: state.set_abbreviation || null,
          artist:           state.artist           || null,
          hp:               state.hp               || null,
          pokedex_number:   state.pokedex_number   || null,
          evolves_from:     state.evolves_from     || null,
          flavor_text:      state.flavor_text      || null,
          description:      state.description      || null,
          attributes:       state.attributes?.length ? state.attributes : null,
          release_name:     state.release_name     || null,
      
          // Image URLs
          front_image_url:  frontUrl || null,
          back_image_url:   backUrl  || null,
      
          status: 'intake',
        })
        .select()
        .single()

        if (insertError) {
          alert(`Save failed: ${insertError.message}`)
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
          const marketValue = card.marketValue ?? null

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
                  {/* Market value from CardSight */}
                  {marketValue != null && marketValue > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded px-2 py-0.5 font-medium">
                        Market: ${marketValue.toFixed(2)}
                      </span>
                      {state.purchasePrice && parseFloat(state.purchasePrice) > 0 && (
                        <span className={`text-xs font-medium ${
                          parseFloat(state.purchasePrice) <= marketValue
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}>
                          {parseFloat(state.purchasePrice) <= marketValue
                            ? `↓ $${(marketValue - parseFloat(state.purchasePrice)).toFixed(2)} below market`
                            : `↑ $${(parseFloat(state.purchasePrice) - marketValue).toFixed(2)} above market`}
                        </span>
                      )}
                    </div>
                  )}
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
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Card Name</Label>
                    <Input value={state.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="e.g. Charizard" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Variation</Label>
                    <Input value={state.variation} onChange={(e) => update(i, 'variation', e.target.value)} placeholder="e.g. 1st Edition" className="mt-1" />
                  </div>
                </div>
              </div>
              {/* Read-only CardSight details — shown for review, not editable */}
              {([
                ['Rarity', state.rarity],
                ['Language', state.language],
                ['Release Date', state.release_date],
                ['Series', state.series],
                ['Set Abbreviation', state.set_abbreviation],
                ['Artist', state.artist],
                ['HP', state.hp],
                ['Pokédex #', state.pokedex_number],
                ['Evolves From', state.evolves_from],
                ['Release Name', state.release_name],
              ] as [string, string][]).some(([, val]) => val) && (
                <div className="mt-4 pt-3 border-t grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {([
                    ['Rarity', state.rarity],
                    ['Language', state.language],
                    ['Release Date', state.release_date],
                    ['Series', state.series],
                    ['Set Abbreviation', state.set_abbreviation],
                    ['Artist', state.artist],
                    ['HP', state.hp],
                    ['Pokédex #', state.pokedex_number],
                    ['Evolves From', state.evolves_from],
                    ['Release Name', state.release_name],
                  ] as [string, string][])
                    .filter(([, val]) => val)
                    .map(([label, val]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-sm text-gray-700 mt-0.5">{val}</p>
                      </div>
                    ))}
                </div>
              )}

              {state.attributes.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Attributes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {state.attributes.map((attr) => (
                      <Badge key={attr} variant="outline" className="text-xs font-normal">
                        {attr.replace(/^pokemon-/, '').replace(/-/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {state.description && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Card Text</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{state.description}</p>
                </div>
              )}

              {state.flavor_text && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Flavor Text</p>
                  <p className="text-sm text-gray-500 italic">"{state.flavor_text}"</p>
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