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
    for (let i = 0; i < 60 * 90 && pp.stan !== 'BEZCZYNNY' || i === 0; i++) {
        const f = klatka();
        const pobor = pp.update(f, mm2.moc, DT);
        if (pobor > 0) mm2.zuzyj(pobor);
        klatek++;
        if (klatek > 60 * 90) break;
    }
} catch (e) {
    blad = e.message;
}

spr(`pętla nie wyrzuca wyjątku (${blad ?? 'brak'})`, blad === null);
spr(`moc została zużyta (${mm2.moc.toFixed(3)})`, mm2.moc < 0.05);
spr(`technika zakończyła się po wyczerpaniu mocy (${pp.stan})`, pp.stan === 'BEZCZYNNY');
console.log(`  ognia było ${(klatek * DT).toFixed(1)} s`);
spr('ogień trwał 45-55 s', klatek * DT > 45 && klatek * DT < 55);

// --- MOC MUSI ROSNĄĆ, GDY GRACZ TAŃCZY Z ZAPALONYM OGNIEM ---
//
// Zgłoszone z testu na żywym ciele: "gdy się ruszam z zapalonym płomieniem
// moc nie odnawia się". Przy poborze 1/30 wychodził remis z przyrostem, bo
// ręka wskazująca jest z konieczności nieruchoma i obniża średnią prędkość
// kończyn o połowę. Ten test pilnuje, żeby pobór został POKONYWALNY.
console.log('\nTANIEC Z ZAPALONYM OGNIEM:');

const SLEDZONE = [15, 16, 13, 14, 27, 28];
const NADG_WSKAZUJACY = 16;   // ta ręka trzyma płomień - zostaje nieruchoma

/** Ciało w ruchu, ale z JEDNĄ ręką trzymaną nieruchomo (ta z ogniem). */
function cialoTanczace(t) {
    const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
    for (const i of SLEDZONE) {
        const nieruchoma = i === NADG_WSKAZUJACY || i === 14;
        wl[i] = nieruchoma
            ? { x: 0.25, y: -0.3, z: 0, visibility: 0.9 }
            : { x: 0.4 * Math.sin(2 * Math.PI * 0.8 * t), y: 0, z: 0, visibility: 0.9 };
    }
    return wl;
}

const mm4 = new MotionMeter();
const pp4 = new PlonacyPalec();
mm4.moc = 0.5;
pp4.uzbrój();

let t = 0;
// zapalamy
pp4.update(klatka(), mm4.moc, DT);
spr(`ogień się zapalił (${pp4.stan})`, pp4.stan === 'PLONIE');

const mocPrzed = mm4.moc;
for (let i = 0; i < 60 * 8; i++) {          // 8 s tańca z ogniem
    t += DT;
    const f = klatka();
    f.pose.worldLandmarks = cialoTanczace(t);
    mm4.update(f, 1.0, DT);                  // płynność 1.0 - ruch gładki
    const pobor = pp4.update(f, mm4.moc, DT);
    if (pobor > 0) mm4.zuzyj(pobor);
}
console.log(`  po 8 s tańca z ogniem: ${mocPrzed.toFixed(3)} -> ${mm4.moc.toFixed(3)}`);
spr('moc ROŚNIE w trakcie płonięcia, gdy gracz tańczy', mm4.moc > mocPrzed);
spr(`  ...i ogień nadal płonie (${pp4.stan})`, pp4.stan === 'PLONIE');

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
