import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calculator, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GradingFeeSchedule, GradingService, GradedValues } from '@/types/cards';
import { GRADING_SERVICES } from '@/types/cards';

interface Props {
  costBasis: number;
  gradedValues: GradedValues | null;
  aiGrade?: number;
}

interface FeeMap {
  [service: string]: {
    [tier: string]: number;
  };
}

function sortGradesDesc(grades: string[]): string[] {
  return [...grades].sort((a, b) => parseFloat(b) - parseFloat(a));
}

function ROIRow({
  service,
  fee,
  tier,
  grade,
  estimatedValue,
  costBasis,
  isPredicted,
  allValues,
  expanded,
  onToggleExpand,
  onSelectGrade,
}: {
  service: GradingService;
  fee: number;
  tier: string;
  grade: string;
  estimatedValue: number;
  costBasis: number;
  isPredicted: boolean;
  allValues: Record<string, number>;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectGrade: (grade: string) => void;
}) {
  const netReturn = estimatedValue - costBasis - fee;
  const roi = costBasis > 0 ? (netReturn / costBasis) * 100 : 0;
  const isPositive = netReturn > 0;
  const otherGrades = sortGradesDesc(Object.keys(allValues)).filter((g) => g !== grade);

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        isPredicted ? 'border-[#47682d]/40 bg-[#47682d]/5' : 'border-gray-100 bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#14314F]">{service}</span>
          <span className="text-xs text-gray-500">{tier}</span>
          {isPredicted && <Badge className="bg-[#47682d] text-white text-xs">Predicted grade</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : netReturn === 0 ? (
            <Minus className="h-4 w-4 text-gray-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span
            className={`font-bold text-sm ${
              isPositive ? 'text-green-600' : netReturn < 0 ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {netReturn >= 0 ? '+' : ''}${netReturn.toFixed(2)}
          </span>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs text-gray-500">
        <div>
          <dt>Est. value @ {service} {grade}</dt>
          <dd className="font-medium text-gray-700">${estimatedValue.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Grading fee</dt>
          <dd className="font-medium text-gray-700">${fee.toFixed(2)}</dd>
        </div>
        <div>
          <dt>ROI</dt>
          <dd
            className={`font-medium ${
              roi > 0 ? 'text-green-600' : roi < 0 ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {roi.toFixed(0)}%
          </dd>
        </div>
      </dl>

      {otherGrades.length > 0 && (
        <div className="pt-1">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide' : 'Show'} other grades from CardSight ({otherGrades.length})
          </button>
          {expanded && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {sortGradesDesc(Object.keys(allValues)).map((g) => (
                <button
                  key={g}
                  onClick={() => onSelectGrade(g)}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                    g === grade
                      ? 'bg-[#14314F] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{service} {g}</span>
                  <span className="font-medium">${allValues[g].toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GradingROICalculator({ costBasis: initialCostBasis, gradedValues, aiGrade }: Props) {
  const [fees, setFees] = useState<FeeMap>({});
  const [costBasis, setCostBasis] = useState(initialCostBasis);
  const [loading, setLoading] = useState(true);
  const [gradeOverrides, setGradeOverrides] = useState<Record<string, string>>({});
  const [expandedService, setExpandedService] = useState<string | null>(null);

  useEffect(() => {
    loadFees();
  }, []);

  useEffect(() => {
    setCostBasis(initialCostBasis);
  }, [initialCostBasis]);

  const loadFees = async () => {
    const { data } = await supabase
      .from('grading_fee_schedules')
      .select('*')
      .is('effective_to', null)
      .order('price', { ascending: true });

    if (data) {
      const map: FeeMap = {};
      (data as GradingFeeSchedule[]).forEach((row) => {
        if (!map[row.grading_service]) map[row.grading_service] = {};
        if (!map[row.grading_service][row.tier_name]) {
          map[row.grading_service][row.tier_name] = row.price;
        }
      });
      setFees(map);
    }
    setLoading(false);
  };

  const aiGradeTier = aiGrade ? String(Math.round(aiGrade)) : null;

  const rows: Array<{
    service: GradingService;
    tier: string;
    fee: number;
    grade: string;
    estimatedValue: number;
    isPredicted: boolean;
    allValues: Record<string, number>;
  }> = [];

  GRADING_SERVICES.forEach((svc) => {
    const svcFees = fees[svc] ?? {};
    const defaultTier = Object.keys(svcFees)[0];
    if (!defaultTier) return;

    const fee = svcFees[defaultTier] ?? 0;
    const svcValues = (gradedValues?.[svc] ?? {}) as Record<string, number>;
    if (Object.keys(svcValues).length === 0) return;

    // Selecting a grade from the expanded ladder overrides the auto-pick;
    // otherwise default to CardSight's value at your Ximilar-predicted
    // grade if available, else the highest graded value on file.
    const override = gradeOverrides[svc];
    const grade = override && svcValues[override] != null
      ? override
      : aiGradeTier && svcValues[aiGradeTier] != null
      ? aiGradeTier
      : sortGradesDesc(Object.keys(svcValues))[0];
    if (!grade || svcValues[grade] == null) return;

    rows.push({
      service: svc,
      tier: defaultTier,
      fee,
      grade,
      estimatedValue: svcValues[grade],
      isPredicted: !override && grade === aiGradeTier,
      allValues: svcValues,
    });
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-[#47682d]" />
        <h3 className="font-semibold text-[#14314F]">Grading ROI calculator</h3>
      </div>
      <p className="text-xs text-gray-400 -mt-3">
        Values are CardSight's recent graded sales at the listed grade. We default to your Ximilar-predicted grade when CardSight has a price for it — expand a card to see every grade on file and switch tiers.
      </p>

      <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
        <div className="space-y-1 flex-1">
          <Label htmlFor="cost-basis" className="text-xs text-gray-500">Cost basis (editable)</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <Input
              id="cost-basis"
              type="number"
              step="0.01"
              min="0"
              value={costBasis}
              onChange={(e) => setCostBasis(parseFloat(e.target.value) || 0)}
              className="pl-6 h-8 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 flex-1">
          Net return = Estimated value − Cost basis − Grading fee
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading fee schedules…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          No graded market values available yet. Market data will populate after analysis.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ROIRow
              key={row.service}
              {...row}
              costBasis={costBasis}
              expanded={expandedService === row.service}
              onToggleExpand={() => setExpandedService((s) => (s === row.service ? null : row.service))}
              onSelectGrade={(g) => setGradeOverrides((prev) => ({ ...prev, [row.service]: g }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
