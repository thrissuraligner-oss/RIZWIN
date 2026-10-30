// Anatomical dental geometry, shared by the browser renderer and the Node reality gate.
// Units are millimetres. World axes: x = patient's left/right, y = up (occlusal plane at y = 0), z = towards the viewer (anterior).
// Crown sizes follow standard dental anatomy tables (mesiodistal width, crown height, labiolingual thickness).

// Crown measurements (mm) from Wheeler's Dental Anatomy, Physiology and Occlusion (standard reference table):
// w = mesiodistal crown width, h = crown length (cervical line to incisal edge / cusp tip), t = labiolingual crown width,
// cMD / cLL = mesiodistal / labiolingual width at the cervix, cej = curvature of the cervical line (mesial).
export const TEETH = {
  upper: [
    { id: 'U1', type: 'incisor', w: 8.5, h: 10.5, t: 7.0, cMD: 7.0, cLL: 6.0, cej: 3.5 },
    { id: 'U2', type: 'incisor', w: 6.5, h: 9.0, t: 6.0, cMD: 5.0, cLL: 5.0, cej: 3.0 },
    { id: 'U3', type: 'canine', w: 7.5, h: 10.0, t: 8.0, cMD: 5.5, cLL: 7.0, cej: 2.5 },
    { id: 'U4', type: 'premolar', w: 7.0, h: 8.5, t: 9.0, cMD: 5.0, cLL: 8.0, cej: 1.0 },
    { id: 'U5', type: 'premolar', w: 6.5, h: 8.5, t: 9.0, cMD: 5.0, cLL: 8.0, cej: 1.0 },
    { id: 'U6', type: 'molar', w: 10.0, h: 7.5, t: 11.0, cMD: 8.0, cLL: 10.0, cej: 1.0 },
    { id: 'U7', type: 'molar', w: 9.0, h: 7.0, t: 11.0, cMD: 7.0, cLL: 10.0, cej: 1.0 },
  ],
  lower: [
    { id: 'L1', type: 'incisor', w: 5.0, h: 9.0, t: 6.0, cMD: 3.5, cLL: 5.3, cej: 3.0 },
    { id: 'L2', type: 'incisor', w: 5.5, h: 9.5, t: 6.5, cMD: 4.0, cLL: 5.8, cej: 3.0 },
    { id: 'L3', type: 'canine', w: 7.0, h: 11.0, t: 7.5, cMD: 5.5, cLL: 7.0, cej: 2.5 },
    { id: 'L4', type: 'premolar', w: 7.0, h: 8.5, t: 7.5, cMD: 5.0, cLL: 6.5, cej: 1.0 },
    { id: 'L5', type: 'premolar', w: 7.0, h: 8.0, t: 8.0, cMD: 5.0, cLL: 7.0, cej: 1.0 },
    { id: 'L6', type: 'molar', w: 11.0, h: 7.5, t: 10.5, cMD: 9.0, cLL: 9.0, cej: 1.0 },
    { id: 'L7', type: 'molar', w: 10.5, h: 7.0, t: 10.0, cMD: 8.5, cLL: 9.0, cej: 1.0 },
  ],
};
// distal-incisal corner rounding (fraction of half-width), larger on laterals; lower incisors are nearly symmetric
const CORNER = { U1: [0.04, 0.16], U2: [0.07, 0.3], L1: [0.03, 0.04], L2: [0.04, 0.1] };
// which local x direction is mesial for a placement (+1: +x mesial, -1: -x mesial); upper crowns are flipped about z
export const mesialSign = (pl) => (pl.jaw === 'upper' ? -1 : 1) * (pl.side > 0 ? -1 : 1);

// Ideal occlusion targets (used to build the ideal arches; verified by the gate from real geometry)
export const IDEAL = { overbite: 2.5, upperTorque: 17, lowerTorque: 6 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- one crown, in its own frame: x mesiodistal, y along the crown (cervical 0 -> tip h), z labial/buccal ----------
export function crownShape(tooth) {
  const { type, w, h, t } = tooth;
  const capRise = type === 'incisor' ? 0.9 : type === 'canine' ? 0.7 : type === 'premolar' ? 2.2 : 1.9;
  const hs = h - capRise; // height where the side wall meets the occlusal/incisal cap
  const n = type === 'incisor' ? 2.25 : type === 'canine' ? 2.1 : 2.35; // superellipse exponent: rounded sections
  const { cMD, cLL } = tooth;
  const sec = (v) => {
    const u = Math.max(0, v);
    let a, b, zc = 0;
    if (type === 'incisor') { // widest at the incisal-third contacts; thickest at the cervical-third height of contour; thin incisal edge
      a = lerp(cMD / 2, w / 2, Math.pow(sstep(0, 0.78, u), 0.85));
      const edge = 0.42;
      b = u < 0.2 ? lerp(cLL / 2, t / 2, sstep(0, 0.2, u)) : t / 2 - (t / 2 - edge) * Math.pow(sstep(0.2, 1, u), 1.15);
      zc = t * 0.14 * u;
    } else if (type === 'canine') {
      const vc = 0.62; // contact areas at the junction of the middle and incisal thirds
      a = u < vc ? lerp(cMD / 2, w / 2, sstep(0, vc, u)) : (w / 2) * (1 - 0.8 * Math.pow((u - vc) / (1 - vc), 1.15)); // cusp ridges slope to the tip
      b = u < 0.25 ? lerp(cLL / 2, t / 2, sstep(0, 0.25, u)) : (t / 2) * (1 - 0.55 * Math.pow(sstep(0.25, 1, u), 1.3));
      zc = t * 0.08 * u;
    } else { // posterior: contacts in the occlusal third, buccal height of contour in the cervical third
      a = lerp(cMD / 2, w / 2, sstep(0, 0.7, u)) * (1 - 0.05 * sstep(0.88, 1, u));
      b = lerp(cLL / 2, t / 2, sstep(0, 0.35, u)) * (1 - 0.07 * sstep(0.8, 1, u));
    }
    if (v < 0) { const k = 1 + v * 0.18; a *= k; b *= k; } // root, tapering into the gum
    return { a, b, zc };
  };
  return { sec, n, hs, h, capRise };
}
// gum margin levels, as a fraction of the side wall height: mid-labial margin and papilla tip at the contacts
export const GUM_LEVEL = { incisor: [0.12, 0.46], canine: [0.13, 0.4], premolar: [0.13, 0.34], molar: [0.12, 0.3] }; // free gingival margin ~1 mm above the CEJ

// occlusal anatomy: rounded cusps joined by a smooth max, a central fissure and buccal/lingual grooves, marginal ridges.
// returns [height factor 0..~1.1, cavity 0..1] at local (x, z) on the occlusal table, r = 0 centre .. 1 rim
function occlusal(tooth, x, z, r, jaw, ms = 0) {
  const { type, w, t } = tooth, A = w / 2, B = t / 2;
  if (type === 'canine' && ms) x -= ms * A * 0.12;
  const dome = (cx, cz, rx, rz, hgt) => { const d2 = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2; return d2 >= 1 ? 0 : hgt * Math.pow(1 - d2, 0.55); };
  const smax = (arr) => Math.pow(arr.reduce((s, v) => s + v ** 5, 0), 1 / 5);
  if (type === 'incisor') return [1 - r * r, 0];
  if (type === 'canine') return [1 - r * r, 0]; // the cusp itself is formed by the tapering crown; this just rounds the tip
  if (false) {
    const d2 = (x / (A * 0.84)) ** 2 + ((z - B * 0.06) / (B * 0.6)) ** 2, tip = d2 >= 1 ? 0 : 0.55 * (1 - Math.sqrt(d2)) + 0.45 * Math.pow(1 - d2, 1.6); // blunt, rounded cusp tip (worn canine), not a spike
    const ridge = 0.4 * Math.max(0, 1 - Math.abs(x) / A) * Math.exp(-(((z - B * 0.1) / (B * 0.45)) ** 2));
    return [smax([tip, ridge, 0.2]), 0];
  }
  let F, g = 0;
  const groove = (d, wd) => Math.exp(-((d / wd) ** 2));
  const fade = 1 - sstep(0.62, 0.92, Math.abs(x) / A); // grooves stop at the marginal ridges
  if (type === 'premolar') {
    F = smax([dome(0, B * 0.42, A * 0.95, B * 0.72, 1), dome(0, -B * 0.48, A * 0.85, B * 0.62, jaw === 'upper' ? 0.85 : 0.6), 0.3]);
    g = groove(z + B * 0.02, 0.32) * fade;
  } else if (jaw === 'upper') {
    F = smax([dome(-A * 0.46, B * 0.5, A * 0.62, B * 0.55, 1), dome(A * 0.46, B * 0.5, A * 0.6, B * 0.55, 0.92),
      dome(-A * 0.44, -B * 0.5, A * 0.66, B * 0.58, 1.05), dome(A * 0.5, -B * 0.52, A * 0.52, B * 0.5, 0.72), 0.3]);
    g = Math.max(groove(z, 0.34) * fade, groove(x, 0.34) * sstep(0.15, 0.6, z / B), groove(x - A * 0.1, 0.34) * sstep(0.15, 0.6, -z / B) * 0.8);
  } else {
    F = smax([dome(-A * 0.6, B * 0.5, A * 0.45, B * 0.55, 0.85), dome(0, B * 0.52, A * 0.45, B * 0.55, 0.85), dome(A * 0.62, B * 0.45, A * 0.4, B * 0.5, 0.7),
      dome(-A * 0.42, -B * 0.5, A * 0.6, B * 0.55, 1), dome(A * 0.45, -B * 0.5, A * 0.55, B * 0.55, 0.95), 0.3]);
    g = Math.max(groove(z, 0.34) * fade, groove(x + A * 0.3, 0.32) * sstep(0.15, 0.6, z / B), groove(x - A * 0.3, 0.32) * sstep(0.15, 0.6, z / B), groove(x, 0.32) * sstep(0.15, 0.6, -z / B));
  }
  const ridge = 0.22 * Math.exp(-(((r - 0.84) / 0.1) ** 2)); // marginal ridge around the occlusal table
  const Fh = Math.max(F, ridge + 0.3) - 0.3 * g;
  return [Fh, Math.min(1, g * 1.1 + Math.max(0, 0.45 - Fh) * 0.8)];
}

export function crownGeometry(tooth, seg = { around: 48, side: 16, cap: 8, root: 3 }, jaw = tooth.id[0] === 'U' ? 'upper' : 'lower', ms = 0) {
  const { type, w, h, t } = tooth;
  const { sec, n, hs, capRise } = crownShape(tooth);
  const corner = CORNER[tooth.id] || [0, 0];
  const ring = (v, y) => {
    const { a, b, zc } = sec(v); const pts = [];
    for (let i = 0; i < seg.around; i++) {
      const th = (i / seg.around) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      let z = zc + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      if (s > 0 && v > 0.2) { // labial face: developmental lobes on incisors, the vertical ridge on canines
        const k = sstep(0.2, 0.7, v) * s;
        if (type === 'incisor') z += 0.09 * k * Math.cos((x / a) * Math.PI * 1.5) ** 2;
        else if (type === 'canine') z += 0.22 * k * Math.exp(-((x / (a * 0.35)) ** 2));
      }
      if (s < 0 && (type === 'incisor' || type === 'canine') && v > 0) { // lingual: cingulum near the neck, shallow fossa between marginal ridges
        const xr = Math.min(1, Math.abs(x) / a), inner = Math.max(0, 1 - xr * xr) * (-s);
        z += inner * (0.45 * Math.exp(-(((v - 0.6) / 0.2) ** 2)) - 0.25 * Math.exp(-(((v - 0.15) / 0.1) ** 2))) * (type === 'incisor' ? 1 : 0.6);
      }
      if (ms && type === 'canine' && v > 0.62) x += ms * (w / 2) * 0.12 * sstep(0.62, 1, v); // mesial cusp ridge shorter than distal (Wheeler)
      if (ms && type === 'incisor' && v > 0.7) { // incisal corners: sharp mesially, rounded distally (Wheeler)
        const distal = x * ms < 0, k = (distal ? corner[1] : corner[0]) * sstep(0.7, 1, v) * Math.pow(Math.min(1, Math.abs(x) / a), 3);
        x *= 1 - k;
      }
      pts.push([x, y, z]);
    }
    return pts;
  };
  const env = (r) => (type === 'incisor' ? Math.sqrt(Math.max(0, 1 - r * r)) : Math.pow(Math.max(0, 1 - r ** 2.4), 0.42)); // incisors: a round-ended edge
  const top0 = ring(1, hs);
  let peak = 0; // highest point of the raw occlusal surface, so cusp tips land exactly at the measured crown length
  for (let k = 0; k <= 24; k++) { const r = k / 24; for (const [x0, , z0] of top0) peak = Math.max(peak, occlusal(tooth, x0 * r, z0 * r, r, jaw, ms)[0] * env(r)); }
  const capScale = peak > 0 ? 1 / peak : 1;
  const cap = (x, z, r) => occlusal(tooth, x, z, r, jaw, ms)[0] * env(r) * capRise * capScale;
  const cav = (x, z, r) => occlusal(tooth, x, z, r, jaw, ms)[1];
  const positions = [], uvy = [], index = [];
  const rows = [];
  // root rings (below cervical, hidden in gum) then side rings
  for (let k = seg.root; k >= 1; k--) rows.push(ring(-k / seg.root, -k * 1.4));
  for (let k = 0; k <= seg.side; k++) { const v = k / seg.side; rows.push(ring(v, v * hs)); }
  // occlusal cap rings, shrinking to the centre
  const top = rows[rows.length - 1];
  const ox = top.reduce((q, p) => q + p[0], 0) / top.length, oz = top.reduce((q, p) => q + p[2], 0) / top.length;
  for (let k = seg.cap - 1; k >= 1; k--) {
    const r = k / seg.cap;
    rows.push(top.map(([x, y, z]) => { const dx = (x - ox) * r, dz = (z - oz) * r; return [ox + dx, hs + cap(dx, dz, r), oz + dz]; })); // shrink towards the top ring's own centre
  }
  const cavity = [];
  rows.forEach((row, ri) => { const capK = ri - (seg.root + seg.side); for (const p of row) { positions.push(p[0], p[1], p[2]); uvy.push(Math.max(0, p[1]) / h); cavity.push(capK > 0 ? cav(p[0] - ox, p[2] - oz, 1 - capK / seg.cap) : 0); } });
  const N = seg.around;
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < N; i++) {
    const a = r * N + i, b = r * N + (i + 1) % N, c = (r + 1) * N + i, d = (r + 1) * N + (i + 1) % N;
    index.push(a, c, b, b, c, d);
  }
  const centre = positions.length / 3; positions.push(ox, hs + cap(0, 0, 0), oz); uvy.push((hs + cap(0, 0, 0)) / h); cavity.push(cav(0, 0, 0));
  const last = (rows.length - 1) * N;
  for (let i = 0; i < N; i++) index.push(last + i, centre, last + (i + 1) % N);
  return { positions: new Float32Array(positions), index: new Uint32Array(index), height: uvy, cavity, hs, capRise, rows: rows.length, around: N };
}

// ---------- arch forms ----------
// Parabolic-elliptic arch through the incisor point: z = d * (1 - |x/a|^p); teeth placed by arc length from the midline.
import PARAMS from './dental-params.json' with { type: 'json' };
export const ARCH = PARAMS.arch;
export const PACK = PARAMS.pack; // per-jaw arc-length corrections (mm) that close contacts exactly
function archPoint(A, x) { return [x, A.d * (1 - Math.pow(Math.abs(x) / A.a, A.p))]; }
function archAt(A, s) { // walk the curve from the midline (x >= 0) until arc length s
  let x = 0, len = 0, [px, pz] = archPoint(A, 0); const dx = 0.02;
  while (len < s && x < A.a * 1.25) { x += dx; const [qx, qz] = archPoint(A, x); len += Math.hypot(qx - px, qz - pz); px = qx; pz = qz; }
  const [ax, az] = archPoint(A, x - dx), [bx, bz] = archPoint(A, x + dx);
  const tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz);
  return { p: [px, pz], t: [tx / L, tz / L] };
}

// Tooth placements for an ideal arch, before any malocclusion. side: +1 right, -1 left
function rawIdealPlacements(jaw, extraGap = 0) {
  const A = ARCH[jaw], list = TEETH[jaw], out = [];
  for (const side of [1, -1]) {
    let s = 0;
    list.forEach((tooth, i) => {
      s += (i === 0 ? 0 : list[i - 1].w / 2 + extraGap) + tooth.w / 2 + (i === 0 ? extraGap / 2 : 0);
      const { p, t } = archAt(A, s + ((PACK[jaw] || [])[i] || 0));
      const ant = i <= 2;
      const torque = jaw === 'upper' ? (ant ? IDEAL.upperTorque * (i === 2 ? 0.5 : 1) : -4) : (ant ? IDEAL.lowerTorque : -6);
      // vertical: crown tips on the occlusal plane, upper incisors overlap the lower by the overbite
      const tipY = jaw === 'upper' ? (ant ? -(i === 2 ? 1.5 : IDEAL.overbite) : 0.25) : 0;
      out.push({ tooth, jaw, side, i, x: p[0] * side, z: p[1], tx: t[0] * side, tz: t[1], tipY, torque, rot: 0, dx: 0, dz: 0, dy: 0 });
    });
  }
  return out;
}

// Settled occlusion: every upper premolar and molar is seated vertically onto the lower arch so its cusps touch
// (0.05 mm clearance) instead of hovering - the finished, settled result of treatment. Computed once from the real crowns.
const SETTLE_CLEAR = 0.05, SETTLE_CELL = 0.5;
let SETTLE = null;
export function posteriorClearance(upperPl, lowers) { // smallest vertical gap (mm) between one upper posterior crown and the lower crowns under it; negative = interpenetration
  const g = new Map(), key = (x, z) => `${Math.round(x / SETTLE_CELL)},${Math.round(z / SETTLE_CELL)}`;
  for (const lp of lowers) { const v = worldVertices(lp); for (let i = 0; i < v.length; i += 3) { if (v[i + 1] < -4) continue; const k = key(v[i], v[i + 2]); const c = g.get(k); if (c == null || v[i + 1] > c) g.set(k, v[i + 1]); } }
  const v = worldVertices(upperPl); let best = Infinity;
  for (let i = 0; i < v.length; i += 3) { if (v[i + 1] > 4 + upperPl.dy) continue; const c = g.get(key(v[i], v[i + 2])); if (c != null) best = Math.min(best, v[i + 1] - c); }
  return best;
}
function settleOffsets() {
  if (SETTLE) return SETTLE;
  SETTLE = {};
  const U = rawIdealPlacements('upper'), L = rawIdealPlacements('lower');
  for (const pl of U) {
    if (pl.i < 3) continue;
    const lowers = L.filter((l) => l.side === pl.side && l.i >= 2);
    let dy = 0;
    for (let it = 0; it < 4; it++) { const c = posteriorClearance({ ...pl, dy }, lowers); if (!isFinite(c)) break; dy -= c - SETTLE_CLEAR; if (Math.abs(c - SETTLE_CLEAR) < 0.01) break; }
    SETTLE[pl.i + ':' + pl.side] = dy;
  }
  return SETTLE;
}
const IDEAL_CACHE = new Map();
export function idealPlacements(jaw, extraGap = 0) {
  const ck = jaw + ':' + extraGap; if (IDEAL_CACHE.has(ck)) return IDEAL_CACHE.get(ck).map((p) => ({ ...p })); // the arch walk is costly; placements are fixed
  const out = idealPlacementsUncached(jaw, extraGap); IDEAL_CACHE.set(ck, out); return out.map((p) => ({ ...p }));
}
function idealPlacementsUncached(jaw, extraGap) {
  const out = rawIdealPlacements(jaw, extraGap);
  if (jaw !== 'upper') return out;
  const S = settleOffsets();
  return out.map((pl) => (pl.i >= 3 ? { ...pl, tipY: pl.tipY + (S[pl.i + ':' + pl.side] || 0) } : pl));
}

// world transform of one placement (with deviations dx along the arch, dz labial, dy vertical, rot about the long axis, extra torque)
export function placementMatrix(pl) {
  // basis: X along the arch in +x direction (mesial on the left side, distal on the right), Z outward, Y up
  let X = [pl.tx * (pl.side === 1 ? 1 : -1), 0, pl.tz * (pl.side === 1 ? 1 : -1)];
  if (X[0] < 0) X = X.map((v) => -v);
  const Y = [0, 1, 0];
  const Z = [-X[2], 0, X[0]]; // X x Y
  const h = pl.tooth.h;
  const ty = pl.jaw === 'upper' ? pl.tipY + h + pl.dy : pl.tipY - h + pl.dy; // base (cervical) y
  const dd = pl.dx * pl.side; // dx is distal on both sides
  const base = [pl.x + X[0] * dd + Z[0] * pl.dz, ty, pl.z + X[2] * dd + Z[2] * pl.dz];
  const torque = ((pl.torque + (pl.dtorque || 0)) * Math.PI) / 180, rot = (pl.rot * Math.PI) / 180;
  const cT = Math.cos(torque), sT = Math.sin(torque), cR = Math.cos(rot), sR = Math.sin(rot);
  const upper = pl.jaw === 'upper';
  // local -> rotate about long axis (Ry) -> torque (Rx) -> flip for upper (Rz pi) -> world basis
  return (lx, ly, lz) => {
    let x = lx * cR + lz * sR, z = -lx * sR + lz * cR, y = ly;            // Ry
    let y2 = y * cT - z * sT, z2 = y * sT + z * cT; y = y2; z = z2;       // Rx (labial crown torque)
    if (upper) { x = -x; y = -y; }                                         // Rz(pi): crown points down
    return [base[0] + X[0] * x + Y[0] * y + Z[0] * z, base[1] + y, base[2] + X[2] * x + Z[2] * z];
  };
}

// ---------- malocclusions: per-tooth deviations at t = 0 (before); t = 1 is the ideal ----------
// Each returns a function (pl) -> { dx, dz, dy, rot, dtorque } in mm/degrees. Anterior = i <= 2.
export const CONCERNS = {
  crowd: (pl) => {
    const k = pl.side * (pl.i + 1);
    // [dx distal, dz labial, dy vertical, rotation about the long axis]
    // upper teeth only move labially and lower teeth only lingually (with enough clearance for each rotation), so incisors never pass through each other
    const table = { U: { 1: [0, 1.5, 0, 14], '-1': [0, 1.2, 0.2, -16], 2: [-0.7, 0.4, 0.5, 24], '-2': [-0.5, 2.1, 0, -20], 3: [-0.3, 2.6, -0.8, 12], '-3': [-0.4, 2.3, -0.6, -10] },
                    L: { 1: [0, -1.1, 0.2, -18], '-1': [0, -0.4, 0.3, 14], 2: [-0.4, -1.6, 0, 20], '-2': [-0.4, -0.5, 0.2, -22], 3: [-0.2, -0.7, 0, 8], '-3': [-0.2, -0.6, 0, -8] } };
    const r = table[pl.jaw === 'upper' ? 'U' : 'L'][String(k)];
    return r ? { dx: r[0], dz: r[1], dy: r[2], rot: r[3], dtorque: 0 } : { dx: 0, dz: 0, dy: 0, rot: 0, dtorque: 0 };
  },
  space: (pl) => { // spaced, slightly flared front teeth on a wider arc; canines stay against the premolars
    if (pl.i > 2) return { dx: 0, dz: 0, dy: 0, rot: 0, dtorque: 0 };
    const U = pl.jaw === 'upper';
    const dx = U ? [0.75, 1.2, 0.35][pl.i] : [0.5, 0.75, 0.2][pl.i];
    const dz = U ? [2.2, 1.6, 0.4][pl.i] : [0.9, 0.6, 0.15][pl.i];
    return { dx, dz, dy: 0, rot: 0, dtorque: U ? [6, 5, 0][pl.i] : [3, 2, 0][pl.i] };
  },
  open: (pl) => { // anterior open bite: front teeth fail to meet
    if (pl.i > 2) return { dx: 0, dz: 0, dy: 0, rot: 0, dtorque: 0 };
    const amt = pl.i === 2 ? 0.45 : 1;
    return { dx: 0, dz: 0, dy: (pl.jaw === 'upper' ? 4.6 : -2.2) * amt, rot: 0, dtorque: pl.jaw === 'upper' ? 4 * amt : 3 * amt };
  },
  deep: (pl) => { // deep overbite: upper incisors cover most of the lower incisors
    if (pl.i > 2) return { dx: 0, dz: 0, dy: 0, rot: 0, dtorque: 0 };
    const amt = pl.i === 2 ? 0.5 : 1;
    return pl.jaw === 'upper' ? { dx: 0, dz: 1.9 * amt, dy: -2.8 * amt, rot: 0, dtorque: -1 * amt } : { dx: 0, dz: -1.4 * amt, dy: 1.0 * amt, rot: 0, dtorque: -5 * amt };
  },
  forward: (pl) => { // proclined, flared upper incisors with spacing; large overjet
    if (pl.jaw !== 'upper' || pl.i > 2) return { dx: 0, dz: 0, dy: 0, rot: 0, dtorque: 0 };
    return { dx: [0.8, 1.3, 0.3][pl.i], dz: [4.6, 3.7, 1.0][pl.i], dy: [0.6, 0.5, 0][pl.i], rot: pl.side * [4, -6, 2][pl.i], dtorque: [14, 12, 4][pl.i] };
  },
};

export function placementsAt(concern, t) { // t = 0 before .. 1 ideal
  const u = 1 - t, f = CONCERNS[concern];
  return [...idealPlacements('upper'), ...idealPlacements('lower')].map((pl) => {
    const d = f(pl);
    return { ...pl, dx: d.dx * u, dz: d.dz * u, dy: d.dy * u, rot: d.rot * u, dtorque: d.dtorque * u };
  });
}

// transformed vertex positions for every tooth (used by the gate; the renderer applies the same matrix)
const GEO_CACHE = new Map();
export function geometryOf(tooth, ms = 0, jaw) { const k = tooth.id + ':' + ms; if (!GEO_CACHE.has(k)) GEO_CACHE.set(k, crownGeometry(tooth, undefined, jaw, ms)); return GEO_CACHE.get(k); }
export function worldVertices(pl) {
  const g = geometryOf(pl.tooth, mesialSign(pl), pl.jaw), m = placementMatrix(pl), out = new Float32Array(g.positions.length);
  for (let i = 0; i < g.positions.length; i += 3) { const p = m(g.positions[i], g.positions[i + 1], g.positions[i + 2]); out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; }
  return out;
}
export { sstep, lerp };
