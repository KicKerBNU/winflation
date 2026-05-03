# CLAUDE.md — winflation.eu

> Last updated: 2026-05-03 via /learn

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
│   ├── cashflow/       # /cashflow — monthly-paying dividend instruments
│   ├── quarterly-dy/  # /quarterly-dy — quarterly-paying dividend instruments
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
├── eu-dividend-universe.mjs              # Curated ~55-ticker spine list (AI Picks)
├── cashflow-universe.mjs                 # Curated ~30-ticker monthly-payer list (Cashflow)
├── quarterly-dy-universe.mjs            # Curated 50-ticker quarterly-payer list (Quarterly DY)
├── generate-recommendations.mjs          # Daily AI Picks pipeline (cron at 02:00 UTC)
├── generate-cashflow.mjs                 # Weekly Cashflow pipeline (cron Mondays 03:00 UTC)
├── generate-quarterly-dy.mjs            # Weekly Quarterly DY pipeline (cron weekly)
├── bulk-fetch-spine-logos.mjs            # One-time logo backfill for the SPINE list
├── bulk-fetch-quarterly-dy-logos.mjs    # One-time logo backfill for quarterly-dy universe
├── test-dividend-calendar.mjs            # Test Gemini dividend calendar (1 call, 5 tickers)
└── update-logo.mjs                       # One-off logo replacement for a single ticker
```

### Maintenance scripts

All under `scripts/`. Each requires `FIREBASE_SERVICE_ACCOUNT` (and `GEMINI_API_KEY` where the script calls Gemini) as env vars. Run from the project root with `node --env-file=.env.local scripts/<name>.mjs` so `node_modules` resolve correctly — running from `/tmp` or any other CWD will fail with `ERR_MODULE_NOT_FOUND`.

- `update-logo.mjs <TICKER> <URL>` — replace one ticker's logo. Writes the file to `public/logos/<TICKER>.<ext>` (Netlify serves it same-origin). No Firestore write needed: the daily cron repopulates `logoUrl` on each pick from `public/logos/`. Requires a `git push` afterward to trigger a Netlify rebuild. Does NOT need `FIREBASE_SERVICE_ACCOUNT`.
- `bulk-fetch-spine-logos.mjs` — one-time backfill of every ticker in `eu-dividend-universe.mjs`. Skips tickers that already have a file unless `--force`. Yahoo profile → Gemini suggestion → Clearbit → favicon fallback chain. Writes to `public/logos/` only (no Firestore). Needs `GEMINI_API_KEY` only.
- `bulk-fetch-quarterly-dy-logos.mjs` — same pipeline as above but for `quarterly-dy-universe.mjs`. Run once after adding new tickers. After any logo script, run `git add public/logos/ src/services/logoManifest.ts && git push`.
- `generate-recommendations.mjs` — daily quality-screened pipeline.
  - **Candidate pool**: curated `SPINE` (~55 EU large-caps) + Gemini watch list (~10 names beyond the spine).
  - **Enrichment**: Yahoo `quoteSummary` (`price`, `summaryDetail`, `summaryProfile`, `defaultKeyStatistics`, `financialData`) + `chart` for dividend events. FMP `/stable/profile` is a per-ticker fallback when Yahoo fails.
  - **Quality metrics**: payout ratio, debt/EBITDA, FCF coverage, ROE, dividend streak (consecutive years without > 30% cut, capped at 5), 5y dividend CAGR.
  - **Tier labelling, NOT tier gating**: every candidate is tagged with the strictest tier it passes (`Conservative` → `Moderate` → `Permissive`). Anything failing even Permissive is dropped. Sector-aware: banks/insurers skip the debt/EBITDA gate; utilities/REITs get a higher payout cap.
  - **Composite Quality Score (0–10)**: sustainability 40% + growth 30% + profitability 20% + yield 10%.
  - **Selection (`fillToTarget`)**: yield-gate × diversification-cap grid (2.0× → 0× ECB; 3/3 → unlimited per sector/country). Strictest combination delivering ≥ 10 picks wins.
  - **Gemini dividend calendar**: a single batch call asks Gemini for `nextExDividendDate`, `nextPaymentDate`, and `dividendAmount` for ALL picks. Gemini is PRIMARY for EU stocks (Yahoo unreliable for EU calendar data); Yahoo is fallback; +28 day estimate from ex-div is last resort.
  - **Persistence**: writes `ai-recommendations/latest` and `ai-recommendations/<YYYY-MM-DD>`.
- `generate-cashflow.mjs` — weekly cashflow pipeline (Mondays 03:00 UTC).
  - **Universe**: hand-curated `cashflow-universe.mjs` — each entry is `{ ticker, assetClass, notes }` where `assetClass` ∈ `equity-reit | mortgage-reit | bdc | energy-infra | stock | etf`.
  - **Monthly verification**: drops anything with fewer than 9 or more than 14 distributions in the last 12 months.
  - **Risk tier** (deterministic): `equity-reit / etf / stock` → low, `bdc / energy-infra` → medium, `mortgage-reit` → high.
  - **Persistence**: writes `cashflow/latest` and `cashflow/<YYYY-MM-DD>`.
- `generate-quarterly-dy.mjs` — weekly quarterly DY pipeline.
  - **Universe**: hand-curated `quarterly-dy-universe.mjs` — each entry is `{ ticker, assetClass, region, notes }` where `assetClass` ∈ `dividend-aristocrat | dividend-achiever | utility | bank | energy | reit`.
  - **Quarterly verification**: 3–5 payments in trailing 12 months. Lower bound 3 accommodates Yahoo occasionally missing 1 event near period boundary; upper bound 5 allows one special dividend on top of 4 quarterly.
  - **Risk tier** (deterministic): `dividend-aristocrat / utility` → low; `dividend-achiever / bank / energy / reit` → medium.
  - **Payment date estimate**: ex-div + 20 days (between monthly's 14d and EU annual's 28d).
  - **Persistence**: writes `quarterly-dy/latest` and `quarterly-dy/<YYYY-MM-DD>`.
  - **Known issue**: Canadian TSX-listed tickers (RY, TD, BNS, BMO, CM, TRP, CNQ) show only 1–2 distributions in trailing 12mo via Yahoo `chart()` despite paying quarterly for 15+ years. Yahoo boundary bug for TSX listings. These are dropped by the 3-payment minimum filter.
- `eu-dividend-universe.mjs` — curated spine list, plain string array of Yahoo-formatted tickers. Review monthly.
- `cashflow-universe.mjs` — curated monthly-payer list. Review when names change distribution cadence; tickers that go quarterly must be removed.
- `quarterly-dy-universe.mjs` — curated quarterly-payer list. 50 tickers: 21 US Aristocrats, 7 US Achievers, 3 US Utilities, 3 US Banks, 3 US REITs, 5 Canadian Banks, 3 Canadian Energy, 1 Canadian Utility, 4 UK/European. Review quarterly.

## Features

| Module | Routes | Purpose |
|--------|--------|---------|
| `dashboard` | `/` | Landing page with overview cards + upcoming ex-dividends marquee |
| `interest-rate` | `/interest-rate` | ECB key interest-rate history chart |
| `inflation` | `/inflation`, `/inflation/:countryCode` | HICP inflation across EU countries |
| `dividends` | `/dividends`, `/dividends/:ticker` | Dividend stock list + per-company history |
| `ai-recommendation` | `/ai-recommendation`, `/ai-recommendation/:ticker` | Daily Gemini-curated dividend picks. Hero + ranking cards carry strategy-tier badges. Detail page shows exact dividend payout dates. Logged-in users with a tax country see a per-pick "Beats / Matches / Loses your inflation" badge. |
| `cashflow` | `/cashflow`, `/cashflow/:ticker` | Monthly-paying dividend instruments. Hand-curated universe (~30 tickers), weekly cron. Emerald color scheme. |
| `quarterly-dy` | `/quarterly-dy`, `/quarterly-dy/:ticker` | Quarterly-paying dividend instruments. US Aristocrats/Achievers, Canadian banks & energy, UK/European blue-chips. Indigo color scheme. Hand-curated 50-ticker universe, weekly cron. |
| `minerals` | `/minerals`, `/minerals/:countryCode` | Critical-mineral reserves and production by EU country |
| `auth` | `/login`, `/register` | Firebase Auth (`guestOnly`). Owns the per-user profile (`taxCountryCode`) via `user-profile.store`. |
| `follow` | `/followed` | Followed tickers/countries (`requiresAuth`). Reads/writes `users/{uid}.followed*` fields. `FollowSource` = `'ai-pick' | 'dividend' | 'monthly-dy' | 'quarterly-dy'`. |
| `settings` | `/settings` | Tax country picker + WHT education hub (`requiresAuth`). |
| `theme` | — | Dark/light theme store; no routes |

## Dashboard Upcoming Ex-Dividends

The dashboard marquee aggregates picks from **monthly-dy + quarterly-dy + AI picks** into a single upcoming ex-dividends strip. Sources are deduplicated by ticker (monthly-dy/quarterly-dy preferred over AI picks for the same ticker). The `dashboard.store.ts` calls `init()` on all three stores in parallel.

Payment date fallbacks by source:
- `monthly-dy`: stored date if `> nextExDividendDate`, else `nextExDividendDate + 14d`
- `quarterly-dy`: stored date if `> nextExDividendDate`, else `nextExDividendDate + 20d`
- `ai-pick`: stored date if present, else `nextExDividendDate + 28d`

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

## "Beats your inflation" feature

Inflation comparison on AI Picks, Cashflow detail, and Quarterly DY detail. Uses **user's tax-residence HICP** (not issuer-country HICP — that was wrong and was corrected):

- Logged-out or no tax country: no badge shown.
- Logged-in with tax country: `nominal − userHICP`, rounded to 1 decimal.
  - `> 0` → green "Beats your inflation by X%"
  - `= 0` → amber "Roughly matches your inflation"
  - `< 0` → red "Loses to your inflation by X%"

## Languages

Supported locales (auto-detected from browser): `en-US` (default), `pt-BR`. Both must be kept in sync — every new key needs both entries. Translation keys are namespaced by feature (`quarterlyDy.*`, `monthlyDy.*`, `aiRecommendation.*`, etc.).

## External APIs

| Service | Purpose | Cache TTL |
|---------|---------|-----------|
| ECB Data API | Interest rates | 24 h |
| Eurostat | Inflation (HICP, EU-27 only), government debt | 24 h |
| Financial Modeling Prep | Dividend stock data | 24 h |
| Google Gemini | AI economic briefings, company history, EU dividend calendar | 24 h / monthly |
| Firebase Firestore | AI recommendations, cashflow, quarterly-dy, per-user profile, follows | Browser session |

## Conventions

- No `components/` folder at the `src` root — components belong inside their feature module
- Each feature module owns its routes; `src/router/index.ts` spreads them all
- Pinia stores use **Setup Store** style (`defineStore` with `ref`/`computed`)
- Use `@/` alias for absolute imports
- TypeScript contracts (interfaces, types) go in the feature's `domain/` folder
- All UI text via `useI18n` — no hardcoded strings in templates
- FA icons added in `src/plugins/fontawesome.ts`; use `<FontAwesomeIcon icon="icon-name" />`
- Every interactive element must have `cursor-pointer` (global rule)
- README.md must be kept in sync with every feature change
- For per-user data shared across modules, use `users/{uid}` with `setDoc({merge: true})` and let each module own its own field namespace
- **Color scheme convention**: cashflow = emerald, quarterly-dy = indigo, AI picks = violet, dividends = blue

## Pinia store patterns

- Most stores expose `init()` that's idempotent — safe to call multiple times.
- For per-user Firestore data: subscribe-on-auth-uid-change pattern.
- `auth.store` exposes a `ready` promise that resolves on first `onAuthStateChanged` callback. Route guards `await auth.ready` before checking `requiresAuth`.

## Commands

```bash
npm run dev              # Dev server (http://localhost:5173, falls back to 5174/5175 if busy)
npm run build            # vue-tsc -b && vite build  — see "Build issue" below
npm run preview          # Preview production build
npm run storybook        # Storybook (http://localhost:6006)
npm run build-storybook  # Build static Storybook
```

### Build issue (pre-existing, unrelated to feature work)

`npm run build` currently fails with `error TS5101: Option 'baseUrl' is deprecated`.

Workarounds:
```bash
npx vite build                                                     # production bundle (skips vue-tsc)
npx vue-tsc --noEmit --ignoreDeprecations 6.0 -p tsconfig.app.json # type-check only
```

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

- **TTM payout ratios > 100% are normal for EU large-caps** in transition years. Don't tighten Permissive thresholds below `maxPayout: 1.5` (1.75 for utilities/REITs).
- **Yahoo `dividendYield` can be 0 even when the stock pays** — fallback path is `annualDividend / currentPrice`.
- **Yahoo `chart()` misses recent events for TSX-listed stocks** — Canadian quarterly payers (RY, TD, BNS, etc.) show only 1–2 trailing-12mo distributions despite paying quarterly for 15+ years. Boundary bug in Yahoo's API. They are dropped by the quarterly-dy 3-payment minimum.
- **Yahoo EU dividend calendar is unreliable** — `calendarEvents.dividendDate` is null for most European stocks. Gemini is used as PRIMARY source for AI picks' `nextExDividendDate`, `nextPaymentDate`, and `dividendAmount` for all picks.
- **Gemini rate limit error extraction** — parse suggested retry delay from 429 responses with `err.message.match(/"retryDelay":"(\d+)s"/)` and wait `(seconds + 2) * 1000` ms. Don't use fixed exponential backoff alone.
- **Gemini free tier limits** — 5 rpm and 20 req/day. The AI picks cron uses ~11 calls/run. The quarterly-dy and cashflow crons do NOT call Gemini.
- **Always run scripts from project root**, not `/tmp` — they import from local universe files and use `yahoo-finance2` from local `node_modules`.
- **`dividendStreak` is capped at 5** — metric computed over a 5-year window. `minStreak: 6+` would be unsatisfiable.
- **Logos under `public/logos/`** are served same-origin via Netlify (no Firebase Storage). After running any logo script: `git add public/logos/ src/services/logoManifest.ts && git push` to trigger Netlify rebuild. The cron auto-populates `logoUrl` from the manifest on each run.
- **Dashboard needs `max-w-7xl` wrapper** — the dashboard page had no max-width container (unlike all other pages which use `max-w-6xl`). Without it the upcoming ex-dividends marquee overflows the viewport.
- **Marquee `overflow: hidden` requires explicit width** — `.ex-dividend-marquee` must have `width: 100%; min-width: 0` otherwise the `max-content` track isn't clipped and breaks the page layout.
- **Firestore rule field-restriction is the #1 source of "Missing or insufficient permissions"** for `users/{uid}` writes. Fix: use the simple owner-only rule.
- **Multiple stuck dev servers**: clean up with `lsof -i :5173 -t | xargs -r kill`.
- **`refreshesDaily` i18n string still says "8:00 UTC"** — cron runs at 02:00 UTC. Known drift, not yet fixed.

## Withholding-tax data

`src/modules/settings/domain/withholding-rates.ts` — hand-curated table of statutory + bilateral treaty WHT rates for 30 source countries (EU-27 + US, UK, CH) as they apply to EU-27 retail residents.

`getWhtForPair(sourceCode, userCountryCode)` returns `{ statutory, treaty (null if no benefit), reclaimAtSource, reclaimNote }`.

Notable bilateral overrides: `US-BG` 10%, `US-HU` 30% (terminated), `IE-CY` 0%, `IE-MT` 0%.

## Current Focus

- ✅ **Quarterly DY v1** — new `/quarterly-dy` page for quarterly dividend payers. 50-ticker hand-curated universe (US Aristocrats/Achievers, Canadian banks & energy, UK/European), weekly Yahoo-driven cron, indigo color scheme, ex-dividend countdown chips, 5y price chart with dividend markers, WHT chip, inflation badge, follow button. Integrated into dashboard upcoming ex-dividends marquee.
- ✅ **Cashflow v1** — monthly-paying instruments. Emerald color scheme.
- ✅ **WHT v1** — education hub in Settings.
- ⏳ **WHT v2** — surface WHT on AI Picks list/detail and fold post-WHT yield into the inflation-beat badge math.
- ⏳ **Cashflow v2** — total-return view, distribution-coverage signal (FFO/AFFO for REITs, NII for BDCs).
- ⏳ **Quarterly DY Canadian fix** — Yahoo boundary bug drops all 7 Canadian tickers. Options: (a) lower the minimum to 1, guarded by 5y check; (b) use a separate calendar API for TSX stocks.
- 🛑 FX risk: badge ignores it.
- 🛑 Non-EU-27 tax residences (UK, CH, NO, BR, US): need new inflation series.

## Known Issues / TODOs

- `aiRecommendation.refreshesDaily` i18n string still says "8:00 UTC" but cron runs at 02:00 UTC
- Canadian quarterly payers dropped by Yahoo chart() boundary bug (RY, TD, BNS, BMO, CM, TRP, CNQ)
- 90-day earnings revisions and forward P/E vs sector median — skipped (data not freely available)
- Monthly review of `eu-dividend-universe.mjs` and quarterly review of `quarterly-dy-universe.mjs` — manual maintenance tasks
- WHT v2 (fold into picks pages + badge math)
- FX honesty pass — at minimum a *"in pick currency, before FX"* label on cross-currency picks
- Total-return view, structured thesis paragraph
- Deterministic `status` rubric (Gemini currently decides ad-hoc)
- Portfolio-level "Beats your inflation" — depends on `follow/` gaining cost basis + share counts
