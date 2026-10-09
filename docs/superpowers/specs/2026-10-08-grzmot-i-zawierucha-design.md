# Grzmot i Zawierucha — dwie dwójki działające na pole (2026-10-08)

## Dlaczego

Przegląd technik: Perun i Weles nie otwierały żadnej dwójki (Perun najrzadszy w grze w ogóle).
Właściciel wybrał model **„dwójka działa na pole"**: dwójka jest krótka i skromna (zasada
„dwójki skromne, WOW dla trójek"), a ciekawie robi się dopiero, gdy trafi w długą technikę —
Mgłę Mokoszy (11 s), Kurzawę (5 s), dym Okadzenia.

Odrzucone w tej rozmowie: Zapłon (perun→swarog), Żar Welesa (weles→swarog) — „na razie".

## Grzmot (perun → stribog)

- Natychmiastowy. Fala uderzeniowa z klatki piersiowej (środek barków + 0,6 skali w dół) —
  wspólna `Fala` (`js/fala.js`), oś ku kamerze `{0,0,-1}` = pierścień w płaszczyźnie ekranu,
  siła 0,7, błękit Peruna. Bez okręgu aktywacji w `efekty.js` (jak Bania).
- Pola: **dym** rozrzucany przez istniejący PULL `fala.czola → dym.pchnij` (punkty „Rozwianie");
  **Mgła** — `rozepchnij()`: dziura, kłęby odpychane promieniście, domyka się sama;
  **Kurzawa** — `szarpnij()`: pasy chwilowo rozszerzają się i bledną, wracają w ~0,8 s.
- Reakcja punktowa „Rozdarcie": 1 jednostka na trafione pole (Mgła, Kurzawa) na Grzmot.

### Grzmot v2 (2026-10-08, po pierwszym teście: "ma przypominać grzmot, fala okręgiem we wszystkie strony")

Fala Aarda z osią ku kamerze czytała się jak dmuchnięcie. Grzmot rysuje się teraz sam
(`js/grzmot.js`): **błysk** całego kadru (`lighter`, ~0,1 s plato) → **pierścień** płaski w płaszczyźnie
ekranu rosnący ze środka tułowia aż za róg kadru w 0,65 s (ease-out) + **echo** słabsze o 0,12 s →
kilka **iglic** (zygzaków) migoczących na krawędzi → **dudnienie**: słabnące uderzenia ekranu
(0,5 / 0,35 / 0,2 po 0,15 / 0,30 / 0,45 s) po pierwszym ze wspólnej warstwy techniki.
Dym pchany promieniście z pierścienia (`punktyPchniecia`, 40 punktów). Reakcje (Rozdarcie) bez zmian.

**Dźwięk — świadomy wyjątek od decyzji z 2026-10-01 (gra bez efektów dźwiękowych):**
`js/dzwiekGrzmotu.js`, synteza trzasku (HP 1,8 kHz, 80 ms) i dudnienia (LP 700→80 Hz, 2,2 s, garby
głośności) z szumu brązowego, przez `audioEngine.magistrala()` — klawisz M wycisza. Strażnik
`tools/test-brak-efektow-dzwiekowych.mjs` ma ten jeden plik na liście wyjątków; GEMINI.md zaktualizowany.
Stanowisko `tools/scena.html` nie ma audio, więc dźwięku tam nie ma.

## Zawierucha (weles → stribog)

- Odwrotność Kurzawy (stribog→weles owija wiatr wokół ciała) — tu wiatr idzie **liniowo
  w poprzek kadru**, przy dole (pas biodra–uda, nie niżej niż 0,92 H). Materia: ochra,
  `source-over`, kreska po węzłach (nie sprite'y), część smug ZA sylwetką.
- Złożenie otwiera **okno 1,5 s**; pierwsze **0,3 s głuche** (wyjście z pieczęci „łokcie razem"
  rozrzuca ręce). Każde **machnięcie ręką** (dowolny kształt dłoni — odczyt z NADGARSTKÓW POZY
  15/16, nie landmarków dłoni) wypuszcza **jeden poryw** w stronę ruchu (lewo/prawo).
  **Przerwa 0,35 s na rękę** (połyka powrót ręki), druga ręka nie czeka; **max 3 porywy**.
  Brak machnięcia → po oknie **jeden samoczynny poryw**, strona na zmianę. Zero stanu porażki.
- Moc **dużo słabsza niż Aard**: dym dostaje punkty pchnięcia z `sila` 0,25 (efektywnie ~0,15
  vs 0,6 Aarda). Mgła — `znies()`: odpływa w stronę wiatru; Kurzawa — `znies()`: pasy zrywane
  w bok, sprężyście wracają.
- Reakcja punktowa „Zawianie": 1 jednostka na poryw na trafione pole.

## Kolizje i łańcuchy

P→T i W→T nie są prefiksem/sufiksem żadnej trójki. Łańcuchy: Grzmot + stribog = Aard,
Zawierucha + weles = Kurzawa, Zawierucha + mokosz = Mgła Mokoszy.
Wolne pary po tej partii: perun→swarog, perun→mokosz, stribog→perun, weles→swarog.

## Nastawy ZGADNIĘTE — do strojenia na kamerze

`PROG_PREDKOSCI` (~5 szerokości barków/s) i `PRZERWA_REKI_S` w `js/machniecie.js`; siła fali
Grzmotu 0,7; `sila` pchnięcia dymu Zawieruchy 0,25; punkty reakcji Rozdarcie 30 / Zawianie 10.

## Błędne Ogniki (weles → swarog) — trzecia dwójka partii

Odrzucone wcześniej: Zapłon (perun→swarog), Kulisty Piorun, Iskrzenie, Widmo. Właściciel wybrał
Błędne Ogniki, ale **z pieczęcią ognia**. Mit: Weles — władca zaświatów i pasterz dusz; błędne
ogniki to w podaniach dusze wychodzące z ziemi nad mokradłami i cmentarzami. Ziemia→ogień:
„zaświaty wypuszczają duszyczki, ogień je rozpala". Koszt świadomie przyjęty: ogień na końcu
(najsłabiej rozpoznawany), ziemia na początku pewna.

- 5 ogników falą (co 0,08 s) z pasa „ziemi" (jak Zawierucha: barki + 1,0..1,8 skali, ≤ 0,92 H),
  unoszą się wolno, chwieją polem curl2, odpływają na boki, migoczą; życie ~2,2 s, całość ~2,6 s.
- Wygląd (`lighter`, duch/energia): aureola blado zielono-złota, mały tintowany płomyk `flame_*`,
  jasny rdzeń, krótki ogon kreską. Barwa inna niż pomarańcz Płonącego Palca.
- Bez wstrząsu, błysku kadru i dźwięku (dwójka skromna; dźwięk ma tylko Grzmot).
- Pola: **dym** — ogniki to zarzewia (`dym.podpal`) → Pożoga (istniejąca reakcja);
  **Mgła** — latarnie: aureola ×2,5, kłęby wokół ciepło podświetlone (`mgla.podswietl`), reakcja
  „Latarnie"; **Kurzawa** — wir porywa ogniki na orbitę (`kurzawa.orbita()` → `ogniki.porwij`),
  reakcja „Wir ogników". Po 1 jednostce na ognik na pole (punkty 12, ZGADNIĘTE).
- Łańcuchy: + perun = Grom w Ogniu; + stribog + swarog = Okadzenie (którego dym ogniki podpalą).
- Wolne pary po tej partii: perun→swarog, perun→mokosz, stribog→perun.
