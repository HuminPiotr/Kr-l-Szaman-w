/**
 * js/sledzenie.js - zaczepy technik śledzących ciało, bez document.
 *   node tools/test-sledzenie.mjs
 */
import { dlonieKlatki, barkiKlatki, Kotwica, TozsamoscDloni, TOZSAMOSC } from '../js/sledzenie.js';
import { klatka, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('DŁONIE:');
const d2 = dlonieKlatki(klatka({ dlonie: [[0.7, 0.5], [0.3, 0.5]] }), W, H);
spr('dwie dłonie, posortowane po x (MediaPipe nie trzyma kolejności)', d2.length === 2 && d2[0].x < d2[1].x);
spr('w pikselach płótna', Math.abs(d2[0].x - 0.3 * W) < 1e-6 && Math.abs(d2[0].y - 0.5 * H) < 1e-6);
spr('brak dłoni -> pusta tablica', dlonieKlatki(klatka(), W, H).length === 0);
spr('zepsuta klatka -> pusta tablica, bez wyjątku', dlonieKlatki(null, W, H).length === 0 &&
    dlonieKlatki({ hands: [{ landmarks: [{ x: NaN, y: 0 }] }] }, W, H).length === 0);

console.log('\nBARKI:');
const b = barkiKlatki(klatka({ barki: [0.4, 0.4, 0.6, 0.4] }), W, H);
spr('środek barków w px', Math.abs(b.x - 0.5 * W) < 1e-6 && Math.abs(b.y - 0.4 * H) < 1e-6);
spr('skala = szerokość barków w px', Math.abs(b.skala - 0.2 * W) < 1e-6);
spr('brak pozy -> null', barkiKlatki(klatka({ barki: null }), W, H) === null);

console.log('\nKOTWICA:');
const k = new Kotwica(14);
spr('nieznana na starcie', !k.znana && k.prowadz(null, 1 / 60) === null);
k.prowadz({ x: 100, y: 100 }, 1 / 60);
spr('pierwszy cel - przeskok, nie dojazd z (0,0)', k.stan.x === 100 && k.stan.y === 100);
k.prowadz({ x: 200, y: 100 }, 1 / 60);
spr('kolejny cel - wygładzony dojazd', k.stan.x > 100 && k.stan.x < 200);
const przed = k.stan.x;
k.prowadz(null, 1 / 60);
spr('cel znika -> trzyma ostatni stan', k.stan.x === przed);
k.prowadz({ x: NaN, y: 5 }, 1 / 60);
spr('cel z NaN traktowany jak brak celu', k.stan.x === przed && Number.isFinite(k.stan.y));
k.reset();
spr('reset -> znów nieznana', !k.znana);

console.log('\nTOŻSAMOŚĆ DŁONI (końce łuku nie przeskakują):');
{
    const SK = 200, DT = 1 / 60;
    const L = { x: 600, y: 500 }, R = { x: 1300, y: 500 };
    const bieg = (td, dlonie, sekundy) => { let w; for (let i = 0; i < Math.round(sekundy / DT); i++) w = td.prowadz(dlonie, SK, DT); return w; };

    const td = new TozsamoscDloni();
    spr('bez dłoni od początku -> oba sloty nieznane', td.prowadz([], SK, DT).a === null && td.prowadz([], SK, DT).b === null);
    const dwie = bieg(td, [L, R], 0.2);
    spr('dwie dłonie: A = lewa, B = prawa, obie widoczne', Math.abs(dwie.a.x - L.x) < 1 && Math.abs(dwie.b.x - R.x) < 1 && dwie.a.widoczna && dwie.b.widoczna);

    // Lewa dłoń zniknęła - widać tylko prawą. Sortowanie po x zrobiłoby z niej "pierwszą".
    const jedna = bieg(td, [R], 0.1);
    spr('widoczna prawa dłoń zostaje przy slocie B (nie przeskakuje do A)', Math.abs(jedna.b.x - R.x) < 1 && !jedna.a.widoczna);
    spr('zgubiony koniec A STOI w ostatnim miejscu', Math.abs(jedna.a.x - L.x) < 1 && Math.abs(jedna.a.y - L.y) < 1);
    spr('w okresie łaski koniec nie jest jeszcze odpinany', jedna.a.odpiecie === 0);
    const poLasce = bieg(td, [R], 3);
    spr('po okresie łaski koniec FIZYCZNIE wędruje nad widoczną dłoń (odpięcie = 1)',
        poLasce.a.odpiecie === 1 && Math.abs(poLasce.a.x - R.x) < 2 && Math.abs(poLasce.a.y - (R.y - SK * TOZSAMOSC.GORA_MNOZNIK)) < 2);

    // Powrót lewej dłoni w INNYM miejscu: koniec leci z ograniczoną prędkością, nie wskakuje.
    const daleko = { x: 300, y: 300 };
    const przed = { ...poLasce.a };
    const w1 = td.prowadz([daleko, R], SK, DT);
    const przesuniecie = Math.hypot(w1.a.x - przed.x, w1.a.y - przed.y);
    spr(`powrót: w pierwszej klatce ruch <= prędkość maks. (${przesuniecie.toFixed(1)} px)`, przesuniecie <= TOZSAMOSC.VMAX_MNOZNIK * SK * DT * 1.01 + 1e-6);
    spr('...a po powrocie nie jest już odpięty', w1.a.odpiecie === 0 && w1.a.widoczna);
    const doj = bieg(td, [daleko, R], 3);
    spr('po kilku sekundach koniec dojeżdża do wróconej dłoni', Math.hypot(doj.a.x - daleko.x, doj.a.y - daleko.y) < 2);
    const zwykly = td.prowadz([{ x: daleko.x + 120, y: daleko.y }, R], SK, DT);
    spr('po dojechaniu zwykłe śledzenie znów NADĄŻA (bez limitu prędkości)', zwykly.a.x - doj.a.x > TOZSAMOSC.VMAX_MNOZNIK * SK * DT * 1.5);

    // Obie dłonie znikają: oba końce stoją.
    const przedOb = { ...bieg(td, [daleko, R], 0.1).b };
    const ob = bieg(td, [], 2);
    spr('obie dłonie zgubione -> oba końce stoją w miejscu (nic nie odlatuje)', ob.a && ob.b && Math.abs(ob.b.x - przedOb.x) < 1 && Math.abs(ob.b.y - przedOb.y) < 1 && Math.abs(ob.a.y - doj.a.y) < 5);

    // Jedna dłoń od początku.
    const t1 = new TozsamoscDloni();
    const j = bieg(t1, [{ x: 900, y: 600 }], 0.2);
    spr('jedna dłoń od początku: A widoczna, B nieznany (null)', j.a && j.a.widoczna && j.b === null);
    // Druga pojawia się daleko - trafia do pustego slotu, nie przejmuje A.
    const dwaPo = bieg(t1, [{ x: 900, y: 600 }, { x: 1700, y: 600 }], 0.1);
    spr('druga dłoń pojawia się daleko -> zajmuje pusty slot B, A zostaje', Math.abs(dwaPo.a.x - 900) < 5 && dwaPo.b && Math.abs(dwaPo.b.x - 1700) < 5);

    const zly = new TozsamoscDloni();
    let rzucil = false;
    try { zly.prowadz([{ x: NaN, y: 0 }, null, { x: 5, y: 5 }], NaN, NaN); zly.prowadz(undefined, 0, 1 / 60); } catch { rzucil = true; }
    spr('zepsute dane (NaN, null, undefined) nie rzucają', !rzucil);
    zly.reset();
    spr('reset zapomina sloty', zly.prowadz([], SK, DT).a === null);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
