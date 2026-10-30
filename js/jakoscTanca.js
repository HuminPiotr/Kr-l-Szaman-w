/**
 * Jakość tańca - mnożnik tempa ładowania mocy (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Etap 1 z 4 ("gra rozumie muzykę"). Składa trzy miary z js/jakosc/ w BOGACTWO 0..1:
 *   krążenie       - łuki zamiast nawrotów (wahadło ~0, okrąg ~1),
 *   zaangażowanie  - ile partii ciała tańczy,
 *   fala           - czy ruch przepływa z opóźnieniem.
 * W etapie 3 dojdzie czwarta składowa (dopasowanie tempa) - jeden wpis w WAGI.
 *
 * ŚREDNIA WAŻONA, NIE ILOCZYN: brak fali nie zeruje łuków. Brakująca składowa
 * liczy się jak BOGACTWO_NEUTRALNE (spec §2), a nie jest pomijana z renormalizacją
 * wag - inaczej brak danych o fali podbijałby wagę pozostałych i nagradzał lub
 * karał taniec za coś, czego nie zmierzono. Płynność NIE wchodzi
 * do średniej - zostaje osobnym czynnikiem w MotionMeter (wspPlynnosci 0.25..1),
 * inaczej szarpany taniec całym ciałem wychodził tak samo jak gładkie góra-dół.
 *
 * Brak danych (bezruch, poza kadrem) to NIE zły taniec: bogactwo dryfuje do
 * neutralnego, czyli mnożnik do 1.0 - dzisiejszego tempa. Nic nie mówi "źle".
 */
import { Okres } from './jakosc/okres.js';
import { Krazenie } from './jakosc/krazenie.js';
import { Cialo2D } from './jakosc/cialo2d.js';
import { Zaangazowanie } from './jakosc/zaangazowanie.js';
import { FalaCiala } from './jakosc/fala.js';

// Kotwice ZMIERZONE na nagraniu sesji J (tools/pomiar-jakosci.mjs); wagi ZGADNIĘTE.
// Kotwice to BOGACTWO, przy którym mnożnik osiąga 0.67 / 1.5 (decyzja "pośrodku").
export const NASTAWY_JAKOSCI = {
    WAGI: { krazenie: 0.35, zaangazowanie: 0.35, fala: 0.30 },
    KOTWICA_NISKA: 0.40,     // ZMIERZONE 2026-10-30: mediana bogactwa pompowania (z podskokiem kolan) 0.40, łuków 0.29-0.48
    KOTWICA_WYSOKA: 0.60,    // ZMIERZONE 2026-10-30: mediana tańca całym ciałem właściciela (0.57-0.69) - zwykły dobry taniec, nie ideał
    MNOZNIK_NISKI: 0.67,     // pełny pasek ~12 s zamiast ~8 s
    MNOZNIK_WYSOKI: 1.5,     // ~6-7 s; 1.33 nie odwracało kolejności: wolna fala ładowała dłużej niż exploit łuków (nagranie 2026-10-30)
    TAU_S: 1.0,              // dłuższe niż cykl tańca (~1 s) - inaczej mnożnik faluje w takcie
    TAU_POWROTU_S: 2.0       // jak TAU_POWROTU płynności
};
const N = NASTAWY_JAKOSCI;
export const BOGACTWO_NEUTRALNE = (N.KOTWICA_NISKA + N.KOTWICA_WYSOKA) / 2;

export function mnoznikZBogactwa(b) {
    if (!Number.isFinite(b)) return 1;
    if (b <= N.KOTWICA_NISKA) return N.MNOZNIK_NISKI;
    if (b >= N.KOTWICA_WYSOKA) return N.MNOZNIK_WYSOKI;
    // Dwa odcinki przez (BOGACTWO_NEUTRALNE, 1): zakres jest niesymetryczny (0.67..1.5),
    // a brak danych ma dalej znaczyć dzisiejsze tempo, nie 1.08.
    if (b <= BOGACTWO_NEUTRALNE) return N.MNOZNIK_NISKI + (1 - N.MNOZNIK_NISKI) * (b - N.KOTWICA_NISKA) / (BOGACTWO_NEUTRALNE - N.KOTWICA_NISKA);
    return 1 + (N.MNOZNIK_WYSOKI - 1) * (b - BOGACTWO_NEUTRALNE) / (N.KOTWICA_WYSOKA - BOGACTWO_NEUTRALNE);
}

/**
 * Brakująca składowa (null / undefined / NaN) = BOGACTWO_NEUTRALNE, nie pominięcie.
 * Gdy brakuje WSZYSTKICH, zwraca null - JakoscTanca dryfuje wtedy do neutralnego
 * z TAU_POWROTU_S (wolniej niż przy żywych danych).
 */
export function zlozBogactwo(skladowe) {
    let suma = 0, wagi = 0, znane = 0;
    for (const [k, w] of Object.entries(N.WAGI)) {
        const v = skladowe?.[k];
        const jest = v !== null && v !== undefined && Number.isFinite(v);
        suma += w * (jest ? Math.max(0, Math.min(1, v)) : BOGACTWO_NEUTRALNE);
        wagi += w;
        if (jest) znane++;
    }
    return znane > 0 && wagi > 0 ? suma / wagi : null;
}

export class JakoscTanca {
    constructor() {
        this.okres = new Okres();
        this.krazenieMiara = new Krazenie();
        this.zaangazowanieMiara = new Zaangazowanie();
        this.falaMiara = new FalaCiala();
        this._cialo = new Cialo2D();
        this.bogactwo = BOGACTWO_NEUTRALNE;
        this.mnoznik = 1;
        this.skladowe = { krazenie: null, zaangazowanie: null, fala: null };
    }

    /** Częstotliwość ruchu dla płynności - null, gdy okres niepewny. */
    get czestotliwoscHz() { return this.okres.czestotliwoscHz; }

    /** @returns {number} mnożnik tempa ładowania 0.67..1.5 */
    update(frame, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.mnoznik;
        const krok = Math.min(dt, 0.1);
        const world = frame?.pose?.worldLandmarks ?? null;
        const c2d = this._cialo.update(frame?.pose?.landmarks ?? null, frame?.width, frame?.height, krok);

        this.okres.update(world, krok);
        this.skladowe = {
            krazenie: this.krazenieMiara.update(world, krok),
            zaangazowanie: this.zaangazowanieMiara.update(world, c2d.biodra, krok),
            fala: this.falaMiara.update(world, c2d, this.okres, krok)
        };

        const cel = zlozBogactwo(this.skladowe);
        const tau = cel === null ? N.TAU_POWROTU_S : N.TAU_S;
        const nowe = this.bogactwo + Math.min(1, krok / tau) * ((cel ?? BOGACTWO_NEUTRALNE) - this.bogactwo);
        if (Number.isFinite(nowe)) this.bogactwo = nowe;
        this.mnoznik = mnoznikZBogactwa(this.bogactwo);
        return this.mnoznik;
    }
}
