/**
 * Analiza rytmu pieśni - tempo i faza z syntetycznego dźwięku.
 *
 *   node tools/test-analiza-rytmu.mjs
 *
 * Precyzja BPM jest krytyczna: 0.1 BPM błędu przy 120 BPM to 0.2 s rozjazdu po 4 min.
 */
import { analizujRytm } from '../js/rytm/analizaRytmu.js';

// mulberry32 - patrz tools/test-plynnosc.mjs, dlaczego nie naiwny LCG.
let ziarno = 42;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const SR = 11025;

/** Bęben (niski, mocny) na uderzeniach, hi-hat (szum) na ósemkach, tło szumu. czasy(i) = czas i-tego uderzenia. */
function utwor(sekund, czasy) {
    const pcm = new Float32Array(sekund * SR);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (losowa() - 0.5) * 0.02;
    const uderz = (t, glosnosc, fn, dl) => {
        const p = Math.round(t * SR);
        for (let k = 0; k < dl * SR && p + k < pcm.length; k++) if (p + k >= 0) pcm[p + k] += glosnosc * Math.exp(-k / (0.03 * SR)) * fn(k / SR);
    };
    for (let i = 0; ; i++) {
        const t = czasy(i);
        if (!(t < sekund)) break;
        uderz(t, 0.8, (s) => Math.sin(2 * Math.PI * 60 * s), 0.15);
        const t2 = czasy(i + 1);
        if (t2 < sekund) uderz((t + t2) / 2, 0.15, () => losowa() - 0.5, 0.05);
    }
    return pcm;
}

for (const [bpm, faza] of [[100, 0.31], [128, 0.12], [150, 0.4]]) {
    const T = 60 / bpm;
    const r = analizujRytm(utwor(60, (i) => faza + i * T), SR);
    const blad = r ? Math.abs(((r.pierwszeUderzenieS - faza) % T + T * 1.5) % T - T / 2) : Infinity;
    spr(`${bpm} BPM, faza ${faza} s -> ${r?.bpm} BPM, faza ${r?.pierwszeUderzenieS} s (błąd ${(blad * 1000).toFixed(0)} ms), dryf ${r?.dryfS}`,
        r && Math.abs(r.bpm - bpm) < 0.05 && blad < 0.02 && !r.uderzenia);
}
{
    // Tempo płynnie 120 -> 123 BPM: jedna siatka by się rozjechała, ma powstać lista uderzeń.
    const czasy = [];
    let t = 0.2;
    while (t < 90) { czasy.push(t); t += 60 / (120 + 3 * t / 90); }
    const r = analizujRytm(utwor(90, (i) => czasy[i] ?? Infinity), SR);
    const bledy = (r?.uderzenia ?? []).map(u => Math.min(...czasy.map(c => Math.abs(c - u))));
    const sredniBlad = bledy.reduce((a, b) => a + b, 0) / Math.max(1, bledy.length);
    spr(`dryf tempa -> lista uderzeń (${r?.uderzenia?.length ?? 0}, dryf ${r?.dryfS} s, średni błąd ${(sredniBlad * 1000).toFixed(0)} ms)`,
        r && Array.isArray(r.uderzenia) && sredniBlad < 0.04);
}
{
    spr('cisza / za krótko / brak danych -> null, nie wyjątek',
        analizujRytm(new Float32Array(SR * 10), SR) === null && analizujRytm(new Float32Array(100), SR) === null && analizujRytm(null, SR) === null);
}
process.exit(ok ? 0 : 1);
