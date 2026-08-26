import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const url = process.argv[2] ?? 'http://localhost:5182/'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })
const shot = (n) => page.screenshot({ path: `shots/${n}.png` })

// A corridor left alone long enough to hit the wall.
await page.goto(`${url}?seed=fairview-best&ff=18&plan=nothing`, { waitUntil: 'load' })
await page.waitForTimeout(2400)
const unlocked = await page.isVisible('#goledger')
await shot('61-street-y18')
if (unlocked) {
  await page.click('#goledger')
  await page.waitForTimeout(1600)
  await shot('62-ledger-y18')
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(900)
  await shot('63-ledger-close')
  await page.click('#goledger')
  await page.waitForTimeout(600)
}
// And the reckoning, which is what thirty years comes to.
await page.goto(`${url}?seed=fairview-best&ff=29&plan=nothing`, { waitUntil: 'load' })
await page.waitForTimeout(2500)
let reckoned = false
for (let i = 0; i < 4 && !reckoned; i++) {
  await page.click('#advance').catch(() => {})
  await page.waitForTimeout(10500)
  // Skip whatever modal is in the way: the paper, or a glossary card.
  for (const sel of ['#paperclose', '#gok']) {
    if (await page.isVisible(sel).catch(() => false)) { await page.click(sel); await page.waitForTimeout(700) }
  }
  reckoned = await page.isVisible('#reckveil:not(.hidden)').catch(() => false)
}
if (reckoned) {
  await page.waitForTimeout(600)
  await shot('64-reckoning-top')
  await page.evaluate(() => document.getElementById('reckveil').scrollTo(0, 1250))
  await page.waitForTimeout(400)
  await shot('65-reckoning-mid')
  await page.evaluate(() => { const v = document.getElementById('reckveil'); v.scrollTo(0, v.scrollHeight) })
  await page.waitForTimeout(400)
  await shot('66-reckoning-end')
}
console.log(JSON.stringify({ ledgerButtonVisible: unlocked, reckoningShown: reckoned }))
console.error(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
await browser.close()
