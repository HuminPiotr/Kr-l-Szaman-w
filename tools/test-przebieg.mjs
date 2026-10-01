/**
 * Przebieg - orkiestrator rundy, Zewu i Kręgu (fałszywy zegar, bez DOM).
 *   node tools/test-przebieg.mjs
 */
import { Przebieg, decyzjaKlawisza } from '../js/przebieg.js';
import { parsujKonfiguracje, ODLICZANIE_S, WYBRZMIENIE_S, ZAPOWIEDZ_S, ZEW_START_S } from '../js/tryby.js';
import { KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Fałszywy zegar 60 FPS; zbiera zdarzenia z update(). */
function zegar(przebieg, start = 0) {
    const z = { now: start, zdarzenia: [] };
    z.krok = (sekundy) => {
        for (let i = 0; i < Math.round(sekundy * 60); i++) {
            z.now += 1000 / 60;
            z.zdarzenia.push(...przebieg.update(z.now));
        }
    };
    z.typy = () => z.zdarzenia.map(e => e.typ).join(',');
    return z;
}

const konfProba = (extra = '') => parsujKonfiguracje(`?tryb=proba&czas=60${extra}`);

console.log('PRZEBIEG POJEDYNCZEJ RUNDY:');
{
    const p = new Przebieg(konfProba());
    spr('przed startem NIEZACZETY', p.stan === 'NIEZACZETY');
    const z = zegar(p);
    p.start(z.now);
    spr('po starcie RUNDA', p.stan === 'RUNDA' && p.runda.stan === 'ODLICZANIE');
    z.krok(ODLICZANIE_S + 0.3);
    spr(`po odliczaniu zdarzenie 'trwa' (${z.typy()})`, z.typy() === 'trwa');
    z.krok(60);
    spr(`po czasie 'wybrzmienie' (${z.typy()})`, z.typy() === 'trwa,wybrzmienie');
    z.krok(WYBRZMIENIE_S + 0.3);
    spr(`po wybrzmieniu 'koniecRundy' (${z.typy()})`, z.typy() === 'trwa,wybrzmienie,koniecRundy');
    z.krok(10);
    spr('żadnych dodatkowych zdarzeń po KONIEC', z.typy() === 'trwa,wybrzmienie,koniecRundy');
    const pods = p.zapiszWynik(1234.7, { taniec: 100 }, { splecenia: 2 });
    spr('podsumowanie zawiera wynik', pods && pods.wynik === 1234.7 && pods.tryb === 'proba');
    spr('bez Kręgu: nick null, brak podium', pods.nick === null && pods.podium === null && pods.kragKoniec === null);
    spr('stan PODSUMOWANIE', p.stan === 'PODSUMOWANIE');
}

console.log('\nREVIEW FOCUS 2 - jedno koniecRundy:');
{
    const p = new Przebieg(konfProba());
    const z = zegar(p); p.start(z.now);
    z.krok(ODLICZANIE_S + 2);
    p.zakonczPiesn();            // ended pieśni...
    z.krok(0.5);
    p.zakonczPiesn();            // ...i drugie ended
    z.krok(60 + WYBRZMIENIE_S);  // ...a zegar i tak by dobiegł końca
    const ile = z.zdarzenia.filter(e => e.typ === 'koniecRundy').length;
    spr(`dokładnie jedno koniecRundy (${ile})`, ile === 1);
    const a = p.zapiszWynik(100, {}, {});
    const b = p.zapiszWynik(999, {}, {});
    spr('wynik zapisany raz (drugie zapiszWynik = null)', a !== null && b === null && a.wynik === 100);
}

console.log('\nREVIEW FOCUS 4 - Esc/Enter w złej fazie:');
{
    const p = new Przebieg(konfProba());
    const z = zegar(p); p.start(z.now);
    z.krok(ODLICZANIE_S + 5);
    spr('dalej() w trakcie rundy nic nie robi', p.dalej(z.now) === false && p.stan === 'RUNDA');
    spr('zapiszWynik w trakcie rundy = null', p.zapiszWynik(50, {}, {}) === null && p.stan === 'RUNDA');
    p.przerwij();
    spr('przerwij -> PRZERWANY', p.stan === 'PRZERWANY');
    spr('update po przerwaniu nie daje zdarzeń', p.update(z.now + 100000).length === 0);
    spr('zapiszWynik po przerwaniu = null (bez zapisu)', p.zapiszWynik(50, {}, {}) === null);
    spr('dalej() po przerwaniu = false', p.dalej(z.now) === false);
    const k = new Przebieg(konfProba());
    const zk = zegar(k); k.start(zk.now);
    zk.krok(ODLICZANIE_S + 60 + WYBRZMIENIE_S + 1);
    k.zapiszWynik(1, {}, {});
    k.przerwij();
    spr('przerwij w PODSUMOWANIU nie kasuje zapisanego wyniku', k.podsumowanie !== null && k.podsumowanie.wynik === 1);
}

console.log('\nDALEJ BEZ KRĘGU = TA SAMA RUNDA OD NOWA:');
{
    const p = new Przebieg(konfProba());
    const z = zegar(p); p.start(z.now);
    z.krok(ODLICZANIE_S + 60 + WYBRZMIENIE_S + 1);
    p.zapiszWynik(10, {}, {});
    const zdarzeniaPrzed = z.zdarzenia.length;
    spr('dalej w PODSUMOWANIU = true', p.dalej(z.now) === true);
    spr('znów RUNDA w ODLICZANIU', p.stan === 'RUNDA' && p.runda.stan === 'ODLICZANIE');
    spr('podsumowanie wyczyszczone', p.podsumowanie === null);
    z.krok(ODLICZANIE_S + 0.3);
    spr('druga runda też zgłasza trwa', z.zdarzenia.length === zdarzeniaPrzed + 1 && z.zdarzenia.at(-1).typ === 'trwa');
}

console.log('\nKRĄG - DWÓCH GRACZY:');
{
    const p = new Przebieg(konfProba('&krag=Ola,Bartek'));
    const z = zegar(p); p.start(z.now);
    spr('Krąg zaczyna od ZAPOWIEDZI', p.runda.stan === 'ZAPOWIEDZ');
    spr('pierwszy nick = Ola', p.nick === 'Ola');
    z.krok(ZAPOWIEDZ_S + ODLICZANIE_S + 60 + WYBRZMIENIE_S + 1);
    const pods = p.zapiszWynik(500, { techniki: 400 }, { splecenia: 0 });
    spr('wynik Oli', pods.nick === 'Ola' && pods.wynik === 500);
    spr('Krąg jeszcze trwa, następny: Bartek', pods.kragKoniec === false && pods.nastepny === 'Bartek' && pods.podium === null);
    spr('dalej startuje Bartka (ZAPOWIEDZ)', p.dalej(z.now) === true && p.nick === 'Bartek' && p.runda.stan === 'ZAPOWIEDZ');
    z.krok(ZAPOWIEDZ_S + ODLICZANIE_S + 60 + WYBRZMIENIE_S + 1);
    const pods2 = p.zapiszWynik(900, {}, {});
    spr('koniec Kręgu z podium', pods2.kragKoniec === true && pods2.nastepny === null && pods2.podium.map(w => w.nick).join('|') === 'Bartek|Ola');
    spr('dalej po końcu Kręgu startuje Krąg od nowa (Ola)', p.dalej(z.now) === true && p.nick === 'Ola' && p.krag.wyniki.length === 0);
}

console.log('\nZEW W PRZEBIEGU:');
{
    const bez = new Przebieg(konfProba());
    spr('bez zew=1 mnożnik zawsze 1', bez.zew === null && bez.mnoznikZewu('pieczec', 'swarog') === 1);
    const p = new Przebieg(konfProba('&zew=1'), { losowa: () => 0 });
    const z = zegar(p); p.start(z.now);
    z.krok(ODLICZANIE_S + 1);
    spr('w ODLICZANIU mnożnik 1 (nie punktuje)', p.mnoznikZewu('pieczec', 'swarog') === 1 && p.zew.zywiol === null);
    z.krok(ZEW_START_S + 0.5);
    const zywiol = p.zew.zywiol;
    spr(`po ${ZEW_START_S} s TRWA żywioł wybrany (${zywiol})`, typeof zywiol === 'string');
    spr('mnożnik 2 dla żywiołu', p.mnoznikZewu('pieczec', zywiol) === 2);
    const kombo = KOMBOSY.find(k => k.sekwencja.includes(zywiol));
    spr('mnożnik 2 dla techniki z żywiołem', p.mnoznikZewu('technika', kombo) === 2);
    z.krok(60);   // runda wchodzi w WYBRZMIENIE i dalej
    spr('w WYBRZMIENIU Zew nadal działa (punkty jeszcze płyną)', p.runda.stan === 'WYBRZMIENIE' ? p.mnoznikZewu('pieczec', p.zew.zywiol) === 2 : true);
    z.krok(WYBRZMIENIE_S + 1);
    spr('po KONIEC mnożnik 1', p.mnoznikZewu('pieczec', p.zew.zywiol) === 1);
    p.zapiszWynik(1, {}, {});
    p.dalej(z.now);
    spr('nowa runda = nowy Zew bez żywiołu', p.zew.zywiol === null);
}

console.log('\nSWOBODNY NIE MA PRZEBIEGU:');
{
    let rzucil = false;
    try { new Przebieg(parsujKonfiguracje('')); } catch { rzucil = true; }
    spr('Przebieg dla trybu swobodnego jest odrzucony (main.js trzyma null)', rzucil);
}

console.log('\nSTRAŻNIK WPIĘCIA W main.js:');
{
    const { readFileSync } = await import('node:fs');
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    // main.js nie da się zaimportować w node (DOM, kamera) - sprawdzamy WPIĘCIA tekstem,
    // żeby refaktor nie odpiął po cichu któregoś z kontraktów rundy.
    const MUSI = [
        ['przebieg.update(', 'pętla woła przebieg.update(now) co klatkę'],
        ["typ === 'trwa'", "reaguje na zdarzenie 'trwa' (reset modułów + start pieśni)"],
        ["typ === 'wybrzmienie'", "reaguje na zdarzenie 'wybrzmienie' (zanik pieśni)"],
        ["typ === 'koniecRundy'", "reaguje na zdarzenie 'koniecRundy' (zapis wyniku)"],
        ['przebieg.zapiszWynik(', 'zapisuje wynik przez Przebieg (zapis raz)'],
        ['swiezeModuly(', 'równy start przez fabrykę modułów'],
        ['punkty.mnoznikZewu', 'Zew wpięty w punktację'],
        ['punkty.aktywna =', 'punkty włączane/wyłączane stanem rundy (swobodny = wyłączone)'],
        ['parsujKonfiguracje(', 'konfiguracja z adresu'],
        ['.zakonczPiesn()', "koniec pieśni (ended) kończy rundę"],
        ["decyzja === 'zakoncz'", 'Esc przerywa rundę (decyzja z decyzjaKlawisza, bez zapisu)'],
        ['przebieg.dalej(', 'Enter na podsumowaniu startuje następną rundę'],
        ['rundaHud.update(', 'HUD rundy aktualizowany co klatkę']
    ];
    for (const [fragment, opis] of MUSI) spr(opis, main.includes(fragment));
    spr('Esc nie koliduje z sesją nagraniową debugHud', main.includes('debugHud.sesja.aktywna'));
}

console.log('\nDECYZJA KLAWISZA (final review: Enter odpalał ponownie przycisk startu, Esc ścigał się z debugHud):');
{
    spr('bez przebiegu (swobodny) żaden klawisz nic nie robi', decyzjaKlawisza('Escape', { stan: null, sesjaAktywna: false }) === null && decyzjaKlawisza('Enter', { stan: null, sesjaAktywna: false }) === null);
    spr('Esc w RUNDZIE -> zakoncz', decyzjaKlawisza('Escape', { stan: 'RUNDA', sesjaAktywna: false }) === 'zakoncz');
    spr('Esc w PODSUMOWANIU -> zakoncz (powrót do swobodnego)', decyzjaKlawisza('Escape', { stan: 'PODSUMOWANIE', sesjaAktywna: false }) === 'zakoncz');
    spr('Esc przy aktywnej sesji nagraniowej debugHud NIE przerywa rundy', decyzjaKlawisza('Escape', { stan: 'RUNDA', sesjaAktywna: true }) === null);
    spr('Enter w PODSUMOWANIU -> dalej', decyzjaKlawisza('Enter', { stan: 'PODSUMOWANIE', sesjaAktywna: false }) === 'dalej');
    spr('Enter w RUNDZIE nic nie robi (REVIEW FOCUS 4)', decyzjaKlawisza('Enter', { stan: 'RUNDA', sesjaAktywna: false }) === null);
    spr('inne klawisze nic nie robią', ['m', 'M', 'd', ' ', 'z', '1'].every(k => decyzjaKlawisza(k, { stan: 'RUNDA', sesjaAktywna: false }) === null));
}

console.log('\nSTRAŻNIK: przycisk startu i kolejność klawiatury w main.js (final review, Critical):');
{
    const { readFileSync } = await import('node:fs');
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    // Tekstowe, bo main.js nie importuje się w node - sprawdzają WPIĘCIA, nie zachowanie.
    spr('handler startu ma strażnika przed podwójnym uruchomieniem', /startBtn\.addEventListener\('click', async \(\) => \{\s*(\/\/[^\n]*\n\s*)*if \(startowano\) return;/.test(main));
    spr('przycisk startu wyłączany po starcie (nie fokusowalny, Enter go nie odpali)', main.includes('startBtn.disabled = true'));
    spr('błąd kamery zwalnia strażnika (można spróbować ponownie)', /startowano = false;[\s\S]{0,200}Błąd dostępu do kamery/.test(main));
    spr('handler klawiatury rundy woła decyzjaKlawisza', main.includes('decyzjaKlawisza('));
    spr('handler klawiatury rundy w fazie CAPTURE (przed listenerem debugHud)', /decyzjaKlawisza\([\s\S]{0,900}\}, true\);/.test(main));
    spr('Enter/Esc obsłużone przez preventDefault', main.includes('e.preventDefault()'));
}

process.exit(ok ? 0 : 1);
