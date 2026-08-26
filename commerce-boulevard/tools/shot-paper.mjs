import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5180/'
const outDir = process.argv[3] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })

const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` })

// Read the paper at three points in one corridor's life: just after the grant,
// the middle years, and once the desk has come round.
for (const [name, ff] of [['20-paper-early', 2], ['21-paper-middle', 12], ['22-paper-late', 24]]) {
  await page.goto(`${url}?seed=fairview-best&ff=${ff}`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  if (ff === 2) await shot('19-corridor')
  if (ff === 24) await shot('18-corridor-late')
  await page.click('#advance')
  // Sit through the four seasons, which is what a player does.
  await page.waitForSelector('#paper:not(.hidden)', { timeout: 20000 })
  await page.waitForTimeout(800)
  await shot(name)
}

// The season banner, caught mid-turn.
await page.goto(`${url}?seed=fairview-best&ff=14`, { waitUntil: 'load' })
await page.waitForTimeout(1800)
await page.click('#advance')
await page.waitForTimeout(5200)
await shot('24-autumn')

console.error(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
await browser.close()
