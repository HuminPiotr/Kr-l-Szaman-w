/**
 * Płonący palec - technika kanałowana.
 *
 *   node tools/test-plonacy-palec.mjs
 *
 * Pilnuje trzech rzeczy, które łatwo zepsuć przy późniejszych zmianach:
 * że bez kombosa nic się nie zapala, że moc jest pobierana stopniowo
 * (a nie jednym wystrzałem), i że SCHOWANIE PALCA KOŃCZY technikę -
 * to była wyraźna decyzja właściciela gry, nie efekt uboczny.
 */
import { PlonacyPalec } from '../js/plonacyPalec.js';
import { dlon } from './_dlon-syntetyczna.mjs';
import { BARK_L, BARK_P } from '../js/znaki/postawa.js';

const DT = 1 / 60;
const S = 0.09;

// Jeden palec wyprostowany (wskazujący), pozostałe zwinięte.
const WSKAZUJE = [1, 0, 1, 1, 1];
const DWA_PALCE = [1, 0, 0, 1, 1];
const PIESC = [1, 1, 1, 1, 1];

/** Klatka z dłonią i barkami. oy przesuwa dłoń w pionie względem barków. */
function klatka({ zgiecia = WSKAZUJE, oy = 0.25, barki = 0.5, brakPozy = false } = {}) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: barki, z: 0, visibility: 0.9 }));
    lm[BARK_L] = { x: 0.42, y: barki, z: 0, visibility: 0.9 };
    lm[BARK_P] = { x: 0.58, y: barki, z: 0, visibility: 0.9 };
    return {
        hands: [{ landmarks: dlon({ ox: 0.5, oy, zgiecia, skala: S }),
                  worldLandmarks: null, handedness: 'Right' }],
        pose: brakPozy ? null : { landmarks: lm, worldLandmarks: lm },
        width: 1920, height: 1080, dt: DT, now: 0
    };
}

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Bez kombosa nic się nie dzieje ---
const t1 = new PlonacyPalec();
for (let i = 0; i < 30; i++) t1.update(klatka(), 1.0, DT);
spr(`bez kombosa palec nad barkiem NIE zapala (${t1.stan})`, t1.stan === 'BEZCZYNNY');
spr('  ...i nie pobiera mocy', t1.update(klatka(), 1.0, DT) === 0);

// --- 2. Po kombosie zapala, bez względu na czas ---
const t2 = new PlonacyPalec();
t2.uzbrój();
spr(`kombos uzbraja (${t2.stan})`, t2.stan === 'GOTOWY');
// Symulujemy długie zwlekanie - uzbrojenie NIE ma licznika ważności
for (let i = 0; i < 60 * 20; i++) t2.update(klatka({ oy: 0.8 }), 1.0, DT);  // ręka nisko
spr(`po 20 s zwlekania nadal gotowy (${t2.stan})`, t2.stan === 'GOTOWY');
t2.update(klatka(), 1.0, DT);
spr(`palec nad barkiem zapala (${t2.stan})`, t2.stan === 'PLONIE');

// --- 3. Poniżej barków nie zapala ---
const t3 = new PlonacyPalec();
t3.uzbrój();
for (let i = 0; i < 30; i++) t3.update(klatka({ oy: 0.8 }), 1.0, DT);
spr(`palec PONIŻEJ barków nie zapala (${t3.stan})`, t3.stan === 'GOTOWY');

// --- 4. Po zapaleniu można opuścić rękę ---
const t4 = new PlonacyPalec();
t4.uzbrój();
t4.update(klatka(), 1.0, DT);
for (let i = 0; i < 60; i++) t4.update(klatka({ oy: 0.8 }), 1.0, DT);
spr(`po zapaleniu opuszczenie ręki NIE gasi (${t4.stan}) - "nad barkiem" to warunek zapłonu`,
    t4.stan === 'PLONIE');

// --- 5. SCHOWANIE PALCA KOŃCZY - decyzja właściciela gry ---
const t5 = new PlonacyPalec();
t5.uzbrój();
t5.update(klatka(), 1.0, DT);
spr(`płonie przed schowaniem (${t5.stan})`, t5.stan === 'PLONIE');
for (let i = 0; i < 20; i++) t5.update(klatka({ zgiecia: PIESC }), 1.0, DT);
spr(`schowanie palca KOŃCZY technikę (${t5.stan})`, t5.stan === 'BEZCZYNNY');
for (let i = 0; i < 20; i++) t5.update(klatka(), 1.0, DT);
spr(`  ...i nie wraca samo - potrzebny nowy kombos (${t5.stan})`, t5.stan === 'BEZCZYNNY');

// --- 6. Dwa palce nie zapalają ---
const t6 = new PlonacyPalec();
t6.uzbrój();
for (let i = 0; i < 30; i++) t6.update(klatka({ zgiecia: DWA_PALCE }), 1.0, DT);
spr(`dwa wyprostowane palce nie zapalają (${t6.stan})`, t6.stan === 'GOTOWY');

// --- 7. Moc pobierana STOPNIOWO, pełny pasek na ~30 s ---
const t7 = new PlonacyPalec();
t7.uzbrój();
t7.update(klatka(), 1.0, DT);
let moc = 1.0, sekundy = 0;
while (moc > 0 && sekundy < 120) {
    const pobor = t7.update(klatka(), moc, DT);
    moc = Math.max(0, moc - pobor);
    sekundy += DT;
    if (t7.stan !== 'PLONIE') break;
}
console.log(`\n  pełny pasek wystarczył na ${sekundy.toFixed(1)} s ognia`);
spr('pełny pasek daje 25-35 s ognia', sekundy > 25 && sekundy < 35);
// Pętla wychodzi przy moc == 0, więc technika dowiaduje się o wyczerpaniu
// dopiero w NASTĘPNEJ klatce - tak jak w grze.
t7.update(klatka(), 0, DT);
spr(`przy wyczerpanej mocy technika się kończy (${t7.stan})`, t7.stan === 'BEZCZYNNY');

// --- 8. Odporność ---
const t8 = new PlonacyPalec();
t8.uzbrój();
spr('brak pozy nie zapala i nie wywraca', t8.update(klatka({ brakPozy: true }), 1.0, DT) === 0);
const nan = Array.from({ length: 21 }, () => ({ x: NaN, y: NaN, z: 0 }));
const fNan = { hands: [{ landmarks: nan }], pose: null, width: 1920, height: 1080, dt: DT, now: 0 };
spr('klatka z NaN nie wywraca', t8.update(fNan, 1.0, DT) === 0);
spr('brak dłoni nie wywraca',
    t8.update({ hands: [], pose: null, width: 1920, height: 1080, dt: DT, now: 0 }, 1.0, DT) === 0);

process.exit(ok ? 0 : 1);
