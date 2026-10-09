/**
 * Warstwa rysowana ZA sylwetką gracza - mgła, przez którą ciało się
 * "wynurza" (Mgła Mokoszy), tylna połowa orbity kamieni (Kamienna Tarcza)
 * i pyłu (Kurzawa). Proste combo 2026-10-02.
 *
 * Gra nie ma osobnej warstwy "za ciałem" - wideo i efekty leżą na jednym
 * płótnie. Zamiast tego: efekt rysuje się na płótnie pomocniczym, z którego
 * WYCINAMY maskę segmentacji (destination-out, ta sama maska i ten sam
 * `fit` co zaplon.js), i dopiero wtedy nakładamy je na scenę. Ciało zostaje
 * nietknięte, więc czyta się jako stojące PRZED efektem.
 *
 * Bez maski (brak pozy, maska jeszcze nie przyszła) warstwa nakłada się bez
 * wycinania - efekt widać, tylko leży na ciele (GEMINI.md §2).
 */
export class WarstwaZaSylwetka {
    constructor() {
        this._plotno = null;
        this._ctx = null;
        this._maska = null;
        this._maskaCtx = null;
        this._obraz = null;
    }

    /**
     * Czyści i zwraca kontekst warstwy W×H. null bez `document` (testy w Node)
     * albo przy złych wymiarach - wywołujący pomija wtedy rysowanie tej warstwy.
     */
    zacznij(W, H) {
        if (typeof document === 'undefined' || !(W > 0) || !(H > 0)) return null;
        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._ctx = this._plotno.getContext('2d');
        }
        if (this._plotno.width !== W || this._plotno.height !== H) {
            this._plotno.width = W;
            this._plotno.height = H;
        }
        this._ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.globalAlpha = 1;
        this._ctx.clearRect(0, 0, W, H);
        return this._ctx;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx  scena
     * @param {Uint8Array|null} maska  pewność 0..255, jak zaplon.updateAndDraw
     * @param {number} szer
     * @param {number} wys
     * @param {{offsetX,offsetY,scaledW,scaledH}|null} fit
     * @param {GlobalCompositeOperation} [tryb]  jak nałożyć warstwę na scenę -
     *        'lighter' dla efektów świetlnych (Błędne Ogniki), domyślnie zwykłe krycie
     */
    zakoncz(ctx, maska, szer, wys, fit, tryb = 'source-over') {
        if (!ctx || !this._ctx) return;
        if (maska && szer > 0 && wys > 0 && fit && maska.length >= szer * wys) {
            this._wypelnijMaske(maska, szer, wys);
            this._ctx.globalCompositeOperation = 'destination-out';
            this._ctx.globalAlpha = 1;
            this._ctx.drawImage(this._maska, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
            this._ctx.globalCompositeOperation = 'source-over';
        }
        ctx.save();
        ctx.globalCompositeOperation = tryb;
        ctx.globalAlpha = 1;
        ctx.drawImage(this._plotno, 0, 0);
        ctx.restore();
    }

    /** Maska ma jeden kanał; przenosimy go w alfę - ten sam wzór co zaplon.js _wypelnijMaske. */
    _wypelnijMaske(maska, szer, wys) {
        if (!this._maska) {
            this._maska = document.createElement('canvas');
            this._maskaCtx = this._maska.getContext('2d');
        }
        if (this._maska.width !== szer || this._maska.height !== wys || !this._obraz) {
            this._maska.width = szer;
            this._maska.height = wys;
            this._obraz = this._maskaCtx.createImageData(szer, wys);
        }
        const d = this._obraz.data;
        for (let i = 0, n = szer * wys; i < n; i++) {
            const j = i * 4;
            d[j] = 255; d[j + 1] = 255; d[j + 2] = 255;
            d[j + 3] = maska[i];
        }
        this._maskaCtx.putImageData(this._obraz, 0, 0);
    }
}
