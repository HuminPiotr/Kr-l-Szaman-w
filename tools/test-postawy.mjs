// tools/test-postawy.mjs
/**
 * Pięć pieczęci styku: WŁASNOŚCI, nie progi.
 *
 *   node tools/test-postawy.mjs
 *
 * PODZIAŁ PRACY MIĘDZY TESTAMI JEST CELOWY. Ten plik chodzi po danych
 * SYNTETYCZNYCH i sprawdza własności, które muszą zachodzić niezależnie od
 * tego, jak wystrojone są progi: ciągłość wyniku, niezmienniczość na odbicie
 * lustrzane, minimum zamiast średniej, zero przy braku danych.
 *
 * PROGI sprawdza wyłącznie tools/test-rozdzielnosc.mjs, na nagraniach
 * z żywego ciała. Syntetyczna poza nigdy nie dowodzi, że próg jest dobry -
 * dowodzi tylko, że wzór się nie wywraca.
 *
 * worldLandmarks: metry, początek w środku bioder, oś Y W DÓŁ.
 * Barki mają y ujemne (~-0.55), dłoń opuszczona poniżej bioder - dodatnie.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { resetSkali, skalaCiala, aktualizujSkale } from '../js/znaki/postawa.js';
import { weles } from '../js/znaki/weles.js';
import { stribog } from '../js/znaki/stribog.js';
import { mokosz } from '../js/znaki/mokosz.js';
import { perun } from '../js/znaki/perun.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { kierunekDloni } from '../js/znaki/dlon.js';
import { PROGI } from '../js/znaki/progi-zmierzone.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/**
 * Sylwetka odniesienia: barki 0.40 m rozstawu, 0.55 m nad biodrami.
 * Nadgarstki i łokcie podaje wywołujący - to one niosą gest.
 *
 * `obrot` (stopnie) obraca BARKI wokół osi Y: rozstaw barków w pełnym 3D
 * zostaje niezmieniony (to sztywne ciało), ale jego rzut na płaszczyznę
 * x,y kurczy się, a różnica przechodzi na oś z. Służy do sprawdzenia, że
 * skalaCiala() liczy PEŁNE 3D, nie tylko x,y - patrz sekcja GŁĘBIA niżej.
 */
export function cialo({ nadgL, nadgP, lokL, lokP, vis = 1, obrot = 0 }) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: vis }));
  const p = (x, y, z = 0) => ({ x, y, z, visibility: vis });
  const a = obrot * Math.PI / 180;
  wl[11] = p(-0.20 * Math.cos(a), -0.55, -0.20 * Math.sin(a));
  wl[12] = p(0.20 * Math.cos(a), -0.55, 0.20 * Math.sin(a));
  wl[23] = p(-0.12, 0.00); wl[24] = p(0.12, 0.00);
  wl[15] = p(nadgL[0], nadgL[1], nadgL[2] ?? 0);
  wl[16] = p(nadgP[0], nadgP[1], nadgP[2] ?? 0);
  wl[13] = p(lokL[0], lokL[1], lokL[2] ?? 0);
  wl[14] = p(lokP[0], lokP[1], lokP[2] ?? 0);
  return wl;
}

const rej = new ZnakRegistry();
// POPRAWKA WZGLĘDEM BRIEFU zadania 10: brief twierdził, że `swarogDlon` jest
// "już zarejestrowany z Task 7" w TYM pliku - nieprawda, Task 7 zarejestrował
// go w tools/test-pieczecie-dloni.mjs, tools/test-splot.mjs i
// tools/test-runy.mjs, nigdy tutaj. Bez tej rejestracji `ig.swarog` niżej
// byłby `undefined`, nie liczbą.
rej.zarejestruj(weles); rej.zarejestruj(stribog); rej.zarejestruj(mokosz);
rej.zarejestruj(perun); rej.zarejestruj(swarogDlon);
export const ocen = (wl, hands = []) => {
  resetSkali();
  return rej.ocen({ hands, pose: { landmarks: [], worldLandmarks: wl }, width: 1920, height: 1080, dt: 1 / 60, now: 0 });
};

/**
 * Dłoń zaciśnięta w pięść: każdy nieciciukowy palec ZAGIĘTY z powrotem ku
 * nasadzie, nie tylko "opuszek blisko nadgarstka".
 *
 * POPRAWKA WZGLĘDEM WERSJI Z BRIEFU. Wersja z briefu ustawiała stawy PIP/DIP
 * każdego palca na TĘ SAMĄ pozycję co nasada (wartość domyślna tablicy),
 * z jedynym realnym punktem będącym opuszkiem. `wyprostowany()` liczy
 * prostotę jako |nasada→opuszek| / (suma długości członów) - gdy środkowe
 * stawy pokrywają się z nasadą, łańcuch degeneruje się do JEDNEGO odcinka
 * i wychodzi idealnie "prosty" (ratio = 1.0), czyli fixture nazwany "pięść"
 * dawał zwinieta() = 0.04 (ZMIERZONE node -e, patrz raport zadania) -
 * czyli dłoń rozprostowaną w mierze, którą test miał symulować jako
 * zaciśniętą. Tu każdy palec faktycznie się ZAGINA: staw PIP odsunięty od
 * nasady, DIP i opuszek wracają w stronę nasady - realna geometria pięści,
 * zmierzona (node -e) jako zwinieta() = 1.000.
 *
 * `reka` pozwala wywołującemu zażądać 'Left' albo 'Right' - dwie dłonie
 * w jednej klatce to fizycznie jedna lewa i jedna prawa, nigdy dwie te same
 * (POPRAWKA zadanie 8: dawniej obie strony zwracały zawsze 'Left', patrz
 * `otwartaDlon()` niżej dla tej samej poprawki).
 */
export function piesc(reka = 'Left') {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.50, y: 0.50, z: 0 }));
  lm[0] = { x: 0.50, y: 0.58, z: 0 };                                  // nadgarstek
  lm[1] = { x: 0.42, y: 0.54, z: 0 }; lm[2] = { x: 0.40, y: 0.48, z: 0 };
  lm[3] = { x: 0.42, y: 0.46, z: 0 }; lm[4] = { x: 0.46, y: 0.50, z: 0 };  // kciuk (poza metryką, ignorowany przez zwinieta)
  const palec = (nx) => ({
    baza: { x: nx, y: 0.50, z: 0 },
    pip:  { x: nx, y: 0.42, z: 0 },
    dip:  { x: nx - 0.02, y: 0.46, z: 0 },
    tip:  { x: nx - 0.01, y: 0.51, z: 0 }
  });
  const wsk = palec(0.46); lm[5] = wsk.baza; lm[6] = wsk.pip; lm[7] = wsk.dip; lm[8] = wsk.tip;
  const sro = palec(0.50); lm[9] = sro.baza; lm[10] = sro.pip; lm[11] = sro.dip; lm[12] = sro.tip;
  const ser = palec(0.54); lm[13] = ser.baza; lm[14] = ser.pip; lm[15] = ser.dip; lm[16] = ser.tip;
  const mal = palec(0.58); lm[17] = mal.baza; lm[18] = mal.pip; lm[19] = mal.dip; lm[20] = mal.tip;
  return { handedness: reka, landmarks: lm };
}

/**
 * Dłoń rozprostowana: palce wyciągnięte daleko od nadgarstka.
 *
 * POPRAWKA (zadanie 8, przegląd zadania 7). Stawy PIP i DIP każdego
 * niekciukowego palca lądowały w TYM SAMYM punkcie (`posrednie` ustawiało
 * oba na (x, y=0.25)) - dokładnie ta sama degeneracja łańcucha, która w
 * `piesc()` z briefu zadania 7 dawała fixture mierzący się jako przeciwieństwo
 * tego, co deklarował. Tu akurat oba stawy leżały na tej samej pionowej
 * prostej co nasada i opuszek, więc `wyprostowany()` i tak wychodził
 * poprawnie (1.0) - ale to przypadek geometrii, nie gwarancja wzoru, i
 * pierwszy kolejny fixture zbudowany na tym wzorze (np. palec zgięty w bok)
 * by się na tym wywrócił. PIP i DIP dostają teraz WŁASNE, różne y - trzy
 * równe odcinki między nasadą (0.35) a opuszkiem (0.15).
 */
export function otwartaDlon(reka = 'Left') {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.50, y: 0.50, z: 0 }));
  lm[0] = { x: 0.50, y: 0.60, z: 0 };
  const nasady = { 5: 0.40, 9: 0.46, 13: 0.52, 17: 0.58 };
  const opuszki = { 4: 0.34, 8: 0.40, 12: 0.46, 16: 0.52, 20: 0.58 };
  for (const [i, x] of Object.entries(nasady)) lm[i] = { x, y: 0.35, z: 0 };
  lm[1] = { x: 0.44, y: 0.55, z: 0 }; lm[2] = { x: 0.40, y: 0.48, z: 0 }; lm[3] = { x: 0.37, y: 0.40, z: 0 };
  for (const [i, x] of Object.entries(opuszki)) lm[i] = { x, y: 0.15, z: 0 };
  // Trzy równe odcinki nasada(0.35) -> pip -> dip -> opuszek(0.15): PIP i DIP
  // dostają WŁASNE y, nie ten sam punkt co siebie nawzajem.
  const pipY = 0.35 - (0.35 - 0.15) / 3;
  const dipY = 0.35 - 2 * (0.35 - 0.15) / 3;
  const pip = { 6: 0.40, 10: 0.46, 14: 0.52, 18: 0.58 };
  const dip = { 7: 0.40, 11: 0.46, 15: 0.52, 19: 0.58 };
  for (const [i, x] of Object.entries(pip)) lm[i] = { x, y: pipY, z: 0 };
  for (const [i, x] of Object.entries(dip)) lm[i] = { x, y: dipY, z: 0 };
  return { handedness: reka, landmarks: lm };
}

// ZIEMIA: pięści na przeciwnych barkach. Nadgarstek LEWY przy barku PRAWYM.
//
// ŁOKCIE ROZSTAWIONE (0.40 m, szerokość barków - nie 0.20 m jak w
// pierwszej wersji tego pliku). weles.js NIE CZYTA łokci w ogóle
// (PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P] - LOKIEC_L/LOKIEC_P nie
// występują), więc ich pozycja była niedookreślona przez własny cel tego
// fixture'a. Wąskie 0.20 m przypadkiem mieściło się w progu STYK powietrza
// (0.872 znormalizowane, próg stribog.js) - fixture "ziemia" bez żadnej
// zmiany geometrii istotnej dla weles zapalał obcą pieczęć (zmierzone w
// zadaniu 8: stribog=1.00 przy wąskich łokciach). Łokcie DOKŁADNIE pod
// barkami (0.40 m, znormalizowane 1.00 > STYK_ZERO 0.872) to fizycznie
// osiągalna poza "ramiona skrzyżowane na krzyż" i leży bezpiecznie poza
// progiem striboga (stribog=0.00) - poprawka fixture'a, nie progu, zgodnie
// z zasadą zadania.
const ZIEMIA = cialo({
  nadgL: [0.20, -0.55], lokL: [-0.20, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.20, -0.30]
});

console.log('ZIEMIA:');
const z = ocen(ZIEMIA, [piesc('Left'), piesc('Right')]);
// Próg PODNIESIONY z briefu (>0.7) na >0.9 po przeglądzie: 0.7 pokrywa się
// liczbowo z WAGA_BEZ_DLONI, więc mutant "piesci() zawsze zwraca
// WAGA_BEZ_DLONI" (czyli kwalifikator pięści całkowicie wyłączony) był
// łapany wyłącznie zbiegiem okoliczności na granicy. Realny wynik to 1.00,
// więc 0.9 nic nie kosztuje, a odcina tę furtkę z zapasem.
spr(`pięści na barkach zapalają ziemię (${z.weles.toFixed(2)})`, z.weles > 0.9);

const opuszczone = ocen(cialo({
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15],
  nadgP: [0.22, 0.30], lokP: [0.21, -0.15]
}), [piesc('Left'), piesc('Right')]);
spr(`ręce opuszczone NIE zapalają ziemi (${opuszczone.weles.toFixed(2)})`, opuszczone.weles < 0.2);

// Ręce skrzyżowane NISKO, przy biodrach - to nie ziemia (dawny Splot).
// Nadgarstki leżą blisko linii bioder (y ~ 0.00), więc odległość do
// PRZECIWNEGO barku (y ~ -0.55) jest rzędu całego rozstawu barków i wyraźnie
// przekracza próg STYK_ZERO zmierzony na żywym ciele - w przeciwieństwie do
// wersji z briefu (nadgarstki na wysokości pasa, y=-0.15), która lądowała
// ok. 1 szerokości barków od przeciwnego barku i NIE przekraczała progu.
const nisko = ocen(cialo({
  nadgL: [0.10, 0.00], lokL: [-0.20, -0.20],
  nadgP: [-0.10, 0.00], lokP: [0.20, -0.20]
}), [piesc('Left'), piesc('Right')]);
spr(`ręce skrzyżowane nisko NIE zapalają ziemi (${nisko.weles.toFixed(2)})`, nisko.weles < 0.5);

console.log('\nLUSTRO:');
// Odległości są niezmiennikiem odbicia - to jest cały powód, dla którego
// nowy weles.js nie potrzebuje formuły ze znakiem iloczynu (stary weles.js:46).
const odbij = (wl) => wl.map(p => ({ ...p, x: -p.x }));

// POPRAWKA PO PRZEGLĄDZIE: `ZIEMIA` (pełny styk, dystans 0) jest
// NASYCONA - stykL i stykP są przypięte do sufitu 1.0 przed i po odbiciu,
// więc test porównywał 1.00 z 1.00 niezależnie od tego, CO liczy score().
// Funkcja zwracająca stałą przeszłaby to sprawdzenie. Nowa poza trzyma
// obie pięści W POŁOWIE rampy styku (nadgarstki 0.15+0.32 m od barku, czyli
// znormalizowane 1.1775 szerokości barków - między STYK_PELNY=0.941 a
// STYK_ZERO=1.416), więc błąd MAGNITUDY (zła skala, zamieniony próg,
// błędny znak we wzorze na odległość) ma tu miejsce, żeby się objawić.
const ZIEMIA_POL_RAMPY = cialo({
  nadgL: [0.20, -0.079], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.079], lokP: [0.10, -0.30]
});
const polRampy = ocen(ZIEMIA_POL_RAMPY, [piesc('Left'), piesc('Right')]);
spr(`fixture lustra faktycznie leży w połowie rampy (${polRampy.weles.toFixed(2)}, oczekiwane 0.4-0.6)`,
    polRampy.weles > 0.4 && polRampy.weles < 0.6);
const polRampyL = ocen(odbij(ZIEMIA_POL_RAMPY), [piesc('Left'), piesc('Right')]);
spr(`odbita ziemia (połowa rampy) = ta sama (${polRampyL.weles.toFixed(2)})`,
    Math.abs(polRampyL.weles - polRampy.weles) < 0.02);

// GRANICA TEGO, CO LUSTRO MOŻE UDOWODNIĆ (zweryfikowana mutation testingiem,
// patrz raport zadania). Odbicie x -> -x jest IZOMETRIĄ: dla KAŻDEJ pary
// punktów dist(odbicie(A), odbicie(B)) = dist(A, B), niezależnie od tego,
// KTÓRE punkty formuła akurat porówna. Efekt: żadna formuła zbudowana
// WYŁĄCZNIE z odległości (jak styk() tutaj) nie może złamać niezmienniczości
// lustra - nawet jeśli sparuje ZŁE punkty (np. nadgarstek z barkiem PO TEJ
// SAMEJ stronie zamiast przeciwnej). Zmierzone: podmiana BARK_P->BARK_L w
// stykL daje 0.000 PRZED i 0.000 PO odbiciu - lustro milczy, bo obie wersje
// są sobie równe, tylko obie błędne. Tę klasę błędu łapie WYŁĄCZNIE
// podniesiony próg głównej asercji ZIEMI (>0.9) na oryginalnym `ZIEMIA` -
// tam wynik spada z 1.00 do 0.00. Lustro udowadnia coś WĘŻSZEGO i wciąż
// realnego: że we wzorze NIE MA odczytu surowej WSPÓŁRZĘDNEJ czy ZNAKU
// (jak w dawnym `Math.sign(roznicaBark)`, stary weles.js:46) - dokładnie
// klasę błędu, przed którą ostrzega docstring na górze tego pliku.

console.log('\nGŁĘBIA (oś z) - tułów obrócony bokiem:');
// Test celowy PONAD brief. skalaCiala() liczy rozstaw barków w pełnym 3D
// (postawa.js, "SKALA BARKÓW") - to jest naprawiony błąd tego zadania, a
// stary wzór sqrt(dx²+dy²) i nowy sqrt(dx²+dy²+dz²) dają IDENTYCZNY wynik,
// gdy każdy landmark ma z=0. Dopóki żadna poza w tym pliku nie ma niezerowej
// głębi, cały plik jest ślepy na oś, którą Task 4 naprawił - dokładnie tak,
// jak było ślepe stare test-postawy.mjs.
//
// Tułów obrócony o 75° wokół osi Y: rozstaw barków w 3D zostaje 0.40 m
// (obrót nie zmienia długości sztywnego odcinka), ale w rzucie na x,y
// kurczy się do ok. 0.10 m - PONIŻEJ podłogi 0.12 z postawa.js. Jeśli ktoś
// usunie dz ze skalaCiala(), skala spadnie do tej podłogi (0.12 zamiast
// 0.40), każda odległość wyrażona w "szerokościach barków" wyjdzie ponad
// 3x za duża, i ziemia PRZESTANIE się składać mimo realnie poprawnej pozy.
const KAT = 75;
const rad = KAT * Math.PI / 180;
const bx = 0.20 * Math.cos(rad), bz = 0.20 * Math.sin(rad);
// Pięści dokładnie na PRZECIWNYCH barkach (jak w ZIEMIA), tylko przesunięte
// 0.15 m w dół wzdłuż y - w pełnym 3D to nadal blisko styku (0.15 szer.
// barków przy poprawnej skali 0.40 m), ale przy błędnej skali floor=0.12 m
// odległość znormalizowana rośnie do 1.25 - w głąb rampy między
// STYK_PELNY (0.941) i STYK_ZERO (1.416), więc wynik zauważalnie spada.
const ZIEMIA_BOKIEM = cialo({
  obrot: KAT,
  nadgL: [bx, -0.55 + 0.15, bz], lokL: [0, -0.30, bz / 2],
  nadgP: [-bx, -0.55 + 0.15, -bz], lokP: [0, -0.30, -bz / 2]
});
const zg = ocen(ZIEMIA_BOKIEM, [piesc('Left'), piesc('Right')]);
spr(`ziemia z realną głębią tułowia nadal się składa (${zg.weles.toFixed(2)})`, zg.weles > 0.85);

resetSkali();
const skalaProsto = skalaCiala(cialo({
  nadgL: [0.20, -0.55], lokL: [-0.10, -0.30], nadgP: [-0.20, -0.55], lokP: [0.10, -0.30]
}));
resetSkali();
const skalaBokiem = skalaCiala(ZIEMIA_BOKIEM);
console.log(`  skala prosto=${skalaProsto.toFixed(3)} m   skala bokiem=${skalaBokiem.toFixed(3)} m`);
spr(`skala barków jest niezmiennikiem obrotu (różnica ${Math.abs(skalaProsto - skalaBokiem).toFixed(3)} m)`,
    Math.abs(skalaProsto - skalaBokiem) < 0.01);
// Osadzona kontrola, że test faktycznie mierzy to, co deklaruje: gdyby ktoś
// przypadkiem wyzerował obrót, sprawdzenie powyżej byłoby puste (0 = 0).
spr(`fixture rzeczywiście ma niezerową głębię (bz=${bz.toFixed(3)})`, Math.abs(bz) > 0.05);

console.log('\nBRAK DANYCH:');
const slabe = ocen(cialo({
  nadgL: [0.20, -0.55], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30], vis: 0.2
}), [piesc('Left'), piesc('Right')]);
spr(`punkty niewidoczne -> 0, nie śmieć (${slabe.weles.toFixed(2)})`, slabe.weles === 0);

const zepsute = ocen(cialo({
  nadgL: [NaN, NaN], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30]
}), [piesc('Left'), piesc('Right')]);
spr(`NaN w punkcie -> 0 (${zepsute.weles})`, zepsute.weles === 0);

// REGUŁA NADRZĘDNA: brak dłoni w kadrze NIE KARZE. Kwalifikator pięści jest
// miękki - ciało prowadzi, dłonie doprecyzowują.
const bezDloni = ocen(ZIEMIA, []);
spr(`brak dłoni nie zeruje ziemi (${bezDloni.weles.toFixed(2)})`, bezDloni.weles > 0.5);

// Dłoń WIDOCZNA, ale rozprostowana, nie może dać GORSZEGO wyniku niż brak
// dłoni w kadrze - inaczej wejście dłoni do kadru byłoby karą (dlon.js
// docstring piesci(), reguła nadrzędna GEMINI.md §2).
const otwarte = ocen(ZIEMIA, [otwartaDlon('Left'), otwartaDlon('Right')]);
spr(`dłonie otwarte, ale w kadrze -> nie gorzej niż brak dłoni (${otwarte.weles.toFixed(2)} >= ${bezDloni.weles.toFixed(2)})`,
    otwarte.weles >= bezDloni.weles - 0.01);

// Kwalifikator pięści musi też DZIAŁAĆ W GÓRĘ, nie tylko nie karać w dół.
// `otwarte`, `bezDloni` i `start pętli` niżej porównują dwie wielkości, obie
// napędzane przez piesci() - stała funkcja (np. "zawsze 1.0" albo "zawsze
// WAGA_BEZ_DLONI") przechodzi WSZYSTKIE te testy trywialnie, bo obie strony
// każdego porównania są tą samą stałą. Ta asercja porównuje ZIEMIĘ z
// zaciśniętymi pięściami wprost z tą samą pozą z dłońmi otwartymi - jedyny
// sposób złapać mutację "piesci() zawsze zwraca 1.0" albo "zawsze zwraca
// WAGA_BEZ_DLONI", której żadna z powyższych asercji nie widzi.
spr(`pięść daje WYRAŹNIE więcej niż dłoń otwarta w tej samej pozie (${z.weles.toFixed(2)} vs ${otwarte.weles.toFixed(2)})`,
    z.weles > otwarte.weles + 0.1);

console.log('\nCIĄGŁOŚĆ przy przykładaniu pięści do barków:');
// POPRAWKA WZGLĘDEM BRIEFU: start d=0.45 dawał znormalizowaną odległość
// 0.45/0.40=1.125 - WEWNĄTRZ rampy (0.941..1.416), czyli już częściowy
// wynik (0.61) na pierwszej klatce pętli. Porównanie do inicjalizacji
// poprz=0 dawało wtedy FAŁSZYWY skok 0.613 - nie skok MIĘDZY klatkami
// animacji, tylko artefakt zestawienia z klatką, która nigdy nie została
// wyrenderowana. d=0.60 daje 0.60/0.40=1.5 > STYK_ZERO, więc pierwsza
// klatka pętli faktycznie zaczyna się od zera - zgodnie z tym, co
// inicjalizacja poprz=0 zakłada.
let poprz = 0, maxSkok = 0;
const poziomy = [];
for (let i = 0; i <= 60; i++) {
  const d = 0.60 - i * 0.01;   // pięści zbliżają się do przeciwnych barków
  const s = ocen(cialo({
    nadgL: [0.20 - d, -0.55], lokL: [-0.10, -0.30],
    nadgP: [-0.20 + d, -0.55], lokP: [0.10, -0.30]
  }), [piesc('Left'), piesc('Right')]).weles;
  maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
  if (i % 12 === 0) poziomy.push(`${d.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
// Próg UJEDNOLICONY z pętlą "zwijania dłoni" niżej (zadanie 8, przegląd
// zadania 7): tam było 0.2, tu 0.15 - dwie różne wartości bez powodu, przy
// ZMIERZONYCH skokach ~0.05 w OBU pętlach. 0.1 to spójny, wspólny próg z
// dwukrotnym zapasem nad zmierzonym maksimum w każdej z nich.
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.1);

console.log('\nCIĄGŁOŚĆ zwijania dłoni w pięść:');
// Interpolacja liniowa między dłonią otwartą a pięścią - żeby palec zwinięty
// w połowie dał połowę wyniku (reguła nadrzędna), a nie skok.
//
// Ciało w tej pętli stoi NIERUCHOMO w pełnym kontakcie (ZIEMIA), więc
// stykL=stykP=1 przez cały czas i wynik = piesci. Podłoga piesci to
// WAGA_BEZ_DLONI (0.7) Z DEFINICJI - dłoń widoczna nigdy nie schodzi
// poniżej tego, co dałby brak dłoni (test wyżej). Inicjalizacja poprzD=0,
// tak jak w pętli powyżej, byłaby więc porównaniem do klatki fizycznie
// nieosiągalnej w tym scenariuszu (żadna dłoń w kadrze nie da tu 0) -
// dlatego poprzD startuje od PIERWSZEJ faktycznie policzonej wartości,
// a pętla mierzy skoki tylko MIĘDZY wyrenderowanymi klatkami.
//
// POPRAWKA (zadanie 8). Naprawienie degeneracji PIP=DIP w otwartaDlon()
// (patrz jej docstring) odsłoniło coś, co ta degeneracja przypadkiem
// maskowała: interpolacja LINIOWA współrzędnych między dłonią otwartą
// a pięścią nie daje liniowej zmiany `zwinieta()` w czasie - `prosto`
// (dlon.js) jest funkcją NIELINIOWĄ położenia stawów, więc przy dawnych
// 20 krokach (Δt=0.05) trafiała się jedna próbka tuż przed stromym
// odcinkiem przejścia i jedna tuż za nim, dając SKOK 0.174 - większy niż
// próg. ZMIERZONE (node -e, wielkość kroku Δt vs największy skok):
// N=20 -> 0.174, N=60 -> 0.059, N=200 -> 0.018. To nie jest próg w
// `zwinieta()` samej - to test próbkujący za rzadko stromy fragment
// gładkiej krzywej, dokładnie ostrzeżenie z briefu o wąskich rampach
// zastosowane tutaj do INNEJ pieczęci. Naprawa: gęstsza siatka (60 kroków,
// ta sama liczba co w pętli "przykładania pięści do barków" wyżej), nie
// rozluźniony próg - próg zostaje 0.1, spójny z pętlą powyżej.
const otw = otwartaDlon().landmarks, pst = piesc().landmarks;
const klatkaD = (t) => otw.map((p, idx) => ({
  x: p.x + (pst[idx].x - p.x) * t,
  y: p.y + (pst[idx].y - p.y) * t,
  z: 0
}));
let poprzD = ocen(ZIEMIA, [{ handedness: 'Left', landmarks: klatkaD(0) }, { handedness: 'Right', landmarks: klatkaD(0) }]).weles;
let maxSkokD = 0;
const poziomyD = [`0.00:${poprzD.toFixed(2)}`];
for (let i = 1; i <= 60; i++) {
  const t = i / 60;
  const lm = klatkaD(t);
  const dlonL = { handedness: 'Left', landmarks: lm };
  const dlonP = { handedness: 'Right', landmarks: lm };
  const s = ocen(ZIEMIA, [dlonL, dlonP]).weles;
  maxSkokD = Math.max(maxSkokD, Math.abs(s - poprzD)); poprzD = s;
  if (i % 12 === 0) poziomyD.push(`${t.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomyD.join('  '));
// Próg UJEDNOLICONY z pętlą "przykładania pięści do barków" wyżej - patrz
// komentarz tam. Ten sam 0.1, ten sam dwukrotny zapas nad zmierzonym ~0.05.
spr(`największy skok przy zwijaniu dłoni = ${maxSkokD.toFixed(3)} (rampa, nie próg)`, maxSkokD < 0.1);
// Kontrola, że dłoń faktycznie startuje na podłodze WAGA_BEZ_DLONI, nie na
// przypadkowej niskiej wartości - inaczej powyższy test niczego by nie
// dowodził o samej podłodze.
spr(`start pętli = podłoga bez dłoni (${poziomyD[0]})`, Math.abs(parseFloat(poziomyD[0].split(':')[1]) - bezDloni.weles) < 0.01);

console.log('\nŚCIEŻKA PRODUKCYJNA (aktualizujSkale + EMA), nie tylko resetSkali+chwilowa:');
// POPRAWKA PO PRZEGLĄDZIE. `ocen()` (helper na górze tego pliku) woła
// resetSkali() PRZED każdą oceną - więc skalaCiala() w środku weles.js
// ZAWSZE spada na skalaChwilowa(), bo `_skalaEma` jest w tym momencie
// zawsze null (postawa.js: `if (_skalaEma !== null) return _skalaEma;`).
// Cały ten plik do tej pory nigdy nie wywołał weles ze stanem, w którym
// `_skalaEma !== null` - a to jest ŚCIEŻKA, którą naprawdę biegnie gra:
// main.js woła aktualizujSkale() RAZ NA KLATKĘ, PRZED znaki.ocen(), nigdy
// resetSkali(). To ta sama kategoria ślepoty co z=0 przed poprawką sekcji
// GŁĘBIA wyżej - tym razem znaleziona w przeglądzie, nie przeze mnie.
//
// UŻYWA `ZIEMIA_POL_RAMPY`, NIE `ZIEMIA`. Pierwsza wersja tego testu
// oceniała pełny styk (`ZIEMIA`, dystans 0) - a przy dystansie DOKŁADNIE
// 0 wynik stykL/stykP wychodzi 1.0 dla KAŻDEJ dodatniej skali (0/skala=0
// niezależnie od wartości skali), więc test nigdy by nie zauważył, gdyby
// gałąź EMA zwracała skalę przemnożoną przez dowolną stałą. Zmierzone
// mutation testingiem (patrz raport): z fixture `ZIEMIA` mutacja
// "skalaCiala() w gałęzi EMA zwraca _skalaEma*0.5" przechodziła ten test
// BEZ CZERWIENI. `ZIEMIA_POL_RAMPY` ma niezerowy dystans, więc skala
// realnie wchodzi do mianownika.
resetSkali();
for (let i = 0; i < 60; i++) aktualizujSkale(ZIEMIA_POL_RAMPY, 1 / 60);
// Ocena BEZ resetSkali() między rozgrzewką a pomiarem - dokładnie sekwencja
// z main.js. `rej` jest tym samym rejestrem, którego używa `ocen()` gdzie
// indziej w pliku (dzieli EMA wygładzonych WYNIKÓW - bez znaczenia tutaj,
// bo czytamy tylko `surowe`/`this.surowe`, kopiowane świeżo z każdego
// wywołania, patrz registry.js).
const zEma = rej.ocen({
  hands: [piesc('Left'), piesc('Right')], pose: { landmarks: [], worldLandmarks: ZIEMIA_POL_RAMPY },
  width: 1920, height: 1080, dt: 1 / 60, now: 0
});
spr(`ziemia (połowa rampy) liczy się poprawnie przez ścieżkę EMA, nie tylko reset+chwilowa (${zEma.weles.toFixed(2)})`,
    zEma.weles > 0.4 && zEma.weles < 0.6);
resetSkali();

// ================== POWIETRZE (Stribog) ==================
//
// PROGI SĄ WYJĄTKOWO WĄSKIE. W metrach przy skali 0.40 m (rozstaw barków
// fixture'a `cialo()`):
//   STYK:      0.770..0.872 znormalizowane = 4.1 cm rozstawu łokci
//   WYSOKOSC: -0.227..-0.116 znormalizowane = 4.4 cm wysokości nadgarstka
// Obie rampy są węższe niż jeden krok dłoni w MediaPipe. To ZMIERZONE na
// żywym ciele (progi-zmierzone.js), nie usterka do naprawienia tutaj - ale
// oznacza, że fixture ustawiony 1mm za blisko sufitu albo zera od razu
// nasyca test, i że pętla ciągłości z za grubym krokiem zmierzy WŁASNY
// krok, nie rampę. Poniższe fixture'y są dobrane tak, żeby świadomie
// trafiać w ŚRODEK którejś z tych dwóch wąskich ramp, nie w ich brzegi.
//
// Druga obserwacja: WYSOKOSC_PELNY (-0.116) i WYSOKOSC_ZERO (-0.227) są OBIE
// wartościami PONIŻEJ linii barków (nadBarkami ujemne = punkt niżej niż
// barki). Cały ten fragment rampy leży TUŻ pod barkami - każdy nadgarstek
// NA WYSOKOŚCI barków lub wyżej już jest przypięty do sufitu 1.0. Docstring
// striboga mówi "przedramiona idą pionowo w górę", ale to, co realnie
// mierzy próg, to "nadgarstki NIE opadły poniżej barków o więcej niż pół
// dłoni" - łagodniejszy warunek niż nazwa sugeruje. Nie dotykam progu
// (zmierzony uczciwie), tylko odnotowuję to w raporcie.
const POWIETRZE = cialo({
  lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
  nadgL: [-0.22, -0.85], nadgP: [0.22, -0.85]
});

console.log('\nPOWIETRZE:');
const pw = ocen(POWIETRZE);
spr(`łokcie razem, ręce w górę zapalają powietrze (${pw.stribog.toFixed(2)})`, pw.stribog > 0.7);

// Ręce po prostu uniesione, łokcie SZEROKO - w tańcu to się dzieje
// co chwilę i NIE MOŻE zapalać pieczęci. To jest warunek styku łokci.
const receWGorze = ocen(cialo({
  lokL: [-0.30, -0.55], lokP: [0.30, -0.55],
  nadgL: [-0.35, -0.90], nadgP: [0.35, -0.90]
}));
spr(`ręce w górze z szerokimi łokciami NIE zapalają powietrza (${receWGorze.stribog.toFixed(2)})`,
    receWGorze.stribog < 0.3);

// Łokcie razem, ale ręce w DÓŁ - to bliżej wody niż powietrza.
const lokcieRazemWDol = ocen(cialo({
  lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
  nadgL: [-0.10, -0.05], nadgP: [0.10, -0.05]
}));
spr(`łokcie razem, ręce w dół NIE zapalają powietrza (${lokcieRazemWDol.stribog.toFixed(2)})`,
    lokcieRazemWDol.stribog < 0.3);

spr(`powietrze NIE zapala ziemi (${pw.weles.toFixed(2)})`, pw.weles < 0.3);
spr(`ziemia NIE zapala powietrza (${z.stribog.toFixed(2)})`, z.stribog < 0.3);

// Jedna ręka w górze, druga opuszczona: łokcie razem (styk pełny), ale
// TYLKO jeden nadgarstek wysoko. `stribog.js` bierze MIN z dwóch nadgarstków
// właśnie po to, żeby ta asymetria NIE zapalała pieczęci - z dokumentacji
// modułu: "jedna ręka w górze to nie jest ta poza". Bez tego fixture'a
// żadna asercja w tym pliku nie odróżnia MIN od MAX: wszystkie pozostałe
// fixture'y trzymają oba nadgarstki na tej samej wysokości, więc mutacja
// Math.min -> Math.max przechodziłaby niezauważona (obie funkcje dają ten
// sam wynik na symetrycznym wejściu).
const jednaReka = ocen(cialo({
  lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
  nadgL: [-0.22, -0.85], nadgP: [0.10, -0.05]
}));
spr(`jedna ręka w górze, druga w dół NIE zapala powietrza - MIN, nie MAX (${jednaReka.stribog.toFixed(2)})`,
    jednaReka.stribog < 0.3);

// Łokieć NISKO PEWNY (visibility poniżej progu, WSPÓŁRZĘDNE NADAL SKOŃCZONE
// i realne): `stribog.PUNKTY` obejmuje LOKIEC_L/LOKIEC_P, inaczej niż
// `weles.PUNKTY`, który ich nie potrzebuje - sekcja BRAK DANYCH wyżej
// testuje tylko ścieżkę weles i nie łapie mutacji usuwającej łokcie z
// `PUNKTY` w stribog.js.
//
// CELOWO NIE NaN. `styk()` ma WŁASNY strażnik na NaN w odległości
// (styk.js: `if (!Number.isFinite(d)) return 0`) - łokieć z NaN dawałby 0
// NIEZALEŻNIE OD TEGO, czy `PUNKTY` w ogóle go wymienia, więc test z NaN
// nie łapałby mutacji "usuń LOKIEC_L/LOKIEC_P z PUNKTY" (ZMIERZONE mutation
// testingiem - patrz raport zadania). Niska `visibility` przy SKOŃCZONYCH
// współrzędnych aktywuje WYŁĄCZNIE gate `widoczne()`, więc realnie sprawdza,
// że łokcie SĄ na liście `PUNKTY`.
const lokiecNiewidoczny = ocen((() => {
  const wl = cialo({
    lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
    nadgL: [-0.22, -0.85], nadgP: [0.22, -0.85]
  });
  wl[13] = { ...wl[13], visibility: 0.1 }; // LOKIEC_L (postawa.js) - poniżej PROG_WIDOCZNOSCI (0.5)
  return wl;
})());
spr(`łokieć niepewny (visibility niska) -> powietrze = 0, nie śmieć (${lokiecNiewidoczny.stribog})`,
    lokiecNiewidoczny.stribog === 0);

console.log('\nLUSTRO (powietrze):');
// POPRAWKA WZGLĘDEM BRIEFU (przegląd zadania 7, ta sama poprawka co przy
// ZIEMIA_POL_RAMPY wyżej). `POWIETRZE` ma OBA składniki NASYCONE (styk
// łokci przy odległości 0.08 m << próg 4.1 cm rampy, wysokość nadgarstka
// daleko powyżej sufitu rampy) - mirror porównywałby 1.00 z 1.00
// niezależnie od tego, co liczy score(). Fixture niżej trzyma STYK ŁOKCI
// w połowie jego (bardzo wąskiej, 4.1 cm) rampy, żeby błąd MAGNITUDY
// (zła skala, zamieniony próg, zły znak w odległości) miał gdzie się
// objawić.
//
// GRANICA TEGO, CO TEN TEST MOŻE UDOWODNIĆ. Inaczej niż w ziemi, `stribog`
// nie ma NAWET formuły potencjalnie czytającej znak x - `odleglosc()` jest
// izometrią lustra z definicji, a `nadBarkami()` czyta WYŁĄCZNIE y. Nie ma
// tu więc żadnej operacji, którą lustro mogłoby złapać, i test niżej
// (`|mirror - original| < 0.02`) nie dowodzi nic ponad to, co już wynika z
// budowy modułu. Wartość testu leży w ASERCJI-PRECONDYCJI (fixture
// faktycznie leży w połowie rampy) - ona jest tym, co łapie błąd skali czy
// zamienionych progów; sama symetria lustra jest tu formalnością.
// Środek rampy STYKU: (0.770+0.872)/2 = 0.821 znormalizowane, czyli
// 0.821*0.40 = 0.3284 m pełnego rozstawu łokci (ZMIERZONE styk()=0.50,
// patrz asercja-precondycja niżej).
const POWIETRZE_POL_RAMPY_STYK = cialo({
  lokL: [-0.1642, -0.30], lokP: [0.1642, -0.30],
  nadgL: [-0.22, -0.85], nadgP: [0.22, -0.85]
});
const polRampyStyk = ocen(POWIETRZE_POL_RAMPY_STYK);
spr(`fixture lustra (styk łokci) faktycznie leży w połowie rampy (${polRampyStyk.stribog.toFixed(2)}, oczekiwane 0.4-0.6)`,
    polRampyStyk.stribog > 0.4 && polRampyStyk.stribog < 0.6);
const polRampyStykL = ocen(odbij(POWIETRZE_POL_RAMPY_STYK));
spr(`odbite powietrze (połowa rampy styku) = to samo (${polRampyStykL.stribog.toFixed(2)})`,
    Math.abs(polRampyStykL.stribog - polRampyStyk.stribog) < 0.02);

// DRUGI składnik, WYSOKOSC, musi też zostać sprawdzony w połowie SWOJEJ
// (osobnej, też wąskiej) rampy - inaczej mutacja binaryzująca `wysokosc`
// (np. "> -0.17 ? 1 : 0") przechodzi cały ten plik niezauważona: każdy
// fixture powyżej trzyma wysokość albo na suficie (nadgarstki wysoko), albo
// na zerze (nadgarstki nisko), nigdy w środku. Łokcie razem (styk pełny,
// nie wąskie gardło tego testu), nadgarstek na wysokości środka rampy:
// v = (-0.227 + -0.116) / 2 = -0.1715 -> y = -0.55 - (-0.1715 * 0.40)
// = -0.4814 (ZMIERZONE nadBarkami()=-0.1715, styk()=0.50 - patrz
// asercja-precondycja).
const POWIETRZE_POL_RAMPY_WYSOKOSC = cialo({
  lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
  nadgL: [-0.10, -0.4814], nadgP: [0.10, -0.4814]
});
const polRampyWys = ocen(POWIETRZE_POL_RAMPY_WYSOKOSC);
spr(`fixture lustra (wysokość nadgarstków) faktycznie leży w połowie rampy (${polRampyWys.stribog.toFixed(2)}, oczekiwane 0.4-0.6)`,
    polRampyWys.stribog > 0.4 && polRampyWys.stribog < 0.6);
const polRampyWysL = ocen(odbij(POWIETRZE_POL_RAMPY_WYSOKOSC));
spr(`odbite powietrze (połowa rampy wysokości) = to samo (${polRampyWysL.stribog.toFixed(2)})`,
    Math.abs(polRampyWysL.stribog - polRampyWys.stribog) < 0.02);

console.log('\nGŁĘBIA (oś z) - łokcie powietrza z tułowiem obróconym bokiem:');
// Ten sam cel co sekcja GŁĘBIA w ZIEMI wyżej, tym razem dla stribog:
// obrót tułowia o 75° wokół Y przenosi część rozstawu barków (i, tu, część
// odległości między łokciami) na oś z. `cialo({obrot})` obraca TYLKO barki
// automatycznie - łokcie/nadgarstki dostają obrócone współrzędne RĘCZNIE,
// tym samym przekształceniem (x,y,0) -> (x·cosθ, y, x·sinθ), które jest
// IZOMETRIĄ: odległość łokieć-łokieć w pełnym 3D zostaje identyczna jak bez
// obrotu (0.16 m), więc `odleglosc()` (zawsze pełne 3D) liczy poprawnie
// niezależnie od tego, czy skala jest poprawna. Jedyna rzecz wrażliwa na
// usunięcie dz jest MIANOWNIK, `skalaCiala()`.
//
// Rozstaw łokci dobrany SZEROKO (0.16 m, znormalizowane 0.40 przy
// poprawnej skali 0.40 m - daleko w głębi "pełnego styku", styk=1) tak,
// żeby przy BŁĘDNEJ skali (dz usunięte -> rzut barków na x,y = 0.40·cos75°
// = 0.104 m, PONIŻEJ podłogi 0.12, więc skala spada do podłogi 0.12)
// znormalizowana odległość wyszła 0.16/0.12 = 1.333 - POWYŻEJ STYK_ZERO
// (0.872), czyli styk=0. Poprawna skala daje styk=1, błędna styk=0 - próg
// tego testu (>0.85) łapie różnicę z dużym zapasem, nie balansuje na
// granicy.
const KAT_PW = 75;
const radPw = KAT_PW * Math.PI / 180;
const cosPw = Math.cos(radPw), sinPw = Math.sin(radPw);
const lokLzRot = -0.08 * sinPw, lokPzRot = 0.08 * sinPw;
const POWIETRZE_BOKIEM = cialo({
  obrot: KAT_PW,
  lokL: [-0.08 * cosPw, -0.30, lokLzRot], lokP: [0.08 * cosPw, -0.30, lokPzRot],
  nadgL: [-0.22 * cosPw, -0.85, -0.22 * sinPw], nadgP: [0.22 * cosPw, -0.85, 0.22 * sinPw]
});
const pwBokiem = ocen(POWIETRZE_BOKIEM);
spr(`powietrze z realną głębią tułowia nadal się składa (${pwBokiem.stribog.toFixed(2)})`, pwBokiem.stribog > 0.85);
// Osadzona kontrola jak w sekcji GŁĘBIA ziemi: gdyby ktoś przypadkiem
// wyzerował obrót, powyższe sprawdzenie niczego by nie dowodziło.
spr(`fixture łokci rzeczywiście ma niezerową głębię (bz=${lokLzRot.toFixed(3)})`, Math.abs(lokLzRot) > 0.05);

console.log('\nCIĄGŁOŚĆ przy schodzeniu łokci do siebie:');
// POPRAWKA WZGLĘDEM BRIEFU (ta sama klasa błędu, co przy "przykładaniu
// pięści do barków" wyżej). Start briefu, d=0.30 (offset każdego łokcia od
// środka -> pełny rozstaw 0.60... W ZAPISIE BRIEFU d BYŁ PEŁNYM ROZSTAWEM
// jednego łokcia od środka x=0, czyli pełna odległość łokieć-łokieć = 2d =
// 0.60 m, znormalizowane 1.5). TO BYŁOBY nad progiem - ale sam brief użył
// d=0.30 jako WSPÓŁRZĘDNEJ łokcia (lokL:[-d,...]), więc pełny rozstaw przy
// i=0 wynosił 2*0.30=0.60 m -> 1.50 znormalizowane, faktycznie bezpiecznie
// nad ZERO (0.872), OK. Prawdziwy problem brief miał w KROKU: 0.005 m na
// klatkę na WSPÓŁRZĘDNEJ (czyli 0.01 m na pełnym rozstawie) w rampie
// szerokiej tylko 4.1 cm - to ok. 4 klatki na całą rampę, skok jak w
// pierwotnej (niepoprawionej) pętli "zwijania dłoni" wyżej. Krok
// ZMNIEJSZONY do 0.001 m/klatkę na współrzędnej (0.002 m na pełnym
// rozstawie) - to fizycznie oznacza łokcie zbliżające się z prędkością
// 0.002 m / (1/60 s) = 0.12 m/s, WOLNIEJ niż realne machnięcie ręką w
// tańcu; test dowodzi, że PRZY TYM tempie próbkowania rampa jest gładka,
// nie że jest gładka przy KAŻDYM możliwym tempie zbliżania łokci - to samo
// zastrzeżenie dotyczy zresztą pętli "zwijania dłoni" wyżej (patrz jej
// komentarz o N vs skok).
let poprzPw = 0, maxSkokPw = 0;
const poziomyPw = [];
const D0_PW = 0.20, KROK_PW = 0.001;
for (let i = 0; i <= 60; i++) {
  const d = D0_PW - i * KROK_PW;
  const s = ocen(cialo({
    lokL: [-d, -0.30], lokP: [d, -0.30],
    nadgL: [-0.22, -0.85], nadgP: [0.22, -0.85]
  })).stribog;
  maxSkokPw = Math.max(maxSkokPw, Math.abs(s - poprzPw)); poprzPw = s;
  if (i % 12 === 0) poziomyPw.push(`${(2 * d).toFixed(3)}:${s.toFixed(3)}`);
}
console.log('  ' + poziomyPw.join('  '));
// Ten sam ujednolicony próg 0.1 co obie pętle ciągłości ziemi wyżej.
spr(`największy skok powietrza = ${maxSkokPw.toFixed(3)} (rampa, nie próg)`, maxSkokPw < 0.1);

// ================== WODA (Mokosz) ==================
//
// PROGI.woda ma TRZY grupy progów: GLEBOKOSC, MISKA, KIERUNEKPALCOW. Woda
// jest jedyną z pięciu pieczęci, w której żaden z trzech warunków osobno nie
// rozdziela pozy od tańca - dopiero ich KONIUNKCJA (minimum). Szczegółowa
// argumentacja jest w js/znaki/mokosz.js; tu tylko to, co dotyczy fixture'ów:
//
//   - `glebokosc` i `kierunekPalcow` czytają WYŁĄCZNIE oś y (nadBarkami,
//     surowy kierunekDloni().y) - żadna z nich nie ma operacji czułej na
//     znak x.
//   - `miska` czyta odleglosc() między parami tej SAMEJ roli (łokieć-łokieć,
//     nadgarstek-nadgarstek) - odległość jest izometrią lustra z definicji,
//     a zamiana L<->P w parze tej samej roli daje identyczną liczbę
//     (dist(A,B)=dist(B,A)), więc nie ma tu nawet klasy błędu "złe
//     sparowanie stron", jaką łapie lustro w ziemi.
//
// Konsekwencja dla testów LUSTRA niżej: żadna z trzech formuł wody nie ma
// ŻADNEJ operacji czułej na znak x - test lustra dowodzi więc tylko tyle,
// że żadna z nich nie czyta znaku x wprost (np. Math.sign różnicy). Resztę
// gwarantuje sama budowa modułu, nie test - ta sama granica co przy
// powietrzu wyżej, tu dotyczy WSZYSTKICH TRZECH warunków naraz, nie jednego.
//
// STYK (odległość samych nadgarstków, osobny próg) USUNIĘTY z generatora
// (tools/progi.mjs) po pomiarze na żywym ciele: w tańcu nadgarstki bywają
// BLIŻEJ siebie niż w samej misce, więc mierzył odwrotność zamierzonego
// kierunku - ta sama klasa błędu co wysokość w ziemi i rozchylenie
// w powietrzu. Rozstaw nadgarstków ZOSTAJE w formule jako część RÓŻNICY
// warunku MISKA, tylko bez własnego, osobnego progu.

/**
 * Dłoń pozioma, palce w stronę kamery (dodatni SUROWY kierunekDloni().y,
 * dlon.js) - jedyna orientacja, jaką woda uznaje za swoją. To otwartaDlon()
 * ODBITA wzdłuż osi Y względem nadgarstka: ten sam wachlarz palców, tylko
 * obrócony tak, żeby wektor nadgarstek->nasada środkowego palca mierzył
 * w DÓŁ obrazu zamiast w górę (otwartaDlon ma go w górę - piesc() dla wody
 * jest niepotrzebna, bo kierunekPalcow nie patrzy na zwinięcie palców,
 * tylko na kierunek dłoni jako całości).
 */
function dlonWody(reka = 'Left') {
  const otw = otwartaDlon(reka).landmarks;
  const wrist = otw[0];
  const lm = otw.map(p => ({ x: p.x, y: wrist.y - (p.y - wrist.y), z: p.z }));
  return { handedness: reka, landmarks: lm };
}

/**
 * Dłoń z WYMUSZONYM składnikiem y wektora kierunekDloni() - do testowania
 * rampy KIERUNEKPALCOW w dowolnym punkcie, nie tylko na suficie/podłodze.
 * `kierunekDloni` czyta WYŁĄCZNIE nadgarstek (0) i nasadę środkowego palca
 * (9) - reszta punktów zostaje z otwartaDlon() (ważna tylko dla pelnaDlon(),
 * która wymaga wszystkich 21 punktów skończonych).
 */
function dlonKierunek(reka, y) {
  const lm = otwartaDlon(reka).landmarks.map(p => ({ ...p }));
  const x = Math.sqrt(Math.max(0, 1 - y * y));
  lm[0] = { x: 0.50, y: 0.50, z: 0 };
  lm[9] = { x: 0.50 + 0.20 * x, y: 0.50 + 0.20 * y, z: 0 };
  return { handedness: reka, landmarks: lm };
}

/** Odbicie lustrzane dłoni - ta sama operacja jak odbij() dla pozy wyżej. */
const odbijDlon = (d) => ({
  handedness: d.handedness === 'Left' ? 'Right' : d.handedness === 'Right' ? 'Left' : d.handedness,
  landmarks: d.landmarks.map(p => ({ ...p, x: -p.x }))
});

// WODA: miska nisko przy pępku - nadgarstki blisko siebie, łokcie szerzej,
// dłonie poziome (palce w stronę kamery).
//
// POPRAWKA WZGLĘDEM BRIEFU. Brief trzymał nadgarstki niemal stykające się
// (rozstaw 0.08 m, ±0.04) - przy tym rozstawie odległość NADG_L do
// PRZECIWNEGO barku (ta, którą weles.js czyta jako skrzyżowanie rąk ziemi)
// wychodzi 0.4924 m / skala 0.40 m = 1.231 znormalizowane - WEWNĄTRZ rampy
// styku ziemi (0.941..1.416), więc `weles` dostawał częściowy kredyt (0.39,
// ZMIERZONE node -e) z tej samej pozy, którą test miał pokazać jako
// WYŁĄCZNIE wodę - dokładnie awaria kolizji, przed którą ostrzega docstring
// mokosz.js. Rozstaw PODNIESIONY do 0.24 m (±0.12): nadal wyraźnie mniejszy
// niż rozstaw łokci (0.52 m, MISKA zostaje w pełni nasycona), ale odsuwa
// nadgarstek od przeciwnego barku na tyle, że styk ziemi spada do 0.16 -
// bezpiecznie pod progiem kolizji tego testu (< 0.3).
const WODA = cialo({
  nadgL: [-0.12, -0.12], nadgP: [0.12, -0.12],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
});
const RECE_WODY = [dlonWody('Left'), dlonWody('Right')];

console.log('\nWODA:');
const wd = ocen(WODA, RECE_WODY);
// Próg PODNIESIONY z briefu (>0.7) na >0.9, ten sam zabieg co w ziemi
// (task 8, przegląd zadania 7): 0.7 pokrywa się liczbowo z WAGA_BEZ_DLONI,
// więc mutant "kierunekPalcow() zawsze zwraca WAGA_BEZ_DLONI" (dłonie
// całkowicie zignorowane) przechodziłby wyłącznie zbiegiem okoliczności na
// granicy. Realny wynik to 1.00.
spr(`miska nisko zapala wodę (${wd.mokosz.toFixed(2)})`, wd.mokosz > 0.9);

// Ta sama miska PODNIESIONA pod brodę - za płytko, to już nie woda.
const miskaWysoko = ocen(cialo({
  nadgL: [-0.12, -0.80], nadgP: [0.12, -0.80],
  lokL: [-0.26, -0.60], lokP: [0.26, -0.60]
}));
spr(`miska pod brodą NIE zapala wody (${miskaWysoko.mokosz.toFixed(2)})`, miskaWysoko.mokosz < 0.3);

// Ręce nisko, ale ROZSTAWIONE (nadgarstki szerzej niż łokcie) - to nie miska.
const receNisko = ocen(cialo({
  nadgL: [-0.30, -0.12], nadgP: [0.30, -0.12],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
}));
spr(`ręce nisko rozstawione NIE zapalają wody (${receNisko.mokosz.toFixed(2)})`, receNisko.mokosz < 0.3);

console.log('\nOGIEŃ vs WODA - para z sekwencji Tęczy:');
// Ogień czyta DŁONIE i w ogóle nie mierzy wysokości; woda czyta POZĘ (plus
// kierunek dłoni) i wymaga nadgarstków nisko. Kolizja rozpada się na osi,
// której ogień nie dotyka - i dlatego przejście ogień->woda w Tęczy nie miga.
spr(`woda NIE zapala powietrza (${wd.stribog.toFixed(2)})`, wd.stribog < 0.3);
spr(`woda NIE zapala ziemi (${wd.weles.toFixed(2)})`, wd.weles < 0.3);
spr(`powietrze NIE zapala wody (${pw.mokosz.toFixed(2)})`, pw.mokosz < 0.3);
spr(`ziemia NIE zapala wody (${z.mokosz.toFixed(2)})`, z.mokosz < 0.3);

console.log('\nBRAK DANYCH i KIERUNEK DŁONI:');
// REGUŁA NADRZĘDNA: brak dłoni w kadrze NIE KARZE.
const wodaBezDloni = ocen(WODA, []);
spr(`brak dłoni nie zeruje wody (${wodaBezDloni.mokosz.toFixed(2)})`, wodaBezDloni.mokosz > 0.5);
spr(`podłoga bez dłoni = WAGA_BEZ_DLONI (${wodaBezDloni.mokosz.toFixed(2)})`,
    Math.abs(wodaBezDloni.mokosz - 0.7) < 0.01);

// ODSTĘPSTWO OD WZORCA piesci() z weles.js - CELOWE, udokumentowane też
// w mokosz.js. Tam dłoń widoczna nigdy nie schodzi PONIŻEJ podłogi braku
// dłoni, bo zwinięcie pięści jest premią BEZ WŁASNEGO progu w PROGI.
// `kierunekPalcow` to inna sytuacja: ma WŁASNY, zmierzony próg
// (KIERUNEKPALCOW_ZERO/PELNY) i jest jednym z warunków, które KONIUNKCJA
// potrzebuje, żeby odróżnić wodę od tańca (patrz w progi.mjs komentarz
// o MISKA_ZERO liczonym z "tańca warunkowego: spełnia glebokosc
// i kierunekPalcow"). Floor-blendowanie tej miary jak w weles.js
// zniweczyłoby jej rolę dyskryminatora: dłoń widoczna, ale skierowana
// PIONOWO (nie w stronę kamery) MUSI móc obniżyć wynik PONIŻEJ podłogi
// braku dłoni - inaczej taniec z rękami nisko i szeroko rozstawionymi
// łokciami, ale dłońmi pionowymi, i tak zapalałby wodę do poziomu podłogi.
const zlyKierunek = ocen(WODA, [otwartaDlon('Left'), otwartaDlon('Right')]);
spr(`dłonie widoczne, ale PIONOWE - GORZEJ niż brak dłoni, celowo (${zlyKierunek.mokosz.toFixed(2)} < ${wodaBezDloni.mokosz.toFixed(2)})`,
    zlyKierunek.mokosz < wodaBezDloni.mokosz - 0.1);

console.log('\nMIN, NIE MAX / FILTR DŁONI / WIDOCZNOŚĆ:');
// Cztery fixture'y niżej łapią mutacje, których żadna asercja wyżej nie
// widzi (ZMIERZONE mutation testingiem - patrz raport zadania): wszystkie
// dotychczasowe fixture'y trzymają obie ręce/dłonie SYMETRYCZNIE, więc
// Math.min<->Math.max w dowolnym z trzech warunków przechodziłby niezauważony.

// Jedna ręka głęboko (jak w WODA), druga ledwo pod barkami (y=-0.50, blisko
// linii barków -0.55) - to NIE jest jeszcze miska. `glebokosc` bierze
// Math.max z nadBarkami() obu nadgarstków (najwyższy = najpłytszy rządzi) -
// mutacja na Math.min dawałaby tu 0.23 zamiast 0 (ZMIERZONE), bo brałaby
// głębszą, "lepszą" rękę zamiast płytszej.
const jednaRekaPlytko = ocen(cialo({
  nadgL: [-0.12, -0.12], nadgP: [0.12, -0.50],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
}), RECE_WODY);
spr(`jedna ręka głęboko, druga płytko NIE zapala wody - MAX niższej ręki, nie MIN (${jednaRekaPlytko.mokosz.toFixed(2)})`,
    jednaRekaPlytko.mokosz < 0.1);

// Jedna dłoń pozioma (dobra), druga pionowa (zła) - `kierunekPalcow` bierze
// Math.min po dłoniach, więc gorsza dłoń rządzi. Mutacja na Math.max dawałaby
// tu 1.00 zamiast 0.00 (ZMIERZONE) - obie ręce w WODA (poza) zostają
// nasycone, więc to WYŁĄCZNIE ta asercja odróżnia MIN od MAX w tym warunku.
const jednaDlonZla = ocen(WODA, [dlonWody('Left'), otwartaDlon('Right')]);
spr(`jedna dłoń pozioma, druga pionowa NIE zapala wody - MIN gorszej dłoni, nie MAX (${jednaDlonZla.mokosz.toFixed(2)})`,
    jednaDlonZla.mokosz < 0.3);

// Jedna dłoń DOBRA, druga ZEPSUTA (NaN w jednym landmarku - nie przechodzi
// pelnaDlon()) - filtr `pelnaDlon` musi odsiać zepsutą dłoń, zanim
// kierunekDloni() dostanie do niej dostęp, inaczej NaN zatruwa Math.min()
// całego warunku mimo że DRUGA dłoń jest w pełni poprawna. Bez filtra wynik
// spada do 0.00 (ZMIERZONE) - dokładnie objaw, przed którym ostrzega reguła
// nadrzędna (jedna zepsuta dłoń w kadrze nie może zgasić poprawnej drugiej).
const zepsutaDlon = dlonWody('Left');
zepsutaDlon.landmarks = zepsutaDlon.landmarks.map((p, i) => i === 9 ? { x: NaN, y: NaN, z: 0 } : p);
const mixHands = ocen(WODA, [zepsutaDlon, dlonWody('Right')]);
spr(`dłoń zepsuta (NaN) obok poprawnej nie zatruwa wyniku - filtr pelnaDlon (${mixHands.mokosz.toFixed(2)})`,
    mixHands.mokosz > 0.7);

// Łokieć NISKO PEWNY (visibility poniżej progu, współrzędne skończone) - ten
// sam wzorzec co w powietrzu wyżej. `mokosz.PUNKTY` obejmuje LOKIEC_L/P,
// inaczej niż weles.PUNKTY - bez tej asercji mutacja usuwająca łokcie
// z PUNKTY przechodzi niezauważona (ZMIERZONE: mokosz=1.00 zamiast 0.00).
const lokNiewidoczny = ocen((() => {
  const wl = cialo({
    nadgL: [-0.12, -0.12], nadgP: [0.12, -0.12],
    lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
  });
  wl[13] = { ...wl[13], visibility: 0.1 }; // LOKIEC_L, poniżej PROG_WIDOCZNOSCI (0.5)
  return wl;
})(), RECE_WODY);
spr(`łokieć niepewny (visibility niska) -> woda = 0, nie śmieć (${lokNiewidoczny.mokosz})`,
    lokNiewidoczny.mokosz === 0);

console.log('\nLUSTRO:');
const wdL = ocen(odbij(WODA), RECE_WODY.map(odbijDlon));
spr(`odbita woda = ta sama (${wdL.mokosz.toFixed(2)})`, Math.abs(wdL.mokosz - wd.mokosz) < 0.02);

// POPRAWKA PO PRZEGLĄDZIE ZADAŃ 7-8. `WODA` ma WSZYSTKIE TRZY składniki
// NASYCONE - mirror porównywałby 1.00 z 1.00 niezależnie od formuły. Woda ma
// TRZY warunki (nie dwa jak powietrze), więc potrzeba TRZECH fixture'ów,
// każdy w połowie SWOJEJ rampy, z pozostałymi dwoma bezpiecznie w suficie -
// inaczej minimum() mogłoby wybrać niewłaściwy składnik i zamaskować błąd
// w tym, który akurat testujemy. Zobacz komentarz o granicy tego, co lustro
// dowodzi, w sekcji WODA wyżej - dotyczy wszystkich trzech fixture'ów niżej.
const GLEB_MID = (PROGI.woda.GLEBOKOSC_ZERO + PROGI.woda.GLEBOKOSC_PELNY) / 2;
const NADG_Y_GLEB_MID = -0.55 + GLEB_MID * 0.40; // v = (yBarkow - y)/skala
const GLEB_POL_RAMPY = cialo({
  nadgL: [-0.12, NADG_Y_GLEB_MID], nadgP: [0.12, NADG_Y_GLEB_MID],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
});
const polRampyGleb = ocen(GLEB_POL_RAMPY, RECE_WODY);
spr(`fixture lustra (głębokość) faktycznie leży w połowie rampy (${polRampyGleb.mokosz.toFixed(2)}, oczekiwane 0.4-0.6)`,
    polRampyGleb.mokosz > 0.4 && polRampyGleb.mokosz < 0.6);
const polRampyGlebL = ocen(odbij(GLEB_POL_RAMPY), RECE_WODY.map(odbijDlon));
spr(`odbita woda (połowa rampy głębokości) = ta sama (${polRampyGlebL.mokosz.toFixed(2)})`,
    Math.abs(polRampyGlebL.mokosz - polRampyGleb.mokosz) < 0.02);

const MISK_MID = (PROGI.woda.MISKA_ZERO + PROGI.woda.MISKA_PELNY) / 2;
const WRIST_DIST = 0.24; // ten sam rozstaw nadgarstków co w WODA (±0.12)
const ELBOW_DIST_MID = WRIST_DIST + MISK_MID * 0.40; // (lok-nadg)/skala = MISK_MID
const MISK_POL_RAMPY = cialo({
  nadgL: [-0.12, -0.12], nadgP: [0.12, -0.12],
  lokL: [-ELBOW_DIST_MID / 2, -0.25], lokP: [ELBOW_DIST_MID / 2, -0.25]
});
const polRampyMisk = ocen(MISK_POL_RAMPY, RECE_WODY);
spr(`fixture lustra (miska) faktycznie leży w połowie rampy (${polRampyMisk.mokosz.toFixed(2)}, oczekiwane 0.4-0.6)`,
    polRampyMisk.mokosz > 0.4 && polRampyMisk.mokosz < 0.6);
const polRampyMiskL = ocen(odbij(MISK_POL_RAMPY), RECE_WODY.map(odbijDlon));
spr(`odbita woda (połowa rampy miski) = ta sama (${polRampyMiskL.mokosz.toFixed(2)})`,
    Math.abs(polRampyMiskL.mokosz - polRampyMisk.mokosz) < 0.02);

const KIER_MID = (PROGI.woda.KIERUNEKPALCOW_ZERO + PROGI.woda.KIERUNEKPALCOW_PELNY) / 2;
const RECE_POL_RAMPY = [dlonKierunek('Left', KIER_MID), dlonKierunek('Right', KIER_MID)];
// Asercja-precondycja na SUROWEJ wartości kierunekDloni(), nie tylko na
// wyniku score() - dowodzi, że fixture trafia dokładnie środek rampy, zanim
// rampa() i minimum() zdążą go przyciąć albo zamaskować.
spr(`fixture kierunku dłoni ma surowy y w połowie rampy (${kierunekDloni(RECE_POL_RAMPY[0].landmarks).y.toFixed(3)} ≈ ${KIER_MID.toFixed(3)})`,
    Math.abs(kierunekDloni(RECE_POL_RAMPY[0].landmarks).y - KIER_MID) < 1e-6);
const polRampyKier = ocen(WODA, RECE_POL_RAMPY);
spr(`fixture lustra (kierunek palców) faktycznie leży w połowie rampy (${polRampyKier.mokosz.toFixed(2)}, oczekiwane 0.4-0.6)`,
    polRampyKier.mokosz > 0.4 && polRampyKier.mokosz < 0.6);
const polRampyKierL = ocen(odbij(WODA), RECE_POL_RAMPY.map(odbijDlon));
spr(`odbita woda (połowa rampy kierunku palców) = ta sama (${polRampyKierL.mokosz.toFixed(2)})`,
    Math.abs(polRampyKierL.mokosz - polRampyKier.mokosz) < 0.02);

console.log('\nGŁĘBIA (oś z) - miska z tułowiem obróconym bokiem:');
// Ten sam cel co sekcje GŁĘBIA w ziemi i powietrzu wyżej, ale w PRZECIWNYM
// kierunku. `glebokosc` i `miska` są ROSNĄCE (progi.mjs: ROSNACE) - gdy ktoś
// usunie dz z skalaCiala(), skala ZAPADA SIĘ do podłogi 0.12 (jak tam), ale
// tu każda odległość podzielona przez MNIEJSZĄ skalę wychodzi WIĘKSZA: błąd
// nie ZANIŻA wyniku (jak w ziemi/powietrzu), tylko go ZAWYŻA. Bez tej sekcji
// woda zapalałaby się ŁATWIEJ niż powinna przy każdym obrocie tułowia -
// odwrotny objaw niż ten, przed którym ostrzega postawa.js.
//
// Dlatego fixture NIE MOŻE być nasycony jak ZIEMIA_BOKIEM/POWIETRZE_BOKIEM -
// zawyżenie nie miałoby dokąd urosnąć, skoro już siedzi na suficie 1.0.
// Ponownie użyte są GLEB_POL_RAMPY / MISK_POL_RAMPY z sekcji LUSTRA (już
// w połowie swojej rampy z definicji), z dodanym obrotem tułowia.
//
// `GLEB_POL_RAMPY_BOKIEM` obraca WYŁĄCZNIE barki (`cialo({obrot})` robi to
// automatycznie) - nadgarstek zostaje tam, gdzie fixture go postawił.
// Wystarcza to w zupełności: `nadBarkami()` czyta WYŁĄCZNIE y (styk.js),
// więc obrót WŁASNEJ pozycji nadgarstka nigdy nie mógłby ujawnić błędu w dz -
// jedyną rzeczą, przez którą dz w ogóle wchodzi do formuły głębokości, jest
// MIANOWNIK, skalaCiala(barki). Obracanie nadgarstka nie dodałoby tu żadnej
// nowej ścieżki do przetestowania.
//
// `MISK_POL_RAMPY_BOKIEM` jest INNA: `miska` czyta odleglosc(łokieć,łokieć)
// i odleglosc(nadgarstek,nadgarstek), a odleglosc() SAMA liczy pełne 3D
// (styk.js: `Math.hypot(dx,dy,dz)`) - ma więc WŁASNE dz, niezależne od
// skalaCiala(). Obrócenie samych barków (jak w GŁĘBOKOŚCI) zostawiłoby tę
// drugą ścieżkę nieprzetestowaną - błąd w dz WEWNĄTRZ odleglosc() przeszedłby
// niezauważony, mimo że dz w MIANOWNIKU byłby pokryty. Dlatego łokcie
// i nadgarstki tego fixture'a dostają WŁASNY obrót, tym samym przekształceniem
// (x,y,0) -> (x·cosθ, y, x·sinθ) co barki - IZOMETRIA, więc obie prawdziwe
// odległości (łokieć-łokieć, nadgarstek-nadgarstek) zostają identyczne jak
// bez obrotu, niezależnie od tego, czy skala jest poprawna.
const KAT_WD = 75;
const RAD_WD = KAT_WD * Math.PI / 180;
const COS_WD = Math.cos(RAD_WD), SIN_WD = Math.sin(RAD_WD);

const GLEB_POL_RAMPY_BOKIEM = cialo({
  obrot: KAT_WD,
  nadgL: [-0.12, NADG_Y_GLEB_MID], nadgP: [0.12, NADG_Y_GLEB_MID],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
});
const glebBokiem = ocen(GLEB_POL_RAMPY_BOKIEM, RECE_WODY);
// ZMIERZONE (node -e, mutacja "dz usunięte z skalaCiala"): skala poprawna
// 0.400 m, skala bez dz spada do podłogi 0.120 m. glebokosc wtedy skacze
// z 0.50 na 1.00 (nasyca się), a mokosz razem z nim - wyraźnie SPOZA pasma
// 0.4-0.6, więc próg tego testu łapie błąd bez balansowania na granicy.
spr(`woda (głębokość) z realną głębią tułowia zostaje w połowie rampy, nie skacze przy błędnej skali (${glebBokiem.mokosz.toFixed(2)}, oczekiwane 0.4-0.6)`,
    glebBokiem.mokosz > 0.4 && glebBokiem.mokosz < 0.6);

const MISK_POL_RAMPY_BOKIEM = cialo({
  obrot: KAT_WD,
  nadgL: [-0.12 * COS_WD, -0.12, -0.12 * SIN_WD], nadgP: [0.12 * COS_WD, -0.12, 0.12 * SIN_WD],
  lokL: [-(ELBOW_DIST_MID / 2) * COS_WD, -0.25, -(ELBOW_DIST_MID / 2) * SIN_WD],
  lokP: [(ELBOW_DIST_MID / 2) * COS_WD, -0.25, (ELBOW_DIST_MID / 2) * SIN_WD]
});
const miskBokiem = ocen(MISK_POL_RAMPY_BOKIEM, RECE_WODY);
// ZMIERZONE (node -e, mutacja "dz usunięte z odleglosc() w styk.js" - NIE
// skalaCiala): wynik poprawny 0.50 spada do 0.066 - łokcie zbliżają się do
// siebie w rzucie x,y bez dz, więc `miska` (różnica dwóch odległości) traci
// swój dodatni margines. Ta mutacja jest NIEWIDOCZNA dla fixture'a głębokości
// wyżej (który obraca tylko barki) - stąd osobny, w pełni obrócony fixture.
spr(`woda (miska) z realną głębią tułowia zostaje w połowie rampy, nie skacze przy błędnej skali ani błędnej odleglosc() (${miskBokiem.mokosz.toFixed(2)}, oczekiwane 0.4-0.6)`,
    miskBokiem.mokosz > 0.4 && miskBokiem.mokosz < 0.6);

resetSkali();
const skalaProstoWd = skalaCiala(WODA);
resetSkali();
const skalaBokiemWd = skalaCiala(GLEB_POL_RAMPY_BOKIEM);
console.log(`  skala prosto=${skalaProstoWd.toFixed(3)} m   skala bokiem=${skalaBokiemWd.toFixed(3)} m`);
spr(`skala barków jest niezmiennikiem obrotu (różnica ${Math.abs(skalaProstoWd - skalaBokiemWd).toFixed(3)} m)`,
    Math.abs(skalaProstoWd - skalaBokiemWd) < 0.01);
const bzWd = 0.20 * Math.sin(RAD_WD);
spr(`fixture rzeczywiście ma niezerową głębię (bz=${bzWd.toFixed(3)})`, Math.abs(bzWd) > 0.05);
resetSkali();

console.log('\nŚCIEŻKA PRODUKCYJNA (aktualizujSkale + EMA), nie tylko resetSkali+chwilowa:');
// Ten sam cel i ta sama luka co w sekcji ZIEMIA wyżej (POPRAWKA PO
// PRZEGLĄDZIE, ~linia 375): `ocen()` woła resetSkali() PRZED każdą oceną,
// więc skalaCiala() w mokosz.js zawsze spada na skalaChwilowa() w TYM pliku -
// nigdy na ścieżkę main.js (aktualizujSkale() raz na klatkę, bez resetu).
// UŻYWA `MISK_POL_RAMPY`, NIE nasyconej `WODA`: przy nasyceniu skala
// pomnożona przez dowolną stałą i tak dałaby wynik przycięty do 1.0 -
// mutacja w gałęzi EMA (np. `_skalaEma * 0.5`) przeszłaby niezauważona.
resetSkali();
for (let i = 0; i < 60; i++) aktualizujSkale(MISK_POL_RAMPY, 1 / 60);
const wdEma = rej.ocen({
  hands: RECE_WODY, pose: { landmarks: [], worldLandmarks: MISK_POL_RAMPY },
  width: 1920, height: 1080, dt: 1 / 60, now: 0
});
spr(`woda (połowa rampy miski) liczy się poprawnie przez ścieżkę EMA, nie tylko reset+chwilowa (${wdEma.mokosz.toFixed(2)})`,
    wdEma.mokosz > 0.4 && wdEma.mokosz < 0.6);
resetSkali();
// GRANICA TEGO, CO TEN TEST MOŻE UDOWODNIĆ (ZMIERZONE mutation testingiem,
// patrz raport zadania - ta sama luka istnieje w analogicznym teście ZIEMI
// powyżej, nie jest wprowadzona tutaj). Fixture rozgrzewkowy i fixture
// pomiaru to TA SAMA statyczna poza (MISK_POL_RAMPY) - EMA zdąża zbiec się
// dokładnie do wartości, jaką dałaby skalaChwilowa() z tej samej klatki.
// Test łapie więc mutację W SAMEJ formule EMA (np. `_skalaEma *= 0.5`,
// ZWERYFIKOWANE), ale NIE odróżnia "skalaCiala() czyta _skalaEma" od
// "skalaCiala() zawsze przelicza skalaChwilowa() na nowo" - przy stałej
// pozie obie ścieżki zbiegają do tej samej liczby. Odróżnienie tych dwóch
// wymagałoby fixture'a rozgrzewkowego o INNEJ szerokości barków niż fixture
// pomiaru - poza zakresem tego zadania.

console.log('\nCIĄGŁOŚĆ przy schodzeniu nadgarstków do siebie:');
let poprzWd = 0, maxSkokWd = 0;
const poziomyWd = [];
for (let i = 0; i <= 60; i++) {
  const d = 0.30 - i * 0.005;
  const s = ocen(cialo({
    nadgL: [-d, -0.12], nadgP: [d, -0.12],
    lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
  }), RECE_WODY).mokosz;
  maxSkokWd = Math.max(maxSkokWd, Math.abs(s - poprzWd)); poprzWd = s;
  if (i % 12 === 0) poziomyWd.push(`${(2 * d).toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomyWd.join('  '));
// Ten sam ujednolicony próg 0.1 co pętle ciągłości ziemi i powietrza wyżej.
spr(`największy skok wody = ${maxSkokWd.toFixed(3)} (rampa, nie próg)`, maxSkokWd < 0.1);

// ================== BŁYSKAWICA (Perun) I PASMO WYSOKOŚCI OGNIA ==================
//
// Zadanie 10 dotyka DWÓCH plików naraz i celowo: piramidka nad głową w
// iglicy błyskawicy to TEN SAM kształt dłoni co ogień (swarogDlon.js), więc
// bez warunku wysokości w ogniu, ogień zapalał się na 223 z 333 klatek
// iglicy (zmierzone na nagraniu, patrz docstring swarogDlon.js).

/**
 * Dłoń w piramidce: palce wyprostowane, opuszki zbiegają się w jednym
 * punkcie (wierzchołek namiotu).
 *
 * POPRAWKA WZGLĘDEM BRIEFU (dwie, obie zmierzone node -e - patrz raport
 * zadania):
 *
 *   1. `bok` ROZSUWA nadgarstek i podstawy palców, a wierzchołek namiotu
 *      zostaje w STAŁYM miejscu, wspólnym dla obu wywołań tej funkcji.
 *      Wersja z briefu wołała `piramidka()` DWA RAZY bez żadnego przesunięcia
 *      - obie dłonie lądowały w DOKŁADNIE tych samych współrzędnych, więc
 *      `odlegloscNadgarstkow()` (swarogDlon.js) wychodziła 0, warunek
 *      "nadgarstki rozsunięte" wynosił 0, i CAŁA piramidka (Math.min) była 0
 *      niezależnie od jakości reszty kształtu - dokładnie ten sam błąd, przed
 *      którym ostrzega ten plik w innym miejscu ("dwie dłonie w jednej klatce
 *      to fizycznie jedna lewa i jedna prawa, nigdy dwie te same", `piesc()`
 *      wyżej), tylko tym razem dotyczący POZYCJI, nie etykiety `handedness`.
 *      Etykieta `handedness` sama w sobie jest tu kosmetyczna - żadna funkcja
 *      na ścieżce pary (`skladnikiPary` w swarogDlon.js) jej nie czyta.
 *   2. Pośrednie stawy każdego palca (PIP/DIP) są policzone jako DOKŁADNA
 *      interpolacja liniowa między podstawą a wierzchołkiem, nie zostawione
 *      na domyślnym (0.50,0.50) jak w wersji z briefu. Wersja z briefu miała
 *      tę samą degenerację łańcucha, którą ten plik już dwa razy naprawiał
 *      (`piesc()` - task 7, `otwartaDlon()` - task 8): środkowy staw
 *      pokrywał się sam ze sobą (odcinek PIP->DIP długości 0), a wynikowa
 *      "prostota" (~0.98) była przypadkiem geometrii tej konkretnej pozycji,
 *      nie gwarancją wzoru - i, co gorsza, zmieniała się nieprzewidywalnie
 *      wraz z `bok` (przesunięcie podstawy przy nieruchomym wierzchołku
 *      zmienia całą geometrię palca). Interpolacja liniowa daje idealnie
 *      prosty łańcuch (`prosto` = 1.000) z DEFINICJI, niezależnie od `bok`.
 *
 * ZMIERZONE (node -e, swarogDlon.skladniki na parze `piramidka(-0.10)` /
 * `piramidka(0.10)`): palce=1.000, opuszki=1.000, nadgarstki=1.000 - pełny
 * kształt, zapas z obu stron progu (bok=0.06 daje jeszcze tylko 0.31
 * nadgarstków, bok=0.08 już 0.75 - próg ROZSUNIECIE_PELNE mija się gdzieś
 * między nimi; bok=0.10 jest bezpiecznie w głębi nasycenia).
 */
function piramidka(bok = 0) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.50, y: 0.50, z: 0 }));
  const wierzcholek = { x: 0.50, y: 0.40, z: 0 };          // wspólny wierzchołek namiotu
  lm[0] = { x: 0.50 + bok, y: 0.70, z: 0 };                // nadgarstek
  lm[1] = { x: 0.46 + bok, y: 0.65, z: 0 };                // kciuk - poza metryką palceProste
  lm[4] = { x: 0.50, y: 0.42, z: 0 };                      // opuszek kciuka - liczy się do zbieżności

  const palec = (baza, pip, dip, opuszek, x0, y0) => {
    const b = { x: x0, y: y0, z: 0 };
    lm[baza] = b;
    lm[pip] = { x: b.x + (wierzcholek.x - b.x) / 3, y: b.y + (wierzcholek.y - b.y) / 3, z: 0 };
    lm[dip] = { x: b.x + (wierzcholek.x - b.x) * 2 / 3, y: b.y + (wierzcholek.y - b.y) * 2 / 3, z: 0 };
    lm[opuszek] = wierzcholek;
  };
  palec(5, 6, 7, 8, 0.47 + bok, 0.58);
  palec(9, 10, 11, 12, 0.49 + bok, 0.57);
  palec(13, 14, 15, 16, 0.51 + bok, 0.57);
  palec(17, 18, 19, 20, 0.53 + bok, 0.58);

  return { handedness: bok <= 0 ? 'Left' : 'Right', landmarks: lm };
}
// Para gotowa do przekazania jako `hands` - rozsunięcie 0.10 z dużym zapasem
// nad progiem (patrz docstring `piramidka` wyżej).
const PIRAMIDKA_PARA = [piramidka(-0.10), piramidka(0.10)];

console.log('\nBŁYSKAWICA (iglica):');
// BŁYSKAWICA (iglica): obie ręce w górę, ŁOKCIE nad linią barków.
// Oś nośna to wysokość łokci - zmierzona mediana +0.13 w tej pozie wobec
// -0.65..-0.72 we wszystkich pozostałych i -0.70 w tańcu.
const IGLICA = cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
  lokL:  [-0.34, -0.85], lokP:  [0.34, -0.85]
});

// POPRAWKA WZGLĘDEM BRIEFU: `ig = ocen(IGLICA)` (bez trzeciego argumentu)
// domyślnie NIE przekazuje żadnych dłoni (`ocen`'s `hands = []`) - dokładnie
// TA SAMA klatka co `igBezDloni` niżej, która w briefie jest osobną,
// zduplikowaną linią. Dwa niezależne defekty złożyły się w jeden:
// (a) formuła `piramidkaNadGlowa` w briefie była SUFITEM 0.7 (patrz poprawka
// w perun.js), więc nawet z dłońmi `ig.perun` nie mógł przekroczyć 0.7;
// (b) bez dłoni piramidka i tak wynosi dokładnie WAGA_BEZ_DLONI=0.7 (early
// return), więc `ig.perun > 0.7` było MATEMATYCZNIE NIEOSIĄGALNE niezależnie
// od poprawności implementacji. Naprawiona wersja przekazuje parę piramidek,
// więc `ig` faktycznie testuje "ręce ułożone W PIRAMIDKĘ", a `igBezDloni`
// (dalej z pustą listą) testuje coś INNEGO - miękkość kwalifikatora.
const ig = ocen(IGLICA, PIRAMIDKA_PARA);
spr(`ręce w górze z łokciami nad barkami i piramidką zapalają błyskawicę (${ig.perun.toFixed(2)})`, ig.perun > 0.7);

// KLUCZOWE ROZRÓŻNIENIE: ręce w górze, ale łokcie NISKO (opuszczone wzdłuż
// ciała, przedramiona w górę). W tańcu zdarza się nieustannie.
const lokcieNisko = ocen(cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
  lokL:  [-0.30, -0.40], lokP:  [0.30, -0.40]
}));
spr(`ręce w górze z łokciami POD barkami NIE zapalają błyskawicy (${lokcieNisko.perun.toFixed(2)})`,
    lokcieNisko.perun < 0.3);

// MIN, NIE MAX - jedna ręka w górze to nie iglica (docstring perun.js).
// Bez tego fixture'a żadna asercja tej sekcji nie odróżnia Math.min od
// Math.max w `nadgarstki`/`lokcie`: wszystkie pozostałe trzymają obie ręce
// SYMETRYCZNIE, więc mutacja min<->max przechodziłaby niezauważona
// (ZMIERZONE node -e - patrz raport zadania, ten sam wzorzec co "jedna ręka
// w górze" w stribog.js i "MAX niższej ręki" w mokosz.js wyżej w tym pliku).
const asymNadgarstki = ocen(cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.30, 0.30],
  lokL:  [-0.34, -0.85], lokP:  [0.34, -0.85]
}));
spr(`jedna ręka w górze, druga w dół NIE zapala błyskawicy - MIN, nie MAX (${asymNadgarstki.perun.toFixed(2)})`,
    asymNadgarstki.perun < 0.3);
const asymLokcie = ocen(cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
  lokL:  [-0.34, -0.85], lokP:  [0.34, 0.10]
}));
spr(`jeden łokieć nad barkami, drugi nisko NIE zapala błyskawicy - MIN, nie MAX (${asymLokcie.perun.toFixed(2)})`,
    asymLokcie.perun < 0.3);

spr(`iglica NIE zapala ziemi (${ig.weles.toFixed(2)})`, ig.weles < 0.3);
spr(`iglica NIE zapala powietrza (${ig.stribog.toFixed(2)})`, ig.stribog < 0.3);
spr(`iglica NIE zapala wody (${ig.mokosz.toFixed(2)})`, ig.mokosz < 0.3);
spr(`ziemia NIE zapala błyskawicy (${z.perun.toFixed(2)})`, z.perun < 0.3);
spr(`powietrze NIE zapala błyskawicy (${pw.perun.toFixed(2)})`, pw.perun < 0.3);
spr(`woda NIE zapala błyskawicy (${wd.perun.toFixed(2)})`, wd.perun < 0.3);

// Łokieć NISKO PEWNY (visibility poniżej progu, współrzędne skończone) - ten
// sam wzorzec co w powietrzu i wodzie wyżej. `perun.PUNKTY` obejmuje
// LOKIEC_L/LOKIEC_P - bez tej asercji mutacja usuwająca łokcie z PUNKTY
// przechodzi niezauważona (ZMIERZONE: perun=1.00 zamiast 0.00, bo reszta
// pozy w tym fixture to pełna iglica).
const perunLokNiewidoczny = ocen((() => {
  const wl = cialo({
    nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
    lokL:  [-0.34, -0.85], lokP:  [0.34, -0.85]
  });
  wl[13] = { ...wl[13], visibility: 0.1 }; // LOKIEC_L (postawa.js) - poniżej PROG_WIDOCZNOSCI (0.5)
  return wl;
})(), PIRAMIDKA_PARA);
spr(`łokieć niepewny (visibility niska) -> błyskawica = 0, nie śmieć (${perunLokNiewidoczny.perun})`,
    perunLokNiewidoczny.perun === 0);

console.log('\nLUSTRO (błyskawica):');
const igL = ocen(odbij(IGLICA), PIRAMIDKA_PARA.map(odbijDlon));
spr(`odbita iglica = ta sama (${igL.perun.toFixed(2)})`, Math.abs(igL.perun - ig.perun) < 0.02);

// Brak dłoni NIE KARZE - piramidka jest kwalifikatorem miękkim. To nie jest
// detal: w nagraniu z żywego ciała jedno z trzech powtórzeń miało ZERO klatek
// z obiema wykrytymi dłońmi, a pieczęć i tak wyszła.
const igBezDloni = ocen(IGLICA, []);
spr(`brak dłoni nie zeruje iglicy (${igBezDloni.perun.toFixed(2)})`, igBezDloni.perun > 0.5);
// Kontrola, że `igBezDloni` faktycznie stoi na PODŁODZE WAGA_BEZ_DLONI (0.7),
// nie na przypadkowej wartości - inaczej test wyżej niczego by o niej nie
// dowodził. Zarazem to jest dowód poprawki formuły w perun.js: sufit z
// briefu i podłoga z poprawki dają w TEJ JEDNEJ klatce identyczną liczbę
// (obie 0.7) - rozjeżdżają się dopiero przy DOBRYM kształcie dłoni (`ig`
// wyżej), co jest dokładnie tym, co pierwsza asercja tej sekcji sprawdza.
spr(`brak dłoni w iglicy = podłoga WAGA_BEZ_DLONI (${igBezDloni.perun.toFixed(3)})`,
    Math.abs(igBezDloni.perun - 0.7) < 0.01);

console.log('\nLUSTRO W POŁOWIE RAMPY - osobno dla KAŻDEGO z dwóch warunków:');
// POPRAWKA PONAD BRIEF (wzorzec z zadań 8/9): `IGLICA` ma OBA warunki
// (nadgarstki, łokcie) NASYCONE - mirror porównywałby 1.00 z 1.00
// niezależnie od formuły. Błyskawica ma DWA warunki z pozy (nie jeden jak
// powietrze w warunku STYKU), więc potrzeba DWÓCH fixture'ów, każdy w
// połowie SWOJEJ rampy, z drugim warunkiem bezpiecznie nasyconym - inaczej
// minimum() mogłoby zamaskować błąd w tym, który akurat testujemy.
//
// Środki ramp (ZMIERZONE node -e, patrz raport zadania):
//   WYSNADG: (1.098 + -0.227)/2 = 0.4355 -> y nadgarstka = -0.7242
//   WYSLOK:  (0.533 + -0.438)/2 = 0.0475 -> y łokcia = -0.5690
// (skala 0.40 m, yBarkow = -0.55, v = (yBarkow - y)/skala).
const P = PROGI.blyskawica;
const NADG_MID = (P.WYSNADG_PELNY + P.WYSNADG_ZERO) / 2;
const LOK_MID = (P.WYSLOK_PELNY + P.WYSLOK_ZERO) / 2;
const Y_NADG_MID = -0.55 - NADG_MID * 0.40;
const Y_LOK_MID = -0.55 - LOK_MID * 0.40;

// Fixture 1: NADGARSTKI w połowie rampy, ŁOKCIE nasycone (jak w IGLICA).
// Piramidka NIE jest przekazywana (hands=[]) CELOWO: podłoga WAGA_BEZ_DLONI
// (0.7) leży NAD środkiem tej rampy (0.5), więc nie maskuje go w Math.min -
// dokładnie ten sam zabieg, którym POWIETRZE_POL_RAMPY_STYK/WYSOKOSC (wyżej
// w tym pliku) unikają przekazywania dłoni.
const PERUN_NADG_POL_RAMPY = { nadgL: [-0.30, Y_NADG_MID], nadgP: [0.30, Y_NADG_MID],
                                lokL: [-0.34, -0.85], lokP: [0.34, -0.85] };
const nadgPolRampy = ocen(cialo(PERUN_NADG_POL_RAMPY));
spr(`fixture lustra (nadgarstki) faktycznie leży w połowie rampy (${nadgPolRampy.perun.toFixed(2)}, oczekiwane 0.4-0.6)`,
    nadgPolRampy.perun > 0.4 && nadgPolRampy.perun < 0.6);
const nadgPolRampyL = ocen(odbij(cialo(PERUN_NADG_POL_RAMPY)));
spr(`odbita błyskawica (połowa rampy nadgarstków) = ta sama (${nadgPolRampyL.perun.toFixed(2)})`,
    Math.abs(nadgPolRampyL.perun - nadgPolRampy.perun) < 0.02);

// Fixture 2: ŁOKCIE w połowie rampy, NADGARSTKI nasycone.
const PERUN_LOK_POL_RAMPY = { nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
                               lokL: [-0.34, Y_LOK_MID], lokP: [0.34, Y_LOK_MID] };
const lokPolRampy = ocen(cialo(PERUN_LOK_POL_RAMPY));
spr(`fixture lustra (łokcie) faktycznie leży w połowie rampy (${lokPolRampy.perun.toFixed(2)}, oczekiwane 0.4-0.6)`,
    lokPolRampy.perun > 0.4 && lokPolRampy.perun < 0.6);
const lokPolRampyL = ocen(odbij(cialo(PERUN_LOK_POL_RAMPY)));
spr(`odbita błyskawica (połowa rampy łokci) = ta sama (${lokPolRampyL.perun.toFixed(2)})`,
    Math.abs(lokPolRampyL.perun - lokPolRampy.perun) < 0.02);

// GRANICA TEGO, CO LUSTRO MOŻE UDOWODNIĆ (ten sam zapis co przy powietrzu
// i wodzie wyżej w tym pliku). `nadBarkami()` (styk.js) czyta WYŁĄCZNIE
// współrzędną y - żaden z dwóch warunków błyskawicy nie ma operacji czułej
// na znak x, więc test lustra dowodzi wyłącznie tego, że żadna z formuł nie
// czyta surowej współrzędnej x wprost. Wartość obu asercji-precondycji
// wyżej (fixture faktycznie w połowie rampy) leży w tym, że łapią błąd
// SKALI czy ZAMIENIONYCH progów, nie w symetrii lustra jako takiej.

console.log('\nGŁĘBIA (oś z) - błyskawica z tułowiem obróconym bokiem:');
// Ten sam cel co sekcje GŁĘBIA w ziemi/powietrzu/wodzie wyżej: `nadBarkami()`
// dzieli przez `skalaCiala()`, więc usunięcie dz z tej ostatniej wpływa na
// KAŻDY warunek błyskawicy przez WSPÓLNY mianownik. Oba warunki są ROSNĄCE
// (wyżej = więcej), więc błąd (skala zapada się do podłogi 0.12, każda
// odległość znormalizowana wychodzi kilkukrotnie za duża) wynik ZAWYŻA,
// nie zaniża - ten sam kierunek co w ziemi/powietrzu, przeciwny niż w wodzie.
// Fixture'y NIE MOGĄ być nasycone (jak ZIEMIA_BOKIEM) - zawyżenie nie miałoby
// dokąd urosnąć. Ponownie użyte są fixture'y "połowa rampy" z sekcji LUSTRA
// wyżej, z dodanym obrotem tułowia. Obracamy WYŁĄCZNIE barki (`cialo({obrot})`
// robi to automatycznie) - `nadBarkami()` czyta TYLKO y punktu, więc obrót
// WŁASNEJ pozycji nadgarstka/łokcia nie dodałby żadnej nowej ścieżki (ten
// sam argument co przy sekcji GŁĘBOKOŚĆ wody wyżej).
const KAT_PERUN = 75;
const RAD_PERUN = KAT_PERUN * Math.PI / 180;
const bzPerun = 0.20 * Math.sin(RAD_PERUN);

const nadgBokiem = ocen(cialo({ ...PERUN_NADG_POL_RAMPY, obrot: KAT_PERUN }));
spr(`błyskawica (nadgarstki) z realną głębią tułowia zostaje w połowie rampy (${nadgBokiem.perun.toFixed(2)}, oczekiwane 0.4-0.6)`,
    nadgBokiem.perun > 0.4 && nadgBokiem.perun < 0.6);

const lokBokiem = ocen(cialo({ ...PERUN_LOK_POL_RAMPY, obrot: KAT_PERUN }));
spr(`błyskawica (łokcie) z realną głębią tułowia zostaje w połowie rampy (${lokBokiem.perun.toFixed(2)}, oczekiwane 0.4-0.6)`,
    lokBokiem.perun > 0.4 && lokBokiem.perun < 0.6);

resetSkali();
const skalaProstoPerun = skalaCiala(cialo(PERUN_NADG_POL_RAMPY));
resetSkali();
const skalaBokiemPerun = skalaCiala(cialo({ ...PERUN_NADG_POL_RAMPY, obrot: KAT_PERUN }));
console.log(`  skala prosto=${skalaProstoPerun.toFixed(3)} m   skala bokiem=${skalaBokiemPerun.toFixed(3)} m`);
spr(`skala barków jest niezmiennikiem obrotu (różnica ${Math.abs(skalaProstoPerun - skalaBokiemPerun).toFixed(3)} m)`,
    Math.abs(skalaProstoPerun - skalaBokiemPerun) < 0.01);
spr(`fixture błyskawicy rzeczywiście ma niezerową głębię (bz=${bzPerun.toFixed(3)})`, Math.abs(bzPerun) > 0.05);
resetSkali();

console.log('\nOGIEŃ - PASMO WYSOKOŚCI:');
// Piramidka NAD GŁOWĄ to wciąż piramidka dla swarogDlon. Bez pasma ogień
// zapalał się na 223 z 333 klatek iglicy (zmierzone na nagraniu).
const piramidkaNadGlowa = ocen(IGLICA, PIRAMIDKA_PARA);
// Próg ZAOSTRZONY względem briefu (< 0.3 -> === 0): `pasmo()` zwraca
// DOKŁADNIE 0 poza suficiem GORA_ZERO (rampa() przycina do 0, nie tylko
// "blisko zera"), a Math.min w swarogDlon.score przepuszcza to zero bez
// zmian niezależnie od reszty kształtu dłoni. To darmowa siła: zmierzone
// (node -e) 0.0000 dokładnie, nie tylko "poniżej 0.3".
spr(`piramidka NAD GŁOWĄ nie zapala ognia (${piramidkaNadGlowa.swarog.toFixed(4)})`,
    piramidkaNadGlowa.swarog === 0);

// Ta sama piramidka na wysokości klatki - ogień ma się zapalić.
const NA_KLATCE = cialo({
  nadgL: [-0.10, -0.35], nadgP: [0.10, -0.35],
  lokL:  [-0.28, -0.15], lokP:  [0.28, -0.15]
});
const piramidkaNaKlatce = ocen(NA_KLATCE, PIRAMIDKA_PARA);
spr(`piramidka na wysokości klatki zapala ogień (${piramidkaNaKlatce.swarog.toFixed(2)})`,
    piramidkaNaKlatce.swarog > 0.7);

console.log('\nOGIEŃ - MIN, NIE MAX / BRAK POZY (konsekwencja `wymaga: \'both\'`):');
// MIN, NIE MAX - jeden nadgarstek na wysokości iglicy, drugi na wysokości
// klatki. `wysokoscPiramidki` bierze Math.max z dwóch nadBarkami(), czyli
// WYŻSZY (bliższy iglicy) nadgarstek rządzi - konserwatywnie, tak samo jak
// perun.js bierze Math.min (niższy = "mniej iglicowy") z tych samych dwóch
// punktów dla SWOJEGO warunku. Bez tego fixture'a żadna asercja tej sekcji
// nie odróżnia MIN od MAX: piramidkaNadGlowa/piramidkaNaKlatce trzymają obie
// ręce symetrycznie (ZMIERZONE node -e - patrz raport zadania).
const jedenNadgIglica = ocen(cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.10, -0.35],
  lokL:  [-0.34, -0.85], lokP:  [0.28, -0.15]
}), PIRAMIDKA_PARA);
spr(`jeden nadgarstek na wysokości iglicy NIE zapala ognia - MAX wyższego, nie MIN (${jedenNadgIglica.swarog.toFixed(2)})`,
    jedenNadgIglica.swarog < 0.3);

// KONSEKWENCJA `wymaga: 'both'` (registry.js, _ocenJeden): klatka z dłońmi,
// ale bez WYKRYTEJ POZY W OGÓLE (frame.pose === null, nie tylko puste
// worldLandmarks) - dokładnie sytuacja z main.js:199 (buildFrame), gdy
// MediaPipe traci sylwetkę, a dłonie zostają widoczne. Przed zadaniem 10
// (`wymaga: 'hands'`) taka klatka liczyła się WYŁĄCZNIE z kształtu dłoni;
// od tego zadania rejestr blokuje wywołanie score() w ogóle, WCZEŚNIEJ niż
// wewnętrzny strażnik `widoczne()` w wysokoscPiramidki() zdążyłby cokolwiek
// policzyć. Test woła `rej.ocen()` (rejestr), nie lokalny `ocen()` (który
// zawsze buduje poprawną pozę) - inaczej ta ścieżka zostałaby nieprzetestowana.
resetSkali();
const brakPozySwarog = rej.ocen({
  hands: PIRAMIDKA_PARA, pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0
});
spr(`piramidka BEZ ŻADNEJ pozy (frame.pose === null) nie zapala ognia (${brakPozySwarog.swarog}) - gate rejestru "both"`,
    brakPozySwarog.swarog === 0);
// Ten sam scenariusz, ale WOŁANY BEZPOŚREDNIO przez score() (z pominięciem
// rejestru) - łapie mutację w WEWNĘTRZNYM strażniku `widoczne()` wewnątrz
// wysokoscPiramidki(), niezależnie od gate'u rejestru. Bez tego strażnika
// `skalaCiala(undefined)` i `nadBarkami(undefined, ...)` nie wybuchają
// (mają własne podłogi), ale `wys` wychodzi 0 przez przypadek, co ląduje
// W ŚRODKU opadającej części pasma (~0.40, nie 0) - ZMIERZONE node -e, ta
// klasa błędu NIE objawia się jako wyjątek, tylko jako cichy częściowy wynik.
const brakPozyBezposrednio = swarogDlon.score({
  hands: PIRAMIDKA_PARA, pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0
});
spr(`...i tak samo przy wywołaniu score() z pominięciem rejestru (${brakPozyBezposrednio}) - strażnik widoczne()`,
    brakPozyBezposrednio === 0);
resetSkali();

console.log('\nOGIEŃ - CIĄGŁOŚĆ PASMA (cztery segmenty, dwa przejścia, nie jedna rampa):');
// Rampa ma dwa krańce (0 i 1) i jedno przejście. PASMO ma CZTERY krańce
// (DOL_ZERO, DOL_PELNY, GORA_PELNY, GORA_ZERO) i DWA przejścia: wchodzenie
// od dołu (woda -> ogień) i wychodzenie górą (ogień -> iglica), plus PLATEAU
// pełnego wyniku pomiędzy nimi. Test niżej przemiata całe pasmo i sprawdza
// WSZYSTKIE CZTERY odcinki naraz - nie wystarczy sam brak skoków (to samo
// zaliczyłby test, który nigdy nie opuszcza plateau).
//
// Ręce trzymają STAŁY, pełny kształt piramidki (PIRAMIDKA_PARA) przez cały
// przemiat - jedyną zmienną jest WYSOKOŚĆ nadgarstków pozy. Dzięki temu
// `swarog` = dokładnie `wysokosc` (pozostałe trzy składniki = 1 przez cały
// czas) i przemiat mierzy CZYSTO samo pasmo, bez interferencji kształtu dłoni.
const PO = PROGI.ogien;
const SKALA_SWEEP = 0.40, Y_BARKOW_SWEEP = -0.55;
let poprzPasmo = null, maxSkokPasmo = 0;
let widzianoZeroNisko = false, widzianoPlateau = false, widzianoZeroWysoko = false;
const poziomyPasmo = [];
const V0 = -1.05, V1 = 0.35, N_PASMO = 100;
for (let i = 0; i <= N_PASMO; i++) {
  const v = V0 + (V1 - V0) * i / N_PASMO;
  const y = Y_BARKOW_SWEEP - v * SKALA_SWEEP;
  const wl = cialo({ nadgL: [-0.30, y], nadgP: [0.30, y], lokL: [-0.34, -0.85], lokP: [0.34, -0.85] });
  const s = ocen(wl, PIRAMIDKA_PARA).swarog;
  if (poprzPasmo !== null) maxSkokPasmo = Math.max(maxSkokPasmo, Math.abs(s - poprzPasmo));
  poprzPasmo = s;
  if (v < PO.WYSOKOSC_DOL_ZERO && s === 0) widzianoZeroNisko = true;
  if (v > PO.WYSOKOSC_DOL_PELNY && v < PO.WYSOKOSC_GORA_PELNY && s === 1) widzianoPlateau = true;
  if (v > PO.WYSOKOSC_GORA_ZERO && s === 0) widzianoZeroWysoko = true;
  if (i % 10 === 0) poziomyPasmo.push(`${v.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomyPasmo.join('  '));
spr(`największy skok w pasmie = ${maxSkokPasmo.toFixed(3)} (rampa w środku, nie próg)`, maxSkokPasmo < 0.1);
spr('przemiat faktycznie dotyka MILCZENIA NISKO (segment 1: woda)', widzianoZeroNisko);
spr('przemiat faktycznie dotyka PLATEAU 1.0 (segment 2-3: ogień)', widzianoPlateau);
spr('przemiat faktycznie dotyka MILCZENIA WYSOKO (segment 4: iglica)', widzianoZeroWysoko);

process.exit(ok ? 0 : 1);
