# Dodola — zaklinanie deszczu (woda → woda → powietrze)

## Context
Właściciel chce, żeby najlepsze techniki wymagały płynnego, wężowego ruchu. Ustaliliśmy wzorzec
„zaklinania”: combo otwiera stan, w którym POSTAWA + JAKOŚĆ RUCHU ciągle steruje natężeniem efektu.
Pierwsza technika tego typu to deszcz: ramiona rozpostarte na boki i falujące; wężowa fala →
ulewa, słaba → kilka kropel, nigdy zero (reguła „nic nie mówi źle”). Eksperyment C (commit c32c184,
nagranie `tools/probki/probki-2026-10-09-14-18-46.json`) potwierdził, że sonda
`js/ruchy/falowanieRamion.js` rozdziela falę wężową / sztywne skrzydło / ruchy niedbałe.

Decyzje właściciela: sekwencja **mokosz → mokosz → stribog** (nazwa robocza **Dodola** — słowiański
obrzęd wywoływania deszczu tańcem); deszcz **na cały kadr od razu** (rośnie gęstość/siła);
trwa **dopóki gracz faluje** (kanałowane, lekki pobór mocy, sufit czasu); krople **odbijają się od
ciała**; **punkty za natężenie**; reakcje: **Tęcza po deszczu, Burza w deszczu, deszcz gasi Płonący Palec** (tylko palec).

## Projekt

### 1. Miara → jakość (`js/ruchy/falowanieRamion.js`, ze sondy)
- Usunąć `gladkosc` (nie rozdzielała niczego w pomiarze).
- Dodać czystą funkcję `jakoscFali(laczne)` → 0..1:
  `rozpostarcie × rampa(amplituda,.08,.3) × rampa(korelacja,.45,.8) × (0.25 + 0.75·węż)`,
  `węż = ½·rampa(zgiecie,.45,.75) + ½·rampa(opoznienie,.02,.10)`. Progi w `NASTAWY` (strojenie z HUD).
- Zmierzone na nagraniu: wąż 0.63–0.97, skrzydło 0.14–0.25, niedbale 0–0.28, bez ruchu/taniec 0.

### 2. Stan zaklinania (`js/zaklinanie.js`) — ogólny, nic nie wie o deszczu
- `zapal()` otwiera stan (powtórne combo w trakcie = restart sufitu czasu).
- `GLUCHE_S ≈ 1.0` po zapaleniu (wyjście z pieczęci powietrza, rozgrzanie okna miary 2 s).
- `natezenie` = EMA jakości: narastanie τ≈1.5 s, opadanie τ≈2.5 s, **podłoga 0.08** (mżawka zawsze).
- Koniec: jakość < `PROG_PODTRZYMANIA` (≈0.15) przez `CISZA_S` ≈3 s (liczone dopiero po
  `GWARANCJA_S` ≈3 s od startu) **albo** sufit `MAX_S` ≈20 s **albo** brak mocy → faza
  `CICHNIECIE_S` ≈3 s (natężenie płynnie do zera).
- `update(worldLandmarks, moc, dt)` zwraca pobór mocy (`POBOR_NA_S` ≈0.02 × (0.3+0.7·natężenie)),
  pobierany w main.js przez `motionMeter.zuzyj()` — wzorzec Płonącego Palca (`js/main.js` ~l.955).
- Przyjmuje „miarę” jako zależność (`new Zaklinanie({ miara: new FalowanieRamion(), jakosc: jakoscFali })`),
  żeby lawa/wichura podpięły własną miarę bez zmian w stanie.

### 3. Wygląd (`js/deszcz.js`, klasa `Dodola` = Zaklinanie + rysowanie)
- **Krople = kreski** (pamięć projektu: efekt ciągły = kreska). Pula smug spadających z góry przez cały
  kadr; liczba `12 → ~420` (∝ natężenie^1.5), prędkość i długość rosną, lekki skos 8°→15° przy ulewie.
  Materia, nie energia: `source-over`, blady chłodny błękit, rysowane wsadowo (jedna ścieżka na kubeł alfy).
- **~70% kropel na warstwie ZA sylwetką** (`js/warstwaZaSylwetka.js`), ~30% przed ciałem.
- **Odbicia od ciała:** kropla z tylnej warstwy, której głowa trafia w maskę segmentacji
  (`kontekstTechnik.maska/maskaSzer/maskaWys/fit`, mapowanie jak `zaplon.js`), ginie i robi
  **rozprysk**: 2–5 kropelek w górę/na boki po paraboli (grawitacja, życie 0.25–0.5 s) jako krótkie kreski
  wzdłuż prędkości, na warstwie PRZED ciałem. Głowa, barki i rozpostarte ramiona to naturalne
  powierzchnie. Czysta funkcja `trafienieWMaske(x, y, maska, szer, wys, fit)` (testowalna).
  Sufity: rozprysków na klatkę ≈40, kropelek ogółem ≈600.
- Drobne rozpryski przy dolnej krawędzi kadru (podłogi zwykle nie widać).
- Ulewa: delikatne przyciemnienie kadru `∝ natężenie²` (bez dźwięku — reguła „gra bez SFX”).
- Skala kropel/rozprysków z `barkiKlatki().skala` (`js/sledzenie.js`), nie ze stałych px.
- `wymusNatezenie` (null domyślnie) — tylko do podglądu w `tools/scena.html`.

### 4. Combo i kolizja z Tęczą (`js/kombosy.js`)
- Wpis `{ id:'dodola', nazwa:'Dodola', sekwencja:['mokosz','mokosz','stribog'], uzbraja:'dodola' }`.
- Trzymana dłużej woda składa się ponownie (`js/pieczecie.js:144`), więc Tęcza z przytrzymaną miską
  dawałaby deszcz. Dopisać warianty Tęczy `swarog,mokosz,mokosz,stribog` i
  `swarog,mokosz,mokosz,mokosz,stribog` (`id:'tecza'`, `wariant:true`) **przed** Dodolą.
  Zasada: ogień na początku → Tęcza, bez ognia → deszcz.
- `tools/test-kombosy.mjs`: strażnik prefiks/sufiks pomija wpisy `wariant:true`, za to jawne asercje
  kolejności; dodać `'dodola'` do `ZNANE_UZBRAJA`; przypadki: `mo,mo,st`→dodola, `sw,mo,mo,st`→tecza,
  `sw,mo,mo,mo,st`→tecza, `st,mo,mo,st`→Mgła na 2. pieczęci, potem dodola.

### 5. Wpięcie
- `js/techniki.js`: gałąź `dodola` → `s.dodola.zapal()`; `BARWA_ZAPLONU.dodola` (chłodny błękit wody).
- `js/swiezeModuly.js` (+ lista w strażniku), `js/main.js`: update z poborem mocy obok Płonącego
  Palca; `updateAndDraw(ctx, kontekstTechnik, dt)` obok Mgły; diagnostyka do `debugHud` (natężenie,
  jakość i składniki miary — potrzebne do strojenia na kamerze).
- `tools/scena.html`: przycisk techniki (z KOMBOSY) + suwak natężenia (wymusNatezenie).

### 6. Punkty (`js/punkty.js`)
- `punkty.zaklinanie(natezenie, dt)` → warstwa `techniki`, `PUNKTY_ULEWY_NA_S ≈ 30 × natężenie²`
  (pełna ulewa 20 s ≈ 600 pkt, ok. 1,75× wartości samej techniki = 340). Sufit dt jak przy tańcu.
  Kwadrat celowo: wężowa fala opłaca się wyraźnie bardziej niż machanie.

### 7. Reakcje (`js/reakcjeTechnik.js`, każda osobnym commitem, wpis w `REAKCJE`)
- **Tęcza po deszczu:** Tęcza odpalona, gdy pada → premia (jednorazowa, ≈150 pkt).
- **Burza w deszczu:** piorun Gromu w Ziemię / Łuk Peruna / Grzmot w trakcie deszczu → krople w zasięgu
  błysku jaśnieją na ~0.12 s (`dodola.blysk(zrodlo, sila)`, wzorzec `mglaMokoszy` BLYSK_*); punkty jak
  Burza w mgle.
- **Płonący Palec gaśnie w deszczu** (decyzja właściciela: TYLKO on — Błędne Ogniki i płonący dym
  zostają nietknięte). Przy natężeniu > ~0.3 płomień słabnie przez ~1 s, gaśnie z obłoczkiem pary
  (`plonacyPalec._zgas()` przez nowe publiczne `zgasDeszczem()`); punkty za zgaszenie (reakcja „Syk”),
  więc to nagroda, nie strata. Po deszczu gracz może zapalić palec ponownie normalnym gestem.

## Kolejność (jeden krok = jeden commit, każdy do odrzucenia po teście na kamerze)
0. Spec `docs/superpowers/specs/2026-10-09-dodola-zaklinanie-design.md` (treść tego planu) + wpis w pamięci.
1. Miara: `jakoscFali`, bez gładkości + `tools/test-falowanie.mjs` (strażnik na nagraniu).
2. `js/zaklinanie.js` + `tools/test-zaklinanie.mjs`.
3. `js/deszcz.js` (krople + rozpryski) + `tools/test-deszcz.mjs` (czyste funkcje, NaN, sufity).
4. Combo + warianty Tęczy + techniki.js + swiezeModuly + main.js + debugHud + scena.html.
5. Punkty za ulewę.
6–8. Reakcje: Tęcza po deszczu → Burza w deszczu → deszcz gasi Płonący Palec.

## Verification
- `sh tools/test-wszystko.sh` — wszystko zielone poza znanym `test-rozdzielnosc.mjs` (przejścia
  ogień/powietrze, problem sprzed tej zmiany).
- `tools/test-falowanie.mjs` na nagraniu: mediana jakości wąż ≥ 0.5 w każdym powtórzeniu,
  skrzydło ≤ 0.35, niedbale ≤ 0.3, bez ruchu i taniec ≤ 0.05.
- `node tools/pomiar-falowania.mjs` nadal działa (sonda bez `gladkosc`).
- Podgląd bez kamery: `python3 -m http.server 8000` z korzenia → `localhost:8000/tools/scena.html`,
  przycisk Dodola, suwak natężenia 0→1 (mżawka → ulewa, rozpryski na syntetycznej sylwetce).
- Test właściciela na kamerze: woda, woda, powietrze → rozpostarte ramiona → falowanie; nakładka D
  pokazuje natężenie i składniki miary do strojenia progów.
