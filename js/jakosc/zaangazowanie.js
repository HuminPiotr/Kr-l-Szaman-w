/**
 * Zaangażowanie ciała - ile partii tańczy (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Siedem partii, każda z CIĄGŁĄ aktywnością 0..1 (rampa prędkości ponad podłogą
 * szumu). Wynik min(1, Σ/4): cztery partie wystarczą do pełnej wartości - nie
 * trzeba ruszać wszystkim naraz. Same ręce ~0.5.
 *
 * Nowe partie idą do JAKOŚCI, nie do prędkości MotionMetera: szum bioder i głowy
 * nie może podnieść podłogi bezruchu (patrz PROG_SZUMU_MS w js/motionMeter.js).
 *
 * Sygnały: ręce, nogi, tułów, głowa z worldLandmarks (metry, x/y); biodra z 2D
 * (js/jakosc/cialo2d.js, szerokości barków/s) - world ich nie widzi.
 */
import { rampa, widoczny } from './pochodne.js';

export const PARTIE = ['rekaL', 'rekaP', 'nogaL', 'nogaP', 'biodra', 'tulow', 'glowa'];

// ZGADNIĘTE - stroić z nakładki D i tools/pomiar-jakosci.mjs.
export const NASTAWY_ZAANGAZOWANIA = {
    TAU_POZYCJI_S: 0.17,     // jak ALFA_POZYCJI MotionMetera: szum z ~1.2 do ~0.07 m/s
    TAU_PREDKOSCI_S: 0.5,
    PROGI: {                 // [od, do] - poniżej "od" szum, od "do" pełna aktywność
        reka:   [0.12, 0.45],    // m/s
        noga:   [0.10, 0.35],    // m/s
        biodra: [0.20, 0.80],    // szerokości barków / s (2D)
        tulow:  [0.10, 0.35],    // m/s (środek barków względem bioder; skręt przez SKALA_SKRETU_M)
        glowa:  [0.10, 0.30]     // m/s (nos względem środka barków) - różnica dwóch zaszumionych punktów, szum ~0.085
    },
    SKALA_SKRETU_M: 0.2,     // 1 rad skrętu barków względem bioder liczony jak 0.2 m ruchu
    PELNE_PRZY: 4,
    PROG_CISZY: 0.05         // suma aktywności poniżej = nic nie tańczy -> null (neutralnie)
};
const N = NASTAWY_ZAANGAZOWANIA;

/** Prędkość punktu: filtr dolnoprzepustowy na POZYCJI, potem różnica, potem wygładzenie. */
class SledzonaPredkosc {
    constructor() { this._p = null; this.v = 0; }
    update(p, dt) {
        const aV = Math.min(1, dt / N.TAU_PREDKOSCI_S);
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            this._p = null;
            this.v += aV * (0 - this.v);
            return this.v;
        }
        if (!this._p) { this._p = { x: p.x, y: p.y }; return this.v; }
        const a = Math.min(1, dt / N.TAU_POZYCJI_S);
        const nx = this._p.x + a * (p.x - this._p.x), ny = this._p.y + a * (p.y - this._p.y);
        const chwilowa = Math.hypot(nx - this._p.x, ny - this._p.y) / dt;
        this._p = { x: nx, y: ny };
        if (Number.isFinite(chwilowa)) this.v += aV * (chwilowa - this.v);
        return this.v;
    }
}

const katLinii = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const zawin = (k) => Math.atan2(Math.sin(k), Math.cos(k));

export class Zaangazowanie {
    constructor() {
        this.zaangazowanie = null;
        this.aktywnosci = Object.fromEntries(PARTIE.map(p => [p, 0]));
        this.predkosci = Object.fromEntries(PARTIE.map(p => [p, 0]));
        this._s = {
            rekaL: new SledzonaPredkosc(), rekaP: new SledzonaPredkosc(),
            kolanoL: new SledzonaPredkosc(), kolanoP: new SledzonaPredkosc(),
            kostkaL: new SledzonaPredkosc(), kostkaP: new SledzonaPredkosc(),
            biodra: new SledzonaPredkosc(), barki: new SledzonaPredkosc(),
            skret: new SledzonaPredkosc(), glowa: new SledzonaPredkosc()
        };
    }

    update(world, biodraBw, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.zaangazowanie;
        const krok = Math.min(dt, 0.1);
        const pt = (i) => (world && widoczny(world[i]) ? { x: world[i].x, y: world[i].y } : null);
        const sr = (a, b) => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);

        const b11 = pt(11), b12 = pt(12), h23 = pt(23), h24 = pt(24), nos = pt(0);
        const barki = sr(b11, b12);
        const skret = b11 && b12 && h23 && h24
            ? { x: zawin(katLinii(b11, b12) - katLinii(h23, h24)) * N.SKALA_SKRETU_M, y: 0 } : null;
        const glowa = nos && barki ? { x: nos.x - barki.x, y: nos.y - barki.y } : null;

        const S = this._s;
        const v = {
            rekaL: S.rekaL.update(pt(15), krok),
            rekaP: S.rekaP.update(pt(16), krok),
            nogaL: Math.max(S.kolanoL.update(pt(25), krok), S.kostkaL.update(pt(27), krok)),
            nogaP: Math.max(S.kolanoP.update(pt(26), krok), S.kostkaP.update(pt(28), krok)),
            biodra: S.biodra.update(world ? biodraBw : null, krok),
            tulow: Math.max(S.barki.update(barki, krok), S.skret.update(skret, krok)),
            glowa: S.glowa.update(glowa, krok)
        };
        const prog = { rekaL: 'reka', rekaP: 'reka', nogaL: 'noga', nogaP: 'noga', biodra: 'biodra', tulow: 'tulow', glowa: 'glowa' };

        let suma = 0;
        for (const p of PARTIE) {
            const [od, doo] = N.PROGI[prog[p]];
            const vp = Number.isFinite(v[p]) ? v[p] : 0;
            this.predkosci[p] = vp;
            // Niewidoczna partia (np. stopy poza kadrem) to 0, nie zgadywanie z resztki filtra.
            const brak = (p === 'nogaL' && !pt(25) && !pt(27)) || (p === 'nogaP' && !pt(26) && !pt(28));
            this.aktywnosci[p] = brak ? 0 : rampa(vp, od, doo);
            suma += this.aktywnosci[p];
        }

        this.zaangazowanie = !world || suma < N.PROG_CISZY ? null : Math.min(1, suma / N.PELNE_PRZY);
        return this.zaangazowanie;
    }
}
