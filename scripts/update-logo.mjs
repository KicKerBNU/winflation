// One-off logo replacement.
//
// Writes the logo file to public/logos/<TICKER>.<ext> and points Firestore at
// the same-origin path /logos/<TICKER>.<ext>. After running, commit the new
// file and push — Netlify will rebuild and serve the logo at winflation.eu.
//
// Usage (from project root, picks up .env.local):
//   node --env-file=.env.local scripts/update-logo.mjs <TICKER> <URL>
//
// Example:
//   node --env-file=.env.local scripts/update-logo.mjs ISP.MI \
//     'https://companieslogo.com/img/orig/ISP.MI-e8dc3cc4.png?t=1746543241'
//
// Requires Node 20.6+ for --env-file. If you don't keep the service account
// in .env.local, you can also pass it inline:
//   FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" node scripts/update-logo.mjs <TICKER> <URL>
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , tickerArg, urlArg] = process.argv
if (!tickerArg || !urlArg) {
  console.error('Usage: node scripts/update-logo.mjs <TICKER> <URL>')
  process.exit(1)
}

const firebaseJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!firebaseJsonRaw?.trim()) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT env var (paste the service-account JSON).')
  process.exit(1)
}

let serviceAccount
try {
  serviceAccount = JSON.parse(firebaseJsonRaw)
} catch (err) {
  console.error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`)
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

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
const logoUrl = `/logos/${fileName}`
console.log(`[update-logo] wrote ${buf.length}B → ${filePath}`)

await db.collection('logos').doc(safe).set({
  ticker,
  logoUrl,
  sourceUrl,
  contentType: ct,
  sizeBytes: buf.length,
  storedInStorage: false,
  storedInRepo: true,
  updatedAt: new Date().toISOString(),
})
console.log(`[update-logo] firestore logos/${safe} updated → ${logoUrl}`)

const latestRef = db.collection('ai-recommendations').doc('latest')
const latestSnap = await latestRef.get()
if (latestSnap.exists) {
  const data = latestSnap.data() ?? {}
  const companies = Array.isArray(data.companies) ? data.companies : []
  let patched = 0
  const next = companies.map((c) => {
    if (safeTicker(c.ticker) === safe) {
      patched++
      return { ...c, logoUrl }
    }
    return c
  })
  if (patched > 0) {
    await latestRef.set({ ...data, companies: next, logosUpdatedAt: new Date().toISOString() }, { merge: true })
    console.log(`[update-logo] ai-recommendations/latest patched (${patched} match)`)
  } else {
    console.log(`[update-logo] ${ticker} not in current ai-recommendations/latest — skipped patch`)
  }
} else {
  console.log('[update-logo] ai-recommendations/latest not found — skipped patch')
}

console.log('')
console.log('[update-logo] done.')
console.log(`[update-logo] next steps:  git add public/logos/${fileName} && git commit -m "logo: ${ticker}" && git push`)
console.log('[update-logo] Netlify will rebuild and serve the new logo at /logos/' + fileName)
