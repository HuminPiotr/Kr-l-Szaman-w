// tools/test-sesja.mjs
/**
 * Maszyna stanów sesji nagraniowej.
 *
 *   node tools/test-sesja.mjs
 *
 * Sesja jest jedyną częścią harnessu, którą da się sprawdzić bez kamery
 * i bez DOM - i jednocześnie jedyną, której błąd zmarnowałby czas
 * właściciela projektu na powtórne nagranie. Stąd ten test.
 */
import { SesjaNagraniowa, SCENARIUSZ } from '../js/nagrywanie/sesja.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const DT = 1 / 60;

/** Przewija sesję o `sekundy`, zbierając wszystko, co po drodze zwróciła. */
function przewin(sesja, sekundy) {
  const klatki = [];
  for (let i = 0; i < Math.round(sekundy / DT); i++) klatki.push(sesja.tick(DT));
  return klatki;
}

console.log('SCENARIUSZ:');
spr('ma osiem kroków', SCENARIUSZ.length === 8);
spr('numery kroków to 1..8', SCENARIUSZ.every((k, i) => k.nr === i + 1));
spr('każdy krok ma niepusty opis dla gracza', SCENARIUSZ.every(k => k.opis && k.opis.length > 10));
spr('ostatni krok to taniec, jedno długie powtórzenie',
    SCENARIUSZ[7].id === 'taniec' && SCENARIUSZ[7].powtorzenia === 1 && SCENARIUSZ[7].czasS >= 30);
spr('pięć pierwszych kroków ma po trzy powtórzenia',
    SCENARIUSZ.slice(0, 5).every(k => k.powtorzenia === 3));
spr('każde powtórzenie pięciu pierwszych ma własną wskazówkę o zmianie miejsca',
    SCENARIUSZ.slice(0, 5).every(k => k.wskazowki.length === k.powtorzenia));

console.log('\nPRZEBIEG:');
const s = new SesjaNagraniowa();
spr('przed startem sesja jest bezczynna', !s.aktywna && s.tick(DT).stan === 'bezczynna');

s.start();
const poStarcie = s.tick(DT);
spr('start wchodzi w DOJŚCIE, nie od razu w nagrywanie', poStarcie.stan === 'dojscie');
spr('dojście jest długie - gracz musi odejść od klawiatury', poStarcie.pozostaloS > 10);
spr('w dojściu nic nie jest nagrywane', !s.nagrywa);

// Przewijamy przez dojście: pierwsze nagrywanie ma się zacząć samo.
const doNagrania = przewin(s, 12);
const start = doNagrania.find(k => k.sygnal === 'start');
spr('sygnał START pada dokładnie raz', doNagrania.filter(k => k.sygnal === 'start').length === 1);
spr('po sygnale START stan to nagrywanie', start && start.stan === 'nagrywanie');
spr('nagrywany jest krok 1, powtórzenie 1', start.krok.nr === 1 && start.powtorzenie === 1);
spr('etykieta klatki wiąże krok z powtórzeniem', start.etykieta === `${SCENARIUSZ[0].id}#1`);

// Nagrywanie trwa dokładnie tyle, ile mówi krok.
const wNagraniu = przewin(s, SCENARIUSZ[0].czasS - 0.5);
spr('przez cały czas kroku sesja nagrywa', wNagraniu.every(k => k.stan === 'nagrywanie'));
const poNagraniu = przewin(s, 1);
spr('sygnał STOP pada dokładnie raz', poNagraniu.filter(k => k.sygnal === 'stop').length === 1);
spr('po nagraniu wchodzi przerwa, nie następne nagranie',
    poNagraniu[poNagraniu.length - 1].stan === 'przerwa');

// Drugie powtórzenie tego samego kroku.
const drugie = przewin(s, 8).find(k => k.sygnal === 'start');
spr('drugie powtórzenie to ten sam krok, numer 2',
    drugie && drugie.krok.nr === 1 && drugie.powtorzenie === 2);
spr('etykieta drugiego powtórzenia jest inna', drugie.etykieta === `${SCENARIUSZ[0].id}#2`);

console.log('\nWEJŚCIE OD WYBRANEGO KROKU:');
const s2 = new SesjaNagraniowa();
s2.start(6);
const start6 = przewin(s2, 14).find(k => k.sygnal === 'start');
spr('start(6) nagrywa krok 6, nie krok 1', start6 && start6.krok.nr === 6);

console.log('\nKONIEC I PRZERWANIE:');
const s3 = new SesjaNagraniowa();
s3.start(8);                       // sam taniec: jedno powtórzenie
const przebieg = przewin(s3, 12 + SCENARIUSZ[7].czasS + 8);
spr('sesja sama dochodzi do końca', przebieg.some(k => k.sygnal === 'koniec'));
spr('sygnał KONIEC pada dokładnie raz', przebieg.filter(k => k.sygnal === 'koniec').length === 1);
spr('po końcu sesja jest bezczynna', !s3.aktywna);

const s4 = new SesjaNagraniowa();
s4.start();
s4.przerwij();
spr('przerwanie natychmiast kończy sesję', !s4.aktywna && !s4.nagrywa);

console.log('\nODPORNOŚĆ:');
const s5 = new SesjaNagraniowa();
s5.start();
spr('NaN w dt nie wywraca sesji', s5.tick(NaN).stan === 'dojscie');
spr('ogromne dt nie przeskakuje kroku', s5.tick(999).stan !== 'bezczynna');

process.exit(ok ? 0 : 1);
