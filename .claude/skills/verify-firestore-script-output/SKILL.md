---
name: verify-firestore-script-output
description: >
  Use this skill after modifying a script under `scripts/` that writes to
  Firestore (e.g. `generate-recommendations.mjs`) and you need to confirm
  the new fields actually landed in the saved doc with the correct shape. Generates a temporary
  read-only verification script, runs it with the project's `.env.local`,
  prints a structured summary of the doc, and cleans the temp file up.
  Triggers: "verify the Firestore output", "did the new field land", "check
  what's in ai-recommendations/latest after the run", or any moment you've
  just executed a script that wrote to Firestore and want to confirm shape.
---

# verify-firestore-script-output

Use this when a script under `scripts/` has just written (or will write) to
Firestore and the user wants confirmation that the new fields landed correctly,
not just that the script exited 0. Saves a recurring "write a small admin SDK
read script, run it, delete it" cycle.

## When to invoke

- The user just edited or ran a Firestore-writing script and asks "did it
  work / what's in the doc / did the new field show up".
- You added a new field to a pipeline and want to confirm it serialized
  before reporting the task complete.
- The user says "verify Firestore", "check the latest doc", "confirm shape".

Do NOT invoke for:
- Reading Firestore at runtime in app code (use the existing `api/` modules).
- Verifying client-side reads — this skill only uses the admin SDK from a
  Node script.

## Prerequisites (assumed by this project)

- `firebase-admin` is already a dependency (it is — used by `scripts/`).
- `.env.local` at the project root has `FIREBASE_SERVICE_ACCOUNT` set to the
  full service-account JSON on a single line.
- Run from the project root so `node_modules` and the `.env.local` resolve.

## Steps

### 1. Confirm what to verify

If the user hasn't said it explicitly, ask once:

- **Collection / doc path** (e.g. `ai-recommendations/latest`).
- **Fields the user expects to see** (e.g. `tierDistribution`, per-pick
  `qualifyingTier`, `dividendsPerYear[].payouts`). If they don't know, infer
  from the script that was just edited (read the section of the script that
  builds the payload).

### 2. Write a temporary verification script

Create `scripts/_verify-tmp.mjs` (the leading underscore + `-tmp` suffix marks
it as ephemeral and `.gitignore`-friendly). Use this template — adapt the doc
path and the fields per request:

```js
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('<COLLECTION>').doc('<DOC_ID>').get()
if (!snap.exists) {
  console.error('doc not found')
  process.exit(1)
}
const data = snap.data()

// Top-level summary — only print fields relevant to this verification
console.log('generatedAt:', data.generatedAt)
// ... add fields the user wants to see

// Per-row breakdown if the doc has an array (e.g. companies, picks)
if (Array.isArray(data.companies)) {
  for (const c of data.companies) {
    console.log(`#${c.rank} ${c.ticker} | <FIELDS_OF_INTEREST>`)
  }
  // Sample one row in full so the user sees the new field shape
  console.log('--- sample row ---')
  console.log(JSON.stringify(data.companies[0], null, 2).slice(0, 800))
}

process.exit(0)
```

Adjust three things per call:
1. The doc path (`<COLLECTION>` / `<DOC_ID>`).
2. The top-level fields to summarize.
3. The per-row breakdown shape (skip if the doc isn't a list).

### 3. Run it

```bash
node --env-file=.env.local scripts/_verify-tmp.mjs 2>&1 | tail -40
```

Use `tail -40` to keep the output readable. If the user wants the full doc
JSON, drop `tail` and `slice(0, 800)`.

### 4. Read the output and report

Tell the user exactly what was confirmed:
- Top-level fields present with their values.
- Whether the new field(s) appear on every row, some rows, or none.
- Anything unexpected (missing field, wrong type, all-null values).

Do NOT silently accept "field exists" — if the field is `null` or `undefined`
on every row, that's a regression and worth calling out.

### 5. Clean up

```bash
rm scripts/_verify-tmp.mjs
```

The temp script must NOT be committed. If you wrote any other temp files
during diagnosis, remove those too.

## Output format for the user

Short and concrete. Example:

```
✅ ai-recommendations/latest contains the new fields:
   - tierDistribution: { conservative: 4, moderate: 1, permissive: 5 }
   - per-pick qualifyingTier present on all 10 companies
   - dividendsPerYear[].payouts[].date populated for every year
Sample: pick #1 (MUV2.DE) → 5 years × 1 payout each, dates 2021-04-29 → 2025-04-25
```

## Notes / edge cases

- **`.env.local` not found**: tell the user, do NOT fall back to interactive
  prompts for the service account.
- **Doc doesn't exist**: report the path and exit; don't assume it should be
  created.
- **Admin SDK auth fails**: usually a malformed `FIREBASE_SERVICE_ACCOUNT`
  (escaped newlines in the private key). Surface the underlying error
  unchanged so the user sees the real cause.
- **Large docs**: the Firestore admin SDK loads the whole doc into memory.
  For collections of dated snapshots, prefer reading just `latest` unless the
  user is auditing history specifically.
- **Cleanup is mandatory** — even if the verification fails, `rm` the temp
  file so it doesn't get committed by accident on the next `git add scripts/`.
