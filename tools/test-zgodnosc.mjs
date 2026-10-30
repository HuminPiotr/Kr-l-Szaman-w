/**
 * Zgodność z rytmem pieśni - wyrozumiała, niewrażliwa na stałe spóźnienie.
 *
 *   node tools/test-zgodnosc.mjs
 */
import { ZgodnoscRytmu, spojnoscFaz } from '../js/rytm/zgodnosc.js';
import { SiatkaUderzen } from '../js/rytm/siatka.js';

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

const FPS = 30, DT = 1 / FPS, SIGMA = 0.009;
const siatka = SiatkaUderzen.z({ bpm: 128, pierwszeUderzenieS: 0.3, uderzenia: null });
const T = siatka.okresS;

/** ruch(t) -> przesunięcie [m] ramion i nóg; czasS = t. */
function przebieg(ruch, { sekund = 16, rytm = true } = {}) {
    const z = new ZgodnoscRytmu();
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const d = ruch(t);
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        for (const j of [15, 16, 13, 14]) w[j] = { x: 0.3 * (j % 2 ? 1 : -1) + gauss() * SIGMA, y: -0.2 + d + gauss() * SIGMA, z: 0, visibility: 0.9 };
        for (const j of [27, 28]) w[j] = { x: 0.1 * (j % 2 ? 1 : -1) + gauss() * SIGMA, y: 0.9 + 0.3 * d + gauss() * SIGMA, z: 0, visibility: 0.9 };
        z.update(w, DT, rytm ? { siatka, czasS: t } : null);
    }
    return z;
}

const kolys = (okres, przes = 0) => (t) => 0.25 * Math.sin(2 * Math.PI * (t - 0.3 - przes) / okres);
// "Losowy" taniec: suma sinusów o niewspółmiernych okresach - ruch jest, rytmu nie ma.
const chaos = (t) => 0.12 * Math.sin(2 * Math.PI * t / 0.71) + 0.1 * Math.sin(2 * Math.PI * t / 1.13 + 1) + 0.08 * Math.sin(2 * Math.PI * t / 0.37 + 2);

console.log('SPÓJNOŚĆ FAZ:');
spr('te same fazy -> 1', Math.abs(spojnoscFaz([0.2, 0.2, 0.2, 0.2]) - 1) < 1e-9);
spr('fazy równo po okręgu -> 0', spojnoscFaz([0, 0.25, 0.5, 0.75]) < 1e-9);
{
    let s = 0;
    for (let k = 0; k < 200; k++) s += spojnoscFaz(Array.from({ length: 6 }, losowa));
    spr(`6 losowych faz -> średnio ${(s / 200).toFixed(2)} (< 0.3, poprawka obciążenia)`, s / 200 < 0.3);
}

console.log('\nTANIEC:');
const wyniki = {
    'w rytmie (okres = uderzenie)': [przebieg(kolys(T)), (z) => z > 0.8],
    'stale spóźniony o 150 ms': [przebieg(kolys(T, 0.15)), (z) => z > 0.8],
    'co 2 uderzenia': [przebieg(kolys(2 * T)), (z) => z > 0.7],
    'poza rytmem (inne tempo, 0.83x)': [przebieg(kolys(T / 0.83)), (z) => z < 0.35],
    'chaos': [przebieg(chaos), (z) => z < 0.3],
    'bezruch': [przebieg(() => 0), (z) => z < 0.05]
};
for (const [opis, [z, warunek]] of Object.entries(wyniki)) {
    spr(`${opis}: zgodność ${z.zgodnosc?.toFixed(2)} (siatka ${z.siatkaWygrana})`, warunek(z.zgodnosc));
}
console.log('\nBEZ PIEŚNI I ODPORNOŚĆ:');
spr('bez rytmu -> null', przebieg(kolys(T), { rytm: false }).zgodnosc === null);
{
    const z = przebieg(kolys(T));
    z.update(null, DT, { siatka, czasS: 16 });
    z.update(Array(33).fill({ x: NaN, y: NaN, visibility: 1 }), DT, { siatka, czasS: 16.03 });
    z.update(null, NaN, { siatka, czasS: NaN });
    spr('NaN / brak pozy nie zatruwają', Number.isFinite(z.zgodnosc) || z.zgodnosc === null);
    z.update(null, DT, null);
    spr('koniec pieśni -> null i czyste akcenty', z.zgodnosc === null && z._akcenty.length === 0);
}
process.exit(ok ? 0 : 1);
