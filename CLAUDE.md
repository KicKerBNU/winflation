# CLAUDE.md — winflation.eu

> Last updated: 2026-04-27 via /learn

## Project Overview

**winflation.eu** — a multilingual financial analysis web app for European investors. Compare dividend stock yields against inflation rates and ECB interest rates across EU countries, with a daily-curated AI Picks list and a per-user "Beats your inflation" verdict driven by the user's tax-residence HICP.

## Tech Stack

- **Vue 3** with `<script setup>` and Composition API
- **TypeScript** (strict mode)
- **Vite** (build tool)
- **Vue Router 5** (client-side routing)
- **Pinia 3** (state management, Setup Store style)
- **Tailwind CSS 4** (utility-first styling, via `@tailwindcss/vite`)
- **vue-i18n 11** (internationalization — `legacy: false`, Composition API mode)
- **Chart.js 4** (line and bar charts)
- **FontAwesome 7** (icons via `@fortawesome/vue-fontawesome`, registered globally as `<FontAwesomeIcon>`)
- **Firebase** (Auth + Firestore, Spark/free plan, **no Firebase Storage**)
- **Google Gemini** (`gemini-flash-latest` — economic briefings; AI Picks ticker selection + pro/con narrative only, never numeric data)
- **Yahoo Finance** (`yahoo-finance2` npm, server-side cron only — primary numeric source: price, market cap, financialData, 5y dividend history)
- **Financial Modeling Prep** (dividends module client-side; per-ticker fallback for AI Picks when Yahoo fails)
- **Storybook 10** (component development and visual testing)

## Folder Structure

```
src/
├── modules/            # Feature modules (DDD)
│   ├── dashboard/
│   ├── interest-rate/
│   ├── inflation/
│   ├── dividends/
│   ├── ai-recommendation/
│   ├── minerals/
│   ├── auth/           # Firebase Auth + per-user profile (taxCountryCode)
│   ├── follow/         # Followed tickers/countries
│   ├── settings/       # /settings page — tax country picker + WHT education hub
│   └── theme/
│       Each module: api/ (HTTP requests), domain/ (TypeScript types),
│       store/ (Pinia), <feature>.routes.ts, <feature>.vue
├── i18n/locales/       # en-US.ts and pt-BR.ts (must be kept in sync)
├── plugins/            # firebase.ts, fontawesome.ts
├── router/             # Global router — spreads each module's routes
├── services/           # localCache (localStorage, 24 h TTL)
└── assets/styles/      # Tailwind entry point

scripts/
├── eu-dividend-universe.mjs       # Curated ~55-ticker spine list (manual monthly review)
├── generate-recommendations.mjs   # Daily quality-screened pipeline (cron at 02:00 UTC)
├── bulk-fetch-spine-logos.mjs     # One-time logo backfill for the entire SPINE
└── update-logo.mjs                # One-off logo replacement for a single ticker
```

### Maintenance scripts

All under `scripts/`. Each requires `FIREBASE_SERVICE_ACCOUNT` (and `GEMINI_API_KEY` where the script calls Gemini) as env vars. Run from the project root with `node --env-file=.env.local scripts/<name>.mjs` so `node_modules` resolve correctly — running from `/tmp` or any other CWD will fail with `ERR_MODULE_NOT_FOUND`.

- `update-logo.mjs <TICKER> <URL>` — replace one ticker's logo. Writes the file to `public/logos/<TICKER>.<ext>` (Netlify serves it same-origin). No Firestore write needed: the daily cron repopulates `logoUrl` on each pick from `public/logos/`. Requires a `git push` afterward to trigger a Netlify rebuild. Does NOT need `FIREBASE_SERVICE_ACCOUNT` anymore.
- `bulk-fetch-spine-logos.mjs` — one-time backfill of every ticker in `eu-dividend-universe.mjs`. Skips tickers that already have a file unless `--force`. Yahoo profile → Gemini suggestion → Clearbit → favicon fallback chain. Writes to `public/logos/` only (no Firestore). Needs `GEMINI_API_KEY` only.
- `generate-recommendations.mjs` — daily quality-screened pipeline.
  - **Candidate pool**: curated `SPINE` (~55 EU large-caps) + Gemini watch list (~10 names beyond the spine).
  - **Enrichment**: Yahoo `quoteSummary` (`price`, `summaryDetail`, `summaryProfile`, `defaultKeyStatistics`, `financialData`) + `chart` for dividend events. FMP `/stable/profile` is a per-ticker fallback when Yahoo fails.
  - **Quality metrics**: payout ratio, debt/EBITDA, FCF coverage, ROE, dividend streak (consecutive years without > 30% cut, capped at 5), 5y dividend CAGR.
  - **Tier labelling, NOT tier gating**: every candidate is tagged with the strictest tier it passes (`Conservative` → `Moderate` → `Permissive`). Anything failing even Permissive is dropped. Sector-aware: banks/insurers skip the debt/EBITDA gate; utilities/REITs get a higher payout cap.
  - **Composite Quality Score (0–10)**: sustainability 40% + growth 30% + profitability 20% + yield 10%.
  - **Selection (`fillToTarget`)**: yield-gate × diversification-cap grid (2.0× → 0× ECB; 3/3 → unlimited per sector/country). Strictest combination delivering ≥ 10 picks wins. Tiers are NOT part of this search — the batch is a mix.
  - **Persistence**: writes `ai-recommendations/latest` and `ai-recommendations/<YYYY-MM-DD>`. Each company has its own `qualifyingTier` + `qualifyingTierLabel`. Top-level doc has `tierDistribution`, `tierFloorCount`, candidate counts, sector/country distribution.
  - **Dividend payouts**: each `dividendsPerYear[i]` carries a `payouts: [{ date, amount }]` array — every individual payout in the 5-year window with its exact date.
- `eu-dividend-universe.mjs` — curated spine list, plain string array of Yahoo-formatted tickers. Review monthly.

## Features

| Module | Routes | Purpose |
|--------|--------|---------|
| `dashboard` | `/` | Landing page with overview cards |
| `interest-rate` | `/interest-rate` | ECB key interest-rate history chart |
| `inflation` | `/inflation`, `/inflation/:countryCode` | HICP inflation across EU countries |
| `dividends` | `/dividends`, `/dividends/:ticker` | Dividend stock list + per-company history |
| `ai-recommendation` | `/ai-recommendation`, `/ai-recommendation/:ticker` | Daily Gemini-curated dividend picks. Hero + ranking cards carry strategy-tier badges. Detail page shows exact dividend payout dates. Logged-in users with a tax country see a per-pick "Beats / Matches / Loses your inflation" badge. |
| `minerals` | `/minerals`, `/minerals/:countryCode` | Critical-mineral reserves and production by EU country |
| `auth` | `/login`, `/register` | Firebase Auth (`guestOnly`). Owns the per-user profile (`taxCountryCode`) via `user-profile.store`. |
| `follow` | `/followed` | Followed tickers/countries (`requiresAuth`). Reads/writes `users/{uid}.followed*` fields. |
| `settings` | `/settings` | Tax country picker + WHT education hub (`requiresAuth`). |
| `theme` | — | Dark/light theme store; no routes |

## Per-user Firestore data: `users/{uid}`

One Firestore doc per authenticated user, owned by multiple modules using `setDoc({merge: true})`:

- **`follow/`** writes `followed: string[]`, `followedMeta: { [ticker]: FollowedCompany }`
- **`auth/user-profile.store`** writes `taxCountryCode: string`, `taxCountryUpdatedAt: ISO`

**Required Firestore rule** (must be deployed in Firebase console — not in repo):

```
match /users/{uid} {
  allow read, write: if request.auth.uid == uid;
}
```

If the deployed rule is field-restricted (e.g. `hasOnly(['followed', 'followedMeta'])`), writes to new fields like `taxCountryCode` will fail with `Missing or insufficient permissions`. The simple owner-only rule above is the canonical version.

The `users/{uid}` collection rule is documented in `README.md → Firestore Security Rules`.

## "Beats your inflation" feature

Inflation comparison on AI Picks. Initially built using *issuer-country* HICP — that was wrong (a Brazilian holding ENEL.MI doesn't pay rent in Italy). Replaced with **user's tax-residence HICP**:

- Headline on AI Picks: **always nominal yield**, never substituted.
- Logged-out users (and logged-in users with no tax country): no badge, no CTA visible.
- Logged-in users with tax country set: per-pick badge shows `nominal − userHICP`, sharp threshold:
  - `> 0` → green "Beats your inflation by X%"
  - `= 0` → amber "Roughly matches your inflation"
  - `< 0` → red "Loses to your inflation by X%"
  - Rounded to 1 decimal.
- Logged-in users with no tax country see a soft-prompt CTA on AI Picks list and detail page linking to `/settings`.

The badge **ignores FX risk and withholding tax** — known correctness gaps documented in P3 README TODOs. WHT v1 (education hub in Settings) ships standalone; folding WHT into the badge math is v2.

## Languages

Supported locales (auto-detected from browser): `en-US` (default), `pt-BR`. Both must be kept in sync — every new key needs both entries.

## External APIs

| Service | Purpose | Cache TTL |
|---------|---------|-----------|
| ECB Data API | Interest rates | 24 h |
| Eurostat | Inflation (HICP, EU-27 only), government debt | 24 h |
| Financial Modeling Prep | Dividend stock data | 24 h |
| Google Gemini | AI economic briefings, company history | 24 h / monthly |
| Firebase Firestore | AI recommendations, per-user profile, follows | Browser session |

## Conventions

- No `components/` folder at the `src` root — components belong inside their feature module
- Each feature module owns its routes; `src/router/index.ts` spreads them all
- Pinia stores use **Setup Store** style (`defineStore` with `ref`/`computed`)
- Use `@/` alias for absolute imports
- TypeScript contracts (interfaces, types) go in the feature's `domain/` folder
- All UI text via `useI18n` — no hardcoded strings in templates
- FA icons added in `src/plugins/fontawesome.ts`; use `<FontAwesomeIcon icon="icon-name" />`. en-US and pt-BR locale files must be in sync — every new key gets both languages
- Translation keys are namespaced by feature (e.g. `aiRecommendation.tierConservative`, `settings.wht.statutory`)
- Storybook stories live alongside the component
- Every interactive element must have `cursor-pointer` (global rule)
- README.md must be kept in sync with every feature change (user feedback rule)
- For per-user data shared across modules, use `users/{uid}` with `setDoc({merge: true})` and let each module own its own field namespace

## Pinia store patterns

- Most stores expose `init()` that's idempotent — safe to call multiple times. Initialised in `main.ts` so listeners are live before mount.
- For per-user Firestore data: subscribe-on-auth-uid-change pattern. The `user-profile.store` watches `auth.user?.uid` to manage the Firestore listener lifecycle:
  ```
  watch(() => auth.user?.uid ?? null, (uid) => {
    teardown()
    if (uid) unsubscribe = subscribeToProfile(uid, ...)
  }, { immediate: true })
  ```
  This handles login → subscribe, logout → unsubscribe automatically.
- `auth.store` exposes a `ready` promise that resolves on first `onAuthStateChanged` callback. Route guards `await auth.ready` before checking `requiresAuth` so the user isn't bounced to `/login` on a refresh.

## Commands

```bash
npm run dev              # Dev server (http://localhost:5173, falls back to 5174/5175 if busy)
npm run build            # vue-tsc -b && vite build  — see "Build issue" below
npm run preview          # Preview production build
npm run storybook        # Storybook (http://localhost:6006)
npm run build-storybook  # Build static Storybook
```

### Build issue (pre-existing, unrelated to feature work)

`npm run build` currently fails with `error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0` from `tsconfig.app.json`.

Workarounds:
```bash
npx vite build                                                     # production bundle (skips vue-tsc)
npx vue-tsc --noEmit --ignoreDeprecations 6.0 -p tsconfig.app.json # type-check only
```

The proper fix is to add `"ignoreDeprecations": "6.0"` to `tsconfig.app.json` or migrate off `baseUrl` to `paths`-only.

## Environment Variables (`.env.local`)

```
VITE_FMP_API_KEY=
VITE_GEMINI_API_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Used only by scripts/ (cron + maintenance)
GEMINI_API_KEY=
FIREBASE_SERVICE_ACCOUNT=    # full JSON, single line
FMP_API_KEY=                 # optional, falls back to VITE_FMP_API_KEY
```

## Known Gotchas & Debugging Notes

- **TTM payout ratios > 100% are normal for EU large-caps** in transition years (BAS.DE 140%, ENEL.MI 121%, ORA.PA 625%). Don't tighten Permissive thresholds below `maxPayout: 1.5` (1.75 for utilities/REITs) without expecting survivor counts to collapse.
- **Yahoo `dividendYield` can be 0 even when the stock pays** — fallback path is `annualDividend / currentPrice`.
- **Gemini free tier is 5 rpm** — `generate-recommendations.mjs` fans out 10 narrative calls in parallel; some hit 429 and fall back to generic narratives. Acceptable; fix only if every pick must have a custom narrative.
- **Always run scripts from project root**, not `/tmp` — they import from `./eu-dividend-universe.mjs` and use `yahoo-finance2` from local `node_modules`.
- **`dividendStreak` is capped at 5** — metric computed over a 5-year window. `minStreak: 6+` would be unsatisfiable.
- **Logos under `public/logos/`** are served same-origin via Netlify (no Firebase Storage). After running logo scripts you must `git add public/logos/<TICKER>.<ext> && git push` to trigger a Netlify rebuild.
- **Firestore rule field-restriction is the #1 source of "Missing or insufficient permissions" errors** for `users/{uid}` writes. Symptom: a write that adds a new field (e.g. `taxCountryCode`) fails on a doc the user can otherwise read/write. Fix: relax the rule to owner-only, or expand the `hasOnly([...])` allowlist.
- **`refreshesDaily` i18n string still says "8:00 UTC"** in both locales while the cron runs at 02:00 UTC. Known drift, not yet fixed.
- **Multiple stuck dev servers**: dev server starts can leave processes on 5173/5174/5175 if killed unevenly. Clean up with `lsof -i :5173 -t | xargs -r kill`.

## Withholding-tax data

`src/modules/settings/domain/withholding-rates.ts` — hand-curated table of statutory + bilateral treaty WHT rates for 30 source countries (EU-27 + US, UK, CH) as they apply to EU-27 retail residents.

Data shape:
```ts
{ code, name, statutoryRate, euTreatyRate, treatyOverrides?: { [userCode]: rate }, reclaimAtSource, reclaimNote? }
```

Lookup helper `getWhtForPair(sourceCode, userCountryCode)` returns `{ statutory, treaty (null if no benefit), reclaimAtSource, reclaimNote }`. Treaty is `null` when the override or the EU default is `>= statutory` — UI hides the "with treaty" cell in that case.

`WHT_LAST_REVIEWED` constant is the review-date stamp shown in the UI. Bump it whenever the table is updated.

Notable bilateral overrides currently encoded:
- `US-BG` 10% (lower than EU-15% default)
- `US-HU` 30% (treaty terminated; reverts to statutory)
- `IE-CY` 0%, `IE-MT` 0% (special EU treaties)

## Current Focus

P3 of the AI-recommendations roadmap (in README.md):

- ✅ **WHT v1 — education hub in Settings.** Per-source-country withholding table for the user's tax residence. 30 source countries, statutory + treaty cap, "Applied at source" vs "Reclaim required" badge, reclaim-mechanics one-liner, search filter, reviewed-date stamp, disclaimer banner.
- ⏳ **WHT v2** — surface user-specific WHT on AI Picks list/detail and fold post-WHT yield into the inflation-beat badge math.
- 🛑 FX risk: badge ignores it (BRL/EUR drift can dwarf the inflation adjustment for cross-currency holdings).
- 🛑 Non-EU-27 tax residences (UK, CH, NO, BR, US): need new inflation series.
- 🛑 Total-return view, structured thesis paragraph, ex-dividend + next-payment date, deterministic `status` rubric, portfolio-level real yield (depends on `follow/` becoming a holdings tracker).

## Known Issues / TODOs

Carried from README.md (only items not addressed yet):

- `aiRecommendation.refreshesDaily` i18n string still says "8:00 UTC" but cron runs at 02:00 UTC
- 90-day earnings revisions and forward P/E vs sector median — skipped (data not freely available)
- Monthly review of `eu-dividend-universe.mjs` — manual maintenance task
- WHT v2 (fold into picks pages + badge math)
- FX honesty pass — at minimum a *"in pick currency, before FX"* label on cross-currency picks
- Total-return view, structured thesis paragraph, ex-dividend + next-payment dates
- Deterministic `status` rubric (Gemini currently decides ad-hoc)
- Portfolio-level "Beats your inflation" — depends on `follow/` gaining cost basis + share counts
- P5: monthly-dividend strategy module (global markets, not just EU)
