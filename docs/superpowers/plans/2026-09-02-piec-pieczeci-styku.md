# Pięć pieczęci styku — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić sześć run i Splot Mokoszy pięcioma pieczęciami zbudowanymi wokół punktu styku ciała, z progami wyliczonymi z nagrań żywego ciała zamiast zgadniętymi.

**Architecture:** Najpierw powstaje harness nagraniowy — sesja prowadzona przez aplikację, bo gracz tańczy i nie może być przy klawiaturze. Właściciel projektu nagrywa ~4 minuty materiału do `tools/probki/`. Dopiero potem narzędzie `tools/progi.mjs` generuje z tych nagrań plik stałych, cztery nowe znaki z pozy importują z niego progi, a test rozdzielności zamyka pętlę: nagranie jest wejściem stałym, progi zmienną strojoną offline.

**Tech Stack:** Waniliowy ES module JavaScript, bez bundlera i bez zależności. MediaPipe Tasks Vision (Pose + Hand Landmarker) z CDN. Testy: skrypty `node tools/test-*.mjs`, każdy wypisuje `✓`/`✗` i kończy się kodem wyjścia. Serwer: `python3 -m http.server 8000` w katalogu repo.

**Spec:** `docs/superpowers/specs/2026-09-02-piec-pieczeci-styku-design.md`

## Global Constraints

- **Reguła nadrzędna (GEMINI.md §2): nic nigdy nie mówi „źle".** Każdy `score()` zwraca ciągłe 0..1, nigdy boolean. Brak progu wewnątrz znaku, brak odrzucenia, brak komunikatu porażki. Boolean w miejscu wyniku gestu to błąd projektowy, nie detal.
- **Żadna stała progowa nie jest wpisana z głowy.** Progi pieczęci mieszkają wyłącznie w generowanym `js/znaki/progi-zmierzone.js`. Jeśli w kodzie tej zmiany pojawi się słowo `ZGADNIĘTE`, zadanie jest zrobione źle.
- **Jednostką każdej odległości z pozy jest szerokość barków**, nie metry bezwzględne.
- **Żaden znak nie odwołuje się do bioder** (landmarki 23/24). Kamera laptopa nie daje kadru z biodrami i zapasem.
- **Kolejność faz jest wiążąca**: harness → sesja nagraniowa → progi → znaki → odpięcie run. Odpięcie run przed nagraniem skasowałoby aplikację, w której trzeba nagrać sesję.
- **`worldLandmarks`**: metry, początek w środku bioder, oś **Y w dół** (barki mają `y` ujemne), `x` w prawo, `z` w głąb.
- Komentarze i nazwy w kodzie **po polsku**, zgodnie z całym repo.
- Testy uruchamia `sh tools/test-wszystko.sh` — musi być zielony po każdym zadaniu.

---

## File Structure

### Nowe

| plik | odpowiedzialność |
|---|---|
| `js/nagrywanie/sesja.js` | maszyna stanów sesji: scenariusz, odliczanie, nagrywanie, przerwy. Czysta logika, zero DOM i audio. |
| `js/nagrywanie/zapis.js` | bufor klatek + serializacja do JSON i z powrotem. Zna format pliku próbek, nic więcej. |
| `js/znaki/styk.js` | prymitywy geometrii styku dzielone przez cztery znaki z pozy. |
| `js/znaki/progi-zmierzone.js` | **generowany** przez `tools/progi.mjs`. Jedyne miejsce z liczbami progowymi. |
| `tools/progi.mjs` | liczy percentyle z nagrań i generuje plik wyżej. |
| `tools/test-sesja.mjs` | test maszyny stanów sesji. |
| `tools/test-zapis.mjs` | test serializacji próbek. |
| `tools/test-styk.mjs` | test prymitywów styku i skali. |
| `tools/test-rozdzielnosc.mjs` | test na nagraniach: pozy, taniec, przejścia. |
| `tools/probki/` | nagrania (JSON, wersjonowane w git). |

### Modyfikowane

| plik | zmiana |
|---|---|
| `js/znaki/postawa.js` | skala barków w pełnym 3D + EMA; `obrotBokiem()` z klatki bieżącej. |
| `js/znaki/weles.js` | przepisany: pięści na barkach. |
| `js/znaki/stribog.js` | przepisany: łokcie razem, przedramiona w górę. |
| `js/znaki/mokosz.js` | przepisany: miska nisko, czytana z pozy. |
| `js/znaki/perun.js` | przepisany: zygzak bokiem. |
| `js/debugHud.js` | ekran prowadzący sesję, klawisze `Z` i `1`–`8`, pobranie pliku. |
| `js/main.js` | rejestracja piątki; usunięcie śladów run i `rysujSlady`. |
| `js/kombosy.js` | nowa tabela kombosów. |
| `tools/test-postawy.mjs`, `tools/test-znaki.mjs` | przepisane pod nowe znaki, dane syntetyczne, sprawdzają **własności**, nie progi. |
| `tools/test-wszystko.sh` | bez zmian — pętla po `test-*.mjs` łapie nowe testy sama. |
| `GEMINI.md` | §7 opisuje dziś zrzut śladu runy klawiszem `N`; zastąpić opisem sesji nagraniowej. |

### Odpięte, nie usunięte

`js/runy/*` (notka w nagłówku każdego pliku), `js/znaki/mokoszSplot.js`. `tools/test-runy.mjs` zostaje zielony.

---

# FAZA A — harness nagraniowy

**Gra przez całą tę fazę nadal działa na runach.** Nic z niej nie usuwamy.

---

### Task 1: Maszyna stanów sesji nagraniowej

**Files:**
- Create: `js/nagrywanie/sesja.js`
- Test: `tools/test-sesja.mjs`

**Interfaces:**
- Consumes: nic.
- Produces: `SCENARIUSZ` (tablica kroków), `SesjaNagraniowa` z `start(odKroku = 1)`, `tick(dt) -> {stan, krok, powtorzenie, etykieta, pozostaloS, postep, sygnal}`, `przerwij()`, gettery `aktywna`, `nagrywa`.

- [ ] **Step 1: Write the failing test**

```javascript
// tools/test-sesja.mjs
/**
 * Maszyna stanów sesji nagraniowej.
 *
 *   node tools/test-sesja.mjs
 *
 * Sesja jest jedyną częścią harnessu, którą da się sprawdzić bez kamery
 * i bez DOM - i jednocześnie jedyną, której błąd zmarnowałby czas
 * właściciela projektu na powtórne nagranie. Stąd ten test.
 */
import { SesjaNagraniowa, SCENARIUSZ } from '../js/nagrywanie/sesja.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const DT = 1 / 60;

/** Przewija sesję o `sekundy`, zbierając wszystko, co po drodze zwróciła. */
function przewin(sesja, sekundy) {
  const klatki = [];
  for (let i = 0; i < Math.round(sekundy / DT); i++) klatki.push(sesja.tick(DT));
  return klatki;
}

console.log('SCENARIUSZ:');
spr('ma osiem kroków', SCENARIUSZ.length === 8);
spr('numery kroków to 1..8', SCENARIUSZ.every((k, i) => k.nr === i + 1));
spr('każdy krok ma niepusty opis dla gracza', SCENARIUSZ.every(k => k.opis && k.opis.length > 10));
spr('ostatni krok to taniec, jedno długie powtórzenie',
    SCENARIUSZ[7].id === 'taniec' && SCENARIUSZ[7].powtorzenia === 1 && SCENARIUSZ[7].czasS >= 30);
spr('pięć pierwszych kroków ma po trzy powtórzenia',
    SCENARIUSZ.slice(0, 5).every(k => k.powtorzenia === 3));
spr('każde powtórzenie pięciu pierwszych ma własną wskazówkę o zmianie miejsca',
    SCENARIUSZ.slice(0, 5).every(k => k.wskazowki.length === k.powtorzenia));

console.log('\nPRZEBIEG:');
const s = new SesjaNagraniowa();
spr('przed startem sesja jest bezczynna', !s.aktywna && s.tick(DT).stan === 'bezczynna');

s.start();
const poStarcie = s.tick(DT);
spr('start wchodzi w DOJŚCIE, nie od razu w nagrywanie', poStarcie.stan === 'dojscie');
spr('dojście jest długie - gracz musi odejść od klawiatury', poStarcie.pozostaloS > 10);
spr('w dojściu nic nie jest nagrywane', !s.nagrywa);

// Przewijamy przez dojście: pierwsze nagrywanie ma się zacząć samo.
const doNagrania = przewin(s, 13);
const start = doNagrania.find(k => k.sygnal === 'start');
spr('sygnał START pada dokładnie raz', doNagrania.filter(k => k.sygnal === 'start').length === 1);
spr('po sygnale START stan to nagrywanie', start && start.stan === 'nagrywanie');
spr('nagrywany jest krok 1, powtórzenie 1', start.krok.nr === 1 && start.powtorzenie === 1);
spr('etykieta klatki wiąże krok z powtórzeniem', start.etykieta === `${SCENARIUSZ[0].id}#1`);

// Nagrywanie trwa dokładnie tyle, ile mówi krok.
const wNagraniu = przewin(s, SCENARIUSZ[0].czasS - 0.5);
spr('przez cały czas kroku sesja nagrywa', wNagraniu.every(k => k.stan === 'nagrywanie'));
const poNagraniu = przewin(s, 1);
spr('sygnał STOP pada dokładnie raz', poNagraniu.filter(k => k.sygnal === 'stop').length === 1);
spr('po nagraniu wchodzi przerwa, nie następne nagranie',
    poNagraniu[poNagraniu.length - 1].stan === 'przerwa');

// Drugie powtórzenie tego samego kroku.
const drugie = przewin(s, 8).find(k => k.sygnal === 'start');
spr('drugie powtórzenie to ten sam krok, numer 2',
    drugie && drugie.krok.nr === 1 && drugie.powtorzenie === 2);
spr('etykieta drugiego powtórzenia jest inna', drugie.etykieta === `${SCENARIUSZ[0].id}#2`);

console.log('\nWEJŚCIE OD WYBRANEGO KROKU:');
const s2 = new SesjaNagraniowa();
s2.start(6);
const start6 = przewin(s2, 14).find(k => k.sygnal === 'start');
spr('start(6) nagrywa krok 6, nie krok 1', start6 && start6.krok.nr === 6);

console.log('\nKONIEC I PRZERWANIE:');
const s3 = new SesjaNagraniowa();
s3.start(8);                       // sam taniec: jedno powtórzenie
const przebieg = przewin(s3, 12 + SCENARIUSZ[7].czasS + 8);
spr('sesja sama dochodzi do końca', przebieg.some(k => k.sygnal === 'koniec'));
spr('sygnał KONIEC pada dokładnie raz', przebieg.filter(k => k.sygnal === 'koniec').length === 1);
spr('po końcu sesja jest bezczynna', !s3.aktywna);

const s4 = new SesjaNagraniowa();
s4.start();
s4.przerwij();
spr('przerwanie natychmiast kończy sesję', !s4.aktywna && !s4.nagrywa);

console.log('\nODPORNOŚĆ:');
const s5 = new SesjaNagraniowa();
s5.start();
spr('NaN w dt nie wywraca sesji', s5.tick(NaN).stan === 'dojscie');
spr('ogromne dt nie przeskakuje kroku', s5.tick(999).stan !== 'bezczynna');

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-sesja.mjs`
Expected: FAIL — `Cannot find module '../js/nagrywanie/sesja.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// js/nagrywanie/sesja.js
/**
 * Sesja nagraniowa - aplikacja prowadzi gracza, nie odwrotnie.
 *
 * POWÓD ISTNIENIA TEJ KLASY: żeby nacisnąć klawisz, gracz musi podejść do
 * komputera, a potem odejść, żeby tańczyć. Nagrywanie wyzwalane pojedynczym
 * naciśnięciem ("naciśnij i trzymaj pozę") jest więc bezużyteczne - materiał
 * zawierałby głównie spacer. Jedno naciśnięcie uruchamia CAŁY scenariusz,
 * a gra odlicza, mówi co robić i sama zaczyna oraz kończy każde nagranie.
 *
 * Ta klasa jest czystą logiką - zero DOM, zero dźwięku, zero landmarków.
 * Ekran i sygnały dźwiękowe podpina debugHud.js, klatki zbiera zapis.js.
 * Dzięki temu jedyna część harnessu, której błąd kosztowałby powtórne
 * nagranie, daje się sprawdzić testem bez kamery.
 */

// Długie, bo gracz musi wstać, odejść i się ustawić. Krótsze odliczanie
// znaczy pierwsze nagranie zawierające spacer.
const DOJSCIE_S = 12;
// Krótsze - gracz jest już na miejscu i tylko zmienia układ rąk.
const PRZERWA_S = 5;
// Sufit kroku czasu. Przy przełączeniu karty przeglądarka potrafi oddać
// jedno dt rzędu sekund; bez sufitu sesja przeskoczyłaby całe powtórzenie.
const MAX_DT = 0.1;

export const SCENARIUSZ = [
    {
        nr: 1, id: 'ogien', nazwa: 'OGIEŃ',
        opis: 'Piramidka: opuszki obu dłoni razem, nadgarstki rozsunięte',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 2, id: 'ziemia', nazwa: 'ZIEMIA',
        opis: 'Zaciśnięte pięści skrzyżowane na barkach - każda na przeciwnym',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 3, id: 'blyskawica', nazwa: 'BŁYSKAWICA',
        opis: 'Stań BOKIEM: ręka górą do przodu, ręka dołem do tyłu, oba łokcie zgięte',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['bokiem, jak Ci wygodnie', 'bokiem w DRUGĄ stronę', 'bokiem, krok dalej']
    },
    {
        nr: 4, id: 'powietrze', nazwa: 'POWIETRZE',
        opis: 'Łokcie razem przed sobą, przedramiona pionowo w górę, dłonie rozchylone',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 5, id: 'woda', nazwa: 'WODA',
        opis: 'Miska nisko przy pępku: nadgarstki stykają się bokami, palce rozwarte',
        powtorzenia: 3, czasS: 4,
        wskazowki: ['tak jak Ci wygodnie', 'krok BLIŻEJ kamery', 'krok DALEJ, lekko obrócony']
    },
    {
        nr: 6, id: 'przejscie-ogien-woda-powietrze', nazwa: 'PRZEJŚCIE: ogień → woda → powietrze',
        opis: 'Trzy pieczęcie jedna po drugiej, płynnie, bez zatrzymywania się między nimi',
        powtorzenia: 3, czasS: 8,
        wskazowki: ['w swoim tempie', 'trochę szybciej', 'wolno i szeroko']
    },
    {
        nr: 7, id: 'przejscie-ziemia-powietrze', nazwa: 'PRZEJŚCIE: ziemia → powietrze',
        opis: 'Pięści z barków rozwiń wprost w łokcie razem, płynnie',
        powtorzenia: 3, czasS: 6,
        wskazowki: ['w swoim tempie', 'trochę szybciej', 'wolno i szeroko']
    },
    {
        nr: 8, id: 'taniec', nazwa: 'TANIEC',
        opis: 'Tańcz swobodnie. NIE myśl o pieczęciach - to jest próbka negatywna',
        powtorzenia: 1, czasS: 30,
        wskazowki: ['tak, jak tańczysz normalnie']
    }
];

export class SesjaNagraniowa {
    constructor({ scenariusz = SCENARIUSZ } = {}) {
        this.scenariusz = scenariusz;
        this._reset();
    }

    _reset() {
        this.stan = 'bezczynna';
        this._indeks = 0;        // indeks w tablicy scenariusza
        this._powtorzenie = 1;
        this._pozostalo = 0;
        this._calosc = 0;        // ile trwa bieżąca faza - do paska postępu
    }

    /** @param {number} odKroku  numer kroku (1..8), od którego zacząć */
    start(odKroku = 1) {
        const i = this.scenariusz.findIndex(k => k.nr === odKroku);
        this._reset();
        this._indeks = i >= 0 ? i : 0;
        this._powtorzenie = 1;
        this._wejdz('dojscie', DOJSCIE_S);
    }

    przerwij() {
        this._reset();
    }

    get aktywna() { return this.stan !== 'bezczynna'; }
    get nagrywa() { return this.stan === 'nagrywanie'; }

    /**
     * Krok czasu. Zwraca stan do wyświetlenia PLUS `sygnal` - jednorazowe
     * zdarzenie ('start' | 'stop' | 'koniec' | null), z którego debugHud
     * robi dźwięk. Zdarzenie jest w wyniku, a nie w callbacku, bo dzięki
     * temu cała klasa zostaje czystą funkcją stanu i daje się testować.
     */
    tick(dt) {
        if (this.stan === 'bezczynna') return this._wynik(null);

        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(MAX_DT, dt)) : 0;
        this._pozostalo -= krok;
        if (this._pozostalo > 0) return this._wynik(null);

        if (this.stan === 'dojscie' || this.stan === 'przerwa') {
            this._wejdz('nagrywanie', this._krok.czasS);
            return this._wynik('start');
        }

        // stan === 'nagrywanie' - powtórzenie właśnie się skończyło
        if (this._nastepnePowtorzenie()) {
            this._wejdz('przerwa', PRZERWA_S);
            return this._wynik('stop');
        }

        this._reset();
        return this._wynik('koniec');
    }

    /** Przesuwa wskaźnik na kolejne powtórzenie/krok. Zwraca false, gdy scenariusz się skończył. */
    _nastepnePowtorzenie() {
        if (this._powtorzenie < this._krok.powtorzenia) {
            this._powtorzenie += 1;
            return true;
        }
        if (this._indeks < this.scenariusz.length - 1) {
            this._indeks += 1;
            this._powtorzenie = 1;
            return true;
        }
        return false;
    }

    get _krok() { return this.scenariusz[this._indeks]; }

    _wejdz(stan, sekundy) {
        this.stan = stan;
        this._pozostalo = sekundy;
        this._calosc = sekundy;
    }

    _wynik(sygnal) {
        const bezczynna = this.stan === 'bezczynna';
        const krok = bezczynna ? null : this._krok;
        return {
            stan: this.stan,
            krok,
            powtorzenie: this._powtorzenie,
            // Etykieta wiąże klatkę z krokiem I powtórzeniem - bez numeru
            // powtórzenia nie dałoby się odrzucić jednej zepsutej próby,
            // a to jest cała procedura ratunkowa tej sesji.
            etykieta: krok ? `${krok.id}#${this._powtorzenie}` : null,
            wskazowka: krok ? (krok.wskazowki[this._powtorzenie - 1] ?? '') : '',
            pozostaloS: Math.max(0, this._pozostalo),
            postep: this._calosc > 0 ? 1 - Math.max(0, this._pozostalo) / this._calosc : 0,
            sygnal
        };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-sesja.mjs`
Expected: PASS — wszystkie linie z `✓`, kod wyjścia 0

- [ ] **Step 5: Commit**

```bash
git add js/nagrywanie/sesja.js tools/test-sesja.mjs
git commit -m "Sesja nagraniowa: maszyna stanów prowadząca gracza przez scenariusz"
```

---

### Task 2: Zapis i odczyt próbek

**Files:**
- Create: `js/nagrywanie/zapis.js`
- Test: `tools/test-zapis.mjs`

**Interfaces:**
- Consumes: nic (etykiety przychodzą jako stringi z `SesjaNagraniowa`).
- Produces: `ZapisProbek` z `dodaj(etykieta, frame)`, `liczbaKlatek`, `doJson() -> object`, `nazwaPliku() -> string`; funkcja `odtworzKlatke(zapisana) -> frame` (kontrakt klatki gotowy do `znak.score()`).

- [ ] **Step 1: Write the failing test**

```javascript
// tools/test-zapis.mjs
/**
 * Format próbek: zapis, odczyt i to, czego zapis NIE zapisuje.
 *
 *   node tools/test-zapis.mjs
 *
 * Ten plik jest jedynym miejscem, które wie, jak wygląda JSON w
 * tools/probki/. Zapis i odczyt siedzą razem, żeby nie dało się zmienić
 * jednego bez drugiego - nagrania są nieodtwarzalne, więc niezgodność
 * formatu kosztowałaby powtórną sesję.
 */
import { ZapisProbek, odtworzKlatke } from '../js/nagrywanie/zapis.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

function klatka({ vis = 1, dlonie = 1 } = {}) {
  const wl = Array.from({ length: 33 }, (_, i) => ({
    x: 0.111111 + i / 1000, y: -0.555555, z: 0.123456, visibility: vis
  }));
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
  const hands = Array.from({ length: dlonie }, () => ({
    handedness: 'Left',
    landmarks: Array.from({ length: 21 }, () => ({ x: 0.4, y: 0.4, z: 0 }))
  }));
  return { hands, pose: { landmarks: lm, worldLandmarks: wl }, width: 1920, height: 1080, dt: 1 / 60, now: 0 };
}

console.log('ZAPIS:');
const z = new ZapisProbek();
spr('nowy zapis jest pusty', z.liczbaKlatek === 0);

z.dodaj('ogien#1', klatka());
z.dodaj('ogien#1', klatka());
z.dodaj('ogien#2', klatka());
spr('klatki się liczą', z.liczbaKlatek === 3);

const json = z.doJson();
spr('klatki są pogrupowane po etykiecie', Object.keys(json.kroki).sort().join(',') === 'ogien#1,ogien#2');
spr('grupa ma tyle klatek, ile dodano', json.kroki['ogien#1'].length === 2);
spr('plik nosi numer wersji formatu', typeof json.wersja === 'number');

console.log('\nROZMIAR:');
const dlugie = JSON.stringify(json).match(/\d+\.\d{5,}/g);
spr('żadna liczba nie ma więcej niż 3 miejsca po przecinku', dlugie === null);

console.log('\nODCZYT:');
const odtworzona = odtworzKlatke(json.kroki['ogien#1'][0]);
spr('odtworzona klatka ma worldLandmarks', Array.isArray(odtworzona.pose.worldLandmarks));
spr('odtworzona klatka ma 33 punkty pozy', odtworzona.pose.worldLandmarks.length === 33);
spr('punkt ma pola x/y/z/visibility, których oczekuje postawa.js',
    ['x', 'y', 'z', 'visibility'].every(k => Number.isFinite(odtworzona.pose.worldLandmarks[0][k])));
spr('wartości przetrwały zaokrąglenie z sensowną dokładnością',
    Math.abs(odtworzona.pose.worldLandmarks[0].x - 0.111111) < 0.001);
spr('dłonie wracają z landmarkami', odtworzona.hands.length === 1 && odtworzona.hands[0].landmarks.length === 21);
spr('odtworzona klatka ma dt, którego wymaga silnik składania', Number.isFinite(odtworzona.dt));

console.log('\nBRAK DANYCH:');
const z2 = new ZapisProbek();
z2.dodaj('taniec#1', { hands: [], pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0 });
const bezPozy = odtworzKlatke(z2.doJson().kroki['taniec#1'][0]);
spr('klatka bez pozy zapisuje się i wraca jako brak pozy', bezPozy.pose === null);
spr('klatka bez dłoni wraca z pustą tablicą', Array.isArray(bezPozy.hands) && bezPozy.hands.length === 0);

console.log('\nNAZWA PLIKU:');
spr('nazwa pliku wygląda jak plik próbek', /^probki-.*\.json$/.test(z.nazwaPliku()));

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-zapis.mjs`
Expected: FAIL — `Cannot find module '../js/nagrywanie/zapis.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// js/nagrywanie/zapis.js
/**
 * Format próbek: bufor klatek w przeglądarce -> JSON -> z powrotem klatka
 * gotowa dla znak.score().
 *
 * Zapis i odczyt mieszkają w JEDNYM pliku celowo. Nagrania są nieodtwarzalne
 * bez ponownej sesji z żywym ciałem, więc rozjechanie się serializacji
 * z deserializacją byłoby najdroższym możliwym błędem w tej zmianie.
 *
 * Punkty lądują jako krotki [x, y, z, visibility], nie obiekty. Klatek jest
 * ~3300 (110 s użytecznego materiału x 30 fps) po 33 punkty pozy i do 42
 * punktów dłoni - w obiektach z nazwami pól nazwy pól byłyby większością
 * pliku. Zaokrąglenie do 3 miejsc po przecinku to około milimetra przy
 * metrycznych worldLandmarks, czyli poniżej realnej dokładności trackera.
 */

export const WERSJA_FORMATU = 1;
const MIEJSC = 3;

const okr = (v) => Number.isFinite(v) ? Number(v.toFixed(MIEJSC)) : 0;
const spakujPunkt = (p) => [okr(p?.x), okr(p?.y), okr(p?.z), okr(p?.visibility ?? 1)];
const rozpakujPunkt = ([x, y, z, visibility]) => ({ x, y, z, visibility });

export class ZapisProbek {
    constructor() {
        this.kroki = {};        // etykieta -> tablica spakowanych klatek
        this.liczbaKlatek = 0;
    }

    /**
     * @param {string} etykieta  z SesjaNagraniowa (`${id}#${powtorzenie}`)
     * @param {object} frame     kontrakt klatki z main.js:buildFrame
     */
    dodaj(etykieta, frame) {
        if (!etykieta) return;
        (this.kroki[etykieta] ??= []).push({
            dt: okr(frame.dt),
            // null, nie pusta tablica: "poza nie została wykryta" to inna
            // informacja niż "wykryta i pusta", a bramka widoczności
            // w postawa.js rozróżnia te przypadki.
            poza: frame.pose ? {
                w: (frame.pose.worldLandmarks ?? []).map(spakujPunkt),
                l: (frame.pose.landmarks ?? []).map(spakujPunkt)
            } : null,
            dlonie: (frame.hands ?? []).map(d => ({
                h: d.handedness ?? null,
                l: (d.landmarks ?? []).map(spakujPunkt)
            }))
        });
        this.liczbaKlatek += 1;
    }

    doJson() {
        return {
            wersja: WERSJA_FORMATU,
            utworzono: new Date().toISOString(),
            liczbaKlatek: this.liczbaKlatek,
            kroki: this.kroki
        };
    }

    nazwaPliku() {
        const t = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        return `probki-${t}.json`;
    }
}

/**
 * Spakowana klatka -> kontrakt klatki, jakiego oczekuje znak.score().
 *
 * `width`/`height` są stałe i nieużywane przez znaki z pozy; są w kontrakcie,
 * bo `frame` jest tym samym obiektem, który w grze dostaje rysowanie.
 */
export function odtworzKlatke(zapisana) {
    return {
        hands: (zapisana.dlonie ?? []).map(d => ({
            handedness: d.h,
            landmarks: (d.l ?? []).map(rozpakujPunkt)
        })),
        pose: zapisana.poza ? {
            worldLandmarks: (zapisana.poza.w ?? []).map(rozpakujPunkt),
            landmarks: (zapisana.poza.l ?? []).map(rozpakujPunkt)
        } : null,
        width: 1920,
        height: 1080,
        dt: Number.isFinite(zapisana.dt) ? zapisana.dt : 1 / 60,
        now: 0
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-zapis.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/nagrywanie/zapis.js tools/test-zapis.mjs
git commit -m "Format próbek: pakowanie klatek do JSON i odtwarzanie kontraktu klatki"
```

---

### Task 3: Wpięcie sesji w nakładkę i pętlę gry

**Files:**
- Modify: `js/debugHud.js` (konstruktor i obsługa klawiszy w okolicy `js/debugHud.js:29-39`; nowe metody; wywołanie z `updatePanel`)
- Modify: `js/main.js:318` (po `debugHud.tick(now)`) i `js/main.js:525` (blok `updatePanel`)
- Test: weryfikacja ręczna w przeglądarce (kroki poniżej) — DOM i dźwięk nie mają tu sensownego testu jednostkowego, tak jak reszta nakładki (`js/debugHud.js:5-7`)

**Interfaces:**
- Consumes: `SesjaNagraniowa`, `SCENARIUSZ` z Task 1; `ZapisProbek` z Task 2.
- Produces: `DebugHud.aktualizujSesje(frame, dt)` wywoływane raz na klatkę z `main.js`; pobranie pliku JSON przez `<a download>`.

- [ ] **Step 1: Dodaj stan sesji do konstruktora `DebugHud`**

W `js/debugHud.js`, po `this._zrzucSladPrzyNastepnejKlatce = false;`:

```javascript
        // --- Sesja nagraniowa (spec pięciu pieczęci, Krok 0) ---
        // Ekran prowadzący jest OSOBNYM elementem, nie linijką w panelu
        // diagnostycznym: gracz czyta go z drugiego końca pokoju, a panel
        // jest monospace 12px pod lewym górnym rogiem.
        this.sesja = new SesjaNagraniowa();
        this.zapis = null;
        this.ekranSesji = this._utworzEkranSesji();
```

Na górze pliku, obok istniejącego importu:

```javascript
import { SesjaNagraniowa, SCENARIUSZ } from './nagrywanie/sesja.js';
import { ZapisProbek } from './nagrywanie/zapis.js';
```

- [ ] **Step 2: Dodaj obsługę klawiszy**

W handlerze `keydown` w `js/debugHud.js`, po linii z klawiszem `N`:

```javascript
            // Sesja nagraniowa: Z od początku, cyfra 1-8 od wybranego kroku.
            // Cyfry, a nie Shift+Z z wyborem - dogranie jednej zepsutej pozy
            // ma być jednym naciśnięciem, bo gracz stoi wtedy przy klawiaturze
            // tylko po to i zaraz musi odejść.
            if (e.key === 'z' || e.key === 'Z') this._startSesji(1);
            if (/^[1-8]$/.test(e.key)) this._startSesji(Number(e.key));
            if (e.key === 'Escape' && this.sesja.aktywna) {
                this.sesja.przerwij();
                this._ukryjEkranSesji();
            }
```

- [ ] **Step 3: Dodaj metody sesji do `DebugHud`**

```javascript
    _startSesji(odKroku) {
        if (this.sesja.aktywna) return;      // drugie naciśnięcie nie restartuje
        this.zapis = new ZapisProbek();
        this.sesja.start(odKroku);
        this.ekranSesji.style.display = 'flex';
        console.log(`[Z] Sesja nagraniowa od kroku ${odKroku}. Escape przerywa.`);
    }

    /**
     * Raz na klatkę z main.js, ZAWSZE - tak jak tick(). Sesja musi chodzić
     * także przy schowanym panelu: gracz nagrywa z drugiego końca pokoju
     * i nie ma jak włączyć nakładki po drodze.
     */
    aktualizujSesje(frame, dt) {
        if (!this.sesja.aktywna) return;

        const s = this.sesja.tick(dt);

        // Klatki zbierane WYŁĄCZNIE w stanie nagrywania - przerwy i dojście
        // to spacer i szukanie pozycji, czyli materiał, którego nikt nie użyje.
        if (s.stan === 'nagrywanie') this.zapis.dodaj(s.etykieta, frame);

        if (s.sygnal === 'start') this._piknij(880, 0.35);
        if (s.sygnal === 'stop') this._piknij(440, 0.12);
        if (s.sygnal === 'koniec') {
            this._piknij(220, 0.6);
            this._zapiszProbki();
            this._ukryjEkranSesji();
            return;
        }
        this._rysujEkranSesji(s);
    }

    /**
     * Sygnał dźwiękowy przez własny, jednorazowy oscylator.
     *
     * NIE przez audioEngine.js: tamten prowadzi ciągłą warstwę muzyczną gry
     * i jego stan zależy od mocy i płynności. Sygnały sesji muszą być słyszalne
     * niezależnie od tego, co robi ścieżka dźwiękowa, i nie mogą jej zaburzać.
     *
     * Dźwięk jest tu ważniejszy niż ekran: przy błyskawicy gracz stoi bokiem
     * do kamery i monitora może w ogóle nie widzieć.
     */
    _piknij(hz, sekundy) {
        try {
            const ctx = (this._audio ??= new (window.AudioContext || window.webkitAudioContext)());
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = hz;
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sekundy);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + sekundy);
        } catch (e) {
            // Brak dźwięku nie może przerwać sesji - gracz ma jeszcze ekran.
            console.warn('[sesja] sygnał dźwiękowy niedostępny:', e.message);
        }
    }

    _utworzEkranSesji() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed; inset: 0; z-index: 1000; display: none;
            flex-direction: column; align-items: center; justify-content: center;
            gap: 18px; pointer-events: none; text-align: center;
            font: 600 28px/1.3 system-ui, sans-serif; color: #eafff8;
            text-shadow: 0 2px 18px rgba(0,0,0,0.9);
        `;
        document.body.appendChild(el);
        return el;
    }

    _rysujEkranSesji(s) {
        const szer = Math.round(s.postep * 100);
        const kolor = s.stan === 'nagrywanie' ? '#00ffcc' : '#ffb347';
        this.ekranSesji.innerHTML = `
            <div style="font-size:15px;opacity:0.75">krok ${s.krok.nr}/${SCENARIUSZ.length}
                 · powtórzenie ${s.powtorzenie}/${s.krok.powtorzenia}</div>
            <div style="font-size:54px;color:${kolor}">${s.krok.nazwa}</div>
            <div style="max-width:70vw;font-size:24px;font-weight:400">${s.krok.opis}</div>
            <div style="font-size:19px;opacity:0.8">${s.wskazowka}</div>
            <div style="font-size:64px;color:${kolor}">
                ${s.stan === 'nagrywanie' ? '● NAGRYWAM' : Math.ceil(s.pozostaloS)}
            </div>
            <div style="width:60vw;height:10px;background:rgba(255,255,255,0.15);border-radius:5px">
                <div style="width:${szer}%;height:100%;background:${kolor};border-radius:5px"></div>
            </div>
            <div style="font-size:14px;opacity:0.5">Escape przerywa</div>
        `;
    }

    _ukryjEkranSesji() {
        this.ekranSesji.style.display = 'none';
        this.ekranSesji.innerHTML = '';
    }

    /**
     * Pobranie pliku przez <a download>. Przeglądarka nie zapisze do
     * tools/probki/ sama - plik ląduje w katalogu pobierania i trzeba go
     * tam przenieść ręcznie. Nazwa pliku niesie datę, więc kolejne sesje
     * się nie nadpisują.
     */
    _zapiszProbki() {
        const dane = this.zapis.doJson();
        const nazwa = this.zapis.nazwaPliku();
        const blob = new Blob([JSON.stringify(dane)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nazwa;
        a.click();
        URL.revokeObjectURL(a.href);
        console.log(`[sesja] Zapisano ${dane.liczbaKlatek} klatek w ${Object.keys(dane.kroki).length} powtórzeniach ` +
                    `-> ${nazwa}. PRZENIEŚ ten plik do tools/probki/.`);
    }
```

- [ ] **Step 4: Wywołaj sesję z pętli gry**

W `js/main.js`, zaraz po `debugHud.tick(now);` (linia 318):

```javascript
    // Sesja nagraniowa (klawisz Z) - PRZED resztą klatki i niezależnie od
    // tego, czy nakładka jest widoczna. Sama sprawdza, czy jest aktywna.
    debugHud.aktualizujSesje(buildFrame(fit, dt, now), dt);
```

**Uwaga na kolejność:** `buildFrame` jest wywoływane w linii 340 jako `--- 3. Kontrakt klatki ---`. Nie duplikuj go — zamiast powyższego, **przenieś wywołanie `aktualizujSesje` poniżej linii 340** i podaj istniejące `frame`:

```javascript
    // --- 3. Kontrakt klatki ---
    const frame = buildFrame(fit, dt, now);

    // --- 3a. Sesja nagraniowa (klawisz Z) ---
    // Zaraz po zbudowaniu klatki, przed jakąkolwiek interpretacją: nagranie
    // ma zawierać SUROWE landmarki, niezależne od tego, jak gra je dziś czyta.
    debugHud.aktualizujSesje(frame, dt);
```

- [ ] **Step 5: Sprawdź, że nic nie zepsuł**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie testy `✓` (harness nie dotyka logiki gry)

- [ ] **Step 6: Weryfikacja ręczna w przeglądarce**

```bash
python3 -m http.server 8000
```

Otwórz `http://localhost:8000`, uruchom kamerę i sprawdź:
1. Klawisz `Z` pokazuje ekran z napisem `OGIEŃ` i odliczaniem od 12.
2. Po odliczeniu słychać wyższy sygnał i napis zmienia się na `● NAGRYWAM`.
3. Po 4 s słychać niższy sygnał i zaczyna się przerwa 5 s.
4. `Escape` natychmiast chowa ekran.
5. Klawisz `8` startuje od razu od kroku `TANIEC`.
6. Po zakończeniu kroku 8 przeglądarka pobiera plik `probki-....json`, a konsola wypisuje liczbę klatek.
7. Gra przez cały czas działa normalnie — kula, moc i runy nadal reagują.

- [ ] **Step 7: Commit**

```bash
git add js/debugHud.js js/main.js
git commit -m "Harness nagraniowy: ekran prowadzący, sygnały dźwiękowe, zrzut próbek"
```

---

## 🚦 BRAMA: sesja nagraniowa z właścicielem projektu

**To nie jest zadanie dla agenta. Praca zatrzymuje się tutaj.**

Właściciel projektu:
1. uruchamia `python3 -m http.server 8000`, otwiera grę, startuje kamerę,
2. naciska `Z`, odchodzi i przechodzi cały scenariusz (~4 minuty),
3. przenosi pobrany plik do `tools/probki/`,
4. commituje: `git add tools/probki && git commit -m "Próbki: nagranie sesji <data>"`.

Następnie **przegląd materiału przed liczeniem progów**: uruchom `node tools/progi.mjs --raport` (Task 6) i sprawdź, czy w którymś powtórzeniu tracking się posypał (mało klatek z pozą, skoki skali). Powtórzenia do dogrania zgłoś właścicielowi projektu — dogrywa je klawiszem z numerem kroku.

**Faza B nie zaczyna się, dopóki w `tools/probki/` nie ma nagrania.**

---

# FAZA B — progi i znaki

---

### Task 4: Skala ciała w pełnym 3D

**Files:**
- Modify: `js/znaki/postawa.js:42-47` (`skalaCiala`), dopisanie EMA i `obrotBokiem`
- Test: `tools/test-styk.mjs` (tworzony tutaj, rozszerzany w Task 5)

**Interfaces:**
- Consumes: nic.
- Produces: `skalaCiala(wl)` (wygładzona, jeśli EMA zainicjowana), `aktualizujSkale(wl, dt)`, `resetSkali()`, `obrotBokiem(wl) -> 0..1`.

- [ ] **Step 1: Write the failing test**

```javascript
// tools/test-styk.mjs
/**
 * Skala ciała i prymitywy styku.
 *
 *   node tools/test-styk.mjs
 *
 * Skala barków jest jednostką odniesienia dla WSZYSTKICH progów pieczęci
 * z pozy, więc jej błąd nie objawia się jako "ten jeden znak nie działa",
 * tylko jako "wszystkie znaki są za luźne, ale tylko czasem". Stąd osobny
 * test - to najbardziej podstępna wielkość w całym module.
 */
import { skalaCiala, aktualizujSkale, resetSkali, obrotBokiem, BARK_L, BARK_P } from '../js/znaki/postawa.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Barki o rozstawie 0.40 m obrócone o `kat` stopni wokół osi pionowej. */
function barki(kat) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const r = 0.20, a = kat * Math.PI / 180;
  wl[BARK_L] = { x: -r * Math.cos(a), y: -0.55, z: -r * Math.sin(a), visibility: 1 };
  wl[BARK_P] = { x: r * Math.cos(a), y: -0.55, z: r * Math.sin(a), visibility: 1 };
  return wl;
}

console.log('SKALA - niezmienniczość na obrót:');
resetSkali();
const przodem = skalaCiala(barki(0));
const skos = skalaCiala(barki(45));
const bokiem = skalaCiala(barki(90));
console.log(`  przodem ${przodem.toFixed(3)}  skos ${skos.toFixed(3)}  bokiem ${bokiem.toFixed(3)}`);
spr('przodem skala to realny rozstaw barków', Math.abs(przodem - 0.40) < 0.01);
spr('bokiem skala się NIE zapada (dawniej lądowała na podłodze 0.12)',
    Math.abs(bokiem - 0.40) < 0.01);
spr('na skos też bez zmian', Math.abs(skos - 0.40) < 0.01);

console.log('\nSKALA - odporność:');
resetSkali();
const zepsute = Array.from({ length: 33 }, () => ({ x: NaN, y: NaN, z: NaN, visibility: 1 }));
spr('NaN daje podłogę, nie NaN', skalaCiala(zepsute) === 0.12);
resetSkali();
const zlepione = barki(0);
zlepione[BARK_L] = { x: 0, y: -0.55, z: 0, visibility: 1 };
zlepione[BARK_P] = { x: 0, y: -0.55, z: 0, visibility: 1 };
spr('barki w jednym punkcie dają podłogę, nie zero', skalaCiala(zlepione) === 0.12);

console.log('\nSKALA - wygładzanie:');
resetSkali();
// Skala jest STAŁĄ ciała, nie pomiarem z klatki: pojedynczy zepsuty odczyt
// nie może nią rzucić.
for (let i = 0; i < 60; i++) aktualizujSkale(barki(0), 1 / 60);
const stabilna = skalaCiala(barki(0));
const skok = barki(0);
skok[BARK_L] = { x: -0.60, y: -0.55, z: 0, visibility: 1 };   // absurdalny rozstaw 0.80
aktualizujSkale(skok, 1 / 60);
spr('jedna zepsuta klatka nie rusza wygładzonej skali',
    Math.abs(skalaCiala(skok) - stabilna) < 0.02);

console.log('\nOBRÓT BOKIEM:');
resetSkali();
spr('przodem obrót bliski 0', obrotBokiem(barki(0)) < 0.05);
spr('bokiem obrót bliski 1', obrotBokiem(barki(90)) > 0.95);
spr('na skos gdzieś pośrodku', obrotBokiem(barki(45)) > 0.2 && obrotBokiem(barki(45)) < 0.5);
// Kluczowe: obrót liczy się z KLATKI BIEŻĄCEJ. Gdyby dzielił przez skalę
// wygładzoną, mianownik zostawałby w tyle dokładnie wtedy, gdy gracz się
// obraca - czyli w jedynym momencie, w którym ten warunek cokolwiek znaczy.
resetSkali();
for (let i = 0; i < 60; i++) aktualizujSkale(barki(0), 1 / 60);
spr('obrót reaguje natychmiast, mimo wygładzonej skali', obrotBokiem(barki(90)) > 0.95);

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-styk.mjs`
Expected: FAIL — `aktualizujSkale is not a function` (oraz `bokiem` = 0.12 zamiast 0.40)

- [ ] **Step 3: Zastąp `skalaCiala` w `js/znaki/postawa.js`**

Zastąp linie 37-47 (blok `skalaCiala`) tym:

```javascript
/**
 * ================== SKALA BARKÓW ==================
 *
 * Rozstaw barków w metrach - jednostka odniesienia dla wszystkich odległości.
 *
 * LICZONA W PEŁNYM 3D, I TO JEST NAPRAWA BŁĘDU. Poprzednia wersja brała
 * sqrt(dx² + dy²), pomijając z. Gdy gracz stoi BOKIEM, rozstaw barków
 * przenosi się prawie w całości do osi z: dx i dy schodzą do zera, wynik
 * lądował na podłodze 0.12, podczas gdy realny rozstaw to ~0.38 m. Skala
 * robiła się trzykrotnie za mała, więc KAŻDY próg wyrażony w jej
 * wielokrotnościach robił się trzykrotnie za luźny. Pieczęć błyskawicy
 * WYMAGA stania bokiem, więc trafiałaby w ten błąd za każdym razem.
 *
 * Rozstaw barków to wymiar sztywnego ciała - w pełnym 3D jest
 * NIEZMIENNIKIEM OBROTU, więc obrócenie się przestaje na cokolwiek wpływać.
 */
export function skalaCiala(wl) {
    // Wygładzona wartość wygrywa, jeśli istnieje - patrz aktualizujSkale.
    if (_skalaEma !== null) return _skalaEma;
    return skalaChwilowa(wl);
}

/** Rozstaw z TEJ klatki, bez historii. Publiczna, bo potrzebuje jej obrotBokiem. */
export function skalaChwilowa(wl) {
    const a = wl?.[BARK_L], b = wl?.[BARK_P];
    if (!a || !b) return 0.12;
    const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Podłoga chroni przed dzieleniem przez zero przy zepsutych punktach.
    return Number.isFinite(d) ? Math.max(0.12, d) : 0.12;
}

// EMA skali. Skala jest STAŁĄ CIAŁA, nie pomiarem z klatki, więc mocne
// wygładzenie jest tu poprawne z definicji - i zjada szum osi z, którą
// MediaPipe szacuje mniej pewnie niż x i y.
//
// Stan modułowy, aktualizowany raz na klatkę z main.js - ten sam wzorzec
// co dawne aktualizujSlady(): pięć znaków dzieli jedną skalę, a gdyby każdy
// liczył ją we własnym score(), wygładzanie biegłoby pięć razy szybciej.
let _skalaEma = null;
const CZAS_WYGLADZANIA_S = 1.0;

/** Raz na klatkę, PRZED znaki.ocen(). */
export function aktualizujSkale(wl, dt) {
    const s = skalaChwilowa(wl);
    if (!widoczne(wl, [BARK_L, BARK_P])) return;
    const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    if (_skalaEma === null) { _skalaEma = s; return; }
    const alpha = Math.min(1, krok / CZAS_WYGLADZANIA_S);
    _skalaEma += alpha * (s - _skalaEma);
}

/** Testy i przełączanie między próbkami muszą móc zacząć od czystego stanu. */
export function resetSkali() {
    _skalaEma = null;
}

/**
 * Ile gracz jest obrócony bokiem: 0 = przodem, 1 = profil.
 *
 * Liczone z KLATKI BIEŻĄCEJ, nie z wygładzonej skali. Wygładzony mianownik
 * zostawałby w tyle dokładnie wtedy, gdy gracz się obraca - czyli w jedynym
 * momencie, w którym ten warunek cokolwiek znaczy.
 *
 * To jest ten sam sygnał, który psuł starą skalę, użyty jako pomiar.
 */
export function obrotBokiem(wl) {
    const a = wl?.[BARK_L], b = wl?.[BARK_P];
    if (!a || !b) return 0;
    const wObrazie = Math.hypot(a.x - b.x, a.y - b.y);
    const w3D = skalaChwilowa(wl);
    if (!(w3D > 1e-6) || !Number.isFinite(wObrazie)) return 0;
    return Math.max(0, Math.min(1, 1 - wObrazie / w3D));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-styk.mjs && sh tools/test-wszystko.sh`
Expected: PASS. Jeśli `test-postawy.mjs` zacznie zawodzić — to poprawne: stare postawy były strojone pod zapadającą się skalę i są przepisywane w Task 7-10. Zanotuj, które asercje padły, i przejdź dalej; Task 10 kończy się zielonym kompletem.

- [ ] **Step 5: Commit**

```bash
git add js/znaki/postawa.js tools/test-styk.mjs
git commit -m "Skala barków w pełnym 3D + wygładzanie; obrót bokiem jako pomiar"
```

---

### Task 5: Prymitywy styku

**Files:**
- Create: `js/znaki/styk.js`
- Modify: `tools/test-styk.mjs` (dopisanie sekcji)

**Interfaces:**
- Consumes: `rampa`, `skalaCiala`, `poziom` z `postawa.js`.
- Produces: `odleglosc(wl, i, j)`, `styk(wl, i, j, skala, pelny, zero) -> 0..1`, `nadBarkami(wl, i, skala) -> number` (w szerokościach barków, dodatnie w górę), `katWLokciu(wl, bark, lokiec, nadg) -> stopnie`.

- [ ] **Step 1: Dopisz test na końcu `tools/test-styk.mjs`, przed `process.exit`**

```javascript
console.log('\nPRYMITYWY STYKU:');
const { odleglosc, styk, nadBarkami, katWLokciu } = await import('../js/znaki/styk.js');

function cialo(punkty) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  wl[11] = { x: -0.20, y: -0.55, z: 0, visibility: 1 };
  wl[12] = { x: 0.20, y: -0.55, z: 0, visibility: 1 };
  for (const [i, p] of Object.entries(punkty)) wl[i] = { x: p[0], y: p[1], z: p[2] ?? 0, visibility: 1 };
  return wl;
}

const c = cialo({ 15: [-0.20, -0.55], 16: [0.20, -0.15] });
spr('odległość liczy się w 3D', Math.abs(odleglosc(cialo({ 15: [0, 0, 0], 16: [0, 0, 0.5] }), 15, 16) - 0.5) < 1e-9);

console.log('  styk (1 = dotyk, 0 = daleko):');
const s0 = styk(c, 15, 11, 0.40, 0.15, 0.60);     // nadgarstek dokładnie na barku
spr(`dotyk daje pełny wynik (${s0.toFixed(2)})`, s0 > 0.99);
const s1 = styk(cialo({ 15: [0.30, -0.15] }), 15, 11, 0.40, 0.15, 0.60);
spr(`daleko daje zero, nie liczbę ujemną (${s1.toFixed(2)})`, s1 === 0);

// REGUŁA NADRZĘDNA: styk NIE JEST binarny. Pięść BLISKO barku ma dawać
// słabszy, ale niezerowy wynik - inaczej pieczęć zamienia się w egzamin.
console.log('  ciągłość styku przy zbliżaniu ręki:');
let poprz = 0, maxSkok = 0;
for (let i = 0; i <= 40; i++) {
  const d = 0.30 - i * 0.0075;
  const v = styk(cialo({ 15: [-0.20 + d, -0.55] }), 15, 11, 0.40, 0.15, 0.60);
  maxSkok = Math.max(maxSkok, Math.abs(v - poprz)); poprz = v;
}
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

console.log('  nadBarkami (dodatnie w górę, w szerokościach barków):');
spr('nadgarstek nad barkami dodatni', nadBarkami(cialo({ 15: [0, -0.95] }), 15, 0.40) > 0.9);
spr('nadgarstek pod barkami ujemny', nadBarkami(cialo({ 15: [0, -0.15] }), 15, 0.40) < -0.9);
spr('nadgarstek na linii barków ~0', Math.abs(nadBarkami(cialo({ 15: [0, -0.55] }), 15, 0.40)) < 0.01);

console.log('  kąt w łokciu:');
// Ramię pionowo w dół, przedramię pionowo w dół = ręka wyprostowana.
const prosta = cialo({ 11: [-0.20, -0.55], 13: [-0.20, -0.25], 15: [-0.20, 0.05] });
spr(`wyprostowana ręka ~180° (${katWLokciu(prosta, 11, 13, 15).toFixed(0)}°)`,
    katWLokciu(prosta, 11, 13, 15) > 170);
// Przedramię zawrócone w górę = łokieć złożony.
const zgieta = cialo({ 11: [-0.20, -0.55], 13: [-0.20, -0.25], 15: [-0.20, -0.55] });
spr(`złożona ręka ~0° (${katWLokciu(zgieta, 11, 13, 15).toFixed(0)}°)`,
    katWLokciu(zgieta, 11, 13, 15) < 15);
// Kąt prosty.
const prosty = cialo({ 11: [-0.20, -0.55], 13: [-0.20, -0.25], 15: [0.10, -0.25] });
spr(`kąt prosty ~90° (${katWLokciu(prosty, 11, 13, 15).toFixed(0)}°)`,
    Math.abs(katWLokciu(prosty, 11, 13, 15) - 90) < 5);
spr('zdegenerowany odcinek nie daje NaN',
    Number.isFinite(katWLokciu(cialo({ 11: [0, 0], 13: [0, 0], 15: [0, 0] }), 11, 13, 15)));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-styk.mjs`
Expected: FAIL — `Cannot find module '../js/znaki/styk.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// js/znaki/styk.js
/**
 * Prymitywy geometrii STYKU - wspólne dla czterech pieczęci z pozy.
 *
 * Teza całej piątej generacji znaków: pieczęć to PUNKT DOTYKU, nie układ
 * kończyn. Styk jest rzadki w tańcu, gracz czuje go bez patrzenia na ekran
 * i trafia wysoko powyżej progu, więc składa się szybko - a to ostatnie jest
 * mechanizmem, dzięki któremu kombosy mieszczą się w oknie czasowym.
 *
 * STYK NIE JEST WARUNKIEM BINARNYM, mimo że fizycznie na to wygląda.
 * Reguła nadrzędna (GEMINI.md §2) obowiązuje: pięść BLISKO barku daje
 * słabszy, ale niezerowy wynik. Binarny styk zamieniłby pieczęć w egzamin
 * na precyzję, czyli dokładnie w to, czego ten projekt się pozbywa.
 *
 * ODLEGŁOŚCI SĄ ODPORNE NA LUSTRO. Płótno ma scaleX(-1) (GEMINI.md:88),
 * przez co każdy warunek czytający KOLEJNOŚĆ x daje wynik odwrotny w odbiciu -
 * stąd formuła ze znakiem iloczynu w starym weles.js. Odległość między dwoma
 * landmarkami jest niezmiennikiem odbicia, a MediaPipe etykietuje strony
 * CIAŁA, nie strony obrazu, więc "nadgarstek przy przeciwnym barku" nie
 * potrzebuje żadnej ostrożności lustrzanej.
 */
import { BARK_L, BARK_P, poziom, rampa } from './postawa.js';

/** Odległość dwóch punktów pozy w metrach, w pełnym 3D. */
export function odleglosc(wl, i, j) {
    const a = wl?.[i], b = wl?.[j];
    if (!a || !b) return Infinity;
    const d = Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
    return Number.isFinite(d) ? d : Infinity;
}

/**
 * Ciągła miara styku: 1 przy dotyku, 0 przy odległości `zero`.
 *
 * @param {number} pelny  odległość (w szerokościach barków), przy której wynik = 1
 * @param {number} zero   odległość, przy której wynik = 0. Musi być > pelny.
 */
export function styk(wl, i, j, skala, pelny, zero) {
    const d = odleglosc(wl, i, j) / (skala > 1e-6 ? skala : 1e-6);
    if (!Number.isFinite(d)) return 0;
    return 1 - rampa(d, pelny, zero);
}

/**
 * Wysokość punktu NAD linią barków, w szerokościach barków.
 * Dodatnia w górę, mimo że oś Y worldLandmarks rośnie w dół - znak jest
 * odwrócony tutaj, raz, żeby cztery znaki nie musiały o tym pamiętać.
 *
 * Odniesieniem są BARKI, nigdy biodra: kamera laptopa nie daje kadru
 * z biodrami i zapasem (mokoszSplot.js:5-11).
 */
export function nadBarkami(wl, i, skala) {
    const p = wl?.[i];
    if (!p || !Number.isFinite(p.y)) return 0;
    const yBarkow = poziom(wl, BARK_L, BARK_P);
    const v = (yBarkow - p.y) / (skala > 1e-6 ? skala : 1e-6);
    return Number.isFinite(v) ? v : 0;
}

/**
 * Kąt w łokciu w stopniach: 180 = ręka wyprostowana, 0 = złożona na pół.
 *
 * To jest jedyny warunek, który odróżnia pozę błyskawicy od zwykłego
 * "ręka w górę, ręka w dół" - a to drugie w tańcu zdarza się co chwilę.
 */
export function katWLokciu(wl, bark, lokiec, nadg) {
    const a = wl?.[bark], b = wl?.[lokiec], c = wl?.[nadg];
    if (!a || !b || !c) return 180;

    const u = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
    const v = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
    const du = Math.hypot(u.x, u.y, u.z), dv = Math.hypot(v.x, v.y, v.z);
    // Zdegenerowany odcinek (punkty w jednym miejscu) - traktujemy jak rękę
    // wyprostowaną, czyli jak BRAK gestu. Zero dawałoby fałszywe trafienie.
    if (!(du > 1e-6) || !(dv > 1e-6)) return 180;

    const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / (du * dv);
    const kat = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    return Number.isFinite(kat) ? kat : 180;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-styk.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/znaki/styk.js tools/test-styk.mjs
git commit -m "Prymitywy styku: odległość 3D, ciągła miara dotyku, wysokość, kąt w łokciu"
```

---

### Task 6: Narzędzie liczące progi z nagrań

**Files:**
- Create: `tools/progi.mjs`
- Create (generowany): `js/znaki/progi-zmierzone.js`

**Interfaces:**
- Consumes: pliki JSON z `tools/probki/`, `odtworzKlatke` z Task 2, `skalaCiala`/`resetSkali`/`aktualizujSkale` z Task 4, `odleglosc`/`nadBarkami` z Task 5. (`obrotBokiem` i `katWLokciu` NIE ISTNIEJĄ — obie wycięte, bo po przeprojektowaniu błyskawicy straciły konsumentów.)
- Produces: `js/znaki/progi-zmierzone.js` eksportujący `PROGI` — obiekt `{ ziemia: {...}, powietrze: {...}, woda: {...}, blyskawica: {...} }`. Nazwy pól ustalone w Step 3 poniżej i używane wprost przez Task 7-10.

**Dlaczego generator, a nie ręczne wklejanie:** przepisanie liczb z konsoli do czterech plików jest krokiem, na którym rodzi się `ZGADNIĘTE` — ktoś zaokrągli, ktoś poprawi „na oko". Generowany plik niesie w nagłówku, z której próbki i z którego percentyla pochodzi każda liczba, więc prowenienacja jest maszynowa, a strojenie sprowadza się do zmiany reguły, nie liczby.

- [ ] **Step 1: Napisz narzędzie**

```javascript
// tools/progi.mjs
/**
 * Progi pieczęci wyliczone z NAGRAŃ ŻYWEGO CIAŁA.
 *
 *   node tools/progi.mjs --raport     # co jest w próbkach, bez zapisu
 *   node tools/progi.mjs --zapisz     # generuje js/znaki/progi-zmierzone.js
 *
 * POWÓD ISTNIENIA: cztery poprzednie generacje znaków weszły do gry ze
 * stałymi oznaczonymi ZGADNIĘTE i żadna nie została zmierzona na ciele
 * gracza. To narzędzie zamienia nagranie w liczby, a strojenie - w zmianę
 * REGUŁY wyprowadzania, nie w poprawianie liczby ręcznie.
 *
 * ================== REGUŁA WYPROWADZANIA ==================
 *
 * Dla miary, która przy poprawnej pozie jest MAŁA (każdy styk):
 *
 *   PELNY = percentyl 75 z powtórzeń tej pozy
 *       -> trzy czwarte Twoich wykonań dostaje pełny wynik
 *   ZERO  = percentyl 10 z próbki TAŃCA dla tej samej miary
 *       -> wynik gaśnie, zanim wejdzie w obszar, w którym żyje taniec
 *
 * Dla miary, która przy poprawnej pozie jest DUŻA (wysokości, kąt rozwarcia):
 * te same percentyle w odwrotnych rolach.
 *
 * Jeśli PELNY >= ZERO, obszary pozy i tańca ZACHODZĄ NA SIEBIE - żaden próg
 * ich nie rozdzieli. To jest wynik, nie usterka narzędzia: znaczy, że poza
 * jest za blisko naturalnego tańca i trzeba zmienić POZĘ, nie liczbę.
 * Narzędzie krzyczy o tym wprost.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { skalaCiala, aktualizujSkale, resetSkali, widoczne,
         BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P } from '../js/znaki/postawa.js';
import { odleglosc, nadBarkami } from '../js/znaki/styk.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const WYJSCIE = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'znaki', 'progi-zmierzone.js');

/**
 * Miary liczone z każdej klatki. Nazwa miary staje się nazwą pary progów
 * w wygenerowanym pliku: `styk` -> `STYK_PELNY` / `STYK_ZERO`.
 */
const MIARY = {
    // ================== ZESTAW PO POMIARZE ==================
    // Ten zestaw NIE jest tym, co pierwotnie opisywał spec. Każda różnica
    // wynika z nagrania na żywym ciele (tools/probki/, 2026-09-03) i jest
    // uzasadniona w sekcji "Poprawki po pomiarze" przy zadaniach 7-10.
    // Miary, które nie rozdzielały pozy od tańca, zostały USUNIĘTE, a nie
    // przestrojone - próg nie naprawia warunku mierzącego nie to, co trzeba.

    // ogień: jedyna nowa miara to WYSOKOŚĆ. Warunki dłoni (palce, opuszki,
    // rozstaw nadgarstków) zostają w swarogDlon.js ze swoimi stałymi.
    // Bez wysokości ogień zapalał się na misce wody częściej niż na własnej
    // piramidce - 179/322 klatek wobec 107/299 (zmierzone).
    // UWAGA: wysokość ognia to PASMO, nie rampa - jedyna taka miara w tym
    // narzędziu. Sama podłoga nie wystarcza, bo piramidka NAD GŁOWĄ (iglica
    // błyskawicy) też jest "wysoko": zmierzono, że przy samej podłodze ogień
    // zapala się na 223 z 333 klatek iglicy. Pasmo zeruje to całkowicie
    // i przy okazji usuwa 8 przypadkowych klatek tańca.
    //
    // Cztery progi pasma, wszystkie z danych, żaden z sufitu:
    //   DOL_PELNY  = p05 próbek ognia        GORA_PELNY = p95 próbek ognia
    //   DOL_ZERO   = p50 próbek WODY         GORA_ZERO  = p25 próbek BŁYSKAWICY
    // Czyli: ogień milczy dokładnie tam, gdzie mieszkają jego dwaj sąsiedzi
    // na tej osi. To uogólnienie zasady "rozdziela oś, której nie używa nic
    // innego" - tu oś jest wspólna, więc granice bierzemy od sąsiadów.
    ogien: (wl, s) => ({
        wysokosc: Math.max(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s))
    }),

    // ziemia: sam styk pięści z przeciwnym barkiem. Pierwotny warunek
    // "nadgarstki na wysokości barków lub wyżej" USUNIĘTY: zmierzono, że
    // przy pięściach na barkach nadgarstki leżą 0.5 szerokości barków PONIŻEJ
    // linii barków, a taniec sięga wyżej (p90 -0.21). Warunek mierzył
    // odwrotność tego, co miał mierzyć. Sam styk daje 0.99 we własnym kroku
    // i 0 klatek tańca nad progiem.
    ziemia: (wl, s) => ({
        styk: Math.max(odleglosc(wl, NADG_L, BARK_P), odleglosc(wl, NADG_P, BARK_L)) / s
    }),

    // powietrze: styk łokci plus wysokość nadgarstków. Pierwotny warunek
    // "rozchylenie" (nadgarstki szerzej niż łokcie) USUNIĘTY: zmierzono
    // wartość UJEMNĄ (-0.43), czyli gracz trzyma nadgarstki BLIŻEJ siebie
    // niż łokcie - dokładnie odwrotnie, niż zakładał projekt.
    powietrze: (wl, s) => ({
        styk: odleglosc(wl, LOKIEC_L, LOKIEC_P) / s,
        wysokosc: Math.min(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s))
    }),

    // woda: styk nadgarstków, głębokość i kształt miski. Warunek miski
    // ZOSTAJE - zmierzono, że zmniejsza wyciek do tańca z 37 do 14 klatek.
    woda: (wl, s) => ({
        styk: odleglosc(wl, NADG_L, NADG_P) / s,
        glebokosc: -Math.max(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s)),
        miska: (odleglosc(wl, LOKIEC_L, LOKIEC_P) - odleglosc(wl, NADG_L, NADG_P)) / s
    }),

    // błyskawica: DWIE miary, obie z pozy. Trzecia poza tej pieczęci -
    // dwie poprzednie (zygzak bokiem, chwyt za łokieć) padły na pomiarze.
    // Oś nośna to WYSOKOŚĆ ŁOKCI: +0.13 w tej pozie wobec -0.65..-0.72
    // u wszystkich pozostałych pieczęci i -0.70 w tańcu. Piramidka nad głową
    // jest kwalifikatorem z dłoni i NIE MA TU SWOJEGO PROGU - liczy ją
    // swarogDlon ze swoimi stałymi.
    blyskawica: (wl, s) => ({
        wysNadg: Math.min(nadBarkami(wl, NADG_L, s), nadBarkami(wl, NADG_P, s)),
        wysLok: Math.min(nadBarkami(wl, LOKIEC_L, s), nadBarkami(wl, LOKIEC_P, s))
    })
};

/** Które miary rosną przy poprawnej pozie (a nie maleją). */
const ROSNACE = new Set(['wysokosc', 'glebokosc', 'miska', 'wysNadg', 'wysLok']);

function wczytajProbki() {
    let pliki;
    try {
        pliki = readdirSync(KATALOG).filter(f => f.endsWith('.json'));
    } catch {
        console.error(`BRAK KATALOGU ${KATALOG}. Najpierw nagraj sesję (klawisz Z w grze).`);
        process.exit(1);
    }
    if (!pliki.length) {
        console.error(`BRAK NAGRAŃ w ${KATALOG}. Najpierw nagraj sesję (klawisz Z w grze).`);
        process.exit(1);
    }
    const kroki = {};
    for (const f of pliki) {
        const dane = JSON.parse(readFileSync(join(KATALOG, f), 'utf8'));
        for (const [etykieta, klatki] of Object.entries(dane.kroki)) {
            (kroki[etykieta] ??= []).push(...klatki);
        }
    }
    return kroki;
}

/** Klatki jednego powtórzenia -> tablica zestawów miar. Pomija pierwsze 0.5 s. */
function zmierz(klatki, funkcja) {
    resetSkali();
    const wynik = [];
    let czas = 0;
    for (const zapisana of klatki) {
        const frame = odtworzKlatke(zapisana);
        czas += frame.dt;
        const wl = frame.pose?.worldLandmarks;
        if (!wl || !widoczne(wl, [BARK_L, BARK_P])) continue;
        aktualizujSkale(wl, frame.dt);
        // Pierwsze pół sekundy to dochodzenie do pozy, nie poza.
        if (czas < 0.5) continue;
        if (!widoczne(wl, [NADG_L, NADG_P, LOKIEC_L, LOKIEC_P])) continue;
        wynik.push(funkcja(wl, skalaCiala(wl)));
    }
    return wynik;
}

const percentyl = (tab, p) => {
    if (!tab.length) return NaN;
    const s = [...tab].sort((a, b) => a - b);
    return s[Math.max(0, Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1))))];
};

function zbierz(kroki, prefiks, funkcja) {
    const etykiety = Object.keys(kroki).filter(e => e.startsWith(prefiks + '#'));
    const proby = etykiety.map(e => ({ etykieta: e, miary: zmierz(kroki[e], funkcja) }));
    const wszystkie = {};
    for (const { miary } of proby) {
        for (const m of miary) {
            for (const [k, v] of Object.entries(m)) {
                if (Number.isFinite(v)) (wszystkie[k] ??= []).push(v);
            }
        }
    }
    return { proby, wszystkie };
}

const kroki = wczytajProbki();
const zapisz = process.argv.includes('--zapisz');

console.log('=== CO JEST W PRÓBKACH ===');
for (const [etykieta, klatki] of Object.entries(kroki).sort()) {
    const zPoza = klatki.filter(k => k.poza).length;
    const udzial = klatki.length ? zPoza / klatki.length : 0;
    const flaga = udzial < 0.8 ? '  ⚠ MAŁO KLATEK Z POZĄ - rozważ dogranie' : '';
    console.log(`  ${etykieta.padEnd(38)} ${String(klatki.length).padStart(4)} kl.  poza ${(udzial * 100).toFixed(0)}%${flaga}`);
}

const linie = [];
let konflikt = false;

console.log('\n=== PROGI ===');
for (const [poza, funkcja] of Object.entries(MIARY)) {
    const { wszystkie } = zbierz(kroki, poza, funkcja);
    const taniec = zbierz(kroki, 'taniec', funkcja).wszystkie;
    if (!Object.keys(wszystkie).length) {
        console.log(`\n${poza.toUpperCase()}: BRAK PRÓBEK - nagraj ten krok.`);
        konflikt = true;
        continue;
    }
    console.log(`\n${poza.toUpperCase()}:`);
    const pola = [];
    for (const [miara, wartosci] of Object.entries(wszystkie)) {
        const rosnaca = ROSNACE.has(miara);
        const pelny = percentyl(wartosci, rosnaca ? 25 : 75);
        const zero = percentyl(taniec[miara] ?? [], rosnaca ? 90 : 10);
        const zle = rosnaca ? !(pelny > zero) : !(pelny < zero);
        if (zle) konflikt = true;

        // LICZBA PRÓBEK jest częścią wyniku, nie ozdobą. `zbierz` odfiltrowuje
        // wartości nieskończone (brakujący punkt daje Infinity z odleglosc(),
        // a różnica dwóch takich - NaN), więc miara może po cichu zostać
        // z garstką próbek. Percentyl z krótkiej tablicy to szum, a zły próg
        // wyliczony z szumu wygląda dokładnie tak samo jak dobry.
        const nPoza = wartosci.length, nTaniec = (taniec[miara] ?? []).length;
        const zaMalo = nTaniec < 300;
        if (zaMalo) konflikt = true;

        console.log(`  ${miara.padEnd(16)} poza n=${String(nPoza).padStart(4)} p${rosnaca ? 25 : 75} = ${pelny.toFixed(3)}` +
                    `   taniec n=${String(nTaniec).padStart(4)} p${rosnaca ? 90 : 10} = ${Number.isFinite(zero) ? zero.toFixed(3) : 'brak'}` +
                    `${zle ? '   ⚠ OBSZARY ZACHODZĄ - zmień POZĘ, nie liczbę' : ''}` +
                    `${zaMalo ? '   ⚠ ZA MAŁO KLATEK TAŃCA - dograj krok 8' : ''}`);
        const N = miara.toUpperCase();
        pola.push(`        ${N}_PELNY: ${pelny.toFixed(3)},`);
        pola.push(`        ${N}_ZERO: ${Number.isFinite(zero) ? zero.toFixed(3) : (rosnaca ? 0 : 99)},`);
    }
    linie.push(`    ${poza}: {\n${pola.join('\n')}\n    },`);
}

if (!zapisz) {
    console.log('\n(raport - nic nie zapisano; uruchom z --zapisz, żeby wygenerować plik)');
    process.exit(konflikt ? 1 : 0);
}

const tresc = `/**
 * PLIK GENEROWANY - nie edytuj ręcznie.
 *
 *   node tools/progi.mjs --zapisz
 *
 * Każda liczba pochodzi z nagrania żywego ciała w tools/probki/, nie
 * z wyobraźni. Reguła wyprowadzania i jej uzasadnienie: tools/progi.mjs.
 * Strojenie = zmiana reguły albo dogranie próbki, NIGDY ręczna poprawka
 * liczby tutaj - poprawiona ręcznie liczba jest znowu ZGADNIĘTA.
 *
 * Wygenerowano: ${new Date().toISOString()}
 * Powtórzenia w materiale: ${Object.keys(kroki).length}
 */
export const PROGI = {
${linie.join('\n')}
};
`;
writeFileSync(WYJSCIE, tresc);
console.log(`\nZapisano ${WYJSCIE}`);
process.exit(konflikt ? 1 : 0);
```

- [ ] **Step 2: Uruchom raport na nagraniu**

Run: `node tools/progi.mjs --raport`
Expected: lista powtórzeń z liczbą klatek i udziałem klatek z pozą, potem progi dla czterech póz — każda miara z **liczbą próbek** (`poza n=`, `taniec n=`) obok percentyli.

Dwa ostrzeżenia zatrzymują pracę:
- **`OBSZARY ZACHODZĄ`** — poza jest za blisko naturalnego tańca. Zgłoś właścicielowi projektu; zmienia się wtedy **poza**, nie próg. To jest wynik, po który cała ta faza istnieje.
- **`ZA MAŁO KLATEK TAŃCA`** — miara ma mniej niż 300 klatek tańca po odfiltrowaniu wartości nieskończonych, więc jej percentyl jest szumem. Dograj krok 8 (klawisz `8` w grze).

- [ ] **Step 3: Wygeneruj plik progów**

Run: `node tools/progi.mjs --zapisz`
Expected: `Zapisano .../js/znaki/progi-zmierzone.js`

Sprawdź zawartość: `cat js/znaki/progi-zmierzone.js`. Powinna zawierać cztery klucze (`ziemia`, `powietrze`, `woda`, `blyskawica`), a w nich pary `*_PELNY` / `*_ZERO` dla miar wypisanych w raporcie.

- [ ] **Step 4: Commit**

```bash
git add tools/progi.mjs js/znaki/progi-zmierzone.js
git commit -m "Progi liczone z nagrań: narzędzie i wygenerowany plik stałych"
```

---

### Task 7: Ziemia — pięści na barkach

**Files:**
- Modify: `js/znaki/weles.js` (przepisany w całości)
- Modify: `tools/test-postawy.mjs` (przepisany w całości — patrz Step 1)

**Interfaces:**
- Consumes: `PROGI.ziemia` z Task 6; `styk`, `nadBarkami` z Task 5; `skalaCiala`, `widoczne`, `rampa` z Task 4; `zwinieta`, `pelnaDlon` z `dlon.js`.
- Produces: `weles` — obiekt znaku z `id: 'weles'`, `wymaga: 'pose'`, `score(frame)`, `skladniki(frame)`.

- [ ] **Step 1: Przepisz `tools/test-postawy.mjs`**

Stary plik testuje `perun`/`mokosz`/`weles` w dawnych znaczeniach i po tym zadaniu jest bezużyteczny. Zastąp go w całości — kolejne zadania dopisują do niego sekcje.

```javascript
// tools/test-postawy.mjs
/**
 * Pięć pieczęci styku: WŁASNOŚCI, nie progi.
 *
 *   node tools/test-postawy.mjs
 *
 * PODZIAŁ PRACY MIĘDZY TESTAMI JEST CELOWY. Ten plik chodzi po danych
 * SYNTETYCZNYCH i sprawdza własności, które muszą zachodzić niezależnie od
 * tego, jak wystrojone są progi: ciągłość wyniku, niezmienniczość na odbicie
 * lustrzane, minimum zamiast średniej, zero przy braku danych.
 *
 * PROGI sprawdza wyłącznie tools/test-rozdzielnosc.mjs, na nagraniach
 * z żywego ciała. Syntetyczna poza nigdy nie dowodzi, że próg jest dobry -
 * dowodzi tylko, że wzór się nie wywraca.
 *
 * worldLandmarks: metry, początek w środku bioder, oś Y W DÓŁ.
 * Barki mają y ujemne (~-0.55), dłoń opuszczona poniżej bioder - dodatnie.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { resetSkali } from '../js/znaki/postawa.js';
import { weles } from '../js/znaki/weles.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/**
 * Sylwetka odniesienia: barki 0.40 m rozstawu, 0.55 m nad biodrami.
 * Nadgarstki i łokcie podaje wywołujący - to one niosą gest.
 */
export function cialo({ nadgL, nadgP, lokL, lokP, vis = 1, obrot = 0 }) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: vis }));
  const p = (x, y, z = 0) => ({ x, y, z, visibility: vis });
  const a = obrot * Math.PI / 180;
  wl[11] = p(-0.20 * Math.cos(a), -0.55, -0.20 * Math.sin(a));
  wl[12] = p(0.20 * Math.cos(a), -0.55, 0.20 * Math.sin(a));
  wl[23] = p(-0.12, 0.00); wl[24] = p(0.12, 0.00);
  wl[15] = p(nadgL[0], nadgL[1], nadgL[2] ?? 0);
  wl[16] = p(nadgP[0], nadgP[1], nadgP[2] ?? 0);
  wl[13] = p(lokL[0], lokL[1], lokL[2] ?? 0);
  wl[14] = p(lokP[0], lokP[1], lokP[2] ?? 0);
  return wl;
}

const rej = new ZnakRegistry();
rej.zarejestruj(weles);
export const ocen = (wl, hands = []) => {
  resetSkali();
  return rej.ocen({ hands, pose: { landmarks: [], worldLandmarks: wl }, width: 1920, height: 1080, dt: 1 / 60, now: 0 });
};

/** Dłoń zaciśnięta w pięść: wszystkie opuszki blisko nadgarstka. */
export function piesc() {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.50, y: 0.50, z: 0 }));
  lm[0] = { x: 0.50, y: 0.55, z: 0 };                       // nadgarstek
  lm[5] = { x: 0.50, y: 0.50, z: 0 }; lm[17] = { x: 0.54, y: 0.50, z: 0 };
  for (const i of [4, 8, 12, 16, 20]) lm[i] = { x: 0.51, y: 0.52, z: 0 };
  return { handedness: 'Left', landmarks: lm };
}

// ZIEMIA: pięści na przeciwnych barkach. Nadgarstek LEWY przy barku PRAWYM.
const ZIEMIA = cialo({
  nadgL: [0.20, -0.55], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30]
});

console.log('ZIEMIA:');
const z = ocen(ZIEMIA, [piesc(), piesc()]);
spr(`pięści na barkach zapalają ziemię (${z.weles.toFixed(2)})`, z.weles > 0.7);

const opuszczone = ocen(cialo({
  nadgL: [-0.22, 0.30], lokL: [-0.21, -0.15],
  nadgP: [0.22, 0.30], lokP: [0.21, -0.15]
}), [piesc(), piesc()]);
spr(`ręce opuszczone NIE zapalają ziemi (${opuszczone.weles.toFixed(2)})`, opuszczone.weles < 0.2);

// Ręce skrzyżowane NISKO, na wysokości pasa - to nie ziemia (dawny Splot).
const nisko = ocen(cialo({
  nadgL: [0.15, -0.15], lokL: [-0.25, -0.20],
  nadgP: [-0.15, -0.15], lokP: [0.25, -0.20]
}), [piesc(), piesc()]);
spr(`ręce skrzyżowane nisko NIE zapalają ziemi (${nisko.weles.toFixed(2)})`, nisko.weles < 0.5);

console.log('\nLUSTRO:');
// Odległości są niezmiennikiem odbicia - to jest cały powód, dla którego
// nowy weles.js nie potrzebuje formuły ze znakiem iloczynu (stary weles.js:46).
const odbij = (wl) => wl.map(p => ({ ...p, x: -p.x }));
const zL = ocen(odbij(ZIEMIA), [piesc(), piesc()]);
spr(`odbita ziemia = ta sama (${zL.weles.toFixed(2)})`, Math.abs(zL.weles - z.weles) < 0.02);

console.log('\nBRAK DANYCH:');
const slabe = ocen(cialo({
  nadgL: [0.20, -0.55], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30], vis: 0.2
}), [piesc(), piesc()]);
spr(`punkty niewidoczne -> 0, nie śmieć (${slabe.weles.toFixed(2)})`, slabe.weles === 0);

const zepsute = ocen(cialo({
  nadgL: [NaN, NaN], lokL: [-0.10, -0.30],
  nadgP: [-0.20, -0.55], lokP: [0.10, -0.30]
}), [piesc(), piesc()]);
spr(`NaN w punkcie -> 0 (${zepsute.weles})`, zepsute.weles === 0);

// REGUŁA NADRZĘDNA: brak dłoni w kadrze NIE KARZE. Kwalifikator pięści jest
// miękki - ciało prowadzi, dłonie doprecyzowują.
const bezDloni = ocen(ZIEMIA, []);
spr(`brak dłoni nie zeruje ziemi (${bezDloni.weles.toFixed(2)})`, bezDloni.weles > 0.5);

console.log('\nCIĄGŁOŚĆ przy przykładaniu pięści do barków:');
let poprz = 0, maxSkok = 0;
const poziomy = [];
for (let i = 0; i <= 60; i++) {
  const d = 0.45 - i * 0.0075;   // pięści zbliżają się do przeciwnych barków
  const s = ocen(cialo({
    nadgL: [0.20 - d, -0.55], lokL: [-0.10, -0.30],
    nadgP: [-0.20 + d, -0.55], lokP: [0.10, -0.30]
  }), [piesc(), piesc()]).weles;
  maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
  if (i % 12 === 0) poziomy.push(`${d.toFixed(2)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-postawy.mjs`
Expected: FAIL — stary `weles` liczy skrzyżowanie na wysokości piersi, więc pozycja „pięści na barkach" nie przebija 0.7, a `resetSkali` nie istnieje w imporcie starego pliku

- [ ] **Step 3: Przepisz `js/znaki/weles.js`**

```javascript
/**
 * Ziemia - Weles: podziemie, bydło, brama.
 *
 * Ramiona skrzyżowane na krzyż, każda ZACIŚNIĘTA PIĘŚĆ dotyka PRZECIWNEGO
 * barku. Punkt styku: nadgarstek o bark.
 *
 * DLACZEGO BEZ FORMUŁY ZE ZNAKIEM ILOCZYNU. Poprzednia wersja tego pliku
 * liczyła skrzyżowanie jako znak iloczynu różnic x, bo sprawdzanie samej
 * kolejności x dawało wynik odwrotny w lustrze płótna (scaleX(-1),
 * GEMINI.md:88). Ta ostrożność jest tu niepotrzebna: ODLEGŁOŚĆ między dwoma
 * landmarkami jest niezmiennikiem odbicia, a MediaPipe etykietuje strony
 * CIAŁA, nie strony obrazu. Dwa warunki styku (lewy nadgarstek przy prawym
 * barku i odwrotnie) IMPLIKUJĄ skrzyżowanie i robią to bez ani jednej
 * operacji wrażliwej na lustro. Cała klasa błędów znika razem z formułą.
 *
 * ================== POPRAWKA PO POMIARZE ==================
 *
 * Pierwotny projekt miał trzeci warunek: "oba nadgarstki na wysokości linii
 * barków lub wyżej". USUNIĘTY po nagraniu z żywego ciała. Zmierzono, że przy
 * pięściach na barkach nadgarstki leżą 0.5 szerokości barków PONIŻEJ linii
 * barków (landmark nadgarstka siedzi w stawie, więc przy pięści na barku
 * wypada nisko), a swobodny taniec sięga wyżej - p90 wynosi -0.21. Warunek
 * mierzył więc odwrotność tego, co miał mierzyć.
 *
 * Sam styk wystarcza z zapasem: 0.99 wyniku we własnym kroku i ZERO z 763
 * klatek tańca nad progiem składania.
 */
import { NADG_L, NADG_P, BARK_L, BARK_P, widoczne, skalaCiala, rampa } from './postawa.js';
import { styk, nadBarkami } from './styk.js';
import { zwinieta, pelnaDlon } from './dlon.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P];
const P = PROGI.ziemia;

// Brak dłoni w kadrze NIE KARZE (GEMINI.md §2). Ciało prowadzi, dłonie
// doprecyzowują - ten sam wzorzec i ta sama wartość co w dawnym
// runy/definicje.js:25, gdzie sprawdził się w praktyce.
const WAGA_BEZ_DLONI = 0.7;

export const weles = {
    id: 'weles',
    nazwa: 'Weles (ziemia)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        // Minimum, nie średnia: pieczęć jest AND-em warunków, a najsłabszy
        // z nich ma widocznie hamować - inaczej dwa dobre warunki maskują
        // trzeci zupełnie niespełniony.
        return Math.min(sk.stykL, sk.stykP, sk.piesci);
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return skladnikiZ(frame);
    }
};

/**
 * Warunki liczone przez FUNKCJĘ MODUŁOWĄ, nie przez `this` w score().
 * Ten sam wzorzec co mokoszSplot.js:53 - dzięki niemu `score` i `skladniki`
 * działają także wtedy, gdy ktoś je zdestrukturyzuje z obiektu znaku.
 */
function skladnikiZ(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        const skala = skalaCiala(wl);

        return {
            // Lewy nadgarstek przy PRAWYM barku i odwrotnie - to jest samo
            // skrzyżowanie, wyrażone odległościami.
            stykL: styk(wl, NADG_L, BARK_P, skala, P.STYK_PELNY, P.STYK_ZERO),
            stykP: styk(wl, NADG_P, BARK_L, skala, P.STYK_PELNY, P.STYK_ZERO),
            piesci: piesci(frame)
        };
}

/** Miękki kwalifikator: średnie zwinięcie widocznych dłoni, bez kary za brak. */
function piesci(frame) {
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (!dlonie.length) return WAGA_BEZ_DLONI;
    const suma = dlonie.reduce((acc, d) => acc + zwinieta(d.landmarks), 0);
    const srednia = suma / dlonie.length;
    // Podłoga na WAGA_BEZ_DLONI: rozprostowana dłoń osłabia pieczęć, ale
    // nigdy nie zeruje jej bardziej, niż zrobiłby to brak dłoni w kadrze.
    // Inaczej wejście dłoni w kadr byłoby KARĄ względem stania poza nim.
    return Math.max(WAGA_BEZ_DLONI * srednia, Math.min(WAGA_BEZ_DLONI, srednia));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-postawy.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/znaki/weles.js tools/test-postawy.mjs
git commit -m "Ziemia: pięści skrzyżowane na barkach, styk zamiast kolejności x"
```

---

### Task 8: Powietrze — łokcie razem

**Files:**
- Modify: `js/znaki/stribog.js` (przepisany w całości)
- Modify: `tools/test-postawy.mjs` (dopisanie sekcji)

**Interfaces:**
- Consumes: `PROGI.powietrze`; `styk`, `nadBarkami`, `odleglosc` z Task 5; `cialo`, `ocen` z `test-postawy.mjs`.
- Produces: `stribog` — `id: 'stribog'`, `wymaga: 'pose'`, `score(frame)`, `skladniki(frame)`.

- [ ] **Step 1: Dopisz test przed `process.exit` w `tools/test-postawy.mjs`**

Zmień import i rejestrację na górze pliku:

```javascript
import { stribog } from '../js/znaki/stribog.js';
// ...
rej.zarejestruj(weles); rej.zarejestruj(stribog);
```

Dopisz sekcję:

```javascript
// POWIETRZE: łokcie razem przed mostkiem, przedramiona pionowo w górę,
// nadgarstki nad barkami i rozchylone szerzej niż łokcie.
const POWIETRZE = cialo({
  lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
  nadgL: [-0.22, -0.85], nadgP: [0.22, -0.85]
});

console.log('\nPOWIETRZE:');
const pw = ocen(POWIETRZE);
spr(`łokcie razem, ręce w górę zapalają powietrze (${pw.stribog.toFixed(2)})`, pw.stribog > 0.7);

// Ręce po prostu uniesione, łokcie SZEROKO - w tańcu to się dzieje
// co chwilę i NIE MOŻE zapalać pieczęci. To jest warunek rozchylenia.
const receWGorze = ocen(cialo({
  lokL: [-0.30, -0.55], lokP: [0.30, -0.55],
  nadgL: [-0.35, -0.90], nadgP: [0.35, -0.90]
}));
spr(`ręce w górze z szerokimi łokciami NIE zapalają powietrza (${receWGorze.stribog.toFixed(2)})`,
    receWGorze.stribog < 0.3);

// Łokcie razem, ale ręce w DÓŁ - to bliżej wody niż powietrza.
const lokcieRazemWDol = ocen(cialo({
  lokL: [-0.04, -0.30], lokP: [0.04, -0.30],
  nadgL: [-0.10, -0.05], nadgP: [0.10, -0.05]
}));
spr(`łokcie razem, ręce w dół NIE zapalają powietrza (${lokcieRazemWDol.stribog.toFixed(2)})`,
    lokcieRazemWDol.stribog < 0.3);

spr(`powietrze NIE zapala ziemi (${pw.weles.toFixed(2)})`, pw.weles < 0.3);
spr(`ziemia NIE zapala powietrza (${z.stribog.toFixed(2)})`, z.stribog < 0.3);

const pwL = ocen(odbij(POWIETRZE));
spr(`odbite powietrze = to samo (${pwL.stribog.toFixed(2)})`, Math.abs(pwL.stribog - pw.stribog) < 0.02);

console.log('\nCIĄGŁOŚĆ przy schodzeniu łokci do siebie:');
let poprzPw = 0, maxSkokPw = 0;
for (let i = 0; i <= 60; i++) {
  const d = 0.30 - i * 0.005;
  const s = ocen(cialo({
    lokL: [-d, -0.30], lokP: [d, -0.30],
    nadgL: [-0.22, -0.85], nadgP: [0.22, -0.85]
  })).stribog;
  maxSkokPw = Math.max(maxSkokPw, Math.abs(s - poprzPw)); poprzPw = s;
}
spr(`największy skok powietrza = ${maxSkokPw.toFixed(3)} (rampa)`, maxSkokPw < 0.15);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-postawy.mjs`
Expected: FAIL — stary `stribog` to postawa „ręce szeroko w bok", nie zapala się na tej pozie

- [ ] **Step 3: Przepisz `js/znaki/stribog.js`**

```javascript
/**
 * Powietrze - Stribog: wiatr, dziad wiatrów.
 *
 * Łokcie stykają się przed mostkiem, przedramiona idą pionowo w górę,
 * dłonie rozchylają się na zewnątrz jak dwie gałęzie z jednego pnia.
 * Punkt styku: łokieć o łokieć.
 *
 * ORTOGONALNY DO OGNIA Z KONSTRUKCJI: piramidka Swaroga to NADGARSTKI
 * ROZSUNIĘTE przy opuszkach razem, powietrze to ŁOKCIE RAZEM przy
 * nadgarstkach rozsuniętych. Te same dwie osie w odwrotnych rolach,
 * więc dwie pieczęcie nie mogą jednocześnie siedzieć wysoko.
 *
 * ================== POPRAWKA PO POMIARZE ==================
 *
 * Pierwotny projekt miał trzeci warunek: "nadgarstki dalej od siebie niż
 * łokcie" (rozchylone dłonie). USUNIĘTY po nagraniu. Zmierzona wartość jest
 * UJEMNA (-0.43): gracz trzyma nadgarstki BLIŻEJ siebie niż łokcie, czyli
 * dokładnie odwrotnie, niż zakładał projekt. Wykonanie na żywym ciele to
 * raczej "dłonie razem przed sobą, łokcie na zewnątrz" niż "gałęzie".
 *
 * Zostają dwa warunki i wystarczają: 0.75 wyniku we własnym kroku, ZERO
 * z 763 klatek tańca nad progiem, maksimum w tańcu 0.12.
 */
import { NADG_L, NADG_P, LOKIEC_L, LOKIEC_P, BARK_L, BARK_P,
         widoczne, skalaCiala, rampa } from './postawa.js';
import { styk, nadBarkami, odleglosc } from './styk.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, LOKIEC_L, LOKIEC_P];
const P = PROGI.powietrze;

export const stribog = {
    id: 'stribog',
    nazwa: 'Stribog (powietrze)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        return Math.min(sk.lokcie, sk.wysokosc);
    },

    skladniki(frame) {
        return skladnikiZ(frame);
    }
};

/** Warunki w funkcji modułowej, nie przez `this` - wzorzec mokoszSplot.js:53. */
function skladnikiZ(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        const skala = skalaCiala(wl);

        return {
            lokcie: styk(wl, LOKIEC_L, LOKIEC_P, skala, P.STYK_PELNY, P.STYK_ZERO),
            // Najniższy z dwóch nadgarstków decyduje - jedna ręka w górze
            // to nie jest ta poza.
            wysokosc: rampa(Math.min(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala)),
                            P.WYSOKOSC_ZERO, P.WYSOKOSC_PELNY),
        };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-postawy.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/znaki/stribog.js tools/test-postawy.mjs
git commit -m "Powietrze: łokcie razem, przedramiona w górę, dłonie rozchylone"
```

---

### Task 9: Woda — miska

**Files:**
- Modify: `js/znaki/mokosz.js` (przepisany w całości)
- Modify: `tools/test-postawy.mjs` (dopisanie sekcji)

**Interfaces:**
- Consumes: `PROGI.woda`; `styk`, `nadBarkami`, `odleglosc`; `ileWyprostowanych`, `pelnaDlon` z `dlon.js`.
- Produces: `mokosz` — `id: 'mokosz'`, `wymaga: 'pose'`, `score(frame)`, `skladniki(frame)`.

- [ ] **Step 1: Dopisz test przed `process.exit` w `tools/test-postawy.mjs`**

Import i rejestracja:

```javascript
import { mokosz } from '../js/znaki/mokosz.js';
// ...
rej.zarejestruj(weles); rej.zarejestruj(stribog); rej.zarejestruj(mokosz);
```

```javascript
// WODA: miska nisko przy pępku - nadgarstki razem, łokcie szerzej.
const WODA = cialo({
  nadgL: [-0.04, -0.12], nadgP: [0.04, -0.12],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
});

console.log('\nWODA:');
const wd = ocen(WODA);
spr(`miska nisko zapala wodę (${wd.mokosz.toFixed(2)})`, wd.mokosz > 0.7);

// Ta sama miska PODNIESIONA pod brodę - to już nie woda.
const miskaWysoko = ocen(cialo({
  nadgL: [-0.04, -0.80], nadgP: [0.04, -0.80],
  lokL: [-0.26, -0.60], lokP: [0.26, -0.60]
}));
spr(`miska pod brodą NIE zapala wody (${miskaWysoko.mokosz.toFixed(2)})`, miskaWysoko.mokosz < 0.3);

// Ręce nisko, ale ROZSTAWIONE - to nie miska.
const receNisko = ocen(cialo({
  nadgL: [-0.30, -0.12], nadgP: [0.30, -0.12],
  lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
}));
spr(`ręce nisko rozstawione NIE zapalają wody (${receNisko.mokosz.toFixed(2)})`, receNisko.mokosz < 0.3);

console.log('\nOGIEŃ vs WODA - para z sekwencji Tęczy:');
// Ogień czyta DŁONIE i w ogóle nie mierzy wysokości; woda czyta POZĘ
// i wymaga nadgarstków nisko. Kolizja rozpada się na osi, której ogień
// nie dotyka - i dlatego przejście ogień->woda w Tęczy nie miga.
spr(`woda NIE zapala powietrza (${wd.stribog.toFixed(2)})`, wd.stribog < 0.3);
spr(`woda NIE zapala ziemi (${wd.weles.toFixed(2)})`, wd.weles < 0.3);
spr(`powietrze NIE zapala wody (${pw.mokosz.toFixed(2)})`, pw.mokosz < 0.3);
spr(`ziemia NIE zapala wody (${z.mokosz.toFixed(2)})`, z.mokosz < 0.3);

const wdL = ocen(odbij(WODA));
spr(`odbita woda = ta sama (${wdL.mokosz.toFixed(2)})`, Math.abs(wdL.mokosz - wd.mokosz) < 0.02);

const wodaBezDloni = ocen(WODA, []);
spr(`brak dłoni nie zeruje wody (${wodaBezDloni.mokosz.toFixed(2)})`, wodaBezDloni.mokosz > 0.5);

console.log('\nCIĄGŁOŚĆ przy schodzeniu nadgarstków do siebie:');
let poprzWd = 0, maxSkokWd = 0;
for (let i = 0; i <= 60; i++) {
  const d = 0.30 - i * 0.005;
  const s = ocen(cialo({
    nadgL: [-d, -0.12], nadgP: [d, -0.12],
    lokL: [-0.26, -0.25], lokP: [0.26, -0.25]
  })).mokosz;
  maxSkokWd = Math.max(maxSkokWd, Math.abs(s - poprzWd)); poprzWd = s;
}
spr(`największy skok wody = ${maxSkokWd.toFixed(3)} (rampa)`, maxSkokWd < 0.15);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-postawy.mjs`
Expected: FAIL — stary `mokosz` wymaga dłoni PONIŻEJ BIODER i rozstawionych szerzej niż barki, czyli dokładnie odwrotnie

- [ ] **Step 3: Przepisz `js/znaki/mokosz.js`**

```javascript
/**
 * Woda - Mokosz: wilgoć, los, przędza.
 *
 * Dłonie złożone w miskę na wysokości pępka: nadgarstki stykają się bokami,
 * przedramiona poziomo, palce rozwarte. Punkt styku: nadgarstek o nadgarstek.
 *
 * ================== DLACZEGO Z POZY, A NIE Z DŁONI ==================
 *
 * Miska czytana z landmarków dłoni miałaby DWIE niezależne wady, obie
 * udokumentowane w tym repo:
 *
 * 1. To jest znany tryb awarii detektora. swarogDlon.js:8-11 notuje pomiar
 *    na żywej dłoni: MediaPipe GUBI JEDNĄ DŁOŃ przy maksymalnym ścisku,
 *    i mówi wprost, że piramidka jest najbezpieczniejsza, bo WYMAGA
 *    rozsuniętych nadgarstków. Miska wymaga nadgarstków stykających się -
 *    czyli dokładnie tego, co gubi detektor. Nadgarstek POZY (15/16) nie
 *    znika, gdy dłonie się stykają.
 *
 * 2. Kolizja z ogniem na tej samej osi. Ogień to zbieżność opuszek mała
 *    PRZY rozstawie nadgarstków dużym; miska z dłoni to te same dwie osie
 *    z odwróconymi wartościami. A sekwencja Tęczy (ogień -> woda ->
 *    powietrze) każe przechodzić ogień->woda ZA KAŻDYM RAZEM. W trakcie
 *    przejścia obie pozy siedzą w połowie skali, któraś przejmuje pierścień,
 *    a przejęcie ZERUJE POSTĘP (pieczecie.js:32-46) - objaw: woda nigdy się
 *    nie składa. Dokładnie awaria, którą łatał dawny hack Splot/Weles.
 *
 * Rozwiązanie: nadgarstki z POZY plus oś, której ogień w ogóle nie mierzy -
 * WYSOKOŚĆ. Kolizja rozpada się na osi, której żadna z dwóch pieczęci
 * z drugą nie dzieli.
 *
 * Wysokość liczona od LINII BARKÓW, nie od bioder (mokoszSplot.js:5-11):
 * kamera laptopa nie daje kadru z biodrami i zapasem.
 */
import { NADG_L, NADG_P, LOKIEC_L, LOKIEC_P, BARK_L, BARK_P,
         widoczne, skalaCiala, rampa } from './postawa.js';
import { styk, nadBarkami, odleglosc } from './styk.js';
import { ileWyprostowanych, pelnaDlon } from './dlon.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, LOKIEC_L, LOKIEC_P];
const P = PROGI.woda;

// Ten sam wzorzec i ta sama wartość co w ziemi - brak dłoni nie karze.
const WAGA_BEZ_DLONI = 0.7;

export const mokosz = {
    id: 'mokosz',
    nazwa: 'Mokosz (woda)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        return Math.min(sk.nadgarstki, sk.glebokosc, sk.miska, sk.palce);
    },

    skladniki(frame) {
        return skladnikiZ(frame);
    }
};

/** Warunki w funkcji modułowej, nie przez `this` - wzorzec mokoszSplot.js:53. */
function skladnikiZ(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        const skala = skalaCiala(wl);

        return {
            nadgarstki: styk(wl, NADG_L, NADG_P, skala, P.STYK_PELNY, P.STYK_ZERO),
            // Głębokość = jak nisko. nadBarkami jest dodatnie W GÓRĘ, więc
            // miska ma je ujemne - stąd minus. Najwyższy z dwóch nadgarstków
            // decyduje: jedna ręka nisko to nie miska.
            glebokosc: rampa(
                -Math.max(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala)),
                P.GLEBOKOSC_ZERO, P.GLEBOKOSC_PELNY),
            // Łokcie szerzej niż nadgarstki - to jest różnica między MISKĄ
            // a rękami po prostu splecionymi przy brzuchu. ZMIERZONE: ten
            // warunek zmniejsza wyciek wody do tańca z 37 do 14 klatek.
            miska: rampa(
                (odleglosc(wl, LOKIEC_L, LOKIEC_P) - odleglosc(wl, NADG_L, NADG_P)) / skala,
                P.MISKA_ZERO, P.MISKA_PELNY),
            palce: palceRozwarte(frame)
        };
}

/** Miękki kwalifikator: palce rozwarte, gdy dłoń widać; bez kary za brak. */
function palceRozwarte(frame) {
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (!dlonie.length) return WAGA_BEZ_DLONI;
    const suma = dlonie.reduce((acc, d) => acc + ileWyprostowanych(d.landmarks) / 5, 0);
    const srednia = suma / dlonie.length;
    // Ta sama podłoga co w weles.js: wejście dłoni w kadr nie może być
    // KARĄ względem stania poza nim.
    return Math.max(WAGA_BEZ_DLONI * srednia, Math.min(WAGA_BEZ_DLONI, srednia));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/test-postawy.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/znaki/mokosz.js tools/test-postawy.mjs
git commit -m "Woda: miska czytana z nadgarstków pozy, rozdzielona z ogniem wysokością"
```

---

### Task 10: Błyskawica (iglica) oraz pasmo wysokości ognia

**Files:**
- Modify: `js/znaki/perun.js` (przepisany w całości)
- Modify: `js/znaki/swarogDlon.js` (dochodzi warunek wysokości z pozy)
- Modify: `tools/test-postawy.mjs` (dopisanie sekcji)

**Interfaces:**
- Consumes: `PROGI.blyskawica` i `PROGI.ogien` z Task 6; `nadBarkami` z Task 5; `pasmo` z `dlon.js`; `swarogDlon` (jako kwalifikator w perun).
- Produces: `perun` — `id: 'perun'`, `wymaga: 'pose'`; `swarogDlon` — bez zmiany sygnatury, ale `wymaga` zmienia się z `'hands'` na `'both'`.

**Dlaczego dwa pliki w jednym zadaniu.** Piramidka nad głową jest kwalifikatorem iglicy, a to znaczy, że gracz robiący błyskawicę wykonuje **ten sam układ dłoni co ogień**. Zmierzone: bez warunku wysokości ogień zapala się na **223 z 333 klatek iglicy**. Tych dwóch zmian nie da się rozdzielić — wprowadzenie jednej bez drugiej zostawia grę w stanie gorszym niż przed zadaniem.

- [ ] **Step 1: Dopisz test przed `process.exit` w `tools/test-postawy.mjs`**

Import i rejestracja (`swarogDlon` jest już zarejestrowany z Task 7):

```javascript
import { perun } from '../js/znaki/perun.js';
// ...
rej.zarejestruj(perun);
```

```javascript
// BŁYSKAWICA (iglica): obie ręce w górę, ŁOKCIE nad linią barków.
// Oś nośna to wysokość łokci - zmierzona mediana +0.13 w tej pozie wobec
// -0.65..-0.72 we wszystkich pozostałych i -0.70 w tańcu.
const IGLICA = cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
  lokL:  [-0.34, -0.85], lokP:  [0.34, -0.85]
});

console.log('\nBŁYSKAWICA (iglica):');
const ig = ocen(IGLICA);
spr(`ręce w górze z łokciami nad barkami zapalają błyskawicę (${ig.perun.toFixed(2)})`, ig.perun > 0.7);

// KLUCZOWE ROZRÓŻNIENIE: ręce w górze, ale łokcie NISKO (opuszczone wzdłuż
// ciała, przedramiona w górę). W tańcu zdarza się nieustannie.
const lokcieNisko = ocen(cialo({
  nadgL: [-0.30, -1.30], nadgP: [0.30, -1.30],
  lokL:  [-0.30, -0.40], lokP:  [0.30, -0.40]
}));
spr(`ręce w górze z łokciami POD barkami NIE zapalają błyskawicy (${lokcieNisko.perun.toFixed(2)})`,
    lokcieNisko.perun < 0.3);

spr(`iglica NIE zapala ziemi (${ig.weles.toFixed(2)})`, ig.weles < 0.3);
spr(`iglica NIE zapala powietrza (${ig.stribog.toFixed(2)})`, ig.stribog < 0.3);
spr(`iglica NIE zapala wody (${ig.mokosz.toFixed(2)})`, ig.mokosz < 0.3);
spr(`ziemia NIE zapala błyskawicy (${z.perun.toFixed(2)})`, z.perun < 0.3);
spr(`powietrze NIE zapala błyskawicy (${pw.perun.toFixed(2)})`, pw.perun < 0.3);
spr(`woda NIE zapala błyskawicy (${wd.perun.toFixed(2)})`, wd.perun < 0.3);

const igL = ocen(odbij(IGLICA));
spr(`odbita iglica = ta sama (${igL.perun.toFixed(2)})`, Math.abs(igL.perun - ig.perun) < 0.02);

// Brak dłoni NIE KARZE - piramidka jest kwalifikatorem miękkim. To nie jest
// detal: w nagraniu z żywego ciała jedno z trzech powtórzeń miało ZERO klatek
// z obiema wykrytymi dłońmi, a pieczęć i tak wyszła.
const igBezDloni = ocen(IGLICA, []);
spr(`brak dłoni nie zeruje iglicy (${igBezDloni.perun.toFixed(2)})`, igBezDloni.perun > 0.5);

console.log('\nOGIEŃ - PASMO WYSOKOŚCI:');
// Piramidka NAD GŁOWĄ to wciąż piramidka dla swarogDlon. Bez pasma ogień
// zapalał się na 223 z 333 klatek iglicy (zmierzone na nagraniu).
const piramidkaNadGlowa = ocen(IGLICA, [piramidka(), piramidka()]);
spr(`piramidka NAD GŁOWĄ nie zapala ognia (${piramidkaNadGlowa.swarog.toFixed(2)})`,
    piramidkaNadGlowa.swarog < 0.3);

// Ta sama piramidka na wysokości klatki - ogień ma się zapalić.
const NA_KLATCE = cialo({
  nadgL: [-0.10, -0.35], nadgP: [0.10, -0.35],
  lokL:  [-0.28, -0.15], lokP:  [0.28, -0.15]
});
const piramidkaNaKlatce = ocen(NA_KLATCE, [piramidka(), piramidka()]);
spr(`piramidka na wysokości klatki zapala ogień (${piramidkaNaKlatce.swarog.toFixed(2)})`,
    piramidkaNaKlatce.swarog > 0.7);
```

Dopisz też pomocniczą dłoń w piramidce obok istniejącej `piesc()`:

```javascript
/** Dłoń w piramidce: palce wyprostowane, opuszki zbiegają się w jednym punkcie. */
export function piramidka() {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.50, y: 0.50, z: 0 }));
  lm[0] = { x: 0.50, y: 0.70, z: 0 };                       // nadgarstek nisko
  lm[5] = { x: 0.47, y: 0.58, z: 0 }; lm[17] = { x: 0.53, y: 0.58, z: 0 };
  lm[9] = { x: 0.49, y: 0.57, z: 0 }; lm[13] = { x: 0.51, y: 0.57, z: 0 };
  lm[1] = { x: 0.46, y: 0.65, z: 0 };
  // opuszki wysoko i blisko siebie - namiot
  for (const i of [4, 8, 12, 16, 20]) lm[i] = { x: 0.50, y: 0.40, z: 0 };
  return { handedness: 'Left', landmarks: lm };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/test-postawy.mjs`
Expected: FAIL — `perun` w obecnej postaci to stara postawa „ręka nad głową", a `swarogDlon` nie zna jeszcze wysokości

- [ ] **Step 3: Przepisz `js/znaki/perun.js`**

```javascript
/**
 * Błyskawica - Perun: grom, dąb, władca burzy.
 *
 * IGLICA: obie ręce w górę, ŁOKCIE nad linią barków, opuszki złączone
 * w piramidkę nad głową.
 *
 * ================== TRZECIA POZA TEJ PIECZĘCI ==================
 *
 * Dwie poprzednie padły na nagraniach z żywego ciała, i obie z tego samego
 * powodu: opisywały precyzyjny układ kończyn, którego człowiek mający 12 s
 * na ustawienie się i nie widzący ekranu po prostu nie przyjmuje.
 *
 *   1. Zygzak bokiem - z 327 klatek ANI JEDNA nie osiągnęła profilu.
 *      Kąt w łokciu wyszedł PROSTSZY niż w swobodnym tańcu (137 vs 127 st.),
 *      więc warunek "zgięte łokcie" działał w drugą stronę. Pieczęć zapalała
 *      się mocniej w tańcu (0.37) niż we własnej pozie (0.22).
 *   2. Chwyt za łokieć - dłoń zatrzymała się 1.14 szerokości barków od celu
 *      (dla porównania pięść na barku osiąga 0.32). Wada była w PROJEKCIE:
 *      żeby chwycić uniesiony łokieć, druga ręka też musi pójść w górę, więc
 *      towarzyszący warunek "jedna ręka wysoko, druga nisko" był z tą pozą
 *      wewnętrznie sprzeczny.
 *
 * Nieudana próba 2 okazała się rozstrzygająca, bo pokazała, co ciało robi
 * NAPRAWDĘ: unosi łokcie NAD linię barków. Mediany wysokości łokci względem
 * tej linii: błyskawica +0.13, taniec -0.70, ziemia -0.65, powietrze -0.67,
 * woda -0.72, ogień -0.65. Zapas ponad pół szerokości barków.
 *
 * ================== DLACZEGO BEZ STYKU ==================
 *
 * Jedyna pieczęć bez punktu dotyku - i jedyna, która go nie potrzebuje.
 * Cztery pozostałe stoją na styku, bo dotyk jest rzadki i łatwo go zmierzyć,
 * ale tym, co naprawdę rozdziela, jest OŚ, KTÓREJ NIE UŻYWA NIC INNEGO.
 * Wysokość łokci jest taką osią. Styk był drogą do niej, nie warunkiem.
 *
 * ================== PIRAMIDKA JEST MIĘKKA ==================
 *
 * Propozycja właściciela projektu: skoro to iglica, niech gracz złoży opuszki
 * w namiot nad głową. Przyjęta JAKO KWALIFIKATOR, nie jako warunek konieczny -
 * przy rękach nad głową MediaPipe widzi obie dłonie tylko w 31% klatek.
 * Potwierdziło się to eksperymentem, którego nikt nie planował: w nagraniu
 * kontrolnym jedno z trzech powtórzeń miało ZERO klatek z obiema dłońmi,
 * a pieczęć i tak wyszła w 100% klatek, bo stoi na łokciach.
 */
import { NADG_L, NADG_P, LOKIEC_L, LOKIEC_P, BARK_L, BARK_P,
         widoczne, skalaCiala, rampa } from './postawa.js';
import { nadBarkami } from './styk.js';
import { pelnaDlon } from './dlon.js';
import { swarogDlon } from './swarogDlon.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, LOKIEC_L, LOKIEC_P];
const P = PROGI.blyskawica;

// Ten sam wzorzec i ta sama wartość co w ziemi i wodzie.
const WAGA_BEZ_DLONI = 0.7;

export const perun = {
    id: 'perun',
    nazwa: 'Perun (błyskawica)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        return Math.min(sk.nadgarstki, sk.lokcie, sk.piramidka);
    },

    skladniki(frame) {
        return skladnikiZ(frame);
    }
};

/** Warunki w funkcji modułowej, nie przez `this` - wzorzec mokoszSplot.js:53. */
function skladnikiZ(frame) {
    const wl = frame.pose?.worldLandmarks;
    if (!widoczne(wl, PUNKTY)) return null;
    const skala = skalaCiala(wl);

    return {
        // Niższy z dwóch nadgarstków decyduje - jedna ręka w górze to nie iglica.
        nadgarstki: rampa(Math.min(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala)),
                          P.WYSNADG_ZERO, P.WYSNADG_PELNY),
        // Warunek nośny. Niższy łokieć decyduje z tego samego powodu.
        lokcie: rampa(Math.min(nadBarkami(wl, LOKIEC_L, skala), nadBarkami(wl, LOKIEC_P, skala)),
                      P.WYSLOK_ZERO, P.WYSLOK_PELNY),
        piramidka: piramidkaNadGlowa(frame)
    };
}

/**
 * Miękki kwalifikator: ten sam namiot z opuszek co w ogniu, oceniony
 * PRZEZ SAM swarogDlon - żeby istniała jedna definicja piramidki, nie dwie.
 *
 * Wywoływana jest funkcja `skladniki`, nie `score`: `score` ognia zawiera
 * od tego zadania warunek WYSOKOŚCI (pasmo na wysokości klatki), który nad
 * głową jest z definicji niespełniony. Tutaj interesuje nas wyłącznie kształt
 * dłoni, bez tego, gdzie się znajduje.
 */
function piramidkaNadGlowa(frame) {
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (dlonie.length < 2) return WAGA_BEZ_DLONI;
    const sk = swarogDlon.skladniki(frame);
    if (!sk) return WAGA_BEZ_DLONI;
    const ksztalt = Math.min(sk.palce, sk.opuszki, sk.nadgarstki);
    // Ta sama podłoga co w pozostałych kwalifikatorach: dłoń widoczna, ale
    // nieułożona, osłabia pieczęć - nigdy bardziej, niż zrobiłby to jej brak.
    return Math.max(WAGA_BEZ_DLONI * ksztalt, Math.min(WAGA_BEZ_DLONI, ksztalt));
}
```

- [ ] **Step 4: Dodaj pasmo wysokości do `js/znaki/swarogDlon.js`**

Zmień `wymaga` na `'both'` (znak potrzebuje teraz i dłoni, i pozy), dopisz import i warunek:

```javascript
import { NADG_L, NADG_P, BARK_L, BARK_P, widoczne, skalaCiala } from './postawa.js';
import { nadBarkami } from './styk.js';
import { PROGI } from './progi-zmierzone.js';

const PO = PROGI.ogien;
```

W obiekcie znaku:

```javascript
    wymaga: 'both',

    score(frame) {
        const sk = this.skladniki(frame);
        if (!sk) return 0;
        return Math.min(sk.palce, sk.opuszki, sk.nadgarstki, sk.wysokosc);
    },

    skladniki(frame) {
        const sk = najlepszaPara(frame, skladnikiPary).skladniki;
        if (!sk) return null;
        return { ...sk, wysokosc: wysokoscPiramidki(frame) };
    }
```

I funkcja modułowa:

```javascript
/**
 * ================== PASMO WYSOKOŚCI PIRAMIDKI ==================
 *
 * Dodane po pomiarze na nagraniu z 2026-09-03. Wcześniejsze wersje spec-u
 * pięciokrotnie powtarzały, że ten plik zostaje bez jednej linijki zmiany.
 * Pomiar to obalił dwukrotnie:
 *
 *   1. Bez ŻADNEGO warunku wysokości ogień zapalał się na MISCE WODY
 *      częściej (179/322 klatek) niż na własnej piramidce (107/299).
 *      Miska ma palce proste, opuszki zbieżne i nadgarstki rozsunięte
 *      w skali dłoni - komplet warunków ognia. A Tęcza to ogień -> woda ->
 *      powietrze, więc gracz przechodził przez tę kolizję ZA KAŻDYM RAZEM.
 *   2. Sama PODŁOGA wysokości tego nie domyka, bo piramidka NAD GŁOWĄ
 *      (iglica błyskawicy) też jest "wysoko" - ogień zapalał się wtedy na
 *      223 z 333 klatek iglicy.
 *
 * Stąd PASMO, nie rampa: piramidka liczy się na wysokości klatki, a milczy
 * i nisko (woda), i wysoko (iglica). Zmierzony efekt pasma: woda 179 -> 0,
 * iglica 223 -> 0, taniec 8 -> 0, ogień 107 -> 107. Zero kosztu dla własnej
 * pozy.
 *
 * Ogólniejsza lekcja, warta zapamiętania poza tym plikiem: KOLIZJĘ TRZEBA
 * SPRAWDZAĆ W OBIE STRONY. Spec przewidział parę ogień-woda jako najbardziej
 * narażoną, ale założył, że to woda udaje ognia, i przeniósł wodę na
 * landmarki pozy. Kolizja biegła odwrotnie i tamta zmiana nie mogła jej
 * naprawić.
 */
function wysokoscPiramidki(frame) {
    const wl = frame.pose?.worldLandmarks;
    if (!widoczne(wl, [BARK_L, BARK_P, NADG_L, NADG_P])) return 0;
    const skala = skalaCiala(wl);
    const wys = Math.max(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala));
    return pasmo(wys, PO.WYSOKOSC_DOL_ZERO, PO.WYSOKOSC_DOL_PELNY,
                      PO.WYSOKOSC_GORA_PELNY, PO.WYSOKOSC_GORA_ZERO);
}
```

`pasmo` jest już eksportowane z `dlon.js:202` — dopisz je do istniejącego importu z tego pliku.

- [ ] **Step 5: Run test to verify it passes**

Run: `node tools/test-postawy.mjs && sh tools/test-wszystko.sh`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/znaki/perun.js js/znaki/swarogDlon.js tools/test-postawy.mjs
git commit -m "Iglica na osi łokci; ogień dostaje pasmo wysokości piramidki"
```

---

### Task 11: Wpięcie piątki, nowe kombosy, odpięcie run

**Files:**
- Modify: `js/main.js:9-11` (importy), `js/main.js:67-76` (rejestracja), `js/main.js:348-352` (aktualizacja śladów), `js/main.js:515-520` (rysowanie śladu), `js/main.js:558` (`slady` w `updatePanel`)
- Modify: `js/kombosy.js:29-63` (tabela)
- **`js/aura.js` NIE jest dotykany** — patrz Step 3
- Modify: `js/runy/definicje.js`, `js/runy/slad.js`, `js/runy/ksztalt.js`, `js/runy/szablony.js`, `js/runy/rysujSlad.js` (notka w nagłówku), `js/znaki/mokoszSplot.js` (notka)
- Modify: `tools/test-znaki.mjs`, `tools/test-kombosy.mjs`

**Interfaces:**
- Consumes: `weles`, `stribog`, `mokosz`, `perun` z Task 7-10; `swarogDlon` bez zmian; `aktualizujSkale` z Task 4.
- Produces: rejestr pięciu znaków; `KOMBOSY` z trzema wpisami.

- [ ] **Step 1: Zaktualizuj tabelę w `js/kombosy.js`**

Zastąp blok `export const KOMBOSY = [...]` (linie 31-63) tym:

```javascript
// Pole `uzbraja` mówi, KTÓRĄ technikę kombos przygotowuje - main.js routuje
// po nim zamiast bezwarunkowo uzbrajać płonący palec.
//
// PIĄTA GENERACJA ZNAKÓW (docs/superpowers/specs/2026-09-02-piec-pieczeci-
// -styku-design.md): runy kreślone w powietrzu i Splot Mokoszy odeszły,
// zastąpione pięcioma pieczęciami STYKU - ogień (piramidka, bez zmian),
// ziemia (pięści na barkach), błyskawica (zygzak bokiem), powietrze
// (łokcie razem), woda (miska).
//
// BUDŻET CZASOWY. Pieczęć na styku trafia wynik ~0.9, a wtedy pieczecie.js
// składa ją w ~0.9 s. Trzy złożenia to ~2.7 s plus przejścia - mieści się
// w OKNO_MS z zapasem. Runy trafiały ~0.7, czyli 1.7 s na złożenie, i stąd
// brało się zmierzone ograniczenie Wstęgi w poprzedniej generacji.
export const KOMBOSY = [
    // Ogień -> woda -> powietrze. Sekwencja wybrana przez właściciela
    // projektu. Aktywacja NATYCHMIASTOWA, bez drugiego gestu - main.js
    // routuje tę gałąź osobno.
    { id: 'tecza', nazwa: 'Wstęga Mokoszy',
      sekwencja: ['swarog', 'mokosz', 'stribog'], uzbraja: 'tecza' },

    // Ogień -> błyskawica. Nazwa mówi to, co robi sekwencja.
    { id: 'gromWOgniu', nazwa: 'Grom w Ogniu',
      sekwencja: ['swarog', 'perun'], uzbraja: 'ogien' },

    // Powietrze x2 -> Aard. Wiatr złożony dwa razy pod rząd.
    { id: 'aard', nazwa: 'Podmuch Striboga',
      sekwencja: ['stribog', 'stribog'], uzbraja: 'aard' }
];

// ZIEMIA nie wchodzi na razie w żaden kombos - zostaje pieczęcią
// samodzielną, dającą swój błysk. Kombos bez techniki, którą miałby
// uzbrajać, byłby wymyślaniem na zapas; ziemia wejdzie, gdy powstanie
// technika ziemi.
```

- [ ] **Step 2: Przepnij rejestr w `js/main.js`**

Zastąp importy w liniach 9-11:

```javascript
import { swarogDlon } from './znaki/swarogDlon.js';
import { weles } from './znaki/weles.js';
import { perun } from './znaki/perun.js';
import { stribog } from './znaki/stribog.js';
import { mokosz } from './znaki/mokosz.js';
import { aktualizujSkale } from './znaki/postawa.js';
```

Zastąp blok rejestracji (linie 67-76):

```javascript
let znaki = new ZnakRegistry();
// Pięć pieczęci STYKU. Ogień czyta dłonie (piramidka - jedyna dłoniowa
// pieczęć, która działała pewnie, bo jej kształt sam wymusza prześwit
// między dłońmi), pozostałe cztery czytają pozę.
znaki.zarejestruj(swarogDlon);   // ogień
znaki.zarejestruj(weles);        // ziemia
znaki.zarejestruj(perun);        // błyskawica
znaki.zarejestruj(stribog);      // powietrze
znaki.zarejestruj(mokosz);       // woda
```

Zastąp blok `--- 4a. Aktualizacja śladów dłoni (runy) ---` (linie 348-352):

```javascript
    // --- 4a. Skala ciała ---
    // RAZ NA KLATKĘ, PRZED znaki.ocen() - pięć znaków dzieli jedną wygładzoną
    // skalę barków; gdyby każdy liczył ją we własnym score(), wygładzanie
    // biegłoby pięć razy szybciej niż zakłada jego stała czasowa.
    aktualizujSkale(frame.pose?.worldLandmarks ?? null, dt);
```

Usuń linię 520 (`rysujSlady(...)`) i dostosuj komentarz nad nią:

```javascript
    // --- 7b. Szkielet dłoni ---
    rysujDlonie(frame);
```

Usuń `slady` z obiektu przekazywanego do `debugHud.updatePanel` (linia 558).

- [ ] **Step 3: Dodaj notki do odpiętych modułów — `aura.js` ZOSTAW W SPOKOJU**

**`js/aura.js` nie jest w tym zadaniu modyfikowany, i to jest decyzja, nie przeoczenie.** Pole `_slad` w tym pliku (`js/aura.js:104`, `145-154`, `203-209`, `274-279`) wygląda na bufor śladu run, ale nim **nie jest** — to płótno akumulacyjne **tęczowej wstęgi**, sterowane przez `tecza.silaSladu` z `js/tecza.js`. To jest nagroda z Wstęgi Mokoszy i zostaje w grze. Ślad run rysuje wyłącznie `js/runy/rysujSlad.js`, wywoływany z `js/main.js:520` — i to wywołanie usuwa Step 2. **Usunięcie `_slad` z aury skasowałoby efekt Tęczy**, czyli jedyną nagrodę w grze.

Na początku każdego z plików `js/runy/*.js` oraz `js/znaki/mokoszSplot.js` dopisz nad istniejącym komentarzem:

```javascript
/**
 * ================== ODPIĘTE OD GRY (2026-09-02) ==================
 *
 * Ten moduł NIE jest zarejestrowany w main.js. Runy kreślone w powietrzu
 * przegrały jako PIECZĘCIE - kształt kreślony rzadko wychodzi daleko
 * powyżej progu, więc składa się wolno i nie mieści kombosów w oknie
 * czasowym. Silnik jest jednak sprawny i został ŚWIADOMIE ZACHOWANY jako
 * materiał na przyszłe TECHNIKI (kreślony kształt jako sposób RZUCANIA,
 * nie składania). tools/test-runy.mjs nadal go pilnuje.
 *
 * Zastąpiony przez pięć pieczęci styku:
 * docs/superpowers/specs/2026-09-02-piec-pieczeci-styku-design.md
 */
```

- [ ] **Step 4: Napraw `tools/test-znaki.mjs` i `tools/test-kombosy.mjs`**

Uruchom `node tools/test-znaki.mjs` i `node tools/test-kombosy.mjs`, przeczytaj, które asercje odwołują się do znikniętych identyfikatorów (`mokosz-otwarta`, `mokosz-piesc`, `perun-otwarta`, `stribog-otwarta`, `splot`, `zewPodziemia`), i zastąp je nowymi (`swarog`, `weles`, `perun`, `stribog`, `mokosz`, kombosy `tecza`/`gromWOgniu`/`aard`). Zachowaj strukturę i intencję każdej asercji — zmienia się słownik, nie to, co test sprawdza.

- [ ] **Step 5: Uruchom cały zestaw**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓`, włącznie z `test-runy.mjs` (moduł żyje, mimo że jest odpięty)

- [ ] **Step 6: Weryfikacja ręczna w przeglądarce**

```bash
python3 -m http.server 8000
```

1. Klawisz `D` pokazuje pięć znaków w sekcji `znak`, bez identyfikatorów run.
2. Każda z pięciu pieczęci daje się złożyć.
3. Sekwencja ogień → woda → powietrze odpala Tęczę.
4. FPS nie spadł względem stanu sprzed zmiany.

- [ ] **Step 7: Commit**

```bash
git add js/main.js js/kombosy.js js/runy js/znaki/mokoszSplot.js tools/test-znaki.mjs tools/test-kombosy.mjs
git commit -m "Wpięcie pięciu pieczęci; runy i Splot odpięte, nie usunięte"
```

---

### Task 12: Test rozdzielności na nagraniach

**Files:**
- Create: `tools/test-rozdzielnosc.mjs`

**Interfaces:**
- Consumes: `odtworzKlatke` z Task 2; `ZnakRegistry`; pięć znaków; `SkladaniePieczeci`, `KomboSilnik`; `aktualizujSkale`, `resetSkali`.
- Produces: nic — to terminal pętli strojenia.

**To jest test, którego nie miała żadna z czterech poprzednich generacji.** Nagranie jest wejściem STAŁYM, progi zmienną: strojenie to `node tools/progi.mjs --zapisz` → `node tools/test-rozdzielnosc.mjs` → poprawka reguły w `progi.mjs` → powtórka. **Bez ponownego nagrywania.**

- [ ] **Step 1: Napisz test**

```javascript
// tools/test-rozdzielnosc.mjs
/**
 * Rozdzielność pieczęci na NAGRANIACH ŻYWEGO CIAŁA.
 *
 *   node tools/test-rozdzielnosc.mjs
 *
 * Cztery poprzednie generacje znaków przechodziły testy headless na danych
 * syntetycznych i zawodziły na kamerze. Ten plik zamyka tę lukę: chodzi po
 * nagraniach z tools/probki/ i przepuszcza je przez PRAWDZIWY silnik
 * składania, nie przez własną atrapę.
 *
 * Trzy sprawdzenia, w rosnącej kolejności ważności:
 *
 *   1. POZY TRZYMANE - docelowa pieczęć wygrywa z marginesem.
 *   2. TANIEC - przez 30 s swobodnego tańca nie składa się ANI JEDNA
 *      pieczęć. To jest wymaganie właściciela projektu wyrażone wprost.
 *   3. PRZEJŚCIA - sekwencja wykonana płynnie daje dokładnie tyle złożeń,
 *      ile pieczęci, w tej kolejności, i odpala kombos.
 *
 * Punkt 3 jest WAŻNIEJSZY od punktu 1. Pozy trzymane są rozdzielne
 * z konstrukcji; przejścia nie są, a to przez nie gracz przechodzi za
 * każdym razem.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { odtworzKlatke } from '../js/nagrywanie/zapis.js';
import { ZnakRegistry } from '../js/znaki/registry.js';
import { resetSkali, aktualizujSkale } from '../js/znaki/postawa.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { weles } from '../js/znaki/weles.js';
import { perun } from '../js/znaki/perun.js';
import { stribog } from '../js/znaki/stribog.js';
import { mokosz } from '../js/znaki/mokosz.js';
import { SkladaniePieczeci } from '../js/pieczecie.js';
import { KomboSilnik } from '../js/kombosy.js';

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), 'probki');
const MARGINES_LIDERA = 0.12;   // musi zgadzać się z pieczecie.js
const PROG_POSTAWY = 0.5;

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// Nagranie kroku -> identyfikator pieczęci, której oczekujemy.
const OCZEKIWANE = {
    ogien: 'swarog', ziemia: 'weles', blyskawica: 'perun',
    powietrze: 'stribog', woda: 'mokosz'
};

function rejestr() {
    const r = new ZnakRegistry();
    for (const z of [swarogDlon, weles, perun, stribog, mokosz]) r.zarejestruj(z);
    return r;
}

function wczytaj() {
    let pliki = [];
    try { pliki = readdirSync(KATALOG).filter(f => f.endsWith('.json')); } catch { /* pusto */ }
    if (!pliki.length) {
        console.log('  ⚠ BRAK NAGRAŃ w tools/probki/ - ten test nic nie sprawdza.');
        console.log('    Nagraj sesję klawiszem Z w grze i przenieś plik do tools/probki/.');
        process.exit(1);
    }
    const kroki = {};
    for (const f of pliki) {
        const dane = JSON.parse(readFileSync(join(KATALOG, f), 'utf8'));
        for (const [e, klatki] of Object.entries(dane.kroki)) (kroki[e] ??= []).push(...klatki);
    }
    return kroki;
}

/** Przepuszcza nagranie przez rejestr + prawdziwy silnik składania. */
function przepusc(klatki) {
    resetSkali();
    const znaki = rejestr();
    const skladanie = new SkladaniePieczeci();
    const kombosy = new KomboSilnik();
    const zlozone = [], techniki = [];
    let czas = 0, sumaWynikow = null, liczbaOcen = 0;

    for (const zapisana of klatki) {
        const frame = odtworzKlatke(zapisana);
        czas += frame.dt;
        aktualizujSkale(frame.pose?.worldLandmarks ?? null, frame.dt);
        const wyniki = znaki.ocen(frame);

        // Moc na maksimum: sprawdzamy ROZDZIELNOŚĆ, nie ekonomię gry.
        // Brak mocy zatrzymałby pierścień i schował prawdziwy wynik testu.
        const skl = skladanie.update(wyniki, 1, frame.dt);
        if (skl.zlozona) {
            zlozone.push(skl.zlozona.id);
            const t = kombosy.dodaj(skl.zlozona.id, czas * 1000);
            if (t) techniki.push(t.id);
        }

        if (czas < 0.5) continue;   // dochodzenie do pozy
        sumaWynikow ??= Object.fromEntries(Object.keys(wyniki).map(k => [k, 0]));
        for (const k of Object.keys(wyniki)) sumaWynikow[k] += wyniki[k];
        liczbaOcen += 1;
    }

    const srednie = {};
    for (const k of Object.keys(sumaWynikow ?? {})) srednie[k] = sumaWynikow[k] / Math.max(1, liczbaOcen);
    return { zlozone, techniki, srednie, czas };
}

const kroki = wczytaj();
const etykiety = (prefiks) => Object.keys(kroki).filter(e => e.startsWith(prefiks + '#'));

console.log('1. POZY TRZYMANE - docelowa pieczęć wygrywa z marginesem:');
for (const [krok, oczekiwany] of Object.entries(OCZEKIWANE)) {
    for (const e of etykiety(krok)) {
        const { srednie } = przepusc(kroki[e]);
        const pary = Object.entries(srednie).sort((a, b) => b[1] - a[1]);
        const [lider, wLider] = pary[0] ?? ['brak', 0];
        const [drugi, wDrugi] = pary[1] ?? ['brak', 0];
        spr(`${e.padEnd(14)} lider ${lider} ${wLider.toFixed(2)} (drugi ${drugi} ${wDrugi.toFixed(2)})`,
            lider === oczekiwany && wLider > PROG_POSTAWY && wLider - wDrugi > MARGINES_LIDERA);
    }
}

console.log('\n2. TANIEC - nic się nie składa samo:');
for (const e of etykiety('taniec')) {
    const { zlozone, czas } = przepusc(kroki[e]);
    spr(`${e}: ${czas.toFixed(0)} s tańca, złożonych pieczęci: ${zlozone.length ? zlozone.join(', ') : 'żadna'}`,
        zlozone.length === 0);
}

console.log('\n3. PRZEJŚCIA - pierścień nie miga między pieczęciami:');
const PRZEJSCIA = {
    'przejscie-ogien-woda-powietrze': { ciag: ['swarog', 'mokosz', 'stribog'], kombos: 'tecza' },
    'przejscie-ziemia-powietrze': { ciag: ['weles', 'stribog'], kombos: null }
};
for (const [prefiks, { ciag, kombos }] of Object.entries(PRZEJSCIA)) {
    for (const e of etykiety(prefiks)) {
        const { zlozone, techniki } = przepusc(kroki[e]);
        spr(`${e}: złożone [${zlozone.join(' → ') || 'nic'}] = oczekiwane [${ciag.join(' → ')}]`,
            zlozone.length === ciag.length && zlozone.every((id, i) => id === ciag[i]));
        if (kombos) {
            spr(`${e}: odpalił kombos ${kombos}`, techniki.includes(kombos));
        }
    }
}

process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Uruchom i stroj**

Run: `node tools/test-rozdzielnosc.mjs`

Jeśli coś zawodzi, **nie poprawiaj liczb w `js/znaki/progi-zmierzone.js`** — plik jest generowany, a ręczna poprawka to znowu `ZGADNIĘTE`. Pętla strojenia:

1. Przeczytaj, która asercja padła i o ile.
2. Popraw **regułę** w `tools/progi.mjs` (percentyle w `MIARY`/`ROSNACE`) albo dołóż miarę.
3. `node tools/progi.mjs --zapisz`
4. `node tools/test-rozdzielnosc.mjs`
5. Powtarzaj. **Bez ponownego nagrywania** — nagranie jest wejściem stałym.

Jeśli po kilku iteracjach dana para nadal się nie rozdziela, to jest **wynik, nie porażka**: poza jest za blisko naturalnego tańca. Zgłoś to właścicielowi projektu — zmienia się wtedy poza, nie liczba.

- [ ] **Step 3: Uruchom cały zestaw**

Run: `sh tools/test-wszystko.sh`
Expected: wszystkie `✓`

- [ ] **Step 4: Commit**

```bash
git add tools/test-rozdzielnosc.mjs js/znaki/progi-zmierzone.js tools/progi.mjs
git commit -m "Test rozdzielności na nagraniach: pozy, taniec, przejścia"
```

---

### Task 13: Weryfikacja na żywym ciele i dokumentacja

**Files:**
- Modify: `GEMINI.md` (§7 — opisuje dziś zrzut śladu runy klawiszem `N`)
- Modify: `/Users/whomean/.claude/projects/-Users-whomean-Documents-antigravity-powerball-app/memory/kula-mocy-runy-przebudowa-2026-09-01.md`
- Modify: `/Users/whomean/.claude/projects/-Users-whomean-Documents-antigravity-powerball-app/memory/MEMORY.md`

- [ ] **Step 1: Weryfikacja na żywym ciele**

```bash
python3 -m http.server 8000
```

Przejdź punkty ze spec-a i **zanotuj wynik każdego**:

1. FPS nie spadł względem stanu sprzed zmiany (znika sześć run i dwa bufory śladu, dochodzi pięć tanich póz — powinno być szybciej).
2. Każda z pięciu pieczęci składa się w rozsądnym czasie; nakładka (`D`) pokazuje, który warunek hamuje.
3. Tęcza odpala z sekwencji ogień → woda → powietrze wykonanej płynnie.
4. Kilka minut swobodnego tańca: żadna pieczęć nie składa się sama.
5. Reguła §2 trzyma się na żywym ciele — nigdzie nie pojawia się komunikat porażki, częściowo ułożona poza daje słabszy efekt, nie odrzucenie.

**Dopiero po przejściu punktów 1-5 wolno powiedzieć, że pieczęcie działają.** Jeśli któryś punkt zawodzi, wróć do pętli strojenia z Task 12 — a jeśli problem jest w samej pozie, zgłoś to właścicielowi projektu zamiast naciągać progi.

- [ ] **Step 2: Zaktualizuj GEMINI.md §7**

Zastąp opis zrzutu śladu runy klawiszem `N` opisem sesji nagraniowej: klawisz `Z` startuje scenariusz, cyfry `1`–`8` wchodzą od wybranego kroku, `Escape` przerywa, plik trafia do pobranych i przenosi się go do `tools/probki/`, `node tools/progi.mjs --zapisz` generuje progi, `node tools/test-rozdzielnosc.mjs` je sprawdza. Zaznacz, że `js/znaki/progi-zmierzone.js` jest **generowany** i nie edytuje się go ręcznie.

- [ ] **Step 3: Zaktualizuj pamięć projektu**

Wpis `kula-mocy-runy-przebudowa-2026-09-01.md` mówi dziś następnej sesji „nagraj prawdziwe szablony run" — po tej zmianie to jest mylenie tropu. Przepisz go tak, żeby mówił: runy są **odpięte i zachowane** jako gotowy silnik śladu do przyszłych technik; pieczęciami są teraz pozy styku; progi pochodzą z nagrań w `tools/probki/` i regeneruje się je `tools/progi.mjs`. Zaktualizuj też opis w `MEMORY.md`, żeby zgadzał się z nową treścią.

- [ ] **Step 4: Commit**

```bash
git add GEMINI.md
git commit -m "GEMINI.md: sesja nagraniowa zamiast zrzutu śladu runy"
```

---

## Self-Review

**Pokrycie spec-a:** Kolejność wykonania → Fazy A/B i brama. Pięć pieczęci → Task 7-10 plus `swarogDlon.js` nietknięty. Rozdzielność → Task 10 Step 1 dla czterech póz z ciała (syntetyczna, z marginesem 0.12) i Task 12 dla wszystkich pięciu (na nagraniach). **Para ogień↔woda — ta, którą spec nazywa najbardziej narażoną — jest sprawdzana wyłącznie na nagraniach**, bo ogień czyta dłonie i syntetyczna piramidka byłaby zmyśleniem akurat tam, gdzie mamy prawdziwe dane. Test syntetyczny sprawdza tylko kierunek uczciwie sprawdzalny: pozy z dwiema dłońmi w kadrze nie zapalają ognia. Decyzja 1 (styk ciągły) → Task 5, test ciągłości. Decyzja 2 (woda z pozy) → Task 9, nagłówek pliku. Decyzja 3 (skala 3D + EMA) → Task 4. Decyzja 4 (przód/tył z x) → Task 10. Decyzja 5 (miękkie kwalifikatory) → Task 7 i 9, `WAGA_BEZ_DLONI`. Decyzja 6 (Splot odchodzi) → Task 11 Step 3. Decyzja 7 (runy odpięte) → Task 11 Step 3. Decyzja 8 (żadna stała zgadnięta) → Task 6, generowany plik. Krok 0 → Task 1-3 plus brama. Kombosy → Task 11 Step 1. Weryfikacja → Task 12 i 13.

**Luka domknięta w trakcie przeglądu:** spec wymienia `js/znaki/styk.js` z funkcją `obrotBokiem`, ale `obrotBokiem` czyta wyłącznie barki i jest ściśle związana ze skalą — mieszka więc w `postawa.js` (Task 4), obok `skalaChwilowa`, z której korzysta. `styk.js` zostaje przy geometrii kończyn.

**Spójność nazw:** `PROGI.<poza>.<MIARA>_PELNY` / `_ZERO` generowane w Task 6 i konsumowane w Task 7-10; nazwy miar w `MIARY` w `progi.mjs` odpowiadają jeden do jednego polom czytanym w znakach (`STYK`, `WYSOKOSC`, `ROZCHYLENIE`, `GLEBOKOSC`, `OBROT`, `ROZJAZDPIONOWY`, `ROZJAZDPOZIOMY`, `KAT`). `odtworzKlatke` z Task 2 używane w Task 6 i 12. `resetSkali`/`aktualizujSkale` z Task 4 używane w Task 6, 7-10 (przez `ocen`) i 12.
