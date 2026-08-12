/**
 * Impuls wyładowania w aurze.
 *
 *   node tools/test-aura-impuls.mjs
 *
 * main.js podaje moc prosto do aury, a aura jest deklarowaną nagrodą całej
 * gry (GEMINI.md:7, 37). Gdyby czytała moc surową, KAŻDA PIECZĘĆ
 * PRZYGASZAŁABY AURĘ o swój koszt - czyli zabierała dokładnie to, co taniec
 * zarobił, a wielokrotne rzucanie dawałoby coraz ciemniejszego szamana.
 * Impuls odwraca odczyt: wydatek ma wyglądać jak WYŁADOWANIE, nie jak strata.
 *
 * Test nie potrzebuje DOM - przy masce null updateAndDraw wraca wcześnie,
 * już PO wygładzeniu i rozpadzie impulsu.
 */
import { Aura, barwaAury } from '../js/aura.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const fit = { offsetX: 0, offsetY: 0, scaledW: 1, scaledH: 1 };
const DT = 1 / 60;
const nowa = () => new Aura({ width: 1920, height: 1080 }, null);
const przepusc = (a, moc, sekundy) => {
  for (let i = 0; i < Math.round(sekundy / DT); i++) {
    a.updateAndDraw(null, 0, 0, moc, 1, fit, DT);
  }
};

console.log('IMPULS:');
const a1 = nowa();
spr(`świeża aura ma impuls zero (${a1._impuls})`, a1._impuls === 0);
a1.rozblysk(1);
spr(`rozblysk() podnosi impuls (${a1._impuls.toFixed(2)})`, a1._impuls > 0.9);

przepusc(a1, 0.5, 0.1);
const poKrotkiej = a1._impuls;
spr(`po 0.1 s impuls jeszcze świeci (${poKrotkiej.toFixed(2)})`, poKrotkiej > 0.5);
przepusc(a1, 0.5, 1.5);
spr(`po 1.6 s impuls zgasł (${a1._impuls.toFixed(3)})`, a1._impuls < 0.05);

console.log('\nIMPULS NIE PRZEKRACZA SKALI:');
const a2 = nowa();
a2.rozblysk(1); a2.rozblysk(1); a2.rozblysk(1);
spr(`potrójny rozbłysk nie wychodzi ponad 1 (${a2._impuls.toFixed(2)})`, a2._impuls <= 1);

console.log('\nWYDATEK CZYTA SIĘ JAK WYŁADOWANIE:');
// Scenariusz właściwy: pełna moc, złożenie pieczęci (moc -10% + rozbłysk).
// Jasność efektywna zaraz po pieczęci musi być WYŻSZA niż przed nią.
//
// Suma _moc + _impuls jest DOKŁADNIE tym, czym steruje renderer - dlatego
// mocEfektywna w aura.js nie jest clampowana do 1. Gdyby była, ten test
// mierzyłby liczbę, której rysowanie nigdy nie widzi, i przechodziłby
// przy zupełnie martwym efekcie.
const a3 = nowa();
przepusc(a3, 1.0, 3);                       // aura dogoniła pełną moc
const przed = a3._moc + a3._impuls;
a3.rozblysk(1);
przepusc(a3, 0.9, 0.1);                     // moc spadła o koszt pieczęci
const po = a3._moc + a3._impuls;
spr(`zaraz po pieczęci aura jest JAŚNIEJSZA (${przed.toFixed(2)} -> ${po.toFixed(2)})`, po > przed);

console.log('\nODPORNOŚĆ NA NaN:');
const a4 = nowa();
a4.rozblysk(NaN);
spr(`rozblysk(NaN) nie zatruwa impulsu (${a4._impuls})`, Number.isFinite(a4._impuls));
a4.updateAndDraw(null, 0, 0, NaN, NaN, fit, DT);
spr(`klatka z NaN nie zatruwa mocy (${a4._moc})`, Number.isFinite(a4._moc));

console.log('\nBARWA - normalna vs. tęczowa:');

// Bez tęczy: zachowanie IDENTYCZNE jak dziś - interpolacja bursztyn<->fiolet
// po płynności. Wartości referencyjne z _barwa() sprzed wydzielenia.
const plynna = barwaAury(1, null);
spr(`płynność=1 daje bursztyn (h=${plynna.h.toFixed(0)})`, Math.abs(plynna.h - 35) < 1);
const szarpana = barwaAury(0, null);
spr(`płynność=0 daje fiolet (h=${szarpana.h.toFixed(0)})`, Math.abs(szarpana.h - 265) < 1);
const posrednia = barwaAury(0.5, null);
spr(`płynność=0.5 jest DOKŁADNIE między nimi (h=${posrednia.h.toFixed(0)})`,
    Math.abs(posrednia.h - (35 + 265) / 2) < 1);

// Z NIEAKTYWNĄ teczą (aktywna: false) - też normalne zachowanie, płynność
// dalej rządzi, niezależnie od tego, co niesie barwaHue.
const teczaNieaktywna = { aktywna: false, barwaHue: 999, silaSladu: 0 };
const zNieaktywna = barwaAury(1, teczaNieaktywna);
spr(`tecza NIEaktywna -> zachowanie normalne, ignoruje barwaHue (h=${zNieaktywna.h.toFixed(0)})`,
    Math.abs(zNieaktywna.h - 35) < 1);

// Z AKTYWNĄ teczą: barwa idzie z tecza.barwaHue, NIEZALEŻNIE od płynności.
const teczaAktywna = { aktywna: true, barwaHue: 180, silaSladu: 1 };
const zAktywna1 = barwaAury(1, teczaAktywna);
const zAktywna0 = barwaAury(0, teczaAktywna);
spr(`tecza AKTYWNA -> barwa z barwaHue (${zAktywna1.h}), NIE z płynności`,
    zAktywna1.h === 180);
spr(`  ...niezależnie od płynności (${zAktywna1.h} === ${zAktywna0.h})`,
    zAktywna1.h === zAktywna0.h);

process.exit(ok ? 0 : 1);
