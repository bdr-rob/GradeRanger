import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, ChevronRight } from 'lucide-react';
import BatchScanQueue from '@/components/intake/BatchScanQueue';
import CardReviewTable from '@/components/intake/CardReviewTable';
import { ScannedImage, RecognizedCard, recognizeCards } from '@/lib/ximilar';

type Step = 'scan' | 'review';

export default function PortalIntake() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('scan');
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
  const [error, setError] = useState('');

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
          <span>Portal</span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-semibold" style={{ color: '#14314F' }}>Add Cards</span>
        </div>
        <h1 className="text-2xl font-extrabold" style={{ color: '#14314F' }}>
          Add Cards to Portfolio
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload or scan card images — AI will identify them automatically.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {(['scan', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: step === s ? '#14314F' : s === 'review' && step === 'scan' ? '#e5e7eb' : '#ABD2BE',
                color: step === s ? 'white' : '#14314F',
              }}
            >
              {i + 1}
            </div>
            <span
              className="text-sm font-medium capitalize"
              style={{ color: step === s ? '#14314F' : '#9ca3af' }}
            >
              {s === 'scan' ? 'Upload & Scan' : 'Review & Save'}
            </span>
            {i < 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-100">
          {error}
        </div>
      )}

      {/* Steps */}
      {step === 'scan' && (
        <BatchScanQueue onIdentify={handleIdentify} loading={recognizing} />
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