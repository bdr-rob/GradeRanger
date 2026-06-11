import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Upload, ScanLine } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import BatchScanQueue from '@/components/intake/BatchScanQueue';
import CardReviewTable from '@/components/intake/CardReviewTable';
import ScanStep from '@/components/intake/ScanStep';
import { ScannedImage, RecognizedCard, recognizeCards } from '@/lib/ximilar';

type Step = 'scan' | 'review';
type Mode = 'upload' | 'scanner';

export default function CardIntake() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('scan');
  const [mode, setMode] = useState<Mode>('upload');
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
  const [error, setError] = useState('');

  // Scanner mode holds front/back separately (ScanStep's design)
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  const handleIdentify = async (images: ScannedImage[]) => {
    setRecognizing(true);
    setError('');
    try {
      const results = await recognizeCards(images);
      setRecognizedCards(results);
      setStep('review');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRecognizing(false);
    }
  };

  // Convert scanner front/back dataUrls → ScannedImage[] → Ximilar
  const handleScannerNext = () => {
    const images: ScannedImage[] = [];
    if (frontImage) {
      images.push({
        id: uuidv4(),
        base64: frontImage.split(',')[1],
        preview: frontImage,
      });
    }
    if (backImage) {
      images.push({
        id: uuidv4(),
        base64: backImage.split(',')[1],
        preview: backImage,
      });
    }
    if (images.length > 0) handleIdentify(images);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <span>Portal</span>
        <ChevronRight className="w-3 h-3" />
        <span className="font-semibold" style={{ color: '#14314F' }}>Add Cards</span>
      </div>

      <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#14314F' }}>
        Add Cards to Portfolio
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload images or use your scanner — AI will identify cards automatically.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {(['scan', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: step === s ? '#14314F' : '#e5e7eb',
                color: step === s ? 'white' : '#9ca3af',
              }}
            >
              {i + 1}
            </div>
            <span className="text-sm font-medium"
              style={{ color: step === s ? '#14314F' : '#9ca3af' }}>
              {s === 'scan' ? 'Upload & Scan' : 'Review & Save'}
            </span>
            {i < 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>
      )}

      {step === 'scan' && (
        <>
          {/* Mode tabs */}
          <div className="flex gap-2 mb-6">
            {([
              { key: 'upload', label: 'Upload Photos', icon: <Upload className="w-4 h-4" /> },
              { key: 'scanner', label: 'Use Scanner', icon: <ScanLine className="w-4 h-4" /> },
            ] as { key: Mode; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors"
                style={{
                  borderColor: mode === key ? '#14314F' : '#e5e7eb',
                  backgroundColor: mode === key ? '#14314F' : 'white',
                  color: mode === key ? 'white' : '#6b7280',
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {mode === 'upload' && (
            <BatchScanQueue onIdentify={handleIdentify} loading={recognizing} />
          )}

          {mode === 'scanner' && (
            <ScanStep
              frontImage={frontImage}
              backImage={backImage}
              onFrontChange={setFrontImage}
              onBackChange={setBackImage}
              onNext={handleScannerNext}
            />
          )}
        </>
      )}

      {step === 'review' && recognizedCards.length > 0 && (
        <CardReviewTable
          cards={recognizedCards}
          onComplete={() => navigate('/portal/portfolio')}
        />
      )}
    </div>
  );
}