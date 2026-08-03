/**
 * Płynność steruje TEMPEM ładowania mocy - nigdy go nie zeruje.
 *
 *   node tools/test-podloga.mjs
 *
 * Pilnuje reguły nadrzędnej gry: nic nigdy nie mówi "źle". Szarpany taniec
 * ma ładować wolniej, ale MUSI ładować. Zamiana tego na próg ("płynny ruch
 * ładuje, szarpany nie") jest błędem projektowym, nie optymalizacją.
 */
import { MotionMeter } from '../js/motionMeter.js';
const DT=1/60, SL=[15,16,13,14,27,28];
const cialo = t => { const l=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0.9}));
  for(const i of SL) l[i]={x:0.35*Math.sin(2*Math.PI*t),y:0,z:0,visibility:0.9}; return l; };

function ladujDo(plynnosc, cel=0.99, maxS=180) {
  const m=new MotionMeter();
  for (let i=0;i<maxS/DT;i++){
    m.update({hands:[],pose:{landmarks:[],worldLandmarks:cialo(i*DT)},width:1920,height:1080,dt:DT,now:i*DT*1000}, plynnosc);
    if (m.moc>=cel) return i*DT;
  }
  return null;
}
let ok=true; const spr=(o,w)=>{console.log(`  ${w?'✓':'✗'} ${o}`); if(!w) ok=false;};
console.log('czas do pełnej mocy przy tej samej PRĘDKOŚCI, różnej płynności:\n');
const wyn={};
for (const p of [1.0,0.72,0.5,0.0]) { const t=ladujDo(p); wyn[p]=t;
  console.log(`  płynność ${p.toFixed(2)} -> ${t===null?'NIGDY':t.toFixed(1)+' s'}`); }
console.log();
spr('płynny ruch ładuje najszybciej', wyn[1.0] !== null);
spr('szarpany ruch NADAL ładuje (reguła: nic nie mówi źle)', wyn[0.0] !== null);
spr(`szarpany wolniejszy ~4x (${(wyn[0.0]/wyn[1.0]).toFixed(1)}x)`, wyn[0.0]/wyn[1.0] > 3 && wyn[0.0]/wyn[1.0] < 5);
spr('gradient jest monotoniczny', wyn[1.0] < wyn[0.72] && wyn[0.72] < wyn[0.5] && wyn[0.5] < wyn[0.0]);
process.exit(ok?0:1);
