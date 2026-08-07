/**
 * Bufor kombosów: wygasa z czasem, NIGDY nie jest czyszczony za pomyłkę.
 *
 *   node tools/test-kombosy.mjs
 *
 * Każda konwencjonalna gra walki kasuje bufor przy złym wejściu. To jest
 * stan porażki i łamie regułę nadrzędną (GEMINI.md §2). Tutaj żadna pieczęć
 * nie jest "zła": każda zapłaciła swoje 10% i dała własny efekt, więc
 * nieudana próba kombo to po prostu kilka ładnych błysków.
 */
import { KomboSilnik, KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('DOPASOWANIE SEKWENCJI:');
const k1 = new KomboSilnik();
spr('pierwsza pieczęć nie odpala kombo', k1.dodaj('perun', 0) === null);
const grom = k1.dodaj('mokosz', 800);
spr(`perun -> mokosz odpala Grom w Ziemię (${grom?.id})`, grom?.id === 'gromWZiemie');

console.log('\nBUFOR NIE JEST CZYSZCZONY ZA POMYŁKĘ:');
const k2 = new KomboSilnik();
k2.dodaj('weles', 0);          // pieczęć spoza jakiejkolwiek sekwencji na starcie
k2.dodaj('perun', 500);
const nadal = k2.dodaj('mokosz', 1000);
spr(`pieczęć "nie ta" nie psuje późniejszego kombo (${nadal?.id})`, nadal?.id === 'gromWZiemie');

console.log('\nBUFOR WYGASA Z CZASEM:');
const k3 = new KomboSilnik();
k3.dodaj('perun', 0);
const zaPozno = k3.dodaj('mokosz', 9000);  // 9 s - daleko poza oknem
spr('pieczęcie zbyt odległe w czasie nie tworzą kombo', zaPozno === null);
spr(`bufor odrzucił przeterminowany wpis (${k3.bufor.length})`, k3.bufor.length === 1);

console.log('\nDRUGIE KOMBO:');
const k4 = new KomboSilnik();
k4.dodaj('mokosz', 0);
const zew = k4.dodaj('weles', 600);
spr(`mokosz -> weles odpala Zew Podziemia (${zew?.id})`, zew?.id === 'zewPodziemia');

console.log('\nŁAŃCUCH:');
// perun -> mokosz -> weles daje OBA kombosy po kolei. To jest celowe
// i hojne: gracz nie może "zmarnować" pieczęci, więc nakładające się
// sekwencje mają się nakładać, a nie wykluczać.
const k5 = new KomboSilnik();
k5.dodaj('perun', 0);
const pierwsze = k5.dodaj('mokosz', 400);
const drugie = k5.dodaj('weles', 800);
spr(`łańcuch daje Grom (${pierwsze?.id})`, pierwsze?.id === 'gromWZiemie');
spr(`i zaraz Zew (${drugie?.id})`, drugie?.id === 'zewPodziemia');

console.log('\nBRAK PODWÓJNEGO ODPALENIA:');
const k6 = new KomboSilnik();
k6.dodaj('perun', 0);
k6.dodaj('mokosz', 400);
const powtorka = k6.dodaj('mokosz', 800);
spr('powtórzenie ostatniej pieczęci nie odpala kombo drugi raz', powtorka === null);

console.log('\nODPORNOŚĆ:');
const k7 = new KomboSilnik();
spr('nieznane id nie wywraca silnika', k7.dodaj('nieistnieje', 0) === null);
spr('NaN jako czas nie wywraca silnika', k7.dodaj('perun', NaN) === null);
spr('tabela kombosów jest niepusta', KOMBOSY.length >= 2);

process.exit(ok ? 0 : 1);
