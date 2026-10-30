/**
 * Efekty stopni transu - winieta, kręgi od stóp, echa, przodkowie (atrapa płótna).
 *
 *   node tools/test-trans-efekty.mjs
 */
import { TransEfekty, geometriaCiala, NASTAWY_EFEKTOW as N } from '../js/trans/transEfekty.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const licz = { fillRect: 0, ellipse: 0, drawImage: 0 };
const atrapaCtx = () => ({
    globalCompositeOperation: 'source-over', globalAlpha: 1, lineWidth: 1, strokeStyle: '', fillStyle: '', filter: 'none',
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, stroke() {}, clearRect() {}, putImageData() {},
    fillRect() { licz.fillRect++; }, ellipse() { licz.ellipse++; }, drawImage() { licz.drawImage++; },
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
});
const atrapaPlotna = () => { const c = atrapaCtx(); return { width: 0, height: 0, getContext: () => c }; };
const zeruj = () => { for (const k of Object.keys(licz)) licz[k] = 0; };

const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
lm[11] = { x: 0.45, y: 0.35, visibility: 0.9 }; lm[12] = { x: 0.55, y: 0.35, visibility: 0.9 };
lm[27] = { x: 0.47, y: 0.9, visibility: 0.9 }; lm[28] = { x: 0.53, y: 0.9, visibility: 0.9 };
const frame = { pose: { landmarks: lm }, width: 1280, height: 720 };
const maska = { dane: new Uint8Array(64 * 36).fill(200), szer: 64, wys: 36 };
const fit = { offsetX: 0, offsetY: 0, scaledW: 1280, scaledH: 720 };
const trans = (poziom) => ({ sila: (s) => Math.max(0, Math.min(1, poziom - (s - 1))) });
const DT = 1 / 30, OKRES = 0.46;

/** Gra `sekund` przy stałym poziomie transu; uderzenia co OKRES. */
function graj(e, poziom, sekund, z = true) {
    const ctx = atrapaCtx();
    for (let i = 0; i < sekund / DT; i++) {
        const t = i * DT;
        const takt = z ? { indeks: Math.floor(t / OKRES), faza01: (t / OKRES) % 1, okresS: OKRES } : null;
        e.rysujPrzed(ctx, frame, trans(poziom), takt, maska, fit, DT);
        e.rysujPo(ctx, frame, trans(poziom), fit);
    }
}

{
    const g = geometriaCiala(frame);
    spr(`geometria: szerokość barków ${g.bw.toFixed(0)} px, stopy niżej niż barki`, g.bw > 100 && g.stopy.y > g.barki.y);
    spr('brak pozy -> null', geometriaCiala({ pose: null, width: 1, height: 1 }) === null);
}
{
    zeruj(); graj(new TransEfekty({ plotno: atrapaPlotna }), 0, 3);
    spr('poziom 0: nic się nie rysuje', licz.fillRect === 0 && licz.ellipse === 0 && licz.drawImage === 0);
}
{
    const e = new TransEfekty({ plotno: atrapaPlotna });
    zeruj(); graj(e, 1, 3);
    spr(`stopień 1: winieta i kręgi od stóp (${e._kregi.length} kręgi żyją naraz)`, licz.fillRect > 0 && licz.ellipse > 0 && e._kregi.length >= 2 && e._kregi.length <= 4);
    spr('stopień 1: bez ech i przodków', e._echa.length === 0 && e._historia.length === 0);
}
{
    const e = new TransEfekty({ plotno: atrapaPlotna });
    graj(e, 2, 3);
    spr(`stopień 2: echa co ${N.ECHO_CO_UDERZEN} uderzenia (${e._echa.length} żyje, max ${N.MAX_ECH})`, e._echa.length >= 1 && e._echa.length <= N.MAX_ECH);
}
{
    const e = new TransEfekty({ plotno: atrapaPlotna });
    zeruj(); graj(e, 3, 4);
    spr(`stopień 3: historia masek (${e._historia.length}) i przodkowie rysowani`, e._historia.length > 10 && licz.drawImage > 0);
    const pula = e._pula.length;
    graj(e, 0, 5);
    spr(`po zgaśnięciu: historia i echa oddane do puli (${pula} -> ${e._pula.length}), nic nie rośnie`, e._historia.length === 0 && e._echa.length === 0);
}
{
    const e = new TransEfekty({ plotno: atrapaPlotna });
    zeruj(); graj(e, 3, 2, false);
    spr('bez pieśni (takt null): bez kręgów i ech, bez wyjątku', e._kregi.length === 0 && e._echa.length === 0);
    let blad = null;
    try {
        e.rysujPrzed(null, null, null, null, null, null, NaN);
        e.rysujPrzed(atrapaCtx(), { pose: { landmarks: lm.map(p => ({ ...p, x: NaN })) }, width: 1280, height: 720 }, trans(3), { indeks: NaN, faza01: NaN, okresS: NaN }, maska, fit, DT);
        e.rysujPo(null, frame, trans(3), fit);
    } catch (x) { blad = x; }
    spr('null / NaN nie rzucają', blad === null);
}
process.exit(ok ? 0 : 1);
