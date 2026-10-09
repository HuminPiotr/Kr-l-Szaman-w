/**
 * Bania - smugi pary (strumień -> wstęga) z ciała; bez document.
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
const naBuch = 5 * NASTAWY.SMUG_NA_ZRODLO;
spr(`pierwsze buchnięcie od razu (${naBuch} smug)`, b._smugi.length === naBuch);
const v0 = b._smugi.map(m => Math.hypot(m.vx, m.vy));
przepusc(b, klatka(), 0.1);
const pierwsze = b._smugi.slice(0, naBuch);
spr('głowy gwałtownie hamują (strumień, nie snucie)', pierwsze.every((m, i) => Math.hypot(m.vx, m.vy) < v0[i] * 0.6));
spr('ślad rośnie', pierwsze.every(m => m.wezly.length >= 3));

/** Średnie największe odchylenie węzłów od prostej koniec-koniec śladu, w skalach barków. */
const skala = 0.1 * W;
const odchylenie = (smugi) => {
    let suma = 0;
    for (const m of smugi) {
        const w = m.wezly, a = w[0], z = w[w.length - 1];
        const dl = Math.hypot(z.x - a.x, z.y - a.y) || 1;
        let max = 0;
        for (const p of w) max = Math.max(max, Math.abs((z.x - a.x) * (a.y - p.y) - (a.x - p.x) * (z.y - a.y)) / dl);
        suma += max / skala;
    }
    return suma / smugi.length;
};
const proste = odchylenie(pierwsze);
przepusc(b, klatka(), NASTAWY.BUCHNIECIA[1]);
spr('drugie buchnięcie dokłada smugi', b._smugi.length > naBuch);
spr(`ślad nie przekracza WEZLOW_MAX (${NASTAWY.WEZLOW_MAX})`, b._smugi.every(m => m.wezly.length <= NASTAWY.WEZLOW_MAX));
const zawiniete = odchylenie(b._smugi.slice(0, naBuch).filter(m => m.wezly.length >= 3));
spr(`ślad zawija się z czasem (odchylenie ${proste.toFixed(3)} -> ${zawiniete.toFixed(3)} skali)`, zawiniete > proste * 1.5);
przepusc(b, klatka({ barki: null }), 0.1);
spr('poza znika - pozycje skończone', b._smugi.every(m => m.wezly.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));
let rzucil = false;
try { b.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez document) nie rzuca', rzucil === false);
przepusc(b, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA, bez smug', b.aktywny === false && b._smugi.length === 0);
spr('krótka technika (dwójka) - poniżej 2 s', CZAS_TRWANIA <= 2);

console.log('\nBEZ POZY OD POCZĄTKU:');
const bb = new Bania();
bb.zapal(1);
przepusc(bb, klatka({ barki: null }), 0.2);
spr('bez pozy i bez historii - buchnięcie ze środka kadru, skończone', bb._smugi.length > 0 && bb._smugi.every(m => m.wezly.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
