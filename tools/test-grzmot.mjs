/**
 * Grzmot - zdarzenie wybuchu (fala rysuje js/fala.js); bez document.
 *   node tools/test-grzmot.mjs
 */
import { Grzmot, zaczepKlatki, NASTAWY } from '../js/grzmot.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('ZACZEP KLATKI PIERSIOWEJ:');
const z = zaczepKlatki(klatka(), W, H);
spr(`pod środkiem barków (${z.x.toFixed(0)}, ${z.y.toFixed(0)})`, Math.abs(z.x - W * 0.5) < 1 && z.y > H * 0.4);
spr('skala = szerokość barków', Math.abs(z.skala - 0.1 * W) < 1);
const zb = zaczepKlatki(klatka({ barki: null }), W, H);
spr('bez pozy - umowny środek kadru, skończony', [zb.x, zb.y, zb.skala].every(Number.isFinite));

console.log('\nWYBUCH - DOKŁADNIE JEDNA KLATKA:');
const g = new Grzmot();
spr('przed zapal() nieaktywny, bez wybuchu', !g.aktywny && g.wybuch === null);
g.zapal(z, 0);
spr('zapal(sila 0) nic nie robi', !g.aktywny);
g.zapal({ x: NaN, y: 1, skala: 10 }, 1);
spr('zapal(NaN) nic nie robi', !g.aktywny);
g.zapal(z, 1);
spr('przed updateAndDraw wybuch jeszcze niewidoczny', g.wybuch === null && g.aktywny);
g.updateAndDraw(null, kontekst(klatka()), 1 / 60);
spr('pierwsza klatka - wybuch z zaczepem', g.wybuch?.x === z.x && g.wybuch?.sila === 1);
g.updateAndDraw(null, kontekst(klatka()), 1 / 60);
spr('druga klatka - wybuch zniknął', g.wybuch === null);
przepusc(g, klatka(), NASTAWY.CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', !g.aktywny);

console.log('\nODPORNOŚĆ:');
const g2 = new Grzmot();
g2.zapal(z, 1);
let rzuca = false;
try { g2.updateAndDraw(atrapaCtx(), kontekst(klatka()), NaN); g2.updateAndDraw(atrapaCtx(), null, 1e9); } catch { rzuca = true; }
spr('NaN dt / brak kontekstu / ogromne dt - bez wyjątku', !rzuca);

process.exit(ok ? 0 : 1);
