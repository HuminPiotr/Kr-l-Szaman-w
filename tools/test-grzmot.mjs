/**
 * Grzmot v2 - błysk, pierścień od środka ciała, iglice, dudnienie, pchnięcie dymu; bez document.
 *   node tools/test-grzmot.mjs
 */
import { Grzmot, zaczepKlatki, promienPierscienia, alfaPierscienia, jasnoscBlysku, zygzak, NASTAWY, CZAS_CALKOWITY } from '../js/grzmot.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const RMAX = Math.hypot(W, H);

console.log('ZACZEP KLATKI PIERSIOWEJ:');
const z = zaczepKlatki(klatka(), W, H);
spr(`pod środkiem barków (${z.x.toFixed(0)}, ${z.y.toFixed(0)})`, Math.abs(z.x - W * 0.5) < 1 && z.y > H * 0.4);
spr('skala = szerokość barków', Math.abs(z.skala - 0.1 * W) < 1);
const zb = zaczepKlatki(klatka({ barki: null }), W, H);
spr('bez pozy - umowny środek kadru, skończony', [zb.x, zb.y, zb.skala].every(Number.isFinite));

console.log('\nPIERŚCIEŃ:');
spr('promień 0 przed startem i dla NaN', promienPierscienia(0, RMAX) === 0 && promienPierscienia(-1, RMAX) === 0 && promienPierscienia(NaN, RMAX) === 0 && promienPierscienia(0.1, NaN) === 0);
spr('rośnie monotonicznie', [0.05, 0.1, 0.2, 0.4, 0.65].every((t, i, a) => i === 0 || promienPierscienia(t, RMAX) > promienPierscienia(a[i - 1], RMAX)));
spr('dociera do rogu kadru (promień max) w CZAS_PIERSCIENIA', Math.abs(promienPierscienia(NASTAWY.CZAS_PIERSCIENIA, RMAX) - RMAX) < 1e-6);
spr('ease-out: szybki start (w połowie czasu > 70% drogi)', promienPierscienia(NASTAWY.CZAS_PIERSCIENIA / 2, RMAX) > 0.7 * RMAX);
spr('promień max sięga rogu z KAŻDEGO środka w kadrze', RMAX >= Math.hypot(W, H));
spr('alfa: 0 na końcach, NaN -> 0, szybki narost', alfaPierscienia(0) === 0 && alfaPierscienia(NASTAWY.CZAS_PIERSCIENIA) === 0 && alfaPierscienia(NaN) === 0 && alfaPierscienia(0.05) > 0.4);

console.log('\nBŁYSK:');
spr('0 na końcach i dla NaN', jasnoscBlysku(0) === 0 && jasnoscBlysku(NASTAWY.BLYSK_CZAS) === 0 && jasnoscBlysku(NaN) === 0);
spr('pełna jasność na plato', jasnoscBlysku(NASTAWY.BLYSK_NAROST + 0.01) > 0.99 || jasnoscBlysku(NASTAWY.BLYSK_PLATO - 0.01) === 1);
spr('potem gaśnie monotonicznie', jasnoscBlysku(0.15) > jasnoscBlysku(0.25) && jasnoscBlysku(0.25) > jasnoscBlysku(0.35));

console.log('\nIGLICE:');
{
    const a = zygzak(2, 5, 960, 540, 400, 190), b = zygzak(2, 5, 960, 540, 400, 190), c = zygzak(2, 6, 960, 540, 400, 190);
    spr('deterministyczny, w kolejnym kroku zmienia kształt', JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c));
    spr(`${NASTAWY.IGLICA_SEGMENTOW + 1} punktów, skończone`, a.length === NASTAWY.IGLICA_SEGMENTOW + 1 && a.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const odl = (p) => Math.hypot(p.x - 960, p.y - 540);
    spr('końce iglicy leżą na okręgu pierścienia (±5%)', Math.abs(odl(a[0]) - 400) < 20 && Math.abs(odl(a.at(-1)) - 400) < 20);
}

console.log('\nCYKL ŻYCIA, WYBUCH, DUDNIENIE:');
const g = new Grzmot();
spr('przed zapal() nieaktywny, bez wybuchu', !g.aktywny && g.wybuch === null && g.dudnienia.length === 0);
g.zapal(z, 0);
spr('zapal(sila 0) nic nie robi', !g.aktywny);
g.zapal({ x: NaN, y: 1, skala: 10 }, 1);
spr('zapal(NaN) nic nie robi', !g.aktywny);
g.zapal(z, 1);
spr('przed updateAndDraw wybuch jeszcze niewidoczny', g.wybuch === null && g.aktywny);
g.updateAndDraw(null, kontekst(klatka()), 1 / 60);
spr('pierwsza klatka - wybuch z zaczepem', g.wybuch?.x === z.x && g.wybuch?.sila === 1);
g.updateAndDraw(null, kontekst(klatka()), 1 / 60);
spr('druga klatka - wybuch zniknął', g.wybuch === null);
{
    const g2 = new Grzmot();
    g2.zapal(z, 1);
    const sily = [];
    for (let i = 0; i < Math.round(CZAS_CALKOWITY / (1 / 60)) + 5; i++) {
        g2.updateAndDraw(null, kontekst(klatka()), 1 / 60);
        sily.push(...g2.dudnienia);
    }
    spr(`dudnienie: ${NASTAWY.DUDNIENIE.length} uderzeń, każde raz, słabnące (${sily.map(s => s.toFixed(2))})`,
        sily.length === NASTAWY.DUDNIENIE.length && sily.every((s, i) => i === 0 || s < sily[i - 1]));
    spr('po CZAS_CALKOWITY nieaktywny', !g2.aktywny);
}
{
    const g3 = new Grzmot();
    g3.zapal(z, 1);
    const wsz = [];
    for (let i = 0; i < 100; i++) { g3.updateAndDraw(null, kontekst(klatka()), 0.1); wsz.push(...g3.dudnienia); }
    spr('duże dt (powrót na kartę) nie zdubluje uderzeń', wsz.length === NASTAWY.DUDNIENIE.length);
}

console.log('\nPCHNIĘCIE DYMU:');
{
    const gp = new Grzmot();
    spr('nieaktywny - pusto', gp.punktyPchniecia().length === 0);
    gp.zapal(z, 1);
    przepusc(gp, klatka(), 0.1);
    const pk = gp.punktyPchniecia();
    spr(`${NASTAWY.PUNKTOW_PCHNIECIA} punktów na okręgu, skończone`, pk.length === NASTAWY.PUNKTOW_PCHNIECIA && pk.every(q => [q.x, q.y, q.r, q.vx, q.vy, q.sila].every(Number.isFinite)));
    spr('prędkość PROMIEŚCIOWO na zewnątrz od środka ciała (we wszystkie strony)', pk.every(q => (q.x - z.x) * q.vx + (q.y - z.y) * q.vy > 0));
    const R = promienPierscienia(gp._t, RMAX);
    spr('punkty leżą na okręgu o promieniu pierścienia', pk.every(q => Math.abs(Math.hypot(q.x - z.x, q.y - z.y) - R) < 1e-6));
    spr('punkty rozłożone w obie strony (kątowo pokrywają cały okrąg)', pk.some(q => q.vx > 0) && pk.some(q => q.vx < 0) && pk.some(q => q.vy > 0) && pk.some(q => q.vy < 0));
}

console.log('\nODPORNOŚĆ:');
const g4 = new Grzmot();
g4.zapal(z, 1);
let rzuca = false;
try {
    g4.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60);
    przepusc(g4, klatka(), 0.3);
    g4.updateAndDraw(atrapaCtx(), kontekst(klatka()), NaN);
    g4.updateAndDraw(atrapaCtx(), null, 1e9);
} catch (e) { rzuca = e; }
spr('rysowanie na atrapie / NaN dt / brak kontekstu - bez wyjątku', rzuca === false);

process.exit(ok ? 0 : 1);
