# Szczur i Podmuch (Aard) — projekt

## Context

Poprzednia sesja dodała pieczęć **Szczura** (`js/znaki/szczurDlon.js`) i wpis kombosa
`szczur × 2 → aard` (`js/kombosy.js`), ale przerwała pracę zanim technika dostała
implementację. Mechaniczna część została domknięta osobno (commit `dd83f55`):
Szczur jest teraz zarejestrowany w `main.js` i składalny w grze, a `kombosy.js`
routuje uzbrojenie po polu `uzbraja` zamiast bezwarunkowo uzbrajać płonący palec.

Ten dokument projektuje samą technikę: **Podmuch (Aard)** — falę wychodzącą z ręki
gracza w kierunku, który wskazuje otwarta dłoń przy machnięciu.

### Decyzje z rozmowy

- **Fala jest samodzielna.** Nie dotyka aury, ognia ani reszty sceny. Najczystsze
  granice między plikami; gra reaguje na technikę wyłącznie tym, że fala jest ładna.
- **Jednorazowe pchnięcie**, nie kanałowanie. Kombos uzbraja; jedno machnięcie
  otwartą dłonią odpala falę i zużywa uzbrojenie. Bez licznika ważności — ta sama
  zasada, co przy płonącym palcu (`docs/superpowers/specs/2026-08-08-plonacy-palec-design.md`):
  licznik to presja, a stąd unikamy presji.
- **Kierunek zależny od gestu, w 3D.** Fala leci w stronę, którą wskazuje otwarta
  dłoń w chwili machnięcia — nie w ustalony kierunek i nie tylko w płaszczyźnie
  ekranu.
- **Cząstki rzutowane perspektywicznie.** Prawdziwa przestrzeń 3D, rzut na płótno.
  Bliższe cząstki większe i jaśniejsze, dalsze mniejsze i bledsze.
- **Kamera zostaje czysta.** „Ognisko" niżej to termin optyczny (ogniskowa
  projekcji), nie element sceny. Nic nie rysuje się przed obrazem z kamery poza
  cząstkami fali, tak jak dziś rysuje się ogień.
- **Ogniskowa zgadnięta, nie wyliczona z kamery.** Jedna stała `OGNISKO`,
  wystrojona okiem i opisana komentarzem do potwierdzenia na żywo — ten sam wzorzec,
  co reszta progów w tej grze. Wyliczanie ogniskowej z porównania `landmarks` i
  `worldLandmarks` zostaje jako możliwe rozszerzenie: zmiana jednej stałej we
  wzorze rzutu, bez ruszania cząstek.

---

## Architektura

Ten sam podział, co przy płonącym palcu — dwie odpowiedzialności, dwa pliki:

| Plik | Odpowiedzialność |
|---|---|
| `js/fala.js` | **tylko rysowanie.** Dostaje zaczep (x, y na płótnie), kierunek 3D i siłę. Nie wie nic o pieczęciach ani o mocy. |
| `js/podmuch.js` | **stan techniki.** Uzbrojenie, warunek machnięcia, wybór kierunku, pobranie mocy. Nie rysuje. |

### Wyzwalacz machnięcia

Trzy warunki, wszystkie ciągłe (reguła nadrzędna: żaden nie jest twardym
odrzuceniem gestu jako całości — brak spełnienia po prostu nie odpala techniki,
bez komunikatu o porażce):

| warunek | pomiar | źródło |
|---|---|---|
| dłoń otwarta | średnie wyprostowanie 4 palców (bez kciuka) | `landmarks` |
| machnięcie | prędkość nadgarstka w **skalach dłoni na sekundę** | `landmarks`, kolejne klatki |
| kierunek | normalna dłoni | `worldLandmarks` |

Gdy obie dłonie spełniają warunek naraz, wygrywa ta z wyższym iloczynem
otwartości i prędkości.

**Wyjątek od zasady „pomiary z worldLandmarks" (GEMINI.md):** `worldLandmarks`
dłoni mają początek układu współrzędnych **w środku samej dłoni**, więc
przesunięcie dłoni po kadrze jest w nich niewidoczne — nie da się z nich
zmierzyć prędkości machnięcia. Prędkość liczymy z `landmarks` (znormalizowane
do kadru, skalowane rozmiarem dłoni, żeby nie zależeć od odległości od
kamery). Orientację liczymy z `worldLandmarks`, bo to one wiernie oddają
kształt dłoni w przestrzeni. Rozdział, nie odstępstwo bez uzasadnienia.

### Kierunek: oś z dłoni, zwrot z machnięcia

Normalna dłoni (iloczyn wektorowy dwóch wektorów w jej płaszczyźnie) ma
niejednoznaczny znak — dla lewej i prawej dłoni wychodzi w przeciwne strony,
a stronność bywa myllona przy obróconej dłoni. Rozwiązanie:

1. Policz normalną — to daje **oś**, nie zwrot.
2. Policz wektor machnięcia 3D: X/Y ze zmiany pozycji nadgarstka w `landmarks`,
   Z ze zmiany **skali dłoni** (rosnąca dłoń = ruch ku kamerze).
3. Wybierz ten z dwóch zwrotów normalnej, który ma dodatni iloczyn skalarny
   z wektorem machnięcia.

Znak samej normalnej może być błędny — machnięcie go koryguje, więc błąd
stronności nie psuje kierunku fali.

### Koszt mocy

Podmuch pobiera jednorazowo **~1/4 paska mocy** (`KOSZT_PODMUCHU = 0.25`,
zgadnięte, do potwierdzenia na żywo). Przy niedoborze **nie odmawia** — bierze
tyle, ile jest dostępne, i siła fali (`sila = min(1, moc / KOSZT_PODMUCHU)`)
skaluje się proporcjonalnie. Reguła nadrzędna: pusty pasek daje słabą falę,
nigdy komunikat o porażce ani odrzucenie gestu.

### Rysowanie fali

Cząstki żyją w przestrzeni **pikselowej** `(x, y, z)`; `z = 0` w miejscu
zaczepu, rośnie w kierunku machnięcia.

```
rzut:        s = OGNISKO / (OGNISKO + z)     // OGNISKO ≈ szerokość płótna, ZGADNIĘTE
na ekranie:  zaczep_2d + (x, y) · s
rozmiar:     ∝ s
alfa:        ∝ s · (1 − wiek / czasZycia)
```

- **Emisja stożkiem** wokół kierunku 3D; rozwarcie stożka **rośnie z wiekiem
  fali** — to jest „rozpływa się i znika, rozszerzając się coraz bardziej".
- **Opór powietrza** hamuje cząstki z czasem, żeby fala zwalniała zamiast
  lecieć bez końca.
- **Sortowanie po `z`** przed rysowaniem — dalsze pod bliższymi. Przy
  budżecie cząstek z p.6 (rząd 200) koszt jest pomijalny.
- **Sprite wypalony raz** przy starcie modułu, potem `drawImage` ze skalą —
  ten sam wzorzec co `ogien.js` (punkt 5 jego nagłówka), z tego samego powodu:
  gradient na cząstkę na klatkę zabija FPS.
- **Barwa** już zapisana w `efekty.js` (`aard: '200, 70%, 88%'`) — blady
  błękit. Wiatr sam w sobie jest niewidzialny; widać zaburzenie, nie
  powietrze.

---

## Pliki

### Nowe

- `js/fala.js` — układ cząstek, rysowanie (wzorzec `ogien.js`)
- `js/podmuch.js` — stan techniki: uzbrojenie, wyzwalacz, kierunek, koszt mocy (wzorzec `plonacyPalec.js`)
- `js/znaki/dlon.js` *(rozszerzenie, nie nowy plik)* — `normalnaDloni(lm)` zwraca wektor 3D z `worldLandmarks`
- `tools/test-podmuch.mjs` — stany, warunek machnięcia, wybór kierunku, koszt mocy
- `tools/test-fala.mjs` — cykl życia cząstek, rzut perspektywiczny, wygasanie

### Modyfikowane

- **`tools/_dlon-syntetyczna.mjs`** — generator jest dziś płaski (`z: 0` na
  wszystkich 21 punktach) i nie wystawia `worldLandmarks`. Bez pochylenia w
  głąb normalna zawsze wskazywałaby prosto w kamerę i kierunek fali byłby
  niesprawdzalny testami jednostkowymi. Dodać parametr pochylenia i wystawić
  `worldLandmarks` obok `landmarks`.
- **`js/main.js`** — utworzyć `Podmuch`, wpiąć w pętlę klatki obok
  `plonacyPalec`; kombos z `uzbraja === 'aard'` woła `podmuch.uzbrój()`
  (dziś gałąź jest pusta — patrz commit `dd83f55`).
- **`js/debugHud.js`** — stan techniki, wykryty kierunek (kąt lub wektor),
  liczba żywych cząstek fali — do strojenia `OGNISKO` i progów machnięcia na
  żywo, tym samym wzorcem co przy ogniu.

### Nietknięte

`js/efekty.js` (wpis `aard` zostaje jako zapowiedź/rozbłysk startowy — patrz
niżej), `js/aura.js`, `js/ogien.js`, `js/plonacyPalec.js`.

**Zapowiedź w `efekty.js` a właściwa fala:** wpis `aard` w tabeli (`pierścień`,
`czas: 0.8`) odpala się w chwili złożenia kombosa — to sygnał „uzbrojono", nie
sama technika. Fala z `fala.js` odpala się później, przy machnięciu. To ten
sam wzorzec, co przy ogniu: kombos daje błysk z tabeli, technika żyje osobno.

---

## Weryfikacja

Bez kamery (`sh tools/test-wszystko.sh` musi dalej przechodzić w całości):

1. Bez uzbrojenia machnięcie nie odpala fali.
2. Po uzbrojeniu machnięcie odpala falę **i zużywa uzbrojenie** — drugie
   machnięcie z rzędu nic nie robi bez nowego kombosa.
3. Zamknięta dłoń (pięść) nie odpala, choćby ruch był gwałtowny.
4. Otwarta dłoń bez ruchu (poniżej progu prędkości) nie odpala.
5. Ta sama dłoń machnięta w przeciwne strony daje kierunki fali o
   przeciwnym zwrocie.
6. Dłoń pochylona w co najmniej cztery różne strony (lewo/prawo/w
   głąb/ku kamerze) daje cztery wyraźnie różne kierunki — dowód, że
   normalna i rzut faktycznie niosą 3D, nie tylko 2D.
7. Przy mocy poniżej kosztu podmuchu fala jest słabsza (mniej/wolniejsze
   cząstki), a nie brakuje jej wcale.
8. Klatka z NaN i brak dłoni w kadrze — zero, nie wyjątek.
9. Cząstki fali wygasają: po czasie życia licznik żywych cząstek wraca do
   zera, żadna nie zostaje na stałe.
10. Rzut perspektywiczny: cząstka z większym `z` ma mniejszy `s` (mniejszy
    rozmiar i alfa) niż cząstka z mniejszym `z` przy tym samym wieku.

Na żywym ciele (`http://localhost:8000`, klawisz `D`):

11. **FPS ≥ 24** przy pełnej fali.
12. **Kierunek zgodny z intuicją** — machnięcie w bok/w górę/w dół/ku kamerze
    daje falę lecącą tam, gdzie gracz wskazał.
13. **Perspektywa nie wygląda dziwnie** przy zgadniętym `OGNISKO` — jedyne
    kryterium bez pomiaru, rozstrzyga ocena gracza. Jeśli nie, wystroić
    stałą z nakładki, tak jak inne progi w tej grze.
14. **Rytm rytuału**: Szczur × 2 → uzbrojenie widoczne w HUD → machnięcie →
    fala. Cały łańcuch bez przerwy dłuższej niż okno kombosa (4 s).

---

## Poza zakresem

1. Wyliczanie `OGNISKO` z kalibracji kamery (porównanie `landmarks` vs
   `worldLandmarks` na punktach ciała) — możliwe później jako podmiana
   jednej stałej, bez zmian w `fala.js`.
2. Sprzężenie fali z innymi efektami (odrzut aury, rozwiewanie żaru po
   płonącym palcu) — odrzucone w tej rundzie na rzecz prostoty; fala zostaje
   samodzielna.
3. Kombosy łączące Aard z innymi technikami.
