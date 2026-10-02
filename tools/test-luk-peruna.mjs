/**
 * Łuk Peruna - końcówki łuku z dłoni, mapowanie ścieżki, cykl życia; bez document.
 *   node tools/test-luk-peruna.mjs
 */
import { LukPeruna, obwiednia, mapujSciezke, koncowkiLuku, CZAS_TRWANIA, NASTAWY } from '../js/lukPeruna.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('MAPOWANIE ŚCIEŻKI:');
const m = mapujSciezke([{ x: 0, y: 0 }, { x: 0.5, y: 0.1 }, { x: 1, y: 0 }], { x: 100, y: 100 }, { x: 300, y: 100 });
spr('końce ścieżki dokładnie w dłoniach', m[0].x === 100 && m[2].x === 300 && m[2].y === 100);
spr('wychylenie skaluje się z długością łuku (prostopadle)', Math.abs(m[1].y - 120) < 1e-9);

console.log('\nKOŃCÓWKI:');
spr('dwie dłonie -> łuk między nimi', koncowkiLuku([{ x: 1, y: 2 }, { x: 5, y: 2 }], 100).b.x === 5);
const jedna = koncowkiLuku([{ x: 10, y: 500 }], 100);
spr('jedna dłoń -> wyładowanie W GÓRĘ', jedna.b.x === 10 && jedna.b.y === 500 - 100 * NASTAWY.WYSOKOSC_JEDNEJ_DLONI);
spr('brak dłoni -> null', koncowkiLuku([], 100) === null);
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const l = new LukPeruna();
l.zapal(1); l.zapal(1);
spr('aktywny po zapal()', l.aktywny);
przepusc(l, klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] }), 0.3);
spr('ścieżki wygenerowane po pierwszych klatkach', l._luki.length === NASTAWY.LICZBA_LUKOW);
const a1 = { ...l._a.stan };
przepusc(l, klatka({ dlonie: [[0.6, 0.5], [0.4, 0.5]] }), 0.1);
spr('zamiana kolejności dłoni NIE przerzuca łuku', Math.abs(l._a.stan.x - a1.x) < 1);
przepusc(l, klatka({ dlonie: [] }), 0.3);
spr('dłonie znikają -> końce stoją, skończone', Number.isFinite(l._a.stan.x) && Number.isFinite(l._b.stan.y));
let rzucil = false;
try { l.updateAndDraw(atrapaCtx(), kontekst(klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] })), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa ctx, bez assetów) nie rzuca', rzucil === false);
const bez = new LukPeruna();
bez.zapal(1);
let rzucil2 = false;
try { bez.updateAndDraw(atrapaCtx(), kontekst(klatka({ barki: null })), 1 / 60); } catch (e) { rzucil2 = e; }
spr('bez dłoni i pozy od początku - zastępcze końce, bez wyjątku', rzucil2 === false);
przepusc(l, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', l.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
