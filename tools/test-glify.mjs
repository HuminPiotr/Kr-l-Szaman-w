/**
 * Mapa pieczęć -> runa: kompletność, unikalność, brak zakazanych glifów,
 * odporność bez document.
 *
 *   node tools/test-glify.mjs
 */
import { GLIFY, ZAKAZANE, glif, fontGotowy, zaladujFont } from '../js/glify.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { weles } from '../js/znaki/weles.js';
import { perun } from '../js/znaki/perun.js';
import { stribog } from '../js/znaki/stribog.js';
import { mokosz } from '../js/znaki/mokosz.js';
import { KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('KOMPLETNOŚĆ względem pięciu zarejestrowanych pieczęci:');
const ZNAKI = [swarogDlon, weles, perun, stribog, mokosz];
for (const z of ZNAKI) {
    spr(`${z.id} ma glif`, typeof glif(z.id) === 'string' && glif(z.id).length > 0);
}

console.log('\nUNIKALNOŚĆ:');
const znakiUnikalne = new Set(Object.values(GLIFY).map(g => g.znak));
spr(`${znakiUnikalne.size} unikalnych glifów na ${Object.keys(GLIFY).length} pieczęci`,
    znakiUnikalne.size === Object.keys(GLIFY).length);

console.log('\nZAKAZ (GEMINI.md §7 - symbole zawłaszczone politycznie):');
for (const z of ZAKAZANE) {
    spr(`"${z}" nie występuje w GLIFY`, !Object.values(GLIFY).some(g => g.znak === z));
}

console.log('\nGLIFY DLA WSZYSTKICH PIECZĘCI UŻYTYCH W SEKWENCJACH KOMBOSÓW:');
const idWSekwencjach = new Set(KOMBOSY.flatMap(k => k.sekwencja));
for (const id of idWSekwencjach) {
    spr(`${id} ma glif`, typeof glif(id) === 'string');
}

console.log('\nODPORNOŚĆ bez document (Node):');
spr('glif nieznanego id -> null, bez wyjątku', glif('nieistnieje') === null);
spr('fontGotowy() bez document -> false, bez wyjątku', fontGotowy() === false);

const wynikPromise = zaladujFont();
spr('zaladujFont() zwraca Promise', wynikPromise instanceof Promise);
const wynik = await wynikPromise;
spr('zaladujFont() bez document rozwiązuje się na false', wynik === false);

process.exit(ok ? 0 : 1);
