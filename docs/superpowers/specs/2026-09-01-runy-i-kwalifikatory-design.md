# Cztery żywioły: runy kreślone w powietrzu + zachowana piramidka

## Context

Pieczęcie składane palcami nie dają się pewnie wykryć. To nie jest wada progów
ani modelu — to **brak informacji w sygnale**. Rdzeń prawdziwych pieczęci to
przeplot palców, a jednooczne RGB nie widzi palca schowanego za palcem.
Dowody są w tym repo:

- **Weles** (0 palców, dwie pięści rozsunięte, czysta sylwetka) — działa do dziś.
- **Szczur** — odpięty po porażce na żywo, *nawet po* przeprojektowaniu pod czytelność.
- **Perun** — autentyczny Tygrys nie przechodzi; komentarz w `perunDlon.js:47`
  sam mówi, że MediaPipe *zgaduje* zwinięte palce jako częściowo wyprostowane.
- Zasada założycielska spec-a z 2026-08-07 brzmi „czytamy sylwetkę, nie przeplot".

Research zamknął też ścieżkę sprzętową. Platforma to **laptop studenta na
warsztatach** (GEMINI.md §1), więc odpadają: Azure Kinect + Body Tracking SDK
(sprzęt wygaszony X 2023, SDK zdeprecjonowany, wymaga aplikacji natywnej i GPU
NVIDIA), MSR Handpose (badania z 2015 na kamerze głębi, nigdy nie było SDK),
MRTK3 (wymaga gogli), Leap Motion Controller 2 (USB, jedno stanowisko).
ONNX Runtime Web jest realny, ale to *runtime*, nie tracker — modele klasy
WiLoR/HaMeR nie zmieszczą się obok pozy i maski w budżecie ~14 ms.

Głębsza diagnoza, potwierdzona przez właściciela projektu: palcowe origami jest
z natury **egzaminem na precyzję**, co stoi w sprzeczności z GEMINI.md §2
i z celem emocjonalnym (rozluźniony taniec). Trudność z wykrywaniem była objawem,
nie chorobą.

**Zamiana:** znak przestaje być układem palców, a staje się **kształtem kreślonym
nadgarstkiem w powietrzu**, kwalifikowanym przez **stan dłoni** (pięść albo
otwarta). Trajektoria nadgarstka to najpewniejszy sygnał, jaki daje ta kamera;
liczba wyprostowanych palców to jedyna oś geometrii dłoni, która w tym projekcie
nigdy nie zawiodła.

**Wyjątek zachowany świadomie: piramidka Swaroga.** Jedyna pieczęć dłoniowa,
która działała pewnie — i jedyna, której kształt **sam wymusza** rozsunięcie
nadgarstków, czyli prześwit, bez którego MediaPipe gubi dłoń. Zostaje bez jednej
linijki zmiany i niesie żywioł ognia, domykając komplet czterech żywiołów.
Wyrzucamy to, co nie działa, nie wszystko, co jest z palców.

**To nie jest przebudowa silnika.** `pieczecie.js`, `kombosy.js`, `efekty.js`,
`znaki/registry.js` i routing `uzbraja` w `main.js` tworzą generyczny silnik
zdarzeń: bierze mapę `{id: 0..1}` i produkuje zdarzenia. Wymieniamy wyłącznie
**źródło wyniku**. Jedyna zmiana w samym silniku (`pieczecie.js`) jest opisana
w kroku 5 i jest wymogiem, nie sprzątaniem.

---

## Słownik: cztery żywioły — trzy kreślone, jeden trzymany

| żywioł | bóstwo | znak | cechy |
|---|---|---|---|
| **woda** | Mokosz (splot losu) | **koło** kreślone | cykliczny — brak kanonicznego punktu startu |
| **błyskawica** | Perun (grom) | **pionowy zygzak** kreślony | odwracalny — w górę i w dół to ta sama runa |
| **wiatr** | Stribog | **pozioma fala** (sinus) kreślona | odwracalny |
| **ogień** | Swaróg (kuźnia) | **piramidka** — `js/znaki/swarogDlon.js`, **bez zmian** | statyczna pieczęć dłoniowa, już zweryfikowana |

Trzy runy × 2 stany dłoni + piramidka = **7 znaków**.

Stan dłoni kwalifikuje aspekt run: **otwarta = dawanie**, **pięść = branie**.
Identyfikatory: `mokosz-otwarta`, `mokosz-piesc`, `perun-otwarta`, …, `swarog`.

**Piramidka zostaje, bo działa — i wiadomo dlaczego.** Namiot z opuszek wymaga
**rozsuniętych nadgarstków**, żeby w ogóle powstał, więc sam kształt pieczęci
wymusza prześwit, którego potrzebuje detektor (`swarogDlon.js:8-13`). To jedyna
pieczęć w tym zestawie, która nie walczy z ograniczeniem kamery, tylko je
wykorzystuje. Plik i jego testy zostają nietknięte.

**Rozdzielność run jest zaprojektowana, nie przypadkowa.** Po normalizacji koło
jest zamknięte i szerokie, zygzak wysoki i wąski, fala szeroka i płaska. Aspekt
(proporcja wysokość/szerokość) sam niemal rozdziela zygzak od fali, a zamknięcie
konturu rozdziela koło od obu.

**Piramidka nie koliduje z runami, i to wynika z mechaniki, nie ze szczęścia.**
Trzymanie piramidki jest bezruchem, więc sufit wieku punktu z decyzji 8 wygasza
ślad i wyniki wszystkich run opadają same. Odwrotnie: kreśląc runę otwartą dłonią
gracz ma dłonie rozdzielone i opuszki daleko od siebie, więc `zbieznoscOpuszek`
zbija piramidkę. Rozdział jest obustronny i nie wymaga ani jednego nowego progu.

---

## Kluczowe decyzje projektowe

**1. Skalowanie JEDNORODNE, nie per-oś.** Naiwny wariant $1 rozciąga kształt do
kwadratu jednostkowego osobno w X i Y. Zrobiłby z pionowego zygzaka i poziomej
fali **ten sam kształt** — czyli skasowałby dokładnie tę cechę, na której stoi
rozdzielność. Skalujemy jednym współczynnikiem (RMS promienia = 1), zachowując
proporcje.

**2. Rotacja NIE jest normalizowana.** Pion i poziom muszą się różnić.

**3. Punkt startu — tak.** Dla szablonów `cykliczny` bierzemy najlepsze
dopasowanie po wszystkich 32 cyklicznych przesunięciach; dla `odwracalny` także
po odwróconej kolejności. Koło narysowane od dowolnego miejsca ma dawać ten sam
wynik.

**4. Kwalifikator dłoni uśrednia się po CAŁYM śladzie**, nie po jednej klatce.
To jest ściśle mocniejsze niż dzisiejszy odczyt jednoklatkowy: pojedyncze złe
klatki trackingu wypłukują się w średniej, zamiast zbijać minimum do zera.

**5. Brak danych o dłoni nie karze** (§2). Trzymamy `pokrycie` = ułamek okna
z ważnym odczytem dłoni. Wynik kwalifikatora to
`pokrycie * wariant + (1 - pokrycie) * 0.7`. Bez dłoni w kadrze obie odmiany
runy dostają 0.7 × kształt — runa dalej się składa, tylko wolniej, a o wybór
odmiany dba lepki argmax z kroku 5 poniżej.

**6. Ślad JEST widoczny.** Świecąca wstęga za nadgarstkiem to nie debug —
to jedyne sprzężenie zwrotne, dzięki któremu kreślenia da się nauczyć.

**7. Runa składa się przez POWTARZANIE, nie przytrzymanie.** Żeby pierścień się
napełnił, trzeba kreślić kształt dalej — dwa, trzy obroty. To pasuje do tańca
i wpina się w `pieczecie.js` bez zmiany mechaniki.

**8. Okno śladu mierzone DŁUGOŚCIĄ DROGI, nie czasem.** To jest decyzja
o interfejsie `slad.js` i trzeba ją podjąć przed napisaniem modułu.

Okno w sekundach robiłoby dwie sprzeczne rzeczy naraz: „ile śladu dopasowujemy"
i „jak długo trzeba kreślić". Przy oknie 2,5 s tancerz kreślący jedno koło przez
3 s ma w buforze **kawałek łuku** i wynik nigdy nie szczytuje; tancerz kreślący
koło w 0,6 s ma w buforze **cztery koła** — też nie jedno. Runa byłaby osiągalna
tylko w wąskim, nienazwanym paśmie tempa, a to jest dokładnie ta ukryta kara,
której zabrania §2: wolny tancerz nie robi nic źle.

Bufor trzyma więc **ostatnie N metrów drogi** (w jednostkach worldLandmarks),
a nie ostatnie N sekund. Tempo wypada z równania.

Do tego **sufit wieku punktu** (~4 s): bez niego gracz, który przestał się
ruszać, ma zamrożony bufor z ostatnim kształtem i wynik zostaje wysoki
w nieskończoność. Stanie w miejscu ma wygaszać ślad, nie utrwalać go.

**9. Trafienie CZYŚCI ślad.** Po złożeniu runy `pieczecie.js` zeruje pierścień
i zwalnia cel — ale bufor **nadal trzyma ten sam kształt**, więc wynik zostaje
wysoki i pierścień natychmiast zaczyna napełniać się tą samą runą. Dla
przytrzymanej pięści to zachowanie jest celowe (`kombosy.js` opisuje łańcuchy
przez powtórzenie). Dla kreślonego kształtu jest błędem: jedno koło ma dać jedną
pieczęć, nie dwie. `slad.js` dostaje `wyczysc()`, wołane w `main.js` w gałęzi
`skl.zlozona`.

---

## Pliki

### Nowe

| Plik | Odpowiedzialność |
|---|---|
| `js/runy/slad.js` | bufor pozycji nadgarstków + stanu dłoni; okno liczone **długością drogi** (+ sufit wieku), `wyczysc()` po trafieniu |
| `js/runy/ksztalt.js` | czysta matematyka: resampling, normalizacja, podobieństwo → 0..1 |
| `js/runy/szablony.js` | trzy szablony **nagrane z żywego ciała** (patrz Krok 0) + flagi `cykliczny`/`odwracalny` |
| `js/runy/definicje.js` | sześć obiektów `znak` dla `ZnakRegistry` — `score()` i `skladniki()`; piramidka dochodzi z `znaki/swarogDlon.js` bez pośrednictwa |
| `js/runy/rysujSlad.js` | świecąca wstęga za kreślącym nadgarstkiem |
| `tools/test-runy.mjs` | rozdzielność, ciągłość, niezmienniczości, odporność na NaN |

`ksztalt.js` musi powstać przed `definicje.js` — inaczej normalizacja rozjedzie
się na sześć kopii. Ten sam powód, dla którego istnieją `postawa.js` i `dlon.js`.

### Modyfikowane

- **`js/pieczecie.js`** — dwie zmiany temporalne, obie **wymagane** (patrz niżej).
- **`js/kombosy.js`** — sekwencje pod nowe identyfikatory.
- **`js/efekty.js`** — sześć nowych wierszy w `TABELA`; wiersz `swarog` zostaje.
- **`js/main.js`** — rejestracja sześciu run **obok** zachowanej piramidki;
  karmienie `slad` co klatkę; rysowanie wstęgi.
- **`js/debugHud.js`** — na żywo: wynik kształtu i kwalifikatora osobno dla
  lidera, długość śladu, `pokrycie` dłoni. **Bez tego nie da się wystroić
  progów** — precedens: `PROG_SZARPNIECIA`, `PROG_POSTAWY`, progi wszystkich
  pieczęci; każdy zgadnięty i każdy strojony z ekranu.
- **`tools/test-pieczecie.mjs`** — pokrycie zmiany temporalnej.
- **`GEMINI.md`** — §3 (architektura), §4 (nowe pułapki), §7 (dalszy rozwój).

### Zostają wpięte, nietknięte

- **`js/znaki/swarogDlon.js`** — piramidka, żywioł ognia. Zero zmian w pliku
  i w `tools/test-pieczecie-dloni.mjs`. Działa; nie ruszamy.
- **`js/znaki/dlon.js`** — `zwinieta()`, `wzorPalcow()`, `ileWyprostowanych()`
  i `pelnaDlon()` są rdzeniem kwalifikatora run, a `zbieznoscOpuszek()`
  i `odlegloscNadgarstkow()` obsługują piramidkę. Sprawdzony kod Welesa żyje
  dalej, tylko w innej roli.
- **`js/handTracker.js`** — potrzebny i piramidce, i kwalifikatorowi.

### Odpięte, nie usunięte

`js/znaki/welesDlon.js`, `perunDlon.js`, `szczurDlon.js`, `mokoszSplot.js` —
zgodnie z konwencją projektu zostają na dysku wraz z testami.

---

## Zmiana w `pieczecie.js` (wymagana, nie sprzątanie)

Obie usterki są ortogonalne do run i prawdopodobnie odpowiadają za realną część
dzisiejszego „nie łapie".

**Zanik zamiast zerowania.** `update()` ustawia dziś `this.postep = 0`, gdy wynik
spadnie poniżej progu — jedna drgnięta klatka kasuje 2 s trzymania. Dla run to
jest zabójcze **z definicji**: wynik kształtu naturalnie dołkuje w chwili
zamykania koła i zaczynania następnego, bo bufor zawiera wtedy 1,5 koła.
Zamiast tego `postep -= dt / CZAS_ZANIKU` (~1,5 s do zera).

**Lepki argmax.** Nowy lider przejmuje pierścień dopiero gdy przebije obecnego
o margines (~0.12) i utrzyma przewagę ~0,25 s. To **uogólnia** hack preferencji
Splotu w `_najlepszy()` (`pieczecie.js:110-133`), który powstał dokładnie
dlatego, że pierścień migał między liderami i nic się nie składało. Hack znika,
zastąpiony regułą ogólną.

Dwa szczegóły przesądzają, czy to zadziała, i oba trzeba zapisać wprost:
margines liczy się na **różnicy bezwzględnej** wyników, a **remis wygrywa
urzędujący** — nigdy kolejność `Object.keys()`. Bez tego drugiego przy
`pokrycie ≈ 0` obie odmiany runy mają wynik **dokładnie równy** (patrz decyzja 5)
i lider skacze przy najmniejszym drgnięciu. To ta sama klasa błędu, którą
zaklejał hack Splotu.

---

## Kombosy (propozycja, strojona później)

| technika | sekwencja | uzbraja |
|---|---|---|
| Grom w Ogniu | `swarog` → `perun-otwarta` | `ogien` |
| Zew Podziemia | `mokosz-piesc` ×2 | `ogien` |
| Podmuch Striboga | `stribog-otwarta` ×2 | `aard` |
| Wstęga Mokoszy | `mokosz-otwarta` ×3 | `tecza` |

Grom w Ogniu wraca do swojego **pierwotnego** znaczenia z `kombosy.js`
(„Swaróg → Perun: ogień, potem piorun") — piramidka zostaje, więc sekwencja
znów mówi to, co jej nazwa. Zbieranie w pięść i wypuszczenie otwartą dłonią
czyta się jako rytuał, a nie jako lista wejść.

---

## Wydajność

Na klatkę: 2 normalizacje śladu (po jednej na nadgarstek, 32 punkty) i 6
porównań z szablonami, z czego cykliczne przesunięcia tylko dla koła. Rząd
wielkości poniżej 1 ms — nie rusza budżetu z GEMINI.md §5. Detekcja dłoni
zostaje bez zmian (~8 ms, już zmierzone).

---

## Weryfikacja

### Bez kamery — `sh tools/test-wszystko.sh`

Wszystkie istniejące testy muszą dalej przechodzić. Nowe w `tools/test-runy.mjs`:

1. **Rozdzielność** — każdy z trzech kształtów zapala swój szablon i nie zapala
   dwóch pozostałych. Wszystkie trzy pary.
2. **Aspekt przeżywa normalizację** — pionowy zygzak podany jako poziomy
   (transponowany) **nie** dopasowuje się do siebie. To jest test na pułapkę
   skalowania per-oś; bez niego regresja przechodzi niezauważona.
3. **Ciągłość** (§2) — koło kreślone niedbale daje wynik pośredni, nie zero.
   Stopniowe psucie kształtu daje monotoniczny spadek, nie próg.
4. **Niezmienniczość skali i położenia** — duże koło z lewej == małe ze środka.
4a. **Niezmienniczość TEMPA** — ten sam kształt podany z prędkością 0,5× / 1× / 3×
   daje ten sam wynik. Test 4 tego nie złapie, bo jest statyczny; to jedyny test
   na decyzję 8 i bez niego regresja do okna czasowego przechodzi niezauważona.
5. **Niezmienniczość punktu startu** — koło zaczęte w dowolnym miejscu daje ten
   sam wynik. Zygzak narysowany od dołu == od góry.
6. **Kwalifikator** — ten sam ślad z zaciśniętą dłonią wygrywa wariant `piesc`,
   z otwartą wariant `otwarta`; przy `pokrycie = 0` oba dostają 0.7 × kształt,
   a lider **nie zmienia się** mimo dokładnego remisu (patrz reguła remisu wyżej).
7. **Odporność** — brak pozy, brak dłoni, klatka z NaN, ślad krótszy niż okno:
   zero albo wartość neutralna, nigdy wyjątek i nigdy NaN.
7a. **Trafienie czyści ślad** — jedno przejście kształtu produkuje **jedną**
   pieczęć, nie dwie pod rząd (decyzja 9).
7b. **Piramidka a runy — rozdział obustronny.** Klatki z piramidką i bez ruchu
   nie zapalają żadnej runy (ślad wygasa wiekiem), a ślad kreślony otwartą
   dłonią nie zapala piramidki (opuszki rozdzielone). Wszystkie istniejące
   asercje z `tools/test-pieczecie-dloni.mjs` muszą dalej przechodzić bez
   zmiany — jeśli któraś wymaga edycji, to znak, że ruszyliśmy działający kod.

Rozszerzenie `tools/test-pieczecie.mjs`:

8. **Zanik zamiast zerowania** — jedna klatka poniżej progu obniża `postep`
   proporcjonalnie do `dt`, nie zeruje go.
9. **Lepki argmax** — rywal wyprzedzający lidera o mniej niż margines nie
   przejmuje pierścienia; wyprzedzający wyraźnie i trwale — przejmuje.

### Na żywym ciele — `http://localhost:8000`, klawisz `D`

Progi szablonów są **zgadnięte** i to jest jedyny sposób ich wystrojenia.
Uwaga z GEMINI.md §6: Chrome cache'uje moduły ES — przeładowywać twardo.

10. **FPS ≥ 24** z ciałem, maską i dwiema dłońmi w kadrze.
11. **Każda z sześciu run dobija do progu** — podać wynik kształtu i
    kwalifikatora osobno z nakładki. **Piramidka dalej dobija tak jak dziś** —
    jeśli jej wynik spadł, przyczyną jest coś, co wprowadziliśmy.
12. **Wstęga za nadgarstkiem jest widoczna i czytelna** — bez niej kreślenia
    nie da się nauczyć.
13. **Ślad przeżywa przejście między obrotami** — pierścień rośnie przez dwa-trzy
    koła pod rząd, a nie resetuje się przy każdym zamknięciu. To jest test
    zmiany temporalnej na żywo.
14. **Kombos odpala technikę**, a efekt jest widoczny przy dłoniach.
15. **Reguła §2** — poniżej progu cisza, żaden komunikat o porażce, nieudana
    runa nie kosztuje mocy, wyjście z kadru nie karze.

---

## Zmierzone ograniczenie: Wstęga Mokoszy (x3) przy bardzo wolnym tempie

Symulacja headless (aktualizujSlady -> znaki.ocen -> skladanie.update ->
kombosy.dodaj, koło otwartą dłonią, moc zawsze pełna) potwierdza, że
`mokosz-otwarta x3` odpala się niezawodnie przy tempie szybkim do
umiarkowanie wolnego (promień 0.15-0.2 m, 1-2.5 s/okrążenie), ale **nigdy**
przy bardzo wolnym i szerokim kreśleniu (promień 0.22 m, 3.5 s/okrążenie) -
każda pieczęć osobno się składa i kosztuje moc, ale trzy nigdy nie mieszczą
się w `OKNO_MS = 6500` z `kombosy.js`. To ten sam cichy tryb awarii, który
`kombosy.js` już raz opisał przy Splocie (okno podniesione z 4000 na 6500).

**Decyzja właściciela projektu: zostawić jako znane ograniczenie**, nie
naprawiać teraz. Trafia do listy „do zmierzenia na żywym ciele" w sekcji
Weryfikacja - dopiero tam okaże się, czy realni tancerze w ogóle kreślą tak
wolno i szeroko, żeby to miało znaczenie. Jeśli tak, dwie gotowe naprawy to:
poszerzenie `OKNO_MS` (ten sam ruch co przy Splocie) albo zmniejszenie
Wstęgi do x2 (kosztem wyższego progu wejścia, który miał odróżniać ją od
Ognia/Aard).

## Krok 0

**a. Spec.** Przepisać ten projekt do
`docs/superpowers/specs/2026-09-01-runy-i-kwalifikatory-design.md` i zacommitować,
zgodnie z konwencją `docs/superpowers/specs/` w tym repo. To transkrypcja
zatwierdzonego planu, nie nowy projekt.

**b. Szablony nagrać, nie wpisać.** To najbardziej ryzykowna linia całego planu.
Koło wpisane z palca jest trywialnie poprawne, ale „pionowy zygzak" i „pozioma
fala" wpisane ręcznie kodują **zgadniętą** amplitudę, okres i liczbę oscylacji,
a żywe ramię ich nie odtworzy. Precedens tego repo jest jednoznaczny: każda
stała oznaczona ZGADNIĘTE musiała zostać odczytana z nakładki.

Kolejność: `slad.js` + `ksztalt.js` + klawisz w `debugHud.js`, który zrzuca
znormalizowany ślad do konsoli → nagrać po kilka przejść każdego kształtu na
żywym ciele → wybrany przebieg trafia do `szablony.js` jako szablon.
Dopiero wtedy `definicje.js`. Inaczej ryzyko wychodzi dopiero w punkcie 11
weryfikacji, po napisaniu wszystkiego.

## Poza zakresem

- Runy kreślone **obiema** rękami symetrycznie (wynik to na razie maksimum po
  nadgarstkach).
- Kwalifikator stanu dłoni dla piramidki — jest z natury układem
  dziesięciopalcowym, więc nie ma odmiany „w pięść".
- Piąty żywioł / kolejne kształty — dopiero po potwierdzeniu czwórki na żywo.
- Powrót postaw ciała jako trybu alternatywnego dla kamery zewnętrznej.

---

## Dopisek implementacyjny: układ współrzędnych śladu

Ślad nadgarstka **nie** może być liczony z `frame.hands[].landmarks` (2D, do
rysowania - zniekształcone przez cover-fit i odległość od kamery) ani z
`frame.hands[].worldLandmarks` (metryczne, ale **względem środka dłoni** - nie
kodują przemieszczenia dłoni w przestrzeni, tylko jej kształt; nadgarstek
prawie się tam nie rusza z definicji).

Właściwe źródło to **`frame.pose.worldLandmarks[15]` / `[16]`** (nadgarstek L/P) -
metryczne, względem środka bioder, więc kreślenie kształtu przed piersią jest
ruchem WZGLĘDEM TUŁOWIA i faktycznie się w nich rejestruje (dokładnie tak samo
jak `plynnosc.js` i `motionMeter.js` już liczą ruch kończyn na tych samych
punktach). Stan dłoni (otwarta/pięść) czytany jest osobno z `frame.hands[]` i
parowany po `handedness` z odpowiednim nadgarstkiem pozy.

Aktualizacja bufora śladu dzieje się **raz na klatkę**, w `main.js`, PRZED
`znaki.ocen(frame)` - nie wewnątrz `score()` żadnego znaku. Sześć znaków-run
dzieli dwa bufory (lewy/prawy nadgarstek); gdyby aktualizacja działa się w
`score()`, każdy z sześciu odczytów dopisywałby ten sam punkt do bufora
osobno.
