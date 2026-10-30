import { writeFileSync } from 'node:fs';
import { ARCH, PACK, idealPlacements } from './dental-core.mjs';
import { build, metrics } from './gate-lib.mjs';
import { packAll } from './pack.mjs';
function score() {
  packAll();
  const S = build([...idealPlacements('upper'), ...idealPlacements('lower')]);
  const m = metrics(S);
  return { s: Math.abs(m.overjet - 2.4) * 3 + Math.abs(m.overjetMax - m.overjet) + Math.abs(m.overbite - 2.4) + Math.abs(m.buccalOverjet - 2.4) * 2 + m.classI * 2 + Math.max(0, m.anteriorPenetration - 0.2) * 5 + Math.max(0, m.scissor + 1) * 3, m };
}
let best = JSON.parse(JSON.stringify(ARCH)), bs = score().s;
const rnd = (v, s) => v + (Math.random() * 2 - 1) * s;
const N = +process.argv[2] || 120;
for (let it = 0; it < N; it++) {
  const sc = it < N / 2 ? 1 : 0.35;
  ARCH.upper = { a: rnd(best.upper.a, 1.5 * sc), d: rnd(best.upper.d, 1.5 * sc), p: Math.max(1.5, rnd(best.upper.p, 0.2 * sc)) };
  ARCH.lower = { a: rnd(best.lower.a, 1.5 * sc), d: rnd(best.lower.d, 1.5 * sc), p: Math.max(1.5, rnd(best.lower.p, 0.2 * sc)) };
  const s = score().s;
  if (s < bs) { bs = s; best = JSON.parse(JSON.stringify(ARCH)); }
}
ARCH.upper = best.upper; ARCH.lower = best.lower;
const { m } = score();
const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
const params = { arch: { upper: r(ARCH.upper), lower: r(ARCH.lower) }, pack: { upper: PACK.upper.map((v) => Math.round(v * 1000) / 1000), lower: PACK.lower.map((v) => Math.round(v * 1000) / 1000) } };
writeFileSync('dental-params.json', JSON.stringify(params));
console.log(JSON.stringify(params), '\n', JSON.stringify(r(m)), 'score', bs.toFixed(3));
