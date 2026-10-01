/**
 * Mapa pieczęć -> runa Elder Futharku.
 *
 * Runy zastępują animację okręgu przy składaniu pieczęci (js/runa.js) i
 * karmią pasek sekwencji (js/sekwencja.js). MODUŁ CZYSTY - żadnego dotyku
 * `document` na poziomie modułu, importowalny w Node bez DOM (ten sam
 * kontrakt co js/assety.js: ładowanie fontu jest ASYNCHRONICZNE i idzie
 * przez zaladujFont(), nigdy przy imporcie).
 *
 * DOBÓR GLIFÓW jest świadomy, nie przypadkowy:
 *   - ᚲ Kenaz  (ogień/pochodnia)      -> swarog
 *   - ᚦ Thurisaz (runa boga gromu)    -> perun
 *   - ᚢ Uruz   (tur, pierwotna siła)  -> weles (ziemia, mit Welesa-bydła)
 *   - ᚨ Ansuz  (tchnienie, oddech)    -> stribog (powietrze, też Okadzenie)
 *   - ᛚ Laguz  (jezioro, woda)        -> mokosz (woda)
 *
 * ZAKAZ Z GEMINI.md §7: "przy symbolice omijać kołowrót/swarzycę - zostały
 * zawłaszczone przez skrajną prawicę". To samo dotyczy run zawłaszczonych
 * politycznie (Sowilo/Odal/Tiwaz/Algiz w pewnych kontekstach) - ZAKAZANE
 * niżej nie występują NIGDZIE w GLIFY i test-glify.mjs tego pilnuje.
 */

export const FONT_RUN = '"Noto Sans Runic"';

// Glify wykluczone ze zbioru - patrz nagłówek. Trzymane osobno od GLIFY,
// żeby test mógł sprawdzić NIEOBECNOŚĆ, nie tylko treść mapy.
export const ZAKAZANE = ['ᛋ', 'ᛟ', 'ᛏ', 'ᛉ'];

export const GLIFY = {
    swarog:  { znak: 'ᚲ', nazwa: 'Kenaz' },
    perun:   { znak: 'ᚦ', nazwa: 'Thurisaz' },
    weles:   { znak: 'ᚢ', nazwa: 'Uruz' },
    stribog: { znak: 'ᚨ', nazwa: 'Ansuz' },
    mokosz:  { znak: 'ᛚ', nazwa: 'Laguz' }
};

/** Znak runiczny dla id pieczęci, albo null gdy nieznane. */
export function glif(id) {
    return GLIFY[id]?.znak ?? null;
}

let _fontPromise = null;

/**
 * Ładuje font runiczny. NO-OP poza przeglądarką (document.fonts nie
 * istnieje w Node) - zwraca rozwiązaną Promise, zamiast wybuchać, tak
 * żeby ten sam moduł dało się importować w tools/test-glify.mjs.
 *
 * Nigdy nie odrzuca: brak fontu (offline, wolne łącze) NIE JEST błędem
 * (GEMINI.md §2) - fontGotowy() po prostu zwróci false i rysujące moduły
 * pominą glif tej klatki, dokładnie jak assety.js pomija brakujący obrazek.
 */
export function zaladujFont() {
    if (_fontPromise) return _fontPromise;
    if (typeof document === 'undefined' || !document.fonts) {
        _fontPromise = Promise.resolve(false);
        return _fontPromise;
    }
    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 3000));
    const zaladuj = document.fonts.load(`48px ${FONT_RUN}`)
        .then(() => true)
        .catch(() => false);
    _fontPromise = Promise.race([zaladuj, timeout]);
    return _fontPromise;
}

/** Czy font jest już gotowy do rysowania na canvas (document.fonts.check). */
export function fontGotowy() {
    if (typeof document === 'undefined' || !document.fonts) return false;
    try {
        return document.fonts.check(`24px ${FONT_RUN}`);
    } catch {
        return false;
    }
}
