import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Camera, Upload, BookmarkPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CardScanAnalysisData, CardScanSaveTarget } from '@/types/cardScan';
import {
  analyzeCardRemote,
  getDemoAnalysis,
  getScannerApiBaseUrl,
} from '@/lib/cardScanClient';
import {
  addLocalSavedScan,
  getLocalSavedScans,
  removeLocalSavedScan,
} from '@/lib/savedLocalScans';
import {
  saveScanToPortfolio,
  saveScanToWatchlist,
} from '@/lib/saveCardScanRemote';

export default function CardScanner() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  /** Raw base64 without data URL prefix — sent to API */
  const [imageBase64Payload, setImageBase64Payload] = useState<string | null>(
    null,
  );
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<CardScanAnalysisData | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [saveTarget, setSaveTarget] = useState<CardScanSaveTarget>('device');
  const [localScans, setLocalScans] = useState(() => getLocalSavedScans());
  const { toast } = useToast();

  useEffect(() => {
    setLocalScans(getLocalSavedScans());
  }, []);

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

  const refreshLocalScans = () => setLocalScans(getLocalSavedScans());

  const handleSaveScan = async () => {
    if (!results) return;

    if (saveTarget === 'device') {
      setSaving(true);
      try {
        addLocalSavedScan({
          analysis: results,
          imageDataUrl: uploadedImage,
        });
        refreshLocalScans();
        toast({
          title: 'Saved on this device',
          description:
            'You can review it in the list below. Data stays in your browser.',
        });
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Could not save locally.';
        toast({
          title: 'Save failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Log in to save scans to your portfolio or watchlist.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (saveTarget === 'portfolio') {
        const { error } = await saveScanToPortfolio(user.id, results);
        if (error) throw error;
        toast({
          title: 'Saved to portfolio',
          description: 'Open your portal to view and edit the item.',
        });
      } else {
        const { error } = await saveScanToWatchlist(user.id, results);
        if (error) throw error;
        toast({
          title: 'Saved to watchlist',
          description: 'View it anytime under Watchlist in your account.',
        });
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Could not save. Please try again.';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLocal = (id: string) => {
    removeLocalSavedScan(id);
    refreshLocalScans();
    toast({ title: 'Removed', description: 'Scan removed from this device.' });
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

              <div className="space-y-3">
                {(
                  [
                    ['Centering', results.centering],
                    ['Corners', results.corners],
                    ['Edges', results.edges],
                    ['Surface', results.surface],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[7rem_minmax(0,1fr)_2.75rem] gap-3 items-center"
                  >
                    <span className="text-gray-800 shrink-0">{label}</span>
                    <div className="min-w-0 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="bg-[#47682d] h-full rounded-full max-w-full"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#47682d] text-right tabular-nums shrink-0">
                      {value}%
                    </span>
                  </div>
                ))}
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

              <div className="rounded-lg border border-[#14314F]/20 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#14314F]">
                  Save this scan
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs text-gray-600">Destination</label>
                    <Select
                      value={saveTarget}
                      onValueChange={(v) =>
                        setSaveTarget(v as CardScanSaveTarget)
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Choose where to save" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="device">
                          This device (browser)
                        </SelectItem>
                        <SelectItem value="portfolio" disabled={!user}>
                          My portfolio (account)
                        </SelectItem>
                        <SelectItem value="watchlist" disabled={!user}>
                          Watchlist (account)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveScan}
                    disabled={saving}
                    variant="outline"
                    className="border-[#47682d] text-[#47682d] hover:bg-[#47682d]/10 shrink-0"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <BookmarkPlus className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
                {!user && (
                  <p className="text-xs text-gray-600">
                    <Link
                      to="/login"
                      className="text-[#47682d] font-medium underline-offset-2 hover:underline"
                    >
                      Sign in
                    </Link>{' '}
                    to save to your portfolio or watchlist.{' '}
                    <Link
                      to="/portal"
                      className="text-[#47682d] font-medium underline-offset-2 hover:underline"
                    >
                      Portal
                    </Link>
                  </p>
                )}
                {user && (
                  <p className="text-xs text-gray-600">
                    Portfolio and watchlist sync to your account (Supabase).{' '}
                    <Link
                      to="/portal"
                      className="text-[#47682d] font-medium underline-offset-2 hover:underline"
                    >
                      Open portal
                    </Link>
                    {' · '}
                    <Link
                      to="/watchlist"
                      className="text-[#47682d] font-medium underline-offset-2 hover:underline"
                    >
                      Watchlist
                    </Link>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {localScans.length > 0 && (
        <div className="mt-10 border-t border-gray-200 pt-8">
          <h3 className="text-lg font-semibold text-[#14314F] mb-2">
            Saved on this device ({localScans.length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            These stay in your browser only. Clearing site data removes them.
          </p>
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {localScans.map((entry) => (
              <li
                key={entry.id}
                className="flex gap-3 items-start rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                {entry.imageDataUrl ? (
                  <img
                    src={entry.imageDataUrl}
                    alt=""
                    className="w-14 h-14 object-cover rounded-md shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-gray-200 shrink-0 flex items-center justify-center text-xs text-gray-500 text-center px-1">
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-[#14314F]">
                    PSA est. {entry.analysis.predictedGrade.PSA} ·{' '}
                    {new Date(entry.savedAt).toLocaleString()}
                  </p>
                  <p className="text-gray-600 truncate">
                    {entry.analysis.explanation ||
                      entry.analysis.notes ||
                      'Saved scan'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleRemoveLocal(entry.id)}
                  aria-label="Remove from this device"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
