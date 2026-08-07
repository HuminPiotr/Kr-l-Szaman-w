/**
 * Styk płonącego palca z MotionMeter - test INTEGRACYJNY.
 *
 *   node tools/test-integracja-ognia.mjs
 *
 * Ten plik istnieje z konkretnego powodu. test-plonacy-palec.mjs zarządzał
 * mocą LOKALNIE (zmienna w teście), więc styk techniki z prawdziwym
 * MotionMeter nigdy nie był wykonany. main.js wołał motionMeter.pobierz() -
 * metody, której nigdy nie było. Wyjątek leciał przed requestAnimationFrame,
 * pętla przestawała się przeplanowywać i CAŁA GRA zamierała w chwili zapalenia
 * ognia. Wszystkie 13 testów przechodziło.
 *
 * Wniosek: test jednostkowy z atrapą zależności nie sprawdza, czy zależność
 * ma taki interfejs, jakiego się od niej oczekuje.
 */
import { PlonacyPalec } from '../js/plonacyPalec.js';
import { MotionMeter } from '../js/motionMeter.js';
import { dlon } from './_dlon-syntetyczna.mjs';
import { BARK_L, BARK_P } from '../js/znaki/postawa.js';

const DT = 1 / 60;
const WSKAZUJE = [1, 0, 1, 1, 1];

function klatka({ oy = 0.25, zgiecia = WSKAZUJE } = {}) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    lm[BARK_L] = { x: 0.42, y: 0.5, z: 0, visibility: 0.9 };
    lm[BARK_P] = { x: 0.58, y: 0.5, z: 0, visibility: 0.9 };
    return {
        hands: [{ landmarks: dlon({ ox: 0.5, oy, zgiecia, skala: 0.09 }),
                  worldLandmarks: lm, handedness: 'Right' }],
        pose: { landmarks: lm, worldLandmarks: lm },
        width: 1920, height: 1080, dt: DT, now: 0
    };
}

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- Interfejs, którego main.js faktycznie używa ---
const mm = new MotionMeter();
spr('MotionMeter ma metodę zuzyj()', typeof mm.zuzyj === 'function');
mm.moc = 1.0;
mm.zuzyj(0.25);
spr(`zuzyj() przyjmuje koszt CZĘŚCIOWY (1.00 - 0.25 = ${mm.moc.toFixed(2)})`,
    Math.abs(mm.moc - 0.75) < 1e-9);
mm.zuzyj(999);
spr(`zuzyj() nie schodzi poniżej zera (${mm.moc.toFixed(2)})`, mm.moc === 0);

// --- Pełna pętla dokładnie jak w main.js ---
console.log('\nPĘTLA JAK W main.js (bez atrap):');
const mm2 = new MotionMeter();
const pp = new PlonacyPalec();
mm2.moc = 1.0;
pp.uzbrój();

let klatek = 0, blad = null;
try {
    for (let i = 0; i < 60 * 40 && pp.stan !== 'BEZCZYNNY' || i === 0; i++) {
        const f = klatka();
        const pobor = pp.update(f, mm2.moc, DT);
        if (pobor > 0) mm2.zuzyj(pobor);
        klatek++;
        if (klatek > 60 * 40) break;
    }
} catch (e) {
    blad = e.message;
}

spr(`pętla nie wyrzuca wyjątku (${blad ?? 'brak'})`, blad === null);
spr(`moc została zużyta (${mm2.moc.toFixed(3)})`, mm2.moc < 0.05);
spr(`technika zakończyła się po wyczerpaniu mocy (${pp.stan})`, pp.stan === 'BEZCZYNNY');
console.log(`  ognia było ${(klatek * DT).toFixed(1)} s`);
spr('ogień trwał 25-35 s', klatek * DT > 25 && klatek * DT < 35);

// --- Moc nie może rosnąć w trakcie płonięcia bez ruchu ---
// (gracz stoi i pali; taniec ma być jedynym źródłem doładowania)
const mm3 = new MotionMeter();
const pp3 = new PlonacyPalec();
mm3.moc = 0.5;
pp3.uzbrój();
const f3 = klatka();
pp3.update(f3, mm3.moc, DT);
const przed = mm3.moc;
for (let i = 0; i < 60; i++) {
    const pobor = pp3.update(f3, mm3.moc, DT);
    if (pobor > 0) mm3.zuzyj(pobor);
}
spr(`po sekundzie płonięcia moc SPADŁA (${przed.toFixed(3)} -> ${mm3.moc.toFixed(3)})`,
    mm3.moc < przed);

process.exit(ok ? 0 : 1);
