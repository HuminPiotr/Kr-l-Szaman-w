/**
 * Okres ruchu - dominujący okres tańca (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Klocek wspólny: fala przez ciało liczy opóźnienie jako UŁAMEK tego okresu,
 * płynność skaluje nim próg szarpnięcia, a w etapie 2 ten sam okres będzie
 * "pulsem tańca" (źródło rytmu, gdy nie gra żadna muzyka).
 *
 * Autokorelacja POZYCJI, nie prędkości:
 *  - |v| kołysania powtarza się co PÓŁ okresu (|cos|) - dawałoby 2x częstotliwość,
 *  - |v| okręgu ze stałą prędkością jest płaskie - nie miałoby szczytu wcale.
 * Każdy staw i każda oś to osobna seria (po odjęciu średniej) - ręce w przeciwfazie
 * się nie znoszą, bo autokorelacja każdej serii jest dodatnia przy jej okresie.
 */
import { clamp01 } from './pochodne.js';

const STAWY = [15, 16, 13, 14, 27, 28]; // nadgarstki, łokcie, kostki

// ZGADNIĘTE poza MIN_ODCHYLENIE_M (z pomiaru szumu) - wszystko niżej nie było strojone na nagraniach.
export const NASTAWY_OKRESU = {
    OKNO_S: 4.0,             // (ZGADNIĘTE)
    MIN_OKRES_S: 0.25,       // (ZGADNIĘTE)
    MAX_OKRES_S: 2.5,        // (ZGADNIĘTE)
    CO_ILE_S: 0.25,          // autokorelacja co tyle, nie co klatkę
    MIN_ODCHYLENIE_M: 0.03,  // seria o mniejszym rozrzucie to szum (sigma ~0.009 m) - nie głosuje
    BLISKO_SZCZYTU: 0.85,    // pierwszy szczyt >= 85% najwyższego wygrywa - bez tego czasem 2T   (ZGADNIĘTE)
    MIN_ROZPIETOSC_S: 1.5,   // okno krótsze niż tyle nie orzeka   (ZGADNIĘTE)
    ZANIK_PEWNOSCI_S: 2.0,   // bez pozy pewność gaśnie do zera w tyle   (ZGADNIĘTE)
    PROG_WIDOCZNOSCI: 0.5,
    MAX_PRZERWA_S: 0.2       // krótsza dziura (migotanie śledzenia) nie kasuje okna ani serii   (ZGADNIĘTE)
};
export const PROG_PEWNOSCI = 0.4;

const N = NASTAWY_OKRESU;
const zdrowy = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
                      (p.visibility === undefined || p.visibility >= N.PROG_WIDOCZNOSCI);

export class Okres {
    constructor() {
        this.okresS = 1;
        this.pewnosc = 0;
        this._bufor = [];        // [{t, p: ([x, y] | null)[]}]
        this._t = 0;
        this._bezPozyS = 0;
        this._doPrzeliczenia = 0;
    }

    /** null, gdy okres niepewny - konsument ma wtedy zachować się jak dziś. */
    get czestotliwoscHz() {
        return this.pewnosc >= PROG_PEWNOSCI && this.okresS > 0 ? 1 / this.okresS : null;
    }

    update(world, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this;
        const krok = Math.min(dt, 0.1);
        this._t += krok;

        // Brak pozy w klatce to przerwa, nie koniec tańca: pojedyncze migotanie
        // śledzenia (kilka razy na sekundę) kasowałoby okno i trzymało pewność przy 0.
        // Krótką przerwę zapisujemy jako wpis bez stawów (null) - odstępy próbek
        // zostają równe, a _przelicz wypełni dziurę interpolacją. Dopiero przerwa
        // dłuższa niż MAX_PRZERWA_S czyści okno i wygasza pewność jak dawniej.
        if (!world) {
            this._bezPozyS += krok;
            if (this._bezPozyS > N.MAX_PRZERWA_S) {
                this._bufor.length = 0;
                this.pewnosc = Math.max(0, this.pewnosc - krok / N.ZANIK_PEWNOSCI_S);
                return this;
            }
            this._bufor.push({ t: this._t, p: STAWY.map(() => null) });
            while (this._bufor.length && this._t - this._bufor[0].t > N.OKNO_S) this._bufor.shift();
            return this;
        }
        this._bezPozyS = 0;

        this._bufor.push({ t: this._t, p: STAWY.map(i => (zdrowy(world[i]) ? [world[i].x, world[i].y] : null)) });
        while (this._bufor.length && this._t - this._bufor[0].t > N.OKNO_S) this._bufor.shift();

        this._doPrzeliczenia -= krok;
        if (this._doPrzeliczenia <= 0) {
            this._doPrzeliczenia = N.CO_ILE_S;
            this._przelicz();
        }
        return this;
    }

    _przelicz() {
        const b = this._bufor, n = b.length;
        if (n < 8 || b[n - 1].t - b[0].t < N.MIN_ROZPIETOSC_S) { this.pewnosc = 0; return; }
        const dtSr = (b[n - 1].t - b[0].t) / (n - 1);
        if (!(dtSr > 0)) { this.pewnosc = 0; return; }

        const serie = [];
        for (let s = 0; s < STAWY.length; s++) {
            for (let os = 0; os < 2; os++) {
                const x = new Float64Array(n);
                for (let j = 0; j < n; j++) { const p = b[j].p[s]; x[j] = p ? p[os] : NaN; }
                if (!wypelnijPrzerwy(x, dtSr)) continue;   // dziura dłuższa niż MAX_PRZERWA_S - seria nie głosuje
                let suma = 0;
                for (let j = 0; j < n; j++) suma += x[j];
                const m = suma / n;
                let war = 0;
                for (let j = 0; j < n; j++) { x[j] -= m; war += x[j] * x[j]; }
                if (Math.sqrt(war / n) < N.MIN_ODCHYLENIE_M) continue;
                serie.push(x);
            }
        }
        if (!serie.length) { this.pewnosc = 0; return; }

        const lagMin = Math.max(1, Math.round(N.MIN_OKRES_S / dtSr));
        const lagMax = Math.min(Math.floor(n * 0.6), Math.round(N.MAX_OKRES_S / dtSr));
        if (lagMax - lagMin < 2) { this.pewnosc = 0; return; }

        const r = new Float64Array(lagMax + 2);
        for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
            if (lag < 1 || lag >= n) continue;
            let s = 0, e1 = 0, e2 = 0;
            for (const x of serie) {
                for (let j = 0; j + lag < n; j++) {
                    s += x[j] * x[j + lag]; e1 += x[j] * x[j]; e2 += x[j + lag] * x[j + lag];
                }
            }
            r[lag] = s / (Math.sqrt(e1 * e2) + 1e-12);
        }

        const szczyt = (lag) => r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1];
        let najR = -Infinity;
        for (let lag = lagMin; lag <= lagMax; lag++) if (szczyt(lag) && r[lag] > najR) najR = r[lag];
        if (!(najR > 0)) { this.pewnosc = 0; return; }

        let wybrany = -1;
        for (let lag = lagMin; lag <= lagMax; lag++) {
            if (szczyt(lag) && r[lag] >= N.BLISKO_SZCZYTU * najR) { wybrany = lag; break; }
        }
        if (wybrany < 0) { this.pewnosc = 0; return; }

        // Doprecyzowanie parabolą przez trzy punkty - bez tego okres skacze o całą klatkę.
        const a = r[wybrany - 1], c = r[wybrany], d = r[wybrany + 1];
        const mian = a - 2 * c + d;
        const delta = mian < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - d) / mian)) : 0;
        const okres = (wybrany + delta) * dtSr;
        if (Number.isFinite(okres) && okres > 0) this.okresS = okres;
        this.pewnosc = clamp01(c);
    }
}

/**
 * Wypełnia NaN-y (próbki bez widocznego stawu) liniową interpolacją między
 * sąsiadami; dziura na brzegu bierze najbliższą znaną wartość. Interpolacja,
 * nie pominięcie, bo autokorelacja zakłada równe odstępy próbek.
 * Zwraca false, gdy któraś dziura jest dłuższa niż MAX_PRZERWA_S albo nie ma
 * żadnej znanej próbki - stawu, który znikał na dłużej, nie zgadujemy.
 */
function wypelnijPrzerwy(x, dtSr) {
    const n = x.length;
    let j = 0;
    while (j < n) {
        if (!Number.isNaN(x[j])) { j++; continue; }
        let k = j;
        while (k < n && Number.isNaN(x[k])) k++;
        if ((k - j) * dtSr > N.MAX_PRZERWA_S + 1e-9) return false;
        if (j === 0 && k === n) return false;
        const lewa = j > 0 ? x[j - 1] : x[k];
        const prawa = k < n ? x[k] : x[j - 1];
        for (let i = j; i < k; i++) x[i] = lewa + (prawa - lewa) * (i - j + 1) / (k - j + 1);
        j = k;
    }
    return true;
}
