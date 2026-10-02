/**
 * Wodna Kula - cel kuli z dłoni, brzeg, krople, pęknięcie; bez document.
 *   node tools/test-wodna-kula.mjs
 */
import { WodnaKula, obwiednia, celKuli, promienBrzegu, CZAS_TRWANIA, NASTAWY } from '../js/wodnaKula.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('CEL KULI:');
const c2 = celKuli([{ x: 800, y: 500 }, { x: 1200, y: 500 }], 200);
spr('dwie dłonie -> środek między nimi', c2.x === 1000 && c2.y === 500);
spr('promień z rozpiętości, w granicach skali', c2.r >= 200 * NASTAWY.PROMIEN_MIN && c2.r <= 200 * NASTAWY.PROMIEN_MAX);
spr('dłonie złączone -> promień nie spada poniżej minimum', celKuli([{ x: 1000, y: 500 }, { x: 1001, y: 500 }], 200).r === 200 * NASTAWY.PROMIEN_MIN);
spr('jedna dłoń -> kula NAD dłonią', celKuli([{ x: 1000, y: 500 }], 200).y < 500);
spr('brak dłoni -> null', celKuli([], 200) === null);

console.log('\nBRZEG I OBWIEDNIA:');
const r = promienBrzegu(100, 1, 0.5);
spr('brzeg faluje wokół R, ale blisko', Math.abs(r - 100) <= 100 * NASTAWY.FALOWANIE + 1e-9);
spr('w środku kula pełna, bez rozdęcia', obwiednia(CZAS_TRWANIA / 2).kula > 0.99 && obwiednia(CZAS_TRWANIA / 2).rozdecie === 1);
spr('przy pęknięciu kula się rozdyma', obwiednia(CZAS_TRWANIA - 0.05).rozdecie > 1.1);
spr('NaN -> kula 0', obwiednia(NaN).kula === 0);

console.log('\nCYKL ŻYCIA:');
const kula = new WodnaKula();
kula.zapal(1); kula.zapal(1);
przepusc(kula, klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] }), 2);
spr('krople odrywają się od brzegu w trakcie', kula._krople.length > 0);
const sr = { ...kula._srodek.stan };
przepusc(kula, klatka({ dlonie: [] }), 0.3);
spr('dłonie znikają -> kula stoi', Math.abs(kula._srodek.stan.x - sr.x) < 1e-9);
let rzucil = false;
try { kula.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez document) nie rzuca', rzucil === false);
// t ≈ 2.3 s; dojedź do początku fazy pęknięcia (emisja stoi, chmura jeszcze nie wyszła)...
przepusc(kula, klatka(), CZAS_TRWANIA - 2.3 - NASTAWY.PEKNIECIE);
const przedPeknieciem = kula._krople.length;
// ...i za połowę pęknięcia, gdzie wychodzi chmura KROPLE_PEKNIECIA kropel.
przepusc(kula, klatka(), NASTAWY.PEKNIECIE / 2 + 0.05);
spr('pęknięcie wyrzuca chmurę kropel', kula._krople.length > przedPeknieciem);
przepusc(kula, klatka(), 3);
spr('gaśnie, gdy skończy się czas i wszystkie krople', kula.aktywny === false && kula._krople.length === 0);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
