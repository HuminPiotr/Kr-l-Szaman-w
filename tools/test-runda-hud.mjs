/**
 * HUD rundy - czyste funkcje (DOM sprawdzany w przeglądarce).
 *   node tools/test-runda-hud.mjs
 */
import { formatCzasu, tekstZewu, tekstPodsumowania, widokRundy, RundaHud } from '../js/rundaHud.js';
import { Przebieg } from '../js/przebieg.js';
import { parsujKonfiguracje, ODLICZANIE_S, ZAPOWIEDZ_S, ZEW_START_S } from '../js/tryby.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('CZAS:');
spr('65 s = 1:05', formatCzasu(65) === '1:05');
spr('60 s = 1:00', formatCzasu(60) === '1:00');
spr('59.2 s zaokrąglone w górę = 1:00', formatCzasu(59.2) === '1:00');
spr('0 s = 0:00', formatCzasu(0) === '0:00');
spr('ułamek poniżej sekundy = 0:01 (nie 0:00 przed końcem)', formatCzasu(0.3) === '0:01');
spr('NaN/ujemne/Infinity = 0:00', formatCzasu(NaN) === '0:00' && formatCzasu(-5) === '0:00' && formatCzasu(Infinity) === '0:00');
spr('4:23 (pieśń)', formatCzasu(262.8) === '4:23');

console.log('\nZEW:');
spr('baner z nazwą żywiołu', tekstZewu('swarog') === 'Duchy proszą: ogień ×2');
spr('brak żywiołu = pusty tekst', tekstZewu(null) === '');
spr('nieznany żywioł = pusty tekst (bez "undefined")', tekstZewu('xyz') === '');

console.log('\nPODSUMOWANIE:');
{
    const t = tekstPodsumowania({ tryb: 'proba', nick: null, wynik: 1234.7, rozbicie: { taniec: 100.4, pieczecie: 75, techniki: 800, reakcje: 259.3 },
                                  momenty: { splecenia: 2, serie: { pozoga: 47 } }, kragKoniec: null, nastepny: null, podium: null });
    spr('wynik zaokrąglony w dół', t.wynik === '1234');
    spr('rozbicie w liniach (4 warstwy)', t.linie.filter(l => /taniec|pieczęcie|techniki|reakcje/.test(l)).length === 4);
    spr('największa Pożoga w liniach', t.linie.some(l => l.includes('47')));
    spr('podpis zachęca (Enter/Esc), nie ocenia', /Enter/.test(t.podpis) && /Esc/.test(t.podpis));
    spr('ciepły ton: bez słów porażki', !/przegra|niestety|słab|zły|źle/i.test(JSON.stringify(t)));
    const kr = tekstPodsumowania({ tryb: 'proba', nick: 'Ola', wynik: 500, rozbicie: {}, momenty: {}, kragKoniec: false, nastepny: 'Bartek', podium: null });
    spr('Krąg w toku: tytuł z nickiem, następny w podpisie', kr.tytul.includes('Ola') && kr.podpis.includes('Bartek'));
    const pod = tekstPodsumowania({ tryb: 'proba', nick: 'Bartek', wynik: 900, rozbicie: {}, momenty: {}, kragKoniec: true, nastepny: null,
                                    podium: [{ nick: 'Bartek', wynik: 900 }, { nick: 'Ola', wynik: 500 }] });
    spr('koniec Kręgu: podium w liniach z miejscami', pod.linie[0].includes('1') && pod.linie[0].includes('Bartek') && pod.linie[1].includes('Ola'));
    const puste = tekstPodsumowania({ tryb: 'proba', nick: null, wynik: 0, rozbicie: null, momenty: null, kragKoniec: null, nastepny: null, podium: null });
    spr('rozbicie/momenty null nie rzucają', puste.wynik === '0');
    spr('wynik NaN = 0', tekstPodsumowania({ wynik: NaN, rozbicie: {}, momenty: {} }).wynik === '0');
}

console.log('\nWIDOK RUNDY:');
{
    const p = new Przebieg(parsujKonfiguracje('?tryb=proba&czas=60&zew=1&krag=Ola,Bartek'), { losowa: () => 0 });
    let now = 0;
    const krok = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { now += 1000 / 60; p.update(now); } };
    p.start(now);
    let w = widokRundy(p);
    spr('ZAPOWIEDZ: widoczna, z nickiem', w.zapowiedz === 'Teraz tańczy: Ola' && w.odliczanie === 0 && w.czas === '');
    krok(ZAPOWIEDZ_S + 0.3);
    w = widokRundy(p);
    spr('ODLICZANIE: cyfra, bez zapowiedzi', w.odliczanie >= 1 && w.zapowiedz === '');
    krok(ODLICZANIE_S + 0.3);
    w = widokRundy(p);
    spr('TRWA: czas, bez odliczania', w.odliczanie === 0 && /^\d+:\d\d$/.test(w.czas));
    spr('TRWA: bez Zewu przed ZEW_START_S', w.zew === '');
    krok(ZEW_START_S + 0.5);
    w = widokRundy(p);
    spr('TRWA: Zew widoczny po ZEW_START_S', w.zew.startsWith('Duchy proszą:'));
    krok(60);
    krok(3);
    w = widokRundy(p);
    spr('KONIEC (przed zapisem): brak podsumowania, brak czasu', w.koniec === null && w.czas === '');
    p.zapiszWynik(321, { taniec: 1 }, {});
    w = widokRundy(p);
    spr('PODSUMOWANIE: baner końca', w.koniec !== null && w.koniec.wynik === '321');
    const bezPrzebiegu = widokRundy(null);
    spr('brak przebiegu (swobodny): wszystko puste', bezPrzebiegu.zapowiedz === '' && bezPrzebiegu.odliczanie === 0 && bezPrzebiegu.czas === '' && bezPrzebiegu.zew === '' && bezPrzebiegu.koniec === null);
}

console.log('\nOSTATNIE SEKUNDY:');
{
    const p = new Przebieg(parsujKonfiguracje('?tryb=proba&czas=60'));
    let now = 0;
    const krok = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { now += 1000 / 60; p.update(now); } };
    p.start(now); krok(ODLICZANIE_S + 30);
    spr('w połowie: ostatnie = false', widokRundy(p).ostatnie === false);
    krok(25);
    spr('w ostatnich 10 s: ostatnie = true', widokRundy(p).ostatnie === true);
}

console.log('\nBEZ DOM:');
{
    const h = new RundaHud(null);
    spr('update bez elementów nie rzuca', (h.update(widokRundy(null)), true));
}

process.exit(ok ? 0 : 1);
