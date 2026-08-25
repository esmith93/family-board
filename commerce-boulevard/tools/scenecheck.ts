import { newGame } from '../src/sim/index'
import { buildScene, layoutFor, roadBands } from '../src/render/scene'
const s = newGame('fairview')
const layout = layoutFor(s.street)
console.log('gridW', layout.gridW, 'gridH', layout.gridH)
console.log('northBack', layout.northBack, 'northFront', layout.northFront, 'northWalk', layout.northWalk)
console.log('road', layout.road, 'rows', layout.roadRows.length)
console.log('southWalk', layout.southWalk, 'southFront', layout.southFront, 'southBack', layout.southBack)
console.log('bands', roadBands(s.street).map(b => `${b.role}:${b.feet}`).join(' | '))
const scene = buildScene(s)
console.log('tiles', scene.tiles.length, 'buildings', scene.buildings.length, 'props', scene.props.length, 'lanes', scene.lanes.length)
const byUse: Record<string, number> = {}
for (const b of scene.buildings) byUse[b.use] = (byUse[b.use] ?? 0) + 1
console.log('buildings by use', byUse)
console.log('sample buildings:', scene.buildings.slice(0, 6).map(b => `${b.use} @(${b.gx},${b.gy}) ${b.footprintW}x${b.footprintD}f${b.floors}`).join('\n  '))
const byProp: Record<string, number> = {}
for (const p of scene.props) byProp[p.kind] = (byProp[p.kind] ?? 0) + 1
console.log('props', byProp)
// what's at gy=20..30 near gx=264?
const near = scene.tiles.filter(t => Math.abs(t.gx - 264) < 3 && t.gy >= 0 && t.gy <= layout.gridH)
const kinds = new Map<number, string>()
for (const t of near) if (t.gx === 264) kinds.set(t.gy, t.kind.sort + ('role' in t.kind ? ':' + t.kind.role : ''))
console.log('column at gx=264:')
console.log([...kinds.entries()].sort((a,b)=>a[0]-b[0]).map(([y,k])=>`${y}:${k}`).join(' '))
