/**
 * Zaklinanie - stan techniki, w której JAKOŚĆ RUCHU steruje natężeniem
 * efektu (spec docs/superpowers/specs/2026-10-09-dodola-zaklinanie-design.md).
 * Pierwszy klient: Dodola (deszcz z falujących ramion, js/deszcz.js).
 *
 * Moduł nic nie wie o deszczu ani o ramionach. Dostaje MIARĘ (obiekt z
 * update(worldLandmarks, dt) -> {laczne} i reset()) oraz funkcję JAKOŚCI
 * (laczne -> 0..1). Lawa czy wichura podepną tu własną miarę bez zmian.
 *
 * Cykl: BEZCZYNNY -> ZAKLINA -> CICHNIE -> BEZCZYNNY.
 *   - zapal() otwiera ZAKLINA; powtórne combo w trakcie restartuje sufit czasu.
 *   - Natężenie to wygładzona jakość z PODŁOGĄ - mżawka jest zawsze, nawet przy
 *     złym ruchu (GEMINI.md §2: nic nie mówi źle). Narasta szybciej (1.5 s),
 *     niż opada (2.5 s) - chwila zawahania w fali nie zabiera ulewy.
 *   - Trwa, DOPÓKI gracz faluje (decyzja właściciela): kończy się po CISZA_S
 *     bez fali (liczone dopiero po GWARANCJA_S), po MAX_S albo gdy skończy się moc.
 *   - CICHNIE: natężenie liniowo do zera - deszcz nie urywa się w pół kropli.
 *
 * Pobór mocy jak przy Płonącym Palcu: update() ZWRACA, ile chce pobrać,
 * main.js pobiera przez motionMeter.zuzyj() - moc ma jednego właściciela.
 */

export const NASTAWY = {
    GLUCHE_S: 1.0,            // wyjście z pieczęci powietrza + rozgrzanie okna miary
    PODLOGA: 0.08,            // mżawka - nigdy zero
    NAROST_TAU_S: 1.5,
    OPADANIE_TAU_S: 2.5,
    PROG_PODTRZYMANIA: 0.15,  // jakość poniżej = gracz nie zaklina
    GWARANCJA_S: 3.0,         // tyle trwa zawsze, zanim zacznie się liczyć cisza
    CISZA_S: 3.0,
    MAX_S: 20.0,
    CICHNIECIE_S: 3.0,
    POBOR_NA_S: 0.02,         // ułamek paska mocy na sekundę przy pełnej ulewie (×0.3 przy mżawce)
    MAX_DT: 0.1
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export class Zaklinanie {
    /**
     * @param {{miara: {update: Function, reset?: Function}, jakosc: (m: object|null) => number}} opcje
     */
    constructor({ miara, jakosc } = {}) {
        this.miara = miara;
        this.ocena = jakosc;
        this.stan = 'BEZCZYNNY';
        this.natezenie = 0;     // 0..1 - steruje efektem
        this.jakosc = 0;        // 0..1 chwilowa - do HUD
        this.skladniki = null;  // surowe składniki miary - do HUD
        this.powodKonca = null; // 'cisza' | 'czas' | 'moc' - do HUD
        this._t = 0;
        this._cisza = 0;
        this._tCichniecia = 0;
        this._natezenieCichniecia = 0;
    }

    get aktywny() { return this.stan !== 'BEZCZYNNY'; }
    get zaklina() { return this.stan === 'ZAKLINA'; }

    zapal() {
        if (this.stan === 'BEZCZYNNY') {
            this.miara?.reset?.();
            this.natezenie = 0;
        }
        this.stan = 'ZAKLINA';
        this._t = 0;
        this._cisza = 0;
        this.powodKonca = null;
        this.natezenie = Math.max(this.natezenie, NASTAWY.PODLOGA);
    }

    /**
     * @param {Array|null} worldLandmarks  metryczne 3D z MediaPipe
     * @param {number} moc   0..1 z MotionMeter; nieskończona/brak = bez limitu (stanowisko VFX)
     * @param {number} dt    s
     * @returns {number} ile mocy pobrać w tej klatce (>= 0)
     */
    update(worldLandmarks, moc, dt) {
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(N.MAX_DT, dt)) : 0;
        if (this.stan === 'BEZCZYNNY') {
            this.natezenie = 0;
            this.jakosc = 0;
            return 0;
        }

        // Miara chodzi także w CICHNIE: ponowne zapalenie zaraz po końcu
        // nie zaczyna od pustego okna.
        let laczne = null;
        try { laczne = this.miara?.update(worldLandmarks, krok)?.laczne ?? null; } catch { laczne = null; }
        this.skladniki = laczne;

        if (this.stan === 'CICHNIE') {
            this.jakosc = 0;
            this._tCichniecia += krok;
            const u = clamp01(1 - this._tCichniecia / N.CICHNIECIE_S);
            this.natezenie = this._natezenieCichniecia * u;
            if (u <= 0) { this.stan = 'BEZCZYNNY'; this.natezenie = 0; }
            return 0;
        }

        // --- ZAKLINA ---
        this._t += krok;
        let q = 0;
        if (this._t >= N.GLUCHE_S) {
            try { q = clamp01(this.ocena?.(laczne)); } catch { q = 0; }
        }
        this.jakosc = q;

        const cel = Math.max(N.PODLOGA, q);
        const tau = cel > this.natezenie ? N.NAROST_TAU_S : N.OPADANIE_TAU_S;
        this.natezenie += (cel - this.natezenie) * (1 - Math.exp(-krok / tau));
        this.natezenie = Math.max(N.PODLOGA, clamp01(this.natezenie));

        if (this._t >= N.GWARANCJA_S) {
            this._cisza = q < N.PROG_PODTRZYMANIA ? this._cisza + krok : 0;
        }

        const limitMocy = Number.isFinite(moc);
        const zapas = limitMocy ? Math.max(0, moc) : Infinity;
        let pobor = N.POBOR_NA_S * (0.3 + 0.7 * this.natezenie) * krok;
        pobor = Math.min(pobor, zapas);

        let powod = null;
        if (this._cisza >= N.CISZA_S) powod = 'cisza';
        else if (this._t >= N.MAX_S) powod = 'czas';
        else if (limitMocy && zapas <= 1e-4) powod = 'moc';
        if (powod) {
            this.powodKonca = powod;
            this.stan = 'CICHNIE';
            this._tCichniecia = 0;
            this._natezenieCichniecia = this.natezenie;
        }
        return Number.isFinite(pobor) && pobor > 0 ? pobor : 0;
    }
}
