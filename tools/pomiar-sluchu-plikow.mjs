/**
 * Słuch na pieśniach z manifestu, BEZ mikrofonu - NIE test (nic nie pada na czerwono).
 *
 *   node tools/pomiar-sluchu-plikow.mjs            # czysty dźwięk z pliku
 *   node tools/pomiar-sluchu-plikow.mjs --glosnik  # + "głośnik laptopa": górnoprzepustowy 200 Hz i szum
 *
 * Dekoduje pieśń (ffmpeg, 48 kHz), podaje ją do Sluch.przyjmij() paczkami po 2048 próbek
 * (ta sama droga co AudioWorklet) i porównuje uderzenia słuchu z rytmem z pliku (utwory.json).
 * Drukuje: czas złapania, błąd uderzeń (mediana/p90), stałe przesunięcie, ułamek czasu
 * z pewnym słuchem, okresowość, tempo słuchu względem pliku (połowa/dwukrotność = źle dla zgodności).
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sluch } from '../js/rytm/sluch.js';
import { walidujRytm } from '../js/piesni.js';
import { SiatkaUderzen } from '../js/rytm/siatka.js';
import { NASTAWY_SLUCHU } from '../js/rytm/sledzenieNaZywo.js';

// Strojenie: NASTAWY='{"SZEROKOSC_PREFERENCJI_OKT":0.5}' node tools/pomiar-sluchu-plikow.mjs
if (process.env.NASTAWY) Object.assign(NASTAWY_SLUCHU, JSON.parse(process.env.NASTAWY));

const KAT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'muzyka');
const glosnik = process.argv.includes('--glosnik');
const SR = 48000, PACZKA = 2048;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

for (const u of JSON.parse(readFileSync(join(KAT, 'utwory.json'), 'utf8'))) {
    const rytm = walidujRytm(u.rytm); if (!rytm) continue;
    const plik = SiatkaUderzen.z(rytm);
    const filtr = glosnik ? ['-af', 'highpass=f=200,highpass=f=200,volume=0.5'] : [];
    const b = execFileSync('ffmpeg', ['-v', 'error', '-i', join(KAT, u.plik), ...filtr, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    const pcm = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
    if (glosnik) { let z = 1; for (let i = 0; i < pcm.length; i++) { z = (z * 16807) % 2147483647; pcm[i] += (z / 2147483647 - 0.5) * 0.02; } }
    const s = new Sluch({ mediaDevices: undefined, magazyn: null });
    s.stan = 'słucha'; s.opoznienieS = 0;
    let teraz = 0; s._ctx = { get currentTime() { return teraz; } };
    let zlap = null, pewnych = 0, krokow = 0, ostatni = null;
    const bledy = [], okres = [], tempa = [];
    for (let i = 0; i < pcm.length; i += PACZKA) {
        s.przyjmij({ pcm: pcm.subarray(i, i + PACZKA), t: i / SR, sr: SR });
        teraz = (i + PACZKA) / SR;
        krokow++;
        const sl = s.sledzenie;
        if (sl.okresowosc) okres.push(sl.okresowosc);
        if (!sl.pewny) { ostatni = null; continue; }
        pewnych++;
        if (zlap === null) zlap = teraz;
        tempa.push(sl.bpm / (60 / plik.faza(teraz).okresS));
        const f = sl.siatka.faza(teraz);
        if (ostatni !== null && f.indeks !== ostatni) {
            const tb = teraz - f.faza01 * f.okresS;
            const fp = plik.faza(tb);
            let d = fp.faza01 * fp.okresS; if (d > fp.okresS / 2) d -= fp.okresS;   // ze znakiem: + = słuch po pliku
            bledy.push(d);
        }
        ostatni = f.indeks;
    }
    const abs = bledy.map(Math.abs);
    const r = q(tempa, 0.5);
    const oktawa = Math.abs(r - 1) < 0.05 ? 'OK' : Math.abs(r - 0.5) < 0.05 ? 'POŁOWA!' : Math.abs(r - 2) < 0.1 ? 'DWUKROTNOŚĆ!' : `?${r.toFixed(2)}`;
    console.log(`${u.tytul.padEnd(18)} złapanie ${zlap?.toFixed(1)} s  pewny ${(100 * pewnych / krokow).toFixed(0)}%  tempo ${oktawa}  błąd med ${(q(abs, 0.5) * 1000).toFixed(0)} ms p90 ${(q(abs, 0.9) * 1000).toFixed(0)} ms  przesunięcie ${(q(bledy, 0.5) * 1000).toFixed(0)} ms  okresowość ${q(okres, 0.1).toFixed(2)}..${q(okres, 0.5).toFixed(2)}..${q(okres, 0.9).toFixed(2)}`);
}
