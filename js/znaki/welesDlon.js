/**
 * Pieczęć Welesa - podziemie, kamień, brama.
 *
 * Dwie pięści, wyraźnie rozsunięte. Uziemienie.
 *
 * Nie jest to pieczęć z Naruto, ale trójka jest rozdzielana LICZBĄ
 * WYPROSTOWANYCH PALCÓW: Weles 0, Perun 4, Swaróg 10. Żadna para nie da
 * się pomylić, nawet gdyby próg wyprostowania był rozstrojony o połowę.
 *
 * ROZSUNIĘCIE JEST WYMOGIEM, NIE STYLEM. Zmierzone na żywej dłoni:
 * przy maksymalnym ścisku MediaPipe gubi jedną z dłoni. Wszystkie trzy
 * pieczęcie są zaprojektowane tak, żeby dłonie nigdy nie stykały się płasko.
 */
import { zwinieta, odlegloscNadgarstkow, rampa, najlepszaPara } from './dlon.js';

// ZGADNIĘTE - wymagają potwierdzenia z nakładki debug (klawisz D), która
// pokazuje wzór palców i odległość nadgarstków na żywo. Jednostka odległości:
// skala dłoni (nadgarstek -> nasada środkowego palca).
const ROZSUNIECIE_MIN = 0.8;
const ROZSUNIECIE_PELNE = 2.0;

export const welesDlon = {
    id: 'weles',
    nazwa: 'Weles',
    wymaga: 'hands',

    score(frame) {
        return najlepszaPara(frame, skladnikiPary).wynik;
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return najlepszaPara(frame, skladnikiPary).skladniki;
    }
};

// MINIMUM po składnikach (liczone w najlepszaPara), nie średnia: obie dłonie
// muszą być zwinięte I rozsunięte naraz. Średnia dawałaby wynik połowiczny za
// jedną pięść, co przy machaniu jedną ręką zapalałoby pieczęć.
// Minimum jest nadal CIĄGŁE - reguła nadrzędna spełniona.
function skladnikiPary(a, b) {
    return {
        piesci: Math.min(zwinieta(a), zwinieta(b)),
        rozsuniecie: rampa(odlegloscNadgarstkow(a, b),
                           ROZSUNIECIE_MIN, ROZSUNIECIE_PELNE)
    };
}
