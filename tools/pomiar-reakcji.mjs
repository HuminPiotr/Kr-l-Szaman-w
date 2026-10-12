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

// Dymny wir: Kurzawa (4 pasy) wyśrodkowana na ciele (usta), zapalona na chmurze;
// trąbę podpalają ogniki po ZAPLON_S, Kurzawa puszcza po KURZAWA_S (5 s, ~9 s z Wirem ogników).
function wir(sekundy, kurzawaS, zaplonS = 2) {
    const d = chmura(sekundy), p = new Punktacja();
    const sk = 190, orbity = [1.3, 0.7, 0.1, -0.5].map((dy, i) => ({ cx: USTA.x, cy: Math.min(USTA.y - 200 + dy * sk, H * 0.92),
        R: sk * 1.45, squash: 0.28, kierunek: i % 2 ? -1 : 1, predkosc: 3.6 }));
    let t = 0, wirPkt = 0;
    for (let i = 0; i < 60 * 30; i++, t += DT * 1000) {
        const ts = i * DT;
        if (ts < kurzawaS) d.zawiruj(orbity);
        if (Math.abs(ts - zaplonS) < DT / 2) {
            const c = d._czastki.find(q => q.zawirowany && q.stan === 'DYM') ?? d._czastki[0];
            d.podpal([{ x: c.x / POL, y: c.y / POL, r: 10 }]);
        }
        p.reakcja('pozoga', d.updateAndDraw(null, W, H, DT), t);
        const przed = p.rozbicie.reakcje;
        p.reakcja('wirDymu', d.ostatnioZawirowane, t);
        wirPkt += p.rozbicie.reakcje - przed;
        p.reakcja('ognistyWir', d.ostatnioWybuchyWiru, t);
    }
    return { wir: Math.round(wirPkt), razem: Math.round(p.rozbicie.reakcje - wirPkt),
             zawirowane: p.momenty.serie.wirDymu ?? 0, wybuchyWiru: p.momenty.serie.ognistyWir ?? 0, wybuchy: p.momenty.serie.pozoga ?? 0 };
}

console.log(`Okadzenie = ${okadzenie} pkt; cel pełnej Pożogi ${Math.round(1.5 * okadzenie)}-${2 * okadzenie}`);
for (const s of [2, 5, 15, 60]) {
    const a = pozoga(s), b = rozwianie(s);
    console.log(`dmuchanie ${String(s).padStart(2)} s: kłębów ${a.kleby} | Pożoga ×${a.wybuchy} = ${a.punkty} | Rozwianie = ${b.punkty}`);
}
console.log(`farma (chmura dokarmiana + fala co 3 s, 60 s): Rozwianie = ${farma()} pkt (cel ≤ ~1000)`);
for (const s of [5, 15, 60]) for (const k of [5, 9]) {
    const w = wir(s, k);
    console.log(`chmura ${String(s).padStart(2)} s, Kurzawa ${k} s: Dymny wir (${w.zawirowane} kłębów) = ${w.wir} | trąba: wybuchów ${w.wybuchy}, z wiru ${w.wybuchyWiru} -> Pożoga + Ognisty wir = ${w.razem}`);
}
