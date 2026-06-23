import fetch from 'node-fetch'
import { parseStringPromise } from 'xml2js'

const ALLOWED_COLOR_MODES = ['RGB24', 'Grayscale8', 'BlackAndWhite1']
const ALLOWED_SOURCES = ['Platen', 'Feeder']

function buildScanXML({ resolution = 300, colorMode = 'RGB24', source = 'Platen' } = {}) {
  // These values are interpolated directly into the request XML body —
  // reject anything outside the expected literals to prevent XML injection.
  const resolutionNum = Number(resolution)
  if (!Number.isInteger(resolutionNum) || resolutionNum < 75 || resolutionNum > 1200) {
    throw new Error('resolution must be an integer between 75 and 1200')
  }
  if (!ALLOWED_COLOR_MODES.includes(colorMode)) {
    throw new Error(`colorMode must be one of: ${ALLOWED_COLOR_MODES.join(', ')}`)
  }
  if (!ALLOWED_SOURCES.includes(source)) {
    throw new Error(`source must be one of: ${ALLOWED_SOURCES.join(', ')}`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings
  xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03"
  xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.6</pwg:Version>
  <scan:Intent>Photo</scan:Intent>
  <scan:ColorMode>${colorMode}</scan:ColorMode>
  <scan:XResolution>${resolutionNum}</scan:XResolution>
  <scan:YResolution>${resolutionNum}</scan:YResolution>
  <pwg:InputSource>${source}</pwg:InputSource>
</scan:ScanSettings>`
}

export async function probeESCL(ip) {
  try {
    const res = await fetch(`http://${ip}/eSCL/ScannerCapabilities`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const xml = await res.text()
    const parsed = await parseStringPromise(xml)
    const caps = parsed?.['scan:ScannerCapabilities'] ?? {}
    const name =
      caps?.['pwg:MakeAndModel']?.[0] ??
      caps?.['scan:MakeAndModel']?.[0] ??
      `Scanner @ ${ip}`
    return { id: `escl:${ip}`, name, type: 'escl', ip }
  } catch {
    return null
  }
}

export async function scanESCL(ip, options = {}) {
  const xml = buildScanXML(options)

  // 1. Create scan job
  const createRes = await fetch(`http://${ip}/eSCL/ScanJobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xml,
    signal: AbortSignal.timeout(10000),
  })
  if (!createRes.ok) {
    throw new Error(`eSCL job creation failed: HTTP ${createRes.status}`)
  }

  const location = createRes.headers.get('Location')
  if (!location) throw new Error('eSCL: no Location header returned')

  const jobUrl = location.startsWith('http') ? location : `http://${ip}${location}`

  // 2. Poll for the scanned document (scanner takes a few seconds)
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 1000))
    const docRes = await fetch(`${jobUrl}/NextDocument`, {
      signal: AbortSignal.timeout(10000),
    })
    if (docRes.status === 200) {
      const buffer = await docRes.arrayBuffer()
      return Buffer.from(buffer).toString('base64')
    }
    if (docRes.status === 404) throw new Error('eSCL: job not found — did the scanner time out?')
    // 503 = not ready yet, keep polling
  }

  throw new Error('eSCL: timed out waiting for scan to complete')
}