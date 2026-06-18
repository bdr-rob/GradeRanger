import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { v4 as uuidv4 } from 'uuid'
import { Upload, X, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScannedImage } from '@/lib/ximilar'
import { convertTifToJpeg, isTifFile } from '@/lib/tifConverter'

interface RawImage {
  id: string
  base64: string
  preview: string
}

interface Props {
  onIdentify: (images: ScannedImage[]) => void
  loading: boolean
}

async function processFile(file: File): Promise<{ base64: string; preview: string }> {
  if (isTifFile(file)) {
    return convertTifToJpeg(file)
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      resolve({ preview: dataUrl, base64: dataUrl.split(',')[1] })
    }
    reader.readAsDataURL(file)
  })
}

export default function BatchScanQueue({ onIdentify, loading }: Props) {
  const [images, setImages] = useState<RawImage[]>([])
  const [pairMode, setPairMode] = useState(true)
  const [converting, setConverting] = useState(false)

  const onDrop = useCallback(async (accepted: File[]) => {
    setConverting(true)
    const converted = await Promise.all(
      accepted.map(async (f) => {
        try {
          const { base64, preview } = await processFile(f)
          return { id: uuidv4(), base64, preview }
        } catch (err) {
          console.error(`Failed to process ${f.name}:`, err)
          return null
        }
      })
    )
    setImages((prev) => [...prev, ...(converted.filter(Boolean) as RawImage[])])
    setConverting(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'image/tiff': ['.tif', '.tiff'],
    },
    multiple: true,
  })

  const remove = (id: string) => setImages((prev) => prev.filter((img) => img.id !== id))

  const handleIdentify = () => {
    if (images.length === 0) return

    if (pairMode) {
      const paired: ScannedImage[] = []
      for (let i = 0; i < images.length; i += 2) {
        const front = images[i]
        const back = images[i + 1]
        paired.push({
          id: front.id,
          base64: front.base64,
          preview: front.preview,
          backBase64: back?.base64,
          backPreview: back?.preview,
        })
      }
      onIdentify(paired)
    } else {
      onIdentify(images.map((img) => ({
        id: img.id,
        base64: img.base64,
        preview: img.preview,
      })))
    }
  }

  const cardCount = pairMode ? Math.ceil(images.length / 2) : images.length

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-[#47682d] bg-green-50'
            : 'border-gray-300 hover:border-[#14314F] hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          {converting
            ? 'Converting TIF files...'
            : isDragActive
            ? 'Drop images here...'
            : 'Drag & drop card images, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WEBP, TIF — multiple files supported
        </p>
      </div>

      {images.length > 0 && (
        <>
          {/* Front/Back pair toggle */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 cursor-pointer select-none"
            onClick={() => setPairMode((v) => !v)}
          >
            <div>
              <p className="text-sm font-medium text-gray-800">Front/Back pair mode</p>
              <p className="text-xs text-muted-foreground">
                {pairMode
                  ? `Images grouped as pairs → ${cardCount} card${cardCount !== 1 ? 's' : ''} (odd image = front only)`
                  : 'Each image = separate card front'}
              </p>
            </div>
            {pairMode
              ? <ToggleRight className="w-6 h-6 text-[#47682d]" />
              : <ToggleLeft className="w-6 h-6 text-gray-400" />
            }
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-4 gap-3">
            {images.map((img, idx) => {
              const pairLabel = pairMode ? (idx % 2 === 0 ? 'Front' : 'Back') : null
              const cardNum = pairMode ? Math.floor(idx / 2) + 1 : idx + 1

              return (
                <div key={img.id} className="relative group">
                  <img
                    src={img.preview}
                    alt={`Card ${idx + 1}`}
                    className="w-full aspect-[2/3] object-cover rounded border"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5 rounded-b">
                    {pairMode ? `Card ${cardNum} · ${pairLabel}` : `Card ${cardNum}`}
                  </div>
                  <button
                    onClick={() => remove(img.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Identify button */}
          <Button
            onClick={handleIdentify}
            disabled={loading || converting || images.length === 0}
            className="w-full bg-[#47682d] hover:bg-[#3a5525] text-white"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {loading
              ? 'Identifying...'
              : `Identify ${cardCount} Card${cardCount !== 1 ? 's' : ''} with AI`}
          </Button>
        </>
      )}
    </div>
  )
}