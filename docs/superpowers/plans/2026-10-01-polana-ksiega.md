# Menu „Polana", Kronika i Księga Plemienia — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gracz wybiera tryb z menu „Polana", po rundzie widzi Kronikę (tytuł, przydomki, miejsce), a najlepsze wyniki (nick + punkty) zapisują się w Księdze Plemienia — bez dotykania paska adresu.

**Architecture:** Czyste moduły bez DOM (`ksiega.js`, `kronika.js`, `menu.js`, `imiona.js`, `jaja.js`) testowane w node; cienka warstwa DOM `polanaUi.js` renderuje stan modelu `Menu`; `main.js` spina menu z istniejącym `uruchomZKonfiguracji` (jedna ścieżka wejścia do gry — menu i adres prowadzą do tej samej funkcji).

**Tech Stack:** Vanilla JS, moduły ES bez bundlera, testy `node tools/test-*.mjs` (helper `spr(opis, warunek)`, `process.exit(ok ? 0 : 1)`), zbiorczo `sh tools/test-wszystko.sh`; wizualia sprawdzane zrzutami ekranu z headless Chrome.

**Spec:** `docs/superpowers/specs/2026-10-01-polana-ksiega-design.md` (zależy od `2026-10-01-tryby-design.md` i `2026-10-01-punktacja-design.md`).

## Global Constraints

- Ton jest ciepły, nikt nie jest oceniany (GEMINI.md §2): brak słów porażki; błędy konfiguracji to zaproszenia („Dopisz jeszcze jednego tancerza"), nie czerwone komunikaty.
- Tekst gracza (nick!) trafia do DOM **wyłącznie przez `textContent`**; nigdy `innerHTML`.
- Nick: 1–16 znaków po przycięciu (`MAX_NICK` z `js/tryby.js`). Krąg: 2–6 graczy.
- Księga: top **10** na tablicę, max **64** tablice, plik importu ≤ **262144** znaków, klucz pamięci `krolSzamanow.ksiega.v1`, nick `krolSzamanow.nick`. Tablice: `obrzed:<plik>`, `proba:<sekundy>`, sufiks `+zew` dla rund ze Zewem.
- `localStorage` zawsze w `try/catch`; brak pamięci nie jest błędem (Księga działa do zamknięcia karty).
- `konfiguracja()` z menu zwraca **ten sam kształt co `parsujKonfiguracje`** (`{tryb, dlugoscS, piesn, zew, krag}`) plus `nick`.
- Esc w rundzie/Kronice → Polana (zmiana względem podprojektu 2: dotąd Esc kończył do trybu swobodnego). `?tryb=` z adresu zostaje jako skrót dewelopera (wypełnia konfigurację).
- Czas kamery: menu pojawia się **przed** zgodą na kamerę; kamera startuje raz, z kliknięcia „Rozpal ogień" (gest dla audio).
- Tytuły za wynik liczone z **punktów na minutę** (`PROGI_TYTULOW`), progi `150 / 400 / 800 / 1300 / 2000` — zgadnięte, do strojenia.
- Komentarze po polsku, gęste, DLACZEGO (styl repo). Atrybucja commitów — wg bieżącej instrukcji sesji.
- **Nie uruchamiaj w tle Chrome, który odtwarza dźwięk** (headless Chrome gra przez głośniki użytkownika). Zrzuty ekranu menu nie ładują muzyki — trzymaj się adresów bez `?tryb=obrzed` i nie klikaj „Rozpal ogień".

## Review Focus

1. **Uszkodzony / pełny / niedostępny `localStorage`** — zepsuty JSON, wyjątek przy odczycie, `QuotaExceededError` przy zapisie. Oczekiwane: Księga działa w pamięci, nic nie rzuca, menu mówi o tym jednym zdaniem. Test w Task 1.
2. **Złośliwy lub zbyt duży plik importu** — klucz `__proto__`, tysiące tablic, nick z `<script>`, plik 10 MB, nie-JSON. Oczekiwane: ciepły komunikat, brak zmian, żaden prototyp nie zatruty. Testy w Task 1 (logika) i Task 5 (`textContent`).
3. **Podwójne kliknięcie „Rozpal ogień" w trakcie ładowania kamery** — oczekiwane: jedna kamera, jedna pętla klatek (strażnik z podprojektu 2 + `menu.zajety`). Test w Task 4 i Task 6.
4. **Nicki: HTML, emoji, spacje na końcu, nick-bóg z sufiksem Krągu („Perun 2")** — oczekiwane: przycięty, wstawiony jako tekst, bóg rozpoznany. Testy w Task 3 i Task 4.
5. **Esc w rundzie / Kronice / Księdze** — oczekiwane: pieśń zatrzymana, moduły czyste, Kronika znika, Enter po Esc nie startuje rundy. Test w Task 6.

---

### Task 1: `ksiega.js` — Księga Plemienia

**Files:**
- Create: `js/ksiega.js`
- Test: `tools/test-ksiega.mjs`

**Interfaces:**
- Consumes: `PROBA_DLUGOSCI`, `MAX_NICK` z `js/tryby.js`.
- Produces: stałe `MAX_WPISOW=10`, `MAX_TABLIC=64`, `MAX_PLIK_ZNAKOW=262144`, `KLUCZ_PAMIECI`, `KLUCZ_NICKU`; `kluczKsiegi(konfig, utwor) → string|null`; `nazwaTablicy(klucz, piesni?) → string`; `walidujWpis(w) → {nick,wynik,t}|null`; `walidujKsiege(dane) → {tablice}|null`; `class Ksiega(pamiec?)` z `trwala:boolean`, `tablice`, `dodaj(klucz, nick, wynik, t) → {wpisano, miejsce, nowyRekord, pierwszyWpis}`, `tablica(klucz) → wpisy[]`, `klucze() → string[]`, `eksportuj() → string`, `importuj(tekst) → {ok, dodano?, powod?}`, `wyczysc()`, `zapamietajNick(nick)`, `ostatniNick() → string`.

- [ ] **Step 1: Write the failing test**

`tools/test-ksiega.mjs`:

```js
/**
 * Księga Plemienia - tablice wyników, odporność na zepsute dane.
 *   node tools/test-ksiega.mjs
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 */
import {
    Ksiega, kluczKsiegi, nazwaTablicy, walidujWpis, walidujKsiege,
    MAX_WPISOW, MAX_TABLIC, MAX_PLIK_ZNAKOW, KLUCZ_PAMIECI, KLUCZ_NICKU
} from '../js/ksiega.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Atrapa localStorage z podglądem danych. */
function pamiec(start = {}) {
    const d = { ...start };
    return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); } };
}

console.log('KLUCZE TABLIC:');
{
    const utwor = { plik: 'Woda byc.m4a' };
    spr('obrzęd z pieśnią', kluczKsiegi({ tryb: 'obrzed', zew: false, dlugoscS: 216.4 }, utwor) === 'obrzed:Woda byc.m4a');
    spr('obrzęd ze Zewem ma sufiks (osobna tablica)', kluczKsiegi({ tryb: 'obrzed', zew: true, dlugoscS: 216.4 }, utwor) === 'obrzed:Woda byc.m4a+zew');
    spr('próba 60 s', kluczKsiegi({ tryb: 'proba', zew: false, dlugoscS: 60 }, null) === 'proba:60');
    spr('próba ze Zewem', kluczKsiegi({ tryb: 'proba', zew: true, dlugoscS: 120 }, null) === 'proba:120+zew');
    spr('obrzęd bez pieśni (awaria) wpada do próby 90 s', kluczKsiegi({ tryb: 'obrzed', zew: false, dlugoscS: 90 }, null) === 'proba:90');
    spr('swobodny nie ma tablicy', kluczKsiegi({ tryb: 'swobodny', zew: false, dlugoscS: 0 }, null) === null);
    spr('nieznana długość próby = brak tablicy', kluczKsiegi({ tryb: 'proba', zew: false, dlugoscS: 45 }, null) === null);
    spr('śmieci nie rzucają', kluczKsiegi(null, null) === null && kluczKsiegi({}, undefined) === null);
    spr('nazwa: próba', nazwaTablicy('proba:60') === 'Próba 60 s');
    spr('nazwa: próba ze Zewem', nazwaTablicy('proba:90+zew') === 'Próba 90 s · Zew');
    spr('nazwa: obrzęd z tytułem z manifestu', nazwaTablicy('obrzed:a.m4a', [{ plik: 'a.m4a', tytul: 'Ogień w żyłach' }]) === 'Obrzęd: Ogień w żyłach');
    spr('nazwa: obrzęd bez wpisu w manifeście = nazwa pliku bez rozszerzenia', nazwaTablicy('obrzed:Stara pieśń.m4a') === 'Obrzęd: Stara pieśń');
}

console.log('\nWALIDACJA WPISU:');
{
    spr('poprawny wpis', JSON.stringify(walidujWpis({ nick: 'Ola', wynik: 123.9, t: 5 })) === JSON.stringify({ nick: 'Ola', wynik: 123, t: 5 }));
    spr('nick przycięty do 16 znaków', walidujWpis({ nick: 'x'.repeat(40), wynik: 1, t: 1 }).nick.length === 16);
    spr('nick z białymi znakami na brzegach przycięty', walidujWpis({ nick: '  Ola  ', wynik: 1, t: 1 }).nick === 'Ola');
    spr('pusty nick odrzucony', walidujWpis({ nick: '   ', wynik: 1, t: 1 }) === null);
    spr('nick nie-tekst odrzucony', walidujWpis({ nick: 5, wynik: 1, t: 1 }) === null && walidujWpis({ nick: null, wynik: 1, t: 1 }) === null);
    spr('wynik NaN/ujemny/Infinity odrzucony', [NaN, -1, Infinity, '5', null].every(w => walidujWpis({ nick: 'a', wynik: w, t: 1 }) === null));
    spr('wynik 0 dozwolony (każdy tańczył)', walidujWpis({ nick: 'a', wynik: 0, t: 1 }).wynik === 0);
    spr('brak t odrzucony', walidujWpis({ nick: 'a', wynik: 1 }) === null && walidujWpis({ nick: 'a', wynik: 1, t: NaN }) === null);
    spr('null/liczba/tekst nie rzucają', walidujWpis(null) === null && walidujWpis(5) === null && walidujWpis('x') === null);
    spr('HTML w nicku zostaje tekstem (nie czyścimy - DOM używa textContent)', walidujWpis({ nick: '<b>x</b>', wynik: 1, t: 1 }).nick === '<b>x</b>');
}

console.log('\nDODAWANIE I SORTOWANIE:');
{
    const k = new Ksiega(null);
    const a = k.dodaj('proba:60', 'Ola', 500, 1);
    spr('pierwszy wpis: pierwszyWpis, bez koronacji', a.wpisano && a.miejsce === 1 && a.pierwszyWpis === true && a.nowyRekord === false);
    const b = k.dodaj('proba:60', 'Bartek', 300, 2);
    spr('niższy wynik: miejsce 2, nie rekord', b.miejsce === 2 && b.nowyRekord === false && b.pierwszyWpis === false);
    const c = k.dodaj('proba:60', 'Cezary', 900, 3);
    spr('wyższy wynik: miejsce 1 i NOWY REKORD', c.miejsce === 1 && c.nowyRekord === true);
    const d = k.dodaj('proba:60', 'Dorota', 900, 4);
    spr('remis z liderem: starszy wpis wyżej, brak rekordu (nie pobiła)', d.miejsce === 2 && d.nowyRekord === false);
    spr('kolejność: Cezary, Dorota, Ola, Bartek', k.tablica('proba:60').map(w => w.nick).join() === 'Cezary,Dorota,Ola,Bartek');
    spr('osobna tablica nie miesza wyników', k.dodaj('proba:60+zew', 'Ola', 10, 5).pierwszyWpis === true);
    spr('tablica() zwraca kopię', (() => { const t = k.tablica('proba:60'); t.length = 0; return k.tablica('proba:60').length === 4; })());
    spr('klucze() posortowane', k.klucze().join() === 'proba:60,proba:60+zew');
}
{
    const k = new Ksiega(null);
    for (let i = 0; i < 15; i++) k.dodaj('proba:90', `g${i}`, i * 10, i);
    spr(`tablica ma najwyżej ${MAX_WPISOW} wpisów`, k.tablica('proba:90').length === MAX_WPISOW);
    spr('odpadają najsłabsze', k.tablica('proba:90').at(-1).wynik === 50);
    const slaby = k.dodaj('proba:90', 'slaby', 1, 99);
    spr('wynik poniżej dziesiątki: wpisano=false, miejsce=null (ciepły komunikat w UI)', slaby.wpisano === false && slaby.miejsce === null && slaby.nowyRekord === false);
    spr('wynik równy ostatniemu, ale późniejszy, nie wypiera starszego', k.dodaj('proba:90', 'spozniony', 50, 100).wpisano === false);
}
{
    const k = new Ksiega(null);
    spr('zły klucz odrzucony', k.dodaj('zly klucz', 'Ola', 1, 1).wpisano === false && k.dodaj('__proto__', 'Ola', 1, 1).wpisano === false);
    spr('zły nick/wynik odrzucone', k.dodaj('proba:60', '', 1, 1).wpisano === false && k.dodaj('proba:60', 'Ola', NaN, 1).wpisano === false);
    spr('wynik ułamkowy zapisany jako całkowity', (k.dodaj('proba:60', 'Ola', 99.9, 1), k.tablica('proba:60')[0].wynik === 99));
    let proto = false;
    try { proto = ({}).polluted !== undefined; } catch { /* ignore */ }
    spr('Object.prototype niezatruty', proto === false);
}
{
    const k = new Ksiega(null);
    for (let i = 0; i < MAX_TABLIC + 10; i++) k.dodaj(`proba:${i}`.replace(/proba:(\d+)/, (_, n) => `obrzed:p${n}.m4a`), 'Ola', 1, 1);
    spr(`najwyżej ${MAX_TABLIC} tablic`, k.klucze().length === MAX_TABLIC);
}

console.log('\nTRWAŁOŚĆ (localStorage):');
{
    const p = pamiec();
    const k1 = new Ksiega(p);
    spr('pamięć działa: trwala=true', k1.trwala === true);
    k1.dodaj('proba:60', 'Ola', 500, 1);
    spr('zapis pod kluczem v1', typeof p.d[KLUCZ_PAMIECI] === 'string');
    const k2 = new Ksiega(p);
    spr('nowa instancja widzi wyniki', k2.tablica('proba:60')[0].nick === 'Ola');
}

console.log('\nREVIEW FOCUS 1 - uszkodzona/pełna/niedostępna pamięć:');
{
    const zepsuty = new Ksiega(pamiec({ [KLUCZ_PAMIECI]: '{to nie jest json' }));
    spr('zepsuty JSON w pamięci: pusta Księga, bez wyjątku', zepsuty.klucze().length === 0 && zepsuty.trwala === true);
    zepsuty.dodaj('proba:60', 'Ola', 1, 1);
    spr('po uszkodzeniu można dalej zapisywać', zepsuty.tablica('proba:60').length === 1);

    const polowa = new Ksiega(pamiec({ [KLUCZ_PAMIECI]: JSON.stringify({ wersja: 1, tablice: {
        'proba:60': [{ nick: 'Dobry', wynik: 10, t: 1 }, { nick: '', wynik: 5, t: 1 }, { nick: 'Zly', wynik: -1, t: 1 }, null, 7],
        'zly klucz': [{ nick: 'x', wynik: 1, t: 1 }]
    } }) }));
    spr('wpisy uszkodzone odpadają, dobre zostają', polowa.tablica('proba:60').length === 1 && polowa.tablica('proba:60')[0].nick === 'Dobry');
    spr('uszkodzony klucz odpada', polowa.klucze().join() === 'proba:60');

    const rzuca = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
    const k = new Ksiega(rzuca);
    spr('pamięć rzucająca przy odczycie: trwala=false, bez wyjątku', k.trwala === false);
    const w = k.dodaj('proba:60', 'Ola', 5, 1);
    spr('mimo to zapisuje w pamięci procesu', w.wpisano === true && k.tablica('proba:60').length === 1);

    let zapisy = 0;
    const pelna = { getItem: () => null, setItem() { zapisy++; throw new Error('QuotaExceededError'); } };
    const kp = new Ksiega(pelna);
    const wp = kp.dodaj('proba:60', 'Ola', 5, 1);
    spr('QuotaExceeded przy zapisie: wynik nadal przyjęty, trwala=false', wp.wpisano === true && kp.trwala === false && zapisy === 1);
    kp.dodaj('proba:60', 'Jan', 6, 2);
    spr('po niepowodzeniu nie męczy pamięci kolejnymi zapisami', zapisy === 1);

    spr('brak pamięci (null): trwala=false, działa', new Ksiega(null).trwala === false && new Ksiega(undefined).dodaj('proba:60', 'a', 1, 1).wpisano === true);
}

console.log('\nREVIEW FOCUS 2 - EKSPORT I IMPORT:');
{
    const k = new Ksiega(null);
    k.dodaj('proba:60', 'Ola', 500, 1); k.dodaj('proba:60', 'Bartek', 300, 2);
    const plik = k.eksportuj();
    spr('eksport to poprawny JSON z wersją', JSON.parse(plik).wersja === 1 && Object.keys(JSON.parse(plik).tablice).join() === 'proba:60');

    const inny = new Ksiega(null);
    inny.dodaj('proba:60', 'Cezary', 400, 3);
    const r = inny.importuj(plik);
    spr('import scala (nie nadpisuje)', r.ok === true && r.dodano === 2 && inny.tablica('proba:60').map(w => w.nick).join() === 'Ola,Cezary,Bartek');
    const r2 = inny.importuj(plik);
    spr('ten sam plik drugi raz nie dubluje wpisów', r2.ok === true && r2.dodano === 0 && inny.tablica('proba:60').length === 3);

    spr('za duży plik odrzucony bez zmian', (() => { const x = new Ksiega(null); const rr = x.importuj('x'.repeat(MAX_PLIK_ZNAKOW + 1)); return rr.ok === false && rr.powod === 'rozmiar' && x.klucze().length === 0; })());
    spr('nie-JSON odrzucony', new Ksiega(null).importuj('to nie json').ok === false);
    spr('JSON bez tablic odrzucony', new Ksiega(null).importuj('{"a":1}').ok === false && new Ksiega(null).importuj('[]').ok === false && new Ksiega(null).importuj('null').ok === false);
    spr('nie-tekst odrzucony', new Ksiega(null).importuj(null).ok === false && new Ksiega(null).importuj(5).ok === false);

    const zlosliwy = new Ksiega(null);
    const rz = zlosliwy.importuj('{"wersja":1,"tablice":{"__proto__":[{"nick":"x","wynik":1,"t":1}],"constructor":[{"nick":"x","wynik":1,"t":1}],"proba:60":[{"nick":"<script>alert(1)</script>","wynik":9,"t":1}]}}');
    spr('klucze __proto__/constructor ignorowane', rz.ok === true && zlosliwy.klucze().join() === 'proba:60');
    spr('prototyp niezatruty po imporcie', ({}).nick === undefined && Object.getPrototypeOf(zlosliwy.tablice) === Object.prototype);
    spr('nick z HTML zostaje tekstem, przycięty do 16', zlosliwy.tablica('proba:60')[0].nick === '<script>alert(1)'.slice(0, 16));

    const wiele = {}; for (let i = 0; i < 200; i++) wiele[`obrzed:p${i}.m4a`] = [{ nick: 'a', wynik: 1, t: 1 }];
    const kw = new Ksiega(null);
    kw.importuj(JSON.stringify({ wersja: 1, tablice: wiele }));
    spr(`import tysięcy tablic ucięty do ${MAX_TABLIC}`, kw.klucze().length <= MAX_TABLIC);

    const dlugi = {}; dlugi['proba:60'] = Array.from({ length: 500 }, (_, i) => ({ nick: `g${i}`, wynik: i, t: i }));
    const kd = new Ksiega(null);
    kd.importuj(JSON.stringify({ wersja: 1, tablice: dlugi }));
    spr(`długa tablica z pliku ucięta do ${MAX_WPISOW}`, kd.tablica('proba:60').length === MAX_WPISOW && kd.tablica('proba:60')[0].wynik === 499);

    const p = pamiec();
    const kz = new Ksiega(p);
    kz.importuj(plik);
    spr('import zapisuje do pamięci', new Ksiega(p).tablica('proba:60').length === 2);
}

console.log('\nWYCZYŚĆ:');
{
    const p = pamiec();
    const k = new Ksiega(p);
    k.dodaj('proba:60', 'Ola', 5, 1);
    k.wyczysc();
    spr('wyczysc() opróżnia Księgę i pamięć', k.klucze().length === 0 && new Ksiega(p).klucze().length === 0);
}

console.log('\nNICK:');
{
    const p = pamiec();
    const k = new Ksiega(p);
    spr('początkowo pusty', k.ostatniNick() === '');
    k.zapamietajNick('  Ola  ');
    spr('zapamiętany i przycięty', k.ostatniNick() === 'Ola' && p.d[KLUCZ_NICKU] === 'Ola');
    k.zapamietajNick('x'.repeat(40));
    spr('przycięty do 16', k.ostatniNick().length === 16);
    k.zapamietajNick('   ');
    spr('pusty nick nie nadpisuje poprzedniego', k.ostatniNick().length === 16);
    spr('pamięć rzucająca nie wywala nicku', (() => { try { new Ksiega({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }).zapamietajNick('Ola'); return true; } catch { return false; } })());
    spr('nick z pamięci jest walidowany (śmieci -> pusty)', new Ksiega(pamiec({ [KLUCZ_NICKU]: '   ' })).ostatniNick() === '');
}

console.log('\nwalidujKsiege:');
{
    spr('null/liczba/tablica -> null', walidujKsiege(null) === null && walidujKsiege(5) === null && walidujKsiege([]) === null && walidujKsiege({ tablice: 'x' }) === null);
    spr('poprawna struktura -> tablice posortowane i ucięte', (() => {
        const w = walidujKsiege({ tablice: { 'proba:60': [{ nick: 'a', wynik: 1, t: 1 }, { nick: 'b', wynik: 9, t: 2 }] } });
        return w.tablice['proba:60'][0].nick === 'b';
    })());
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-ksiega.mjs`
Expected: FAIL — `Cannot find module '.../js/ksiega.js'`

- [ ] **Step 3: Write minimal implementation**

`js/ksiega.js`:

```js
/**
 * Księga Plemienia - najlepsze wyniki (nick + punkty), lokalnie.
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. `localStorage` wstrzykiwany (pamiec = {getItem,setItem}
 * albo null), więc testy w node używają atrapy. BRAK PAMIĘCI NIE JEST BŁĘDEM
 * (tryb prywatny, zablokowane dane, pełny dysk): Księga działa wtedy w pamięci
 * procesu do zamknięcia karty, a `trwala` mówi UI, że ma o tym powiedzieć.
 *
 * Tablice osobno per tryb i wariant. Zew podwaja punkty, więc rundy ze Zewem
 * mają WŁASNE tablice (sufiks `+zew`) - inaczej wyniki z Zewem wypychałyby
 * zwykłe z listy.
 *
 * To jedyne miejsce, w którym do gry wchodzą dane z zewnątrz (import pliku),
 * więc WSZYSTKO przechodzi walidację: klucze po wzorcu (nie `__proto__`),
 * wpisy po polach, limity liczby tablic/wpisów/rozmiaru pliku.
 */
import { PROBA_DLUGOSCI, MAX_NICK } from './tryby.js';

export const MAX_WPISOW = 10;
export const MAX_TABLIC = 64;
export const MAX_PLIK_ZNAKOW = 262144;
export const KLUCZ_PAMIECI = 'krolSzamanow.ksiega.v1';
export const KLUCZ_NICKU = 'krolSzamanow.nick';

// Klucz musi pasować do wzorca - to także obrona przed `__proto__`/`constructor`
// jako nazwą tablicy w zaimportowanym pliku.
const KLUCZ_RE = /^(obrzed:[^\n]{1,120}|proba:\d{1,3})(\+zew)?$/;

/**
 * Klucz tablicy dla rundy. Obrzęd bez pieśni (awaria wczytania - gra poszła jak
 * próba 90 s) ląduje w tablicy próby, nie w nieistniejącej tablicy pieśni.
 * @returns {string|null} null = ta runda nie trafia do Księgi (swobodny)
 */
export function kluczKsiegi(konfig, utwor) {
    const zew = konfig?.zew ? '+zew' : '';
    if (konfig?.tryb === 'obrzed' && utwor?.plik) return `obrzed:${utwor.plik}${zew}`;
    if ((konfig?.tryb === 'proba' || konfig?.tryb === 'obrzed') && PROBA_DLUGOSCI.includes(konfig.dlugoscS)) {
        return `proba:${konfig.dlugoscS}${zew}`;
    }
    return null;
}

/** Czytelna nazwa tablicy dla zakładek Księgi. */
export function nazwaTablicy(klucz, piesni = []) {
    const zew = klucz.endsWith('+zew') ? ' · Zew' : '';
    const baza = klucz.replace(/\+zew$/, '');
    if (baza.startsWith('proba:')) return `Próba ${baza.slice(6)} s${zew}`;
    if (baza.startsWith('obrzed:')) {
        const plik = baza.slice(7);
        const u = piesni.find(p => p.plik === plik);
        return `Obrzęd: ${u?.tytul ?? plik.replace(/\.[^.]+$/, '')}${zew}`;
    }
    return klucz;
}

/** @returns {{nick:string, wynik:number, t:number}|null} */
export function walidujWpis(w) {
    if (!w || typeof w !== 'object' || typeof w.nick !== 'string') return null;
    const nick = w.nick.trim().slice(0, MAX_NICK);
    if (!nick) return null;
    if (typeof w.wynik !== 'number' || !Number.isFinite(w.wynik) || w.wynik < 0) return null;
    if (typeof w.t !== 'number' || !Number.isFinite(w.t)) return null;
    return { nick, wynik: Math.floor(w.wynik), t: w.t };
}

// Malejąco po wyniku; remis - starszy wpis wyżej (kto pierwszy, ten wyżej).
const porownaj = (a, b) => (b.wynik - a.wynik) || (a.t - b.t);

/** @returns {{tablice: Object<string, Array>}|null} null = zła struktura */
export function walidujKsiege(dane) {
    if (!dane || typeof dane !== 'object' || Array.isArray(dane)) return null;
    if (!dane.tablice || typeof dane.tablice !== 'object' || Array.isArray(dane.tablice)) return null;
    const tablice = {};
    let ile = 0;
    for (const [klucz, wpisy] of Object.entries(dane.tablice)) {
        if (!KLUCZ_RE.test(klucz) || !Array.isArray(wpisy)) continue;
        const dobre = wpisy.map(walidujWpis).filter(Boolean).sort(porownaj).slice(0, MAX_WPISOW);
        if (!dobre.length) continue;
        if (++ile > MAX_TABLIC) break;
        tablice[klucz] = dobre;
    }
    return { tablice };
}

export class Ksiega {
    /** @param {{getItem:Function, setItem:Function}|null} [pamiec]  localStorage albo atrapa */
    constructor(pamiec = null) {
        this._pamiec = pamiec ?? null;
        this.tablice = {};
        this.trwala = false;   // czy pamięć działa - UI mówi, gdy nie
        this._wczytaj();
    }

    _wczytaj() {
        if (!this._pamiec) return;
        let surowe;
        try {
            surowe = this._pamiec.getItem(KLUCZ_PAMIECI);
            this.trwala = true;
        } catch {
            return;   // pamięć niedostępna: Księga działa w procesie
        }
        if (!surowe) return;
        try {
            this.tablice = walidujKsiege(JSON.parse(surowe))?.tablice ?? {};
        } catch {
            this.tablice = {};   // zepsuty JSON: zaczynamy od pustej, kolejny zapis go nadpisze
        }
    }

    _zapisz() {
        if (!this._pamiec || !this.trwala) return;   // po pierwszej awarii nie męczymy pamięci
        try {
            this._pamiec.setItem(KLUCZ_PAMIECI, JSON.stringify({ wersja: 1, tablice: this.tablice }));
        } catch {
            this.trwala = false;   // pełna/zablokowana: dalej w pamięci procesu
        }
    }

    /** @returns {{wpisano:boolean, miejsce:number|null, nowyRekord:boolean, pierwszyWpis:boolean}} */
    dodaj(klucz, nick, wynik, t) {
        const odmowa = { wpisano: false, miejsce: null, nowyRekord: false, pierwszyWpis: false };
        if (typeof klucz !== 'string' || !KLUCZ_RE.test(klucz)) return odmowa;
        const w = walidujWpis({ nick, wynik, t });
        if (!w) return odmowa;
        const stara = this.tablice[klucz] ?? [];
        if (!stara.length && Object.keys(this.tablice).length >= MAX_TABLIC) return odmowa;

        const nowa = [...stara, w].sort(porownaj);
        const idx = nowa.indexOf(w);
        if (idx >= MAX_WPISOW) return odmowa;   // poza dziesiątką: Księga pamięta najlepszych

        const poprzedniNajlepszy = stara.length ? stara[0].wynik : null;
        this.tablice[klucz] = nowa.slice(0, MAX_WPISOW);
        this._zapisz();
        return {
            wpisano: true,
            miejsce: idx + 1,
            // Koronacja tylko za POBICIE istniejącego rekordu - pierwszy wpis w pustej
            // tablicy to "pierwszy zapis", inaczej każdy pierwszy gracz byłby koronowany.
            nowyRekord: poprzedniNajlepszy !== null && w.wynik > poprzedniNajlepszy,
            pierwszyWpis: stara.length === 0
        };
    }

    tablica(klucz) { return (this.tablice[klucz] ?? []).map(w => ({ ...w })); }
    klucze() { return Object.keys(this.tablice).sort(); }

    eksportuj() { return JSON.stringify({ wersja: 1, tablice: this.tablice }, null, 2); }

    /**
     * Import SCALA z istniejącą Księgą (nigdy nie nadpisuje). Ten sam plik wczytany
     * drugi raz niczego nie dubluje.
     * @returns {{ok:boolean, dodano?:number, powod?:'rozmiar'|'plik'}}
     */
    importuj(tekst) {
        if (typeof tekst !== 'string') return { ok: false, powod: 'plik' };
        if (tekst.length > MAX_PLIK_ZNAKOW) return { ok: false, powod: 'rozmiar' };
        let dane;
        try { dane = JSON.parse(tekst); } catch { return { ok: false, powod: 'plik' }; }
        const wal = walidujKsiege(dane);
        if (!wal) return { ok: false, powod: 'plik' };

        let dodano = 0;
        for (const [klucz, wpisy] of Object.entries(wal.tablice)) {
            const istn = this.tablice[klucz] ?? [];
            if (!istn.length && Object.keys(this.tablice).length >= MAX_TABLIC) continue;
            const znane = new Set(istn.map(w => `${w.nick}|${w.wynik}|${w.t}`));
            const nowe = wpisy.filter(w => !znane.has(`${w.nick}|${w.wynik}|${w.t}`));
            const polaczone = [...istn, ...nowe].sort(porownaj).slice(0, MAX_WPISOW);
            dodano += polaczone.filter(w => nowe.includes(w)).length;
            this.tablice[klucz] = polaczone;
        }
        this._zapisz();
        return { ok: true, dodano };
    }

    wyczysc() {
        this.tablice = {};
        this._zapisz();
    }

    zapamietajNick(nick) {
        const n = typeof nick === 'string' ? nick.trim().slice(0, MAX_NICK) : '';
        if (!n) return;   // pusty nie nadpisuje poprzedniego
        try { this._pamiec?.setItem(KLUCZ_NICKU, n); } catch { /* nick to wygoda, nie dane gry */ }
    }

    ostatniNick() {
        try {
            const n = this._pamiec?.getItem(KLUCZ_NICKU);
            return typeof n === 'string' ? n.trim().slice(0, MAX_NICK) : '';
        } catch {
            return '';
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-ksiega.mjs`
Expected: wszystkie `✓`, kod wyjścia 0.

- [ ] **Step 5: Commit**

```bash
git add js/ksiega.js tools/test-ksiega.mjs
git commit -m "Ksiega Plemienia: tablice per tryb, top 10, import/eksport, odpornosc na zepsuta pamiec"
```

---

### Task 2: `kronika.js` — tytuły, przydomki, teksty Kroniki

**Files:**
- Create: `js/kronika.js`
- Modify: `js/przebieg.js` (pole `dlugoscS` w podsumowaniu), `tools/test-przebieg.mjs`
- Test: `tools/test-kronika.mjs`

**Interfaces:**
- Consumes: `KOMBOSY` (test), `REAKCJE` (test), podsumowanie z `Przebieg.zapiszWynik` (nowe pole `dlugoscS`).
- Produces: `PROGI_TYTULOW`, `punktyNaMinute(wynik, dlugoscS)`, `tytulZaWynik(wynik, dlugoscS) → {tytul, zdanie}`, `PRZYDOMKI` (`[{id, nazwa, pasuje(pods)}]`), `przydomki(pods) → string[]` (maks. 2), `zbudujKronike(pods, { wynikKsiegi }) → { tytul, wynik, szaman:{tytul,zdanie}, przydomki, linie, podium, miejsce, podpis }`.

- [ ] **Step 1: Write the failing tests**

W `tools/test-przebieg.mjs`, w bloku `PRZEBIEG POJEDYNCZEJ RUNDY` po asercji `podsumowanie zawiera wynik` dopisać:

```js
    spr('podsumowanie niesie długość rundy (dla tytułu za punkty na minutę)', pods.dlugoscS === 60);
```

`tools/test-kronika.mjs`:

```js
/**
 * Kronika obrzędu - tytuły, przydomki, teksty (czysta logika).
 *   node tools/test-kronika.mjs
 */
import { PROGI_TYTULOW, punktyNaMinute, tytulZaWynik, PRZYDOMKI, przydomki, zbudujKronike } from '../js/kronika.js';
import { KOMBOSY } from '../js/kombosy.js';
import { REAKCJE } from '../js/punkty.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const pods = (nad = {}) => ({
    tryb: 'proba', nick: 'Ola', wynik: 1000, dlugoscS: 60,
    rozbicie: { taniec: 200, pieczecie: 100, techniki: 600, reakcje: 100 },
    momenty: { splecenia: 0, serie: {}, techniki: {} },
    kragKoniec: null, nastepny: null, podium: null, ...nad
});

console.log('PUNKTY NA MINUTĘ:');
spr('60 s: wynik = punkty/min', punktyNaMinute(600, 60) === 600);
spr('120 s: dwa razy mniej na minutę', punktyNaMinute(600, 120) === 300);
spr('długość 0/NaN -> awaryjne 90 s', punktyNaMinute(90, 0) === 60 && punktyNaMinute(90, NaN) === 60);
spr('wynik NaN/ujemny -> 0', punktyNaMinute(NaN, 60) === 0 && punktyNaMinute(-5, 60) === 0);

console.log('\nTYTUŁY ZA WYNIK:');
{
    const t = (w, d = 60) => tytulZaWynik(w, d).tytul;
    spr('<150/min = Kłoda', t(0) === 'Kłoda' && t(149) === 'Kłoda');
    spr('150-399 = Uczeń Ogniska', t(150) === 'Uczeń Ogniska' && t(399) === 'Uczeń Ogniska');
    spr('400-799 = Szeptucha', t(400) === 'Szeptucha' && t(799) === 'Szeptucha');
    spr('800-1299 = Żerca', t(800) === 'Żerca' && t(1299) === 'Żerca');
    spr('1300-1999 = Wołchw', t(1300) === 'Wołchw' && t(1999) === 'Wołchw');
    spr('>=2000 = Król Szamanów', t(2000) === 'Król Szamanów' && t(99999) === 'Król Szamanów');
    // 450 pkt/min: bezpiecznie w środku progu (nie na granicy 400, gdzie zaokrąglenia float mogłyby przeskoczyć tytuł).
    spr('to samo tempo, inna długość = ten sam tytuł (pieśń 4:23 vs próba 60 s)', tytulZaWynik(450 * 4.38, 262.8).tytul === tytulZaWynik(450, 60).tytul);
    spr('wynik NaN/null = Kłoda, bez wyjątku', t(NaN) === 'Kłoda' && t(null) === 'Kłoda' && t(undefined) === 'Kłoda');
    spr('każdy tytuł ma zdanie', PROGI_TYTULOW.every(p => typeof p.zdanie === 'string' && p.zdanie.length > 0));
    spr('Kłoda ma ciepłe zdanie o kłodzie', tytulZaWynik(0, 60).zdanie.toLowerCase().includes('kłody'));
    spr('progi rosnące', PROGI_TYTULOW.every((p, i) => i === 0 || p.do > PROGI_TYTULOW[i - 1].do));
    spr('ostatni próg nieskończony', PROGI_TYTULOW.at(-1).do === Infinity);
    spr('brak słów porażki w tytułach i zdaniach', !PROGI_TYTULOW.some(p => /przegra|niestety|słab|zły|źle|marn/i.test(p.tytul + p.zdanie)));
}

console.log('\nPRZYDOMKI - STRAŻNIK:');
{
    // Każda reguła odwołuje się do ISTNIEJĄCYCH pól. Zmiana id techniki albo reakcji
    // bez aktualizacji reguły = czerwony test, nie martwy przydomek.
    const idKombosow = KOMBOSY.map(k => k.id);
    spr('gromWOgniu istnieje w KOMBOSY', idKombosow.includes('gromWOgniu'));
    spr('gromWZiemie istnieje w KOMBOSY', idKombosow.includes('gromWZiemie'));
    spr('pozoga istnieje w REAKCJE', !!REAKCJE.pozoga);
    spr('rozwianie istnieje w REAKCJE', !!REAKCJE.rozwianie);
    for (const r of PRZYDOMKI) {
        spr(`reguła '${r.id}' ma nazwę i funkcję`, typeof r.nazwa === 'string' && r.nazwa.length > 0 && typeof r.pasuje === 'function');
        spr(`reguła '${r.id}' nie rzuca na pustych danych`, (() => { try { return typeof r.pasuje({}) === 'boolean' && typeof r.pasuje(null) === 'boolean'; } catch { return false; } })());
    }
    spr('id reguł unikalne', new Set(PRZYDOMKI.map(r => r.id)).size === PRZYDOMKI.length);
}

console.log('\nPRZYDOMKI:');
{
    spr('brak pasujących = pusta lista', przydomki(pods()).length === 0);
    spr('Podpalacz Chmur: seria Pożogi >= 40', przydomki(pods({ momenty: { serie: { pozoga: 40 }, techniki: {}, splecenia: 0 } })).includes('Podpalacz Chmur'));
    spr('seria 39 nie wystarcza', !przydomki(pods({ momenty: { serie: { pozoga: 39 }, techniki: {}, splecenia: 0 } })).includes('Podpalacz Chmur'));
    spr('Wiatrodmuch: seria Rozwiania >= 40', przydomki(pods({ momenty: { serie: { rozwianie: 55 }, techniki: {}, splecenia: 0 } })).includes('Wiatrodmuch'));
    spr('Tancerz Czystego Ruchu: taniec >= 60% wyniku', przydomki(pods({ wynik: 1000, rozbicie: { taniec: 650, pieczecie: 0, techniki: 0, reakcje: 0 } })).includes('Tancerz Czystego Ruchu'));
    spr('wynik 0 nie daje Tancerza (dzielenie przez zero)', !przydomki(pods({ wynik: 0, rozbicie: { taniec: 0 } })).includes('Tancerz Czystego Ruchu'));
    spr('Pan Pierunów: 3 grzmoty (Ogniu + Ziemię)', przydomki(pods({ momenty: { serie: {}, techniki: { gromWOgniu: 2, gromWZiemie: 1 }, splecenia: 0 } })).includes('Pan Pierunów'));
    spr('2 grzmoty nie wystarczą', !przydomki(pods({ momenty: { serie: {}, techniki: { gromWOgniu: 2 }, splecenia: 0 } })).includes('Pan Pierunów'));
    spr('Splatacz: >= 3 splecenia', przydomki(pods({ momenty: { serie: {}, techniki: {}, splecenia: 3 } })).includes('Splatacz'));
    const duzo = pods({ wynik: 1000, rozbicie: { taniec: 700 }, momenty: { serie: { pozoga: 50, rozwianie: 50 }, techniki: { gromWOgniu: 5 }, splecenia: 5 } });
    spr('maksymalnie 2 przydomki, w kolejności rejestru', przydomki(duzo).length === 2 && przydomki(duzo)[0] === PRZYDOMKI.find(r => r.pasuje(duzo)).nazwa);
    spr('null/puste dane nie rzucają', Array.isArray(przydomki(null)) && Array.isArray(przydomki({})));
}

console.log('\nKRONIKA:');
{
    const k = zbudujKronike(pods({ wynik: 1234.7, rozbicie: { taniec: 100.4, pieczecie: 75, techniki: 800, reakcje: 259.3 },
        momenty: { splecenia: 2, serie: { pozoga: 47 }, techniki: {} } }), { wynikKsiegi: null });
    spr('wynik zaokrąglony w dół, jako tekst', k.wynik === '1234');
    spr('tytuł z nickiem', k.tytul.includes('Ola'));
    spr('tytuł szamana z zdaniem', typeof k.szaman.tytul === 'string' && k.szaman.zdanie.length > 0);
    spr('rozbicie: 4 warstwy w liniach', k.linie.filter(l => /taniec|pieczęcie|techniki|reakcje/.test(l)).length === 4);
    spr('największa Pożoga w liniach', k.linie.some(l => l.includes('47')));
    spr('liczba spleceń w liniach', k.linie.some(l => l.includes('2')));
    spr('brak Księgi: pusty tekst miejsca', k.miejsce === '');
    spr('podpis zachęca (Enter/Esc), nie ocenia', /Enter/.test(k.podpis) && /Esc/.test(k.podpis));
    spr('ciepły ton: bez słów porażki', !/przegra|niestety|słab|zły|źle|marn/i.test(JSON.stringify(k)));
    spr('bez nicku: tytuł bez imienia', !zbudujKronike(pods({ nick: null }), {}).tytul.includes('null'));
}
{
    const wk = (nad) => zbudujKronike(pods(), { wynikKsiegi: { wpisano: true, miejsce: 3, nowyRekord: false, pierwszyWpis: false, ...nad } }).miejsce;
    spr('nowy rekord', /rekord/i.test(wk({ nowyRekord: true, miejsce: 1 })));
    spr('pierwszy zapis', /pierwszy/i.test(wk({ pierwszyWpis: true, miejsce: 1 })));
    spr('miejsce w Księdze', wk({}).includes('3'));
    const poza = zbudujKronike(pods(), { wynikKsiegi: { wpisano: false, miejsce: null, nowyRekord: false, pierwszyWpis: false } }).miejsce;
    spr('poza dziesiątką: ciepłe zdanie, bez wyroku', poza.length > 0 && !/przegra|niestety|słab|zły|źle|marn/i.test(poza));
}
{
    const solo = zbudujKronike(pods(), {}).podpis;
    const wToku = zbudujKronike(pods({ kragKoniec: false, nastepny: 'Bartek' }), {}).podpis;
    const koniec = zbudujKronike(pods({ kragKoniec: true, podium: [{ nick: 'Bartek', wynik: 900 }, { nick: 'Ola', wynik: 500 }] }), {});
    spr('solo: Enter jeszcze raz, Esc Polana', /Enter/.test(solo) && /Polan/.test(solo));
    spr('Krąg w toku: następny tancerz w podpisie', wToku.includes('Bartek'));
    spr('koniec Kręgu: podium z miejscami', koniec.podium.length === 2 && koniec.podium[0].miejsce === 1 && koniec.podium[0].nick === 'Bartek');
    spr('koniec Kręgu: osobisty zapis ostatniego gracza zostaje', koniec.szaman.tytul.length > 0 && koniec.linie.length > 0);
    spr('bez podium w zwykłej rundzie', zbudujKronike(pods(), {}).podium === null);
    spr('rozbicie/momenty null nie rzucają', zbudujKronike(pods({ rozbicie: null, momenty: null }), {}).wynik === '1000');
    spr('wynik NaN = 0', zbudujKronike(pods({ wynik: NaN }), {}).wynik === '0');
    spr('całkiem puste podsumowanie nie rzuca', zbudujKronike({}, {}).wynik === '0' && zbudujKronike(null, null).wynik === '0');
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/test-kronika.mjs; node tools/test-przebieg.mjs 2>&1 | grep "podsumowanie niesie"`
Expected: FAIL — `Cannot find module '.../js/kronika.js'`; w `test-przebieg` `✗ podsumowanie niesie długość rundy`.

- [ ] **Step 3: Write minimal implementation**

W `js/przebieg.js`, w `zapiszWynik`, w literale `pods` dopisać pole `dlugoscS: this.konfig.dlugoscS,` (zaraz po `tryb: this.konfig.tryb,`).

`js/kronika.js`:

```js
/**
 * Kronika obrzędu - teksty po rundzie: tytuł za wynik, przydomki, rozbicie punktów.
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. TON (GEMINI.md §2): to podsumowanie, nie wyrok - nawet
 * najniższy tytuł jest ciepły ("każde ognisko zaczyna się od kłody"), przydomek
 * pojawia się tylko, gdy coś go zasłużyło (brak pasującego = brak przydomka,
 * nigdy "brak osiągnięć").
 */
import { PIESN_AWARYJNA_S } from './tryby.js';

const liczba = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

// Tytuł liczony z PUNKTÓW NA MINUTĘ: próba 60 s i pieśń 4:23 nie mogą mierzyć się tą
// samą liczbą. ZGADNIĘTE progi - do strojenia na żywym ciele (jak PROG_SZARPNIECIA).
export const PROGI_TYTULOW = [
    { do: 150, tytul: 'Kłoda', zdanie: 'Każde ognisko zaczyna się od kłody.' },
    { do: 400, tytul: 'Uczeń Ogniska', zdanie: 'Iskra już zaskoczyła.' },
    { do: 800, tytul: 'Szeptucha', zdanie: 'Duchy zaczynają Cię słyszeć.' },
    { do: 1300, tytul: 'Żerca', zdanie: 'Ogień tańczy razem z Tobą.' },
    { do: 2000, tytul: 'Wołchw', zdanie: 'Żywioły słuchają Twojego głosu.' },
    { do: Infinity, tytul: 'Król Szamanów', zdanie: 'Cała polana klęka przed Twoim ogniem.' }
];

export function punktyNaMinute(wynik, dlugoscS) {
    const d = liczba(dlugoscS) || PIESN_AWARYJNA_S;
    return liczba(wynik) / (d / 60);
}

/** @returns {{tytul:string, zdanie:string}} */
export function tytulZaWynik(wynik, dlugoscS) {
    const ppm = punktyNaMinute(wynik, dlugoscS);
    const p = PROGI_TYTULOW.find(x => ppm < x.do) ?? PROGI_TYTULOW.at(-1);
    return { tytul: p.tytul, zdanie: p.zdanie };
}

// REJESTR PRZYDOMKÓW - nowa technika/reakcja = nowy wpis. Reguły czytają tylko pola
// z Przebieg.zapiszWynik (rozbicie, momenty); tools/test-kronika.mjs pilnuje, że
// id techniki/reakcji, do których się odwołują, nadal istnieją (KOMBOSY, REAKCJE).
// Progi zgadnięte jak reszta liczb arcade.
export const PRZYDOMKI = [
    { id: 'podpalacz', nazwa: 'Podpalacz Chmur', pasuje: (p) => liczba(p?.momenty?.serie?.pozoga) >= 40 },
    { id: 'wiatrodmuch', nazwa: 'Wiatrodmuch', pasuje: (p) => liczba(p?.momenty?.serie?.rozwianie) >= 40 },
    { id: 'tancerz', nazwa: 'Tancerz Czystego Ruchu',
      pasuje: (p) => liczba(p?.wynik) > 0 && liczba(p?.rozbicie?.taniec) / liczba(p?.wynik) >= 0.6 },
    { id: 'pierunow', nazwa: 'Pan Pierunów',
      pasuje: (p) => liczba(p?.momenty?.techniki?.gromWOgniu) + liczba(p?.momenty?.techniki?.gromWZiemie) >= 3 },
    { id: 'splatacz', nazwa: 'Splatacz', pasuje: (p) => liczba(p?.momenty?.splecenia) >= 3 }
];

const MAX_PRZYDOMKOW = 2;

/** @returns {string[]} maks. 2 nazwy, w kolejności rejestru */
export function przydomki(pods) {
    return PRZYDOMKI.filter(r => r.pasuje(pods)).slice(0, MAX_PRZYDOMKOW).map(r => r.nazwa);
}

const WARSTWY = [['taniec', 'taniec'], ['pieczecie', 'pieczęcie'], ['techniki', 'techniki'], ['reakcje', 'reakcje']];

function tekstMiejsca(wk) {
    if (!wk) return '';
    if (!wk.wpisano) return 'Tym razem poza dziesiątką — Księga pamięta najlepszych, a Ty tańcz dalej.';
    if (wk.nowyRekord) return 'Nowy rekord Plemienia!';
    if (wk.pierwszyWpis) return 'Pierwszy zapis w Księdze tego obrzędu.';
    return `Miejsce ${wk.miejsce} w Księdze Plemienia.`;
}

/**
 * @param {object} pods  z Przebieg.zapiszWynik()
 * @param {{wynikKsiegi?: {wpisano:boolean, miejsce:number|null, nowyRekord:boolean, pierwszyWpis:boolean}|null}} [opcje]
 */
export function zbudujKronike(pods, opcje) {
    // `opcje` może być null (domyślna wartość parametru działa tylko dla undefined).
    const wynikKsiegi = opcje?.wynikKsiegi ?? null;
    const wynik = Math.floor(liczba(pods?.wynik));
    const linie = [];
    for (const [klucz, etykieta] of WARSTWY) {
        const v = liczba(pods?.rozbicie?.[klucz]);
        if (v > 0) linie.push(`${etykieta}: ${Math.floor(v)}`);
    }
    const pozoga = liczba(pods?.momenty?.serie?.pozoga);
    if (pozoga > 0) linie.push(`największa Pożoga: ${Math.floor(pozoga)} kłębów`);
    const splecenia = liczba(pods?.momenty?.splecenia);
    if (splecenia > 0) linie.push(`spleceń technik: ${Math.floor(splecenia)}`);

    let podpis = 'Enter — jeszcze raz · Esc — Polana';
    if (pods?.kragKoniec === false && pods.nastepny) podpis = `Enter — teraz tańczy: ${pods.nastepny} · Esc — Polana`;
    if (pods?.kragKoniec === true) podpis = 'Enter — nowy Krąg · Esc — Polana';

    return {
        tytul: pods?.nick ? `${pods.nick} — obrzęd skończony` : 'Obrzęd skończony',
        wynik: String(wynik),
        szaman: tytulZaWynik(pods?.wynik, pods?.dlugoscS),
        przydomki: przydomki(pods),
        linie,
        podium: Array.isArray(pods?.podium)
            ? pods.podium.map((w, i) => ({ miejsce: i + 1, nick: String(w.nick), wynik: Math.floor(liczba(w.wynik)) }))
            : null,
        miejsce: tekstMiejsca(wynikKsiegi),
        podpis
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/test-kronika.mjs && node tools/test-przebieg.mjs && sh tools/test-wszystko.sh 2>&1 | grep -E "^test-.*✗$"`
Expected: wszystkie `✓`; jedyny `✗` w zestawie to `test-rozdzielnosc.mjs` (baseline).

- [ ] **Step 5: Commit**

```bash
git add js/kronika.js js/przebieg.js tools/test-kronika.mjs tools/test-przebieg.mjs
git commit -m "Kronika: tytuly za punkty na minute, przydomki (rejestr ze straznikiem), teksty podsumowania"
```

---

### Task 3: `imiona.js` i `jaja.js` — losowe imię, nick-bóg, `odpalJajo`

**Files:**
- Create: `js/imiona.js`, `js/jaja.js`
- Modify: `js/techniki.js` (dopisać `odpalJajo`)
- Test: `tools/test-imiona.mjs`, `tools/test-jaja.mjs`

**Interfaces:**
- Consumes: `BARWA_GROMU`, `BARWA_ZAPLONU`, `pekniecieZiemi` w `js/techniki.js`; `MAX_NICK` z `js/tryby.js`.
- Produces: `IMIONA` (`{meskie:{przymiotniki,rzeczowniki}, zenskie:{przymiotniki,rzeczowniki}}`), `losoweImie(losowa?) → string`, `wszystkieImiona() → string[]`; `bogZNicku(nick) → 'perun'|'swarog'|'stribog'|'mokosz'|'weles'|null`; `odpalJajo(bog, frame, W, H, s)` (worek `{piorun, ekran, zaplon, fala, tecza, iskry, efekty, audio}`).

- [ ] **Step 1: Write the failing tests**

`tools/test-imiona.mjs`:

```js
/**
 * Losowe szamańskie imię (przycisk 🎲).
 *   node tools/test-imiona.mjs
 */
import { IMIONA, losoweImie, wszystkieImiona } from '../js/imiona.js';
import { MAX_NICK } from '../js/tryby.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('WSZYSTKIE KOMBINACJE:');
{
    const wszystkie = wszystkieImiona();
    spr(`jest co losować (${wszystkie.length} imion)`, wszystkie.length >= 50);
    const za = wszystkie.filter(i => i.length > MAX_NICK);
    spr(`KAŻDE imię mieści się w ${MAX_NICK} znakach (za długie: ${za.join(', ') || 'brak'})`, za.length === 0);
    spr('imiona dwuczłonowe, bez podwójnych spacji', wszystkie.every(i => /^\S+ \S+$/.test(i)));
    spr('imiona unikalne', new Set(wszystkie).size === wszystkie.length);
}

console.log('\nZGODA RODZAJOWA:');
{
    spr('przymiotniki męskie kończą się na -y', IMIONA.meskie.przymiotniki.every(p => p.endsWith('y')));
    spr('przymiotniki żeńskie kończą się na -a', IMIONA.zenskie.przymiotniki.every(p => p.endsWith('a')));
    spr('listy liczą tyle samo przymiotników (żadna płeć nie ma mniej)', IMIONA.meskie.przymiotniki.length === IMIONA.zenskie.przymiotniki.length);
    const m = new Set(IMIONA.meskie.przymiotniki), z = new Set(IMIONA.zenskie.przymiotniki);
    spr('żadne imię nie łączy męskiego przymiotnika z żeńskim rzeczownikiem', wszystkieImiona().every(i => {
        const [p, r] = i.split(' ');
        return (m.has(p) && IMIONA.meskie.rzeczowniki.includes(r)) || (z.has(p) && IMIONA.zenskie.rzeczowniki.includes(r));
    }));
}

console.log('\nLOSOWANIE:');
{
    const najnizsza = losoweImie(() => 0), najwyzsza = losoweImie(() => 0.9999999);
    spr(`losowa=0 daje poprawne imię (${najnizsza})`, wszystkieImiona().includes(najnizsza));
    spr(`losowa≈1 daje poprawne imię (${najwyzsza})`, wszystkieImiona().includes(najwyzsza));
    spr('losowa=1 (granica) nie wychodzi poza listę', wszystkieImiona().includes(losoweImie(() => 1)));
    spr('losowa NaN/ujemna nie psuje', wszystkieImiona().includes(losoweImie(() => NaN)) && wszystkieImiona().includes(losoweImie(() => -3)));
    spr('losowa zwracająca śmieci nie psuje', wszystkieImiona().includes(losoweImie(() => 'x')) && wszystkieImiona().includes(losoweImie(() => undefined)));
    const widziane = new Set(); for (let i = 0; i < 400; i++) widziane.add(losoweImie());
    spr(`prawdziwe Math.random daje różnorodność (${widziane.size} różnych w 400 losowaniach)`, widziane.size > 15);
    spr('każde wylosowane imię mieści się w nicku', [...widziane].every(i => i.length <= MAX_NICK));
}

process.exit(ok ? 0 : 1);
```

`tools/test-jaja.mjs`:

```js
/**
 * Jaja z nickami-bogami - rozpoznanie i efekty (szpiedzy, bez document).
 *   node tools/test-jaja.mjs
 */
import { bogZNicku, BOGOWIE } from '../js/jaja.js';
import { odpalJajo, BARWA_GROMU, BARWA_ZAPLONU } from '../js/techniki.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('ROZPOZNANIE BOGA:');
{
    spr('Perun', bogZNicku('Perun') === 'perun');
    spr('wielkość liter nie ma znaczenia', bogZNicku('PERUN') === 'perun' && bogZNicku('pErUn') === 'perun');
    spr('białe znaki na brzegach', bogZNicku('  Perun  ') === 'perun');
    spr('polskie znaki: Swaróg = swarog', bogZNicku('Swaróg') === 'swarog' && bogZNicku('swarog') === 'swarog');
    spr('Stribog, Mokosz, Weles', bogZNicku('Stribog') === 'stribog' && bogZNicku('Mokosz') === 'mokosz' && bogZNicku('Weles') === 'weles');
    spr('REVIEW FOCUS 4 - sufiks dubla Krągu: "Perun 2" to też Perun', bogZNicku('Perun 2') === 'perun' && bogZNicku('Weles 6') === 'weles');
    spr('inny tekst obok nie jest bogiem', bogZNicku('Perunek') === null && bogZNicku('Perun Piorun') === null && bogZNicku('Wielki Perun') === null);
    spr('puste/null/liczba/obiekt = brak boga, bez wyjątku', [bogZNicku(''), bogZNicku('   '), bogZNicku(null), bogZNicku(undefined), bogZNicku(5), bogZNicku({})].every(b => b === null));
    spr('HTML w nicku nie jest bogiem', bogZNicku('<b>Perun</b>') === null);
    spr('lista bogów = pięć żywiołów', BOGOWIE.length === 5 && ['perun', 'swarog', 'stribog', 'mokosz', 'weles'].every(b => BOGOWIE.includes(b)));
}

console.log('\nEFEKTY (szpiedzy):');
{
    const log = [];
    const spy = (nazwa, metody) => Object.fromEntries(metody.map(m => [m, (...a) => log.push([`${nazwa}.${m}`, ...a])]));
    // Proxy rzuca na KAŻDĄ zależność spoza worka: jajo NIE WOLNO dotykać technik, mocy ani kombosów.
    const worek = () => {
        log.length = 0;
        const b = {
            piorun: spy('piorun', ['uderz']), ekran: spy('ekran', ['uderz']), zaplon: spy('zaplon', ['zapal']),
            fala: spy('fala', ['wystrzel']), tecza: spy('tecza', ['aktywuj']), iskry: spy('iskry', ['wystrzel']),
            efekty: spy('efekty', ['odpal']),
            audio: spy('audio', ['playGromSFX', 'playWybuchSFX', 'playAardSFX'])
        };
        return new Proxy(b, { get(t, k) { if (!(k in t)) throw new Error(`niedozwolona zależność: ${String(k)}`); return t[k]; } });
    };
    const frame = { hands: [], pose: null };
    const nazwy = () => log.map(l => l[0]).join(',');

    odpalJajo('perun', frame, 1920, 1080, worek());
    spr(`Perun: piorun + wstrząs + grzmot (${nazwy()})`, nazwy() === 'piorun.uderz,ekran.uderz,audio.playGromSFX');
    spr('Perun: piorun w barwie Gromu', log[0][2] === BARWA_GROMU);
    odpalJajo('swarog', frame, 1920, 1080, worek());
    spr(`Swaróg: zapłon sylwetki w barwie ognia (${nazwy()})`, nazwy().includes('zaplon.zapal') && log.find(l => l[0] === 'zaplon.zapal')[1] === BARWA_ZAPLONU.ogien);
    odpalJajo('stribog', frame, 1920, 1080, worek());
    spr(`Stribog: fala w barwie Aarda (${nazwy()})`, nazwy().includes('fala.wystrzel') && log.find(l => l[0] === 'fala.wystrzel')[4] === BARWA_ZAPLONU.aard);
    odpalJajo('mokosz', frame, 1920, 1080, worek());
    spr(`Mokosz: tęcza (${nazwy()})`, nazwy().includes('tecza.aktywuj'));
    odpalJajo('weles', frame, 1920, 1080, worek());
    spr(`Weles: iskry + fala (${nazwy()})`, nazwy().includes('iskry.wystrzel') && nazwy().includes('fala.wystrzel'));
    for (const b of ['perun', 'swarog', 'stribog', 'mokosz', 'weles']) {
        odpalJajo(b, frame, 1920, 1080, worek());
        spr(`${b}: nie rzuca (nie sięga po techniki/moc/kombosy), odpala efekt pieczęci`, log.some(l => l[0] === 'efekty.odpal' && l[1] === b) || b === 'perun');
    }
    spr('nieznany bóg: nic, bez wyjątku', (() => { odpalJajo('zeus', frame, 1920, 1080, worek()); odpalJajo(null, frame, 1920, 1080, worek()); return log.length === 0; })());
    spr('brak audio w worku nie wywala jaja', (() => { try { odpalJajo('perun', frame, 1920, 1080, { piorun: spy('piorun', ['uderz']), ekran: spy('ekran', ['uderz']) }); return true; } catch { return false; } })());
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/test-imiona.mjs; node tools/test-jaja.mjs`
Expected: FAIL — `Cannot find module` (oba).

- [ ] **Step 3: Write minimal implementation**

`js/imiona.js`:

```js
/**
 * Losowe szamańskie imię - przycisk 🎲 przy polu nicku ("Osmalony Borsuk").
 *
 * Przymiotnik zgadza się rodzajowo z rzeczownikiem (dwie osobne listy: męska i żeńska),
 * a KAŻDA kombinacja mieści się w limicie nicku (MAX_NICK = 16 znaków) - test wylicza
 * wszystkie, więc dopisanie za długiego słowa wywala go od razu.
 */
export const IMIONA = {
    meskie: {
        przymiotniki: ['Osmalony', 'Zadymiony', 'Płomienny', 'Leśny', 'Mglisty', 'Gromowy'],
        rzeczowniki: ['Borsuk', 'Kruk', 'Wilk', 'Żubr', 'Jeleń', 'Dąb']
    },
    zenskie: {
        przymiotniki: ['Osmalona', 'Zadymiona', 'Płomienna', 'Leśna', 'Mglista', 'Gromowa'],
        rzeczowniki: ['Sowa', 'Wrona', 'Łania', 'Iskra', 'Mgła', 'Brzoza']
    }
};

const GRUPY = [IMIONA.meskie, IMIONA.zenskie];

/** Wszystkie możliwe imiona - do testu długości i unikalności. */
export function wszystkieImiona() {
    const out = [];
    for (const g of GRUPY) for (const p of g.przymiotniki) for (const r of g.rzeczowniki) out.push(`${p} ${r}`);
    return out;
}

// Losowa spoza 0..1 (NaN, ujemna, tekst) nie może wyrzucić poza listę.
const jakoUlamek = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(0.999999, v)) : 0);
const wybierz = (lista, losowa) => lista[Math.floor(jakoUlamek(losowa()) * lista.length)];

/** @param {()=>number} [losowa]  wstrzykiwana w testach */
export function losoweImie(losowa = Math.random) {
    const g = wybierz(GRUPY, losowa);
    return `${wybierz(g.przymiotniki, losowa)} ${wybierz(g.rzeczowniki, losowa)}`;
}
```

`js/jaja.js`:

```js
/**
 * Jaja z nickami-bogami: gracz o imieniu "Perun" dostaje piorun na ekranie Kroniki.
 * Rozpoznanie jest CZYSTE (testy w node); sam efekt to `odpalJajo` w js/techniki.js
 * (ten sam worek zależności co odpalTechnike).
 */
export const BOGOWIE = ['perun', 'swarog', 'stribog', 'mokosz', 'weles'];

/**
 * Nick -> bóg albo null. Odporne na wielkość liter, polskie znaki ("Swaróg") i sufiks
 * dubla w Kręgu ("Perun 2" - Krag dopisuje numer, gdy dwóch tancerzy ma to samo imię).
 * Tylko CAŁE imię: "Perunek" ani "Wielki Perun" nie są bogami.
 */
export function bogZNicku(nick) {
    if (typeof nick !== 'string') return null;
    const n = nick.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // ó -> o, ę -> e ...
        .replace(/ł/g, 'l')                                  // ł nie rozkłada się w NFD
        .replace(/\s+\d$/, '');                              // sufiks dubla Kręgu
    return BOGOWIE.includes(n) ? n : null;
}
```

W `js/techniki.js` dopisać import `import { BOGOWIE } from './jaja.js';` (obok istniejących importów; jaja.js jest czyste, bez cykli), a na końcu pliku:

```js
/**
 * Jajo z nickiem-bogiem (js/jaja.js): krótki, bezpieczny efekt na ekranie Kroniki.
 * NIE uzbraja technik, NIE pobiera mocy, NIE dotyka kombosów - to tylko widowisko,
 * dlatego worek `s` jest węższy niż w odpalTechnike (test używa Proxy, które rzuca
 * na każdą zależność spoza listy).
 *
 * @param {string|null} bog  z bogZNicku()
 * @param {object} frame  kontrakt klatki
 * @param {number} W
 * @param {number} H
 * @param {{piorun, ekran, zaplon, fala, tecza, iskry, efekty, audio}} s
 */
export function odpalJajo(bog, frame, W, H, s) {
    if (!BOGOWIE.includes(bog)) return;   // nieznany bóg/null: nic - i bez efekty.odpal(nieznane id)
    const ziemia = pekniecieZiemi(frame, W, H);
    if (bog === 'perun') {
        s.piorun.uderz(ziemia, BARWA_GROMU, 1.0);
        s.ekran.uderz(1.0);
        s.audio?.playGromSFX?.();
        return;
    }
    s.efekty?.odpal(bog);   // ta sama animacja co przy złożeniu pieczęci tego żywiołu
    if (bog === 'swarog') {
        s.zaplon.zapal(BARWA_ZAPLONU.ogien, 1.0);
        s.audio?.playWybuchSFX?.(1);
    } else if (bog === 'stribog') {
        s.fala.wystrzel(ziemia, { x: 0, y: -1, z: 0 }, 1.0, BARWA_ZAPLONU.aard);
        s.audio?.playAardSFX?.(1);
    } else if (bog === 'mokosz') {
        s.tecza.aktywuj();
    } else if (bog === 'weles') {
        s.iskry.wystrzel(ziemia, 1.0);
        s.fala.wystrzel(ziemia, { x: 0, y: -1, z: 0 }, 1.0, BARWA_GROMU);
        s.audio?.playGromSFX?.();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/test-imiona.mjs && node tools/test-jaja.mjs && node tools/test-techniki.mjs`
Expected: wszystkie `✓` (istniejący `test-techniki` nietknięty).

- [ ] **Step 5: Commit**

```bash
git add js/imiona.js js/jaja.js js/techniki.js tools/test-imiona.mjs tools/test-jaja.mjs
git commit -m "Imiona (kostka), jaja z nickami-bogami: rozpoznanie i odpalJajo w worku techniki"
```

---

### Task 4: Manifest z długościami i model `Menu`

**Files:**
- Modify: `js/piesni.js` (`walidujManifest` zachowuje `dlugoscS`), `assets/muzyka/utwory.json` (dopisać `dlugoscS`), `tools/test-piesni.mjs`
- Create: `js/menu.js`
- Test: `tools/test-menu.mjs`

**Interfaces:**
- Consumes: `PROBA_DLUGOSCI`, `PIESN_AWARYJNA_S`, `MAX_NICK`, `MIN_KRAG`, `MAX_KRAG` z `js/tryby.js`; `parsujKonfiguracje` (test zgodności kształtu).
- Produces: wpisy manifestu z polem `dlugoscS:number` (0, gdy nieznana); `KAMIENIE`, `EKRANY`; `class Menu({piesni, ostatniNick})` z polami `ekran, tryb, piesn, czas, zew, krag, nicki, nick, zajety, kronika, piesni` i metodami `ustawPiesni(lista)`, `dostepne(kamien)`, `podpowiedz(kamien)`, `wybierz(kamien) → bool`, `ustaw(pole, wartosc) → bool` (pola `piesn|czas|zew|krag|nick`), `ustawNick(i, tekst) → bool`, `dodajGracza() → bool`, `usunGracza(i) → bool`, `bledy() → string[]`, `konfiguracja() → {tryb,dlugoscS,piesn,zew,krag,nick}|null`, `wstecz() → bool`, `doPolany()`, `naGre()`, `naKronike(kronika)`, `zUrl(konf) → bool`.

- [ ] **Step 1: Write the failing tests**

W `tools/test-piesni.mjs`, w bloku `MANIFEST - WALIDACJA` dopisać:

```js
    spr('dlugoscS z manifestu zachowana', walidujManifest([{ plik: 'a.m4a', dlugoscS: 216.4 }])[0].dlugoscS === 216.4);
    spr('brak/zła dlugoscS = 0', [undefined, NaN, -5, 'x', 0, Infinity].every(d => walidujManifest([{ plik: 'a.m4a', dlugoscS: d }])[0].dlugoscS === 0));
```

i w bloku `MANIFEST NA DYSKU`, w pętli po `m`, dopisać:

```js
        spr(`'${u.plik}' ma dlugoscS z manifestu (menu pokazuje czas pieśni)`, u.dlugoscS > 0);
```

`tools/test-menu.mjs`:

```js
/**
 * Menu - model ekranów i konfiguracji (czysta logika, bez DOM).
 *   node tools/test-menu.mjs
 */
import { Menu, KAMIENIE, EKRANY } from '../js/menu.js';
import { parsujKonfiguracje, PROBA_DLUGOSCI, PIESN_AWARYJNA_S, MAX_NICK, MAX_KRAG, MIN_KRAG } from '../js/tryby.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const piesni = [{ plik: 'a.m4a', tytul: 'Ogień w żyłach', dlugoscS: 262.8 }, { plik: 'b.m4a', tytul: 'Woda być', dlugoscS: 216.4 }];

console.log('START:');
{
    const m = new Menu({ piesni, ostatniNick: '  Ola  ' });
    spr('zaczyna na Polanie', m.ekran === 'polana' && EKRANY.includes(m.ekran));
    spr('cztery kamienie', KAMIENIE.join() === 'obrzed,proba,swobodny,ksiega');
    spr('ostatni nick wstępnie wypełniony (surowo - przycinany przy konfiguracji)', m.nick === '  Ola  ');
    spr('nick dłuższy niż limit ucięty', new Menu({ ostatniNick: 'x'.repeat(50) }).nick.length === MAX_NICK);
    spr('śmieci w konstruktorze nie rzucają', new Menu({ piesni: 'x', ostatniNick: null }).piesni.length === 0 && new Menu().ekran === 'polana');
}

console.log('\nKAMIENIE:');
{
    const m = new Menu({ piesni });
    spr('wszystkie dostępne, gdy są pieśni', KAMIENIE.every(k => m.dostepne(k)));
    spr('nieznany kamień niedostępny', m.dostepne('zeus') === false && m.dostepne(null) === false);
    const bez = new Menu({ piesni: [] });
    spr('Obrzęd przygaszony bez pieśni, reszta dostępna', bez.dostepne('obrzed') === false && bez.dostepne('proba') && bez.dostepne('swobodny') && bez.dostepne('ksiega'));
    spr('podpowiedź tłumaczy brak pieśni (ciepło)', /pieśni/.test(bez.podpowiedz('obrzed')) && bez.podpowiedz('proba') === '');
    spr('wybranie niedostępnego nie zmienia ekranu', bez.wybierz('obrzed') === false && bez.ekran === 'polana');
    spr('ustawPiesni po fakcie odblokowuje Obrzęd (manifest wczytuje się asynchronicznie)', (bez.ustawPiesni(piesni), bez.dostepne('obrzed')));
    spr('ustawPiesni(śmieci) = pusta lista', (() => { const x = new Menu({ piesni }); x.ustawPiesni(null); return x.piesni.length === 0; })());
    spr('Księga otwiera się bez konfiguracji', (() => { const x = new Menu({ piesni }); return x.wybierz('ksiega') && x.ekran === 'ksiega'; })());
    spr('tryb wybrany -> konfiguracja', (() => { const x = new Menu({ piesni }); return x.wybierz('proba') && x.ekran === 'konfig' && x.tryb === 'proba'; })());
}

console.log('\nUSTAWIENIA:');
{
    const m = new Menu({ piesni });
    m.wybierz('obrzed');
    spr('piesn: poprawny indeks', m.ustaw('piesn', 1) && m.piesn === 1);
    spr('piesn: poza zakresem/ułamek/tekst odrzucone', !m.ustaw('piesn', 5) && !m.ustaw('piesn', -1) && !m.ustaw('piesn', 0.5) && !m.ustaw('piesn', 'x') && m.piesn === 1);
    spr('czas: tylko z PROBA_DLUGOSCI', PROBA_DLUGOSCI.every(c => m.ustaw('czas', c)) && !m.ustaw('czas', 45) && !m.ustaw('czas', 'x'));
    spr('zew i krąg to przełączniki', m.ustaw('zew', true) && m.zew === true && m.ustaw('krag', 1) && m.krag === true);
    spr('nieznane pole odrzucone', m.ustaw('hack', 1) === false && m.ustaw('__proto__', 1) === false);
    spr('nick surowy do limitu (spacje w trakcie pisania zostają)', m.ustaw('nick', 'Ola Maria ') && m.nick === 'Ola Maria ');
    spr('nick ponad limit ucięty', (m.ustaw('nick', 'x'.repeat(40)), m.nick.length === MAX_NICK));
    spr('nick nie-tekst odrzucony', !m.ustaw('nick', null) && !m.ustaw('nick', 5));
}

console.log('\nKRĄG - LISTA TANCERZY:');
{
    const m = new Menu({ piesni });
    m.wybierz('proba'); m.ustaw('krag', true);
    spr('startuje z dwoma pustymi miejscami', m.nicki.length === MIN_KRAG);
    spr('dodajGracza do limitu', (() => { while (m.nicki.length < MAX_KRAG) m.dodajGracza(); return m.nicki.length === MAX_KRAG && m.dodajGracza() === false; })());
    spr('usunGracza do minimum', (() => { while (m.nicki.length > MIN_KRAG) m.usunGracza(0); return m.nicki.length === MIN_KRAG && m.usunGracza(0) === false; })());
    spr('ustawNick: poprawny indeks', m.ustawNick(0, 'Ola') && m.nicki[0] === 'Ola');
    spr('ustawNick: zły indeks/nie-tekst odrzucone', !m.ustawNick(9, 'x') && !m.ustawNick(-1, 'x') && !m.ustawNick(0, null) && !m.ustawNick(0.5, 'x'));
    spr('ustawNick ucina do limitu', (m.ustawNick(1, 'y'.repeat(40)), m.nicki[1].length === MAX_NICK));
    spr('usunGracza: zły indeks odrzucony', (() => { m.dodajGracza(); const n = m.nicki.length; return m.usunGracza(99) === false && m.nicki.length === n; })());
}

console.log('\nBŁĘDY (ciepłe zaproszenia):');
{
    const m = new Menu({ piesni, ostatniNick: '' });
    m.wybierz('proba');
    spr('pusty nick solo: zaproszenie, nie wyrok', m.bledy().length === 1 && /imi/i.test(m.bledy()[0]) && !/błąd|nie wolno|niepoprawn/i.test(m.bledy()[0]));
    spr('konfiguracja() = null przy błędach', m.konfiguracja() === null);
    m.ustaw('nick', '   ');
    spr('nick z samych spacji = nadal błąd', m.bledy().length === 1);
    m.ustaw('nick', 'Ola');
    spr('poprawny nick: brak błędów', m.bledy().length === 0 && m.konfiguracja() !== null);
    m.ustaw('krag', true);
    spr('Krąg z pustymi imionami: zaproszenie', m.bledy().length === 1 && /tancerz|imieni/i.test(m.bledy()[0]));
    m.ustawNick(0, 'Ola'); m.ustawNick(1, 'Bartek');
    spr('Krąg z kompletem imion: brak błędów', m.bledy().length === 0);
    m.ustawNick(1, '   ');
    spr('jedno imię z samych spacji = błąd', m.bledy().length === 1);
    spr('wszystkie komunikaty bez słów porażki', (() => {
        const w = new Menu({ piesni: [], ostatniNick: '' }); w.wybierz('proba'); w.ustaw('krag', true);
        return !/błąd|niepoprawn|nie wolno|źle/i.test(JSON.stringify([m.bledy(), w.bledy(), w.podpowiedz('obrzed')]));
    })());
}

console.log('\nKONFIGURACJA = KSZTAŁT parsujKonfiguracje (+ nick):');
{
    const klucze = (o) => Object.keys(o).filter(k => k !== 'nick').sort().join();
    const wzor = klucze(parsujKonfiguracje('?tryb=proba&czas=60'));

    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    m.wybierz('proba'); m.ustaw('czas', 120); m.ustaw('zew', true);
    const k = m.konfiguracja();
    spr('próba: klucze jak w parsujKonfiguracje', klucze(k) === wzor);
    spr('próba: wartości', k.tryb === 'proba' && k.dlugoscS === 120 && k.zew === true && k.krag === null && k.nick === 'Ola' && k.piesn === 0);

    const o = new Menu({ piesni, ostatniNick: 'Ola' });
    o.wybierz('obrzed'); o.ustaw('piesn', 1);
    const ko = o.konfiguracja();
    spr('obrzęd: indeks pieśni, długość awaryjna (prawdziwą ustawia main po załadowaniu)', ko.tryb === 'obrzed' && ko.piesn === 1 && ko.dlugoscS === PIESN_AWARYJNA_S && klucze(ko) === wzor);

    const kr = new Menu({ piesni });
    kr.wybierz('proba'); kr.ustaw('krag', true); kr.ustawNick(0, ' Ola '); kr.ustawNick(1, 'Bartek');
    const kk = kr.konfiguracja();
    spr('Krąg: nicki przycięte, nick solo = null', JSON.stringify(kk.krag) === '["Ola","Bartek"]' && kk.nick === null);

    const s = new Menu({ piesni });
    s.wybierz('swobodny');
    const ks = s.konfiguracja();
    spr('swobodny: bez opcji, zawsze poprawny', ks.tryb === 'swobodny' && ks.zew === false && ks.krag === null && ks.nick === null && ks.dlugoscS === 0 && klucze(ks) === wzor);
    s.ustaw('zew', true); s.ustaw('krag', true);
    spr('swobodny ignoruje Zew i Krąg', s.konfiguracja().zew === false && s.konfiguracja().krag === null);

    const bezTrybu = new Menu({ piesni });
    spr('bez wybranego trybu konfiguracja = null', bezTrybu.konfiguracja() === null);

    const przytniety = new Menu({ piesni });
    przytniety.wybierz('proba'); przytniety.ustaw('nick', '  Ola  ');
    spr('nick w konfiguracji przycięty', przytniety.konfiguracja().nick === 'Ola');
}

console.log('\nPRZEJŚCIA EKRANÓW:');
{
    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    m.wybierz('proba');
    spr('wstecz z konfiguracji -> Polana, tryb zapomniany', m.wstecz() === true && m.ekran === 'polana' && m.tryb === null);
    m.wybierz('ksiega');
    spr('wstecz z Księgi -> Polana', m.wstecz() === true && m.ekran === 'polana');
    spr('wstecz na Polanie nic nie robi', m.wstecz() === false && m.ekran === 'polana');
    m.wybierz('proba'); m.naGre();
    spr('naGre: ekran gra', m.ekran === 'gra');
    spr('wstecz z gry -> Polana', m.wstecz() === true && m.ekran === 'polana');
    m.naKronike({ tytul: 'x' });
    spr('naKronike: ekran i zawartość', m.ekran === 'kronika' && m.kronika.tytul === 'x');
    m.naGre();
    spr('naGre czyści Kronikę', m.kronika === null);
    m.naKronike({ tytul: 'y' }); m.doPolany();
    spr('doPolany z dowolnego ekranu czyści Kronikę i tryb', m.ekran === 'polana' && m.kronika === null && m.tryb === null);
}

console.log('\nZAJĘTY (REVIEW FOCUS 3 - podwójne kliknięcie podczas ładowania):');
{
    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    m.wybierz('proba');
    spr('wolny: można startować', m.zajety === false && m.konfiguracja() !== null);
    m.zajety = true;
    spr('zajęty: konfiguracja() dalej poprawna, ale UI blokuje przycisk (zajety)', m.konfiguracja() !== null && m.zajety === true);
    spr('zajęty: wstecz/wybierz nie ruszają ekranu', (() => { const e = m.ekran; m.wstecz(); m.wybierz('ksiega'); return m.ekran === e; })());
}

console.log('\nZ ADRESU (skrót dewelopera):');
{
    const m = new Menu({ piesni, ostatniNick: 'Ola' });
    spr('swobodny z adresu = nic (zostaje Polana)', m.zUrl(parsujKonfiguracje('')) === false && m.ekran === 'polana');
    spr('próba z adresu wypełnia konfigurację', m.zUrl(parsujKonfiguracje('?tryb=proba&czas=60&zew=1')) === true && m.ekran === 'konfig' && m.tryb === 'proba' && m.czas === 60 && m.zew === true);
    const o = new Menu({ piesni });
    spr('obrzęd z adresu: indeks pieśni', o.zUrl(parsujKonfiguracje('?tryb=obrzed&piesn=1')) === true && o.piesn === 1);
    const poza = new Menu({ piesni });
    poza.zUrl(parsujKonfiguracje('?tryb=obrzed&piesn=9'));
    spr('indeks pieśni spoza listy -> 0', poza.piesn === 0);
    const kr = new Menu({ piesni });
    kr.zUrl(parsujKonfiguracje('?tryb=proba&krag=Ola,Bartek,Cezary'));
    spr('Krąg z adresu wypełnia listę', kr.krag === true && kr.nicki.join() === 'Ola,Bartek,Cezary');
    const bez = new Menu({ piesni: [] });
    spr('obrzęd z adresu bez pieśni nie otwiera konfiguracji', bez.zUrl(parsujKonfiguracje('?tryb=obrzed')) === false && bez.ekran === 'polana');
    spr('śmieci nie rzucają', new Menu({ piesni }).zUrl(null) === false && new Menu({ piesni }).zUrl({}) === false);
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/test-menu.mjs; node tools/test-piesni.mjs 2>&1 | grep "✗"`
Expected: `test-menu` FAIL — `Cannot find module '.../js/menu.js'`; `test-piesni` — `✗ dlugoscS z manifestu zachowana` i `✗ 'Ogien w zyłach.m4a' ma dlugoscS z manifestu`.

- [ ] **Step 3: Write minimal implementation**

W `js/piesni.js`, w `walidujManifest`, w literale wpisu dodać pole (po `licencja`):

```js
            licencja: tekst(w.licencja),
            // Długość z manifestu tylko do WYŚWIETLENIA w menu; prawdziwą, autorytatywną
            // długość rundy daje audio.duration po załadowaniu (Piesn.zaladuj).
            dlugoscS: typeof w.dlugoscS === 'number' && Number.isFinite(w.dlugoscS) && w.dlugoscS > 0 ? w.dlugoscS : 0
```

Wygeneruj `dlugoscS` w manifeście z faktycznych plików (ffprobe jest w systemie; duration z kontenera):

```bash
python3 - <<'EOF'
import json, subprocess
p = 'assets/muzyka/utwory.json'
wpisy = json.load(open(p))
for w in wpisy:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1',
                          f"assets/muzyka/{w['plik']}"], capture_output=True, text=True).stdout.strip()
    w['dlugoscS'] = round(float(out), 1)
json.dump(wpisy, open(p, 'w'), ensure_ascii=False, indent=2)
print([(w['plik'], w['dlugoscS']) for w in wpisy])
EOF
```

`js/menu.js`:

```js
/**
 * Menu - model ekranów i konfiguracji (CZYSTA LOGIKA, bez DOM).
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 *
 * Model trzyma stan i wybory, warstwa DOM (js/polanaUi.js) tylko je renderuje.
 * `konfiguracja()` zwraca DOKŁADNIE kształt parsujKonfiguracje (+ nick), więc menu
 * i adres prowadzą do tej samej uruchomZKonfiguracji w main.js - jedna ścieżka
 * wejścia do gry.
 *
 * TON (§2): błędy konfiguracji to zaproszenia ("Dopisz jeszcze jednego tancerza"),
 * nigdy wyrok ani czerwony komunikat.
 */
import { PROBA_DLUGOSCI, PIESN_AWARYJNA_S, MAX_NICK, MIN_KRAG, MAX_KRAG } from './tryby.js';

export const KAMIENIE = ['obrzed', 'proba', 'swobodny', 'ksiega'];
export const EKRANY = ['polana', 'konfig', 'ksiega', 'gra', 'kronika'];

// Nick trzymamy SUROWY (tylko ucięty do limitu) - przycięcie spacji w trakcie pisania
// zjadałoby spację między imionami ("Ola " -> "Ola" przed wpisaniem "Maria").
// Przycinamy dopiero w bledy()/konfiguracja().
const ciety = (s) => String(s ?? '').slice(0, MAX_NICK);
const przytnij = (s) => String(s ?? '').trim().slice(0, MAX_NICK);

export class Menu {
    /**
     * @param {{piesni?: Array<{plik:string, tytul:string, dlugoscS:number}>, ostatniNick?: string}} [opcje]
     */
    constructor({ piesni = [], ostatniNick = '' } = {}) {
        this.piesni = Array.isArray(piesni) ? piesni : [];
        this.ekran = 'polana';
        this.tryb = null;
        this.piesn = 0;
        this.czas = 90;
        this.zew = false;
        this.krag = false;
        this.nicki = Array.from({ length: MIN_KRAG }, () => '');
        this.nick = typeof ostatniNick === 'string' ? ciety(ostatniNick) : '';
        this.zajety = false;    // trwa ładowanie kamery - UI blokuje przycisk startu
        this.kronika = null;
    }

    /** Manifest pieśni wczytuje się asynchronicznie - Obrzęd odblokowuje się po fakcie. */
    ustawPiesni(lista) {
        this.piesni = Array.isArray(lista) ? lista : [];
        if (this.piesn >= this.piesni.length) this.piesn = 0;
    }

    dostepne(kamien) {
        if (!KAMIENIE.includes(kamien)) return false;
        return kamien !== 'obrzed' || this.piesni.length > 0;
    }

    podpowiedz(kamien) {
        return kamien === 'obrzed' && !this.dostepne('obrzed') ? 'Duchy jeszcze nie przyniosły pieśni' : '';
    }

    wybierz(kamien) {
        if (this.zajety || !this.dostepne(kamien)) return false;
        if (kamien === 'ksiega') { this.ekran = 'ksiega'; return true; }
        this.tryb = kamien;
        this.ekran = 'konfig';
        return true;
    }

    ustaw(pole, wartosc) {
        switch (pole) {
            case 'piesn':
                if (!Number.isInteger(wartosc) || wartosc < 0 || wartosc >= this.piesni.length) return false;
                this.piesn = wartosc; return true;
            case 'czas':
                if (!PROBA_DLUGOSCI.includes(wartosc)) return false;
                this.czas = wartosc; return true;
            case 'zew': this.zew = !!wartosc; return true;
            case 'krag': this.krag = !!wartosc; return true;
            case 'nick':
                if (typeof wartosc !== 'string') return false;
                this.nick = ciety(wartosc); return true;
            default: return false;
        }
    }

    ustawNick(i, tekst) {
        if (!Number.isInteger(i) || i < 0 || i >= this.nicki.length || typeof tekst !== 'string') return false;
        this.nicki[i] = ciety(tekst);
        return true;
    }

    dodajGracza() {
        if (this.nicki.length >= MAX_KRAG) return false;
        this.nicki.push('');
        return true;
    }

    usunGracza(i) {
        if (!Number.isInteger(i) || i < 0 || i >= this.nicki.length || this.nicki.length <= MIN_KRAG) return false;
        this.nicki.splice(i, 1);
        return true;
    }

    /** @returns {string[]} ciepłe zaproszenia; pusta lista = konfiguracja poprawna */
    bledy() {
        if (!this.tryb || this.tryb === 'swobodny') return [];
        const b = [];
        if (this.tryb === 'obrzed' && !this.dostepne('obrzed')) b.push(this.podpowiedz('obrzed'));
        if (this.krag) {
            if (this.nicki.some(n => !przytnij(n))) b.push('Każdy tancerz potrzebuje imienia');
        } else if (!przytnij(this.nick)) {
            b.push('Powiedz, jak Cię zwą — wpisz imię albo rzuć kośćmi 🎲');
        }
        return b;
    }

    /** @returns {{tryb,dlugoscS,piesn,zew,krag,nick}|null} ten sam kształt co parsujKonfiguracje (+ nick) */
    konfiguracja() {
        if (!this.tryb || this.bledy().length) return null;
        const swobodny = this.tryb === 'swobodny';
        return {
            tryb: this.tryb,
            dlugoscS: this.tryb === 'proba' ? this.czas : this.tryb === 'obrzed' ? PIESN_AWARYJNA_S : 0,
            piesn: this.tryb === 'obrzed' ? this.piesn : 0,
            zew: swobodny ? false : this.zew,
            krag: swobodny || !this.krag ? null : this.nicki.map(przytnij),
            nick: swobodny || this.krag ? null : przytnij(this.nick)
        };
    }

    /** Krok wstecz. Podczas ładowania kamery menu stoi w miejscu. */
    wstecz() {
        if (this.zajety || this.ekran === 'polana') return false;
        this.doPolany();
        return true;
    }

    doPolany() {
        this.ekran = 'polana';
        this.tryb = null;
        this.kronika = null;
    }

    naGre() {
        this.ekran = 'gra';
        this.kronika = null;
    }

    naKronike(kronika) {
        this.ekran = 'kronika';
        this.kronika = kronika ?? null;
    }

    /**
     * Skrót dewelopera: wypełnia konfigurację z adresu (?tryb=proba&czas=60&zew=1&krag=Ola,Bartek).
     * @returns {boolean} true = otwarto konfigurację
     */
    zUrl(konf) {
        if (!konf || (konf.tryb !== 'proba' && konf.tryb !== 'obrzed')) return false;
        if (!this.wybierz(konf.tryb)) return false;
        if (konf.tryb === 'obrzed') this.ustaw('piesn', konf.piesn);
        else this.ustaw('czas', konf.dlugoscS);
        this.zew = !!konf.zew;
        if (Array.isArray(konf.krag) && konf.krag.length >= MIN_KRAG) {
            this.krag = true;
            this.nicki = konf.krag.slice(0, MAX_KRAG).map(ciety);
        }
        return true;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/test-menu.mjs && node tools/test-piesni.mjs && sh tools/test-wszystko.sh 2>&1 | grep -E "^test-.*✗$"`
Expected: wszystkie `✓`; jedyny `✗` w zestawie to `test-rozdzielnosc.mjs`.

- [ ] **Step 5: Commit**

```bash
git add js/menu.js js/piesni.js assets/muzyka/utwory.json tools/test-menu.mjs tools/test-piesni.mjs
git commit -m "Menu: model ekranow i konfiguracji (ksztalt parsujKonfiguracje), manifest z dlugosciami"
```

---

### Task 5: Warstwa DOM — Polana, konfiguracja, Księga, Kronika

**Files:**
- Modify: `index.html` (zastąpić `#start-screen` blokiem `#menu`), `style.css` (nowe style; stare reguły `#start-screen` usunąć lub zostawić, jeśli nic już z nich nie korzysta)
- Create: `js/polanaUi.js`
- Test: zrzuty ekranu z headless Chrome (poniżej) + `node tools/test-wszystko.sh`

**Interfaces:**
- Consumes: `Menu` (Task 4), `Ksiega`, `nazwaTablicy` (Task 1), `formatCzasu` z `js/rundaHud.js`, `losoweImie` (Task 3).
- Produces: `class PolanaUi(doc, { menu, ksiega, losoweImie, onStart, onJeszczeRaz, onDoPolany })` z `render()`; kontrakt DOM (id poniżej).

**Przed budową wizualną wywołaj skill `frontend-design:frontend-design`** i trzymaj się kierunku z sekcji „Wizualia" specu (paleta `--wegiel/--zar/--plomien/--zloto/--kosc`, kroje Bona Nova + Noto Sans Runic, kamienie z wyrytą runą rozżarzającą się przy najechaniu, iskry z ogniska w CSS, kora brzozowa dla Księgi). **Kontrakt id/klas poniżej jest stały** — styl wolno rozwijać, strukturę DOM nie.

- [ ] **Step 1: Markup**

W `index.html` zastąp cały blok `<div id="start-screen"> … </div>` poniższym (zostaw `#loading-screen` bez zmian):

```html
        <!-- MENU "Polana" (2026-10-01, podprojekt 3). Cztery ekrany w jednej warstwie;
             widoczny jest ten, który wskazuje model Menu (js/menu.js), render robi
             js/polanaUi.js. Teksty gracza WYŁĄCZNIE przez textContent. -->
        <div id="menu">
            <section id="polana" class="menu-ekran">
                <div class="krag-run" aria-hidden="true">
                    <span>ᚲ</span><span>ᚦ</span><span>ᚢ</span><span>ᚨ</span><span>ᛚ</span>
                </div>
                <p class="kicker">Warsztat vibe codingu</p>
                <h1>Król<br><span class="highlight">Szamanów</span></h1>
                <p class="podtytul">Tańcz. Składaj pieczęcie. Wołaj żywioły.</p>
                <div id="kamienie" role="menu" aria-label="Wybierz obrzęd">
                    <button type="button" class="kamien" data-kamien="obrzed" role="menuitem">
                        <span class="kamien-runa" aria-hidden="true">ᛟ</span>
                        <span class="kamien-nazwa">Obrzęd</span>
                        <span class="kamien-opis">taniec do pieśni</span>
                    </button>
                    <button type="button" class="kamien" data-kamien="proba" role="menuitem">
                        <span class="kamien-runa" aria-hidden="true">ᚦ</span>
                        <span class="kamien-nazwa">Próba</span>
                        <span class="kamien-opis">taniec na czas</span>
                    </button>
                    <button type="button" class="kamien" data-kamien="swobodny" role="menuitem">
                        <span class="kamien-runa" aria-hidden="true">ᛗ</span>
                        <span class="kamien-nazwa">Swobodny taniec</span>
                        <span class="kamien-opis">bez punktów</span>
                    </button>
                    <button type="button" class="kamien" data-kamien="ksiega" role="menuitem">
                        <span class="kamien-runa" aria-hidden="true">ᛉ</span>
                        <span class="kamien-nazwa">Księga Plemienia</span>
                        <span class="kamien-opis">najlepsze wyniki</span>
                    </button>
                </div>
                <p id="polana-podpowiedz" aria-live="polite"></p>
            </section>

            <section id="konfig" class="menu-ekran hidden">
                <h2 id="konfig-tytul"></h2>
                <div id="konfig-piesn" class="grupa hidden">
                    <div class="etykieta">Pieśń</div>
                    <div id="konfig-piesni" class="wybor" role="radiogroup" aria-label="Pieśń"></div>
                </div>
                <div id="konfig-czas" class="grupa hidden">
                    <div class="etykieta">Czas próby</div>
                    <div id="konfig-czasy" class="wybor" role="radiogroup" aria-label="Czas próby"></div>
                </div>
                <div id="konfig-opcje" class="grupa">
                    <label class="opcja"><input type="checkbox" id="opt-zew"><span><b>Zew żywiołów</b> — duchy proszą o żywioł, a on daje ×2</span></label>
                    <label class="opcja"><input type="checkbox" id="opt-krag"><span><b>Krąg</b> — kilku tancerzy po kolei</span></label>
                </div>
                <div id="konfig-nick-solo" class="grupa">
                    <label class="etykieta" for="nick-solo">Imię tancerza</label>
                    <div class="nick-wiersz">
                        <input id="nick-solo" type="text" maxlength="16" autocomplete="off" spellcheck="false">
                        <button type="button" id="nick-kosci" aria-label="Wylosuj szamańskie imię" title="Wylosuj szamańskie imię">🎲</button>
                    </div>
                </div>
                <div id="konfig-krag-lista" class="grupa hidden">
                    <div class="etykieta">Tancerze po kolei</div>
                    <div id="krag-nicki"></div>
                    <button type="button" id="krag-dodaj" class="drugi">+ dopisz tancerza</button>
                </div>
                <p id="konfig-info" aria-live="polite"></p>
                <div class="przyciski">
                    <button type="button" id="konfig-wstecz" class="drugi">Wróć</button>
                    <button type="button" id="rozpal-btn">Rozpal ogień</button>
                </div>
            </section>

            <section id="ksiega-ekran" class="menu-ekran hidden">
                <h2>Księga Plemienia</h2>
                <div id="ksiega-zakladki" class="wybor" role="tablist" aria-label="Tablice wyników"></div>
                <ol id="ksiega-lista"></ol>
                <p id="ksiega-info" aria-live="polite"></p>
                <div class="przyciski">
                    <button type="button" id="ksiega-wstecz" class="drugi">Do Polany</button>
                    <button type="button" id="ksiega-eksport" class="drugi">Zapisz do pliku</button>
                    <label class="plik drugi">Wczytaj z pliku<input type="file" id="ksiega-import" accept=".json,application/json"></label>
                </div>
                <details id="ksiega-wiecej">
                    <summary>Więcej…</summary>
                    <button type="button" id="ksiega-wyczysc" class="drugi">Wyczyść Księgę…</button>
                    <button type="button" id="ksiega-wyczysc-tak" class="drugi hidden">Na pewno? To usunie wszystkie wyniki</button>
                </details>
            </section>

            <section id="kronika" class="menu-ekran hidden">
                <div id="kronika-tytul"></div>
                <div id="kronika-wynik"></div>
                <div id="kronika-szaman"></div>
                <div id="kronika-zdanie"></div>
                <div id="kronika-przydomki"></div>
                <div id="kronika-miejsce"></div>
                <div id="kronika-linie"></div>
                <div id="kronika-podium"></div>
                <div id="kronika-podpis"></div>
                <div class="przyciski">
                    <button type="button" id="kronika-jeszcze">Jeszcze raz</button>
                    <button type="button" id="kronika-polana" class="drugi">Do Polany</button>
                </div>
            </section>
        </div>
```

Usuń z `index.html` także tymczasowy baner końca z podprojektu 2 (`<div id="runda-koniec" class="hidden"> … </div>` wewnątrz `#runda-hud`) — zastąpi go Kronika.

- [ ] **Step 2: Style**

W `style.css`, **po** blokiem `.kicker`/`h1`/`@keyframes tytulWejscie` (zostają — Polana ich używa), dopisać (zachowaj `#loading-screen` w istniejącej regule `#start-screen, #loading-screen` — zmień ją na samo `#loading-screen`, a panel menu niżej dziedziczy ten sam wygląd):

```css
/* --- MENU "Polana" (2026-10-01, podprojekt 3) ---
   Jedna warstwa na całym ekranie; ekrany leżą w niej wyśrodkowane (Kronika po prawej,
   żeby nie zasłaniać tancerza i efektów na żywym obrazie). `.hidden` globalnie daje
   tylko opacity:0 - tu dodatkowo display:none, żeby ukryte ekrany nie zajmowały miejsca. */
#menu {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    pointer-events: none;
    overflow-y: auto;
    padding: 1.5rem 1rem;
}
#menu.hidden, .menu-ekran.hidden { display: none; }

.menu-ekran {
    pointer-events: auto;
    position: relative;
    overflow: hidden;
    text-align: center;
    width: min(46rem, 100%);
    padding: 2.6rem 2.4rem 2.2rem;
    background: var(--mrok);
    border-radius: 12px;
    border: 1px solid rgba(217, 164, 65, 0.35);
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.55), inset 0 0 30px rgba(255, 122, 26, 0.06);
    backdrop-filter: blur(10px);
}
.menu-ekran > *:not(.krag-run) { position: relative; z-index: 2; }

/* Łuna ogniska u dołu panelu Polany - gradient, nie cząstki (GEMINI.md §7.3). */
#polana::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: -25%;
    height: 70%;
    background: radial-gradient(ellipse at 50% 100%, rgba(255, 122, 26, 0.38), transparent 72%);
    pointer-events: none;
    z-index: 0;
}
.podtytul { color: var(--kosc); opacity: 0.85; margin-bottom: 1.6rem; }
.menu-ekran h2 {
    font-family: 'Bona Nova SC', serif;
    font-size: 2rem;
    letter-spacing: 0.04em;
    color: var(--plomien);
    margin-bottom: 1.2rem;
}

/* Kamienie trybów: nieregularne, ciężkie, z wyrytą runą, która rozżarza się przy najechaniu. */
#kamienie {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 0.4rem;
}
.kamien {
    --zar-kamienia: 0;
    position: relative;
    display: grid;
    gap: 0.25rem;
    justify-items: center;
    padding: 1.1rem 0.8rem 1rem;
    font: inherit;
    color: var(--kosc);
    cursor: pointer;
    background:
        radial-gradient(ellipse at 50% 120%, rgba(255, 122, 26, calc(0.10 + var(--zar-kamienia) * 0.35)), transparent 70%),
        linear-gradient(160deg, #2a2118 0%, #17110b 55%, #231a12 100%);
    border: 1px solid rgba(217, 164, 65, 0.28);
    border-radius: 46% 54% 50% 50% / 38% 40% 60% 62%;
    box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.05), inset 0 -8px 18px rgba(0, 0, 0, 0.5), 0 6px 18px rgba(0, 0, 0, 0.45);
    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, --zar-kamienia 0.25s ease;
}
.kamien:nth-child(2) { border-radius: 52% 48% 44% 56% / 44% 36% 64% 56%; }
.kamien:nth-child(3) { border-radius: 48% 52% 56% 44% / 40% 46% 54% 60%; }
.kamien:nth-child(4) { border-radius: 54% 46% 48% 52% / 36% 44% 56% 64%; }
.kamien-runa {
    font-family: 'Noto Sans Runic', serif;
    font-size: 2.6rem;
    line-height: 1;
    color: rgba(217, 164, 65, 0.55);
    text-shadow: 0 0 0 rgba(255, 122, 26, 0);
    transition: color 0.25s ease, text-shadow 0.25s ease;
}
.kamien-nazwa { font-family: 'Bona Nova SC', serif; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.04em; }
.kamien-opis { font-size: 0.85rem; opacity: 0.7; }
.kamien:hover:not(:disabled), .kamien:focus-visible {
    --zar-kamienia: 1;
    transform: translateY(-3px) scale(1.02);
    border-color: var(--zar);
    box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.06), inset 0 -8px 18px rgba(0, 0, 0, 0.45), 0 8px 26px rgba(255, 122, 26, 0.28);
    outline: none;
}
.kamien:hover:not(:disabled) .kamien-runa, .kamien:focus-visible .kamien-runa {
    color: var(--plomien);
    text-shadow: 0 0 14px rgba(255, 179, 71, 0.9), 0 0 30px rgba(255, 122, 26, 0.6);
}
.kamien:disabled { cursor: not-allowed; opacity: 0.4; filter: grayscale(0.6); }
#polana-podpowiedz { min-height: 1.4em; margin-top: 1rem; font-size: 0.95rem; color: var(--plomien); }

/* Formularze: konfiguracja i Księga. */
.grupa { margin: 1.1rem 0; text-align: left; }
.etykieta { display: block; font-size: 0.8rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--zloto); margin-bottom: 0.45rem; }
.wybor { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.wybor button {
    font: inherit; color: var(--kosc); cursor: pointer;
    padding: 0.5rem 0.95rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(217, 164, 65, 0.3);
    border-radius: 999px;
}
.wybor button[aria-pressed="true"], .wybor button[aria-selected="true"] {
    background: rgba(255, 122, 26, 0.22);
    border-color: var(--zar);
    color: var(--plomien);
}
.opcja { display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.4rem 0; cursor: pointer; }
.opcja input { margin-top: 0.3rem; accent-color: var(--zar); }
.nick-wiersz, .krag-wiersz { display: flex; gap: 0.5rem; margin-bottom: 0.45rem; }
.menu-ekran input[type="text"] {
    flex: 1; min-width: 0;
    font: inherit; color: var(--kosc);
    padding: 0.6rem 0.8rem;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(217, 164, 65, 0.35);
    border-radius: 8px;
}
.menu-ekran input[type="text"]:focus-visible { outline: 2px solid var(--zar); outline-offset: 1px; }
#nick-kosci, .krag-usun {
    font-size: 1.3rem; cursor: pointer; padding: 0 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(217, 164, 65, 0.3);
    border-radius: 8px; color: var(--kosc);
}
#konfig-info, #ksiega-info { min-height: 1.4em; font-size: 0.95rem; color: var(--plomien); margin: 0.6rem 0; }
.przyciski { display: flex; flex-wrap: wrap; gap: 0.7rem; justify-content: center; margin-top: 1.2rem; }
/* Przycisk główny: tylko w .przyciski (klasy, bez id - inaczej przebija style pigułek i drugorzędnych). */
.przyciski button:not(.drugi), .przyciski .plik:not(.drugi) {
    font: inherit; font-weight: 700; cursor: pointer;
    padding: 0.7rem 1.5rem; border-radius: 8px;
    color: #1a0f06;
    background: linear-gradient(180deg, var(--plomien), var(--zar));
    border: 1px solid rgba(255, 220, 160, 0.5);
    box-shadow: 0 0 22px rgba(255, 122, 26, 0.35);
}
/* Przycisk drugorzędny (po głównym w pliku - przy równej specyficzności wygrywa). */
.menu-ekran button.drugi, .menu-ekran .plik.drugi {
    font: inherit; cursor: pointer;
    padding: 0.7rem 1.5rem; border-radius: 8px;
    color: var(--kosc); background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(217, 164, 65, 0.35); box-shadow: none; font-weight: 400;
}
.menu-ekran button:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.menu-ekran button:focus-visible, .plik:focus-within { outline: 2px solid var(--kosc); outline-offset: 2px; }
.plik { position: relative; display: inline-block; }
.plik input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

/* Księga: kora brzozowa - jasne paski na ciemnym tle, wpisy jak wyryte. */
#ksiega-ekran {
    background:
        repeating-linear-gradient(92deg, rgba(239, 227, 200, 0.05) 0 2px, transparent 2px 9px),
        var(--mrok);
}
#ksiega-zakladki { margin-bottom: 1rem; justify-content: center; }
#ksiega-lista { list-style: none; margin: 0; padding: 0; text-align: left; counter-reset: miejsce; min-height: 4rem; }
#ksiega-lista li {
    counter-increment: miejsce;
    display: grid; grid-template-columns: 2.4rem 1fr auto; gap: 0.6rem; align-items: baseline;
    padding: 0.4rem 0.2rem; border-bottom: 1px dashed rgba(217, 164, 65, 0.22);
}
#ksiega-lista li::before { content: counter(miejsce) "."; font-family: 'Bona Nova SC', serif; color: var(--zloto); }
#ksiega-lista li.swiezy { animation: zarWpisu 2.4s ease-out 1; background: rgba(255, 122, 26, 0.12); }
.wpis-wynik { font-variant-numeric: tabular-nums; color: var(--plomien); font-weight: 700; }
#ksiega-wiecej { margin-top: 1rem; text-align: left; font-size: 0.9rem; opacity: 0.85; }
#ksiega-wiecej summary { cursor: pointer; margin-bottom: 0.5rem; }
@keyframes zarWpisu { 0% { box-shadow: 0 0 22px rgba(255, 179, 71, 0.8); } 100% { box-shadow: none; } }

/* Kronika: po prawej stronie, półprzezroczysta - tancerz i efekty zostają widoczne. */
#kronika {
    justify-self: end;
    width: min(26rem, 100%);
    margin-right: 2rem;
    background: rgba(8, 4, 2, 0.58);
    padding: 1.6rem 1.8rem;
}
#kronika-tytul { font-size: 1.1rem; color: var(--zloto); letter-spacing: 0.06em; }
#kronika-wynik { font-family: 'Bona Nova SC', serif; font-size: 4.2rem; font-weight: 700; color: var(--plomien); line-height: 1.1; text-shadow: 0 0 24px rgba(255, 122, 26, 0.5); }
#kronika-szaman { font-family: 'Bona Nova SC', serif; font-size: 1.6rem; }
#kronika-zdanie { font-size: 0.95rem; opacity: 0.8; margin-bottom: 0.7rem; font-style: italic; }
#kronika-przydomki { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; margin-bottom: 0.7rem; }
.przydomek { padding: 0.2rem 0.7rem; font-size: 0.85rem; border: 1px solid var(--zloto); border-radius: 999px; color: var(--zloto); }
#kronika-miejsce { min-height: 1.4em; margin-bottom: 0.6rem; color: var(--plomien); font-weight: 700; }
#kronika-miejsce.rekord { color: #ffd36a; text-shadow: 0 0 16px rgba(255, 200, 80, 0.9); letter-spacing: 0.05em; }
#kronika-linie, #kronika-podium { font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.7rem; }
#kronika-podpis { font-size: 0.85rem; opacity: 0.75; }

/* Menu na żywym obrazie z kamery: przyciemniamy płótno i chowamy HUD gry. */
body.w-menu #output-canvas { filter: brightness(0.42) saturate(0.85); transition: filter 0.4s ease; }
body.w-menu #instruction-hud, body.w-menu #energy-hud, body.w-menu #sekwencja-run,
body.w-menu #wynik-hud, body.w-menu #runda-hud { opacity: 0 !important; }

@media (max-width: 40rem) {
    #kamienie { grid-template-columns: 1fr; }
    h1 { font-size: 2.6rem; }
    #kronika { justify-self: center; margin-right: 0; }
}
```

i WEWNĄTRZ istniejącego `@media (prefers-reduced-motion: reduce) { ... }` dopisać:

```css
    .kamien, .kamien-runa, body.w-menu #output-canvas { transition: none; }
    .kamien:hover:not(:disabled), .kamien:focus-visible { transform: none; }
    #ksiega-lista li.swiezy { animation: none; }
```

Stare reguły `#start-screen` (`#start-screen, #loading-screen`, `#start-screen::after`, `#start-screen > p, #start-btn`, `#start-btn …`) przepisz tak, by obejmowały tylko `#loading-screen` albo — jeśli niczego już nie stylują — usuń; `.krag-run`, `.kicker`, `h1`, `.highlight` zostają.

- [ ] **Step 3: Warstwa DOM**

`js/polanaUi.js`:

```js
/**
 * Polana - warstwa DOM menu. Renderuje stan modelu Menu (js/menu.js) i przekazuje
 * akcje użytkownika; LOGIKI tu nie ma (walidacja, przejścia - w modelu).
 *
 * Tekst gracza (nick!) wyłącznie przez textContent - nigdy innerHTML. Wartości
 * pól formularzy czytamy przez .value, a nie wstawiamy do DOM jako HTML.
 */
import { formatCzasu } from './rundaHud.js';
import { nazwaTablicy } from './ksiega.js';
import { PROBA_DLUGOSCI } from './tryby.js';

const EKRAN_ID = { polana: 'polana', konfig: 'konfig', ksiega: 'ksiega-ekran', kronika: 'kronika' };
const TYTULY = { obrzed: 'Obrzęd — taniec do pieśni', proba: 'Próba — taniec na czas', swobodny: 'Swobodny taniec' };

/** Przycisk-pigułka (textContent). */
function pigulka(doc, tekst, wcisniety, atrybut = 'aria-pressed') {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = tekst;
    b.setAttribute(atrybut, String(!!wcisniety));
    return b;
}

export class PolanaUi {
    /**
     * @param {Document} doc
     * @param {{menu, ksiega, losoweImie:()=>string, onStart:(konfig)=>void, onJeszczeRaz:()=>void, onDoPolany:()=>void}} deps
     */
    constructor(doc, { menu, ksiega, losoweImie, onStart, onJeszczeRaz, onDoPolany }) {
        this.doc = doc;
        this.menu = menu;
        this.ksiega = ksiega;
        this.losoweImie = losoweImie;
        this.onStart = onStart;
        this.onJeszczeRaz = onJeszczeRaz;
        this.onDoPolany = onDoPolany;
        this.zakladka = null;           // aktywny klucz tablicy w Księdze
        this.swiezy = null;             // {klucz, nick, wynik} - świeży wpis do podświetlenia
        this.potwierdzaWyczysc = false;
        this.infoKsiegi = '';
        const $ = (id) => doc.getElementById(id);
        this.$ = $;
        this.root = $('menu');
        if (!this.root) return;         // strona bez menu (np. test) - cicho nic nie robi
        this._podepnij();
    }

    _podepnij() {
        const { $, menu } = this;
        const odswiez = () => this.render();

        for (const k of this.doc.querySelectorAll('.kamien')) {
            k.addEventListener('click', () => { menu.wybierz(k.dataset.kamien); this._poWyborzeKamienia(); odswiez(); });
        }
        $('opt-zew').addEventListener('change', (e) => { menu.ustaw('zew', e.target.checked); odswiez(); });
        $('opt-krag').addEventListener('change', (e) => { menu.ustaw('krag', e.target.checked); odswiez(); });
        $('nick-solo').addEventListener('input', (e) => { menu.ustaw('nick', e.target.value); this._odswiezPrzyciskStartu(); });
        $('nick-solo').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._start(); });
        $('nick-kosci').addEventListener('click', () => { menu.ustaw('nick', this.losoweImie()); odswiez(); });
        $('krag-dodaj').addEventListener('click', () => { menu.dodajGracza(); odswiez(); });
        $('konfig-wstecz').addEventListener('click', () => { menu.wstecz(); odswiez(); });
        $('rozpal-btn').addEventListener('click', () => this._start());
        $('ksiega-wstecz').addEventListener('click', () => { this.potwierdzaWyczysc = false; menu.wstecz(); odswiez(); });
        $('ksiega-eksport').addEventListener('click', () => this._eksport());
        $('ksiega-import').addEventListener('change', (e) => this._import(e.target));
        $('ksiega-wyczysc').addEventListener('click', () => { this.potwierdzaWyczysc = true; odswiez(); });
        $('ksiega-wyczysc-tak').addEventListener('click', () => {
            this.ksiega.wyczysc(); this.potwierdzaWyczysc = false; this.swiezy = null;
            this.infoKsiegi = 'Księga jest czysta — zaczynacie od nowa.'; odswiez();
        });
        $('kronika-jeszcze').addEventListener('click', () => this.onJeszczeRaz());
        $('kronika-polana').addEventListener('click', () => this.onDoPolany());

        // Klawiatura: strzałki chodzą po kamieniach, Esc cofa o krok (Polana i Kronika/gra - w main.js).
        this.doc.addEventListener('keydown', (e) => {
            if (this.root.classList.contains('hidden')) return;
            if (e.key === 'Escape' && (menu.ekran === 'konfig' || menu.ekran === 'ksiega')) {
                this.potwierdzaWyczysc = false;
                menu.wstecz(); odswiez();
            } else if (menu.ekran === 'polana' && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
                this._ruchPoKamieniach(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
                e.preventDefault();
            }
        });
    }

    _ruchPoKamieniach(krok) {
        const k = [...this.doc.querySelectorAll('.kamien')].filter(x => !x.disabled);
        if (!k.length) return;
        const i = k.indexOf(this.doc.activeElement);
        k[(i + krok + k.length) % k.length].focus();
    }

    _poWyborzeKamienia() {
        if (this.menu.ekran === 'ksiega') {
            this.zakladka = this.ksiega.klucze()[0] ?? null;
            this.potwierdzaWyczysc = false;
            this.infoKsiegi = '';
        }
    }

    _start() {
        const konf = this.menu.konfiguracja();
        if (konf && !this.menu.zajety) this.onStart(konf);
    }

    _odswiezPrzyciskStartu() {
        const btn = this.$('rozpal-btn');
        const bledy = this.menu.bledy();
        btn.disabled = bledy.length > 0 || this.menu.zajety;
        this.$('konfig-info').textContent = this.menu.zajety ? 'Duchy się budzą — kamera i model ruchu…' : (bledy[0] ?? '');
    }

    _eksport() {
        const blob = new Blob([this.ksiega.eksportuj()], { type: 'application/json' });
        const a = this.doc.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ksiega-plemienia.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    _import(input) {
        const plik = input.files?.[0];
        input.value = '';
        if (!plik) return;
        const r = new FileReader();
        r.onload = () => {
            const wynik = this.ksiega.importuj(String(r.result));
            if (wynik.ok) {
                this.infoKsiegi = wynik.dodano > 0 ? `Dopisano ${wynik.dodano} wpisów do Księgi.` : 'Te wyniki już są w Księdze.';
                this.zakladka = this.ksiega.klucze()[0] ?? null;
            } else {
                this.infoKsiegi = wynik.powod === 'rozmiar'
                    ? 'Ten plik jest za duży na Księgę — spróbuj mniejszego.'
                    : 'Ten plik nie wygląda jak Księga Plemienia.';
            }
            this.render();
        };
        r.onerror = () => { this.infoKsiegi = 'Nie udało się odczytać pliku.'; this.render(); };
        r.readAsText(plik);
    }

    /** Wpis do podświetlenia po powrocie z Kroniki do Księgi. */
    pokazSwiezy(klucz, nick, wynik) { this.swiezy = { klucz, nick, wynik }; }

    render() {
        if (!this.root) return;
        const { menu, doc } = this;
        const widoczne = menu.ekran in EKRAN_ID;
        this.root.classList.toggle('hidden', !widoczne);
        for (const [ekran, id] of Object.entries(EKRAN_ID)) doc.getElementById(id).classList.toggle('hidden', menu.ekran !== ekran);
        doc.body.classList.toggle('w-menu', menu.ekran === 'polana' || menu.ekran === 'konfig' || menu.ekran === 'ksiega');
        if (menu.ekran === 'polana') this._renderPolana();
        else if (menu.ekran === 'konfig') this._renderKonfig();
        else if (menu.ekran === 'ksiega') this._renderKsiega();
        else if (menu.ekran === 'kronika') this._renderKronika();
    }

    _renderPolana() {
        const { menu } = this;
        for (const k of this.doc.querySelectorAll('.kamien')) k.disabled = !menu.dostepne(k.dataset.kamien) || menu.zajety;
        this.$('polana-podpowiedz').textContent = menu.podpowiedz('obrzed');
    }

    _renderKonfig() {
        const { menu, doc, $ } = this;
        $('konfig-tytul').textContent = TYTULY[menu.tryb] ?? '';
        const obrzed = menu.tryb === 'obrzed', proba = menu.tryb === 'proba', swobodny = menu.tryb === 'swobodny';
        $('konfig-piesn').classList.toggle('hidden', !obrzed);
        $('konfig-czas').classList.toggle('hidden', !proba);
        $('konfig-opcje').classList.toggle('hidden', swobodny);
        $('konfig-nick-solo').classList.toggle('hidden', swobodny || menu.krag);
        $('konfig-krag-lista').classList.toggle('hidden', swobodny || !menu.krag);
        $('opt-zew').checked = menu.zew;
        $('opt-krag').checked = menu.krag;
        if (doc.activeElement !== $('nick-solo')) $('nick-solo').value = menu.nick;

        const piesni = $('konfig-piesni'); piesni.replaceChildren();
        menu.piesni.forEach((p, i) => {
            const b = pigulka(doc, p.dlugoscS > 0 ? `${p.tytul} · ${formatCzasu(p.dlugoscS)}` : p.tytul, i === menu.piesn);
            b.addEventListener('click', () => { menu.ustaw('piesn', i); this.render(); });
            piesni.appendChild(b);
        });
        const czasy = $('konfig-czasy'); czasy.replaceChildren();
        for (const c of PROBA_DLUGOSCI) {
            const b = pigulka(doc, `${c} s`, c === menu.czas);
            b.addEventListener('click', () => { menu.ustaw('czas', c); this.render(); });
            czasy.appendChild(b);
        }
        const lista = $('krag-nicki'); lista.replaceChildren();
        menu.nicki.forEach((n, i) => {
            const w = doc.createElement('div'); w.className = 'krag-wiersz';
            const inp = doc.createElement('input');
            inp.type = 'text'; inp.maxLength = 16; inp.value = n; inp.autocomplete = 'off';
            inp.setAttribute('aria-label', `Tancerz ${i + 1}`);
            inp.addEventListener('input', () => { menu.ustawNick(i, inp.value); this._odswiezPrzyciskStartu(); });
            const kosci = doc.createElement('button'); kosci.type = 'button'; kosci.className = 'krag-usun'; kosci.textContent = '🎲';
            kosci.setAttribute('aria-label', `Wylosuj imię dla tancerza ${i + 1}`);
            kosci.addEventListener('click', () => { menu.ustawNick(i, this.losoweImie()); this.render(); });
            w.append(inp, kosci);
            if (menu.nicki.length > 2) {
                const x = doc.createElement('button'); x.type = 'button'; x.className = 'krag-usun'; x.textContent = '×';
                x.setAttribute('aria-label', `Usuń tancerza ${i + 1}`);
                x.addEventListener('click', () => { menu.usunGracza(i); this.render(); });
                w.append(x);
            }
            lista.appendChild(w);
        });
        $('krag-dodaj').disabled = menu.nicki.length >= 6;
        this._odswiezPrzyciskStartu();
    }

    _renderKsiega() {
        const { doc, $, ksiega, menu } = this;
        const klucze = ksiega.klucze();
        if (!klucze.includes(this.zakladka)) this.zakladka = klucze[0] ?? null;
        const zak = $('ksiega-zakladki'); zak.replaceChildren();
        for (const k of klucze) {
            const b = pigulka(doc, nazwaTablicy(k, menu.piesni), k === this.zakladka, 'aria-selected');
            b.setAttribute('role', 'tab');
            b.addEventListener('click', () => { this.zakladka = k; this.render(); });
            zak.appendChild(b);
        }
        const lista = $('ksiega-lista'); lista.replaceChildren();
        for (const w of this.zakladka ? ksiega.tablica(this.zakladka) : []) {
            const li = doc.createElement('li');
            const nick = doc.createElement('span'); nick.textContent = w.nick;
            const wynik = doc.createElement('span'); wynik.className = 'wpis-wynik'; wynik.textContent = String(w.wynik);
            li.append(nick, wynik);
            if (this.swiezy && this.swiezy.klucz === this.zakladka && this.swiezy.nick === w.nick && this.swiezy.wynik === w.wynik) li.classList.add('swiezy');
            lista.appendChild(li);
        }
        let info = this.infoKsiegi;
        if (!info && !klucze.length) info = 'Księga czeka na pierwszy wpis — zatańcz obrzęd.';
        if (!info && !ksiega.trwala) info = 'Ta przeglądarka nie pozwala zapisać Księgi — wyniki przetrwają do zamknięcia karty.';
        $('ksiega-info').textContent = info;
        $('ksiega-wyczysc').classList.toggle('hidden', this.potwierdzaWyczysc);
        $('ksiega-wyczysc-tak').classList.toggle('hidden', !this.potwierdzaWyczysc);
    }

    _renderKronika() {
        const { doc, $ } = this;
        const k = this.menu.kronika;
        if (!k) return;
        $('kronika-tytul').textContent = k.tytul;
        $('kronika-wynik').textContent = k.wynik;
        $('kronika-szaman').textContent = k.szaman.tytul;
        $('kronika-zdanie').textContent = k.szaman.zdanie;
        const prz = $('kronika-przydomki'); prz.replaceChildren();
        for (const p of k.przydomki) { const s = doc.createElement('span'); s.className = 'przydomek'; s.textContent = p; prz.appendChild(s); }
        const mi = $('kronika-miejsce'); mi.textContent = k.miejsce; mi.classList.toggle('rekord', /rekord/i.test(k.miejsce));
        const linie = $('kronika-linie'); linie.replaceChildren();
        for (const l of k.linie) { const d = doc.createElement('div'); d.textContent = l; linie.appendChild(d); }
        const pod = $('kronika-podium'); pod.replaceChildren();
        if (k.podium) {
            const h = doc.createElement('div'); h.className = 'etykieta'; h.textContent = 'Podium Kręgu'; pod.appendChild(h);
            for (const w of k.podium) { const d = doc.createElement('div'); d.textContent = `${w.miejsce}. ${w.nick} — ${w.wynik}`; pod.appendChild(d); }
        }
        $('kronika-podpis').textContent = k.podpis;
    }
}
```

- [ ] **Step 4: Zrzuty ekranu (weryfikacja wizualna bez kamery i bez dźwięku)**

Menu pojawia się przed zgodą na kamerę i nie odtwarza muzyki. Użyj headless Chrome z `--screenshot` na adresach BEZ `?tryb=` i **nie klikaj „Rozpal ogień"**. Serwer statyczny w tle: `python3 -m http.server 8777` w katalogu repo (zabij po skończeniu).

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --user-data-dir=/tmp/claude-chrome-shot --window-size=1280,800 --hide-scrollbars \
  --screenshot=/tmp/claude-polana.png http://localhost:8777/
```

Obejrzyj PNG (`Read`). Polana powinna pokazać tytuł, cztery kamienie z runami i łunę ogniska. Pozostałe ekrany (konfiguracja, Księga, Kronika) sprawdź stroną-opakowaniem w scratchpadzie z `iframe` na `/` (ten sam origin) i skryptem klikającym kamienie / wywołującym `menu` — albo tymczasową stroną, która ładuje `polanaUi.js` z przykładowymi danymi i ustawia ekran. **Zabij wszystkie procesy Chrome po zrzutach** (`pkill -f claude-chrome-shot`).

Sprawdź: fokus klawiaturą jest widoczny, kamień „Obrzęd" przygaszony gdy manifest pusty, długie nicki nie wychodzą z panelu, układ na 1280×800 i 390×800 (zmień `--window-size`). Oceń wygląd krytycznie względem sekcji „Wizualia" specu i popraw (iterując z skillem `frontend-design`), zanim przejdziesz dalej.

- [ ] **Step 5: Run tests and commit**

Run: `node --check js/polanaUi.js && sh tools/test-wszystko.sh 2>&1 | grep -E "^test-.*✗$"`
Expected: jedyny `✗` to `test-rozdzielnosc.mjs`.

```bash
git add index.html style.css js/polanaUi.js
git commit -m "Polana: ekrany menu (kamienie trybow, konfiguracja, Ksiega, Kronika) - warstwa DOM i styl"
```

---

### Task 6: Wpięcie w `main.js` i usunięcie tymczasowego banera

**Files:**
- Modify: `js/main.js`, `js/przebieg.js` (`decyzjaKlawisza`), `js/rundaHud.js` (usunąć baner końca), `tools/test-przebieg.mjs`, `tools/test-runda-hud.mjs`
- Test: `tools/test-przebieg.mjs` (strażnik wpięcia, `decyzjaKlawisza`), `tools/test-runda-hud.mjs`

**Interfaces:**
- Consumes: wszystko z Task 1–5; `uruchomZKonfiguracji(konfig)` z podprojektu 2.
- Produces: gra sterowana menu; `?tryb=` wypełnia konfigurację (skrót dewelopera); Esc/Enter wg spec; `decyzjaKlawisza(key, {stan, sesjaAktywna, ekran}) → 'polana'|'dalej'|null`.

- [ ] **Step 1: Write the failing tests**

W `tools/test-przebieg.mjs` **zastąp** blok `DECYZJA KLAWISZA …` (z podprojektu 2) tym:

```js
console.log('\nDECYZJA KLAWISZA (Esc -> Polana; Enter tylko na Kronice; Esc nie ściga się z debugHud):');
{
    const d = (key, kontekst) => decyzjaKlawisza(key, { stan: null, sesjaAktywna: false, ekran: 'polana', ...kontekst });
    spr('na Polanie/konfiguracji/Księdze main nic nie robi (klawiszami menu rządzi polanaUi)', ['polana', 'konfig', 'ksiega'].every(e => d('Escape', { ekran: e }) === null && d('Enter', { ekran: e }) === null));
    spr('Esc w RUNDZIE -> polana', d('Escape', { stan: 'RUNDA', ekran: 'gra' }) === 'polana');
    spr('Esc w PODSUMOWANIU (Kronika) -> polana', d('Escape', { stan: 'PODSUMOWANIE', ekran: 'kronika' }) === 'polana');
    spr('Esc w swobodnym tańcu (gra bez przebiegu) -> polana', d('Escape', { stan: null, ekran: 'gra' }) === 'polana');
    spr('Esc przy aktywnej sesji nagraniowej debugHud NIE rusza gry', d('Escape', { stan: 'RUNDA', ekran: 'gra', sesjaAktywna: true }) === null && d('Escape', { stan: null, ekran: 'gra', sesjaAktywna: true }) === null);
    spr('Enter w PODSUMOWANIU -> dalej', d('Enter', { stan: 'PODSUMOWANIE', ekran: 'kronika' }) === 'dalej');
    spr('Enter w RUNDZIE i w swobodnym nic nie robi (REVIEW FOCUS 5)', d('Enter', { stan: 'RUNDA', ekran: 'gra' }) === null && d('Enter', { stan: null, ekran: 'gra' }) === null);
    spr('inne klawisze nic nie robią', ['m', 'M', 'd', ' ', 'z', '1'].every(k => d(k, { stan: 'RUNDA', ekran: 'gra' }) === null));
}
```

i **zastąp** w liście `MUSI` (blok `STRAŻNIK WPIĘCIA W main.js`) dwa wpisy o Esc/Enter oraz dopisz nowe:

```js
        ["decyzja === 'polana'", 'Esc prowadzi na Polanę (bez zapisu)'],
        ['przebieg.dalej(', 'Enter na Kronice startuje następną rundę'],
        ['new Menu(', 'model menu'],
        ['new PolanaUi(', 'warstwa DOM menu'],
        ['new Ksiega(', 'Księga Plemienia'],
        ['menu.zUrl(', 'skrót ?tryb= wypełnia konfigurację menu'],
        ['kluczKsiegi(', 'zapis wyniku do tablicy właściwej dla trybu'],
        ['ksiega.dodaj(', 'wynik rundy trafia do Księgi'],
        ['zbudujKronike(', 'Kronika po rundzie'],
        ['odpalJajo(', 'jajo z nickiem-bogiem'],
        ['bogZNicku(', 'rozpoznanie nicku-boga'],
        ['menu.zajety = true', 'menu blokuje przycisk podczas ładowania kamery (REVIEW FOCUS 3)'],
        ['onStart: (konf) => rozpalOgien(konf)', 'start rundy z konfiguracji menu (PolanaUi.onStart -> rozpalOgien)'],
```

oraz dopisz do końcowych `spr(...)` bloku strażnika:

```js
    spr('stary baner końca rundy usunięty z main/HUD (zastąpiony Kroniką)', !main.includes('tekstPodsumowania') && !main.includes('runda-koniec'));
    spr('handler startu rozbity: uruchomGre() raz + start z menu', main.includes('async function uruchomGre(') && main.includes('async function rozpalOgien('));
    spr('stary przycisk start-btn usunięty', !main.includes("getElementById('start-btn')"));
    spr('uruchomGre ma strażnika przed podwójnym startem kamery', /async function uruchomGre\(\) \{\s*if \(isRunning\) return true;\s*if \(startowano\) return false;\s*startowano = true;/.test(main));
```

**Zastąp też trzy asercje z podprojektu 2, które sprawdzały stary przycisk startu** (blok `STRAŻNIK: przycisk startu i kolejność klawiatury w main.js`): usuń `handler startu ma strażnika przed podwójnym uruchomieniem` i `przycisk startu wyłączany po starcie…` (przycisk `#start-btn` już nie istnieje; strażnika pilnuje nowa asercja `uruchomGre …` wyżej oraz `menu.zajety = true`). Asercja `błąd kamery zwalnia strażnika` zostaje bez zmian (`startowano = false;` stoi teraz w `uruchomGre`).

W `tools/test-runda-hud.mjs` usuń importy i bloki dotyczące `tekstPodsumowania` oraz asercje `koniec` (HUD rundy nie pokazuje już banera końca): z listy importów usuń `tekstPodsumowania`; usuń cały blok `PODSUMOWANIE:`; w bloku `WIDOK RUNDY` zamień asercję `PODSUMOWANIE: baner końca` na:

```js
    spr('PODSUMOWANIE (Kronika w menu): HUD rundy pusty, bez banera', widokRundy(p).czas === '' && !('koniec' in widokRundy(p)));
```

oraz w asercji `brak przebiegu (swobodny)` usuń warunek `bezPrzebiegu.koniec === null`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/test-przebieg.mjs 2>&1 | grep "✗" | head -30; node tools/test-runda-hud.mjs 2>&1 | grep "✗"`
Expected: wiele `✗` w strażniku `main.js` i w `DECYZJA KLAWISZA`; w `test-runda-hud` `✗` na brakującym wycofaniu `koniec`.

- [ ] **Step 3: Implement**

**3a. `js/przebieg.js`** — zastąp `decyzjaKlawisza`:

```js
/**
 * Co robi klawisz poza menu - CZYSTA decyzja (main.js wykonuje wynik). Klawiszami
 * samego menu (Polana/konfiguracja/Księga) rządzi js/polanaUi.js - tu `null`.
 *
 * Esc przy aktywnej sesji nagraniowej debugHud NIE należy do gry: ten Esc przerywa
 * nagrywanie. main.js czyta stan sesji w fazie CAPTURE, PRZED listenerem debugHud
 * (ten zerowałby stan sesji, zanim zdążymy go sprawdzić).
 * Esc w rundzie, na Kronice i w swobodnym tańcu wraca na Polanę.
 * Enter działa tylko na Kronice - w trakcie rundy nic nie robi.
 *
 * @param {string} key
 * @param {{stan:string|null, sesjaAktywna:boolean, ekran:string}} kontekst
 *        stan = przebieg.stan albo null; ekran = menu.ekran ('gra' = poza menu)
 * @returns {'polana'|'dalej'|null}
 */
export function decyzjaKlawisza(key, { stan, sesjaAktywna, ekran }) {
    const wGrze = ekran === 'gra' || ekran === 'kronika';
    if (!wGrze) return null;
    if (key === 'Escape') return sesjaAktywna ? null : 'polana';
    if (key === 'Enter') return stan === 'PODSUMOWANIE' ? 'dalej' : null;
    return null;
}
```

**3b. `js/rundaHud.js`** — usuń baner końca: z importów nic; usuń funkcję `tekstPodsumowania` oraz stałą `ETYKIETY` (jeśli używana tylko przez nią); w `widokRundy` usuń klucz `koniec` z `pusty` i zwracanego obiektu oraz gałąź `if (przebieg.stan === 'PODSUMOWANIE' && przebieg.podsumowanie) { … }` (przy `PODSUMOWANIE` zwracaj `pusty`); w klasie `RundaHud` usuń pola `koniec*` z konstruktora, `w.koniec` z `cokolwiek` i cały blok `this.koniec?.classList… if (w.koniec) { … }`. Usuń `liczba` jeśli nieużywane.

**3c. `js/main.js`:**

*Importy* (obok `import { Przebieg, decyzjaKlawisza } …`):

```js
import { Menu } from './menu.js';
import { PolanaUi } from './polanaUi.js';
import { Ksiega, kluczKsiegi } from './ksiega.js';
import { zbudujKronike } from './kronika.js';
import { bogZNicku } from './jaja.js';
import { losoweImie } from './imiona.js';
```

Istniejący import `odpalPieczec, odpalTechnike, BARWA_ZAPLONU` z `./techniki.js` rozszerz o `odpalJajo`. Usuń `RundaHud`-owe `tekstPodsumowania` z importów, jeśli tam było.

*Stałe DOM:* usuń `const uiStartScreen = document.getElementById('start-screen');` i `const startBtn = document.getElementById('start-btn');`.

*Stan menu* (po bloku `const rundaHud = new RundaHud(…)`):

```js
// MENU "Polana" (2026-10-01, podprojekt 3, spec 2026-10-01-polana-ksiega-design.md).
// Model Menu trzyma ekran i konfigurację, PolanaUi renderuje, main.js spina z grą.
// Księga na localStorage (try/catch w Ksiega - brak pamięci nie jest błędem).
const ksiega = new Ksiega((() => { try { return window.localStorage; } catch { return null; } })());
const menu = new Menu({ ostatniNick: ksiega.ostatniNick() });
let efektKroniki = null;   // {bog, korona} - odpalany w klatce, gdy istnieje `frame`
const polanaUi = new PolanaUi(document, {
    menu, ksiega, losoweImie,
    onStart: (konf) => rozpalOgien(konf),
    onJeszczeRaz: () => dalejZKroniki(),
    onDoPolany: () => doPolany()
});
// Manifest pieśni wczytuje się w tle - Obrzęd odblokowuje się, gdy dotrze.
wczytajManifest().then((lista) => {
    menu.ustawPiesni(lista);
    // Skrót dewelopera: ?tryb=... wypełnia konfigurację (kamera i tak startuje z kliknięcia).
    menu.zUrl(parsujKonfiguracje(window.location.search));
    polanaUi.render();
});
polanaUi.render();
```

*Handler startu* — zastąp cały blok od komentarza `// Strażnik przed podwójnym startem` przez `startBtn.addEventListener('click', async () => { … });` (włącznie z `});`) tym:

```js
// Strażnik przed podwójnym startem kamery: "Rozpal ogień" można kliknąć dwa razy
// podczas ładowania modeli - druga kamera, drugi model, druga pętla klatek.
// Menu dodatkowo blokuje przycisk (menu.zajety), a tu jest ostatnia linia obrony.
let startowano = false;

/** Kamera + modele + pętla klatek - RAZ na życie strony. @returns {Promise<boolean>} czy gra działa */
async function uruchomGre() {
    if (isRunning) return true;
    if (startowano) return false;
    startowano = true;
    uiLoadingScreen.classList.remove('hidden');
    try {
        // 2. Inicjalizacja kamery (WebRTC)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        video.srcObject = stream;
        // Czekamy na załadowanie metadanych, żeby znać oryginalne wymiary wideo
        await new Promise(resolve => { video.onloadedmetadata = () => resolve(); });
        video.play();
        // 3. Inicjalizacja AI (MediaPipe) + font run (js/glify.js: 3 s limit, NIGDY nie odrzuca).
        await Promise.all([poseTracker.initialize(), handTracker.initialize(), zaladujFont()]);
        // 3a. Assety Kołowrotu - CELOWO NIE await (brak assetu nigdy nie jest błędem, §2).
        zaladujAssety().catch(() => {});
        // 4. Aura tancerza
        aura = new Aura(canvas, ctx);
        uiLoadingScreen.classList.add('hidden');
        uiInstructionHud.classList.remove('hidden');
        uiEnergyHud.classList.remove('hidden');
        uiSekwencjaRun.classList.remove('hidden');
        document.getElementById('wynik-hud').classList.remove('hidden');
        uiAudioWskaznik.classList.remove('hidden');
        odswiezWskaznikAudio();
        isRunning = true;
        requestAnimationFrame(renderLoop);
        return true;
    } catch (e) {
        startowano = false;           // błąd kamery/modelu: wolno spróbować ponownie
        alert("Błąd dostępu do kamery lub inicjalizacji AI: " + e.message);
        console.error(e);
        uiLoadingScreen.classList.add('hidden');
        return false;
    }
}

/** "Rozpal ogień" z menu - to jedyny gest użytkownika, więc audio startuje TU, przed jakimkolwiek await. */
async function rozpalOgien(konfig) {
    if (menu.zajety) return;
    audioEngine.init();
    audioEngine.resume();
    menu.zajety = true; polanaUi.render();
    const dziala = await uruchomGre();
    menu.zajety = false;
    if (!dziala) { polanaUi.render(); return; }
    menu.naGre(); polanaUi.render();
    // Obrzęd: długość z metadanych i pieśń; swobodny: nic (przebieg === null, punkty wyłączone).
    uruchomZKonfiguracji({ ...konfig }).catch((e) => console.error('Tryb:', e));
}
```

*Powrót do Polany i Kronika* (obok `zakonczPrzebieg`, które zostaje bez zmian):

```js
/** Esc w grze / "Do Polany" z Kroniki: bez zapisu, czysty start, menu na żywym obrazie. */
function doPolany() {
    zakonczPrzebieg();      // pieśń stop, moduły i punkty czyste
    efektKroniki = null;
    menu.doPolany();
    polanaUi.render();
}

/** Enter / "Jeszcze raz" na Kronice: następny gracz Kręgu albo ta sama runda od nowa. */
function dalejZKroniki() {
    if (!przebieg || !przebieg.dalej(performance.now())) return;
    resetujModuly();
    punkty.reset();
    przygotujPiesn();
    efektKroniki = null;
    menu.naGre();
    polanaUi.render();
}

/** Koniec rundy: zapis do Księgi, Kronika, jaja. Wołane raz, z obsluzZdarzeniaRundy('koniecRundy'). */
function pokazKronike(pods) {
    const klucz = kluczKsiegi(przebieg.konfig, utworRundy);
    const nick = pods.nick ?? menu.nick.trim();
    const wk = klucz && nick ? ksiega.dodaj(klucz, nick, pods.wynik, Date.now()) : null;
    if (!pods.nick && nick) ksiega.zapamietajNick(nick);
    if (wk?.wpisano) polanaUi.pokazSwiezy(klucz, nick.slice(0, 16), Math.floor(pods.wynik));
    menu.naKronike(zbudujKronike(pods, { wynikKsiegi: wk }));
    polanaUi.render();
    efektKroniki = { bog: bogZNicku(nick), korona: !!wk?.nowyRekord };
}
```

*`obsluzZdarzeniaRundy`* — w gałęzi `koniecRundy` zastąp wywołanie samego `przebieg.zapiszWynik(...)`:

```js
            const pods = przebieg.zapiszWynik(punkty.wynik, { ...punkty.rozbicie }, JSON.parse(JSON.stringify(punkty.momenty)));
            if (pods) pokazKronike(pods);
```

*Klawiatura* — w handlerze `keydown` (faza capture) zmień wywołanie i obsługę:

```js
window.addEventListener('keydown', (e) => {
    const decyzja = decyzjaKlawisza(e.key, {
        stan: przebieg?.stan ?? null, sesjaAktywna: debugHud.sesja.aktywna, ekran: menu.ekran
    });
    if (!decyzja) return;
    e.preventDefault();
    if (decyzja === 'polana') doPolany();
    else dalejZKroniki();
}, true);
```

*Jaja i koronacja w klatce* — w bloku `if (skl.zlozona) {` (6a; tam istnieje `frame`) **przed** nim wstaw:

```js
    // Jajo z nickiem-bogiem i koronacja za nowy rekord (Kronika): odpalane tu, bo dopiero
    // w tym miejscu klatki istnieje `frame` (zaczep efektów). Koronacja ostatnia - złoto wygrywa z zapłonem jaja.
    if (efektKroniki) {
        const e = efektKroniki; efektKroniki = null;
        odpalJajo(e.bog, frame, canvas.width, canvas.height, { piorun, ekran, zaplon, fala, tecza, iskry, efekty, audio: audioEngine });
        if (e.korona) { zaplon.zapal([255, 200, 80], 1.0); ekran.uderz(0.6); }
    }
```

*Usuń* w `uruchomZKonfiguracji` nic — bez zmian. Usuń zbędne odwołania do `startBtn`/`uiStartScreen` (grep: `startBtn`, `uiStartScreen`, `start-screen` muszą zniknąć z `main.js`).

- [ ] **Step 4: Run tests**

Run: `node --check js/main.js && node tools/test-przebieg.mjs && node tools/test-runda-hud.mjs && sh tools/test-wszystko.sh 2>&1 | grep -E "^test-.*✗$"`
Expected: wszystkie `✓`; jedyny `✗` to `test-rozdzielnosc.mjs`. Jeśli `grep` zwraca `startBtn`/`uiStartScreen` w `main.js` — usuń pozostałości.

- [ ] **Step 5: Zrzut ekranu Polany i test klikania bez kamery**

Bez `?tryb=`, bez klikania „Rozpal ogień": serwer statyczny + headless Chrome `--screenshot` z `http://localhost:8777/` (Polana) oraz scenariusz w stronie-opakowaniu (iframe, ten sam origin): klik kamienia „Próba" → ekran konfiguracji widoczny, przycisk „Rozpal ogień" nieaktywny przy pustym nicku, aktywny po wpisaniu imienia, 🎲 wypełnia pole, „Wróć" wraca na Polanę, kamień „Księga" otwiera pustą Księgę z zaproszeniem „Księga czeka na pierwszy wpis". Odczyt stanu przez DOM (`display`, `disabled`, `textContent`). **Nie wolno kliknąć „Rozpal ogień"** (uruchomiłoby kamerę i, przy `?tryb=obrzed`, muzykę). Zabij procesy Chrome i serwer po teście.

- [ ] **Step 6: Commit**

```bash
git add js/main.js js/przebieg.js js/rundaHud.js tools/test-przebieg.mjs tools/test-runda-hud.mjs
git commit -m "Menu wpiete w gre: Polana, Kronika po rundzie, Ksiega, Esc na Polane, jaja i koronacja"
```

---

### Task 7: Dokumentacja

**Files:**
- Modify: `GEMINI.md`, `docs/superpowers/specs/2026-10-01-tryby-design.md` (jedno zdanie o zmianie Esc), pamięć projektu.

- [ ] **Step 1: GEMINI.md**

- §2, po zdaniu o rundach: „Kronika po rundzie jest podsumowaniem, nie wyrokiem: nawet najniższy tytuł („Kłoda — każde ognisko zaczyna się od kłody") jest ciepły, a przydomek pojawia się tylko za coś, co go zasłużyło."
- §3, tabela plików, po `js/rundaHud.js` dopisać wiersze:
  - `js/menu.js` — „Model menu (ekrany Polana/konfiguracja/Księga/gra/Kronika, wybory, walidacja z ciepłymi zaproszeniami). `konfiguracja()` ma KSZTAŁT `parsujKonfiguracje` (+ nick) — menu i adres wchodzą do gry jedną ścieżką (`uruchomZKonfiguracji`)"
  - `js/ksiega.js` — „Księga Plemienia: tablice per tryb/wariant (`obrzed:<plik>`, `proba:<s>`, sufiks `+zew`), top 10, `localStorage` w try/catch (brak pamięci to nie błąd), walidacja każdego wpisu, import SCALA (nigdy nie nadpisuje; klucz po wzorcu — nie `__proto__`; limity 64 tablic/256 KB)"
  - `js/kronika.js` — „Teksty Kroniki: tytuł z PUNKTÓW NA MINUTĘ (`PROGI_TYTULOW`, progi zgadnięte), przydomki (`PRZYDOMKI` — rejestr z testem-strażnikiem odwołań do `KOMBOSY`/`REAKCJE`)"
  - `js/jaja.js`, `js/imiona.js` — „nick-bóg → efekt na Kronice (`odpalJajo` w `techniki.js`, ten sam worek co `odpalTechnike`, nic nie uzbraja); losowe imię 🎲 z testem długości WSZYSTKICH kombinacji (≤ 16)"
  - `js/polanaUi.js` — „Warstwa DOM menu: render modelu `Menu`, tekst gracza wyłącznie `textContent`"
- §6: bez zmian (testy podchwytywane automatycznie).
- §7: zastąp punkt 6 („Menu i Księga rekordów — podprojekt 3") informacją „zrobione" i dopisz „**Strojenie tytułów Kroniki** (`PROGI_TYTULOW`, pkt/min) na żywym ciele"; dopisz „**Wspólna tablica online** wymaga backendu (łamie §3) — świadomie poza zakresem".

- [ ] **Step 2: spec trybów i pamięć**

W `docs/superpowers/specs/2026-10-01-tryby-design.md`, sekcja „Przerwanie": dopisz „(Podprojekt 3: Esc wraca na Polanę, nie do trybu swobodnego — patrz `2026-10-01-polana-ksiega-design.md`.)"

Pamięć (`/Users/whomean/.claude/projects/-Users-whomean-Documents-antigravity-powerball-app/memory/kula-mocy-arcade-punkty-i-tryby.md`): zaktualizuj „Zrobione" o punkt 3 (menu Polana, Kronika, Księga, jaja; wejście z menu, `?tryb=` zostaje jako skrót), usuń „Kolejka: podprojekt 3", dopisz „Czekają na test na żywo: wszystkie trzy podprojekty (brak testu z kamerą w tej sesji)". Zaktualizuj opis w `MEMORY.md`.

- [ ] **Step 3: Final run + commit**

Run: `sh tools/test-wszystko.sh 2>&1 | grep -E "^test-.*✗$"`
Expected: jedyny `✗` to `test-rozdzielnosc.mjs`.

```bash
git add GEMINI.md docs/superpowers/specs/2026-10-01-tryby-design.md
git commit -m "Polana i Ksiega: dokumentacja (GEMINI.md, tabela plikow, spec trybow)"
```
