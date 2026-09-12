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

/**
 * Normalna płaszczyzny dłoni z worldLandmarks, znormalizowana.
 *
 * Liczona z NADGARSTKA (0) i dwóch stawów PODSTAWY palców - wskazującego (5)
 * i małego (17). Te trzy punkty nie ruszają się przy zginaniu palców
 * (zginają się dopiero stawy DALSZE), więc normalna mierzy WYŁĄCZNIE
 * orientację dłoni w przestrzeni - działa tak samo przy dłoni otwartej
 * i zaciśniętej w pięść.
 *
 * ZNAK JEST NIEJEDNOZNACZNY. Dla lewej i prawej dłoni iloczyn wektorowy
 * wychodzi w przeciwne strony, a przy obróconej dłoni MediaPipe bywa też
 * niepewne co do samej stronności. Ta funkcja daje wyłącznie OŚ - zwrot
 * (który z dwóch kierunków tej osi) rozstrzyga js/podmuch.js wektorem
 * machnięcia. Zobacz docs/superpowers/specs/2026-08-11-szczur-i-podmuch-design.md §3.
 *
 * @param {Array|null} worldLandmarks
 * @returns {{x:number,y:number,z:number}|null}
 */
export function normalnaDloni(worldLandmarks) {
    const wl = worldLandmarks;
    if (!wl || !wl[0] || !wl[5] || !wl[17]) return null;
    const w = wl[0], a = wl[5], b = wl[17];
    for (const p of [w, a, b]) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
    }
    const v1 = { x: a.x - w.x, y: a.y - w.y, z: a.z - w.z };
    const v2 = { x: b.x - w.x, y: b.y - w.y, z: b.z - w.z };
    const n = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
    const d = Math.hypot(n.x, n.y, n.z);
    return d > 1e-9 ? { x: n.x / d, y: n.y / d, z: n.z / d } : null;
}

// --- KÓŁKO Z PALCÓW (Okadzenie v8) ---
//
// Kciuk styka się z DOWOLNYM innym opuszkiem i zamyka pętlę: kciuk+wskazujący
// to małe kółko, kciuk+serdeczny albo mały - duże. Dzięki temu gracz reguluje
// wielkość jednym ruchem dłoni, a nie precyzją rozchylenia dwóch palców.
//
// PROGI ZGADNIĘTE, jak wszystkie progi dłoniowe w tym pliku - do potwierdzenia
// na żywej dłoni z nakładki (klawisz D). Zmierzone na dłoni syntetycznej
// (tools/_dlon-syntetyczna.mjs) tylko po to, żeby trafić w rząd wielkości.
// v8.1 - NAPRAWA: zmierzone na dłoni syntetycznej, że przy dłoni PŁASKIEJ
// (otwartej) kciuk leży 0.32-0.54 skali dłoni od najbliższego opuszka, a
// stare progi (0.22-0.65) uznawały to za domknięcie 0.77 - "zwykłe
// machnięcie otwartą dłonią" uruchamiało technikę. Stąd DWA zaostrzenia:
//   1. odległość opuszek zwężona - domknięcie wymaga NAPRAWDĘ stykających
//      się opuszków, nie "dłoni w ogóle otwartej w tamtą stronę";
//   2. DRUGI WARUNEK: palec (albo kciuk, przy dużej pętli to on się gnie)
//      musi być ZGIĘTY - przy dłoni płaskiej zgięcie wychodzi 0.00, więc to
//      jest sygnał, którego przy samej odległości brakowało.
// v8.2 - GRANICA MODELU SYNTETYCZNEGO, nazwana wprost: generator w
// tools/_dlon-syntetyczna.mjs zgina kciuk W MIEJSCU jak zwykły palec, bez
// OPOZYCJI przez dłoń (prawdziwy kciuk przy geście OK przesuwa się w stronę
// palca, głównie obrotem w stawie nadgarstkowo-śródręcznym). Zmierzone na tym
// modelu: kciuk obrócony, ale nie zgięty w żadnym stawie -> zgiecie = 0.00
// (metoda "prostota = dystans końców / suma odcinków" jest ślepa na obrót
// sztywnego łańcucha); a dystans opuszków przy RÓWNYM zgięciu kciuka i palca
// utyka na stałych ~0.32 niezależnie od siły zgięcia - model nigdy nie
// odtwarza realnego "domknięcia". Próg z v8.1 (0.12-0.30) był kalibrowany na
// tym niewystarczającym modelu i okazał się za ciasny na żywej dłoni (kółko
// przestało się zapalać w ogóle). WARTOŚCI PONIŻEJ USTAWIONE Z ODCZYTU HUD
// NA ŻYWEJ DŁONI (klawisz D, pola "odl"/"zgiecie"), NIE z dłoni syntetycznej -
// to jedyny wiarygodny sposób kalibracji tego warunku, patrz test-kolko.mjs.
const KOLKO_ZAMKNIETE = 0.12;    // odległość opuszek w skalach dłoni: pełne domknięcie
const KOLKO_OTWARTE = 0.30;      // ...i zero (płaska dłoń: 0.32-0.54 - poniżej progu)
const ZGIECIE_ZAMKNIETE = 0.40;  // zgięcie palca/kciuka: od tylu pełny warunek spełniony
const ZGIECIE_OTWARTE = 0.12;    // ...i zero (dłoń płaska: zgięcie 0.00)
// Pole pętli w skalach dłoni do kwadratu. Kółko "OK" to pierścień o promieniu
// ~0.2 skali, czyli pole ~0.13; pętla kciuk-mały ma promień ~0.4, czyli ~0.5.
const POLE_MALE = 0.10;
const POLE_DUZE = 0.50;
// PIERŚCIEŃ, NIE ZLEPEK - trzeci warunek (v8.4). Poszerzenie punktów kontaktu
// (patrz niżej) teoretycznie mogłoby pomylić PIĘŚĆ (kciuk leżący NA WIERZCHU
// zgiętych palców) z kółkiem - zmierzone na dłoni syntetycznej: taka pięść ma
// POLE porównywalne z małym, realnym kółkiem (0.05 vs 0.02-0.10), bo samo
// pole zależy od WIELKOŚCI pętli, a mała, prawdziwa pętla i tak jest mała.
// OKRĄGŁOŚĆ jest za to niezależna od skali - prawdziwe kółko (dowolny
// promień, dowolny palec) daje 0.74-0.84, ta sama pięść daje 0.15. Duży
// margines w obie strony pozwala postawić próg pewnie pośrodku.
const OKRAGLOSC_MIN = 0.30, OKRAGLOSC_PELNA = 0.55;

/** Pole wielokąta wzorem szuwaru (shoelace). Znak nieistotny - bierzemy moduł. */
function poleWielokata(punkty) {
    let s = 0;
    for (let i = 0; i < punkty.length; i++) {
        const a = punkty[i], b = punkty[(i + 1) % punkty.length];
        s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
}

/** Obwód wielokąta - suma długości boków. */
function obwodWielokata(punkty) {
    let s = 0;
    for (let i = 0; i < punkty.length; i++) {
        const a = punkty[i], b = punkty[(i + 1) % punkty.length];
        s += dist(a, b);
    }
    return s;
}

/**
 * Okrągłość (isoperimetric quotient) 4π·pole/obwód² - 1 dla koła, ->0 dla
 * cienkiej, wydłużonej wstęgi. SKALOWO NIEZALEŻNA (koło dwa razy większe ma
 * tę samą okrągłość) - w przeciwieństwie do samego pola, które dla MAŁEGO
 * kółka wychodzi tyle samo, co dla ZUPEŁNIE INNEGO KSZTAŁTU (patrz niżej).
 */
function okraglosc(pole, obwod) {
    return obwod > 1e-9 ? 4 * Math.PI * pole / (obwod * obwod) : 0;
}

/**
 * Otoczka wypukła (Andrew monotone chain) - pole liczymy po NIEJ, nie po
 * surowej pętli. Powód zmierzony na dłoni syntetycznej: gdy kciuk sięga do
 * dalszego palca, wielokąt pętli SAM SIEBIE PRZECINA, a wzór szuwaru odejmuje
 * wtedy przeciwnie skręconą część - kółko kciuk+środkowy wychodziło MNIEJSZE
 * niż kciuk+wskazujący, czyli odwrotnie niż w rzeczywistości.
 */
function otoczkaWypukla(punkty) {
    const p = [...punkty].sort((a, b) => (a.x - b.x) || (a.y - b.y));
    if (p.length < 3) return p;
    const krzyz = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const dol = [], gora = [];
    for (const q of p) {
        while (dol.length >= 2 && krzyz(dol[dol.length - 2], dol[dol.length - 1], q) <= 0) dol.pop();
        dol.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        while (gora.length >= 2 && krzyz(gora[gora.length - 2], gora[gora.length - 1], q) <= 0) gora.pop();
        gora.push(q);
    }
    dol.pop(); gora.pop();
    return dol.concat(gora);
}

/**
 * Kółko ułożone z palców jednej dłoni.
 *
 * Zwraca `null`, gdy punktów nie ma - BRAK DANYCH TO NIE ZERO. Wywołujący
 * (js/dmuchanie.js) ma na to własną pamięć ostatniego dobrego odczytu, bo
 * kamera z jednego oka gubi palce przy dłoni na twarzy (GEMINI.md §4).
 *
 * WIELKOŚĆ liczymy jako POLE pętli, nie odległość opuszek: odległość zeruje
 * się przy KAŻDYM domknięciu, więc nie odróżniłaby małego kółka od dużego.
 * Pętla to wielokąt kciuk(2,3,4) -> opuszek -> DIP -> PIP -> nasada palca.
 *
 * @param {Array} lm  21 punktów dłoni (landmarks 2D)
 * @returns {{domkniecie:number, wielkosc:number, palec:string}|null}
 */
export function kolkoPalcow(lm) {
    if (!pelnaDlon(lm)) return null;
    const skala = skalaDloni(lm);
    if (!(skala > 1e-6)) return null;

    // v8.4 - ODLEGŁOŚĆ SEGMENTU, NIE SAMEGO CZUBKA. Czubek kciuka i czubek
    // palca to JEDYNA para punktów w całej dłoni, która przy geście OK
    // regularnie się WZAJEMNIE ZASŁANIA - MediaPipe zgaduje ich pozycję
    // z obrazu, na którym oba się nakładają, więc realny kontakt i tak
    // zostaje odczytany jako kilka centymetrów przerwy (zmierzone: 0.13
    // skali dłoni przy prawdziwym dotyku, nie 0.00). Zamiast polegać na
    // TEJ JEDNEJ, najbardziej zaszumionej parze, bierzemy MINIMUM z czterech
    // par na końcowych odcinkach obu palców (kciuk: staw IP + czubek; palec:
    // staw DIP + czubek) - realny kontakt "OK" styka opuszki gdzieś w tym
    // rejonie, nie zawsze dokładnie czubek-w-czubek. CELOWO bez stawów
    // bliższych (MCP/nasada) - to przybliżyłoby wynik do pięści (kciuk
    // leżący w poprzek zwiniętych palców blisko ich nasad), patrz test wrogi
    // w tools/test-kolko.mjs. Minimum z 4 par jest zawsze <= starej miary
    // (czubek-czubek to jedna z tych par), więc dla gestów, które już
    // działały, wynik jest taki sam albo lepszy - bez ryzyka regresji.
    const kciukPunkty = [lm[3], lm[4]];   // IP, czubek
    let najlepszy = null;
    for (const nazwa of ['wskazujacy', 'srodkowy', 'serdeczny', 'maly']) {
        const staw = PALCE[nazwa];
        const palecPunkty = [lm[staw[2]], lm[staw[3]]];   // DIP, czubek
        let d = Infinity;
        for (const a of kciukPunkty) for (const b of palecPunkty) d = Math.min(d, dist(a, b));
        d /= skala;
        if (!najlepszy || d < najlepszy.d) najlepszy = { nazwa, staw, d };
    }
    if (!najlepszy) return null;

    const [mcp, pip, dip, tip] = najlepszy.staw;
    const otoczka = otoczkaWypukla([lm[2], lm[3], lm[4], lm[tip], lm[dip], lm[pip], lm[mcp]]);
    const pole = poleWielokata(otoczka) / (skala * skala);
    const obwod = obwodWielokata(otoczka) / skala;

    // TRZY NIEZALEŻNE warunki, wszystkie muszą być spełnione - iloczyn
    // ciągłych wyników (reguła nadrzędna: żaden nie jest twardym progiem
    // osobno). Trzeci (okrągłość) odróżnia PRAWDZIWE KÓŁKO od PIĘŚCI z
    // kciukiem na wierzchu zgiętych palców - patrz nagłówek OKRAGLOSC_MIN.
    const domknieteOpuszki = rampa(najlepszy.d, KOLKO_OTWARTE, KOLKO_ZAMKNIETE);
    const zgiecie = Math.max(1 - wyprostowany(lm, najlepszy.nazwa), 1 - wyprostowany(lm, 'kciuk'));
    const zgiety = rampa(zgiecie, ZGIECIE_OTWARTE, ZGIECIE_ZAMKNIETE);
    const pierscien = rampa(okraglosc(pole, obwod), OKRAGLOSC_MIN, OKRAGLOSC_PELNA);
    const domkniecie = domknieteOpuszki * zgiety * pierscien;

    // Wielkość liczy się tylko, gdy pętla FAKTYCZNIE jest zamknięta - bez
    // tego "wielkie kółko" mogłoby wyjść z dłoni, która niczego nie zwarła.
    return {
        domkniecie, wielkosc: rampa(pole, POLE_MALE, POLE_DUZE) * domkniecie,
        odleglosc: najlepszy.d, zgiecie, palec: najlepszy.nazwa
    };
}
