import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, ImagePlus, CheckCircle2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Dynamsoft is configured globally in main.tsx
declare const Dynamsoft: any;

type InputMode = 'upload' | 'scanner';
type CardSide = 'front' | 'back';

interface Props {
  frontImage: string | null;
  backImage: string | null;
  onFrontChange: (dataUrl: string) => void;
  onBackChange: (dataUrl: string) => void;
  onNext: () => void;
}

function DropZone({ label, image, onFile }: {
  label: string;
  image: string | null;
  onFile: (dataUrl: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onFile(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <label
        className={cn(
          'relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden',
          dragging ? 'border-[#47682d] bg-[#47682d]/5' : 'border-gray-300 hover:border-[#47682d]/60',
          image ? 'h-64' : 'h-48',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('image/')) readFile(file);
        }}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
        {image ? (
          <>
            <img src={image} alt={label} className="h-full w-full object-contain" />
            <div className="absolute top-2 right-2 bg-[#47682d] rounded-full p-0.5">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 px-4 text-center">
            <ImagePlus className="h-10 w-10" />
            <span className="text-sm">Drag & drop or click to upload</span>
            <span className="text-xs">PNG, JPG, WEBP — high resolution preferred</span>
          </div>
        )}
      </label>
    </div>
  );
}

function ScannerPanel({ onFrontChange, onBackChange, frontImage, backImage }: {
  onFrontChange: (dataUrl: string) => void;
  onBackChange: (dataUrl: string) => void;
  frontImage: string | null;
  backImage: string | null;
}) {
  const [dwtReady, setDwtReady] = useState(false);
  const [dwtLoading, setDwtLoading] = useState(false);
  const [scannerSources, setScannerSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [scanning, setScanning] = useState<CardSide | null>(null);
  const dwtRef = useRef<any>(null);

  useEffect(() => {
    if (dwtRef.current || dwtLoading) return;
    setDwtLoading(true);
    setScanStatus('Connecting to scanner service…');

    Dynamsoft.DWT.CreateDWTObjectEx(
      { WebTwainId: 'GradeRangerIntakeDWT' },
      (obj: any) => {
        dwtRef.current = obj;
        const sources: string[] = obj.GetSourceNames() ?? [];
        setScannerSources(sources);
        setDwtReady(true);
        setDwtLoading(false);
        setScanStatus(
          sources.length > 0
            ? `${sources.length} scanner(s) found`
            : 'No scanners found — check USB connection',
        );
      },
      (_code: number, msg: string) => {
        setDwtLoading(false);
        setScanStatus('Scanner service unavailable. Install Dynamsoft Service or use Upload mode.');
      },
    );

    return () => {
      if (dwtRef.current) {
        try { Dynamsoft.DWT.DeleteDWTObject('GradeRangerIntakeDWT'); } catch {}
        dwtRef.current = null;
      }
    };
  }, []);

  const scanCard = useCallback(async (side: CardSide) => {
    if (!dwtRef.current) return;
    const dwt = dwtRef.current;
    setScanning(side);
    setScanStatus(`Scanning ${side}…`);

    try {
      if (!dwt.SelectSourceByIndex(selectedSource)) throw new Error('Could not select scanner');

      await new Promise<void>((resolve, reject) => {
        dwt.OpenSource();
        dwt.AcquireImage(
          { PixelType: 2, Resolution: 600, IfDisableSourceAfterAcquire: true },
          () => resolve(),
          (_code: number, msg: string) => reject(new Error(msg || 'Scan failed')),
        );
      });

      const base64Str: string = await new Promise((resolve, reject) => {
        dwt.ConvertToBase64(
          [dwt.CurrentImageIndexInBuffer],
          1, //JPEG
          (result: any) => resolve(result.getData(0, result.getLength())),
          (_code: number, msg: string) => reject(new Error(msg || 'Conversion failed')),
        );
      });

      const dataUrl = `data:image/jpeg;base64,${base64Str}`;
      if (side === 'front') onFrontChange(dataUrl);
      else onBackChange(dataUrl);
      setScanStatus(`${side === 'front' ? 'Front' : 'Back'} scanned ✓`);
      dwt.RemoveAllImages();
    } catch (err) {
      setScanStatus(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(null);
    }
  }, [selectedSource, onFrontChange, onBackChange]);

  return (
    <div className="space-y-4">
      {/* Scanner selector */}
      {dwtReady && scannerSources.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 shrink-0">Scanner:</span>
          <Select value={String(selectedSource)} onValueChange={(v) => setSelectedSource(Number(v))}>
            <SelectTrigger className="w-72 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scannerSources.map((src, i) => (
                <SelectItem key={i} value={String(i)}>{src}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Status line */}
      {(dwtLoading || scanStatus) && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          {dwtLoading && (
            <span className="h-3 w-3 rounded-full border-2 border-[#47682d] border-t-transparent animate-spin" />
          )}
          {scanStatus}
        </p>
      )}

      {/* Front / Back panels */}
      <div className="flex gap-4 flex-col sm:flex-row">
        {(['front', 'back'] as CardSide[]).map((side) => {
          const image = side === 'front' ? frontImage : backImage;
          const isScanningThis = scanning === side;
          return (
            <div key={side} className="flex-1 space-y-2">
              <p className="text-sm font-medium text-gray-700 capitalize">{side} of card</p>
              {image ? (
                <div className="relative rounded-xl border overflow-hidden h-64">
                  <img src={image} alt={side} className="h-full w-full object-contain" />
                  <div className="absolute top-2 right-2 bg-[#47682d] rounded-full p-0.5">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-300 h-48 flex items-center justify-center text-gray-300">
                  <ImagePlus className="h-8 w-8" />
                </div>
              )}
              <Button
                size="sm"
                className={cn('w-full text-white', side === 'front'
                  ? 'bg-[#14314F] hover:bg-[#14314F]/90'
                  : 'bg-gray-600 hover:bg-gray-700'
                )}
                disabled={!dwtReady || scanning !== null}
                onClick={() => scanCard(side)}
              >
                {isScanningThis ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                    Scanning…
                  </>
                ) : (
                  <>
                    <Scan className="h-3.5 w-3.5 mr-1.5" />
                    Scan {side}
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {!dwtReady && !dwtLoading && (
        <p className="text-xs text-amber-600">
          Dynamsoft Service must be running on this machine.{' '}
          <a
            href="https://www.dynamsoft.com/web-twain/downloads/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Download here
          </a>{' '}
          if not installed.
        </p>
      )}
    </div>
  );
}

export default function ScanStep({ frontImage, backImage, onFrontChange, onBackChange, onNext }: Props) {
  const [mode, setMode] = useState<InputMode>('upload');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#14314F]">Card images</h3>
        <p className="text-sm text-gray-500 mt-1">
          Use your Ricoh scanner or upload photo files. Front image is required.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setMode('upload')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            mode === 'upload' ? 'bg-white text-[#14314F] shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
        <button
          onClick={() => setMode('scanner')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            mode === 'scanner' ? 'bg-white text-[#14314F] shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Scan className="h-3.5 w-3.5" /> Scanner
        </button>
      </div>

      {/* Panels */}
      {mode === 'upload' ? (
        <div className="flex gap-4 flex-col sm:flex-row">
          <DropZone label="Front of card" image={frontImage} onFile={onFrontChange} />
          <DropZone label="Back of card" image={backImage} onFile={onBackChange} />
        </div>
      ) : (
        <ScannerPanel
          frontImage={frontImage}
          backImage={backImage}
          onFrontChange={onFrontChange}
          onBackChange={onBackChange}
        />
      )}

      {frontImage && !backImage && mode === 'upload' && (
        <p className="text-sm text-amber-600 flex items-center gap-1">
          <Upload className="h-4 w-4" />
          Back image is optional but improves grading accuracy.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!frontImage}
          className="bg-[#47682d] hover:bg-[#47682d]/90 text-white"
        >
          Continue to purchase details
        </Button>
      </div>
    </div>
  );
}