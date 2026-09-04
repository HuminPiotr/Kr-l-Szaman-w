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
rej.zarejestruj(weles); rej.zarejestruj(stribog);
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


