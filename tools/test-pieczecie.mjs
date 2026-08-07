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

process.exit(ok ? 0 : 1);
