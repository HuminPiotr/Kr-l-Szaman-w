# Arsenał cząstek: Kenney Particle Pack a żywioły Kuli Mocy

**Data:** 2026-09-09
**Status:** referencja (nie plan wdrożenia) — materiał pod przyszłe combosy
**Podgląd z miniaturami:** https://claude.ai/code/artifact/68002662-993d-4363-ad13-c27097c63829

Paczka: [Kenney Particle Pack](https://kenney.nl/assets/particle-pack), CC0, 80 plików PNG
512×512 + 16 wariantów obróconych. W repo leży **10 wybranych** plików w
`assets/czastki/` (użyte przez `js/kolowrot.js`). **70 zostaje wolnych.**

Każda z 18 grup została **obejrzana bezpośrednio** — opisy poniżej mówią, jak plik
naprawdę wygląda, nie co sugeruje nazwa.

---

## Dwie nazwy kłamią

Obie pomyłki kosztowałyby dobór assetu w ciemno, więc zapisane jawnie:

- **`spark_*` to NIE punktowe iskry.** To tekstury rozgałęzionych **pęknięć
  elektrycznych** (wyładowanie w chmurze). Trafiają wprost do Peruna, nie do
  ogólnych "iskierek" — do tych ostatnich służą `star_*`.
- **`scorch_*` to NIE wypalony ślad na ziemi.** To promienisty rozbłysk promieni
  z poszarpanym środkiem — moment uderzenia, nie dekal po nim.

---

## Grupy według żywiołu

Kolumna „wolne" liczy pliki nieużyte przez Kołowrót.

### Błyskawica — Perun

| Grupa | Wolne | Jak wygląda (zweryfikowane) | Potencjał |
|---|---|---|---|
| `spark_01–07` | 7/7 | Rozgałęzione pęknięcia elektryczne w chmurze (obejrzane 01, 02, 03, 06) | Najmocniejszy zestaw pod Peruna w całej paczce. Mogłyby dołożyć rozgałęzienia do proceduralnego `piorun.js` albo nieść osobną technikę |

### Ziemia — Weles

| Grupa | Wolne | Jak wygląda (zweryfikowane) | Potencjał |
|---|---|---|---|
| `dirt_01–03` | 3/3 | Rozprysk kanciastych okruchów i kamyków (obejrzane 02) | **Jedyna prawdziwa tekstura ziemi w paczce.** Weles nie ma dziś żadnej własnej faktury |
| `scratch_01` | 1/1 | Trzy ukośne szramy jak ślad pazurów | Rozdarcie / pęknięcie — Weles jako pan podziemia i bramy |
| `smoke_01–10` | 6/10 | Kłęby dymu z prawdziwą teksturą; `10` jest obwarzankiem z dziurą (obejrzane 01, 03, 05, 08, 10) | Kurz, mgła, para. Cztery warianty pracują w Kołowrocie |

### Ogień — Swaróg

| Grupa | Wolne | Jak wygląda (zweryfikowane) | Potencjał |
|---|---|---|---|
| `flame_01–06` | 6/6 | Języki ognia; `06` to wysoki, pionowy jęzor (obejrzane 03, 06) | Liźnięcia płomienia, kolumna ognia |
| `fire_01–02` | 2/2 | Kłąb ognia z gorącym, rozjaśnionym rdzeniem (obejrzane 01) | Rdzeń wybuchu; naturalna para z `flame_*` |
| `muzzle_01–05` | 5/5 | Kroplowaty, spiczasty wybuch kierunkowy (obejrzane 02) | Ogień lecący **z dłoni** — czego piramidka Swaroga dziś nie ma |

### Powietrze — Stribog

| Grupa | Wolne | Jak wygląda (zweryfikowane) | Potencjał |
|---|---|---|---|
| `twirl_01–03` | 3/3 | Spiralne ramiona wiru; `01` to otwarty zawijas C (obejrzane 01, 02) | Trąba powietrzna albo wir wodny — kształt nie do podrobienia gradientem |
| `slash_01–04` | 4/4 | Miękkie łuki i półksiężyce zamachu (obejrzane 02, 04) | Cięcia wiatru; wzmocniłyby Aarda, który dziś jest chmurą kropek |

### Woda — Mokosz

| Grupa | Wolne | Jak wygląda (zweryfikowane) | Potencjał |
|---|---|---|---|
| `trace_01–07` | 7/7 | Faliste nitki i wydłużone smugi (obejrzane 03, 06) | **NIĆ.** Mokosz jest prządką losu — najmocniejsze tematyczne dopasowanie w paczce |
| `circle_01–05` | 5/5 | Czyste, cienkie pierścienie (`02`) i miękkie obwarzanki (`05`) | Kręgi na wodzie; `circle_02` to gotowa ostra obręcz |

### Uniwersalne

| Grupa | Wolne | Jak wygląda (zweryfikowane) | Potencjał |
|---|---|---|---|
| `star_01–09` | 6/9 | Iskierki 4-ramienne (`02/04/07`) i 6-ramienna (`09`) | Drobiny i błyski; `09` wolna |
| `magic_01–05` | 3/5 | `01`/`02` to kręgi runiczne (pięcio-/ośmiokąt) — **użyte**; `03–05` to rozbłyski-diamenty | `03–05` gotowe jako błyski pojedynczych pieczęci |
| `scorch_01–03` | 3/3 | Promienisty wybuch promieni (obejrzane 01) | Moment uderzenia: piorun w grunt, eksplozja |
| `light_01–03` | 2/3 | Miękkie poświaty; `01` z pierścieniami (**użyty**), `03` to zwykła plama | `03` wnosi najmniej — to praktycznie to, co i tak generujemy proceduralnie |
| `flare_01` | 1/1 | Pozioma smuga lens-flare z gwiazdką | Uwaga: czyta się jak **artefakt obiektywu**, nie jak magia |

### Odrzucone

| Grupa | Dlaczego |
|---|---|
| `symbol_01–02` | Płaskie serce i płaska gwiazdka — nie pasuje do słowiańskiego szamanizmu |
| `window_01–04` | Szyby okienne (prostokąty). Tylko `04` (krata rombów) ma sens jako kryształ/szron |

### Warianty obrócone (16 plików)

`Rotated/` zawiera obrócone kopie **wyłącznie** grup wydłużonych/kierunkowych:
`flame_05/06`, `muzzle_01–05`, `spark_05/06`, `trace_01–07`. Przydatne, jeśli
technika potrzebuje kierunku innego niż domyślny, bez obracania przez `ctx.rotate()`.

---

## Wolne pary żywiołów

Pięć istniejących combosów (`js/kombosy.js`) pokrywa większość par. Zostały **dwie
niezajęte** — obie z powietrzem:

| Para | Stan | Assety, które by ją niosły |
|---|---|---|
| **Ziemia + Powietrze** | wolna | `dirt_*` + `twirl_*` + `smoke_*` — kurzawa, słup pyłu |
| **Błyskawica + Powietrze** | wolna | `spark_*` + `slash_*` + `trace_*` — front burzowy |
| Woda solo | brak własnej techniki | `circle_*` (kręgi na wodzie) + `trace_*` (nić losu) |
| Ziemia solo | brak własnej techniki | `dirt_*` + `scratch_01` |

---

## Cztery gotowe propozycje

Sekwencje **sprawdzone pod kątem kolizji sufiksów** z pięcioma istniejącymi
combosami (silnik dopasowuje KOŃCÓWKĘ bufora — kolizja odpalałaby cichaczem złą
technikę). Kolejność dobrana też tak, by `weles` nadal **nigdy nie rozpoczynał**
sekwencji — na tym niezmienniku opiera się test `k2` w `tools/test-kombosy.mjs`.

| Nazwa | Sekwencja | Pewność złożenia | Assety |
|---|---|---|---|
| **Studnia Mokoszy** | `mokosz → mokosz` | najwyższa (0,97–1,00 ×2) | `circle_01–05`, `trace_*`, `light_02` |
| **Gniew Peruna** | `perun → perun` | wysoka (0,70–1,00 ×2) | `spark_01–07`, `scorch_*`, `star_09` |
| **Kurzawa** | `stribog → weles` | średnia (stribog 0,40–0,93) | `dirt_*`, `twirl_*`, `smoke_*` |
| **Wichura** | `stribog → perun` | średnia (stribog 0,40–0,93) | `slash_*`, `spark_*`, `trace_*` |

Pewność złożenia = zmierzone wyniki pieczęci z nagrań w `tools/test-rozdzielnosc.mjs`.

> **Uwaga do `weles → weles`:** technicznie wolna i bez kolizji, ale złamałaby
> niezmiennik „weles nigdy nie rozpoczyna sekwencji". Wymagałaby zmiany komentarza
> i asercji przy teście `k2`.

---

## Najkrótsza droga do największego zysku

Nie nowe combo, tylko podmiana faktury w tym, co **już działa**:

- `fala.js` rysuje czoło fali z rozmytych plam gradientowych — **`circle_02` to
  gotowa, czysta obręcz**. Jedna podmiana sprite'a, natychmiast ostrzejsza fala
  uderzeniowa dla Aarda i Gromu w Ziemię.
- `iskry.js` sypie gradientowymi kropkami — **`star_*` / `spark_*`** dałyby im
  kształt zamiast samej jasności.
- `ogien.js` to wyłącznie gradienty radialne — **13 plików ognia** leży nietkniętych.
- `piorun.js` ma już twardą krawędź, ale **`spark_*`** dołożyłyby rozgałęzień,
  których rekurencyjne przesunięcie punktu środkowego nie generuje.

---

## Największa blokada nie jest graficzna

Najbogatszy nietknięty zestaw to **ogień (13 plików)**, ale piramidka Swaroga
rozpoznaje się **najgorzej ze wszystkich pieczęci** (0,21–0,59). Podobnie powietrze
(0,40–0,93) blokuje **obie** wolne pary żywiołów.

**Poprawa rozpoznawania tych dwóch pieczęci odblokowuje więcej assetów niż
jakiekolwiek nowe combo.** To też jest główna przyczyna, dla której
`tools/test-rozdzielnosc.mjs` świeci na czerwono.
