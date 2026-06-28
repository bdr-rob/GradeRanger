import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

interface LightboxImage {
  src: string
  alt?: string
}

interface LightboxContextValue {
  open: (images: LightboxImage | LightboxImage[], startIndex?: number) => void
}

const LightboxContext = createContext<LightboxContextValue>({ open: () => {} })

export function useLightbox() {
  return useContext(LightboxContext)
}

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [images,   setImages]   = useState<LightboxImage[]>([])
  const [index,    setIndex]    = useState(0)
  const [flipped,  setFlipped]  = useState(false)
  const [flipping, setFlipping] = useState(false)

  const open = useCallback((img: LightboxImage | LightboxImage[], startIndex = 0) => {
    setImages(Array.isArray(img) ? img : [img])
    setIndex(startIndex)
    setFlipped(false)
    setFlipping(false)
  }, [])

  const close = useCallback(() => { setImages([]); setFlipped(false) }, [])

  const prev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length])

  // 2-image sets get the flip treatment; more get left/right arrows
  const isFlipper = images.length === 2

  const flip = useCallback(() => {
    if (flipping) return
    setFlipping(true)
    // At mid-point of animation, swap the visible image
    setTimeout(() => {
      setFlipped((f) => !f)
      setIndex((i) => (i === 0 ? 1 : 0))
    }, 180)
    setTimeout(() => setFlipping(false), 360)
  }, [flipping])

  useEffect(() => {
    if (images.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (!isFlipper) {
        if (e.key === 'ArrowLeft')  prev()
        if (e.key === 'ArrowRight') next()
      } else {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') flip()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [images.length, close, prev, next, flip, isFlipper])

  const current = images[index]

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}

      {current && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="relative flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left arrow (multi-image non-flip mode) */}
            {!isFlipper && images.length > 1 && (
              <button
                onClick={prev}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="flex flex-col items-center gap-3">
              {/* Card with 3D flip */}
              <div
                style={{ perspective: '900px' }}
                className={isFlipper ? 'cursor-pointer' : ''}
                onClick={isFlipper ? flip : undefined}
                title={isFlipper ? 'Click to flip' : undefined}
              >
                <div
                  style={{
                    transition: flipping ? 'transform 0.36s ease' : 'none',
                    transform: flipping
                      ? (flipped ? 'rotateY(0deg)' : 'rotateY(180deg)')
                      : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <img
                    src={current.src}
                    alt={current.alt ?? 'Card image'}
                    className="max-h-[80vh] max-w-sm w-auto rounded-lg shadow-2xl object-contain"
                    style={{ minWidth: '200px', display: 'block' }}
                    draggable={false}
                  />
                </div>
              </div>

              {/* Label */}
              {current.alt && (
                <p className="text-white/70 text-sm text-center max-w-xs truncate">{current.alt}</p>
              )}

              {/* Flip hint / page indicator */}
              {isFlipper ? (
                <button
                  onClick={flip}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  {index === 0 ? 'Click to see back' : 'Click to see front'}
                </button>
              ) : images.length > 1 ? (
                <p className="text-white/50 text-xs">{index + 1} / {images.length}</p>
              ) : null}
            </div>

            {/* Right arrow (multi-image non-flip mode) */}
            {!isFlipper && images.length > 1 && (
              <button
                onClick={next}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Close */}
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </LightboxContext.Provider>
  )
}
