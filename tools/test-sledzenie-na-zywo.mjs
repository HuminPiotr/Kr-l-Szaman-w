/**
 * Śledzenie uderzeń na żywo (słuch) - złapanie rytmu, błąd uderzeń, zmiana tempa,
 * przerwa bez bębna, szum. Dźwięk syntetyczny podawany kawałkami po 128 próbek
 * (jak z AudioWorkletu) przez ObwiedniaNaZywo.
 *
 *   node tools/test-sledzenie-na-zywo.mjs
 */
import { ObwiedniaNaZywo } from '../js/rytm/obwiedniaNaZywo.js';
import { SledzenieNaZywo, SiatkaNaZywo } from '../js/rytm/sledzenieNaZywo.js';

let ziarno = 7;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const SR = 44100;

/** Utwór z listy uderzeń (bęben na uderzeniu, hi-hat pomiędzy) + szum; cisza bębna w [ciszaOd, ciszaDo). */
function utwor(sekund, bity, { ciszaOd = Infinity, ciszaDo = -1, szum = 0.02 } = {}) {
    const pcm = new Float32Array(sekund * SR);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (losowa() - 0.5) * szum;
    const uderz = (t, g, fn, dl) => { const p = Math.round(t * SR); for (let k = 0; k < dl * SR && p + k < pcm.length; k++) pcm[p + k] += g * Math.exp(-k / (0.03 * SR)) * fn(k / SR); };
    for (let i = 0; i < bity.length; i++) {
        const t = bity[i];
        if (t >= ciszaOd && t < ciszaDo) continue;
        uderz(t, 0.8, (s) => Math.sin(2 * Math.PI * 60 * s), 0.15);
        if (bity[i + 1]) uderz((t + bity[i + 1]) / 2, 0.15, () => losowa() - 0.5, 0.05);
    }
    return pcm;
}

/** Przepuszcza dźwięk; zwraca czasy uderzeń przewidziane przez słuch (moment zmiany indeksu) i przebieg pewności. */
function sluchaj(pcm) {
    const o = new ObwiedniaNaZywo(SR), s = new SledzenieNaZywo();
    const przewidziane = [], pewnosc = [];
    let ostatni = null;
    for (let i = 0; i < pcm.length; i += 128) {
        const t = i / SR;
        s.dodaj(o.dodaj(pcm.subarray(i, i + 128), t));
        const f = s.pewny ? s.siatka.faza(t) : null;
        if (f && ostatni !== null && f.indeks !== ostatni) przewidziane.push(t - f.faza01 * f.okresS);
        ostatni = f ? f.indeks : null;
        if (i % (SR / 4) < 128) pewnosc.push({ t, p: s.pewnosc, pewny: s.pewny });
    }
    return { przewidziane, pewnosc, s };
}
const blad = (przewidziane, bity, od, doS = Infinity) => {
    const b = przewidziane.filter(t => t >= od && t < doS).map(t => Math.min(...bity.map(x => Math.abs(x - t))));
    b.sort((x, y) => x - y);
    return { n: b.length, mediana: b[Math.floor(b.length / 2)] ?? Infinity, p90: b[Math.floor(b.length * 0.9)] ?? Infinity };
};
const zlapanie = (pewnosc) => pewnosc.find(x => x.pewny)?.t ?? Infinity;

console.log('STAŁE TEMPO 128 BPM:');
{
    const bity = []; for (let t = 0.41; t < 30; t += 60 / 128) bity.push(t);
    const { przewidziane, pewnosc, s } = sluchaj(utwor(30, bity));
    const z = zlapanie(pewnosc), b = blad(przewidziane, bity, z + 2);
    spr(`złapanie po ${z.toFixed(1)} s (< 8 s), tempo ${s.bpm?.toFixed(1)} BPM`, z < 8 && Math.abs(s.bpm - 128) < 1.5);
    spr(`błąd uderzeń: mediana ${(b.mediana * 1000).toFixed(0)} ms, p90 ${(b.p90 * 1000).toFixed(0)} ms (< 30 / 50)`, b.mediana < 0.03 && b.p90 < 0.05 && b.n > 40);
}
console.log('\nZMIANA TEMPA 120 -> 132 BPM (w 20 s):');
{
    const bity = []; let t = 0.3; while (t < 40) { bity.push(t); t += 60 / (t < 20 ? 120 : 132); }
    const { przewidziane, s } = sluchaj(utwor(40, bity));
    const b = blad(przewidziane, bity, 26);
    spr(`po 6 s od zmiany znów w rytmie: tempo ${s.bpm?.toFixed(1)} BPM, mediana ${(b.mediana * 1000).toFixed(0)} ms`, Math.abs(s.bpm - 132) < 2 && b.mediana < 0.04 && b.n > 20);
}
console.log('\nPRZERWA BEZ BĘBNA (12-20 s):');
{
    const bity = []; for (let t = 0.3; t < 32; t += 60 / 126) bity.push(t);
    const { pewnosc } = sluchaj(utwor(32, bity, { ciszaOd: 12, ciszaDo: 20 }));
    const w = (od, doS) => pewnosc.filter(x => x.t >= od && x.t < doS);
    spr(`w przerwie słuch traci pewność (min ${Math.min(...w(12, 21).map(x => x.p)).toFixed(2)})`, w(16, 21).some(x => !x.pewny));
    spr('po przerwie wraca', w(27, 32).every(x => x.pewny));
}
console.log('\nSZUM I "MOWA" (nieregularne akcenty):');
{
    const bity = []; let t = 0.2; while (t < 25) { bity.push(t); t += 0.15 + losowa() * 0.6; }
    const { pewnosc } = sluchaj(utwor(25, bity));
    const pewne = pewnosc.filter(x => x.pewny).length / pewnosc.length;
    spr(`nieregularne akcenty: pewny słuch tylko ${(pewne * 100).toFixed(0)}% czasu (< 15%)`, pewne < 0.15);
    const { pewnosc: p2 } = sluchaj(utwor(15, [], { szum: 0.05 }));
    spr('sam szum: nigdy pewny', p2.every(x => !x.pewny));
}
console.log('\nSIATKA NA ŻYWO:');
{
    const s = new SiatkaNaZywo(10, 0.5, 7);
    const f = s.faza(10.75);
    spr('faza i ciągły indeks od bazy', f.indeks === 8 && Math.abs(f.faza01 - 0.5) < 1e-9);
    spr('następne uderzenie', Math.abs(s.nastepneUderzenieS(10.75) - 11) < 1e-9 && s.faza(NaN) === null);
    const z = new SledzenieNaZywo();
    let bladW = null;
    try { z.dodaj([{ t: NaN, wartosc: 1 }, null, { t: 1, wartosc: Infinity }]); z.dodaj(null); } catch (e) { bladW = e; }
    spr('złe ramki nie rzucają', bladW === null && !z.pewny);
}
process.exit(ok ? 0 : 1);
