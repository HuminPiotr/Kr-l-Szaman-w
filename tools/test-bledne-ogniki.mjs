/**
 * Błędne Ogniki - narodziny z pasa ziemi, unoszenie, wygasanie, zarzewia, porwanie, Mgła; bez document.
 *   node tools/test-bledne-ogniki.mjs
 */
import { BledneOgniki, pasNarodzin, obwiedniaOgnika, migotanie, punktNaOrbicie, NASTAWY, CZAS_TRWANIA } from '../js/bledneOgniki.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;
const ZACZEP = { x: 960, y: 430, skala: 190 };

console.log('CZYSTE FUNKCJE:');
const pas = pasNarodzin(ZACZEP, H);
spr('pas narodzin pod barkami, nie niżej niż DOL_EKRANU', pas.gora > ZACZEP.y && pas.dol <= H * NASTAWY.DOL_EKRANU + 1e-9 && pas.gora < pas.dol);
const blisko = pasNarodzin({ x: 960, y: 900, skala: 400 }, H);
spr('gracz blisko kamery - pas ściśnięty, ale niezerowy', blisko.dol - blisko.gora >= 400 * NASTAWY.MIN_WYSOKOSC_PASA - 1e-9);
spr('obwiednia: 0 na końcach i dla NaN, pełna w środku',
    obwiedniaOgnika(0, 2) === 0 && obwiedniaOgnika(2, 2) === 0 && obwiedniaOgnika(NaN, 2) === 0 && obwiedniaOgnika(1, 2) === 1);
const mig = Array.from({ length: 200 }, (_, i) => migotanie(i * 0.01, 3));
spr('migotanie w 0.5..1 i faktycznie migocze', mig.every(v => v >= 0.5 - 1e-9 && v <= 1 + 1e-9) && Math.max(...mig) - Math.min(...mig) > 0.2);
const orb = { cx: 960, cy: 500, R: 300, squash: 0.28 };
const p = punktNaOrbicie(orb, Math.PI / 2);
spr('punkt na orbicie leży na elipsie', Math.abs(p.x - 960) < 1e-9 && Math.abs(p.y - (500 + 300 * 0.28)) < 1e-9);

console.log('\nCYKL ŻYCIA:');
const o = new BledneOgniki();
spr('bezczynne na starcie', !o.aktywny && o.punkty().length === 0);
o.zapal(0);
spr('zapal(0) nic nie robi', !o.aktywny);
o.zapal(1);
przepusc(o, klatka(), DT);
spr('pierwsza klatka - rodzi się pierwszy ognik, reszta czeka', o._ogniki.filter(g => Number.isFinite(g.x)).length === 1);
przepusc(o, klatka(), NASTAWY.LICZBA * NASTAWY.CO_S);
const zywe = o._ogniki.filter(g => Number.isFinite(g.x));
spr(`po ~${(NASTAWY.LICZBA * NASTAWY.CO_S).toFixed(1)} s wszystkie ${NASTAWY.LICZBA} narodzone (fala, nie ściana)`, zywe.length === NASTAWY.LICZBA);
const barkiY = 0.4 * H;
spr('rodzą się w pasie ziemi - pod barkami, nie niżej niż DOL_EKRANU',
    zywe.every(g => g.y > barkiY && g.y <= H * NASTAWY.DOL_EKRANU + 5));
const y0 = zywe.map(g => g.y);
przepusc(o, klatka(), 0.8);
spr('unoszą się (y maleje)', o._ogniki.every((g, i) => g.y < y0[i]));
spr('odpływają od środka ciała na boki', o._ogniki.every(g => g.kierunek !== 0));
spr('punkty() - widoczne ogniki ze skalą i jasnością', o.punkty().length === NASTAWY.LICZBA && o.punkty().every(q => q.skala > 0 && q.jasnosc > 0 && q.jasnosc <= 1));
const zr = o.zarzewia();
spr(`zarzewia() - jasne ogniki z promieniem > 0 (${zr.length})`, zr.length > 0 && zr.every(z => z.r > 0 && Number.isFinite(z.x) && Number.isFinite(z.y)));
przepusc(o, klatka(), CZAS_TRWANIA);
spr(`gasną po ~${CZAS_TRWANIA.toFixed(1)} s`, !o.aktywny && o.punkty().length === 0 && o.zarzewia().length === 0);

console.log('\nPORWANIE (Kurzawa) I MGŁA:');
{
    const g = new BledneOgniki();
    spr('nieaktywne: porwij() 0 i oznaczMgle() 0', g.porwij(orb) === 0 && g.oznaczMgle() === 0);
    g.zapal(1);
    przepusc(g, klatka(), 0.6);
    const orbita = { cx: 960, cy: 0.4 * H + 100, R: 1.45 * 0.1 * W, squash: 0.28, kierunek: 1, predkosc: 3.6 };
    const odlElipsy = (q) => Math.abs(Math.hypot((q.x - orbita.cx) / orbita.R, (q.y - orbita.cy) / (orbita.R * orbita.squash)) - 1);
    const przed = g.punkty().map(odlElipsy);
    spr(`porwij() liczy porwane PIERWSZY raz (${NASTAWY.LICZBA})`, g.porwij(orbita) === NASTAWY.LICZBA);
    spr('drugie porwij() - już porwane, 0 nowych', g.porwij(orbita) === 0);
    for (let i = 0; i < 40; i++) { g.porwij(orbita); g.updateAndDraw(null, kontekst(klatka()), DT); }
    const po = g.punkty().map(odlElipsy);
    spr('wir ściąga ogniki na orbitę (bliżej elipsy)', po.reduce((a, b) => a + b, 0) < przed.reduce((a, b) => a + b, 0) * 0.5);
    spr('zła orbita - 0, bez wyjątku', g.porwij({ cx: NaN }) === 0 && g.porwij(null) === 0);
    spr(`oznaczMgle() liczy wejścia raz (${NASTAWY.LICZBA}, potem 0)`, g.oznaczMgle() === NASTAWY.LICZBA && g.oznaczMgle() === 0);
    spr('wMgle ustawione do następnej klatki', g.wMgle === true);
    g.updateAndDraw(null, kontekst(klatka()), DT);
    spr('...i zużyte w niej (nie wisi)', g.wMgle === false);
}

console.log('\nODPORNOŚĆ:');
{
    const g = new BledneOgniki();
    g.zapal(1);
    let rzucil = false;
    try {
        przepusc(g, klatka({ barki: null }), 0.6);
        g.updateAndDraw(atrapaCtx(), kontekst(klatka()), DT);
        g.wMgle = true;
        g.updateAndDraw(atrapaCtx(), kontekst(klatka()), DT);
        g.updateAndDraw(atrapaCtx(), null, NaN);
        g.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1e9);
    } catch (e) { rzucil = e; }
    spr('brak pozy / atrapa ctx / NaN / ogromne dt - bez wyjątku', rzucil === false);
    const g2 = new BledneOgniki();
    g2.zapal(1);
    przepusc(g2, klatka({ barki: null }), 1);
    spr('bez pozy pozycje skończone', g2._ogniki.every(q => Number.isFinite(q.x) && Number.isFinite(q.y)));
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
