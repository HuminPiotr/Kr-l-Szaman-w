/**
 * Podmuch (Aard) - technika JEDNORAZOWA.
 *
 *   node tools/test-podmuch.mjs
 *
 * Pilnuje: bez uzbrojenia nic się nie odpala, zamknięta pięść i wolny ruch
 * nie odpalają, przeciwne machnięcia dają przeciwne kierunki, a odpalenie
 * zużywa uzbrojenie (drugie machnięcie z rzędu jest ciche).
 */
import { Podmuch } from '../js/podmuch.js';
import { dlon, worldDlon } from './_dlon-syntetyczna.mjs';

const DT = 1 / 60;
const S = 0.09;
const OTWARTA = [0, 0, 0, 0, 0];
const PIESC = [1, 1, 1, 1, 1];

/** Klatka z jedną dłonią o zadanym ox (pozycja pozioma) i pochyleniu 3D. */
function klatka(ox, zgiecia, pochylY = 0, pochylX = 0) {
    return {
        hands: [{
            landmarks: dlon({ ox, oy: 0.5, zgiecia, skala: S }),
            worldLandmarks: worldDlon({ zgiecia, skala: S, pochylY, pochylX }),
            handedness: 'Right'
        }],
        pose: null, width: 1920, height: 1080
    };
}

/** Przesuwa dłoń o `krok` na klatkę, `n` klatek - to jest "machnięcie". */
function machnij(p, moc, { n = 8, ox0 = 0.3, krok = 0.08, zgiecia = OTWARTA,
                           pochylY = 0, pochylX = 0 } = {}) {
    let ox = ox0, wynik = null;
    for (let i = 0; i < n && !wynik; i++) {
        wynik = p.update(klatka(ox, zgiecia, pochylY, pochylX), moc, DT);
        ox += krok;
    }
    return wynik;
}

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Bez uzbrojenia nic się nie dzieje ---
console.log('BEZ UZBROJENIA:');
const p1 = new Podmuch();
const w1 = machnij(p1, 1.0, { pochylY: Math.PI / 2 });
spr(`szybki swipe otwartą dłonią NIE odpala (stan ${p1.stan})`, w1 === null && p1.stan === 'BEZCZYNNY');

// --- 2. Uzbrojony, prawidłowy gest odpala ---
console.log('\nUZBROJONY, PRAWIDŁOWY GEST:');
const p2 = new Podmuch();
p2.uzbrój();
const w2 = machnij(p2, 1.0, { pochylY: Math.PI / 2 });
spr(`szybki swipe otwartą dłonią odpala falę`, w2 !== null);
spr(`  ...i zużywa uzbrojenie (stan ${p2.stan})`, p2.stan === 'BEZCZYNNY');
spr(`  ...zaczep jest skończony (${w2?.zaczep.x.toFixed(2)}, ${w2?.zaczep.y.toFixed(2)})`,
    Number.isFinite(w2?.zaczep.x) && Number.isFinite(w2?.zaczep.y));
spr(`  ...kierunek jest jednostkowym wektorem 3D`,
    Math.abs(Math.hypot(w2.kierunek.x, w2.kierunek.y, w2.kierunek.z) - 1) < 0.01);

// --- 3. Zamknięta pięść nie odpala, choćby ruch był gwałtowny ---
console.log('\nPIĘŚĆ:');
const p3 = new Podmuch();
p3.uzbrój();
const w3 = machnij(p3, 1.0, { zgiecia: PIESC, pochylY: Math.PI / 2 });
spr(`gwałtowny ruch ZAMKNIĘTĄ pięścią NIE odpala (stan ${p3.stan})`,
    w3 === null && p3.stan === 'UZBROJONY');

// --- 4. Otwarta dłoń bez ruchu nie odpala ---
console.log('\nWOLNY RUCH:');
const p4 = new Podmuch();
p4.uzbrój();
const w4 = machnij(p4, 1.0, { krok: 0.001, pochylY: Math.PI / 2 });
spr(`otwarta dłoń, WOLNY ruch NIE odpala (stan ${p4.stan})`, w4 === null && p4.stan === 'UZBROJONY');

// --- 5. Przeciwne machnięcia dają przeciwne kierunki ---
console.log('\nKIERUNEK ZALEŻNY OD MACHNIĘCIA:');
const p5a = new Podmuch(); p5a.uzbrój();
const w5a = machnij(p5a, 1.0, { ox0: 0.2, krok: 0.08, pochylY: Math.PI / 4 });
const p5b = new Podmuch(); p5b.uzbrój();
const w5b = machnij(p5b, 1.0, { ox0: 0.8, krok: -0.08, pochylY: Math.PI / 4 });
const iloczyn = w5a.kierunek.x * w5b.kierunek.x + w5a.kierunek.y * w5b.kierunek.y
              + w5a.kierunek.z * w5b.kierunek.z;
spr(`swipe w prawo: kierunek ${JSON.stringify(w5a.kierunek)}`, true);
spr(`swipe w lewo:  kierunek ${JSON.stringify(w5b.kierunek)}`, true);
spr(`przeciwne machnięcia dają PRZECIWNE kierunki (iloczyn skalarny ${iloczyn.toFixed(2)})`,
    iloczyn < -0.9);

// --- 6. Cztery pochylenia dłoni + dopasowany ruch dają cztery różne kierunki ---
console.log('\nCZTERY KIERUNKI 3D:');
const przypadki = [
    { nazwa: 'w głąb (ku kamerze)', pochylY: 0, krok: 0, ox0: 0.5, dodatkowo: k => k }, // patrz niżej
];
// Cztery niezależne uzbrojenia, każde z ruchem "naturalnym" dla swojego
// pochylenia - tak jak w prawdziwym geście gracz macha W STRONĘ, w którą
// dłoń jest zwrócona.
function jednKierunek({ zgiecia = OTWARTA, pochylY = 0, pochylX = 0, ox0, krok } = {}) {
    const p = new Podmuch(); p.uzbrój();
    return machnij(p, 1.0, { ox0, krok, pochylY, pochylX, zgiecia });
}
const wPrawo = jednKierunek({ pochylY: Math.PI / 2, ox0: 0.2, krok: 0.08 });
const wLewo  = jednKierunek({ pochylY: -Math.PI / 2, ox0: 0.8, krok: -0.08 });
const wGore  = jednKierunek({ pochylX: Math.PI / 2, ox0: 0.5, krok: 0.08 });
const cztery = [wPrawo, wLewo, wGore].map(w => w.kierunek);
const odl = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let minOdl = Infinity;
for (let i = 0; i < cztery.length; i++)
    for (let j = i + 1; j < cztery.length; j++)
        minOdl = Math.min(minOdl, odl(cztery[i], cztery[j]));
spr(`trzy różne pochylenia dają trzy różne kierunki (min. odległość ${minOdl.toFixed(2)})`, minOdl > 0.5);

// --- 7. Moc poniżej kosztu -> siła słabsza, NIE brak fali ---
console.log('\nMOC PONIŻEJ KOSZTU:');
const p7 = new Podmuch(); p7.uzbrój();
const w7 = machnij(p7, 0.1, { pochylY: Math.PI / 2 });
spr(`przy niedoborze mocy fala i tak wychodzi (${w7?.sila.toFixed(2)})`, w7 !== null && w7.sila > 0);
spr(`  ...ale słabsza niż przy pełnej mocy (${w7.sila.toFixed(2)} < 1)`, w7.sila < 1);
spr(`  ...pobór nie przekracza dostępnej mocy (${w7.pobor.toFixed(2)} <= 0.1)`, w7.pobor <= 0.1 + 1e-9);

// --- 8. Drugie machnięcie bez nowego kombosa jest ciche ---
console.log('\nBRAK PODWÓJNEGO ODPALENIA:');
const p8 = new Podmuch(); p8.uzbrój();
const pierwszy = machnij(p8, 1.0, { pochylY: Math.PI / 2 });
spr('pierwsze machnięcie odpala', pierwszy !== null);
const drugi = machnij(p8, 1.0, { ox0: 0.3, pochylY: Math.PI / 2 });
spr('drugie machnięcie BEZ nowego kombosa jest ciche', drugi === null);

// --- 9. Odporność na braki i NaN ---
console.log('\nODPORNOŚĆ:');
const p9 = new Podmuch(); p9.uzbrój();
const brakDloni = p9.update({ hands: [], pose: null, width: 1920, height: 1080 }, 1.0, NaN);
spr('brak dłoni + NaN dt -> null, bez wyjątku', brakDloni === null);
spr('  ...i uzbrojenie zostaje (stan nadal UZBROJONY)', p9.stan === 'UZBROJONY');

process.exit(ok ? 0 : 1);
