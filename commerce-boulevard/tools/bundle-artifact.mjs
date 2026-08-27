/**
 * Fold the built game into one file, for hosting somewhere that serves a page
 * and nothing else.
 *
 * The artifact host wraps whatever it is given in its own document skeleton, so
 * the outer <html>, <head> and <body> have to go and the <style> and markup
 * come across as they are. The one real change is the script: a separate module
 * file cannot be fetched, so the bundle is inlined.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'dist/commerce-boulevard.html'
const html = readFileSync('dist/index.html', 'utf8')

const asset = readdirSync('dist/assets').find((f) => f.endsWith('.js'))
if (!asset) throw new Error('no built bundle in dist/assets')
const js = readFileSync(join('dist/assets', asset), 'utf8')

// A bundle that contained the closing tag as a literal would end the script
// early. It does not today; the guard is here so it cannot start to.
if (js.includes('</script')) throw new Error('the bundle contains a closing script tag')

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Commerce Boulevard'
const style = html.match(/<style>[\s\S]*?<\/style>/)?.[0]
if (!style) throw new Error('no <style> block in the built page')

const bodyOpen = html.indexOf('<body>')
const bodyClose = html.lastIndexOf('</body>')
if (bodyOpen < 0 || bodyClose < 0) throw new Error('no <body> in the built page')
const body = html.slice(bodyOpen + '<body>'.length, bodyClose)
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, '')
  .trim()

const page = `<title>${title}</title>
${style}

${body}

<script type="module">
${js}
</script>
`
writeFileSync(out, page)
console.log(`${out}  ${(page.length / 1024).toFixed(0)} KB`)
