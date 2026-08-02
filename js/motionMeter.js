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
const PROG_SZUMU_MS = 0.6;

// Skala liczona już na prędkości EFEKTYWNEJ (po odjęciu szumu).
// Zmierzone na żywym tańcu: spokojnie do ~1.4 m/s surowo (~0.8 efektywnie),
// energicznie do 6 m/s surowo (~5.4 efektywnie).
const PROG_PELNEJ_MOCY = 1.5;  // m/s efektywnych -> pełne tempo ładowania

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
const PROG_BEZRUCHU_MS = 0.2;  // poniżej tylu m/s EFEKTYWNYCH gracz stoi
// Stała czasowa EMA musi być DŁUŻSZA niż jeden cykl ruchu tanecznego (~1 s),
// inaczej wskaźnik oscyluje wokół podłogi szumu i moc w każdym takcie na
// przemian rośnie i opada. Przy 60 FPS: tau = dt/alfa ≈ 0.55 s.
const ALFA_WYGLADZANIA = 0.03;
const MAX_DT = 0.1;            // sufit kroku czasu; bez tego przełączenie karty skacze mocą

// Punkty MediaPipe Pose: nadgarstki, łokcie, kostki.
// Barki i biodra celowo pominięte - w worldLandmarks są blisko początku układu,
// więc prawie się nie ruszają i tylko rozwadniałyby średnią.
const SLEDZONE_PUNKTY = [15, 16, 13, 14, 27, 28];

export class MotionMeter {
    constructor() {
        this.moc = 0;               // 0..1 - jedyne źródło energii w grze
        this.predkosc = 0;          // wygładzona średnia prędkość kończyn [m/s]
        this.predkoscSurowa = 0;    // bez wygładzenia - podglądowo
        this.predkoscEfektywna = 0; // po odjęciu podłogi szumu; TA steruje grą
        this.responsywnosc = 0;     // predkoscEfektywna zmapowana na 0..1
        this._poprzednie = null;    // pozycje z poprzedniej klatki
    }

    update(frame) {
        const dt = Math.min(frame.dt, MAX_DT);
        if (dt <= 0) return this.moc;

        const pose = frame.pose;

        if (!pose || !pose.worldLandmarks) {
            // Gracz wyszedł z kadru. Nie karzemy - tylko wolniejszy zanik.
            this._poprzednie = null;
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
        const przyrost = PRZYROST * this.responsywnosc;
        const bezruch = Math.max(0, (PROG_BEZRUCHU_MS - this.predkoscEfektywna) / PROG_BEZRUCHU_MS);
        const netto = przyrost - ZANIK * bezruch;

        this.moc = this._bezpiecznaMoc(this.moc + netto * dt);

        return this.moc;
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

    _zmierzPredkosc(worldLandmarks, dt) {
        const teraz = SLEDZONE_PUNKTY.map(i => worldLandmarks[i]);

        if (!this._poprzednie) {
            this._poprzednie = teraz;
            return 0; // pierwsza klatka nie ma z czym porównać
        }

        let suma = 0;
        let liczone = 0;
        let zdrowe = 0;

        for (let i = 0; i < teraz.length; i++) {
            const a = teraz[i];
            const b = this._poprzednie[i];
            if (!a || !b) continue;

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dz = a.z - b.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Punkt z NaN pomijamy zamiast wliczać - inaczej jeden zepsuty
            // staw unieważnia całą klatkę.
            if (!Number.isFinite(d)) continue;

            suma += d;
            liczone++;
        }

        // Zapamiętujemy tylko punkty o skończonych współrzędnych, żeby zepsuta
        // klatka nie stała się punktem odniesienia dla następnej.
        for (const p of teraz) {
            if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) zdrowe++;
        }
        if (zdrowe === teraz.length) this._poprzednie = teraz;

        return liczone > 0 ? (suma / liczone) / dt : 0;
    }
}
