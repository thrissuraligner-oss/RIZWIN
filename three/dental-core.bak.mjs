// Anatomical dental geometry, shared by the browser renderer and the Node reality gate.
// Units are millimetres. World axes: x = patient's left/right, y = up (occlusal plane at y = 0), z = towards the viewer (anterior).
// Crown sizes follow standard dental anatomy tables (mesiodistal width, crown height, labiolingual thickness).

export const TEETH = {
  upper: [
    { id: 'U1', type: 'incisor', w: 8.5, h: 10.5, t: 7.0 },
    { id: 'U2', type: 'incisor', w: 6.5, h: 9.0, t: 6.0 },
    { id: 'U3', type: 'canine', w: 7.5, h: 10.0, t: 8.0 },
    { id: 'U4', type: 'premolar', w: 7.0, h: 8.5, t: 9.0 },
    { id: 'U5', type: 'premolar', w: 6.5, h: 8.5, t: 9.0 },
    { id: 'U6', type: 'molar', w: 10.0, h: 7.5, t: 11.0 },
    { id: 'U7', type: 'molar', w: 9.0, h: 7.0, t: 11.0 },
  ],
  lower: [
    { id: 'L1', type: 'incisor', w: 5.0, h: 9.0, t: 6.0 },
    { id: 'L2', type: 'incisor', w: 5.5, h: 9.5, t: 6.5 },
    { id: 'L3', type: 'canine', w: 7.0, h: 11.0, t: 7.5 },
    { id: 'L4', type: 'premolar', w: 7.0, h: 8.5, t: 7.5 },
    { id: 'L5', type: 'premolar', w: 7.0, h: 8.0, t: 8.0 },
    { id: 'L6', type: 'molar', w: 11.0, h: 7.5, t: 10.5 },
    { id: 'L7', type: 'molar', w: 10.5, h: 7.0, t: 10.0 },
  ],
};

// Ideal occlusion targets (used to build the ideal arches; verified by the gate from real geometry)
export const IDEAL = { overbite: 2.5, upperTorque: 17, lowerTorque: 6 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- one crown, in its own frame: x mesiodistal, y along the crown (cervical 0 -> tip h), z labial/buccal ----------
export function crownGeometry(tooth, seg = { around: 48, side: 16, cap: 8, root: 3 }) {
  const { type, w, h, t } = tooth;
  const capRise = type === 'incisor' ? 0.4 : type === 'canine' ? 2.6 : type === 'premolar' ? 2.2 : 1.9;
  const hs = h - capRise; // height where the side wall meets the occlusal/incisal cap
  const n = type === 'incisor' ? 2.25 : type === 'canine' ? 2.1 : 2.35; // superellipse exponent: rounded sections
  const sec = (v) => {
    let a, b, zc = 0;
    if (type === 'incisor') {
      a = w / 2 * (0.77 + 0.23 * sstep(0, 0.5, v)) * (1 - 0.09 * sstep(0.86, 1, v)); // rounded incisal corners
      b = t / 2 * Math.max(0.17, 1 - 0.82 * Math.pow(Math.max(0, v), 1.25));
      zc = t * 0.16 * Math.max(0, v);
    } else if (type === 'canine') {
      a = w / 2 * (0.8 + 0.2 * sstep(0, 0.45, v)) * (1 - 0.18 * sstep(0.7, 1, v));
      b = t / 2 * Math.max(0.3, 1 - 0.45 * Math.max(0, v));
      zc = t * 0.1 * Math.max(0, v);
    } else {
      a = w / 2 * (0.8 + 0.2 * sstep(0, 0.45, v)) * (1 - 0.06 * sstep(0.85, 1, v));
      b = t / 2 * (0.82 + 0.18 * sstep(0, 0.4, v)) * (1 - 0.08 * sstep(0.8, 1, v));
    }
    if (v < 0) { const k = 1 + v * 0.18; a *= k; b *= k; } // root, tapering into the gum
    return { a, b, zc };
  };
  const ring = (v, y) => {
    const { a, b, zc } = sec(v); const pts = [];
    for (let i = 0; i < seg.around; i++) {
      const th = (i / seg.around) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      let z = zc + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      if (s > 0 && v > 0.2) { // labial face relief, fading out at the cervical third
        const k = sstep(0.2, 0.7, v) * s;
        if (type === 'incisor') z += 0.09 * k * Math.cos((x / a) * Math.PI * 1.5) ** 2;
        else if (type === 'canine') z += 0.22 * k * Math.exp(-((x / (a * 0.35)) ** 2));
      }
      pts.push([x, y, z]);
    }
    return pts;
  };
  const cap = (x, z, r) => { // height above hs over the occlusal/incisal table; r = 0 centre .. 1 rim
    const rim = 1 - sstep(0.55, 1, r);
    if (type === 'incisor') return capRise * (1 - r * r);
    if (type === 'canine') return capRise * Math.pow(1 - Math.min(1, Math.hypot(x / (w * 0.42), (z - t * 0.06) / (t * 0.3))), 1.3);
    const g = (cx, cz, sx, sz, amp) => amp * Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
    if (type === 'premolar') return (g(0, t * 0.2, w * 0.3, t * 0.2, capRise) + g(0, -t * 0.2, w * 0.3, t * 0.2, capRise * 0.75) - 0.35) * rim + 0.35 * rim;
    return (g(-w * 0.22, t * 0.2, w * 0.17, t * 0.17, capRise) + g(w * 0.22, t * 0.2, w * 0.17, t * 0.17, capRise * 0.92)
      + g(-w * 0.22, -t * 0.2, w * 0.17, t * 0.17, capRise * 0.95) + g(w * 0.22, -t * 0.2, w * 0.17, t * 0.17, capRise * 0.85) - 0.3) * rim + 0.3 * rim;
  };
  const positions = [], uvy = [], index = [];
  const rows = [];
  // root rings (below cervical, hidden in gum) then side rings
  for (let k = seg.root; k >= 1; k--) rows.push(ring(-k / seg.root, -k * 1.4));
  for (let k = 0; k <= seg.side; k++) { const v = k / seg.side; rows.push(ring(v, v * hs)); }
  // occlusal cap rings, shrinking to the centre
  const top = rows[rows.length - 1];
  for (let k = seg.cap - 1; k >= 1; k--) {
    const r = k / seg.cap;
    rows.push(top.map(([x, y, z]) => { const cx = x * r, cz = z * r; return [cx, hs + cap(cx, cz, r), cz]; }));
  }
  for (const row of rows) for (const p of row) { positions.push(p[0], p[1], p[2]); uvy.push(Math.max(0, p[1]) / h); }
  const N = seg.around;
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < N; i++) {
    const a = r * N + i, b = r * N + (i + 1) % N, c = (r + 1) * N + i, d = (r + 1) * N + (i + 1) % N;
    index.push(a, c, b, b, c, d);
  }
  const centre = positions.length / 3; positions.push(0, hs + cap(0, 0, 0), 0); uvy.push((hs + cap(0, 0, 0)) / h);
  const last = (rows.length - 1) * N;
  for (let i = 0; i < N; i++) index.push(last + i, centre, last + (i + 1) % N);
  return { positions: new Float32Array(positions), index: new Uint32Array(index), height: uvy, hs, capRise };
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
export function idealPlacements(jaw, extraGap = 0) {
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
export function geometryOf(tooth) { if (!GEO_CACHE.has(tooth.id)) GEO_CACHE.set(tooth.id, crownGeometry(tooth)); return GEO_CACHE.get(tooth.id); }
export function worldVertices(pl) {
  const g = geometryOf(pl.tooth), m = placementMatrix(pl), out = new Float32Array(g.positions.length);
  for (let i = 0; i < g.positions.length; i += 3) { const p = m(g.positions[i], g.positions[i + 1], g.positions[i + 2]); out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; }
  return out;
}
export { sstep, lerp };
