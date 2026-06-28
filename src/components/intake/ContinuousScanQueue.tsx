import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { RecognizedCard, ScannedImage } from '@/lib/ximilar'
import { recognizeRawCardFromImage, getCardHedgeMarketPrice } from '@/lib/cardhedge'
import { submitCardForAnalysis } from '@/lib/api/aiAnalysis'
import { useLightbox } from '@/contexts/LightboxContext'
import { convertTifToJpeg, isTifFile } from '@/lib/tifConverter'
import { resizeDataUrl } from '@/lib/imageUtils'
import DynamsoftScannerPanel from './DynamsoftScannerPanel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Loader2, X, TrendingUp, Library, CheckSquare, Square,
  AlertCircle, CheckCircle2, Sparkles,
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ProcessState = 'idle' | 'identifying' | 'done' | 'error'

interface QueueItem {
  localId: string
  image: ScannedImage
  card: RecognizedCard | null
  processState: ProcessState
  error?: string
  // editable fields
  playerName: string
  cardName: string
  year: string
  setName: string
  cardNumber: string
  // actions
  addToCollection: boolean
  runMarketAnalysis: boolean
  // results
  marketValue: number | null
  marketLoading: boolean
  saved: boolean
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

async function fetchMarketValue(params: {
  cardHedgeId?: string | null
  player: string; year: string; cardName: string; setName: string
}): Promise<number | null> {
  const { marketValue } = await getCardHedgeMarketPrice({
    isGraded: false, // raw cards only in this scan queue
    ...(params.cardHedgeId
      ? { cardHedgeId: params.cardHedgeId }
      : { query: [params.year, params.player, params.cardName, params.setName].filter(Boolean).join(' ').trim() }),
  })
  return marketValue
}

// â”€â”€ Queue item card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QueueCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: QueueItem
  onUpdate: (id: string, patch: Partial<QueueItem>) => void
  onRemove: (id: string) => void
}) {
  const { open: openLightbox } = useLightbox()
  const identifying = item.processState === 'identifying'
  const hasError = item.processState === 'error'

  const cardImages = [
    { src: item.image.preview, alt: 'Front' },
    ...(item.image.backPreview ? [{ src: item.image.backPreview, alt: 'Back' }] : []),
  ]

  return (
    <div className={`border rounded-lg overflow-hidden bg-white ${item.saved ? 'opacity-60' : ''}`}>
      <div className="flex gap-3 p-3">
        {/* Thumbnail(s) */}
        <div className="shrink-0 flex gap-1">
          <img
            src={item.image.preview}
            alt="Front"
            className="w-14 aspect-[2/3] object-cover rounded cursor-pointer"
            onClick={() => openLightbox(cardImages, 0)}
          />
          {item.image.backPreview && (
            <img
              src={item.image.backPreview}
              alt="Back"
              className="w-14 aspect-[2/3] object-cover rounded opacity-70 cursor-pointer"
              onClick={() => openLightbox(cardImages, 1)}
            />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          {identifying && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Identifyingâ€¦
            </div>
          )}
          {hasError && (
            <div className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle className="w-3.5 h-3.5" />
              {item.error ?? 'Identification failed'}
            </div>
          )}
          {item.processState === 'done' && (
            <>
              {/* Editable card fields */}
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={item.playerName}
                  onChange={(e) => onUpdate(item.localId, { playerName: e.target.value })}
                  placeholder="Player / Character"
                  className="h-7 text-xs"
                  disabled={item.saved}
                />
                <Input
                  value={item.cardName}
                  onChange={(e) => onUpdate(item.localId, { cardName: e.target.value })}
                  placeholder="Card name"
                  className="h-7 text-xs"
                  disabled={item.saved}
                />
                <Input
                  value={item.setName}
                  onChange={(e) => onUpdate(item.localId, { setName: e.target.value })}
                  placeholder="Set name"
                  className="h-7 text-xs"
                  disabled={item.saved}
                />
                <div className="flex gap-1">
                  <Input
                    value={item.year}
                    onChange={(e) => onUpdate(item.localId, { year: e.target.value })}
                    placeholder="Year"
                    className="h-7 text-xs w-20 shrink-0"
                    disabled={item.saved}
                  />
                  <Input
                    value={item.cardNumber}
                    onChange={(e) => onUpdate(item.localId, { cardNumber: e.target.value })}
                    placeholder="#"
                    className="h-7 text-xs"
                    disabled={item.saved}
                  />
                </div>
              </div>

              {/* Market value */}
              {item.runMarketAnalysis && (
                <div className="flex items-center gap-1.5 text-xs">
                  {item.marketLoading ? (
                    <><Loader2 className="w-3 h-3 animate-spin text-gray-400" /><span className="text-gray-400">Fetching market valueâ€¦</span></>
                  ) : item.marketValue != null ? (
                    <><TrendingUp className="w-3 h-3 text-green-600" /><span className="font-semibold text-green-700">${item.marketValue.toFixed(2)} est. market</span></>
                  ) : (
                    <span className="text-gray-400">No market data found</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Remove */}
        {!item.saved && (
          <button onClick={() => onRemove(item.localId)} className="shrink-0 text-gray-300 hover:text-red-400 self-start">
            <X className="w-4 h-4" />
          </button>
        )}
        {item.saved && (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 self-start mt-0.5" />
        )}
      </div>

      {/* Action checkboxes */}
      {item.processState === 'done' && !item.saved && (
        <div className="border-t border-gray-50 px-3 py-2 flex gap-4 bg-gray-50">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <Checkbox
              checked={item.addToCollection}
              onCheckedChange={(v) => onUpdate(item.localId, { addToCollection: !!v })}
            />
            <Library className="w-3 h-3 text-gray-500" />
            Add to collection
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <Checkbox
              checked={item.runMarketAnalysis}
              onCheckedChange={(v) => {
                onUpdate(item.localId, { runMarketAnalysis: !!v })
              }}
            />
            <TrendingUp className="w-3 h-3 text-gray-500" />
            Market analysis
          </label>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MAX_PREVIEW = 10

interface Props {
  onDone: () => void
  singleMode?: boolean  // clears queue after each processed card
}

export default function ContinuousScanQueue({ onDone, singleMode = false }: Props) {
  const { user } = useAuth()
  const [previewQueue, setPreviewQueue] = useState<ScannedImage[]>([]) // staged before identification
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [lastSaved, setLastSaved] = useState<QueueItem | null>(null) // single mode: show last result

  function patch(id: string, updates: Partial<QueueItem>) {
    setQueue((prev) => prev.map((item) => item.localId === id ? { ...item, ...updates } : item))
  }

  function remove(id: string) {
    setQueue((prev) => prev.filter((item) => item.localId !== id))
  }

  function removePreview(id: string) {
    setPreviewQueue((prev) => prev.filter((img) => img.id !== id))
  }

  // Identify a single ScannedImage and add it to the processing queue
  const identifyImage = useCallback(async (image: ScannedImage) => {
    const localId = image.id
    const newItem: QueueItem = {
      localId,
      image,
      card: null,
      processState: 'identifying',
      playerName: '',
      cardName: '',
      year: '',
      setName: '',
      cardNumber: '',
      addToCollection: true,
      runMarketAnalysis: true,
      marketValue: null,
      marketLoading: false,
      saved: false,
    }
    setQueue((prev) => singleMode ? [newItem] : [newItem, ...prev])

    try {
      const recognized = await recognizeRawCardFromImage(image)
      const m = recognized.bestMatch
      const updated: Partial<QueueItem> = {
        card: recognized,
        processState: 'done',
        playerName: m?.player ?? '',
        cardName: m?.name ?? '',
        year: m?.year ?? '',
        setName: m?.set_name ?? '',
        cardNumber: m?.card_number ?? '',
        marketValue: recognized.marketValue,
      }
      setQueue((prev) => prev.map((item) => item.localId === localId ? { ...item, ...updated } : item))

      const hasCardInfo = m?.player || m?.name || m?.set_name
      if (hasCardInfo) {
        setQueue((prev) => prev.map((item) => item.localId === localId ? { ...item, marketLoading: true } : item))
        const value = await fetchMarketValue({
          cardHedgeId: recognized.cardHedgeId,
          player:      m?.player   ?? '',
          year:        m?.year     ?? '',
          cardName:    m?.name     ?? '',
          setName:     m?.set_name ?? '',
        })
        setQueue((prev) => prev.map((item) => item.localId === localId ? { ...item, marketValue: value, marketLoading: false } : item))
      }
    } catch (err: any) {
      setQueue((prev) => prev.map((item) =>
        item.localId === localId ? { ...item, processState: 'error', error: err.message } : item
      ))
    }
  }, [singleMode])

  // In single mode: identify immediately. In continuous mode: stage in preview first.
  const handleImage = useCallback(async (
    base64: string,
    preview: string,
    back?: { base64: string; preview: string }
  ) => {
    const localId = uuidv4()
    const image: ScannedImage = {
      id: localId, base64, preview,
      backBase64:   back?.base64,
      backPreview:  back?.preview,
    }

    if (singleMode) {
      identifyImage(image)
    } else {
      setPreviewQueue((prev) => {
        if (prev.length >= MAX_PREVIEW) return prev
        return [...prev, image]
      })
    }
  }, [singleMode, identifyImage])

  // Identify all staged preview cards at once
  const identifyAll = useCallback(() => {
    const toIdentify = [...previewQueue]
    setPreviewQueue([])
    toIdentify.forEach((img) => identifyImage(img))
  }, [previewQueue, identifyImage])

  const handleScannerScan = useCallback((result: { front: { base64: string; preview: string }; back?: { base64: string; preview: string } }) => {
    handleImage(result.front.base64, result.front.preview, result.back)
  }, [handleImage])

  const onDrop = useCallback(async (accepted: File[]) => {
    for (const file of accepted) {
      const { base64, preview } = await processFile(file)
      handleImage(base64, preview)
    }
  }, [handleImage])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'image/tiff': ['.tif', '.tiff'] },
    multiple: true,
    noClick: false,
  })

  // â”€â”€ Bulk selection helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const readyItems = queue.filter((i) => i.processState === 'done' && !i.saved)
  const allCollection = readyItems.every((i) => i.addToCollection)
  const allMarket = readyItems.every((i) => i.runMarketAnalysis)

  function toggleAllCollection() {
    const next = !allCollection
    setQueue((prev) => prev.map((i) =>
      i.processState === 'done' && !i.saved ? { ...i, addToCollection: next } : i
    ))
  }

  function toggleAllMarket() {
    const next = !allMarket
    setQueue((prev) => prev.map((i) =>
      i.processState === 'done' && !i.saved ? { ...i, runMarketAnalysis: next } : i
    ))
  }

  // â”€â”€ Process selected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function processSelected() {
    if (!user) return
    setProcessing(true)

    const toProcess = queue.filter(
      (i) => i.processState === 'done' && !i.saved && (i.addToCollection || i.runMarketAnalysis)
    )

    for (const item of toProcess) {
      // Upload images
      let frontUrl: string | null = null
      let backUrl: string | null = null

      if (item.image.base64) {
        const bytes = Uint8Array.from(atob(item.image.base64), (c) => c.charCodeAt(0))
        const path = `${user.id}/${item.localId}_front.jpg`
        const { error: upErr } = await supabase.storage
          .from('card-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          frontUrl = supabase.storage.from('card-images').getPublicUrl(path).data.publicUrl
        }
      }

      if (item.image.backBase64) {
        const bytes = Uint8Array.from(atob(item.image.backBase64), (c) => c.charCodeAt(0))
        const path = `${user.id}/${item.localId}_back.jpg`
        const { error: upErr } = await supabase.storage
          .from('card-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          backUrl = supabase.storage.from('card-images').getPublicUrl(path).data.publicUrl
        }
      }

      if (item.addToCollection) {
        const { data: inserted, error: insertErr } = await supabase.from('cards').insert({
          user_id:           user.id,
          card_name:         item.playerName || item.cardName || 'Unknown Card',
          player_name:       item.playerName,
          year:              item.year,
          set_name:          item.setName,
          card_number:       item.cardNumber,
          cardsight_card_id: item.card?.cardsightCardId ?? null,
          market_value:      item.marketValue ?? null,
          front_image_url:   frontUrl,
          back_image_url:    backUrl,
          status:            'intake',
        }).select().single()

        if (!insertErr && inserted && frontUrl) {
          submitCardForAnalysis(inserted.id, frontUrl, backUrl || frontUrl).catch(() => {})
        }
      }

      patch(item.localId, { saved: true })
    }

    setProcessing(false)

    if (singleMode && toProcess.length > 0) {
      // Show last result briefly then reset for next scan
      setLastSaved(toProcess[toProcess.length - 1])
      setTimeout(() => {
        setQueue([])
        setLastSaved(null)
      }, 2000)
    }
  }

  const toProcessCount = queue.filter(
    (i) => i.processState === 'done' && !i.saved && (i.addToCollection || i.runMarketAnalysis)
  ).length

  return (
    <div className="space-y-4">
      {/* Scanner + drop zone */}
      <DynamsoftScannerPanel onScan={handleScannerScan} />

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-[#47682d] bg-green-50' : 'border-gray-200 hover:border-[#14314F] hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-500">
          {isDragActive
            ? 'Drop image hereâ€¦'
            : singleMode
            ? 'Or drop a card image to identify it'
            : 'Or drag & drop card images â€” each is identified immediately'}
        </p>
      </div>

      {/* â”€â”€ Scan preview queue (continuous mode) â”€â”€ */}
      {!singleMode && previewQueue.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
            <span className="text-sm font-medium text-gray-700">
              {previewQueue.length} / {MAX_PREVIEW} cards staged
            </span>
            <div className="flex items-center gap-2">
              {previewQueue.length < MAX_PREVIEW && (
                <span className="text-xs text-gray-400">Scan more or identify now</span>
              )}
              <Button
                size="sm"
                onClick={identifyAll}
                className="bg-[#14314F] hover:bg-[#0f2438] text-white h-7 text-xs px-3"
              >
                <Sparkles className="w-3 h-3 mr-1.5" />
                Identify {previewQueue.length} card{previewQueue.length !== 1 ? 's' : ''} â†’
              </Button>
            </div>
          </div>

          <div className="p-3 grid grid-cols-5 gap-2">
            {previewQueue.map((img, idx) => {
              const imgs = [{ src: img.preview, alt: 'Front' }, ...(img.backPreview ? [{ src: img.backPreview, alt: 'Back' }] : [])]
              return (
              <div key={img.id} className="relative group">
                <p className="text-xs text-center text-gray-400 mb-1">#{idx + 1}</p>
                <div className="flex gap-0.5">
                  <img
                    src={img.preview}
                    alt="Front"
                    className="flex-1 aspect-[2/3] object-cover rounded border border-gray-200 cursor-pointer"
                    onClick={() => openLightbox(imgs, 0)}
                  />
                  {img.backPreview && (
                    <img
                      src={img.backPreview}
                      alt="Back"
                      className="flex-1 aspect-[2/3] object-cover rounded border border-gray-200 opacity-70 cursor-pointer"
                      onClick={() => openLightbox(imgs, 1)}
                    />
                  )}
                </div>
                <button
                  onClick={() => removePreview(img.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )})}


            {/* Empty slots up to MAX_PREVIEW */}
            {Array.from({ length: MAX_PREVIEW - previewQueue.length }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-[2/3] rounded border-2 border-dashed border-gray-100" />
            ))}
          </div>
        </div>
      )}

      {/* Single mode: success flash */}
      {singleMode && lastSaved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            <strong>{lastSaved.playerName || lastSaved.cardName || 'Card'}</strong> saved â€” ready for next scan
          </span>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-3">
          {/* Bulk toggles */}
          {readyItems.length > 1 && (
            <div className="flex items-center gap-4 px-1 text-xs text-gray-500">
              <span className="font-medium">Select all:</span>
              <button
                onClick={toggleAllCollection}
                className="flex items-center gap-1 hover:text-gray-800"
              >
                {allCollection ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                Collection
              </button>
              <button
                onClick={toggleAllMarket}
                className="flex items-center gap-1 hover:text-gray-800"
              >
                {allMarket ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                Market analysis
              </button>
              <Badge variant="secondary" className="ml-auto">{queue.length} scanned</Badge>
            </div>
          )}

          <div className="space-y-2">
            {queue.map((item) => (
              <QueueCard
                key={item.localId}
                item={item}
                onUpdate={patch}
                onRemove={remove}
              />
            ))}
          </div>

          {/* Action bar */}
          {toProcessCount > 0 && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={processSelected}
                disabled={processing}
                className="flex-1 bg-[#14314F] hover:bg-[#0f2438] text-white"
              >
                {processing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processingâ€¦</>
                  : `Process ${toProcessCount} card${toProcessCount !== 1 ? 's' : ''}`
                }
              </Button>
              {queue.some((i) => i.saved) && (
                <Button variant="outline" onClick={onDone}>Done</Button>
              )}
            </div>
          )}
          {toProcessCount === 0 && queue.some((i) => i.saved) && (
            <Button variant="outline" onClick={onDone} className="w-full">Done â€” go to collection</Button>
          )}
        </div>
      )}
    </div>
  )
}

