/**
 * Analiza rytmu pieśni - tempo i położenie uderzeń z surowego dźwięku
 * (spec 2026-10-30-trans-design.md). CZYSTA LOGIKA: bez DOM i bez ffmpeg -
 * tools/analiza-rytmu.mjs dekoduje plik i woła analizujRytm(); kiedyś ta sama
 * funkcja może policzyć rytm własnej pieśni w przeglądarce.
 *
 * Kroki:
 *  1. obwiedniaUderzen: spectral flux (przyrost log-widma) - szczyty tam,
 *     gdzie coś "uderza" (bęben, atak dźwięku), niezależnie od głośności.
 *  2. tempoZgrubne: autokorelacja obwiedni 60-180 BPM z preferencją okolic
 *     120 BPM - bez niej wygrywa czasem połowa albo podwojenie tempa.
 *  3. dopasujSiatke: DOKŁADNE tempo i faza grzebieniem po całej pieśni.
 *     Precyzja jest krytyczna: 0.1 BPM błędu przy 120 BPM to 0.2 s rozjazdu
 *     po 4 minutach - więcej niż szerokość uderzenia.
 *  4. dryf: faza w ~20-sekundowych odcinkach. Suno zwykle trzyma tempo, ale
 *     jeśli siatka się rozjeżdża, zwracamy listę uderzeń zamiast samego BPM.
 */

export const NASTAWY_ANALIZY = {
    HOP: 256,                 // próbek na ramkę obwiedni (~23 ms przy 11025 Hz)
    OKNO: 1024,               // FFT
    MIN_BPM: 60, MAX_BPM: 180,
    BPM_PREFEROWANE: 120, SZEROKOSC_PREFERENCJI_OKT: 0.9,
    LOKALNA_SREDNIA_S: 0.5,   // odjęcie tła obwiedni - zostają same akcenty
    GORA_BASU_HZ: 250,        // pasmo bębna basowego
    WAGA_BASU: 0.7,           // bas wyznacza uderzenie; szum hi-hatu na ósemkach przesuwał siatkę o pół
    DOKLADNOSC_BPM: 0.005,
    ZAKRES_DOKLADNY: 0.04,    // +-4% wokół zgrubnego: autokorelacja liczy w całych ramkach (150 -> 152 BPM)
    ODCINEK_S: 10,
    MAX_DRYF_S: 0.04,
    MIN_SILA_ODCINKA: 0.5,    // odcinek słabszy niż tyle x średnia (wstęp, przejście bez bębnów) nie orzeka o fazie         // większy rozjazd faz odcinków = zapisujemy listę uderzeń
    // Szczyt przyrostu widma wypada PRZED atakiem: ramka ma czas swojego początku, a atak
    // wchodzi w okno od końca. ZMIERZONE na syntetycznym bębnie (szczyt ~75 ms przed uderzeniem,
    // hi-hat ~45 ms) - do potwierdzenia odsłuchem podglądu z klikami.
    KOREKTA_S: 0.07
};
const N = NASTAWY_ANALIZY;

/** FFT in-place (radix-2), re/im długości potęgi 2. */
function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const kat = -2 * Math.PI / len, wr = Math.cos(kat), wi = Math.sin(kat);
        for (let i = 0; i < n; i += len) {
            let cr = 1, ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const a = i + k, b = a + len / 2;
                const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr; im[b] = im[a] - ti;
                re[a] += tr; im[a] += ti;
                const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
            }
        }
    }
}

/**
 * @param {Float32Array|number[]} pcm  mono
 * @param {number} sr
 * @returns {{obwiednia: Float64Array, klatekNaS: number}}
 */
export function obwiedniaUderzen(pcm, sr) {
    const n = pcm.length, ramek = Math.max(0, Math.floor((n - N.OKNO) / N.HOP) + 1);
    const okno = new Float64Array(N.OKNO);
    for (let i = 0; i < N.OKNO; i++) okno[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N.OKNO);
    const re = new Float64Array(N.OKNO), im = new Float64Array(N.OKNO);
    const pol = N.OKNO / 2;
    let poprzednie = new Float64Array(pol), biezace = new Float64Array(pol);
    const kBasu = Math.max(2, Math.round(N.GORA_BASU_HZ * N.OKNO / sr));
    const fluxCaly = new Float64Array(ramek), fluxBas = new Float64Array(ramek);
    for (let r = 0; r < ramek; r++) {
        const p = r * N.HOP;
        for (let i = 0; i < N.OKNO; i++) { const v = pcm[p + i]; re[i] = (Number.isFinite(v) ? v : 0) * okno[i]; im[i] = 0; }
        fft(re, im);
        let s = 0, b = 0;
        for (let k = 1; k < pol; k++) {
            biezace[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
            const d = biezace[k] - poprzednie[k];
            if (d > 0 && r > 0) { s += d; if (k < kBasu) b += d; }
        }
        fluxCaly[r] = s; fluxBas[r] = b;
        [poprzednie, biezace] = [biezace, poprzednie];
    }
    // Dwa pasma, każde znormalizowane średnią (pasmo basu ma mało przedziałów,
    // więc surowo przegrałoby z szerokim szumem), potem mieszanka z przewagą basu.
    const sr1 = (a) => { let m = 0; for (const v of a) m += v; return m / Math.max(1, a.length) || 1; };
    const mC = sr1(fluxCaly), mB = sr1(fluxBas);
    const flux = Float64Array.from(fluxCaly, (v, i) => N.WAGA_BASU * fluxBas[i] / mB + (1 - N.WAGA_BASU) * v / mC);
    // Odjęcie lokalnej średniej i prostowanie: zostają akcenty ponad tło.
    const klatekNaS = sr / N.HOP;
    const pol2 = Math.max(1, Math.round(N.LOKALNA_SREDNIA_S * klatekNaS / 2));
    const obw = new Float64Array(ramek);
    let suma = 0, od = 0, doo = -1;
    for (let r = 0; r < ramek; r++) {
        while (doo < Math.min(ramek - 1, r + pol2)) suma += flux[++doo];
        while (od < r - pol2) suma -= flux[od++];
        obw[r] = Math.max(0, flux[r] - suma / (doo - od + 1));
    }
    return { obwiednia: obw, klatekNaS };
}

const interp = (a, x) => {
    if (x < 0 || x > a.length - 1) return 0;
    const i = Math.floor(x), u = x - i;
    return i + 1 < a.length ? a[i] * (1 - u) + a[i + 1] * u : a[i];
};

const preferencja = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / N.BPM_PREFEROWANE) / N.SZEROKOSC_PREFERENCJI_OKT) ** 2);

/** Zgrubne BPM z autokorelacji obwiedni, ważonej preferencją tempa. */
export function tempoZgrubne(obw, klatekNaS) {
    const n = obw.length;
    let m = 0;
    for (const v of obw) m += v;
    m /= Math.max(1, n);
    const x = Float64Array.from(obw, v => v - m);
    const lagMin = Math.floor(60 / N.MAX_BPM * klatekNaS), lagMax = Math.ceil(60 / N.MIN_BPM * klatekNaS);
    let naj = -Infinity, najLag = 0;
    for (let lag = lagMin; lag <= lagMax && lag < n; lag++) {
        let s = 0;
        for (let j = 0; j + lag < n; j++) s += x[j] * x[j + lag];
        const w = s / (n - lag) * preferencja(60 * klatekNaS / lag);
        if (w > naj) { naj = w; najLag = lag; }
    }
    return najLag > 0 ? 60 * klatekNaS / najLag : NaN;
}

/** Wynik grzebienia: suma obwiedni w uderzeniach siatki (okresS, fazaS). */
function wynikSiatki(obw, klatekNaS, okresS, fazaS, odS = 0, doS = Infinity) {
    const koniec = Math.min(doS, (obw.length - 1) / klatekNaS);
    let s = 0, n = 0;
    for (let t = fazaS + Math.ceil((odS - fazaS) / okresS) * okresS; t <= koniec; t += okresS) {
        s += interp(obw, t * klatekNaS); n++;
    }
    return n ? s / n : 0;
}

/** Najlepsza faza (0..okresS) dla danego okresu, opcjonalnie w oknie czasu. */
function najlepszaFaza(obw, klatekNaS, okresS, odS = 0, doS = Infinity) {
    const krok = 0.25 / klatekNaS;
    let naj = -Infinity, najF = 0;
    for (let f = 0; f < okresS; f += krok) {
        const w = wynikSiatki(obw, klatekNaS, okresS, f, odS, doS);
        if (w > naj) { naj = w; najF = f; }
    }
    return { fazaS: najF, wynik: naj };
}

/** Dokładne BPM i faza: przeszukanie okolicy zgrubnego tempa grzebieniem po całej pieśni. */
export function dopasujSiatke(obw, klatekNaS, bpmZgrubne) {
    // Najpierw krok 0.05 BPM, potem doprecyzowanie 0.005 wokół najlepszego - pełne
    // przeszukanie co 0.005 w zakresie +-1.5 BPM kosztowałoby 600 razy faza x pieśń.
    let naj = { wynik: -Infinity };
    const sprawdz = (bpm) => {
        const okresS = 60 / bpm;
        const f = najlepszaFaza(obw, klatekNaS, okresS);
        if (f.wynik > naj.wynik) naj = { bpm, okresS, ...f };
    };
    for (let b = bpmZgrubne * (1 - N.ZAKRES_DOKLADNY); b <= bpmZgrubne * (1 + N.ZAKRES_DOKLADNY); b += 0.05) sprawdz(b);
    const srodek = naj.bpm;
    for (let b = srodek - 0.05; b <= srodek + 0.05; b += N.DOKLADNOSC_BPM) sprawdz(b);
    return naj;
}

/**
 * Faza w kolejnych odcinkach względem globalnej siatki: przesunięcie (s) w zakresie
 * +-okres/2. Rozrzut przesunięć to dryf - stałe tempo daje rozrzut ~0.
 */
export function przesunieciaOdcinkow(obw, klatekNaS, okresS, fazaS, silaCalosci = 0) {
    const dlugoscS = (obw.length - 1) / klatekNaS;
    const out = [];
    for (let od = 0; od < dlugoscS; od += N.ODCINEK_S) {
        const doS = Math.min(dlugoscS, od + N.ODCINEK_S);
        if (doS - od < N.ODCINEK_S / 2) break;
        const { fazaS: f, wynik } = najlepszaFaza(obw, klatekNaS, okresS, od, doS);
        if (wynik < N.MIN_SILA_ODCINKA * silaCalosci) continue;
        let d = f - fazaS;
        d -= Math.round(d / okresS) * okresS;
        out.push({ srodekS: (od + doS) / 2, przesuniecieS: d });
    }
    // Rozwinięcie: sąsiednie odcinki nie skaczą o więcej niż pół okresu.
    for (let i = 1; i < out.length; i++) {
        let d = out[i].przesuniecieS - out[i - 1].przesuniecieS;
        out[i].przesuniecieS -= Math.round(d / okresS) * okresS;
    }
    return out;
}

/**
 * @returns {{bpm:number, pierwszeUderzenieS:number, dryfS:number, uderzenia?:number[]} | null}
 *   null = nie udało się znaleźć rytmu (cisza, za krótko) - pieśń bez transu, nie błąd.
 */
export function analizujRytm(pcm, sr) {
    if (!pcm || !(pcm.length > sr * 4) || !(sr > 0)) return null;
    const { obwiednia, klatekNaS } = obwiedniaUderzen(pcm, sr);
    const zgrubne = tempoZgrubne(obwiednia, klatekNaS);
    if (!Number.isFinite(zgrubne)) return null;
    const s = dopasujSiatke(obwiednia, klatekNaS, zgrubne);
    if (!(s.okresS > 0) || !(s.wynik > 0)) return null;
    const odcinki = przesunieciaOdcinkow(obwiednia, klatekNaS, s.okresS, s.fazaS, s.wynik);
    s.fazaS = ((s.fazaS + N.KOREKTA_S) % s.okresS + s.okresS) % s.okresS;
    const p = odcinki.map(o => o.przesuniecieS);
    const dryfS = p.length ? Math.max(...p) - Math.min(...p) : 0;
    const wynik = { bpm: Math.round(s.bpm * 1000) / 1000, pierwszeUderzenieS: Math.round(s.fazaS * 1000) / 1000, dryfS: Math.round(dryfS * 1000) / 1000 };
    if (dryfS > N.MAX_DRYF_S && odcinki.length >= 2) {
        // Siatka z płynnie interpolowanym przesunięciem odcinków.
        const dlugoscS = (obwiednia.length - 1) / klatekNaS;
        const przes = (t) => {
            if (t <= odcinki[0].srodekS) return odcinki[0].przesuniecieS;
            for (let i = 1; i < odcinki.length; i++) {
                if (t <= odcinki[i].srodekS) {
                    const a = odcinki[i - 1], b = odcinki[i], u = (t - a.srodekS) / (b.srodekS - a.srodekS);
                    return a.przesuniecieS + u * (b.przesuniecieS - a.przesuniecieS);
                }
            }
            return odcinki[odcinki.length - 1].przesuniecieS;
        };
        const uderzenia = [];
        for (let t = s.fazaS; t <= dlugoscS; t += s.okresS) uderzenia.push(Math.round((t + przes(t)) * 1000) / 1000);
        wynik.uderzenia = uderzenia;
    }
    return wynik;
}
