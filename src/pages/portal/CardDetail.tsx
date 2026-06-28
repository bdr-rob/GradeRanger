import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Image, Bot, TrendingUp, Split, Clock, Pencil, X, Save } from 'lucide-react';
import AIReportViewer from '@/components/AIReportViewer';
import MarketValuePanel from '@/components/MarketValuePanel';
import GradingROICalculator from '@/components/GradingROICalculator';
import PopulationReport from '@/components/PopulationReport';
import DispositionSelector from '@/components/DispositionSelector';
import PipelineProgress from '@/components/PipelineProgress';
import GradingBundleManager from '@/components/GradingBundleManager';
import { submitCardForAnalysis, pollAnalysisJob } from '@/lib/api/aiAnalysis';
import { useLightbox } from '@/contexts/LightboxContext';
import type { Card, AIReport, Purchase, MarketValuation, CardStatus } from '@/types/cards';
import { STATUS_LABELS, STATUS_COLORS } from '@/types/cards';

const PURCHASE_LOCATIONS = [
  'eBay', 'PWCC', 'Goldin', 'Heritage Auctions', 'Local Card Shop',
  'Card Show', 'Facebook Marketplace', 'Facebook Group', 'Whatnot', 'Fanatics', 'Other',
]

// Helper â€” handles column name differences between Card type and what we actually save
const BUNDLE_STATUS_LABELS: Record<string, string> = {
  building:  'Building',
  submitted: 'Submitted',
  at_grader: 'At Grader',
  returned:  'Returned',
}

function gradingStatusLabel(card: any): string {
  if (card.status !== 'grading') return STATUS_LABELS[card.status as import('@/types/cards').CardStatus] ?? card.status
  // Try to get the bundle status for a more accurate label
  const items: any[] = card.grading_bundle_items ?? []
  const bundleStatus = items[0]?.grading_bundles?.status
  return BUNDLE_STATUS_LABELS[bundleStatus] ?? 'Grading'
}

function getField(card: any, ...keys: string[]): string {
  for (const key of keys) {
    if (card[key] != null && card[key] !== '') return card[key]
  }
  return ''
}

interface EditState {
  player_name: string
  year: string
  card_name: string
  card_set: string
  card_number: string
  sport: string
  parallel: string
  variation: string
  company: string
  purchase_price: string
  purchase_location: string
}

function toEditState(card: any): EditState {
  return {
    player_name:      getField(card, 'player_name'),
    year:             getField(card, 'year'),
    card_name:        getField(card, 'card_name'),
    card_set:         getField(card, 'card_set', 'set_name'),
    card_number:      getField(card, 'card_number'),
    sport:            getField(card, 'sport'),
    parallel:         getField(card, 'parallel'),
    variation:        getField(card, 'variation'),
    company:          getField(card, 'company'),
    purchase_price:   card.purchase_price != null ? String(card.purchase_price) : '',
    purchase_location: getField(card, 'purchase_location'),
  }
}

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { open: openLightbox } = useLightbox();
  const [card, setCard]       = useState<Card | null>(null);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [valuation, setValuation] = useState<MarketValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollingAI, setPollingAI] = useState(false);
  const [submittingAssessment, setSubmittingAssessment] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCard = useCallback(async () => {
    if (!id) return;
    const [cardRes, aiRes, valRes] = await Promise.all([
      supabase.from('cards').select('*, grading_bundle_items(bundle_id, grading_bundles(status))').eq('id', id).single(),
      supabase.from('ai_reports').select('*').eq('card_id', id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('market_valuations').select('*').eq('card_id', id).order('fetched_at', { ascending: false }).limit(1).single(),
    ]);
    if (cardRes.data) setCard(cardRes.data as Card);
    if (aiRes.data)   setAiReport(aiRes.data as AIReport);
    if (valRes.data)  setValuation(valRes.data as MarketValuation);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadCard(); }, [loadCard]);

  // Poll AI job if still processing
  useEffect(() => {
    if (!aiReport || aiReport.status === 'complete' || aiReport.status === 'failed') return;
    setPollingAI(true);
    const interval = setInterval(async () => {
      const result = await pollAnalysisJob(aiReport.id).catch(() => null);
      if (!result) return;
      if (result.status === 'complete' || result.status === 'failed') {
        clearInterval(interval);
        setPollingAI(false);
        await loadCard();
      }
    }, 5000);
    return () => { clearInterval(interval); setPollingAI(false); };
  }, [aiReport?.id, aiReport?.status, loadCard]);

  const startEditing = () => {
    if (!card) return;
    setEditState(toEditState(card));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditState(null);
  };

  const updateField = (field: keyof EditState, value: string) => {
    setEditState(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const saveEdits = async () => {
    if (!card || !editState) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('cards').update({
        player_name:      editState.player_name      || null,
        year:             editState.year             || null,
        card_name:        editState.card_name        || null,
        card_set:         editState.card_set         || null,
        card_number:      editState.card_number      || null,
        sport:            editState.sport            || null,
        parallel:         editState.parallel         || null,
        variation:        editState.variation        || null,
        company:          editState.company          || null,
        purchase_price:   editState.purchase_price ? parseFloat(editState.purchase_price) : null,
        purchase_location: editState.purchase_location || null,
      }).eq('id', card.id);

      if (error) throw error;
      toast({ title: 'Card updated' });
      setIsEditing(false);
      setEditState(null);
      await loadCard();
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRetryAnalysis = async () => {
    const frontUrl = getField(card as any, 'image_front_url', 'front_image_url');
    if (!frontUrl) {
      toast({ title: 'No image available for analysis', variant: 'destructive' });
      return;
    }
    setSubmittingAssessment(true);
    try {
      const backUrl = getField(card as any, 'image_back_url', 'back_image_url') || frontUrl;
      await submitCardForAnalysis(card!.id, frontUrl, backUrl);
      toast({ title: 'Assessment running', description: 'AI is grading this card â€” results appear below in ~30s.' });
      await loadCard();
    } catch {
      toast({ title: 'Could not start analysis', variant: 'destructive' });
    } finally {
      setSubmittingAssessment(false);
    }
  };

  const handleStatusChange = (newStatus: CardStatus) => {
    setCard(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#47682d]" />
        <span className="text-gray-500">Loading cardâ€¦</span>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Card not found.</p>
        <Button asChild variant="link" className="mt-2"><Link to="/portal">Back to portal</Link></Button>
      </div>
    );
  }

  const c = card as any; // typed escape hatch for extra columns
  const frontUrl    = getField(c, 'image_front_url', 'front_image_url');
  const backUrl     = getField(c, 'image_back_url', 'back_image_url');
  const setName     = getField(c, 'card_set', 'set_name');
  const purchasePrice    = c.purchase_price != null ? `$${parseFloat(c.purchase_price).toFixed(2)}` : null;
  const purchaseLocation = getField(c, 'purchase_location');
  const marketValue = valuation?.raw_median ?? null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="text-gray-500 mb-3 -ml-2">
          <Link to="/portal"><ArrowLeft className="h-4 w-4 mr-1" /> Back to collection</Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#14314F]">
              {getField(c, 'card_name', 'player_name') || 'Unnamed Card'}
            </h2>
            <p className="text-gray-500 mt-0.5">
              {[c.player_name, c.year, setName, c.card_number].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[card.status]}>{gradingStatusLabel(card)}</Badge>
            {!isEditing ? (
              <Button onClick={startEditing} variant="outline" size="sm" className="flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={saveEdits} disabled={saving} size="sm" className="bg-[#47682d] hover:bg-[#3a5525] text-white">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  Save
                </Button>
                <Button onClick={cancelEditing} variant="outline" size="sm">
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
        {c.internal_card_id && (
          <p className="text-xs text-gray-400 mt-1 font-mono">{c.internal_card_id}</p>
        )}
      </div>

      {/* Pipeline progress */}
      <PipelineProgress
        card={card}
        aiReport={aiReport}
        valuation={valuation}
        onRunAssessment={handleRetryAnalysis}
        assessmentRunning={submittingAssessment || pollingAI}
      />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <Image className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" /> AI Report
            {pollingAI && <Loader2 className="h-3 w-3 animate-spin" />}
          </TabsTrigger>
          <TabsTrigger value="market" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Market
          </TabsTrigger>
          <TabsTrigger value="disposition" className="flex items-center gap-1.5">
            <Split className="h-3.5 w-3.5" /> Disposition
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* â”€â”€ Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TabsContent value="overview" className="space-y-5 mt-5">

          {/* Card images */}
          {(frontUrl || backUrl) && (
            <div className="flex gap-4 flex-col sm:flex-row">
              {frontUrl && (
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Front</p>
                  <img
                    src={frontUrl}
                    alt="Card front"
                    className="rounded-xl border max-h-64 object-contain w-full bg-gray-50 cursor-pointer"
                    onClick={() => openLightbox(
                      [{ src: frontUrl, alt: 'Front' }, ...(backUrl ? [{ src: backUrl, alt: 'Back' }] : [])],
                      0
                    )}
                  />
                </div>
              )}
              {backUrl && (
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Back</p>
                  <img
                    src={backUrl}
                    alt="Card back"
                    className="rounded-xl border max-h-64 object-contain w-full bg-gray-50 cursor-pointer"
                    onClick={() => openLightbox(
                      [{ src: frontUrl, alt: 'Front' }, { src: backUrl, alt: 'Back' }],
                      1
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {isEditing && editState ? (
            /* â”€â”€ EDIT MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Card details</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {([
                    ['Player / Name',       'player_name',  'text'],
                    ['Year',               'year',         'text'],
                    ['Card Name',          'card_name',    'text'],
                    ['Set',                'card_set',     'text'],
                    ['Card #',             'card_number',  'text'],
                    ['Sport / Category',   'sport',        'text'],
                    ['Parallel',           'parallel',     'text'],
                    ['Variation',          'variation',    'text'],
                    ['Company',            'company',      'text'],
                  ] as [string, keyof EditState, string][]).map(([label, field]) => (
                    <div key={field}>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
                      <Input
                        value={editState[field]}
                        onChange={e => updateField(field, e.target.value)}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Purchase details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Purchase Price ($)</Label>
                    <Input
                      type="number"
                      value={editState.purchase_price}
                      onChange={e => updateField('purchase_price', e.target.value)}
                      className="mt-1 h-8 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Purchase Location</Label>
                    <Select value={editState.purchase_location} onValueChange={v => updateField('purchase_location', v)}>
                      <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue placeholder="Select locationâ€¦" />
                      </SelectTrigger>
                      <SelectContent>
                        {PURCHASE_LOCATIONS.map(loc => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* â”€â”€ READ MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Card details</h4>
                <dl className="space-y-1.5 text-sm">
                  {([
                    ['Player / Character', c.player_name],
                    ['Year',              c.year],
                    ['Card Name',         c.card_name],
                    ['Set',               setName],
                    ['Card number',       c.card_number],
                    ['Sport / Game',      c.sport],
                    ['Parallel',          c.parallel],
                    ['Variation',         c.variation],
                    ['Company',           c.company],
                  ] as [string, string][]).map(([label, val]) => val ? (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-gray-500 shrink-0">{label}</dt>
                      <dd className="font-medium text-right">{val}</dd>
                    </div>
                  ) : null)}
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Purchase details</h4>
                {purchasePrice || purchaseLocation ? (
                  <dl className="space-y-1.5 text-sm">
                    {purchasePrice && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500">Purchase price</dt>
                        <dd className="font-medium">{purchasePrice}</dd>
                      </div>
                    )}
                    {purchaseLocation && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500">Purchased from</dt>
                        <dd className="font-medium">{purchaseLocation}</dd>
                      </div>
                    )}
                    {marketValue != null && (
                      <>
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-500">Est. market value</dt>
                          <dd className="font-medium text-blue-700">${marketValue.toFixed(2)}</dd>
                        </div>
                        {purchasePrice && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-gray-500">Unrealized P&L</dt>
                            <dd className={`font-medium ${marketValue - parseFloat(c.purchase_price) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {marketValue - parseFloat(c.purchase_price) >= 0 ? '+' : ''}
                              ${(marketValue - parseFloat(c.purchase_price)).toFixed(2)}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-gray-400">No purchase details recorded.</p>
                )}
              </div>
            </div>
          )}
                    {/* â”€â”€ Rich Card Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="space-y-6">

            {/* Card Attributes â€” shown as badges */}
            {c.attributes?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Attributes</p>
                <div className="flex flex-wrap gap-2">
                  {(c.attributes as string[]).map((attr) => (
                    <span
                      key={attr}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#14314F]/10 text-[#14314F]"
                    >
                      {attr.replace(/^pokemon-/, '').replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Print & Release Details */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Rarity',           value: c.rarity },
                { label: 'Language',         value: c.language },
                { label: 'Release Name',     value: c.release_name },
                { label: 'Release Date',     value: c.release_date },
                { label: 'Series',           value: c.series },
                { label: 'Set Abbreviation', value: c.set_abbreviation },
                { label: 'Artist',           value: c.artist },
                { label: 'HP',               value: c.hp },
                { label: 'PokÃ©dex Number',   value: c.pokedex_number },
                { label: 'Evolves From',     value: c.evolves_from },
              ]
                .filter(({ value }) => value)
                .map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-medium text-gray-800">{value}</p>
                  </div>
                ))}
            </div>

            {/* Card Description / Abilities */}
            {c.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Card Text</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-lg p-3">
                  {c.description}
                </p>
              </div>
            )}

            {/* Flavor Text */}
            {c.flavor_text && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Flavor Text</p>
                <p className="text-sm text-gray-500 italic leading-relaxed bg-gray-50 rounded-lg p-3">
                  "{c.flavor_text}"
                </p>
              </div>
            )}

            </div>
        </TabsContent>

        {/* â”€â”€ AI Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TabsContent value="ai" className="mt-5">
          <AIReportViewer
            report={aiReport}
            card={card}
            onRetry={handleRetryAnalysis}
          />
          {aiReport?.status === 'complete' && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <GradingBundleManager cardId={card.id} />
            </div>
          )}
        </TabsContent>

        {/* â”€â”€ Market â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TabsContent value="market" className="mt-5">
          <MarketValuePanel
            card={c}
            valuation={valuation}
            costBasis={c.purchase_price ?? 0}
            gradedValues={(valuation?.graded_values as Record<string, Record<string, number>> | null) ?? null}
          />
          <div className="mt-4">
            <GradingROICalculator
              costBasis={c.purchase_price ?? 0}
              gradedValues={(valuation?.graded_values as Record<string, Record<string, number>> | null) ?? null}
              aiGrade={aiReport?.overall_grade}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <PopulationReport cardsightCardId={c.cardsight_card_id ?? null} />
          </div>
        </TabsContent>

        {/* â”€â”€ Disposition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TabsContent value="disposition" className="mt-5">
          <DispositionSelector card={card} onStatusChange={handleStatusChange} />
          <div className="mt-4">
            <GradingBundleManager cardId={card.id} />
          </div>
        </TabsContent>

        {/* â”€â”€ History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TabsContent value="history" className="mt-5">
          <p className="text-sm text-gray-400">Activity history coming soon.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
