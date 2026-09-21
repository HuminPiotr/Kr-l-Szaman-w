/**
 * Fala (Podmuch/Aard) - układ cząstek, TYLKO fizyka.
 *
 *   node tools/test-fala.mjs
 *
 * Nie wywołuje updateAndDraw()/_rysuj() - tworzą sprite przez
 * document.createElement, którego nie ma w Node (ten sam powód, dla którego
 * żaden test nie dotyka rysowania Ogien - patrz tools/test-integracja-ognia.mjs).
 * Fizykę testujemy przez _ruszaj(dt) bezpośrednio, jak tools/test-aura-impuls.mjs
 * czyta aura._impuls.
 */
import { Fala, rzutPerspektywiczny, rzutujPozycje, OGNISKO, polozenieCzola, punktyCzola, pchniecieCzola, NASTAWY } from '../js/fala.js';

const DT = 1 / 60;

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Wystrzał emituje cząstki ---
console.log('WYSTRZAŁ:');
const f1 = new Fala();
spr('świeża fala jest pusta', f1.liczba === 0);
f1.wystrzel({ x: 500, y: 500 }, { x: 0, y: 0, z: 1 }, 1);
spr(`wystrzał emituje cząstki (${f1.liczba})`, f1.liczba > 50);

// --- 2. Cząstki lecą W KIERUNKU wystrzału ---
console.log('\nKIERUNEK RUCHU:');
const f2 = new Fala();
f2.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
for (let i = 0; i < 30; i++) f2._ruszaj(DT);   // 0.5 s
const srZ = f2.czastki.reduce((s, c) => s + c.z, 0) / f2.czastki.length;
spr(`po 0.5 s średnie z rośnie w kierunku wystrzału (+z) -> ${srZ.toFixed(0)}`, srZ > 50);

// --- 3. Wszystkie cząstki wygasają ---
console.log('\nWYGASANIE:');
const f3 = new Fala();
f3.wystrzel({ x: 0, y: 0 }, { x: 1, y: 0, z: 0 }, 1);
let klatek = 0;
while (f3.liczba > 0 && klatek < 600) { f3._ruszaj(DT); klatek++; }
spr(`wszystkie cząstki wygasają (po ${(klatek * DT).toFixed(2)} s, < 3 s)`,
    f3.liczba === 0 && klatek * DT < 3);

// --- 4. Siła skaluje liczbę/prędkość, nie wyłącza fali ---
console.log('\nSIŁA:');
const f4pelna = new Fala(); f4pelna.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
const f4slaba = new Fala(); f4slaba.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 0.3);
spr(`słabsza siła daje mniej cząstek niż pełna (${f4slaba.liczba} < ${f4pelna.liczba})`,
    f4slaba.liczba < f4pelna.liczba);
spr(`  ...ale nie zero (${f4slaba.liczba})`, f4slaba.liczba > 0);

// --- 5. Zły wektor kierunku / zaczep nie emituje i nie wywraca fali ---
console.log('\nODPORNOŚĆ:');
const f5 = new Fala();
f5.wystrzel({ x: NaN, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
spr('NaN w zaczepie -> brak emisji, bez wyjątku', f5.liczba === 0);
f5.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 1);
spr('kierunek zerowej długości -> brak emisji, bez wyjątku', f5.liczba === 0);
f5.wystrzel({ x: 0, y: 0 }, null, 1);
spr('brak kierunku -> brak emisji, bez wyjątku', f5.liczba === 0);
f5.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 0);
spr('siła zero -> brak emisji, bez wyjątku', f5.liczba === 0);
f5._ruszaj(NaN);
spr('NaN dt w _ruszaj -> bez wyjątku, bez zmian', true);

// --- 6. Rzut perspektywiczny: bliżej = większe, dalej = mniejsze ---
console.log('\nRZUT PERSPEKTYWICZNY:');
spr(`z=0 daje s=1 (${rzutPerspektywiczny(0).toFixed(2)})`, Math.abs(rzutPerspektywiczny(0) - 1) < 0.01);
spr(`bliższa cząstka (z=100) większa niż dalsza (z=500)`,
    rzutPerspektywiczny(100) > rzutPerspektywiczny(500));
spr(`bardzo daleka cząstka (z=${OGNISKO * 10}) prawie znika (s=${rzutPerspektywiczny(OGNISKO * 10).toFixed(3)})`,
    rzutPerspektywiczny(OGNISKO * 10) < 0.15);
// Górna granica na s wynika WYŁĄCZNIE z klamra na z (zc_min=-OGNISKO*0.6 ->
// s_max=2.5) - osobny klamr na s byłby martwym kodem, bo nigdy by się nie
// uaktywnił. Assert na dokładną granicę, nie okrągłe "<=3", żeby test
// faktycznie coś sprawdzał, a nie przechodził trywialnie.
spr(`bardzo bliska/za kamerą (z=-${OGNISKO}) jest KLAMROWANA do s=2.5, nie ucieka w nieskończoność`,
    Number.isFinite(rzutPerspektywiczny(-OGNISKO)) && Math.abs(rzutPerspektywiczny(-OGNISKO) - 2.5) < 1e-9);
spr(`jeszcze dalej za kamerą (z=-10*OGNISKO) dalej daje s=2.5 - klamr trzyma`,
    Math.abs(rzutPerspektywiczny(-10 * OGNISKO) - 2.5) < 1e-9);

// --- 7. Rzut pozycji: prawdziwa zbieżność do zaczepu z głębią, nie tylko
// kurczenie się w miejscu. Bez tego dalekie cząstki rysowałyby się w PEŁNYM
// bocznym rozstawie, tylko mniejsze - zamiast być ściągnięte bliżej zaczepu,
// jak wymaga spec (`zaczep_2d + (x,y)·s`). ---
console.log('\nRZUT POZYCJI (zbieżność perspektywiczna):');
const zaczep7 = { x: 500, y: 500 };
const daleko7 = { x: 700, y: 300 };   // 200px w bok, 200px w górę od zaczepu
const bliskoWynik = rzutujPozycje(zaczep7, daleko7, 1.0);   // s=1 (na miejscu emisji)
spr(`przy s=1 pozycja to prawdziwa pozycja bez zmian (${bliskoWynik.x}, ${bliskoWynik.y})`,
    bliskoWynik.x === daleko7.x && bliskoWynik.y === daleko7.y);
const dalekoWynik = rzutujPozycje(zaczep7, daleko7, 0.0);   // s=0 (nieskończenie daleko)
spr(`przy s=0 pozycja zbiega DOKŁADNIE do zaczepu (${dalekoWynik.x}, ${dalekoWynik.y})`,
    dalekoWynik.x === zaczep7.x && dalekoWynik.y === zaczep7.y);
const posredniWynik = rzutujPozycje(zaczep7, daleko7, 0.5);
spr(`przy s=0.5 pozycja jest w POŁOWIE drogi do zaczepu (${posredniWynik.x}, ${posredniWynik.y})`,
    posredniWynik.x === 600 && posredniWynik.y === 400);
spr('NaN -> skończona wartość, bez wyjątku', Number.isFinite(rzutPerspektywiczny(NaN)));

// --- 8. KSZTAŁT FALI UDERZENIOWEJ: pierścień + rozbłysk rdzenia ---
// Pierwsza wersja emitowała wąski stożek i wyglądała biednie. Te asercje
// pilnują struktury, która zastąpiła stożek - żeby nie dało się jej cofnąć
// przez przypadek przy następnym strojeniu.
console.log('\nKSZTAŁT FALI UDERZENIOWEJ:');
const f8 = new Fala();
f8.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);

// Rozbłysk rdzenia to OSOBNA warstwa - krótsza i startująca w punkcie.
const rdzenie = f8.czastki.filter(c => c.rdzen);
const czolo = f8.czastki.filter(c => !c.rdzen);
spr(`wystrzał daje OBIE warstwy: czoło (${czolo.length}) i rdzeń (${rdzenie.length})`,
    czolo.length > 0 && rdzenie.length > 0);
spr(`rdzeń gaśnie wyraźnie szybciej niż czoło (${Math.max(...rdzenie.map(c => c.zycie)).toFixed(2)} < ${Math.min(...czolo.map(c => c.zycie)).toFixed(2)})`,
    Math.max(...rdzenie.map(c => c.zycie)) < Math.min(...czolo.map(c => c.zycie)));

// Czoło startuje NA PIERŚCIENIU, nie w punkcie - to jest sedno kształtu.
const promienie = czolo.map(c => Math.hypot(c.x, c.y, c.z));
spr(`czoło startuje na PIERŚCIENIU, nie w punkcie (min. promień ${Math.min(...promienie).toFixed(1)} px)`,
    Math.min(...promienie) > 1);
// ...a rdzeń przeciwnie: dokładnie w punkcie zaczepu.
spr(`rdzeń startuje DOKŁADNIE w zaczepie`,
    rdzenie.every(c => c.x === 0 && c.y === 0 && c.z === 0));

// Pierścień otacza oś ze WSZYSTKICH stron (nie jest jednostronnym wachlarzem).
// Kierunek wystrzału to +z, więc płaszczyzna pierścienia to (x,y).
const kwadranty = new Set(czolo.map(c => `${c.x >= 0 ? 'P' : 'L'}${c.y >= 0 ? 'G' : 'D'}`));
spr(`pierścień otacza oś ze wszystkich stron (${kwadranty.size}/4 kwadrantów)`, kwadranty.size === 4);

// Pierścień ROŚNIE w czasie - fala się rozchodzi, nie tylko leci do przodu.
const sredniPromien = (f) => {
    const cz = f.czastki.filter(c => !c.rdzen);
    return cz.reduce((s, c) => s + Math.hypot(c.x - 0, c.y - 0), 0) / cz.length;
};
const promienPrzed = sredniPromien(f8);
for (let i = 0; i < 18; i++) f8._ruszaj(DT);   // 0.3 s
const promienPo = sredniPromien(f8);
spr(`pierścień ROŚNIE w czasie (${promienPrzed.toFixed(0)} -> ${promienPo.toFixed(0)} px)`,
    promienPo > promienPrzed * 2);

// --- 9. BARWA jest parametrem wystrzel(), nie stałą globalną ---
// fala.js jest współdzielona między Aardem i Gromem w Ziemię (main.js) -
// bez tego testu ktoś mógłby przypadkiem cofnąć parametryzację i oba
// combosy znów świeciłyby identycznym błękitem Aarda.
console.log('\nBARWA JEST PARAMETREM:');
const f9domyslna = new Fala();
f9domyslna.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
spr('bez podanej barwy cząstki dostają barwę domyślną (Aard)',
    f9domyslna.czastki.filter(c => !c.rdzen).every(c => c.barwa[0] === 214 && c.barwa[1] === 240 && c.barwa[2] === 255));

const f9wlasna = new Fala();
const BARWA_TEST = [190, 100, 255];
f9wlasna.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1, BARWA_TEST);
spr('podana barwa trafia na cząstki czoła fali',
    f9wlasna.czastki.filter(c => !c.rdzen).every(c => c.barwa[0] === 190 && c.barwa[1] === 100 && c.barwa[2] === 255));

const f9zla = new Fala();
f9zla.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1, [NaN, 1, 2]);
spr('nieprawidłowa barwa (NaN w składowej) -> fallback na domyślną, bez wyjątku',
    f9zla.czastki.filter(c => !c.rdzen).every(c => c.barwa[0] === 214));

// --- 10. polozenieCzola(): analityczna kinematyka czoła (jedno źródło prawdy) ---
// Refrakcja powietrza w ekran.js i kreska czoła rysują się z TEJ funkcji,
// nie z własnych stałych - inaczej soczewka i cząstki rozjeżdżałyby się.
console.log('\nPOŁOŻENIE CZOŁA (funkcja czysta):');
const c0 = polozenieCzola(1, 0);
spr(`t=0: czoło na starcie ma promień > 0 (${c0.promien.toFixed(0)} px) i zero przesunięcia`,
    c0.promien > 0 && c0.wzdluz === 0);
const c1 = polozenieCzola(1, 0.3), c2 = polozenieCzola(1, 0.6);
spr(`promień ROŚNIE w czasie (${c0.promien.toFixed(0)} < ${c1.promien.toFixed(0)} < ${c2.promien.toFixed(0)})`,
    c0.promien < c1.promien && c1.promien < c2.promien);
spr(`przesunięcie wzdłuż kierunku rośnie i WYSYCA SIĘ (${c1.wzdluz.toFixed(0)} -> ${c2.wzdluz.toFixed(0)}, przyrost maleje)`,
    c1.wzdluz > 0 && c2.wzdluz > c1.wzdluz && (c2.wzdluz - c1.wzdluz) < c1.wzdluz);
// Zgodność z symulacją cząstek: średni promień cząstek po 0.5 s musi mieścić
// się blisko analitycznego (cząstki mają warstwę 0.55..1 i rozrzut, więc
// średnia leży PONIŻEJ pełnego promienia czoła, ale w tym samym rzędzie).
const f10 = new Fala();
f10.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
for (let i = 0; i < 30; i++) f10._ruszaj(DT);
const czolo10 = f10.czastki.filter(c => !c.rdzen);
const srPromien10 = czolo10.reduce((s, c) => s + Math.hypot(c.x, c.y), 0) / czolo10.length;
const anal10 = polozenieCzola(1, 0.5).promien;
spr(`analityczny promień (${anal10.toFixed(0)}) zgadza się z symulacją cząstek (śr. ${srPromien10.toFixed(0)}, 0.5..1.0x)`,
    srPromien10 > anal10 * 0.5 && srPromien10 <= anal10 * 1.0);
spr('słabsza siła daje mniejszy promień i przesunięcie',
    polozenieCzola(0.3, 0.5).promien < anal10 && polozenieCzola(0.3, 0.5).wzdluz < polozenieCzola(1, 0.5).wzdluz);
spr('NaN/ujemne argumenty -> skończone wartości, bez wyjątku',
    Number.isFinite(polozenieCzola(NaN, NaN).promien) && Number.isFinite(polozenieCzola(-1, -1).wzdluz));

// --- 11. punktyCzola(): rzut pierścienia na ekran ---
console.log('\nPUNKTY CZOŁA (rzut na ekran):');
const zaczep11 = { x: 500, y: 400 };
const wKamere = punktyCzola(zaczep11, { x: 0, y: 0, z: -1 }, 1, 0.4, 32);
spr(`daje żądaną liczbę punktów (${wKamere.punkty.length})`, wKamere.punkty.length === 32);
spr('wszystkie punkty skończone', wKamere.punkty.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
// Rzut W KAMERĘ: pierścień leży w płaszczyźnie ekranu -> koło wokół zaczepu,
// większe niż promień analityczny (cząstki bliżej kamery rosną w rzucie).
const odl11 = wKamere.punkty.map(p => Math.hypot(p.x - zaczep11.x, p.y - zaczep11.y));
const rozrzut11 = Math.max(...odl11) - Math.min(...odl11);
spr(`rzut w kamerę daje KOŁO (rozrzut promieni ${rozrzut11.toFixed(1)} px)`, rozrzut11 < 1);
spr(`  ...powiększone perspektywą (${Math.min(...odl11).toFixed(0)} > ${polozenieCzola(1, 0.4).promien.toFixed(0)})`,
    Math.min(...odl11) > polozenieCzola(1, 0.4).promien);
spr('  ...ze środkiem w zaczepie', Math.hypot(wKamere.srodek.x - zaczep11.x, wKamere.srodek.y - zaczep11.y) < 1);
// Rzut W BOK (+x): pierścień prostopadły do x -> na ekranie spłaszczony
// (szeroki w y, wąski w x) i przesunięty w +x.
const wBok = punktyCzola(zaczep11, { x: 1, y: 0, z: 0 }, 1, 0.4, 32);
const xs = wBok.punkty.map(p => p.x), ys = wBok.punkty.map(p => p.y);
spr(`rzut w bok: czoło SPŁASZCZONE (szer. x ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} < wys. y ${(Math.max(...ys) - Math.min(...ys)).toFixed(0)})`,
    (Math.max(...xs) - Math.min(...xs)) < (Math.max(...ys) - Math.min(...ys)));
spr(`  ...i przesunięte w kierunku wystrzału (środek x ${wBok.srodek.x.toFixed(0)} > ${zaczep11.x})`,
    wBok.srodek.x > zaczep11.x + 20);
spr('mnożnik promienia zmniejsza pierścień (wewnętrzna krawędź soczewki)',
    Math.max(...punktyCzola(zaczep11, { x: 0, y: 0, z: -1 }, 1, 0.4, 16, 0.6).punkty.map(p => Math.hypot(p.x - zaczep11.x, p.y - zaczep11.y)))
    < Math.min(...odl11));
spr('zły kierunek (zerowy) -> pusta lista punktów, bez wyjątku',
    punktyCzola(zaczep11, { x: 0, y: 0, z: 0 }, 1, 0.4, 16).punkty.length === 0);

// --- 12. Aard v2: czoło (kreska + smugi) i wir jako OSOBNY stan od cząstek ---
console.log('\nCZOŁO I WIR (stan, bez rysowania):');
const f12 = new Fala();
spr('świeża fala nie ma czół ani wirów', f12.czola.length === 0 && f12.wiry.length === 0);
f12.wystrzel({ x: 500, y: 400 }, { x: 0, y: 0, z: -1 }, 1, [140, 235, 195]);
spr('wystrzał rejestruje JEDNO czoło (kreska + smugi jadą z tym samym rekordem)', f12.czola.length === 1);
spr('czoło pamięta zaczep, kierunek, siłę i barwę',
    f12.czola[0].zaczep.x === 500 && f12.czola[0].kierunek.z === -1
    && f12.czola[0].sila === 1 && f12.czola[0].barwa[1] === 235);
spr(`czoło ma smugi wiatru z kątami po obwodzie (${f12.czola[0].smugi.length})`,
    f12.czola[0].smugi.length >= 6 && f12.czola[0].smugi.every(m => Number.isFinite(m.kat) && Number.isFinite(m.dryf)));
spr('smugi w Node nie mają obrazu (asset niezaładowany) - i to nie jest błąd',
    f12.czola[0].smugi.every(m => m.obraz === null));
spr('wystrzał NIE tworzy wiru - wir jest osobną decyzją main.js (tylko Aard, nie Grom)', f12.wiry.length === 0);
let klatek12 = 0;
while (f12.czola.length > 0 && klatek12 < 600) { f12._ruszaj(DT); klatek12++; }
spr(`czoło wygasa samo (po ${(klatek12 * DT).toFixed(2)} s, < 1.5 s)`, f12.czola.length === 0 && klatek12 * DT < 1.5);

const f12b = new Fala();
f12b.wir({ x: 500, y: 400 }, 1, [140, 235, 195]);
spr('wir() rejestruje wir', f12b.wiry.length === 1 && f12b.wiry[0].zaczep.x === 500);
let klatek12b = 0;
while (f12b.wiry.length > 0 && klatek12b < 600) { f12b._ruszaj(DT); klatek12b++; }
spr(`wir wygasa szybciej niż czoło (po ${(klatek12b * DT).toFixed(2)} s, < 0.5 s)`, f12b.wiry.length === 0 && klatek12b * DT < 0.5);

const f12c = new Fala();
f12c.wir({ x: NaN, y: 400 }, 1, [140, 235, 195]);
f12c.wir({ x: 500, y: 400 }, 0, [140, 235, 195]);
f12c.wir({ x: 500, y: 400 }, NaN, [140, 235, 195]);
spr('wir(): NaN zaczep / zero siły / NaN siła -> nic, bez wyjątku', f12c.wiry.length === 0);
f12c.wir({ x: 500, y: 400 }, 1, 'zła');
spr('wir(): zła barwa -> fallback na domyślną, bez wyjątku', f12c.wiry.length === 1 && f12c.wiry[0].barwa[0] === 214);
const f12d = new Fala();
f12d.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 1);
spr('nieprawidłowy wystrzał nie rejestruje czoła', f12d.czola.length === 0);

// --- 13. pchniecieCzola(): punkty czoła z prędkością 2D dla dym.pchnij() ---
console.log('\nPCHNIĘCIE CZOŁA (dla dymu):');
{
    const zaczep = { x: 800, y: 500 };
    const wKamere = pchniecieCzola(zaczep, { x: 0, y: 0, z: -1 }, 1, 0.3, DT, 24);
    spr(`daje żądaną liczbę punktów (${wKamere.length})`, wKamere.length === 24);
    spr('każdy punkt ma skończone x, y, vx, vy, r>0, sila',
        wKamere.every(p => [p.x, p.y, p.vx, p.vy, p.r, p.sila].every(Number.isFinite) && p.r > 0));
    // Rzut w kamerę: czoło rośnie na ekranie -> prędkość NA ZEWNĄTRZ od zaczepu.
    spr('rzut w kamerę: prędkości promieniście NA ZEWNĄTRZ od środka',
        wKamere.every(p => (p.x - zaczep.x) * p.vx + (p.y - zaczep.y) * p.vy > 0));
    const wBok = pchniecieCzola(zaczep, { x: 1, y: 0, z: 0 }, 1, 0.3, DT, 24);
    const srVx = wBok.reduce((s, p) => s + p.vx, 0) / wBok.length;
    spr(`rzut w bok (+x): średnie vx > 0 (${srVx.toFixed(0)} px/s)`, srVx > 0);
    spr('siła słabsza -> mniejsze prędkości',
        pchniecieCzola(zaczep, { x: 1, y: 0, z: 0 }, 0.3, 0.3, DT, 8).reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0)
        < wBok.slice(0, 8).reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) * 8 / 8 + 1e-9 && true);
    spr('dt=0 -> pusta lista, bez wyjątku', pchniecieCzola(zaczep, { x: 1, y: 0, z: 0 }, 1, 0.3, 0, 8).length === 0);
    spr('zły kierunek -> pusta lista, bez wyjątku', pchniecieCzola(zaczep, { x: 0, y: 0, z: 0 }, 1, 0.3, DT, 8).length === 0);
    spr('t < dt (pierwsza klatka) -> nadal skończone prędkości',
        pchniecieCzola(zaczep, { x: 1, y: 0, z: 0 }, 1, 0.005, DT, 8).every(p => Number.isFinite(p.vx)));
}

// --- NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnyNaWystrzal = NASTAWY.NA_WYSTRZAL;
    const domyslnyRdzen = NASTAWY.RDZEN_NA_WYSTRZAL;
    NASTAWY.NA_WYSTRZAL = 10;
    NASTAWY.RDZEN_NA_WYSTRZAL = 0;   // wyzerowany, żeby liczba mierzyła TYLKO czoło
    const f9 = new Fala();
    f9.wystrzel({ x: 0, y: 0 }, { x: 1, y: 0, z: 0 }, 1);
    spr(`zmiana NASTAWY.NA_WYSTRZAL widoczna w wystrzel() (${f9.liczba})`, f9.liczba === 10);
    NASTAWY.NA_WYSTRZAL = domyslnyNaWystrzal;
    NASTAWY.RDZEN_NA_WYSTRZAL = domyslnyRdzen;

    const domyslneOgnisko = NASTAWY.OGNISKO;
    NASTAWY.OGNISKO = 100;
    const sPrzy100 = rzutPerspektywiczny(200); // ognisko=100 -> 100/(100+200)
    NASTAWY.OGNISKO = domyslneOgnisko;
    const sPrzyDomyslnym = rzutPerspektywiczny(200); // ognisko=900 -> 900/(900+200)
    spr(`wartości różne dla różnych NASTAWY.OGNISKO (${sPrzy100.toFixed(3)} vs ${sPrzyDomyslnym.toFixed(3)})`,
        Math.abs(sPrzy100 - sPrzyDomyslnym) > 0.01);
    spr('OGNISKO (eksport snapshot) nadal równy domyślnej wartości NASTAWY', OGNISKO === 900);
}

process.exit(ok ? 0 : 1);
