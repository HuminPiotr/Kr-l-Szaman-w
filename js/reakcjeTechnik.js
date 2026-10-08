/**
 * Reakcje między technikami (spec docs/superpowers/specs/2026-10-03-reakcje-
 * technik-design.md). Jedyne miejsce, które łączy techniki: każda wystawia małe
 * API (geometria + jedna metoda efektu), a tu sprawdzamy warunki i wołamy efekty.
 * Techniki dalej się nie znają - każdą da się wyjąć jednym commitem; reakcja
 * z nią po prostu przestaje zachodzić.
 *
 *  - PRZEWODZENIE: Łuk Peruna + Kręgi Mokoszy ("woda przewodzi prąd"). Co
 *    ODSTEP_PRZEWODZENIA łuk wypuszcza odnogę do kręgu, a kręgi się elektryzują.
 *  - BURZA W MGLE: Mgła Mokoszy + (Łuk Peruna albo piorun Gromu w Ziemię).
 *    Co 60-150 ms mgła błyska od źródła wyładowania.
 *  - ROZDARCIE: Grzmot (jedna klatka wybuchu) + Mgła Mokoszy (dziura,
 *    mgla.rozepchnij) i/lub Kurzawa (szarpnięcie pasów). 1 jednostka na pole.
 *  - ZAWIANIE: każdy nowy poryw Zawieruchy znosi Mgłę i/lub pasy Kurzawy
 *    w swoją stronę. 1 jednostka na pole na poryw.
 *
 * klatka() zwraca JEDNOSTKI reakcji z tej klatki; main.js przekazuje je do
 * punkty.reakcja() z literalnymi id (strażnik w tools/test-punkty.mjs).
 * Najwyżej 1 jednostka na reakcję na klatkę - duże dt (powrót na kartę) nie
 * robi lawiny punktów. Efekty rysują techniki w kolejnej klatce.
 */
export const NASTAWY = {
    ODSTEP_PRZEWODZENIA: 0.3,               // s
    BLYSK_ODSTEP_MIN: 0.06, BLYSK_ODSTEP_MAX: 0.15,   // s
    SILA_BLYSKU_LUK: 0.8, SILA_BLYSKU_GROM: 1.0
};

const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * Punkt na elipsie kręgu `indeks` po stronie celu - czysta funkcja.
 * @param {{cx, cy, squash, promienie:number[]}} geom  z kregiMokoszy.geometria()
 * @returns {{x,y}|null}
 */
export function punktNaKregu(geom, cel, indeks) {
    const R = geom?.promienie?.[indeks];
    if (!Number.isFinite(R) || !punktOk(cel) || !Number.isFinite(geom.squash) || geom.squash <= 0) return null;
    const kat = Math.atan2((cel.y - geom.cy) / geom.squash, cel.x - geom.cx);
    return { x: geom.cx + Math.cos(kat) * R, y: geom.cy + Math.sin(kat) * R * geom.squash };
}

export class ReakcjeTechnik {
    constructor() {
        this._doPrzewodzenia = 0;
        this._doBlysku = 0;
    }

    /**
     * @param {{lukPeruna, kregiMokoszy, mglaMokoszy, piorun, grzmot, kurzawa, zawierucha}} t  instancje technik
     * @param {number} dt  s
     * @param {() => number} [los]  wstrzykiwany do testów
     * @returns {{przewodzenie:number, burzaWMgle:number, rozdarcie:number, zawianie:number}}
     */
    klatka(t, dt, los = Math.random) {
        const N = NASTAWY;
        const wynik = { przewodzenie: 0, burzaWMgle: 0, rozdarcie: 0, zawianie: 0 };
        const krok = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        const { lukPeruna: luk, kregiMokoszy: kregi, mglaMokoszy: mgla, piorun, grzmot, kurzawa, zawierucha } = t ?? {};

        // --- Przewodzenie ---
        const geom = luk?.aktywny && kregi?.aktywny ? kregi.geometria?.() : null;
        if (geom?.promienie?.length) {
            this._doPrzewodzenia -= krok;
            if (this._doPrzewodzenia <= 0) {
                const idx = Math.min(geom.promienie.length - 1, Math.floor(los() * geom.promienie.length));
                const cel = punktNaKregu(geom, luk.srodek?.(), idx);
                if (cel && luk.wyladowanieDo(cel)) {
                    kregi.naelektryzuj();
                    wynik.przewodzenie = 1;
                }
                this._doPrzewodzenia = N.ODSTEP_PRZEWODZENIA;
            }
        } else {
            this._doPrzewodzenia = 0;   // pierwsze wyładowanie od razu przy kolejnym spotkaniu
        }

        // --- Burza w mgle ---
        const zLuku = !!luk?.aktywny;
        if (mgla?.aktywny && (zLuku || piorun?.aktywny)) {
            this._doBlysku -= krok;
            if (this._doBlysku <= 0) {
                const zrodlo = zLuku ? luk.srodek?.() : piorun.punktUderzenia;
                if (punktOk(zrodlo) && mgla.rozblysk(zrodlo, zLuku ? N.SILA_BLYSKU_LUK : N.SILA_BLYSKU_GROM)) {
                    wynik.burzaWMgle = 1;
                }
                this._doBlysku = N.BLYSK_ODSTEP_MIN + los() * (N.BLYSK_ODSTEP_MAX - N.BLYSK_ODSTEP_MIN);
            }
        } else {
            this._doBlysku = 0;
        }

        // --- Rozdarcie --- (wybuch żyje jedną klatkę - patrz js/grzmot.js)
        const wybuch = grzmot?.wybuch;
        if (punktOk(wybuch)) {
            const s = Number.isFinite(wybuch.sila) ? wybuch.sila : 1;
            if (mgla?.aktywny && mgla.rozepchnij?.(wybuch, s)) wynik.rozdarcie++;
            if (kurzawa?.aktywny && kurzawa.szarpnij?.(s)) wynik.rozdarcie++;
        }

        // --- Zawianie --- (porywySwieze żyją jedną klatkę - patrz js/zawierucha.js)
        for (const p of Array.isArray(zawierucha?.porywySwieze) ? zawierucha.porywySwieze : []) {
            if (p?.kierunek !== 1 && p?.kierunek !== -1) continue;
            if (mgla?.aktywny && mgla.znies?.(p.kierunek, 1, p.yPasa)) wynik.zawianie++;
            if (kurzawa?.aktywny && kurzawa.znies?.(p.kierunek, 1)) wynik.zawianie++;
        }
        return wynik;
    }
}
