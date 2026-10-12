/**
 * Pamięć Plemienia - odkrycia, zapis tylko przy zmianie, odporność na zepsute dane.
 *   node tools/test-odkrycia.mjs
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 */
import { Odkrycia, walidujOdkrycia, nazwaOdkrycia, KLUCZ_ODKRYC } from '../js/odkrycia.js';
import { KomboSilnik, KOMBOSY } from '../js/kombosy.js';
import { TECHNIKI } from '../js/katalog.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

function pamiec(start = {}) {
    const d = { ...start };
    const p = { d, zapisy: 0, getItem: (k) => d[k] ?? null, setItem: (k, v) => { p.zapisy++; d[k] = String(v); } };
    return p;
}
const zegar = () => new Date(2026, 9, 12, 15, 0);
const nowa = (p = pamiec()) => new Odkrycia(p, { zegar });
const ma = (lista, rodzaj, id) => lista.some(o => o.rodzaj === rodzaj && o.id === id);

/** Gra sekwencję pieczęci przez prawdziwy silnik kombosów (jak main.js). */
function zagraj(o, sekwencja, start = 1000, krok = 500) {
    const k = new KomboSilnik();
    const nowe = [];
    let t = start;
    for (const id of sekwencja) {
        nowe.push(...o.pieczec(id, t));
        const kombo = k.dodaj(id, t);
        if (kombo) nowe.push(...o.technika(kombo, t));
        t += krok;
    }
    return nowe;
}

console.log('ODKRYCIA:');
{
    const o = nowa();
    const nowe = zagraj(o, ['stribog', 'stribog']);
    spr('pierwsza pieczęć zwraca odkrycie pieczęci', ma(nowe, 'pieczec', 'stribog'));
    spr('combo zwraca odkrycie techniki', ma(nowe, 'technika', 'aard'));
    spr('pierwsza technika daje Pierwszą Iskrę', ma(nowe, 'kamien', 'pierwszaIskra'));
    spr('pieczęć odkryta raz, liczona dwa razy', nowe.filter(x => x.rodzaj === 'pieczec').length === 1 && o.pieczecie.stribog.n === 2);
    spr('drugi raz ta sama technika nie jest nowa', !ma(zagraj(o, ['stribog', 'stribog'], 90000), 'technika', 'aard'));
    spr('data pierwszego razu z zegara', o.techniki.aard.t === zegar().getTime());
}
{
    const o = nowa();
    const wariant = KOMBOSY.find(k => k.wariant);
    o.pieczec('swarog', 1); o.pieczec('mokosz', 2); o.pieczec('mokosz', 3); o.pieczec('stribog', 4);
    spr('wariant Tęczy odkrywa Tęczę', ma(o.technika(wariant, 4), 'technika', 'tecza') && !!o.techniki.tecza);
    spr('nieznana technika / pieczęć / węzeł = nic', o.technika({ id: 'x', sekwencja: ['a'] }, 5).length === 0
        && o.pieczec('x', 5).length === 0 && o.reakcja('x', 1, 5).length === 0);
    spr('śmieci nie rzucają', o.technika(null, 1).length === 0 && o.pieczec('swarog', NaN).length === 0 && o.reakcja('pozoga', NaN, 1).length === 0);
}

console.log('\nWĘZŁY:');
{
    const o = nowa();
    spr('n=0 nic nie odkrywa', o.reakcja('pozoga', 0, 1000).length === 0 && !o.wezly.pozoga);
    spr('pierwszy przejaw odkrywa węzeł', ma(o.reakcja('pozoga', 3, 1000), 'wezel', 'pozoga'));
    for (let t = 1016; t < 2000; t += 16) o.reakcja('pozoga', 1, t);
    spr('ciągły przejaw (co klatkę) liczy się raz', o.wezly.pozoga.n === 1);
    o.reakcja('pozoga', 1, 5000);
    spr('po przerwie > 1.5 s nowy przejaw', o.wezly.pozoga.n === 2);
    spr('historia węzła rzedzona (nie co klatkę)', o.historia.filter(e => e.id === 'pozoga').length < 10);
}

console.log('\nTRZYMANIE POZY I SPLOT:');
{
    const o = nowa();
    zagraj(o, ['weles', 'weles', 'weles', 'weles', 'weles'], 1000, 600);
    spr('trzymana ziemia: Tarcza liczona raz', o.techniki.kamiennaTarcza.n === 1);
    spr('trzymana ziemia: brak Kamiennego Muru', !o.kamienie.kamiennyMur);
    spr('trzymana ziemia: brak splotu', o.splotSeria === 0);
}
{
    const o = nowa();
    // Bania (mokosz,swarog) -> Tęcza (swarog,mokosz,stribog) -> Kurzawa (stribog,weles): dwa splecenia pod rząd.
    const nowe = zagraj(o, ['mokosz', 'swarog', 'mokosz', 'stribog', 'weles']);
    spr('łańcuch Bania -> Tęcza -> Kurzawa', !!o.techniki.bania && !!o.techniki.tecza && !!o.techniki.kurzawa);
    spr('Trójsplot', ma(nowe, 'kamien', 'trojsplot'));
    spr('Ogień i Woda (Bania, potem Tęcza)', ma(nowe, 'kamien', 'ogienIWoda'));
}
{
    const o = nowa();
    zagraj(o, ['weles', 'weles', 'weles'], 1000);
    zagraj(o, ['weles', 'weles', 'weles'], 20000);
    const nowe = zagraj(o, ['weles', 'weles', 'weles'], 40000);
    spr('trzy osobne Tarcze w minutę = Kamienny Mur', ma(nowe, 'kamien', 'kamiennyMur'));
}

console.log('\nKONIEC RUNDY, NICK, MANIFEST:');
{
    const o = nowa();
    o.ustawManifest(['a.m4a']);
    const pods = { wynik: 2000, dlugoscS: 60, momenty: { serie: {}, techniki: {} }, kragKoniec: null, podium: null };
    const nowe = o.koniecRundy(pods, { wynikKsiegi: { nowyRekord: true }, piesn: 'a.m4a' });
    spr('licznik rund', o.liczniki.rundy === 1);
    spr('Król Szamanów + Rekord + Pieśniarz', ma(nowe, 'kamien', 'krolSzamanow') && ma(nowe, 'kamien', 'rekordPlemienia') && ma(nowe, 'kamien', 'piesniarz'));
    o.koniecRundy(pods, { piesn: 'wlasna:x.mp3' });
    spr('własna pieśń nie trafia do pieśni plemienia', !o.liczniki.piesni.includes('wlasna:x.mp3'));
    spr('kamień nie jest zdobywany drugi raz', !ma(o.koniecRundy(pods, { wynikKsiegi: { nowyRekord: true } }), 'kamien', 'rekordPlemienia'));
    spr('nick boga', ma(o.nick('Perun 2'), 'kamien', 'bogWsrodLudzi') && o.liczniki.bogowie.includes('perun'));
    spr('zwykły nick nic', o.nick('Ola').length === 0);
    spr('koniecRundy na śmieciach', o.koniecRundy(null).length === 0);
}
{
    const o = new Odkrycia(pamiec(), { zegar: () => new Date(2026, 5, 23, 22, 0) });
    spr('Noc Kupały przy pierwszej pieczęci', ma(o.pieczec('mokosz', 1), 'kamien', 'nocKupaly'));
}

console.log('\nZAPIS TYLKO PRZY ZMIANIE:');
{
    const p = pamiec();
    const o = nowa(p);
    o.pieczec('mokosz', 1);
    const poOdkryciu = p.zapisy;
    spr('odkrycie zapisuje od razu', poOdkryciu >= 1 && p.d[KLUCZ_ODKRYC].includes('mokosz'));
    for (let t = 2; t < 200; t++) o.pieczec('mokosz', t * 7000);
    spr('same liczniki nie zapisują co zdarzenie', p.zapisy === poOdkryciu);
    o.zapiszJesliTrzeba();
    spr('zapiszJesliTrzeba zapisuje liczniki', p.zapisy === poOdkryciu + 1);
    o.zapiszJesliTrzeba();
    spr('drugi raz bez zmian nic nie pisze', p.zapisy === poOdkryciu + 1);
    const o2 = nowa(p);
    spr('wczytanie z pamięci', o2.pieczecie.mokosz?.n === o.pieczecie.mokosz.n && o2.trwala);
}

console.log('\nODPORNOŚĆ:');
{
    const rzuca = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    const o = new Odkrycia(rzuca, { zegar });
    spr('pamięć rzucająca: działa w procesie', ma(o.pieczec('perun', 1), 'pieczec', 'perun') && o.trwala === false);
    const pelna = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    const o2 = new Odkrycia(pelna, { zegar });
    o2.pieczec('perun', 1);
    spr('pełna pamięć: trwala=false, dalej działa', o2.trwala === false && !!o2.pieczecie.perun);
    spr('zepsuty JSON = start od zera', Object.keys(nowa(pamiec({ [KLUCZ_ODKRYC]: '{zepsute' })).techniki).length === 0);
    spr('bez pamięci (null) działa', new Odkrycia(null, { zegar }).pieczec('weles', 1).length > 0);
}
{
    const d = walidujOdkrycia({
        techniki: { aard: { n: 3, t: 5 }, usunietaTechnika: { n: 1, t: 1 }, ['__proto__']: { n: 1, t: 1 }, tecza: { n: 'x', t: 1 }, bania: { n: 1e30, t: 2 } },
        wezly: { pozoga: { n: -1, t: 1 }, syk: { n: 2, t: 3 } },
        kamienie: { trojsplot: { t: 9 }, nieznany: { t: 1 } },
        liczniki: { rundy: 'dużo', piesni: ['a', 5, 'a'], bogowie: ['perun', 'zeus'] },
        obejrzane: ['technika:aard', 'technika:nieznana', 'kamien:trojsplot', 7]
    });
    spr('znane id zostają', d.techniki.aard.n === 3 && d.wezly.syk.n === 2 && d.kamienie.trojsplot.t === 9);
    spr('usunięta technika i __proto__ odpadają', !('usunietaTechnika' in d.techniki) && Object.getPrototypeOf(d.techniki) === Object.prototype);
    spr('złe typy i ujemne odpadają', !d.techniki.tecza && !d.wezly.pozoga);
    spr('ogromne liczby przycięte', d.techniki.bania.n <= 1e9);
    spr('liczniki oczyszczone', d.liczniki.rundy === 0 && JSON.stringify(d.liczniki.piesni) === '["a"]' && JSON.stringify(d.liczniki.bogowie) === '["perun"]');
    spr('obejrzane tylko znane', JSON.stringify(d.obejrzane) === '["technika:aard","kamien:trojsplot"]');
    spr('nie-obiekt = null', walidujOdkrycia(null) === null && walidujOdkrycia([]) === null && walidujOdkrycia('x') === null);
}

console.log('\nSCALANIE (import Księgi):');
{
    const o = nowa();
    zagraj(o, ['stribog', 'stribog']);
    const nUzyc = o.techniki.aard.n;
    const wynik = o.scal({ techniki: { aard: { n: 99, t: 1 }, kurzawa: { n: 2, t: 7 } }, kamienie: { trojsplot: { t: 3 } }, liczniki: { rundy: 5, piesni: [], bogowie: ['weles'] } });
    spr('scal ok, dodano nowe', wynik.ok && wynik.dodano === 2);
    spr('max licznik, najwcześniejsza data', o.techniki.aard.n === Math.max(99, nUzyc) && o.techniki.aard.t === 1);
    spr('nic nie znika', !!o.pieczecie.stribog && !!o.kamienie.pierwszaIskra);
    spr('liczniki: max/suma zbiorów', o.liczniki.rundy === 5 && o.liczniki.bogowie.includes('weles'));
    spr('ten sam plik drugi raz nic nie dodaje', o.scal({ techniki: { kurzawa: { n: 2, t: 7 } } }).dodano === 0);
    spr('zły plik = ok:false', o.scal('x').ok === false);
}

console.log('\nOBEJRZANE I POSTĘP:');
{
    const o = nowa();
    zagraj(o, ['stribog', 'stribog']);
    spr('nowa technika jest nowa', o.czyNowe('technika', 'aard') && o.ileNowych('technika') === 1);
    o.oznaczObejrzane('technika', 'aard');
    spr('po obejrzeniu nie jest', !o.czyNowe('technika', 'aard') && o.ileNowych('technika') === 0);
    spr('nieodkryta nie jest „nowa"', !o.czyNowe('technika', 'tecza'));
    const p = o.postep();
    spr('postęp', p.techniki.ile === 1 && p.techniki.z === TECHNIKI.length && p.pieczecie.ile === 1 && p.kamienie.ile >= 1);
    spr('nazwy', nazwaOdkrycia('technika', 'aard') === 'Podmuch Striboga' && nazwaOdkrycia('wezel', 'pozoga') === 'Pożoga'
        && nazwaOdkrycia('pieczec', 'swarog') === 'Swaróg' && nazwaOdkrycia('kamien', 'trojsplot') === 'Trójsplot' && nazwaOdkrycia('x', 'y') === '');
}

process.exit(ok ? 0 : 1);
