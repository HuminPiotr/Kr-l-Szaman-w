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
 *  4. sledzUderzenia: uderzenia programowaniem dynamicznym (odstępy bliskie
 *     okresu, trafienia w akcenty). Gdy leżą na równej siatce - wystarczy BPM
 *     i pierwsze uderzenie; gdy pieśń dryfuje (Suno potrafi) - lista uderzeń.
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
    MAX_DRYF_S: 0.04,         // uderzenie dalej od równej siatki = zapisujemy listę uderzeń
    CIASNOSC: 100,            // kara za nierówny odstęp w śledzeniu uderzeń (Ellis: 100-680)
    // Szczyt przyrostu widma wypada PRZED atakiem: ramka ma czas swojego początku, a atak
    // wchodzi w okno od końca. ZMIERZONE na syntetycznym bębnie (szczyt ~75 ms przed uderzeniem,
    // hi-hat ~45 ms) - do potwierdzenia odsłuchem podglądu z klikami.
    KOREKTA_S: 0.07
};
const N = NASTAWY_ANALIZY;

/** FFT in-place (radix-2), re/im długości potęgi 2. */
export function fft(re, im) {
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
 * Śledzenie uderzeń programowaniem dynamicznym (Ellis 2007): każde uderzenie
 * ma trafić w akcent obwiedni, a odstępy mają być bliskie okresu. Kara za
 * odstęp rośnie z kwadratem log(odstęp/okres), więc przeskok o pół uderzenia
 * (łapanie słabej części taktu na kilka sekund) jest "drogi" - siatka odcinków
 * robiła to na `Woda być`. Płynny dryf tempa za to przechodzi bez kary.
 * @returns {number[]} czasy uderzeń [s] (bez KOREKTA_S)
 */
export function sledzUderzenia(obw, klatekNaS, okresS) {
    const n = obw.length, P = okresS * klatekNaS;
    if (!(n > 0) || !(P > 1)) return [];
    let m = 0, w = 0;
    for (const v of obw) m += v;
    m /= n;
    for (const v of obw) w += (v - m) ** 2;
    const sd = Math.sqrt(w / n) || 1;
    const e = Float64Array.from(obw, v => v / sd);
    const wynik = new Float64Array(n), skad = new Int32Array(n).fill(-1);
    const odMin = Math.round(P / 2), odMax = Math.round(2 * P);
    for (let t = 0; t < n; t++) {
        let naj = 0, najP = -1;
        for (let p = t - odMax; p <= t - odMin; p++) {
            if (p < 0) continue;
            const kara = N.CIASNOSC * Math.log((t - p) / P) ** 2;
            const v = wynik[p] - kara;
            if (v > naj || najP < 0) { naj = v; najP = p; }
        }
        wynik[t] = e[t] + (najP >= 0 ? Math.max(0, naj) : 0);
        skad[t] = najP >= 0 && naj > 0 ? najP : -1;
    }
    let t = n - 1, najW = -Infinity;
    for (let k = Math.max(0, n - Math.ceil(P)); k < n; k++) if (wynik[k] > najW) { najW = wynik[k]; t = k; }
    const ramki = [];
    for (; t >= 0; t = skad[t]) ramki.push(t);
    ramki.reverse();
    // Doprecyzowanie podramkowe parabolą przez szczyt obwiedni.
    return ramki.map(r => {
        const a = e[r - 1] ?? e[r], b = e[r], c = e[r + 1] ?? e[r];
        const mian = a - 2 * b + c;
        const d = mian < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / mian)) : 0;
        return (r + d) / klatekNaS;
    });
}

/** Prosta najmniejszych kwadratów: t = a + b·i. */
function dopasujProsta(t) {
    const n = t.length;
    let si = 0, st = 0, sii = 0, sit = 0;
    for (let i = 0; i < n; i++) { si += i; st += t[i]; sii += i * i; sit += i * t[i]; }
    const b = (n * sit - si * st) / (n * sii - si * si);
    return { a: (st - b * si) / n, b };
}

/**
 * @returns {{bpm:number, pierwszeUderzenieS:number, dryfS:number, uderzenia?:number[]} | null}
 *   null = nie udało się znaleźć rytmu (cisza, za krótko) - pieśń bez transu, nie błąd.
 *   dryfS = największe odchylenie uderzenia od równej siatki. Gdy > MAX_DRYF_S,
 *   wynik niesie listę uderzeń; inaczej wystarczą BPM i pierwsze uderzenie.
 */
export function analizujRytm(pcm, sr) {
    if (!pcm || !(pcm.length > sr * 4) || !(sr > 0)) return null;
    const { obwiednia, klatekNaS } = obwiedniaUderzen(pcm, sr);
    const zgrubne = tempoZgrubne(obwiednia, klatekNaS);
    if (!Number.isFinite(zgrubne)) return null;
    const s = dopasujSiatke(obwiednia, klatekNaS, zgrubne);
    if (!(s.okresS > 0) || !(s.wynik > 0)) return null;
    const ud = sledzUderzenia(obwiednia, klatekNaS, s.okresS).map(t => t + N.KOREKTA_S);
    if (ud.length < 8) return null;
    const { a, b } = dopasujProsta(ud);
    let dryfS = 0;
    for (let i = 0; i < ud.length; i++) dryfS = Math.max(dryfS, Math.abs(ud[i] - (a + b * i)));
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const pierwsze = ((a % b) + b) % b;
    const wynik = { bpm: r3(60 / b), pierwszeUderzenieS: r3(pierwsze), dryfS: r3(dryfS) };
    if (dryfS > N.MAX_DRYF_S) wynik.uderzenia = ud.map(r3);
    return wynik;
}
