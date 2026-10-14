# Jakość tańca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moc ładuje się szybciej za taniec bogaty (krążenie bez nawrotów, całe ciało, fala przez ciało), a wolniej za dzisiejszy exploit „ręce w górę i w dół” — balans „pośrodku” (~12 s vs ~6 s), bez żadnego stanu porażki.

**Architecture:** Nowy katalog `js/jakosc/` z czterema niezależnymi miarami (okres, krążenie, zaangażowanie, fala) o wspólnym kształcie `update(...) → 0..1 | null`, złożonymi przez `js/jakoscTanca.js` w `bogactwo` 0..1 i `mnoznik` 0.67..1.33. MotionMeter i Punktacja dostają mnożnik jako OPCJONALNY argument końcowy (domyślnie 1 = dzisiejsze zachowanie). Aura dostaje żar od `bogactwo`, nowy `js/blaskTanca.js` rysuje połysk partii ciała i bieg fali.

**Tech Stack:** Vanilla ES modules w przeglądarce, MediaPipe Pose (worldLandmarks 3D metryczne + landmarks 2D znormalizowane do płótna), testy jako skrypty `node tools/test-*.mjs` (bez frameworka, wzorzec `spr(opis, warunek)`), `sh tools/test-wszystko.sh` uruchamia wszystkie.

**Spec:** `docs/superpowers/specs/2026-10-14-jakosc-tanca-design.md`

## Global Constraints

- Reguła nadrzędna (GEMINI.md §2): każda miara ciągła 0..1, ruch ZAWSZE ładuje (najwolniej ≈ 0.25 × 0.67 ≈ 0.17 dzisiejszego tempa), nic nie mówi „źle”, punkty tylko przybywają.
- Mnożnik bogactwa przycięty do **[0.67, 1.33]**; bogactwo neutralne (brak danych) = środek kotwic → mnożnik **1.0**.
- Każdy nowy parametr istniejących funkcji jest **ostatni i ma wartość domyślną** dającą dzisiejsze zachowanie (`MotionMeter.update`, `Plynnosc.update`, `Punktacja.taniec`, `Aura.updateAndDraw`).
- Wszystkie stałe przed pomiarem na nagraniu są oznaczone w kodzie słowem **ZGADNIĘTE**.
- Pomiary ruchu tylko na x/y (`WAGA_Z = 0` w MotionMeter — z jednej kamery z to zgadywanie). 2D tylko dla bioder, przeliczone na piksele (`x·frame.width`, `y·frame.height`).
- Punkty z `visibility < 0.5` nie głosują w żadnej miarze.
- Każda wartość wyjściowa przez strażnika NaN (jedna klatka z NaN nie może zatruć stanu na stałe).
- Nowy moduł ze stanem rundy w `main.js` (`let x = new Klasa()`) = wpis w `KLUCZE_MODULOW`, w fabryce `swiezeModuly()`, w destrukturyzacji `resetujModuly()` i sprawdzenie bezczynności w `tools/test-swieze-moduly.mjs`.
- Id kroków nowego scenariusza nagraniowego z prefiksem `jakosc-` (kolizja etykiet z `test-rozdzielnosc`, `js/nagrywanie/sesja.js:107`).
- Komentarze i nazwy po polsku, w stylu otaczającego kodu (dlaczego, nie co; zmierzone vs ZGADNIĘTE).
- Brak efektów dźwiękowych (`tools/test-brak-efektow-dzwiekowych.mjs`).

## Review Focus

1. **Gracz stoi w miejscu albo wychodzi z kadru, potem wraca i tańczy** — mnożnik ma wrócić do ~1.0 (neutralny), a nie zostać na 0.67 z resztek szumu. Test w Task 6 (`JakoscTanca`: bezruch i brak pozy → mnożnik → 1).
2. **Spadek klatkażu / nieregularne dt** (karta w tle, 20 FPS) — okres liczony z rzeczywistych znaczników czasu, nie z liczby klatek; dt przycięte do 0.1 s. Test w Task 2 (okres przy 30 FPS) i Task 6 (dt = 2 s nie psuje stanu).
3. **Jedna ręka poza kadrem / stopy niewidoczne** (typowe przy kamerze laptopa) — zaangażowanie nóg = 0, ale reszta działa; krążenie liczy z widocznych stawów. Test w Task 4 (kostki z visibility 0).
4. **Gracz podchodzi bliżej kamery** — sygnał bioder w szerokościach barków nie może dać fałszywego ruchu ani zmienić wyniku ×2. Test w Task 4 (ta sama sylwetka w skali 0.5 → ten sam wynik bioder).
5. **Bardzo wolny taniec (okres > 2.5 s) albo chaotyczny bez okresu** — okres niepewny → fala `null`, płynność bez skalowania (×1), bogactwo z pozostałych składowych; nic nie spada do zera. Test w Task 5 (pewność 0 → fala null) i Task 7 (częstotliwość null → zachowanie jak dziś).

---

## File Structure

| Plik | Odpowiedzialność |
|---|---|
| `js/jakosc/pochodne.js` (nowy) | Wspólne: `pochodneSG` (wydzielone z płynności), `korelacjaZOpoznieniem` (wydzielone z falowania), `rampa`, `clamp01`, `srednia`, `odchylenie`, `widoczny` |
| `js/jakosc/cialo2d.js` (nowy) | 2D w pikselach: szerokość barków (wygładzona), środek bioder i średni x dłoni w szerokościach barków |
| `js/jakosc/okres.js` (nowy) | Dominujący okres ruchu z autokorelacji pozycji → `{okresS, pewnosc, czestotliwoscHz}` |
| `js/jakosc/krazenie.js` (nowy) | Krążenie bez nawrotów 0..1 (wahadło ≈ 0, okrąg ≈ 1) |
| `js/jakosc/zaangazowanie.js` (nowy) | 7 partii ciała → aktywności 0..1 i wynik `min(1, Σ/4)` |
| `js/jakosc/fala.js` (nowy) | Fala przez ciało: opóźnienie jako ułamek okresu na 3 łańcuchach |
| `js/jakoscTanca.js` (nowy) | Składanie: bogactwo, mnożnik, dryf do neutralnej |
| `js/blaskTanca.js` (nowy) | Połysk tańczących partii + bieg fali (kreska po węzłach) |
| `js/plynnosc.js` | Używa `pochodneSG` ze wspólnego; próg skalowany częstotliwością |
| `js/ruchy/falowanieRamion.js` | Używa `korelacjaZOpoznieniem` ze wspólnego (liczby identyczne) |
| `js/motionMeter.js` | `mnoznikBogactwa`, `mnoznikTransu` (gniazdo etapu 4), `tempoLadowania` |
| `js/punkty.js` | `taniec(..., mnoznik = 1)` |
| `js/aura.js` | `updateAndDraw(..., tecza, bogactwo = null)` — żar |
| `js/main.js`, `js/swiezeModuly.js` | Okablowanie, równy start rundy |
| `js/debugHud.js` | Sekcja „Jakość tańca”, klawisz J = sesja jakości |
| `js/nagrywanie/sesja.js` | `SCENARIUSZ_JAKOSC` |
| `tools/pomiar-jakosci.mjs` (nowy) | Rozkład składowych na nagraniach (nie test) |
| `tools/test-okres.mjs`, `test-krazenie.mjs`, `test-zaangazowanie.mjs`, `test-fala-ciala.mjs`, `test-jakosc-tanca.mjs`, `test-motion-mnozniki.mjs`, `test-blask-tanca.mjs`, `test-scenariusz-jakosci.mjs` (nowe) | Testy |
| `GEMINI.md` | Tabela modułów, schemat, lekcja o łuku wokół barku |

Wspólny generator szumu w testach (kopiowany do każdego pliku testu — testy w tym repo są samodzielne):

```js
// mulberry32 - patrz tools/test-plynnosc.mjs, dlaczego nie naiwny LCG.
let ziarno = 42;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => {
    const u = losowa() || 1e-9, v = losowa();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };
```
W planie niżej oznaczony jako `/* NAGŁÓWEK TESTU */` — wklej go dosłownie w tym miejscu.

---

### Task 1: Wspólne narzędzia `js/jakosc/pochodne.js` (refaktor bez zmiany liczb)

**Files:**
- Create: `js/jakosc/pochodne.js`
- Modify: `js/plynnosc.js` (metoda `_pochodneSG`, ok. linie 199–225)
- Modify: `js/ruchy/falowanieRamion.js` (pętla korelacji w `zmierz()`, ok. linie 160–172)

**Interfaces:**
- Produces: `pochodneSG(hist: {x,y}[], dt: number) → {vx, vy, ax, ay}`; `korelacjaZOpoznieniem(a: number[], b: number[], maxLag: int) → {lag: int, k: number}` (szuka lag w [-maxLag, maxLag], b spóźnione o lag); `rampa(v, od, do) → 0..1` (NaN → 0); `clamp01(v)` (NaN → 0); `srednia(a)`; `odchylenie(a)`; `widoczny(p, prog = 0.5) → boolean`.

- [ ] **Step 1: Zapisz linię bazową liczb (przed refaktorem)**

```bash
SP=/private/tmp/claude-501/-Users-whomean-Documents-antigravity-powerball-app/6e684883-25aa-4d90-9e6a-55b74844f1fb/scratchpad
node tools/pomiar-falowania.mjs > $SP/falowanie-przed.txt
node tools/test-plynnosc.mjs > $SP/plynnosc-przed.txt
node tools/test-falowanie.mjs > $SP/test-falowanie-przed.txt
```
Expected: trzy pliki niepuste; `test-plynnosc` i `test-falowanie` kończą się kodem 0.

- [ ] **Step 2: Utwórz `js/jakosc/pochodne.js`**

```js
/**
 * Wspólne narzędzia miar ruchu (jakość tańca, płynność, falowanie ramion).
 *
 * Wydzielone 2026-10-14 z js/plynnosc.js (pochodneSG) i js/ruchy/falowanieRamion.js
 * (korelacja z opóźnieniem), bo jakość tańca potrzebuje obu. Arytmetyka przeniesiona
 * BEZ ZMIAN kolejności działań - tools/pomiar-falowania.mjs i test-plynnosc.mjs
 * mają dawać identyczne liczby jak przed wydzieleniem.
 */

export const rampa = (v, od, doo) =>
    Number.isFinite(v) ? Math.max(0, Math.min(1, (v - od) / (doo - od))) : 0;

export const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function srednia(a) { let s = 0; for (const v of a) s += v; return s / a.length; }

export function odchylenie(a) {
    const m = srednia(a); let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    return Math.sqrt(s / a.length);
}

/** Punkt nadaje się do pomiaru: skończony i (jeśli wiadomo) dobrze widoczny. */
export function widoczny(p, prog = 0.5) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
           (p.visibility === undefined || p.visibility >= prog);
}

/**
 * Pochodne z dopasowania wielomianu 2. stopnia w oknie (Savitzky-Golay).
 *
 * Różnica sąsiednich klatek mnoży szum przez 1/dt przy każdym
 * różniczkowaniu - przy drugiej pochodnej to 3600x przy 60 FPS.
 * Dopasowanie wielomianu do całego okna wykorzystuje wszystkie próbki
 * i tłumi szum nieskorelowany zamiast go wzmacniać.
 */
export function pochodneSG(hist, dt) {
    const pol = (hist.length - 1) / 2;
    let n = 0, k2 = 0, k4 = 0;
    let s0x = 0, s0y = 0, s1x = 0, s1y = 0, s2x = 0, s2y = 0;

    for (let j = 0; j < hist.length; j++) {
        const k = j - pol;
        const y = hist[j];
        n++; k2 += k * k; k4 += k * k * k * k;
        s0x += y.x;         s0y += y.y;
        s1x += k * y.x;     s1y += k * y.y;
        s2x += k * k * y.x; s2y += k * k * y.y;
    }

    const mian = n * k4 - k2 * k2;
    return {
        vx: s1x / k2 / dt,
        vy: s1y / k2 / dt,
        ax: 2 * (n * s2x - k2 * s0x) / mian / (dt * dt),
        ay: 2 * (n * s2y - k2 * s0y) / mian / (dt * dt)
    };
}

/**
 * Korelacja wzajemna z przesunięciem: szukamy lag, przy którym b (spóźnione
 * o lag próbek) najlepiej pasuje do a. Dodatni lag = b SPÓŹNIA SIĘ za a.
 * @returns {{lag: number, k: number}} k w -1..1
 */
export function korelacjaZOpoznieniem(a, b, maxLag) {
    const n = a.length;
    const mA = srednia(a), mB = srednia(b);
    let najK = -Infinity, najLag = 0;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        let s = 0, sa = 0, sb = 0;
        for (let j = Math.max(0, -lag); j < n - Math.max(0, lag); j++) {
            const x = a[j] - mA, y = b[j + lag] - mB;
            s += x * y; sa += x * x; sb += y * y;
        }
        const k = s / (Math.sqrt(sa * sb) + 1e-9);
        if (k > najK) { najK = k; najLag = lag; }
    }
    return { lag: najLag, k: najK };
}
```

- [ ] **Step 3: Przepnij `js/plynnosc.js` na wspólny filtr**

Na górze pliku dodaj import:
```js
import { pochodneSG } from './jakosc/pochodne.js';
```
Zastąp CAŁE ciało metody `_pochodneSG(hist, dt) { ... }` (zachowaj nad nią komentarz JSDoc, dopisz jedno zdanie):
```js
    /**
     * Pochodne z dopasowania wielomianu 2. stopnia w oknie (Savitzky-Golay).
     * Implementacja we wspólnym js/jakosc/pochodne.js (używa jej też jakość tańca).
     */
    _pochodneSG(hist, dt) {
        return pochodneSG(hist, dt);
    }
```

- [ ] **Step 4: Przepnij `js/ruchy/falowanieRamion.js` na wspólną korelację**

Dodaj import na górze:
```js
import { korelacjaZOpoznieniem } from '../jakosc/pochodne.js';
```
W `zmierz(buf)` zastąp blok od `const mU = srednia(ku), mF = srednia(kf);` do zamykającej klamry pętli `for (let lag ...)` włącznie:
```js
    const maxLag = Math.min(Math.floor(MAX_OPOZNIENIA_S / dtSr), Math.floor(n / 3));
    const { lag: najLag, k: najK } = korelacjaZOpoznieniem(ku, kf, maxLag);
```
(Zachowaj komentarz „Korelacja wzajemna kąta ramienia i przedramienia…” nad tym blokiem. Lokalne `srednia`, `odchylenie`, `rampa`, `widoczny` w tym pliku zostają — nie ruszamy reszty.)

- [ ] **Step 5: Sprawdź, że liczby są identyczne**

```bash
SP=/private/tmp/claude-501/-Users-whomean-Documents-antigravity-powerball-app/6e684883-25aa-4d90-9e6a-55b74844f1fb/scratchpad
node tools/pomiar-falowania.mjs | diff $SP/falowanie-przed.txt - && \
node tools/test-plynnosc.mjs | diff $SP/plynnosc-przed.txt - && \
node tools/test-falowanie.mjs | diff $SP/test-falowanie-przed.txt - && echo IDENTYCZNE
```
Expected: `IDENTYCZNE`, brak różnic. Jeśli jest różnica — kolejność działań nie została zachowana; popraw, nie akceptuj „prawie”.

- [ ] **Step 6: Pełny zestaw testów i commit**

Run: `sh tools/test-wszystko.sh` — Expected: wszystkie ✓.
```bash
git add js/jakosc/pochodne.js js/plynnosc.js js/ruchy/falowanieRamion.js
git commit -m "Jakość tańca: wspólne pochodne.js (filtr SG i korelacja z opóźnieniem), liczby identyczne"
```

---

### Task 2: Okres ruchu `js/jakosc/okres.js`

**Files:**
- Create: `js/jakosc/okres.js`
- Test: `tools/test-okres.mjs`

**Interfaces:**
- Consumes: `clamp01` z `js/jakosc/pochodne.js`.
- Produces: `class Okres { okresS: number (start 1), pewnosc: 0..1, get czestotliwoscHz(): number|null, update(worldLandmarks|null, dt): this }`; `export const PROG_PEWNOSCI = 0.4`; `export const NASTAWY_OKRESU`.

- [ ] **Step 1: Napisz test `tools/test-okres.mjs`**

```js
/**
 * Okres ruchu - dominujący okres tańca z autokorelacji POZYCJI.
 *
 *   node tools/test-okres.mjs
 *
 * Pułapki pilnowane tutaj:
 *  - autokorelacja |v| daje dla kołysania PÓŁ okresu (|cos| powtarza się co T/2),
 *  - dla okręgu ze stałą prędkością |v| jest płaskie - brak szczytu,
 *  - drugi szczyt (2T) bywa minimalnie wyższy od pierwszego - ma wygrać pierwszy.
 */
import { Okres, PROG_PEWNOSCI } from '../js/jakosc/okres.js';

/* NAGŁÓWEK TESTU */

const SIGMA = 0.009;
const STAWY = [15, 16, 13, 14, 27, 28];

function przebieg(tor, { fps = 60, sekund = 8 } = {}) {
    const m = new Okres();
    const dt = 1 / fps;
    for (let i = 0; i < sekund * fps; i++) {
        const t = i * dt;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        STAWY.forEach((j, n) => {
            const [x, y] = tor(t, n);
            w[j] = { x: x + gauss() * SIGMA, y: y + gauss() * SIGMA, z: 0, visibility: 0.9 };
        });
        m.update(w, dt);
    }
    return m;
}

const kolysanie = (f) => (t, n) => [0.25 * Math.sin(2 * Math.PI * f * t + n * 0.3) * (n % 2 ? -1 : 1), 0];
const okrag = (f) => (t) => [0.25 * Math.cos(2 * Math.PI * f * t), 0.25 * Math.sin(2 * Math.PI * f * t)];
const blisko = (a, b, tol) => Math.abs(a - b) / b <= tol;

for (const f of [0.5, 1, 2]) {
    const m = przebieg(kolysanie(f));
    spr(`kołysanie ${f} Hz -> okres ${m.okresS.toFixed(3)} s (cel ${(1 / f).toFixed(3)}), pewność ${m.pewnosc.toFixed(2)}`,
        blisko(m.okresS, 1 / f, 0.08) && m.pewnosc > 0.6);
}
{
    const m = przebieg(okrag(1));
    spr(`okrąg 1 Hz (stała prędkość) -> okres ${m.okresS.toFixed(3)} s, pewność ${m.pewnosc.toFixed(2)}`,
        blisko(m.okresS, 1, 0.08) && m.pewnosc > 0.6);
}
{
    const m = przebieg(kolysanie(1), { fps: 30 });
    spr(`30 FPS: kołysanie 1 Hz -> ${m.okresS.toFixed(3)} s (okres z czasu, nie z liczby klatek)`,
        blisko(m.okresS, 1, 0.08));
}
{
    const m = przebieg(() => [0, 0]);
    spr(`bezruch: pewność ${m.pewnosc.toFixed(2)} < próg ${PROG_PEWNOSCI}, częstotliwość null`,
        m.pewnosc < PROG_PEWNOSCI && m.czestotliwoscHz === null);
}
{
    const m = przebieg(kolysanie(1));
    spr('częstotliwość = 1/okres przy pewnym okresie', Math.abs(m.czestotliwoscHz - 1 / m.okresS) < 1e-9);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
    for (let i = 0; i < 120; i++) m.update(zle, 1 / 60);
    m.update(null, 1 / 60);
    m.update(null, 0);
    m.update(null, NaN);
    spr('NaN / null / dt=0 nie psują stanu', Number.isFinite(m.okresS) && Number.isFinite(m.pewnosc));
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `node tools/test-okres.mjs`
Expected: FAIL — `Cannot find module '.../js/jakosc/okres.js'`.

- [ ] **Step 3: Zaimplementuj `js/jakosc/okres.js`**

```js
/**
 * Okres ruchu - dominujący okres tańca (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Klocek wspólny: fala przez ciało liczy opóźnienie jako UŁAMEK tego okresu,
 * płynność skaluje nim próg szarpnięcia, a w etapie 2 ten sam okres będzie
 * "pulsem tańca" (źródło rytmu, gdy nie gra żadna muzyka).
 *
 * Autokorelacja POZYCJI, nie prędkości:
 *  - |v| kołysania powtarza się co PÓŁ okresu (|cos|) - dawałoby 2x częstotliwość,
 *  - |v| okręgu ze stałą prędkością jest płaskie - nie miałoby szczytu wcale.
 * Każdy staw i każda oś to osobna seria (po odjęciu średniej) - ręce w przeciwfazie
 * się nie znoszą, bo autokorelacja każdej serii jest dodatnia przy jej okresie.
 */
import { clamp01 } from './pochodne.js';

const STAWY = [15, 16, 13, 14, 27, 28]; // nadgarstki, łokcie, kostki

export const NASTAWY_OKRESU = {
    OKNO_S: 4.0,
    MIN_OKRES_S: 0.25,
    MAX_OKRES_S: 2.5,
    CO_ILE_S: 0.25,          // autokorelacja co tyle, nie co klatkę
    MIN_ODCHYLENIE_M: 0.03,  // seria o mniejszym rozrzucie to szum (sigma ~0.009 m) - nie głosuje
    BLISKO_SZCZYTU: 0.85,    // pierwszy szczyt >= 85% najwyższego wygrywa - bez tego czasem 2T
    MIN_ROZPIETOSC_S: 1.5,   // okno krótsze niż tyle nie orzeka
    ZANIK_PEWNOSCI_S: 2.0,   // bez pozy pewność gaśnie do zera w tyle
    PROG_WIDOCZNOSCI: 0.5
};
export const PROG_PEWNOSCI = 0.4;

const N = NASTAWY_OKRESU;
const zdrowy = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
                      (p.visibility === undefined || p.visibility >= N.PROG_WIDOCZNOSCI);

export class Okres {
    constructor() {
        this.okresS = 1;
        this.pewnosc = 0;
        this._bufor = [];        // [{t, p: ([x, y] | null)[]}]
        this._t = 0;
        this._doPrzeliczenia = 0;
    }

    /** null, gdy okres niepewny - konsument ma wtedy zachować się jak dziś. */
    get czestotliwoscHz() {
        return this.pewnosc >= PROG_PEWNOSCI && this.okresS > 0 ? 1 / this.okresS : null;
    }

    update(world, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this;
        const krok = Math.min(dt, 0.1);
        this._t += krok;

        if (!world) {
            this._bufor.length = 0;
            this.pewnosc = Math.max(0, this.pewnosc - krok / N.ZANIK_PEWNOSCI_S);
            return this;
        }

        this._bufor.push({ t: this._t, p: STAWY.map(i => (zdrowy(world[i]) ? [world[i].x, world[i].y] : null)) });
        while (this._bufor.length && this._t - this._bufor[0].t > N.OKNO_S) this._bufor.shift();

        this._doPrzeliczenia -= krok;
        if (this._doPrzeliczenia <= 0) {
            this._doPrzeliczenia = N.CO_ILE_S;
            this._przelicz();
        }
        return this;
    }

    _przelicz() {
        const b = this._bufor, n = b.length;
        if (n < 8 || b[n - 1].t - b[0].t < N.MIN_ROZPIETOSC_S) { this.pewnosc = 0; return; }
        const dtSr = (b[n - 1].t - b[0].t) / (n - 1);
        if (!(dtSr > 0)) { this.pewnosc = 0; return; }

        const serie = [];
        for (let s = 0; s < STAWY.length; s++) {
            for (let os = 0; os < 2; os++) {
                const x = new Float64Array(n);
                let pelna = true, suma = 0;
                for (let j = 0; j < n; j++) {
                    const p = b[j].p[s];
                    if (!p) { pelna = false; break; }
                    x[j] = p[os]; suma += x[j];
                }
                if (!pelna) continue;
                const m = suma / n;
                let war = 0;
                for (let j = 0; j < n; j++) { x[j] -= m; war += x[j] * x[j]; }
                if (Math.sqrt(war / n) < N.MIN_ODCHYLENIE_M) continue;
                serie.push(x);
            }
        }
        if (!serie.length) { this.pewnosc = 0; return; }

        const lagMin = Math.max(1, Math.round(N.MIN_OKRES_S / dtSr));
        const lagMax = Math.min(Math.floor(n * 0.6), Math.round(N.MAX_OKRES_S / dtSr));
        if (lagMax - lagMin < 2) { this.pewnosc = 0; return; }

        const r = new Float64Array(lagMax + 2);
        for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
            if (lag < 1 || lag >= n) continue;
            let s = 0, e1 = 0, e2 = 0;
            for (const x of serie) {
                for (let j = 0; j + lag < n; j++) {
                    s += x[j] * x[j + lag]; e1 += x[j] * x[j]; e2 += x[j + lag] * x[j + lag];
                }
            }
            r[lag] = s / (Math.sqrt(e1 * e2) + 1e-12);
        }

        const szczyt = (lag) => r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1];
        let najR = -Infinity;
        for (let lag = lagMin; lag <= lagMax; lag++) if (szczyt(lag) && r[lag] > najR) najR = r[lag];
        if (!(najR > 0)) { this.pewnosc = 0; return; }

        let wybrany = -1;
        for (let lag = lagMin; lag <= lagMax; lag++) {
            if (szczyt(lag) && r[lag] >= N.BLISKO_SZCZYTU * najR) { wybrany = lag; break; }
        }
        if (wybrany < 0) { this.pewnosc = 0; return; }

        // Doprecyzowanie parabolą przez trzy punkty - bez tego okres skacze o całą klatkę.
        const a = r[wybrany - 1], c = r[wybrany], d = r[wybrany + 1];
        const mian = a - 2 * c + d;
        const delta = mian < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - d) / mian)) : 0;
        const okres = (wybrany + delta) * dtSr;
        if (Number.isFinite(okres) && okres > 0) this.okresS = okres;
        this.pewnosc = clamp01(c);
    }
}
```

- [ ] **Step 4: Uruchom test**

Run: `node tools/test-okres.mjs`
Expected: wszystkie ✓. Jeśli 2 Hz wychodzi 1.0 s — `BLISKO_SZCZYTU` za nisko; jeśli okrąg ma pewność < 0.6 — sprawdź, czy serie x i y są osobno.

- [ ] **Step 5: Commit**

```bash
git add js/jakosc/okres.js tools/test-okres.mjs
git commit -m "Jakość tańca: okres ruchu z autokorelacji pozycji (kołysanie i okrąg, odporny na FPS)"
```

---

### Task 3: Krążenie bez nawrotów `js/jakosc/krazenie.js`

**Files:**
- Create: `js/jakosc/krazenie.js`
- Test: `tools/test-krazenie.mjs`

**Interfaces:**
- Consumes: `clamp01`, `widoczny` z `js/jakosc/pochodne.js`.
- Produces: `class Krazenie { krazenie: number|null, aktywnychStawow: int, update(worldLandmarks|null, dt): number|null }`; `export const NASTAWY_KRAZENIA`.

- [ ] **Step 1: Napisz test `tools/test-krazenie.mjs`**

```js
/**
 * Krążenie bez nawrotów - "łuki zamiast linii".
 *
 *   node tools/test-krazenie.mjs
 *
 * NAJWAŻNIEJSZY przypadek to "łuk prostej ręki wokół barku": dzisiejszy exploit
 * (wysokie podnoszenie i opuszczanie rąk) kreśli ŁUK, nie linię. Miara oparta na
 * przyspieszeniu normalnym (krzywiźnie) dawałaby mu wysoki wynik - dlatego mierzymy
 * NAWROTY: czy staw wraca po tym samym torze w przeciwną stronę.
 */
import { Krazenie } from '../js/jakosc/krazenie.js';

/* NAGŁÓWEK TESTU */

const SIGMA = 0.009, FPS = 60, DT = 1 / FPS;

/** tor(t, strona) -> {nadgarstek:[x,y], lokiec:[x,y]}; strona 1 = L, -1 = P */
function przebieg(tor, sekund = 8) {
    const m = new Krazenie();
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 })); // kostki niewidoczne
        for (const [nad, lok, strona] of [[15, 13, 1], [16, 14, -1]]) {
            const p = tor(t, strona);
            if (!p) continue;
            w[nad] = { x: p.nadgarstek[0] + gauss() * SIGMA, y: p.nadgarstek[1] + gauss() * SIGMA, z: 0, visibility: 0.9 };
            w[lok] = { x: p.lokiec[0] + gauss() * SIGMA, y: p.lokiec[1] + gauss() * SIGMA, z: 0, visibility: 0.9 };
        }
        m.update(w, DT);
    }
    return m;
}

const om = 2 * Math.PI * 0.8;
const BAREK = (s) => [0.18 * s, -0.45];
// Prosta ręka z dołu prawie do pionu i z powrotem: kąt od ~10° do ~170° (y w dół).
const lukWokolBarku = (t, s) => {
    const th = Math.PI / 2 + 1.4 * Math.sin(om * t);
    const [bx, by] = BAREK(s);
    return { nadgarstek: [bx + s * 0.6 * Math.sin(th), by + 0.6 * Math.cos(th)],
             lokiec:     [bx + s * 0.3 * Math.sin(th), by + 0.3 * Math.cos(th)] };
};
const pompowanie = (t, s) => ({ nadgarstek: [0.25 * s, -0.4 + 0.3 * Math.sin(om * t)],
                                lokiec:     [0.30 * s, -0.25 + 0.12 * Math.sin(om * t)] });
const okrag = (t, s) => ({ nadgarstek: [0.35 * s + 0.25 * Math.cos(om * t), -0.3 + 0.25 * Math.sin(om * t)],
                           lokiec:     [0.28 * s + 0.12 * Math.cos(om * t), -0.25 + 0.12 * Math.sin(om * t)] });
const osemka = (t, s) => ({ nadgarstek: [0.35 * s + 0.3 * Math.sin(om * t), -0.3 + 0.15 * Math.sin(2 * om * t)],
                            lokiec:     [0.28 * s + 0.15 * Math.sin(om * t), -0.25 + 0.07 * Math.sin(2 * om * t)] });
const bezruch = (t, s) => ({ nadgarstek: [0.3 * s, -0.2], lokiec: [0.25 * s, -0.3] });

const w = {};
for (const [nazwa, tor] of Object.entries({ lukWokolBarku, pompowanie, okrag, osemka, bezruch })) {
    w[nazwa] = przebieg(tor);
    const k = w[nazwa].krazenie;
    console.log(`  ${nazwa.padEnd(16)} krążenie ${k === null ? 'null' : k.toFixed(2)}  stawów ${w[nazwa].aktywnychStawow}`);
}
spr('łuk prostej ręki wokół barku (exploit) ma niskie krążenie (< 0.2)', w.lukWokolBarku.krazenie !== null && w.lukWokolBarku.krazenie < 0.2);
spr('pompowanie góra-dół ma niskie krążenie (< 0.15)', w.pompowanie.krazenie !== null && w.pompowanie.krazenie < 0.15);
spr('okrąg ma wysokie krążenie (> 0.85)', w.okrag.krazenie > 0.85);
spr('ósemka ma wysokie krążenie (> 0.6)', w.osemka.krazenie > 0.6);
spr('ranking: okrąg > ósemka > łuk', w.okrag.krazenie > w.osemka.krazenie && w.osemka.krazenie > w.lukWokolBarku.krazenie);
spr('bezruch nie głosuje (null, 0 stawów)', w.bezruch.krazenie === null && w.bezruch.aktywnychStawow === 0);

{
    const m = przebieg(okrag);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
    for (let i = 0; i < 60; i++) m.update(zle, DT);
    m.update(null, DT); m.update(null, 0); m.update(null, NaN);
    spr('NaN / null / dt=0 nie zatruwają stanu', m.krazenie === null || Number.isFinite(m.krazenie));
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `node tools/test-krazenie.mjs` — Expected: FAIL (brak modułu).

- [ ] **Step 3: Zaimplementuj `js/jakosc/krazenie.js`**

```js
/**
 * Krążenie bez nawrotów - "łuki zamiast linii" (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * DLACZEGO NIE KRZYWIZNA: dzisiejszy exploit (wysokie podnoszenie i opuszczanie
 * prostych rąk) kreśli ŁUK wokół barku, który ma duże przyspieszenie normalne.
 * Udział a_n dawałby mu wynik jak kręgom. Różnicą jest NAWRÓT: wahadło wraca
 * po tym samym torze w PRZECIWNĄ stronę, okrąg i ósemka wracają w tę samą.
 *
 * Miara: dla każdej próbki i bierzemy PIERWSZY późniejszy powrót stawu w to
 * samo miejsce (dalej niż MIN_ODSTEP_S w czasie, bliżej niż promień "tego samego
 * miejsca") i porównujemy kierunki prędkości:
 *   wynik = (Σ v_i·v_j / Σ |v_i||v_j| + 1) / 2
 * Wahadło: pierwszy powrót to droga z powrotem -> cos = -1 -> 0.
 * Okrąg: pierwszy powrót to następne okrążenie -> cos = +1 -> 1.
 * Ósemka: wysoko (na skrzyżowaniu kierunki różnią się o ~90°, wszędzie indziej zgodne).
 * Bezwymiarowe - tempo tańca go nie zmienia.
 */
import { clamp01, widoczny } from './pochodne.js';

const STAWY = [15, 16, 13, 14, 27, 28];

export const NASTAWY_KRAZENIA = {
    OKNO_S: 4.0,             // musi objąć ponad jeden cykl, inaczej okrąg nie ma "powrotu"
    CO_ILE_S: 0.25,
    POL_ROZNICY_S: 0.08,     // prędkość z różnicy centralnej +-tyle
    MIN_ODSTEP_S: 0.15,      // krótszy odstęp to ta sama chwila, nie powrót
    BLISKO_UL: 0.2,          // "to samo miejsce" = 20% rozrzutu stawu...   (ZGADNIĘTE)
    BLISKO_MIN_M: 0.03,      // ...ale nie mniej niż 3 cm (szum ~0.9 cm)
    PROG_PREDKOSCI: 0.18,    // m/s średnio - jak w płynności: wolniejszy staw nie głosuje
    MIN_ROZPIETOSC_S: 1.0,
    TAU_S: 0.8               // wygładzanie wyniku
};
const N = NASTAWY_KRAZENIA;

export class Krazenie {
    constructor() {
        this.krazenie = null;       // null = brak danych (bezruch, poza kadrem)
        this.aktywnychStawow = 0;
        this._bufory = STAWY.map(() => []);   // [{t, x, y}]
        this._t = 0;
        this._doPrzeliczenia = 0;
    }

    update(world, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.krazenie;
        const krok = Math.min(dt, 0.1);
        this._t += krok;

        for (let s = 0; s < STAWY.length; s++) {
            const p = world?.[STAWY[s]];
            const buf = this._bufory[s];
            if (!widoczny(p)) { buf.length = 0; continue; }   // przerwa = okno od nowa
            buf.push({ t: this._t, x: p.x, y: p.y });
            while (buf.length && this._t - buf[0].t > N.OKNO_S) buf.shift();
        }

        this._doPrzeliczenia -= krok;
        if (this._doPrzeliczenia > 0) return this.krazenie;
        this._doPrzeliczenia = N.CO_ILE_S;

        let S = 0, W = 0, aktywne = 0;
        for (const buf of this._bufory) {
            const r = ocenStaw(buf);
            if (!r) continue;
            S += r.s; W += r.w; aktywne++;
        }
        this.aktywnychStawow = aktywne;
        if (!(W > 0)) { this.krazenie = null; return null; }

        const surowe = clamp01((S / W + 1) / 2);
        const a = Math.min(1, N.CO_ILE_S / N.TAU_S);
        this.krazenie = this.krazenie === null ? surowe : this.krazenie + a * (surowe - this.krazenie);
        if (!Number.isFinite(this.krazenie)) this.krazenie = null;
        return this.krazenie;
    }
}

function ocenStaw(buf) {
    const n = buf.length;
    if (n < 10 || buf[n - 1].t - buf[0].t < N.MIN_ROZPIETOSC_S) return null;
    const dtSr = (buf[n - 1].t - buf[0].t) / (n - 1);
    const k = Math.max(1, Math.round(N.POL_ROZNICY_S / dtSr));

    const v = [];
    let sumaV = 0, mx = 0, my = 0;
    for (let j = k; j < n - k; j++) {
        const a = buf[j - k], b = buf[j + k];
        const dt = b.t - a.t;
        const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
        v.push({ t: buf[j].t, x: buf[j].x, y: buf[j].y, vx, vy, m: Math.hypot(vx, vy) });
        sumaV += Math.hypot(vx, vy); mx += buf[j].x; my += buf[j].y;
    }
    if (v.length < 4 || sumaV / v.length < N.PROG_PREDKOSCI) return null;

    mx /= v.length; my /= v.length;
    let war = 0;
    for (const p of v) war += (p.x - mx) ** 2 + (p.y - my) ** 2;
    const promien = Math.max(N.BLISKO_MIN_M, N.BLISKO_UL * Math.sqrt(war / v.length));

    let s = 0, w = 0;
    for (let i = 0; i < v.length; i++) {
        const a = v[i];
        for (let j = i + 1; j < v.length; j++) {
            const b = v[j];
            if (b.t - a.t < N.MIN_ODSTEP_S) continue;
            if (Math.hypot(b.x - a.x, b.y - a.y) > promien) continue;
            s += a.vx * b.vx + a.vy * b.vy;
            w += a.m * b.m;
            break;  // tylko PIERWSZY powrót - dalsze to kolejne okrążenia wahadła
        }
    }
    return w > 0 && Number.isFinite(s) ? { s, w } : null;
}
```

- [ ] **Step 4: Uruchom test**

Run: `node tools/test-krazenie.mjs` — Expected: wszystkie ✓. Jeśli ósemka < 0.6, podnieś `BLISKO_UL` do 0.25 (mniej par na skrzyżowaniu nie zmienia rankingu); jeśli łuk > 0.2, obniż `MIN_ODSTEP_S` do 0.12. Każdą zmianę opisz w komentarzu przy stałej.

- [ ] **Step 5: Commit**

```bash
git add js/jakosc/krazenie.js tools/test-krazenie.mjs
git commit -m "Jakość tańca: krążenie bez nawrotów (łuk prostej ręki wokół barku ~0, okrąg ~1)"
```

---

### Task 4: Zaangażowanie ciała + 2D bioder (`js/jakosc/cialo2d.js`, `js/jakosc/zaangazowanie.js`)

**Files:**
- Create: `js/jakosc/cialo2d.js`
- Create: `js/jakosc/zaangazowanie.js`
- Test: `tools/test-zaangazowanie.mjs`

**Interfaces:**
- Consumes: `rampa`, `widoczny` z `js/jakosc/pochodne.js`.
- Produces:
  - `class Cialo2D { szerokoscPx: number|null, update(landmarks2d|null, W, H, dt): { biodra: {x,y}|null, dlonieX: number|null } }` — współrzędne w szerokościach barków, względem środka płótna.
  - `export const PARTIE = ['rekaL','rekaP','nogaL','nogaP','biodra','tulow','glowa']`
  - `class Zaangazowanie { zaangazowanie: number|null, aktywnosci: Record<partia, 0..1>, predkosci: Record<partia, number>, update(worldLandmarks|null, biodraBw: {x,y}|null, dt): number|null }`
  - `export const NASTAWY_ZAANGAZOWANIA`

- [ ] **Step 1: Napisz test `tools/test-zaangazowanie.mjs`**

```js
/**
 * Zaangażowanie ciała - ile partii tańczy.
 *
 *   node tools/test-zaangazowanie.mjs
 */
import { Zaangazowanie, PARTIE } from '../js/jakosc/zaangazowanie.js';
import { Cialo2D } from '../js/jakosc/cialo2d.js';

/* NAGŁÓWEK TESTU */

const SIGMA = 0.009, FPS = 60, DT = 1 / FPS;
const om = 2 * Math.PI * 0.8;

// Postawa stojąca w worldLandmarks (metry, y w dół, początek w biodrach).
const BAZA = { 0: [0, -0.62], 11: [0.18, -0.45], 12: [-0.18, -0.45], 13: [0.25, -0.2], 14: [-0.25, -0.2],
               15: [0.27, 0.02], 16: [-0.27, 0.02], 23: [0.1, 0], 24: [-0.1, 0],
               25: [0.11, 0.42], 26: [-0.11, 0.42], 27: [0.11, 0.82], 28: [-0.11, 0.82] };

/** ruch(t) -> {indeks: [dx, dy]} przesunięcia względem BAZY; biodra2d(t) -> {x,y}|null */
function przebieg(ruch, biodra2d = () => ({ x: 0, y: 0 }), { sekund = 6, widoczneNogi = true } = {}) {
    const m = new Zaangazowanie();
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const d = ruch(t);
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
        for (const [k, [x, y]] of Object.entries(BAZA)) {
            const [dx, dy] = d[k] ?? [0, 0];
            const noga = [25, 26, 27, 28].includes(Number(k));
            w[k] = { x: x + dx + gauss() * SIGMA, y: y + dy + gauss() * SIGMA, z: 0,
                     visibility: noga && !widoczneNogi ? 0 : 0.9 };
        }
        m.update(w, biodra2d(t), DT);
    }
    return m;
}

const rece = (t) => ({ 15: [0, 0.3 * Math.sin(om * t)], 16: [0, 0.3 * Math.sin(om * t)],
                       13: [0, 0.12 * Math.sin(om * t)], 14: [0, 0.12 * Math.sin(om * t)] });
const caleCialo = (t) => ({ ...rece(t),
    27: [0.15 * Math.sin(om * t), 0], 28: [0.15 * Math.sin(om * t + 1), 0],
    25: [0.08 * Math.sin(om * t), 0], 26: [0.08 * Math.sin(om * t + 1), 0],
    11: [0.06 * Math.sin(om * t), 0.03 * Math.sin(2 * om * t)], 12: [0.06 * Math.sin(om * t), -0.03 * Math.sin(2 * om * t)],
    0: [0.10 * Math.sin(om * t + 0.5), 0] });
const kolysanieBioder = (t) => ({ x: 0.5 * Math.sin(om * t), y: 0 });

const r = przebieg(rece);
const c = przebieg(caleCialo, kolysanieBioder);
const s = przebieg(() => ({}));
const fmt = (m) => PARTIE.map(p => `${p} ${m.aktywnosci[p].toFixed(2)}`).join('  ');
console.log('  same ręce:   ' + fmt(r) + `  => ${r.zaangazowanie?.toFixed(2)}`);
console.log('  całe ciało:  ' + fmt(c) + `  => ${c.zaangazowanie?.toFixed(2)}`);

spr(`same ręce dają ~0.5 (${r.zaangazowanie?.toFixed(2)})`, r.zaangazowanie > 0.35 && r.zaangazowanie < 0.65);
spr(`całe ciało z biodrami wyraźnie więcej (${c.zaangazowanie?.toFixed(2)})`, c.zaangazowanie > 0.85);
spr('kołysanie bioder w 2D zapala partię "biodra"', c.aktywnosci.biodra > 0.5 && r.aktywnosci.biodra < 0.1);
spr('bezruch (sam szum) = null, nic nie tańczy', s.zaangazowanie === null);
{
    const bezNog = przebieg(caleCialo, kolysanieBioder, { widoczneNogi: false });
    spr('stopy poza kadrem: nogi 0, reszta dalej działa',
        bezNog.aktywnosci.nogaL === 0 && bezNog.aktywnosci.nogaP === 0 && bezNog.zaangazowanie > 0.6);
}

console.log('\nCiało 2D - niezależne od odległości od kamery:');
function biodraZ2D(skala) {
    const c2 = new Cialo2D();
    const W = 1920, H = 1080;
    let maxV = 0, poprz = null;
    for (let i = 0; i < 4 * FPS; i++) {
        const t = i * DT;
        const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
        const px = (x, y) => ({ x: (960 + x * skala) / W, y: (540 + y * skala) / H, z: 0, visibility: 0.9 });
        const sway = 60 * Math.sin(om * t);  // px przy skali 1
        lm[11] = px(-100 + sway, -250); lm[12] = px(100 + sway, -250);
        lm[23] = px(-60 + sway, 0);     lm[24] = px(60 + sway, 0);
        lm[15] = px(-150 + sway, -50);  lm[16] = px(150 + sway, -50);
        const o = c2.update(lm, W, H, DT);
        if (poprz && o.biodra) maxV = Math.max(maxV, Math.abs(o.biodra.x - poprz.x) / DT);
        poprz = o.biodra;
    }
    return maxV;
}
const v1 = biodraZ2D(1), v05 = biodraZ2D(0.5);
spr(`prędkość bioder w szerokościach barków: skala 1 -> ${v1.toFixed(3)}, skala 0.5 -> ${v05.toFixed(3)} (różnica < 5%)`,
    Math.abs(v1 - v05) / v1 < 0.05);
{
    const c2 = new Cialo2D();
    const o = c2.update(null, 1920, 1080, DT);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: 0, visibility: 0.9 }));
    const o2 = c2.update(zle, 1920, 1080, DT);
    const o3 = c2.update(zle, 0, 0, DT);
    spr('Cialo2D: null / NaN / zerowe wymiary -> puste wyniki', o.biodra === null && o2.biodra === null && o3.biodra === null);
}
{
    const m = przebieg(rece);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 0.9 }));
    for (let i = 0; i < 30; i++) m.update(zle, { x: NaN, y: NaN }, DT);
    m.update(null, null, 0);
    spr('NaN nie zatruwa aktywności', PARTIE.every(p => Number.isFinite(m.aktywnosci[p])));
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `node tools/test-zaangazowanie.mjs` — Expected: FAIL (brak modułów).

- [ ] **Step 3: Zaimplementuj `js/jakosc/cialo2d.js`**

```js
/**
 * Ciało w 2D - tylko to, czego worldLandmarks NIE widzą.
 *
 * worldLandmarks mają początek układu w środku bioder, więc kroki i kołysanie
 * bioder są w nich niewidoczne (zastrzeżenie z nagłówka js/motionMeter.js).
 * Stąd landmarks 2D - ale te są znormalizowane OSOBNO do szerokości i wysokości
 * płótna, więc najpierw przeliczamy na piksele (x·W, y·H), a potem dzielimy przez
 * szerokość barków w pikselach: wynik nie zależy od odległości od kamery.
 * Współrzędne względem środka płótna - zmiana skali (krok do kamery) nie udaje
 * wtedy dużego ruchu.
 */
import { widoczny } from './pochodne.js';

const TAU_SZEROKOSCI_S = 1.0;   // szerokość barków zmienia się wolno - obrót nie może udawać ruchu

export class Cialo2D {
    constructor() {
        this.szerokoscPx = null;
    }

    /** @returns {{biodra: {x:number,y:number}|null, dlonieX: number|null}} w szerokościach barków */
    update(landmarks, W, H, dt) {
        const pusto = { biodra: null, dlonieX: null };
        if (!landmarks || !(W > 0) || !(H > 0)) return pusto;
        const px = (i) => (widoczny(landmarks[i]) ? { x: landmarks[i].x * W, y: landmarks[i].y * H } : null);

        const b1 = px(11), b2 = px(12);
        if (b1 && b2) {
            const s = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            if (Number.isFinite(s) && s > 1) {
                const a = Number.isFinite(dt) && dt > 0 ? Math.min(1, dt / TAU_SZEROKOSCI_S) : 0;
                this.szerokoscPx = this.szerokoscPx === null ? s : this.szerokoscPx + a * (s - this.szerokoscPx);
            }
        }
        const bw = this.szerokoscPx;
        if (!(bw > 1)) return pusto;

        const h1 = px(23), h2 = px(24), d1 = px(15), d2 = px(16);
        return {
            biodra: h1 && h2 ? { x: ((h1.x + h2.x) / 2 - W / 2) / bw, y: ((h1.y + h2.y) / 2 - H / 2) / bw } : null,
            dlonieX: d1 && d2 ? ((d1.x + d2.x) / 2 - W / 2) / bw : null
        };
    }
}
```

- [ ] **Step 4: Zaimplementuj `js/jakosc/zaangazowanie.js`**

```js
/**
 * Zaangażowanie ciała - ile partii tańczy (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Siedem partii, każda z CIĄGŁĄ aktywnością 0..1 (rampa prędkości ponad podłogą
 * szumu). Wynik min(1, Σ/4): cztery partie wystarczą do pełnej wartości - nie
 * trzeba ruszać wszystkim naraz. Same ręce ~0.5.
 *
 * Nowe partie idą do JAKOŚCI, nie do prędkości MotionMetera: szum bioder i głowy
 * nie może podnieść podłogi bezruchu (patrz PROG_SZUMU_MS w js/motionMeter.js).
 *
 * Sygnały: ręce, nogi, tułów, głowa z worldLandmarks (metry, x/y); biodra z 2D
 * (js/jakosc/cialo2d.js, szerokości barków/s) - world ich nie widzi.
 */
import { rampa, widoczny } from './pochodne.js';

export const PARTIE = ['rekaL', 'rekaP', 'nogaL', 'nogaP', 'biodra', 'tulow', 'glowa'];

// ZGADNIĘTE - stroić z nakładki D i tools/pomiar-jakosci.mjs.
export const NASTAWY_ZAANGAZOWANIA = {
    TAU_POZYCJI_S: 0.17,     // jak ALFA_POZYCJI MotionMetera: szum z ~1.2 do ~0.07 m/s
    TAU_PREDKOSCI_S: 0.5,
    PROGI: {                 // [od, do] - poniżej "od" szum, od "do" pełna aktywność
        reka:   [0.12, 0.45],    // m/s
        noga:   [0.10, 0.35],    // m/s
        biodra: [0.20, 0.80],    // szerokości barków / s (2D)
        tulow:  [0.10, 0.35],    // m/s (środek barków względem bioder; skręt przez SKALA_SKRETU_M)
        glowa:  [0.10, 0.30]     // m/s (nos względem środka barków) - różnica dwóch zaszumionych punktów, szum ~0.085
    },
    SKALA_SKRETU_M: 0.2,     // 1 rad skrętu barków względem bioder liczony jak 0.2 m ruchu
    PELNE_PRZY: 4,
    PROG_CISZY: 0.05         // suma aktywności poniżej = nic nie tańczy -> null (neutralnie)
};
const N = NASTAWY_ZAANGAZOWANIA;

/** Prędkość punktu: filtr dolnoprzepustowy na POZYCJI, potem różnica, potem wygładzenie. */
class SledzonaPredkosc {
    constructor() { this._p = null; this.v = 0; }
    update(p, dt) {
        const aV = Math.min(1, dt / N.TAU_PREDKOSCI_S);
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            this._p = null;
            this.v += aV * (0 - this.v);
            return this.v;
        }
        if (!this._p) { this._p = { x: p.x, y: p.y }; return this.v; }
        const a = Math.min(1, dt / N.TAU_POZYCJI_S);
        const nx = this._p.x + a * (p.x - this._p.x), ny = this._p.y + a * (p.y - this._p.y);
        const chwilowa = Math.hypot(nx - this._p.x, ny - this._p.y) / dt;
        this._p = { x: nx, y: ny };
        if (Number.isFinite(chwilowa)) this.v += aV * (chwilowa - this.v);
        return this.v;
    }
}

const katLinii = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const zawin = (k) => Math.atan2(Math.sin(k), Math.cos(k));

export class Zaangazowanie {
    constructor() {
        this.zaangazowanie = null;
        this.aktywnosci = Object.fromEntries(PARTIE.map(p => [p, 0]));
        this.predkosci = Object.fromEntries(PARTIE.map(p => [p, 0]));
        this._s = {
            rekaL: new SledzonaPredkosc(), rekaP: new SledzonaPredkosc(),
            kolanoL: new SledzonaPredkosc(), kolanoP: new SledzonaPredkosc(),
            kostkaL: new SledzonaPredkosc(), kostkaP: new SledzonaPredkosc(),
            biodra: new SledzonaPredkosc(), barki: new SledzonaPredkosc(),
            skret: new SledzonaPredkosc(), glowa: new SledzonaPredkosc()
        };
    }

    update(world, biodraBw, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.zaangazowanie;
        const krok = Math.min(dt, 0.1);
        const pt = (i) => (world && widoczny(world[i]) ? { x: world[i].x, y: world[i].y } : null);
        const sr = (a, b) => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);

        const b11 = pt(11), b12 = pt(12), h23 = pt(23), h24 = pt(24), nos = pt(0);
        const barki = sr(b11, b12);
        const skret = b11 && b12 && h23 && h24
            ? { x: zawin(katLinii(b11, b12) - katLinii(h23, h24)) * N.SKALA_SKRETU_M, y: 0 } : null;
        const glowa = nos && barki ? { x: nos.x - barki.x, y: nos.y - barki.y } : null;

        const S = this._s;
        const v = {
            rekaL: S.rekaL.update(pt(15), krok),
            rekaP: S.rekaP.update(pt(16), krok),
            nogaL: Math.max(S.kolanoL.update(pt(25), krok), S.kostkaL.update(pt(27), krok)),
            nogaP: Math.max(S.kolanoP.update(pt(26), krok), S.kostkaP.update(pt(28), krok)),
            biodra: S.biodra.update(world ? biodraBw : null, krok),
            tulow: Math.max(S.barki.update(barki, krok), S.skret.update(skret, krok)),
            glowa: S.glowa.update(glowa, krok)
        };
        const prog = { rekaL: 'reka', rekaP: 'reka', nogaL: 'noga', nogaP: 'noga', biodra: 'biodra', tulow: 'tulow', glowa: 'glowa' };

        let suma = 0;
        for (const p of PARTIE) {
            const [od, doo] = N.PROGI[prog[p]];
            const vp = Number.isFinite(v[p]) ? v[p] : 0;
            this.predkosci[p] = vp;
            // Niewidoczna partia (np. stopy poza kadrem) to 0, nie zgadywanie z resztki filtra.
            const brak = (p === 'nogaL' && !pt(25) && !pt(27)) || (p === 'nogaP' && !pt(26) && !pt(28));
            this.aktywnosci[p] = brak ? 0 : rampa(vp, od, doo);
            suma += this.aktywnosci[p];
        }

        this.zaangazowanie = !world || suma < N.PROG_CISZY ? null : Math.min(1, suma / N.PELNE_PRZY);
        return this.zaangazowanie;
    }
}
```

- [ ] **Step 5: Uruchom test**

Run: `node tools/test-zaangazowanie.mjs` — Expected: wszystkie ✓. Jeśli „same ręce” wychodzą powyżej 0.65 — tułów lub głowa łapią szum; podnieś ich `od` o 0.02 i opisz w komentarzu.

- [ ] **Step 6: Commit**

```bash
git add js/jakosc/cialo2d.js js/jakosc/zaangazowanie.js tools/test-zaangazowanie.mjs
git commit -m "Jakość tańca: zaangażowanie 7 partii ciała, biodra z 2D w szerokościach barków"
```

---

### Task 5: Fala przez ciało `js/jakosc/fala.js`

**Files:**
- Create: `js/jakosc/fala.js`
- Test: `tools/test-fala-ciala.mjs`

**Interfaces:**
- Consumes: `korelacjaZOpoznieniem`, `rampa`, `odchylenie`, `widoczny` z `pochodne.js`; `PROG_PEWNOSCI` z `okres.js`; obiekt `{biodra, dlonieX}` z `Cialo2D.update`; obiekt z polami `okresS`, `pewnosc` (instancja `Okres`).
- Produces: `class FalaCiala { fala: number|null, diagnostyka: {lancuch: string|null, opoznienieUlamek: number|null, korelacja: number|null}, update(worldLandmarks|null, c2d: {biodra, dlonieX}|null, okres: {okresS, pewnosc}|null, dt): number|null }`; `export const LANCUCHY = ['ramieL','ramieP','biodraDlonie']`; `export const NASTAWY_FALI`.

- [ ] **Step 1: Napisz test `tools/test-fala-ciala.mjs`**

```js
/**
 * Fala przez ciało - opóźnienie jako UŁAMEK cyklu.
 *
 *   node tools/test-fala-ciala.mjs
 *
 * Wąż ramienia zmierzony na nagraniu właściciela (js/ruchy/falowanieRamion.js):
 * opóźnienie 0.04-0.13 s przy ~0.8 Hz, czyli ~5-10% cyklu; sztywne skrzydło 0.
 */
import { FalaCiala } from '../js/jakosc/fala.js';

/* NAGŁÓWEK TESTU */

const SIGMA = 0.009, FPS = 30, DT = 1 / FPS, U = 0.28, F = 0.26;

/** katy(t) -> [ramię, przedramię] w rad (0 = poziomo w bok, + = w górę) - geometria z tools/pomiar-falowania.mjs */
function przebieg(katy, f, { c2d = () => null, pewnosc = 0.9, sekund = 8, ramiona = true } = {}) {
    const m = new FalaCiala();
    const okres = { okresS: 1 / f, pewnosc };
    for (let i = 0; i < sekund * FPS; i++) {
        const t = i * DT;
        const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: ramiona ? 1 : 0 }));
        if (ramiona) {
            for (const [bark, lok, nad, kier] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
                const [ku, kf] = katy(t);
                const B = { x: 0.18 * kier, y: -0.45 };
                const E = { x: B.x + kier * U * Math.cos(ku), y: B.y - U * Math.sin(ku) };
                const W = { x: E.x + kier * F * Math.cos(kf), y: E.y - F * Math.sin(kf) };
                for (const [id, p] of [[bark, B], [lok, E], [nad, W]]) {
                    w[id] = { x: p.x + SIGMA * gauss(), y: p.y + SIGMA * gauss(), z: 0, visibility: 1 };
                }
            }
        }
        m.update(w, c2d(t), okres, DT);
    }
    return m;
}

const waz = (f) => { const om = 2 * Math.PI * f; return (t) => [0.35 * Math.sin(om * t), 0.5 * Math.sin(om * t - 0.6)]; };
const skrzydlo = (f) => { const om = 2 * Math.PI * f; return (t) => { const k = 0.4 * Math.sin(om * t); return [k, k]; }; };

const w08 = przebieg(waz(0.8), 0.8);
const w16 = przebieg(waz(1.6), 1.6);
const s08 = przebieg(skrzydlo(0.8), 0.8);
const opis = (m) => `${m.fala === null ? 'null' : m.fala.toFixed(2)} (${m.diagnostyka.lancuch}, opóźn ${((m.diagnostyka.opoznienieUlamek ?? 0) * 100).toFixed(0)}% cyklu, kor ${(m.diagnostyka.korelacja ?? 0).toFixed(2)})`;
console.log(`  wąż 0.8 Hz:     ${opis(w08)}`);
console.log(`  wąż 1.6 Hz:     ${opis(w16)}`);
console.log(`  skrzydło 0.8:   ${opis(s08)}`);

spr('wąż daje wysoką falę (> 0.5)', w08.fala > 0.5);
spr('sztywne skrzydło daje ~0 (< 0.1)', s08.fala !== null && s08.fala < 0.1);
spr('ten sam wąż wolno i szybko - podobny wynik (różnica < 0.15)', Math.abs(w08.fala - w16.fala) < 0.15);

{
    const om = 2 * Math.PI * 0.8;
    const m = przebieg(() => [0, 0], 0.8, {
        ramiona: false,
        c2d: (t) => ({ biodra: { x: 0.3 * Math.sin(om * t), y: 0 }, dlonieX: 0.6 * Math.sin(om * t - 0.6) })
    });
    console.log(`  biodra -> dłonie: ${opis(m)}`);
    spr('fala z bioder do dłoni bez widocznych ramion (> 0.5, łańcuch biodraDlonie)', m.fala > 0.5 && m.diagnostyka.lancuch === 'biodraDlonie');
}
{
    const m = przebieg(waz(0.8), 0.8, { pewnosc: 0 });
    spr('okres niepewny -> fala null (neutralnie, nie zero)', m.fala === null);
}
{
    const m = przebieg(waz(0.8), 0.8);
    const zle = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 1 }));
    for (let i = 0; i < 30; i++) m.update(zle, { biodra: { x: NaN, y: NaN }, dlonieX: NaN }, { okresS: NaN, pewnosc: NaN }, DT);
    m.update(null, null, null, 0);
    spr('NaN nie zatruwa fali', m.fala === null || Number.isFinite(m.fala));
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `node tools/test-fala-ciala.mjs` — Expected: FAIL (brak modułu).

- [ ] **Step 3: Zaimplementuj `js/jakosc/fala.js`**

```js
/**
 * Fala przez ciało - czy ruch PRZEPŁYWA (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Uogólnienie wężowości z deszczu (js/ruchy/falowanieRamion.js) na trzy łańcuchy:
 *   ramieL / ramieP  - kąt ramienia -> kąt przedramienia (fala od barku do dłoni),
 *   biodraDlonie     - kołysanie bioder (2D) -> x dłoni (fala od bioder w ręce).
 * Wynik = najsilniejszy łańcuch: jedna fala wystarczy.
 *
 * Opóźnienie liczone jako UŁAMEK OKRESU (js/jakosc/okres.js), nie w sekundach:
 * wolna fala ma dłuższe opóźnienie, szybka krótsze, a obie są "wężem". Bez tego
 * szybka pieśń (etap 3) karałaby szybki taniec.
 * Sztywne skrzydło: opóźnienie 0 -> fala 0. Okres niepewny -> null (neutralnie).
 */
import { korelacjaZOpoznieniem, rampa, odchylenie, widoczny } from './pochodne.js';
import { PROG_PEWNOSCI } from './okres.js';

export const LANCUCHY = ['ramieL', 'ramieP', 'biodraDlonie'];

// ZGADNIĘTE poza OPOZN_* (z nagrania deszczu: wąż ~5-10% cyklu, skrzydło 0).
export const NASTAWY_FALI = {
    OKRESOW_W_OKNIE: 2.5, MIN_OKNO_S: 2.0, MAX_OKNO_S: 5.0,
    CO_ILE_S: 0.1,
    MIN_PROBEK: 20,
    MIN_AMPL: { ramie: 0.08, biodra: 0.05, dlonie: 0.10 },   // rad / szer. barków
    KORELACJA_OD: 0.45, KORELACJA_DO: 0.80,
    OPOZN_OD: 0.02, OPOZN_PELNE: 0.06,                      // ułamek cyklu
    OPOZN_SPADEK_OD: 0.25, OPOZN_SPADEK_DO: 0.35,           // dalej to dwa niezależne ruchy, nie fala
    MAX_OPOZNIENIA_ULAMEK: 0.4,
    TAU_S: 0.8
};
const N = NASTAWY_FALI;

const RAMIONA = { ramieL: [11, 13, 15, 12], ramieP: [12, 14, 16, 11] };

export class FalaCiala {
    constructor() {
        this.fala = null;
        this.diagnostyka = { lancuch: null, opoznienieUlamek: null, korelacja: null };
        this._bufory = Object.fromEntries(LANCUCHY.map(l => [l, []]));   // [{t, a, b}]
        this._t = 0;
        this._doPrzeliczenia = 0;
    }

    update(world, c2d, okres, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.fala;
        const krok = Math.min(dt, 0.1);
        this._t += krok;

        for (const [l, [bark, lok, nad, drugi]] of Object.entries(RAMIONA)) {
            const B = world?.[bark], E = world?.[lok], W = world?.[nad], B2 = world?.[drugi];
            if (!widoczny(B) || !widoczny(E) || !widoczny(W) || !widoczny(B2)) { this._bufory[l].length = 0; continue; }
            // Ta sama konwencja kątów co falowanieRamion.js: 0 = poziomo w bok, + = w górę (y w dół).
            const kier = Math.sign(B.x - B2.x) || 1;
            const ku = Math.atan2(-(E.y - B.y), kier * (E.x - B.x));
            const kf = Math.atan2(-(W.y - E.y), kier * (W.x - E.x));
            if (Number.isFinite(ku) && Number.isFinite(kf)) this._bufory[l].push({ t: this._t, a: ku, b: kf });
        }
        const bio = c2d?.biodra, dl = c2d?.dlonieX;
        if (bio && Number.isFinite(bio.x) && Number.isFinite(dl)) this._bufory.biodraDlonie.push({ t: this._t, a: bio.x, b: dl });
        else this._bufory.biodraDlonie.length = 0;

        const T = Number.isFinite(okres?.okresS) && okres.okresS > 0 ? okres.okresS : 1;
        const oknoS = Math.max(N.MIN_OKNO_S, Math.min(N.MAX_OKNO_S, N.OKRESOW_W_OKNIE * T));
        for (const b of Object.values(this._bufory)) while (b.length && this._t - b[0].t > oknoS) b.shift();

        this._doPrzeliczenia -= krok;
        if (this._doPrzeliczenia > 0) return this.fala;
        this._doPrzeliczenia = N.CO_ILE_S;

        if (!(okres?.pewnosc >= PROG_PEWNOSCI)) return this._brak();

        let naj = null;
        for (const l of LANCUCHY) {
            const [minA, minB] = l === 'biodraDlonie' ? [N.MIN_AMPL.biodra, N.MIN_AMPL.dlonie] : [N.MIN_AMPL.ramie, N.MIN_AMPL.ramie];
            const r = ocen(this._bufory[l], T, minA, minB);
            if (r && (!naj || r.q > naj.q)) naj = { ...r, l };
        }
        if (!naj) return this._brak();

        this.diagnostyka = { lancuch: naj.l, opoznienieUlamek: naj.ul, korelacja: naj.k };
        const a = Math.min(1, N.CO_ILE_S / N.TAU_S);
        this.fala = this.fala === null ? naj.q : this.fala + a * (naj.q - this.fala);
        if (!Number.isFinite(this.fala)) this.fala = null;
        return this.fala;
    }

    _brak() {
        this.fala = null;
        this.diagnostyka = { lancuch: null, opoznienieUlamek: null, korelacja: null };
        return null;
    }
}

function ocen(buf, T, minA, minB) {
    const n = buf.length;
    if (n < N.MIN_PROBEK) return null;
    const dtSr = (buf[n - 1].t - buf[0].t) / (n - 1);
    if (!(dtSr > 0)) return null;
    const a = buf.map(p => p.a), b = buf.map(p => p.b);
    if (odchylenie(a) < minA || odchylenie(b) < minB) return null;
    const maxLag = Math.max(1, Math.min(Math.floor(N.MAX_OPOZNIENIA_ULAMEK * T / dtSr), Math.floor(n / 3)));
    const { lag, k } = korelacjaZOpoznieniem(a, b, maxLag);
    const ul = (lag * dtSr) / T;
    const q = rampa(k, N.KORELACJA_OD, N.KORELACJA_DO) *
              rampa(ul, N.OPOZN_OD, N.OPOZN_PELNE) *
              (1 - rampa(ul, N.OPOZN_SPADEK_OD, N.OPOZN_SPADEK_DO));
    return Number.isFinite(q) ? { q, ul, k } : null;
}
```

- [ ] **Step 4: Uruchom test**

Run: `node tools/test-fala-ciala.mjs` — Expected: wszystkie ✓. (Wąż w teście ma przesunięcie fazy 0.6 rad = 9.5% cyklu — w środku pasma.)

- [ ] **Step 5: Commit**

```bash
git add js/jakosc/fala.js tools/test-fala-ciala.mjs
git commit -m "Jakość tańca: fala przez ciało (ramiona, biodra->dłonie), opóźnienie jako ułamek cyklu"
```

---

### Task 6: Składanie `js/jakoscTanca.js`

**Files:**
- Create: `js/jakoscTanca.js`
- Test: `tools/test-jakosc-tanca.mjs`

**Interfaces:**
- Consumes: `Okres` (Task 2), `Krazenie` (Task 3), `Cialo2D`, `Zaangazowanie` (Task 4), `FalaCiala` (Task 5), `clamp01` (Task 1).
- Produces:
  - `export const NASTAWY_JAKOSCI = { WAGI, KOTWICA_NISKA, KOTWICA_WYSOKA, MNOZNIK_NISKI, MNOZNIK_WYSOKI, TAU_S, TAU_POWROTU_S }`
  - `export const BOGACTWO_NEUTRALNE`
  - `export function mnoznikZBogactwa(b: number): number` (NaN → 1, przycięte do [0.67, 1.33])
  - `export function zlozBogactwo({krazenie, zaangazowanie, fala}): number|null` (średnia ważona po nie-null, wagi renormalizowane)
  - `class JakoscTanca { okres: Okres, krazenieMiara: Krazenie, zaangazowanieMiara: Zaangazowanie, falaMiara: FalaCiala, bogactwo: number, mnoznik: number, skladowe: {krazenie, zaangazowanie, fala}, get czestotliwoscHz(): number|null, update(frame|null, dt): number /* mnoznik */ }`

- [ ] **Step 1: Napisz test `tools/test-jakosc-tanca.mjs`**

```js
/**
 * Jakość tańca - składanie składowych w mnożnik tempa ładowania.
 *
 *   node tools/test-jakosc-tanca.mjs
 *
 * Kotwice: góra-dół -> 0.67 (~12 s do pełnego paska), piękny taniec -> 1.33 (~6 s),
 * brak danych -> 1.0 (dzisiejsze tempo). Decyzja właściciela 2026-10-14: "pośrodku".
 */
import { JakoscTanca, NASTAWY_JAKOSCI as N, BOGACTWO_NEUTRALNE, mnoznikZBogactwa, zlozBogactwo } from '../js/jakoscTanca.js';

/* NAGŁÓWEK TESTU */

console.log('KOTWICE:');
spr('kotwica niska -> 0.67', Math.abs(mnoznikZBogactwa(N.KOTWICA_NISKA) - 0.67) < 1e-9);
spr('kotwica wysoka -> 1.33', Math.abs(mnoznikZBogactwa(N.KOTWICA_WYSOKA) - 1.33) < 1e-9);
spr('neutralne -> 1.0', Math.abs(mnoznikZBogactwa(BOGACTWO_NEUTRALNE) - 1) < 1e-9);
spr('przycięcie: 0 -> 0.67, 1 -> 1.33', mnoznikZBogactwa(0) === 0.67 && mnoznikZBogactwa(1) === 1.33);
spr('NaN -> 1 (dzisiejsze tempo)', mnoznikZBogactwa(NaN) === 1);

console.log('\nSKŁADANIE:');
spr('wszystko null -> null', zlozBogactwo({ krazenie: null, zaangazowanie: null, fala: null }) === null);
const w = N.WAGI;
spr('pełny zestaw = średnia ważona',
    Math.abs(zlozBogactwo({ krazenie: 1, zaangazowanie: 0.5, fala: 0 }) - (w.krazenie + 0.5 * w.zaangazowanie)) < 1e-9);
spr('brak fali -> wagi renormalizowane po reszcie',
    Math.abs(zlozBogactwo({ krazenie: 0, zaangazowanie: 1, fala: null }) - w.zaangazowanie / (w.krazenie + w.zaangazowanie)) < 1e-9);
spr('NaN w składowej traktowany jak brak', zlozBogactwo({ krazenie: NaN, zaangazowanie: 1, fala: null }) === 1);

console.log('\nCAŁOŚĆ NA SYNTETYKACH:');
const SIGMA = 0.009, FPS = 60, DT = 1 / FPS, om = 2 * Math.PI * 0.8;
const BAZA = { 0: [0, -0.62], 11: [0.18, -0.45], 12: [-0.18, -0.45], 13: [0.25, -0.2], 14: [-0.25, -0.2],
               15: [0.27, 0.02], 16: [-0.27, 0.02], 23: [0.1, 0], 24: [-0.1, 0],
               25: [0.11, 0.42], 26: [-0.11, 0.42], 27: [0.11, 0.82], 28: [-0.11, 0.82] };

/** cialo(t) -> {world: {i: [x,y]}, przesuniecie: m (kołysanie bioder w kadrze)} */
function klatka(cialo, t) {
    const { pozycje, przesuniecie = 0 } = cialo(t);
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
    for (const [k, [x0, y0]] of Object.entries(BAZA)) {
        const [x, y] = pozycje[k] ?? [x0, y0];
        world[k] = { x: x + gauss() * SIGMA, y: y + gauss() * SIGMA, z: 0, visibility: 0.9 };
        // 2D izotropowe w px: 672 px na metr przy 1920x1080
        lm[k] = { x: (960 + (x + przesuniecie) * 672) / 1920, y: (540 + y * 672) / 1080, z: 0, visibility: 0.9 };
    }
    return { hands: [], pose: { worldLandmarks: world, landmarks: lm }, width: 1920, height: 1080, dt: DT, now: t * 1000 };
}
function przebieg(cialo, sekund = 10) {
    const j = new JakoscTanca();
    for (let i = 0; i < sekund * FPS; i++) j.update(klatka(cialo, i * DT), DT);
    return j;
}

// Exploit: proste ręce szerokim łukiem wokół barków, reszta ciała stoi.
const goraDol = (t) => {
    const th = Math.PI / 2 + 1.4 * Math.sin(om * t);
    const p = {};
    for (const [bark, lok, nad, s] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
        const [bx, by] = BAZA[bark];
        p[lok] = [bx + s * 0.3 * Math.sin(th), by + 0.3 * Math.cos(th)];
        p[nad] = [bx + s * 0.6 * Math.sin(th), by + 0.6 * Math.cos(th)];
    }
    return { pozycje: p };
};
// Bogaty taniec: ręce w kręgach, kroki, kołysanie bioder w kadrze, ruch barków i głowy.
const bogaty = (t) => {
    const p = {};
    for (const [bark, lok, nad, s] of [[11, 13, 15, 1], [12, 14, 16, -1]]) {
        const [bx, by] = BAZA[bark];
        p[lok] = [bx + s * 0.1 + 0.12 * Math.cos(om * t), by + 0.25 + 0.12 * Math.sin(om * t)];
        p[nad] = [bx + s * 0.2 + 0.25 * Math.cos(om * t - 0.6), by + 0.25 + 0.25 * Math.sin(om * t - 0.6)];
    }
    p[27] = [BAZA[27][0] + 0.15 * Math.sin(om * t), BAZA[27][1]];
    p[28] = [BAZA[28][0] + 0.15 * Math.sin(om * t + 1), BAZA[28][1]];
    p[11] = [BAZA[11][0] + 0.06 * Math.sin(om * t), BAZA[11][1]];
    p[12] = [BAZA[12][0] + 0.06 * Math.sin(om * t), BAZA[12][1]];
    p[0] = [BAZA[0][0] + 0.10 * Math.sin(om * t + 0.5), BAZA[0][1]];
    return { pozycje: p, przesuniecie: 0.15 * Math.sin(om * t) };
};
const gd = przebieg(goraDol), bg = przebieg(bogaty);
const opis = (j) => `bogactwo ${j.bogactwo.toFixed(2)} mnożnik ${j.mnoznik.toFixed(2)}  ` +
    Object.entries(j.skladowe).map(([k, v]) => `${k} ${v === null ? 'null' : v.toFixed(2)}`).join(' ');
console.log(`  góra-dół: ${opis(gd)}`);
console.log(`  bogaty:   ${opis(bg)}`);
spr('góra-dół ładuje wolniej niż dziś (mnożnik < 0.85)', gd.mnoznik < 0.85);
spr('bogaty taniec ładuje szybciej niż dziś (mnożnik > 1.1)', bg.mnoznik > 1.1);

console.log('\nNEUTRALNOŚĆ I ODPORNOŚĆ:');
{
    const j = new JakoscTanca();
    spr('świeża instancja: mnożnik 1, bogactwo neutralne', j.mnoznik === 1 && j.bogactwo === BOGACTWO_NEUTRALNE);
    for (let i = 0; i < 10 * FPS; i++) j.update(klatka(goraDol, i * DT), DT);
    for (let i = 0; i < 10 * FPS; i++) j.update({ hands: [], pose: null, width: 1920, height: 1080, dt: DT }, DT);
    spr(`po wyjściu z kadru mnożnik wraca do ~1 (${j.mnoznik.toFixed(2)})`, Math.abs(j.mnoznik - 1) < 0.05);
    for (let i = 0; i < 10 * FPS; i++) j.update(klatka(goraDol, i * DT), DT);
    const stoi = (t) => ({ pozycje: {} });
    for (let i = 0; i < 12 * FPS; i++) j.update(klatka(stoi, i * DT), DT);
    spr(`po staniu w miejscu mnożnik wraca do ~1 (${j.mnoznik.toFixed(2)})`, Math.abs(j.mnoznik - 1) < 0.05);
    j.update(null, DT); j.update(klatka(goraDol, 0), 2.0); j.update(klatka(goraDol, 0), NaN); j.update(klatka(goraDol, 0), 0);
    const zla = klatka(goraDol, 0);
    for (const p of zla.pose.worldLandmarks) p.x = NaN;
    for (let i = 0; i < 30; i++) j.update(zla, DT);
    spr('null / dt=2 s / NaN nie psują mnożnika', Number.isFinite(j.mnoznik) && j.mnoznik >= 0.67 && j.mnoznik <= 1.33);
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Uruchom — ma się wywalić**

Run: `node tools/test-jakosc-tanca.mjs` — Expected: FAIL (brak modułu).

- [ ] **Step 3: Zaimplementuj `js/jakoscTanca.js`**

```js
/**
 * Jakość tańca - mnożnik tempa ładowania mocy (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Etap 1 z 4 ("gra rozumie muzykę"). Składa trzy miary z js/jakosc/ w BOGACTWO 0..1:
 *   krążenie       - łuki zamiast nawrotów (wahadło ~0, okrąg ~1),
 *   zaangażowanie  - ile partii ciała tańczy,
 *   fala           - czy ruch przepływa z opóźnieniem.
 * W etapie 3 dojdzie czwarta składowa (dopasowanie tempa) - jeden wpis w WAGI.
 *
 * ŚREDNIA WAŻONA, NIE ILOCZYN: brak fali nie zeruje łuków. Płynność NIE wchodzi
 * do średniej - zostaje osobnym czynnikiem w MotionMeter (wspPlynnosci 0.25..1),
 * inaczej szarpany taniec całym ciałem wychodził tak samo jak gładkie góra-dół.
 *
 * Brak danych (bezruch, poza kadrem) to NIE zły taniec: bogactwo dryfuje do
 * neutralnego, czyli mnożnik do 1.0 - dzisiejszego tempa. Nic nie mówi "źle".
 */
import { Okres } from './jakosc/okres.js';
import { Krazenie } from './jakosc/krazenie.js';
import { Cialo2D } from './jakosc/cialo2d.js';
import { Zaangazowanie } from './jakosc/zaangazowanie.js';
import { FalaCiala } from './jakosc/fala.js';

// ZGADNIĘTE - wagi i kotwice stroić z tools/pomiar-jakosci.mjs na nagraniu sesji J.
// Kotwice to BOGACTWO, przy którym mnożnik osiąga 0.67 / 1.33 (decyzja "pośrodku").
export const NASTAWY_JAKOSCI = {
    WAGI: { krazenie: 0.35, zaangazowanie: 0.35, fala: 0.30 },
    KOTWICA_NISKA: 0.20,     // góra-dół: krążenie ~0, zaangażowanie ~0.5, fala ~0
    KOTWICA_WYSOKA: 0.75,
    MNOZNIK_NISKI: 0.67,     // pełny pasek ~12 s zamiast ~8 s
    MNOZNIK_WYSOKI: 1.33,    // ~6 s
    TAU_S: 1.0,              // dłuższe niż cykl tańca (~1 s) - inaczej mnożnik faluje w takcie
    TAU_POWROTU_S: 2.0       // jak TAU_POWROTU płynności
};
const N = NASTAWY_JAKOSCI;
export const BOGACTWO_NEUTRALNE = (N.KOTWICA_NISKA + N.KOTWICA_WYSOKA) / 2;

export function mnoznikZBogactwa(b) {
    if (!Number.isFinite(b)) return 1;
    if (b <= N.KOTWICA_NISKA) return N.MNOZNIK_NISKI;
    if (b >= N.KOTWICA_WYSOKA) return N.MNOZNIK_WYSOKI;
    return N.MNOZNIK_NISKI + (N.MNOZNIK_WYSOKI - N.MNOZNIK_NISKI) * (b - N.KOTWICA_NISKA) / (N.KOTWICA_WYSOKA - N.KOTWICA_NISKA);
}

export function zlozBogactwo(skladowe) {
    let suma = 0, wagi = 0;
    for (const [k, w] of Object.entries(N.WAGI)) {
        const v = skladowe?.[k];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        suma += w * Math.max(0, Math.min(1, v));
        wagi += w;
    }
    return wagi > 0 ? suma / wagi : null;
}

export class JakoscTanca {
    constructor() {
        this.okres = new Okres();
        this.krazenieMiara = new Krazenie();
        this.zaangazowanieMiara = new Zaangazowanie();
        this.falaMiara = new FalaCiala();
        this._cialo = new Cialo2D();
        this.bogactwo = BOGACTWO_NEUTRALNE;
        this.mnoznik = 1;
        this.skladowe = { krazenie: null, zaangazowanie: null, fala: null };
    }

    /** Częstotliwość ruchu dla płynności - null, gdy okres niepewny. */
    get czestotliwoscHz() { return this.okres.czestotliwoscHz; }

    /** @returns {number} mnożnik tempa ładowania 0.67..1.33 */
    update(frame, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.mnoznik;
        const krok = Math.min(dt, 0.1);
        const world = frame?.pose?.worldLandmarks ?? null;
        const c2d = this._cialo.update(frame?.pose?.landmarks ?? null, frame?.width, frame?.height, krok);

        this.okres.update(world, krok);
        this.skladowe = {
            krazenie: this.krazenieMiara.update(world, krok),
            zaangazowanie: this.zaangazowanieMiara.update(world, c2d.biodra, krok),
            fala: this.falaMiara.update(world, c2d, this.okres, krok)
        };

        const cel = zlozBogactwo(this.skladowe);
        const tau = cel === null ? N.TAU_POWROTU_S : N.TAU_S;
        const nowe = this.bogactwo + Math.min(1, krok / tau) * ((cel ?? BOGACTWO_NEUTRALNE) - this.bogactwo);
        if (Number.isFinite(nowe)) this.bogactwo = nowe;
        this.mnoznik = mnoznikZBogactwa(this.bogactwo);
        return this.mnoznik;
    }
}
```

- [ ] **Step 4: Uruchom test**

Run: `node tools/test-jakosc-tanca.mjs` — Expected: wszystkie ✓.
Jeśli „góra-dół < 0.85” nie przechodzi: wydrukowane składowe pokażą winną (najczęściej zaangażowanie tułowia/głowy łapie ruch barków przy podnoszeniu rąk) — popraw próg tej partii w `NASTAWY_ZAANGAZOWANIA`, NIE kotwice. Jeśli „stanie w miejscu → ~1” nie przechodzi: któraś miara nie zwraca `null` przy bezruchu.

- [ ] **Step 5: Commit**

```bash
git add js/jakoscTanca.js tools/test-jakosc-tanca.mjs
git commit -m "Jakość tańca: składanie w bogactwo i mnożnik 0.67..1.33, dryf do neutralnego"
```

---

### Task 7: Płynność skalowana częstotliwością ruchu

**Files:**
- Modify: `js/plynnosc.js` (nagłówek stałych, `update()`, linia `const cel = ...`)
- Test: `tools/test-plynnosc.mjs` (dopisanie sekcji przed `process.exit`)

**Interfaces:**
- Consumes: `JakoscTanca.czestotliwoscHz` (Task 6) — w main.js (Task 9).
- Produces: `Plynnosc.update(worldLandmarks, dt, czestotliwoscHz = null)`; pole `skalaProgu: number` (1 bez częstotliwości).

- [ ] **Step 1: Dopisz test do `tools/test-plynnosc.mjs`** (przed `process.exit(ok ? 0 : 1);`)

```js
// 7. Skalowanie progiem częstotliwości (2026-10-14, jakość tańca).
//    Szarpnięcie = rms(a_t)/średnia(v) rośnie LINIOWO z częstotliwością ruchu
//    (v ~ Aω, a ~ Aω²), więc bez skalowania szybki, gładki taniec wyglądał na
//    szarpany - a przy szybkiej pieśni (etap 3) ma być premiowany.
function przebiegF(f, czest) {
    const m = new Plynnosc();
    for (let i = 0; i < N; i++) {
        const t = i * DT;
        const x = 0.3 * Math.sin(2 * Math.PI * f * t);
        const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        for (const j of SLEDZONE) lm[j] = { x: x + gauss() * SIGMA, y: gauss() * SIGMA, z: 0, visibility: 0.9 };
        m.update(lm, DT, czest);
    }
    return m;
}
const wolne = przebiegF(1, 1), szybkieBez = przebiegF(2, null), szybkieZ = przebiegF(2, 2);
spr(`szybkie (2 Hz) gładkie kołysanie ze skalowaniem nie gorsze niż wolne: ${szybkieZ.plynnosc.toFixed(2)} vs ${wolne.plynnosc.toFixed(2)}`,
    szybkieZ.plynnosc >= wolne.plynnosc - 0.05);
spr(`skalowanie działa: bez częstotliwości ${szybkieBez.plynnosc.toFixed(2)} < z częstotliwością ${szybkieZ.plynnosc.toFixed(2)}`,
    szybkieBez.plynnosc < szybkieZ.plynnosc);
spr('bez częstotliwości skala progu = 1 (dzisiejsze zachowanie)', szybkieBez.skalaProgu === 1);
spr('skala przycięta do [0.5, 2]', przebiegF(1, 10).skalaProgu === 2 && przebiegF(1, 0.1).skalaProgu === 0.5);
spr('NaN jako częstotliwość = skala 1', przebiegF(1, NaN).skalaProgu === 1);
```

- [ ] **Step 2: Uruchom — nowe sprawdzenia mają się wywalić**

Run: `node tools/test-plynnosc.mjs` — Expected: stare ✓, nowe ✗ (`skalaProgu` undefined / brak różnicy).

- [ ] **Step 3: Zaimplementuj w `js/plynnosc.js`**

Pod `const PROG_SZARPNIECIA = 60;` dodaj:
```js
// Szarpnięcie rośnie LINIOWO z częstotliwością ruchu (v ~ Aω, a_t ~ Aω²), więc
// PROG_SZARPNIECIA (dobrany przy ~1 Hz) karał szybki, gładki taniec. Gdy okres
// ruchu jest pewny (js/jakosc/okres.js), próg skaluje się o f / 1 Hz, przycięte
// do [0.5, 2]. Bez częstotliwości - skala 1, czyli zachowanie sprzed 2026-10-14.
const CZESTOTLIWOSC_ODNIESIENIA_HZ = 1.0;
const SKALA_PROGU_MIN = 0.5, SKALA_PROGU_MAX = 2.0;
```
W konstruktorze, pod `this.zaWolno = false;`:
```js
        this.skalaProgu = 1;      // mnożnik PROG_SZARPNIECIA z częstotliwości ruchu
```
Zmień sygnaturę i JSDoc `update`:
```js
    /**
     * @param {Array} worldLandmarks  metryczne 3D z MediaPipe (może być null)
     * @param {number} dt             krok czasu [s]
     * @param {number|null} [czestotliwoscHz]  dominująca częstotliwość ruchu (JakoscTanca); null = bez skalowania
     * @returns {number} płynność 0..1
     */
    update(worldLandmarks, dt, czestotliwoscHz = null) {
        this.skalaProgu = Number.isFinite(czestotliwoscHz) && czestotliwoscHz > 0
            ? Math.max(SKALA_PROGU_MIN, Math.min(SKALA_PROGU_MAX, czestotliwoscHz / CZESTOTLIWOSC_ODNIESIENIA_HZ))
            : 1;
```
(reszta ciała `update` bez zmian), a linię:
```js
        const cel = 1 - Math.min(1, Math.max(0, this.szarpniecie / PROG_SZARPNIECIA));
```
zastąp:
```js
        const cel = 1 - Math.min(1, Math.max(0, this.szarpniecie / (PROG_SZARPNIECIA * this.skalaProgu)));
```

- [ ] **Step 4: Uruchom testy**

Run: `node tools/test-plynnosc.mjs && node tools/test-podloga.mjs` — Expected: wszystkie ✓ (stare wywołania bez trzeciego argumentu = skala 1).

- [ ] **Step 5: Commit**

```bash
git add js/plynnosc.js tools/test-plynnosc.mjs
git commit -m "Płynność: próg szarpnięcia skalowany częstotliwością ruchu (szybki gładki taniec nie traci)"
```

---

### Task 8: Mnożniki w MotionMeter i Punktacji

**Files:**
- Modify: `js/motionMeter.js` (konstruktor, `update`)
- Modify: `js/punkty.js` (`taniec`)
- Test: `tools/test-motion-mnozniki.mjs` (nowy), `tools/test-punkty.mjs` (dopisanie sekcji)

**Interfaces:**
- Consumes: `JakoscTanca.mnoznik` (w main.js, Task 9).
- Produces: `MotionMeter.update(frame, plynnosc = 1, zamrozZanik = false, mnoznikBogactwa = 1, mnoznikTransu = 1)`; pola `mnoznikBogactwa`, `mnoznikTransu`, `tempoLadowania` (ułamek paska/s, bez zaniku); `Punktacja.taniec(plynnosc, responsywnosc, dt, mnoznik = 1)`.

- [ ] **Step 1: Napisz test `tools/test-motion-mnozniki.mjs`**

```js
/**
 * Mnożniki tempa ładowania w MotionMeter (jakość tańca, gniazdo transu).
 *
 *   node tools/test-motion-mnozniki.mjs
 *
 * Domyślne argumenty = dokładnie dzisiejsze zachowanie. Mnożnik zmienia TEMPO,
 * nigdy nie zatrzymuje ładowania (GEMINI.md §2).
 */
import { MotionMeter } from '../js/motionMeter.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60, SL = [15, 16, 13, 14, 27, 28];
const cialo = t => { const l = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
    for (const i of SL) l[i] = { x: 0.35 * Math.sin(2 * Math.PI * t), y: 0, z: 0, visibility: 0.9 }; return l; };
const klatka = (i) => ({ hands: [], pose: { landmarks: [], worldLandmarks: cialo(i * DT) }, width: 1920, height: 1080, dt: DT, now: i * DT * 1000 });

function ladujDo(args, maxS = 180) {
    const m = new MotionMeter();
    for (let i = 0; i < maxS / DT; i++) {
        m.update(klatka(i), ...args);
        if (m.moc >= 0.99) return { t: i * DT, m };
    }
    return { t: null, m };
}
const dzis = ladujDo([1]).t;
const jawnie = ladujDo([1, false, 1, 1]).t;
const nisko = ladujDo([1, false, 0.67]).t;
const wysoko = ladujDo([1, false, 1.33]).t;
const najwolniej = ladujDo([0, false, 0.67]).t;
const zNaN = ladujDo([1, false, NaN, NaN]).t;
console.log(`  dziś ${dzis?.toFixed(1)} s · ×0.67 ${nisko?.toFixed(1)} s · ×1.33 ${wysoko?.toFixed(1)} s · szarpane ×0.67 ${najwolniej?.toFixed(1)} s`);

spr('domyślne argumenty = jawne 1, 1 (dzisiejsze zachowanie)', dzis === jawnie);
spr('×0.67 ładuje ~1.5× dłużej', nisko / dzis > 1.4 && nisko / dzis < 1.6);
spr('×1.33 ładuje ~0.75× czasu', wysoko / dzis > 0.7 && wysoko / dzis < 0.8);
spr('szarpany ruch przy ×0.67 NADAL ładuje (nic nie mówi źle)', najwolniej !== null);
spr('NaN jako mnożnik = 1', zNaN === dzis);
{
    const { m } = ladujDo([1, false, 1.33]);
    spr('tempoLadowania jest skończone i dodatnie przy ruchu', Number.isFinite(m.tempoLadowania) && m.tempoLadowania > 0);
    spr('mnożniki zapamiętane do HUD', m.mnoznikBogactwa === 1.33 && m.mnoznikTransu === 1);
}
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Dopisz do `tools/test-punkty.mjs`** (przed końcowym `process.exit`)

```js
console.log('\nMNOŻNIK JAKOŚCI TAŃCA (2026-10-14):');
{
    const a = new Punktacja(), b = new Punktacja(), c = new Punktacja(), d = new Punktacja();
    a.taniec(0.8, 0.9, 0.05);
    b.taniec(0.8, 0.9, 0.05, 1);
    c.taniec(0.8, 0.9, 0.05, 1.33);
    d.taniec(0.8, 0.9, 0.05, NaN);
    spr('bez mnożnika = mnożnik 1 (zmierzony balans Kroniki zostaje)', a.wynik === b.wynik);
    spr('mnożnik 1.33 NIE jest przycinany do 1', Math.abs(c.wynik / a.wynik - 1.33) < 1e-9);
    spr('NaN = 1', d.wynik === a.wynik);
    const e = new Punktacja();
    e.taniec(0.8, 0.9, 0.05, -1);
    spr('ujemny mnożnik nie odejmuje punktów', e.wynik === 0);
}
```

- [ ] **Step 3: Uruchom — mają się wywalić**

Run: `node tools/test-motion-mnozniki.mjs; node tools/test-punkty.mjs` — Expected: ✗ przy ×0.67/×1.33, `tempoLadowania`, mnożniku 1.33 w punktach.

- [ ] **Step 4: Zaimplementuj w `js/motionMeter.js`**

W konstruktorze, pod `this.wspolczynnikPlynnosci = 1;`:
```js
        this.mnoznikBogactwa = 1;   // z js/jakoscTanca.js - łuki, całe ciało, fala (0.67..1.33)
        this.mnoznikTransu = 1;     // gniazdo etapu 4 (trans w rytmie) - do tego czasu zawsze 1
        this.tempoLadowania = 0;    // ułamek paska/s bez zaniku - do HUD ("pełny pasek za ~X s")
```
Zmień sygnaturę `update` i dopisz parametry do JSDoc:
```js
     * @param {number} [mnoznikBogactwa]  0.67..1.33 z JakoscTanca; 1 = zachowanie sprzed 2026-10-14
     * @param {number} [mnoznikTransu]    gniazdo etapu 4; 1 = brak transu
     */
    update(frame, plynnosc = 1, zamrozZanik = false, mnoznikBogactwa = 1, mnoznikTransu = 1) {
```
Zaraz po `this.wspolczynnikPlynnosci = wsp;`:
```js
        // Mnożniki TEMPA, nie progi: przycięte z dołu powyżej zera, więc ruch zawsze ładuje.
        this.mnoznikBogactwa = Number.isFinite(mnoznikBogactwa) ? Math.max(0.5, Math.min(2, mnoznikBogactwa)) : 1;
        this.mnoznikTransu = Number.isFinite(mnoznikTransu) ? Math.max(1, Math.min(3, mnoznikTransu)) : 1;
```
W gałęzi `if (!pose || !pose.worldLandmarks) {` dopisz przed `return this.moc;`:
```js
            this.tempoLadowania = 0;
```
Linię `const przyrost = PRZYROST * this.responsywnosc * wsp;` zastąp:
```js
        const przyrost = PRZYROST * this.responsywnosc * wsp * this.mnoznikBogactwa * this.mnoznikTransu;
        this.tempoLadowania = przyrost;
```

- [ ] **Step 5: Zaimplementuj w `js/punkty.js`**

Zastąp metodę `taniec`:
```js
    /**
     * Strumień za taniec. `mnoznik` = mnożnik jakości tańca (js/jakoscTanca.js, 0.67..1.33) -
     * te same kotwice co tempo ładowania. Przycięty do [0, 2], NIE do 1; domyślnie 1 =
     * zmierzony balans sprzed 2026-10-14 (Kronika, Kamienie Pamięci).
     */
    taniec(plynnosc, responsywnosc, dt, mnoznik = 1) {
        if (!this.aktywna || !Number.isFinite(dt) || dt <= 0) return 0;
        const m = Number.isFinite(mnoznik) ? Math.max(0, Math.min(2, mnoznik)) : 1;
        return this._dodaj('taniec',
            PUNKTY_TANCA_NA_S * clamp01(plynnosc) * clamp01(responsywnosc) * m * Math.min(dt, MAX_DT_TANCA_S));
    }
```

- [ ] **Step 6: Uruchom testy**

Run: `node tools/test-motion-mnozniki.mjs && node tools/test-punkty.mjs && node tools/test-podloga.mjs && node tools/test-nan.mjs` — Expected: wszystkie ✓.

- [ ] **Step 7: Commit**

```bash
git add js/motionMeter.js js/punkty.js tools/test-motion-mnozniki.mjs tools/test-punkty.mjs
git commit -m "MotionMeter i punkty: opcjonalny mnożnik jakości tańca (+ gniazdo transu), domyślnie jak dziś"
```

---

### Task 9: Okablowanie w grze + równy start rundy + nakładka D

**Files:**
- Modify: `js/main.js` (import ~linia 5–6, deklaracje ~148–149, `resetujModuly()` ~565, pętla kroki 4/6/7/7d/8 ~780–1200)
- Modify: `js/swiezeModuly.js` (import, `KLUCZE_MODULOW`, fabryka)
- Modify: `tools/test-swieze-moduly.mjs` (sprawdzenie bezczynności)
- Modify: `js/debugHud.js` (sekcja w `updatePanel`, po bloku płynności)

**Interfaces:**
- Consumes: `JakoscTanca` (Task 6), `Plynnosc.update(..., czestotliwoscHz)` (Task 7), `MotionMeter.update(..., mnoznikBogactwa)`, `Punktacja.taniec(..., mnoznik)` (Task 8), `PARTIE` (Task 4).
- Produces: zmienna `jakoscTanca` w main.js; `stats.jakosc = {bogactwo, mnoznik, skladowe, aktywnosci, fala: {lancuch, opoznienieUlamek, korelacja}, okresS, pewnosc, tempoLadowania}` w nakładce.

- [ ] **Step 1: Dopisz sprawdzenie bezczynności w `tools/test-swieze-moduly.mjs`**

W bloku `BEZCZYNNOŚĆ`, pod `spr('pasek mocy pusty', ...)`:
```js
    spr('jakość tańca neutralna (mnożnik 1)', m.jakoscTanca.mnoznik === 1 && m.jakoscTanca.okres.pewnosc === 0);
```
Run: `node tools/test-swieze-moduly.mjs` — Expected: FAIL (`m.jakoscTanca` undefined).

- [ ] **Step 2: Dodaj do fabryki `js/swiezeModuly.js`**

Import pod `import { Plynnosc } from './plynnosc.js';`:
```js
import { JakoscTanca } from './jakoscTanca.js';
```
W `KLUCZE_MODULOW` po `'plynnoscMiara',` dopisz `'jakoscTanca',`. W zwracanym obiekcie pod `plynnoscMiara: new Plynnosc(),`:
```js
        jakoscTanca: new JakoscTanca(),
```

- [ ] **Step 3: Okablowanie w `js/main.js`**

Import pod `import { Plynnosc } from './plynnosc.js';`:
```js
import { JakoscTanca } from './jakoscTanca.js';
```
Deklaracja pod `let plynnoscMiara = new Plynnosc();`:
```js
let jakoscTanca = new JakoscTanca();
```
W `resetujModuly()` w destrukturyzacji po `plynnoscMiara,` dopisz `jakoscTanca,`.

Krok 4 pętli — zastąp blok `// --- 4. Płynność ruchu --- ... const plynnosc = plynnoscMiara.update(...);`:
```js
    // --- 4. Jakość tańca i płynność ruchu ---
    // Jakość PRZED płynnością: płynność skaluje próg szarpnięcia częstotliwością
    // ruchu z okresu (js/jakosc/okres.js) - szybki, gładki taniec nie traci.
    // Obie liczone z SUROWYCH landmarków - filtry robią własne wygładzanie.
    // Podanie tu pozycji już wygładzonych przez MotionMeter zabiłoby sygnał,
    // którego szukamy.
    const mnoznikBogactwa = jakoscTanca.update(frame, dt);
    const plynnosc = plynnoscMiara.update(frame.pose?.worldLandmarks ?? null, dt, jakoscTanca.czestotliwoscHz);
```
Krok 6 — zastąp linię `const moc = motionMeter.update(frame, plynnosc, skladanie.zamrazaZanik);`:
```js
    // --- 6. Ciągłość ruchu × płynność × jakość tańca -> moc ---
    const moc = motionMeter.update(frame, plynnosc, skladanie.zamrazaZanik, mnoznikBogactwa);
```
(i usuń stary komentarz `// --- 6. Ciągłość ruchu razy płynność -> moc ---` nad nią).

Krok 7d — zastąp `punkty.taniec(plynnosc, motionMeter.responsywnosc, dt);`:
```js
    punkty.taniec(plynnosc, motionMeter.responsywnosc, dt, mnoznikBogactwa);
```
Krok 8 — w obiekcie `debugHud.updatePanel(frame, { ... })` pod `wspPlynnosci: motionMeter.wspolczynnikPlynnosci,`:
```js
        jakosc: {
            bogactwo: jakoscTanca.bogactwo, mnoznik: jakoscTanca.mnoznik,
            skladowe: jakoscTanca.skladowe,
            aktywnosci: jakoscTanca.zaangazowanieMiara.aktywnosci,
            fala: jakoscTanca.falaMiara.diagnostyka,
            okresS: jakoscTanca.okres.okresS, pewnosc: jakoscTanca.okres.pewnosc,
            skalaProgu: plynnoscMiara.skalaProgu,
            tempoLadowania: motionMeter.tempoLadowania
        },
```

- [ ] **Step 4: Sekcja w `js/debugHud.js`**

Import na górze (obok innych):
```js
import { PARTIE } from './jakosc/zaangazowanie.js';
```
W `updatePanel`, bezpośrednio PO bloku `if (stats.plynnosc !== undefined) { ... }` i PRZED linią `if (stats.moc !== undefined) ...`:
```js
        // Jakość tańca (2026-10-14): składowe bogactwa i mnożnik tempa ładowania.
        // Wagi, kotwice i progi partii są ZGADNIĘTE - stroić stąd i z
        // tools/pomiar-jakosci.mjs (sesja J). "—" = brak danych (neutralnie, nie zero).
        const jq = stats.jakosc;
        if (jq) {
            const n = (v) => (v === null || v === undefined ? '  — ' : this._num(v));
            const SKROT = { rekaL: 'rL', rekaP: 'rP', nogaL: 'nL', nogaP: 'nP', biodra: 'bi', tulow: 'tu', glowa: 'gł' };
            lines.push(`jakość ${this._num(jq.bogactwo)}   ${this._bar(jq.bogactwo)}   tempo ×${this._num(jq.mnoznik)}`);
            lines.push(`      krążenie ${n(jq.skladowe?.krazenie)}  zaang. ${n(jq.skladowe?.zaangazowanie)}  fala ${n(jq.skladowe?.fala)}`);
            lines.push(`      partie ${PARTIE.map(p => `${SKROT[p]} ${this._num(jq.aktywnosci?.[p] ?? 0)}`).join(' ')}`);
            const fd = jq.fala;
            lines.push(fd?.lancuch
                ? `      fala ${fd.lancuch}: opóźn. ${(fd.opoznienieUlamek * 100).toFixed(0)}% cyklu, kor ${this._num(fd.korelacja)}`
                : '      fala: — (brak okresu albo amplitudy)');
            const bpm = jq.okresS > 0 ? (60 / jq.okresS).toFixed(0) : '—';
            lines.push(`      okres ${this._num(jq.okresS)} s = ${bpm} ruchów/min  pewność ${this._num(jq.pewnosc)}  próg płynn. ×${this._num(jq.skalaProgu)}`);
            lines.push(jq.tempoLadowania > 0
                ? `      pełny pasek za ~${(1 / jq.tempoLadowania).toFixed(1)} s przy tym tańcu`
                : '      pełny pasek: — (nie ładuje)');
        }
```

- [ ] **Step 5: Testy**

Run: `sh tools/test-wszystko.sh` — Expected: wszystkie ✓ (w tym `test-swieze-moduly` ze strażnikiem `let ... = new` i destrukturyzacji).

- [ ] **Step 6: Dym w przeglądarce**

Uruchom serwer statyczny w katalogu repo (np. `python3 -m http.server 8080`), otwórz `http://localhost:8080/`, twarde przeładowanie (GEMINI.md: Chrome cache'uje moduły ES). Rozpal ogień, naciśnij D. Expected: sekcja „jakość” widoczna; konsola bez błędów (`bledyPetli` = 0). Przy staniu w miejscu „tempo ×1.00” (± 0.05) po kilku sekundach.

- [ ] **Step 7: Commit**

```bash
git add js/main.js js/swiezeModuly.js js/debugHud.js tools/test-swieze-moduly.mjs
git commit -m "Jakość tańca w grze: mnożnik tempa ładowania i punktów, równy start rundy, sekcja w nakładce D"
```

---

### Task 10: Sesja nagraniowa J i `tools/pomiar-jakosci.mjs` (+ sprawdzenie kotwic na starych nagraniach)

**Files:**
- Modify: `js/nagrywanie/sesja.js` (nowy eksport `SCENARIUSZ_JAKOSC`)
- Modify: `js/debugHud.js` (import, klawisz J, komentarz nagłówka)
- Create: `tools/pomiar-jakosci.mjs`
- Test: `tools/test-scenariusz-jakosci.mjs`

**Interfaces:**
- Consumes: `JakoscTanca`, `Plynnosc`, `MotionMeter` (z Tasków 6–8); `odtworzKlatke` z `js/nagrywanie/zapis.js`.
- Produces: `export const SCENARIUSZ_JAKOSC` (7 kroków, id z prefiksem `jakosc-`).

- [ ] **Step 1: Napisz test `tools/test-scenariusz-jakosci.mjs`**

```js
/**
 * Scenariusz nagraniowy jakości tańca (klawisz J).
 *
 *   node tools/test-scenariusz-jakosci.mjs
 *
 * Id z prefiksem 'jakosc-': test-rozdzielnosc.mjs bierze etykietę z NAJŚWIEŻSZEGO
 * pliku (komentarz w js/nagrywanie/sesja.js przy 'taniec-falowanie') - kolizja
 * po cichu podmieniłaby mu próbki.
 */
import { SCENARIUSZ, SCENARIUSZ_FALOWANIE, SCENARIUSZ_JAKOSC, SesjaNagraniowa } from '../js/nagrywanie/sesja.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

spr('7 kroków', SCENARIUSZ_JAKOSC.length === 7);
spr('każde id z prefiksem jakosc-', SCENARIUSZ_JAKOSC.every(k => k.id.startsWith('jakosc-')));
const inne = new Set([...SCENARIUSZ, ...SCENARIUSZ_FALOWANIE].map(k => k.id));
spr('żadne id nie koliduje z innymi scenariuszami', SCENARIUSZ_JAKOSC.every(k => !inne.has(k.id)));
spr('id unikalne', new Set(SCENARIUSZ_JAKOSC.map(k => k.id)).size === SCENARIUSZ_JAKOSC.length);
spr('numery 1..7 po kolei', SCENARIUSZ_JAKOSC.every((k, i) => k.nr === i + 1));
spr('każdy krok ma wskazówkę na każde powtórzenie',
    SCENARIUSZ_JAKOSC.every(k => Array.isArray(k.wskazowki) && k.wskazowki.length === k.powtorzenia));
{
    const s = new SesjaNagraniowa({ scenariusz: SCENARIUSZ_JAKOSC });
    s.start(1);
    let start = 0;
    for (let i = 0; i < 20000 && s.aktywna; i++) if (s.tick(0.1).sygnal === 'start') start++;
    spr(`sesja przechodzi cały scenariusz (${start} nagrań, cel ${SCENARIUSZ_JAKOSC.reduce((a, k) => a + k.powtorzenia, 0)})`,
        start === SCENARIUSZ_JAKOSC.reduce((a, k) => a + k.powtorzenia, 0));
}
process.exit(ok ? 0 : 1);
```

Run: `node tools/test-scenariusz-jakosci.mjs` — Expected: FAIL (brak eksportu).

- [ ] **Step 2: Dodaj `SCENARIUSZ_JAKOSC` w `js/nagrywanie/sesja.js`** (pod `SCENARIUSZ_FALOWANIE`)

```js
// Jakość tańca (2026-10-14, spec 2026-10-14-jakosc-tanca-design.md): materiał do
// strojenia tools/pomiar-jakosci.mjs. Kroki 1 i 2 to DZISIEJSZY EXPLOIT w dwóch
// odmianach - kotwica mnożnika 0.67 idzie z WYŻSZEGO z nich. Id z prefiksem
// 'jakosc-' (patrz komentarz przy 'taniec-falowanie' niżej).
export const SCENARIUSZ_JAKOSC = [
    {
        nr: 1, id: 'jakosc-pompowanie', nazwa: 'POMPOWANIE',
        opis: 'Zgięte ręce prosto w górę i w dół, jak pompowanie - reszta ciała spokojnie',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['w swoim tempie', 'wolniej', 'szybciej']
    },
    {
        nr: 2, id: 'jakosc-luki-prostych-rak', nazwa: 'PROSTE RĘCE',
        opis: 'Proste ręce szerokim łukiem z dołu wysoko nad głowę i z powrotem',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['w swoim tempie', 'wolniej', 'szybciej']
    },
    {
        nr: 3, id: 'jakosc-kregi', nazwa: 'KRĘGI I ÓSEMKI',
        opis: 'Dłonie kreślą kręgi i ósemki w powietrzu - bez cofania po tym samym torze',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['w swoim tempie', 'wolniej i szerzej', 'szybciej']
    },
    {
        nr: 4, id: 'jakosc-cale-cialo', nazwa: 'CAŁE CIAŁO',
        opis: 'Tańcz całym ciałem: kroki, biodra, barki, głowa - nie tylko ręce',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['w swoim tempie', 'wolniej', 'szybciej']
    },
    {
        nr: 5, id: 'jakosc-fala-ciala', nazwa: 'FALA PRZEZ CIAŁO',
        opis: 'Ruch zaczyna się w biodrach i płynie przez tułów do dłoni, jak fala',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['w swoim tempie', 'wolniej', 'szybciej']
    },
    {
        nr: 6, id: 'jakosc-szybko', nazwa: 'SZYBKI TANIEC',
        opis: 'Tańcz szybko, ale płynnie - jak do szybkiej pieśni',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['szybko', 'jeszcze szybciej', 'szybko, całym ciałem']
    },
    {
        nr: 7, id: 'jakosc-wolno', nazwa: 'WOLNY TANIEC',
        opis: 'Tańcz wolno i szeroko - jak do wolnej pieśni',
        powtorzenia: 3, czasS: 10,
        wskazowki: ['wolno', 'jeszcze wolniej', 'wolno, całym ciałem']
    }
];
```

- [ ] **Step 3: Klawisz J w `js/debugHud.js`**

Zmień import: `import { SesjaNagraniowa, SCENARIUSZ, SCENARIUSZ_FALOWANIE, SCENARIUSZ_JAKOSC } from './nagrywanie/sesja.js';`
Pod linią z klawiszem F:
```js
            // J: scenariusz jakości tańca (tools/pomiar-jakosci.mjs) - zawsze od kroku 1.
            if (e.key === 'j' || e.key === 'J') this._startSesji(1, SCENARIUSZ_JAKOSC);
```
W komentarzu nagłówka pliku (linia z „Sesja nagraniowa … klawisz Z”) dopisz: `J - scenariusz jakości tańca.` W komentarzu przy `czyPoleTekstowe` zmień listę skrótów na `(D/R/N/Z/F/J/1-8)`.

Run: `node tools/test-scenariusz-jakosci.mjs && node tools/test-sesja.mjs && node tools/test-klawisze.mjs` — Expected: ✓.

- [ ] **Step 4: Utwórz `tools/pomiar-jakosci.mjs`**

```js
/**
 * Pomiar jakości tańca na nagraniach - NIE test (nic nie pada na czerwono).
 *
 *   node tools/pomiar-jakosci.mjs              # wszystkie nagrania z tools/probki/
 *   node tools/pomiar-jakosci.mjs jakosc-      # tylko kroki, których etykieta zawiera "jakosc-"
 *
 * Drukuje medianę [p10..p90] składowych bogactwa, mnożnik i realny czas do pełnego
 * paska (MotionMeter na tych samych klatkach). Z tego, nie z wyobraźni, ustawia się
 * NASTAWY_JAKOSCI (kotwice!), NASTAWY_ZAANGAZOWANIA i NASTAWY_FALI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { JakoscTanca } from '../js/jakoscTanca.js';
import { Plynnosc } from '../js/plynnosc.js';
import { MotionMeter } from '../js/motionMeter.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const filtr = process.argv[2] ?? '';
const POLA = ['krazenie', 'zaangazowanie', 'fala', 'bogactwo', 'mnoznik'];

const kwantyl = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '  - ').padStart(5);
const kol = (a) => (a.length ? `${f2(kwantyl(a, 0.5))} [${f2(kwantyl(a, 0.1))}..${f2(kwantyl(a, 0.9))}]` : '  brak danych'.padEnd(20));

function przepusc(klatki) {
    const j = new JakoscTanca(), p = new Plynnosc(), m = new MotionMeter();
    const zbior = Object.fromEntries(POLA.map(k => [k, []]));
    let sumaTempa = 0, czas = 0;
    for (const k of klatki) {
        const mn = j.update(k, k.dt);
        const pl = p.update(k.pose?.worldLandmarks ?? null, k.dt, j.czestotliwoscHz);
        m.update(k, pl, false, mn);
        czas += k.dt;
        if (czas < 2) continue;   // rozgrzanie okien miar
        for (const [kl, v] of Object.entries(j.skladowe)) if (v !== null && Number.isFinite(v)) zbior[kl].push(v);
        zbior.bogactwo.push(j.bogactwo);
        zbior.mnoznik.push(j.mnoznik);
        sumaTempa += m.tempoLadowania * k.dt;
    }
    const czasPomiaru = Math.max(1e-6, czas - 2);
    const tempo = sumaTempa / czasPomiaru;
    return { zbior, pelnyZaS: tempo > 0 ? 1 / tempo : Infinity, okres: j.okres.okresS };
}

console.log(''.padEnd(34) + ' ' + POLA.map(p => p.padEnd(20)).join(' ') + ' pełny za   okres');
for (const plik of readdirSync(KATALOG).filter(f => f.endsWith('.json')).sort()) {
    const dane = JSON.parse(readFileSync(join(KATALOG, plik), 'utf8'));
    const kroki = Object.entries(dane.kroki ?? {}).filter(([e]) => e.includes(filtr));
    if (!kroki.length) continue;
    console.log(`-- ${plik}`);
    for (const [etykieta, zapisane] of kroki) {
        const kl = zapisane.map(z => odtworzKlatke(z, dane));
        const { zbior, pelnyZaS, okres } = przepusc(kl);
        console.log(`${etykieta.padEnd(34)} ${POLA.map(p => kol(zbior[p])).join(' ')} ${(Number.isFinite(pelnyZaS) ? pelnyZaS.toFixed(1) + ' s' : '  —').padStart(8)}  ${okres.toFixed(2)} s`);
    }
}
```

- [ ] **Step 5: Uruchom na ISTNIEJĄCYCH nagraniach i sprawdź kotwice przed sesją właściciela**

Run: `node tools/pomiar-jakosci.mjs`
Expected (sprawdź ręcznie i zanotuj wynik w opisie commita):
- kroki `taniec` / `taniec-falowanie` (zwykły taniec właściciela): mediana **mnożnika ≥ 1.0**. Jeśli niżej — obniż `KOTWICA_NISKA` i `KOTWICA_WYSOKA` w `js/jakoscTanca.js` o tę samą wartość, tak żeby zwykły taniec dawał ≥ 1.0 (gra nie może zrobić się wolniejsza do czasu strojenia). Opisz zmianę w komentarzu przy kotwicach („z nagrania 2026-10-09: taniec X”).
- `falowanie-sztywne`: fala bliska 0; `falowanie-wezowe`: fala wyraźnie wyższa niż sztywne.
- `rozpostarte-bez-ruchu`: zaangażowanie i krążenie „brak danych”, mnożnik ~1.0.
Następnie: `sh tools/test-wszystko.sh` — Expected: ✓ (jeśli kotwice się zmieniły, `test-jakosc-tanca` dalej ma przechodzić — ten test sprawdza kierunek, nie liczby).

- [ ] **Step 6: Commit**

```bash
git add js/nagrywanie/sesja.js js/debugHud.js tools/pomiar-jakosci.mjs tools/test-scenariusz-jakosci.mjs js/jakoscTanca.js
git commit -m "Jakość tańca: sesja nagraniowa J, pomiar na nagraniach; kotwice sprawdzone na tańcu z 2026-10-09"
```

---

### Task 11: „Aura mówi” — żar, połysk partii, bieg fali

**Files:**
- Modify: `js/aura.js` (konstruktor, `updateAndDraw`)
- Create: `js/blaskTanca.js`
- Modify: `js/main.js` (krok 7), `js/swiezeModuly.js`, `tools/test-swieze-moduly.mjs`
- Test: `tools/test-blask-tanca.mjs`

**Interfaces:**
- Consumes: `JakoscTanca` (pola `bogactwo`, `zaangazowanieMiara.aktywnosci`, `falaMiara.fala`, `falaMiara.diagnostyka.lancuch`, `okres.okresS`); `PARTIE` (Task 4).
- Produces: `Aura.updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt, tecza = null, bogactwo = null)`; `class BlaskTanca { _faza: number, updateAndDraw(ctx, frame, jakosc: JakoscTanca|null, moc: number, dt: number): void }`; `export const NASTAWY_BLASKU`.

- [ ] **Step 1: Napisz test `tools/test-blask-tanca.mjs`**

```js
/**
 * Blask tańca - połysk tańczących partii i bieg fali.
 *
 *   node tools/test-blask-tanca.mjs
 */
import { BlaskTanca } from '../js/blaskTanca.js';
import { PARTIE } from '../js/jakosc/zaangazowanie.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

function atrapa() {
    const l = { arc: 0, stroke: 0 };
    const ctx = {
        globalCompositeOperation: 'source-over', globalAlpha: 1, lineWidth: 1, lineCap: 'butt', strokeStyle: '', fillStyle: '',
        save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, fill() {},
        arc() { l.arc++; }, stroke() { l.stroke++; },
        createRadialGradient: () => ({ addColorStop() {} })
    };
    return { ctx, l };
}
const lm = Array.from({ length: 33 }, (_, i) => ({ x: 0.5 + (i % 2 ? 0.05 : -0.05), y: 0.3 + i * 0.01, z: 0, visibility: 0.9 }));
const frame = { pose: { landmarks: lm }, width: 1920, height: 1080 };
const jakosc = (akt, fala = null, lancuch = null) => ({
    zaangazowanieMiara: { aktywnosci: Object.fromEntries(PARTIE.map(p => [p, akt[p] ?? 0])) },
    falaMiara: { fala, diagnostyka: { lancuch } },
    okres: { okresS: 1 }
});

{
    const b = new BlaskTanca(), { ctx, l } = atrapa();
    for (let i = 0; i < 60; i++) b.updateAndDraw(ctx, frame, jakosc({}), 1, 1 / 60);
    spr('nic nie tańczy -> nic się nie rysuje', l.arc === 0 && l.stroke === 0);
}
{
    const b = new BlaskTanca(), { ctx, l } = atrapa();
    for (let i = 0; i < 60; i++) b.updateAndDraw(ctx, frame, jakosc({ biodra: 1, glowa: 1 }), 1, 1 / 60);
    spr('tańczące partie dostają połysk', l.arc > 0);
}
{
    const b = new BlaskTanca(), { ctx, l } = atrapa();
    for (let i = 0; i < 60; i++) b.updateAndDraw(ctx, frame, jakosc({}, 0.9, 'ramieL'), 1, 1 / 60);
    spr('wysoka fala rysuje kreskę wzdłuż łańcucha', l.stroke > 0);
}
{
    const b = new BlaskTanca(), { ctx } = atrapa();
    let blad = null;
    try {
        b.updateAndDraw(ctx, null, null, NaN, 1 / 60);
        b.updateAndDraw(ctx, { pose: null, width: 1920, height: 1080 }, jakosc({ biodra: 1 }), 1, NaN);
        b.updateAndDraw(null, frame, jakosc({ biodra: 1 }), 1, 1 / 60);
        const zle = { pose: { landmarks: lm.map(p => ({ ...p, x: NaN })) }, width: 1920, height: 1080 };
        b.updateAndDraw(ctx, zle, jakosc({ biodra: 1 }, 0.9, 'ramieL'), 1, 1 / 60);
    } catch (e) { blad = e; }
    spr('null / NaN / brak płótna nie rzucają', blad === null && Number.isFinite(b._faza));
}
process.exit(ok ? 0 : 1);
```

Run: `node tools/test-blask-tanca.mjs` — Expected: FAIL (brak modułu).

- [ ] **Step 2: Utwórz `js/blaskTanca.js`**

```js
/**
 * Blask tańca - "aura mówi" (spec 2026-10-14-jakosc-tanca-design.md, sekcja 4).
 *
 * Bez napisów pokazuje graczowi, ZA CO dostaje więcej mocy:
 *  - połysk partii: tańcząca partia (biodra, barki, głowa, dłonie, stopy) dostaje
 *    miękki, ciepły blask w swoim miejscu - "biodra też tańczą",
 *  - bieg fali: przy wysokiej fali jasna kreska biegnie wzdłuż łańcucha, który ją
 *    niesie, w tempie okresu ruchu. KRESKA PO WĘZŁACH, nie sprite - to zadziałało
 *    przy VFX (sprite'y nie dawały ciągłości).
 * Rysowane przez 'lighter' po aurze. Wszystko wygładzane - trans, nie migotanie.
 * Pozycje z frame.pose.landmarks (2D, x·width, y·height - jak js/bania.js).
 */
import { PARTIE } from './jakosc/zaangazowanie.js';

// ZGADNIĘTE - stroić na żywo.
export const NASTAWY_BLASKU = {
    TAU_S: 0.5,
    ALFA: 0.30,               // jasność połysku przy pełnej aktywności i pełnej mocy
    PROMIEN_BW: 0.45,         // promień połysku w szerokościach barków
    PROG_FALI: 0.35,          // poniżej kreska fali nie biegnie
    DLUGOSC_KRESKI: 0.22,     // ułamek długości łańcucha
    GRUBOSC_BW: 0.06,
    BARWA: '255, 190, 110'    // ciepły żar - ta sama rodzina co BARWA_PLYNNA aury
};
const N = NASTAWY_BLASKU;

const PUNKTY_PARTII = { rekaL: [15], rekaP: [16], nogaL: [27], nogaP: [28], biodra: [23, 24], tulow: [11, 12], glowa: [0] };
const LANCUCHY = { ramieL: [[11], [13], [15]], ramieP: [[12], [14], [16]], biodraDlonie: [[23, 24], [11, 12], [15, 16]] };

const ok = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= 0.5);
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export class BlaskTanca {
    constructor() {
        this._sila = Object.fromEntries(PARTIE.map(p => [p, 0]));
        this._fala = 0;
        this._faza = 0;
    }

    updateAndDraw(ctx, frame, jakosc, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const a = Math.min(1, krok / N.TAU_S);
        const akt = jakosc?.zaangazowanieMiara?.aktywnosci ?? {};
        for (const p of PARTIE) this._sila[p] += a * (clamp01(akt[p]) - this._sila[p]);
        this._fala += a * (clamp01(jakosc?.falaMiara?.fala) - this._fala);
        const okres = jakosc?.okres?.okresS;
        const T = Number.isFinite(okres) ? Math.max(0.25, Math.min(2.5, okres)) : 1;
        this._faza = (this._faza + krok / T) % 1;

        const lm = frame?.pose?.landmarks;
        const W = frame?.width, H = frame?.height;
        if (!ctx || !lm || !(W > 0) || !(H > 0)) return;
        const srodek = (idx) => {
            const pts = idx.map(i => lm[i]).filter(ok);
            if (!pts.length) return null;
            return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length * W, y: pts.reduce((s, p) => s + p.y, 0) / pts.length * H };
        };
        const b1 = srodek([11]), b2 = srodek([12]);
        const bw = b1 && b2 ? Math.hypot(b1.x - b2.x, b1.y - b2.y) : NaN;
        if (!(bw > 5)) return;
        const jas = 0.4 + 0.6 * clamp01(moc);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const p of PARTIE) {
            const s = this._sila[p];
            if (s < 0.02) continue;
            const c = srodek(PUNKTY_PARTII[p]);
            if (!c) continue;
            const r = N.PROMIEN_BW * bw;
            const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
            g.addColorStop(0, `rgba(${N.BARWA}, ${(N.ALFA * s * jas).toFixed(3)})`);
            g.addColorStop(1, `rgba(${N.BARWA}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const lancuch = jakosc?.falaMiara?.diagnostyka?.lancuch;
        if (this._fala > N.PROG_FALI && LANCUCHY[lancuch]) {
            const wezly = LANCUCHY[lancuch].map(srodek);
            if (wezly.every(Boolean)) this._rysujBieg(ctx, wezly, bw, (this._fala - N.PROG_FALI) / (1 - N.PROG_FALI) * jas);
        }
        ctx.restore();
    }

    /** Kreska od (faza - DLUGOSC) do fazy wzdłuż łamanej węzłów - jasny punkt biegnący od barku/bioder do dłoni. */
    _rysujBieg(ctx, wezly, bw, alfa) {
        const odc = [];
        let dl = 0;
        for (let i = 1; i < wezly.length; i++) {
            const d = Math.hypot(wezly[i].x - wezly[i - 1].x, wezly[i].y - wezly[i - 1].y);
            odc.push(d); dl += d;
        }
        if (!(dl > 1)) return;
        const punkt = (u) => {
            let x = Math.max(0, Math.min(1, u)) * dl;
            for (let i = 0; i < odc.length; i++) {
                if (x <= odc[i] || i === odc.length - 1) {
                    const t = odc[i] > 0 ? Math.min(1, x / odc[i]) : 0;
                    return { x: wezly[i].x + t * (wezly[i + 1].x - wezly[i].x), y: wezly[i].y + t * (wezly[i + 1].y - wezly[i].y) };
                }
                x -= odc[i];
            }
            return wezly[wezly.length - 1];
        };
        const KROKOW = 8;
        ctx.lineCap = 'round';
        for (let k = 0; k < KROKOW; k++) {
            const u0 = this._faza - N.DLUGOSC_KRESKI * (1 - k / KROKOW);
            const u1 = this._faza - N.DLUGOSC_KRESKI * (1 - (k + 1) / KROKOW);
            if (u1 < 0) continue;
            const p0 = punkt(u0), p1 = punkt(u1);
            ctx.strokeStyle = `rgba(${N.BARWA}, ${(clamp01(alfa) * (k + 1) / KROKOW).toFixed(3)})`;
            ctx.lineWidth = N.GRUBOSC_BW * bw * (0.4 + 0.6 * (k + 1) / KROKOW);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }
    }
}
```

Run: `node tools/test-blask-tanca.mjs` — Expected: wszystkie ✓.

- [ ] **Step 3: Żar w `js/aura.js`**

Pod `const ALFA_WNETRZA = 0.13;`:
```js
// ŻAR JAKOŚCI TAŃCA (2026-10-14). Bogactwo tańca (js/jakoscTanca.js) zagęszcza
// wąskie obrysy i rozświetla wnętrze - piękny taniec "gorzeje" wyraźniej niż
// góra-dół przy tej samej mocy. Moc dalej = zasięg, płynność dalej = barwa.
// Bez bogactwa (null) aura jest dokładnie taka jak przed tą zmianą. ZGADNIĘTE.
const ZAR_OBRYSU = 0.4;
const ZAR_WNETRZA = 0.8;
```
W konstruktorze pod `this._plynnosc = 1;`: `this._zar = 0;`
Zmień sygnaturę i JSDoc:
```js
     * @param {number|null} [bogactwo]  0..1 z JakoscTanca - żar; null = bez żaru
     */
    updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt, tecza = null, bogactwo = null) {
```
Pod linią wygładzania `this._plynnosc += ...`:
```js
        this._zar += a * ((Number.isFinite(bogactwo) ? Math.max(0, Math.min(1, bogactwo)) : 0) - this._zar);
```
W pętli `for (const p of PRZEBIEGI)` linię `ctx.globalAlpha = Math.max(0, Math.min(1, p.alfa * mocEfektywna * tetno));` zastąp:
```js
            const zar = p.wytnijWnetrze ? 1 + ZAR_OBRYSU * this._zar : 1;
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alfa * mocEfektywna * tetno * zar));
```
I linię `ctx.globalAlpha = Math.max(0, Math.min(1, ALFA_WNETRZA * mocEfektywna * tetno));` zastąp:
```js
        ctx.globalAlpha = Math.max(0, Math.min(1, ALFA_WNETRZA * (1 + ZAR_WNETRZA * this._zar) * mocEfektywna * tetno));
```

- [ ] **Step 4: Okablowanie i równy start**

`js/swiezeModuly.js`: import `import { BlaskTanca } from './blaskTanca.js';`, w `KLUCZE_MODULOW` dopisz `'blaskTanca'` (po `'jakoscTanca'`), w fabryce `blaskTanca: new BlaskTanca(),`.
`tools/test-swieze-moduly.mjs`, blok BEZCZYNNOŚĆ:
```js
    spr('blask tańca zgaszony', m.blaskTanca._fala === 0 && m.blaskTanca._faza === 0);
```
`js/main.js`: import `import { BlaskTanca } from './blaskTanca.js';`, deklaracja pod `let jakoscTanca = new JakoscTanca();`: `let blaskTanca = new BlaskTanca();`, w destrukturyzacji `resetujModuly()` po `jakoscTanca,` dopisz `blaskTanca,`. W kroku 7 zastąp wywołanie aury:
```js
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt, tecza, jakoscTanca.bogactwo);
    // Połysk tańczących partii i bieg fali - PO aurze, PRZED zapłonem (spec jakości tańca, sekcja 4).
    blaskTanca.updateAndDraw(ctx, frame, jakoscTanca, moc, dt);
```

- [ ] **Step 5: Testy**

Run: `sh tools/test-wszystko.sh` — Expected: wszystkie ✓ (w tym `test-aura-impuls` bez zmian — domyślne `bogactwo = null`).

- [ ] **Step 6: Sprawdzenie w przeglądarce**

Serwer statyczny, twarde przeładowanie, Rozpal ogień. Expected: przy kołysaniu biodrami ciepły blask przy biodrach; przy fali od barku przez rękę jasna kreska biegnie bark → dłoń; przy staniu nic nie świeci poza zwykłą aurą; FPS w nakładce D bez wyraźnego spadku (porównaj z `git stash` jeśli trzeba).

- [ ] **Step 7: Commit**

```bash
git add js/aura.js js/blaskTanca.js js/main.js js/swiezeModuly.js tools/test-swieze-moduly.mjs tools/test-blask-tanca.mjs
git commit -m "Aura mówi: żar od jakości tańca, połysk tańczących partii, bieg fali po węzłach"
```

---

### Task 12: Dokumentacja (GEMINI.md) i weryfikacja całości

**Files:**
- Modify: `GEMINI.md` (schemat przepływu ~linia 34, tabela modułów ~60–120, lekcje ~130–160, lista na przyszłość ~193)

- [ ] **Step 1: Uzupełnij `GEMINI.md`**

- Schemat (blok z `kamera → PoseTracker`): dopisz gałąź `→ JakoscTanca (okres, krążenie, zaangażowanie, fala) → mnożnik → MotionMeter`.
- Tabela modułów — nowe wiersze (styl istniejących):
  - `js/jakoscTanca.js` | jakość tańca (2026-10-14, etap 1 z 4 „gra rozumie muzykę”): krążenie + zaangażowanie + fala → bogactwo 0..1 → mnożnik tempa ładowania 0.67..1.33 (góra–dół ~12 s, piękny taniec ~6 s); brak danych → 1.0 |
  - `js/jakosc/okres.js` | dominujący okres ruchu z autokorelacji POZYCJI (nie |v| — ta daje pół okresu, a dla okręgu nie ma szczytu); gniazdo „pulsu tańca” etapu 2 |
  - `js/jakosc/krazenie.js` | „łuki zamiast linii” jako brak NAWROTÓW toru (pierwszy powrót w to samo miejsce: ten sam kierunek = krąg, przeciwny = wahadło) |
  - `js/jakosc/zaangazowanie.js`, `js/jakosc/cialo2d.js` | 7 partii ciała, biodra z 2D w pikselach ÷ szerokość barków |
  - `js/jakosc/fala.js` | fala przez ciało, opóźnienie jako UŁAMEK cyklu (niezależne od tempa) |
  - `js/jakosc/pochodne.js` | wspólne: filtr SG, korelacja z opóźnieniem |
  - `js/blaskTanca.js` | połysk tańczących partii + bieg fali (kreska po węzłach) |
- Lekcje (sekcja z „Płynność ≠ mało przyspieszenia”): dopisz
  - **Exploit „ręce w górę i w dół” to ŁUK, nie linia.** Prosta ręka kreśli łuk wokół barku z dużym przyspieszeniem normalnym — krzywizna go nagradza. Różnicą jest nawrót po tym samym torze.
  - **Miary jakości muszą być niezależne od tempa** (ułamek cyklu, bezwymiarowe udziały) — szarpnięcie w 1/s rośnie liniowo z częstotliwością i karało szybki gładki taniec.
- Lista „na przyszłość” (punkt 4 „Rytm”): zamień na odnośnik do etapów 2–4 ze specu 2026-10-14 (słuch: plik → mikrofon → puls tańca; dopasowanie tempa ½×/2×; trafienia i trans).

- [ ] **Step 2: Pełna weryfikacja**

Run: `sh tools/test-wszystko.sh` — Expected: wszystkie ✓.
Run: `node tools/pomiar-jakosci.mjs` — Expected: tabela bez wyjątków, zwykły taniec mnożnik ≥ 1.0.
Przeglądarka (serwer statyczny, twarde przeładowanie): jedna runda z menu do Kroniki — bez błędów pętli; pasek ładuje się przy staniu → 0, przy tańcu rośnie; Esc i restart rundy w Kręgu zaczynają z „tempo ×1.00”.

- [ ] **Step 3: Commit**

```bash
git add GEMINI.md
git commit -m "GEMINI.md: jakość tańca (moduły, lekcje: łuk wokół barku, miary niezależne od tempa)"
```

---

### Task 13: Strojenie na żywym ciele (z właścicielem)

To zadanie wymaga właściciela przed kamerą — wykonawca przygotowuje i prowadzi, nie zgaduje liczb.

- [ ] **Step 1:** Właściciel nagrywa sesję J (klawisz J w grze; aplikacja prowadzi głosem i odliczaniem, ~4 min). Plik ląduje w pobranych — przenieść do `tools/probki/`.
- [ ] **Step 2:** `node tools/pomiar-jakosci.mjs jakosc-` — z tabeli:
  - `KOTWICA_NISKA` = wyższa z median bogactwa kroków `jakosc-pompowanie` i `jakosc-luki-prostych-rak`,
  - `KOTWICA_WYSOKA` = mediana bogactwa kroków `jakosc-cale-cialo` / `jakosc-fala-ciala` (niższa z nich),
  - sprawdź „pełny za”: exploit ~12 s, cel ~6 s dla całego ciała / fali; `jakosc-szybko` i `jakosc-wolno` podobnie przy podobnym bogactwie,
  - jeśli któraś składowa nie rozdziela exploitu od tańca — popraw progi w jej `NASTAWY_*`, nie kotwice.
- [ ] **Step 3:** Zamień przy zmienionych stałych „ZGADNIĘTE” na „ZMIERZONE 2026-xx-xx (nagranie …)” z liczbami z tabeli; `sh tools/test-wszystko.sh`; commit `Jakość tańca: kotwice i progi z nagrania sesji J`.
- [ ] **Step 4:** Test gry z kamerą: właściciel ocenia odczucie (czy góra–dół „czuć wolniej”, czy połysk partii i bieg fali czytają się bez słów). Poprawki wizualne — chirurgicznie, po teście (pamięć: iteracja VFX).
