/**
 * Zgodność z rytmem pieśni 0..1 (spec 2026-10-30-trans-design.md).
 *
 * WYROZUMIAŁA z założenia - grają amatorzy i dzieci. Nie sprawdzamy, czy ruch
 * trafia DOKŁADNIE w uderzenie, tylko czy akcenty ruchu wracają w TYM SAMYM
 * miejscu taktu. Stałe przesunięcie (ktoś zawsze trochę spóźniony, opóźnienie
 * kamery ~100 ms) daje więc pełną zgodność, a chaos - niską.
 *
 *  1. Akcent ruchu = wyraźny szczyt wygładzonej prędkości kończyn
 *     (nadgarstki, łokcie, kostki - te same stawy co MotionMeter).
 *  2. Faza uderzenia pieśni w chwili akcentu, na trzech siatkach: pół uderzenia
 *     (podskok w dół i w górę na każde uderzenie daje dwa szczyty), uderzenie
 *     i dwa uderzenia (ruch co drugie uderzenie) - tolerancja ½x / 2x z planu 2026-10-14.
 *  3. Spójność faz z ostatnich ~8 uderzeń: długość średniego wektora fazy
 *     (phase locking), poprawiona o obciążenie małej próby - inaczej 5 losowych
 *     akcentów dawało ~0.45.
 *
 * NIE opiera się na js/jakosc/okres.js - swobodny taniec rzadko ma pewny okres.
 */
import { rampa } from '../jakosc/pochodne.js';

// ZGADNIĘTE - stroić na nagraniu sesji T (tools/pomiar-transu.mjs).
export const NASTAWY_ZGODNOSCI = {
    STAWY: [15, 16, 13, 14, 27, 28],
    PROG_WIDOCZNOSCI: 0.5,
    TAU_POZYCJI_S: 0.08,      // krócej niż MotionMeter (0.17) - liczy się chwila akcentu, nie średnia moc
    PROG_AKCENTU_MS: 0.3,     // szczyt prędkości poniżej tego to szum śledzenia
    WYRAZISTOSC_MS: 0.15,     // szczyt musi wystawać tyle ponad dolinę od poprzedniego akcentu
    MIN_ODSTEP_S: 0.15,
    OKNO_UDERZEN: 8,
    MIN_AKCENTOW: 3, PELNE_OD_AKCENTOW: 6,
    SPOJNOSC_OD: 0.3, SPOJNOSC_DO: 0.7,
    TAU_S: 1.0                // wynik wygładzony - trans, nie migotanie
};
const N = NASTAWY_ZGODNOSCI;

const widoczny = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= N.PROG_WIDOCZNOSCI);

/** Spójność faz (0..1) poprawiona o obciążenie: losowe n faz daje ~0 zamiast ~1/sqrt(n). */
export function spojnoscFaz(fazy01) {
    const n = fazy01.length;
    if (n < 2) return 0;
    let c = 0, s = 0;
    for (const f of fazy01) { c += Math.cos(2 * Math.PI * f); s += Math.sin(2 * Math.PI * f); }
    const r2 = (c * c + s * s) / (n * n);
    return Math.sqrt(Math.max(0, (n * r2 - 1) / (n - 1)));
}

export class ZgodnoscRytmu {
    constructor() {
        this.zgodnosc = null;        // null = brak pieśni z rytmem
        this.surowa = 0;             // przed wygładzeniem - do nakładki D
        this.siatkaWygrana = null;   // '1/2' | '1' | '2' - która siatka niesie rytm
        this.predkosc = 0;
        this._poz = null;
        this._akcenty = [];          // [{t, indeks, faza01}]
        this._v1 = 0; this._v2 = 0;  // prędkość klatkę i dwie wstecz
        this._dolina = Infinity;
        this._ostatniAkcentS = -Infinity;
    }

    _zeruj() {
        this.zgodnosc = null; this.surowa = 0; this.siatkaWygrana = null;
        this._akcenty.length = 0; this._poz = null; this._dolina = Infinity;
    }

    /**
     * @param {Array|null} world  worldLandmarks
     * @param {number} dt
     * @param {{siatka: import('./siatka.js').SiatkaUderzen, czasS: number} | null} rytm
     * @returns {number|null}
     */
    update(world, dt, rytm) {
        if (!rytm?.siatka || !Number.isFinite(rytm.czasS)) { this._zeruj(); return null; }
        if (!Number.isFinite(dt) || dt <= 0) return this.zgodnosc;
        const krok = Math.min(dt, 0.1);
        const t = rytm.czasS;

        // Prędkość: średnia po widocznych stawach, z wygładzonych pozycji.
        let v = 0;
        if (world) {
            const a = Math.min(1, krok / N.TAU_POZYCJI_S);
            const nowe = N.STAWY.map(i => widoczny(world[i]) ? { x: world[i].x, y: world[i].y } : null);
            let suma = 0, ile = 0;
            if (this._poz) {
                for (let k = 0; k < nowe.length; k++) {
                    const p = nowe[k], q = this._poz[k];
                    if (!p || !q) continue;
                    const x = q.x + a * (p.x - q.x), y = q.y + a * (p.y - q.y);
                    suma += Math.hypot(x - q.x, y - q.y) / krok; ile++;
                    nowe[k] = { x, y };
                }
            }
            this._poz = nowe;
            v = ile ? suma / ile : 0;
        } else {
            this._poz = null;
        }
        this.predkosc = v;

        // Szczyt w poprzedniej klatce: v1 > v2 i v1 >= v.
        const v1 = this._v1;
        this._dolina = Math.min(this._dolina, v1);
        if (v1 > this._v2 && v1 >= v && v1 >= N.PROG_AKCENTU_MS && v1 - this._dolina >= N.WYRAZISTOSC_MS
            && t - this._ostatniAkcentS >= N.MIN_ODSTEP_S) {
            const tA = t - krok;
            const f = rytm.siatka.faza(tA);
            if (f) this._akcenty.push({ t: tA, indeks: f.indeks, faza01: f.faza01 });
            this._ostatniAkcentS = tA;
            this._dolina = v1;
        }
        this._v2 = v1; this._v1 = v;

        const oknoS = N.OKNO_UDERZEN * rytm.siatka.okresS;
        while (this._akcenty.length && t - this._akcenty[0].t > oknoS) this._akcenty.shift();

        // Trzy siatki; wygrywa najspójniejsza.
        const ak = this._akcenty;
        const siatki = {
            '1/2': ak.map(x => (2 * x.faza01) % 1),
            '1': ak.map(x => x.faza01),
            '2': ak.map(x => ((((x.indeks % 2) + 2) % 2) + x.faza01) / 2)
        };
        let naj = 0, wygrana = null;
        for (const [k, fazy] of Object.entries(siatki)) {
            const r = spojnoscFaz(fazy);
            if (r > naj) { naj = r; wygrana = k; }
        }
        this.siatkaWygrana = wygrana;
        this.surowa = rampa(naj, N.SPOJNOSC_OD, N.SPOJNOSC_DO) * rampa(ak.length, N.MIN_AKCENTOW - 1, N.PELNE_OD_AKCENTOW);
        if (!Number.isFinite(this.surowa)) this.surowa = 0;

        const b = Math.min(1, krok / N.TAU_S);
        this.zgodnosc = (this.zgodnosc ?? 0) + b * (this.surowa - (this.zgodnosc ?? 0));
        return this.zgodnosc;
    }
}
