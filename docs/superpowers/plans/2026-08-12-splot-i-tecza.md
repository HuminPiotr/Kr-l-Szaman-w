# Splot Mokoszy i Tęczowa Wstęga — plan implementacji

> **Dla agentów wykonawczych:** WYMAGANY PODSKILL: użyj `superpowers:subagent-driven-development` (zalecane) albo `superpowers:executing-plans`, żeby wykonać ten plan zadanie po zadaniu. Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** Gracz krzyżuje ramiona na piersi (znak czytany z pozy ciała, bez dłoni) — złożenie tego znaku trzy razy pod rząd daje na 30 s darmową tęczową wstęgę, ślad kolorowy ciągnący się za ruchem.

**Architektura:** Nowy znak `js/znaki/mokoszSplot.js` (`wymaga: 'pose'`, czyta wyłącznie barki i nadgarstki — żadnych bioder) rejestruje się w `ZnakRegistry` obok istniejących pieczęci dłoniowych. `kombosy.js` dostaje wiersz `splot×3 → tecza`. Nowa klasa `js/tecza.js` trzyma stan nagrody (licznik, barwa, siła śladu) — analogicznie do `plonacyPalec.js`/`podmuch.js`, ale bez drugiego gestu: aktywuje się natychmiast przy złożeniu kombosa. `js/aura.js` dostaje bufor akumulacyjny (jedno dodatkowe płótno w rozdzielczości maski), który zamienia zwykłą, płaską barwę aury na tęczowy ślad — bez dodatkowych przebiegów rozmycia ponad te, które już wykonuje.

**Tech Stack:** Vanilla JS, moduły ES, bez backendu. Testy to samodzielne skrypty `node tools/test-*.mjs`, zbierane przez `tools/test-wszystko.sh` (glob `test-*.mjs`).

**Spec:** `docs/superpowers/specs/2026-08-12-splot-i-tecza-design.md`

## Ograniczenia globalne

Obowiązują w KAŻDYM zadaniu. Wartości przepisane dosłownie ze spec.

1. **Reguła nadrzędna: nic nigdy nie mówi „źle".** Wynik znaku jest CIĄGŁĄ wartością 0..1, nigdy booleanem. Poniżej progu w `pieczecie.js` jest cisza, nie odmowa — to już istniejący mechanizm, nie modyfikowany w tym planie.
2. **Splot czyta WYŁĄCZNIE górną połowę sylwetki**: barki (11/12) i nadgarstki (15/16). ŻADNYCH bioder (23/24) — to jest cały powód tego znaku (stare postawy wymagały bioder i kamera laptopa ich nie widziała). Test musi udowodnić, że znak działa nawet gdy biodra są niewidoczne/NaN.
3. **Odbicie lustrzane niczego nie zmienia.** MediaPipe podaje lewo/prawo względem OBRAZU, a płótno ma `scaleX(-1)`. Skrzyżowanie liczone jest jako ZNAK iloczynu (nie kolejność `x`), więc mirror nie wymaga sprawdzania obu przypisań rąk.
4. **Wszystkie nowe liczby są ZGADNIĘTE.** Każda stała ma komentarz mówiący, że wymaga potwierdzenia na żywym ciele z nakładki debug (klawisz `D`).
5. **Odnowienie nagrody restartuje licznik do pełnych 30 s, nigdy nie sumuje.** `Tecza.aktywuj()` jest bezwarunkowe.
6. **`uzbraja: 'tecza'` NIE jest wariantem wzorca uzbrój-potem-gest** (`ogien`/`aard`). Nagroda startuje natychmiast przy złożeniu kombosa — trzecia gałąź w routingu `main.js`, nie odmiana istniejących dwóch.
7. **Koszt bufora śladu jest STAŁY, niezależny od długości śladu** — jedno dodatkowe przygaszenie (`fillRect`) na klatkę, ZERO dodatkowych przebiegów rozmycia ponad te trzy, które `aura.js` już wykonuje (`PRZEBIEGI`).
8. **Odporność na NaN i braki.** Brak pozy, NaN w punktach, NaN `dt` — zero/cisza, nigdy wyjątek. Precedens: `widoczne()` w `postawa.js`, `rampa()` zwraca 0 dla `NaN`.
9. **Komentarze po polsku**, w stylu istniejących plików: tłumaczą DLACZEGO, nie CO.

---

## Odkrycie z grounding'u planu

`js/znaki/weles.js` (stara, ODPIĘTA postawa ciała — nie mylić z aktywnym `welesDlon.js`) **już implementuje skrzyżowane ramiona na piersi**, łącznie z testami w `tools/test-postawy.mjs`. Jej formuła skrzyżowania (`krzyz` — znak iloczynu różnicy nadgarstków i różnicy barków, odporny na lustro) jest sprawdzona i **jest ponownie użyta** w Zadaniu 1 — zmienia się tylko pomiar wysokości: `weles.js` liczy ją jako ułamek odcinka bark→biodro (`wysokoscPiersi`, wymaga bioder), nowy `mokoszSplot.js` liczy ją w szerokościach barków od linii barków (bez bioder). To jest jedyna istotna różnica geometrii między starym, odpiętym `weles.js` a nowym `mokoszSplot.js`.

Konsekwencja: `mokoszSplot.js` potrzebuje MNIEJ punktów niż pierwotny projekt zakładał — wystarczą barki i nadgarstki, łokcie nie są używane w żadnym warunku (`weles.js` też ich nie używa).

---

## Układ plików

| Plik | Odpowiedzialność | Zadanie |
|---|---|---|
| `js/znaki/mokoszSplot.js` | nowy znak — skrzyżowanie ramion → 0..1, bez bioder | 1 |
| `tools/test-splot.mjs` | rozdzielność, ciągłość, lustro, odporność na brak bioder, kolizja z pieczęciami dłoniowymi | 1 |
| `js/tecza.js` | stan nagrody: licznik 30 s, barwa, rampa wygaszania | 2 |
| `tools/test-tecza.mjs` | cykl życia nagrody | 2 |
| `js/aura.js` | *(modyfikacja)* `barwaAury()` wydzielona i eksportowana, bufor śladu | 3 |
| `js/kombosy.js` | *(modyfikacja)* wiersz `splot×3 → tecza` | 4 |
| `js/main.js` | *(modyfikacja)* rejestracja znaku, instancja `Tecza`, routing, wpięcie w pętlę | 5 |
| `js/efekty.js` | *(modyfikacja)* wpisy `splot` i `tecza` w `TABELA` | 5 |
| `js/debugHud.js` | *(modyfikacja)* diagnostyka `tecza` (splot jedzie na już istniejącym mechanizmie `postawy`/`rozbicie`) | 5 |

---

## Zadanie 1: `js/znaki/mokoszSplot.js` — znak skrzyżowania ramion

**Files:**
- Create: `js/znaki/mokoszSplot.js`
- Test: `tools/test-splot.mjs`

**Interfejsy:**
- Konsumuje: `BARK_L, BARK_P, NADG_L, NADG_P, widoczne, skalaCiala, rampa, poziom` z `js/znaki/postawa.js` (bez zmian — wszystko już istnieje).
- Produkuje: `export const splot = { id: 'splot', nazwa: 'Splot Mokoszy', wymaga: 'pose', score(frame) -> 0..1, skladniki(frame) -> {krzyzowanie, wysokoscL, wysokoscP} | null }` — ten sam kształt interfejsu co pieczęcie dłoniowe (`score`/`skladniki`), żeby generyczny mechanizm `rozbicie` w `main.js` (już istniejący, nie modyfikowany) pokazywał diagnostykę tego znaku za darmo.

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-splot.mjs`:

```js
/**
 * Splot Mokoszy - znak skrzyżowanych ramion, bez dłoni i bez bioder.
 *
 *   node tools/test-splot.mjs
 *
 * Formuła skrzyżowania jest ponownie użyta z js/znaki/weles.js (stara,
 * odpięta postawa ciała) - sprawdzona, odporna na lustro. Jedyna zmiana:
 * wysokość liczona w szerokościach barków od linii barków, nie jako
 * ułamek odcinka bark->biodro - to jest cały powód, dla którego ten znak
 * nie potrzebuje bioder w kadrze.
 */
import { ZnakRegistry } from '../js/znaki/registry.js';
import { splot } from '../js/znaki/mokoszSplot.js';
import { perunDlon } from '../js/znaki/perunDlon.js';
import { welesDlon } from '../js/znaki/welesDlon.js';
import { swarogDlon } from '../js/znaki/swarogDlon.js';
import { dlon } from './_dlon-syntetyczna.mjs';

// Sylwetka odniesienia: barki 0.40 m rozstawu. Nadgarstki podaje wywołujący.
// `biodraNaN`: gdy true, biodra są NaN i niewidoczne - dowód, że splot
// działa BEZ nich (ograniczenie globalne #2 tego planu).
function cialo({ nadgL, nadgP, vis = 1, biodraNaN = false }) {
    const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: vis }));
    const p = (x, y) => ({ x, y, z: 0, visibility: vis });
    wl[11] = p(-0.20, -0.55); wl[12] = p(0.20, -0.55);   // barki
    wl[15] = p(nadgL[0], nadgL[1]); wl[16] = p(nadgP[0], nadgP[1]);
    wl[23] = biodraNaN ? { x: NaN, y: NaN, z: 0, visibility: 0 } : p(-0.12, 1.00);
    wl[24] = biodraNaN ? { x: NaN, y: NaN, z: 0, visibility: 0 } : p(0.12, 1.00);
    return wl;
}

const rej = new ZnakRegistry();
rej.zarejestruj(splot);
const ocen = (wl, hands = []) => rej.ocen({
    hands, pose: { landmarks: [], worldLandmarks: wl },
    width: 1920, height: 1080, dt: 1 / 60, now: 0
});

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

// Ramiona skrzyżowane na piersi - lewy nadgarstek po prawej stronie tułowia
// (x dodatnie, bo lewy bark ma x ujemne) i odwrotnie.
const POSTAWA_SPLOT = { nadgL: [0.15, -0.30], nadgP: [-0.15, -0.30] };

console.log('SPLOT:');
const a = ocen(cialo(POSTAWA_SPLOT));
spr(`postawa skrzyżowanych ramion zapala Splot (${a.splot.toFixed(2)})`, a.splot > 0.9);

// BEZ BIODER - dowód, że to jest ograniczenie globalne #2, nie przypadek.
const bezBioder = ocen(cialo({ ...POSTAWA_SPLOT, biodraNaN: true }));
spr(`Splot działa BEZ WIDOCZNYCH BIODER (NaN) (${bezBioder.splot.toFixed(2)})`, bezBioder.splot > 0.9);

// Ramiona NIESKRZYŻOWANE (obok siebie, nie na przeciwnych stronach) milczą.
const naWprost = ocen(cialo({ nadgL: [-0.20, -0.30], nadgP: [0.20, -0.30] }));
spr(`ramiona NA WPROST (nieskrzyżowane) NIE zapalają Splotu (${naWprost.splot.toFixed(2)})`, naWprost.splot < 0.2);

// Ramiona skrzyżowane, ale nad głową (za wysoko) - milczy.
const zaWysoko = ocen(cialo({ nadgL: [0.15, -1.20], nadgP: [-0.15, -1.20] }));
spr(`skrzyżowanie NAD GŁOWĄ NIE zapala Splotu (${zaWysoko.splot.toFixed(2)})`, zaWysoko.splot < 0.2);

// Ramiona skrzyżowane, ale przy pasie (za nisko) - milczy.
const zaNisko = ocen(cialo({ nadgL: [0.15, 0.60], nadgP: [-0.15, 0.60] }));
spr(`skrzyżowanie PRZY PASIE (za nisko) NIE zapala Splotu (${zaNisko.splot.toFixed(2)})`, zaNisko.splot < 0.2);

// LUSTRO: odbicie całej sylwetki (x -> -x) daje ten sam wynik.
const odbij = (wl) => wl.map(p => ({ ...p, x: -p.x }));
const lustro = ocen(odbij(cialo(POSTAWA_SPLOT)));
spr(`odbicie lustrzane daje ten sam wynik (${lustro.splot.toFixed(2)})`,
    Math.abs(lustro.splot - a.splot) < 0.02);

// BRAMKA WIDOCZNOŚCI: punkty niepewne to brak danych, nie "źle".
const slabe = ocen(cialo({ ...POSTAWA_SPLOT, vis: 0.2 }));
spr(`punkty niewidoczne -> 0, nie śmieć (${slabe.splot})`, slabe.splot === 0);

// Brak pozy, NaN w nadgarstku - zero, nie wyjątek.
const brakPozy = rej.ocen({ hands: [], pose: null, width: 1920, height: 1080, dt: 1 / 60, now: 0 });
spr(`brak pozy -> zero (${brakPozy.splot})`, brakPozy.splot === 0);
const zepsute = ocen(cialo({ nadgL: [NaN, NaN], nadgP: [-0.15, -0.30] }));
spr(`NaN w nadgarstku -> 0 (${zepsute.splot})`, zepsute.splot === 0);

// CIĄGŁOŚĆ: krzyżowanie ramion ma dawać rampę, nie skok 0->1.
console.log('\nCIĄGŁOŚĆ przy krzyżowaniu ramion:');
let poprz = 0, maxSkok = 0;
const poziomy = [];
for (let i = 0; i <= 80; i++) {
    const x = -0.35 + i * 0.005;   // obie ręce jadą naraz (x i -x)
    const s = ocen(cialo({ nadgL: [x, -0.30], nadgP: [-x, -0.30] })).splot;
    maxSkok = Math.max(maxSkok, Math.abs(s - poprz)); poprz = s;
    if (i % 16 === 0) poziomy.push(`${x.toFixed(3)}:${s.toFixed(2)}`);
}
console.log('  ' + poziomy.join('  '));
spr(`największy skok = ${maxSkok.toFixed(3)} (rampa, nie próg)`, maxSkok < 0.15);

// --- KOLIZJA MIĘDZY MODALNOŚCIAMI: splot (poza) vs pieczęcie dłoniowe ---
// pieczecie.js wybiera JEDEN najlepszy znak spośród WSZYSTKICH zarejestrowanych
// naraz, więc splot i pieczęcie dłoniowe będą w main.js w TYM SAMYM rejestrze
// oceniane na TEJ SAMEJ klatce - to jest realne ryzyko, nie formalność.
console.log('\nKOLIZJA Z PIECZĘCIAMI DŁONIOWYMI:');
const rejPelny = new ZnakRegistry();
rejPelny.zarejestruj(splot);
rejPelny.zarejestruj(perunDlon);
rejPelny.zarejestruj(welesDlon);
rejPelny.zarejestruj(swarogDlon);
const ocenPelny = (wl, hands) => rejPelny.ocen({
    hands, pose: { landmarks: [], worldLandmarks: wl },
    width: 1920, height: 1080, dt: 1 / 60, now: 0
});

const S = 0.09;
const TYGRYS = [1, 0, 0, 1, 1];
const PIESC = [1, 1, 1, 1, 1];
// Neutralna poza (ręce opuszczone) + dłonie złożone w Tygrysa Peruna.
const nadgrPozaNeutralna = { nadgL: [-0.30, 0.30], nadgP: [0.30, 0.30] };
const tygrysDlonie = [
    { landmarks: dlon({ ox: 0.455, zgiecia: TYGRYS, skala: S }), worldLandmarks: null, handedness: null },
    { landmarks: dlon({ ox: 0.545, zgiecia: TYGRYS, skala: S }), worldLandmarks: null, handedness: null }
];
const podczasPeruna = ocenPelny(cialo(nadgrPozaNeutralna), tygrysDlonie);
spr(`Tygrys Peruna (dłonie) + neutralna poza: Perun odpala (${podczasPeruna.perun.toFixed(2)})`,
    podczasPeruna.perun > 0.6);
spr(`  ...i NIE odpala Splotu (${podczasPeruna.splot.toFixed(2)})`, podczasPeruna.splot < 0.25);

// Splot (poza) + dłonie w spoczynku (pięści, neutralnie) nie odpala pieczęci dłoniowych.
const piescieDlonie = [
    { landmarks: dlon({ ox: 0.40, zgiecia: PIESC, skala: S }), worldLandmarks: null, handedness: null },
    { landmarks: dlon({ ox: 0.60, zgiecia: PIESC, skala: S }), worldLandmarks: null, handedness: null }
];
const podczasSplotu = ocenPelny(cialo(POSTAWA_SPLOT), piescieDlonie);
spr(`Splot (poza) + pięści w spoczynku (dłonie): Splot odpala (${podczasSplotu.splot.toFixed(2)})`,
    podczasSplotu.splot > 0.6);
spr(`  ...i NIE odpala żadnej pieczęci dłoniowej (weles ${podczasSplotu.weles.toFixed(2)}, perun ${podczasSplotu.perun.toFixed(2)}, swarog ${podczasSplotu.swarog.toFixed(2)})`,
    podczasSplotu.weles < 0.25 && podczasSplotu.perun < 0.25 && podczasSplotu.swarog < 0.25);

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-splot.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../js/znaki/mokoszSplot.js'`

- [ ] **Krok 3: Napisz `js/znaki/mokoszSplot.js`**

```js
/**
 * Splot Mokoszy - ramiona skrzyżowane na piersi, czytane WYŁĄCZNIE z barków
 * i nadgarstków. Żadnych bioder - to jest cały powód tego znaku.
 *
 * Stare postawy ciała (mokosz.js, weles.js - oba odpięte) wymagały kadru
 * z barkami I biodrami plus zapasem, czego kamera laptopa nie daje.
 * js/znaki/weles.js już implementował skrzyżowane ramiona, ale liczył
 * wysokość jako ułamek odcinka bark->biodro. Tu wysokość liczy się
 * w szerokościach barków OD LINII BARKÓW - stąd biodra nie są potrzebne.
 *
 * SKRZYŻOWANIE liczone jako ZNAK iloczynu, nie kolejność x - dokładnie
 * formuła z weles.js. MediaPipe podaje lewo/prawo względem OBRAZU, a płótno
 * ma scaleX(-1) (GEMINI.md:88). Przy odbiciu lustrzanym NEGUJĄ SIĘ oba
 * czynniki - różnica nadgarstków i różnica barków - więc iloczyn zostaje
 * bez zmian. Sprawdzenie samej kolejności x dawałoby wynik odwrotny w lustrze.
 */
import { BARK_L, BARK_P, NADG_L, NADG_P, widoczne, skalaCiala, rampa, poziom } from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka debug, D).
// KRZYZ_MIN/PELNY przeniesione WPROST z weles.js (js/znaki/weles.js) -
// ta sama fizyczna wielkość (skrzyżowanie w szerokościach barków), już
// sprawdzona testami tamtej postawy.
const KRZYZ_MIN = 0.05;    // nadgarstki ledwo minęły się w poprzek tułowia
const KRZYZ_PELNY = 0.5;   // wyraźnie po przeciwnych stronach

// Wysokość jako odległość OD LINII BARKÓW, w szerokościach barków (NIE ułamek
// odcinka bark->biodro jak w starym weles.js - stąd brak zależności od bioder).
const WYSOKOSC_IDEALNA = 0.5;   // nadgarstek pół szerokości barków POD barkami
const WYSOKOSC_TOLERANCJA = 0.6;

export const splot = {
    id: 'splot',
    nazwa: 'Splot Mokoszy',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;
        const sk = skladnikiZ(wl);
        return Math.min(sk.krzyzowanie, sk.wysokoscL, sk.wysokoscP);
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        return skladnikiZ(wl);
    }
};

function skladnikiZ(wl) {
    const skala = skalaCiala(wl);
    const yBarkow = poziom(wl, BARK_L, BARK_P);

    // Dodatnie, gdy nadgarstki leżą po stronach PRZECIWNYCH niż barki.
    const roznicaNadg = wl[NADG_L].x - wl[NADG_P].x;
    const roznicaBark = wl[BARK_L].x - wl[BARK_P].x;
    const krzyzowanie = rampa(-(roznicaNadg * Math.sign(roznicaBark)) / skala,
                              KRZYZ_MIN, KRZYZ_PELNY);

    return {
        krzyzowanie,
        wysokoscL: wysokoscKlatki(wl[NADG_L].y, yBarkow, skala),
        wysokoscP: wysokoscKlatki(wl[NADG_P].y, yBarkow, skala)
    };
}

/**
 * Trójkątna rampa wokół idealnej wysokości klatki piersiowej - ciągła
 * w OBIE strony, więc nadgarstek wędrujący w górę albo w dół gaśnie
 * płynnie, nie skokiem. Ten sam kształt co wysokoscPiersi w weles.js,
 * inna jednostka odniesienia (szerokości barków, nie odcinek do bioder).
 */
function wysokoscKlatki(y, yBarkow, skala) {
    const t = (y - yBarkow) / skala;
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, 1 - Math.abs(t - WYSOKOSC_IDEALNA) / WYSOKOSC_TOLERANCJA);
}
```

- [ ] **Krok 4: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-splot.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

- [ ] **Krok 5: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

Oczekiwane: wszystkie pliki `✓` — nowy znak jest addytywny i nigdzie jeszcze nie zarejestrowany w `main.js`.

- [ ] **Krok 6: Commit**

```bash
git add js/znaki/mokoszSplot.js tools/test-splot.mjs
git commit -m "Splot Mokoszy - znak skrzyżowanych ramion, bez dłoni i bez bioder

Czyta WYŁĄCZNIE barki i nadgarstki. Formuła skrzyżowania ponownie użyta
z js/znaki/weles.js (stara, odpięta postawa) - sprawdzona, odporna na
lustro przez znak iloczynu zamiast kolejności x. Jedyna zmiana: wysokość
liczona w szerokościach barków od linii barków, nie jako ułamek odcinka
bark->biodro - stąd brak zależności od bioder, które wcześniej wykluczały
postawy ciała na kamerze laptopa.

Test dowodzi rozdzielności od pieczęci dłoniowych w OBIE strony w jednym
rejestrze na raz - pieczecie.js wybiera jeden najlepszy znak spośród
wszystkich zarejestrowanych naraz, więc to realne ryzyko kolizji,
nie formalność.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 2: `js/tecza.js` — stan nagrody

**Files:**
- Create: `js/tecza.js`
- Test: `tools/test-tecza.mjs`

**Interfejsy:**
- Konsumuje: nic z gry — dostaje `ruch` (0..1) i `dt` (sekundy) jako argumenty `update()`.
- Produkuje: `class Tecza { aktywna: boolean; pozostaloS: number; barwaHue: number (0..360); silaSladu: number (0..1); aktywuj(): void; update(ruch, dt): void }`. Zadanie 5 czyta `motionMeter.responsywnosc` (już istniejące pole, `js/motionMeter.js:103` — "predkoscEfektywna zmapowana na 0..1") jako `ruch`.

- [ ] **Krok 1: Napisz test, który ma nie przejść**

Utwórz `tools/test-tecza.mjs`:

```js
/**
 * Tecza - stan nagrody: 30 s darmowej wstęgi po 3x złożeniu Splotu.
 *
 *   node tools/test-tecza.mjs
 *
 * Bez zależności od DOM - czysty stan, żadnego rysowania (to robi aura.js).
 */
import { Tecza } from '../js/tecza.js';

const DT = 1 / 60;

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

// --- 1. Świeża Tecza jest nieaktywna ---
console.log('STAN POCZĄTKOWY:');
const t1 = new Tecza();
spr('świeża Tecza jest nieaktywna', t1.aktywna === false);
spr('  ...i siła śladu wynosi zero', t1.silaSladu === 0);

// --- 2. Aktywacja ustawia pełne 30 s ---
console.log('\nAKTYWACJA:');
const t2 = new Tecza();
t2.aktywuj();
spr(`aktywuj() ustawia aktywną (${t2.aktywna})`, t2.aktywna === true);
spr(`  ...i pełne 30 s (${t2.pozostaloS})`, t2.pozostaloS === 30);

// --- 3. Licznik odlicza w czasie ---
console.log('\nODLICZANIE:');
const t3 = new Tecza();
t3.aktywuj();
for (let i = 0; i < 60; i++) t3.update(0, DT);   // 1 s
spr(`po 1 s pozostało ~29 s (${t3.pozostaloS.toFixed(2)})`, Math.abs(t3.pozostaloS - 29) < 0.05);
spr('  ...dalej aktywna', t3.aktywna === true);

// --- 4. Odnowienie w trakcie RESTARTUJE, nie sumuje ---
console.log('\nODNOWIENIE:');
const t4 = new Tecza();
t4.aktywuj();
for (let i = 0; i < 60 * 20; i++) t4.update(0, DT);   // 20 s - zostało 10 s
spr(`po 20 s zostało ~10 s (${t4.pozostaloS.toFixed(1)})`, Math.abs(t4.pozostaloS - 10) < 0.1);
t4.aktywuj();   // odnowienie
spr(`odnowienie RESTARTUJE do pełnych 30 s, nie sumuje (${t4.pozostaloS})`, t4.pozostaloS === 30);

// --- 5. Siła śladu: pełna przez 27 s, rampa w ostatnich 3 s, zero po wygaśnięciu ---
console.log('\nSIŁA ŚLADU (wygaszanie):');
const t5 = new Tecza();
t5.aktywuj();
for (let i = 0; i < 60 * 10; i++) t5.update(0, DT);   // 10 s - dużo czasu, pełna siła
spr(`siła śladu pełna daleko przed końcem (${t5.silaSladu.toFixed(2)})`, t5.silaSladu === 1);
for (let i = 0; i < 60 * 18.5; i++) t5.update(0, DT);   // razem 28.5 s - 1.5 s do końca
spr(`siła śladu W RAMPIE 1.5 s przed końcem (${t5.silaSladu.toFixed(2)})`,
    t5.silaSladu > 0.3 && t5.silaSladu < 0.7);
for (let i = 0; i < 60 * 2; i++) t5.update(0, DT);   // dobija do i za koniec
spr(`po wygaśnięciu aktywna=false (${t5.aktywna})`, t5.aktywna === false);
spr(`  ...i siła śladu dokładnie zero (${t5.silaSladu})`, t5.silaSladu === 0);
spr(`  ...i pozostaloS nie schodzi poniżej zera (${t5.pozostaloS})`, t5.pozostaloS === 0);

// --- 6. Barwa reaguje na ruch: stój = leniwie, ruch = szybciej ---
console.log('\nTEMPO BARWY ZALEŻNE OD RUCHU:');
const stojacy = new Tecza(); stojacy.aktywuj();
const tanczacy = new Tecza(); tanczacy.aktywuj();
for (let i = 0; i < 60; i++) {
    stojacy.update(0, DT);      // bezruch
    tanczacy.update(1, DT);     // pełny ruch
}
spr(`bezruch NADAL przesuwa barwę - "leniwie", nie zamrożone (${stojacy.barwaHue.toFixed(1)}°)`,
    stojacy.barwaHue > 0);
spr(`pełny ruch przesuwa barwę SZYBCIEJ niż bezruch (${tanczacy.barwaHue.toFixed(1)}° > ${stojacy.barwaHue.toFixed(1)}°)`,
    tanczacy.barwaHue > stojacy.barwaHue * 1.5);

// --- 7. Barwa zawija się w 0..360 ---
console.log('\nZAWIJANIE BARWY:');
const t7 = new Tecza(); t7.aktywuj();
for (let i = 0; i < 60 * 30; i++) t7.update(1, DT);   // pełne 30 s pełnego ruchu
spr(`barwa zostaje w 0..360 (${t7.barwaHue.toFixed(1)}°)`, t7.barwaHue >= 0 && t7.barwaHue < 360);

// --- 8. update() na nieaktywnej Teczy jest bezpiecznym no-opem ---
console.log('\nODPORNOŚĆ:');
const t8 = new Tecza();
t8.update(1, DT);
spr('update() na nieaktywnej nie aktywuje jej', t8.aktywna === false);
spr('  ...i nie rusza barwy', t8.barwaHue === 0);

// NaN dt / NaN ruch nie wywracają stanu.
const t9 = new Tecza(); t9.aktywuj();
t9.update(NaN, NaN);
spr('NaN ruch + NaN dt -> bez wyjątku', Number.isFinite(t9.pozostaloS) && Number.isFinite(t9.barwaHue));
spr('  ...i nadal aktywna (NaN dt = brak upływu czasu)', t9.aktywna === true);

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-tecza.mjs
```

Oczekiwane: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../js/tecza.js'`

- [ ] **Krok 3: Napisz `js/tecza.js`**

```js
/**
 * Tecza - stan nagrody Wstęgi Mokoszy: 30 s darmowej tęczy po 3x złożeniu
 * Splotu. Nie rysuje - tym zajmuje się js/aura.js (bufor śladu, czyta
 * ten stan przez updateAndDraw()).
 *
 * Ten sam podział co plonacyPalec.js/podmuch.js (stan oddzielony od
 * rysowania), ale prostszy cykl: BEZCZYNNY -> AKTYWNA -> BEZCZYNNY, bez
 * drugiego gestu. aktywuj() startuje natychmiast - to jest odpowiedź
 * na ograniczenie globalne #6 tego planu.
 */

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
const CZAS_TRWANIA_S = 30;
const CZAS_WYGASZANIA_S = 3;     // ostatnie 3 s - ślad się skraca, nie ucina

// Tempo obrotu barwy. MIN > 0 celowo - "stoisz, tęcza płynie leniwie"
// (spec), nie zamrożona. MAX to pełny obrót co ~1.6 s przy pełnym ruchu.
const OBROT_MIN_DEG_S = 24;
const OBROT_MAX_DEG_S = 220;

export class Tecza {
    constructor() {
        this.aktywna = false;
        this.pozostaloS = 0;
        this.barwaHue = 0;
        this.silaSladu = 0;
    }

    /** Kombos splot x3 złożony. Zawsze RESTARTUJE licznik - nigdy nie sumuje. */
    aktywuj() {
        this.aktywna = true;
        this.pozostaloS = CZAS_TRWANIA_S;
    }

    /**
     * @param {number} ruch  0..1 - ciągłość ruchu (motionMeter.responsywnosc)
     * @param {number} dt    sekundy
     */
    update(ruch, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        if (!this.aktywna) {
            this.silaSladu = 0;
            return;
        }

        this.pozostaloS -= krok;
        if (this.pozostaloS <= 0) {
            this.aktywna = false;
            this.pozostaloS = 0;
            this.silaSladu = 0;
            return;
        }

        const r = Number.isFinite(ruch) ? Math.max(0, Math.min(1, ruch)) : 0;
        const tempo = OBROT_MIN_DEG_S + (OBROT_MAX_DEG_S - OBROT_MIN_DEG_S) * r;
        this.barwaHue = (this.barwaHue + tempo * krok) % 360;

        // Rampa wygaszania: pełna siła, dopóki zostało więcej niż
        // CZAS_WYGASZANIA_S, potem liniowo do zera - to jest "ślad się
        // skraca", nie ucięcie.
        this.silaSladu = this.pozostaloS >= CZAS_WYGASZANIA_S
            ? 1
            : this.pozostaloS / CZAS_WYGASZANIA_S;
    }
}
```

- [ ] **Krok 4: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-tecza.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

- [ ] **Krok 5: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

- [ ] **Krok 6: Commit**

```bash
git add js/tecza.js tools/test-tecza.mjs
git commit -m "Tecza - stan nagrody: 30s darmowej wstęgi, restart nie sumowanie

Cykl BEZCZYNNY -> AKTYWNA -> BEZCZYNNY bez drugiego gestu - aktywuj()
startuje natychmiast, w przeciwieństwie do wzorca uzbrój-potem-gest
z ognia i podmuchu. Odnowienie w trakcie trwania zawsze RESTARTUJE
licznik do pełnych 30 s, nigdy nie sumuje - złożone pieczęcie nigdy
się nie marnują.

Tempo obrotu barwy ma dolną granicę większą od zera - bezruch daje
'leniwe płynięcie', nie zamrożoną tęczę. To jest odpowiedź na 'zabawę
ruchem' ze zgłoszenia: tempo rośnie z motionMeter.responsywnosc.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 3: `js/aura.js` — bufor śladu i tęczowa barwa

**Files:**
- Modify: `js/aura.js` (cały plik — `_barwa()` wydzielona i eksportowana jako `barwaAury()`, nowy bufor `_slad`, zmieniona sygnatura `updateAndDraw`)
- Test: `tools/test-aura-impuls.mjs` (rozszerzenie — dopisanie testów `barwaAury()`, ten sam plik, bo dotyczy tej samej klasy)

**Interfejsy:**
- Konsumuje: `{aktywna, barwaHue, silaSladu}` z `js/tecza.js` (Zadanie 2) — Zadanie 5 przekazuje instancję `Tecza` jako nowy, ostatni parametr `updateAndDraw`.
- Produkuje:
  - `export function barwaAury(plynnosc, tecza) -> {h: number, s: number}` — czysta funkcja, wydzielona z prywatnej metody `_barwa()`, testowalna bez DOM.
  - `updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt, tecza = null)` — sygnatura rośnie o jeden opcjonalny parametr na końcu; wywołania bez niego (jeśli jakiekolwiek istniałyby) zachowują się identycznie jak dziś.

**Dlaczego test nie sprawdza samego bufora śladu:** rysowanie (`_rysuj`-podobna część `updateAndDraw`) wymaga `document.createElement('canvas')`, którego nie ma w Node - ten sam powód, dla którego `ogien.js`/`fala.js` nie mają testów rysowania. `barwaAury()` jest wydzielona SPECJALNIE po to, żeby logika wyboru barwy (normalna vs. tęczowa) była testowalna mimo to - ten sam wzorzec co `rzutPerspektywiczny`/`rzutujPozycje` w `fala.js`.

- [ ] **Krok 1: Dopisz test do `tools/test-aura-impuls.mjs`, który ma nie przejść**

Zmień istniejący import na górze pliku (dopisanie `barwaAury` obok `Aura`):

```js
import { Aura, barwaAury } from '../js/aura.js';
```

Plik KOŃCZY SIĘ dziś linią `process.exit(ok ? 0 : 1);` (po bloku `ODPORNOŚĆ NA NaN`). **Usuń tę linię** - poniższy blok dostarcza nowy, jedyny `process.exit` na końcu pliku. Bez usunięcia starej linii JS zakończyłby proces na pierwszym wystąpieniu i nowe testy w ogóle by się nie wykonały.

Dopisz w jej miejsce, na końcu pliku:

```js
console.log('\nBARWA - normalna vs. tęczowa:');

// Bez tęczy: zachowanie IDENTYCZNE jak dziś - interpolacja bursztyn<->fiolet
// po płynności. Wartości referencyjne z _barwa() sprzed wydzielenia.
const plynna = barwaAury(1, null);
spr(`płynność=1 daje bursztyn (h=${plynna.h.toFixed(0)})`, Math.abs(plynna.h - 35) < 1);
const szarpana = barwaAury(0, null);
spr(`płynność=0 daje fiolet (h=${szarpana.h.toFixed(0)})`, Math.abs(szarpana.h - 265) < 1);
const posrednia = barwaAury(0.5, null);
spr(`płynność=0.5 jest DOKŁADNIE między nimi (h=${posrednia.h.toFixed(0)})`,
    Math.abs(posrednia.h - (35 + 265) / 2) < 1);

// Z NIEAKTYWNĄ teczą (aktywna: false) - też normalne zachowanie, płynność
// dalej rządzi, niezależnie od tego, co niesie barwaHue.
const teczaNieaktywna = { aktywna: false, barwaHue: 999, silaSladu: 0 };
const zNieaktywna = barwaAury(1, teczaNieaktywna);
spr(`tecza NIEaktywna -> zachowanie normalne, ignoruje barwaHue (h=${zNieaktywna.h.toFixed(0)})`,
    Math.abs(zNieaktywna.h - 35) < 1);

// Z AKTYWNĄ teczą: barwa idzie z tecza.barwaHue, NIEZALEŻNIE od płynności.
const teczaAktywna = { aktywna: true, barwaHue: 180, silaSladu: 1 };
const zAktywna1 = barwaAury(1, teczaAktywna);
const zAktywna0 = barwaAury(0, teczaAktywna);
spr(`tecza AKTYWNA -> barwa z barwaHue (${zAktywna1.h}), NIE z płynności`,
    zAktywna1.h === 180);
spr(`  ...niezależnie od płynności (${zAktywna1.h} === ${zAktywna0.h})`,
    zAktywna1.h === zAktywna0.h);

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-aura-impuls.mjs
```

Oczekiwane: `SyntaxError` albo `TypeError` — `barwaAury` nie jest eksportowane z `js/aura.js`.

- [ ] **Krok 3: Wydziel `barwaAury()` i dodaj bufor śladu w `js/aura.js`**

Zastąp obecną metodę `_barwa()` (i miejsce jej wywołania) w `js/aura.js`:

```js
    _barwa() {
        const t = Math.max(0, Math.min(1, this._plynnosc));
        return {
            h: BARWA_SZARPANA.h + (BARWA_PLYNNA.h - BARWA_SZARPANA.h) * t,
            s: BARWA_SZARPANA.s + (BARWA_PLYNNA.s - BARWA_SZARPANA.s) * t
        };
    }
```

na wywołanie modułowej funkcji (usuń metodę z klasy):

Dopisz PRZED `export class Aura {`:

```js
// Nasycenie tęczy - dobrane do żywości istniejących barw (70-95).
// ZGADNIĘTE - potwierdzić z nakładki (D).
const TECZA_NASYCENIE = 88;

/**
 * Barwa aury: normalnie interpoluje bursztyn<->fiolet po płynności ruchu.
 * Gdy `tecza.aktywna`, PRZYKRYWA to i idzie z tecza.barwaHue - to jest
 * warstwa nagrody z docs/superpowers/specs/2026-08-12-splot-i-tecza-design.md.
 *
 * Wydzielona jako czysta funkcja (nie metoda klasy) - żeby dało się ją
 * przetestować bez document (updateAndDraw() tworzy płótna, których nie
 * ma w Node), tym samym wzorcem co rzutPerspektywiczny w fala.js.
 */
export function barwaAury(plynnosc, tecza) {
    if (tecza && tecza.aktywna) {
        return { h: tecza.barwaHue, s: TECZA_NASYCENIE };
    }
    const t = Math.max(0, Math.min(1, Number.isFinite(plynnosc) ? plynnosc : 1));
    return {
        h: BARWA_SZARPANA.h + (BARWA_PLYNNA.h - BARWA_SZARPANA.h) * t,
        s: BARWA_SZARPANA.s + (BARWA_PLYNNA.s - BARWA_SZARPANA.s) * t
    };
}
```

W metodzie `updateAndDraw`, zmień sygnaturę i miejsce wywołania barwy:

```js
    updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt) {
```
na:
```js
    updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt, tecza = null) {
```

oraz:
```js
        const { h, s } = this._barwa();
```
na:
```js
        const { h, s } = barwaAury(this._plynnosc, tecza);
```

Dodaj bufor śladu do konstruktora - w `constructor(canvas, ctx)`, po `this._pracaCtx = null;`:

```js
        this._slad = null;      // bufor akumulacyjny tęczowego śladu
        this._sladCtx = null;
```

W `_przygotujPlotna(szer, wys)`, dopisz tworzenie i skalowanie `_slad` obok `_maska`/`_praca`:

```js
    _przygotujPlotna(szer, wys) {
        if (!this._maska) {
            this._maska = document.createElement('canvas');
            this._maskaCtx = this._maska.getContext('2d');
            this._praca = document.createElement('canvas');
            this._pracaCtx = this._praca.getContext('2d');
            this._slad = document.createElement('canvas');
            this._sladCtx = this._slad.getContext('2d');
        }
        if (this._maska.width !== szer || this._maska.height !== wys) {
            this._maska.width = this._praca.width = this._slad.width = szer;
            this._maska.height = this._praca.height = this._slad.height = wys;
            this._obraz = this._maskaCtx.createImageData(szer, wys);
        }
    }
```

W `updateAndDraw`, TUŻ PRZED pętlą `for (const p of PRZEBIEGI) {`, dopisz obsługę śladu i wybór źródła rozmycia:

```js
        // --- Bufor śladu: przygasza się ZAWSZE (nawet po wygaśnięciu tęczy,
        // żeby stary ślad dogasł, a nie zamarzł), dopisuje nową sylwetkę
        // TYLKO gdy tecza aktywna. Koszt stały: jeden fillRect na przygaszenie
        // plus jeden drawImage+fillRect na dopisanie - ZERO dodatkowych
        // przebiegów rozmycia ponad te trzy z PRZEBIEGI, bo blur niżej i tak
        // już się wykonywał; zmienia się tylko to, JAKIE płótno rozmywa.
        const zanik = 1 - Math.exp(-krokCzasu / TAU_SLADU);
        this._sladCtx.globalCompositeOperation = 'destination-out';
        this._sladCtx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, zanik)).toFixed(3)})`;
        this._sladCtx.fillRect(0, 0, pw, ph);
        this._sladCtx.globalCompositeOperation = 'source-over';

        if (tecza && tecza.aktywna) {
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.drawImage(this._maska, 0, 0);
            pc.globalCompositeOperation = 'source-in';
            pc.fillStyle = `hsla(${tecza.barwaHue}, ${TECZA_NASYCENIE}%, 55%, ${Math.max(0, Math.min(1, tecza.silaSladu))})`;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';
            this._sladCtx.drawImage(this._praca, 0, 0);
        }

        const zrodloRozmycia = (tecza && tecza.silaSladu > 0.001) ? this._slad : this._maska;
```

**UWAGA - `krokCzasu` i `pw`/`ph`:** metoda już ma `dt` jako parametr (surowe, niewygładzone - to jest inny `dt` niż `TAU_WYGLADZANIA`), i `pw`/`ph`/`pc` są już zdefiniowane wcześniej w metodzie (`const pw = this._praca.width, ph = this._praca.height;` i `const pc = this._pracaCtx;`) - upewnij się, że blok powyżej wstawiasz PO tych deklaracjach, nie przed. Dodaj stałą `TAU_SLADU` obok innych stałych czasowych na górze pliku:

```js
// Stała czasowa zaniku śladu - przy TAU=0.5 s ślad dogasa do ~5% po 1.5 s
// (3 tau), zgodnie ze spec ("dogasające po ~1,5 s"). ZGADNIĘTE - D.
const TAU_SLADU = 0.5;
```

Na koniec, w pętli `for (const p of PRZEBIEGI) { ... }`, zmień DWA miejsca:

1. `pc.drawImage(this._maska, 0, 0);` (pierwsze wystąpienie, zaraz po `pc.filter = ...blur...`) → `pc.drawImage(zrodloRozmycia, 0, 0);`
2. Blok barwienia płaskim kolorem:
```js
            pc.globalCompositeOperation = 'source-in';
            pc.fillStyle = kolor;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';
```
owiń warunkiem - barwienie płaskim kolorem tylko gdy ŹRÓDŁEM jest surowa maska (`_slad` już niesie kolor per piksel, bo dopisywaliśmy go wyżej):
```js
            if (zrodloRozmycia === this._maska) {
                pc.globalCompositeOperation = 'source-in';
                pc.fillStyle = kolor;
                pc.fillRect(0, 0, pw, ph);
                pc.globalCompositeOperation = 'source-over';
            }
```

**Krok wytnijWnetrze zostaje BEZ ZMIAN** (nadal `pc.drawImage(this._maska, 0, 0)`, nigdy `_slad`) - wycięcie ma używać BIEŻĄCEJ, ostrej sylwetki niezależnie od tego, co rozmywamy, żeby ciało zawsze prześwitywało czysto przez środek poświaty/śladu.

- [ ] **Krok 4: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-aura-impuls.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

- [ ] **Krok 5: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

- [ ] **Krok 6: Commit**

```bash
git add js/aura.js tools/test-aura-impuls.mjs
git commit -m "Aura: bufor śladu i tęczowa barwa dla Wstęgi Mokoszy

barwaAury() wydzielona z prywatnej metody _barwa() do czystej, eksportowanej
funkcji - ten sam wzorzec co rzutPerspektywiczny/rzutujPozycje w fala.js,
bo updateAndDraw() tworzy płótna (document.createElement), których nie ma
w Node, i bez wydzielenia logika wyboru barwy byłaby nietestowalna.

Bufor śladu (_slad) to jedno dodatkowe płótno w rozdzielczości maski,
przygaszane wykładniczo co klatkę i dopisywane bieżącą, otagowaną kolorem
sylwetką TYLKO gdy tecza aktywna. Koszt jest stały niezależnie od długości
śladu: jedno przygaszenie plus jedno dopisanie, ZERO dodatkowych przebiegów
rozmycia ponad trzy, które PRZEBIEGI już wykonywały - zmienia się tylko,
które płótno te trzy przebiegi rozmywają.

Przygaszenie działa ZAWSZE, gdy bufor istnieje (nawet po wygaśnięciu
tęczy) - stary ślad dogasa do zera zamiast zamarzać jako duch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 4: `js/kombosy.js` — wiersz `splot×3 → tecza`

**Files:**
- Modify: `js/kombosy.js:25-44` (tabela `KOMBOSY`)
- Test: `tools/test-kombosy.mjs` (rozszerzenie)

**Interfejsy:**
- Konsumuje: nic nowego — silnik `KomboSilnik`/`_dopasuj()` już obsługuje sekwencje dowolnej długości, dopasowując do końcówki bufora (patrz `weles×2 → aard`, ten sam mechanizm dla trójki zamiast pary).
- Produkuje: nowy wpis `{ id: 'tecza', nazwa: 'Wstęga Mokoszy', sekwencja: ['splot', 'splot', 'splot'], uzbraja: 'tecza' }` w eksportowanej tablicy `KOMBOSY`. Zadanie 5 routuje po `uzbraja === 'tecza'`.

- [ ] **Krok 1: Dopisz test, który ma nie przejść**

Plik `tools/test-kombosy.mjs` kończy się dziś linią `process.exit(ok ? 0 : 1);`. **Usuń tę linię** i dopisz w jej miejsce, na końcu pliku (poniższy blok dostarcza nowy, jedyny `process.exit`):

```js
// --- SEKWENCJA TRÓJELEMENTOWA: splot x3 -> tecza ---
console.log('\nTRÓJELEMENTOWA SEKWENCJA (splot x3):');
const k9 = new KomboSilnik();
spr('pierwszy splot nie odpala', k9.dodaj('splot', 0) === null);
spr('drugi splot nie odpala (jeszcze za krótka sekwencja)', k9.dodaj('splot', 500) === null);
const tecza1 = k9.dodaj('splot', 1000);
spr(`trzeci splot odpala Teczę (${tecza1?.id})`, tecza1?.id === 'tecza');

// Czwarty splot z rzędu odpala PONOWNIE - dopasowanie do końcówki bufora,
// to samo celowe zachowanie łańcuchów co przy weles x2 -> aard.
const tecza2 = k9.dodaj('splot', 1500);
spr(`czwarty splot odpala PONOWNIE - jawne zachowanie łańcucha (${tecza2?.id})`, tecza2?.id === 'tecza');

// Pole uzbraja obejmuje teraz TRZY wartości, nie dwie.
spr('każdy kombos deklaruje, którą technikę uzbraja (ogien/aard/tecza)',
    KOMBOSY.every(k => k.uzbraja === 'ogien' || k.uzbraja === 'aard' || k.uzbraja === 'tecza'));

process.exit(ok ? 0 : 1);
```

- [ ] **Krok 2: Uruchom test i potwierdź, że nie przechodzi**

```bash
node tools/test-kombosy.mjs
```

Oczekiwane: `trzeci splot odpala Teczę (undefined)` — `✗`, bo wiersza jeszcze nie ma w `KOMBOSY`.

- [ ] **Krok 3: Dopisz wiersz do `js/kombosy.js`**

W `js/kombosy.js`, w tablicy `KOMBOSY`, po wierszu `aard`:

```js
    { id: 'aard', nazwa: 'Podmuch Striboga', sekwencja: ['weles', 'weles'], uzbraja: 'aard' },

    // Splot x3 -> Tecza. TRZY złożenia, nie dwie - dłuższy rytuał niż
    // Ogień/Aard, bo nagroda jest darmowa przez 30 s (żaden dalszy koszt),
    // więc próg wejścia jest wyższy. uzbraja: 'tecza' NIE pasuje do wzorca
    // uzbrój-potem-gest (Ogień/Aard czekają na osobny gest gracza) -
    // main.js routuje tę gałąź na natychmiastową aktywację, bez drugiego
    // gestu. Splot to nowy znak z ciała (skrzyżowane ramiona), nie z dłoni -
    // patrz js/znaki/mokoszSplot.js.
    { id: 'tecza', nazwa: 'Wstęga Mokoszy', sekwencja: ['splot', 'splot', 'splot'], uzbraja: 'tecza' }
```

- [ ] **Krok 4: Uruchom test i potwierdź, że przechodzi**

```bash
node tools/test-kombosy.mjs
```

Oczekiwane: wszystkie `✓`, kod wyjścia 0.

- [ ] **Krok 5: Uruchom pełny zestaw testów**

```bash
sh tools/test-wszystko.sh
```

- [ ] **Krok 6: Commit**

```bash
git add js/kombosy.js tools/test-kombosy.mjs
git commit -m "Kombos: splot x3 -> Wstęga Mokoszy (Tecza)

Trójelementowa sekwencja - dłuższy rytuał niż Ogień/Aard (dwa złożenia),
bo nagroda jest darmowa przez 30 s bez dalszego kosztu, więc próg wejścia
jest wyższy. Silnik dopasowania do końcówki bufora już obsługuje dowolną
długość sekwencji bez zmian - ten sam mechanizm, który obsługuje pary.

uzbraja: 'tecza' to trzecia gałąź obok 'ogien'/'aard', nie ich wariant -
main.js (Zadanie 5) routuje ją na natychmiastową aktywację nagrody, bez
drugiego gestu uzbrajanego wcześniej.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Zadanie 5: Wpięcie w `js/main.js`, `js/efekty.js`, `js/debugHud.js`

**Files:**
- Modify: `js/main.js` (import + rejestracja znaku, instancja `Tecza`, routing `uzbraja === 'tecza'`, wywołanie `tecza.update()`, dodatkowy parametr do `aura.updateAndDraw`)
- Modify: `js/efekty.js:34-49` (`TABELA` — wiersze `splot` i `tecza`)
- Modify: `js/debugHud.js` (diagnostyka `tecza` — `splot` korzysta z już istniejącego mechanizmu `postawy`/`rozbicie`, bez zmian w `debugHud.js`)

**Interfejsy:**
- Konsumuje: `splot` (Zadanie 1), `Tecza`/`barwaAury` (Zadania 2-3, `barwaAury` pośrednio przez `aura.js`), `KOMBOSY` z polem `uzbraja: 'tecza'` (Zadanie 4).
- Produkuje: brak nowego eksportu — to jest integracja, weryfikowana testem regresji i na żywym ciele.

- [ ] **Krok 1: Dopisz importy i instancję w `js/main.js`**

Po `import { swarogDlon } from './znaki/swarogDlon.js';`:

```js
import { swarogDlon } from './znaki/swarogDlon.js';
import { splot } from './znaki/mokoszSplot.js';
```

Po `import { Fala } from './fala.js';`:

```js
import { Fala } from './fala.js';
import { Tecza } from './tecza.js';
```

W bloku rejestracji znaków, po `znaki.zarejestruj(welesDlon);` i przed `znaki.zarejestruj(perunDlon);` (albo w dowolnym miejscu grupy `zarejestruj` — kolejność nie ma znaczenia dla wyniku):

```js
znaki.zarejestruj(welesDlon);
znaki.zarejestruj(perunDlon);
znaki.zarejestruj(swarogDlon);
// Splot Mokoszy - jedyny znak czytany z POZY w aktywnym zestawie (reszta
// to pieczęcie dłoniowe). Bez bioder w PUNKTY, więc kamera laptopa mu
// wystarcza - patrz js/znaki/mokoszSplot.js.
znaki.zarejestruj(splot);
```

Po `let fala = new Fala();`:

```js
let fala = new Fala();
let tecza = new Tecza();
```

- [ ] **Krok 2: Dodaj gałąź routingu `uzbraja === 'tecza'`**

W bloku `if (technika) { ... }`, znajdź:

```js
            if (technika.uzbraja === 'ogien') {
                plonacyPalec.uzbrój();
            } else if (technika.uzbraja === 'aard') {
                podmuch.uzbrój();
            }
```

Zamień na:

```js
            if (technika.uzbraja === 'ogien') {
                plonacyPalec.uzbrój();
            } else if (technika.uzbraja === 'aard') {
                podmuch.uzbrój();
            } else if (technika.uzbraja === 'tecza') {
                // Nagroda odpala się NATYCHMIAST, bez drugiego gestu -
                // inaczej niż 'ogien'/'aard', które tylko UZBRAJAJĄ technikę
                // czekającą na osobny gest gracza. aktywuj() (re)startuje
                // licznik do pełnych 30 s bezwarunkowo.
                tecza.aktywuj();
            }
```

- [ ] **Krok 3: Wepnij `tecza.update()` i dodatkowy parametr do `aura.updateAndDraw`**

Znajdź wywołanie sekcji „--- 7. Aura ---":

```js
    // --- 7. Aura ---
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt);
```

Zamień na:

```js
    // --- 7. Aura ---
    // tecza.update() PRZED aura.updateAndDraw(), żeby aura czytała stan
    // z tej samej klatki (tempo obrotu barwy zależy od motionMeter.responsywnosc -
    // "stoisz, tęcza płynie leniwie; tańczysz, wiruje" ze spec).
    tecza.update(motionMeter.responsywnosc, dt);
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt, tecza);
```

- [ ] **Krok 4: Dodaj diagnostykę `tecza` do nakładki debug**

W `js/main.js`, w obiekcie przekazywanym do `debugHud.updatePanel(frame, {...})`, po polu `podmuch: {...}`:

```js
        podmuch: { stan: podmuch.stan, diagnostyka: podmuch.diagnostyka,
                   czastkiFali: fala.liczba,
                   progPredkosci: PROG_PREDKOSCI, progOtwarcia: PROG_OTWARCIA },
        tecza: { aktywna: tecza.aktywna, pozostaloS: tecza.pozostaloS,
                 barwaHue: tecza.barwaHue, silaSladu: tecza.silaSladu },
```

W `js/debugHud.js`, po bloku `if (stats.podmuch) { ... }`, dopisz nową sekcję:

```js
        // Stan Wstęgi Mokoszy - progi Splotu (KRZYZ_MIN/PELNY, WYSOKOSC_*)
        // widać już przez ogólny mechanizm stats.rozbicie (znak ma
        // skladniki()), więc tu tylko licznik i barwa samej nagrody.
        if (stats.tecza) {
            const t = stats.tecza;
            lines.push(`tecza ${t.aktywna ? 'AKTYWNA' : 'nieaktywna'}` +
                       `${t.aktywna ? `  pozostało ${t.pozostaloS.toFixed(1)} s` : ''}` +
                       `${t.aktywna ? `  hue ${t.barwaHue.toFixed(0)}°` : ''}` +
                       `${t.aktywna ? `  siła śladu ${this._num(t.silaSladu)}` : ''}`);
        }
```

- [ ] **Krok 5: Dodaj wiersze `splot` i `tecza` do `js/efekty.js`**

W `js/efekty.js`, w `TABELA`, po wierszu `weles`:

```js
    weles:  { barwa: '280, 70%, 58%',  ksztalt: 'sciagniecie', czas: 0.9 },
    // szczur celowo NIEOBECNY - pieczęć odpięta (js/main.js), znak
    // js/znaki/szczurDlon.js zostaje na dysku i mógłby dostać ten wpis
    // z powrotem, gdyby wrócił.
    splot:  { barwa: '270, 65%, 62%',  ksztalt: 'sciagniecie', czas: 0.9 },
```

Po wierszu `aard` (przed zamykającym `};`):

```js
    aard:         { barwa: '200, 70%, 88%', ksztalt: 'pierscien',  czas: 0.8 },
    // Błysk AKTYWACJI nagrody - jednorazowy, jedna barwa (TABELA nie umie
    // prawdziwej tęczy). Sama tęczowa wstęga żyje w aura.js/tecza.js i
    // trwa 30 s niezależnie od tego krótkiego błysku.
    tecza:        { barwa: '0, 0%, 100%',   ksztalt: 'blyskIFala', czas: 1.2 }
```

- [ ] **Krok 6: Sprawdź składnię i uruchom pełny zestaw testów**

```bash
node --check js/main.js && node --check js/debugHud.js && node --check js/efekty.js && echo OK
sh tools/test-wszystko.sh
```

Oczekiwane: `OK`, potem wszystkie pliki `✓`, w tym `test-splot.mjs` i `test-tecza.mjs` z Zadań 1-2.

- [ ] **Krok 7: Sprawdź na żywym ciele**

```bash
YARN_IGNORE_ENGINES=true python3 -m http.server 8000
```

Otwórz `http://localhost:8000`, włącz nakładkę (`D`) i:

1. Skrzyżuj ramiona na piersi, przytrzymaj — nakładka (`znak`/`splot` w wierszu `postawy`) powinna pokazać rosnący wynik, a pierścień pieczęci zacząć się wypełniać.
2. Powtórz trzykrotnie pod rząd (w oknie ~4 s między złożeniami) — nakładka `tecza` powinna pokazać `AKTYWNA`, `pozostało 30.0 s`.
3. Zatańcz — barwa aury powinna przełączyć się na tęczę i za sylwetką powinien ciągnąć się kolorowy ślad; im szybszy ruch, tym szybciej barwa się zmienia.
4. Stój bez ruchu przez chwilę z aktywną tęczą — barwa nadal powinna się przesuwać, tylko wolniej (nie zamrożona).
5. Poczekaj do końca 30 s (albo przewiń w kodzie na krótszy czas testowo) — ostatnie ~3 s ślad powinien się skracać, nie urywać nagle.
6. Zaobserwuj FPS w nakładce przy aktywnej tęczy z ruchem — musi zostać ≥ 24.
7. Spróbuj złożyć pieczęć dłoniową (np. Perun) mając ramiona luźno opuszczone, i odwrotnie — żadna nie powinna przypadkiem odpalać drugiej.

- [ ] **Krok 8: Commit**

```bash
git add js/main.js js/efekty.js js/debugHud.js
git commit -m "Wpięcie Splotu i Tęczy w pętlę gry

Splot Mokoszy zarejestrowany w ZnakRegistry obok pieczęci dłoniowych -
jedyny aktywny znak czytany z pozy, nie z dłoni. Kombos splot x3 (Zadanie 4)
routuje teraz na tecza.aktywuj() jako trzecią gałąź obok ogien/aard, zamiast
cicho ginąć bez właściciela.

tecza.update() woła się PRZED aura.updateAndDraw(), więc tempo obrotu barwy
w tej samej klatce odzwierciedla bieżący motionMeter.responsywnosc - to jest
mechaniczna realizacja 'zabawy ruchem' ze zgłoszenia.

Nakładka debug dostaje osobną sekcję dla licznika/barwy nagrody - progi
samego Splotu (KRZYZ_MIN/PELNY, WYSOKOSC_*) są już widoczne za darmo przez
istniejący mechanizm stats.rozbicie, bo znak ma skladniki().

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Poza zakresem tego planu

(przeniesione ze spec, bez zmian)

1. Dźwiękowa warstwa tęczy (osobny motyw audio na czas nagrody) — `audioEngine.js` nietknięty.
2. Wizualne rozróżnienie „świeżo odnowionej" tęczy od dobiegającej końca poza `silaSladu` — jeden mechanizm wystarcza na start.
3. Więcej znaków z ciała poza Splotem — jeśli okaże się niezawodny, może otworzyć drogę do kolejnych.
