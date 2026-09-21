/**
 * Iskry (Grom w Ziemię) - układ cząstek, TYLKO fizyka.
 *
 *   node tools/test-iskry.mjs
 *
 * Nie wywołuje updateAndDraw()/_rysuj() - tworzą sprite przez
 * document.createElement, którego nie ma w Node (ten sam powód co
 * tools/test-fala.mjs). Fizykę testujemy przez _ruszaj(dt) bezpośrednio.
 */
import { Iskry, barwaEnergii, pekniecieZiemi, NASTAWY } from '../js/iskry.js';

const DT = 1 / 60;

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Wystrzał emituje cząstki ---
console.log('WYSTRZAŁ:');
const i1 = new Iskry();
spr('świeże iskry są puste', i1.liczba === 0);
i1.wystrzel({ x: 500, y: 500 }, 1);
spr(`wystrzał emituje cząstki (${i1.liczba})`, i1.liczba > 50);

// --- 2. Siła skaluje liczbę cząstek, nie wyłącza ---
console.log('\nSIŁA:');
const i2pelna = new Iskry(); i2pelna.wystrzel({ x: 0, y: 0 }, 1);
const i2slaba = new Iskry(); i2slaba.wystrzel({ x: 0, y: 0 }, 0.3);
spr(`słabsza siła daje mniej cząstek niż pełna (${i2slaba.liczba} < ${i2pelna.liczba})`,
    i2slaba.liczba < i2pelna.liczba);
spr(`  ...ale nie zero (${i2slaba.liczba})`, i2slaba.liczba > 0);

// --- 3. Odporność: zły zaczep/siła nie emituje i nie wywraca modułu ---
console.log('\nODPORNOŚĆ:');
const i3 = new Iskry();
i3.wystrzel({ x: NaN, y: 0 }, 1);
spr('NaN w zaczepie -> brak emisji, bez wyjątku', i3.liczba === 0);
i3.wystrzel(null, 1);
spr('brak zaczepu -> brak emisji, bez wyjątku', i3.liczba === 0);
i3.wystrzel({ x: 0, y: 0 }, 0);
spr('siła zero -> brak emisji, bez wyjątku', i3.liczba === 0);
i3.wystrzel({ x: 0, y: 0 }, -1);
spr('siła ujemna -> brak emisji, bez wyjątku', i3.liczba === 0);
i3._ruszaj(NaN);
spr('NaN dt w _ruszaj -> bez wyjątku, bez zmian', true);

// --- 4. Wszystkie cząstki wygasają w skończonym czasie ---
console.log('\nWYGASANIE:');
const i4 = new Iskry();
i4.wystrzel({ x: 0, y: 0 }, 1);
let klatek = 0;
while (i4.liczba > 0 && klatek < 300) { i4._ruszaj(DT); klatek++; }
spr(`wszystkie cząstki wygasają (po ${(klatek * DT).toFixed(2)} s, < 2.5 s = ZYCIE_MAX + margines)`,
    i4.liczba === 0 && klatek * DT < 2.5);

// --- 5. WIR GAŚNIE SZYBCIEJ NIŻ ROZPROSZENIE ---
// Kluczowa asercja fizyki: DWA różne tłumienia (OPOR_STYCZNY > OPOR_PROMIENIOWY)
// mają dawać mierzalny efekt - składowa styczna (wir) traci PROPORCJONALNIE
// więcej prędkości niż promieniowa (wybuch na zewnątrz) w tym samym czasie.
// Bez tego testu ktoś mógłby przypadkiem wyrównać obie stałe opóźnienia
// i "wygląda na wirujące" zostałoby niezweryfikowanym twierdzeniem.
console.log('\nFIZYKA WIRU:');
const i5 = new Iskry();
i5.wystrzel({ x: 0, y: 0 }, 1);
const srSzybkoscStyczna = (cz) => cz.reduce((s, c) => s + Math.hypot(c.vtx, c.vty), 0) / cz.length;
const srSzybkoscPromien = (cz) => cz.reduce((s, c) => s + Math.hypot(c.vrx, c.vry), 0) / cz.length;
const t0 = srSzybkoscStyczna(i5.czastki), r0 = srSzybkoscPromien(i5.czastki);
for (let n = 0; n < 30; n++) i5._ruszaj(DT);   // 0.5 s
const t1 = srSzybkoscStyczna(i5.czastki), r1 = srSzybkoscPromien(i5.czastki);
spr(`po 0.5 s składowa styczna traci WIĘKSZY ułamek prędkości niż promieniowa (${(t1/t0).toFixed(2)} < ${(r1/r0).toFixed(2)})`,
    (t1 / t0) < (r1 / r0));

// --- 6. Jeden kierunek wiru na cały wystrzał ---
console.log('\nSPÓJNOŚĆ WIRU:');
// Znak iloczynu wektorowego (promień x styczna).z musi być IDENTYCZNY dla
// wszystkich cząstek jednego wystrzału - inaczej wiry znoszą się wizualnie.
// Cząstki startują DOKŁADNIE w zaczepie (x=y=0), więc jeden krok symulacji
// najpierw - inaczej wektor promienia (x,y) jest zerowy i znak nieokreślony.
const i6 = new Iskry();
i6.wystrzel({ x: 0, y: 0 }, 1);
i6._ruszaj(DT);
const znakiObrotu = i6.czastki.map(c => {
    // promień = (x,y) chwilowe od zaczepu; iloczyn wektorowy 2D
    // promX*stycY - promY*stycX daje spójny znak zawirowania.
    return Math.sign(c.x * c.vty - c.y * c.vtx) || 0;
}).filter(z => z !== 0);
const wszystkieTakieSame = znakiObrotu.every(z => z === znakiObrotu[0]);
spr(`wszystkie cząstki wirują w TYM SAMYM kierunku (${znakiObrotu.length} sprawdzonych)`, wszystkieTakieSame);

// --- 7. barwaEnergii() - tęczowa paleta ---
console.log('\nBARWA ENERGII:');
const b0 = barwaEnergii(0);
spr(`t=0 daje niebiesko-cyjanowy start [${b0.join(',')}]`,
    Array.isArray(b0) && b0.length === 3 && b0[0] === 0 && b0[1] === 100 && b0[2] === 255);
const b1 = barwaEnergii(1);
// Tolerancja ±1 na kanale G: (1-0.8) w IEEE-754 to 0.19999999999999998,
// więc Math.floor(k*200) daje 199, nie 200 - artefakt zmiennoprzecinkowy
// odziedziczony wprost z formuły portowanej z powerBall.js, nie błąd portu.
spr(`t=1 daje żółto-ognisty koniec [${b1.join(',')}]`,
    b1[0] === 255 && Math.abs(b1[1] - 200) <= 1 && b1[2] === 0);
spr('poza zakresem (t=-1) nie wywraca funkcji, klamruje do 0', Array.isArray(barwaEnergii(-1)));
spr('poza zakresem (t=2) nie wywraca funkcji, klamruje do 1', Array.isArray(barwaEnergii(2)));
spr('NaN nie wywraca funkcji', Array.isArray(barwaEnergii(NaN)));

// --- 8. pekniecieZiemi() - zaczep ---
console.log('\nPĘKNIĘCIE ZIEMI (zaczep):');
const W = 1920, H = 1080;
const bezDloni = pekniecieZiemi({ hands: [] }, W, H);
spr(`bez dłoni: fallback na środek dołu kadru (${bezDloni.x.toFixed(0)}, ${bezDloni.y.toFixed(0)})`,
    bezDloni.x === W * 0.5 && bezDloni.y === H * 0.86);

const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
lm[9] = { x: 0.3, y: 0.5 };
const zDlonia = pekniecieZiemi({ hands: [{ landmarks: lm }] }, W, H);
spr(`z dłonią: X skalowane przez W z landmarka[9] (${zDlonia.x.toFixed(0)})`,
    Math.abs(zDlonia.x - 0.3 * W) < 1e-6);
spr(`Y zawsze niska, stała, niezależna od dłoni (${zDlonia.y.toFixed(0)})`,
    zDlonia.y === H * 0.86);

// --- 9. NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnyNaWystrzal = NASTAWY.NA_WYSTRZAL;
    NASTAWY.NA_WYSTRZAL = 10;
    const i9 = new Iskry();
    i9.wystrzel({ x: 100, y: 100 }, 1);
    spr(`zmiana NASTAWY.NA_WYSTRZAL jest widoczna w wystrzel() (${i9.liczba})`, i9.liczba === 10);
    NASTAWY.NA_WYSTRZAL = domyslnyNaWystrzal;

    const domyslnyMax = NASTAWY.MAX_CZASTECZEK;
    NASTAWY.MAX_CZASTECZEK = 5;
    const i10 = new Iskry();
    i10.wystrzel({ x: 0, y: 0 }, 1);
    spr(`sufit MAX_CZASTECZEK respektowany po zmianie (${i10.liczba})`, i10.liczba === 5);
    spr(`nadmiar zliczony w odrzucone (${i10.odrzucone})`, i10.odrzucone > 0);
    NASTAWY.MAX_CZASTECZEK = domyslnyMax;
}

process.exit(ok ? 0 : 1);
