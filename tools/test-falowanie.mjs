/**
 * Miara falowania ramion NA NAGRANIU ŻYWEGO CIAŁA (Dodola).
 *   node tools/test-falowanie.mjs
 *
 * Strażnik progów jakoscFali(): fala wężowa właściciela ma dawać ulewę,
 * sztywne skrzydło i niedbałe ruchy kilka kropel, bez ruchu i taniec nic.
 * Zmiana NASTAW, która to psuje, ma się wywalić tutaj, a nie dopiero na kamerze.
 * Nagranie: sesja F (js/nagrywanie/sesja.js SCENARIUSZ_FALOWANIE).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { FalowanieRamion, jakoscFali, wezowosc } from '../js/ruchy/falowanieRamion.js';
import { ZnakRegistry } from '../js/znaki/registry.js';
import { resetSkali, aktualizujSkale } from '../js/znaki/postawa.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { weles } from '../js/znaki/weles.js';
import { perun } from '../js/znaki/perun.js';
import { stribog } from '../js/znaki/stribog.js';
import { mokosz } from '../js/znaki/mokosz.js';
import { SkladaniePieczeci } from '../js/pieczecie.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const PLIK = join(dirname(fileURLToPath(import.meta.url)), 'probki', 'probki-2026-10-09-14-18-46.json');
const dane = JSON.parse(readFileSync(PLIK, 'utf8'));

const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

/** Mediana jakości z klatek, w których miara już coś orzekła (okno pełne). */
function jakoscProbki(etykieta) {
    const m = new FalowanieRamion();
    const q = [];
    for (const z of dane.kroki[etykieta] ?? []) {
        const k = odtworzKlatke(z, dane);
        const r = m.update(k.pose?.worldLandmarks ?? null, k.dt);
        if (r.laczne) q.push(jakoscFali(r.laczne));
    }
    return { mediana: mediana(q), n: q.length };
}

console.log('NAGRANIE (mediana jakości):');
const progi = [
    ['falowanie-wezowe', [1, 2, 3], (v) => v >= 0.5, '>= 0.5'],
    ['falowanie-sztywne', [1, 2, 3], (v) => v <= 0.35, '<= 0.35'],
    ['falowanie-niedbale', [1, 2, 3], (v) => v <= 0.3, '<= 0.3'],
    ['rozpostarte-bez-ruchu', [1], (v) => v <= 0.05, '<= 0.05'],
    ['taniec-falowanie', [1], (v) => v <= 0.05, '<= 0.05']
];
for (const [id, nry, warunek, opis] of progi) {
    for (const nr of nry) {
        const { mediana: v, n } = jakoscProbki(`${id}#${nr}`);
        spr(`${id}#${nr}: ${v.toFixed(2)} ${opis} (${n} kl.)`, n > 50 && warunek(v));
    }
}
// Najważniejsza relacja: najsłabszy wąż wyraźnie ponad najlepszym skrzydłem.
const najslabszyWaz = Math.min(...[1, 2, 3].map(n => jakoscProbki(`falowanie-wezowe#${n}`).mediana));
const najlepszeSkrzydlo = Math.max(...[1, 2, 3].map(n => jakoscProbki(`falowanie-sztywne#${n}`).mediana));
spr(`najsłabszy wąż (${najslabszyWaz.toFixed(2)}) >= 2× najlepsze skrzydło (${najlepszeSkrzydlo.toFixed(2)})`,
    najslabszyWaz >= 2 * najlepszeSkrzydlo);

// Dodola trzyma silnik pieczęci włączony przez całe falowanie (do 20 s).
// Przypadkowy stribog po deszczu uzbroiłby Aarda (stribog×2), a machnięcie
// by go odpaliło - falowanie NIE może składać pieczęci. Zmierzone 2026-10-09:
// zero złożeń, pierścień najwyżej 0.17 (perun przy szerokim skrzydle).
console.log('\nFALOWANIE NIE SKŁADA PIECZĘCI (prawdziwy silnik):');
for (const etykieta of Object.keys(dane.kroki).filter(e => e.startsWith('falowanie-') || e.startsWith('rozpostarte-'))) {
    resetSkali();
    const r = new ZnakRegistry();
    for (const z of [swarogDlon, weles, perun, stribog, mokosz]) r.zarejestruj(z);
    const sk = new SkladaniePieczeci();
    const zlozone = [];
    let maxPostep = 0;
    for (const z of dane.kroki[etykieta]) {
        const f = odtworzKlatke(z, dane);
        aktualizujSkale(f.pose?.worldLandmarks ?? null, f.dt);
        const o = sk.update(r.ocen(f), 1, f.dt);
        if (o.skladana) maxPostep = Math.max(maxPostep, o.postep);
        if (o.zlozona) zlozone.push(o.zlozona.id);
    }
    spr(`${etykieta}: 0 pieczęci (pierścień max ${maxPostep.toFixed(2)})`, zlozone.length === 0);
}

console.log('\nODPORNOŚĆ:');
spr('jakoscFali(null) = 0', jakoscFali(null) === 0);
spr('jakoscFali z NaN = 0', jakoscFali({ rozpostarcie: NaN, amplituda: 1, korelacja: 1, zgiecie: 1, opoznienie: 1 }) === 0);
spr('wezowosc({}) = 0', wezowosc({}) === 0);
const m = new FalowanieRamion();
spr('update(null) nie rzuca, laczne = null', m.update(null, 1 / 30).laczne === null);
spr('update z dt = 0 / NaN nie rzuca', m.update([], 0).laczne === null && m.update([], NaN).laczne === null);
const zNaN = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: 0, visibility: 1 }));
spr('punkty NaN -> brak pomiaru, nie NaN', m.update(zNaN, 1 / 30).laczne === null);
m.reset();
spr('reset() czyści okno', m._bufor.every(b => b.length === 0));

process.exit(ok ? 0 : 1);
