/**
 * Narzędzia rozpoznawania dłoni (js/znaki/dlon.js).
 *
 *   node tools/test-dlon.mjs
 *
 * Zawiera REFERENCYJNY generator syntetycznej dłoni - łańcuch kinematyczny,
 * z którego korzystać będą testy poszczególnych pieczęci.
 *
 * Pierwsza wersja tego generatora rozkładała punkty promieniście od
 * nadgarstka zamiast łańcuchowo, więc "pięść" w ogóle się nie zwijała
 * i test przechodził przy metryce, która nie odróżniała pięści od dłoni
 * płaskiej. Syntetyczna dłoń musi być prawdziwym łańcuchem stawów.
 *
 * UWAGA: ta dłoń jest wyidealizowana (zgięcie płaskie, równe kąty).
 * Progi PROSTY_MIN / PROSTY_PELNY są ZGADNIĘTE i wymagają potwierdzenia
 * na żywej dłoni z nakładki debug (klawisz D).
 */
import { wzorPalcow, ileWyprostowanych, skalaDloni, skierowanaWGore,
         odlegloscNadgarstkow, rownolegle, pelnaDlon, NAZWY_PALCOW }
  from '../js/znaki/dlon.js';
import { PALCE, NADGARSTEK } from '../js/znaki/dlon.js';

// Dłoń jako PRAWDZIWY ŁAŃCUCH KINEMATYCZNY: każdy staw wychodzi z poprzedniego,
// obrócony o kąt zgięcia. Poprzednia wersja rozkładała punkty promieniście od
// nadgarstka, więc "pięść" w ogóle się nie zwijała i test niczego nie dowodził.
// zgiecie: 0 = palec prosty, 1 = zwinięty (~90 stopni na staw).
function dlon({ ox = 0.5, oy = 0.6, zgiecia = [0,0,0,0,0], skala = 0.1, obrot = 0 } = {}) {
  const lm = Array.from({ length: 21 }, () => ({ x: ox, y: oy, z: 0 }));
  lm[NADGARSTEK] = { x: ox, y: oy, z: 0 };

  NAZWY_PALCOW.forEach((nazwa, fi) => {
    const idx = PALCE[nazwa];
    const bok = (fi - 2) * skala * 0.32;
    // Nasada palca: odsunięta od nadgarstka w górę i w bok
    let x = ox + bok * Math.cos(obrot) - skala * 0.9 * Math.sin(obrot);
    let y = oy + bok * Math.sin(obrot) - skala * 0.9 * Math.cos(obrot);
    lm[idx[0]] = { x, y, z: 0 };

    let kat = -Math.PI / 2 + obrot;          // -90 stopni = w gore (os Y rosnie w dol)
    const dlSegm = skala * 0.42;
    for (let k = 1; k < idx.length; k++) {
      kat += zgiecia[fi] * (Math.PI / 2);    // zgiecie na KAZDYM stawie
      x += Math.cos(kat) * dlSegm;
      y += Math.sin(kat) * dlSegm;
      lm[idx[k]] = { x, y, z: 0 };
    }
  });

  // Nasada srodkowego palca wyznacza skale i kierunek dloni
  lm[9] = { x: ox - skala * Math.sin(obrot), y: oy - skala * Math.cos(obrot), z: 0 };
  return lm;
}

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const plaska = dlon({ zgiecia: [0,0,0,0,0] });
const piesc  = dlon({ zgiecia: [1,1,1,1,1] });
const dwaPalce = dlon({ zgiecia: [1,0,0,1,1] });   // Tygrys: wskazujący+środkowy

console.log('wzór palców (kciuk, wskaz., środk., serd., mały):');
for (const [n, d] of [['płaska', plaska], ['pięść', piesc], ['dwa palce', dwaPalce]]) {
  console.log(`  ${n.padEnd(10)} [${wzorPalcow(d).map(v=>v.toFixed(2)).join(' ')}]  suma ${ileWyprostowanych(d).toFixed(2)}`);
}
console.log();
spr('punkty dłoni są kompletne', pelnaDlon(plaska));
spr(`płaska dłoń: ~5 palców wyprostowanych (${ileWyprostowanych(plaska).toFixed(1)})`, ileWyprostowanych(plaska) > 4.4);
spr(`pięść: ~0 wyprostowanych (${ileWyprostowanych(piesc).toFixed(1)})`, ileWyprostowanych(piesc) < 0.6);
const w = wzorPalcow(dwaPalce);
spr(`Tygrys: wskazujący i środkowy proste (${w[1].toFixed(2)}, ${w[2].toFixed(2)})`, w[1] > 0.8 && w[2] > 0.8);
spr(`Tygrys: kciuk, serdeczny, mały złożone (${w[0].toFixed(2)}, ${w[3].toFixed(2)}, ${w[4].toFixed(2)})`,
    w[0] < 0.3 && w[3] < 0.3 && w[4] < 0.3);
spr(`dłoń skierowana w górę (${skierowanaWGore(plaska).toFixed(2)})`, skierowanaWGore(plaska) > 0.9);

// Wąż (nadgarstki blisko) kontra Koń (nadgarstki rozsunięte)
const waz1 = dlon({ ox: 0.48 }), waz2 = dlon({ ox: 0.52 });
const kon1 = dlon({ ox: 0.40 }), kon2 = dlon({ ox: 0.60 });
const dWaz = odlegloscNadgarstkow(waz1, waz2), dKon = odlegloscNadgarstkow(kon1, kon2);
console.log(`\n  nadgarstki: Wąż ${dWaz.toFixed(2)}  Koń ${dKon.toFixed(2)} skal dłoni`);
spr('Wąż i Koń rozróżnialne odległością nadgarstków', dKon > dWaz * 2);
spr(`dłonie równoległe (${rownolegle(waz1, waz2).toFixed(2)})`, rownolegle(waz1, waz2) > 0.95);

// Odporność
spr('brak punktów -> false, bez wyjątku', pelnaDlon(null) === false);
const zle = Array.from({length:21}, () => ({x:NaN, y:NaN, z:0}));
spr('NaN -> false, bez wyjątku', pelnaDlon(zle) === false);
process.exit(ok ? 0 : 1);
