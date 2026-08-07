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
 */
import {
    wzorPalcow, zbieznoscOpuszek, odlegloscNadgarstkow, rampa, najlepszaPara
} from './dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D). Jednostka: skala dłoni.
const ZBIEZNOSC_PELNA = 0.35;   // opuszki dokładnie razem
const ZBIEZNOSC_ZERO = 1.1;     // opuszki daleko - to już nie namiot

const ROZSUNIECIE_MIN = 0.7;    // poniżej: dłonie płasko przy sobie (to Wąż)
const ROZSUNIECIE_PELNE = 1.4;

export const swarogDlon = {
    id: 'swarog',
    nazwa: 'Swaróg',
    wymaga: 'hands',

    score(frame) {
        return najlepszaPara(frame, skladnikiPary).wynik;
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return najlepszaPara(frame, skladnikiPary).skladniki;
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
