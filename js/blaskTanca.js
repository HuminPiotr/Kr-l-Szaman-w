/**
 * Blask tańca - "aura mówi" (spec 2026-10-14-jakosc-tanca-design.md, sekcja 4).
 *
 * Bez napisów pokazuje graczowi, ZA CO dostaje więcej mocy:
 *  - połysk partii: tańcząca partia (biodra, barki, głowa, dłonie, stopy) dostaje
 *    miękki, ciepły blask w swoim miejscu - "biodra też tańczą",
 *  - bieg fali: przy wysokiej fali jasna kreska biegnie wzdłuż łańcucha, który ją
 *    niesie, w tempie okresu ruchu. KRESKA PO WĘZŁACH, nie sprite - to zadziałało
 *    przy VFX (sprite'y nie dawały ciągłości).
 * Rysowane przez 'lighter' po aurze. Wszystko wygładzane - trans, nie migotanie.
 * Pozycje z frame.pose.landmarks (2D, x·width, y·height - jak js/bania.js).
 */
import { PARTIE } from './jakosc/zaangazowanie.js';

// ZGADNIĘTE - stroić na żywo.
export const NASTAWY_BLASKU = {
    TAU_S: 0.5,
    ALFA: 0.30,               // jasność połysku przy pełnej aktywności i pełnej mocy
    PROMIEN_BW: 0.45,         // promień połysku w szerokościach barków
    PROG_FALI: 0.35,          // poniżej kreska fali nie biegnie
    DLUGOSC_KRESKI: 0.22,     // ułamek długości łańcucha
    GRUBOSC_BW: 0.06,
    BARWA: '255, 190, 110'    // ciepły żar - ta sama rodzina co BARWA_PLYNNA aury
};
const N = NASTAWY_BLASKU;

const PUNKTY_PARTII = { rekaL: [15], rekaP: [16], nogaL: [27], nogaP: [28], biodra: [23, 24], tulow: [11, 12], glowa: [0] };
const LANCUCHY = { ramieL: [[11], [13], [15]], ramieP: [[12], [14], [16]], biodraDlonie: [[23, 24], [11, 12], [15, 16]] };

const ok = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= 0.5);
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export class BlaskTanca {
    constructor() {
        this._sila = Object.fromEntries(PARTIE.map(p => [p, 0]));
        this._fala = 0;
        this._faza = 0;
    }

    updateAndDraw(ctx, frame, jakosc, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const a = Math.min(1, krok / N.TAU_S);
        const akt = jakosc?.zaangazowanieMiara?.aktywnosci ?? {};
        for (const p of PARTIE) this._sila[p] += a * (clamp01(akt[p]) - this._sila[p]);
        this._fala += a * (clamp01(jakosc?.falaMiara?.fala) - this._fala);
        const okres = jakosc?.okres?.okresS;
        const T = Number.isFinite(okres) ? Math.max(0.25, Math.min(2.5, okres)) : 1;
        this._faza = (this._faza + krok / T) % 1;

        const lm = frame?.pose?.landmarks;
        const W = frame?.width, H = frame?.height;
        if (!ctx || !lm || !(W > 0) || !(H > 0)) return;
        const srodek = (idx) => {
            const pts = idx.map(i => lm[i]).filter(ok);
            if (!pts.length) return null;
            return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length * W, y: pts.reduce((s, p) => s + p.y, 0) / pts.length * H };
        };
        const b1 = srodek([11]), b2 = srodek([12]);
        const bw = b1 && b2 ? Math.hypot(b1.x - b2.x, b1.y - b2.y) : NaN;
        if (!(bw > 5)) return;
        const jas = 0.4 + 0.6 * clamp01(moc);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const p of PARTIE) {
            const s = this._sila[p];
            if (s < 0.02) continue;
            const c = srodek(PUNKTY_PARTII[p]);
            if (!c) continue;
            const r = N.PROMIEN_BW * bw;
            const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
            g.addColorStop(0, `rgba(${N.BARWA}, ${(N.ALFA * s * jas).toFixed(3)})`);
            g.addColorStop(1, `rgba(${N.BARWA}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const lancuch = jakosc?.falaMiara?.diagnostyka?.lancuch;
        if (this._fala > N.PROG_FALI && LANCUCHY[lancuch]) {
            const wezly = LANCUCHY[lancuch].map(srodek);
            if (wezly.every(Boolean)) this._rysujBieg(ctx, wezly, bw, (this._fala - N.PROG_FALI) / (1 - N.PROG_FALI) * jas);
        }
        ctx.restore();
    }

    /** Kreska od (faza - DLUGOSC) do fazy wzdłuż łamanej węzłów - jasny punkt biegnący od barku/bioder do dłoni. */
    _rysujBieg(ctx, wezly, bw, alfa) {
        const odc = [];
        let dl = 0;
        for (let i = 1; i < wezly.length; i++) {
            const d = Math.hypot(wezly[i].x - wezly[i - 1].x, wezly[i].y - wezly[i - 1].y);
            odc.push(d); dl += d;
        }
        if (!(dl > 1)) return;
        const punkt = (u) => {
            let x = Math.max(0, Math.min(1, u)) * dl;
            for (let i = 0; i < odc.length; i++) {
                if (x <= odc[i] || i === odc.length - 1) {
                    const t = odc[i] > 0 ? Math.min(1, x / odc[i]) : 0;
                    return { x: wezly[i].x + t * (wezly[i + 1].x - wezly[i].x), y: wezly[i].y + t * (wezly[i + 1].y - wezly[i].y) };
                }
                x -= odc[i];
            }
            return wezly[wezly.length - 1];
        };
        const KROKOW = 8;
        ctx.lineCap = 'round';
        for (let k = 0; k < KROKOW; k++) {
            const u0 = this._faza - N.DLUGOSC_KRESKI * (1 - k / KROKOW);
            const u1 = this._faza - N.DLUGOSC_KRESKI * (1 - (k + 1) / KROKOW);
            if (u1 < 0) continue;
            const p0 = punkt(u0), p1 = punkt(u1);
            ctx.strokeStyle = `rgba(${N.BARWA}, ${(clamp01(alfa) * (k + 1) / KROKOW).toFixed(3)})`;
            ctx.lineWidth = N.GRUBOSC_BW * bw * (0.4 + 0.6 * (k + 1) / KROKOW);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }
    }
}
