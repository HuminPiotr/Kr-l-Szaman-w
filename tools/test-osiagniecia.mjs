/**
 * Kamienie Pamięci - każdy kamień na progu i tuż pod nim.
 *   node tools/test-osiagniecia.mjs
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 */
import {
    KAMIENIE, KATEGORIE, OKNO_HISTORII_MS, poKolei, razem, ileWOknie, rozneWOknie, godzinaDuchow, nocKupaly
} from '../js/osiagniecia.js';
import { PIECZECIE, DWOJKI, TROJKI, TECHNIKI, WEZLY } from '../js/katalog.js';
import { ZAKAZANE } from '../js/glify.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const K = (id) => KAMIENIE.find(k => k.id === id);
const stan = (nad = {}) => ({
    pieczecie: {}, techniki: {}, wezly: {}, kamienie: {},
    liczniki: { rundy: 0, piesni: [], bogowie: [] }, historia: [], splotSeria: 0, manifest: [], ...nad
});
const zbior = (ids) => Object.fromEntries(ids.map(id => [id, { n: 1, t: 1 }]));
const ctx = (nad = {}) => ({ teraz: new Date(2026, 9, 12, 15, 0), now: 100000, ...nad });
const ev = (rodzaj, id, t) => ({ rodzaj, id, t });

console.log('REJESTR:');
{
    const ids = KAMIENIE.map(k => k.id);
    spr('24 kamienie, bez duplikatów', KAMIENIE.length === 24 && new Set(ids).size === 24);
    spr('każdy ma nazwę, opis, kategorię, kiedy, runę, warunek', KAMIENIE.every(k =>
        k.nazwa && k.opis && KATEGORIE.some(c => c.id === k.kategoria)
        && ['zywo', 'runda', 'nick', 'zawsze'].includes(k.kiedy) && typeof k.runa === 'string' && typeof k.warunek === 'function'));
    spr('runy kamieni nie są ZAKAZANE (§7)', KAMIENIE.every(k => !ZAKAZANE.includes(k.runa)));
    spr('sekrety mają kategorię sekret', KAMIENIE.filter(k => k.sekret).every(k => k.kategoria === 'sekret'));
    spr('żaden warunek nie rzuca na pustym stanie', KAMIENIE.every(k => {
        try { return typeof k.warunek(stan(), ctx({ now: null })) === 'boolean'; } catch { return false; }
    }));
    spr('żaden nie jest zdobyty na pustym stanie', KAMIENIE.every(k => k.warunek(stan(), ctx()) === false));
    spr('okno historii mieści najdłuższe okno mitu (60 s)', OKNO_HISTORII_MS >= 60000);
}

console.log('\nPOMOCNICZE:');
{
    const h = [ev('technika', 'gromWZiemie', 1000), ev('pieczec', 'mokosz', 5000), ev('technika', 'kolowrot', 15000)];
    spr('poKolei: a potem b w oknie', poKolei(h, ['technika', 'gromWZiemie'], ['technika', 'kolowrot'], 15000));
    spr('poKolei: poza oknem nie', !poKolei(h, ['technika', 'gromWZiemie'], ['technika', 'kolowrot'], 13999));
    spr('poKolei: odwrotna kolejność nie', !poKolei(h, ['technika', 'kolowrot'], ['technika', 'gromWZiemie'], 60000));
    spr('razem: oba w oknie', razem([ev('wezel', 'a', 96000), ev('wezel', 'b', 100000)], [['wezel', 'a'], ['wezel', 'b']], 5000, 100000));
    spr('razem: jeden za stary', !razem([ev('wezel', 'a', 94999), ev('wezel', 'b', 100000)], [['wezel', 'a'], ['wezel', 'b']], 5000, 100000));
    spr('ileWOknie liczy tylko w oknie', ileWOknie([ev('technika', 'x', 1), ev('technika', 'x', 50), ev('technika', 'x', 60)], 'technika', 'x', 20, 60) === 2);
    spr('rozneWOknie', rozneWOknie([ev('pieczec', 'a', 10), ev('pieczec', 'a', 11), ev('pieczec', 'b', 12)], 'pieczec', 100, 12) === 2);
    spr('śmieci nie rzucają', !poKolei(null, ['a', 'b'], ['c', 'd'], 1) && !razem(null, [], 1, 1) && ileWOknie(null, 'a', 'b', 1, 1) === 0);
    spr('godzina duchów 0:00-2:59', godzinaDuchow(new Date(2026, 0, 1, 0, 5)) && godzinaDuchow(new Date(2026, 0, 1, 2, 59)) && !godzinaDuchow(new Date(2026, 0, 1, 3, 0)));
    spr('noc Kupały 23.06 od 18:00 do 24.06 6:00', nocKupaly(new Date(2026, 5, 23, 18, 0)) && nocKupaly(new Date(2026, 5, 24, 5, 59))
        && !nocKupaly(new Date(2026, 5, 23, 17, 59)) && !nocKupaly(new Date(2026, 5, 24, 6, 0)) && !nocKupaly(new Date(2026, 6, 23, 22, 0)));
    spr('zła data nie rzuca', !godzinaDuchow(null) && !nocKupaly('x'));
}

console.log('\nKOLEKCJA:');
{
    spr('Pierwsza Iskra: jedna technika', K('pierwszaIskra').warunek(stan({ techniki: zbior(['aard']) }), ctx()));
    spr('Pięć Żywiołów: 4/5 nie', !K('piecZywiolow').warunek(stan({ pieczecie: zbior(PIECZECIE.slice(0, 4)) }), ctx()));
    spr('Pięć Żywiołów: 5/5 tak', K('piecZywiolow').warunek(stan({ pieczecie: zbior(PIECZECIE) }), ctx()));
    spr('Pięć Żywiołów: postęp 4 z 5', JSON.stringify(K('piecZywiolow').postep(stan({ pieczecie: zbior(PIECZECIE.slice(0, 4)) }))) === '{"ile":4,"z":5}');
    spr('Mowa Gestów: wszystkie dwójki', K('mowaGestow').warunek(stan({ techniki: zbior(DWOJKI) }), ctx())
        && !K('mowaGestow').warunek(stan({ techniki: zbior(DWOJKI.slice(1)) }), ctx()));
    spr('Władca Zjawisk: wszystkie trójki', K('wladcaZjawisk').warunek(stan({ techniki: zbior(TROJKI) }), ctx())
        && !K('wladcaZjawisk').warunek(stan({ techniki: zbior(TROJKI.slice(1)) }), ctx()));
    const wezly = WEZLY.map(w => w.id);
    spr('Tkacz Węzłów: wszystkie węzły', K('tkaczWezlow').warunek(stan({ wezly: zbior(wezly) }), ctx())
        && !K('tkaczWezlow').warunek(stan({ wezly: zbior(wezly.slice(1)) }), ctx()));
    spr('Wszechwiedzący: techniki + węzły', K('wszechwiedzacy').warunek(stan({ techniki: zbior(TECHNIKI.map(t => t.id)), wezly: zbior(wezly) }), ctx())
        && !K('wszechwiedzacy').warunek(stan({ techniki: zbior(TECHNIKI.map(t => t.id)) }), ctx()));
}

console.log('\nMITY:');
{
    const h = (...e) => stan({ historia: e });
    spr('Perun kontra Weles w 15 s', K('perunKontraWeles').warunek(h(ev('technika', 'gromWZiemie', 86000), ev('technika', 'kolowrot', 100000)), ctx()));
    spr('Perun kontra Weles po 15 s nie', !K('perunKontraWeles').warunek(h(ev('technika', 'gromWZiemie', 84999), ev('technika', 'kolowrot', 100000)), ctx()));
    spr('Trójsplot: seria 2', K('trojsplot').warunek(stan({ splotSeria: 2 }), ctx()) && !K('trojsplot').warunek(stan({ splotSeria: 1 }), ctx()));
    spr('Ogień i Woda: Bania potem Tęcza', K('ogienIWoda').warunek(h(ev('technika', 'bania', 90000), ev('technika', 'tecza', 100000)), ctx())
        && !K('ogienIWoda').warunek(h(ev('technika', 'tecza', 90000), ev('technika', 'bania', 100000)), ctx()));
    spr('Burza nad Bagnem w 5 s', K('burzaNadBagnem').warunek(h(ev('wezel', 'przewodzenie', 96000), ev('wezel', 'burzaWMgle', 100000)), ctx())
        && !K('burzaNadBagnem').warunek(h(ev('wezel', 'przewodzenie', 94000), ev('wezel', 'burzaWMgle', 100000)), ctx()));
    spr('Noc Dziadów w 30 s', K('nocDziadow').warunek(h(ev('technika', 'dym', 71000), ev('wezel', 'latarnie', 100000)), ctx())
        && !K('nocDziadow').warunek(h(ev('technika', 'dym', 69000), ev('wezel', 'latarnie', 100000)), ctx()));
    const piec = PIECZECIE.map((id, i) => ev('pieczec', id, 81000 + i * 4000));
    spr('Krąg Żywiołów: 5 różnych w 20 s', K('kragZywiolow').warunek(h(...piec), ctx()));
    spr('Krąg Żywiołów: 4 różne nie', !K('kragZywiolow').warunek(h(...piec.slice(1), ev('pieczec', PIECZECIE[1], 99000)), ctx()));
    spr('mity bez now (koniec rundy) nie zachodzą', !K('burzaNadBagnem').warunek(h(ev('wezel', 'przewodzenie', 1), ev('wezel', 'burzaWMgle', 1)), ctx({ now: null })));
}

console.log('\nKUNSZT I OBRZĘD:');
{
    const pods = (nad = {}) => ({ wynik: 100, dlugoscS: 60, momenty: { serie: {}, techniki: {}, splecenia: 0 }, kragKoniec: null, podium: null, ...nad });
    spr('Podpalacz Nieba: Pożoga 100', K('podpalaczNieba').warunek(stan(), ctx({ pods: pods({ momenty: { serie: { pozoga: 100 }, techniki: {} } }) }))
        && !K('podpalaczNieba').warunek(stan(), ctx({ pods: pods({ momenty: { serie: { pozoga: 99 }, techniki: {} } }) })));
    spr('Król Szamanów: ≥2000/min', K('krolSzamanow').warunek(stan(), ctx({ pods: pods({ wynik: 2000 }) }))
        && !K('krolSzamanow').warunek(stan(), ctx({ pods: pods({ wynik: 1999 }) })));
    const manifest = ['a.m4a', 'b.m4a'];
    spr('Pieśniarz: wszystkie z manifestu', K('piesniarz').warunek(stan({ manifest, liczniki: { rundy: 2, piesni: ['b.m4a', 'a.m4a'], bogowie: [] } }), ctx()));
    spr('Pieśniarz: brak jednej nie', !K('piesniarz').warunek(stan({ manifest, liczniki: { rundy: 2, piesni: ['a.m4a', 'wlasna:x.mp3'], bogowie: [] } }), ctx()));
    spr('Pieśniarz: pusty manifest nie', !K('piesniarz').warunek(stan(), ctx()));
    spr('Pieśniarz: postęp 1 z 2', JSON.stringify(K('piesniarz').postep(stan({ manifest, liczniki: { rundy: 0, piesni: ['a.m4a'], bogowie: [] } }))) === '{"ile":1,"z":2}');
    spr('Wielki Krąg: koniec Kręgu 6', K('wielkiKrag').warunek(stan(), ctx({ pods: pods({ kragKoniec: true, podium: [1, 2, 3, 4, 5, 6] }) }))
        && !K('wielkiKrag').warunek(stan(), ctx({ pods: pods({ kragKoniec: true, podium: [1, 2, 3, 4, 5] }) }))
        && !K('wielkiKrag').warunek(stan(), ctx({ pods: pods({ kragKoniec: false, podium: null }) })));
    const t8 = Object.fromEntries(TECHNIKI.slice(0, 8).map(t => [t.id, 1]));
    const t7 = Object.fromEntries(TECHNIKI.slice(0, 7).map(t => [t.id, 1]));
    spr('Wszechstronny: 8 różnych', K('wszechstronny').warunek(stan(), ctx({ pods: pods({ momenty: { serie: {}, techniki: t8 } }) }))
        && !K('wszechstronny').warunek(stan(), ctx({ pods: pods({ momenty: { serie: {}, techniki: { ...t7, x: 0 } } }) })));
    spr('Dziesięć Obrzędów', K('dziesiecObrzedow').warunek(stan({ liczniki: { rundy: 10, piesni: [], bogowie: [] } }), ctx())
        && !K('dziesiecObrzedow').warunek(stan({ liczniki: { rundy: 9, piesni: [], bogowie: [] } }), ctx()));
    spr('Rekord Plemienia', K('rekordPlemienia').warunek(stan(), ctx({ wynikKsiegi: { nowyRekord: true } }))
        && !K('rekordPlemienia').warunek(stan(), ctx({ wynikKsiegi: { nowyRekord: false, pierwszyWpis: true } })));
}

console.log('\nSEKRETY:');
{
    const bog = (b) => stan({ liczniki: { rundy: 0, piesni: [], bogowie: b } });
    spr('Bóg wśród Ludzi', K('bogWsrodLudzi').warunek(bog(['perun']), ctx()) && !K('bogWsrodLudzi').warunek(bog([]), ctx()));
    spr('Pięciu Bogów', K('pieciuBogow').warunek(bog(['perun', 'swarog', 'stribog', 'mokosz', 'weles']), ctx())
        && !K('pieciuBogow').warunek(bog(['perun', 'swarog', 'stribog', 'mokosz']), ctx()));
    spr('Godzina Duchów', K('godzinaDuchow').warunek(stan(), ctx({ teraz: new Date(2026, 1, 1, 1, 0) })) && !K('godzinaDuchow').warunek(stan(), ctx()));
    spr('Noc Kupały', K('nocKupaly').warunek(stan(), ctx({ teraz: new Date(2026, 5, 23, 23, 0) })) && !K('nocKupaly').warunek(stan(), ctx()));
    const tarcze = (n) => stan({ historia: Array.from({ length: n }, (_, i) => ev('technika', 'kamiennaTarcza', 50000 + i * 20000)) });
    spr('Kamienny Mur: 3 w 60 s', K('kamiennyMur').warunek(tarcze(3), ctx({ now: 100000 })) && !K('kamiennyMur').warunek(tarcze(2), ctx({ now: 100000 })));
}

process.exit(ok ? 0 : 1);
