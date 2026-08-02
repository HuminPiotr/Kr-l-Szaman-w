/**
 * Regresja: pojedyncza klatka z NaN nie może trwale zatruć MotionMeter.
 *
 *   node tools/test-nan.mjs
 *
 * MediaPipe potrafi zwrócić NaN w worldLandmarks przy niskiej pewności
 * trackingu. Bez osłon jedna taka klatka ustawiała moc na NaN NA STAŁE -
 * Math.max(0, Math.min(1, NaN)) to nadal NaN - i gra zamierała bez komunikatu.
 */
import { computeCoverFit, mapLandmarks } from '../js/frameMapper.js';
import { MotionMeter } from '../js/motionMeter.js';

const fit = computeCoverFit({ videoWidth: 0, videoHeight: 0 }, { width: 1440, height: 900 });
const p = mapLandmarks([{ x: 0.5, y: 0.5, z: 0 }], fit)[0];
console.log(`videoWidth=0 -> ratio=${fit.ratio}  punkt.x=${p.x}  (osłona jest w renderLoop)`);

const m = new MotionMeter();
// Amplituda MUSI dawać prędkość powyżej podłogi szumu (0.6 m/s),
// inaczej moc stoi na zerze i test niczego nie dowodzi.
const A = 0.6;
const dobre = (t) => { const l = Array.from({length:33},()=>({x:0,y:0,z:0})); for (const i of [15,16,13,14,27,28]) l[i]={x:A*Math.sin(2*Math.PI*t),y:0,z:0}; return l; };
const zle   = () => { const l = Array.from({length:33},()=>({x:0,y:0,z:0})); for (const i of [15,16,13,14,27,28]) l[i]={x:NaN,y:NaN,z:NaN}; return l; };
const krok = (lm) => m.update({ hands: [], pose: { landmarks: [], worldLandmarks: lm }, width:1920, height:1080, dt:1/60, now:0 });

for (let i=0;i<240;i++) krok(dobre(i/60));   // 4 s - moc w połowie skali, jest gdzie rosnąć
const przed = m.moc;
console.log(`po 4 s ruchu (v=${m.predkosc.toFixed(2)}, efekt. ${m.predkoscEfektywna.toFixed(2)}): moc=${przed.toFixed(3)}`);
if (przed < 0.05 || przed > 0.9) { console.log('✗ TEST BEZUŻYTECZNY - moc poza użytecznym zakresem (0.05-0.9)'); process.exit(1); }

krok(zle());
console.log(`po JEDNEJ klatce z NaN:  moc=${m.moc.toFixed(3)}  ${Number.isNaN(m.moc) ? '✗ ZATRUTE' : '✓ przetrwało'}`);
for (let i=0;i<300;i++) krok(dobre(i/60));
console.log(`po 5 s powrotu:          moc=${m.moc.toFixed(3)}  ${m.moc > przed ? '✓ rośnie dalej' : '✗ nie wraca'}`);
process.exit(Number.isNaN(m.moc) || m.moc <= przed ? 1 : 0);
