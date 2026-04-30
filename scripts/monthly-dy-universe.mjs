// Curated universe of monthly-paying dividend instruments accessible to
// EU-based retail investors via standard EU brokerages (Interactive Brokers,
// DEGIRO, Trade Republic, etc).
//
// Scope: US-listed + TSX-listed equities/REITs/BDCs/mREITs.
// Out of scope: Asia-Pacific listings, US-listed ETFs (most are not UCITS-
// compliant and EU brokers won't let retail buy them under PRIIPs/MiFID II),
// CEFs, MLPs (quarterly anyway), bonds.
//
// `assetClass` drives the deterministic risk-tier assignment in
// generate-monthly-dy.mjs. Edit this file when adding/removing tickers.
//
// Maintenance: review monthly. Drop names that have cut distributions or moved
// off monthly schedule. Add new monthly-payers when they establish a track
// record (≥ 12 months on monthly cadence).

export const MONTHLY_DY_UNIVERSE = [
  // ── US Equity REITs (low risk: established, blue-chip property cash flows) ──
  { ticker: 'O',     assetClass: 'equity-reit', notes: 'Realty Income — net-lease retail/industrial REIT, "The Monthly Dividend Company"' },
  { ticker: 'STAG',  assetClass: 'equity-reit', notes: 'STAG Industrial — single-tenant industrial' },
  { ticker: 'ADC',   assetClass: 'equity-reit', notes: 'Agree Realty — net-lease retail' },
  { ticker: 'EPR',   assetClass: 'equity-reit', notes: 'EPR Properties — entertainment / experiential' },
  { ticker: 'LTC',   assetClass: 'equity-reit', notes: 'LTC Properties — senior housing & skilled nursing' },
  { ticker: 'APLE',  assetClass: 'equity-reit', notes: 'Apple Hospitality — hotel REIT' },
  { ticker: 'MDV',   assetClass: 'equity-reit', notes: 'Modiv Inc. — diversified single-tenant' },
  { ticker: 'GOOD',  assetClass: 'equity-reit', notes: 'Gladstone Commercial — single-tenant office/industrial' },
  { ticker: 'PECO',  assetClass: 'equity-reit', notes: 'Phillips Edison — grocery-anchored neighborhood centers' },

  // ── US BDCs (medium risk: middle-market lending, leverage, regulated) ──
  { ticker: 'MAIN',  assetClass: 'bdc', notes: 'Main Street Capital — internally-managed BDC' },
  { ticker: 'GAIN',  assetClass: 'bdc', notes: 'Gladstone Investment — buyout-focused BDC' },
  { ticker: 'PSEC',  assetClass: 'bdc', notes: 'Prospect Capital — diversified BDC' },
  { ticker: 'PFLT',  assetClass: 'bdc', notes: 'PennantPark Floating Rate Capital — floating-rate senior loans' },
  { ticker: 'SCM',   assetClass: 'bdc', notes: 'Stellus Capital — middle-market direct lending' },
  { ticker: 'OXSQ',  assetClass: 'bdc', notes: 'Oxford Square Capital — CLO-heavy BDC' },

  // ── US mortgage REITs (HIGH risk: leveraged duration bets, distribution cuts common) ──
  // Note: NLY (Annaly) was historically monthly but moved to quarterly distributions in 2017 — excluded.
  { ticker: 'AGNC',  assetClass: 'mortgage-reit', notes: 'AGNC Investment — agency MBS' },
  { ticker: 'DX',    assetClass: 'mortgage-reit', notes: 'Dynex Capital — agency MBS' },
  { ticker: 'ORC',   assetClass: 'mortgage-reit', notes: 'Orchid Island Capital — agency MBS, very high yield' },
  { ticker: 'EARN',  assetClass: 'mortgage-reit', notes: 'Ellington Residential — agency + non-agency MBS' },
  { ticker: 'ARR',   assetClass: 'mortgage-reit', notes: 'ARMOUR Residential — agency MBS' },

  // ── Canadian REITs (TSX, monthly distributions; access depends on broker) ──
  { ticker: 'REI-UN.TO', assetClass: 'equity-reit', notes: 'RioCan REIT — diversified retail' },
  { ticker: 'CAR-UN.TO', assetClass: 'equity-reit', notes: 'Canadian Apartment Properties REIT' },
  { ticker: 'HR-UN.TO',  assetClass: 'equity-reit', notes: 'H&R REIT — diversified office/retail/residential' },
  { ticker: 'SRU-UN.TO', assetClass: 'equity-reit', notes: 'SmartCentres REIT — Walmart-anchored' },
  { ticker: 'GRT-UN.TO', assetClass: 'equity-reit', notes: 'Granite REIT — industrial' },
  { ticker: 'CHP-UN.TO', assetClass: 'equity-reit', notes: 'Choice Properties REIT — Loblaw-anchored' },
  { ticker: 'AP-UN.TO',  assetClass: 'equity-reit', notes: 'Allied Properties REIT — urban office' },
  { ticker: 'NWH-UN.TO', assetClass: 'equity-reit', notes: 'NorthWest Healthcare Properties REIT' },
  { ticker: 'BEI-UN.TO', assetClass: 'equity-reit', notes: 'Boardwalk REIT — multi-family residential' },

  // ── Canadian dividend stocks (monthly distributors, medium risk) ──
  // Note: Pembina Pipeline (PPL.TO / PBA) moved to quarterly distributions in 2022 — excluded.
  { ticker: 'EIF.TO', assetClass: 'stock', notes: 'Exchange Income Corp — diversified aviation + manufacturing' },
]

export function tickersOnly() {
  return MONTHLY_DY_UNIVERSE.map((u) => u.ticker)
}
