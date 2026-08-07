# Warstwa gestów: pieczęcie i kombosy

Data: 2026-08-07

## 1. Po co

Gra mierzy dziś płynność tańca i zamienia ją w moc widoczną jako aura. Moc nie ma
zastosowania — pasek dochodzi do 100% i tam zostaje. Ta warstwa daje jej ujście:
gracz układa ciałem **pieczęcie**, każda daje lekki efekt wizualny, a pieczęcie
złożone po sobie w sekwencję odpalają **technikę** o mocniejszej oprawie.

Inspiracja: szamanizm, mitologia słowiańska, układanie pieczęci jak w Naruto.

## 2. Pętla rozgrywki

**Taniec (ładowanie) → pauza (pieczęć) → taniec.**

To są przeciwstawne bodźce: `MotionMeter` zanika przy bezruchu, a trzymanie
postawy *jest* bezruchem. **To jest zamierzony rytm, nie usterka.** Zapisane tutaj,
żeby nie zostało później „naprawione" przez kogoś, kto przeczyta to jako sprzeczność.

Wymuszona pauza pełni też drugą rolę: jest głównym mechanizmem przeciw
przypadkowym odpaleniom. Swobodny taniec rzadko utrzymuje jedną postawę przez
pół sekundy.

## 3. Zgodność z regułą nadrzędną

Reguła z GEMINI.md §2 — *nic nigdy nie mówi „źle"* — obowiązuje bez wyjątku.
Pieczęć jest binarna (wychodzi albo nie), ale binarność dotyczy **wyniku**, nie
**oceny**. Ciągły wynik postawy 0..1 steruje TEMPEM składania, tak jak płynność
steruje tempem ładowania mocy. Niedokładna postawa składa się wolniej — nigdy nie
dostaje komunikatu o porażce, nie miga na czerwono, nie jest odrzucana.

Trzy miejsca, w których ta reguła jest najbardziej narażona, i jak są zabezpieczone:

1. **Kara za niedokładność przez zanik mocy** — patrz §6a (zamrożenie zaniku).
2. **Bufor kombo czyszczony za pomyłkę** — patrz §8 (bufor tylko wygasa).
3. **Brak mocy jako stan porażki** — patrz §7 (komunikat mówi, co dalej).

## 4. Architektura

```
frame → ZnakRegistry.ocen()  →  wyniki 0..1 per znak
                                      ↓
                            SkladaniePieczeci
                       próg + tempo + bramka mocy
                                      ↓  zdarzenie BINARNE
                            { id, now }  ─────┬────→ EfektyPieczeci (lekki efekt)
                                              └────→ KomboSilnik (okno czasowe)
                                                          ↓
                                                     Technika (duży efekt)
```

`ZnakRegistry` **nie wymaga zmian**. `wymaga: 'pose'` jest już obsługiwane
(`registry.js:67-69`), a `ocen()` już zwraca kopię wyników właśnie po to, żeby
konsument mógł trzymać historię (`registry.js:44-50`) — czyli dokładnie po to,
czego potrzebuje silnik kombosów.

### Nowe pliki

| Plik | Odpowiedzialność |
|---|---|
| `js/znaki/perun.js` | postawa gromu → 0..1 |
| `js/znaki/mokosz.js` | postawa ziemi → 0..1 |
| `js/znaki/weles.js` | postawa podziemia → 0..1 |
| `js/pieczecie.js` | próg, tempo składania, bramka mocy, emisja zdarzenia |
| `js/kombosy.js` | bufor pieczęci i dopasowanie sekwencji |
| `js/efekty.js` | jedna funkcja rysująca; efekty jako tabela danych |

### Pliki zmieniane

| Plik | Zmiana |
|---|---|
| `js/main.js` | wpięcie rejestru, składania, kombosów i efektów w pętlę klatki |
| `js/motionMeter.js` | `zuzyj(koszt = 1)`; flaga zamrożenia zaniku |
| `js/aura.js` | jasność aury na mocy opóźnionej, nie surowej |

**`js/efekty.js` trzyma efekty jako tabelę danych** (id → kolor, kształt, czas
trwania), rysowaną jedną funkcją. To jest część najbardziej narażona na rozrost
do „plik na efekt" — ma nim nie być.

## 5. Trzy pieczęcie

Wszystkie czytają **`worldLandmarks`**, nigdy `landmarks`. GEMINI.md:49 jest
kategoryczne: 2D służy wyłącznie do rysowania. Istniejące znaki dłoniowe
(`swarog`, `stribog`) używają 2D jako udokumentowany dług (`swarog.js:8-12`) —
tego długu **nie przenosimy** do znaków ciała.

Punkty: nadgarstki (15/16), łokcie (13/14), barki (11/12), biodra (23/24).

**Punkty palców 17-22 są celowo pominięte.** Istnieją w zestawie PoseLandmarkera
i dają zgrubną orientację dłoni za zero dodatkowych milisekund — ale na modelu
*lite* przy szerokości detekcji 480 px są najbardziej zaszumionymi punktami
w zestawie. Zostały sprawdzone po to, żeby zostawić otwarte drzwi do gestów
dłoniowych, a nie po to, żeby na nich budować v1.

| Pieczęć | Postawa | Geometria | Efekt |
|---|---|---|---|
| **Perun** — grom | jedna ręka wyprostowana nad głowę, druga opuszczona | nadgarstek wysoko nad barkami; ramię wyprostowane (bark–łokieć–nadgarstek współliniowe); drugi nadgarstek poniżej bioder | pionowy biały rozbłysk wzdłuż uniesionego ramienia |
| **Mokosz** — ziemia | obie ręce nisko, rozstawione szerzej niż barki | oba nadgarstki poniżej bioder; rozstaw nadgarstków > szerokość barków | niski zielonkawy pierścień u stóp |
| **Weles** — podziemie | ręce skrzyżowane na piersi | nadgarstki po przeciwnych stronach tułowia; oba na wysokości barków | ciemny fiolet ściągający się do sylwetki |

Nazwy bogów są bezpieczne — `swarog` i `stribog` już ich używają. Omijamy
**symbolikę** kołowrotu i swarzycy (GEMINI.md:122), nie panteon.

**`swarog` i `stribog` zostają nietknięte.** Są dowodem, że rejestr obsługuje
`wymaga: 'hands'`, i ożyją same, gdy śledzenie dłoni wróci. Nie portujemy ich na
ciało i nie usuwamy.

### Stronność i lustro

MediaPipe podaje lewo/prawo **względem obrazu**, a płótno ma CSS
`transform: scaleX(-1)` (GEMINI.md:88). Weles czyta skrzyżowanie rąk po
kolejności współrzędnej x, więc jest na to wrażliwy. Rozstrzygnięcie: **gest jest
zdefiniowany symetrycznie** — liczy się fakt skrzyżowania, nie to, która ręka
jest na wierzchu. Perun tak samo: liczy się „jedna ręka w górze, druga w dole",
obojętnie która.

### Bramka widoczności

`registry._ocenJeden` sprawdza tylko, czy `frame.pose` w ogóle istnieje
(`registry.js:64-69`). Nadgarstek poza kadrem daje śmieciową geometrię, która
może przypadkiem wysoko punktować.

Każdy znak ciała zwraca 0, gdy którykolwiek z jego wymaganych punktów ma
`visibility < 0.5` (ten sam próg co `motionMeter.js:95`). **Zero znaczy tutaj
„brak danych", nie „źle"** — gracz poza kadrem nie dostaje komunikatu o porażce,
zgodnie z GEMINI.md §2.

## 6. Składanie pieczęci

Wybrany model: **próg + tempo powyżej niego**.

- Wynik postawy **poniżej progu** → nic się nie dzieje. Żadnego komunikatu, żadnego
  wskaźnika. Cisza, nie odmowa.
- Wynik **powyżej progu** → pierścień wokół sylwetki napełnia się tempem
  proporcjonalnym do dokładności postawy.
- **Pierścień pełny** → pieczęć skacze w istnienie. Binarnie, ze skokiem
  wizualnym i dźwiękiem.

Nic pośredniego nigdy nie jest pokazane jako **wynik**. Pierścień jest
zapowiedzią, nie połowicznym efektem.

### 6a. Zamrożenie zaniku mocy podczas składania

**To jest wymóg, nie optymalizacja.** Bez niego trzymanie postawy kosztuje
podwójnie: `responsywnosc` spada do zera (znika `przyrost`, `motionMeter.js:148`)
*i* jednocześnie działa `ZANIK` (`motionMeter.js:150`). Przy postawie niechlujnej,
ale ponad progiem (wynik ~0.55), składanie trwa około 2 s, co zjada ~13% mocy —
**więcej niż kosztuje sama pieczęć**.

Cena przestałaby wtedy wynosić 10% i stałaby się „10% plus kara proporcjonalna do
niedokładności". To jest dokładnie ta stopniowana kara, której zabrania reguła
nadrzędna.

Rozwiązanie: `MotionMeter` dostaje flagę zamrożenia zaniku, ustawianą przez
`SkladaniePieczeci` na czas napełniania pierścienia. Przyrost nadal nie działa
(gracz stoi), ale moc nie spada. Fabularnie uzasadnia to skupienie przy składaniu.

Dodatkowo: **sufit czasu składania**. Postawa z wynikiem tuż nad progiem nie może
trzymać gracza w nieskończonym zawieszeniu — po przekroczeniu sufitu pierścień
gaśnie bez komunikatu i można zacząć od nowa.

### 6b. Aura czyta moc opóźnioną

`main.js:181` podaje `moc` prosto do `aura.updateAndDraw()`. Aura jest deklarowaną
nagrodą całej gry (GEMINI.md:7, 37). Gdyby czytała moc surową, **każda pieczęć
przygaszałaby aurę o 10%** — czyli zabierałaby dokładnie to, co taniec zarobił,
a wielokrotne rzucanie dawałoby coraz ciemniejszego szamana. To odwraca strukturę
nagrody, na której stoi cały projekt.

Rozwiązanie: wydatek ma **czytać się jako wyładowanie, nie jako strata**. Jasność
aury śledzi moc wygładzoną, a nie surową; zejście jest celowym impulsem (aura
wylewa się w efekt i wraca), nie skokiem w dół. Stała czasowa wygładzania musi być
krótsza niż odbudowa mocy tańcem, żeby impuls był czytelny jako impuls.

## 7. Bramka mocy

Pieczęć kosztuje **10%** pełnego paska. Przyszłe, większe techniki mają kosztować
znacznie więcej — nawet większość paska — więc koszt jest polem w definicji
pieczęci, nie stałą globalną.

Bez wystarczającej mocy pierścień się nie napełnia. Komunikat mówi językiem gry —
**co jest dostępne dalej, nie co gracz robi źle** (GEMINI.md §2):

> „Pieczęć czeka — tańcz jeszcze chwilę"

nigdy „za mało mocy" ani „nie stać cię".

`MotionMeter.zuzyj()` dostaje parametr: **`zuzyj(koszt = 1)`**. Wartość domyślna
zachowuje zachowanie istniejącego wywołania z odpiętego `powerBall.js`, które
zeruje cały zbiornik.

## 8. Kombosy

Silnik trzyma bufor ostatnio złożonych pieczęci w oknie czasowym. Gdy końcówka
bufora pasuje do zdefiniowanej sekwencji — technika odpala się sama.

**Bufor wygasa z czasem, ale NIGDY nie jest czyszczony za pomyłkę.** Każda
konwencjonalna gra walki kasuje bufor przy złym wejściu; to jest stan porażki
i łamie regułę nadrzędną. Tutaj żadna pieczęć nie jest „zła" — każda zapłaciła
swoje 10% i dała swój własny efekt, więc nic nie przepada. Nieudana próba kombo
to po prostu kilka ładnych błysków.

Technika odpala się **gratis**, jako nagroda za ułożenie. Składowe już zapłaciły.

Dwa kombosy w v1:

| Sekwencja | Technika | Efekt |
|---|---|---|
| `perun → mokosz` | **Grom w Ziemię** | rozbłysk i fala rozchodząca się od stóp |
| `mokosz → weles` | **Zew Podziemia** | aura ciemnieje i wciąga, mgła u dołu kadru |

Zakres v1 to **3 pieczęcie i 2 kombosy**. Zadaniem tej warstwy jest udowodnić, że
mechanika kombosów działa, a nie dostarczyć listę technik.

## 9. Testy

Nowe znaki dostają testy na syntetycznych landmarkach w stylu
`tools/test-znaki.mjs`, wpięte w `tools/test-wszystko.sh` (skrypt zbiera
`test-*.mjs` automatycznie, więc wystarczy nazewnictwo).

Obowiązkowe przypadki:

- **Rozdzielność** — żadna z trzech postaw nie zapala pozostałych dwóch.
- **Ciągłość** — wynik znaku jest ciągłą rampą 0..1, nie progiem tak/nie. Próg
  jest w `pieczecie.js`, nie w znakach.
- **Bramka widoczności** — punkt z `visibility < 0.5` daje wynik 0, a nie śmieć.
- **Lustrzaność** — postawa i jej odbicie lustrzane dają ten sam wynik.
- **Zamrożenie zaniku** — moc nie spada podczas składania pieczęci.
- **Bramka mocy** — poniżej kosztu pierścień nie rusza; po złożeniu moc spada
  dokładnie o koszt.
- **Bufor kombo** — pieczęć spoza sekwencji nie czyści bufora; bufor wygasa po
  oknie czasowym.
- **Odporność na NaN** — jedna klatka z NaN nie zatruwa stanu na stałe
  (precedens: `motionMeter.js:176-179`).

Testy **nie zastępują** sprawdzenia na żywym ciele (GEMINI.md §6). Wejściem gry
jest strumień z kamery.

## 10. Wszystkie liczby są prowizoryczne

Próg postawy, czas trzymania (~0,5 s), sufit czasu składania, koszt (10%), okno
kombo (~4 s), stała wygładzania aury — **wszystkie zgadnięte i wymagające
potwierdzenia na żywym ciele.**

Precedens: `PROG_SZARPNIECIA` został wyprowadzony z sygnałów syntetycznych i
GEMINI.md §6 nadal odnotowuje, że wymaga potwierdzenia. Te liczby mają być
opisane w kodzie tak samo — jako zgadnięte, ze wskazaniem, z czego je stroić
(nakładka debug, klawisz `D`).

Nakładka debug dostaje nowe pola: wynik każdej postawy, stan napełnienia
pierścienia, zawartość bufora kombo.
