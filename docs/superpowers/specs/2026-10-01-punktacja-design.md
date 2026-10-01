# Punktacja — system punktowy (podprojekt 1 z 3 „arcade")

## Kontekst

Gra była czystym tańcem: bez punktów, timera i porażki (GEMINI.md §2). Właściciel chce
arcade'owości i rywalizacji między graczami. Podprojekty: **1. punkty (ten spec)**,
2. tryby gry, 3. menu „Polana" + Księga rekordów. Punkty są fundamentem dla pozostałych dwóch.

Decyzje z burzy mózgów (2026-10-01):
- **§2 przepisane, nie usunięte.** Punkty tylko PRZYBYWAJĄ. Brak kar, combo nie resetuje się
  za pomyłkę, nic nie mówi „źle". Znika wyłącznie „brak punktów/timera". Tryb swobodny zostaje
  jak dziś (punkty nieaktywne i niewidoczne).
- **Warstwy:** taniec + pieczęć + technika + reakcje. Bez globalnego mnożnika „żaru".
- Premie za **reakcje między technikami** (to, o co prosił właściciel: podpalony dym punktuje
  za każdy wybuchnięty kłąb).
- **Rozszerzalność:** nowe techniki i reakcje mają się wpinać bez przepisywania punktacji.

## Moduł `js/punkty.js`

Czysta logika, bez DOM i canvasu (wzorzec `js/kombosy.js`), testowana w `node`.
`main.js` zgłasza zdarzenia (PUSH), HUD odczytuje stan co klatkę (PULL, jak `sekwencja.js`).

API klasy `Punktacja`:

| Metoda / pole | Znaczenie |
|---|---|
| `taniec(plynnosc, responsywnosc, dt)` | strumień za ruch; zła wartość (NaN/∞/ujemna) → 0 |
| `pieczec(id, now)` | stała nagroda; zapisuje pieczęć w WŁASNEJ historii |
| `technika(kombo, now)` | wartość z tabeli, malejący przyrost, splecenie; zwraca przyznane punkty |
| `reakcja(id, n, now)` | `n` jednostek reakcji z rejestru `REAKCJE` |
| `wynik`, `rozbicie` | suma; `{ taniec, pieczecie, techniki, reakcje }` |
| `zdarzenia` | kolejka do unoszących się napisów (PULL, czyszczona przez HUD) |
| `momenty` | największe osiągnięcia rundy (np. największa Pożoga) — dla Kroniki |
| `mnoznikZewu` | hak (funkcja `(idPieczeci\|kombo) → 1..2`) dla trybu Zew (podprojekt 2) |
| `aktywna` | `false` w trybie swobodnym — wszystkie metody wtedy nic nie robią |
| `reset()` | równy start rundy |

**Niezmiennik:** żadna ścieżka API nie zmniejsza `wynik`. Test to sprawdza.

## Wartości

- **Taniec:** do ~4 pkt/s × `plynnosc` × `motionMeter.responsywnosc` (0..1, po odjęciu
  podłogi szumu — samo stanie w miejscu nie punktuje). Ok. 500 pkt za 2 min tańca: ktoś, komu
  nie wychodzą pieczęcie, nadal zdobywa punkty.
- **Pieczęć:** 25.
- **Technika:** `100 × Σ TRUDNOSC[pieczęć w sekwencji]`, gdzie
  `TRUDNOSC = { mokosz: 1.0, weles: 1.0, perun: 1.2, stribog: 1.4, swarog: 1.6 }`.
  Trudność pochodzi ze zmierzonej rozpoznawalności (`tools/test-rozdzielnosc.mjs`, komentarz
  w `js/kombosy.js` przy Kołowrocie): woda/ziemia ≈ 1,0, błyskawica 0,70–1,00, powietrze
  0,40–0,93, ogień 0,21–0,59. Im trudniej pieczęć złożyć, tym więcej wnosi.
  Przykłady: Kołowrót (perun, weles, mokosz) = 320; Okadzenie (swarog, stribog, swarog) = 460;
  Grom w Ogniu (swarog, perun) = 280; Aard (stribog ×2) = 280.
- **Malejący przyrost:** ta sama technika pod rząd daje 100% → 75% → 50% (podłoga 50%);
  inna technika przywraca 100%. Nie kara — nagradza różnorodność; punkty nigdy nie znikają.

## Reakcje (rejestr)

`REAKCJE = { id: { nazwa, punktyZaJednostke, ... } }`. Nowa reakcja to jeden wpis plus jedno
wywołanie `punkty.reakcja(id, n, now)` tam, gdzie zachodzi.

| id | Co | Punkty |
|---|---|---|
| `pozoga` | wybuchnięty kłąb podpalonego dymu | +5 za kłąb, malejąco po 40 kłębach w jednym pożarze (przerwa 1,5 s) |
| `rozwianie` | kłąb dymu pchnięty falą (Aard, fala Gromu w Ziemię) PO RAZ PIERWSZY W ŻYCIU | +2 za kłąb, malejąco po 30 w serii (przerwa 10 s) |
| `splecenie` | technika odpalona ogonem, który dzieli pieczęć z ogonem poprzedniej techniki | +50% wartości drugiej techniki |

**„Jeden pożar"** = seria wybuchów bez przerwy dłuższej niż ~1,5 s. Sufit malejącego
przyrostu liczy się per pożar. Kolumna dymu to setki cząstek, więc bez sufitu jedna detonacja
przebiłaby kilka technik.

**Cel balansu (do POTWIERDZENIA pomiarem `node tools/pomiar-reakcji.mjs` — fizyka dymu
jest deterministyczna, nie trzeba kamery; mierzymy przy MAKSYMALNEJ chmurze):**
- pełna Pożoga ≈ 1,5–2× wartości Okadzenia (~700–900 pkt), nigdy więcej niż ~3 techniki;
- pełne Rozwianie maksymalnej chmury ≤ ~300 pkt (≈ jeden Aard);
- Okadzenie dokarmiane + Aard co 3 s przez 60 s: Rozwianie łącznie ≤ ~1000 pkt.
Liczby 8/50 i 3/40 były startowe; pomiar ustalił je ostatecznie.

**Pomiar (2026-10-01, `node tools/pomiar-reakcji.mjs`):**

| | startowe 8/50, 3/40, przerwa 1,5 s | ostateczne 5/40, 2/30, Rozwianie przerwa 10 s |
|---|---|---|
| Pożoga, chmura 140 kłębów | 809 | 449 |
| Pożoga, chmura 350 | 1175 | 632 |
| Pożoga, chmura maks. (1100) | **1633** | **860** ✓ |
| Rozwianie, chmura maks. | **516** | **275** ✓ |
| Farma: chmura dokarmiana + fala co 3 s przez 60 s | **6500** | **362** ✓ |

Farma pokazała, że „raz w życiu kłębu" nie wystarcza: dokarmiana chmura dostarcza świeżych
kłębów, a fala co 3 s otwierała nową serię z pełnymi punktami. Przerwa serii Rozwiania 10 s
zlewa regularne fale w jedną serię z logarytmicznym przyrostem.

Dodatkowo (z fuzzu w teście): `MAX_JEDNOSTEK_NA_WYWOLANIE = 2000` — `reakcja('pozoga', 1e9)`
zawieszała pętlę; jedna klatka nie może mieć więcej jednostek niż cała chmura (`MAX_CZASTEK` 1100).

**Splecenie po NAKŁADANIU OGONÓW, nie po czasie.** `Punktacja` ma własną historię pieczęci
(wpisy `{id, t}` z `pieczec()`); technika zapamiętuje, których wpisów (po znaczniku `t`)
użyła jako ogona. Nowa technika, której ogon dzieli wpis z ogonem poprzedniej, dostaje
splecenie. Próg czasowy odpadł: w łańcuchu Okadzenie → Grom w Ogniu czwarta pieczęć składa
się ≥ 0,9 s po trzeciej. Bufor kombosów nie jest czyszczony po trafieniu (zamierzone), więc
nakładanie ogonów to naturalny sygnał „połączyłeś".

## Rozwianie — zmiana w `js/dym.js`

Kłąb płaci Rozwianie **raz w życiu**, nie raz na falę. Chmura Okadzenia żyje ~200–260 s
i można ją dokarmiać minutami; liczenie na każdą falę zrobiłoby z „chmura + Aard co 3 s"
(~420 pkt na falę przy ~500 kłębach) najlepszą strategię gry. Raz w życiu = chmura jest
zasobem, który się zużywa, jak przy Pożodze. Przy okazji odpada naiwne liczenie per klatka
(czoło fali żyje ~0,7 s i pcha dym co klatkę).

Implementacja: flaga `c.rozwiany` ustawiana w `_przygotuj` (obok innych pól cząstki),
przestawiana przy pierwszym pchnięciu w pętli podmuchów `_fizyka`. `updateAndDraw` dalej
zwraca liczbę wybuchów; liczba nowo rozwianych z ostatniej klatki trafia do pola
`dym.ostatnioRozwiane`. `fala.js` i wywołania `pchniecieCzola` bez zmian.

## HUD — `js/wynikHud.js`

DOM, nie płótno (płótno jest lustrzane, GEMINI.md §4). Licznik u góry; unoszące się
„+340 Okadzenie" / „Pożoga ×23" w miejscu zdarzenia (`srodekDloni` z `js/efekty.js`,
przeliczone na lustro). `prefers-reduced-motion` jak w P4.3. Ukryty, gdy `aktywna === false`.

## Wpięcie w `js/main.js`

- blok 6a: `punkty.pieczec`, `punkty.technika`;
- po `dym.updateAndDraw`: `reakcja('pozoga', wybuchy, now)`, `reakcja('rozwianie', dym.ostatnioRozwiane, now)`;
- co klatkę: `punkty.taniec(plynnosc, motionMeter.responsywnosc, dt)`.

## Testy — `tools/test-punkty.mjs` (do `tools/test-wszystko.sh`)

- **Strażnik rozszerzalności:** każde combo z `KOMBOSY` ma skończoną dodatnią wartość,
  każda pieczęć w jakiejkolwiek sekwencji ma wpis w `TRUDNOSC`, każda reakcja używana w kodzie
  istnieje w `REAKCJE`. Nowa technika bez wartości wywala test.
- Punkty nigdy nie maleją; NaN/Infinity na wejściu ignorowane (GEMINI.md §4, zatruta moc).
- Malejący przyrost i jego reset po innej technice.
- Sufit Pożogi na jeden pożar; nowy pożar po przerwie > 1,5 s.
- Splecenie na łańcuchu swarog→stribog→swarog→perun (ten sam scenariusz co `test-kombosy.mjs`);
  brak splecenia, gdy ogony się nie nakładają.
- `aktywna = false` → zero punktów i zdarzeń.
- `dym`: kłąb liczy się raz w życiu — ani ta sama fala przez wiele klatek, ani kolejna fala nie liczy go ponownie.

## Poza zakresem

Tryby i koniec rundy (podprojekt 2), zapis wyników i Księga (podprojekt 3), mnożnik Zewu
(tylko hak `mnoznikZewu`).

## Ryzyka

Liczby punktów są ZGADNIĘTE jak progi w reszcie gry i wymagają strojenia na żywym ciele.
Struktura (warstwy, trudność wyprowadzona z pomiarów, rejestr reakcji, strażnik w teście)
jest tak zbudowana, żeby strojenie zmieniało stałe, nie kod.
