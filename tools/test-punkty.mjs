/**
 * Punktacja - punkty tylko PRZYBYWAJĄ (GEMINI.md §2 po przepisaniu 2026-10-01).
 *
 *   node tools/test-punkty.mjs
 *
 * Spec: docs/superpowers/specs/2026-10-01-punktacja-design.md
 */
import {
    Punktacja, wartoscTechniki, TRUDNOSC, PUNKTY_PIECZECI
} from '../js/punkty.js';
import { KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };
const kombo = (id) => KOMBOSY.find(k => k.id === id);

console.log('STRAŻNIK ROZSZERZALNOŚCI:');
// Nowe combo dodane do KOMBOSY bez wpisu w TRUDNOSC wywala ten test -
// technika nie może wejść do gry "za darmo" (ani za NaN).
for (const k of KOMBOSY) {
    for (const id of k.sekwencja) {
        spr(`pieczęć '${id}' (z ${k.id}) ma trudność`, Number.isFinite(TRUDNOSC[id]) && TRUDNOSC[id] > 0);
    }
    const w = wartoscTechniki(k);
    spr(`${k.id} ma skończoną dodatnią wartość (${w})`, Number.isFinite(w) && w > 0);
}
spr('nieznana pieczęć w sekwencji daje 0, nie NaN',
    wartoscTechniki({ id: 'x', sekwencja: ['swarog', 'nieznana'] }) === 0);
spr('brak sekwencji daje 0', wartoscTechniki(null) === 0 && wartoscTechniki({}) === 0);

console.log('\nWARTOŚCI Z SPECU:');
spr(`Kołowrót = 320 (${wartoscTechniki(kombo('kolowrot'))})`, wartoscTechniki(kombo('kolowrot')) === 320);
spr(`Okadzenie = 460 (${wartoscTechniki(kombo('dym'))})`, wartoscTechniki(kombo('dym')) === 460);
spr(`Grom w Ogniu = 280 (${wartoscTechniki(kombo('gromWOgniu'))})`, wartoscTechniki(kombo('gromWOgniu')) === 280);

console.log('\nTANIEC:');
const t = new Punktacja();
for (let i = 0; i < 60; i++) t.taniec(1, 1, 1 / 60);
spr(`sekunda pełnego tańca = ~4 pkt (${t.wynik.toFixed(2)})`, Math.abs(t.wynik - 4) < 1e-6);
const t2 = new Punktacja();
t2.taniec(1, 0, 1);
spr('bezruch (responsywność 0) nie punktuje', t2.wynik === 0);
const t3 = new Punktacja();
t3.taniec(1, 1, 5);   // powrót z uśpionej karty
spr(`dt przycięte do 0,1 s (${t3.wynik.toFixed(2)})`, Math.abs(t3.wynik - 0.4) < 1e-6);
const t4 = new Punktacja();
t4.taniec(NaN, 1, 0.1); t4.taniec(1, Infinity, 0.1); t4.taniec(1, 1, NaN); t4.taniec(1, 1, -1);
spr('NaN/Infinity/ujemne dt nie zatruwają wyniku', t4.wynik === 0);
spr('rozbicie.taniec = wynik', t.rozbicie.taniec === t.wynik);

console.log('\nPIECZĘĆ:');
const p = new Punktacja();
spr(`pieczęć daje ${PUNKTY_PIECZECI}`, p.pieczec('swarog', 0) === PUNKTY_PIECZECI);
spr('zła pieczęć (pusty id / NaN czas) nic nie daje', p.pieczec('', 1) === 0 && p.pieczec('swarog', NaN) === 0);

console.log('\nTECHNIKA I MALEJĄCY PRZYROST:');
const m = new Punktacja();
const k = kombo('kolowrot');
const a = m.technika(k, 0), b = m.technika(k, 1), c = m.technika(k, 2), d = m.technika(k, 3);
spr(`100% → 75% → 50% → 50% (${[a, b, c, d].join(', ')})`, a === 320 && b === 240 && c === 160 && d === 160);
const e = m.technika(kombo('gromWOgniu'), 4);
const f = m.technika(k, 5);
spr(`inna technika przywraca 100% (${e}, potem kołowrót ${f})`, e === 280 && f === 320);
spr('momenty liczą techniki', m.momenty.techniki.kolowrot === 5 && m.momenty.techniki.gromWOgniu === 1);

console.log('\nZDARZENIA (do unoszących się napisów):');
const z = new Punktacja();
z.pieczec('perun', 0, { x: 10, y: 20 });
z.technika(kombo('kolowrot'), 1, { x: 30, y: 40 });
const zd = z.odbierzZdarzenia();
spr(`dwa zdarzenia (${zd.length})`, zd.length === 2);
spr('technika niesie nazwę i miejsce', zd[1].tekst === 'Kołowrót' && zd[1].miejsce?.x === 30 && zd[1].punkty === 320);
spr('odbierzZdarzenia czyści kolejkę', z.odbierzZdarzenia().length === 0);

console.log('\nNIEAKTYWNA (tryb swobodny):');
const n = new Punktacja();
n.aktywna = false;
n.taniec(1, 1, 0.1); n.pieczec('swarog', 0); n.technika(kombo('kolowrot'), 1);
spr('zero punktów i zdarzeń', n.wynik === 0 && n.odbierzZdarzenia().length === 0);

console.log('\nZEW (hak):');
const zw = new Punktacja();
zw.mnoznikZewu = (rodzaj) => rodzaj === 'pieczec' ? 2 : 1;
spr('mnożnik zewu podwaja pieczęć', zw.pieczec('swarog', 0) === 2 * PUNKTY_PIECZECI);
zw.mnoznikZewu = () => NaN;
spr('zepsuty mnożnik (NaN) traktowany jak 1', zw.pieczec('swarog', 1) === PUNKTY_PIECZECI);
zw.mnoznikZewu = () => 0.1;
spr('mnożnik < 1 traktowany jak 1 (zew nigdy nie zabiera)', zw.pieczec('swarog', 2) === PUNKTY_PIECZECI);

console.log('\nRESET:');
m.reset();
spr('reset zeruje wynik, rozbicie i momenty', m.wynik === 0 && m.rozbicie.techniki === 0 && !m.momenty.techniki.kolowrot);

process.exit(ok ? 0 : 1);
