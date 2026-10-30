# Trans: taniec do muzyki (etapy 2–4 z 4: „gra rozumie muzykę”)

## Po co

Etap 1 (jakość tańca, spec 2026-10-14) nauczył grę odróżniać piękny taniec od machania. Teraz gra ma
**słyszeć pieśń i nagradzać taniec w jej rytmie**. Słowa właściciela (2026-10-30):

> Gdy tańczę w rytm, aura pięknie lśni i pulsuje. Z czasem wpadam w trans, który dodaje nowe efekty
> wizualne, a także daje mnożnik do many i punktacji. Gdy gubię rytm, aura nie lśni tak mocno, jej puls
> jest nieregularny i ogólnie słabizna.

Ten spec łączy etapy 2–4 z planu 2026-10-14 (słuch, dopasowanie tempa, trafienia i trans) w jedną
całość, ale tylko dla trybu **Obrzęd** z własnymi pieśniami gry. Mikrofon i puls tańca bez muzyki to
osobne, późniejsze projekty.

Pozycja tańca w grze się nie zmienia: **techniki są głównym zadaniem, taniec generuje manę**. Trans
wzmacnia oba. Technika rzucona w transie ma być czymś naprawdę wyjątkowym (decyzja właściciela).

## Cele

1. Gra zna rytm każdej pieśni Obrzędu: tempo i położenie uderzeń, wyliczone z góry z pliku.
2. Na bieżąco mierzy **zgodność z rytmem** (0..1): czy ruch gracza układa się w rytm pieśni.
3. Aura to pokazuje. W rytmie lśni mocniej i pulsuje równo z taktem pieśni. Poza rytmem jest słabsza,
   a puls robi się nieregularny.
4. Trwała zgodność buduje **trans w trzech stopniach**. Każdy stopień dokłada efekt wizualny i podnosi
   mnożniki. Po zgubieniu rytmu stopnie gasną łagodnie, od najwyższego.
5. Technika rzucona w transie jest wyjątkowa: wyższe punkty, wspólna oprawa zgrana z taktem, ślad
   w Kronice i Księdze.

## Nie-cele (teraz)

- Trans w trybie Próba i swobodnym (nie grają muzyki). Wejdzie z etapem mikrofonu lub pulsu tańca.
- Mikrofon, muzyka z zewnątrz (YouTube, pokój), puls tańca bez muzyki.
- Osobne wersje każdej z 18 technik w transie. Oprawa transu jest wspólna dla wszystkich.
- Rozpoznawanie stylu tańca czy gatunku muzyki.
- Mnożnik transu dla pieczęci i reakcji (Pożoga, Rozwianie). Tylko taniec, mana i techniki.
  (Decyzja projektanta, nie właściciela. Patrz „Decyzje projektanta”.)

## Anty-cele (porażka, nawet jeśli technicznie działa)

- **Coś mówi „źle”.** Reguła nadrzędna (GEMINI.md §2, pamięć „nic nie mówi źle”): gubienie rytmu
  niczego nie zabiera. Mana i punkty dalej rosną, wolniej. Trans gaśnie łagodnie, bez dźwięku,
  napisu ani błysku porażki. Nieregularny puls to płynna skala, nie sygnał błędu.
- **Wymóg precyzji.** Grają amatorzy i dzieci na warsztatach, a właściciel nie jest zawodowym
  tancerzem. Wystarczy ogólnie łapać rytm (kołysanie, machanie w takt). Stałe przesunięcie względem
  uderzenia (ktoś zawsze trochę spóźniony) liczy się jako rytm.
- **Stroboskop.** Puls i efekty mają wprowadzać w trans, nie migać. Wszystko wygładzane.
- **Trans przełącza się skokowo** albo znika w jednej klatce.
- **Nowe dźwięki.** Gra nie ma efektów dźwiękowych (decyzja 2026-10-01, strażnik
  `tools/test-brak-efektow-dzwiekowych.mjs`). Żadnych kliknięć metronomu ani dźwięków transu.
- **Nachalne efekty.** Właściciel odrzucił świetliste punkty po stawach jako za nachalne (2026-10-30).
  Efekty transu mają być klimatyczne, nie krzykliwe.

## Ograniczenia i stan obecny

- Pieśni: 4 utwory Suno w `assets/muzyka/` (`utwory.json` = manifest; `js/piesni.js` waliduje go
  i odtwarza przez `Piesn` / `audioEngine`). Muzyka gra tylko w Obrzędzie (`js/tryby.js`).
- Gniazdo transu już istnieje: `MotionMeter.update(…, mnoznikBogactwa, mnoznikTransu)` (przycięty
  do 1..3), na razie zawsze 1.
- Punkty za taniec: `Punktacja.taniec(plynnosc, responsywnosc, dt, mnoznik)` = 4 pkt/s × … ×
  mnożnik_jakości² (2026-10-30). Technika: `Punktacja.technika(kombo, now, miejsce)` w `js/main.js`
  (~l.855, w bloku „6a. Pieczęć się złożyła”), tam też `odpalTechnike(...)`.
- Aura (`js/aura.js`) dostaje już `zar` (jakość 0..1) i `rytmHz` (okres tańca), barwę i tętno.
  Bufor śladu `_slad` (tęcza) i maska segmentacji są do wykorzystania.
- Okres tańca (`js/jakosc/okres.js`) w swobodnym tańcu rzadko jest pewny (pewność 0.24–0.5 na sesji J,
  2026-10-30). **Zgodność z rytmem nie może na nim polegać.**
- Lustrzany obraz, kamera ma opóźnienie (~100 ms+). Zgodność ma być niewrażliwa na stałe opóźnienie.
- Na maszynie jest `ffmpeg` (do dekodowania m4a w narzędziu offline).
- Nagrywanie (`js/nagrywanie/`, sesje klawiszem J) zapisuje klatki z `dt`. Na razie bez czasu pieśni.

## Jak (ustalone z właścicielem)

### Trzy stopnie transu

| Stopień | Kiedy (orientacyjnie) | Efekt wizualny | Mana i punkty za taniec | Punkty techniki |
|---|---|---|---|---|
| 0 | — | (aura reaguje na zgodność, patrz niżej) | ×1.0 | ×1.0 |
| 1 | kilka taktów w rytmie | świat przygasa (brzegi kadru ciemnieją i oddychają w takt, ognisko i tancerz w świetle) + **kręgi od stóp** na każde uderzenie | ×1.2 | ×1.25 |
| 2 | dłużej | dochodzą **echa sylwetki**: złote odciski aury odrywają się w takt, odpływają i gasną | ×1.4 | ×1.5 |
| 3 | jeszcze dłużej | dołącza **krąg przodków**: półprzezroczyste, dymne sylwetki za graczem tańczą jego taniec z opóźnieniem jednego taktu | ×1.6 | ×2.0 |

- Efekty się **dokładają** (stopień 3 ma wszystko).
- Po zgubieniu rytmu stopnie **gasną od najwyższego**, łagodnie (kilka sekund na stopień). Efekty
  wygasają, nie znikają skokowo.
- Mnożniki transu mnożą się z istniejącymi: jakością tańca (mana ×0.67..1.5, punkty tańca ×jakość²)
  i Zewem żywiołów (×2).

### Aura a rytm

- W rytmie (wysoka zgodność): aura lśni pełniej, a tętno idzie **równo z taktem pieśni**. Takt pieśni
  zastępuje okres tańca jako źródło tempa tętna.
- Poza rytmem: aura przygasa, a tętno robi się **nieregularne**, rozjeżdża się z taktem. Płynnie, im
  mniejsza zgodność, tym bardziej nierówne, bez progu.
- Bez pieśni z rytmem (Próba, swobodny, pieśń się nie wczytała, brak danych rytmu): aura dokładnie
  taka jak dziś.

### Technika rzucona w transie

- **Punkty:** mnożnik stopnia (×1.25 / ×1.5 / ×2) zapisany **w chwili rzutu**. Późniejsze gubienie
  rytmu niczego nie odbiera.
- **Zgranie z taktem:** start techniki przesunięty na najbliższe następne uderzenie (opóźnienie do
  ~0.5 s, właściciel się zgodził). Gdy uderzenia są rzadsze niż 0.5 s, wolno użyć połowy uderzenia.
  Tylko w transie. Poza transem technika odpala od razu, jak dziś.
- **Oprawa wspólna dla wszystkich technik:** złoty błysk i fala od tancerza przez ekran w momencie
  odpalenia. Na stopniu 3 duchy przodków unoszą ręce razem z graczem.
- **Widoczny mnożnik (decyzja właściciela):** przy punktach wyskakujących za technikę rzuconą
  w transie widać mnożnik (np. „×2”). Poza tym stopnia transu nie pokazuje żaden napis ani HUD.
  Stopień widać tylko po efektach (aura mówi, bez napisów).
- **Ślad:** Kronika po rundzie podaje, ile technik rzucono w transie (i najwyższy stopień). Nowy
  Kamień Pamięci w Księdze, np. „Pierwsza technika w transie stopnia 3”.

## Pozostawione wykonawcy (z intencją)

- **Analiza rytmu pieśni:** narzędzie offline w `tools/` (ffmpeg → PCM → obwiednia uderzeń →
  tempo → położenie uderzeń), wynik zapisany w manifeście `utwory.json` jako opcjonalne pola rytmu.
  Walidacja w `walidujManifest` jak pozostałe pola. Pieśń bez danych rytmu = brak transu, bez błędu
  (§2). Suno zwykle trzyma stałe tempo, ale narzędzie ma to **sprawdzić** (dryf fazy w czasie)
  i przy dryfie zapisać listę uderzeń zamiast samego BPM. Wyniki porównać ze słuchem właściciela.
  Rozpoznanie „raz” (początku taktu) jest opcjonalne.
- **Pozycja w pieśni na bieżąco:** z `audio.currentTime` pieśni (`Piesn` ma to wystawić). Uwaga na
  pauzę, Esc do Polany, koniec pieśni i Krąg (zmiana gracza).
- **Miara zgodności z rytmem (0..1):** musi być wyrozumiała i niezależna od stałego opóźnienia.
  Pomysł projektanta: faza uderzenia pieśni w chwilach akcentów ruchu (szczyty prędkości kończyn),
  zebrana z kilku taktów, i spójność tej fazy (długość średniego wektora, phase locking). Stałe
  przesunięcie daje wtedy wysoką zgodność, chaos niską. Dopuścić ruch co 2 uderzenia i 2 razy na
  uderzenie (tolerancja ½× / 2× z planu 2026-10-14). Nie opierać na `okres.js`.
- **Progi wejścia w stopnie i tempo gaśnięcia:** „kilka taktów” i „dłużej” to intencja. Liczby
  ZGADNIĘTE w nastawach, do strojenia na nagraniu (niżej) i na kamerze.
- **Nagranie do strojenia:** sesja nagraniowa w Obrzędzie (taniec do pieśni: w rytmie, poza rytmem,
  stałe spóźnienie, połowa tempa), klatki z czasem pieśni. Narzędzie pomiaru drukujące zgodność
  i stopień transu na krok, wzorem `tools/pomiar-jakosci.mjs`. Ustawić nastawy z tabeli, nie z wyobraźni.
- **Technika efektów:** w stylu gry (Canvas2D / istniejące warstwy, kreska zamiast sprite'ów tam,
  gdzie chodzi o ciągłość). Krąg przodków np. z historii masek segmentacji (maska sprzed jednego
  taktu, przesunięta i zmniejszona za graczem, dymna barwa). Echa przez bufor śladu aury.
- **Kolejność wdrażania:** każdy kawałek osobno testowalny, każdy efekt w osobnym commicie
  (odrzucenie = revert). Proponowana kolejność: rytm pieśni → zgodność + aura → trans i mnożniki →
  efekty stopni → technika w transie → Kronika i Księga.
- **Rejestracja nowych modułów ze stanem rundy** w `js/swiezeModuly.js` (strażnik w teście), nastawy
  w nakładce D.

## Decyzje projektanta (zaakceptowane przez właściciela 2026-10-30)

1. Mnożnik transu nie działa na pieczęcie (25 pkt) ani na reakcje między technikami. Reakcje to
   osobna warstwa i już mają własny, zmierzony balans.
2. Trans mnoży się z Zewem (×2) i jakością tańca, bez sufitu. Technika z Zewem w transie 3 = ×4.
3. Zgodność z rytmem mierzona z akcentów ruchu, a nie z okresu tańca (bo ten rzadko jest pewny).
4. Stopnie gasną po kolei, kilka sekund na stopień (liczba do strojenia).

## Weryfikacja

- Testy jednostkowe: analiza rytmu na syntetycznym sygnale (znane BPM i faza), zgodność (ruch w fazie,
  stale spóźniony, losowy, co 2 uderzenia), trans (wejście, dokładanie stopni, łagodne gaśnięcie,
  NaN i brak pieśni), mnożniki (taniec, mana, technika zapisana w chwili rzutu), brak transu poza
  Obrzędem i bez danych rytmu.
- `sh tools/test-wszystko.sh` zielone (poza znanym `test-rozdzielnosc`), w tym strażnik braku dźwięków.
- Pomiar na nagraniu sesji Obrzędu: taniec w rytmie dochodzi do stopnia 3, taniec poza rytmem nie
  wchodzi w trans, stałe spóźnienie nie przeszkadza.
- Test właściciela z kamerą: czy rytm „czuć” w aurze, czy trans nagradza, czy nic nie wygląda na karę.
