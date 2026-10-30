/**
 * Kolejka taktu - technika rzucona w transie startuje na najbliższe uderzenie
 * pieśni (spec 2026-10-30-trans-design.md, właściciel zgodził się na
 * opóźnienie do ~0.5 s). Czysta logika, bez DOM.
 *
 * Punkty, odkrycia i komunikat idą OD RAZU w chwili rzutu (z mnożnikiem
 * zapisanym wtedy) - tu czeka tylko efekt. Gdy rytm znika (koniec pieśni,
 * pauza), wszystko, co czeka, odpala natychmiast: technika nigdy nie przepada.
 */
export class KolejkaTaktu {
    constructor() { this._czeka = []; }   // [{czasS, zadanie}]

    get dlugosc() { return this._czeka.length; }

    /** @param {object} zadanie  dowolne dane dla wołającego  @param {number} czasS  czas pieśni startu */
    odloz(zadanie, czasS) {
        if (!Number.isFinite(czasS)) return false;
        this._czeka.push({ czasS, zadanie });
        return true;
    }

    /**
     * @param {number|null} czasPiesniS  null = brak rytmu -> oddaje wszystko od razu
     * @returns {object[]} zadania, których czas nadszedł (w kolejności odłożenia)
     */
    dojrzale(czasPiesniS) {
        if (!this._czeka.length) return [];
        const teraz = Number.isFinite(czasPiesniS) ? czasPiesniS : Infinity;
        const gotowe = [], reszta = [];
        for (const c of this._czeka) (c.czasS <= teraz ? gotowe : reszta).push(c);
        // Przewinięcie pieśni wstecz (nowa runda na tej samej pieśni) nie może zawiesić techniki.
        if (Number.isFinite(czasPiesniS)) for (let i = reszta.length - 1; i >= 0; i--) {
            if (reszta[i].czasS - czasPiesniS > 1.0) gotowe.push(...reszta.splice(i, 1));
        }
        this._czeka = reszta;
        return gotowe.map(c => c.zadanie);
    }
}
