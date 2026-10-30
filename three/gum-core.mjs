// Gums built from the teeth, every frame: the gingival margin is traced around each crown's real cross-section,
// papillae rise into every contact, and a rounded alveolar body runs under the arch. Shared by the renderer and the gate,
// so what the gate measures is exactly what is drawn. Units mm, same axes as dental-core.
import { crownShape, placementMatrix, GUM_LEVEL, sstep } from './dental-core.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const keyOf = (pl) => pl.tooth.id + (pl.side > 0 ? 'R' : 'L');

// a tooth with its frame, for forward and inverse transforms
export function toothFrame(pl) {
  const M = placementMatrix(pl), o = M(0, 0, 0);
  const ex = sub(M(1, 0, 0), o), ey = sub(M(0, 1, 0), o), ez = sub(M(0, 0, 1), o);
  const shape = crownShape(pl.tooth), lv = GUM_LEVEL[pl.tooth.type];
  return { pl, key: keyOf(pl), M, o, ex, ey, ez, shape, lv, toLocal: (p) => { const d = sub(p, o); return [dot(d, ex), dot(d, ey), dot(d, ez)]; } };
}
// is a world point inside the visible (above-gum) part of this crown? tol < 1 shrinks the crown slightly
export function insideCrown(F, p, tol = 0.92) {
  const [x, y, z] = F.toLocal(p), v = y / F.shape.hs;
  if (v < F.lv[0] - 0.02 || v > 1) return false;
  const { a, b, zc } = F.shape.sec(v), n = F.shape.n;
  return Math.abs(x / a) ** n + Math.abs((z - zc) / b) ** n < tol;
}

export const GUM_OPT = { perTooth: 13, bridge: 2, prof: 26, top: 5, ends: 6, H: 12 };

// ref: the same teeth on the finished (ideal) arch. The alveolar body is anchored to it, so the jaw stays put and
// only the gingival margin and papillae travel with each moving tooth - teeth move *through* the gum, as in real treatment.
export function buildGum(pls, jaw, opt = GUM_OPT, ref = null) {
  const R0 = ref ? (ref.coreRings ? ref : buildGum(ref, jaw, opt, null)) : null; // a prebuilt reference can be passed to save work
  const occl = jaw === 'upper' ? -1 : 1, down = [0, -occl, 0]; // 'down' = away from the biting surface, into the gum
  const L = pls.filter((p) => p.jaw === jaw).sort((a, b) => (a.side === b.side ? (a.side < 0 ? b.i - a.i : a.i - b.i) : a.side - b.side));
  const F = L.map(toothFrame);
  const S = opt.perTooth, samples = []; // {lab, lin, mid, owner, s, jug}
  const pushes = [];
  const near = (f, p) => { const d0 = p[0] - f.o[0], d1 = p[1] - f.o[1], d2 = p[2] - f.o[2], r = f.pl.tooth.h + f.pl.tooth.w; return d0 * d0 + d1 * d1 + d2 * d2 < r * r; }; // cheap sphere test before the exact one
  F.forEach((f, ti) => {
    const prev = F[Math.max(0, ti - 1)].o, next = F[Math.min(F.length - 1, ti + 1)].o, T = sub(next, prev);
    const { sec, n, hs } = f.shape, [vm, vp] = f.lv;
    const pts = [];
    for (let k = 0; k < S; k++) {
      const u = -1 + (2 * k) / (S - 1), s = Math.sign(u) * Math.sin((Math.abs(u) * Math.PI) / 2), as = Math.abs(s); // denser towards the contacts
      const v = vm + (vp - vm) * Math.pow(sstep(0.3, 1, as), 1.15);
      const { a, b, zc } = sec(v), y = v * hs, x = a * s * 1.02;
      const zr = Math.max(b * Math.pow(Math.max(0, 1 - as ** n), 1 / n), b * 0.55), off = 0.45 * (1 - as ** 3) + 0.15; // the papilla fills the embrasure
      const lab = f.M(x, y, zc + zr + off), lin = f.M(x, y, zc - zr - off);
      const mid = f.M(x * 0.9, y - 1.4 * (1 - sstep(0.7, 1, as)), zc);
      pts.push({ lab, lin, mid, owner: f.key, s, jug: (1 - as) ** 2, ti });
    }
    if (dot(sub(pts[S - 1].mid, pts[0].mid), T) < 0) pts.reverse();
    if (ti > 0 && samples.length) { // bridge the contact (or the space) to the previous tooth
      const A = samples[samples.length - 1], B = pts[0];
      for (let g = 1; g <= opt.bridge; g++) {
        const t = g / (opt.bridge + 1), lab = mix(A.lab, B.lab, t), lin = mix(A.lin, B.lin, t);
        samples.push({ lab, lin, mid: add(mix(lab, lin, 0.5), mul(down, -0.3)), owner: null, s: 1, jug: 0, ti });
      }
    }
    samples.push(...pts);
  });
  // papillae must never climb onto a neighbour's visible crown (crowded, rotated teeth): press them down into the gum
  for (const sm of samples) for (const which of ['lab', 'lin', 'mid']) {
    let p = sm[which], moved = 0;
    for (let it = 0; it < 60; it++) {
      const hit = F.some((f) => f.key !== sm.owner && near(f, p) && insideCrown(f, p, 1.0));
      if (!hit) break; p = add(p, mul(down, 0.2)); moved += 0.2;
    }
    sm[which] = p; if (moved && which === 'lab') pushes.push(moved);
  }
  // outward (labial) horizontal normal per sample from the arch direction
  const nrm = samples.map((sm, i) => {
    const a = samples[Math.max(0, i - 2)].mid, b = samples[Math.min(samples.length - 1, i + 2)].mid;
    let t = sub(b, a); t = [t[0], 0, t[2]]; const l = len(t) || 1; t = mul(t, 1 / l);
    let nv = [t[2], 0, -t[0]]; if (dot(nv, sub(sm.lab, sm.lin)) < 0 && dot(nv, [sm.mid[0], 0, sm.mid[2] - 6]) < 0) nv = mul(nv, -1);
    if (dot(nv, [sm.mid[0], 0, sm.mid[2] - 6]) < 0) nv = mul(nv, -1);
    return nv;
  });
  // cross-section: labial crest -> rounded alveolar body -> lingual crest -> over the top (inside the crowns) back to labial
  const P = opt.prof, TOP = opt.top, R = P + TOP, m = 3.2;
  const ring = (sm, nv) => {
    const out = [];
    for (let j = 0; j < P; j++) {
      const ph = (j / (P - 1)) * Math.PI, c = Math.cos(ph), sn = Math.sin(ph);
      const sx = (1 - Math.sign(c) * Math.pow(Math.abs(c), 2 / m)) / 2; // 0 labial .. 1 lingual
      const depth = opt.H * Math.pow(sn, 2 / m);
      const bul = (c >= 0 ? 1.2 + 0.25 * sm.jug : -1.05) * sstep(0, 0.6, sn) * (1 - 0.35 * sstep(0.75, 1, sn));
      out.push(add(add(mix(sm.lab, sm.lin, sx), mul(nv, bul)), mul(down, depth)));
    }
    for (let k = 1; k <= TOP; k++) { // quadratic from lingual crest through the mid point to the labial crest
      const t = k / (TOP + 1), a = mix(sm.lin, sm.mid, t), b = mix(sm.mid, sm.lab, t);
      out.push(mix(a, b, t));
    }
    return out;
  };
  let rings = samples.map((sm, i) => ring(sm, nrm[i]));
  { // attached gingiva and alveolar mucosa are smooth: only the free margin and papillae follow every embrasure
    const K = 4, src = rings;
    rings = src.map((rg, i) => rg.map((p, j) => {
      if (j >= P) return p;
      const depth = Math.pow(Math.sin((j / (P - 1)) * Math.PI), 2 / m), w = sstep(0.06, 0.4, depth) * 0.85;
      if (w <= 0) return p;
      let acc = [0, 0, 0], n = 0; for (let k = -K; k <= K; k++) { const q = src[Math.min(src.length - 1, Math.max(0, i + k))][j]; acc = add(acc, q); n++; }
      return mix(p, mul(acc, 1 / n), w);
    }));
  }
  if (R0 && R0.coreRings.length === rings.length) { // anchor everything below the free gingiva to the fixed jaw
    rings = rings.map((rg, i) => rg.map((p, j) => {
      if (j >= P) return p;
      const w = sstep(0.12, 0.55, Math.pow(Math.sin((j / (P - 1)) * Math.PI), 2 / m));
      return mix(p, R0.coreRings[i][j], w);
    }));
  }
  const coreRings = rings;
  // rounded ends behind the last teeth (retromolar pads), closing the tube
  const cap = (r0, dir) => {
    const c = mul(r0.reduce((acc, p) => add(acc, p), [0, 0, 0]), 1 / r0.length), out = [];
    for (let e = 1; e <= opt.ends; e++) {
      const f = e / opt.ends, k = Math.sqrt(Math.max(0, 1 - f * f));
      out.push(r0.map((p) => add(add(c, mul(sub(p, c), k)), add(mul(dir, f * 5.5), mul(down, f * 1.2)))));
    }
    return out;
  };
  const d0 = sub(samples[0].mid, samples[Math.min(3, samples.length - 1)].mid), d1 = sub(samples[samples.length - 1].mid, samples[Math.max(0, samples.length - 4)].mid);
  const hz = (d) => { const v = [d[0], 0, d[2]], l = len(v) || 1; return mul(v, 1 / l); };
  rings = [...cap(rings[0], hz(d0)).reverse(), ...rings, ...cap(rings[rings.length - 1], hz(d1))];
  // flatten
  const nR = rings.length, positions = new Float32Array(nR * R * 3), uv = new Float32Array(nR * R * 2), shade = new Float32Array(nR * R);
  let arc = 0;
  for (let i = 0; i < nR; i++) {
    if (i > 0) arc += len(sub(rings[i][P + (TOP >> 1)], rings[i - 1][P + (TOP >> 1)]));
    for (let j = 0; j < R; j++) {
      const q = rings[i][j], o = i * R + j;
      positions.set(q, o * 3);
      uv[o * 2] = arc / 8; uv[o * 2 + 1] = ((j / R) * (2 * opt.H + 14)) / 8; // roughly isotropic, ~8 mm per tile
      const sn = j < P ? Math.sin((j / (P - 1)) * Math.PI) : 0;
      shade[o] = 1 - sstep(0, 0.55, sn); // 1 at the free margin, 0 deep on the alveolar body
    }
  }
  const index = new Uint32Array((nR - 1) * R * 6); let w = 0;
  for (let i = 0; i < nR - 1; i++) for (let j = 0; j < R; j++) {
    const a = i * R + j, b = i * R + ((j + 1) % R), c = a + R, d = b + R;
    if (jaw === 'upper') { index[w++] = a; index[w++] = c; index[w++] = b; index[w++] = b; index[w++] = c; index[w++] = d; }
    else { index[w++] = a; index[w++] = b; index[w++] = c; index[w++] = b; index[w++] = d; index[w++] = c; } // mirrored profile: keep faces pointing out
  }
  return { positions, index, uv, shade, coreRings, rings: nR, ringSize: R, samples, frames: F, pushes, profile: P, ends: opt.ends };
}
