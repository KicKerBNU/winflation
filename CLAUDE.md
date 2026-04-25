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
- **Google Gemini** (`gemini-flash-latest` — AI economic briefings and company history)
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
└── generate-recommendations.mjs   # Daily Gemini → Firestore job

.github/workflows/
└── ai-daily-recommendations.yml   # Cron: 08:00 UTC daily
```

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
