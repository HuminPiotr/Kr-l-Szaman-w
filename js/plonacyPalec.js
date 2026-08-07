/**
 * Płonący palec - pierwsza technika KANAŁOWANA.
 *
 * Wszystkie dotychczasowe efekty są typu "odpal i zapomnij": mają stały czas
 * i nikt nimi nie steruje. Ta żyje tak długo, jak gracz ją prowadzi, i zjada
 * moc - dzięki temu taniec ma sens także po odblokowaniu techniki.
 *
 * Pętla: taniec -> moc -> kombos -> malowanie ogniem -> taniec.
 *
 * Nie rysuje. Rysowaniem zajmuje się js/ogien.js, który nie wie nic
 * o pieczęciach ani o mocy.
 *
 * ================== STANY ==================
 *
 *   BEZCZYNNY   brak kombosa
 *      |  kombos (uzbrojenie, BEZ licznika - licznik to presja)
 *      v
 *   GOTOWY
 *      |  jeden palec wysunięty, opuszek NAD LINIĄ BARKÓW
 *      v
 *   PLONIE  --- palec schowany ------> BEZCZYNNY
 *           --- moc wyczerpana ------> BEZCZYNNY
 *
 * SCHOWANIE PALCA KOŃCZY TECHNIKĘ, nie wstrzymuje. Decyzja właściciela gry
 * i słuszna: zakończenie techniki własnym ruchem to nie kara, to KONTROLA.
 * Pauza odbierałaby graczowi możliwość zgaszenia ognia, kiedy chce.
 *
 * "Nad barkiem" to warunek ZAPŁONU, nie trzymania. Po zapaleniu można wodzić
 * palcem gdziekolwiek, także nisko - trzymanie ręki w górze przez pół minuty
 * bolałoby, a to ma być relaks.
 */
import { pelnaDlon, wzorPalcow, OPUSZKI } from './znaki/dlon.js';
import { BARK_L, BARK_P } from './znaki/postawa.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
const PROG_WSKAZANIA = 0.55;   // "dokładnie jeden palec wyprostowany"
const PROG_UTRZYMANIA = 0.35;  // histereza: poniżej tego technika się kończy
const NAD_BARKIEM = 0.02;      // ile ponad linią barków, w wysokościach kadru

// Pełny pasek mocy na 30 s ognia. To ma być hojne: ogień jest nagrodą,
// a nie zasobem do oszczędzania.
const KOSZT_NA_SEKUNDE = 1 / 30;

// Palce liczone bez kciuka - jak we wszystkich pieczęciach. Kciuk jest
// najmniej pewnym punktem dłoni, a wskazywanie z odstawionym kciukiem
// jest całkowicie naturalne.
const BEZ_KCIUKA = [1, 2, 3, 4];

export class PlonacyPalec {
    constructor() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;      // {x, y} w znormalizowanych koordynatach płótna
        this.sila = 0;           // 0..1 - do sterowania ogniem
        this.wskazanie = 0;      // diagnostyka: jak wyraźnie jeden palec wystaje
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności. */
    uzbrój() {
        if (this.stan === 'BEZCZYNNY') this.stan = 'GOTOWY';
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1
     * @param {number} dt
     * @returns {number} ile mocy pobrać w tej klatce (0, jeśli nic)
     */
    update(frame, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const w = this._wskazujacyPalec(frame);
        this.wskazanie = w ? w.wynik : 0;

        if (this.stan === 'BEZCZYNNY') {
            this.zaczep = null;
            this.sila = 0;
            return 0;
        }

        if (this.stan === 'GOTOWY') {
            this.sila = 0;
            this.zaczep = null;
            // Zapłon wymaga opuszka NAD linią barków.
            if (w && w.wynik >= PROG_WSKAZANIA && this._nadBarkiem(frame, w.opuszek)) {
                this.stan = 'PLONIE';
                this.zaczep = w.opuszek;
                this.sila = 1;
            }
            return 0;
        }

        // PLONIE
        if (!w || w.wynik < PROG_UTRZYMANIA) {
            // Palec schowany - koniec techniki. Reszta mocy zostaje graczowi.
            this._zgas();
            return 0;
        }
        if (!(moc > 0)) {
            this._zgas();
            return 0;
        }

        this.zaczep = w.opuszek;
        // Siła słabnie razem z resztką mocy - płomień dopala się, zamiast
        // zniknąć w jednej klatce.
        this.sila = Math.max(0.25, Math.min(1, moc * 3));

        return Math.min(moc, KOSZT_NA_SEKUNDE * krok);
    }

    _zgas() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;
        this.sila = 0;
    }

    /**
     * Dłoń z DOKŁADNIE JEDNYM wyprostowanym palcem i pozycja jego opuszka.
     *
     * Wynik jest ciągły: najwyższy palec razy (1 - drugi najwyższy). Wysoki
     * tylko wtedy, gdy jeden wystaje, a pozostałe są złożone. Dzięki temu
     * nie ma progu na liczbę palców, jest płynne przejście.
     */
    _wskazujacyPalec(frame) {
        let naj = null;
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            const wzor = wzorPalcow(d.landmarks);

            let i1 = -1, v1 = -1, v2 = -1;
            for (const i of BEZ_KCIUKA) {
                const v = wzor[i];
                if (v > v1) { v2 = v1; v1 = v; i1 = i; }
                else if (v > v2) { v2 = v; }
            }
            if (i1 < 0) continue;

            const wynik = v1 * (1 - v2);
            if (!naj || wynik > naj.wynik) {
                const idx = OPUSZKI[i1];
                naj = { wynik, opuszek: { x: d.landmarks[idx].x, y: d.landmarks[idx].y } };
            }
        }
        return naj;
    }

    /** Oś Y rośnie W DÓŁ, więc "nad barkami" to y MNIEJSZE od linii barków. */
    _nadBarkiem(frame, opuszek) {
        const lm = frame.pose?.landmarks;
        if (!lm || !lm[BARK_L] || !lm[BARK_P]) return false;
        const yBarkow = (lm[BARK_L].y + lm[BARK_P].y) / 2;
        if (!Number.isFinite(yBarkow) || !Number.isFinite(opuszek.y)) return false;
        return opuszek.y < yBarkow - NAD_BARKIEM;
    }
}
