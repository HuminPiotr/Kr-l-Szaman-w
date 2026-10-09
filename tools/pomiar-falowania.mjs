/**
 * Pomiar falowania ramion - eksperyment (zaklinanie deszczu, 2026-10-09).
 *
 *   node tools/pomiar-falowania.mjs            # syntetyki + wszystkie nagrania
 *   node tools/pomiar-falowania.mjs --syntetyki
 *
 * NIE jest testem (nic tu nie pada na czerwono) - drukuje rozkład surowych
 * składników js/ruchy/falowanieRamion.js dla każdej próbki, żeby zobaczyć,
 * czy fala wężowa / sztywna / niedbała dają się rozdzielić. Syntetyki tylko
 * sprawdzają, że sonda liczy to, co miała - o tym, czy działa, decydują
 * nagrania z sesji F (js/nagrywanie/sesja.js: SCENARIUSZ_FALOWANIE).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { FalowanieRamion } from '../js/ruchy/falowanieRamion.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const POLA = ['rozpostarcie', 'amplituda', 'zgiecie', 'opoznienie', 'korelacja', 'gladkosc'];

// --- statystyka ---
const kwantyl = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '  - ').padStart(5);

function przepusc(klatki) {
    const m = new FalowanieRamion();
    const wyniki = [];
    for (const k of klatki) {
        const r = m.update(k.pose?.worldLandmarks ?? null, k.dt);
        if (r.laczne) wyniki.push(r.laczne);
    }
    return wyniki;
}

function wiersz(nazwa, wyniki, liczbaKlatek) {
    if (!wyniki.length) return `${nazwa.padEnd(34)} brak pomiaru (${liczbaKlatek} kl.)`;
    // mediana [p10..p90] - szerokość mówi tyle samo co środek
    const kom = POLA.map(p => {
        const a = wyniki.map(w => w[p]);
        return `${f2(kwantyl(a, 0.5))} [${f2(kwantyl(a, 0.1))}..${f2(kwantyl(a, 0.9))}]`;
    });
    return `${nazwa.padEnd(34)} ${kom.join('  ')}`;
}

function naglowek() {
    console.log(''.padEnd(34) + ' ' + POLA.map(p => p.padEnd(20)).join('  '));
}

// --- syntetyki ---
let ziarno = 7;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => {
    const u = losowa() || 1e-9, v = losowa();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const FPS = 30, SIGMA = 0.009, U = 0.28, F = 0.26;

/** katy(t) -> [ramię, przedramię] w rad, 0 = poziomo w bok, + = w górę */
function syntetyk(katy, sekund = 10) {
    const klatki = [];
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i / FPS;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
        for (const [bark, lok, nad, kier] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
            const [ku, kf] = katy(t, kier);
            const B = { x: 0.18 * kier, y: -0.45 };
            const E = { x: B.x + kier * U * Math.cos(ku), y: B.y - U * Math.sin(ku) };
            const W = { x: E.x + kier * F * Math.cos(kf), y: E.y - F * Math.sin(kf) };
            for (const [id, p] of [[bark, B], [lok, E], [nad, W]]) {
                w[id] = { x: p.x + SIGMA * gauss(), y: p.y + SIGMA * gauss(), z: 0, visibility: 1 };
            }
        }
        klatki.push({ pose: { worldLandmarks: w }, dt: 1 / FPS });
    }
    return klatki;
}

const om = 2 * Math.PI * 0.8;
const ostry = (x, k) => Math.sign(x) * Math.pow(Math.abs(x), 1 / k);
let cel = [0, 0], doZmiany = 0;
const niedbale = (t) => {
    if (t >= doZmiany) { cel = [0.15 * (losowa() - 0.5), 0.25 * (losowa() - 0.5)]; doZmiany = t + 0.1 + 0.3 * losowa(); }
    return cel;
};

const SYNTETYKI = [
    ['syn: wąż (przedramię spóźnione)', (t) => [0.35 * Math.sin(om * t), 0.5 * Math.sin(om * t - 0.9)]],
    ['syn: skrzydło (sztywne)',         (t) => { const k = 0.4 * Math.sin(om * t); return [k, k]; }],
    ['syn: skrzydło szarpane',          (t) => { const k = 0.4 * ostry(Math.sin(om * t), 5); return [k, k]; }],
    ['syn: byle jak (zrywy)',           niedbale],
    ['syn: bez ruchu',                  () => [0, 0]],
    ['syn: wąż, ramiona opuszczone',    (t) => [-1.3 + 0.2 * Math.sin(om * t), -1.3 + 0.3 * Math.sin(om * t - 0.9)]]
];

console.log('\n=== SYNTETYKI (szum sigma 0.009 m, 30 FPS) - mediana [p10..p90] ===');
naglowek();
for (const [nazwa, katy] of SYNTETYKI) {
    const kl = syntetyk(katy);
    console.log(wiersz(nazwa, przepusc(kl), kl.length));
}

// --- nagrania ---
if (!process.argv.includes('--syntetyki')) {
    console.log('\n=== NAGRANIA z tools/probki/ ===');
    naglowek();
    for (const plik of readdirSync(KATALOG).filter(f => f.endsWith('.json')).sort()) {
        const dane = JSON.parse(readFileSync(join(KATALOG, plik), 'utf8'));
        console.log(`-- ${plik}`);
        for (const [etykieta, zapisane] of Object.entries(dane.kroki)) {
            const kl = zapisane.map(z => odtworzKlatke(z, dane));
            console.log(wiersz('  ' + etykieta, przepusc(kl), kl.length));
        }
    }
}
