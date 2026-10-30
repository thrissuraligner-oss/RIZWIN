// Photoreal real-time 3D for alignerthrissur.com: concern simulator, closing spaces, story teeth and the aligner pressure former.
// Geometry comes from dental-core.mjs (anatomical crown sizes, arch forms) and is checked by gate.mjs before every build.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Group, BufferGeometry, BufferAttribute, Float32BufferAttribute, Color, Matrix4, Vector3,
  MeshPhysicalMaterial, MeshStandardMaterial, ShadowMaterial, DirectionalLight, HemisphereLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace,
  PCFSoftShadowMap, PlaneGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, LatheGeometry, Vector2, CanvasTexture, DataTexture, RepeatWrapping, RGBAFormat, LinearFilter, LinearMipmapLinearFilter, DoubleSide, Shape, ExtrudeGeometry, CircleGeometry, PointLight, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TEETH, crownGeometry, crownShape, GUM_LEVEL, mesialSign, idealPlacements, placementsAt, placementMatrix, CONCERNS } from '../dental-core.mjs';
import { buildGum } from '../gum-core.mjs';
import { separation } from '../geom2d.mjs';

const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ---------------- shared renderer setup ----------------
export const LITE = (() => {
  try { const n = navigator, c = n.connection || {}; return !!(c.saveData || /(^|-)2g$/.test(c.effectiveType || '') || (n.deviceMemory && n.deviceMemory <= 3) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4)); } catch (e) { return false; }
})();
function stage(host, { fov = 26, bg = null, ref = 1.6 } = {}) {
  const renderer = new WebGLRenderer({ antialias: !LITE, alpha: true, powerPreference: LITE ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1.25 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.className = 'r3d';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new Scene();
  if (bg) scene.background = new Color(bg);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  const camera = new PerspectiveCamera(fov, 1, 1, 2000);
  const key = new DirectionalLight(0xfff1e2, 3.1); key.position.set(-70, 110, 90); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -90; key.shadow.camera.right = 90; key.shadow.camera.top = 90; key.shadow.camera.bottom = -90; key.shadow.bias = -0.0004; key.shadow.radius = 4;
  const rim = new DirectionalLight(0xdfe6ff, 1.1); rim.position.set(-90, 40, -60);
  const fill = new HemisphereLight(0xffffff, 0x5a4a70, 0.55);
  const front = new DirectionalLight(0xfff6ee, 0.9); front.position.set(30, -10, 160);
  scene.add(key, rim, fill, front);
  let w = 0, h = 0;
  const resize = () => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return false;
    if (Math.round(r.width) === w && Math.round(r.height) === h) return false;
    w = Math.round(r.width); h = Math.round(r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // keep the same horizontal coverage on narrow (phone) frames
    camera.fov = camera.aspect >= ref ? fov : (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (ref / camera.aspect)) * 180) / Math.PI;
    camera.updateProjectionMatrix(); return true;
  };
  resize();
  return { renderer, scene, camera, key, resize, size: () => [w, h] };
}
function loop(host, tick) { // runs only while on screen; tick returns true while it needs more frames
  let visible = false, raf = 0, last = 0;
  const frame = (now) => { const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now; const more = tick(dt, now / 1000); raf = visible && more !== false ? requestAnimationFrame(frame) : 0; };
  const kick = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: '100px 0px' }).observe(host);
  window.addEventListener('resize', kick);
  return kick;
}

// ---------------- materials ----------------
// a tiling stipple/micro-relief normal map, generated once (no image download)
let STIPPLE = null;
function stipple() {
  if (STIPPLE) return STIPPLE;
  const N = 256, h = new Float32Array(N * N);
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (const [cells, amp] of [[8, 0.5], [16, 0.3], [32, 0.2], [64, 0.12]]) { // periodic value noise
    const g = new Float32Array(cells * cells); for (let k = 0; k < g.length; k++) g[k] = rnd(k + cells * 7.3);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, fy = (y / N) * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const s0 = tx * tx * (3 - 2 * tx), s1 = ty * ty * (3 - 2 * ty), G = (a, b) => g[((b + cells) % cells) * cells + ((a + cells) % cells)];
      h[y * N + x] += amp * ((G(x0, y0) * (1 - s0) + G(x0 + 1, y0) * s0) * (1 - s1) + (G(x0, y0 + 1) * (1 - s0) + G(x0 + 1, y0 + 1) * s0) * s1);
    }
  }
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)], dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    const nx = -dx * 6, ny = -dy * 6, l = Math.hypot(nx, ny, 1), o = (y * N + x) * 4;
    d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  const t = new DataTexture(d, N, N, RGBAFormat); t.wrapS = t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return (STIPPLE = t);
}
// enamel: ivory body, warm dentine shining through at the neck, cool translucent edges, glossy wet surface
// enamel micro-relief: fine horizontal perikymata and faint noise, which break up the highlights the way real enamel does
let PERI = null;
function perikymata() {
  if (PERI) return PERI;
  const N = 256, d = new Uint8Array(N * N * 4), h = (x, y) => 0.5 * Math.sin((y / N) * Math.PI * 2 * 22 + Math.sin((x / N) * Math.PI * 2 * 3) * 0.8) + 0.25 * Math.sin((x / N) * Math.PI * 2 * 9 + y * 0.05);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), nx = -dx * 2.5, ny = -dy * 2.5, l = Math.hypot(nx, ny, 1), o = (y * N + x) * 4;
    d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  const t = new DataTexture(d, N, N, RGBAFormat); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(4, 1); t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return (PERI = t);
}
// how see-through the crown is, up the crown: thin incisal enamel lets light (and the dark mouth) through
function edgeTranslucency(start, peak) {
  const N = 64, d = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) { const v = (i / (N - 1)) * 1.1, a = Math.round(255 * peak * sstep(start, 1.02, v)); d.set([a, a, a, 255], i * 4); }
  const t = new DataTexture(d, 1, N, RGBAFormat); t.magFilter = LinearFilter; t.needsUpdate = true; return t;
}
// enamel: ivory body, warm dentine at the neck, translucent incisal edges (real light transport on capable devices), wet gloss
const ENAMEL = (kind) => {
  const m = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.1, ior: 1.62, specularIntensity: 0.7,
    sheen: 0.3, sheenColor: new Color(0xfff4e6), sheenRoughness: 0.5, normalMap: perikymata(), normalScale: new Vector2(0.06, 0.06) });
  if (!LITE && kind !== 'posterior') {
    m.transmission = 1; m.transmissionMap = kind === 'incisor' ? edgeTranslucency(0.74, 0.35) : edgeTranslucency(0.85, 0.18);
    m.thickness = 1.6; m.attenuationColor = new Color(0xf3ddb8); m.attenuationDistance = 2.2;
  }
  return m;
};
// gingiva: deep raspberry tissue, lighter coral at the margins, wet clearcoat over a stippled surface
const GUM = () => new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.75, clearcoatRoughness: 0.16, normalMap: stipple(), normalScale: new Vector2(0.45, 0.45), sheen: 0.5, sheenColor: new Color(0xff8a92), sheenRoughness: 0.35, specularIntensity: 0.5 });
const ALIGNER = () => new MeshPhysicalMaterial({ color: 0xf4f8ff, roughness: 0.05, metalness: 0, transmission: 0.9, thickness: 0.6, ior: 1.5, transparent: true, opacity: 1, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 1, depthWrite: false, side: DoubleSide });

// ---------------- tooth meshes ----------------
const srgb = (h) => { const c = new Color(h); return [c.r, c.g, c.b]; }; // Color(hex) converts sRGB to linear
const E_NECK = srgb(0xd8bf90), E_BODY = srgb(0xf0e4cc), E_EDGE = srgb(0xc9d0d8), E_HALO = srgb(0xf6f4ee), E_FISSURE = srgb(0x86704f), E_ROOT = srgb(0xcdb48a);
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const GEO = new Map(), SHELL = new Map();
const SEG = LITE ? { around: 48, side: 14, cap: 12, root: 2 } : { around: 72, side: 22, cap: 16, root: 3 };
function toothGeometry(tooth, ms = 0, jaw) {
  const key = tooth.id + ':' + ms; if (GEO.has(key)) return GEO.get(key);
  const g = crownGeometry(tooth, SEG, jaw, ms), geo = new BufferGeometry(), N = g.around;
  geo.setAttribute('position', new BufferAttribute(g.positions, 3));
  geo.setIndex(new BufferAttribute(g.index, 1));
  const col = new Float32Array(g.positions.length), uv = new Float32Array((g.positions.length / 3) * 2), A = tooth.w / 2, B = tooth.t / 2;
  const tint = tooth.type === 'canine' ? [0.97, 0.94, 0.88] : tooth.type === 'incisor' ? [1, 1, 1] : [0.99, 0.98, 0.95]; // canines are a shade more chromatic
  { // no two natural teeth are the same shade: a small, repeatable per-tooth variation in value and warmth
    let hsh = 0; for (const ch of tooth.id + ms) hsh = (hsh * 31 + ch.charCodeAt(0)) % 9973;
    const r1 = ((hsh * 7919) % 1000) / 1000 - 0.5, r2 = ((hsh * 104729) % 1000) / 1000 - 0.5;
    tint[0] *= 1 + r1 * 0.04; tint[1] *= 1 + r1 * 0.035 - r2 * 0.01; tint[2] *= 1 + r1 * 0.03 - r2 * 0.03;
  }
  for (let i = 0; i < g.height.length; i++) {
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2], v = g.height[i];
    let c = y < 0 ? E_ROOT : mix3(E_NECK, E_BODY, sstep(0.02, 0.55, v));
    if (tooth.type === 'incisor') {
      // incisal third: translucent enamel with the dentine mamelons (three lobes) showing through, and a bright opalescent rim
      const lobes = Math.cos((x / A) * Math.PI * 1.5) ** 2, tr = sstep(0.7, 0.97, v) * (0.85 - 0.45 * lobes * (1 - sstep(0.9, 1, v)));
      c = mix3(c, E_EDGE, tr);
      c = mix3(c, E_HALO, sstep(0.975, 1.02, v) * 0.3);
    } else if (tooth.type === 'canine') c = mix3(c, E_EDGE, sstep(0.86, 1.05, v) * 0.35);
    else c = mix3(c, E_EDGE, sstep(0.9, 1.15, v) * 0.22);
    c = mix3(c, E_FISSURE, Math.min(1, (g.cavity[i] || 0) * 0.85));
    const prox = sstep(0.7, 1, Math.abs(x) / A) * sstep(0.05, 0.4, v); // contact areas fall into shadow
    const ao = 1 - 0.16 * prox - 0.06 * sstep(0, 1, -z / B);
    col.set([c[0] * ao * tint[0], c[1] * ao * tint[1], c[2] * ao * tint[2]], i * 3);
    uv[i * 2] = (i % N) / N; uv[i * 2 + 1] = Math.max(0, y) / tooth.h; // around the crown, up the crown
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  GEO.set(key, geo); return geo;
}
// an aligner shell: the crown surface above the gum, pushed out 0.5 mm along its normals (a real 0.75 mm tray, thinned by forming)
function shellGeometry(tooth, ms = 0, jaw) {
  const key = tooth.id + ':' + ms; if (SHELL.has(key)) return SHELL.get(key);
  const base = toothGeometry(tooth, ms, jaw), P = base.attributes.position.array, Nn = base.attributes.normal.array, I = base.index.array;
  const yMin = GUM_LEVEL[tooth.type][0] * crownShape(tooth).hs - 0.4;
  const pos = new Float32Array(P.length); for (let i = 0; i < P.length; i++) pos[i] = P[i] + Nn[i] * 0.5;
  const idx = []; for (let i = 0; i < I.length; i += 3) if (P[I[i] * 3 + 1] >= yMin && P[I[i + 1] * 3 + 1] >= yMin && P[I[i + 2] * 3 + 1] >= yMin) idx.push(I[i], I[i + 1], I[i + 2]);
  const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  SHELL.set(key, geo); return geo;
}
const _m = new Matrix4();
function applyPlacement(mesh, pl) {
  const f = placementMatrix(pl), o = f(0, 0, 0), ex = f(1, 0, 0), ey = f(0, 1, 0), ez = f(0, 0, 1);
  _m.set(ex[0] - o[0], ey[0] - o[0], ez[0] - o[0], o[0], ex[1] - o[1], ey[1] - o[1], ez[1] - o[1], o[1], ex[2] - o[2], ey[2] - o[2], ez[2] - o[2], o[2], 0, 0, 0, 1);
  mesh.matrix.copy(_m); mesh.matrixWorldNeedsUpdate = true;
}

// ---------------- gums, rebuilt from the teeth every frame (gum-core.mjs, checked by the gate) ----------------
const G_DEEP = srgb(0x9a3644), G_BODY = srgb(0xcf6e76), G_MARGIN = srgb(0xeca2a3);
function makeGum(jaw) { return { jaw, mesh: null, geo: null }; }
function updateGum(g, pls, scene, key) {
  if (!g.ref) { const keys = new Set(pls.map((p) => p.tooth.id + p.side + p.jaw)); g.ref = idealPlacements(g.jaw).filter((p) => keys.has(p.tooth.id + p.side + p.jaw)); }
  if (!g.refGum) g.refGum = buildGum(g.ref, g.jaw); // the fixed jaw, built once
  g.cache ||= new Map();
  let G = key != null ? g.cache.get(key) : null;
  if (!G) { G = buildGum(pls, g.jaw, undefined, g.refGum); G = { positions: G.positions, uv: G.uv, index: G.index, shade: G.shade }; if (key != null) { if (g.cache.size > 160) g.cache.clear(); g.cache.set(key, G); } }
  if (!g.geo || g.geo.attributes.position.count !== G.positions.length / 3) {
    if (g.mesh) { scene.remove(g.mesh); g.geo.dispose(); }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(G.positions.length), 3));
    geo.setAttribute('uv', new BufferAttribute(G.uv, 2));
    geo.setIndex(new BufferAttribute(G.index, 1));
    const col = new Float32Array(G.shade.length * 3);
    for (let i = 0; i < G.shade.length; i++) {
      const s = G.shade[i], n = 1;
      const c = s > 0.5 ? mix3(G_BODY, G_MARGIN, (s - 0.5) * 2) : mix3(G_DEEP, G_BODY, Math.pow(s * 2, 0.7));
      col.set([c[0] * n, c[1] * n, c[2] * n], i * 3);
    }
    geo.setAttribute('color', new BufferAttribute(col, 3));
    g.geo = geo; g.mesh = new Mesh(geo, GUM()); g.mesh.receiveShadow = true; g.mesh.castShadow = true; g.mesh.frustumCulled = false; scene.add(g.mesh);
  }
  g.geo.attributes.position.array.set(G.positions); g.geo.attributes.uv.array.set(G.uv);
  g.geo.attributes.position.needsUpdate = true; g.geo.attributes.uv.needsUpdate = true;
  g.geo.computeVertexNormals(); g.geo.computeTangents?.();
}

// ---------------- an articulated pair of arches ----------------
function dentition(scene, { jaws = ['upper', 'lower'], ids = null, aligner = false } = {}) {
  const meshes = [], shells = [];
  const base = [...idealPlacements('upper'), ...idealPlacements('lower')].filter((p) => jaws.includes(p.jaw) && (!ids || ids.includes(p.tooth.id + (p.side > 0 ? 'R' : 'L'))));
  const enamel = { incisor: ENAMEL('incisor'), canine: ENAMEL('canine'), premolar: ENAMEL('posterior'), molar: ENAMEL('posterior') }, alMat = ALIGNER();
  // one group per jaw, so the upper jaw can hinge open about the condyles for the 3/4 view
  const groups = {}; for (const j of jaws) { const g = new Group(); g.matrixAutoUpdate = false; scene.add(g); groups[j] = g; }
  for (const pl of base) {
    const ms = mesialSign(pl), m = new Mesh(toothGeometry(pl.tooth, ms, pl.jaw), enamel[pl.tooth.type]); m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = true;
    groups[pl.jaw].add(m); meshes.push(m);
    if (aligner) { const s = new Mesh(shellGeometry(pl.tooth, ms, pl.jaw), alMat); s.matrixAutoUpdate = false; s.renderOrder = 2; s.visible = false; groups[pl.jaw].add(s); shells.push(s); }
  }
  const gums = jaws.map((j) => makeGum(j));
  const HINGE = new Vector3(0, 12, -38), _a = new Matrix4(), _b = new Matrix4();
  if (!ids && groups.lower) { // a tongue resting inside the lower arch, seen when the mouth opens
    const geo = new SphereGeometry(1, 64, 40); const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i); y = y > 0 ? y * (1 - 0.25 * x * x) : y; P.setXYZ(i, x * 21, y * 7, z * 25 + (z > 0 ? -z * z * 4 : 0)); }
    geo.computeVertexNormals();
    const tm = new MeshPhysicalMaterial({ color: 0xb24552, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3, normalMap: stipple(), normalScale: new Vector2(0.8, 0.8), sheen: 0.6, sheenColor: new Color(0xff9aa2) });
    const tongue = new Mesh(geo, tm); tongue.position.set(0, -10.5, 2); tongue.receiveShadow = true; groups.lower.add(tongue);
    tongue.matrixAutoUpdate = true;
  }
  const keyOf = (p) => p.tooth.id + (p.side > 0 ? 'R' : 'L') + p.jaw;
  const order = base.map(keyOf);
  return {
    set(pls, key) {
      const map = new Map(pls.map((p) => [keyOf(p), p]));
      order.forEach((k, i) => { const p = map.get(k); applyPlacement(meshes[i], p); if (shells[i]) applyPlacement(shells[i], p); });
      gums.forEach((g) => updateGum(g, pls.filter((p) => order.includes(keyOf(p))), groups[g.jaw], key));
    },
    alignerOpacity(o) { alMat.opacity = o; shells.forEach((s) => (s.visible = o > 0.01)); },
    open(deg) { // rotate the upper jaw about the hinge axis (visual only; the gate measures the closed bite)
      const g = groups.upper; if (!g) return;
      g.matrix.makeTranslation(HINGE.x, HINGE.y, HINGE.z).multiply(_a.makeRotationX((-deg * Math.PI) / 180)).multiply(_b.makeTranslation(-HINGE.x, -HINGE.y, -HINGE.z));
      g.matrixWorldNeedsUpdate = true;
    },
    meshes, gums,
  };
}
const shadowFloor = (scene, y) => { const f = new Mesh(new PlaneGeometry(400, 400), new ShadowMaterial({ opacity: 0.22 })); f.rotation.x = -Math.PI / 2; f.position.y = y; f.receiveShadow = true; scene.add(f); return f; };

// measured overjet/overbite of the right central incisors, straight from the geometry
function measure(pls) {
  const U = pls.find((p) => p.jaw === 'upper' && p.i === 0 && p.side === 1), L = pls.find((p) => p.jaw === 'lower' && p.i === 0 && p.side === 1);
  const g = (pl) => { const c = crownGeometry(pl.tooth, { around: 24, side: 8, cap: 4, root: 1 }), f = placementMatrix(pl), out = []; for (let i = 0; i < c.positions.length; i += 3) out.push(f(c.positions[i], c.positions[i + 1], c.positions[i + 2])); return out; };
  const u = g(U), l = g(L);
  const uMin = Math.min(...u.map((p) => p[1])), lMax = Math.max(...l.map((p) => p[1]));
  const uEdge = Math.max(...u.filter((p) => p[1] <= uMin + 1.2).map((p) => p[2])), lLab = Math.max(...l.filter((p) => p[1] >= lMax - 3).map((p) => p[2]));
  return { overjet: uEdge - lLab, overbite: lMax - uMin };
}

// =========================================================================================
// 1. Concern simulator
// =========================================================================================
function mountSim(root) {
  const host = root.querySelector('.sim3d'); if (!host) return;
  const S = stage(host, { fov: 24 });
  shadowFloor(S.scene, -22);
  const D = dentition(S.scene, { aligner: true });
  const range = root.querySelector('[data-range]'), stageLabel = root.querySelector('[data-stage]'), read = root.querySelector('[data-measure]');
  const views = { front: { pos: [0, 1, 116], look: [0, 0, 10] }, side: { pos: [150, 4, 96], look: [8, 0, 10] }, three: { pos: [118, 92, 168], look: [0, 6, 2] } };
  let concern = 'crowd', view = 'front', cam = { pos: new Vector3(...views.front.pos), look: new Vector3(...views.front.look) }, camT = { pos: new Vector3(...views.front.pos), look: new Vector3(...views.front.look) };
  let lastT = -1, lastC = '', drag = 0, dragT = 0, first = true, jaw = 0;
  const viewFor = (k) => (k === 'open' || k === 'deep' || k === 'forward' ? 'side' : 'front');
  const setView = (v) => { view = v; camT.pos.set(...views[v].pos); camT.look.set(...views[v].look); root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false')); kick(); };
  root.querySelectorAll('.sim-tabs button').forEach((b) => b.addEventListener('click', () => { concern = b.dataset.k; setView(viewFor(concern)); }));
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  host.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = host.getBoundingClientRect(); dragT = ((e.clientX - r.left) / r.width - 0.5) * 0.35; kick(); });
  host.addEventListener('pointerleave', () => { dragT = 0; kick(); });
  let capture = false;
  const tick = (dt) => {
    if (capture) return false;
    S.resize();
    const t = Math.round(((+range.value || 0) / 100) * 120) / 120;
    let moving = false;
    if (t !== lastT || concern !== lastC) {
      const pls = placementsAt(concern, t); D.set(pls, concern + t);
      D.alignerOpacity(t > 0.02 && t < 0.98 ? 0.55 : 0);
      if (read) { const m = measure(pls); read.textContent = `Overjet ${m.overjet.toFixed(1)} mm, overbite ${m.overbite.toFixed(1)} mm`; }
      lastT = t; lastC = concern; moving = true;
    }
    const k = 1 - Math.exp(-dt / 0.28);
    cam.pos.lerp(camT.pos, k); cam.look.lerp(camT.look, k); drag += (dragT - drag) * k;
    const p = cam.pos.clone().sub(cam.look).applyAxisAngle(new Vector3(0, 1, 0), drag).add(cam.look);
    S.camera.position.copy(p); S.camera.lookAt(cam.look);
    const jawT = view === 'three' ? 26 : 0; jaw += (jawT - jaw) * k; D.open(jaw); // the 3/4 view opens the mouth so both arches show
    const camMoving = cam.pos.distanceTo(camT.pos) > 0.05 || Math.abs(drag - dragT) > 0.001 || Math.abs(jaw - jawT) > 0.05;
    if (moving || camMoving || S.resize() || first) { S.renderer.render(S.scene, S.camera); first = false; }
    return true; // keep polling the slider while on screen (cheap when nothing changed)
  };
  const kick = loop(host, tick);
  // offline capture hook (used only by the video renderer): one exact frame of a concern, view and treatment time
  root.__frame = (c, v, tt) => {
    capture = true; concern = c; view = v; drag = dragT = 0;
    cam.pos.set(...views[v].pos); cam.look.set(...views[v].look); camT.pos.copy(cam.pos); camT.look.copy(cam.look);
    jaw = v === 'three' ? 26 : 0; D.open(jaw);
    const pls = placementsAt(c, tt); D.set(pls); D.alignerOpacity(tt > 0.02 && tt < 0.98 ? 0.55 : 0);
    S.resize(); S.camera.position.copy(cam.pos); S.camera.lookAt(cam.look); S.renderer.render(S.scene, S.camera);
    const m = measure(pls); return { img: S.renderer.domElement.toDataURL('image/png'), overjet: m.overjet, overbite: m.overbite };
  };
  root.dataset.three = '1';
}

// =========================================================================================
// 2. Spaces closing (upper front teeth, front view)
// =========================================================================================
function mountSpaces(fig) {
  const host = document.createElement('div'); host.className = 'closing3d'; fig.insertBefore(host, fig.querySelector('.hud'));
  const S = stage(host, { fov: 22 });
  shadowFloor(S.scene, -24);
  const ids = ['U1R', 'U1L', 'U2R', 'U2L', 'U3R', 'U3L', 'U4R', 'U4L', 'L1R', 'L1L', 'L2R', 'L2L', 'L3R', 'L3L', 'L4R', 'L4L'];
  const D = dentition(S.scene, { ids, aligner: false });
  const range = fig.querySelector('input[type=range]'), rd = fig.querySelector('.rd b'), rdl = fig.querySelector('.rd span');
  S.camera.position.set(0, 2, 136); S.camera.lookAt(0, 0, 16);
  let lastT = -1;
  const tick = () => {
    S.resize();
    const t = Math.round(((+range.value || 0) / 100) * 120) / 120;
    if (t !== lastT) {
      const pls = placementsAt('space', t).filter((p) => ids.includes(p.tooth.id + (p.side > 0 ? 'R' : 'L')));
      D.set(pls, t);
      // real gaps between the upper front teeth, measured from the crowns
      let total = 0;
      const U = (id) => pls.find((p) => p.jaw === 'upper' && p.tooth.id + (p.side > 0 ? 'R' : 'L') === id);
      const verts = (pl) => { const c = crownGeometry(pl.tooth, { around: 24, side: 8, cap: 4, root: 1 }), f = placementMatrix(pl), out = new Float32Array(c.positions.length); for (let i = 0; i < c.positions.length; i += 3) { const q = f(c.positions[i], c.positions[i + 1], c.positions[i + 2]); out.set(q, i); } return out; };
      for (const [a, b] of [['U2L', 'U1L'], ['U1L', 'U1R'], ['U1R', 'U2R'], ['U2R', 'U3R'], ['U3L', 'U2L']]) { const g = separation(verts(U(a)), verts(U(b)), -0.5, 3.5); total += Math.max(0, g - 0.25); /* gaps under 0.25 mm are closed contacts within modelling tolerance */ }
      if (rd) rd.textContent = total.toFixed(1) + ' mm';
      if (rdl) rdl.textContent = t > 0.98 ? 'Space remaining: closed' : 'Space remaining';
      lastT = t;
      S.renderer.render(S.scene, S.camera);
    } else if (S.resize()) S.renderer.render(S.scene, S.camera);
    return true;
  };
  loop(host, tick);
  fig.__frame = (tt) => { range.value = String(tt * 100); lastT = -1; tick(); return { img: S.renderer.domElement.toDataURL('image/png'), gap: rd ? rd.textContent : '' }; };
  fig.dataset.three = '1';
}

// =========================================================================================
// 3. Story: six upper front teeth, one straightens per chapter
// =========================================================================================
function mountStory(root) {
  const host = root.querySelector('.story3d'); if (!host) return;
  const S = stage(host, { fov: 20 });
  shadowFloor(S.scene, -20);
  const ids = ['U3L', 'U2L', 'U1L', 'U1R', 'U2R', 'U3R', 'U4L', 'U4R'];
  const D = dentition(S.scene, { jaws: ['upper'], ids });
  S.camera.position.set(0, -8, 122); S.camera.lookAt(0, 3, 18);
  const order = ['U3L', 'U2L', 'U1L', 'U1R', 'U2R', 'U3R']; // chapter k straightens order[k-1]
  let target = 1, cur = 0;
  const chs = [...root.querySelectorAll('.chapter')];
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { target = +e.target.dataset.ch; kick(); } }), { rootMargin: '-40% 0px -50% 0px' }); chs.forEach((c) => io.observe(c)); } else target = 6;
  const tick = (dt) => {
    S.resize();
    cur = reduce ? target : cur + (target - cur) * (1 - Math.exp(-dt / 0.45));
    const q = Math.round(cur * 40) / 40;
    const pls = placementsAt('crowd', 0).filter((p) => p.jaw === 'upper').map((p) => {
      const id = p.tooth.id + (p.side > 0 ? 'R' : 'L'), k = order.indexOf(id);
      const done = k < 0 ? 1 : sstep(k, k + 1, q); // tooth k straight once cur passes k+1
      const ideal = idealPlacements('upper').find((q) => q.side === p.side && q.i === p.i);
      return { ...ideal, dx: p.dx * (1 - done), dz: p.dz * (1 - done), dy: p.dy * (1 - done), rot: p.rot * (1 - done), dtorque: 0 };
    }).filter((p) => ids.includes(p.tooth.id + (p.side > 0 ? 'R' : 'L')));
    D.set(pls, q);
    S.renderer.render(S.scene, S.camera);
    return Math.abs(target - cur) > 0.002;
  };
  const kick = loop(host, tick);
  root.__frame = (c) => { cur = target = c; tick(0); return { img: S.renderer.domElement.toDataURL('image/png') }; };
  root.dataset.three = '1';
}

// =========================================================================================
// 4. Aligner pressure former (thermoformer)
// =========================================================================================
function mountThermo(root) {
  const host = root.querySelector('.thermo3d'); if (!host) return;
  const S = stage(host, { fov: 30 });
  const sc = S.scene;
  const metal = new MeshPhysicalMaterial({ color: 0xc9ccd6, metalness: 0.92, roughness: 0.32, clearcoat: 0.3 });
  const darkMetal = new MeshPhysicalMaterial({ color: 0x3a3550, metalness: 0.7, roughness: 0.38 });
  const shell = new MeshPhysicalMaterial({ color: 0xf6f4fa, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const violet = new MeshPhysicalMaterial({ color: 0x6d3fc8, roughness: 0.3, clearcoat: 0.8 });
  const resin = new MeshPhysicalMaterial({ color: 0xd8d2c4, roughness: 0.62, sheen: 0.2 });
  const add = (geo, mat, x, y, z, cast = true) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; sc.add(m); return m; };
  shadowFloor(sc, 0);
  // body
  add(new RoundedBoxGeometry(250, 26, 190, 6, 8), shell, 0, 13, 0);
  add(new RoundedBoxGeometry(252, 3, 192, 4, 1.4), darkMetal, 0, 1.5, 0);
  // control panel strip with two buttons and a screen
  add(new RoundedBoxGeometry(70, 2, 26, 4, 1), darkMetal, 70, 26.6, 70);
  const scr = add(new RoundedBoxGeometry(34, 1, 16, 4, 0.5), new MeshStandardMaterial({ color: 0x1b1230, emissive: 0x6d3fc8, emissiveIntensity: 0.35, roughness: 0.2 }), 58, 27.8, 70);
  add(new CylinderGeometry(4, 4, 2.4, 32), violet, 85, 27.8, 70); add(new CylinderGeometry(4, 4, 2.4, 32), metal, 97, 27.8, 70);
  // forming chamber (well) with granules
  const WELL = new Vector3(0, 26, 10);
  add(new CylinderGeometry(62, 64, 8, 96, 1, true), metal, WELL.x, 30, WELL.z);
  add(new TorusGeometry(63, 2.2, 16, 120).rotateX(Math.PI / 2), metal, WELL.x, 34, WELL.z);
  add(new CylinderGeometry(61, 61, 1, 96), new MeshPhysicalMaterial({ color: 0x9aa0ae, roughness: 0.9, metalness: 0.2 }), WELL.x, 30.5, WELL.z, false);
  // printed dental model: upper arch, teeth up, on a horseshoe base
  const model = new Group(); model.position.set(WELL.x, 31, WELL.z); sc.add(model);
  const flipM = new Matrix4().makeTranslation(0, 18, -10).multiply(new Matrix4().makeRotationZ(Math.PI)); // teeth up, arch centred
  const arch = idealPlacements('upper');
  for (const pl of arch) {
    const m = new Mesh(toothGeometry(pl.tooth), resin); m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = true;
    applyPlacement(m, pl); m.matrix.premultiply(flipM); model.add(m);
  }
  // horseshoe base following the arch: offset the tooth centres outwards and inwards
  const ordered = [...arch].sort((a, b) => (a.side === b.side ? (a.side < 0 ? b.i - a.i : a.i - b.i) : a.side - b.side));
  const cen = ordered.map((pl) => { const f = placementMatrix(pl), c = f(0, 0.5, 0); const v3 = new Vector3(c[0], c[1], c[2]).applyMatrix4(flipM); const nx = pl.tz * (pl.side), nz = pl.tx * (pl.side) ; return { x: v3.x, z: v3.z, t: pl.tooth.t, pl }; });
  const outerPts = [], innerPts = [];
  cen.forEach((c, k) => {
    const a2 = cen[Math.max(0, k - 1)], b2 = cen[Math.min(cen.length - 1, k + 1)];
    let tx = b2.x - a2.x, tz = b2.z - a2.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    let nx = -tz, nz = tx; if (nx * c.x + nz * (c.z + 6) < 0) { nx = -nx; nz = -nz; }
    outerPts.push(new Vector2(c.x + nx * (c.t / 2 + 3.5), -(c.z + nz * (c.t / 2 + 3.5))));
    innerPts.push(new Vector2(c.x - nx * (c.t / 2 + 3), -(c.z - nz * (c.t / 2 + 3))));
  });
  const base = new Shape(); base.moveTo(outerPts[0].x, outerPts[0].y); outerPts.forEach((p) => base.lineTo(p.x, p.y)); for (let k = innerPts.length - 1; k >= 0; k--) base.lineTo(innerPts[k].x, innerPts[k].y); base.closePath();
  const baseGeo = new ExtrudeGeometry(base, { depth: 9, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.4, bevelSegments: 4, curveSegments: 24 });
  baseGeo.rotateX(-Math.PI / 2);
  const baseMesh = new Mesh(baseGeo, resin); baseMesh.castShadow = true; baseMesh.receiveShadow = true; model.add(baseMesh);
  // height field of the model (for the sheet drape): rasterise every triangle's top surface
  model.updateMatrixWorld(true);
  const HF = { n: 128, r: 64, h: new Float32Array(128 * 128).fill(-1e9) };
  const v = new Vector3(), tri = [new Vector3(), new Vector3(), new Vector3()];
  model.traverse((o) => {
    if (!o.isMesh) return; const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const get = (i, out) => out.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      for (let j = 0; j < 3; j++) get(idx ? idx.getX(i + j) : i + j, tri[j]);
      const minx = Math.min(tri[0].x, tri[1].x, tri[2].x), maxx = Math.max(tri[0].x, tri[1].x, tri[2].x), minz = Math.min(tri[0].z, tri[1].z, tri[2].z), maxz = Math.max(tri[0].z, tri[1].z, tri[2].z);
      const toG = (x, c) => ((x - c + HF.r) / (2 * HF.r)) * (HF.n - 1);
      for (let gx = Math.max(0, Math.floor(toG(minx, WELL.x))); gx <= Math.min(HF.n - 1, Math.ceil(toG(maxx, WELL.x))); gx++)
        for (let gz = Math.max(0, Math.floor(toG(minz, WELL.z))); gz <= Math.min(HF.n - 1, Math.ceil(toG(maxz, WELL.z))); gz++) {
          const k = gz * HF.n + gx; HF.h[k] = Math.max(HF.h[k], (tri[0].y + tri[1].y + tri[2].y) / 3);
        }
    }
  });
  const blur = (src, r) => { const n = HF.n, out = new Float32Array(src); for (let pass = 0; pass < r; pass++) { const t = new Float32Array(out); for (let z = 1; z < n - 1; z++) for (let x = 1; x < n - 1; x++) { const k = z * n + x; out[k] = Math.max(t[k], (t[k - 1] + t[k + 1] + t[k - n] + t[k + n]) * 0.25 - 0.35); } } return out; };
  const HF_SOFT = blur(HF.h, 6), HF_TIGHT = blur(HF.h, 1);
  const hAt = (arr, x, z) => { const gx = Math.round(((x - WELL.x + HF.r) / (2 * HF.r)) * (HF.n - 1)), gz = Math.round(((z - WELL.z + HF.r) / (2 * HF.r)) * (HF.n - 1)); if (gx < 0 || gz < 0 || gx >= HF.n || gz >= HF.n) return -1e9; return arr[gz * HF.n + gx]; };
  // column, swing arm and heater
  const COL = new Vector3(-100, 26, -62);
  add(new CylinderGeometry(9, 10, 150, 48), metal, COL.x, 26 + 75, COL.z);
  add(new CylinderGeometry(13, 13, 6, 48), darkMetal, COL.x, 29, COL.z);
  const heaterPivot = new Group(); heaterPivot.position.set(COL.x, 168, COL.z); sc.add(heaterPivot);
  const armLen = Math.hypot(WELL.x - COL.x, WELL.z - COL.z);
  const arm = new Mesh(new RoundedBoxGeometry(armLen, 9, 16, 4, 3), shell); arm.position.set(armLen / 2, 0, 0); arm.castShadow = true; heaterPivot.add(arm);
  const heater = new Group(); heater.position.set(armLen, -10, 0); heaterPivot.add(heater);
  const hb = new Mesh(new CylinderGeometry(66, 66, 18, 96), shell); hb.castShadow = true; heater.add(hb);
  const hcap = new Mesh(new CylinderGeometry(40, 66, 8, 96), shell); hcap.position.y = 13; heater.add(hcap);
  const glowMat = new MeshStandardMaterial({ color: 0x220a04, emissive: 0xff5a1a, emissiveIntensity: 0, roughness: 0.6 });
  const coil = new Mesh(new TorusGeometry(44, 2, 12, 120), glowMat); coil.rotation.x = Math.PI / 2; coil.position.y = -9.5; heater.add(coil);
  const coil2 = new Mesh(new TorusGeometry(26, 2, 12, 90), glowMat); coil2.rotation.x = Math.PI / 2; coil2.position.y = -9.5; heater.add(coil2);
  const heatLight = new PointLight(0xff7a30, 0, 140, 1.6); heatLight.position.y = -20; heater.add(heatLight);
  const swingIn = Math.atan2(-(WELL.z - COL.z), WELL.x - COL.x), swingOut = swingIn + 1.35;
  // clamp frame on a second slide, carrying the sheet
  const clamp = new Group(); sc.add(clamp);
  const ring = new Mesh(new TorusGeometry(64, 4, 18, 128), metal); ring.rotation.x = Math.PI / 2; ring.castShadow = true; clamp.add(ring);
  const ringArm = new Mesh(new RoundedBoxGeometry(armLen - 64, 6, 12, 3, 2), metal); clamp.add(ringArm);
  const ang = Math.atan2(WELL.z - COL.z, WELL.x - COL.x); ringArm.position.set(COL.x + Math.cos(ang) * (armLen - 64) / 2 - WELL.x, 0, COL.z + Math.sin(ang) * (armLen - 64) / 2 - WELL.z); ringArm.rotation.y = -ang;
  const collar = new Mesh(new CylinderGeometry(13, 13, 14, 40), darkMetal); collar.position.set(COL.x - WELL.x, 0, COL.z - WELL.z); clamp.add(collar);
  clamp.position.set(WELL.x, 0, WELL.z);
  // the sheet: a polar grid we deform (sag while hot, drape over the model when pressed)
  const RINGS = 46, SEGS = 120, R = 61;
  const sheetGeo = new BufferGeometry(); const sp = new Float32Array((RINGS * SEGS + 1) * 3), base2 = [];
  for (let r = 1; r <= RINGS; r++) for (let s = 0; s < SEGS; s++) { const rr = (r / RINGS) * R, a = (s / SEGS) * Math.PI * 2; base2.push([Math.cos(a) * rr, Math.sin(a) * rr, rr / R]); }
  base2.push([0, 0, 0]);
  const idxS = [];
  for (let r = 0; r < RINGS - 1; r++) for (let s = 0; s < SEGS; s++) { const a = r * SEGS + s, b = r * SEGS + (s + 1) % SEGS, c = a + SEGS, d = b + SEGS; idxS.push(a, b, c, b, d, c); }
  const C0 = RINGS * SEGS; for (let s = 0; s < SEGS; s++) idxS.push(C0, (s + 1) % SEGS, s);
  sheetGeo.setAttribute('position', new BufferAttribute(sp, 3)); sheetGeo.setIndex(idxS);
  const sheetMat = new MeshPhysicalMaterial({ color: 0xd9e6ff, roughness: 0.04, transmission: 0.55, thickness: 0.75, ior: 1.57, transparent: true, opacity: 0.92, side: DoubleSide, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, emissive: 0xff6a20, emissiveIntensity: 0 });
  const sheet = new Mesh(sheetGeo, sheetMat); sheet.renderOrder = 3; sheet.castShadow = false; sc.add(sheet);
  // pressure gauge on the front
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
  gx.fillStyle = '#fbfaff'; gx.beginPath(); gx.arc(128, 128, 124, 0, 7); gx.fill();
  gx.strokeStyle = '#2a1b4d'; gx.lineWidth = 3; gx.beginPath(); gx.arc(128, 128, 118, 0, 7); gx.stroke();
  for (let k = 0; k <= 40; k++) { const a = Math.PI * 0.75 + (k / 40) * Math.PI * 1.5, big = k % 5 === 0; gx.lineWidth = big ? 4 : 2; gx.beginPath(); gx.moveTo(128 + Math.cos(a) * (big ? 86 : 96), 128 + Math.sin(a) * (big ? 86 : 96)); gx.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); gx.stroke(); }
  gx.fillStyle = '#2a1b4d'; gx.font = '600 22px system-ui'; gx.textAlign = 'center';
  for (let k = 0; k <= 8; k += 2) { const a = Math.PI * 0.75 + (k / 8) * Math.PI * 1.5; gx.fillText(String(k), 128 + Math.cos(a) * 66, 136 + Math.sin(a) * 66); }
  gx.font = '500 16px system-ui'; gx.fillText('bar', 128, 190);
  const tex = new CanvasTexture(gc); tex.colorSpace = SRGBColorSpace;
  const gauge = new Group(); gauge.position.set(95, 40, 92); gauge.rotation.x = 0.9; sc.add(gauge);
  gauge.add(new Mesh(new CylinderGeometry(19, 19, 8, 64), metal));
  const face = new Mesh(new CircleGeometry(17, 64), new MeshStandardMaterial({ map: tex, roughness: 0.4 })); face.rotation.x = -Math.PI / 2; face.position.y = 4.1; gauge.add(face);
  const glass = new Mesh(new CircleGeometry(17.5, 64), new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false })); glass.rotation.x = -Math.PI / 2; glass.position.y = 4.6; gauge.add(glass);
  const needle = new Mesh(new RoundedBoxGeometry(1.2, 0.6, 15, 2, 0.3), new MeshStandardMaterial({ color: 0x6d3fc8, roughness: 0.3 })); needle.geometry.translate(0, 0, -6); needle.position.y = 4.4; gauge.add(needle);

  S.camera.position.set(310, 300, 420); S.camera.lookAt(-14, 82, -10);
  // ---- timeline (seconds): each phase eases into the next; one loop is 15 s ----
  const T = 15;
  const phases = [[0, 'ready', 'Sheet clamped in the frame'], [1.0, 'heating', 'Heater swings over and softens the sheet'], [5.2, 'pressing', 'Frame lowers; the soft sheet drapes over the printed model'], [7.4, 'forming', 'Forming pressure presses it tight against every tooth'], [9.6, 'cooling', 'Cooling under pressure'], [11.6, 'released', 'Released: the formed aligner on its model']];
  const out = root.querySelector('[data-readout]'), scrub = root.querySelector('[data-scrub]'), playBtn = root.querySelector('[data-play]');
  const steps = root.querySelectorAll('[data-step]');
  let time = 0, playing = !reduce, lastShown = '';
  const RING_UP = 104, RING_DOWN = 31.5;
  function pose(t) {
    const heat = sstep(1.0, 2.2, t) * (1 - sstep(4.6, 5.4, t)); // heater over the well
    const hot = sstep(1.8, 4.6, t) * (1 - sstep(8.5, 11, t)); // sheet temperature, 0..1
    const lower = sstep(5.3, 6.8, t) * (1 - sstep(11.6, 13.2, t)); // frame travel
    const press = sstep(7.4, 7.9, t) * (1 - sstep(11.0, 11.6, t)); // pressure held through cooling, vented at release
    const formed = sstep(6.0, 7.6, t); // sheet stays formed once pressed (until reset)
    const reset = sstep(13.6, 14.6, t); // fade back to a fresh sheet
    return { heat, hot, lower, press, formed: formed * (1 - reset), reset };
  }
  function apply(t) {
    const p = pose(t);
    heaterPivot.rotation.y = swingOut + (swingIn - swingOut) * ease(p.heat);
    glowMat.emissiveIntensity = 2.6 * p.heat * (0.85 + 0.15 * Math.sin(t * 9)); heatLight.intensity = 18000 * p.heat;
    const ringY = RING_UP + (RING_DOWN - RING_UP) * ease(p.lower);
    clamp.position.y = ringY;
    // sheet: flat in the frame, sagging when hot, wrapped over the model when lowered and pressed
    const sag = 9 * p.hot * (1 - p.formed);
    const tight = Math.min(1, 0.3 + p.press * 0.9);
    const baseY = t < 11.6 ? ringY : RING_DOWN; // after release the formed sheet stays on the model while the frame rises
    for (let i = 0; i < base2.length; i++) {
      const [x, z, rr] = base2[i];
      const wx = WELL.x + x, wz = WELL.z + z;
      let y = ringY - sag * (1 - rr * rr);
      if (p.formed > 0) {
        const hs = hAt(HF_SOFT, wx, wz), ht = hAt(HF_TIGHT, wx, wz);
        const h = hs > -1e8 ? hs + (ht - hs) * tight + 0.8 : -1e9;
        y = y + (Math.max(baseY, h) - y) * p.formed;
      }
      sp[i * 3] = wx; sp[i * 3 + 1] = y; sp[i * 3 + 2] = wz;
    }
    sheetGeo.attributes.position.needsUpdate = true; sheetGeo.computeVertexNormals();
    sheetMat.emissiveIntensity = 0.08 * p.hot; sheetMat.roughness = 0.05 + 0.1 * p.hot; sheetMat.opacity = 1 - sstep(13.5, 14.0, t) + sstep(14.1, 14.6, t);
    needle.rotation.y = -Math.PI / 2 - (Math.PI * 0.75 + ((p.press * 6) / 8) * Math.PI * 1.5);
    scr.material.emissiveIntensity = 0.25 + 0.4 * p.heat;
    let name = phases[0]; for (const ph of phases) if (t >= ph[0]) name = ph;
    const text = name[1] === 'forming' || name[1] === 'cooling' ? `${name[2]} (${(p.press * 6).toFixed(1)} bar)` : name[2];
    if (out && text !== lastShown) { out.textContent = text; lastShown = text; }
    steps.forEach((b) => b.setAttribute('aria-current', b.dataset.step === name[1] ? 'step' : 'false'));
    if (scrub) scrub.value = String(Math.round((t / T) * 1000));
  }
  if (scrub) scrub.addEventListener('input', () => { playing = false; setPlay(); time = (+scrub.value / 1000) * T; apply(time); kick(); });
  steps.forEach((b) => b.addEventListener('click', () => { const ph = phases.find((x) => x[1] === b.dataset.step); time = ph[0] + 0.01; playing = true; setPlay(); kick(); }));
  const setPlay = () => { if (playBtn) { playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false'); playBtn.querySelector('span').textContent = playing ? 'Pause' : 'Play'; } };
  if (playBtn) playBtn.addEventListener('click', () => { playing = !playing; setPlay(); kick(); });
  setPlay();
  let par = 0, parT = 0;
  host.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = host.getBoundingClientRect(); parT = ((e.clientX - r.left) / r.width - 0.5) * 0.25; kick(); });
  host.addEventListener('pointerleave', () => { parT = 0; kick(); });
  const camBase = new Vector3(310, 300, 420), look = new Vector3(-14, 82, -10);
  apply(reduce ? 12.5 : 0);
  const tick = (dt) => {
    S.resize();
    if (playing) { time = (time + dt) % T; apply(time); }
    par += (parT - par) * (1 - Math.exp(-dt / 0.3));
    S.camera.position.copy(camBase.clone().sub(look).applyAxisAngle(new Vector3(0, 1, 0), par).add(look)); S.camera.lookAt(look);
    S.renderer.render(S.scene, S.camera);
    return playing || Math.abs(par - parT) > 0.0005;
  };
  const kick = loop(host, tick);
  root.__frame = (tt) => { playing = false; setPlay(); par = parT = 0; apply(tt); S.resize(); S.camera.position.copy(camBase); S.camera.lookAt(look); S.renderer.render(S.scene, S.camera); return { img: S.renderer.domElement.toDataURL('image/png'), text: out ? out.textContent : '' }; };
  root.dataset.three = '1';
}

export function mount(el) {
  try {
    const kind = el.getAttribute('data-3d');
    if (kind === 'sim') mountSim(el);
    else if (kind === 'spaces') mountSpaces(el);
    else if (kind === 'story') mountStory(el);
    else if (kind === 'thermo') mountThermo(el);
  } catch (e) { console.warn('3D view unavailable', e); }
}
export { CONCERNS, TEETH };
