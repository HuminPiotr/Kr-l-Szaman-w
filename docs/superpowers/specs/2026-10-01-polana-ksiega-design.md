# Menu „Polana", Kronika obrzędu i Księga Plemienia (podprojekt 3 z 3 „arcade")

## Kontekst

Podprojekt 1 dał punkty, podprojekt 2 rundy i modyfikatory — ale wejście do trybu to dziś
parametry w adresie (`?tryb=obrzed&piesn=1`), a koniec rundy pokazuje tymczasowy baner. Ten
podprojekt zamienia to w grę, którą da się obsłużyć bez dotykania paska adresu: **menu
wyboru trybu, Kronikę po rundzie i Księgę z najlepszymi wynikami (nick + punkty)**.

Decyzje z burzy mózgów (2026-10-01, plus uzupełnienia z dzisiejszego testu na żywo):
- Klimat **„Polana"**: ognisko, wokół kamienie z runami — każdy kamień to tryb.
- Sterowanie **mysz + klawiatura** (nick trzeba wpisać; gracz i tak stoi przy komputerze przy wyborze).
- Rekordy **lokalnie** (`localStorage`), osobna tablica per tryb i wariant, top 10; eksport/import JSON.
- „Z pomysłem, jajem i w klimacie" (słowa właściciela) — stąd tytuły, przydomki, koronacja i jaja z nickami-bogami.
- **Zmiana względem podprojektu 2:** Esc w rundzie wraca do **Polany**, nie do trybu swobodnego.
  Swobodny taniec jest teraz jednym z kamieni. `?tryb=` z adresu zostaje jako skrót deweloperski
  (pomija menu).
- §2 obowiązuje: ton jest ciepły, nikt nie jest oceniany. Najgorszy tytuł to „Kłoda — każde ognisko
  zaczyna się od kłody", nie wyrok.

## Przepływ ekranów

```
Polana ──kamień trybu──▶ Konfiguracja ──„Rozpal ogień"──▶ [kamera: tylko za 1. razem] ──▶ Runda
  ▲  ╲                                                                                      │
  ▲   ╲──Księga Plemienia (przeglądanie, eksport/import)                                    ▼
  └───────────── „Do Polany" ◀───────────── Kronika obrzędu ◀──────────────────── koniec rundy
                                                 │  „Jeszcze raz" (ta sama konfiguracja)
                                                 └──▶ Runda
```

- **Polana** (ekran startowy): 4 kamienie — **Obrzęd** (pieśń), **Próba** (na czas), **Swobodny taniec**,
  **Księga Plemienia**. Pierwszy ekran gry **nie wymaga kamery** (menu pojawia się przed zgodą
  przeglądarki, jak dzisiejszy ekran startowy).
- **Konfiguracja** (po wyborze kamienia): zależnie od trybu — wybór pieśni z manifestu (tytuł, długość)
  albo długości próby (60/90/120 s); przełączniki **Zew żywiołów** i **Krąg**; pole nicku (solo) albo
  lista 2–6 nicków (Krąg). „Rozpal ogień" jest nieaktywny, dopóki konfiguracja jest niepoprawna,
  z ciepłym komunikatem (np. „Dopisz jeszcze jednego tancerza"), nie czerwonym błędem.
- **Pierwsze uruchomienie:** „Rozpal ogień" uruchamia kamerę i modele (dzisiejszy handler startu),
  potem rundę. **Kolejne:** kamera już działa, więc menu leży na **przyciemnionym, żywym obrazie
  z kamery** (gracz widzi siebie przy ognisku) — pętla gry i tracking działają dalej, ale pieczęcie
  i punkty są wyłączone (`przebieg === null`, `punkty.aktywna = false`).
- **Kronika obrzędu:** po `koniecRundy` (zastępuje tymczasowy baner z podprojektu 2).
- **Esc:** w rundzie → Polana (bez zapisu); w konfiguracji/Księdze → krok wstecz; na Polanie nic.
- **Enter** na Kronice: „Jeszcze raz" (a w Kręgu: następny gracz, jak dziś).

## Moduły

### `js/menu.js` — model menu (czysta logika)

`class Menu` — stan ekranu i wyborów, **bez DOM**: ekran ∈ `polana|konfig|ksiega|gra|kronika`,
`wybierz(kamien)`, `wstecz()`, `ustaw(pole, wartosc)`, `konfiguracja() → konfig | null`, `bledy[]`,
`dostepne` (które kamienie/opcje są dostępne). `konfiguracja()` zwraca **dokładnie ten kształt,
który zwraca `parsujKonfiguracje`** (`{tryb, dlugoscS, piesn, zew, krag}`) plus `nick` — jedna
ścieżka wejścia do gry, menu i adres prowadzą do tej samej `uruchomZKonfiguracji`.
Reguły: Obrzęd niedostępny, gdy manifest pusty (kamień przygaszony z podpowiedzią „Duchy jeszcze nie
przyniosły pieśni"); Krąg 2–6 nicków, każdy 1–16 znaków po przycięciu; nick solo 1–16 znaków,
domyślnie ostatni użyty.

### `js/ksiega.js` — Księga Plemienia (czysta logika, pamięć wstrzykiwana)

- Tablice po **kluczu**: `obrzed:<plik>`, `proba:<sekundy>`, z sufiksem `+zew` dla rund ze Zewem
  (Zew podwaja punkty, więc wyniki z nim **nie mieszają się** z wynikami bez niego).
- Wpis: `{ nick, wynik, t }` (`t` = data jako liczba ms; użytkownik jej nie edytuje).
- `dodaj(klucz, nick, wynik, t) → { miejsce, nowyRekord, pierwszyWpis }` — top **10**, sortowanie
  malejąco po wyniku, remis: starszy wpis wyżej. **Nowy rekord** = pobicie dotychczasowego
  najlepszego (pierwszy wpis w pustej tablicy to „Pierwszy zapis", bez koronacji — inaczej każdy
  pierwszy gracz byłby koronowany).
- Zapis w `localStorage` pod `krolSzamanow.ksiega.v1` w `try/catch`; **brak pamięci nie jest błędem**
  (tryb prywatny, zablokowane dane): Księga działa wtedy do zamknięcia karty i menu mówi o tym
  jednym zdaniem. Przy odczycie **każdy wpis jest walidowany** (skończony nieujemny wynik, nick
  1–16 znaków, skończone `t`); uszkodzone wpisy odpadają, reszta zostaje; limity: 10 wpisów na
  tablicę, 64 tablice.
- **Eksport:** pobranie `ksiega-plemienia.json` (akcja użytkownika). **Import:** wybór pliku, plik
  ≤ 256 KB, walidacja jak przy odczycie, **scalenie** z istniejącą Księgą (suma i top 10 per tablica),
  nigdy nadpisanie. Zły plik = ciepły komunikat i brak zmian.
- **Wyczyść Księgę:** schowane w „Więcej…" na ekranie Księgi, dwukrokowe (przycisk → „Na pewno? To
  usunie wszystkie wyniki" → drugi przycisk), bez `window.confirm` (blokuje pętlę gry).
- Nick pamiętany osobno (`krolSzamanow.nick`) do wstępnego wypełnienia pola.

### `js/kronika.js` — Kronika obrzędu (czysta logika)

Z podsumowania rundy (`Przebieg.zapiszWynik`) buduje teksty:
- **Rozbicie punktów** (taniec / pieczęcie / techniki / reakcje) i **największy moment**
  (np. „Największa Pożoga: 47 kłębów").
- **Tytuł za wynik**, liczony z **punktów na minutę** (rundy mają różną długość: próba 60 s i pieśń
  4:23 nie mogą mierzyć się tą samą liczbą): Kłoda → Uczeń Ogniska → Szeptucha → Żerca → Wołchw →
  **Król Szamanów**. Progi (pkt/min): `<150, <400, <800, <1300, <2000, ≥2000` — **zgadnięte**, do
  strojenia na żywym ciele. Zdania towarzyszące są ciepłe, np. Kłoda: „każde ognisko zaczyna się od kłody".
- **Przydomki z jajem** — rejestr reguł `PRZYDOMKI` (nowa technika/reakcja = nowy wpis), na start:
  *Podpalacz Chmur* (seria Pożogi ≥ 40 kłębów), *Wiatrodmuch* (seria Rozwiania ≥ 40), *Tancerz Czystego
  Ruchu* (taniec ≥ 60% wyniku), *Pan Pierunów* (≥ 3 Gromy w Ogniu/w Ziemię), *Splatacz* (≥ 3 splecenia).
  Pokazywane są **maks. 2**, w kolejności rejestru; brak pasujących = brak przydomka (nie „brak").
  Test-strażnik: każda reguła odwołuje się do istniejących pól (`KOMBOSY`, `REAKCJE`, `momenty`).
- Dla Kręgu: Kronika każdego gracza, na końcu **podium**.

### `js/jaja.js` — nick-bóg

`bogZNicku(nick) → 'perun'|'swarog'|'stribog'|'mokosz'|'weles'|null`, odporne na wielkość liter
i polskie znaki („Swaróg" = „swarog"). `odpalJajo(bog, frame, W, H, s)` w `js/techniki.js`
(**ten sam worek zależności co `odpalTechnike`**) odpala bezpieczny, krótki efekt na ekranie Kroniki:
Perun → piorun (`piorun.uderz` + `ekran.uderz` + grzmot), Swaróg → zapłon sylwetki w barwie ognia,
Stribog → podmuch (`fala.wystrzel`), Mokosz → tęcza (`tecza.aktywuj`), Weles → pęknięcie ziemi
(iskry + fala). **Nie uzbraja** żadnych technik ani nie pobiera mocy. Do tego **koronacja**:
nowy rekord Księgi → złoty zapłon sylwetki (`zaplon.zapal([255, 200, 80])`) i napis „Nowy rekord
Plemienia".

### `js/imiona.js` — losowe szamańskie imię (🎲)

Przycisk 🎲 przy polu nicku losuje np. „Osmalony Borsuk". Przymiotnik **zgadza się rodzajowo**
z rzeczownikiem (dwie listy par: męski/żeński). **Każda kombinacja ma ≤ 16 znaków** (limit nicku) —
test wylicza je wszystkie.

### `js/polanaUi.js` — warstwa DOM

Renderuje ekrany z modelu `Menu`, nie zawiera logiki. Tekst wyłącznie przez `textContent` (nick
gracza trafia do DOM!). Nawigacja klawiaturą (Tab/strzałki/Enter/Esc), widoczny fokus,
`prefers-reduced-motion`. Budowa wizualna przy użyciu skilla **`frontend-design`** (charakter, nie
szablon): paleta z `style.css` (`--wegiel`, `--zar`, `--plomien`, `--zloto`, `--kosc`), kroje
**Bona Nova** (tytuły i tekst) i **Noto Sans Runic** (runy), kamienie z wyrytą runą rozżarzającą się
przy najechaniu, iskry z ogniska w CSS (bez płótna), brzozowa kora dla Księgi.

## Zmiany w istniejącym kodzie

- `js/main.js`: handler startu rozbity na `uruchomGre()` (kamera + modele, **raz**; strażnik z podprojektu 2
  zostaje) i start rundy z konfiguracji menu; po Kronice/Esc → Polana; stan „w menu" (tracking tak,
  pieczęcie/punkty nie); tło przyciemnione klasą na `body`.
- `js/przebieg.js`: `decyzjaKlawisza` — Esc w rundzie/Kronice zwraca `'polana'` (nie `'zakoncz'` do swobodnego).
- `index.html`, `style.css`: ekrany Polany, Konfiguracji, Księgi, Kroniki; **tymczasowy baner końca z podprojektu 2
  (`#runda-koniec`) znika**, zastąpiony Kroniką.
- `GEMINI.md`: tabela plików, §2 (ton Kroniki), §7.

## Testy

Czyste moduły w node (`tools/test-menu.mjs`, `test-ksiega.mjs`, `test-kronika.mjs`, `test-jaja.mjs`,
`test-imiona.mjs`): przejścia ekranów i walidacja konfiguracji (`konfiguracja()` zgodna z kształtem
`parsujKonfiguracje`), sortowanie/top 10/remisy/`+zew` osobno, uszkodzony JSON w pamięci, pamięć rzucająca
wyjątek, import złośliwego/zbyt dużego pliku, scalenie bez nadpisania, `nowyRekord` vs `pierwszyWpis`,
tytuły na progach (z uwzględnieniem długości rundy), strażnik przydomków, nick-bóg z polskimi znakami,
wszystkie kombinacje imion ≤ 16 znaków. Wizualia: **zrzuty ekranu w headless Chrome** (menu nie wymaga
kamery) oraz test na żywym ciele u właściciela.

## Poza zakresem

Współdzielona tablica online (wymaga backendu — łamie §3); moderacja nicków; rytm/BPM; edycja manifestu
pieśni z poziomu gry; menu obsługiwane gestem.

## Ryzyka

- **Progi tytułów** są zgadnięte (punkty/min zależą od tego, jak gracze faktycznie grają).
- **Menu na żywym obrazie z kamery** zakłada, że tracking po rundzie działa nieprzerwanie (dziś tak jest);
  pierwsze menu jest przed kamerą, więc tło tam jest statyczne.
- **Zrzuty ekranu** sprawdzą układ, nie „czucie" — ocenę wizualną i tak zrobi właściciel.
- **Import** to jedyne miejsce, gdzie do gry wchodzi cudzy plik — stąd twarda walidacja i limity.
