# Splot Mokoszy i Tęczowa Wstęga — projekt

## Context

Pieczęcie dłoniowe (Weles/Perun/Swaróg/dawny Szczur) sprawiają kłopot w praktyce — gracz zgłosił, że nawet po przeprojektowaniu Szczur dalej nie łapał się pewnie (odpięty, `docs/superpowers/plans/...` historia w commitach `948bad3`, `110f607`). Prośba: **nowy znak wyzwalany bez użycia dłoni**, złożony ze skrzyżowania ramion, plus nowa nagroda — po trzykrotnym złożeniu tego znaku gracz dostaje na 30 s **tęczową aurę**, która zachęca do zamaszystego ruchu.

### Dlaczego skrzyżowanie ramion ma szansę tam, gdzie stare postawy poległy

Postawy ciała (`mokosz.js`, `weles.js`, `perun.js` — plik z postawami, nie z dłoni) były odpięte, bo wymagały kadru z barkami **i** biodrami plus zapasem, czego kamera laptopa nie daje. Skrzyżowanie ramion na piersi potrzebuje **wyłącznie górnej połowy sylwetki**: barki (11/12), łokcie (13/14), nadgarstki (15/16). Żadnych bioder. To jest cały powód, dla którego ten znak ma szansę zadziałać tam, gdzie tamte nie zadziałały — nie estetyka, tylko kadrowanie.

### Decyzje z rozmowy

- **Wyzwalacz nagrody: 3× ten sam nowy znak**, nie mieszanka z pieczęciami dłoniowymi. Cała ścieżka do 30-sekundowej nagrody działa bez rąk — to jest sedno prośby, nie szczegół.
- **Tęcza maluje ślad za ruchem.** Sylwetka zostawia tęczowe smugi w powietrzu, dogasające po ~1,5 s. Najsilniejsze zaproszenie do zamaszystego ruchu spośród rozważanych opcji (reakcja na tempo, malowanie po całym obrysie na raz) — ale jedyna, która dokłada nową warstwę rysowania do już najdroższej części pętli klatki. Rozwiązanie kosztowe w architekturze niżej.
- **Tęcza ZASTĘPUJE zwykłe kodowanie barwy przez 30 s**, gaszenie łagodne: ostatnie ~3 s ślad się skraca i barwa wraca do normalnej rampy płynności — koniec jest widoczny, ale nie jest cięciem.
- **Odnowienie w trakcie trwania restartuje licznik do pełnych 30 s.** Złożone pieczęcie nigdy się nie marnują (reguła nadrzędna) — trzykrotny splot podczas trwającej tęczy po prostu przedłuża ją od nowa.
- **Rytuał kosztuje standardowe 3×10% mocy = 30%.** Sama nagroda jest darmowa i nie zjada mocy przez 30 s — prezent, nie kolejny rachunek.

---

## Znak: Splot Mokoszy

Postawa: **przedramiona skrzyżowane na piersi**, każdy nadgarstek po przeciwnej stronie ciała niż jego własny bark — jak przy samoprzytuleniu.

Trzy ciągłe warunki, **minimum** z nich (reguła nadrzędna — postawa złożona w połowie daje pół wyniku):

| warunek | co mierzy | jednostka |
|---|---|---|
| `skrzyzowanie` | każdy nadgarstek przeszedł na stronę PRZECIWNEGO barku, wystarczająco daleko za linię środka ciała | szerokości barków |
| `wysokosc` | nadgarstki w paśmie wokół linii barków — nie nad głową, nie przy pasie | szerokości barków |
| `zwarcie` | nadgarstki blisko środka klatki piersiowej, nie na szeroko rozłożonych ramionach | szerokości barków |

**Pomiar `skrzyzowanie` jest z natury symetryczny**, więc odbicie lustrzane niczego nie zmienia bez potrzeby liczenia obu przypisań rąk (jak w `perun.js`): liczy się przesunięcie nadgarstka względem środka barków, przeskalowane znakiem osi barków (`BARK_P.x - BARK_L.x`), więc wynik nie zależy od tego, w którą stronę akurat wypadło mirrorowanie obrazu.

**ZGADNIĘTE — do potwierdzenia z nakładki (D), jednostka: szerokości barków:**

```
KRZYZOWANIE_MIN = 0.05   KRZYZOWANIE_PELNE = 0.35
WYSOKOSC: pasmo wokół linii barków, ok. -0.3 (nad) do +0.9 (pod)
ZWARCIE_PELNE = 0.5      ZWARCIE_ZERO = 1.3
```

**Rozdzielność:** to jedyny aktywny znak korzystający z `worldLandmarks` **pozy** (nie dłoni) w tej wersji gry — `SkladaniePieczeci` wybiera jeden najlepszy znak spośród WSZYSTKICH zarejestrowanych na raz (`pieczecie.js:_najlepszy`), więc kolizja ze znakami dłoniowymi jest realnym ryzykiem testowym, nie teoretycznym: trzeba sprawdzić, że splot nie zapala się przy pieczęciach dłoniowych i odwrotnie.

**Nazwa i plik:** `js/znaki/mokoszSplot.js`, `id: 'splot'`. Bogini losu i przędzy — splot ramion czyta się jako splot nici, a tęcza jako wstęga utkana z barw. **Nowy plik, nie zmiana `mokosz.js`** — ten istniejący plik to stara, odpięta postawa (dłonie nisko i szeroko, wymaga bioder) i zostaje nietknięty na dysku; oba mogą się nazywać na cześć tej samej bogini, ale nie wolno ich zarejestrować jednocześnie (ten sam `id` byłby kolizją w `ZnakRegistry`).

---

## Rytuał i ekonomia

```
splot → splot → splot   (3 cykle pierścienia, w oknie kombosa 4 s)
              ↓
      30 s tęczowej wstęgi (darmowe, moc nie zanika przez ten czas)
```

Każde złożenie splotu kosztuje standardowy `KOSZT_PODSTAWOWY = 0.10` z `pieczecie.js` — rytuał to 30% paska. Trzymanie tej samej postawy przez wiele cykli pierścienia odpala kombos wielokrotnie, dokładnie jak dzisiejsze `weles × 2 → aard` — nie potrzeba nowego mechanizmu w `kombosy.js`, tylko nowy wiersz:

```js
{ id: 'tecza', nazwa: 'Wstęga Mokoszy', sekwencja: ['splot', 'splot', 'splot'], uzbraja: 'tecza' }
```

**`uzbraja: 'tecza'` NIE pasuje do dzisiejszego wzorca uzbrojenia** (Ogień/Aard uzbrajają się kombosem, ale odpalają dopiero PRZY OSOBNYM geście gracza — palec nad barkiem, machnięcie). Tęcza nie ma drugiego gestu: nagroda startuje **natychmiast** w chwili złożenia kombosa. `main.js` routuje `uzbraja === 'tecza'` na `tecza.aktywuj()`, który od razu (re)startuje 30-sekundowy licznik — to jest trzecia gałąź obok `'ogien'` i `'aard'`, nie odmiana którejkolwiek z nich.

---

## Tęczowa wstęga — stan i rysowanie

Ten sam podział co przy ogniu i podmuchu: `js/tecza.js` trzyma **stan** (licznik, barwa, siła śladu), `js/aura.js` **rysuje** — ale tym razem rysowanie zostaje w `aura.js`, bo to on jest właścicielem maski sylwetki i bufora, więc wyciąganie samego rysowania śladu do osobnego pliku dublowałoby dostęp do tych samych danych bez zysku.

### `js/tecza.js` — stan

```
aktywna: boolean
pozostaloS: number        — sekundy do wygaśnięcia
barwaHue: 0..360          — bieżący odcień, przesuwa się w czasie
silaSladu: 0..1           — 1 przez pierwsze 27 s, rampa do 0 w ostatnich 3 s
```

- `aktywuj()` — (re)startuje `pozostaloS` do 30, licznik zawsze pełny, nigdy się nie sumuje.
- `update(ruch, dt)` — odlicza `pozostaloS`, przesuwa `barwaHue` (tempo zależne od `ruch` — **stoisz, tęcza płynie leniwie; tańczysz, wiruje przez całe spektrum** — to jest odpowiedź na „zabawę ruchem"), liczy `silaSladu` jako rampę w ostatnich 3 sekundach.
- Parametr `ruch` to ten sam sygnał ciągłości ruchu, którego już używa `motionMeter`/`plynnosc` — żadnego nowego pomiaru.

### `js/aura.js` — bufor akumulacyjny

Naiwna wersja (trzymać N poprzednich klatek maski i rysować każdą osobno) to N dodatkowych rozmyć na klatkę — realne ryzyko dla FPS ≥ 24, jedynego twardego wymogu wydajnościowego tej gry. Zamiast tego:

**Jedno dodatkowe płótno instancyjne** w rozdzielczości maski (480×270, ta sama co reszta pipeline'u aury), utrzymywane MIĘDZY klatkami:

```
co klatkę, TYLKO gdy tecza.aktywna:
  1. przygaś bufor    (destination-out, stały mnożnik alfa — ekspotencjalne dogasanie)
  2. domaluj bieżącą sylwetkę w BIEŻĄCEJ barwaHue, na pełną alfę
  3. podaj bufor jako źródło do JUŻ ISTNIEJĄCEGO pipeline'u trzech rozmyć
     (aura.js:PRZEBIEGI) zamiast surowej maski z tej klatki
```

Koszt jest **stały, niezależny od długości śladu** — jedno dodatkowe przygaszenie (jeden `fillRect` na masce 480×270) zamiast N dodatkowych rozmyć, i **zero dodatkowych przebiegów rozmycia** ponad te, które `aura.js` już robi. Ponieważ barwa bufora w danym punkcie zamraża się na barwie z chwili, gdy sylwetka tam ostatnio przeszła, ślad wychodzi tęczowy sam z siebie — nie trzeba tagować ani liczyć wieku per piksel.

Gdy `tecza.aktywna` jest fałszywe, `aura.js` działa dokładnie jak dziś (barwa z płynności, bez bufora) — zerowy koszt dla gracza, który nie ma aktywnej nagrody.

**Interfejs:** `aura.updateAndDraw` dostaje jeden dodatkowy, opcjonalny parametr `tecza` (obiekt `{aktywna, barwaHue, silaSladu}` — dokładnie stan z `js/tecza.js`). Gdy pominięty lub `aktywna === false`, zachowanie identyczne z dzisiejszym.

---

## Pliki

### Nowe
- `js/znaki/mokoszSplot.js` — postawa splotu, `id: 'splot'`, `wymaga: 'pose'`
- `js/tecza.js` — stan nagrody: licznik, barwa, rampa wygaszania
- `tools/test-postawy.mjs` *(rozszerzenie)* — testy splotu dołączają do istniejącego pliku, tak jak Perun/Mokosz/Weles
- `tools/test-tecza.mjs` — cykl życia nagrody: aktywacja, odnawianie, wygaszanie, odporność

### Modyfikowane
- `js/kombosy.js` — wiersz `{ id: 'tecza', sekwencja: ['splot','splot','splot'], uzbraja: 'tecza' }`
- `js/aura.js` — bufor akumulacyjny śladu, dodatkowy parametr `tecza` w `updateAndDraw`
- `js/main.js` — rejestracja `mokoszSplot` w `ZnakRegistry`, instancja `Tecza`, routing `uzbraja === 'tecza'`, przekazanie stanu do `aura.updateAndDraw`
- `js/efekty.js` — wiersz `splot` (lekki błysk, jak inne pieczęcie) i `tecza` (błysk uzbrojenia — pojedynczy odcień, bo `TABELA` nie umie prawdziwej tęczy; sama tęcza żyje w `aura.js`)

### Nietknięte
`js/znaki/mokosz.js` (stara postawa, zostaje odpięta na dysku), `js/pieczecie.js` (silnik składania bez zmian — nowy znak korzysta z istniejącego mechanizmu), `js/motionMeter.js` (`tecza.js` czyta gotowy sygnał ruchu, nie liczy własnego).

---

## Weryfikacja

Bez kamery (`sh tools/test-wszystko.sh` musi dalej przechodzić w całości):

1. Splot zapala `splot` i wynik jest ciągłą rampą (powolne krzyżowanie ramion), nie progiem.
2. Odbicie lustrzane (zamiana, która ręka jest na wierzchu) daje ten sam wynik.
3. Ramiona opuszczone / rozłożone szeroko dają zero.
4. **Splot NIE zapala żadnej pieczęci dłoniowej i żadna pieczęć dłoniowa nie zapala splotu** — realna kolizja do sprawdzenia, nie formalność.
5. Brak pozy, NaN w punktach → zero, nie wyjątek.
6. 3× `splot` w oknie kombosa odpala `tecza` z `uzbraja: 'tecza'`.
7. `Tecza.aktywuj()` ustawia `pozostaloS` na pełne 30 s; wywołane ponownie w trakcie **restartuje**, nie sumuje.
8. `silaSladu` zostaje na 1 przez pierwsze 27 s i opada do 0 dokładnie w ostatnich 3.
9. Po wygaśnięciu `aktywna` wraca na `false` bez skoku wartości pośrednich.
10. `aura.updateAndDraw` bez parametru `tecza` (albo z `aktywna: false`) zachowuje się identycznie jak dziś — test regresji istniejących testów aury.

Na żywym ciele (`http://localhost:8000`, klawisz `D`):

11. Splot łapie się pewnie przy kamerze laptopa (to jest cały cel tego znaku).
12. **FPS ≥ 24 przy pełnej tęczy z ruchem** — jedyne twarde ryzyko wydajnościowe tej funkcji.
13. Tempo przesuwania barwy faktycznie reaguje na intensywność ruchu, nie jest stałe.
14. Koniec 30 s czuje się jak wygaszenie, nie ucięcie.

---

## Poza zakresem

1. Dźwiękowa warstwa tęczy (osobny motyw audio na czas nagrody) — możliwe później, `audioEngine.js` nietknięty w tym projekcie.
2. Wizualne rozróżnienie „świeżo odnowionej" tęczy od tej dobiegającej końca poza samą `silaSladu` — jeden mechanizm wystarcza na start.
3. Więcej znaków z ciała poza splotem — jeśli splot okaże się niezawodny, może otworzyć drogę do kolejnych.
