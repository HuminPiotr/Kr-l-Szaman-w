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
import { KomboSilnik, KOMBOSY, OKNO_MS } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// Wszystkie znane wartości `uzbraja` - każda ma gałąź w js/techniki.js.
// Nowa technika = nowy wpis tutaj (wcześniej ta lista była powielona w dwóch asercjach).
const ZNANE_UZBRAJA = ['ogien', 'aard', 'tecza', 'gromWZiemie', 'kolowrot', 'dym', 'kamiennaTarcza', 'kurzawa', 'lukPeruna', 'kregiMokoszy', 'mglaMokoszy'];

console.log('DOPASOWANIE SEKWENCJI:');
const k1 = new KomboSilnik();
spr('pierwsza pieczęć nie odpala kombo', k1.dodaj('swarog', 0) === null);
const grom = k1.dodaj('perun', 800);
spr(`swaróg -> perun odpala Grom w Ogniu (${grom?.id})`, grom?.id === 'gromWOgniu');

console.log('\nBUFOR NIE JEST CZYSZCZONY ZA POMYŁKĘ:');
const k2 = new KomboSilnik();
// Pieczęć "nie ta" na START bufora: mokosz, po którym idzie swarog - para
// mokosz->swarog nie jest żadnym combo. (Do 2026-10-02 był tu weles, ale
// Kamienna Tarcza - weles×3 - sprawiła, że weles ZACZYNA sekwencję.)
k2.dodaj('mokosz', 0);
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
spr('każdy kombos deklaruje, którą technikę uzbraja (ZNANE_UZBRAJA)',
    KOMBOSY.every(k => ZNANE_UZBRAJA.includes(k.uzbraja)));

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
spr('każdy kombos deklaruje znaną technikę (ZNANE_UZBRAJA)',
    KOMBOSY.every(k => ZNANE_UZBRAJA.includes(k.uzbraja)));

// --- ZIEMIA (weles) DOSTAJE PIERWSZY KOMBOS: GROM W ZIEMIĘ ---
console.log('\nZIEMIA (weles) DOSTAJE PIERWSZY KOMBOS - Grom w Ziemię (swarog -> weles -> perun):');
const k10 = new KomboSilnik();
spr('pierwszy element (swarog) nie odpala', k10.dodaj('swarog', 0) === null);
spr('drugi element (weles) nie odpala (jeszcze za krótka sekwencja)', k10.dodaj('weles', 500) === null);
const gromZiemia = k10.dodaj('perun', 1000);
spr(`trzeci element (perun) odpala Grom w Ziemię (${gromZiemia?.id})`, gromZiemia?.id === 'gromWZiemie');
// ZASTĄPIONE (2026-10-02, proste combo): niezmiennik "weles nigdy nie
// zaczyna" przestał być prawdą (Kamienna Tarcza = weles×3). Pilnujemy
// tego, na czym naprawdę opiera się silnik: żadna sekwencja nie jest
// PREFIKSEM ani SUFIKSEM innej - inaczej krótsza odpalałaby się w środku
// dłuższej albo _dopasuj() (pierwszy pasujący wpis) wybierałby po cichu.
const jestPrefiksem = (krotszy, dluzszy) =>
    dluzszy.length > krotszy.length && dluzszy.slice(0, krotszy.length).join() === krotszy.join();
const jestSufiksemCalej = (krotszy, dluzszy) =>
    dluzszy.length > krotszy.length && dluzszy.slice(-krotszy.length).join() === krotszy.join();
spr('żadna sekwencja nie jest prefiksem ani sufiksem innej',
    KOMBOSY.every(a => KOMBOSY.every(b => a === b ||
        (!jestPrefiksem(a.sekwencja, b.sekwencja) && !jestSufiksemCalej(a.sekwencja, b.sekwencja)))));
spr('żadne dwie techniki nie mają identycznej sekwencji',
    new Set(KOMBOSY.map(k => k.sekwencja.join())).size === KOMBOSY.length);

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

// --- aktywne(now): odczyt dla paska sekwencji (js/sekwencja.js), NIE MUTUJE ---
console.log('\nAKTYWNE(now) - odczyt paska sekwencji:');
const k14 = new KomboSilnik();
k14.dodaj('swarog', 0);
k14.dodaj('weles', 1000);
const przedOdczytem = k14.bufor.length;
const akt = k14.aktywne(2000);
spr(`aktywne() zwraca oba wpisy wewnątrz okna (${akt.length})`, akt.length === 2);
spr('aktywne() NIE mutuje bufora', k14.bufor.length === przedOdczytem);

const poOknie = k14.aktywne(2000 + OKNO_MS + 1);
spr('aktywne() poza OKNO_MS zwraca pustą listę mimo że bufor jeszcze nieprzycięty',
    poOknie.length === 0 && k14.bufor.length === przedOdczytem);

spr('aktywne(NaN) nie rzuca, zwraca pustą listę', k14.aktywne(NaN).length === 0);

console.log('\nAKTYWNE(now) NIE CZYŚCI SIĘ PO TRAFIENIU KOMBO (łańcuch dalej widoczny):');
const k15 = new KomboSilnik();
k15.dodaj('perun', 0);
k15.dodaj('weles', 500);
const kolowrotTrafil = k15.dodaj('mokosz', 1000);
spr(`perun -> weles -> mokosz odpala Kołowrót (${kolowrotTrafil?.id})`, kolowrotTrafil?.id === 'kolowrot');
spr('pasek po trafieniu combo dalej pokazuje wszystkie trzy sloty',
    k15.aktywne(1200).length === 3);

console.log('\nKAMIENNA TARCZA (weles × 3):');
const k20 = new KomboSilnik();
spr('pierwszy weles nie odpala', k20.dodaj('weles', 0) === null);
spr('drugi weles nie odpala', k20.dodaj('weles', 500) === null);
spr('trzeci weles odpala Kamienną Tarczę', k20.dodaj('weles', 1000)?.id === 'kamiennaTarcza');
spr('czwarty weles odpala PONOWNIE (łańcuch)', k20.dodaj('weles', 1500)?.id === 'kamiennaTarcza');

console.log('\nKURZAWA (stribog -> weles) i łańcuch z Tarczą:');
const k21 = new KomboSilnik();
k21.dodaj('stribog', 0);
spr('stribog -> weles odpala Kurzawę', k21.dodaj('weles', 500)?.id === 'kurzawa');
k21.dodaj('weles', 1000);
spr('...a dwa kolejne welesy - Kamienną Tarczę', k21.dodaj('weles', 1500)?.id === 'kamiennaTarcza');

console.log('\nŁUK PERUNA (mokosz -> perun) i łańcuch z Kołowrotem:');
const k22 = new KomboSilnik();
k22.dodaj('perun', 0); k22.dodaj('weles', 500);
spr('perun->weles->mokosz odpala Kołowrót', k22.dodaj('mokosz', 1000)?.id === 'kolowrot');
spr('...a dołożony perun - Łuk Peruna', k22.dodaj('perun', 1500)?.id === 'lukPeruna');

console.log('\nWODNA KULA (mokosz -> weles) - rozgałęzienie po mokosz:');
const k23 = new KomboSilnik();
k23.dodaj('mokosz', 0);
spr('mokosz -> weles odpala Kręgi Mokoszy', k23.dodaj('weles', 500)?.id === 'kregiMokoszy');
const k24 = new KomboSilnik();
k24.dodaj('mokosz', 0);
spr('mokosz -> perun odpala Łuk (ta sama pierwsza pieczęć, inna technika)', k24.dodaj('perun', 500)?.id === 'lukPeruna');

console.log('\nMGŁA MOKOSZY (stribog -> mokosz):');
const k25 = new KomboSilnik();
k25.dodaj('stribog', 0);
spr('stribog -> mokosz odpala Mgłę Mokoszy', k25.dodaj('mokosz', 500)?.id === 'mglaMokoszy');
const k26 = new KomboSilnik();
k26.dodaj('swarog', 0); k26.dodaj('mokosz', 500);
spr('Tęcza (swarog->mokosz->stribog) nadal odpala - odwrotna para nie koliduje', k26.dodaj('stribog', 1000)?.id === 'tecza');

process.exit(ok ? 0 : 1);
