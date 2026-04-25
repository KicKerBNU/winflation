// One-off logo replacement.
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
//
// What it does:
//   1. Downloads the image, validates content-type and size
//   2. Uploads it to Firebase Storage at logos/<TICKER>.<ext>
//   3. Updates Firestore doc logos/<TICKER>
//   4. Patches ai-recommendations/latest so the new logoUrl shows up immediately
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { randomUUID } from 'node:crypto'

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

const storageBucketName =
  process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
  `${serviceAccount.project_id}.firebasestorage.app`

initializeApp({ credential: cert(serviceAccount), storageBucket: storageBucketName })
const db = getFirestore()
const bucket = getStorage().bucket()

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

function buildFirebaseDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
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

let logoUrl = sourceUrl
let storedInStorage = false
try {
  const objectPath = `logos/${safe}.${extFromContentType(ct)}`
  const token = randomUUID()
  await bucket.file(objectPath).save(buf, {
    contentType: ct,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })
  logoUrl = buildFirebaseDownloadUrl(bucket.name, objectPath, token)
  storedInStorage = true
  console.log(`[update-logo] uploaded ${buf.length}B → ${logoUrl}`)
} catch (err) {
  console.warn(`[update-logo] storage upload failed, using source URL directly: ${err.message?.split('\n')[0] ?? err}`)
}

await db.collection('logos').doc(safe).set({
  ticker,
  logoUrl,
  sourceUrl,
  contentType: ct,
  sizeBytes: buf.length,
  storedInStorage,
  updatedAt: new Date().toISOString(),
})
console.log(`[update-logo] firestore logos/${safe} updated`)

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

console.log('[update-logo] done')
