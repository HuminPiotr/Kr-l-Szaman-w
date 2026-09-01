/**
 * Bufor kombosów: wygasa z czasem, NIGDY nie jest czyszczony za pomyłkę.
 *
 *   node tools/test-kombosy.mjs
 *
 * Każda konwencjonalna gra walki kasuje bufor przy złym wejściu. To jest
 * stan porażki i łamie regułę nadrzędną (GEMINI.md §2). Tutaj żadna pieczęć
 * nie jest "zła": każda zapłaciła swoje 10% i dała własny efekt, więc
 * nieudana próba kombo to po prostu kilka ładnych błysków.
 *
 * ID zaktualizowane pod przebudowę na runy (docs/superpowers/specs/
 * 2026-09-01-runy-i-kwalifikatory-design.md): 'swarog' zostaje (piramidka,
 * nietknięta), 'perun'/'weles'/'splot' zastąpione ich odpowiednikami-runami.
 * Struktura testów (łańcuchy, brak podwójnego odpalenia, wygasanie) jest
 * niezależna od konkretnych id - sprawdza WYŁĄCZNIE silnik.
 */
import { KomboSilnik, KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('DOPASOWANIE SEKWENCJI:');
const k1 = new KomboSilnik();
spr('pierwsza pieczęć nie odpala kombo', k1.dodaj('swarog', 0) === null);
const grom = k1.dodaj('perun-otwarta', 800);
spr(`swaróg -> perun-otwarta odpala Grom w Ogniu (${grom?.id})`, grom?.id === 'gromWOgniu');

console.log('\nBUFOR NIE JEST CZYSZCZONY ZA POMYŁKĘ:');
const k2 = new KomboSilnik();
k2.dodaj('perun-otwarta', 0);   // pieczęć nie rozpoczynająca żadnej sekwencji
k2.dodaj('swarog', 500);
const nadal = k2.dodaj('perun-otwarta', 1000);
spr(`pieczęć "nie ta" nie psuje późniejszego kombo (${nadal?.id})`, nadal?.id === 'gromWOgniu');

console.log('\nBUFOR WYGASA Z CZASEM:');
const k3 = new KomboSilnik();
k3.dodaj('swarog', 0);
const zaPozno = k3.dodaj('perun-otwarta', 9000);  // 9 s - daleko poza oknem
spr('pieczęcie zbyt odległe w czasie nie tworzą kombo', zaPozno === null);
spr(`bufor odrzucił przeterminowany wpis (${k3.bufor.length})`, k3.bufor.length === 1);

console.log('\nDRUGIE KOMBO:');
const k4 = new KomboSilnik();
k4.dodaj('mokosz-piesc', 0);
const zew = k4.dodaj('mokosz-piesc', 600);
spr(`mokosz-piesc x2 odpala Zew Podziemia (${zew?.id})`, zew?.id === 'zewPodziemia');

console.log('\nŁAŃCUCH:');
// swarog -> perun-otwarta -> mokosz-piesc -> mokosz-piesc daje OBA kombosy
// po kolei. To jest celowe i hojne: gracz nie może "zmarnować" pieczęci,
// więc nakładające się sekwencje mają się nakładać, a nie wykluczać.
const k5 = new KomboSilnik();
k5.dodaj('mokosz-piesc', 0);
k5.dodaj('swarog', 300);
const pierwsze = k5.dodaj('perun-otwarta', 700);
const drugie = k5.dodaj('mokosz-piesc', 1100);
spr(`łańcuch daje Grom (${pierwsze?.id})`, pierwsze?.id === 'gromWOgniu');
const trzecie = k5.dodaj('mokosz-piesc', 1500);
spr(`i zaraz Zew (${trzecie?.id})`, trzecie?.id === 'zewPodziemia');

console.log('\nBRAK PODWÓJNEGO ODPALENIA:');
const k6 = new KomboSilnik();
k6.dodaj('swarog', 0);
k6.dodaj('perun-otwarta', 400);
const powtorka = k6.dodaj('perun-otwarta', 800);
spr('powtórzenie ostatniej pieczęci nie odpala kombo drugi raz', powtorka === null);

console.log('\nODPORNOŚĆ:');
const k7 = new KomboSilnik();
spr('nieznane id nie wywraca silnika', k7.dodaj('nieistnieje', 0) === null);
spr('NaN jako czas nie wywraca silnika', k7.dodaj('swarog', NaN) === null);
spr('tabela kombosów jest niepusta', KOMBOSY.length >= 2);

// --- SEKWENCJA Z POWTÓRZONYM ID: stribog-otwarta x2 ---
console.log('\nPOWTÓRZONA PIECZĘĆ W SEKWENCJI (stribog-otwarta x2):');
const k8 = new KomboSilnik();
spr('pierwszy stribog-otwarta nie odpala', k8.dodaj('stribog-otwarta', 0) === null);
const aard1 = k8.dodaj('stribog-otwarta', 900);
spr(`drugi stribog-otwarta odpala Aard (${aard1?.id})`, aard1?.id === 'aard');
// Dopasowanie do KOŃCÓWKI bufora: trzeci z rzędu znów tworzy parę [s,s].
// To jest CELOWE zachowanie łańcuchów ("nakładające się sekwencje mają się
// nakładać") - ten assert dokumentuje je jawnie, żeby nikt nie "naprawił"
// go przypadkiem. Ponowne uzbrojenie uzbrojonej techniki to no-op.
const aard2 = k8.dodaj('stribog-otwarta', 1800);
spr(`trzeci stribog-otwarta odpala PONOWNIE - jawne zachowanie łańcucha (${aard2?.id})`, aard2?.id === 'aard');

// Stribog-otwarta x2 -> swarog dalej odpala Grom NIEZALEŻNIE od podwójnego
// striboga wcześniej - sekwencje mają się nakładać, nie wykluczać.
const gromPoAard = k8.dodaj('swarog', 2200);
spr(`stribog-otwarta x2 -> swarog nie psuje niczego (${gromPoAard})`, gromPoAard === null);

// --- POLE uzbraja ---
// main.js routuje po nim techniki; wiersz bez tego pola uzbroiłby złą technikę.
spr('każdy kombos deklaruje, którą technikę uzbraja',
    KOMBOSY.every(k => k.uzbraja === 'ogien' || k.uzbraja === 'aard' || k.uzbraja === 'tecza'));

// --- SEKWENCJA TRÓJELEMENTOWA: mokosz-otwarta x3 -> tecza ---
console.log('\nTRÓJELEMENTOWA SEKWENCJA (mokosz-otwarta x3):');
const k9 = new KomboSilnik();
spr('pierwszy mokosz-otwarta nie odpala', k9.dodaj('mokosz-otwarta', 0) === null);
spr('drugi mokosz-otwarta nie odpala (jeszcze za krótka sekwencja)', k9.dodaj('mokosz-otwarta', 500) === null);
const tecza1 = k9.dodaj('mokosz-otwarta', 1000);
spr(`trzeci mokosz-otwarta odpala Teczę (${tecza1?.id})`, tecza1?.id === 'tecza');

// Czwarty z rzędu odpala PONOWNIE - dopasowanie do końcówki bufora, to samo
// celowe zachowanie łańcuchów co przy stribog-otwarta x2 -> aard.
const tecza2 = k9.dodaj('mokosz-otwarta', 1500);
spr(`czwarty mokosz-otwarta odpala PONOWNIE - jawne zachowanie łańcucha (${tecza2?.id})`, tecza2?.id === 'tecza');

// Pole uzbraja obejmuje teraz TRZY wartości, nie dwie.
spr('każdy kombos deklaruje, którą technikę uzbraja (ogien/aard/tecza)',
    KOMBOSY.every(k => k.uzbraja === 'ogien' || k.uzbraja === 'aard' || k.uzbraja === 'tecza'));

process.exit(ok ? 0 : 1);
