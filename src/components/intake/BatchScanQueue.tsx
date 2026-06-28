import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { v4 as uuidv4 } from 'uuid'
import { Upload, X, Sparkles, ToggleLeft, ToggleRight, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScannedImage } from '@/lib/ximilar'
import { convertTifToJpeg, isTifFile } from '@/lib/tifConverter'
import { resizeDataUrl } from '@/lib/imageUtils'
import DynamsoftScannerPanel from './DynamsoftScannerPanel'
import { useLightbox } from '@/contexts/LightboxContext'

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
  let dataUrl: string

  if (isTifFile(file)) {
    const result = await convertTifToJpeg(file)
    dataUrl = result.preview
  } else {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })
  }

  const resized = await resizeDataUrl(dataUrl, 1200)
  return {
    preview: resized,
    base64: resized.split(',')[1],
  }
}

export default function BatchScanQueue({ onIdentify, loading }: Props) {
  const { open: openLightbox } = useLightbox()
  const [images, setImages] = useState<RawImage[]>([])
  const [pairMode, setPairMode] = useState(true)
  const [converting, setConverting] = useState(false)

  const handleScannerImage = useCallback((result: { front: { base64: string; preview: string }; back?: { base64: string; preview: string } }) => {
    const id = crypto.randomUUID()
    // Front always becomes one image; back (if present) becomes a second image in the batch
    setImages((prev) => {
      const next = [...prev, { id, base64: result.front.base64, preview: result.front.preview }]
      if (result.back) {
        next.push({ id: crypto.randomUUID(), base64: result.back.base64, preview: result.back.preview })
      }
      return next
    })
  }, [])

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

  const swapPair = (frontIdx: number) => {
    setImages((prev) => {
      const next = [...prev]
      const backIdx = frontIdx + 1
      if (backIdx < next.length) {
        ;[next[frontIdx], next[backIdx]] = [next[backIdx], next[frontIdx]]
      }
      return next
    })
  }

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
      onIdentify(
        images.map((img) => ({
          id: img.id,
          base64: img.base64,
          preview: img.preview,
        }))
      )
    }
  }

  const cardCount = pairMode ? Math.ceil(images.length / 2) : images.length

  const renderPairs = () => {
    const pairs: RawImage[][] = []
    for (let i = 0; i < images.length; i += 2) {
      pairs.push(images.slice(i, i + 2))
    }

    return pairs.map((pair, pairIdx) => {
      const pairImgs = pair.map((img, i) => ({ src: img.preview, alt: i === 0 ? 'Front' : 'Back' }))
      return (
      <div key={pair[0].id} className="border rounded-lg p-3 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#14314F]">Card #{pairIdx + 1}</span>
          {pair.length === 2 && (
            <button
              onClick={() => swapPair(pairIdx * 2)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#14314F] transition-colors"
              title="Swap front and back"
            >
              <ArrowLeftRight className="w-3 h-3" />
              Swap front/back
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {pair.map((img, slotIdx) => {
            const isBack = slotIdx === 1
            return (
              <div key={img.id} className="relative flex-1 group">
                <img
                  src={img.preview}
                  alt={isBack ? 'Back' : 'Front'}
                  className="w-full aspect-[2/3] object-cover rounded border-2 border-transparent group-hover:border-gray-300 cursor-pointer"
                  onClick={() => openLightbox(pairImgs, slotIdx)}
                />
                <div className={`absolute top-1 left-1 text-white text-xs font-semibold px-1.5 py-0.5 rounded ${
                  isBack ? 'bg-gray-600' : 'bg-[#14314F]'
                }`}>
                  {isBack ? 'Back' : 'Front'}
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
          {pair.length === 1 && (
            <div className="flex-1 aspect-[2/3] border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
              No back
            </div>
          )}
        </div>
      </div>
    )})
  }

  return (
    <div className="space-y-4">

      {/* â”€â”€ Scanner Panel â”€â”€ sits above the drop zone, feeds the same queue */}
      <DynamsoftScannerPanel onScan={handleScannerImage} />

      {/* â”€â”€ Drop zone â”€â”€ */}
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
            ? 'Processing images...'
            : isDragActive
            ? 'Drop images here...'
            : 'Drag & drop card images, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WEBP, TIF â€” multiple files supported
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
                  ? `${cardCount} card${cardCount !== 1 ? 's' : ''} â€” first image = front, second = back. Use "Swap" to correct order.`
                  : 'Each image = separate card front'}
              </p>
            </div>
            {pairMode
              ? <ToggleRight className="w-6 h-6 text-[#47682d]" />
              : <ToggleLeft  className="w-6 h-6 text-gray-400" />}
          </div>

          {/* Image display */}
          {pairMode ? (
            <div className="space-y-3">{renderPairs()}</div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.preview}
                    alt={`Card ${idx + 1}`}
                    className="w-full aspect-[2/3] object-cover rounded border-2 border-transparent group-hover:border-gray-300 cursor-pointer"
                    onClick={() => openLightbox({ src: img.preview, alt: `Card ${idx + 1}` })}
                  />
                  <button
                    onClick={() => remove(img.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Identify button */}
          <Button
            onClick={handleIdentify}
            disabled={loading || images.length === 0}
            className="w-full bg-[#47682d] hover:bg-[#3a5525] text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {loading
              ? 'Identifying...'
              : `Identify ${cardCount} Card${cardCount !== 1 ? 's' : ''}`}
          </Button>
        </>
      )}
    </div>
  )
}
