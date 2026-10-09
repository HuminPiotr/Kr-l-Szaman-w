/**
 * Dodola (js/deszcz.js) - liczba kropel, trafienia w maskę, rozpryski, sufity, NaN; bez document.
 *   node tools/test-deszcz.mjs
 */
import { Dodola, NASTAWY as N, liczbaKropel, trafienieWMaske, pierwszeTrafienie } from '../js/deszcz.js';
import { klatka, kontekst, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;

// Syntetyczna sylwetka: maska 192×108 (1/10 płótna), fit 1:1 na całe płótno.
// "Ramiona" = poziomy pas przez cały kadr na wysokości 0.4 H, gruby na 4 piksele maski (40 px).
const SZ = 192, WY = 108;
const FIT = { offsetX: 0, offsetY: 0, scaledW: W, scaledH: H };
const maskaPasa = () => {
    const m = new Uint8Array(SZ * WY);
    for (let y = 42; y < 46; y++) for (let x = 0; x < SZ; x++) m[y * SZ + x] = 255;
    return m;
};
const kontekstZMaska = (maska) => ({ ...kontekst(klatka()), maska, maskaSzer: SZ, maskaWys: WY, fit: FIT });

console.log('CZYSTE FUNKCJE:');
spr('liczbaKropel(0) = KROPLI_MIN', liczbaKropel(0) === N.KROPLI_MIN);
spr('liczbaKropel(1) = KROPLI_MAX', liczbaKropel(1) === N.KROPLI_MAX);
spr('liczbaKropel rośnie z natężeniem', liczbaKropel(0.3) < liczbaKropel(0.6) && liczbaKropel(0.6) < liczbaKropel(0.9));
spr('liczbaKropel(NaN) = KROPLI_MIN', liczbaKropel(NaN) === N.KROPLI_MIN);
const m = maskaPasa();
spr('trafienie w pas (wiersze maski 42-45 = 420-459 px)', trafienieWMaske(500, 440, m, SZ, WY, FIT));
spr('pudło nad pasem', !trafienieWMaske(500, 0.2 * H, m, SZ, WY, FIT));
spr('poza maską = pudło, nie wyjątek', !trafienieWMaske(-50, 0.43 * H, m, SZ, WY, FIT) && !trafienieWMaske(5000, 5000, m, SZ, WY, FIT));
spr('bez maski / fit / NaN = pudło', !trafienieWMaske(500, 460, null, SZ, WY, FIT) &&
    !trafienieWMaske(500, 460, m, SZ, WY, null) && !trafienieWMaske(NaN, 460, m, SZ, WY, FIT));
const p = pierwszeTrafienie(500, 0.3 * H, 500, 0.5 * H, m, SZ, WY, FIT);
spr('przelot przez cienki pas w jednej klatce jest wykryty', !!p && p.y >= 420 && p.y < 420 + N.KROK_PROBKOWANIA + 1);
spr('przelot obok pasa = brak trafienia', pierwszeTrafienie(500, 0.1 * H, 500, 0.3 * H, m, SZ, WY, FIT) === null);

console.log('\nCYKL DESZCZU:');
{
    const d = new Dodola();
    d.updateAndDraw(atrapaCtx(), kontekst(klatka()), DT);
    spr('bez zapalenia: nieaktywny, zero kropel', !d.aktywny && d.diagnostyka.krople === 0);
    d.zapal();
    d.wymusJakosc = 1;
    for (let i = 0; i < 240; i++) { d.update(klatka(), 1, DT); d.updateAndDraw(null, kontekst(klatka()), DT); }
    const ulewa = d.diagnostyka.krople;
    spr(`ulewa po 4 s dobrej fali: dużo kropel (${ulewa}), nie więcej niż KROPLI_MAX`, ulewa > 300 && ulewa <= N.KROPLI_MAX);
    d.wymusJakosc = 0;
    for (let i = 0; i < 240; i++) { d.update(klatka(), 1, DT); d.updateAndDraw(null, kontekst(klatka()), DT); }
    spr(`zła fala przez 4 s -> mżawka: mało kropel (${d.diagnostyka.krople})`, d.diagnostyka.krople < 60);
    let rzucil = false;
    try { d.updateAndDraw(atrapaCtx(), kontekstZMaska(maskaPasa()), DT); } catch (e) { rzucil = e; }
    spr('rysowanie (atrapa ctx, z maską) nie rzuca', !rzucil);
}

console.log('\nROZPRYSKI NA CIELE:');
{
    const d = new Dodola();
    d.zapal();
    d.wymusJakosc = 1;
    const k = kontekstZMaska(maskaPasa());
    let rozpryskow = 0, maxNaKlatke = 0, ponizejPasa = 0;
    for (let i = 0; i < 180; i++) {
        d.update(klatka(), 1, DT);
        d.updateAndDraw(null, k, DT);
        rozpryskow += d.rozpryskiKlatki;
        maxNaKlatke = Math.max(maxNaKlatke, d.rozpryskiKlatki);
    }
    // Tylko tam, gdzie pas przecinały WEWNĄTRZ kadru: przy skosie 15° kropla przesuwa się
    // o ~160 px w x między pasem a dołem, a krople startują też na lewo od kadru (pod wiatr).
    for (const c of d._krople) if (c.tyl && c.x > 200 && c.x < W && c.y > 0.47 * H && c.y < 0.97 * H) ponizejPasa++;
    spr(`krople rozbijają się o sylwetkę (${rozpryskow} rozprysków w 3 s)`, rozpryskow > 100);
    spr(`sufit rozprysków na klatkę (${maxNaKlatke} <= ${N.ROZPRYSKOW_NA_KLATKE})`, maxNaKlatke <= N.ROZPRYSKOW_NA_KLATKE);
    spr(`kropelek nie więcej niż MAX_KROPELEK (${d.diagnostyka.kropelki})`, d.diagnostyka.kropelki <= N.MAX_KROPELEK);
    spr(`krople z tyłu nie przelatują przez ciało (${ponizejPasa} pod pasem w środku kadru)`, ponizejPasa === 0);
    const frontPonizej = d._krople.filter(c => !c.tyl && c.y > 0.5 * H).length;
    spr(`krople z przodu spadają przed ciałem dalej (${frontPonizej})`, frontPonizej > 0);
    const wGore = d._kropelki.filter(p => p.vy < 0).length;
    spr('część kropelek leci w górę (odbicie)', wGore > 0);
}

console.log('\nKONIEC:');
{
    const d = new Dodola();
    d.zapal();
    d.wymusJakosc = 1;
    for (let i = 0; i < 240; i++) { d.update(klatka(), 1, DT); d.updateAndDraw(null, kontekst(klatka()), DT); }
    d.zaklinanie.stan = 'BEZCZYNNY';
    for (let i = 0; i < 120; i++) { d.update(klatka(), 1, DT); d.updateAndDraw(null, kontekst(klatka()), DT); }
    spr('po końcu zaklinania krople dopadają i znikają', !d.aktywny && d.diagnostyka.krople === 0);
    spr('natężenie przy bezczynnym = 0', d.natezenie === 0);
}

console.log('\nODPORNOŚĆ:');
{
    const d = new Dodola();
    d.zapal();
    let rzucil = false;
    try {
        for (let i = 0; i < 30; i++) {
            d.update(null, NaN, NaN);
            d.updateAndDraw(atrapaCtx(), { W, H, frame: null }, NaN);
            d.updateAndDraw(null, null, DT);
        }
    } catch (e) { rzucil = e; }
    spr('NaN / brak klatki / brak kontekstu nie rzuca', !rzucil);
    spr('mżawka bez ciała: natężenie z podłogi', d.natezenie > 0 && d.natezenie < 0.2);
}

process.exit(ok ? 0 : 1);
