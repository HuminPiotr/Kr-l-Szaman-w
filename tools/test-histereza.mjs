// Test js/histereza.js: histereza dwuprogowa.
// Uruchom: node tools/test-histereza.mjs

import { Histereza } from '../js/histereza.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('1. Podstawowe wejście/wyjście:');
{
    const h = new Histereza(0.95, 0.90);
    spr('świeża histereza zaczyna FAŁSZEM', h.stan === false);
    spr('poniżej progu wejścia - zostaje FAŁSZEM', h.update(0.94) === false);
    spr('DOKŁADNIE na progu wejścia - wchodzi (>=)', h.update(0.95) === true);
    spr('spadek, ale wciąż POWYŻEJ progu wyjścia - zostaje PRAWDĄ', h.update(0.92) === true);
    spr('DOKŁADNIE na progu wyjścia - zostaje PRAWDĄ (< nie <=)', h.update(0.90) === true);
    spr('poniżej progu wyjścia - wychodzi', h.update(0.899) === false);
}

console.log('\n2. Nie miga w paśmie histerezy:');
{
    const h = new Histereza(0.95, 0.90);
    h.update(0.95);   // wejście
    let przelaczen = 0, poprzedni = h.stan;
    for (let i = 0; i < 20; i++) {
        const x = 0.92 + (i % 2 === 0 ? 0.02 : -0.02);   // oscyluje 0.90..0.94, W PAŚMIE
        const nowy = h.update(x);
        if (nowy !== poprzedni) przelaczen++;
        poprzedni = nowy;
    }
    spr(`oscylacja WEWNĄTRZ pasma (0.90-0.94) - zero przełączeń (${przelaczen})`, przelaczen === 0);
}

console.log('\n3. Miga na krawędziach PASMA, nie zjada realnych przejść:');
{
    const h = new Histereza(0.95, 0.90);
    h.update(0.94);
    spr('start: nie weszła', h.stan === false);
    h.update(0.96);
    spr('przekroczenie progu wejścia - wchodzi', h.stan === true);
    h.update(0.89);
    spr('spadek pod próg wyjścia - wychodzi', h.stan === false);
}

console.log('\n4. Odporność na NaN/undefined:');
{
    const h = new Histereza(0.95, 0.90);
    h.update(0.96);
    spr('stan=true po wejściu', h.stan === true);
    spr('NaN nie zmienia stanu', h.update(NaN) === true);
    spr('undefined nie zmienia stanu (Number.isFinite(undefined)=false)', h.update(undefined) === true);
    spr('stan wciąż true po serii NaN', h.stan === true);
}

console.log('\n5. Konstruktor z dowolnymi progami (nie tylko 0.95/0.90):');
{
    const h = new Histereza(0.55, 0.35);   // te same wartości co dmuchanie.js
    spr('próg wejścia 0.55 respektowany', h.update(0.5) === false && h.update(0.55) === true);
    spr('próg wyjścia 0.35 respektowany', h.update(0.4) === true && h.update(0.34) === false);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
