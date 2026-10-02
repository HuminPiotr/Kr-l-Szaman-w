/**
 * Kurzawa - lej wiru pyłu: tor drobiny, cykl życia, śledzenie; bez document.
 *   node tools/test-kurzawa.mjs
 */
import { Kurzawa, obwiednia, pozycjaDrobiny, CZAS_TRWANIA, NASTAWY } from '../js/kurzawa.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('TOR DROBINY:');
const srodek = { x: 1000, y: 400 }, skala = 200;
const c = { kat0: 0, kierunek: 1, zycie: 2, wiek: 0 };
const dol = pozycjaDrobiny({ ...c, wiek: 0.01 }, srodek, skala);
const gora = pozycjaDrobiny({ ...c, wiek: 1.99 }, srodek, skala);
spr('drobina startuje przy pasie, kończy nad głową', dol.y > srodek.y + skala && gora.y < srodek.y - skala);
spr('lej rozszerza się w górę (promień rośnie)', gora.promien > dol.promien);
spr('alfa zero na końcach toru, pełna w połowie', dol.alfa < 0.05 && pozycjaDrobiny({ ...c, wiek: 1 }, srodek, skala).alfa > 0.99);
spr('obwiednia zero po końcu, NaN -> 0', obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const k = new Kurzawa();
spr('bezczynna na starcie', k.aktywny === false);
k.zapal(1); k.zapal(1);
spr('ponowny zapal() restartuje, nie podwaja', k._pyl.length === NASTAWY.LICZBA_PYLU);
przepusc(k, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const x1 = k.zaczep.x;
przepusc(k, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', k.zaczep.x > x1 + 100);
const x2 = k.zaczep.x;
przepusc(k, klatka({ barki: null }), 0.3);
spr('poza znika -> zaczep stoi', k.zaczep.x === x2);
let rzucil = false;
try { k.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie bez assetów nie rzuca', rzucil === false);
przepusc(k, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', k.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
