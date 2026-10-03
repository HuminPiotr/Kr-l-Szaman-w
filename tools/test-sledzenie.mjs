/**
 * js/sledzenie.js - zaczepy technik śledzących ciało, bez document.
 *   node tools/test-sledzenie.mjs
 */
import { dlonieKlatki, barkiKlatki, Kotwica } from '../js/sledzenie.js';
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

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
