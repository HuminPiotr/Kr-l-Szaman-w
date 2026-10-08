/**
 * Mgła Mokoszy - przetaczanie się przez kadr, zwalnianie przy sylwetce; bez document.
 *   node tools/test-mgla-mokoszy.mjs
 */
import { MglaMokoszy, obwiednia, predkoscKlebu, jasnoscBlysku, CZAS_TRWANIA, NASTAWY } from '../js/mglaMokoszy.js';
import { klatka, kontekst, przepusc, atrapaCtx, W } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('PRĘDKOŚĆ KŁĘBU:');
const daleko = predkoscKlebu(0, 1000, 500, 200), blisko = predkoscKlebu(1000, 1000, 500, 200);
spr('daleko od sylwetki - pełna prędkość', Math.abs(daleko - 500) < 1e-9);
spr('przy sylwetce zwalnia (gęstnieje), ale nie staje', blisko < daleko && blisko >= 500 * NASTAWY.ZWOLNIENIE - 1e-9);
spr('kierunek zachowany (ujemna v0)', predkoscKlebu(1000, 1000, -500, 200) < 0);
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const m = new MglaMokoszy();
m.zapal(1); m.zapal(1);
przepusc(m, klatka(), 1 / 60);
spr(`kłęby rodzą się przy pierwszej klatce (${NASTAWY.LICZBA}), restart nie podwaja`, m._kleby.length === NASTAWY.LICZBA);
const startX = m._kleby.map(k => k.x);
spr('wszystkie startują POZA kadrem z jednej strony', startX.every(x => x < 0) || startX.every(x => x > W));
przepusc(m, klatka(), 3);
spr('po kilku sekundach mgła jest w kadrze', m._kleby.some(k => k.x > 0 && k.x < W));
przepusc(m, klatka({ barki: null }), 0.2);
spr('poza znika - pozycje skończone', m._kleby.every(k => Number.isFinite(k.x) && Number.isFinite(k.y)));
let rzucil = false;
try { m.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez assetów i document) nie rzuca', rzucil === false);
przepusc(m, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', m.aktywny === false);

console.log('\nDZIURA (reakcja z Grzmotem):');
{
    const md = new MglaMokoszy();
    spr('nieaktywna: rozepchnij() false', md.rozepchnij({ x: 1, y: 1 }, 1) === false);
    md.zapal(1);
    przepusc(md, klatka(), 4);
    const widoczne = md._kleby.filter(k => k.wiek >= 0);
    const c = widoczne[0];
    const zrodlo = { x: c.x - 50, y: c.y };   // kłąb na prawo od wybuchu
    spr('rozepchnij() trafia kłąb w zasięgu', md.rozepchnij(zrodlo, 1) === true);
    spr('kłąb dostaje impuls OD źródła (w prawo)', c.vxDod > 0);
    const v0 = c.vxDod;
    przepusc(md, klatka(), 1);
    spr('impuls wygasa (dziura się domyka)', c.vxDod < v0 * 0.25);
    spr('rozepchnij(NaN) false, pozycje skończone', md.rozepchnij({ x: NaN, y: 1 }, 1) === false && md._kleby.every(k => Number.isFinite(k.x) && Number.isFinite(k.y)));
    spr('daleki wybuch nie trafia', md.rozepchnij({ x: -1e6, y: -1e6 }, 1) === false);
}

console.log('\nZNIESIENIE (reakcja z Zawieruchą):');
{
    const mz = new MglaMokoszy();
    spr('nieaktywna: znies() false', mz.znies(1, 1, 500) === false);
    mz.zapal(1);
    przepusc(mz, klatka(), 4);
    const c = mz._kleby.find(k => k.wiek >= 0);
    const v0 = c.vxDod;
    spr('znies(-1) trafia kłąb na wysokości pasa', mz.znies(-1, 1, c.y) === true);
    spr('kłąb dostaje impuls w stronę wiatru', c.vxDod < v0);
    spr('pas daleko w pionie - nie sięga', mz.znies(1, 1, c.y + 1e6) === false);
    spr('zły kierunek - false', mz.znies(0, 1, c.y) === false && mz.znies(NaN, 1, c.y) === false);
}

console.log('\nLATARNIE (reakcja z Błędnymi Ognikami):');
{
    const ml = new MglaMokoszy();
    spr('nieaktywna: podswietl() false', ml.podswietl([{ x: 1, y: 1, jasnosc: 1 }]) === false);
    ml.zapal(1);
    przepusc(ml, klatka(), 1);
    spr('aktywna: podswietl() przyjmuje dobre punkty, pomija zepsute',
        ml.podswietl([{ x: 500, y: 500, jasnosc: 1 }, { x: NaN, y: 1 }, null]) === true && ml._latarnie.length === 1);
    spr('same zepsute punkty - false', ml.podswietl([{ x: NaN, y: 1 }]) === false);
    ml.podswietl([{ x: 500, y: 500, jasnosc: 2 }]);
    spr('jasność przycięta do 1', ml._latarnie[0].jasnosc === 1);
    let rzucil = false;
    try { ml.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
    spr('rysowanie z latarniami nie rzuca', rzucil === false);
}

console.log('\nBŁYSK W MGLE (reakcja Burza w mgle):');
{
    spr('jasność 1 przy źródle, maleje z odległością, 0 daleko',
        jasnoscBlysku(0, 200) === 1 && jasnoscBlysku(200, 200) < 1 && jasnoscBlysku(200, 200) > jasnoscBlysku(500, 200) && jasnoscBlysku(1e6, 200) === 0);
    const mb = new MglaMokoszy();
    spr('nieaktywna: rozblysk() false', mb.rozblysk({ x: 1, y: 1 }, 1) === false);
    mb.zapal(1);
    przepusc(mb, klatka(), 0.5);
    spr('zły punkt -> false, bez wyjątku', mb.rozblysk(null, 1) === false && mb.rozblysk({ x: NaN, y: 0 }, 1) === false);
    spr('rozblysk() -> true', mb.rozblysk({ x: 960, y: 500 }, 1) === true && mb._blysk !== null);
    przepusc(mb, klatka(), NASTAWY.BLYSK_ZYCIE + 0.02);
    spr('błysk gaśnie po BLYSK_ZYCIE', mb._blysk === null);
    mb.rozblysk({ x: 960, y: 500 }, 1);
    let rzucilB = false;
    try { mb.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucilB = e; }
    spr('rysowanie z błyskiem nie rzuca', rzucilB === false);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
