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

/** Klatka z DWIEMA dłońmi: jedna wysoko, druga nisko przy ciele. */
function klatkaDwieDlonie({ oyGora = 0.25, oyDol = 0.75, zgieciaGora = WSKAZUJE,
                            zgieciaDol = WSKAZUJE, barki = 0.5 } = {}) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: barki, z: 0, visibility: 0.9 }));
    lm[BARK_L] = { x: 0.42, y: barki, z: 0, visibility: 0.9 };
    lm[BARK_P] = { x: 0.58, y: barki, z: 0, visibility: 0.9 };
    return {
        hands: [
            { landmarks: dlon({ ox: 0.62, oy: oyGora, zgiecia: zgieciaGora, skala: S }),
              worldLandmarks: lm, handedness: 'Right' },
            { landmarks: dlon({ ox: 0.35, oy: oyDol, zgiecia: zgieciaDol, skala: S }),
              worldLandmarks: lm, handedness: 'Left' }
        ],
        pose: { landmarks: lm, worldLandmarks: lm },
        width: 1920, height: 1080, dt: DT, now: 0
    };
}

/** Klatka BEZ ŻADNEJ dłoni - tak wygląda przeskok trackingu. */
function klatkaBezDloni(barki = 0.5) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: barki, z: 0, visibility: 0.9 }));
    lm[BARK_L] = { x: 0.42, y: barki, z: 0, visibility: 0.9 };
    lm[BARK_P] = { x: 0.58, y: barki, z: 0, visibility: 0.9 };
    return { hands: [], pose: { landmarks: lm, worldLandmarks: lm },
             width: 1920, height: 1080, dt: DT, now: 0 };
}

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
// Ręka opuszcza się PŁYNNIE, przez pół sekundy. Poprzednia wersja testu
// teleportowała ją w jednej klatce, czego prawdziwa ręka nie zrobi - i przez
// to nie wyłapywała, czy ogranicznik przeskoku zaczepu jest sensowny.
const t4 = new PlonacyPalec();
t4.uzbrój();
t4.update(klatka(), 1.0, DT);
for (let i = 0; i <= 30; i++) {
    t4.update(klatka({ oy: 0.25 + (0.8 - 0.25) * (i / 30) }), 1.0, DT);
}
spr(`po zapaleniu opuszczenie ręki NIE gasi (${t4.stan}) - "nad barkiem" to warunek zapłonu`,
    t4.stan === 'PLONIE');
for (let i = 0; i < 30; i++) t4.update(klatka({ oy: 0.8 }), 1.0, DT);
spr(`  ...i płonie dalej z ręką nisko (${t4.stan})`, t4.stan === 'PLONIE');

// --- 4b. SZYBKI ZAMACH nie zrywa płomienia ---
// Wodzenie palcem jest sednem tej techniki, więc ogranicznik przeskoku
// zaczepu musi przepuszczać naprawdę szybki ruch.
const t4b = new PlonacyPalec();
t4b.uzbrój();
t4b.update(klatka(), 1.0, DT);
let zerwania = 0;
for (let i = 0; i < 180; i++) {
    // pełna szerokość kadru w ~0.25 s, tam i z powrotem
    const faza = Math.sin(i * DT * Math.PI * 4);
    const f = klatka({ oy: 0.3 });
    for (const p of f.hands[0].landmarks) p.x += faza * 0.35;
    t4b.update(f, 1.0, DT);
    if (t4b.stan !== 'PLONIE') { zerwania++; break; }
}
spr(`3 s szybkiego zamachu palcem nie zrywa płomienia (${t4b.stan})`, zerwania === 0);

// --- 5. SCHOWANIE PALCA KOŃCZY - decyzja właściciela gry ---
const t5 = new PlonacyPalec();
t5.uzbrój();
t5.update(klatka(), 1.0, DT);
spr(`płonie przed schowaniem (${t5.stan})`, t5.stan === 'PLONIE');
// 60 klatek = 1 s. Utrzymanie jest wygładzane, więc zgaszenie zajmuje ~0.4 s -
// celowo, bo przy 0.16 s każde drgnięcie odczytu gasiło ogień.
for (let i = 0; i < 60; i++) t5.update(klatka({ zgiecia: PIESC }), 1.0, DT);
spr(`schowanie palca KOŃCZY technikę (${t5.stan})`, t5.stan === 'BEZCZYNNY');
for (let i = 0; i < 20; i++) t5.update(klatka(), 1.0, DT);
spr(`  ...i nie wraca samo - potrzebny nowy kombos (${t5.stan})`, t5.stan === 'BEZCZYNNY');

// --- 5b. PRZESKOK TRACKINGU nie kończy techniki ---
// Zgłoszone z testu: przy słabym świetle dłoń znika na moment i wraca.
// Traktowanie tego jak schowania palca gasiło ogień bez woli gracza.
console.log('\nPRZESKOK TRACKINGU (dłoń znika i wraca):');
const t5b = new PlonacyPalec();
t5b.uzbrój();
t5b.update(klatka(), 1.0, DT);
const zaczepPrzed = { ...t5b.zaczep };

// 0.35 s bez ŻADNEJ dłoni - typowy przeskok
for (let i = 0; i < 21; i++) t5b.update(klatkaBezDloni(), 1.0, DT);
spr(`0.35 s bez dłoni NIE gasi (${t5b.stan}, przeczekuje ${t5b.zwloka.toFixed(2)} s jako "${t5b.powodZwloki}")`,
    t5b.stan === 'PLONIE');
spr('  ...a płomień czeka na ostatniej znanej pozycji, nie skacze',
    t5b.zaczep && Math.abs(t5b.zaczep.x - zaczepPrzed.x) < 1e-9);

// Dłoń wraca - ogień płonie dalej, jakby nic się nie stało
t5b.update(klatka(), 1.0, DT);
spr(`powrót dłoni kontynuuje ogień (${t5b.stan}, zwłoka ${t5b.zwloka.toFixed(2)})`,
    t5b.stan === 'PLONIE' && t5b.zwloka === 0);

// Ale DŁUGI brak dłoni już kończy - gracz naprawdę wyszedł z kadru
for (let i = 0; i < 60; i++) t5b.update(klatkaBezDloni(), 1.0, DT);
spr(`1 s bez dłoni KOŃCZY (${t5b.stan}) - to już nie przeskok, to wyjście z kadru`,
    t5b.stan === 'BEZCZYNNY');

// --- 5c. Świadome schowanie palca jest SZYBSZE niż zanik trackingu ---
const t5c = new PlonacyPalec();
t5c.uzbrój();
t5c.update(klatka(), 1.0, DT);
let klatekDoZgaszenia = 0;
while (t5c.stan === 'PLONIE' && klatekDoZgaszenia < 120) {
    t5c.update(klatka({ zgiecia: PIESC }), 1.0, DT);   // dłoń WIDOCZNA, palec zwinięty
    klatekDoZgaszenia++;
}
const sekundy5c = klatekDoZgaszenia * DT;
console.log(`  schowanie palca gasi po ${sekundy5c.toFixed(2)} s`);
// Celowo NIE jest to natychmiastowe. Sygnał utrzymania jest wygładzany, bo
// przy natychmiastowej reakcji płomień gasł od drgnięć odczytu, nie od gestu.
spr('schowanie palca gasi w rozsądnym czasie (< 0.6 s)', sekundy5c < 0.6);
spr('  ...i wyraźnie szybciej niż zanik trackingu (0.7 s + wygładzanie)', sekundy5c < 0.75);

// --- 5d. PŁOMIEŃ TRZYMA SIĘ RĘKI, KTÓRA GO ZAPALIŁA ---
// Zgłoszone z testu: przy dwóch dłoniach ogień przeskakiwał na palec drugiej,
// opuszczonej ręki. Zaczep był wybierany od nowa w każdej klatce.
console.log('\nDWIE DŁONIE W KADRZE:');
const t5d = new PlonacyPalec();
t5d.uzbrój();

// Obie ręce wskazują, ale tylko górna jest nad barkiem
for (let i = 0; i < 5; i++) t5d.update(klatkaDwieDlonie(), 1.0, DT);
spr(`zapala się od ręki NAD barkiem (${t5d.stan})`, t5d.stan === 'PLONIE');
const yGora = t5d.zaczep.y;
spr(`  ...zaczep jest wysoko (y=${yGora.toFixed(2)}), nie przy opuszczonej ręce`, yGora < 0.45);

// 3 sekundy z obiema dłońmi widocznymi - płomień NIE MOŻE przeskoczyć w dół
let przeskoki = 0;
for (let i = 0; i < 180; i++) {
    t5d.update(klatkaDwieDlonie(), 1.0, DT);
    if (t5d.zaczep && t5d.zaczep.y > 0.55) przeskoki++;
}
spr(`3 s z dwiema dłońmi -> ${przeskoki} przeskoków na opuszczoną rękę (ma być 0)`, przeskoki === 0);
spr(`  ...i ogień nadal płonie (${t5d.stan})`, t5d.stan === 'PLONIE');

// Gdy górna ręka schowa palec, ogień gaśnie - NIE przenosi się na dolną
const t5e = new PlonacyPalec();
t5e.uzbrój();
for (let i = 0; i < 5; i++) t5e.update(klatkaDwieDlonie(), 1.0, DT);
spr(`(druga próba) płonie (${t5e.stan})`, t5e.stan === 'PLONIE');
for (let i = 0; i < 90; i++) {
    t5e.update(klatkaDwieDlonie({ zgieciaGora: PIESC }), 1.0, DT);
}
spr(`schowanie GÓRNEGO palca gasi, nie przenosi ognia na dolną rękę (${t5e.stan})`,
    t5e.stan === 'BEZCZYNNY');

// --- 5f. RĘCE BLISKO SIEBIE nie powodują przeskoku ---
// Zgłoszone z testu: przy rękach trzymanych blisko płomień przeskakiwał
// między nimi, dając efekt "wystrzeliwanego ognia". Sama odległość nie
// wystarczała jako ochrona - druga dłoń mieściła się w limicie przeskoku.
console.log('\nRĘCE BLISKO SIEBIE (0.10 kadru od siebie):');
function klatkaObokSiebie({ zgieciaA = WSKAZUJE, zgieciaB = WSKAZUJE } = {}) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    lm[BARK_L] = { x: 0.42, y: 0.5, z: 0, visibility: 0.9 };
    lm[BARK_P] = { x: 0.58, y: 0.5, z: 0, visibility: 0.9 };
    return {
        hands: [
            { landmarks: dlon({ ox: 0.50, oy: 0.25, zgiecia: zgieciaA, skala: S }),
              worldLandmarks: lm, handedness: 'Right' },
            { landmarks: dlon({ ox: 0.60, oy: 0.25, zgiecia: zgieciaB, skala: S }),
              worldLandmarks: lm, handedness: 'Left' }
        ],
        pose: { landmarks: lm, worldLandmarks: lm },
        width: 1920, height: 1080, dt: DT, now: 0
    };
}
const t5f = new PlonacyPalec();
t5f.uzbrój();
for (let i = 0; i < 5; i++) t5f.update(klatkaObokSiebie(), 1.0, DT);
spr(`zapala się (${t5f.stan})`, t5f.stan === 'PLONIE');
const xStart = t5f.zaczep.x;
let skoki = 0;
for (let i = 0; i < 300; i++) {
    t5f.update(klatkaObokSiebie(), 1.0, DT);
    if (t5f.zaczep && Math.abs(t5f.zaczep.x - xStart) > 0.05) skoki++;
}
spr(`5 s z rękami 0.10 kadru od siebie -> ${skoki} przeskoków (ma być 0)`, skoki === 0);
spr(`  ...i ogień płonie dalej (${t5f.stan})`, t5f.stan === 'PLONIE');

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
while (moc > 0 && sekundy < 180) {
    const pobor = t7.update(klatka(), moc, DT);
    moc = Math.max(0, moc - pobor);
    sekundy += DT;
    if (t7.stan !== 'PLONIE') break;
}
console.log(`\n  pełny pasek wystarczył na ${sekundy.toFixed(1)} s ognia`);
// 50 s, nie 30. Pobór musi być POKONYWALNY tańcem, a przy 1/30 wychodził
// remis z przyrostem i moc stała w miejscu.
spr('pełny pasek daje 45-55 s ognia', sekundy > 45 && sekundy < 55);
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
