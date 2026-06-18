/**
 * Resize an image data URL to a max width while preserving aspect ratio.
 * Keeps Ximilar payloads manageable — high-res scanner TIFs can be 50MB+.
 */
export async function resizeDataUrl(
    dataUrl: string,
    maxWidth = 1200,
    quality = 0.88
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }