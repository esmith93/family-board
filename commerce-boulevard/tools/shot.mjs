import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5173/'
const outDir = process.argv[3] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const shots = [
  { name: '01-year0-day', keys: [] },
  { name: '02-dusk', keys: ['3'] },
  { name: '03-night', keys: [] },
  { name: '04-autumn', keys: ['e'] },
]
// day, dusk, night, overcast are 1..4
await page.screenshot({ path: `${outDir}/01-day.png` })
await page.keyboard.press('2'); await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/02-dusk.png` })
await page.keyboard.press('3'); await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/03-night.png` })
await page.keyboard.press('1'); await page.keyboard.press('e'); await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/04-autumn.png` })
void shots

// Play the corridor forward with a few instruments, to see the picture change.
await page.keyboard.press('1'); await page.keyboard.press('w'); await page.waitForTimeout(300)
for (const key of ['m', 'm', 'd', 'n', 'p', 'k', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ']) {
  await page.keyboard.press(key === ' ' ? 'Space' : key)
  await page.waitForTimeout(140)
}
await page.waitForTimeout(2000)
await page.screenshot({ path: `${outDir}/06-transformed.png` })

// Zoom right in to inspect sprite quality.
for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60) }
await page.waitForTimeout(2500)
await page.screenshot({ path: `${outDir}/05-closeup.png` })

const stats = await page.evaluate(() => document.getElementById('stats')?.innerText ?? '')
await browser.close()
console.log('stats:\n' + stats)
if (errors.length) { console.log('ERRORS:'); for (const e of errors.slice(0, 10)) console.log(' ', e) }
else console.log('no console errors')
