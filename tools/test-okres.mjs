/**
 * Okres ruchu - dominujący okres tańca z autokorelacji POZYCJI.
 *
 *   node tools/test-okres.mjs
 *
 * Pułapki pilnowane tutaj:
 *  - autokorelacja |v| daje dla kołysania PÓŁ okresu (|cos| powtarza się co T/2),
 *  - dla okręgu ze stałą prędkością |v| jest płaskie - brak szczytu,
 *  - drugi szczyt (2T) bywa minimalnie wyższy od pierwszego - ma wygrać pierwszy.
 */
import { Okres, PROG_PEWNOSCI } from '../js/jakosc/okres.js';

// mulberry32 - patrz tools/test-plynnosc.mjs, dlaczego nie naiwny LCG.
let ziarno = 42;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => {
    const u = losowa() || 1e-9, v = losowa();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const SIGMA = 0.009;
const STAWY = [15, 16, 13, 14, 27, 28];

function przebieg(tor, { fps = 60, sekund = 8, migotanie = false } = {}) {
    const m = new Okres();
    const dt = 1 / fps;
    for (let i = 0; i < sekund * fps; i++) {
        const t = i * dt;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        const pstryk = migotanie === 'staw' && i % Math.round(0.5 * fps) === 0;
        STAWY.forEach((j, n) => {
            const [x, y] = tor(t, n);
            w[j] = { x: x + gauss() * SIGMA, y: y + gauss() * SIGMA, z: 0, visibility: pstryk ? 0 : 0.9 };
        });
        // migotanie śledzenia: co 0.5 s jedna klatka bez pozy
        m.update(migotanie === true && i % Math.round(0.5 * fps) === 0 ? null : w, dt);
    }
    return m;
}

const kolysanie = (f) => (t, n) => [0.25 * Math.sin(2 * Math.PI * f * t + n * 0.3) * (n % 2 ? -1 : 1), 0];
const okrag = (f) => (t) => [0.25 * Math.cos(2 * Math.PI * f * t), 0.25 * Math.sin(2 * Math.PI * f * t)];
const blisko = (a, b, tol) => Math.abs(a - b) / b <= tol;

for (const f of [0.5, 1, 2]) {
    const m = przebieg(kolysanie(f));
    spr(`kołysanie ${f} Hz -> okres ${m.okresS.toFixed(3)} s (cel ${(1 / f).toFixed(3)}), pewność ${m.pewnosc.toFixed(2)}`,
        blisko(m.okresS, 1 / f, 0.08) && m.pewnosc > 0.6);
}
{
    const m = przebieg(okrag(1));
    spr(`okrąg 1 Hz (stała prędkość) -> okres ${m.okresS.toFixed(3)} s, pewność ${m.pewnosc.toFixed(2)}`,
        blisko(m.okresS, 1, 0.08) && m.pewnosc > 0.6);
}
{
    const m = przebieg(kolysanie(1), { fps: 30 });
    spr(`30 FPS: kołysanie 1 Hz -> ${m.okresS.toFixed(3)} s (okres z czasu, nie z liczby klatek)`,
        blisko(m.okresS, 1, 0.08));
}
{
    const czyste = przebieg(kolysanie(1)), mig = przebieg(kolysanie(1), { migotanie: true });
    spr(`migotanie (co 0.5 s klatka bez pozy): okres ${mig.okresS.toFixed(3)} s vs ${czyste.okresS.toFixed(3)} s, pewność ${mig.pewnosc.toFixed(2)} vs ${czyste.pewnosc.toFixed(2)}`,
        Math.abs(mig.okresS - czyste.okresS) / czyste.okresS < 0.03 && mig.pewnosc > 0.6 && mig.czestotliwoscHz !== null);
    const migStaw = przebieg(kolysanie(1), { migotanie: 'staw' });
    spr(`migotanie stawów (visibility 0 co 0.5 s): pewność ${migStaw.pewnosc.toFixed(2)}`, migStaw.pewnosc > 0.6 && Math.abs(migStaw.okresS - 1) < 0.08);
    const dluga = przebieg(kolysanie(1), { sekund: 8 });
    for (let i = 0; i < 30; i++) dluga.update(null, 1 / 60);   // 0.5 s bez pozy: dłuższe niż MAX_PRZERWA_S
    spr(`długa przerwa (0.5 s) czyści okno i gasi pewność (${dluga.pewnosc.toFixed(2)})`, dluga._bufor.length === 0 && dluga.pewnosc < czyste.pewnosc);
}
{
    const m = przebieg(() => [0, 0]);
    spr(`bezruch: pewność ${m.pewnosc.toFixed(2)} < próg ${PROG_PEWNOSCI}, częstotliwość null`,
        m.pewnosc < PROG_PEWNOSCI && m.czestotliwoscHz === null);
}
{
    const m = przebieg(kolysanie(1));
    spr('częstotliwość = 1/okres przy pewnym okresie', Math.abs(m.czestotliwoscHz - 1 / m.okresS) < 1e-9);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
    for (let i = 0; i < 120; i++) m.update(zle, 1 / 60);
    m.update(null, 1 / 60);
    m.update(null, 0);
    m.update(null, NaN);
    spr('NaN / null / dt=0 nie psują stanu', Number.isFinite(m.okresS) && Number.isFinite(m.pewnosc));
}

process.exit(ok ? 0 : 1);
