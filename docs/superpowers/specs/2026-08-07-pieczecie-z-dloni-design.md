# Pieczęcie z dłoni — projekt

## Context

Pieczęcie oparte o **postawy całego ciała** (Perun, Mokosz, Weles) działają — gracz złożył wszystkie trzy i wykonał kombos Mokosz → Weles. Ale są **niepraktyczne w domu**: wymagają, żeby kamera obejmowała barki **i** biodra z zapasem nad głową i pod biodrami. Kamera laptopa tego nie daje.

Decyzja: **przenieść pieczęcie na dłonie i palce**, w stylu pieczęci z Naruto.

To rozwiązuje kadrowanie u źródła — dłonie trzyma się na wysokości piersi przed laptopem. Wraca też pierwotny podział z pierwszej burzy mózgów: **ciało prowadzi (płynność → moc → aura), dłonie doprecyzowują (pieczęcie → techniki)** — tylko teraz znamy powód, dla którego tak ma być.

### To nie jest przebudowa

Silnik zostaje nietknięty:

- `js/pieczecie.js` — przytrzymanie postawy, pierścień, koszt mocy, sufit czasu
- `js/kombosy.js` — bufor sekwencji, okno 4 s
- `js/efekty.js` — tabela efektów (zmienia się tylko zaczepienie)
- `js/znaki/registry.js` — już obsługuje `wymaga: 'hands'`
- `js/handTracker.js` — gotowy, `numHands: 2`, tylko odpięty

Wymieniamy **rozpoznawacze**: trzy funkcje `score()` z pose-owych na dłoniowe.

### Decyzje z rozmowy

- **Wierność: prawdziwe pieczęcie, czytana sylwetka.** Gracz układa autentyczną pieczęć; gra sprawdza tylko jej podpis zewnętrzny.
- **Tempo: rytualne** — przytrzymanie ~0,5 s, okno kombosa 4 s. Bez zmian względem obecnego silnika.
- **Zakres: trzy najpewniejsze** — Wąż, Tygrys, Pies. Koń i Stribog po weryfikacji.
- **REGUŁA NADRZĘDNA obowiązuje** (GEMINI.md §2): wynik postawy jest ciągły, poniżej progu jest cisza a nie odmowa, nic nigdy nie mówi „źle".

---

## Zasada nadrzędna projektu: czytamy sylwetkę, nie przeplot

Rdzeń połowy prawdziwych pieczęci to **splecione palce** (Baran, Dzik, Pies, Wąż). MediaPipe tego nie widzi:

- palce zasłonięte przez inne palce są **zgadywane**, nie mierzone
- nachodzące na siebie dłonie **gubią detektor** — spada do jednej dłoni albo myli stronność
- oś Z jest zgadywana (dlatego `WAGA_Z = 0` w `motionMeter.js`)

**Nie weryfikujemy przeplotu.** Sprawdzamy wyłącznie to, co widać pewnie:

| co | jak pewne |
|---|---|
| zgięcie każdego palca osobno | bardzo pewne |
| rozstaw palców | pewne |
| odległość i ułożenie dłoni względem siebie | pewne, gdy się nie nachodzą |
| które opuszki się dotykają | pewne, gdy widoczne |
| stronność (lewa/prawa) | pewne |

Gracz składa prawdziwą pieczęć — my czytamy jej podpis. Warunek: **każda pieczęć w zestawie musi mieć odrębny podpis zewnętrzny.**

---

## Trzy pieczęcie

| bóstwo | pieczęć | podpis, który sprawdzamy |
|---|---|---|
| **Mokosz** (woda, splot losu) | **Wąż** — dłonie płasko złożone, palce w górę | 10 palców wyprostowanych · nadgarstki **blisko** · dłonie równoległe i pionowe |
| **Perun** (grom) | **Tygrys** — po dwa palce w górę | wskazujący+środkowy wyprostowane na **obu** dłoniach, pozostałe złożone · dłonie razem |
| **Weles** (podziemie, bydło) | **Pies** — płaska dłoń na pięści | jedna dłoń **5 wyprostowanych**, druga **0** · ułożone jedna nad drugą |

### Rozdzielność

- **Tygrys vs Wąż** — liczba wyprostowanych palców (4 vs 10). Jednoznaczne.
- **Pies vs pozostałe** — jedyna pieczęć z asymetrią dłoni (5 i 0) oraz jedyna z ułożeniem pionowym jedna-nad-drugą.
- **Wąż vs Koń** *(Koń dochodzi później)* — to **jedyna ryzykowna para**: obie mają 10 palców wyprostowanych i opuszki blisko siebie. Rozróżnia je **odległość nadgarstków** znormalizowana rozmiarem dłoni: w Wężu dłonie są płasko przy sobie, w Koniu tylko opuszki się dotykają, a nadgarstki są rozsunięte. Zaprojektować Węża z tym warunkiem **od razu**, żeby Koń dał się dołożyć bez ruszania Węża.

### Stribog już istnieje

`js/znaki/stribog.js` (rozstaw opuszek jednej dłoni) jest napisany i przetestowany. Ożyje bez żadnej zmiany, gdy dłonie wrócą do pętli. `swarog.js` (dłonie w miseczkę) też — ale jego gest zostanie zastąpiony pieczęcią Konia, więc na razie zostaje odpięty.

---

## Pliki

### Nowe

| Plik | Odpowiedzialność |
|---|---|
| `js/znaki/dlon.js` | wspólne narzędzia — **lustrzane odbicie `postawa.js`**: indeksy punktów, `wyprostowane()`, `skalaDloni()`, `rampa()`, ułożenie dłoni względem siebie |
| `js/znaki/waz.js`, `tygrys.js`, `pies.js` | trzy pieczęcie, każda z ciągłym `score(frame)` |
| `tools/test-pieczecie-dloni.mjs` | rozdzielność trójki + ciągłość wyniku + odporność na brak dłoni |

`dlon.js` musi powstać, zanim napisze się pierwszą pieczęć — inaczej te same obliczenia (skala dłoni, wyprostowanie palca) rozjadą się na trzy kopie. `postawa.js` powstał dokładnie z tego powodu.

### Modyfikowane

- **`js/main.js`** — wpiąć `HandTracker`; `frame.hands` przestaje być pustą listą (kontrakt był na to przygotowany); zarejestrować trzy nowe pieczęcie w miejsce pose-owych.
- **`js/efekty.js`** — zaczepienia z **kostek na dłonie**. Kostek na laptopie nie widać, a dłonie są zawsze w kadrze i w centrum uwagi. To jest też odpowiedź na „efekt nie powala".
- **`js/kombosy.js`** — sekwencje pod nowe identyfikatory. Start: **Wąż → Pies** (Mokosz → Weles), czyli ten kombos, który gracz już przetestował.
- **`js/debugHud.js`** — na żywo: które palce wyprostowane na każdej dłoni, odległość nadgarstków, zbieżność opuszek. **Bez tego nie da się wystroić progów** — precedens: `PROG_SZARPNIECIA` i `PROG_POSTAWY` oba były zgadnięte i oba wymagały odczytu z nakładki.

### Odpięte, nie usunięte

`js/znaki/perun.js`, `mokosz.js`, `weles.js`, `postawa.js` — postawy ciała. Zostają na dysku: pełny kadr jest lepszy, gdy ktoś ma kamerę zewnętrzną, i mogą wrócić jako tryb alternatywny.

---

## Do zmierzenia PRZED pisaniem pieczęci

1. **Czy dwie dotykające się dłonie nie gubią detektora.** Przesądza o całym zestawie — Wąż, Tygrys i Pies wymagają dłoni przy sobie. Jeśli detektor spada do jednej dłoni, trzeba przeprojektować na dłonie rozłączone.
2. **FPS z dłońmi + ciałem + maską.** Zmierzone osobno: dłonie 8,3 ms + ciało 11 ms + odczyt maski ~2 ms ≈ **21 ms** z 33 ms budżetu przy 30 FPS. Powinno się zmieścić, ale to trzeba potwierdzić.

Obie odpowiedzi daje nakładka debug (`D`) na już działającej wersji.

---

## Weryfikacja

Bez kamery (`sh tools/test-wszystko.sh` — 10 istniejących testów musi dalej przechodzić):

1. **Wąż zapala Węża, nie zapala Tygrysa ani Psa** — i odwrotnie, dla wszystkich trzech par.
2. **Wąż odrzuca układ z rozsuniętymi nadgarstkami** (przyszły Koń) — warunek zaprojektowany z góry, testowany od razu.
3. **Wynik jest ciągłą rampą, nie progiem** — powolne prostowanie palców daje płynny wzrost. To reguła nadrzędna, nie estetyka.
4. **Brak dłoni, jedna dłoń, klatka z NaN** — zero, nie wyjątek i nie wartość śmieciowa.

Na żywym ciele (`http://localhost:8000`, klawisz `D`):

5. **FPS ≥ 24** z dwiema dłońmi i ciałem w kadrze.
6. **`dłonie 2` utrzymuje się** przy dłoniach złożonych płasko przy sobie.
7. **Każda pieczęć dobija do progu** — podać wynik z nakładki dla wszystkich trzech. Progi są **zgadnięte** i to jest jedyny sposób ich wystrojenia.
8. **Kombos Wąż → Pies odpala technikę**, a jej efekt jest widoczny **przy dłoniach**.
9. **Reguła „nic nie mówi źle"** — poniżej progu cisza, żadnego komunikatu o porażce, nieudana pieczęć nie kosztuje mocy.

---

## Dalej (poza zakresem)

1. **Koń** (Swaróg) i **Stribog** — po potwierdzeniu, że trójka działa
2. Więcej kombosów, w tym trójelementowe
3. Mocniejsze efekty technik — teraz zaczepione w dłoniach, więc jest gdzie je rozwinąć
4. Oprawa szamańska: paleta ognia/węgla zamiast neonu, ognisko u dołu kadru
