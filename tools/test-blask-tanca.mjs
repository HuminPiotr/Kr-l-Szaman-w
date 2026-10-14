/**
 * Blask tańca - połysk tańczących partii i bieg fali.
 *
 *   node tools/test-blask-tanca.mjs
 */
import { BlaskTanca } from '../js/blaskTanca.js';
import { PARTIE } from '../js/jakosc/zaangazowanie.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

function atrapa() {
    const l = { arc: 0, stroke: 0 };
    const ctx = {
        globalCompositeOperation: 'source-over', globalAlpha: 1, lineWidth: 1, lineCap: 'butt', strokeStyle: '', fillStyle: '',
        save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, fill() {},
        arc() { l.arc++; }, stroke() { l.stroke++; },
        createRadialGradient: () => ({ addColorStop() {} })
    };
    return { ctx, l };
}
const lm = Array.from({ length: 33 }, (_, i) => ({ x: 0.5 + (i % 2 ? 0.05 : -0.05), y: 0.3 + i * 0.01, z: 0, visibility: 0.9 }));
const frame = { pose: { landmarks: lm }, width: 1920, height: 1080 };
const jakosc = (akt, fala = null, lancuch = null) => ({
    zaangazowanieMiara: { aktywnosci: Object.fromEntries(PARTIE.map(p => [p, akt[p] ?? 0])) },
    falaMiara: { fala, diagnostyka: { lancuch } },
    okres: { okresS: 1 }
});

{
    const b = new BlaskTanca(), { ctx, l } = atrapa();
    for (let i = 0; i < 60; i++) b.updateAndDraw(ctx, frame, jakosc({}), 1, 1 / 60);
    spr('nic nie tańczy -> nic się nie rysuje', l.arc === 0 && l.stroke === 0);
}
{
    const b = new BlaskTanca(), { ctx, l } = atrapa();
    for (let i = 0; i < 60; i++) b.updateAndDraw(ctx, frame, jakosc({ biodra: 1, glowa: 1 }), 1, 1 / 60);
    spr('tańczące partie dostają połysk', l.arc > 0);
}
{
    const b = new BlaskTanca(), { ctx, l } = atrapa();
    for (let i = 0; i < 60; i++) b.updateAndDraw(ctx, frame, jakosc({}, 0.9, 'ramieL'), 1, 1 / 60);
    spr('wysoka fala rysuje kreskę wzdłuż łańcucha', l.stroke > 0);
}
{
    const b = new BlaskTanca(), { ctx } = atrapa();
    let blad = null;
    try {
        b.updateAndDraw(ctx, null, null, NaN, 1 / 60);
        b.updateAndDraw(ctx, { pose: null, width: 1920, height: 1080 }, jakosc({ biodra: 1 }), 1, NaN);
        b.updateAndDraw(null, frame, jakosc({ biodra: 1 }), 1, 1 / 60);
        const zle = { pose: { landmarks: lm.map(p => ({ ...p, x: NaN })) }, width: 1920, height: 1080 };
        b.updateAndDraw(ctx, zle, jakosc({ biodra: 1 }, 0.9, 'ramieL'), 1, 1 / 60);
    } catch (e) { blad = e; }
    spr('null / NaN / brak płótna nie rzucają', blad === null && Number.isFinite(b._faza));
}
process.exit(ok ? 0 : 1);
