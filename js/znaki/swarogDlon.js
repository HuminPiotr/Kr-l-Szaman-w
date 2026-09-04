/**
 * Pieczęć Swaroga - ogień, kuźnia. Naruto: KOŃ (Uma).
 *
 * Wszystkie palce wyprostowane, opuszki obu dłoni złączone w namiot,
 * nadgarstki ROZSUNIĘTE. Kształt płomienia albo dachu kuźni.
 *
 * TA PIECZĘĆ JEST NAJBEZPIECZNIEJSZA Z CAŁEJ TRÓJKI, i to nie przypadek.
 * Zmierzone na żywej dłoni: MediaPipe gubi jedną dłoń przy maksymalnym
 * ścisku. Namiot WYMAGA rozsuniętych nadgarstków, żeby w ogóle powstał -
 * czyli sam kształt pieczęci wymusza prześwit, którego potrzebuje detektor.
 *
 * Odległość nadgarstków jest tu warunkiem KONIECZNYM także z drugiego powodu:
 * odróżnia Konia od przyszłego Węża (dłonie płasko przy sobie, też 10 palców
 * wyprostowanych). Bez niej te dwie pieczęcie byłyby nieodróżnialne.
 *
 * ================== ZADANIE 10: DOSZŁA WYSOKOŚĆ Z POZY ==================
 *
 * Namiot z opuszek jest tym samym kształtem dłoni co piramidka nad głową
 * w iglicy błyskawicy (znaki/perun.js). Bez warunku wysokości ogień zapalał
 * się na 223 z 333 klatek iglicy (zmierzone) - i osobno, częściej na misce
 * wody (179/322) niż na własnej piramidce (107/299). `wysokoscPiramidki`
 * niżej domyka obie kolizje PASMEM (nie rampą): ogień milczy nisko (tam jest
 * woda) i wysoko (tam jest iglica), punktuje tylko na wysokości klatki/twarzy.
 * Szczegóły i liczby przy samej funkcji.
 *
 * KONSEKWENCJA: `wymaga` zmienione z 'hands' na 'both'. Ogień potrzebuje
 * teraz i dłoni, i pozy - patrz komentarz przy polu `wymaga` niżej oraz
 * docstring `wysokoscPiramidki`.
 */
import {
    wzorPalcow, zbieznoscOpuszek, odlegloscNadgarstkow, rampa, najlepszaPara, pasmo
} from './dlon.js';
import { NADG_L, NADG_P, BARK_L, BARK_P, widoczne, skalaCiala } from './postawa.js';
import { nadBarkami } from './styk.js';
import { PROGI } from './progi-zmierzone.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D). Jednostka: skala dłoni.
const ZBIEZNOSC_PELNA = 0.35;   // opuszki dokładnie razem
const ZBIEZNOSC_ZERO = 1.1;     // opuszki daleko - to już nie namiot

const ROZSUNIECIE_MIN = 0.7;    // poniżej: dłonie płasko przy sobie (to Wąż)
const ROZSUNIECIE_PELNE = 1.4;

const PO = PROGI.ogien;

export const swarogDlon = {
    id: 'swarog',
    nazwa: 'Swaróg',
    // ZMIENIONE z 'hands' na 'both' (zadanie 10): ogień potrzebuje teraz
    // WYSOKOŚCI z pozy, żeby odróżnić się od iglicy błyskawicy (patrz
    // wysokoscPiramidki niżej). Konsekwencja: znak milczy na klatce, na
    // której MediaPipe nie widzi ciała w ogóle (frame.pose === null),
    // nawet gdy dłonie ułożone są bez zarzutu - rejestr (registry.js,
    // _ocenJeden) blokuje wywołanie score() jeszcze przed geometrią.
    // Wcześniej ('hands') taka klatka liczyła się WYŁĄCZNIE z kształtu dłoni.
    wymaga: 'both',

    score(frame) {
        const sk = this.skladniki(frame);
        if (!sk) return 0;
        // Minimum, nie średnia: wysokość jest teraz WARUNKIEM KONIECZNYM na
        // równi z kształtem dłoni, nie premią - patrz docstring
        // wysokoscPiramidki. Iglica ma kształt idealnego namiotu i mimo to
        // musi wygasić ognia, bo stoi nad głową.
        return Math.min(sk.palce, sk.opuszki, sk.nadgarstki, sk.wysokosc);
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        const sk = najlepszaPara(frame, skladnikiPary).skladniki;
        if (!sk) return null;
        return { ...sk, wysokosc: wysokoscPiramidki(frame) };
    }
};

/**
 * Wyprostowanie czterech palców (bez kciuka).
 *
 * Kciuk pomijany jak w pozostałych pieczęciach - w namiocie leży zwykle
 * z boku albo pod spodem i jego pozycja nic nie wnosi.
 */
function palceProste(lm) {
    const [, wskaz, srodk, serdec, maly] = wzorPalcow(lm);
    return (wskaz + srodk + serdec + maly) / 4;
}

function skladnikiPary(a, b) {
    return {
        palce: Math.min(palceProste(a), palceProste(b)),
        // Zbieżność liczona ODWROTNIE: mała odległość opuszek = wysoki wynik.
        opuszki: 1 - rampa(zbieznoscOpuszek(a, b), ZBIEZNOSC_PELNA, ZBIEZNOSC_ZERO),
        nadgarstki: rampa(odlegloscNadgarstkow(a, b),
                          ROZSUNIECIE_MIN, ROZSUNIECIE_PELNE)
    };
}

/**
 * ================== PASMO WYSOKOŚCI PIRAMIDKI ==================
 *
 * Dodane po pomiarze na nagraniu z 2026-09-03. Wcześniejsze wersje spec-u
 * pięciokrotnie powtarzały, że ten plik zostaje bez jednej linijki zmiany
 * (patrz też js/main.js:68-70, ta sama deklaracja - teraz nieaktualna).
 * Pomiar to obalił dwukrotnie:
 *
 *   1. Bez ŻADNEGO warunku wysokości ogień zapalał się na MISCE WODY
 *      częściej (179/322 klatek) niż na własnej piramidce (107/299).
 *      Miska ma palce proste, opuszki zbieżne i nadgarstki rozsunięte
 *      w skali dłoni - komplet warunków ognia. A Tęcza to ogień -> woda ->
 *      powietrze, więc gracz przechodził przez tę kolizję ZA KAŻDYM RAZEM.
 *   2. Sama PODŁOGA wysokości tego nie domyka, bo piramidka NAD GŁOWĄ
 *      (iglica błyskawicy) też jest "wysoko" - ogień zapalał się wtedy na
 *      223 z 333 klatek iglicy.
 *
 * Stąd PASMO, nie rampa: piramidka liczy się na wysokości klatki, a milczy
 * i nisko (woda), i wysoko (iglica). Zmierzony efekt pasma: woda 179 -> 0,
 * iglica 223 -> 0, taniec 8 -> 0, ogień 107 -> 107. Zero kosztu dla własnej
 * pozy.
 *
 * Ogólniejsza lekcja, warta zapamiętania poza tym plikiem: KOLIZJĘ TRZEBA
 * SPRAWDZAĆ W OBIE STRONY. Spec przewidział parę ogień-woda jako najbardziej
 * narażoną, ale założył, że to woda udaje ognia, i przeniósł wodę na
 * landmarki pozy. Kolizja biegła odwrotnie i tamta zmiana nie mogła jej
 * naprawić.
 *
 * ================== KONSEKWENCJA `wymaga: 'both'` ==================
 *
 * Ta funkcja wymaga pozy, żeby w ogóle coś policzyć - `widoczne()` niżej
 * zwraca false (i cała funkcja 0), gdy `frame.pose` jest puste. To jest
 * SPÓJNE z gate'em rejestru (`wymaga: 'both'`, registry.js `_ocenJeden`),
 * ale działa NIEZALEŻNIE od niego: każdy kod wołający `score()`/`skladniki()`
 * BEZPOŚREDNIO, z pominięciem ZnakRegistry (tak robi część testów w tym
 * repo), i tak dostanie 0 przy braku pozy - `Math.min` w `score()` przepuszcza
 * tę zerową wysokość do końcowego wyniku, niezależnie od tego, jak dobry
 * jest kształt dłoni.
 */
function wysokoscPiramidki(frame) {
    const wl = frame.pose?.worldLandmarks;
    if (!widoczne(wl, [BARK_L, BARK_P, NADG_L, NADG_P])) return 0;
    const skala = skalaCiala(wl);
    const wys = Math.max(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala));
    return pasmo(wys, PO.WYSOKOSC_DOL_ZERO, PO.WYSOKOSC_DOL_PELNY,
                      PO.WYSOKOSC_GORA_PELNY, PO.WYSOKOSC_GORA_ZERO);
}
