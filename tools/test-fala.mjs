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
import { Fala, rzutPerspektywiczny, rzutujPozycje, OGNISKO } from '../js/fala.js';

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

process.exit(ok ? 0 : 1);
