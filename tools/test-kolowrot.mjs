/**
 * Kołowrót - obwiednia pierścieni i fizyka cząstek (mgła + drobiny),
 * BEZ document/Image.
 *
 *   node tools/test-kolowrot.mjs
 *
 * NAPRAWA (2026-09-09): zaczep przeniesiony z "ziemi" (poza kadrem na
 * typowym dystansie tańca) na środek barków, a wszystkie rozmiary/prędkości
 * są teraz MNOŻNIKAMI `skala` (szerokość barków w px), nie stałymi w px ani
 * ułamkami W - patrz nagłówek js/kolowrot.js. `zapal()` ma teraz CZTERY
 * argumenty: (zaczep, skala, wysokoscEkranu, sila) - testy tej wersji muszą
 * podawać każdy z nich we właściwej kolejności, inaczej jeden argument po
 * cichu wyląduje w cudzej roli i test niczego sensownego by nie sprawdzał
 * (dokładnie to już raz się stało przy przejściu z 2 na 3 argumenty).
 *
 * DRUGA NAPRAWA (2026-09-09, ten sam dzień): mgła wydobywa się z DOŁU
 * EKRANU, nie z zaczepu pierścieni - `wysokoscEkranu` to jedyny powód
 * czwartego argumentu, patrz komentarz w js/kolowrot.js:zapal().
 *
 * Rysowanie (drawImage, wypalTintowany) NIE JEST tu testowane - dotyka
 * document, którego nie ma w Node (ten sam powód co tools/test-fala.mjs/
 * test-iskry.mjs). Fizyka cząstek idzie przez _ruszaj(dt) bezpośrednio,
 * obwiednia pierścieni to czysta funkcja, a cały cykl życia klasy jest
 * testowalny przez updateAndDraw(null, dt) - guard na `!ctx` jest PO
 * doliczeniu czasu i fizyki (patrz js/kolowrot.js), więc zegar i tak się
 * przesuwa i cząstki i tak gasną, ale nic nie dotyka DOM.
 */
import { Kolowrot, obwiednia, kregSylwetki, CZAS_TRWANIA_PIERSCIEN,
         MGLA_OPOZNIENIE_MAX, DROBINY_OPOZNIENIE_MAX, NASTAWY } from '../js/kolowrot.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const SKALA = 230;   // typowa szerokość barków w px na kadrze 1920 - patrz SKALA_DOMYSLNA_PX
const H = 1080;       // typowa wysokość płótna w px - zapal() używa jej TYLKO do umieszczenia startu mgły przy dole ekranu
const przepusc = (k, sekundy) => {
    for (let i = 0; i < Math.round(sekundy / DT); i++) k.updateAndDraw(null, DT);
};

// --- 1. obwiednia(): czysta funkcja, pierścień + rozbłysk ---
console.log('OBWIEDNIA PIERŚCIENI (funkcja czysta):');
const o0 = obwiednia(0), o5 = obwiednia(0.5), o1 = obwiednia(1);
spr(`pierścień startuje od zera, nie od razu na pełni (${o0.pierscien.toFixed(3)})`, o0.pierscien < 0.05);
spr(`pierścień jest w pełni widoczny w środku obwiedni (${o5.pierscien.toFixed(2)})`, o5.pierscien > 0.95);
spr(`pierścień gaśnie do zera na końcu (${o1.pierscien.toFixed(3)})`, o1.pierscien < 0.01);

spr(`rozbłysk jest ZEROWY na starcie - to impuls PRZED końcem, nie na starcie (${o0.rozblysk})`, o0.rozblysk === 0);
spr(`rozbłysk ma SZCZYT bliżej końca (p=0.8) niż środka (${obwiednia(0.8).rozblysk.toFixed(2)} > ${o5.rozblysk.toFixed(2)})`,
    obwiednia(0.8).rozblysk > o5.rozblysk);
spr('NaN -> traktowane jak p=1 (koniec), skończone wartości, bez wyjątku',
    Number.isFinite(obwiednia(NaN).pierscien) && Number.isFinite(obwiednia(NaN).rozblysk));

// --- 2. kregSylwetki(): zaczep i skala z pozy, z fallbackiem bez pozy ---
console.log('\nKREG SYLWETKI (zaczep + skala):');
const W = 1920;   // H już zdefiniowane wyżej (używane też przez zapal())
const ramiona = (x1, y1, x2, y2) => ({
    pose: { landmarks: Array(33).fill(null).map(() => ({ x: 0, y: 0 })) },
    width: W, height: H
});
const frameZPoza = ramiona();
frameZPoza.pose.landmarks[11] = { x: 0.45, y: 0.30 };   // lewy bark (znormalizowane 0..1)
frameZPoza.pose.landmarks[12] = { x: 0.55, y: 0.30 };   // prawy bark
const kk1 = kregSylwetki(frameZPoza, W, H);
spr(`z pozą: x to ŚRODEK barków w px (${kk1.x.toFixed(0)} ~ 960)`, Math.abs(kk1.x - 960) < 1);
spr(`z pozą: y to WYSOKOŚĆ barków w px (${kk1.y.toFixed(0)} ~ 324)`, Math.abs(kk1.y - 324) < 1);
spr(`z pozą: skala to ROZSTAW barków w px, dodatnia (${kk1.skala.toFixed(0)})`, kk1.skala > 100 && kk1.skala < 400);

const kk2 = kregSylwetki({ pose: null, width: W, height: H }, W, H);
spr('bez pozy: fallback na środek ekranu (wysokość klatki piersiowej), bez wyjątku',
    Math.abs(kk2.x - W * 0.5) < 1 && Math.abs(kk2.y - H * 0.45) < 1);
spr('bez pozy: skala fallbackowa jest dodatnia i skończona', Number.isFinite(kk2.skala) && kk2.skala > 0);

const kk3 = kregSylwetki({ pose: { landmarks: [] }, width: W, height: H }, W, H);
spr('puste landmarks -> fallback, bez wyjątku', Number.isFinite(kk3.x) && Number.isFinite(kk3.skala));
const kk4 = kregSylwetki(null, W, H);
spr('brak frame -> fallback, bez wyjątku', Number.isFinite(kk4.x) && Number.isFinite(kk4.skala));

// --- 3. zapal(): odporność i uzbrojenie stanu (CZTERY argumenty!) ---
console.log('\nZAPAL(zaczep, skala, wysokoscEkranu, sila):');
const k1 = new Kolowrot();
spr('świeży Kołowrót nie jest aktywny', k1.aktywny === false);
k1.zapal({ x: 960, y: 500 }, SKALA, H, 1);
spr('zapal() uzbraja stan (aktywny)', k1.aktywny === true);
spr(`zapal() generuje mgłę (${k1._mgla.length} cząstek)`, k1._mgla.length > 5);
spr(`zapal() generuje drobiny (${k1._drobiny.length} cząstek)`, k1._drobiny.length > 20);

const k2 = new Kolowrot();
k2.zapal(null, SKALA, H, 1);
spr('brak zaczepu -> zapal() nie uzbraja, bez wyjątku', k2.aktywny === false);
k2.zapal({ x: NaN, y: 0 }, SKALA, H, 1);
spr('NaN w zaczepie -> zapal() nie uzbraja, bez wyjątku', k2.aktywny === false);
k2.zapal({ x: 0, y: 0 }, SKALA, H, 0);
spr('siła zero -> zapal() nie uzbraja, bez wyjątku', k2.aktywny === false);
k2.zapal({ x: 0, y: 0 }, SKALA, H, NaN);
spr('NaN siła -> zapal() nie uzbraja, bez wyjątku', k2.aktywny === false);

// Skala nieprawidłowa (brak pozy w praniu, NaN, zero, ujemna) -> FALLBACK
// na sensowną domyślną, NIE brak uzbrojenia - brak pozy nigdy nie ma
// blokować efektu (GEMINI.md §2, "nic nigdy nie mówi źle").
const k2b = new Kolowrot();
k2b.zapal({ x: 0, y: 0 }, NaN, H, 1);
spr('NaN skala -> zapal() MIMO TO uzbraja (fallback na domyślną skalę), bez wyjątku', k2b.aktywny === true);
const k2c = new Kolowrot();
k2c.zapal({ x: 0, y: 0 }, 0, H, 1);
spr('zerowa skala -> zapal() MIMO TO uzbraja (fallback), bez wyjątku', k2c.aktywny === true);
const k2d = new Kolowrot();
k2d.zapal({ x: 0, y: 0 }, -50, H, 1);
spr('ujemna skala -> zapal() MIMO TO uzbraja (fallback), bez wyjątku', k2d.aktywny === true);

// --- 4. Siła skaluje liczbę cząstek, nie wyłącza (mirror test-iskry.mjs) ---
console.log('\nSIŁA:');
const k3pelna = new Kolowrot(); k3pelna.zapal({ x: 0, y: 0 }, SKALA, H, 1);
const k3slaba = new Kolowrot(); k3slaba.zapal({ x: 0, y: 0 }, SKALA, H, 0.3);
spr(`słabsza siła daje mniej mgły niż pełna (${k3slaba._mgla.length} < ${k3pelna._mgla.length})`,
    k3slaba._mgla.length < k3pelna._mgla.length);
spr(`  ...ale nie zero (${k3slaba._mgla.length})`, k3slaba._mgla.length > 0);
spr(`słabsza siła daje mniej drobin niż pełna (${k3slaba._drobiny.length} < ${k3pelna._drobiny.length})`,
    k3slaba._drobiny.length < k3pelna._drobiny.length);

// --- 5. Skala WPŁYWA na rozmiar/zasięg - bliżej kamery (duża skala) daje
// większy krąg niż dalej (mała skala). To jest SEDNO naprawy: efekt ma ten
// sam WZGLĘDNY rozmiar niezależnie od odległości gracza od kamery.
console.log('\nSKALA WPŁYWA NA ROZMIAR CZĄSTEK:');
const kBlisko = new Kolowrot(); kBlisko.zapal({ x: 0, y: 0 }, 400, H, 1);   // gracz blisko kamery
const kDaleko = new Kolowrot(); kDaleko.zapal({ x: 0, y: 0 }, 120, H, 1);   // gracz daleko od kamery
// TYLKO składowa X - odkąd mgła startuje przy dole ekranu (patrz sekcja
// niżej), jej Y jest zdominowane przez stałe przesunięcie do H*0.98, a nie
// przez skalę, więc hypot(x,y) przestał mierzyć to, co ma. Uśredniamy po
// WSZYSTKICH cząstkach (nie jednej), żeby zniwelować szum pojedynczego
// losowego kąta - dla jednej cząstki cos(kat) mógłby wypaść blisko zera
// niezależnie od skali.
const srXAbs = (cz) => cz.reduce((s, c) => s + Math.abs(c.x), 0) / cz.length;
spr(`większa skala (gracz bliżej) daje WIĘKSZY średni poziomy rozrzut startowy mgły (${srXAbs(kBlisko._mgla).toFixed(0)} > ${srXAbs(kDaleko._mgla).toFixed(0)})`,
    srXAbs(kBlisko._mgla) > srXAbs(kDaleko._mgla));
spr(`większa skala daje WIĘKSZĄ prędkość wznoszenia drobin (${kBlisko._drobiny[0].wznoszenie.toFixed(0)} > ${kDaleko._drobiny[0].wznoszenie.toFixed(0)})`,
    kBlisko._drobiny[0].wznoszenie > kDaleko._drobiny[0].wznoszenie);

// --- 5b. MGŁA WYDOBYWA SIĘ Z DOŁU EKRANU, NIE Z ZACZEPU PIERŚCIENI ---
console.log('\nMGŁA STARTUJE PRZY DOLE EKRANU:');
const zaczepWysoko = { x: 500, y: 200 };   // gracz z barkami wysoko na ekranie
const kMgla = new Kolowrot();
kMgla.zapal(zaczepWysoko, SKALA, H, 1);
// Pozycja BEZWZGLĘDNA na ekranie to zaczep.y + c.y (tak rysuje updateAndDraw).
const yBezwzgledneMgly = (cz) => cz.map(c => zaczepWysoko.y + c.y);
const sredniaYMgly = yBezwzgledneMgly(kMgla._mgla).reduce((a, b) => a + b, 0) / kMgla._mgla.length;
spr(`mgła startuje BLISKO DOŁU EKRANU (śr. Y ${sredniaYMgly.toFixed(0)}), NIE przy zaczepie pierścieni (${zaczepWysoko.y})`,
    sredniaYMgly > H * 0.9);
spr(`...konkretnie blisko H*0.98=${(H * 0.98).toFixed(0)}`,
    Math.abs(sredniaYMgly - H * 0.98) < 50);
// Drobiny (iskierki) NIE ruszają się - zostają przy zaczepie pierścieni,
// tak jak przed tą zmianą. Tylko mgła się przeniosła.
const yBezwzgledneDrobin = kMgla._drobiny.map(c => zaczepWysoko.y + c.y);
const sredniaYDrobin = yBezwzgledneDrobin.reduce((a, b) => a + b, 0) / yBezwzgledneDrobin.length;
spr(`drobiny (iskierki) WCIĄŻ startują przy zaczepie pierścieni (śr. Y ${sredniaYDrobin.toFixed(0)} ~ ${zaczepWysoko.y}), nie przy dole ekranu`,
    Math.abs(sredniaYDrobin - zaczepWysoko.y) < 100);

// Brak/nieprawidłowa wysokoscEkranu -> FALLBACK: mgła wraca do startu przy
// zaczepie (offset zero), bez wyjątku - stare wywołania (bez tego
// argumentu) nie mają się wywalić, tylko po cichu stracić nową funkcję.
const kBezWysokosci = new Kolowrot();
kBezWysokosci.zapal({ x: 0, y: 0 }, SKALA, undefined, 1);
spr('brak wysokoscEkranu -> zapal() MIMO TO uzbraja (fallback: mgła przy zaczepie), bez wyjątku',
    kBezWysokosci.aktywny === true);
const sredniaYFallback = kBezWysokosci._mgla.reduce((s, c) => s + c.y, 0) / kBezWysokosci._mgla.length;
spr(`  ...konkretnie offset mgły wraca do ~0 (śr. Y względem zaczepu ${sredniaYFallback.toFixed(1)})`,
    Math.abs(sredniaYFallback) < 50);

// --- 6. Opóźniony start: WSZYSTKIE cząstki rodzą się z opóźnieniem, ale
// opóźnienia są ROZŁOŻONE - po części czasu jedne już żyją, inne jeszcze nie.
console.log('\nOPÓŹNIONY START CZĄSTEK:');
const k4 = new Kolowrot();
k4.zapal({ x: 0, y: 0 }, SKALA, H, 1);
spr(`zaraz po zapal() WSZYSTKIE cząstki mgły mają ujemny wiek (opóźniony start) (${k4._mgla.filter(c => c.wiek < 0).length}/${k4._mgla.length})`,
    k4._mgla.every(c => c.wiek < 0));
spr(`...i wszystkie drobiny też (${k4._drobiny.filter(c => c.wiek < 0).length}/${k4._drobiny.length})`,
    k4._drobiny.every(c => c.wiek < 0));

// Próbkujemy w POŁOWIE najdłuższego okna opóźnień, NIE w stałym punkcie
// czasu jak "0.5 s" - taki sztywny punkt wcześniej dawał ~10% szans na
// fałszywy alarm (wszystkie 16 cząstek mgły losowo wypadły z opoznienie>0.5s),
// gdy MGLA_OPOZNIENIE_MAX urosło x2. Przy próbkowaniu w połowie okna
// prawdopodobieństwo, że WSZYSTKIE N cząstek wypadnie po tej samej stronie,
// to 0.5^N - dla N=16 to ~0.0015%, dla N=70 astronomicznie mało - test
// zostaje wiarygodny niezależnie od przyszłego strojenia stałych.
const polowaOkna = Math.max(MGLA_OPOZNIENIE_MAX, DROBINY_OPOZNIENIE_MAX) / 2;
for (let i = 0; i < Math.round(polowaOkna / DT); i++) k4._ruszaj(DT);
const zywychMgla = k4._mgla.filter(c => c.wiek >= 0).length;
const nienarodzonychMgla = k4._mgla.filter(c => c.wiek < 0).length;
spr(`po ${polowaOkna.toFixed(2)} s CZĘŚĆ mgły już się narodziła (${zywychMgla}), a część JESZCZE NIE (${nienarodzonychMgla}) - starty są ROZŁOŻONE, nie jednoczesne`,
    zywychMgla > 0 && nienarodzonychMgla > 0);
const zywychDrobiny = k4._drobiny.filter(c => c.wiek >= 0).length;
const nienarodzonychDrobiny = k4._drobiny.filter(c => c.wiek < 0).length;
spr(`to samo dla drobin (żywe ${zywychDrobiny}, nienarodzone ${nienarodzonychDrobiny})`,
    zywychDrobiny > 0 && nienarodzonychDrobiny > 0);

// --- 7. FIZYKA WIRU: styczna traci prędkość SZYBCIEJ niż promieniowa (mirror test-iskry.mjs) ---
console.log('\nFIZYKA WIRU DROBIN:');
const k5 = new Kolowrot();
k5.zapal({ x: 0, y: 0 }, SKALA, H, 1);
// Zbudź WSZYSTKIE drobiny naraz do pomiaru - patrz komentarz w oryginalnej
// wersji tego testu: inaczej "jeszcze nienarodzone" (v=0) zaniżałyby
// średnią na starcie pomiaru w sposób niezwiązany z tłumieniem.
for (const c of k5._drobiny) c.wiek = 0;
const srT = (cz) => cz.reduce((s, c) => s + Math.hypot(c.vtx, c.vty), 0) / cz.length;
const srR = (cz) => cz.reduce((s, c) => s + Math.hypot(c.vrx, c.vry), 0) / cz.length;
const t0 = srT(k5._drobiny), r0 = srR(k5._drobiny);
for (let i = 0; i < 30; i++) k5._ruszaj(DT);   // 0.5 s
const t1 = srT(k5._drobiny), r1 = srR(k5._drobiny);
spr(`po 0.5 s składowa styczna traci WIĘKSZY ułamek prędkości niż promieniowa (${(t1 / t0).toFixed(2)} < ${(r1 / r0).toFixed(2)})`,
    (t1 / t0) < (r1 / r0));

// --- 8. Odporność fizyki na NaN dt ---
console.log('\nODPORNOŚĆ _ruszaj():');
const k6 = new Kolowrot();
k6.zapal({ x: 0, y: 0 }, SKALA, H, 1);
const mglaPrzed = k6._mgla.length, drobinyPrzed = k6._drobiny.length;
k6._ruszaj(NaN);
spr('NaN dt w _ruszaj() -> bez wyjątku, liczba cząstek bez zmian',
    k6._mgla.length === mglaPrzed && k6._drobiny.length === drobinyPrzed);

// --- 9. Cały cykl życia kończy się w skończonym czasie, BEZ document ---
console.log('\nCYKL ŻYCIA (updateAndDraw z ctx=null):');
const k7 = new Kolowrot();
k7.zapal({ x: 960, y: 500 }, SKALA, H, 1);
let klatek = 0;
while (k7.aktywny && klatek < 700) { k7.updateAndDraw(null, DT); klatek++; }
spr(`Kołowrót wygasza się w skończonym czasie z ctx=null (po ${(klatek * DT).toFixed(2)} s, między 3 s a 9 s)`,
    !k7.aktywny && klatek * DT > 3 && klatek * DT < 9);
spr('...i wszystkie cząstki faktycznie znikły z tablic (nie tylko "aktywny=false")',
    k7._mgla.length === 0 && k7._drobiny.length === 0);

// --- 10. Zegar pierścieni i zegar cząstek są NIEZALEŻNE - efekt trwa,
// dopóki OBA się nie skończą, niezależnie od tego, który skończy się
// pierwszy. NIE zakładamy z góry kolejności (patrz komentarz "DWA ZEGARY"
// w kolowrot.js - przy obecnych stałych cząstki gasną PRZED zamknięciem
// pierścieni, bo CZAS_TRWANIA_PIERSCIEN urosło x2, a max. życie cząstki
// nie) - test sprawdza FAKT, nie zgaduje który zegar jest dłuższy.
console.log('\nOBA ZEGARY MUSZĄ SIĘ SKOŃCZYĆ, ZANIM EFEKT ZGAŚNIE:');
const k8 = new Kolowrot();
k8.zapal({ x: 0, y: 0 }, SKALA, H, 1);
przepusc(k8, CZAS_TRWANIA_PIERSCIEN + 0.05);   // tuż PO zamknięciu pierścieni
const mglaPoPierscieniach = k8._mgla.length, drobinyPoPierscieniach = k8._drobiny.length;
spr(`tuż po zamknięciu pierścieni (${(CZAS_TRWANIA_PIERSCIEN + 0.05).toFixed(2)} s) zostało ${mglaPoPierscieniach + drobinyPoPierscieniach} żywych cząstek`,
    mglaPoPierscieniach + drobinyPoPierscieniach >= 0);   // sama liczba nie jest tu tezą - poniższe dwie asercje są
spr(`  ...jeśli JAKIEŚ zostały, Kołowrót jest WCIĄŻ aktywny mimo zamkniętych pierścieni`,
    (mglaPoPierscieniach + drobinyPoPierscieniach > 0) === k8.aktywny);
przepusc(k8, 4);   // z dużym zapasem ponad najdłuższe możliwe opóźnienie+życie cząstki (~7,6 s od zapal())
spr('...a jeśli poczekać dość długo, WSZYSTKIE cząstki i tak w końcu wygasają', !k8.aktywny);

// --- 11. updateAndDraw() na nieaktywnym Kołowrocie jest no-opem ---
console.log('\nODPORNOŚĆ updateAndDraw():');
const k9 = new Kolowrot();
k9.updateAndDraw(null, DT);
spr('updateAndDraw() na nieaktywnym Kołowrocie jest no-opem, bez wyjątku', k9.aktywny === false && k9._t === 0);

const k10 = new Kolowrot();
k10.zapal({ x: 0, y: 0 }, SKALA, H, 1);
k10.updateAndDraw(null, NaN);
spr('NaN dt w updateAndDraw() -> krok zero na zegarze pierścieni, bez wyjątku', k10._t === 0 && k10.aktywny === true);

// --- NASTAWY - eksportowane i mutowalne (dla suwaków tools/scena.html) ---
console.log('\nNASTAWY (mutowalność dla stanowiska):');
{
    const domyslnaLiczba = NASTAWY.MGLA_LICZBA;
    NASTAWY.MGLA_LICZBA = 3;
    const k9 = new Kolowrot();
    k9.zapal({ x: 100, y: 100 }, 200, 800, 1);
    spr(`zmiana NASTAWY.MGLA_LICZBA widoczna w zapal() (${k9._mgla.length})`, k9._mgla.length === 3);
    NASTAWY.MGLA_LICZBA = domyslnaLiczba;

    spr('wyczyscCache() istnieje i nie rzuca (deleguje do assety.js)', (k9.wyczyscCache(), true));
}

// --- DOKŁADNOŚĆ TŁUMIENIA (P2b) - jedna drobina vs forma zamknięta ---
console.log('\nDOKŁADNOŚĆ TŁUMIENIA (krokTlumienia w drobinach, patrz js/czastki.js):');
{
    const k9 = new Kolowrot();
    const V_STYCZNA = 100, V_PROM = 60;
    // wznoszenie=0 izoluje czysty opór dwuskładnikowy - wiek=0 (nie ujemny),
    // żeby fizyka liczyła się od pierwszego kroku (pominięcie opóźnionego startu).
    k9._drobiny.push({ x: 0, y: 0, vtx: V_STYCZNA, vty: 0, vrx: 0, vry: V_PROM,
                        wznoszenie: 0, zycie: 10, wiek: 0, skala: 1, wariant: 0 });
    const N = 30;
    const T = N * DT;
    for (let i = 0; i < N; i++) k9._ruszaj(DT);
    const stycznaOczekiwana = V_STYCZNA * (1 - Math.exp(-NASTAWY.DROBINY_OPOR_STYCZNY * T)) / NASTAWY.DROBINY_OPOR_STYCZNY;
    const promOczekiwany = V_PROM * (1 - Math.exp(-NASTAWY.DROBINY_OPOR_PROMIENIOWY * T)) / NASTAWY.DROBINY_OPOR_PROMIENIOWY;
    const c = k9._drobiny[0];
    spr(`styczna (x) zgadza się z formą zamkniętą co do 1e-6 (${c.x.toFixed(6)} vs ${stycznaOczekiwana.toFixed(6)})`,
        Math.abs(c.x - stycznaOczekiwana) < 1e-6);
    spr(`promieniowa (y) zgadza się z formą zamkniętą co do 1e-6 (${c.y.toFixed(6)} vs ${promOczekiwany.toFixed(6)})`,
        Math.abs(c.y - promOczekiwany) < 1e-6);
}

process.exit(ok ? 0 : 1);
