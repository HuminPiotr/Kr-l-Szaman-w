/**
 * Swaróg (miseczka) i reguła nadrzędna: wynik ma być CIĄGŁĄ rampą 0..1,
 * nie progiem tak/nie. Częściowe ułożenie dłoni musi dawać częściowy efekt.
 *
 *   node tools/test-znaki.mjs
 *
 * POPRAWKA (zadanie 8, seria "pięć pieczęci styku"). Ten plik pierwotnie
 * sprawdzał ROZDZIELNOŚĆ Swaroga (miseczka dłoni) i Striboga (rozłożona
 * dłoń) - dwóch znaków z systemu SPRZED przebudowy na piątkę pieczęci
 * styku. `stribog.js` został w zadaniu 8 przepisany W CAŁOŚCI na inny
 * mechanizm (powietrze: łokcie stykają się przed mostkiem, `wymaga: 'pose'`,
 * zero wspólnego kodu z dawną "rozłożoną dłonią", `wymaga: 'hands'`) -
 * fixture `rozlozona` niżej nie ma już ŻADNEGO związku z tym, co stribog
 * teraz mierzy, a ten plik nigdy nie podawał `pose`, więc nowy stribog
 * zawsze zwracał 0 i test rozdzielności fałszywie czerwienił się na
 * "rozłożona dłoń zapala Striboga".
 *
 * `swarog.js` (dawna "miseczka") NIE ZOSTAŁ jeszcze przepisany - to
 * planowane zadanie ognia ("piramidka Swaroga", patrz docstring
 * js/znaki/stribog.js) w tej samej serii. Do tego czasu ten plik jest
 * JEDYNYM testem swaroga w repo (żaden inny tools/test-*.mjs go nie
 * importuje) - usunięcie całego pliku zdjęłoby ogniowi jedyną siatkę
 * regresji dokładnie w momencie, gdy ogień jest następny w kolejce.
 * Dlatego zamiast kasować plik: import i rejestracja Striboga USUNIĘTE,
 * zostają wyłącznie asercje o Swarogu.
 *
 * DO ZROBIENIA W ZADANIU OGNIA: nowa rozdzielność ogień-vs-powietrze
 * (obie pieczęci pozowe, `tools/test-rozdzielnosc.mjs` zapowiedziane w
 * docstringu tools/test-postawy.mjs jest naturalnym miejscem) powinna
 * zastąpić to, co ten plik kiedyś sprawdzał.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { swarog } from '../js/znaki/swarog.js';

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
r.zarejestruj(swarog);
const ocen = (hands) => r.ocen({ hands, pose: null, width: W, height: H });

// MISECZKA: dwie dłonie w optymalnej odległości, palce zsunięte
const miseczka = [dlon({ srodekX: 0.44, rozstaw: 0.15 }), dlon({ srodekX: 0.56, rozstaw: 0.15 })];
// ROZŁOŻONA DŁOŃ: jedna, palce maksymalnie rozstawione. Zostaje jako
// kontrprzykład DLA SWAROGA (miseczka wymaga dłoni ZSUNIĘTYCH, nie
// rozstawionych) - jedyna część dawnego sensu tego fixture'a, która wciąż
// obowiązuje bez Striboga.
const rozlozona = [dlon({ srodekX: 0.5, rozstaw: 1.8 })];

const a = ocen(miseczka);
console.log(`miseczka Swaroga  -> swarog ${a.swarog.toFixed(2)}`);
const b = ocen(rozlozona);
console.log(`rozłożona dłoń    -> swarog ${b.swarog.toFixed(2)}`);

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
console.log();
spr('miseczka zapala Swaroga',             a.swarog > 0.5);
spr('rozłożona dłoń NIE zapala Swaroga',   b.swarog < 0.2);

process.exit(ok ? 0 : 1);
