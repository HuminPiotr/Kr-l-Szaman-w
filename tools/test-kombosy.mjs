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
spr('pierwsza pieczęć nie odpala kombo', k1.dodaj('swarog', 0) === null);
const grom = k1.dodaj('perun', 800);
spr(`swaróg -> perun odpala Grom w Ogniu (${grom?.id})`, grom?.id === 'gromWOgniu');

console.log('\nBUFOR NIE JEST CZYSZCZONY ZA POMYŁKĘ:');
const k2 = new KomboSilnik();
k2.dodaj('perun', 0);           // pieczęć nie rozpoczynająca żadnej sekwencji
k2.dodaj('swarog', 500);
const nadal = k2.dodaj('perun', 1000);
spr(`pieczęć "nie ta" nie psuje późniejszego kombo (${nadal?.id})`, nadal?.id === 'gromWOgniu');

console.log('\nBUFOR WYGASA Z CZASEM:');
const k3 = new KomboSilnik();
k3.dodaj('swarog', 0);
const zaPozno = k3.dodaj('perun', 9000);  // 9 s - daleko poza oknem
spr('pieczęcie zbyt odległe w czasie nie tworzą kombo', zaPozno === null);
spr(`bufor odrzucił przeterminowany wpis (${k3.bufor.length})`, k3.bufor.length === 1);

console.log('\nDRUGIE KOMBO:');
const k4 = new KomboSilnik();
k4.dodaj('weles', 0);
const zew = k4.dodaj('swarog', 600);
spr(`weles -> swaróg odpala Zew Podziemia (${zew?.id})`, zew?.id === 'zewPodziemia');

console.log('\nŁAŃCUCH:');
// weles -> swaróg -> perun daje OBA kombosy po kolei. To jest celowe
// i hojne: gracz nie może "zmarnować" pieczęci, więc nakładające się
// sekwencje mają się nakładać, a nie wykluczać.
const k5 = new KomboSilnik();
k5.dodaj('weles', 0);
const pierwsze = k5.dodaj('swarog', 400);
const drugie = k5.dodaj('perun', 800);
spr(`łańcuch daje Zew (${pierwsze?.id})`, pierwsze?.id === 'zewPodziemia');
spr(`i zaraz Grom (${drugie?.id})`, drugie?.id === 'gromWOgniu');

console.log('\nBRAK PODWÓJNEGO ODPALENIA:');
const k6 = new KomboSilnik();
k6.dodaj('swarog', 0);
k6.dodaj('perun', 400);
const powtorka = k6.dodaj('perun', 800);
spr('powtórzenie ostatniej pieczęci nie odpala kombo drugi raz', powtorka === null);

console.log('\nODPORNOŚĆ:');
const k7 = new KomboSilnik();
spr('nieznane id nie wywraca silnika', k7.dodaj('nieistnieje', 0) === null);
spr('NaN jako czas nie wywraca silnika', k7.dodaj('swarog', NaN) === null);
spr('tabela kombosów jest niepusta', KOMBOSY.length >= 2);

// --- SEKWENCJA Z POWTÓRZONYM ID: szczur -> szczur ---
console.log('\nPOWTÓRZONA PIECZĘĆ W SEKWENCJI (szczur x2):');
const k8 = new KomboSilnik();
spr('pierwszy szczur nie odpala', k8.dodaj('szczur', 0) === null);
const aard1 = k8.dodaj('szczur', 900);
spr(`drugi szczur odpala Aard (${aard1?.id})`, aard1?.id === 'aard');
// Dopasowanie do KOŃCÓWKI bufora: trzeci szczur znów tworzy parę [s,s].
// To jest CELOWE zachowanie łańcuchów ("nakładające się sekwencje mają się
// nakładać") - ten assert dokumentuje je jawnie, żeby nikt nie "naprawił"
// go przypadkiem. Ponowne uzbrojenie uzbrojonej techniki to no-op.
const aard2 = k8.dodaj('szczur', 1800);
spr(`trzeci szczur odpala PONOWNIE - jawne zachowanie łańcucha (${aard2?.id})`, aard2?.id === 'aard');

// --- POLE uzbraja ---
// main.js routuje po nim techniki; wiersz bez tego pola uzbroiłby złą technikę.
spr('każdy kombos deklaruje, którą technikę uzbraja',
    KOMBOSY.every(k => k.uzbraja === 'ogien' || k.uzbraja === 'aard'));

process.exit(ok ? 0 : 1);
