/**
 * Mnożniki tempa ładowania w MotionMeter (jakość tańca, gniazdo transu).
 *
 *   node tools/test-motion-mnozniki.mjs
 *
 * Domyślne argumenty = dokładnie dzisiejsze zachowanie. Mnożnik zmienia TEMPO,
 * nigdy nie zatrzymuje ładowania (GEMINI.md §2).
 */
import { MotionMeter } from '../js/motionMeter.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60, SL = [15, 16, 13, 14, 27, 28];
const cialo = t => { const l = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
    for (const i of SL) l[i] = { x: 0.35 * Math.sin(2 * Math.PI * t), y: 0, z: 0, visibility: 0.9 }; return l; };
const klatka = (i) => ({ hands: [], pose: { landmarks: [], worldLandmarks: cialo(i * DT) }, width: 1920, height: 1080, dt: DT, now: i * DT * 1000 });

function ladujDo(args, maxS = 180) {
    const m = new MotionMeter();
    for (let i = 0; i < maxS / DT; i++) {
        m.update(klatka(i), ...args);
        if (m.moc >= 0.99) return { t: i * DT, m };
    }
    return { t: null, m };
}
const dzis = ladujDo([1]).t;
const jawnie = ladujDo([1, false, 1, 1]).t;
const nisko = ladujDo([1, false, 0.67]).t;
const wysoko = ladujDo([1, false, 1.33]).t;
const najwolniej = ladujDo([0, false, 0.67]).t;
const zNaN = ladujDo([1, false, NaN, NaN]).t;
console.log(`  dziś ${dzis?.toFixed(1)} s · ×0.67 ${nisko?.toFixed(1)} s · ×1.33 ${wysoko?.toFixed(1)} s · szarpane ×0.67 ${najwolniej?.toFixed(1)} s`);

spr('domyślne argumenty = jawne 1, 1 (dzisiejsze zachowanie)', dzis === jawnie);
spr('×0.67 ładuje ~1.5× dłużej', nisko / dzis > 1.4 && nisko / dzis < 1.6);
spr('×1.33 ładuje ~0.75× czasu', wysoko / dzis > 0.7 && wysoko / dzis < 0.8);
spr('szarpany ruch przy ×0.67 NADAL ładuje (nic nie mówi źle)', najwolniej !== null);
spr('NaN jako mnożnik = 1', zNaN === dzis);
{
    const { m } = ladujDo([1, false, 1.33]);
    spr('tempoLadowania jest skończone i dodatnie przy ruchu', Number.isFinite(m.tempoLadowania) && m.tempoLadowania > 0);
    spr('mnożniki zapamiętane do HUD', m.mnoznikBogactwa === 1.33 && m.mnoznikTransu === 1);
}
process.exit(ok ? 0 : 1);
