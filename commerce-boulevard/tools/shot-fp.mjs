import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5181/'
const outDir = process.argv[3] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })
const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` })

for (const [tag, ff] of [['y2', 2], ['y24', 24]]) {
  await page.goto(`${url}?seed=fairview-best&ff=${ff}`, { waitUntil: 'load' })
  await page.waitForTimeout(2200)
  if (ff === 2) await shot('50-office')

  // Drive it.
  await page.click('#godrive')
  await page.waitForTimeout(400)
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(6000)
  await shot(`51-drive-${tag}`)
  await page.keyboard.up('ArrowUp')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // Walk it.
  await page.click('#gowalk')
  await page.waitForTimeout(400)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(9000)
  await shot(`52-walk-${tag}`)
  await page.keyboard.up('ArrowRight')
  // Try to cross where you are.
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(2500)
  await shot(`53-cross-${tag}`)
  await page.keyboard.up('ArrowUp')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

console.error(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
await browser.close()
