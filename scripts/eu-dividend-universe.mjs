// Curated European large-cap dividend universe — the "spine" of AI Picks selection.
//
// Maintenance:
//   - Review monthly. Remove names that have cut dividends > 30% or had quality
//     deterioration (ROE collapse, debt/EBITDA blow-out, etc).
//   - Add new EU large-caps that have established a 5+ year dividend record.
//   - Aim for sector and country diversity — the diversification cap will pick
//     the best from each, but the universe itself should expose the algorithm
//     to a balanced pool.
//
// Ticker format: Yahoo Finance suffix (.MI, .PA, .DE, .MC, .AS, .BR, .L, .SW,
// .HE, .OL, .ST, .CO). The script resolves country/sector/exchange/currency
// from Yahoo's profile, so this list only needs the ticker.
export const SPINE = [
  // Italy
  'ENEL.MI', 'ENI.MI', 'ISP.MI', 'G.MI', 'UCG.MI',
  // France
  'BNP.PA', 'ACA.PA', 'TTE.PA', 'ORA.PA', 'ENGI.PA',
  'CS.PA', 'SAN.PA', 'BN.PA', 'AI.PA',
  // Germany
  'ALV.DE', 'MUV2.DE', 'DTE.DE', 'BAS.DE', 'SIE.DE', 'HEN3.DE',
  // Spain
  'IBE.MC', 'SAN.MC', 'BBVA.MC', 'TEF.MC', 'MAP.MC', 'REP.MC',
  // Netherlands
  'INGA.AS', 'AD.AS', 'HEIA.AS', 'RAND.AS',
  // Belgium
  'ABI.BR', 'KBC.BR',
  // Switzerland
  'NESN.SW', 'ROG.SW', 'NOVN.SW', 'ZURN.SW',
  // United Kingdom
  'HSBA.L', 'LLOY.L', 'GSK.L', 'AZN.L', 'SHEL.L', 'BP.L',
  'ULVR.L', 'DGE.L', 'IMB.L',
  // Nordics
  'NDA-FI.HE', 'SAMPO.HE', 'EQNR.OL', 'TEL.OL', 'DNB.OL',
  'VOLV-B.ST', 'ABB.ST', 'ATCO-A.ST', 'SEB-A.ST', 'INVE-B.ST',
  'MAERSK-B.CO',
]
