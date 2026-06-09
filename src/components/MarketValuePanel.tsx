import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, RefreshCw, TrendingUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { MarketValuation, GradingService } from '@/types/cards';
import { GRADING_SERVICES } from '@/types/cards';

interface Props {
  cardId: string;
  cardName: string;
  sport?: string;
  aiGrade?: number;
}

const GRADE_TIERS = ['6', '7', '8', '9', '10'];
const GRADE_TIER_LABELS: Record<string, string> = {
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9 (NM-MT)',
  '10': '10 (GEM)',
};

export default function MarketValuePanel({ cardId, cardName, sport, aiGrade }: Props) {
  const { toast } = useToast();
  const [valuation, setValuation] = useState<MarketValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedService, setSelectedService] = useState<GradingService>('PSA');

  useEffect(() => {
    loadValuation();
  }, [cardId]);

  const loadValuation = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('market_valuations')
      .select('*')
      .eq('card_id', cardId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      const age = Date.now() - new Date(data.fetched_at).getTime();
      const stale = age > 24 * 60 * 60 * 1000;
      setValuation(data as MarketValuation);
      if (stale) fetchFreshData();
    } else {
      await fetchFreshData();
    }
    setLoading(false);
  };

  const fetchFreshData = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-market-data', {
        body: { card_id: cardId, card_name: cardName, sport: sport ?? '' },
      });

      if (error) throw error;
      if (data?.valuation) setValuation(data.valuation as MarketValuation);
    } catch {
      // Silently fail — market data is supplementary
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-market-data', {
        body: { card_id: cardId, card_name: cardName, sport: sport ?? '', force: true },
      });
      if (error) throw error;
      if (data?.valuation) {
        setValuation(data.valuation as MarketValuation);
        toast({ title: 'Market data refreshed' });
      }
    } catch {
      toast({ title: 'Could not refresh market data', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading market data…</span>
      </div>
    );
  }

  const gradedValues = (valuation?.graded_values as Record<string, Record<string, number>> | null) ?? {};
  const serviceValues = gradedValues[selectedService] ?? {};
  const aiGradeTier = aiGrade ? String(Math.round(aiGrade)) : null;

  // Build TCGPlayer affiliate link
  const tcgLink = `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(cardName)}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#47682d]" />
          <h3 className="font-semibold text-[#14314F]">Market values</h3>
          {refreshing && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Raw value */}
      {valuation && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Raw (ungraded) value</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Low</p>
              <p className="text-lg font-bold text-gray-700">
                {valuation.raw_low != null ? `$${valuation.raw_low.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Median</p>
              <p className="text-xl font-bold text-[#14314F]">
                {valuation.raw_median != null ? `$${valuation.raw_median.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">High</p>
              <p className="text-lg font-bold text-gray-700">
                {valuation.raw_high != null ? `$${valuation.raw_high.toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
          {valuation.data_source && (
            <p className="text-xs text-gray-400 mt-2 text-center">Source: {valuation.data_source}</p>
          )}
        </div>
      )}

      {/* Graded values */}
      <div>
        <div className="flex gap-2 flex-wrap mb-3">
          {GRADING_SERVICES.map((svc) => (
            <button
              key={svc}
              onClick={() => setSelectedService(svc)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedService === svc
                  ? 'bg-[#14314F] text-white border-[#14314F]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#14314F]'
              }`}
            >
              {svc}
            </button>
          ))}
        </div>

        {Object.keys(serviceValues).length > 0 ? (
          <div className="space-y-2">
            {GRADE_TIERS.filter((t) => serviceValues[t] != null).map((tier) => (
              <div
                key={tier}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  aiGradeTier === tier ? 'bg-[#47682d]/10 border border-[#47682d]/30' : 'bg-gray-50'
                }`}
              >
                <span className="text-sm text-gray-700">
                  {selectedService} {GRADE_TIER_LABELS[tier]}
                  {aiGradeTier === tier && (
                    <Badge className="ml-2 bg-[#47682d]/20 text-[#47682d] text-xs">Predicted</Badge>
                  )}
                </span>
                <span className="font-semibold text-[#14314F]">${serviceValues[tier].toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No graded values available for {selectedService} yet.
          </p>
        )}
      </div>

      {/* TCGPlayer affiliate link */}
      <a
        href={tcgLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        View on TCGPlayer
      </a>

      {valuation && (
        <p className="text-xs text-gray-400">
          Data as of {new Date(valuation.fetched_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
