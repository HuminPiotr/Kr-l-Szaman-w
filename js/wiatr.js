/**
 * Efekt Striboga - smugi wiatru przecinające kadr.
 *
 * CELOWO minimalny i samodzielny. Pełny system efektów (wiele naraz, wspólny
 * cykl życia, kolejność rysowania) to osobny kawałek pracy. Tutaj chodzi
 * o jedno: żeby drugi znak był WIDOCZNY, a nie tylko liczbą w nakładce.
 *
 * Siła = moc (z tańca) x wynik znaku - dokładnie ta sama zasada, co przy kuli.
 */

const LICZBA_SMUG = 70;

export class Wiatr {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.smugi = Array.from({ length: LICZBA_SMUG }, () => this._nowaSmuga(true));
    }

    _nowaSmuga(gdziekolwiek = false) {
        return {
            x: gdziekolwiek ? Math.random() * this.canvas.width : -50,
            y: Math.random() * this.canvas.height,
            dlugosc: 40 + Math.random() * 140,
            predkosc: 4 + Math.random() * 14,
            grubosc: 0.6 + Math.random() * 1.8,
            alpha: 0.15 + Math.random() * 0.5
        };
    }

    /**
     * @param {number} sila 0..1 - moc z tańca przemnożona przez wynik znaku
     * @param {number} kierunek -1 (w lewo) albo 1 (w prawo)
     */
    updateAndDraw(sila, kierunek = 1) {
        if (sila <= 0.01) return;

        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        for (const s of this.smugi) {
            s.x += s.predkosc * kierunek * (0.3 + sila * 1.7);

            // Smuga, która wyszła poza kadr, wraca z przeciwnej strony
            if (kierunek > 0 && s.x - s.dlugosc > this.canvas.width) {
                Object.assign(s, this._nowaSmuga(), { x: -s.dlugosc });
            } else if (kierunek < 0 && s.x + s.dlugosc < 0) {
                Object.assign(s, this._nowaSmuga(), { x: this.canvas.width + s.dlugosc });
            }

            // Blady błękit wiatru - odróżnia Striboga od ognistej kuli Swaroga
            ctx.strokeStyle = `rgba(150, 220, 255, ${s.alpha * sila})`;
            ctx.lineWidth = s.grubosc * (0.5 + sila);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.dlugosc * kierunek * sila, s.y);
            ctx.stroke();
        }

        ctx.restore();
    }
}
