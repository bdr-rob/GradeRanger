import { useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Upload, ScanLine, Trash2, Plus, Loader2, Zap } from 'lucide-react';
import { ScannedImage } from '@/lib/ximilar';

interface Props {
  onIdentify: (images: ScannedImage[]) => void;
  loading: boolean;
}

export default function BatchScanQueue({ onIdentify, loading }: Props) {
  const [queue, setQueue] = useState<ScannedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        setQueue((prev) => [
          ...prev,
          { id: uuidv4(), base64, preview: dataUrl },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const remove = (id: string) =>
    setQueue((prev) => prev.filter((img) => img.id !== id));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors hover:border-opacity-80"
        style={{ borderColor: '#14314F40', backgroundColor: '#f8faf9' }}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 opacity-40" style={{ color: '#14314F' }} />
        <p className="font-semibold text-sm" style={{ color: '#14314F' }}>
          Drop card images here or click to upload
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPG, PNG — select multiple files for batch scanning
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Queue grid */}
      {queue.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#14314F' }}>
              {queue.length} card{queue.length !== 1 ? 's' : ''} in queue
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#14314F40', color: '#14314F' }}
            >
              <Plus className="w-3.5 h-3.5" /> Add More
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {queue.map((img, i) => (
              <div key={img.id} className="relative group aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-sm">
                <img
                  src={img.preview}
                  alt={`Card ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(img.id); }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => onIdentify(queue)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#47682d' }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Identifying cards...</>
            ) : (
              <><Zap className="w-4 h-4" /> Identify {queue.length} Card{queue.length !== 1 ? 's' : ''} with AI</>
            )}
          </button>
        </>
      )}
    </div>
  );
}