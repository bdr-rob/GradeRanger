import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useDropzone } from 'react-dropzone'
import { recognizeSlabFromImage, recognizeSlabFromCert, CardHedgeSlabResult } from '@/lib/cardhedge'
import { ScannedImage } from '@/lib/ximilar'
import { convertTifToJpeg, isTifFile } from '@/lib/tifConverter'
import { resizeDataUrl } from '@/lib/imageUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Upload, Award, Hash } from 'lucide-react'

type Path = 'photo' | 'cert'

const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC']

interface Props {
  onResult: (slab: CardHedgeSlabResult) => void
}

async function processFile(file: File): Promise<{ base64: string; preview: string }> {
  let dataUrl: string
  if (isTifFile(file)) {
    const r = await convertTifToJpeg(file)
    dataUrl = r.preview
  } else {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })
  }
  const resized = await resizeDataUrl(dataUrl, 1200)
  return { preview: resized, base64: resized.split(',')[1] }
}

// ── Photo scan path ───────────────────────────────────────────────────────────

function PhotoScanPath({ onResult }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [image,   setImage]   = useState<ScannedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setError(null)
    const { base64, preview: prev } = await processFile(file)
    const id = uuidv4()
    setImage({ id, base64, preview: prev })
    setPreview(prev)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  })

  const handleIdentify = async () => {
    if (!image) return
    setLoading(true)
    setError(null)
    try {
      const result = await recognizeSlabFromImage(image)
      onResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-[#14314F] bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
        `}
      >
        <input {...getInputProps()} />
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Slab preview" className="max-h-56 object-contain rounded border shadow-sm" />
            <p className="text-sm text-muted-foreground">Click or drop to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Award className="w-10 h-10 text-gray-300" />
            <p className="font-medium">Drop a slab photo here, or click to browse</p>
            <p className="text-xs text-gray-400">AI reads the label — PSA · BGS · CGC · SGC and more</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Button
        onClick={handleIdentify}
        disabled={!image || loading}
        className="w-full bg-[#14314F] hover:bg-[#1a3d63] text-white"
        size="lg"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning slab…</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" />Identify Slab</>
        )}
      </Button>
    </div>
  )
}

// ── Cert number lookup path ───────────────────────────────────────────────────

function CertLookupPath({ onResult }: Props) {
  const [certNumber, setCertNumber] = useState('')
  const [grader,     setGrader]     = useState('PSA')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleLookup = async () => {
    const clean = certNumber.trim().replace(/\D/g, '')
    if (!clean) { setError('Enter a cert number'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await recognizeSlabFromCert(clean, grader)
      onResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 space-y-4">
        <div className="flex flex-col items-center gap-2 text-gray-500 mb-2">
          <Hash className="w-10 h-10 text-gray-300" />
          <p className="font-medium text-gray-700">Look Up by Cert Number</p>
          <p className="text-xs text-gray-400 text-center">
            Returns card details + recent sale prices from PSA, BGS, CGC and SGC registries.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Grading Company</Label>
            <Select value={grader} onValueChange={setGrader}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cert Number</Label>
            <Input
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="e.g. 12345678"
              className="mt-1 text-center tracking-widest"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Button
        onClick={handleLookup}
        disabled={!certNumber.trim() || loading}
        className="w-full bg-[#14314F] hover:bg-[#1a3d63] text-white"
        size="lg"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Looking up…</>
        ) : (
          <><Hash className="w-4 h-4 mr-2" />Look Up Cert</>
        )}
      </Button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SlabScanCapture({ onResult }: Props) {
  const [path, setPath] = useState<Path>('photo')

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden w-full">
        <button
          onClick={() => setPath('photo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors
            ${path === 'photo' ? 'bg-[#14314F] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          <Award className="w-4 h-4" />
          Scan Photo
        </button>
        <button
          onClick={() => setPath('cert')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-gray-200
            ${path === 'cert' ? 'bg-[#14314F] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          <Hash className="w-4 h-4" />
          Cert Lookup
        </button>
      </div>

      {path === 'photo'
        ? <PhotoScanPath onResult={onResult} />
        : <CertLookupPath onResult={onResult} />
      }
    </div>
  )
}
