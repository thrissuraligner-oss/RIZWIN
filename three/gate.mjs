// Reality gate: measures the 3D teeth and fails (exit 1) if the occlusion is not anatomically plausible.
import { TEETH, idealPlacements, placementsAt, worldVertices, CONCERNS } from './dental-core.mjs';

const REF = { // reference ranges for crown size (mm): [min, max] mesiodistal width
  U1: [8, 9.5], U2: [6, 7.5], U3: [7, 8.5], U4: [6.5, 7.5], U5: [6, 7.5], U6: [9.5, 11], U7: [8.5, 10],
  L1: [4.8, 5.8], L2: [5.2, 6.5], L3: [6.5, 7.5], L4: [6.5, 7.5], L5: [6.8, 7.8], L6: [10.5, 11.8], L7: [9.8, 11],
};
const fails = [], notes = [];
const check = (ok, msg) => { (ok ? notes : fails).push((ok ? 'ok   ' : 'FAIL ') + msg); };

for (const jaw of ['upper', 'lower']) for (const t of TEETH[jaw]) check(t.w >= REF[t.id][0] && t.w <= REF[t.id][1], `${t.id} width ${t.w} mm within ${REF[t.id]}`);

import { build, metrics, contacts } from './gate-lib.mjs';
// ---------- every crown, as actually generated, matches its textbook measurements (Wheeler) ----------
import { crownGeometry } from './dental-core.mjs';
for (const jaw of ['upper', 'lower']) for (const tooth of TEETH[jaw]) {
  const G = crownGeometry(tooth, { around: 72, side: 22, cap: 16, root: 3 }, jaw, 1), P = G.positions;
  let mx = 0, my = 0, zmin = 1e9, zmax = -1e9, cx = 0, czmin = 1e9, czmax = -1e9;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2]; if (y < 0) continue;
    mx = Math.max(mx, Math.abs(x)); my = Math.max(my, y); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
    if (y < 1e-6) { cx = Math.max(cx, Math.abs(x)); czmin = Math.min(czmin, z); czmax = Math.max(czmax, z); }
  }
  const got = { w: 2 * mx, h: my, t: zmax - zmin, cMD: 2 * cx, cLL: czmax - czmin }, tol = { w: 0.3, h: 0.3, t: 0.4, cMD: 0.3, cLL: 0.4 };
  const bad = Object.keys(got).filter((k) => Math.abs(got[k] - tooth[k]) > tol[k]);
  // anatomical landmarks (Wheeler): where the contacts and the labial height of contour sit, edge thickness, canine tip
  const hs = tooth.h - G.capRise, L = { contact: [0, 0], contour: [0, -1e9], tipX: 0, tipY: -1e9, edge: [1e9, -1e9] };
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2]; if (y < 0) continue;
    if (y <= hs + 1e-6 && Math.abs(x) > L.contact[0]) L.contact = [Math.abs(x), y / hs];
    if (y <= hs + 1e-6 && z > L.contour[1]) L.contour = [y / hs, z];
    if (y > L.tipY) { L.tipY = y; L.tipX = x; }
    if (Math.abs(y - (tooth.h - 1)) < 0.25 && Math.abs(x) < tooth.w * 0.2) { L.edge[0] = Math.min(L.edge[0], z); L.edge[1] = Math.max(L.edge[1], z); }
  }
  const CON = { incisor: [0.65, 1], canine: [0.5, 0.75], premolar: [0.55, 1], molar: [0.55, 1] }[tooth.type];
  const HOC = tooth.type === 'incisor' || tooth.type === 'canine' ? [0, 0.4] : [0.1, 0.5];
  const lm = [];
  if (L.contact[1] < CON[0] || L.contact[1] > CON[1]) lm.push(`contacts at ${(L.contact[1] * 100).toFixed(0)}% of crown height`);
  if (L.contour[0] < HOC[0] || L.contour[0] > HOC[1]) lm.push(`labial height of contour at ${(L.contour[0] * 100).toFixed(0)}%`);
  if (tooth.type === 'incisor') { const th = L.edge[1] - L.edge[0]; if (th < 0.6 || th > 2.0) lm.push(`edge ${th.toFixed(2)} mm thick 1 mm from the edge`); }
  if (tooth.type === 'canine' && !(L.tipX > 0.2)) lm.push('canine tip not mesial');
  check(!lm.length, `${tooth.id} landmarks: contacts at ${(L.contact[1] * 100).toFixed(0)}%, labial contour at ${(L.contour[0] * 100).toFixed(0)}% of crown height${tooth.type === 'incisor' ? `, edge ${(L.edge[1] - L.edge[0]).toFixed(2)} mm thick 1 mm from the edge` : ''}${tooth.type === 'canine' ? `, cusp tip ${L.tipX.toFixed(2)} mm mesial` : ''}${lm.length ? ' OFF: ' + lm.join('; ') : ''}`);
  check(!bad.length, `${tooth.id} crown measures ${Object.keys(got).map((k) => `${k} ${got[k].toFixed(2)}/${tooth[k]}`).join(', ')} mm (Wheeler)${bad.length ? ' off: ' + bad.join(',') : ''}`);
}
// ---------- ideal occlusion ----------
const ideal = build([...idealPlacements('upper'), ...idealPlacements('lower')]);
const M = metrics(ideal);
check(M.overjet >= 1.5 && M.overjetMax <= 3.8, `ideal overjet ${M.overjet.toFixed(2)}-${M.overjetMax.toFixed(2)} mm (target 1.5-3.8)`);
check(M.overbite >= 1.5 && M.overbiteMax <= 3.8, `ideal overbite ${M.overbite.toFixed(2)}-${M.overbiteMax.toFixed(2)} mm (target 1.5-3.8)`);
check(M.anteriorPenetration <= 0.35, `ideal: no lower incisor in front of / through an upper incisor (worst ${M.anteriorPenetration.toFixed(2)} mm)`);
check(M.buccalOverjet >= 1.0 && M.buccalOverjet <= 4.5, `upper first molars ${M.buccalOverjet.toFixed(2)} mm buccal to lower (target 1-4.5)`);
check(M.scissor < 0, `no scissor bite: upper palatal side inside lower buccal side (${M.scissor.toFixed(2)} mm)`);
check(M.molarVertical >= -0.4, `molars meet without interpenetrating (${M.molarVertical.toFixed(2)} mm)`);
check(M.classI <= 1.5, `Class I molar relationship within ${M.classI.toFixed(2)} mm (target <= 1.5)`);
const C = contacts(ideal);
const worstOv = C.reduce((a, c) => (c.overlap > a.overlap ? c : a)), worstGap = C.reduce((a, c) => (c.gap > a.gap ? c : a));
check(worstOv.overlap <= 1.5, `ideal contacts: largest crown overlap ${worstOv.overlap.toFixed(2)} mm² at ${worstOv.pair} (<= 1.5)`);
check(worstGap.gap <= 0.6, `ideal contacts: largest gap ${worstGap.gap.toFixed(2)} mm at ${worstGap.pair} (<= 0.6)`);

// ---------- each concern: the "before" shows the problem, every frame keeps the upper incisors in front ----------
const feature = {
  crowd: (m, c, S) => [Math.max(...c.filter((x) => /^[UL][123]/.test(x.pair)).map((x) => x.overlap)) <= 6, 'crowded teeth overlap in the arch but do not merge (overlap <= 6 mm²)'],
  space: (m, c) => { const g = Math.min(...c.filter((x) => /^U1L-U1R|^U1R-U2R|^U2L-U1L/.test(x.pair)).map((x) => x.gap)); return [g >= 0.8, `visible spaces between upper front teeth (smallest ${g.toFixed(2)} mm >= 0.8)`]; },
  open: (m) => [m.overbite <= -1.0, `front teeth do not meet: vertical gap ${(-m.overbite).toFixed(2)} mm (>= 1.0)`],
  deep: (m) => [m.overbite >= 4.5, `deep overbite ${m.overbite.toFixed(2)} mm (>= 4.5)`],
  forward: (m) => [m.overjet >= 6, `large overjet ${m.overjet.toFixed(2)} mm (>= 6)`],
};
for (const k of Object.keys(CONCERNS)) {
  const S0 = build(placementsAt(k, 0)), m0 = metrics(S0), c0 = contacts(S0);
  const [ok, msg] = feature[k](m0, c0, S0); check(ok, `${k} before: ${msg}`);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const S = build(placementsAt(k, t)), m = metrics(S);
    check(m.overjet >= 0.8, `${k} t=${t}: upper incisors in front of lower (overjet ${m.overjet.toFixed(2)} mm >= 0.8)`);
    check(m.anteriorPenetration <= 0.5, `${k} t=${t}: incisors do not pass through each other (${m.anteriorPenetration.toFixed(2)} mm)`);
    const c = contacts(S), wo = Math.max(...c.map((x) => x.overlap));
    check(wo <= 6, `${k} t=${t}: neighbouring crowns never merge (max overlap ${wo.toFixed(2)} mm²)`);
  }
}
// ---------- settled occlusion: every upper premolar and molar rests on the lower teeth in every frame ----------
import { posteriorClearance } from './dental-core.mjs';
for (const k of Object.keys(CONCERNS)) for (const t of [0, 0.5, 1]) {
  const pls = placementsAt(k, t); let lo = Infinity, hi = -Infinity, worst = '';
  for (const u of pls.filter((p) => p.jaw === 'upper' && p.i >= 3)) {
    const c = posteriorClearance(u, pls.filter((l) => l.jaw === 'lower' && l.side === u.side && l.i >= 2));
    if (c > hi) { hi = c; worst = u.tooth.id + (u.side > 0 ? 'R' : 'L'); } lo = Math.min(lo, c);
  }
  check(hi <= 0.3 && lo >= -0.3, `${k} t=${t}: back teeth settled in contact, cusp clearance ${lo.toFixed(2)} to ${hi.toFixed(2)} mm (worst ${worst}; target -0.3 to 0.3)`);
}

// ---------- gums: built from the same crowns, they must hug every tooth, never climb onto a crown, and never tear ----------
import { buildGum, insideCrown } from './gum-core.mjs';
for (const k of Object.keys(CONCERNS)) for (const t of [0, 0.25, 0.5, 0.75, 1]) for (const jaw of ['upper', 'lower']) {
  const G = buildGum(placementsAt(k, t), jaw, undefined, placementsAt(k, 1)), tag = `${k} t=${t} ${jaw} gum`;
  let finite = true; for (const v of G.positions) if (!Number.isFinite(v)) { finite = false; break; }
  // no visible crown is covered: every crest and papilla point lies outside every crown it does not belong to
  let inside = 0; for (const sm of G.samples) for (const w of ['lab', 'lin']) if (G.frames.some((f) => f.key !== sm.owner && insideCrown(f, sm[w], 0.97))) inside++;
  // margin hugs its own tooth: labial crest at mid-tooth sits 0.2-0.8 mm outside the crown surface
  let hugBad = 0, expoBad = 0, maxPush = Math.max(0, ...G.pushes);
  for (const f of G.frames) {
    const sm = G.samples.find((x) => x.owner === f.key && Math.abs(x.s) < 1e-6); if (!sm) continue;
    const [lx, ly, lz] = f.toLocal(sm.lab), v = ly / f.shape.hs, { b, zc } = f.shape.sec(v), gap = lz - (zc + b);
    if (gap < 0.2 || gap > 0.8) hugBad++;
    const exposed = 1 - (ly / f.shape.h); if (f.pl.i <= 2 && (exposed < 0.8 || exposed > 0.95)) expoBad++;
  }
  // continuity: no tears along the arch
  let tear = 0; for (let i = 1; i < G.samples.length; i++) tear = Math.max(tear, Math.hypot(...[0, 1, 2].map((d) => G.samples[i].lab[d] - G.samples[i - 1].lab[d])));
  // the finished result must look like healthy, settled gums; overlapping crowded teeth may tuck a papilla behind a neighbour before treatment
  const [pushLim, tearLim] = t === 1 ? [0.6, 2.5] : [5.5, 5];
  // the jaw itself never moves: the gum base matches the finished arch within 0.05 mm
  const R1 = buildGum(placementsAt(k, 1), jaw); let baseMove = 0; const Pm = Math.floor(G.profile / 2);
  for (let i = 0; i < G.coreRings.length; i++) baseMove = Math.max(baseMove, Math.hypot(...[0, 1, 2].map((d) => G.coreRings[i][Pm][d] - R1.coreRings[i][Pm][d])));
  check(baseMove <= 0.05, `${tag}: jaw (gum base) stays fixed while the teeth move (moved ${baseMove.toFixed(3)} mm)`);
  check(finite && inside === 0 && hugBad === 0 && expoBad === 0 && tear < tearLim && maxPush <= pushLim,
    `${tag}: hugs every crown (${hugBad} off), covers no visible crown (${inside} points), front crowns ${expoBad ? 'badly' : '80-95%'} exposed, labial papillae pressed ${maxPush.toFixed(1)} mm max (<= ${pushLim}), largest step ${tear.toFixed(2)} mm (< ${tearLim})`);
}
const quiet = process.argv.includes('--quiet');
if (!quiet) console.log(notes.join('\n'));
if (fails.length) { console.log(fails.join('\n')); console.log(`\nREALITY GATE FAILED: ${fails.length} check(s)`); process.exit(1); }
console.log(`REALITY GATE PASSED: ${notes.length} checks`);
