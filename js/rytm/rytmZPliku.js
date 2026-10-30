/**
 * Rytm własnej pieśni z pliku - liczony od razu w przeglądarce, bez mikrofonu
 * (spec 2026-10-30-sluch-design.md, zad. 9). Ta sama analiza co pieśni Suno
 * (tools/analiza-rytmu.mjs), tylko dekodowanie przez Web Audio zamiast ffmpeg.
 *
 * Nigdy nie rzuca: plik, którego nie da się zdekodować albo bez wyraźnego rytmu,
 * to pieśń bez rytmu z pliku - wtedy trans i tak działa przez słuch (mikrofon).
 */
import { analizujRytm } from './analizaRytmu.js';
import { walidujRytm } from '../piesni.js';

const SR_ANALIZY = 11025;

/** Kanały -> mono, decymacja uśrednianiem do ~11 kHz (jak ObwiedniaNaZywo). */
export function monoDoAnalizy(kanaly, sr) {
    const dziel = Math.max(1, Math.round(sr / SR_ANALIZY));
    const n = Math.floor((kanaly[0]?.length ?? 0) / dziel);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (const k of kanaly) for (let j = 0; j < dziel; j++) s += k[i * dziel + j];
        out[i] = s / (dziel * kanaly.length);
    }
    return { pcm: out, sr: sr / dziel };
}

/**
 * @param {Blob} plik
 * @param {{dekoduj?: (buf: ArrayBuffer) => Promise<AudioBuffer>}} [opcje]  w testach atrapa
 * @returns {Promise<object|null>} rytm w formacie manifestu albo null
 */
export async function rytmZPliku(plik, { dekoduj = domyslneDekodowanie } = {}) {
    try {
        const ab = await dekoduj(await plik.arrayBuffer());
        const kanaly = Array.from({ length: ab.numberOfChannels }, (_, i) => ab.getChannelData(i));
        const { pcm, sr } = monoDoAnalizy(kanaly, ab.sampleRate);
        const r = analizujRytm(pcm, sr);
        return r ? walidujRytm({ wersja: 1, bpm: r.bpm, pierwszeUderzenieS: r.pierwszeUderzenieS, ...(r.uderzenia ? { uderzenia: r.uderzenia } : {}) }) : null;
    } catch {
        return null;
    }
}

/** OfflineAudioContext: dekoduje bez gestu użytkownika i bez dotykania głośników. */
function domyslneDekodowanie(buf) {
    const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!Ctx) return Promise.reject(new Error('brak OfflineAudioContext'));
    return new Ctx(1, 1, 44100).decodeAudioData(buf);
}
