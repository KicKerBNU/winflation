import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const ticker = process.argv[2] || 'MUV2.DE'
const period1 = new Date('2021-01-01T00:00:00Z')
const period2 = new Date('2026-01-01T00:00:00Z')

console.log(`probing ${ticker} dividend events 2021-01-01 → 2026-01-01...`)
const result = await yf.chart(ticker, { period1, period2, interval: '1mo', events: 'dividends' })

console.log('top-level keys:', Object.keys(result ?? {}))
console.log('events keys:', Object.keys(result?.events ?? {}))
const divs = result?.events?.dividends
console.log('dividends type:', Array.isArray(divs) ? 'array' : typeof divs)
console.log('dividends raw:', divs)
console.log('')
console.log('---iteration---')
const list = Array.isArray(divs) ? divs : Object.values(divs ?? {})
console.log(`length: ${list.length}`)
for (const ev of list) {
  console.log(JSON.stringify(ev))
}
process.exit(0)
