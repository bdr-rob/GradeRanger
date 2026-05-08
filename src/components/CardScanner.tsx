import React, { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CardScanAnalysisData } from '@/types/cardScan';
import {
  analyzeCardRemote,
  getDemoAnalysis,
  getScannerApiBaseUrl,
} from '@/lib/cardScanClient';

export default function CardScanner() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  /** Raw base64 without data URL prefix — sent to API */
  const [imageBase64Payload, setImageBase64Payload] = useState<string | null>(
    null,
  );
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CardScanAnalysisData | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { toast } = useToast();

  const resetUpload = () => {
    setUploadedImage(null);
    setImageBase64Payload(null);
    setResults(null);
    setIsDemoMode(false);
  };

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedImage(dataUrl);
      const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setImageBase64Payload(raw);
      setResults(null);
      setIsDemoMode(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) loadFile(file);
  };

  const runAnalysis = async () => {
    if (!imageBase64Payload) return;

    setScanning(true);
    setResults(null);
    setIsDemoMode(false);

    const apiUrl = getScannerApiBaseUrl();

    try {
      if (!apiUrl) {
        setResults(getDemoAnalysis());
        setIsDemoMode(true);
        toast({
          title: 'Demo analysis',
          description:
            'Showing placeholder scores. Set VITE_SCANNER_API_URL to use the Python scanner.',
        });
        return;
      }

      const data = await analyzeCardRemote(imageBase64Payload);
      setResults(data);
      toast({
        title: 'Analysis complete',
        description: 'Estimated grades below are informational only.',
      });
    } catch (error: unknown) {
      console.error('Card analysis error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to analyze card.';
      toast({
        title: 'Analysis failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-8 h-8 text-[#47682d]" />
        <h2 className="text-3xl font-bold text-[#14314F]">AI Card Scanner</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div
            className="border-4 border-dashed border-[#47682d] rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {!uploadedImage ? (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Upload className="w-16 h-16 mx-auto mb-4 text-[#47682d]" />
                <p className="text-lg text-gray-700">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Supports JPG, PNG, HEIC
                </p>
              </label>
            ) : (
              <div>
                <img
                  src={uploadedImage}
                  alt="Uploaded card"
                  className="max-h-96 mx-auto rounded-lg shadow-md"
                />
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Button
                    type="button"
                    onClick={runAnalysis}
                    disabled={scanning}
                    className="bg-[#47682d] hover:bg-[#47682d]/90 text-white"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      'Analyze card'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={resetUpload}
                    className="text-[#47682d] hover:underline text-sm"
                  >
                    Upload different card
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          {scanning && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 animate-spin text-[#47682d] mx-auto mb-4" />
              <p className="text-lg text-gray-700">Analyzing your card…</p>
              <p className="text-sm text-gray-500 mt-2">
                This may take a few seconds
              </p>
            </div>
          )}

          {results && !scanning && (
            <div className="space-y-4">
              {isDemoMode && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Demo mode — connect{' '}
                  <code className="rounded bg-amber-100 px-1">
                    VITE_SCANNER_API_URL
                  </code>{' '}
                  for live estimates.
                </div>
              )}

              <div className="bg-[#14314F] text-white p-4 rounded-lg">
                <h3 className="font-bold mb-2">Predicted grades</h3>
                <p className="text-xs text-white/70 mb-3">
                  Informational estimates only — not a substitute for professional grading.
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-2xl font-bold text-[#47682d]">
                      {results.predictedGrade?.PSA ?? 'N/A'}
                    </span>
                    <br />
                    PSA
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-[#47682d]">
                      {results.predictedGrade?.Beckett ?? 'N/A'}
                    </span>
                    <br />
                    BGS
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-[#47682d]">
                      {results.predictedGrade?.CGC ?? 'N/A'}
                    </span>
                    <br />
                    CGC
                  </div>
                </div>
              </div>

              {(results.centeringRatio != null ||
                results.centeringGradeLabel) && (
                <div className="text-sm text-gray-600 space-y-1 bg-gray-50 rounded-lg p-3">
                  {results.centeringRatio != null && (
                    <p>
                      <strong>Centering ratio:</strong>{' '}
                      {results.centeringRatio.toFixed(3)} (0.5 = balanced)
                    </p>
                  )}
                  {results.centeringGradeLabel && (
                    <p>
                      <strong>Centering band (heuristic):</strong>{' '}
                      {results.centeringGradeLabel}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Centering</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#47682d] h-2 rounded-full"
                        style={{ width: `${results.centering}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#47682d]">
                      {results.centering}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Corners</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#47682d] h-2 rounded-full"
                        style={{ width: `${results.corners}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#47682d]">
                      {results.corners}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Edges</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#47682d] h-2 rounded-full"
                        style={{ width: `${results.edges}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#47682d]">
                      {results.edges}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Surface</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#47682d] h-2 rounded-full"
                        style={{ width: `${results.surface}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#47682d]">
                      {results.surface}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Deal score</p>
                <p className="text-3xl font-bold text-green-600">
                  {results.dealScore}/5
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {results.confidence}% confidence
                </p>
              </div>

              {results.explanation && (
                <div className="bg-[#14314F]/5 border border-[#14314F]/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-[#14314F] mb-1">
                    Summary
                  </p>
                  <p className="text-sm text-gray-700">{results.explanation}</p>
                </div>
              )}

              {results.warnings && results.warnings.length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold text-orange-900 mb-1">
                    Warnings
                  </p>
                  <ul className="text-sm text-orange-900 list-disc list-inside space-y-1">
                    {results.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{results.notes}</p>
                </div>
              )}

              {results.cardDetails && (
                <div className="text-sm text-gray-600 space-y-1">
                  {results.cardDetails.player &&
                    results.cardDetails.player !== 'Unknown' && (
                      <p>
                        <strong>Player:</strong> {results.cardDetails.player}
                      </p>
                    )}
                  {results.cardDetails.year &&
                    results.cardDetails.year !== 'Unknown' && (
                      <p>
                        <strong>Year:</strong> {results.cardDetails.year}
                      </p>
                    )}
                  {results.cardDetails.set &&
                    results.cardDetails.set !== 'Unknown' && (
                      <p>
                        <strong>Set:</strong> {results.cardDetails.set}
                      </p>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
