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
 *
 * ================== WYJĄTEK: WODA JEST KONIUNKCJĄ ==================
 *
 * Woda jest jedyną pieczęcią, której ŻADNA pojedyncza miara nie rozdziela
 * pozy od tańca - rozdziela je dopiero SPEŁNIENIE WSZYSTKICH NARAZ (patrz
 * komentarz przy `progiWody` niżej). Próg ZERO każdej miary wody bierze się
 * z NAJBLIŻSZEJ populacji, która na tej osi musi milczeć - a to NIE zawsze
 * jest taniec (ta sama zasada, co przy paśmie ognia). Dla `miska` sąsiadem
 * jest taniec przesiany resztą warunków wody (percentyl warunkowy). Dla
 * `glebokosc` i `kierunekPalcow` sąsiadem są POZOSTAŁE CZTERY PIECZĘCIE -
 * taniec na tych dwóch osiach albo odpowiada na złe pytanie (głębokość:
 * ręce opuszczone w tańcu schodzą głębiej niż miska), albo po przesianiu
 * zostawia zbyt mało klatek, żeby cokolwiek znaczyć.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { skalaCiala, aktualizujSkale, resetSkali, widoczne,
         BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P } from '../js/znaki/postawa.js';
import { odleglosc, nadBarkami } from '../js/znaki/styk.js';
import { pelnaDlon, kierunekDloni } from '../js/znaki/dlon.js';

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
    //   DOL_ZERO   = p50 próbek WODY         GORA_ZERO  = p90 próbek TAŃCA
    // Zasada: ogień milczy dokładnie tam, gdzie mieszka NAJBLIŻSZY BYT, który
    // musi milczeć po tej stronie osi - "sąsiad" to nie zawsze ta sama poza
    // z obu stron. Od dołu sąsiadem jest woda (miska leży niżej niż taniec
    // - taniec.p10 wysokości to ok. -1.44, więc wzięcie go dałoby ogniowi
    // ~0.6 NA MISCE WODY, czyli dokładnie kolizję, którą pasmo ma naprawić;
    // p50 wody zostaje). Od góry NAJBLIŻSZYM sąsiadem jest sam TANIEC, nie
    // iglica błyskawicy: p90 wysokości tańca (~0.38) leży bliżej pasma niż
    // p25 błyskawicy (1.098) - branie iglicy jako sufitu zostawiało rampę
    // górną ~8x szerszą niż plateau pełni, więc ogień punktował ~0.5 przy
    // rękach uniesionych ot tak, w zakresie zwykłego tańca (0 klatek tańca
    // nad progiem przy suficie ~0.0-0.3, ale 8 klatek wracało przy suficie
    // ~1.1). Taniec jako sufit usuwa to całkowicie.
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

    // woda: głębokość, kształt miski i kierunek palców. Warunek miski
    // ZOSTAJE - zmierzono, że zmniejsza wyciek do tańca z 37 do 14 klatek.
    // `styk` (odległość nadgarstków) USUNIĘTA: zmierzono, że w tańcu
    // nadgarstki schodzą się BLIŻEJ (taniec p10 = 0.364) niż w misce
    // (poza p75 = 0.864) - landmark nadgarstka siedzi w stawie, nie w dłoni,
    // więc "styk nadgarstków" mierzył coś innego niż zamierzony dotyk dłoni.
    // Ta sama sytuacja co z wysokością w ziemi i rozchyleniem w powietrzu -
    // warunek mierzył odwrotność tego, co miał mierzyć.
    // `kierunekPalcow` DOŁĄCZONA: SUROWY (nieprzycięty) `kierunekDloni(lm).y`
    // z dlon.js, minimum po widocznych PEŁNYCH dłoniach (pelnaDlon) -
    // konserwatywnie wymaga, żeby OBIE dłonie leżały poziomo, nie tylko
    // jedna. Dodatni = palce w dół obrazu, ujemny = w górę. Pierwsza wersja
    // tej miary (`palceWDol`, USUNIĘTA) brała `skierowanaWGore`, czyli
    // `Math.max(0, -y)` - PRZYCIĘTY sygnał: każda dłoń nie skierowana w górę
    // ląduje na tej samej wartości 0, więc `1-x` lądowało na tej samej
    // wartości 1 i żaden percentyl nie miał czego rozróżniać (PELNY=ZERO=
    // 1.000 dokładnie, wpięte dawałoby dzielenie przez zero w rampa()).
    // Surowy `y` nie ma tego przycięcia: zmierzone mediany na tym materiale
    // - woda +0.707, ogień -0.974, ziemia -0.950, powietrze -0.993. Woda
    // jest jedyną pieczęcią po DODATNIEJ stronie, z ogromnym marginesem.
    // Liczona tylko na klatkach z co najmniej jedną pełną dłonią - klatki
    // bez dłoni po prostu nie wchodzą do próbki tej miary, tak jak dziś nie
    // wchodzą klatki bez pozy.
    woda: (wl, s, frame) => {
        const dlonie = (frame?.hands ?? []).filter(d => pelnaDlon(d.landmarks));
        return {
            glebokosc: -Math.max(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s)),
            miska: (odleglosc(wl, LOKIEC_L, LOKIEC_P) - odleglosc(wl, NADG_L, NADG_P)) / s,
            kierunekPalcow: dlonie.length
                ? Math.min(...dlonie.map(d => kierunekDloni(d.landmarks).y))
                : NaN
        };
    },

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
const ROSNACE = new Set(['wysokosc', 'glebokosc', 'miska', 'wysNadg', 'wysLok', 'kierunekPalcow']);

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

/**
 * Klatki jednego powtórzenia -> tablica zestawów miar. Pomija pierwsze 0.5 s.
 * `funkcja` dostaje CAŁĄ odtworzoną klatkę jako trzeci argument, żeby dało
 * się czytać landmarki dłoni (potrzebne przez woda.kierunekPalcow) - miary, które
 * jej nie potrzebują, po prostu ją ignorują (JS nie wymaga zadeklarowania
 * parametru, żeby go pominąć).
 */
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
        wynik.push(funkcja(wl, skalaCiala(wl), frame));
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
 * wody) i wysoko (ręce uniesione w tańcu). Stąd cztery progi zamiast dwóch,
 * wszystkie z danych:
 *
 *   DOL_PELNY  = p05 próbek ognia   GORA_PELNY = p95 próbek ognia
 *   DOL_ZERO   = p50 próbek wody    GORA_ZERO  = p90 próbek TAŃCA
 *
 * Zasada "milczy tam, gdzie mieszka sąsiad" zostaje - zmienia się tylko to,
 * KTO jest sąsiadem od góry. Pierwsza wersja brała p25 błyskawicy (iglica
 * nad głową) jako sufit: dawało to rampę górną ~8x szerszą niż plateau
 * pełni (sufit 1.098 wobec plateau -0.542..-0.351), więc ogień punktował
 * ~0.5 przy rękach uniesionych na wysokość zwykłego tańca - w zakresie,
 * w którym gracz zwyczajnie się rusza, nie tylko w pieczęci. Zmierzone:
 * przy suficie ~0.0-0.3 ogień miał 0 klatek tańca nad progiem; dopiero
 * sufit rzędu 1.1 (iglica) przywracał 8. Taniec sam jest BLIŻSZYM sąsiadem
 * od góry niż iglica (p90 wysokości tańca ~0.38 wobec p25 błyskawicy
 * 1.098), więc to on musi wyznaczać granicę - dokładnie tak samo, jak
 * dolna granica bierze wodę, a NIE taniec (taniec.p10 wysokości ~-1.44 dałby
 * ogniowi ~0.6 na misce wody, czyli kolizję, którą pasmo ma naprawić).
 * "Sąsiad" znaczy więc: najbliższy byt, który musi milczeć po TEJ stronie
 * osi - nie zawsze ta sama poza z obu stron.
 *
 * "próbki wody" i "próbki tańca" liczone TĄ SAMĄ funkcją co ogień
 * (MIARY.ogien zaaplikowane do klatek etykietowanych 'woda#'/'taniec#'),
 * dokładnie tak, jak `zbierz(kroki, 'taniec', funkcja)` liczy próg tańca dla
 * każdej innej miary - to ten sam mechanizm, inne etykiety wejściowe.
 */
function pasmoOgnia(kroki) {
    const zOgnia = zbierz(kroki, 'ogien', MIARY.ogien);
    const zWody = zbierz(kroki, 'woda', MIARY.ogien);
    const zTaniec = zbierz(kroki, 'taniec', MIARY.ogien);
    const wOgnia = zOgnia.wszystkie.wysokosc ?? [];
    const wWody = zWody.wszystkie.wysokosc ?? [];
    const wTaniec = zTaniec.wszystkie.wysokosc ?? [];

    const dolPelny = percentyl(wOgnia, 5);
    const goraPelny = percentyl(wOgnia, 95);
    const dolZero = percentyl(wWody, 50);
    const goraZero = percentyl(wTaniec, 90);

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
                `   taniec n=${String(wTaniec.length).padStart(4)} p90=${Number.isFinite(goraZero) ? goraZero.toFixed(3) : 'brak'}` +
                `${zle ? '   ⚠ OBSZARY ZACHODZĄ - zmień POZĘ, nie liczbę' : ''}`);

    if (zle) konflikt = true;
    const ostrzezenie = zle ? `  ${OSTRZEZENIE_ZACHODZENIA}` : '';

    const pola = [
        `        WYSOKOSC_DOL_PELNY: ${dolPelny.toFixed(3)},  // ${opisProby(zOgnia.proby)}, p05, n=${wOgnia.length}${ostrzezenie}`,
        `        WYSOKOSC_GORA_PELNY: ${goraPelny.toFixed(3)},  // ${opisProby(zOgnia.proby)}, p95, n=${wOgnia.length}${ostrzezenie}`,
        `        WYSOKOSC_DOL_ZERO: ${Number.isFinite(dolZero) ? dolZero.toFixed(3) : 0},  // ${opisProby(zWody.proby)}, p50, n=${wWody.length}${ostrzezenie}`,
        `        WYSOKOSC_GORA_ZERO: ${Number.isFinite(goraZero) ? goraZero.toFixed(3) : 99},  // ${opisProby(zTaniec.proby)}, p90, n=${wTaniec.length}${ostrzezenie}`
    ];
    linie.push(`    ogien: {\n${pola.join('\n')}\n    },`);
}

/** Cztery pieczęcie inne niż woda - pula, z której woda bierze ZERO na
 *  osiach, gdzie NIE taniec jest najbliższym sąsiadem (patrz progiWody). */
const INNE_PIECZECIE = ['ogien', 'ziemia', 'powietrze', 'blyskawica'];

/**
 * Próbki jednej miary MIARY.woda, zaaplikowanej do klatek POZOSTAŁYCH
 * czterech pieczęci zamiast do wody - dokładnie ten sam mechanizm, którym
 * `zbierz(kroki, 'taniec', funkcja)` liczy próg ZERO z tańca gdzie indziej
 * w tym pliku, tylko inne etykiety wejściowe (cztery pozy, nie taniec).
 */
function pulaInnychPieczeci(kroki, pole) {
    let wartosci = [];
    let proby = [];
    for (const poza of INNE_PIECZECIE) {
        const z = zbierz(kroki, poza, MIARY.woda);
        wartosci = wartosci.concat(z.wszystkie[pole] ?? []);
        proby = proby.concat(z.proby);
    }
    return { wartosci, proby };
}

/**
 * ================== WODA - PRZYPADEK SZCZEGÓLNY: KONIUNKCJA ==================
 * Woda jest jedyną pieczęcią w tym zestawie, której ŻADNA pojedyncza miara
 * nie rozdziela pozy od tańca - rozdziela je dopiero SPEŁNIENIE WSZYSTKICH
 * TRZECH NARAZ (głębokość, miska, kierunek palców). Osobno każda miara
 * przepuszcza spory kawałek tańca; razem, na tym samym nagraniu, zostawiają
 * garstkę rozproszonych klatek bez ciągu dłuższego niż ułamek sekundy przy
 * wymaganych ~0.9 s składania - podczas gdy dwa z trzech powtórzeń samej
 * wody trzymają pełne 4 s ciągiem.
 *
 * Generyczna reguła PELNY/ZERO (patrz nagłówek pliku) bierze próg ZERO danej
 * miary z CAŁEGO tańca. Dla pieczęci koniunkcyjnej to bywa złe pytanie:
 * pyta "gdzie ta JEDNA oś zaczyna wyglądać jak taniec", a taniec na
 * pojedynczej osi naprawdę bywa blisko wody. Właściwa reguła jest szersza
 * niż "zawsze bierz taniec" - to ta sama zasada, co w paśmie ognia (patrz
 * `pasmoOgnia`): próg ZERO danej osi bierze się z NAJBLIŻSZEJ populacji,
 * która na tej osi MUSI milczeć. Dla wody ta populacja jest RÓŻNA dla
 * różnych miar:
 *
 *   - `miska`: sąsiadem jest TANIEC PRZESIANY resztą warunków wody -
 *     PERCENTYL WARUNKOWY, próg liczony tylko z klatek tańca, które już
 *     mają POZOSTAŁE dwie miary >= ich własny PELNY. Na tej osi to
 *     wystarcza: zachodzenie znika (zmierzone niżej).
 *   - `glebokosc` i `kierunekPalcow`: sąsiadem NIE jest taniec. Taniec z
 *     rękami opuszczonymi wzdłuż ciała schodzi GŁĘBIEJ niż miska - branie
 *     go dawało odwróconą parę (PELNY < ZERO, woda punktowałaby tym niżej,
 *     im głębiej trzymana miska). Nawet przesiany resztą warunków, taniec
 *     zostawiał na tych dwóch osiach ledwie garstkę klatek (zmierzone: 13 i
 *     6 na tym materiale) - bo wciąż odpowiada na złe pytanie, nie dlatego,
 *     że koniunkcja nie działa. NAJBLIŻSZYM sąsiadem, który tu musi
 *     milczeć, są POZOSTAŁE CZTERY PIECZĘCIE (ogień, ziemia, powietrze,
 *     błyskawica) - wszystkie płytsze od miski i wszystkie z innym
 *     kierunkiem dłoni. Próg ZERO to p90 z ich POOLOWANEJ próbki
 *     (`pulaInnychPieczeci`).
 *
 * PELNY każdej z trzech miar liczony jak zawsze - p25 z próbek POZY wody.
 * Zmienia się WYŁĄCZNIE źródło strony ZERO, per miara.
 *
 * Jeśli mimo to któraś miara NADAL zachodzi z odpowiednim sąsiadem, to jest
 * prawdziwy wynik pomiaru, nie usterka reguły - próg zostaje z ostrzeżeniem,
 * nienaginany. Ostateczny werdykt dla wody i tak wyda test rozdzielności na
 * nagraniach (zadanie 12) na prawdziwym silniku składania pieczęci; to
 * narzędzie jest sitem wstępnym, nie ostatecznym.
 */
function progiWody(kroki) {
    const NAZWY = ['glebokosc', 'miska', 'kierunekPalcow'];
    const zPoza = zbierz(kroki, 'woda', MIARY.woda);
    const zTaniec = zbierz(kroki, 'taniec', MIARY.woda);
    // Per-klatkowe zestawy miar tańca - potrzebne w komplecie (nie osobne
    // tablice per pole, jak `wszystkie`), żeby warunkować `miska` wartościami
    // POZOSTAŁYCH miar Z TEJ SAMEJ KLATKI.
    const klatkiTanca = zTaniec.proby.flatMap(p => p.miary);

    const pelny = {};
    for (const nazwa of NAZWY) {
        pelny[nazwa] = percentyl(zPoza.wszystkie[nazwa] ?? [], 25);
    }

    // miska: percentyl warunkowy z tańca (patrz komentarz funkcji).
    const inneDlaMiski = NAZWY.filter(n => n !== 'miska');
    const tanczecPrzeszedl = klatkiTanca.filter(f =>
        inneDlaMiski.every(i => Number.isFinite(f[i]) && f[i] >= pelny[i]));
    const miskaZeroTab = tanczecPrzeszedl.map(f => f.miska).filter(Number.isFinite);

    // glebokosc i kierunekPalcow: pula pozostałych czterech pieczęci.
    const pulaGlebokosc = pulaInnychPieczeci(kroki, 'glebokosc');
    const pulaKierunek = pulaInnychPieczeci(kroki, 'kierunekPalcow');

    const zero = {
        glebokosc: percentyl(pulaGlebokosc.wartosci, 90),
        miska: percentyl(miskaZeroTab, 90),
        kierunekPalcow: percentyl(pulaKierunek.wartosci, 90)
    };
    const nZero = {
        glebokosc: pulaGlebokosc.wartosci.length,
        miska: miskaZeroTab.length,
        kierunekPalcow: pulaKierunek.wartosci.length
    };
    const zrodloZeroPlik = {
        glebokosc: opisProby(pulaGlebokosc.proby),
        miska: `taniec warunkowy (spełnia ${inneDlaMiski.join(' i ')} >= PELNY)`,
        kierunekPalcow: opisProby(pulaKierunek.proby)
    };
    const zrodloZeroKonsola = {
        glebokosc: INNE_PIECZECIE.join('+'),
        miska: `taniec|${inneDlaMiski.join('+')}`,
        kierunekPalcow: INNE_PIECZECIE.join('+')
    };
    // "warunkowa" = pula z tańca przesianego resztą warunków wody - mała
    // z natury, bo sito zadziałało (DOBRA wiadomość, tak MA wyglądać dobra
    // koniunkcja). "surowa" = pula z pozostałych czterech pieczęci wprost -
    // mała TYLKO jeśli brakuje nagrań (ZŁA wiadomość, trzeba dograć). Ten
    // sam próg MIN_KLATEK ma więc inną treść ostrzeżenia w każdym przypadku.
    const typPuli = { glebokosc: 'surowa', miska: 'warunkowa', kierunekPalcow: 'surowa' };

    console.log(`\nWODA (koniunkcja - przypadek szczególny, ZERO od najbliższej milczącej populacji):`);
    const pola = [];
    for (const nazwa of NAZWY) {
        const nPoza = (zPoza.wszystkie[nazwa] ?? []).length;
        const zle = !(pelny[nazwa] > zero[nazwa]);
        const zaMalo = nZero[nazwa] < MIN_KLATEK;
        if (zle || zaMalo) konflikt = true;

        const komZaMalo = typPuli[nazwa] === 'warunkowa'
            ? '⚠ MAŁO KLATEK PO WARUNKOWANIU (dobra wiadomość: sito zadziałało) - próg z małej próbki, dograj krok 8 dla pewności'
            : '⚠ MAŁO KLATEK W PULI POZOSTAŁYCH PIECZĘCI (zła wiadomość: brakuje nagrań) - dograj kroki 1/2/3/4';

        console.log(`  ${nazwa.padEnd(16)} poza n=${String(nPoza).padStart(4)} p25 = ${pelny[nazwa].toFixed(3)}` +
                    `   ${zrodloZeroKonsola[nazwa]} n=${String(nZero[nazwa]).padStart(4)} p90 = ${Number.isFinite(zero[nazwa]) ? zero[nazwa].toFixed(3) : 'brak'}` +
                    `${zle ? '   ⚠ OBSZARY ZACHODZĄ - zmień POZĘ, nie liczbę' : ''}` +
                    `${zaMalo ? `   ${komZaMalo}` : ''}`);

        const N = nazwa.toUpperCase();
        const ostrzezeniePelny = zle ? `  ${OSTRZEZENIE_ZACHODZENIA}` : '';
        const ostrzezenieZero = zle ? `  ${OSTRZEZENIE_ZACHODZENIA}` : (zaMalo ? `  ${komZaMalo}` : '');
        pola.push(`        ${N}_PELNY: ${pelny[nazwa].toFixed(3)},  // ${opisProby(zPoza.proby)}, p25, n=${nPoza}${ostrzezeniePelny}`);
        pola.push(`        ${N}_ZERO: ${Number.isFinite(zero[nazwa]) ? zero[nazwa].toFixed(3) : 0},  // ${zrodloZeroPlik[nazwa]}, p90, n=${nZero[nazwa]}${ostrzezenieZero}`);
    }
    linie.push(`    woda: {\n${pola.join('\n')}\n    },`);
}

console.log('\n=== PROGI ===');
for (const [poza, funkcja] of Object.entries(MIARY)) {
    if (poza === 'ogien') {
        // Pasmo, nie para PELNY/ZERO - patrz pasmoOgnia() i komentarz nad nią.
        pasmoOgnia(kroki);
        continue;
    }
    if (poza === 'woda') {
        // Koniunkcja, ZERO warunkowe - patrz progiWody() i komentarz nad nią.
        progiWody(kroki);
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
