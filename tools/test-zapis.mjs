// tools/test-zapis.mjs
/**
 * Format próbek: zapis, odczyt i to, czego zapis NIE zapisuje.
 *
 *   node tools/test-zapis.mjs
 *
 * Ten plik jest jedynym miejscem, które wie, jak wygląda JSON w
 * tools/probki/. Zapis i odczyt siedzą razem, żeby nie dało się zmienić
 * jednego bez drugiego - nagrania są nieodtwarzalne, więc niezgodność
 * formatu kosztowałaby powtórną sesję.
 */
import { ZapisProbek, odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { widoczne } from '../js/znaki/postawa.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// dt = 0.0234 celowo różne od 1/60 (0.016667...) - to samo 1/60 jest
// wartością awaryjną w odtworzKlatke(), więc test na dt musi użyć innej
// liczby, inaczej sprawdzałby fallback zamiast rzeczywistego odtwarzania.
function klatka({ vis = 1, dlonie = 1, dt = 0.0234 } = {}) {
  const wl = Array.from({ length: 33 }, (_, i) => ({
    x: 0.111111 + i / 1000, y: -0.555555, z: 0.123456, visibility: vis
  }));
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
  const hands = Array.from({ length: dlonie }, () => ({
    handedness: 'Left',
    landmarks: Array.from({ length: 21 }, () => ({ x: 0.4, y: 0.4, z: 0 }))
  }));
  return { hands, pose: { landmarks: lm, worldLandmarks: wl }, width: 1920, height: 1080, dt, now: 0 };
}

console.log('ZAPIS:');
const z = new ZapisProbek();
spr('nowy zapis jest pusty', z.liczbaKlatek === 0);

z.dodaj('ogien#1', klatka());
z.dodaj('ogien#1', klatka());
z.dodaj('ogien#2', klatka());
spr('klatki się liczą', z.liczbaKlatek === 3);

const json = z.doJson();
spr('klatki są pogrupowane po etykiecie', Object.keys(json.kroki).sort().join(',') === 'ogien#1,ogien#2');
spr('grupa ma tyle klatek, ile dodano', json.kroki['ogien#1'].length === 2);
spr('plik nosi numer wersji formatu', typeof json.wersja === 'number');

console.log('\nROZMIAR:');
const dlugie = JSON.stringify(json).match(/\d+\.\d{5,}/g);
spr('żadna liczba nie ma więcej niż 3 miejsca po przecinku', dlugie === null);

console.log('\nODCZYT:');
const odtworzona = odtworzKlatke(json.kroki['ogien#1'][0]);
spr('odtworzona klatka ma worldLandmarks', Array.isArray(odtworzona.pose.worldLandmarks));
spr('odtworzona klatka ma 33 punkty pozy', odtworzona.pose.worldLandmarks.length === 33);
spr('punkt ma pola x/y/z/visibility, których oczekuje postawa.js',
    ['x', 'y', 'z', 'visibility'].every(k => Number.isFinite(odtworzona.pose.worldLandmarks[0][k])));
spr('wartości przetrwały zaokrąglenie z sensowną dokładnością',
    Math.abs(odtworzona.pose.worldLandmarks[0].x - 0.111111) < 0.001);
// x/y/z/visibility osobno - inaczej zamiana kolejności pól w spakujPunkt()
// (np. z zamiast visibility) przeszłaby niezauważona, a to dokładnie ta
// pomyłka, przed którą ma bronić trzymanie zapisu i odczytu w jednym pliku.
spr('y przetrwało zaokrąglenie', Math.abs(odtworzona.pose.worldLandmarks[0].y - (-0.555555)) < 0.001);
spr('z przetrwało zaokrąglenie', Math.abs(odtworzona.pose.worldLandmarks[0].z - 0.123456) < 0.001);
spr('visibility przetrwało zaokrąglenie', odtworzona.pose.worldLandmarks[0].visibility === 1);
spr('landmarks 2D (nie worldLandmarks) wracają jako pose.landmarks, którego wymaga swarog.js',
    odtworzona.pose.landmarks.length === 33 && Math.abs(odtworzona.pose.landmarks[0].x - 0.5) < 0.001);
spr('dłonie wracają z landmarkami', odtworzona.hands.length === 1 && odtworzona.hands[0].landmarks.length === 21);
spr('odtworzone dt to zapisana wartość, nie awaryjne 1/60',
    Number.isFinite(odtworzona.dt) && Math.abs(odtworzona.dt - 0.0234) < 0.001);

console.log('\nBRAK DANYCH:');
const z2 = new ZapisProbek();
z2.dodaj('taniec#1', { hands: [], pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0 });
const bezPozy = odtworzKlatke(z2.doJson().kroki['taniec#1'][0]);
spr('klatka bez pozy zapisuje się i wraca jako brak pozy', bezPozy.pose === null);
spr('klatka bez dłoni wraca z pustą tablicą', Array.isArray(bezPozy.hands) && bezPozy.hands.length === 0);

console.log('\nZEPSUTA WSPÓŁRZĘDNA (NaN):');
// Punkt bez pomiaru (NaN, np. MediaPipe nie wykrył) nie może udawać
// zmierzonego zera - inaczej przejdzie bramkę widoczne() z postawa.js
// jako w pełni pewna geometria w środku układu współrzędnych.
const zepsuta = klatka();
zepsuta.pose.worldLandmarks[5] = { x: NaN, y: -0.2, z: 0.1, visibility: 1 };
const z3 = new ZapisProbek();
z3.dodaj('test#1', zepsuta);
const odNaN = odtworzKlatke(z3.doJson().kroki['test#1'][0]);
spr('NaN we współrzędnej przechodzi zapis i odczyt jako NaN, nie jako 0',
    !Number.isFinite(odNaN.pose.worldLandmarks[5].x));
// Nie samo "null" - null w arytmetyce cicho przechodzi na 0 (null - x === -x),
// więc gdyby coś policzyło różnicę zanim sprawdzi widoczne(), błąd by wrócił
// tylnymi drzwiami. NaN zatruwa każde działanie, więc typeof musi dać
// 'number', nie 'object' (typeof null).
spr('to naprawdę NaN, nie null - żeby zatruwało arytmetykę zamiast cicho udawać zero',
    typeof odNaN.pose.worldLandmarks[5].x === 'number' && Number.isNaN(odNaN.pose.worldLandmarks[5].x));
spr('klatka z takim punktem NIE przechodzi bramki widoczne() z postawa.js',
    !widoczne(odNaN.pose.worldLandmarks, [5]));
spr('zdrowy punkt w tej samej klatce nadal przechodzi widoczne()',
    widoczne(odNaN.pose.worldLandmarks, [0]));
spr('zdrowy punkt przechodzi round-trip bez zmiany mimo sąsiedztwa zepsutego',
    Math.abs(odNaN.pose.worldLandmarks[0].x - 0.111111) < 0.001);

console.log('\nNAZWA PLIKU:');
spr('nazwa pliku wygląda jak plik próbek', /^probki-.*\.json$/.test(z.nazwaPliku()));

process.exit(ok ? 0 : 1);
