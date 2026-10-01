/**
 * Skróty klawiszowe vs pola tekstowe (final review podprojektu 3, Critical):
 * wpisywanie nicku nie może odpalać M (wyciszenie), D/Z/1-8 (debug) ani R/N.
 *   node tools/test-klawisze.mjs
 */
import { czyPoleTekstowe } from '../js/klawisze.js';
import { ZetonStartu } from '../js/zeton.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('POLE TEKSTOWE:');
{
    spr('<input> bez typu = pole tekstowe', czyPoleTekstowe({ tagName: 'INPUT' }) === true);
    spr('<input type=text>', czyPoleTekstowe({ tagName: 'INPUT', type: 'text' }) === true);
    spr('search/email/url/tel/password/number też piszą', ['search', 'email', 'url', 'tel', 'password', 'number'].every(t => czyPoleTekstowe({ tagName: 'INPUT', type: t })));
    spr('<textarea>', czyPoleTekstowe({ tagName: 'TEXTAREA' }) === true);
    spr('contenteditable', czyPoleTekstowe({ tagName: 'DIV', isContentEditable: true }) === true);
    spr('checkbox/radio/button/file NIE są polami tekstowymi (skróty działają)', ['checkbox', 'radio', 'button', 'file', 'submit'].every(t => czyPoleTekstowe({ tagName: 'INPUT', type: t }) === false));
    spr('zwykłe elementy i <button> nie', czyPoleTekstowe({ tagName: 'DIV' }) === false && czyPoleTekstowe({ tagName: 'BUTTON' }) === false && czyPoleTekstowe({ tagName: 'BODY' }) === false);
    spr('wielkość liter znacznika nie ma znaczenia', czyPoleTekstowe({ tagName: 'input', type: 'TEXT' }) === true);
    spr('null/undefined/liczba/tekst nie rzucają', [null, undefined, 5, 'x', {}].every(x => czyPoleTekstowe(x) === false));
    spr('document/window jako cel nie jest polem', czyPoleTekstowe({ nodeType: 9 }) === false);
}

console.log('\nZETON STARTU (Esc w trakcie asynchronicznego startu rundy):');
{
    const z = new ZetonStartu();
    const a = z.nowy();
    spr('świeży żeton jest aktualny', z.aktualny(a) === true);
    z.uniewaznij();
    spr('po uniewaznij() stary żeton nieaktualny (Esc na Polanę zabija oczekujący start)', z.aktualny(a) === false);
    const b = z.nowy(), c = z.nowy();
    spr('nowy start unieważnia poprzedni (dwa starty naraz: wygrywa ostatni)', z.aktualny(b) === false && z.aktualny(c) === true);
    spr('żetony rosnące i unikalne', c > b && b > a);
    spr('śmieci nie są aktualne', [undefined, null, NaN, 'x', -1, 9999].every(x => z.aktualny(x) === false));
    const z2 = new ZetonStartu();
    spr('świeża instancja: nic nie jest aktualne', z2.aktualny(0) === false);
}

process.exit(ok ? 0 : 1);
