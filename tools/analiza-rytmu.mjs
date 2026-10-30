/**
 * Rytm pieśni z manifestu -> pole `rytm` w assets/muzyka/utwory.json
 * (spec 2026-10-30-trans-design.md). NIE test - narzędzie dla dewelopera.
 *
 *   node tools/analiza-rytmu.mjs                 # analiza i zapis do manifestu
 *   node tools/analiza-rytmu.mjs --sucho         # tylko wydruk, bez zapisu
 *   node tools/analiza-rytmu.mjs --podglad DIR   # + pliki z klikami na uderzeniach do odsłuchu
 *
 * Dekoduje ffmpeg-iem (mono, 11025 Hz, f32le) i woła analizujRytm() z js/rytm/analizaRytmu.js.
 * Podgląd to WYŁĄCZNIE materiał do odsłuchu dla właściciela - nie trafia do gry
 * (gra nie ma efektów dźwiękowych, decyzja 2026-10-01).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizujRytm } from '../js/rytm/analizaRytmu.js';

const SR = 11025;
const KATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'muzyka');
const MANIFEST = join(KATALOG, 'utwory.json');
const sucho = process.argv.includes('--sucho');
const iPodglad = process.argv.indexOf('--podglad');
const podglad = iPodglad > 0 ? process.argv[iPodglad + 1] : null;

const dekoduj = (plik) => {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', plik, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
};

const utwory = JSON.parse(readFileSync(MANIFEST, 'utf8'));
for (const u of utwory) {
    const plik = join(KATALOG, u.plik);
    const pcm = dekoduj(plik);
    const r = analizujRytm(pcm, SR);
    if (!r) { console.log(`${u.plik.padEnd(24)} brak rytmu - pieśń bez transu`); delete u.rytm; continue; }
    console.log(`${u.plik.padEnd(24)} ${r.bpm.toFixed(3)} BPM, pierwsze uderzenie ${r.pierwszeUderzenieS.toFixed(3)} s, dryf ${(r.dryfS * 1000).toFixed(0)} ms${r.uderzenia ? `, LISTA ${r.uderzenia.length} uderzeń` : ''}`);
    u.rytm = { wersja: 1, bpm: r.bpm, pierwszeUderzenieS: r.pierwszeUderzenieS, ...(r.uderzenia ? { uderzenia: r.uderzenia } : {}) };

    if (podglad) {
        mkdirSync(podglad, { recursive: true });
        const dl = pcm.length / SR, T = 60 / r.bpm;
        const czasy = r.uderzenia ?? Array.from({ length: Math.floor((dl - r.pierwszeUderzenieS) / T) + 1 }, (_, i) => r.pierwszeUderzenieS + i * T);
        // Krótki, wysoki klik (2 kHz, 25 ms) na każdym uderzeniu - wyraźny ponad muzyką.
        const klik = new Float32Array(pcm.length);
        for (const t of czasy) {
            const p = Math.round(t * SR);
            for (let k = 0; k < 0.025 * SR && p + k < klik.length; k++) klik[p + k] = 0.6 * Math.sin(2 * Math.PI * 2000 * k / SR) * Math.exp(-k / (0.006 * SR));
        }
        const surowyKlik = join(podglad, `${u.plik}.klik.f32`);
        writeFileSync(surowyKlik, Buffer.from(klik.buffer));
        const wyj = join(podglad, `${u.plik.replace(/\.[^.]+$/, '')} - kliki.m4a`);
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', plik, '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', surowyKlik,
            '-filter_complex', '[1:a]aresample=44100,pan=stereo|c0=c0|c1=c0[k];[0:a][k]amix=inputs=2:normalize=0', wyj]);
        console.log(`   podgląd: ${wyj}`);
    }
}
if (!sucho) {
    // Lista uderzeń w jednej linii - inaczej manifest puchnie o setki linii na pieśń.
    const tekst = JSON.stringify(utwory, null, 2).replace(/\[\s*([-\d.,\s]+?)\s*\]/g, (_, w) => `[${w.split(/,\s*/).join(', ')}]`);
    writeFileSync(MANIFEST, tekst + '\n');
    console.log(`zapisano ${MANIFEST}`);
}
