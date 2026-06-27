import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useDropzone } from 'react-dropzone'
import { recognizeSlabFromImage } from '@/lib/cardhedge'
import { ScannedImage } from '@/lib/ximilar'
import { supabase } from '@/lib/supabase'
import { convertTifToJpeg, isTifFile } from '@/lib/tifConverter'
import { resizeDataUrl } from '@/lib/imageUtils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Award, CheckCircle2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const GRADING_COMPANIES = ['PSA', 'BECKETT', 'CGC', 'SGC', 'ACE', 'MANA', 'TAG']

interface Props {
  cardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: () => void
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

type Step = 'upload' | 'scanning' | 'confirm'

export default function ConfirmGradeDialog({ cardId, open, onOpenChange, onConfirmed }: Props) {
  const { toast } = useToast()
  const [step,         setStep]         = useState<Step>('upload')
  const [preview,      setPreview]      = useState<string | null>(null)
  const [image,        setImage]        = useState<ScannedImage | null>(null)
  const [gradeCompany, setGradeCompany] = useState('')
  const [gradeValue,   setGradeValue]   = useState('')
  const [certNumber,   setCertNumber]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const reset = () => {
    setStep('upload')
    setPreview(null)
    setImage(null)
    setGradeCompany('')
    setGradeValue('')
    setCertNumber('')
    setError(null)
  }

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

  const handleScan = async () => {
    if (!image) return
    setStep('scanning')
    setError(null)
    try {
      const result = await recognizeSlabFromImage(image)
      setGradeCompany(result.gradeCompany)
      setGradeValue(result.gradeValue)
      setCertNumber(result.certNumber)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      setStep('upload')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('cards')
        .update({
          is_graded:       true,
          grading_company: gradeCompany || null,
          official_grade:  gradeValue   || null,
          cert_number:     certNumber   || null,
        })
        .eq('id', cardId)

      if (err) throw err

      toast({ title: 'Grade confirmed', description: `${gradeCompany} ${gradeValue}` })
      onConfirmed()
      onOpenChange(false)
      reset()
    } catch (err: any) {
      setError(err?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) reset()
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#14314F]">
            <Award className="w-4 h-4" />
            Confirm Grade
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}

        {/* Upload step */}
        {(step === 'upload' || step === 'scanning') && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-[#14314F] bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
            >
              <input {...getInputProps()} />
              {preview ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={preview} alt="Slab" className="max-h-40 object-contain rounded border" />
                  <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-8 h-8 text-gray-300" />
                  <p className="text-sm font-medium">Drop returned slab photo here</p>
                </div>
              )}
            </div>

            <Button
              onClick={handleScan}
              disabled={!image || step === 'scanning'}
              className="w-full bg-[#14314F] hover:bg-[#1a3d63] text-white"
            >
              {step === 'scanning' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning…
                </>
              ) : (
                'Scan Grade'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Or skip scanning and enter grade manually below
            </p>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep('confirm')}>
              Enter manually
            </Button>
          </div>
        )}

        {/* Confirm step */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {(gradeCompany || gradeValue) && (
              <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Grade detected — confirm or edit below
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Grading Company</Label>
                <Select value={gradeCompany} onValueChange={setGradeCompany}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADING_COMPANIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Grade</Label>
                <Input
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  placeholder="e.g. 9, 9.5, 10"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cert Number</Label>
                <Input
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="e.g. 12345678"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || (!gradeCompany && !gradeValue)}
                className="flex-1 bg-[#47682d] hover:bg-[#3a5525] text-white"
                size="sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Grade'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
