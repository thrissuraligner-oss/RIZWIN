export function hull(pts) {
  const p = pts.map((q) => [q[0], q[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
export function clip(subject, clipper) {
  const ccw = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a > 0 ? P : [...P].reverse(); };
  let out = ccw(subject); clipper = ccw(clipper);
  for (let i = 0; i < clipper.length && out.length; i++) {
    const A = clipper[i], B = clipper[(i + 1) % clipper.length], inp = out; out = [];
    const inside = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) >= 0;
    const X = (p, q) => { const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1], a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1], d = a1 * b2 - a2 * b1; return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d]; };
    for (let j = 0; j < inp.length; j++) { const P = inp[j], Q = inp[(j + 1) % inp.length]; if (inside(Q)) { if (!inside(P)) out.push(X(P, Q)); out.push(Q); } else if (inside(P)) out.push(X(P, Q)); }
  }
  return out;
}
export function dist(Pa, Pb) { let d = Infinity; for (const a of Pa) for (const b of Pb) d = Math.min(d, Math.hypot(a[0] - b[0], a[1] - b[1])); return d; }
export function band(v, y0, y1) { const o = []; for (let i = 0; i < v.length; i += 3) if (v[i + 1] >= y0 && v[i + 1] <= y1) o.push([v[i], v[i + 1], v[i + 2]]); return o; }
// signed separation: >0 gap, <0 overlap expressed as -sqrt(area)
export function separation(va, vb, y0, y1) {
  const ha = hull(band(va, y0, y1)), hb = hull(band(vb, y0, y1));
  const ov = area(clip(ha, hb));
  return ov > 0 ? -Math.sqrt(ov) : dist(ha, hb);
}
