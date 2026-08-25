import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const result = await page.evaluate(() => {
  const canvas = document.getElementById('view')
  const ctx = canvas.getContext('2d')
  const bufW = Math.ceil(canvas.width / 0.55), bufH = Math.ceil(canvas.height / 0.55)
  const off = new OffscreenCanvas(bufW, bufH)
  const octx = off.getContext('2d')
  octx.imageSmoothingEnabled = false

  const t = (label, fn, n = 20) => {
    fn(); const s = performance.now(); for (let i = 0; i < n; i++) fn()
    return `${label}: ${((performance.now() - s) / n).toFixed(2)} ms`
  }
  const out = []
  out.push(`buffer ${bufW}x${bufH}`)
  out.push(t('gradient sky fill', () => {
    const g = octx.createLinearGradient(0, 0, 0, bufH)
    g.addColorStop(0, '#7fb4cf'); g.addColorStop(1, '#cfe3e4')
    octx.fillStyle = g; octx.fillRect(0, 0, bufW, bufH)
  }))
  out.push(t('solid fill', () => { octx.fillStyle = '#7fb4cf'; octx.fillRect(0, 0, bufW, bufH) }))
  const tile = new OffscreenCanvas(64, 32)
  tile.getContext('2d').fillStyle = '#456'; tile.getContext('2d').fillRect(0, 0, 64, 32)
  out.push(t('4250 unscaled 64x32 blits', () => {
    for (let i = 0; i < 4250; i++) octx.drawImage(tile, (i * 37) % bufW, (i * 53) % bufH)
  }, 10))
  out.push(t('final downscale to screen', () => {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(off, 0, 0, bufW, bufH, 0, 0, canvas.width, canvas.height)
  }))
  out.push(t('4250 scaled 0.55 blits direct', () => {
    for (let i = 0; i < 4250; i++) ctx.drawImage(tile, (i * 37) % canvas.width, (i * 53) % canvas.height, 35, 18)
  }, 10))
  return out.join('\n')
})
await browser.close()
console.log(result)
