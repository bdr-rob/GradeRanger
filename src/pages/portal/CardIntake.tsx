import { useState } from 'react'
import BatchScanQueue from '@/components/intake/BatchScanQueue'
import CardReviewTable from '@/components/intake/CardReviewTable'
import ContinuousScanQueue from '@/components/intake/ContinuousScanQueue'
import SlabScanCapture from '@/components/intake/SlabScanCapture'
import SlabReviewPanel from '@/components/intake/SlabReviewPanel'
import { RecognizedCard, ScannedImage } from '@/lib/ximilar'
import { recognizeRawCardFromImage } from '@/lib/cardhedge'
import { CardHedgeSlabResult } from '@/lib/cardhedge'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Layers, Upload, Award, CreditCard } from 'lucide-react'

type Mode = 'single' | 'continuous' | 'batch'
type Category = 'raw' | 'slab'

const MODES: { key: Mode; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    key:   'single',
    label: 'Single Scan',
    sub:   'One card at a time',
    icon:  <ScanLine className="w-4 h-4" />,
  },
  {
    key:   'continuous',
    label: 'Continuous Scan',
    sub:   'Queue multiple cards',
    icon:  <Layers className="w-4 h-4" />,
  },
  {
    key:   'batch',
    label: 'Batch Upload',
    sub:   'Upload then review',
    icon:  <Upload className="w-4 h-4" />,
  },
]

export default function CardIntake() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category>('raw')
  const [mode, setMode] = useState<Mode>('continuous')
  const [step, setStep] = useState<'scan' | 'review'>('scan')
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([])
  const [slabResult, setSlabResult] = useState<CardHedgeSlabResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleIdentify = async (images: ScannedImage[]) => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(images.map(recognizeRawCardFromImage))
      setRecognizedCards(results)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep('scan')
    setRecognizedCards([])
    setSlabResult(null)
    setError(null)
  }

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat)
    handleReset()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Category toggle — Raw Card / Graded Slab */}
      {step === 'scan' && (
        <div>
          <h1 className="text-2xl font-bold text-[#14314F] mb-1">Scan Cards</h1>
          <p className="text-muted-foreground mb-5">
            Scan or upload card images — AI identifies each one automatically.
          </p>

          {/* Raw / Slab segmented control */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden mb-5">
            <button
              onClick={() => handleCategoryChange('raw')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors
                ${category === 'raw'
                  ? 'bg-[#14314F] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <CreditCard className="w-4 h-4" />
              Raw Card
            </button>
            <button
              onClick={() => handleCategoryChange('slab')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-l border-gray-200
                ${category === 'slab'
                  ? 'bg-[#14314F] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Award className="w-4 h-4" />
              Graded Slab
            </button>
          </div>

          {/* Mode chevrons — raw card only */}
          {category === 'raw' && (
            <div className="flex w-full overflow-hidden rounded-lg border border-gray-200">
              {MODES.map(({ key, label, sub, icon }, idx) => {
                const isActive = mode === key
                return (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`
                      relative flex-1 flex items-center gap-2.5 px-4 py-3 text-left
                      transition-colors focus:outline-none
                      ${isActive
                        ? 'bg-[#14314F] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'}
                      ${idx > 0 ? 'pl-7' : ''}
                    `}
                    style={{
                      clipPath: idx < MODES.length - 1
                        ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)'
                        : idx > 0
                        ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                        : undefined,
                    }}
                  >
                    <span className={isActive ? 'text-white' : 'text-gray-400'}>{icon}</span>
                    <span>
                      <span className="block text-sm font-semibold leading-tight">{label}</span>
                      <span className={`block text-xs leading-tight mt-0.5 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                        {sub}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Graded Slab flow ── */}
      {category === 'slab' && (
        <>
          {slabResult ? (
            <SlabReviewPanel
              slab={slabResult}
              onSaved={handleReset}
              onBack={() => setSlabResult(null)}
            />
          ) : (
            <SlabScanCapture onResult={setSlabResult} />
          )}
        </>
      )}

      {/* ── Raw Card flows ── */}
      {category === 'raw' && mode === 'batch' && (
        <>
          {step === 'review' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">1</span>
                Upload &amp; Scan
              </div>
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="w-6 h-6 rounded-full bg-[#14314F] text-white flex items-center justify-center text-xs">2</span>
                Review &amp; Save
              </div>
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          {step === 'scan'
            ? <BatchScanQueue onIdentify={handleIdentify} loading={loading} />
            : <CardReviewTable cards={recognizedCards} onSaved={handleReset} />
          }
        </>
      )}

      {category === 'raw' && (mode === 'single' || mode === 'continuous') && (
        <ContinuousScanQueue
          onDone={() => navigate('/portal')}
          singleMode={mode === 'single'}
        />
      )}
    </div>
  )
}
