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

// --- 10. Konwencja osi Z: ruch KU KAMERZE (rosnąca dłoń) daje UJEMNE z ---
// Konwencja jest wspólna z fala.js (rzutPerspektywiczny: rosnące z = dalej,
// ujemne z = bliżej). Wcześniejsza wersja miała tu ODWROTNY znak - pchnięcie
// w kamerę wizualnie leciało w głąb ekranu. Dłoń rośnie (dSkala>0, ruch "ku
// kamerze"), zero ruchu bocznego, normalna dokładnie wzdłuż osi Z.
console.log('\nKONWENCJA OSI Z (ku kamerze = ujemne z):');
{
    const p = new Podmuch(); p.uzbrój();
    let skala = S, wynik = null;
    for (let i = 0; i < 8 && !wynik; i++) {
        const f = {
            hands: [{
                landmarks: dlon({ ox: 0.5, oy: 0.5, zgiecia: OTWARTA, skala }),
                worldLandmarks: worldDlon({ zgiecia: OTWARTA, skala, pochylY: 0 }),   // normalna ~(0,0,1)
                handedness: 'Right'
            }], pose: null, width: 1920, height: 1080
        };
        wynik = p.update(f, 1.0, DT);
        skala *= 1.15;   // dłoń wyraźnie rośnie każdą klatkę - ruch ku kamerze
    }
    spr(`dłoń rosnąca (ruch ku kamerze) odpala falę`, wynik !== null);
    spr(`  ...kierunek.z jest UJEMNY (${wynik?.kierunek.z.toFixed(2)}), zgodnie z konwencją fala.js`,
        wynik !== null && wynik.kierunek.z < -0.3);
}

// --- 11. Ochrona przed jednoklatkowym artefaktem (np. przeskok trackingu) ---
// Symulacja: dłoń NIERUCHOMA przez kilka klatek, potem JEDNA klatka
// z dużym skokiem pozycji (jak przy zamianie stronności), potem z powrotem
// nieruchoma. To NIE JEST prawdziwe machnięcie i nie powinno odpalać.
console.log('\nOCHRONA PRZED JEDNOKLATKOWYM ARTEFAKTEM:');
{
    const p = new Podmuch(); p.uzbrój();
    let wynik = null;
    // Kilka klatek nieruchomo przy ox=0.3
    for (let i = 0; i < 3; i++) wynik = p.update(klatka(0.3, OTWARTA, Math.PI / 2), 1.0, DT) || wynik;
    // JEDEN skok do ox=0.9 (symulacja artefaktu)
    wynik = p.update(klatka(0.9, OTWARTA, Math.PI / 2), 1.0, DT) || wynik;
    // Z powrotem nieruchomo przy ox=0.9 (żeby drugi klatka skoku też nie odpaliła)
    for (let i = 0; i < 3; i++) wynik = p.update(klatka(0.9, OTWARTA, Math.PI / 2), 1.0, DT) || wynik;
    spr(`jednoklatkowy skok NIE odpala (stan ${p.stan})`, wynik === null && p.stan === 'UZBROJONY');
}
{
    // Kontrola: PRAWDZIWE machnięcie (przesunięcie utrzymane przez >=2
    // klatki z rzędu) nadal odpala tak jak wcześniej.
    const p = new Podmuch(); p.uzbrój();
    const wynik = machnij(p, 1.0, { pochylY: Math.PI / 2 });
    spr(`prawdziwe machnięcie (wiele klatek ruchu) nadal odpala`, wynik !== null);
}

// --- 12. Prędkość liczona względem CAŁEGO czasu od ostatniej detekcji,
// nie pojedynczej klatki renderowania - main.js woła update() co klatkę
// requestAnimationFrame, ale frame.hands odświeża się wolniej (tempo
// detekcji). Symulacja: 2 klatki z IDENTYCZNĄ pozycją (brak nowej detekcji)
// na 1 klatkę z nową pozycją, przy STAŁYM realnym tempie ruchu. ---
console.log('\nPRĘDKOŚĆ WZGLĘDEM CZASU AKUMULOWANEGO (throttling detekcji):');
{
    const p = new Podmuch();   // NIEuzbrojony - liczy się tylko diagnostyka
    const KROK_NA_DETEKCJE = 0.3;   // duży, żeby predkosc na pewno przekroczył próg
    let ox = 0.3;
    const predkosci = [];
    // Wzorzec: [nowa pozycja][ta sama][ta sama][nowa pozycja][ta sama][ta sama]...
    for (let cykl = 0; cykl < 6; cykl++) {
        ox += KROK_NA_DETEKCJE;
        p.update(klatka(ox, OTWARTA, Math.PI / 2), 1.0, DT);              // nowa detekcja
        predkosci.push(p.diagnostyka.predkosc);
        p.update(klatka(ox, OTWARTA, Math.PI / 2), 1.0, DT);              // brak nowej detekcji
        predkosci.push(p.diagnostyka.predkosc);
        p.update(klatka(ox, OTWARTA, Math.PI / 2), 1.0, DT);              // brak nowej detekcji
        predkosci.push(p.diagnostyka.predkosc);
    }
    // Odrzuć pierwsze TRZY próbki (cały pierwszy cykl: rozruch, brak
    // poprzedniej pozycji -> predkosc=0 na wszystkich trzech push-ach tego
    // cyklu, nie tylko na pierwszym).
    const ustabilizowane = predkosci.slice(3);
    const min = Math.min(...ustabilizowane), max = Math.max(...ustabilizowane);
    console.log(`  predkosci: ${ustabilizowane.map(v => v.toFixed(1)).join(', ')}`);
    spr(`odczyt prędkości jest STABILNY, nie miga między ~0 a zawyżoną wartością (min ${min.toFixed(1)}, max ${max.toFixed(1)})`,
        min > 0 && max / min < 1.5);
}

// --- 13. Zabezpieczenie przy niejednoznacznym (bliskim zeru) iloczynie
// skalarnym normalnej i ruchu - dłoń niemal PROSTOPADŁA do machnięcia.
// Bez zabezpieczenia znak byłby szumem numerycznym; fala mogłaby polecieć
// w gracza. Bezpieczny domyślny kierunek: OD gracza (kierunek.z > 0). ---
console.log('\nNIEJEDNOZNACZNY KIERUNEK (dłoń prostopadła do machnięcia):');
{
    const p = new Podmuch(); p.uzbrój();
    let ox = 0.3, wynik = null;
    // Dłoń frontem do kamery (pochylY=0, normalna ~(0,0,1) - "ku kamerze"),
    // machnięcie CZYSTO POZIOME (dx duży, dy=0, brak zmiany skali) - niemal
    // prostopadłe do normalnej, iloczyn skalarny bliski zeru.
    for (let i = 0; i < 8 && !wynik; i++) {
        wynik = p.update(klatka(ox, OTWARTA, 0, 0), 1.0, DT);
        ox += 0.08;
    }
    spr(`niejednoznaczny gest nadal odpala (bezpieczny fallback)`, wynik !== null);
    spr(`  ...kierunek.z jest DODATNI - OD gracza, nigdy w jego stronę (${wynik?.kierunek.z.toFixed(2)})`,
        wynik !== null && wynik.kierunek.z >= 0);
}

process.exit(ok ? 0 : 1);
