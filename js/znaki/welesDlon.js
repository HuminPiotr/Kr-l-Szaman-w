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
import { pelnaDlon, zwinieta, odlegloscNadgarstkow, rampa } from './dlon.js';

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
        const h = frame.hands.filter(d => pelnaDlon(d.landmarks));
        if (h.length < 2) return 0;

        // Bierzemy najlepszą parę - gdyby MediaPipe zwrócił więcej niż dwie
        // dłonie, nie chcemy, żeby przypadkowa trzecia psuła wynik.
        let najlepszy = 0;
        for (let i = 0; i < h.length; i++) {
            for (let j = i + 1; j < h.length; j++) {
                najlepszy = Math.max(najlepszy, ocen(h[i].landmarks, h[j].landmarks));
            }
        }
        return najlepszy;
    }
};

function ocen(a, b) {
    const rozsuniecie = rampa(odlegloscNadgarstkow(a, b),
                              ROZSUNIECIE_MIN, ROZSUNIECIE_PELNE);

    // MINIMUM, nie średnia: obie dłonie muszą być zwinięte I rozsunięte
    // naraz. Średnia dawałaby wynik połowiczny za jedną pięść, co przy
    // dowolnym machaniu jedną ręką zapalałoby pieczęć.
    // Minimum jest nadal CIĄGŁE - reguła nadrzędna spełniona.
    return Math.min(zwinieta(a), zwinieta(b), rozsuniecie);
}
