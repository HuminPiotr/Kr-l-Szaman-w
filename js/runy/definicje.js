/**
 * Sześć znaków-run dla ZnakRegistry: trzy kształty (koło/Mokosz, zygzak/Perun,
 * fala/Stribog) x dwa stany dłoni (otwarta/pięść). Piramidka Swaroga (ogień)
 * NIE jest tutaj - zostaje własnym plikiem, znaki/swarogDlon.js, bez zmian.
 *
 * BEZ POLA `wymaga`. Pozostałe znaki (postawa/dłoń) czytają geometrię z
 * BIEŻĄCEJ klatki - brak danych w tej klatce prawomocnie znaczy "wynik zero
 * w tej klatce". Runy są inne: `score()` czyta PERSYSTENTNY bufor śladu, który
 * już ma własną, łagodniejszą politykę braku danych (sufit wieku w slad.js).
 * Twarde `wymaga: 'pose'` zerowałoby wynik przy pojedynczej klatce bez pozy,
 * mimo że bufor pamięta poprawnie narysowany kształt sprzed sekundy - to
 * byłaby dokładnie ta krucha jednoklatkowa ocena, którą cała ta przebudowa
 * ma wyeliminować.
 */
import { NADG_L, NADG_P, widoczne } from '../znaki/postawa.js';
import { ileWyprostowanych, zwinieta, pelnaDlon } from '../znaki/dlon.js';
import { SladNadgarstka } from './slad.js';
import { znormalizujSlad, dopasuj } from './ksztalt.js';
import { SZABLONY } from './szablony.js';

// Brak dłoni w kadrze NIE KARZE (GEMINI.md §2) - runa dalej się składa, tylko
// na "domyślnym" poziomie kwalifikatora, zamiast dostać zero. 0.7 jest
// ZGADNIĘTE - potwierdzić z nakładki, czy to wystarcza, żeby ślad bez dłoni
// (np. dłoń chwilowo poza kadrem) nie blokował całkiem złożenia.
const WAGA_BEZ_DLONI = 0.7;

/** Tworzy dwa bufory śladu (lewy/prawy nadgarstek) - stan gry, trzyma je main.js. */
export function stworzSlady() {
    return { sladLewy: new SladNadgarstka(), sladPrawy: new SladNadgarstka() };
}

/**
 * Aktualizacja śladów - RAZ NA KLATKĘ, przed znaki.ocen(frame). Patrz
 * nagłówek pliku i dopisek w spec: gdyby to działo się w score(), sześć
 * znaków dopisywałoby ten sam ruch do bufora sześć razy na klatkę.
 */
export function aktualizujSlady(frame, dt, { sladLewy, sladPrawy }) {
    const wl = frame.pose?.worldLandmarks ?? null;
    const lm2d = frame.pose?.landmarks ?? null;
    const { L: dlonLewa, P: dlonPrawa } = sparujDlonieZNadgarstkami(frame);

    sladLewy.dodaj({
        pozycja: pozycjaNadgarstka(wl, NADG_L),
        pozycja2D: pozycja2D(lm2d, NADG_L),
        otwartosc: otwartosc(dlonLewa),
        piesc: piesc(dlonLewa)
    }, dt);

    sladPrawy.dodaj({
        pozycja: pozycjaNadgarstka(wl, NADG_P),
        pozycja2D: pozycja2D(lm2d, NADG_P),
        otwartosc: otwartosc(dlonPrawa),
        piesc: piesc(dlonPrawa)
    }, dt);
}

/**
 * Parowanie dłoni z nadgarstkiem POZY po POŁOŻENIU, nie po `handedness`.
 *
 * `handedness` z HandLandmarkera bywa niepewne (dlon.js:normalnaDloni
 * opisuje ten sam problem przy obróconej dłoni) - błędne parowanie przez
 * string byłoby NAJGORSZYM rodzajem błędu do zdiagnozowania: objaw wyglądałby
 * jak "stan dłoni nie działa", a nie "strony są zamienione".
 *
 * Nadgarstek dłoni (landmark 0) i nadgarstek pozy (15/16) leżą w TEJ SAMEJ
 * znormalizowanej przestrzeni płótna - main.js:buildFrame mapuje oba przez
 * ten sam mapLandmarks(..., fit) - więc dla tej samej fizycznej ręki powinny
 * być niemal w tym samym miejscu. Parowanie po odległości jest więc możliwe
 * i dużo pewniejsze niż poleganie na etykiecie MediaPipe.
 */
function sparujDlonieZNadgarstkami(frame) {
    const puste = { L: null, P: null };
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    const lm2d = frame.pose?.landmarks ?? null;
    const pL = lm2d?.[NADG_L], pP = lm2d?.[NADG_P];

    if (!dlonie.length || !zdrowy2D(pL) || !zdrowy2D(pP)) return puste;

    if (dlonie.length === 1) {
        const w = dlonie[0].landmarks[0];
        if (!zdrowy2D(w)) return puste;
        return odleglosc(w, pL) <= odleglosc(w, pP)
            ? { L: dlonie[0], P: null }
            : { L: null, P: dlonie[0] };
    }

    // Dwie i więcej dłoni (bierzemy dwie pierwsze) - przypisanie minimalizujące
    // SUMĘ odległości, żeby obie dłonie nie mogły "zgłosić się" do tego
    // samego nadgarstka niezależnie od siebie.
    const [a, b] = dlonie;
    const wa = a.landmarks[0], wb = b.landmarks[0];
    if (!zdrowy2D(wa) || !zdrowy2D(wb)) return puste;

    const prosto = odleglosc(wa, pL) + odleglosc(wb, pP);
    const naKrzyz = odleglosc(wa, pP) + odleglosc(wb, pL);
    return prosto <= naKrzyz ? { L: a, P: b } : { L: b, P: a };
}

function zdrowy2D(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}
function odleglosc(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function pozycjaNadgarstka(wl, indeks) {
    if (!widoczne(wl, [indeks])) return null;
    const p = wl[indeks];
    return { x: p.x, y: p.y };
}

function pozycja2D(lm2d, indeks) {
    const p = lm2d?.[indeks];
    return zdrowy2D(p) ? { x: p.x, y: p.y } : null;
}

// Te same ciągłe miary, które od miesięcy niosą Welesa (zwinieta) i resztę
// dłoniowych pieczęci (ileWyprostowanych) - jedyna oś geometrii dłoni, która
// w tym projekcie nigdy nie zawiodła.
function otwartosc(dlon) {
    return dlon ? ileWyprostowanych(dlon.landmarks) / 5 : null;
}
function piesc(dlon) {
    return dlon ? zwinieta(dlon.landmarks) : null;
}

/** Kwalifikator dłoni uśredniony po CAŁYM śladzie, nie po jednej klatce (decyzja 4/5 spec). */
function wynikKwalifikatora(slad, wariant) {
    const pokrycie = slad.pokrycieDloni();
    const surowy = wariant === 'otwarta' ? slad.sredniaOtwartosc() : slad.sredniaPiesc();
    return pokrycie * surowy + (1 - pokrycie) * WAGA_BEZ_DLONI;
}

// Cache znormalizowanego śladu, kluczowany PO INSTANCJI I WERSJI bufora.
// Sześć znaków dzieli te same dwa bufory (sladLewy/sladPrawy) i każdy z nich
// pyta o kształt raz na klatkę - bez cache to sześć identycznych resamplingów
// tego samego śladu, zamiast jednego. `slad.wersja` (slad.js) rośnie przy
// KAŻDEJ zmianie bufora, więc cache jest ważny dokładnie do następnego dodaj()/
// wyczysc(), nigdy dłużej.
const _cacheNorm = new WeakMap(); // SladNadgarstka -> { wersja, norm }

function sladZnormalizowanyZCache(slad) {
    const trafienie = _cacheNorm.get(slad);
    if (trafienie && trafienie.wersja === slad.wersja) return trafienie.norm;
    const norm = znormalizujSlad(slad.punkty());
    _cacheNorm.set(slad, { wersja: slad.wersja, norm });
    return norm;
}

/**
 * Wynik jednej runy dla JEDNEGO nadgarstka: minimum kształtu i kwalifikatora -
 * ta sama konwencja "AND ciągłych warunków" co reszta znaków w tym repo
 * (najlepszaPara w dlon.js bierze Math.min ze składników).
 */
function wynikDlaSladu(slad, szablon, wariant) {
    const ksztalt = dopasuj(sladZnormalizowanyZCache(slad), szablon);
    const dlonWynik = wynikKwalifikatora(slad, wariant);
    return { wynik: Math.min(ksztalt, dlonWynik), ksztalt, dlon: dlonWynik };
}

/** Lepszy z dwóch nadgarstków - gracz kreśli jedną ręką, druga zwykle nic nie robi. */
function najlepszaStrona(sladLewy, sladPrawy, szablon, wariant) {
    const l = wynikDlaSladu(sladLewy, szablon, wariant);
    const p = wynikDlaSladu(sladPrawy, szablon, wariant);
    return l.wynik >= p.wynik ? { ...l, strona: 'L' } : { ...p, strona: 'P' };
}

export const DEFINICJE = [
    { id: 'mokosz-otwarta',  nazwa: 'Mokosz (dająca)',   szablon: SZABLONY.kolo,   wariant: 'otwarta' },
    { id: 'mokosz-piesc',    nazwa: 'Mokosz (biorąca)',  szablon: SZABLONY.kolo,   wariant: 'piesc' },
    { id: 'perun-otwarta',   nazwa: 'Perun (dający)',    szablon: SZABLONY.zygzak, wariant: 'otwarta' },
    { id: 'perun-piesc',     nazwa: 'Perun (biorący)',   szablon: SZABLONY.zygzak, wariant: 'piesc' },
    { id: 'stribog-otwarta', nazwa: 'Stribog (dający)',  szablon: SZABLONY.fala,   wariant: 'otwarta' },
    { id: 'stribog-piesc',   nazwa: 'Stribog (biorący)', szablon: SZABLONY.fala,   wariant: 'piesc' }
];

/**
 * @param {{sladLewy: SladNadgarstka, sladPrawy: SladNadgarstka}} slady  z stworzSlady()
 * @returns {Array} sześć obiektów znak gotowych do ZnakRegistry.zarejestruj()
 */
export function stworzZnakiRun({ sladLewy, sladPrawy }) {
    return DEFINICJE.map(({ id, nazwa, szablon, wariant }) => ({
        id,
        nazwa,
        score() {
            return najlepszaStrona(sladLewy, sladPrawy, szablon, wariant).wynik;
        },
        /**
         * Rozbicie do nakładki - patrz dlon.js:najlepszaPara, ten sam powód.
         * CELOWO tylko liczby (bez `strona`) - debugHud.js renderuje rozbicie
         * generycznie przez Math.min()/toFixed() na Object.values(), a string
         * wymieszany z liczbami psułby oba (Math.min('L', 0.8) -> NaN).
         */
        skladniki() {
            const n = najlepszaStrona(sladLewy, sladPrawy, szablon, wariant);
            return { ksztalt: n.ksztalt, dlon: n.dlon };
        }
    }));
}
