/**
 * Kręgi Mokoszy - nagroda za combo mokosz -> weles (proste combo 2026-10-02,
 * przeprojektowane 2026-10-03). Od ciała gracza, na wysokości pasa, co ~1 s
 * wystrzeliwuje świetlista FALA UDERZENIOWA.
 *
 * HISTORIA (po testach na kamerze właściciela):
 *  - Wodna Kula (kula wody między dłońmi z soczewką) - "totalny niewypał":
 *    kamera gubi dłonie, więc kula skakała. Lekcja: efekty przyczepione do
 *    BARKÓW działają, do dłoni - nie. Tu nic nie zależy od dłoni;
 *  - v1 Kręgów: tafla wody + kręgi fal + krople - "ma być eteryczne, nie musi
 *    naśladować wody, okręgi mają być efektowne";
 *  - v2: proceduralne kręgi 'lighter' + soczewka - "nie powala, ale okej";
 *  - v3 (ta): TEKSTURY (Kenney, CC0): krąg z circle_03 (podwójny pierścień)
 *    spłaszczony w elipsę, barwa z turkusu w głęboki błękit w miarę
 *    rozchodzenia; błyskawiczny dysk uderzeniowy circle_01 przy narodzinach;
 *    12-16 promieni trace_* biegnących na zewnątrz PRZED krawędzią kręgu
 *    (smugi prędkości). Soczewka i cienki jasny rdzeń obręczy zostają.
 *
 * SOCZEWKA - ten sam mechanizm co ekran.js _falaPowietrza (Aard): kopia sceny
 * z prostokąta wokół pierścienia, narysowana z powrotem przeskalowana wokół
 * środka kręgu, przycięta do pierścienia (evenodd).
 *
 * GŁĘBIA: tył (górna połowa elipsy) rysuje się ZA sylwetką
 * (js/warstwaZaSylwetka.js), przód przed nią. Teksturę kręgu rysujemy dwa
 * razy, przyciętą prostokątem nad i pod poziomem środka.
 */
import { simplex3 } from './szum.js';
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
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
    FALOWANIE: 0.02,              // ułamek promienia - rdzeń nie jest idealną elipsą
    PUNKTOW_KREGU: 72,
    // Tekstura kręgu: w circle_03 szczyt jasnej obręczy leży na 0.354 boku obrazka
    // (zmierzone profilem alfy 2026-10-03) - rdzeń proceduralny pokrywa się z obręczą.
    TEKSTURA_PROMIEN_UDZIAL: 0.354,
    ALFA_TEKSTURY: 0.95,
    KROKI_BARWY: 8,               // barwa kwantowana - cache tintowanych sprite'ów nie puchnie
    GRUBOSC_RDZENIA: 2.5,         // px - cienka jasna obręcz na krawędzi tekstury
    ALFA_RDZENIA: 0.8,
    GRUBOSC_KONCOWA: 0.4,         // mnożnik grubości pod koniec życia kręgu
    SOCZEWKA_GRUBOSC: 0.35,       // skala * to - szerokość pierścienia zniekształcenia
    WYBRZUSZENIE: 0.06,           // maks. powiększenie obrazu pod kręgiem (6 %)
    MARGINES_PX: 8,
    DYSK_ZYCIE: 0.3,              // s - dysk uderzeniowy przy narodzinach
    DYSK_DO: 2.0,                 // skala * to - promień dysku na końcu
    DYSK_ALFA: 0.85,
    DYSK_SQUASH: 0.5,
    PROMIENIE_OD: 12, PROMIENIE_DO: 16,   // promieni na krąg
    PROMIEN_ZYCIE: 0.5,           // s
    PROMIEN_ODSTEP: 0.15,         // skala * to - wewnętrzny koniec promienia przed krawędzią kręgu
    PROMIEN_DLUGOSC_OD: 0.3, PROMIEN_DLUGOSC_DO: 1.4,   // skala * to
    PROMIEN_SZEROKOSC: 0.14,      // skala * to
    ALFA_PROMIENIA: 0.8,
    NAROST: 0.2, WYGASZENIE: 1.0, // s
    BARWA: [80, 220, 255],        // turkus Mokoszy - krąg przy narodzinach
    BARWA_KONCOWA: [40, 110, 255],// głęboki błękit - krąg na końcu życia
    BARWA_RDZENIA: [225, 250, 255]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const losuj = (min, max, los = Math.random) => min + los() * (max - min);

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
 * @returns {{promien, alfa, grubosc, soczewka, p}|null}  promien w skali barków,
 *   grubosc = mnożnik grubości, soczewka 0..1, p = postęp życia; null poza życiem
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
        soczewka: (1 - p) * (1 - p),
        p
    };
}

/** Barwa kręgu w postępie życia p (0..1): turkus -> głęboki błękit. */
export function barwaKregu(p) {
    const N = NASTAWY, q = clamp01(p);
    return N.BARWA.map((v, i) => Math.round(v + (N.BARWA_KONCOWA[i] - v) * q));
}

/** Dysk uderzeniowy przy narodzinach kręgu. @returns {{promien, alfa}|null} promien w skali barków */
export function stanDysku(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek < 0 || wiek >= N.DYSK_ZYCIE) return null;
    const p = wiek / N.DYSK_ZYCIE;
    return { promien: N.DYSK_DO * (1 - (1 - p) * (1 - p)), alfa: Math.pow(1 - p, 1.5) };
}

/** Promienie nowego kręgu - rozstawione równo po elipsie z małym przesunięciem. */
export function nowePromienie(los = Math.random) {
    const N = NASTAWY;
    const n = Math.floor(losuj(N.PROMIENIE_OD, N.PROMIENIE_DO + 1, los));
    const obrot = los() * Math.PI * 2;
    return Array.from({ length: Math.min(n, N.PROMIENIE_DO) }, (_, i) => ({
        kat: obrot + (i + (los() - 0.5) * 0.5) / Math.min(n, N.PROMIENIE_DO) * Math.PI * 2,
        wariant: Math.floor(los() * MANIFEST.promien.length),
        dlugoscWsp: 0.7 + los() * 0.6
    }));
}

/**
 * Stan promieni kręgu o wieku `wiek` - czysta funkcja.
 * @returns {{r0, dlugosc, alfa}|null}  r0 = wewnętrzny koniec (skala), PRZED krawędzią kręgu
 */
export function stanPromienia(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek < 0 || wiek >= N.PROMIEN_ZYCIE) return null;
    const p = wiek / N.PROMIEN_ZYCIE;
    const krag = stanKregu(wiek);
    return {
        r0: krag.promien + N.PROMIEN_ODSTEP,
        dlugosc: N.PROMIEN_DLUGOSC_OD + (N.PROMIEN_DLUGOSC_DO - N.PROMIEN_DLUGOSC_OD) * (1 - (1 - p) * (1 - p)),
        alfa: Math.pow(1 - p, 1.2) * Math.min(1, p / 0.05)
    };
}

/** Odcinek promienia w px (na elipsie kręgu, skierowany na zewnątrz). */
export function pozycjaPromienia(pr, st, cx, cy, sk) {
    const N = NASTAWY;
    const c = Math.cos(pr.kat), s = Math.sin(pr.kat);
    const r1 = st.r0 + st.dlugosc * pr.dlugoscWsp;
    return {
        x0: cx + c * st.r0 * sk, y0: cy + s * st.r0 * sk * N.SQUASH,
        x1: cx + c * r1 * sk, y1: cy + s * r1 * sk * N.SQUASH,
        przod: s > 0
    };
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
        this._kregi = [];      // [{ wiek, seed }]
        this._dyski = [];      // [{ wiek }]
        this._promienie = [];  // [{ wiek, kat, wariant, dlugoscWsp }]
        this._doKregu = 0;
        this._urodzone = 0;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._plotno = null;
        this._plotnoCtx = null;
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kregi = [];
        this._dyski = [];
        this._promienie = [];
        this._doKregu = 0;
        this._urodzone = 0;
        this._kotwica.reset();
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; this._kregi = []; this._dyski = []; this._promienie = []; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const sk = this.zaczep.skala, cx = this.zaczep.x, cy = poziomWody(this.zaczep, H);

        for (const kr of this._kregi) kr.wiek += krok;
        for (const d of this._dyski) d.wiek += krok;
        for (const pr of this._promienie) pr.wiek += krok;
        this._kregi = this._kregi.filter(kr => kr.wiek < N.ZYCIE_KREGU);
        this._dyski = this._dyski.filter(d => d.wiek < N.DYSK_ZYCIE);
        this._promienie = this._promienie.filter(pr => pr.wiek < N.PROMIEN_ZYCIE);
        if (this._t < N.EMISJA_S) {
            this._doKregu -= krok;
            if (this._doKregu <= 0) {
                this._kregi.push({ wiek: 0, seed: Math.random() * 100 });
                this._dyski.push({ wiek: 0 });
                for (const pr of nowePromienie()) this._promienie.push({ ...pr, wiek: 0 });
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
        const promienie = this._promienie.map(pr => {
            const st = stanPromienia(pr.wiek);
            return st && { pr, st, poz: pozycjaPromienia(pr, st, cx, cy, sk) };
        }).filter(Boolean);

        // 1. Soczewki - zniekształcają scenę, więc PRZED rysowaniem świecenia.
        for (const { st } of kregi) this._soczewka(ctx, cx, cy, sk * st.promien, sk * N.SOCZEWKA_GRUBOSC * st.grubosc, st.soczewka * alfa, W, H);

        // 2. Kręgi i promienie: TYŁ za sylwetką, potem PRZÓD.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._strona(tyl, false, cx, cy, sk, kregi, promienie, alfa, W, H);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        this._strona(ctx, true, cx, cy, sk, kregi, promienie, alfa, W, H);

        // 3. Dyski uderzeniowe przy narodzinach kręgu.
        this._dyskiUderzenia(ctx, cx, cy, sk, alfa);
    }

    _strona(c, przod, cx, cy, sk, kregi, promienie, alfa, W, H) {
        const N = NASTAWY;
        const [rr, gr, br] = N.BARWA_RDZENIA;
        c.save();
        c.globalCompositeOperation = 'lighter';   // eteryczna energia - świeci
        // Tekstura kręgu przycięta do swojej połowy (tył: nad środkiem, przód: pod nim).
        const img = obraz(MANIFEST.kragFali);
        if (img) {
            c.save();
            c.beginPath();
            c.rect(0, przod ? cy : 0, W, przod ? H - cy : cy);
            c.clip();
            for (const { st } of kregi) {
                const q = Math.round(st.p * N.KROKI_BARWY) / N.KROKI_BARWY;
                const S = sk * st.promien / N.TEKSTURA_PROMIEN_UDZIAL;
                c.save();
                c.translate(cx, cy);
                c.scale(1, N.SQUASH);
                c.globalAlpha = clamp01(N.ALFA_TEKSTURY * st.alfa * alfa);
                c.drawImage(wypalTintowany(img, barwaKregu(q), 256), -S / 2, -S / 2, S, S);
                c.restore();
            }
            c.restore();
        }
        // Cienki jasny rdzeń na krawędzi - ostra obręcz nawet bez tekstury.
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const { st, pkt } of kregi) {
            c.lineWidth = N.GRUBOSC_RDZENIA * st.grubosc;
            c.strokeStyle = `rgba(${rr},${gr},${br},${(N.ALFA_RDZENIA * st.alfa * alfa).toFixed(3)})`;
            rysujStrone(c, pkt, przod);
        }
        // Promienie - smugi trace_* biegnące na zewnątrz przed krawędzią kręgu.
        for (const { pr, st, poz } of promienie) {
            if (poz.przod !== przod) continue;
            const tex = obraz(MANIFEST.promien[pr.wariant]);
            if (!tex) continue;   // asset jeszcze się ładuje - GEMINI.md §2
            const dx = poz.x1 - poz.x0, dy = poz.y1 - poz.y0, dl = Math.hypot(dx, dy);
            if (dl < 1) continue;
            const szer = sk * N.PROMIEN_SZEROKOSC;
            c.save();
            c.translate((poz.x0 + poz.x1) / 2, (poz.y0 + poz.y1) / 2);
            c.rotate(Math.atan2(dy, dx) - Math.PI / 2);   // tekstura trace_* jest pionowa
            c.globalAlpha = clamp01(N.ALFA_PROMIENIA * st.alfa * alfa);
            c.drawImage(wypalTintowany(tex, N.BARWA_RDZENIA, 128), -szer / 2, -dl / 2, szer, dl);
            c.restore();
        }
        c.restore();
    }

    _dyskiUderzenia(ctx, cx, cy, sk, alfa) {
        const N = NASTAWY;
        const img = obraz(MANIFEST.dyskUderzenia);
        if (!img) return;
        for (const d of this._dyski) {
            const st = stanDysku(d.wiek);
            if (!st) continue;
            const S = sk * st.promien * 2;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(cx, cy);
            ctx.scale(1, N.DYSK_SQUASH);
            ctx.globalAlpha = clamp01(N.DYSK_ALFA * st.alfa * alfa);
            ctx.drawImage(wypalTintowany(img, N.BARWA_RDZENIA, 256), -S / 2, -S / 2, S, S);
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
