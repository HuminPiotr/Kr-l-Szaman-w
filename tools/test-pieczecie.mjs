/**
 * Moc jako zasób: koszt częściowy i zamrożenie zaniku.
 * Składanie: próg/tempo/koszt, ZANIK ZAMIAST ZEROWANIA i LEPKI ARGMAX
 * (przebudowa na runy, docs/superpowers/specs/2026-09-01-runy-i-kwalifikatory-design.md).
 *
 *   node tools/test-pieczecie.mjs
 *
 * ZAMROŻENIE ZANIKU NIE JEST OPTYMALIZACJĄ. Bez niego trzymanie postawy
 * kosztuje podwójnie: responsywnosc spada do zera (znika przyrost) I działa
 * ZANIK. Postawa niechlujna, ale ponad progiem, składa się ~2 s, co zjada
 * ~13% mocy - WIĘCEJ niż kosztuje sama pieczęć. Cena przestaje wtedy wynosić
 * 10% i staje się "10% plus kara proporcjonalna do niedokładności" - dokładnie
 * ta stopniowana kara, której zabrania reguła nadrzędna (GEMINI.md §2).
 */
import { MotionMeter } from '../js/motionMeter.js';
import { SkladaniePieczeci, KOSZT_PODSTAWOWY } from '../js/pieczecie.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// Ciało nieruchome: te same worldLandmarks w każdej klatce.
function stoiWMiejscu() {
  const wl = Array.from({ length: 33 }, (_, i) => ({
    x: (i % 3) * 0.1, y: (i % 5) * 0.1, z: 0, visibility: 1
  }));
  return { hands: [], pose: { landmarks: [], worldLandmarks: wl },
           width: 1920, height: 1080, dt: 1 / 60, now: 0 };
}

console.log('KOSZT CZĘŚCIOWY:');
const mm = new MotionMeter();
mm.moc = 1.0;
mm.zuzyj(0.10);
spr(`zuzyj(0.10) zabiera dokładnie 10% (${mm.moc.toFixed(3)})`, Math.abs(mm.moc - 0.90) < 1e-9);
mm.zuzyj(0.10);
spr(`drugie 10% (${mm.moc.toFixed(3)})`, Math.abs(mm.moc - 0.80) < 1e-9);

// Domyślna wartość zachowuje zachowanie odpiętego powerBall.js, który
// zeruje cały zbiornik jednym wywołaniem bez argumentu.
mm.zuzyj();
spr(`zuzyj() bez argumentu zeruje zbiornik (${mm.moc.toFixed(3)})`, mm.moc === 0);

// Koszt większy niż zapas nie schodzi poniżej zera.
mm.moc = 0.05; mm.zuzyj(0.10);
spr(`koszt ponad zapas nie daje ujemnej mocy (${mm.moc.toFixed(3)})`, mm.moc === 0);

console.log('\nZAMROŻENIE ZANIKU:');
// Trzy sekundy bezruchu bez zamrożenia - moc musi opaść.
const bez = new MotionMeter();
bez.moc = 0.5;
for (let i = 0; i < 180; i++) bez.update(stoiWMiejscu(), 1, false);
spr(`3 s bezruchu BEZ zamrożenia -> moc spada (${bez.moc.toFixed(3)})`, bez.moc < 0.48);

// Te same trzy sekundy z zamrożeniem - moc musi stać.
const zam = new MotionMeter();
zam.moc = 0.5;
for (let i = 0; i < 180; i++) zam.update(stoiWMiejscu(), 1, true);
spr(`3 s bezruchu Z zamrożeniem -> moc stoi (${zam.moc.toFixed(3)})`, Math.abs(zam.moc - 0.5) < 1e-6);

// Zamrożenie nie może też mocy DODAWAĆ - to nie jest premia za stanie.
spr(`zamrożenie nie podnosi mocy (${zam.moc.toFixed(3)})`, zam.moc <= 0.5 + 1e-9);

// NaN w jednej klatce nie może zatruć zbiornika na stałe (motionMeter.js:176).
const nan = new MotionMeter();
nan.moc = 0.5;
nan.zuzyj(NaN);
spr(`zuzyj(NaN) nie zatruwa mocy (${nan.moc})`, Number.isFinite(nan.moc));

console.log('\nSKŁADANIE - próg:');
const DT = 1 / 60;
// Przepuszcza `sekundy` klatek i zwraca ostatni wynik oraz to, czy
// pieczęć złożyła się po drodze.
function trzymaj(sk, wyniki, moc, sekundy) {
  let zlozona = null, ostatni = null;
  for (let i = 0; i < Math.round(sekundy / DT); i++) {
    ostatni = sk.update(wyniki, moc, DT);
    if (ostatni.zlozona) zlozona = ostatni.zlozona;
  }
  return { ostatni, zlozona };
}

const s1 = new SkladaniePieczeci();
// Postawa PONIŻEJ progu: cisza. Nie odmowa, nie komunikat - po prostu nic.
const ponizej = trzymaj(s1, { perun: 0.3, mokosz: 0, weles: 0 }, 1.0, 3);
spr(`postawa poniżej progu nie napełnia pierścienia (${ponizej.ostatni.postep.toFixed(2)})`,
    ponizej.ostatni.postep === 0);
spr('postawa poniżej progu nie składa pieczęci', ponizej.zlozona === null);
spr('postawa poniżej progu nie zamraża zaniku', s1.zamrazaZanik === false);

console.log('\nSKŁADANIE - tempo:');
// Postawa IDEALNA składa się w czasie minimalnym.
const s2 = new SkladaniePieczeci();
const szybko = trzymaj(s2, { perun: 1.0, mokosz: 0, weles: 0 }, 1.0, 0.6);
spr('idealna postawa składa się w ~0.5 s', szybko.zlozona?.id === 'perun');

// Postawa TUŻ NAD progiem składa się wolniej, ale SKŁADA SIĘ.
// To jest gradient, nie kara: niedokładność kosztuje czas, nigdy odmowę.
const s3 = new SkladaniePieczeci();
const wolno = trzymaj(s3, { perun: 0.55, mokosz: 0, weles: 0 }, 1.0, 0.6);
spr('postawa tuż nad progiem NIE zdąża w 0.6 s', wolno.zlozona === null);
spr(`ale pierścień się napełnia (${wolno.ostatni.postep.toFixed(2)})`, wolno.ostatni.postep > 0.1);
const wolno2 = trzymaj(s3, { perun: 0.55, mokosz: 0, weles: 0 }, 1.0, 3.0);
spr('i domyka się przed sufitem czasu', wolno2.zlozona?.id === 'perun');

console.log('\nBRAMKA MOCY:');
const s4 = new SkladaniePieczeci();
const bezMocy = trzymaj(s4, { perun: 1.0, mokosz: 0, weles: 0 }, 0.05, 2);
spr(`bez mocy pierścień stoi (${bezMocy.ostatni.postep.toFixed(2)})`, bezMocy.ostatni.postep === 0);
spr('bez mocy pieczęć się nie składa', bezMocy.zlozona === null);
spr('bez mocy zgłoszony jest brakMocy', bezMocy.ostatni.brakMocy === true);
// KLUCZOWE: bez mocy NIE WOLNO zamrażać zaniku. Zamrożenie przy pustym
// zbiorniku dałoby zakleszczenie - moc nie rośnie (gracz stoi w postawie),
// nie spada (zamrożona) i pieczęć nigdy nie staje się osiągalna.
spr('bez mocy zanik NIE jest zamrożony (inaczej zakleszczenie)', s4.zamrazaZanik === false);

console.log('\nKOSZT I ZDARZENIE:');
const s5 = new SkladaniePieczeci();
const raz = trzymaj(s5, { perun: 1.0, mokosz: 0, weles: 0 }, 1.0, 0.6);
spr(`złożona pieczęć podaje swój koszt (${raz.zlozona?.koszt})`,
    raz.zlozona?.koszt === KOSZT_PODSTAWOWY);
spr(`pierścień wraca do zera po złożeniu (${raz.ostatni.postep.toFixed(2)})`,
    raz.ostatni.postep < 1);

// Zdarzenie jest JEDNORAZOWE - trzymanie tej samej postawy nie ma
// produkować pieczęci co klatkę.
const s6 = new SkladaniePieczeci();
let ile = 0;
for (let i = 0; i < Math.round(0.62 / DT); i++) {
  if (s6.update({ perun: 1.0, mokosz: 0, weles: 0 }, 1.0, DT).zlozona) ile++;
}
spr(`0.62 s trzymania daje dokładnie jedną pieczęć (${ile})`, ile === 1);

console.log('\nLEPKI ARGMAX - przejęcie wymaga marginesu I czasu:');
// Zmiana celu jest nadal RETARGETOWANIEM, nie porażką - ale teraz nie
// wystarcza jedna klatka przewagi. Rywal musi wygrywać WYRAŹNIE i TRWALE.
const s7 = new SkladaniePieczeci();
trzymaj(s7, { perun: 1.0, mokosz: 0, weles: 0 }, 1.0, 0.3);

// Jedna klatka wyraźnej przewagi rywala - za mało, urzędujący (perun) zostaje.
const jednaKlatka = s7.update({ perun: 0, mokosz: 1.0, weles: 0 }, 1.0, DT);
spr(`jedna klatka przewagi NIE przejmuje pierścienia (${jednaKlatka.skladana})`,
    jednaKlatka.skladana === 'perun');

// Ta sama przewaga UTRZYMANA przez ~CZAS_PRZEJECIA_S - w końcu przejmuje,
// i zaczyna nowy pierścień od zera (retargetowanie).
let przejal = null;
for (let i = 0; i < 20; i++) {
  const w = s7.update({ perun: 0, mokosz: 1.0, weles: 0 }, 1.0, DT);
  if (w.skladana === 'mokosz') { przejal = w; break; }
}
spr('utrzymana przewaga w końcu przejmuje pierścień', przejal !== null);
spr(`i zaczyna od początku (${(przejal?.postep ?? 1).toFixed(2)})`, (przejal?.postep ?? 1) < 0.1);

console.log('\nODPORNOŚĆ NA NaN:');
const s8 = new SkladaniePieczeci();
s8.update({ perun: NaN, mokosz: 0, weles: 0 }, NaN, DT);
const poNan = trzymaj(s8, { perun: 1.0, mokosz: 0, weles: 0 }, 1.0, 0.6);
spr('klatka z NaN nie zatruwa składania', poNan.zlozona?.id === 'perun');

// --- LEPKI ARGMAX, wersja ogólna ---
// Zastępuje dawny hack "Splot wygrywa remis z Welesem" (usunięty z pieczecie.js
// razem z tą przebudową). Ten sam problem - dwa znaki o zbliżonym wyniku, przez
// co pierścień migał i nic nigdy się nie składało - jest teraz rozwiązany
// OGÓLNIE, dla dowolnej pary id, nie tylko zaszytej Splot/Weles.
console.log('\nLEPKI ARGMAX (uogólnienie dawnego hacku Splot/Weles):');

// Dokładny remis: urzędujący (a) zostaje, niezależnie od kolejności kluczy.
const kRemis = new SkladaniePieczeci();
kRemis.update({ a: 1.0, b: 0 }, 1.0, DT); // ustanawia 'a' jako urzędującego
for (let i = 0; i < 30; i++) kRemis.update({ a: 0.6, b: 0.6 }, 1.0, DT);
spr(`dokładny remis - urzędujący (a) zostaje (${kRemis.skladana})`, kRemis.skladana === 'a');

// Przewaga PONIŻEJ marginesu (0.08 < MARGINES 0.12), utrzymana długo -
// nadal nie przejmuje. Margines liczy się na różnicy bezwzględnej wyników.
const kMalaPrzewaga = new SkladaniePieczeci();
kMalaPrzewaga.update({ a: 1.0, b: 0 }, 1.0, DT);
for (let i = 0; i < 60; i++) kMalaPrzewaga.update({ a: 0.55, b: 0.63 }, 1.0, DT);
spr(`przewaga poniżej marginesu nie przejmuje nawet po 1 s (${kMalaPrzewaga.skladana})`,
    kMalaPrzewaga.skladana === 'a');

// Wyraźna przewaga (powyżej marginesu), ale PRZERYWANA - znika, zanim minie
// czas przejęcia, więc licznik kandydata resetuje się i nigdy nie sumuje
// osobnych odcinków w jeden.
const kPrzerywana = new SkladaniePieczeci();
kPrzerywana.update({ a: 1.0, b: 0 }, 1.0, DT);
for (let i = 0; i < 10; i++) kPrzerywana.update({ a: 0.6, b: 0.85 }, 1.0, DT); // przewaga b, krócej niż czas przejęcia
kPrzerywana.update({ a: 0.85, b: 0.6 }, 1.0, DT); // przewaga znika - reset licznika kandydata
for (let i = 0; i < 10; i++) kPrzerywana.update({ a: 0.6, b: 0.85 }, 1.0, DT); // wraca, ale znowu liczy od zera
spr(`przerywana przewaga nie sumuje się w czasie (${kPrzerywana.skladana})`, kPrzerywana.skladana === 'a');

// Wyraźna I TRWAŁA przewaga - w końcu przejmuje.
const kWygrywa = new SkladaniePieczeci();
kWygrywa.update({ a: 1.0, b: 0 }, 1.0, DT);
let przejeteB = null;
for (let i = 0; i < 30; i++) {
  const w = kWygrywa.update({ a: 0.3, b: 0.9 }, 1.0, DT);
  if (w.skladana === 'b') { przejeteB = w; break; }
}
spr('wyraźna i trwała przewaga w końcu przejmuje', przejeteB !== null);

console.log('\nZANIK ZAMIAST ZEROWANIA (jedna klatka poniżej progu):');
// Budujemy solidny, ale niepełny postęp (mniej niż czasMin, żeby nie złożyć
// pieczęci przez przypadek w trakcie budowania).
const sZanik = new SkladaniePieczeci();
for (let i = 0; i < 15; i++) sZanik.update({ perun: 1.0 }, 1.0, DT);
const postepPrzed = sZanik.postep;
spr(`solidny, niepełny postęp zbudowany (${postepPrzed.toFixed(2)})`,
    postepPrzed > 0.2 && postepPrzed < 0.9);

// Jedna klatka poniżej progu (0.3 < PROG_POSTAWY 0.5).
const CZAS_ZANIKU_S = 1.5; // musi być zgodne z pieczecie.js - ZGADNIĘTE, do potwierdzenia
const poDolku = sZanik.update({ perun: 0.3 }, 1.0, DT);
const oczekiwanyPoDolku = Math.max(0, postepPrzed - DT / CZAS_ZANIKU_S);
spr(`jedna klatka poniżej progu ZMNIEJSZA postęp o dt/CZAS_ZANIKU, nie zeruje (${poDolku.postep.toFixed(4)} ~ ${oczekiwanyPoDolku.toFixed(4)})`,
    Math.abs(poDolku.postep - oczekiwanyPoDolku) < 1e-6);
spr('postęp po dołku nadal bliski temu sprzed dołka (nie zero)', poDolku.postep > postepPrzed - 0.05);

// Powrót nad próg - kontynuacja OD ZDEGRADOWANEJ wartości, nie od zera.
const poPowrocie = sZanik.update({ perun: 1.0 }, 1.0, DT);
spr('po powrocie postęp rośnie DALEJ od miejsca dołka, nie od zera',
    poPowrocie.postep > poDolku.postep);

// Zanik prowadzi w końcu do ciszy (cel zwolniony), gdy dołek trwa długo -
// to jest ten sam stan końcowy co dawny natychmiastowy reset, tylko rozłożony w czasie.
const sDlugiDolek = new SkladaniePieczeci();
for (let i = 0; i < 15; i++) sDlugiDolek.update({ perun: 1.0 }, 1.0, DT);
let ostatniDlugiDolek = null;
for (let i = 0; i < 200; i++) ostatniDlugiDolek = sDlugiDolek.update({ perun: 0 }, 1.0, DT);
spr(`długotrwały dołek w końcu prowadzi do ciszy (${ostatniDlugiDolek.postep.toFixed(3)})`,
    ostatniDlugiDolek.postep === 0 && ostatniDlugiDolek.skladana === null);

process.exit(ok ? 0 : 1);
