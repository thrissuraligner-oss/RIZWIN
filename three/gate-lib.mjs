import { TEETH, idealPlacements, placementsAt, worldVertices, CONCERNS } from './dental-core.mjs';
export function build(pls) {
  return pls.map((pl) => ({ pl, key: `${pl.tooth.id}${pl.side > 0 ? 'R' : 'L'}`, v: worldVertices(pl) }));
}
const get = (S, key) => S.find((s) => s.key === key);
function ext(v, fn) { let best = null; for (let i = 0; i < v.length; i += 3) { const r = fn(v[i], v[i + 1], v[i + 2]); if (r != null && (best == null || r > best)) best = r; } return best; }
function band(v, y0, y1) { const o = []; for (let i = 0; i < v.length; i += 3) if (v[i + 1] >= y0 && v[i + 1] <= y1) o.push([v[i], v[i + 1], v[i + 2]]); return o; }

export function metrics(S) {
  const m = {};
  // incisors: right and left centrals
  const ob = [], oj = [], pen = [];
  for (const sd of ['R', 'L']) {
    const U = get(S, 'U1' + sd).v, L = get(S, 'L1' + sd).v;
    const uMinY = -ext(U, (x, y) => -y), lMaxY = ext(L, (x, y) => y);
    ob.push(lMaxY - uMinY);
    const uEdgeZ = ext(U, (x, y, z) => (y <= uMinY + 1.2 ? z : null));
    const lLabZ = ext(L, (x, y, z) => (y >= lMaxY - 3 ? z : null));
    oj.push(uEdgeZ - lLabZ);
  }
  m.overbite = Math.min(...ob); m.overbiteMax = Math.max(...ob); m.overjet = Math.min(...oj); m.overjetMax = Math.max(...oj);
  // anterior penetration: any lower anterior point lying in front of an upper anterior surface point at the same x,y (overlap zone)
  const grid = new Map(), cell = 0.6, key = (x, y) => `${Math.round(x / cell)},${Math.round(y / cell)}`;
  for (const s of S) if (s.pl.jaw === 'upper' && s.pl.i <= 2) for (let i = 0; i < s.v.length; i += 3) {
    const k = key(s.v[i], s.v[i + 1]); const z = s.v[i + 2]; const cur = grid.get(k); if (!cur || z < cur) grid.set(k, z); // lingual-most upper point
  }
  let worst = 0;
  for (const s of S) if (s.pl.jaw === 'lower' && s.pl.i <= 2) for (let i = 0; i < s.v.length; i += 3) {
    const uz = grid.get(key(s.v[i], s.v[i + 1])); if (uz == null) continue; worst = Math.max(worst, s.v[i + 2] - uz);
  }
  m.anteriorPenetration = worst; // mm a lower incisor pokes through/in front of an upper incisor at the same point
  // posterior transverse relation at first molars
  const wU = [], wL = [], pal = [];
  for (const sd of ['R', 'L']) {
    const U = get(S, 'U6' + sd).v, L = get(S, 'L6' + sd).v;
    wU.push(ext(U, (x) => Math.abs(x))); wL.push(ext(L, (x) => Math.abs(x))); pal.push(-ext(U, (x) => -Math.abs(x)));
    m.molarVertical = Math.min(m.molarVertical ?? 99, -ext(U, (x, y) => -y) - ext(L, (x, y) => y));
  }
  m.buccalOverjet = Math.min(...wU.map((u, i) => u - wL[i])); m.scissor = Math.max(...pal.map((p, i) => p - wL[i]));
  // Class I: upper first molar mesiobuccal cusp over the lower first molar buccal groove (antero-posterior, mm)
  const cls = [];
  for (const sd of ['R', 'L']) {
    const u = get(S, 'U6' + sd).pl, l = get(S, 'L6' + sd).pl;
    const uMB = u.z + (-u.tz) * (u.tooth.w * 0.25) * (u.tz < 0 ? -1 : 1) * -1; // mesial = towards +z along the arch
    cls.push((u.z + Math.abs(u.tz) * u.tooth.w * 0.25) - l.z);
  }
  m.classI = Math.max(...cls.map(Math.abs));
  return m;
}
function hull(pts) { // 2D convex hull (x,z)
  const p = pts.map((q) => [q[0], q[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
function clip(subject, clipper) { // Sutherland-Hodgman, both convex CCW
  let out = subject;
  const ccw = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a > 0 ? P : [...P].reverse(); };
  out = ccw(out); clipper = ccw(clipper);
  for (let i = 0; i < clipper.length && out.length; i++) {
    const A = clipper[i], B = clipper[(i + 1) % clipper.length], inp = out; out = [];
    const inside = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) >= 0;
    const X = (p, q) => { const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1], a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1], d = a1 * b2 - a2 * b1; return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d]; };
    for (let j = 0; j < inp.length; j++) { const P = inp[j], Q = inp[(j + 1) % inp.length]; if (inside(Q)) { if (!inside(P)) out.push(X(P, Q)); out.push(Q); } else if (inside(P)) out.push(X(P, Q)); }
  }
  return out;
}
function dist(Pa, Pb) { let d = Infinity; for (const a of Pa) for (const b of Pb) d = Math.min(d, Math.hypot(a[0] - b[0], a[1] - b[1])); return d; }
export function contacts(S) { // neighbours in the same arch: overlap area and gap of crown cross-sections at mid-crown
  const res = [];
  for (const jaw of ['upper', 'lower']) {
    const ids = TEETH[jaw].map((t) => t.id);
    const seq = [...ids.map((id) => id + 'L').reverse(), ...ids.map((id) => id + 'R')];
    for (let i = 0; i < seq.length - 1; i++) {
      const a = get(S, seq[i]), b = get(S, seq[i + 1]);
      const yA = a.pl.jaw === 'upper' ? [a.pl.tipY + 2, a.pl.tipY + 6] : [-6, -2];
      const ha = hull(band(a.v, yA[0] + a.pl.dy, yA[1] + a.pl.dy)), hb = hull(band(b.v, yA[0] + b.pl.dy, yA[1] + b.pl.dy));
      const ov = area(clip(ha, hb));
      res.push({ pair: seq[i] + '-' + seq[i + 1], overlap: ov, gap: ov > 0 ? 0 : dist(ha, hb) });
    }
  }
  return res;
}

