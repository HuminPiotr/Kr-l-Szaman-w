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
import { szczurDlon } from '../js/znaki/szczurDlon.js';
import { dlon } from './_dlon-syntetyczna.mjs';

const W = 1920, H = 1080;
const PIECZECIE = { weles: welesDlon, perun: perunDlon, swarog: swarogDlon, szczur: szczurDlon };

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

    // Szczur: dolna dłoń pięść, górna z dwoma palcami (Tygrys), WYRAŹNIE
    // wyżej i w tej samej kolumnie (ox równe). Asymetryczna - w przeciwieństwie
    // do reszty trójki obie dłonie robią coś INNEGO.
    'Szczur (pięść pod, dwa palce nad)': klatka(
        dlon({ ox: 0.5, oy: 0.70, zgiecia: PIESC, skala: S }),
        dlon({ ox: 0.5, oy: 0.50, zgiecia: TYGRYS, skala: S })),

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

    // AUTENTYCZNY Tygrys: wskazujący i środkowy ZŁĄCZONE (mały wachlarz),
    // a serdeczny i mały zwinięte tylko CZĘŚCIOWO - tak MediaPipe je zgaduje,
    // gdy dłonie są splecione i palce się zasłaniają. Gracz zgłosił, że ten
    // układ nie przechodził i musiał rozszczepiać palce w V.
    'Perun autentyczny (palce razem, tylne luźne)': klatka(
        dlon({ ox: 0.455, zgiecia: [0.6, 0, 0, 0.5, 0.5], skala: S, wachlarz: 0.25 }),
        dlon({ ox: 0.545, zgiecia: [0.6, 0, 0, 0.5, 0.5], skala: S, wachlarz: 0.25 })),

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
    ['Szczur (pięść pod, dwa palce nad)', 'szczur'],
    ['Perun (Tygrys)', 'perun'],
    ['Swaróg (Koń)', 'swarog'],
];
for (const [uklad, wlasna] of PARY) {
    const o = wyniki[uklad];
    spr(`${uklad} zapala ${wlasna} (${o[wlasna].toFixed(2)})`, o[wlasna] > 0.6);
    for (const inna of NAZWY) {
        if (inna === wlasna) continue;
        // Szczur -> Weles jest WYJĄTKIEM od reguły "poniżej 0.25": górna
        // dłoń Szczura ma DOKŁADNIE dwa z czterech palców (bez kciuka)
        // zwiniętych (Tygrys), więc zwinieta() - miara Welesa "czy to
        // pięść" - czyta ją jako w POŁOWIE zwiniętą (~0.37), nie zero.
        // Bezpieczne mimo to: PROG_POSTAWY w pieczecie.js wynosi 0.5,
        // a zmierzony szczyt tego przecieku to 0.373 - Weles nigdy się
        // faktycznie nie złoży przy tym układzie, tylko nie schodzi
        // do zera na wykresie diagnostycznym.
        const margines = (inna === 'weles' && wlasna === 'szczur') ? 0.4 : 0.25;
        spr(`  ...i NIE zapala ${inna} (${o[inna].toFixed(2)})`, o[inna] < margines);
    }
}

// Zgłoszone z testu na żywych dłoniach: autentyczny Tygrys musi przechodzić
// BEZ rozszczepiania palców w V. Zwinięcie tylnych palców jest tylko wsparciem
// rozpoznania - rdzeniem jest liczba palców, a ta odcina Peruna od resztek
// trójki (4 kontra 0 i 10) nawet przy luźnym warunku.
const aut = wyniki['Perun autentyczny (palce razem, tylne luźne)'];
spr(`autentyczny Tygrys (palce razem) zapala Peruna (${aut.perun.toFixed(2)})`, aut.perun > 0.6);
spr(`  ...i nadal nie zapala nic innego (${aut.weles.toFixed(2)}, ${aut.swarog.toFixed(2)})`,
    aut.weles < 0.25 && aut.swarog < 0.25);

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

// CIĄGŁOŚĆ SZCZURA przy ROSNĄCYM PRZESUNIĘCIU PIONOWYM: dolna dłoń pięść,
// górna Tygrys, ox stałe (wyrównane w pionie) - podnosimy górną dłoń od
// "na tej samej wysokości" do "wyraźnie nad". Wynik ma rosnąć płynnie
// (rampa), nie skokiem, i Weles (obie pięści - tu górna NIGDY nie jest
// pięścią) nie może się w żadnym momencie odezwać.
console.log('\nSZCZUR: NARASTAJĄCE PRZESUNIĘCIE PIONOWE (dolna pięść, górna Tygrys):');
let maxSkokSzczur = 0, poprzSzczur = null, maxWeles = 0;
const wznoszenie = [];
for (let doy = 0; doy <= 2.2001; doy += 0.1) {
    const dolna = dlon({ ox: 0.5, oy: 0.60, zgiecia: PIESC, skala: S });
    const gorna = dlon({ ox: 0.5, oy: 0.60 - doy * S, zgiecia: TYGRYS, skala: S });
    const f = klatka(dolna, gorna);
    const sz = szczurDlon.score(f), we = welesDlon.score(f);
    if (poprzSzczur !== null) maxSkokSzczur = Math.max(maxSkokSzczur, Math.abs(sz - poprzSzczur));
    poprzSzczur = sz;
    maxWeles = Math.max(maxWeles, we);
    if (Math.round(doy * 10) % 4 === 0) wznoszenie.push(`${doy.toFixed(1)}sk: sz ${sz.toFixed(2)}`);
}
console.log('  ' + wznoszenie.join('  |  '));
spr(`największy skok przy podnoszeniu górnej dłoni ${maxSkokSzczur.toFixed(3)} - rampa, nie próg`,
    maxSkokSzczur < 0.2);
// Weles NIE ZNIKA do zera (Tygrys ma dwa z czterech palców zwiniętych, więc
// zwinieta() czyta go jako w połowie pięść - patrz komentarz przy PARY
// wyżej), ale musi zostać BEZPIECZNIE pod progiem złożenia z pieczecie.js
// (PROG_POSTAWY = 0.5) w CAŁYM zamiataniu, żeby Weles nigdy się faktycznie
// nie złożył przy tym układzie.
const PROG_POSTAWY_GRY = 0.5;
spr(`Weles zostaje pod progiem złożenia (0.5) w całym zamiataniu (szczyt ${maxWeles.toFixed(3)})`,
    maxWeles < PROG_POSTAWY_GRY);

// ROZDZIELNOŚĆ OD ROLI: gdy obie dłonie są NA TEJ SAMEJ WYSOKOŚCI (pięść +
// Tygrys obok siebie, bez przesunięcia pionowego), Szczur MUSI milczeć -
// inaczej "dwa palce + pięść gdziekolwiek w kadrze" myliłoby się z niedbale
// złożonym Tygrysem obok przypadkowej pięści.
const bezPionu = klatka(
    dlon({ ox: 0.40, oy: 0.60, zgiecia: PIESC, skala: S }),
    dlon({ ox: 0.60, oy: 0.60, zgiecia: TYGRYS, skala: S }));
spr(`pięść i Tygrys OBOK SIEBIE (bez przesunięcia w pionie) NIE zapala Szczura (${szczurDlon.score(bezPionu).toFixed(2)})`,
    szczurDlon.score(bezPionu) < 0.25);

// Odporność na zepsute dane
const nan = Array.from({ length: 21 }, () => ({ x: NaN, y: NaN, z: 0 }));
const oNan = oceny(klatka(nan, nan));
spr('klatki z NaN dają zero, nie wyjątek', NAZWY.every(n => oNan[n] === 0));

process.exit(ok ? 0 : 1);
