# Okadzenie — technika dymu (Swaróg → Stribog → Swaróg)

## Kontekst

Gracz-szaman po złożeniu combo i przyłożeniu dłoni do ust „wydmuchuje" kłęby dymu, które
unoszą się po ekranie przez ~2 min. Potencjał trwa 4 min od combo; dłoń przy ustach włącza
strumień, opuszczenie go wstrzymuje. Dym podpalony przez dowolną technikę ognia (dziś:
Płonący Palec) wybucha frontem ognia kłąb po kłębie i znika.

Decyzje z burzy mózgów (2026-09-11):
- Sekwencja **swaróg → stribog → swaróg**, id `dym`, nazwa **„Okadzenie"**.
- Zapłon od **każdej techniki ognia teraz i w przyszłości** — pull-based lista `zarzewia`.
- Detonacja: **front kłąb po kłębie**, kula ognia + wstrząs.
- Gest: **sama dłoń przy ustach** (bez wykrywania zgięcia palca), duża tolerancja.
- Fizyka: unoszenie + turbulencja + rozrost, **dłonie rozgarniają dym**; kłąb ma być na
  ekranie na tyle długo, żeby gracz zdążył złożyć Grom w Ogniu.
- **ZMIANA (2026-09-11, w trakcie implementacji):** dym NIE wylatuje górą po 50–70 s.
  Zamiast tego kłęby gromadzą się na całym ekranie, głównie **pod sufitem** (unoszenie
  słabnie, gdy kłąb zbliża się do góry ekranu, więc zamiast uciekać - rozlewa się na
  boki, jak dym uderzający o sufit). Życie pojedynczego kłębu ~200–260 s (docelowo ~4 min,
  ten sam rząd wielkości co zegar potencjału), zanik alfy dopiero w ostatniej ćwiartce
  życia - kłąb blednie i znika BLISKO końca swojego żywota, nie wcześniej.
- **Jeden zegar 4 min od combo** (bez osobnego okna aktywacji — spójne z Płonącym Palcem,
  „licznik to presja").
- Tekstury ognia/eksplozji: **pobrać z kenney.nl** (Particle Pack, CC0).

Rozstrzygnięcia niewypowiedziane wprost przez użytkownika, przyjęte w projekcie:
- **Inne combo gasi tylko PRODUKCJĘ; wydmuchane kłęby żyją dalej.** Bez tego nie ma drogi do
  nagrody: podpalenie wymaga Gromu w Ogniu, czyli „innego combo".
- Opuszczenie dłoni **wstrzymuje** technikę (celowa różnica wobec Płonącego Palca, gdzie
  schowanie palca KOŃCZY) — zapisać w komentarzu nagłówkowym, żeby nikt tego „nie poprawił".
- Grubość strumienia skaluje się z `moc`, ale pobór ≈ 0 i wyczerpanie mocy NIGDY nie kończy
  potencjału (gracz potrzebuje mocy na Grom w Ogniu; głodzenie 4-minutowego zegara to stan
  porażki).
- Łańcuch **swaróg→stribog→swaróg→perun** daje Okadzenie, a zaraz Grom w Ogniu (bufor kombosów
  nie jest czyszczony) — to cecha, objęta testem.

## Architektura (wzorzec Płonący Palec / Ogień)

```
pieczęć → KomboSilnik → main.js: uzbraja 'dym' → dmuchanie.uzbrój(now)
pose (usta 9/10, nadgarstki 15/16) → dmuchanie.update(frame, moc, dt) → { zaczep(px), sila }
                                                                      ↓
zarzewia (px) ← plonacyPalec.zaczep + ogien.czastki      dym.emituj(zaczep, kierunek, sila, dt)
                          ↓                                dym.rozgarnij(nadgarstkiPx)
                     dym.podpal(zarzewia) → front → eksplozje → ekran.uderz, playWybuchSFX
                                             dym.updateAndDraw(ctx, dt)   (source-over, po aurze)
```

### `js/dmuchanie.js` (nowy) — technika, nie rysuje
- Stany: `BEZCZYNNY → GOTOWY (uzbrój) → DMUCHA ⇄ GOTOWY` (dłoń przy ustach / opuszczona);
  `wygas()` po 4 min od uzbrojenia (`CZAS_POTENCJALU_MS = 240000`) albo `anuluj()` przy innym
  combo. Wystawia: `stan`, `zaczep` (usta, znormalizowane 0..1 jak `plonacyPalec.zaczep`),
  `kierunek` (od dłoni, jednostkowy), `sila` 0..1, `pozostalo` (s, do HUD).
- Gest: `styk(wl, NADG, USTA, skala, pelny, zero)` — ale usta to średnia 9/10, więc
  potrzebna wersja przyjmująca punkt, nie indeks: dodać do `js/znaki/styk.js` małą
  `stykPunktow(a, b, skala, pelny, zero)` reużywaną przez `styk()`. Odległość w METRACH
  (worldLandmarks są metryczne, więc niezależne od gracza): pełny ≤ 0,10 m, zero ≥ 0,28 m —
  ZGADNIĘTE, oznaczone w komentarzu, do strojenia z nakładki (klawisz D).
- Lepsza z dwóch rąk; bramka `visibility` jak `PROG_WIDOCZNOSCI_BARKU` w `plonacyPalec.js`.
  Kotwica ust trzyma ostatnią widoczną pozycję gdy dłoń ją zasłania; fallback nos (0).
- Histereza/attack-release na `sila`, żeby dłoń na granicy progu nie „jąkała" strumienia.
- Nie zna tekstur ani `ctx`.

### `js/dym.js` (nowy) — kłęby, rysowanie, zapłon
- Kłąb: `{x, y, vx, vy, r, obrot, wobrot, wiek, zycie, faza, stan: 'DYM'|'ZAPLON'|'WYBUCH', tZaplonu, sprite}`.
  Jeden teksturowany quad na kłąb (nie sub-emiter). Sprite z `MANIFEST.mgla`
  (`smoke_01/05/08/10`) przez `losowyWariant` + `wypalTintowany` (jasna szarość).
- `emituj(zaczepPx, kierunek, sila, dt)` — emisja ciągła z ułamkowym przeniesieniem jak
  `ogien.js::_nadwyzka`; impuls od ust w kierunku od dłoni, hamowanie.
- `_ruszaj(dt)` (czysta, testowalna, dt przycięte do 0.05): unoszenie SŁABNĄCE z wysokością
  (kłąb zwalnia, zbliżając się do sufitu ekranu, i rozlewa się na boki zamiast uciekać poza
  kadr), turbulencja z sumy sinusów (faza per kłąb), rozrost `r`, zanik alfy dopiero
  w OSTATNIEJ ĆWIARTCE życia; `zycie ≈ 200–260 s` (ok. 4 min, ZMIANA 2026-09-11 - patrz
  Kontekst); usuwa NaN.
- `rozgarnij([{x, y, vx, vy}])` — nadgarstki w px z prędkością pchają kłęby w promieniu
  (skala = szerokość barków px, jak `kregSylwetki()` w `kolowrot.js`).
- `podpal(zarzewia)` — kłąb `DYM` w zasięgu `{x,y,r}` → `ZAPLON`; front: kłąb `ZAPLON`
  po `OPOZNIENIE_FRONTU_MS ≈ 80` zapala sąsiadów `DYM` w promieniu `k·r`; po `CZAS_ZAPLONU`
  → `WYBUCH` (kula ognia, ~0.4 s) → usunięty. Zwraca liczbę kłębów, które w tej klatce
  weszły w `WYBUCH` (main.js skaluje `ekran.uderz` i dźwięk).
- Sufit `MAX_KLEBOW ≈ 150`, najstarsze wypadają.
- Rysowanie: kłęby `DYM` w **`source-over`** (addytywne `lighter` zjada szary dym —
  pułapka udokumentowana w `efekty.js:206-216` i nagłówku `ogien.js`); `ZAPLON` przełącza na
  `lighter` z **4–5 wstępnie wypalonymi stopniami** ciepłego tintu (snap do najbliższego —
  cache `wypalTintowany` jest nieograniczonym Map, tint co klatkę by go rozsadził);
  `WYBUCH` = rdzeń `fire_*`/`flame_*` + błysk `scorch_*` z `MANIFEST`.
- Zegar liczy się przed strażnikiem `!ctx` (konwencja `kolowrot.js:354`, `ekran.js:136`).

### `js/assety.js`
- Rozszerzyć `MANIFEST` o `plomien: [flame_01..06]`, `ogienRdzen: [fire_01, fire_02]`,
  `rozblyskUderzenia: [scorch_01..03]`. Pliki dograć do `assets/czastki/` z
  https://kenney.nl/assets/particle-pack (CC0; `LICENSE.txt` już leży w katalogu).

### `js/kombosy.js`
- Wiersz `{ id: 'dym', nazwa: 'Okadzenie', sekwencja: ['swarog','stribog','swarog'], uzbraja: 'dym' }`
  z komentarzem o łańcuchu z Gromem w Ogniu.

### `js/efekty.js`
- Wiersz `TABELA.dym` (krótki błysk uzbrojenia w szarości/bieli, kształt `mglaIMrok` lub
  `pierscien`). `efekty.js` NIE rośnie o logikę dymu (spec Płonącego Palca).

### `js/main.js`
- `BARWA_ZAPLONU.dym` (szarobiały); gałąź `uzbraja === 'dym'` → `dmuchanie.uzbrój(now)`;
  każde inne combo → `dmuchanie.anuluj()`.
- Po `aura.updateAndDraw`, przed `efekty.updateAndDraw`: `dym.updateAndDraw(ctx, dt)`.
- Po `plonacyPalec.update`: `dmuchanie.update(frame, moc, dt)`; gdy `DMUCHA` →
  `dym.emituj(zaczepPx, kierunek, sila, dt)` (konwersja jak `main.js:556-558`).
- `zarzewia`: czubek palca (`plonacyPalec.zaczep`→px, `r` z `sila`) + próbka `ogien.czastki`
  (co n-ta, są już w px). `const wybuchy = dym.podpal(zarzewia)`; `if (wybuchy)`
  `ekran.uderz(min(1, 0.3 + 0.1·wybuchy))`, `audioEngine.playWybuchSFX(...)`.
- `dym.rozgarnij(nadgarstki px z pose.landmarks 15/16 + prędkość z poprzedniej klatki)`.
- Panel debug (`main.js:~647`): `dym: { stan, sila, pozostalo, klebow, plonacych }`.

### `js/audioEngine.js`
- `playWybuchSFX(sila)` — jeden strzał (szum + niski sinus z opadającą obwiednią), wzorzec
  `playGromSFX`. Opcjonalnie cichy szum „wydechu" sterowany z `dmuchanie.sila`.

### `GEMINI.md`
- Tabela plików: `dmuchanie.js`, `dym.js`; diagram bez zmian poza dopiskiem o `zarzewia`.

## Kolejność wdrożenia

0. Zapisać ten projekt jako `docs/superpowers/specs/2026-09-11-okadzenie-dym-design.md`
   (plan mode nie pozwolił tego zrobić w burzy mózgów), commit.
1. Assety: pobrać paczkę, skopiować `flame_01-06`, `fire_01-02`, `scorch_01-03`, rozszerzyć
   `MANIFEST`; `tools/test-assety.mjs` sprawdza obecność.
2. `kombosy.js` + `tools/test-kombosy.mjs`: sam dym; dym→perun daje Grom w Ogniu; dym nie
   trafia w Tęczę/Aard po drodze.
3. `znaki/styk.js::stykPunktow` + `dmuchanie.js` + `tools/test-dmuchanie.mjs` (fixtury klatek
   jak `test-plonacy-palec.mjs:24-58` z punktami ust/nadgarstka).
4. `dym.js` fizyka + `tools/test-dym.mjs` (bez canvasu, `_ruszaj`/`podpal` czysto).
5. `dym.js` rysowanie, `main.js` spięcie, `efekty`, `BARWA_ZAPLONU`, audio, HUD, GEMINI.md.
6. Test na kamerze → strojenie progu ust, prędkości unoszenia, tempa frontu (użytkownik
   zgłasza poprawki krótko, oczekuje chirurgicznych edycji — patrz pamięć o iteracji VFX).

## Weryfikacja

- `tools/test-wszystko.sh` zielony (nowe `test-dmuchanie.mjs`, `test-dym.mjs` wchodzą przez glob).
- Testy do nazwania: wygaśnięcie po 240 s; dłoń opuszczona wstrzymuje, nie kończy; `anuluj()`
  zatrzymuje produkcję, kłęby zostają; front dochodzi do połączonego łańcucha i omija oderwane
  skupisko; sufit wypycha najstarsze; NaN w klatce nie zatruwa kłębów; kłąb zwalnia unoszenie
  blisko góry ekranu zamiast go opuszczać; zanik alfy zaczyna się dopiero w ostatniej
  ćwiartce życia (blisko 4 min), nie wcześniej; brak boolean w miejscu wyniku gestu.
- Na żywo (`run`/kamera): Swaróg→Stribog→Swaróg, dłoń do ust → dym z ust w stronę od dłoni;
  opuść dłoń → strumień gaśnie, podnieś → wraca; Perun → Grom w Ogniu, palec w górę, dotknij
  kłębu → front biegnie, kule ognia, wstrząs; po wybuchu dym znika; nic nie migocze na granicy
  progu; FPS przy 150 kłębach nie spada poniżej 30.

---

## v2 (2026-09-11) — diagnoza po teście na kamerze i przebudowa dymu

**Zgłoszenie:** „dym to nieżywe tekstury, zdecydowanie za mało, gracz ma w 4 min spokojnie
okadzić cały ekran — wystrzeliwać kłęby z ust strumieniem w kierunku zależnym od pozycji
(głowa/ręka/palce), które potem zaczynają się kłębić; jak przy vapowaniu".

**Diagnoza v1 (nazwane przyczyny):**
1. jeden sprite na kłąb, obrót ±0,075 rad/s (niewidoczny), turbulencja ~19 px/s² — bilbord
   sunący w górę; żywy dym to ruch WEWNĘTRZNY;
2. emisja to kapanie 6/s z prędkością 40–80 px/s — nie było WYDECHU, tylko balon
   nadmuchiwany w miejscu;
3. rozrost sprzężony z ~4-minutowym życiem (pełny rozmiar po 2 minutach) — przez pierwszą
   minutę każdy kłąb to plamka, stąd „za mało";
4. kierunek z zaszumionego wektora nadgarstek→usta;
5. sufit 180 i za mała alfa łączna.

**Przebudowa (`js/dym.js`, `js/dmuchanie.js`):**
- Dwie populacje: `strumien` (wystrzał 550–900 px/s w stożku ±14°, opór 2,6/s → zatrzymuje
  się po ~210–350 px, żyje 1,6–2,6 s, alfa 0,65) i `klab` (rodzi się razem z wydechem, z
  ujemnym wiekiem 0,6–1,2 s, tam gdzie strumień zwalnia; życie 200–260 s; rozrost
  1−exp(−t/9 s), 90% po ~21 s; alfa 0,32).
- Wydech pulsowany: okres 1,35 s, faza aktywna 0,5 s (sin²), ~90 sprite'ów/s strumienia
  w szczycie + 4 kłęby na wydech. Przerwa w dmuchaniu zeruje fazę.
- Ruch wewnętrzny kłębów: pole przepływu zależne od pozycji i czasu (spójne wiry, dryf
  ~20 px/s), obrót 0,15–0,35 rad/s (sąsiedzi przeciwbieżnie), oddech skali ±5%, migotanie
  alfy ±8%.
- Kierunek wydechu: 60% głowa (skręt nosa względem środka OCZU 2/5, ×2,5; skos w górę −0,3
  + pochylenie z baseline „nos 0,7 rozstawu oczu pod ich linią"), 40% dłoń (usta − nadgarstek),
  EMA τ=0,25 s. Oczy, nie uszy: przy skręcie głowy dalsze ucho znika i traci visibility, więc
  sygnał gasłby dokładnie wtedy, gdy gracz celuje. Palce celowo nie (kamera gubi je przy
  twarzy). HUD pokazuje surowy skręt/pochylenie do strojenia.
- Warstwa: dym rysowany PO zapłonie sylwetki, PRZED efektami i ogniem (ogień bloomuje nad
  dymem; gracz widzi płonący palec, którym celuje). Zarzewia są przez to z poprzedniej
  klatki - niezauważalne.
- Sufity 450 kłębów + 300 strumienia (osobne FIFO). Budżet fill-rate do sprawdzenia na HUD.

## v3 (2026-09-11) — ciągły strumień z płuc i malowanie dymem

**Zgłoszenie po drugim teście:** wybuch i ogólny wygląd OK, ale okadzanie „to kółka
wypuszczane". Ma być **jednolity, CIĄGŁY strumień wypychany z płuc** — dopóki dłoń jest przy
ustach albo nie minie 4 min; wystrzeliwany już z ust, a po ~1/4 ekranu siła wypchnięcia
„rozpuszcza się" i dym zaczyna się kłębić i lecieć w górę. Gracz ma móc **malować wzory linią
dymu**; wzór ulotny — rozpływa się w chmurę po ~10 s.

**Diagnoza „kółek" (v2):**
1. emisja pulsowana (sin² 0,5 s co 1,35 s) — kolejne wystrzały to z definicji osobne obłoczki;
2. dwie populacje rodziły się w **różnych miejscach** (strumień przy ustach, kłąb 0,11–0,18 W
   dalej, z ujemnym wiekiem) — kłąb „pojawiał się" jako osobne koło, nie wyrastał ze strumienia;
3. za rzadko i za szeroko: 90/s tylko w szczycie obwiedni (średnio ~17/s) w stożku ±14°;
4. brak interpolacji między klatkami — wszystkie sprite'y klatki w jednym punkcie, więc ruch
   głowy zostawiał przerwy.

**Przebudowa (`js/dym.js`):**
- **Jedna fizyka, dwa czasy życia.** Każda cząstka rodzi się w ustach, z tą samą prędkością
  wylotu (0,60–0,80 W/s × (0,7 + 0,3·siła) × oddech) i tą samą fizyką. `typ` decyduje tylko o
  życiu, promieniu docelowym i alfie: `strumien` (wstęga, życie 6–12 s, r → 0,035–0,045 W,
  alfa 0,55), `klab` (co `KLAB_CO = 32`-ta cząstka, życie 200–260 s, r → 0,075–0,10 W).
- **Opór mieszany wagą wylotu** `exp(−wiek/0,8 s)`: `4,0/s` dla świeżej cząstki → `0,6/s` dla
  starej. Jeden wektor prędkości, więc `rozgarnij()` i pole przepływu **zawsze** mają opór
  (machnięcie dłonią nie wstrzykuje prędkości, która nigdy nie gaśnie). Zasięg wylotu 0,15–0,26 W
  po 3 s (stałe dobrane numerycznie, test pilnuje przedziału).
- **Emisja ciągła**: 90 sprite'ów/s × (0,7 + 0,3·siła) × oddech (1 ± 0,15 przy 0,3 Hz, nigdy do
  zera), stożek ±5°. Usunięte: `Dym.wydech`, okres/faza wydechu, opóźniony start kłębu.
- **Malowanie**: cząstki klatki rodzą się rozłożone wzdłuż odcinka usta(poprzednia klatka) →
  usta(teraz). Dym **nie dziedziczy** prędkości ust — zostaje tam, gdzie wydmuchany, więc ruch
  głowy rysuje linię. Przerwa w dmuchaniu urywa odcinek.
- **Alfa kłębu cienieje z rozrostem** (0,55 → 0,30 po postępie `r`) — gęsty w kolumnie, rzadki
  jako chmura; zachowanie „masy".
- Sufity: 900 wstęgi + 600 kłębów (liczniki trzymane przyrostowo, bez skanu tablicy przy
  ~1,5 dodania na klatkę). Wstęga wybucha bez sprite'a rozbłysku (setki cząstek naraz).
- `js/main.js`: dźwięk detonacji **dławiony** do 1 na 120 ms z sumowaniem — front biegnący przez
  świeżą kolumnę detonuje kilkanaście klatek z rzędu.

**Kompromis do świadomej decyzji:** linia trzyma ~10 s (życzenie „szybko w chmurę"), po czym
zostaje po niej **rzadki ślad kłębów (~2,8/s), nie kształt**. Jeśli wzór ma zostać czytelny
dłużej — `KLAB_CO` w dół (32 → 8) i `MAX_STRUMIENIA` w dół (budżet fill-rate).

## v4 (2026-09-11) — wstęga zamiast sprite'ów, cztery strony świata

**Zgłoszenie po trzecim teście:** „ciągle wykorzystujesz tę teksturę kółka. Wypuszczana linia
powinna być stała i dopiero przez umiejętne zataczanie okręgów tworzyć kółka. Musisz odejść od
tej tekstury. Ponadto dym powinien móc być wypuszczony w cztery strony świata, mocno w boki
i w dół, a nie od razu lecieć w górę. Początkowa siła kierunku powinna zależeć od ustawienia
gracza." Decyzje z pytań: kreska **zmienna** (cienka przy ustach, grubsza dalej), siła
z **wyrazistości ustawienia**, kształt trzyma pozycję **~8 s**.

**Diagnoza:**
1. **Rysowanie.** `drawImage(MANIFEST.mgla[...])` na cząstkę — okrągła tekstura. Cząstki
   sąsiadowały w czasie, ale nic ich nie łączyło: rzadziej = paciorki, gęściej = pasmo kółek.
   Żadna liczba ani rozmiar sprite'ów tego nie zmieni — trzeba rysować **kreskę**.
2. **Kierunek.** `SKOS_W_GORE = −0,3` plus pół wagi na pochylenie głowy → składowa Y nigdy
   nie była dodatnia, więc **w dół dmuchnąć się nie dało**.
3. **Wyporność.** Waga `1 − exp(−wiek/0,8 s)` — po ~1 s wszystko płynęło w górę.
4. **Siła.** `gest × moc` nie miała nic wspólnego z ustawieniem gracza.

**Przebudowa:**
- **Węzły wstęgi zamiast cząstek** (`js/dym.js`). Węzeł ma to, co miała cząstka, ale należy do
  wstęgi; rysowane są **odcinki** między kolejnymi węzłami (`stroke`, `lineCap/lineJoin: round`)
  w **pięciu przebiegach** (szeroka poświata → wąski rdzeń) na płótnie **1/3 rozdzielczości**,
  składanym jednym `drawImage` z `blur(4px)`. Odcinki idą w kubełkach (szerokość × alfa) jako
  `Path2D` — dziesiątki `stroke()` zamiast tysięcy. Zero `MANIFEST.mgla` w dymie; sprite'y
  Kenney zostają **wyłącznie** przy zapłonie i wybuchu.
- `r` to **połowa szerokości**: 0,008 W przy ustach → 0,030–0,042 W (τ 15 s). Alfa cienieje
  z szerokością (0,42 → 0,14). Szerokość ma szum per-węzeł (±25%) — kreska nie jest rurką.
- **Wariancja per WSTĘGA, nie per węzeł** (prędkość, faza, szerokość docelowa): losowanie
  prędkości per węzeł powodowało, że po sekundzie szybszy wyprzedzał wolniejszego, kolejność
  w kresce się odwracała i wstęga zygzakowała.
- **Co najmniej jeden węzeł na klatkę emisji** (nadwyżka bywa ujemna) — klatka bez węzła
  podwajała odstęp i kreska ścinała zakręty.
- **Cztery strony świata** (`js/dmuchanie.js`): `SKOS_W_GORE` usunięty, `y = −pochylenie`
  z pełnym wzmocnieniem. Głowa opuszczona → dym w dół, uniesiona → w górę, skręcona → w bok.
- **Wyporność opóźniona**: waga `1 − exp(−wiek/8 s)` — kształt trzyma pozycję ~8 s, dym
  wypuszczony w dół naprawdę leci w dół.
- **`wyrazistosc`** = długość zblendowanego wektora głowa+dłoń **przed** normalizacją, wygładzona
  tą samą EMA co kierunek. Skaluje prędkość wylotu (podłoga 0,35): zdecydowane wycelowanie →
  strumień sięga ~0,32 W, poza nijaka → ~0,19 W. EMA liczona na wektorze **nieznormalizowanym**:
  normalizacja co klatkę zacinała obrót o 180° wzdłuż osi.
- **Ogień**: front biegnie **wzdłuż wstęgi** (sąsiedzi w kresce) + między wstęgami przez siatkę
  kubełkową budowaną tylko w klatkach rozprzestrzeniania (O(n²) przy 5000 węzłów odpadło).
  Płonąca kreska rysowana tymi samymi wielokrotnymi przebiegami; sprite wybuchu co 6. węzeł.
  Wybuch **przepala kreskę** (`przerwa` na następnym węźle). Przerzedzanie nigdy nie usuwa
  płonącego węzła.

**Zmierzone w przeglądarce** (1920×1080): 100 s ciągłego dmuchania → 2748 węzłów, rysowanie
3,2 ms/klatkę, fizyka 0,3 ms; detonacja całej chmury: najgorsza klatka 14,7 ms.

## v5 (2026-09-11) — kolumna, która rozpada się w chmurę

**Zgłoszenie po czwartym teście:** „kolumny utrzymują się za długo, to nie wygląda naturalnie.
Najpierw powinna być kolumna z mocą wydychania, ale potem powinno przypominać bardziej chmurę,
tak jak w poprzedniej wersji z teksturami." Decyzje z pytań: kolumna trzyma **~1,5 s**,
malowanie kształtów **odpada** (naturalny dym ważniejszy).

**Diagnoza:** wszystko, co v4 dodało dla *ciągłości* kreski, trzymało ją spójną **na zawsze** —
wspólna prędkość i faza całej wstęgi (celowo, bo losowanie per węzeł dawało zygzak), pole
przepływu przesuwające sąsiadów tak samo, odcinek rysowany niezależnie od wieku, rozrost
rozciągnięty na 35 s. Brakowało **fazy rozpadu**: kolumna i chmura to nie dwa dymy, tylko dwa
etapy życia tego samego węzła.

**Przebudowa — jedna liczba `spojnosc(wiek)`** (1 przez `KOLUMNA_S = 1,5 s`, potem
`exp(−t/1,2 s)`) steruje naraz:
- **rysowaniem** — odcinek kreski z alfą `× spojnosc`, tekstura kłębu (`MANIFEST.mgla`,
  ciepło/chłodno tintowana przez `wypalTintowany`) z alfą `× (1 − spojnosc)`. Tekstury **wracają**,
  ale wyłącznie w fazie chmury: to była dobra tekstura w złej roli — jako *cała* technika dawała
  „kółka", jako *rozpad kolumny* daje kłębienie. Wszystko na płótnie 1/3 z jednym `blur(6px)`.
- **fizyką** — własny wektor rozbieżności węzła (±0,035 W/s) i pole przepływu z *własną* fazą
  wchodzą z wagą `(1 − spojnosc)`: w kolumnie nic nie psuje kreski, w rozpadzie sąsiedzi
  rozchodzą się i wstęga pęka na kłęby (zmierzone: rozrzut kierunków 0,1° → 175°, odstęp
  sąsiadów 14 → 302 px).
- Kłąb dorasta **szybko i grubo**: `rCel` 0,055–0,075 W, `ROZROST_TAU_S` 15 s → 4 s.

**Poprawki znalezione dopiero na renderach (nie w testach):**
- Odcinek rysowany tylko gdy sąsiedzi są bliżej niż `(r1 + r2) × 1,5` (`polaczone()`) — w fazie
  chmury kreska łączyła punkty oddalone o setki pikseli.
- Płonący węzeł czyta tę samą oś czasu: w kolumnie jest odcinkiem, w chmurze płonącym kłębem.
  Bez tego detonacja rysowała przez ekran wielkie żółte belki.
- Szerokie przebiegi ognia idą `source-over`, tylko wąski rdzeń addytywnie; przy 1800 płonących
  węzłach same addytywne dawały **średnią jasność klatki 255/255** (biały ekran).
- Sufit kul ognia (`MAX_SPRITE_WYBUCHU = 110`, krok liczony z liczby wybuchających) i sufit ich
  promienia (0,06 W).
- Front zwolniony: `FRONT_PROMIEN_MNOZNIK` 2,0 → 0,8, `OPOZNIENIE_FRONTU_S` 0,15 → 0,25 s —
  przy kłębach 0,07 W poprzednie wartości zapalały cały ekran w ⅓ sekundy.

**Zmierzone w przeglądarce** (1920×1080): 2 min ciągłego dmuchania → rysowanie 2,4 ms/klatkę,
fizyka 0,24 ms; detonacja całego zasnutego ekranu: najgorsza klatka 12,9 ms, szczyt jasności
196/255 zamiast 255.

## v6 (2026-09-11) — kółka dymu ładowane trzymaniem dłoni

**Nowy pomysł właściciela gry:** „chcę, żeby wypuszczane były kółka i w zależności jak długo
przytrzyma się rękę przy ustach, tym większe kółko wychodzi. Maksymalnie trzymanie 3 s daje
bardzo duże kółko, powiedzmy na 1/3 ekranu. Szybkie przykładanie i od razu odsuwanie palców daje
normalne kółka. Kółka i tak dalej kłębią się po wypuszczeniu." Z pytań: podczas ładowania
**cienka smużka + licznik na HUD**; kółko leci **~pół ekranu, większe wolniej**; ciągły strumień
**znika**.

**Kluczowa obserwacja:** kółko to **wstęga zamknięta w okrąg**, więc cała maszyneria v4/v5
zostaje bez zmian — odcinki rysują obwód, `spojnosc()` rozkłębia kółko w chmurę, front ognia
biegnie dookoła obwodu. Nowe jest tylko: układ węzłów na okręgu, ekspansja w locie i to, że
większe kółko leci wolniej.

**Mechanika (`js/dmuchanie.js`):** stan `DMUCHA` znaczy teraz ŁADOWANIE. `update()` zwraca
`{ pobor, wypuszczenie }`; `wypuszczenie` niepuste **tylko w klatce cofnięcia dłoni** (wzorzec
`js/podmuch.js`). `ladunek = min(1, trzymanieS / 3 s)`, z podłogą `LADUNEK_MIN = 0,12` — reguła
„nic nigdy nie mówi źle": nawet błyskawiczne przyłożenie coś wypuszcza. Naładowane kółko nie
przepada: wypuszcza je też `anuluj()` (inne combo) i wygaśnięcie zegara 4 min.

**Kółko (`js/dym.js::wypusc`):** promień `0,035 W … 0,165 W` z ładunku (średnica ≈ 1/3 ekranu
przy pełnym); liczba węzłów ze stałego odstępu na obwodzie (24–160); środek **przed ustami o R**,
żeby kółko wyleciało z ust, a nie otoczyło głowy; prędkość `KOLKO_V_W_S × wyrazistość ×
(1 − 0,55·ładunek)` — **większe leci wolniej**; ekspansja jako **ułamek promienia** na sekundę
(stała w px rozdymała małe kółka dwukrotnie, a dużych nie ruszała).

**Smużka ładowania (`smuz`)** — kilka węzłów/s przy ustach, życie 2,5 s, cieńsza kreska.

**Poprawki znalezione na renderach:**
- Płonący węzeł rysowany **teksturą w ciepłym tincie**, nie odcinkiem: w fazie chmury sąsiedzi są
  daleko, a kreska szeroka, więc `stroke` czytał się jak grube brązowe kiełbasy przez ekran.
  Przy okazji najgorsza klatka detonacji spadła z 20,6 ms do 4,8 ms.
- Front musi obiegać **domknięcie pętli** (sąsiadem zerowego węzła jest ostatni), inaczej ogień
  zatrzymywał się na szwie kółka.

**Zmierzone w przeglądarce** (1920×1080): 60 kółek co 2 s (2 min gry) → 1133 węzły, rysowanie
0,84 ms/klatkę, fizyka 0,1 ms; detonacja: najgorsza klatka 4,8 ms.

## v7 (2026-09-11) — silnik smoke.js, ciągły wydech, dym reagujący na taniec

**Zgłoszenie:** po sześciu podejściach „efekt wciąż mnie nie zachwyca". Dym ma być **wypuszczany
ciągiem, naturalny, z początkową siłą kierunku**, a właściciel gry wskazał gotową bibliotekę:
[smoke.js](https://github.com/bijection/smoke.js) (MIT, 5,5 KB, bez zależności). Z pytań: życie
dymu **20–40 s**, dodatkowo **dym reaguje na ręce i taniec**.

**Czego uczy biblioteka (przeczytany kod, nie opis):** cały jej urok siedzi w liczbach, których
w v2–v6 ani razu nie wypróbowałem — alfa cząstki **max 0,125** (u mnie 0,30–0,55), sprite 20 px
skalowany **×25–30** = 500–600 px (u mnie 70–290), wzrost `sqrt(age/lifetime)`, życie 2–8 s,
i jeden ręcznie zrobiony, **szumiący** sprite. Czyli: ogromne, ledwo widoczne kłęby, których dużo
się nakłada. Moje wersje były za małe, za gęste i za długowieczne — stąd „plastikowość".

**Podział pracy:** `js/vendor/smoke.js` (kopia 1:1, cztery ponumerowane zmiany: root UMD
`this`→`globalThis`, `export default`, `window` z fallbackiem, usunięty `console.log` ze `step()`)
daje sprite, cykl życia cząstki i rysowanie. `js/dym.js` daje wszystko, co jest **grą**: kierunek
i początkową siłę wydechu (`addsmoke` przyjmuje `min/maxVx`, `min/maxVy` per wywołanie), opór,
wyporność opóźnioną (dym w dół leci w dół), pole przepływu, reakcję na ręce, stany ognia, front
i detonację. Wpięcie przez `setPreDrawCallback(dt, cząstki)` — tablica cząstek co klatkę.

**Trzy rzeczy, których nie dało się przewidzieć bez czytania kodu biblioteki:**
1. `updateParticle` **nadpisuje `vy`** co klatkę z `startvy` — nasza wyporność i rozgarnianie
   znikałyby w tej samej klatce. Stąd własne pola `vxGry/vyGry` (źródło prawdy) przepisywane do
   `vx/vy` na końcu callbacku, i `startvy = 0`.
2. `minScale/maxScale` przekazane do `addsmoke` ustawiają **naraz** skalę startową i docelową —
   kłąb rodziłby się od razu wielki. Docelową skalę ustawiamy sami, po dodaniu.
3. Alfa i skala liczą się z `age/lifetime`, więc życie 20–40 s dawało dym **niewidzialny**
   (alfa 0,008 po sekundzie — zmierzone). Zamiast przerabiać bibliotekę **sterujemy jej czasem**:
   `lifetime` zostaje krótki i stały (6 s), a `age` wyliczamy z prawdziwego wieku
   (`wiekBiblioteki`) tak, żeby dojść do szczytu w 0,8 s, trzymać plateau przez większość życia
   i zejść w ostatnich 3 s. Biblioteka usuwa cząstkę dokładnie wtedy, gdy kończy się nasze życie.

**Reakcja na taniec:** `rozgarnij()` dostaje z main.js nadgarstki **i łokcie** (13/14/15/16)
z prędkościami; każda cząstka w promieniu dostaje pchnięcie wzdłuż ruchu **plus składową
styczną** (wir za ręką). Strojone na renderach: przy pierwszych wartościach (0,65/0,55)
machnięcie wywiewało **cały obłok poza ekran** — dziś 0,15/0,22, dym się rozstępuje i wiruje.

**Zmierzone w przeglądarce** (1920×1080): 25 s ciągłego dmuchania → sufit 700 cząstek, pełna
klatka (fizyka + rysowanie + kompozycja) **0,7 ms**; detonacja: najgorsza klatka 18,8 ms.

## v7.1 (2026-09-11) — kolumna przy ustach, kłębienie i rozejście po ekranie

**Zgłoszenie:** dym ma się wydobywać **z początku bardziej kolumnowo, jak mocno wydychany**,
a potem **kłębić na boki i naturalnie rozszerzać praktycznie na cały ekran**. Z pytania: kolumna
wąska przez **~1 s**, długa na **~1/4 ekranu**.

**Diagnoza — trzy rzeczy działały przeciwko temu:**
1. **Rozmiar był sprzężony z alfą.** `wiekBiblioteki()` (poprawka z v7) skacze do połowy
   `lifetime` w 0,8 s, a smoke.js liczy z tego samego `age` NIE TYLKO alfę, ale i skalę — sprite
   miał ~0,7 rozmiaru docelowego już przy ustach. Alfa musi dochodzić do szczytu szybko, więc
   rozmiar trzeba było odsprzęgnąć: `c.scale` nadpisujemy w callbacku (biblioteka rysuje PO nim).
2. **Nic nie rozpychało dymu na boki** — po zgaśnięciu wylotu zostawała tylko wyporność, więc dym
   płynął pod sufit wąskim pasmem.
3. **Sufit cząstek wycinał NAJSTARSZE**, czyli największe i najbardziej rozeszłe — kasował
   dokładnie to, co miało zasnuć ekran.

**Zmiany:**
- `skalaCzastki(wiekGry, finalScale)` — płaska, wąska kolumna (`SKALA_KOLUMNY = 3`, ~60 px
  promienia) przez `KOLUMNA_S = 1 s`, potem rozrost do docelowej ze stałą `TAU_ROZROSTU_S = 5 s`.
- Kolumna ciaśniej i krócej: stożek ±3°, `WYLOT_W_S = 0,6` przy `OPOR = 2,0/s` → zasięg
  ≈ 0,30 W, czyli widoczna struga na ~1/4 ekranu.
- **Rozrzut prędkości wzdłuż kierunku** (0,55–1,35×): bez niego wszystkie cząstki hamowały w tym
  samym miejscu i na końcu strugi robiła się **zbita kulka** (widoczne na renderze) — teraz
  struga przechodzi w wydłużoną, kłębiącą się chmurę.
- Kłębienie i rozejście z wagą `1 − exp(−(wiek − KOLUMNA_S)/4 s)`, więc w kolumnie nie działa
  nic z tego: rozpychanie **w poprzek** kierunku wylotu (znak stały per cząstka), mocniejsze pole
  przepływu (0,004 → 0,012) i rozlew pod sufitem (im wyżej, tym więcej dryfu w bok).
- Gęstsza emisja (45 → 70 cząstek/s) i sufit 700 → **1100**, a `_pilnujSufitu()` wyrzuca teraz
  cząstki **najbliższe końca życia**, nie najstarsze żyjące.

**Zmierzone w przeglądarce** (1920×1080): 40 s ciągłego dmuchania → sufit 1100 cząstek, pełna
klatka **1,89 ms**; detonacja całej chmury: najgorsza klatka 19,2 ms.

## v8 (2026-09-12) — kółko z palców: drugi warunek gestu i regulator intensywności

**Życzenie:** do Okadzenia dochodzi drugi warunek — **palce ułożone w kółko** — a **wielkość
kółka steruje intensywnością** wypuszczanych chmur. Pytanie brzmiało wprost: „jesteś w stanie to
wykryć?".

**Odpowiedź: tak**, MediaPipe Hands daje 21 punktów na dłoń. Z zastrzeżeniem, które trzeba było
powiedzieć od razu: GEMINI.md §4 i nagłówek `js/dmuchanie.js` ostrzegają, że **kamera z jednego
oka gubi palce przy dłoni na twarzy** — właśnie dlatego kierunek wydechu w v2 celowo NIE korzystał
z palców. Stąd pamięć ostatniego odczytu (niżej).

**Wykrywanie (`js/znaki/dlon.js::kolkoPalcow`)** — czysta funkcja, `null` przy braku danych
(brak danych to nie zero):
- `domkniecie` 0..1 — rampa po odległości opuszka kciuka do **najbliższego innego opuszka**,
  w skalach dłoni (nadgarstek→nasada środkowego). Kciuk + dowolny palec, bo to pozwala regulować
  wielkość jednym ruchem: kciuk+wskazujący = małe kółko, kciuk+mały = duże.
- `wielkosc` 0..1 — **pole pętli** (a nie odległość opuszek, która zeruje się przy każdym
  domknięciu i nie odróżniłaby małego kółka od dużego), liczone po **otoczce wypukłej** punktów
  `kciuk 2,3,4 → opuszek → DIP → PIP → nasada`. Otoczka, nie surowy wielokąt: przy kciuku sięgającym
  dalszego palca pętla sama siebie przecina, a wzór szuwaru odejmował wtedy przeciwnie skręconą
  część i kółko kciuk+środkowy wychodziło **mniejsze** niż kciuk+wskazujący.

**Wpięcie (`js/dmuchanie.js`):** gest = `styk(dłoń przy ustach) × domkniecie` — iloczyn dwóch
ciągłych wyników, ta sama histereza co dotąd. Dłoń dopasowana do ręki przy ustach po odległości
nadgarstka dłoni od nadgarstka pozy, więc kółko ułożone drugą, opuszczoną ręką nic nie robi.
**Pamięć ostatniego dobrego odczytu przez 1 s** z liniowo malejącą wagą: zgubiona na chwilę dłoń
nie przerywa dymienia, a po sekundzie intensywność schodzi do podłogi, ale **technika nie gaśnie**.

**Intensywność (`js/dym.js::emituj`)**: nowy parametr skaluje tempo emisji (podłoga 0,3) i rozmiar
docelowy kłębów (×0,8…×2,35). Prędkość wylotu została przy `wyrazistosc` (ustawienie głowy i dłoni),
żeby dwa pokrętła nie robiły tego samego.

**Zmierzone w przeglądarce:** przy tym samym czasie dmuchania małe kółko daje 99 cząstek, duże 210
— i widać to gołym okiem (chmura gęstsza i większa).

**Testy:** nowy `tools/test-kolko.mjs` buduje pętlę **wprost** (opuszki złączone, stawy na okręgu
o zadanym promieniu), bo dłoń syntetyczna z `tools/_dlon-syntetyczna.mjs` ma kciuk jako prosty
łańcuch równoległy do palców — przy dłoni płaskiej jej opuszek kciuka leży 0,32 skali od
wskazującego (na żywej ~1,0) i wychodziło „kółko" tam, gdzie go nie ma.

## v8.1 (2026-09-12) — naprawa: otwarta dłoń fałszywie uruchamiała kółko

**Zgłoszenie z kamery:** „nawet zwykłe machnięcie z otwartej dłoni przy twarzy produkuje dym" —
warunek kółka z v8 nie bramkował niczego.

**Diagnoza, zmierzona na dłoni syntetycznej** (nie zgadnięta):

| układ dłoni | odległość kciuk↔najbliższy opuszek | `domkniecie` (v8) |
|---|---|---|
| płaska, otwarta | 0,32 skali dłoni | **0,77** |
| luźna (palce w pół) | 0,32 | **0,77** |
| pięść | 0,32 | **0,77** |

Próg wejścia gestu to 0,55 — `styk × 0,77` otwierał technikę przy każdym z tych układów.
Przyczyna: rampa `domkniecie` (0,22–0,65 skali) zakładała, że w otwartej dłoni kciuk jest daleko
od pozostałych opuszków; naprawdę leży 0,32–0,54 skali od nich, więc sama odległość **nigdy nie
mówiła „otwarte"**. Do tego nic nie sprawdzało, że palec jest **zgięty** — czyli że pętla w ogóle
istnieje.

**Poprawka (`js/znaki/dlon.js::kolkoPalcow`)** — dwa niezależne warunki (iloczyn):
1. odległość opuszek zwężona do 0,12–0,30 skali (płaska dłoń i pięść, obie ~0,32, spadają poniżej
   progu i dają 0);
2. **zgięcie** (`max(1 − wyprostowany(palec), 1 − wyprostowany(kciuk))`) musi przekraczać próg —
   przy dłoni płaskiej zgięcie wynosi 0,00, przy pięści 1,00 ale bez zamkniętej pętli w konkretnym
   miejscu (dystans nadal wysoki).

Zmierzone po poprawce (ta sama dłoń syntetyczna): płaska **0,000**, luźna **0,000**, pięść
**0,000** — wszystkie trzy fałszywe pozytywy usunięte, prawdziwe kółko (opuszki złożone + palec
zgięty) nadal `domkniecie > 0,8`.

**Dodatkowe zaostrzenia (odpowiedzi na pytania „jak ostro"):**
- `js/dmuchanie.js`: `ZERO_SKALI` 1,2 → **0,7** szerokości barków — dwa niezależne, ciasne warunki
  są odporniejsze niż jeden ciasny (kółko) i jeden luźny (odległość dłoni od ust).
- Po wygaśnięciu pamięci kółka (1 s) `intensywnosc` spada do **zera**, nie do podłogi 0,25 — „nie
  widać kółka" ma oznaczać „nie ma dymu". Podłoga zostaje tylko wtedy, gdy kółko JEST wykryte,
  choćby małe.
- HUD dostał surowe `odleglosc`/`zgiecie` — bez nich strojenie tych dwóch progów na żywej dłoni
  byłoby kolejną rundą zgadywania.

Nowe testy w `tools/test-kolko.mjs` odtwarzają dokładnie zgłoszony przypadek (dłoń płaska
zbudowana wprost, bez pętli) jako regresję.

## v8.2 (2026-09-12) — kółko nigdy się nie zapala (druga strona tego samego błędu)

**Zgłoszenie z kamery:** po v8.1 kółko w ogóle się nie zapala — dym nigdy nie startuje. v8.1
naprawiła fałszywe pozytywy, ale poszła za daleko w drugą stronę.

**Diagnoza, tym razem z nazwaną granicą narzędzia pomiarowego.** Sprawdziłem `kolkoPalcow()` na
`tools/_dlon-syntetyczna.mjs` (prawdziwy łańcuch kinematyczny, nie ręcznie sklejony fixture z
`test-kolko.mjs`) i znalazłem, że **ten model nie potrafi wyprodukować anatomicznie poprawnego
gestu OK**:
- kciuk obrócony w poprzek dłoni, ale nie zgięty w żadnym stawie → `zgiecie = 0,00` — miara
  „prostota = dystans końców / suma odcinków" jest ślepa na **obrót** sztywnego łańcucha, widzi
  tylko jego wewnętrzne wygięcie. Prawdziwy kciuk robi kółko OK głównie przez **odwiedzenie w
  stawie nadgarstkowo-śródręcznym**, nie przez zgięcie paliczków;
- przy kciuku i palcu zgiętych **równo**, dystans opuszków utyka na stałych ~0,32 niezależnie od
  siły zgięcia (0,3/0,3 → 0,32; 0,5/0,5 → 0,32; 0,9/0,9 → 0,32) — model kciuka w generatorze zgina
  się w miejscu jak zwykły palec, nie ma opozycji przenoszącej go w stronę innego palca.

**Wniosek:** próg odległości z v8.1 (0,12–0,30) był kalibrowany na modelu, który nigdy nie
odtworzył realnego domknięcia — czyli nigdy nie był sprawdzony na geometrii, jaką faktycznie da
żywa dłoń. Zgadywanie kolejnej liczby na tym samym modelu powtórzyłoby błąd.

**Decyzja:** zamiast trzeciej rundy zgadywania — jedno przejście z realnymi liczbami z HUD
(`odl`/`zgiecie`, dodane właśnie w v8.1 na tę okazję). Do czasu dostarczenia tych liczb progi w
`js/znaki/dlon.js` zostają jak w v8.1, z dopiskiem w nagłówku `kolkoPalcow()` wprost nazywającym
granicę modelu syntetycznego, żeby kolejna iteracja nie próbowała znowu kalibrować tego samą
metodą.

**Niezależnie od finalnych progów** dodany test **monotoniczności** w `tools/test-kolko.mjs`:
domknięcie musi rosnąć w miarę zbliżania się opuszków, niezależnie od tego, gdzie dokładnie leżą
progi — ten test przetrwa kalibrację i łapie regresje kierunku, nie tylko wartości.

## v8.3 (2026-09-12) — szczyt do odczytu po opuszczeniu ręki

**Zgłoszenie:** poprosiłem o zrzut HUD zrobiony W TRAKCIE gestu (dłoń przy ustach) — użytkownik
słusznie zwrócił uwagę, że to fizycznie niewykonalne: obie ręce zajęte gestem/tańcem, żadna nie
jest wolna do zrobienia zrzutu ekranu w tej samej chwili.

**Zmierzone przy okazji (dane z realnej kamery, nie z dłoni syntetycznej):** gest OK dał
`odl 0.13, zgięcie 0.74 → domknięcie 0.94`; dłoń otwarta `odl 0.85, zgięcie 0.00 → domknięcie
0.00`. **Progi z v8.1/v8.2 są poprawne** — obawa z v8.2 o niewystarczający model syntetyczny nie
przełożyła się na problem z realną anatomią tego użytkownika. Pozostało ustalić, czy problem leży
w dopasowaniu dłoni do ręki przy ustach (`_kolkoZDloni`) — do tego potrzebny był zrzut PO geście.

**Rozwiązanie: SZCZYT** (`js/dmuchanie.js`, `SZCZYT_OKNO_MS = 4000`). `update()` zapamiętuje
najlepszy (najwyższy) wynik `_gest` z ostatnich 4 sekund wraz z towarzyszącymi mu `styk`,
`kolko`, `wielkosc`, `intensywnosc`, `odleglosc`, `zgiecie` — gracz robi gest, opuszcza rękę i
DOPIERO WTEDY, mając obie dłonie wolne, robi zrzut ekranu. HUD dostał osobny wiersz `SZCZYT (4s):
...` obok żywego odczytu. Zegar resetuje się po `SZCZYT_OKNO_MS` bez nowego, lepszego wyniku —
stare dane nie wiszą w nieskończoność jako pozornie aktualne.

Dodatkowo: `dmuchanie.styk` (surowy wynik „dłoń przy ustach" PRZED pomnożeniem przez kółko) jest
teraz wystawiony osobno — pozwala odróżnić „kółko złe" od „dłoń za daleko od ust", gdyby `gest`
mimo wszystko nie osiągał progu.

## v8.4 (2026-09-12) — nowa metoda: odległość segmentu + okrągłość pętli

**Zgłoszenie:** trafna obserwacja — „kropki palców przy geście kółka nie stykają się, są bardzo
blisko, ale nie stykają się". To pasuje do znanej cechy MediaPipe: dwa wzajemnie zasłaniające się
czubki palców to najbardziej niepewny pomiar w całym modelu dłoni; realny kontakt czytany był jako
`odl = 0,13` (nie 0,00) — to fizyka pomiaru, nie błąd progu. Stara metoda opierała kluczowy warunek
na DOKŁADNIE JEDNEJ takiej parze punktów (czubek kciuka ↔ czubek palca).

**Nowa metoda — dwie zmiany w `kolkoPalcow()`:**

1. **Odległość segmentu, nie punktu.** Zamiast jednej pary, liczone jest minimum z **czterech par**
   punktów na końcowych odcinkach obu palców: kciuk {staw IP, czubek} × palec {staw DIP, czubek}.
   Realny kontakt „OK" styka opuszki gdzieś w tym rejonie, nie zawsze dokładnie czubek-w-czubek.
   Celowo bez stawów bliższych (MCP) — to przybliżyłoby wynik do pięści. Nowa miara jest zawsze
   ≤ starej (czubek-czubek to jedna z czterech par), więc dla gestów, które już działały (0,94),
   wynik jest taki sam albo lepszy.

2. **Trzeci warunek: okrągłość pętli**, dodany PO tym, jak test wrogi ujawnił realne ryzyko:
   poszerzenie punktów kontaktu sprawiło, że **pięść z kciukiem na wierzchu zgiętych palców**
   zaczęła fałszywie wychodzić jako domknięte kółko (`domkniecie = 1,00`!). Samo pole pętli nie
   wystarczało do odróżnienia — zmierzone: pięść ma pole porównywalne z MAŁYM, prawdziwym kółkiem
   (0,05 vs 0,02–0,10 dla promieni 0,10–0,18), bo pole naturalnie rośnie z wielkością pętli.
   Rozwiązanie: **okrągłość** (`4π·pole / obwód²`, isoperimetric quotient) jest niezależna od
   skali — zmierzone na całym zakresie promieni (0,10–0,45) i wszystkich czterech palców: prawdziwe
   kółko zawsze daje **0,74–0,84**, ta sama pięść daje **0,15**. Pięciokrotny margines pozwolił
   postawić próg pewnie pośrodku (rampa 0,30–0,55) bez ryzyka dla żadnej wielkości kółka.

**Dodatkowo:** `PAMIEC_KOLKA_S` w `js/dmuchanie.js` 1,0 s → 1,8 s — podczas tańca krótkie
zgubienie precyzyjnego śledzenia palców jest częstsze niż w bezruchu, w którym mierzyliśmy próg.

**Nowe testy w `tools/test-kolko.mjs`:** fixture odtwarzający dokładnie zgłoszoną obserwację
(czubki z widoczną przerwą, stawy IP/DIP blisko) — stara metoda dałaby tu ~0, nowa daje 0,85;
test wrogi na realistyczną pięść (kciuk na wierzchu, blisko stawów DIP) — bez trzeciego warunku
dawał fałszywe 1,00, z nim wraca do ~0,00.

Ta poprawka nie wymagała nowego zbioru danych z kamery: nowa miara odległości jest z definicji
nie gorsza od starej dla gestów już zmierzonych jako działające, a okrągłość została skalibrowana
na w pełni kontrolowanym, mierzalnym kontraście (0,74–0,84 kontra 0,15), nie na zgadywaniu.
