/**
 * Kamienna Tarcza - kręgi kumulowane kolejnymi odpaleniami, obwiednia,
 * orbita, śledzenie barków, cykl życia; bez document.
 *   node tools/test-kamienna-tarcza.mjs
 */
import { KamiennaTarcza, obwiednia, pozycjaOdlamka, geometriaKregu, CZAS_TRWANIA, NASTAWY } from '../js/kamiennaTarcza.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const T_OPADU = CZAS_TRWANIA - NASTAWY.T_OPADANIA;   // ostatnia sekunda: opadanie

console.log('OBWIEDNIA:');
spr('zero na starcie i po końcu', obwiednia(0, CZAS_TRWANIA) === 0 && obwiednia(3, 0) === 0);
spr('pełna w środku', obwiednia(3, 3) > 0.99);
spr('gaśnie w fazie opadania', obwiednia(5.5, 0.5) < 0.6);
spr('NaN -> 0', obwiednia(NaN, 3) === 0 && obwiednia(3, NaN) === 0);

console.log('\nGEOMETRIA KRĘGÓW (brak nakładania):');
const kregi = [0, 1, 2, 3].map(geometriaKregu);
spr('promienie rosną z każdym kręgiem', kregi.every((k, i) => i === 0 || k.promien > kregi[i - 1].promien));
spr('odstęp sąsiednich kręgów >= największy kamień', kregi.every((k, i) => i === 0 || k.promien - kregi[i - 1].promien >= NASTAWY.ROZMIAR_DO - 1e-9));
spr('stała prędkość liniowa (ω·R)', kregi.every(k => Math.abs(k.omega * k.promien - kregi[0].omega * kregi[0].promien) < 1e-9));
spr('kamieni przybywa z obwodem (równy odstęp łukowy)', kregi.every((k, i) => i === 0 || k.liczba > kregi[i - 1].liczba));
spr('kręgi na różnych wysokościach', new Set(kregi.map(k => k.przesuniecie)).size === 4);

console.log('\nORBITA:');
const o = { kat0: 0, kierunek: 1, promienWsp: 1, wysokosc: 0, obrot0: 0, vObrot: 0, opoznienieOpadu: 0 };
const srodek = { x: 1000, y: 400 }, k0 = geometriaKregu(0);
const p0 = pozycjaOdlamka(o, 0, CZAS_TRWANIA, srodek, 200, k0);
spr('w chwili dołożenia kręgu kamień wylatuje Z BARKÓW (promień 0)', Math.abs(p0.x - 1000) < 1e-6);
const p1 = pozycjaOdlamka(o, NASTAWY.T_FORMOWANIA, 3, srodek, 200, k0);
spr('po formowaniu na orbicie (promień kręgu)', Math.abs(Math.hypot(p1.x - 1000, (p1.y - 400 - 200 * NASTAWY.OBNIZENIE_MNOZNIK) / NASTAWY.SQUASH) - 200 * k0.promien) < 1);
const pSpad = pozycjaOdlamka(o, 3, 0.01, srodek, 200, k0);
const pPrzed = pozycjaOdlamka(o, 3, T_OPADU + 0.01, srodek, 200, k0);
spr('pod koniec kamienie OPADAJĄ (niżej niż orbita)', pSpad.y > pPrzed.y + 200 * k0.promien * NASTAWY.SQUASH * 2);

console.log('\nKUMULOWANIE ODPALEŃ:');
const t = new KamiennaTarcza();
spr('bezczynna na starcie', t.aktywny === false && t.liczbaPierscieni === 0);
t.zapal(1);
spr(`1 odpalenie -> 1 krąg, ${kregi[0].liczba} kamieni`, t.liczbaPierscieni === 1 && t.liczbaOdlamkow === kregi[0].liczba);
przepusc(t, klatka(), 1);
t.zapal(1);
spr('2 odpalenia -> 2 kręgi, kamieni dochodzi', t.liczbaPierscieni === 2 && t.liczbaOdlamkow === kregi[0].liczba + kregi[1].liczba);
spr('sąsiednie kręgi kręcą się w PRZECIWNE strony', t._pierscienie[0].kierunek === -t._pierscienie[1].kierunek);
przepusc(t, klatka(), 0.01);
spr('nowy krąg startuje przy barkach, stary już krąży', t._pierscienie[1].t < NASTAWY.T_FORMOWANIA && t._pierscienie[0].t > NASTAWY.T_FORMOWANIA);
t.zapal(1); t.zapal(1); t.zapal(1);
spr(`5 odpaleń -> nadal ${NASTAWY.MAKS_PIERSCIENI} kręgi`, t.liczbaPierscieni === NASTAWY.MAKS_PIERSCIENI);

console.log('\nCZAS ŻYCIA:');
const z = new KamiennaTarcza();
z.zapal(1);
przepusc(z, klatka(), 4);
z.zapal(1);
przepusc(z, klatka(), 4);
spr('odpalenie po 4 s przedłuża życie (8 s łącznie, nadal trwa)', z.aktywny === true);
przepusc(z, klatka(), CZAS_TRWANIA - 4 + 0.1);
spr('gaśnie CZAS_TRWANIA po OSTATNIM odpaleniu', z.aktywny === false);
const r = new KamiennaTarcza();
r.zapal(1); przepusc(r, klatka(), 0.5); r.zapal(1);
przepusc(r, klatka(), CZAS_TRWANIA - 0.5);   // w fazie opadania
r.zapal(1);
spr('odpalenie w trakcie opadania zaczyna tarczę od nowa (1 krąg)', r.liczbaPierscieni === 1 && r.aktywny);

console.log('\nŚLEDZENIE I ODPORNOŚĆ:');
const s = new KamiennaTarcza();
s.zapal(1);
przepusc(s, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const z1 = { ...s.zaczep };
przepusc(s, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', s.zaczep.x > z1.x + 100);
const z2 = { ...s.zaczep };
przepusc(s, klatka({ barki: null }), 0.5);
spr('poza znika -> zaczep stoi, skończony', s.zaczep.x === z2.x && Number.isFinite(s.zaczep.skala));
s.zapal(1);
let rzucil = false;
try { s.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie kilku kręgów bez assetów i bez document nie rzuca', rzucil === false);
const bezPozy = new KamiennaTarcza();
bezPozy.zapal(1);
przepusc(bezPozy, klatka({ barki: null }), 0.2);
spr('bez pozy od początku - zaczep zastępczy, skończony', Number.isFinite(bezPozy.zaczep.x) && bezPozy.zaczep.skala > 1);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
