/**
 * Run once: node autostart.js
 * Adds the scanner bridge to Windows startup so it launches automatically
 * when the PC boots — no terminal needed.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { homedir, platform } from 'os'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bridgePath = resolve(__dirname, 'index.js')

if (platform() !== 'win32') {
  console.log('This script is for Windows. For Mac/Linux, use pm2:')
  console.log('  npm install -g pm2')
  console.log(`  pm2 start "${bridgePath}" --name grade-ranger-scanner`)
  console.log('  pm2 startup && pm2 save')
  process.exit(0)
}

// Find node.exe path
const nodePath = process.execPath

// Windows Startup folder
const startupFolder = join(
  homedir(),
  'AppData', 'Roaming', 'Microsoft', 'Windows',
  'Start Menu', 'Programs', 'Startup'
)

// VBScript runs node hidden (no terminal window)
const vbsPath = join(startupFolder, 'GradeRangerScanner.vbs')
const vbsContent = `' Grade Ranger Scanner Bridge — auto-start
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${nodePath}"" ""${bridgePath}""", 0, False
`

try {
  writeFileSync(vbsPath, vbsContent, 'utf8')
  console.log('✅ Auto-start installed successfully!')
  console.log(`   Startup entry: ${vbsPath}`)
  console.log('')
  console.log('The scanner bridge will now start automatically when Windows boots.')
  console.log('To start it right now without rebooting, run: npm start')
  console.log('')
  console.log('To remove auto-start, delete this file:')
  console.log(`   ${vbsPath}`)
} catch (err) {
  console.error('❌ Failed to install auto-start:', err.message)
  console.error('Try running as Administrator.')
}