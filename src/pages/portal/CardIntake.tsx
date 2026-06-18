import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScanLine, Upload, Trophy, Gamepad2 } from 'lucide-react'
import BatchScanQueue from '@/components/intake/BatchScanQueue'
import CardReviewTable from '@/components/intake/CardReviewTable'
import ScanStep from '@/components/intake/ScanStep'
import { recognizeCards, RecognizedCard, ScannedImage, CardType } from '@/lib/ximilar'
import { Button } from '@/components/ui/button'

export default function CardIntake() {
  const [step, setStep] = useState<'scan' | 'review'>('scan')
  const [cardType, setCardType] = useState<'sport' | 'tcg'>('sport')
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scanner state
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [backImage, setBackImage] = useState<string | null>(null)

  const handleIdentify = async (images: ScannedImage[]) => {
    setLoading(true)
    setError(null)
    try {
      const results = await recognizeCards(images, cardType)
      setRecognizedCards(results)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleScannerNext = () => {
    if (!frontImage) return
    const image: ScannedImage = {
      id: uuidv4(),
      base64: frontImage.split(',')[1],
      preview: frontImage,
      backBase64: backImage ? backImage.split(',')[1] : undefined,
      backPreview: backImage ?? undefined,
    }
    handleIdentify([image])
  }

  const handleReset = () => {
    setStep('scan')
    setRecognizedCards([])
    setFrontImage(null)
    setBackImage(null)
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
          cardType={cardType}
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
      <p className="text-muted-foreground mb-6">Upload images or use your scanner — AI will identify cards automatically.</p>

      {/* Card Type Selector */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Card Type</p>
        <div className="flex gap-3">
          <button
            onClick={() => setCardType('sport')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              cardType === 'sport'
                ? 'bg-[#14314F] text-white border-[#14314F]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#14314F]'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Sport Card
          </button>
          <button
            onClick={() => setCardType('tcg')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              cardType === 'tcg'
                ? 'bg-[#14314F] text-white border-[#14314F]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#14314F]'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            TCG / Pokémon
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {cardType === 'tcg'
            ? '⚠️ Always scan/upload the FRONT of the card — backs cannot be identified'
            : 'Sports cards: baseball, basketball, football, hockey, soccer'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="upload">
        <TabsList className="mb-6">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload Photos
          </TabsTrigger>
          <TabsTrigger value="scanner" className="flex items-center gap-2">
            <ScanLine className="w-4 h-4" /> Use Scanner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <BatchScanQueue onIdentify={handleIdentify} loading={loading} />
        </TabsContent>

        <TabsContent value="scanner">
          <ScanStep
            frontImage={frontImage}
            backImage={backImage}
            onFrontChange={setFrontImage}
            onBackChange={setBackImage}
            onNext={handleScannerNext}
          />
          {frontImage && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleScannerNext}
                disabled={loading}
                className="bg-[#47682d] hover:bg-[#3a5525] text-white"
              >
                {loading ? 'Identifying...' : `Identify Card${backImage ? ' (Front + Back)' : ''}`}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}