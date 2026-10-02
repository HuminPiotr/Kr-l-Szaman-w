# Reakcje nowych technik — Przewodzenie i Burza w mgle

**Data:** 2026-10-03
**Status:** zatwierdzony w brainstormingu, czeka na recenzję specu
**Gałąź:** arcade

## Cel

Nowe proste techniki (spec `2026-10-02-proste-kombosy-design.md`) dziś nie wchodzą
w żadne interakcje. Właściciel chce, żeby łączenie technik dawało **widoczny efekt
i premię punktową** — tak jak istniejące reakcje dymu Okadzenia (Pożoga, Rozwianie
w `REAKCJE`, `js/punkty.js`).

Zakres tej partii (wybór właściciela) — dwie reakcje:

1. **Przewodzenie** — Łuk Peruna + Kręgi Mokoszy („woda przewodzi prąd”).
2. **Burza w mgle** — Łuk Peruna **albo** piorun Gromu w Ziemię + Mgła Mokoszy.

Poza zakresem (rozważane, odłożone): Łuk podpala dym, Kręgi rozwiewają dym,
Kurzawa zawija dym, Grom rozżarza kamienie Tarczy.

## Architektura (podejście A)

Nowy moduł **`js/reakcjeTechnik.js`** — jedno miejsce z logiką reakcji:

```
main.js (co klatkę, po updateAndDraw technik)
   └─ const r = reakcje.klatka({ lukPeruna, kregiMokoszy, mglaMokoszy, piorun }, dt)
         ├─ sprawdza warunki (czy techniki trwają razem)
         ├─ woła publiczne metody technik → efekt rysuje TECHNIKA u siebie
         └─ zwraca { przewodzenie: n, burzaWMgle: n }  (jednostki w tej klatce)
   └─ punkty.reakcja('przewodzenie', r.przewodzenie, now)
   └─ punkty.reakcja('burzaWMgle', r.burzaWMgle, now)
```

Zasady:

- **Techniki nie znają się nawzajem.** Każda wystawia małe API (geometria + jedna
  metoda efektu); kombinuje je tylko `reakcjeTechnik.js`. Dzięki temu technikę
  dalej da się wyjąć jednym commitem — reakcja z nią przestaje się wtedy spełniać.
- **Reakcja = wpis w tablicy** `REAKCJE_TECHNIK` w `reakcjeTechnik.js` (warunek +
  akcja). Wyłączenie reakcji = usunięcie wpisu.
- Klasa `ReakcjeTechnik` ma stan (zegary odstępów), więc trafia do
  `js/swiezeModuly.js` (równy start rundy w Kręgu).
- Wywołania `punkty.reakcja(...)` w `main.js` z **literalnymi** id — tak
  `tools/test-punkty.mjs` pilnuje, że każde id jest w `REAKCJE`.
- `tools/scena.html` dostaje ten sam przebieg (instancja + wywołanie po technikach),
  żeby reakcję dało się zobaczyć bez kamery.

## Reakcja 1: Przewodzenie (Łuk Peruna + Kręgi Mokoszy)

**Warunek:** `lukPeruna.aktywny && kregiMokoszy.aktywny` i Kręgi mają co najmniej
jeden żyjący krąg.

**Rytm:** co `ODSTEP_PRZEWODZENIA` = 0.3 s (zegar w `ReakcjeTechnik`) jedno
**wyładowanie** = jedna jednostka reakcji.

**Efekt:**
1. **Łuk sięga do wody** — `lukPeruna.wyladowanieDo(punkt)`: z najbliższego punktu
   bieżącego zygzaka Łuku do `punkt` rysuje się krótka odnoga — ostry zygzak w stylu
   Łuku (niebieski, ≤ 2 px), życie ~0.15 s. Łuk trzyma listę aktywnych odnóg.
2. **Kręgi się elektryzują** — `kregiMokoszy.naelektryzuj()`: przez ~0.4 s od
   ostatniego wywołania po każdym żyjącym kręgu biegną 2–3 poszarpane wyładowania
   (~¼ obwodu, `segmentuj` z `piorun.js`, ten sam niebieski co Łuk), a krąg jest
   jaśniejszy (mnożnik alfy tekstury ~1.4).

**Geometria:** Kręgi wystawiają `kregiMokoszy.geometria()` →
`{ cx, cy, squash, promienie: [px…] } | null`. `reakcjeTechnik.js` wybiera punkt
docelowy: na losowym żyjącym kręgu, pod kątem najbliższym środkowi zygzaka Łuku
(czysta funkcja `punktNaKregu(geom, cel)` — testowalna). Łuk wystawia
`lukPeruna.srodek()` → środek bieżącego odcinka dłoń–dłoń (z `konce`).

**Punkty:** `REAKCJE.przewodzenie = { nazwa: 'Przewodzenie', punkty: 15, pelneDo: 10, przerwaMs: 1500 }`.
Typowe nałożenie (~4.5 s, ~15 wyładowań) ≈ 200 pkt — tyle co jedna prosta technika.

## Reakcja 2: Burza w mgle (Łuk Peruna lub Grom w Ziemię + Mgła Mokoszy)

**Warunek:** `mglaMokoszy.aktywny && (lukPeruna.aktywny || piorun.aktywny)`.
„Grom” = piorun Gromu w Ziemię (`js/piorun.js`) — jedyna inna technika rysująca
błyskawicę (Grom w Ogniu tylko uzbraja Płonący Palec).

**Rytm:** nowy **błysk** co losowe 60–150 ms (zegar w `ReakcjeTechnik`) = jedna
jednostka reakcji.

**Źródło błysku:** punkt na Łuku (`lukPeruna.srodek()`), a gdy Łuk nie trwa —
punkt uderzenia pioruna (`piorun.punktUderzenia`, nowy getter: koniec głównej
ścieżki bieżącego błysku).

**Efekt:** `mglaMokoszy.rozblysk(zrodlo, sila)` — każdy kłąb mgły dostaje na chwilę
drugą warstwę: ten sam sprite tintowany na `[200, 225, 255]`, rysowany `'lighter'`,
z alfą malejącą z odległością kłębu od źródła (`jasnoscBlysku(odl, skala)` — czysta
funkcja) i gasnącą w ~0.12 s. Mgła dalej leży ZA sylwetką (ta sama warstwa).

**Punkty:** `REAKCJE.burzaWMgle = { nazwa: 'Burza w mgle', punkty: 10, pelneDo: 12, przerwaMs: 1500 }`.
Pojedynczy Grom w Ziemię ~4–5 błysków (~45 pkt); Łuk w mgle ~5 s, ~40 błysków ≈ 200 pkt.

## API dopisane do istniejących modułów

| Moduł | Dodatek | Uwagi |
|---|---|---|
| `js/lukPeruna.js` | `srodek()`, `wyladowanieDo(punkt)` + rysowanie odnóg | odnogi giną po ~0.15 s; `zapal()` czyści |
| `js/kregiMokoszy.js` | `geometria()`, `naelektryzuj()` + rysowanie wyładowań na kręgach | elektryzacja gaśnie ~0.4 s po ostatnim wywołaniu |
| `js/mglaMokoszy.js` | `rozblysk(zrodlo, sila)` + warstwa błysku | błysk gaśnie ~0.12 s |
| `js/piorun.js` | getter `punktUderzenia` | `null`, gdy nie trwa |

Wszystkie metody odporne na złe dane (GEMINI.md §2): `null`/NaN → nic, bez wyjątku.

## Testy

- `tools/test-reakcje-technik.mjs` (nowy) — szpiedzy w miejscu technik:
  warunek spełniony/niespełniony (każda kombinacja aktywności), rytm (liczba
  wyładowań/błysków w czasie), źródło Burzy (Łuk ma pierwszeństwo, potem piorun),
  zwracane jednostki, brak wywołań i zero jednostek, gdy techniki nie trwają razem,
  `punktNaKregu` (punkt leży na elipsie, kąt najbliższy celowi), `jasnoscBlysku`
  (maleje z odległością).
- Testy modułów: `wyladowanieDo` dodaje odnogę, która ginie; `naelektryzuj` gaśnie;
  `rozblysk` gaśnie; `geometria()`/`srodek()`/`punktUderzenia` — `null` gdy nie trwa.
- `tools/test-punkty.mjs` — nowe id w `REAKCJE` (istniejący strażnik).
- `tools/test-swieze-moduly.mjs` — `reakcjeTechnik` w fabryce, bezczynne na starcie.

## Weryfikacja

1. `sh tools/test-wszystko.sh` (poza `test-rozdzielnosc`, pada na bazie).
2. `tools/scena.html`: Łuk + Kręgi, Mgła + Łuk, Mgła + Grom — przyciskami technik.
3. Kamera (właściciel): mokosz → perun, potem mokosz → weles; stribog → mokosz, potem mokosz → perun.
