# Jakość tańca — łuki, całe ciało, fala (etap 1 z 4: „gra rozumie muzykę”)

## Context
Dziś moc = prędkość 6 punktów (nadgarstki, łokcie, kostki) × płynność (`js/plynnosc.js`,
szarpanie ładuje ~4× wolniej). Najlepszą strategią jest więc wysokie podnoszenie i opuszczanie
rąk: duża prędkość nadgarstków, prosta, gładka trajektoria. Gra nie rozróżnia, CO gracz robi.

Właściciel chce, żeby gra premiowała płynny, bogaty taniec dokładniej, śledziła więcej punktów
ciała i — w kolejnych etapach — rozumiała muzykę (tempo, rytm) i dostosowywała się do niej.

### Podział na etapy (decyzja właściciela 2026-10-14)
1. **Jakość tańca** (ten spec) — działa bez muzyki.
2. **Słuch** — źródła rytmu za jednym interfejsem `Rytm` (tempo, faza uderzenia, pewność 0..1),
   pierwszeństwo: **plik** (analiza całego utworu przy ładowaniu, pieśni Suno i własne pliki) →
   **mikrofon** (opcja w menu, na żywo; YouTube, muzyka z pokoju) → **puls tańca** (gdy nic nie gra,
   rytmem jest ustalony okres ruchu tancerza).
3. **Dopasowanie tempa** — ruch w tempie rytmu ładuje więcej, tolerancja ½× i 2×.
4. **Trafienia i trans** — akcenty ruchu w takt dają łyk mocy i błysk aury; seria trafień buduje
   trans (mnożnik ładowania i punktów tańca), który gaśnie łagodnie i nic nie zabiera.

Decyzje dla etapu 1: premiować **łuki zamiast linii** (mierzone jako krążenie bez nawrotów), **całe ciało**, **falę przez ciało**
(różnorodność/powtarzanie — NIE). Balans **„pośrodku”**: góra–dół ~12 s do pełnego paska
(dziś ~8 s), piękny taniec ~6 s. Odczucie: **„aura mówi”** — bez nowych napisów.

Reguła nadrzędna bez zmian (GEMINI.md §2): wszystko ciągłe 0..1, ruch zawsze ładuje, nic nie mówi „źle”.

## Projekt

### 1. Przepływ danych
```
PoseTracker ─┬→ worldLandmarks ─┬→ Plynnosc (próg skalowany okresem) → wspPlynnosci 0.25..1
             │                  ├→ Okres ─────────┐ (okresS, pewnosc)
             │                  ├→ Krazenie       │
             │                  ├→ Fala ◄─────────┘
             └→ landmarks 2D ───┴→ Zaangazowanie
                                     └→ JakoscTanca → bogactwo, mnoznikBogactwa, jakosc
                                           ├→ MotionMeter (mnożnik tempa ładowania)
                                           ├→ Punkty.taniec
                                           └→ Aura (żar, połysk partii, bieg fali)
```

### 2. Moduły
- `js/jakosc/pochodne.js` — filtr Savitzky'ego-Golaya wydzielony z `js/plynnosc.js` (`_pochodneSG`)
  i korelacja z opóźnieniem wydzielona z `js/ruchy/falowanieRamion.js`. Oba stare moduły
  przechodzą na wspólny kod; **liczby mają zostać identyczne** (regresja na nagraniach).
- `js/jakosc/okres.js` — autokorelacja POZYCJI (x, y każdego stawu 15/16/13/14/27/28 osobno,
  po odjęciu średniej, sumowana), okno 4 s, zakres okresu 0.25–2.5 s. Zwraca `{ okresS, pewnosc }`.
  NIE autokorelacja |v|: dla kołysania |v| powtarza się co PÓŁ okresu, a dla okręgu jest płaska
  (brak szczytu). Klocek wspólny z etapem 2 (puls tańca) i 3.
- `js/jakosc/krazenie.js` — „łuki zamiast linii” mierzone jako **brak nawrotów toru**: dla par
  próbek tego samego stawu, które są blisko siebie w przestrzeni, a daleko w czasie (> 0.15 s),
  `Σ v_i·v_j / Σ |v_i||v_j|`, przeskalowane do 0..1. Wahadło (ruch tam i z powrotem po tym samym
  torze — także łuk prostej ręki wokół barku!) ≈ 0, okrąg ≈ 1, ósemka wysoko. Stawy 15/16/13/14/27/28,
  x/y worldLandmarks, bramka szumu jak w płynności. Bezwymiarowe — tempo go nie zmienia.
  POPRAWKA 2026-10-14 (przed planem): pierwotna „krzywizna” (udział przyspieszenia normalnego)
  nie łapała exploitu — podnoszenie prostych rąk kreśli ŁUK wokół barku, który ma duże a_n.
- `js/jakosc/zaangazowanie.js` — 7 partii, każda aktywność 0..1 = rampa(sygnał ponad podłogą szumu):

  | partia | sygnał |
  |---|---|
  | ręka L / P | prędkość nadgarstka (world, x/y) |
  | noga L / P | prędkość kostki i kolana (world, x/y) |
  | biodra | prędkość środka bioder 23/24 w 2D, w PIKSELACH (x·width, y·height), ÷ szerokość barków w px |
  | tułów | prędkość środka barków (world — początek układu jest w biodrach) + prędkość kątowa linii barków względem linii bioder (world) |
  | głowa | prędkość nosa (0) względem środka barków (world) |

  Wynik `min(1, Σ aktywności / 4)` — cztery partie wystarczą do pełnej wartości; same ręce ~0.5.
  2D tylko dla bioder (world ich nie widzi — tam jest początek układu); przeliczone na piksele,
  bo landmarki 2D są znormalizowane osobno do szerokości i wysokości płótna.
  Punkty z `visibility < 0.5` nie głosują.
- `js/jakosc/fala.js` — najsilniejszy z łańcuchów: ramię L, ramię P (kąt ramienia → kąt
  przedramienia, jak w deszczu), biodra → nadgarstki (kołysanie bioder przechodzące w ręce).
  Opóźnienie jako **ułamek okresu** z `okres.js` (wąż ≈ 5–20% cyklu), razem z korelacją na
  szczycie (rytm). Sztywne skrzydło: opóźnienie 0 → fala ≈ 0. Gdy `okres.pewnosc` niska — fala
  dryfuje do neutralnej, nie do zera.
- `js/jakoscTanca.js` — składa:
  ```
  bogactwo = 0.35·krążenie + 0.35·zaangażowanie + 0.30·fala          (ZGADNIĘTE — stroić)
  mnoznikBogactwa = liniowo przez kotwice: bogactwo(góra–dół) → 0.67, bogactwo(piękny taniec) → 1.33,
                    przycięte do [0.67, 1.33]
  ```
  Do aury idzie `bogactwo`; do punktów `mnoznikBogactwa` (sekcja 3).
  Kotwice ustawiane Z POMIARU (sekcja 5). Wygładzanie τ ≈ 1 s (dłuższe niż cykl tańca). Brak danych
  (bezruch, poza kadrem) → składowe dryfują do neutralnej, mnoznikBogactwa → 1.0 (dzisiejsze tempo).
  „Neutralna” = środek między kotwicami, czyli bogactwo dające mnożnik 1.0 (τ powrotu ≈ 2 s, jak
  `TAU_POWROTU` płynności). Najwolniejsze ładowanie przy ruchu: 0.25 × 0.67 ≈ 0.17 — wolno, nigdy zero.
  Każda wartość przez strażnika NaN (jak `MotionMeter._bezpiecznaMoc`).
  W etapie 3 dopasowanie tempa wejdzie do `bogactwo` jako czwarta składowa.

### 3. Zmiany w istniejących
- `js/plynnosc.js` — próg szarpnięcia skalowany częstotliwością ruchu:
  `PROG_SZARPNIECIA × clamp(f_ruchu / 1 Hz, 1, 2)` (przy niskiej pewności okresu — skala 1).
  Zmiana 2026-10-14 (po przeglądzie końcowym): dolna granica 1 zamiast 0.5 — skalujemy tylko w górę, żeby wolny taniec nie tracił płynności przez szum śledzenia.
  Szybki gładki taniec przestaje tracić względem wolnego. Pięć pułapek z nagłówka zostaje pilnowanych.
- `js/motionMeter.js` — `update(frame, plynnosc, zamrozZanik, mnoznikBogactwa = 1, mnoznikTransu = 1)`:
  `przyrost = PRZYROST × responsywnosc × wspPlynnosci × mnoznikBogactwa × mnoznikTransu`.
  Prędkość nadal z tych samych 6 punktów — nowe partie idą do jakości, nie do prędkości (szum bioder
  i głowy nie podnosi podłogi bezruchu). `mnoznikTransu` = 1 do etapu 4. Zanik i zamrożenie bez zmian.
  Wartości domyślne zachowują dzisiejsze zachowanie dla wszystkich obecnych wywołań.
- `js/punkty.js` — `taniec(plynnosc, responsywnosc, dt, mnoznik = 1)`: płynność bez zmian, nowy
  OPCJONALNY mnożnik (`mnoznikBogactwa`, przycięty do [0, 2], nie do 1). Przy mnożniku 1 — dokładnie
  dzisiejsze punkty (zmierzony balans Kroniki i Kamieni Pamięci zostaje). Punkty dalej tylko przybywają.
- `js/main.js` — w pętli: okres → płynność → składowe → JakoscTanca → MotionMeter / punkty / aura.
- `js/debugHud.js` — sekcja „Jakość tańca”: krążenie, zaangażowanie z 7 paskami partii,
  fala (opóźnienie % cyklu, korelacja, łańcuch), okres/BPM ruchu, bogactwo, mnożnik, czas do pełnego paska.

### 4. Aura (`js/aura.js`) — „aura mówi”
- **Żar:** `jakosc` podnosi gęstość wewnętrznego obrysu i jasność żaru (moc dalej = zasięg,
  płynność dalej = barwa).
- **Połysk partii:** aktywna partia dostaje miękki, ciepły blask w swoim miejscu (biodra, barki,
  głowa, dłonie, stopy) — `lighter`, rozmyty, wygładzanie 0.5 s.
- **Bieg fali:** przy wysokiej fali jasny punkt przesuwa się wzdłuż łańcucha, który ją niesie
  (bark → dłoń albo biodra → dłoń), w tempie okresu ruchu. Kreska po węzłach, nie sprite.
- Wszystko wygładzane — trans, nie migotanie.

### 5. Strojenie z nagrania
- `SCENARIUSZ_JAKOSC` w `js/nagrywanie/sesja.js` (start z nakładki jak sesja F), 6 ćwiczeń
  × 3 powtórzenia × 10 s, wskazówki „w swoim tempie / wolniej / szybciej”:
  1a. „pompowanie” — zgięte ręce prosto w górę i w dół, 1b. proste ręce szerokimi łukami w górę
  i w dół (oba to dzisiejszy exploit; kotwica 0.67 z WYŻSZEGO z nich), 2. kręgi i ósemki rękami,
  3. taniec całym ciałem z krokami i biodrami, 4. fala przez ciało (biodra → dłonie),
  5. szybki taniec, 6. wolny taniec. Id kroków z prefiksem `jakosc-` (sesja.js:107 — kolizja etykiet
  z `test-rozdzielnosc`).
- `tools/pomiar-jakosci.mjs` (wzorzec `tools/pomiar-falowania.mjs`, nie test) — rozkład składowych
  i bogactwa na każdej próbce. Z niego: kotwice mnożnika (góra–dół → 0.67, ćw. 3/4 → 1.33),
  wagi, progi partii. Wszystkie stałe przed pomiarem oznaczone ZGADNIĘTE.
- Sukces: na nagraniu góra–dół ładuje ~12 s, ćw. 2–6 wyraźnie szybciej (cel ~6 s dla 3/4),
  szybki i wolny taniec podobnie przy podobnej jakości.

## Testy (`tools/test-*.mjs`, dopięte do `tools/test-wszystko.sh`)
- `test-krazenie`: linia ≈ 0, łuk prostej ręki wokół barku ≈ 0, okrąg ≈ 1, ósemka wysoko; bezruch nie głosuje.
- `test-zaangazowanie`: same ręce ~0.5; kroki podnoszą biodra; wynik niezależny od skali sylwetki.
- `test-fala-ciala`: sztywne skrzydło ≈ 0, fala opóźniona wysoko; ten sam wąż wolno i szybko — podobny wynik.
- `test-okres`: kołysania 0.5 / 1 / 2 Hz ORAZ okrąg ze stałą prędkością odczytane poprawnie; szum → niska pewność.
- `test-plynnosc` (rozszerzony): szybka gładka sinusoida po skalowaniu nie gorsza niż wolna;
  dotychczasowe pułapki zielone.
- `test-jakosc-tanca`: kotwice mnożnika, przycięcie [0.67, 1.33], dryf do 1.0 przy braku danych, NaN.
- MotionMeter: przy ruchu przyrost nigdy 0; domyślne argumenty = dzisiejsze zachowanie; NaN nie zatruwa.
- `test-punkty`: punkty tylko rosną; mnożnik 1 = dzisiejsze tempo; mnożnik 1.33 nie jest przycinany do 1.
- Regresja: `test-falowanie`, `test-deszcz`, `test-zaklinanie` i `tools/pomiar-falowania.mjs`
  dają identyczne liczby po wydzieleniu `pochodne.js`.

## Poza zakresem
Muzyka, BPM pieśni, mikrofon, trans, trafienia w takt (etapy 2–4). Etap 1 zostawia tylko gniazda:
`okres.js`, czwarta składowa `bogactwo`, `mnoznikTransu`.
