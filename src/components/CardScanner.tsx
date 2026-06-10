import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Camera, Upload, BookmarkPlus, Trash2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CardScanAnalysisData,
  CardScanSaveTarget,
  GradingDecision,
} from '@/types/cardScan';
import { analyzeCardRemote } from '@/lib/cardScanClient';
import {
  addLocalSavedScan,
  getLocalSavedScans,
  removeLocalSavedScan,
  updateLocalSavedScan,
} from '@/lib/savedLocalScans';
import {
  saveScanToPortfolio,
  saveScanToWatchlist,
} from '@/lib/saveCardScanRemote';
import GradingDecisionEngine from '@/components/GradingDecisionEngine';
import { ebayAPI } from '@/lib/api/ebay';

// Dynamsoft is configured globally in main.tsx
declare const Dynamsoft: any;

type CardSide = 'front' | 'back';
type InputMode = 'upload' | 'scanner';

export default function CardScanner() {
  const { user } = useAuth();

  // ── Image state ────────────────────────────────────────────────────────────
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontBase64, setFrontBase64] = useState<string | null>(null);
  const [backBase64, setBackBase64] = useState<string | null>(null);

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<CardScanAnalysisData | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [saveTarget, setSaveTarget] = useState<CardScanSaveTarget>('device');
  const [localScans, setLocalScans] = useState(() => getLocalSavedScans());
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  // ── Scanner (Dynamsoft) state ──────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [dwtReady, setDwtReady] = useState(false);
  const [dwtLoading, setDwtLoading] = useState(false);
  const [scannerSources, setScannerSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const dwtRef = useRef<any>(null);

  const { toast } = useToast();

  useEffect(() => {
    setLocalScans(getLocalSavedScans());
  }, []);

  // ── Dynamsoft initialization ───────────────────────────────────────────────
  const initializeDWT = useCallback(async () => {
    if (dwtRef.current || dwtLoading) return;
    setDwtLoading(true);
    setScanStatus('Connecting to scanner service…');

    try {
      await new Promise<void>((resolve, reject) => {
        Dynamsoft.DWT.CreateDWTObjectEx(
          { WebTwainId: 'GradeRangerDWT' },
          (obj: any) => {
            dwtRef.current = obj;
            const sources: string[] = obj.GetSourceNames() ?? [];
            setScannerSources(sources);
            if (sources.length > 0) setSelectedSource(0);
            setDwtReady(true);
            setScanStatus(
              sources.length > 0
                ? `${sources.length} scanner(s) found`
                : 'No scanners found — check USB connection'
            );
            resolve();
          },
          (code: number, msg: string) => {
            reject(new Error(msg || `Scanner service error (${code})`));
          }
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setScanStatus('');
      toast({
        title: 'Scanner unavailable',
        description: 'Install Dynamsoft Service to use the Ricoh scanner. Use Upload mode in the meantime.',
        variant: 'destructive',
      });
      console.warn('[DWT]', msg);
    } finally {
      setDwtLoading(false);
    }
  }, [dwtLoading, toast]);

  useEffect(() => {
    if (inputMode === 'scanner') {
      initializeDWT();
    }
    return () => {
      if (inputMode !== 'scanner' && dwtRef.current) {
        try { Dynamsoft.DWT.DeleteDWTObject('GradeRangerDWT'); } catch {}
        dwtRef.current = null;
        setDwtReady(false);
      }
    };
  }, [inputMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scanner capture ────────────────────────────────────────────────────────
  const scanCard = useCallback(async (side: CardSide) => {
    if (!dwtRef.current) {
      toast({ title: 'Scanner not ready', variant: 'destructive' });
      return;
    }

    const dwt = dwtRef.current;
    setScanStatus(`Scanning ${side}…`);

    try {
      if (!dwt.SelectSourceByIndex(selectedSource)) {
        throw new Error('Could not select scanner source');
      }

      await new Promise<void>((resolve, reject) => {
        dwt.OpenSource();
        dwt.AcquireImage(
          { PixelType: 2, Resolution: 600, IfDisableSourceAfterAcquire: true },
          () => resolve(),
          (code: number, msg: string) =>
            reject(new Error(msg || `Scan failed (${code})`))
        );
      });

      const base64Str: string = await new Promise((resolve, reject) => {
        dwt.ConvertToBase64(
          [dwt.CurrentImageIndexInBuffer],
          4, // JPEG
          (result: any) => resolve(result.getData(0, result.getLength())),
          (code: number, msg: string) =>
            reject(new Error(msg || `Conversion failed (${code})`))
        );
      });

      const dataUrl = `data:image/jpeg;base64,${base64Str}`;
      if (side === 'front') {
        setFrontImage(dataUrl);
        setFrontBase64(base64Str);
      } else {
        setBackImage(dataUrl);
        setBackBase64(base64Str);
      }

      setResults(null);
      setIsDemoMode(false);
      setScanStatus(`${side === 'front' ? 'Front' : 'Back'} scanned ✓`);
      toast({
        title: `${side === 'front' ? 'Front' : 'Back'} scanned`,
        description: `Now scan the ${side === 'front' ? 'back' : 'front'} to continue.`,
      });

      dwt.RemoveAllImages();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      setScanStatus('');
      toast({ title: 'Scan failed', description: message, variant: 'destructive' });
    }
  }, [selectedSource, toast]);

  // ── Upload helpers ─────────────────────────────────────────────────────────
  const resetUpload = () => {
    setFrontImage(null);
    setBackImage(null);
    setFrontBase64(null);
    setBackBase64(null);
    setResults(null);
    setIsDemoMode(false);
    setActiveScanId(null);
    setScanStatus('');
  };

  const loadFile = useCallback((file: File, side: CardSide) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      if (side === 'front') { setFrontImage(dataUrl); setFrontBase64(raw); }
      else { setBackImage(dataUrl); setBackBase64(raw); }
      setResults(null);
      setIsDemoMode(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileUpload =
    (side: CardSide) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file, side);
      e.target.value = '';
    };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (side: CardSide) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) loadFile(file, side);
  };

  const bothImagesReady = Boolean(frontBase64 && backBase64);

  // ── Analysis ───────────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!frontBase64 || !backBase64) {
      toast({
        title: 'Both sides required',
        description: 'Capture or upload a front and back image before analyzing.',
        variant: 'destructive',
      });
      return;
    }

    setScanning(true);
    setResults(null);
    setIsDemoMode(false);
    setActiveScanId(null);

    try {
      // analyzeCardRemote handles: Claude Sonnet → local scanner → demo fallback
      const data = await analyzeCardRemote(frontBase64, backBase64);

      const isDemo = Boolean(data.notes?.toLowerCase().includes('demo mode'));
      setIsDemoMode(isDemo);

      // Auto-fetch eBay sold comps when Claude identifies the card
      if (!isDemo && data.cardIdentification?.player) {
        try {
          const { player, year, set } = data.cardIdentification;
          const keywords = [player, year, set].filter(Boolean).join(' ');
          const compsRes = await ebayAPI.getSoldComps({
            keywords: `${keywords} PSA`,
            limit: 30,
          });
          if (compsRes.success && compsRes.data?.stats) {
            const avg = compsRes.data.stats.avgPrice;
            data.pricing = {
              raw_avg: Math.round(avg * 0.55),
              psa9_avg: Math.round(avg),
              psa10_avg: Math.round(avg * 1.6),
            };
          }
        } catch {
          // Pricing failure doesn't block grading display
        }
      }

      setResults(data);
      toast({
        title: isDemo ? 'Demo mode' : 'Analysis complete',
        description: isDemo
          ? 'Claude Sonnet not connected yet — showing placeholder scores.'
          : 'Estimated grades are informational only.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to analyze card.';
      toast({ title: 'Analysis failed', description: message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  // ── Save handlers ──────────────────────────────────────────────────────────
  const refreshLocalScans = () => setLocalScans(getLocalSavedScans());

  const handleSaveScan = async () => {
    if (!results) return;

    if (saveTarget === 'device') {
      setSaving(true);
      try {
        const saved = addLocalSavedScan({
          analysis: results,
          imageDataUrl: frontImage,
          backImageDataUrl: backImage,
        });
        setActiveScanId(saved.id);
        refreshLocalScans();
        toast({
          title: 'Saved on this device',
          description: 'Data stays in your browser.',
        });
      } catch (e: unknown) {
        toast({
          title: 'Save failed',
          description: e instanceof Error ? e.message : 'Could not save locally.',
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
        description: 'Log in to save to portfolio or watchlist.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (saveTarget === 'portfolio') {
        const { error } = await saveScanToPortfolio(user.id, results);
        if (error) throw error;
        toast({ title: 'Saved to portfolio', description: 'Open your portal to view it.' });
      } else {
        const { error } = await saveScanToWatchlist(user.id, results);
        if (error) throw error;
        toast({ title: 'Saved to watchlist' });
      }
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDecisionSaved = (decision: GradingDecision) => {
    if (!results) return;
    const updated = { ...results, gradingDecision: decision };
    setResults(updated);
    if (activeScanId) {
      try {
        updateLocalSavedScan(activeScanId, { analysis: updated });
        refreshLocalScans();
      } catch {}
    }
    toast({
      title: 'Decision saved',
      description: `Route: ${decision.route.replace('_', ' ')} · ${decision.stage3Zone} zone`,
    });
  };

  const handleRemoveLocal = (id: string) => {
    removeLocalSavedScan(id);
    if (activeScanId === id) setActiveScanId(null);
    refreshLocalScans();
    toast({ title: 'Removed from this device' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-8 h-8 text-[#47682d]" />
        <h2 className="text-3xl font-bold text-[#14314F]">AI Card Scanner</h2>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Both the front and back of your card are required for analysis.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* ── LEFT: input controls ── */}
        <div className="space-y-4">

          {/* Tab switcher */}
          <div className="flex gap-2 border-b border-gray-200 pb-3">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                inputMode === 'upload'
                  ? 'bg-[#47682d] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Photos
            </button>
            <button
              type="button"
              onClick={() => setInputMode('scanner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                inputMode === 'scanner'
                  ? 'bg-[#47682d] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Scan className="w-4 h-4" />
              Ricoh Scanner
            </button>
          </div>

          {/* ── Upload mode ── */}
          {inputMode === 'upload' && (
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { side: 'front' as const, label: 'Front', image: frontImage },
                  { side: 'back' as const, label: 'Back', image: backImage },
                ] as const
              ).map(({ side, label, image }) => (
                <div key={side} className="space-y-2">
                  <p className="text-xl font-bold text-[#14314F]">
                    {label}{' '}
                    <span className="text-red-600" aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </p>
                  <div
                    className="border-4 border-dashed border-[#47682d] rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition min-h-[12rem] flex flex-col justify-center"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(side)}
                  >
                    {!image ? (
                      <label className="cursor-pointer block py-4">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload(side)}
                          aria-label={`Upload ${label.toLowerCase()} of card`}
                        />
                        <Upload className="w-10 h-10 mx-auto mb-2 text-[#47682d]" />
                        <p className="text-sm text-gray-700">Click or drag {label.toLowerCase()} photo</p>
                        <p className="text-xs text-gray-500 mt-1">JPG, PNG, HEIC</p>
                      </label>
                    ) : (
                      <div>
                        <img
                          src={image}
                          alt={`${label} of card`}
                          className="max-h-48 mx-auto rounded-lg shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (side === 'front') { setFrontImage(null); setFrontBase64(null); }
                            else { setBackImage(null); setBackBase64(null); }
                            setResults(null);
                            setIsDemoMode(false);
                          }}
                          className="mt-3 text-[#47682d] hover:underline text-xs"
                        >
                          Replace {label.toLowerCase()}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Scanner mode (Dynamsoft + Ricoh 8170) ── */}
          {inputMode === 'scanner' && (
            <div className="space-y-4">
              {/* Source selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Scanner source</label>
                {dwtLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting to scanner service…
                  </div>
                ) : !dwtReady ? (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="font-medium">Scanner service not detected</p>
                    <p className="mt-1 text-xs">
                      Dynamsoft Service must be installed and running on this computer.
                    </p>
                    <a
                      href="https://www.dynamsoft.com/web-twain/downloads/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#47682d] underline text-xs mt-2 inline-block"
                    >
                      Download Dynamsoft Service →
                    </a>
                  </div>
                ) : scannerSources.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                    No scanners found. Check that the Ricoh 8170 is powered on and connected via USB.
                  </p>
                ) : (
                  <Select
                    value={String(selectedSource)}
                    onValueChange={(v) => setSelectedSource(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scanner" />
                    </SelectTrigger>
                    <SelectContent>
                      {scannerSources.map((name, i) => (
                        <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Scan buttons */}
              <div className="grid grid-cols-2 gap-3">
                {(['front', 'back'] as CardSide[]).map((side) => {
                  const image = side === 'front' ? frontImage : backImage;
                  const label = side === 'front' ? 'Front' : 'Back';
                  return (
                    <div key={side} className="space-y-2">
                      <p className="text-sm font-bold text-[#14314F]">
                        {label} <span className="text-red-600">*</span>
                      </p>
                      {image ? (
                        <div className="text-center">
                          <img
                            src={image}
                            alt={label}
                            className="max-h-36 mx-auto rounded-lg shadow-md mb-2"
                          />
                          <button
                            type="button"
                            onClick={() => scanCard(side)}
                            disabled={!dwtReady}
                            className="text-xs text-[#47682d] hover:underline"
                          >
                            Re-scan {label.toLowerCase()}
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-[#47682d] text-[#47682d] hover:bg-[#47682d]/10"
                          onClick={() => scanCard(side)}
                          disabled={!dwtReady || scannerSources.length === 0}
                        >
                          <Scan className="w-4 h-4 mr-2" />
                          Scan {label}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {scanStatus && (
                <p className="text-xs text-gray-600 italic">{scanStatus}</p>
              )}
            </div>
          )}

          {/* Analyze button — shared between both modes */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              onClick={runAnalysis}
              disabled={scanning || !bothImagesReady}
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
            {(frontImage || backImage) && (
              <button
                type="button"
                onClick={resetUpload}
                className="text-[#47682d] hover:underline text-sm self-center"
              >
                Clear both photos
              </button>
            )}
          </div>
          {!bothImagesReady && (frontImage || backImage) && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Add the {frontImage ? 'back' : 'front'} to continue.
            </p>
          )}
        </div>

        {/* ── RIGHT: results ── */}
        <div>
          {scanning && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 animate-spin text-[#47682d] mx-auto mb-4" />
              <p className="text-lg text-gray-700">Analyzing your card…</p>
              <p className="text-sm text-gray-500 mt-2">Claude Sonnet is examining both sides</p>
            </div>
          )}

          {results && !scanning && (
            <div className="space-y-4">
              {isDemoMode && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Demo mode — Claude Sonnet not yet connected. Wire the{' '}
                  <code className="rounded bg-amber-100 px-1">grade-analyze</code> edge function for live grading.
                </div>
              )}

              {/* Card identification (populated by Claude) */}
              {results.cardIdentification?.player && (
                <div className="bg-[#14314F]/5 border border-[#14314F]/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-[#14314F] mb-2">Card identified</p>
                  <div className="text-sm text-gray-700 space-y-0.5">
                    {results.cardIdentification.player && (
                      <p><strong>Player:</strong> {results.cardIdentification.player}</p>
                    )}
                    {results.cardIdentification.year && (
                      <p><strong>Year:</strong> {results.cardIdentification.year}</p>
                    )}
                    {results.cardIdentification.set && (
                      <p><strong>Set:</strong> {results.cardIdentification.set}</p>
                    )}
                    {results.cardIdentification.variant && (
                      <p><strong>Variant:</strong> {results.cardIdentification.variant}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      ID confidence: {Math.round((results.cardIdentification.confidence ?? 0) * 100)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Predicted grades — all 5 services */}
              <div className="bg-[#14314F] text-white p-4 rounded-lg">
                <h3 className="font-bold mb-1">Predicted grades</h3>
                <p className="text-xs text-white/60 mb-3">
                  Informational estimates only — not a substitute for professional grading.
                </p>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: 'PSA', value: results.predictedGrade?.PSA },
                    { label: 'BGS', value: results.predictedGrade?.Beckett },
                    { label: 'SGC', value: results.predictedGrade?.SGC },
                    { label: 'CGC', value: results.predictedGrade?.CGC },
                    { label: 'TAG', value: results.predictedGrade?.TAG },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-xl font-bold text-[#ABD2BE]">
                        {value ?? '—'}
                      </span>
                      <br />
                      <span className="text-xs text-white/60">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* eBay sold comps pricing */}
              {results.pricing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-900 mb-2">
                    Market pricing (eBay sold comps)
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Raw avg', value: results.pricing.raw_avg },
                      { label: 'PSA 9', value: results.pricing.psa9_avg },
                      { label: 'PSA 10', value: results.pricing.psa10_avg },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-lg font-bold text-green-700">${value}</p>
                        <p className="text-xs text-gray-600">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Centering detail */}
              {(results.centeringRatio != null || results.centeringGradeLabel) && (
                <div className="text-sm text-gray-600 space-y-1 bg-gray-50 rounded-lg p-3">
                  {results.centeringRatio != null && (
                    <p>
                      <strong>Centering ratio:</strong>{' '}
                      {results.centeringRatio.toFixed(3)} (0.5 = balanced)
                    </p>
                  )}
                  {results.centeringGradeLabel && (
                    <p>
                      <strong>Centering band:</strong> {results.centeringGradeLabel}
                    </p>
                  )}
                </div>
              )}

              {/* Score bars */}
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

              {/* Deal score */}
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Deal score</p>
                <p className="text-3xl font-bold text-green-600">{results.dealScore}/5</p>
                <p className="text-xs text-gray-500 mt-1">{results.confidence}% confidence</p>
              </div>

              {results.explanation && (
                <div className="bg-[#14314F]/5 border border-[#14314F]/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-[#14314F] mb-1">Summary</p>
                  <p className="text-sm text-gray-700">{results.explanation}</p>
                </div>
              )}

              {results.warnings && results.warnings.length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold text-orange-900 mb-1">Warnings</p>
                  <ul className="text-sm text-orange-900 list-disc list-inside space-y-1">
                    {results.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {results.notes && !isDemoMode && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{results.notes}</p>
                </div>
              )}

              {/* Save scan */}
              <div className="rounded-lg border border-[#14314F]/20 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#14314F]">Save this scan</p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs text-gray-600">Destination</label>
                    <Select
                      value={saveTarget}
                      onValueChange={(v) => setSaveTarget(v as CardScanSaveTarget)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Choose where to save" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="device">This device (browser)</SelectItem>
                        <SelectItem value="portfolio" disabled={!user}>My portfolio (account)</SelectItem>
                        <SelectItem value="watchlist" disabled={!user}>Watchlist (account)</SelectItem>
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
                      <><BookmarkPlus className="w-4 h-4 mr-2" />Save</>
                    )}
                  </Button>
                </div>
                {!user && (
                  <p className="text-xs text-gray-600">
                    <Link to="/login" className="text-[#47682d] font-medium underline-offset-2 hover:underline">
                      Sign in
                    </Link>{' '}
                    to save to your portfolio or watchlist.
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <GradingDecisionEngine
                  analysis={results}
                  onDecisionSaved={handleDecisionSaved}
                  existingDecision={results.gradingDecision}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved local scans */}
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
                <div className="flex gap-1 shrink-0">
                  {entry.imageDataUrl ? (
                    <img src={entry.imageDataUrl} alt="Front" className="w-14 h-14 object-cover rounded-md" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-gray-200 flex items-center justify-center text-xs text-gray-500">No front</div>
                  )}
                  {entry.backImageDataUrl ? (
                    <img src={entry.backImageDataUrl} alt="Back" className="w-14 h-14 object-cover rounded-md" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-gray-200 flex items-center justify-center text-xs text-gray-500">No back</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-[#14314F]">
                    PSA est. {entry.analysis.predictedGrade.PSA} ·{' '}
                    {new Date(entry.savedAt).toLocaleString()}
                  </p>
                  <p className="text-gray-600 truncate">
                    {entry.analysis.explanation || entry.analysis.notes || 'Saved scan'}
                  </p>
                  {entry.analysis.gradingDecision && (
                    <p className="text-xs mt-1 font-medium text-[#14314F]/70">
                      Decision: {entry.analysis.gradingDecision.route.replace('_', ' ')} ·{' '}
                      {entry.analysis.gradingDecision.stage3Zone} zone
                    </p>
                  )}
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