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
// Zakres CELOWO szeroki. Wąski (0.80-0.96) dawał skok wyniku 0.48 między
// krokami zwijania palca - czyli próg, nie rampę. Reguła nadrzędna wymaga,
// żeby palec zwinięty w połowie dawał połowę wyniku.
const PROSTY_MIN = 0.62;
const PROSTY_PELNY = 0.97;

// Ile palców musi być złożonych, żeby uznać dłoń za pięść.
//
// Zakres CELOWO szeroki. Przy wąskim (0.45-0.85) wynik trzymał zero do
// połowy zwinięcia, a potem przeskakiwał o 0.3 na krok - czyli próg, nie
// rampa. Dłoń zwinięta w połowie ma dawać połowę wyniku (reguła nadrzędna),
// więc pieczęć składa się wtedy wolniej, a nie wcale.
const ZWINIETA_MIN = 0.22;
const ZWINIETA_PELNA = 0.97;

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

/**
 * Odległość między ŚRODKAMI CIĘŻKOŚCI opuszek obu dłoni, w skalach dłoni.
 *
 * Świadomie NIE parujemy palca ze palcem. Kuszące "wskazujący do wskazującego"
 * jest kruche: w namiocie (pieczęć Konia) dłonie są obrócone palcami ku sobie
 * i widziane niemal z profilu, więc wachlarz palców schodzi w GŁĘBIĘ, której
 * nie mierzymy. Sprawdzone na dłoni syntetycznej: przy odbiciu lustrzanym małe
 * palce niemal się stykały (0.03), a kciuki były 0.23 od siebie - średnia z par
 * dawała 1.43 i namiot nie dawał się złożyć, mimo że wyglądał poprawnie.
 *
 * Środek ciężkości odpowiada wprost na pytanie "czy opuszki zeszły się razem"
 * i nie zależy od tego, który palec spotyka który.
 */
export function zbieznoscOpuszek(a, b) {
    const skala = (skalaDloni(a) + skalaDloni(b)) / 2;
    return dist(srodekOpuszek(a), srodekOpuszek(b)) / skala;
}

/** Środek ciężkości pięciu opuszek jednej dłoni. */
export function srodekOpuszek(lm) {
    let x = 0, y = 0;
    for (const i of OPUSZKI) { x += lm[i].x; y += lm[i].y; }
    return { x: x / OPUSZKI.length, y: y / OPUSZKI.length };
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

/**
 * Najlepsza para dłoni wraz z ROZBICIEM na składniki.
 *
 * Rozbicie nie jest ozdobą. Wszystkie pieczęcie liczą wynik jako MINIMUM
 * kilku warunków, więc gdy pieczęć nie wychodzi, sam wynik ("0.31") nie mówi
 * KTÓRY warunek blokuje. Gracz musiał odkrywać metodą prób, jak ułożyć palce -
 * a to znak, że diagnostyka była niewystarczająca, nie że gracz źle próbował.
 *
 * @param {object} frame
 * @param {(a, b) => object} ocenPary  zwraca mapę nazwa -> 0..1
 * @returns {{ wynik: number, skladniki: object|null }}
 */
export function najlepszaPara(frame, ocenPary) {
    const h = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (h.length < 2) return { wynik: 0, skladniki: null };

    let najlepsze = null, najlepszy = -1;
    for (let i = 0; i < h.length; i++) {
        for (let j = i + 1; j < h.length; j++) {
            const s = ocenPary(h[i].landmarks, h[j].landmarks);
            const w = Math.min(...Object.values(s));
            if (w > najlepszy) { najlepszy = w; najlepsze = s; }
        }
    }
    return { wynik: Math.max(0, najlepszy), skladniki: najlepsze };
}

/**
 * Ciągłe "mieści się w przedziale", 0..1. Narasta od `od`, spada za `do`.
 *
 * Potrzebne, bo część warunków ma DWIE granice, nie jedną. Odległość dłoni
 * w Tygrysie jest tego przykładem: za blisko i detektor gubi jedną dłoń
 * (zmierzone: przy maksymalnym ścisku), za daleko i to już nie jest pieczęć.
 */
export function pasmo(v, od, doPelni, odSpadku, doZera) {
    return Math.min(rampa(v, od, doPelni), 1 - rampa(v, odSpadku, doZera));
}

/**
 * Zwinięcie dłoni w pięść, 0..1 - odwrotność wyprostowania.
 *
 * Kciuk POMIJANY. To najmniej pewny punkt na dłoni, a w pięści bywa i schowany,
 * i położony na wierzchu palców - oba układy są poprawną pięścią.
 */
export function zwinieta(lm) {
    const w = wzorPalcow(lm);
    const bezKciuka = (w[1] + w[2] + w[3] + w[4]) / 4;
    return rampa(1 - bezKciuka, ZWINIETA_MIN, ZWINIETA_PELNA);
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
