import type { Mineral, MineralCountry } from '../domain/minerals.types'

// Data source of truth for the Minerals feature.
// Refreshed monthly by a scheduled Claude agent — see docs/minerals-schedule.md
// Last reviewed: 2026-04-24
export const MINERALS_DATA_AS_OF = '2026-04-24'

export const MINERALS: Mineral[] = [
  {
    symbol: 'Nd',
    nameKey: 'minerals.entries.Nd.name',
    descriptionKey: 'minerals.entries.Nd.description',
    useKey: 'minerals.entries.Nd.use',
    category: 'magnet',
  },
  {
    symbol: 'Pr',
    nameKey: 'minerals.entries.Pr.name',
    descriptionKey: 'minerals.entries.Pr.description',
    useKey: 'minerals.entries.Pr.use',
    category: 'magnet',
  },
  {
    symbol: 'Dy',
    nameKey: 'minerals.entries.Dy.name',
    descriptionKey: 'minerals.entries.Dy.description',
    useKey: 'minerals.entries.Dy.use',
    category: 'magnet',
  },
  {
    symbol: 'Tb',
    nameKey: 'minerals.entries.Tb.name',
    descriptionKey: 'minerals.entries.Tb.description',
    useKey: 'minerals.entries.Tb.use',
    category: 'magnet',
  },
  {
    symbol: 'Li',
    nameKey: 'minerals.entries.Li.name',
    descriptionKey: 'minerals.entries.Li.description',
    useKey: 'minerals.entries.Li.use',
    category: 'battery',
  },
  {
    symbol: 'Co',
    nameKey: 'minerals.entries.Co.name',
    descriptionKey: 'minerals.entries.Co.description',
    useKey: 'minerals.entries.Co.use',
    category: 'battery',
  },
  {
    symbol: 'Graphite',
    nameKey: 'minerals.entries.Graphite.name',
    descriptionKey: 'minerals.entries.Graphite.description',
    useKey: 'minerals.entries.Graphite.use',
    category: 'battery',
  },
  {
    symbol: 'La',
    nameKey: 'minerals.entries.La.name',
    descriptionKey: 'minerals.entries.La.description',
    useKey: 'minerals.entries.La.use',
    category: 'other',
  },
  {
    symbol: 'Ce',
    nameKey: 'minerals.entries.Ce.name',
    descriptionKey: 'minerals.entries.Ce.description',
    useKey: 'minerals.entries.Ce.use',
    category: 'other',
  },
  {
    symbol: 'Monazite',
    nameKey: 'minerals.entries.Monazite.name',
    descriptionKey: 'minerals.entries.Monazite.description',
    useKey: 'minerals.entries.Monazite.use',
    category: 'other',
  },
]

export const MINERAL_COUNTRIES: MineralCountry[] = [
  {
    countryCode: 'CN',
    nameKey: 'minerals.countries.CN.name',
    lat: 35.8617,
    lng: 104.1954,
    statusKey: 'minerals.countries.CN.status',
    minerals: ['Nd', 'Pr', 'Dy', 'Tb', 'La', 'Graphite'],
    companies: [
      {
        name: 'China Rare Earth Group',
        descriptionKey: 'minerals.countries.CN.companies.chinaRareEarthGroup',
      },
      {
        name: 'Shenghe Resources',
        descriptionKey: 'minerals.countries.CN.companies.shengheResources',
      },
    ],
  },
  {
    countryCode: 'VN',
    nameKey: 'minerals.countries.VN.name',
    lat: 14.0583,
    lng: 108.2772,
    statusKey: 'minerals.countries.VN.status',
    minerals: ['Nd', 'Pr', 'Dy'],
    companies: [
      {
        name: 'Vietnam Rare Earth JSC (VTRE)',
        descriptionKey: 'minerals.countries.VN.companies.vtre',
      },
      {
        name: 'Blackstone Minerals',
        descriptionKey: 'minerals.countries.VN.companies.blackstone',
      },
    ],
  },
  {
    countryCode: 'BR',
    nameKey: 'minerals.countries.BR.name',
    lat: -14.2350,
    lng: -51.9253,
    statusKey: 'minerals.countries.BR.status',
    minerals: ['Nd', 'Pr', 'Tb', 'Dy'],
    companies: [
      {
        name: 'Serra Verde',
        descriptionKey: 'minerals.countries.BR.companies.serraVerde',
      },
      {
        name: 'Appia Rare Earths & Uranium',
        descriptionKey: 'minerals.countries.BR.companies.appia',
      },
    ],
  },
  {
    countryCode: 'AU',
    nameKey: 'minerals.countries.AU.name',
    lat: -25.2744,
    lng: 133.7751,
    statusKey: 'minerals.countries.AU.status',
    minerals: ['Nd', 'Pr', 'La'],
    companies: [
      {
        name: 'Lynas Rare Earths',
        descriptionKey: 'minerals.countries.AU.companies.lynas.description',
        financials: {
          stage: 'producer',
          ticker: 'ASX: LYC',
          profitability: 'profitable',
          netIncome: '$80.2M (H1 FY26)',
          revenueGrowthYoY: '+63%',
          dividend: 'none',
          mineLife: '20+ years',
          riskLevel: 'low',
          catalystKey: 'minerals.countries.AU.companies.lynas.catalyst',
          contractsKey: 'minerals.countries.AU.companies.lynas.contracts',
        },
      },
      {
        name: 'Iluka Resources',
        descriptionKey: 'minerals.countries.AU.companies.iluka',
      },
    ],
  },
  {
    countryCode: 'US',
    nameKey: 'minerals.countries.US.name',
    lat: 39.8283,
    lng: -98.5795,
    statusKey: 'minerals.countries.US.status',
    minerals: ['Nd', 'Pr'],
    companies: [
      {
        name: 'MP Materials',
        descriptionKey: 'minerals.countries.US.companies.mpMaterials.description',
        financials: {
          stage: 'producer',
          ticker: 'NYSE: MP',
          profitability: 'profitable',
          netIncome: '$9.4M (Q4 2025)',
          revenueGrowthYoY: '+10%',
          dividend: 'none',
          mineLife: 'Decades',
          riskLevel: 'moderate',
          catalystKey: 'minerals.countries.US.companies.mpMaterials.catalyst',
          contractsKey: 'minerals.countries.US.companies.mpMaterials.contracts',
        },
      },
      {
        name: 'USA Rare Earth',
        descriptionKey: 'minerals.countries.US.companies.usaRareEarth.description',
        financials: {
          stage: 'producer',
          profitability: 'transitioning',
          dividend: 'none',
          mineLife: '25 years',
          riskLevel: 'moderate',
          catalystKey: 'minerals.countries.US.companies.usaRareEarth.catalyst',
          contractsKey: 'minerals.countries.US.companies.usaRareEarth.contracts',
        },
      },
    ],
  },
  {
    countryCode: 'IN',
    nameKey: 'minerals.countries.IN.name',
    lat: 20.5937,
    lng: 78.9629,
    statusKey: 'minerals.countries.IN.status',
    minerals: ['Monazite'],
    companies: [],
  },
  {
    countryCode: 'CA',
    nameKey: 'minerals.countries.CA.name',
    lat: 56.1304,
    lng: -106.3468,
    statusKey: 'minerals.countries.CA.status',
    minerals: ['Li', 'Nd', 'Pr'],
    companies: [
      {
        name: 'Vital Metals',
        descriptionKey: 'minerals.countries.CA.companies.vitalMetals',
      },
      {
        name: 'Neo Performance Materials',
        descriptionKey: 'minerals.countries.CA.companies.neo',
      },
    ],
  },
  {
    countryCode: 'ZA',
    nameKey: 'minerals.countries.ZA.name',
    lat: -30.5595,
    lng: 22.9375,
    statusKey: 'minerals.countries.ZA.status',
    minerals: ['Nd', 'Pr', 'Dy', 'Tb'],
    companies: [
      {
        name: 'Steenkampskraal Monazite Mine (SMM)',
        descriptionKey: 'minerals.countries.ZA.companies.smm',
      },
    ],
  },
  {
    countryCode: 'MW',
    nameKey: 'minerals.countries.MW.name',
    lat: -13.2543,
    lng: 34.3015,
    statusKey: 'minerals.countries.MW.status',
    minerals: ['Nd', 'Pr'],
    companies: [
      {
        name: 'Mkango Resources',
        descriptionKey: 'minerals.countries.MW.companies.mkango.description',
        financials: {
          stage: 'developer',
          ticker: 'TSX-V: MKA',
          profitability: 'not-yet',
          dividend: 'none',
          mineLife: '18 years',
          riskLevel: 'high',
          catalystKey: 'minerals.countries.MW.companies.mkango.catalyst',
          contractsKey: 'minerals.countries.MW.companies.mkango.contracts',
        },
      },
    ],
  },
  {
    countryCode: 'NA',
    nameKey: 'minerals.countries.NA.name',
    lat: -22.9576,
    lng: 18.4904,
    statusKey: 'minerals.countries.NA.status',
    minerals: ['Dy', 'Tb'],
    companies: [
      {
        name: 'Bannerman Energy',
        descriptionKey: 'minerals.countries.NA.companies.bannerman',
      },
      {
        name: 'Namibia Critical Metals',
        descriptionKey: 'minerals.countries.NA.companies.ncm',
      },
    ],
  },
  {
    countryCode: 'BI',
    nameKey: 'minerals.countries.BI.name',
    lat: -3.3731,
    lng: 29.9189,
    statusKey: 'minerals.countries.BI.status',
    minerals: ['La', 'Ce', 'Nd'],
    companies: [
      {
        name: 'Rainbow Rare Earths',
        descriptionKey: 'minerals.countries.BI.companies.rainbow.description',
        financials: {
          stage: 'developer',
          ticker: 'LSE: RBW',
          profitability: 'not-yet',
          dividend: 'none',
          mineLife: '16 years',
          riskLevel: 'high',
          catalystKey: 'minerals.countries.BI.companies.rainbow.catalyst',
          contractsKey: 'minerals.countries.BI.companies.rainbow.contracts',
        },
      },
    ],
  },
  {
    countryCode: 'CD',
    nameKey: 'minerals.countries.CD.name',
    lat: -4.0383,
    lng: 21.7587,
    statusKey: 'minerals.countries.CD.status',
    minerals: ['Co'],
    companies: [
      {
        name: 'Glencore',
        descriptionKey: 'minerals.countries.CD.companies.glencore',
      },
      {
        name: 'CMOC Group',
        descriptionKey: 'minerals.countries.CD.companies.cmoc',
      },
    ],
  },
  {
    countryCode: 'ML',
    nameKey: 'minerals.countries.ML.name',
    lat: 17.5707,
    lng: -3.9962,
    statusKey: 'minerals.countries.ML.status',
    minerals: ['Li'],
    companies: [
      {
        name: 'Ganfeng Lithium',
        descriptionKey: 'minerals.countries.ML.companies.ganfeng',
      },
      {
        name: 'Leo Lithium',
        descriptionKey: 'minerals.countries.ML.companies.leoLithium',
      },
    ],
  },
]
