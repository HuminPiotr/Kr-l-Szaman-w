/**
 * Mgła Mokoszy - nagroda za combo stribog -> mokosz (proste combo
 * 2026-10-02). Wiatr (Stribog) niesie wilgoć (Mokosz): pas teksturowanej
 * mgły (smoke_*, te same co Kołowrót) wjeżdża z jednej strony kadru na
 * wysokości tułowia i przetacza się na drugą, gęstniejąc (zwalniając)
 * wokół gracza. Mgła rysuje się ZA sylwetką (js/warstwaZaSylwetka.js) -
 * ciało "wynurza się" z niej.
 *
 * Kłęby rodzą się przy PIERWSZEJ klatce po zapal(), nie w zapal() -
 * dopiero updateAndDraw zna szerokość płótna i położenie barków, a API
 * zapal(sila) jest wspólne dla wszystkich prostych combo.
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 7.0;   // s

export const NASTAWY = {
    LICZBA: 28,
    OPOZNIENIE_MAX: 1.6,       // s - kłęby wjeżdżają falą, nie ścianą
    CZAS_PRZEJAZDU: 3.2,       // s na przejazd przez całe W bez zwalniania
    ZWOLNIENIE: 0.45,          // minimalny mnożnik prędkości przy sylwetce
    ZASIEG_ZWOLNIENIA: 2.2,    // skala * to - od tej odległości od ciała mgła zwalnia
    PAS_OD: -0.6, PAS_DO: 2.0, // skala * to względem barków - pas od szyi do bioder
    ROZMIAR_OD: 2.0, ROZMIAR_DO: 3.6,   // skala * to
    ALFA: 0.38,
    // Reakcja Burza w mgle (js/reakcjeTechnik.js): mgła błyska od środka.
    BLYSK_ZYCIE: 0.12,             // s
    ZASIEG_BLYSKU: 4,              // skala * to - dalej od źródła błysk nie sięga
    BARWA_BLYSKU: [200, 225, 255],
    NAROST: 0.3, WYGASZENIE: 1.6,       // s
    BARWA: [200, 228, 235]     // chłodna perła z nutą turkusu
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/** Prędkość kłębu w x - zwalnia przy sylwetce (cx), nigdy nie staje. */
export function predkoscKlebu(x, cx, v0, skala) {
    const N = NASTAWY;
    const blisko = Math.min(1, Math.abs(x - cx) / (skala * N.ZASIEG_ZWOLNIENIA));
    return v0 * (N.ZWOLNIENIE + (1 - N.ZWOLNIENIE) * blisko);
}

/** Jasność błysku kłębu w odległości `odl` px od źródła - 1 przy źródle, 0 od ZASIEG_BLYSKU skali. */
export function jasnoscBlysku(odl, skala) {
    return clamp01(1 - odl / (skala * NASTAWY.ZASIEG_BLYSKU));
}

export class MglaMokoszy {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._kleby = [];
        this._doNarodzin = false;
        this._blysk = null;   // { x, y, sila, wiek } - reakcja Burza w mgle
        this._kotwica = new Kotwica(8);
        this._warstwa = new WarstwaZaSylwetka();
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    /** Reakcja Burza w mgle: mgła błyska od `zrodlo` (px). @returns {boolean} */
    rozblysk(zrodlo, sila = 1) {
        if (!this._trwa || !zrodlo || !Number.isFinite(zrodlo.x) || !Number.isFinite(zrodlo.y)) return false;
        this._blysk = { x: zrodlo.x, y: zrodlo.y, sila: clamp01(sila), wiek: 0 };
        return true;
    }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kleby = [];
        this._doNarodzin = true;
        this._blysk = null;
        this._kotwica.reset();
    }

    _narodziny(W, zaczep) {
        const N = NASTAWY;
        const kierunek = Math.random() < 0.5 ? -1 : 1;   // jedna strona wjazdu dla całej mgły
        const sk = zaczep.skala;
        this._kleby = Array.from({ length: N.LICZBA }, () => {
            const rozmiar = sk * (N.ROZMIAR_OD + Math.random() * (N.ROZMIAR_DO - N.ROZMIAR_OD));
            return {
                x: kierunek > 0 ? -rozmiar / 2 - Math.random() * sk : W + rozmiar / 2 + Math.random() * sk,
                y: zaczep.y + sk * (N.PAS_OD + Math.random() * (N.PAS_DO - N.PAS_OD)),
                v0: kierunek * ((W + 2 * rozmiar) / N.CZAS_PRZEJAZDU) * (0.85 + Math.random() * 0.3),
                wiek: -Math.random() * N.OPOZNIENIE_MAX,
                rozmiar,
                obrot: Math.random() * Math.PI * 2,
                vObrot: (Math.random() * 2 - 1) * 0.3,
                wariant: Math.floor(Math.random() * MANIFEST.mgla.length)
            };
        });
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        if (this._doNarodzin) { this._narodziny(W, zaczep); this._doNarodzin = false; }
        for (const c of this._kleby) {
            c.wiek += krok;
            if (c.wiek < 0) continue;
            c.x += predkoscKlebu(c.x, zaczep.x, c.v0, zaczep.skala) * krok;
            c.obrot += c.vObrot * krok;
        }
        if (this._blysk) {
            this._blysk.wiek += krok;
            if (this._blysk.wiek >= NASTAWY.BLYSK_ZYCIE) this._blysk = null;
        }
        if (!ctx) return;

        const alfa = obwiednia(this._t) * this._sila * NASTAWY.ALFA;
        if (alfa < 0.005) return;
        const warstwa = this._warstwa.zacznij(W, H);
        if (!warstwa) return;
        for (const c of this._kleby) {
            if (c.wiek < 0) continue;
            const img = obraz(MANIFEST.mgla[c.wariant]);
            if (!img) continue;
            warstwa.save();
            warstwa.translate(c.x, c.y);
            warstwa.rotate(c.obrot);
            warstwa.globalAlpha = clamp01(alfa * Math.min(1, c.wiek / 0.5));
            warstwa.drawImage(wypalTintowany(img, NASTAWY.BARWA, 256), -c.rozmiar / 2, -c.rozmiar / 2, c.rozmiar, c.rozmiar);
            if (this._blysk) {
                // Błysk od środka: ten sam kłąb, jasny i addytywny, słabnący z odległością od wyładowania.
                const b = this._blysk;
                const jas = jasnoscBlysku(Math.hypot(c.x - b.x, c.y - b.y), zaczep.skala) * (1 - b.wiek / NASTAWY.BLYSK_ZYCIE) * b.sila;
                if (jas > 0.01) {
                    warstwa.globalCompositeOperation = 'lighter';
                    warstwa.globalAlpha = clamp01(jas * this._sila);
                    warstwa.drawImage(wypalTintowany(img, NASTAWY.BARWA_BLYSKU, 256), -c.rozmiar / 2, -c.rozmiar / 2, c.rozmiar, c.rozmiar);
                    warstwa.globalCompositeOperation = 'source-over';
                }
            }
            warstwa.restore();
        }
        this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
    }
}
