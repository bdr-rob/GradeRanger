import { useNavigate } from 'react-router-dom'
import { ScanLine, Sparkles, Award, Tag, CheckCircle2, Loader2 } from 'lucide-react'
import type { Card, AIReport, MarketValuation } from '@/types/cards'

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  {
    key:         'add',
    label:       'Add',
    icon:        <ScanLine className="w-3.5 h-3.5" />,
    description: 'Card scanned and added to collection',
  },
  {
    key:         'assess',
    label:       'Assess',
    icon:        <Sparkles className="w-3.5 h-3.5" />,
    description: 'AI assessment complete',
  },
  {
    key:         'grade',
    label:       'Grade',
    icon:        <Award className="w-3.5 h-3.5" />,
    description: 'Sent to grading service',
  },
  {
    key:         'list',
    label:       'List',
    icon:        <Tag className="w-3.5 h-3.5" />,
    description: 'Listed on marketplace',
  },
  {
    key:         'sold',
    label:       'Sold',
    icon:        <CheckCircle2 className="w-3.5 h-3.5" />,
    description: 'Card sold',
  },
]

// ── Derive current stage index ────────────────────────────────────────────────
// Stage 1 (Assess) triggers as soon as the AI report is complete —
// we don't wait for a market valuation, that's a soft dependency.

function deriveStageIndex(card: Card, aiReport: AIReport | null): number {
  if (card.status === 'sold') return 4
  if (card.status === 'listed') return 3
  if (card.status === 'grading') return 2
  // 'analyzed' is set by grade-analyze edge function on completion
  if (card.status === 'analyzed' || aiReport?.status === 'complete') return 1
  return 0
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  card: Card
  aiReport: AIReport | null
  valuation: MarketValuation | null
  onRunAssessment?: () => void
  assessmentRunning?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PipelineProgress({ card, aiReport, valuation, onRunAssessment, assessmentRunning }: Props) {
  const navigate = useNavigate()
  const currentIdx = deriveStageIndex(card, aiReport)

  // Is the AI still processing (submitted but not done)?
  const isProcessing = assessmentRunning || aiReport?.status === 'processing'

  return (
    <div className="w-full space-y-3">
      {/* Chevron strip */}
      <div className="flex w-full overflow-hidden rounded-lg">
        {STAGES.map((stage, idx) => {
          const isComplete = idx < currentIdx
          const isCurrent  = idx === currentIdx

          const bgClass = isComplete
            ? 'bg-[#14314F]'
            : isCurrent
            ? 'bg-[#47682d]'
            : 'bg-gray-100'

          const textClass = isComplete || isCurrent ? 'text-white' : 'text-gray-400'

          return (
            <div
              key={stage.key}
              className={`
                relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3
                text-xs font-medium select-none
                ${bgClass} ${textClass}
                ${idx > 0 ? 'pl-5' : ''}
              `}
              style={{
                clipPath: idx < STAGES.length - 1
                  ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)'
                  : idx > 0
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)'
                  : undefined,
              }}
            >
              {isCurrent && isProcessing && idx === 0
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : stage.icon}
              <span className="hidden sm:inline">{stage.label}</span>
              <span className="sm:hidden">{stage.label.slice(0, 3)}</span>
            </div>
          )
        })}
      </div>

      {/* Action row below the bar */}
      <div className="px-1">
        {/* Stage 0: Add — show "Run assessment" or spinner while running */}
        {currentIdx === 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Next: run the AI assessment to grade this card
            </p>
            <button
              onClick={() => !isProcessing && onRunAssessment?.()}
              disabled={isProcessing}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#47682d] hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Running assessment…</>
                : 'Run assessment →'}
            </button>
          </div>
        )}

        {/* Stage 1: Assess — two paths forward */}
        {currentIdx === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">
              Assessment complete — what's your next step?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/portal/grading')}
                className="flex-1 py-1.5 px-3 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                Send for grading
              </button>
              <button
                onClick={() => navigate(`/portal/listings/new?card=${card.id}`)}
                className="flex-1 py-1.5 px-3 rounded-lg border border-orange-200 bg-orange-50 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
              >
                List it now
              </button>
            </div>
          </div>
        )}

        {/* Stage 2: Grading — move to listing once graded */}
        {currentIdx === 2 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Card is with the grading service
            </p>
            <button
              onClick={() => navigate(`/portal/listings/new?card=${card.id}`)}
              className="shrink-0 text-xs font-semibold text-orange-600 hover:underline"
            >
              Prepare listing →
            </button>
          </div>
        )}

        {/* Stage 3: Listed */}
        {currentIdx === 3 && (
          <p className="text-xs text-gray-400">
            Listed on marketplace — waiting for a sale.
          </p>
        )}

        {/* Stage 4: Sold */}
        {currentIdx === 4 && (
          <p className="text-xs text-green-600 font-medium">
            Sold! Great job.
          </p>
        )}
      </div>
    </div>
  )
}
