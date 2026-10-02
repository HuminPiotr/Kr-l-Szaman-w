/**
 * Kamienna Tarcza - obwiednia, orbita, śledzenie barków, cykl życia; bez document.
 *   node tools/test-kamienna-tarcza.mjs
 */
import { KamiennaTarcza, obwiednia, pozycjaOdlamka, CZAS_TRWANIA, NASTAWY } from '../js/kamiennaTarcza.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('OBWIEDNIA:');
spr('zero na starcie i po końcu', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0);
spr('pełna w środku', obwiednia(CZAS_TRWANIA * 0.5) > 0.99);
spr('NaN -> 0', obwiednia(NaN) === 0);

console.log('\nORBITA:');
const o = { kat0: 0, kierunek: 1, promienWsp: 1, wysokosc: 0, obrot0: 0, vObrot: 0, opoznienieOpadu: 0 };
const srodek = { x: 1000, y: 400 };
const p0 = pozycjaOdlamka(o, 0, srodek, 200);
spr('w t=0 odłamek wylatuje Z BARKÓW (promień 0)', Math.abs(p0.x - 1000) < 1e-6);
const p1 = pozycjaOdlamka(o, NASTAWY.T_FORMOWANIA, srodek, 200);
spr('po formowaniu na orbicie (promień = skala*PROMIEN_MNOZNIK)', Math.abs(Math.hypot(p1.x - 1000, (p1.y - 400 - 200 * NASTAWY.OBNIZENIE_MNOZNIK) / NASTAWY.SQUASH) - 200 * NASTAWY.PROMIEN_MNOZNIK) < 1);
const pSpad = pozycjaOdlamka(o, CZAS_TRWANIA - 0.01, srodek, 200);
const pPrzed = pozycjaOdlamka(o, NASTAWY.T_OPADANIA - 0.01, srodek, 200);
// Spadek po ~1 s to setki px; wahanie samej orbity w pionie to najwyżej 2*r*SQUASH (~190 px).
spr('pod koniec kamienie OPADAJĄ (niżej niż orbita)', pSpad.y > pPrzed.y + 200 * NASTAWY.PROMIEN_MNOZNIK * NASTAWY.SQUASH * 2);

console.log('\nCYKL ŻYCIA I ŚLEDZENIE:');
const t = new KamiennaTarcza();
spr('bezczynna na starcie', t.aktywny === false);
t.zapal(1);
spr(`zapal() -> aktywna, ${NASTAWY.LICZBA} odłamków`, t.aktywny && t._odlamki.length === NASTAWY.LICZBA);
t.zapal(1);
spr('ponowny zapal() RESTARTUJE, nie podwaja', t._odlamki.length === NASTAWY.LICZBA && t._t === 0);
przepusc(t, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const z1 = { ...t.zaczep };
przepusc(t, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', t.zaczep.x > z1.x + 100);
const z2 = { ...t.zaczep };
przepusc(t, klatka({ barki: null }), 0.5);
spr('poza znika -> zaczep stoi, skończony', t.zaczep.x === z2.x && Number.isFinite(t.zaczep.skala));
let rzucil = false;
try { t.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie bez załadowanych assetów i bez document nie rzuca', rzucil === false);
przepusc(t, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', t.aktywny === false);
const bezPozy = new KamiennaTarcza();
bezPozy.zapal(1);
przepusc(bezPozy, klatka({ barki: null }), 0.2);
spr('bez pozy od początku - zaczep zastępczy, skończony', Number.isFinite(bezPozy.zaczep.x) && bezPozy.zaczep.skala > 1);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
