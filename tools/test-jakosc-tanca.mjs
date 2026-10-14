/**
 * Jakość tańca - składanie składowych w mnożnik tempa ładowania.
 *
 *   node tools/test-jakosc-tanca.mjs
 *
 * Kotwice: góra-dół -> 0.67 (~12 s do pełnego paska), piękny taniec -> 1.33 (~6 s),
 * brak danych -> 1.0 (dzisiejsze tempo). Decyzja właściciela 2026-10-14: "pośrodku".
 */
import { JakoscTanca, NASTAWY_JAKOSCI as N, BOGACTWO_NEUTRALNE, mnoznikZBogactwa, zlozBogactwo } from '../js/jakoscTanca.js';

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

console.log('KOTWICE:');
spr('kotwica niska -> 0.67', Math.abs(mnoznikZBogactwa(N.KOTWICA_NISKA) - 0.67) < 1e-9);
spr('kotwica wysoka -> 1.33', Math.abs(mnoznikZBogactwa(N.KOTWICA_WYSOKA) - 1.33) < 1e-9);
spr('neutralne -> 1.0', Math.abs(mnoznikZBogactwa(BOGACTWO_NEUTRALNE) - 1) < 1e-9);
spr('przycięcie: 0 -> 0.67, 1 -> 1.33', mnoznikZBogactwa(0) === 0.67 && mnoznikZBogactwa(1) === 1.33);
spr('NaN -> 1 (dzisiejsze tempo)', mnoznikZBogactwa(NaN) === 1);

console.log('\nSKŁADANIE:');
spr('wszystko null -> null', zlozBogactwo({ krazenie: null, zaangazowanie: null, fala: null }) === null);
const w = N.WAGI;
spr('pełny zestaw = średnia ważona',
    Math.abs(zlozBogactwo({ krazenie: 1, zaangazowanie: 0.5, fala: 0 }) - (w.krazenie + 0.5 * w.zaangazowanie)) < 1e-9);
spr('brak fali -> wagi renormalizowane po reszcie',
    Math.abs(zlozBogactwo({ krazenie: 0, zaangazowanie: 1, fala: null }) - w.zaangazowanie / (w.krazenie + w.zaangazowanie)) < 1e-9);
spr('NaN w składowej traktowany jak brak', zlozBogactwo({ krazenie: NaN, zaangazowanie: 1, fala: null }) === 1);

console.log('\nCAŁOŚĆ NA SYNTETYKACH:');
const SIGMA = 0.009, FPS = 60, DT = 1 / FPS, om = 2 * Math.PI * 0.8;
const BAZA = { 0: [0, -0.62], 11: [0.18, -0.45], 12: [-0.18, -0.45], 13: [0.25, -0.2], 14: [-0.25, -0.2],
               15: [0.27, 0.02], 16: [-0.27, 0.02], 23: [0.1, 0], 24: [-0.1, 0],
               25: [0.11, 0.42], 26: [-0.11, 0.42], 27: [0.11, 0.82], 28: [-0.11, 0.82] };

/** cialo(t) -> {world: {i: [x,y]}, przesuniecie: m (kołysanie bioder w kadrze)} */
function klatka(cialo, t) {
    const { pozycje, przesuniecie = 0 } = cialo(t);
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
    for (const [k, [x0, y0]] of Object.entries(BAZA)) {
        const [x, y] = pozycje[k] ?? [x0, y0];
        world[k] = { x: x + gauss() * SIGMA, y: y + gauss() * SIGMA, z: 0, visibility: 0.9 };
        // 2D izotropowe w px: 672 px na metr przy 1920x1080
        lm[k] = { x: (960 + (x + przesuniecie) * 672) / 1920, y: (540 + y * 672) / 1080, z: 0, visibility: 0.9 };
    }
    return { hands: [], pose: { worldLandmarks: world, landmarks: lm }, width: 1920, height: 1080, dt: DT, now: t * 1000 };
}
function przebieg(cialo, sekund = 10) {
    const j = new JakoscTanca();
    for (let i = 0; i < sekund * FPS; i++) j.update(klatka(cialo, i * DT), DT);
    return j;
}

// Exploit: proste ręce szerokim łukiem wokół barków, reszta ciała stoi.
const goraDol = (t) => {
    const th = Math.PI / 2 + 1.4 * Math.sin(om * t);
    const p = {};
    for (const [bark, lok, nad, s] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
        const [bx, by] = BAZA[bark];
        p[lok] = [bx + s * 0.3 * Math.sin(th), by + 0.3 * Math.cos(th)];
        p[nad] = [bx + s * 0.6 * Math.sin(th), by + 0.6 * Math.cos(th)];
    }
    return { pozycje: p };
};
// Bogaty taniec: ręce w kręgach, kroki, kołysanie bioder w kadrze, ruch barków i głowy.
const bogaty = (t) => {
    const p = {};
    for (const [bark, lok, nad, s] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
        const [bx, by] = BAZA[bark];
        p[lok] = [bx + s * 0.1 + 0.12 * Math.cos(om * t), by + 0.25 + 0.12 * Math.sin(om * t)];
        p[nad] = [bx + s * 0.2 + 0.25 * Math.cos(om * t - 0.6), by + 0.25 + 0.25 * Math.sin(om * t - 0.6)];
    }
    p[27] = [BAZA[27][0] + 0.15 * Math.sin(om * t), BAZA[27][1]];
    p[28] = [BAZA[28][0] + 0.15 * Math.sin(om * t + 1), BAZA[28][1]];
    p[11] = [BAZA[11][0] + 0.06 * Math.sin(om * t), BAZA[11][1]];
    p[12] = [BAZA[12][0] + 0.06 * Math.sin(om * t), BAZA[12][1]];
    p[0] = [BAZA[0][0] + 0.10 * Math.sin(om * t + 0.5), BAZA[0][1]];
    return { pozycje: p, przesuniecie: 0.15 * Math.sin(om * t) };
};
const gd = przebieg(goraDol), bg = przebieg(bogaty);
const opis = (j) => `bogactwo ${j.bogactwo.toFixed(2)} mnożnik ${j.mnoznik.toFixed(2)}  ` +
    Object.entries(j.skladowe).map(([k, v]) => `${k} ${v === null ? 'null' : v.toFixed(2)}`).join(' ');
console.log(`  góra-dół: ${opis(gd)}`);
console.log(`  bogaty:   ${opis(bg)}`);
spr('góra-dół ładuje wolniej niż dziś (mnożnik < 0.85)', gd.mnoznik < 0.85);
spr('bogaty taniec ładuje szybciej niż dziś (mnożnik > 1.1)', bg.mnoznik > 1.1);

console.log('\nNEUTRALNOŚĆ I ODPORNOŚĆ:');
{
    const j = new JakoscTanca();
    spr('świeża instancja: mnożnik 1, bogactwo neutralne', j.mnoznik === 1 && j.bogactwo === BOGACTWO_NEUTRALNE);
    for (let i = 0; i < 10 * FPS; i++) j.update(klatka(goraDol, i * DT), DT);
    for (let i = 0; i < 10 * FPS; i++) j.update({ hands: [], pose: null, width: 1920, height: 1080, dt: DT }, DT);
    spr(`po wyjściu z kadru mnożnik wraca do ~1 (${j.mnoznik.toFixed(2)})`, Math.abs(j.mnoznik - 1) < 0.05);
    for (let i = 0; i < 10 * FPS; i++) j.update(klatka(goraDol, i * DT), DT);
    const stoi = (t) => ({ pozycje: {} });
    for (let i = 0; i < 12 * FPS; i++) j.update(klatka(stoi, i * DT), DT);
    spr(`po staniu w miejscu mnożnik wraca do ~1 (${j.mnoznik.toFixed(2)})`, Math.abs(j.mnoznik - 1) < 0.05);
    j.update(null, DT); j.update(klatka(goraDol, 0), 2.0); j.update(klatka(goraDol, 0), NaN); j.update(klatka(goraDol, 0), 0);
    const zla = klatka(goraDol, 0);
    for (const p of zla.pose.worldLandmarks) p.x = NaN;
    for (let i = 0; i < 30; i++) j.update(zla, DT);
    spr('null / dt=2 s / NaN nie psują mnożnika', Number.isFinite(j.mnoznik) && j.mnoznik >= 0.67 && j.mnoznik <= 1.33);
}

process.exit(ok ? 0 : 1);
