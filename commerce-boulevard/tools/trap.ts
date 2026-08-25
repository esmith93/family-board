import { newGame, advanceYear } from '../src/sim/index'
import type { SimState } from '../src/sim/index'
const play = (plan: (y: number) => string[]) => {
  let s: SimState = newGame('fairview'); const out = [s]
  for (let i = 0; i < 25 && !s.ended; i++) { s = advanceYear(s, plan(s.year)).state; out.push(s) }
  return out
}
const base = play(() => [])
const wide = play(y => y === 0 ? ['capital.state_widening'] : [])
console.log('        do nothing              took the 90/10 grant')
console.log(' yr | speed   AADT   v/c  |  speed   AADT   v/c   approval')
for (const y of [0, 2, 4, 6, 10, 14, 18, 22]) {
  const f = (a: SimState[]) => a[y] ? `${a[y]!.traffic.peakSpeedMph.toFixed(1).padStart(5)} ${String(Math.round(a[y]!.traffic.aadt)).padStart(6)} ${a[y]!.traffic.volumeCapacityRatio.toFixed(2).padStart(5)}` : '  ---    ---   ---'
  console.log(String(y).padStart(3), '|', f(base), ' | ', f(wide), '  ', wide[y] ? wide[y]!.politics.approval.toFixed(0).padStart(3) : ' --')
}
console.log('\nend:', 'do nothing ->', base.at(-1)!.ended ?? 'still running', '| widened ->', wide.at(-1)!.ended)
