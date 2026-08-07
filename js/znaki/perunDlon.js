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
    wzorPalcow, skierowanaWGore, odlegloscNadgarstkow, rownolegle,
    rampa, pasmo, najlepszaPara
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

// Ile ZŁOŻENIA serdecznego i małego wymagamy.
//
// Zgłoszone z testu: autentyczny Tygrys (wskazujący i środkowy ZŁĄCZONE) nie
// przechodził, a rozszczepienie palców w V - owszem. Powód: przy złączonych
// palcach i splecionych dłoniach MediaPipe ma gorszy odczyt palców zwiniętych
// i zgaduje je jako CZĘŚCIOWO wyprostowane. Wymóg "wyraźnie złożone" blokował
// wtedy całe minimum.
//
// Zwinięcie serdecznego i małego jest tylko WSPARCIEM rozpoznania, nie jego
// rdzeniem - trójka rozdziela się liczbą palców (0/4/10), więc Perun nie może
// się pomylić z niczym nawet przy luźnym warunku. Stąd tolerancja: liczy się,
// że nie są w pełni wyprostowane, a nie że są idealnie zaciśnięte.
const ZLOZONE_OD = 0.85;   // powyżej tego wyprostowania zaczynamy odejmować
const ZLOZONE_DO = 0.35;   // poniżej - warunek w pełni spełniony

export const perunDlon = {
    id: 'perun',
    nazwa: 'Perun',
    wymaga: 'hands',

    score(frame) {
        return najlepszaPara(frame, skladnikiPary).wynik;
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return najlepszaPara(frame, skladnikiPary).skladniki;
    }
};

/** Ile serdeczny i mały są ZŁOŻONE. Tolerancyjne - patrz komentarz przy stałych. */
function zlozoneTylne(lm) {
    const [, , , serdec, maly] = wzorPalcow(lm);
    const najbardziejWyprostowany = Math.max(serdec, maly);
    return rampa(najbardziejWyprostowany, ZLOZONE_OD, ZLOZONE_DO);
}

function skladnikiPary(a, b) {
    const wa = wzorPalcow(a), wb = wzorPalcow(b);
    return {
        // Rdzeń pieczęci: po dwa palce wyprostowane na obu dłoniach.
        dwaPalce: Math.min(wa[1], wa[2], wb[1], wb[2]),
        tylne: Math.min(zlozoneTylne(a), zlozoneTylne(b)),
        wGore: Math.min(skierowanaWGore(a), skierowanaWGore(b)),
        odleglosc: pasmo(odlegloscNadgarstkow(a, b),
                         ODLEGLOSC_MIN, ODLEGLOSC_PELNA,
                         ODLEGLOSC_SPADEK, ODLEGLOSC_ZERO),
        rownolegle: rampa(rownolegle(a, b), ROWNOLEGLE_MIN, ROWNOLEGLE_PELNE)
    };
}
