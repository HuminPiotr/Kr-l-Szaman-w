/**
 * Maszyna stanów kuli po przełączeniu energii na ruch ciała.
 *
 *   node tools/test-stany.mjs
 *
 * Pilnuje trzech rzeczy: że energia to iloczyn mocy i znaku, że READY ma
 * histerezę, i - najważniejsze - że READY NIE JEST PUŁAPKĄ. Energia nie jest
 * już liczona wewnątrz PowerBall, więc bez reguły degradacji jedynym wyjściem
 * z gotowości byłby wystrzał.
 */
import { PowerBall } from '../js/powerBall.js';

// Atrapa canvasu - PowerBall rysuje, ale logika stanów jest od tego niezależna
const nic = () => {};
const ctx = new Proxy({}, { get: (t, k) =>
  k === 'createRadialGradient' ? () => ({ addColorStop: nic }) : nic });
const canvas = { width: 1920, height: 1080 };

// Dłonie w miseczkę: punkty 9 oddalone o ~2.5 rozmiaru dłoni (optimum Swaroga)
function miseczka() {
  const d = (ox) => { const h = Array.from({length:21},()=>({x:ox,y:0.5,z:0}));
    h[0]={x:ox,y:0.58,z:0}; h[9]={x:ox,y:0.5,z:0}; return h; };
  return [d(0.44), d(0.56)];
}

const pb = new PowerBall(canvas, ctx);
const krok = (moc, znak, rece = miseczka()) => {
  pb.updateAndDraw(rece, canvas.width, canvas.height, moc, znak);
  return pb.state;
};

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('MOC x ZNAK:');
krok(0.0, 1.0); spr('sam znak bez tańca -> brak energii', pb.currentEnergy === 0);
krok(1.0, 0.0); spr('sam taniec bez znaku -> brak energii', pb.currentEnergy === 0);
krok(0.8, 0.5); spr('oba naraz -> energia = iloczyn (0.40)', Math.abs(pb.currentEnergy - 0.4) < 1e-9);

console.log('\nHISTEREZA READY:');
krok(1.0, 1.0); spr('pełna moc + pełny znak -> READY', pb.state === 'READY');
krok(0.8, 1.0); spr('lekki spadek (0.80) NIE wypada z READY', pb.state === 'READY');
krok(0.7, 1.0); spr('nadal powyżej progu podtrzymania (0.70)', pb.state === 'READY');

console.log('\nREADY NIE JEST PUŁAPKĄ:');
krok(0.3, 1.0); spr('przestajesz tańczyć -> wraca do CHARGING', pb.state === 'CHARGING');

console.log('\nBRAK MIGOTANIA na granicy:');
const pb2 = new PowerBall(canvas, ctx);
pb2.updateAndDraw(miseczka(), 1920, 1080, 1.0, 1.0);
let zmiany = 0, poprz = pb2.state;
for (let i = 0; i < 200; i++) {              // dyndanie wokół progu wejścia 0.90
  pb2.updateAndDraw(miseczka(), 1920, 1080, 0.88 + (i % 2) * 0.04, 1.0);
  if (pb2.state !== poprz) zmiany++;
  poprz = pb2.state;
}
spr(`200 klatek dyndania wokół 0.90 -> ${zmiany} zmian stanu (ma być 0)`, zmiany === 0);

process.exit(ok ? 0 : 1);
