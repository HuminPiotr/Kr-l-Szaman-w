/**
 * Kamienna Tarcza - nagroda za combo weles × 3 (proste combo 2026-10-02,
 * docs/superpowers/specs/2026-10-02-proste-kombosy-design.md). Pierwsza
 * technika z WŁASNĄ fakturą Welesa (dirt_* z paczki Kenney, CC0).
 *
 * Odłamki ziemi wylatują z barków na eliptyczną orbitę wokół tułowia, krążą
 * i na koniec opadają. Tylna połowa orbity (sin(kąt) < 0, "dalej od kamery")
 * rysuje się ZA sylwetką (js/warstwaZaSylwetka.js), przednia przed nią -
 * dzięki temu kamienie naprawdę OKRĄŻAJĄ ciało, nie wiszą przed nim.
 *
 * Zaczep: środek barków co klatkę (js/sledzenie.js), NIE zamrożony w zapal()
 * jak w Kołowrocie - tarcza ma iść za tancerzem. Rozmiary to mnożniki skali
 * barków (wzorzec kolowrot.js).
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    LICZBA: 10,
    T_FORMOWANIA: 0.6,        // s - wylot z barków na orbitę
    T_OPADANIA: 5.0,          // s - od tej chwili orbita puszcza i kamienie spadają
    PROMIEN_MNOZNIK: 1.25,    // skala * to = promień orbity
    SQUASH: 0.38,             // spłaszczenie elipsy - orbita pozioma, widziana lekko z góry
    OBNIZENIE_MNOZNIK: 0.6,   // środek orbity = barki + skala * to w dół (środek tułowia)
    PREDKOSC_KATOWA: 2.2,     // rad/s
    ROZMIAR_OD: 0.32, ROZMIAR_DO: 0.55,   // skala * to
    GRAWITACJA_MNOZNIK: 9,    // skala * to = px/s^2
    BARWA_KAMIENIA: [110, 90, 135],    // ciemny kamień z nutą fioletu Welesa
    BARWA_POSWIATY: [190, 100, 255]    // fiolet Welesa (techniki.js BARWA_GROMU)
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** Alfa całości w chwili t (s) - czysta funkcja. */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    const narost = Math.min(1, t / NASTAWY.T_FORMOWANIA);
    const opad = t > NASTAWY.T_OPADANIA
        ? Math.max(0, 1 - (t - NASTAWY.T_OPADANIA) / (CZAS_TRWANIA - NASTAWY.T_OPADANIA)) : 1;
    return narost * opad;
}

/**
 * Położenie jednego odłamka - czysta funkcja.
 * @returns {{x:number, y:number, przod:boolean, obrot:number}}
 */
export function pozycjaOdlamka(o, t, srodek, skala) {
    const N = NASTAWY;
    const wylot = clamp01(t / N.T_FORMOWANIA);
    const r = skala * N.PROMIEN_MNOZNIK * (1 - Math.pow(1 - wylot, 3)) * o.promienWsp;
    const kat = o.kat0 + o.kierunek * N.PREDKOSC_KATOWA * t;
    const tOpad = Math.max(0, t - N.T_OPADANIA - o.opoznienieOpadu);
    const spad = 0.5 * skala * N.GRAWITACJA_MNOZNIK * tOpad * tOpad;
    return {
        x: srodek.x + Math.cos(kat) * r,
        y: srodek.y + skala * N.OBNIZENIE_MNOZNIK + Math.sin(kat) * r * N.SQUASH + o.wysokosc * skala + spad,
        przod: Math.sin(kat) > 0,
        obrot: o.obrot0 + o.vObrot * t
    };
}

export class KamiennaTarcza {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._odlamki = [];
        this._kotwica = new Kotwica(12);
        this._warstwa = new WarstwaZaSylwetka();
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
        this._kotwica.reset();
        // Jeden kierunek obrotu na całą tarczę - inaczej kamienie mijałyby
        // się i czytały jako chaos, nie jako tarcza.
        const kierunek = Math.random() < 0.5 ? -1 : 1;
        const N = NASTAWY;
        this._odlamki = Array.from({ length: N.LICZBA }, (_, i) => ({
            kat0: (i / N.LICZBA) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
            kierunek,
            promienWsp: 0.85 + Math.random() * 0.3,
            wysokosc: (Math.random() - 0.5) * 0.5,
            rozmiar: N.ROZMIAR_OD + Math.random() * (N.ROZMIAR_DO - N.ROZMIAR_OD),
            obrot0: Math.random() * Math.PI * 2,
            vObrot: (Math.random() * 2 - 1) * 3,
            opoznienieOpadu: Math.random() * 0.4,
            wariant: Math.floor(Math.random() * MANIFEST.odlamek.length)
        }));
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx
     * @param {{frame, W, H, maska, maskaSzer, maskaWys, fit}} k  main.js kontekstTechnik
     * @param {number} dt
     */
    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };   // ten sam zastępczy rząd wielkości co kregSylwetki
        if (!ctx) return;   // guard PO zegarze i zaczepie - patrz kolowrot.js

        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        const pozycje = this._odlamki.map(o => [o, pozycjaOdlamka(o, this._t, this.zaczep, this.zaczep.skala)]);

        // Najpierw TYŁ (za ciałem), potem PRZÓD - kolejność rysowania = głębia.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            for (const [o, p] of pozycje) if (!p.przod) this._rysuj(tyl, o, p, alfa);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        for (const [o, p] of pozycje) if (p.przod) this._rysuj(ctx, o, p, alfa);
    }

    _rysuj(c, o, p, alfa) {
        const img = obraz(MANIFEST.odlamek[o.wariant]);
        if (!img) return;   // asset jeszcze się ładuje - GEMINI.md §2
        const d = this.zaczep.skala * o.rozmiar;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.obrot);
        // Fioletowa poświata pod spodem ('lighter'), kamień na wierzchu
        // ('source-over') - kamień ma być MATERIĄ, nie kolejną świecącą plamą.
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = clamp01(alfa * 0.5);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_POSWIATY, 128), -d * 0.65, -d * 0.65, d * 1.3, d * 1.3);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = clamp01(alfa);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_KAMIENIA, 128), -d / 2, -d / 2, d, d);
        c.restore();
    }
}
