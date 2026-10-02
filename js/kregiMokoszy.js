/**
 * Kręgi Mokoszy - nagroda za combo mokosz -> weles (proste combo 2026-10-02,
 * przeprojektowane 2026-10-03). Mokosz to "Mać Ziemia Wilgotna": gracz stoi
 * po pas w wodzie, a od jego ciała rozchodzą się kręgi fal, jak po wrzuceniu
 * kamienia; przy narodzinach każdego kręgu tryskają krople.
 *
 * ZASTĘPUJE Wodną Kulę (kula wody między dłońmi z soczewką) - po teście na
 * kamerze "ani nie wyglądała, ani nie zachowywała się fajnie": kamera gubi
 * dłonie, więc kula skakała, a soczewka na tle obrazu z kamery była prawie
 * niewidoczna. Lekcja: efekty przyczepione do BARKÓW (Tarcza, Kurzawa, Mgła)
 * działają, do dłoni - nie. Tu nic nie zależy od dłoni.
 *
 * Krąg czyta się jak FALA, nie jak świecący pierścień: para linii - jasny
 * grzbiet i ciemniejsza dolina tuż wewnątrz - zwykłym blendowaniem
 * (source-over). Tylna połowa tafli i kręgów (górna połowa elipsy, sin<0)
 * rysuje się ZA sylwetką (js/warstwaZaSylwetka.js), przednia przed nią.
 */
import { simplex3 } from './szum.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    POZIOM_MNOZNIK: 1.3,          // skala * to pod barkami = poziom wody (pas)
    DOL_EKRANU: 0.9,              // poziom wody nigdy niżej niż H * to
    EMISJA_S: 4.5,                // s - przez tyle rodzą się nowe kręgi
    ODSTEP_KREGOW: 0.45,          // s
    ZYCIE_KREGU: 2.2,             // s
    PROMIEN_OD: 0.6, PROMIEN_DO: 4.5,   // skala * to
    SQUASH: 0.25,                 // płaska elipsa - tafla widziana lekko z góry
    FALOWANIE: 0.04,              // ułamek promienia - krąg nie jest idealną elipsą
    PUNKTOW_KREGU: 64,
    GRUBOSC_OD: 3, GRUBOSC_DO: 1, // px - krąg cienieje, rozchodząc się
    ALFA_GRZBIETU: 0.75, ALFA_DOLINY: 0.3,
    DOLINA_MNOZNIK: 0.96,         // dolina tuż WEWNĄTRZ grzbietu
    TAFLA_PROMIEN: 4.8,           // skala * to
    ALFA_TAFLI: 0.12,
    KROPLE_OD: 6, KROPLE_DO: 10,  // na narodziny kręgu
    PREDKOSC_KROPLI: 2.2,         // skala/s
    GRAWITACJA_KROPLI: 6,         // skala/s^2
    ZYCIE_KROPLI: 0.6,            // s
    ALFA_KROPLI: 0.8, GRUBOSC_KROPLI: 2,
    NAROST: 0.3, WYGASZENIE: 1.0, // s
    BARWA_GRZBIETU: [190, 225, 255],
    BARWA_DOLINY: [40, 90, 160],
    BARWA_TAFLI: [70, 140, 200],
    BARWA_KROPLI: [200, 230, 255]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const losuj = (min, max) => min + Math.random() * (max - min);

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/** Poziom tafli w px: pas gracza, przycięty do kadru (biodra bywają poza nim). */
export function poziomWody(zaczep, H) {
    return Math.min(zaczep.y + zaczep.skala * NASTAWY.POZIOM_MNOZNIK, H * NASTAWY.DOL_EKRANU);
}

/**
 * Stan kręgu o wieku `wiek` (s) - czysta funkcja.
 * @returns {{promien:number, alfa:number, grubosc:number}|null}  promien w skali barków; null poza życiem
 */
export function stanKregu(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek < 0 || wiek >= N.ZYCIE_KREGU) return null;
    const p = wiek / N.ZYCIE_KREGU;
    return {
        promien: N.PROMIEN_OD + (N.PROMIEN_DO - N.PROMIEN_OD) * (1 - (1 - p) * (1 - p)),   // szybko, potem zwalnia
        alfa: Math.pow(1 - p, 1.5) * Math.min(1, p / 0.08),
        grubosc: N.GRUBOSC_OD + (N.GRUBOSC_DO - N.GRUBOSC_OD) * p
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
        this._krople = [];   // [{ x, y, vx, vy, wiek, zycie }] - px
        this._doKregu = 0;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
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
        this._krople = [];
        this._doKregu = 0;
        this._kotwica.reset();
    }

    _rozprysk(cx, cy, sk) {
        const N = NASTAWY;
        const ile = Math.round(losuj(N.KROPLE_OD, N.KROPLE_DO));
        for (let i = 0; i < ile; i++) {
            const strona = i % 2 === 0 ? -1 : 1;                 // z obu boków ciała
            const kat = losuj(30, 70) * Math.PI / 180;           // w górę, na zewnątrz
            const v = sk * N.PREDKOSC_KROPLI * losuj(0.6, 1.2);
            this._krople.push({
                x: cx + strona * sk * losuj(0.35, 0.6), y: cy,
                vx: strona * Math.cos(kat) * v, vy: -Math.sin(kat) * v,
                wiek: 0, zycie: N.ZYCIE_KROPLI * losuj(0.7, 1.3)
            });
        }
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; this._kregi = []; this._krople = []; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const sk = this.zaczep.skala, cx = this.zaczep.x, cy = poziomWody(this.zaczep, H);

        // Nowe kręgi (i rozprysk przy każdym) tylko przez EMISJA_S.
        if (this._t < N.EMISJA_S) {
            this._doKregu -= krok;
            if (this._doKregu <= 0) {
                this._kregi.push({ wiek: 0, seed: Math.random() * 100 });
                this._rozprysk(cx, cy, sk);
                this._doKregu = N.ODSTEP_KREGOW;
            }
        }
        for (const kr of this._kregi) kr.wiek += krok;
        this._kregi = this._kregi.filter(kr => kr.wiek < N.ZYCIE_KREGU);
        const g = sk * N.GRAWITACJA_KROPLI;
        this._krople = this._krople.filter(d => {
            d.wiek += krok;
            d.vy += g * krok;
            d.x += d.vx * krok; d.y += d.vy * krok;
            return d.wiek < d.zycie && Number.isFinite(d.x) && Number.isFinite(d.y);
        });
        if (!ctx) return;   // guard PO zegarze, zaczepie i fizyce - patrz kolowrot.js

        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        const kregi = this._kregi.map(kr => {
            const st = stanKregu(kr.wiek);
            return st && { st, grzbiet: punktyKregu(cx, cy, sk * st.promien, this._t, kr.seed),
                           dolina: punktyKregu(cx, cy, sk * st.promien * N.DOLINA_MNOZNIK, this._t, kr.seed) };
        }).filter(Boolean);

        // Najpierw TYŁ (za ciałem), potem PRZÓD - kolejność rysowania = głębia.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._rysuj(tyl, false, cx, cy, sk, kregi, alfa);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        this._rysuj(ctx, true, cx, cy, sk, kregi, alfa);
    }

    _rysuj(c, przod, cx, cy, sk, kregi, alfa) {
        const N = NASTAWY;
        c.save();
        c.globalCompositeOperation = 'source-over';   // woda, nie energia
        // Tafla: połowa elipsy po swojej stronie (tył = górna połowa).
        const [rt, gt, bt] = N.BARWA_TAFLI;
        c.fillStyle = `rgba(${rt},${gt},${bt},${(N.ALFA_TAFLI * alfa).toFixed(3)})`;
        c.beginPath();
        c.ellipse(cx, cy, sk * N.TAFLA_PROMIEN, sk * N.TAFLA_PROMIEN * N.SQUASH, 0,
                  przod ? 0 : Math.PI, przod ? Math.PI : 2 * Math.PI);
        c.closePath();
        c.fill();
        // Kręgi: ciemna dolina, na niej jasny grzbiet.
        c.lineCap = 'round';
        c.lineJoin = 'round';
        const [rd, gd, bd] = N.BARWA_DOLINY, [rg, gg, bg] = N.BARWA_GRZBIETU;
        for (const { st, grzbiet, dolina } of kregi) {
            c.lineWidth = st.grubosc;
            c.strokeStyle = `rgba(${rd},${gd},${bd},${(N.ALFA_DOLINY * st.alfa * alfa).toFixed(3)})`;
            rysujStrone(c, dolina, przod);
            c.strokeStyle = `rgba(${rg},${gg},${bg},${(N.ALFA_GRZBIETU * st.alfa * alfa).toFixed(3)})`;
            rysujStrone(c, grzbiet, przod);
        }
        // Krople zawsze z przodu - tryskają z brzegów ciała w stronę kamery.
        if (przod) {
            const [r, g, b] = N.BARWA_KROPLI;
            c.lineWidth = N.GRUBOSC_KROPLI;
            for (const d of this._krople) {
                c.strokeStyle = `rgba(${r},${g},${b},${(N.ALFA_KROPLI * clamp01(1 - d.wiek / d.zycie) * alfa).toFixed(3)})`;
                c.beginPath();
                c.moveTo(d.x, d.y);
                c.lineTo(d.x - d.vx * 0.03, d.y - d.vy * 0.03);
                c.stroke();
            }
        }
        c.restore();
    }
}
