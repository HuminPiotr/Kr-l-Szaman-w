/**
 * Kurzawa v2 - pas wiatru: start z dołu ekranu, pasy wokół ciała, smugi; bez document.
 *   node tools/test-kurzawa.mjs
 */
import { Kurzawa, obwiednia, geometriaPasa, glowaPodmuchu, punktyOgona, CZAS_TRWANIA, NASTAWY } from '../js/kurzawa.js';
import { klatka, kontekst, przepusc, atrapaCtx, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const ZACZEP = { x: 960, y: 430, skala: 190 };
const blisko = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

console.log('PASY:');
const pasy = [0, 1, 2, 3].map(i => geometriaPasa(i, ZACZEP, H));
spr('pasy na różnych wysokościach, pas 0 najniżej', pasy.every((p, i) => i === 0 || p.cy < pasy[i - 1].cy));
spr('sąsiednie pasy kręcą się w PRZECIWNE strony', pasy.every((p, i) => i === 0 || p.kierunek === -pasy[i - 1].kierunek));
spr('sąsiednie podmuchy wchodzą z PRZECIWNYCH stron', pasy.every((p, i) => i === 0 || p.strona === -pasy[i - 1].strona));
const nisko = geometriaPasa(0, { x: 960, y: 0.8 * H, skala: 190 }, H);
spr('pas nigdy nie ucieka pod dół kadru', nisko.cy <= H * NASTAWY.DOL_EKRANU + 1e-9);

console.log('\nGŁOWA PODMUCHU:');
spr('przed swoim startem podmuch nie istnieje', glowaPodmuchu(0, -0.01, ZACZEP, H) === null);
spr('start POD dolną krawędzią ekranu', glowaPodmuchu(0, 0, ZACZEP, H).y >= H);
spr('...także gdy gracz stoi wysoko w kadrze', glowaPodmuchu(1, 0, { x: 960, y: 150, skala: 190 }, H).y >= H);
const wejscie = glowaPodmuchu(0, NASTAWY.T_WZNOSZENIA, ZACZEP, H);
spr('po wzniesieniu podmuch jest w skrajnym punkcie swojego pasa',
    blisko(wejscie.x, pasy[0].cx + Math.cos(pasy[0].katWejscia) * pasy[0].R, 1e-3) && blisko(wejscie.y, pasy[0].cy, 1e-3));
const naOrbicie = glowaPodmuchu(0, NASTAWY.T_WZNOSZENIA + 0.7, ZACZEP, H);
spr('potem krąży po elipsie pasa wokół gracza',
    blisko(((naOrbicie.x - pasy[0].cx) / pasy[0].R) ** 2 + ((naOrbicie.y - pasy[0].cy) / (pasy[0].R * NASTAWY.SQUASH)) ** 2, 1, 1e-6));
const tuzPo = glowaPodmuchu(0, NASTAWY.T_WZNOSZENIA + 0.02, ZACZEP, H);
spr('wejście w orbitę idzie W GÓRĘ (gładko z ruchu od dołu)', tuzPo.y < wejscie.y);

console.log('\nOGON (SMUGA):');
const t = NASTAWY.T_WZNOSZENIA + (Math.PI + 0.5) / NASTAWY.PREDKOSC_KATOWA;   // ogon przecina oś przód/tył
const ogon = punktyOgona(0, t, ZACZEP, H);
spr(`ogon ma ${NASTAWY.PUNKTOW_OGONA + 1} punktów`, ogon.length === NASTAWY.PUNKTOW_OGONA + 1);
spr('pierwszy punkt to głowa', blisko(ogon[0].x, glowaPodmuchu(0, t, ZACZEP, H).x));
const k = 5, krokOgona = NASTAWY.DLUGOSC_OGONA_S / NASTAWY.PUNKTOW_OGONA;
spr('ogon leci torem głowy (punkt k = głowa sprzed k kroków)', blisko(ogon[k].y, glowaPodmuchu(0, t - k * krokOgona, ZACZEP, H).y));
spr('ogon zwęża się ku końcowi', ogon.every((p, i) => i === 0 || p.zwezenie < ogon[i - 1].zwezenie));
spr('smuga ma część PRZED i część ZA graczem', ogon.some(p => p.przod) && ogon.some(p => !p.przod));
spr('podmuchy startują po kolei (najwyższy jeszcze nie wystartował)', punktyOgona(3, 0.5, ZACZEP, H).length === 0);

console.log('\nOBWIEDNIA I CYKL ŻYCIA:');
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);
const kz = new Kurzawa();
spr('bezczynna na starcie', kz.aktywny === false);
kz.zapal(1); kz.zapal(1);
spr('ponowny zapal() restartuje, nie podwaja pyłu', kz._pyl.length === NASTAWY.LICZBA_PYLU && kz._t === 0);
przepusc(kz, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const x1 = kz.zaczep.x;
przepusc(kz, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', kz.zaczep.x > x1 + 100);
const x2 = kz.zaczep.x;
przepusc(kz, klatka({ barki: null }), 0.3);
spr('poza znika -> zaczep stoi', kz.zaczep.x === x2);
let rzucil = false;
try { kz.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie bez assetów i bez document nie rzuca', rzucil === false);
przepusc(kz, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', kz.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
