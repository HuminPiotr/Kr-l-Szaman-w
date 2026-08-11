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
import { Fala, rzutPerspektywiczny, OGNISKO } from '../js/fala.js';

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
spr(`bardzo bliska/za kamerą (z=-${OGNISKO}) jest KLAMROWANA, nie ucieka w nieskończoność`,
    Number.isFinite(rzutPerspektywiczny(-OGNISKO)) && rzutPerspektywiczny(-OGNISKO) <= 3);
spr('NaN -> skończona wartość, bez wyjątku', Number.isFinite(rzutPerspektywiczny(NaN)));

process.exit(ok ? 0 : 1);
