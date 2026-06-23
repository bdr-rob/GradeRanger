import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Loader2, Scan, ScanLine, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { resizeDataUrl } from '@/lib/imageUtils'

declare const Dynamsoft: any

interface Props {
  onImage: (id: string, base64: string, preview: string) => void
}

export default function DynamsoftScannerPanel({ onImage }: Props) {
  const [dwtReady, setDwtReady]       = useState(false)
  const [dwtLoading, setDwtLoading]   = useState(true)
  const [sources, setSources]         = useState<string[]>([])
  const [selectedSource, setSelected] = useState(0)
  const [scanStatus, setScanStatus]   = useState('')
  const [scanning, setScanning]       = useState(false)
  const [duplex, setDuplex]           = useState(true)
  const dwtRef = useRef<any>(null)

  useEffect(() => {
    setScanStatus('Connecting to scanner service…')
    Dynamsoft.DWT.CreateDWTObjectEx(
      { WebTwainId: 'GradeRangerBatchDWT' },
      (obj: any) => {
        dwtRef.current = obj
        const list: string[] = obj.GetSourceNames() ?? []
        setSources(list)
        setDwtReady(true)
        setDwtLoading(false)
        setScanStatus(list.length > 0
          ? `${list.length} scanner(s) found`
          : 'No scanners found - check connection')
      },
      (_code: number, _msg: string) => {
        setDwtLoading(false)
        setScanStatus('Dynamsoft Service not running - start it to enable scanning')
      }
    )
    return () => {
      if (dwtRef.current) {
        try { Dynamsoft.DWT.DeleteDWTObject('GradeRangerBatchDWT') } catch {}
        dwtRef.current = null
      }
    }
  }, [])

  const getBase64 = (dwt: any, index: number): Promise<string> =>
    new Promise((resolve, reject) => {
      dwt.ConvertToBase64(
        [index],
        1, // JPEG
        (result: any) => resolve(result.getData(0, result.getLength())),
        (_code: number, msg: string) => reject(new Error(msg || 'Conversion failed'))
      )
    })

  const triggerScan = useCallback(async () => {
    if (!dwtRef.current || scanning) return
    const dwt = dwtRef.current
    setScanning(true)
    setScanStatus(duplex ? 'Scanning front and back…' : 'Scanning…')

    try {
      if (!dwt.SelectSourceByIndex(selectedSource)) {
        throw new Error('Could not select scanner')
      }

      await new Promise<void>((resolve, reject) => {
        dwt.OpenSource()
        dwt.AcquireImage(
          {
            PixelType: 2,
            Resolution: 600,
            IfDisableSourceAfterAcquire: true,
            IfDuplexEnabled: duplex,
          },
          () => resolve(),
          (_code: number, msg: string) => reject(new Error(msg || 'Scan failed'))
        )
      })

      const imageCount: number = dwt.HowManyImagesInBuffer

      if (duplex && imageCount >= 2) {
        // Both sides scanned — add front then back so pair mode picks them up
        const frontB64 = await getBase64(dwt, 0)
        const backB64  = await getBase64(dwt, 1)

        const frontResized = await resizeDataUrl(`data:image/jpeg;base64,${frontB64}`, 1200)
        const backResized  = await resizeDataUrl(`data:image/jpeg;base64,${backB64}`, 1200)

        onImage(uuidv4(), frontResized.split(',')[1], frontResized)
        onImage(uuidv4(), backResized.split(',')[1], backResized)

        setScanStatus('Both sides scanned - ready for next card')
      } else {
        // Single side only
        const b64     = await getBase64(dwt, 0)
        const resized = await resizeDataUrl(`data:image/jpeg;base64,${b64}`, 1200)
        onImage(uuidv4(), resized.split(',')[1], resized)
        setScanStatus('Scan complete - ready for next')
      }

      dwt.RemoveAllImages()
    } catch (err) {
      setScanStatus(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [selectedSource, scanning, duplex, onImage])

  if (dwtLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> {scanStatus}
        </p>
      </div>
    )
  }

  if (!dwtReady) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
        <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Scanner unavailable
        </p>
        <p className="text-xs text-amber-700">{scanStatus}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#14314F]/20 bg-[#14314F]/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[#14314F]">
        <ScanLine className="w-4 h-4" /> Scanner
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
      </div>

      {/* Scanner selector + scan button */}
      <div className="flex gap-2">
        <Select value={String(selectedSource)} onValueChange={(v) => setSelected(Number(v))}>
          <SelectTrigger className="flex-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sources.map((src, i) => (
              <SelectItem key={i} value={String(i)}>{src}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={triggerScan}
          disabled={scanning}
          size="sm"
          className="bg-[#14314F] hover:bg-[#0f2438] text-white shrink-0"
        >
          {scanning
            ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
            : <Scan className="w-3 h-3 mr-1" />}
          {scanning ? 'Scanning...' : 'Scan'}
        </Button>
      </div>

      {/* Duplex toggle */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setDuplex(v => !v)}
      >
        <div>
          <p className="text-xs font-medium text-gray-700">Scan both sides</p>
          <p className="text-xs text-gray-400">
            {duplex
              ? 'Front + back scanned in one pass, auto-paired'
              : 'Front only — toggle on for two-sided cards'}
          </p>
        </div>
        {duplex
          ? <ToggleRight className="w-6 h-6 text-[#47682d]" />
          : <ToggleLeft  className="w-6 h-6 text-gray-400" />}
      </div>

      {scanStatus && <p className="text-xs text-gray-500">{scanStatus}</p>}
    </div>
  )
}