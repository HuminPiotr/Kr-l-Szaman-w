// js/nagrywanie/sesja.js
/**
 * Sesja nagraniowa - aplikacja prowadzi gracza, nie odwrotnie.
 *
 * POWÓD ISTNIENIA TEJ KLASY: żeby nacisnąć klawisz, gracz musi podejść do
 * komputera, a potem odejść, żeby tańczyć. Nagrywanie wyzwalane pojedynczym
 * naciśnięciem ("naciśnij i trzymaj pozę") jest więc bezużyteczne - materiał
 * zawierałby głównie spacer. Jedno naciśnięcie uruchamia CAŁY scenariusz,
 * a gra odlicza, mówi co robić i sama zaczyna oraz kończy każde nagranie.
 *
 * Ta klasa jest czystą logiką - zero DOM, zero dźwięku, zero landmarków.
 * Ekran i sygnały dźwiękowe podpina debugHud.js, klatki zbiera zapis.js.
 * Dzięki temu jedyna część harnessu, której błąd kosztowałby powtórne
 * nagranie, daje się sprawdzić testem bez kamery.
 */

// Długie, bo gracz musi wstać, odejść i się ustawić. Krótsze odliczanie
// znaczy pierwsze nagranie zawierające spacer.
const DOJSCIE_S = 12;
// Krótsze - gracz jest już na miejscu i tylko zmienia układ rąk.
const PRZERWA_S = 5;
// Sufit kroku czasu. Przy przełączeniu karty przeglądarka potrafi oddać
// jedno dt rzędu sekund; bez sufitu sesja przeskoczyłaby całe powtórzenie.
const MAX_DT = 0.1;

export const SCENARIUSZ = [
    {
        nr: 1, id: 'ogien', nazwa: 'OGIEŃ',
        opis: 'Piramidka: opuszki obu dłoni razem, nadgarstki rozsunięte',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 2, id: 'ziemia', nazwa: 'ZIEMIA',
        opis: 'Zaciśnięte pięści skrzyżowane na barkach - każda na przeciwnym',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 3, id: 'blyskawica', nazwa: 'BŁYSKAWICA',
        opis: 'Ręka w górę, łokieć złamany nad głową - druga dłoń chwyta ten łokieć w poprzek',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['PRAWA ręka w górze', 'LEWA ręka w górze', 'prawa, krok dalej']
    },
    {
        nr: 4, id: 'powietrze', nazwa: 'POWIETRZE',
        opis: 'Łokcie razem przed sobą, przedramiona pionowo w górę, dłonie rozchylone',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 5, id: 'woda', nazwa: 'WODA',
        opis: 'Miska nisko przy pępku: nadgarstki stykają się bokami, palce rozwarte',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 6, id: 'przejscie-ogien-woda-powietrze', nazwa: 'PRZEJŚCIE: ogień → woda → powietrze',
        opis: 'Trzy pieczęcie jedna po drugiej, płynnie, bez zatrzymywania się między nimi',
        powtorzenia: 3, czasS: 8,
        wskazowki: ['w swoim tempie', 'trochę szybciej', 'wolno i szeroko']
    },
    {
        nr: 7, id: 'przejscie-ziemia-powietrze', nazwa: 'PRZEJŚCIE: ziemia → powietrze',
        opis: 'Pięści z barków rozwiń wprost w łokcie razem, płynnie',
        powtorzenia: 3, czasS: 6,
        wskazowki: ['w swoim tempie', 'trochę szybciej', 'wolno i szeroko']
    },
    {
        nr: 8, id: 'taniec', nazwa: 'TANIEC',
        opis: 'Tańcz swobodnie. NIE myśl o pieczęciach - to jest próbka negatywna',
        powtorzenia: 1, czasS: 30,
        wskazowki: ['tak, jak tańczysz normalnie']
    }
];

export class SesjaNagraniowa {
    constructor({ scenariusz = SCENARIUSZ } = {}) {
        this.scenariusz = scenariusz;
        this._reset();
    }

    _reset() {
        this.stan = 'bezczynna';
        this._indeks = 0;        // indeks w tablicy scenariusza
        this._powtorzenie = 1;
        this._pozostalo = 0;
        this._calosc = 0;        // ile trwa bieżąca faza - do paska postępu
    }

    /** @param {number} odKroku  numer kroku (1..8), od którego zacząć */
    start(odKroku = 1) {
        const i = this.scenariusz.findIndex(k => k.nr === odKroku);
        this._reset();
        this._indeks = i >= 0 ? i : 0;
        this._powtorzenie = 1;
        this._wejdz('dojscie', DOJSCIE_S);
    }

    przerwij() {
        this._reset();
    }

    get aktywna() { return this.stan !== 'bezczynna'; }
    get nagrywa() { return this.stan === 'nagrywanie'; }

    /**
     * Krok czasu. Zwraca stan do wyświetlenia PLUS `sygnal` - jednorazowe
     * zdarzenie ('start' | 'stop' | 'koniec' | null), z którego debugHud
     * robi dźwięk. Zdarzenie jest w wyniku, a nie w callbacku, bo dzięki
     * temu cała klasa zostaje czystą funkcją stanu i daje się testować.
     */
    tick(dt) {
        if (this.stan === 'bezczynna') return this._wynik(null);

        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(MAX_DT, dt)) : 0;
        this._pozostalo -= krok;
        if (this._pozostalo > 0) return this._wynik(null);

        if (this.stan === 'dojscie' || this.stan === 'przerwa') {
            this._wejdz('nagrywanie', this._krok.czasS);
            return this._wynik('start');
        }

        // stan === 'nagrywanie' - powtórzenie właśnie się skończyło
        if (this._nastepnePowtorzenie()) {
            this._wejdz('przerwa', PRZERWA_S);
            return this._wynik('stop');
        }

        this._reset();
        return this._wynik('koniec');
    }

    /** Przesuwa wskaźnik na kolejne powtórzenie/krok. Zwraca false, gdy scenariusz się skończył. */
    _nastepnePowtorzenie() {
        if (this._powtorzenie < this._krok.powtorzenia) {
            this._powtorzenie += 1;
            return true;
        }
        if (this._indeks < this.scenariusz.length - 1) {
            this._indeks += 1;
            this._powtorzenie = 1;
            return true;
        }
        return false;
    }

    get _krok() { return this.scenariusz[this._indeks]; }

    _wejdz(stan, sekundy) {
        this.stan = stan;
        this._pozostalo = sekundy;
        this._calosc = sekundy;
    }

    _wynik(sygnal) {
        const bezczynna = this.stan === 'bezczynna';
        const krok = bezczynna ? null : this._krok;
        return {
            stan: this.stan,
            krok,
            powtorzenie: this._powtorzenie,
            // Etykieta wiąże klatkę z krokiem I powtórzeniem - bez numeru
            // powtórzenia nie dałoby się odrzucić jednej zepsutej próby,
            // a to jest cała procedura ratunkowa tej sesji.
            etykieta: krok ? `${krok.id}#${this._powtorzenie}` : null,
            wskazowka: krok ? (krok.wskazowki[this._powtorzenie - 1] ?? '') : '',
            pozostaloS: Math.max(0, this._pozostalo),
            postep: this._calosc > 0 ? 1 - Math.max(0, this._pozostalo) / this._calosc : 0,
            sygnal
        };
    }
}
