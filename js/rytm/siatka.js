/**
 * Siatka uderzeń pieśni - "gdzie jesteśmy w takcie" w danej sekundzie pieśni
 * (spec 2026-10-30-trans-design.md). Czysta logika, bez DOM.
 *
 * Dwie postaci rytmu z manifestu (js/piesni.js walidujRytm):
 *  - równa siatka: bpm + pierwszeUderzenieS,
 *  - lista uderzeń: pieśni Suno lekko pływają (dryf 0.16-0.36 s), więc
 *    tools/analiza-rytmu.mjs zapisuje dokładne czasy; poza listą siatka
 *    przedłuża się średnim okresem.
 */
export class SiatkaUderzen {
    /** @param {{bpm:number, pierwszeUderzenieS:number, uderzenia:number[]|null}} rytm */
    constructor(rytm) {
        this.okresS = 60 / rytm.bpm;
        this._p = rytm.pierwszeUderzenieS;
        this._u = Array.isArray(rytm.uderzenia) && rytm.uderzenia.length >= 2 ? rytm.uderzenia : null;
    }

    /** @returns {SiatkaUderzen|null} null, gdy pieśń nie ma rytmu - wtedy nie ma transu */
    static z(rytm) {
        return rytm && rytm.bpm > 0 && Number.isFinite(rytm.pierwszeUderzenieS) ? new SiatkaUderzen(rytm) : null;
    }

    /** Czas uderzenia o indeksie i (może być ujemny - przed pierwszym). */
    czasUderzenia(i) {
        const u = this._u;
        if (!u) return this._p + i * this.okresS;
        if (i < 0) return u[0] + i * this.okresS;
        if (i >= u.length) return u[u.length - 1] + (i - u.length + 1) * this.okresS;
        return u[i];
    }

    /** Indeks ostatniego uderzenia <= tS. */
    _indeks(tS) {
        const u = this._u;
        if (!u) return Math.floor((tS - this._p) / this.okresS);
        if (tS < u[0]) return Math.floor((tS - u[0]) / this.okresS);
        if (tS >= u[u.length - 1]) return u.length - 1 + Math.floor((tS - u[u.length - 1]) / this.okresS);
        let lo = 0, hi = u.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (u[m] <= tS) lo = m; else hi = m; }
        return lo;
    }

    /**
     * @returns {{indeks:number, faza01:number, okresS:number} | null}
     *   faza01 = 0 dokładnie w uderzeniu, ->1 tuż przed następnym; okresS = lokalny odstęp.
     */
    faza(tS) {
        if (!Number.isFinite(tS)) return null;
        const i = this._indeks(tS);
        const a = this.czasUderzenia(i), b = this.czasUderzenia(i + 1);
        const okresS = b - a;
        if (!(okresS > 0)) return null;
        return { indeks: i, faza01: Math.max(0, Math.min(0.999999, (tS - a) / okresS)), okresS };
    }

    /**
     * Najbliższe NASTĘPNE uderzenie, ale nie dalej niż maxS: gdy uderzenia są
     * rzadsze, wolno wziąć połowę uderzenia (spec: technika w transie czeka <= ~0.5 s).
     * @returns {number|null} czas pieśni [s]
     */
    nastepneUderzenieS(tS, maxS = 0.5) {
        const f = this.faza(tS);
        if (!f) return null;
        const a = this.czasUderzenia(f.indeks), b = this.czasUderzenia(f.indeks + 1);
        if (b - tS <= maxS) return b;
        const polowa = (a + b) / 2;
        return polowa > tS && polowa - tS <= maxS ? polowa : tS;
    }
}
