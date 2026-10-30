/**
 * Rytm własnej pieśni z pliku (dekodowanie przez atrapę Web Audio).
 *
 *   node tools/test-rytm-z-pliku.mjs
 */
import { rytmZPliku, monoDoAnalizy } from '../js/rytm/rytmZPliku.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const SR = 44100, T = 60 / 118, SEK = 40;
const L = new Float32Array(SEK * SR), P = new Float32Array(SEK * SR);
let z = 1; const los = () => { z = (z * 16807) % 2147483647; return z / 2147483647; };
for (let i = 0; i < L.length; i++) { L[i] = (los() - 0.5) * 0.02; P[i] = (los() - 0.5) * 0.02; }
for (let t = 0.25; t < SEK; t += T) { const p = Math.round(t * SR); for (let k = 0; k < 0.15 * SR && p + k < L.length; k++) { const v = 0.8 * Math.exp(-k / (0.03 * SR)) * Math.sin(2 * Math.PI * 60 * k / SR); L[p + k] += v; P[p + k] += v; } }
const atrapa = async () => ({ numberOfChannels: 2, sampleRate: SR, getChannelData: (i) => (i ? P : L) });
const plik = { arrayBuffer: async () => new ArrayBuffer(8) };

{
    const { pcm, sr } = monoDoAnalizy([L, P], SR);
    spr(`mono + decymacja: ${sr} Hz, ${pcm.length} próbek`, sr === 11025 && pcm.length === Math.floor(L.length / 4));
}
{
    const r = await rytmZPliku(plik, { dekoduj: atrapa });
    spr(`stereo 44.1 kHz 118 BPM -> ${r?.bpm} BPM, pierwsze uderzenie ${r?.pierwszeUderzenieS} s`, r && Math.abs(r.bpm - 118) < 0.2 && Math.abs(r.pierwszeUderzenieS - 0.25) < 0.03);
}
{
    const zle = await rytmZPliku(plik, { dekoduj: async () => { throw new Error('nie dźwięk'); } });
    const cisza = await rytmZPliku(plik, { dekoduj: async () => ({ numberOfChannels: 1, sampleRate: SR, getChannelData: () => new Float32Array(SR * 10) }) });
    const brak = await rytmZPliku(null);
    spr('niedekodowalny / cisza / brak pliku -> null, bez wyjątku', zle === null && cisza === null && brak === null);
}
process.exit(ok ? 0 : 1);
