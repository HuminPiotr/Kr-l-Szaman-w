/**
 * Splot Mokoszy - znak skrzyżowanych ramion, bez dłoni i bez bioder.
 *
 *   node tools/test-splot.mjs
 *
 * Formuła skrzyżowania jest ponownie użyta z js/znaki/weles.js (stara,
 * odpięta postawa ciała) - sprawdzona, odporna na lustro. Jedyna zmiana:
 * wysokość liczona w szerokościach barków od linii barków, nie jako
 * ułamek odcinka bark->biodro - to jest cały powód, dla którego ten znak
 * nie potrzebuje bioder w kadrze.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { splot } from '../js/znaki/mokoszSplot.js';
import { perunDlon } from '../js/znaki/perunDlon.js';
import { welesDlon } from '../js/znaki/welesDlon.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { dlon } from './_dlon-syntetyczna.mjs';

// Sylwetka odniesienia: barki 0.40 m rozstawu. Nadgarstki podaje wywołujący.
// `biodraNaN`: gdy true, biodra są NaN i niewidoczne - dowód, że splot
// działa BEZ nich (ograniczenie globalne #2 tego planu).
function cialo({ nadgL, nadgP, vis = 1, biodraNaN = false }) {
    const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: vis }));
    const p = (x, y) => ({ x, y, z: 0, visibility: vis });
    wl[11] = p(-0.20, -0.55); wl[12] = p(0.20, -0.55);   // barki
    wl[15] = p(nadgL[0], nadgL[1]); wl[16] = p(nadgP[0], nadgP[1]);
    wl[23] = biodraNaN ? { x: NaN, y: NaN, z: 0, visibility: 0 } : p(-0.12, 1.00);
    wl[24] = biodraNaN ? { x: NaN, y: NaN, z: 0, visibility: 0 } : p(0.12, 1.00);
    return wl;
}

const rej = new ZnakRegistry();
rej.zarejestruj(splot);
const ocen = (wl, hands = []) => rej.ocen({
    hands, pose: { landmarks: [], worldLandmarks: wl },
    width: 1920, height: 1080, dt: 1 / 60, now: 0
});

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// Ramiona skrzyżowane na piersi - lewy nadgarstek po prawej stronie tułowia
// (x dodatnie, bo lewy bark ma x ujemne) i odwrotnie.
const POSTAWA_SPLOT = { nadgL: [0.15, -0.35], nadgP: [-0.15, -0.35] };

console.log('SPLOT:');
const a = ocen(cialo(POSTAWA_SPLOT));
spr(`postawa skrzyżowanych ramion zapala Splot (${a.splot.toFixed(2)})`, a.splot > 0.9);

// BEZ BIODER - dowód, że to jest ograniczenie globalne #2, nie przypadek.
const bezBioder = ocen(cialo({ ...POSTAWA_SPLOT, biodraNaN: true }));
spr(`Splot działa BEZ WIDOCZNYCH BIODER (NaN) (${bezBioder.splot.toFixed(2)})`, bezBioder.splot > 0.9);

// Ramiona NIESKRZYŻOWANE (obok siebie, nie na przeciwnych stronach) milczą.
const naWprost = ocen(cialo({ nadgL: [-0.20, -0.30], nadgP: [0.20, -0.30] }));
spr(`ramiona NA WPROST (nieskrzyżowane) NIE zapalają Splotu (${naWprost.splot.toFixed(2)})`, naWprost.splot < 0.2);

// Ramiona skrzyżowane, ale nad głową (za wysoko) - milczy.
const zaWysoko = ocen(cialo({ nadgL: [0.15, -1.20], nadgP: [-0.15, -1.20] }));
spr(`skrzyżowanie NAD GŁOWĄ NIE zapala Splotu (${zaWysoko.splot.toFixed(2)})`, zaWysoko.splot < 0.2);

// Ramiona skrzyżowane, ale przy pasie (za nisko) - milczy.
const zaNisko = ocen(cialo({ nadgL: [0.15, 0.60], nadgP: [-0.15, 0.60] }));
spr(`skrzyżowanie PRZY PASIE (za nisko) NIE zapala Splotu (${zaNisko.splot.toFixed(2)})`, zaNisko.splot < 0.2);

// LUSTRO: odbicie całej sylwetki (x -> -x) daje ten sam wynik.
const odbij = (wl) => wl.map(p => ({ ...p, x: -p.x }));
const lustro = ocen(odbij(cialo(POSTAWA_SPLOT)));
spr(`odbicie lustrzane daje ten sam wynik (${lustro.splot.toFixed(2)})`,
    Math.abs(lustro.splot - a.splot) < 0.02);

// BRAMKA WIDOCZNOŚCI: punkty niepewne to brak danych, nie "źle".
const slabe = ocen(cialo({ ...POSTAWA_SPLOT, vis: 0.2 }));
spr(`punkty niewidoczne -> 0, nie śmieć (${slabe.splot})`, slabe.splot === 0);

// Brak pozy, NaN w nadgarstku - zero, nie wyjątek.
const brakPozy = rej.ocen({ hands: [], pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0 });
spr(`brak pozy -> zero (${brakPozy.splot})`, brakPozy.splot === 0);
const zepsute = ocen(cialo({ nadgL: [NaN, NaN], nadgP: [-0.15, -0.30] }));
spr(`NaN w nadgarstku -> 0 (${zepsute.splot})`, zepsute.splot === 0);

// CIĄGŁOŚĆ: krzyżowanie ramion ma dawać rampę, nie skok 0->1.
console.log('\nCIĄGŁOŚĆ przy krzyżowaniu ramion:');
let poprz = 0, maxSkok = 0;
const poziomy = [];
for (let i = 0; i <= 80; i++) {
    const x = -0.35 + i * 0.005;   // obie ręce jadą naraz (x i -x)
    const s = ocen(cialo({ nadgL: [x, -0.30], nadgP: [-x, -0.30] })).splot;
    maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
    if (i % 16 === 0) poziomy.push(`${x.toFixed(3)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

// --- KOLIZJA MIĘDZY MODALNOŚCIAMI: splot (poza) vs pieczęcie dłoniowe ---
// pieczecie.js wybiera JEDEN najlepszy znak spośród WSZYSTKICH zarejestrowanych
// naraz, więc splot i pieczęcie dłoniowe będą w main.js w TYM SAMYM rejestrze
// oceniane na TEJ SAMEJ klatce - to jest realne ryzyko, nie formalność.
console.log('\nKOLIZJA Z PIECZĘCIAMI DŁONIOWYMI:');
const rejPelny = new ZnakRegistry();
rejPelny.zarejestruj(splot);
rejPelny.zarejestruj(perunDlon);
rejPelny.zarejestruj(welesDlon);
rejPelny.zarejestruj(swarogDlon);
const ocenPelny = (wl, hands) => rejPelny.ocen({
    hands, pose: { landmarks: [], worldLandmarks: wl },
    width: 1920, height: 1080, dt: 1 / 60, now: 0
});

const S = 0.09;
const TYGRYS = [1, 0, 0, 1, 1];
const PIESC = [1, 1, 1, 1, 1];
// Neutralna poza (ręce opuszczone) + dłonie złożone w Tygrysa Peruna.
const nadgrPozaNeutralna = { nadgL: [-0.30, 0.30], nadgP: [0.30, 0.30] };
const tygrysDlonie = [
    { landmarks: dlon({ ox: 0.455, zgiecia: TYGRYS, skala: S }), worldLandmarks: null, handedness: null },
    { landmarks: dlon({ ox: 0.545, zgiecia: TYGRYS, skala: S }), worldLandmarks: null, handedness: null }
];
const podczasPeruna = ocenPelny(cialo(nadgrPozaNeutralna), tygrysDlonie);
spr(`Tygrys Peruna (dłonie) + neutralna poza: Perun odpala (${podczasPeruna.perun.toFixed(2)})`,
    podczasPeruna.perun > 0.6);
spr(`  ...i NIE odpala Splotu (${podczasPeruna.splot.toFixed(2)})`, podczasPeruna.splot < 0.25);

// Splot (poza) + dłonie w spoczynku (pięści, neutralnie) nie odpala pieczęci dłoniowych.
const piescieDlonie = [
    { landmarks: dlon({ ox: 0.47, zgiecia: PIESC, skala: S }), worldLandmarks: null, handedness: null },
    { landmarks: dlon({ ox: 0.53, zgiecia: PIESC, skala: S }), worldLandmarks: null, handedness: null }
];
const podczasSplotu = ocenPelny(cialo(POSTAWA_SPLOT), piescieDlonie);
spr(`Splot (poza) + pięści w spoczynku (dłonie): Splot odpala (${podczasSplotu.splot.toFixed(2)})`,
    podczasSplotu.splot > 0.6);
spr(`  ...i NIE odpala żadnej pieczęci dłoniowej (weles ${podczasSplotu.weles.toFixed(2)}, perun ${podczasSplotu.perun.toFixed(2)}, swarog ${podczasSplotu.swarog.toFixed(2)})`,
    podczasSplotu.weles < 0.25 && podczasSplotu.perun < 0.25 && podczasSplotu.swarog < 0.25);

process.exit(ok ? 0 : 1);
