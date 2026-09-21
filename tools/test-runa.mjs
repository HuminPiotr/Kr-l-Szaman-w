/**
 * Wielka runa pieczęci: obwiednia fazRuny() (czysta funkcja) i odporność
 * klasy Runy bez document (Node - ten sam wzorzec co tools/test-ekran.mjs:
 * guard `!ctx` jest PO doliczeniu czasu, więc upływ i wygasanie testujemy
 * z ctx=null).
 *
 *   node tools/test-runa.mjs
 */
import { Runy, fazaRuny, CZAS_NARODZINY_S, CZAS_ZAR_DO_S, CZAS_CALKOWITY_S, NASTAWY } from '../js/runa.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('FAZA RUNY (czysta funkcja):');
spr('t=0 -> narodziny, glif niewidoczny (alfaGlif≈0)', fazaRuny(0).faza === 'narodziny' && fazaRuny(0).alfaGlif < 0.01);
spr('w środku narodzin glif częściowo widoczny', fazaRuny(CZAS_NARODZINY_S / 2).alfaGlif > 0.3 && fazaRuny(CZAS_NARODZINY_S / 2).alfaGlif < 0.7);
spr('zaraz po narodzinach -> faza żar, pełna alfa', fazaRuny(CZAS_NARODZINY_S + 0.01).faza === 'zar' && fazaRuny(CZAS_NARODZINY_S + 0.01).alfaGlif > 0.99);
spr('w żarze skala jest stabilna (1.0)', fazaRuny((CZAS_NARODZINY_S + CZAS_ZAR_DO_S) / 2).skala === 1);
spr('zaraz po żarze -> faza rozsypanie', fazaRuny(CZAS_ZAR_DO_S + 0.01).faza === 'rozsypanie');
spr('w rozsypaniu alfa glifu maleje do 0 (t blisko końca)', fazaRuny(CZAS_CALKOWITY_S - 0.01).alfaGlif < 0.05);
spr('t >= CZAS_CALKOWITY_S -> martwa (zywa=false)', fazaRuny(CZAS_CALKOWITY_S).zywa === false);
spr('t daleko za końcem -> nadal martwa, bez wyjątku', fazaRuny(999).zywa === false);
spr('NaN -> skończone wartości, bez wyjątku', Number.isFinite(fazaRuny(NaN).alfaGlif));
spr('t ujemne traktowane jak 0, bez wyjątku', fazaRuny(-5).faza === 'narodziny');

console.log('\nSUBTELNY PIERŚCIEŃ - WYŁĄCZNIE w fazie narodzin:');
spr('narodziny: subtelnyPierscien > 0', fazaRuny(0.1).subtelnyPierscien > 0);
spr('narodziny: subtelnyPierscien pozostaje SŁABY (<0.15)', fazaRuny(0.1).subtelnyPierscien < 0.15);
spr('żar: subtelnyPierscien == 0 (żadnego okręgu poza narodzinami)', fazaRuny(CZAS_NARODZINY_S + 0.2).subtelnyPierscien === 0);
spr('rozsypanie: subtelnyPierscien == 0', fazaRuny(CZAS_ZAR_DO_S + 0.2).subtelnyPierscien === 0);

console.log('\nMONOTONICZNOŚĆ - żadna faza nie cofa się mimo drgań dt:');
let poprzedniaFaza = -1;
const kolejnoscFaz = { narodziny: 0, zar: 1, rozsypanie: 2 };
let monotoniczne = true;
for (let t = 0; t < CZAS_CALKOWITY_S; t += 0.01) {
    const f = kolejnoscFaz[fazaRuny(t).faza];
    if (f < poprzedniaFaza) monotoniczne = false;
    poprzedniaFaza = f;
}
spr('faza narodziny -> żar -> rozsypanie w tej kolejności, bez nawrotów', monotoniczne);

console.log('\nKLASA Runy BEZ document (ctx=null, ten sam wzorzec co test-ekran.mjs):');
const DT = 1 / 60;
const r = new Runy();
spr('świeży rejestr nie ma aktywnych run', r.aktywne.length === 0);

r.odpal('swarog', { x: 100, y: 200 }, '25, 100%, 62%');
spr('odpal() dodaje jedną aktywną runę', r.aktywne.length === 1);
spr('odpal() zapisuje właściwy znak (swarog -> Kenaz ᚲ)', r.aktywne[0].znak === 'ᚲ');

r.odpal('nieistnieje', { x: 1, y: 1 }, '0,0%,0%');
spr('odpal() dla nieznanej pieczęci nic nie dodaje (cicho)', r.aktywne.length === 1);

r.odpal('perun', null, '50, 100%, 92%');
spr('odpal() bez zaczepu nic nie dodaje (cicho)', r.aktywne.length === 1);

r.odpal('perun', { x: NaN, y: 1 }, '50, 100%, 92%');
spr('odpal() z NaN w zaczepie nic nie dodaje (cicho)', r.aktywne.length === 1);

// Upływ czasu bez ctx: przeleć całą obwiednię, runa musi wygasnąć.
const przepusc = (sekundy) => {
    for (let i = 0; i < Math.round(sekundy / DT); i++) r.updateAndDraw(null, 1920, 1080, DT);
};
przepusc(CZAS_CALKOWITY_S + 0.5);
spr('po pełnej obwiedni (bez ctx) runa wygasa sama z siebie', r.aktywne.length === 0);

console.log('\nODPORNOŚĆ:');
const r2 = new Runy();
r2.odpal('swarog', { x: 10, y: 10 }, '25, 100%, 62%');
let rzucil = false;
try {
    r2.updateAndDraw(null, 1920, 1080, NaN);
    r2.updateAndDraw(undefined, NaN, NaN, 0.016);
} catch {
    rzucil = true;
}
spr('NaN dt / undefined ctx / NaN W,H nie wywraca silnika', !rzucil);

const r3 = new Runy();
for (let i = 0; i < 50; i++) r3.odpal('mokosz', { x: i, y: i }, '200, 70%, 70%');
spr('wielokrotne odpalenie tej samej pieczęci nie wybucha (50 aktywnych)', r3.aktywne.length === 50);

// --- NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
// Uwaga: iskry rozsypania odpalają się TYLKO gdy ctx i fontGotowy() są
// prawdziwe (_odpalIskryJesliCzas woła się z wnętrza rysowania) - w Node
// font nigdy się nie doczeka, więc nie da się tu przetestować emisji iskier
// end-to-end (to samo ograniczenie co reszta pliku - sekcja "BEZ document").
// Sprawdzamy więc sam kontrakt mutowalności, którego potrzebuje stanowisko.
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnyRozmiar = NASTAWY.ROZMIAR_WZGL_H;
    NASTAWY.ROZMIAR_WZGL_H = 0.5;
    spr('mutacja NASTAWY jest widoczna od razu (ten sam obiekt, nie kopia)',
        NASTAWY.ROZMIAR_WZGL_H === 0.5);
    NASTAWY.ROZMIAR_WZGL_H = domyslnyRozmiar;

    const r9 = new Runy();
    spr('wyczyscCache() istnieje i nie rzuca', (r9.wyczyscCache(), true));
}

process.exit(ok ? 0 : 1);
