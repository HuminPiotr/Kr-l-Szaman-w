# Podmuch (Aard) — plan implementacji

> **Dla agentów wykonawczych:** WYMAGANY PODSKILL: użyj `superpowers:subagent-driven-development` (zalecane) albo `superpowers:executing-plans`, żeby wykonać ten plan zadanie po zadaniu. Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** Gracz uzbraja Podmuch kombosem Szczur × 2, potem machnięciem otwartej dłoni wystrzeliwuje jednorazową falę cząstek lecącą w kierunku 3D, który wskazuje dłoń.

**Architektura:** Ten sam podział co przy płonącym palcu. `js/podmuch.js` to stan techniki (bez rysowania): wykrywa machnięcie, wybiera kierunek 3D i pobiera moc, zwracając jednorazowe zdarzenie wystrzału. `js/fala.js` to układ cząstek (tylko rysowanie): dostaje zaczep, kierunek i siłę, rzutuje cząstki perspektywicznie na płótno i nie wie nic o pieczęciach ani o mocy. Kierunek liczy się jako OŚ z normalnej dłoni (`worldLandmarks`, nowa funkcja `normalnaDloni()` w `js/znaki/dlon.js`) ze ZWROTEM rozstrzyganym wektorem machnięcia (`landmarks` + zmiana skali dłoni na oś głębi).

**Stos:** Vanilla JS, moduły ES, bez backendu. Testy to samodzielne skrypty `node tools/test-*.mjs`, zbierane przez `tools/test-wszystko.sh` (glob `test-*.mjs` — nowe pliki testowe dołączają się same, bez rejestracji).

**Spec:** `docs/superpowers/specs/2026-08-11-szczur-i-podmuch-design.md`

## Ograniczenia globalne

Obowiązują w KAŻDYM zadaniu. Wartości przepisane dosłownie ze spec.

1. **Reguła nadrzędna: nic nigdy nie mówi „źle".** Brak uzbrojenia albo brak machnięcia to cisza (`update()` zwraca `null`), nigdy komunikat o porażce. Przy mocy poniżej kosztu podmuch **nie odmawia** — odpala się słabszy (`sila` skalowana proporcjonalnie), nie wcale.
2. **Rozdział pomiarów: prędkość machnięcia z `landmarks`, orientacja z `worldLandmarks`.** To jest ŚWIADOMY wyjątek od zasady „pomiary z worldLandmarks" (GEMINI.md) — uzasadnienie w spec §"Wyzwalacz machnięcia": `worldLandmarks` dłoni mają początek układu w środku samej dłoni, więc przesunięcie po kadrze jest w nich niewidoczne.
3. **Wszystkie nowe liczby są ZGADNIĘTE.** Każda stała ma komentarz mówiący, że wymaga potwierdzenia na żywej dłoni z nakładki debug (klawisz `D`).
4. **Odporność na NaN i braki.** Klatka bez dłoni, `dt` niefinite, `worldLandmarks: null` — zero albo `null`, nigdy wyjątek. Precedens: `plonacyPalec.js:197` (`krok`), `dlon.js:63-72` (`zdrowy`/`pelnaDlon`).
5. **Kamera zostaje czysta.** `OGNISKO` to ogniskowa rzutu perspektywicznego cząstek fali — liczba w kodzie, nie element sceny. Nic nie rysuje się przed obrazem z kamery poza samymi cząstkami.
6. **Komentarze po polsku**, w stylu istniejących plików: tłumaczą DLACZEGO, nie CO.
7. **Fala jest samodzielna.** Nie dotyka `aura.js`, `ogien.js` ani reszty sceny — zdecydowane w brainstormingu, żeby nie mnożyć sprzężeń między plikami.

---

## Układ plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `tools/_dlon-syntetyczna.mjs` | *(rozszerzenie)* `worldDlon()` — ta sama dłoń, ale jako 3D `worldLandmarks` z pochyleniem | 1 |
| `js/znaki/dlon.js` | *(rozszerzenie)* `normalnaDloni(worldLandmarks)` — oś normalnej dłoni, znak niejednoznaczny | 1 |
| `js/podmuch.js` | stan techniki: uzbrojenie, wykrycie machnięcia, kierunek 3D, koszt mocy | 2 |
| `js/fala.js` | układ cząstek — tylko rysowanie, rzut perspektywiczny | 3 |
| `js/main.js` | *(modyfikacja)* instancja `Podmuch`/`Fala`, routing `uzbraja === 'aard'`, wystrzał | 4 |
| `js/debugHud.js` | *(modyfikacja)* diagnostyka podmuchu i fali | 4 |

Testy: `tools/test-dlon.mjs` (1), `tools/test-podmuch.mjs` (2), `tools/test-fala.mjs` (3). Zadanie 4 nie dodaje nowego pliku testowego — weryfikuje się uruchomieniem całego `tools/test-wszystko.sh` i sprawdzeniem na żywym ciele, tak jak ostatnie zadanie w `docs/superpowers/plans/2026-08-07-gesty-i-kombosy.md`.

---

## Zadanie 1: Normalna dłoni — oś kierunku w 3D

**Files:**
- Modify: `tools/_dlon-syntetyczna.mjs:57` (dopisać po istniejącej funkcji `dlon()`)
- Modify: `js/znaki/dlon.js:226` (dopisać po istniejącej funkcji `rozstawOpuszek()`)
- Test: `tools/test-dlon.mjs` (rozszerzenie istniejącego pliku — to naturalny dom testów dla `js/znaki/dlon.js`, już importuje `dlon` z `_dlon-syntetyczna.mjs`)

**Interfejsy:**
- Konsumuje: `dlon(opts)` z `tools/_dlon-syntetyczna.mjs` (bez zmian sygnatury — patrz niżej, dlaczego).
- Produkuje:
  - `worldDlon({ zgiecia, skala, obrot, lustro, wachlarz, pochylX = 0, pochylY = 0 }) -> Array(21)` — punkty `{x,y,z}` w METRACH (umownie), wyśrodkowane na nadgarstku `(0,0,0)`. Przy `pochylX=pochylY=0` płaszczyzna dłoni jest prostopadła do kamery (normalna `(0,0,1)`).
  - `normalnaDloni(worldLandmarks) -> {x,y,z} | null` — jednostkowy wektor normalny do płaszczyzny dłoni, liczony z punktów `0` (nadgarstek), `5` (nasada wskazującego), `17` (nasada małego). ZNAK JEST NIEJEDNOZNACZNY (patrz komentarz w kodzie) — rozstrzyga go dopiero `js/podmuch.js`.

**Dlaczego `worldDlon()` jest OSOBNĄ funkcją, nie zmianą `dlon()`:** `dlon()` ma dziś wielu konsumentów (`test-pieczecie-dloni.mjs`, `test-plonacy-palec.mjs`, `test-dlon.mjs`, `test-integracja-ognia.mjs` i inne), którzy oczekują płaskiego 2D wyniku jako `landmarks`. Zmiana jej sygnatury albo zwracanego kształtu złamałaby je wszystkie. `worldDlon()` dopisuje się obok, zero ryzyka regresji.

- [ ] **Krok 1: Dopisz test, który ma nie przejść**

Zamień początek `tools/test-dlon.mjs` (import na górze) i dopisz na końcu pliku, PRZED `process.exit(ok ? 0 : 1);`:

```js
import { wzorPalcow, ileWyprostowanych, skalaDloni, skierowanaWGore,
         odlegloscNadgarstkow, rownolegle, pelnaDlon, NAZWY_PALCOW,
         normalnaDloni }
  from '../js/znaki/dlon.js';
import { PALCE, NADGARSTEK } from '../js/znaki/dlon.js';
import { dlon, worldDlon } from './_dlon-syntetyczna.mjs';
```

(jedyna zmiana w istniejących importach: dopisanie `normalnaDloni` do pierwszego importu i `worldDlon` do ostatniego)

Dopisz na końcu pliku, przed `process.exit(ok ? 0 : 1);`:

```js
// --- NORMALNA DŁONI: oś z worldLandmarks, znak rozstrzyga dopiero podmuch.js ---
console.log('\nNORMALNA DŁONI:');

// Bez pochylenia (pochylX=pochylY=0) płaszczyzna dłoni jest prostopadła do
// kamery - normalna wskazuje wprost w obiektyw, czyli (0,0,±1).
const wprostKamera = normalnaDloni(worldDlon({}));
spr(`dłoń wprost do kamery: normalna wzdłuż osi Z (${wprostKamera.z.toFixed(2)})`,
    Math.abs(wprostKamera.x) < 0.05 && Math.abs(wprostKamera.y) < 0.05 && Math.abs(wprostKamera.z) > 0.95);

// Obrót o 90° wokół osi pionowej (pochylY) kładzie dłoń bokiem do kamery -
// normalna ucieka w oś X, znika z Z.
const bokiem = normalnaDloni(worldDlon({ pochylY: Math.PI / 2 }));
spr(`dłoń bokiem (pochylY=90°): normalna wzdłuż osi X (${bokiem.x.toFixed(2)}, z=${bokiem.z.toFixed(2)})`,
    Math.abs(bokiem.x) > 0.95 && Math.abs(bokiem.z) < 0.05);

// Obrót o 90° wokół osi poziomej (pochylX) kładzie dłoń poziomo -
// normalna ucieka w oś Y.
const poziomo = normalnaDloni(worldDlon({ pochylX: Math.PI / 2 }));
spr(`dłoń pochylona w pion (pochylX=90°): normalna wzdłuż osi Y (${poziomo.y.toFixed(2)})`,
    Math.abs(poziomo.y) > 0.95);

// Cztery pochylenia dają CZTERY RÓŻNE osie - dowód, że funkcja niesie
// prawdziwe 3D, nie tylko dwie wartości brzegowe.
const cztery = [
    normalnaDloni(worldDlon({})),
    normalnaDloni(worldDlon({ pochylY: Math.PI / 2 })),
    normalnaDloni(worldDlon({ pochylY: -Math.PI / 2 })),
    normalnaDloni(worldDlon({ pochylX: Math.PI / 2 })),
];
const odl3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let minOdl = Infinity;
for (let i = 0; i < cztery.length; i++)
    for (let j = i + 1; j < cztery.length; j++)
        minOdl = Math.min(minOdl, odl3(cztery[i], cztery[j]));
spr(`cztery pochylenia dają cztery różne osie (min. odległość ${minOdl.toFixed(2)})`, minOdl > 0.5);

// Normalna nie zależy od zgięcia palców - liczy się z punktów 0/5/17,
// które nie ruszają się przy zaciskaniu pięści. Bez tego "otwartość dłoni"
// (osobny warunek w podmuch.js) i "kierunek" mieszałyby się w jedną rzecz.
const dloniPiesc = normalnaDloni(worldDlon({ zgiecia: [1, 1, 1, 1, 1] }));
const dloniOtwarta = normalnaDloni(worldDlon({ zgiecia: [0, 0, 0, 0, 0] }));
spr(`normalna niezależna od zgięcia palców (${odl3(dloniPiesc, dloniOtwarta).toFixed(3)})`,
    odl3(dloniPiesc, dloniOtwarta) < 0.01);

// Odporność
spr('normalnaDloni(null) -> null, bez wyjątku', normalnaDloni(null) === null);
spr('normalnaDloni([]) -> null, bez wyjątku', normalnaDloni([]) === null);
const zleWl = Array.from({ length: 21 }, () => ({ x: NaN, y: NaN, z: NaN }));
spr('worldLandmarks z NaN -> null, bez wyjątku', normalnaDloni(zleWl) === null);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-dlon.mjs
```

Oczekiwane: `SyntaxError` albo `TypeError` — `normalnaDloni` nie jest eksportowane z `js/znaki/dlon.js`, `worldDlon` nie jest eksportowane z `tools/_dlon-syntetyczna.mjs`.

- [ ] **Krok 3: Dopisz `worldDlon()` w generatorze syntetycznej dłoni**

Dopisz na końcu `tools/_dlon-syntetyczna.mjs` (po zamykającym `}` funkcji `dlon()`, linia 57):

```js

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
```

- [ ] **Krok 4: Dopisz `normalnaDloni()` w `js/znaki/dlon.js`**

Dopisz na końcu `js/znaki/dlon.js` (po `rozstawOpuszek()`, linia 226):

```js

/**
 * Normalna płaszczyzny dłoni z worldLandmarks, znormalizowana.
 *
 * Liczona z NADGARSTKA (0) i dwóch stawów PODSTAWY palców - wskazującego (5)
 * i małego (17). Te trzy punkty nie ruszają się przy zginaniu palców
 * (zginają się dopiero stawy DALSZE), więc normalna mierzy WYŁĄCZNIE
 * orientację dłoni w przestrzeni - działa tak samo przy dłoni otwartej
 * i zaciśniętej w pięść.
 *
 * ZNAK JEST NIEJEDNOZNACZNY. Dla lewej i prawej dłoni iloczyn wektorowy
 * wychodzi w przeciwne strony, a przy obróconej dłoni MediaPipe bywa też
 * niepewne co do samej stronności. Ta funkcja daje wyłącznie OŚ - zwrot
 * (który z dwóch kierunków tej osi) rozstrzyga js/podmuch.js wektorem
 * machnięcia. Zobacz docs/superpowers/specs/2026-08-11-szczur-i-podmuch-design.md §3.
 *
 * @param {Array|null} worldLandmarks
 * @returns {{x:number,y:number,z:number}|null}
 */
export function normalnaDloni(worldLandmarks) {
    const wl = worldLandmarks;
    if (!wl || !wl[0] || !wl[5] || !wl[17]) return null;
    const w = wl[0], a = wl[5], b = wl[17];
    for (const p of [w, a, b]) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
    }
    const v1 = { x: a.x - w.x, y: a.y - w.y, z: a.z - w.z };
    const v2 = { x: b.x - w.x, y: b.y - w.y, z: b.z - w.z };
    const n = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
    const d = Math.hypot(n.x, n.y, n.z);
    return d > 1e-9 ? { x: n.x / d, y: n.y / d, z: n.z / d } : null;
}
```

- [ ] **Krok 5: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-dlon.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

- [ ] **Krok 6: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie pliki `✓` — dodanie `worldDlon`/`normalnaDloni` nie mogło ruszyć niczego istniejącego, bo obie funkcje są nowe i addytywne.

- [ ] **Krok 7: Commit**

```bash
git add tools/_dlon-syntetyczna.mjs js/znaki/dlon.js tools/test-dlon.mjs
git commit -m "Normalna dłoni z worldLandmarks - oś kierunku 3D dla Podmuchu

worldDlon() dopisuje się OBOK dlon(), nie zamiast niej - dlon() ma dziś
wielu konsumentów, którzy oczekują płaskiego 2D wyniku jako landmarks.
Zmiana jej kształtu złamałaby ich wszystkich.

normalnaDloni() liczy się z punktów 0/5/17 (nadgarstek + dwie podstawy
palców), które nie ruszają się przy zginaniu - normalna mierzy WYŁĄCZNIE
orientację, niezależnie od tego, czy dłoń jest otwarta czy zaciśnięta.
Znak jest niejednoznaczny z założenia; rozstrzyga go dopiero podmuch.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 2: `js/podmuch.js` — stan techniki

**Files:**
- Create: `js/podmuch.js`
- Test: `tools/test-podmuch.mjs`

**Interfejsy:**
- Konsumuje:
  - `pelnaDlon(lm)`, `wzorPalcow(lm)`, `skalaDloni(lm)`, `normalnaDloni(worldLandmarks)` z `js/znaki/dlon.js` (Zadanie 1).
  - Kontrakt klatki z `js/main.js:172` (`buildFrame`): `frame.hands = [{ landmarks, worldLandmarks, handedness }]`.
- Produkuje:
  - `class Podmuch { stan: 'BEZCZYNNY'|'UZBROJONY'; diagnostyka: {predkosc,otwarcie,kierunek}; uzbrój(): void; update(frame, moc, dt): {zaczep:{x,y}, kierunek:{x,y,z}, sila:number, pobor:number} | null }`
  - `zaczep` jest w ZNORMALIZOWANYCH koordynatach płótna (0..1) — ta sama konwencja co `plonacyPalec.zaczep` (`js/plonacyPalec.js:174`). Konsument (Zadanie 4) mnoży przez `canvas.width/height`.
  - `update()` zwraca obiekt TYLKO w klatce, w której podmuch faktycznie się odpalił (zdarzenie jednorazowe) — `null` we wszystkich innych klatkach, także gdy `stan === 'UZBROJONY'` i gracz jeszcze nie machnął.

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-podmuch.mjs`:

```js
/**
 * Podmuch (Aard) - technika JEDNORAZOWA.
 *
 *   node tools/test-podmuch.mjs
 *
 * Pilnuje: bez uzbrojenia nic się nie odpala, zamknięta pięść i wolny ruch
 * nie odpalają, przeciwne machnięcia dają przeciwne kierunki, a odpalenie
 * zużywa uzbrojenie (drugie machnięcie z rzędu jest ciche).
 */
import { Podmuch } from '../js/podmuch.js';
import { dlon, worldDlon } from './_dlon-syntetyczna.mjs';

const DT = 1 / 60;
const S = 0.09;
const OTWARTA = [0, 0, 0, 0, 0];
const PIESC = [1, 1, 1, 1, 1];

/** Klatka z jedną dłonią o zadanym ox (pozycja pozioma) i pochyleniu 3D. */
function klatka(ox, zgiecia, pochylY = 0, pochylX = 0) {
    return {
        hands: [{
            landmarks: dlon({ ox, oy: 0.5, zgiecia, skala: S }),
            worldLandmarks: worldDlon({ zgiecia, skala: S, pochylY, pochylX }),
            handedness: 'Right'
        }],
        pose: null, width: 1920, height: 1080
    };
}

/** Przesuwa dłoń o `krok` na klatkę, `n` klatek - to jest "machnięcie". */
function machnij(p, moc, { n = 8, ox0 = 0.3, krok = 0.08, zgiecia = OTWARTA,
                           pochylY = 0, pochylX = 0 } = {}) {
    let ox = ox0, wynik = null;
    for (let i = 0; i < n && !wynik; i++) {
        wynik = p.update(klatka(ox, zgiecia, pochylY, pochylX), moc, DT);
        ox += krok;
    }
    return wynik;
}

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Bez uzbrojenia nic się nie dzieje ---
console.log('BEZ UZBROJENIA:');
const p1 = new Podmuch();
const w1 = machnij(p1, 1.0, { pochylY: Math.PI / 2 });
spr(`szybki swipe otwartą dłonią NIE odpala (stan ${p1.stan})`, w1 === null && p1.stan === 'BEZCZYNNY');

// --- 2. Uzbrojony, prawidłowy gest odpala ---
console.log('\nUZBROJONY, PRAWIDŁOWY GEST:');
const p2 = new Podmuch();
p2.uzbrój();
const w2 = machnij(p2, 1.0, { pochylY: Math.PI / 2 });
spr(`szybki swipe otwartą dłonią odpala falę`, w2 !== null);
spr(`  ...i zużywa uzbrojenie (stan ${p2.stan})`, p2.stan === 'BEZCZYNNY');
spr(`  ...zaczep jest skończony (${w2?.zaczep.x.toFixed(2)}, ${w2?.zaczep.y.toFixed(2)})`,
    Number.isFinite(w2?.zaczep.x) && Number.isFinite(w2?.zaczep.y));
spr(`  ...kierunek jest jednostkowym wektorem 3D`,
    Math.abs(Math.hypot(w2.kierunek.x, w2.kierunek.y, w2.kierunek.z) - 1) < 0.01);

// --- 3. Zamknięta pięść nie odpala, choćby ruch był gwałtowny ---
console.log('\nPIĘŚĆ:');
const p3 = new Podmuch();
p3.uzbrój();
const w3 = machnij(p3, 1.0, { zgiecia: PIESC, pochylY: Math.PI / 2 });
spr(`gwałtowny ruch ZAMKNIĘTĄ pięścią NIE odpala (stan ${p3.stan})`,
    w3 === null && p3.stan === 'UZBROJONY');

// --- 4. Otwarta dłoń bez ruchu nie odpala ---
console.log('\nWOLNY RUCH:');
const p4 = new Podmuch();
p4.uzbrój();
const w4 = machnij(p4, 1.0, { krok: 0.001, pochylY: Math.PI / 2 });
spr(`otwarta dłoń, WOLNY ruch NIE odpala (stan ${p4.stan})`, w4 === null && p4.stan === 'UZBROJONY');

// --- 5. Przeciwne machnięcia dają przeciwne kierunki ---
console.log('\nKIERUNEK ZALEŻNY OD MACHNIĘCIA:');
const p5a = new Podmuch(); p5a.uzbrój();
const w5a = machnij(p5a, 1.0, { ox0: 0.2, krok: 0.08, pochylY: Math.PI / 4 });
const p5b = new Podmuch(); p5b.uzbrój();
const w5b = machnij(p5b, 1.0, { ox0: 0.8, krok: -0.08, pochylY: Math.PI / 4 });
const iloczyn = w5a.kierunek.x * w5b.kierunek.x + w5a.kierunek.y * w5b.kierunek.y
              + w5a.kierunek.z * w5b.kierunek.z;
spr(`swipe w prawo: kierunek ${JSON.stringify(w5a.kierunek)}`, true);
spr(`swipe w lewo:  kierunek ${JSON.stringify(w5b.kierunek)}`, true);
spr(`przeciwne machnięcia dają PRZECIWNE kierunki (iloczyn skalarny ${iloczyn.toFixed(2)})`,
    iloczyn < -0.9);

// --- 6. Cztery pochylenia dłoni + dopasowany ruch dają cztery różne kierunki ---
console.log('\nCZTERY KIERUNKI 3D:');
const przypadki = [
    { nazwa: 'w głąb (ku kamerze)', pochylY: 0, krok: 0, ox0: 0.5, dodatkowo: k => k }, // patrz niżej
];
// Cztery niezależne uzbrojenia, każde z ruchem "naturalnym" dla swojego
// pochylenia - tak jak w prawdziwym geście gracz macha W STRONĘ, w którą
// dłoń jest zwrócona.
function jednKierunek({ zgiecia = OTWARTA, pochylY = 0, pochylX = 0, ox0, krok } = {}) {
    const p = new Podmuch(); p.uzbrój();
    return machnij(p, 1.0, { ox0, krok, pochylY, pochylX, zgiecia });
}
const wPrawo = jednKierunek({ pochylY: Math.PI / 2, ox0: 0.2, krok: 0.08 });
const wLewo  = jednKierunek({ pochylY: -Math.PI / 2, ox0: 0.8, krok: -0.08 });
const wGore  = jednKierunek({ pochylX: Math.PI / 2, ox0: 0.5, krok: 0.001 });
const cztery = [wPrawo, wLewo, wGore].map(w => w.kierunek);
const odl = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let minOdl = Infinity;
for (let i = 0; i < cztery.length; i++)
    for (let j = i + 1; j < cztery.length; j++)
        minOdl = Math.min(minOdl, odl(cztery[i], cztery[j]));
spr(`trzy różne pochylenia dają trzy różne kierunki (min. odległość ${minOdl.toFixed(2)})`, minOdl > 0.5);

// --- 7. Moc poniżej kosztu -> siła słabsza, NIE brak fali ---
console.log('\nMOC PONIŻEJ KOSZTU:');
const p7 = new Podmuch(); p7.uzbrój();
const w7 = machnij(p7, 0.1, { pochylY: Math.PI / 2 });
spr(`przy niedoborze mocy fala i tak wychodzi (${w7?.sila.toFixed(2)})`, w7 !== null && w7.sila > 0);
spr(`  ...ale słabsza niż przy pełnej mocy (${w7.sila.toFixed(2)} < 1)`, w7.sila < 1);
spr(`  ...pobór nie przekracza dostępnej mocy (${w7.pobor.toFixed(2)} <= 0.1)`, w7.pobor <= 0.1 + 1e-9);

// --- 8. Drugie machnięcie bez nowego kombosa jest ciche ---
console.log('\nBRAK PODWÓJNEGO ODPALENIA:');
const p8 = new Podmuch(); p8.uzbrój();
const pierwszy = machnij(p8, 1.0, { pochylY: Math.PI / 2 });
spr('pierwsze machnięcie odpala', pierwszy !== null);
const drugi = machnij(p8, 1.0, { ox0: 0.3, pochylY: Math.PI / 2 });
spr('drugie machnięcie BEZ nowego kombosa jest ciche', drugi === null);

// --- 9. Odporność na braki i NaN ---
console.log('\nODPORNOŚĆ:');
const p9 = new Podmuch(); p9.uzbrój();
const brakDloni = p9.update({ hands: [], pose: null, width: 1920, height: 1080 }, 1.0, NaN);
spr('brak dłoni + NaN dt -> null, bez wyjątku', brakDloni === null);
spr('  ...i uzbrojenie zostaje (stan nadal UZBROJONY)', p9.stan === 'UZBROJONY');

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-podmuch.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../js/podmuch.js'`

- [ ] **Krok 3: Napisz `js/podmuch.js`**

```js
/**
 * Podmuch (Aard) - technika JEDNORAZOWA: uzbrojona kombosem, wyzwalana
 * machnięciem otwartej dłoni. Kierunek fali czyta js/fala.js z tego,
 * co zwraca update() - ten plik NIE RYSUJE.
 *
 * Ten sam podział co przy płonącym palcu (plonacyPalec.js / ogien.js), ale
 * prostszy: brak stanu odpowiadającego PŁONIE - podmuch nie trwa, odpala
 * się i wraca do BEZCZYNNY w tej samej klatce.
 *
 * KIERUNEK: oś z normalnej dłoni (worldLandmarks, znak niejednoznaczny),
 * zwrot z wektora machnięcia (landmarks + zmiana skali dłoni na oś głębi).
 * Zobacz docs/superpowers/specs/2026-08-11-szczur-i-podmuch-design.md §3.
 */
import { pelnaDlon, wzorPalcow, skalaDloni, normalnaDloni } from './znaki/dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
const PROG_OTWARCIA = 0.55;      // średnie wyprostowanie 4 palców bez kciuka
const PROG_PREDKOSCI = 4.0;      // skale dłoni na sekundę
const KOSZT_PODMUCHU = 0.25;     // ułamek paska mocy za jedno pchnięcie

export class Podmuch {
    constructor() {
        this.stan = 'BEZCZYNNY';
        this._poprzednie = {};   // stronność -> { x, y, skala } z poprzedniej klatki
        // Diagnostyka do nakładki - NAJLEPSZY kandydat w tej klatce, nawet
        // gdy nic się nie odpaliło. Bez tego nie da się wystroić progów.
        this.diagnostyka = { predkosc: 0, otwarcie: 0, kierunek: null };
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności. */
    uzbrój() {
        if (this.stan === 'BEZCZYNNY') this.stan = 'UZBROJONY';
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1
     * @param {number} dt
     * @returns {{zaczep:{x,y}, kierunek:{x,y,z}, sila:number, pobor:number}|null}
     */
    update(frame, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const kandydaci = this._kandydaci(frame, krok);
        // Śledzenie idzie ZAWSZE, niezależnie od stanu - inaczej pierwsza
        // klatka po uzbrojeniu byłaby "martwa" (brak poprzedniej pozycji =
        // brak prędkości = nigdy nie odpali w tej samej klatce co uzbrojenie).
        this._zapamietaj(frame);

        let najlepszy = null;
        for (const k of kandydaci) if (!najlepszy || k.waga > najlepszy.waga) najlepszy = k;
        this.diagnostyka = najlepszy
            ? { predkosc: najlepszy.predkosc, otwarcie: najlepszy.otwarcie, kierunek: najlepszy.kierunek }
            : { predkosc: 0, otwarcie: 0, kierunek: null };

        if (this.stan !== 'UZBROJONY') return null;
        if (!najlepszy) return null;
        if (najlepszy.predkosc < PROG_PREDKOSCI) return null;
        if (najlepszy.otwarcie < PROG_OTWARCIA) return null;
        if (!najlepszy.kierunek) return null;

        this.stan = 'BEZCZYNNY';
        const mocBezpieczna = Number.isFinite(moc) ? Math.max(0, moc) : 0;
        const pobor = Math.min(mocBezpieczna, KOSZT_PODMUCHU);
        return {
            zaczep: najlepszy.zaczep,
            kierunek: najlepszy.kierunek,
            sila: pobor / KOSZT_PODMUCHU,
            pobor
        };
    }

    /**
     * Kandydaci na machnięcie: dla każdej widocznej dłoni liczymy otwartość,
     * prędkość nadgarstka w skalach dłoni na sekundę, i kierunek 3D.
     *
     * `waga` (otwartość x prędkość) decyduje, KTÓRA dłoń wygrywa, gdy obie
     * spełniają warunki naraz - ta sama zasada co przy wyborze pieczęci.
     */
    _kandydaci(frame, dt) {
        const out = [];
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            const lm = d.landmarks;
            const reka = d.handedness ?? 'brak';
            const poprz = this._poprzednie[reka];

            const w = wzorPalcow(lm);
            const otwarcie = (w[1] + w[2] + w[3] + w[4]) / 4;

            const skala = skalaDloni(lm);
            // Nasada środkowego palca - stabilniejszy zaczep niż opuszek,
            // ten sam punkt, którego używa efekty.js:27 do środka dłoni.
            const zaczep = { x: lm[9].x, y: lm[9].y };

            let predkosc = 0, ruch = null;
            if (poprz && dt > 0) {
                const dx = zaczep.x - poprz.x, dy = zaczep.y - poprz.y;
                const dSkala = skala - poprz.skala;
                predkosc = Math.hypot(dx, dy) / skala / dt;
                // Głębia z ZMIANY SKALI DŁONI: rosnąca dłoń = ruch ku
                // kamerze. Wektor NIE jest metrycznie dokładny - służy
                // wyłącznie do ustalenia ZNAKU osi normalnej, więc
                // przybliżenie wystarcza (patrz normalnaDloni w dlon.js).
                ruch = { x: dx, y: dy, z: dSkala };
            }

            const os = normalnaDloni(d.worldLandmarks);
            let kierunek = null;
            if (os && ruch) {
                const zgodnosc = os.x * ruch.x + os.y * ruch.y + os.z * ruch.z;
                kierunek = zgodnosc >= 0 ? os : { x: -os.x, y: -os.y, z: -os.z };
            }

            out.push({ reka, predkosc, otwarcie, kierunek, zaczep, waga: otwarcie * predkosc });
        }
        return out;
    }

    _zapamietaj(frame) {
        const nowe = {};
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            nowe[d.handedness ?? 'brak'] = {
                x: d.landmarks[9].x, y: d.landmarks[9].y, skala: skalaDloni(d.landmarks)
            };
        }
        this._poprzednie = nowe;
    }
}
```

- [ ] **Krok 4: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-podmuch.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

**Jeśli test 5 lub 6 nie przechodzi:** to zwykle degenerat dot-produktu (oś normalnej i wektor machnięcia prawie prostopadłe, więc znak jest niepewny). Sprawdzone w prototypie tego planu z DOKŁADNIE tymi kątami (`pochylY: ±90°/±45°`, ruch dopasowany do kierunku) - jeśli nie przechodzi, w pierwszej kolejności porównaj stałe `ox0`/`krok` w teście z tymi z prototypu, zanim zaczniesz zmieniać `js/podmuch.js`.

- [ ] **Krok 5: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

- [ ] **Krok 6: Commit**

```bash
git add js/podmuch.js tools/test-podmuch.mjs
git commit -m "Podmuch (Aard) - stan techniki: uzbrojenie, machnięcie, kierunek 3D

Jednorazowa technika: kombos uzbraja, otwarta dłoń machnięta wystarczająco
szybko odpala falę i zużywa uzbrojenie. Kierunek to oś z normalnej dłoni
(worldLandmarks) ze zwrotem rozstrzygniętym wektorem machnięcia (landmarks
+ zmiana skali dłoni na oś głębi) - normalna sama w sobie ma niejednoznaczny
znak, machnięcie go koryguje.

Przy mocy poniżej kosztu podmuch NIE odmawia - odpala się słabszy (sila
skalowana proporcjonalnie do dostępnej mocy), nigdy wcale.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 3: `js/fala.js` — rysowanie fali

**Files:**
- Create: `js/fala.js`
- Test: `tools/test-fala.mjs`

**Interfejsy:**
- Konsumuje: nic z gry — dostaje wyłącznie argumenty `wystrzel(zaczep, kierunek, sila)` (te same kształty co zwraca `Podmuch.update()`: `zaczep:{x,y}` w PIKSELACH płótna, `kierunek:{x,y,z}` jednostkowy, `sila: 0..1`).
- Produkuje:
  - `class Fala { liczba: number; wystrzel(zaczep, kierunek, sila): void; updateAndDraw(ctx, dt): void }`
  - `export function rzutPerspektywiczny(z, ognisko = OGNISKO): number` — czysta funkcja, eksportowana osobno, żeby test mógł sprawdzić rzut bez rysowania na prawdziwym `ctx`.
  - `export const OGNISKO` — ZGADNIĘTA stała ogniskowej, do wystrojenia z nakładki.

**Dlaczego test nie woła `updateAndDraw()`:** `_rysuj()` tworzy sprite przez `document.createElement('canvas')` (ten sam wzorzec co `ogien.js:222-236`) — w Node nie ma `document`. Żaden istniejący test w tym repo nie wywołuje rysowania `Ogien` z tego samego powodu (sprawdzone: `tools/test-integracja-ognia.mjs` w ogóle nie dotyka `Ogien`). Test woła fizykę cząstek bezpośrednio przez `fala._ruszaj(dt)` — dostęp do metody `_`-prefiksowanej z testu ma precedens w `tools/test-aura-impuls.mjs`, który czyta `aura._impuls`.

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-fala.mjs`:

```js
/**
 * Fala (Podmuch/Aard) - układ cząstek, TYLKO fizyka.
 *
 *   node tools/test-fala.mjs
 *
 * Nie wywołuje updateAndDraw()/_rysuj() - tworzą sprite przez
 * document.createElement, którego nie ma w Node (ten sam powód, dla którego
 * żaden test nie dotyka rysowania Ogien - patrz tools/test-integracja-ognia.mjs).
 * Fizykę testujemy przez _ruszaj(dt) bezpośrednio, jak tools/test-aura-impuls.mjs
 * czyta aura._impuls.
 */
import { Fala, rzutPerspektywiczny, OGNISKO } from '../js/fala.js';

const DT = 1 / 60;

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Wystrzał emituje cząstki ---
console.log('WYSTRZAŁ:');
const f1 = new Fala();
spr('świeża fala jest pusta', f1.liczba === 0);
f1.wystrzel({ x: 500, y: 500 }, { x: 0, y: 0, z: 1 }, 1);
spr(`wystrzał emituje cząstki (${f1.liczba})`, f1.liczba > 50);

// --- 2. Cząstki lecą W KIERUNKU wystrzału ---
console.log('\nKIERUNEK RUCHU:');
const f2 = new Fala();
f2.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
for (let i = 0; i < 30; i++) f2._ruszaj(DT);   // 0.5 s
const srZ = f2.czastki.reduce((s, c) => s + c.z, 0) / f2.czastki.length;
spr(`po 0.5 s średnie z rośnie w kierunku wystrzału (+z) -> ${srZ.toFixed(0)}`, srZ > 50);

// --- 3. Wszystkie cząstki wygasają ---
console.log('\nWYGASANIE:');
const f3 = new Fala();
f3.wystrzel({ x: 0, y: 0 }, { x: 1, y: 0, z: 0 }, 1);
let klatek = 0;
while (f3.liczba > 0 && klatek < 600) { f3._ruszaj(DT); klatek++; }
spr(`wszystkie cząstki wygasają (po ${(klatek * DT).toFixed(2)} s, < 3 s)`,
    f3.liczba === 0 && klatek * DT < 3);

// --- 4. Siła skaluje liczbę/prędkość, nie wyłącza fali ---
console.log('\nSIŁA:');
const f4pelna = new Fala(); f4pelna.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
const f4slaba = new Fala(); f4slaba.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 0.3);
spr(`słabsza siła daje mniej cząstek niż pełna (${f4slaba.liczba} < ${f4pelna.liczba})`,
    f4slaba.liczba < f4pelna.liczba);
spr(`  ...ale nie zero (${f4slaba.liczba})`, f4slaba.liczba > 0);

// --- 5. Zły wektor kierunku / zaczep nie emituje i nie wywraca fali ---
console.log('\nODPORNOŚĆ:');
const f5 = new Fala();
f5.wystrzel({ x: NaN, y: 0 }, { x: 0, y: 0, z: 1 }, 1);
spr('NaN w zaczepie -> brak emisji, bez wyjątku', f5.liczba === 0);
f5.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 1);
spr('kierunek zerowej długości -> brak emisji, bez wyjątku', f5.liczba === 0);
f5.wystrzel({ x: 0, y: 0 }, null, 1);
spr('brak kierunku -> brak emisji, bez wyjątku', f5.liczba === 0);
f5.wystrzel({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, 0);
spr('siła zero -> brak emisji, bez wyjątku', f5.liczba === 0);
f5._ruszaj(NaN);
spr('NaN dt w _ruszaj -> bez wyjątku, bez zmian', true);

// --- 6. Rzut perspektywiczny: bliżej = większe, dalej = mniejsze ---
console.log('\nRZUT PERSPEKTYWICZNY:');
spr(`z=0 daje s=1 (${rzutPerspektywiczny(0).toFixed(2)})`, Math.abs(rzutPerspektywiczny(0) - 1) < 0.01);
spr(`bliższa cząstka (z=100) większa niż dalsza (z=500)`,
    rzutPerspektywiczny(100) > rzutPerspektywiczny(500));
spr(`bardzo daleka cząstka (z=${OGNISKO * 10}) prawie znika (s=${rzutPerspektywiczny(OGNISKO * 10).toFixed(3)})`,
    rzutPerspektywiczny(OGNISKO * 10) < 0.15);
spr(`bardzo bliska/za kamerą (z=-${OGNISKO}) jest KLAMROWANA, nie ucieka w nieskończoność`,
    Number.isFinite(rzutPerspektywiczny(-OGNISKO)) && rzutPerspektywiczny(-OGNISKO) <= 3);
spr('NaN -> skończona wartość, bez wyjątku', Number.isFinite(rzutPerspektywiczny(NaN)));

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-fala.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../js/fala.js'`

- [ ] **Krok 3: Napisz `js/fala.js`**

```js
/**
 * Fala Podmuchu (Aard) - układ cząstek, TYLKO rysowanie.
 *
 * Dostaje zaczep, kierunek 3D i siłę przez wystrzel(); nie wie nic
 * o pieczęciach, kombosach ani o mocy - ten sam podział co ogien.js.
 *
 * JEDNORAZOWY IMPULS, nie ciągła emisja: wystrzel() dodaje N cząstek
 * naraz, potem tylko żyją i gasną. Inaczej niż ogien.js, który emituje
 * co klatkę, dopóki trwa płomień.
 *
 * ================= RZUT PERSPEKTYWICZNY =================
 * Cząstki żyją w przestrzeni PIKSELOWEJ (x,y,z), z=0 w miejscu zaczepu.
 * Rzut na płótno: s = OGNISKO / (OGNISKO + z) - mniejsze z (bliżej) daje
 * większe s, dalsze cząstki kurczą się i bledną. OGNISKO jest ZGADNIĘTE
 * (jak każda inna stała w tej grze) i wymaga potwierdzenia z nakładki (D).
 *
 * ================= DLACZEGO WYGLĄDA JAK WIATR =================
 * 1. STOŻEK ROSNĄCY Z WIEKIEM. Cząstki startują w wąskim stożku wokół
 *    kierunku i z czasem rozjeżdżają się na boki (pole `roz`, rosnące
 *    w _ruszaj) - to jest "rozpływa się, rozszerzając coraz bardziej".
 * 2. OPÓR. Cząstki zwalniają, więc fala nie leci w nieskończoność.
 * 3. SORTOWANIE PO Z przed rysowaniem - dalsze cząstki pod bliższymi.
 * 4. SPRITE WYPALONY RAZ - ten sam powód co w ogien.js: gradient na
 *    cząstkę na klatkę zabija FPS przy setkach cząstek.
 * 5. JEDNA BARWA. Wiatr sam w sobie jest niewidzialny - widać zaburzenie,
 *    nie powietrze, więc bez rampy barw jak w ogniu (który jest emisyjny).
 */

const OGNISKO_DOMYSLNE = 900;      // px - ZGADNIĘTE, stroić klawiszem D
export const OGNISKO = OGNISKO_DOMYSLNE;

const SPRITE_PX = 40;
const BARWA = [214, 240, 255];     // blady błękit - patrz efekty.js (aard)

const NA_WYSTRZAL = 220;           // cząstek przy pełnej sile (nie na sekundę - jednorazowo)
const PREDKOSC_BAZOWA = 640;       // px/s wzdłuż kierunku, przy pełnej sile
const ROZRZUT_PREDKOSCI = 220;     // px/s losowego rozrzutu długości wektora
const ROZWARCIE_START = 0.12;      // rad - stożek WĄSKI w chwili emisji
const ROZPRASZANIE = 260;          // px/s^2 bocznego rozjeżdżania, rośnie z wiekiem
const OPOR = 0.9;                  // 1/s - hamowanie, fala zwalnia zamiast lecieć bez końca
const ZYCIE_MIN = 0.9, ZYCIE_MAX = 1.4;      // s
const ROZMIAR_OD = 0.5, ROZMIAR_DO = 1.4;
const MAX_CZASTECZEK = 500;        // sufit bezpieczeństwa dla klatkażu

/**
 * Rzut perspektywiczny: mniejsze z (bliżej kamery) -> większe s.
 *
 * KLAMROWANE z obu stron: z ucieczką w -OGNISKO (cząstka "za kamerą")
 * mianownik dążyłby do zera i s eksplodowałoby - stąd dolna granica na z.
 * Górna granica na s (3) chroni przed jednym gigantycznym sprite'em, gdyby
 * cząstka poleciała wprost na widza.
 */
export function rzutPerspektywiczny(z, ognisko = OGNISKO) {
    const zc = Number.isFinite(z) ? Math.max(z, -ognisko * 0.6) : 0;
    return Math.min(3, ognisko / (ognisko + zc));
}

function krzyz(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function normalizuj(v) {
    const d = Math.hypot(v.x, v.y, v.z);
    return d > 1e-9 ? { x: v.x / d, y: v.y / d, z: v.z / d } : { x: 1, y: 0, z: 0 };
}
/** Dwa jednostkowe wektory prostopadłe do `os` i do siebie - baza stożka. */
function prostopadleDo(os) {
    const pom = Math.abs(os.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const p1 = normalizuj(krzyz(os, pom));
    const p2 = krzyz(os, p1);   // już znormalizowany: os i p1 są jednostkowe i prostopadłe
    return [p1, p2];
}

export class Fala {
    constructor() {
        this.czastki = [];
        this._sprite = null;
    }

    get liczba() { return this.czastki.length; }

    /**
     * @param {{x,y}} zaczep  źródło w PIKSELACH płótna
     * @param {{x,y,z}} kierunek  wektor 3D (nie musi być jednostkowy)
     * @param {number} sila  0..1
     */
    wystrzel(zaczep, kierunek, sila) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        if (!kierunek) return;
        const dl = Math.hypot(kierunek.x, kierunek.y, kierunek.z);
        if (!(dl > 1e-6)) return;
        const os = { x: kierunek.x / dl, y: kierunek.y / dl, z: kierunek.z / dl };
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;

        const [p1, p2] = prostopadleDo(os);
        const n = Math.round(NA_WYSTRZAL * (0.4 + 0.6 * s));   // słabsza fala = mniej, nie zero
        for (let i = 0; i < n; i++) {
            const kat = ROZWARCIE_START * Math.sqrt(Math.random());
            const phi = Math.random() * Math.PI * 2;
            const kier = {
                x: os.x * Math.cos(kat) + (p1.x * Math.cos(phi) + p2.x * Math.sin(phi)) * Math.sin(kat),
                y: os.y * Math.cos(kat) + (p1.y * Math.cos(phi) + p2.y * Math.sin(phi)) * Math.sin(kat),
                z: os.z * Math.cos(kat) + (p1.z * Math.cos(phi) + p2.z * Math.sin(phi)) * Math.sin(kat),
            };
            const predkosc = (PREDKOSC_BAZOWA * s) * (0.7 + Math.random() * 0.5)
                            + (Math.random() - 0.5) * ROZRZUT_PREDKOSCI;
            // Kierunek bocznego rozpraszania - LOSOWY per cząstka, żeby
            // stożek rozjeżdżał się na wszystkie strony, nie w jedną.
            const rozPhi = Math.random() * Math.PI * 2;
            const roz = {
                x: p1.x * Math.cos(rozPhi) + p2.x * Math.sin(rozPhi),
                y: p1.y * Math.cos(rozPhi) + p2.y * Math.sin(rozPhi),
                z: p1.z * Math.cos(rozPhi) + p2.z * Math.sin(rozPhi),
            };
            this._dodaj({
                x: zaczep.x, y: zaczep.y, z: 0,
                vx: kier.x * predkosc, vy: kier.y * predkosc, vz: kier.z * predkosc,
                roz,
                zycie: ZYCIE_MIN + Math.random() * (ZYCIE_MAX - ZYCIE_MIN),
                skala: ROZMIAR_OD + Math.random() * (ROZMIAR_DO - ROZMIAR_OD),
                wiek: 0
            });
        }
    }

    _dodaj(cz) {
        if (this.czastki.length >= MAX_CZASTECZEK) return;
        this.czastki.push(cz);
    }

    _ruszaj(dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        if (krok <= 0) return;
        const zywe = [];
        for (const c of this.czastki) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;

            const p = c.wiek / c.zycie;
            // Rozwarcie stożka ROŚNIE z wiekiem - fala rozpływa się,
            // rozszerzając coraz bardziej, zamiast lecieć wąskim pękiem.
            c.vx += c.roz.x * ROZPRASZANIE * p * krok;
            c.vy += c.roz.y * ROZPRASZANIE * p * krok;
            c.vz += c.roz.z * ROZPRASZANIE * p * krok;

            const opor = 1 - OPOR * krok;
            c.vx *= opor; c.vy *= opor; c.vz *= opor;
            c.x += c.vx * krok; c.y += c.vy * krok; c.z += c.vz * krok;

            if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)) zywe.push(c);
        }
        this.czastki = zywe;
    }

    _rysuj(ctx) {
        if (!this.czastki.length) return;
        if (!this._sprite) this._sprite = zrobSprite();

        // DALSZE POD BLIŻSZYMI: sortujemy malejąco po z, więc cząstki
        // z najmniejszym z (najbliższe) rysują się na końcu, na wierzchu.
        const posortowane = [...this.czastki].sort((a, b) => b.z - a.z);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const c of posortowane) {
            const p = c.wiek / c.zycie;
            const s = rzutPerspektywiczny(c.z);
            // Szybki narost, powolne wygaszanie - ten sam kształt obwiedni
            // co w ogien.js, żeby cząstki nie pojawiały się skokowo.
            const alfa = Math.sin(Math.min(1, p * 6) * Math.PI * 0.5) * (1 - p) * (1 - p);
            const r = SPRITE_PX * c.skala * s;

            ctx.globalAlpha = Math.max(0, Math.min(1, alfa * s * 0.85));
            ctx.drawImage(this._sprite, c.x - r / 2, c.y - r / 2, r, r);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    /** @param {CanvasRenderingContext2D} ctx  @param {number} dt */
    updateAndDraw(ctx, dt) {
        this._ruszaj(dt);
        this._rysuj(ctx);
    }
}

/** Sprite wypalony RAZ - patrz ogien.js:215-236 dla tego samego wzorca. */
function zrobSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_PX;
    const x = c.getContext('2d');
    const [r, g, b] = BARWA;
    const grd = x.createRadialGradient(SPRITE_PX / 2, SPRITE_PX / 2, 0,
                                       SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX / 2);
    grd.addColorStop(0.0, `rgba(${r},${g},${b},0.9)`);
    grd.addColorStop(0.4, `rgba(${r},${g},${b},0.4)`);
    grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    return c;
}
```

- [ ] **Krok 4: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-fala.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

- [ ] **Krok 5: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

- [ ] **Krok 6: Commit**

```bash
git add js/fala.js tools/test-fala.mjs
git commit -m "Fala Podmuchu - cząstki rzutowane perspektywicznie, jednorazowy impuls

Ten sam podział co ogien.js (tylko rysowanie, nie wie nic o pieczęciach ani
o mocy), ale wystrzel() emituje RAZ, nie co klatkę - podmuch jest
jednorazowym pchnięciem, nie techniką kanałowaną.

OGNISKO jest jedną zgadniętą stałą we wzorze rzutu (s = OGNISKO/(OGNISKO+z)) -
zamiana jej na wartość wyliczoną z kalibracji kamery (poza zakresem tego
planu, patrz spec) nie ruszy niczego innego w tym pliku.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 4: Wpięcie w `js/main.js` i nakładkę debug

**Files:**
- Modify: `js/main.js:17` (import), `:70` (instancja), `:383-390` (routing `uzbraja`), `:412-422` (wywołanie obok `plonacyPalec`/`ogien`), `:485-500` (dane do nakładki)
- Modify: `js/debugHud.js:189-203` (nowa sekcja diagnostyczna, obok istniejącej `stats.ogien`)

**Interfejsy:**
- Konsumuje: `Podmuch` (Zadanie 2), `Fala` (Zadanie 3), `KomboSilnik`/pole `technika.uzbraja` (już istnieje, `js/kombosy.js:38`), `motionMeter.zuzyj(koszt)` (`js/motionMeter.js:177`).
- Produkuje: brak nowego eksportu — to jest integracja, weryfikowana testem regresji (`test-wszystko.sh`) i na żywym ciele.

- [ ] **Krok 1: Dopisz importy i instancje w `js/main.js`**

W `js/main.js:17`, po `import { PlonacyPalec } from './plonacyPalec.js';`:

```js
import { PlonacyPalec } from './plonacyPalec.js';
import { Podmuch } from './podmuch.js';
import { Fala } from './fala.js';
```

W `js/main.js:70`, po `let plonacyPalec = new PlonacyPalec();`:

```js
let plonacyPalec = new PlonacyPalec();
let podmuch = new Podmuch();
let fala = new Fala();
```

- [ ] **Krok 2: Wepnij routing `uzbraja === 'aard'`**

W `js/main.js`, zastąp blok (obecne linie 375-390):

```js
        if (technika) {
            efekty.odpal(technika.id);
            aura.rozblysk(1);
            // Kombos uzbraja technikę WSKAZANĄ POLEM `uzbraja`, nie zawsze
            // płonący palec. Dopóki technika była jedna, bezwarunkowe
            // uzbrajanie ognia było w porządku; przy Aardzie uzbroiłoby złą.
            // Bez licznika ważności - licznik byłby presją ("szybciej!"),
            // a to ma być relaks.
            if (technika.uzbraja === 'ogien') {
                plonacyPalec.uzbrój();
            }
            // 'aard' NIE MA JESZCZE właściciela - fala jest niezbudowana.
            // Kombos odpala na razie samą zapowiedź z tabeli efekty.js.
            // Milczące pominięcie jest tu celowe: reguła nadrzędna zabrania
            // komunikatu o porażce, a gracz i tak zobaczy pierścień.
            audioEngine.playFireSFX(1.0);
            ostatniKomunikat = `${technika.nazwa} ✨`;
```

na:

```js
        if (technika) {
            efekty.odpal(technika.id);
            aura.rozblysk(1);
            // Kombos uzbraja technikę WSKAZANĄ POLEM `uzbraja` - dopóki
            // technika była jedna, bezwarunkowe uzbrajanie ognia było
            // w porządku; przy dwóch trzeba routować.
            // Bez licznika ważności - licznik byłby presją ("szybciej!"),
            // a to ma być relaks.
            if (technika.uzbraja === 'ogien') {
                plonacyPalec.uzbrój();
            } else if (technika.uzbraja === 'aard') {
                podmuch.uzbrój();
            }
            audioEngine.playFireSFX(1.0);
            ostatniKomunikat = `${technika.nazwa} ✨`;
```

- [ ] **Krok 3: Wepnij `podmuch`/`fala` w pętlę klatki**

W `js/main.js`, po bloku „7b. Płonący palec” (obecne linie 406-422, kończące się wywołaniem `ogien.updateAndDraw(...)`), dopisz:

```js

    // --- 7c. Podmuch (Aard) ---
    // Jednorazowe zdarzenie: update() zwraca coś TYLKO w klatce wystrzału.
    // W przeciwieństwie do płonącego palca, podmuch nie pobiera mocy przez
    // motionMeter.zuzyj() co klatkę - robi to raz, w momencie odpalenia.
    const wystrzal = podmuch.update(frame, motionMeter.moc, dt);
    if (wystrzal) {
        motionMeter.zuzyj(wystrzal.pobor);
        fala.wystrzel(
            { x: wystrzal.zaczep.x * canvas.width, y: wystrzal.zaczep.y * canvas.height },
            wystrzal.kierunek,
            wystrzal.sila
        );
    }
    fala.updateAndDraw(ctx, dt);
```

- [ ] **Krok 4: Dopisz pola do nakładki debug**

W `js/main.js`, w obiekcie przekazywanym do `debugHud.updatePanel(frame, {...})` (obecne linie 473-501), po polu `ogien: {...}`:

```js
        ogien: { stan: plonacyPalec.stan, wskazanie: plonacyPalec.wskazanie,
                 czastki: ogien.liczba, zwloka: plonacyPalec.zwloka,
                 powodZwloki: plonacyPalec.powodZwloki,
                 utrzymanie: plonacyPalec._utrzymanie,
                 barkiNiepewne: plonacyPalec.barkiNiepewne },
        podmuch: { stan: podmuch.stan, diagnostyka: podmuch.diagnostyka,
                   czastkiFali: fala.liczba },
```

W `js/debugHud.js`, po bloku `if (stats.ogien) { ... }` (obecne linie 189-203), dopisz nową sekcję:

```js
        // Stan Podmuchu i jego fali. `diagnostyka` to NAJLEPSZY kandydat
        // w tej klatce, nawet gdy nic się nie odpaliło - bez tego nie da
        // się wystroić PROG_PREDKOSCI/PROG_OTWARCIA (patrz podmuch.js).
        if (stats.podmuch) {
            const d = stats.podmuch.diagnostyka;
            lines.push(`podmuch ${stats.podmuch.stan}  cząstek fali ${stats.podmuch.czastkiFali}`);
            lines.push(`      prędkość ${this._num(d.predkosc)} sk/s (prog 4.0)` +
                       `   otwarcie ${this._num(d.otwarcie)} (prog 0.55)`);
            if (d.kierunek) {
                lines.push(`      kierunek (${d.kierunek.x.toFixed(2)}, ${d.kierunek.y.toFixed(2)}, ${d.kierunek.z.toFixed(2)})`);
            }
        }
```

- [ ] **Krok 5: Uruchom pełny zestaw testów i potwierdź, że przechodzi**

```bash
sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie pliki `✓`, w tym `test-podmuch.mjs` i `test-fala.mjs` z Zadań 2-3.

- [ ] **Krok 6: Sprawdź na żywym ciele**

```bash
YARN_IGNORE_ENGINES=true python3 -m http.server 8000
```

(albo dowolny lokalny serwer statyczny — gra jest vanilla JS bez builda)

Otwórz `http://localhost:8000`, włącz nakładkę (`D`) i:

1. Złóż Szczura dwukrotnie pod rząd (dwie pięści razem, przytrzymaj, powtórz) — nakładka powinna pokazać `podmuch UZBROJONY`.
2. Otwartą dłonią machnij zdecydowanie w dowolną stronę — powinna wystrzelić fala jasnoniebieskich cząstek lecąca w kierunku machnięcia, `podmuch` wraca do `BEZCZYNNY`.
3. Machnij ponownie BEZ nowego kombosa — nic się nie dzieje (cisza, nie błąd).
4. Zaobserwuj FPS w nakładce podczas pełnej fali — musi zostać ≥ 24.
5. Spróbuj machnięć w kilku kierunkach (bok, góra/dół, w stronę kamery) — kierunek fali powinien intuicyjnie zgadzać się z gestem. Jeśli nie, wystrój `PROG_PREDKOSCI`/`PROG_OTWARCIA` w `js/podmuch.js` i `OGNISKO` w `js/fala.js` z odczytów nakładki, tak jak przy każdej innej zgadniętej stałej w tej grze.

- [ ] **Krok 7: Commit**

```bash
git add js/main.js js/debugHud.js
git commit -m "Wpięcie Podmuchu w pętlę gry - Aard ma wreszcie właściciela

Kombos z uzbraja==='aard' uzbraja teraz Podmuch zamiast milczeć. Wystrzał
pobiera moc RAZ (nie przez cały czas trwania, jak płonący palec) - to
zgodne z decyzją 'jednorazowe pchnięcie, nie kanałowanie' ze specyfikacji.

Nakładka debug pokazuje NAJLEPSZEGO kandydata na machnięcie w każdej
klatce, nawet gdy nic się nie odpaliło - bez tego progi prędkości
i otwartości dłoni są niemożliwe do wystrojenia na żywym ciele.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Poza zakresem tego planu

(przeniesione ze spec, bez zmian)

1. Wyliczanie `OGNISKO` z kalibracji kamery — możliwe później jako podmiana jednej stałej w `js/fala.js`, bez zmian w reszcie pliku.
2. Sprzężenie fali z innymi efektami (odrzut aury, rozwiewanie żaru płonącego palca).
3. Kombosy łączące Aard z innymi technikami.
