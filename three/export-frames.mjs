// Exports the gate-checked teeth as OBJ frames for offline (Blender/Cycles) rendering.
// node export-frames.mjs [frames=48] [outDir=frames]
// Writes frames/<concern>/f###.obj (one object per tooth, mm units, Y up, +Z labial)
// and frames/<concern>/f###.json (cervical centre + labial normal of every tooth, for building gums).
import fs from 'node:fs';
import { CONCERNS, placementsAt, crownGeometry, placementMatrix } from './dental-core.mjs';
const N = +(process.argv[2] || 48), OUT = process.argv[3] || 'frames';
for (const concern of Object.keys(CONCERNS)) {
  fs.mkdirSync(`${OUT}/${concern}`, { recursive: true });
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), pls = placementsAt(concern, t);
    let obj = `# ${concern} t=${t.toFixed(4)} (mm)\n`, base = 1; const cerv = [];
    for (const pl of pls) {
      const name = `${pl.jaw}_${pl.tooth.id}${pl.side > 0 ? 'R' : 'L'}_${pl.tooth.type}`;
      const g = crownGeometry(pl.tooth, { around: 72, side: 26, cap: 12, root: 4 }), M = placementMatrix(pl);
      obj += `o ${name}\n`;
      for (let i = 0; i < g.positions.length; i += 3) { const p = M(g.positions[i], g.positions[i + 1], g.positions[i + 2]); obj += `v ${p[0].toFixed(4)} ${p[1].toFixed(4)} ${p[2].toFixed(4)}\n`; }
      for (let i = 0; i < g.height.length; i++) obj += `vt 0 ${Math.max(0, g.height[i]).toFixed(4)}\n`; // v = cervical(0)..incisal(1), for enamel shading
      for (let i = 0; i < g.index.length; i += 3) { const a = g.index[i] + base, b = g.index[i + 1] + base, c = g.index[i + 2] + base; obj += `f ${a}/${a} ${b}/${b} ${c}/${c}\n`; }
      base += g.positions.length / 3;
      const c0 = M(0, 0.4, 0), lab = M(0, 0.4, pl.tooth.t / 2);
      cerv.push({ name, jaw: pl.jaw, side: pl.side, i: pl.i, w: pl.tooth.w, t: pl.tooth.t, cervical: c0, labial: lab });
    }
    const id = String(f).padStart(3, '0');
    fs.writeFileSync(`${OUT}/${concern}/f${id}.obj`, obj);
    fs.writeFileSync(`${OUT}/${concern}/f${id}.json`, JSON.stringify({ concern, t, teeth: cerv }));
  }
  console.log(concern, N, 'frames');
}
