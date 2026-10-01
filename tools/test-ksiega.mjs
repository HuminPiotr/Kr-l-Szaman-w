/**
 * Księga Plemienia - tablice wyników, odporność na zepsute dane.
 *   node tools/test-ksiega.mjs
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 */
import {
    Ksiega, kluczKsiegi, nazwaTablicy, walidujWpis, walidujKsiege,
    MAX_WPISOW, MAX_TABLIC, MAX_PLIK_ZNAKOW, KLUCZ_PAMIECI, KLUCZ_NICKU
} from '../js/ksiega.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Atrapa localStorage z podglądem danych. */
function pamiec(start = {}) {
    const d = { ...start };
    return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); } };
}

console.log('KLUCZE TABLIC:');
{
    const utwor = { plik: 'Woda byc.m4a' };
    spr('obrzęd z pieśnią', kluczKsiegi({ tryb: 'obrzed', zew: false, dlugoscS: 216.4 }, utwor) === 'obrzed:Woda byc.m4a');
    spr('obrzęd ze Zewem ma sufiks (osobna tablica)', kluczKsiegi({ tryb: 'obrzed', zew: true, dlugoscS: 216.4 }, utwor) === 'obrzed:Woda byc.m4a+zew');
    spr('próba 60 s', kluczKsiegi({ tryb: 'proba', zew: false, dlugoscS: 60 }, null) === 'proba:60');
    spr('próba ze Zewem', kluczKsiegi({ tryb: 'proba', zew: true, dlugoscS: 120 }, null) === 'proba:120+zew');
    spr('obrzęd bez pieśni (awaria) wpada do próby 90 s', kluczKsiegi({ tryb: 'obrzed', zew: false, dlugoscS: 90 }, null) === 'proba:90');
    spr('swobodny nie ma tablicy', kluczKsiegi({ tryb: 'swobodny', zew: false, dlugoscS: 0 }, null) === null);
    spr('nieznana długość próby = brak tablicy', kluczKsiegi({ tryb: 'proba', zew: false, dlugoscS: 45 }, null) === null);
    spr('śmieci nie rzucają', kluczKsiegi(null, null) === null && kluczKsiegi({}, undefined) === null);
    spr('nazwa: próba', nazwaTablicy('proba:60') === 'Próba 60 s');
    spr('nazwa: próba ze Zewem', nazwaTablicy('proba:90+zew') === 'Próba 90 s ze Zewem');
    spr('nazwa: obrzęd z tytułem z manifestu', nazwaTablicy('obrzed:a.m4a', [{ plik: 'a.m4a', tytul: 'Ogień w żyłach' }]) === 'Obrzęd: Ogień w żyłach');
    spr('nazwa: obrzęd bez wpisu w manifeście = nazwa pliku bez rozszerzenia', nazwaTablicy('obrzed:Stara pieśń.m4a') === 'Obrzęd: Stara pieśń');
}

console.log('\nWALIDACJA WPISU:');
{
    spr('poprawny wpis', JSON.stringify(walidujWpis({ nick: 'Ola', wynik: 123.9, t: 5 })) === JSON.stringify({ nick: 'Ola', wynik: 123, t: 5 }));
    spr('nick przycięty do 16 znaków', walidujWpis({ nick: 'x'.repeat(40), wynik: 1, t: 1 }).nick.length === 16);
    spr('nick z białymi znakami na brzegach przycięty', walidujWpis({ nick: '  Ola  ', wynik: 1, t: 1 }).nick === 'Ola');
    spr('pusty nick odrzucony', walidujWpis({ nick: '   ', wynik: 1, t: 1 }) === null);
    spr('nick nie-tekst odrzucony', walidujWpis({ nick: 5, wynik: 1, t: 1 }) === null && walidujWpis({ nick: null, wynik: 1, t: 1 }) === null);
    spr('wynik NaN/ujemny/Infinity odrzucony', [NaN, -1, Infinity, '5', null].every(w => walidujWpis({ nick: 'a', wynik: w, t: 1 }) === null));
    spr('wynik 0 dozwolony (każdy tańczył)', walidujWpis({ nick: 'a', wynik: 0, t: 1 }).wynik === 0);
    spr('brak t odrzucony', walidujWpis({ nick: 'a', wynik: 1 }) === null && walidujWpis({ nick: 'a', wynik: 1, t: NaN }) === null);
    spr('null/liczba/tekst nie rzucają', walidujWpis(null) === null && walidujWpis(5) === null && walidujWpis('x') === null);
    spr('HTML w nicku zostaje tekstem (nie czyścimy - DOM używa textContent)', walidujWpis({ nick: '<b>x</b>', wynik: 1, t: 1 }).nick === '<b>x</b>');
}

console.log('\nDODAWANIE I SORTOWANIE:');
{
    const k = new Ksiega(null);
    const a = k.dodaj('proba:60', 'Ola', 500, 1);
    spr('pierwszy wpis: pierwszyWpis, bez koronacji', a.wpisano && a.miejsce === 1 && a.pierwszyWpis === true && a.nowyRekord === false);
    const b = k.dodaj('proba:60', 'Bartek', 300, 2);
    spr('niższy wynik: miejsce 2, nie rekord', b.miejsce === 2 && b.nowyRekord === false && b.pierwszyWpis === false);
    const c = k.dodaj('proba:60', 'Cezary', 900, 3);
    spr('wyższy wynik: miejsce 1 i NOWY REKORD', c.miejsce === 1 && c.nowyRekord === true);
    const d = k.dodaj('proba:60', 'Dorota', 900, 4);
    spr('remis z liderem: starszy wpis wyżej, brak rekordu (nie pobiła)', d.miejsce === 2 && d.nowyRekord === false);
    spr('kolejność: Cezary, Dorota, Ola, Bartek', k.tablica('proba:60').map(w => w.nick).join() === 'Cezary,Dorota,Ola,Bartek');
    spr('osobna tablica nie miesza wyników', k.dodaj('proba:60+zew', 'Ola', 10, 5).pierwszyWpis === true);
    spr('tablica() zwraca kopię', (() => { const t = k.tablica('proba:60'); t.length = 0; return k.tablica('proba:60').length === 4; })());
    spr('klucze() posortowane', k.klucze().join() === 'proba:60,proba:60+zew');
}
{
    const k = new Ksiega(null);
    for (let i = 0; i < 15; i++) k.dodaj('proba:90', `g${i}`, i * 10, i);
    spr(`tablica ma najwyżej ${MAX_WPISOW} wpisów`, k.tablica('proba:90').length === MAX_WPISOW);
    spr('odpadają najsłabsze', k.tablica('proba:90').at(-1).wynik === 50);
    const slaby = k.dodaj('proba:90', 'slaby', 1, 99);
    spr('wynik poniżej dziesiątki: wpisano=false, miejsce=null (ciepły komunikat w UI)', slaby.wpisano === false && slaby.miejsce === null && slaby.nowyRekord === false);
    spr('wynik równy ostatniemu, ale późniejszy, nie wypiera starszego', k.dodaj('proba:90', 'spozniony', 50, 100).wpisano === false);
}
{
    const k = new Ksiega(null);
    spr('zły klucz odrzucony', k.dodaj('zly klucz', 'Ola', 1, 1).wpisano === false && k.dodaj('__proto__', 'Ola', 1, 1).wpisano === false);
    spr('zły nick/wynik odrzucone', k.dodaj('proba:60', '', 1, 1).wpisano === false && k.dodaj('proba:60', 'Ola', NaN, 1).wpisano === false);
    spr('wynik ułamkowy zapisany jako całkowity', (k.dodaj('proba:60', 'Ola', 99.9, 1), k.tablica('proba:60')[0].wynik === 99));
    let proto = false;
    try { proto = ({}).polluted !== undefined; } catch { /* ignore */ }
    spr('Object.prototype niezatruty', proto === false);
}
{
    const k = new Ksiega(null);
    for (let i = 0; i < MAX_TABLIC + 10; i++) k.dodaj(`proba:${i}`.replace(/proba:(\d+)/, (_, n) => `obrzed:p${n}.m4a`), 'Ola', 1, 1);
    spr(`najwyżej ${MAX_TABLIC} tablic`, k.klucze().length === MAX_TABLIC);
}

console.log('\nTRWAŁOŚĆ (localStorage):');
{
    const p = pamiec();
    const k1 = new Ksiega(p);
    spr('pamięć działa: trwala=true', k1.trwala === true);
    k1.dodaj('proba:60', 'Ola', 500, 1);
    spr('zapis pod kluczem v1', typeof p.d[KLUCZ_PAMIECI] === 'string');
    const k2 = new Ksiega(p);
    spr('nowa instancja widzi wyniki', k2.tablica('proba:60')[0].nick === 'Ola');
}

console.log('\nREVIEW FOCUS 1 - uszkodzona/pełna/niedostępna pamięć:');
{
    const zepsuty = new Ksiega(pamiec({ [KLUCZ_PAMIECI]: '{to nie jest json' }));
    spr('zepsuty JSON w pamięci: pusta Księga, bez wyjątku', zepsuty.klucze().length === 0 && zepsuty.trwala === true);
    zepsuty.dodaj('proba:60', 'Ola', 1, 1);
    spr('po uszkodzeniu można dalej zapisywać', zepsuty.tablica('proba:60').length === 1);

    const polowa = new Ksiega(pamiec({ [KLUCZ_PAMIECI]: JSON.stringify({ wersja: 1, tablice: {
        'proba:60': [{ nick: 'Dobry', wynik: 10, t: 1 }, { nick: '', wynik: 5, t: 1 }, { nick: 'Zly', wynik: -1, t: 1 }, null, 7],
        'zly klucz': [{ nick: 'x', wynik: 1, t: 1 }]
    } }) }));
    spr('wpisy uszkodzone odpadają, dobre zostają', polowa.tablica('proba:60').length === 1 && polowa.tablica('proba:60')[0].nick === 'Dobry');
    spr('uszkodzony klucz odpada', polowa.klucze().join() === 'proba:60');

    const rzuca = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
    const k = new Ksiega(rzuca);
    spr('pamięć rzucająca przy odczycie: trwala=false, bez wyjątku', k.trwala === false);
    const w = k.dodaj('proba:60', 'Ola', 5, 1);
    spr('mimo to zapisuje w pamięci procesu', w.wpisano === true && k.tablica('proba:60').length === 1);

    let zapisy = 0;
    const pelna = { getItem: () => null, setItem() { zapisy++; throw new Error('QuotaExceededError'); } };
    const kp = new Ksiega(pelna);
    const wp = kp.dodaj('proba:60', 'Ola', 5, 1);
    spr('QuotaExceeded przy zapisie: wynik nadal przyjęty, trwala=false', wp.wpisano === true && kp.trwala === false && zapisy === 1);
    kp.dodaj('proba:60', 'Jan', 6, 2);
    spr('po niepowodzeniu nie męczy pamięci kolejnymi zapisami', zapisy === 1);

    spr('brak pamięci (null): trwala=false, działa', new Ksiega(null).trwala === false && new Ksiega(undefined).dodaj('proba:60', 'a', 1, 1).wpisano === true);
}

console.log('\nREVIEW FOCUS 2 - EKSPORT I IMPORT:');
{
    const k = new Ksiega(null);
    k.dodaj('proba:60', 'Ola', 500, 1); k.dodaj('proba:60', 'Bartek', 300, 2);
    const plik = k.eksportuj();
    spr('eksport to poprawny JSON z wersją', JSON.parse(plik).wersja === 1 && Object.keys(JSON.parse(plik).tablice).join() === 'proba:60');

    const inny = new Ksiega(null);
    inny.dodaj('proba:60', 'Cezary', 400, 3);
    const r = inny.importuj(plik);
    spr('import scala (nie nadpisuje)', r.ok === true && r.dodano === 2 && inny.tablica('proba:60').map(w => w.nick).join() === 'Ola,Cezary,Bartek');
    const r2 = inny.importuj(plik);
    spr('ten sam plik drugi raz nie dubluje wpisów', r2.ok === true && r2.dodano === 0 && inny.tablica('proba:60').length === 3);

    spr('za duży plik odrzucony bez zmian', (() => { const x = new Ksiega(null); const rr = x.importuj('x'.repeat(MAX_PLIK_ZNAKOW + 1)); return rr.ok === false && rr.powod === 'rozmiar' && x.klucze().length === 0; })());
    spr('nie-JSON odrzucony', new Ksiega(null).importuj('to nie json').ok === false);
    spr('JSON bez tablic odrzucony', new Ksiega(null).importuj('{"a":1}').ok === false && new Ksiega(null).importuj('[]').ok === false && new Ksiega(null).importuj('null').ok === false);
    spr('nie-tekst odrzucony', new Ksiega(null).importuj(null).ok === false && new Ksiega(null).importuj(5).ok === false);

    const zlosliwy = new Ksiega(null);
    const rz = zlosliwy.importuj('{"wersja":1,"tablice":{"__proto__":[{"nick":"x","wynik":1,"t":1}],"constructor":[{"nick":"x","wynik":1,"t":1}],"proba:60":[{"nick":"<script>alert(1)</script>","wynik":9,"t":1}]}}');
    spr('klucze __proto__/constructor ignorowane', rz.ok === true && zlosliwy.klucze().join() === 'proba:60');
    spr('prototyp niezatruty po imporcie', ({}).nick === undefined && Object.getPrototypeOf(zlosliwy.tablice) === Object.prototype);
    spr('nick z HTML zostaje tekstem, przycięty do 16', zlosliwy.tablica('proba:60')[0].nick === '<script>alert(1)'.slice(0, 16));

    const wiele = {}; for (let i = 0; i < 200; i++) wiele[`obrzed:p${i}.m4a`] = [{ nick: 'a', wynik: 1, t: 1 }];
    const kw = new Ksiega(null);
    kw.importuj(JSON.stringify({ wersja: 1, tablice: wiele }));
    spr(`import tysięcy tablic ucięty do ${MAX_TABLIC}`, kw.klucze().length <= MAX_TABLIC);

    const dlugi = {}; dlugi['proba:60'] = Array.from({ length: 500 }, (_, i) => ({ nick: `g${i}`, wynik: i, t: i }));
    const kd = new Ksiega(null);
    kd.importuj(JSON.stringify({ wersja: 1, tablice: dlugi }));
    spr(`długa tablica z pliku ucięta do ${MAX_WPISOW}`, kd.tablica('proba:60').length === MAX_WPISOW && kd.tablica('proba:60')[0].wynik === 499);

    const p = pamiec();
    const kz = new Ksiega(p);
    kz.importuj(plik);
    spr('import zapisuje do pamięci', new Ksiega(p).tablica('proba:60').length === 2);
}

console.log('\nWYCZYŚĆ:');
{
    const p = pamiec();
    const k = new Ksiega(p);
    k.dodaj('proba:60', 'Ola', 5, 1);
    k.wyczysc();
    spr('wyczysc() opróżnia Księgę i pamięć', k.klucze().length === 0 && new Ksiega(p).klucze().length === 0);
}

console.log('\nNICK:');
{
    const p = pamiec();
    const k = new Ksiega(p);
    spr('początkowo pusty', k.ostatniNick() === '');
    k.zapamietajNick('  Ola  ');
    spr('zapamiętany i przycięty', k.ostatniNick() === 'Ola' && p.d[KLUCZ_NICKU] === 'Ola');
    k.zapamietajNick('x'.repeat(40));
    spr('przycięty do 16', k.ostatniNick().length === 16);
    k.zapamietajNick('   ');
    spr('pusty nick nie nadpisuje poprzedniego', k.ostatniNick().length === 16);
    spr('pamięć rzucająca nie wywala nicku', (() => { try { new Ksiega({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }).zapamietajNick('Ola'); return true; } catch { return false; } })());
    spr('nick z pamięci jest walidowany (śmieci -> pusty)', new Ksiega(pamiec({ [KLUCZ_NICKU]: '   ' })).ostatniNick() === '');
}

console.log('\nwalidujKsiege:');
{
    spr('null/liczba/tablica -> null', walidujKsiege(null) === null && walidujKsiege(5) === null && walidujKsiege([]) === null && walidujKsiege({ tablice: 'x' }) === null);
    spr('poprawna struktura -> tablice posortowane i ucięte', (() => {
        const w = walidujKsiege({ tablice: { 'proba:60': [{ nick: 'a', wynik: 1, t: 1 }, { nick: 'b', wynik: 9, t: 2 }] } });
        return w.tablice['proba:60'][0].nick === 'b';
    })());
}

process.exit(ok ? 0 : 1);
