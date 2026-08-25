/** Writes MODEL.md. The rendering itself lives in src/sim/model-doc.ts. */
import { writeFileSync } from 'node:fs'
import { renderModelDoc } from '../src/sim/model-doc'

writeFileSync(new URL('../MODEL.md', import.meta.url), renderModelDoc())
console.log('wrote MODEL.md')
