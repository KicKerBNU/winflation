# Project Overview

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
- **Firebase** (Firestore for AI recommendation cache, Analytics)
- **Google Gemini** (`gemini-flash-latest` — AI economic briefings; AI Picks ticker selection + pro/con narrative only, never numeric data)
- **Yahoo Finance** (`yahoo-finance2` npm, server-side cron only — primary numeric source for AI Picks: price, market cap, 5y dividend history)
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

All under `scripts/`. Each requires `FIREBASE_SERVICE_ACCOUNT` (and `GEMINI_API_KEY` where the script calls Gemini) as env vars.

- `update-logo.mjs <TICKER> <URL>` — replace one ticker's logo. Writes the file to `public/logos/<TICKER>.<ext>` (Netlify serves it same-origin at `/logos/<TICKER>.<ext>`), updates `logos/<TICKER>` Firestore doc, and patches `ai-recommendations/latest`. Requires a `git push` afterward to trigger a Netlify rebuild — Firebase Storage is **not** used (the project is on Spark/free, no Blaze plan).
- `bulk-fetch-spine-logos.mjs` — one-time backfill of every ticker in `eu-dividend-universe.mjs`. Same per-ticker logic as `update-logo.mjs` but loops the whole SPINE list. Skips tickers that already have a file in `public/logos/` unless `--force`. Uses Yahoo profile → Gemini suggestion → Clearbit → favicon fallback chain. Run after editing the spine list to pre-populate logos for new additions.
- `fetch-company-logos.mjs` — re-resolves logos for every company currently in `ai-recommendations/latest` via Gemini + fallback chain.
- `generate-recommendations.mjs` — daily quality-screened pipeline.
  - **Candidate pool**: curated `SPINE` from `eu-dividend-universe.mjs` + Gemini-suggested watch list (~10 names beyond the spine).
  - **Enrichment**: Yahoo Finance for quote, profile, `financialData` (TTM payout, ROE, debt, EBITDA, FCF), and 5-year dividend history. FMP `/stable/profile` is a fallback when Yahoo fails for a specific ticker.
  - **Quality metrics**: payout ratio, debt/EBITDA, FCF coverage, ROE, dividend streak (years without > 30% cut), 5-year dividend CAGR.
  - **Cascading filter**: Conservative → Moderate → Permissive — the strictest tier with ≥ 10 survivors wins. Banks/insurers skip debt/EBITDA. Utilities/REITs get a higher payout cap.
  - **Composite Quality Score (0–10)**: sustainability 40% + growth 30% + profitability 20% + yield 10%.
  - **Diversification**: max 3 per sector, max 3 per country, greedy by score.
  - **Narratives**: Gemini writes pro/con/status per pick, with the actual computed metrics fed in as context.
  - **Persistence**: writes both `ai-recommendations/latest` and `ai-recommendations/<YYYY-MM-DD>` snapshot. Includes `qualityTier`, candidate counts at each stage, and sector/country distribution for transparency.
- `eu-dividend-universe.mjs` — the curated spine list. Plain string array of Yahoo-formatted tickers. Review monthly: drop names that have cut dividends or had quality deterioration; add new EU large-caps with established 5+ year records. Script tolerates the list shrinking or growing.

## Features

| Module | Routes | Purpose |
|--------|--------|---------|
| `dashboard` | `/` | Landing page with overview cards linking to every feature |
| `interest-rate` | `/interest-rate` | ECB key interest-rate history chart |
| `inflation` | `/inflation`, `/inflation/:countryCode` | HICP inflation across EU countries with per-country drill-down |
| `dividends` | `/dividends`, `/dividends/:ticker` | Dividend-paying stock list with per-company history and Gemini-generated company brief |
| `ai-recommendation` | `/ai-recommendation`, `/ai-recommendation/:ticker` | Daily Gemini-curated dividend picks read from Firestore cache |
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
- FA icons are added to the library in `src/plugins/fontawesome.ts`; use `<FontAwesomeIcon icon="icon-name" />`
- Translation keys are namespaced by feature (e.g. `inflation.title`)
- Storybook stories live alongside the component; global plugins are registered in `.storybook/preview.ts`
- Every interactive element must have `cursor-pointer`

## Commands

```bash
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Type-check + build
npm run preview       # Preview production build
npm run storybook     # Start Storybook (http://localhost:6006)
npm run build-storybook  # Build static Storybook
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
```
