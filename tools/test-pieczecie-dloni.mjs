/**
 * Rozdzielność trzech pieczęci składanych dłońmi.
 *
 *   node tools/test-pieczecie-dloni.mjs
 *
 * Zestaw jest rozdzielany LICZBĄ WYPROSTOWANYCH PALCÓW - Weles 0, Perun 4,
 * Swaróg 10 - więc żadna para nie powinna dać się pomylić nawet przy progach
 * rozstrojonych o połowę. Ten test tego pilnuje.
 *
 * Pilnuje też warunku, który wziął się z POMIARU na żywej dłoni: MediaPipe
 * gubi jedną dłoń przy maksymalnym ścisku, więc żadna pieczęć nie może
 * nagradzać dłoni złożonych płasko przy sobie.
 */
import { welesDlon } from '../js/znaki/welesDlon.js';
import { perunDlon } from '../js/znaki/perunDlon.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { dlon } from './_dlon-syntetyczna.mjs';

const W = 1920, H = 1080;
const PIECZECIE = { weles: welesDlon, perun: perunDlon, swarog: swarogDlon };

const klatka = (...rece) => ({
    hands: rece.map(lm => ({ landmarks: lm, worldLandmarks: null, handedness: null })),
    pose: null, width: W, height: H, dt: 1 / 60, now: 0
});
const oceny = (f) => Object.fromEntries(
    Object.entries(PIECZECIE).map(([k, p]) => [k, p.score(f)]));

// --- układy dłoni ---
const S = 0.09;                       // skala dłoni w jednostkach znormalizowanych
const PROSTE = [0, 0, 0, 0, 0];
const PIESC   = [1, 1, 1, 1, 1];
const TYGRYS  = [1, 0, 0, 1, 1];      // wskazujący + środkowy proste

const UKLADY = {
    // Weles: dwie pięści wyraźnie osobno
    'Weles (dwie pięści)': klatka(
        dlon({ ox: 0.36, zgiecia: PIESC, skala: S }),
        dlon({ ox: 0.64, zgiecia: PIESC, skala: S })),

    // Perun: po dwa palce w górę, dłonie obok siebie z prześwitem
    'Perun (Tygrys)': klatka(
        dlon({ ox: 0.455, zgiecia: TYGRYS, skala: S }),
        dlon({ ox: 0.545, zgiecia: TYGRYS, skala: S })),

    // Swaróg: palce proste, opuszki razem, nadgarstki rozsunięte.
    // Namiot: dłoń przechylona ku środkowi plus jej ODBICIE LUSTRZANE.
    // wachlarz ~0, bo w namiocie dłonie widać niemal z profilu - palce
    // zachodzą na siebie, a ich rozłożenie schodzi w głębię obrazu.
    'Swaróg (Koń)': klatka(
        dlon({ ox: 0.42, oy: 0.62, zgiecia: PROSTE, skala: S, obrot: 0.42, wachlarz: 0.15 }),
        dlon({ ox: 0.42, oy: 0.62, zgiecia: PROSTE, skala: S, obrot: 0.42, wachlarz: 0.15, lustro: true })),

    // --- układy, które NIE MOGĄ zapalać niczego ---
    'dłonie płasko przy sobie (ścisk)': klatka(
        dlon({ ox: 0.487, zgiecia: PROSTE, skala: S }),
        dlon({ ox: 0.513, zgiecia: PROSTE, skala: S })),
    'jedna płaska dłoń': klatka(dlon({ zgiecia: PROSTE, skala: S })),
    'jedna pięść': klatka(dlon({ zgiecia: PIESC, skala: S })),
    'brak dłoni': klatka(),
};

const NAZWY = Object.keys(PIECZECIE);
console.log('układ'.padEnd(34) + NAZWY.map(n => n.padStart(9)).join(''));
console.log('-'.repeat(34 + 9 * NAZWY.length));
const wyniki = {};
for (const [nazwa, f] of Object.entries(UKLADY)) {
    const o = oceny(f);
    wyniki[nazwa] = o;
    console.log(nazwa.padEnd(34) + NAZWY.map(n => o[n].toFixed(2).padStart(9)).join(''));
}

console.log();
let ok = true;
const spr = (opis, w) => { console.log(`  ${w ? '✓' : '✗'} ${opis}`); if (!w) ok = false; };

// Każda pieczęć zapala SIEBIE i nie zapala pozostałych.
const PARY = [
    ['Weles (dwie pięści)', 'weles'],
    ['Perun (Tygrys)', 'perun'],
    ['Swaróg (Koń)', 'swarog'],
];
for (const [uklad, wlasna] of PARY) {
    const o = wyniki[uklad];
    spr(`${uklad} zapala ${wlasna} (${o[wlasna].toFixed(2)})`, o[wlasna] > 0.6);
    for (const inna of NAZWY) {
        if (inna === wlasna) continue;
        spr(`  ...i NIE zapala ${inna} (${o[inna].toFixed(2)})`, o[inna] < 0.25);
    }
}

// Wymóg z pomiaru: ścisk dłoni nie może być nagradzany.
const scisk = wyniki['dłonie płasko przy sobie (ścisk)'];
spr(`ścisk dłoni nie zapala Swaroga (${scisk.swarog.toFixed(2)}) - to byłby przyszły Wąż`,
    scisk.swarog < 0.25);

// Jedna dłoń nie wystarcza na żadną pieczęć - wszystkie trzy są dwuręczne.
for (const uklad of ['jedna płaska dłoń', 'jedna pięść', 'brak dłoni']) {
    const o = wyniki[uklad];
    spr(`${uklad}: wszystkie pieczęcie zerowe`, NAZWY.every(n => o[n] === 0));
}

// Reguła nadrzędna: wynik musi być ciągłą rampą, nie progiem.
console.log('\nCIĄGŁOŚĆ - powolne zwijanie palców w pięść (Weles):');
let poprz = null, maxSkok = 0;
const poziomy = [];
for (let z = 0; z <= 1.001; z += 0.05) {
    const f = klatka(dlon({ ox: 0.36, zgiecia: [z,z,z,z,z], skala: S }),
                     dlon({ ox: 0.64, zgiecia: [z,z,z,z,z], skala: S }));
    const v = welesDlon.score(f);
    if (poprz !== null) maxSkok = Math.max(maxSkok, Math.abs(v - poprz));
    poprz = v;
    if (Math.abs(z % 0.25) < 0.03) poziomy.push(`${z.toFixed(2)}:${v.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok między krokami ${maxSkok.toFixed(3)} - rampa, nie próg`, maxSkok < 0.2);

// Odporność na zepsute dane
const nan = Array.from({ length: 21 }, () => ({ x: NaN, y: NaN, z: 0 }));
const oNan = oceny(klatka(nan, nan));
spr('klatki z NaN dają zero, nie wyjątek', NAZWY.every(n => oNan[n] === 0));

process.exit(ok ? 0 : 1);
