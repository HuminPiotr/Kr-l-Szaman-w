/**
 * Syntetyczna klatka dla testów technik śledzących ciało (Tarcza, Kurzawa,
 * Łuk, Kula, Mgła). Prefiks "_" = nie jest testem (test-wszystko.sh bierze
 * tylko test-*.mjs). Współrzędne ZNORMALIZOWANE 0..1, jak frame z main.js.
 */
export const W = 1920, H = 1080;

/** @param {{barki?: number[]|null, dlonie?: number[][]}} o  barki = [xL, yL, xP, yP] */
export function klatka({ barki = [0.45, 0.4, 0.55, 0.4], dlonie = [] } = {}) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
    if (barki) { lm[12] = { x: barki[0], y: barki[1] }; lm[11] = { x: barki[2], y: barki[3] }; }
    const hands = dlonie.map(([x, y]) => ({ landmarks: Array.from({ length: 21 }, () => ({ x, y })) }));
    return { hands, pose: barki ? { landmarks: lm } : null, width: W, height: H };
}

export function kontekst(frame) {
    return { frame, W, H, maska: null, maskaSzer: 0, maskaWys: 0, fit: null };
}

export function przepusc(efekt, frame, sekundy, dt = 1 / 60) {
    for (let i = 0; i < Math.round(sekundy / dt); i++) efekt.updateAndDraw(null, kontekst(frame), dt);
}

/** Atrapa CanvasRenderingContext2D - każda metoda no-op; do testu "nie rzuca przy rysowaniu". */
export function atrapaCtx() {
    const nic = () => {};
    return new Proxy({ canvas: { width: W, height: H } }, {
        get(cel, klucz) {
            if (klucz in cel) return cel[klucz];
            if (klucz === 'createRadialGradient' || klucz === 'createLinearGradient') return () => ({ addColorStop: nic });
            return nic;
        },
        set(cel, klucz, wartosc) { cel[klucz] = wartosc; return true; }
    });
}
