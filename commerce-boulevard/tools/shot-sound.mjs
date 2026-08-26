/** Does the game actually make a noise, and does it stop when told to? */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5181/'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })

// Count the contexts the page creates, and watch what happens to them.
await page.addInitScript(() => {
  window.__contexts = []
  const Real = window.AudioContext
  window.AudioContext = class extends Real {
    constructor(...args) { super(...args); window.__contexts.push(this) }
  }
})

await page.goto(`${url}?seed=fairview-best&ff=6`, { waitUntil: 'load' })
await page.waitForTimeout(1800)
const before = await page.evaluate(() => window.__contexts.length)

// Any gesture at all should be enough.
await page.mouse.click(700, 400)
await page.waitForTimeout(900)
const afterClick = await page.evaluate(() => ({
  count: window.__contexts.length,
  states: window.__contexts.map((c) => c.state),
}))

await page.click('#gowalk')
await page.waitForTimeout(1500)
const walking = await page.evaluate(() => window.__contexts.map((c) => c.state))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

const hintBefore = (await page.textContent('#hint')).replace(/\s+/g, ' ')
await page.keyboard.press('m')
await page.waitForTimeout(600)
const hintAfterMute = (await page.textContent('#hint')).replace(/\s+/g, ' ')
await page.keyboard.press('m')
await page.waitForTimeout(400)
const hintAfterUnmute = (await page.textContent('#hint')).replace(/\s+/g, ' ')
const soundState = (t) => /sound (on|off)/.exec(t)?.[0] ?? '?'

console.log(JSON.stringify({
  contextsBeforeGesture: before,
  afterGesture: afterClick,
  whileWalking: walking,
  mute: [soundState(hintBefore), soundState(hintAfterMute), soundState(hintAfterUnmute)],
  remembered: await page.evaluate(() => window.localStorage.getItem('commerce-blvd-sound')),
}, null, 2))
console.error(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
await browser.close()
