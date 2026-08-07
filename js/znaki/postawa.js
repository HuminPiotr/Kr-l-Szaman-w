/**
 * Wspólne narzędzia znaków opartych na POSTAWIE CIAŁA.
 *
 * Wszystko liczone z worldLandmarks: metry, początek w środku bioder,
 * oś Y W DÓŁ. Barki mają y ujemne, dłoń opuszczona poniżej bioder - dodatnie.
 *
 * Skalą odniesienia jest ROZSTAW BARKÓW, nie metry bezwzględne. Gest ma
 * działać tak samo u osoby wysokiej i niskiej, więc każda odległość jest
 * wyrażona w "szerokościach barków".
 */

export const BARK_L = 11,   BARK_P = 12;
export const LOKIEC_L = 13, LOKIEC_P = 14;
export const NADG_L = 15,   NADG_P = 16;
export const BIODRO_L = 23, BIODRO_P = 24;

// Ten sam próg co motionMeter.js:95. Punkt gorzej widoczny to zgadywanie
// MediaPipe, nie pomiar - jego geometria potrafi przypadkiem wysoko
// punktować. Zero znaczy tu BRAK DANYCH, nie "źle": gracz poza kadrem
// nie dostaje komunikatu o porażce (GEMINI.md §2).
export const PROG_WIDOCZNOSCI = 0.5;

/** Czy wszystkie wskazane punkty istnieją, są skończone i dostatecznie pewne. */
export function widoczne(wl, indeksy) {
    if (!wl) return false;
    for (const i of indeksy) {
        const p = wl[i];
        if (!p) return false;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
        // Gate tylko gdy MediaPipe faktycznie podał pewność - tak samo
        // jak motionMeter.js:212. Brak pola nie może blokować gestu.
        if (p.visibility !== undefined && p.visibility < PROG_WIDOCZNOSCI) return false;
    }
    return true;
}

/**
 * Rozstaw barków w metrach - jednostka odniesienia dla wszystkich odległości.
 * Podłoga chroni przed dzieleniem przez zero, gdy gracz stoi bokiem
 * i barki nakładają się w rzucie.
 */
export function skalaCiala(wl) {
    const a = wl[BARK_L], b = wl[BARK_P];
    const dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return Number.isFinite(d) ? Math.max(0.12, d) : 0.12;
}

/**
 * Ciągła rampa 0..1. Nigdy próg tak/nie - reguła nadrzędna obowiązuje
 * także tutaj: postawa ułożona w połowie daje pół wyniku.
 * Działa też malejąco (od > doPelni).
 */
export function rampa(v, od, doPelni) {
    if (!Number.isFinite(v)) return 0;
    const t = (v - od) / (doPelni - od);
    return Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
}

/** Średnia y dwóch punktów - linia barków albo linia bioder. */
export function poziom(wl, i, j) {
    return (wl[i].y + wl[j].y) / 2;
}
