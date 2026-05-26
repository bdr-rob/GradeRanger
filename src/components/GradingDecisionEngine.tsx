import React, { useState, useEffect, useCallback } from 'react';
import type { CardScanAnalysisData, GradingDecision } from '@/types/cardScan';
import { CheckCircle2, XCircle, AlertTriangle, ChevronRight, ChevronDown, DollarSign, TrendingUp, ShieldCheck, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  analysis: CardScanAnalysisData;
  onDecisionSaved?: (decision: GradingDecision) => void;
  /** Pre-populate if this card was already reviewed */
  existingDecision?: GradingDecision;
}

type Stage1Override = 'advance' | 'eliminated' | null;
type Stage2Override = 'gem_mint' | 'strong_9' | 'fail' | null;
type RouteChoice = GradingDecision['route'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreToPass(score: number): boolean {
  return score >= 80;
}

function scoreToStage2Pass(score: number): boolean {
  return score >= 90;
}

function calcProfitZone(
  rawCost: number,
  allInCost: number,
  worstCaseValue: number
): { netProfit: number; required: number; zone: 'green' | 'yellow' | 'red' } {
  const netProfit = worstCaseValue - rawCost - allInCost;
  const required = allInCost * 2;
  const zone = netProfit >= required ? 'green' : netProfit > 0 ? 'yellow' : 'red';
  return { netProfit, required, zone };
}

function deriveStage1(analysis: CardScanAnalysisData): Stage1Override {
  const passes = [analysis.centering, analysis.corners, analysis.edges, analysis.surface].every(
    (s) => scoreToPass(s)
  );
  return passes ? 'advance' : 'eliminated';
}

function deriveStage2(analysis: CardScanAnalysisData): Stage2Override {
  const scores = [analysis.centering, analysis.corners, analysis.edges, analysis.surface];
  const allGemMint = scores.every((s) => scoreToStage2Pass(s));
  const anyFail = scores.some((s) => s < 75);
  if (allGemMint) return 'gem_mint';
  if (anyFail) return 'fail';
  return 'strong_9';
}

function deriveRoute(
  stage1: Stage1Override,
  stage2: Stage2Override,
  zone: 'green' | 'yellow' | 'red' | null,
  analysis: CardScanAnalysisData
): RouteChoice {
  if (stage1 === 'eliminated') return 'do_not_submit';
  if (stage2 === 'fail') return 'do_not_submit';
  if (zone === 'red') return 'do_not_submit';
  if (zone === 'yellow') return 'hold';

  // BGS eligibility: all scores >= 90 AND no warnings
  const allElite = [analysis.centering, analysis.corners, analysis.edges, analysis.surface].every(
    (s) => s >= 92
  );
  const hasWarnings = (analysis.warnings?.length ?? 0) > 0;
  if (allElite && !hasWarnings && stage2 === 'gem_mint') return 'BGS';
  return 'PSA';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageHeader({
  number,
  label,
  color,
  isOpen,
  onToggle,
  badge,
}: {
  number: string;
  label: string;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all',
        'border-2 font-semibold text-sm tracking-wide',
        color
      )}
    >
      <span className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold shrink-0">
        {number}
      </span>
      <span className="flex-1">{label}</span>
      {badge && <span className="shrink-0">{badge}</span>}
      {isOpen ? (
        <ChevronDown className="w-4 h-4 shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 shrink-0" />
      )}
    </button>
  );
}

function ScoreRow({
  label,
  score,
  threshold,
}: {
  label: string;
  score: number;
  threshold: number;
}) {
  const pass = score >= threshold;
  return (
    <div className="flex items-center gap-3">
      {pass ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      )}
      <span className="text-sm text-gray-700 w-24">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-amber-400' : 'bg-red-500'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-xs font-bold w-8 text-right tabular-nums', pass ? 'text-emerald-600' : 'text-red-600')}>
        {score}%
      </span>
    </div>
  );
}

function ResultBadge({ result }: { result: Stage1Override | Stage2Override | 'green' | 'yellow' | 'red' | RouteChoice | null }) {
  const map: Record<string, { label: string; className: string }> = {
    advance: { label: '✓ Advance', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    eliminated: { label: '✗ Eliminated', className: 'bg-red-100 text-red-800 border-red-300' },
    gem_mint: { label: '✦ Gem Mint Candidate', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    strong_9: { label: '◈ Strong 9 Path', className: 'bg-amber-100 text-amber-800 border-amber-300' },
    fail: { label: '✗ Fail', className: 'bg-red-100 text-red-800 border-red-300' },
    green: { label: '● Green Zone', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    yellow: { label: '● Yellow Zone', className: 'bg-amber-100 text-amber-800 border-amber-300' },
    red: { label: '● Red Zone', className: 'bg-red-100 text-red-800 border-red-300' },
    PSA: { label: '→ Submit to PSA', className: 'bg-blue-100 text-blue-800 border-blue-300' },
    BGS: { label: '→ Submit to BGS', className: 'bg-purple-100 text-purple-800 border-purple-300' },
    SGC: { label: '→ Submit to SGC', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    hold: { label: '◷ Hold Raw', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    do_not_submit: { label: '✗ Do Not Submit', className: 'bg-red-100 text-red-800 border-red-300' },
  };
  if (!result || !map[result]) return null;
  const { label, className } = map[result];
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', className)}>{label}</span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GradingDecisionEngine({ analysis, onDecisionSaved, existingDecision }: Props) {
  // Stage open/close
  const [openStage, setOpenStage] = useState<number>(1);

  // Stage 1 — user can override AI result
  const autoStage1 = deriveStage1(analysis);
  const [stage1Override, setStage1Override] = useState<Stage1Override>(
    existingDecision?.stage1Result ?? autoStage1
  );
  const stage1Result = stage1Override ?? autoStage1;

  // Stage 2
  const autoStage2 = deriveStage2(analysis);
  const [stage2Override, setStage2Override] = useState<Stage2Override>(
    existingDecision?.stage2Result ?? autoStage2
  );
  const stage2Result = stage2Override ?? autoStage2;

  // Stage 3 — cost inputs
  const [rawCost, setRawCost] = useState<string>(
    existingDecision?.rawCost != null ? String(existingDecision.rawCost) : ''
  );
  const [allInCost, setAllInCost] = useState<string>(
    existingDecision?.allInCost != null ? String(existingDecision.allInCost) : ''
  );
  // Use pricing from analysis if available as default worst-case value
  const defaultWorstCase =
    analysis.pricing?.psa9_avg != null ? String(Math.round(analysis.pricing.psa9_avg)) : '';
  const [worstCaseValue, setWorstCaseValue] = useState<string>(defaultWorstCase);

  const profitCalc =
    rawCost && allInCost && worstCaseValue
      ? calcProfitZone(Number(rawCost), Number(allInCost), Number(worstCaseValue))
      : null;

  // Stage 4 — route
  const autoRoute = deriveRoute(stage1Result, stage2Result, profitCalc?.zone ?? null, analysis);
  const [routeOverride, setRouteOverride] = useState<RouteChoice | null>(
    existingDecision?.route ?? null
  );
  const finalRoute = routeOverride ?? autoRoute;

  // Stage 5 — checklist
  const [checklist, setChecklist] = useState<boolean[]>(
    existingDecision ? [true, true, true, true] : [false, false, false, false]
  );
  const allChecked = checklist.every(Boolean);

  const toggleCheck = (i: number) => {
    setChecklist((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  // Auto-advance stage when a result is determined
  useEffect(() => {
    if (stage1Result === 'eliminated') setOpenStage(4);
  }, [stage1Result]);

  const handleSave = useCallback(() => {
    if (!onDecisionSaved) return;
    const decision: GradingDecision = {
      stage1Result: stage1Result as 'advance' | 'eliminated',
      stage2Result: stage2Result as 'gem_mint' | 'strong_9' | 'fail',
      stage3Zone: profitCalc?.zone ?? 'red',
      route: finalRoute,
      rawCost: rawCost ? Number(rawCost) : undefined,
      allInCost: allInCost ? Number(allInCost) : undefined,
      netProfit: profitCalc?.netProfit,
      finalChecklist: allChecked,
      decidedAt: new Date().toISOString(),
    };
    onDecisionSaved(decision);
  }, [stage1Result, stage2Result, profitCalc, finalRoute, rawCost, allInCost, allChecked, onDecisionSaved]);

  const toggle = (n: number) => setOpenStage((prev) => (prev === n ? 0 : n));

  // ── Stage color helpers
  const stageColor = (n: number) => {
    if (n === 1) return stage1Result === 'eliminated'
      ? 'border-red-400 bg-red-50 text-red-900'
      : 'border-emerald-400 bg-emerald-50 text-emerald-900';
    if (n === 2) return stage2Result === 'fail'
      ? 'border-red-400 bg-red-50 text-red-900'
      : stage2Result === 'gem_mint'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
      : 'border-amber-400 bg-amber-50 text-amber-900';
    if (n === 3) return profitCalc?.zone === 'green'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
      : profitCalc?.zone === 'yellow'
      ? 'border-amber-400 bg-amber-50 text-amber-900'
      : profitCalc?.zone === 'red'
      ? 'border-red-400 bg-red-50 text-red-900'
      : 'border-gray-300 bg-gray-50 text-gray-800';
    if (n === 4) return finalRoute === 'PSA' || finalRoute === 'BGS' || finalRoute === 'SGC'
      ? 'border-blue-400 bg-blue-50 text-blue-900'
      : finalRoute === 'do_not_submit'
      ? 'border-red-400 bg-red-50 text-red-900'
      : 'border-gray-300 bg-gray-50 text-gray-800';
    if (n === 5) return allChecked
      ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
      : 'border-gray-300 bg-gray-50 text-gray-800';
    return 'border-gray-300 bg-gray-50 text-gray-800';
  };

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-[#14314F]" />
        <h3 className="text-base font-bold text-[#14314F]">Grading Decision Engine</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        5-stage triage system. Each stage eliminates cards — nothing moves backwards.
      </p>

      {/* ── STAGE 1: BULK PRESCREEN ─────────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden">
        <StageHeader
          number="1"
          label="Bulk Prescreen"
          color={stageColor(1)}
          isOpen={openStage === 1}
          onToggle={() => toggle(1)}
          badge={<ResultBadge result={stage1Result} />}
        />
        {openStage === 1 && (
          <div className="p-4 bg-white border-t space-y-4">
            <p className="text-xs text-gray-500">
              Arm's-length shock test. Any obvious flaw removes this card from the Gem Mint path.
              Threshold: all dimensions ≥ 80.
            </p>
            <div className="space-y-2.5">
              <ScoreRow label="Centering" score={analysis.centering} threshold={80} />
              <ScoreRow label="Corners" score={analysis.corners} threshold={80} />
              <ScoreRow label="Edges" score={analysis.edges} threshold={80} />
              <ScoreRow label="Surface" score={analysis.surface} threshold={80} />
            </div>

            {analysis.warnings && analysis.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Warnings detected
                </p>
                {analysis.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-800 pl-5">• {w}</p>
                ))}
              </div>
            )}

            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-600 mb-2">AI result: <ResultBadge result={autoStage1} /></p>
              <p className="text-xs text-gray-500 mb-2">Override if you disagree after physical inspection:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStage1Override('advance')}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-xs font-semibold transition-all',
                    stage1Override === 'advance' || (stage1Override === null && autoStage1 === 'advance')
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-300'
                  )}
                >
                  ✓ Advance
                </button>
                <button
                  type="button"
                  onClick={() => setStage1Override('eliminated')}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-xs font-semibold transition-all',
                    stage1Override === 'eliminated' || (stage1Override === null && autoStage1 === 'eliminated')
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-gray-200 text-gray-600 hover:border-red-300'
                  )}
                >
                  ✗ Eliminate
                </button>
              </div>
            </div>

            {stage1Result === 'advance' && (
              <Button
                size="sm"
                type="button"
                onClick={() => setOpenStage(2)}
                className="w-full bg-[#14314F] hover:bg-[#14314F]/90 text-white text-xs"
              >
                Continue to Gem Mint Screen →
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── STAGE 2: GEM MINT SCREEN ─────────────────────────────────────────── */}
      <div className={cn('rounded-xl border overflow-hidden', stage1Result === 'eliminated' && 'opacity-50 pointer-events-none')}>
        <StageHeader
          number="2"
          label="Gem Mint Screen"
          color={stageColor(2)}
          isOpen={openStage === 2}
          onToggle={() => toggle(2)}
          badge={<ResultBadge result={stage2Result} />}
        />
        {openStage === 2 && (
          <div className="p-4 bg-white border-t space-y-4">
            <p className="text-xs text-gray-500">
              10-minute loupe inspection. One flaw = not a Gem Mint candidate. Threshold: all ≥ 90.
            </p>
            <div className="space-y-2.5">
              <ScoreRow label="Centering" score={analysis.centering} threshold={90} />
              <ScoreRow label="Corners" score={analysis.corners} threshold={90} />
              <ScoreRow label="Edges" score={analysis.edges} threshold={90} />
              <ScoreRow label="Surface" score={analysis.surface} threshold={90} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              {[
                { key: 'gem_mint' as const, label: '✦ Gem Mint', sub: 'All ≥ 90', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
                { key: 'strong_9' as const, label: '◈ Strong 9', sub: 'Some < 90', color: 'border-amber-400 bg-amber-50 text-amber-800' },
                { key: 'fail' as const, label: '✗ Fail', sub: 'Any < 75', color: 'border-red-400 bg-red-50 text-red-800' },
              ].map(({ key, label, sub, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStage2Override(key)}
                  className={cn(
                    'py-2 px-1 rounded-lg border font-semibold transition-all',
                    (stage2Override === key || (stage2Override === null && autoStage2 === key))
                      ? color
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <div>{label}</div>
                  <div className="text-gray-400 font-normal mt-0.5">{sub}</div>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-[#14314F]/10 bg-[#14314F]/5 p-3 text-xs text-[#14314F] space-y-1">
              <p className="font-semibold">Grader Logic</p>
              {stage2Result === 'gem_mint' && <p>Card deserves a shot. PSA 9 wouldn't shock you — but wouldn't surprise either. Proceed to profit check.</p>}
              {stage2Result === 'strong_9' && <p>Profitable at PSA 9? Submit. Only works at 10? Hold. Check the math in Stage 3.</p>}
              {stage2Result === 'fail' && <p>Corner/edge/surface flaw visible without tools. Do not submit — graders will catch it.</p>}
            </div>

            {stage2Result !== 'fail' && (
              <Button
                size="sm"
                type="button"
                onClick={() => setOpenStage(3)}
                className="w-full bg-[#14314F] hover:bg-[#14314F]/90 text-white text-xs"
              >
                Continue to Value Filter →
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── STAGE 3: VALUE VS GRADE FILTER ──────────────────────────────────── */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        (stage1Result === 'eliminated' || stage2Result === 'fail') && 'opacity-50 pointer-events-none'
      )}>
        <StageHeader
          number="3"
          label="Value vs. Grade Filter"
          color={stageColor(3)}
          isOpen={openStage === 3}
          onToggle={() => toggle(3)}
          badge={profitCalc ? <ResultBadge result={profitCalc.zone} /> : undefined}
        />
        {openStage === 3 && (
          <div className="p-4 bg-white border-t space-y-4">
            <p className="text-xs text-gray-500">
              Every card must earn its place at its <strong>worst realistic grade</strong>. Net profit must be ≥ 2× all-in cost.
            </p>

            {/* Assumed grade note */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">Assumed grade for math:</p>
              <p>{stage2Result === 'gem_mint' ? '→ PSA 9 (even Gem Mint candidates assume 9 in bulk math)' : '→ PSA 8–9 (Strong 9 path)'}</p>
              {analysis.pricing && (
                <p className="text-gray-500 mt-1">
                  AI pricing estimate — PSA 9 avg: <strong>${analysis.pricing.psa9_avg?.toFixed(0) ?? 'N/A'}</strong> · PSA 10 avg: <strong>${analysis.pricing.psa10_avg?.toFixed(0) ?? 'N/A'}</strong> · Raw avg: <strong>${analysis.pricing.raw_avg?.toFixed(0) ?? 'N/A'}</strong>
                </p>
              )}
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Raw Card Cost', placeholder: '$15', value: rawCost, setter: setRawCost },
                { label: 'All-In Grading Cost', placeholder: '$28', value: allInCost, setter: setAllInCost },
                { label: 'Worst-Case Slab Value', placeholder: '$85', value: worstCaseValue, setter: setWorstCaseValue },
              ].map(({ label, placeholder, value, setter }) => (
                <div key={label} className="space-y-1">
                  <label className="text-xs text-gray-600 font-medium">{label}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <Input
                      type="number"
                      min="0"
                      placeholder={placeholder}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="pl-6 text-sm h-8"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Profit result */}
            {profitCalc && (
              <div className={cn(
                'rounded-lg border-2 p-4 space-y-3',
                profitCalc.zone === 'green' && 'border-emerald-400 bg-emerald-50',
                profitCalc.zone === 'yellow' && 'border-amber-400 bg-amber-50',
                profitCalc.zone === 'red' && 'border-red-400 bg-red-50',
              )}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Net Profit</p>
                    <p className={cn(
                      'text-xl font-bold tabular-nums',
                      profitCalc.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                    )}>
                      {profitCalc.netProfit >= 0 ? '+' : ''}{profitCalc.netProfit.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Required (2× cost)</p>
                    <p className="text-xl font-bold tabular-nums text-gray-700">
                      ${profitCalc.required.toFixed(0)}
                    </p>
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      profitCalc.zone === 'green' ? 'bg-emerald-500' : profitCalc.zone === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, (profitCalc.netProfit / (profitCalc.required * 1.5)) * 100))}%`
                    }}
                  />
                  {/* threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-800/40"
                    style={{ left: `${(profitCalc.required / (profitCalc.required * 1.5)) * 100}%` }}
                  />
                </div>
                <p className={cn(
                  'text-xs font-semibold',
                  profitCalc.zone === 'green' && 'text-emerald-800',
                  profitCalc.zone === 'yellow' && 'text-amber-800',
                  profitCalc.zone === 'red' && 'text-red-800',
                )}>
                  {profitCalc.zone === 'green' && '🟢 Green Zone — strong bulk submit. Survives PSA 9s comfortably.'}
                  {profitCalc.zone === 'yellow' && '🟡 Yellow Zone — profitable but below 2× buffer. Submit only to fill tiers, offset by stronger cards.'}
                  {profitCalc.zone === 'red' && '🔴 Red Zone — breakeven or loss at worst case. Only works at PSA 10. Do not submit.'}
                </p>
              </div>
            )}

            {profitCalc && profitCalc.zone !== 'red' && (
              <Button
                size="sm"
                type="button"
                onClick={() => setOpenStage(4)}
                className="w-full bg-[#14314F] hover:bg-[#14314F]/90 text-white text-xs"
              >
                Continue to Route Selection →
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── STAGE 4: LOT ROUTING ─────────────────────────────────────────────── */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        (stage1Result === 'eliminated' || stage2Result === 'fail') && 'opacity-50 pointer-events-none'
      )}>
        <StageHeader
          number="4"
          label="Grading Route"
          color={stageColor(4)}
          isOpen={openStage === 4}
          onToggle={() => toggle(4)}
          badge={<ResultBadge result={finalRoute} />}
        />
        {openStage === 4 && (
          <div className="p-4 bg-white border-t space-y-4">
            <p className="text-xs text-gray-500">
              AI-recommended route based on scores, flags, and profit math. Override if you have additional physical context.
            </p>

            <div className="rounded-lg border border-[#14314F]/10 bg-[#14314F]/5 p-3 text-xs text-[#14314F]">
              <p className="font-semibold mb-1">Auto-route logic:</p>
              <p className="text-gray-600">
                BGS: requires all dimensions ≥ 92, no warnings, Gem Mint candidate. PSA: visual presentation elite, minor flaws acceptable. Hold/Do Not Submit: profit insufficient.
              </p>
              <p className="mt-1.5 font-medium">AI recommendation: <ResultBadge result={autoRoute} /></p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  { key: 'PSA' as const, label: 'PSA', icon: '🏆', desc: 'Visual grader, tolerates minor hidden flaws' },
                  { key: 'BGS' as const, label: 'BGS / Beckett', icon: '🔬', desc: 'Technical grader, all subgrades must be elite' },
                  { key: 'SGC' as const, label: 'SGC', icon: '📦', desc: 'Good for vintage or pop-report plays' },
                  { key: 'hold' as const, label: 'Hold Raw', icon: '⏸', desc: 'Market trending up or math too thin now' },
                  { key: 'do_not_submit' as const, label: 'Do Not Submit', icon: '🚫', desc: 'Requires PSA 10, sell raw or keep' },
                ] as { key: RouteChoice; label: string; icon: string; desc: string }[]
              ).map(({ key, label, icon, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRouteOverride(key)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    finalRoute === key
                      ? key === 'do_not_submit'
                        ? 'border-red-500 bg-red-50'
                        : key === 'hold'
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="text-lg mb-1">{icon}</div>
                  <div className="text-xs font-bold text-gray-800">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</div>
                </button>
              ))}
            </div>

            {(finalRoute === 'PSA' || finalRoute === 'BGS' || finalRoute === 'SGC') && (
              <Button
                size="sm"
                type="button"
                onClick={() => setOpenStage(5)}
                className="w-full bg-[#14314F] hover:bg-[#14314F]/90 text-white text-xs"
              >
                Continue to Final Gate →
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── STAGE 5: NO-REGRET GATE ──────────────────────────────────────────── */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        finalRoute === 'do_not_submit' && 'opacity-50 pointer-events-none'
      )}>
        <StageHeader
          number="5"
          label="No-Regret Gate"
          color={stageColor(5)}
          isOpen={openStage === 5}
          onToggle={() => toggle(5)}
          badge={allChecked ? <ResultBadge result="advance" /> : undefined}
        />
        {openStage === 5 && (
          <div className="p-4 bg-white border-t space-y-4">
            <p className="text-xs text-gray-500">
              Answer "Yes" to all four. Any "No" → remove the card from the submission.
            </p>
            <div className="space-y-3">
              {[
                'Would I still submit if this grades one lower than expected?',
                'Does my financial model still work at the worst-case grade?',
                'Am I submitting this for logic — not hope?',
                'Did I recheck the back of the card?',
              ].map((question, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleCheck(i)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                    checklist[i]
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-200 hover:border-emerald-200'
                  )}
                >
                  {checklist[i] ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm text-gray-700">{question}</span>
                </button>
              ))}
            </div>

            {allChecked && (
              <div className="rounded-lg border border-emerald-400 bg-emerald-50 p-3 text-sm text-emerald-800 font-semibold text-center">
                ✓ Card cleared all 5 stages. Ready to submit to {finalRoute}.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FINAL SUMMARY + SAVE ─────────────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-[#14314F]/20 bg-[#14314F]/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-[#14314F]" />
          <p className="text-sm font-bold text-[#14314F]">Final Decision</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ResultBadge result={stage1Result} />
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <ResultBadge result={stage2Result} />
          {profitCalc && (
            <>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <ResultBadge result={profitCalc.zone} />
            </>
          )}
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <ResultBadge result={finalRoute} />
        </div>

        {finalRoute === 'do_not_submit' && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            This card did not clear the decision system. Sell raw or hold — do not submit.
          </p>
        )}

        {onDecisionSaved && (
          <Button
            type="button"
            onClick={handleSave}
            disabled={!allChecked && (finalRoute === 'PSA' || finalRoute === 'BGS' || finalRoute === 'SGC')}
            className="w-full bg-[#47682d] hover:bg-[#47682d]/90 text-white"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {finalRoute === 'do_not_submit' || finalRoute === 'hold'
              ? 'Save Decision'
              : 'Save & Confirm Submission Decision'}
          </Button>
        )}
        {(finalRoute === 'PSA' || finalRoute === 'BGS' || finalRoute === 'SGC') && !allChecked && (
          <p className="text-xs text-center text-gray-500">Complete the No-Regret Gate checklist to confirm.</p>
        )}
      </div>
    </div>
  );
}
