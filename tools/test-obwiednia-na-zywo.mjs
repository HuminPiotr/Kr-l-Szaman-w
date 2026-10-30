/**
 * Obwiednia uderzeń na żywo - szczyty na uderzeniach, niezależnie od wielkości kawałków.
 *
 *   node tools/test-obwiednia-na-zywo.mjs
 */
import { ObwiedniaNaZywo } from '../js/rytm/obwiedniaNaZywo.js';
import { NASTAWY_ANALIZY as NA } from '../js/rytm/analizaRytmu.js';

let ziarno = 42;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const SR = 44100, T = 60 / 128, FAZA = 0.37, SEK = 20;
const pcm = new Float32Array(SEK * SR);
for (let i = 0; i < pcm.length; i++) pcm[i] = (losowa() - 0.5) * 0.02;
const uderz = (t, g, fn, dl) => { const p = Math.round(t * SR); for (let k = 0; k < dl * SR && p + k < pcm.length; k++) pcm[p + k] += g * Math.exp(-k / (0.03 * SR)) * fn(k / SR); };
const bity = [];
for (let t = FAZA; t < SEK; t += T) { bity.push(t); uderz(t, 0.8, (s) => Math.sin(2 * Math.PI * 60 * s), 0.15); uderz(t + T / 2, 0.15, () => losowa() - 0.5, 0.05); }

function przepusc(kawalek, start = 100) {
    const o = new ObwiedniaNaZywo(SR);
    const ramki = [];
    for (let i = 0; i < pcm.length; i += kawalek) ramki.push(...o.dodaj(pcm.subarray(i, i + kawalek), start + i / SR));
    return { o, ramki };
}
const { o, ramki } = przepusc(128);
spr(`decymacja 44.1 kHz /${o.dziel} -> ${o.sr.toFixed(0)} Hz, ${o.klatekNaS.toFixed(1)} ramek/s`, o.dziel === 4 && Math.abs(o.klatekNaS - 43.07) < 0.1);
spr(`czas ramek w zegarze wołającego (pierwsza ${ramki[0].t.toFixed(3)} s)`, ramki[0].t >= 100 && ramki[0].t < 100.2);

// Szczyty: lokalne maksima powyżej połowy wartości maksymalnej; po KOREKTA_S mają leżeć na uderzeniach.
const max = Math.max(...ramki.map(r => r.wartosc));
const szczyty = ramki.filter((r, i) => i > 0 && i < ramki.length - 1 && r.wartosc > 0.4 * max && r.wartosc >= ramki[i - 1].wartosc && r.wartosc >= ramki[i + 1].wartosc)
    .map(r => r.t - 100 + NA.KOREKTA_S);
const bledy = szczyty.map(s => Math.min(...bity.map(b => Math.abs(b - s))));
const trafione = bledy.filter(b => b < 0.035).length;
const pokrycie = bity.filter(b => szczyty.some(s => Math.abs(s - b) < 0.035)).length / bity.length;
spr(`szczyty na uderzeniach: ${trafione}/${szczyty.length} trafione (<35 ms), pokrycie uderzeń ${(pokrycie * 100).toFixed(0)}%`, trafione / szczyty.length > 0.9 && pokrycie > 0.9);

const duze = przepusc(4096).ramki;
const roznica = Math.max(...duze.slice(0, 500).map((r, i) => Math.abs(r.wartosc - ramki[i].wartosc) + Math.abs(r.t - ramki[i].t)));
spr(`wielkość kawałków bez znaczenia (128 vs 4096: max różnica ${roznica.toExponential(1)})`, duze.length === ramki.length && roznica < 1e-9);
{
    const z = new ObwiedniaNaZywo(48000);
    let blad = null;
    try { z.dodaj(null, 0); z.dodaj(new Float32Array([NaN, Infinity, 1]), NaN); z.dodaj(new Float32Array(8192), 5); } catch (e) { blad = e; }
    spr('48 kHz, NaN, null, brak czasu - bez wyjątku', blad === null && z.dziel === 4);
}
process.exit(ok ? 0 : 1);
