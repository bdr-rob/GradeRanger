import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Package, TrendingUp, TrendingDown, DollarSign, BarChart2,
  ScanLine, Award, Tag, CheckCircle2, Plus, ArrowRight,
  ExternalLink, ChevronDown, ChevronRight as ChevronRightIcon, Loader2, Link2, Trash2,
} from 'lucide-react'
import type { Card, Purchase, AIReport, MarketValuation, GradingBundle, GradingService } from '@/types/cards'
import { GRADING_SERVICES, GRADING_SERVICE_TIERS } from '@/types/cards'
import ConfirmGradeDialog from '@/components/portal/ConfirmGradeDialog'
import LinkCardHedgerDialog from '@/components/portal/LinkCardHedgerDialog'
import { useLightbox } from '@/contexts/LightboxContext'

// Status a card can be moved to from the kanban
const NEXT_STATUSES: Record<string, { label: string; status: string }[]> = {
  intake:  [{ label: 'Send to grading', status: 'grading' }, { label: 'List it', status: 'listed' }, { label: 'Move to collection', status: 'collection' }],
  grading: [{ label: 'Mark as listed', status: 'listed' }, { label: 'Back to intake', status: 'intake' }, { label: 'Move to collection', status: 'collection' }],
  listed:  [{ label: 'Mark as sold', status: 'sold' }, { label: 'Back to grading', status: 'grading' }, { label: 'Move to collection', status: 'collection' }],
  sold:    [{ label: 'Back to listed', status: 'listed' }, { label: 'Move to collection', status: 'collection' }],
}

const BUNDLE_STATUS_COLORS: Record<string, string> = {
  building:  'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  at_grader: 'bg-orange-100 text-orange-700',
  returned:  'bg-green-100 text-green-700',
}
const BUNDLE_STATUS_LABELS: Record<string, string> = {
  building:  'Building',
  submitted: 'Submitted',
  at_grader: 'At Grader',
  returned:  'Returned',
}

interface CardRow extends Card {
  purchases?: Purchase
  ai_reports?: AIReport
  market_valuations?: MarketValuation
}

// â”€â”€ Pipeline stage definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STAGES = [
  {
    key:         'intake',
    label:       'Intake',
    icon:        <ScanLine className="w-4 h-4" />,
    headerBg:    'bg-blue-600',
    columnBg:    'bg-blue-50/60',
    borderColor: 'border-blue-200',
    badgeBg:     'bg-blue-600',
    action:      'Scan cards',
    actionRoute: '/portal/intake',
    match: (c: CardRow) => c.status === 'intake',
  },
  {
    key:         'grading',
    label:       'Grading',
    icon:        <Award className="w-4 h-4" />,
    headerBg:    'bg-amber-500',
    columnBg:    'bg-amber-50/60',
    borderColor: 'border-amber-200',
    badgeBg:     'bg-amber-500',
    action:      'Manage bundles',
    actionRoute: '/portal/grading',
    match: (c: CardRow) => c.status === 'grading',
  },
  {
    key:         'listed',
    label:       'Listed',
    icon:        <Tag className="w-4 h-4" />,
    headerBg:    'bg-orange-500',
    columnBg:    'bg-orange-50/60',
    borderColor: 'border-orange-200',
    badgeBg:     'bg-orange-500',
    action:      'View listings',
    actionRoute: '/portal/listings',
    match: (c: CardRow) => c.status === 'listed',
  },
  {
    key:         'sold',
    label:       'Sold',
    icon:        <CheckCircle2 className="w-4 h-4" />,
    headerBg:    'bg-green-600',
    columnBg:    'bg-green-50/60',
    borderColor: 'border-green-200',
    badgeBg:     'bg-green-600',
    action:      null,
    actionRoute: null,
    match: (c: CardRow) => c.status === 'sold',
  },
]

// â”€â”€ Small helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function cardCost(c: CardRow): number {
  return (c as any).purchase_price ?? c.purchases?.cost_basis ?? 0
}
function cardValue(c: CardRow): number {
  return (c as any).market_value ?? c.market_valuations?.raw_median ?? 0
}

function CardThumb({ card, size = 'sm' }: { card: CardRow; size?: 'sm' | 'lg' }) {
  const { open: openLightbox } = useLightbox()
  const url = (card as any).front_image_url ?? card.image_front_url ?? null
  const backUrl = (card as any).back_image_url ?? card.image_back_url ?? null
  const dims = size === 'lg' ? 'w-24 h-32' : 'w-10 h-14'
  if (url) return (
    <img
      src={url}
      alt=""
      className={`${dims} object-contain rounded shrink-0 bg-gray-50 cursor-pointer`}
      onClick={(e) => {
        e.stopPropagation()
        openLightbox([{ src: url, alt: 'Front' }, ...(backUrl ? [{ src: backUrl, alt: 'Back' }] : [])])
      }}
    />
  )
  return (
    <div className={`${dims} rounded bg-gray-100 flex items-center justify-center shrink-0`}>
      <Package className={`${size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'} text-gray-300`} />
    </div>
  )
}

// â”€â”€ Bundle picker (used inside CardModal when moving to grading) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type BundleStep = 'pick' | 'create'

function BundlePickerStep({
  cardId,
  buildingBundles,
  onConfirm,
  onBack,
}: {
  cardId: string
  buildingBundles: GradingBundle[]
  onConfirm: (bundleId: string) => Promise<void>
  onBack: () => void
}) {
  const { user } = useAuth()
  const [step, setStep]       = useState<BundleStep>(buildingBundles.length > 0 ? 'pick' : 'create')
  const [selectedId, setSelectedId] = useState(buildingBundles[0]?.id ?? '')
  const [saving, setSaving]   = useState(false)

  // Create-bundle form
  const [name, setName]       = useState('')
  const [service, setService] = useState<GradingService>('PSA')
  const [tier, setTier]       = useState(GRADING_SERVICE_TIERS['PSA'][0])

  const handlePick = async () => {
    if (!selectedId) return
    setSaving(true)
    await onConfirm(selectedId)
    setSaving(false)
  }

  const handleCreate = async () => {
    if (!user || !name.trim()) return
    setSaving(true)
    const { data: newBundle, error } = await supabase
      .from('grading_bundles')
      .insert({ user_id: user.id, name: name.trim(), grading_service: service, service_tier: tier, status: 'building' })
      .select('id')
      .single()
    if (error || !newBundle) { setSaving(false); return }
    await onConfirm(newBundle.id)
    setSaving(false)
  }

  if (step === 'create') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => buildingBundles.length > 0 ? setStep('pick') : onBack()} className="text-xs text-gray-400 hover:text-gray-600">â† Back</button>
          <p className="text-sm font-semibold text-gray-700">Create a new bundle</p>
        </div>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Bundle name</Label>
            <Input
              placeholder="e.g. July 2026 PSA Batch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Service</Label>
              <Select value={service} onValueChange={(v) => { setService(v as GradingService); setTier(GRADING_SERVICE_TIERS[v as GradingService][0]) }}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADING_SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADING_SERVICE_TIERS[service].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button
          className="w-full bg-[#14314F] hover:bg-[#0f2438] text-white h-8 text-sm"
          disabled={!name.trim() || saving}
          onClick={handleCreate}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
          Create bundle & add card
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">â† Back</button>
        <p className="text-sm font-semibold text-gray-700">Choose a grading bundle</p>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {buildingBundles.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedId(b.id)}
            className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
              selectedId === b.id
                ? 'border-[#14314F] bg-[#14314F]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div>
              <p className="font-medium text-gray-800">{b.name}</p>
              <p className="text-xs text-gray-400">{b.grading_service} Â· {(b as any).service_tier}</p>
            </div>
            <Badge className="bg-blue-100 text-blue-700 text-xs">Building</Badge>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setStep('create')}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> New bundle
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-[#14314F] hover:bg-[#0f2438] text-white"
          disabled={!selectedId || saving}
          onClick={handlePick}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
          Add to bundle
        </Button>
      </div>
    </div>
  )
}

// â”€â”€ Card quick-view modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CardModal({
  card,
  buildingBundles,
  onClose,
  onStatusChange,
  onGradingBundleAdd,
}: {
  card: CardRow
  buildingBundles: GradingBundle[]
  onClose: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onGradingBundleAdd: (cardId: string, bundleId: string) => Promise<void>
}) {
  const [showBundlePicker,   setShowBundlePicker]   = useState(false)
  const [showConfirmGrade,   setShowConfirmGrade]   = useState(false)
  const [showLinkDialog,     setShowLinkDialog]     = useState(false)
  const [confirmDelete,      setConfirmDelete]      = useState(false)
  const [deleting,           setDeleting]           = useState(false)
  const cost  = cardCost(card)
  const value = cardValue(card)
  const pl    = value - cost
  const actions = NEXT_STATUSES[card.status ?? 'intake'] ?? []
  const stage   = STAGES.find((s) => s.key === card.status)

  const handleAction = async (targetStatus: string) => {
    if (targetStatus === 'grading') {
      setShowBundlePicker(true)
      return
    }
    await onStatusChange(card.id, targetStatus)
    onClose()
  }

  const handleBundleConfirm = async (bundleId: string) => {
    await onGradingBundleAdd(card.id, bundleId)
    onClose()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('cards').delete().eq('id', card.id)
    setDeleting(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#14314F] pr-6">
            {card.player_name || card.card_name || 'Card'}
          </DialogTitle>
        </DialogHeader>

        {/* Card summary */}
        <div className="flex gap-4 items-start">
          <CardThumb card={card} size="lg" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm text-gray-500">
              {[(card as any).set_name ?? (card as any).card_set, card.year].filter(Boolean).join(' Â· ')}
            </p>
            {(card as any).card_number && (
              <p className="text-xs text-gray-400">#{(card as any).card_number}</p>
            )}
            {stage && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white ${stage.headerBg}`}>
                {stage.icon} {stage.label}
              </span>
            )}
            {value > 0 && (
              <div className="pt-1 space-y-0.5">
                <p className="text-sm font-semibold text-gray-800">Est. value: ${value.toFixed(2)}</p>
                {cost > 0 && (
                  <p className={`text-xs font-medium ${pl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {pl >= 0 ? '+' : ''}${pl.toFixed(2)} P&L
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bundle picker step â€” shown when moving to grading */}
        {showBundlePicker ? (
          <div className="border-t pt-3">
            <BundlePickerStep
              cardId={card.id}
              buildingBundles={buildingBundles}
              onConfirm={handleBundleConfirm}
              onBack={() => setShowBundlePicker(false)}
            />
          </div>
        ) : (
          <>
            {actions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Move to next phase</p>
                <div className="flex flex-col gap-1.5">
                  {actions.map((a) => (
                    <Button
                      key={a.status}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 text-gray-700 hover:bg-gray-50"
                      onClick={() => handleAction(a.status)}
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Grade â€” shown for cards in grading status */}
            {card.status === 'grading' && (
              <div className="pt-1 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                  onClick={() => setShowConfirmGrade(true)}
                >
                  <Award className="w-3.5 h-3.5" />
                  Confirm Grade (returned from grader)
                </Button>
              </div>
            )}

            <div className="pt-1 border-t space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                onClick={() => setShowLinkDialog(true)}
              >
                <Link2 className="w-3.5 h-3.5" />
                {(card as any).cardhedge_card_id ? 'Re-link to Card Hedger' : 'Link to Card Hedger'}
              </Button>
              <Link
                to={`/portal/cards/${card.id}`}
                onClick={onClose}
                className="flex items-center gap-1.5 text-sm text-[#14314F] hover:underline font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View full details & edit
              </Link>
              {confirmDelete ? (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm" variant="destructive"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Yes, delete
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm" variant="ghost"
                  className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete card
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>

      <ConfirmGradeDialog
        cardId={card.id}
        open={showConfirmGrade}
        onOpenChange={setShowConfirmGrade}
        onConfirmed={onClose}
      />
      <LinkCardHedgerDialog
        cardId={card.id}
        cardName={card.player_name || card.card_name || undefined}
        playerName={(card as any).player_name ?? undefined}
        year={(card as any).year ?? undefined}
        setName={(card as any).set_name ?? undefined}
        cardNumber={(card as any).card_number ?? undefined}
        frontImageUrl={(card as any).front_image_url ?? null}
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        onLinked={onClose}
      />
    </Dialog>
  )
}

// â”€â”€ Kanban card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KanbanCard({ card, onCardClick }: { card: CardRow; onCardClick: (card: CardRow) => void }) {
  const cost  = cardCost(card)
  const value = cardValue(card)
  const pl    = value - cost

  return (
    <button
      onClick={() => onCardClick(card)}
      className="w-full text-left flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <CardThumb card={card} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
          {card.player_name || card.card_name}
        </p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {[(card as any).set_name ?? (card as any).card_set, card.year].filter(Boolean).join(' Â· ')}
        </p>
        {value > 0 && <p className="text-xs font-medium text-gray-600 mt-1">${value.toFixed(2)}</p>}
        {cost > 0 && value > 0 && (
          <p className={`text-xs font-medium ${pl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
          </p>
        )}
      </div>
    </button>
  )
}

// â”€â”€ Grading column â€” cards grouped by bundle, each group collapsible â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BundleGroup {
  bundle: GradingBundle | null
  cards: CardRow[]
}

function GradingColumn({
  stage,
  cards,
  bundles,
  cardBundleMap,
  isActive,
  onCardClick,
}: {
  stage: typeof STAGES[number]
  cards: CardRow[]
  bundles: GradingBundle[]
  cardBundleMap: Record<string, string>
  isActive: boolean
  onCardClick: (card: CardRow) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Group cards by bundle, then bucket bundles by their grading status
  const BUNDLE_SECTIONS = [
    { status: 'building',  label: 'Building',   dot: 'bg-blue-400' },
    { status: 'submitted', label: 'Submitted',   dot: 'bg-amber-400' },
    { status: 'at_grader', label: 'At Grader',   dot: 'bg-orange-400' },
  ] as const

  // Build per-bundle card groups
  const allGroups: BundleGroup[] = []
  bundles.forEach((bundle) => {
    const bundleCards = cards.filter((c) => cardBundleMap[c.id] === bundle.id)
    if (bundleCards.length > 0) allGroups.push({ bundle, cards: bundleCards })
  })
  const unbundled = cards.filter((c) => !cardBundleMap[c.id])

  const renderBundle = (group: BundleGroup) => {
    const key         = group.bundle?.id ?? '__unbundled__'
    const isCollapsed = collapsed.has(key)

    return (
      <div key={key} className="rounded-lg border border-amber-200/60 bg-white/70 overflow-hidden">
        <button
          onClick={() => toggleCollapse(key)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-50/50 transition-colors"
        >
          {isCollapsed
            ? <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">
              {group.bundle ? group.bundle.name : 'Unbundled'}
            </p>
            {group.bundle && (
              <p className="text-[10px] text-gray-400">{group.bundle.grading_service} Â· {(group.bundle as any).service_tier}</p>
            )}
          </div>
          <span className="text-[10px] font-bold text-gray-400 shrink-0">{group.cards.length}</span>
        </button>
        {!isCollapsed && (
          <div className="px-2 pb-2 space-y-1.5">
            {group.cards.map((card) => (
              <KanbanCard key={card.id} card={card} onCardClick={onCardClick} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const totalCards = cards.length

  return (
    <div
      id={`stage-${stage.key}`}
      className={`flex flex-col flex-1 min-w-[260px] rounded-xl border-2 transition-all overflow-hidden ${
        isActive ? 'border-[#14314F] shadow-md' : `${stage.borderColor} border`
      }`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 ${stage.headerBg}`}>
        <span className="text-white">{stage.icon}</span>
        <span className="text-sm font-bold text-white tracking-wide flex-1">{stage.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/25 text-white">
          {totalCards}
        </span>
      </div>

      <div className={`flex flex-col flex-1 ${stage.columnBg}`}>
        {/* Action button */}
        <div className="px-3 pt-3">
          <Link
            to={stage.actionRoute!}
            className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors bg-white/60"
          >
            <Plus className="w-3 h-3" />
            {stage.action}
          </Link>
        </div>

        {/* Sections: Building / Submitted / At Grader */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 max-h-[calc(100vh-300px)]">
          {totalCards === 0 && (
            <p className="text-xs text-gray-400 text-center py-8 italic">No cards here yet</p>
          )}

          {BUNDLE_SECTIONS.map(({ status, label, dot }) => {
            const sectionGroups = allGroups.filter((g) => g.bundle?.status === status)
            if (sectionGroups.length === 0) return null
            const sectionCount = sectionGroups.reduce((n, g) => n + g.cards.length, 0)
            return (
              <div key={status}>
                {/* Section divider */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
                  <span className="text-[10px] text-gray-400">{sectionCount}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="space-y-2">
                  {sectionGroups.map(renderBundle)}
                </div>
              </div>
            )
          })}

          {/* Unbundled cards (no section header needed) */}
          {unbundled.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full shrink-0 bg-gray-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Unbundled</span>
                <span className="text-[10px] text-gray-400">{unbundled.length}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-1.5">
                {unbundled.map((card) => (
                  <KanbanCard key={card.id} card={card} onCardClick={onCardClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Standard kanban column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KanbanColumn({
  stage,
  cards,
  isActive,
  onCardClick,
}: {
  stage: typeof STAGES[number]
  cards: CardRow[]
  isActive: boolean
  onCardClick: (card: CardRow) => void
}) {
  const shown    = cards.slice(0, 12)
  const overflow = cards.length - shown.length

  return (
    <div
      id={`stage-${stage.key}`}
      className={`flex flex-col flex-1 min-w-[260px] rounded-xl border-2 transition-all overflow-hidden ${
        isActive ? 'border-[#14314F] shadow-md' : `${stage.borderColor} border`
      }`}
    >
      <div className={`flex items-center gap-2 px-4 py-3 ${stage.headerBg}`}>
        <span className="text-white">{stage.icon}</span>
        <span className="text-sm font-bold text-white tracking-wide flex-1">{stage.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/25 text-white">
          {cards.length}
        </span>
      </div>

      <div className={`flex flex-col flex-1 ${stage.columnBg}`}>
        {stage.actionRoute && (
          <div className="px-3 pt-3">
            <Link
              to={stage.actionRoute}
              className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors bg-white/60"
            >
              <Plus className="w-3 h-3" />
              {stage.action}
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 max-h-[calc(100vh-300px)]">
          {shown.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8 italic">No cards here yet</p>
          )}
          {shown.map((card) => (
            <KanbanCard key={card.id} card={card} onCardClick={onCardClick} />
          ))}
          {overflow > 0 && (
            <Link
              to={`/portal/listings?status=${stage.key}`}
              className="block text-center text-xs text-blue-500 hover:underline py-1"
            >
              +{overflow} more
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Stat card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatCard({ label, value, sub, icon, trend }: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        {sub && (
          <p className={`text-xs mt-0.5 ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
          }`}>{sub}</p>
        )}
      </div>
    </div>
  )
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PortalHome() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const activeStage = searchParams.get('stage') ?? null

  const [cards, setCards]           = useState<CardRow[]>([])
  const [gradingBundles, setGradingBundles] = useState<GradingBundle[]>([])
  const [cardBundleMap, setCardBundleMap]   = useState<Record<string, string>>({})
  const [loading, setLoading]       = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardRow | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('cards')
      .select('*, purchases(*), ai_reports(*), market_valuations(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setCards((data ?? []) as CardRow[])
    setLoading(false)
  }, [user])

  const loadBundles = useCallback(async () => {
    if (!user) return
    const [{ data: bundles }, { data: items }] = await Promise.all([
      supabase.from('grading_bundles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('grading_bundle_items').select('card_id, bundle_id'),
    ])
    setGradingBundles((bundles as GradingBundle[]) ?? [])
    const map: Record<string, string> = {}
    items?.forEach((i: any) => { map[i.card_id] = i.bundle_id })
    setCardBundleMap(map)
  }, [user])

  useEffect(() => { load(); loadBundles() }, [load, loadBundles])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('portal-home-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${user.id}` }, () => { load(); loadBundles() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, load, loadBundles])

  useEffect(() => {
    if (!activeStage) return
    const el = document.getElementById(`stage-${activeStage}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeStage, loading])

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    // Optimistic update for instant feedback
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, status: status as any } : c))
    const { error } = await supabase.from('cards').update({ status }).eq('id', id)
    if (error) {
      console.error('Status update failed:', error)
      toast({ title: 'Failed to update card status', description: error.message, variant: 'destructive' })
    }
    // Always re-fetch to confirm DB state â€” don't rely solely on realtime
    load()
  }, [load, toast])

  const handleGradingBundleAdd = useCallback(async (cardId: string, bundleId: string) => {
    // Optimistic update for instant feedback
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, status: 'grading' as any } : c))
    setCardBundleMap((prev) => ({ ...prev, [cardId]: bundleId }))

    // Run both operations sequentially so a failed bundle insert doesn't leave
    // the card stuck in grading without a bundle assignment
    const { error: statusError } = await supabase
      .from('cards')
      .update({ status: 'grading' })
      .eq('id', cardId)

    if (statusError) {
      console.error('Card status update failed:', statusError)
      toast({ title: 'Failed to update card status', description: statusError.message, variant: 'destructive' })
      load()
      return
    }

    // Upsert avoids a unique-constraint failure if the card was already partially
    // added to this bundle in a previous attempt
    const { error: itemError } = await supabase
      .from('grading_bundle_items')
      .upsert(
        { bundle_id: bundleId, card_id: cardId, grading_fee: 0 },
        { onConflict: 'bundle_id,card_id' }
      )

    if (itemError) {
      console.error('Bundle item insert failed:', itemError)
      toast({ title: 'Card moved to grading, but bundle assignment failed', description: itemError.message, variant: 'destructive' })
    } else {
      toast({ title: 'Card added to grading bundle' })
    }

    load()
    loadBundles()
  }, [load, loadBundles, toast])

  const buildingBundles = gradingBundles.filter((b) => b.status === 'building')

  const totalCost  = cards.reduce((s, c) => s + cardCost(c), 0)
  const totalValue = cards.reduce((s, c) => s + cardValue(c), 0)
  const totalPL    = totalValue - totalCost

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading your pipelineâ€¦
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#14314F]">Pipeline</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track every card from scan to sale</p>
        </div>
        <Button asChild className="bg-[#14314F] hover:bg-[#0f2438] text-white">
          <Link to="/portal/intake">
            <ScanLine className="w-4 h-4 mr-2" /> Scan
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total cards"         value={String(cards.length)}                icon={<Package className="w-4 h-4" />} />
        <StatCard label="Cost basis"           value={`$${totalCost.toFixed(2)}`}          icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="Est. portfolio value" value={`$${totalValue.toFixed(2)}`}         icon={<BarChart2 className="w-4 h-4" />} />
        <StatCard
          label="Unrealized P&L"
          value={`${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`}
          icon={totalPL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          trend={totalPL > 0 ? 'up' : totalPL < 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Kanban */}
      <div className="flex gap-4">
        {STAGES.map((stage) => {
          const stageCards = cards.filter(stage.match)
          if (stage.key === 'grading') {
            return (
              <GradingColumn
                key={stage.key}
                stage={stage}
                cards={stageCards}
                bundles={gradingBundles}
                cardBundleMap={cardBundleMap}
                isActive={activeStage === stage.key}
                onCardClick={setSelectedCard}
              />
            )
          }
          return (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              cards={stageCards}
              isActive={activeStage === stage.key}
              onCardClick={setSelectedCard}
            />
          )
        })}
      </div>

      {/* Card quick-view modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          buildingBundles={buildingBundles}
          onClose={() => setSelectedCard(null)}
          onStatusChange={handleStatusChange}
          onGradingBundleAdd={handleGradingBundleAdd}
        />
      )}
    </div>
  )
}

