# Projekt: Król Szamanów

*(d. "Kula Mocy" - nazwa zmieniona 2026-09-14 przy oprawie szamańskiej,
§7 pkt 3; katalog repo i `powerBall.js` [odpięty] zostają bez zmian.)*

## 1. Cel

Webowa gra ruchowa AR w klimacie **słowiańskiego szamanizmu**, rozpoznająca ruch gracza na kamerze.

Gracz **tańczy swobodnie**, a gra mierzy **PŁYNNOŚĆ jego ruchu** — czy kończyny kreślą łagodne łuki, czy szarpią. Płynny ruch napełnia tancerza mocą, widoczną nie tylko na pasku, ale jako **świetlista aura obrysowująca sylwetkę** na obrazie z kamery.

Cel emocjonalny: gracz ma **całkowicie rozluźnić ciało** i czerpać przyjemność z tańca — jak szaman przy ogniu. Nie egzamin, nie wyzwanie zręcznościowe.

- **Pochodzenie:** demo na warsztaty z vibe codingu.
- **Grupa docelowa:** studenci, uczestnicy warsztatów.

## 2. REGUŁA NADRZĘDNA: nic nigdy nie mówi „źle"

Obowiązuje w całym kodzie i wygrywa ze wszystkimi innymi względami.

- Każdy pomiar zwraca **ciągłą wartość 0..1**, nigdy boolean. Płynność steruje TEMPEM ładowania, nigdy go nie zeruje: ruch szarpany ładuje ok. 4x wolniej, ale **ładuje** (`PODLOGA_PLYNNOSCI`).
- **Punkty tylko przybywają** (od 2026-10-01, arcade - spec `docs/superpowers/specs/2026-10-01-punktacja-design.md`): nic ich nie odejmuje, combo nie resetuje się za pomyłkę, koniec rundy to podsumowanie, nie porażka. Malejący przyrost za powtarzanie daje MNIEJ, nigdy nie zabiera. Tryb swobodny - bez punktów i czasu, jak dawniej. **Brak stanu porażki.** Rundy (Obrzęd = pieśń, Próba = na czas) kończą się czasem albo końcem pieśni - koniec to podsumowanie, nie porażka. Zew żywiołów niczego nie zabiera, tylko podwaja nagrodę. Kronika po rundzie jest podsumowaniem, nie wyrokiem: nawet najniższy tytuł („Kłoda - każde ognisko zaczyna się od kłody") jest ciepły, a przydomek pojawia się tylko za coś, co go zasłużyło (brak pasującego = brak przydomka).
- Komunikaty mówią, co jest dostępne **dalej**, nie co gracz robi **źle**.
- Bezruch i wyjście z kadru **nie karzą** — płynność wraca wtedy do pełnej, bo brak danych to nie jest szarpanie.
- Progi mają histerezę; nic nie migocze na granicy.

## 3. Architektura

Front-end only, HTML + CSS + JavaScript (Vanilla, moduły ES). Bez backendu i bazy.

**Tracking:** MediaPipe Tasks Vision 0.10.3, dwa trackery naraz: `PoseLandmarker` (lite, `numPoses: 1`, z **maską segmentacji**) i `HandLandmarker` (`numHands: 2`). Zmierzone na żywym tańcu: ~60 FPS z obydwoma i maską, budżet 33 ms przy 30 FPS ma spory zapas.

```
kamera → PoseTracker ─┬→ worldLandmarks → Plynnosc ──────────────────┐
                      │                                              ├→ MotionMeter → moc → Aura + HUD
                      ├→ worldLandmarks(15/16) → Ślad run ──┐         │
                      └→ maska sylwetki ─────────────────── │ ───────┴→ Aura
       HandTracker ───→ landmarks → kwalifikator + Swaróg ──┤
                                                             ├→ ZnakRegistry → Pieczęcie → Kombosy → Efekty
```

**Tańczysz płynnie → moc rośnie → aura rozkwita.** Runy i piramidka dopisują drugą warstwę: gotowa moc + narysowany w powietrzu kształt (albo trzymana piramidka) → pieczęć → sekwencja pieczęci → technika.

### Kontrakt klatki

`main.js` buduje raz na klatkę jeden obiekt i przekazuje go wszystkim:

```js
{ hands: [{ landmarks, worldLandmarks, handedness }], pose: { landmarks, worldLandmarks } | null, width, height, dt, now }
```

`hands` niesie realne dane od `HandTracker` (dwie dłonie, każda z `landmarks`/`worldLandmarks`/`handedness`).

**Zasada:** `landmarks` (2D, przemapowane) **tylko do rysowania**. `worldLandmarks` (metryczne 3D) **do wszystkich pomiarów** — są niezależne od odległości gracza od kamery. Dotyczy to też śladu run: pozycja nadgarstka do dopasowania kształtu idzie z `pose.worldLandmarks[15/16]`, NIGDY z `hands[].landmarks` (zniekształcone przez cover-fit) ani `hands[].worldLandmarks` (metryczne, ale względem środka DŁONI - nie widać w nich ruchu dłoni w przestrzeni).

### Pliki

| Plik | Odpowiedzialność |
|---|---|
| `js/poseTracker.js` | wrapper MediaPipe Pose; detekcja na POMNIEJSZONEJ klatce |
| `js/handTracker.js` | wrapper MediaPipe Hands (`numHands: 2`) |
| `js/frameMapper.js` | cover-fit + mapowanie punktów na płótno |
| `js/plynnosc.js` | jak gładki jest ruch → 0..1 |
| `js/motionMeter.js` | ciągłość ruchu × płynność → moc |
| `js/aura.js` | maska sylwetki → poświata |
| `js/audioEngine.js` | CIENKA magistrala audio, bez syntezy: `masterGain` → kompresor → `destination`, wyciszenie (klawisz M, trwałe w `localStorage`) i `podlaczPiesn`. **Gra nie ma efektów dźwiękowych (decyzja 2026-10-01) - jedyny dźwięk to pieśni rund** (`js/piesni.js`). `tools/test-brak-efektow-dzwiekowych.mjs` pilnuje, żeby synteza i stary interfejs (`graj*`/`play*SFX`/`ustaw*`) nie wróciły; wyjątek: osobny AudioContext w `debugHud.js` (sygnały sesji nagraniowej dewelopera) |
| `js/debugHud.js` | nakładka (`D` = pokaż, `R` = reset zakresu, `N` = zrzuć ślad runy do konsoli) |
| `js/znaki/registry.js` | rejestr znaków; `score(frame)` → 0..1, nigdy boolean |
| `js/znaki/dlon.js` | wspólne narzędzia geometrii dłoni (skala, wyprostowanie, zwinięcie w pięść) |
| `js/znaki/swarogDlon.js` | piramidka Swaroga (żywioł ognia) - jedyna dłoniowa pieczęć, która przeżyła przebudowę na runy |
| `js/runy/slad.js` | bufor śladu nadgarstka - okno **długością drogi** (nie czasem!), sufit wieku |
| `js/runy/ksztalt.js` | resampling + normalizacja + dopasowanie kształtu do szablonu |
| `js/runy/szablony.js` | trzy szablony run (koło/zygzak/fala) - **dziś syntetyczne**, do zastąpienia nagraniem |
| `js/runy/definicje.js` | sześć znaków-run (kształt x stan dłoni), parowanie dłoni z nadgarstkiem PO POŁOŻENIU |
| `js/runy/rysujSlad.js` | świecąca wstęga za kreślącym nadgarstkiem |
| `js/pieczecie.js` | postawa/runa ciągła → zdarzenie: pierścień, zanik, lepki argmax |
| `js/kombosy.js` | bufor sekwencji pieczęci → technika, okno czasowe |
| `js/efekty.js` | tabela efektów wizualnych pieczęci i technik |
| `js/iskry.js` | tęczowe iskry Gromu w Ziemię (cząstki + pomocnik zaczepu "pęknięcia ziemi") |
| `js/zaplon.js` | zapłon sylwetki z maski segmentacji przy odpaleniu KAŻDEJ techniki - reużywa maskę, której aura.js już nie liczy dwa razy |
| `js/ekran.js` | odpowiedź ekranu przy odpaleniu KAŻDEJ techniki: wstrząs (translate/scale wewnątrz ctx), winieta, bramkowany bloom |
| `js/piorun.js` | prawdziwy kanciasty piorun (rekurencyjne przesunięcie punktu środkowego) przy Gromie w Ziemię - jedyna twarda krawędź w całej grze |
| `js/assety.js` | asynchroniczna ładowarka gotowych tekstur (Kenney Particle Pack, CC0, `assets/czastki/`) - jedyne miejsce w grze dotykające `new Image()` |
| `js/kolowrot.js` | Kołowrót (perun→weles→mokosz) - pierwsza technika na gotowych teksturach: dwa przeciwbieżne pierścienie run, kolumna teksturowanej mgły, spiralne iskry |
| `js/sledzenie.js` | Zaczepy technik, które PODĄŻAJĄ za graczem (proste combo 2026-10-02): środki dłoni posortowane po x, środek i szerokość barków, `Kotwica` - wygładzenie + trzymanie ostatniego stanu, gdy dłoń/poza zniknie |
| `js/warstwaZaSylwetka.js` | Płótno pomocnicze dla efektów ZA ciałem (Mgła, tył orbity Tarczy i Kurzawy): wycina maskę segmentacji (`destination-out`, ten sam `fit` co zaplon.js) przed nałożeniem na scenę; bez maski nakłada bez wycinania |
| `js/kamiennaTarcza.js` | Kamienna Tarcza (weles×3) - odłamki ziemi (dirt_*) na orbicie wokół tułowia, tył orbity ZA sylwetką; zaczep śledzi barki co klatkę; KOLEJNE odpalenia dokładają kręgi (do 4, przeciwbieżne, różne wysokości, stała prędkość liniowa), każde przedłuża życie całości |
| `js/mglaMokoszy.js` | Mgła Mokoszy (stribog→mokosz) - pas mgły (smoke_*) przetacza się przez kadr na wysokości tułowia, zwalnia przy graczu, rysowana ZA sylwetką |
| `js/wodnaKula.js` | Wodna Kula (mokosz→weles) - kula wody między dłońmi: soczewka własna (kopia sceny, clip do koła), falujący brzeg-kreska (simplex3), krople-kreski, pęknięcie na końcu |
| `js/lukPeruna.js` | Łuk Peruna (mokosz→perun) - ostry niebieski zygzak między dłońmi (własne przesunięcie punktu środkowego BEZ zaniku poszarpania), losowany na nowo co 60-90 ms i lekko drgający między odświeżeniami; blady rdzeń 1 px, druga nitka, iskry z rozwidleniem i błyskiem, mgiełka przy dłoniach; source-over, linie <= 2 px, 6 s. Dłonie: dwie - łuk między nimi, jedna - piorun w górę, żadnej - stoi |
| `js/kurzawa.js` | Kurzawa (stribog→weles) - wiatr z piaskiem i kurzem: 4 podmuchy spod dolnej krawędzi ekranu (na zmianę z lewej/prawej) wchodzą w poziome pasy wokół tułowia, sąsiednie przeciwbieżne. Styl MATERII, nie energii: source-over, ochra - mgiełka kurzu (smoke_*), ziarna piasku (kreski wzdłuż ruchu), grudki (dirt_*), cienka linia prądu; tył ZA sylwetką; śledzi barki |
| `js/dmuchanie.js` | Okadzenie (swaróg→stribog→swaróg) - gest "dłoń przy ustach"; DRUGA technika kanałowana, celowo INNA niż Płonący Palec (odsunięcie dłoni WSTRZYMUJE, nie kończy; wyczerpana moc nigdy nie kończy potencjału; jeden zegar 4 min od combo). Kierunek wydechu w CZTERY STRONY z blendu głowy (nos względem oczu 2/5: skręt→X, pochylenie→Y) i dłoni; długość tego blendu to `wyrazistosc` - początkowa siła wypchnięcia z ustawienia gracza |
| `js/dym.js` | Dym Okadzenia na silniku **smoke.js** (`js/vendor/`, MIT, kopia 1:1 z 4 oznaczonymi zmianami pod ESM): biblioteka daje sprite, cykl życia cząstki i rysowanie, ten plik całą GRĘ - kierunkowy wydech z początkową siłą (`addsmoke` z min/maxVx/Vy), opór, wyporność słabnącą pod sufitem, pole przepływu, REAKCJĘ NA RĘCE I TANIEC (pchnięcie + wir za dłonią), stany ognia, front na siatce kubełkowej i detonację na teksturach Kenney. Wpięcie przez `setPreDrawCallback`; obwiednia ALFY sterowana podawanym bibliotece wiekiem (`wiekBiblioteki`), a ROZMIAR osobno (`skalaCzastki`) - wąska kolumna przy ustach przez ~1 s, potem rozrost i rozpychanie na boki, aż dym rozejdzie się po ekranie. Własne płótno w 1/2 rozdzielczości (biblioteka czyści swój kontekst) |
| `js/vendor/` | Biblioteki zewnętrzne wpięte do repo (bez npm i bundlera - wszystko ładuje się jako ESM). Dziś: `smoke.js` (MIT, Guillermo Webster) z licencją w `LICENSE-smoke.txt`; zmiany wobec oryginału są ponumerowane w nagłówku pliku |
| `js/glify.js` | Król Szamanów (2026-09-14): mapa pięciu pieczęci na runy Elder Futharku (`Noto Sans Runic`), ładowanie fontu (`document.fonts`, nigdy nie odrzuca - brak fontu nie jest błędem), lista glifów ZAKAZANYCH (symbole zawłaszczone politycznie, patrz §7) |
| `js/runa.js` | Wielka runa przy dłoniach - zastępuje dawną animację pierścienia przy KAŻDEJ złożonej pieczęci (jedyny ślad okręgu: bardzo słaby pierścień, wyłącznie w fazie narodzin). Trzy fazy (narodziny/żar/rozsypanie), iskry rozsypania startują z PIKSELI SAMEGO GLIFU (rasteryzacja na offscreen canvas, cache per znak) |
| `js/sekwencja.js` | Pasek sekwencji u dołu ekranu (DOM, nie płótno - lustro i webfont-na-canvasie to oba powody). Czyta `KomboSilnik.aktywne(now)` co klatkę (PULL, bufor NIGDY nie jest czyszczony), sloty gasną z wiekiem (`alfaSlotu`), combo "wiąże" ogon bufora złotą poświatą po znaczniku czasu, nie po pozycji |
| `js/punkty.js` | Punktacja (2026-10-01): cztery warstwy (taniec / pieczęć / technika / reakcje), wartość techniki = 100 × suma `TRUDNOSC` pieczęci (z ZMIERZONEJ rozpoznawalności), malejący przyrost za powtarzanie, rejestr `REAKCJE` (Pożoga, Rozwianie - serie z logarytmicznym przyrostem), splecenie po NAKŁADANIU OGONÓW (nie po czasie). Czysta logika; `tools/test-punkty.mjs` jest strażnikiem: nowe combo bez wpisu w `TRUDNOSC` albo reakcja wołana z main.js bez wpisu w `REAKCJE` = czerwony test |
| `js/wynikHud.js` | HUD wyniku (DOM): licznik w lewym górnym rogu, linijka serii reakcji, unoszące się „+340 Okadzenie" w miejscu zdarzenia (lustro przeliczone w `pozycjaWLustrze`) |
| `js/tryby.js` | Silnik rundy (ZAPOWIEDZ→ODLICZANIE→TRWA→WYBRZMIENIE→KONIEC; czas ze SKUMULOWANYCH przyciętych `dt` - zawieszona karta nie przeskakuje rundy; wybrzmienie dopuszcza dopalenie dymu), `Zew` (×2 dla żywiołu: pieczęć i technika, NIE reakcje i taniec - inaczej psuje zmierzony balans), `Krag` (2-6 graczy, dubel dostaje sufiks, podium), `parsujKonfiguracje` (`?tryb=proba&czas=60&zew=1&krag=Ola,Bartek`, `?tryb=obrzed&piesn=0`) |
| `js/przebieg.js` | Orkiestrator rundy: zdarzenia klatki (`trwa`/`wybrzmienie`/`koniecRundy`), zapis wyniku RAZ, Krąg, Zew. Tryb swobodny nie ma przebiegu (`przebieg === null` w main.js, `punkty.aktywna = false`) |
| `js/swiezeModuly.js` | Równy start rundy: NOWE instancje wszystkich modułów ze stanem rundy (większość nie ma `reset()`; ukryty stan łatwo pominąć). Nowy `let x = new Klasa()` w main.js bez wpisu tutaj = dziedziczenie stanu między graczami (uzbrojone Okadzenie ma zegar 4 min!); `tools/test-swieze-moduly.mjs` to pilnuje |
| `js/piesni.js` | Manifest `assets/muzyka/utwory.json` (nazwy plików mają spacje i polskie znaki - `encodeURIComponent`), `Piesn` NIGDY nie jest błędem (`{ok:false}` → „Duchy zgubiły pieśń", runda gra dalej jak próba), pieśń przez `AudioEngine.podlaczPiesn` - ta sama magistrala co efekty, więc M ją wycisza |
| `js/rundaHud.js` | HUD rundy (DOM): odliczanie, czas, Zew, „Teraz tańczy", baner końca (TYMCZASOWY - zastąpi go Kronika z podprojektu 3) |
| `js/menu.js` | Model menu (ekrany Polana/konfiguracja/Księga/gra/Kronika, wybory, walidacja z ciepłymi zaproszeniami zamiast błędów). `konfiguracja()` ma KSZTAŁT `parsujKonfiguracje` (+ nick) - menu i adres wchodzą do gry jedną ścieżką (`uruchomZKonfiguracji`); `zajety` blokuje start podczas ładowania kamery |
| `js/ksiega.js` | Księga Plemienia: tablice per tryb/wariant (`obrzed:<plik>`, `proba:<s>`, sufiks `+zew` - Zew podwaja punkty, więc ma własne tablice), top 10, `localStorage` w try/catch (brak pamięci to nie błąd, `trwala=false`), walidacja KAŻDEGO wpisu, import SCALA (nigdy nie nadpisuje; klucz po wzorcu - nie `__proto__`; limity 64 tablic i 256 KB) |
| `js/kronika.js` | Teksty Kroniki: tytuł z PUNKTÓW NA MINUTĘ (`PROGI_TYTULOW`, progi 150/400/800/1300/2000 ZGADNIĘTE - do strojenia), przydomki (`PRZYDOMKI` - rejestr z testem-strażnikiem, który sprawdza odwołania do `KOMBOSY` i `REAKCJE`), miejsce w Księdze |
| `js/jaja.js`, `js/imiona.js` | Nick-bóg (Perun/Swaróg/Stribog/Mokosz/Weles, odporny na polskie znaki i sufiks dubla Kręgu) -> `odpalJajo` w `techniki.js` (ten sam worek zależności co `odpalTechnike`, nic nie uzbraja); losowe imię z kostki, test wylicza WSZYSTKIE kombinacje (<= 16 znaków) |
| `js/polanaUi.js` | Warstwa DOM menu: render modelu `Menu`, tekst gracza (nick!) wyłącznie `textContent`. Polana = krąg czterech kamieni wokół animowanego ogniska (CSS, bez płótna) |

**Odpięte, nie usunięte** (wracają, gdyby kamera zewnętrzna albo lepszy tracker to uzasadniły): `powerBall.js`, `wiatr.js`, `znaki/perun.js`, `znaki/mokosz.js`, `znaki/weles.js`, `znaki/postawa.js` (postawy CAŁEGO CIAŁA - wymagają kadru z barkami i biodrami), `znaki/welesDlon.js`, `znaki/perunDlon.js`, `znaki/szczurDlon.js`, `znaki/mokoszSplot.js` (pieczęcie/znaki PALCOWE lub z pozy zastąpione runami 2026-09-01 - patrz §4).

## 4. Pułapki, w które już wpadliśmy

Wszystkie **zmierzone**, nie teoretyczne. Nie cofać bez ponownego pomiaru.

### Ruch i płynność

- **Różniczkowanie wzmacnia szum.** Prędkość liczyć z **wygładzonych** pozycji. Odwrotna kolejność dawała ~1,2 m/s przy nieruchomym staniu; po poprawce ~0,07 (32× mniej).
- **Nie przeskalowywać przez `1/alfa`** „dla przywrócenia skali" — to mnoży szum z powrotem i kasuje cały zysk filtra.
- **Stała czasowa wygładzania musi być dłuższa niż cykl ruchu tanecznego** (~1 s), inaczej moc w każdym takcie rośnie i opada.
- **Płynność ≠ mało przyspieszenia.** Okrąg kreślony ze stałą prędkością ma duże przyspieszenie dośrodkowe, a jest wzorcem płynności. Liczy się tylko składowa STYCZNA.
- **ŚREDNIA(|a_t|)/ŚREDNIA(|v|) daje ODWROTNY ranking** (gładkie 6,3 vs szarpane 3,7). Oba zmieniają prędkość o tyle samo na sekundę; różni je SKUPIENIE w czasie. Stąd **RMS**, czuły na szczyty: 7,0 vs 21,0.
- **Zwykłe różniczkowanie dwukrotne nie przeżywa szumu** — rozdział spadał z 3,0× do 1,05×. Stąd **Savitzky-Golay**: pochodne z dopasowania wielomianu w oknie.
- **Miary czysto geometryczne nie działają** — kołysanie gładkie i szarpane kreślą tę samą prostą, różni je wyłącznie czas zwrotu.
- **Okna filtrów liczyć w SEKUNDACH, nie klatkach** — przy spadku FPS miara musi znaczyć to samo.
- **Oś Z z jednej kamery jest zgadywana** — pomijana (`WAGA_Z = 0`).
- **Jedna klatka z NaN potrafiła zatruć moc na stałe** (`Math.max(0, Math.min(1, NaN))` to nadal NaN).

### Aura i rendering

- **Maskę BARWIĆ na płótnie pomocniczym** (`source-in`), nie na głównym. Tint przez `source-atop` na głównym zalewa CAŁY ekran, bo tło gry jest nieprzezroczyste.
- **Wyciąć ostrą sylwetkę z rozmytej** (`destination-out`), inaczej wnętrze ciała wypala się do bieli i zamiast aury wychodzi świecąca kukła.
- **Aurę rysować przez `computeCoverFit()`**, tak jak wideo. Zwykłe `drawImage(0,0,canvas.width,canvas.height)` rozciąga ją i aura siada OBOK ciała.
- **Maski trzeba zwalniać** (`mask.close()`) — inaczej tekstury GPU wyciekają klatka po klatce.
- **Płótno ma CSS `transform: scaleX(-1)`** — tekst rysowany na nim wychodzi lustrzany.

### Runy kreślone w powietrzu (od 2026-09-01)

Zastąpiły pieczęcie palcowe (Wąż/Tygrys/Szczur) - te padały nie na złych progach, tylko na braku informacji w sygnale: jednooczna kamera RGB nie widzi palca schowanego za palcem, tylko go zgaduje. Piramidka Swaroga przeżyła, bo jej kształt sam wymusza prześwit między dłońmi. Pełny kontekst: `docs/superpowers/specs/2026-09-01-runy-i-kwalifikatory-design.md`.

- **Okno śladu liczy się DŁUGOŚCIĄ DROGI, nie czasem** — inaczej tempo kreślenia i czas trwania okna robiłyby dwie sprzeczne rzeczy naraz i runa byłaby osiągalna tylko w wąskim, nienazwanym paśmie tempa. Sufit wieku (osobno, ~4 s) gasi ślad przy bezruchu.
- **Okno MUSI być NIECO PONIŻEJ jednego obwodu typowej pętli, nigdy powyżej.** Zmierzone: okno 2x za duże (`MAX_DLUGOSC_M` dwa razy większe od obwodu) dawało bufor z ~2 okrążeniami, które po resamplingu do stałej liczby punktów wychodziły jako PRZERZEDZONA, KANCIASTA pętla (próbki co 22,5° zamiast 11,25°) — wynik dopasowania spadał do zera mimo idealnie narysowanego koła. Degradacja jest ASYMETRYCZNA: okno niedopełnione (za mały obwód założony) daje łagodnie schodzący wynik (fragment łuku), okno przepełnione (za duży) daje wynik, który spada STROMO. Bezpieczniej celować niżej.
- **Skalowanie kształtu MUSI być jednorodne (RMS promienia), nigdy osobno w X i Y.** Osobne skalowanie zamieniłoby pionowy zygzak i poziomą falę w ten sam kształt po normalizacji — dokładnie tę cechę, która je rozróżnia.
- **Parowanie dłoni z nadgarstkiem po POŁOŻENIU 2D, nie po `handedness`.** MediaPipe bywa niepewne co do stronności (patrz `normalnaDloni()` w `znaki/dlon.js`); błędne parowanie przez string dawałoby objaw "stan dłoni nie działa", nie "strony zamienione" - najgorszy rodzaj błędu do zdiagnozowania.
- **Trafienie MUSI czyścić ślad.** Bez tego bufor po złożeniu runy dalej trzyma ten sam narysowany kształt i pierścień natychmiast zaczyna napełniać się TĄ SAMĄ runą - jedno przejście dawałoby dwie pieczęcie.
- **Zanik zamiast zerowania w `pieczecie.js`.** Wynik dopasowania kształtu naturalnie dołkuje w chwili zamykania jednego obrotu i zaczynania następnego (bufor zawiera wtedy ~1,5 kształtu) - natychmiastowe zerowanie postępu kasowałoby całe trzymanie za jedną drgniętą klatkę.
- **Lepki argmax, remis wygrywa urzędującego.** Bez marginesu i czasu przejęcia dwa znaki o zbliżonym wyniku migają i żaden nigdy się nie składa (to był pierwotny powód hacku "Splot wygrywa remis", teraz zastąpionego regułą ogólną). Margines liczy się na różnicy BEZWZGLĘDNEJ - przy dokładnym remisie (np. `pokrycie=0` dla obu wariantów dłoni) lider musi zostać ten sam, inaczej skacze przy najmniejszym drgnięciu.
- **Szablony run są DZIŚ SYNTETYCZNE** (`runy/szablony.js`) - ZGADNIĘTE amplitudy/okresy, jak `PROG_SZARPNIECIA` przed nimi. Klawisz `N` w nakładce debug zrzuca znormalizowany ślad jako gotowy do wklejenia literał - stąd bierze się prawdziwy szablon.
- **Kombo x3 (Wstęga Mokoszy) ma zmierzone ograniczenie tempa** - przy bardzo wolnym i szerokim kreśleniu (promień ~0.22 m, 3,5 s/okrążenie) trzy złożenia nie mieszczą się w `OKNO_MS` kombosów i Tęcza nigdy się nie odpala, mimo że każda pieczęć osobno kosztuje moc. Zostawione świadomie jako znane ograniczenie do potwierdzenia na żywym ciele.

## 5. Wydajność

Odczyt maski z GPU skaluje się z liczbą pikseli i to ON, nie detekcja, jest kosztem:

| rozdzielczość detekcji | detekcja | odczyt maski | razem |
|---|---|---|---|
| 1280×720 | 11,8 | 21,4 | **33,1 ms** — cały budżet 30 FPS |
| 640×360 | 15,3 | 12,4 | 27,7 ms |
| **480×270** | ~14 | ~2 | **14,1 ms** ← tu pracujemy |
| 320×180 | 11,0 | 1,2 | 12,1 ms |

Stąd `SZEROKOSC_DETEKCJI = 480` w `poseTracker.js`. Aura jest rozmyta, więc niska rozdzielczość maski jest niewidoczna. Proporcje bierzemy z **rzeczywistych** `video.videoWidth/Height` — `getUserMedia` prosi przez `ideal` i może oddać 4:3.

## 6. Testy

```
sh tools/test-wszystko.sh    # cała logika bez kamery
node tools/tune-motion.mjs   # strojenie MotionMeter
node tools/pomiar-reakcji.mjs # balans punktów za reakcje dymu (Pożoga/Rozwianie, ~15 s)
```

Testy **nie zastępują** sprawdzenia na żywym ciele — wejściem gry jest strumień z kamery. Do tego służy nakładka debug (`D`).

Odniesienie z sygnałów syntetycznych (szarpnięcie w 1/s): okrąg 1,5 · kołysanie gładkie 6,1 · kołysanie szarpane 30,4 · wyrzut-stop 27,5. `PROG_SZARPNIECIA` jest z nich wyprowadzony i **wymaga potwierdzenia na żywym ciele**.

**Uwaga przy testach w przeglądarce:** Chrome cache'uje moduły ES heurystycznie po `Last-Modified`. Sam `Cache-Control: no-store` nie unieważnia wpisów zapisanych wcześniej — trzeba wymusić `fetch(url, {cache:'reload'})` albo twarde przeładowanie, inaczej godzinami testuje się stary kod.

## 7. Dalszy rozwój

1. **Nagrać prawdziwe szablony run** — zastąpić syntetyczne koło/zygzak/falę w `runy/szablony.js` nagraniami z żywego ciała (klawisz `N`). Najwyższy priorytet: to jedyna rzecz, przez którą cała przebudowa na runy może jeszcze zawieść w praktyce.
2. **Potwierdzić na żywym ciele** — progi `ksztalt.js` (`BLAD_ZERO`/`BLAD_PELNY`), okno śladu (`MAX_DLUGOSC_M`), margines i czas przejęcia lepkiego argmaxu, oraz ograniczenie tempa kombosa x3 (§4).
3. **Oprawa szamańska** — ~~paleta ognia/węgla~~ zrobione 2026-09-14 (style.css, main.js, js/runa.js, js/sekwencja.js, js/glify.js - nazwa "Król Szamanów", runy zamiast pierścienia, pasek sekwencji). Łuna ogniska jest DZIŚ tylko na ekranie startowym (`#start-screen::after`, gradient CSS) - ognisko WIDOCZNE PRZEZ CAŁĄ GRĘ (cząstki na płótnie, nie tylko start) zostaje w kolejce
4. **Rytm** — bęben ~90 BPM, płynność w zgodzie z taktem (uwaga: gra nie ma dziś efektów dźwiękowych, więc rytm to dodatek do pieśni, nie do syntezatora)
5. **Czwarty żywioł/piąty kształt** (np. spirala) — dopiero po potwierdzeniu obecnej czwórki (koło/zygzak/fala/piramidka) na żywo
6. ~~Menu i Księga rekordów~~ zrobione 2026-10-01 (podprojekt 3): menu „Polana", Kronika, Księga Plemienia (lokalna), jaja z nickami-bogami. Zostaje: **strojenie tytułów Kroniki** (`PROGI_TYTULOW`, pkt/min) na żywym ciele oraz **test całego przepływu z kamerą** (start z menu, runda, Kronika, zapis, Esc). Wspólna tablica online wymaga backendu (łamie §3) - świadomie poza zakresem. Pieśni właściciela w `assets/muzyka/` (2 utwory Suno) - LICENCJĘ sprawdzić przed publikacją gry.

*Przy symbolice omijać kołowrót/swarzycę — zostały zawłaszczone przez skrajną prawicę. Celem są i tak autorskie runy.*
