import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search, Image, CheckCircle2, Link } from 'lucide-react'

interface CardCandidate {
  cardHedgeId: string
  player:      string
  setName:     string
  cardNumber:  string
  variant:     string
  category:    string
  description: string
  cardImage:   string
  year:        string
}

interface Props {
  cardId:        string
  cardName?:     string
  playerName?:   string
  year?:         string
  setName?:      string
  cardNumber?:   string
  isGraded?:     boolean
  frontImageUrl?: string | null
  open:          boolean
  onOpenChange:  (open: boolean) => void
  onLinked:      () => void
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({ label, icon, active, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[#14314F] text-[#14314F]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}{label}
    </button>
  )
}

// ── Candidate card ────────────────────────────────────────────────────────────

function CandidateCard({ c, selected, onSelect }: {
  c: CardCandidate; selected: boolean; onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
        selected
          ? 'border-[#14314F] bg-blue-50 ring-1 ring-[#14314F]'
          : 'border-gray-200 hover:border-gray-400 bg-white'
      }`}
    >
      {c.cardImage ? (
        <img src={c.cardImage} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
      ) : (
        <div className="w-10 h-14 bg-gray-100 rounded shrink-0 flex items-center justify-center">
          <Image className="w-4 h-4 text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{c.player || c.description || 'Unknown'}</p>
        <p className="text-xs text-gray-500 truncate">{[c.year, c.setName].filter(Boolean).join(' · ')}</p>
        {c.cardNumber && <p className="text-xs text-gray-400">#{c.cardNumber}</p>}
        {c.variant && <p className="text-xs text-blue-600 font-medium">{c.variant}</p>}
      </div>
      {selected && <CheckCircle2 className="w-4 h-4 text-[#14314F] shrink-0" />}
    </button>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export default function LinkCardHedgerDialog({
  cardId, cardName, playerName, year, setName, cardNumber,
  frontImageUrl, open, onOpenChange, onLinked,
}: Props) {
  const { toast } = useToast()
  const [tab, setTab]               = useState<'search' | 'photo'>('search')
  const [candidates, setCandidates] = useState<CardCandidate[]>([])
  const [selected, setSelected]     = useState<CardCandidate | null>(null)
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const autoQuery = [year, playerName, setName, cardNumber].filter(Boolean).join(' ').trim()
  const [query, setQuery] = useState(autoQuery)

  // Auto-search when the dialog opens if we have card metadata
  useEffect(() => {
    if (open && autoQuery) {
      setQuery(autoQuery)
      handleSearch(autoQuery)
    }
  }, [open])

  function reset() {
    setQuery(autoQuery); setCandidates([]); setSelected(null)
    setPhotoPreview(null); setLoading(false)
  }

  // ── Search tab ──────────────────────────────────────────────────────────────

  async function handleSearch(override?: string) {
    const q = (override ?? query).trim()
    if (!q) return
    setLoading(true); setCandidates([]); setSelected(null)
    try {
      const { data, error } = await supabase.functions.invoke('cardhedge', {
        body: { mode: 'search', search: q, page_size: 10 },
      })
      if (error) throw error
      const cards: CardCandidate[] = (data?.cards ?? data?.results ?? []).map((c: any) => ({
        cardHedgeId: c.card_id   ?? c.cardHedgeId ?? '',
        player:      c.player    ?? '',
        setName:     c.set       ?? c.setName     ?? '',
        cardNumber:  c.number    ?? c.cardNumber  ?? '',
        variant:     c.variant   ?? '',
        category:    c.category  ?? '',
        description: c.description ?? '',
        cardImage:   c.image     ?? c.cardImage   ?? '',
        year:        c.year      ?? '',
      })).filter((c: CardCandidate) => c.cardHedgeId)
      setCandidates(cards)
      if (!cards.length) toast({ title: 'No results found', description: 'Try different search terms.' })
    } catch {
      toast({ title: 'Search failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ── Photo tab ───────────────────────────────────────────────────────────────

  async function runImageMatch(base64: string) {
    setLoading(true); setCandidates([]); setSelected(null)
    try {
      const { data, error } = await supabase.functions.invoke('cardhedge', {
        body: { mode: 'image-match', image_base64: base64 },
      })
      if (error) throw error

      const list: CardCandidate[] = []
      if (data?.matched && data?.cardHedgeId) {
        list.push({
          cardHedgeId: data.cardHedgeId,
          player:      data.player      ?? '',
          setName:     data.setName     ?? '',
          cardNumber:  data.cardNumber  ?? '',
          variant:     data.variant     ?? '',
          category:    data.category    ?? '',
          description: data.description ?? '',
          cardImage:   data.cardImage   ?? '',
          year:        data.year        ?? '',
        })
      }
      ;(data?.candidates ?? []).forEach((c: any) => {
        if (c.cardHedgeId && !list.find((x) => x.cardHedgeId === c.cardHedgeId)) {
          list.push(c)
        }
      })
      setCandidates(list)
      if (list[0]) setSelected(list[0])
      if (!list.length) toast({ title: 'No match found', description: 'Try a clearer photo or use Search.' })
    } catch {
      toast({ title: 'Image match failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function useExistingPhoto() {
    if (!frontImageUrl) return
    setPhotoPreview(frontImageUrl)
    // Fetch image and convert to base64
    try {
      const res  = await fetch(frontImageUrl)
      const blob = await res.blob()
      const b64  = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve((e.target?.result as string) ?? '')
        reader.readAsDataURL(blob)
      })
      await runImageMatch(b64)
    } catch {
      toast({ title: 'Could not load card image', variant: 'destructive' })
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve((ev.target?.result as string) ?? '')
      reader.readAsDataURL(file)
    })
    setPhotoPreview(b64)
    await runImageMatch(b64)
    e.target.value = ''
  }

  // ── Save link ───────────────────────────────────────────────────────────────

  async function handleLink() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase
      .from('cards')
      .update({ cardhedge_card_id: selected.cardHedgeId })
      .eq('id', cardId)
    setSaving(false)
    if (error) {
      toast({ title: 'Failed to link card', variant: 'destructive' })
      return
    }
    toast({ title: 'Card linked to Card Hedger', description: selected.player || selected.description })
    onOpenChange(false)
    reset()
    onLinked()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#14314F]">
            <Link className="w-4 h-4" />
            Link to Card Hedger
          </DialogTitle>
          {cardName && <p className="text-sm text-gray-500 mt-0.5">{cardName}</p>}
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b -mx-6 px-6">
          <Tab label="Search" icon={<Search className="w-3.5 h-3.5" />} active={tab === 'search'} onClick={() => { setTab('search'); setCandidates([]); setSelected(null) }} />
          <Tab label="Photo Match" icon={<Image className="w-3.5 h-3.5" />} active={tab === 'photo'} onClick={() => { setTab('photo'); setCandidates([]); setSelected(null) }} />
        </div>

        {/* Search tab */}
        {tab === 'search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. 2018 Shohei Ohtani Topps Chrome"
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading || !query.trim()} className="bg-[#14314F] hover:bg-[#0f2438] text-white shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Photo tab */}
        {tab === 'photo' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {frontImageUrl && (
                <Button variant="outline" size="sm" onClick={useExistingPhoto} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Image className="w-3.5 h-3.5 mr-1.5" />}
                  Use card's existing photo
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={loading} className={frontImageUrl ? '' : 'flex-1'}>
                Upload photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
            {photoPreview && (
              <img src={photoPreview} alt="Card to match" className="h-28 object-contain rounded border mx-auto block" />
            )}
          </div>
        )}

        {/* Candidates */}
        {candidates.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {candidates.length} result{candidates.length !== 1 ? 's' : ''} — pick the correct card
            </p>
            {candidates.map((c) => (
              <CandidateCard
                key={c.cardHedgeId}
                c={c}
                selected={selected?.cardHedgeId === c.cardHedgeId}
                onSelect={() => setSelected(c)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 pt-1 border-t">
          <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); reset() }}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#14314F] hover:bg-[#0f2438] text-white"
            disabled={!selected || saving}
            onClick={handleLink}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link className="w-4 h-4 mr-2" />}
            Link card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
