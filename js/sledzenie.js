/**
 * Śledzenie ciała dla technik, które TRWAJĄ i PODĄŻAJĄ za graczem (proste
 * combo 2026-10-02: Kamienna Tarcza, Kurzawa, Łuk Peruna, Wodna Kula, Mgła).
 *
 * Kołowrót zamraża zaczep w chwili zapal() - to wystarcza efektowi, który
 * rośnie i gaśnie w miejscu. Te techniki krążą WOKÓŁ ciała albo trzymają się
 * DŁONI przez kilka sekund, więc czytają zaczep co klatkę z `frame`.
 *
 * Kotwica wygładza zaczep (MediaPipe drga o kilka px między klatkami) i
 * TRZYMA ostatni znany stan, gdy dłoń/poza zniknie - efekt nie gaśnie i nie
 * skacze do środka ekranu (GEMINI.md §2: nic nie mówi źle).
 *
 * Konwencja jak w kolowrot.js:kregSylwetki - `landmarks` (2D) do rysowania,
 * barki 11/12 jako jedyna miara ciała (biodra często poza kadrem).
 */
const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * @returns {{x:number, y:number}[]}  0-2 środki dłoni w px, POSORTOWANE PO X -
 *   MediaPipe nie trzyma stałego indeksu dłoni między klatkami, a łuk/kula
 *   rozpięte między dłońmi przeskakiwałyby przy każdej zamianie.
 */
export function dlonieKlatki(frame, W, H) {
    const wynik = [];
    for (const d of frame?.hands ?? []) {
        const a = d?.landmarks?.[0], b = d?.landmarks?.[9];
        if (!punktOk(a) || !punktOk(b)) continue;
        wynik.push({ x: ((a.x + b.x) / 2) * W, y: ((a.y + b.y) / 2) * H });
    }
    wynik.sort((p, q) => p.x - q.x);
    return wynik.slice(0, 2);
}

/** @returns {{x:number, y:number, skala:number}|null}  środek barków i ich szerokość w px; null bez pozy */
export function barkiKlatki(frame, W, H) {
    const lm = frame?.pose?.landmarks;
    if (!lm || !punktOk(lm[11]) || !punktOk(lm[12])) return null;
    const skala = Math.hypot((lm[11].x - lm[12].x) * W, (lm[11].y - lm[12].y) * H);
    if (!(skala > 1)) return null;
    return { x: ((lm[11].x + lm[12].x) / 2) * W, y: ((lm[11].y + lm[12].y) / 2) * H, skala };
}

/** Wygładzony zaczep o dowolnych polach liczbowych ({x,y}, {x,y,skala}, {x,y,r}). */
export class Kotwica {
    /** @param {number} szybkosc  1/s - im więcej, tym ciaśniej za celem */
    constructor(szybkosc = 14) {
        this.szybkosc = szybkosc;
        this.stan = null;
    }

    get znana() { return this.stan !== null; }

    reset() { this.stan = null; }

    /**
     * @param {object|null} cel  null albo pole z NaN = "nie widać" -> trzyma ostatni stan
     * @param {number} dt
     * @returns {object|null}
     */
    prowadz(cel, dt) {
        const celOk = !!cel && Object.values(cel).every(Number.isFinite);
        if (!celOk) return this.stan;
        if (!this.stan) { this.stan = { ...cel }; return this.stan; }
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const a = 1 - Math.exp(-this.szybkosc * krok);
        for (const k of Object.keys(cel)) {
            const s = this.stan[k];
            this.stan[k] = Number.isFinite(s) ? s + (cel[k] - s) * a : cel[k];
        }
        return this.stan;
    }
}

/**
 * Nastawy TozsamoscDloni - eksportowane, żeby testy liczyły z tych samych stałych.
 * Wszystkie prędkości w skali barków na sekundę (nie w px - patrz GEMINI.md).
 */
export const TOZSAMOSC = {
    LASKA_S: 0.7,          // s - zgubiona dłoń trzyma swój koniec w miejscu
    PRZEJSCIE_S: 0.5,      // s - skala odpięcia (0..1) dla przygaszania; sam dryf idzie z VDRYF
    GORA_MNOZNIK: 2.2,     // skala * to - wysokość "wyładowania w górę" nad widoczną dłonią
    VDRYF_MNOZNIK: 4,      // skala/s - prędkość, z jaką odpięty koniec wędruje nad widoczną dłoń
    VMAX_MNOZNIK: 3.5,     // skala/s - limit prędkości końca WRACAJĄCEGO do dłoni po zgubieniu
    POWROT_PO_S: 0.15,     // s - krótsze zgubienie (mrugnięcie trackera) nie ogranicza prędkości
    SZYBKOSC: 22,          // 1/s - wygładzanie końca śledzącego widoczną dłoń
    PROG_DOJAZDU: 0.05,    // skala - bliżej niż to = koniec dojechał, wraca zwykłe śledzenie
    DALEKO_MNOZNIK: 1.5    // skala - nowa dłoń dalej niż to od znanego slotu zajmuje PUSTY slot
};

/**
 * Tożsamość dłoni dla efektów rozpiętych MIĘDZY dwiema dłońmi (Łuk Peruna).
 *
 * Wcześniej końce łuku przypisywałem po KOLEJNOŚCI od lewej (dlonieKlatki
 * sortuje po x). Gdy kamera gubiła lewą dłoń, prawa stawała się "pierwszą" i
 * łuk przeskakiwał; po powrocie dłoni skakał z powrotem. Tu każdy z dwóch
 * slotów pamięta SWOJĄ dłoń: widoczną dłoń przypisujemy do najbliższego slotu.
 *
 *  - dłoń zgubiona: jej slot STOI w ostatnim miejscu (okres łaski, LASKA_S);
 *  - potem slot FIZYCZNIE wędruje (VDRYF) nad widoczną dłoń drugiego slotu, więc
 *    łuk płynnie przechodzi w "wyładowanie w górę". Dryf jest stanem slotu, nie
 *    interpolacją przy rysowaniu - dzięki temu powrót dłoni nie powoduje wskoku;
 *  - dłoń wraca po dłuższym zgubieniu (>POWROT_PO_S): slot leci do niej z
 *    ograniczoną prędkością (VMAX), nie wskakuje. Mrugnięcie trackera ją nie ogranicza;
 *  - obie dłonie zgubione: oba sloty stoją, nic nie odlatuje.
 */
export class TozsamoscDloni {
    constructor() { this.reset(); }

    reset() { this._sloty = [null, null]; }

    /**
     * @param {{x,y}[]} dlonie  z dlonieKlatki() (0-2 punkty, w px)
     * @param {number} skala    szerokość barków w px
     * @param {number} dt       s
     * @returns {{a: object|null, b: object|null}}  slot: {x, y, widoczna, brak, odpiecie 0..1};
     *   null = slot nigdy nie widziany
     */
    prowadz(dlonie, skala, dt) {
        const T = TOZSAMOSC;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const sk = Number.isFinite(skala) && skala > 1 ? skala : 200;
        const reki = (Array.isArray(dlonie) ? dlonie : []).filter(punktOk).slice(0, 2);
        const S = this._sloty;
        const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

        // --- Przypisanie widocznych dłoni do slotów (po tożsamości, nie po kolejności) ---
        let przyp = [null, null];
        if (reki.length === 1) {
            const r = reki[0];
            const znane = [0, 1].filter(i => S[i]);
            let i = 0;
            if (znane.length) {
                i = znane.reduce((naj, k) => d(S[k], r) < d(S[naj], r) ? k : naj, znane[0]);
                const pusty = [0, 1].find(k => !S[k]);
                // Dłoń daleko od jedynego znanego slotu = raczej DRUGA ręka niż ta sama.
                if (pusty !== undefined && d(S[i], r) > T.DALEKO_MNOZNIK * sk) i = pusty;
            }
            przyp[i] = r;
        } else if (reki.length === 2) {
            const [l, p] = reki;
            if (S[0] && S[1]) przyp = d(S[0], l) + d(S[1], p) <= d(S[0], p) + d(S[1], l) ? [l, p] : [p, l];
            else if (S[0]) przyp = d(S[0], l) <= d(S[0], p) ? [l, p] : [p, l];
            else if (S[1]) przyp = d(S[1], p) <= d(S[1], l) ? [l, p] : [p, l];
            else przyp = [l, p];
        }

        // --- Aktualizacja slotów ---
        for (let i = 0; i < 2; i++) {
            const r = przyp[i];
            let s = S[i];
            if (r) {
                if (!s) { S[i] = { x: r.x, y: r.y, brak: 0, powrot: false }; continue; }
                if (s.brak > T.POWROT_PO_S) s.powrot = true;
                s.brak = 0;
                const dx = r.x - s.x, dy = r.y - s.y, dl = Math.hypot(dx, dy);
                if (s.powrot) {
                    const ruch = Math.min(dl, T.VMAX_MNOZNIK * sk * krok);
                    if (dl > 1e-9) { s.x += dx / dl * ruch; s.y += dy / dl * ruch; }
                    if (dl - ruch < T.PROG_DOJAZDU * sk) s.powrot = false;
                } else {
                    const a = 1 - Math.exp(-T.SZYBKOSC * krok);
                    s.x += dx * a; s.y += dy * a;
                }
            } else if (s) {
                s.brak += krok;
            }
        }
        // Dryf zgubionego końca nad widoczną dłoń drugiego slotu (dopiero po okresie łaski).
        for (let i = 0; i < 2; i++) {
            const s = S[i], inny = S[1 - i];
            if (!s || przyp[i] || s.brak <= T.LASKA_S || !inny || !przyp[1 - i]) continue;
            const cx = inny.x, cy = inny.y - sk * T.GORA_MNOZNIK;
            const dx = cx - s.x, dy = cy - s.y, dl = Math.hypot(dx, dy);
            const ruch = Math.min(dl, T.VDRYF_MNOZNIK * sk * krok);
            if (dl > 1e-9) { s.x += dx / dl * ruch; s.y += dy / dl * ruch; }
        }

        const wyjscie = (i) => S[i] && {
            x: S[i].x, y: S[i].y, widoczna: !!przyp[i], brak: S[i].brak,
            odpiecie: Math.max(0, Math.min(1, (S[i].brak - T.LASKA_S) / T.PRZEJSCIE_S))
        };
        return { a: wyjscie(0) ?? null, b: wyjscie(1) ?? null };
    }
}
