/**
 * Ciało w 2D - tylko to, czego worldLandmarks NIE widzą.
 *
 * worldLandmarks mają początek układu w środku bioder, więc kroki i kołysanie
 * bioder są w nich niewidoczne (zastrzeżenie z nagłówka js/motionMeter.js).
 * Stąd landmarks 2D - ale te są znormalizowane OSOBNO do szerokości i wysokości
 * płótna, więc najpierw przeliczamy na piksele (x·W, y·H), a potem dzielimy przez
 * szerokość barków w pikselach: wynik nie zależy od odległości od kamery.
 * Współrzędne względem środka płótna - zmiana skali (krok do kamery) nie udaje
 * wtedy dużego ruchu.
 */
import { widoczny } from './pochodne.js';

const TAU_SZEROKOSCI_S = 1.0;   // szerokość barków zmienia się wolno - obrót nie może udawać ruchu

export class Cialo2D {
    constructor() {
        this.szerokoscPx = null;
    }

    /** @returns {{biodra: {x:number,y:number}|null, dlonieX: number|null}} w szerokościach barków */
    update(landmarks, W, H, dt) {
        const pusto = { biodra: null, dlonieX: null };
        if (!landmarks || !(W > 0) || !(H > 0)) return pusto;
        const px = (i) => (widoczny(landmarks[i]) ? { x: landmarks[i].x * W, y: landmarks[i].y * H } : null);

        const b1 = px(11), b2 = px(12);
        if (b1 && b2) {
            const s = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            if (Number.isFinite(s) && s > 1) {
                const a = Number.isFinite(dt) && dt > 0 ? Math.min(1, dt / TAU_SZEROKOSCI_S) : 0;
                this.szerokoscPx = this.szerokoscPx === null ? s : this.szerokoscPx + a * (s - this.szerokoscPx);
            }
        }
        const bw = this.szerokoscPx;
        if (!(bw > 1)) return pusto;

        const h1 = px(23), h2 = px(24), d1 = px(15), d2 = px(16);
        return {
            biodra: h1 && h2 ? { x: ((h1.x + h2.x) / 2 - W / 2) / bw, y: ((h1.y + h2.y) / 2 - H / 2) / bw } : null,
            dlonieX: d1 && d2 ? ((d1.x + d2.x) / 2 - W / 2) / bw : null
        };
    }
}
