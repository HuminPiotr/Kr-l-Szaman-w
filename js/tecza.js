/**
 * Tecza - stan nagrody Wstęgi Mokoszy: 30 s darmowej tęczy po 3x złożeniu
 * Splotu. Nie rysuje - tym zajmuje się js/aura.js (bufor śladu, czyta
 * ten stan przez updateAndDraw()).
 *
 * Ten sam podział co plonacyPalec.js/podmuch.js (stan oddzielony od
 * rysowania), ale prostszy cykl: BEZCZYNNY -> AKTYWNA -> BEZCZYNNY, bez
 * drugiego gestu. aktywuj() startuje natychmiast - to jest odpowiedź
 * na ograniczenie globalne #6 tego planu.
 */

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
const CZAS_TRWANIA_S = 30;
const CZAS_WYGASZANIA_S = 3;     // ostatnie 3 s - ślad się skraca, nie ucina

// Tempo obrotu barwy. MIN > 0 celowo - "stoisz, tęcza płynie leniwie"
// (spec), nie zamrożona. MAX to pełny obrót co ~1.6 s przy pełnym ruchu.
const OBROT_MIN_DEG_S = 24;
const OBROT_MAX_DEG_S = 220;

export class Tecza {
    constructor() {
        this.aktywna = false;
        this.pozostaloS = 0;
        this.barwaHue = 0;
        this.silaSladu = 0;
    }

    /** Kombos splot x3 złożony. Zawsze RESTARTUJE licznik - nigdy nie sumuje. */
    aktywuj() {
        this.aktywna = true;
        this.pozostaloS = CZAS_TRWANIA_S;
    }

    /**
     * @param {number} ruch  0..1 - ciągłość ruchu (motionMeter.responsywnosc)
     * @param {number} dt    sekundy
     */
    update(ruch, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        if (!this.aktywna) {
            this.silaSladu = 0;
            return;
        }

        this.pozostaloS -= krok;
        if (this.pozostaloS <= 0) {
            this.aktywna = false;
            this.pozostaloS = 0;
            this.silaSladu = 0;
            return;
        }

        const r = Number.isFinite(ruch) ? Math.max(0, Math.min(1, ruch)) : 0;
        const tempo = OBROT_MIN_DEG_S + (OBROT_MAX_DEG_S - OBROT_MIN_DEG_S) * r;
        this.barwaHue = (this.barwaHue + tempo * krok) % 360;

        // Rampa wygaszania: pełna siła, dopóki zostało więcej niż
        // CZAS_WYGASZANIA_S, potem liniowo do zera - to jest "ślad się
        // skraca", nie ucięcie.
        this.silaSladu = this.pozostaloS >= CZAS_WYGASZANIA_S
            ? 1
            : this.pozostaloS / CZAS_WYGASZANIA_S;
    }
}
