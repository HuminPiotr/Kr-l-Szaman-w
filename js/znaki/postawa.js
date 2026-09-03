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
 * ================== SKALA BARKÓW ==================
 *
 * Rozstaw barków w metrach - jednostka odniesienia dla wszystkich odległości.
 *
 * LICZONA W PEŁNYM 3D, I TO JEST NAPRAWA BŁĘDU. Poprzednia wersja brała
 * sqrt(dx² + dy²), pomijając z. Gdy tułów jest obrócony, rozstaw barków
 * przenosi się częściowo do osi z: dx i dy maleją, wynik zapadał się w
 * stronę podłogi 0.12, podczas gdy realny rozstaw to ~0.27-0.32 m (pomiar
 * na żywym nagraniu, tools/probki/). Skala robiła się kilkukrotnie za mała,
 * więc KAŻDY próg wyrażony w jej wielokrotnościach robił się kilkukrotnie
 * za luźny.
 *
 * Rozstaw barków to wymiar sztywnego ciała - w pełnym 3D jest
 * NIEZMIENNIKIEM OBROTU, więc obrót tułowia przestaje na cokolwiek wpływać.
 */
export function skalaCiala(wl) {
    // Wygładzona wartość wygrywa, jeśli istnieje - patrz aktualizujSkale.
    if (_skalaEma !== null) return _skalaEma;
    return skalaChwilowa(wl);
}

/** Rozstaw z TEJ klatki, bez historii. Publiczna, bo osobno testowana. */
export function skalaChwilowa(wl) {
    const a = wl?.[BARK_L], b = wl?.[BARK_P];
    if (!a || !b) return 0.12;
    const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Podłoga chroni przed dzieleniem przez zero przy zepsutych punktach.
    return Number.isFinite(d) ? Math.max(0.12, d) : 0.12;
}

// EMA skali. Skala jest STAŁĄ CIAŁA, nie pomiarem z klatki, więc mocne
// wygładzenie jest tu poprawne z definicji - i zjada szum osi z, którą
// MediaPipe szacuje mniej pewnie niż x i y.
//
// Stan modułowy, aktualizowany raz na klatkę z main.js - ten sam wzorzec
// co dawne aktualizujSlady(): kilka znaków dzieli jedną skalę, a gdyby
// każdy liczył ją we własnym score(), wygładzanie biegłoby wielokrotnie
// szybciej niż powinno.
let _skalaEma = null;
const CZAS_WYGLADZANIA_S = 1.0;

/** Raz na klatkę, PRZED znaki.ocen(). */
export function aktualizujSkale(wl, dt) {
    const s = skalaChwilowa(wl);
    if (!widoczne(wl, [BARK_L, BARK_P])) return;
    const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    if (_skalaEma === null) { _skalaEma = s; return; }
    const alpha = Math.min(1, krok / CZAS_WYGLADZANIA_S);
    _skalaEma += alpha * (s - _skalaEma);
}

/** Testy i przełączanie między próbkami muszą móc zacząć od czystego stanu. */
export function resetSkali() {
    _skalaEma = null;
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
