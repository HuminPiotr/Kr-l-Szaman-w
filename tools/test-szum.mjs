// Test js/szum.js: PRNG (mulberry32), pole szumu 2D/3D, fbm, curl.
// Uruchom: node tools/test-szum.mjs

import { mulberry32, ustawZiarnoSzumu, simplex2, simplex3, fbm2, curl2 } from '../js/szum.js';

let ok = true;
const spr = (opis, warunek) => {
    if (warunek) {
        console.log(`  ✓ ${opis}`);
    } else {
        console.log(`  ✗ ${opis}`);
        ok = false;
    }
};

console.log('1. mulberry32 - determinizm i zakres:');
{
    const a = mulberry32(1);
    const v1 = [a(), a(), a()];
    const b = mulberry32(1);
    const v2 = [b(), b(), b()];
    spr('to samo ziarno -> ta sama sekwencja (3 pierwsze wartości)',
        v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2]);
    spr('wartości są liczbami skończonymi w [0,1)',
        v1.every(v => Number.isFinite(v) && v >= 0 && v < 1));

    const c = mulberry32(2);
    spr('inne ziarno -> inna pierwsza wartość', c() !== mulberry32(1)());

    const d = mulberry32(42);
    let wszystkieOk = true;
    for (let i = 0; i < 10000; i++) {
        const x = d();
        if (!Number.isFinite(x) || x < 0 || x >= 1) { wszystkieOk = false; break; }
    }
    spr('10000 próbek w [0,1)', wszystkieOk);
}

console.log('2. simplex2 - zakres i ciągłość:');
{
    const rnd = mulberry32(7);
    let mieszczySie = true, suma = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
        const x = rnd() * 100 - 50, y = rnd() * 100 - 50;
        const n = simplex2(x, y);
        suma += n;
        if (!Number.isFinite(n) || n < -1.6 || n > 1.6) mieszczySie = false;
    }
    spr('10000 próbek mieści się w [-1.6, 1.6] (zapas nad teoretycznym [-1,1])', mieszczySie);
    spr('średnia bliska zeru (|mean| < 0.05)', Math.abs(suma / N) < 0.05);

    const n1 = simplex2(3.14159, 2.71828);
    const n2 = simplex2(3.14159 + 1e-4, 2.71828);
    spr('ciągłość: mała zmiana x daje małą zmianę wyniku', Math.abs(n1 - n2) < 1e-2);

    spr('NaN na wejściu -> 0', simplex2(NaN, 1) === 0 && simplex2(1, NaN) === 0);
}

console.log('3. simplex3 - zakres:');
{
    const rnd = mulberry32(9);
    let mieszczySie = true;
    for (let i = 0; i < 5000; i++) {
        const n = simplex3(rnd() * 20 - 10, rnd() * 20 - 10, rnd() * 20 - 10);
        if (!Number.isFinite(n) || n < -1.6 || n > 1.6) mieszczySie = false;
    }
    spr('5000 próbek mieści się w [-1.6, 1.6]', mieszczySie);
    spr('NaN na wejściu -> 0', simplex3(NaN, 1, 1) === 0);
}

console.log('4. ustawZiarnoSzumu - determinizm pola:');
{
    ustawZiarnoSzumu(123);
    const a1 = simplex2(1.5, 2.5), a2 = simplex3(1.5, 2.5, 0.3);
    ustawZiarnoSzumu(999);
    const b1 = simplex2(1.5, 2.5);
    ustawZiarnoSzumu(123);
    const c1 = simplex2(1.5, 2.5), c2 = simplex3(1.5, 2.5, 0.3);
    spr('to samo ziarno pola -> te same wartości simplex2/simplex3', a1 === c1 && a2 === c2);
    spr('inne ziarno pola -> inna wartość (zwykle)', a1 !== b1);
    ustawZiarnoSzumu(1); // przywróć domyślne dla reszty testów
}

console.log('5. fbm2 - zakres i determinizm:');
{
    const rnd = mulberry32(11);
    let mieszczySie = true;
    for (let i = 0; i < 3000; i++) {
        const n = fbm2(rnd() * 30 - 15, rnd() * 30 - 15);
        if (!Number.isFinite(n) || n < -1.6 || n > 1.6) mieszczySie = false;
    }
    spr('3000 próbek mieści się w [-1.6, 1.6]', mieszczySie);
    spr('deterministyczne: to samo wejście -> ten sam wynik', fbm2(4.2, 5.3) === fbm2(4.2, 5.3));
    spr('NaN na wejściu -> 0', fbm2(NaN, 1) === 0);
    spr('nieprawidłowa liczba oktaw nie wywraca funkcji', Number.isFinite(fbm2(1, 1, -1)) && Number.isFinite(fbm2(1, 1, NaN)));
}

console.log('6. curl2 - bezdywergencyjność (numerycznie):');
{
    const rnd = mulberry32(13);
    const h = 1e-3;
    let maxDywergencja = 0;
    let probek = 0;
    for (let i = 0; i < 200; i++) {
        const x = rnd() * 10 - 5, y = rnd() * 10 - 5;
        const vxPlus = curl2(x + h, y).x, vxMinus = curl2(x - h, y).x;
        const vyPlus = curl2(x, y + h).y, vyMinus = curl2(x, y - h).y;
        // Dywergencja pola curl(x,y) samego - powinna być ~0 w drugim rzędzie,
        // ale tu liczymy numeryczną dywergencję WYNIKU curl2 (pole wektorowe
        // {x,y}), nie dywergencję pola źródłowego - to sprawdza, że curl2
        // faktycznie konstruuje pole o (w granicy h->0) zerowej dywergencji.
        const dvxdx = (vxPlus - vxMinus) / (2 * h);
        const dvydy = (vyPlus - vyMinus) / (2 * h);
        const dyw = Math.abs(dvxdx + dvydy);
        if (dyw > maxDywergencja) maxDywergencja = dyw;
        probek++;
    }
    spr(`200 próbek: max |dywergencja| < 5 (numeryczna, h=${h}) - policzono ${probek}`, maxDywergencja < 5);
    spr('curl2 zwraca skończone {x,y}', Number.isFinite(curl2(1, 2).x) && Number.isFinite(curl2(1, 2).y));
    spr('NaN na wejściu -> {x:0,y:0}', curl2(NaN, 1).x === 0 && curl2(NaN, 1).y === 0);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
