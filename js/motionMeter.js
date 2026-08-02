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
const PROG_PELNEJ_MOCY = 0.6;  // m/s średniej prędkości kończyn = pełne tempo ładowania
const PRZYROST = 1 / 8;        // pełne naładowanie w ~8 s spokojnego tańca
const ZANIK = 1 / 15;          // spadek do zera po ~15 s bezruchu
const ZANIK_POZA_KADREM = 0.4; // mnożnik: wyjście z kadru zanika WOLNIEJ, bo nie może karać
const ALFA_WYGLADZANIA = 0.1;  // mocne wygładzenie EMA - relaks znaczy gładko, bez skoków
const MAX_DT = 0.1;            // sufit kroku czasu; bez tego przełączenie karty skacze mocą

// Punkty MediaPipe Pose: nadgarstki, łokcie, kostki.
// Barki i biodra celowo pominięte - w worldLandmarks są blisko początku układu,
// więc prawie się nie ruszają i tylko rozwadniałyby średnią.
const SLEDZONE_PUNKTY = [15, 16, 13, 14, 27, 28];

export class MotionMeter {
    constructor() {
        this.moc = 0;              // 0..1 - jedyne źródło energii w grze
        this.predkosc = 0;         // wygładzona średnia prędkość kończyn [m/s]
        this.predkoscSurowa = 0;   // bez wygładzenia - do strojenia stałych powyżej
        this.responsywnosc = 0;    // predkosc zmapowana na 0..1
        this._poprzednie = null;   // pozycje z poprzedniej klatki
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
            this.responsywnosc = 0;
            this.moc = Math.max(0, this.moc - ZANIK * ZANIK_POZA_KADREM * dt);
            return this.moc;
        }

        this.predkoscSurowa = this._zmierzPredkosc(pose.worldLandmarks, dt);
        this.predkosc += ALFA_WYGLADZANIA * (this.predkoscSurowa - this.predkosc);
        this.responsywnosc = Math.min(1, this.predkosc / PROG_PELNEJ_MOCY);

        // Jedno wyrażenie na wzrost i zanik: przy pełnym tempie ładuje w ~8 s,
        // w bezruchu opada w ~15 s, a pomiędzy płynnie się przenika.
        const netto = PRZYROST * this.responsywnosc - ZANIK * (1 - this.responsywnosc);
        this.moc = Math.max(0, Math.min(1, this.moc + netto * dt));

        return this.moc;
    }

    _zmierzPredkosc(worldLandmarks, dt) {
        const teraz = SLEDZONE_PUNKTY.map(i => worldLandmarks[i]);

        if (!this._poprzednie) {
            this._poprzednie = teraz;
            return 0; // pierwsza klatka nie ma z czym porównać
        }

        let suma = 0;
        let liczone = 0;

        for (let i = 0; i < teraz.length; i++) {
            const a = teraz[i];
            const b = this._poprzednie[i];
            if (!a || !b) continue;

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dz = a.z - b.z;
            suma += Math.sqrt(dx * dx + dy * dy + dz * dz);
            liczone++;
        }

        this._poprzednie = teraz;

        return liczone > 0 ? (suma / liczone) / dt : 0;
    }
}
