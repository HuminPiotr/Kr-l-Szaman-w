/**
 * Moc jako zasób: koszt częściowy i zamrożenie zaniku.
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

console.log('\nPRZEŁĄCZENIE POSTAWY:');
// Zmiana postawy w trakcie to RETARGETOWANIE, nie porażka - pierścień
// startuje od nowa dla nowego znaku i nic nie miga na czerwono.
const s7 = new SkladaniePieczeci();
trzymaj(s7, { perun: 1.0, mokosz: 0, weles: 0 }, 1.0, 0.3);
const po = s7.update({ perun: 0, mokosz: 1.0, weles: 0 }, 1.0, DT);
spr(`przełączenie celuje w nowy znak (${po.skladana})`, po.skladana === 'mokosz');
spr(`i zaczyna od początku (${po.postep.toFixed(2)})`, po.postep < 0.1);

console.log('\nODPORNOŚĆ NA NaN:');
const s8 = new SkladaniePieczeci();
s8.update({ perun: NaN, mokosz: 0, weles: 0 }, NaN, DT);
const poNan = trzymaj(s8, { perun: 1.0, mokosz: 0, weles: 0 }, 1.0, 0.6);
spr('klatka z NaN nie zatruwa składania', poNan.zlozona?.id === 'perun');

// --- KOLIZJA SPLOT/WELES: przy remisie Splot ma wygrywać ---
// Realistyczna postawa (skrzyżowane ramiona + zaciśnięte pięści) daje
// wysoki wynik obu znakom naraz - bez rozstrzygnięcia pierścień migałby
// między liderami i żaden nigdy by się nie złożył (retargetowanie zeruje
// postęp przy każdej zmianie celu).
console.log('\nKOLIZJA SPLOT/WELES (remis):');
const kRemis = new SkladaniePieczeci();
const remis1 = kRemis.update({ splot: 0.95, weles: 1.0, perun: 0, swarog: 0 }, 1.0, DT);
spr(`przy remisie blisko maksimum Splot wygrywa (${remis1.skladana})`, remis1.skladana === 'splot');

// Gdy Splot NIE jest blisko maksimum, zwykły najwyższy wynik nadal wygrywa -
// reguła nie ma się aktywować przy przypadkowych, niskich wynikach Splotu.
const kBezRemisu = new SkladaniePieczeci();
const bezRemisu = kBezRemisu.update({ splot: 0.3, weles: 1.0, perun: 0, swarog: 0 }, 1.0, DT);
spr(`gdy Splot nisko, zwykły lider (weles) wygrywa (${bezRemisu.skladana})`, bezRemisu.skladana === 'weles');

// Splot, który JEST liderem, nie potrzebuje reguły remisu - działa jak zawsze.
const kSplotLider = new SkladaniePieczeci();
const splotLider = kSplotLider.update({ splot: 1.0, weles: 0.2, perun: 0, swarog: 0 }, 1.0, DT);
spr(`Splot jako wyraźny lider składa się normalnie (${splotLider.skladana})`, splotLider.skladana === 'splot');

process.exit(ok ? 0 : 1);
