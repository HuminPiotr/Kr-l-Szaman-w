// tools/progi.mjs
/**
 * Progi pieczęci wyliczone z NAGRAŃ ŻYWEGO CIAŁA.
 *
 *   node tools/progi.mjs --raport     # co jest w próbkach, bez zapisu
 *   node tools/progi.mjs --zapisz     # generuje js/znaki/progi-zmierzone.js
 *
 * POWÓD ISTNIENIA: cztery poprzednie generacje znaków weszły do gry ze
 * stałymi oznaczonymi ZGADNIĘTE i żadna nie została zmierzona na ciele
 * gracza. To narzędzie zamienia nagranie w liczby, a strojenie - w zmianę
 * REGUŁY wyprowadzania, nie w poprawianie liczby ręcznie.
 *
 * ================== REGUŁA WYPROWADZANIA ==================
 *
 * Dla miary, która przy poprawnej pozie jest MAŁA (każdy styk):
 *
 *   PELNY = percentyl 75 z powtórzeń tej pozy
 *       -> trzy czwarte Twoich wykonań dostaje pełny wynik
 *   ZERO  = percentyl 10 z próbki TAŃCA dla tej samej miary
 *       -> wynik gaśnie, zanim wejdzie w obszar, w którym żyje taniec
 *
 * Dla miary, która przy poprawnej pozie jest DUŻA (wysokości, kąt rozwarcia):
 * te same percentyle w odwrotnych rolach.
 *
 * Jeśli PELNY >= ZERO, obszary pozy i tańca ZACHODZĄ NA SIEBIE - żaden próg
 * ich nie rozdzieli. To jest wynik, nie usterka narzędzia: znaczy, że poza
 * jest za blisko naturalnego tańca i trzeba zmienić POZĘ, nie liczbę.
 * Narzędzie krzyczy o tym wprost.
 *
 * ================== WYJĄTEK: PASMO OGNIA ==================
 *
 * ogien.wysokosc NIE jest rampą jak wszystko inne - jest PASMEM (patrz
 * komentarz przy MIARY.ogien niżej). Cztery progi tej jednej miary są
 * liczone osobną ścieżką (funkcja `pasmoOgnia`), bo pary PELNY/ZERO nie da
 * się do tego wygiąć bez udawania, że to coś innego, niż jest.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { skalaCiala, aktualizujSkale, resetSkali, widoczne,
         BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P } from '../js/znaki/postawa.js';
import { odleglosc, nadBarkami } from '../js/znaki/styk.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const WYJSCIE = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'znaki', 'progi-zmierzone.js');

/**
 * Miary liczone z każdej klatki. Nazwa miary staje się nazwą pary progów
 * w wygenerowanym pliku: `styk` -> `STYK_PELNY` / `STYK_ZERO`.
 */
const MIARY = {
    // ================== ZESTAW PO POMIARZE ==================
    // Ten zestaw NIE jest tym, co pierwotnie opisywał spec. Każda różnica
    // wynika z nagrania na żywym ciele (tools/probki/, 2026-09-03) i jest
    // uzasadniona w sekcji "Poprawki po pomiarze" przy zadaniach 7-10.
    // Miary, które nie rozdzielały pozy od tańca, zostały USUNIĘTE, a nie
    // przestrojone - próg nie naprawia warunku mierzącego nie to, co trzeba.

    // ogień: jedyna nowa miara to WYSOKOŚĆ. Warunki dłoni (palce, opuszki,
    // rozstaw nadgarstków) zostają w swarogDlon.js ze swoimi stałymi.
    // Bez wysokości ogień zapalał się na misce wody częściej niż na własnej
    // piramidce - 179/322 klatek wobec 107/299 (zmierzone).
    // UWAGA: wysokość ognia to PASMO, nie rampa - jedyna taka miara w tym
    // narzędziu. Sama podłoga nie wystarcza, bo piramidka NAD GŁOWĄ (iglica
    // błyskawicy) też jest "wysoko": zmierzono, że przy samej podłodze ogień
    // zapala się na 223 z 333 klatek iglicy. Pasmo zeruje to całkowicie
    // i przy okazji usuwa 8 przypadkowych klatek tańca.
    //
    // Cztery progi pasma, wszystkie z danych, żaden z sufitu:
    //   DOL_PELNY  = p05 próbek ognia        GORA_PELNY = p95 próbek ognia
    //   DOL_ZERO   = p50 próbek WODY         GORA_ZERO  = p25 próbek BŁYSKAWICY
    // Czyli: ogień milczy dokładnie tam, gdzie mieszkają jego dwaj sąsiedzi
    // na tej osi. To uogólnienie zasady "rozdziela oś, której nie używa nic
    // innego" - tu oś jest wspólna, więc granice bierzemy od sąsiadów.
    ogien: (wl, s) => ({
        wysokosc: Math.max(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s))
    }),

    // ziemia: sam styk pięści z przeciwnym barkiem. Pierwotny warunek
    // "nadgarstki na wysokości barków lub wyżej" USUNIĘTY: zmierzono, że
    // przy pięściach na barkach nadgarstki leżą 0.5 szerokości barków PONIŻEJ
    // linii barków, a taniec sięga wyżej (p90 -0.21). Warunek mierzył
    // odwrotność tego, co miał mierzyć. Sam styk daje 0.99 we własnym kroku
    // i 0 klatek tańca nad progiem.
    ziemia: (wl, s) => ({
        styk: Math.max(odleglosc(wl, NADG_L, BARK_P), odleglosc(wl, NADG_P, BARK_L)) / s
    }),

    // powietrze: styk łokci plus wysokość nadgarstków. Pierwotny warunek
    // "rozchylenie" (nadgarstki szerzej niż łokcie) USUNIĘTY: zmierzono
    // wartość UJEMNĄ (-0.43), czyli gracz trzyma nadgarstki BLIŻEJ siebie
    // niż łokcie - dokładnie odwrotnie, niż zakładał projekt.
    powietrze: (wl, s) => ({
        styk: odleglosc(wl, LOKIEC_L, LOKIEC_P) / s,
        wysokosc: Math.min(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s))
    }),

    // woda: styk nadgarstków, głębokość i kształt miski. Warunek miski
    // ZOSTAJE - zmierzono, że zmniejsza wyciek do tańca z 37 do 14 klatek.
    woda: (wl, s) => ({
        styk: odleglosc(wl, NADG_L, NADG_P) / s,
        glebokosc: -Math.max(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s)),
        miska: (odleglosc(wl, LOKIEC_L, LOKIEC_P) - odleglosc(wl, NADG_L, NADG_P)) / s
    }),

    // błyskawica: DWIE miary, obie z pozy. Trzecia poza tej pieczęci -
    // dwie poprzednie (zygzak bokiem, chwyt za łokieć) padły na pomiarze.
    // Oś nośna to WYSOKOŚĆ ŁOKCI. Poprzednia wersja tego komentarza (brief
    // task-6) podawała +0.13 - liczba nie do odtworzenia z tych nagrań:
    // ani z oczyszczonego zestawu (tylko najnowszy plik, patrz
    // wczytajProbki), gdzie WYSLOK_PELNY (p25) wychodzi +0.53, ani ze
    // ślepego scalenia wszystkich trzech źródeł błyskawicy, gdzie wychodzi
    // -0.52. +0.13 jest więc pozostałością sprzed ostatecznego pomiaru -
    // nie liczbą do odtworzenia, tylko starym numerem, który to narzędzie
    // ma zastąpić zmierzonym. Piramidka nad głową jest kwalifikatorem
    // z dłoni i NIE MA TU SWOJEGO PROGU - liczy ją swarogDlon ze swoimi
    // stałymi.
    blyskawica: (wl, s) => ({
        wysNadg: Math.min(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s)),
        wysLok: Math.min(nadBarkami(wl, LOKIEC_L, s), nadBarkami(wl, LOKIEC_P, s))
    })
};

/** Które miary rosną przy poprawnej pozie (a nie maleją). */
const ROSNACE = new Set(['wysokosc', 'glebokosc', 'miska', 'wysNadg', 'wysLok']);

/** Minimalna liczba klatek, poniżej której percentyl to szum, nie pomiar. */
const MIN_KLATEK = 300;

function wczytajProbki() {
    let pliki;
    try {
        pliki = readdirSync(KATALOG).filter(f => f.endsWith('.json'));
    } catch {
        console.error(`BRAK KATALOGU ${KATALOG}. Najpierw nagraj sesję (klawisz Z w grze).`);
        process.exit(1);
    }
    if (!pliki.length) {
        console.error(`BRAK NAGRAŃ w ${KATALOG}. Najpierw nagraj sesję (klawisz Z w grze).`);
        process.exit(1);
    }

    const wczytane = pliki.map(f => {
        const dane = JSON.parse(readFileSync(join(KATALOG, f), 'utf8'));
        return { plik: f, utworzono: dane.utworzono, kroki: dane.kroki };
    });

    // ================== SPECJALNY PRZYPADEK: BŁYSKAWICA ==================
    // Poza błyskawicy przeszła przeprojektowanie MIĘDZY nagraniami (patrz
    // styk.js:21-28: dwie wcześniejsze wersje pozy - zygzak bokiem, chwyt za
    // łokieć - odpadły po pomiarze i dostały nową pozę: iglica nad głową).
    // Etykieta "blyskawica#1..3" istnieje w TRZECH plikach próbek, ale te
    // pliki NIE mierzą tej samej pozy. Zmierzono (patrz raport, oś "wysokość
    // łokci nad barkami" - MIARY.blyskawica.wysLok):
    //
    //   - pełny scenariusz (probki-...-18-04-18.json): średnio -0.51..-0.71 -
    //     TA SAMA wysokość, co u wszystkich pozostałych pieczęci (ręce NIE
    //     są uniesione). To nagranie sprzed przeprojektowania pozy.
    //   - starsze osobne dogranie (...-18-21-24.json): niespójne - jedno
    //     powtórzenie dodatnie (+0.45), dwa ujemne (-0.11, -0.13) - dochodzenie
    //     do nowej pozy, dwie porzucone próby w trakcie.
    //   - najnowsze osobne dogranie (...-18-41-44.json): spójnie dodatnie
    //     (+0.53..+0.63 każde z trzech powtórzeń) - właściwa poza (iglica).
    //
    // Ślepe scalanie po etykiecie zmieszałoby trzy różne pozy pod jedną
    // nazwą i zatruło progi błyskawicy (dokładnie ostrzeżenie z briefu).
    // Zamiast scalać wszystkie źródła, dla etykiet "blyskawica#*" bierzemy
    // WYŁĄCZNIE plik z najpóźniejszym `utworzono` spośród plików, które w
    // ogóle zawierają tę etykietę - "najświeższe nagranie wygrywa w całości",
    // nie liczba ani próba wybrana ręcznie. `utworzono` to pole zapisane
    // przez samo nagranie (zapis.js), nie znacznik czasu z nazwy pliku.
    const zBlyskawica = wczytane
        .filter(p => Object.keys(p.kroki).some(e => e.startsWith('blyskawica#')))
        .sort((a, b) => new Date(b.utworzono) - new Date(a.utworzono));
    const najnowszyBlyskawica = zBlyskawica[0]?.plik;
    if (zBlyskawica.length > 1) {
        console.log(`(błyskawica: ${zBlyskawica.length} plików zawiera tę etykietę - używam tylko najnowszego: ${najnowszyBlyskawica})`);
    }

    // kroki[etykieta] = TABLICA FRAGMENTÓW, jeden na plik źródłowy, NIE
    // płaska tablica klatek. Ten sam label ("taniec#1") żyje w dwóch
    // plikach (pełny scenariusz + osobny taniec) - sklejenie ich w jedną
    // tablicę PRZED pomiarem przeniosłoby wygładzoną skalę EMA z końca
    // pierwszego nagrania na początek drugiego (dokładnie błąd, który
    // resetSkali() ma wykluczyć - patrz test-styk.mjs) i ukryłoby rozgrzewkę
    // drugiego pliku pod filtrem "pierwsze 0.5 s", bo ten filtr widziałby
    // tylko początek sklejonej tablicy, nie początek KAŻDEGO nagrania.
    // Fragmenty mierzy się osobno (zmierz() na każdym, własny resetSkali()
    // i własne 0.5 s rozgrzewki), a dopiero WYNIKI pomiaru łączy się
    // w zbierz().
    const kroki = {};
    for (const p of wczytane) {
        for (const [etykieta, klatki] of Object.entries(p.kroki)) {
            if (etykieta.startsWith('blyskawica#') && p.plik !== najnowszyBlyskawica) {
                continue; // nieaktualna/porzucona poza - patrz komentarz wyżej
            }
            (kroki[etykieta] ??= []).push({ plik: p.plik, klatki });
        }
    }
    return kroki;
}

/** Klatki jednego powtórzenia -> tablica zestawów miar. Pomija pierwsze 0.5 s. */
function zmierz(klatki, funkcja) {
    resetSkali();
    const wynik = [];
    let czas = 0;
    for (const zapisana of klatki) {
        const frame = odtworzKlatke(zapisana);
        czas += frame.dt;
        const wl = frame.pose?.worldLandmarks;
        if (!wl || !widoczne(wl, [BARK_L, BARK_P])) continue;
        aktualizujSkale(wl, frame.dt);
        // Pierwsze pół sekundy to dochodzenie do pozy, nie poza.
        if (czas < 0.5) continue;
        if (!widoczne(wl, [NADG_L, NADG_P, LOKIEC_L, LOKIEC_P])) continue;
        wynik.push(funkcja(wl, skalaCiala(wl)));
    }
    return wynik;
}

const percentyl = (tab, p) => {
    if (!tab.length) return NaN;
    const s = [...tab].sort((a, b) => a - b);
    return s[Math.max(0, Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1))))];
};

function zbierz(kroki, prefiks, funkcja) {
    const etykiety = Object.keys(kroki).filter(e => e.startsWith(prefiks + '#'));
    // Jedno powtórzenie (etykieta) może mieć więcej niż jeden fragment,
    // gdy ten sam krok nagrano w dwóch sesjach (np. taniec#1). Każdy
    // fragment mierzony OSOBNO - patrz komentarz w wczytajProbki().
    const proby = etykiety.flatMap(e => kroki[e].map(({ plik, klatki }) =>
        ({ etykieta: e, plik, miary: zmierz(klatki, funkcja) })));
    const wszystkie = {};
    for (const { miary } of proby) {
        for (const m of miary) {
            for (const [k, v] of Object.entries(m)) {
                if (Number.isFinite(v)) (wszystkie[k] ??= []).push(v);
            }
        }
    }
    return { proby, wszystkie };
}

/**
 * Prowenienacja dla komentarza w PLIKU WYNIKOWYM - z których etykiet i
 * z których plików nagrań pochodzi tablica próbek. To jest sedno tego,
 * dlaczego narzędzie generuje plik zamiast liczb wklejanych ręcznie
 * (patrz nagłówek): każda stała ma w pliku widoczne źródło, nie tylko
 * w konsoli, która znika po zamknięciu terminala.
 */
function opisProby(proby) {
    if (!proby.length) return 'brak próbek';
    const etykiety = [...new Set(proby.map(p => p.etykieta))].sort();
    const pliki = [...new Set(proby.map(p => p.plik))].sort();
    return `${etykiety.join(', ')} (${pliki.join(', ')})`;
}

const OSTRZEZENIE_ZACHODZENIA =
    '⚠ OBSZARY ZACHODZĄ - PELNY i ZERO NIE rozdzielają pozy od tańca (patrz task-6-report.md). NIE WPINAĆ bez zmiany POZY.';

const kroki = wczytajProbki();
const zapisz = process.argv.includes('--zapisz');

console.log('=== CO JEST W PRÓBKACH ===');
for (const [etykieta, fragmenty] of Object.entries(kroki).sort()) {
    const klatki = fragmenty.flatMap(f => f.klatki);
    const zPoza = klatki.filter(k => k.poza).length;
    const udzial = klatki.length ? zPoza / klatki.length : 0;
    const zroda = fragmenty.length > 1 ? ` (${fragmenty.length} nagrania)` : '';
    const flaga = udzial < 0.8 ? '  ⚠ MAŁO KLATEK Z POZĄ - rozważ dogranie' : '';
    console.log(`  ${etykieta.padEnd(38)} ${String(klatki.length).padStart(4)} kl.  poza ${(udzial * 100).toFixed(0)}%${zroda}${flaga}`);
}

const linie = [];
let konflikt = false;

/**
 * ================== PASMO OGNIA - PRZYPADEK SZCZEGÓLNY ==================
 * ogien.wysokosc nie rozdziela pozy od tańca parą (PELNY, ZERO) jak każda
 * inna miara w tym narzędziu - musi milczeć PO OBU STRONACH: nisko (miska
 * wody) i wysoko (iglica błyskawicy nad głową). Stąd cztery progi zamiast
 * dwóch, wszystkie z danych:
 *
 *   DOL_PELNY  = p05 próbek ognia   GORA_PELNY = p95 próbek ognia
 *   DOL_ZERO   = p50 próbek wody    GORA_ZERO  = p25 próbek błyskawicy
 *
 * "próbki wody" i "próbki błyskawicy" liczone TĄ SAMĄ funkcją co ogień
 * (MIARY.ogien zaaplikowane do klatek etykietowanych 'woda#'/'blyskawica#'),
 * dokładnie tak, jak `zbierz(kroki, 'taniec', funkcja)` liczy próg tańca dla
 * każdej innej miary - to ten sam mechanizm, inne etykiety wejściowe.
 */
function pasmoOgnia(kroki) {
    const zOgnia = zbierz(kroki, 'ogien', MIARY.ogien);
    const zWody = zbierz(kroki, 'woda', MIARY.ogien);
    const zBlyskawicy = zbierz(kroki, 'blyskawica', MIARY.ogien);
    const wOgnia = zOgnia.wszystkie.wysokosc ?? [];
    const wWody = zWody.wszystkie.wysokosc ?? [];
    const wBlyskawicy = zBlyskawicy.wszystkie.wysokosc ?? [];

    const dolPelny = percentyl(wOgnia, 5);
    const goraPelny = percentyl(wOgnia, 95);
    const dolZero = percentyl(wWody, 50);
    const goraZero = percentyl(wBlyskawicy, 25);

    // Brak zachodzenia = ZERO leży NA ZEWNĄTRZ pasma PELNY z każdej strony:
    // dolny zero musi być niższy niż dolny pełny, górny zero wyższy niż
    // górny pełny. Inaczej pasmo się zapada i nic go nie odróżnia od rampy.
    const zle = !(Number.isFinite(dolZero) && Number.isFinite(dolPelny) &&
                  Number.isFinite(goraZero) && Number.isFinite(goraPelny) &&
                  dolZero < dolPelny && dolPelny <= goraPelny && goraPelny < goraZero);

    // BEZ progu MIN_KLATEK tutaj celowo. Ten próg jest zdefiniowany dla
    // próbki TAŃCA (setki sekund swobodnego ruchu, więc mało klatek =
    // naprawdę mało danych). Żadna z trzech tablic w paśmie nie jest
    // tańcem - to próbki POZ (3 powtórzenia x ~100 klatek), które z
    // definicji nigdy nie osiągną setek klatek tańca. Narzucenie progu
    // 300 tutaj dawałoby ostrzeżenie niemożliwe do spełnienia żadnym
    // realnym nagraniem - to byłby dokładnie błąd, przed którym ostrzega
    // ten projekt: próg wymyślony, a nie wyprowadzony z tego, co dane
    // faktycznie mogą dać. Liczby próbek i tak są wypisane niżej jawnie.
    console.log(`\nOGIEN (pasmo wysokości - przypadek szczególny):`);
    console.log(`  wysokosc         ogien n=${String(wOgnia.length).padStart(4)} p05=${dolPelny.toFixed(3)} p95=${goraPelny.toFixed(3)}` +
                `   woda n=${String(wWody.length).padStart(4)} p50=${Number.isFinite(dolZero) ? dolZero.toFixed(3) : 'brak'}` +
                `   błyskawica n=${String(wBlyskawicy.length).padStart(4)} p25=${Number.isFinite(goraZero) ? goraZero.toFixed(3) : 'brak'}` +
                `${zle ? '   ⚠ OBSZARY ZACHODZĄ - zmień POZĘ, nie liczbę' : ''}`);

    if (zle) konflikt = true;
    const ostrzezenie = zle ? `  ${OSTRZEZENIE_ZACHODZENIA}` : '';

    const pola = [
        `        WYSOKOSC_DOL_PELNY: ${dolPelny.toFixed(3)},  // ${opisProby(zOgnia.proby)}, p05, n=${wOgnia.length}${ostrzezenie}`,
        `        WYSOKOSC_GORA_PELNY: ${goraPelny.toFixed(3)},  // ${opisProby(zOgnia.proby)}, p95, n=${wOgnia.length}${ostrzezenie}`,
        `        WYSOKOSC_DOL_ZERO: ${Number.isFinite(dolZero) ? dolZero.toFixed(3) : 0},  // ${opisProby(zWody.proby)}, p50, n=${wWody.length}${ostrzezenie}`,
        `        WYSOKOSC_GORA_ZERO: ${Number.isFinite(goraZero) ? goraZero.toFixed(3) : 99},  // ${opisProby(zBlyskawicy.proby)}, p25, n=${wBlyskawicy.length}${ostrzezenie}`
    ];
    linie.push(`    ogien: {\n${pola.join('\n')}\n    },`);
}

console.log('\n=== PROGI ===');
for (const [poza, funkcja] of Object.entries(MIARY)) {
    if (poza === 'ogien') {
        // Pasmo, nie para PELNY/ZERO - patrz pasmoOgnia() i komentarz nad nią.
        pasmoOgnia(kroki);
        continue;
    }
    const zPoza = zbierz(kroki, poza, funkcja);
    const zTaniec = zbierz(kroki, 'taniec', funkcja);
    const { wszystkie } = zPoza;
    const taniec = zTaniec.wszystkie;
    if (!Object.keys(wszystkie).length) {
        console.log(`\n${poza.toUpperCase()}: BRAK PRÓBEK - nagraj ten krok.`);
        konflikt = true;
        continue;
    }
    console.log(`\n${poza.toUpperCase()}:`);
    const pola = [];
    for (const [miara, wartosci] of Object.entries(wszystkie)) {
        const rosnaca = ROSNACE.has(miara);
        const pelny = percentyl(wartosci, rosnaca ? 25 : 75);
        const zero = percentyl(taniec[miara] ?? [], rosnaca ? 90 : 10);
        const zle = rosnaca ? !(pelny > zero) : !(pelny < zero);
        if (zle) konflikt = true;

        // LICZBA PRÓBEK jest częścią wyniku, nie ozdobą. `zbierz` odfiltrowuje
        // wartości nieskończone (brakujący punkt daje Infinity z odleglosc(),
        // a różnica dwóch takich - NaN), więc miara może po cichu zostać
        // z garstką próbek. Percentyl z krótkiej tablicy to szum, a zły próg
        // wyliczony z szumu wygląda dokładnie tak samo jak dobry.
        const nPoza = wartosci.length, nTaniec = (taniec[miara] ?? []).length;
        const zaMalo = nTaniec < MIN_KLATEK;
        if (zaMalo) konflikt = true;

        console.log(`  ${miara.padEnd(16)} poza n=${String(nPoza).padStart(4)} p${rosnaca ? 25 : 75} = ${pelny.toFixed(3)}` +
                    `   taniec n=${String(nTaniec).padStart(4)} p${rosnaca ? 90 : 10} = ${Number.isFinite(zero) ? zero.toFixed(3) : 'brak'}` +
                    `${zle ? '   ⚠ OBSZARY ZACHODZĄ - zmień POZĘ, nie liczbę' : ''}` +
                    `${zaMalo ? '   ⚠ ZA MAŁO KLATEK TAŃCA - dograj krok 8' : ''}`);
        const N = miara.toUpperCase();
        const ostrzezenie = zle ? `  ${OSTRZEZENIE_ZACHODZENIA}` : (zaMalo ? '  ⚠ ZA MAŁO KLATEK TAŃCA - próg ZERO to szum, dograj krok 8' : '');
        pola.push(`        ${N}_PELNY: ${pelny.toFixed(3)},  // ${opisProby(zPoza.proby)}, p${rosnaca ? 25 : 75}, n=${nPoza}${zle ? `  ${OSTRZEZENIE_ZACHODZENIA}` : ''}`);
        pola.push(`        ${N}_ZERO: ${Number.isFinite(zero) ? zero.toFixed(3) : (rosnaca ? 0 : 99)},  // ${opisProby(zTaniec.proby)}, p${rosnaca ? 90 : 10}, n=${nTaniec}${ostrzezenie}`);
    }
    linie.push(`    ${poza}: {\n${pola.join('\n')}\n    },`);
}

if (!zapisz) {
    console.log('\n(raport - nic nie zapisano; uruchom z --zapisz, żeby wygenerować plik)');
    process.exit(konflikt ? 1 : 0);
}

const tresc = `/**
 * PLIK GENEROWANY - nie edytuj ręcznie.
 *
 *   node tools/progi.mjs --zapisz
 *
 * Każda liczba pochodzi z nagrania żywego ciała w tools/probki/, nie
 * z wyobraźni. Reguła wyprowadzania i jej uzasadnienie: tools/progi.mjs.
 * Strojenie = zmiana reguły albo dogranie próbki, NIGDY ręczna poprawka
 * liczby tutaj - poprawiona ręcznie liczba jest znowu ZGADNIĘTA.
 *
 * Wygenerowano: ${new Date().toISOString()}
 * Powtórzenia w materiale: ${Object.keys(kroki).length}
 */
export const PROGI = {
${linie.join('\n')}
};
`;
writeFileSync(WYJSCIE, tresc);
console.log(`\nZapisano ${WYJSCIE}`);
process.exit(konflikt ? 1 : 0);
