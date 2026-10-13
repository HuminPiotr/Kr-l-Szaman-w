# Fala Mokoszy i Kruki — dwie nowe trójki (spec + plan)

## Context
Właściciel chce dwóch nowych technik trzypieczęciowych (poziom „zjawisko” na drabinie):
1. **Fala Mokoszy** (mokosz → stribog → mokosz): po combo gracz zamachami ręki z dołu do góry
   przywołuje fale wodne z tej samej strony (prawa ręka → z prawej, lewa → z lewej), do 4 fal —
   tylko bardzo szybki i czysty gracz zdąży wszystkie.
2. **Kruki** (weles → stribog → perun): z cienia za sylwetką wylatuje stado mrocznych kruków;
   jeden przelatuje przez namiot palców Iglicy Peruna (pieczęć błyskawicy nad głową) i leci wprost na ekran.

Decyzje właściciela (2026-10-13): strona fali = ta sama co ręka; max 4 fale w krótkim oknie;
kruki z cienia + kruk na ekran; **na start bez reakcji z polami** (osobna runda po teście na kamerze).

Pierwszy krok wykonania: zapisać tę sekcję spec do
`docs/superpowers/specs/2026-10-13-fala-i-kruki-design.md` i zacommitować.

## Wspólny wzorzec (jak Zawierucha / Grzmot)
Na technikę: wpis w `KOMBOSY` (`js/kombosy.js`), moduł `js/<id>.js` z klasą (`zapal()`, `aktywny`,
`updateAndDraw(ctx, kontekstTechnik, dt)`, `diagnostyka`), gałąź `uzbraja` w `js/techniki.js`
(+ barwa w tabeli barw), rejestracja w `js/main.js` (import, instancja, updateAndDraw ~l.1060,
diagnostyka nakładki D ~l.1177) i `js/swiezeModuly.js` (lista + `new`), emblemat w `js/emblematy.js`,
test `tools/test-<id>.mjs`, scenariusz w `tools/scena.html`. Punkty: standard trójki (sekwencja).
Jedna technika = jeden commit (odrzucenie = `git revert`).

## 1. Fala Mokoszy — `js/falaMokoszy.js`
- Id `falaMokoszy` (`fala` zajęte przez `js/fala.js`). Wpis w `KOMBOSY` **przed `mglaMokoszy`**
  — `_dopasuj()` zwraca pierwsze trafienie w ogonie, a ogon stribog→mokosz to Mgła.
- **Sterowanie** (NASTAWY, zgadnięte, strojenie z nakładki D): `OKNO_S ≈ 2.0`, `GLUCHE_S ≈ 0.25`,
  `MAX_FAL: 4`. Każdy zamach w górę → jedna fala ze strony ręki (P → prawa krawędź, L → lewa,
  w obrazie lustrzanym). Brak zamachu → po oknie jedna samoczynna fala, strona na zmianę (GEMINI.md §2).
- **Detektor**: rozszerzyć `DetektorMachniec` w `js/machniecie.js` o opcję osi
  (`{ os: 'poziom' | 'gora' }`, domyślnie poziom — Zawierucha bez zmian). Dla `gora`: składowa
  vy < 0 ponad `PROG_PREDKOSCI_GORA` (szer. barków/s), kierunkowość pionowa, nadgarstek na starcie
  poniżej linii barków; `PRZERWA_REKI_S` połyka opadnięcie ręki. Te same wzorce bufora/potwierdzenia.
- **Wygląd**: materia, source-over (lekcja Kurzawy). Grzbiet = kreska po węzłach (pamięć „kreska,
  nie sprite”) + wypełnienie gradientem wody + piana na grzebieniu (`circle_*`/`trace_*` jako drobne
  krople, opcjonalnie). Fala wzbiera z krawędzi w pasie biodra–barki (zaczep `barkiKlatki`, nie dłonie),
  zawija się i przetacza przez kadr (~1 s), przy sylwetce rozprysk kropli; część piany na
  `WarstwaZaSylwetka`. Fale z przeciwnych stron mogą się minąć/nałożyć — bez specjalnej logiki.
- Emblemat: grzbiet fali z zawinięciem; legenda „Woda, wiatr i znów woda — Mokosz posyła falę.”

## 2. Kruki — `js/kruki.js`
- Id `kruki`. Prefiks weles→stribog odpala po drodze Zawieruchę — celowy łańcuch, bez zmian w silniku.
- **Stado**: ciemna mgiełka wzbiera za sylwetką na wysokości barków (`WarstwaZaSylwetka`,
  `smoke_*` przyciemniony, source-over), wyrywa się z niej 12–18 kruków rozlatujących się na boki
  i w górę poza kadr; ~3 s; czarne pióra opadają. Kruk = proceduralna sylwetka kreską (tułów + dwa
  łuki skrzydeł, faza machania, lekki losowy tor) — brak assetu.
- **Kruk na ekran**: startuje ze środka nadgarstków pozy (15, 16) z chwili zapalenia (dłonie nad
  głową MediaPipe widzi tylko w 31% klatek — `js/znaki/perun.js`); fallback: punkt nad głową
  z `barkiKlatki`. Rośnie wykładniczo ku kamerze, macha skrzydłami, dochodzi do ~70% kadru,
  znika w chmurze piór z krótkim przyciemnieniem kadru (~1.2 s, rysowany przed sylwetką).
- Barwa: prawie czerń z chłodnym połyskiem (np. [25, 22, 35]); bez 'lighter'.
- Emblemat: sylwetka kruka; legenda „Ziemia, wiatr i grom — z cienia Welesa zrywają się kruki.”

## Krytyczne pliki
`js/kombosy.js`, `js/machniecie.js`, `js/techniki.js`, `js/main.js`, `js/swiezeModuly.js`,
`js/emblematy.js`, nowe `js/falaMokoszy.js`, `js/kruki.js`; reuse: `barkiKlatki`/`Kotwica`
(`js/sledzenie.js`), `WarstwaZaSylwetka`, `DetektorMachniec`, wzorzec `js/zawierucha.js`.

## Kolejność commitów
1. Spec do `docs/superpowers/specs/`.
2. `machniecie.js`: oś `gora` + testy (Zawierucha bez regresji: `tools/test-zawierucha.mjs`).
3. Fala Mokoszy (moduł, wpis przed Mgłą, wpięcie, emblemat, test, scenariusz sceny).
4. Kruki (moduł, wpięcie, emblemat, test, scenariusz sceny).
5. Aktualizacja GEMINI.md (lista technik) + pamięć projektu.

## Weryfikacja
- `node tools/test-kombosy.mjs` — nowy przypadek: m,s,m → `falaMokoszy` (nie Mgła); w,s,p → `kruki`
  (a w,s → zawierucha po drodze).
- `node tools/test-falaMokoszy.mjs` — zamach w górę wykryty, poziomy nie; strona = ręka; limit 4;
  głucha faza; samoczynna fala bez zamachu. `node tools/test-kruki.mjs` — zaczep z nadgarstków
  i fallback, wygaśnięcie, `aktywny` false po czasie.
- Pozostałe testy `tools/test-*.mjs` (w tym `test-zawierucha`, `test-reakcje-technik`, `test-punkty`).
- Zrzuty headless `tools/scena.html?scenariusz=falaMokoszy|kruki&t=…`.
- Test na kamerze przez właściciela (nakładka D do strojenia progów zamachu).
