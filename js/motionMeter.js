/**
 * MotionMeter - ciągłość ruchu zamieniona na moc.
 *
 * Silnik mocy całej gry: moc rośnie dopóki się ruszasz, opada gdy stoisz.
 * ŻADNEJ oceny tego, JAK się ruszasz - nie ma dobrych i złych ruchów.
 * Nie ma też punktów, timera ani porażki. To ma być relaks, nie egzamin.
 *
 * Wejście: pose.worldLandmarks - metryczne 3D w metrach, więc niezależne od
 * odległości gracza od kamery. Nie normalizować ręcznie.
 *
 * ZASTRZEŻENIE DO SPRAWDZENIA: pose worldLandmarks mają początek układu
 * w środku bioder, więc kodują ruch kończyn WZGLĘDEM tułowia, a nie
 * przemieszczenie całego ciała. Taniec w miejscu - w porządku. Szaman
 * krążący wokół ognia - może być niewidoczny. Jeśli krok w bok nie rusza
 * wskaźnika, dołożyć drugi składnik: przemieszczenie środka bioder
 * (punkty 23 i 24) liczone z landmarks 2D. NIE budować tego z góry -
 * najpierw zmierzyć, czy w ogóle jest problem.
 */

// --- Strojenie ---
// Te liczby są ZGADNIĘTE i wymagają dostrojenia na żywym ciele.
// Nakładka debug (klawisz D) pokazuje surową prędkość w m/s - stroić z niej,
// nie z wyobraźni.
// PODŁOGA SZUMU. Zmierzone: stanie na baczność pokazuje ~0.5 m/s, mimo że
// gracz się nie rusza. To drgania trackingu, nie ruch. Bez odjęcia tego
// progu gra nigdy nie uzna, że gracz stoi, i moc nigdy nie opadnie.
// Odejmujemy u ŹRÓDŁA, zamiast podnosić progi w kilku miejscach osobno.
// Po wprowadzeniu wygładzania pozycji szum spadł ~32x (zmierzone na
// symulacji: 2.22 -> 0.07 m/s przy bezruchu), więc próg jest teraz
// odpowiednio niższy. Zostawiony margines nad resztkowym szumem.
const PROG_SZUMU_MS = 0.15;

// Skala liczona już na prędkości EFEKTYWNEJ (po odjęciu szumu).
// Zmierzone na żywym tańcu: spokojnie do ~1.4 m/s surowo (~0.8 efektywnie),
// energicznie do 6 m/s surowo (~5.4 efektywnie).
// Ustawione na ZMIERZONYCH wartościach z nakładki (nie na oszacowaniu):
//   stanie w miejscu -> 0.00 efektywnych  (zanik)
//   spokojny taniec  -> 0.30 zmierzonych  = 0.15 efektywnych
//   energiczny       -> 0.67 zmierzonych  = 0.52 efektywnych
// Próg dobrany tak, by SPOKOJNY taniec ładował w ~10 s - to jest tryb
// podstawowy gry, nie tryb premiowy. Energiczny wysyca skalę i daje ~8 s.
const PROG_PELNEJ_MOCY = 0.25; // m/s efektywnych -> pełne tempo ładowania

// Odpowiedź jest pierwiastkowa, nie liniowa: hojna przy wolnym ruchu
// (delikatne kołysanie ma sensownie ładować), ale zostawia zapas skali
// na ruch energiczny. Liniowa albo dławiła wolnych, albo wysycała szybkich.
const KRZYWA = 0.5;            // wykładnik: 0.5 = pierwiastek

const PRZYROST = 1 / 8;        // pełne naładowanie w ~8 s przy pełnym tempie
const ZANIK = 1 / 15;          // spadek do zera po ~15 s bezruchu
const ZANIK_POZA_KADREM = 0.4; // mnożnik: wyjście z kadru zanika WOLNIEJ, bo nie może karać

// Bezruch liczymy na prędkości EFEKTYWNEJ i w m/s, nie na krzywej.
// Krzywa pierwiastkowa podbija małe wartości, więc resztki szumu wyglądałyby
// na ruch. Zanik ma się włączać przy BEZRUCHU, nie przy "za wolnym" ruchu -
// inaczej gra mówi "źle" komuś, kto robi dokładnie to, o co prosiliśmy.
const PROG_BEZRUCHU_MS = 0.08; // poniżej tylu m/s EFEKTYWNYCH gracz stoi

// Udział, jaki ruch szarpany dostaje mimo wszystko. Przy 0.25 szarpany taniec
// ładuje CZTERY RAZY WOLNIEJ, ale nadal ładuje.
//
// To nie jest kara ani próg - to gradient, i tak ma zostać. Zamiana tego na
// "płynny ruch ładuje, szarpany nie" łamie regułę nadrzędną gry: nic nigdy
// nie mówi "źle".
const PODLOGA_PLYNNOSCI = 0.25;
// Stała czasowa EMA musi być DŁUŻSZA niż jeden cykl ruchu tanecznego (~1 s),
// inaczej wskaźnik oscyluje wokół podłogi szumu i moc w każdym takcie na
// przemian rośnie i opada. Przy 60 FPS: tau = dt/alfa ≈ 0.55 s.
const ALFA_WYGLADZANIA = 0.03;
const MAX_DT = 0.1;            // sufit kroku czasu; bez tego przełączenie karty skacze mocą

// WYGŁADZANIE POZYCJI przed różniczkowaniem.
//
// To jest właściwe lekarstwo na drgania trackingu. Różniczkowanie wzmacnia
// szum o wysokiej częstotliwości: liczenie prędkości z surowych, skaczących
// pozycji daje ogromną podłogę szumu (zmierzone: ~1.2 m/s przy nieruchomym
// staniu). Filtr dolnoprzepustowy na POZYCJACH tłumi szum nieskorelowany
// między klatkami, prawie nie ruszając ruchu tanecznego (~1 Hz).
// tau ≈ 0.17 s: szum spada ~3x, sinusoida 1 Hz traci ~27%.
const ALFA_POZYCJI = 0.1;

// Punkty MediaPipe Pose: nadgarstki, łokcie, kostki.
// Barki i biodra celowo pominięte - w worldLandmarks są blisko początku układu,
// więc prawie się nie ruszają i tylko rozwadniałyby średnią.
const SLEDZONE_PUNKTY = [15, 16, 13, 14, 27, 28];
const NAZWY_PUNKTOW = { 15: 'nadg.L', 16: 'nadg.P', 13: 'łok.L', 14: 'łok.P', 27: 'kost.L', 28: 'kost.P' };

// Oś Z z pojedynczej kamery jest zgadywana, nie mierzona, i drga
// wielokrotnie mocniej niż X i Y. Dla tańca liczy się i tak ruch w płaszczyźnie
// obrazu. Waga 0 = całkowicie pomijamy głębię.
const WAGA_Z = 0;

// Punkty gorzej widoczne niż tyle to zgadywanie MediaPipe (np. stopy poza
// kadrem albo zasłonięte). Ich "ruch" to czysty szum.
const PROG_WIDOCZNOSCI = 0.5;

export class MotionMeter {
    constructor() {
        this.moc = 0;               // 0..1 - jedyne źródło energii w grze
        this.predkosc = 0;          // wygładzona średnia prędkość kończyn [m/s]
        this.predkoscSurowa = 0;    // bez wygładzenia - podglądowo
        this.predkoscEfektywna = 0; // po odjęciu podłogi szumu; TA steruje grą
        this.responsywnosc = 0;     // predkoscEfektywna zmapowana na 0..1
        this.wspolczynnikPlynnosci = 1; // mnożnik tempa ładowania z płynności
        this._wygladzone = null;    // wygładzone pozycje z poprzedniej klatki
        this.szumPunktow = {};      // diagnostyka: prędkość per kończyna [m/s]
    }

    /**
     * @param {object} frame
     * @param {number} plynnosc  0..1 z js/plynnosc.js - jak gładki jest ruch.
     *                           Steruje TEMPEM ładowania, nigdy go nie zeruje.
     */
    update(frame, plynnosc = 1) {
        const dt = Math.min(frame.dt, MAX_DT);
        if (dt <= 0) return this.moc;

        // Szarpany ruch ładuje wolniej, nigdy zero.
        const wsp = PODLOGA_PLYNNOSCI + (1 - PODLOGA_PLYNNOSCI) *
                    (Number.isFinite(plynnosc) ? Math.max(0, Math.min(1, plynnosc)) : 1);
        this.wspolczynnikPlynnosci = wsp;

        const pose = frame.pose;

        if (!pose || !pose.worldLandmarks) {
            // Gracz wyszedł z kadru. Nie karzemy - tylko wolniejszy zanik.
            this._wygladzone = null;
            this.predkoscSurowa = 0;
            this.predkosc += ALFA_WYGLADZANIA * (0 - this.predkosc);
            this.predkoscEfektywna = 0;
            this.responsywnosc = 0;
            this.moc = Math.max(0, this.moc - ZANIK * ZANIK_POZA_KADREM * dt);
            return this.moc;
        }

        this.predkoscSurowa = this._zmierzPredkosc(pose.worldLandmarks, dt);
        this.predkosc += ALFA_WYGLADZANIA * (this.predkoscSurowa - this.predkosc);

        // Odjęcie podłogi szumu. Wszystko poniżej to drgania trackingu,
        // nie ruch gracza - stąd cała dalsza logika liczy na tej wartości.
        this.predkoscEfektywna = Math.max(0, this.predkosc - PROG_SZUMU_MS);

        this.responsywnosc = Math.min(1, Math.pow(this.predkoscEfektywna / PROG_PELNEJ_MOCY, KRZYWA));

        // Przyrost jest proporcjonalny do ruchu i NIGDY ujemny.
        // Zanik włącza się dopiero poniżej progu bezruchu i narasta płynnie
        // do pełnej wartości przy całkowitym zatrzymaniu.
        const przyrost = PRZYROST * this.responsywnosc * wsp;
        const bezruch = Math.max(0, (PROG_BEZRUCHU_MS - this.predkoscEfektywna) / PROG_BEZRUCHU_MS);
        const netto = przyrost - ZANIK * bezruch;

        this.moc = this._bezpiecznaMoc(this.moc + netto * dt);

        return this.moc;
    }

    /**
     * Moc została zamieniona na efekt (wystrzał) - zbiornik pusty.
     *
     * Bez tego wystrzał nic nie kosztuje i traci ciężar: gracz tańczy raz,
     * a potem strzela w kółko. Tańcz dalej, żeby naładować ponownie.
     * To NIE jest kara - nic nie mówi "źle", po prostu zaczynasz od nowa.
     */
    zuzyj() {
        this.moc = 0;
    }

    /**
     * Ostatnia linia obrony przed NaN.
     *
     * Bez tego JEDNA klatka z NaN w worldLandmarks (zdarza się przy niskiej
     * pewności trackingu) zatruwa moc NA STAŁE - Math.max(0, Math.min(1, NaN))
     * to nadal NaN, więc licznik już nigdy się nie podniesie, a gra po prostu
     * zamiera bez żadnego komunikatu.
     */
    _bezpiecznaMoc(v) {
        if (!Number.isFinite(v)) return this.moc; // zatrzymaj ostatnią dobrą wartość
        return Math.max(0, Math.min(1, v));
    }

    /**
     * Prędkość liczona z POZYCJI WYGŁADZONYCH, nie surowych.
     *
     * Kolejność ma znaczenie: filtr dolnoprzepustowy najpierw, różniczkowanie
     * potem. Odwrotnie (jak było) różniczkowanie wzmacnia szum trackingu,
     * a późniejsze wygładzanie prędkości już go nie usunie - uśredni tylko
     * duży szum do dużej stałej.
     */
    _zmierzPredkosc(worldLandmarks, dt) {
        const surowe = SLEDZONE_PUNKTY.map(i => worldLandmarks[i]);

        // Filtr dolnoprzepustowy na pozycjach
        if (!this._wygladzone) {
            this._wygladzone = surowe.map(p => this._kopia(p));
            return 0; // pierwsza klatka nie ma z czym porównać
        }

        let suma = 0;
        let liczone = 0;
        this.szumPunktow = {};

        for (let i = 0; i < surowe.length; i++) {
            const p = surowe[i];
            const poprz = this._wygladzone[i];
            const idx = SLEDZONE_PUNKTY[i];

            if (!this._zdrowy(p)) continue;

            // Punkty słabo widoczne to zgadywanie MediaPipe, nie pomiar.
            // Ich "ruch" byłby czystym szumem, więc nie aktualizujemy ich
            // ani nie wliczamy - inaczej stopy poza kadrem generują moc.
            if (p.visibility !== undefined && p.visibility < PROG_WIDOCZNOSCI) continue;

            if (!poprz) {
                this._wygladzone[i] = this._kopia(p);
                continue;
            }

            const px = poprz.x + ALFA_POZYCJI * (p.x - poprz.x);
            const py = poprz.y + ALFA_POZYCJI * (p.y - poprz.y);
            const pz = poprz.z + ALFA_POZYCJI * (p.z - poprz.z);

            const dx = px - poprz.x;
            const dy = py - poprz.y;
            const dz = (pz - poprz.z) * WAGA_Z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (!Number.isFinite(d)) continue;

            // BEZ przeskalowywania przez 1/ALFA_POZYCJI. Różnica kolejnych
            // wartości filtra JEST już prędkością w m/s: dla ruchu ciągłego
            // filtr odtwarza pełne nachylenie sygnału, a dla ruchu ~1 Hz tłumi
            // je tylko o ~27%. Szum nieskorelowany tłumi za to ~14x. Dzielenie
            // przez alfę przywracałoby szum do poziomu sprzed filtrowania.
            const v = d / dt;

            this._wygladzone[i] = { x: px, y: py, z: pz, visibility: p.visibility };
            this.szumPunktow[NAZWY_PUNKTOW[idx] ?? idx] = v;

            suma += v;
            liczone++;
        }

        return liczone > 0 ? suma / liczone : 0;
    }

    _zdrowy(p) {
        return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
    }

    _kopia(p) {
        return this._zdrowy(p) ? { x: p.x, y: p.y, z: p.z, visibility: p.visibility } : null;
    }
}
