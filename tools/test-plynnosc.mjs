/**
 * Miara płynności ruchu.
 *
 *   node tools/test-plynnosc.mjs
 *
 * Każdy test pilnuje konkretnej pułapki, w którą prostsza wersja wpadała.
 * Wszystkie sygnały są zaszumione tak jak prawdziwy tracking (sigma dobrana
 * pod zmierzone ~0.07 m/s przy nieruchomym staniu) - bez szumu każda z tych
 * miar wygląda na działającą.
 */
import { Plynnosc } from '../js/plynnosc.js';

const F = 60, DT = 1 / F, SEKUND = 12, N = Math.round(SEKUND * F);
const SIGMA = 0.009;

// mulberry32 - liczy na Math.imul, więc mieści się w 32 bitach.
// Naiwny LCG (stan * 1103515245) daje ~2^61, czyli grubo ponad
// Number.MAX_SAFE_INTEGER; po tysiącach wywołań traci precyzję i zaczyna
// produkować SKORELOWANE ciągi, które miara słusznie bierze za ruch.
// Test szumu musi mieć naprawdę nieskorelowany szum, inaczej niczego nie dowodzi.
let ziarno = 42;
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

const SLEDZONE = [15, 16, 13, 14, 27, 28];

/** Kołysanie o regulowanej ostrości zwrotu. k=1 sinus, wyższe k = ostrzejszy zwrot. */
const kolysanie = (k) => (t) => {
    const x = Math.sin(2 * Math.PI * t);
    return [0.3 * Math.sign(x) * Math.pow(Math.abs(x), 1 / k), 0];
};

const TORY = {
    'okrąg 1Hz':          t => [0.25 * Math.cos(2*Math.PI*t), 0.25 * Math.sin(2*Math.PI*t)],
    'ósemka gładka':      t => [0.3 * Math.sin(2*Math.PI*t), 0.15 * Math.sin(4*Math.PI*t)],
    'kołysanie gładkie':  kolysanie(1),
    'kołysanie szarpane': kolysanie(8),
    'wyrzut-stop':        t => { const u = t % 0.8;
                                 return [u < 0.18 ? 0.35*(1-Math.cos(Math.PI*u/0.18))/2 : 0.35, 0]; },
    'bezruch':            () => [0, 0],
};

function przebieg(tor) {
    const m = new Plynnosc();
    for (let i = 0; i < N; i++) {
        const [x, y] = tor(i * DT);
        const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        for (const j of SLEDZONE) {
            lm[j] = { x: x + gauss()*SIGMA, y: y + gauss()*SIGMA, z: 0, visibility: 0.9 };
        }
        m.update(lm, DT);
    }
    return m;
}

const w = {};
console.log('tor'.padEnd(22) + 'szarpnięcie'.padStart(12) + 'płynność'.padStart(10) + '  stawów');
console.log('-'.repeat(54));
for (const [nazwa, tor] of Object.entries(TORY)) {
    const m = przebieg(tor);
    w[nazwa] = m;
    console.log(nazwa.padEnd(22) + m.szarpniecie.toFixed(1).padStart(12) +
                m.plynnosc.toFixed(2).padStart(10) + String(m.aktywnychStawow).padStart(8));
}

console.log();
let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// 1. Okrąg ma DUŻE przyspieszenie (dośrodkowe), a jest wzorcem płynności.
//    Obala miarę "mało przyspieszenia = płynnie".
spr(`okrąg ze stałą prędkością jest najpłynniejszy (${w['okrąg 1Hz'].plynnosc.toFixed(2)})`,
    w['okrąg 1Hz'].plynnosc > 0.85);

// 2. Kołysanie: |v| przechodzi przez ZERO dokładnie tam, gdzie |a_t| jest
//    największe. Normalizacja przez prędkość chwilową tu eksploduje.
spr(`gładkie kołysanie jest płynne (${w['kołysanie gładkie'].plynnosc.toFixed(2)})`,
    w['kołysanie gładkie'].plynnosc > 0.65);

// 3. Rozdział. Uwaga: ŚREDNIA(|a_t|)/ŚREDNIA(|v|) dawała tu ranking ODWROTNY
//    (gładkie 6.3 vs szarpane 3.7), bo średnia nie widzi skupienia w czasie.
const rozdzial = w['kołysanie szarpane'].szarpniecie / w['kołysanie gładkie'].szarpniecie;
spr(`szarpane kołysanie wyraźnie mniej płynne niż gładkie (${rozdzial.toFixed(1)}x)`,
    rozdzial > 2.5);
spr(`ta sama trajektoria, tylko ostrzejszy zwrot: ${w['kołysanie gładkie'].plynnosc.toFixed(2)} -> ${w['kołysanie szarpane'].plynnosc.toFixed(2)}`,
    w['kołysanie szarpane'].plynnosc < w['kołysanie gładkie'].plynnosc - 0.3);

// 4. Wyrzut i zatrzymanie to wzorzec "machania", który ma się wyraźnie odciąć.
spr(`wyrzut-stop mało płynny (${w['wyrzut-stop'].plynnosc.toFixed(2)})`,
    w['wyrzut-stop'].plynnosc < 0.35);

// 5. Sam szum przy bezruchu NIE jest szarpaniem - waga prędkości ma go wyciszyć.
//    Bez tego stanie w miejscu dawało wyższy wynik niż jakikolwiek prawdziwy ruch.
spr(`bezruch nie głosuje (${w['bezruch'].aktywnychStawow} aktywnych stawów)`,
    w['bezruch'].aktywnychStawow === 0);
spr(`bezruch nie jest karany - płynność zostaje wysoka (${w['bezruch'].plynnosc.toFixed(2)})`,
    w['bezruch'].plynnosc > 0.85);

// 6. Odporność na zepsute dane
const m = new Plynnosc();
const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
for (let i = 0; i < 30; i++) m.update(zle, DT);
spr('klatki z NaN nie psują płynności', Number.isFinite(m.plynnosc) && m.plynnosc > 0.85);
m.update(null, DT);
spr('brak ciała w kadrze nie psuje płynności', Number.isFinite(m.plynnosc));

process.exit(ok ? 0 : 1);
