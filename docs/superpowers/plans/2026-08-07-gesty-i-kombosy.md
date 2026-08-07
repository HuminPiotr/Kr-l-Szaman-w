# Warstwa gestów: pieczęcie i kombosy — plan implementacji

> **Dla agentów wykonawczych:** WYMAGANY PODSKILL: użyj `superpowers:subagent-driven-development` (zalecane) albo `superpowers:executing-plans`, żeby wykonać ten plan zadanie po zadaniu. Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** Gracz układa ciałem trzy pieczęcie (Perun, Mokosz, Weles); każda kosztuje moc i daje lekki efekt, a złożone po sobie w sekwencję odpalają technikę.

**Architektura:** Istniejący `ZnakRegistry` ocenia trzy nowe znaki `wymaga: 'pose'` i zwraca ciągłe wyniki 0..1. Nowa klasa `SkladaniePieczeci` zamienia ciągły wynik na zdarzenie binarne (próg → tempo napełniania → skok), bramkuje je mocą i zamraża zanik mocy na czas składania. `KomboSilnik` trzyma bufor złożonych pieczęci i dopasowuje sekwencje. `Efekty` rysuje jedną funkcją z tabeli danych.

**Stos:** Vanilla JS, moduły ES, bez backendu. Testy to samodzielne skrypty `node tools/test-*.mjs`, zbierane przez `tools/test-wszystko.sh`.

**Spec:** `docs/superpowers/specs/2026-08-07-gesty-i-kombosy-design.md`

## Ograniczenia globalne

Obowiązują w KAŻDYM zadaniu. Wartości przepisane dosłownie ze spec i z GEMINI.md.

1. **Reguła nadrzędna: nic nigdy nie mówi „źle".** Żaden komunikat nie informuje o porażce. Wynik znaku jest CIĄGŁĄ wartością 0..1, nigdy booleanem. Próg jest wyłącznie w `pieczecie.js`, nigdy w znaku.
2. **Pomiary z `worldLandmarks`, rysowanie z `landmarks`.** Bez wyjątków (GEMINI.md:49). Nowe znaki NIE używają `landmarks`.
3. **`PROG_WIDOCZNOSCI = 0.5`** — ten sam co `motionMeter.js:95`. Gate stosować tylko gdy `visibility !== undefined` (precedens `motionMeter.js:212`).
4. **Wszystkie nowe liczby są ZGADNIĘTE.** Każda stała dostaje komentarz mówiący, że wymaga potwierdzenia na żywym ciele i z czego ją stroić (nakładka debug, klawisz `D`).
5. **Płótno ma CSS `transform: scaleX(-1)`** (GEMINI.md:88). Kształty rysować normalnie; tekstu na płótnie NIE rysować.
6. **Odporność na NaN.** Każda wartość wchodząca do stanu przechodzi przez sprawdzenie `Number.isFinite`. Jedna klatka z NaN nie może zatruć stanu na stałe (precedens `motionMeter.js:176-179`).
7. **Komentarze po polsku**, w stylu istniejących plików: tłumaczą DLACZEGO, nie CO.
8. **`swarog` i `stribog` zostają nietknięte.** Nie portować, nie usuwać.
9. **Punkty palców 17-22 są zakazane w v1.** Na modelu `lite` przy 480 px to najbardziej zaszumione punkty w zestawie.

## Układ plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `js/znaki/postawa.js` | wspólne helpery: indeksy, skala ciała, rampa, bramka widoczności | 1 |
| `js/znaki/perun.js` | postawa gromu → 0..1 | 1 |
| `js/znaki/mokosz.js` | postawa ziemi → 0..1 | 2 |
| `js/znaki/weles.js` | postawa podziemia → 0..1 | 2 |
| `js/motionMeter.js` | *(modyfikacja)* `zuzyj(koszt)`, zamrożenie zaniku | 3 |
| `js/pieczecie.js` | próg, tempo składania, bramka mocy, zdarzenie binarne | 4 |
| `js/kombosy.js` | bufor i dopasowanie sekwencji | 5 |
| `js/aura.js` | *(modyfikacja)* impuls wyładowania | 6 |
| `js/efekty.js` | tabela efektów + jedna funkcja rysująca | 7 |
| `js/main.js` | *(modyfikacja)* wpięcie w pętlę klatki | 8 |
| `js/debugHud.js` | *(modyfikacja)* nowe pola diagnostyczne | 8 |

Testy: `tools/test-postawy.mjs` (1, 2), `tools/test-pieczecie.mjs` (3, 4), `tools/test-kombosy.mjs` (5), `tools/test-aura-impuls.mjs` (6).

**Układ współrzędnych `worldLandmarks`:** metry, początek w środku bioder, **oś Y rośnie W DÓŁ**. Barki mają więc `y` UJEMNE, dłonie opuszczone poniżej bioder mają `y` DODATNIE. Skalą odniesienia jest rozstaw barków (`|L11 − L12|`), nie metry bezwzględne — inaczej gest działałby tylko dla osób jednego wzrostu.

**Indeksy MediaPipe Pose:** 11/12 barki · 13/14 łokcie · 15/16 nadgarstki · 23/24 biodra.

---

## Zadanie 1: Helpery postawy + pieczęć Peruna

**Pliki:**
- Utwórz: `js/znaki/postawa.js`
- Utwórz: `js/znaki/perun.js`
- Test: `tools/test-postawy.mjs`

**Interfejsy:**
- Konsumuje: `ZnakRegistry` z `js/znaki/registry.js` (bez zmian).
- Produkuje:
  - `BARK_L=11, BARK_P=12, LOKIEC_L=13, LOKIEC_P=14, NADG_L=15, NADG_P=16, BIODRO_L=23, BIODRO_P=24` (stałe)
  - `PROG_WIDOCZNOSCI: number`
  - `widoczne(wl: Array, indeksy: number[]) -> boolean`
  - `skalaCiala(wl: Array) -> number` (metry, >0)
  - `rampa(v: number, od: number, doPelni: number) -> number` (0..1, ciągła)
  - `perun: { id:'perun', nazwa:'Perun', wymaga:'pose', score(frame) -> 0..1 }`

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-postawy.mjs`:

```js
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
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-postawy.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../js/znaki/perun.js`

- [ ] **Krok 3: Napisz helpery**

Utwórz `js/znaki/postawa.js`:

```js
/**
 * Wspólne narzędzia znaków opartych na POSTAWIE CIAŁA.
 *
 * Wszystko liczone z worldLandmarks: metry, początek w środku bioder,
 * oś Y W DÓŁ. Barki mają y ujemne, dłoń opuszczona poniżej bioder - dodatnie.
 *
 * Skalą odniesienia jest ROZSTAW BARKÓW, nie metry bezwzględne. Gest ma
 * działać tak samo u osoby wysokiej i niskiej, więc każda odległość jest
 * wyrażona w "szerokościach barków".
 */

export const BARK_L = 11,   BARK_P = 12;
export const LOKIEC_L = 13, LOKIEC_P = 14;
export const NADG_L = 15,   NADG_P = 16;
export const BIODRO_L = 23, BIODRO_P = 24;

// Ten sam próg co motionMeter.js:95. Punkt gorzej widoczny to zgadywanie
// MediaPipe, nie pomiar - jego geometria potrafi przypadkiem wysoko
// punktować. Zero znaczy tu BRAK DANYCH, nie "źle": gracz poza kadrem
// nie dostaje komunikatu o porażce (GEMINI.md §2).
export const PROG_WIDOCZNOSCI = 0.5;

/** Czy wszystkie wskazane punkty istnieją, są skończone i dostatecznie pewne. */
export function widoczne(wl, indeksy) {
    if (!wl) return false;
    for (const i of indeksy) {
        const p = wl[i];
        if (!p) return false;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
        // Gate tylko gdy MediaPipe faktycznie podał pewność - tak samo
        // jak motionMeter.js:212. Brak pola nie może blokować gestu.
        if (p.visibility !== undefined && p.visibility < PROG_WIDOCZNOSCI) return false;
    }
    return true;
}

/**
 * Rozstaw barków w metrach - jednostka odniesienia dla wszystkich odległości.
 * Podłoga chroni przed dzieleniem przez zero, gdy gracz stoi bokiem
 * i barki nakładają się w rzucie.
 */
export function skalaCiala(wl) {
    const a = wl[BARK_L], b = wl[BARK_P];
    const dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return Number.isFinite(d) ? Math.max(0.12, d) : 0.12;
}

/**
 * Ciągła rampa 0..1. Nigdy próg tak/nie - reguła nadrzędna obowiązuje
 * także tutaj: postawa ułożona w połowie daje pół wyniku.
 * Działa też malejąco (od > doPelni).
 */
export function rampa(v, od, doPelni) {
    if (!Number.isFinite(v)) return 0;
    const t = (v - od) / (doPelni - od);
    return Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
}

/** Średnia y dwóch punktów - linia barków albo linia bioder. */
export function poziom(wl, i, j) {
    return (wl[i].y + wl[j].y) / 2;
}
```

- [ ] **Krok 4: Napisz Peruna**

Utwórz `js/znaki/perun.js`:

```js
/**
 * Pieczęć Peruna - grom.
 *
 * Jedna ręka wyprostowana nad głowę, druga opuszczona wzdłuż ciała.
 * Szaman ściąga błyskawicę.
 *
 * Gest jest zdefiniowany SYMETRYCZNIE. MediaPipe podaje lewo/prawo względem
 * OBRAZU, a płótno ma CSS scaleX(-1) (GEMINI.md:88), więc stronność nie może
 * nieść znaczenia - inaczej gest działałby lustrzanie odwrotnie niż wygląda.
 * Liczymy oba przypisania rąk i bierzemy lepsze.
 */
import {
    BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P,
    widoczne, skalaCiala, rampa, poziom
} from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele. Stroić z nakładki
// debug (klawisz D), która pokazuje wynik każdej postawy. Jednostka:
// szerokości barków.
const UNIESIENIE_MIN = 0.2;   // nadgarstek tyle nad linią barków -> zaczyna się liczyć
const UNIESIENIE_PELNE = 1.2; // ramię wyciągnięte pionowo w górę
const OPUSZCZENIE_MIN = 0.05; // druga dłoń poniżej linii bioder
const OPUSZCZENIE_PELNE = 0.5;
// Prostota ramienia: |bark->nadgarstek| / (|bark->łokieć| + |łokieć->nadgarstek|).
// 1.0 = idealnie prosta linia, mniej = ramię zgięte.
const PROSTOTA_MIN = 0.85;
const PROSTOTA_PELNA = 0.98;

export const perun = {
    id: 'perun',
    nazwa: 'Perun',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;

        const skala = skalaCiala(wl);
        const yBarkow = poziom(wl, BARK_L, BARK_P);
        const yBioder = poziom(wl, BIODRO_L, BIODRO_P);

        // Oba przypisania: prawa w górze / lewa w górze.
        return Math.max(
            oceń(wl, skala, yBarkow, yBioder, BARK_P, LOKIEC_P, NADG_P, NADG_L),
            oceń(wl, skala, yBarkow, yBioder, BARK_L, LOKIEC_L, NADG_L, NADG_P)
        );
    }
};

function oceń(wl, skala, yBarkow, yBioder, bark, lokiec, nadgGora, nadgDol) {
    // Oś Y rośnie W DÓŁ, więc "nad barkami" to y MNIEJSZE od linii barków.
    const uniesienie = rampa((yBarkow - wl[nadgGora].y) / skala,
                             UNIESIENIE_MIN, UNIESIENIE_PELNE);
    const opuszczenie = rampa((wl[nadgDol].y - yBioder) / skala,
                              OPUSZCZENIE_MIN, OPUSZCZENIE_PELNE);
    const prostota = rampa(prostotaRamienia(wl[bark], wl[lokiec], wl[nadgGora]),
                           PROSTOTA_MIN, PROSTOTA_PELNA);

    // MINIMUM, nie średnia: wszystkie trzy warunki muszą zachodzić naraz,
    // inaczej ręce opuszczone punktowałyby na 2/3 tylko dlatego, że ramię
    // jest proste. Minimum jest nadal CIĄGŁE - reguła nadrzędna spełniona.
    return Math.min(uniesienie, opuszczenie, prostota);
}

function prostotaRamienia(bark, lokiec, nadg) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const przez = d(bark, lokiec) + d(lokiec, nadg);
    if (!(przez > 1e-6)) return 0;
    return d(bark, nadg) / przez;
}
```

- [ ] **Krok 5: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-postawy.mjs
```

Oczekiwane: wszystkie linie z `✓`, kod wyjścia 0. Rampa ma pokazać płynny wzrost od `-0.45:0.00` do `-1.25:1.00`.

- [ ] **Krok 6: Commit**

```bash
git add js/znaki/postawa.js js/znaki/perun.js tools/test-postawy.mjs
git commit -m "Pieczęć Peruna - pierwsza postawa czytana z ciała

Gest zdefiniowany symetrycznie, bo MediaPipe podaje strony względem
obrazu, a płótno jest odbite. Minimum zamiast średniej: bez tego ręce
opuszczone punktowały na 2/3 za samo proste ramię."
```

---

## Zadanie 2: Pieczęcie Mokoszy i Welesa

**Pliki:**
- Utwórz: `js/znaki/mokosz.js`
- Utwórz: `js/znaki/weles.js`
- Modyfikuj: `tools/test-postawy.mjs` (dopisanie sekcji rozdzielności)

**Interfejsy:**
- Konsumuje: helpery z `js/znaki/postawa.js` (Zadanie 1).
- Produkuje:
  - `mokosz: { id:'mokosz', nazwa:'Mokosz', wymaga:'pose', score(frame) -> 0..1 }`
  - `weles: { id:'weles', nazwa:'Weles', wymaga:'pose', score(frame) -> 0..1 }`

- [ ] **Krok 1: Dopisz test rozdzielności, który ma nie przejść**

W `tools/test-postawy.mjs` zmień import na:

```js
import { perun } from '../js/znaki/perun.js';
import { mokosz } from '../js/znaki/mokosz.js';
import { weles } from '../js/znaki/weles.js';
```

i rejestrację na:

```js
const rej = new ZnakRegistry();
rej.zarejestruj(perun); rej.zarejestruj(mokosz); rej.zarejestruj(weles);
```

Następnie, PRZED `process.exit(...)`, dopisz:

```js
// MOKOSZ: obie dłonie nisko, rozstawione szerzej niż barki. Dłonie na ziemi.
const POSTAWA_MOKOSZ = cialo({
  nadgL: [-0.40, 0.35], lokL: [-0.30, -0.10],
  nadgP: [0.40, 0.35],  lokP: [0.30, -0.10]
});

// WELES: ręce skrzyżowane na piersi - lewy nadgarstek po prawej stronie
// tułowia i odwrotnie.
const POSTAWA_WELES = cialo({
  nadgL: [0.15, -0.30],  lokL: [-0.25, -0.15],
  nadgP: [-0.15, -0.30], lokP: [0.25, -0.15]
});

console.log('\nROZDZIELNOŚĆ - żadna postawa nie zapala pozostałych:');
const m = ocen(POSTAWA_MOKOSZ);
const w = ocen(POSTAWA_WELES);
spr(`Mokosz zapala Mokosz (${m.mokosz.toFixed(2)})`, m.mokosz > 0.9);
spr(`Mokosz NIE zapala Peruna (${m.perun.toFixed(2)})`, m.perun < 0.2);
spr(`Mokosz NIE zapala Welesa (${m.weles.toFixed(2)})`, m.weles < 0.2);
spr(`Weles zapala Welesa (${w.weles.toFixed(2)})`, w.weles > 0.9);
spr(`Weles NIE zapala Peruna (${w.perun.toFixed(2)})`, w.perun < 0.2);
spr(`Weles NIE zapala Mokoszy (${w.mokosz.toFixed(2)})`, w.mokosz < 0.2);
spr(`Perun NIE zapala Mokoszy (${a.mokosz.toFixed(2)})`, a.mokosz < 0.2);
spr(`Perun NIE zapala Welesa (${a.weles.toFixed(2)})`, a.weles < 0.2);

// LUSTRO dla obu nowych postaw. Weles czyta SKRZYŻOWANIE po kolejności x,
// więc jest na odbicie najbardziej wrażliwy z całej trójki.
const odbij = (wl) => wl.map(p => ({ ...p, x: -p.x }));
const mL = ocen(odbij(POSTAWA_MOKOSZ));
const wL = ocen(odbij(POSTAWA_WELES));
console.log('\nLUSTRO:');
spr(`odbita Mokosz = ta sama (${mL.mokosz.toFixed(2)})`, Math.abs(mL.mokosz - m.mokosz) < 0.02);
spr(`odbity Weles = ten sam (${wL.weles.toFixed(2)})`, Math.abs(wL.weles - w.weles) < 0.02);

// Ręce NIESKRZYŻOWANE na wysokości piersi - Weles ma milczeć.
const naWprost = ocen(cialo({
  nadgL: [-0.30, -0.30], lokL: [-0.25, -0.15],
  nadgP: [0.30, -0.30],  lokP: [0.25, -0.15]
}));
spr(`ręce na wprost NIE zapalają Welesa (${naWprost.weles.toFixed(2)})`, naWprost.weles < 0.2);

// CIĄGŁOŚĆ Welesa przy krzyżowaniu rąk.
console.log('\nCIĄGŁOŚĆ Welesa przy krzyżowaniu rąk:');
// Krok 0.005, nie 0.02: OBIE ręce jadą naraz (x i -x), więc krzyżowanie
// zmienia się z podwójnym tempem. Przy kroku 0.02 skok wychodzi 0.222
// i test fałszywie zgłasza próg tam, gdzie jest rampa - ZMIERZONE.
let poprzW = 0, maxSkokW = 0;
const poziomyW = [];
for (let i = 0; i <= 120; i++) {
  const x = -0.35 + i * 0.005;
  const s = ocen(cialo({
    nadgL: [x, -0.30],  lokL: [-0.25, -0.15],
    nadgP: [-x, -0.30], lokP: [0.25, -0.15]
  })).weles;
  maxSkokW = Math.max(maxSkokW, Math.abs(s - poprzW)); poprzW = s;
  if (i % 20 === 0) poziomyW.push(`${x.toFixed(3)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomyW.join('  '));
spr(`największy skok Welesa = ${maxSkokW.toFixed(3)} (rampa)`, maxSkokW < 0.15);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-postawy.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../js/znaki/mokosz.js`

- [ ] **Krok 3: Napisz Mokosz**

Utwórz `js/znaki/mokosz.js`:

```js
/**
 * Pieczęć Mokoszy - ziemia, wilgoć, matka.
 *
 * Obie dłonie nisko, rozstawione szerzej niż barki - jakby gracz kładł je
 * na ziemi. Geometrycznie przeciwna do Peruna (tam JEDNA dłoń wysoko),
 * więc obie postawy nie zapalają się nawzajem.
 *
 * Naturalnie symetryczna: liczy się |rozstaw| i obie dłonie na równi,
 * więc odbicie lustrzane niczego nie zmienia.
 */
import {
    BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P,
    widoczne, skalaCiala, rampa, poziom
} from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka debug, D).
// Jednostka: szerokości barków.
const NISKO_MIN = 0.05;    // nadgarstek tyle poniżej linii bioder
const NISKO_PELNE = 0.35;
const ROZSTAW_MIN = 1.0;   // dłonie dokładnie pod barkami - jeszcze nie gest
const ROZSTAW_PELNY = 1.6; // wyraźnie szerzej niż barki

export const mokosz = {
    id: 'mokosz',
    nazwa: 'Mokosz',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;

        const skala = skalaCiala(wl);
        const yBioder = poziom(wl, BIODRO_L, BIODRO_P);

        // Oś Y rośnie W DÓŁ: "poniżej bioder" to y WIĘKSZE od linii bioder.
        const niskoL = rampa((wl[NADG_L].y - yBioder) / skala, NISKO_MIN, NISKO_PELNE);
        const niskoP = rampa((wl[NADG_P].y - yBioder) / skala, NISKO_MIN, NISKO_PELNE);

        const rozstaw = rampa(Math.abs(wl[NADG_L].x - wl[NADG_P].x) / skala,
                              ROZSTAW_MIN, ROZSTAW_PELNY);

        // Minimum, nie średnia - patrz komentarz w perun.js.
        return Math.min(niskoL, niskoP, rozstaw);
    }
};
```

- [ ] **Krok 4: Napisz Welesa**

Utwórz `js/znaki/weles.js`:

```js
/**
 * Pieczęć Welesa - podziemie, bydło, brama.
 *
 * Ręce skrzyżowane na piersi.
 *
 * SKRZYŻOWANIE liczone jako ZNAK iloczynu, nie jako kolejność x. MediaPipe
 * podaje lewo/prawo względem OBRAZU, a płótno ma scaleX(-1) (GEMINI.md:88).
 * Przy odbiciu lustrzanym NEGUJĄ SIĘ oba czynniki - różnica nadgarstków
 * i różnica barków - więc iloczyn zostaje bez zmian. Sprawdzenie samej
 * kolejności x dawałoby wynik odwrotny w lustrze.
 *
 * Wysokość piersi odcina Mokosz (dłonie poniżej bioder) i Peruna
 * (dłoń nad barkami), więc trójka jest rozdzielna.
 */
import {
    BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P,
    widoczne, skalaCiala, rampa, poziom
} from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka debug, D).
const KRZYZ_MIN = 0.05;    // nadgarstki ledwo minęły się w poprzek tułowia
const KRZYZ_PELNY = 0.5;   // wyraźnie po przeciwnych stronach, w szerokościach barków

// Wysokość piersi jako ułamek odcinka barki -> biodra. 0 = linia barków,
// 1 = linia bioder.
const PIERS_IDEALNA = 0.45;
const PIERS_TOLERANCJA = 0.5;

export const weles = {
    id: 'weles',
    nazwa: 'Weles',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;

        const skala = skalaCiala(wl);
        const yBarkow = poziom(wl, BARK_L, BARK_P);
        const yBioder = poziom(wl, BIODRO_L, BIODRO_P);
        const rozpietosc = yBioder - yBarkow;
        if (!(Math.abs(rozpietosc) > 1e-6)) return 0;

        // Dodatnie, gdy nadgarstki leżą po stronach PRZECIWNYCH niż barki.
        const roznicaNadg = wl[NADG_L].x - wl[NADG_P].x;
        const roznicaBark = wl[BARK_L].x - wl[BARK_P].x;
        const krzyz = rampa(-(roznicaNadg * Math.sign(roznicaBark)) / skala,
                            KRZYZ_MIN, KRZYZ_PELNY);

        const wysL = wysokoscPiersi(wl[NADG_L].y, yBarkow, rozpietosc);
        const wysP = wysokoscPiersi(wl[NADG_P].y, yBarkow, rozpietosc);

        // Minimum, nie średnia - patrz komentarz w perun.js.
        return Math.min(krzyz, wysL, wysP);
    }
};

function wysokoscPiersi(y, yBarkow, rozpietosc) {
    const t = (y - yBarkow) / rozpietosc;
    if (!Number.isFinite(t)) return 0;
    // Trójkątna rampa wokół wysokości piersi: ciągła w obie strony,
    // więc dłoń wędrująca w górę albo w dół gaśnie płynnie, nie skokiem.
    return Math.max(0, 1 - Math.abs(t - PIERS_IDEALNA) / PIERS_TOLERANCJA);
}
```

- [ ] **Krok 5: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-postawy.mjs && sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie `✓`, kod 0 z obu. `test-wszystko.sh` zbiera `test-*.mjs` automatycznie, więc `test-postawy.mjs` jest już w zestawie — nie trzeba go rejestrować.

**Wartości ZMIERZONE na tych sylwetkach syntetycznych** (nie oszacowane — jeśli twoje wyjdą inaczej, coś jest nie tak z geometrią, nie z testem):

| postawa | perun | mokosz | weles |
|---|---|---|---|
| Perun | **1.00** | 0.00 | 0.00 |
| Mokosz | 0.00 | **1.00** | 0.00 |
| Weles | 0.00 | 0.00 | **0.99** |
| ręce opuszczone | 0.00 | 0.17 | 0.00 |
| ręce na wprost | 0.00 | 0.00 | 0.00 |

Rampy: Perun maks. skok **0.050**, Weles **0.056**. Rozdzielność jest pełna — żadna para nie przecieka.

`0.17` przy Mokoszy dla rąk opuszczonych jest poprawne i celowe: dłonie są nisko, tylko za wąsko. To jest właśnie ciągła rampa, a nie próg.

- [ ] **Krok 6: Commit**

```bash
git add js/znaki/mokosz.js js/znaki/weles.js tools/test-postawy.mjs
git commit -m "Pieczęcie Mokoszy i Welesa - trójka rozdzielna

Weles czyta skrzyżowanie jako ZNAK iloczynu różnic, nie kolejność x.
W lustrze negują się oba czynniki, więc wynik zostaje - sprawdzenie
samej kolejności dawało wynik odwrotny, a płótno ma scaleX(-1)."
```

---

## Zadanie 3: Moc jako zasób — koszt i zamrożenie zaniku

**Pliki:**
- Modyfikuj: `js/motionMeter.js:114-166`
- Test: `tools/test-pieczecie.mjs`

**Interfejsy:**
- Konsumuje: nic z poprzednich zadań.
- Produkuje:
  - `MotionMeter.update(frame, plynnosc = 1, zamrozZanik = false) -> number`
  - `MotionMeter.zuzyj(koszt = 1) -> void`

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-pieczecie.mjs`:

```js
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
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-pieczecie.mjs
```

Oczekiwane: `✗ zuzyj(0.10) zabiera dokładnie 10% (0.000)` — obecne `zuzyj()` ignoruje argument i zeruje moc. Dalej `✗ 3 s bezruchu Z zamrożeniem`.

- [ ] **Krok 3: Zmień `zuzyj` w `js/motionMeter.js`**

Zastąp całą metodę `zuzyj()` (`js/motionMeter.js:157-166`) tym:

```js
    /**
     * Moc zamieniona na efekt - pieczęć albo wystrzał.
     *
     * Wartość domyślna 1 zeruje cały zbiornik i zachowuje zachowanie
     * odpiętego powerBall.js, który woła zuzyj() bez argumentu.
     * Pieczęcie podają swój koszt, bo mają go różny: podstawowe ~10%,
     * przyszłe wielkie techniki nawet większość paska.
     *
     * To NIE jest kara - nic nie mówi "źle", po prostu tańczysz dalej.
     */
    zuzyj(koszt = 1) {
        const k = Number.isFinite(koszt) ? koszt : 0;
        this.moc = this._bezpiecznaMoc(this.moc - k);
    }
```

- [ ] **Krok 4: Dodaj zamrożenie zaniku w `js/motionMeter.js`**

Zmień sygnaturę `update` i dopisz do bloku JSDoc (`js/motionMeter.js:109-114`):

```js
    /**
     * @param {object} frame
     * @param {number} plynnosc  0..1 z js/plynnosc.js - jak gładki jest ruch.
     *                           Steruje TEMPEM ładowania, nigdy go nie zeruje.
     * @param {boolean} zamrozZanik  true na czas składania pieczęci.
     *
     * ZAMROŻENIE JEST WYMOGIEM, NIE OPTYMALIZACJĄ. Trzymanie postawy jest
     * bezruchem, więc bez niego składanie kosztuje podwójnie: responsywnosc
     * spada do zera (znika przyrost) I działa ZANIK. Postawa niechlujna, ale
     * ponad progiem, składa się ~2 s i zjada ~13% mocy - więcej niż kosztuje
     * sama pieczęć. Cena stałaby się "10% plus kara proporcjonalna do
     * niedokładności", czyli dokładnie tą stopniowaną karą, której zabrania
     * reguła nadrzędna. Przyrost nadal nie działa (gracz stoi) - zamrażamy
     * wyłącznie ZANIK.
     */
    update(frame, plynnosc = 1, zamrozZanik = false) {
```

Następnie zmień wiersz z `netto` (`js/motionMeter.js:150`) z:

```js
        const netto = przyrost - ZANIK * bezruch;
```

na:

```js
        const netto = przyrost - (zamrozZanik ? 0 : ZANIK * bezruch);
```

Gałąź „poza kadrem" (`js/motionMeter.js:132`) zostaje BEZ ZMIAN — bez pozy żaden znak nie punktuje, więc żadna pieczęć się wtedy nie składa.

- [ ] **Krok 5: Uruchom testy i potwierdź, że przechodzą**

```bash
node tools/test-pieczecie.mjs && sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie `✓`, kod 0. `test-stany.mjs` i `test-fire.mjs` muszą nadal przechodzić — domyślne `zuzyj()` zachowuje stare zachowanie.

- [ ] **Krok 6: Commit**

```bash
git add js/motionMeter.js tools/test-pieczecie.mjs
git commit -m "Moc staje się zasobem - koszt częściowy i zamrożenie zaniku

Bez zamrożenia trzymanie postawy kosztuje podwójnie: znika przyrost
i działa zanik. Niechlujna postawa składa się ~2 s i zjada ~13% mocy,
czyli więcej niż sama pieczęć - cena stawała się karą proporcjonalną
do niedokładności."
```

---

## Zadanie 4: Składanie pieczęci

**Pliki:**
- Utwórz: `js/pieczecie.js`
- Modyfikuj: `tools/test-pieczecie.mjs` (dopisanie sekcji składania)

**Interfejsy:**
- Konsumuje: nic (dostaje gotową mapę wyników i moc jako liczby).
- Produkuje:
  - `KOSZT_PODSTAWOWY: number` (0.10)
  - `class SkladaniePieczeci`
    - `constructor({ prog?, czasMin?, czasMax?, koszty? })`
    - `update(wyniki: {[id]: number}, moc: number, dt: number) -> { skladana: string|null, postep: number, zlozona: { id: string, koszt: number } | null, brakMocy: boolean }`
    - `zamrazaZanik: boolean` (pole, aktualne po `update`)

- [ ] **Krok 1: Dopisz test składania, który ma nie przejść**

W `tools/test-pieczecie.mjs` dopisz import na górze:

```js
import { SkladaniePieczeci, KOSZT_PODSTAWOWY } from '../js/pieczecie.js';
```

i PRZED `process.exit(...)` dopisz:

```js
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
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-pieczecie.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../js/pieczecie.js`

- [ ] **Krok 3: Napisz `js/pieczecie.js`**

```js
/**
 * Składanie pieczęci - ciągły wynik postawy zamieniony na zdarzenie binarne.
 *
 * Pieczęć albo wychodzi, albo nie. Ale binarność dotyczy WYNIKU, nie OCENY:
 * ciągły wynik postawy steruje TEMPEM napełniania pierścienia, dokładnie tak
 * jak płynność steruje tempem ładowania mocy (motionMeter.js:118). Postawa
 * niedokładna składa się WOLNIEJ, nigdy nie zostaje odrzucona i nigdy nie
 * dostaje komunikatu o porażce. Reguła nadrzędna (GEMINI.md §2) obowiązuje.
 *
 * Trzy zachowania, które wyglądają na detale, a są wymogami tej reguły:
 *
 *   1. Poniżej progu jest CISZA, nie odmowa. Żadnego wskaźnika, żadnego
 *      komunikatu - gra po prostu nie reaguje.
 *   2. Sufit czasu składania. Postawa tuż nad progiem nie może trzymać
 *      gracza w nieskończonym zawieszeniu.
 *   3. Przy braku mocy zanik NIE jest zamrażany. Zamrożenie przy pustym
 *      zbiorniku dałoby zakleszczenie: moc nie rośnie (gracz stoi
 *      w postawie), nie spada (zamrożona), pieczęć nigdy nieosiągalna.
 */

// WSZYSTKIE TE LICZBY SĄ ZGADNIĘTE i wymagają potwierdzenia na żywym ciele.
// Stroić z nakładki debug (klawisz D), która pokazuje wynik każdej postawy
// i stan napełnienia pierścienia. Precedens: PROG_SZARPNIECIA w plynnosc.js
// też został wyprowadzony z sygnałów syntetycznych i nadal czeka na
// potwierdzenie (GEMINI.md §6).

const PROG_POSTAWY = 0.5;   // poniżej - cisza
const CZAS_MIN_S = 0.5;     // postawa idealna
const CZAS_MAX_S = 2.5;     // postawa tuż nad progiem - TO JEST SUFIT
export const KOSZT_PODSTAWOWY = 0.10;  // ułamek pełnego paska

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export class SkladaniePieczeci {
    constructor({ prog = PROG_POSTAWY, czasMin = CZAS_MIN_S,
                  czasMax = CZAS_MAX_S, koszty = {} } = {}) {
        this.prog = prog;
        this.czasMin = czasMin;
        this.czasMax = czasMax;
        this.koszty = koszty;

        this.skladana = null;   // id znaku, w który celuje pierścień
        this.postep = 0;        // 0..1 - napełnienie pierścienia
        this.zamrazaZanik = false;
    }

    koszt(id) {
        const k = this.koszty[id];
        return Number.isFinite(k) ? k : KOSZT_PODSTAWOWY;
    }

    /**
     * @param {object} wyniki  mapa id -> 0..1 z ZnakRegistry.ocen()
     * @param {number} moc     0..1 z MotionMeter
     * @param {number} dt      sekundy
     */
    update(wyniki, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const zapas = clamp01(moc);

        const { id, wynik } = this._najlepszy(wyniki);

        // Poniżej progu: cisza. Pierścień gaśnie, nic nie miga.
        if (!id || wynik < this.prog) {
            this.skladana = null;
            this.postep = 0;
            this.zamrazaZanik = false;
            return { skladana: null, postep: 0, zlozona: null, brakMocy: false };
        }

        // Zmiana celu to RETARGETOWANIE, nie porażka. Nowy znak, nowy pierścień.
        if (id !== this.skladana) {
            this.skladana = id;
            this.postep = 0;
        }

        const koszt = this.koszt(id);
        if (zapas < koszt) {
            // Pierścień stoi, ale zanik NIE jest zamrożony - patrz nagłówek,
            // punkt 3. Gracz musi móc dotańczyć brakującą moc.
            this.zamrazaZanik = false;
            return { skladana: id, postep: this.postep, zlozona: null, brakMocy: true };
        }

        // Tempo proporcjonalne do dokładności. t=1 -> czasMin, t=0 -> czasMax.
        const t = (wynik - this.prog) / (1 - this.prog);
        const czas = this.czasMax + (this.czasMin - this.czasMax) * clamp01(t);
        this.postep += krok / Math.max(1e-3, czas);
        this.zamrazaZanik = true;

        if (this.postep >= 1) {
            // Pieczęć SKACZE w istnienie. Pierścień wraca do zera, cel
            // zwolniony - trzymanie tej samej postawy nie produkuje pieczęci
            // co klatkę, tylko zaczyna następną od nowa.
            this.postep = 0;
            this.skladana = null;
            this.zamrazaZanik = false;
            return { skladana: null, postep: 0, zlozona: { id, koszt }, brakMocy: false };
        }

        return { skladana: id, postep: this.postep, zlozona: null, brakMocy: false };
    }

    _najlepszy(wyniki) {
        let id = null, wynik = 0;
        for (const k of Object.keys(wyniki || {})) {
            const v = clamp01(wyniki[k]);
            if (v > wynik) { wynik = v; id = k; }
        }
        return { id, wynik };
    }
}
```

- [ ] **Krok 4: Uruchom testy i potwierdź, że przechodzą**

```bash
node tools/test-pieczecie.mjs && sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie `✓`, kod 0.

- [ ] **Krok 5: Commit**

```bash
git add js/pieczecie.js tools/test-pieczecie.mjs
git commit -m "Składanie pieczęci - ciągła postawa, binarny wynik

Próg dzieli ciszę od pierścienia, tempo napełniania niesie dokładność.
Przy pustym zbiorniku zanik zostaje ODMROŻONY - zamrożenie dałoby
zakleszczenie, bo moc ani nie rośnie (gracz stoi), ani nie spada."
```

---

## Zadanie 5: Silnik kombosów

**Pliki:**
- Utwórz: `js/kombosy.js`
- Test: `tools/test-kombosy.mjs`

**Interfejsy:**
- Konsumuje: `{ id }` ze `SkladaniePieczeci.update().zlozona` (Zadanie 4).
- Produkuje:
  - `KOMBOSY: Array<{ id: string, nazwa: string, sekwencja: string[] }>`
  - `class KomboSilnik`
    - `constructor({ okno?, kombosy? })`
    - `dodaj(idPieczeci: string, now: number) -> { id, nazwa, sekwencja } | null`
    - `bufor: Array<{ id: string, t: number }>` (pole, do nakładki debug)

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-kombosy.mjs`:

```js
/**
 * Bufor kombosów: wygasa z czasem, NIGDY nie jest czyszczony za pomyłkę.
 *
 *   node tools/test-kombosy.mjs
 *
 * Każda konwencjonalna gra walki kasuje bufor przy złym wejściu. To jest
 * stan porażki i łamie regułę nadrzędną (GEMINI.md §2). Tutaj żadna pieczęć
 * nie jest "zła": każda zapłaciła swoje 10% i dała własny efekt, więc
 * nieudana próba kombo to po prostu kilka ładnych błysków.
 */
import { KomboSilnik, KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('DOPASOWANIE SEKWENCJI:');
const k1 = new KomboSilnik();
spr('pierwsza pieczęć nie odpala kombo', k1.dodaj('perun', 0) === null);
const grom = k1.dodaj('mokosz', 800);
spr(`perun -> mokosz odpala Grom w Ziemię (${grom?.id})`, grom?.id === 'gromWZiemie');

console.log('\nBUFOR NIE JEST CZYSZCZONY ZA POMYŁKĘ:');
const k2 = new KomboSilnik();
k2.dodaj('weles', 0);          // pieczęć spoza jakiejkolwiek sekwencji na starcie
k2.dodaj('perun', 500);
const nadal = k2.dodaj('mokosz', 1000);
spr(`pieczęć "nie ta" nie psuje późniejszego kombo (${nadal?.id})`, nadal?.id === 'gromWZiemie');

console.log('\nBUFOR WYGASA Z CZASEM:');
const k3 = new KomboSilnik();
k3.dodaj('perun', 0);
const zaPozno = k3.dodaj('mokosz', 9000);  // 9 s - daleko poza oknem
spr('pieczęcie zbyt odległe w czasie nie tworzą kombo', zaPozno === null);
spr(`bufor odrzucił przeterminowany wpis (${k3.bufor.length})`, k3.bufor.length === 1);

console.log('\nDRUGIE KOMBO:');
const k4 = new KomboSilnik();
k4.dodaj('mokosz', 0);
const zew = k4.dodaj('weles', 600);
spr(`mokosz -> weles odpala Zew Podziemia (${zew?.id})`, zew?.id === 'zewPodziemia');

console.log('\nŁAŃCUCH:');
// perun -> mokosz -> weles daje OBA kombosy po kolei. To jest celowe
// i hojne: gracz nie może "zmarnować" pieczęci, więc nakładające się
// sekwencje mają się nakładać, a nie wykluczać.
const k5 = new KomboSilnik();
k5.dodaj('perun', 0);
const pierwsze = k5.dodaj('mokosz', 400);
const drugie = k5.dodaj('weles', 800);
spr(`łańcuch daje Grom (${pierwsze?.id})`, pierwsze?.id === 'gromWZiemie');
spr(`i zaraz Zew (${drugie?.id})`, drugie?.id === 'zewPodziemia');

console.log('\nBRAK PODWÓJNEGO ODPALENIA:');
const k6 = new KomboSilnik();
k6.dodaj('perun', 0);
k6.dodaj('mokosz', 400);
const powtorka = k6.dodaj('mokosz', 800);
spr('powtórzenie ostatniej pieczęci nie odpala kombo drugi raz', powtorka === null);

console.log('\nODPORNOŚĆ:');
const k7 = new KomboSilnik();
spr('nieznane id nie wywraca silnika', k7.dodaj('nieistnieje', 0) === null);
spr('NaN jako czas nie wywraca silnika', k7.dodaj('perun', NaN) === null);
spr('tabela kombosów jest niepusta', KOMBOSY.length >= 2);

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-kombosy.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../js/kombosy.js`

- [ ] **Krok 3: Napisz `js/kombosy.js`**

```js
/**
 * Silnik kombosów - sekwencja pieczęci odpala technikę.
 *
 * BUFOR WYGASA Z CZASEM, ALE NIGDY NIE JEST CZYSZCZONY ZA POMYŁKĘ.
 * Każda konwencjonalna gra walki kasuje bufor przy złym wejściu; to jest
 * stan porażki i łamie regułę nadrzędną (GEMINI.md §2). Tutaj żadna pieczęć
 * nie jest "zła": każda zapłaciła swój koszt i dała własny efekt, więc
 * nieudana próba kombo to po prostu kilka ładnych błysków.
 *
 * Technika odpala się GRATIS - składowe już zapłaciły. To nagroda za
 * ułożenie, nie kolejny rachunek.
 *
 * ŁAŃCUCHY SĄ CELOWE. perun -> mokosz -> weles daje oba kombosy po kolei,
 * bo dopasowujemy KOŃCÓWKĘ bufora i nie czyścimy go po trafieniu. Gracz nie
 * może zmarnować pieczęci, więc nakładające się sekwencje mają się nakładać.
 */

// ZGADNIĘTE - wymaga potwierdzenia na żywym ciele. Za krótkie okno karze
// wolniejszych, za długie łączy pieczęcie złożone bez związku.
const OKNO_MS = 4000;

export const KOMBOSY = [
    { id: 'gromWZiemie',  nazwa: 'Grom w Ziemię',  sekwencja: ['perun', 'mokosz'] },
    { id: 'zewPodziemia', nazwa: 'Zew Podziemia',  sekwencja: ['mokosz', 'weles'] }
];

export class KomboSilnik {
    constructor({ okno = OKNO_MS, kombosy = KOMBOSY } = {}) {
        this.okno = okno;
        this.kombosy = kombosy;
        this.bufor = [];   // [{ id, t }] - najstarsze z przodu
    }

    /**
     * @param {string} idPieczeci  id właśnie złożonej pieczęci
     * @param {number} now         performance.now() w ms
     * @returns {object|null} definicja techniki albo null
     */
    dodaj(idPieczeci, now) {
        if (typeof idPieczeci !== 'string' || !idPieczeci) return null;
        if (!Number.isFinite(now)) return null;

        this.bufor.push({ id: idPieczeci, t: now });

        // Wygaszanie po CZASIE. To jedyny sposób, w jaki wpis znika z bufora.
        while (this.bufor.length && now - this.bufor[0].t > this.okno) {
            this.bufor.shift();
        }

        return this._dopasuj();
    }

    /** Dopasowanie do KOŃCÓWKI bufora - patrz komentarz o łańcuchach. */
    _dopasuj() {
        for (const kombo of this.kombosy) {
            const s = kombo.sekwencja;
            if (this.bufor.length < s.length) continue;
            const ogon = this.bufor.slice(-s.length);
            if (ogon.every((w, i) => w.id === s[i])) return kombo;
        }
        return null;
    }
}
```

- [ ] **Krok 4: Uruchom testy i potwierdź, że przechodzą**

```bash
node tools/test-kombosy.mjs && sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie `✓`, kod 0.

- [ ] **Krok 5: Commit**

```bash
git add js/kombosy.js tools/test-kombosy.mjs
git commit -m "Silnik kombosów - bufor wygasa, nigdy nie jest czyszczony

Kasowanie bufora przy złym wejściu to stan porażki. Tu każda pieczęć
zapłaciła swoje i dała własny efekt, więc nieudana próba to po prostu
kilka błysków. Łańcuchy sekwencji są celowe."
```

---

## Zadanie 6: Aura — impuls wyładowania

**Pliki:**
- Modyfikuj: `js/aura.js:45-148`
- Test: `tools/test-aura-impuls.mjs`

**Interfejsy:**
- Konsumuje: nic z poprzednich zadań.
- Produkuje:
  - `Aura.rozblysk(sila = 1) -> void`
  - `Aura._impuls: number` (pole, czytane przez test i nakładkę debug)

**Kontekst:** `aura.js:71-73` JUŻ wygładza `moc` przez `TAU_WYGLADZANIA = 0.5`, więc połowa wymogu §6b spec jest spełniona. Brakuje samego impulsu — bez niego wydatek 10% jest tylko łagodnym zejściem w dół, czyli nadal ODEBRANIEM nagrody, którą taniec zarobił.

Test może działać bez DOM: przy `maska = null` `updateAndDraw` wraca w `aura.js:77`, **po** wygładzeniu. Rozpad impulsu MUSI więc znaleźć się przed tym powrotem.

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-aura-impuls.mjs`:

```js
/**
 * Impuls wyładowania w aurze.
 *
 *   node tools/test-aura-impuls.mjs
 *
 * main.js podaje moc prosto do aury, a aura jest deklarowaną nagrodą całej
 * gry (GEMINI.md:7, 37). Gdyby czytała moc surową, KAŻDA PIECZĘĆ
 * PRZYGASZAŁABY AURĘ o swój koszt - czyli zabierała dokładnie to, co taniec
 * zarobił, a wielokrotne rzucanie dawałoby coraz ciemniejszego szamana.
 * Impuls odwraca odczyt: wydatek ma wyglądać jak WYŁADOWANIE, nie jak strata.
 *
 * Test nie potrzebuje DOM - przy masce null updateAndDraw wraca wcześnie,
 * już PO wygładzeniu i rozpadzie impulsu.
 */
import { Aura } from '../js/aura.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const fit = { offsetX: 0, offsetY: 0, scaledW: 1, scaledH: 1 };
const DT = 1 / 60;
const nowa = () => new Aura({ width: 1920, height: 1080 }, null);
const przepusc = (a, moc, sekundy) => {
  for (let i = 0; i < Math.round(sekundy / DT); i++) {
    a.updateAndDraw(null, 0, 0, moc, 1, fit, DT);
  }
};

console.log('IMPULS:');
const a1 = nowa();
spr(`świeża aura ma impuls zero (${a1._impuls})`, a1._impuls === 0);
a1.rozblysk(1);
spr(`rozblysk() podnosi impuls (${a1._impuls.toFixed(2)})`, a1._impuls > 0.9);

przepusc(a1, 0.5, 0.1);
const poKrotkiej = a1._impuls;
spr(`po 0.1 s impuls jeszcze świeci (${poKrotkiej.toFixed(2)})`, poKrotkiej > 0.5);
przepusc(a1, 0.5, 1.5);
spr(`po 1.6 s impuls zgasł (${a1._impuls.toFixed(3)})`, a1._impuls < 0.05);

console.log('\nIMPULS NIE PRZEKRACZA SKALI:');
const a2 = nowa();
a2.rozblysk(1); a2.rozblysk(1); a2.rozblysk(1);
spr(`potrójny rozbłysk nie wychodzi ponad 1 (${a2._impuls.toFixed(2)})`, a2._impuls <= 1);

console.log('\nWYDATEK CZYTA SIĘ JAK WYŁADOWANIE:');
// Scenariusz właściwy: pełna moc, złożenie pieczęci (moc -10% + rozbłysk).
// Jasność efektywna zaraz po pieczęci musi być WYŻSZA niż przed nią.
//
// Suma _moc + _impuls jest DOKŁADNIE tym, czym steruje renderer - dlatego
// mocEfektywna w aura.js nie jest clampowana do 1. Gdyby była, ten test
// mierzyłby liczbę, której rysowanie nigdy nie widzi, i przechodziłby
// przy zupełnie martwym efekcie.
const a3 = nowa();
przepusc(a3, 1.0, 3);                       // aura dogoniła pełną moc
const przed = a3._moc + a3._impuls;
a3.rozblysk(1);
przepusc(a3, 0.9, 0.1);                     // moc spadła o koszt pieczęci
const po = a3._moc + a3._impuls;
spr(`zaraz po pieczęci aura jest JAŚNIEJSZA (${przed.toFixed(2)} -> ${po.toFixed(2)})`, po > przed);

console.log('\nODPORNOŚĆ NA NaN:');
const a4 = nowa();
a4.rozblysk(NaN);
spr(`rozblysk(NaN) nie zatruwa impulsu (${a4._impuls})`, Number.isFinite(a4._impuls));
a4.updateAndDraw(null, 0, 0, NaN, NaN, fit, DT);
spr(`klatka z NaN nie zatruwa mocy (${a4._moc})`, Number.isFinite(a4._moc));

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-aura-impuls.mjs
```

Oczekiwane: `✗ świeża aura ma impuls zero (undefined)` — pole `_impuls` jeszcze nie istnieje.

- [ ] **Krok 3: Dodaj stałą i pole impulsu w `js/aura.js`**

Dopisz stałą tuż pod `TAU_WYGLADZANIA` (`js/aura.js:27`):

```js
// IMPULS WYŁADOWANIA. Bez niego każda pieczęć PRZYGASZAŁABY aurę o swój
// koszt - czyli zabierała dokładnie to, co taniec zarobił, a wielokrotne
// rzucanie dawałoby coraz ciemniejszego szamana. Aura jest deklarowaną
// nagrodą całej gry (GEMINI.md:7, 37), więc odwracamy odczyt: wydatek ma
// wyglądać jak WYŁADOWANIE, po którym aura wraca, nie jak strata.
//
// Stała musi być KRÓTSZA niż odbudowa mocy tańcem (~8 s), inaczej impuls
// przestaje się czytać jako impuls i zlewa się z ładowaniem.
const TAU_IMPULSU = 0.45;
```

W konstruktorze (`js/aura.js:55-57`), obok `this._moc = 0;`, dopisz:

```js
        this._impuls = 0;
```

- [ ] **Krok 4: Dodaj `rozblysk()` i wpleć impuls w jasność**

Dopisz metodę zaraz po konstruktorze (przed `updateAndDraw`):

```js
    /** Pieczęć się złożyła - aura wylewa się w efekt i wraca. */
    rozblysk(sila = 1) {
        const s = Number.isFinite(sila) ? Math.max(0, sila) : 0;
        this._impuls = Math.min(1, this._impuls + s);
    }
```

W `updateAndDraw`, ZARAZ po linii z `this._faza` (`js/aura.js:75`) i **przed** wczesnym powrotem, dopisz rozpad i wielkość sterującą:

```js
        // Rozpad MUSI być przed wczesnym powrotem niżej - inaczej impuls
        // zamarza, gdy maski chwilowo nie ma, i wraca jako przebłysk.
        this._impuls *= Math.max(0, 1 - dt / TAU_IMPULSU);
        if (!Number.isFinite(this._impuls)) this._impuls = 0;
```

Następnie zastąp wczesny powrót (`js/aura.js:77`):

```js
        if (!maska || !szer || !wys || this._moc < 0.01) return;
```

tym:

```js
        // Jasnością steruje moc POWIĘKSZONA o impuls, nie moc surowa.
        //
        // BEZ CLAMPU DO 1, i to jest celowe. Przy pełnym pasku _moc ≈ 1, więc
        // Math.min(1, ...) zjadałby CAŁY impuls: pieczęć rzucona z pełnej mocy
        // dawałaby zmianę jasności o 0.2%, a potem zejście do 0.9. Dokładnie ta
        // inwersja, przed którą broni impuls - i to w najczęstszym momencie
        // rzucania, bo HUD wprost zaprasza wtedy do układania pieczęci.
        //
        // Sprawdzone przy skrajnej wartości 2.0: jasność HSL 76% (poprawna),
        // mnożnik rozmycia 1.55 (szersza poświata - o to chodzi), globalAlpha
        // 0.77 i 0.29 (obie pod 1 i tak już clampowane niżej). Nic nie przepełnia.
        const mocEfektywna = this._moc + this._impuls;

        if (!maska || !szer || !wys || mocEfektywna < 0.01) return;
```

Na koniec zamień KAŻDE użycie `this._moc` w dalszej części `updateAndDraw` na `mocEfektywna`. Są to dokładnie cztery miejsca:

```js
        const jasnosc = 40 + mocEfektywna * 18;
```
```js
            pc.filter = `blur(${(p.rozmycie * (0.45 + mocEfektywna * 0.55)).toFixed(1)}px)`;
```
```js
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alfa * mocEfektywna * tetno));
```
```js
        ctx.globalAlpha = Math.max(0, Math.min(1, ALFA_WNETRZA * mocEfektywna * tetno));
```

`this._plynnosc` i `_barwa()` zostają BEZ ZMIAN — impuls koduje ILE, nie JAK (`aura.js:8-13`).

- [ ] **Krok 5: Uruchom testy i potwierdź, że przechodzą**

```bash
node tools/test-aura-impuls.mjs && sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie `✓`, kod 0.

- [ ] **Krok 6: Commit**

```bash
git add js/aura.js tools/test-aura-impuls.mjs
git commit -m "Impuls wyładowania - pieczęć rozświetla aurę, nie gasi jej

Aura czytała moc surową, więc każda pieczęć przygaszałaby ją o swój
koszt: wielokrotne rzucanie dawało coraz ciemniejszego szamana i
odwracało strukturę nagrody całej gry."
```

---

## Zadanie 7: Efekty wizualne

**Pliki:**
- Utwórz: `js/efekty.js`

**Interfejsy:**
- Konsumuje: `KOMBOSY` z `js/kombosy.js` (tylko id), indeksy z `js/znaki/postawa.js`.
- Produkuje:
  - `class Efekty`
    - `odpal(id: string) -> void`
    - `updateAndDraw(ctx: CanvasRenderingContext2D, frame: object, dt: number) -> void`

**Uwaga:** efekty rysują z `frame.pose.landmarks` (2D przemapowane) — to jedyne dozwolone użycie 2D, bo jest to RYSOWANIE, nie pomiar (GEMINI.md:49). Płótno ma `scaleX(-1)`, więc kształty wychodzą poprawnie; tekstu tu nie rysujemy.

Ten plik nie ma testu jednostkowego — wyjściem jest wrażenie wzrokowe, tak samo jak w `debugHud.js:4-6`. Weryfikacja odbywa się na żywym ciele.

- [ ] **Krok 1: Napisz `js/efekty.js`**

```js
/**
 * Efekty pieczęci i technik.
 *
 * TABELA DANYCH, nie plik na efekt. Każdy efekt to wiersz (barwa, kształt,
 * czas trwania) rysowany JEDNĄ funkcją. To jest część najbardziej narażona
 * na rozrost - ma nim nie być.
 *
 * Rysuje z landmarks 2D (przemapowanych), bo to RYSOWANIE, nie pomiar.
 * Pomiary idą z worldLandmarks (GEMINI.md:49).
 *
 * Płótno ma CSS scaleX(-1), więc kształty wychodzą poprawnie, a tekstu
 * tutaj nie rysujemy (wyszedłby lustrzany - GEMINI.md:88).
 */
import { NADG_L, NADG_P, BARK_L, BARK_P, BIODRO_L, BIODRO_P } from './znaki/postawa.js';

// Punkty MediaPipe używane wyłącznie do zaczepienia efektu.
const KOSTKA_L = 27, KOSTKA_P = 28;

export const TABELA = {
    // Pieczęcie - LEKKIE. Mają być przyjemne, nie efektowne; efektowność
    // jest nagrodą za kombo.
    perun:  { barwa: '50, 100%, 92%', ksztalt: 'promien',       czas: 0.7 },
    mokosz: { barwa: '120, 60%, 62%', ksztalt: 'pierscienStop', czas: 0.9 },
    weles:  { barwa: '280, 70%, 58%', ksztalt: 'sciagniecie',   czas: 0.9 },

    // Techniki - MOCNE. Odpalają się gratis, jako nagroda za ułożenie.
    gromWZiemie:  { barwa: '50, 100%, 95%', ksztalt: 'blyskIFala', czas: 1.4 },
    zewPodziemia: { barwa: '285, 75%, 48%', ksztalt: 'mglaIMrok',  czas: 1.8 }
};

export class Efekty {
    constructor() {
        this.aktywne = [];   // [{ id, t, czas }]
    }

    odpal(id) {
        const def = TABELA[id];
        if (!def) return;
        this.aktywne.push({ id, t: 0, czas: def.czas });
    }

    updateAndDraw(ctx, frame, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;

        for (const e of this.aktywne) e.t += krok;
        this.aktywne = this.aktywne.filter(e => e.t < e.czas);
        if (!this.aktywne.length) return;

        const lm = frame.pose?.landmarks;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const e of this.aktywne) {
            const def = TABELA[e.id];
            // Postęp 0..1 i obwiednia: szybki narost, powolne wygasanie.
            const p = Math.min(1, e.t / e.czas);
            const alfa = Math.sin(Math.pow(1 - p, 0.6) * Math.PI * 0.5);
            rysuj(ctx, def, p, alfa, lm, frame.width, frame.height);
        }
        ctx.restore();
    }
}

function rysuj(ctx, def, p, alfa, lm, W, H) {
    const kolor = (a) => `hsla(${def.barwa}, ${a.toFixed(3)})`;

    // Zaczepienia. Bez pozy efekt trafia w środek kadru - lepszy efekt
    // nie na miejscu niż brak efektu i wrażenie, że gest nie zadziałał.
    const p2 = (i, zx, zy) => (lm && lm[i] && Number.isFinite(lm[i].x))
        ? { x: lm[i].x, y: lm[i].y } : { x: zx, y: zy };
    const sr = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    switch (def.ksztalt) {
        case 'promien': {
            // Pionowa smuga wzdłuż WYŻEJ uniesionej dłoni.
            const a = p2(NADG_L, W * 0.35, H * 0.3);
            const b = p2(NADG_P, W * 0.65, H * 0.3);
            const dlon = a.y < b.y ? a : b;
            const g = ctx.createLinearGradient(dlon.x, 0, dlon.x, dlon.y);
            g.addColorStop(0, kolor(0));
            g.addColorStop(1, kolor(alfa * 0.85));
            ctx.fillStyle = g;
            ctx.fillRect(dlon.x - W * 0.012, 0, W * 0.024, dlon.y);
            break;
        }
        case 'pierscienStop': {
            // Elipsa rozchodząca się od linii kostek.
            const s = sr(p2(KOSTKA_L, W * 0.45, H * 0.9), p2(KOSTKA_P, W * 0.55, H * 0.9));
            const r = W * (0.05 + 0.20 * p);
            ctx.strokeStyle = kolor(alfa * 0.7);
            ctx.lineWidth = Math.max(1, H * 0.008 * (1 - p * 0.6));
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, r, r * 0.30, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'sciagniecie': {
            // Pierścień ZBIEGAJĄCY się do środka tułowia - odwrotność Mokoszy.
            const s = sr(sr(p2(BARK_L, W * 0.45, H * 0.35), p2(BARK_P, W * 0.55, H * 0.35)),
                         sr(p2(BIODRO_L, W * 0.46, H * 0.6), p2(BIODRO_P, W * 0.54, H * 0.6)));
            const r = W * (0.28 * (1 - p) + 0.02);
            ctx.strokeStyle = kolor(alfa * 0.8);
            ctx.lineWidth = Math.max(1, H * 0.012 * p);
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'blyskIFala': {
            // Błysk całego kadru gaśnie szybko, fala idzie dalej od stóp.
            ctx.fillStyle = kolor(alfa * 0.28 * Math.max(0, 1 - p * 3));
            ctx.fillRect(0, 0, W, H);
            const s = sr(p2(KOSTKA_L, W * 0.45, H * 0.9), p2(KOSTKA_P, W * 0.55, H * 0.9));
            const r = W * (0.05 + 0.85 * p);
            ctx.strokeStyle = kolor(alfa * 0.9);
            ctx.lineWidth = Math.max(1, H * 0.02 * (1 - p));
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, r, r * 0.32, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'mglaIMrok': {
            // Mgła wznosząca się od dołu kadru. Rysowana przez 'lighter',
            // więc mrok robimy niskim, ciemnym fioletem, nie czernią -
            // czerń w tym trybie jest niewidoczna.
            const wys = H * (0.15 + 0.5 * Math.sin(p * Math.PI));
            const g = ctx.createLinearGradient(0, H, 0, H - wys);
            g.addColorStop(0, kolor(alfa * 0.55));
            g.addColorStop(1, kolor(0));
            ctx.fillStyle = g;
            ctx.fillRect(0, H - wys, W, wys);
            break;
        }
    }
}
```

- [ ] **Krok 2: Sprawdź, że plik parsuje się i eksportuje**

```bash
node --input-type=module -e "import('./js/efekty.js').then(m => { const e = new m.Efekty(); e.odpal('perun'); e.odpal('nieistnieje'); console.log('aktywne:', e.aktywne.length, 'wierszy tabeli:', Object.keys(m.TABELA).length); })"
```

Oczekiwane: `aktywne: 1 wierszy tabeli: 5` — nieznane id jest po cichu ignorowane, nie wywraca gry.

- [ ] **Krok 3: Commit**

```bash
git add js/efekty.js
git commit -m "Efekty pieczęci i technik jako tabela danych

Pięć wierszy, jedna funkcja rysująca. Bez pozy efekt trafia w środek
kadru - lepszy efekt nie na miejscu niż wrażenie, że gest nie zadziałał."
```

---

## Zadanie 8: Wpięcie w pętlę klatki

**Pliki:**
- Modyfikuj: `js/main.js:1-12, 28-33, 168-232`
- Modyfikuj: `js/debugHud.js:145-150`

**Interfejsy:**
- Konsumuje: wszystko z Zadań 1-7.
- Produkuje: działającą grę.

- [ ] **Krok 1: Dopisz importy i stan w `js/main.js`**

Zastąp blok importów i komentarz o odpięciu (`js/main.js:1-12`) tym:

```js
import { PoseTracker } from './poseTracker.js';
import { AudioEngine } from './audioEngine.js';
import { DebugHud } from './debugHud.js';
import { MotionMeter } from './motionMeter.js';
import { Plynnosc } from './plynnosc.js';
import { Aura } from './aura.js';
import { ZnakRegistry } from './znaki/registry.js';
import { perun } from './znaki/perun.js';
import { mokosz } from './znaki/mokosz.js';
import { weles } from './znaki/weles.js';
import { SkladaniePieczeci } from './pieczecie.js';
import { KomboSilnik } from './kombosy.js';
import { Efekty } from './efekty.js';
import { computeCoverFit, drawVideoCover, mapLandmarks } from './frameMapper.js';

// ODPIĘTE, NIE USUNIĘTE: powerBall.js, wiatr.js, handTracker.js.
// swarog.js i stribog.js też czekają - są dowodem, że rejestr obsługuje
// wymaga:'hands', i ożyją same, gdy śledzenie dłoni wróci. Dłonie są
// wyłączone, bo zwolnione ~8 ms płaci za maskę sylwetki do aury.
```

Zastąp deklaracje stanu (`js/main.js:28-33`) tym:

```js
let poseTracker = new PoseTracker();
let audioEngine = new AudioEngine();
let debugHud = new DebugHud();
let motionMeter = new MotionMeter();
let plynnoscMiara = new Plynnosc();
let aura = null;

let znaki = new ZnakRegistry();
znaki.zarejestruj(perun);
znaki.zarejestruj(mokosz);
znaki.zarejestruj(weles);
let skladanie = new SkladaniePieczeci();
let kombosy = new KomboSilnik();
let efekty = new Efekty();

// Ostatnia rzecz, którą gracz zrobił - HUD ma o niej mówić przez chwilę,
// zamiast natychmiast wracać do zaproszenia do tańca.
let ostatniKomunikat = null, ostatniKomunikatDo = 0;
```

- [ ] **Krok 2: Wepnij pieczęcie w pętlę klatki**

W `renderLoop` zastąp bloki 4-6 (`js/main.js:171-182`) tym:

```js
    // --- 4. Płynność ruchu ---
    // Liczona z SUROWYCH worldLandmarks - filtr Savitzky'ego-Golaya robi
    // własne wygładzanie. Podanie tu pozycji już wygładzonych przez
    // MotionMeter zabiłoby sygnał, którego szukamy.
    const plynnosc = plynnoscMiara.update(frame.pose?.worldLandmarks ?? null, dt);

    // --- 5. Postawy i składanie pieczęci ---
    // KOLEJNOŚĆ MA ZNACZENIE: składanie musi policzyć się PRZED mocą, bo
    // to ono decyduje, czy zanik jest w tej klatce zamrożony.
    const postawy = znaki.ocen(frame);
    const skl = skladanie.update(postawy, motionMeter.moc, dt);

    // --- 6. Ciągłość ruchu razy płynność -> moc ---
    const moc = motionMeter.update(frame, plynnosc, skladanie.zamrazaZanik);

    // --- 6a. Pieczęć się złożyła ---
    if (skl.zlozona) {
        motionMeter.zuzyj(skl.zlozona.koszt);
        efekty.odpal(skl.zlozona.id);
        aura.rozblysk(1);
        audioEngine.update('FIRING', 1, plynnosc);

        const technika = kombosy.dodaj(skl.zlozona.id, now);
        if (technika) {
            efekty.odpal(technika.id);
            aura.rozblysk(1);
            ostatniKomunikat = `${technika.nazwa} ✨`;
        } else {
            const znak = znaki.znaki.find(z => z.id === skl.zlozona.id);
            ostatniKomunikat = `${znak?.nazwa ?? 'Pieczęć'} złożona`;
        }
        ostatniKomunikatDo = now + 1600;
    }

    // --- 7. Aura ---
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt);

    // --- 7a. Efekty pieczęci i technik ---
    efekty.updateAndDraw(ctx, frame, dt);
```

Zwróć uwagę: `motionMeter.moc` jest czytane PRZED `motionMeter.update()`, czyli jest to moc z poprzedniej klatki. To jest w porządku — różnica jednej klatki przy koszcie 10% jest niemierzalna, a odwrócenie kolejności zepsułoby zamrożenie zaniku.

- [ ] **Krok 3: Dopisz komunikaty i nowe pola HUD**

Zastąp blok komunikatów (`js/main.js:191-211`, od komentarza `// Komunikaty mówią...` do `uiInstructionIcon.textContent = icon;`) tym:

```js
    // Komunikaty mówią, co jest dostępne DALEJ, nigdy co gracz robi ŹLE.
    let text, icon;
    if (ostatniKomunikat && now < ostatniKomunikatDo) {
        text = ostatniKomunikat;
        icon = "✨";
    } else if (!frame.pose) {
        text = "Odsuń się, żeby kamera widziała całą sylwetkę 🕺";
        icon = "🕺";
    } else if (skl.brakMocy) {
        // ZAPROSZENIE, nie odmowa. Nigdy "za mało mocy" ani "nie stać cię".
        text = "Pieczęć czeka — tańcz jeszcze chwilę 🔥";
        icon = "🔥";
    } else if (skl.skladana) {
        text = "Trzymaj — pieczęć się składa 🌀";
        icon = "🌀";
    } else if (moc >= 0.95) {
        text = "Moc wypełniła cię po brzegi — układaj pieczęcie ✨";
        icon = "✨";
    } else if (plynnoscMiara.aktywnychStawow === 0) {
        text = "Zacznij się poruszać — moc budzi się w ruchu 🔥";
        icon = "🔥";
    } else if (plynnosc > 0.6) {
        text = "Płyniesz. Moc rośnie 🌀";
        icon = "🌀";
    } else {
        // Zaproszenie, nie poprawka. Nadal ładuje, tylko wolniej.
        text = "Rozpuść ruch w łagodne łuki, a moc popłynie szybciej 〰️";
        icon = "〰️";
    }
    uiInstructionText.textContent = text;
    uiInstructionIcon.textContent = icon;
```

W wywołaniu `debugHud.updatePanel` (`js/main.js:217-232`) dopisz do obiektu, przed zamykającym `}`:

```js
        postawy,
        skladana: skl.skladana,
        postep: skl.postep,
        brakMocy: skl.brakMocy,
        bufor: kombosy.bufor.map(w => w.id).join(' → ') || '—'
```

- [ ] **Krok 4: Dopisz pola do nakładki debug**

W `js/debugHud.js`, w `updatePanel`, tuż PRZED wierszem `if (stats.maska)` (`js/debugHud.js:149`), dopisz:

```js
        // Wyniki postaw i stan pierścienia. Progi w pieczecie.js są ZGADNIĘTE
        // i stroi się je właśnie stąd - liczba "0.62" przy konkretnej pozycji
        // ciała jest jedynym sposobem, żeby ustawić PROG_POSTAWY sensownie.
        if (stats.postawy) {
            const p = Object.entries(stats.postawy)
                .map(([k, v]) => `${k.slice(0, 3)} ${this._num(v)}`).join('  ');
            lines.push(`znak  ${p}`);
            const cel = stats.skladana ?? '—';
            lines.push(`pieczęć ${cel}  ${this._num(stats.postep ?? 0)}  ${this._bar(stats.postep ?? 0)}${stats.brakMocy ? '  ⏳ brak mocy' : ''}`);
            lines.push(`kombo ${stats.bufor ?? '—'}`);
        }
```

- [ ] **Krok 5: Uruchom całą logikę i potwierdź, że przechodzi**

```bash
sh tools/test-wszystko.sh
```

Oczekiwane: każdy `test-*.mjs` na `✓`, kod 0.

- [ ] **Krok 6: Sprawdź na żywym ciele**

To NIE jest krok opcjonalny. Testy nie zastępują sprawdzenia na kamerze — wejściem gry jest strumień wideo (GEMINI.md §6).

```bash
python3 -m http.server 8000
```

Otwórz `http://localhost:8000`, **twarde przeładowanie** (Chrome cache'uje moduły ES heurystycznie po `Last-Modified` — bez tego godzinami testuje się stary kod, GEMINI.md §6), włącz nakładkę klawiszem `D` i sprawdź:

1. FPS nie spadł poniżej 24 (znaki liczą się na CPU, ale to kilkanaście operacji na klatkę — spadek oznaczałby błąd, nie koszt).
2. Wiersz `znak` pokazuje trzy wyniki; postawa Peruna wybija jeden z nich blisko 1.00, a pozostałe zostają nisko.
3. Wiersz `pieczęć` napełnia się przy trzymaniu, a nie przy swobodnym tańcu.
4. Po złożeniu: moc spada o ~10%, aura **rozbłyskuje**, a nie przygasa.
5. `perun → mokosz` w ciągu 4 s odpala Grom w Ziemię, a HUD pokazuje jego nazwę.
6. Przy pustym pasku komunikat brzmi „Pieczęć czeka — tańcz jeszcze chwilę".

Jeśli któraś postawa zapala się podczas swobodnego tańca, podnieś `PROG_POSTAWY` w `js/pieczecie.js`; jeśli nie da się jej złożyć — obniż. **Wartość zapisz z komentarzem, na jakiej postawie została zmierzona.**

- [ ] **Krok 7: Commit**

```bash
git add js/main.js js/debugHud.js
git commit -m "Pieczęcie wpięte w pętlę klatki

Składanie liczy się PRZED mocą, bo to ono decyduje, czy zanik jest
w tej klatce zamrożony. Nakładka dostaje wyniki postaw i stan
pierścienia - progi są zgadnięte i stroi się je właśnie stamtąd."
```

- [ ] **Krok 8: Uzupełnij GEMINI.md**

W tabeli plików (`GEMINI.md:53-62`) dopisz wiersze:

```
| `js/znaki/postawa.js` | wspólne narzędzia znaków z ciała |
| `js/znaki/{perun,mokosz,weles}.js` | trzy postawy → 0..1 |
| `js/pieczecie.js` | próg + tempo składania, bramka mocy |
| `js/kombosy.js` | bufor pieczęci, dopasowanie sekwencji |
| `js/efekty.js` | tabela efektów, jedna funkcja rysująca |
```

Zmień wiersz „Odpięte, nie usunięte" (`GEMINI.md:63`) na:

```
**Odpięte, nie usunięte** (wracają z dłońmi): `powerBall.js`, `wiatr.js`, `handTracker.js`, `znaki/swarog.js`, `znaki/stribog.js`.
```

W §4 („Pułapki") dopisz nową sekcję:

```markdown
### Pieczęcie

- **Trzymanie postawy jest bezruchem**, więc bez zamrożenia zaniku składanie
  kosztuje podwójnie: znika przyrost I działa zanik. Niechlujna postawa
  składa się ~2 s i zjada ~13% mocy — więcej niż sama pieczęć. Cena stawała
  się karą proporcjonalną do niedokładności.
- **Przy pustym zbiorniku zaniku NIE wolno zamrażać** — moc nie rosłaby
  (gracz stoi w postawie) ani nie spadała, a pieczęć zostałaby nieosiągalna.
- **Aura czyta moc powiększoną o impuls.** Na surowej mocy każda pieczęć
  przygaszałaby aurę o swój koszt i wielokrotne rzucanie dawało coraz
  ciemniejszego szamana.
- **Skrzyżowanie rąk liczyć jako ZNAK iloczynu różnic**, nie kolejność x.
  Płótno ma scaleX(-1), więc sama kolejność daje w lustrze wynik odwrotny.
- **Minimum składowych, nie średnia.** Przy średniej ręce opuszczone
  punktowały na 2/3 tylko dlatego, że ramię jest proste.
```

W §7 („Dalszy rozwój") zamień punkt 1 na:

```
1. **Więcej pieczęci i technik** — rejestr, składanie i kombosy działają; dokładanie wiersza do tabeli wystarczy
```

- [ ] **Krok 9: Commit**

```bash
git add GEMINI.md
git commit -m "GEMINI.md opisuje warstwę pieczęci

Pięć pułapek zmierzonych przy budowie - zamrożenie zaniku, odmrożenie
przy pustym zbiorniku, impuls w aurze, skrzyżowanie w lustrze i minimum
zamiast średniej."
```

---

## Samoprzegląd planu

**Pokrycie spec:**

| Sekcja spec | Zadanie |
|---|---|
| §2 Pętla rozgrywki | 3 (zamrożenie), 8 (komunikaty) |
| §3 Zgodność z regułą nadrzędną | 1, 2 (ciągłość), 3 (zamrożenie), 4 (cisza poniżej progu), 5 (bufor) |
| §4 Architektura + układ plików | 1-8 |
| §5 Trzy pieczęcie + stronność + widoczność | 1, 2 |
| §6 Składanie (próg + tempo) | 4 |
| §6a Zamrożenie zaniku | 3 |
| §6b Aura na mocy opóźnionej | 6 |
| §7 Bramka mocy + `zuzyj(koszt)` | 3, 4, 8 |
| §8 Kombosy | 5 |
| §9 Testy | 1-6 (każde zadanie ma swój test) |
| §10 Liczby prowizoryczne + pola HUD | wszystkie (komentarze), 8 (HUD) |

**Zaślepki:** brak — każdy krok zawiera pełny kod albo dokładną komendę z oczekiwanym wyjściem.

**Spójność typów:**
- `perun/mokosz/weles` → `{ id, nazwa, wymaga:'pose', score(frame) }` — zgodne z `ZnakRegistry.zarejestruj`.
- `znaki.ocen(frame)` → `{[id]: 0..1}` → wejście `SkladaniePieczeci.update`. ✓
- `skl.zlozona` → `{ id, koszt }` → `motionMeter.zuzyj(koszt)`, `efekty.odpal(id)`, `kombosy.dodaj(id, now)`. ✓
- `kombosy.dodaj` → `{ id, nazwa, sekwencja }` → `efekty.odpal(technika.id)`; `TABELA` ma klucze `gromWZiemie`, `zewPodziemia` zgodne z `KOMBOSY[].id`. ✓
- `skladanie.zamrazaZanik` (pole) → trzeci argument `motionMeter.update`. ✓
- Helpery `postawa.js` importowane w `perun/mokosz/weles/efekty`; `efekty.js` importuje `NADG_L, NADG_P, BARK_L, BARK_P, BIODRO_L, BIODRO_P` — wszystkie eksportowane w Zadaniu 1. ✓
