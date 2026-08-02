# Projekt: Kula Mocy

## 1. Cel Projektu i Opis

Webowa gra ruchowa AR rozpoznająca gesty gracza na kamerze, w klimacie **słowiańskiego szamanizmu**.

Gracz **tańczy swobodnie** — rozluźnione ciało ładuje moc — a **krótkimi znakami dłońmi** nadaje tej mocy formę (Swaróg = ogień, Stribog = wiatr, docelowo Perun, Weles, Mokosz). Znaki mają się z czasem łączyć w kombosy i techniki, jak pieczęcie ninja, ale w słowiańskiej oprawie.

Cel emocjonalny: gracz ma **całkowicie rozluźnić ciało**, poruszać się swobodnie i czerpać przyjemność z tańca — jak szaman przy ogniu. Nie egzamin, nie wyzwanie zręcznościowe.

- **Pochodzenie:** demo na warsztaty z vibe codingu (funkcja „Power Charge").
- **Grupa docelowa:** studenci, uczestnicy warsztatów.

## 2. REGUŁA NADRZĘDNA: nic nigdy nie mówi „źle"

Obowiązuje w całym kodzie i wygrywa ze wszystkimi innymi względami.

- Każdy rozpoznawacz gestu zwraca **ciągły wynik 0..1**, nigdy boolean. Częściowe ułożenie dłoni daje słabszy, ale nadal ładny efekt.
- **Brak punktów, brak timera, brak stanu porażki.** Nagrodą jest sam efekt.
- Komunikaty mówią, co jest dostępne **dalej**, a nie co gracz robi **źle**.
- Wyjście z kadru nie karze (zanik wolniejszy niż przy bezruchu).
- Progi mają histerezę — stan nie może migotać na granicy.

To jest techniczna realizacja celu emocjonalnego. Klasyfikacja tak/nie robi z tego egzamin i niszczy cel — traktować jak wymóg, nie jak detal.

## 3. Architektura

Front-end only, HTML + CSS + JavaScript (Vanilla, moduły ES). Bez backendu i bez bazy — cały stan żyje w pamięci przeglądarki.

**Tracking:** MediaPipe Tasks Vision 0.10.3 — `HandLandmarker` (`numHands: 2`) **oraz** `PoseLandmarker` (lite, `numPoses: 1`). Obie detekcje co klatkę.

**Rendering:** Canvas 2D (`globalCompositeOperation: 'lighter'`). **Audio:** syntezator Web Audio.

### Przepływ

```
kamera → HandTracker ─┐
                      ├→ frameMapper → frame ─┬→ MotionMeter → moc (0..1)
kamera → PoseTracker ─┘                       └→ ZnakRegistry → { swarog, stribog }
                                                          │
                        energia = moc × wynik znaku ───────┴→ PowerBall / Wiatr → audio, HUD
```

**Tańczysz → ładujesz moc. Rzucasz znak → moc przybiera formę.**

### Kontrakt klatki

`main.js` buduje raz na klatkę jeden obiekt `frame` i przekazuje go wszystkim:

```js
{ hands: [{ landmarks, worldLandmarks, handedness }], pose: { landmarks, worldLandmarks } | null,
  width, height, dt, now }
```

**Zasada:** `landmarks` (2D, przemapowane) **tylko do rysowania**. `worldLandmarks` (metryczne 3D) **do wszystkich pomiarów** — są niezależne od odległości gracza od kamery.

W tasks-vision 0.10.3 pole nazywa się `handednesses` (liczba mnoga).

### Pliki

| Plik | Odpowiedzialność |
|---|---|
| `js/handTracker.js`, `js/poseTracker.js` | wrappery MediaPipe |
| `js/frameMapper.js` | cover-fit + mapowanie punktów na płótno |
| `js/motionMeter.js` | ciągłość ruchu → moc; **jedyne źródło energii** |
| `js/znaki/registry.js` | rejestr znaków, wyniki surowe i wygładzone |
| `js/znaki/swarog.js`, `stribog.js` | pojedyncze znaki |
| `js/powerBall.js` | stan kuli + rendering (bez rozpoznawania) |
| `js/wiatr.js` | efekt Striboga |
| `js/audioEngine.js` | syntezator |
| `js/debugHud.js` | nakładka diagnostyczna (klawisz `D`, `R` = reset zakresu) |

## 4. Pułapki, w które już wpadliśmy

Zmierzone, nie teoretyczne. Nie cofać tych decyzji bez ponownego pomiaru.

- **Różniczkowanie wzmacnia szum.** Prędkość liczyć z **wygładzonych** pozycji, nie surowych. Odwrotna kolejność dawała ~1,2 m/s przy nieruchomym staniu. Po poprawce ~0,07 (32× mniej).
- **Nie przeskalowywać wyniku przez `1/alfa`** „dla przywrócenia skali" — to mnoży szum z powrotem i kasuje cały zysk filtra.
- **Stała czasowa wygładzania musi być dłuższa niż cykl ruchu tanecznego** (~1 s), inaczej wskaźnik oscyluje i moc w każdym takcie rośnie i opada.
- **Oś Z z jednej kamery jest zgadywana, nie mierzona** — pomijana (`WAGA_Z = 0`).
- **Jedna klatka z NaN potrafiła zatruć moc na stałe** (`Math.max(0, Math.min(1, NaN))` to nadal NaN). Stąd osłony w `motionMeter.js`.
- **`registry.ocen()` zwraca kopię**, nie referencję — silnik kombosów będzie trzymał historię.
- **Płótno ma CSS `transform: scaleX(-1)`** — tekst rysowany na nim wychodzi lustrzany; trzeba odkręcać odbicie lokalnie.

## 5. Wydajność

Zmierzone (Chrome, klatka 1280×720, MacBook): pose 10,50 ms + hands 8,28 ms = **18,78 ms/klatkę**. Potwierdzone na żywym ciele: **ani razu poniżej 24 FPS**. Przeplatanie detekcji niepotrzebne.

## 6. Testy

```
sh tools/test-wszystko.sh    # cała logika bez kamery
node tools/tune-motion.mjs   # strojenie MotionMeter
```

Testy **nie zastępują** sprawdzenia na żywym ciele — wejściem gry jest strumień z kamery. Do tego służy nakładka debug (`D`).

Strojenie `MotionMeter` opiera się na **zmierzonych** wartościach: stanie w miejscu → 0,00 efektywnych; spokojny taniec → 0,30 zmierzonych (~11 s do pełnej mocy); energiczny → 0,67 (~8 s). Przy zmianie stałych powtórzyć pomiar nakładką.

## 7. Dalszy rozwój

1. **Silnik kombosów** — sekwencje znaków w oknie czasowym → techniki
2. **System efektów** — wiele VFX naraz, wspólny cykl życia
3. **Rytm i audio** — bęben ~90 BPM, bonus za trafienie w takt
4. **Oprawa szamańska** — paleta ognia/węgla zamiast obecnego neonu, ognisko u dołu kadru, iskry
5. **Pełny panteon** — Perun, Weles, Mokosz

*Przy symbolice omijać kołowrót/swarzycę — zostały zawłaszczone przez skrajną prawicę. Celem są i tak autorskie runy.*
