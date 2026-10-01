/**
 * Skróty klawiszowe vs pola tekstowe.
 *
 * Menu ma pierwsze w grze pola tekstowe (nick tancerza, lista Kręgu), a skróty gry
 * (M - wyciszenie, D/R/N/Z/1-8 - debug) słuchają na `window` bez sprawdzania celu.
 * Bez tego wpisanie "Mokosz" albo "Zuzia" przełącza dźwięk, otwiera panel debug
 * i startuje sesję nagraniową. Każdy skrót literowy MUSI zacząć od tego sprawdzenia.
 */
const TEKSTOWE = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/**
 * @param {{tagName?:string, type?:string, isContentEditable?:boolean}|null} el  e.target zdarzenia
 * @returns {boolean} true, gdy w tym elemencie gracz PISZE (skrót ma wtedy milczeć)
 */
export function czyPoleTekstowe(el) {
    if (!el || typeof el !== 'object') return false;
    if (el.isContentEditable === true) return true;
    const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    // <input> bez typu to pole tekstowe; checkbox/radio/button/file nie przyjmują liter.
    const typ = typeof el.type === 'string' && el.type ? el.type.toLowerCase() : 'text';
    return TEKSTOWE.has(typ);
}
