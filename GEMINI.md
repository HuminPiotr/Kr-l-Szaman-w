# Projekt: Kula Mocy - funkcja "Power Charge"

## 1. Cel Projektu i Opis
Tworzymy webową aplikację AR z trackingiem dłoni, służącą jako demo na warsztaty z vibe codingu. Główną funkcjonalnością jest "Power Charge" – ładowanie kuli energii sterowane ułożeniem dłoni w czasie rzeczywistym.
- **Grupa docelowa:** Studenci i uczestnicy warsztatów.
- **Wersja:** MVP / live demo nastawione na szybki efekt "WOW".

## 2. Tech Stack i Architektura (MVP)
- **Typ aplikacji:** Front-end only (uruchamiana w całości w przeglądarce).
- **Technologie podstawowe:** HTML, CSS, JavaScript (Vanilla).
- **Tracking dłoni:** MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`, ustawienia: `numHands: 2`, `runningMode: "video"`).
- **Renderowanie grafiki:** Canvas / WebGL (do rysowania kuli i cząsteczek).
- **Baza danych / Backend:** **BRAK w MVP.** Cały stan (rozmiar kuli, pozycje dłoni) żyje w pamięci przeglądarki i znika po zamknięciu sesji. Gwarantuje to prostotę i niezawodność na pokazach live.

## 3. User Flow (Happy Path)
1. Użytkownik wchodzi na stronę, klika **START**.
2. Akceptuje dostęp do kamery, włącza się podgląd na żywo (obraz lustrzany / selfie).
3. Pojawia się podpowiedź UI: **„Złóż dłonie w miseczkę naprzeciw siebie 🙌"**.
4. Użytkownik składa dłonie w optymalnej odległości naprzeciwko siebie.
5. Między dłońmi renderuje się jasna kula energii. Kula **płynnie rośnie** przy optymalnym ułożeniu i **maleje** przy złym.

## 4. Kryteria Sukcesu (DONE)
- **Szybkość:** Kula pojawia się w < 2s od pierwszego poprawnego ułożenia rąk. Działa intuicyjnie przy pierwszej próbie.
- **Płynność:** Reakcja kuli (wzrost/spadek) jest płynna, wygładzona, bez skoków i migotania.
- **Stabilność i Odporność:** Zapewnione min. ~24 FPS na typowym laptopie w standardowym oświetleniu sali. Logika musi normalizować odległość między dłońmi na podstawie ich rozmiaru na ekranie (aby system działał dobrze niezależnie od odległości studenta od kamery).

## 5. Przyszły rozwój (Post-MVP / Opcjonalnie)
*Te założenia wdrażamy tylko na wyraźne polecenie przejścia do fazy V2.*
Jeśli aplikacja będzie rozbudowywana o *Leaderboard* i *Show Off Mode*:
- **Baza danych (Tabele):** `sessions` (id, nickname), `scores` (id, session_id, max_charge, duration_held_ms), opcjonalnie `clips` (linki wideo w storage).
- **API Endpoints:** 
  - `POST /sessions` (tworzy sesję)
  - `POST /scores` (zapisuje wynik z max_charge)
  - `GET /leaderboard` (zwraca top N wyników)
  - `POST /clips` i `GET /clips/:id` (obsługa nagrań).
