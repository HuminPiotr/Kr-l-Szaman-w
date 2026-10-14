/**
 * Krążenie bez nawrotów - "łuki zamiast linii".
 *
 *   node tools/test-krazenie.mjs
 *
 * NAJWAŻNIEJSZY przypadek to "łuk prostej ręki wokół barku": dzisiejszy exploit
 * (wysokie podnoszenie i opuszczanie rąk) kreśli ŁUK, nie linię. Miara oparta na
 * przyspieszeniu normalnym (krzywiźnie) dawałaby mu wysoki wynik - dlatego mierzymy
 * NAWROTY: czy staw wraca po tym samym torze w przeciwną stronę.
 */
import { Krazenie } from '../js/jakosc/krazenie.js';

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

const SIGMA = 0.009, FPS = 60, DT = 1 / FPS;

/** tor(t, strona) -> {nadgarstek:[x,y], lokiec:[x,y]}; strona 1 = L, -1 = P */
function przebieg(tor, sekund = 8, migotanie = false) {
    const m = new Krazenie();
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 })); // kostki niewidoczne
        for (const [nad, lok, strona] of [[15, 13, 1], [16, 14, -1]]) {
            const p = tor(t, strona);
            if (!p) continue;
            w[nad] = { x: p.nadgarstek[0] + gauss() * SIGMA, y: p.nadgarstek[1] + gauss() * SIGMA, z: 0, visibility: 0.9 };
            w[lok] = { x: p.lokiec[0] + gauss() * SIGMA, y: p.lokiec[1] + gauss() * SIGMA, z: 0, visibility: 0.9 };
        }
        // migotanie śledzenia: co 0.5 s jedna klatka bez pozy ('staw' - nadgarstki i łokcie z visibility 0)
        if (migotanie && i % (FPS / 2) === 0) {
            if (migotanie === 'staw') { for (const j of [13, 14, 15, 16]) w[j].visibility = 0; m.update(w, DT); }
            else m.update(null, DT);
        } else m.update(w, DT);
    }
    return m;
}

const om = 2 * Math.PI * 0.8;
const BAREK = (s) => [0.18 * s, -0.45];
// Prosta ręka z dołu prawie do pionu i z powrotem: kąt od ~10° do ~170° (y w dół).
const lukWokolBarku = (t, s) => {
    const th = Math.PI / 2 + 1.4 * Math.sin(om * t);
    const [bx, by] = BAREK(s);
    return { nadgarstek: [bx + s * 0.6 * Math.sin(th), by + 0.6 * Math.cos(th)],
             lokiec:     [bx + s * 0.3 * Math.sin(th), by + 0.3 * Math.cos(th)] };
};
const pompowanie = (t, s) => ({ nadgarstek: [0.25 * s, -0.4 + 0.3 * Math.sin(om * t)],
                                lokiec:     [0.30 * s, -0.25 + 0.12 * Math.sin(om * t)] });
const okrag = (t, s) => ({ nadgarstek: [0.35 * s + 0.25 * Math.cos(om * t), -0.3 + 0.25 * Math.sin(om * t)],
                           lokiec:     [0.28 * s + 0.12 * Math.cos(om * t), -0.25 + 0.12 * Math.sin(om * t)] });
const osemka = (t, s) => ({ nadgarstek: [0.35 * s + 0.3 * Math.sin(om * t), -0.3 + 0.15 * Math.sin(2 * om * t)],
                            lokiec:     [0.28 * s + 0.15 * Math.sin(om * t), -0.25 + 0.07 * Math.sin(2 * om * t)] });
const bezruch = (t, s) => ({ nadgarstek: [0.3 * s, -0.2], lokiec: [0.25 * s, -0.3] });

const w = {};
for (const [nazwa, tor] of Object.entries({ lukWokolBarku, pompowanie, okrag, osemka, bezruch })) {
    w[nazwa] = przebieg(tor);
    const k = w[nazwa].krazenie;
    console.log(`  ${nazwa.padEnd(16)} krążenie ${k === null ? 'null' : k.toFixed(2)}  stawów ${w[nazwa].aktywnychStawow}`);
}
spr('łuk prostej ręki wokół barku (exploit) ma niskie krążenie (< 0.2)', w.lukWokolBarku.krazenie !== null && w.lukWokolBarku.krazenie < 0.2);
spr('pompowanie góra-dół ma niskie krążenie (< 0.15)', w.pompowanie.krazenie !== null && w.pompowanie.krazenie < 0.15);
spr('okrąg ma wysokie krążenie (> 0.85)', w.okrag.krazenie > 0.85);
spr('ósemka ma wysokie krążenie (> 0.6)', w.osemka.krazenie > 0.6);
spr('ranking: okrąg > ósemka > łuk', w.okrag.krazenie > w.osemka.krazenie && w.osemka.krazenie > w.lukWokolBarku.krazenie);
spr('bezruch nie głosuje (null, 0 stawów)', w.bezruch.krazenie === null && w.bezruch.aktywnychStawow === 0);

{
    for (const nazwa of ['okrag', 'osemka', 'pompowanie']) {
        const tor = { okrag, osemka, pompowanie }[nazwa];
        for (const rodzaj of [true, 'staw']) {
            const m = przebieg(tor, 8, rodzaj), c = w[nazwa];
            console.log(`  migotanie ${String(rodzaj).padEnd(5)} ${nazwa.padEnd(11)} ${m.krazenie === null ? 'null' : m.krazenie.toFixed(2)} (bez migotania ${c.krazenie.toFixed(2)})`);
            spr(`migotanie (${rodzaj === true ? 'brak pozy' : 'stawy niewidoczne'}) co 0.5 s: ${nazwa} nie null i blisko wyniku bez migotania (< 0.1)`,
                m.krazenie !== null && Math.abs(m.krazenie - c.krazenie) < 0.1);
        }
    }
    const m = przebieg(okrag, 8);
    for (let i = 0; i < 30; i++) m.update(null, DT);   // 0.5 s bez pozy: dłuższe niż MAX_PRZERWA_S
    spr('długa przerwa (0.5 s) czyści okna', m._bufory.every(b => b.length === 0));
}
{
    const m = przebieg(okrag);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
    for (let i = 0; i < 60; i++) m.update(zle, DT);
    m.update(null, DT); m.update(null, 0); m.update(null, NaN);
    spr('NaN / null / dt=0 nie zatruwają stanu', m.krazenie === null || Number.isFinite(m.krazenie));
}

process.exit(ok ? 0 : 1);
