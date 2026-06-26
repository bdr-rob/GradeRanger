import { useState } from 'react'
import BatchScanQueue from '@/components/intake/BatchScanQueue'
import CardReviewTable from '@/components/intake/CardReviewTable'
import ContinuousScanQueue from '@/components/intake/ContinuousScanQueue'
import { recognizeCards, RecognizedCard, ScannedImage } from '@/lib/ximilar'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Layers, Upload } from 'lucide-react'

type Mode = 'single' | 'continuous' | 'batch'

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
  const [mode, setMode] = useState<Mode>('continuous')
  const [step, setStep] = useState<'scan' | 'review'>('scan')
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleIdentify = async (images: ScannedImage[]) => {
    setLoading(true)
    setError(null)
    try {
      const results = await recognizeCards(images)
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
    setError(null)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Mode selector — chevron strip, only on scan step */}
      {step === 'scan' && (
        <div>
          <h1 className="text-2xl font-bold text-[#14314F] mb-1">Scan Cards</h1>
          <p className="text-muted-foreground mb-5">
            Scan or upload card images — AI identifies each one automatically.
          </p>

          {/* Chevron selector */}
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
        </div>
      )}

      {/* Batch mode — existing flow */}
      {mode === 'batch' && (
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

      {/* Single / Continuous mode */}
      {(mode === 'single' || mode === 'continuous') && (
        <ContinuousScanQueue
          onDone={() => navigate('/portal')}
          singleMode={mode === 'single'}
        />
      )}
    </div>
  )
}
