/**
 * Skala ciała i prymitywy styku.
 *
 *   node tools/test-styk.mjs
 *
 * Skala barków jest jednostką odniesienia dla WSZYSTKICH progów pieczęci
 * z pozy, więc jej błąd nie objawia się jako "ten jeden znak nie działa",
 * tylko jako "wszystkie znaki są za luźne, ale tylko czasem". Stąd osobny
 * test - to najbardziej podstępna wielkość w całym module.
 *
 * Bez obrotBokiem: poza błyskawicy ("stoisz bokiem"), jedyna konsumentka
 * tej funkcji, odpadła po pomiarze na żywym ciele - z 327 nagranych klatek
 * ani jedna nie osiągnęła realnego profilu. Test niezmienniczości na obrót
 * zostaje mimo to: gracz obraca się swobodnie podczas tańca, a skala musi
 * to znosić - to własność jednostki odniesienia, nie własność jednej pozy.
 */
import { skalaCiala, skalaChwilowa, aktualizujSkale, resetSkali, BARK_L, BARK_P } from '../js/znaki/postawa.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Barki o rozstawie 0.40 m obrócone o `kat` stopni wokół osi pionowej. */
function barki(kat) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const r = 0.20, a = kat * Math.PI / 180;
  wl[BARK_L] = { x: -r * Math.cos(a), y: -0.55, z: -r * Math.sin(a), visibility: 1 };
  wl[BARK_P] = { x: r * Math.cos(a), y: -0.55, z: r * Math.sin(a), visibility: 1 };
  return wl;
}

console.log('SKALA - niezmienniczość na obrót:');
resetSkali();
const przodem = skalaCiala(barki(0));
const skos = skalaCiala(barki(45));
const bokiem = skalaCiala(barki(90));
console.log(`  przodem ${przodem.toFixed(3)}  skos ${skos.toFixed(3)}  bokiem ${bokiem.toFixed(3)}`);
spr('przodem skala to realny rozstaw barków', Math.abs(przodem - 0.40) < 0.01);
spr('bokiem skala się NIE zapada (dawniej lądowała na podłodze 0.12)',
    Math.abs(bokiem - 0.40) < 0.01);
spr('na skos też bez zmian', Math.abs(skos - 0.40) < 0.01);

console.log('\nSKALA - odporność:');
resetSkali();
const zepsute = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 1 }));
spr('NaN daje podłogę, nie NaN', skalaCiala(zepsute) === 0.12);
resetSkali();
const zlepione = barki(0);
zlepione[BARK_L] = { x: 0, y: -0.55, z: 0, visibility: 1 };
zlepione[BARK_P] = { x: 0, y: -0.55, z: 0, visibility: 1 };
spr('barki w jednym punkcie dają podłogę, nie zero', skalaCiala(zlepione) === 0.12);

console.log('\nSKALA - wygładzanie:');
resetSkali();
// Skala jest STAŁĄ ciała, nie pomiarem z klatki: pojedynczy zepsuty odczyt
// nie może nią rzucić.
for (let i = 0; i < 60; i++) aktualizujSkale(barki(0), 1 / 60);
const stabilna = skalaCiala(barki(0));
spr('po 60 klatkach ustabilizowanej pozy skala to realny rozstaw',
    Math.abs(stabilna - 0.40) < 0.01);
const skok = barki(0);
skok[BARK_L] = { x: -0.60, y: -0.55, z: 0, visibility: 1 };   // absurdalny rozstaw 0.80
aktualizujSkale(skok, 1 / 60);
spr('jedna zepsuta klatka nie rusza wygładzonej skali',
    Math.abs(skalaCiala(skok) - stabilna) < 0.02);
// skalaChwilowa NIE jest wygładzona - musi natychmiast pokazać skok, inaczej
// powyższa asercja o niewzruszonej skalaCiala byłaby pusta (obie mogłyby po
// prostu zawsze zwracać to samo, wygładzone czy nie).
spr('skalaChwilowa (bez EMA) natychmiast pokazuje skok, w przeciwieństwie do skalaCiala',
    Math.abs(skalaChwilowa(skok) - 0.80) < 0.01);

console.log('\nSKALA - reset:');
// Rozpędzona EMA nie może przeciekać z jednego ciała/nagrania do następnego
// (tools/probki/: zadania 6 i 12 przetwarzają po kolei kilkanaście próbek
// w jednym procesie). Rozstawy 0.40 m i 0.20 m są na tyle odległe, że
// wygładzonej wartości nie da się pomylić z chwilową.
resetSkali();
for (let i = 0; i < 60; i++) aktualizujSkale(barki(0), 1 / 60);
resetSkali();
const inneCialo = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
inneCialo[BARK_L] = { x: -0.10, y: -0.55, z: 0, visibility: 1 };
inneCialo[BARK_P] = { x: 0.10, y: -0.55, z: 0, visibility: 1 };
spr('resetSkali czyści EMA - nowe ciało (0.20 m) liczy się od zera, nie ciągnie poprzedniego rozstawu (0.40 m)',
    Math.abs(skalaCiala(inneCialo) - 0.20) < 0.01);

process.exit(ok ? 0 : 1);
