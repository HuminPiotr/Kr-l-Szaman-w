# Punktacja — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gracz zdobywa punkty za taniec, pieczęcie, techniki i reakcje między technikami; wynik widać w HUD.

**Architecture:** Czysta logika w `js/punkty.js` (bez DOM, testy w node, wzorzec `js/kombosy.js`). `main.js` zgłasza zdarzenia (PUSH) w istniejących miejscach pętli, HUD `js/wynikHud.js` (DOM) odczytuje stan co klatkę (PULL, wzorzec `js/sekwencja.js`). Rozwianie dymu liczone w `js/dym.js` po pierwszym trafieniu kłębu daną falą.

**Tech Stack:** Vanilla JS, moduły ES bez bundlera, testy jako skrypty `node tools/test-*.mjs` (helper `spr(opis, warunek)`, `process.exit(ok ? 0 : 1)`), zbiorczo `sh tools/test-wszystko.sh` (sam podchwytuje nowe pliki `test-*.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-01-punktacja-design.md`

## Global Constraints

- Punkty NIGDY nie maleją — żadna ścieżka API nie zmniejsza `wynik` (GEMINI.md §2 po przepisaniu).
- Każde wejście liczbowe może być NaN/Infinity — ignorować, nigdy nie propagować (GEMINI.md §4).
- Tekst na ekranie wyłącznie w DOM (płótno ma `transform: scaleX(-1)`), wpisywany przez `textContent`.
- Pozycje z płótna → CSS: `lewo% = 100 × (1 − x/W)` (lustro).
- Komentarze po polsku, gęste, tłumaczące DLACZEGO (styl repo).
- `prefers-reduced-motion`: unoszące się napisy bez ruchu, tylko zanik.
- Wartości: taniec `4` pkt/s, pieczęć `25`, technika `100 × Σ TRUDNOSC`, `TRUDNOSC = { mokosz: 1.0, weles: 1.0, perun: 1.2, stribog: 1.4, swarog: 1.6 }`, powtórzenie `−25%` za każde, podłoga `50%`, splecenie `+50%`, pożoga `8`/kłąb pełne do `50`, rozwianie `3`/kłąb pełne do `40`, przerwa serii `1500` ms.

## Review Focus

1. **Spam Aarda (stribog ×N)** — bufor nie jest czyszczony, więc każda kolejna pieczęć stribog odpala Aarda; ogony się nakładają. Oczekiwane: splecenie NIE liczy się między dwiema tymi samymi technikami (inaczej spam bije różnorodność). Test w Task 2.
2. **Przełączenie karty / zamrożona klatka** — `dt` po powrocie bywa sekundami. Oczekiwane: taniec nie dopisuje setek punktów naraz (`dt` przycięte do 0,1 s). Test w Task 1.
3. **Ułamkowe/ujemne `n` w reakcji** — `n` z liczników klatki. Oczekiwane: `n ≤ 0` lub NaN nic nie daje, ułamek zaokrąglany w dół. Test w Task 3.
4. **Technika z nieznaną pieczęcią w sekwencji** (przyszłe combo dodane bez wpisu w `TRUDNOSC`). Oczekiwane: strażnik w teście wywala się czerwono, a w grze technika daje 0 zamiast NaN. Test w Task 1.
5. **Setki unoszących się napisów** przy długiej serii reakcji. Oczekiwane: reakcje NIE tworzą unoszących się napisów co klatkę — idą jako zagregowana seria „Pożoga ×23"; warstwa unoszących ma sufit 12 węzłów. Test w Task 3 (zdarzenia) i Task 5 (sufit).

---

### Task 1: Rdzeń punktacji — taniec, pieczęć, technika

**Files:**
- Create: `js/punkty.js`
- Test: `tools/test-punkty.mjs`

**Interfaces:**
- Consumes: `KOMBOSY` z `js/kombosy.js` (tylko w teście — strażnik).
- Produces:
  - stałe: `TRUDNOSC`, `PUNKTY_PIECZECI`, `PUNKTY_TANCA_NA_S`, `BAZA_TECHNIKI`, `SPADEK_POWTORZENIA`, `PODLOGA_POWTORZENIA`, `PREMIA_SPLECENIA`, `REAKCJE` (pusty-na-razie obiekt uzupełniany w Task 3)
  - `wartoscTechniki(kombo) → number` (0 przy nieznanej pieczęci)
  - `class Punktacja` z polami `aktywna:boolean`, `wynik:number`, `rozbicie:{taniec,pieczecie,techniki,reakcje}`, `momenty:{serie:{}, techniki:{}, splecenia:number}`, `mnoznikZewu:(rodzaj:'pieczec'|'technika', arg)→number`, metodami `reset()`, `taniec(plynnosc, responsywnosc, dt)→number`, `pieczec(id, now, miejsce?)→number`, `technika(kombo, now, miejsce?)→number`, `odbierzZdarzenia()→Array<{rodzaj, tekst, punkty, t, miejsce}>`

- [ ] **Step 1: Write the failing test**

`tools/test-punkty.mjs`:

```js
/**
 * Punktacja - punkty tylko PRZYBYWAJĄ (GEMINI.md §2 po przepisaniu 2026-10-01).
 *
 *   node tools/test-punkty.mjs
 *
 * Spec: docs/superpowers/specs/2026-10-01-punktacja-design.md
 */
import {
    Punktacja, wartoscTechniki, TRUDNOSC, PUNKTY_PIECZECI
} from '../js/punkty.js';
import { KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };
const kombo = (id) => KOMBOSY.find(k => k.id === id);

console.log('STRAŻNIK ROZSZERZALNOŚCI:');
// Nowe combo dodane do KOMBOSY bez wpisu w TRUDNOSC wywala ten test -
// technika nie może wejść do gry "za darmo" (ani za NaN).
for (const k of KOMBOSY) {
    for (const id of k.sekwencja) {
        spr(`pieczęć '${id}' (z ${k.id}) ma trudność`, Number.isFinite(TRUDNOSC[id]) && TRUDNOSC[id] > 0);
    }
    const w = wartoscTechniki(k);
    spr(`${k.id} ma skończoną dodatnią wartość (${w})`, Number.isFinite(w) && w > 0);
}
spr('nieznana pieczęć w sekwencji daje 0, nie NaN',
    wartoscTechniki({ id: 'x', sekwencja: ['swarog', 'nieznana'] }) === 0);
spr('brak sekwencji daje 0', wartoscTechniki(null) === 0 && wartoscTechniki({}) === 0);

console.log('\nWARTOŚCI Z SPECU:');
spr(`Kołowrót = 320 (${wartoscTechniki(kombo('kolowrot'))})`, wartoscTechniki(kombo('kolowrot')) === 320);
spr(`Okadzenie = 460 (${wartoscTechniki(kombo('dym'))})`, wartoscTechniki(kombo('dym')) === 460);
spr(`Grom w Ogniu = 280 (${wartoscTechniki(kombo('gromWOgniu'))})`, wartoscTechniki(kombo('gromWOgniu')) === 280);

console.log('\nTANIEC:');
const t = new Punktacja();
for (let i = 0; i < 60; i++) t.taniec(1, 1, 1 / 60);
spr(`sekunda pełnego tańca = ~4 pkt (${t.wynik.toFixed(2)})`, Math.abs(t.wynik - 4) < 1e-6);
const t2 = new Punktacja();
t2.taniec(1, 0, 1);
spr('bezruch (responsywność 0) nie punktuje', t2.wynik === 0);
const t3 = new Punktacja();
t3.taniec(1, 1, 5);   // powrót z uśpionej karty
spr(`dt przycięte do 0,1 s (${t3.wynik.toFixed(2)})`, Math.abs(t3.wynik - 0.4) < 1e-6);
const t4 = new Punktacja();
t4.taniec(NaN, 1, 0.1); t4.taniec(1, Infinity, 0.1); t4.taniec(1, 1, NaN); t4.taniec(1, 1, -1);
spr('NaN/Infinity/ujemne dt nie zatruwają wyniku', t4.wynik === 0);
spr('rozbicie.taniec = wynik', t.rozbicie.taniec === t.wynik);

console.log('\nPIECZĘĆ:');
const p = new Punktacja();
spr(`pieczęć daje ${PUNKTY_PIECZECI}`, p.pieczec('swarog', 0) === PUNKTY_PIECZECI);
spr('zła pieczęć (pusty id / NaN czas) nic nie daje', p.pieczec('', 1) === 0 && p.pieczec('swarog', NaN) === 0);

console.log('\nTECHNIKA I MALEJĄCY PRZYROST:');
const m = new Punktacja();
const k = kombo('kolowrot');
const a = m.technika(k, 0), b = m.technika(k, 1), c = m.technika(k, 2), d = m.technika(k, 3);
spr(`100% → 75% → 50% → 50% (${[a, b, c, d].join(', ')})`, a === 320 && b === 240 && c === 160 && d === 160);
const e = m.technika(kombo('gromWOgniu'), 4);
const f = m.technika(k, 5);
spr(`inna technika przywraca 100% (${e}, potem kołowrót ${f})`, e === 280 && f === 320);
spr('momenty liczą techniki', m.momenty.techniki.kolowrot === 5 && m.momenty.techniki.gromWOgniu === 1);

console.log('\nZDARZENIA (do unoszących się napisów):');
const z = new Punktacja();
z.pieczec('perun', 0, { x: 10, y: 20 });
z.technika(kombo('kolowrot'), 1, { x: 30, y: 40 });
const zd = z.odbierzZdarzenia();
spr(`dwa zdarzenia (${zd.length})`, zd.length === 2);
spr('technika niesie nazwę i miejsce', zd[1].tekst === 'Kołowrót' && zd[1].miejsce?.x === 30 && zd[1].punkty === 320);
spr('odbierzZdarzenia czyści kolejkę', z.odbierzZdarzenia().length === 0);

console.log('\nNIEAKTYWNA (tryb swobodny):');
const n = new Punktacja();
n.aktywna = false;
n.taniec(1, 1, 0.1); n.pieczec('swarog', 0); n.technika(kombo('kolowrot'), 1);
spr('zero punktów i zdarzeń', n.wynik === 0 && n.odbierzZdarzenia().length === 0);

console.log('\nZEW (hak):');
const zw = new Punktacja();
zw.mnoznikZewu = (rodzaj) => rodzaj === 'pieczec' ? 2 : 1;
spr('mnożnik zewu podwaja pieczęć', zw.pieczec('swarog', 0) === 2 * PUNKTY_PIECZECI);
zw.mnoznikZewu = () => NaN;
spr('zepsuty mnożnik (NaN) traktowany jak 1', zw.pieczec('swarog', 1) === PUNKTY_PIECZECI);
zw.mnoznikZewu = () => 0.1;
spr('mnożnik < 1 traktowany jak 1 (zew nigdy nie zabiera)', zw.pieczec('swarog', 2) === PUNKTY_PIECZECI);

console.log('\nRESET:');
m.reset();
spr('reset zeruje wynik, rozbicie i momenty', m.wynik === 0 && m.rozbicie.techniki === 0 && !m.momenty.techniki.kolowrot);

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-punkty.mjs`
Expected: FAIL — `Cannot find module '.../js/punkty.js'`

- [ ] **Step 3: Write minimal implementation**

`js/punkty.js`:

```js
/**
 * Punktacja - system punktowy trybów arcade.
 * Spec: docs/superpowers/specs/2026-10-01-punktacja-design.md
 *
 * PUNKTY TYLKO PRZYBYWAJĄ. GEMINI.md §2 przepisane 2026-10-01: z reguły
 * nadrzędnej zniknął "brak punktów/timera", ale rdzeń zostaje - nic nie
 * mówi "źle", nic nie zabiera. Żadna metoda tej klasy nie zmniejsza
 * `wynik`; malejący przyrost za powtarzanie DAJE MNIEJ, nigdy nie odejmuje.
 *
 * CZYSTA LOGIKA, BEZ DOM - jak kombosy.js. main.js zgłasza zdarzenia
 * (PUSH) w miejscach, które już istnieją w pętli; HUD (js/wynikHud.js)
 * odczytuje stan co klatkę (PULL), wzorzec paska sekwencji.
 *
 * Cztery warstwy: taniec (strumień), pieczęć (stała), technika (z tabeli),
 * reakcje (premie za łączenie technik - rejestr REAKCJE niżej).
 */

// Trudność pieczęci - Z POMIARU, nie zgadnięta: rozpoznawalność z
// tools/test-rozdzielnosc.mjs na prawdziwych nagraniach (komentarz przy
// Kołowrocie w js/kombosy.js): woda/ziemia ~1.0, błyskawica 0.70-1.00,
// powietrze 0.40-0.93, ogień 0.21-0.59. Im trudniej złożyć, tym więcej
// pieczęć wnosi do wartości techniki. NOWA PIECZĘĆ = nowy wpis tutaj,
// inaczej tools/test-punkty.mjs (strażnik) wywali się na czerwono.
export const TRUDNOSC = { mokosz: 1.0, weles: 1.0, perun: 1.2, stribog: 1.4, swarog: 1.6 };

// ZGADNIĘTE - do strojenia na żywym ciele. Proporcja jest celowa: 2 min
// samego tańca (~500) to mniej więcej dwie techniki - ktoś, komu nie
// wychodzą pieczęcie, dalej punktuje, ale combo wyraźnie się opłaca.
export const PUNKTY_TANCA_NA_S = 4;
export const PUNKTY_PIECZECI = 25;
export const BAZA_TECHNIKI = 100;
export const SPADEK_POWTORZENIA = 0.25;   // ta sama technika pod rząd: -25% za każde powtórzenie
export const PODLOGA_POWTORZENIA = 0.5;   // ...ale nigdy mniej niż połowa
export const PREMIA_SPLECENIA = 0.5;      // +50% wartości drugiej techniki (Task 2)

// Przycięcie dt tańca. Po powrocie na uśpioną kartę dt bywa sekundami -
// bez sufitu jedna klatka dopisałaby gratis punkty za czas, w którym
// nikt nie tańczył (i nikt nie widział).
const MAX_DT_TANCA_S = 0.1;

// Rejestr reakcji - uzupełniany w Task 3.
export const REAKCJE = {};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/**
 * Wartość techniki = BAZA × suma trudności jej pieczęci. Nowe combo
 * w KOMBOSY dostaje punkty automatycznie z tej formuły.
 * @returns {number} 0, gdy sekwencja zawiera pieczęć bez wpisu w TRUDNOSC
 *                   (w grze - zero zamiast NaN; w teście - czerwony strażnik)
 */
export function wartoscTechniki(kombo) {
    const s = kombo?.sekwencja;
    if (!Array.isArray(s) || !s.length) return 0;
    let suma = 0;
    for (const id of s) {
        const t = TRUDNOSC[id];
        if (!Number.isFinite(t)) return 0;
        suma += t;
    }
    return Math.round(BAZA_TECHNIKI * suma);
}

export class Punktacja {
    constructor() {
        this.aktywna = true;
        // Hak trybu Zew żywiołów (podprojekt 2): (rodzaj, arg) -> mnożnik.
        // Wartości < 1 i nieskończone są ignorowane - zew nigdy nie zabiera.
        this.mnoznikZewu = () => 1;
        this.reset();
    }

    /** Równy start rundy. Nie rusza `aktywna` ani `mnoznikZewu` - to ustawia tryb. */
    reset() {
        this.wynik = 0;
        this.rozbicie = { taniec: 0, pieczecie: 0, techniki: 0, reakcje: 0 };
        this.momenty = { serie: {}, techniki: {}, splecenia: 0 };
        this._zdarzenia = [];
        this._historia = [];          // [{id, t}] złożonych pieczęci - do splecenia (Task 2)
        this._poprzedniOgon = null;   // Set znaczników t ogona poprzedniej techniki
        this._ostatniaTechnika = null;
        this._powtorzen = 0;
        this._serie = {};             // reakcje (Task 3)
    }

    /** Jedyne miejsce, które zwiększa wynik. Odrzuca wszystko, co nie jest skończone i dodatnie. */
    _dodaj(warstwa, p) {
        if (!Number.isFinite(p) || p <= 0) return 0;
        this.wynik += p;
        this.rozbicie[warstwa] += p;
        return p;
    }

    _zew(rodzaj, arg) {
        const m = this.mnoznikZewu(rodzaj, arg);
        return Number.isFinite(m) && m >= 1 ? m : 1;
    }

    taniec(plynnosc, responsywnosc, dt) {
        if (!this.aktywna || !Number.isFinite(dt) || dt <= 0) return 0;
        return this._dodaj('taniec',
            PUNKTY_TANCA_NA_S * clamp01(plynnosc) * clamp01(responsywnosc) * Math.min(dt, MAX_DT_TANCA_S));
    }

    pieczec(id, now, miejsce = null) {
        if (!this.aktywna || typeof id !== 'string' || !id || !Number.isFinite(now)) return 0;
        this._historia.push({ id, t: now });
        if (this._historia.length > 16) this._historia.shift();   // najdłuższa sekwencja to 3
        const p = this._dodaj('pieczecie', PUNKTY_PIECZECI * this._zew('pieczec', id));
        if (p > 0) this._zdarzenia.push({ rodzaj: 'pieczec', tekst: '', punkty: p, t: now, miejsce });
        return p;
    }

    technika(kombo, now, miejsce = null) {
        if (!this.aktywna || !kombo || !Number.isFinite(now)) return 0;
        const baza = wartoscTechniki(kombo);
        if (baza <= 0) return 0;

        // Malejący przyrost: nagradza różnorodność, nie karze - punkty nie znikają.
        this._powtorzen = kombo.id === this._ostatniaTechnika ? this._powtorzen + 1 : 0;
        this._ostatniaTechnika = kombo.id;
        const czynnik = Math.max(PODLOGA_POWTORZENIA, 1 - SPADEK_POWTORZENIA * this._powtorzen);
        const p = this._dodaj('techniki', baza * czynnik * this._zew('technika', kombo));

        this.momenty.techniki[kombo.id] = (this.momenty.techniki[kombo.id] ?? 0) + 1;
        if (p > 0) this._zdarzenia.push({ rodzaj: 'technika', tekst: kombo.nazwa, punkty: p, t: now, miejsce });
        return p;
    }

    /** Kolejka do unoszących się napisów. PULL: HUD odbiera i kolejka pustoszeje. */
    odbierzZdarzenia() {
        const z = this._zdarzenia;
        this._zdarzenia = [];
        return z;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-punkty.mjs`
Expected: wszystkie `✓`, kod wyjścia 0.

- [ ] **Step 5: Commit**

```bash
git add js/punkty.js tools/test-punkty.mjs
git commit -m "Punktacja: rdzen - taniec, pieczec, technika, malejacy przyrost"
```

---

### Task 2: Splecenie — premia za nakładające się ogony

**Files:**
- Modify: `js/punkty.js` (metoda `technika`)
- Test: `tools/test-punkty.mjs` (nowa sekcja przed `process.exit`)

**Interfaces:**
- Consumes: `Punktacja` z Task 1; kontrakt wywołań z main.js: `pieczec(id, now)` jest wołane PRZED `technika(kombo, now)` dla tej samej pieczęci.
- Produces: `technika()` zwraca sumę wartości + premii; zdarzenie `{rodzaj:'splecenie', tekst:'Splecenie', ...}`; `momenty.splecenia`.

- [ ] **Step 1: Write the failing test**

Dopisać do `tools/test-punkty.mjs` przed `process.exit`:

```js
console.log('\nSPLECENIE (nakładanie ogonów, nie czas):');
// Ten sam łańcuch co w test-kombosy.mjs: swarog->stribog->swarog daje
// Okadzenie, a ZARAZ potem (bez czyszczenia bufora) perun domyka Grom
// w Ogniu ogonem [swarog, perun] - swarog jest WSPÓLNY. Czwarta pieczęć
// składa się >= 0.9 s po trzeciej, więc próg czasowy by tu nie zadziałał.
const s = new Punktacja();
s.pieczec('swarog', 0); s.pieczec('stribog', 1000); s.pieczec('swarog', 2000);
const okadzenie = s.technika(kombo('dym'), 2000);
s.pieczec('perun', 3500);   // 1.5 s później
const grom = s.technika(kombo('gromWOgniu'), 3500);
spr(`Okadzenie bez premii (${okadzenie})`, okadzenie === 460);
spr(`Grom w Ogniu z premią +50% (${grom})`, grom === 280 + 140);
spr('rozbicie: premia w reakcjach', s.rozbicie.reakcje === 140 && s.rozbicie.techniki === 740);
spr('momenty.splecenia = 1', s.momenty.splecenia === 1);
spr('zdarzenie Splecenie w kolejce', s.odbierzZdarzenia().some(z => z.rodzaj === 'splecenie' && z.punkty === 140));

const bez = new Punktacja();
bez.pieczec('perun', 0); bez.pieczec('weles', 1000); bez.pieczec('mokosz', 2000);
bez.technika(kombo('kolowrot'), 2000);
bez.pieczec('swarog', 3000); bez.pieczec('perun', 4000);
bez.technika(kombo('gromWOgniu'), 4000);
spr(`ogony bez wspólnej pieczęci - brak premii (${bez.rozbicie.reakcje})`, bez.rozbicie.reakcje === 0);

// REVIEW FOCUS 1: stribog x3 odpala Aarda dwa razy z nakładającymi się
// ogonami. Splecenie TEJ SAMEJ techniki ze sobą nagradzałoby spam.
const spam = new Punktacja();
spam.pieczec('stribog', 0); spam.pieczec('stribog', 1000);
spam.technika(kombo('aard'), 1000);
spam.pieczec('stribog', 2000);
spam.technika(kombo('aard'), 2000);
spr(`ta sama technika nie splata się sama ze sobą (${spam.rozbicie.reakcje})`, spam.rozbicie.reakcje === 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-punkty.mjs`
Expected: FAIL na `Grom w Ogniu z premią +50% (280)`.

- [ ] **Step 3: Write minimal implementation**

W `js/punkty.js`, w `technika()`, zastąpić blok od `this.momenty.techniki[...]` do `return p;`:

```js
        // SPLECENIE - po NAKŁADANIU OGONÓW, nie po czasie. Bufor kombosów nie
        // jest czyszczony po trafieniu (kombosy.js, "łańcuchy są celowe"), więc
        // pieczęć dzieląca ogony dwóch technik to naturalny sygnał "połączyłeś".
        // Ogon = ostatnie N pieczęci z WŁASNEJ historii (main.js woła pieczec()
        // przed technika()), identyfikowane znacznikiem czasu, nie pozycją.
        // Ta sama technika ze sobą NIE splata się - inaczej stribog x N
        // (każdy kolejny odpala Aarda) byłby najlepszą strategią.
        const n = kombo.sekwencja.length;
        const ogon = new Set(this._historia.slice(-n).map(w => w.t));
        let premia = 0;
        if (this._poprzedniOgon && this._poprzedniOgon.id !== kombo.id
            && [...ogon].some(t => this._poprzedniOgon.t.has(t))) {
            premia = this._dodaj('reakcje', p * PREMIA_SPLECENIA);
            if (premia > 0) this.momenty.splecenia++;
        }
        this._poprzedniOgon = { id: kombo.id, t: ogon };

        this.momenty.techniki[kombo.id] = (this.momenty.techniki[kombo.id] ?? 0) + 1;
        if (p > 0) this._zdarzenia.push({ rodzaj: 'technika', tekst: kombo.nazwa, punkty: p, t: now, miejsce });
        if (premia > 0) this._zdarzenia.push({ rodzaj: 'splecenie', tekst: 'Splecenie', punkty: premia, t: now, miejsce });
        return p + premia;
```

oraz w `reset()` komentarz przy `_poprzedniOgon` zmienić na: `// {id, t:Set} ogona poprzedniej techniki`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-punkty.mjs`
Expected: wszystkie `✓`.

- [ ] **Step 5: Commit**

```bash
git add js/punkty.js tools/test-punkty.mjs
git commit -m "Punktacja: splecenie po nakladaniu ogonow"
```

---

### Task 3: Reakcje — rejestr, serie, malejący przyrost

**Files:**
- Modify: `js/punkty.js` (`REAKCJE`, `punktyJednostki`, metody `reakcja`, `serieAktywne`)
- Test: `tools/test-punkty.mjs`

**Interfaces:**
- Consumes: `Punktacja` z Task 1–2.
- Produces:
  - `REAKCJE = { pozoga: {nazwa:'Pożoga', punkty:8, pelneDo:50, przerwaMs:1500}, rozwianie: {nazwa:'Rozwianie', punkty:3, pelneDo:40, przerwaMs:1500} }`
  - `punktyJednostki(def, k) → number` (k od 1)
  - `Punktacja.reakcja(id, n, now) → number`
  - `Punktacja.serieAktywne(now) → Array<{id, nazwa, n, punkty}>`
  - `momenty.serie[id]` = największa seria (liczba jednostek) w rundzie

- [ ] **Step 1: Write the failing test**

Dopisać przed `process.exit`:

```js
console.log('\nREAKCJE:');
const { REAKCJE, punktyJednostki } = await import('../js/punkty.js');
spr('pozoga i rozwianie w rejestrze', !!REAKCJE.pozoga && !!REAKCJE.rozwianie);
spr('jednostka pełna do progu', punktyJednostki(REAKCJE.pozoga, 50) === 8);
spr('za progiem maleje', punktyJednostki(REAKCJE.pozoga, 100) === 4);

const r = new Punktacja();
spr(`10 kłębów = 80 (${r.reakcja('pozoga', 10, 0)})`, r.wynik === 80);
r.reakcja('pozoga', 40, 500);   // ta sama seria (przerwa < 1.5 s)
spr(`50 kłębów w jednym pożarze = 400 (${r.wynik})`, r.wynik === 400);
const przed = r.wynik;
r.reakcja('pozoga', 50, 1000);  // kłęby 51..100 - malejąco
const dorzut = r.wynik - przed;
spr(`kłęby 51-100 dają mniej niż pierwsze 50 (${dorzut.toFixed(0)})`, dorzut > 0 && dorzut < 400);
spr('momenty.serie.pozoga = 100', r.momenty.serie.pozoga === 100);

const nowy = new Punktacja();
nowy.reakcja('pozoga', 60, 0);
nowy.reakcja('pozoga', 10, 3000);   // przerwa 3 s > 1.5 s - NOWY pożar, pełne punkty
spr('nowy pożar po przerwie zaczyna od pełnych punktów', Math.abs(nowy.rozbicie.reakcje - (punktyJednostkiSuma(60) + 80)) < 1e-6);
function punktyJednostkiSuma(n) { let s = 0; for (let k = 1; k <= n; k++) s += punktyJednostki(REAKCJE.pozoga, k); return s; }

// REVIEW FOCUS 3
const zle = new Punktacja();
zle.reakcja('pozoga', 0, 0); zle.reakcja('pozoga', -5, 0); zle.reakcja('pozoga', NaN, 0);
zle.reakcja('pozoga', 3, NaN); zle.reakcja('nieznana', 5, 0);
spr('n <= 0, NaN, zły czas i nieznana reakcja nic nie dają', zle.wynik === 0);
zle.reakcja('pozoga', 2.9, 0);
spr('ułamek zaokrąglany w dół (2 kłęby = 16)', zle.wynik === 16);

// REVIEW FOCUS 5: reakcje NIE idą do kolejki unoszących się napisów (co
// klatkę by zalały ekran) - HUD pokazuje je jako zagregowaną serię.
spr('reakcja nie tworzy zdarzeń', zle.odbierzZdarzenia().length === 0);
const aktywne = r.serieAktywne(1000);
spr(`seria aktywna: Pożoga ×100 (${aktywne.map(s => s.nazwa + '×' + s.n).join()})`,
    aktywne.length === 1 && aktywne[0].nazwa === 'Pożoga' && aktywne[0].n === 100);
spr('seria wygasa po przerwie', r.serieAktywne(1000 + 1600).length === 0);

console.log('\nNIGDY NIE MALEJE (losowe wywołania):');
const los = new Punktacja();
const smieci = [NaN, Infinity, -Infinity, -1, 0, 0.5, 1, 1e9, undefined, null];
const wez = () => smieci[Math.floor(Math.random() * smieci.length)];
let poprz = 0, monot = true;
for (let i = 0; i < 2000; i++) {
    const t = i * 37;
    switch (i % 5) {
        case 0: los.taniec(wez(), wez(), wez()); break;
        case 1: los.pieczec(['swarog', 'perun', '', null][i % 4], wez() ?? t); break;
        case 2: los.technika(KOMBOSY[i % KOMBOSY.length], t); break;
        case 3: los.reakcja(['pozoga', 'rozwianie', 'x'][i % 3], wez(), t); break;
        case 4: los.reakcja('pozoga', 5, t); break;
    }
    if (!(los.wynik >= poprz) || !Number.isFinite(los.wynik)) monot = false;
    poprz = los.wynik;
}
spr(`wynik monotoniczny i skończony (${los.wynik.toFixed(0)})`, monot);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-punkty.mjs`
Expected: FAIL — `punktyJednostki is not a function` (lub `pozoga i rozwianie w rejestrze` ✗).

- [ ] **Step 3: Write minimal implementation**

W `js/punkty.js` zastąpić `export const REAKCJE = {};` i dopisać funkcję:

```js
// REJESTR REAKCJI - premie za łączenie technik. Nowa reakcja to JEDEN
// wpis tutaj plus jedno punkty.reakcja(id, n, now) tam, gdzie zachodzi
// (tools/test-punkty.mjs sprawdza, że każde id wołane z main.js tu jest).
//
// SERIA: jednostki (kłęby) w odstępach < przerwaMs to jedno zdarzenie
// ("jeden pożar"). Pełne punkty do `pelneDo` jednostek w serii, potem
// punkty × pelneDo/k - suma rośnie logarytmicznie. Kolumna dymu to SETKI
// cząstek; bez tego jedna detonacja przebijałaby kilka technik.
// ZGADNIĘTE - cel balansu w specu (pełna Pożoga ≈ 1.5-2× Okadzenia),
// potwierdzany pomiarem w tools/scena.html.
export const REAKCJE = {
    // Wybuchnięty kłąb podpalonego dymu (js/dym.js - updateAndDraw).
    pozoga: { nazwa: 'Pożoga', punkty: 8, pelneDo: 50, przerwaMs: 1500 },
    // Kłąb dymu pchnięty PO RAZ PIERWSZY daną falą Aarda/Gromu (dym.ostatnioRozwiane).
    rozwianie: { nazwa: 'Rozwianie', punkty: 3, pelneDo: 40, przerwaMs: 1500 }
};

/** Punkty za k-tą (od 1) jednostkę serii reakcji. */
export function punktyJednostki(def, k) {
    return def.punkty * Math.min(1, def.pelneDo / k);
}
```

W klasie, za `technika()`:

```js
    /**
     * @param {string} id   klucz REAKCJE
     * @param {number} n    jednostek w tej klatce (ułamek w dół, <= 0 nic)
     * @param {number} now  ms
     */
    reakcja(id, n, now) {
        const def = REAKCJE[id];
        if (!this.aktywna || !def || !Number.isFinite(n) || !Number.isFinite(now)) return 0;
        const ile = Math.floor(n);
        if (ile <= 0) return 0;

        let s = this._serie[id];
        if (!s || now - s.ostatnieT > def.przerwaMs) {
            s = this._serie[id] = { n: 0, punkty: 0, ostatnieT: now };
        }
        let p = 0;
        for (let i = 0; i < ile; i++) p += punktyJednostki(def, ++s.n);
        s.ostatnieT = now;
        p = this._dodaj('reakcje', p);
        s.punkty += p;
        this.momenty.serie[id] = Math.max(this.momenty.serie[id] ?? 0, s.n);
        // CELOWO bez zdarzenia w kolejce - reakcje przychodzą co klatkę
        // i zalałyby ekran napisami; HUD czyta serieAktywne().
        return p;
    }

    /** Serie reakcji wciąż trwające - HUD pokazuje je jako "Pożoga ×23 +184". */
    serieAktywne(now) {
        const out = [];
        for (const [id, s] of Object.entries(this._serie)) {
            if (Number.isFinite(now) && now - s.ostatnieT <= REAKCJE[id].przerwaMs) {
                out.push({ id, nazwa: REAKCJE[id].nazwa, n: s.n, punkty: s.punkty });
            }
        }
        return out;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-punkty.mjs`
Expected: wszystkie `✓`.

- [ ] **Step 5: Commit**

```bash
git add js/punkty.js tools/test-punkty.mjs
git commit -m "Punktacja: rejestr reakcji, serie z malejacym przyrostem"
```

---

### Task 4: Dym liczy rozwiane kłęby (pierwsze trafienie daną falą)

**Files:**
- Modify: `js/fala.js:393` (`wystrzel` — id czoła), `js/dym.js` (konstruktor ~l. 172, `_fizyka` pętla podmuchów ~l. 526, `updateAndDraw` ~l. 351), `js/main.js:657-662`, `tools/scena.html:396-399`
- Test: `tools/test-dym.mjs`, `tools/test-fala.mjs`

**Interfaces:**
- Consumes: istniejące `dym.pchnij(punkty)`, `pchniecieCzola()`, `fala.czola`.
- Produces: `czolo.id:number` (unikalne, rosnące) w `fala.czola`; punkty pchnięcia mogą nieść `idFali:number`; `dym.ostatnioRozwiane:number` — kłęby trafione w ostatniej klatce PO RAZ PIERWSZY przez daną falę. Punkty bez `idFali` pchają, ale nie liczą się.

- [ ] **Step 1: Write the failing tests**

W `tools/test-fala.mjs` przed `process.exit` (helper `spr` i import `Fala` już są w pliku):

```js
console.log('\nID CZOŁA (rozwianie dymu liczone raz na falę):');
{
    const f = new Fala();
    f.wystrzel({ x: 500, y: 500 }, { x: 1, y: 0, z: 0 }, 1);
    f.wystrzel({ x: 500, y: 500 }, { x: 1, y: 0, z: 0 }, 1);
    const ids = f.czola.map(c => c.id);
    spr(`każde czoło ma unikalne id (${ids.join(', ')})`, ids.length === 2 && Number.isFinite(ids[0]) && ids[0] !== ids[1]);
}
```

W `tools/test-dym.mjs` przed `process.exit`:

```js
console.log('\nROZWIANIE - kłąb liczy się RAZ na falę:');
{
    const d = new Dym();
    for (let i = 0; i < 30; i++) { d.emituj(USTA, W_PRAWO, 1, 1, DT, W, H); d.updateAndDraw(null, W, H, DT); }
    const cel = d._czastki[0];
    // Ogromne koło pchnięcia nad całym ekranem - trafia wszystko.
    const fala = (idFali) => [{ x: USTA.x, y: USTA.y, r: 5000, vx: 100, vy: 0, sila: 1, idFali }];
    d.pchnij(fala(1)); d.updateAndDraw(null, W, H, DT);
    const pierwsze = d.ostatnioRozwiane;
    spr(`pierwsza klatka fali liczy kłęby (${pierwsze})`, pierwsze > 0 && pierwsze <= d._czastki.length);
    let kolejne = 0;
    for (let i = 0; i < 40; i++) { d.pchnij(fala(1)); d.updateAndDraw(null, W, H, DT); kolejne += d.ostatnioRozwiane; }
    spr(`ta sama fala przez 40 klatek nie liczy ich ponownie (${kolejne})`, kolejne === 0);
    d.pchnij(fala(2)); d.updateAndDraw(null, W, H, DT);
    spr(`NOWA fala liczy je znowu (${d.ostatnioRozwiane})`, d.ostatnioRozwiane > 0);
    d.pchnij([{ x: USTA.x, y: USTA.y, r: 5000, vx: 100, vy: 0, sila: 1 }]); d.updateAndDraw(null, W, H, DT);
    spr('punkt bez idFali pcha, ale się nie liczy', d.ostatnioRozwiane === 0);
    d.updateAndDraw(null, W, H, DT);
    spr('bez podmuchów ostatnioRozwiane = 0', d.ostatnioRozwiane === 0);
    spr('świeży Dym ma ostatnioRozwiane = 0', new Dym().ostatnioRozwiane === 0);
    void cel;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/test-fala.mjs; node tools/test-dym.mjs`
Expected: FAIL — `każde czoło ma unikalne id (undefined, undefined)` i `pierwsza klatka fali liczy kłęby (undefined)`.

- [ ] **Step 3: Implement**

`js/fala.js` — nad `export class Fala`:

```js
// Id czoła - rosnący licznik modułu, nie losowy. Dym (js/dym.js) zapamiętuje
// id fal, które trafiły kłąb, i liczy do punktów (reakcja "rozwianie")
// tylko PIERWSZE trafienie - czoło żyje ~0.7 s i pcha dym co klatkę.
let nastepneIdCzola = 1;
```

w `wystrzel()` zmienić push (l. 393) na:

```js
        this.czola.push({ id: nastepneIdCzola++, zaczep: { x: zaczep.x, y: zaczep.y }, kierunek: os, sila: s, barwa: b, wiek: 0, smugi });
```

`js/dym.js` — w konstruktorze obok `this._nowychWybuchow = 0;`:

```js
        this.ostatnioRozwiane = 0;   // kłęby trafione w tej klatce PO RAZ PIERWSZY daną falą (punkty: reakcja 'rozwianie')
```

w `updateAndDraw` obok `this._nowychWybuchow = 0;` (l. 351, PRZED guardem `return 0` też — patrz niżej):

```js
        this.ostatnioRozwiane = 0;
```

Uwaga: guard `if (!maszyna || krok <= 0) return 0;` stoi przed zerowaniem — przenieść `this.ostatnioRozwiane = 0;` NAD guard, żeby pusta klatka też zerowała.

w `_fizyka`, w pętli `for (const p of this._podmuchy)` zaraz po `if (wplyw <= 0) continue;`:

```js
                // Punkty: kłąb liczy się RAZ na falę (czoło pcha go co klatkę
                // przez ~0.7 s - bez tego jeden Aard punktowałby kłąb ~40 razy).
                if (Number.isFinite(p.idFali)) {
                    c.trafioneFale ??= [];
                    if (!c.trafioneFale.includes(p.idFali)) {
                        c.trafioneFale.push(p.idFali);
                        if (c.trafioneFale.length > 8) c.trafioneFale.shift();
                        this.ostatnioRozwiane++;
                    }
                }
```

`js/main.js:659-661` — pętla czół:

```js
        for (const c of fala.czola) {
            for (const p of pchniecieCzola(c.zaczep, c.kierunek, c.sila, c.wiek, dt, 24)) {
                p.idFali = c.id;
                podmuchy.push(p);
            }
        }
```

`tools/scena.html:398` — ta sama zmiana:

```js
        for (const c of fala.czola) for (const p of pchniecieCzola(c.zaczep, c.kierunek, c.sila, c.wiek, dt, 24)) { p.idFali = c.id; podmuchy.push(p); }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓` (w tym stare testy dym/fala — nic nie zależy od braku pola `id`).

- [ ] **Step 5: Commit**

```bash
git add js/fala.js js/dym.js js/main.js tools/scena.html tools/test-dym.mjs tools/test-fala.mjs
git commit -m "Dym liczy rozwiane klęby raz na fale (pod punktacje)"
```

---

### Task 5: HUD wyniku

**Files:**
- Create: `js/wynikHud.js`
- Modify: `index.html` (nowy blok w `#ui-layer`), `style.css` (style + reduced-motion)
- Test: `tools/test-wynik-hud.mjs`

**Interfaces:**
- Consumes: `Punktacja.wynik`, `.aktywna`, `.odbierzZdarzenia()`, `.serieAktywne(now)` (Task 1–3).
- Produces: `formatujWynik(w)→string`, `pozycjaWLustrze(miejsce, W, H)→{lewo, gora}` (procenty), `tekstZdarzenia(z)→string`, `tekstSerii(s)→string`, `MAX_UNOSZACYCH = 12`, `class WynikHud(root)` z `update(punktacja, now, W, H)`.

- [ ] **Step 1: Write the failing test**

`tools/test-wynik-hud.mjs`:

```js
/**
 * HUD wyniku - czyste funkcje (DOM sprawdzany w przeglądarce).
 *   node tools/test-wynik-hud.mjs
 */
import { formatujWynik, pozycjaWLustrze, tekstZdarzenia, tekstSerii, WynikHud, MAX_UNOSZACYCH } from '../js/wynikHud.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('FORMAT:');
spr('ułamek w dół', formatujWynik(12.9) === '12');
spr('NaN/ujemne = 0', formatujWynik(NaN) === '0' && formatujWynik(-5) === '0');

console.log('\nLUSTRO:');
const p = pozycjaWLustrze({ x: 100, y: 500 }, 1000, 1000);
spr(`x=100 z 1000 -> 90% od lewej (${p.lewo})`, Math.abs(p.lewo - 90) < 1e-9 && Math.abs(p.gora - 50) < 1e-9);
const brzeg = pozycjaWLustrze({ x: -500, y: 5000 }, 1000, 1000);
spr('przycięte do ekranu (5..95, 8..90)', brzeg.lewo === 95 && brzeg.gora === 90);
const brak = pozycjaWLustrze(null, 1000, 1000);
spr('brak miejsca = środek', brak.lewo === 50 && brak.gora === 40);
spr('NaN w miejscu = środek', pozycjaWLustrze({ x: NaN, y: 1 }, 1000, 1000).lewo === 50);

console.log('\nTEKSTY:');
spr('technika', tekstZdarzenia({ punkty: 340.4, tekst: 'Okadzenie' }) === '+340 Okadzenie');
spr('pieczęć bez tekstu', tekstZdarzenia({ punkty: 25, tekst: '' }) === '+25');
spr('seria', tekstSerii({ nazwa: 'Pożoga', n: 23, punkty: 184.2 }) === 'Pożoga ×23 · +184');

console.log('\nBEZ DOM:');
const h = new WynikHud(null);
spr('update bez elementów nie rzuca', (h.update({ wynik: 1, aktywna: true, odbierzZdarzenia: () => [], serieAktywne: () => [] }, 0, 100, 100), true));
spr('sufit unoszących = 12', MAX_UNOSZACYCH === 12);

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-wynik-hud.mjs`
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Implement**

`js/wynikHud.js`:

```js
/**
 * HUD wyniku - licznik w lewym górnym rogu, unoszące się "+340 Okadzenie"
 * w miejscu zdarzenia i zagregowane serie reakcji ("Pożoga ×23 · +184").
 *
 * DOM, NIE PŁÓTNO - te same powody co js/sekwencja.js (lustrzane płótno,
 * webfont). Podział jak tam: funkcje CZYSTE liczą (testy w node), klasa
 * tylko aplikuje do elementów; brak elementów = cicho nic nie robi.
 *
 * Reakcje NIE dostają unoszących się napisów - przychodzą co klatkę
 * i zalałyby ekran. Idą jako jedna linijka serii pod licznikiem.
 */
export const MAX_UNOSZACYCH = 12;
const CZAS_UNOSZENIA_MS = 1400;   // = czas animacji .unosi w style.css

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function formatujWynik(w) {
    return String(Math.floor(Number.isFinite(w) ? Math.max(0, w) : 0));
}

/** Piksele płótna -> procenty CSS warstwy UI. Płótno jest lustrzane (scaleX(-1)). */
export function pozycjaWLustrze(miejsce, W, H) {
    if (!miejsce || !Number.isFinite(miejsce.x) || !Number.isFinite(miejsce.y) || !(W > 0) || !(H > 0)) {
        return { lewo: 50, gora: 40 };
    }
    return {
        lewo: clamp(100 * (1 - miejsce.x / W), 5, 95),
        gora: clamp(100 * miejsce.y / H, 8, 90)
    };
}

export function tekstZdarzenia(z) {
    const p = `+${Math.round(z.punkty)}`;
    return z.tekst ? `${p} ${z.tekst}` : p;
}

export function tekstSerii(s) {
    return `${s.nazwa} ×${s.n} · +${Math.round(s.punkty)}`;
}

export class WynikHud {
    constructor(root) {
        this.root = root ?? null;
        this.licznik = root?.querySelector('#wynik-licznik') ?? null;
        this.serie = root?.querySelector('#wynik-serie') ?? null;
        // #wynik-unoszace leży POZA #wynik-hud (pełnoekranowa warstwa) - stąd getElementById.
        this.warstwa = root ? document.getElementById('wynik-unoszace') : null;
        this._ostatniLicznik = '';
        this._ostatnieSerie = '';
    }

    update(punktacja, now, W, H) {
        const zdarzenia = punktacja.odbierzZdarzenia();   // odbierz ZAWSZE - kolejka nie może rosnąć bez HUD
        if (!this.root) return;
        this.root.classList.toggle('wylaczony', !punktacja.aktywna);
        if (!punktacja.aktywna) return;

        const l = formatujWynik(punktacja.wynik);
        if (l !== this._ostatniLicznik && this.licznik) {
            this.licznik.textContent = l;
            this._ostatniLicznik = l;
        }

        const s = punktacja.serieAktywne(now).map(tekstSerii).join('   ');
        if (s !== this._ostatnieSerie && this.serie) {
            this.serie.textContent = s;
            this._ostatnieSerie = s;
        }

        if (!this.warstwa) return;
        for (const z of zdarzenia) {
            while (this.warstwa.childElementCount >= MAX_UNOSZACYCH) this.warstwa.firstElementChild.remove();
            const el = document.createElement('span');
            el.className = `unosi unosi-${z.rodzaj}`;
            el.textContent = tekstZdarzenia(z);
            const { lewo, gora } = pozycjaWLustrze(z.miejsce, W, H);
            el.style.left = `${lewo}%`;
            el.style.top = `${gora}%`;
            this.warstwa.appendChild(el);
            // animationend nie przychodzi przy reduced-motion bez animacji -
            // setTimeout to jedyne pewne sprzątanie.
            setTimeout(() => el.remove(), CZAS_UNOSZENIA_MS + 100);
        }
    }
}
```

`index.html` — w `#ui-layer`, zaraz po `#loading-screen`:

```html
        <!-- Wynik (punktacja, 2026-10-01) - DOM, nie płótno (lustro). Licznik,
             serie reakcji i warstwa unoszących się "+340 Okadzenie". -->
        <div id="wynik-hud" class="hidden">
            <div id="wynik-licznik">0</div>
            <div id="wynik-serie"></div>
        </div>
        <div id="wynik-unoszace" aria-hidden="true"></div>
```

`style.css` — przed blokiem `@media (prefers-reduced-motion: reduce)`:

```css
/* --- WYNIK (punktacja, 2026-10-01) ---
   Lewy górny róg: środek góry zajmuje #instruction-hud, prawy róg
   wskaźnik dźwięku. */
#wynik-hud {
    position: absolute;
    top: 14px;
    left: 18px;
    z-index: 15;
    pointer-events: none;
    font-family: 'Bona Nova SC', serif;
    color: var(--zloto);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9), 0 0 18px rgba(255, 122, 26, 0.45);
    transition: opacity 0.4s ease;
}
#wynik-hud.wylaczony { opacity: 0; }
#wynik-licznik {
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
#wynik-serie {
    margin-top: 0.3rem;
    font-size: 1rem;
    color: var(--plomien);
    min-height: 1.2em;
}
#wynik-unoszace {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 14;
    overflow: hidden;
}
.unosi {
    position: absolute;
    transform: translate(-50%, -50%);
    font-family: 'Bona Nova SC', serif;
    font-weight: 700;
    font-size: 1.3rem;
    color: var(--kosc);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9), 0 0 14px rgba(255, 179, 71, 0.7);
    white-space: nowrap;
    animation: unies 1.4s ease-out forwards;
}
.unosi-technika { font-size: 1.9rem; color: var(--plomien); }
.unosi-splecenie { font-size: 1.5rem; color: var(--zloto); }
@keyframes unies {
    0%   { opacity: 0; transform: translate(-50%, -30%) scale(0.85); }
    15%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -160%) scale(1); }
}
@keyframes zanik {
    0%, 60% { opacity: 1; }
    100% { opacity: 0; }
}
```

i WEWNĄTRZ istniejącego `@media (prefers-reduced-motion: reduce) { ... }` dopisać:

```css
    .unosi {
        animation-name: zanik;   /* bez ruchu - tylko zanik */
        transform: translate(-50%, -50%);
    }
```

- [ ] **Step 4: Run tests**

Run: `node tools/test-wynik-hud.mjs && sh tools/test-wszystko.sh`
Expected: wszystkie `✓`.

- [ ] **Step 5: Commit**

```bash
git add js/wynikHud.js tools/test-wynik-hud.mjs index.html style.css
git commit -m "HUD wyniku: licznik, serie reakcji, unoszace sie punkty"
```

---

### Task 6: Wpięcie w main.js + strażnik reakcji

**Files:**
- Modify: `js/main.js` (importy, instancje ~l. 134, start ~l. 266, blok 6a ~l. 540, po `dym.updateAndDraw` ~l. 665, koniec klatki obok `sekwencja.update` ~l. 766)
- Test: `tools/test-punkty.mjs` (strażnik: reakcje wołane z main.js istnieją)

**Interfaces:**
- Consumes: `Punktacja` (Task 1–3), `WynikHud` (Task 5), `dym.ostatnioRozwiane` (Task 4), `srodekDloni(frame, W, H)` z `js/efekty.js`, `motionMeter.responsywnosc`.
- Produces: punktacja działa w grze; `punkty` (instancja) dostępna w main.js dla podprojektu 2.

- [ ] **Step 1: Write the failing test**

Dopisać do `tools/test-punkty.mjs` przed `process.exit`:

```js
console.log('\nSTRAŻNIK: reakcje wołane z main.js istnieją w REAKCJE:');
{
    const { readFileSync } = await import('node:fs');
    const zrodlo = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    const wolane = [...zrodlo.matchAll(/punkty\.reakcja\(\s*'(\w+)'/g)].map(m => m[1]);
    spr(`main.js woła reakcje (${wolane.join(', ')})`, wolane.length >= 2);
    for (const id of wolane) spr(`'${id}' jest w REAKCJE`, !!REAKCJE[id]);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-punkty.mjs`
Expected: FAIL — `main.js woła reakcje ()`.

- [ ] **Step 3: Implement**

`js/main.js`:

Importy (obok `import { KomboSilnik } ...`):

```js
import { Punktacja } from './punkty.js';
import { WynikHud } from './wynikHud.js';
```

Istniejący import `import { Efekty } from './efekty.js';` (l. 17) rozszerzyć do `import { Efekty, srodekDloni } from './efekty.js';`.

Instancje (obok `let kombosy = new KomboSilnik();`):

```js
// Punktacja (2026-10-01, spec docs/superpowers/specs/2026-10-01-punktacja-design.md).
// PUSH zdarzeń w istniejących miejscach pętli, HUD czyta PULL co klatkę.
let punkty = new Punktacja();
const wynikHud = new WynikHud(document.getElementById('wynik-hud'));
```

Start gry (obok `uiSekwencjaRun.classList.remove('hidden');`):

```js
        document.getElementById('wynik-hud').classList.remove('hidden');
```

Blok 6a — zaraz po `motionMeter.zuzyj(skl.zlozona.koszt);`:

```js
        // Punkty: pieczec() PRZED technika() - splecenie czyta ogon z własnej
        // historii pieczęci (js/punkty.js), więc ta pieczęć musi już w niej być.
        const miejscePunktow = srodekDloni(frame, canvas.width, canvas.height);
        punkty.pieczec(skl.zlozona.id, now, miejscePunktow);
```

i wewnątrz `if (technika) {`, jako pierwsza linia:

```js
            punkty.technika(technika, now, miejscePunktow);
```

Po `const wybuchyDymu = dym.updateAndDraw(...)`:

```js
    // Reakcje - premie za łączenie technik (rejestr REAKCJE w js/punkty.js).
    punkty.reakcja('pozoga', wybuchyDymu, now);
    punkty.reakcja('rozwianie', dym.ostatnioRozwiane, now);
```

Obok `sekwencja.update(now, kombosy.aktywne(now), skl.skladana, skl.postep);`:

```js
    punkty.taniec(plynnosc, motionMeter.responsywnosc, dt);
    wynikHud.update(punkty, now, canvas.width, canvas.height);
```

`dt` w `klatka()` jest już w SEKUNDACH i przycięte do 0,1 (main.js:451) — przekazywać bez zmian.

- [ ] **Step 4: Run tests**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓`.

- [ ] **Step 5: Smoke test w przeglądarce**

Zatrzymaj ewentualny serwer, uruchom statyczny: `python3 -m http.server 8000` w katalogu repo (w tle). Otwórz `http://localhost:8000/` z twardym przeładowaniem (GEMINI.md §6 — cache modułów). Kliknij „Rozpal ogień", tańcz przed kamerą: licznik w lewym górnym rogu rośnie powoli; złożenie pieczęci daje unoszące się `+25`; konsola bez błędów (`read_console_messages`, wzorzec `Error|punkty|wynik`).

- [ ] **Step 6: Commit**

```bash
git add js/main.js tools/test-punkty.mjs
git commit -m "Punktacja wpieta w petle gry"
```

---

### Task 7: Pomiar Pożogi, strojenie, dokumentacja

**Files:**
- Modify: `tools/scena.html` (licznik punktów pożaru), `js/punkty.js` (stałe po pomiarze), `docs/superpowers/specs/2026-10-01-punktacja-design.md` (zmierzone liczby), `GEMINI.md` (§2, §3 tabela plików, §6), pamięć `kula-mocy-regula-nic-nie-mowi-zle.md` + `MEMORY.md`

**Interfaces:**
- Consumes: wszystko powyżej.
- Produces: zmierzony zakres punktów pełnej Pożogi zapisany w specu; stałe `REAKCJE.pozoga` dostrojone do celu (≈ 700–900 pkt za pełną detonację, ≤ ~3 techniki).

- [ ] **Step 1: Dodaj pomiar do scena.html**

W `tools/scena.html` zaimportuj `Punktacja` i po `const wybuchy = dym.updateAndDraw(...)` dopisz:

```js
    punktyPomiar.reakcja('pozoga', wybuchy, performance.now());
    punktyPomiar.reakcja('rozwianie', dym.ostatnioRozwiane, performance.now());
    for (const s of punktyPomiar.serieAktywne(performance.now())) {
        console.log(`[pomiar] ${s.nazwa} ×${s.n} = ${Math.round(s.punkty)} pkt`);
    }
```

z `const punktyPomiar = new Punktacja();` przy innych instancjach.

- [ ] **Step 2: Zmierz**

W scena.html: Okadzenie, dmuchanie ~5 s (pełna kolumna), potem Płonący Palec w dym. Odczytaj ostatni wpis `[pomiar] Pożoga ×N = P pkt` (`read_console_messages`, wzorzec `\[pomiar\]`). Powtórz 3× (krótkie / średnie / długie dmuchanie). Zapisz N i P.

- [ ] **Step 3: Dostrój**

Jeśli P dla długiego dmuchania > ~900 lub < ~600: zmień `pelneDo` (i ewentualnie `punkty`) w `REAKCJE.pozoga` tak, żeby trafić w 700–900, korzystając ze wzoru: `P ≈ punkty × pelneDo × (1 + ln(N / pelneDo))` dla N > pelneDo. Uruchom `node tools/test-punkty.mjs` — testy sekcji REAKCJE używają wartości 8/50; jeśli je zmieniasz, zaktualizuj oczekiwane liczby w teście (400, 80, `punktyJednostki(…, 100) === 4`) zgodnie z nowymi stałymi.

- [ ] **Step 4: Dokumentacja**

- Spec, sekcja „Cel balansu": dopisz tabelkę zmierzonych N/P i ostateczne stałe.
- `GEMINI.md` §2: zastąp punkt „**Brak punktów, timera, stanu porażki.** Nagrodą jest sam efekt." tekstem: „**Punkty tylko przybywają** (od 2026-10-01, tryby arcade): nic ich nie odejmuje, combo nie resetuje się za pomyłkę, koniec rundy to podsumowanie, nie porażka. Tryb swobodny — bez punktów i czasu, jak dawniej. Brak stanu porażki."
- `GEMINI.md` §3 tabela plików: wiersze `js/punkty.js` (punktacja: warstwy, trudność z pomiaru, rejestr REAKCJE, splecenie po ogonach) i `js/wynikHud.js` (HUD wyniku, DOM).
- Pamięć: w `/Users/whomean/.claude/projects/-Users-whomean-Documents-antigravity-powerball-app/memory/kula-mocy-regula-nic-nie-mowi-zle.md` dopisz, że 2026-10-01 reguła została przepisana (punkty tylko dodają, tryb swobodny zostaje), nie zniesiona; zaktualizuj hook w `MEMORY.md`.

- [ ] **Step 5: Final run + commit**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓`.

```bash
git add tools/scena.html js/punkty.js tools/test-punkty.mjs docs/superpowers/specs/2026-10-01-punktacja-design.md GEMINI.md
git commit -m "Punktacja: pomiar Pozogi, strojenie, dokumentacja"
```
