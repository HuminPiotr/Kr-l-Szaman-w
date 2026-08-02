/**
 * Pełna ścieżka wystrzału: READY -> gest -> FIRING -> COOLDOWN.
 *
 *   node tools/test-fire.mjs
 *
 * Ten test istnieje, bo test-stany.mjs go NIE ŁAPAŁ: używa dłoni o stałej
 * geometrii, więc normalizedDistance nigdy się nie zmienia i gest wystrzału
 * nigdy nie pada. Wszystkie asercje przechodziły, podczas gdy wystrzał był
 * całkowicie zepsuty.
 *
 * Pilnowany błąd: gest wystrzału to ROZSUNIĘCIE dłoni, które jednocześnie
 * psuje wynik znaku Swaroga. Energia = moc x znak spada więc poniżej progu
 * podtrzymania w tej samej klatce, w której padł strzał. Bez osłony
 * degradacja READY nadpisywała świeżo ustawione FIRING, lecąca kula
 * zostawała osierocona, a energia strzału wynosiła 0.
 */
import { PowerBall } from '../js/powerBall.js';
import { swarog } from '../js/znaki/swarog.js';

const nic = () => {};
const ctx = new Proxy({}, { get: (t,k) => k === 'createRadialGradient' ? () => ({ addColorStop: nic }) : nic });
const canvas = { width: 1920, height: 1080 };
const W = canvas.width, H = canvas.height;

// Dwie dłonie oddalone o `norm` rozmiarów dłoni (rozmiar dłoni = 0.08*H)
function rece(norm) {
  const rozmiar = 0.08 * H;
  const polowa = (norm * rozmiar) / 2 / W;
  const d = (ox) => { const h = Array.from({length:21},()=>({x:ox,y:0.5,z:0}));
    h[0] = {x:ox, y:0.5 + rozmiar/H, z:0}; h[9] = {x:ox, y:0.5, z:0}; return h; };
  return [d(0.5 - polowa), d(0.5 + polowa)];
}
const znak = (r) => swarog.score({ hands: r.map(l => ({landmarks:l})), width: W, height: H });

const pb = new PowerBall(canvas, ctx);
const krok = (norm, moc = 1.0) => {
  const r = rece(norm);
  pb.updateAndDraw(r, W, H, moc, znak(r));
};

// 1. Ładowanie w optimum (2.5 rozmiaru dłoni) aż do READY
for (let i = 0; i < 10; i++) krok(2.5);
console.log(`po naładowaniu:        stan=${pb.state}  energia=${pb.currentEnergy.toFixed(2)}`);
const energiaPrzedStrzalem = pb.currentEnergy;

// 2. GEST WYSTRZAŁU: gwałtowne rozsunięcie dłoni (skok normalizedDistance > 1.2)
krok(5.5);
// Odczyt MUSI paść tu - po dolocie kula jest kasowana i flyingBall znika
const energiaKuli = pb.flyingBall?.energy ?? 0;
const rozmiarKuli = pb.flyingBall?.size ?? 0;
console.log(`klatka gestu wystrzału: stan=${pb.state}  energia kuli=${energiaKuli.toFixed(2)}  rozmiar=${rozmiarKuli.toFixed(0)}px`);

// 3. Kolejne klatki - czy dolatuje do COOLDOWN?
let doszloDoFiring = pb.state === 'FIRING';
for (let i = 0; i < 200; i++) { krok(6.5); if (pb.state === 'FIRING') doszloDoFiring = true; }
console.log(`po 200 klatkach:       stan=${pb.state}  flyingBall=${pb.flyingBall ? 'OSIEROCONY' : 'brak'}`);

console.log();
let ok = true;
const spr = (o,w) => { console.log(`  ${w?'✓':'✗'} ${o}`); if(!w) ok=false; };
spr('gest wystrzału wprowadza w stan FIRING', doszloDoFiring);
spr('lecąca kula nie zostaje osierocona', !(pb.state !== 'FIRING' && pb.flyingBall));
spr(`kula wystrzelona pełną mocą (${energiaKuli.toFixed(2)} vs ${energiaPrzedStrzalem.toFixed(2)} tuż przed)`,
    energiaKuli > energiaPrzedStrzalem * 0.9);
spr(`kula jest widoczna (${rozmiarKuli.toFixed(0)} px, drawBall pomija poniżej 1 px)`, rozmiarKuli > 50);
spr('dolatuje do COOLDOWN', pb.state === 'COOLDOWN');
process.exit(ok ? 0 : 1);
