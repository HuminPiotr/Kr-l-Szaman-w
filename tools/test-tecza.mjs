/**
 * Tecza - stan nagrody: 30 s darmowej wstęgi po 3x złożeniu Splotu.
 *
 *   node tools/test-tecza.mjs
 *
 * Bez zależności od DOM - czysty stan, żadnego rysowania (to robi aura.js).
 */
import { Tecza } from '../js/tecza.js';

const DT = 1 / 60;

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Świeża Tecza jest nieaktywna ---
console.log('STAN POCZĄTKOWY:');
const t1 = new Tecza();
spr('świeża Tecza jest nieaktywna', t1.aktywna === false);
spr('  ...i siła śladu wynosi zero', t1.silaSladu === 0);

// --- 2. Aktywacja ustawia pełne 30 s ---
console.log('\nAKTYWACJA:');
const t2 = new Tecza();
t2.aktywuj();
spr(`aktywuj() ustawia aktywną (${t2.aktywna})`, t2.aktywna === true);
spr(`  ...i pełne 30 s (${t2.pozostaloS})`, t2.pozostaloS === 30);

// --- 3. Licznik odlicza w czasie ---
console.log('\nODLICZANIE:');
const t3 = new Tecza();
t3.aktywuj();
for (let i = 0; i < 60; i++) t3.update(0, DT);   // 1 s
spr(`po 1 s pozostało ~29 s (${t3.pozostaloS.toFixed(2)})`, Math.abs(t3.pozostaloS - 29) < 0.05);
spr('  ...dalej aktywna', t3.aktywna === true);

// --- 4. Odnowienie w trakcie RESTARTUJE, nie sumuje ---
console.log('\nODNOWIENIE:');
const t4 = new Tecza();
t4.aktywuj();
for (let i = 0; i < 60 * 20; i++) t4.update(0, DT);   // 20 s - zostało 10 s
spr(`po 20 s zostało ~10 s (${t4.pozostaloS.toFixed(1)})`, Math.abs(t4.pozostaloS - 10) < 0.1);
t4.aktywuj();   // odnowienie
spr(`odnowienie RESTARTUJE do pełnych 30 s, nie sumuje (${t4.pozostaloS})`, t4.pozostaloS === 30);

// --- 5. Siła śladu: pełna przez 27 s, rampa w ostatnich 3 s, zero po wygaśnięciu ---
console.log('\nSIŁA ŚLADU (wygaszanie):');
const t5 = new Tecza();
t5.aktywuj();
for (let i = 0; i < 60 * 10; i++) t5.update(0, DT);   // 10 s - dużo czasu, pełna siła
spr(`siła śladu pełna daleko przed końcem (${t5.silaSladu.toFixed(2)})`, t5.silaSladu === 1);
for (let i = 0; i < 60 * 18.5; i++) t5.update(0, DT);   // razem 28.5 s - 1.5 s do końca
spr(`siła śladu W RAMPIE 1.5 s przed końcem (${t5.silaSladu.toFixed(2)})`,
    t5.silaSladu > 0.3 && t5.silaSladu < 0.7);
for (let i = 0; i < 60 * 2; i++) t5.update(0, DT);   // dobija do i za koniec
spr(`po wygaśnięciu aktywna=false (${t5.aktywna})`, t5.aktywna === false);
spr(`  ...i siła śladu dokładnie zero (${t5.silaSladu})`, t5.silaSladu === 0);
spr(`  ...i pozostaloS nie schodzi poniżej zera (${t5.pozostaloS})`, t5.pozostaloS === 0);

// --- 6. Barwa reaguje na ruch: stój = leniwie, ruch = szybciej ---
console.log('\nTEMPO BARWY ZALEŻNE OD RUCHU:');
const stojacy = new Tecza(); stojacy.aktywuj();
const tanczacy = new Tecza(); tanczacy.aktywuj();
for (let i = 0; i < 60; i++) {
    stojacy.update(0, DT);      // bezruch
    tanczacy.update(1, DT);     // pełny ruch
}
spr(`bezruch NADAL przesuwa barwę - "leniwie", nie zamrożone (${stojacy.barwaHue.toFixed(1)}°)`,
    stojacy.barwaHue > 0);
spr(`pełny ruch przesuwa barwę SZYBCIEJ niż bezruch (${tanczacy.barwaHue.toFixed(1)}° > ${stojacy.barwaHue.toFixed(1)}°)`,
    tanczacy.barwaHue > stojacy.barwaHue * 1.5);

// --- 7. Barwa zawija się w 0..360 ---
console.log('\nZAWIJANIE BARWY:');
const t7 = new Tecza(); t7.aktywuj();
for (let i = 0; i < 60 * 30; i++) t7.update(1, DT);   // pełne 30 s pełnego ruchu
spr(`barwa zostaje w 0..360 (${t7.barwaHue.toFixed(1)}°)`, t7.barwaHue >= 0 && t7.barwaHue < 360);

// --- 8. update() na nieaktywnej Teczy jest bezpiecznym no-opem ---
console.log('\nODPORNOŚĆ:');
const t8 = new Tecza();
t8.update(1, DT);
spr('update() na nieaktywnej nie aktywuje jej', t8.aktywna === false);
spr('  ...i nie rusza barwy', t8.barwaHue === 0);

// NaN dt / NaN ruch nie wywracają stanu.
const t9 = new Tecza(); t9.aktywuj();
t9.update(NaN, NaN);
spr('NaN ruch + NaN dt -> bez wyjątku', Number.isFinite(t9.pozostaloS) && Number.isFinite(t9.barwaHue));
spr('  ...i nadal aktywna (NaN dt = brak upływu czasu)', t9.aktywna === true);

process.exit(ok ? 0 : 1);
