import React, { useCallback, useState } from 'react';
import { Upload, ImagePlus, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  frontImage: string | null;
  backImage: string | null;
  onFrontChange: (dataUrl: string) => void;
  onBackChange: (dataUrl: string) => void;
  onNext: () => void;
}

function DropZone({
  label,
  image,
  onFile,
}: {
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) readFile(file);
    },
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
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
        onDrop={handleDrop}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={handleChange} />
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

export default function ScanStep({ frontImage, backImage, onFrontChange, onBackChange, onNext }: Props) {
  const canContinue = frontImage !== null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#14314F]">Upload card images</h3>
        <p className="text-sm text-gray-500 mt-1">
          Upload the front (required) and back of your card. Higher resolution gives better AI results.
        </p>
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        <DropZone label="Front of card" image={frontImage} onFile={onFrontChange} />
        <DropZone label="Back of card" image={backImage} onFile={onBackChange} />
      </div>

      {frontImage && !backImage && (
        <p className="text-sm text-amber-600 flex items-center gap-1">
          <Upload className="h-4 w-4" />
          Back image is optional but improves grading accuracy.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="bg-[#47682d] hover:bg-[#47682d]/90 text-white"
        >
          Continue to purchase details
        </Button>
      </div>
    </div>
  );
}
