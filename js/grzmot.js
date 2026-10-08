/**
 * Grzmot - nagroda za combo perun -> stribog (2026-10-08, spec
 * docs/superpowers/specs/2026-10-08-grzmot-i-zawierucha-design.md).
 * Błyskawica (Perun) rozdziera powietrze (Stribog): huk, fala uderzeniowa
 * z klatki piersiowej.
 *
 * DWÓJKA DZIAŁAJĄCA NA POLE: sam w sobie skromny (jedna fala), ciekawy
 * dopiero w długiej technice - robi dziurę w Mgle Mokoszy, szarpie pasy
 * Kurzawy (js/reakcjeTechnik.js), rozrzuca dym Okadzenia.
 *
 * Ten moduł NIE RYSUJE. Efekt to wspólna Fala (js/fala.js) - techniki.js
 * woła fala.wystrzel() obok zapal(). Dzięki temu dym rozdmuchuje istniejący
 * PULL fala.czola -> dym.pchnij w main.js, bez nowej fizyki (jak Grom
 * w Ziemię). Tu żyje tylko ZDARZENIE wybuchu, które czytają reakcje.
 *
 * `wybuch` jest widoczny przez DOKŁADNIE JEDNĄ klatkę: zapal() dzieje się
 * w kroku pieczęci (przed updateAndDraw), updateAndDraw go publikuje,
 * a kolejne wywołanie czyści - reakcje (po updateAndDraw) widzą go raz.
 */
import { barkiKlatki } from './sledzenie.js';

export const NASTAWY = {
    POD_BARKAMI: 0.6,     // skala * to - klatka piersiowa pod środkiem barków
    SILA_FALI: 0.7,       // techniki.js -> fala.wystrzel
    CZAS_TRWANIA: 0.6     // s - tyle Grzmot uchodzi za aktywny (HUD, reakcje)
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/**
 * Zaczep fali - klatka piersiowa. Bez pozy umowny środek kadru (efekt nigdy
 * nie znika przez zgubioną pozę - GEMINI.md §2).
 * @returns {{x:number, y:number, skala:number}}  px
 */
export function zaczepKlatki(frame, W, H) {
    const b = barkiKlatki(frame, W, H);
    if (!b) return { x: W * 0.5, y: H * 0.5, skala: W * 0.12 };
    return { x: b.x, y: b.y + b.skala * NASTAWY.POD_BARKAMI, skala: b.skala };
}

export class Grzmot {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._doWybuchu = null;
        this.wybuch = null;   // {x, y, skala, sila} - jedna klatka po zapal()
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    /** @param {{x,y,skala}} zaczep  px, z zaczepKlatki() */
    zapal(zaczep, sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y) || !(zaczep.skala > 0)) return;
        this._t = 0;
        this._trwa = true;
        this._doWybuchu = { x: zaczep.x, y: zaczep.y, skala: zaczep.skala, sila: s };
    }

    updateAndDraw(ctx, k, dt) {
        this.wybuch = this._doWybuchu;
        this._doWybuchu = null;
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= NASTAWY.CZAS_TRWANIA) this._trwa = false;
    }
}
