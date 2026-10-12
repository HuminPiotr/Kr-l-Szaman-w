# Pamięć Plemienia — Zwój Technik, Węzły Mocy i Kamienie Pamięci w Księdze

## Context

Właściciel chce miejsca, gdzie gracz w każdej chwili sprawdzi, ile dostępnych technik już odkrył,
i zobaczy osiągnięcia (np. za łączenie technik). Ma to być część **Księgi Plemienia** i wyglądać
atrakcyjnie, intrygująco, w klimacie gry. Dziś Księga (`js/ksiega.js`, `js/polanaUi.js`, `#ksiega-ekran`)
pokazuje wyłącznie tablice wyników. Wszystkie techniki są dostępne od początku, więc
**„odblokowana" = choć raz wykonana (odkryta)**.

Ścieżka brainstormingu: **architektoniczna** (nowy podsystem). Decyzje zatwierdzone w rozmowie 2026-10-12:
- Kolekcja **wspólna na przeglądarkę**, liczona **wszędzie**, także w swobodnym tańcu (nie pod menu).
- Nieodkryta technika: **tylko nazwa + zaciemniony emblemat**, bez sekwencji i run.
- Emblematy: **ręcznie rysowane SVG** (16 technik + 13 węzłów, 5 pieczęci ma już runy).
- Osiągnięcia: kolekcjonerskie, mity (splątania), kunszt i obrzęd, sekrety z jajem: 24 kamienie (lista niżej).
- Powiadomienie **na żywo (cichy znak w rogu) + sekcja w Kronice**, a w Księdze nowości żarzą się do obejrzenia.
- Podejście A: osobny moduł obok Księgi wyników. Eksport/import Księgi obejmuje odkrycia (scalanie).

Spec: zatwierdzony kierunkowo w burzy mózgów 2026-10-12. Kolejny krok: plan implementacji (`superpowers:writing-plans`).


## Katalog

- **Pieczęcie:** 5 (`GLIFY` w `js/glify.js`).
- **Techniki:** unikalne `id` z `KOMBOSY` **bez wpisów `wariant: true`**, czyli 16. Dwójki (sekwencja długości 2)
  dają 10 pozycji („Gesty"), trójki 6 („Zjawiska"), zgodnie z drabiną poziomów.
- **Węzły Mocy:** klucze `REAKCJE` z `js/punkty.js`, czyli 13.
- Katalog jest **wyliczany** z rejestrów, nie wpisywany ręcznie. Nowa technika lub reakcja bez emblematu
  i opisu = czerwony test.

## Moduły

**`js/odkrycia.js`: `class Odkrycia`** (czysta logika, pamięć wstrzykiwana, wzorzec `Ksiega`)
- Klucz `krolSzamanow.odkrycia.v1`, `try/catch`, flaga `trwala`, walidacja każdego pola przy odczycie
  (znane id, skończone liczby, limity), zepsuty JSON = start od zera.
- Stan: `pieczecie{id:{n,t}}`, `techniki{id:{n,t}}`, `wezly{id:{n,t}}`, `kamienie{id:{t}}`,
  `liczniki` (rundy dokończone, pieśni dokończone [pliki z manifestu], nicki-bogowie), `obejrzane` (Set id).
- Krótka historia zdarzeń na żywo (pieczęcie, techniki, reakcje ze znacznikiem czasu, przycięta do ~60 s)
  służy do mitów.
- API, każde zwraca **listę nowych odblokowań** `[{rodzaj:'technika'|'wezel'|'pieczec'|'kamien', id}]`:
  `pieczec(id, now)`, `technika(kombo, now)` (warianty mapowane na `id`), `reakcja(id, n, now)` (n > 0),
  `koniecRundy(pods, {wynikKsiegi, piesn})`, `nick(nick)` (przez `bogZNicku` z `js/jaja.js`).
  Data (`Date`) jest wstrzykiwana do Godziny Duchów i Nocy Kupały, żeby dało się to testować.
- `postep()` zwraca liczniki do paska („Odkryto 9 z 16 technik…"), `oznaczObejrzane(id)` gasi żar nowości.
- **Zapis tylko przy zmianie:** nowe odblokowanie zapisuje się od razu, a same liczniki `n` na końcu rundy,
  przy Esc → Polana i na `visibilitychange` (`zapiszJesliTrzeba()`).
- `eksportFragment()` / `scal(dane)` dla eksportu/importu Księgi: suma zbiorów, max liczników,
  najwcześniejsze `t`, nigdy nie nadpisuje.
- **Nie trafia do `swiezeModuly.js`.** Pamięć jest trwała między rundami, więc w `main.js` to `const` z komentarzem (strażnik `tools/test-swieze-moduly.mjs` sprawdza tylko klucze `swiezeModuly`, nie skanuje `new`). Historia na żywo dla mitów liczy się w `performance.now()` i przeżywa start rundy; bufor „nowe w tej rundzie" dla Kroniki zeruje się przy starcie rundy.

**Wspólna reguła splecenia.** Z `Punktacja.technika` (`js/punkty.js:197-201`) wydzielić czystą funkcję
nakładania ogonów (`ogonTechniki(historia, kombo)` / `nakladajaSie(...)`). Punkty i Odkrycia używają tej samej
funkcji. Odkrycia trzymają własną historię pieczęci, bo w swobodnym tańcu Punktacja jest nieaktywna.

**`js/osiagniecia.js`: rejestr `KAMIENIE`** (deklaratywny, wzorzec `PRZYDOMKI`)
`{id, nazwa, opis, kategoria:'kolekcja'|'mit'|'kunszt'|'sekret', sekret?:true, kiedy:'zywo'|'runda',
postep?(stan)→{ile,z}, warunek(stan, ctx)}`. Progi są ZGADNIĘTE. Kamienie **nie dają punktów** i **nigdy nie są odbierane**.

| # | Kamień | Warunek | Kiedy |
|---|---|---|---|
| 1 | Pierwsza Iskra | pierwsza odkryta technika | żywo |
| 2 | Pięć Żywiołów | 5/5 pieczęci | żywo, postęp |
| 3 | Mowa Gestów | 10/10 dwójek | żywo, postęp |
| 4 | Władca Zjawisk | 6/6 trójek | żywo, postęp |
| 5 | Tkacz Węzłów | 13/13 węzłów | żywo, postęp |
| 6 | Wszechwiedzący Wołchw | wszystkie techniki + węzły | żywo |
| 7 | Perun kontra Weles | `gromWZiemie`, potem `kolowrot` w ≤ 15 s | żywo |
| 8 | Trójsplot | dwa splecenia pod rząd (3 techniki w jednym łańcuchu) | żywo |
| 9 | Ogień i Woda | `bania`, potem `tecza` w ≤ 15 s | żywo |
| 10 | Burza nad Bagnem | `przewodzenie` i `burzaWMgle` w ≤ 5 s | żywo |
| 11 | Noc Dziadów | `latarnie` i technika `dym` w ≤ 30 s | żywo |
| 12 | Krąg Żywiołów | 5 różnych pieczęci w ≤ 20 s | żywo |
| 13 | Podpalacz Nieba | `momenty.serie.pozoga` ≥ 100 | runda |
| 14 | Król Szamanów | `tytulZaWynik` = Król Szamanów | runda |
| 15 | Pieśniarz | 4/4 pieśni z `utwory.json` dokończone (bez `wlasna:`/`yt:`) | runda, postęp |
| 16 | Wielki Krąg | dokończony Krąg 6 tancerzy | runda |
| 17 | Wszechstronny | ≥ 8 różnych id w `momenty.techniki` | runda |
| 18 | Dziesięć Obrzędów | 10 dokończonych rund | runda, postęp |
| 19 | Rekord Plemienia | `wynikKsiegi.nowyRekord` | runda |
| 20 | Bóg wśród Ludzi | nick-bóg | sekret |
| 21 | Pięciu Bogów | wszystkie 5 nicków-bogów | sekret |
| 22 | Godzina Duchów | odkrycie albo runda między 0:00 a 3:00 czasu lokalnego | sekret |
| 23 | Noc Kupały | taniec w noc 23/24 czerwca | sekret |
| 24 | Kamienny Mur | 3× `kamiennaTarcza` w ≤ 60 s | sekret |

„Runda" = runda dokończona do Kroniki (Esc się nie liczy). W Kręgu kamienie rundy liczą się dla każdego gracza.

**`js/emblematy.js`: rejestr SVG + legenda** (czyste dane, bez DOM)
`EMBLEMATY[id] = {svg: '<path …/>…', legenda: 'jedno zdanie'}` dla 16 technik i 13 węzłów, viewBox 64×64,
jeden styl (linoryt, gruba kreska `currentColor`). Węzeł może składać emblemat z dwóch składowych.
Statyczne, zaufane łańcuchy (nigdy dane gracza).
**Zakaz §7 (GEMINI.md):** żadnych obrotowo symetrycznych figur z zagiętymi lub spiralnymi ramionami (swarzyca/kołowrót)
ani run `ZAKAZANE`. Kołowrót = wrzeciono/żarna, wiry (Kurzawa, Dymny wir, Ognisty wir, Wir ogników) = lej/trąba.
Obowiązkowy przegląd wszystkich emblematów pod tym kątem przed wydaniem.

**`js/odkryciaHud.js`: powiadomienie na żywo** (DOM)
Prawy górny róg (z dala od `ostatniKomunikat` i `wynikHud`): emblemat rozpala się ~2,5 s + „Odkryto: <nazwa>" /
„Kamień Pamięci: <nazwa>". Kolejka, ukryte gdy `body.w-menu`, `prefers-reduced-motion` bez animacji.

## UI Księgi (`js/polanaUi.js`, `index.html`, `style.css`)

- Zakładki: **Wyniki** (dzisiejszy widok) · **Zwój Technik** · **Węzły Mocy** · **Kamienie Pamięci**.
  Nad nimi rząd 5 run pieczęci żarzących się wraz z odkryciami i napis „Odkryto 9 z 16 technik · 4 z 13 węzłów ·
  7 z 24 kamieni" (tylko zdobycze, §2).
- **Karta techniki** (siatka; rzędy „Gesty" i „Zjawiska"):
  - nieodkryta: nazwa w przygaszonej kości, emblemat jako zwęglona sylwetka z tlącą się krawędzią (filtr SVG,
    wolne „oddychanie"), **bez** sekwencji, run i podpowiedzi;
  - odkryta: emblemat rysuje się złotą kreską (`stroke-dashoffset`, raz) + runy sekwencji (`glif`), liczba użyć, data;
  - nowa (nieobejrzana): puls żaru + iskra, gaśnie po otwarciu.
  - Enter/klik otwiera kartę szczegółu (duży emblemat, legenda, sekwencja, użycia, data). Nieodkryta pokazuje tylko nazwę i sylwetkę.
- **Węzły Mocy:** dwa emblematy składowe splecione nicią, zwęglone do odkrycia.
- **Kamienie Pamięci:** kamienie z runą; zdobyty się żarzy, niezdobyty jest szary z nazwą i opisem,
  postęp jako nacięcia („3 z 5"); sekret niezdobyty = pęknięty kamień „Sekret plemienia" bez opisu.
- Klawiatura: strzałki po siatce, Enter, Esc (szczegół → siatka → Polana). Tekst wyłącznie przez `textContent`.
  `prefers-reduced-motion`. Paleta/kroje z `style.css`. Dopracowanie skillem `frontend-design`.
- „Wyczyść Księgę" czyści **tylko wyniki**, nigdy odkryć (osobna, dwukrokowa akcja nie wchodzi do zakresu).

## Kronika (`js/kronika.js`, `zbudujKronike`)

Nowe pole `noweWKsiedze: [{rodzaj, id, nazwa}]` (maks. 4 + „i jeszcze N"), renderowane z emblematami.
Źródło: odblokowania zebrane od początku rundy + z `koniecRundy`.

## Zmiany w istniejącym kodzie

- `js/main.js`: `const odkrycia = new Odkrycia(localStorage)`. Wywołania obok `punkty.pieczec`/`technika`
  (`main.js:~810-816`) i obok `punkty.reakcja(...)` (`~947-950`, `~1033-1041`, te same surowe liczby),
  **bramkowane tylko `menu.graAktywna`**, nie `punkty.aktywna` (swobodny taniec ma liczyć). Wynik → `odkryciaHud`
  + bufor rundy dla Kroniki. W `pokazKronike` (`~592`) `odkrycia.koniecRundy(...)` i nick; zapis przy Esc
  i `visibilitychange`.
- `js/punkty.js`: wydzielenie funkcji nakładania ogonów (bez zmiany zachowania; `test-punkty.mjs` zostaje zielony).
- `js/ksiega.js`/`polanaUi.js`: eksport `{wersja:1, tablice, odkrycia}`, import przekazuje `odkrycia` do `scal`
  (walidacja, limit rozmiaru bez zmian).
- `GEMINI.md`: tabela plików, §7 (strojenie progów kamieni).

## Testy (node, `tools/`)

- `test-odkrycia.mjs`: odkrycie techniki (z wariantem Tęczy → `tecza`), węzła, pieczęci; zwraca tylko NOWE;
  zapis tylko przy zmianie (atrapa pamięci liczy `setItem`); pamięć rzucająca / zepsuty JSON / złe pola;
  `scal` bez nadpisania; `postep`; `obejrzane`.
- `test-osiagniecia.mjs`: każdy kamień na progu i tuż pod nim (okna czasowe, Trójsplot przez wspólną funkcję splecenia,
  Godzina Duchów / Kupała z wstrzykniętą datą, Pieśniarz ignoruje `wlasna:`/`yt:`, Esc nie liczy rundy);
  **strażnik**: wszystkie id w warunkach istnieją w `KOMBOSY`/`REAKCJE`/`GLIFY`.
- `test-emblematy.mjs`: **strażnik dwustronny**: każda technika (bez wariantów) i każdy klucz `REAKCJE` ma emblemat
  i legendę, a żaden wpis nie wisi bez techniki; brak run `ZAKAZANE`; SVG bez `<script>`/`on*=`.
- `test-kronika.mjs`: pole `noweWKsiedze` (limit + „i jeszcze N").
- Istniejące `test-punkty.mjs`, `test-ksiega.mjs` zielone.

## Weryfikacja end-to-end

1. `for f in tools/test-*.mjs; do node "$f"; done`: wszystko zielone.
2. Serwer statyczny + headless Chrome (menu nie wymaga kamery): zrzuty czterech zakładek Księgi z pustą
   i z wstrzykniętą (`localStorage`) częściową kolekcją; karta szczegółu; sekret zdobyty i niezdobyty; telefon/wąskie okno.
3. Przegląd emblematów pod §7 (zakaz swarzycy/kołowrotu).
4. Test na żywym ciele u właściciela: odkrycie w swobodnym tańcu → znak w rogu; runda → „Nowe w Księdze" w Kronice;
   wejście do Księgi → żar nowości gaśnie po obejrzeniu; przeładowanie strony → kolekcja zostaje.

## Poza zakresem

Kolekcja per nick; nagrody/punkty za kamienie; miniatury efektów na żywo; osobne czyszczenie odkryć;
synchronizacja online.

## Ryzyka

- **Progi kamieni** zgadnięte (jak cała arcade).
- **29 emblematów SVG** to najwięcej pracy i największe ryzyko §7, stąd obowiązkowy przegląd.
- Odkrycia ognia/powietrza zależą od słabego rozpoznawania tych pieczęci (znana blokada), więc część kart
  może długo zostać zwęglona. To zgodne z §2 (nic nie mówi „źle"), ale warto o tym wiedzieć przy ocenie.
