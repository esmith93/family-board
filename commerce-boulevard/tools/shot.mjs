import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5180/'
const outDir = process.argv[3] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })

await page.goto(`${url}?seed=fairview`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` })
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(500) }

await shot('10-budget')
await click('#ok')
await shot('11-job')
await click('#ok')
await shot('12-grant')

// Ask where the grant's numbers come from.
await click('#grantwhy')
await shot('13-why')
await click('#whyclose')

await click('#accept')
await page.waitForTimeout(2500)
await shot('14-instruments')

// Look at another tab, and select a couple of things.
await click('[data-tab="land"]')
await shot('15-landuse')
await page.click('.card[data-id="land.reduce_parking_minimums"]')
await page.click('[data-tab="street"]')
await page.click('.card[data-id="street.plant_trees"]')
await page.waitForTimeout(400)
await shot('16-committing')

// Advance several years to see works in progress and the picture change.
const dismiss = async () => {
  for (const sel of ['#gok', '#again', '#whyclose']) {
    const node = await page.$(sel)
    if (node && await node.isVisible()) { await node.click(); await page.waitForTimeout(300) }
  }
}
for (let i = 0; i < 7; i++) {
  await dismiss()
  const advance = await page.$('#advance')
  if (!advance || await advance.isDisabled()) break
  await advance.click()
  await page.waitForTimeout(700)
}
await dismiss()
await page.waitForTimeout(2000)
await shot('17-played')

const stats = await page.evaluate(() => ({
  meters: document.getElementById('meters')?.innerText ?? '',
  hint: document.getElementById('hint')?.innerText ?? '',
}))
await browser.close()
console.log(stats.meters.replace(/\n+/g, ' | '))
console.log(stats.hint)
if (errors.length) { console.log('ERRORS:'); for (const e of errors.slice(0, 8)) console.log(' ', e) }
else console.log('no console errors')
