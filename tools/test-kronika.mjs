/**
 * Kronika obrzędu - tytuły, przydomki, teksty (czysta logika).
 *   node tools/test-kronika.mjs
 */
import { PROGI_TYTULOW, punktyNaMinute, tytulZaWynik, PRZYDOMKI, przydomki, zbudujKronike } from '../js/kronika.js';
import { KOMBOSY } from '../js/kombosy.js';
import { REAKCJE } from '../js/punkty.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const pods = (nad = {}) => ({
    tryb: 'proba', nick: 'Ola', wynik: 1000, dlugoscS: 60,
    rozbicie: { taniec: 200, pieczecie: 100, techniki: 600, reakcje: 100 },
    momenty: { splecenia: 0, serie: {}, techniki: {} },
    kragKoniec: null, nastepny: null, podium: null, ...nad
});

console.log('PUNKTY NA MINUTĘ:');
spr('60 s: wynik = punkty/min', punktyNaMinute(600, 60) === 600);
spr('120 s: dwa razy mniej na minutę', punktyNaMinute(600, 120) === 300);
spr('długość 0/NaN -> awaryjne 90 s', punktyNaMinute(90, 0) === 60 && punktyNaMinute(90, NaN) === 60);
spr('wynik NaN/ujemny -> 0', punktyNaMinute(NaN, 60) === 0 && punktyNaMinute(-5, 60) === 0);

console.log('\nTYTUŁY ZA WYNIK:');
{
    const t = (w, d = 60) => tytulZaWynik(w, d).tytul;
    spr('<150/min = Kłoda', t(0) === 'Kłoda' && t(149) === 'Kłoda');
    spr('150-399 = Uczeń Ogniska', t(150) === 'Uczeń Ogniska' && t(399) === 'Uczeń Ogniska');
    spr('400-799 = Szeptucha', t(400) === 'Szeptucha' && t(799) === 'Szeptucha');
    spr('800-1299 = Żerca', t(800) === 'Żerca' && t(1299) === 'Żerca');
    spr('1300-1999 = Wołchw', t(1300) === 'Wołchw' && t(1999) === 'Wołchw');
    spr('>=2000 = Król Szamanów', t(2000) === 'Król Szamanów' && t(99999) === 'Król Szamanów');
    // 450 pkt/min: bezpiecznie w środku progu (nie na granicy 400, gdzie zaokrąglenia float mogłyby przeskoczyć tytuł).
    spr('to samo tempo, inna długość = ten sam tytuł (pieśń 4:23 vs próba 60 s)', tytulZaWynik(450 * 4.38, 262.8).tytul === tytulZaWynik(450, 60).tytul);
    spr('wynik NaN/null = Kłoda, bez wyjątku', t(NaN) === 'Kłoda' && t(null) === 'Kłoda' && t(undefined) === 'Kłoda');
    spr('każdy tytuł ma zdanie', PROGI_TYTULOW.every(p => typeof p.zdanie === 'string' && p.zdanie.length > 0));
    spr('Kłoda ma ciepłe zdanie o kłodzie', tytulZaWynik(0, 60).zdanie.toLowerCase().includes('kłody'));
    spr('progi rosnące', PROGI_TYTULOW.every((p, i) => i === 0 || p.do > PROGI_TYTULOW[i - 1].do));
    spr('ostatni próg nieskończony', PROGI_TYTULOW.at(-1).do === Infinity);
    spr('brak słów porażki w tytułach i zdaniach', !PROGI_TYTULOW.some(p => /przegra|niestety|słab|zły|źle|marn/i.test(p.tytul + p.zdanie)));
}

console.log('\nPRZYDOMKI - STRAŻNIK:');
{
    // Każda reguła odwołuje się do ISTNIEJĄCYCH pól. Zmiana id techniki albo reakcji
    // bez aktualizacji reguły = czerwony test, nie martwy przydomek.
    const idKombosow = KOMBOSY.map(k => k.id);
    spr('gromWOgniu istnieje w KOMBOSY', idKombosow.includes('gromWOgniu'));
    spr('gromWZiemie istnieje w KOMBOSY', idKombosow.includes('gromWZiemie'));
    spr('pozoga istnieje w REAKCJE', !!REAKCJE.pozoga);
    spr('rozwianie istnieje w REAKCJE', !!REAKCJE.rozwianie);
    for (const r of PRZYDOMKI) {
        spr(`reguła '${r.id}' ma nazwę i funkcję`, typeof r.nazwa === 'string' && r.nazwa.length > 0 && typeof r.pasuje === 'function');
        spr(`reguła '${r.id}' nie rzuca na pustych danych`, (() => { try { return typeof r.pasuje({}) === 'boolean' && typeof r.pasuje(null) === 'boolean'; } catch { return false; } })());
    }
    spr('id reguł unikalne', new Set(PRZYDOMKI.map(r => r.id)).size === PRZYDOMKI.length);
}

console.log('\nPRZYDOMKI:');
{
    spr('brak pasujących = pusta lista', przydomki(pods()).length === 0);
    spr('Podpalacz Chmur: seria Pożogi >= 40', przydomki(pods({ momenty: { serie: { pozoga: 40 }, techniki: {}, splecenia: 0 } })).includes('Podpalacz Chmur'));
    spr('seria 39 nie wystarcza', !przydomki(pods({ momenty: { serie: { pozoga: 39 }, techniki: {}, splecenia: 0 } })).includes('Podpalacz Chmur'));
    spr('Wiatrodmuch: seria Rozwiania >= 40', przydomki(pods({ momenty: { serie: { rozwianie: 55 }, techniki: {}, splecenia: 0 } })).includes('Wiatrodmuch'));
    spr('Tancerz Czystego Ruchu: taniec >= 60% wyniku', przydomki(pods({ wynik: 1000, rozbicie: { taniec: 650, pieczecie: 0, techniki: 0, reakcje: 0 } })).includes('Tancerz Czystego Ruchu'));
    spr('wynik 0 nie daje Tancerza (dzielenie przez zero)', !przydomki(pods({ wynik: 0, rozbicie: { taniec: 0 } })).includes('Tancerz Czystego Ruchu'));
    spr('Pan Pierunów: 3 grzmoty (Ogniu + Ziemię)', przydomki(pods({ momenty: { serie: {}, techniki: { gromWOgniu: 2, gromWZiemie: 1 }, splecenia: 0 } })).includes('Pan Pierunów'));
    spr('2 grzmoty nie wystarczą', !przydomki(pods({ momenty: { serie: {}, techniki: { gromWOgniu: 2 }, splecenia: 0 } })).includes('Pan Pierunów'));
    spr('Splatacz: >= 3 splecenia', przydomki(pods({ momenty: { serie: {}, techniki: {}, splecenia: 3 } })).includes('Splatacz'));
    const duzo = pods({ wynik: 1000, rozbicie: { taniec: 700 }, momenty: { serie: { pozoga: 50, rozwianie: 50 }, techniki: { gromWOgniu: 5 }, splecenia: 5 } });
    spr('maksymalnie 2 przydomki, w kolejności rejestru', przydomki(duzo).length === 2 && przydomki(duzo)[0] === PRZYDOMKI.find(r => r.pasuje(duzo)).nazwa);
    spr('null/puste dane nie rzucają', Array.isArray(przydomki(null)) && Array.isArray(przydomki({})));
}

console.log('\nKRONIKA:');
{
    const k = zbudujKronike(pods({ wynik: 1234.7, rozbicie: { taniec: 100.4, pieczecie: 75, techniki: 800, reakcje: 259.3 },
        momenty: { splecenia: 2, serie: { pozoga: 47 }, techniki: {} } }), { wynikKsiegi: null });
    spr('wynik zaokrąglony w dół, jako tekst', k.wynik === '1234');
    spr('tytuł z nickiem', k.tytul.includes('Ola'));
    spr('tytuł szamana z zdaniem', typeof k.szaman.tytul === 'string' && k.szaman.zdanie.length > 0);
    spr('rozbicie: 4 warstwy w liniach', k.linie.filter(l => /taniec|pieczęcie|techniki|reakcje/.test(l)).length === 4);
    spr('największa Pożoga w liniach', k.linie.some(l => l.includes('47')));
    spr('liczba spleceń w liniach', k.linie.some(l => l.includes('2')));
    spr('brak Księgi: pusty tekst miejsca', k.miejsce === '');
    spr('podpis zachęca (Enter/Esc), nie ocenia', /Enter/.test(k.podpis) && /Esc/.test(k.podpis));
    spr('ciepły ton: bez słów porażki', !/przegra|niestety|słab|zły|źle|marn/i.test(JSON.stringify(k)));
    spr('bez nicku: tytuł bez imienia', !zbudujKronike(pods({ nick: null }), {}).tytul.includes('null'));
}
{
    const wk = (nad) => zbudujKronike(pods(), { wynikKsiegi: { wpisano: true, miejsce: 3, nowyRekord: false, pierwszyWpis: false, ...nad } }).miejsce;
    spr('nowy rekord', /rekord/i.test(wk({ nowyRekord: true, miejsce: 1 })));
    spr('pierwszy zapis', /pierwszy/i.test(wk({ pierwszyWpis: true, miejsce: 1 })));
    spr('miejsce w Księdze', wk({}).includes('3'));
    const poza = zbudujKronike(pods(), { wynikKsiegi: { wpisano: false, miejsce: null, nowyRekord: false, pierwszyWpis: false } }).miejsce;
    spr('poza dziesiątką: ciepłe zdanie, bez wyroku', poza.length > 0 && !/przegra|niestety|słab|zły|źle|marn/i.test(poza));
}
{
    const solo = zbudujKronike(pods(), {}).podpis;
    const wToku = zbudujKronike(pods({ kragKoniec: false, nastepny: 'Bartek' }), {}).podpis;
    const koniec = zbudujKronike(pods({ kragKoniec: true, podium: [{ nick: 'Bartek', wynik: 900 }, { nick: 'Ola', wynik: 500 }] }), {});
    spr('solo: Enter jeszcze raz, Esc Polana', /Enter/.test(solo) && /Polan/.test(solo));
    spr('Krąg w toku: następny tancerz w podpisie', wToku.includes('Bartek'));
    spr('koniec Kręgu: podium z miejscami', koniec.podium.length === 2 && koniec.podium[0].miejsce === 1 && koniec.podium[0].nick === 'Bartek');
    spr('koniec Kręgu: osobisty zapis ostatniego gracza zostaje', koniec.szaman.tytul.length > 0 && koniec.linie.length > 0);
    spr('bez podium w zwykłej rundzie', zbudujKronike(pods(), {}).podium === null);
    spr('rozbicie/momenty null nie rzucają', zbudujKronike(pods({ rozbicie: null, momenty: null }), {}).wynik === '1000');
    spr('wynik NaN = 0', zbudujKronike(pods({ wynik: NaN }), {}).wynik === '0');
    spr('całkiem puste podsumowanie nie rzuca', zbudujKronike({}, {}).wynik === '0' && zbudujKronike(null, null).wynik === '0');
}

process.exit(ok ? 0 : 1);
