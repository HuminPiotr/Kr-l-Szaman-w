/**
 * Pieczęć Szczura (Nezumi) - wiatr.
 *
 * Dwie pięści złożone RAZEM, jedna obejmuje drugą (jak na grafice z Naruto).
 * Czytamy sylwetkę, nie przeplot: podpis zewnętrzny to 0 wyprostowanych
 * palców + nadgarstki BLISKO siebie.
 *
 * ROZDZIELNOŚĆ Z WELESEM jest sednem tej pieczęci. Obie to dwie pięści;
 * rozdziela je WYŁĄCZNIE odległość nadgarstków:
 *
 *   Szczur         <= 0.50 pełny wynik, gaśnie do 0.75
 *   martwa strefa  0.75 - 0.80   (nic nie punktuje)
 *   Weles          rampa 0.80 -> 2.00
 *
 * Rozsuwanie pięści przechodzi przez martwą strefę, więc pierścień jednej
 * pieczęci gaśnie, zanim druga zacznie się liczyć. Minimalny czas składania
 * (0.5 s w pieczecie.js) chroni przed zapaleniem w przelocie.
 *
 * RYZYKO ZMIERZONE WCZEŚNIEJ: MediaPipe gubi jedną dłoń przy pełnym płaskim
 * ścisku. Pięści zasłaniają się mniej niż płaskie dłonie, a pasmo zaczyna się
 * od kontaktu - ale to wymaga potwierdzenia na żywo. Plan B: podnieść
 * BLISKO_PELNE tak, by optimum wypadało przy pięściach stykających się
 * knykciami, nie splecionych w kłąb.
 */
import { zwinieta, odlegloscNadgarstkow, rampa, najlepszaPara } from './dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D). Jednostka: skala dłoni.
const BLISKO_PELNE = 0.5;   // do tylu skal dłoni - pełny wynik
const BLISKO_ZERO = 0.75;   // od tylu - zero (martwa strefa przed Welesem od 0.8)

export const szczurDlon = {
    id: 'szczur',
    nazwa: 'Szczur (Wiatr)',
    wymaga: 'hands',

    score(frame) {
        return najlepszaPara(frame, skladnikiPary).wynik;
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return najlepszaPara(frame, skladnikiPary).skladniki;
    }
};

// MINIMUM po składnikach (liczy je najlepszaPara): obie dłonie muszą być
// pięściami I być blisko siebie naraz. Minimum jest CIĄGŁE - reguła
// nadrzędna spełniona: pięści w połowie zwinięte dają połowę wyniku.
function skladnikiPary(a, b) {
    return {
        piesci: Math.min(zwinieta(a), zwinieta(b)),
        // Odwrotność rozsunięcia Welesa: im bliżej, tym wyżej.
        blisko: 1 - rampa(odlegloscNadgarstkow(a, b), BLISKO_PELNE, BLISKO_ZERO)
    };
}
