/**
 * Zawierucha - okno machnięć, głuchy czas, limit, samoczynny poryw, tor smug; bez document.
 *   node tools/test-zawierucha.mjs
 */
import { Zawierucha, NASTAWY, postepPrzejazdu, obwiedniaPorywu, pasPorywu, glowaSmugi, punktySmugi } from '../js/zawierucha.js';
import { NASTAWY as NASTAWY_MACHNIEC } from '../js/machniecie.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;
const SKALA = 0.1 * W;
const ZACZEP = { x: 960, y: 430, skala: 190 };

/** Klatka z nadgarstkiem prawej ręki w x (znorm.), lewa stoi. */
const zRekami = (xP) => {
    const f = klatka();
    f.pose.landmarks[15] = { x: 0.4, y: 0.6 };
    f.pose.landmarks[16] = { x: xP, y: 0.6 };
    return f;
};
/** Machnięcie prawą ręką w kierunku `kier` przez `sek`; reszta klatek - ręka stoi. */
function machnij(z, kier, sek, x0 = 0.5) {
    let x = x0;
    const v = (NASTAWY_MACHNIEC.PROG_PREDKOSCI + 3) * kier;
    for (let i = 0; i < Math.round(sek / DT); i++) { x += v * SKALA * DT / W; z.updateAndDraw(null, kontekst(zRekami(x)), DT); }
    return x;
}
const stoj = (z, sek, x = 0.5) => { for (let i = 0; i < Math.round(sek / DT); i++) z.updateAndDraw(null, kontekst(zRekami(x)), DT); };

console.log('CZYSTE FUNKCJE:');
spr('przejazd: 0 na starcie, 1 na końcu, ease-out (połowa czasu > połowa drogi)',
    postepPrzejazdu(0) === 0 && postepPrzejazdu(NASTAWY.CZAS_PRZEJAZDU) === 1 && postepPrzejazdu(NASTAWY.CZAS_PRZEJAZDU / 2) > 0.5);
spr('obwiednia porywu zero na końcach, NaN -> 0',
    obwiedniaPorywu(0) === 0 && obwiedniaPorywu(NASTAWY.ZYCIE_PORYWU) === 0 && obwiedniaPorywu(NaN) === 0 && obwiedniaPorywu(0.4) > 0.5);
const pas = pasPorywu(ZACZEP, H);
spr('pas poniżej barków, nie niżej niż DOL_EKRANU', pas.gora > ZACZEP.y && pas.dol <= H * NASTAWY.DOL_EKRANU + 1e-9 && pas.gora < pas.dol);
const blisko = pasPorywu({ x: 960, y: 900, skala: 400 }, H);
spr('gracz blisko kamery - pas ściśnięty dołem, ale niezerowy', blisko.dol - blisko.gora >= 400 * NASTAWY.MIN_WYSOKOSC_PASA - 1e-9);
const s = { u: 0.5, faza: 0 };
spr('smuga w prawo startuje za lewą krawędzią, kończy za prawą',
    glowaSmugi(s, 1, 0, ZACZEP, W, H).x < 0 && glowaSmugi(s, 1, NASTAWY.CZAS_PRZEJAZDU, ZACZEP, W, H).x > W);
spr('smuga w lewo - odwrotnie', glowaSmugi(s, -1, 0, ZACZEP, W, H).x > W && glowaSmugi(s, -1, NASTAWY.CZAS_PRZEJAZDU, ZACZEP, W, H).x < 0);
spr('przed startem smugi nic', glowaSmugi(s, 1, -0.01, ZACZEP, W, H) === null && punktySmugi(s, 1, -0.01, ZACZEP, W, H).length === 0);
const ogon = punktySmugi(s, 1, 0.4, ZACZEP, W, H);
spr('ogon ciągnie się ZA głową (w prawo -> ogon na lewo)', ogon.length === NASTAWY.PUNKTOW_OGONA + 1 && ogon.at(-1).x < ogon[0].x);

console.log('\nOKNO I MACHNIĘCIA:');
{
    const z = new Zawierucha();
    spr('bezczynna na starcie', !z.aktywny);
    z.zapal(0);
    spr('zapal(0) nic nie robi', !z.aktywny);
    z.zapal(1);
    spr('zapal() otwiera okno', z.aktywny && z.okno);
    machnij(z, 1, 0.2);
    spr('machnięcie w głuchym czasie - bez porywu', z._porywy.length === 0);
    stoj(z, 0.4);
    machnij(z, -1, 0.2);
    spr(`machnięcie po głuchym czasie - poryw w stronę ruchu (${z._porywy.map(p => p.kierunek)})`, z._porywy.length === 1 && z._porywy[0].kierunek === -1);
}
{
    const z = new Zawierucha();
    z.zapal(1);
    stoj(z, NASTAWY.GLUCHE_S + 0.05);
    let x = 0.5;
    const swiezeLacznie = [];
    for (let i = 0; i < 5; i++) {   // 5 machnięć tam i z powrotem, każde po przerwie ręki
        x = machnij(z, i % 2 ? -1 : 1, 0.1, x);
        swiezeLacznie.push(z.porywySwieze.length);
        stoj(z, NASTAWY_MACHNIEC.PRZERWA_REKI_S, x);
    }
    spr(`najwyżej ${NASTAWY.MAX_PORYWOW} porywy w oknie (${z._wypuszczone})`, z._wypuszczone === NASTAWY.MAX_PORYWOW);
    stoj(z, NASTAWY.OKNO_S);
    spr('po oknie - bez samoczynnego porywu, bo gracz machał', z._wypuszczone === NASTAWY.MAX_PORYWOW && !z.okno);
}

console.log('\nSAMOCZYNNY PORYW:');
{
    const z = new Zawierucha();
    z.zapal(1);
    let swiezy = null;
    for (let i = 0; i < Math.round((NASTAWY.OKNO_S + 0.1) / DT); i++) {
        z.updateAndDraw(null, kontekst(klatka()), DT);
        if (z.porywySwieze.length) swiezy = z.porywySwieze[0];
    }
    spr('bez machnięcia - po oknie jeden poryw', z._wypuszczone === 1 && !!swiezy);
    spr('poryw zna wysokość pasa (pod reakcje)', Number.isFinite(swiezy.yPasa) && swiezy.yPasa > H * 0.4);
    const k1 = swiezy.kierunek;
    z.zapal(1);
    przepusc(z, klatka(), NASTAWY.OKNO_S + 0.1);
    spr('następny samoczynny wieje z przeciwnej strony', z._porywy.at(-1).kierunek === -k1);
    przepusc(z, klatka(), NASTAWY.ZYCIE_PORYWU + 0.1);
    spr('gaśnie po ostatnim porywie', !z.aktywny);
    spr('porywySwieze żyją jedną klatkę', z.porywySwieze.length === 0);
}

console.log('\nPCHNIĘCIE DYMU:');
{
    const z = new Zawierucha();
    spr('bez porywu - pusto', z.punktyPchniecia().length === 0);
    z.zapal(1);
    przepusc(z, klatka(), NASTAWY.OKNO_S + 0.3);
    const pk = z.punktyPchniecia();
    const kier = z._porywy[0].kierunek;
    spr(`punkty czoła istnieją (${pk.length}) i są skończone`, pk.length > 0 && pk.every(q => [q.x, q.y, q.r, q.vx, q.vy, q.sila].every(Number.isFinite)));
    spr('prędkość w stronę porywu', pk.every(q => Math.sign(q.vx) === kier || q.vx === 0));
    spr(`siła słaba (<= ${NASTAWY.SILA_PCHNIECIA})`, pk.every(q => q.sila > 0 && q.sila <= NASTAWY.SILA_PCHNIECIA));
}

console.log('\nODPORNOŚĆ:');
{
    const z = new Zawierucha();
    z.zapal(1);
    let rzucil = false;
    try {
        przepusc(z, klatka({ barki: null }), NASTAWY.OKNO_S + 0.1);
        z.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60);
        z.updateAndDraw(atrapaCtx(), null, NaN);
        z.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1e9);
    } catch (e) { rzucil = e; }
    spr('brak pozy / atrapa ctx / NaN / ogromne dt - bez wyjątku', rzucil === false);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
