/**
 * Zaangażowanie ciała - ile partii tańczy.
 *
 *   node tools/test-zaangazowanie.mjs
 */
import { Zaangazowanie, PARTIE } from '../js/jakosc/zaangazowanie.js';
import { Cialo2D } from '../js/jakosc/cialo2d.js';

// mulberry32 - patrz tools/test-plynnosc.mjs, dlaczego nie naiwny LCG.
let ziarno = 42;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => {
    const u = losowa() || 1e-9, v = losowa();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const SIGMA = 0.009, FPS = 60, DT = 1 / FPS;
const om = 2 * Math.PI * 0.8;

// Postawa stojąca w worldLandmarks (metry, y w dół, początek w biodrach).
const BAZA = { 0: [0, -0.62], 11: [0.18, -0.45], 12: [-0.18, -0.45], 13: [0.25, -0.2], 14: [-0.25, -0.2],
               15: [0.27, 0.02], 16: [-0.27, 0.02], 23: [0.1, 0], 24: [-0.1, 0],
               25: [0.11, 0.42], 26: [-0.11, 0.42], 27: [0.11, 0.82], 28: [-0.11, 0.82] };

/** ruch(t) -> {indeks: [dx, dy]} przesunięcia względem BAZY; biodra2d(t) -> {x,y}|null */
function przebieg(ruch, biodra2d = () => ({ x: 0, y: 0 }), { sekund = 6, widoczneNogi = true } = {}) {
    const m = new Zaangazowanie();
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const d = ruch(t);
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
        for (const [k, [x, y]] of Object.entries(BAZA)) {
            const [dx, dy] = d[k] ?? [0, 0];
            const noga = [25, 26, 27, 28].includes(Number(k));
            w[k] = { x: x + dx + gauss() * SIGMA, y: y + dy + gauss() * SIGMA, z: 0,
                     visibility: noga && !widoczneNogi ? 0 : 0.9 };
        }
        m.update(w, biodra2d(t), DT);
    }
    return m;
}

const rece = (t) => ({ 15: [0, 0.3 * Math.sin(om * t)], 16: [0, 0.3 * Math.sin(om * t)],
                       13: [0, 0.12 * Math.sin(om * t)], 14: [0, 0.12 * Math.sin(om * t)] });
const caleCialo = (t) => ({ ...rece(t),
    27: [0.15 * Math.sin(om * t), 0], 28: [0.15 * Math.sin(om * t + 1), 0],
    25: [0.08 * Math.sin(om * t), 0], 26: [0.08 * Math.sin(om * t + 1), 0],
    11: [0.06 * Math.sin(om * t), 0.03 * Math.sin(2 * om * t)], 12: [0.06 * Math.sin(om * t), -0.03 * Math.sin(2 * om * t)],
    0: [0.10 * Math.sin(om * t + 0.5), 0] });
const kolysanieBioder = (t) => ({ x: 0.5 * Math.sin(om * t), y: 0 });

const r = przebieg(rece);
const c = przebieg(caleCialo, kolysanieBioder);
const s = przebieg(() => ({}));
const fmt = (m) => PARTIE.map(p => `${p} ${m.aktywnosci[p].toFixed(2)}`).join('  ');
console.log('  same ręce:   ' + fmt(r) + `  => ${r.zaangazowanie?.toFixed(2)}`);
console.log('  całe ciało:  ' + fmt(c) + `  => ${c.zaangazowanie?.toFixed(2)}`);

spr(`same ręce dają ~0.5 (${r.zaangazowanie?.toFixed(2)})`, r.zaangazowanie > 0.35 && r.zaangazowanie < 0.65);
spr(`całe ciało z biodrami wyraźnie więcej (${c.zaangazowanie?.toFixed(2)})`, c.zaangazowanie > 0.85);
spr('kołysanie bioder w 2D zapala partię "biodra"', c.aktywnosci.biodra > 0.5 && r.aktywnosci.biodra < 0.1);
spr('bezruch (sam szum) = null, nic nie tańczy', s.zaangazowanie === null);
{
    const bezNog = przebieg(caleCialo, kolysanieBioder, { widoczneNogi: false });
    spr('stopy poza kadrem: nogi 0, reszta dalej działa',
        bezNog.aktywnosci.nogaL === 0 && bezNog.aktywnosci.nogaP === 0 && bezNog.zaangazowanie > 0.6);
}

console.log('\nCiało 2D - niezależne od odległości od kamery:');
function biodraZ2D(skala) {
    const c2 = new Cialo2D();
    const W = 1920, H = 1080;
    let maxV = 0, poprz = null;
    for (let i = 0; i < 4 * FPS; i++) {
        const t = i * DT;
        const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
        const px = (x, y) => ({ x: (960 + x * skala) / W, y: (540 + y * skala) / H, z: 0, visibility: 0.9 });
        const sway = 60 * Math.sin(om * t);  // px przy skali 1
        lm[11] = px(-100 + sway, -250); lm[12] = px(100 + sway, -250);
        lm[23] = px(-60 + sway, 0);     lm[24] = px(60 + sway, 0);
        lm[15] = px(-150 + sway, -50);  lm[16] = px(150 + sway, -50);
        const o = c2.update(lm, W, H, DT);
        if (poprz && o.biodra) maxV = Math.max(maxV, Math.abs(o.biodra.x - poprz.x) / DT);
        poprz = o.biodra;
    }
    return maxV;
}
const v1 = biodraZ2D(1), v05 = biodraZ2D(0.5);
spr(`prędkość bioder w szerokościach barków: skala 1 -> ${v1.toFixed(3)}, skala 0.5 -> ${v05.toFixed(3)} (różnica < 5%)`,
    Math.abs(v1 - v05) / v1 < 0.05);
{
    const c2 = new Cialo2D();
    const o = c2.update(null, 1920, 1080, DT);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: 0, visibility: 0.9 }));
    const o2 = c2.update(zle, 1920, 1080, DT);
    const o3 = c2.update(zle, 0, 0, DT);
    spr('Cialo2D: null / NaN / zerowe wymiary -> puste wyniki', o.biodra === null && o2.biodra === null && o3.biodra === null);
}
{
    const m = przebieg(rece);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
    for (let i = 0; i < 30; i++) m.update(zle, { x: NaN, y: NaN }, DT);
    m.update(null, null, 0);
    spr('NaN nie zatruwa aktywności', PARTIE.every(p => Number.isFinite(m.aktywnosci[p])));
}

process.exit(ok ? 0 : 1);
