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
