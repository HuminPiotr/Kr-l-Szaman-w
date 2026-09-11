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
