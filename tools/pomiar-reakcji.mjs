/**
 * Pomiar reakcji dymu pod balans punktacji. Raport, nie test.
 *   node tools/pomiar-reakcji.mjs
 */
// Atrapa DOM jak w tools/test-dym.mjs - dym.js tworzy własne płótno
// (document.createElement), więc atrapa MUSI stać przed importem.
function atrapaCtx() {
    return {
        canvas: { width: 960, height: 540 }, globalAlpha: 1,
        clearRect() {}, drawImage() {}, save() {}, restore() {},
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}, fillRect() {}, stroke() {}, beginPath() {},
        moveTo() {}, lineTo() {}, translate() {}, rotate() {}
    };
}
globalThis.document = {
    createElement() {
        const plotno = { width: 1, height: 1, _ctx: null };
        plotno.getContext = () => (plotno._ctx ??= atrapaCtx());
        return plotno;
    }
};
const { Dym } = await import('../js/dym.js');
import { Punktacja, wartoscTechniki } from '../js/punkty.js';
import { KOMBOSY } from '../js/kombosy.js';

const W = 1920, H = 1080, DT = 1 / 60, POL = 0.5;
const USTA = { x: 960, y: 600 }, W_PRAWO = { x: 1, y: 0 };
const okadzenie = wartoscTechniki(KOMBOSY.find(k => k.id === 'dym'));

function chmura(sekundyDmuchania) {
    const d = new Dym();
    for (let i = 0; i < Math.round(sekundyDmuchania / DT); i++) {
        d.emituj(USTA, W_PRAWO, 1, 1, DT, W, H);
        d.updateAndDraw(null, W, H, DT);
    }
    return d;
}

function pozoga(sekundy) {
    const d = chmura(sekundy), p = new Punktacja();
    const n0 = d._czastki.length;
    const c = d._czastki[0];
    d.podpal([{ x: c.x / POL, y: c.y / POL, r: 10 }]);
    let t = 0;
    for (let i = 0; i < 60 * 30; i++, t += DT * 1000) {   // do 30 s - front musi przejść całą chmurę
        p.reakcja('pozoga', d.updateAndDraw(null, W, H, DT), t);
    }
    return { kleby: n0, wybuchy: p.momenty.serie.pozoga ?? 0, punkty: Math.round(p.rozbicie.reakcje) };
}

function rozwianie(sekundy) {
    const d = chmura(sekundy), p = new Punktacja();
    const n0 = d._czastki.length;
    d.pchnij([{ x: USTA.x, y: USTA.y, r: 5000, vx: 100, vy: 0, sila: 1 }]);
    d.updateAndDraw(null, W, H, DT);
    p.reakcja('rozwianie', d.ostatnioRozwiane, 0);
    return { kleby: n0, punkty: Math.round(p.rozbicie.reakcje) };
}

// Najgorszy przypadek farmienia: chmura dokarmiana CAŁY CZAS, fala co 3 s przez 60 s.
function farma() {
    const d = chmura(10), p = new Punktacja();
    let t = 0;
    for (let i = 0; i < 60 * 60; i++, t += DT * 1000) {
        d.emituj(USTA, W_PRAWO, 1, 1, DT, W, H);
        if (i % 180 === 0) d.pchnij([{ x: USTA.x, y: USTA.y, r: 5000, vx: 100, vy: 0, sila: 1 }]);
        d.updateAndDraw(null, W, H, DT);
        p.reakcja('rozwianie', d.ostatnioRozwiane, t);
    }
    return Math.round(p.rozbicie.reakcje);
}

console.log(`Okadzenie = ${okadzenie} pkt; cel pełnej Pożogi ${Math.round(1.5 * okadzenie)}-${2 * okadzenie}`);
for (const s of [2, 5, 15, 60]) {
    const a = pozoga(s), b = rozwianie(s);
    console.log(`dmuchanie ${String(s).padStart(2)} s: kłębów ${a.kleby} | Pożoga ×${a.wybuchy} = ${a.punkty} | Rozwianie = ${b.punkty}`);
}
console.log(`farma (chmura dokarmiana + fala co 3 s, 60 s): Rozwianie = ${farma()} pkt (cel ≤ ~1000)`);
