/**
 * Menu - model ekranów i konfiguracji (czysta logika, bez DOM).
 *   node tools/test-menu.mjs
 */
import { Menu, KAMIENIE, EKRANY } from '../js/menu.js';
import { parsujKonfiguracje, PROBA_DLUGOSCI, PIESN_AWARYJNA_S, MAX_NICK, MAX_KRAG, MIN_KRAG } from '../js/tryby.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const piesni = [{ plik: 'a.m4a', tytul: 'Ogień w żyłach', dlugoscS: 262.8 }, { plik: 'b.m4a', tytul: 'Woda być', dlugoscS: 216.4 }];

console.log('START:');
{
    const m = new Menu({ piesni, ostatniNick: '  Ola  ' });
    spr('zaczyna na Polanie', m.ekran === 'polana' && EKRANY.includes(m.ekran));
    spr('cztery kamienie', KAMIENIE.join() === 'obrzed,proba,swobodny,ksiega');
    spr('ostatni nick wstępnie wypełniony (surowo - przycinany przy konfiguracji)', m.nick === '  Ola  ');
    spr('nick dłuższy niż limit ucięty', new Menu({ ostatniNick: 'x'.repeat(50) }).nick.length === MAX_NICK);
    spr('śmieci w konstruktorze nie rzucają', new Menu({ piesni: 'x', ostatniNick: null }).piesni.length === 0 && new Menu().ekran === 'polana');
}

console.log('\nKAMIENIE:');
{
    const m = new Menu({ piesni });
    spr('wszystkie dostępne, gdy są pieśni', KAMIENIE.every(k => m.dostepne(k)));
    spr('nieznany kamień niedostępny', m.dostepne('zeus') === false && m.dostepne(null) === false);
    const bez = new Menu({ piesni: [] });
    spr('Obrzęd przygaszony bez pieśni, reszta dostępna', bez.dostepne('obrzed') === false && bez.dostepne('proba') && bez.dostepne('swobodny') && bez.dostepne('ksiega'));
    spr('podpowiedź tłumaczy brak pieśni (ciepło)', /pieśni/.test(bez.podpowiedz('obrzed')) && bez.podpowiedz('proba') === '');
    spr('wybranie niedostępnego nie zmienia ekranu', bez.wybierz('obrzed') === false && bez.ekran === 'polana');
    spr('ustawPiesni po fakcie odblokowuje Obrzęd (manifest wczytuje się asynchronicznie)', (bez.ustawPiesni(piesni), bez.dostepne('obrzed')));
    spr('ustawPiesni(śmieci) = pusta lista', (() => { const x = new Menu({ piesni }); x.ustawPiesni(null); return x.piesni.length === 0; })());
    spr('Księga otwiera się bez konfiguracji', (() => { const x = new Menu({ piesni }); return x.wybierz('ksiega') && x.ekran === 'ksiega'; })());
    spr('tryb wybrany -> konfiguracja', (() => { const x = new Menu({ piesni }); return x.wybierz('proba') && x.ekran === 'konfig' && x.tryb === 'proba'; })());
}

console.log('\nUSTAWIENIA:');
{
    const m = new Menu({ piesni });
    m.wybierz('obrzed');
    spr('piesn: poprawny indeks', m.ustaw('piesn', 1) && m.piesn === 1);
    spr('piesn: poza zakresem/ułamek/tekst odrzucone', !m.ustaw('piesn', 5) && !m.ustaw('piesn', -1) && !m.ustaw('piesn', 0.5) && !m.ustaw('piesn', 'x') && m.piesn === 1);
    spr('czas: tylko z PROBA_DLUGOSCI', PROBA_DLUGOSCI.every(c => m.ustaw('czas', c)) && !m.ustaw('czas', 45) && !m.ustaw('czas', 'x'));
    spr('zew i krąg to przełączniki', m.ustaw('zew', true) && m.zew === true && m.ustaw('krag', 1) && m.krag === true);
    spr('nieznane pole odrzucone', m.ustaw('hack', 1) === false && m.ustaw('__proto__', 1) === false);
    spr('nick surowy do limitu (spacje w trakcie pisania zostają)', m.ustaw('nick', 'Ola Maria ') && m.nick === 'Ola Maria ');
    spr('nick ponad limit ucięty', (m.ustaw('nick', 'x'.repeat(40)), m.nick.length === MAX_NICK));
    spr('nick nie-tekst odrzucony', !m.ustaw('nick', null) && !m.ustaw('nick', 5));
}

console.log('\nKRĄG - LISTA TANCERZY:');
{
    const m = new Menu({ piesni });
    m.wybierz('proba'); m.ustaw('krag', true);
    spr('startuje z dwoma pustymi miejscami', m.nicki.length === MIN_KRAG);
    spr('dodajGracza do limitu', (() => { while (m.nicki.length < MAX_KRAG) m.dodajGracza(); return m.nicki.length === MAX_KRAG && m.dodajGracza() === false; })());
    spr('usunGracza do minimum', (() => { while (m.nicki.length > MIN_KRAG) m.usunGracza(0); return m.nicki.length === MIN_KRAG && m.usunGracza(0) === false; })());
    spr('ustawNick: poprawny indeks', m.ustawNick(0, 'Ola') && m.nicki[0] === 'Ola');
    spr('ustawNick: zły indeks/nie-tekst odrzucone', !m.ustawNick(9, 'x') && !m.ustawNick(-1, 'x') && !m.ustawNick(0, null) && !m.ustawNick(0.5, 'x'));
    spr('ustawNick ucina do limitu', (m.ustawNick(1, 'y'.repeat(40)), m.nicki[1].length === MAX_NICK));
    spr('usunGracza: zły indeks odrzucony', (() => { m.dodajGracza(); const n = m.nicki.length; return m.usunGracza(99) === false && m.nicki.length === n; })());
}

console.log('\nBŁĘDY (ciepłe zaproszenia):');
{
    const m = new Menu({ piesni, ostatniNick: '' });
    m.wybierz('proba');
    spr('pusty nick solo: zaproszenie, nie wyrok', m.bledy().length === 1 && /imi/i.test(m.bledy()[0]) && !/błąd|nie wolno|niepoprawn/i.test(m.bledy()[0]));
    spr('konfiguracja() = null przy błędach', m.konfiguracja() === null);
    m.ustaw('nick', '   ');
    spr('nick z samych spacji = nadal błąd', m.bledy().length === 1);
    m.ustaw('nick', 'Ola');
    spr('poprawny nick: brak błędów', m.bledy().length === 0 && m.konfiguracja() !== null);
    m.ustaw('krag', true);
    spr('Krąg z pustymi imionami: zaproszenie', m.bledy().length === 1 && /tancerz|imieni/i.test(m.bledy()[0]));
    m.ustawNick(0, 'Ola'); m.ustawNick(1, 'Bartek');
    spr('Krąg z kompletem imion: brak błędów', m.bledy().length === 0);
    m.ustawNick(1, '   ');
    spr('jedno imię z samych spacji = błąd', m.bledy().length === 1);
    spr('wszystkie komunikaty bez słów porażki', (() => {
        const w = new Menu({ piesni: [], ostatniNick: '' }); w.wybierz('proba'); w.ustaw('krag', true);
        return !/błąd|niepoprawn|nie wolno|źle/i.test(JSON.stringify([m.bledy(), w.bledy(), w.podpowiedz('obrzed')]));
    })());
}

console.log('\nKONFIGURACJA = KSZTAŁT parsujKonfiguracje (+ nick):');
{
    const klucze = (o) => Object.keys(o).filter(k => k !== 'nick').sort().join();
    const wzor = klucze(parsujKonfiguracje('?tryb=proba&czas=60'));

    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    m.wybierz('proba'); m.ustaw('czas', 120); m.ustaw('zew', true);
    const k = m.konfiguracja();
    spr('próba: klucze jak w parsujKonfiguracje', klucze(k) === wzor);
    spr('próba: wartości', k.tryb === 'proba' && k.dlugoscS === 120 && k.zew === true && k.krag === null && k.nick === 'Ola' && k.piesn === 0);

    const o = new Menu({ piesni, ostatniNick: 'Ola' });
    o.wybierz('obrzed'); o.ustaw('piesn', 1);
    const ko = o.konfiguracja();
    spr('obrzęd: indeks pieśni, długość awaryjna (prawdziwą ustawia main po załadowaniu)', ko.tryb === 'obrzed' && ko.piesn === 1 && ko.dlugoscS === PIESN_AWARYJNA_S && klucze(ko) === wzor);

    const kr = new Menu({ piesni });
    kr.wybierz('proba'); kr.ustaw('krag', true); kr.ustawNick(0, ' Ola '); kr.ustawNick(1, 'Bartek');
    const kk = kr.konfiguracja();
    spr('Krąg: nicki przycięte, nick solo = null', JSON.stringify(kk.krag) === '["Ola","Bartek"]' && kk.nick === null);

    const s = new Menu({ piesni });
    s.wybierz('swobodny');
    const ks = s.konfiguracja();
    spr('swobodny: bez opcji, zawsze poprawny', ks.tryb === 'swobodny' && ks.zew === false && ks.krag === null && ks.nick === null && ks.dlugoscS === 0 && klucze(ks) === wzor);
    s.ustaw('zew', true); s.ustaw('krag', true);
    spr('swobodny ignoruje Zew i Krąg', s.konfiguracja().zew === false && s.konfiguracja().krag === null);

    const bezTrybu = new Menu({ piesni });
    spr('bez wybranego trybu konfiguracja = null', bezTrybu.konfiguracja() === null);

    const przytniety = new Menu({ piesni });
    przytniety.wybierz('proba'); przytniety.ustaw('nick', '  Ola  ');
    spr('nick w konfiguracji przycięty', przytniety.konfiguracja().nick === 'Ola');
}

console.log('\nPRZEJŚCIA EKRANÓW:');
{
    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    m.wybierz('proba');
    spr('wstecz z konfiguracji -> Polana, tryb zapomniany', m.wstecz() === true && m.ekran === 'polana' && m.tryb === null);
    m.wybierz('ksiega');
    spr('wstecz z Księgi -> Polana', m.wstecz() === true && m.ekran === 'polana');
    spr('wstecz na Polanie nic nie robi', m.wstecz() === false && m.ekran === 'polana');
    m.wybierz('proba'); m.naGre();
    spr('naGre: ekran gra', m.ekran === 'gra');
    spr('wstecz z gry -> Polana', m.wstecz() === true && m.ekran === 'polana');
    m.naKronike({ tytul: 'x' });
    spr('naKronike: ekran i zawartość', m.ekran === 'kronika' && m.kronika.tytul === 'x');
    m.naGre();
    spr('naGre czyści Kronikę', m.kronika === null);
    m.naKronike({ tytul: 'y' }); m.doPolany();
    spr('doPolany z dowolnego ekranu czyści Kronikę i tryb', m.ekran === 'polana' && m.kronika === null && m.tryb === null);
}

console.log('\nZAJĘTY (REVIEW FOCUS 3 - podwójne kliknięcie podczas ładowania):');
{
    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    m.wybierz('proba');
    spr('wolny: można startować', m.zajety === false && m.konfiguracja() !== null);
    m.zajety = true;
    spr('zajęty: konfiguracja() dalej poprawna, ale UI blokuje przycisk (zajety)', m.konfiguracja() !== null && m.zajety === true);
    spr('zajęty: wstecz/wybierz nie ruszają ekranu', (() => { const e = m.ekran; m.wstecz(); m.wybierz('ksiega'); return m.ekran === e; })());
}

console.log('\nGRA AKTYWNA (final review: pieczęcie i techniki wyłączone pod menu):');
{
    const m = new Menu({ piesni });
    spr('Polana: gra nieaktywna', m.graAktywna === false);
    m.wybierz('proba');
    spr('konfiguracja: gra nieaktywna', m.graAktywna === false);
    m.doPolany(); m.wybierz('ksiega');
    spr('Księga: gra nieaktywna', m.graAktywna === false);
    m.doPolany(); m.naGre();
    spr('gra: aktywna', m.graAktywna === true);
    m.naKronike({ tytul: 'x' });
    spr('Kronika: aktywna (gracz może tańczyć i patrzeć na efekty)', m.graAktywna === true);
    m.doPolany();
    spr('po powrocie na Polanę znów nieaktywna', m.graAktywna === false);
}

console.log('\nZ ADRESU (skrót dewelopera):');
{
    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    spr('swobodny z adresu = nic (zostaje Polana)', m.zUrl(parsujKonfiguracje('')) === false && m.ekran === 'polana');
    spr('próba z adresu wypełnia konfigurację', m.zUrl(parsujKonfiguracje('?tryb=proba&czas=60&zew=1')) === true && m.ekran === 'konfig' && m.tryb === 'proba' && m.czas === 60 && m.zew === true);
    const o = new Menu({ piesni });
    spr('obrzęd z adresu: indeks pieśni', o.zUrl(parsujKonfiguracje('?tryb=obrzed&piesn=1')) === true && o.piesn === 1);
    const poza = new Menu({ piesni });
    poza.zUrl(parsujKonfiguracje('?tryb=obrzed&piesn=9'));
    spr('indeks pieśni spoza listy -> 0', poza.piesn === 0);
    const kr = new Menu({ piesni });
    kr.zUrl(parsujKonfiguracje('?tryb=proba&krag=Ola,Bartek,Cezary'));
    spr('Krąg z adresu wypełnia listę', kr.krag === true && kr.nicki.join() === 'Ola,Bartek,Cezary');
    const bez = new Menu({ piesni: [] });
    spr('obrzęd z adresu bez pieśni nie otwiera konfiguracji', bez.zUrl(parsujKonfiguracje('?tryb=obrzed')) === false && bez.ekran === 'polana');
    spr('śmieci nie rzucają', new Menu({ piesni }).zUrl(null) === false && new Menu({ piesni }).zUrl({}) === false);
}

process.exit(ok ? 0 : 1);
