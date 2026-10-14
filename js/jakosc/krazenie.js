/**
 * Krążenie bez nawrotów - "łuki zamiast linii" (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * DLACZEGO NIE KRZYWIZNA: dzisiejszy exploit (wysokie podnoszenie i opuszczanie
 * prostych rąk) kreśli ŁUK wokół barku, który ma duże przyspieszenie normalne.
 * Udział a_n dawałby mu wynik jak kręgom. Różnicą jest NAWRÓT: wahadło wraca
 * po tym samym torze w PRZECIWNĄ stronę, okrąg i ósemka wracają w tę samą.
 *
 * Miara: dla każdej próbki i bierzemy PIERWSZY późniejszy powrót stawu w to
 * samo miejsce (dalej niż MIN_ODSTEP_S w czasie, bliżej niż promień "tego samego
 * miejsca") i porównujemy kierunki prędkości:
 *   wynik = (Σ v_i·v_j / Σ |v_i||v_j| + 1) / 2
 * Wahadło: pierwszy powrót to droga z powrotem -> cos = -1 -> 0.
 * Okrąg: pierwszy powrót to następne okrążenie -> cos = +1 -> 1.
 * Ósemka: wysoko (na skrzyżowaniu kierunki różnią się o ~90°, wszędzie indziej zgodne).
 * Bezwymiarowe - tempo tańca go nie zmienia.
 */
import { clamp01, widoczny } from './pochodne.js';

const STAWY = [15, 16, 13, 14, 27, 28];

export const NASTAWY_KRAZENIA = {
    OKNO_S: 4.0,             // musi objąć ponad jeden cykl, inaczej okrąg nie ma "powrotu"
    CO_ILE_S: 0.25,
    POL_ROZNICY_S: 0.08,     // prędkość z różnicy centralnej +-tyle
    MIN_ODSTEP_S: 0.15,      // krótszy odstęp to ta sama chwila, nie powrót
    BLISKO_UL: 0.2,          // "to samo miejsce" = 20% rozrzutu stawu...   (ZGADNIĘTE)
    BLISKO_MIN_M: 0.03,      // ...ale nie mniej niż 3 cm (szum ~0.9 cm)
    PROG_PREDKOSCI: 0.18,    // m/s średnio - jak w płynności: wolniejszy staw nie głosuje
    MIN_ROZPIETOSC_S: 1.0,
    TAU_S: 0.8               // wygładzanie wyniku
};
const N = NASTAWY_KRAZENIA;

export class Krazenie {
    constructor() {
        this.krazenie = null;       // null = brak danych (bezruch, poza kadrem)
        this.aktywnychStawow = 0;
        this._bufory = STAWY.map(() => []);   // [{t, x, y}]
        this._t = 0;
        this._doPrzeliczenia = 0;
    }

    update(world, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.krazenie;
        const krok = Math.min(dt, 0.1);
        this._t += krok;

        for (let s = 0; s < STAWY.length; s++) {
            const p = world?.[STAWY[s]];
            const buf = this._bufory[s];
            if (!widoczny(p)) { buf.length = 0; continue; }   // przerwa = okno od nowa
            buf.push({ t: this._t, x: p.x, y: p.y });
            while (buf.length && this._t - buf[0].t > N.OKNO_S) buf.shift();
        }

        this._doPrzeliczenia -= krok;
        if (this._doPrzeliczenia > 0) return this.krazenie;
        this._doPrzeliczenia = N.CO_ILE_S;

        let S = 0, W = 0, aktywne = 0;
        for (const buf of this._bufory) {
            const r = ocenStaw(buf);
            if (!r) continue;
            S += r.s; W += r.w; aktywne++;
        }
        this.aktywnychStawow = aktywne;
        if (!(W > 0)) { this.krazenie = null; return null; }

        const surowe = clamp01((S / W + 1) / 2);
        const a = Math.min(1, N.CO_ILE_S / N.TAU_S);
        this.krazenie = this.krazenie === null ? surowe : this.krazenie + a * (surowe - this.krazenie);
        if (!Number.isFinite(this.krazenie)) this.krazenie = null;
        return this.krazenie;
    }
}

function ocenStaw(buf) {
    const n = buf.length;
    if (n < 10 || buf[n - 1].t - buf[0].t < N.MIN_ROZPIETOSC_S) return null;
    const dtSr = (buf[n - 1].t - buf[0].t) / (n - 1);
    const k = Math.max(1, Math.round(N.POL_ROZNICY_S / dtSr));

    const v = [];
    let sumaV = 0, mx = 0, my = 0;
    for (let j = k; j < n - k; j++) {
        const a = buf[j - k], b = buf[j + k];
        const dt = b.t - a.t;
        const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
        v.push({ t: buf[j].t, x: buf[j].x, y: buf[j].y, vx, vy, m: Math.hypot(vx, vy) });
        sumaV += Math.hypot(vx, vy); mx += buf[j].x; my += buf[j].y;
    }
    if (v.length < 4 || sumaV / v.length < N.PROG_PREDKOSCI) return null;

    mx /= v.length; my /= v.length;
    let war = 0;
    for (const p of v) war += (p.x - mx) ** 2 + (p.y - my) ** 2;
    const promien = Math.max(N.BLISKO_MIN_M, N.BLISKO_UL * Math.sqrt(war / v.length));

    let s = 0, w = 0;
    for (let i = 0; i < v.length; i++) {
        const a = v[i];
        for (let j = i + 1; j < v.length; j++) {
            const b = v[j];
            if (b.t - a.t < N.MIN_ODSTEP_S) continue;
            if (Math.hypot(b.x - a.x, b.y - a.y) > promien) continue;
            s += a.vx * b.vx + a.vy * b.vy;
            w += a.m * b.m;
            break;  // tylko PIERWSZY powrót - dalsze to kolejne okrążenia wahadła
        }
    }
    return w > 0 && Number.isFinite(s) ? { s, w } : null;
}
