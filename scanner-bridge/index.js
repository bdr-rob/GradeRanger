import express from 'express'
import cors from 'cors'
import { Bonjour } from 'bonjour-service'
import { probeESCL, scanESCL } from './lib/escl.js'
import { getWIAScanners, scanWithWIA } from './lib/wia.js'

const app = express()
const PORT = 8765

// Only the Grade Ranger app may talk to this local bridge — without this,
// any website open in the user's browser could trigger scans/PowerShell.
const ALLOWED_ORIGINS = [
  'https://www.graderanger.com',
  'https://graderanger.com',
  'http://localhost:8080',
]

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error('Origin not allowed'))
  },
}))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, platform: process.platform })
)

// List all available scanners
app.get('/api/scanners', async (_req, res) => {
  const found = []

  // WIA (Windows USB/driver-based)
  try { found.push(...getWIAScanners()) } catch {}

  // eSCL via mDNS (_uscan._tcp)
  try { found.push(...await discoverMDNS(3000)) } catch {}

  res.json({ scanners: found })
})

// Manually probe a network scanner by IP
app.post('/api/scanners/probe', async (req, res) => {
  const { ip } = req.body ?? {}
  if (!ip) return res.status(400).json({ error: 'ip required' })
  const scanner = await probeESCL(ip)
  if (!scanner) return res.status(404).json({ error: `No eSCL scanner found at ${ip}` })
  res.json({ scanner })
})

const ALLOWED_COLOR_MODES = ['RGB24', 'Grayscale8', 'BlackAndWhite1']
const ALLOWED_SOURCES = ['Platen', 'Feeder']

// Trigger a scan — routes to eSCL or WIA based on scannerId prefix
app.post('/api/scan', async (req, res) => {
  const { scannerId, resolution = 300, colorMode = 'RGB24', source = 'Platen' } = req.body ?? {}
  if (!scannerId) return res.status(400).json({ error: 'scannerId required' })

  // These values get interpolated into an eSCL XML body and a generated
  // PowerShell script — reject anything that isn't an expected literal.
  const resolutionNum = Number(resolution)
  if (!Number.isInteger(resolutionNum) || resolutionNum < 75 || resolutionNum > 1200) {
    return res.status(400).json({ error: 'resolution must be an integer between 75 and 1200' })
  }
  if (!ALLOWED_COLOR_MODES.includes(colorMode)) {
    return res.status(400).json({ error: `colorMode must be one of: ${ALLOWED_COLOR_MODES.join(', ')}` })
  }
  if (!ALLOWED_SOURCES.includes(source)) {
    return res.status(400).json({ error: `source must be one of: ${ALLOWED_SOURCES.join(', ')}` })
  }

  try {
    let base64

    if (scannerId.startsWith('escl:')) {
      const ip = scannerId.slice(5)
      base64 = await scanESCL(ip, { resolution: resolutionNum, colorMode, source })
    } else if (scannerId.startsWith('wia:')) {
      const deviceId = scannerId.slice(4)
      base64 = scanWithWIA(deviceId, resolutionNum)
    } else {
      return res.status(400).json({ error: `Unknown scanner type in id: ${scannerId}` })
    }

    res.json({ ok: true, base64 })
  } catch (err) {
    console.error('[scan]', err.message)
    res.status(500).json({ error: err.message })
  }
})

function discoverMDNS(timeoutMs) {
  return new Promise(resolve => {
    const bonjour = new Bonjour()
    const found = []
    const browser = bonjour.find({ type: 'uscan' }, svc => {
      const ip = svc.addresses?.[0] ?? svc.host
      if (ip) found.push({ id: `escl:${ip}`, name: svc.name, type: 'escl', ip })
    })
    setTimeout(() => {
      browser.stop()
      bonjour.destroy()
      resolve(found)
    }, timeoutMs)
  })
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Grade Ranger Scanner Bridge → http://127.0.0.1:${PORT}`)
  console.log(`   Platform: ${process.platform}`)
})