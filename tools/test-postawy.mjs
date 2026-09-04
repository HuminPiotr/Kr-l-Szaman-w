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
import { resetSkali, skalaCiala } from '../js/znaki/postawa.js';
import { weles } from '../js/znaki/weles.js';

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
rej.zarejestruj(weles);
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
 */
export function piesc() {
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
  return { handedness: 'Left', landmarks: lm };
}

/** Dłoń rozprostowana: palce wyciągnięte daleko od nadgarstka. */
export function otwartaDlon() {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.50, y: 0.50, z: 0 }));
  lm[0] = { x: 0.50, y: 0.60, z: 0 };
  const nasady = { 5: 0.40, 9: 0.46, 13: 0.52, 17: 0.58 };
  const opuszki = { 4: 0.34, 8: 0.40, 12: 0.46, 16: 0.52, 20: 0.58 };
  for (const [i, x] of Object.entries(nasady)) lm[i] = { x, y: 0.35, z: 0 };
  lm[1] = { x: 0.44, y: 0.55, z: 0 }; lm[2] = { x: 0.40, y: 0.48, z: 0 }; lm[3] = { x: 0.37, y: 0.40, z: 0 };
  for (const [i, x] of Object.entries(opuszki)) lm[i] = { x, y: 0.15, z: 0 };
  // Uzupełnij pozostałe stawy łańcuchów prostą interpolacją - wystarczy, że
  // palec jest w przybliżeniu prosty, testy nie wymagają anatomicznej wierności.
  const posrednie = { 6: 0.40, 7: 0.40, 10: 0.46, 11: 0.46, 14: 0.52, 15: 0.52, 18: 0.58, 19: 0.58 };
  for (const [i, x] of Object.entries(posrednie)) lm[i] = { x, y: 0.25, z: 0 };
  return { handedness: 'Left', landmarks: lm };
}

// ZIEMIA: pięści na przeciwnych barkach. Nadgarstek LEWY przy barku PRAWYM.
const ZIEMIA = cialo({
  nadgL: [0.20, -0.55], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30]
});

console.log('ZIEMIA:');
const z = ocen(ZIEMIA, [piesc(), piesc()]);
spr(`pięści na barkach zapalają ziemię (${z.weles.toFixed(2)})`, z.weles > 0.7);

const opuszczone = ocen(cialo({
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15],
  nadgP: [0.22, 0.30], lokP: [0.21, -0.15]
}), [piesc(), piesc()]);
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
}), [piesc(), piesc()]);
spr(`ręce skrzyżowane nisko NIE zapalają ziemi (${nisko.weles.toFixed(2)})`, nisko.weles < 0.5);

console.log('\nLUSTRO:');
// Odległości są niezmiennikiem odbicia - to jest cały powód, dla którego
// nowy weles.js nie potrzebuje formuły ze znakiem iloczynu (stary weles.js:46).
const odbij = (wl) => wl.map(p => ({ ...p, x: -p.x }));
const zL = ocen(odbij(ZIEMIA), [piesc(), piesc()]);
spr(`odbita ziemia = ta sama (${zL.weles.toFixed(2)})`, Math.abs(zL.weles - z.weles) < 0.02);

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
const zg = ocen(ZIEMIA_BOKIEM, [piesc(), piesc()]);
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
}), [piesc(), piesc()]);
spr(`punkty niewidoczne -> 0, nie śmieć (${slabe.weles.toFixed(2)})`, slabe.weles === 0);

const zepsute = ocen(cialo({
  nadgL: [NaN, NaN], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30]
}), [piesc(), piesc()]);
spr(`NaN w punkcie -> 0 (${zepsute.weles})`, zepsute.weles === 0);

// REGUŁA NADRZĘDNA: brak dłoni w kadrze NIE KARZE. Kwalifikator pięści jest
// miękki - ciało prowadzi, dłonie doprecyzowują.
const bezDloni = ocen(ZIEMIA, []);
spr(`brak dłoni nie zeruje ziemi (${bezDloni.weles.toFixed(2)})`, bezDloni.weles > 0.5);

// Dłoń WIDOCZNA, ale rozprostowana, nie może dać GORSZEGO wyniku niż brak
// dłoni w kadrze - inaczej wejście dłoni do kadru byłoby karą (dlon.js
// docstring piesci(), reguła nadrzędna GEMINI.md §2).
const otwarte = ocen(ZIEMIA, [otwartaDlon(), otwartaDlon()]);
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
  }), [piesc(), piesc()]).weles;
  maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
  if (i % 12 === 0) poziomy.push(`${d.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

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
const otw = otwartaDlon().landmarks, pst = piesc().landmarks;
const klatkaD = (t) => otw.map((p, idx) => ({
  x: p.x + (pst[idx].x - p.x) * t,
  y: p.y + (pst[idx].y - p.y) * t,
  z: 0
}));
let poprzD = ocen(ZIEMIA, [{ handedness: 'Left', landmarks: klatkaD(0) }, { handedness: 'Left', landmarks: klatkaD(0) }]).weles;
let maxSkokD = 0;
const poziomyD = [`0.00:${poprzD.toFixed(2)}`];
for (let i = 1; i <= 20; i++) {
  const t = i / 20;
  const lm = klatkaD(t);
  const dlon = { handedness: 'Left', landmarks: lm };
  const s = ocen(ZIEMIA, [dlon, dlon]).weles;
  maxSkokD = Math.max(maxSkokD, Math.abs(s - poprzD)); poprzD = s;
  if (i % 4 === 0) poziomyD.push(`${t.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomyD.join('  '));
spr(`największy skok przy zwijaniu dłoni = ${maxSkokD.toFixed(3)} (rampa, nie próg)`, maxSkokD < 0.2);
// Kontrola, że dłoń faktycznie startuje na podłodze WAGA_BEZ_DLONI, nie na
// przypadkowej niskiej wartości - inaczej powyższy test niczego by nie
// dowodził o samej podłodze.
spr(`start pętli = podłoga bez dłoni (${poziomyD[0]})`, Math.abs(parseFloat(poziomyD[0].split(':')[1]) - bezDloni.weles) < 0.01);

process.exit(ok ? 0 : 1);
