/**
 * Bania - nagroda za combo mokosz -> swarog (2026-10-06). Woda (Mokosz)
 * chlusta na rozgrzane ciało (Swaróg): para BUCHA z głowy, barków i łokci,
 * jak po chochli wody na kamienie w bani.
 *
 * DWÓJKA = SKROMNA I KRÓTKA (życzenie właściciela gry): dwa buchnięcia,
 * ~1.4 s, bez wstrząsu i bez warstw VFX. Efekt WOW zostaje dla trójek.
 *
 * Różnica względem dymu (js/dym.js): kłęby WYSTRZELIWUJĄ szybko i gwałtownie
 * hamują (wykładniczo), rozdymając się - "psssst", nie spokojne snucie.
 * Para rysowana source-over (materia), PRZED ciałem - paruje Z ciała.
 *
 * Źródła to punkty pozy (nos, barki, łokcie), nie dłonie - kamera gubi
 * dłonie, pozę trzyma (lekcja z Łuku Peruna). Kłęby po narodzinach lecą
 * swobodnie; za ciałem podąża tylko miejsce narodzin kolejnego buchnięcia.
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';

export const NASTAWY = {
    BUCHNIECIA: [0, 0.4],        // s od zapal() - druga chochla wody
    KLEBOW_NA_ZRODLO: 3,
    ZYCIE_OD: 0.6, ZYCIE_DO: 0.9,   // s
    PREDKOSC_OD: 4, PREDKOSC_DO: 7, // skala/s na starcie
    HAMOWANIE: 7,                // 1/s - wykładnicze, kłąb staje po ~0.3 s
    UNOSZENIE: 0.6,              // skala/s^2 - para po wyhamowaniu idzie w górę
    ROZRZUT: 0.6,                // rad wokół kierunku od tułowia
    ROZMIAR: 0.45, ROZROST: 3,   // skala * to na starcie; mnożnik na końcu życia
    NAROST: 0.08,                // ułamek życia do pełnej alfy
    ALFA: 0.55,
    BARWA: [245, 240, 232]       // ciepła biel pary
};

export const CZAS_TRWANIA = NASTAWY.BUCHNIECIA[NASTAWY.BUCHNIECIA.length - 1] + NASTAWY.ZYCIE_DO + 0.05;

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Alfa kłębu 0..1: szybki narost, potem gaśnięcie. */
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
        this._kleby = [];
        this._nastepne = 0;   // indeks w NASTAWY.BUCHNIECIA
        this._kotwica = new Kotwica(14);
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._nastepne = 0;   // kłęby poprzedniego odpalenia dogasają same
    }

    _buchnij(zrodla, zaczep) {
        const N = NASTAWY, sk = zaczep.skala;
        for (const p of zrodla) {
            // Od środka tułowia na zewnątrz, z przechyłem w górę - para ucieka od ciała.
            const kat = Math.atan2(p.y - (zaczep.y + sk * 0.5) - sk * 0.8, p.x - zaczep.x);
            for (let i = 0; i < N.KLEBOW_NA_ZRODLO; i++) {
                const k = kat + (Math.random() * 2 - 1) * N.ROZRZUT;
                const v = sk * (N.PREDKOSC_OD + Math.random() * (N.PREDKOSC_DO - N.PREDKOSC_OD));
                this._kleby.push({
                    x: p.x, y: p.y,
                    vx: Math.cos(k) * v, vy: Math.sin(k) * v,
                    wiek: 0,
                    zycie: N.ZYCIE_OD + Math.random() * (N.ZYCIE_DO - N.ZYCIE_OD),
                    rozmiar: sk * N.ROZMIAR * (0.8 + Math.random() * 0.4),
                    obrot: Math.random() * Math.PI * 2,
                    vObrot: (Math.random() * 2 - 1) * 1.5,
                    wariant: Math.floor(Math.random() * MANIFEST.mgla.length)
                });
            }
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

        const hamuj = Math.exp(-NASTAWY.HAMOWANIE * krok);
        for (const c of this._kleby) {
            c.wiek += krok;
            c.vx *= hamuj;
            c.vy = c.vy * hamuj - zaczep.skala * NASTAWY.UNOSZENIE * krok;
            c.x += c.vx * krok;
            c.y += c.vy * krok;
            c.obrot += c.vObrot * krok;
        }
        this._kleby = this._kleby.filter(c => c.wiek < c.zycie);
        if (this._nastepne >= B.length && (this._kleby.length === 0 || this._t >= CZAS_TRWANIA)) {
            this._trwa = false;
            this._kleby = [];
            return;
        }
        if (!ctx) return;

        for (const c of this._kleby) {
            const alfa = obwiedniaKlebu(c.wiek, c.zycie) * this._sila * NASTAWY.ALFA;
            if (alfa < 0.005) continue;
            const img = obraz(MANIFEST.mgla[c.wariant]);
            if (!img) continue;
            const u = c.wiek / c.zycie;
            const r = c.rozmiar * (1 + (NASTAWY.ROZROST - 1) * (1 - (1 - u) * (1 - u)));
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.translate(c.x, c.y);
            ctx.rotate(c.obrot);
            ctx.globalAlpha = clamp01(alfa);
            ctx.drawImage(wypalTintowany(img, NASTAWY.BARWA, 256), -r / 2, -r / 2, r, r);
            ctx.restore();
        }
    }
}
