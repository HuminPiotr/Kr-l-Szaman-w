# Pięć pieczęci styku: żywioły czytane z dotyku ciała, progi wyprowadzone z nagrań

## Context

To jest **piąta** generacja znaków w tym projekcie. Cztery poprzednie —
pieczęcie palcowe, przeprojektowany Szczur, postawy ciała, runy kreślone
w powietrzu — miały jedną wspólną cechę, i nie było nią to, jakie gesty
wybrano. Każda z nich weszła do gry ze stałymi oznaczonymi `ZGADNIĘTE`:
`swarogDlon.js:20`, `mokoszSplot.js:21`, `weles.js:22`, `pieczecie.js:49`,
`szablony.js:5`. Wpis w pamięci projektu mówi wprost: *„Nic z tego nie zostało
sprawdzone na żywej kamerze."*

Innymi słowy: cztery razy zaprojektowaliśmy gest z wyobraźni, wyprowadziliśmy
progi z sygnałów syntetycznych, zamknęliśmy testy headless na zielono i oddali
graczowi coś, czego nikt nigdy nie zmierzył na jego ciele. Powtórzenie tej
procedury po raz piąty da piąty zestaw zgadniętych liczb.

**Dlatego kolejność w tym spec-u jest odwrócona.** Najpierw wybieramy pozy,
potem **nagrywamy je na żywym ciele właściciela projektu**, potem liczymy progi
z nagrań. Kod rozpoznawania powstaje bez ani jednej stałej wpisanej z głowy.
Nagrania są też materiałem dla testu, którego nie miała żadna poprzednia
generacja: *tańczę swobodnie i nic samo się nie składa*.

### Wymaganie, które postawił właściciel projektu

> „Pieczęcie przywołujące żywioły muszą być na tyle skomplikowane, żeby raczej
> nie pojawiały się przy naturalnym tańcu, i jednocześnie łatwe tak, żeby gracz
> mógł budować z nich swobodnie kombosy."

To brzmi jak sprzeczność, ale nie jest — pod warunkiem, że „skomplikowane"
znaczy *rzadkie w tańcu*, a nie *trudne do wykonania*. Osią, która rozdziela te
dwie rzeczy, jest **styk**.

### Teza: pieczęć to punkt dotyku, nie układ kończyn

Jedyna pieczęć, która w tym projekcie nigdy nie zawiodła, to piramidka Swaroga —
i jej własny komentarz (`swarogDlon.js:5-14`) tłumaczy dlaczego: **opuszki
dotykają opuszek**, a kształt namiotu sam wymusza rozsunięcie nadgarstków, czyli
prześwit, którego potrzebuje detektor. Znak ziemi, o który prosi właściciel
projektu — zaciśnięte pięści skrzyżowane na barkach — ma tę samą własność:
pięść **dotyka** barku.

Styk daje trzy rzeczy naraz:

1. **Jest rzadki w tańcu.** Ręce w górze, ręce w dole, obrót, wymach —
   wszystko to zdarza się co kilka sekund. Zaciśnięta pięść przyłożona do
   przeciwnego barku nie zdarza się nigdy przypadkiem.
2. **Gracz go czuje.** Dotyk to informacja zwrotna z własnego ciała, nie
   z ekranu. Można wykonać pieczęć z zamkniętymi oczami, stojąc bokiem, nie
   patrząc na monitor — a przy tańcu to jest warunek, nie wygoda.
3. **Trafia wysoko powyżej progu, więc składa się szybko.** `pieczecie.js:134-137`
   skaluje czas składania wynikiem: 0.9 składa się w ~0.9 s, a wynik ledwo nad
   progiem w 2.5 s. Pozy na styku są binarne fizycznie (albo dotykasz, albo nie),
   więc siedzą wysoko. To jest mechanizm, dzięki któremu kombosy w ogóle mieszczą
   się w oknie — czego runy nie osiągały, bo kształt kreślony w powietrzu rzadko
   wychodzi daleko powyżej progu.

Cztery z pięciu pieczęci są zbudowane wokół innego punktu styku. Piąta —
błyskawica — jest jedyna bez dotyku i dlatego wymaga najwięcej warunków naraz.

---

## Słownik: pięć żywiołów

| żywioł | bóstwo | id | styk | poza |
|---|---|---|---|---|
| **ogień** | Swaróg (kuźnia) | `swarog` | opuszki o opuszki | piramidka z dłoni, na wysokości klatki |
| **ziemia** | Weles (podziemie) | `weles` | nadgarstek o przeciwny bark | pięści skrzyżowane na barkach |
| **błyskawica** | Perun (grom) | `perun` | *oś łokci* + piramidka (miękko) | iglica: obie ręce w górę, łokcie nad barkami, opuszki złączone nad głową |
| **powietrze** | Stribog (wiatr) | `stribog` | łokieć o łokieć | gałęzie: łokcie razem, przedramiona pionowo w górę, dłonie rozchylone |
| **woda** | Mokosz (splot losu) | `mokosz` | nadgarstek o nadgarstek | miska: dłonie złożone nisko, przy pępku |

Pięć pieczęci, pięć identyfikatorów, jeden pierścień składania. Nazwy bóstw
zgodne z decyzją z burzy mózgów 2026-08-02 (Swaróg=ogień, Stribog=wiatr,
Perun=piorun, Weles=ziemia, Mokosz=woda).

---

## Pieczęcie: co dokładnie jest mierzone

Wszystkie liczby poniżej są **oczekiwaniami, nie progami**. Progi powstają
w Kroku 0 z nagrań (patrz niżej). Jednostką każdej odległości jest **szerokość
barków**, żeby gest działał tak samo u osoby wysokiej i niskiej.

### Ogień — Swaróg, piramidka

Czytana z landmarków dłoni: palce proste, zbieżność opuszek, nadgarstki
rozsunięte. Jedyna pieczęć w tym zestawie czytana z dłoni, a nie z pozy.

**Dochodzi jeden warunek z pozy: wyższy nadgarstek musi być powyżej −0.6
szerokości barków od linii barków** (piramidka na wysokości klatki, nie brzucha).
Wcześniejsze wersje tego spec-u pięciokrotnie powtarzały, że `swarogDlon.js`
zostaje bez jednej linijki zmiany. **Pomiar to obalił.**

Prawdziwy `swarogDlon.score()` puszczony na nagraniu z 2026-09-03 zapala się
**częściej na misce wody (179 z 322 klatek) niż na własnej piramidce (107 z 299)**.
Miska ma palce proste, opuszki zbieżne i nadgarstki rozsunięte w skali dłoni —
czyli komplet warunków ognia — bo `swarogDlon` w ogóle nie mierzy wysokości.
A sekwencja Tęczy to ogień → woda → powietrze, więc gracz przechodzi przez tę
kolizję **za każdym razem**.

To jest ta sama kolizja, którą przewiduje decyzja 2 — ale biegnie w **drugą
stronę**, niż tam założono: nie woda udaje ognia, tylko **ogień zapala się na
wodzie**. Przeniesienie wody na landmarki pozy tego nie rozwiązało, bo problem
siedział po stronie ognia. Lekcja jest ogólniejsza od tej pary: **kolizję trzeba
sprawdzać w obie strony**, a jedynym sposobem, żeby to zobaczyć, było puszczenie
prawdziwego znaku po prawdziwym nagraniu.

Zmierzony efekt warunku wysokości: woda **179 → 0** klatek, ogień **107 → 107**.
Zero kosztu dla samej piramidki.

**Znane ograniczenie, do pilnowania po wpięciu:** ogień jest krucha. Obie dłonie
są widoczne tylko w 39% klatek, a pierwsze z trzech nagranych powtórzeń
utrzymało wynik powyżej progu przez 0,72 s przy wymaganych ~0,9 s (pozostałe dwa
wystarczyły). Założenie „piramidka działa pewnie", na którym opiera się cały ten
spec, jest słabsze, niż zakładano — jeśli po wpięciu okaże się to problemem,
ogień wymaga własnego przeglądu.

### Ziemia — Weles, pięści na barkach

Ramiona skrzyżowane na krzyż, każda **zaciśnięta pięść dotyka przeciwnego barku**.

Warunki (minimum, nie średnia — konwencja całego repo):

1. `odległość(NADG_L, BARK_P) / skala` — mała (styk).
2. `odległość(NADG_P, BARK_L) / skala` — mała (styk).
3. Oba nadgarstki na wysokości linii barków lub wyżej.

Miękki kwalifikator z dłoni: **pięść zaciśnięta** (`zwinieta()` z `dlon.js`),
liczony wzorcem `WAGA_BEZ_DLONI` — gdy dłoni nie widać, nie karze.

**Uproszczenie względem starego `weles.js`:** stara wersja liczyła skrzyżowanie
jako znak iloczynu różnic x (`weles.js:46-50`), bo sprawdzanie samej kolejności x
dawało wynik odwrotny w lustrze płótna. Ta ostrożność jest tu **niepotrzebna**:
odległość między dwoma landmarkami jest niezmiennikiem odbicia, a MediaPipe
etykietuje strony ciała, nie strony obrazu. Dwa warunki styku implikują
skrzyżowanie i robią to bez ani jednej operacji wrażliwej na lustro. Formuła
ze znakiem iloczynu znika z kodu razem z klasą błędów, którą łatała.

**Warunek 3 jest tym, co odcina Splot Mokoszy** — Splot miał nadgarstki pół
szerokości barków *pod* linią barków (`mokoszSplot.js:30`). Splot i tak odchodzi
(decyzja niżej), ale warunek zostaje, bo odcina też zwykłe „ręce splecione na
piersi", które w tańcu się zdarza.

### Błyskawica — Perun, iglica

**Obie ręce w górę, łokcie powyżej linii barków.** Sylwetka jak iglica albo
uderzenie pioruna w górę.

Jedyna pieczęć bez punktu styku — i jedyna, która go nie potrzebuje, bo stoi
na osi, której nie używa nic innego w tym słowniku: **wysokości łokci**.

**To trzecia poza błyskawicy, i pierwsza wyprowadzona z pomiaru, a nie
z wyobraźni.** Dwie poprzednie padły na nagraniach:

1. *Zygzak bokiem* (ręka górą-przodem, ręka dołem-tyłem, zgięte łokcie).
   Z 327 klatek ani jedna nie osiągnęła realnego profilu; kąt w łokciu wyszedł
   prostszy niż podczas swobodnego tańca. Pieczęć zapalała się mocniej w tańcu
   (0.37) niż we własnej pozie (0.22).
2. *Chwyt za łokieć.* Dłoń nie zbliżyła się do łokcia — mediana 1.14 szerokości
   barków, podczas gdy pięść na barku (ziemia) osiąga 0.32. Przyczyna była
   w projekcie, nie w wykonaniu: **żeby chwycić uniesiony łokieć, druga ręka
   też musi pójść w górę**, więc towarzyszący warunek „jedna ręka wysoko, druga
   nisko" był z tą pozą wewnętrznie sprzeczny. Kandydat został sprawdzony pod
   kątem „czy taniec go zapala", ale nigdy pod kątem „czy sama poza może go
   spełnić" — bo w chwili sprawdzania nie istniały jeszcze jej próbki.
   **Weryfikacja jednostronna jest w tym projekcie błędem metody, nie detalem.**

Nieudana próba 2 okazała się rozstrzygająca, bo pokazała, co ciało robi
naprawdę: unosi łokcie **nad** linię barków. Zmierzone mediany wysokości łokci
względem tej linii:

| | łokcie |
|---|---|
| **błyskawica (nagranie)** | **+0.13** |
| taniec | −0.70 |
| ziemia | −0.65 |
| powietrze | −0.67 |
| woda | −0.72 |
| ogień | −0.65 |

Cała czwórka pozostałych pieczęci i całe trzydzieści sekund swobodnego tańca
trzymają łokcie **pod** barkami, i to z zapasem ponad pół szerokości barków.
Uniesienie łokci powyżej barków jest ruchem świadomym — nie zdarza się mimochodem.

Warunki:

1. **Oba nadgarstki wyraźnie nad linią barków.**
2. **Oba łokcie nad linią barków.** To jest warunek nośny.

Miękki kwalifikator z dłoni: **opuszki złączone w piramidkę nad głową** — ten
sam namiot co w ogniu, tylko wysoko, przez co iglica dosłownie wygląda jak iglica.
Propozycja właściciela projektu, przyjęta z jedną zmianą: **jako kwalifikator,
nie jako warunek konieczny.** Zmierzone na nagraniu: przy rękach nad głową
MediaPipe widzi **obie dłonie tylko w 31% klatek**. Twardy warunek oparty na tym
sygnale uczyniłby błyskawicę tak samo kruchą, jak dziś jest ogień. Jako
kwalifikator robi dokładnie to, o co chodziło — obniża wynik, gdy dłonie widać
i nie są złożone — a gdy ich nie widać, nie karze (wzorzec `WAGA_BEZ_DLONI`).

Dwa warunki nośne plus jeden miękki — najprostsza pieczęć w zestawie i jedyna,
której nie trzeba się uczyć.

**Zweryfikowane na nagraniach:** komplet warunków spełnia **zero z 763 klatek
tańca** i **zero klatek każdej z czterech pozostałych pieczęci**, przy każdym
progu z zakresu, jaki sprawdzono. W nagraniu próby 2 pierwsze powtórzenie
utrzymało komplet przez **3,98 s bez przerwy** — pieczęć potrzebuje ~0,9 s,
więc zapas jest czterokrotny. Powtórzenia 2 i 3 wypadły krócej, bo instrukcja
prosiła wtedy o **asymetrię** („prawa ręka w górze", „lewa ręka w górze"),
a czysta jest właśnie poza **symetryczna**. Instrukcja kroku 3 została
poprawiona.

### Refleksja nad tezą styku

Cztery pieczęcie zbudowane wokół dotyku rozdzieliły się czysto, a pierwsze dwie
próby błyskawicy — bez dotyku — nie rozdzieliły się wcale. To kusi, żeby uznać
styk za warunek konieczny. **Iglica pokazuje, że tak nie jest.**

Tym, co naprawdę rozdziela, jest **oś, której nie używa nic innego w słowniku**.
Styk był dobrym sposobem znajdowania takich osi, bo dotyk jest rzadki i łatwo go
zmierzyć. Wysokość łokci okazała się równie dobrą osią, a przy tym daje pozę
prostszą do wykonania niż którakolwiek z pozostałych. Teza brzmi więc dokładniej:
**pieczęć potrzebuje własnej osi, a styk jest jedną z dróg do niej — nie jedyną.**

### Powietrze — Stribog, gałęzie

**Łokcie stykają się** przed mostkiem, przedramiona pionowo w górę, dłonie
rozchylone na zewnątrz jak dwie gałęzie z jednego pnia.

1. `odległość(LOKIEC_L, LOKIEC_P) / skala` — mała (styk).
2. Oba nadgarstki nad linią barków.
3. `odległość(NADG_L, NADG_P) > odległość(LOKIEC_L, LOKIEC_P)` — nadgarstki
   dalej od siebie niż łokcie.

**Warunek 3 nie jest ozdobą.** Bez niego poza degeneruje się do „ręce w górze",
czyli do czegoś, co w tańcu zdarza się nieustannie. Rozchylenie jest tym, co
zamienia uniesione ręce w gest.

Ortogonalność do ognia jest z konstrukcji: ogień to **nadgarstki rozsunięte,
opuszki razem**, powietrze to **łokcie razem, nadgarstki rozsunięte**.

### Woda — Mokosz, miska

Dłonie złożone w miskę na wysokości pępka, **nadgarstki stykają się bokami**,
przedramiona poziomo, palce rozwarte.

Czytana **z nadgarstków POZY, nie z landmarków dłoni** — uzasadnienie w decyzji 2.

1. `odległość(NADG_L, NADG_P) / skala` — mała (styk).
2. Oba nadgarstki nisko: `(y_nadgarstka − y_barków) / skala` ≈ jedna szerokość
   barków. Rampa trójkątna w obie strony, żeby gasło płynnie, nie skokiem.
3. `odległość(LOKIEC_L, LOKIEC_P) > odległość(NADG_L, NADG_P)` — łokcie szerzej
   niż nadgarstki. To jest różnica między *miską* a *rękami splecionymi przy
   brzuchu*.

Miękki kwalifikator z dłoni: **palce rozwarte** (`ileWyprostowanych()/5`),
wzorcem `WAGA_BEZ_DLONI`.

**Wysokość (warunek 2) liczona jest od linii barków, nie od bioder.** To jest
lekcja z `mokoszSplot.js:5-11`: stare postawy wymagały kadru z barkami *i*
biodrami plus zapasem, czego kamera laptopa nie daje. Żadna z pięciu pieczęci
nie odwołuje się do bioder.

---

## Rozdzielność: każda para różni się osią, nie progiem

| | ogień | ziemia | błyskawica | powietrze | woda |
|---|---|---|---|---|---|
| **styk** | opuszki | nadgarstek–bark | brak | łokieć–łokieć | nadgarstek–nadgarstek |
| **nadgarstki** | rozsunięte | na barkach | jeden górą, drugi dołem | nad barkami, rozchylone | razem, nisko |
| **łokcie** | — | — | zgięte, w kontrze | razem | szerzej niż nadgarstki |
| **tułów** | dowolnie | przodem | przodem | przodem | przodem |
| **łokcie** | — | pod barkami | **NAD barkami** | pod barkami | pod barkami |

- **ogień ↔ woda** — wysokość, i to teraz po OBU stronach. Ogień pierwotnie
  w ogóle nie mierzył wysokości, przez co zapalał się na misce częściej niż na
  własnej piramidce (179/322 wobec 107/299, zmierzone). Warunek wysokości
  w ogniu sprowadza to do zera. Para najbardziej narażona — i jedyna, w której
  kolizja biegła w stronę odwrotną do przewidywanej.
- **ziemia ↔ powietrze** — co się styka (nadgarstek z barkiem vs łokieć
  z łokciem) oraz gdzie są nadgarstki (na barkach vs nad barkami i rozchylone).
  Druga najbardziej narażona para, obie to „ręce splecione z przodu".
- **błyskawica ↔ reszta** — jedyna z łokciami NAD linią barków (+0.13 wobec −0.65…−0.72 u pozostałych i −0.70 w tańcu, mediany zmierzone). Rozdziela ją oś, której nie dotyka żadna inna pieczęć.
- **woda ↔ powietrze** — odwrotna relacja łokci i nadgarstków, plus wysokość.

Rozdzielność nie jest deklaracją. Jest sprawdzana testem na nagraniach
(sekcja Weryfikacja), **łącznie z klatkami przejścia** — bo pozy trzymane są
rozdzielne z konstrukcji, a to nie ta własność, której potrzebujemy.

---

## Kluczowe decyzje projektowe

### 1. Styk jako oś projektowa

Opisana w Context. Konsekwencja implementacyjna: styk **nie jest warunkiem
binarnym**. Każdy liczony jest jako `rampa(odległość, STYK_PELNY, STYK_ZERO)`,
więc pięść *blisko* barku daje słabszy, ale niezerowy wynik. Reguła nadrzędna
(GEMINI.md §2) obowiązuje także tutaj: nic nigdy nie mówi „źle".

### 2. Woda czytana z pozy, nie z dłoni

Pierwotny pomysł — miska czytana z landmarków dłoni, ze zbieżnością nadgarstków
jako warunkiem — miał **dwie niezależne wady, obie udokumentowane w tym repo**:

**Wada pierwsza: to jest znany tryb awarii detektora.** `swarogDlon.js:8-11`
notuje pomiar na żywej dłoni: *„MediaPipe gubi jedną dłoń przy maksymalnym
ścisku"*, i mówi wprost, że piramidka jest najbezpieczniejsza, bo **wymaga
rozsuniętych nadgarstków**. Miska wymaga nadgarstków stykających się — czyli
dokładnie tego, co gubi detektor. Diagnoza tego projektu brzmi „awarie nie
wynikały ze złych progów, tylko z braku informacji w sygnale"; tu byłby to ten
sam błąd, popełniony świadomie.

**Wada druga: kolizja z ogniem na tej samej osi pomiarowej.** Ogień to
`zbieznoscOpuszek` mała **przy** `odlegloscNadgarstkow` **dużej**. Miska z dłoni
to te same dwie osie z odwróconymi wartościami. A sekwencja Tęczy każe graczowi
przechodzić **ogień → woda za każdym razem**. W trakcie przejścia obie pozy
siedzą w połowie skali; przy `MARGINES_LIDERA = 0.12` i `CZAS_PRZEJECIA_S = 0.25`
któraś przejmuje pierścień, a przejęcie **zeruje postęp**. Objaw: woda nigdy się
nie składa. To jest dosłownie awaria opisana w `pieczecie.js:32-46` — *„pierścień
migał między dwoma liderami i żadna pieczęć nigdy się nie składała"* — czyli ta,
którą łatał hack preferencji Splotu nad Welesem.

**Rozwiązanie:** woda czyta nadgarstki z **pozy** (poza nie gubi nadgarstka, gdy
dłonie się stykają) i dokłada oś, której ogień w ogóle nie mierzy — **wysokość**.
Kolizja rozpada się na osi, której żadna z dwóch pieczęci z drugą nie dzieli.
Palce rozwarte zostają jako **miękki kwalifikator** z dłoni: liczy się, gdy dłoń
widać, a gdy nie widać — nie karze (`WAGA_BEZ_DLONI`, `runy/definicje.js:25`).

### 3. Skala ciała liczona w pełnym 3D, z wygładzaniem

`postawa.js:42-47` liczy rozstaw barków jako `sqrt(dx² + dy²)` z podłogą 0.12 m.
`worldLandmarks` to metryczne 3D. Kiedy gracz stoi bokiem, rozstaw barków
przenosi się w oś `z`, `dx`/`dy` schodzą do zera, wynik ląduje na podłodze 0.12,
podczas gdy realny rozstaw to ~0.38 m. **Skala robi się trzykrotnie za mała,
więc każdy próg wyrażony w jej wielokrotnościach robi się trzykrotnie za luźny** —
pozy zapalają się od byle czego. Nie jest to hipotetyczne: błyskawica **wymaga**
stania bokiem — a choć nowa poza błyskawicy tego nie wymaga, gracz i tak obraca się swobodnie podczas tańca, więc skala musi to znosić.

**Wygładzana jest wyłącznie skala używana do normalizacji odległości.** Warunek
„stoisz bokiem" w błyskawicy (`obrotBokiem`) liczy iloraz rozstawu 2D do 3D
z **bieżącej klatki**, nie z wartości wygładzonej — inaczej mianownik zostawałby
w tyle dokładnie wtedy, gdy gracz się obraca, czyli w jedynym momencie, w którym
ten warunek cokolwiek znaczy.

Zmierzone na nagraniu z 2026-09-03: przy pozach wykonywanych przodem 3D i 2D pokrywają się co do trzeciego miejsca, a przy próbie stania bokiem rozjeżdżają się na 0.322 wobec 0.277 — czyli mechanizm jest realny, tylko rzadziej uruchamiany, niż zakładał pierwotny projekt.

Naprawa: `sqrt(dx² + dy² + dz²)`. Rozstaw barków to wymiar sztywnego ciała,
więc w pełnym 3D jest **niezmiennikiem obrotu**. Do tego **EMA w czasie**: skala
jest stałą ciała, nie pomiarem z klatki, więc mocne wygładzenie jest tu poprawne
z definicji i zjada szum osi `z`, którą MediaPipe szacuje mniej pewnie niż `x`
i `y`. Podłoga 0.12 zostaje jako ochrona przed dzieleniem przez zero.

**Robimy to w tym samym przejściu**, bo promień rażenia jest zerowy: jedynymi
konsumentami `skalaCiala` są znaki z pozy, a wszystkie pięć i tak powstaje od
nowa. Ogień idzie przez skalę dłoni w `dlon.js` i nie jest dotknięty.

Pierwsza rzecz liczona z nagrań: **czy rozstaw barków 3D faktycznie trzyma się
stały, gdy gracz się obraca.** Jeśli nie — to jest wynik, nie porażka; wtedy
skala schodzi na estymatę długo-czasową (mediana z okna), a nie na pomiar z klatki.

### 4. Wycofane: przód/tył z osi `x` przy staniu bokiem

**Ta decyzja odeszła razem z pierwotną pozą błyskawicy** (patrz sekcja
„Błyskawica"). Zostaje zapisana, bo jej przesłanka nadal obowiązuje i wróci
przy każdym przyszłym geście kuszącym osią głębokości.

Brzmiała tak: oś `z` jest najmniej pewnym sygnałem tego trackera, więc warunku
„ręka do przodu, ręka do tyłu" nie wolno z niej czytać. Stanie bokiem miało to
odwrócić na naszą korzyść — u gracza stojącego profilem przód i tył leżą
w poziomie obrazu, czyli w `x`, najpewniejszej osi, jaką mamy.

Rozumowanie było poprawne, a mimo to nie zadziałało, i to jest tu lekcja:
**gracz nie stanął bokiem.** Z 327 nagranych klatek ani jedna nie osiągnęła
realnego profilu. Sprytna konstrukcja pomiarowa nie pomaga, jeśli opiera się
na ułożeniu ciała, którego człowiek pod presją czasu nie przyjmuje. Nowa poza
nie odwołuje się do osi `z` ani do obrotu tułowia w ogóle.

### 5. Kwalifikatory z dłoni są miękkie, nigdy blokujące

Ziemia (pięść) i woda (palce rozwarte) czytają dłoń, ale **żadna nie jest od
niej zależna**. Wzorzec z `runy/definicje.js:127-132`: gdy dłoni nie ma w kadrze,
kwalifikator przyjmuje wartość domyślną zamiast zera. Brak dłoni nie karze —
poza czytana z ciała ma sama w sobie wystarczająco informacji, a dłoń tylko
doprecyzowuje. To jest ta sama proporcja co w regule z 2026-08-02: **ciało
prowadzi, dłonie doprecyzowują**.

### 6. Splot Mokoszy odchodzi

`mokoszSplot.js` (ramiona skrzyżowane na piersi) jest geometrycznie sąsiadem
ziemi: obie to skrzyżowane ramiona, różnią się wysokością nadgarstków i stykiem
z barkiem. Ta para już raz się zderzyła — commit `784630f` łatał to hackiem
preferencji, a lepki argmax w `pieczecie.js:32-46` powstał, żeby ten hack
uogólnić. Wpuszczenie ziemi obok Splotu wsadza obie z powrotem do jednego
argmaxu, bez zysku: Splot był jedynym wejściem do Tęczy, a Tęcza dostaje teraz
sekwencję żywiołów.

Plik zostaje w drzewie, odpięty — precedens `welesDlon.js`/`perunDlon.js`/
`szczurDlon.js`.

### 7. Runy odpięte, nie usunięte

`js/runy/` (bufor śladu, normalizacja kształtu, dopasowanie cykliczne
i odwracalne, rysowanie śladu) to działający silnik rozpoznawania kształtów
kreślonych w powietrzu. Nie nadaje się na **pieczęcie** — kształt kreślony
rzadko wychodzi daleko powyżej progu, więc składa się wolno i nie mieści
kombosów w oknie — ale jest gotowym materiałem na **przyszłe techniki**
(decyzja właściciela projektu: „zostaw w pamięci do przyszłego rozwoju technik").

Pliki zostają w drzewie, odpięte od `main.js`, z notką w nagłówku każdego.
`tools/test-runy.mjs` **zostaje zielony** — moduł dalej żyje i ma działać, gdy
ktoś po niego sięgnie.

### 8. Żadna stała nie jest zgadnięta

Konsekwencja Context. Kod rozpoznawania powstaje z **nazwanymi stałymi bez
wartości domyślnych wpisanych z głowy** — wartości wchodzą po Kroku 0, wraz
z komentarzem mówiącym, z której próbki pochodzą. Jeśli w kodzie tej generacji
pojawi się słowo `ZGADNIĘTE`, coś poszło nie tak.

---

## Kolejność wykonania (wiążąca)

Ta kolejność nie jest preferencją — odwrócenie jej kasuje aplikację, w której
trzeba nagrać sesję:

1. **Harness nagraniowy** w `debugHud.js` + zapis do `tools/probki/`. Powstaje,
   **gdy gra jeszcze działa na runach**, i nie zależy od żadnego z pięciu nowych
   modułów znaków. Zapisuje surowe landmarki, nic nie interpretuje.
2. **Sesja nagraniowa** — właściciel projektu nagrywa scenariusz.
3. **Naprawa skali** (`postawa.js`, decyzja 3) i weryfikacja na nagraniach, czy
   rozstaw barków 3D trzyma się stały przy obrocie.
4. **Progi liczone z nagrań**, pieczęć po pieczęci, wraz z pętlą strojenia niżej.
5. **Przepisanie pięciu znaków** i przepisanie testów syntetycznych.
6. **Odpięcie run i Splotu** z `main.js` i `aura.js` — dopiero teraz, na końcu.

Krok 6 przed krokiem 1 znaczyłby usunięcie działającej gry, zanim powstanie
materiał, dla którego się ją usuwa.

---

## Krok 0: sesja nagraniowa

**Wykonywana przed napisaniem choćby jednego progu.**

### Ograniczenie, które kształtuje projekt sesji

Żeby nacisnąć klawisz, gracz musi podejść do komputera, a potem odejść, żeby
tańczyć. Nagrywanie wyzwalane pojedynczym naciśnięciem („naciśnij i trzymaj
pozę") jest więc bezużyteczne. **Sesję prowadzi aplikacja, nie gracz.**

### Przebieg

Jedno naciśnięcie `Z` uruchamia cały scenariusz. Gracz odchodzi i od tej chwili
gra go prowadzi:

- Na ekranie wielkim drukiem **nazwa pozy** i jednozdaniowy opis, pod tym pasek
  odliczania.
- Pierwsze odliczanie **długie (~12 s)** — dojście i ustawienie się.
- **Sygnał dźwiękowy** (`audioEngine.js`, już w projekcie): trzy krótkie przed
  startem, długi = *teraz trzymaj*, krótki = koniec kroku. Dźwięk jest tu
  ważniejszy od ekranu — przy błyskawicy gracz stoi bokiem i monitora może nie
  widzieć.
- Po kroku ~5 s przerwy na zmianę pozy, potem następny krok.

### Scenariusz

Lista kroków zaszyta w kodzie jako dane, łatwa do zmiany:

1. **Pięć pieczęci, każda trzy razy po 4 s.** Między powtórzeniami gracz
   proszony o zmianę: raz bliżej kamery, raz dalej, raz lekko obrócony.
   **To nie jest upiększanie** — progi wyprowadzone z trzech niemal identycznych
   powtórzeń pasowałyby tylko do tego jednego miejsca, w którym gracz stał.
2. **Przejścia**: ogień→woda→powietrze jednym ciągiem, ×3. Potem
   ziemia→powietrze, ×3. To dwie pary o najmniejszym marginesie (patrz
   Rozdzielność).
3. **Swobodny taniec, 30 s.** Jeden ciąg, bez myślenia o pieczęciach. Próbka
   negatywna.

Razem ~4 minuty jednym ciągiem, bez podchodzenia do komputera.

### Zapis

Każda klatka: `worldLandmarks`, landmarki 2D pozy, dłonie jeśli są, `dt`.
Wszystko z etykietą kroku, do jednego pliku JSON w `tools/probki/`.

Nagranie każdego kroku obejmuje **4 s od sygnału startu**; przy liczeniu progów
odrzucam pierwsze ~0.5 s (dochodzenie do pozy). **Klatki z przerw między krokami
nie są zapisywane** — bez tego plik puchnie o materiał, którego nikt nie użyje.
Przy ~30 klatkach na sekundę i ~110 s materiału użytecznego to rząd kilku MB
JSON-a; jeśli okaże się większy, liczby skracamy do trzech miejsc po przecinku
przy zapisie (dokładność `worldLandmarks` i tak jest niższa).

### Poprawki

Nie każde powtórzenie wyjdzie — potknięcie, spóźnione wejście w kadr, ktoś
przechodzi w tle. Dwa zabezpieczenia: trzy powtórzenia na krok, więc jedno
zepsute nie kasuje kroku; oraz **klawisze `1`–`8` uruchamiają sesję od kroku
o tym numerze** (scenariusz ma osiem kroków: pięć pieczęci, dwa przejścia,
taniec), więc dogranie jednej pozy to jedno podejście do komputera, nie cała
sesja od nowa. Numery kroków wypisuje nakładka. Przed liczeniem progów
przeglądam każde powtórzenie i odrzucam te, w których tracking się posypał —
i mówię, co dograć.

---

## Pliki

### Nowe

- `js/znaki/styk.js` — wspólne prymitywy: `styk(wl, i, j, skala, pelny, zero)`
  (ciągła rampa odległości), `nadBarkami(wl, i, skala)`, `katWLokciu(wl, bark,
  lokiec, nadg)`, `obrotBokiem(wl)`. Wydzielone, bo powtarzają się w czterech
  z pięciu pieczęci.
- `tools/probki/` — nagrania z Kroku 0 (JSON, wersjonowane w git; to jest teraz
  źródło prawdy dla progów, więc ma żyć w repo).
- `tools/test-rozdzielnosc.mjs` — test na nagraniach, opisany w Weryfikacji.

### Modyfikowane

- `js/znaki/postawa.js` — skala w pełnym 3D + EMA (decyzja 3).
- `js/znaki/weles.js` — przepisany: pięści na barkach.
- `js/znaki/perun.js` — przepisany: zygzak z chwytem za łokieć.
- `js/znaki/stribog.js` — przepisany: łokcie razem.
- `js/znaki/mokosz.js` — przepisany: miska z pozy.
- `js/main.js` — rejestruje piątkę; znikają `stworzSlady`/`aktualizujSlady`/
  `stworzZnakiRun` i rysowanie śladu.
- `js/kombosy.js` — nowa tabela.
- `js/debugHud.js` — obsługa sesji nagraniowej (`Z`, `Shift+Z`), ekran
  prowadzący, zrzut JSON.
- `js/aura.js` — usunięcie bufora śladu run (wchodził tam tylko dla rysowania
  kreślonego kształtu).
- `tools/test-postawy.mjs`, `tools/test-znaki.mjs` — **przepisane**, bo testują
  stare definicje `weles`/`perun`/`stribog`/`mokosz`, które właśnie znikają.
  Podział pracy między testami jest celowy: te dwa zostają na **danych
  syntetycznych** i sprawdzają *własności* — ciągłość wyniku, niezmienniczość
  na odbicie lustrzane, minimum zamiast średniej, zero przy braku punktów.
  **Progi** sprawdza wyłącznie test rozdzielności na nagraniach. Syntetyczna
  poza nigdy nie dowodzi, że próg jest dobry — dowodzi tylko, że wzór się nie
  wywraca.
- `tools/test-wszystko.sh` — dopisanie testu rozdzielności.

### Zostają wpięte, nietknięte

- `js/znaki/swarogDlon.js` i `tools/test-pieczecie-dloni.mjs` w części dotyczącej
  Swaroga.
- `js/pieczecie.js` — silnik składania bez zmian. Lepki argmax zostaje: nadal
  chroni przed migotaniem, tylko przestaje być jedyną obroną.
- `js/znaki/registry.js`, `js/efekty.js`, routing `uzbraja` w `main.js`.

### Odpięte, nie usunięte

- `js/runy/*` — notka w nagłówku każdego pliku (decyzja 7). `tools/test-runy.mjs`
  zostaje zielony.
- `js/znaki/mokoszSplot.js` (decyzja 6), `js/znaki/welesDlon.js`,
  `js/znaki/perunDlon.js`, `js/znaki/szczurDlon.js` — już odpięte, bez zmian.

---

## Kombosy

| kombos | sekwencja | efekt |
|---|---|---|
| **Wstęga Mokoszy** (Tęcza) | `swarog` → `mokosz` → `stribog` | 30 s tęczowej wstęgi, aktywacja natychmiastowa |
| **Grom w Ogniu** | `swarog` → `perun` | uzbraja płonący palec (`ogien`) |
| **Podmuch Striboga** (Aard) | `stribog` → `stribog` | uzbraja podmuch (`aard`) |

Ziemia nie wchodzi na razie w żaden kombos — zostaje pieczęcią samodzielną,
dającą swój błysk. Dokładanie kombosu bez techniki, którą miałby uzbrajać, byłoby
wymyślaniem na zapas; ziemia wejdzie, gdy powstanie technika ziemi.

`zewPodziemia` (`mokosz-piesc` ×2) znika razem z wariantami run.

**Łańcuchy zostają celowe** (`kombosy.js:13-15`): bufor nie jest czyszczony po
trafieniu i dopasowujemy końcówkę, więc `…swarog → mokosz → stribog → stribog`
daje Tęczę, a zaraz po niej Aard. Gracz nie może zmarnować pieczęci.

### Budżet czasowy

Okno kombosa to `OKNO_MS = 6500`. Pieczęć na styku powinna trafiać wynik ~0.9,
a wtedy `pieczecie.js:134-137` daje czas składania `2.5 + (0.5 − 2.5) × 0.8 =
0.9 s`. Trzy złożenia to ~2.7 s plus przejścia — mieści się z zapasem. Dla
porównania: przy wyniku 0.7 (typowym dla run) jedno złożenie trwa 1.7 s, trzy to
5.1 s plus przejścia, i stąd brało się zmierzone ograniczenie Wstęgi w poprzedniej
generacji.

**To jest przewidywanie, nie pomiar.** Weryfikuje je test przejść na nagraniach.

---

## Weryfikacja

### Bez kamery — `sh tools/test-wszystko.sh`

Dotychczasowe testy zostają zielone, plus:

**`tools/test-rozdzielnosc.mjs`** — uruchamiany na nagraniach z `tools/probki/`.
To jest test, którego nie miała żadna z czterech poprzednich generacji.

1. **Pozy trzymane.** Dla każdego powtórzenia każdej pieczęci: docelowy znak
   przebija `PROG_POSTAWY` (0.5) **i** wyprzedza drugiego w kolejce o więcej niż
   `MARGINES_LIDERA` (0.12).
2. **Taniec.** Całe 30-sekundowe nagranie przepuszczone przez **prawdziwy**
   `SkladaniePieczeci` — asercja: **nie złożyła się ani jedna pieczęć**. Nie
   „żaden znak nie przekroczył progu w żadnej klatce", bo pojedyncza klatka i tak
   niczego nie składa; asercja dotyczy dokładnie tej własności, o którą prosi
   właściciel projektu: *tańczę i nic samo nie wychodzi*.
3. **Przejścia.** Ciąg ogień→woda→powietrze przepuszczony przez
   `SkladaniePieczeci` **i** `KomboSilnik` — asercja: dokładnie trzy złożenia,
   w tej kolejności, i Tęcza odpaliła. Analogicznie ziemia→powietrze: dwa
   złożenia, żadnego trzeciego znaku po drodze. **To jest test na to, że
   pierścień nie miga w trakcie przejścia** — czyli na klasę awarii z decyzji 2.

Punkt 3 jest ważniejszy od punktu 1. Pozy trzymane są rozdzielne z konstrukcji;
przejścia nie są, a to przez nie gracz przechodzi za każdym razem.

**Nagranie jest wejściem STAŁYM, a progi zmienną.** Test rozdzielności nie jest
jednym przebiegiem, tylko pętlą strojenia: policz progi z próbek → uruchom test →
popraw → uruchom ponownie, **bez ponownego nagrywania**. Właściciel projektu
tańczy raz; iteracje dzieją się offline, na tych samych plikach JSON. To jest
dokładnie mechanizm, dzięki któremu „żadnej stałej zgadniętej" jest osiągalne,
a nie tylko deklarowane — bo każda poprawka progu ma natychmiastowy, powtarzalny
dowód na prawdziwym ciele.

### Na żywym ciele — `http://localhost:8000`, klawisz `D`

1. FPS nie spada względem stanu sprzed zmiany (znika sześć run i bufory śladu,
   dochodzi pięć tanich pozy — powinno być szybciej).
2. Każda z pięciu pieczęci składa się w rozsądnym czasie i nakładka pokazuje,
   który warunek ją hamuje.
3. Tęcza odpala z sekwencji ogień→woda→powietrze wykonanej płynnie.
4. Kilka minut swobodnego tańca: żadna pieczęć nie składa się sama.
5. Reguła §2 trzyma się na żywym ciele — nigdzie nie pojawia się komunikat
   porażki, częściowo ułożona poza daje słabszy efekt, nie odrzucenie.

Dopiero po przejściu punktów 1-5 wolno powiedzieć, że pieczęcie działają.

---

## Poza zakresem

- **Kombosy z ruchów charakterystycznych** (nie tylko z pieczęci) — kierunek
  wskazany przez właściciela projektu, świadomie odłożony. Silnik śladu z
  `js/runy/` jest do tego gotowym materiałem.
- **Technika ziemi.** Ziemia na razie tylko błyska.
- **Runy jako technika** (kreślony kształt jako sposób *rzucania*, nie
  *składania*) — patrz wyżej.
- **Domknięcie kierunku zwrotu ciała nosem** dla błyskawicy — wchodzi tylko,
  jeśli próbka tańca pokaże, że bezznakowy warunek 3 jest za szeroki.
- **Strojenie efektów wizualnych** pięciu pieczęci. Na razie każda dostaje ten
  sam błysk co dotychczasowe.
