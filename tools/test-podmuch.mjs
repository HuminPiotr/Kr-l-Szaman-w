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

/**
 * Klatka z jedną dłonią o zadanej pozycji (ox, oy), skali i pochyleniu 3D.
 * `bezSwiata` = brak worldLandmarks (MediaPipe ich nie dał) - kierunek ma
 * wychodzić z samego ruchu, normalna jest tylko diagnostyką.
 */
function klatka(ox, zgiecia, pochylY = 0, pochylX = 0, oy = 0.5, skala = S, bezSwiata = false) {
    return {
        hands: [{
            landmarks: dlon({ ox, oy, zgiecia, skala }),
            worldLandmarks: bezSwiata ? null : worldDlon({ zgiecia, skala, pochylY, pochylX }),
            handedness: 'Right'
        }],
        pose: null, width: 1920, height: 1080
    };
}

/**
 * Machnięcie: przesuwa dłoń o (krok, krokY) na klatkę i mnoży skalę przez
 * `mnoznikSkali` (>1 = dłoń rośnie = ruch ku kamerze), `n` klatek.
 */
function machnij(p, moc, { n = 8, ox0 = 0.3, krok = 0.08, oy0 = 0.5, krokY = 0,
                           mnoznikSkali = 1, zgiecia = OTWARTA,
                           pochylY = 0, pochylX = 0, bezSwiata = false } = {}) {
    let ox = ox0, oy = oy0, skala = S, wynik = null;
    for (let i = 0; i < n && !wynik; i++) {
        wynik = p.update(klatka(ox, zgiecia, pochylY, pochylX, oy, skala, bezSwiata), moc, DT);
        ox += krok; oy += krokY; skala *= mnoznikSkali;
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

// --- 6. Kierunek idzie ZA RUCHEM ręki, nie za tym, gdzie patrzy dłoń ---
// Trzy machnięcia w trzy strony ekranu, wszystkie z dłonią ZWRÓCONĄ DO
// KAMERY (pochyl 0) - wcześniejsza wersja brała oś z normalnej dłoni i
// wszystkie trzy dawałyby tę samą falę w głąb ekranu.
console.log('\nKIERUNEK ZA RUCHEM (dłoń do kamery, trzy strony):');
function jednKierunek(opcje = {}) {
    const p = new Podmuch(); p.uzbrój();
    return machnij(p, 1.0, opcje);
}
const wPrawo = jednKierunek({ ox0: 0.2, krok: 0.08 });
const wLewo  = jednKierunek({ ox0: 0.8, krok: -0.08 });
const wGore  = jednKierunek({ ox0: 0.5, krok: 0, oy0: 0.8, krokY: -0.08 });
spr(`w prawo: (${wPrawo.kierunek.x.toFixed(2)}, ${wPrawo.kierunek.y.toFixed(2)}, ${wPrawo.kierunek.z.toFixed(2)}) - x dominuje`,
    wPrawo.kierunek.x > 0.9);
spr(`w lewo:  (${wLewo.kierunek.x.toFixed(2)}, ${wLewo.kierunek.y.toFixed(2)}, ${wLewo.kierunek.z.toFixed(2)}) - -x dominuje`,
    wLewo.kierunek.x < -0.9);
spr(`w górę:  (${wGore.kierunek.x.toFixed(2)}, ${wGore.kierunek.y.toFixed(2)}, ${wGore.kierunek.z.toFixed(2)}) - -y dominuje`,
    wGore.kierunek.y < -0.9);
const cztery = [wPrawo, wLewo, wGore].map(w => w.kierunek);
const odl = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let minOdl = Infinity;
for (let i = 0; i < cztery.length; i++)
    for (let j = i + 1; j < cztery.length; j++)
        minOdl = Math.min(minOdl, odl(cztery[i], cztery[j]));
spr(`trzy różne machnięcia dają trzy różne kierunki (min. odległość ${minOdl.toFixed(2)})`, minOdl > 0.5);

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

// --- 13. Dłoń do kamery + machnięcie w bok = fala W BOK, nie w głąb ---
// Wcześniejsza wersja traktowała ten przypadek jako "niejednoznaczny"
// i wymuszała +z (fala w głąb ekranu) - dokładnie błąd, który użytkownik
// widział jako "macham w jednym kierunku, a fala leci w innym". Stała skala
// dłoni = brak ruchu w głąb, bramka głębi daje dokładnie zero.
console.log('\nDŁOŃ DO KAMERY, MACHNIĘCIE W BOK:');
{
    const p = new Podmuch(); p.uzbrój();
    const wynik = machnij(p, 1.0, { ox0: 0.3, krok: 0.08, pochylY: 0 });
    spr(`odpala`, wynik !== null);
    spr(`  ...kierunek.x dominuje (${wynik?.kierunek.x.toFixed(2)})`, wynik !== null && wynik.kierunek.x > 0.9);
    spr(`  ...kierunek.z ≈ 0 - bez ruchu w głąb nie ma składowej z (${wynik?.kierunek.z.toFixed(3)})`,
        wynik !== null && Math.abs(wynik.kierunek.z) < 0.05);
}

// --- 14. Ukośnie: bok + wzrost dłoni = obie składowe ---
console.log('\nUKOŚNIE (bok + ku kamerze):');
{
    const p = new Podmuch(); p.uzbrój();
    const wynik = machnij(p, 1.0, { ox0: 0.3, krok: 0.08, mnoznikSkali: 1.15 });
    spr(`odpala i ma OBIE składowe: x ${wynik?.kierunek.x.toFixed(2)} > 0.3, z ${wynik?.kierunek.z.toFixed(2)} < -0.3`,
        wynik !== null && wynik.kierunek.x > 0.3 && wynik.kierunek.z < -0.3);
}

// --- 15. Bez worldLandmarks kierunek dalej wychodzi z ruchu ---
console.log('\nBEZ WORLDLANDMARKS (normalna niedostępna):');
{
    const p = new Podmuch(); p.uzbrój();
    const wynik = machnij(p, 1.0, { ox0: 0.3, krok: 0.08, bezSwiata: true });
    spr(`odpala mimo braku normalnej dłoni`, wynik !== null);
    spr(`  ...x dominuje (${wynik?.kierunek.x.toFixed(2)})`, wynik !== null && wynik.kierunek.x > 0.9);
    spr(`  ...diagnostyka.normalna jest null, bez wyjątku`, p.diagnostyka.normalna === null);
}

// --- 16. Drżenie trackingu w spoczynku NIE odpala (bramka głębi) ---
// Pozycja ±0.002, skala ×(1±0.02) naprzemiennie - typowy szum detekcji.
// Surowa głębia z kamery otworkowej mnoży drżenie skali przez ~10-17x;
// bez bramki dawałoby to "pchnięcie" kilkunastu szerokości dłoni na sekundę.
console.log('\nDRŻENIE W SPOCZYNKU:');
{
    const p = new Podmuch(); p.uzbrój();
    let wynik = null, maxPredkosc = 0;
    for (let i = 0; i < 30 && !wynik; i++) {
        const znak = i % 2 ? 1 : -1;
        wynik = p.update(klatka(0.5 + 0.002 * znak, OTWARTA, 0, 0, 0.5, S * (1 + 0.02 * znak)), 1.0, DT);
        maxPredkosc = Math.max(maxPredkosc, p.diagnostyka.predkosc);
    }
    spr(`drżenie NIE odpala (max prędkość ${maxPredkosc.toFixed(2)} sz.dł./s, stan ${p.stan})`,
        wynik === null && p.stan === 'UZBROJONY');
}

// --- 17. Zniknięcie dłoni w środku machnięcia i powrót ---
console.log('\nZNIKNIĘCIE DŁONI W TRAKCIE:');
{
    const p = new Podmuch(); p.uzbrój();
    let wynik = null;
    wynik = p.update(klatka(0.3, OTWARTA), 1.0, DT) || wynik;
    wynik = p.update(klatka(0.38, OTWARTA), 1.0, DT) || wynik;
    wynik = p.update({ hands: [], pose: null, width: 1920, height: 1080 }, 1.0, DT) || wynik;
    spr('klatka bez dłoni w środku machnięcia - bez wyjątku, nie odpala', wynik === null);
    const potem = machnij(p, 1.0, { ox0: 0.5, krok: 0.08 });
    spr(`po powrocie dłoni machnięcie odpala normalnie`, potem !== null && p.stan === 'BEZCZYNNY');
}

// --- 18. Dwie dłonie bez stronności (handedness null) - ten sam klucz ---
console.log('\nDWIE DŁONIE BEZ STRONNOŚCI:');
{
    const p = new Podmuch(); p.uzbrój();
    let wynik = null, ox = 0.3;
    for (let i = 0; i < 8 && !wynik; i++) {
        const f = {
            hands: [
                { landmarks: dlon({ ox, oy: 0.5, zgiecia: OTWARTA, skala: S }), worldLandmarks: null, handedness: null },
                { landmarks: dlon({ ox: 0.5, oy: 0.8, zgiecia: OTWARTA, skala: S }), worldLandmarks: null, handedness: null }
            ], pose: null, width: 1920, height: 1080
        };
        wynik = p.update(f, 1.0, DT);
        ox += 0.08;
    }
    spr(`bez wyjątku; ruchoma dłoń odpala z kierunkiem +x (${wynik?.kierunek.x.toFixed(2)})`,
        wynik !== null && wynik.kierunek.x > 0.9);
}

process.exit(ok ? 0 : 1);
