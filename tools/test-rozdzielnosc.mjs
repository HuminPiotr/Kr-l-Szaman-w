// tools/test-rozdzielnosc.mjs
/**
 * Rozdzielność pieczęci na NAGRANIACH ŻYWEGO CIAŁA.
 *
 *   node tools/test-rozdzielnosc.mjs
 *
 * Cztery poprzednie generacje znaków przechodziły testy headless na danych
 * syntetycznych i zawodziły na kamerze. Ten plik zamyka tę lukę: chodzi po
 * nagraniach z tools/probki/ i przepuszcza je przez PRAWDZIWY silnik
 * składania, nie przez własną atrapę.
 *
 * Trzy sprawdzenia, w rosnącej kolejności ważności:
 *
 *   1. POZY TRZYMANE - docelowa pieczęć wygrywa z marginesem.
 *   2. TANIEC - przez swobodny taniec nie składa się ANI JEDNA pieczęć.
 *      To jest wymaganie właściciela projektu wyrażone wprost.
 *   3. PRZEJŚCIA - sekwencja wykonana płynnie daje dokładnie tyle złożeń,
 *      ile pieczęci, w tej kolejności, i odpala kombos.
 *
 * Punkt 3 jest WAŻNIEJSZY od punktu 1. Pozy trzymane są rozdzielne
 * z konstrukcji; przejścia nie są, a to przez nie gracz przechodzi za
 * każdym razem.
 *
 * ================== SCALANIE PRÓBEK: TAK SAMO JAK tools/progi.mjs ==================
 *
 * Ten test NIE wymyśla własnego mechanizmu scalania nagrań - kopiuje ten
 * z tools/progi.mjs (sekcja "SPECJALNY PRZYPADEK: BŁYSKAWICA" w tamtym
 * pliku), bo tam już jest rozwiązany i przetestowany.
 *
 * Powód: etykieta "blyskawica#1..3" żyje w TRZECH plikach próbek pod TRZEMA
 * różnymi pozami tej samej pieczęci - dwie porzucone (zygzak bokiem, chwyt
 * za łokieć) i jedna ostateczna (iglica nad głową). Naiwne scalenie "po
 * etykiecie, z każdego pliku" zmieszałoby wszystkie trzy pod jedną nazwą
 * i dałoby fałszywie czerwony (albo fałszywie zielony - z tej pieczęci nic
 * by nie wygrywało z marginesem) wynik bez znaczenia. Bierzemy WYŁĄCZNIE
 * plik z najpóźniejszym `utworzono` spośród plików zawierających tę
 * etykietę - "najświeższe nagranie wygrywa w całości".
 *
 * Druga konsekwencja tego samego mechanizmu: każda etykieta wraca jako
 * TABLICA FRAGMENTÓW (jeden na plik źródłowy), nie płaska tablica klatek.
 * "taniec#1" żyje w DWÓCH plikach (osobne 30 s nagranie samego tańca +
 * ogon pełnego scenariusza) - sklejenie ich klatek w jedną tablicę PRZED
 * przepuszczeniem przez silnik przeniosłoby wygładzoną skalę EMA (i stan
 * pierścienia składania) z końca pierwszego nagrania na początek drugiego.
 * To DOKŁADNIE błąd, który resetSkali() ma wykluczyć (patrz test-styk.mjs)
 * - progi.mjs dostał ten sam problem i rozwiązał go, mierząc każdy fragment
 * OSOBNO. Ten test robi to samo: każdy fragment dostaje własny resetSkali(),
 * własny ZnakRegistry, własne SkladaniePieczeci i własny KomboSilnik, jakby
 * to były niezależne przebiegi - a wyniki (złożone pieczęcie, techniki,
 * średnie wyników) dopiero POTEM się łączy.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { ZnakRegistry } from '../js/znaki/registry.js';
import { resetSkali, aktualizujSkale } from '../js/znaki/postawa.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { weles } from '../js/znaki/weles.js';
import { perun } from '../js/znaki/perun.js';
import { stribog } from '../js/znaki/stribog.js';
import { mokosz } from '../js/znaki/mokosz.js';
import { SkladaniePieczeci } from '../js/pieczecie.js';
import { KomboSilnik } from '../js/kombosy.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const MARGINES_LIDERA = 0.12;   // musi zgadzać się z pieczecie.js
const PROG_POSTAWY = 0.5;

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// Nagranie kroku -> identyfikator pieczęci, której oczekujemy.
const OCZEKIWANE = {
    ogien: 'swarog', ziemia: 'weles', blyskawica: 'perun',
    powietrze: 'stribog', woda: 'mokosz'
};

function rejestr() {
    const r = new ZnakRegistry();
    for (const z of [swarogDlon, weles, perun, stribog, mokosz]) r.zarejestruj(z);
    return r;
}

/** Wczytanie próbek z plików + scalanie po etykiecie - patrz nagłówek pliku. */
function wczytaj() {
    let pliki = [];
    try { pliki = readdirSync(KATALOG).filter(f => f.endsWith('.json')); } catch { /* pusto */ }
    if (!pliki.length) {
        console.log('  ⚠ BRAK NAGRAŃ w tools/probki/ - ten test nic nie sprawdza.');
        console.log('    Nagraj sesję klawiszem Z w grze i przenieś plik do tools/probki/.');
        process.exit(1);
    }

    const wczytane = pliki.map(f => {
        const dane = JSON.parse(readFileSync(join(KATALOG, f), 'utf8'));
        return { plik: f, utworzono: dane.utworzono, kroki: dane.kroki };
    });

    // Błyskawica: bierzemy WYŁĄCZNIE plik z najpóźniejszym `utworzono`
    // spośród tych, które w ogóle zawierają "blyskawica#*" - patrz nagłówek.
    const zBlyskawica = wczytane
        .filter(p => Object.keys(p.kroki).some(e => e.startsWith('blyskawica#')))
        .sort((a, b) => new Date(b.utworzono) - new Date(a.utworzono));
    const najnowszyBlyskawica = zBlyskawica[0]?.plik;
    if (zBlyskawica.length > 1) {
        console.log(`(błyskawica: ${zBlyskawica.length} plików zawiera tę etykietę - używam tylko najnowszego: ${najnowszyBlyskawica})`);
    }

    // kroki[etykieta] = TABLICA FRAGMENTÓW (jeden na plik źródłowy) - patrz
    // nagłówek pliku, dlaczego to NIE jest płaska tablica klatek.
    const kroki = {};
    for (const p of wczytane) {
        for (const [etykieta, klatki] of Object.entries(p.kroki)) {
            if (etykieta.startsWith('blyskawica#') && p.plik !== najnowszyBlyskawica) {
                continue; // nieaktualna/porzucona poza - patrz nagłówek
            }
            (kroki[etykieta] ??= []).push({ plik: p.plik, klatki });
        }
    }
    return kroki;
}

/** Przepuszcza JEDEN fragment (klatki z jednego pliku) przez rejestr + prawdziwy silnik składania. */
function przepuscFragment(klatki) {
    resetSkali();
    const znaki = rejestr();
    const skladanie = new SkladaniePieczeci();
    const kombosy = new KomboSilnik();
    const zlozone = [], techniki = [];
    let czas = 0, sumaWynikow = null, liczbaOcen = 0;
    // Diagnostyka DODATKOWA, nie asercja: jak BLISKO złożenia podchodzi
    // każda pieczęć nawet wtedy, gdy formalnie się nie składa. Bez tego
    // "0 złożeń w tańcu" brzmi jak bezpieczny margines, a bywa, że pierścień
    // dochodzi do 90%+ napełnienia przypadkiem, tuż pod linią - patrz
    // sekcja 2 i raport zadania. Nie jest to nowy próg do zdania/oblania,
    // tylko liczba do zgłoszenia właścicielowi projektu.
    const maxWynik = {}, maxPostep = {};

    for (const zapisana of klatki) {
        const frame = odtworzKlatke(zapisana);
        czas += frame.dt;
        aktualizujSkale(frame.pose?.worldLandmarks ?? null, frame.dt);
        const wyniki = znaki.ocen(frame);
        for (const [k, v] of Object.entries(wyniki)) {
            if (v > (maxWynik[k] ?? 0)) maxWynik[k] = v;
        }

        // Moc na maksimum: sprawdzamy ROZDZIELNOŚĆ, nie ekonomię gry.
        // Brak mocy zatrzymałby pierścień i schował prawdziwy wynik testu.
        const skl = skladanie.update(wyniki, 1, frame.dt);
        if (skl.skladana && skl.postep > (maxPostep[skl.skladana] ?? 0)) {
            maxPostep[skl.skladana] = skl.postep;
        }
        if (skl.zlozona) {
            zlozone.push(skl.zlozona.id);
            const t = kombosy.dodaj(skl.zlozona.id, czas * 1000);
            if (t) techniki.push(t.id);
        }

        if (czas < 0.5) continue;   // dochodzenie do pozy
        sumaWynikow ??= Object.fromEntries(Object.keys(wyniki).map(k => [k, 0]));
        for (const k of Object.keys(wyniki)) sumaWynikow[k] += wyniki[k];
        liczbaOcen += 1;
    }

    return { zlozone, techniki, sumaWynikow: sumaWynikow ?? {}, liczbaOcen, czas, maxWynik, maxPostep };
}

/**
 * Przepuszcza WSZYSTKIE fragmenty jednej etykiety - każdy własnym, świeżym
 * przebiegiem silnika (patrz nagłówek pliku) - i scala wyniki w jeden.
 * Kolejność złożeń/technik zachowuje kolejność fragmentów (kolejność
 * wczytania plików z katalogu), co dla pojedynczego fragmentu (większość
 * etykiet) nie ma znaczenia.
 */
function przepusc(fragmenty) {
    const zlozone = [], techniki = [];
    const sumaWynikowLaczna = {}, maxWynikLaczny = {}, maxPostepLaczny = {};
    let liczbaOcenLaczna = 0, czasLaczny = 0;

    for (const { klatki } of fragmenty) {
        const r = przepuscFragment(klatki);
        zlozone.push(...r.zlozone);
        techniki.push(...r.techniki);
        czasLaczny += r.czas;
        liczbaOcenLaczna += r.liczbaOcen;
        for (const [k, v] of Object.entries(r.sumaWynikow)) {
            sumaWynikowLaczna[k] = (sumaWynikowLaczna[k] ?? 0) + v;
        }
        for (const [k, v] of Object.entries(r.maxWynik)) {
            if (v > (maxWynikLaczny[k] ?? 0)) maxWynikLaczny[k] = v;
        }
        for (const [k, v] of Object.entries(r.maxPostep)) {
            if (v > (maxPostepLaczny[k] ?? 0)) maxPostepLaczny[k] = v;
        }
    }

    const srednie = {};
    for (const k of Object.keys(sumaWynikowLaczna)) srednie[k] = sumaWynikowLaczna[k] / Math.max(1, liczbaOcenLaczna);
    return { zlozone, techniki, srednie, czas: czasLaczny, maxWynik: maxWynikLaczny, maxPostep: maxPostepLaczny };
}

/** "swarog, swarog, mokosz, mokosz, mokosz" -> "swarog, mokosz" - do diagnostyki przejść. */
const zwiniete = (tab) => tab.filter((id, i) => id !== tab[i - 1]);

const kroki = wczytaj();
const etykiety = (prefiks) => Object.keys(kroki).filter(e => e.startsWith(prefiks + '#'));

console.log('1. POZY TRZYMANE - docelowa pieczęć wygrywa z marginesem:');
for (const [krok, oczekiwany] of Object.entries(OCZEKIWANE)) {
    for (const e of etykiety(krok)) {
        const { srednie } = przepusc(kroki[e]);
        const pary = Object.entries(srednie).sort((a, b) => b[1] - a[1]);
        const [lider, wLider] = pary[0] ?? ['brak', 0];
        const [drugi, wDrugi] = pary[1] ?? ['brak', 0];
        spr(`${e.padEnd(14)} lider ${lider} ${wLider.toFixed(2)} (drugi ${drugi} ${wDrugi.toFixed(2)})`,
            lider === oczekiwany && wLider > PROG_POSTAWY && wLider - wDrugi > MARGINES_LIDERA);
    }
}

console.log('\n2. TANIEC - nic się nie składa samo:');
for (const e of etykiety('taniec')) {
    const { zlozone, czas, maxWynik, maxPostep } = przepusc(kroki[e]);
    spr(`${e}: ${czas.toFixed(0)} s tańca, złożonych pieczęci: ${zlozone.length ? zlozone.join(', ') : 'żadna'}`,
        zlozone.length === 0);
    // Informacyjnie, NIE asercja (patrz komentarz przy maxWynik w
    // przepuscFragment): jak blisko złożenia podszedł pierścień mimo że
    // formalnie nic się nie złożyło. "0 złożeń" może kryć bliski niemal-wypadek.
    for (const id of Object.keys(maxWynik).sort((a, b) => (maxPostep[b] ?? 0) - (maxPostep[a] ?? 0))) {
        console.log(`      ${id.padEnd(8)} szczyt wyniku ${maxWynik[id].toFixed(2)}   szczyt napełnienia pierścienia ${(maxPostep[id] ?? 0).toFixed(2)}`);
    }
}

console.log('\n3. PRZEJŚCIA - pierścień nie miga między pieczęciami:');
const PRZEJSCIA = {
    'przejscie-ogien-woda-powietrze': { ciag: ['swarog', 'mokosz', 'stribog'], kombos: 'tecza' },
    'przejscie-ziemia-powietrze': { ciag: ['weles', 'stribog'], kombos: null }
};
for (const [prefiks, { ciag, kombos }] of Object.entries(PRZEJSCIA)) {
    for (const e of etykiety(prefiks)) {
        const { zlozone, techniki } = przepusc(kroki[e]);
        spr(`${e}: złożone [${zlozone.join(' → ') || 'nic'}] = oczekiwane [${ciag.join(' → ')}]`,
            zlozone.length === ciag.length && zlozone.every((id, i) => id === ciag[i]));
        // Informacyjnie: ciąg ze zwiniętymi powtórzeniami z rzędu. Odróżnia
        // "zła kolejność/brak pieczęci" (realny problem rozpoznawania) od
        // "dobra kolejność, tylko trzymana za długo powtórzyła złożenie"
        // (przy moc=1 z tego testu to spodziewane - patrz raport zadania).
        const zw = zwiniete(zlozone);
        console.log(`      po zwinięciu powtórzeń z rzędu: [${zw.join(' → ') || 'nic'}]`);
        if (kombos) {
            spr(`${e}: odpalił kombos ${kombos}`, techniki.includes(kombos));
        }
    }
}

process.exit(ok ? 0 : 1);
