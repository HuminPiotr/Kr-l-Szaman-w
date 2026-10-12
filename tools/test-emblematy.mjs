/**
 * Emblematy - strażnik dwustronny (każda technika i węzeł ma rysunek + legendę,
 * żaden wpis nie wisi bez techniki) i zakaz §7.
 *   node tools/test-emblematy.mjs
 * Przegląd WZROKOWY pod §7: otwórz tools/emblematy.html przez serwer statyczny.
 */
import { EMBLEMATY, WEZLY_EMBLEMATY, svgEmblematu } from '../js/emblematy.js';
import { TECHNIKI, WEZLY, PIECZECIE } from '../js/katalog.js';
import { KAMIENIE } from '../js/osiagniecia.js';
import { ZAKAZANE } from '../js/glify.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const DOZWOLONE_TAGI = ['path', 'circle', 'ellipse', 'g', 'text'];
const czyste = (s) => {
    const tagi = [...s.matchAll(/<\/?\s*([a-zA-Z]+)/g)].map(m => m[1]);
    return tagi.every(t => DOZWOLONE_TAGI.includes(t)) && !/\son[a-z]+\s*=/i.test(s) && !/javascript:/i.test(s) && !/href/i.test(s);
};

console.log('STRAŻNIK DWUSTRONNY:');
for (const t of TECHNIKI) {
    const e = EMBLEMATY[t.id];
    spr(`technika '${t.id}' ma rysunek i legendę`, !!e && e.svg.includes('<') && typeof e.legenda === 'string' && e.legenda.length > 10);
}
spr('żaden emblemat nie wisi bez techniki', Object.keys(EMBLEMATY).every(id => TECHNIKI.some(t => t.id === id)));
for (const w of WEZLY) {
    const e = WEZLY_EMBLEMATY[w.id];
    spr(`węzeł '${w.id}' ma dwie składowe-techniki i legendę`, !!e && e.skladowe.length === 2
        && e.skladowe.every(id => !!EMBLEMATY[id]) && e.skladowe[0] !== e.skladowe[1] && e.legenda.length > 10);
}
spr('żaden węzeł nie wisi bez reakcji', Object.keys(WEZLY_EMBLEMATY).every(id => WEZLY.some(w => w.id === id)));

console.log('\nBEZPIECZEŃSTWO I §7:');
const wszystkie = [
    ...TECHNIKI.map(t => ['technika', t.id]), ...WEZLY.map(w => ['wezel', w.id]),
    ...PIECZECIE.map(id => ['pieczec', id]), ...KAMIENIE.map(k => ['kamien', k.id]), ['sekret', 'x']
];
for (const [r, id] of wszystkie) {
    const s = svgEmblematu(r, id);
    spr(`${r}:${id} niepusty, tylko dozwolone tagi, bez zdarzeń/linków`, s.length > 0 && czyste(s));
    spr(`${r}:${id} bez run ZAKAZANYCH`, ZAKAZANE.every(z => !s.includes(z)));
}
spr('nieznane = pusty łańcuch', svgEmblematu('technika', 'nieznana') === '' && svgEmblematu('x', 'y') === '');

process.exit(ok ? 0 : 1);
