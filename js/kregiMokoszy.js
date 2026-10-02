/**
 * Kręgi Mokoszy - nagroda za combo mokosz -> weles (proste combo 2026-10-02,
 * przeprojektowane 2026-10-03). Od ciała gracza, na wysokości pasa, co ~1 s
 * wystrzeliwuje świetlista FALA UDERZENIOWA: gruby turkusowy krąg, który
 * rośnie, cienieje i blednie, a pod sobą lekko "rozpycha" obraz z kamery.
 *
 * HISTORIA (po testach na kamerze właściciela):
 *  - Wodna Kula (kula wody między dłońmi z soczewką) - "totalny niewypał":
 *    kamera gubi dłonie, więc kula skakała. Lekcja: efekty przyczepione do
 *    BARKÓW działają, do dłoni - nie. Tu nic nie zależy od dłoni;
 *  - v1 Kręgów: tafla wody + kręgi fal (grzbiet/dolina, source-over) + krople -
 *    "ma być bardziej eteryczne, nie musi naśladować wody, okręgi mają być
 *    efektowne";
 *  - v2 (ta): fala uderzeniowa - trzy warstwy 'lighter' (szeroka poświata,
 *    węższa, jasny rdzeń), soczewka refrakcyjna pod kręgiem i rozbłysk przy
 *    narodzinach. Tafla i krople usunięte.
 *
 * SOCZEWKA - ten sam mechanizm co ekran.js _falaPowietrza (Aard): kopia sceny
 * z prostokąta wokół pierścienia, narysowana z powrotem przeskalowana wokół
 * środka kręgu, przycięta do pierścienia (evenodd). Najmocniejsza zaraz po
 * narodzinach kręgu, potem słabnie.
 *
 * Tył kręgu (górna połowa elipsy, sin<0) rysuje się ZA sylwetką
 * (js/warstwaZaSylwetka.js), przód przed nią; soczewka obejmuje cały pierścień.
 */
import { simplex3 } from './szum.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    POZIOM_MNOZNIK: 1.3,          // skala * to pod barkami = wysokość kręgów (pas)
    DOL_EKRANU: 0.9,              // nigdy niżej niż H * to
    EMISJA_S: 4.5,                // s - przez tyle rodzą się nowe kręgi
    ODSTEP_KREGOW: 1.0,           // s
    ZYCIE_KREGU: 1.6,             // s
    PROMIEN_OD: 0.6, PROMIEN_DO: 5.5,   // skala * to
    SQUASH: 0.28,                 // płaska elipsa wokół pasa
    FALOWANIE: 0.02,              // ułamek promienia - krąg nie jest idealną elipsą
    PUNKTOW_KREGU: 72,
    // Warstwy świecenia [grubość px przy narodzinach, alfa] - od najszerszej poświaty do rdzenia.
    WARSTWY: [[18, 0.15], [8, 0.35], [2.5, 0.9]],
    GRUBOSC_KONCOWA: 0.4,         // mnożnik grubości pod koniec życia kręgu
    SOCZEWKA_GRUBOSC: 0.35,       // skala * to - szerokość pierścienia zniekształcenia
    WYBRZUSZENIE: 0.06,           // maks. powiększenie obrazu pod kręgiem (6 %)
    MARGINES_PX: 8,
    BLYSK_ZYCIE: 0.25,            // s
    BLYSK_PROMIEN: 1.2,           // skala * to
    BLYSK_ALFA: 0.7,
    NAROST: 0.2, WYGASZENIE: 1.0, // s
    BARWA: [80, 220, 255],        // turkus Mokoszy
    BARWA_RDZENIA: [225, 250, 255]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/** Wysokość kręgów w px: pas gracza, przycięty do kadru (biodra bywają poza nim). */
export function poziomWody(zaczep, H) {
    return Math.min(zaczep.y + zaczep.skala * NASTAWY.POZIOM_MNOZNIK, H * NASTAWY.DOL_EKRANU);
}

/**
 * Stan kręgu o wieku `wiek` (s) - czysta funkcja.
 * @returns {{promien, alfa, grubosc, soczewka}|null}  promien w skali barków,
 *   grubosc = mnożnik grubości warstw, soczewka 0..1; null poza życiem
 */
export function stanKregu(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek < 0 || wiek >= N.ZYCIE_KREGU) return null;
    const p = wiek / N.ZYCIE_KREGU;
    const ease = 1 - Math.pow(1 - p, 3);   // szybki wystrzał, potem zwalnia
    return {
        promien: N.PROMIEN_OD + (N.PROMIEN_DO - N.PROMIEN_OD) * ease,
        alfa: Math.pow(1 - p, 1.3) * Math.min(1, p / 0.05),
        grubosc: 1 + (N.GRUBOSC_KONCOWA - 1) * p,
        soczewka: (1 - p) * (1 - p)
    };
}

/** Rozbłysk przy narodzinach kręgu. @returns {{alfa}|null} */
export function stanBlysku(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek < 0 || wiek >= N.BLYSK_ZYCIE) return null;
    return { alfa: 1 - wiek / N.BLYSK_ZYCIE };
}

/**
 * Punkty kręgu (zamknięta, lekko falująca elipsa) - czysta funkcja.
 * @returns {{x, y, przod:boolean}[]}  PUNKTOW_KREGU+1 punktów, ostatni = pierwszy
 */
export function punktyKregu(cx, cy, R, t, seed) {
    const N = NASTAWY;
    const pkt = [];
    for (let i = 0; i <= N.PUNKTOW_KREGU; i++) {
        const kat = (i % N.PUNKTOW_KREGU) / N.PUNKTOW_KREGU * Math.PI * 2;
        const r = R * (1 + N.FALOWANIE * simplex3(Math.cos(kat) * 1.5, Math.sin(kat) * 1.5, t * 0.6 + seed));
        pkt.push({ x: cx + Math.cos(kat) * r, y: cy + Math.sin(kat) * r * N.SQUASH, przod: Math.sin(kat) > 0 });
    }
    return pkt;
}

/**
 * Prostokąt kopii sceny pod pierścieniem soczewki (zewnętrzna elipsa + margines),
 * przycięty do płótna - czysta funkcja.
 * @returns {{x0, y0, w, h}|null}  null, gdy pierścień całkiem poza kadrem
 */
export function prostokatSoczewki(cx, cy, R, grubosc, W, H) {
    const N = NASTAWY;
    const rx = R + grubosc / 2 + N.MARGINES_PX, ry = (R + grubosc / 2) * N.SQUASH + N.MARGINES_PX;
    const x0 = Math.max(0, Math.floor(cx - rx)), y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(W, Math.ceil(cx + rx)), y1 = Math.min(H, Math.ceil(cy + ry));
    const w = x1 - x0, h = y1 - y0;
    return w >= 2 && h >= 2 ? { x0, y0, w, h } : null;
}

/** Linia po punktach - tylko odcinki z jednej strony ciała, ciągłe odcinki jedną ścieżką. */
function rysujStrone(c, pkt, przod) {
    c.beginPath();
    let rysuje = false;
    for (let i = 0; i < pkt.length - 1; i++) {
        const a = pkt[i], b = pkt[i + 1];
        if (a.przod !== przod) { rysuje = false; continue; }
        if (!rysuje) { c.moveTo(a.x, a.y); rysuje = true; }
        c.lineTo(b.x, b.y);
    }
    c.stroke();
}

export class KregiMokoszy {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._kregi = [];    // [{ wiek, seed }]
        this._blyski = [];   // [{ wiek }]
        this._doKregu = 0;
        this._urodzone = 0;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._plotno = null;
        this._plotnoCtx = null;
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kregi = [];
        this._blyski = [];
        this._doKregu = 0;
        this._urodzone = 0;
        this._kotwica.reset();
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; this._kregi = []; this._blyski = []; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const sk = this.zaczep.skala, cx = this.zaczep.x, cy = poziomWody(this.zaczep, H);

        for (const kr of this._kregi) kr.wiek += krok;
        for (const b of this._blyski) b.wiek += krok;
        this._kregi = this._kregi.filter(kr => kr.wiek < N.ZYCIE_KREGU);
        this._blyski = this._blyski.filter(b => b.wiek < N.BLYSK_ZYCIE);
        if (this._t < N.EMISJA_S) {
            this._doKregu -= krok;
            if (this._doKregu <= 0) {
                this._kregi.push({ wiek: 0, seed: Math.random() * 100 });
                this._blyski.push({ wiek: 0 });
                this._urodzone++;
                this._doKregu += N.ODSTEP_KREGOW;
            }
        }
        if (!ctx) return;   // guard PO zegarze, zaczepie i narodzinach - patrz kolowrot.js

        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        const kregi = this._kregi.map(kr => {
            const st = stanKregu(kr.wiek);
            return st && { st, pkt: punktyKregu(cx, cy, sk * st.promien, this._t, kr.seed) };
        }).filter(Boolean);

        // 1. Soczewki - zniekształcają scenę, więc PRZED rysowaniem świecenia.
        for (const { st } of kregi) this._soczewka(ctx, cx, cy, sk * st.promien, sk * N.SOCZEWKA_GRUBOSC * st.grubosc, st.soczewka * alfa, W, H);

        // 2. Świecenie: TYŁ za sylwetką, potem PRZÓD.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._swiecenie(tyl, kregi, false, alfa);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        this._swiecenie(ctx, kregi, true, alfa);

        // 3. Rozbłyski przy narodzinach kręgu.
        this._rozblyski(ctx, cx, cy, sk, alfa);
    }

    _swiecenie(c, kregi, przod, alfa) {
        const N = NASTAWY;
        const [r, g, b] = N.BARWA, [rr, gr, br] = N.BARWA_RDZENIA;
        c.save();
        c.globalCompositeOperation = 'lighter';   // eteryczna energia - świeci
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const { st, pkt } of kregi) {
            N.WARSTWY.forEach(([grubosc, a], i) => {
                const [cr, cg, cb] = i === N.WARSTWY.length - 1 ? [rr, gr, br] : [r, g, b];
                c.lineWidth = grubosc * st.grubosc;
                c.strokeStyle = `rgba(${cr},${cg},${cb},${(a * st.alfa * alfa).toFixed(3)})`;
                rysujStrone(c, pkt, przod);
            });
        }
        c.restore();
    }

    _rozblyski(ctx, cx, cy, sk, alfa) {
        const N = NASTAWY;
        const [r, g, b] = N.BARWA_RDZENIA;
        for (const bl of this._blyski) {
            const st = stanBlysku(bl.wiek);
            if (!st) continue;
            const R = sk * N.BLYSK_PROMIEN * (0.6 + 0.4 * (1 - st.alfa));
            const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
            gr.addColorStop(0, `rgba(${r},${g},${b},${(N.BLYSK_ALFA * st.alfa * alfa).toFixed(3)})`);
            gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.ellipse(cx, cy, R, R * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    /** Soczewka refrakcyjna pod pierścieniem - mechanizm ekran.js _falaPowietrza. */
    _soczewka(ctx, cx, cy, R, grubosc, sila, W, H) {
        const N = NASTAWY;
        const k = 1 + N.WYBRZUSZENIE * clamp01(sila);
        if (k - 1 < 0.002 || typeof document === 'undefined' || !ctx.canvas) return;
        const pr = prostokatSoczewki(cx, cy, R, grubosc, W, H);
        if (!pr) return;
        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._plotnoCtx = this._plotno.getContext('2d');
        }
        // Płótno pomocnicze rośnie do potrzeb, nigdy nie maleje (zmiana rozmiaru kasuje bufor GPU).
        if (this._plotno.width < pr.w || this._plotno.height < pr.h) {
            this._plotno.width = Math.max(this._plotno.width, pr.w);
            this._plotno.height = Math.max(this._plotno.height, pr.h);
        }
        this._plotnoCtx.clearRect(0, 0, pr.w, pr.h);
        this._plotnoCtx.drawImage(ctx.canvas, pr.x0, pr.y0, pr.w, pr.h, 0, 0, pr.w, pr.h);
        const zew = R + grubosc / 2, wew = Math.max(1, R - grubosc / 2);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, zew, zew * N.SQUASH, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, wew, wew * N.SQUASH, 0, 0, Math.PI * 2);
        ctx.clip('evenodd');
        ctx.drawImage(this._plotno, 0, 0, pr.w, pr.h,
                      cx + (pr.x0 - cx) * k, cy + (pr.y0 - cy) * k, pr.w * k, pr.h * k);
        ctx.restore();
    }
}
