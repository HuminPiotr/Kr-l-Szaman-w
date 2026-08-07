# Płonący palec — projekt

## Context

Gracz przeszedł całą pętlę (taniec → moc → pieczęcie → kombos) i powiedział wprost: mechanika działa, ale **efekt nie powala**. Obecne efekty technik to błysk kadru i rozchodzący się pierścień — czytelne, ale nie ma w nich niczego, co chciałoby się robić dla samej przyjemności.

Pomysł gracza: po poprawnie złożonym kombosie **wysunięcie jednego palca ponad bark podpala go**. Płomień idzie za palcem, gdy gracz nim wodzi.

To pierwszy efekt w tej grze, który jest **stanem trwałym i interaktywnym**, a nie „odpal i zapomnij". Wszystkie dotychczasowe mają stały `czas` (0,7–1,8 s) i nikt nimi nie steruje. To nowy rodzaj rzeczy w architekturze, nie kolejny wiersz w `efekty.js`.

### Decyzje z rozmowy

- **Płomień zjada moc.** Pełny pasek ≈ 30 s ognia. Gdy moc się kończy, płomień łagodnie dopala się i gaśnie. Zamyka to pętlę gry: taniec → moc → kombo → malowanie ogniem → taniec.
- **Żar zostaje w powietrzu** za palcem i dopala się ~1,5 s. To jest „malowanie ogniem" i nagradza płynny, zamaszysty ruch — czyli to samo, co gra już mierzy.
- **Palec ponad barkiem to warunek ZAPŁONU, nie trzymania.** Po zapaleniu można wodzić palcem gdziekolwiek, także nisko. Trzymanie ręki w górze przez 30 s bolałoby, a to ma być relaks.
- **Kombos nie ma terminu ważności.** Po złożeniu gracz jest „gotowy" bez licznika — licznik to presja, a tego unikamy.
- **Złożenie palca tylko WSTRZYMUJE płomień.** Podniesienie zapala go z powrotem. Technika kończy się wyłącznie wyczerpaniem mocy, nigdy pomyłką ręki. Reguła nadrzędna (GEMINI.md §2).

---

## Co przesądza o tym, czy ogień wygląda pięknie

Nie jest to kwestia liczby cząsteczek. Pięć rzeczy decyduje:

1. **Rampa barw.** Ogień jest emisyjny: rdzeń prawie biały → nasycony żółty → pomarańcz → głęboka czerwień → **zanik do zera**. Nie do szarości: szarzenie to najczęstszy powód, dla którego ogień wygląda jak plama, a w trybie `lighter` szary dym i tak jest niewidoczny.

2. **Dziedziczenie prędkości palca.** Cząsteczki dostają wyporność w górę **plus ułamek prędkości opuszka**. Bez tego płomień skacze za palcem, zamiast za nim płynąć. To jest sedno pomysłu gracza.

3. **Emisja wzdłuż toru, nie w punkcie.** Przy szybkim ruchu cząsteczki rozkładamy między poprzednią i obecną pozycją opuszka, inaczej w płomieniu pojawiają się dziury.

4. **Turbulencja.** Sam ruch w górę daje fontannę. Potrzebne boczne chwianie o amplitudzie rosnącej z wiekiem cząsteczki.

5. **Sprite renderowany RAZ.** Jeden gradient promieniowy na barwę, wypalony do pomocniczego płótna przy starcie, potem `drawImage` ze skalą. Tworzenie gradientu na cząsteczkę na klatkę to różnica między 60 a kilkoma FPS.

---

## Architektura

Dwa nowe pliki, bo to są dwie różne odpowiedzialności:

| Plik | Odpowiedzialność |
|---|---|
| `js/ogien.js` | **tylko rysowanie.** Dostaje pozycję, prędkość i siłę; nie wie nic o pieczęciach ani o mocy. Nadaje się do ponownego użycia przy ognisku i innych efektach ognia. |
| `js/plonacyPalec.js` | **stan techniki.** Warunek zapłonu, maszyna stanów (gotowy / płonie / wstrzymany / wyczerpany), pobieranie mocy. Nie rysuje. |

Ten podział jest celowy: `efekty.js` jest w komentarzu opisany jako część najbardziej narażona na rozrost, a ogień jest pierwszą rzeczą, która by go rozsadziła.

### Warunek zapłonu

Jedna dłoń z **dokładnie jednym wyprostowanym palcem**, którego opuszek jest **powyżej linii barków** (`pose` punkty 11/12).

Wymaga obu trackerów naraz — dłoni na palec i pozy na barki. Oba już są w pętli, a kadr do pasa wystarcza.

### Stany

```
GOTOWY      (po kombosie, bez licznika)
  │  palec wysunięty nad bark
  ▼
PLONIE  ←──────────────┐  moc spada
  │  palec złożony     │  łagodne wygaszanie
  ▼                    │
WSTRZYMANY ────────────┘
  │  moc = 0
  ▼
WYCZERPANY  (potrzebny nowy kombos)
```

---

## Pliki

### Nowe
- `js/ogien.js`, `js/plonacyPalec.js`
- `tools/test-plonacy-palec.mjs` — stany, pobieranie mocy, warunek zapłonu

### Modyfikowane
- **`js/main.js`** — wpiąć technikę; kombos ustawia stan GOTOWY zamiast tylko odpalać efekt jednorazowy
- **`js/debugHud.js`** — stan techniki, prędkość opuszka, liczba żywych cząsteczek (do pilnowania klatkażu)

---

## Weryfikacja

Bez kamery (`sh tools/test-wszystko.sh` — 12 istniejących testów musi dalej przechodzić):

1. **Bez kombosa palec nad barkiem NIE zapala** ognia.
2. **Po kombosie zapala**, i to bez względu na to, ile czasu minęło (brak licznika).
3. **Moc spada w tempie ~1/30 na sekundę** płonięcia; przy zerowej mocy technika się kończy.
4. **Złożenie palca wstrzymuje, nie kończy** — podniesienie zapala z powrotem, o ile moc została.
5. **Dwa wyprostowane palce nie zapalają** (warunek to DOKŁADNIE jeden).
6. **Klatka z NaN i brak pozy** — zero, nie wyjątek.

Na żywym ciele (`http://localhost:8000`, klawisz `D`):

7. **FPS ≥ 24** przy pełnym płomieniu ze żarem. Zmierzone bez ognia: ~60, więc jest zapas — ale 450 cząsteczek trzeba potwierdzić, nie założyć.
8. **Płomień trzyma się opuszka** i wygina przy ruchu, nie skacze.
9. **Zamach rysuje łuk żaru** w powietrzu, bez dziur przy szybkim ruchu.
10. **Ogień wygląda jak ogień** — to jedyne kryterium, którego nie da się zmierzyć. Ocena gracza rozstrzyga.
