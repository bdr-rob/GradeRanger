import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Image, Bot, TrendingUp, Split, Clock } from 'lucide-react';
import AIReportViewer from '@/components/AIReportViewer';
import MarketValuePanel from '@/components/MarketValuePanel';
import GradingROICalculator from '@/components/GradingROICalculator';
import DispositionSelector from '@/components/DispositionSelector';
import GradingBundleManager from '@/components/GradingBundleManager';
import { submitCardForAnalysis, pollAnalysisJob } from '@/lib/api/aiAnalysis';
import type { Card, AIReport, Purchase, MarketValuation, CardStatus } from '@/types/cards';
import { STATUS_LABELS, STATUS_COLORS } from '@/types/cards';

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [card, setCard] = useState<Card | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [valuation, setValuation] = useState<MarketValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollingAI, setPollingAI] = useState(false);

  const loadCard = useCallback(async () => {
    if (!id) return;
    const [cardRes, purchaseRes, aiRes, valRes] = await Promise.all([
      supabase.from('cards').select('*').eq('id', id).single(),
      supabase.from('purchases').select('*').eq('card_id', id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('ai_reports').select('*').eq('card_id', id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('market_valuations').select('*').eq('card_id', id).order('fetched_at', { ascending: false }).limit(1).single(),
    ]);

    if (cardRes.data) setCard(cardRes.data as Card);
    if (purchaseRes.data) setPurchase(purchaseRes.data as Purchase);
    if (aiRes.data) setAiReport(aiRes.data as AIReport);
    if (valRes.data) setValuation(valRes.data as MarketValuation);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

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

    return () => {
      clearInterval(interval);
      setPollingAI(false);
    };
  }, [aiReport?.id, aiReport?.status, loadCard]);

  const handleRetryAnalysis = async () => {
    if (!card?.image_front_url) {
      toast({ title: 'No image available for analysis', variant: 'destructive' });
      return;
    }
    try {
      await submitCardForAnalysis(card.id, card.image_front_url, card.image_back_url ?? card.image_front_url);
      toast({ title: 'Analysis started', description: 'Results will appear in under a minute.' });
      await loadCard();
    } catch {
      toast({ title: 'Could not start analysis', variant: 'destructive' });
    }
  };

  const handleStatusChange = (newStatus: CardStatus) => {
    setCard((prev) => prev ? { ...prev, status: newStatus } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#47682d]" />
        <span className="text-gray-500">Loading card…</span>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Card not found.</p>
        <Button asChild variant="link" className="mt-2">
          <Link to="/portal">Back to portal</Link>
        </Button>
      </div>
    );
  }

  const costBasis = purchase?.cost_basis ?? 0;
  const gradedValues = (valuation?.graded_values as Record<string, Record<string, number>> | null) ?? null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="text-gray-500 mb-3 -ml-2">
          <Link to="/portal">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to collection
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#14314F]">{card.card_name}</h2>
            <p className="text-gray-500 mt-0.5">
              {[card.player_name, card.year, card.set_name, card.card_number].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Badge className={STATUS_COLORS[card.status]}>{STATUS_LABELS[card.status]}</Badge>
        </div>

        {card.internal_card_id && (
          <p className="text-xs text-gray-400 mt-1 font-mono">{card.internal_card_id}</p>
        )}
      </div>

      {/* Main tabs */}
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

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-5 mt-5">
          <div className="flex gap-4 flex-col sm:flex-row">
            {card.image_front_url && (
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1 font-medium">Front</p>
                <img src={card.image_front_url} alt="Card front" className="rounded-xl border max-h-64 object-contain w-full" />
              </div>
            )}
            {card.image_back_url && (
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1 font-medium">Back</p>
                <img src={card.image_back_url} alt="Card back" className="rounded-xl border max-h-64 object-contain w-full" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Card details</h4>
              <dl className="space-y-1.5 text-sm">
                {[
                  ['Player / Character', card.player_name],
                  ['Year', card.year],
                  ['Set', card.set_name],
                  ['Card number', card.card_number],
                  ['Variation', card.variation],
                  ['Sport / Game', card.sport],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-gray-400">{label}</dt>
                    <dd className="font-medium text-gray-700 text-right">{val}</dd>
                  </div>
                ) : null)}
              </dl>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Purchase details</h4>
              {purchase ? (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-400">Purchase price</dt><dd className="font-medium">${purchase.purchase_price.toFixed(2)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-400">Shipping</dt><dd className="font-medium">${purchase.shipping_cost.toFixed(2)}</dd></div>
                  {purchase.purchase_site && <div className="flex justify-between"><dt className="text-gray-400">Source</dt><dd className="font-medium">{purchase.purchase_site}</dd></div>}
                  {purchase.purchase_date && <div className="flex justify-between"><dt className="text-gray-400">Date</dt><dd className="font-medium">{purchase.purchase_date}</dd></div>}
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <dt className="font-semibold text-gray-700">Cost basis</dt>
                    <dd className="font-bold text-[#14314F]">${costBasis.toFixed(2)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-gray-400">No purchase details recorded.</p>
              )}
            </div>
          </div>

          {card.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
              <p className="text-sm text-gray-600">{card.notes}</p>
            </div>
          )}
        </TabsContent>

        {/* AI Report Tab */}
        <TabsContent value="ai" className="mt-5">
          <AIReportViewer
            report={aiReport}
            loading={pollingAI && aiReport?.status !== 'complete'}
            onRetry={handleRetryAnalysis}
          />
        </TabsContent>

        {/* Market Tab */}
        <TabsContent value="market" className="mt-5 space-y-8">
          <MarketValuePanel
            cardId={card.id}
            cardName={card.card_name}
            sport={card.sport ?? undefined}
            aiGrade={aiReport?.overall_grade ?? undefined}
          />
          <div className="border-t pt-6">
            <GradingROICalculator
              costBasis={costBasis}
              gradedValues={gradedValues}
              aiGrade={aiReport?.overall_grade ?? undefined}
            />
          </div>
        </TabsContent>

        {/* Disposition Tab */}
        <TabsContent value="disposition" className="mt-5 space-y-8">
          <DispositionSelector card={card} onStatusChange={handleStatusChange} />
          <div className="border-t pt-6">
            <GradingBundleManager cardId={card.id} />
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-5">
          <div className="space-y-3">
            <h3 className="font-semibold text-[#14314F]">Card history</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-[#47682d] shrink-0" />
                <span className="text-gray-500">{new Date(card.created_at).toLocaleDateString()}</span>
                <span className="text-gray-700">Card added to collection</span>
              </div>
              {aiReport && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-gray-500">{new Date(aiReport.created_at).toLocaleDateString()}</span>
                  <span className="text-gray-700">
                    AI analysis {aiReport.status === 'complete' ? `completed — grade ${aiReport.overall_grade}` : aiReport.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
