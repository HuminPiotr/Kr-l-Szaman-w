/**
 * Odpowiedź ekranu (Kierunek B: wstrząs + winieta + bramkowany bloom) -
 * obwiednia czasu i odporność, BEZ rysowania.
 *
 *   node tools/test-ekran.mjs
 *
 * Guard na `!ctx` jest PIERWSZY w przesun()/dokoncz() (patrz js/ekran.js) -
 * dzięki temu test może wołać obie metody z ctx=null: dokoncz() dolicza
 * czas PRZED guardem, więc zegar da się napędzić bez document, którego
 * nie ma w Node. Ten sam wzorzec co tools/test-zaplon.mjs / test-aura-impuls.mjs.
 */
import { Ekran, obwiedniaUderzenia, obwiedniaFali, obwiedniaCiepla, przesuniecieCiepla, NASTAWY } from '../js/ekran.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const przepusc = (e, sekundy) => {
    for (let i = 0; i < Math.round(sekundy / DT); i++) e.dokoncz(null, 1920, 1080, DT);
};

// --- 1. obwiedniaUderzenia(): czysta funkcja, startuje wysoko i gaśnie ---
console.log('OBWIEDNIA UDERZENIA (funkcja czysta):');
spr(`p=0 daje pełną siłę (${obwiedniaUderzenia(0).toFixed(2)})`, Math.abs(obwiedniaUderzenia(0) - 1) < 0.01);
spr(`p=1 wygasła prawie do zera (${obwiedniaUderzenia(1).toFixed(3)})`, obwiedniaUderzenia(1) < 0.01);
spr('NaN -> skończona wartość, bez wyjątku', Number.isFinite(obwiedniaUderzenia(NaN)));
// Obwiednia tłumiona/oscylująca: całkowita energia (suma |wartości| na siatce)
// musi być skoncentrowana w PIERWSZEJ połowie czasu, nie rozłożona równo -
// to odróżnia "wstrząs, który odbija i gaśnie" od zwykłego opadania liniowego.
let energiaPierwszaPolowa = 0, energiaDrugaPolowa = 0;
for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    (p < 0.5 ? (v => energiaPierwszaPolowa += v) : (v => energiaDrugaPolowa += v))(obwiedniaUderzenia(p));
}
spr(`energia skoncentrowana w PIERWSZEJ połowie obwiedni (${energiaPierwszaPolowa.toFixed(1)} > ${energiaDrugaPolowa.toFixed(1)})`,
    energiaPierwszaPolowa > energiaDrugaPolowa * 3);

// --- 2. uderz(): odporność i uzbrojenie stanu ---
console.log('\nUDERZ():');
const e1 = new Ekran();
spr('świeży Ekran ma siłę zero', e1.sila === 0);
e1.uderz(1);
spr(`uderz() podnosi siłę (${e1.sila.toFixed(2)})`, e1.sila > 0.9);

const e2 = new Ekran();
e2.uderz(0);
spr('siła zero -> uderz() nie uzbraja, bez wyjątku', e2.sila === 0);
e2.uderz(-1);
spr('siła ujemna -> uderz() nie uzbraja, bez wyjątku', e2.sila === 0);
e2.uderz(NaN);
spr('NaN siła -> uderz() nie uzbraja, bez wyjątku', e2.sila === 0);

// --- 3. Siła gaśnie z czasem i wraca do zera w skończonym czasie ---
console.log('\nGASNIĘCIE W CZASIE:');
const e3 = new Ekran();
e3.uderz(1);
przepusc(e3, 0.02);
const siłaWczesnie = e3.sila;
spr(`tuż po uderzeniu siła jeszcze wysoka (${siłaWczesnie.toFixed(2)})`, siłaWczesnie > 0.5);
przepusc(e3, 1.0);   // razem dużo więcej niż CZAS_TRWANIA (~0.45 s)
spr(`po 1 s dalej siła spadła do zera (${e3.sila.toFixed(3)})`, e3.sila < 0.01);

// --- 4. Ponowne uderz() w trakcie trwania RESTARTUJE obwiednię ---
console.log('\nRESTART:');
const e4 = new Ekran();
e4.uderz(1);
przepusc(e4, 0.3);
const siłaPrzedRestartem = e4.sila;
spr(`po 0.3 s siła już wyraźnie opadła (${siłaPrzedRestartem.toFixed(2)})`, siłaPrzedRestartem < 0.5);
e4.uderz(1);
spr(`ponowny uderz() przywraca siłę blisko szczytu (${e4.sila.toFixed(2)})`, e4.sila > 0.9);

// --- 5. Odporność metod rysujących na ctx=null / złe wymiary ---
console.log('\nODPORNOŚĆ RYSOWANIA:');
const e5 = new Ekran();
e5.uderz(1);
e5.przesun(null, 1920, 1080);
spr('przesun() z ctx=null nie wywala wyjątku', true);
e5.dokoncz(null, 1920, 1080, DT);
spr('dokoncz() z ctx=null nie wywala wyjątku', true);
e5.przesun({}, NaN, 1080);
spr('przesun() z NaN W nie wywala wyjątku', true);
e5.dokoncz({}, 1920, NaN, DT);
spr('dokoncz() z NaN H nie wywala wyjątku', true);

// --- 6. dokoncz() dolicza czas NAWET gdy ctx jest null (guard PO zegarze) ---
console.log('\nZEGAR NIEZALEŻNY OD CTX:');
const e6 = new Ekran();
e6.uderz(1);
const t0 = e6._t;
e6.dokoncz(null, 1920, 1080, DT);
spr(`zegar płynie mimo ctx=null (${t0} -> ${e6._t.toFixed(4)})`, e6._t > t0);

// --- 7. obwiedniaFali(): soczewka refrakcyjna Aarda, czysta funkcja ---
console.log('\nOBWIEDNIA FALI POWIETRZA (funkcja czysta):');
spr(`p=0 pełne wybrzuszenie (${obwiedniaFali(0).toFixed(2)})`, Math.abs(obwiedniaFali(0) - 1) < 0.01);
spr(`p=1 wygasła do zera (${obwiedniaFali(1).toFixed(3)})`, obwiedniaFali(1) < 0.01);
let monotoniczna = true;
for (let i = 1; i <= 100; i++) if (obwiedniaFali(i / 100) > obwiedniaFali((i - 1) / 100)) monotoniczna = false;
spr('MONOTONICZNIE gaśnie (soczewka nie ma "odbijać" jak wstrząs)', monotoniczna);
spr('NaN -> skończona wartość, bez wyjątku', Number.isFinite(obwiedniaFali(NaN)));

// --- 8. falaPowietrza(): stan niezależny od wstrząsu, własny zegar ---
console.log('\nFALA POWIETRZA (stan):');
const e8 = new Ekran();
spr('świeży Ekran nie ma aktywnej fali', e8.falaAktywna === false);
e8.falaPowietrza({ x: 500, y: 400 }, { x: 0, y: 0, z: -1 }, 1);
spr('falaPowietrza() uzbraja falę', e8.falaAktywna === true);
spr('  ...ale NIE uruchamia wstrząsu (osobne zdarzenia, main.js decyduje)', e8.sila === 0);
przepusc(e8, 1.0);
spr('po 1 s fala sama wygasła (zegar płynie w dokoncz() mimo ctx=null)', e8.falaAktywna === false);

const e8b = new Ekran();
e8b.falaPowietrza({ x: NaN, y: 400 }, { x: 0, y: 0, z: -1 }, 1);
spr('NaN w zaczepie -> nie uzbraja, bez wyjątku', e8b.falaAktywna === false);
e8b.falaPowietrza({ x: 500, y: 400 }, { x: 0, y: 0, z: 0 }, 1);
spr('kierunek zerowy -> nie uzbraja, bez wyjątku', e8b.falaAktywna === false);
e8b.falaPowietrza({ x: 500, y: 400 }, null, 1);
spr('brak kierunku -> nie uzbraja, bez wyjątku', e8b.falaAktywna === false);
e8b.falaPowietrza({ x: 500, y: 400 }, { x: 0, y: 0, z: -1 }, 0);
spr('siła zero -> nie uzbraja, bez wyjątku', e8b.falaAktywna === false);
e8b.falaPowietrza({ x: 500, y: 400 }, { x: 0, y: 0, z: -1 }, NaN);
spr('NaN siła -> nie uzbraja, bez wyjątku', e8b.falaAktywna === false);

const e8c = new Ekran();
e8c.falaPowietrza({ x: 500, y: 400 }, { x: 1, y: 0, z: 0 }, 1);
e8c.dokoncz(null, 1920, 1080, DT);
e8c.dokoncz({}, NaN, 1080, DT);
spr('dokoncz() z aktywną falą i ctx=null / NaN W nie wywala wyjątku', true);

// --- NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnyCzas = NASTAWY.CZAS_TRWANIA;
    NASTAWY.CZAS_TRWANIA = 10;   // wstrząs trwający 10 s zamiast 0.45 s
    const e9 = new Ekran();
    e9.uderz(1);
    e9.dokoncz(null, 1920, 1080, 0.3);
    spr(`zmiana NASTAWY.CZAS_TRWANIA widoczna w sile po 0.3 s (${e9.sila.toFixed(2)} - wciąż wysoka, nie opadła jak przy 0.45 s)`,
        e9.sila > 0.5);
    NASTAWY.CZAS_TRWANIA = domyslnyCzas;

    spr('wyczyscCache() istnieje i nie rzuca (no-op)', (e9.wyczyscCache(), true));
}

// --- FALA CIEPŁA (Okadzenie) - refrakcja od dołu kadru, bez koloru ---
console.log('\nFALA CIEPŁA - obwiednia (funkcja czysta):');
{
    const o0 = obwiedniaCiepla(0), oSz = obwiedniaCiepla(0.25), o1 = obwiedniaCiepla(1);
    spr(`p=0: pas jeszcze płaski, drganie zero (${o0.wys.toFixed(2)}, ${o0.sila.toFixed(2)})`, o0.wys < 0.05 && o0.sila < 0.05);
    spr(`p=0.25: pas wysoko, drganie mocne (${oSz.wys.toFixed(2)}, ${oSz.sila.toFixed(2)})`, oSz.wys > 0.6 && oSz.sila > 0.6);
    spr(`p=1: drganie wygasło (${o1.sila.toFixed(3)})`, o1.sila < 0.01);
    spr('wys i sila w 0..1 na całej siatce', Array.from({ length: 101 }, (_, i) => obwiedniaCiepla(i / 100))
        .every(o => o.wys >= 0 && o.wys <= 1 && o.sila >= 0 && o.sila <= 1));
    const n = obwiedniaCiepla(NaN);
    spr('NaN -> skończone wartości', Number.isFinite(n.wys) && Number.isFinite(n.sila));
}

console.log('\nFALA CIEPŁA - przesunięcie paska (funkcja czysta):');
{
    const H = 1080, wys = 600;
    const maxNa = (y) => Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(przesuniecieCiepla(y, wys, i * 0.013, H))));
    spr('na górnej granicy pasa i powyżej - zero', maxNa(wys) === 0 && maxNa(wys + 50) === 0);
    const dol = maxNa(0), srodek = maxNa(wys * 0.5), gora = maxNa(wys * 0.9);
    spr(`najmocniej przy dolnej krawędzi, słabnie ku górze (${dol.toFixed(1)} > ${srodek.toFixed(1)} > ${gora.toFixed(1)} px)`,
        dol > srodek && srodek > gora && dol > 0);
    spr(`amplituda w granicach NASTAWY (${dol.toFixed(1)} <= ${(NASTAWY.CIEPLO_AMPLITUDA_H * H).toFixed(1)} px)`,
        dol <= NASTAWY.CIEPLO_AMPLITUDA_H * H + 1e-9);
    spr('zmienia się w czasie (falowanie, nie stały skos)',
        Math.abs(przesuniecieCiepla(40, wys, 0, H) - przesuniecieCiepla(40, wys, 0.2, H)) > 0.1);
    spr('śmieci -> 0, bez NaN', przesuniecieCiepla(NaN, wys, 0, H) === 0 && przesuniecieCiepla(10, 0, 0, H) === 0
        && przesuniecieCiepla(10, wys, NaN, H) === 0);
}

console.log('\nFALA CIEPŁA (stan):');
{
    const e = new Ekran();
    spr('świeży Ekran - fala ciepła nieaktywna', e.cieploAktywne === false);
    e.falaCiepla();
    spr('falaCiepla() uruchamia', e.cieploAktywne === true);
    przepusc(e, NASTAWY.CIEPLO_CZAS * 0.5);
    spr('w połowie czasu dalej trwa', e.cieploAktywne === true);
    e.falaCiepla();
    przepusc(e, NASTAWY.CIEPLO_CZAS * 0.7);
    spr('ponowne wywołanie restartuje zegar', e.cieploAktywne === true);
    przepusc(e, NASTAWY.CIEPLO_CZAS * 0.4);
    spr('po CIEPLO_CZAS wygasa', e.cieploAktywne === false);
    const e2 = new Ekran();
    e2.falaCiepla();
    e2.dokoncz(null, 1920, 1080, DT);
    e2.dokoncz({}, NaN, 1080, DT);
    spr('dokoncz() z falą ciepła i ctx=null / NaN W nie wywala wyjątku', true);
}

process.exit(ok ? 0 : 1);
