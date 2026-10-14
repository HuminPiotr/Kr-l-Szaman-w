/**
 * Pomiar jakości tańca na nagraniach - NIE test (nic nie pada na czerwono).
 *
 *   node tools/pomiar-jakosci.mjs              # wszystkie nagrania z tools/probki/
 *   node tools/pomiar-jakosci.mjs jakosc-      # tylko kroki, których etykieta zawiera "jakosc-"
 *
 * Drukuje medianę [p10..p90] składowych bogactwa, mnożnik i realny czas do pełnego
 * paska (MotionMeter na tych samych klatkach). Z tego, nie z wyobraźni, ustawia się
 * NASTAWY_JAKOSCI (kotwice!), NASTAWY_ZAANGAZOWANIA i NASTAWY_FALI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { JakoscTanca } from '../js/jakoscTanca.js';
import { Plynnosc } from '../js/plynnosc.js';
import { MotionMeter } from '../js/motionMeter.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const filtr = process.argv[2] ?? '';
const POLA = ['krazenie', 'zaangazowanie', 'fala', 'bogactwo', 'mnoznik'];

const kwantyl = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '  - ').padStart(5);
const kol = (a) => (a.length ? `${f2(kwantyl(a, 0.5))} [${f2(kwantyl(a, 0.1))}..${f2(kwantyl(a, 0.9))}]` : '  brak danych'.padEnd(20));

function przepusc(klatki) {
    const j = new JakoscTanca(), p = new Plynnosc(), m = new MotionMeter();
    const zbior = Object.fromEntries(POLA.map(k => [k, []]));
    let sumaTempa = 0, czas = 0;
    for (const k of klatki) {
        const mn = j.update(k, k.dt);
        const pl = p.update(k.pose?.worldLandmarks ?? null, k.dt, j.czestotliwoscHz);
        m.update(k, pl, false, mn);
        czas += k.dt;
        if (czas < 2) continue;   // rozgrzanie okien miar
        for (const [kl, v] of Object.entries(j.skladowe)) if (v !== null && Number.isFinite(v)) zbior[kl].push(v);
        zbior.bogactwo.push(j.bogactwo);
        zbior.mnoznik.push(j.mnoznik);
        sumaTempa += m.tempoLadowania * k.dt;
    }
    const czasPomiaru = Math.max(1e-6, czas - 2);
    const tempo = sumaTempa / czasPomiaru;
    return { zbior, pelnyZaS: tempo > 0 ? 1 / tempo : Infinity, okres: j.okres.okresS };
}

console.log(''.padEnd(34) + ' ' + POLA.map(p => p.padEnd(20)).join(' ') + ' pełny za   okres');
for (const plik of readdirSync(KATALOG).filter(f => f.endsWith('.json')).sort()) {
    const dane = JSON.parse(readFileSync(join(KATALOG, plik), 'utf8'));
    const kroki = Object.entries(dane.kroki ?? {}).filter(([e]) => e.includes(filtr));
    if (!kroki.length) continue;
    console.log(`-- ${plik}`);
    for (const [etykieta, zapisane] of kroki) {
        const kl = zapisane.map(z => odtworzKlatke(z, dane));
        const { zbior, pelnyZaS, okres } = przepusc(kl);
        console.log(`${etykieta.padEnd(34)} ${POLA.map(p => kol(zbior[p])).join(' ')} ${(Number.isFinite(pelnyZaS) ? pelnyZaS.toFixed(1) + ' s' : '  —').padStart(8)}  ${okres.toFixed(2)} s`);
    }
}
