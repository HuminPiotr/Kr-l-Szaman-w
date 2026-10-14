/**
 * Wspólne narzędzia miar ruchu (jakość tańca, płynność, falowanie ramion).
 *
 * Wydzielone 2026-10-14 z js/plynnosc.js (pochodneSG) i js/ruchy/falowanieRamion.js
 * (korelacja z opóźnieniem), bo jakość tańca potrzebuje obu. Arytmetyka przeniesiona
 * BEZ ZMIAN kolejności działań - tools/pomiar-falowania.mjs i test-plynnosc.mjs
 * mają dawać identyczne liczby jak przed wydzieleniem.
 */

export const rampa = (v, od, doo) =>
    Number.isFinite(v) ? Math.max(0, Math.min(1, (v - od) / (doo - od))) : 0;

export const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function srednia(a) { let s = 0; for (const v of a) s += v; return s / a.length; }

export function odchylenie(a) {
    const m = srednia(a); let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    return Math.sqrt(s / a.length);
}

/** Punkt nadaje się do pomiaru: skończony i (jeśli wiadomo) dobrze widoczny. */
export function widoczny(p, prog = 0.5) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
           (p.visibility === undefined || p.visibility >= prog);
}

/**
 * Pochodne z dopasowania wielomianu 2. stopnia w oknie (Savitzky-Golay).
 *
 * Różnica sąsiednich klatek mnoży szum przez 1/dt przy każdym
 * różniczkowaniu - przy drugiej pochodnej to 3600x przy 60 FPS.
 * Dopasowanie wielomianu do całego okna wykorzystuje wszystkie próbki
 * i tłumi szum nieskorelowany zamiast go wzmacniać.
 */
export function pochodneSG(hist, dt) {
    const pol = (hist.length - 1) / 2;
    let n = 0, k2 = 0, k4 = 0;
    let s0x = 0, s0y = 0, s1x = 0, s1y = 0, s2x = 0, s2y = 0;

    for (let j = 0; j < hist.length; j++) {
        const k = j - pol;
        const y = hist[j];
        n++; k2 += k * k; k4 += k * k * k * k;
        s0x += y.x;         s0y += y.y;
        s1x += k * y.x;     s1y += k * y.y;
        s2x += k * k * y.x; s2y += k * k * y.y;
    }

    const mian = n * k4 - k2 * k2;
    return {
        vx: s1x / k2 / dt,
        vy: s1y / k2 / dt,
        ax: 2 * (n * s2x - k2 * s0x) / mian / (dt * dt),
        ay: 2 * (n * s2y - k2 * s0y) / mian / (dt * dt)
    };
}

/**
 * Korelacja wzajemna z przesunięciem: szukamy lag, przy którym b (spóźnione
 * o lag próbek) najlepiej pasuje do a. Dodatni lag = b SPÓŹNIA SIĘ za a.
 * @returns {{lag: number, k: number}} k w -1..1
 */
export function korelacjaZOpoznieniem(a, b, maxLag) {
    const n = a.length;
    const mA = srednia(a), mB = srednia(b);
    let najK = -Infinity, najLag = 0;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        let s = 0, sa = 0, sb = 0;
        for (let j = Math.max(0, -lag); j < n - Math.max(0, lag); j++) {
            const x = a[j] - mA, y = b[j + lag] - mB;
            s += x * y; sa += x * x; sb += y * y;
        }
        const k = s / (Math.sqrt(sa * sb) + 1e-9);
        if (k > najK) { najK = k; najLag = lag; }
    }
    return { lag: najLag, k: najK };
}
