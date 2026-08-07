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
    pelnaDlon, wzorPalcow, zbieznoscOpuszek, odlegloscNadgarstkow, rampa
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
        const h = frame.hands.filter(d => pelnaDlon(d.landmarks));
        if (h.length < 2) return 0;

        let najlepszy = 0;
        for (let i = 0; i < h.length; i++) {
            for (let j = i + 1; j < h.length; j++) {
                najlepszy = Math.max(najlepszy, ocen(h[i].landmarks, h[j].landmarks));
            }
        }
        return najlepszy;
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

function ocen(a, b) {
    // Zbieżność liczona ODWROTNIE: mała odległość opuszek = wysoki wynik.
    const zbieznosc = 1 - rampa(zbieznoscOpuszek(a, b), ZBIEZNOSC_PELNA, ZBIEZNOSC_ZERO);
    const rozsuniecie = rampa(odlegloscNadgarstkow(a, b),
                              ROZSUNIECIE_MIN, ROZSUNIECIE_PELNE);

    return Math.min(palceProste(a), palceProste(b), zbieznosc, rozsuniecie);
}
