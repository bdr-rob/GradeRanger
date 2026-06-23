import { useState } from 'react'
import BatchScanQueue from '@/components/intake/BatchScanQueue'
import CardReviewTable from '@/components/intake/CardReviewTable'
import { recognizeCards, RecognizedCard, ScannedImage } from '@/lib/ximilar'

export default function CardIntake() {
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

  if (step === 'review') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
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
        <CardReviewTable
          cards={recognizedCards}
          onSaved={handleReset}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="w-6 h-6 rounded-full bg-[#14314F] text-white flex items-center justify-center text-xs">1</span>
          Upload &amp; Scan
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">2</span>
          Review &amp; Save
        </div>
      </div>

      <h1 className="text-2xl font-bold text-[#14314F] mb-1">Add Cards to Portfolio</h1>
      <p className="text-muted-foreground mb-6">
        Upload card images — AI will identify and price them automatically.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <BatchScanQueue onIdentify={handleIdentify} loading={loading} />
    </div>
  )
}