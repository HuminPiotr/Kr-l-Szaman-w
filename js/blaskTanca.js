/**
 * Blask tańca - "aura mówi" (spec 2026-10-14-jakosc-tanca-design.md, sekcja 4).
 *
 * Miękkie ciepło tańczącej partii (biodra, barki, głowa, dłonie, stopy) w jej
 * miejscu - "biodra też tańczą". Ma być ledwo widoczne: duży, rozlany gradient,
 * nie świecący punkt.
 *
 * 2026-10-30: usunięty "bieg fali" (jasna kreska biegnąca po stawach) i przygaszony
 * połysk - właściciel uznał świetliste punkty po stawach za za nachalne. Jakość
 * tańca mówi teraz głównie sama aura (js/aura.js: barwa żaru i tętno).
 *
 * Rysowane przez 'lighter' po aurze. Wszystko wygładzane - trans, nie migotanie.
 * Pozycje z frame.pose.landmarks (2D, x·width, y·height - jak js/bania.js).
 */
import { PARTIE } from './jakosc/zaangazowanie.js';

// ZGADNIĘTE - stroić na żywo.
export const NASTAWY_BLASKU = {
    TAU_S: 0.8,               // wolniej niż dawniej (0.5) - ciepło narasta, nie zapala się
    ALFA: 0.10,               // było 0.30 - punkty były za wyraźne
    PROMIEN_BW: 0.8,          // było 0.45 - szerzej i miękcej, rozlane, nie punkt
    BARWA: '255, 190, 110'    // ciepły żar - ta sama rodzina co BARWA_PLYNNA aury
};
const N = NASTAWY_BLASKU;

const PUNKTY_PARTII = { rekaL: [15], rekaP: [16], nogaL: [27], nogaP: [28], biodra: [23, 24], tulow: [11, 12], glowa: [0] };

const ok = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= 0.5);
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export class BlaskTanca {
    constructor() {
        this._sila = Object.fromEntries(PARTIE.map(p => [p, 0]));
    }

    updateAndDraw(ctx, frame, jakosc, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const a = Math.min(1, krok / N.TAU_S);
        const akt = jakosc?.zaangazowanieMiara?.aktywnosci ?? {};
        for (const p of PARTIE) this._sila[p] += a * (clamp01(akt[p]) - this._sila[p]);

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
        ctx.restore();
    }
}
