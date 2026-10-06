/**
 * Bania - nagroda za combo mokosz -> swarog (2026-10-06). Woda (Mokosz)
 * chlusta na rozgrzane ciało (Swaróg): para BUCHA z głowy, barków i łokci,
 * jak po chochli wody na kamienie w bani.
 *
 * DWÓJKA = SKROMNA I KRÓTKA (życzenie właściciela gry): dwa buchnięcia,
 * ~1.5 s, bez warstw VFX. Efekt WOW zostaje dla trójek.
 *
 * v2: KRESKA PO WĘZŁACH, NIE SPRITE'Y. Kłęby smoke_* czytały się jako
 * "okręgi" (ta sama lekcja co Okadzenie v4). Smuga = głowa + ślad węzłów:
 * głowa wystrzeliwuje i wykładniczo hamuje, zostawiając węzły co KROK_WEZLA.
 * Węzły unoszą się i dryfują polem curl2, z amplitudą rosnącą z ich wiekiem -
 * świeży szybki ślad jest prostą wąską kreską (STRUMIEŃ, syk z dyszy),
 * a stary, skupiony po wyhamowaniu ślad zawija się i rozszerza (WSTĘGA).
 * Jeden mechanizm, bez przełączania faz. Wariancja losowana PER SMUGA
 * (faza szumu, szerokość, prędkość), nie per węzeł - inaczej kreska zygzakuje.
 *
 * Rysowanie jak Okadzenie v4: stroke() w kilku przebiegach (poświata ->
 * rdzeń) na płótnie 1/DZIELNIK_PLOTNA, złożone jednym drawImage z blur.
 * Source-over (materia), PRZED ciałem - paruje Z ciała.
 *
 * Źródła to punkty pozy (nos, barki, łokcie), nie dłonie - kamera gubi
 * dłonie, pozę trzyma (lekcja z Łuku Peruna). Smugi po narodzinach lecą
 * swobodnie; za ciałem podąża tylko miejsce kolejnego buchnięcia.
 */
import { curl2 } from './szum.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';

export const NASTAWY = {
    BUCHNIECIA: [0, 0.4],        // s od zapal() - druga chochla wody
    SMUG_NA_ZRODLO: 3,
    ZYCIE_OD: 0.7, ZYCIE_DO: 1.0,   // s życia smugi
    PREDKOSC_OD: 5, PREDKOSC_DO: 9, // skala/s głowy na starcie
    NAROST: 0.08,                // ułamek życia smugi do pełnej alfy
    HAMOWANIE: 7,                // 1/s - wykładnicze, głowa staje po ~0.3 s
    ROZRZUT: 0.55,               // rad wokół kierunku od tułowia
    KROK_WEZLA: 0.025,           // s między węzłami śladu
    WEZLOW_MAX: 24,              // ~0.6 s śladu; najstarsze odpadają (smuga odrywa się od ciała)
    UNOSZENIE: 0.9,              // skala/s - węzły idą w górę
    ZAWIJANIE: 1.4,              // skala/s - amplituda dryfu curl2
    ZAWIJANIE_NAROST: 0.35,      // s wieku węzła do pełnego zawijania
    SKALA_SZUMU: 0.7,            // skala * to = długość "fali" zawinięcia
    SZEROKOSC_OD: 0.04, SZEROKOSC_DO: 0.22,   // skala * to: świeży węzeł -> stary
    POSZERZANIE: 0.5,            // s wieku węzła do pełnej szerokości
    ROZMYCIE_PX: 3,              // blur przy złożeniu na scenę
    DZIELNIK_PLOTNA: 3,
    ALFA: 1,
    BARWA: [245, 240, 232]       // ciepła biel pary
};

// Przebiegi kreski: szeroka blada poświata -> wąski jaśniejszy rdzeń.
const PRZEBIEGI = [
    { szer: 2.6, alfa: 0.10 },
    { szer: 1.5, alfa: 0.18 },
    { szer: 0.6, alfa: 0.35 }
];

export const CZAS_TRWANIA = NASTAWY.BUCHNIECIA[NASTAWY.BUCHNIECIA.length - 1] + NASTAWY.ZYCIE_DO + 0.05;

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Alfa smugi 0..1: szybki narost, potem gaśnięcie. */
export function obwiedniaKlebu(wiek, zycie) {
    if (!Number.isFinite(wiek) || !(zycie > 0) || wiek <= 0 || wiek >= zycie) return 0;
    const u = wiek / zycie;
    return Math.min(1, u / NASTAWY.NAROST) * Math.pow(1 - u, 1.5);
}

/**
 * @returns {{x:number, y:number}[]}  głowa (nos podniesiony o pół barków), barki, łokcie - w px;
 *   pusta tablica bez pozy
 */
export function punktyZrodel(frame, W, H) {
    const lm = frame?.pose?.landmarks;
    const barki = barkiKlatki(frame, W, H);
    if (!lm || !barki) return [];
    const wynik = [];
    if (punktOk(lm[0])) wynik.push({ x: lm[0].x * W, y: lm[0].y * H - barki.skala * 0.5 });
    for (const i of [11, 12, 13, 14]) {
        if (punktOk(lm[i])) wynik.push({ x: lm[i].x * W, y: lm[i].y * H });
    }
    return wynik;
}

/** Źródła bez pozy - rozstawione wokół ostatniego znanego (albo umownego) zaczepu barków. */
function zrodlaZZaczepu(z) {
    const s = z.skala;
    return [
        { x: z.x, y: z.y - s * 0.9 },
        { x: z.x - s * 0.5, y: z.y }, { x: z.x + s * 0.5, y: z.y },
        { x: z.x - s * 0.8, y: z.y + s * 0.6 }, { x: z.x + s * 0.8, y: z.y + s * 0.6 }
    ];
}

export class Bania {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._smugi = [];
        this._nastepne = 0;   // indeks w NASTAWY.BUCHNIECIA
        this._kotwica = new Kotwica(14);
        this._plotno = null;
        this._ctxPom = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._nastepne = 0;   // smugi poprzedniego odpalenia dogasają same
    }

    _buchnij(zrodla, zaczep) {
        const N = NASTAWY, sk = zaczep.skala;
        for (const p of zrodla) {
            // Od środka tułowia na zewnątrz, z przechyłem w górę - para ucieka od ciała.
            const kat = Math.atan2(p.y - (zaczep.y + sk * 0.5) - sk * 0.8, p.x - zaczep.x);
            for (let i = 0; i < N.SMUG_NA_ZRODLO; i++) {
                const k = kat + (Math.random() * 2 - 1) * N.ROZRZUT;
                const v = sk * (N.PREDKOSC_OD + Math.random() * (N.PREDKOSC_DO - N.PREDKOSC_OD));
                this._smugi.push({
                    x: p.x, y: p.y,
                    vx: Math.cos(k) * v, vy: Math.sin(k) * v,
                    wiek: 0,
                    zycie: N.ZYCIE_OD + Math.random() * (N.ZYCIE_DO - N.ZYCIE_OD),
                    szer: 0.7 + Math.random() * 0.6,
                    fazaX: Math.random() * 100, fazaY: Math.random() * 100,
                    doWezla: 0,
                    wezly: []   // najstarszy z przodu
                });
            }
        }
    }

    _ruch(m, sk, krok) {
        const N = NASTAWY;
        const hamuj = Math.exp(-N.HAMOWANIE * krok);
        m.wiek += krok;
        m.vx *= hamuj;
        m.vy = m.vy * hamuj - sk * N.UNOSZENIE * 0.5 * (1 - hamuj);
        m.x += m.vx * krok;
        m.y += m.vy * krok;
        m.doWezla -= krok;
        if (m.doWezla <= 0) {
            m.wezly.push({ x: m.x, y: m.y, wiek: 0 });
            if (m.wezly.length > N.WEZLOW_MAX) m.wezly.shift();
            m.doWezla += N.KROK_WEZLA;
        }
        const dl = sk * N.SKALA_SZUMU;
        for (const w of m.wezly) {
            w.wiek += krok;
            const zaw = Math.min(1, w.wiek / N.ZAWIJANIE_NAROST);
            const c = curl2(w.x / dl + m.fazaX, w.y / dl + m.fazaY + this._t * 0.4);
            w.x += c.x * N.ZAWIJANIE * sk * zaw * krok;
            w.y += (c.y * N.ZAWIJANIE * sk * zaw - N.UNOSZENIE * sk * Math.min(1, w.wiek / 0.3)) * krok;
        }
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const B = NASTAWY.BUCHNIECIA;
        while (this._nastepne < B.length && this._t >= B[this._nastepne]) {
            const zrodla = punktyZrodel(k?.frame, W, H);
            this._buchnij(zrodla.length ? zrodla : zrodlaZZaczepu(zaczep), zaczep);
            this._nastepne++;
        }

        for (const m of this._smugi) this._ruch(m, zaczep.skala, krok);
        this._smugi = this._smugi.filter(m => m.wiek < m.zycie);
        if (this._nastepne >= B.length && (this._smugi.length === 0 || this._t >= CZAS_TRWANIA)) {
            this._trwa = false;
            this._smugi = [];
            return;
        }
        if (ctx) this._rysuj(ctx, W, H, zaczep.skala);
    }

    _rysuj(ctx, W, H, sk) {
        const N = NASTAWY;
        const pc = this._plotnoDla(W, H);
        if (!pc) return;
        const d = 1 / N.DZIELNIK_PLOTNA;
        pc.setTransform(1, 0, 0, 1, 0, 0);
        pc.clearRect(0, 0, this._plotno.width, this._plotno.height);
        pc.setTransform(d, 0, 0, d, 0, 0);
        pc.lineCap = 'round';
        pc.lineJoin = 'round';
        pc.strokeStyle = `rgb(${N.BARWA.join(',')})`;
        for (const prz of PRZEBIEGI) {
            for (const m of this._smugi) {
                const a = obwiedniaKlebu(m.wiek, m.zycie) * this._sila * N.ALFA * prz.alfa;
                const w = m.wezly, n = w.length;
                if (a < 0.003 || n < 2) continue;
                for (let i = 1; i < n; i++) {
                    const u = Math.min(1, w[i].wiek / N.POSZERZANIE);
                    pc.globalAlpha = clamp01(a * Math.min(1, i / 3));   // ogon (najstarszy) wygasa
                    pc.lineWidth = sk * m.szer * prz.szer * (N.SZEROKOSC_OD + (N.SZEROKOSC_DO - N.SZEROKOSC_OD) * u);
                    pc.beginPath();
                    pc.moveTo(w[i - 1].x, w[i - 1].y);
                    pc.lineTo(w[i].x, w[i].y);
                    pc.stroke();
                }
            }
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.filter = `blur(${N.ROZMYCIE_PX}px)`;
        ctx.drawImage(this._plotno, 0, 0, this._plotno.width, this._plotno.height, 0, 0, W, H);
        ctx.restore();
    }

    /** Leniwe płótno pomocnicze - bez DOM (testy) zwraca null i nic nie rysujemy. */
    _plotnoDla(W, H) {
        if (typeof document === 'undefined') return null;
        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._ctxPom = this._plotno.getContext('2d');
        }
        const bw = Math.max(1, Math.round(W / NASTAWY.DZIELNIK_PLOTNA));
        const bh = Math.max(1, Math.round(H / NASTAWY.DZIELNIK_PLOTNA));
        if (this._plotno.width !== bw || this._plotno.height !== bh) {
            this._plotno.width = bw;
            this._plotno.height = bh;
        }
        return this._ctxPom;
    }
}
