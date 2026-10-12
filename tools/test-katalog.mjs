/**
 * Katalog Pamięci Plemienia - wyliczany z rejestrów, nie wpisywany ręcznie.
 *   node tools/test-katalog.mjs
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 */
import { PIECZECIE, NAZWY_PIECZECI, TECHNIKI, DWOJKI, TROJKI, WEZLY } from '../js/katalog.js';
import { KOMBOSY } from '../js/kombosy.js';
import { REAKCJE } from '../js/punkty.js';
import { GLIFY } from '../js/glify.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('KATALOG:');
spr('pieczęcie = klucze GLIFY', JSON.stringify(PIECZECIE) === JSON.stringify(Object.keys(GLIFY)));
spr('każda pieczęć ma nazwę', PIECZECIE.every(id => typeof NAZWY_PIECZECI[id] === 'string' && NAZWY_PIECZECI[id].length > 0));
const ids = TECHNIKI.map(t => t.id);
spr('techniki bez duplikatów (warianty Tęczy odpadły)', new Set(ids).size === ids.length);
spr('każde id z KOMBOSY jest w katalogu', KOMBOSY.every(k => ids.includes(k.id)));
spr('żaden wariant nie dał własnej pozycji', TECHNIKI.every(t => KOMBOSY.find(k => k.id === t.id && !k.wariant)));
spr('Tęcza ma sekwencję bez wariantu (3 pieczęcie)', TECHNIKI.find(t => t.id === 'tecza').sekwencja.length === 3);
spr('dwójki + trójki = wszystkie techniki', DWOJKI.length + TROJKI.length === TECHNIKI.length
    && [...DWOJKI, ...TROJKI].every(id => ids.includes(id)));
spr('dwójki mają 2 pieczęcie', DWOJKI.every(id => TECHNIKI.find(t => t.id === id).sekwencja.length === 2));
spr('węzły = klucze REAKCJE', JSON.stringify(WEZLY.map(w => w.id)) === JSON.stringify(Object.keys(REAKCJE)));
spr('węzły mają nazwy z REAKCJE', WEZLY.every(w => w.nazwa === REAKCJE[w.id].nazwa));
spr('sekwencja jest kopią (mutacja nie psuje KOMBOSY)', (() => {
    TECHNIKI[0].sekwencja.push('x');
    const zepsute = KOMBOSY.some(k => k.sekwencja.includes('x'));
    TECHNIKI[0].sekwencja.pop();
    return !zepsute;
})());

process.exit(ok ? 0 : 1);
