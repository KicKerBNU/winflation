// One-off logo replacement.
//
// Writes the logo file to public/logos/<TICKER>.<ext>. After running, commit
// the new file and push — Netlify will rebuild and serve the logo at
// winflation.eu/logos/<TICKER>.<ext>. The daily AI recommendations cron
// auto-populates `logoUrl` on each pick from public/logos/, so no Firestore
// step is needed.
//
// Usage (from project root):
//   node scripts/update-logo.mjs <TICKER> <URL>
//
// Example:
//   node scripts/update-logo.mjs ISP.MI \
//     'https://companieslogo.com/img/orig/ISP.MI-e8dc3cc4.png?t=1746543241'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [, , tickerArg, urlArg] = process.argv
if (!tickerArg || !urlArg) {
  console.error('Usage: node scripts/update-logo.mjs <TICKER> <URL>')
  process.exit(1)
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logosDir = resolve(projectRoot, 'public', 'logos')

function safeTicker(t) {
  return String(t).replace(/[^A-Za-z0-9._-]/g, '_').toUpperCase()
}

function extFromContentType(ct) {
  if (!ct) return 'png'
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'png'
}

const ticker = tickerArg.trim()
const sourceUrl = urlArg.trim()
const safe = safeTicker(ticker)

console.log(`[update-logo] ${ticker} → ${sourceUrl}`)

const res = await fetch(sourceUrl, {
  redirect: 'follow',
  headers: {
    'user-agent': 'Mozilla/5.0 (compatible; winflation-logo-bot/1.0)',
    accept: 'image/*,*/*;q=0.8',
  },
})
if (!res.ok) {
  console.error(`fetch failed: HTTP ${res.status}`)
  process.exit(1)
}
const ct = (res.headers.get('content-type') || 'image/png').split(';')[0].trim()
if (!ct.startsWith('image/')) {
  console.error(`non-image content-type: ${ct}`)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
  console.error(`invalid image size: ${buf.length} bytes`)
  process.exit(1)
}

const ext = extFromContentType(ct)
const fileName = `${safe}.${ext}`
const filePath = resolve(logosDir, fileName)
mkdirSync(logosDir, { recursive: true })
writeFileSync(filePath, buf)
console.log(`[update-logo] wrote ${buf.length}B → ${filePath}`)

spawnSync('node', [resolve(projectRoot, 'scripts', 'regenerate-logo-manifest.mjs')], { stdio: 'inherit' })

console.log('')
console.log('[update-logo] done.')
console.log(`[update-logo] next steps:  git add public/logos/${fileName} && git commit -m "logo: ${ticker}" && git push`)
console.log('[update-logo] Netlify will rebuild and serve the new logo at /logos/' + fileName)
