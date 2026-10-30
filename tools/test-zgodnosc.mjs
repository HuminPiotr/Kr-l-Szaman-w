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

/** ruch(t) -> przesunięcie w szerokościach barków (ręce i głowa w obrazie); czasS = t. */
function przebieg(ruch, { sekund = 16, rytm = true } = {}) {
    const z = new ZgodnoscRytmu();
    const BW = 0.12;   // szerokość barków w obrazie (ułamek kadru)
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const d = ruch(t) * BW;
        const l = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
        const p = (x, y) => ({ x: x + gauss() * SIGMA * 0.1, y: y + gauss() * SIGMA * 0.1, z: 0, visibility: 0.9 });
        l[11] = p(0.44, 0.35); l[12] = p(0.56, 0.35);
        l[15] = p(0.40, 0.30 + d); l[16] = p(0.60, 0.30 + d);
        l[23] = p(0.46, 0.60 + 0.2 * d); l[24] = p(0.54, 0.60 + 0.2 * d);
        l[0] = p(0.50, 0.25 + 0.3 * d);
        z.update({ landmarks: l }, DT, rytm ? { siatka, czasS: t } : null);
    }
    return z;
}

const kolys = (okres, przes = 0) => (t) => 0.4 * Math.sin(2 * Math.PI * (t - 0.3 - przes) / okres);
// "Losowy" taniec: suma sinusów o niewspółmiernych okresach - ruch jest, rytmu nie ma.
const chaos = (t) => 0.2 * Math.sin(2 * Math.PI * t / 0.71) + 0.16 * Math.sin(2 * Math.PI * t / 1.13 + 1) + 0.12 * Math.sin(2 * Math.PI * t / 0.37 + 2);

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
    spr(`${opis}: zgodność ${z.zgodnosc?.toFixed(2)} (koherencja ${z.koherencja.toFixed(2)}, ${z.siatkaWygrana ?? '—'})`, warunek(z.zgodnosc));
}
console.log('\nBEZ PIEŚNI I ODPORNOŚĆ:');
spr('bez rytmu -> null', przebieg(kolys(T), { rytm: false }).zgodnosc === null);
{
    const z = przebieg(kolys(T));
    z.update(null, DT, { siatka, czasS: 16 });
    z.update({ landmarks: Array(33).fill({ x: NaN, y: NaN, visibility: 1 }) }, DT, { siatka, czasS: 16.03 });
    z.update({ landmarks: Array(33).fill({ x: 0.5, y: 0.5, visibility: 1 }) }, NaN, { siatka, czasS: 16.06 });
    spr('NaN / brak pozy / złe dt nie zatruwają', Number.isFinite(z.zgodnosc) && Object.values(z._akum).every(a => Number.isFinite(a.re + a.im + a.e + a.w)));
    z.update(null, DT, { siatka, czasS: NaN });
    spr('czas pieśni NaN -> brak rytmu (null)', z.zgodnosc === null);
    z.update(null, DT, null);
    spr('koniec pieśni -> null i czyste akumulatory', z.zgodnosc === null && Object.keys(z._akum).length === 0);
}
process.exit(ok ? 0 : 1);
