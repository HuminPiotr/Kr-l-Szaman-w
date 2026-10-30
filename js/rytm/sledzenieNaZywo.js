/**
 * Śledzenie uderzeń NA ŻYWO z obwiedni (js/rytm/obwiedniaNaZywo.js) - słuch
 * dowolnej muzyki z mikrofonu (spec 2026-10-30-sluch-design.md). Czysta logika.
 *
 * Co PRZELICZ_S, na oknie ostatnich OKNO_S:
 *  1. tempo z autokorelacji (tempoZgrubne z analizy plików) z preferencją
 *     BIEŻĄCEGO tempa; nowe tempo przyjęte dopiero, gdy wraca w ZMIANA_PO
 *     kolejnych odczytach (histereza - jeden takt przejścia nie przestawia gry),
 *     a dwukrotność/połowa bieżącego tempa to wciąż "to samo" (bez przeskoków oktawy),
 *  2. faza z grzebienia na ostatnich FAZA_OKNO_S, ważona świeżością,
 *  3. pętla fazowa: siatka dociągana łagodnie (KOREKTA_FAZY błędu na przeliczenie),
 *     a indeks uderzenia ciągły - efekty transu liczą nowe uderzenia po zmianie indeksu,
 *  4. pewność z siły grzebienia względem średniej (cisza, mowa, szum -> nisko).
 *
 * `siatka` ma interfejs SiatkaUderzen (faza, nastepneUderzenieS, okresS) w zegarze
 * ramek (AudioContext) - reszta transu nie wie, że rytm przyszedł ze słuchu.
 */
import { NASTAWY_ANALIZY as NA } from './analizaRytmu.js';
import { rampa } from '../jakosc/pochodne.js';

// ZGADNIĘTE - stroić z sesji S (tools/pomiar-sluchu.mjs).
export const NASTAWY_SLUCHU = {
    OKNO_S: 8, PRZELICZ_S: 0.5, MIN_DANYCH_S: 4,
    MIN_BPM: 60, MAX_BPM: 180, BPM_PREFEROWANE: 120, SZEROKOSC_PREFERENCJI_OKT: 0.9,
    TRZYMANIE_TEMPA_OKT: 0.15,      // preferencja bieżącego tempa po złapaniu
    TOLERANCJA_TEMPA: 0.04,         // bliżej niż 4% = to samo tempo (wygładzane)
    ZMIANA_PO: 3,                   // tyle zgodnych odczytów innego tempa = zmiana tempa
    WYGLADZANIE_TEMPA: 0.3,
    FAZA_OKNO_S: 4, TAU_SWIEZOSCI_S: 2,
    KOREKTA_FAZY: 0.35,
    PEWNOSC_OD: 1.4, PEWNOSC_DO: 2.4,   // stosunek najlepszej fazy grzebienia do średniej
    // Okresowość (autokorelacja przy tempie / wariancja): syntetyka - rytm ~0.9, mowa/szum ~0.1.
    // Muzyka z mikrofonu będzie niżej - progi nisko, stroić z sesji S.
    OKRESOWOSC_OD: 0.2, OKRESOWOSC_DO: 0.45,
    TAU_PEWNOSCI_S: 1.0, PROG_PEWNOSCI: 0.5
};
const N = NASTAWY_SLUCHU;

/** Siatka ze słuchu: kotwica (uderzenie o indeksie `baza`) + okres. Ten sam interfejs co SiatkaUderzen. */
export class SiatkaNaZywo {
    constructor(kotwicaS, okresS, baza = 0) { this.kotwicaS = kotwicaS; this.okresS = okresS; this.baza = baza; }
    czasUderzenia(i) { return this.kotwicaS + (i - this.baza) * this.okresS; }
    faza(tS) {
        if (!Number.isFinite(tS) || !(this.okresS > 0)) return null;
        const x = (tS - this.kotwicaS) / this.okresS;
        const f = Math.floor(x);
        return { indeks: this.baza + f, faza01: Math.min(0.999999, x - f), okresS: this.okresS };
    }
    nastepneUderzenieS(tS, maxS = 0.5) {
        const f = this.faza(tS);
        if (!f) return null;
        const a = this.czasUderzenia(f.indeks), b = this.czasUderzenia(f.indeks + 1);
        if (b - tS <= maxS) return b;
        const polowa = (a + b) / 2;
        return polowa > tS && polowa - tS <= maxS ? polowa : tS;
    }
}

export class SledzenieNaZywo {
    constructor() { this.zeruj(); }

    zeruj() {
        this._ramki = [];           // {t, v} - t już z KOREKTA_S (czas akcentu, nie początku ramki)
        this._doPrzeliczenia = 0;
        this._ostatniCzas = null;
        this.siatka = null;
        this.bpm = null;
        this.pewnosc = 0;
        this.okresowosc = 0;
        this._kandydat = null; this._kandydatIle = 0;
    }

    get pewny() { return !!this.siatka && this.pewnosc >= N.PROG_PEWNOSCI; }

    /** @param {{t:number, wartosc:number}[]} ramki  z ObwiedniaNaZywo.dodaj() */
    dodaj(ramki) {
        for (const r of ramki ?? []) {
            if (!Number.isFinite(r?.t) || !Number.isFinite(r?.wartosc)) continue;
            const t = r.t + NA.KOREKTA_S;
            if (this._ostatniCzas !== null && t <= this._ostatniCzas) continue;
            const dt = this._ostatniCzas === null ? 0 : t - this._ostatniCzas;
            if (dt > 1.0) this.zeruj();   // dziura w strumieniu (karta w tle, pauza) - od nowa
            this._ostatniCzas = t;
            this._ramki.push({ t, v: r.wartosc });
            this._doPrzeliczenia -= dt;
            if (this._doPrzeliczenia <= 0) { this._doPrzeliczenia = N.PRZELICZ_S; this._przelicz(t); }
        }
        while (this._ramki.length && this._ostatniCzas - this._ramki[0].t > N.OKNO_S) this._ramki.shift();
    }

    _przelicz(teraz) {
        const R = this._ramki;
        if (R.length < 20 || teraz - R[0].t < N.MIN_DANYCH_S) return;
        const dtR = (R[R.length - 1].t - R[0].t) / (R.length - 1);
        const v = R.map(r => r.v);
        const odczyt = this._tempo(v, dtR);
        if (odczyt === null) { this.okresowosc = 0; this._pewnoscKu(0, teraz); return; }

        // Histereza tempa.
        let T = this.siatka?.okresS ?? null;
        if (T === null) T = 60 / odczyt;
        else {
            const bpm0 = 60 / T;
            const r = odczyt / bpm0;
            const blisko = (x) => Math.abs(x - 1) < N.TOLERANCJA_TEMPA;
            if (blisko(r) || blisko(r / 2) || blisko(r * 2)) {
                const cel = blisko(r) ? odczyt : bpm0;   // oktawa bieżącego = trzymamy bieżące
                T = 60 / (bpm0 + N.WYGLADZANIE_TEMPA * (cel - bpm0));
                this._kandydat = null; this._kandydatIle = 0;
            } else {
                if (this._kandydat && Math.abs(odczyt / this._kandydat - 1) < N.TOLERANCJA_TEMPA) this._kandydatIle++;
                else { this._kandydat = odczyt; this._kandydatIle = 1; }
                if (this._kandydatIle >= N.ZMIANA_PO) { T = 60 / odczyt; this._kandydat = null; this._kandydatIle = 0; }
            }
        }

        // Faza: najświeższe uderzenie w [teraz - T, teraz] maksymalizujące grzebień ważony świeżością.
        const env = (t) => {
            const x = (t - R[0].t) / dtR;
            if (x < 0 || x > R.length - 1) return 0;
            const i = Math.floor(x), u = x - i;
            return i + 1 < R.length ? R[i].v * (1 - u) + R[i + 1].v * u : R[i].v;
        };
        const ileUd = Math.max(2, Math.floor(N.FAZA_OKNO_S / T));
        const wynik = (tau) => {
            let s = 0;
            for (let j = 0; j < ileUd; j++) s += Math.exp(-(j * T) / N.TAU_SWIEZOSCI_S) * env(tau - j * T);
            return s;
        };
        const krok = dtR / 4;
        let naj = -Infinity, najTau = teraz, suma = 0, ile = 0;
        for (let tau = teraz - T; tau <= teraz; tau += krok) {
            const w = wynik(tau);
            suma += w; ile++;
            if (w > naj) { naj = w; najTau = tau; }
        }
        const srednia = suma / Math.max(1, ile);
        const surowa = (srednia > 1e-9 ? rampa(naj / srednia, N.PEWNOSC_OD, N.PEWNOSC_DO) : 0)
            * rampa(this.okresowosc, N.OKRESOWOSC_OD, N.OKRESOWOSC_DO);

        // Pętla fazowa z ciągłym indeksem.
        if (!this.siatka) {
            this.siatka = new SiatkaNaZywo(najTau, T, 0);
        } else {
            const s = this.siatka;
            const f = s.faza(najTau);
            const przewidziany = s.czasUderzenia(Math.round((najTau - s.kotwicaS) / s.okresS) + s.baza);
            let blad = najTau - przewidziany;
            blad -= Math.round(blad / s.okresS) * s.okresS;
            const kotwica = przewidziany + N.KOREKTA_FAZY * blad * (surowa > 0 ? 1 : 0);
            const baza = Math.round((przewidziany - s.kotwicaS) / s.okresS) + s.baza;
            this.siatka = new SiatkaNaZywo(kotwica, T, Number.isFinite(f?.indeks) ? baza : s.baza);
        }
        this.bpm = 60 / T;
        this._pewnoscKu(surowa, teraz);
    }

    _pewnoscKu(cel, teraz) {
        const a = Math.min(1, N.PRZELICZ_S / N.TAU_PEWNOSCI_S);
        this.pewnosc += a * (cel - this.pewnosc);
        if (!Number.isFinite(this.pewnosc)) this.pewnosc = 0;
    }

    /** Odczyt tempa z autokorelacji okna; preferencja okolic 120 BPM i (po złapaniu) bieżącego tempa. */
    _tempo(v, dtR) {
        const n = v.length;
        let m = 0;
        for (const x of v) m += x;
        m /= n;
        let e = 0;
        for (const x of v) e += (x - m) ** 2;
        if (!(e > 1e-12)) return null;
        const lagMin = Math.floor(60 / N.MAX_BPM / dtR), lagMax = Math.ceil(60 / N.MIN_BPM / dtR);
        const bpm0 = this.siatka ? 60 / this.siatka.okresS : null;
        let najW = -Infinity, najLag = 0;
        const r = new Float64Array(lagMax + 2);
        for (let lag = Math.max(1, lagMin - 1); lag <= lagMax + 1 && lag < n; lag++) {
            let s = 0;
            for (let j = 0; j + lag < n; j++) s += (v[j] - m) * (v[j + lag] - m);
            r[lag] = s / (n - lag);
        }
        for (let lag = lagMin; lag <= lagMax && lag < n - 1; lag++) {
            const bpm = 60 / (lag * dtR);
            let w = r[lag] * Math.exp(-0.5 * (Math.log2(bpm / N.BPM_PREFEROWANE) / N.SZEROKOSC_PREFERENCJI_OKT) ** 2);
            if (bpm0) w *= 0.5 + Math.exp(-0.5 * (Math.log2(bpm / bpm0) / N.TRZYMANIE_TEMPA_OKT) ** 2);
            if (w > najW) { najW = w; najLag = lag; }
        }
        if (!(najLag > 0) || !(najW > 0)) return null;
        // Okresowość: autokorelacja przy wybranym tempie względem wariancji (0..1). Szum i mowa
        // mają szczyty obwiedni, ale nie powtarzają się co okres - grzebień sam tego nie odróżniał.
        this.okresowosc = Math.max(0, r[najLag] / (e / n));
        // Doprecyzowanie parabolą - inaczej tempo skacze o całą ramkę (~2-3 BPM).
        const a = r[najLag - 1] ?? r[najLag], b = r[najLag], c = r[najLag + 1] ?? r[najLag];
        const mian = a - 2 * b + c;
        const d = mian < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / mian)) : 0;
        return 60 / ((najLag + d) * dtR);
    }
}
