/**
 * Runy kreślone w powietrzu: rozdzielność kształtów, ciągłość wyniku,
 * niezmienniczości (skala/pozycja/tempo/punkt startu), kwalifikator dłoni,
 * odporność na brak danych.
 *
 *   node tools/test-runy.mjs
 *
 * Zobacz docs/superpowers/specs/2026-09-01-runy-i-kwalifikatory-design.md.
 */
import { resampluj, znormalizuj, znormalizujSlad, dopasuj, PUNKTY_SZABLONU } from '../js/runy/ksztalt.js';
import { SladNadgarstka, MAX_DLUGOSC_M, MAX_WIEK_S } from '../js/runy/slad.js';
import { SZABLONY } from '../js/runy/szablony.js';
import { stworzSlady, stworzZnakiRun, aktualizujSlady, DEFINICJE } from '../js/runy/definicje.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { dlon } from './_dlon-syntetyczna.mjs';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// --- Generatory kształtów syntetycznych (do testów, NIE szablony gry) ---

function kolo(promien = 0.15, n = 64, przesuniecieFazy = 0) {
    const pkt = [];
    for (let i = 0; i <= n; i++) {
        const t = przesuniecieFazy + (i / n) * Math.PI * 2;
        pkt.push({ x: promien * Math.cos(t), y: promien * Math.sin(t) });
    }
    return pkt;
}

function zygzakPionowy(n = 64, odwrocony = false) {
    const kontrolne = [
        { x: 0, y: -0.2 }, { x: 0.06, y: -0.1 }, { x: -0.06, y: 0 },
        { x: 0.06, y: 0.1 }, { x: 0, y: 0.2 }
    ];
    const lista = odwrocony ? [...kontrolne].reverse() : kontrolne;
    return gestoscUProbkuj(lista, n);
}

function falaPozioma(n = 64, odwrocona = false) {
    const kontrolne = [];
    for (let i = 0; i <= 8; i++) {
        const x = -0.2 + (i / 8) * 0.4;
        const y = 0.05 * Math.sin((i / 8) * Math.PI * 2);
        kontrolne.push({ x, y });
    }
    const lista = odwrocona ? [...kontrolne].reverse() : kontrolne;
    return gestoscUProbkuj(lista, n);
}

// Gęste próbkowanie odcinkami między punktami kontrolnymi - imituje strumień
// klatek z kamery (dużo bliskich sobie punktów), a nie rzadkie węzły.
function gestoscUProbkuj(kontrolne, n) {
    const wynik = [];
    for (let i = 0; i < kontrolne.length - 1; i++) {
        const a = kontrolne[i], b = kontrolne[i + 1];
        for (let j = 0; j < n; j++) {
            const t = j / n;
            wynik.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        }
    }
    wynik.push(kontrolne[kontrolne.length - 1]);
    return wynik;
}

function przesun(pkt, dx, dy) {
    return pkt.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

function przeskaluj(pkt, s) {
    return pkt.map(p => ({ x: p.x * s, y: p.y * s }));
}

function wynikDlaKsztaltu(pkt, szablon) {
    return dopasuj(znormalizujSlad(pkt), szablon);
}

console.log('ROZDZIELNOŚĆ KSZTAŁTÓW:');
{
    const kKolo = kolo();
    const kZygzak = zygzakPionowy();
    const kFala = falaPozioma();

    const wKoloNaKolo = wynikDlaKsztaltu(kKolo, SZABLONY.kolo);
    const wKoloNaZygzak = wynikDlaKsztaltu(kKolo, SZABLONY.zygzak);
    const wKoloNaFale = wynikDlaKsztaltu(kKolo, SZABLONY.fala);
    spr(`koło -> koło wysoki (${wKoloNaKolo.toFixed(2)})`, wKoloNaKolo > 0.8);
    spr(`koło -> zygzak niski (${wKoloNaZygzak.toFixed(2)})`, wKoloNaZygzak < wKoloNaKolo - 0.3);
    spr(`koło -> fala niski (${wKoloNaFale.toFixed(2)})`, wKoloNaFale < wKoloNaKolo - 0.3);

    const wZygzakNaZygzak = wynikDlaKsztaltu(kZygzak, SZABLONY.zygzak);
    const wZygzakNaKolo = wynikDlaKsztaltu(kZygzak, SZABLONY.kolo);
    const wZygzakNaFale = wynikDlaKsztaltu(kZygzak, SZABLONY.fala);
    spr(`zygzak -> zygzak wysoki (${wZygzakNaZygzak.toFixed(2)})`, wZygzakNaZygzak > 0.8);
    spr(`zygzak -> koło niski (${wZygzakNaKolo.toFixed(2)})`, wZygzakNaKolo < wZygzakNaZygzak - 0.3);
    spr(`zygzak -> fala niski (${wZygzakNaFale.toFixed(2)})`, wZygzakNaFale < wZygzakNaZygzak - 0.3);

    const wFalaNaFale = wynikDlaKsztaltu(kFala, SZABLONY.fala);
    const wFalaNaKolo = wynikDlaKsztaltu(kFala, SZABLONY.kolo);
    const wFalaNaZygzak = wynikDlaKsztaltu(kFala, SZABLONY.zygzak);
    spr(`fala -> fala wysoki (${wFalaNaFale.toFixed(2)})`, wFalaNaFale > 0.8);
    spr(`fala -> koło niski (${wFalaNaKolo.toFixed(2)})`, wFalaNaKolo < wFalaNaFale - 0.3);
    spr(`fala -> zygzak niski (${wFalaNaZygzak.toFixed(2)})`, wFalaNaZygzak < wFalaNaFale - 0.3);
}

console.log('WIELOKROTNE OKRĄŻENIA (okno przesuwne, nie akumulujące - decyzja 7/8):');
{
    // Gracz kreśli PIĘĆ okrążeń pod rząd (tak ma działać "runa przez
    // powtarzanie" - pierścień pieczecie.js napełnia się przez kilka sekund,
    // co przy typowym tempie oznacza więcej niż jedno okrążenie). Bufor MA
    // stale przedstawiać to, co gracz kreśli TERAZ - sprawdzamy wynik na
    // KOŃCU każdego okrążenia, nie tylko raz na koniec całości.
    const s = new SladNadgarstka();
    const PROMIEN = 0.15;
    const PROBEK_NA_OKRAZENIE = 60;
    const wynikiNaOkrazenie = [];

    for (let okrazenie = 0; okrazenie < 5; okrazenie++) {
        for (let i = 0; i < PROBEK_NA_OKRAZENIE; i++) {
            const t = (i / PROBEK_NA_OKRAZENIE) * Math.PI * 2;
            s.dodaj({ pozycja: { x: PROMIEN * Math.cos(t), y: PROMIEN * Math.sin(t) } }, 1 / 60);
        }
        wynikiNaOkrazenie.push(dopasuj(znormalizujSlad(s.punkty()), SZABLONY.kolo));
    }

    spr(`każde okrążenie (2..5) utrzymuje wysoki wynik (${wynikiNaOkrazenie.map(w => w.toFixed(2)).join(', ')})`,
        wynikiNaOkrazenie.slice(1).every(w => w > 0.5));
    spr('bufor nie rośnie bez końca mimo pięciu okrążeń (okno jest przesuwne)',
        s.dlugoscDrogi() <= MAX_DLUGOSC_M + 0.05);
}

console.log('ASPEKT PRZEŻYWA NORMALIZACJĘ (pułapka skalowania per-oś):');
{
    // Transpozycja x<->y zamienia pionowy zygzak w poziomy. Jeśli normalizacja
    // skalowałaby osie NIEZALEŻNIE (naiwny $1), zygzak i jego transpozycja
    // wyglądałyby identycznie po normalizacji - i to jest dokładnie to, co
    // ten test łapie.
    const zygzak = zygzakPionowy();
    const transponowany = zygzak.map(p => ({ x: p.y, y: p.x }));
    const w = wynikDlaKsztaltu(transponowany, SZABLONY.zygzak);
    spr(`transponowany zygzak NIE dopasowuje się do zygzaka (${w.toFixed(2)})`, w < 0.5);
    // A do fali (która jest z natury "pozioma", czyli podobna do transponowanego
    // pionowego zygzaka) powinien pasować wyraźnie lepiej.
    const wDoFali = wynikDlaKsztaltu(transponowany, SZABLONY.fala);
    spr(`transponowany zygzak bliższy fali niż zygzakowi (${wDoFali.toFixed(2)} > ${w.toFixed(2)})`,
        wDoFali > w);
}

console.log('CIĄGŁOŚĆ WYNIKU (reguła nadrzędna GEMINI.md §2):');
{
    const idealne = kolo();
    const wIdealny = wynikDlaKsztaltu(idealne, SZABLONY.kolo);

    // Psujemy koło coraz mocniej szumem promienia i patrzymy na MONOTONICZNY spadek.
    let poprzedni = wIdealny;
    let monotoniczne = true;
    const wyniki = [];
    for (const amplituda of [0.05, 0.2, 0.5, 0.8, 1.2, 2.0]) {
        const zaszumione = kolo().map((p, i) => {
            const r = 1 + amplituda * Math.sin(i * 7.3); // deterministyczny "szum"
            return { x: p.x * r, y: p.y * r };
        });
        const w = wynikDlaKsztaltu(zaszumione, SZABLONY.kolo);
        wyniki.push(w);
        if (w > poprzedni + 1e-9) monotoniczne = false;
        poprzedni = w;
    }
    spr('rosnący szum -> nierosnący wynik (monotoniczny spadek)', monotoniczne);
    // Gdzieś w tej rampie szumu MUSI istnieć wynik ściśle pośredni (0 < w < 1) -
    // to jest test na to, że dopasowanie jest rampą, a nie progiem tak/nie.
    // Nie zakładamy KTÓRY poziom szumu go da (zależy od stałych BLAD_ZERO/
    // BLAD_PELNY w ksztalt.js), tylko że taki poziom istnieje w tej rampie.
    const posredni = wyniki.some(w => w > 0.02 && w < 0.98);
    spr(`istnieje poziom szumu z wynikiem pośrednim (${wyniki.map(w => w.toFixed(2)).join(', ')})`,
        posredni);
}

console.log('NIEZMIENNICZOŚĆ SKALI I POŁOŻENIA:');
{
    const male = przesun(kolo(0.05), 3, -2);
    const duze = przesun(kolo(0.4), -1, 5);
    const wMale = wynikDlaKsztaltu(male, SZABLONY.kolo);
    const wDuze = wynikDlaKsztaltu(duze, SZABLONY.kolo);
    spr(`małe koło z boku dopasowuje się (${wMale.toFixed(2)})`, wMale > 0.8);
    spr(`duże koło przesunięte dopasowuje się (${wDuze.toFixed(2)})`, wDuze > 0.8);
}

console.log('NIEZMIENNICZOŚĆ TEMPA (decyzja: okno drogi, nie czasu):');
{
    // To NIE jest test ksztalt.js (który nie zna czasu) - to test SladNadgarstka:
    // ten sam kształt geometryczny podany z różną gęstością próbek w czasie
    // (czyli różnym "tempem" przy stałym FPS) ma dać podobny wynik, bo okno
    // jest w metrach, nie w sekundach.
    const punktyKola = kolo(0.15, 48);

    function nakresl(dtNaKrok) {
        const s = new SladNadgarstka();
        for (const p of punktyKola) s.dodaj({ pozycja: p }, dtNaKrok);
        return s;
    }

    const wolno = nakresl(1 / 15);   // dużo czasu na klatkę = "wolne" tempo
    const szybko = nakresl(1 / 90);  // mało czasu na klatkę = "szybkie" tempo

    const wWolno = dopasuj(znormalizujSlad(wolno.punkty()), SZABLONY.kolo);
    const wSzybko = dopasuj(znormalizujSlad(szybko.punkty()), SZABLONY.kolo);
    spr(`wolne tempo dopasowuje się (${wWolno.toFixed(2)})`, wWolno > 0.7);
    spr(`szybkie tempo dopasowuje się (${wSzybko.toFixed(2)})`, wSzybko > 0.7);
    spr('wynik nie zależy istotnie od tempa (|różnica| < 0.15)',
        Math.abs(wWolno - wSzybko) < 0.15);
}

console.log('NIEZMIENNICZOŚĆ PUNKTU STARTU:');
{
    const wFaza0 = wynikDlaKsztaltu(kolo(0.15, 64, 0), SZABLONY.kolo);
    const wFazaPol = wynikDlaKsztaltu(kolo(0.15, 64, Math.PI), SZABLONY.kolo);
    spr('koło zaczęte w dowolnym miejscu daje ten sam wynik',
        Math.abs(wFaza0 - wFazaPol) < 0.05);

    const wZygzakGora = wynikDlaKsztaltu(zygzakPionowy(64, false), SZABLONY.zygzak);
    const wZygzakDol = wynikDlaKsztaltu(zygzakPionowy(64, true), SZABLONY.zygzak);
    spr('zygzak od góry == zygzak od dołu',
        Math.abs(wZygzakGora - wZygzakDol) < 0.05);
}

console.log('ODPORNOŚĆ (§2: brak danych to nie błąd):');
{
    spr('resampluj(null) -> null', resampluj(null) === null);
    spr('resampluj([]) -> null', resampluj([]) === null);
    spr('resampluj([jeden punkt]) -> null', resampluj([{ x: 0, y: 0 }]) === null);
    spr('resampluj z NaN nie wybucha i filtruje zdrowe punkty',
        resampluj([{ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 0.1, y: 0.1 }]) === null
        || Array.isArray(resampluj([{ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 0.1, y: 0.1 }])));
    spr('znormalizuj(punkt zdegenerowany) -> null (RMS=0)',
        znormalizuj([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]) === null);
    spr('dopasuj(null, szablon) -> 0', dopasuj(null, SZABLONY.kolo) === 0);
    spr('dopasuj(ślad, szablon bez punktów) -> 0',
        dopasuj(znormalizujSlad(kolo()), { punkty: [] }) === 0);

    const s = new SladNadgarstka();
    s.dodaj({}, 1 / 60);
    s.dodaj({ otwartosc: NaN, piesc: NaN }, NaN);
    spr('SladNadgarstka bez żadnej pozycji nie wybucha', s.punkty().length === 0);
    spr('pokrycieDloni() na pustym śladzie -> 0', s.pokrycieDloni() === 0);
    spr('sredniaOtwartosc() na pustym śladzie -> 0', s.sredniaOtwartosc() === 0);
}

console.log('OKNO ŚLADU: DŁUGOŚĆ DROGI + SUFIT WIEKU:');
{
    const s = new SladNadgarstka({ maxDlugosc: 1.0, maxWiek: 4.0 });
    // Rysujemy dużo więcej niż jeden "obwód" - bufor ma się ograniczyć
    // do maxDlugosc, nie rosnąć bez końca.
    for (let i = 0; i < 500; i++) {
        const t = (i / 500) * Math.PI * 2 * 5; // 5 obrotów
        s.dodaj({ pozycja: { x: 0.15 * Math.cos(t), y: 0.15 * Math.sin(t) } }, 1 / 60);
    }
    spr(`długość drogi ograniczona do maxDlugosc (${s.dlugoscDrogi().toFixed(2)} <= 1.05)`,
        s.dlugoscDrogi() <= 1.05);

    const wiekowy = new SladNadgarstka({ maxDlugosc: 100, maxWiek: 1.0 });
    wiekowy.dodaj({ pozycja: { x: 0, y: 0 } }, 1 / 60);
    // Gracz znieruchomiał: dt jest CELOWO ucinany do 0.1s na wywołanie (jak
    // MAX_DT w motionMeter.js), więc upływ czasu symulujemy wieloma małymi
    // krokami, tak jak robiłby to prawdziwy silnik klatek, a nie jednym
    // sztucznym skokiem.
    for (let i = 0; i < 90; i++) wiekowy.dodaj({}, 1 / 60);
    spr('stary punkt wygasa po przekroczeniu maxWiek', wiekowy.punkty().length === 0);
}

console.log('KWALIFIKATOR DŁONI (uśredniony po całym śladzie, nie po klatce):');
{
    const s = new SladNadgarstka();
    // Dłoń otwarta przez większość śladu, jedna zła klatka (NaN) w środku.
    for (let i = 0; i < 20; i++) {
        const zlaKlatka = i === 10;
        s.dodaj({
            pozycja: { x: i * 0.01, y: 0 },
            otwartosc: zlaKlatka ? NaN : 0.9,
            piesc: zlaKlatka ? NaN : 0.1
        }, 1 / 60);
    }
    spr('jedna zła klatka nie zbija średniej do zera',
        s.sredniaOtwartosc() > 0.8);
    spr('pokrycie < 1 gdy jedna klatka bez odczytu dłoni',
        s.pokrycieDloni() > 0.9 && s.pokrycieDloni() < 1);

    s.wyczysc();
    spr('wyczysc() zeruje bufor', s.punkty().length === 0 && s.dlugoscDrogi() === 0);
}

console.log('PAROWANIE DŁONI Z NADGARSTKIEM PO POŁOŻENIU (nie po handedness):');
{
    // Dwie dłonie, dwa nadgarstki - jedna dłoń BLISKO nadgarstka L, druga
    // BLISKO nadgarstka P, ale podane w ODWROTNEJ kolejności w frame.hands
    // i BEZ pola handedness (null) - parowanie musi mimo to trafić po
    // odległości, nie po kolejności ani etykiecie.
    function ramka() {
        const lm2d = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
        lm2d[15] = { x: 0.2, y: 0.5, z: 0 }; // nadgarstek L (2D - do parowania)
        lm2d[16] = { x: 0.8, y: 0.5, z: 0 }; // nadgarstek P (2D - do parowania)
        const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
        wl[15] = { x: -0.2, y: 0, z: 0, visibility: 1 }; // nadgarstek L (world - do pozycji śladu)
        wl[16] = { x: 0.2, y: 0, z: 0, visibility: 1 };  // nadgarstek P (world)
        const dlonBliskoP = dlon({ ox: 0.79, oy: 0.5, zgiecia: [1, 1, 1, 1, 1], skala: 0.05 });
        const dlonBliskoL = dlon({ ox: 0.21, oy: 0.5, zgiecia: [0, 0, 0, 0, 0], skala: 0.05 });
        return {
            // KOLEJNOŚĆ CELOWO ODWRÓCONA: pierwsza w tablicy jest bliżej P.
            hands: [
                { landmarks: dlonBliskoP, worldLandmarks: null, handedness: null },
                { landmarks: dlonBliskoL, worldLandmarks: null, handedness: null }
            ],
            pose: { landmarks: lm2d, worldLandmarks: wl },
            width: 1920, height: 1080, dt: 1 / 60, now: 0
        };
    }

    const slady = stworzSlady();
    aktualizujSlady(ramka(), 1 / 60, slady);
    // Pięść (zgiecia=[1,1,1,1,1]) jest bliżej P -> sladPrawy powinien dostać
    // wysokie 'piesc', a sladLewy (otwarta dłoń) wysokie 'otwartosc'.
    spr(`dłoń pięści sparowana z prawym nadgarstkiem, nie z pierwszym w tablicy (${slady.sladPrawy.sredniaPiesc().toFixed(2)})`,
        slady.sladPrawy.sredniaPiesc() > 0.8);
    spr(`dłoń otwarta sparowana z lewym nadgarstkiem (${slady.sladLewy.sredniaOtwartosc().toFixed(2)})`,
        slady.sladLewy.sredniaOtwartosc() > 0.8);
}

console.log('KWALIFIKATOR PRZEZ CAŁY STOS (definicje.js): otwarta vs pięść na TYM SAMYM śladzie:');
{
    // Ta sama trajektoria (koło) w POZIE, ale dwie oddzielne gry z RÓŻNYM
    // stanem dłoni przez cały ślad - otwarta powinna zapalić mokosz-otwarta,
    // pięść powinna zapalić mokosz-piesc.
    function frameKola(t, otwarta) {
        const x = 0.15 * Math.cos(t), y = 0.15 * Math.sin(t);
        const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
        wl[15] = { x, y, z: 0, visibility: 1 }; // nadgarstek L (worldLandmarks - do pomiaru)
        wl[16] = { x: 10, y: 10, z: 0, visibility: 0 }; // prawy poza kadrem - nieużywany

        // Dłoń rysowana WOKÓŁ tego samego punktu (x,y), w tej samej "przestrzeni
        // 2D" co landmarks pozy poniżej - parowanie dłoni z nadgarstkiem idzie
        // teraz PO ODLEGŁOŚCI (definicje.js:sparujDlonieZNadgarstkami), więc
        // testowa dłoń i testowy nadgarstek muszą faktycznie leżeć blisko siebie,
        // tak jak w prawdziwej klatce z main.js:buildFrame.
        const zgiecia = otwarta ? [0, 0, 0, 0, 0] : [1, 1, 1, 1, 1];
        const reka = dlon({ ox: x, oy: y, zgiecia, skala: 0.09 });

        const lm2d = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
        lm2d[15] = { x, y, z: 0 };
        lm2d[16] = { x: 10, y: 10, z: 0 };

        return {
            hands: [{ landmarks: reka, worldLandmarks: null, handedness: null }],
            pose: { landmarks: lm2d, worldLandmarks: wl },
            width: 1920, height: 1080, dt: 1 / 60, now: 0
        };
    }

    function nakreslKolo(otwarta) {
        const slady = stworzSlady();
        const znaki = stworzZnakiRun(slady);
        const mapa = Object.fromEntries(znaki.map(z => [z.id, z]));
        // JEDNO okrążenie - okno śladu jest skalibrowane na obwód JEDNEGO
        // koła (slad.js:MAX_DLUGOSC_M), nie kilku - patrz test niżej
        // "WIELOKROTNE OKRĄŻENIA" na to, co dzieje się przy dalszym kreśleniu.
        for (let i = 0; i < 100; i++) {
            const t = (i / 100) * Math.PI * 2;
            aktualizujSlady(frameKola(t, otwarta), 1 / 60, slady);
        }
        return mapa;
    }

    const zOtwarta = nakreslKolo(true);
    const wOtwarta = zOtwarta['mokosz-otwarta'].score();
    const wPiescNaOtwartej = zOtwarta['mokosz-piesc'].score();
    spr(`dłoń otwarta -> mokosz-otwarta wysoki (${wOtwarta.toFixed(2)})`, wOtwarta > 0.5);
    spr(`dłoń otwarta -> mokosz-piesc niski (${wPiescNaOtwartej.toFixed(2)})`,
        wPiescNaOtwartej < wOtwarta);

    const zPiesc = nakreslKolo(false);
    const wPiesc = zPiesc['mokosz-piesc'].score();
    const wOtwartaNaPiesci = zPiesc['mokosz-otwarta'].score();
    spr(`pięść -> mokosz-piesc wysoki (${wPiesc.toFixed(2)})`, wPiesc > 0.5);
    spr(`pięść -> mokosz-otwarta niski (${wOtwartaNaPiesci.toFixed(2)})`, wOtwartaNaPiesci < wPiesc);
}

console.log('TRAFIENIE CZYŚCI ŚLAD (decyzja 9 - jedno przejście, jedna pieczęć):');
{
    const slady = stworzSlady();
    const znaki = stworzZnakiRun(slady);
    const mokoszOtwarta = znaki.find(z => z.id === 'mokosz-otwarta');

    for (let i = 0; i < 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        slady.sladLewy.dodaj({
            pozycja: { x: 0.15 * Math.cos(t), y: 0.15 * Math.sin(t) },
            otwartosc: 1, piesc: 0
        }, 1 / 60);
    }
    const przedCzyszczeniem = mokoszOtwarta.score();
    spr(`przed wyczyszczeniem wynik wysoki (${przedCzyszczeniem.toFixed(2)})`, przedCzyszczeniem > 0.5);

    slady.sladLewy.wyczysc();
    slady.sladPrawy.wyczysc();
    const poCzyszczeniu = mokoszOtwarta.score();
    spr(`po wyczyszczeniu (trafienie) wynik spada do zera (${poCzyszczeniu.toFixed(2)})`,
        poCzyszczeniu === 0);
}

console.log('PIRAMIDKA A RUNY - ROZDZIAŁ OBUSTRONNY (żywioł ognia zostaje, decyzja projektu):');
{
    // POPRAWKA (zadanie 10 planu piec-pieczeci-styku, swarogDlon.js). Ta
    // sekcja dawniej dowodziła "ogień działa BEZ pozy" (`pose: null`,
    // komentarz przy asercji: "swarogDlon.js nietknięty"). To zdanie samo
    // siebie obaliło - swarogDlon.js dostał warunek WYSOKOŚCI z pozy
    // (pasmo na wysokości klatki, patrz jego docstring), bo bez niego ogień
    // zapalał się na 223 z 333 klatek iglicy błyskawicy. Ta sama zmiana,
    // która naprawia tamtą kolizję, oznacza że `wysokoscPiramidki()` bez
    // pozy zwraca 0 (brak danych), a to zero przechodzi przez Math.min
    // w score() - więc ognia bez pozy już NIE da się zapalić, niezależnie
    // od kształtu dłoni. Sekcja teraz dowodzi węższej, wciąż prawdziwej
    // tezy: piramidka na wysokości klatki wciąż dobija do progu, a bez
    // RUCHU nadgarstków (nawet z pozą obecną) żadna z sześciu run się nie
    // składa - "ogień" i "runy" to dalej DWIE OSOBNE ścieżki oceny.
    const piramidka = [
        dlon({ ox: 0.42, oy: 0.62, zgiecia: [0, 0, 0, 0, 0], skala: 0.09, obrot: 0.42, wachlarz: 0.15 }),
        dlon({ ox: 0.42, oy: 0.62, zgiecia: [0, 0, 0, 0, 0], skala: 0.09, obrot: 0.42, wachlarz: 0.15, lustro: true })
    ];
    // Poza na wysokości klatki piersiowej - ta sama konstrukcja co
    // `NA_KLATCE` w tools/test-postawy.mjs: barki 0.40 m rozstawu,
    // nadgarstki pozy 0.20 szerokości barków NAD linią barków (v=-0.50,
    // w głębi plateau PROGI.ogien: -0.542..-0.351). `pose.landmarks`
    // (2D) zostaje PUSTA CELOWO - `sparujDlonieZNadgarstkami` (definicje.js)
    // wtedy nie paruje dłoni z nadgarstkiem pozy, więc test (b) niżej i
    // "brak ruchu -> brak runy" zostają dokładnie tak surowe, jak były.
    const pozaNaKlatce = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    pozaNaKlatce[11] = { x: -0.20, y: -0.55, z: 0, visibility: 1 };
    pozaNaKlatce[12] = { x: 0.20, y: -0.55, z: 0, visibility: 1 };
    pozaNaKlatce[15] = { x: -0.10, y: -0.35, z: 0, visibility: 1 };
    pozaNaKlatce[16] = { x: 0.10, y: -0.35, z: 0, visibility: 1 };
    const frameSwaroga = { hands: piramidka.map(lm => ({ landmarks: lm, worldLandmarks: null, handedness: null })),
                            pose: { landmarks: [], worldLandmarks: pozaNaKlatce },
                            width: 1920, height: 1080, dt: 1 / 60, now: 0 };

    const wSwarog = swarogDlon.score(frameSwaroga);
    spr(`piramidka na wysokości klatki nadal dobija do progu (${wSwarog.toFixed(2)}) - kształt dłoni nietknięty, doszła poza`,
        wSwarog > 0.6);

    const slady = stworzSlady();
    const znaki = stworzZnakiRun(slady);
    for (let i = 0; i < 60; i++) aktualizujSlady(frameSwaroga, 1 / 60, slady);
    const maxRuny = Math.max(...znaki.map(z => z.score()));
    spr(`piramidka bez ruchu nadgarstków nie zapala ŻADNEJ runy (${maxRuny.toFixed(2)})`, maxRuny === 0);

    // (b) Kreślenie runy otwartą dłonią - dłonie ROZDZIELONE (jedna kreśli,
    // druga poza kadrem) - swarogDlon (wymaga PARY dłoni blisko opuszkami)
    // ma wynik zero, bo najlepszaPara() potrzebuje co najmniej dwóch pełnych
    // dłoni jednocześnie w kadrze.
    const jednaOtwartaDlon = dlon({ ox: 0.15, oy: 0.15, zgiecia: [0, 0, 0, 0, 0], skala: 0.09 });
    const frameJednejDloni = {
        hands: [{ landmarks: jednaOtwartaDlon, worldLandmarks: null, handedness: 'Left' }],
        pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0
    };
    const wSwarogPrzyRunie = swarogDlon.score(frameJednejDloni);
    spr(`kreślenie jedną dłonią nie zapala piramidki (${wSwarogPrzyRunie.toFixed(2)})`,
        wSwarogPrzyRunie === 0);
}

console.log('KOMPLETNOŚĆ EFEKTÓW (efekty.js):');
{
    // Bez wiersza w TABELA, Efekty.odpal() po cichu nic nie robi - pieczęć
    // złożyłaby się, kosztowała moc i zagrała dźwięk, a na ekranie nic by
    // się nie pojawiło. To dokładnie ten rodzaj cichej awarii, przed którym
    // ostrzega GEMINI.md - sprawdzamy go tu wprost, zamiast czekać na
    // zgłoszenie "efekt nie powala" jak przy poprzedniej przebudowie.
    const { TABELA } = await import('../js/efekty.js');
    const wszystkieId = [...DEFINICJE.map(d => d.id), 'swarog'];
    for (const id of wszystkieId) {
        spr(`efekty.js ma wiersz TABELA dla '${id}'`, !!TABELA[id]);
    }
}

console.log(ok ? '\nWSZYSTKO OK' : '\nSĄ BŁĘDY');
process.exit(ok ? 0 : 1);
