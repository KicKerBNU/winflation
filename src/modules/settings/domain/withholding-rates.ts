// Statutory dividend withholding-tax rates and bilateral treaty caps for EU-27
// residents investing in EU-27 + US, UK, Switzerland.
//
// Encoding:
//   - statutoryRate is the rate the source country withholds from any
//     non-resident retail investor by default.
//   - euTreatyRate is the rate that applies to any EU-27 resident under the
//     bilateral DTA, assuming the investor has filed the required paperwork
//     (W-8BEN for US, Form 86 for CH, residency certificate for most EU
//     pairs). null = no treaty reduction available; statutory still applies.
//   - treatyOverrides covers the rare bilateral exceptions where a specific
//     user-country pair gets a different treaty rate than the EU default.
//   - reclaimNote describes the mechanics: applied at source vs. claim-back.
//
// Rates as of 2026-04-27. Verify with primary tax-authority sources before
// acting — treaties are renegotiated and statutory rates change.
//
// Source-country WHT applies to dividends *paid out* of that country. UK is
// a notable outlier: it does not withhold tax on most ordinary dividends to
// non-residents at all.

export const WHT_LAST_REVIEWED = '2026-04-27'

export interface WhtSourceCountry {
  code: string
  name: string
  statutoryRate: number          // 0-1, applied at source by default
  euTreatyRate: number | null    // 0-1; treaty cap for any EU-27 resident with paperwork (null = no reduction)
  treatyOverrides?: Record<string, number>  // user-country code → bilateral treaty rate (overrides euTreatyRate)
  reclaimAtSource?: boolean      // true: broker applies treaty rate at source; false: investor must reclaim post-hoc
  reclaimNote?: string           // one-line mechanics summary
}

export interface WhtPairResult {
  statutory: number
  treaty: number | null  // effective treaty rate for this user; null if no treaty benefit
  reclaimAtSource: boolean
  reclaimNote?: string
}

// ──────────────────────────────────────────────────────────────────────────
// 27 EU + US, UK, CH source countries
// ──────────────────────────────────────────────────────────────────────────
export const WHT_SOURCES: WhtSourceCountry[] = [
  // Austria — DTA caps at 15% for most EU residents; refund of excess via Austrian tax authority
  {
    code: 'AT', name: 'Austria',
    statutoryRate: 0.275, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 12.5% via Austrian Federal Ministry of Finance with residency certificate.',
  },
  // Belgium — 30% statutory, treaty cap 15% (most EU); refund process via Form 276 Div.
  {
    code: 'BE', name: 'Belgium',
    statutoryRate: 0.30, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim excess via Form 276 Div. Some brokers apply treaty rate at source for partner banks.',
  },
  // Bulgaria — already low statutory; treaty doesn't reduce it
  {
    code: 'BG', name: 'Bulgaria',
    statutoryRate: 0.05, euTreatyRate: null,
    reclaimAtSource: true,
    reclaimNote: 'Statutory rate is below most treaty caps; applied at source.',
  },
  // Croatia — 12% statutory; treaty doesn't help
  {
    code: 'HR', name: 'Croatia',
    statutoryRate: 0.12, euTreatyRate: null,
    reclaimAtSource: true,
  },
  // Cyprus — 0% on outbound dividends to non-residents
  {
    code: 'CY', name: 'Cyprus',
    statutoryRate: 0, euTreatyRate: null,
    reclaimAtSource: true,
    reclaimNote: 'Cyprus does not withhold on dividends paid to non-residents.',
  },
  // Czech Republic — 15% to non-residents from treaty countries; otherwise 35%
  {
    code: 'CZ', name: 'Czechia',
    statutoryRate: 0.15, euTreatyRate: 0.15,
    reclaimAtSource: true,
  },
  // Denmark — 27% statutory; treaty 15%; reclaim via skat.dk (slow)
  {
    code: 'DK', name: 'Denmark',
    statutoryRate: 0.27, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 12% via Skat (Danish tax authority). Process can take 2+ years; backlog is significant.',
  },
  // Estonia — Estonia generally does not levy WHT on dividends paid to non-residents (corporate income already taxed at distribution)
  {
    code: 'EE', name: 'Estonia',
    statutoryRate: 0, euTreatyRate: null,
    reclaimAtSource: true,
    reclaimNote: 'Estonia generally does not withhold on dividends; corporate income tax already paid at distribution.',
  },
  // Finland — 35% statutory for unidentified non-residents; 15% with proper documentation
  {
    code: 'FI', name: 'Finland',
    statutoryRate: 0.35, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Default 35% applies if broker has not identified you as non-resident; treaty rate via residency certificate or refund.',
  },
  // France — 25% statutory non-resident rate (PFU 12.8% optional for some); treaty 15% for EU residents
  {
    code: 'FR', name: 'France',
    statutoryRate: 0.25, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim via Form 5000 (residency certificate) and 5001 (specific dividend); refund typically within 1 year.',
  },
  // Germany — 26.375% (25% + 5.5% solidarity); treaty 15%
  {
    code: 'DE', name: 'Germany',
    statutoryRate: 0.26375, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 11.375% via Bundeszentralamt für Steuern (BZSt). Refund process typically 6-12 months.',
  },
  // Greece — 5% statutory; treaty doesn't help
  {
    code: 'GR', name: 'Greece',
    statutoryRate: 0.05, euTreatyRate: null,
    reclaimAtSource: true,
  },
  // Hungary — 15% statutory for non-residents; treaty caps at the same
  {
    code: 'HU', name: 'Hungary',
    statutoryRate: 0.15, euTreatyRate: 0.15,
    reclaimAtSource: true,
  },
  // Ireland — 25% statutory; many EU treaties 0-15%; some brokers apply treaty rate at source with W-8BEN-equivalent
  {
    code: 'IE', name: 'Ireland',
    statutoryRate: 0.25, euTreatyRate: 0.15,
    treatyOverrides: { CY: 0, MT: 0 },
    reclaimAtSource: false,
    reclaimNote: 'Reclaim via Form IC1 or claim DWT exemption upfront with broker (Irish revenue.ie). Some EU pairs reduce to 0%.',
  },
  // Italy — 26% statutory; treaty 15%
  {
    code: 'IT', name: 'Italy',
    statutoryRate: 0.26, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 11% via Form 26-Quater + residency certificate. Refund typically 12-24 months.',
  },
  // Latvia — 0% to non-residents in non-blacklist jurisdictions
  {
    code: 'LV', name: 'Latvia',
    statutoryRate: 0, euTreatyRate: null,
    reclaimAtSource: true,
    reclaimNote: 'Latvia does not withhold on dividends to non-residents from non-blacklist countries.',
  },
  // Lithuania — 15% statutory; treaty caps at the same (no benefit)
  {
    code: 'LT', name: 'Lithuania',
    statutoryRate: 0.15, euTreatyRate: 0.15,
    reclaimAtSource: true,
  },
  // Luxembourg — 15% statutory; treaty 15% (no benefit)
  {
    code: 'LU', name: 'Luxembourg',
    statutoryRate: 0.15, euTreatyRate: 0.15,
    reclaimAtSource: true,
  },
  // Malta — full imputation system; effectively 0% on outbound dividends
  {
    code: 'MT', name: 'Malta',
    statutoryRate: 0, euTreatyRate: null,
    reclaimAtSource: true,
    reclaimNote: 'Malta operates a full-imputation system; outbound dividends to non-residents are effectively untaxed at source.',
  },
  // Netherlands — 15% statutory; treaty 15% (no benefit for EU residents)
  {
    code: 'NL', name: 'Netherlands',
    statutoryRate: 0.15, euTreatyRate: 0.15,
    reclaimAtSource: true,
  },
  // Poland — 19% statutory; treaty 15%
  {
    code: 'PL', name: 'Poland',
    statutoryRate: 0.19, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 4% via Polish tax authority with residency certificate.',
  },
  // Portugal — 25% statutory non-resident; treaty 15%
  {
    code: 'PT', name: 'Portugal',
    statutoryRate: 0.25, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 10% via Form 21-RFI + residency certificate. Refund typically within 1-2 years.',
  },
  // Romania — 8% statutory; treaty 5% for some pairs but mostly 8% applies
  {
    code: 'RO', name: 'Romania',
    statutoryRate: 0.08, euTreatyRate: null,
    reclaimAtSource: true,
  },
  // Slovakia — 7% statutory; treaty doesn't help
  {
    code: 'SK', name: 'Slovakia',
    statutoryRate: 0.07, euTreatyRate: null,
    reclaimAtSource: true,
  },
  // Slovenia — 25% statutory; treaty 15%
  {
    code: 'SI', name: 'Slovenia',
    statutoryRate: 0.25, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 10% via Form KIDO 9 + residency certificate.',
  },
  // Spain — 19% statutory; treaty 15%
  {
    code: 'ES', name: 'Spain',
    statutoryRate: 0.19, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 4% via Form 210 + residency certificate within 4 years.',
  },
  // Sweden — 30% statutory; treaty 15%
  {
    code: 'SE', name: 'Sweden',
    statutoryRate: 0.30, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 15% via Form SKV 3740. Refund process typically 6-12 months.',
  },

  // ── Non-EU sources reachable by EU investors ───────────────────────────
  // United States — 30% statutory; W-8BEN reduces to 15% for most EU treaty partners; some bilateral specifics
  {
    code: 'US', name: 'United States',
    statutoryRate: 0.30, euTreatyRate: 0.15,
    treatyOverrides: {
      // US-Bulgaria DTA: 10% (lower than EU default)
      BG: 0.10,
      // US-Hungary DTA was terminated; revert to statutory 30%
      HU: 0.30,
    },
    reclaimAtSource: true,
    reclaimNote: 'File W-8BEN with your broker to apply treaty rate at source. Most EU brokers handle this automatically.',
  },
  // United Kingdom — UK does NOT withhold on most ordinary dividends paid to non-residents. Effectively 0%.
  {
    code: 'GB', name: 'United Kingdom',
    statutoryRate: 0, euTreatyRate: null,
    reclaimAtSource: true,
    reclaimNote: 'UK does not withhold tax on most ordinary dividends paid to non-resident shareholders.',
  },
  // Switzerland — 35% statutory; treaty 15% for most EU; reclaim via Form 86
  {
    code: 'CH', name: 'Switzerland',
    statutoryRate: 0.35, euTreatyRate: 0.15,
    reclaimAtSource: false,
    reclaimNote: 'Reclaim 20% via Swiss Form 86 within 3 years. Process typically 12-18 months.',
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Lookups
// ──────────────────────────────────────────────────────────────────────────
export function getWhtForPair(sourceCode: string, userCountryCode: string): WhtPairResult | null {
  const src = WHT_SOURCES.find((s) => s.code === sourceCode)
  if (!src) return null
  const treaty = src.treatyOverrides?.[userCountryCode] ?? src.euTreatyRate
  return {
    statutory: src.statutoryRate,
    // If treaty >= statutory, treaty offers no benefit — surface as null so the UI
    // doesn't say "reduced to 30% with paperwork" when statutory is 30%.
    treaty: treaty != null && treaty < src.statutoryRate ? treaty : null,
    reclaimAtSource: src.reclaimAtSource ?? false,
    reclaimNote: src.reclaimNote,
  }
}
