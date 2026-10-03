# Reakcje technik (Przewodzenie, Burza w mgle) — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dwie reakcje między technikami, z efektem i punktami: Przewodzenie (Łuk Peruna + Kręgi Mokoszy) i Burza w mgle (Łuk Peruna lub piorun Gromu w Ziemię + Mgła Mokoszy).

**Architecture:** Nowy `js/reakcjeTechnik.js` co klatkę sprawdza warunki i woła małe publiczne metody technik (`wyladowanieDo`, `naelektryzuj`, `rozblysk`); techniki rysują efekt u siebie i nie znają się nawzajem. `klatka()` zwraca jednostki, które `main.js` przekazuje do `punkty.reakcja(...)` z literalnymi id (strażnik w `tools/test-punkty.mjs`).

**Tech Stack:** ES modules, Canvas 2D, testy `node tools/test-*.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-03-reakcje-technik-design.md`

**Tryb wykonania:** Native (rekomendowany) — 5 krótkich, sekwencyjnych zadań; zadanie 5 konsumuje API z 1–4.

## Global Constraints

- GEMINI.md §2: złe dane (`null`, NaN, technika nieaktywna) → nic, bez wyjątku; metody efektów zwracają `false`.
- Techniki nie importują się nawzajem; łączy je wyłącznie `js/reakcjeTechnik.js`.
- Guard `if (!ctx) return;` dopiero po zegarach/stanie (testy w Node wołają `updateAndDraw(null, k, dt)`).
- Łuk: linie ≤ 2 px (istniejący test stylistyki). Wyładowania: niebieski `[90, 160, 255]` + rdzeń `[200, 225, 255]`.
- Punkty: `przewodzenie { punkty: 15, pelneDo: 10, przerwaMs: 1500 }`, `burzaWMgle { punkty: 10, pelneDo: 12, przerwaMs: 1500 }`.
- Testy całości: `for t in tools/test-*.mjs` z pominięciem `test-rozdzielnosc.mjs` (pada na bazie — znane).
- Commity kończą się `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Duże `dt` (powrót na kartę)** → najwyżej 1 jednostka na reakcję na klatkę, bez lawiny punktów (test w Task 5).
2. **Źródło błysku `null`** (piorun aktywny, ale bez ścieżki) → błysk nie jest liczony ani wołany (test w Task 5).
3. **Technika kończy się w trakcie reakcji** (Łuk gaśnie z żywą odnogą) → nic nie rzuca, odnogi nie przeżywają `zapal()` (test w Task 2).
4. **Kręgi trwają, ale bez żyjącego kręgu** → `geometria()` = null, brak wyładowania (test w Task 3 i 5).
5. **Restart rundy w Kręgu** → nowa `ReakcjeTechnik` bezczynna (Task 5, `test-swieze-moduly`).

---

## Task 1: `piorun.punktUderzenia`

**Files:** Modify `js/piorun.js` (klasa `Piorun`, pod `get aktywny()`); Test `tools/test-piorun.mjs`.

**Interfaces:** Produces `piorun.punktUderzenia -> {x,y}|null` (koniec głównej ścieżki bieżącego błysku; null gdy nie trwa).

- [ ] **Step 1: Test (RED)** — w `tools/test-piorun.mjs` przed końcowym `process.exit` dopisz:

```js
console.log('\nPUNKT UDERZENIA (dla reakcji Burza w mgle):');
{
    const p = new Piorun();
    spr('przed uderzeniem: null', p.punktUderzenia === null);
    p.uderz({ x: 700, y: 900 }, [190, 100, 255], 1);
    const pu = p.punktUderzenia;
    spr('w trakcie: koniec głównej ścieżki = punkt uderzenia', pu && pu.x === 700 && pu.y === 900);
    for (let i = 0; i < Math.ceil((T_CALKOWITY + 0.1) * 60); i++) p.updateAndDraw(null, 1 / 60);
    spr('po zgaśnięciu: null', p.punktUderzenia === null);
}
```
(`Piorun` i `T_CALKOWITY` są już importowane w tym pliku — sprawdź import na górze; dopisz brakujące.)

- [ ] **Step 2:** `node tools/test-piorun.mjs` → FAIL (`punktUderzenia` undefined).
- [ ] **Step 3:** w `js/piorun.js` pod `get aktywny() { return this._trwa; }`:

```js
    /**
     * Punkt uderzenia bieżącego błysku (koniec głównej ścieżki) - dla reakcji
     * Burza w mgle (js/reakcjeTechnik.js). null, gdy piorun nie trwa.
     */
    get punktUderzenia() {
        if (!this._trwa || !this._blyski.length) return null;
        const glowna = this._blyski[0].glowna;
        const p = glowna?.[glowna.length - 1];
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
    }
```
- [ ] **Step 4:** `node tools/test-piorun.mjs` → PASS.
- [ ] **Step 5:** commit `"Piorun: getter punktUderzenia (pod reakcje technik)"`.

## Task 2: Łuk Peruna — `srodek()` i `wyladowanieDo(punkt)`

**Files:** Modify `js/lukPeruna.js`; Test `tools/test-luk-peruna.mjs`.

**Interfaces:** Produces `luk.srodek() -> {x,y}|null`, `luk.wyladowanieDo(punkt) -> boolean`, pole testowe `luk._odnogi`.

- [ ] **Step 1: Test (RED)** — przed sekcją `STYLISTYKA` w `tools/test-luk-peruna.mjs`:

```js
console.log('\nODNOGI (reakcja Przewodzenie):');
{
    const lo = new LukPeruna();
    spr('nieaktywny: srodek() null, wyladowanieDo() false', lo.srodek() === null && lo.wyladowanieDo({ x: 1, y: 1 }) === false);
    lo.zapal(1);
    przepusc(lo, dwieF, 0.3);
    const sr = lo.srodek();
    spr('srodek() = środek odcinka dłoń-dłoń', Math.abs(sr.x - 0.5 * 1920) < 3 && Math.abs(sr.y - 0.5 * 1080) < 3);
    spr('zły cel -> false, bez wyjątku', lo.wyladowanieDo(null) === false && lo.wyladowanieDo({ x: NaN, y: 1 }) === false);
    const cel = { x: 960, y: 900 };
    spr('wyladowanieDo(punkt) -> true i nowa odnoga', lo.wyladowanieDo(cel) === true && lo._odnogi.length === 1);
    const o = lo._odnogi[0];
    spr('odnoga startuje NA zygzaku łuku i kończy w celu', lo._luk.some(p => p.x === o.start.x && p.y === o.start.y) && o.cel.x === 960 && o.cel.y === 900);
    przepusc(lo, dwieF, NASTAWY.ODNOGA_ZYCIE + 0.02);
    spr('odnoga ginie po ODNOGA_ZYCIE', lo._odnogi.length === 0);
    lo.wyladowanieDo(cel);
    lo.zapal(1);
    spr('zapal() czyści odnogi', lo._odnogi.length === 0);
}
```
oraz w sekcji `STYLISTYKA`, w pętli `for (let i = 0; i < 120; i++)`, przed `lk.updateAndDraw(...)` dopisz: `if (i % 10 === 0) lk.wyladowanieDo({ x: 960, y: 900 });` (odnogi też muszą być ≤ 2 px i bez `lighter`).

- [ ] **Step 2:** `node tools/test-luk-peruna.mjs` → FAIL (`srodek` is not a function).
- [ ] **Step 3: Implementacja** w `js/lukPeruna.js`:
  - `NASTAWY`: dopisz `ODNOGA_ZYCIE: 0.15,   // s - odnoga do kręgu (reakcja Przewodzenie)`.
  - konstruktor: `this._luk = null;` i `this._odnogi = [];`; `zapal()`: `this._luk = null; this._odnogi = [];`.
  - w `updateAndDraw`, PO bloku odświeżenia zygzaka a PRZED blokiem iskier, dopisz:

```js
        // Bieżący zygzak w px - liczony przed guardem ctx, bo reakcje (wyladowanieDo) czytają go co klatkę.
        this._luk = mapujZygzak(this._zygzak, a, b, sk, this._t, this._seed);
        this._sk = sk;
        for (const o of this._odnogi) o.wiek += krok;
        this._odnogi = this._odnogi.filter(o => o.wiek < N.ODNOGA_ZYCIE);
```
  - zamień `const luk = mapujZygzak(this._zygzak, a, b, sk, this._t, this._seed);` na `const luk = this._luk;`.
  - po pętli rysującej `nitki` (przed `ctx.lineJoin = 'round';`) dopisz rysowanie odnóg:

```js
        // Odnogi do kręgów (reakcja Przewodzenie) - ten sam styl co główna linia.
        for (const o of this._odnogi) {
            const jas = (1 - o.wiek / N.ODNOGA_ZYCIE) * obw;
            const pkt = mapujZygzak(o.zygzak, o.start, o.cel, sk, this._t, o.seed);
            for (const [[r, g, bb], alfa, grubosc] of [[N.BARWA, N.ALFA_LUKU, N.GRUBOSC_LUKU], [N.BARWA_RDZENIA, N.ALFA_RDZENIA, N.GRUBOSC_RDZENIA]]) {
                ctx.strokeStyle = `rgba(${r},${g},${bb},${(alfa * jas).toFixed(3)})`;
                ctx.lineWidth = grubosc;
                ctx.beginPath();
                pkt.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
                ctx.stroke();
            }
        }
```
  - metody klasy (po `wyczyscCache()`):

```js
    /** Środek odcinka dłoń-dłoń (dla js/reakcjeTechnik.js). null, gdy Łuk nie trwa. */
    srodek() {
        if (!this._trwa || !this.konce) return null;
        return { x: (this.konce.a.x + this.konce.b.x) / 2, y: (this.konce.a.y + this.konce.b.y) / 2 };
    }

    /**
     * Reakcja Przewodzenie: krótka odnoga zygzaka z najbliższego punktu łuku do `punkt`.
     * @returns {boolean} false, gdy Łuk nie trwa albo cel jest zepsuty
     */
    wyladowanieDo(punkt) {
        if (!this._trwa || !this._luk?.length || !punkt || !Number.isFinite(punkt.x) || !Number.isFinite(punkt.y)) return false;
        let start = this._luk[0], naj = Infinity;
        for (const p of this._luk) {
            const d = Math.hypot(p.x - punkt.x, p.y - punkt.y);
            if (d < naj) { naj = d; start = p; }
        }
        this._odnogi.push({ start: { x: start.x, y: start.y }, cel: { x: punkt.x, y: punkt.y },
                            zygzak: nowyZygzak(0.6), seed: Math.random() * 100, wiek: 0 });
        return true;
    }
```
- [ ] **Step 4:** `node tools/test-luk-peruna.mjs` → PASS.
- [ ] **Step 5:** commit `"Luk Peruna: srodek() i wyladowanieDo() - odnogi pod reakcje"`.

## Task 3: Kręgi Mokoszy — `geometria()`, `naelektryzuj()` i prąd na kręgach

**Files:** Modify `js/kregiMokoszy.js`; Test `tools/test-kregi-mokoszy.mjs`.

**Interfaces:** Consumes `segmentuj` z `js/piorun.js`. Produces `kregi.geometria() -> {cx, cy, squash, promienie:number[]}|null`, `kregi.naelektryzuj() -> boolean`, `punktyPradu(cx, cy, R, katStart, t) -> {x,y,przod}[]`.

- [ ] **Step 1: Test (RED)** — import: dopisz `punktyPradu` do importu z `../js/kregiMokoszy.js`; przed sekcją `RYSOWANIE`:

```js
console.log('\nPRĄD NA KRĘGACH (reakcja Przewodzenie):');
{
    const g = new KregiMokoszy();
    spr('nieaktywne: geometria() null, naelektryzuj() false', g.geometria() === null && g.naelektryzuj() === false);
    g.zapal(1);
    przepusc(g, klatka(), 0.2);
    const geo = g.geometria();
    spr('geometria: środek na pasie, promień każdego żyjącego kręgu', geo && geo.cy === poziomWody(g.zaczep, H) && geo.promienie.length === g._kregi.length && geo.squash === NASTAWY.SQUASH);
    spr('naelektryzuj() -> true', g.naelektryzuj() === true && g._elektryzacja > 0);
    przepusc(g, klatka(), NASTAWY.ELEKTRYZACJA_S + 0.02);
    spr('elektryzacja gaśnie po ELEKTRYZACJA_S bez odświeżenia', g._elektryzacja === 0);
    const pp = punktyPradu(960, 600, 300, 0, 1);
    spr('prąd: poszarpana linia (więcej punktów niż próbek łuku)', pp.length > NASTAWY.PRAD_PROBEK + 1);
    spr('prąd leży przy elipsie kręgu (do 15% promienia)', pp.every(p => Math.abs(Math.hypot((p.x - 960) / 300, (p.y - 600) / (300 * NASTAWY.SQUASH)) - 1) < 0.15 / NASTAWY.SQUASH));
    const g2 = new KregiMokoszy();
    g2.zapal(1);
    przepusc(g2, klatka(), CZAS_TRWANIA - 0.2);   // kręgi już nie żyją (emisja 4.5 s + życie 1.6 s)
    spr('trwają, ale bez żyjącego kręgu -> geometria() null', g2.aktywny && g2._kregi.length === 0 && g2.geometria() === null);
}
```
oraz w sekcji `RYSOWANIE`, w pętli `for (let i = 0; i < 60; i++)`, przed `kd.updateAndDraw(...)`: `if (i % 10 === 0) kd.naelektryzuj();`.

- [ ] **Step 2:** `node tools/test-kregi-mokoszy.mjs` → FAIL (`punktyPradu` nie jest eksportowany).
- [ ] **Step 3: Implementacja** w `js/kregiMokoszy.js`:
  - import: `import { segmentuj } from './piorun.js';`
  - `NASTAWY`: dopisz

```js
    // Reakcja Przewodzenie (js/reakcjeTechnik.js): prąd biegnący po kręgach.
    ELEKTRYZACJA_S: 0.4,          // s - tyle trwa elektryzacja po ostatnim naelektryzuj()
    PRAD_NA_KRAG: 3,              // wyładowań na krąg
    PRAD_ROZPIETOSC: Math.PI / 2, // ~1/4 obwodu
    PRAD_PROBEK: 8,
    PRAD_PREDKOSC: 4,             // rad/s - wyładowania biegną po kręgu
    PRAD_ROZJASNIENIE: 0.4,       // mnożnik alfy tekstury kręgu przy pełnej elektryzacji: 1 + to
    BARWA_PRADU: [90, 160, 255], BARWA_PRADU_RDZEN: [200, 225, 255],
```
  - funkcja czysta (po `punktyKregu`):

```js
/**
 * Poszarpane wyładowanie biegnące po kręgu (reakcja Przewodzenie) - próbki
 * łuku elipsy połączone zygzakiem segmentuj(). Losowe przy każdym wołaniu (trzask).
 * @returns {{x, y, przod:boolean}[]}
 */
export function punktyPradu(cx, cy, R, katStart, t) {
    const N = NASTAWY;
    const probki = [];
    for (let i = 0; i <= N.PRAD_PROBEK; i++) {
        const kat = katStart + (i / N.PRAD_PROBEK) * N.PRAD_ROZPIETOSC;
        probki.push({ x: cx + Math.cos(kat) * R, y: cy + Math.sin(kat) * R * N.SQUASH, przod: Math.sin(kat) > 0 });
    }
    const wynik = [probki[0]];
    for (let i = 0; i < probki.length - 1; i++) {
        const seg = segmentuj(probki[i], probki[i + 1], 2, 0.35);
        for (let j = 1; j < seg.length; j++) wynik.push({ x: seg[j].x, y: seg[j].y, przod: probki[i].przod });
    }
    return wynik;
}
```
  - konstruktor i `zapal()`: `this._elektryzacja = 0; this._geom = null;`.
  - w `updateAndDraw` zaraz po linii `const sk = this.zaczep.skala, cx = this.zaczep.x, cy = poziomWody(this.zaczep, H);` dopisz:

```js
        this._elektryzacja = Math.max(0, this._elektryzacja - krok);
```
    a po bloku narodzin kręgów (przed `if (!ctx) return;`):

```js
        // Geometria dla reakcji (js/reakcjeTechnik.js) - tylko żyjące kręgi.
        const zywe = this._kregi.map(kr => stanKregu(kr.wiek)).filter(Boolean);
        this._geom = zywe.length ? { cx, cy, squash: N.SQUASH, promienie: zywe.map(st => sk * st.promien) } : null;
```
  - metody (po `wyczyscCache()`):

```js
    /** Geometria żyjących kręgów (dla js/reakcjeTechnik.js). null, gdy nie trwa albo brak kręgu. */
    geometria() { return this._trwa ? this._geom : null; }

    /** Reakcja Przewodzenie: kręgi elektryzują się na ELEKTRYZACJA_S. @returns {boolean} */
    naelektryzuj() {
        if (!this._trwa) return false;
        this._elektryzacja = NASTAWY.ELEKTRYZACJA_S;
        return true;
    }
```
  - w `_strona`: linię `c.globalAlpha = clamp01(N.ALFA_TEKSTURY * st.alfa * alfa);` zamień na
    `c.globalAlpha = clamp01(N.ALFA_TEKSTURY * st.alfa * alfa * (1 + N.PRAD_ROZJASNIENIE * this._elektryzacja / N.ELEKTRYZACJA_S));`
    i przed komentarzem `// Promienie - smugi trace_*` dopisz:

```js
        // Prąd na kręgach (reakcja Przewodzenie) - wyładowania biegną po obwodzie.
        const e = this._elektryzacja / N.ELEKTRYZACJA_S;
        if (e > 0) {
            for (const { st } of kregi) {
                const R = sk * st.promien;
                for (let i = 0; i < N.PRAD_NA_KRAG; i++) {
                    const pkt = punktyPradu(cx, cy, R, this._t * N.PRAD_PREDKOSC + i * Math.PI * 2 / N.PRAD_NA_KRAG, this._t);
                    for (const [[r, g, b], a, w] of [[N.BARWA_PRADU, 0.9, 2], [N.BARWA_PRADU_RDZEN, 0.85, 1]]) {
                        c.lineWidth = w;
                        c.strokeStyle = `rgba(${r},${g},${b},${(a * e * st.alfa * alfa).toFixed(3)})`;
                        rysujStrone(c, pkt, przod);
                    }
                }
            }
        }
```
- [ ] **Step 4:** `node tools/test-kregi-mokoszy.mjs` → PASS.
- [ ] **Step 5:** commit `"Kregi Mokoszy: geometria(), naelektryzuj() i prad na kregach"`.

## Task 4: Mgła Mokoszy — `rozblysk(zrodlo, sila)`

**Files:** Modify `js/mglaMokoszy.js`; Test `tools/test-mgla-mokoszy.mjs`.

**Interfaces:** Produces `mgla.rozblysk(zrodlo:{x,y}, sila:number) -> boolean`, `jasnoscBlysku(odl, skala) -> 0..1`.

- [ ] **Step 1: Test (RED)** — import: dopisz `jasnoscBlysku`; przed końcowym `console.log(ok ? ...)`:

```js
console.log('\nBŁYSK W MGLE (reakcja Burza w mgle):');
{
    spr('jasność 1 przy źródle, maleje z odległością, 0 daleko',
        jasnoscBlysku(0, 200) === 1 && jasnoscBlysku(200, 200) < 1 && jasnoscBlysku(200, 200) > jasnoscBlysku(500, 200) && jasnoscBlysku(1e6, 200) === 0);
    const mb = new MglaMokoszy();
    spr('nieaktywna: rozblysk() false', mb.rozblysk({ x: 1, y: 1 }, 1) === false);
    mb.zapal(1);
    przepusc(mb, klatka(), 0.5);
    spr('zły punkt -> false, bez wyjątku', mb.rozblysk(null, 1) === false && mb.rozblysk({ x: NaN, y: 0 }, 1) === false);
    spr('rozblysk() -> true', mb.rozblysk({ x: 960, y: 500 }, 1) === true && mb._blysk !== null);
    przepusc(mb, klatka(), NASTAWY.BLYSK_ZYCIE + 0.02);
    spr('błysk gaśnie po BLYSK_ZYCIE', mb._blysk === null);
    mb.rozblysk({ x: 960, y: 500 }, 1);
    let rzucilB = false;
    try { mb.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucilB = e; }
    spr('rysowanie z błyskiem nie rzuca', rzucilB === false);
}
```
- [ ] **Step 2:** `node tools/test-mgla-mokoszy.mjs` → FAIL (`jasnoscBlysku` nie jest eksportowany).
- [ ] **Step 3: Implementacja** w `js/mglaMokoszy.js`:
  - `NASTAWY`: dopisz

```js
    // Reakcja Burza w mgle (js/reakcjeTechnik.js): mgła błyska od środka.
    BLYSK_ZYCIE: 0.12,             // s
    ZASIEG_BLYSKU: 4,              // skala * to - dalej od źródła błysk nie sięga
    BARWA_BLYSKU: [200, 225, 255],
```
  - funkcja czysta (po `predkoscKlebu`):

```js
/** Jasność błysku kłębu w odległości `odl` px od źródła - 1 przy źródle, 0 od ZASIEG_BLYSKU skali. */
export function jasnoscBlysku(odl, skala) {
    return clamp01(1 - odl / (skala * NASTAWY.ZASIEG_BLYSKU));
}
```
  - konstruktor i `zapal()`: `this._blysk = null;`.
  - metoda (po `wyczyscCache()`):

```js
    /** Reakcja Burza w mgle: mgła błyska od `zrodlo` (px). @returns {boolean} */
    rozblysk(zrodlo, sila = 1) {
        if (!this._trwa || !zrodlo || !Number.isFinite(zrodlo.x) || !Number.isFinite(zrodlo.y)) return false;
        this._blysk = { x: zrodlo.x, y: zrodlo.y, sila: clamp01(sila), wiek: 0 };
        return true;
    }
```
  - w `updateAndDraw` po pętli ruchu kłębów (przed `if (!ctx) return;`):

```js
        if (this._blysk) {
            this._blysk.wiek += krok;
            if (this._blysk.wiek >= NASTAWY.BLYSK_ZYCIE) this._blysk = null;
        }
```
  - w pętli rysowania kłębów, między `warstwa.drawImage(...)` a `warstwa.restore();`:

```js
            if (this._blysk) {
                // Błysk od środka: ten sam kłąb, jasny i addytywny, słabnący z odległością od wyładowania.
                const b = this._blysk;
                const jas = jasnoscBlysku(Math.hypot(c.x - b.x, c.y - b.y), zaczep.skala) * (1 - b.wiek / NASTAWY.BLYSK_ZYCIE) * b.sila;
                if (jas > 0.01) {
                    warstwa.globalCompositeOperation = 'lighter';
                    warstwa.globalAlpha = clamp01(jas * this._sila);
                    warstwa.drawImage(wypalTintowany(img, NASTAWY.BARWA_BLYSKU, 256), -c.rozmiar / 2, -c.rozmiar / 2, c.rozmiar, c.rozmiar);
                    warstwa.globalCompositeOperation = 'source-over';
                }
            }
```
- [ ] **Step 4:** `node tools/test-mgla-mokoszy.mjs` → PASS.
- [ ] **Step 5:** commit `"Mgla Mokoszy: rozblysk() pod reakcje technik"`.

## Task 5: `js/reakcjeTechnik.js`, rejestr punktów i wpięcie

**Files:** Create `js/reakcjeTechnik.js`, `tools/test-reakcje-technik.mjs`; Modify `js/punkty.js` (`REAKCJE`), `js/swiezeModuly.js`, `js/main.js`, `tools/scena.html`, `tools/test-swieze-moduly.mjs`, `GEMINI.md`.

**Interfaces:** Consumes API z Task 1–4. Produces `class ReakcjeTechnik { klatka({lukPeruna, kregiMokoszy, mglaMokoszy, piorun}, dt, los?) -> {przewodzenie:number, burzaWMgle:number} }`, `punktNaKregu(geom, cel, indeks) -> {x,y}|null`, `NASTAWY`.

- [ ] **Step 1: Test (RED)** — `tools/test-reakcje-technik.mjs`:

```js
/**
 * js/reakcjeTechnik.js - warunki, rytm i jednostki reakcji Przewodzenie i
 * Burza w mgle; techniki zastąpione szpiegami.
 *   node tools/test-reakcje-technik.mjs
 */
import { ReakcjeTechnik, punktNaKregu, NASTAWY } from '../js/reakcjeTechnik.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;

function szpiedzy({ luk = false, kregi = false, mgla = false, piorun = false, geom = { cx: 960, cy: 700, squash: 0.28, promienie: [300] }, uderzenie = { x: 900, y: 950 } } = {}) {
    const log = [];
    return {
        log,
        t: {
            lukPeruna: { aktywny: luk, srodek: () => ({ x: 960, y: 500 }), wyladowanieDo: (p) => { log.push(['luk.wyladowanieDo', p]); return true; } },
            kregiMokoszy: { aktywny: kregi, geometria: () => geom, naelektryzuj: () => { log.push(['kregi.naelektryzuj']); return true; } },
            mglaMokoszy: { aktywny: mgla, rozblysk: (z, s) => { log.push(['mgla.rozblysk', z, s]); return true; } },
            piorun: { aktywny: piorun, punktUderzenia: uderzenie }
        }
    };
}
const biegnij = (r, t, sek, los) => { let s = { przewodzenie: 0, burzaWMgle: 0 }; for (let i = 0; i < Math.round(sek / DT); i++) { const w = r.klatka(t, DT, los); s.przewodzenie += w.przewodzenie; s.burzaWMgle += w.burzaWMgle; } return s; };

console.log('PUNKT NA KRĘGU:');
const geom = { cx: 960, cy: 700, squash: 0.28, promienie: [300, 500] };
const p = punktNaKregu(geom, { x: 960, y: 200 }, 1);
spr('leży na elipsie wskazanego kręgu', Math.abs(Math.hypot((p.x - 960) / 500, (p.y - 700) / (500 * 0.28)) - 1) < 1e-9);
spr('po stronie celu (cel nad środkiem -> punkt nad środkiem)', p.y < 700);
spr('zła geometria/cel -> null', punktNaKregu(null, { x: 1, y: 1 }, 0) === null && punktNaKregu(geom, null, 0) === null && punktNaKregu(geom, { x: 1, y: 1 }, 9) === null);

console.log('\nPRZEWODZENIE:');
{
    const { t, log } = szpiedzy({ luk: true, kregi: true });
    const r = new ReakcjeTechnik();
    const s = biegnij(r, t, 3, () => 0.5);
    const oczek = Math.floor(3 / NASTAWY.ODSTEP_PRZEWODZENIA) + 1;
    spr(`wyładowanie co ${NASTAWY.ODSTEP_PRZEWODZENIA} s, pierwsze od razu (${s.przewodzenie} ~ ${oczek})`, Math.abs(s.przewodzenie - oczek) <= 1);
    spr('każde wyładowanie: łuk sięga do kręgu i kręgi się elektryzują',
        log.filter(w => w[0] === 'luk.wyladowanieDo').length === s.przewodzenie && log.filter(w => w[0] === 'kregi.naelektryzuj').length === s.przewodzenie);
    for (const [opis, o] of [['bez Łuku', { kregi: true }], ['bez Kręgów', { luk: true }], ['Kręgi bez żyjącego kręgu', { luk: true, kregi: true, geom: null }]]) {
        const sp = szpiedzy(o);
        const w = biegnij(new ReakcjeTechnik(), sp.t, 1);
        spr(`${opis}: zero jednostek i zero wywołań`, w.przewodzenie === 0 && !sp.log.some(x => x[0] !== 'mgla.rozblysk'));
    }
}

console.log('\nBURZA W MGLE:');
{
    const { t, log } = szpiedzy({ luk: true, mgla: true });
    const s = biegnij(new ReakcjeTechnik(), t, 2, () => 0.5);
    const odstep = NASTAWY.BLYSK_ODSTEP_MIN + 0.5 * (NASTAWY.BLYSK_ODSTEP_MAX - NASTAWY.BLYSK_ODSTEP_MIN);
    // Odstęp 0.105 s to 6.3 klatki - kwantyzacja do pełnych klatek daje kilka błysków mniej, stąd tolerancja 3.
    spr(`błyski w rytmie (${s.burzaWMgle} ~ ${Math.floor(2 / odstep) + 1})`, Math.abs(s.burzaWMgle - (Math.floor(2 / odstep) + 1)) <= 3);
    spr('źródło: środek Łuku, gdy Łuk trwa', log.filter(w => w[0] === 'mgla.rozblysk').every(w => w[1].x === 960 && w[1].y === 500));
    const g = szpiedzy({ piorun: true, mgla: true });
    biegnij(new ReakcjeTechnik(), g.t, 0.5, () => 0.5);
    spr('bez Łuku źródłem jest punkt uderzenia pioruna', g.log.length > 0 && g.log.every(w => w[1].x === 900 && w[1].y === 950));
    const brak = szpiedzy({ piorun: true, mgla: true, uderzenie: null });
    const wb = biegnij(new ReakcjeTechnik(), brak.t, 0.5);
    spr('punkt uderzenia null -> nic nie liczone ani wołane', wb.burzaWMgle === 0 && brak.log.length === 0);
    const bezMgly = szpiedzy({ luk: true, piorun: true });
    spr('bez Mgły: zero', biegnij(new ReakcjeTechnik(), bezMgly.t, 1).burzaWMgle === 0);
}

console.log('\nODPORNOŚĆ:');
{
    const { t } = szpiedzy({ luk: true, kregi: true, mgla: true });
    const w = new ReakcjeTechnik().klatka(t, 5);   // karta wróciła po 5 s
    spr('ogromne dt -> najwyżej 1 jednostka na reakcję', w.przewodzenie <= 1 && w.burzaWMgle <= 1);
    let rzucil = false;
    try { new ReakcjeTechnik().klatka({}, DT); new ReakcjeTechnik().klatka(null, NaN); } catch { rzucil = true; }
    spr('brak technik / zepsute dt - bez wyjątku', !rzucil);
    const r = new ReakcjeTechnik();
    spr('nowa instancja bezczynna', r._doPrzewodzenia === 0 && r._doBlysku === 0);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
```
- [ ] **Step 2:** `node tools/test-reakcje-technik.mjs` → FAIL (brak modułu).
- [ ] **Step 3: Implementacja** `js/reakcjeTechnik.js`:

```js
/**
 * Reakcje między technikami (spec docs/superpowers/specs/2026-10-03-reakcje-
 * technik-design.md). Jedyne miejsce, które łączy techniki: każda wystawia małe
 * API (geometria + jedna metoda efektu), a tu sprawdzamy warunki i wołamy efekty.
 * Techniki dalej się nie znają - każdą da się wyjąć jednym commitem; reakcja
 * z nią po prostu przestaje zachodzić.
 *
 *  - PRZEWODZENIE: Łuk Peruna + Kręgi Mokoszy ("woda przewodzi prąd"). Co
 *    ODSTEP_PRZEWODZENIA łuk wypuszcza odnogę do kręgu, a kręgi się elektryzują.
 *  - BURZA W MGLE: Mgła Mokoszy + (Łuk Peruna albo piorun Gromu w Ziemię).
 *    Co 60-150 ms mgła błyska od źródła wyładowania.
 *
 * klatka() zwraca JEDNOSTKI reakcji z tej klatki; main.js przekazuje je do
 * punkty.reakcja() z literalnymi id (strażnik w tools/test-punkty.mjs).
 * Najwyżej 1 jednostka na reakcję na klatkę - duże dt (powrót na kartę) nie
 * robi lawiny punktów. Efekty rysują techniki w kolejnej klatce.
 */
export const NASTAWY = {
    ODSTEP_PRZEWODZENIA: 0.3,               // s
    BLYSK_ODSTEP_MIN: 0.06, BLYSK_ODSTEP_MAX: 0.15,   // s
    SILA_BLYSKU_LUK: 0.8, SILA_BLYSKU_GROM: 1.0
};

const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * Punkt na elipsie kręgu `indeks` po stronie celu - czysta funkcja.
 * @param {{cx, cy, squash, promienie:number[]}} geom  z kregiMokoszy.geometria()
 * @returns {{x,y}|null}
 */
export function punktNaKregu(geom, cel, indeks) {
    const R = geom?.promienie?.[indeks];
    if (!Number.isFinite(R) || !punktOk(cel) || !Number.isFinite(geom.squash) || geom.squash <= 0) return null;
    const kat = Math.atan2((cel.y - geom.cy) / geom.squash, cel.x - geom.cx);
    return { x: geom.cx + Math.cos(kat) * R, y: geom.cy + Math.sin(kat) * R * geom.squash };
}

export class ReakcjeTechnik {
    constructor() {
        this._doPrzewodzenia = 0;
        this._doBlysku = 0;
    }

    /**
     * @param {{lukPeruna, kregiMokoszy, mglaMokoszy, piorun}} t  instancje technik
     * @param {number} dt  s
     * @param {() => number} [los]  wstrzykiwany do testów
     * @returns {{przewodzenie:number, burzaWMgle:number}}
     */
    klatka(t, dt, los = Math.random) {
        const N = NASTAWY;
        const wynik = { przewodzenie: 0, burzaWMgle: 0 };
        const krok = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        const { lukPeruna: luk, kregiMokoszy: kregi, mglaMokoszy: mgla, piorun } = t ?? {};

        // --- Przewodzenie ---
        const geom = luk?.aktywny && kregi?.aktywny ? kregi.geometria?.() : null;
        if (geom?.promienie?.length) {
            this._doPrzewodzenia -= krok;
            if (this._doPrzewodzenia <= 0) {
                const idx = Math.min(geom.promienie.length - 1, Math.floor(los() * geom.promienie.length));
                const cel = punktNaKregu(geom, luk.srodek?.(), idx);
                if (cel && luk.wyladowanieDo(cel)) {
                    kregi.naelektryzuj();
                    wynik.przewodzenie = 1;
                }
                this._doPrzewodzenia = N.ODSTEP_PRZEWODZENIA;
            }
        } else {
            this._doPrzewodzenia = 0;   // pierwsze wyładowanie od razu przy kolejnym spotkaniu
        }

        // --- Burza w mgle ---
        const zLuku = !!luk?.aktywny;
        if (mgla?.aktywny && (zLuku || piorun?.aktywny)) {
            this._doBlysku -= krok;
            if (this._doBlysku <= 0) {
                const zrodlo = zLuku ? luk.srodek?.() : piorun.punktUderzenia;
                if (punktOk(zrodlo) && mgla.rozblysk(zrodlo, zLuku ? N.SILA_BLYSKU_LUK : N.SILA_BLYSKU_GROM)) {
                    wynik.burzaWMgle = 1;
                }
                this._doBlysku = N.BLYSK_ODSTEP_MIN + los() * (N.BLYSK_ODSTEP_MAX - N.BLYSK_ODSTEP_MIN);
            }
        } else {
            this._doBlysku = 0;
        }
        return wynik;
    }
}
```
- [ ] **Step 4:** `node tools/test-reakcje-technik.mjs` → PASS.
- [ ] **Step 5: Rejestr punktów** — w `js/punkty.js` w `REAKCJE` po `rozwianie`:

```js
    // Łuk Peruna wypuszcza odnogę do kręgu Kręgów Mokoszy (js/reakcjeTechnik.js), co 0.3 s.
    // Typowe nałożenie ~4.5 s = ~15 wyładowań = ~200 pkt (jak jedna prosta technika).
    przewodzenie: { nazwa: 'Przewodzenie', punkty: 15, pelneDo: 10, przerwaMs: 1500 },
    // Błysk mgły Mokoszy od Łuku Peruna lub pioruna Gromu w Ziemię, co 60-150 ms.
    // Pojedynczy Grom ~45 pkt; Łuk w mgle ~5 s ~200 pkt.
    burzaWMgle: { nazwa: 'Burza w mgle', punkty: 10, pelneDo: 12, przerwaMs: 1500 }
```
(dopisz przecinek po wpisie `rozwianie`).
- [ ] **Step 6: Wpięcie:**
  - `js/swiezeModuly.js`: `import { ReakcjeTechnik } from './reakcjeTechnik.js';`, `'reakcjeTechnik'` na końcu `KLUCZE_MODULOW`, `reakcjeTechnik: new ReakcjeTechnik()` na końcu zwracanego obiektu.
  - `js/main.js`: import obok `import { Kurzawa } from './kurzawa.js';`; `let reakcjeTechnik = new ReakcjeTechnik();` pod `let kurzawa = new Kurzawa();`; `reakcjeTechnik` w destrukturyzacji `resetujModuly()` (po `mglaMokoszy`); pod `kurzawa.updateAndDraw(ctx, kontekstTechnik, dt);`:

```js
    // Reakcje między technikami (js/reakcjeTechnik.js) - efekty rysują same
    // techniki w następnej klatce; tu tylko warunki i punkty.
    const reakcjeKlatki = reakcjeTechnik.klatka({ lukPeruna, kregiMokoszy, mglaMokoszy, piorun }, dt);
    punkty.reakcja('przewodzenie', reakcjeKlatki.przewodzenie, now);
    punkty.reakcja('burzaWMgle', reakcjeKlatki.burzaWMgle, now);
```
  - `tools/scena.html`: pod `const { Kurzawa, NASTAWY: NASTAWY_KURZAWA } = await import('./js/kurzawa.js');` dopisz `const { ReakcjeTechnik } = await import('./js/reakcjeTechnik.js');`; pod `const kurzawa = new Kurzawa();` dopisz `const reakcjeTechnik = new ReakcjeTechnik();`; pod `kurzawa.updateAndDraw(ctx, kontekstTechnik, dt);` dopisz `reakcjeTechnik.klatka({ lukPeruna, kregiMokoszy, mglaMokoszy, piorun }, dt);`.
  - `tools/test-swieze-moduly.mjs` w bloku BEZCZYNNOŚĆ: `spr('reakcje technik bezczynne', m.reakcjeTechnik._doPrzewodzenia === 0 && m.reakcjeTechnik._doBlysku === 0);`
  - `GEMINI.md`: wiersz pod `js/kregiMokoszy.js`:
    `| \`js/reakcjeTechnik.js\` | Reakcje między technikami: Przewodzenie (Łuk Peruna + Kręgi Mokoszy - odnoga łuku do kręgu, prąd po kręgach) i Burza w mgle (Łuk albo piorun Gromu w Ziemię + Mgła Mokoszy - mgła błyska od środka); jedyne miejsce łączące techniki, zwraca jednostki dla punkty.reakcja() |`
- [ ] **Step 7:** `node --check js/main.js`; składnia skryptu `tools/scena.html` (wyciągnięty moduł + `node --check`); komplet testów (bez `test-rozdzielnosc`) → wszystkie ✓ (`test-punkty` widzi nowe id w `REAKCJE`).
- [ ] **Step 8:** commit `"Reakcje technik: Przewodzenie i Burza w mgle (+ punkty)"`.

## Weryfikacja end-to-end

1. Komplet testów (bez `test-rozdzielnosc`) — zielony po każdym zadaniu.
2. `tools/scena.html` (jeśli Chrome MCP podłączony): Łuk + Kręgi, Mgła + Łuk, Mgła + Grom w Ziemię z przycisków technik.
3. Kamera (właściciel): mokosz → perun, potem mokosz → weles; stribog → mokosz, potem mokosz → perun (oraz swarog → weles → perun w mgle).
