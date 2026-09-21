/**
 * Histereza dwuprogowa - jeden bit stanu (wewnątrz/na zewnątrz) z osobnym
 * progiem wejścia i wyjścia, żeby wartość migocząca WOKÓŁ jednego progu nie
 * przełączała stanu tam i z powrotem co klatkę. Ten sam wzorzec, który już
 * istnieje w grze rozproszony po kilku modułach (dmuchanie.js:80-81
 * PROG_WEJSCIA/PROG_WYJSCIA, plonacyPalec.js WETO_DRUGIEGO_OD/DO) -
 * wydzielony tu, żeby HUD (main.js: .charged-glow/.ready-pulse) miał to
 * samo narzędzie zamiast gołego porównania `moc >= 0.95`, które łamało
 * regułę histerezy z GEMINI.md §2 ("progi mają histerezę; nic nie miga
 * na granicy").
 *
 * PROG_WEJSCIA musi być > PROG_WYJSCIA (wchodzimy wyżej, niż schodzimy) -
 * konstruktor tego NIE waliduje (to błąd wywołującego, nie danych z
 * kamery), ale update() jest odporne na złe/NaN dane wejściowe, bo TE
 * już pochodzą z pomiaru.
 */
export class Histereza {
    /**
     * @param {number} progWejscia  próg, PRZY i POWYŻEJ którego stan wchodzi (staje się prawdą)
     * @param {number} progWyjscia  próg, PONIŻEJ którego stan wychodzi (staje się fałszem); < progWejscia
     */
    constructor(progWejscia, progWyjscia) {
        this.progWejscia = progWejscia;
        this.progWyjscia = progWyjscia;
        this._stan = false;
    }

    get stan() { return this._stan; }

    /**
     * @param {number} x  bieżąca wartość mierzona
     * @returns {boolean} stan PO aktualizacji
     */
    update(x) {
        if (!Number.isFinite(x)) return this._stan;   // brak danych nie zmienia stanu (GEMINI.md §2)
        if (!this._stan && x >= this.progWejscia) this._stan = true;
        else if (this._stan && x < this.progWyjscia) this._stan = false;
        return this._stan;
    }
}
