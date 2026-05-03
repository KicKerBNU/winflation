// Curated universe of quarterly-paying dividend stocks accessible to EU-based
// retail investors via standard brokerages (IBKR, DEGIRO, Trade Republic, etc).
//
// Scope: US, Canadian, and select UK/European large-caps with an established
// quarterly dividend cadence (3-5 payments verified in trailing 12 months by
// the cron script).
//
// `assetClass` drives the deterministic risk-tier assignment in
// generate-quarterly-dy.mjs:
//   dividend-aristocrat → low   (S&P 500 companies, 25+ consecutive years of increases)
//   utility             → low   (regulated utilities, predictable cash flows)
//   dividend-achiever   → medium (10-24 years of consecutive increases)
//   bank                → medium (large-cap financials)
//   energy              → medium (oil & gas majors, long dividend histories)
//   reit                → medium (quarterly-paying REITs, stable property cash flows)
//
// Maintenance: review quarterly. Drop names that have cut or moved off
// quarterly cadence. Add new quarterly payers once they establish a track
// record (≥ 12 months on quarterly cadence).

export const QUARTERLY_DY_UNIVERSE = [

  // ── US Dividend Aristocrats — 25+ consecutive years of increases (low risk) ──
  { ticker: 'JNJ',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Johnson & Johnson — 60+ years of increases; healthcare/consumer conglomerate' },
  { ticker: 'PG',    assetClass: 'dividend-aristocrat', region: 'US', notes: 'Procter & Gamble — 68 years; consumer staples powerhouse' },
  { ticker: 'KO',    assetClass: 'dividend-aristocrat', region: 'US', notes: 'Coca-Cola — 62 years; global beverage dominance' },
  { ticker: 'PEP',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'PepsiCo — 52 years; beverages + Frito-Lay snack diversification' },
  { ticker: 'ABBV',  assetClass: 'dividend-aristocrat', region: 'US', notes: 'AbbVie — combined Abbott heritage gives 51+ years; Humira/Skyrizi/Rinvoq pipeline' },
  { ticker: 'CL',    assetClass: 'dividend-aristocrat', region: 'US', notes: 'Colgate-Palmolive — 61 years; global oral/personal care' },
  { ticker: 'MCD',   assetClass: 'dividend-aristocrat', region: 'US', notes: "McDonald's — 48 years; franchise model generates resilient cash flow" },
  { ticker: 'ITW',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Illinois Tool Works — 60 years; diversified industrial portfolio' },
  { ticker: 'EMR',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Emerson Electric — 67 years; automation & process control' },
  { ticker: 'GPC',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Genuine Parts — 68 years; NAPA Auto Parts distribution network' },
  { ticker: 'APD',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Air Products & Chemicals — 43 years; industrial gases infrastructure moat' },
  { ticker: 'BDX',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Becton Dickinson — 52 years; medical devices & diagnostics' },
  { ticker: 'WMT',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Walmart — 51 years; retail scale + e-commerce pivot' },
  { ticker: 'CAT',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Caterpillar — 30 years; infrastructure/mining equipment cycle plays' },
  { ticker: 'SHW',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Sherwin-Williams — 45 years; paint & coatings pricing power' },
  { ticker: 'GWW',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'W.W. Grainger — 52 years; MRO supply chain distribution' },
  { ticker: 'ADP',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Automatic Data Processing — 50 years; payroll & HR software recurring revenue' },
  { ticker: 'XOM',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'ExxonMobil — 41 years; integrated energy supermajor; Pioneer acquisition' },
  { ticker: 'CVX',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'Chevron — 36 years; integrated energy; Hess acquisition pending' },
  { ticker: 'NEE',   assetClass: 'dividend-aristocrat', region: 'US', notes: 'NextEra Energy — 27 years; largest global renewable energy operator' },
  { ticker: 'LOW',   assetClass: 'dividend-aristocrat', region: 'US', notes: "Lowe's — 51 years; home improvement retail; professional segment growth" },

  // ── US Dividend Achievers — 10-24 consecutive years (medium risk) ──────────
  { ticker: 'MSFT',  assetClass: 'dividend-achiever', region: 'US', notes: 'Microsoft — 22 years; cloud (Azure) + AI (Copilot) compounding growth' },
  { ticker: 'AAPL',  assetClass: 'dividend-achiever', region: 'US', notes: 'Apple — 12 years; services flywheel; low yield but consistent increases' },
  { ticker: 'TXN',   assetClass: 'dividend-achiever', region: 'US', notes: 'Texas Instruments — 20 years; analog/embedded chips; strong FCF model' },
  { ticker: 'AVGO',  assetClass: 'dividend-achiever', region: 'US', notes: 'Broadcom — 14 years; networking silicon + VMware enterprise software mix' },
  { ticker: 'HON',   assetClass: 'dividend-achiever', region: 'US', notes: 'Honeywell — 14 years; industrial automation & aerospace; portfolio restructuring ongoing' },
  { ticker: 'V',     assetClass: 'dividend-achiever', region: 'US', notes: 'Visa — 15 years; payment network duopoly; low yield, high growth' },
  { ticker: 'MA',    assetClass: 'dividend-achiever', region: 'US', notes: 'Mastercard — 14 years; payment network; cross-border volume recovery' },

  // ── US Utilities (regulated, low-volatility cash flows) ────────────────────
  { ticker: 'DUK',   assetClass: 'utility', region: 'US', notes: 'Duke Energy — regulated utility serving Carolinas & Florida; grid modernisation capex' },
  { ticker: 'SO',    assetClass: 'utility', region: 'US', notes: 'Southern Company — regulated utility; Vogtle nuclear plant now complete' },
  { ticker: 'D',     assetClass: 'utility', region: 'US', notes: 'Dominion Energy — regulated utility; restructured portfolio post-2020' },

  // ── US Banks ────────────────────────────────────────────────────────────────
  { ticker: 'JPM',   assetClass: 'bank', region: 'US', notes: 'JPMorgan Chase — largest US bank by assets; diversified revenue across IB, retail, AWM' },
  { ticker: 'BAC',   assetClass: 'bank', region: 'US', notes: 'Bank of America — rate-sensitive balance sheet; consumer banking scale' },
  { ticker: 'WFC',   assetClass: 'bank', region: 'US', notes: 'Wells Fargo — recovering from asset cap; strong fee income potential when lifted' },

  // ── US REITs (quarterly distributions, stable property cash flows) ──────────
  { ticker: 'SPG',   assetClass: 'reit', region: 'US', notes: 'Simon Property Group — premier Class A mall REIT; luxury tenant mix resilient' },
  { ticker: 'PLD',   assetClass: 'reit', region: 'US', notes: 'Prologis — global logistics/industrial REIT; e-commerce and nearshoring tailwinds' },
  { ticker: 'AMT',   assetClass: 'reit', region: 'US', notes: 'American Tower — cell tower REIT; global wireless infrastructure; data centre expansion' },

  // ── Canadian Banks (quarterly cadence, strong capital ratios) ──────────────
  { ticker: 'RY',    assetClass: 'bank', region: 'CA', notes: 'Royal Bank of Canada — largest Canadian bank; HSBC Canada acquisition completed' },
  { ticker: 'TD',    assetClass: 'bank', region: 'CA', notes: 'TD Bank — significant US retail banking footprint; AML remediation ongoing' },
  { ticker: 'BNS',   assetClass: 'bank', region: 'CA', notes: 'Bank of Nova Scotia — highest international LatAm/Pacific Alliance exposure of Big Five' },
  { ticker: 'BMO',   assetClass: 'bank', region: 'CA', notes: 'Bank of Montreal — Bank of the West (US) acquisition integrating; Midwest exposure' },
  { ticker: 'CM',    assetClass: 'bank', region: 'CA', notes: 'Canadian Imperial Bank (CIBC) — domestic-focused; improving US private banking' },

  // ── Canadian Energy & Infrastructure (quarterly, strong FCF) ───────────────
  { ticker: 'ENB',   assetClass: 'energy', region: 'CA', notes: 'Enbridge — North American pipeline network; 29 years of consecutive increases' },
  { ticker: 'TRP',   assetClass: 'energy', region: 'CA', notes: 'TC Energy — natural gas pipelines + power; spin-off of South Bow completed 2024' },
  { ticker: 'CNQ',   assetClass: 'energy', region: 'CA', notes: 'Canadian Natural Resources — long-life oil sands; 24 consecutive years of increases' },

  // ── Canadian Utilities ─────────────────────────────────────────────────────
  { ticker: 'FTS',   assetClass: 'utility', region: 'CA', notes: 'Fortis — regulated utility across Canada/US/Caribbean; 50 consecutive years of increases' },

  // ── UK/European quarterly payers ───────────────────────────────────────────
  { ticker: 'HSBA.L', assetClass: 'bank',               region: 'UK', notes: 'HSBC Holdings — global bank pivoted to Asia; quarterly dividends since 2021' },
  { ticker: 'SHEL.L', assetClass: 'energy',             region: 'UK', notes: 'Shell plc — integrated energy supermajor; quarterly dividend + buyback programme' },
  { ticker: 'BP.L',   assetClass: 'energy',             region: 'UK', notes: 'BP plc — integrated energy; quarterly dividend; lower-carbon transition strategy' },
  { ticker: 'ULVR.L', assetClass: 'dividend-achiever',  region: 'UK', notes: 'Unilever — consumer staples; four quarterly dividends/year; emerging markets exposure' },
]

export function tickersOnly() {
  return QUARTERLY_DY_UNIVERSE.map((u) => u.ticker)
}
