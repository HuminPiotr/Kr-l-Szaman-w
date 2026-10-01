# Tryby gry — runda, pieśń, Krąg, Zew (podprojekt 2 z 3 „arcade")

## Kontekst

Podprojekt 1 (`2026-10-01-punktacja-design.md`) dał punkty, ale gra ma dziś jeden, nieskończony
tryb. Tu dochodzą **rundy**: początek, koniec i wynik do porównania. Menu z wyborem trybu,
nick i Księga rekordów to podprojekt 3 — tu budujemy silnik rundy i jeden punkt wejścia,
który menu później wywoła.

Decyzje z burzy mózgów (2026-10-01):
- **Obrzęd** — runda trwa tyle co pieśń (pliki dostarcza właściciel).
- **Próba** — runda na czas (60 / 90 / 120 s), bez podkładu; gracz sam sobie włącza muzykę.
- **Swobodny** — bez punktów, bez końca, jak dawna gra (spec punktacji, §2).
- **Krąg** (modyfikator): 2–6 graczy po kolei, podium na końcu.
- **Zew żywiołów** (modyfikator): co ~20 s duch „prosi" o żywioł, ten żywioł daje ×2.
- §2 obowiązuje: koniec rundy to **podsumowanie, nie porażka**; Zew niczego nie zabiera.

## Moduły

### `js/tryby.js` — czysta logika (bez DOM, testy w node)

**Stałe:** `ODLICZANIE_S = 3`, `WYBRZMIENIE_S = 2`, `ZAPOWIEDZ_S = 4`, `PROBA_DLUGOSCI = [60, 90, 120]`,
`PIESN_AWARYJNA_S = 90`, `OSTATNIE_S = 10`.

**`class Runda`** — maszyna stanów, czas z `now` (ms, `performance.now()`), niezależna od FPS:

`ODLICZANIE (3 s) → TRWA → WYBRZMIENIE (2 s) → KONIEC`

- `new Runda({ tryb, dlugoscS })` — `tryb ∈ 'obrzed' | 'proba' | 'swobodny'`. Swobodny nie ma
  stanów: `Runda` dla niego nie powstaje (`main.js` trzyma `runda = null`).
- `start(now)`, `update(now) → stan`, `przerwij()` (Esc → stan `PRZERWANA`, **bez wyniku do zapisu**).
- Pola: `stan`, `pozostaloS` (podczas TRWA, `Infinity` poza), `postep` 0..1, `ostatnieSekundy` (bool),
  `odliczanie` (3, 2, 1 do wyświetlenia).
- **WYBRZMIENIE:** punkty nadal przyrastają — reakcje (płonący dym) kończą się naturalnie, a nie
  urywają. Wynik końcowy jest pobierany dopiero w `KONIEC`.
- Obrzęd może skończyć się wcześniej niż minął czas: `zakonczPiesn(now)` (zdarzenie `ended` audio)
  przechodzi do WYBRZMIENIA od razu.
- **Pauza karty:** `update` z `now` skaczącym o > 1 s (uśpiona karta) nie przeskakuje rundy do końca:
  zegar rundy liczy skumulowane `min(dt, 0.25 s)`, tak jak `dt` w pętli gry. Piosenka i runda
  rozjadą się tylko przy realnym zawieszeniu — wtedy końcem rządzi `ended`.

**`class Zew`** — mnożnik punktów:
- `ZYWIOLY = ['swarog', 'weles', 'perun', 'stribog', 'mokosz']` (id pieczęci).
- `new Zew(losowa = Math.random)`; `update(czasRundyS)` — pierwsza prośba po `ZEW_START_S = 5`,
  potem co `ZEW_CO_S = 20`; nowy żywioł **≠ poprzedni** (losowanie bez powtórzeń).
- `mnoznik(rodzaj, arg)` → 2, gdy `rodzaj==='pieczec'` i `arg === zywiol`, albo `rodzaj==='technika'`
  i `arg.sekwencja.includes(zywiol)`; inaczej 1. Wpina się w `Punktacja.mnoznikZewu` (hak z podprojektu 1;
  jego walidacja `>= 1 && skończony` zostaje).
- **Mnożnik dotyczy pieczęci i techniki, nie reakcji i nie tańca** — inaczej Zew ×2 na Pożodze
  wyprowadzałby zmierzony balans (podprojekt 1) poza cel.
- Zew nie jest zadaniem do zaliczenia — brak komunikatu „nie zrobiłeś"; zmiana żywiołu to tylko
  nowa zachęta.

**`class Krag`** — kolejka graczy:
- `new Krag(nicki)`: 2–6 nicków po przycięciu; puste/zdublowane odrzucane (dubel dostaje sufiks „ 2");
  poza 2–6 → konstruktor rzuca (menu pilnuje wcześniej).
- `biezacy`, `zapiszWynik(wynik, rozbicie, momenty)`, `nastepny() → nick | null`, `czyKoniec`,
  `podium` (malejąco po wyniku; remis — kolejność wejścia do Kręgu).
- Wyniki z Kręgu trafiają do Księgi (podprojekt 3) **per gracz**, jakby każdy zagrał osobną rundę.

### `js/swiezeModuly.js` — równy start rundy

W Kręgu następny gracz **nie może** odziedziczyć cudzej uzbrojonej techniki ani chmury dymu.
Większość modułów nie ma `reset()`, więc fabryka `swiezeModuly({ sekwencjaEl... })` zwraca **nowe
instancje wszystkich modułów ze stanem rundy**:

`motionMeter, plynnoscMiara, skladanie, kombosy, efekty, runy, sekwencja, ogien, plonacyPalec,
dmuchanie, dym, podmuch, fala, tecza, iskry, zaplon, ekran, piorun, kolowrot`.

Zostają (stan nie należy do rundy): trackery, `aura` (zależna od płótna), `audioEngine`,
`debugHud`, `znaki` (rejestr bezstanowy), `wynikHud`, `histereza pelnaMoc`. `Punktacja` ma
własne `reset()`. `main.js` przepina je destrukturyzacją
`({ motionMeter, ... } = swiezeModuly(...))` w `startRundy()`; `main.js` używa `let`.
Wywołanie jest także przy `przerwij()`/końcu — plansza po rundzie startuje czysta.

Test (`tools/test-swieze-moduly.mjs`, z atrapą DOM jak `test-dym.mjs`): każda zwrócona instancja jest
bezczynna (`plonacyPalec.stan === 'BEZCZYNNY'`, `podmuch.stan`, `dmuchanie.stan`, `dym.liczba === 0`,
`fala.czola.length === 0`, itd.), a zbiór kluczy fabryki równa się liście wyżej (nowy moduł
dodany do `main.js` bez wpisu tutaj = czerwony test strażnika po stronie listy w teście).

### `js/piesni.js` — pieśni

- `assets/muzyka/utwory.json`: `[{ plik, tytul, autor, licencja }]`. Pliki dostarcza właściciel;
  pusta lista jest poprawna (Obrzęd jest wtedy niedostępny, a Próba działa).
- `wczytajManifest()` → lista (błąd sieci/JSON = pusta, bez wyjątku).
- `class Piesn` — `<audio>` → `MediaElementSource` → **`audioEngine.masterGain`** (nowa metoda
  `AudioEngine.podlaczPiesn(audioEl)`), dzięki czemu klawisz **M** wycisza także pieśń, a kompresor
  nie pozwala jej zagłuszyć efektów.
- Długość z `audio.duration` po `loadedmetadata`; nieskończona/NaN/błąd wczytania → `PIESN_AWARYJNA_S`
  i komunikat **„Duchy zgubiły pieśń"** (nie błąd, §2). Runda działa dalej jako próba.
- Start pieśni w stanie TRWA (nie ODLICZANIE); zanik głośności w WYBRZMIENIU.
- **Gest użytkownika:** `audio.play()` wywołane z kliknięcia „start rundy" (menu, podprojekt 3) albo
  z klawisza; do tego czasu dla `?tryb=` z adresu patrz niżej.

## HUD rundy — `js/rundaHud.js` (DOM)

Czyste funkcje + cienka klasa jak `wynikHud.js`: odliczanie 3-2-1 na środku (runa/duża cyfra), pozostały
czas (prawy górny róg, lewo od wskaźnika dźwięku), baner Zewu pod komunikatem instrukcji
(„Duchy proszą: ogień ×2"), „Teraz tańczy: Ola" w ZAPOWIEDZI, koniec rundy → prosty baner z wynikiem
(**tymczasowy** — zastąpi go Kronika z podprojektu 3). Ostatnie 10 s: licznik płonie i łuna rośnie,
bez zagrożenia. `prefers-reduced-motion`: bez pulsowania, sam kolor.

## Wejście z adresu (do czasu menu)

Menu to podprojekt 3, więc do testowania rund: `?tryb=proba&czas=60&zew=1&krag=Ola,Bartek` i
`?tryb=obrzed&piesn=0`. `js/main.js` parsuje parametry (`parsujKonfiguracje(search)` w `tryby.js`,
czysta funkcja z walidacją: nieznany tryb/czas → swobodny; `czas` spoza `PROBA_DLUGOSCI` → 90;
nicki przycinane do 16 znaków) i uruchamia `startRundy(konfig)` po starcie gry. Menu wywoła **tę samą**
funkcję — jeden punkt wejścia. **Brak parametrów = tryb swobodny: `punkty.aktywna = false`** — to zamyka
konflikt z końcowego przeglądu podprojektu 1 (swobodny pokazywał licznik).

## Przerwanie

**Esc** w rundzie → `przerwij()`: bez zapisu, fabryka czyści moduły, wraca swobodny. Kamera działa dalej.

## Poza zakresem

Menu, wybór trybu myszą, nick, Księga rekordów, Kronika, koronacja i jajka z nickami (podprojekt 3);
rytm/BPM (GEMINI.md §7 pkt 4).

## Ryzyka

- **Rozjazd pieśni i zegara rundy** po zawieszeniu karty — łagodzony przycinaniem `dt` i `ended`.
- **Autoplay:** `audio.play()` bez gestu bywa odrzucone; przy odrzuceniu runda działa jako próba
  z komunikatem (jak błąd wczytania), nie przerywa gry.
- **Fabryka instancji** — pomijam moduł z ukrytym stanem = dziedziczenie między graczami; stąd test
  bezczynności i test zbioru kluczy.
- Długości Zewu (5 s start, 20 s) i Próby są zgadnięte — do strojenia na żywym ciele.
