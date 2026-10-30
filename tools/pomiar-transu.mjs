/**
 * Pomiar transu na nagraniach sesji T - NIE test (nic nie pada na czerwono).
 *
 *   node tools/pomiar-transu.mjs            # wszystkie nagrania z tools/probki/ z czasem pieśni
 *
 * Każdy krok przepuszcza przez ZgodnoscRytmu + Trans na rytmie pieśni zapisanym
 * w nagraniu (piesn.rytm) i czasie pieśni w klatkach (cp). Drukuje medianę
 * [p10..p90] zgodności, surową spójność, liczbę akcentów, wygraną siatkę
 * i najwyższy poziom transu - z tego, nie z wyobraźni, ustawia się
 * NASTAWY_ZGODNOSCI (js/rytm/zgodnosc.js) i NASTAWY_TRANSU (js/rytm/trans.js).
 *
 * Kroki są przepuszczane OSOBNO, od zera, jak świeża runda - poziom transu w kroku
 * mówi więc "ile transu da 15-20 s takiego tańca".
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { ZgodnoscRytmu } from '../js/rytm/zgodnosc.js';
import { Trans } from '../js/rytm/trans.js';
import { SiatkaUderzen } from '../js/rytm/siatka.js';
import { walidujRytm } from '../js/piesni.js';
import { SCENARIUSZ_TRANS } from '../js/nagrywanie/sesja.js';
import { execFileSync } from 'node:child_process';
import { Sluch } from '../js/rytm/sluch.js';

// --sluch: zamiast rytmu z pliku - rytm, który SŁUCH miałby w każdej chwili, słuchając tej pieśni
// (dekodowanej z pliku, bez mikrofonu). Sprawdza, ile zgodności kosztuje słuch zamiast pliku.
const PRZEZ_SLUCH = process.argv.includes('--sluch');
function historiaSluchu(plikPiesni) {
    const SR = 48000, b = execFileSync('ffmpeg', ['-v', 'error', '-i', join(KATALOG, '..', '..', 'assets', 'muzyka', plikPiesni), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    const pcm = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
    const s = new Sluch({ mediaDevices: undefined, magazyn: null });
    s.stan = 'słucha'; s.opoznienieS = 0;
    const stany = [];
    for (let i = 0; i < pcm.length; i += 2048) {
        s.przyjmij({ pcm: pcm.subarray(i, i + 2048), t: i / SR, sr: SR });
        const sl = s.sledzenie;
        stany.push({ t: (i + 2048) / SR, siatka: sl.pewny ? sl.siatka : null });
    }
    return (t) => { let lo = 0, hi = stany.length - 1; if (!(t >= stany[0].t)) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (stany[m].t <= t) lo = m; else hi = m; } return stany[lo].siatka; };
}

const KROKI = Object.fromEntries(SCENARIUSZ_TRANS.map(k => [k.id, k]));

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');

const kwantyl = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '  - ').padStart(5);
const kol = (a) => (a.length ? `${f2(kwantyl(a, 0.5))} [${f2(kwantyl(a, 0.1))}..${f2(kwantyl(a, 0.9))}]` : '  brak danych'.padEnd(20));

function przepusc(klatki, siatka, sluchW = null) {
    const z = new ZgodnoscRytmu(), tr = new Trans();
    const zg = [], sur = [], ak = [], siatki = {};
    let czas = 0, bezCzasu = 0, maxPoziom = 0;
    for (const k of klatki) {
        const s = sluchW && Number.isFinite(k.czasPiesniS) ? sluchW(k.czasPiesniS) : siatka;
        const rytm = Number.isFinite(k.czasPiesniS) && s ? { siatka: s, czasS: k.czasPiesniS } : null;
        if (!rytm) bezCzasu++;
        z.update(k.pose ?? null, k.dt, rytm);
        tr.update(z.zgodnosc, k.dt);
        czas += k.dt;
        maxPoziom = Math.max(maxPoziom, tr.poziom);
        if (czas < 3) continue;   // rozgrzanie okna akcentów
        if (Number.isFinite(z.zgodnosc)) zg.push(z.zgodnosc);
        sur.push(z.surowa);
        ak.push(z.koherencja);
        if (z.siatkaWygrana) siatki[z.siatkaWygrana] = (siatki[z.siatkaWygrana] ?? 0) + 1;
    }
    const siatka1 = Object.entries(siatki).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    return { zg, sur, ak, siatka1, maxPoziom, koniec: tr.poziom, bezCzasu, n: klatki.length };
}

let cokolwiek = false;
for (const plik of readdirSync(KATALOG).filter(f => f.endsWith('.json')).sort()) {
    const dane = JSON.parse(readFileSync(join(KATALOG, plik), 'utf8'));
    const rytm = walidujRytm(dane.piesn?.rytm);
    if (!rytm) continue;
    cokolwiek = true;
    const siatka = SiatkaUderzen.z(rytm);
    const sluchW = PRZEZ_SLUCH ? historiaSluchu(dane.piesn.plik) : null;
    if (PRZEZ_SLUCH) console.log('   (rytm ze SŁUCHU pieśni, nie z pliku)');
    console.log(`-- ${plik}  (${dane.piesn.tytul ?? dane.piesn.plik}, ${rytm.bpm} BPM)`);
    console.log(''.padEnd(28) + ' błysk         zgodność             surowa               koher.     sygnał         max poziom  koniec');
    for (const [etykieta, zapisane] of Object.entries(dane.kroki ?? {})) {
        const kl = zapisane.map(z => odtworzKlatke(z, dane));
        const r = przepusc(kl, siatka, sluchW);
        const uwaga = r.bezCzasu > r.n * 0.1 ? `  ⚠ ${r.bezCzasu}/${r.n} klatek bez czasu pieśni` : '';
        const k = KROKI[etykieta.replace(/#\d+$/, '')];
        const etyk = k ? `${String(k.tempoBlysku).padStart(4)}x ${k.wRytmie ? 'RYTM ' : 'obok '}` : '   ?      ';
        if (!r.zg.length && r.bezCzasu === r.n) { console.log(`${etykieta.padEnd(28)} ${etyk}  ⚠ brak czasu pieśni - nie do zmierzenia`); continue; }
        console.log(`${etykieta.padEnd(28)} ${etyk} ${kol(r.zg)} ${kol(r.sur)} ${f2(kwantyl(r.ak, 0.5))}     ${r.siatka1.padEnd(12)} ${f2(r.maxPoziom)}      ${f2(r.koniec)}${uwaga}`);
    }
}
if (!cokolwiek) console.log('Brak nagrań sesji T (z czasem pieśni) w tools/probki/. Nagraj: w grze klawisz T.');
