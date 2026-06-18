// Converts a TIF/TIFF file to a JPEG data URL using canvas
export async function convertTifToJpeg(
    file: File
  ): Promise<{ base64: string; preview: string }> {
    // Dynamically import to keep bundle light
    const UTIF = (await import('utif2')).default
  
    const buffer = await file.arrayBuffer()
    const ifds = UTIF.decode(buffer)
  
    if (!ifds.length) throw new Error('Could not decode TIFF file')
  
    UTIF.decodeImage(buffer, ifds[0])
    const rgba = UTIF.toRGBA8(ifds[0])
  
    const canvas = document.createElement('canvas')
    canvas.width = ifds[0].width
    canvas.height = ifds[0].height
  
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
  
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)
  
    // Convert to JPEG at 92% quality (good balance for card scans)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    return {
      preview: dataUrl,
      base64: dataUrl.split(',')[1],
    }
  }
  
  export function isTifFile(file: File): boolean {
    return (
      file.type === 'image/tiff' ||
      file.name.toLowerCase().endsWith('.tif') ||
      file.name.toLowerCase().endsWith('.tiff')
    )
  }