/**
 * Katalog Pamięci Plemienia - co w ogóle da się odkryć.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * WYLICZANY Z REJESTRÓW, NIE WPISYWANY RĘCZNIE. Nowe combo w KOMBOSY albo nowa
 * reakcja w REAKCJE same pojawiają się w Zwoju (zwęglone), a test-strażnik
 * emblematów (tools/test-emblematy.mjs) zaczerwieni się, dopóki nie dostaną
 * rysunku i legendy.
 *
 * WARIANTY TĘCZY (`wariant: true` - przytrzymana miska) to NIE osobne techniki:
 * KOMBOSY ma 19 wpisów, ale technik jest 16.
 */
import { KOMBOSY } from './kombosy.js';
import { REAKCJE } from './punkty.js';
import { GLIFY } from './glify.js';

export const PIECZECIE = Object.keys(GLIFY);

export const NAZWY_PIECZECI = {
    swarog: 'Swaróg', perun: 'Perun', weles: 'Weles', stribog: 'Stribog', mokosz: 'Mokosz'
};

export const TECHNIKI = KOMBOSY
    .filter(k => !k.wariant)
    .map(k => ({ id: k.id, nazwa: k.nazwa, sekwencja: [...k.sekwencja] }));

// Drabina poziomów (pamięć projektu): 2 pieczęcie = gest, 3 = zjawisko.
export const DWOJKI = TECHNIKI.filter(t => t.sekwencja.length === 2).map(t => t.id);
export const TROJKI = TECHNIKI.filter(t => t.sekwencja.length >= 3).map(t => t.id);

export const WEZLY = Object.entries(REAKCJE).map(([id, r]) => ({ id, nazwa: r.nazwa }));
