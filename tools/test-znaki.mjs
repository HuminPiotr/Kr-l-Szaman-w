/**
 * Dwa znaki nie mogą się nawzajem zapalać ani działać skokowo.
 *
 *   node tools/test-znaki.mjs
 *
 * Sprawdza rozdzielność Swaroga (miseczka) i Striboga (rozłożona dłoń) oraz
 * regułę nadrzędną: wynik ma być CIĄGŁĄ rampą 0..1, nie progiem tak/nie.
 * Częściowe ułożenie dłoni musi dawać częściowy efekt.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { swarog } from '../js/znaki/swarog.js';
import { stribog } from '../js/znaki/stribog.js';

const W = 1920, H = 1080;

// Dłoń o zadanym rozstawie palców. rozstaw w jednostkach "rozmiaru dłoni".
function dlon({ srodekX, rozstaw }) {
  const h = Array.from({ length: 21 }, () => ({ x: srodekX, y: 0.5, z: 0 }));
  h[0] = { x: srodekX, y: 0.58, z: 0 };  // nadgarstek
  h[9] = { x: srodekX, y: 0.50, z: 0 };  // nasada środkowego -> rozmiar dłoni = 0.08*H
  const rozmiar = 0.08 * H;
  const krok = (rozstaw * rozmiar) / W;   // odstęp między sąsiednimi końcami palców
  [4, 8, 12, 16, 20].forEach((idx, i) => {
    h[idx] = { x: srodekX + (i - 2) * krok, y: 0.42, z: 0 };
  });
  return { landmarks: h };
}

const r = new ZnakRegistry();
r.zarejestruj(swarog); r.zarejestruj(stribog);
const ocen = (hands) => r.ocen({ hands, pose: null, width: W, height: H });

// MISECZKA: dwie dłonie w optymalnej odległości, palce zsunięte
const miseczka = [dlon({ srodekX: 0.44, rozstaw: 0.15 }), dlon({ srodekX: 0.56, rozstaw: 0.15 })];
// ROZŁOŻONA DŁOŃ: jedna, palce maksymalnie rozstawione
const rozlozona = [dlon({ srodekX: 0.5, rozstaw: 1.8 })];

const a = ocen(miseczka);
console.log(`miseczka Swaroga  -> swarog ${a.swarog.toFixed(2)}   stribog ${a.stribog.toFixed(2)}`);
const b = ocen(rozlozona);
console.log(`rozłożona dłoń    -> swarog ${b.swarog.toFixed(2)}   stribog ${b.stribog.toFixed(2)}`);

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
console.log();
spr('miseczka zapala Swaroga',             a.swarog > 0.5);
spr('miseczka NIE zapala Striboga',        a.stribog < 0.2);
spr('rozłożona dłoń zapala Striboga',      b.stribog > 0.5);
spr('rozłożona dłoń NIE zapala Swaroga',   b.swarog < 0.2);

// Ciągłość: powolne rozkładanie palców ma dawać PŁYNNY wzrost, nie skok 0->1
console.log('\nCIĄGŁOŚĆ wyniku Striboga przy rozkładaniu palców:');
let poprz = 0, maxSkok = 0, poziomy = [];
for (let rozstaw = 0.2; rozstaw <= 2.0; rozstaw += 0.05) {
  const w = new ZnakRegistry(); w.zarejestruj(stribog);
  const s = w.ocen({ hands: [dlon({ srodekX: 0.5, rozstaw })], pose: null, width: W, height: H }).stribog;
  maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
  if (Math.abs(rozstaw % 0.4) < 0.03) poziomy.push(`${rozstaw.toFixed(1)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok między krokami = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

process.exit(ok ? 0 : 1);
