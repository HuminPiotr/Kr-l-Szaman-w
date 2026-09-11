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
 * ID zaktualizowane pod piątą generację znaków (docs/superpowers/specs/
 * 2026-09-02-piec-pieczeci-styku-design.md): runy ('perun-otwarta',
 * 'mokosz-piesc', 'stribog-otwarta', ...) i kombos 'zewPodziemia' odeszły,
 * zastąpione wprost id-ami pięciu znaków ('swarog', 'weles', 'stribog',
 * 'mokosz', 'perun') i nową tabelą KOMBOSY ('tecza', 'gromWOgniu', 'aard').
 * Struktura testów (łańcuchy, brak podwójnego odpalenia, wygasanie) jest
 * niezależna od konkretnych id - sprawdza WYŁĄCZNIE silnik.
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
// 'weles' (ziemia) jest środkowym elementem Gromu w Ziemię, więc nadal
// ŚWIADOMIE nigdy nie ROZPOCZYNA żadnej sekwencji - idealna pieczęć "nie ta"
// na START bufora, bo żadne combo nie zaczyna się od welesa.
k2.dodaj('weles', 0);
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
k4.dodaj('stribog', 0);
const aardBasic = k4.dodaj('stribog', 600);
spr(`stribog x2 odpala Podmuch Striboga (${aardBasic?.id})`, aardBasic?.id === 'aard');

console.log('\nŁAŃCUCH:');
// swarog -> perun -> stribog -> stribog daje OBA kombosy po kolei. To jest
// celowe i hojne: gracz nie może "zmarnować" pieczęci, więc nakładające się
// sekwencje mają się nakładać, a nie wykluczać.
const k5 = new KomboSilnik();
k5.dodaj('swarog', 0);
const pierwsze = k5.dodaj('perun', 300);
spr(`łańcuch daje Grom (${pierwsze?.id})`, pierwsze?.id === 'gromWOgniu');
k5.dodaj('stribog', 700);   // pierwszy stribog: ogon [perun, stribog] nie pasuje do niczego
const drugie = k5.dodaj('stribog', 1100);
spr(`i zaraz Aard (${drugie?.id})`, drugie?.id === 'aard');

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

// --- SEKWENCJA Z POWTÓRZONYM ID: stribog x2 ---
console.log('\nPOWTÓRZONA PIECZĘĆ W SEKWENCJI (stribog x2):');
const k8 = new KomboSilnik();
spr('pierwszy stribog nie odpala', k8.dodaj('stribog', 0) === null);
const aard1 = k8.dodaj('stribog', 900);
spr(`drugi stribog odpala Aard (${aard1?.id})`, aard1?.id === 'aard');
// Dopasowanie do KOŃCÓWKI bufora: trzeci z rzędu znów tworzy parę [s,s].
// To jest CELOWE zachowanie łańcuchów ("nakładające się sekwencje mają się
// nakładać") - ten assert dokumentuje je jawnie, żeby nikt nie "naprawił"
// go przypadkiem. Ponowne uzbrojenie uzbrojonej techniki to no-op.
const aard2 = k8.dodaj('stribog', 1800);
spr(`trzeci stribog odpala PONOWNIE - jawne zachowanie łańcucha (${aard2?.id})`, aard2?.id === 'aard');

// Stribog x2 -> swarog dalej nie psuje niczego - sekwencje mają się
// nakładać, nie wykluczać.
const gromPoAard = k8.dodaj('swarog', 2200);
spr(`stribog x2 -> swarog nie psuje niczego (${gromPoAard})`, gromPoAard === null);

// --- POLE uzbraja ---
// main.js routuje po nim techniki; wiersz bez tego pola uzbroiłby złą technikę.
spr('każdy kombos deklaruje, którą technikę uzbraja',
    KOMBOSY.every(k => k.uzbraja === 'ogien' || k.uzbraja === 'aard' || k.uzbraja === 'tecza' ||
                        k.uzbraja === 'gromWZiemie' || k.uzbraja === 'kolowrot' || k.uzbraja === 'dym'));

// --- SEKWENCJA TRÓJELEMENTOWA: swarog -> mokosz -> stribog -> Tęcza ---
console.log('\nTRÓJELEMENTOWA SEKWENCJA (swarog -> mokosz -> stribog):');
const k9 = new KomboSilnik();
spr('pierwszy element (swarog) nie odpala', k9.dodaj('swarog', 0) === null);
spr('drugi element (mokosz) nie odpala (jeszcze za krótka sekwencja)', k9.dodaj('mokosz', 500) === null);
const tecza1 = k9.dodaj('stribog', 1000);
spr(`trzeci element (stribog) odpala Teczę (${tecza1?.id})`, tecza1?.id === 'tecza');

// Powtórzenie całej trójki od nowa odpala Teczę PONOWNIE - to samo celowe
// zachowanie łańcuchów co przy powtórzonym id (grom/aard), tylko na
// sekwencji trzech RÓŻNYCH pieczęci zamiast jednej powtórzonej.
k9.dodaj('swarog', 1500);
k9.dodaj('mokosz', 2000);
const tecza2 = k9.dodaj('stribog', 2500);
spr(`powtórna trójka odpala Teczę PONOWNIE (${tecza2?.id})`, tecza2?.id === 'tecza');

// Pole uzbraja obejmuje SZEŚĆ wartości.
spr('każdy kombos deklaruje, którą technikę uzbraja (ogien/aard/tecza/gromWZiemie/kolowrot/dym)',
    KOMBOSY.every(k => k.uzbraja === 'ogien' || k.uzbraja === 'aard' || k.uzbraja === 'tecza' ||
                        k.uzbraja === 'gromWZiemie' || k.uzbraja === 'kolowrot' || k.uzbraja === 'dym'));

// --- ZIEMIA (weles) DOSTAJE PIERWSZY KOMBOS: GROM W ZIEMIĘ ---
console.log('\nZIEMIA (weles) DOSTAJE PIERWSZY KOMBOS - Grom w Ziemię (swarog -> weles -> perun):');
const k10 = new KomboSilnik();
spr('pierwszy element (swarog) nie odpala', k10.dodaj('swarog', 0) === null);
spr('drugi element (weles) nie odpala (jeszcze za krótka sekwencja)', k10.dodaj('weles', 500) === null);
const gromZiemia = k10.dodaj('perun', 1000);
spr(`trzeci element (perun) odpala Grom w Ziemię (${gromZiemia?.id})`, gromZiemia?.id === 'gromWZiemie');
// ZASTĄPIONE (2026-09-09, Kołowrót): "dokładnie jedna sekwencja zawiera
// welesa" przestało być prawdą, gdy doszedł Kołowrót (perun->weles->mokosz) -
// weles występuje teraz w DWÓCH sekwencjach. Nowa asercja pilnuje
// NIEZMIENNIKA, na którym faktycznie opiera się reszta pliku: komentarz
// przy teście k2 wyżej ("idealna pieczęć »nie ta« na start bufora") zakłada,
// że weles NIGDY nie ROZPOCZYNA żadnej sekwencji - to musi zostać prawdą
// niezależnie od tego, ile sekwencji go zawiera.
spr('weles występuje w dwóch sekwencjach (Grom w Ziemię, Kołowrót) i w ŻADNEJ nie jest pierwszym elementem',
    KOMBOSY.filter(k => k.sekwencja.includes('weles')).length === 2 &&
    KOMBOSY.filter(k => k.sekwencja.includes('weles')).every(k => k.sekwencja[0] !== 'weles'));

// Powtórka całej trójki odpala PONOWNIE - to samo celowe zachowanie
// łańcuchów co przy Tęczy (k9) i powtórzonym id (k8).
k10.dodaj('swarog', 1500);
k10.dodaj('weles', 2000);
const gromZiemia2 = k10.dodaj('perun', 2500);
spr(`powtórna trójka odpala Grom w Ziemię PONOWNIE (${gromZiemia2?.id})`, gromZiemia2?.id === 'gromWZiemie');

// --- BRAK KOLIZJI SUFIKSÓW ---
// Grom w Ziemię nie może być przypadkowo dopasowany jako ogon innej
// sekwencji ani odwrotnie - inaczej _dopasuj() (bierze PIERWSZY pasujący
// wpis z tabeli) mógłby po cichu odpalić zły kombos.
console.log('\nBRAK KOLIZJI SUFIKSÓW:');
const jestSufiksem = (krotszy, dluzszy) =>
    dluzszy.length >= krotszy.length &&
    dluzszy.slice(-krotszy.length).join() === krotszy.join();
spr('sekwencja Gromu w Ziemię nie jest sufiksem żadnej innej i odwrotnie',
    KOMBOSY.filter(k => k.id !== 'gromWZiemie').every(k => {
        const a = k.sekwencja, b = KOMBOSY.find(x => x.id === 'gromWZiemie').sekwencja;
        return !jestSufiksem(a, b) && !jestSufiksem(b, a);
    }));

// --- KOŁOWRÓT: domknięcie mitu Gromu w Ziemię (perun -> weles -> mokosz) ---
console.log('\nKOŁOWRÓT (perun -> weles -> mokosz):');
const k11 = new KomboSilnik();
spr('pierwszy element (perun) nie odpala', k11.dodaj('perun', 0) === null);
spr('drugi element (weles) nie odpala (jeszcze za krótka sekwencja)', k11.dodaj('weles', 500) === null);
const kolowrot1 = k11.dodaj('mokosz', 1000);
spr(`trzeci element (mokosz) odpala Kołowrót (${kolowrot1?.id})`, kolowrot1?.id === 'kolowrot');

// Powtórka całej trójki odpala PONOWNIE - ten sam celowy wzorzec łańcucha
// co przy Tęczy (k9) i Gromie w Ziemię (k10).
k11.dodaj('perun', 1500);
k11.dodaj('weles', 2000);
const kolowrot2 = k11.dodaj('mokosz', 2500);
spr(`powtórna trójka odpala Kołowrót PONOWNIE (${kolowrot2?.id})`, kolowrot2?.id === 'kolowrot');

spr('sekwencja Kołowrotu nie jest sufiksem żadnej innej i odwrotnie',
    KOMBOSY.filter(k => k.id !== 'kolowrot').every(k => {
        const a = k.sekwencja, b = KOMBOSY.find(x => x.id === 'kolowrot').sekwencja;
        return !jestSufiksem(a, b) && !jestSufiksem(b, a);
    }));

// --- OKADZENIE: pierwsza technika kanałowana uzbrajana kombosem (swarog -> stribog -> swarog) ---
console.log('\nOKADZENIE (swarog -> stribog -> swarog):');
const k12 = new KomboSilnik();
spr('pierwszy element (swarog) nie odpala', k12.dodaj('swarog', 0) === null);
spr('drugi element (stribog) nie odpala (jeszcze za krótka sekwencja)', k12.dodaj('stribog', 500) === null);
const dym1 = k12.dodaj('swarog', 1000);
spr(`trzeci element (swarog) odpala Okadzenie (${dym1?.id})`, dym1?.id === 'dym');

spr('sekwencja Okadzenia nie jest sufiksem żadnej innej i odwrotnie',
    KOMBOSY.filter(k => k.id !== 'dym').every(k => {
        const a = k.sekwencja, b = KOMBOSY.find(x => x.id === 'dym').sekwencja;
        return !jestSufiksem(a, b) && !jestSufiksem(b, a);
    }));

// --- ŁAŃCUCH KRYTYCZNY DLA ROZGRYWKI: dym, potem zapałka ---
// Podpalenie dymu wymaga ognia, a ogień uzbraja SIĘ OSOBNYM combo (Grom w
// Ogniu) - więc gracz MUSI złożyć drugie combo na buforze, który już
// odpalił Okadzenie. To jest dokładnie sytuacja "kolejne combo kasuje
// poprzednie uzbrojenie" (main.js), ale NIE kasuje samego bufora - dopisanie
// 'perun' do ogona musi nadal trafić w Grom w Ogniu, bez czyszczenia niczego
// ręcznie. Bez tego testu regresja w _dopasuj() (np. zmiana kolejności
// wierszy KOMBOSY) mogłaby po cichu zablokować jedyną drogę do detonacji.
console.log('\nŁAŃCUCH: Okadzenie, zaraz potem Grom w Ogniu (dym -> zapałka):');
const k13 = new KomboSilnik();
k13.dodaj('swarog', 0);
k13.dodaj('stribog', 500);
const dym2 = k13.dodaj('swarog', 1000);
spr(`swarog -> stribog -> swarog odpala Okadzenie (${dym2?.id})`, dym2?.id === 'dym');
const zapalka = k13.dodaj('perun', 1400);
spr(`...i zaraz potem, bez czyszczenia bufora, perun odpala Grom w Ogniu (${zapalka?.id})`,
    zapalka?.id === 'gromWOgniu');

process.exit(ok ? 0 : 1);
