# Pięć prostych combo — projekt

**Data:** 2026-10-02
**Status:** zatwierdzony w brainstormingu, czeka na recenzję specu
**Gałąź:** arcade

## Kontekst

Użytkownik: „potrzebujemy więcej prostych combo, wiele żywiołów ma za mało technik".
Dziś 6 combo; Mokosz i Weles są tylko w dwóch, żadnego dwuelementowego. Ustalone
w brainstormingu (2026-10-02):

- **proste** = krótka sekwencja, **odpalenie natychmiastowe** (jak Tęcza/Kołowrót, bez gestu),
- **5 technik w partii**, każdą da się **odrzucić osobno** po teście na kamerze,
- powtórzeń ma być mało (jedyne nowe: Weles×3 — wybór użytkownika),
- efekty krążą wokół ciała / przy dłoniach (odrzucone: deszcz, burza, lawa z podłogi).

| Sekwencja | id | Nazwa | Efekt |
|---|---|---|---|
| Mokosz → Perun | `lukPeruna` | Łuk Peruna | łuk elektryczny trzaskający między dłońmi, rozciąga się z rękami |
| Mokosz → Weles | `wodnaKula` | Wodna Kula | falująca kula wody między dłońmi, refrakcja + krople-kreski |
| Stribog → Mokosz | `mglaMokoszy` | Mgła Mokoszy | mgła tocząca się poziomo przez kadr, sylwetka się wynurza |
| Stribog → Weles | `kurzawa` | Kurzawa | wir pyłu spiralą w górę wokół sylwetki |
| Weles × 3 | `kamiennaTarcza` | Kamienna Tarcza | kamienne odłamki krążą po orbicie wokół tułowia, potem opadają |

Kolizje sprawdzone: żadna nowa sekwencja nie jest prefiksem/sufiksem istniejącej trójki
ani innej nowej. Łańcuchy (celowe wg `kombosy.js`): Kołowrót→+Perun = Łuk;
Mokosz→Weles×3 = Kula, potem Tarcza; Stribog→Weles×3 = Kurzawa, potem Tarcza.
Punkty: automatycznie z `TRUDNOSC` w `js/punkty.js` — bez pracy per technika.

## Architektura (podejście 1: moduł na technikę ze wspólnych klocków)

**Jeden plik na technikę** w `js/`: `lukPeruna.js`, `wodnaKula.js`, `mglaMokoszy.js`,
`kurzawa.js`, `kamiennaTarcza.js`. Wzorzec = `js/kolowrot.js`: klasa z `zapal(...)`,
`updateAndDraw(...)`, `get aktywny`, eksportowane mutowalne `NASTAWY` (dla
`tools/scena.html`), czyste funkcje obwiedni testowalne w Node, guard `!ctx`,
brak assetu = warstwa nierysowana (GEMINI.md §2).

**Różnica względem Kołowrotu: efekt ŚLEDZI ciało co klatkę.** Kołowrót zamraża
zaczep w `zapal()`. Nowe moduły dostają `frame, W, H` w `updateAndDraw` i co klatkę
przeliczają zaczep (dłonie: `frame.hands[i].landmarks` 0/9 jak `srodekDloni`
w `js/efekty.js`; tułów: `kregSylwetki` z `js/kolowrot.js`). Gdy dłoń/poza zniknie —
efekt trzyma ostatni znany zaczep (wygładzony), nie znika i nie skacze.

**Reużywane klocki:**
- `js/piorun.js` — `generujPiorun(start, koniec, opcje)` / `segmentuj` dla Łuku (ścieżka
  dłoń↔dłoń regenerowana co ~60–90 ms = trzask); rdzeń `source-over` jak piorun.
- `js/ekran.js` — `uderz()` w warstwie wspólnej (już w `odpalTechnike`); dla Kuli
  wariant soczewki: nowa metoda `soczewka(srodek, promien)` oparta na tej samej
  technice co `falaPowietrza` (kopia sceny przeskalowana, clip do koła).
- `js/czastki.js` — `krokTlumienia`, `obwiedniaCzastki`.
- `js/assety.js` — `MANIFEST`, `obraz`, `wypalTintowany`.
- `js/zaplon.js` — zapłon sylwetki (już wspólny w `odpalTechnike`).

**Nowe tekstury Kenney (CC0)** do `assets/czastki/` + `MANIFEST`:
`dirt_01–03` (Kurzawa, Tarcza), `twirl_02–03` (Kurzawa), `spark_01–03` (Łuk — rozbłysk
przy dłoniach). Paczki nie ma na dysku — pobranie z kenney.nl
(`particle-pack`), dopisanie do `assets/czastki/LICENSE.txt` jeśli wymaga. Mgła używa
istniejących `smoke_*`, Kula — proceduralna (kreski) + `light_01`.

**Wpięcie (każda technika dotyka tych samych miejsc, osobny commit):**
1. `js/kombosy.js` — wpis w `KOMBOSY` z `uzbraja: '<id>'` + komentarz (mit, kolizje).
2. `js/techniki.js` — `BARWA_ZAPLONU[<id>]` + gałąź `else if` w `odpalTechnike`.
3. `js/efekty.js` — wiersz `TABELA[<id>]` (błysk aktywacji `blyskIFala`).
4. `js/swiezeModuly.js` — import + `KLUCZE_MODULOW` + instancja.
5. `js/main.js` — destrukturyzacja, worek `s` dla `odpalTechnike`, `updateAndDraw`
   obok `kolowrot.updateAndDraw` (w bloku wstrząsu), statystyki debugHud.
6. `tools/scena.html` — import, instancja, panel `NASTAWY`, scenariusz przycisku.
7. Testy (niżej).

**Odrzucanie techniki:** szybkie wyłączenie = usunięcie/zakomentowanie wpisu
w `KOMBOSY` (gałąź w `techniki.js` staje się martwa, nic się nie psuje). Pełne
usunięcie = `git revert` commita tej techniki — dlatego **jedna technika = jeden
commit** (+ ewentualny wspólny commit fundamentów przed nimi).

## Efekty — szczegóły

Wszystkie rozmiary jako mnożniki skali barków (`kregSylwetki().skala`), nigdy px/ułamki W.
Barwy podbite do pełnego nasycenia (rysowanie `'lighter'`), z rejestru `efekty.js`.

1. **Łuk Peruna** (~6 s). 2–3 równoległe łuki między środkami dłoni, ścieżki z
   `generujPiorun`, regenerowane w losowych odstępach 60–90 ms; jasny rdzeń
   `source-over` + poświata. Przy każdej dłoni rozbłysk `spark_*`. Grubość/jasność
   maleje z odległością dłoni (rozciągasz → cieńszy, bardziej poszarpany). Jedna dłoń
   w kadrze → łuk wyładowuje się z dłoni w górę (fallback, nigdy brak efektu).
   Barwa: błękit-biel Peruna.
2. **Wodna Kula** (~6 s). Kula w środku między dłońmi, promień ~ połowa odległości
   dłoni (min/max względem skali barków). Brzeg = zamknięta kreska z falującym
   promieniem (szum `js/szum.js`), wnętrze = soczewka refrakcyjna (`ekran.soczewka`),
   po obwodzie kilka kropel-kresek odrywających się stycznie. Na koniec kula pęka
   w krople. Barwa: turkus/błękit Mokoszy.
3. **Mgła Mokoszy** (~7 s). Pas teksturowanej mgły (`smoke_*`) wjeżdża z jednej strony
   kadru na wysokości tułowia i przetacza się na drugą, gęstniejąc wokół sylwetki;
   sylwetka „wynurza się" — mgła rysowana z maską segmentacji wyciętą (`destination-out`
   tą samą maską, której używa `zaplon.js`), więc ciało jest przed mgłą. Dlatego
   `updateAndDraw` Mgły i Tarczy przyjmuje też `maskaDane, maskaSzer, maskaWys, fit`
   (ta sama sygnatura ogona co `zaplon.updateAndDraw` w `main.js`); bez maski
   (brak pozy) mgła rysuje się po prostu przed wszystkim. Barwa:
   chłodna perła z nutą turkusu.
4. **Kurzawa** (~5 s). Lej wiru wokół tułowia: cząstki `dirt_*` i `twirl_*` na
   spiralnych torach (kąt rośnie, wysokość rośnie od pasa nad głowę, promień rośnie
   z wysokością), zaczep śledzi barki. Fizyka składowa styczna+promieniowa jak
   `kolowrot.js`. Barwa: piaskowa ochra z miętą Striboga na smugach.
5. **Kamienna Tarcza** (~6 s). 8–12 odłamków `dirt_*` (tint fiolet-kamień Welesa)
   wylatuje z barków na orbitę eliptyczną wokół tułowia (przód rysowany przed
   sylwetką, tył za nią — z maską, jak Mgła), obracają się wokół własnej osi;
   na końcu opadają grawitacją poza kadr. Mocny `ekran.uderz` przy formowaniu.

## Testy

- `tools/test-kombosy.mjs`: każda nowa sekwencja odpala swoje id; brak kolizji
  prefiksów/sufiksów (asercja ogólna dla całej tabeli); łańcuchy z sekcji Kontekst.
  **Przeróbka**: test `k2` + asercja „weles nigdy nie zaczyna" (linie ~31–38, 131–139)
  — Weles zaczyna teraz Tarczę. k2 startuje od `mokosz` (para mokosz→swarog nie jest
  żadnym combo), komentarz poprawiony; asercja „weles nigdy pierwszy" zastąpiona ogólnym
  testem: żadna para (prefiks/sufiks długości 2) trójki nie jest osobnym combo, chyba że
  na liście świadomych wyjątków (dziś pusta).
- `tools/test-techniki.mjs`: dokładny zbiór wywołań na każdą nową gałąź `uzbraja`
  (łącznie z `dmuchanie.anuluj()`, które `odpalTechnike` woła dla każdej techniki poza `dym`).
- `tools/test-swieze-moduly.mjs`: przejdzie po dopisaniu do fabryki (pilnuje main.js).
- `tools/test-<technika>.mjs` (5 plików, wzór `test-kolowrot.mjs`): obwiednia, gaśnięcie
  `aktywny`, brak NaN przy brakującej dłoni/pozie, śledzenie zaczepu.
- `tools/test-tryby.mjs`, `test-kronika.mjs` — bez zmian, mają przejść.
- Całość: `bash tools/test-wszystko.sh`.

## Weryfikacja

1. `bash tools/test-wszystko.sh` — zielone.
2. `tools/scena.html` (bez kamery): przycisk scenariusza każdej techniki, sprawdzenie
   wyglądu i śledzenia syntetycznej sylwetki/dłoni; zrzut ekranu przez Chrome MCP.
3. Gra z kamerą (właściciel): ułożenie każdej sekwencji, ocena → decyzja zostaje/odrzuć.

## Kolejność prac

0. Zapis tego projektu jako spec `docs/superpowers/specs/2026-10-02-proste-kombosy-design.md`
   + commit; recenzja specu przez użytkownika; potem skill writing-plans.
1. Fundament (1 commit): pobranie tekstur + MANIFEST, `ekran.soczewka`, przeróbka testu k2.
2. Po jednym commicie: Kamienna Tarcza → Kurzawa (dzielą `dirt_*`) → Łuk Peruna →
   Wodna Kula → Mgła Mokoszy. Po każdej: testy + scena.
