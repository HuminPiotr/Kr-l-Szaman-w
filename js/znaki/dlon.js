/**
 * Wspólne narzędzia dla pieczęci składanych DŁOŃMI.
 *
 * Lustrzane odbicie postawa.js, tylko dla 21 punktów dłoni. Powstało PRZED
 * pierwszą pieczęcią, bo inaczej te same obliczenia (skala dłoni, wyprostowanie
 * palca) rozjechałyby się na trzy kopie - dokładnie z tego powodu istnieje
 * postawa.js.
 *
 * ZASADA: czytamy SYLWETKĘ, nie przeplot. MediaPipe zgaduje punkty zasłonięte
 * przez inne palce i gubi nachodzące na siebie dłonie, więc nie sprawdzamy
 * splecenia. Sprawdzamy tylko to, co widać pewnie: które palce wystają i jak
 * dłonie stoją względem siebie.
 *
 * Punkty MediaPipe Hands:
 *   0        nadgarstek
 *   1-4      kciuk        (4 = opuszek)
 *   5-8      wskazujący   (8 = opuszek)
 *   9-12     środkowy     (12 = opuszek)
 *   13-16    serdeczny    (16 = opuszek)
 *   17-20    mały         (20 = opuszek)
 */

// rampa jest czystą matematyką i już istnieje w postawa.js - powielanie jej
// dałoby dwa miejsca do rozjechania się. Importujemy i reeksportujemy,
// żeby pieczęcie dłoniowe brały ją stąd, a nie z modułu o postawach ciała.
import { rampa } from './postawa.js';
export { rampa };

export const NADGARSTEK = 0;
export const OPUSZKI = [4, 8, 12, 16, 20];

// Każdy palec jako łańcuch punktów od nasady do opuszka. Kciuk ma o jeden
// staw mniej, dlatego lista, a nie arytmetyka na indeksach.
export const PALCE = {
    kciuk:       [1, 2, 3, 4],
    wskazujacy:  [5, 6, 7, 8],
    srodkowy:    [9, 10, 11, 12],
    serdeczny:   [13, 14, 15, 16],
    maly:        [17, 18, 19, 20]
};
export const NAZWY_PALCOW = ['kciuk', 'wskazujacy', 'srodkowy', 'serdeczny', 'maly'];

// Prostota palca: |nasada→opuszek| / (suma długości członów).
// 1.0 = idealnie prosty, mniej = zgięty. Ta sama miara, którą perun.js
// stosuje do ramienia - działa bez znajomości skali i bez osi Z.
const PROSTY_MIN = 0.80;
const PROSTY_PELNY = 0.96;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function zdrowy(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** Czy wszystkie potrzebne punkty dłoni są sensowne. */
export function pelnaDlon(lm) {
    if (!lm || lm.length < 21) return false;
    for (let i = 0; i < 21; i++) if (!zdrowy(lm[i])) return false;
    return true;
}

/**
 * Skala dłoni - odcinek nadgarstek → nasada środkowego palca.
 *
 * Jednostka dla wszystkich progów. Dzięki temu pieczęcie działają tak samo
 * blisko i daleko od kamery, bez znajomości głębi.
 */
export function skalaDloni(lm) {
    return Math.max(1e-6, dist(lm[NADGARSTEK], lm[9]));
}

/**
 * Ciągła miara wyprostowania palca, 0..1.
 *
 * CIĄGŁA, nie binarna - reguła nadrzędna gry obowiązuje także tutaj:
 * palec wyprostowany w połowie ma dawać pół wyniku, nie zero.
 */
export function wyprostowany(lm, nazwaPalca) {
    const p = PALCE[nazwaPalca];
    let przez = 0;
    for (let i = 0; i < p.length - 1; i++) przez += dist(lm[p[i]], lm[p[i + 1]]);
    if (!(przez > 1e-6)) return 0;
    const prosto = dist(lm[p[0]], lm[p[p.length - 1]]) / przez;
    return rampa(prosto, PROSTY_MIN, PROSTY_PELNY);
}

/** Wzór palców jako pięć wartości 0..1, w kolejności NAZWY_PALCOW. */
export function wzorPalcow(lm) {
    return NAZWY_PALCOW.map(n => wyprostowany(lm, n));
}

/** Ile palców jest wyprostowanych (suma ciągła, nie licznik). */
export function ileWyprostowanych(lm) {
    return wzorPalcow(lm).reduce((s, v) => s + v, 0);
}

/**
 * Odległość nadgarstków w skalach dłoni.
 *
 * To ta liczba rozróżnia Węża (dłonie płasko przy sobie, nadgarstki blisko)
 * od Konia (tylko opuszki się dotykają, nadgarstki rozsunięte). Oba układy
 * mają wszystkie palce wyprostowane, więc bez tego byłyby nieodróżnialne.
 */
export function odlegloscNadgarstkow(a, b) {
    const skala = (skalaDloni(a) + skalaDloni(b)) / 2;
    return dist(a[NADGARSTEK], b[NADGARSTEK]) / skala;
}

/** Średnia odległość opuszek jednej dłoni od odpowiadających opuszek drugiej. */
export function zbieznoscOpuszek(a, b) {
    const skala = (skalaDloni(a) + skalaDloni(b)) / 2;
    let suma = 0;
    for (const i of OPUSZKI) suma += dist(a[i], b[i]);
    return (suma / OPUSZKI.length) / skala;
}

/**
 * Kierunek dłoni: wektor nadgarstek → nasada środkowego palca, znormalizowany.
 * Służy do sprawdzenia, czy palce idą w górę i czy dłonie są równoległe.
 */
export function kierunekDloni(lm) {
    const a = lm[NADGARSTEK], b = lm[9];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    return d > 1e-6 ? { x: dx / d, y: dy / d } : { x: 0, y: -1 };
}

/** 1 = palce prosto w górę, 0 = w poziomie lub w dół. Oś Y rośnie W DÓŁ. */
export function skierowanaWGore(lm) {
    return Math.max(0, -kierunekDloni(lm).y);
}

/** 1 = dłonie równoległe (ten sam kierunek), 0 = prostopadłe lub przeciwne. */
export function rownolegle(a, b) {
    const ka = kierunekDloni(a), kb = kierunekDloni(b);
    return Math.max(0, ka.x * kb.x + ka.y * kb.y);
}

/** Rozstaw opuszek w obrębie JEDNEJ dłoni, w skalach dłoni (dla Striboga). */
export function rozstawOpuszek(lm) {
    const skala = skalaDloni(lm);
    let suma = 0;
    for (let i = 0; i < OPUSZKI.length - 1; i++) {
        suma += dist(lm[OPUSZKI[i]], lm[OPUSZKI[i + 1]]);
    }
    return (suma / (OPUSZKI.length - 1)) / skala;
}
