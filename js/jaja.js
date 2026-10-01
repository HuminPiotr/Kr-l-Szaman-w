/**
 * Jaja z nickami-bogami: gracz o imieniu "Perun" dostaje piorun na ekranie Kroniki.
 * Rozpoznanie jest CZYSTE (testy w node); sam efekt to `odpalJajo` w js/techniki.js
 * (ten sam worek zależności co odpalTechnike).
 */
export const BOGOWIE = ['perun', 'swarog', 'stribog', 'mokosz', 'weles'];

/**
 * Nick -> bóg albo null. Odporne na wielkość liter, polskie znaki ("Swaróg") i sufiks
 * dubla w Kręgu ("Perun 2" - Krag dopisuje numer, gdy dwóch tancerzy ma to samo imię).
 * Tylko CAŁE imię: "Perunek" ani "Wielki Perun" nie są bogami.
 */
export function bogZNicku(nick) {
    if (typeof nick !== 'string') return null;
    const n = nick.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // ó -> o, ę -> e ...
        .replace(/ł/g, 'l')                                  // ł nie rozkłada się w NFD
        .replace(/\s+\d$/, '');                              // sufiks dubla Kręgu
    return BOGOWIE.includes(n) ? n : null;
}
