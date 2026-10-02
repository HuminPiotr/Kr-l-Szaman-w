/**
 * Kurzawa - nagroda za combo stribog -> weles (proste combo 2026-10-02).
 * Wiatr (Stribog) podrywa ziemię (Weles): lej pyłu spiralą od pasa nad
 * głowę, jak diabeł pyłowy, z kilkoma zawijasami wiru (twirl_*) na różnych
 * wysokościach. Tył leja rysuje się ZA sylwetką (js/warstwaZaSylwetka.js).
 *
 * Drobiny pyłu nie mają fizyki całkowanej - ich tor to czysta funkcja
 * wieku (pozycjaDrobiny): wysokość rośnie liniowo, promień leja rośnie
 * z wysokością, kąt rośnie ze stałą prędkością. Emisja rozłożona na
 * EMISJA_S przez ujemny startowy wiek (wzorzec kolowrot.js).
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const NASTAWY = {
    LICZBA_PYLU: 70,
    LICZBA_WIROW: 5,
    EMISJA_S: 3.0,            // s - przez tyle rodzą się nowe drobiny
    ZYCIE_MIN: 1.4, ZYCIE_MAX: 2.2,
    DOL_MNOZNIK: 1.8,         // start drobiny = barki + skala * to w dół (pas)
    GORA_MNOZNIK: 1.6,        // koniec = barki - skala * to (nad głową)
    PROMIEN_DOL: 0.45, PROMIEN_GORA: 1.6,   // skala * to - lej rozszerza się w górę
    SQUASH: 0.3,
    PREDKOSC_KATOWA: 5.0,     // rad/s
    ROZMIAR_PYLU_OD: 0.12, ROZMIAR_PYLU_DO: 0.28,   // skala * to
    PREDKOSC_WIRU: 3.0,       // rad/s obrotu tekstury zawijasa
    BARWA_PYLU: [205, 165, 105],   // piaskowa ochra
    BARWA_WIRU: [140, 235, 195]    // mięta Striboga (techniki.js BARWA_ZAPLONU.aard)
};
export const CZAS_TRWANIA = NASTAWY.EMISJA_S + NASTAWY.ZYCIE_MAX;   // s - ostatnia drobina zdąży dolecieć

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** Alfa zawijasów wiru - narost 0.4 s, gaśnie w ostatniej sekundzie. */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / 0.4) * Math.min(1, (CZAS_TRWANIA - t) / 1.0);
}

/** Tor drobiny - czysta funkcja wieku. @returns {{x,y,przod,alfa,promien}} */
export function pozycjaDrobiny(c, srodek, skala) {
    const N = NASTAWY;
    const u = clamp01(c.wiek / c.zycie);
    const promien = skala * (N.PROMIEN_DOL + u * (N.PROMIEN_GORA - N.PROMIEN_DOL));
    const kat = c.kat0 + c.kierunek * N.PREDKOSC_KATOWA * c.wiek;
    return {
        x: srodek.x + Math.cos(kat) * promien,
        y: srodek.y + skala * (N.DOL_MNOZNIK - u * (N.DOL_MNOZNIK + N.GORA_MNOZNIK)) + Math.sin(kat) * promien * N.SQUASH,
        przod: Math.sin(kat) > 0,
        alfa: Math.sin(u * Math.PI),
        promien
    };
}

export class Kurzawa {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._pyl = [];
        this._kierunek = 1;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        const N = NASTAWY;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kotwica.reset();
        this._kierunek = Math.random() < 0.5 ? -1 : 1;   // jeden kierunek wiru na cały lej
        this._pyl = Array.from({ length: N.LICZBA_PYLU }, () => ({
            kat0: Math.random() * Math.PI * 2,
            kierunek: this._kierunek,
            zycie: N.ZYCIE_MIN + Math.random() * (N.ZYCIE_MAX - N.ZYCIE_MIN),
            wiek: -Math.random() * N.EMISJA_S,
            rozmiar: N.ROZMIAR_PYLU_OD + Math.random() * (N.ROZMIAR_PYLU_DO - N.ROZMIAR_PYLU_OD),
            obrot: Math.random() * Math.PI * 2,
            wariant: Math.floor(Math.random() * MANIFEST.odlamek.length)
        }));
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }
        for (const c of this._pyl) c.wiek += krok;

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        if (!ctx) return;

        const sk = this.zaczep.skala;
        const zywe = this._pyl.filter(c => c.wiek >= 0 && c.wiek < c.zycie)
            .map(c => [c, pozycjaDrobiny(c, this.zaczep, sk)]);

        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            for (const [c, p] of zywe) if (!p.przod) this._rysujPyl(tyl, c, p, sk);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        for (const [c, p] of zywe) if (p.przod) this._rysujPyl(ctx, c, p, sk);
        this._rysujWiry(ctx, sk);
    }

    _rysujPyl(c, d, p, sk) {
        const img = obraz(MANIFEST.odlamek[d.wariant]);
        if (!img) return;
        const r = sk * d.rozmiar;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(d.obrot + d.wiek * 4);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = clamp01(p.alfa * this._sila * 0.85);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_PYLU, 64), -r / 2, -r / 2, r, r);
        c.restore();
    }

    _rysujWiry(c, sk) {
        const N = NASTAWY;
        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N.LICZBA_WIROW; i++) {
            const img = obraz(MANIFEST.wiryKurzawy[i % MANIFEST.wiryKurzawy.length]);
            if (!img) continue;
            const u = (i + 0.5) / N.LICZBA_WIROW;
            const y = this.zaczep.y + sk * (N.DOL_MNOZNIK - u * (N.DOL_MNOZNIK + N.GORA_MNOZNIK));
            const d = 2 * sk * (N.PROMIEN_DOL + u * (N.PROMIEN_GORA - N.PROMIEN_DOL));
            c.save();
            c.translate(this.zaczep.x, y);
            c.scale(1, N.SQUASH * 1.6);
            c.rotate(this._kierunek * N.PREDKOSC_WIRU * this._t + i);
            c.globalAlpha = clamp01(alfa * 0.45);
            c.drawImage(wypalTintowany(img, N.BARWA_WIRU, 256), -d / 2, -d / 2, d, d);
            c.restore();
        }
        c.restore();
    }
}
