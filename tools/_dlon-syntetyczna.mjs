/**
 * Referencyjny generator syntetycznej dłoni dla testów pieczęci.
 *
 * Łańcuch kinematyczny: każdy staw wychodzi z poprzedniego, obrócony o kąt
 * zgięcia. Pierwsza wersja rozkładała punkty promieniście od nadgarstka, więc
 * "pięść" w ogóle się nie zwijała i test przechodził przy metryce, która nie
 * odróżniała pięści od dłoni płaskiej. Syntetyczna dłoń MUSI być łańcuchem.
 *
 * Ta dłoń jest wyidealizowana (zgięcie płaskie, równe kąty na stawach).
 * Progi w js/znaki/*.js są ZGADNIĘTE i wymagają potwierdzenia na żywej dłoni
 * z nakładki debug (klawisz D).
 */
import { PALCE, NADGARSTEK, NAZWY_PALCOW } from '../js/znaki/dlon.js';

export // Dłoń jako PRAWDZIWY ŁAŃCUCH KINEMATYCZNY: każdy staw wychodzi z poprzedniego,
// obrócony o kąt zgięcia. Poprzednia wersja rozkładała punkty promieniście od
// nadgarstka, więc "pięść" w ogóle się nie zwijała i test niczego nie dowodził.
// zgiecie: 0 = palec prosty, 1 = zwinięty (~90 stopni na staw).
function dlon({ ox = 0.5, oy = 0.6, zgiecia = [0,0,0,0,0], skala = 0.1, obrot = 0,
                       lustro = false, osLustra = 0.5, wachlarz = 1 } = {}) {
  const lm = Array.from({ length: 21 }, () => ({ x: ox, y: oy, z: 0 }));
  lm[NADGARSTEK] = { x: ox, y: oy, z: 0 };

  NAZWY_PALCOW.forEach((nazwa, fi) => {
    const idx = PALCE[nazwa];
    // wachlarz=1 to dłoń widziana na płasko; ~0 to dłoń z profilu,
    // gdzie palce zachodzą na siebie - tak wygląda namiot pieczęci Konia.
    const bok = (fi - 2) * skala * 0.32 * wachlarz;
    // Nasada palca: odsunięta od nadgarstka w górę i w bok
    // Osie dłoni: "w górę" to (0,-1) obrócone o obrot, czyli (sin, -cos).
    // BŁĄD, który tu był: x używał -sin zamiast +sin, więc nasada palca
    // jechała przy obrocie w przeciwną stronę niż jego czubek. Obie zmiany
    // się kasowały, środek opuszek prawie nie drgał i namiot pieczęci Konia
    // nie dawał się złożyć przy żadnym kącie.
    let x = ox + bok * Math.cos(obrot) + skala * 0.9 * Math.sin(obrot);
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
  lm[9] = { x: ox + skala * Math.sin(obrot), y: oy - skala * Math.cos(obrot), z: 0 };

  // Odbicie lustrzane daje ANATOMICZNIE drugą dłoń, nie obróconą kopię.
  // Namiot (piecz. Konia) to dwie dłonie odbite - przy obrocie sztywnym
  // zbliżanie opuszek zbliżało też nadgarstki i namiot nie dawał się złożyć.
  if (lustro) for (const p of lm) p.x = 2 * osLustra - p.x;
  return lm;
}

/**
 * Ta sama dłoń co dlon(), ale jako worldLandmarks - punkty 3D wyśrodkowane
 * na nadgarstku, z możliwością POCHYLENIA płaszczyzny dłoni w głąb.
 *
 * dlon() buduje łańcuch kinematyczny w płaszczyźnie z=0 (dłoń wprost do
 * kamery). worldDlon() bierze DOKŁADNIE ten sam łańcuch (ox=oy=0, więc
 * wyśrodkowany na nadgarstku) i OBRACA go w 3D:
 *
 *   pochylX - obrót wokół osi poziomej: dłoń pochyla się w przód/tył
 *   pochylY - obrót wokół osi pionowej: dłoń obraca się w bok
 *
 * Bez pochylenia normalna dłoni wskazuje wprost w kamerę (0,0,1) - patrz
 * test w tools/test-dlon.mjs. Potrzebne, żeby przetestować normalnaDloni()
 * bez kamery: bez tej funkcji dlon() zawsze dawałaby z:0 na każdym punkcie,
 * więc normalna byłaby zawsze taka sama i cały kierunek 3D byłby
 * niesprawdzalny testami jednostkowymi.
 */
export function worldDlon({ zgiecia = [0, 0, 0, 0, 0], skala = 0.09, obrot = 0,
                             lustro = false, wachlarz = 1,
                             pochylX = 0, pochylY = 0 } = {}) {
  const lm = dlon({ ox: 0, oy: 0, zgiecia, skala, obrot, lustro, wachlarz });
  const cx = Math.cos(pochylX), sx = Math.sin(pochylX);
  const cy = Math.cos(pochylY), sy = Math.sin(pochylY);
  // lm ma z:0 wszędzie (dlon() jest płaska) - to (x,y) traktujemy jako
  // współrzędne W PŁASZCZYŹNIE dłoni i dopiero tu obracamy do 3D:
  // najpierw wokół osi X (pochylX), potem wynik wokół osi Y (pochylY).
  return lm.map(p => {
    const y1 = p.y * cx, z1 = p.y * sx;
    const x2 = p.x * cy + z1 * sy;
    const z2 = -p.x * sy + z1 * cy;
    return { x: x2, y: y1, z: z2 };
  });
}

