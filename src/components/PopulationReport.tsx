import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, RefreshCw } from 'lucide-react';

interface PopGrade {
  id: string;
  grade: string;
  condition?: string;
  population: number;
  qualified_population: number;
}
interface PopGradingType {
  id: string;
  name: string;
  total_population: number;
  grades: PopGrade[];
}
interface PopGradingCompany {
  id: string;
  name: string;
  last_synced_at?: string;
  total_population: number;
  grading_types: PopGradingType[];
}
interface PopVariant {
  total_population: number;
  grading_companies: PopGradingCompany[];
}
interface PopulationData {
  card_id: string;
  card_name: string;
  total_population: number;
  base?: PopVariant;
  parallels?: (PopVariant & { parallel_id: string; parallel_name: string })[];
}

function CompanyTable({ company }: { company: PopGradingCompany }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[#14314F] text-sm">{company.name}</span>
        <span className="text-xs text-gray-400">{company.total_population.toLocaleString()} total</span>
      </div>
      {company.grading_types.map((type) => {
        const gradesWithData = type.grades.filter((g) => g.population > 0 || g.qualified_population > 0);
        if (gradesWithData.length === 0) return null;
        return (
          <div key={type.id} className="rounded-lg border overflow-hidden">
            {type.name && type.name !== company.name && (
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 border-b">{type.name}</div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-px bg-gray-100">
              {gradesWithData
                .sort((a, b) => parseFloat(b.grade) - parseFloat(a.grade))
                .map((g) => (
                  <div key={g.id} className="bg-white px-3 py-2">
                    <p className="text-xs text-gray-400">{g.grade}{g.condition ? ` ${g.condition}` : ''}</p>
                    <p className="text-sm font-semibold text-[#14314F]">
                      {g.population.toLocaleString()}
                      {g.qualified_population > 0 && (
                        <span className="text-xs text-gray-400 font-normal"> (+{g.qualified_population} Q)</span>
                      )}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VariantSection({ label, variant }: { label: string; variant: PopVariant }) {
  if (variant.total_population === 0 || variant.grading_companies.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{label}</Badge>
        <span className="text-xs text-gray-400">{variant.total_population.toLocaleString()} graded total</span>
      </div>
      <div className="space-y-3 pl-1">
        {variant.grading_companies.map((c) => <CompanyTable key={c.id} company={c} />)}
      </div>
    </div>
  );
}

export default function PopulationReport({ cardsightCardId }: { cardsightCardId: string | null }) {
  const { toast } = useToast();
  const [data, setData] = useState<PopulationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async (force = false) => {
    if (!cardsightCardId) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('cardsight-catalog', {
        body: { action: 'population', card_id: cardsightCardId, force },
      });
      if (error) throw error;
      setData(res.population);
      setLoaded(true);
    } catch (err) {
      console.error('Population fetch error:', err);
      toast({ title: 'Could not load population report', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!cardsightCardId) {
    return (
      <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">
        This card hasn't been identified by CardSight yet — population data unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-[#14314F]">
          <BarChart3 className="h-4 w-4 text-[#47682d]" />
          Graded Population
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {!loaded && !loading && (
        <div className="text-center py-6">
          <Button variant="outline" size="sm" onClick={() => load(false)}>Load population report</Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 justify-center py-6 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading population report…
        </div>
      )}

      {loaded && data && data.total_population === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No graded population data on file for this card yet.</p>
      )}

      {loaded && data && data.total_population > 0 && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-[#14314F]">{data.total_population.toLocaleString()}</span> total graded across all companies
          </p>
          {data.base && <VariantSection label="Base" variant={data.base} />}
          {(data.parallels ?? []).map((p) => (
            <VariantSection key={p.parallel_id} label={p.parallel_name} variant={p} />
          ))}
        </div>
      )}
    </div>
  );
}
