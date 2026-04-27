# CLAUDE.md — winflation.eu

> Last updated: 2026-04-26 via /learn

## Project Overview

**winflation.eu** — a multilingual financial analysis web app for European investors. Compare dividend stock yields against inflation rates and ECB interest rates across EU countries.

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
- **Firebase** (Firestore for AI recommendation cache, Analytics — Spark/free plan, **no Firebase Storage**)
- **Google Gemini** (`gemini-flash-latest` — AI economic briefings; AI Picks ticker selection + pro/con narrative only, never numeric data)
- **Yahoo Finance** (`yahoo-finance2` npm, server-side cron only — primary numeric source for AI Picks: price, market cap, financialData, 5y dividend history)
- **Financial Modeling Prep** (used by dividends module client-side; per-ticker fallback for AI Picks when Yahoo fails)
- **Storybook 10** (component development and visual testing)

## Folder Structure

```
src/
├── modules/            # Feature modules (DDD) — see Features section below
│   ├── dashboard/
│   ├── interest-rate/
│   ├── inflation/
│   ├── dividends/
│   ├── ai-recommendation/
│   ├── minerals/
│   ├── auth/
│   ├── follow/
│   └── theme/
│       Each module contains:
│       ├── api/        # HTTP requests
│       ├── domain/     # TypeScript interfaces and types
│       ├── store/      # Pinia store
│       ├── <feature>.routes.ts
│       └── <feature>.vue
├── i18n/
│   ├── index.ts        # createI18n instance + locale detection
│   └── locales/
│       ├── en-US.ts
│       └── pt-BR.ts
├── plugins/
│   ├── firebase.ts     # Firebase app init
│   └── fontawesome.ts  # Registers FA library + <FontAwesomeIcon> globally
├── router/
│   └── index.ts        # Global router — imports and spreads module routes
├── services/
│   └── localCache.ts   # localStorage cache with 24 h TTL
├── assets/
│   └── styles/
│       └── main.css    # Tailwind entry (@import "tailwindcss")
├── App.vue             # Root component — only contains <RouterView />
└── main.ts             # App bootstrap — registers Pinia, Router, i18n, FA

scripts/
├── eu-dividend-universe.mjs       # Curated ~55-ticker spine list (manual monthly review)
├── generate-recommendations.mjs   # Daily quality-screened pipeline (cron)
├── bulk-fetch-spine-logos.mjs     # One-time logo backfill for the entire SPINE
├── fetch-company-logos.mjs        # Legacy logo backfill (mostly redundant after spine is pre-loaded)
└── update-logo.mjs                # One-off logo replacement for a single ticker

.github/workflows/
└── ai-daily-recommendations.yml   # Cron: 02:00 UTC daily
```

### Maintenance scripts

All under `scripts/`. Each requires `FIREBASE_SERVICE_ACCOUNT` (and `GEMINI_API_KEY` where the script calls Gemini) as env vars. Run from the project root with `node --env-file=.env.local scripts/<name>.mjs` so `node_modules` resolve correctly — running from `/tmp` or any other CWD will fail with `ERR_MODULE_NOT_FOUND`.

- `update-logo.mjs <TICKER> <URL>` — replace one ticker's logo. Writes the file to `public/logos/<TICKER>.<ext>` (Netlify serves it same-origin at `/logos/<TICKER>.<ext>`), updates `logos/<TICKER>` Firestore doc, and patches `ai-recommendations/latest`. Requires a `git push` afterward to trigger a Netlify rebuild — Firebase Storage is **not** used.
- `bulk-fetch-spine-logos.mjs` — one-time backfill of every ticker in `eu-dividend-universe.mjs`. Same per-ticker logic as `update-logo.mjs` but loops the whole SPINE list. Skips tickers that already have a file in `public/logos/` unless `--force`. Uses Yahoo profile → Gemini suggestion → Clearbit → favicon fallback chain. Run after editing the spine list to pre-populate logos for new additions.
- `fetch-company-logos.mjs` — re-resolves logos for every company currently in `ai-recommendations/latest` via Gemini + fallback chain.
- `generate-recommendations.mjs` — daily quality-screened pipeline.
  - **Candidate pool**: curated `SPINE` from `eu-dividend-universe.mjs` (~55 EU large-caps) + Gemini-suggested watch list (~10 names beyond the spine).
  - **Enrichment**: Yahoo Finance `quoteSummary` (`price`, `summaryDetail`, `summaryProfile`, `defaultKeyStatistics`, `financialData`) + `chart` for dividend events. FMP `/stable/profile` is a per-ticker fallback when Yahoo fails.
  - **Quality metrics**: payout ratio, debt/EBITDA, FCF coverage, ROE, dividend streak (years of consistent payment without > 30% cut, capped at 5), 5-year dividend CAGR.
  - **Tier labelling, NOT tier gating**: every candidate is tagged with the strictest tier it passes (`Conservative` → `Moderate` → `Permissive`). Anything that fails even Permissive is dropped. Sector-aware: banks/insurers skip the debt/EBITDA gate; utilities/REITs get a higher payout cap.
  - **Composite Quality Score (0–10)**: sustainability 40% + growth 30% + profitability 20% + yield 10%.
  - **Selection (`fillToTarget`)**: searches yield-gate × diversification-cap grid (yields 2.0× → 0× ECB; caps 3/sector,3/country → unlimited). Strictest combination that delivers ≥ 10 picks wins. Tiers are *not* part of this search anymore — the batch is intentionally a mix of Conservative/Moderate/Permissive picks.
  - **Diversification**: max 3 per sector, max 3 per country (relax-on-need), greedy by quality score.
  - **Narratives**: Gemini writes pro/con/status per pick, with computed metrics fed in as context.
  - **Persistence**: writes both `ai-recommendations/latest` and `ai-recommendations/<YYYY-MM-DD>`. Each company has its own `qualifyingTier` + `qualifyingTierLabel`. Top-level doc has `tierDistribution` (counts per tier in the batch), `tierFloorCount` (how many candidates passed at least Permissive), candidate counts at each stage, and sector/country distribution.
  - **Dividend payouts**: each `dividendsPerYear[i]` carries a `payouts: [{ date, amount }]` array — every individual payout in the 5-year window with its exact date. UI uses this to render per-payment date chips.
- `eu-dividend-universe.mjs` — the curated spine list. Plain string array of Yahoo-formatted tickers. Review monthly.

## Features

| Module | Routes | Purpose |
|--------|--------|---------|
| `dashboard` | `/` | Landing page with overview cards linking to every feature |
| `interest-rate` | `/interest-rate` | ECB key interest-rate history chart |
| `inflation` | `/inflation`, `/inflation/:countryCode` | HICP inflation across EU countries with per-country drill-down |
| `dividends` | `/dividends`, `/dividends/:ticker` | Dividend-paying stock list with per-company history and Gemini-generated company brief |
| `ai-recommendation` | `/ai-recommendation`, `/ai-recommendation/:ticker` | Daily Gemini-curated dividend picks read from Firestore cache. Hero + ranking cards each carry a strategy-tier badge. Detail page shows exact dividend payout dates. |
| `minerals` | `/minerals`, `/minerals/:countryCode` | Critical-mineral reserves and production by EU country |
| `auth` | `/login`, `/register` | Firebase Auth email/password sign-in (`guestOnly` route guard) |
| `follow` | `/followed` | Authenticated user's followed tickers/countries (`requiresAuth` route guard) |
| `theme` | — | Dark/light theme store; no routes |

## Languages

Supported locales (auto-detected from browser):

| Code | Language |
|------|----------|
| en-US | English (default) |
| pt-BR | Brazilian Portuguese |

The README mentions five languages aspirationally, but only en-US and pt-BR ship today.

## External APIs

| Service | Purpose | Cache TTL |
|---------|---------|-----------|
| ECB Data API | Interest rates | 24 h |
| Eurostat | Inflation (HICP), government debt | 24 h |
| Financial Modeling Prep | Dividend stock data | 24 h |
| Google Gemini | AI economic briefings, company history | 24 h / monthly |
| Firebase Firestore | Pre-generated AI recommendations | Browser session |

## Conventions

- No `components/` folder at the `src` root — components belong inside their feature module
- Each feature module owns its routes; `src/router/index.ts` spreads them all
- Pinia stores use the **Setup Store** style (`defineStore` with `ref`/`computed`)
- Use the `@/` alias for all absolute imports (e.g. `@/modules/inflation/inflation.vue`)
- TypeScript contracts (interfaces, types) go in the feature's `domain/` folder
- All UI text must go through `useI18n` — no hardcoded strings in templates
- FA icons are added to the library in `src/plugins/fontawesome.ts`; use `<FontAwesomeIcon icon="icon-name" />`. Both en-US.ts and pt-BR.ts must be kept in sync — every new key gets both languages
- Translation keys are namespaced by feature (e.g. `inflation.title`, `aiRecommendation.tierConservative`)
- Storybook stories live alongside the component; global plugins are registered in `.storybook/preview.ts`
- Every interactive element must have `cursor-pointer`
- README.md must be kept in sync with every feature change (user feedback rule)

## Commands

```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # vue-tsc -b && vite build  — see "Build issue" below
npm run preview          # Preview production build
npm run storybook        # Start Storybook (http://localhost:6006)
npm run build-storybook  # Build static Storybook
```

### Build issue (active, not from this session's changes)

`npm run build` currently fails with `error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0` from `tsconfig.app.json`. This is pre-existing on master and unrelated to feature work.

Workarounds for type-checking and bundling:

```bash
npx vite build                                                # production bundle (skips vue-tsc)
npx vue-tsc --noEmit --ignoreDeprecations 6.0 -p tsconfig.app.json   # type-check only
```

The proper fix is to add `"ignoreDeprecations": "6.0"` to `tsconfig.app.json` or migrate off `baseUrl` to `paths` only — outside the scope of feature tasks but worth a separate cleanup.

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

- **TTM payout ratios > 100% are normal for EU large-caps** in transition years (BAS.DE 140%, ENEL.MI 121%, ORA.PA 625% in periods of EBIT compression while the dividend is maintained). Don't tighten Permissive thresholds below `maxPayout: 1.5` (1.75 for utilities/REITs) without expecting the survivor count to collapse.
- **Yahoo `dividendYield` can be 0 even when the stock pays** (when both `summaryDetail.dividendYield` and `trailingAnnualDividendYield` are null). If this becomes a problem, add a fallback: `annualDividend / currentPrice`.
- **Gemini free tier is 5 rpm** — `generate-recommendations.mjs` fans out 10 narrative calls in parallel via `Promise.all`, which exceeds this. The script catches 429s and uses a generic-fallback narrative for the failing pick. The retry-with-backoff loop is too short to wait out a full minute. Acceptable for now (most calls succeed); fix if every pick must have a custom narrative.
- **Always run scripts from the project root**, not `/tmp` — they import from `./eu-dividend-universe.mjs` and use `yahoo-finance2` from local `node_modules`.
- **`dividendStreak` is capped at 5** by design — the metric is computed over a 5-year window of `dividendsPerYear`. Setting `minStreak: 6+` on any tier would make it unsatisfiable.
- **Logos are committed under `public/logos/`** and served same-origin via Netlify (no Firebase Storage). After running `update-logo.mjs` or `bulk-fetch-spine-logos.mjs`, you must `git add public/logos/<TICKER>.<ext> && git push` to trigger a Netlify rebuild for the file to appear at `/logos/<TICKER>.<ext>`.

## Current Focus

P2 of the AI-recommendations roadmap (in README.md):
- ✅ Per-pick strategy tier badges (Conservative / Moderate / Permissive) on list + detail
- ✅ Exact dividend payout dates per year
- ✅ Streak/Permissive fixes — selection now reliably delivers 10 mixed-tier picks
- ⏳ Inflation comparison on AI picks (next): show per-pick country HICP and headline real-yield (nominal − inflation)

## Known Issues / TODOs

Carried from README.md (only items not addressed yet):

- `aiRecommendation.refreshesDaily` i18n string still says "8:00 UTC" but cron runs at 02:00 UTC
- 90-day earnings revisions and forward P/E vs sector median — skipped (data not freely available)
- Monthly review of `eu-dividend-universe.mjs` is a manual maintenance task
- P3 / P4 items: withholding-tax surfacing, total-return view, ex-dividend dates, structured thesis, correctness gate before Firestore write
- P5: monthly-dividend strategy module (global markets, not just EU)
