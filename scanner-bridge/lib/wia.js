import { execFileSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

function runPS(script) {
  const tmp = join(tmpdir(), `gr_ps_${Date.now()}.ps1`)
  writeFileSync(tmp, script, 'utf8')
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', tmp,
    ], { timeout: 30000, encoding: 'utf8' })
    return output.trim()
  } catch (err) {
    const msg = err.stderr?.trim() || err.stdout?.trim() || err.message
    throw new Error(`PowerShell error: ${msg}`)
  } finally {
    try { unlinkSync(tmp) } catch {}
  }
}

export function getWIAScanners() {
  if (process.platform !== 'win32') return []
  try {
    const output = runPS(`
$wia = New-Object -ComObject WIA.DeviceManager
$out = @()
for ($i = 1; $i -le $wia.DeviceInfos.Count; $i++) {
  $di = $wia.DeviceInfos.Item($i)
  if ($di.Type -eq 1) {
    $name = $di.Properties.Item("Name").Value
    $out += [PSCustomObject]@{
      id       = "wia:$($di.DeviceID)"
      name     = $name
      type     = "wia"
      deviceId = $di.DeviceID
    }
  }
}
if ($out.Count -eq 0) { Write-Output "[]" }
else { $out | ConvertTo-Json -Compress }
`)
    if (!output || output === 'null') return []
    const parsed = JSON.parse(output)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (err) {
    console.error('[WIA] getWIAScanners error:', err.message)
    return []
  }
}

export function scanWithWIA(deviceId, resolution = 300) {
  if (process.platform !== 'win32') throw new Error('WIA is Windows-only')

  // resolution is interpolated directly into a generated PowerShell script —
  // reject anything that isn't a plain integer to prevent script injection.
  const resolutionNum = Number(resolution)
  if (!Number.isInteger(resolutionNum) || resolutionNum < 75 || resolutionNum > 1200) {
    throw new Error('resolution must be an integer between 75 and 1200')
  }

  const outPath = join(tmpdir(), `gr_scan_${Date.now()}.jpg`)
  const psPath  = outPath.replace(/\\/g, '/')
  const safeId  = deviceId.replace(/['"]/g, '')

  console.log(`[WIA] Scanning to: ${outPath}`)

  runPS(`
$deviceId = "${safeId}"
$wia = New-Object -ComObject WIA.DeviceManager
$device = $null
$targetInfo = $null

for ($i = 1; $i -le $wia.DeviceInfos.Count; $i++) {
  $di = $wia.DeviceInfos.Item($i)
  if ($di.DeviceID -eq $deviceId) {
    $targetInfo = $di
    break
  }
}

if (-not $targetInfo) {
  throw "Scanner not found - try clicking Refresh in the app."
}

$maxRetries = 4
for ($retry = 0; $retry -lt $maxRetries; $retry++) {
  try {
    $device = $targetInfo.Connect()
    break
  } catch {
    if ($retry -eq $maxRetries - 1) {
      throw "Scanner is busy - close PaperStream Capture or any other scanning software and try again."
    }
    Write-Host "Scanner busy, retrying ($($retry + 1) of $maxRetries)..."
    Start-Sleep -Seconds 2
  }
}

$item = $device.Items.Item(1)
$item.Properties.Item("6147").Value = ${resolutionNum}
$item.Properties.Item("6148").Value = ${resolutionNum}
$item.Properties.Item("4103").Value = 4

$fmt = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"
$img = $item.Transfer($fmt)
$img.SaveFile("${psPath}")
Write-Output "saved"
`)

  const buf = readFileSync(outPath)
  try { unlinkSync(outPath) } catch {}
  console.log(`[WIA] Scan complete - ${buf.length} bytes`)
  return buf.toString('base64')
}