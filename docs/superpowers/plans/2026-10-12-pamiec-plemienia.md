# Pamięć Plemienia — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Księga Plemienia dostaje Zwój Technik, Węzły Mocy i Kamienie Pamięci — trwałą, wspólną dla przeglądarki kolekcję odkryć i osiągnięć, z powiadomieniem na żywo i sekcją „Nowe w Księdze" w Kronice.

**Architecture:** Czyste moduły bez DOM (`katalog.js` → `osiagniecia.js` → `odkrycia.js`, plus dane `emblematy.js`) testowane w node; cienkie warstwy DOM (`emblematDom.js`, `odkryciaHud.js`, `zwojUi.js`) renderują stan; `main.js` woła `Odkrycia` obok istniejących haków punktacji, bramkowane tylko `menu.graAktywna` (swobodny taniec też odkrywa). Zapis w `localStorage` pod własnym kluczem, tylko przy zmianie.

**Tech Stack:** Vanilla ES modules w przeglądarce, testy `node tools/test-*.mjs` (własny `spr()`), `sh tools/test-wszystko.sh`. Bez bundlera, bez zależności.

**Spec:** `docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md`

## Global Constraints

- §2 GEMINI.md: nic nie mówi „źle" — liczniki tylko zdobyczami („Odkryto 9 z 16"), kamienie nigdy nie są odbierane i **nie dają punktów**.
- Nieodkryta technika/węzeł: **tylko nazwa + zwęglony emblemat** — bez sekwencji, run, podpowiedzi.
- Zakaz §7: żadnych obrotowo symetrycznych figur z zagiętymi/spiralnymi ramionami (swarzyca/kołowrót); runy `ZAKAZANE` z `js/glify.js` (`ᛋ ᛟ ᛏ ᛉ`) nie występują nigdzie.
- Odkrycia liczą się wszędzie, gdzie `menu.graAktywna` (gra i Kronika, także swobodny taniec); nigdy przez `Punktacja` (w swobodnym `punkty.aktywna === false`).
- Klucz pamięci `krolSzamanow.odkrycia.v1`; `try/catch`, flaga `trwala`, walidacja przy odczycie; brak pamięci nie jest błędem.
- Zapis tylko przy zmianie: nowe odblokowanie → od razu; same liczniki → koniec rundy, Esc → Polana, `visibilitychange`.
- „Wyczyść Księgę" czyści tylko wyniki, nigdy odkryć.
- Tekst w DOM wyłącznie przez `textContent` (nick gracza!). SVG emblematów to statyczne, zaufane łańcuchy z repo.
- UI bez rodzaju gramatycznego gracza („Odkryto", nie „Odkryłeś").
- Progi kamieni ZGADNIĘTE — oznaczyć komentarzem jak reszta liczb arcade.
- `prefers-reduced-motion`: bez animacji żaru/rysowania.
- Polskie komentarze, styl jak w `js/ksiega.js` (nagłówek z odwołaniem do specu, wielkie litery dla „dlaczego").

Odstępstwa od specu (świadome, drobne): katalog wydzielony do `js/katalog.js`, rysowanie SVG do `js/emblematDom.js` (spec wymieniał tylko `emblematy.js`); węzły nie mają własnych rysunków — emblemat węzła składa się z dwóch emblematów technik (spec to dopuszczał), więc ręcznie rysowanych SVG jest 16, nie 29; „Godzina Duchów" i „Noc Kupały" sprawdzane przy każdej aktywności (pieczęć/technika/węzeł/koniec rundy/nick), nie tylko „odkrycie albo runda".

## Review Focus

1. **Wiele odblokowań w jednej klatce** (pierwsza pieczęć + technika + Pierwsza Iskra naraz) → powiadomienia idą po kolei, żadne nie przepada w Kronice. Test: Task 4 (lista z kilku pozycji), Task 7 (kolejka).
2. **Cudzy/zepsuty plik importu** z polem `odkrycia` (`__proto__`, ogromne liczby, nieznane id, złe typy) → reszta wczytana, brak wyjątku, nic nie nadpisane. Test: Task 4 (`walidujOdkrycia`, `scal`).
3. **Trzymanie jednej pozy** (ta sama pieczęć składana w kółko) → nie nabija liczników, Kamiennego Muru ani Trójsplotu. Test: Task 4.
4. **Pamięć niedostępna/pełna** (tryb prywatny) → gra działa, odkrycia żyją do zamknięcia karty, Księga mówi o tym jednym zdaniem. Test: Task 4 (pamięć rzucająca), Task 9 (zdanie w UI).
5. **Aktualizacja gry zmienia katalog** (zapis zawiera usuniętą technikę, pojawia się nowa) → zapis się wczytuje bez nieznanych id, nowa pozycja jest zwęglona. Test: Task 4.

---

### Task 1: Katalog odkryć

**Files:**
- Create: `js/katalog.js`
- Test: `tools/test-katalog.mjs`

**Interfaces:**
- Consumes: `KOMBOSY` (`js/kombosy.js`), `REAKCJE` (`js/punkty.js`), `GLIFY` (`js/glify.js`)
- Produces:
  - `PIECZECIE: string[]` — id pięciu pieczęci, kolejność `GLIFY`
  - `NAZWY_PIECZECI: Record<string,string>`
  - `TECHNIKI: {id:string, nazwa:string, sekwencja:string[]}[]` — bez wariantów
  - `DWOJKI: string[]`, `TROJKI: string[]` — id
  - `WEZLY: {id:string, nazwa:string}[]`

- [ ] **Step 1: Write the failing test** — `tools/test-katalog.mjs`

```js
/**
 * Katalog Pamięci Plemienia - wyliczany z rejestrów, nie wpisywany ręcznie.
 *   node tools/test-katalog.mjs
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 */
import { PIECZECIE, NAZWY_PIECZECI, TECHNIKI, DWOJKI, TROJKI, WEZLY } from '../js/katalog.js';
import { KOMBOSY } from '../js/kombosy.js';
import { REAKCJE } from '../js/punkty.js';
import { GLIFY } from '../js/glify.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('KATALOG:');
spr('pieczęcie = klucze GLIFY', JSON.stringify(PIECZECIE) === JSON.stringify(Object.keys(GLIFY)));
spr('każda pieczęć ma nazwę', PIECZECIE.every(id => typeof NAZWY_PIECZECI[id] === 'string' && NAZWY_PIECZECI[id].length > 0));
const ids = TECHNIKI.map(t => t.id);
spr('techniki bez duplikatów (warianty Tęczy odpadły)', new Set(ids).size === ids.length);
spr('każde id z KOMBOSY jest w katalogu', KOMBOSY.every(k => ids.includes(k.id)));
spr('żaden wariant nie dał własnej pozycji', TECHNIKI.every(t => KOMBOSY.find(k => k.id === t.id && !k.wariant)));
spr('Tęcza ma sekwencję bez wariantu (3 pieczęcie)', TECHNIKI.find(t => t.id === 'tecza').sekwencja.length === 3);
spr('dwójki + trójki = wszystkie techniki', DWOJKI.length + TROJKI.length === TECHNIKI.length
    && [...DWOJKI, ...TROJKI].every(id => ids.includes(id)));
spr('dwójki mają 2 pieczęcie', DWOJKI.every(id => TECHNIKI.find(t => t.id === id).sekwencja.length === 2));
spr('węzły = klucze REAKCJE', JSON.stringify(WEZLY.map(w => w.id)) === JSON.stringify(Object.keys(REAKCJE)));
spr('węzły mają nazwy z REAKCJE', WEZLY.every(w => w.nazwa === REAKCJE[w.id].nazwa));
spr('sekwencja jest kopią (mutacja nie psuje KOMBOSY)', (() => {
    TECHNIKI[0].sekwencja.push('x');
    const zepsute = KOMBOSY.some(k => k.sekwencja.includes('x'));
    TECHNIKI[0].sekwencja.pop();
    return !zepsute;
})());

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-katalog.mjs`
Expected: FAIL — `Cannot find module '.../js/katalog.js'`

- [ ] **Step 3: Write minimal implementation** — `js/katalog.js`

```js
/**
 * Katalog Pamięci Plemienia - co w ogóle da się odkryć.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * WYLICZANY Z REJESTRÓW, NIE WPISYWANY RĘCZNIE. Nowe combo w KOMBOSY albo nowa
 * reakcja w REAKCJE same pojawiają się w Zwoju (zwęglone), a test-strażnik
 * emblematów (tools/test-emblematy.mjs) zaczerwieni się, dopóki nie dostaną
 * rysunku i legendy.
 *
 * WARIANTY TĘCZY (`wariant: true` - przytrzymana miska) to NIE osobne techniki:
 * KOMBOSY ma 19 wpisów, ale technik jest 16.
 */
import { KOMBOSY } from './kombosy.js';
import { REAKCJE } from './punkty.js';
import { GLIFY } from './glify.js';

export const PIECZECIE = Object.keys(GLIFY);

export const NAZWY_PIECZECI = {
    swarog: 'Swaróg', perun: 'Perun', weles: 'Weles', stribog: 'Stribog', mokosz: 'Mokosz'
};

export const TECHNIKI = KOMBOSY
    .filter(k => !k.wariant)
    .map(k => ({ id: k.id, nazwa: k.nazwa, sekwencja: [...k.sekwencja] }));

// Drabina poziomów (pamięć projektu): 2 pieczęcie = gest, 3 = zjawisko.
export const DWOJKI = TECHNIKI.filter(t => t.sekwencja.length === 2).map(t => t.id);
export const TROJKI = TECHNIKI.filter(t => t.sekwencja.length >= 3).map(t => t.id);

export const WEZLY = Object.entries(REAKCJE).map(([id, r]) => ({ id, nazwa: r.nazwa }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-katalog.mjs`
Expected: wszystkie `✓`, kod wyjścia 0

- [ ] **Step 5: Commit**

```bash
git add js/katalog.js tools/test-katalog.mjs
git commit -m "Pamięć Plemienia: katalog odkryć wyliczany z KOMBOSY/REAKCJE/GLIFY"
```

---

### Task 2: Wspólna reguła splecenia

**Files:**
- Modify: `js/punkty.js:197-201` (w `Punktacja.technika`) + nowe eksporty nad klasą
- Test: `tools/test-punkty.mjs` (dopisać sekcję na końcu, przed `process.exit`)

**Interfaces:**
- Produces:
  - `ogonPieczeci(historia: {id,t}[], n: number): Set<number>` — znaczniki czasu ostatnich `n` pieczęci
  - `ogonyNakladajaSie(ogon: Set<number>, poprzedni: Set<number>|null|undefined): boolean`

- [ ] **Step 1: Write the failing test** — dopisz do `tools/test-punkty.mjs` przed `process.exit(...)`; dodaj `ogonPieczeci, ogonyNakladajaSie` do istniejącego importu z `../js/punkty.js`

```js
console.log('\nWSPÓLNA REGUŁA SPLECENIA (Pamięć Plemienia też jej używa):');
{
    const h = [{ id: 'mokosz', t: 1 }, { id: 'swarog', t: 2 }, { id: 'mokosz', t: 3 }, { id: 'stribog', t: 4 }];
    const ogon = ogonPieczeci(h, 3);
    spr('ogon = 3 ostatnie znaczniki', ogon.size === 3 && ogon.has(2) && ogon.has(3) && ogon.has(4));
    spr('nakłada się, gdy dzieli pieczęć', ogonyNakladajaSie(ogon, new Set([1, 2])) === true);
    spr('nie nakłada się bez wspólnej', ogonyNakladajaSie(ogon, new Set([1])) === false);
    spr('brak poprzedniego = brak nakładania', ogonyNakladajaSie(ogon, null) === false && ogonyNakladajaSie(ogon, undefined) === false);
    spr('n większe niż historia = cała historia', ogonPieczeci(h, 10).size === 4);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-punkty.mjs`
Expected: FAIL — `does not provide an export named 'ogonPieczeci'`

- [ ] **Step 3: Write minimal implementation** — w `js/punkty.js` nad `export class Punktacja` dodaj:

```js
/**
 * SPLECENIE - wspólna reguła dla punktów i Pamięci Plemienia (js/odkrycia.js).
 * Ogon techniki to znaczniki czasu jej ostatnich N pieczęci; dwie techniki są
 * splecione, gdy ich ogony dzielą pieczęć ("łańcuchy są celowe", kombosy.js).
 * Jedna funkcja, żeby Trójsplot w Księdze znaczył dokładnie to, co premia tutaj.
 */
export function ogonPieczeci(historia, n) {
    return new Set(historia.slice(-n).map(w => w.t));
}

export function ogonyNakladajaSie(ogon, poprzedni) {
    return !!poprzedni && [...ogon].some(t => poprzedni.has(t));
}
```

i w `Punktacja.technika` zamień:

```js
        const n = kombo.sekwencja.length;
        const ogon = new Set(this._historia.slice(-n).map(w => w.t));
        const nakladaSie = !!this._poprzedniOgon && [...ogon].some(t => this._poprzedniOgon.t.has(t));
```

na:

```js
        const ogon = ogonPieczeci(this._historia, kombo.sekwencja.length);
        const nakladaSie = ogonyNakladajaSie(ogon, this._poprzedniOgon?.t);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-punkty.mjs`
Expected: wszystkie `✓` (także dotychczasowe testy splecenia — zachowanie bez zmian)

- [ ] **Step 5: Commit**

```bash
git add js/punkty.js tools/test-punkty.mjs
git commit -m "Punkty: reguła splecenia jako wspólne funkcje (ogonPieczeci, ogonyNakladajaSie)"
```

---

### Task 3: Kamienie Pamięci (rejestr osiągnięć)

**Files:**
- Create: `js/osiagniecia.js`
- Test: `tools/test-osiagniecia.mjs`

**Interfaces:**
- Consumes: Task 1 (`PIECZECIE`, `DWOJKI`, `TROJKI`, `TECHNIKI`, `WEZLY`), `tytulZaWynik` (`js/kronika.js`), `BOGOWIE` (`js/jaja.js`)
- Produces:
  - `OKNO_HISTORII_MS = 60000`
  - `KAMIENIE: {id, nazwa, opis, kategoria:'kolekcja'|'mit'|'kunszt'|'sekret', sekret?:true, kiedy:'zywo'|'runda'|'nick'|'zawsze', runa:string, postep?(s)→{ile,z}, warunek(s, ctx)→boolean}[]`
  - `KATEGORIE: {id, naglowek}[]`
  - pomocnicze: `poKolei(historia, [rodzaj,id], [rodzaj,id], oknoMs)`, `razem(historia, [[rodzaj,id],...], oknoMs, now)`, `ileWOknie(historia, rodzaj, id, oknoMs, now)`, `rozneWOknie(historia, rodzaj, oknoMs, now)`, `godzinaDuchow(date)`, `nocKupaly(date)`
  - Kształt `s` (stan, czytany z instancji `Odkrycia` w Task 4): `{pieczecie, techniki, wezly, kamienie: Record<id,{n?,t}>, liczniki:{rundy:number, piesni:string[], bogowie:string[]}, historia:{rodzaj:'pieczec'|'technika'|'wezel', id, t}[], splotSeria:number, manifest:string[]}`
  - Kształt `ctx`: `{teraz: Date, now: number|null, pods?, wynikKsiegi?}`

- [ ] **Step 1: Write the failing test** — `tools/test-osiagniecia.mjs`

```js
/**
 * Kamienie Pamięci - każdy kamień na progu i tuż pod nim.
 *   node tools/test-osiagniecia.mjs
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 */
import {
    KAMIENIE, KATEGORIE, OKNO_HISTORII_MS, poKolei, razem, ileWOknie, rozneWOknie, godzinaDuchow, nocKupaly
} from '../js/osiagniecia.js';
import { PIECZECIE, DWOJKI, TROJKI, TECHNIKI, WEZLY } from '../js/katalog.js';
import { ZAKAZANE } from '../js/glify.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const K = (id) => KAMIENIE.find(k => k.id === id);
const stan = (nad = {}) => ({
    pieczecie: {}, techniki: {}, wezly: {}, kamienie: {},
    liczniki: { rundy: 0, piesni: [], bogowie: [] }, historia: [], splotSeria: 0, manifest: [], ...nad
});
const zbior = (ids) => Object.fromEntries(ids.map(id => [id, { n: 1, t: 1 }]));
const ctx = (nad = {}) => ({ teraz: new Date(2026, 9, 12, 15, 0), now: 100000, ...nad });
const ev = (rodzaj, id, t) => ({ rodzaj, id, t });

console.log('REJESTR:');
{
    const ids = KAMIENIE.map(k => k.id);
    spr('24 kamienie, bez duplikatów', KAMIENIE.length === 24 && new Set(ids).size === 24);
    spr('każdy ma nazwę, opis, kategorię, kiedy, runę, warunek', KAMIENIE.every(k =>
        k.nazwa && k.opis && KATEGORIE.some(c => c.id === k.kategoria)
        && ['zywo', 'runda', 'nick', 'zawsze'].includes(k.kiedy) && typeof k.runa === 'string' && typeof k.warunek === 'function'));
    spr('runy kamieni nie są ZAKAZANE (§7)', KAMIENIE.every(k => !ZAKAZANE.includes(k.runa)));
    spr('sekrety mają kategorię sekret', KAMIENIE.filter(k => k.sekret).every(k => k.kategoria === 'sekret'));
    spr('żaden warunek nie rzuca na pustym stanie', KAMIENIE.every(k => {
        try { return typeof k.warunek(stan(), ctx({ now: null })) === 'boolean'; } catch { return false; }
    }));
    spr('żaden nie jest zdobyty na pustym stanie', KAMIENIE.every(k => k.warunek(stan(), ctx()) === false));
    spr('okno historii mieści najdłuższe okno mitu (60 s)', OKNO_HISTORII_MS >= 60000);
}

console.log('\nPOMOCNICZE:');
{
    const h = [ev('technika', 'gromWZiemie', 1000), ev('pieczec', 'mokosz', 5000), ev('technika', 'kolowrot', 15000)];
    spr('poKolei: a potem b w oknie', poKolei(h, ['technika', 'gromWZiemie'], ['technika', 'kolowrot'], 15000));
    spr('poKolei: poza oknem nie', !poKolei(h, ['technika', 'gromWZiemie'], ['technika', 'kolowrot'], 13999));
    spr('poKolei: odwrotna kolejność nie', !poKolei(h, ['technika', 'kolowrot'], ['technika', 'gromWZiemie'], 60000));
    spr('razem: oba w oknie', razem([ev('wezel', 'a', 96000), ev('wezel', 'b', 100000)], [['wezel', 'a'], ['wezel', 'b']], 5000, 100000));
    spr('razem: jeden za stary', !razem([ev('wezel', 'a', 94999), ev('wezel', 'b', 100000)], [['wezel', 'a'], ['wezel', 'b']], 5000, 100000));
    spr('ileWOknie liczy tylko w oknie', ileWOknie([ev('technika', 'x', 1), ev('technika', 'x', 50), ev('technika', 'x', 60)], 'technika', 'x', 20, 60) === 2);
    spr('rozneWOknie', rozneWOknie([ev('pieczec', 'a', 10), ev('pieczec', 'a', 11), ev('pieczec', 'b', 12)], 'pieczec', 100, 12) === 2);
    spr('śmieci nie rzucają', !poKolei(null, ['a', 'b'], ['c', 'd'], 1) && !razem(null, [], 1, 1) && ileWOknie(null, 'a', 'b', 1, 1) === 0);
    spr('godzina duchów 0:00-2:59', godzinaDuchow(new Date(2026, 0, 1, 0, 5)) && godzinaDuchow(new Date(2026, 0, 1, 2, 59)) && !godzinaDuchow(new Date(2026, 0, 1, 3, 0)));
    spr('noc Kupały 23.06 od 18:00 do 24.06 6:00', nocKupaly(new Date(2026, 5, 23, 18, 0)) && nocKupaly(new Date(2026, 5, 24, 5, 59))
        && !nocKupaly(new Date(2026, 5, 23, 17, 59)) && !nocKupaly(new Date(2026, 5, 24, 6, 0)) && !nocKupaly(new Date(2026, 6, 23, 22, 0)));
    spr('zła data nie rzuca', !godzinaDuchow(null) && !nocKupaly('x'));
}

console.log('\nKOLEKCJA:');
{
    spr('Pierwsza Iskra: jedna technika', K('pierwszaIskra').warunek(stan({ techniki: zbior(['aard']) }), ctx()));
    spr('Pięć Żywiołów: 4/5 nie', !K('piecZywiolow').warunek(stan({ pieczecie: zbior(PIECZECIE.slice(0, 4)) }), ctx()));
    spr('Pięć Żywiołów: 5/5 tak', K('piecZywiolow').warunek(stan({ pieczecie: zbior(PIECZECIE) }), ctx()));
    spr('Pięć Żywiołów: postęp 4 z 5', JSON.stringify(K('piecZywiolow').postep(stan({ pieczecie: zbior(PIECZECIE.slice(0, 4)) }))) === '{"ile":4,"z":5}');
    spr('Mowa Gestów: wszystkie dwójki', K('mowaGestow').warunek(stan({ techniki: zbior(DWOJKI) }), ctx())
        && !K('mowaGestow').warunek(stan({ techniki: zbior(DWOJKI.slice(1)) }), ctx()));
    spr('Władca Zjawisk: wszystkie trójki', K('wladcaZjawisk').warunek(stan({ techniki: zbior(TROJKI) }), ctx())
        && !K('wladcaZjawisk').warunek(stan({ techniki: zbior(TROJKI.slice(1)) }), ctx()));
    const wezly = WEZLY.map(w => w.id);
    spr('Tkacz Węzłów: wszystkie węzły', K('tkaczWezlow').warunek(stan({ wezly: zbior(wezly) }), ctx())
        && !K('tkaczWezlow').warunek(stan({ wezly: zbior(wezly.slice(1)) }), ctx()));
    spr('Wszechwiedzący: techniki + węzły', K('wszechwiedzacy').warunek(stan({ techniki: zbior(TECHNIKI.map(t => t.id)), wezly: zbior(wezly) }), ctx())
        && !K('wszechwiedzacy').warunek(stan({ techniki: zbior(TECHNIKI.map(t => t.id)) }), ctx()));
}

console.log('\nMITY:');
{
    const h = (...e) => stan({ historia: e });
    spr('Perun kontra Weles w 15 s', K('perunKontraWeles').warunek(h(ev('technika', 'gromWZiemie', 86000), ev('technika', 'kolowrot', 100000)), ctx()));
    spr('Perun kontra Weles po 15 s nie', !K('perunKontraWeles').warunek(h(ev('technika', 'gromWZiemie', 84999), ev('technika', 'kolowrot', 100000)), ctx()));
    spr('Trójsplot: seria 2', K('trojsplot').warunek(stan({ splotSeria: 2 }), ctx()) && !K('trojsplot').warunek(stan({ splotSeria: 1 }), ctx()));
    spr('Ogień i Woda: Bania potem Tęcza', K('ogienIWoda').warunek(h(ev('technika', 'bania', 90000), ev('technika', 'tecza', 100000)), ctx())
        && !K('ogienIWoda').warunek(h(ev('technika', 'tecza', 90000), ev('technika', 'bania', 100000)), ctx()));
    spr('Burza nad Bagnem w 5 s', K('burzaNadBagnem').warunek(h(ev('wezel', 'przewodzenie', 96000), ev('wezel', 'burzaWMgle', 100000)), ctx())
        && !K('burzaNadBagnem').warunek(h(ev('wezel', 'przewodzenie', 94000), ev('wezel', 'burzaWMgle', 100000)), ctx()));
    spr('Noc Dziadów w 30 s', K('nocDziadow').warunek(h(ev('technika', 'dym', 71000), ev('wezel', 'latarnie', 100000)), ctx())
        && !K('nocDziadow').warunek(h(ev('technika', 'dym', 69000), ev('wezel', 'latarnie', 100000)), ctx()));
    const piec = PIECZECIE.map((id, i) => ev('pieczec', id, 81000 + i * 4000));
    spr('Krąg Żywiołów: 5 różnych w 20 s', K('kragZywiolow').warunek(h(...piec), ctx()));
    spr('Krąg Żywiołów: 4 różne nie', !K('kragZywiolow').warunek(h(...piec.slice(1), ev('pieczec', PIECZECIE[1], 99000)), ctx()));
    spr('mity bez now (koniec rundy) nie zachodzą', !K('burzaNadBagnem').warunek(h(ev('wezel', 'przewodzenie', 1), ev('wezel', 'burzaWMgle', 1)), ctx({ now: null })));
}

console.log('\nKUNSZT I OBRZĘD:');
{
    const pods = (nad = {}) => ({ wynik: 100, dlugoscS: 60, momenty: { serie: {}, techniki: {}, splecenia: 0 }, kragKoniec: null, podium: null, ...nad });
    spr('Podpalacz Nieba: Pożoga 100', K('podpalaczNieba').warunek(stan(), ctx({ pods: pods({ momenty: { serie: { pozoga: 100 }, techniki: {} } }) }))
        && !K('podpalaczNieba').warunek(stan(), ctx({ pods: pods({ momenty: { serie: { pozoga: 99 }, techniki: {} } }) })));
    spr('Król Szamanów: ≥2000/min', K('krolSzamanow').warunek(stan(), ctx({ pods: pods({ wynik: 2000 }) }))
        && !K('krolSzamanow').warunek(stan(), ctx({ pods: pods({ wynik: 1999 }) })));
    const manifest = ['a.m4a', 'b.m4a'];
    spr('Pieśniarz: wszystkie z manifestu', K('piesniarz').warunek(stan({ manifest, liczniki: { rundy: 2, piesni: ['b.m4a', 'a.m4a'], bogowie: [] } }), ctx()));
    spr('Pieśniarz: brak jednej nie', !K('piesniarz').warunek(stan({ manifest, liczniki: { rundy: 2, piesni: ['a.m4a', 'wlasna:x.mp3'], bogowie: [] } }), ctx()));
    spr('Pieśniarz: pusty manifest nie', !K('piesniarz').warunek(stan(), ctx()));
    spr('Pieśniarz: postęp 1 z 2', JSON.stringify(K('piesniarz').postep(stan({ manifest, liczniki: { rundy: 0, piesni: ['a.m4a'], bogowie: [] } }))) === '{"ile":1,"z":2}');
    spr('Wielki Krąg: koniec Kręgu 6', K('wielkiKrag').warunek(stan(), ctx({ pods: pods({ kragKoniec: true, podium: [1, 2, 3, 4, 5, 6] }) }))
        && !K('wielkiKrag').warunek(stan(), ctx({ pods: pods({ kragKoniec: true, podium: [1, 2, 3, 4, 5] }) }))
        && !K('wielkiKrag').warunek(stan(), ctx({ pods: pods({ kragKoniec: false, podium: null }) })));
    const t8 = Object.fromEntries(TECHNIKI.slice(0, 8).map(t => [t.id, 1]));
    const t7 = Object.fromEntries(TECHNIKI.slice(0, 7).map(t => [t.id, 1]));
    spr('Wszechstronny: 8 różnych', K('wszechstronny').warunek(stan(), ctx({ pods: pods({ momenty: { serie: {}, techniki: t8 } }) }))
        && !K('wszechstronny').warunek(stan(), ctx({ pods: pods({ momenty: { serie: {}, techniki: { ...t7, x: 0 } } }) })));
    spr('Dziesięć Obrzędów', K('dziesiecObrzedow').warunek(stan({ liczniki: { rundy: 10, piesni: [], bogowie: [] } }), ctx())
        && !K('dziesiecObrzedow').warunek(stan({ liczniki: { rundy: 9, piesni: [], bogowie: [] } }), ctx()));
    spr('Rekord Plemienia', K('rekordPlemienia').warunek(stan(), ctx({ wynikKsiegi: { nowyRekord: true } }))
        && !K('rekordPlemienia').warunek(stan(), ctx({ wynikKsiegi: { nowyRekord: false, pierwszyWpis: true } })));
}

console.log('\nSEKRETY:');
{
    const bog = (b) => stan({ liczniki: { rundy: 0, piesni: [], bogowie: b } });
    spr('Bóg wśród Ludzi', K('bogWsrodLudzi').warunek(bog(['perun']), ctx()) && !K('bogWsrodLudzi').warunek(bog([]), ctx()));
    spr('Pięciu Bogów', K('pieciuBogow').warunek(bog(['perun', 'swarog', 'stribog', 'mokosz', 'weles']), ctx())
        && !K('pieciuBogow').warunek(bog(['perun', 'swarog', 'stribog', 'mokosz']), ctx()));
    spr('Godzina Duchów', K('godzinaDuchow').warunek(stan(), ctx({ teraz: new Date(2026, 1, 1, 1, 0) })) && !K('godzinaDuchow').warunek(stan(), ctx()));
    spr('Noc Kupały', K('nocKupaly').warunek(stan(), ctx({ teraz: new Date(2026, 5, 23, 23, 0) })) && !K('nocKupaly').warunek(stan(), ctx()));
    const tarcze = (n) => stan({ historia: Array.from({ length: n }, (_, i) => ev('technika', 'kamiennaTarcza', 50000 + i * 20000)) });
    spr('Kamienny Mur: 3 w 60 s', K('kamiennyMur').warunek(tarcze(3), ctx({ now: 100000 })) && !K('kamiennyMur').warunek(tarcze(2), ctx({ now: 100000 })));
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-osiagniecia.mjs`
Expected: FAIL — `Cannot find module '.../js/osiagniecia.js'`

- [ ] **Step 3: Write minimal implementation** — `js/osiagniecia.js`

```js
/**
 * Kamienie Pamięci - osiągnięcia Księgi Plemienia.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. Rejestr deklaratywny (jak PRZYDOMKI w kronika.js):
 * nowy pomysł = nowy wpis. Warunek czyta STAN Pamięci (js/odkrycia.js) i KONTEKST
 * wywołania; `kiedy` mówi, przy jakim zdarzeniu kamień jest sprawdzany:
 *   zywo   - po pieczęci/technice/węźle (także swobodny taniec)
 *   runda  - po rundzie dokończonej do Kroniki (Esc się nie liczy)
 *   nick   - po rozpoznaniu nicku
 *   zawsze - przy każdym z powyższych (pory dnia)
 *
 * §2: kamienie nie dają punktów i NIGDY nie są odbierane. Progi ZGADNIĘTE - do
 * strojenia na żywym ciele, jak reszta liczb arcade.
 *
 * STRAŻNIK PRZY IMPORCIE: id technik i węzłów w warunkach idą przez T()/W(),
 * które RZUCAJĄ, gdy id zniknie z katalogu - każdy test importujący ten moduł
 * robi się wtedy czerwony, zamiast kamienia, którego nie da się zdobyć.
 */
import { PIECZECIE, DWOJKI, TROJKI, TECHNIKI, WEZLY } from './katalog.js';
import { tytulZaWynik } from './kronika.js';
import { BOGOWIE } from './jaja.js';

// Najdłuższe okno mitu (Kamienny Mur, 60 s) - Pamięć przycina historię do tego.
export const OKNO_HISTORII_MS = 60000;

const ID_TECHNIK = TECHNIKI.map(t => t.id);
const ID_WEZLOW = WEZLY.map(w => w.id);
const T = (id) => { if (!ID_TECHNIK.includes(id)) throw new Error(`osiagniecia.js: nieznana technika '${id}'`); return id; };
const W = (id) => { if (!ID_WEZLOW.includes(id)) throw new Error(`osiagniecia.js: nieznany węzeł '${id}'`); return id; };

const liczba = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const ile = (o, ids) => ids.filter(id => o?.[id]).length;
const wszystkie = (o, ids) => ids.length > 0 && ile(o, ids) === ids.length;
const tab = (h) => (Array.isArray(h) ? h : []);

/** b (najnowsze wystąpienie) poprzedzone przez a w ciągu oknoMs. */
export function poKolei(historia, [rA, a], [rB, b], oknoMs) {
    const h = tab(historia);
    for (let j = h.length - 1; j >= 0; j--) {
        if (h[j].rodzaj !== rB || h[j].id !== b) continue;
        for (let i = j - 1; i >= 0; i--) {
            if (h[j].t - h[i].t > oknoMs) break;
            if (h[i].rodzaj === rA && h[i].id === a) return true;
        }
        return false;   // starsze b sprawdzano, kiedy się zdarzyły
    }
    return false;
}

/** Każde z wymaganych zdarzeń wystąpiło w ostatnich oknoMs przed `now`. */
export function razem(historia, wymagane, oknoMs, now) {
    if (!Number.isFinite(now)) return false;
    const h = tab(historia);
    return wymagane.every(([r, id]) => h.some(e => e.rodzaj === r && e.id === id && e.t >= now - oknoMs && e.t <= now));
}

export function ileWOknie(historia, rodzaj, id, oknoMs, now) {
    if (!Number.isFinite(now)) return 0;
    return tab(historia).filter(e => e.rodzaj === rodzaj && e.id === id && e.t >= now - oknoMs && e.t <= now).length;
}

export function rozneWOknie(historia, rodzaj, oknoMs, now) {
    if (!Number.isFinite(now)) return 0;
    return new Set(tab(historia).filter(e => e.rodzaj === rodzaj && e.t >= now - oknoMs && e.t <= now).map(e => e.id)).size;
}

const dataOk = (d) => d instanceof Date && Number.isFinite(d.getTime());
export const godzinaDuchow = (d) => dataOk(d) && d.getHours() < 3;
// Kupalnocka: najkrótsza noc, z 23 na 24 czerwca (miesiące w Date od zera: czerwiec = 5).
export const nocKupaly = (d) => dataOk(d) && d.getMonth() === 5
    && ((d.getDate() === 23 && d.getHours() >= 18) || (d.getDate() === 24 && d.getHours() < 6));

export const KATEGORIE = [
    { id: 'kolekcja', naglowek: 'Kolekcja' },
    { id: 'mit', naglowek: 'Mity' },
    { id: 'kunszt', naglowek: 'Kunszt i obrzęd' },
    { id: 'sekret', naglowek: 'Sekrety plemienia' }
];

export const KAMIENIE = [
    // --- KOLEKCJA ---
    { id: 'pierwszaIskra', nazwa: 'Pierwsza Iskra', opis: 'Pierwsza technika zapisana w Księdze.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚲ',
      warunek: (s) => Object.keys(s.techniki ?? {}).length >= 1 },
    { id: 'piecZywiolow', nazwa: 'Pięć Żywiołów', opis: 'Każda z pięciu pieczęci złożona choć raz.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚠ',
      postep: (s) => ({ ile: ile(s.pieczecie, PIECZECIE), z: PIECZECIE.length }),
      warunek: (s) => wszystkie(s.pieczecie, PIECZECIE) },
    { id: 'mowaGestow', nazwa: 'Mowa Gestów', opis: 'Wszystkie gesty dwóch pieczęci.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚷ',
      postep: (s) => ({ ile: ile(s.techniki, DWOJKI), z: DWOJKI.length }),
      warunek: (s) => wszystkie(s.techniki, DWOJKI) },
    { id: 'wladcaZjawisk', nazwa: 'Władca Zjawisk', opis: 'Wszystkie zjawiska trzech pieczęci.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚺ',
      postep: (s) => ({ ile: ile(s.techniki, TROJKI), z: TROJKI.length }),
      warunek: (s) => wszystkie(s.techniki, TROJKI) },
    { id: 'tkaczWezlow', nazwa: 'Tkacz Węzłów', opis: 'Wszystkie Węzły Mocy splecione.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᚾ',
      postep: (s) => ({ ile: ile(s.wezly, ID_WEZLOW), z: ID_WEZLOW.length }),
      warunek: (s) => wszystkie(s.wezly, ID_WEZLOW) },
    { id: 'wszechwiedzacy', nazwa: 'Wszechwiedzący Wołchw', opis: 'Cały Zwój Technik i wszystkie Węzły Mocy.',
      kategoria: 'kolekcja', kiedy: 'zywo', runa: 'ᛗ',
      warunek: (s) => wszystkie(s.techniki, ID_TECHNIK) && wszystkie(s.wezly, ID_WEZLOW) },

    // --- MITY (okna ZGADNIĘTE) ---
    { id: 'perunKontraWeles', nazwa: 'Perun kontra Weles', opis: 'Grom w Ziemię, a po nim Kołowrót — w ciągu 15 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᚦ',
      warunek: (s) => poKolei(s.historia, ['technika', T('gromWZiemie')], ['technika', T('kolowrot')], 15000) },
    { id: 'trojsplot', nazwa: 'Trójsplot', opis: 'Trzy techniki splecione w jeden łańcuch.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛞ',
      warunek: (s) => liczba(s.splotSeria) >= 2 },
    { id: 'ogienIWoda', nazwa: 'Ogień i Woda', opis: 'Bania, a po niej Wstęga Mokoszy — w ciągu 15 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛚ',
      warunek: (s) => poKolei(s.historia, ['technika', T('bania')], ['technika', T('tecza')], 15000) },
    { id: 'burzaNadBagnem', nazwa: 'Burza nad Bagnem', opis: 'Przewodzenie i Burza w mgle w ciągu 5 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛇ',
      warunek: (s, c) => razem(s.historia, [['wezel', W('przewodzenie')], ['wezel', W('burzaWMgle')]], 5000, c?.now) },
    { id: 'nocDziadow', nazwa: 'Noc Dziadów', opis: 'Latarnie we mgle i Okadzenie w ciągu 30 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛈ',
      warunek: (s, c) => razem(s.historia, [['wezel', W('latarnie')], ['technika', T('dym')]], 30000, c?.now) },
    { id: 'kragZywiolow', nazwa: 'Krąg Żywiołów', opis: 'Pięć różnych pieczęci w ciągu 20 sekund.',
      kategoria: 'mit', kiedy: 'zywo', runa: 'ᛃ',
      warunek: (s, c) => rozneWOknie(s.historia, 'pieczec', 20000, c?.now) >= PIECZECIE.length },

    // --- KUNSZT I OBRZĘD (tylko rundy dokończone do Kroniki) ---
    { id: 'podpalaczNieba', nazwa: 'Podpalacz Nieba', opis: 'Pożoga na sto kłębów w jednej serii.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᚱ',
      warunek: (s, c) => liczba(c?.pods?.momenty?.serie?.[W('pozoga')]) >= 100 },
    { id: 'krolSzamanow', nazwa: 'Król Szamanów', opis: 'Tytuł Króla Szamanów w Kronice obrzędu.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᚨ',
      warunek: (s, c) => !!c?.pods && tytulZaWynik(c.pods.wynik, c.pods.dlugoscS).tytul === 'Król Szamanów' },
    { id: 'piesniarz', nazwa: 'Pieśniarz', opis: 'Każda pieśń plemienia zatańczona do końca.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᚹ',
      postep: (s) => ({ ile: tab(s.manifest).filter(p => tab(s.liczniki?.piesni).includes(p)).length, z: tab(s.manifest).length }),
      warunek: (s) => tab(s.manifest).length > 0 && tab(s.manifest).every(p => tab(s.liczniki?.piesni).includes(p)) },
    { id: 'wielkiKrag', nazwa: 'Wielki Krąg', opis: 'Krąg sześciu tancerzy zatańczony do końca.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛖ',
      warunek: (s, c) => c?.pods?.kragKoniec === true && tab(c.pods.podium).length >= 6 },
    { id: 'wszechstronny', nazwa: 'Wszechstronny', opis: 'Osiem różnych technik w jednej rundzie.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛜ',
      warunek: (s, c) => Object.values(c?.pods?.momenty?.techniki ?? {}).filter(n => liczba(n) > 0).length >= 8 },
    { id: 'dziesiecObrzedow', nazwa: 'Dziesięć Obrzędów', opis: 'Dziesięć rund zatańczonych do końca.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛁ',
      postep: (s) => ({ ile: Math.min(10, liczba(s.liczniki?.rundy)), z: 10 }),
      warunek: (s) => liczba(s.liczniki?.rundy) >= 10 },
    { id: 'rekordPlemienia', nazwa: 'Rekord Plemienia', opis: 'Pobity rekord w Księdze Plemienia.',
      kategoria: 'kunszt', kiedy: 'runda', runa: 'ᛒ',
      warunek: (s, c) => c?.wynikKsiegi?.nowyRekord === true },

    // --- SEKRETY (ukryte do zdobycia) ---
    { id: 'bogWsrodLudzi', nazwa: 'Bóg wśród Ludzi', opis: 'Zatańczono pod imieniem boga.',
      kategoria: 'sekret', sekret: true, kiedy: 'nick', runa: 'ᚢ',
      warunek: (s) => tab(s.liczniki?.bogowie).length >= 1 },
    { id: 'pieciuBogow', nazwa: 'Pięciu Bogów', opis: 'Każdy z pięciu bogów zatańczył przy tym ognisku.',
      kategoria: 'sekret', sekret: true, kiedy: 'nick', runa: 'ᚺ',
      warunek: (s) => BOGOWIE.every(b => tab(s.liczniki?.bogowie).includes(b)) },
    { id: 'godzinaDuchow', nazwa: 'Godzina Duchów', opis: 'Taniec między północą a trzecią nad ranem.',
      kategoria: 'sekret', sekret: true, kiedy: 'zawsze', runa: 'ᛇ',
      warunek: (s, c) => godzinaDuchow(c?.teraz) },
    { id: 'nocKupaly', nazwa: 'Noc Kupały', opis: 'Taniec w najkrótszą noc, z 23 na 24 czerwca.',
      kategoria: 'sekret', sekret: true, kiedy: 'zawsze', runa: 'ᚲ',
      warunek: (s, c) => nocKupaly(c?.teraz) },
    { id: 'kamiennyMur', nazwa: 'Kamienny Mur', opis: 'Trzy Kamienne Tarcze w ciągu minuty.',
      kategoria: 'sekret', sekret: true, kiedy: 'zywo', runa: 'ᚢ',
      warunek: (s, c) => ileWOknie(s.historia, 'technika', T('kamiennaTarcza'), 60000, c?.now) >= 3 }
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-osiagniecia.mjs`
Expected: wszystkie `✓`

- [ ] **Step 5: Commit**

```bash
git add js/osiagniecia.js tools/test-osiagniecia.mjs
git commit -m "Pamięć Plemienia: rejestr 24 Kamieni Pamięci ze strażnikiem id przy imporcie"
```

---

### Task 4: Pamięć odkryć (`Odkrycia`)

**Files:**
- Create: `js/odkrycia.js`
- Test: `tools/test-odkrycia.mjs`

**Interfaces:**
- Consumes: Task 1 (katalog), Task 2 (`ogonPieczeci`, `ogonyNakladajaSie`), Task 3 (`KAMIENIE`, `OKNO_HISTORII_MS`), `bogZNicku`, `BOGOWIE` (`js/jaja.js`)
- Produces:
  - `KLUCZ_ODKRYC = 'krolSzamanow.odkrycia.v1'`
  - `walidujOdkrycia(dane) → stan|null`
  - `nazwaOdkrycia(rodzaj, id) → string`
  - `class Odkrycia(pamiec?, {zegar?: () => Date})` z polami `pieczecie, techniki, wezly, kamienie, liczniki, obejrzane:Set<string>, historia, splotSeria, manifest, trwala` i metodami:
    - `pieczec(id, now) → Nowe[]`, `technika(kombo, now) → Nowe[]`, `reakcja(id, n, now) → Nowe[]`
    - `koniecRundy(pods, {wynikKsiegi?, piesn?}) → Nowe[]`, `nick(nick) → Nowe[]`
    - `ustawManifest(pliki: string[])`, `ma(rodzaj, id) → boolean`, `czyNowe(rodzaj, id)`, `ileNowych(rodzaj) → number`, `oznaczObejrzane(rodzaj, id)`
    - `postep() → {pieczecie,techniki,wezly,kamienie: {ile,z}}`, `zapiszJesliTrzeba()`, `eksportFragment() → object`, `scal(dane) → {ok, dodano}`
  - `Nowe = {rodzaj:'pieczec'|'technika'|'wezel'|'kamien', id:string}`

- [ ] **Step 1: Write the failing test** — `tools/test-odkrycia.mjs`

```js
/**
 * Pamięć Plemienia - odkrycia, zapis tylko przy zmianie, odporność na zepsute dane.
 *   node tools/test-odkrycia.mjs
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 */
import { Odkrycia, walidujOdkrycia, nazwaOdkrycia, KLUCZ_ODKRYC } from '../js/odkrycia.js';
import { KomboSilnik, KOMBOSY } from '../js/kombosy.js';
import { TECHNIKI } from '../js/katalog.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

function pamiec(start = {}) {
    const d = { ...start };
    const p = { d, zapisy: 0, getItem: (k) => d[k] ?? null, setItem: (k, v) => { p.zapisy++; d[k] = String(v); } };
    return p;
}
const zegar = () => new Date(2026, 9, 12, 15, 0);
const nowa = (p = pamiec()) => new Odkrycia(p, { zegar });
const ma = (lista, rodzaj, id) => lista.some(o => o.rodzaj === rodzaj && o.id === id);

/** Gra sekwencję pieczęci przez prawdziwy silnik kombosów (jak main.js). */
function zagraj(o, sekwencja, start = 1000, krok = 500) {
    const k = new KomboSilnik();
    const nowe = [];
    let t = start;
    for (const id of sekwencja) {
        nowe.push(...o.pieczec(id, t));
        const kombo = k.dodaj(id, t);
        if (kombo) nowe.push(...o.technika(kombo, t));
        t += krok;
    }
    return nowe;
}

console.log('ODKRYCIA:');
{
    const o = nowa();
    const nowe = zagraj(o, ['stribog', 'stribog']);
    spr('pierwsza pieczęć zwraca odkrycie pieczęci', ma(nowe, 'pieczec', 'stribog'));
    spr('combo zwraca odkrycie techniki', ma(nowe, 'technika', 'aard'));
    spr('pierwsza technika daje Pierwszą Iskrę', ma(nowe, 'kamien', 'pierwszaIskra'));
    spr('pieczęć odkryta raz, liczona dwa razy', nowe.filter(x => x.rodzaj === 'pieczec').length === 1 && o.pieczecie.stribog.n === 2);
    spr('drugi raz ta sama technika nie jest nowa', !ma(zagraj(o, ['stribog', 'stribog'], 90000), 'technika', 'aard'));
    spr('data pierwszego razu z zegara', o.techniki.aard.t === zegar().getTime());
}
{
    const o = nowa();
    const wariant = KOMBOSY.find(k => k.wariant);
    o.pieczec('swarog', 1); o.pieczec('mokosz', 2); o.pieczec('mokosz', 3); o.pieczec('stribog', 4);
    spr('wariant Tęczy odkrywa Tęczę', ma(o.technika(wariant, 4), 'technika', 'tecza') && !!o.techniki.tecza);
    spr('nieznana technika / pieczęć / węzeł = nic', o.technika({ id: 'x', sekwencja: ['a'] }, 5).length === 0
        && o.pieczec('x', 5).length === 0 && o.reakcja('x', 1, 5).length === 0);
    spr('śmieci nie rzucają', o.technika(null, 1).length === 0 && o.pieczec('swarog', NaN).length === 0 && o.reakcja('pozoga', NaN, 1).length === 0);
}

console.log('\nWĘZŁY:');
{
    const o = nowa();
    spr('n=0 nic nie odkrywa', o.reakcja('pozoga', 0, 1000).length === 0 && !o.wezly.pozoga);
    spr('pierwszy przejaw odkrywa węzeł', ma(o.reakcja('pozoga', 3, 1000), 'wezel', 'pozoga'));
    for (let t = 1016; t < 2000; t += 16) o.reakcja('pozoga', 1, t);
    spr('ciągły przejaw (co klatkę) liczy się raz', o.wezly.pozoga.n === 1);
    o.reakcja('pozoga', 1, 5000);
    spr('po przerwie > 1.5 s nowy przejaw', o.wezly.pozoga.n === 2);
    spr('historia węzła rzedzona (nie co klatkę)', o.historia.filter(e => e.id === 'pozoga').length < 10);
}

console.log('\nTRZYMANIE POZY I SPLOT:');
{
    const o = nowa();
    zagraj(o, ['weles', 'weles', 'weles', 'weles', 'weles'], 1000, 600);
    spr('trzymana ziemia: Tarcza liczona raz', o.techniki.kamiennaTarcza.n === 1);
    spr('trzymana ziemia: brak Kamiennego Muru', !o.kamienie.kamiennyMur);
    spr('trzymana ziemia: brak splotu', o.splotSeria === 0);
}
{
    const o = nowa();
    // Bania (mokosz,swarog) -> Tęcza (swarog,mokosz,stribog) -> Kurzawa (stribog,weles): dwa splecenia pod rząd.
    const nowe = zagraj(o, ['mokosz', 'swarog', 'mokosz', 'stribog', 'weles']);
    spr('łańcuch Bania -> Tęcza -> Kurzawa', !!o.techniki.bania && !!o.techniki.tecza && !!o.techniki.kurzawa);
    spr('Trójsplot', ma(nowe, 'kamien', 'trojsplot'));
    spr('Ogień i Woda (Bania, potem Tęcza)', ma(nowe, 'kamien', 'ogienIWoda'));
}
{
    const o = nowa();
    zagraj(o, ['weles', 'weles', 'weles'], 1000);
    zagraj(o, ['weles', 'weles', 'weles'], 20000);
    const nowe = zagraj(o, ['weles', 'weles', 'weles'], 40000);
    spr('trzy osobne Tarcze w minutę = Kamienny Mur', ma(nowe, 'kamien', 'kamiennyMur'));
}

console.log('\nKONIEC RUNDY, NICK, MANIFEST:');
{
    const o = nowa();
    o.ustawManifest(['a.m4a']);
    const pods = { wynik: 2000, dlugoscS: 60, momenty: { serie: {}, techniki: {} }, kragKoniec: null, podium: null };
    const nowe = o.koniecRundy(pods, { wynikKsiegi: { nowyRekord: true }, piesn: 'a.m4a' });
    spr('licznik rund', o.liczniki.rundy === 1);
    spr('Król Szamanów + Rekord + Pieśniarz', ma(nowe, 'kamien', 'krolSzamanow') && ma(nowe, 'kamien', 'rekordPlemienia') && ma(nowe, 'kamien', 'piesniarz'));
    o.koniecRundy(pods, { piesn: 'wlasna:x.mp3' });
    spr('własna pieśń nie trafia do pieśni plemienia', !o.liczniki.piesni.includes('wlasna:x.mp3'));
    spr('kamień nie jest zdobywany drugi raz', !ma(o.koniecRundy(pods, { wynikKsiegi: { nowyRekord: true } }), 'kamien', 'rekordPlemienia'));
    spr('nick boga', ma(o.nick('Perun 2'), 'kamien', 'bogWsrodLudzi') && o.liczniki.bogowie.includes('perun'));
    spr('zwykły nick nic', o.nick('Ola').length === 0);
    spr('koniecRundy na śmieciach', o.koniecRundy(null).length === 0);
}
{
    const o = new Odkrycia(pamiec(), { zegar: () => new Date(2026, 5, 23, 22, 0) });
    spr('Noc Kupały przy pierwszej pieczęci', ma(o.pieczec('mokosz', 1), 'kamien', 'nocKupaly'));
}

console.log('\nZAPIS TYLKO PRZY ZMIANIE:');
{
    const p = pamiec();
    const o = nowa(p);
    o.pieczec('mokosz', 1);
    const poOdkryciu = p.zapisy;
    spr('odkrycie zapisuje od razu', poOdkryciu >= 1 && p.d[KLUCZ_ODKRYC].includes('mokosz'));
    for (let t = 2; t < 200; t++) o.pieczec('mokosz', t * 7000);
    spr('same liczniki nie zapisują co zdarzenie', p.zapisy === poOdkryciu);
    o.zapiszJesliTrzeba();
    spr('zapiszJesliTrzeba zapisuje liczniki', p.zapisy === poOdkryciu + 1);
    o.zapiszJesliTrzeba();
    spr('drugi raz bez zmian nic nie pisze', p.zapisy === poOdkryciu + 1);
    const o2 = nowa(p);
    spr('wczytanie z pamięci', o2.pieczecie.mokosz?.n === o.pieczecie.mokosz.n && o2.trwala);
}

console.log('\nODPORNOŚĆ:');
{
    const rzuca = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    const o = new Odkrycia(rzuca, { zegar });
    spr('pamięć rzucająca: działa w procesie', ma(o.pieczec('perun', 1), 'pieczec', 'perun') && o.trwala === false);
    const pelna = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    const o2 = new Odkrycia(pelna, { zegar });
    o2.pieczec('perun', 1);
    spr('pełna pamięć: trwala=false, dalej działa', o2.trwala === false && !!o2.pieczecie.perun);
    spr('zepsuty JSON = start od zera', Object.keys(nowa(pamiec({ [KLUCZ_ODKRYC]: '{zepsute' })).techniki).length === 0);
    spr('bez pamięci (null) działa', new Odkrycia(null, { zegar }).pieczec('weles', 1).length > 0);
}
{
    const d = walidujOdkrycia({
        techniki: { aard: { n: 3, t: 5 }, usunietaTechnika: { n: 1, t: 1 }, ['__proto__']: { n: 1, t: 1 }, tecza: { n: 'x', t: 1 }, bania: { n: 1e30, t: 2 } },
        wezly: { pozoga: { n: -1, t: 1 }, syk: { n: 2, t: 3 } },
        kamienie: { trojsplot: { t: 9 }, nieznany: { t: 1 } },
        liczniki: { rundy: 'dużo', piesni: ['a', 5, 'a'], bogowie: ['perun', 'zeus'] },
        obejrzane: ['technika:aard', 'technika:nieznana', 'kamien:trojsplot', 7]
    });
    spr('znane id zostają', d.techniki.aard.n === 3 && d.wezly.syk.n === 2 && d.kamienie.trojsplot.t === 9);
    spr('usunięta technika i __proto__ odpadają', !('usunietaTechnika' in d.techniki) && Object.getPrototypeOf(d.techniki) === Object.prototype);
    spr('złe typy i ujemne odpadają', !d.techniki.tecza && !d.wezly.pozoga);
    spr('ogromne liczby przycięte', d.techniki.bania.n <= 1e9);
    spr('liczniki oczyszczone', d.liczniki.rundy === 0 && JSON.stringify(d.liczniki.piesni) === '["a"]' && JSON.stringify(d.liczniki.bogowie) === '["perun"]');
    spr('obejrzane tylko znane', JSON.stringify(d.obejrzane) === '["technika:aard","kamien:trojsplot"]');
    spr('nie-obiekt = null', walidujOdkrycia(null) === null && walidujOdkrycia([]) === null && walidujOdkrycia('x') === null);
}

console.log('\nSCALANIE (import Księgi):');
{
    const o = nowa();
    zagraj(o, ['stribog', 'stribog']);
    const nUzyc = o.techniki.aard.n;
    const wynik = o.scal({ techniki: { aard: { n: 99, t: 1 }, kurzawa: { n: 2, t: 7 } }, kamienie: { trojsplot: { t: 3 } }, liczniki: { rundy: 5, piesni: [], bogowie: ['weles'] } });
    spr('scal ok, dodano nowe', wynik.ok && wynik.dodano === 2);
    spr('max licznik, najwcześniejsza data', o.techniki.aard.n === Math.max(99, nUzyc) && o.techniki.aard.t === 1);
    spr('nic nie znika', !!o.pieczecie.stribog && !!o.kamienie.pierwszaIskra);
    spr('liczniki: max/suma zbiorów', o.liczniki.rundy === 5 && o.liczniki.bogowie.includes('weles'));
    spr('ten sam plik drugi raz nic nie dodaje', o.scal({ techniki: { kurzawa: { n: 2, t: 7 } } }).dodano === 0);
    spr('zły plik = ok:false', o.scal('x').ok === false);
}

console.log('\nOBEJRZANE I POSTĘP:');
{
    const o = nowa();
    zagraj(o, ['stribog', 'stribog']);
    spr('nowa technika jest nowa', o.czyNowe('technika', 'aard') && o.ileNowych('technika') === 1);
    o.oznaczObejrzane('technika', 'aard');
    spr('po obejrzeniu nie jest', !o.czyNowe('technika', 'aard') && o.ileNowych('technika') === 0);
    spr('nieodkryta nie jest „nowa"', !o.czyNowe('technika', 'tecza'));
    const p = o.postep();
    spr('postęp', p.techniki.ile === 1 && p.techniki.z === TECHNIKI.length && p.pieczecie.ile === 1 && p.kamienie.ile >= 1);
    spr('nazwy', nazwaOdkrycia('technika', 'aard') === 'Podmuch Striboga' && nazwaOdkrycia('wezel', 'pozoga') === 'Pożoga'
        && nazwaOdkrycia('pieczec', 'swarog') === 'Swaróg' && nazwaOdkrycia('kamien', 'trojsplot') === 'Trójsplot' && nazwaOdkrycia('x', 'y') === '');
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-odkrycia.mjs`
Expected: FAIL — `Cannot find module '.../js/odkrycia.js'`

- [ ] **Step 3: Write minimal implementation** — `js/odkrycia.js`

```js
/**
 * Pamięć Plemienia - co tancerze tej przeglądarki już odkryli.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. Pamięć wstrzykiwana (localStorage albo atrapa), jak
 * w js/ksiega.js. BRAK PAMIĘCI NIE JEST BŁĘDEM: odkrycia żyją wtedy do
 * zamknięcia karty, a `trwala` mówi UI, że ma o tym powiedzieć.
 *
 * WSPÓLNA DLA PRZEGLĄDARKI I LICZONA WSZĘDZIE - także w swobodnym tańcu, gdzie
 * Punktacja jest wyłączona. Dlatego Pamięć NIE czyta niczego z Punktacji: trzyma
 * własną historię pieczęci, a splot liczy tą samą funkcją (ogonyNakladajaSie).
 *
 * ZAPIS TYLKO PRZY ZMIANIE. Nowe odblokowanie zapisuje się od razu; same liczniki
 * użyć (reakcje strzelają co 60-150 ms!) czekają na zapiszJesliTrzeba() - koniec
 * rundy, Esc na Polanę, schowanie karty.
 *
 * TRWAŁA MIĘDZY RUNDAMI - celowo NIE w js/swiezeModuly.js.
 */
import { PIECZECIE, NAZWY_PIECZECI, TECHNIKI, WEZLY } from './katalog.js';
import { KAMIENIE, OKNO_HISTORII_MS } from './osiagniecia.js';
import { ogonPieczeci, ogonyNakladajaSie } from './punkty.js';
import { bogZNicku, BOGOWIE } from './jaja.js';

export const KLUCZ_ODKRYC = 'krolSzamanow.odkrycia.v1';
const MAX_HISTORII = 400;
const MAX_PIESNI = 64;
const MAX_N = 1e9;
// Węzeł strzela co klatkę, póki trwa. Nowy PRZEJAW = przerwa dłuższa niż ta
// (jak przerwaMs serii w REAKCJE); do historii mitów wpis najwyżej co ODSTEP.
const PRZERWA_WEZLA_MS = 1500;
const ODSTEP_WEZLA_MS = 250;

const ID = {
    pieczec: new Set(PIECZECIE),
    technika: new Set(TECHNIKI.map(t => t.id)),
    wezel: new Set(WEZLY.map(w => w.id)),
    kamien: new Set(KAMIENIE.map(k => k.id))
};
const SEKCJA = { pieczec: 'pieczecie', technika: 'techniki', wezel: 'wezly', kamien: 'kamienie' };
const NAZWY = {
    pieczec: NAZWY_PIECZECI,
    technika: Object.fromEntries(TECHNIKI.map(t => [t.id, t.nazwa])),
    wezel: Object.fromEntries(WEZLY.map(w => [w.id, w.nazwa])),
    kamien: Object.fromEntries(KAMIENIE.map(k => [k.id, k.nazwa]))
};

/** Czytelna nazwa odkrycia albo '' dla nieznanego. */
export function nazwaOdkrycia(rodzaj, id) {
    return (Object.hasOwn(NAZWY, rodzaj) && Object.hasOwn(NAZWY[rodzaj], id)) ? NAZWY[rodzaj][id] : '';
}

const liczbaOk = (v) => typeof v === 'number' && Number.isFinite(v);

function walidujSekcje(obj, dozwolone, zLicznikiem) {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    // Iterujemy po ZNANYCH id - `__proto__` ani usunięta technika nie mają jak wejść.
    for (const id of dozwolone) {
        const w = Object.hasOwn(obj, id) ? obj[id] : null;
        if (!w || typeof w !== 'object' || !liczbaOk(w.t)) continue;
        if (!zLicznikiem) { out[id] = { t: w.t }; continue; }
        if (!liczbaOk(w.n) || w.n < 0) continue;
        out[id] = { n: Math.min(MAX_N, Math.floor(w.n)), t: w.t };
    }
    return out;
}

const napisy = (a, max, filtr = () => true) => (Array.isArray(a)
    ? [...new Set(a.filter(s => typeof s === 'string' && s.length > 0 && s.length <= 200 && filtr(s)))].slice(0, max)
    : []);

/** @returns {object|null} oczyszczony stan albo null, gdy to w ogóle nie obiekt */
export function walidujOdkrycia(dane) {
    if (!dane || typeof dane !== 'object' || Array.isArray(dane)) return null;
    const l = dane.liczniki && typeof dane.liczniki === 'object' ? dane.liczniki : {};
    return {
        pieczecie: walidujSekcje(dane.pieczecie, ID.pieczec, true),
        techniki: walidujSekcje(dane.techniki, ID.technika, true),
        wezly: walidujSekcje(dane.wezly, ID.wezel, true),
        kamienie: walidujSekcje(dane.kamienie, ID.kamien, false),
        liczniki: {
            rundy: liczbaOk(l.rundy) && l.rundy >= 0 ? Math.min(MAX_N, Math.floor(l.rundy)) : 0,
            piesni: napisy(l.piesni, MAX_PIESNI),
            bogowie: napisy(l.bogowie, BOGOWIE.length, s => BOGOWIE.includes(s))
        },
        obejrzane: napisy(dane.obejrzane, 200, (s) => {
            const [r, id] = s.split(':');
            return Object.hasOwn(ID, r) && ID[r].has(id);
        })
    };
}

const pusty = () => walidujOdkrycia({});

export class Odkrycia {
    /**
     * @param {{getItem:Function, setItem:Function}|null} [pamiec]
     * @param {{zegar?: () => Date}} [opcje]  zegar wstrzykiwany do testów pór dnia
     */
    constructor(pamiec = null, { zegar = () => new Date() } = {}) {
        this._pamiec = pamiec ?? null;
        this._zegar = zegar;
        this.trwala = false;
        this._brudne = false;
        this.manifest = [];
        this.historia = [];            // [{rodzaj, id, t}] - zdarzenia na żywo do mitów (performance.now)
        this.splotSeria = 0;           // ile spleceń pod rząd (Trójsplot = 2)
        this._historiaPieczeci = [];   // [{id, t}] - do ogonów technik
        this._poprzedniOgon = null;    // {id, t:Set}
        this._wezelOstatnio = {};
        this._wezelWpis = {};
        this._ustaw(pusty());
        this._wczytaj();
    }

    _ustaw(d) {
        this.pieczecie = d.pieczecie;
        this.techniki = d.techniki;
        this.wezly = d.wezly;
        this.kamienie = d.kamienie;
        this.liczniki = d.liczniki;
        this.obejrzane = new Set(d.obejrzane);
    }

    _wczytaj() {
        if (!this._pamiec) return;
        let surowe;
        try {
            surowe = this._pamiec.getItem(KLUCZ_ODKRYC);
            this.trwala = true;
        } catch {
            return;   // pamięć niedostępna: Pamięć działa w procesie
        }
        if (!surowe) return;
        let d = null;
        try { d = walidujOdkrycia(JSON.parse(surowe)); } catch { d = null; }
        if (d) this._ustaw(d);   // zepsuty JSON: od zera, kolejny zapis go nadpisze
    }

    _dane() {
        return {
            wersja: 1, pieczecie: this.pieczecie, techniki: this.techniki, wezly: this.wezly,
            kamienie: this.kamienie, liczniki: this.liczniki, obejrzane: [...this.obejrzane]
        };
    }

    zapiszJesliTrzeba() {
        if (!this._brudne) return;
        this._brudne = false;
        if (!this._pamiec || !this.trwala) return;   // po pierwszej awarii nie męczymy pamięci
        try {
            this._pamiec.setItem(KLUCZ_ODKRYC, JSON.stringify(this._dane()));
        } catch {
            this.trwala = false;
        }
    }

    _teraz() {
        const d = this._zegar();
        return d instanceof Date && Number.isFinite(d.getTime()) ? d : new Date(0);
    }

    _odkryj(rodzaj, id, nowe) {
        const s = this[SEKCJA[rodzaj]];
        this._brudne = true;
        if (s[id]) { s[id].n = Math.min(MAX_N, s[id].n + 1); return; }
        s[id] = { n: 1, t: this._teraz().getTime() };
        nowe.push({ rodzaj, id });
    }

    _wHistorii(rodzaj, id, now) {
        this.historia.push({ rodzaj, id, t: now });
        const od = now - OKNO_HISTORII_MS;
        while (this.historia.length && (this.historia[0].t < od || this.historia.length > MAX_HISTORII)) this.historia.shift();
    }

    /** Sprawdza kamienie dla danego zdarzenia; nowe odblokowanie = zapis od razu. */
    _zamknij(nowe, kiedy, now, extra = {}) {
        const ctx = { teraz: this._teraz(), now, ...extra };
        for (const k of KAMIENIE) {
            if (this.kamienie[k.id] || (k.kiedy !== kiedy && k.kiedy !== 'zawsze')) continue;
            let tak = false;
            try { tak = k.warunek(this, ctx) === true; } catch { tak = false; }
            if (!tak) continue;
            this.kamienie[k.id] = { t: ctx.teraz.getTime() };
            nowe.push({ rodzaj: 'kamien', id: k.id });
        }
        if (nowe.length) { this._brudne = true; this.zapiszJesliTrzeba(); }
        return nowe;
    }

    pieczec(id, now) {
        if (!ID.pieczec.has(id) || !liczbaOk(now)) return [];
        const nowe = [];
        this._historiaPieczeci.push({ id, t: now });
        if (this._historiaPieczeci.length > 16) this._historiaPieczeci.shift();
        this._odkryj('pieczec', id, nowe);
        this._wHistorii('pieczec', id, now);
        return this._zamknij(nowe, 'zywo', now);
    }

    /** Wołać PO pieczec() tej samej pieczęci (ogon musi ją już zawierać) - jak w punkty.js. */
    technika(kombo, now) {
        const id = kombo?.id;
        if (!ID.technika.has(id) || !liczbaOk(now) || !Array.isArray(kombo.sekwencja)) return [];
        const ogon = ogonPieczeci(this._historiaPieczeci, kombo.sekwencja.length);
        const naklada = ogonyNakladajaSie(ogon, this._poprzedniOgon?.t);
        const trzymanie = naklada && this._poprzedniOgon.id === id;
        this._poprzedniOgon = { id, t: ogon };
        // TRZYMANIE JEDNEJ POZY: ta sama technika z ogonem dzielącym pieczęć z poprzednią
        // to to samo wejście, nie nowe użycie (ta sama reguła co w punkty.js).
        if (trzymanie) return [];
        this.splotSeria = naklada ? this.splotSeria + 1 : 0;
        const nowe = [];
        this._odkryj('technika', id, nowe);
        this._wHistorii('technika', id, now);
        return this._zamknij(nowe, 'zywo', now);
    }

    /** n = jednostki reakcji z tej klatki (te same liczby, które dostaje punkty.reakcja). */
    reakcja(id, n, now) {
        if (!ID.wezel.has(id) || !liczbaOk(n) || n <= 0 || !liczbaOk(now)) return [];
        const ost = this._wezelOstatnio[id];
        const wpis = this._wezelWpis[id];
        this._wezelOstatnio[id] = now;
        const nowe = [];
        if (ost === undefined || now - ost > PRZERWA_WEZLA_MS) this._odkryj('wezel', id, nowe);
        else if (wpis !== undefined && now - wpis < ODSTEP_WEZLA_MS) return [];
        this._wezelWpis[id] = now;
        this._wHistorii('wezel', id, now);
        return this._zamknij(nowe, 'zywo', now);
    }

    ustawManifest(pliki) {
        this.manifest = Array.isArray(pliki) ? pliki.filter(p => typeof p === 'string' && p.length > 0) : [];
    }

    /**
     * Runda dokończona do Kroniki (NIE Esc). `piesn` = plik pieśni Obrzędu albo null;
     * liczy się tylko pieśń z manifestu (własne i YouTube nie przesuwają celu).
     */
    koniecRundy(pods, { wynikKsiegi = null, piesn = null } = {}) {
        if (!pods || typeof pods !== 'object') return [];
        this.liczniki.rundy = Math.min(MAX_N, this.liczniki.rundy + 1);
        if (typeof piesn === 'string' && this.manifest.includes(piesn)
            && !this.liczniki.piesni.includes(piesn) && this.liczniki.piesni.length < MAX_PIESNI) {
            this.liczniki.piesni.push(piesn);
        }
        this._brudne = true;
        const nowe = this._zamknij([], 'runda', null, { pods, wynikKsiegi });
        this.zapiszJesliTrzeba();
        return nowe;
    }

    nick(nick) {
        const bog = bogZNicku(nick);
        if (!bog) return [];
        if (!this.liczniki.bogowie.includes(bog)) { this.liczniki.bogowie.push(bog); this._brudne = true; }
        const nowe = this._zamknij([], 'nick', null);
        this.zapiszJesliTrzeba();
        return nowe;
    }

    ma(rodzaj, id) { return Object.hasOwn(SEKCJA, rodzaj) && !!this[SEKCJA[rodzaj]][id]; }
    czyNowe(rodzaj, id) { return this.ma(rodzaj, id) && !this.obejrzane.has(`${rodzaj}:${id}`); }
    ileNowych(rodzaj) {
        if (!Object.hasOwn(SEKCJA, rodzaj)) return 0;
        return Object.keys(this[SEKCJA[rodzaj]]).filter(id => this.czyNowe(rodzaj, id)).length;
    }
    oznaczObejrzane(rodzaj, id) {
        if (!this.czyNowe(rodzaj, id)) return;
        this.obejrzane.add(`${rodzaj}:${id}`);
        this._brudne = true;
        this.zapiszJesliTrzeba();
    }

    postep() {
        const p = (rodzaj) => ({ ile: Object.keys(this[SEKCJA[rodzaj]]).length, z: ID[rodzaj].size });
        return { pieczecie: p('pieczec'), techniki: p('technika'), wezly: p('wezel'), kamienie: p('kamien') };
    }

    eksportFragment() { return JSON.parse(JSON.stringify(this._dane())); }

    /** Import SCALA: suma zbiorów, max liczników, najwcześniejsza data. Nigdy nie nadpisuje. */
    scal(dane) {
        const d = walidujOdkrycia(dane);
        if (!d) return { ok: false, dodano: 0 };
        let dodano = 0;
        for (const s of ['pieczecie', 'techniki', 'wezly', 'kamienie']) {
            for (const [id, w] of Object.entries(d[s])) {
                const m = this[s][id];
                if (!m) { this[s][id] = { ...w }; dodano++; continue; }
                if ('n' in w) m.n = Math.max(m.n, w.n);
                m.t = Math.min(m.t, w.t);
            }
        }
        this.liczniki.rundy = Math.max(this.liczniki.rundy, d.liczniki.rundy);
        this.liczniki.piesni = [...new Set([...this.liczniki.piesni, ...d.liczniki.piesni])].slice(0, MAX_PIESNI);
        this.liczniki.bogowie = [...new Set([...this.liczniki.bogowie, ...d.liczniki.bogowie])];
        for (const o of d.obejrzane) this.obejrzane.add(o);
        this._brudne = true;
        this.zapiszJesliTrzeba();
        return { ok: true, dodano };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-odkrycia.mjs`
Expected: wszystkie `✓`. Jeśli „łańcuch Bania -> Tęcza -> Kurzawa" nie przechodzi, sprawdź w `js/kombosy.js`, czy przy `KomboSilnik` z oknem 6500 ms i krokiem 500 ms sekwencja daje dokładnie te trzy techniki (wypisz `kombo.id` w `zagraj`); popraw sekwencję testu, nie logikę.

- [ ] **Step 5: Commit**

```bash
git add js/odkrycia.js tools/test-odkrycia.mjs
git commit -m "Pamięć Plemienia: Odkrycia - trwała kolekcja, kamienie, zapis tylko przy zmianie, scalanie"
```

---

### Task 5: Emblematy (16 rysunków SVG + legendy) i ich rysowanie

**Files:**
- Create: `js/emblematy.js` (dane), `js/emblematDom.js` (SVG do DOM), `tools/emblematy.html` (arkusz do przeglądu §7)
- Test: `tools/test-emblematy.mjs`

**Interfaces:**
- Consumes: Task 1 (`TECHNIKI`, `WEZLY`), Task 3 (`KAMIENIE`), `glif`, `ZAKAZANE` (`js/glify.js`)
- Produces:
  - `EMBLEMATY: Record<idTechniki, {svg:string, legenda:string}>`
  - `WEZLY_EMBLEMATY: Record<idWezla, {skladowe:[idTechniki, idTechniki], legenda:string}>`
  - `svgEmblematu(rodzaj, id) → string` (wnętrze `<svg viewBox="0 0 64 64">`; `rodzaj` ∈ `technika|wezel|pieczec|kamien|sekret`)
  - `rysujEmblemat(doc, rodzaj, id) → SVGSVGElement` z klasą `emblemat emblemat-<rodzaj>`

- [ ] **Step 1: Write the failing test** — `tools/test-emblematy.mjs`

```js
/**
 * Emblematy - strażnik dwustronny (każda technika i węzeł ma rysunek + legendę,
 * żaden wpis nie wisi bez techniki) i zakaz §7.
 *   node tools/test-emblematy.mjs
 * Przegląd WZROKOWY pod §7: otwórz tools/emblematy.html przez serwer statyczny.
 */
import { EMBLEMATY, WEZLY_EMBLEMATY, svgEmblematu } from '../js/emblematy.js';
import { TECHNIKI, WEZLY, PIECZECIE } from '../js/katalog.js';
import { KAMIENIE } from '../js/osiagniecia.js';
import { ZAKAZANE } from '../js/glify.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const DOZWOLONE_TAGI = ['path', 'circle', 'ellipse', 'g', 'text'];
const czyste = (s) => {
    const tagi = [...s.matchAll(/<\/?\s*([a-zA-Z]+)/g)].map(m => m[1]);
    return tagi.every(t => DOZWOLONE_TAGI.includes(t)) && !/\son[a-z]+\s*=/i.test(s) && !/javascript:/i.test(s) && !/href/i.test(s);
};

console.log('STRAŻNIK DWUSTRONNY:');
for (const t of TECHNIKI) {
    const e = EMBLEMATY[t.id];
    spr(`technika '${t.id}' ma rysunek i legendę`, !!e && e.svg.includes('<') && typeof e.legenda === 'string' && e.legenda.length > 10);
}
spr('żaden emblemat nie wisi bez techniki', Object.keys(EMBLEMATY).every(id => TECHNIKI.some(t => t.id === id)));
for (const w of WEZLY) {
    const e = WEZLY_EMBLEMATY[w.id];
    spr(`węzeł '${w.id}' ma dwie składowe-techniki i legendę`, !!e && e.skladowe.length === 2
        && e.skladowe.every(id => !!EMBLEMATY[id]) && e.skladowe[0] !== e.skladowe[1] && e.legenda.length > 10);
}
spr('żaden węzeł nie wisi bez reakcji', Object.keys(WEZLY_EMBLEMATY).every(id => WEZLY.some(w => w.id === id)));

console.log('\nBEZPIECZEŃSTWO I §7:');
const wszystkie = [
    ...TECHNIKI.map(t => ['technika', t.id]), ...WEZLY.map(w => ['wezel', w.id]),
    ...PIECZECIE.map(id => ['pieczec', id]), ...KAMIENIE.map(k => ['kamien', k.id]), ['sekret', 'x']
];
for (const [r, id] of wszystkie) {
    const s = svgEmblematu(r, id);
    spr(`${r}:${id} niepusty, tylko dozwolone tagi, bez zdarzeń/linków`, s.length > 0 && czyste(s));
    spr(`${r}:${id} bez run ZAKAZANYCH`, ZAKAZANE.every(z => !s.includes(z)));
}
spr('nieznane = pusty łańcuch', svgEmblematu('technika', 'nieznana') === '' && svgEmblematu('x', 'y') === '');

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-emblematy.mjs`
Expected: FAIL — `Cannot find module '.../js/emblematy.js'`

- [ ] **Step 3: Write implementation** — `js/emblematy.js`

```js
/**
 * Emblematy Zwoju Technik - ręcznie rysowane SVG (viewBox 64×64, kreska
 * currentColor, wypełnienie z CSS: brak) i jednozdaniowe legendy.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * CZYSTE DANE, BEZ DOM. Łańcuchy są STATYCZNE i z repo - nigdy dane gracza -
 * dlatego wolno je wstawić jako znaczniki SVG (js/emblematDom.js).
 *
 * ZAKAZ §7 (GEMINI.md): żadnych obrotowo symetrycznych figur z zagiętymi lub
 * spiralnymi ramionami - swarzyca i kołowrót zostały zawłaszczone przez skrajną
 * prawicę. Dlatego Kołowrót to WRZECIONO prządki, a wiry (Kurzawa i węzły z nią)
 * to LEJ/trąba, nigdy koło słoneczne. Każdy nowy rysunek - przegląd w
 * tools/emblematy.html przed commitem.
 *
 * WĘZŁY NIE MAJĄ WŁASNYCH RYSUNKÓW: emblemat węzła to dwa emblematy technik
 * splecione nicią (svgEmblematu('wezel', ...)).
 */
import { glif } from './glify.js';
import { KAMIENIE } from './osiagniecia.js';

const kropla = (x, y) => `<path d="M${x} ${y}a5 5 0 0 1-5-5c0-4 5-9 5-9s5 5 5 9a5 5 0 0 1-5 5z"/>`;

export const EMBLEMATY = {
    tecza: {
        svg: '<path d="M8 46a24 24 0 0 1 48 0"/><path d="M15 46a17 17 0 0 1 34 0"/><path d="M22 46a10 10 0 0 1 20 0"/><path d="M4 52h56"/>',
        legenda: 'Mokosz rozpina wstęgę między ogniem, wodą a wiatrem.'
    },
    gromWOgniu: {
        svg: '<path d="M32 60c-12 0-19-9-17-20 1-8 8-12 9-22 6 5 8 11 8 16 3-3 5-8 4-13 9 7 14 15 13 24-1 9-7 15-17 15z"/><path d="M35 30l-7 13h7l-5 11"/>',
        legenda: 'Iskra Peruna wpada w kuźnię Swaroga — palec zapłonie.'
    },
    aard: {
        svg: '<path d="M6 20h32a7 7 0 1 0-7-7"/><path d="M6 32h44a7 7 0 1 1-7 7"/><path d="M6 44h26a6 6 0 1 0-6-6"/>',
        legenda: 'Dwa tchnienia Striboga złożone w jeden podmuch.'
    },
    gromWZiemie: {
        svg: '<path d="M38 4L26 26h11l-9 20"/><path d="M4 46h56"/><path d="M28 46l-7 12M28 46l3 13M28 46l13 7"/>',
        legenda: 'Perun bije w rozgrzaną skorupę Welesa — odwieczny spór.'
    },
    kolowrot: {
        // WRZECIONO prządki losu, nie koło (§7).
        svg: '<path d="M32 4v56"/><path d="M32 10c6 6 7 16 0 26c-7-10-6-20 0-26z"/><ellipse cx="32" cy="46" rx="13" ry="4"/><path d="M38 20c8 2 14 8 18 16"/>',
        legenda: 'Prządka losu toczy wrzeciono, gdy burza ucichnie.'
    },
    dym: {
        svg: '<path d="M16 50h32l-5 9H21z"/><path d="M27 46c-7-6 7-10 0-17s7-10 0-17"/><path d="M38 46c-6-5 6-9 0-15s5-8 2-12"/>',
        legenda: 'Żar niesiony wiatrem — dym, który można podpalić.'
    },
    kamiennaTarcza: {
        svg: '<circle cx="32" cy="20" r="5"/><path d="M32 25v20M23 33h18M32 45l-6 12M32 45l6 12"/><path d="M6 30l5-5 5 2-1 6-7 1z"/><path d="M48 24l6-2 4 5-4 4-5-2z"/><path d="M10 50l6-3 4 4-4 4-5-1z"/><path d="M45 48l6-2 3 5-5 3-4-2z"/>',
        legenda: 'Trzykroć wezwany Weles otacza tancerza kamieniem.'
    },
    kurzawa: {
        // LEJ pyłu, nie spirala (§7).
        svg: '<path d="M8 10c4 14 14 30 24 48"/><path d="M56 10c-4 14-14 30-24 48"/><path d="M14 18h34M18 28h24M22 38h16M26 47h9"/><circle cx="10" cy="44" r="1.5"/><circle cx="54" cy="40" r="1.5"/><circle cx="50" cy="52" r="1.5"/>',
        legenda: 'Wiatr porywa ziemię w lej pyłu wokół tancerza.'
    },
    lukPeruna: {
        svg: '<path d="M12 56V28"/><path d="M52 56V28"/><path d="M12 30l7-6 5 8 6-9 5 9 6-8 5 7 6-5"/><path d="M8 22l-3-3M56 22l3-3"/>',
        legenda: 'Woda przewodzi piorun — łuk skacze z dłoni do dłoni.'
    },
    kregiMokoszy: {
        svg: '<circle cx="32" cy="12" r="4"/><path d="M32 16v28"/><ellipse cx="32" cy="46" rx="8" ry="3"/><ellipse cx="32" cy="46" rx="17" ry="6"/><ellipse cx="32" cy="46" rx="27" ry="10"/>',
        legenda: 'Mać Ziemia Wilgotna — stoisz po pas w wodzie.'
    },
    mglaMokoszy: {
        svg: '<path d="M26 26a6 6 0 0 1 12 0"/><path d="M4 28q6-6 12 0t12 0 12 0 12 0 12 0"/><path d="M4 40q6-6 12 0t12 0 12 0 12 0 12 0"/><path d="M10 52q6-6 12 0t12 0 12 0 12 0"/>',
        legenda: 'Wiatr niesie wilgoć — tancerz wynurza się z mgły.'
    },
    bania: {
        svg: '<path d="M16 60c0-11 7-17 16-17s16 6 16 17"/><circle cx="32" cy="34" r="7"/><path d="M25 22c-4-4 4-7 0-12M32 22c-4-4 4-7 0-12M39 22c-4-4 4-7 0-12"/>',
        legenda: 'Woda na rozgrzane ciało — bucha para jak w bani.'
    },
    grzmot: {
        svg: '<path d="M35 8l-9 22h10l-7 24"/><path d="M18 20a16 16 0 0 0 0 24"/><path d="M46 20a16 16 0 0 1 0 24"/><path d="M10 14a24 24 0 0 0 0 36"/><path d="M54 14a24 24 0 0 1 0 36"/>',
        legenda: 'Błyskawica rozdziera powietrze — fala bije z piersi.'
    },
    zawierucha: {
        svg: '<path d="M4 20c14 5 32 3 50-6"/><path d="M4 34c16 5 36 2 56-8"/><path d="M8 48c14 4 28 1 42-7"/><path d="M52 44l4-2 2 4-4 2z"/><circle cx="58" cy="30" r="1.5"/><circle cx="46" cy="54" r="1.5"/>',
        legenda: 'Ziemia oddaje pył wiatrowi — poryw przez cały kadr.'
    },
    bledneOgniki: {
        svg: `${kropla(16, 38)}${kropla(32, 26)}${kropla(48, 40)}<path d="M4 56q28-14 56 0"/>`,
        legenda: 'Weles wypuszcza duszyczki, Swaróg je rozpala.'
    },
    dodola: {
        svg: '<path d="M16 32a8 8 0 0 1 1-16 12 12 0 0 1 22-4 9 9 0 0 1 9 20z"/><path d="M20 40l-3 8M30 40l-3 8M40 40l-3 8M25 52l-3 8M35 52l-3 8"/>',
        legenda: 'Woda w misie, wiatr niesie ją w chmury — pada deszcz.'
    }
};

export const WEZLY_EMBLEMATY = {
    pozoga: { skladowe: ['dym', 'gromWOgniu'], legenda: 'Ogień trafia w dym — chmura wybucha kłąb po kłębie.' },
    rozwianie: { skladowe: ['dym', 'aard'], legenda: 'Podmuch rozpędza dym na cztery strony.' },
    wirDymu: { skladowe: ['dym', 'kurzawa'], legenda: 'Kurzawa wciąga dym w swoje pasy.' },
    ognistyWir: { skladowe: ['kurzawa', 'gromWOgniu'], legenda: 'Płonąca trąba — ogień w lej Kurzawy.' },
    przewodzenie: { skladowe: ['lukPeruna', 'kregiMokoszy'], legenda: 'Łuk Peruna biegnie po kręgach wody.' },
    burzaWMgle: { skladowe: ['mglaMokoszy', 'lukPeruna'], legenda: 'Mgła błyska od wyładowań.' },
    rozdarcie: { skladowe: ['grzmot', 'mglaMokoszy'], legenda: 'Grzmot rozdziera mgłę i pył.' },
    zawianie: { skladowe: ['zawierucha', 'mglaMokoszy'], legenda: 'Zawierucha znosi mgłę i pył w swoją stronę.' },
    latarnie: { skladowe: ['bledneOgniki', 'mglaMokoszy'], legenda: 'Ogniki świecą we mgle jak latarnie.' },
    wirOgnikow: { skladowe: ['kurzawa', 'bledneOgniki'], legenda: 'Kurzawa porywa ogniki na orbitę.' },
    teczaPoDeszczu: { skladowe: ['dodola', 'tecza'], legenda: 'Po deszczu Dodoli wschodzi Wstęga Mokoszy.' },
    burzaWDeszczu: { skladowe: ['dodola', 'lukPeruna'], legenda: 'Krople zapalają się światłem pioruna.' },
    syk: { skladowe: ['dodola', 'gromWOgniu'], legenda: 'Deszcz gasi płonący palec z sykiem pary.' }
};

const KAMIEN = '<path class="kamien-obrys" d="M14 50c-6-8-4-26 6-34 8-6 20-6 28 2 8 8 9 24 2 32-8 8-28 8-36 0z"/>';
const PEKNIECIE = '<path d="M30 12l-4 12 7 6-6 10 5 12"/>';
const runa = (znak) => (znak ? `<text x="32" y="34" text-anchor="middle" dominant-baseline="central" class="emblemat-runa">${znak}</text>` : '');

/** Wnętrze <svg viewBox="0 0 64 64"> dla odkrycia; '' dla nieznanego. */
export function svgEmblematu(rodzaj, id) {
    if (rodzaj === 'technika') return Object.hasOwn(EMBLEMATY, id) ? EMBLEMATY[id].svg : '';
    if (rodzaj === 'wezel') {
        if (!Object.hasOwn(WEZLY_EMBLEMATY, id)) return '';
        const [a, b] = WEZLY_EMBLEMATY[id].skladowe;
        return `<g class="skladowa" transform="translate(1 1) scale(.56)">${EMBLEMATY[a].svg}</g>`
            + `<g class="skladowa" transform="translate(27 27) scale(.56)">${EMBLEMATY[b].svg}</g>`
            + '<path class="nic" d="M6 58C22 46 42 18 58 6"/>';
    }
    if (rodzaj === 'pieczec') return runa(glif(id));
    if (rodzaj === 'kamien') {
        const k = KAMIENIE.find(x => x.id === id);
        return k ? KAMIEN + runa(k.runa) : '';
    }
    if (rodzaj === 'sekret') return KAMIEN + PEKNIECIE;
    return '';
}
```

`js/emblematDom.js`:

```js
/**
 * Emblemat jako element <svg> - wspólne dla Zwoju (js/zwojUi.js), powiadomienia
 * na żywo (js/odkryciaHud.js) i Kroniki. Nic na poziomie modułu nie dotyka DOM.
 * Wnętrze to statyczne łańcuchy z js/emblematy.js (nigdy dane gracza).
 */
import { svgEmblematu } from './emblematy.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function rysujEmblemat(doc, rodzaj, id) {
    const s = doc.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 64 64');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('class', `emblemat emblemat-${rodzaj}`);
    s.innerHTML = svgEmblematu(rodzaj, id);
    return s;
}
```

`tools/emblematy.html` (arkusz do przeglądu §7 i strojenia wyglądu):

```html
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Emblematy Zwoju — przegląd §7</title>
  <link rel="stylesheet" href="../style.css" />
  <link href="https://fonts.googleapis.com/css2?family=Bona+Nova&family=Noto+Sans+Runic&display=swap" rel="stylesheet" />
  <style>
    body { background: var(--wegiel); color: var(--kosc); padding: 1rem; overflow: auto; }
    .arkusz { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 1rem; }
    figure { text-align: center; }
    figure .emblemat { width: 6rem; height: 6rem; color: var(--zloto); }
    figure.zweglona .emblemat { color: #160e09; filter: drop-shadow(0 0 1.5px rgba(255, 122, 26, .8)); }
  </style>
</head>
<body>
  <h1>Emblematy — sprawdź każdy pod §7 (bez swarzycy/kołowrotu)</h1>
  <div class="arkusz" id="a"></div>
  <script type="module">
    import { rysujEmblemat } from '../js/emblematDom.js';
    import { TECHNIKI, WEZLY } from '../js/katalog.js';
    const a = document.getElementById('a');
    const dodaj = (r, id, nazwa, zw) => {
      const f = document.createElement('figure'); if (zw) f.className = 'zweglona';
      const c = document.createElement('figcaption'); c.textContent = nazwa + (zw ? ' (zwęglony)' : '');
      f.append(rysujEmblemat(document, r, id), c); a.appendChild(f);
    };
    for (const t of TECHNIKI) { dodaj('technika', t.id, t.nazwa, false); dodaj('technika', t.id, t.nazwa, true); }
    for (const w of WEZLY) dodaj('wezel', w.id, w.nazwa, false);
    dodaj('kamien', 'trojsplot', 'kamień', false); dodaj('sekret', 'x', 'sekret', false);
  </script>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-emblematy.mjs`
Expected: wszystkie `✓`

- [ ] **Step 5: Przegląd wzrokowy §7**

Run: `python3 -m http.server 8765 --directory /Users/whomean/Documents/antigravity/powerball-app` (w tle), otwórz `http://localhost:8765/tools/emblematy.html` (claude-in-chrome: `tabs_create_mcp` + `computer` screenshot).
Sprawdź każdy rysunek: (a) czytelny w 6rem i zwęglony, (b) **żadnej figury obrotowo symetrycznej z zagiętymi/spiralnymi ramionami**, (c) ścieżki nie wychodzą poza 64×64. Rysunek, który wygląda źle, popraw w `EMBLEMATY` (zachowując zakaz), i powtórz Step 4. Zatrzymaj serwer.

- [ ] **Step 6: Commit**

```bash
git add js/emblematy.js js/emblematDom.js tools/emblematy.html tools/test-emblematy.mjs
git commit -m "Pamięć Plemienia: 16 emblematów SVG, węzły ze składowych, strażnik i arkusz przeglądu §7"
```

---

### Task 6: Kronika — „Nowe w Księdze"

**Files:**
- Modify: `js/kronika.js` (`zbudujKronike`)
- Test: `tools/test-kronika.mjs` (sekcja przed `process.exit`)

**Interfaces:**
- Consumes: lista `[{rodzaj, id, nazwa}]` od wołającego (main.js, Task 10)
- Produces: `MAX_NOWYCH_W_KRONICE = 4`; `zbudujKronike(pods, {wynikKsiegi?, nowe?})` zwraca dodatkowo `noweWKsiedze: {pozycje: {rodzaj,id,nazwa}[], reszta: number}`

- [ ] **Step 1: Write the failing test** — dopisz do `tools/test-kronika.mjs`; dodaj `MAX_NOWYCH_W_KRONICE` do importu z `../js/kronika.js`

```js
console.log('\nNOWE W KSIĘDZE:');
{
    const nowe = Array.from({ length: 6 }, (_, i) => ({ rodzaj: 'technika', id: `t${i}`, nazwa: `T${i}` }));
    const k = zbudujKronike(pods(), { nowe });
    spr(`najwyżej ${MAX_NOWYCH_W_KRONICE} pozycje`, k.noweWKsiedze.pozycje.length === MAX_NOWYCH_W_KRONICE);
    spr('reszta policzona', k.noweWKsiedze.reszta === 6 - MAX_NOWYCH_W_KRONICE);
    spr('kolejność zachowana', k.noweWKsiedze.pozycje[0].id === 't0');
    spr('brak nowych = pusta lista, reszta 0', zbudujKronike(pods(), {}).noweWKsiedze.pozycje.length === 0 && zbudujKronike(pods(), null).noweWKsiedze.reszta === 0);
    spr('śmieci w liście odpadają', zbudujKronike(pods(), { nowe: [null, { rodzaj: 'technika', id: 'a' }, { rodzaj: 'kamien', id: 'b', nazwa: 'B' }] }).noweWKsiedze.pozycje.length === 1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-kronika.mjs`
Expected: FAIL — `does not provide an export named 'MAX_NOWYCH_W_KRONICE'`

- [ ] **Step 3: Write minimal implementation** — w `js/kronika.js` nad `zbudujKronike`:

```js
// Pamięć Plemienia (2026-10-12): odkrycia tej rundy. Więcej niż kilka emblematów
// zasłoniłoby tancerza, reszta to "i jeszcze N" - wszystko i tak czeka w Księdze.
export const MAX_NOWYCH_W_KRONICE = 4;
```

w `zbudujKronike` (przed `return`):

```js
    const nowe = (Array.isArray(opcje?.nowe) ? opcje.nowe : [])
        .filter(o => o && typeof o.rodzaj === 'string' && typeof o.id === 'string' && typeof o.nazwa === 'string' && o.nazwa);
```

i w zwracanym obiekcie dodaj pole:

```js
        noweWKsiedze: {
            pozycje: nowe.slice(0, MAX_NOWYCH_W_KRONICE).map(({ rodzaj, id, nazwa }) => ({ rodzaj, id, nazwa })),
            reszta: Math.max(0, nowe.length - MAX_NOWYCH_W_KRONICE)
        },
```

Zaktualizuj JSDoc `@param` opcji: `{wynikKsiegi?: ..., nowe?: {rodzaj:string, id:string, nazwa:string}[]}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-kronika.mjs`
Expected: wszystkie `✓`

- [ ] **Step 5: Commit**

```bash
git add js/kronika.js tools/test-kronika.mjs
git commit -m "Kronika: sekcja Nowe w Księdze (maks. 4 + i jeszcze N)"
```

---

### Task 7: Powiadomienie na żywo

**Files:**
- Create: `js/odkryciaHud.js`
- Modify: `index.html` (po `#wynik-unoszace`), `style.css` (po regułach `#runda-zew`)
- Test: `tools/test-odkrycia-hud.mjs`

**Interfaces:**
- Consumes: Task 4 (`nazwaOdkrycia`), Task 5 (`rysujEmblemat`)
- Produces:
  - `CZAS_POWIADOMIENIA_MS = 2600`, `MAX_KOLEJKI = 8`
  - `class KolejkaPowiadomien` — `dodaj(Nowe[])`, `aktualny(now) → Nowe|null`
  - `class OdkryciaHud(root)` — `dodaj(Nowe[])`, `update(now)`

- [ ] **Step 1: Write the failing test** — `tools/test-odkrycia-hud.mjs`

```js
/**
 * Kolejka powiadomień o odkryciach (czysta część HUD).
 *   node tools/test-odkrycia-hud.mjs
 */
import { KolejkaPowiadomien, CZAS_POWIADOMIENIA_MS, MAX_KOLEJKI } from '../js/odkryciaHud.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const k = new KolejkaPowiadomien();
spr('pusta = null', k.aktualny(0) === null);
k.dodaj([{ rodzaj: 'pieczec', id: 'a' }, { rodzaj: 'technika', id: 'b' }, { rodzaj: 'kamien', id: 'c' }]);
spr('pierwsze od razu', k.aktualny(100).id === 'a');
spr('trzyma się przez czas powiadomienia', k.aktualny(100 + CZAS_POWIADOMIENIA_MS - 1).id === 'a');
spr('potem następne (nic nie ginie)', k.aktualny(100 + CZAS_POWIADOMIENIA_MS).id === 'b');
spr('i kolejne', k.aktualny(100 + 2 * CZAS_POWIADOMIENIA_MS).id === 'c');
spr('na końcu pusto', k.aktualny(100 + 3 * CZAS_POWIADOMIENIA_MS) === null);
const k2 = new KolejkaPowiadomien();
k2.dodaj(Array.from({ length: 20 }, (_, i) => ({ rodzaj: 'wezel', id: `w${i}` })));
let ile = 0;
for (let t = 0; k2.aktualny(t); t += CZAS_POWIADOMIENIA_MS) ile++;
spr(`kolejka ograniczona do ${MAX_KOLEJKI}`, ile === MAX_KOLEJKI);
const k3 = new KolejkaPowiadomien();
k3.dodaj([null, { rodzaj: 'x' }, undefined]); k3.dodaj(null);
spr('śmieci odpadają', k3.aktualny(0) === null);

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-odkrycia-hud.mjs`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Write implementation** — `js/odkryciaHud.js`

```js
/**
 * Powiadomienie na żywo o odkryciu (Pamięć Plemienia, spec 2026-10-12).
 * Cichy znak w prawym górnym rogu - pod licznikiem czasu rundy, z dala od
 * komunikatu techniki (ostatniKomunikat) i licznika wyniku. Gra się nie zatrzymuje.
 *
 * KolejkaPowiadomien to czysta logika (test w node); OdkryciaHud tylko renderuje.
 * Pod menu (body.w-menu) znak jest schowany w CSS.
 */
import { rysujEmblemat } from './emblematDom.js';
import { nazwaOdkrycia } from './odkrycia.js';

export const CZAS_POWIADOMIENIA_MS = 2600;
// Kilka odkryć w jednej klatce to norma (pieczęć + technika + kamień); 8 to ~20 s
// znaków - dalsze i tak czekają w Kronice i Księdze.
export const MAX_KOLEJKI = 8;

const NAGLOWKI = { pieczec: 'Nowa pieczęć', technika: 'Odkryto technikę', wezel: 'Nowy Węzeł Mocy', kamien: 'Kamień Pamięci' };

export class KolejkaPowiadomien {
    constructor() {
        this._kolejka = [];
        this._biezacy = null;
        this._od = 0;
    }

    dodaj(pozycje) {
        if (!Array.isArray(pozycje)) return;
        for (const p of pozycje) {
            if (p && typeof p.rodzaj === 'string' && typeof p.id === 'string' && this._kolejka.length < MAX_KOLEJKI) this._kolejka.push(p);
        }
    }

    aktualny(now) {
        if (this._biezacy && now - this._od < CZAS_POWIADOMIENIA_MS) return this._biezacy;
        this._biezacy = this._kolejka.shift() ?? null;
        this._od = now;
        return this._biezacy;
    }
}

export class OdkryciaHud {
    constructor(root) {
        this.root = root ?? null;
        this.kolejka = new KolejkaPowiadomien();
        this._pokazany = null;
    }

    dodaj(pozycje) { this.kolejka.dodaj(pozycje); }

    update(now) {
        const p = this.kolejka.aktualny(now);
        if (!this.root || p === this._pokazany) return;
        this._pokazany = p;
        if (!p) { this.root.classList.remove('widoczny'); return; }
        const doc = this.root.ownerDocument;
        this.root.querySelector('.odkrycie-znak').replaceChildren(rysujEmblemat(doc, p.rodzaj, p.id));
        this.root.querySelector('.odkrycie-rodzaj').textContent = NAGLOWKI[p.rodzaj] ?? '';
        this.root.querySelector('.odkrycie-nazwa').textContent = nazwaOdkrycia(p.rodzaj, p.id);
        // Restart animacji rozpalenia dla kolejnego znaku pod rząd.
        this.root.classList.remove('widoczny');
        void this.root.offsetWidth;
        this.root.classList.add('widoczny');
    }
}
```

`index.html` — po `<div id="wynik-unoszace" aria-hidden="true"></div>`:

```html
      <!-- Pamięć Plemienia (2026-10-12): cichy znak odkrycia, prawy górny róg. -->
      <div id="odkrycia-hud" role="status" aria-live="polite">
        <span class="odkrycie-znak"></span>
        <span class="odkrycie-tekst">
          <span class="odkrycie-rodzaj"></span>
          <span class="odkrycie-nazwa"></span>
        </span>
      </div>
```

`style.css` — po regułach `#runda-zew`:

```css
/* Pamięć Plemienia: znak odkrycia rozpala się pod czasem rundy i gaśnie. */
#odkrycia-hud {
    position: absolute;
    top: 4.6rem;
    right: 14px;
    z-index: 19;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.9rem 0.45rem 0.5rem;
    border-radius: 999px;
    background: rgba(11, 8, 6, 0.6);
    border: 1px solid rgba(217, 164, 65, 0.45);
    color: var(--kosc);
    opacity: 0;
    transform: translateY(-6px);
    pointer-events: none;
    transition: opacity 0.35s ease, transform 0.35s ease;
}
#odkrycia-hud.widoczny { opacity: 1; transform: none; animation: znakOdkrycia 2.6s ease-out 1 forwards; }
#odkrycia-hud .emblemat { width: 2.4rem; height: 2.4rem; color: var(--zloto); filter: drop-shadow(0 0 6px rgba(255, 179, 71, 0.85)); }
.odkrycie-tekst { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
.odkrycie-rodzaj { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--plomien); }
.odkrycie-nazwa { font-family: 'Bona Nova SC', serif; font-size: 1.05rem; }
body.w-menu #odkrycia-hud { opacity: 0 !important; }
@keyframes znakOdkrycia {
    0% { opacity: 0; box-shadow: 0 0 0 rgba(255, 122, 26, 0); }
    12% { opacity: 1; box-shadow: 0 0 28px rgba(255, 122, 26, 0.75); }
    80% { opacity: 1; box-shadow: 0 0 10px rgba(255, 122, 26, 0.25); }
    100% { opacity: 0; box-shadow: none; }
}
```

i w istniejącym bloku `@media (prefers-reduced-motion: reduce)` dopisz:

```css
    #odkrycia-hud, #odkrycia-hud.widoczny { transition: none; animation: none; transform: none; }
```

Generyczny `.emblemat` (fill/stroke) — dodaj raz w `style.css` (używany też w Task 9):

```css
.emblemat { fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
.emblemat .skladowa { stroke-width: 5; }
.emblemat .nic { stroke-width: 1.5; stroke-dasharray: 3 4; opacity: 0.8; }
.emblemat-runa { font-family: 'Noto Sans Runic', serif; font-size: 28px; fill: currentColor; stroke: none; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-odkrycia-hud.mjs`
Expected: wszystkie `✓`

- [ ] **Step 5: Commit**

```bash
git add js/odkryciaHud.js tools/test-odkrycia-hud.mjs index.html style.css
git commit -m "Pamięć Plemienia: znak odkrycia na żywo (kolejka, prawy górny róg)"
```

---

### Task 8: Eksport/import Księgi z odkryciami

**Files:**
- Modify: `js/ksiega.js` (`eksportuj`, `importuj`)
- Test: `tools/test-ksiega.mjs` (sekcja przed `process.exit`)

**Interfaces:**
- Produces: `Ksiega.eksportuj(dodatki = {})` — dokleja pola `dodatki` (bez `wersja`/`tablice`) do JSON; `Ksiega.importuj(tekst)` przy sukcesie zwraca dodatkowo `dane` (sparsowany obiekt), z którego UI bierze `dane.odkrycia`.

- [ ] **Step 1: Write the failing test** — dopisz do `tools/test-ksiega.mjs`

```js
console.log('\nDODATKI W PLIKU (Pamięć Plemienia):');
{
    const k = new Ksiega(pamiec());
    k.dodaj('proba:60', 'Ola', 100, 1);
    const plik = JSON.parse(k.eksportuj({ odkrycia: { techniki: { aard: { n: 1, t: 1 } } }, tablice: 'podmiana', wersja: 9 }));
    spr('eksport zawiera odkrycia', plik.odkrycia?.techniki?.aard?.n === 1);
    spr('dodatki nie podmieniają tablic ani wersji', plik.wersja === 1 && Array.isArray(plik.tablice['proba:60']));
    spr('eksport bez dodatków jak dawniej', JSON.parse(k.eksportuj()).odkrycia === undefined);
    const k2 = new Ksiega(pamiec());
    const w = k2.importuj(JSON.stringify(plik));
    spr('import zwraca dane z odkryciami', w.ok && w.dane?.odkrycia?.techniki?.aard?.n === 1);
    spr('nieudany import bez danych', k2.importuj('x').dane === undefined);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-ksiega.mjs`
Expected: FAIL na „eksport zawiera odkrycia"

- [ ] **Step 3: Write minimal implementation** — w `js/ksiega.js`:

```js
    /**
     * @param {object} [dodatki]  inne części pliku Księgi (np. {odkrycia} z js/odkrycia.js);
     *                            nie mogą podmienić `wersja` ani `tablice`
     */
    eksportuj(dodatki = {}) {
        const { wersja: _w, tablice: _t, ...reszta } = dodatki && typeof dodatki === 'object' ? dodatki : {};
        return JSON.stringify({ ...reszta, wersja: 1, tablice: this.tablice }, null, 2);
    }
```

w `importuj` zamień końcowe `return { ok: true, dodano };` na:

```js
        // `dane` - surowy plik dla innych części Księgi (Pamięć Plemienia waliduje swoje pole sama).
        return { ok: true, dodano, dane };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-ksiega.mjs`
Expected: wszystkie `✓`

- [ ] **Step 5: Commit**

```bash
git add js/ksiega.js tools/test-ksiega.mjs
git commit -m "Księga: eksport z dodatkami, import oddaje surowe dane (odkrycia)"
```

---

### Task 9: Księga — Zwój Technik, Węzły Mocy, Kamienie Pamięci (UI)

**Files:**
- Create: `js/zwojUi.js`
- Modify: `js/polanaUi.js` (konstruktor, `_podepnij`, `_poWyborzeKamienia`, `_eksport`, `_import`, `_renderKsiega`, `_renderKronika`), `index.html` (`#ksiega-ekran`, `#kronika`), `style.css` (sekcja Księgi)

**Interfaces:**
- Consumes: Task 1 (katalog), Task 3 (`KAMIENIE`, `KATEGORIE`), Task 4 (`Odkrycia`, `nazwaOdkrycia`), Task 5 (`rysujEmblemat`, `EMBLEMATY`, `WEZLY_EMBLEMATY`), Task 6 (`k.noweWKsiedze`), Task 8 (`eksportuj(dodatki)`, `importuj → dane`), `glif` (`js/glify.js`)
- Produces: `PolanaUi(doc, {..., odkrycia})` (nowa opcja, domyślnie `null`); `class ZwojUi(doc, {odkrycia, onZmiana})` z `renderPostep()`, `renderuj(dzial)`, `otworz(rodzaj,id)`, `zamknij()`, getter `maSzczegol`

Ten task jest wizualny — **przed Step 3 wywołaj skill `frontend-design:frontend-design`** i dopracuj CSS niżej w jego duchu (charakter, nie szablon), zachowując paletę i kroje z `style.css` oraz wszystkie klasy/id, na których opiera się JS.

- [ ] **Step 1: Markup** — w `index.html` zastąp zawartość `<section id="ksiega-ekran" ...>` (zachowując istniejące id przycisków i pól):

```html
        <section id="ksiega-ekran" class="menu-ekran hidden">
          <h2>Księga Plemienia</h2>
          <div id="ksiega-postep">
            <div id="ksiega-runy" aria-hidden="true"></div>
            <p id="ksiega-licznik"></p>
          </div>
          <div id="ksiega-dzialy" role="tablist" aria-label="Działy Księgi">
            <button type="button" role="tab" data-dzial="wyniki">Wyniki</button>
            <button type="button" role="tab" data-dzial="techniki">Zwój Technik</button>
            <button type="button" role="tab" data-dzial="wezly">Węzły Mocy</button>
            <button type="button" role="tab" data-dzial="kamienie">Kamienie Pamięci</button>
          </div>
          <div id="dzial-wyniki">
            <div
              id="ksiega-zakladki"
              class="wybor"
              role="tablist"
              aria-label="Tablice wyników"
            ></div>
            <ol id="ksiega-lista"></ol>
          </div>
          <div id="dzial-zwoj" class="hidden">
            <div id="zwoj-siatka"></div>
            <div id="zwoj-szczegol" class="hidden" role="group" aria-labelledby="szczegol-nazwa">
              <div id="szczegol-znak"></div>
              <h3 id="szczegol-nazwa"></h3>
              <div id="szczegol-sekwencja"></div>
              <p id="szczegol-opis"></p>
              <p id="szczegol-meta"></p>
              <button type="button" id="zwoj-zamknij" class="drugi">Wróć do Zwoju</button>
            </div>
          </div>
          <p id="ksiega-info" aria-live="polite"></p>
          <div class="przyciski">
            <button type="button" id="ksiega-wstecz" class="drugi">
              Do Polany
            </button>
            <button type="button" id="ksiega-eksport" class="drugi">
              Zapisz do pliku
            </button>
            <label class="plik drugi"
              >Wczytaj z pliku<input
                type="file"
                id="ksiega-import"
                accept=".json,application/json"
            /></label>
          </div>
          <details id="ksiega-wiecej">
            <summary>Więcej…</summary>
            <button type="button" id="ksiega-wyczysc" class="drugi">
              Wyczyść wyniki…
            </button>
            <button type="button" id="ksiega-wyczysc-tak" class="drugi hidden">
              Na pewno? To usunie wszystkie wyniki (odkrycia zostaną)
            </button>
          </details>
        </section>
```

W `#kronika` po `<div id="kronika-przydomki"></div>` dodaj `<div id="kronika-nowe"></div>`.

- [ ] **Step 2: `js/zwojUi.js`**

```js
/**
 * Zwój Technik, Węzły Mocy i Kamienie Pamięci - warstwa DOM działów Księgi.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * LOGIKI TU NIE MA (stan w js/odkrycia.js). Tekst wyłącznie przez textContent.
 *
 * NIEODKRYTE ZDRADZAJĄ TYLKO NAZWĘ I ZWĘGLONY EMBLEMAT - bez sekwencji, run
 * i podpowiedzi (decyzja właściciela). Sekret niezdobyty nie zdradza nawet nazwy.
 */
import { DWOJKI, TROJKI, TECHNIKI, WEZLY, PIECZECIE, NAZWY_PIECZECI } from './katalog.js';
import { KAMIENIE, KATEGORIE } from './osiagniecia.js';
import { EMBLEMATY, WEZLY_EMBLEMATY } from './emblematy.js';
import { nazwaOdkrycia } from './odkrycia.js';
import { rysujEmblemat } from './emblematDom.js';
import { glif } from './glify.js';

const data = (t) => new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const razy = (n) => (n === 1 ? '1 raz' : `${n} razy`);
const kamien = (id) => KAMIENIE.find(k => k.id === id) ?? null;

export class ZwojUi {
    /** @param {{odkrycia: import('./odkrycia.js').Odkrycia, onZmiana: () => void}} deps */
    constructor(doc, { odkrycia, onZmiana }) {
        this.doc = doc;
        this.o = odkrycia;
        this.onZmiana = onZmiana;
        this.otwarty = null;      // {rodzaj, id} karty szczegółu
        this._dzial = 'techniki';
        this.$ = (id) => doc.getElementById(id);
        this.$('zwoj-zamknij')?.addEventListener('click', () => this.zamknij());
        this.$('zwoj-siatka')?.addEventListener('keydown', (e) => this._strzalki(e));
    }

    get maSzczegol() { return !!this.otwarty; }

    otworz(rodzaj, id) {
        this.otwarty = { rodzaj, id };
        this.o.oznaczObejrzane(rodzaj, id);   // żar nowości gaśnie po otwarciu
        this.onZmiana();
        this.$('zwoj-zamknij')?.focus();
    }

    zamknij() {
        const z = this.otwarty;
        this.otwarty = null;
        this.onZmiana();
        if (z) this.doc.querySelector(`#zwoj-siatka [data-klucz="${z.rodzaj}:${z.id}"]`)?.focus();
    }

    renderPostep() {
        const runy = this.$('ksiega-runy');
        runy.replaceChildren();
        for (const id of PIECZECIE) {
            const s = this.doc.createElement('span');
            s.className = 'runa-postepu' + (this.o.ma('pieczec', id) ? ' zarzy' : '');
            s.textContent = glif(id);
            if (this.o.ma('pieczec', id)) s.title = NAZWY_PIECZECI[id];
            runy.appendChild(s);
        }
        const p = this.o.postep();
        this.$('ksiega-licznik').textContent =
            `Odkryto ${p.techniki.ile} z ${p.techniki.z} technik · ${p.wezly.ile} z ${p.wezly.z} węzłów · ${p.kamienie.ile} z ${p.kamienie.z} kamieni`;
    }

    renderuj(dzial) {
        this._dzial = dzial;
        const siatka = this.$('zwoj-siatka');
        siatka.replaceChildren();
        this.$('zwoj-szczegol').classList.toggle('hidden', !this.otwarty);
        siatka.classList.toggle('hidden', !!this.otwarty);
        if (this.otwarty) { this._renderSzczegol(); return; }
        if (dzial === 'techniki') {
            this._sekcja(siatka, 'Gesty', 'dwie pieczęcie', DWOJKI.map(id => ['technika', id]));
            this._sekcja(siatka, 'Zjawiska', 'trzy pieczęcie', TROJKI.map(id => ['technika', id]));
        } else if (dzial === 'wezly') {
            this._sekcja(siatka, 'Węzły Mocy', 'gdy techniki spotkają się w polu', WEZLY.map(w => ['wezel', w.id]));
        } else {
            for (const kat of KATEGORIE) {
                this._sekcja(siatka, kat.naglowek, '', KAMIENIE.filter(k => k.kategoria === kat.id).map(k => ['kamien', k.id]));
            }
        }
    }

    _sekcja(siatka, naglowek, podpis, pozycje) {
        const doc = this.doc;
        const sek = doc.createElement('section'); sek.className = 'zwoj-sekcja';
        const h = doc.createElement('h3'); h.textContent = naglowek;
        if (podpis) { const s = doc.createElement('small'); s.textContent = ` · ${podpis}`; h.appendChild(s); }
        const lista = doc.createElement('div'); lista.className = 'zwoj-karty';
        for (const [r, id] of pozycje) lista.appendChild(this._karta(r, id));
        sek.append(h, lista);
        siatka.appendChild(sek);
    }

    _karta(rodzaj, id) {
        const { doc, o } = this;
        const zdobyte = o.ma(rodzaj, id);
        const k = rodzaj === 'kamien' ? kamien(id) : null;
        const ukryty = !!k?.sekret && !zdobyte;
        const b = doc.createElement('button');
        b.type = 'button';
        b.dataset.klucz = `${rodzaj}:${id}`;
        b.className = `karta karta-${rodzaj} ${zdobyte ? 'odkryta' : 'zweglona'}`
            + (o.czyNowe(rodzaj, id) ? ' nowa' : '') + (ukryty ? ' sekret' : '');
        const znak = doc.createElement('span'); znak.className = 'karta-znak';
        znak.appendChild(rysujEmblemat(doc, ukryty ? 'sekret' : rodzaj, id));
        const nazwa = doc.createElement('span'); nazwa.className = 'karta-nazwa';
        nazwa.textContent = ukryty ? 'Sekret plemienia' : nazwaOdkrycia(rodzaj, id);
        b.append(znak, nazwa);
        if (k?.postep && !zdobyte && !ukryty) b.appendChild(this._naciecia(k.postep(o)));
        b.addEventListener('click', () => this.otworz(rodzaj, id));
        return b;
    }

    /** Postęp jako nacięcia na kamieniu ("3 z 5"), nie pasek braków (§2). */
    _naciecia({ ile, z }) {
        const s = this.doc.createElement('span'); s.className = 'karta-postep';
        if (z <= 16) {
            for (let i = 0; i < z; i++) {
                const n = this.doc.createElement('i'); n.className = i < ile ? 'naciecie wyryte' : 'naciecie';
                s.appendChild(n);
            }
        }
        const t = this.doc.createElement('span'); t.className = 'postep-tekst'; t.textContent = `${ile} z ${z}`;
        s.appendChild(t);
        return s;
    }

    _renderSzczegol() {
        const { doc, o } = this;
        const { rodzaj, id } = this.otwarty;
        const zdobyte = o.ma(rodzaj, id);
        const k = rodzaj === 'kamien' ? kamien(id) : null;
        const ukryty = !!k?.sekret && !zdobyte;
        const sz = this.$('zwoj-szczegol');
        sz.className = `${zdobyte ? 'odkryta' : 'zweglona'} szczegol-${rodzaj}`;
        this.$('szczegol-znak').replaceChildren(rysujEmblemat(doc, ukryty ? 'sekret' : rodzaj, id));
        this.$('szczegol-nazwa').textContent = ukryty ? 'Sekret plemienia' : nazwaOdkrycia(rodzaj, id);
        const sekw = this.$('szczegol-sekwencja'); sekw.replaceChildren();
        let opis = '', meta = '';

        if (rodzaj === 'technika') {
            if (zdobyte) {
                for (const p of TECHNIKI.find(t => t.id === id).sekwencja) {
                    const r = doc.createElement('span'); r.className = 'runa-sekwencji';
                    r.textContent = glif(p); r.title = NAZWY_PIECZECI[p];
                    sekw.appendChild(r);
                }
                opis = EMBLEMATY[id].legenda;
                meta = `Użyta ${razy(o.techniki[id].n)} · pierwszy raz ${data(o.techniki[id].t)}`;
            } else {
                opis = 'Jeszcze nie zapisana w Księdze. Tańcz, a sama się ujawni.';
            }
        } else if (rodzaj === 'wezel') {
            if (zdobyte) {
                const [a, b] = WEZLY_EMBLEMATY[id].skladowe;
                opis = WEZLY_EMBLEMATY[id].legenda;
                meta = `Splata: ${nazwaOdkrycia('technika', a)} i ${nazwaOdkrycia('technika', b)} · `
                    + `${razy(o.wezly[id].n)} · pierwszy raz ${data(o.wezly[id].t)}`;
            } else {
                opis = 'Jeszcze nie spleciony. Węzły rodzą się, gdy techniki spotkają się w polu.';
            }
        } else if (k) {
            if (ukryty) {
                opis = 'Ten kamień ujawni się sam, gdy nadejdzie jego chwila.';
            } else {
                opis = k.opis;
                if (zdobyte) meta = `Zdobyty ${data(o.kamienie[id].t)}`;
                else if (k.postep) { const p = k.postep(o); meta = `${p.ile} z ${p.z}`; }
            }
        }
        this.$('szczegol-opis').textContent = opis;
        this.$('szczegol-meta').textContent = meta;
    }

    /** Strzałki po kartach: lewo/prawo ±1, góra/dół o szerokość rzędu. */
    _strzalki(e) {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        const karty = [...this.$('zwoj-siatka').querySelectorAll('.karta')];
        const i = karty.indexOf(this.doc.activeElement);
        if (i < 0) return;
        const wRzedzie = Math.max(1, karty.filter(k => k.offsetTop === karty[i].offsetTop).length);
        const krok = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -wRzedzie, ArrowDown: wRzedzie }[e.key];
        const cel = karty[Math.min(karty.length - 1, Math.max(0, i + krok))];
        cel?.focus();
        e.preventDefault();
    }
}
```

- [ ] **Step 3: Zmiany w `js/polanaUi.js`**

Importy na górze:

```js
import { ZwojUi } from './zwojUi.js';
import { rysujEmblemat } from './emblematDom.js';

// Dział Księgi -> rodzaj odkryć, którego "nowości" żarzą się na zakładce.
const RODZAJ_DZIALU = { techniki: 'technika', wezly: 'wezel', kamienie: 'kamien' };
```

Konstruktor: dodaj `odkrycia = null` do destrukturyzacji opcji, a w ciele:

```js
        this.odkrycia = odkrycia;
        this.dzial = 'wyniki';           // Wyniki | Zwój Technik | Węzły Mocy | Kamienie Pamięci
```

i tuż przed `this._podepnij();`:

```js
        this.zwoj = odkrycia ? new ZwojUi(doc, { odkrycia, onZmiana: () => this.render() }) : null;
```

W `_podepnij()` dodaj:

```js
        for (const b of this.doc.querySelectorAll('#ksiega-dzialy [data-dzial]')) {
            b.addEventListener('click', () => {
                this.dzial = b.dataset.dzial;
                if (this.zwoj) this.zwoj.otwarty = null;
                odswiez();
            });
        }
```

W handlerze `keydown` zamień gałąź Escape na:

```js
            if (e.key === 'Escape' && menu.ekran === 'ksiega' && this.zwoj?.maSzczegol) {
                this.zwoj.zamknij();   // Esc: szczegół -> siatka -> Polana
            } else if (e.key === 'Escape' && (menu.ekran === 'konfig' || menu.ekran === 'ksiega')) {
```

(reszta gałęzi bez zmian). W `_poWyborzeKamienia` w gałęzi `ksiega` dopisz `if (this.zwoj) this.zwoj.otwarty = null;`.

`_eksport`:

```js
        const dodatki = this.odkrycia ? { odkrycia: this.odkrycia.eksportFragment() } : {};
        const blob = new Blob([this.ksiega.eksportuj(dodatki)], { type: 'application/json' });
```

`_import` — w gałęzi `if (wynik.ok)` zamień ustawianie `infoKsiegi` na:

```js
                const odk = wynik.dane?.odkrycia && this.odkrycia ? this.odkrycia.scal(wynik.dane.odkrycia).dodano : 0;
                const czesci = [];
                if (wynik.dodano > 0) czesci.push(`${wynik.dodano} wpisów`);
                if (odk > 0) czesci.push(`${odk} odkryć`);
                this.infoKsiegi = czesci.length ? `Dopisano do Księgi: ${czesci.join(' i ')}.` : 'To wszystko już jest w Księdze.';
```

Przycisk „Wyczyść wyniki" — komunikat po wyczyszczeniu zmień na `'Wyniki wyczyszczone — odkrycia plemienia zostały.'`.

`_renderKsiega` — na początku (po destrukturyzacji):

```js
        for (const b of doc.querySelectorAll('#ksiega-dzialy [data-dzial]')) {
            const d = b.dataset.dzial;
            b.setAttribute('aria-selected', String(d === this.dzial));
            b.classList.toggle('ma-nowe', !!RODZAJ_DZIALU[d] && (this.odkrycia?.ileNowych(RODZAJ_DZIALU[d]) ?? 0) > 0);
        }
        $('ksiega-postep').classList.toggle('hidden', !this.zwoj);
        $('ksiega-dzialy').classList.toggle('hidden', !this.zwoj);
        $('dzial-wyniki').classList.toggle('hidden', this.dzial !== 'wyniki');
        $('dzial-zwoj').classList.toggle('hidden', this.dzial === 'wyniki');
        $('ksiega-wiecej').classList.toggle('hidden', this.dzial !== 'wyniki');
        if (this.zwoj) {
            this.zwoj.renderPostep();
            if (this.dzial !== 'wyniki') this.zwoj.renderuj(this.dzial);
        }
```

i w wyliczaniu `info` (przed `$('ksiega-info').textContent = info;`) zamień dwa warunki „pustej Księgi" i „braku pamięci" na zależne od działu:

```js
        if (this.dzial === 'wyniki') {
            if (!info && !klucze.length) info = 'Księga czeka na pierwszy wpis — zatańcz obrzęd.';
            if (!info && !ksiega.trwala) info = 'Ta przeglądarka nie pozwala zapisać Księgi — wyniki przetrwają do zamknięcia karty.';
        } else if (!info && this.odkrycia && !this.odkrycia.trwala) {
            info = 'Ta przeglądarka nie zapamięta odkryć po zamknięciu karty.';
        }
```

`_renderKronika` — po bloku przydomków:

```js
        const nw = $('kronika-nowe'); nw.replaceChildren();
        const nowe = k.noweWKsiedze;
        if (nowe?.pozycje.length) {
            const h = doc.createElement('div'); h.className = 'etykieta'; h.textContent = 'Nowe w Księdze';
            nw.appendChild(h);
            for (const p of nowe.pozycje) {
                const s = doc.createElement('span'); s.className = 'nowe-pozycja';
                const n = doc.createElement('span'); n.textContent = p.nazwa;
                s.append(rysujEmblemat(doc, p.rodzaj, p.id), n);
                nw.appendChild(s);
            }
            if (nowe.reszta > 0) {
                const r = doc.createElement('span'); r.className = 'nowe-reszta'; r.textContent = `i jeszcze ${nowe.reszta}`;
                nw.appendChild(r);
            }
        }
```

- [ ] **Step 4: CSS** — w `style.css` po regułach `#ksiega-wiecej …` (wywołaj najpierw `frontend-design`; poniższe to baza do dopracowania):

```css
/* --- Pamięć Plemienia: postęp, działy, karty (2026-10-12) --- */
#ksiega-postep { margin: -0.4rem 0 1rem; }
#ksiega-runy { display: flex; justify-content: center; gap: 0.9rem; font-family: 'Noto Sans Runic', serif; font-size: 1.7rem; }
.runa-postepu { color: rgba(239, 227, 200, 0.18); transition: color 0.6s ease, text-shadow 0.6s ease; }
.runa-postepu.zarzy { color: var(--plomien); text-shadow: 0 0 12px rgba(255, 122, 26, 0.85), 0 0 26px rgba(255, 122, 26, 0.35); }
#ksiega-licznik { font-size: 0.92rem; letter-spacing: 0.03em; opacity: 0.85; margin-top: 0.3rem; }

#ksiega-dzialy { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; margin-bottom: 1.1rem; border-bottom: 1px solid rgba(217, 164, 65, 0.25); }
#ksiega-dzialy button {
    position: relative; font: inherit; cursor: pointer; color: var(--kosc); opacity: 0.7;
    background: none; border: 0; padding: 0.5rem 0.9rem; border-bottom: 2px solid transparent;
}
#ksiega-dzialy button[aria-selected="true"] { opacity: 1; color: var(--plomien); border-bottom-color: var(--zar); }
#ksiega-dzialy button.ma-nowe::after {
    content: ''; position: absolute; top: 0.45rem; right: 0.25rem; width: 6px; height: 6px; border-radius: 50%;
    background: var(--zar); box-shadow: 0 0 8px var(--zar); animation: zarNowosci 1.8s ease-in-out infinite;
}
#ksiega-dzialy button:focus-visible { outline: 2px solid var(--kosc); outline-offset: 2px; }

#zwoj-siatka { text-align: left; max-height: min(52vh, 34rem); overflow-y: auto; padding-right: 0.3rem; }
.zwoj-sekcja h3 { font-family: 'Bona Nova SC', serif; font-weight: 400; color: var(--zloto); letter-spacing: 0.06em; margin: 0.6rem 0 0.5rem; }
.zwoj-sekcja h3 small { font-family: 'Bona Nova', serif; color: var(--kosc); opacity: 0.55; letter-spacing: 0; }
.zwoj-karty { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.6rem; }

.karta {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
    padding: 0.7rem 0.4rem 0.6rem; cursor: pointer; font: inherit; color: var(--kosc);
    background: radial-gradient(ellipse at 50% 30%, rgba(255, 179, 71, 0.08), transparent 70%), rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(217, 164, 65, 0.28); border-radius: 10px;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.karta:hover, .karta:focus-visible { transform: translateY(-2px); border-color: var(--zloto); box-shadow: 0 0 18px rgba(255, 122, 26, 0.25); outline: none; }
.karta-znak .emblemat { width: 3.6rem; height: 3.6rem; }
.karta-nazwa { font-size: 0.85rem; line-height: 1.15; text-align: center; }

/* Odkryta: złota kreska. */
.karta.odkryta .emblemat { color: var(--zloto); filter: drop-shadow(0 0 4px rgba(255, 179, 71, 0.45)); }
/* Zwęglona: czarna sylwetka z tlącą się krawędzią - nic poza nazwą. */
.karta.zweglona { background: rgba(0, 0, 0, 0.42); border-color: rgba(122, 31, 15, 0.45); }
.karta.zweglona .emblemat { color: #170e08; filter: drop-shadow(0 0 1.2px rgba(255, 122, 26, 0.9)) drop-shadow(0 0 5px rgba(255, 90, 20, 0.25)); animation: tlenie 4.5s ease-in-out infinite; }
.karta.zweglona .karta-nazwa { opacity: 0.5; }
.karta.sekret .karta-nazwa { font-style: italic; }
/* Nowa: rysuje się złotą kreską i pulsuje żarem do obejrzenia. */
.karta.nowa { border-color: var(--zar); animation: zarNowosci 1.8s ease-in-out infinite; }
.karta.nowa .emblemat * { stroke-dasharray: 260; stroke-dashoffset: 260; animation: rysujKreske 1.8s ease-out forwards; }
.karta.nowa::after { content: '✦'; position: absolute; top: 0.25rem; right: 0.4rem; font-size: 0.8rem; color: var(--plomien); text-shadow: 0 0 8px var(--zar); }

.karta-postep { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; justify-content: center; }
.naciecie { width: 3px; height: 9px; background: rgba(239, 227, 200, 0.18); border-radius: 1px; }
.naciecie.wyryte { background: var(--plomien); box-shadow: 0 0 4px var(--zar); }
.postep-tekst { font-size: 0.72rem; opacity: 0.7; margin-left: 0.3rem; }
.emblemat .kamien-obrys { stroke-width: 2.5; }

#zwoj-szczegol { padding: 0.5rem 0 0.2rem; }
#szczegol-znak .emblemat { width: 8rem; height: 8rem; }
#zwoj-szczegol.odkryta #szczegol-znak .emblemat { color: var(--zloto); filter: drop-shadow(0 0 10px rgba(255, 179, 71, 0.6)); }
#zwoj-szczegol.zweglona #szczegol-znak .emblemat { color: #170e08; filter: drop-shadow(0 0 1.5px rgba(255, 122, 26, 0.9)); animation: tlenie 4.5s ease-in-out infinite; }
#szczegol-nazwa { font-family: 'Bona Nova SC', serif; font-size: 1.7rem; font-weight: 400; margin: 0.4rem 0; }
#szczegol-sekwencja { font-family: 'Noto Sans Runic', serif; font-size: 2rem; color: var(--plomien); letter-spacing: 0.6rem; text-shadow: 0 0 12px rgba(255, 122, 26, 0.6); min-height: 0.5rem; }
#szczegol-opis { font-style: italic; opacity: 0.9; }
#szczegol-meta { font-size: 0.85rem; opacity: 0.7; }

#kronika-nowe { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; margin-bottom: 0.7rem; }
#kronika-nowe .etykieta { width: 100%; font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--plomien); }
.nowe-pozycja { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.6rem 0.15rem 0.25rem; border: 1px solid rgba(217, 164, 65, 0.5); border-radius: 999px; font-size: 0.85rem; }
.nowe-pozycja .emblemat { width: 1.6rem; height: 1.6rem; color: var(--zloto); }
.nowe-reszta { font-size: 0.85rem; opacity: 0.75; align-self: center; }

@keyframes tlenie { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; filter: drop-shadow(0 0 2px rgba(255, 140, 40, 1)) drop-shadow(0 0 7px rgba(255, 90, 20, 0.4)); } }
@keyframes zarNowosci { 0%, 100% { box-shadow: 0 0 0 rgba(255, 122, 26, 0); } 50% { box-shadow: 0 0 16px rgba(255, 122, 26, 0.55); } }
@keyframes rysujKreske { to { stroke-dashoffset: 0; } }
```

W bloku `@media (prefers-reduced-motion: reduce)` dopisz:

```css
    .karta, .karta.nowa, .karta.zweglona .emblemat, #zwoj-szczegol.zweglona #szczegol-znak .emblemat,
    #ksiega-dzialy button.ma-nowe::after { animation: none; transition: none; }
    .karta.nowa .emblemat * { animation: none; stroke-dashoffset: 0; }
    .karta:hover, .karta:focus-visible { transform: none; }
```

W bloku `@media (max-width: 40rem)` dopisz:

```css
    .zwoj-karty { grid-template-columns: repeat(auto-fill, minmax(5.4rem, 1fr)); }
    #ksiega-dzialy button { padding: 0.45rem 0.55rem; font-size: 0.9rem; }
```

- [ ] **Step 5: Testy regresji**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓` (szczególnie `test-menu.mjs`, `test-ksiega.mjs`, `test-kronika.mjs`)

- [ ] **Step 6: Commit**

```bash
git add js/zwojUi.js js/polanaUi.js index.html style.css
git commit -m "Księga: Zwój Technik, Węzły Mocy i Kamienie Pamięci (zwęglone sylwetki, żar nowości, karta szczegółu)"
```

---

### Task 10: Spięcie z grą, dokumentacja, weryfikacja

**Files:**
- Modify: `js/main.js` (importy, inicjalizacja ~174, manifest ~230, pieczęć/technika ~810-816, reakcje ~947-950 i ~1033-1041, HUD ~1067, `doPolany`, `dalejZKroniki`, `obsluzZdarzeniaRundy`, `pokazKronike`)
- Modify: `GEMINI.md` (tabela plików, §7)

**Interfaces:**
- Consumes: wszystko powyżej.

- [ ] **Step 1: Importy i inicjalizacja** — w `js/main.js` do importów:

```js
import { Odkrycia, nazwaOdkrycia } from './odkrycia.js';
import { OdkryciaHud } from './odkryciaHud.js';
```

po `const ksiega = new Ksiega(...)`:

```js
// PAMIĘĆ PLEMIENIA (2026-10-12, spec 2026-10-12-pamiec-plemienia-design.md): odkrycia
// i Kamienie Pamięci. TRWAŁA MIĘDZY RUNDAMI - celowo `const` poza swiezeModuly.js.
// Liczy się wszędzie, gdzie menu.graAktywna (także swobodny taniec) - NIE przez Punktację.
const odkrycia = new Odkrycia((() => { try { return window.localStorage; } catch { return null; } })());
const odkryciaHud = new OdkryciaHud(document.getElementById('odkrycia-hud'));
let noweRundy = [];   // odkrycia od startu rundy - do "Nowe w Księdze" w Kronice
function zanotuj(nowe) {
    if (!nowe.length) return;
    odkryciaHud.dodaj(nowe);
    noweRundy.push(...nowe);
}
// Liczniki użyć zapisują się hurtem - schowanie karty to ostatnia pewna chwila.
document.addEventListener('visibilitychange', () => { if (document.hidden) odkrycia.zapiszJesliTrzeba(); });
window.addEventListener('pagehide', () => odkrycia.zapiszJesliTrzeba());
```

do opcji `new PolanaUi(document, { menu, ksiega, losoweImie, ...` dodaj `odkrycia,`.

w `.then(([lista, moje]) => {` dopisz na początku:

```js
    odkrycia.ustawManifest(lista.map(u => u.plik));   // tylko pieśni plemienia - własne nie przesuwają celu
```

- [ ] **Step 2: Haki zdarzeń**

Po `punkty.pieczec(skl.zlozona.id, now, miejscePunktow);`:

```js
        zanotuj(odkrycia.pieczec(skl.zlozona.id, now));   // PO pieczęci, PRZED techniką - ogon splotu
```

Po `punkty.technika(technika, now, miejscePunktow);`:

```js
            zanotuj(odkrycia.technika(technika, now));
```

Po czterech wywołaniach `punkty.reakcja(...)` dymu (blok z `wybuchyDymu`):

```js
    if (menu.graAktywna) {
        zanotuj(odkrycia.reakcja('pozoga', wybuchyDymu, now));
        zanotuj(odkrycia.reakcja('rozwianie', dym.ostatnioRozwiane, now));
        zanotuj(odkrycia.reakcja('wirDymu', dym.ostatnioZawirowane, now));
        zanotuj(odkrycia.reakcja('ognistyWir', dym.ostatnioWybuchyWiru, now));
    }
```

Po dziewięciu `punkty.reakcja(...)` z `reakcjeKlatki`:

```js
    // Klucze reakcjeKlatki to id z REAKCJE (strażnik w tools/test-punkty.mjs), Odkrycia odrzucają nieznane.
    if (menu.graAktywna) for (const [id, n] of Object.entries(reakcjeKlatki)) zanotuj(odkrycia.reakcja(id, n, now));
```

Po `wynikHud.update(punkty, now, canvas.width, canvas.height);`:

```js
    odkryciaHud.update(now);
```

- [ ] **Step 3: Przebieg rundy**

W `obsluzZdarzeniaRundy`, gałąź `z.typ === 'trwa'`, po `punkty.reset();`: `noweRundy = [];`

W `doPolany()` przed `menu.doPolany();`:

```js
    noweRundy = [];
    odkrycia.zapiszJesliTrzeba();
```

W `dalejZKroniki()` po `punkty.reset();`: `noweRundy = [];`

W `pokazKronike(pods)` zamień linię `menu.naKronike(zbudujKronike(pods, { wynikKsiegi: wk }));` na:

```js
    // Pamięć Plemienia: nick-bóg i kamienie rundy (Esc tu nie dociera - liczy się tylko dokończona).
    const piesnRundy = przebieg.konfig.tryb === 'obrzed' ? (utworRundy?.plik ?? null) : null;
    const naKoniec = [...odkrycia.nick(nick), ...odkrycia.koniecRundy(pods, { wynikKsiegi: wk, piesn: piesnRundy })];
    odkryciaHud.dodaj(naKoniec);
    const nowe = [...noweRundy, ...naKoniec].map(o => ({ ...o, nazwa: nazwaOdkrycia(o.rodzaj, o.id) }));
    noweRundy = [];
    menu.naKronike(zbudujKronike(pods, { wynikKsiegi: wk, nowe }));
```

- [ ] **Step 4: Testy całości**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓` (w tym `test-swieze-moduly.mjs` — `odkrycia` jest `const`, poza `swiezeModuly`; `test-punkty.mjs` — strażnik reakcji widzi te same literalne `punkty.reakcja('…'`).

- [ ] **Step 5: Weryfikacja w przeglądarce (bez kamery)**

1. Serwer: `python3 -m http.server 8765 --directory /Users/whomean/Documents/antigravity/powerball-app` (w tle).
2. claude-in-chrome: `tabs_context_mcp`, `tabs_create_mcp` → `http://localhost:8765/`.
3. Pusta kolekcja: kliknij kamień „Księga Plemienia", zrzut każdej zakładki (Wyniki, Zwój, Węzły, Kamienie). Oczekiwane: wszystkie karty zwęglone, nazwy widoczne, sekrety jako „Sekret plemienia", licznik „Odkryto 0 z 16 technik · 0 z 13 węzłów · 0 z 24 kamieni".
4. Częściowa kolekcja — `javascript_tool`:

```js
localStorage.setItem('krolSzamanow.odkrycia.v1', JSON.stringify({
  wersja: 1,
  pieczecie: { stribog: { n: 9, t: Date.now() }, mokosz: { n: 4, t: Date.now() }, swarog: { n: 2, t: Date.now() } },
  techniki: { aard: { n: 5, t: Date.now() - 864e5 }, tecza: { n: 1, t: Date.now() }, mglaMokoszy: { n: 2, t: Date.now() } },
  wezly: { burzaWMgle: { n: 1, t: Date.now() } },
  kamienie: { pierwszaIskra: { t: Date.now() }, godzinaDuchow: { t: Date.now() } },
  liczniki: { rundy: 3, piesni: [], bogowie: [] },
  obejrzane: ['technika:aard']
})); location.reload();
```

   Zrzuty: Zwój (Aard odkryta bez żaru, Tęcza i Mgła odkryte z żarem „nowa", 3 runy pieczęci żarzą się, zakładka ma kropkę nowości), karta szczegółu Tęczy (runy sekwencji, legenda, data), karta szczegółu zwęglonej techniki (tylko nazwa + zdanie, brak run), Kamienie (Godzina Duchów zdobyta i odsłonięta; inne sekrety pęknięte; Pięć Żywiołów z nacięciami 3 z 5). Esc w szczególe wraca do siatki, drugi Esc na Polanę. Po zamknięciu szczegółu Tęczy żar gaśnie.
5. Wąskie okno: `resize_window` 390×844 — siatka bez poziomego przewijania.
6. Eksport → import tego pliku w czystym profilu (`localStorage.clear()` + reload + Wczytaj z pliku) — komunikat „Dopisano do Księgi: … odkryć".
7. Zatrzymaj serwer; `localStorage.removeItem('krolSzamanow.odkrycia.v1')`.

Rozbieżność z oczekiwaniami = wróć do Task 9 (UI) albo 4 (logika), nie poprawiaj „na oko" w main.js.

- [ ] **Step 6: GEMINI.md** — w tabeli plików dopisz wiersze:

```
| `js/katalog.js` | Pamięć Plemienia (2026-10-12): katalog odkryć WYLICZANY z `KOMBOSY` (bez wariantów - 16 technik: 10 dwójek „Gesty", 6 trójek „Zjawiska"), `REAKCJE` (13 Węzłów Mocy) i `GLIFY` (5 pieczęci) |
| `js/osiagniecia.js` | Kamienie Pamięci: rejestr 24 osiągnięć (kolekcja/mity/kunszt/sekrety), `kiedy` = zywo/runda/nick/zawsze, progi ZGADNIĘTE; id technik/węzłów przez `T()`/`W()` - rzucają przy imporcie, gdy id zniknie (strażnik) |
| `js/odkrycia.js` | Pamięć Plemienia: trwała, WSPÓLNA dla przeglądarki kolekcja (`krolSzamanow.odkrycia.v1`), liczona wszędzie gdzie `menu.graAktywna` - NIE przez Punktację; zapis tylko przy zmianie (liczniki hurtem: koniec rundy/Esc/`visibilitychange`); trzymanie pozy nie nabija liczników; import SCALA; celowo poza `swiezeModuly` |
| `js/emblematy.js`, `js/emblematDom.js` | 16 ręcznie rysowanych emblematów SVG technik + legendy; węzeł = dwa emblematy splecione nicią. ZAKAZ §7 (bez swarzycy/kołowrotu - Kołowrót to wrzeciono, wiry to lej); przegląd w `tools/emblematy.html` |
| `js/odkryciaHud.js` | Cichy znak odkrycia w prawym górnym rogu (kolejka, 2.6 s, schowany pod menu) |
| `js/zwojUi.js` | Działy Księgi: Zwój Technik, Węzły Mocy, Kamienie Pamięci - nieodkryte to TYLKO nazwa + zwęglona sylwetka, nowości żarzą się do obejrzenia |
```

W §7 w punkcie 6 dopisz zdanie: `Pamięć Plemienia (2026-10-12): zostaje **strojenie progów Kamieni Pamięci** (okna mitów, Pożoga 100, 8 technik w rundzie) na żywym ciele.`

- [ ] **Step 7: Commit**

```bash
git add js/main.js GEMINI.md
git commit -m "Pamięć Plemienia: spięcie z grą (odkrycia wszędzie, znak na żywo, Nowe w Księdze), GEMINI.md"
```

- [ ] **Step 8: Test na żywym ciele — dla właściciela** (nie do wykonania przez agenta): swobodny taniec → złożenie pieczęci i combo daje znak w rogu; runda do końca → „Nowe w Księdze" w Kronice; Księga → żar nowości gaśnie po otwarciu; przeładowanie strony → kolekcja zostaje.
