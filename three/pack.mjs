import { PACK, TEETH, idealPlacements, worldVertices } from './dental-core.mjs';
import { separation } from './geom2d.mjs';
const TARGET = 0.05;
function bandFor(pl) { return pl.jaw === 'upper' ? [pl.tipY + 2, pl.tipY + 6] : [-6, -2]; }
export function packJaw(jaw) {
  PACK[jaw] = TEETH[jaw].map(() => 0);
  for (let i = 0; i < TEETH[jaw].length; i++) {
    const sep = (o) => {
      PACK[jaw][i] = o;
      const P = idealPlacements(jaw);
      const a = P.find((p) => p.side === 1 && p.i === i);
      const b = i === 0 ? P.find((p) => p.side === -1 && p.i === 0) : P.find((p) => p.side === 1 && p.i === i - 1);
      const [y0, y1] = bandFor(a);
      return separation(worldVertices(a), worldVertices(b), y0, y1);
    };
    let lo = (i ? PACK[jaw][i - 1] : 0) - 3, hi = (i ? PACK[jaw][i - 1] : 0) + 3;
    for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if (sep(mid) > TARGET) hi = mid; else lo = mid; }
    PACK[jaw][i] = (lo + hi) / 2;
  }
  return PACK[jaw];
}
export function packAll() { packJaw('upper'); packJaw('lower'); return PACK; }
