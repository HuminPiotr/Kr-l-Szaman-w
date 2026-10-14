/**
 * Scenariusz nagraniowy jakości tańca (klawisz J).
 *
 *   node tools/test-scenariusz-jakosci.mjs
 *
 * Id z prefiksem 'jakosc-': test-rozdzielnosc.mjs bierze etykietę z NAJŚWIEŻSZEGO
 * pliku (komentarz w js/nagrywanie/sesja.js przy 'taniec-falowanie') - kolizja
 * po cichu podmieniłaby mu próbki.
 */
import { SCENARIUSZ, SCENARIUSZ_FALOWANIE, SCENARIUSZ_JAKOSC, SesjaNagraniowa } from '../js/nagrywanie/sesja.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

spr('7 kroków', SCENARIUSZ_JAKOSC.length === 7);
spr('każde id z prefiksem jakosc-', SCENARIUSZ_JAKOSC.every(k => k.id.startsWith('jakosc-')));
const inne = new Set([...SCENARIUSZ, ...SCENARIUSZ_FALOWANIE].map(k => k.id));
spr('żadne id nie koliduje z innymi scenariuszami', SCENARIUSZ_JAKOSC.every(k => !inne.has(k.id)));
spr('id unikalne', new Set(SCENARIUSZ_JAKOSC.map(k => k.id)).size === SCENARIUSZ_JAKOSC.length);
spr('numery 1..7 po kolei', SCENARIUSZ_JAKOSC.every((k, i) => k.nr === i + 1));
spr('każdy krok ma wskazówkę na każde powtórzenie',
    SCENARIUSZ_JAKOSC.every(k => Array.isArray(k.wskazowki) && k.wskazowki.length === k.powtorzenia));
{
    const s = new SesjaNagraniowa({ scenariusz: SCENARIUSZ_JAKOSC });
    s.start(1);
    let start = 0;
    for (let i = 0; i < 20000 && s.aktywna; i++) if (s.tick(0.1).sygnal === 'start') start++;
    spr(`sesja przechodzi cały scenariusz (${start} nagrań, cel ${SCENARIUSZ_JAKOSC.reduce((a, k) => a + k.powtorzenia, 0)})`,
        start === SCENARIUSZ_JAKOSC.reduce((a, k) => a + k.powtorzenia, 0));
}
process.exit(ok ? 0 : 1);
