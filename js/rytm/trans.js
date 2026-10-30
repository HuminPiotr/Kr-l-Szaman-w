/**
 * Trans - trzy stopnie budowane trwałym tańcem w rytm pieśni
 * (spec 2026-10-30-trans-design.md). Czysta logika, bez DOM.
 *
 * `poziom` 0..3 płynie w sposób ciągły: rośnie, gdy zgodność z rytmem jest
 * wysoka, stoi w strefie pośredniej, a gdy rytm się gubi - gaśnie łagodnie,
 * od najwyższego stopnia. NIC NIE MÓWI ŹLE: gaśnięcie nie ma progu porażki,
 * a mnożnik nigdy nie spada poniżej 1 (gubienie rytmu tylko przestaje dokładać).
 *
 * Mana i punkty tańca: 1 + 0.2 x poziom (1.2 / 1.4 / 1.6 na pełnych stopniach,
 * płynnie pomiędzy). Technika: z PEŁNEGO stopnia (x1.25 / 1.5 / 2) -
 * gracz widzi przy punktach równą liczbę, nie x1.37.
 */
// Progi ZMIERZONE (niżej), czasy stopni ZGADNIĘTE - stroić na kamerze.
export const NASTAWY_TRANSU = {
    // ZMIERZONE 2026-10-30 (sesja T): właściciel chce, żeby trans był łatwy - przy 0.6/0.35
    // nie wszedł w stopień 1 przez całą pieśń swobodnego tańca.
    PROG_WZROSTU: 0.45,          // zgodność, od której trans narasta
    PROG_GASNIECIA: 0.2,         // poniżej - gaśnie; pomiędzy - trzyma się
    CZAS_STOPNIA_S: [4, 10, 15], // ile tańca w rytmie na wejście w stopień 1, 2, 3
    GASNIECIE_S: 3,              // tyle na zgaśnięcie jednego stopnia
    MANA_NA_STOPIEN: 0.2,
    MNOZNIK_TECHNIKI: [1, 1.25, 1.5, 2]
};
const N = NASTAWY_TRANSU;
export const MAX_STOPIEN = 3;

export class Trans {
    constructor() {
        this.poziom = 0;
        this.najwyzszyStopien = 0;
    }

    get stopien() { return Math.min(MAX_STOPIEN, Math.floor(this.poziom + 1e-9)); }
    get mnoznikMany() { return 1 + N.MANA_NA_STOPIEN * this.poziom; }
    get mnoznikTechniki() { return N.MNOZNIK_TECHNIKI[this.stopien]; }

    /**
     * Widoczność efektu danego stopnia 0..1 - płynne wejście i wygaszanie zamiast przeskoku.
     * Efekt stopnia s jest pełny od poziomu s, zanika liniowo w ostatnim stopniu poniżej.
     */
    sila(stopien) { return Math.max(0, Math.min(1, this.poziom - (stopien - 1))); }

    /** @param {number|null} zgodnosc  null = brak pieśni z rytmem (gaśnie jak przy zgubionym rytmie) */
    update(zgodnosc, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.poziom;
        const krok = Math.min(dt, 0.1);
        const z = Number.isFinite(zgodnosc) ? zgodnosc : 0;
        if (z >= N.PROG_WZROSTU && this.poziom < MAX_STOPIEN) {
            const s = Math.min(MAX_STOPIEN - 1, Math.floor(this.poziom));
            this.poziom = Math.min(MAX_STOPIEN, this.poziom + krok / N.CZAS_STOPNIA_S[s]);
        } else if (z < N.PROG_GASNIECIA) {
            this.poziom = Math.max(0, this.poziom - krok / N.GASNIECIE_S);
        }
        if (!Number.isFinite(this.poziom)) this.poziom = 0;
        this.najwyzszyStopien = Math.max(this.najwyzszyStopien, this.stopien);
        return this.poziom;
    }
}
