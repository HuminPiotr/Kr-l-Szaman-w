/**
 * Piorun - geometria fraktalna i obwiednia migotania, BEZ document.
 *
 *   node tools/test-piorun.mjs
 *
 * W przeciwieństwie do fala.js/iskry.js/zaplon.js, ten moduł NIE POTRZEBUJE
 * document NAWET DO SPRITE'ÓW - piorun to linie, nie plamy. Jedyna bramka
 * na document jest w rysowaniu (ctx.stroke), zagrodzona `if (!ctx) return`
 * PO doliczeniu czasu, więc nawet Piorun.updateAndDraw() jest w pełni
 * testowalne przez wywołanie z ctx=null.
 */
import { segmentuj, generujPiorun, stanPioruna, Piorun,
         LICZBA_BLYSKOW, CZAS_PELNI, CZAS_PRZERWY, T_BLYSKI, T_POSWIATA, T_CALKOWITY } from '../js/piorun.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;

// --- 1. segmentuj(): punkty początku/końca ZAWSZE zachowane dokładnie ---
console.log('SEGMENTUJ - PUNKTY KRAŃCOWE:');
const p1 = { x: 10, y: 0 }, p2 = { x: 10, y: 500 };
const s0 = segmentuj(p1, p2, 0, 0.5);
spr(`iteracje=0 daje DOKŁADNIE [p1, p2] (${s0.length} punktów)`,
    s0.length === 2 && s0[0] === p1 && s0[1] === p2);

const s3 = segmentuj(p1, p2, 3, 0.5);
spr(`iteracje=3 daje 2^3+1=9 punktów (${s3.length})`, s3.length === 9);
spr('pierwszy punkt to DOKŁADNIE p1', s3[0].x === p1.x && s3[0].y === p1.y);
spr('ostatni punkt to DOKŁADNIE p2', s3[s3.length - 1].x === p2.x && s3[s3.length - 1].y === p2.y);

const s5 = segmentuj(p1, p2, 5, 0.3);
spr(`iteracje=5 daje 2^5+1=33 punkty (${s5.length})`, s5.length === 33);

// --- 2. Wychylenie punktów WEWNĘTRZNYCH nie przekracza deklarowanej amplitudy ---
console.log('\nSEGMENTUJ - AMPLITUDA WYCHYLENIA:');
// Prosty pionowy odcinek: geometryczny środek pierwszej podziałki to (10, 250).
// Maksymalne możliwe wychylenie na PIERWSZEJ iteracji to dl*chropowatosc.
const CH = 0.4;
const dl = Math.hypot(p2.x - p1.x, p2.y - p1.y);
let przekroczone = false;
for (let proba = 0; proba < 200; proba++) {
    const s1 = segmentuj(p1, p2, 1, CH);
    const srodek = s1[1];
    const geometrycznyX = (p1.x + p2.x) / 2;
    if (Math.abs(srodek.x - geometrycznyX) > dl * CH + 1e-6) przekroczone = true;
}
spr('wychylenie punktu środkowego NIGDY nie przekracza dl*chropowatosc (200 prób)', !przekroczone);

// --- 3. Wszystkie punkty są skończone, żaden wyjątek przy zdegenerowanym segmencie ---
console.log('\nSEGMENTUJ - ODPORNOŚĆ:');
const sZero = segmentuj({ x: 5, y: 5 }, { x: 5, y: 5 }, 4, 0.5);
spr('zdegenerowany odcinek (p1===p2) nie wywala wyjątku, wszystko skończone',
    sZero.every(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y)));
const sNaN = segmentuj(p1, p2, NaN, NaN);
spr('NaN iteracje/chropowatosc -> fallback (0 iteracji), bez wyjątku', sNaN.length === 2);

// --- 4. generujPiorun(): odporność i struktura ---
console.log('\nGENERUJ PIORUN:');
const start = { x: 500, y: -140 }, koniec = { x: 480, y: 900 };
const g1 = generujPiorun(start, koniec, { liczbaGalezi: 3 });
spr('główna ścieżka zaczyna się DOKŁADNIE w start', g1.glowna[0].x === start.x && g1.glowna[0].y === start.y);
spr('główna ścieżka kończy się DOKŁADNIE w koniec',
    g1.glowna[g1.glowna.length - 1].x === koniec.x && g1.glowna[g1.glowna.length - 1].y === koniec.y);
spr(`żądana liczba odgałęzień jest dotrzymana (${g1.galezie.length})`, g1.galezie.length === 3);
spr('każde odgałęzienie zaczyna się w punkcie NALEŻĄCYM do głównej ścieżki',
    g1.galezie.every(gal => g1.glowna.some(pt => pt.x === gal[0].x && pt.y === gal[0].y)));
spr('każde odgałęzienie faktycznie ODCHODZI od punktu startowego (koniec != start)',
    g1.galezie.every(gal => gal[gal.length - 1].x !== gal[0].x || gal[gal.length - 1].y !== gal[0].y));

const gZero = generujPiorun(start, koniec, { liczbaGalezi: 0 });
spr('liczbaGalezi=0 daje pustą tablicę odgałęzień, bez wyjątku', gZero.galezie.length === 0);

console.log('\nGENERUJ PIORUN - ODPORNOŚĆ:');
spr('brak start -> puste struktury, bez wyjątku',
    generujPiorun(null, koniec).glowna.length === 0);
spr('NaN w koniec -> puste struktury, bez wyjątku',
    generujPiorun(start, { x: NaN, y: 0 }).glowna.length === 0);

// --- 5. stanPioruna(): fazy migotania i poświaty ---
console.log('\nSTAN PIORUNA:');
const st0 = stanPioruna(0);
spr(`t=0 -> pierwszy błysk (indeks ${st0.indeks}), rdzeń niemal pełny (${st0.rdzen.toFixed(2)})`,
    st0.indeks === 0 && st0.rdzen > 0.95);

const stKoniec = stanPioruna(999);
spr('t bardzo duże -> indeks -1 (efekt zakończony), zero jasności',
    stKoniec.indeks === -1 && stKoniec.rdzen === 0 && stKoniec.poswiata === 0);

spr('NaN t -> traktowane jak "efekt zakończony", bez wyjątku', stanPioruna(NaN).indeks === -1);

// Indeks błysku ROŚNIE w czasie w obrębie fazy migotania (kolejne błyski).
const indeksy = new Set();
for (let i = 0; i <= 20; i++) indeksy.add(stanPioruna(i / 20 * T_BLYSKI).indeks);
spr(`w obrębie fazy migotania pojawia się WIĘCEJ NIŻ JEDEN indeks błysku (${[...indeksy].join(',')})`,
    indeksy.size > 1);

// --- REGRESJA: rdzeń musi trzymać PEŁNĄ jasność przez CAŁY CZAS_PELNI,
// nie tylko w jednej chwili na starcie błysku. Pierwsza wersja tego pliku
// dawała pełną jasność przez ~17ms (poniżej jednej klatki przy 60 FPS) -
// gracz zgłosił efekt jako "ledwie zauważalny" mimo poprawnej logiki.
// Test próbkuje CAŁE plato pierwszego błysku i wymaga rdzen>0.95 wszędzie
// poza ostatnimi 20% (gdzie jest celowe wygaszenie do przerwy).
console.log('\nSTAN PIORUNA - PLATO PEŁNEJ JASNOŚCI (regresja "ledwie zauważalny"):');
let platoWTrzymane = true, probkiPlato = 0;
for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    if (f > 0.75) continue;   // zostawiamy margines na celowe wygaszenie w ostatnich 20%
    const rdzenTutaj = stanPioruna(f * CZAS_PELNI).rdzen;
    probkiPlato++;
    if (rdzenTutaj < 0.95) platoWTrzymane = false;
}
spr(`rdzeń trzyma pełną jasność (>0.95) przez ${probkiPlato} próbek w pierwszych 75% CZAS_PELNI`, platoWTrzymane);
spr(`sam CZAS_PELNI (${(CZAS_PELNI * 1000).toFixed(0)} ms) trwa DŁUŻEJ niż jedna klatka przy 60 FPS (16.7 ms)`,
    CZAS_PELNI > 1 / 60);

// W PRZERWIE między błyskami rdzeń jest zero, ale poświata NIE spada do
// czarnej dziury - ma zostać widoczna kolorowa obecność między migotaniami.
const wPrzerwie = stanPioruna(CZAS_PELNI + CZAS_PRZERWY * 0.5);
spr(`w przerwie między błyskami rdzeń jest zero (${wPrzerwie.rdzen})`, wPrzerwie.rdzen === 0);
spr(`...ale poświata w przerwie NIE jest zerowa (${wPrzerwie.poswiata.toFixed(2)})`, wPrzerwie.poswiata > 0.1);

// Faza poświaty (PO całym migotaniu): brak rdzenia, poświata maleje do zera.
const stPoswiataWczesnie = stanPioruna(T_BLYSKI + T_POSWIATA * 0.1);
const stPoswiataPozno = stanPioruna(T_BLYSKI + T_POSWIATA * 0.8);
spr('w fazie poświaty rdzeń jest zawsze zero (brak "trzasku")', stPoswiataWczesnie.rdzen === 0);
spr(`poświata maleje w czasie (${stPoswiataWczesnie.poswiata.toFixed(3)} > ${stPoswiataPozno.poswiata.toFixed(3)})`,
    stPoswiataWczesnie.poswiata > stPoswiataPozno.poswiata);

// --- 6. Piorun (klasa): odporność i cykl życia, BEZ document ---
console.log('\nKLASA PIORUN:');
const pi1 = new Piorun();
spr('świeży Piorun nie jest aktywny', pi1.aktywny === false);

const pi2 = new Piorun();
pi2.uderz(null, [1, 1, 1], 1);
spr('brak zaczepu -> uderz() nie uzbraja, bez wyjątku', pi2.aktywny === false);
pi2.uderz({ x: NaN, y: 0 }, [1, 1, 1], 1);
spr('NaN w zaczepie -> uderz() nie uzbraja, bez wyjątku', pi2.aktywny === false);
pi2.uderz({ x: 0, y: 0 }, [1, 1, 1], 0);
spr('siła zero -> uderz() nie uzbraja, bez wyjątku', pi2.aktywny === false);
pi2.uderz({ x: 0, y: 0 }, [1, 1, 1], NaN);
spr('NaN siła -> uderz() nie uzbraja, bez wyjątku', pi2.aktywny === false);

const pi3 = new Piorun();
pi3.uderz({ x: 500, y: 800 }, [1, 1, 1], 1);
spr('uderz() uzbraja stan (aktywny)', pi3.aktywny === true);
spr(`uderz() generuje TYLE ścieżek, ile jest LICZBA_BLYSKOW (${pi3._blyski.length})`, pi3._blyski.length === LICZBA_BLYSKOW);
spr('brak barwy -> fallback na fiolet domyślny, bez wyjątku (nadal aktywny)',
    (() => { const p = new Piorun(); p.uderz({ x: 0, y: 0 }, null, 1); return p.aktywny; })());

// updateAndDraw z ctx=null NIGDY nie dotyka document - napędza tylko zegar.
const pi4 = new Piorun();
pi4.uderz({ x: 500, y: 800 }, [1, 1, 1], 1);
let klatek = 0;
while (pi4.aktywny && klatek < 200) { pi4.updateAndDraw(null, DT); klatek++; }
spr(`Piorun wygasza się w skończonym czasie z ctx=null (po ${(klatek * DT).toFixed(2)} s, < T_CALKOWITY+margines ${(T_CALKOWITY + 0.1).toFixed(2)} s)`,
    !pi4.aktywny && klatek * DT < T_CALKOWITY + 0.1);

const pi5 = new Piorun();
pi5.updateAndDraw(null, DT);
spr('updateAndDraw() na nieaktywnym Piorunie jest no-opem, bez wyjątku', pi5.aktywny === false);

const pi6 = new Piorun();
pi6.uderz({ x: 0, y: 0 }, [1, 1, 1], 1);
pi6.updateAndDraw(null, NaN);
spr('NaN dt -> krok zero, bez wyjątku, dalej aktywny', pi6._t === 0 && pi6.aktywny === true);

console.log('\nPUNKT UDERZENIA (dla reakcji Burza w mgle):');
{
    const p = new Piorun();
    spr('przed uderzeniem: null', p.punktUderzenia === null);
    p.uderz({ x: 700, y: 900 }, [190, 100, 255], 1);
    const pu = p.punktUderzenia;
    spr('w trakcie: koniec głównej ścieżki = punkt uderzenia', !!pu && pu.x === 700 && pu.y === 900);
    for (let i = 0; i < Math.ceil((T_CALKOWITY + 0.1) * 60); i++) p.updateAndDraw(null, 1 / 60);
    spr('po zgaśnięciu: null', p.punktUderzenia === null);
}

process.exit(ok ? 0 : 1);
