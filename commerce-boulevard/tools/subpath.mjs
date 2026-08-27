/** Serve the real dist/ from a subpath, the way GitHub Pages does, and play it. */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const PREFIX = '/commerce-boulevard'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0])
  if (!path.startsWith(PREFIX)) { res.writeHead(404).end('not found'); return }
  path = path.slice(PREFIX.length) || '/'
  if (path === '/') path = '/index.html'
  try {
    const file = join('dist', normalize(path).replace(/^(\.\.[/\\])+/, ''))
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(8099, '127.0.0.1', r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
const missing = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) missing.push(`${r.status()} ${r.url()}`) })

await page.goto(`http://127.0.0.1:8099${PREFIX}/?seed=fairview`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// Not "did it load" — did the game actually start.
const opening = await page.evaluate(() => document.getElementById('modalsheet')?.innerText?.slice(0, 60))
for (const id of ['ok', 'ok', 'accept']) {
  await page.evaluate((i) => document.getElementById(i)?.click(), id)
  await page.waitForTimeout(400)
}
await page.waitForTimeout(1500)
const running = await page.evaluate(() => ({
  cards: document.querySelectorAll('#cards .card').length,
  meters: document.querySelectorAll('#meters .meter').length,
  painted: (() => {
    const c = document.getElementById('view')
    const ctx = c.getContext('2d')
    try {
      const d = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data
      return `rgb(${d[0]},${d[1]},${d[2]})`
    } catch { return 'unreadable' }
  })(),
}))
await page.screenshot({ path: 'shots/71-subpath.png' })
console.log('opening screen:', JSON.stringify(opening))
console.log('after accepting:', JSON.stringify(running))
console.log('404s:', missing.length ? missing : 'none')
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
server.close()
