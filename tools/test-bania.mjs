/**
 * Bania - buchnięcia pary z ciała; bez document.
 *   node tools/test-bania.mjs
 */
import { Bania, obwiedniaKlebu, punktyZrodel, CZAS_TRWANIA, NASTAWY } from '../js/bania.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('OBWIEDNIA KŁĘBU:');
spr('zero na końcach życia, NaN -> 0', obwiedniaKlebu(0, 1) === 0 && obwiedniaKlebu(1, 1) === 0 && obwiedniaKlebu(NaN, 1) === 0);
spr('szybki narost - już po 1/10 życia wyraźnie widoczny', obwiedniaKlebu(0.1, 1) > 0.5);
spr('gaśnie monotonicznie w drugiej połowie', obwiedniaKlebu(0.5, 1) > obwiedniaKlebu(0.8, 1));

console.log('\nŹRÓDŁA PARY:');
const zr = punktyZrodel(klatka(), W, H);
spr(`z pozy - pięć punktów (głowa, barki, łokcie): ${zr.length}`, zr.length === 5);
spr('bez pozy - brak źródeł', punktyZrodel(klatka({ barki: null }), W, H).length === 0);

console.log('\nCYKL ŻYCIA:');
const b = new Bania();
spr('przed zapal() nieaktywna', b.aktywny === false);
b.zapal(0);
spr('zapal(0) nic nie robi', b.aktywny === false);
b.zapal(1);
przepusc(b, klatka(), 1 / 60);
const naBuch = 5 * NASTAWY.KLEBOW_NA_ZRODLO;
spr(`pierwsze buchnięcie od razu (${naBuch} kłębów)`, b._kleby.length === naBuch);
const d0 = b._kleby.map(k => Math.hypot(k.vx, k.vy));
przepusc(b, klatka(), 0.15);
const d1 = b._kleby.slice(0, naBuch).map(k => Math.hypot(k.vx, k.vy));
spr('kłęby gwałtownie hamują (buchnięcie, nie snucie)', d1.every((v, i) => v < d0[i] * 0.6));
przepusc(b, klatka(), NASTAWY.BUCHNIECIA[1]);
spr('drugie buchnięcie dokłada kłęby', b._kleby.length > naBuch);
przepusc(b, klatka({ barki: null }), 0.1);
spr('poza znika - pozycje skończone', b._kleby.every(k => Number.isFinite(k.x) && Number.isFinite(k.y)));
let rzucil = false;
try { b.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez assetów i document) nie rzuca', rzucil === false);
przepusc(b, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA, bez kłębów', b.aktywny === false && b._kleby.length === 0);
spr('krótka technika (dwójka) - poniżej 2 s', CZAS_TRWANIA <= 2);

console.log('\nBEZ POZY OD POCZĄTKU:');
const bb = new Bania();
bb.zapal(1);
przepusc(bb, klatka({ barki: null }), 0.2);
spr('bez pozy i bez historii - buchnięcie ze środka kadru, skończone', bb._kleby.length > 0 && bb._kleby.every(k => Number.isFinite(k.x) && Number.isFinite(k.y)));

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
