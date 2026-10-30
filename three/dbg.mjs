import { idealPlacements, worldVertices } from './dental-core.mjs';
const P = idealPlacements('upper');
for (const pl of P.filter(p=>p.i<=1)) {
  const v = worldVertices(pl); let xs=[];
  for (let i=0;i<v.length;i+=3) if (v[i+1]>-0.5 && v[i+1]<3.5) xs.push(v[i]);
  console.log(pl.tooth.id, pl.side, 'center', pl.x.toFixed(2), pl.z.toFixed(2), 't', pl.tx.toFixed(2), pl.tz.toFixed(2), 'x-range', Math.min(...xs).toFixed(2), Math.max(...xs).toFixed(2));
}
