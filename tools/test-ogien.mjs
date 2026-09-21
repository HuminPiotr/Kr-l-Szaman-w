/**
 * Ogień (Płonący Palec i in.) - układ cząsteczek, TYLKO fizyka.
 *
 *   node tools/test-ogien.mjs
 *
 * Nie wywołuje updateAndDraw()/_rysuj() - tworzą sprite przez
 * document.createElement, którego nie ma w Node (ten sam powód co
 * tools/test-iskry.mjs). Emisję i fizykę testujemy przez _emituj()/_ruszaj()
 * bezpośrednio.
 */
import { Ogien, NASTAWY } from '../js/ogien.js';

const DT = 1 / 60;

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Emisja ---
console.log('EMISJA:');
const o1 = new Ogien();
spr('świeży ogień jest pusty', o1.liczba === 0);
o1._emituj({ x: 100, y: 100 }, { x: 100, y: 100 }, 0, 0, 1, DT);
spr(`emisja przy pełnej sile dodaje cząstki (${o1.liczba})`, o1.liczba > 0);

const o2 = new Ogien();
o2._emituj({ x: 100, y: 100 }, { x: 100, y: 100 }, 0, 0, 0, DT);
spr('emisja przy sile 0 nie dodaje cząstek płomienia (tylko ewentualnie żar)',
    o2.czastki.every(c => c.zar));

// --- 2. Wszystkie cząstki gasną w granicach ZYCIE_MAX ---
console.log('\nŻYCIE:');
const o3 = new Ogien();
o3._emituj({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 0, 1, 1); // 1s emisji na raz -> dużo cząstek
const zyciaPrzed = o3.czastki.length;
let klatek = 0;
const maxKlatek = Math.ceil((NASTAWY.ZYCIE_MAX + NASTAWY.ZAR_ZYCIE) / DT) + 30;
while (o3.liczba > 0 && klatek < maxKlatek) { o3._ruszaj(DT); klatek++; }
spr(`${zyciaPrzed} cząstek wygasa w granicach czasu życia (po ${klatek} klatkach zostało ${o3.liczba})`,
    o3.liczba === 0);

// --- 3. Odporność na złe dane ---
console.log('\nODPORNOŚĆ:');
const o4 = new Ogien();
o4._emituj({ x: NaN, y: 0 }, { x: 0, y: 0 }, 0, 0, 1, DT);
spr('NaN w pozycji źródła nie wywraca emisji', true);
o4._ruszaj(NaN);
spr('_ruszaj(NaN) nie wywraca funkcji i nie rzuca', true);
o4._ruszaj(-1);
spr('_ruszaj(ujemne) nie rzuca', true);

// --- 4. Turbulencja i wyporność działają (cząstka się przemieszcza) ---
console.log('\nFIZYKA:');
const o5 = new Ogien();
o5._dodaj({ x: 500, y: 500, vx: 0, vy: 0, zycie: 2, wyporn: NASTAWY.WYPORNOSC, turb: 0, skala: 1, zar: false });
const y0 = o5.czastki[0].y;
for (let i = 0; i < 10; i++) o5._ruszaj(DT);
spr(`wyporność unosi cząstkę w górę (y: ${y0.toFixed(0)} -> ${o5.czastki[0].y.toFixed(0)})`,
    o5.czastki[0].y < y0);

// --- 5. NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnyMax = NASTAWY.MAX_CZASTECZEK;
    NASTAWY.MAX_CZASTECZEK = 5;
    const o6 = new Ogien();
    o6._emituj({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 0, 1, 1); // dużo cząstek na raz
    spr(`sufit MAX_CZASTECZEK respektowany po zmianie (${o6.liczba} <= 5)`, o6.liczba <= 5);
    spr(`nadmiar zliczony w odrzucone (${o6.odrzucone})`, o6.odrzucone > 0);
    NASTAWY.MAX_CZASTECZEK = domyslnyMax;

    const domyslnaSkala = NASTAWY.NA_SEKUNDE;
    NASTAWY.NA_SEKUNDE = 0;
    const o7 = new Ogien();
    o7._emituj({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 0, 1, DT);
    spr('NASTAWY.NA_SEKUNDE=0 wstrzymuje emisję płomienia', o7.czastki.every(c => c.zar));
    NASTAWY.NA_SEKUNDE = domyslnaSkala;

    spr('wyczyscCache() istnieje i nie rzuca', (o7.wyczyscCache(), true));
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
