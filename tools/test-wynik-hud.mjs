/**
 * HUD wyniku - czyste funkcje (DOM sprawdzany w przeglądarce).
 *   node tools/test-wynik-hud.mjs
 */
import { formatujWynik, pozycjaWLustrze, tekstZdarzenia, tekstSerii, WynikHud, MAX_UNOSZACYCH } from '../js/wynikHud.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('FORMAT:');
spr('ułamek w dół', formatujWynik(12.9) === '12');
spr('NaN/ujemne = 0', formatujWynik(NaN) === '0' && formatujWynik(-5) === '0');

console.log('\nLUSTRO:');
const p = pozycjaWLustrze({ x: 100, y: 500 }, 1000, 1000);
spr(`x=100 z 1000 -> 90% od lewej (${p.lewo})`, Math.abs(p.lewo - 90) < 1e-9 && Math.abs(p.gora - 50) < 1e-9);
const brzeg = pozycjaWLustrze({ x: -500, y: 5000 }, 1000, 1000);
spr('przycięte do ekranu (5..95, 8..90)', brzeg.lewo === 95 && brzeg.gora === 90);
const brak = pozycjaWLustrze(null, 1000, 1000);
spr('brak miejsca = środek', brak.lewo === 50 && brak.gora === 40);
spr('NaN w miejscu = środek', pozycjaWLustrze({ x: NaN, y: 1 }, 1000, 1000).lewo === 50);

console.log('\nTEKSTY:');
spr('technika', tekstZdarzenia({ punkty: 340.4, tekst: 'Okadzenie' }) === '+340 Okadzenie');
spr('pieczęć bez tekstu', tekstZdarzenia({ punkty: 25, tekst: '' }) === '+25');
spr('seria', tekstSerii({ nazwa: 'Pożoga', n: 23, punkty: 184.2 }) === 'Pożoga ×23 · +184');

console.log('\nBEZ DOM:');
const h = new WynikHud(null);
spr('update bez elementów nie rzuca', (h.update({ wynik: 1, aktywna: true, odbierzZdarzenia: () => [], serieAktywne: () => [] }, 0, 100, 100), true));
spr('sufit unoszących = 12', MAX_UNOSZACYCH === 12);

process.exit(ok ? 0 : 1);
