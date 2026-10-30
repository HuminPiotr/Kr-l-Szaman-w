/**
 * Zgodność z rytmem pieśni 0..1 (spec 2026-10-30-trans-design.md).
 *
 * WYROZUMIAŁA z założenia - grają amatorzy i dzieci. Nie sprawdzamy, czy ruch
 * trafia DOKŁADNIE w uderzenie, tylko czy ruch POWTARZA SIĘ w takt pieśni.
 * Stałe przesunięcie (ktoś zawsze trochę spóźniony, opóźnienie kamery) daje
 * pełną zgodność; chaos albo inne tempo - niską.
 *
 * Miara: koherencja ruchu z fazą pieśni (demodulacja zespolona). Dla kilku
 * sygnałów ciała x(t) i krotności k (jeden ruch na 2 uderzenia / na uderzenie)
 *   C = |Σ w·x·e^(-i2π·k·uderzenia)| / sqrt(Σ w·x² · Σ w / 2)
 * w wykładniczym oknie ~12 uderzeń. Czysta sinusoida w takt daje 1, ruch
 * w innym tempie rozmywa fazę do ~0 (+ poziom przypadku dla krótkiego okna).
 *
 * DLACZEGO NIE AKCENTY (pierwsza wersja): szczyty prędkości 6 stawów łapały
 * ~3.5 "akcentu"/s, głównie z drgań śledzenia, i na nagraniu sesji T
 * (2026-10-30, ruch na błysk) zgodność wyszła ~0 nawet w krokach w rytmie.
 * Koherencja ciągła na tym samym nagraniu: w rytmie 0.43-0.69, obok 0.06-0.35.
 *
 * Sygnały w OBRAZIE (pose.landmarks), nie w worldLandmarks: świat MediaPipe ma
 * początek w biodrach, więc ugięcie kolan i kołysanie bioder są tam niewidoczne.
 * Skala: szerokość barków w obrazie (odległość od kamery nie zmienia amplitudy).
 *
 * NIE opiera się na js/jakosc/okres.js - swobodny taniec rzadko ma pewny okres.
 */
import { rampa } from '../jakosc/pochodne.js';

// Progi ZMIERZONE na nagraniu sesji T 2026-10-30 (tools/pomiar-transu.mjs), reszta ZGADNIĘTE.
export const NASTAWY_ZGODNOSCI = {
    PROG_WIDOCZNOSCI: 0.5,
    KROTNOSCI: [0.5, 1],          // ruchów na uderzenie: co drugie / na każde
    // ZMIERZONE 2026-10-30 (sesja T, wariant B): swobodny taniec właściciela ma koherencję tylko
    // ~0.37 (głowa/biodra sprężynują na uderzenie), więc progi 0.35..0.6 przy oknie 12 trzymały go
    // poza transem przez całą pieśń. Dłuższe okno obniża poziom przypadku, stąd niższe progi:
    // swobodny taniec 0.20 -> 0.76, ruch obok tempa (0.8x) 0.37, bezruch 0.
    OKNO_UDERZEN: 16,             // stała czasowa okna koherencji (w uderzeniach)
    TAU_SREDNIEJ_S: 1.5,          // odjęcie powolnego dryfu pozycji (zmiana miejsca, pochylenie)
    KOHERENCJA_OD: 0.22, KOHERENCJA_DO: 0.42,
    AMPLITUDA_OD: 0.03, AMPLITUDA_DO: 0.08,   // RMS ruchu w szerokościach barków - bezruch to szum śledzenia
    TAU_S: 1.0                    // wynik wygładzony - trans, nie migotanie
};
const N = NASTAWY_ZGODNOSCI;

const ok = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= N.PROG_WIDOCZNOSCI);

/** Sygnały ciała w szerokościach barków; null, gdy staw niewidoczny. */
const SYGNALY = {
    rekaY: (l) => ok(l[15]) && ok(l[16]) ? (l[15].y + l[16].y) / 2 : null,
    rekaX: (l) => ok(l[15]) && ok(l[16]) ? (l[15].x - l[16].x) / 2 : null,
    biodraY: (l) => ok(l[23]) && ok(l[24]) ? (l[23].y + l[24].y) / 2 : null,
    glowaY: (l) => ok(l[0]) ? l[0].y : null
};

/** Spójność faz (0..1) poprawiona o obciążenie: losowe n faz daje ~0. Zostaje dla narzędzi. */
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
        this._zeruj();
    }

    _zeruj() {
        this.zgodnosc = null;        // null = brak pieśni z rytmem
        this.surowa = 0;             // przed wygładzeniem - do nakładki D
        this.koherencja = 0;         // najlepsza koherencja (bez bramki amplitudy)
        this.amplituda = 0;
        this.siatkaWygrana = null;   // np. 'rekaY 1/2' - który sygnał i krotność niosą rytm
        this._srednie = {};          // sygnał -> wolna średnia
        this._akum = {};             // `${sygnał}|${k}` -> {re, im, e, w}
    }

    /**
     * @param {{landmarks?: Array}|null} poza  frame.pose (używa landmarks 2D)
     * @param {number} dt
     * @param {{siatka: import('./siatka.js').SiatkaUderzen, czasS: number} | null} rytm
     * @returns {number|null}
     */
    update(poza, dt, rytm) {
        if (!rytm?.siatka || !Number.isFinite(rytm.czasS)) { this._zeruj(); return null; }
        if (!Number.isFinite(dt) || dt <= 0) return this.zgodnosc;
        const krok = Math.min(dt, 0.1);
        const f = rytm.siatka.faza(rytm.czasS);
        if (!f) return this.zgodnosc;
        const uderzenia = f.indeks + f.faza01;
        const zanik = Math.exp(-krok / (N.OKNO_UDERZEN * f.okresS));
        const aSr = Math.min(1, krok / N.TAU_SREDNIEJ_S);

        const l = poza?.landmarks;
        const bw = l && ok(l[11]) && ok(l[12]) ? Math.hypot(l[11].x - l[12].x, l[11].y - l[12].y) : NaN;
        let najK = 0, najAmp = 0, najWynik = 0, wygrana = null;
        for (const [nazwa, fn] of Object.entries(SYGNALY)) {
            const surowy = l && bw > 0.01 ? fn(l) : null;
            const v = surowy === null ? null : surowy / bw;
            if (v !== null && Number.isFinite(v)) {
                this._srednie[nazwa] = this._srednie[nazwa] === undefined ? v : this._srednie[nazwa] + aSr * (v - this._srednie[nazwa]);
            }
            const x = v !== null && Number.isFinite(v) ? v - this._srednie[nazwa] : null;
            for (const k of N.KROTNOSCI) {
                const klucz = `${nazwa}|${k}`;
                const a = (this._akum[klucz] ??= { re: 0, im: 0, e: 0, w: 0 });
                a.re *= zanik; a.im *= zanik; a.e *= zanik; a.w *= zanik;
                if (x !== null) {
                    const th = 2 * Math.PI * k * uderzenia;
                    a.re += x * Math.cos(th); a.im += x * Math.sin(th); a.e += x * x; a.w += 1;
                }
                const koh = a.e > 0 && a.w > 0 ? Math.min(1, Math.hypot(a.re, a.im) / Math.sqrt(a.e * a.w / 2)) : 0;
                const amp = a.w > 0 ? Math.sqrt(a.e / a.w) : 0;
                const wynik = rampa(koh, N.KOHERENCJA_OD, N.KOHERENCJA_DO) * rampa(amp, N.AMPLITUDA_OD, N.AMPLITUDA_DO);
                if (wynik > najWynik || (najWynik === 0 && koh > najK)) {
                    if (wynik > najWynik) { najWynik = wynik; wygrana = `${nazwa} ${k === 0.5 ? '1/2' : k}`; }
                    najK = Math.max(najK, koh); najAmp = amp;
                }
            }
        }
        this.koherencja = najK;
        this.amplituda = najAmp;
        this.siatkaWygrana = wygrana;
        this.surowa = Number.isFinite(najWynik) ? najWynik : 0;
        const b = Math.min(1, krok / N.TAU_S);
        this.zgodnosc = (this.zgodnosc ?? 0) + b * (this.surowa - (this.zgodnosc ?? 0));
        return this.zgodnosc;
    }
}
