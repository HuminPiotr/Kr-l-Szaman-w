/**
 * Fala przez ciało - opóźnienie jako UŁAMEK cyklu.
 *
 *   node tools/test-fala-ciala.mjs
 *
 * Wąż ramienia zmierzony na nagraniu właściciela (js/ruchy/falowanieRamion.js):
 * opóźnienie 0.04-0.13 s przy ~0.8 Hz, czyli ~5-10% cyklu; sztywne skrzydło 0.
 */
import { FalaCiala } from '../js/jakosc/fala.js';

// mulberry32 - patrz tools/test-plynnosc.mjs, dlaczego nie naiwny LCG.
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
let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const SIGMA = 0.009, FPS = 30, DT = 1 / FPS, U = 0.28, F = 0.26;

/** katy(t) -> [ramię, przedramię] w rad (0 = poziomo w bok, + = w górę) - geometria z tools/pomiar-falowania.mjs */
function przebieg(katy, f, { c2d = () => null, pewnosc = 0.9, sekund = 8, ramiona = true } = {}) {
    const m = new FalaCiala();
    const okres = { okresS: 1 / f, pewnosc };
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: ramiona ? 1 : 0 }));
        if (ramiona) {
            for (const [bark, lok, nad, kier] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
                const [ku, kf] = katy(t);
                const B = { x: 0.18 * kier, y: -0.45 };
                const E = { x: B.x + kier * U * Math.cos(ku), y: B.y - U * Math.sin(ku) };
                const W = { x: E.x + kier * F * Math.cos(kf), y: E.y - F * Math.sin(kf) };
                for (const [id, p] of [[bark, B], [lok, E], [nad, W]]) {
                    w[id] = { x: p.x + SIGMA * gauss(), y: p.y + SIGMA * gauss(), z: 0, visibility: 1 };
                }
            }
        }
        m.update(w, c2d(t), okres, DT);
    }
    return m;
}

const waz = (f) => { const om = 2 * Math.PI * f; return (t) => [0.35 * Math.sin(om * t), 0.5 * Math.sin(om * t - 0.6)]; };
const skrzydlo = (f) => { const om = 2 * Math.PI * f; return (t) => { const k = 0.4 * Math.sin(om * t); return [k, k]; }; };

const w08 = przebieg(waz(0.8), 0.8);
const w16 = przebieg(waz(1.6), 1.6);
const s08 = przebieg(skrzydlo(0.8), 0.8);
const opis = (m) => `${m.fala === null ? 'null' : m.fala.toFixed(2)} (${m.diagnostyka.lancuch}, opóźn ${((m.diagnostyka.opoznienieUlamek ?? 0) * 100).toFixed(0)}% cyklu, kor ${(m.diagnostyka.korelacja ?? 0).toFixed(2)})`;
console.log(`  wąż 0.8 Hz:     ${opis(w08)}`);
console.log(`  wąż 1.6 Hz:     ${opis(w16)}`);
console.log(`  skrzydło 0.8:   ${opis(s08)}`);

spr('wąż daje wysoką falę (> 0.5)', w08.fala > 0.5);
spr('sztywne skrzydło daje ~0 (< 0.1)', s08.fala !== null && s08.fala < 0.1);
spr('ten sam wąż wolno i szybko - podobny wynik (różnica < 0.15)', Math.abs(w08.fala - w16.fala) < 0.15);

{
    const om = 2 * Math.PI * 0.8;
    const m = przebieg(() => [0, 0], 0.8, {
        ramiona: false,
        c2d: (t) => ({ biodra: { x: 0.3 * Math.sin(om * t), y: 0 }, dlonieX: 0.6 * Math.sin(om * t - 0.6) })
    });
    console.log(`  biodra -> dłonie: ${opis(m)}`);
    spr('fala z bioder do dłoni bez widocznych ramion (> 0.5, łańcuch biodraDlonie)', m.fala > 0.5 && m.diagnostyka.lancuch === 'biodraDlonie');
}
{
    const m = przebieg(waz(0.8), 0.8, { pewnosc: 0 });
    spr('okres niepewny -> fala null (neutralnie, nie zero)', m.fala === null);
}
{
    const m = przebieg(waz(0.8), 0.8);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 1 }));
    for (let i = 0; i < 30; i++) m.update(zle, { biodra: { x: NaN, y: NaN }, dlonieX: NaN }, { okresS: NaN, pewnosc: NaN }, DT);
    m.update(null, null, null, 0);
    spr('NaN nie zatruwa fali', m.fala === null || Number.isFinite(m.fala));
}

process.exit(ok ? 0 : 1);
