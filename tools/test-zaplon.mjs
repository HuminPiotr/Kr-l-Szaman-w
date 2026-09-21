/**
 * Zapłon sylwetki (Kierunek A: sylwetka staje się efektem) - obwiednia
 * czasu i odporność, BEZ rysowania.
 *
 *   node tools/test-zaplon.mjs
 *
 * Test nie potrzebuje DOM - przy masce null updateAndDraw() wraca wcześnie,
 * PO doliczeniu czasu ale PRZED dotknięciem document (ten sam wzorzec co
 * tools/test-aura-impuls.mjs). Samo rysowanie (blur, kompozycja warstw)
 * zostaje niesprawdzone testem i weryfikowane na żywej kamerze - jak
 * _rysuj() w fala.js/iskry.js.
 */
import { Zaplon, obwiednia, NASTAWY } from '../js/zaplon.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const fit = { offsetX: 0, offsetY: 0, scaledW: 1, scaledH: 1 };
const przepusc = (z, sekundy) => {
    for (let i = 0; i < Math.round(sekundy / DT); i++) z.updateAndDraw(null, null, 0, 0, fit, DT);
};

// --- 1. Obwiednia: trzy warstwy, trzy różne kształty w czasie ---
console.log('OBWIEDNIA (funkcja czysta):');
const o0 = obwiednia(0), o05 = obwiednia(0.5), o1 = obwiednia(1);
spr(`wypełnienie startuje przy pełnej sile (${o0.wypelnienie.toFixed(2)})`, o0.wypelnienie > 0.99);
spr(`wypełnienie gaśnie MONOTONICZNIE (0=${o0.wypelnienie.toFixed(2)} > 0.5=${o05.wypelnienie.toFixed(2)} > 1=${o1.wypelnienie.toFixed(2)})`,
    o0.wypelnienie > o05.wypelnienie && o05.wypelnienie > o1.wypelnienie);
spr('wypełnienie gaśnie DOKŁADNIE do zera przy p=1', o1.wypelnienie === 0);

spr(`obrys startuje przy zerze, nie od razu na pełni (${o0.obrys.toFixed(3)})`, o0.obrys < 0.01);
spr('obrys gaśnie DOKŁADNIE do zera przy p=1', o1.obrys === 0);
const oPikObrysu = obwiednia(0.33).obrys;
spr(`obrys ma SZCZYT w środku obwiedni, nie na starcie (${o0.obrys.toFixed(2)} < szczyt ${oPikObrysu.toFixed(2)})`,
    oPikObrysu > o0.obrys && oPikObrysu > o05.obrys);

spr(`poświata startuje przy zerze (${o0.poswiata.toFixed(3)})`, o0.poswiata < 0.01);
spr('poświata gaśnie DOKŁADNIE do zera przy p=1', o1.poswiata === 0);

// Poświata ma DOTRWAĆ najdłużej - przy p bliskim 1 (0.9) powinna być
// relatywnie WYŻEJ niż wypełnienie i obrys względem SWOICH szczytów.
const p9 = obwiednia(0.9);
const pikWypelnienia = o0.wypelnienie;                 // szczyt wypełnienia jest na starcie
const pikPoswiaty = obwiednia(0.5).poswiata;            // szczyt poświaty jest w środku
const decayWypelnienia = p9.wypelnienie / pikWypelnienia;
const decayPoswiaty = p9.poswiata / pikPoswiaty;
spr(`przy p=0.9 wypełnienie już prawie zgasło (${decayWypelnienia.toFixed(3)} swojego szczytu)`,
    decayWypelnienia < 0.02);
spr(`...a poświata przy p=0.9 dalej niesie WIELOKROTNIE większy ułamek swojego szczytu niż wypełnienie ` +
    `(${decayPoswiaty.toFixed(3)} vs ${decayWypelnienia.toFixed(3)}) - DOTRWAŁA po reszcie`,
    decayPoswiaty > decayWypelnienia * 5);

spr('NaN -> traktowane jak p=1 (koniec), skończona wartość, bez wyjątku',
    Object.values(obwiednia(NaN)).every(v => Number.isFinite(v)));

// --- 2. zapal(): odporność i uzbrojenie stanu ---
console.log('\nZAPAL():');
const z1 = new Zaplon();
spr('świeży Zaplon nie jest aktywny', z1.aktywny === false);
z1.zapal([190, 100, 255], 1);
spr('zapal() uzbraja stan (aktywny)', z1.aktywny === true);
spr('zapal() zapisuje barwę', z1._barwa[0] === 190 && z1._barwa[1] === 100 && z1._barwa[2] === 255);

const z2 = new Zaplon();
z2.zapal([1, 2, 3], 0);
spr('siła zero -> zapal() nie uzbraja, bez wyjątku', z2.aktywny === false);
z2.zapal([1, 2, 3], -1);
spr('siła ujemna -> zapal() nie uzbraja, bez wyjątku', z2.aktywny === false);
z2.zapal([1, 2, 3], NaN);
spr('NaN siła -> zapal() nie uzbraja, bez wyjątku', z2.aktywny === false);

const z3 = new Zaplon();
z3.zapal(null, 1);
spr('brak barwy -> fallback na biel, bez wyjątku (aktywny mimo to)', z3.aktywny === true);
spr('  ...barwa faktycznie biała', z3._barwa[0] === 255 && z3._barwa[1] === 255 && z3._barwa[2] === 255);
const z4 = new Zaplon();
z4.zapal([NaN, 1, 2], 1);
spr('barwa z NaN w składowej -> fallback na biel', z4._barwa[0] === 255);

// --- 3. Ponowny zapal() w trakcie trwania RESTARTUJE obwiednię ---
console.log('\nRESTART:');
const z5 = new Zaplon();
z5.zapal([1, 1, 1], 1);
przepusc(z5, 0.6);
const tPrzed = z5._t;
spr(`po 0.6 s zegar jednak ruszył (${tPrzed.toFixed(2)})`, tPrzed > 0.5);
z5.zapal([9, 9, 9], 1);
spr('ponowny zapal() restartuje zegar do zera', z5._t === 0);
spr('  ...i podmienia barwę', z5._barwa[0] === 9);

// --- 4. Obwiednia czasu w Zaplon: kończy się i wygasza aktywny ---
console.log('\nCZAS TRWANIA:');
const z6 = new Zaplon();
z6.zapal([1, 1, 1], 1);
przepusc(z6, 1.0);
spr('po 1.0 s dalej aktywny (efekt trwa ~1.2 s)', z6.aktywny === true);
przepusc(z6, 0.5);
spr('po dalszych 0.5 s (łącznie 1.5 s) efekt się wygasił', z6.aktywny === false);

// --- 5. Odporność: brak trwania / NaN dt / brak maski nie wywraca modułu ---
console.log('\nODPORNOŚĆ:');
const z7 = new Zaplon();
z7.updateAndDraw(null, null, 0, 0, fit, DT);
spr('updateAndDraw() na nieaktywnym Zaplon jest no-opem, bez wyjątku', z7.aktywny === false && z7._t === 0);

const z8 = new Zaplon();
z8.zapal([1, 1, 1], 1);
z8.updateAndDraw(null, null, 0, 0, fit, NaN);
spr('NaN dt -> krok zero, bez wyjątku', z8._t === 0 && z8.aktywny === true);

const z9 = new Zaplon();
z9.zapal([1, 1, 1], 1);
z9.updateAndDraw(null, null, 0, 0, null, DT);
spr('brak fit -> bez wyjątku, zegar mimo to płynie (guard jest PO doliczeniu czasu)', z9._t > 0);

// --- NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnyCzas = NASTAWY.CZAS_TRWANIA;
    NASTAWY.CZAS_TRWANIA = 0.2;
    const z9 = new Zaplon();
    z9.zapal([255, 0, 0], 1);
    // dt klamrowane do 0.1 s per wywołanie - trzy kroki po 0.1 s = 0.3 s łącznie.
    for (let i = 0; i < 3; i++) z9.updateAndDraw(null, null, 0, 0, null, 0.1);   // maska=null -> nie rysuje, ale zegar płynie
    spr(`zmiana NASTAWY.CZAS_TRWANIA widoczna w wygaszeniu (efekt skończony po 0.3 s, aktywny=${z9.aktywny})`,
        z9.aktywny === false);
    NASTAWY.CZAS_TRWANIA = domyslnyCzas;

    spr('wyczyscCache() istnieje i nie rzuca (no-op)', (z9.wyczyscCache(), true));
}

process.exit(ok ? 0 : 1);
