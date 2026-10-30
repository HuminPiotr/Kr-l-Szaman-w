# Słuch: trans do dowolnej muzyki (YouTube i każde inne źródło)

## Po co

Trans (spec 2026-10-30-trans-design.md) działa dziś tylko z 4 pieśniami Suno, bo ich rytm jest
wyliczony z góry z pliku. Właściciel chce tańczyć ze wszystkimi efektami (aura w takt, zgodność,
trzy stopnie transu, technika na uderzenie) **do dowolnej muzyki zalinkowanej z YouTube**, i to
**w każdym trybie** (Obrzęd, Próba, swobodny), nie tylko w Obrzędzie.

## Ograniczenie, które wyznacza rozwiązanie

Strona gry **nie ma dostępu do dźwięku odtwarzacza YouTube**: to osadzona ramka z innej domeny,
przeglądarka nie daje do niej Web Audio. Pobieranie dźwięku z YouTube łamie jego regulamin, więc
odpada. Jedyna uczciwa droga to ta sama, którą ma człowiek: **słuchać** tego, co leci z głośników,
przez mikrofon. (To etap 2 „słuch” z planu 2026-10-14; właściciel wtedy wybrał mikrofon.)

Zaakceptowane przez właściciela (2026-10-30): mikrofon; przy słuchawkach trans działa tylko dla
pieśni już „nauczonych”; słuch działa w każdym trybie.

## Cele

1. **Słuch na żywo:** z mikrofonu, na bieżąco, tempo i położenie uderzeń - dla dowolnej muzyki
   w pokoju (YouTube w grze, Spotify w tle, muzyka grana na warsztatach).
2. Uderzenia ze słuchu zasilają **wszystko, co już jest**: tyk aury, zgodność, trans, efekty
   stopni, technikę na uderzenie, mnożniki. Bez osobnych ścieżek.
3. **Nauka pieśni z YouTube:** gdy pieśń z YouTube gra w grze, słuch zapisuje uderzenia względem
   czasu odtwarzacza (`getCurrentTime()`). Po rundzie rytm zostaje zapamiętany dla tego filmu;
   przy kolejnym graniu gra zna go dokładnie, jak pieśni Suno - bez mikrofonu, także na słuchawkach.
4. **Tempo, które się zmienia** (zwolnienia, przyspieszenia, przejścia): słuch idzie za muzyką,
   nie trzyma się jednego tempa całej pieśni.
5. Przy okazji (tanio): **własne pieśni z dysku** (menu, `js/wlasnePiesni.js`) dostają rytm
   liczony od razu w przeglądarce z pliku (`analizujRytm`), bez mikrofonu.

## Nie-cele

- Pobieranie / przechwytywanie dźwięku z YouTube (regulamin, technicznie zablokowane).
- Rozpoznawanie utworu, tekstu, gatunku.
- Puls samego tańca bez muzyki (osobny, późniejszy etap).
- Synchronizacja wielu urządzeń.

## Anty-cele

- **Coś mówi „źle”** (GEMINI.md §2): brak mikrofonu, odmowa zgody, cisza, słuchawki, reklama na
  YouTube, rozmowy w pokoju - słuch po prostu „nie słyszy rytmu”, trans łagodnie gaśnie. Żadnych
  błędów, alarmów ani napisów porażki.
- **Nowy dźwięk w grze.** Słuch tylko słucha: sygnał mikrofonu NIGDY nie idzie do głośników
  (sprzężenie!) i gra nie dodaje dźwięków (strażnik `tools/test-brak-efektow-dzwiekowych.mjs`).
- **Prywatność:** dźwięk z mikrofonu jest analizowany lokalnie, w pamięci. Nigdy nie jest
  nagrywany do pliku ani wysyłany. Nagrania sesji (narzędzia dewelopera) zapisują wyłącznie
  obwiednię uderzeń (liczby), nie dźwięk.
- **Trans skaczący od fałszywych uderzeń** (mowa, tupanie): niepewny słuch = brak rytmu, nie zły rytm.

## Ograniczenia i stan obecny

- Rytm w grze to dziś `rytmTeraz()` w `js/main.js` → `{ siatka: SiatkaUderzen, czasS }` tylko dla
  `Piesn` z rytmem w manifeście. Wszystko dalej (`ZgodnoscRytmu`, `Trans`, `TransEfekty`, aura,
  `KolejkaTaktu`) używa tylko interfejsu siatki: `faza(tS) → {indeks, faza01, okresS}`,
  `nastepneUderzenieS(tS, maxS)`, `okresS`. Słuch ma dostarczyć obiekt o tym samym interfejsie.
- Analiza offline `js/rytm/analizaRytmu.js` (obwiednia z przewagą basu, autokorelacja, grzebień,
  śledzenie Ellisa) - do ponownego użycia w wersji strumieniowej.
- `PiesnYoutube` (`js/piesni.js`): IFrame API, `getCurrentTime()` dostępne, `czasS` dziś zwraca null.
- Kamera: `getUserMedia({ video })` w `main.js` (bez audio). `audioEngine` ma własny `AudioContext`
  tworzony w geście „Rozpal ogień”.
- Głośniki laptopa mają słaby bas - waga basu z analizy plików (0.7) może nie pasować do mikrofonu.
- Opóźnienie: dźwięk z głośnika → powietrze → mikrofon → analiza. Zgodności stałe przesunięcie
  nie przeszkadza (koherencja), ale tyk aury i technika na uderzenie muszą trafiać w bęben.

## Jak (ustalone)

- Mikrofon, analiza lokalna, tylko liczby.
- Kolejność źródeł rytmu w każdej klatce: (1) plik z rytmem (manifest / własny plik), (2) nauczona
  pieśń z YouTube (czas z odtwarzacza), (3) słuch na żywo, gdy pewny. Inaczej brak rytmu.
- Słuch działa w każdym trybie; w Próbie i swobodnym jest jedynym źródłem rytmu.
- Nauczony rytm YouTube zapamiętywany per film, trwale (localStorage), ulepszany przy kolejnych graniach.

## Pozostawione wykonawcy (z intencją)

- **Przechwyt:** osobne `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false,
  autoGainControl: false } })` - tłumienie echa usuwałoby właśnie muzykę z głośników. Kiedy prosić
  o zgodę: decyzja projektanta niżej. Mikrofon podłączony tylko do analizy, nie do `destination`.
- **Obwiednia na żywo:** AudioWorklet liczący przyrost widma w ramkach ~10 ms ze znacznikiem czasu
  `AudioContext`; awaryjnie AnalyserNode w pętli klatek. Waga basu dla mikrofonu - z pomiaru.
- **Śledzenie na żywo:** przesuwne okno ~8 s; tempo z autokorelacji co ~0.5 s z histerezą (zmiana
  tempa przyjęta, gdy się powtarza), faza z grzebienia na ostatnich sekundach, korekty fazy
  łagodne (pętla fazowa). Pewność z siły grzebienia; poniżej progu → brak rytmu.
- **Opóźnienie:** szacunek z `AudioContext.baseLatency/outputLatency` i ustawień ścieżki mikrofonu,
  poprawka ręczna w nakładce D (strzałki), zapamiętana. Narzędzie pomiaru wyznacza je z nagrania.
- **Nauka YouTube:** mapowanie uderzeń słuchu na czas odtwarzacza (próbkowany co klatkę),
  zapis po rundzie, jeśli pokrycie i pewność wystarczają; łączenie z wcześniejszą wersją.
- **Walidacja na prawdziwych danych:** pieśni Suno puszczone przez głośniki = wzorzec (ich rytm
  znamy z pliku). Sesja nagraniowa zapisuje obwiednię mikrofonu + czas pieśni; narzędzie liczy błąd
  uderzeń, czas złapania rytmu, zachowanie przy przejściach.

## Decyzje projektanta (do sprawdzenia przez właściciela)

1. O zgodę na mikrofon gra prosi przy „Rozpal ogień” (ten sam gest co kamera), z krótkim zdaniem
   „Gra słucha muzyki, żeby tańczyć w jej rytm. Dźwięk nie jest nigdzie zapisywany.” Odmowa = gra
   bez słuchu, bez komunikatu błędu.
2. Słuch jest zawsze włączony (gdy jest zgoda); osobnego przełącznika w menu nie ma - w nakładce D
   widać, co słyszy.
3. Nauczone rytmy YouTube trafiają też do eksportu/importu Księgi (żeby przenieść je na komputer
   warsztatowy).

## Weryfikacja

- Testy jednostkowe: obwiednia strumieniowa = offline na tym samym PCM; śledzenie na żywo na
  syntetyce (stałe tempo, zmiana tempa, przerwa bez bębna, mowa/szum) - błąd uderzeń, czas złapania,
  brak rytmu w ciszy; kolejność źródeł rytmu; nauka YouTube (mapowanie, zapis, łączenie).
- Pomiar: pieśni Suno przez głośniki laptopa → błąd uderzeń słuchu względem pliku < ~40 ms po
  złapaniu, złapanie < ~8 s; pieśń z YouTube dwa razy - drugi raz rytm z pamięci.
- Test właściciela: YouTube w Obrzędzie, Spotify w tle w trybie swobodnym, ta sama pieśń drugi raz
  na słuchawkach.
