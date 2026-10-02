/**
 * Mgła Mokoszy - przetaczanie się przez kadr, zwalnianie przy sylwetce; bez document.
 *   node tools/test-mgla-mokoszy.mjs
 */
import { MglaMokoszy, obwiednia, predkoscKlebu, CZAS_TRWANIA, NASTAWY } from '../js/mglaMokoszy.js';
import { klatka, kontekst, przepusc, atrapaCtx, W } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('PRĘDKOŚĆ KŁĘBU:');
const daleko = predkoscKlebu(0, 1000, 500, 200), blisko = predkoscKlebu(1000, 1000, 500, 200);
spr('daleko od sylwetki - pełna prędkość', Math.abs(daleko - 500) < 1e-9);
spr('przy sylwetce zwalnia (gęstnieje), ale nie staje', blisko < daleko && blisko >= 500 * NASTAWY.ZWOLNIENIE - 1e-9);
spr('kierunek zachowany (ujemna v0)', predkoscKlebu(1000, 1000, -500, 200) < 0);
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const m = new MglaMokoszy();
m.zapal(1); m.zapal(1);
przepusc(m, klatka(), 1 / 60);
spr(`kłęby rodzą się przy pierwszej klatce (${NASTAWY.LICZBA}), restart nie podwaja`, m._kleby.length === NASTAWY.LICZBA);
const startX = m._kleby.map(k => k.x);
spr('wszystkie startują POZA kadrem z jednej strony', startX.every(x => x < 0) || startX.every(x => x > W));
przepusc(m, klatka(), 3);
spr('po kilku sekundach mgła jest w kadrze', m._kleby.some(k => k.x > 0 && k.x < W));
przepusc(m, klatka({ barki: null }), 0.2);
spr('poza znika - pozycje skończone', m._kleby.every(k => Number.isFinite(k.x) && Number.isFinite(k.y)));
let rzucil = false;
try { m.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez assetów i document) nie rzuca', rzucil === false);
przepusc(m, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', m.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
