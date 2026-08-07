/**
 * Pieczęć Peruna - grom. Naruto: TYGRYS (Tora).
 *
 * Po dwa palce wyprostowane w górę na obu dłoniach - wskazujący i środkowy.
 * Pozostałe złożone. Dłonie obok siebie, ale z PRZEŚWITEM.
 *
 * Czytamy sylwetkę, nie przeplot: w prawdziwym Tygrysie palce są splecione
 * pod spodem, a MediaPipe tego nie widzi. Sprawdzamy tylko to, co wystaje.
 *
 * KCIUK POMIJANY. Jest najmniej pewnym punktem dłoni, a w Tygrysie bywa
 * i skrzyżowany, i schowany, i przyłożony z boku - wszystkie te układy są
 * poprawne. Wymaganie czegokolwiek od kciuka dodałoby tylko fałszywych
 * odrzuceń bez zysku dla rozdzielności (Perun i tak odcina się liczbą
 * palców: 4 kontra 0 Welesa i 10 Swaroga).
 */
import {
    pelnaDlon, wzorPalcow, skierowanaWGore, odlegloscNadgarstkow, rownolegle,
    rampa, pasmo
} from './dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D). Jednostka odległości:
// skala dłoni.
//
// Odległość nadgarstków ma DWIE granice. Za blisko: zmierzone na żywej dłoni,
// przy maksymalnym ścisku MediaPipe gubi jedną z dłoni. Za daleko: to już nie
// jest jedna pieczęć, tylko dwie osobne ręce.
const ODLEGLOSC_MIN = 0.35;
const ODLEGLOSC_PELNA = 0.7;
const ODLEGLOSC_SPADEK = 2.2;
const ODLEGLOSC_ZERO = 3.2;

const ROWNOLEGLE_MIN = 0.5;   // dłonie skierowane w tę samą stronę
const ROWNOLEGLE_PELNE = 0.85;

export const perunDlon = {
    id: 'perun',
    nazwa: 'Perun',
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

/** Dwa palce w górę na jednej dłoni: wskazujący i środkowy proste, dwa ostatnie złożone. */
function dwaPalce(lm) {
    const [, wskaz, srodk, serdec, maly] = wzorPalcow(lm);
    return Math.min(
        wskaz, srodk,
        1 - serdec, 1 - maly,
        skierowanaWGore(lm)
    );
}

function ocen(a, b) {
    const odleglosc = pasmo(odlegloscNadgarstkow(a, b),
                            ODLEGLOSC_MIN, ODLEGLOSC_PELNA,
                            ODLEGLOSC_SPADEK, ODLEGLOSC_ZERO);
    const rownol = rampa(rownolegle(a, b), ROWNOLEGLE_MIN, ROWNOLEGLE_PELNE);

    return Math.min(dwaPalce(a), dwaPalce(b), odleglosc, rownol);
}
