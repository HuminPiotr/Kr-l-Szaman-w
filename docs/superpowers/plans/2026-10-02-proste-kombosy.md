# Pięć prostych combo — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pięć nowych technik natychmiastowych (Kamienna Tarcza, Kurzawa, Łuk Peruna, Wodna Kula, Mgła Mokoszy), każda w osobnym module i osobnym commicie, żeby dało się ją odrzucić po teście na kamerze.

**Architecture:** Każda technika = klasa `zapal(sila)` / `updateAndDraw(ctx, k, dt)` / `aktywny`, która co klatkę sama czyta pozę/dłonie z `k.frame` (wspólny `js/sledzenie.js`) i rysuje się z gotowych klocków (`piorun.js`, `assety.js`, `szum.js`, nowy `js/warstwaZaSylwetka.js` do rysowania ZA ciałem). Wpięcie identyczne dla każdej: `kombosy.js` → `techniki.js` → `efekty.js` → `swiezeModuly.js` → `main.js` → `tools/scena.html`.

**Tech Stack:** czysty ES-modules JS, Canvas 2D, MediaPipe (dane już w `frame`), testy `node tools/test-*.mjs`, bez bundlera i npm.

**Spec:** `docs/superpowers/specs/2026-10-02-proste-kombosy-design.md`

**Tryb wykonania:** Native (rekomendowany) — zadania kolejno dotykają tych samych plików wpięcia (`main.js`, `techniki.js`, `scena.html`), więc równoległe subagenty by się gryzły; pomyłka jest tania (cofnięcie commita).

## Global Constraints

- GEMINI.md §2: nic nie mówi źle — brak assetu/dłoni/pozy/maski nigdy nie rzuca; efekt trwa dalej z ostatnim znanym zaczepem.
- Technika natychmiastowa, siła STAŁA `1.0` (combo jest gratis), bez `motionMeter.zuzyj()`.
- Rozmiary jako mnożniki skali barków (szerokość barków w px), nigdy stałe px ani ułamki W.
- Guard `if (!ctx) return;` dopiero PO doliczeniu czasu/fizyki/zaczepu (wzorzec `kolowrot.js`), żeby testy w Node mogły napędzać zegar `updateAndDraw(null, k, dt)`.
- Eksportowane, mutowalne `NASTAWY` (stanowisko `tools/scena.html`), metoda `wyczyscCache()`.
- Jedna technika = jeden commit. Komentarze i nazwy po polsku, gęstość komentarzy jak w `kolowrot.js`.
- Bez efektów dźwiękowych (decyzja 2026-10-01).
- `id` combo == `uzbraja` (technika natychmiastowa, wzorzec `kolowrot`).

## Review Focus

1. **Dłonie zamieniają się kolejnością między klatkami** (MediaPipe nie trzyma stałego indeksu) → Łuk/Kula nie mogą przeskakiwać; `dlonieKlatki` sortuje po x (test w Task 2).
2. **Dłonie/poza znikają w trakcie efektu** → efekt trwa w ostatnim zaczepie, bez NaN (test w każdym zadaniu technik).
3. **Technika odpalona ponownie w trakcie** (Weles×4, łańcuchy) → restart, nie podwojenie cząstek (test w każdym zadaniu technik).
4. **Restart rundy w Kręgu w trakcie efektu** → nowa instancja bezczynna (`test-swieze-moduly.mjs`, każde zadanie).
5. **Assety jeszcze się ładują / brak maski** → rysowanie z atrapą ctx nie rzuca (test „atrapa" w każdym zadaniu technik; Task 3 dla maski).

---

## Task 1: Tekstury Kenney i manifest

**Files:**
- Create: `assets/czastki/dirt_01.png`, `dirt_02.png`, `dirt_03.png`, `twirl_02.png`, `twirl_03.png`, `spark_01.png`, `spark_02.png`, `spark_03.png`
- Modify: `js/assety.js` (MANIFEST), `tools/test-assety.mjs`, ewentualnie `assets/czastki/LICENSE.txt`

**Interfaces:** Produces: `MANIFEST.odlamek` (dirt ×3), `MANIFEST.wiryKurzawy` (twirl_02/03), `MANIFEST.wyladowanie` (spark ×3) — tablice ścieżek.

- [ ] **Step 1: Test (failing)** — w `tools/test-assety.mjs` po bloku `MANIFEST - KSZTAŁT` dopisz:

```js
spr('MANIFEST.odlamek - trzy warianty ziemi (Kamienna Tarcza, Kurzawa)', Array.isArray(MANIFEST.odlamek) && MANIFEST.odlamek.length === 3);
spr('MANIFEST.wiryKurzawy - dwa zawijasy wiru', Array.isArray(MANIFEST.wiryKurzawy) && MANIFEST.wiryKurzawy.length === 2);
spr('MANIFEST.wyladowanie - trzy pęknięcia elektryczne (Łuk Peruna)', Array.isArray(MANIFEST.wyladowanie) && MANIFEST.wyladowanie.length === 3);
```

- [ ] **Step 2:** `node tools/test-assety.mjs` → FAIL na trzech nowych asercjach.
- [ ] **Step 3: Pobierz paczkę** (zapytaj o zgodę na sieć, jeśli harness pyta): otwórz `https://kenney.nl/assets/particle-pack`, znajdź link `.zip` (`kenney_particle-pack.zip`), pobierz do scratchpada, rozpakuj, skopiuj z katalogu `PNG (Transparent)/` (albo odpowiednika) pliki: `dirt_01..03`, `twirl_02..03`, `spark_01..03` do `assets/czastki/`. Sprawdź `file assets/czastki/dirt_01.png` → `PNG image data, 512 x 512`. Przeczytaj `assets/czastki/LICENSE.txt` — jeśli wylicza pliki, dopisz nowe w tym samym formacie.
- [ ] **Step 4: Manifest** — w `js/assety.js` przed zamykającym `};` MANIFEST dopisz:

```js
    // Proste combo (2026-10-02, docs/superpowers/specs/2026-10-02-proste-
    // -kombosy-design.md). dirt_* to JEDYNA prawdziwa faktura ziemi w paczce -
    // Weles dotąd nie miał żadnej (Kamienna Tarcza, Kurzawa). twirl_02/03 to
    // dalsze ramiona wiru (01 już niesie Aard). spark_* to NIE iskry, tylko
    // rozgałęzione pęknięcia elektryczne - patrz spec 2026-09-09-assety.
    odlamek: ['assets/czastki/dirt_01.png', 'assets/czastki/dirt_02.png', 'assets/czastki/dirt_03.png'],
    wiryKurzawy: ['assets/czastki/twirl_02.png', 'assets/czastki/twirl_03.png'],
    wyladowanie: ['assets/czastki/spark_01.png', 'assets/czastki/spark_02.png', 'assets/czastki/spark_03.png']
```
(dopisz przecinek po `wir: 'assets/czastki/twirl_01.png'`).
- [ ] **Step 5:** `node tools/test-assety.mjs` → PASS (pętla „istnieje na dysku" obejmuje nowe pliki).
- [ ] **Step 6: Commit** `git add assets/czastki js/assety.js tools/test-assety.mjs && git commit -m "Tekstury Kenney pod proste combo: dirt, twirl 02/03, spark"`

## Task 2: Śledzenie ciała (`js/sledzenie.js`) + syntetyczna klatka testowa

**Files:**
- Create: `js/sledzenie.js`, `tools/_klatka-techniki.mjs`, `tools/test-sledzenie.mjs`
- Modify: `GEMINI.md` (tabela plików, wiersz po `js/kolowrot.js`)

**Interfaces — Produces:**
- `dlonieKlatki(frame, W, H) -> {x,y}[]` (0–2 punkty, środek nadgarstek↔nasada środkowego palca, **posortowane po x**)
- `barkiKlatki(frame, W, H) -> {x, y, skala} | null`
- `class Kotwica(szybkosc=14)`: `prowadz(cel|null, dt) -> stan|null`, `reset()`, `get znana`
- `tools/_klatka-techniki.mjs`: `W, H, klatka({barki, dlonie}), kontekst(frame), przepusc(efekt, frame, s, dt), atrapaCtx()`

- [ ] **Step 1: Pomocnik testowy** `tools/_klatka-techniki.mjs`:

```js
/**
 * Syntetyczna klatka dla testów technik śledzących ciało (Tarcza, Kurzawa,
 * Łuk, Kula, Mgła). Prefiks "_" = nie jest testem (test-wszystko.sh bierze
 * tylko test-*.mjs). Współrzędne ZNORMALIZOWANE 0..1, jak frame z main.js.
 */
export const W = 1920, H = 1080;

/** @param {{barki?: number[]|null, dlonie?: number[][]}} o  barki = [xL, yL, xP, yP] */
export function klatka({ barki = [0.45, 0.4, 0.55, 0.4], dlonie = [] } = {}) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
    if (barki) { lm[12] = { x: barki[0], y: barki[1] }; lm[11] = { x: barki[2], y: barki[3] }; }
    const hands = dlonie.map(([x, y]) => ({ landmarks: Array.from({ length: 21 }, () => ({ x, y })) }));
    return { hands, pose: barki ? { landmarks: lm } : null, width: W, height: H };
}

export function kontekst(frame) {
    return { frame, W, H, maska: null, maskaSzer: 0, maskaWys: 0, fit: null };
}

export function przepusc(efekt, frame, sekundy, dt = 1 / 60) {
    for (let i = 0; i < Math.round(sekundy / dt); i++) efekt.updateAndDraw(null, kontekst(frame), dt);
}

/** Atrapa CanvasRenderingContext2D - każda metoda no-op; do testu "nie rzuca przy rysowaniu". */
export function atrapaCtx() {
    const nic = () => {};
    return new Proxy({ canvas: { width: W, height: H } }, {
        get(cel, klucz) {
            if (klucz in cel) return cel[klucz];
            if (klucz === 'createRadialGradient' || klucz === 'createLinearGradient') return () => ({ addColorStop: nic });
            return nic;
        },
        set(cel, klucz, wartosc) { cel[klucz] = wartosc; return true; }
    });
}
```

- [ ] **Step 2: Test (failing)** `tools/test-sledzenie.mjs`:

```js
/**
 * js/sledzenie.js - zaczepy technik śledzących ciało, bez document.
 *   node tools/test-sledzenie.mjs
 */
import { dlonieKlatki, barkiKlatki, Kotwica } from '../js/sledzenie.js';
import { klatka, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('DŁONIE:');
const d2 = dlonieKlatki(klatka({ dlonie: [[0.7, 0.5], [0.3, 0.5]] }), W, H);
spr('dwie dłonie, posortowane po x (MediaPipe nie trzyma kolejności)', d2.length === 2 && d2[0].x < d2[1].x);
spr('w pikselach płótna', Math.abs(d2[0].x - 0.3 * W) < 1e-6 && Math.abs(d2[0].y - 0.5 * H) < 1e-6);
spr('brak dłoni -> pusta tablica', dlonieKlatki(klatka(), W, H).length === 0);
spr('zepsuta klatka -> pusta tablica, bez wyjątku', dlonieKlatki(null, W, H).length === 0 &&
    dlonieKlatki({ hands: [{ landmarks: [{ x: NaN, y: 0 }] }] }, W, H).length === 0);

console.log('\nBARKI:');
const b = barkiKlatki(klatka({ barki: [0.4, 0.4, 0.6, 0.4] }), W, H);
spr('środek barków w px', Math.abs(b.x - 0.5 * W) < 1e-6 && Math.abs(b.y - 0.4 * H) < 1e-6);
spr('skala = szerokość barków w px', Math.abs(b.skala - 0.2 * W) < 1e-6);
spr('brak pozy -> null', barkiKlatki(klatka({ barki: null }), W, H) === null);

console.log('\nKOTWICA:');
const k = new Kotwica(14);
spr('nieznana na starcie', !k.znana && k.prowadz(null, 1 / 60) === null);
k.prowadz({ x: 100, y: 100 }, 1 / 60);
spr('pierwszy cel - przeskok, nie dojazd z (0,0)', k.stan.x === 100 && k.stan.y === 100);
k.prowadz({ x: 200, y: 100 }, 1 / 60);
spr('kolejny cel - wygładzony dojazd', k.stan.x > 100 && k.stan.x < 200);
const przed = k.stan.x;
k.prowadz(null, 1 / 60);
spr('cel znika -> trzyma ostatni stan', k.stan.x === przed);
k.prowadz({ x: NaN, y: 5 }, 1 / 60);
spr('cel z NaN traktowany jak brak celu', k.stan.x === przed && Number.isFinite(k.stan.y));
k.reset();
spr('reset -> znów nieznana', !k.znana);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3:** `node tools/test-sledzenie.mjs` → FAIL (`Cannot find module '../js/sledzenie.js'`).
- [ ] **Step 4: Implementacja** `js/sledzenie.js`:

```js
/**
 * Śledzenie ciała dla technik, które TRWAJĄ i PODĄŻAJĄ za graczem (proste
 * combo 2026-10-02: Kamienna Tarcza, Kurzawa, Łuk Peruna, Wodna Kula, Mgła).
 *
 * Kołowrót zamraża zaczep w chwili zapal() - to wystarcza efektowi, który
 * rośnie i gaśnie w miejscu. Te techniki krążą WOKÓŁ ciała albo trzymają się
 * DŁONI przez kilka sekund, więc czytają zaczep co klatkę z `frame`.
 *
 * Kotwica wygładza zaczep (MediaPipe drga o kilka px między klatkami) i
 * TRZYMA ostatni znany stan, gdy dłoń/poza zniknie - efekt nie gaśnie i nie
 * skacze do środka ekranu (GEMINI.md §2: nic nie mówi źle).
 *
 * Konwencja jak w kolowrot.js:kregSylwetki - `landmarks` (2D) do rysowania,
 * barki 11/12 jako jedyna miara ciała (biodra często poza kadrem).
 */
const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * @returns {{x:number, y:number}[]}  0-2 środki dłoni w px, POSORTOWANE PO X -
 *   MediaPipe nie trzyma stałego indeksu dłoni między klatkami, a łuk/kula
 *   rozpięte między dłońmi przeskakiwałyby przy każdej zamianie.
 */
export function dlonieKlatki(frame, W, H) {
    const wynik = [];
    for (const d of frame?.hands ?? []) {
        const a = d?.landmarks?.[0], b = d?.landmarks?.[9];
        if (!punktOk(a) || !punktOk(b)) continue;
        wynik.push({ x: ((a.x + b.x) / 2) * W, y: ((a.y + b.y) / 2) * H });
    }
    wynik.sort((p, q) => p.x - q.x);
    return wynik.slice(0, 2);
}

/** @returns {{x:number, y:number, skala:number}|null}  środek barków i ich szerokość w px; null bez pozy */
export function barkiKlatki(frame, W, H) {
    const lm = frame?.pose?.landmarks;
    if (!lm || !punktOk(lm[11]) || !punktOk(lm[12])) return null;
    const skala = Math.hypot((lm[11].x - lm[12].x) * W, (lm[11].y - lm[12].y) * H);
    if (!(skala > 1)) return null;
    return { x: ((lm[11].x + lm[12].x) / 2) * W, y: ((lm[11].y + lm[12].y) / 2) * H, skala };
}

/** Wygładzony zaczep o dowolnych polach liczbowych ({x,y}, {x,y,skala}, {x,y,r}). */
export class Kotwica {
    /** @param {number} szybkosc  1/s - im więcej, tym ciaśniej za celem */
    constructor(szybkosc = 14) {
        this.szybkosc = szybkosc;
        this.stan = null;
    }

    get znana() { return this.stan !== null; }

    reset() { this.stan = null; }

    /**
     * @param {object|null} cel  null albo pole z NaN = "nie widać" -> trzyma ostatni stan
     * @param {number} dt
     * @returns {object|null}
     */
    prowadz(cel, dt) {
        const celOk = !!cel && Object.values(cel).every(Number.isFinite);
        if (!celOk) return this.stan;
        if (!this.stan) { this.stan = { ...cel }; return this.stan; }
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const a = 1 - Math.exp(-this.szybkosc * krok);
        for (const k of Object.keys(cel)) {
            const s = this.stan[k];
            this.stan[k] = Number.isFinite(s) ? s + (cel[k] - s) * a : cel[k];
        }
        return this.stan;
    }
}
```

- [ ] **Step 5:** `node tools/test-sledzenie.mjs` → PASS.
- [ ] **Step 6: GEMINI.md** — po wierszu `js/kolowrot.js` dopisz:

```
| `js/sledzenie.js` | Zaczepy technik, które PODĄŻAJĄ za graczem (proste combo 2026-10-02): środki dłoni posortowane po x, środek i szerokość barków, `Kotwica` - wygładzenie + trzymanie ostatniego stanu, gdy dłoń/poza zniknie |
```
- [ ] **Step 7: Commit** `git add js/sledzenie.js tools/_klatka-techniki.mjs tools/test-sledzenie.mjs GEMINI.md && git commit -m "Sledzenie ciala dla technik trwajacych: dlonie, barki, Kotwica"`

## Task 3: Warstwa za sylwetką (`js/warstwaZaSylwetka.js`)

**Files:**
- Create: `js/warstwaZaSylwetka.js`, `tools/test-warstwa-za-sylwetka.mjs`
- Modify: `GEMINI.md`

**Interfaces — Produces:** `class WarstwaZaSylwetka`: `zacznij(W, H) -> CanvasRenderingContext2D | null` (null bez `document`), `zakoncz(ctx, maska, szer, wys, fit)` — wycina sylwetkę (`destination-out`) i nakłada warstwę na `ctx`; bez maski nakłada bez wycinania.

- [ ] **Step 1: Test (failing)** `tools/test-warstwa-za-sylwetka.mjs`:

```js
/**
 * js/warstwaZaSylwetka.js - kolejność operacji na atrapie DOM.
 *   node tools/test-warstwa-za-sylwetka.mjs
 */
let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const { WarstwaZaSylwetka } = await import('../js/warstwaZaSylwetka.js');
spr('bez document zacznij() zwraca null (Node, testy technik)', new WarstwaZaSylwetka().zacznij(100, 50) === null);

const dziennik = [];
function atrapaCtx(nazwa) {
    const c = { globalCompositeOperation: 'source-over', globalAlpha: 1 };
    for (const m of ['clearRect', 'save', 'restore', 'setTransform', 'putImageData', 'drawImage'])
        c[m] = (...a) => dziennik.push(`${nazwa}.${m}:${m === 'drawImage' ? c.globalCompositeOperation : ''}`);
    c.createImageData = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return c;
}
let licznik = 0;
globalThis.document = {
    createElement() {
        const p = { width: 1, height: 1 };
        const nazwa = `p${licznik++}`;
        p.getContext = () => (p._c ??= atrapaCtx(nazwa));
        return p;
    }
};
const ekranCtx = atrapaCtx('ekran');

console.log('Z MASKĄ:');
{
    const w = new WarstwaZaSylwetka();
    const warstwa = w.zacznij(100, 50);
    spr('zacznij() zwraca kontekst warstwy', !!warstwa);
    dziennik.length = 0;
    w.zakoncz(ekranCtx, new Uint8Array(4 * 2), 4, 2, { offsetX: 0, offsetY: 0, scaledW: 100, scaledH: 50 });
    const wyciecie = dziennik.findIndex(z => z.endsWith('drawImage:destination-out'));
    const nalozenie = dziennik.findIndex(z => z.startsWith('ekran.drawImage'));
    spr('sylwetka wycięta z warstwy (destination-out)', wyciecie >= 0);
    spr('...ZANIM warstwa trafi na ekran', nalozenie > wyciecie);
}
console.log('\nBEZ MASKI:');
{
    const w = new WarstwaZaSylwetka();
    w.zacznij(100, 50);
    dziennik.length = 0;
    w.zakoncz(ekranCtx, null, 0, 0, null);
    spr('bez maski nic nie jest wycinane', !dziennik.some(z => z.endsWith('destination-out')));
    spr('...a warstwa i tak trafia na ekran', dziennik.some(z => z.startsWith('ekran.drawImage')));
    let rzucil = false;
    try { w.zakoncz(null, null, 0, 0, null); new WarstwaZaSylwetka().zakoncz(ekranCtx, null, 0, 0, null); } catch { rzucil = true; }
    spr('ctx null / zakoncz bez zacznij - bez wyjątku', !rzucil);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2:** `node tools/test-warstwa-za-sylwetka.mjs` → FAIL (brak modułu).
- [ ] **Step 3: Implementacja** `js/warstwaZaSylwetka.js`:

```js
/**
 * Warstwa rysowana ZA sylwetką gracza - mgła, przez którą ciało się
 * "wynurza" (Mgła Mokoszy), tylna połowa orbity kamieni (Kamienna Tarcza)
 * i pyłu (Kurzawa). Proste combo 2026-10-02.
 *
 * Gra nie ma osobnej warstwy "za ciałem" - wideo i efekty leżą na jednym
 * płótnie. Zamiast tego: efekt rysuje się na płótnie pomocniczym, z którego
 * WYCINAMY maskę segmentacji (destination-out, ta sama maska i ten sam
 * `fit` co zaplon.js), i dopiero wtedy nakładamy je na scenę. Ciało zostaje
 * nietknięte, więc czyta się jako stojące PRZED efektem.
 *
 * Bez maski (brak pozy, maska jeszcze nie przyszła) warstwa nakłada się bez
 * wycinania - efekt widać, tylko leży na ciele (GEMINI.md §2).
 */
export class WarstwaZaSylwetka {
    constructor() {
        this._plotno = null;
        this._ctx = null;
        this._maska = null;
        this._maskaCtx = null;
        this._obraz = null;
    }

    /**
     * Czyści i zwraca kontekst warstwy W×H. null bez `document` (testy w Node)
     * albo przy złych wymiarach - wywołujący pomija wtedy rysowanie tej warstwy.
     */
    zacznij(W, H) {
        if (typeof document === 'undefined' || !(W > 0) || !(H > 0)) return null;
        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._ctx = this._plotno.getContext('2d');
        }
        if (this._plotno.width !== W || this._plotno.height !== H) {
            this._plotno.width = W;
            this._plotno.height = H;
        }
        this._ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.globalAlpha = 1;
        this._ctx.clearRect(0, 0, W, H);
        return this._ctx;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx  scena
     * @param {Uint8Array|null} maska  pewność 0..255, jak zaplon.updateAndDraw
     * @param {number} szer
     * @param {number} wys
     * @param {{offsetX,offsetY,scaledW,scaledH}|null} fit
     */
    zakoncz(ctx, maska, szer, wys, fit) {
        if (!ctx || !this._ctx) return;
        if (maska && szer > 0 && wys > 0 && fit && maska.length >= szer * wys) {
            this._wypelnijMaske(maska, szer, wys);
            this._ctx.globalCompositeOperation = 'destination-out';
            this._ctx.globalAlpha = 1;
            this._ctx.drawImage(this._maska, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
            this._ctx.globalCompositeOperation = 'source-over';
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(this._plotno, 0, 0);
        ctx.restore();
    }

    /** Maska ma jeden kanał; przenosimy go w alfę - ten sam wzór co zaplon.js _wypelnijMaske. */
    _wypelnijMaske(maska, szer, wys) {
        if (!this._maska) {
            this._maska = document.createElement('canvas');
            this._maskaCtx = this._maska.getContext('2d');
        }
        if (this._maska.width !== szer || this._maska.height !== wys || !this._obraz) {
            this._maska.width = szer;
            this._maska.height = wys;
            this._obraz = this._maskaCtx.createImageData(szer, wys);
        }
        const d = this._obraz.data;
        for (let i = 0, n = szer * wys; i < n; i++) {
            const j = i * 4;
            d[j] = 255; d[j + 1] = 255; d[j + 2] = 255;
            d[j + 3] = maska[i];
        }
        this._maskaCtx.putImageData(this._obraz, 0, 0);
    }
}
```

- [ ] **Step 4:** `node tools/test-warstwa-za-sylwetka.mjs` → PASS.
- [ ] **Step 5: GEMINI.md** — dopisz pod `js/sledzenie.js`:

```
| `js/warstwaZaSylwetka.js` | Płótno pomocnicze dla efektów ZA ciałem (Mgła, tył orbity Tarczy i Kurzawy): wycina maskę segmentacji (`destination-out`, ten sam `fit` co zaplon.js) przed nałożeniem na scenę; bez maski nakłada bez wycinania |
```
- [ ] **Step 6: Commit** `git add js/warstwaZaSylwetka.js tools/test-warstwa-za-sylwetka.mjs GEMINI.md && git commit -m "Warstwa za sylwetka: efekty, przez ktore cialo sie wynurza"`

---

## Wzorzec wpięcia techniki (używany w Task 4–8)

Każde z zadań 4–8 wykonuje DOKŁADNIE te kroki wpięcia, podstawiając swoje `<id>`, `<Klasa>`, `<plik>`. Task 4 dodatkowo tworzy obiekt `kontekstTechnik` w `main.js` i `scena.html` (kolejne zadania tylko dopisują wywołanie).

**W1. `js/kombosy.js`** — wpis na końcu `KOMBOSY` (z komentarzem z zadania) i przecinek po poprzednim wpisie.

**W2. `js/techniki.js`** — wpis w `BARWA_ZAPLONU` (wartość z zadania) i gałąź PO gałęzi `kolowrot`, PRZED `dym`:

```js
    } else if (technika.uzbraja === '<id>') {
        // Natychmiastowa jak Kołowrót, siła STAŁA (combo jest gratis). Zaczep
        // (barki/dłonie) moduł liczy SAM co klatkę - patrz js/sledzenie.js.
        s.<id>.zapal(1.0);
```
oraz `<id>` w liście worka w JSDoc `odpalTechnike`.

**W3. `js/efekty.js`** — wiersz w `TABELA` przed `dym:` (wartość z zadania, kształt `'blyskIFala'`, czas `1.3`).

**W4. `js/swiezeModuly.js`** — `import { <Klasa> } from './<plik>';`, `'<id>'` na końcu `KLUCZE_MODULOW`, `<id>: new <Klasa>()` na końcu zwracanego obiektu.

**W5. `js/main.js`:**
- import obok `import { Kolowrot } from './kolowrot.js';`
- `let <id> = new <Klasa>();` pod `let kolowrot = new Kolowrot();`
- `<id>` w destrukturyzacji `resetujModuly()` (po `kolowrot`)
- `<id>` w worku `odpalTechnike(... { efekty, ..., kolowrot, dmuchanie, <id> })`
- `<id>.updateAndDraw(ctx, kontekstTechnik, dt);` pod `kolowrot.updateAndDraw(ctx, dt);`
- (tylko Task 4) nad `piorun.updateAndDraw(ctx, dt);`:

```js
    // Kontekst technik, które PODĄŻAJĄ za ciałem (proste combo 2026-10-02) -
    // każda czyta z niego zaczep co klatkę (js/sledzenie.js), a Mgła/Tarcza/
    // Kurzawa także maskę, żeby rysować ZA sylwetką (js/warstwaZaSylwetka.js).
    const kontekstTechnik = { frame, W: canvas.width, H: canvas.height,
                              maska: frame.pose ? maskaDane : null, maskaSzer, maskaWys, fit };
```
(sprawdź, że `frame` i `fit` są w zasięgu tej funkcji — są zdefiniowane w `klatka()` w liniach ~645/677).

**W6. `tools/scena.html`:**
- pod blokiem `await Promise.all([...])`: `const { <Klasa>, NASTAWY: NASTAWY_<ID> } = await import('./js/<plik>');`
- `const <id> = new <Klasa>();` pod `const kolowrot = new Kolowrot();`
- wiersz w `MODULY_NASTAWY`: `{ etykieta: '<Nazwa>', plik: 'js/<plik>', nastawy: NASTAWY_<ID>, instancja: <id> },`
- `<id>` w `worekTechnik`
- w `rysujKlatke` pod `kolowrot.updateAndDraw(ctx, dt);`: `<id>.updateAndDraw(ctx, kontekstTechnik, dt);`
- (tylko Task 4) nad tym wywołaniem: `const kontekstTechnik = { frame, W: canvas.width, H: canvas.height, maska: frame.maska, maskaSzer: MASKA_SZER, maskaWys: MASKA_WYS, fit: frame.fit };`
- wiersz w `TECHNIKI`: `{ uzbraja: '<id>', nazwa: '<Nazwa>', sekwencja: [...] },`
- klucz w `SCENARIUSZE`: `<id>: () => odpalTechnike({ id: 'x', nazwa: '<Nazwa>', uzbraja: '<id>', sekwencja: [...] }, zbudujFrame(0), canvas.width, canvas.height, 0, worekTechnik),`

**W7. Testy wpięcia:**
- `tools/test-techniki.mjs`: `<id>: szpieg('<id>'),` w `zrobWorek` i `testTechnika('<id>', [...], ['<id>.zapal'], '<Nazwa>');`
- `tools/test-swieze-moduly.mjs` w bloku BEZCZYNNOŚĆ: `spr('<nazwa> nie trwa', m.<id>.aktywny === false);`
- `tools/test-kombosy.mjs`: `'<id>'` dopisane do `ZNANE_UZBRAJA` (tablica wprowadzona w Task 4) + asercja sekwencji z zadania.

**W8. GEMINI.md** — wiersz tabeli plików pod `js/kolowrot.js` (treść w zadaniu).

**W9. Weryfikacja i commit:** `sh tools/test-wszystko.sh` → wszystko ✓; serwer statyczny (`python3 -m http.server 8000` w katalogu repo, jeśli nie działa) i `http://localhost:8000/tools/scena.html` → przycisk techniki, zrzut przez Chrome MCP, ocena: efekt widoczny, śledzi syntetyczną postać, gaśnie. Commit jednym poleceniem `git add` + `git commit -m "Combo <Nazwa> (<sekwencja>): ..."`.

---

## Task 4: Kamienna Tarcza (weles × 3)

**Files:** Create `js/kamiennaTarcza.js`, `tools/test-kamienna-tarcza.mjs`; Modify wg wzorca W1–W8 + `tools/test-kombosy.mjs` (przeróbka k2 i niezmiennika welesa).

**Interfaces:** Consumes `barkiKlatki`, `Kotwica` (Task 2), `WarstwaZaSylwetka` (Task 3), `MANIFEST.odlamek` (Task 1). Produces `class KamiennaTarcza`, `CZAS_TRWANIA`, `NASTAWY`, `obwiednia(t)`, `pozycjaOdlamka(o, t, srodek, skala)`.

- [ ] **Step 1: Test (failing)** `tools/test-kamienna-tarcza.mjs`:

```js
/**
 * Kamienna Tarcza - obwiednia, orbita, śledzenie barków, cykl życia; bez document.
 *   node tools/test-kamienna-tarcza.mjs
 */
import { KamiennaTarcza, obwiednia, pozycjaOdlamka, CZAS_TRWANIA, NASTAWY } from '../js/kamiennaTarcza.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('OBWIEDNIA:');
spr('zero na starcie i po końcu', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0);
spr('pełna w środku', obwiednia(CZAS_TRWANIA * 0.5) > 0.99);
spr('NaN -> 0', obwiednia(NaN) === 0);

console.log('\nORBITA:');
const o = { kat0: 0, kierunek: 1, promienWsp: 1, wysokosc: 0, obrot0: 0, vObrot: 0, opoznienieOpadu: 0 };
const srodek = { x: 1000, y: 400 };
const p0 = pozycjaOdlamka(o, 0, srodek, 200);
spr('w t=0 odłamek wylatuje Z BARKÓW (promień 0)', Math.abs(p0.x - 1000) < 1e-6);
const p1 = pozycjaOdlamka(o, NASTAWY.T_FORMOWANIA, srodek, 200);
spr('po formowaniu na orbicie (promień = skala*PROMIEN_MNOZNIK)', Math.abs(Math.hypot(p1.x - 1000, (p1.y - 400 - 200 * NASTAWY.OBNIZENIE_MNOZNIK) / NASTAWY.SQUASH) - 200 * NASTAWY.PROMIEN_MNOZNIK) < 1);
const pSpad = pozycjaOdlamka(o, CZAS_TRWANIA - 0.01, srodek, 200);
const pPrzed = pozycjaOdlamka(o, NASTAWY.T_OPADANIA - 0.01, srodek, 200);
// Spadek po ~1 s to setki px; wahanie samej orbity w pionie to najwyżej 2*r*SQUASH (~190 px).
spr('pod koniec kamienie OPADAJĄ (niżej niż orbita)', pSpad.y > pPrzed.y + 200 * NASTAWY.PROMIEN_MNOZNIK * NASTAWY.SQUASH * 2);

console.log('\nCYKL ŻYCIA I ŚLEDZENIE:');
const t = new KamiennaTarcza();
spr('bezczynna na starcie', t.aktywny === false);
t.zapal(1);
spr(`zapal() -> aktywna, ${NASTAWY.LICZBA} odłamków`, t.aktywny && t._odlamki.length === NASTAWY.LICZBA);
t.zapal(1);
spr('ponowny zapal() RESTARTUJE, nie podwaja', t._odlamki.length === NASTAWY.LICZBA && t._t === 0);
przepusc(t, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const z1 = { ...t.zaczep };
przepusc(t, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', t.zaczep.x > z1.x + 100);
const z2 = { ...t.zaczep };
przepusc(t, klatka({ barki: null }), 0.5);
spr('poza znika -> zaczep stoi, skończony', t.zaczep.x === z2.x && Number.isFinite(t.zaczep.skala));
let rzucil = false;
try { t.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie bez załadowanych assetów i bez document nie rzuca', rzucil === false);
przepusc(t, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', t.aktywny === false);
const bezPozy = new KamiennaTarcza();
bezPozy.zapal(1);
przepusc(bezPozy, klatka({ barki: null }), 0.2);
spr('bez pozy od początku - zaczep zastępczy, skończony', Number.isFinite(bezPozy.zaczep.x) && bezPozy.zaczep.skala > 1);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2:** `node tools/test-kamienna-tarcza.mjs` → FAIL (brak modułu).
- [ ] **Step 3: Implementacja** `js/kamiennaTarcza.js`:

```js
/**
 * Kamienna Tarcza - nagroda za combo weles × 3 (proste combo 2026-10-02,
 * docs/superpowers/specs/2026-10-02-proste-kombosy-design.md). Pierwsza
 * technika z WŁASNĄ fakturą Welesa (dirt_* z paczki Kenney, CC0).
 *
 * Odłamki ziemi wylatują z barków na eliptyczną orbitę wokół tułowia, krążą
 * i na koniec opadają. Tylna połowa orbity (sin(kąt) < 0, "dalej od kamery")
 * rysuje się ZA sylwetką (js/warstwaZaSylwetka.js), przednia przed nią -
 * dzięki temu kamienie naprawdę OKRĄŻAJĄ ciało, nie wiszą przed nim.
 *
 * Zaczep: środek barków co klatkę (js/sledzenie.js), NIE zamrożony w zapal()
 * jak w Kołowrocie - tarcza ma iść za tancerzem. Rozmiary to mnożniki skali
 * barków (wzorzec kolowrot.js).
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    LICZBA: 10,
    T_FORMOWANIA: 0.6,        // s - wylot z barków na orbitę
    T_OPADANIA: 5.0,          // s - od tej chwili orbita puszcza i kamienie spadają
    PROMIEN_MNOZNIK: 1.25,    // skala * to = promień orbity
    SQUASH: 0.38,             // spłaszczenie elipsy - orbita pozioma, widziana lekko z góry
    OBNIZENIE_MNOZNIK: 0.6,   // środek orbity = barki + skala * to w dół (środek tułowia)
    PREDKOSC_KATOWA: 2.2,     // rad/s
    ROZMIAR_OD: 0.32, ROZMIAR_DO: 0.55,   // skala * to
    GRAWITACJA_MNOZNIK: 9,    // skala * to = px/s^2
    BARWA_KAMIENIA: [110, 90, 135],    // ciemny kamień z nutą fioletu Welesa
    BARWA_POSWIATY: [190, 100, 255]    // fiolet Welesa (techniki.js BARWA_GROMU)
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** Alfa całości w chwili t (s) - czysta funkcja. */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    const narost = Math.min(1, t / NASTAWY.T_FORMOWANIA);
    const opad = t > NASTAWY.T_OPADANIA
        ? Math.max(0, 1 - (t - NASTAWY.T_OPADANIA) / (CZAS_TRWANIA - NASTAWY.T_OPADANIA)) : 1;
    return narost * opad;
}

/**
 * Położenie jednego odłamka - czysta funkcja.
 * @returns {{x:number, y:number, przod:boolean, obrot:number}}
 */
export function pozycjaOdlamka(o, t, srodek, skala) {
    const N = NASTAWY;
    const wylot = clamp01(t / N.T_FORMOWANIA);
    const r = skala * N.PROMIEN_MNOZNIK * (1 - Math.pow(1 - wylot, 3)) * o.promienWsp;
    const kat = o.kat0 + o.kierunek * N.PREDKOSC_KATOWA * t;
    const tOpad = Math.max(0, t - N.T_OPADANIA - o.opoznienieOpadu);
    const spad = 0.5 * skala * N.GRAWITACJA_MNOZNIK * tOpad * tOpad;
    return {
        x: srodek.x + Math.cos(kat) * r,
        y: srodek.y + skala * N.OBNIZENIE_MNOZNIK + Math.sin(kat) * r * N.SQUASH + o.wysokosc * skala + spad,
        przod: Math.sin(kat) > 0,
        obrot: o.obrot0 + o.vObrot * t
    };
}

export class KamiennaTarcza {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._odlamki = [];
        this._kotwica = new Kotwica(12);
        this._warstwa = new WarstwaZaSylwetka();
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kotwica.reset();
        // Jeden kierunek obrotu na całą tarczę - inaczej kamienie mijałyby
        // się i czytały jako chaos, nie jako tarcza.
        const kierunek = Math.random() < 0.5 ? -1 : 1;
        const N = NASTAWY;
        this._odlamki = Array.from({ length: N.LICZBA }, (_, i) => ({
            kat0: (i / N.LICZBA) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
            kierunek,
            promienWsp: 0.85 + Math.random() * 0.3,
            wysokosc: (Math.random() - 0.5) * 0.5,
            rozmiar: N.ROZMIAR_OD + Math.random() * (N.ROZMIAR_DO - N.ROZMIAR_OD),
            obrot0: Math.random() * Math.PI * 2,
            vObrot: (Math.random() * 2 - 1) * 3,
            opoznienieOpadu: Math.random() * 0.4,
            wariant: Math.floor(Math.random() * MANIFEST.odlamek.length)
        }));
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx
     * @param {{frame, W, H, maska, maskaSzer, maskaWys, fit}} k  main.js kontekstTechnik
     * @param {number} dt
     */
    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };   // ten sam zastępczy rząd wielkości co kregSylwetki
        if (!ctx) return;   // guard PO zegarze i zaczepie - patrz kolowrot.js

        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        const pozycje = this._odlamki.map(o => [o, pozycjaOdlamka(o, this._t, this.zaczep, this.zaczep.skala)]);

        // Najpierw TYŁ (za ciałem), potem PRZÓD - kolejność rysowania = głębia.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            for (const [o, p] of pozycje) if (!p.przod) this._rysuj(tyl, o, p, alfa);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        for (const [o, p] of pozycje) if (p.przod) this._rysuj(ctx, o, p, alfa);
    }

    _rysuj(c, o, p, alfa) {
        const img = obraz(MANIFEST.odlamek[o.wariant]);
        if (!img) return;   // asset jeszcze się ładuje - GEMINI.md §2
        const d = this.zaczep.skala * o.rozmiar;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.obrot);
        // Fioletowa poświata pod spodem ('lighter'), kamień na wierzchu
        // ('source-over') - kamień ma być MATERIĄ, nie kolejną świecącą plamą.
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = clamp01(alfa * 0.5);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_POSWIATY, 128), -d * 0.65, -d * 0.65, d * 1.3, d * 1.3);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = clamp01(alfa);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_KAMIENIA, 128), -d / 2, -d / 2, d, d);
        c.restore();
    }
}
```

- [ ] **Step 4:** `node tools/test-kamienna-tarcza.mjs` → PASS.
- [ ] **Step 5: Przeróbka `tools/test-kombosy.mjs`** (Weles po raz pierwszy ZACZYNA sekwencję):
  - na górze pliku, pod `const spr = ...`, dodaj:

```js
// Wszystkie znane wartości `uzbraja` - każda ma gałąź w js/techniki.js.
// Nowa technika = nowy wpis tutaj (wcześniej ta lista była powielona w dwóch asercjach).
const ZNANE_UZBRAJA = ['ogien', 'aard', 'tecza', 'gromWZiemie', 'kolowrot', 'dym', 'kamiennaTarcza'];
```
  - obie asercje `KOMBOSY.every(k => k.uzbraja === 'ogien' || ...)` zamień na `KOMBOSY.every(k => ZNANE_UZBRAJA.includes(k.uzbraja))` (opis drugiej: `'każdy kombos deklaruje znaną technikę (ZNANE_UZBRAJA)'`).
  - k2: zamień `k2.dodaj('weles', 0);` na `k2.dodaj('mokosz', 0);` i komentarz nad nim na:

```js
// Pieczęć "nie ta" na START bufora: mokosz, po którym idzie swarog - para
// mokosz->swarog nie jest żadnym combo. (Do 2026-10-02 był tu weles, ale
// Kamienna Tarcza - weles×3 - sprawiła, że weles ZACZYNA sekwencję.)
```
  - asercję „weles występuje w dwóch sekwencjach ... ŻADNEJ nie jest pierwszym" (z komentarzem ZASTĄPIONE nad nią) zamień na ogólne testy kolizji:

```js
// ZASTĄPIONE (2026-10-02, proste combo): niezmiennik "weles nigdy nie
// zaczyna" przestał być prawdą (Kamienna Tarcza = weles×3). Pilnujemy
// tego, na czym naprawdę opiera się silnik: żadna sekwencja nie jest
// PREFIKSEM ani SUFIKSEM innej - inaczej krótsza odpalałaby się w środku
// dłuższej albo _dopasuj() (pierwszy pasujący wpis) wybierałby po cichu.
const jestPrefiksem = (krotszy, dluzszy) =>
    dluzszy.length > krotszy.length && dluzszy.slice(0, krotszy.length).join() === krotszy.join();
const jestSufiksemCalej = (krotszy, dluzszy) =>
    dluzszy.length > krotszy.length && dluzszy.slice(-krotszy.length).join() === krotszy.join();
spr('żadna sekwencja nie jest prefiksem ani sufiksem innej',
    KOMBOSY.every(a => KOMBOSY.every(b => a === b ||
        (!jestPrefiksem(a.sekwencja, b.sekwencja) && !jestSufiksemCalej(a.sekwencja, b.sekwencja)))));
spr('żadne dwie techniki nie mają identycznej sekwencji',
    new Set(KOMBOSY.map(k => k.sekwencja.join())).size === KOMBOSY.length);
```
  - przed `console.log(ok ? ...` dodaj:

```js
console.log('\nKAMIENNA TARCZA (weles × 3):');
const k20 = new KomboSilnik();
spr('pierwszy weles nie odpala', k20.dodaj('weles', 0) === null);
spr('drugi weles nie odpala', k20.dodaj('weles', 500) === null);
spr('trzeci weles odpala Kamienną Tarczę', k20.dodaj('weles', 1000)?.id === 'kamiennaTarcza');
spr('czwarty weles odpala PONOWNIE (łańcuch)', k20.dodaj('weles', 1500)?.id === 'kamiennaTarcza');
```
- [ ] **Step 6: Wpięcie W1–W8** z wartościami:
  - W1 (`kombosy.js`):

```js
    // KAMIENNA TARCZA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // ziemia złożona trzy razy - odłamki krążą wokół tułowia. Jedyne nowe
    // POWTÓRZENIE w tej partii (wybór właściciela gry). Weles po raz pierwszy
    // ZACZYNA sekwencję - test k2 w test-kombosy.mjs startuje teraz od mokosz.
    // Natychmiastowa jak Kołowrót (`uzbraja` = własne id).
    { id: 'kamiennaTarcza', nazwa: 'Kamienna Tarcza',
      sekwencja: ['weles', 'weles', 'weles'], uzbraja: 'kamiennaTarcza' }
```
  - W2: `kamiennaTarcza: [170, 120, 230],   // fiolet-kamień Welesa`
  - W3: `kamiennaTarcza: { barwa: '270, 45%, 55%', ksztalt: 'blyskIFala', czas: 1.3 },`
  - W4–W6: `<Klasa>`=`KamiennaTarcza`, `<plik>`=`kamiennaTarcza.js`, `<id>`=`kamiennaTarcza`, `<Nazwa>`=`Kamienna Tarcza`, sekwencja `['weles', 'weles', 'weles']`; tu też tworzysz `kontekstTechnik` w `main.js` i `scena.html`.
  - W7: jak we wzorcu (`'kamiennaTarcza'` już jest w `ZNANE_UZBRAJA`).
  - W8: `| \`js/kamiennaTarcza.js\` | Kamienna Tarcza (weles×3) - odłamki ziemi (dirt_*) na orbicie wokół tułowia, tył orbity ZA sylwetką; zaczep śledzi barki co klatkę |`
- [ ] **Step 7: W9** — testy całości, scena, commit `"Combo Kamienna Tarcza (weles x3): odlamki na orbicie wokol tulowia"`.

## Task 5: Kurzawa (stribog → weles)

**Files:** Create `js/kurzawa.js`, `tools/test-kurzawa.mjs`; Modify wg W1–W8.

**Interfaces:** Consumes `barkiKlatki`, `Kotwica`, `WarstwaZaSylwetka`, `MANIFEST.odlamek`, `MANIFEST.wiryKurzawy`. Produces `class Kurzawa`, `CZAS_TRWANIA`, `NASTAWY`, `obwiednia(t)`, `pozycjaDrobiny(c, srodek, skala)`.

- [ ] **Step 1: Test (failing)** `tools/test-kurzawa.mjs`:

```js
/**
 * Kurzawa - lej wiru pyłu: tor drobiny, cykl życia, śledzenie; bez document.
 *   node tools/test-kurzawa.mjs
 */
import { Kurzawa, obwiednia, pozycjaDrobiny, CZAS_TRWANIA, NASTAWY } from '../js/kurzawa.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('TOR DROBINY:');
const srodek = { x: 1000, y: 400 }, skala = 200;
const c = { kat0: 0, kierunek: 1, zycie: 2, wiek: 0 };
const dol = pozycjaDrobiny({ ...c, wiek: 0.01 }, srodek, skala);
const gora = pozycjaDrobiny({ ...c, wiek: 1.99 }, srodek, skala);
spr('drobina startuje przy pasie, kończy nad głową', dol.y > srodek.y + skala && gora.y < srodek.y - skala);
spr('lej rozszerza się w górę (promień rośnie)', gora.promien > dol.promien);
spr('alfa zero na końcach toru, pełna w połowie', dol.alfa < 0.05 && pozycjaDrobiny({ ...c, wiek: 1 }, srodek, skala).alfa > 0.99);
spr('obwiednia zero po końcu, NaN -> 0', obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const k = new Kurzawa();
spr('bezczynna na starcie', k.aktywny === false);
k.zapal(1); k.zapal(1);
spr('ponowny zapal() restartuje, nie podwaja', k._pyl.length === NASTAWY.LICZBA_PYLU);
przepusc(k, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const x1 = k.zaczep.x;
przepusc(k, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', k.zaczep.x > x1 + 100);
const x2 = k.zaczep.x;
przepusc(k, klatka({ barki: null }), 0.3);
spr('poza znika -> zaczep stoi', k.zaczep.x === x2);
let rzucil = false;
try { k.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie bez assetów nie rzuca', rzucil === false);
przepusc(k, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', k.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2:** `node tools/test-kurzawa.mjs` → FAIL.
- [ ] **Step 3: Implementacja** `js/kurzawa.js`:

```js
/**
 * Kurzawa - nagroda za combo stribog -> weles (proste combo 2026-10-02).
 * Wiatr (Stribog) podrywa ziemię (Weles): lej pyłu spiralą od pasa nad
 * głowę, jak diabeł pyłowy, z kilkoma zawijasami wiru (twirl_*) na różnych
 * wysokościach. Tył leja rysuje się ZA sylwetką (js/warstwaZaSylwetka.js).
 *
 * Drobiny pyłu nie mają fizyki całkowanej - ich tor to czysta funkcja
 * wieku (pozycjaDrobiny): wysokość rośnie liniowo, promień leja rośnie
 * z wysokością, kąt rośnie ze stałą prędkością. Emisja rozłożona na
 * EMISJA_S przez ujemny startowy wiek (wzorzec kolowrot.js).
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const NASTAWY = {
    LICZBA_PYLU: 70,
    LICZBA_WIROW: 5,
    EMISJA_S: 3.0,            // s - przez tyle rodzą się nowe drobiny
    ZYCIE_MIN: 1.4, ZYCIE_MAX: 2.2,
    DOL_MNOZNIK: 1.8,         // start drobiny = barki + skala * to w dół (pas)
    GORA_MNOZNIK: 1.6,        // koniec = barki - skala * to (nad głową)
    PROMIEN_DOL: 0.45, PROMIEN_GORA: 1.6,   // skala * to - lej rozszerza się w górę
    SQUASH: 0.3,
    PREDKOSC_KATOWA: 5.0,     // rad/s
    ROZMIAR_PYLU_OD: 0.12, ROZMIAR_PYLU_DO: 0.28,   // skala * to
    PREDKOSC_WIRU: 3.0,       // rad/s obrotu tekstury zawijasa
    BARWA_PYLU: [205, 165, 105],   // piaskowa ochra
    BARWA_WIRU: [140, 235, 195]    // mięta Striboga (techniki.js BARWA_ZAPLONU.aard)
};
export const CZAS_TRWANIA = NASTAWY.EMISJA_S + NASTAWY.ZYCIE_MAX;   // s - ostatnia drobina zdąży dolecieć

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** Alfa zawijasów wiru - narost 0.4 s, gaśnie w ostatniej sekundzie. */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / 0.4) * Math.min(1, (CZAS_TRWANIA - t) / 1.0);
}

/** Tor drobiny - czysta funkcja wieku. @returns {{x,y,przod,alfa,promien}} */
export function pozycjaDrobiny(c, srodek, skala) {
    const N = NASTAWY;
    const u = clamp01(c.wiek / c.zycie);
    const promien = skala * (N.PROMIEN_DOL + u * (N.PROMIEN_GORA - N.PROMIEN_DOL));
    const kat = c.kat0 + c.kierunek * N.PREDKOSC_KATOWA * c.wiek;
    return {
        x: srodek.x + Math.cos(kat) * promien,
        y: srodek.y + skala * (N.DOL_MNOZNIK - u * (N.DOL_MNOZNIK + N.GORA_MNOZNIK)) + Math.sin(kat) * promien * N.SQUASH,
        przod: Math.sin(kat) > 0,
        alfa: Math.sin(u * Math.PI),
        promien
    };
}

export class Kurzawa {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._pyl = [];
        this._kierunek = 1;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        const N = NASTAWY;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kotwica.reset();
        this._kierunek = Math.random() < 0.5 ? -1 : 1;   // jeden kierunek wiru na cały lej
        this._pyl = Array.from({ length: N.LICZBA_PYLU }, () => ({
            kat0: Math.random() * Math.PI * 2,
            kierunek: this._kierunek,
            zycie: N.ZYCIE_MIN + Math.random() * (N.ZYCIE_MAX - N.ZYCIE_MIN),
            wiek: -Math.random() * N.EMISJA_S,
            rozmiar: N.ROZMIAR_PYLU_OD + Math.random() * (N.ROZMIAR_PYLU_DO - N.ROZMIAR_PYLU_OD),
            obrot: Math.random() * Math.PI * 2,
            wariant: Math.floor(Math.random() * MANIFEST.odlamek.length)
        }));
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }
        for (const c of this._pyl) c.wiek += krok;

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        if (!ctx) return;

        const sk = this.zaczep.skala;
        const zywe = this._pyl.filter(c => c.wiek >= 0 && c.wiek < c.zycie)
            .map(c => [c, pozycjaDrobiny(c, this.zaczep, sk)]);

        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            for (const [c, p] of zywe) if (!p.przod) this._rysujPyl(tyl, c, p, sk);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        for (const [c, p] of zywe) if (p.przod) this._rysujPyl(ctx, c, p, sk);
        this._rysujWiry(ctx, sk);
    }

    _rysujPyl(c, d, p, sk) {
        const img = obraz(MANIFEST.odlamek[d.wariant]);
        if (!img) return;
        const r = sk * d.rozmiar;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(d.obrot + d.wiek * 4);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = clamp01(p.alfa * this._sila * 0.85);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_PYLU, 64), -r / 2, -r / 2, r, r);
        c.restore();
    }

    _rysujWiry(c, sk) {
        const N = NASTAWY;
        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N.LICZBA_WIROW; i++) {
            const img = obraz(MANIFEST.wiryKurzawy[i % MANIFEST.wiryKurzawy.length]);
            if (!img) continue;
            const u = (i + 0.5) / N.LICZBA_WIROW;
            const y = this.zaczep.y + sk * (N.DOL_MNOZNIK - u * (N.DOL_MNOZNIK + N.GORA_MNOZNIK));
            const d = 2 * sk * (N.PROMIEN_DOL + u * (N.PROMIEN_GORA - N.PROMIEN_DOL));
            c.save();
            c.translate(this.zaczep.x, y);
            c.scale(1, N.SQUASH * 1.6);
            c.rotate(this._kierunek * N.PREDKOSC_WIRU * this._t + i);
            c.globalAlpha = clamp01(alfa * 0.45);
            c.drawImage(wypalTintowany(img, N.BARWA_WIRU, 256), -d / 2, -d / 2, d, d);
            c.restore();
        }
        c.restore();
    }
}
```

- [ ] **Step 4:** `node tools/test-kurzawa.mjs` → PASS.
- [ ] **Step 5: Wpięcie W1–W8:**
  - W1:

```js
    // KURZAWA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md): wiatr
    // (Stribog) podrywa ziemię (Weles) - lej pyłu wokół tancerza. Para
    // stribog->weles nie jest prefiksem/sufiksem żadnej trójki. Łańcuch:
    // stribog->weles->weles->weles daje Kurzawę, potem Kamienną Tarczę.
    { id: 'kurzawa', nazwa: 'Kurzawa',
      sekwencja: ['stribog', 'weles'], uzbraja: 'kurzawa' }
```
  - W2: `kurzawa: [215, 175, 110],   // piaskowa ochra pyłu`
  - W3: `kurzawa: { barwa: '38, 70%, 60%', ksztalt: 'blyskIFala', czas: 1.3 },`
  - W4–W6: `Kurzawa`, `kurzawa.js`, `kurzawa`, `Kurzawa`, `['stribog', 'weles']`.
  - W7: `'kurzawa'` do `ZNANE_UZBRAJA`; w `test-kombosy.mjs`:

```js
console.log('\nKURZAWA (stribog -> weles) i łańcuch z Tarczą:');
const k21 = new KomboSilnik();
k21.dodaj('stribog', 0);
spr('stribog -> weles odpala Kurzawę', k21.dodaj('weles', 500)?.id === 'kurzawa');
k21.dodaj('weles', 1000);
spr('...a dwa kolejne welesy - Kamienną Tarczę', k21.dodaj('weles', 1500)?.id === 'kamiennaTarcza');
```
  - W8: `| \`js/kurzawa.js\` | Kurzawa (stribog→weles) - lej pyłu (dirt_*) spiralą od pasa nad głowę z zawijasami wiru (twirl_*), tył leja ZA sylwetką; śledzi barki |`
- [ ] **Step 6: W9**, commit `"Combo Kurzawa (stribog->weles): lej pylu wokol sylwetki"`.

## Task 6: Łuk Peruna (mokosz → perun)

**Files:** Create `js/lukPeruna.js`, `tools/test-luk-peruna.mjs`; Modify `js/piorun.js` (eksport `rysujSciezke`) + W1–W8.

**Interfaces:** Consumes `generujPiorun(start, koniec, opcje)` i `rysujSciezke(ctx, punkty, barwa, alfaRdzen, alfaPoswiata, grubosc)` z `piorun.js`, `dlonieKlatki`, `barkiKlatki`, `Kotwica`, `MANIFEST.wyladowanie`. Produces `class LukPeruna`, `CZAS_TRWANIA`, `NASTAWY`, `obwiednia(t)`, `mapujSciezke(punkty, a, b)`, `koncowkiLuku(dlonie, skala)`.

- [ ] **Step 1: Eksport w `js/piorun.js`** — `function rysujSciezke(` → `export function rysujSciezke(`; nad nią komentarz `// Eksportowana (2026-10-02) dla js/lukPeruna.js - ten sam rdzeń source-over i ta sama poświata, żeby łuk czytał się jako piorun Peruna.` Uruchom `node tools/test-piorun.mjs` → PASS (bez zmian zachowania).
- [ ] **Step 2: Test (failing)** `tools/test-luk-peruna.mjs`:

```js
/**
 * Łuk Peruna - końcówki łuku z dłoni, mapowanie ścieżki, cykl życia; bez document.
 *   node tools/test-luk-peruna.mjs
 */
import { LukPeruna, obwiednia, mapujSciezke, koncowkiLuku, CZAS_TRWANIA, NASTAWY } from '../js/lukPeruna.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('MAPOWANIE ŚCIEŻKI:');
const m = mapujSciezke([{ x: 0, y: 0 }, { x: 0.5, y: 0.1 }, { x: 1, y: 0 }], { x: 100, y: 100 }, { x: 300, y: 100 });
spr('końce ścieżki dokładnie w dłoniach', m[0].x === 100 && m[2].x === 300 && m[2].y === 100);
spr('wychylenie skaluje się z długością łuku (prostopadle)', Math.abs(m[1].y - 120) < 1e-9);

console.log('\nKOŃCÓWKI:');
spr('dwie dłonie -> łuk między nimi', koncowkiLuku([{ x: 1, y: 2 }, { x: 5, y: 2 }], 100).b.x === 5);
const jedna = koncowkiLuku([{ x: 10, y: 500 }], 100);
spr('jedna dłoń -> wyładowanie W GÓRĘ', jedna.b.x === 10 && jedna.b.y === 500 - 100 * NASTAWY.WYSOKOSC_JEDNEJ_DLONI);
spr('brak dłoni -> null', koncowkiLuku([], 100) === null);
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const l = new LukPeruna();
l.zapal(1); l.zapal(1);
spr('aktywny po zapal()', l.aktywny);
przepusc(l, klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] }), 0.3);
spr('ścieżki wygenerowane po pierwszych klatkach', l._luki.length === NASTAWY.LICZBA_LUKOW);
const a1 = { ...l._a.stan };
przepusc(l, klatka({ dlonie: [[0.6, 0.5], [0.4, 0.5]] }), 0.1);
spr('zamiana kolejności dłoni NIE przerzuca łuku', Math.abs(l._a.stan.x - a1.x) < 1);
przepusc(l, klatka({ dlonie: [] }), 0.3);
spr('dłonie znikają -> końce stoją, skończone', Number.isFinite(l._a.stan.x) && Number.isFinite(l._b.stan.y));
let rzucil = false;
try { l.updateAndDraw(atrapaCtx(), kontekst(klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] })), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa ctx, bez assetów) nie rzuca', rzucil === false);
const bez = new LukPeruna();
bez.zapal(1);
let rzucil2 = false;
try { bez.updateAndDraw(atrapaCtx(), kontekst(klatka({ barki: null })), 1 / 60); } catch (e) { rzucil2 = e; }
spr('bez dłoni i pozy od początku - zastępcze końce, bez wyjątku', rzucil2 === false);
przepusc(l, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', l.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3:** `node tools/test-luk-peruna.mjs` → FAIL.
- [ ] **Step 4: Implementacja** `js/lukPeruna.js`:

```js
/**
 * Łuk Peruna - nagroda za combo mokosz -> perun (proste combo 2026-10-02).
 * Woda przewodzi piorun (a w części rekonstrukcji mitu Mokosz jest żoną
 * Peruna): między dłońmi trzaska łuk elektryczny, który rozciąga się
 * razem z rękami. Rozsuwasz dłonie - łuk cienieje i bardziej się szarpie.
 *
 * Ścieżki generuje TEN SAM kod co piorun Gromu w Ziemię (piorun.js
 * generujPiorun/rysujSciezke - twardy rdzeń source-over), ale w układzie
 * ZNORMALIZOWANYM (od (0,0) do (1,0)) i dopiero przy rysowaniu mapowane
 * na bieżące położenie dłoni (mapujSciezke). Dzięki temu łuk podąża za
 * dłońmi płynnie co klatkę, a regenerujemy go tylko co 60-90 ms - to
 * "trzask", nie migotanie co klatkę.
 *
 * Jedna dłoń w kadrze: łuk wyładowuje się z niej W GÓRĘ. Żadnej dłoni:
 * końce stoją tam, gdzie były (Kotwica) - nigdy brak efektu (GEMINI.md §2).
 */
import { generujPiorun, rysujSciezke } from './piorun.js';
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { dlonieKlatki, barkiKlatki, Kotwica } from './sledzenie.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    LICZBA_LUKOW: 3,              // równoległe ścieżki; pierwsza najjaśniejsza
    ODSTEP_MIN: 0.06, ODSTEP_MAX: 0.09,   // s między regeneracjami (trzask)
    ITERACJE: 6,
    CHROPOWATOSC_BLISKO: 0.16, CHROPOWATOSC_DALEKO: 0.30,
    DYSTANS_DALEKO_MNOZNIK: 4,    // skala * to = dłonie "maksymalnie rozsunięte"
    WYSOKOSC_JEDNEJ_DLONI: 2.2,   // skala * to - wyładowanie w górę z jednej dłoni
    ROZBLYSK_MNOZNIK: 1.1,        // skala * to = rozmiar spark_* przy dłoni
    NAROST: 0.15, WYGASZENIE: 0.8,   // s
    BARWA: [150, 200, 255]        // błękit-biel Peruna
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/** Ścieżka z układu (0,0)->(1,0) na odcinek a->b; y znormalizowane idzie prostopadle. */
export function mapujSciezke(punkty, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return punkty.map(p => ({ x: a.x + p.x * dx - p.y * dy, y: a.y + p.x * dy + p.y * dx }));
}

/** @returns {{a:{x,y}, b:{x,y}}|null} */
export function koncowkiLuku(dlonie, skala) {
    if (!Array.isArray(dlonie) || !dlonie.length) return null;
    if (dlonie.length >= 2) return { a: dlonie[0], b: dlonie[1] };
    const d = dlonie[0];
    return { a: d, b: { x: d.x, y: d.y - skala * NASTAWY.WYSOKOSC_JEDNEJ_DLONI } };
}

export class LukPeruna {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._luki = [];
        this._doNastepnej = 0;
        this._jasnosc = 1;
        this._iskry = [0, 0];
        this._a = new Kotwica(22);   // ciaśniej niż tułów - łuk ma siedzieć W dłoni
        this._b = new Kotwica(22);
        this._skala = new Kotwica(6);
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._luki = [];
        this._doNastepnej = 0;
        this._a.reset(); this._b.reset(); this._skala.reset();
    }

    _regeneruj(rozpietosc) {
        const N = NASTAWY;
        const ch = N.CHROPOWATOSC_BLISKO + (N.CHROPOWATOSC_DALEKO - N.CHROPOWATOSC_BLISKO) * rozpietosc;
        this._luki = Array.from({ length: N.LICZBA_LUKOW }, () =>
            generujPiorun({ x: 0, y: 0 }, { x: 1, y: 0 },
                          { iteracje: N.ITERACJE, chropowatosc: ch * (0.85 + Math.random() * 0.3), liczbaGalezi: 1 }));
        this._jasnosc = 0.7 + Math.random() * 0.3;
        this._iskry = [Math.floor(Math.random() * MANIFEST.wyladowanie.length),
                       Math.floor(Math.random() * MANIFEST.wyladowanie.length)];
        this._katIskry = Math.random() * Math.PI * 2;
        this._doNastepnej = N.ODSTEP_MIN + Math.random() * (N.ODSTEP_MAX - N.ODSTEP_MIN);
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const barki = barkiKlatki(k?.frame, W, H);
        const sk = this._skala.prowadz(barki ? { s: barki.skala } : null, krok)?.s ?? W * 0.12;
        const konce = koncowkiLuku(dlonieKlatki(k?.frame, W, H), sk);
        const a = this._a.prowadz(konce?.a ?? null, krok) ?? { x: W * 0.4, y: H * 0.45 };
        const b = this._b.prowadz(konce?.b ?? null, krok) ?? { x: W * 0.6, y: H * 0.45 };
        const rozpietosc = clamp01(Math.hypot(b.x - a.x, b.y - a.y) / (sk * NASTAWY.DYSTANS_DALEKO_MNOZNIK));

        this._doNastepnej -= krok;
        if (this._doNastepnej <= 0 || !this._luki.length) this._regeneruj(rozpietosc);
        if (!ctx) return;

        const obw = obwiednia(this._t) * this._sila;
        if (obw < 0.01) return;
        const grubosc = 1.2 - 0.7 * rozpietosc;
        ctx.save();
        this._luki.forEach((luk, i) => {
            const waga = i === 0 ? 1 : 0.55;
            rysujSciezke(ctx, mapujSciezke(luk.glowna, a, b), NASTAWY.BARWA,
                         obw * this._jasnosc * waga, obw * waga, grubosc * (i === 0 ? 1 : 0.6));
            for (const galaz of luk.galezie) {
                rysujSciezke(ctx, mapujSciezke(galaz, a, b), NASTAWY.BARWA,
                             obw * this._jasnosc * waga * 0.5, obw * waga * 0.5, grubosc * 0.45);
            }
        });
        // Rozbłysk pęknięcia elektrycznego (spark_*) w KAŻDEJ końcówce.
        ctx.globalCompositeOperation = 'lighter';
        [a, b].forEach((p, i) => {
            const img = obraz(MANIFEST.wyladowanie[this._iskry[i]]);
            if (!img) return;
            const d = sk * NASTAWY.ROZBLYSK_MNOZNIK;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(this._katIskry + i * Math.PI);
            ctx.globalAlpha = clamp01(obw * this._jasnosc);
            ctx.drawImage(wypalTintowany(img, NASTAWY.BARWA, 256), -d / 2, -d / 2, d, d);
            ctx.restore();
        });
        ctx.restore();
    }
}
```

- [ ] **Step 5:** `node tools/test-luk-peruna.mjs` → PASS.
- [ ] **Step 6: Wpięcie W1–W8:**
  - W1:

```js
    // ŁUK PERUNA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // woda przewodzi piorun - łuk elektryczny między dłońmi. Obie pieczęcie
    // należą do najpewniej rozpoznawanych. Łańcuch: Kołowrót kończy się na
    // mokosz, więc dołożony po nim perun odpala Łuk.
    { id: 'lukPeruna', nazwa: 'Łuk Peruna',
      sekwencja: ['mokosz', 'perun'], uzbraja: 'lukPeruna' }
```
  - W2: `lukPeruna: [150, 200, 255],   // błękit-biel Peruna`
  - W3: `lukPeruna: { barwa: '210, 100%, 75%', ksztalt: 'blyskIFala', czas: 1.3 },`
  - W4–W6: `LukPeruna`, `lukPeruna.js`, `lukPeruna`, `Łuk Peruna`, `['mokosz', 'perun']`.
  - W7: `'lukPeruna'` do `ZNANE_UZBRAJA`; w `test-kombosy.mjs`:

```js
console.log('\nŁUK PERUNA (mokosz -> perun) i łańcuch z Kołowrotem:');
const k22 = new KomboSilnik();
k22.dodaj('perun', 0); k22.dodaj('weles', 500);
spr('perun->weles->mokosz odpala Kołowrót', k22.dodaj('mokosz', 1000)?.id === 'kolowrot');
spr('...a dołożony perun - Łuk Peruna', k22.dodaj('perun', 1500)?.id === 'lukPeruna');
```
  - W8: `| \`js/lukPeruna.js\` | Łuk Peruna (mokosz→perun) - łuk elektryczny między dłońmi (ścieżki piorun.js w układzie znormalizowanym, regenerowane co 60-90 ms), spark_* w końcówkach; jedna dłoń = wyładowanie w górę |`
- [ ] **Step 7: W9**, commit `"Combo Luk Peruna (mokosz->perun): luk elektryczny miedzy dlonmi"`.

## Task 7: Wodna Kula (mokosz → weles)

**Files:** Create `js/wodnaKula.js`, `tools/test-wodna-kula.mjs`; Modify W1–W8, spec (`ekran.soczewka` → soczewka własna w module).

**Interfaces:** Consumes `simplex3(x,y,z)` z `szum.js`, `dlonieKlatki`, `barkiKlatki`, `Kotwica`. Produces `class WodnaKula`, `CZAS_TRWANIA`, `NASTAWY`, `obwiednia(t) -> {kula, rozdecie}`, `celKuli(dlonie, skala)`, `promienBrzegu(R, kat, t)`.

- [ ] **Step 1: Test (failing)** `tools/test-wodna-kula.mjs`:

```js
/**
 * Wodna Kula - cel kuli z dłoni, brzeg, krople, pęknięcie; bez document.
 *   node tools/test-wodna-kula.mjs
 */
import { WodnaKula, obwiednia, celKuli, promienBrzegu, CZAS_TRWANIA, NASTAWY } from '../js/wodnaKula.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('CEL KULI:');
const c2 = celKuli([{ x: 800, y: 500 }, { x: 1200, y: 500 }], 200);
spr('dwie dłonie -> środek między nimi', c2.x === 1000 && c2.y === 500);
spr('promień z rozpiętości, w granicach skali', c2.r >= 200 * NASTAWY.PROMIEN_MIN && c2.r <= 200 * NASTAWY.PROMIEN_MAX);
spr('dłonie złączone -> promień nie spada poniżej minimum', celKuli([{ x: 1000, y: 500 }, { x: 1001, y: 500 }], 200).r === 200 * NASTAWY.PROMIEN_MIN);
spr('jedna dłoń -> kula NAD dłonią', celKuli([{ x: 1000, y: 500 }], 200).y < 500);
spr('brak dłoni -> null', celKuli([], 200) === null);

console.log('\nBRZEG I OBWIEDNIA:');
const r = promienBrzegu(100, 1, 0.5);
spr('brzeg faluje wokół R, ale blisko', Math.abs(r - 100) <= 100 * NASTAWY.FALOWANIE + 1e-9);
spr('w środku kula pełna, bez rozdęcia', obwiednia(CZAS_TRWANIA / 2).kula > 0.99 && obwiednia(CZAS_TRWANIA / 2).rozdecie === 1);
spr('przy pęknięciu kula się rozdyma', obwiednia(CZAS_TRWANIA - 0.05).rozdecie > 1.1);
spr('NaN -> kula 0', obwiednia(NaN).kula === 0);

console.log('\nCYKL ŻYCIA:');
const kula = new WodnaKula();
kula.zapal(1); kula.zapal(1);
przepusc(kula, klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] }), 2);
spr('krople odrywają się od brzegu w trakcie', kula._krople.length > 0);
const sr = { ...kula._srodek.stan };
przepusc(kula, klatka({ dlonie: [] }), 0.3);
spr('dłonie znikają -> kula stoi', Math.abs(kula._srodek.stan.x - sr.x) < 1e-9);
let rzucil = false;
try { kula.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez document) nie rzuca', rzucil === false);
// t ≈ 2.3 s; dojedź do początku fazy pęknięcia (emisja stoi, chmura jeszcze nie wyszła)...
przepusc(kula, klatka(), CZAS_TRWANIA - 2.3 - NASTAWY.PEKNIECIE);
const przedPeknieciem = kula._krople.length;
// ...i za połowę pęknięcia, gdzie wychodzi chmura KROPLE_PEKNIECIA kropel.
przepusc(kula, klatka(), NASTAWY.PEKNIECIE / 2 + 0.05);
spr('pęknięcie wyrzuca chmurę kropel', kula._krople.length > przedPeknieciem);
przepusc(kula, klatka(), 3);
spr('gaśnie, gdy skończy się czas i wszystkie krople', kula.aktywny === false && kula._krople.length === 0);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2:** `node tools/test-wodna-kula.mjs` → FAIL.
- [ ] **Step 3: Implementacja** `js/wodnaKula.js`:

```js
/**
 * Wodna Kula - nagroda za combo mokosz -> weles (proste combo 2026-10-02).
 * Mokosz to "Mać Ziemia Wilgotna" - woda wydobyta z ziemi zbiera się
 * w kulę między dłońmi gracza. Kula faluje (brzeg = zamknięta KRESKA
 * z promieniem modulowanym szumem - patrz pamięć "efekt ciągły = kreska,
 * nie sprite"), załamuje obraz pod sobą (soczewka) i gubi krople-kreski;
 * na koniec pęka w chmurę kropel.
 *
 * SOCZEWKA WŁASNA, nie w ekran.js (zmiana względem spec): technika ma być
 * wyjmowalna jednym commitem - soczewka w ekran.js zostałaby po odrzuceniu
 * Kuli jako martwy kod. Mechanizm ten sam co ekran.js _falaPowietrza: kopia
 * sceny pod kulą rysowana z powrotem przeskalowana wokół środka, przycięta
 * do koła.
 */
import { simplex3 } from './szum.js';
import { dlonieKlatki, barkiKlatki, Kotwica } from './sledzenie.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    NAROST: 0.4,              // s
    PEKNIECIE: 0.6,           // s - ostatnie tyle sekund: kula się rozdyma i pęka
    PROMIEN_MIN: 0.45, PROMIEN_MAX: 1.4,   // skala * to
    WSP_ROZPIETOSCI: 0.8,     // promień = połowa rozpiętości dłoni * to
    UNIESIENIE_JEDNEJ: 0.6,   // skala * to - kula nad pojedynczą dłonią
    PROMIEN_JEDNEJ: 0.7,      // skala * to
    FALOWANIE: 0.07,          // amplituda falowania brzegu (ułamek R)
    PUNKTOW_BRZEGU: 64,
    SOCZEWKA: 0.14,           // powiększenie obrazu pod kulą
    KROPLE_NA_S: 7,
    KROPLE_PEKNIECIA: 26,
    PREDKOSC_KROPLI: 1.6,     // skala * to = px/s
    GRAWITACJA_KROPLI: 4,     // skala * to = px/s^2
    ZYCIE_KROPLI: 0.7,        // s
    BARWA: [90, 200, 255],
    BARWA_RDZENIA: [220, 245, 255]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** @returns {{kula:number, rozdecie:number}} */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return { kula: 0, rozdecie: 1 };
    const doKonca = CZAS_TRWANIA - t;
    const pek = doKonca < NASTAWY.PEKNIECIE ? 1 - doKonca / NASTAWY.PEKNIECIE : 0;
    return { kula: Math.min(1, t / NASTAWY.NAROST) * (1 - pek), rozdecie: 1 + 0.2 * pek };
}

/** @returns {{x,y,r}|null} */
export function celKuli(dlonie, skala) {
    const N = NASTAWY;
    if (!Array.isArray(dlonie) || !dlonie.length) return null;
    if (dlonie.length >= 2) {
        const [a, b] = dlonie;
        const r = Math.hypot(b.x - a.x, b.y - a.y) / 2 * N.WSP_ROZPIETOSCI;
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                 r: Math.max(skala * N.PROMIEN_MIN, Math.min(skala * N.PROMIEN_MAX, r)) };
    }
    return { x: dlonie[0].x, y: dlonie[0].y - skala * N.UNIESIENIE_JEDNEJ, r: skala * N.PROMIEN_JEDNEJ };
}

export function promienBrzegu(R, kat, t) {
    return R * (1 + NASTAWY.FALOWANIE * simplex3(Math.cos(kat) * 1.3, Math.sin(kat) * 1.3, t * 0.9));
}

export class WodnaKula {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._krople = [];
        this._akumulator = 0;
        this._peklo = false;
        this._srodek = new Kotwica(16);
        this._skala = new Kotwica(6);
        this._plotno = null;
        this._plotnoCtx = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._krople = [];
        this._akumulator = 0;
        this._peklo = false;
        this._srodek.reset(); this._skala.reset();
    }

    _kropla(c, R, sk, kat, styczna) {
        const v = sk * NASTAWY.PREDKOSC_KROPLI * (0.7 + Math.random() * 0.6);
        const rx = Math.cos(kat), ry = Math.sin(kat);
        const wt = styczna ? 0.6 : 0, wr = styczna ? 0.4 : 1;
        this._krople.push({
            x: c.x + rx * R, y: c.y + ry * R,
            vx: (-ry * wt + rx * wr) * v, vy: (rx * wt + ry * wr) * v,
            wiek: 0, zycie: NASTAWY.ZYCIE_KROPLI * (0.7 + Math.random() * 0.6)
        });
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const barki = barkiKlatki(k?.frame, W, H);
        const sk = this._skala.prowadz(barki ? { s: barki.skala } : null, krok)?.s ?? W * 0.12;
        const c = this._srodek.prowadz(celKuli(dlonieKlatki(k?.frame, W, H), sk), krok)
            ?? { x: W * 0.5, y: H * 0.45, r: sk * N.PROMIEN_JEDNEJ };
        const { kula, rozdecie } = obwiednia(this._t);
        const R = c.r * rozdecie;

        // Krople: emisja w trakcie, chmura przy pęknięciu, fizyka zawsze.
        if (this._t < CZAS_TRWANIA - N.PEKNIECIE) {
            this._akumulator += krok * N.KROPLE_NA_S;
            while (this._akumulator >= 1) { this._akumulator -= 1; this._kropla(c, R, sk, Math.random() * Math.PI * 2, true); }
        } else if (!this._peklo && this._t >= CZAS_TRWANIA - N.PEKNIECIE / 2) {
            this._peklo = true;
            for (let i = 0; i < N.KROPLE_PEKNIECIA; i++) this._kropla(c, R, sk, (i / N.KROPLE_PEKNIECIA) * Math.PI * 2, false);
        }
        const g = sk * N.GRAWITACJA_KROPLI;
        this._krople = this._krople.filter(d => {
            d.wiek += krok;
            d.vy += g * krok;
            d.x += d.vx * krok; d.y += d.vy * krok;
            return d.wiek < d.zycie && Number.isFinite(d.x) && Number.isFinite(d.y);
        });
        if (this._t >= CZAS_TRWANIA && !this._krople.length) { this._trwa = false; return; }
        if (!ctx) return;

        if (kula * this._sila > 0.01) {
            this._soczewka(ctx, c, R, kula);
            this._brzeg(ctx, c, R, kula);
        }
        this._rysujKrople(ctx, sk);
    }

    _soczewka(ctx, c, R, kula) {
        if (typeof document === 'undefined' || !ctx.canvas) return;
        const x0 = Math.max(0, Math.floor(c.x - R)), y0 = Math.max(0, Math.floor(c.y - R));
        const x1 = Math.min(ctx.canvas.width, Math.ceil(c.x + R)), y1 = Math.min(ctx.canvas.height, Math.ceil(c.y + R));
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 2 || bh < 2) return;
        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._plotnoCtx = this._plotno.getContext('2d');
        }
        if (this._plotno.width < bw || this._plotno.height < bh) {
            this._plotno.width = Math.max(this._plotno.width, bw);
            this._plotno.height = Math.max(this._plotno.height, bh);
        }
        this._plotnoCtx.clearRect(0, 0, bw, bh);
        this._plotnoCtx.drawImage(ctx.canvas, x0, y0, bw, bh, 0, 0, bw, bh);
        const kk = 1 + NASTAWY.SOCZEWKA * kula * this._sila;
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this._plotno, 0, 0, bw, bh, c.x + (x0 - c.x) * kk, c.y + (y0 - c.y) * kk, bw * kk, bh * kk);
        ctx.restore();
    }

    _brzeg(ctx, c, R, kula) {
        const N = NASTAWY;
        const a = kula * this._sila;
        const [r, g, b] = N.BARWA, [rr, gr, br] = N.BARWA_RDZENIA;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr0 = ctx.createRadialGradient(c.x, c.y, R * 0.1, c.x, c.y, R);
        gr0.addColorStop(0, `rgba(${r},${g},${b},0)`);
        gr0.addColorStop(1, `rgba(${r},${g},${b},${(0.28 * a).toFixed(3)})`);
        ctx.fillStyle = gr0;
        ctx.beginPath();
        for (let i = 0; i <= N.PUNKTOW_BRZEGU; i++) {
            const kat = (i / N.PUNKTOW_BRZEGU) * Math.PI * 2;
            const rb = promienBrzegu(R, kat, this._t);
            const x = c.x + Math.cos(kat) * rb, y = c.y + Math.sin(kat) * rb;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(${r},${g},${b},${(0.35 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, R * 0.12);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${rr},${gr},${br},${(0.9 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, R * 0.03);
        ctx.stroke();
        ctx.restore();
    }

    _rysujKrople(ctx, sk) {
        if (!this._krople.length) return;
        const [r, g, b] = NASTAWY.BARWA_RDZENIA;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.5, sk * 0.035);
        for (const d of this._krople) {
            const alfa = clamp01(1 - d.wiek / d.zycie) * this._sila;
            ctx.strokeStyle = `rgba(${r},${g},${b},${alfa.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.vx * 0.04, d.y - d.vy * 0.04);
            ctx.stroke();
        }
        ctx.restore();
    }
}
```

- [ ] **Step 4:** `node tools/test-wodna-kula.mjs` → PASS.
- [ ] **Step 5: Spec** — w `docs/superpowers/specs/2026-10-02-proste-kombosy-design.md` zamień punkt o `ekran.js`/`soczewka(srodek, promien)` na: „Wodna Kula ma soczewkę WŁASNĄ (ten sam mechanizm co `ekran.js _falaPowietrza`) — żeby odrzucenie Kuli nie zostawiało martwego kodu w `ekran.js`", i w opisie efektu „(`ekran.soczewka`)" → „(soczewka w module)".
- [ ] **Step 6: Wpięcie W1–W8:**
  - W1:

```js
    // WODNA KULA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // Mokosz - "Mać Ziemia Wilgotna" - woda wydobyta z ziemi zbiera się
    // w kulę między dłońmi. Mokosz zaczyna Łuk i Kulę: druga pieczęć
    // rozstrzyga, jak rozgałęzienie w bijatyce. Łańcuch: mokosz->weles×3
    // daje Kulę, potem Kamienną Tarczę.
    { id: 'wodnaKula', nazwa: 'Wodna Kula',
      sekwencja: ['mokosz', 'weles'], uzbraja: 'wodnaKula' }
```
  - W2: `wodnaKula: [90, 200, 255],   // turkusowy błękit Mokoszy`
  - W3: `wodnaKula: { barwa: '195, 100%, 60%', ksztalt: 'blyskIFala', czas: 1.3 },`
  - W4–W6: `WodnaKula`, `wodnaKula.js`, `wodnaKula`, `Wodna Kula`, `['mokosz', 'weles']`.
  - W7: `'wodnaKula'` do `ZNANE_UZBRAJA`; w `test-kombosy.mjs`:

```js
console.log('\nWODNA KULA (mokosz -> weles) - rozgałęzienie po mokosz:');
const k23 = new KomboSilnik();
k23.dodaj('mokosz', 0);
spr('mokosz -> weles odpala Wodną Kulę', k23.dodaj('weles', 500)?.id === 'wodnaKula');
const k24 = new KomboSilnik();
k24.dodaj('mokosz', 0);
spr('mokosz -> perun odpala Łuk (ta sama pierwsza pieczęć, inna technika)', k24.dodaj('perun', 500)?.id === 'lukPeruna');
```
  - W8: `| \`js/wodnaKula.js\` | Wodna Kula (mokosz→weles) - kula wody między dłońmi: soczewka własna (kopia sceny, clip do koła), falujący brzeg-kreska (simplex3), krople-kreski, pęknięcie na końcu |`
- [ ] **Step 7: W9**, commit `"Combo Wodna Kula (mokosz->weles): kula wody miedzy dlonmi"` (spec w tym samym commicie).

## Task 8: Mgła Mokoszy (stribog → mokosz)

**Files:** Create `js/mglaMokoszy.js`, `tools/test-mgla-mokoszy.mjs`; Modify W1–W8.

**Interfaces:** Consumes `barkiKlatki`, `Kotwica`, `WarstwaZaSylwetka`, `MANIFEST.mgla` (istniejące smoke_*). Produces `class MglaMokoszy`, `CZAS_TRWANIA`, `NASTAWY`, `obwiednia(t)`, `predkoscKlebu(x, cx, v0, skala)`.

- [ ] **Step 1: Test (failing)** `tools/test-mgla-mokoszy.mjs`:

```js
/**
 * Mgła Mokoszy - przetaczanie się przez kadr, zwalnianie przy sylwetce; bez document.
 *   node tools/test-mgla-mokoszy.mjs
 */
import { MglaMokoszy, obwiednia, predkoscKlebu, CZAS_TRWANIA, NASTAWY } from '../js/mglaMokoszy.js';
import { klatka, kontekst, przepusc, atrapaCtx, W } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('PRĘDKOŚĆ KŁĘBU:');
const daleko = predkoscKlebu(0, 1000, 500, 200), blisko = predkoscKlebu(1000, 1000, 500, 200);
spr('daleko od sylwetki - pełna prędkość', Math.abs(daleko - 500) < 1e-9);
spr('przy sylwetce zwalnia (gęstnieje), ale nie staje', blisko < daleko && blisko >= 500 * NASTAWY.ZWOLNIENIE - 1e-9);
spr('kierunek zachowany (ujemna v0)', predkoscKlebu(1000, 1000, -500, 200) < 0);
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nCYKL ŻYCIA:');
const m = new MglaMokoszy();
m.zapal(1); m.zapal(1);
przepusc(m, klatka(), 1 / 60);
spr(`kłęby rodzą się przy pierwszej klatce (${NASTAWY.LICZBA}), restart nie podwaja`, m._kleby.length === NASTAWY.LICZBA);
const startX = m._kleby.map(k => k.x);
spr('wszystkie startują POZA kadrem z jednej strony', startX.every(x => x < 0) || startX.every(x => x > W));
przepusc(m, klatka(), 3);
spr('po kilku sekundach mgła jest w kadrze', m._kleby.some(k => k.x > 0 && k.x < W));
przepusc(m, klatka({ barki: null }), 0.2);
spr('poza znika - pozycje skończone', m._kleby.every(k => Number.isFinite(k.x) && Number.isFinite(k.y)));
let rzucil = false;
try { m.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (atrapa, bez assetów i document) nie rzuca', rzucil === false);
przepusc(m, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', m.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2:** `node tools/test-mgla-mokoszy.mjs` → FAIL.
- [ ] **Step 3: Implementacja** `js/mglaMokoszy.js`:

```js
/**
 * Mgła Mokoszy - nagroda za combo stribog -> mokosz (proste combo
 * 2026-10-02). Wiatr (Stribog) niesie wilgoć (Mokosz): pas teksturowanej
 * mgły (smoke_*, te same co Kołowrót) wjeżdża z jednej strony kadru na
 * wysokości tułowia i przetacza się na drugą, gęstniejąc (zwalniając)
 * wokół gracza. Mgła rysuje się ZA sylwetką (js/warstwaZaSylwetka.js) -
 * ciało "wynurza się" z niej.
 *
 * Kłęby rodzą się przy PIERWSZEJ klatce po zapal(), nie w zapal() -
 * dopiero updateAndDraw zna szerokość płótna i położenie barków, a API
 * zapal(sila) jest wspólne dla wszystkich prostych combo.
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 7.0;   // s

export const NASTAWY = {
    LICZBA: 28,
    OPOZNIENIE_MAX: 1.6,       // s - kłęby wjeżdżają falą, nie ścianą
    CZAS_PRZEJAZDU: 3.2,       // s na przejazd przez całe W bez zwalniania
    ZWOLNIENIE: 0.45,          // minimalny mnożnik prędkości przy sylwetce
    ZASIEG_ZWOLNIENIA: 2.2,    // skala * to - od tej odległości od ciała mgła zwalnia
    PAS_OD: -0.6, PAS_DO: 2.0, // skala * to względem barków - pas od szyi do bioder
    ROZMIAR_OD: 2.0, ROZMIAR_DO: 3.6,   // skala * to
    ALFA: 0.38,
    NAROST: 0.3, WYGASZENIE: 1.6,       // s
    BARWA: [200, 228, 235]     // chłodna perła z nutą turkusu
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/** Prędkość kłębu w x - zwalnia przy sylwetce (cx), nigdy nie staje. */
export function predkoscKlebu(x, cx, v0, skala) {
    const N = NASTAWY;
    const blisko = Math.min(1, Math.abs(x - cx) / (skala * N.ZASIEG_ZWOLNIENIA));
    return v0 * (N.ZWOLNIENIE + (1 - N.ZWOLNIENIE) * blisko);
}

export class MglaMokoszy {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._kleby = [];
        this._doNarodzin = false;
        this._kotwica = new Kotwica(8);
        this._warstwa = new WarstwaZaSylwetka();
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kleby = [];
        this._doNarodzin = true;
        this._kotwica.reset();
    }

    _narodziny(W, zaczep) {
        const N = NASTAWY;
        const kierunek = Math.random() < 0.5 ? -1 : 1;   // jedna strona wjazdu dla całej mgły
        const sk = zaczep.skala;
        this._kleby = Array.from({ length: N.LICZBA }, () => {
            const rozmiar = sk * (N.ROZMIAR_OD + Math.random() * (N.ROZMIAR_DO - N.ROZMIAR_OD));
            return {
                x: kierunek > 0 ? -rozmiar / 2 - Math.random() * sk : W + rozmiar / 2 + Math.random() * sk,
                y: zaczep.y + sk * (N.PAS_OD + Math.random() * (N.PAS_DO - N.PAS_OD)),
                v0: kierunek * ((W + 2 * rozmiar) / N.CZAS_PRZEJAZDU) * (0.85 + Math.random() * 0.3),
                wiek: -Math.random() * N.OPOZNIENIE_MAX,
                rozmiar,
                obrot: Math.random() * Math.PI * 2,
                vObrot: (Math.random() * 2 - 1) * 0.3,
                wariant: Math.floor(Math.random() * MANIFEST.mgla.length)
            };
        });
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        if (this._doNarodzin) { this._narodziny(W, zaczep); this._doNarodzin = false; }
        for (const c of this._kleby) {
            c.wiek += krok;
            if (c.wiek < 0) continue;
            c.x += predkoscKlebu(c.x, zaczep.x, c.v0, zaczep.skala) * krok;
            c.obrot += c.vObrot * krok;
        }
        if (!ctx) return;

        const alfa = obwiednia(this._t) * this._sila * NASTAWY.ALFA;
        if (alfa < 0.005) return;
        const warstwa = this._warstwa.zacznij(W, H);
        if (!warstwa) return;
        for (const c of this._kleby) {
            if (c.wiek < 0) continue;
            const img = obraz(MANIFEST.mgla[c.wariant]);
            if (!img) continue;
            warstwa.save();
            warstwa.translate(c.x, c.y);
            warstwa.rotate(c.obrot);
            warstwa.globalAlpha = clamp01(alfa * Math.min(1, c.wiek / 0.5));
            warstwa.drawImage(wypalTintowany(img, NASTAWY.BARWA, 256), -c.rozmiar / 2, -c.rozmiar / 2, c.rozmiar, c.rozmiar);
            warstwa.restore();
        }
        this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
    }
}
```

- [ ] **Step 4:** `node tools/test-mgla-mokoszy.mjs` → PASS.
- [ ] **Step 5: Wpięcie W1–W8:**
  - W1:

```js
    // MGŁA MOKOSZY (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // wiatr (Stribog) niesie wilgoć (Mokosz) - mgła przetacza się przez
    // kadr, gracz wynurza się z niej. Para stribog->mokosz nie koliduje
    // z Tęczą (ta kończy się mokosz->stribog, odwrotnie).
    { id: 'mglaMokoszy', nazwa: 'Mgła Mokoszy',
      sekwencja: ['stribog', 'mokosz'], uzbraja: 'mglaMokoszy' }
```
  - W2: `mglaMokoszy: [200, 228, 235],   // chłodna perła mgły`
  - W3: `mglaMokoszy: { barwa: '190, 30%, 85%', ksztalt: 'blyskIFala', czas: 1.3 },`
  - W4–W6: `MglaMokoszy`, `mglaMokoszy.js`, `mglaMokoszy`, `Mgła Mokoszy`, `['stribog', 'mokosz']`.
  - W7: `'mglaMokoszy'` do `ZNANE_UZBRAJA`; w `test-kombosy.mjs`:

```js
console.log('\nMGŁA MOKOSZY (stribog -> mokosz):');
const k25 = new KomboSilnik();
k25.dodaj('stribog', 0);
spr('stribog -> mokosz odpala Mgłę Mokoszy', k25.dodaj('mokosz', 500)?.id === 'mglaMokoszy');
const k26 = new KomboSilnik();
k26.dodaj('swarog', 0); k26.dodaj('mokosz', 500);
spr('Tęcza (swarog->mokosz->stribog) nadal odpala - odwrotna para nie koliduje', k26.dodaj('stribog', 1000)?.id === 'tecza');
```
  - W8: `| \`js/mglaMokoszy.js\` | Mgła Mokoszy (stribog→mokosz) - pas mgły (smoke_*) przetacza się przez kadr na wysokości tułowia, zwalnia przy graczu, rysowana ZA sylwetką |`
- [ ] **Step 6: W9**, commit `"Combo Mgla Mokoszy (stribog->mokosz): mgla przetaczajaca sie przez kadr"`.

## Task 9: Domknięcie

- [ ] `sh tools/test-wszystko.sh` → wszystkie ✓.
- [ ] Scena: scenariusz każdej z pięciu technik + `?scenariusz=` zamrożony zrzut przez Chrome MCP (jeśli podłączony); przy braku Chrome MCP — zaznacz w raporcie, że wizualnie niesprawdzone.
- [ ] Zapisz ten plan do `docs/superpowers/plans/2026-10-02-proste-kombosy.md` (commit razem z pierwszym zadaniem, jeśli jeszcze go nie ma).
- [ ] Pamięć: zaktualizuj `kula-mocy-proste-kombosy-2026-10-02.md` (stan: wdrożone, czeka na test z kamerą; jak odrzucić technikę).
- [ ] Raport dla właściciela: lista sekwencji do przetestowania na kamerze + jak wyłączyć każdą (linijka w `KOMBOSY` albo `git revert <sha>` z listą sha).

## Weryfikacja end-to-end

1. `sh tools/test-wszystko.sh` — zielone po każdym zadaniu.
2. `tools/scena.html` — każda technika z przycisku: widoczna, śledzi syntetyczną postać (suwak kołysania), gaśnie; Tarcza/Kurzawa/Mgła z tyłu chowają się za maską syntetycznej sylwetki.
3. Gra z kamerą (właściciel): ułożenie każdej sekwencji → decyzja zostaje/odrzuć.
