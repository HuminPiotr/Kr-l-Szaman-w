# Projekt: Kula Mocy

## 1. Cel

Webowa gra ruchowa AR w klimacie **słowiańskiego szamanizmu**, rozpoznająca ruch gracza na kamerze.

Gracz **tańczy swobodnie**, a gra mierzy **PŁYNNOŚĆ jego ruchu** — czy kończyny kreślą łagodne łuki, czy szarpią. Płynny ruch napełnia tancerza mocą, widoczną nie tylko na pasku, ale jako **świetlista aura obrysowująca sylwetkę** na obrazie z kamery.

Cel emocjonalny: gracz ma **całkowicie rozluźnić ciało** i czerpać przyjemność z tańca — jak szaman przy ogniu. Nie egzamin, nie wyzwanie zręcznościowe.

- **Pochodzenie:** demo na warsztaty z vibe codingu.
- **Grupa docelowa:** studenci, uczestnicy warsztatów.

## 2. REGUŁA NADRZĘDNA: nic nigdy nie mówi „źle"

Obowiązuje w całym kodzie i wygrywa ze wszystkimi innymi względami.

- Każdy pomiar zwraca **ciągłą wartość 0..1**, nigdy boolean. Płynność steruje TEMPEM ładowania, nigdy go nie zeruje: ruch szarpany ładuje ok. 4x wolniej, ale **ładuje** (`PODLOGA_PLYNNOSCI`).
- **Brak punktów, timera, stanu porażki.** Nagrodą jest sam efekt.
- Komunikaty mówią, co jest dostępne **dalej**, nie co gracz robi **źle**.
- Bezruch i wyjście z kadru **nie karzą** — płynność wraca wtedy do pełnej, bo brak danych to nie jest szarpanie.
- Progi mają histerezę; nic nie migocze na granicy.

## 3. Architektura

Front-end only, HTML + CSS + JavaScript (Vanilla, moduły ES). Bez backendu i bazy.

**Tracking:** MediaPipe Tasks Vision 0.10.3, `PoseLandmarker` (lite, `numPoses: 1`) z **maską segmentacji**. Śledzenie dłoni jest teraz WYŁĄCZONE.

```
kamera → PoseTracker ─┬→ worldLandmarks → Plynnosc ──┐
                      │                              ├→ MotionMeter → moc → Aura + HUD
                      ├→ worldLandmarks → ─────────  ┘
                      └→ maska sylwetki ───────────────→ Aura
```

**Tańczysz płynnie → moc rośnie → aura rozkwita.**

### Kontrakt klatki

`main.js` buduje raz na klatkę jeden obiekt i przekazuje go wszystkim:

```js
{ hands: [], pose: { landmarks, worldLandmarks } | null, width, height, dt, now }
```

`hands` zostaje pustą listą, żeby kontrakt się nie zmienił, gdy dłonie wrócą razem ze znakami.

**Zasada:** `landmarks` (2D, przemapowane) **tylko do rysowania**. `worldLandmarks` (metryczne 3D) **do wszystkich pomiarów** — są niezależne od odległości gracza od kamery.

### Pliki

| Plik | Odpowiedzialność |
|---|---|
| `js/poseTracker.js` | wrapper MediaPipe; detekcja na POMNIEJSZONEJ klatce |
| `js/frameMapper.js` | cover-fit + mapowanie punktów na płótno |
| `js/plynnosc.js` | jak gładki jest ruch → 0..1 |
| `js/motionMeter.js` | ciągłość ruchu × płynność → moc |
| `js/aura.js` | maska sylwetki → poświata |
| `js/audioEngine.js` | syntezator |
| `js/debugHud.js` | nakładka (`D` = pokaż, `R` = reset zakresu) |

**Odpięte, nie usunięte** (wracają przy znakach): `powerBall.js`, `wiatr.js`, `znaki/*`, `handTracker.js`.

## 4. Pułapki, w które już wpadliśmy

Wszystkie **zmierzone**, nie teoretyczne. Nie cofać bez ponownego pomiaru.

### Ruch i płynność

- **Różniczkowanie wzmacnia szum.** Prędkość liczyć z **wygładzonych** pozycji. Odwrotna kolejność dawała ~1,2 m/s przy nieruchomym staniu; po poprawce ~0,07 (32× mniej).
- **Nie przeskalowywać przez `1/alfa`** „dla przywrócenia skali" — to mnoży szum z powrotem i kasuje cały zysk filtra.
- **Stała czasowa wygładzania musi być dłuższa niż cykl ruchu tanecznego** (~1 s), inaczej moc w każdym takcie rośnie i opada.
- **Płynność ≠ mało przyspieszenia.** Okrąg kreślony ze stałą prędkością ma duże przyspieszenie dośrodkowe, a jest wzorcem płynności. Liczy się tylko składowa STYCZNA.
- **ŚREDNIA(|a_t|)/ŚREDNIA(|v|) daje ODWROTNY ranking** (gładkie 6,3 vs szarpane 3,7). Oba zmieniają prędkość o tyle samo na sekundę; różni je SKUPIENIE w czasie. Stąd **RMS**, czuły na szczyty: 7,0 vs 21,0.
- **Zwykłe różniczkowanie dwukrotne nie przeżywa szumu** — rozdział spadał z 3,0× do 1,05×. Stąd **Savitzky-Golay**: pochodne z dopasowania wielomianu w oknie.
- **Miary czysto geometryczne nie działają** — kołysanie gładkie i szarpane kreślą tę samą prostą, różni je wyłącznie czas zwrotu.
- **Okna filtrów liczyć w SEKUNDACH, nie klatkach** — przy spadku FPS miara musi znaczyć to samo.
- **Oś Z z jednej kamery jest zgadywana** — pomijana (`WAGA_Z = 0`).
- **Jedna klatka z NaN potrafiła zatruć moc na stałe** (`Math.max(0, Math.min(1, NaN))` to nadal NaN).

### Aura i rendering

- **Maskę BARWIĆ na płótnie pomocniczym** (`source-in`), nie na głównym. Tint przez `source-atop` na głównym zalewa CAŁY ekran, bo tło gry jest nieprzezroczyste.
- **Wyciąć ostrą sylwetkę z rozmytej** (`destination-out`), inaczej wnętrze ciała wypala się do bieli i zamiast aury wychodzi świecąca kukła.
- **Aurę rysować przez `computeCoverFit()`**, tak jak wideo. Zwykłe `drawImage(0,0,canvas.width,canvas.height)` rozciąga ją i aura siada OBOK ciała.
- **Maski trzeba zwalniać** (`mask.close()`) — inaczej tekstury GPU wyciekają klatka po klatce.
- **Płótno ma CSS `transform: scaleX(-1)`** — tekst rysowany na nim wychodzi lustrzany.

## 5. Wydajność

Odczyt maski z GPU skaluje się z liczbą pikseli i to ON, nie detekcja, jest kosztem:

| rozdzielczość detekcji | detekcja | odczyt maski | razem |
|---|---|---|---|
| 1280×720 | 11,8 | 21,4 | **33,1 ms** — cały budżet 30 FPS |
| 640×360 | 15,3 | 12,4 | 27,7 ms |
| **480×270** | ~14 | ~2 | **14,1 ms** ← tu pracujemy |
| 320×180 | 11,0 | 1,2 | 12,1 ms |

Stąd `SZEROKOSC_DETEKCJI = 480` w `poseTracker.js`. Aura jest rozmyta, więc niska rozdzielczość maski jest niewidoczna. Proporcje bierzemy z **rzeczywistych** `video.videoWidth/Height` — `getUserMedia` prosi przez `ideal` i może oddać 4:3.

## 6. Testy

```
sh tools/test-wszystko.sh    # cała logika bez kamery
node tools/tune-motion.mjs   # strojenie MotionMeter
```

Testy **nie zastępują** sprawdzenia na żywym ciele — wejściem gry jest strumień z kamery. Do tego służy nakładka debug (`D`).

Odniesienie z sygnałów syntetycznych (szarpnięcie w 1/s): okrąg 1,5 · kołysanie gładkie 6,1 · kołysanie szarpane 30,4 · wyrzut-stop 27,5. `PROG_SZARPNIECIA` jest z nich wyprowadzony i **wymaga potwierdzenia na żywym ciele**.

**Uwaga przy testach w przeglądarce:** Chrome cache'uje moduły ES heurystycznie po `Last-Modified`. Sam `Cache-Control: no-store` nie unieważnia wpisów zapisanych wcześniej — trzeba wymusić `fetch(url, {cache:'reload'})` albo twarde przeładowanie, inaczej godzinami testuje się stary kod.

## 7. Dalszy rozwój

1. **Znaki i kombosy** — moc z płynności jest tym, co je zasila; rejestr czeka odpięty
2. **Oprawa szamańska** — paleta ognia/węgla, ognisko u dołu kadru
3. **Rytm** — bęben ~90 BPM, płynność w zgodzie z taktem

*Przy symbolice omijać kołowrót/swarzycę — zostały zawłaszczone przez skrajną prawicę. Celem są i tak autorskie runy.*
