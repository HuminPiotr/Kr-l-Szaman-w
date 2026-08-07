/**
 * Trzy postawy ciała: rozdzielność, ciągłość, bramki.
 *
 *   node tools/test-postawy.mjs
 *
 * worldLandmarks: metry, początek w środku bioder, oś Y W DÓŁ.
 * Barki mają y ujemne, dłonie opuszczone poniżej bioder - dodatnie.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { perun } from '../js/znaki/perun.js';

// Sylwetka odniesienia: barki 0.40 m rozstawu, 0.55 m nad biodrami.
// Nadgarstki i łokcie podaje wywołujący - to one niosą gest.
function cialo({ nadgL, nadgP, lokL, lokP, vis = 1 }) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: vis }));
  const p = (x, y) => ({ x, y, z: 0, visibility: vis });
  wl[11] = p(-0.20, -0.55); wl[12] = p(0.20, -0.55);   // barki
  wl[23] = p(-0.12,  0.00); wl[24] = p(0.12,  0.00);   // biodra
  wl[15] = p(nadgL[0], nadgL[1]); wl[16] = p(nadgP[0], nadgP[1]);
  wl[13] = p(lokL[0],  lokL[1]);  wl[14] = p(lokP[0],  lokP[1]);
  return wl;
}

// PERUN: prawa ręka wyprostowana nad głowę, lewa opuszczona wzdłuż ciała.
const POSTAWA_PERUN = cialo({
  nadgP: [0.20, -1.15], lokP: [0.20, -0.85],   // pion, idealnie prosta
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15]
});

const rej = new ZnakRegistry();
rej.zarejestruj(perun);
const ocen = (wl) => rej.ocen({
  hands: [], pose: { landmarks: [], worldLandmarks: wl },
  width: 1920, height: 1080, dt: 1 / 60, now: 0
});

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('PERUN:');
const a = ocen(POSTAWA_PERUN);
spr(`postawa gromu zapala Peruna (${a.perun.toFixed(2)})`, a.perun > 0.9);

// Ręce opuszczone: nic nie jest uniesione, więc Perun milczy.
const b = ocen(cialo({
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15],
  nadgP: [0.22, 0.30],  lokP: [0.21, -0.15]
}));
spr(`ręce opuszczone NIE zapalają Peruna (${b.perun.toFixed(2)})`, b.perun < 0.2);

// LUSTRO: gest jest zdefiniowany symetrycznie - lewa ręka w górze musi
// dać ten sam wynik co prawa. MediaPipe podaje strony względem OBRAZU,
// a płótno ma scaleX(-1), więc stronność nie może nieść znaczenia.
const lustro = ocen(cialo({
  nadgL: [-0.20, -1.15], lokL: [-0.20, -0.85],
  nadgP: [0.22, 0.30],   lokP: [0.21, -0.15]
}));
spr(`lustrzane odbicie daje ten sam wynik (${lustro.perun.toFixed(2)})`,
    Math.abs(lustro.perun - a.perun) < 0.02);

// BRAMKA WIDOCZNOŚCI: punkt poza kadrem to BRAK DANYCH, nie "źle".
// Bez tego śmieciowa geometria potrafi przypadkiem wysoko punktować.
const slabe = ocen(cialo({
  nadgP: [0.20, -1.15], lokP: [0.20, -0.85],
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15], vis: 0.2
}));
spr(`punkty niewidoczne -> 0, nie śmieć (${slabe.perun.toFixed(2)})`, slabe.perun === 0);

// CIĄGŁOŚĆ: podnoszenie ręki ma dawać RAMPĘ, nie skok 0->1.
// Próg należy do pieczecie.js, nie do znaku.
console.log('\nCIĄGŁOŚĆ przy podnoszeniu ręki:');
// Pętla indeksowana, nie po wartości - kumulacja błędu float sprawia,
// że warunek na resztę z dzielenia nigdy nie trafia i wydruk jest pusty.
let poprz = 0, maxSkok = 0;
const poziomy = [];
for (let i = 0; i <= 40; i++) {
  const y = -0.45 - i * 0.02;
  const s = ocen(cialo({
    nadgP: [0.20, y], lokP: [0.20, (-0.55 + y) / 2],
    nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15]
  })).perun;
  maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
  if (i % 8 === 0) poziomy.push(`${y.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

// NaN nie może wyprodukować wyniku innego niż 0.
const zepsute = ocen(cialo({
  nadgP: [NaN, NaN], lokP: [0.20, -0.85],
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15]
}));
spr(`NaN w punkcie -> 0 (${zepsute.perun})`, zepsute.perun === 0);

process.exit(ok ? 0 : 1);
