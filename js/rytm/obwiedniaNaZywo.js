/**
 * Obwiednia uderzeń NA ŻYWO - wersja strumieniowa obwiedniaUderzen() z
 * js/rytm/analizaRytmu.js (spec 2026-10-30-sluch-design.md). Czysta logika.
 *
 * Ta sama matematyka (przyrost log-widma w dwóch pasmach, odjęcie lokalnej
 * średniej), ale PRZYCZYNOWO - tylko z przeszłości:
 *  - normalizacja pasm średnią kroczącą (~10 s) zamiast średniej z całej pieśni,
 *  - odjęcie lokalnej średniej z ostatnich LOKALNA_SREDNIA_S zamiast okna wokół.
 * Wejście w kawałkach dowolnej długości i z dowolnym sr (mikrofon: 48 kHz,
 * AudioWorklet: kawałki po 128 próbek) - decymacja do ~11 kHz uśrednianiem.
 *
 * Każda ramka ma czas [s] w zegarze wołającego (AudioContext.currentTime pierwszej
 * próbki kawałka) - czas ramki = czas jej POCZĄTKU; korekta szczytu (KOREKTA_S)
 * należy do śledzenia, jak w analizie plików.
 */
import { fft, NASTAWY_ANALIZY as NA } from './analizaRytmu.js';

export const NASTAWY_OBWIEDNI = {
    SR_DOCELOWE: 11025,
    TAU_NORMALIZACJI_S: 10,
    WAGA_BASU: NA.WAGA_BASU    // pliki 0.7; mikrofon (głośniki laptopa mają mało basu) - stroić z sesji S
};

export class ObwiedniaNaZywo {
    /** @param {number} sr  @param {{wagaBasu?: number}} [opcje] */
    constructor(sr, { wagaBasu = NASTAWY_OBWIEDNI.WAGA_BASU } = {}) {
        this.dziel = Math.max(1, Math.round(sr / NASTAWY_OBWIEDNI.SR_DOCELOWE));
        this.sr = sr / this.dziel;
        this.wagaBasu = wagaBasu;
        this.klatekNaS = this.sr / NA.HOP;
        const n = NA.OKNO;
        this._okno = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
        this._bufor = new Float64Array(n);   // ostatnie OKNO próbek po decymacji (pierścień)
        this._zapelnienie = 0;
        this._doRamki = n;                   // próbek do następnej ramki
        this._kBasu = Math.max(2, Math.round(NA.GORA_BASU_HZ * n / this.sr));
        this._re = new Float64Array(n); this._im = new Float64Array(n);
        this._poprzednie = null;
        this._mC = 0; this._mB = 0;          // średnie kroczące pasm
        this._lokalne = [];                  // ostatnie wartości mieszanki (do lokalnej średniej)
        this._dec = 0; this._decN = 0;       // akumulator decymacji
        this._licznik = 0;                   // próbek po decymacji od startu
        this._t0 = null;                     // czas pierwszej próbki po decymacji
    }

    /**
     * @param {Float32Array|number[]} pcm  mono
     * @param {number} czasS  czas pierwszej próbki kawałka w zegarze wołającego
     * @returns {{t:number, wartosc:number}[]} nowe ramki obwiedni
     */
    dodaj(pcm, czasS) {
        const out = [];
        if (!pcm?.length) return out;
        const dt = 1 / (this.sr * this.dziel);
        for (let i = 0; i < pcm.length; i++) {
            const v = pcm[i];
            this._dec += Number.isFinite(v) ? v : 0;
            if (++this._decN < this.dziel) continue;
            const probka = this._dec / this.dziel;
            this._dec = 0; this._decN = 0;
            const t = Number.isFinite(czasS) ? czasS + (i - this.dziel + 1) * dt : null;
            if (this._t0 === null && t !== null) this._t0 = t - this._licznik / this.sr;
            this._bufor[this._licznik % NA.OKNO] = probka;
            this._licznik++;
            if (--this._doRamki > 0) continue;
            this._doRamki = NA.HOP;
            const r = this._ramka();
            if (r !== null && this._t0 !== null) out.push({ t: this._t0 + (this._licznik - NA.OKNO) / this.sr, wartosc: r });
        }
        return out;
    }

    _ramka() {
        const n = NA.OKNO, pol = n / 2, start = this._licznik % n;
        for (let i = 0; i < n; i++) { this._re[i] = this._bufor[(start + i) % n] * this._okno[i]; this._im[i] = 0; }
        fft(this._re, this._im);
        const widmo = new Float64Array(pol);
        let s = 0, b = 0;
        for (let k = 1; k < pol; k++) {
            widmo[k] = Math.log1p(100 * Math.hypot(this._re[k], this._im[k]));
            if (this._poprzednie) {
                const d = widmo[k] - this._poprzednie[k];
                if (d > 0) { s += d; if (k < this._kBasu) b += d; }
            }
        }
        const pierwsza = !this._poprzednie;
        this._poprzednie = widmo;
        if (pierwsza) return null;
        const a = 1 / (NASTAWY_OBWIEDNI.TAU_NORMALIZACJI_S * this.klatekNaS);
        this._mC = this._mC ? this._mC + a * (s - this._mC) : s;
        this._mB = this._mB ? this._mB + a * (b - this._mB) : b;
        const flux = this.wagaBasu * b / (this._mB || 1) + (1 - this.wagaBasu) * s / (this._mC || 1);
        const ile = Math.max(1, Math.round(NA.LOKALNA_SREDNIA_S * this.klatekNaS));
        this._lokalne.push(flux);
        if (this._lokalne.length > ile) this._lokalne.shift();
        let sr = 0;
        for (const v of this._lokalne) sr += v;
        const w = Math.max(0, flux - sr / this._lokalne.length);
        return Number.isFinite(w) ? w : 0;
    }
}
