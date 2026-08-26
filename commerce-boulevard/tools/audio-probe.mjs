import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5181/audio-probe.html'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => window.PROBE !== undefined, { timeout: 40000 })
const probe = await page.evaluate(() => window.PROBE)
console.log(JSON.stringify(probe, null, 2))
if (errors.length) console.error('ERRORS:\n' + errors.join('\n'))
await browser.close()
process.exit(probe.ok ? 0 : 1)
