import { GoogleGenerativeAI } from '@google/generative-ai'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const geminiKey = process.env.GEMINI_API_KEY
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

if (!geminiKey) throw new Error('Missing GEMINI_API_KEY')
if (!serviceAccount) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT')

// Init Firebase Admin
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// Init Gemini
const genAI = new GoogleGenerativeAI(geminiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

const today = new Date().toISOString().split('T')[0]

const prompt = `You are a financial data analyst specializing in European equity markets. Today is ${today}.

Return ONLY a raw JSON object. No markdown, no code fences, no explanation — just the JSON.

The JSON must follow this exact schema:
{
  "generatedAt": "<ISO-8601 datetime string for now>",
  "companies": [
    {
      "rank": 1,
      "ticker": "ENEL.MI",
      "company": "Enel SpA",
      "country": "Italy",
      "countryCode": "IT",
      "sector": "Utilities",
      "exchange": "Borsa Italiana",
      "currency": "EUR",
      "currentPrice": 6.85,
      "dividendYield": 7.2,
      "annualDividend": 0.49,
      "marketCap": 70000000000,
      "priceChangePercent": 0.3,
      "historicYields": [
        { "year": 2020, "yield": 5.8, "dividend": 0.35 },
        { "year": 2021, "yield": 6.2, "dividend": 0.38 },
        { "year": 2022, "yield": 7.5, "dividend": 0.40 },
        { "year": 2023, "yield": 7.0, "dividend": 0.43 },
        { "year": 2024, "yield": 7.2, "dividend": 0.49 }
      ],
      "dividendsPerYear": [
        { "year": 2020, "totalAmount": 0.35, "payments": 2 },
        { "year": 2021, "totalAmount": 0.38, "payments": 2 },
        { "year": 2022, "totalAmount": 0.40, "payments": 2 },
        { "year": 2023, "totalAmount": 0.43, "payments": 2 },
        { "year": 2024, "totalAmount": 0.49, "payments": 2 }
      ],
      "status": "bullish",
      "pro": "One sentence explaining the main investment strength of this company today.",
      "con": "One sentence explaining the main risk or weakness of this company today."
    }
  ]
}

Select the top 10 European large-cap companies by dividend yield as of today. Prioritize:
- Companies listed on major EU exchanges: Euronext (Paris/Amsterdam/Brussels), XETRA, Borsa Italiana, BME Spain, Nasdaq Nordic.
- Sustainable, well-established dividend payers in Utilities, Financials, Energy, Telecoms, Insurance, Consumer Staples.
- Large caps with market caps above €5B.
- Rank 1 = highest dividend yield.
- Include companies from diverse countries (France, Germany, Italy, Spain, Netherlands, etc.).
- Provide realistic data based on your knowledge as of your training cutoff. The "status" field reflects today's investment outlook.
- historicYields must have exactly 5 entries (years ${today.slice(0,4) - 5} to ${today.slice(0,4) - 1}).
- dividendsPerYear must have exactly 5 entries for the same years.`

console.log(`[${new Date().toISOString()}] Calling Gemini API...`)

const result = await model.generateContent(prompt)
let text = result.response.text().trim()

// Strip markdown code fences if Gemini wraps in them
if (text.startsWith('```')) {
  text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
}

let data
try {
  data = JSON.parse(text)
} catch (err) {
  console.error('Failed to parse Gemini response:', text.slice(0, 500))
  throw new Error(`JSON parse error: ${err.message}`)
}

if (!Array.isArray(data.companies) || data.companies.length === 0) {
  throw new Error('Invalid response: missing companies array')
}

// Ensure generatedAt is present
data.generatedAt = data.generatedAt ?? new Date().toISOString()

console.log(`[${new Date().toISOString()}] Received ${data.companies.length} companies. Saving to Firestore...`)

await db.collection('ai-recommendations').doc('latest').set(data)

console.log(`[${new Date().toISOString()}] Done. Top pick: ${data.companies[0]?.company} @ ${data.companies[0]?.dividendYield}% yield`)
