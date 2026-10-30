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

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');

const kwantyl = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '  - ').padStart(5);
const kol = (a) => (a.length ? `${f2(kwantyl(a, 0.5))} [${f2(kwantyl(a, 0.1))}..${f2(kwantyl(a, 0.9))}]` : '  brak danych'.padEnd(20));

function przepusc(klatki, siatka) {
    const z = new ZgodnoscRytmu(), tr = new Trans();
    const zg = [], sur = [], ak = [], siatki = {};
    let czas = 0, bezCzasu = 0, maxPoziom = 0;
    for (const k of klatki) {
        const rytm = Number.isFinite(k.czasPiesniS) ? { siatka, czasS: k.czasPiesniS } : null;
        if (!rytm) bezCzasu++;
        z.update(k.pose?.worldLandmarks ?? null, k.dt, rytm);
        tr.update(z.zgodnosc, k.dt);
        czas += k.dt;
        maxPoziom = Math.max(maxPoziom, tr.poziom);
        if (czas < 3) continue;   // rozgrzanie okna akcentów
        if (Number.isFinite(z.zgodnosc)) zg.push(z.zgodnosc);
        sur.push(z.surowa);
        ak.push(z._akcenty.length);
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
    console.log(`-- ${plik}  (${dane.piesn.tytul ?? dane.piesn.plik}, ${rytm.bpm} BPM)`);
    console.log(''.padEnd(28) + ' zgodność             surowa               akcentów   siatka  max poziom  koniec');
    for (const [etykieta, zapisane] of Object.entries(dane.kroki ?? {})) {
        const kl = zapisane.map(z => odtworzKlatke(z, dane));
        const r = przepusc(kl, siatka);
        const uwaga = r.bezCzasu > r.n * 0.1 ? `  ⚠ ${r.bezCzasu}/${r.n} klatek bez czasu pieśni` : '';
        console.log(`${etykieta.padEnd(28)} ${kol(r.zg)} ${kol(r.sur)} ${f2(kwantyl(r.ak, 0.5))}     ${r.siatka1.padEnd(6)} ${f2(r.maxPoziom)}      ${f2(r.koniec)}${uwaga}`);
    }
}
if (!cokolwiek) console.log('Brak nagrań sesji T (z czasem pieśni) w tools/probki/. Nagraj: w grze klawisz T.');
