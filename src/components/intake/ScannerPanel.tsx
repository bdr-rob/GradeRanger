import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  Loader2, RefreshCw, Scan, Wifi, Usb,
  Plus, CheckCircle2, AlertTriangle, ScanLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { resizeDataUrl } from '@/lib/imageUtils'

const BRIDGE = 'http://127.0.0.1:8765'
const RETRY_INTERVAL_MS = 5000

interface Scanner {
  id: string
  name: string
  type: 'escl' | 'wia'
  ip?: string
}

interface Props {
  onImage: (id: string, base64: string, preview: string) => void
}

export default function ScannerPanel({ onImage }: Props) {
  const [ready, setReady] = useState<boolean | null>(null)
  const [scanners, setScanners] = useState<Scanner[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState('')
  const [manualIp, setManualIp] = useState('')
  const [probing, setProbing] = useState(false)
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopRetry = () => {
    if (retryRef.current) {
      clearInterval(retryRef.current)
      retryRef.current = null
    }
  }

  const loadScanners = useCallback(async () => {
    setStatus('Searching for scanners…')
    try {
      const res = await fetch(`${BRIDGE}/api/scanners`)
      const { scanners: list } = await res.json()
      setScanners(list ?? [])
      if (list?.length) {
        setSelectedId(list[0].id)
        setStatus(`${list.length} scanner(s) found`)
      } else {
        setStatus('No scanners found — enter your scanner IP below')
      }
    } catch {
      setStatus('Could not load scanners')
    }
  }, [])

  const checkBridge = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE}/api/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) {
        setReady(true)
        stopRetry()
        loadScanners()
      } else {
        setReady(false)
      }
    } catch {
      setReady(false)
    }
  }, [loadScanners])

  // On mount: check immediately, then retry every 5s until connected
  useEffect(() => {
    checkBridge()
    retryRef.current = setInterval(checkBridge, RETRY_INTERVAL_MS)
    return () => stopRetry()
  }, [checkBridge])

  async function probeManualIp() {
    if (!manualIp) return
    setProbing(true)
    setStatus(`Probing ${manualIp}…`)
    try {
      const res = await fetch(`${BRIDGE}/api/scanners/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: manualIp }),
      })
      const data = await res.json()
      if (data.scanner) {
        setScanners(prev =>
          prev.find(s => s.id === data.scanner.id) ? prev : [...prev, data.scanner]
        )
        setSelectedId(data.scanner.id)
        setStatus(`Found: ${data.scanner.name}`)
        setManualIp('')
      } else {
        setStatus(`No eSCL scanner at ${manualIp}`)
      }
    } catch {
      setStatus('Probe failed')
    } finally {
      setProbing(false)
    }
  }

  async function triggerScan() {
    if (!selectedId) return
    setScanning(true)
    setStatus('Scanning…')
    try {
      const res = await fetch(`${BRIDGE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannerId: selectedId, resolution: 300 }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Scan failed')

      const dataUrl = `data:image/jpeg;base64,${data.base64}`
      const resized  = await resizeDataUrl(dataUrl, 1200)
      const rawB64   = resized.split(',')[1]
      onImage(uuidv4(), rawB64, resized)
      setStatus('Scan complete ✓')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  // ── Bridge not yet found — show connecting state with auto-retry ────────────
  if (!ready) {
    return (
      <div className={`rounded-lg border p-4 space-y-3 ${
        ready === null
          ? 'border-gray-200 bg-gray-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <p className={`text-sm font-medium flex items-center gap-2 ${
          ready === null ? 'text-gray-600' : 'text-amber-800'
        }`}>
          {ready === null
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting to scanner service…</>
            : <><AlertTriangle className="w-4 h-4" /> Scanner service not running</>
          }
        </p>

        {ready === false && (
          <>
            <p className="text-xs text-amber-700">
              To enable scanning, run this once in a terminal — or set it up to
              start automatically (see <code>scanner-bridge/README.md</code>):
            </p>
            <pre className="text-xs bg-white border border-amber-200 rounded p-2 select-all text-amber-900">
              cd scanner-bridge && npm start
            </pre>
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking again automatically every 5 seconds…
            </p>
          </>
        )}
      </div>
    )
  }

  // ── Bridge connected ────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-[#14314F]/20 bg-[#14314F]/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#14314F] flex items-center gap-2">
          <ScanLine className="w-4 h-4" />
          Scanner
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Connected" />
        </span>
        <button
          onClick={loadScanners}
          className="text-xs text-gray-400 hover:text-[#14314F] flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Scanner selector + scan button */}
      {scanners.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1 h-8 text-sm">
              <SelectValue placeholder="Select scanner" />
            </SelectTrigger>
            <SelectContent>
              {scanners.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    {s.type === 'escl'
                      ? <Wifi className="w-3 h-3 text-blue-500" />
                      : <Usb  className="w-3 h-3 text-gray-500" />}
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={triggerScan}
            disabled={scanning || !selectedId}
            size="sm"
            className="bg-[#14314F] hover:bg-[#0f2438] text-white shrink-0"
          >
            {scanning
              ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
              : <Scan className="w-3 h-3 mr-1" />}
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
        </div>
      )}

      {/* Manual IP entry */}
      <div className="flex gap-2">
        <Input
          value={manualIp}
          onChange={e => setManualIp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && probeManualIp()}
          placeholder="Network scanner IP (e.g. 192.168.1.50)"
          className="h-8 text-sm"
        />
        <Button
          onClick={probeManualIp}
          disabled={probing || !manualIp}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          {probing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>

      {/* Status */}
      {status && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          {status.includes('✓') && <CheckCircle2 className="w-3 h-3 text-green-500" />}
          {status}
        </p>
      )}
    </div>
  )
}