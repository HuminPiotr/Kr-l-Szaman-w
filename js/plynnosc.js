/**
 * Płynność ruchu - czy tancerz kreśli łuki, czy szarpie.
 *
 * To NIE jest ocena "dobrze/źle". Płynność jest ciągła 0..1 i steruje tylko
 * TEMPEM ładowania mocy - szarpany ruch ładuje wolniej, nigdy zero.
 *
 * ================== DLACZEGO AKURAT TAK ==================
 *
 * Wszystkie prostsze warianty sprawdzono liczbowo i odpadły:
 *
 * 1. "mało przyspieszenia = płynnie" - BŁĄD. Okrąg kreślony ze stałą
 *    prędkością ma duże przyspieszenie dośrodkowe, a jest wzorcem płynności.
 *    Stąd rozkład na składową STYCZNĄ (przyspieszanie i hamowanie = szarpanie)
 *    i NORMALNĄ (skręcanie = płynne). Liczy się tylko styczna.
 *
 * 2. ŚREDNIA(|a_t|) / ŚREDNIA(|v|) - BŁĄD, daje ODWROTNY ranking.
 *    Zmierzone: kołysanie gładkie 6.3, kołysanie szarpane 3.7. Oba zmieniają
 *    prędkość o tyle samo na sekundę; różni je SKUPIENIE zmiany w czasie,
 *    a średnia jest na to ślepa. RMS jest czuły na szczyty i daje poprawny
 *    ranking (7.0 vs 21.0 na tych samych sygnałach).
 *
 * 3. Zwykłe różniczkowanie dwukrotne - BŁĄD przy realnym szumie trackingu.
 *    Zmierzone: rozdział szarpane/gładkie spadał z 3.0x do 1.05x, a sam szum
 *    przy bezruchu dawał 34-85, czyli WIĘCEJ niż jakikolwiek prawdziwy ruch.
 *    Stąd filtr Savitzky'ego-Golaya: pochodne z dopasowania wielomianu
 *    w oknie, a nie z różnicy sąsiednich klatek.
 *
 * 4. Miary czysto geometryczne (kąt między przemieszczeniami) - BŁĄD.
 *    Kołysanie gładkie i szarpane kreślą tę samą prostą; różni je wyłącznie
 *    czas zwrotu, którego geometria nie widzi.
 *
 * 5. Próg prędkości stosowany do KLATKI - BŁĄD znaleziony na żywym ciele.
 *    Dla ruchu wahadłowego |v| jest największe w środku wychylenia, a |a_t|
 *    DOKŁADNIE TAM najmniejsze (v ~ cos, a_t ~ sin). Odsiewanie wolnych klatek
 *    wyrzucało więc punkty zwrotne - jedyne miejsce, gdzie widać różnicę
 *    między łukiem a szarpnięciem. Próg idzie teraz do ŚREDNIEJ STAWU:
 *    nieruchomy staw nie głosuje, ale ruchomemu liczymy wszystkie klatki.
 *    Rozdział wzrósł z 5.0x na 8.3x.
 *
 * tools/test-plynnosc.mjs pilnuje wszystkich pięciu pułapek powyżej.
 */

// Okno filtra podane w SEKUNDACH, nie w klatkach. Przy spadku FPS okno liczone
// w klatkach zmieniłoby swoją długość w czasie i miara przestałaby znaczyć to samo.
const OKNO_S = 0.09;           // połowa okna; +-0.09 s = +-5 klatek przy 60 FPS
const MIN_POL_OKNA = 3;        // minimum, żeby dopasowanie wielomianu miało sens
const MAX_POL_OKNA = 12;

// Poniżej tej prędkości kierunek ruchu stawu jest zdominowany przez drgania
// trackingu. Taki staw nie ma prawa głosować - inaczej sam szum przy staniu
// w miejscu wygląda na szarpanie.
//
// Zmierzone na szumie o sigma 0.009 m (6 stawów x 720 klatek): mediana
// prędkości z samego szumu 0.061 m/s, p99 = 0.160, maksimum 0.226.
// Przy 0.20 przechodziły 2 próbki na 4260 - rzadko, ale wystarczająco,
// żeby zbić płynność. Przy 0.25 nie przechodzi żadna.
// Odnosi się teraz do ŚREDNIEJ prędkości stawu, nie do klatki (patrz pułapka 5).
const PROG_PREDKOSCI = 0.18;   // m/s

// Powyżej tego kroku czasu nie da się uczciwie zmierzyć szarpnięcia.
// Miara jest DRUGĄ pochodną pozycji, więc skaluje się jak 1/dt - przy
// załamaniu klatkażu wynik nie tyle szumi, co po cichu maleje kilkadziesiąt
// razy i wygląda na "bardzo płynny ruch". Lepiej nie mierzyć nic niż zwrócić
// liczbę, której nie da się odróżnić od prawdziwej.
const MAX_DT = 0.06;           // s (~17 FPS)

// WYMAGA POTWIERDZENIA NA ŻYWYM CIELE. Nakładka pokazuje surowe szarpnięcie
// razem ze skalą odniesienia - stroić z niej.
// Na sygnałach syntetycznych po naprawie progu stawu:
//   okrąg 1.5 · ósemka ~5 · kołysanie gładkie 6.8 · szarpane 56 · wyrzut-stop 95
// Próg dobrany tak, żeby GŁADKIE kołysanie dawało ~0.89, a nie 0.69.
// Tancerz robiący dokładnie to, o co prosimy, nie może widzieć "prawie źle".
const PROG_SZARPNIECIA = 60;   // [1/s] -> płynność 0

const TAU_WYGLADZANIA = 0.6;   // s - płynność ma się zmieniać spokojnie, nie migotać
const TAU_POWROTU = 2.0;       // s - powrót do pełnej płynności, gdy nie ma czego mierzyć
const TAU_SREDNIEJ_V = 0.4;    // s - okno średniej prędkości stawu (decyduje, czy staw głosuje)

const SLEDZONE_PUNKTY = [15, 16, 13, 14, 27, 28]; // nadgarstki, łokcie, kostki
const PROG_WIDOCZNOSCI = 0.5;

export class Plynnosc {
    constructor() {
        this.plynnosc = 1;        // 0..1 - startujemy od pełnej, nie od kary
        this.szarpniecie = 0;     // [1/s] surowe - do strojenia progu
        this.aktywnychStawow = 0; // ile stawów głosowało w tej klatce
        this.zaWolno = false;     // klatkaż za niski, żeby uczciwie mierzyć

        this._historia = SLEDZONE_PUNKTY.map(() => []);
        this._srednieV = SLEDZONE_PUNKTY.map(() => 0);
        this._polOkna = 5;

        // Akumulatory wygładzane w czasie. Trzymamy je osobno, bo szarpnięcie
        // to iloraz dwóch WAŻONYCH średnich - nie da się wygładzić samego ilorazu
        // bez zafałszowania wag.
        this._sumaAt2 = 0;  // ważona suma kwadratów przyspieszenia stycznego
        this._sumaWag = 0;
        this._sumaV = 0;
        this._liczba = 0;
    }

    /**
     * @param {Array} worldLandmarks  metryczne 3D z MediaPipe (może być null)
     * @param {number} dt             krok czasu [s]
     * @returns {number} płynność 0..1
     */
    update(worldLandmarks, dt) {
        if (!worldLandmarks || dt <= 0) {
            this.aktywnychStawow = 0;
            this.zaWolno = false;
            return this.plynnosc; // brak danych to nie jest szarpanie
        }

        // Zbyt rzadkie klatki - pomiar byłby fałszywy, więc go nie robimy.
        // Historię czyścimy, żeby po powrocie klatkażu nie liczyć pochodnych
        // z próbek rozstrzelonych w czasie.
        this.zaWolno = dt > MAX_DT;
        if (this.zaWolno) {
            for (const h of this._historia) h.length = 0;
            this.aktywnychStawow = 0;
            this.plynnosc += Math.min(1, dt / TAU_POWROTU) * (1 - this.plynnosc);
            return this.plynnosc;
        }

        // Okno dopasowane do rzeczywistego FPS
        this._polOkna = Math.max(MIN_POL_OKNA,
                        Math.min(MAX_POL_OKNA, Math.round(OKNO_S / dt)));
        const dlugosc = this._polOkna * 2 + 1;

        let at2Klatki = 0, wagiKlatki = 0, vKlatki = 0, nKlatki = 0;

        for (let i = 0; i < SLEDZONE_PUNKTY.length; i++) {
            const p = worldLandmarks[SLEDZONE_PUNKTY[i]];
            const hist = this._historia[i];

            if (!this._zdrowy(p) || (p.visibility !== undefined && p.visibility < PROG_WIDOCZNOSCI)) {
                hist.length = 0;      // przerwa w danych - zaczynamy okno od nowa
                this._srednieV[i] = 0;
                continue;
            }

            hist.push({ x: p.x, y: p.y });
            while (hist.length > dlugosc) hist.shift();
            if (hist.length < dlugosc) continue;

            const d = this._pochodneSG(hist, dt);
            const predkosc = Math.hypot(d.vx, d.vy);
            if (!Number.isFinite(predkosc)) continue;

            // Średnia prędkość TEGO stawu, wygładzana osobno.
            this._srednieV[i] += Math.min(1, dt / TAU_SREDNIEJ_V) * (predkosc - this._srednieV[i]);

            // Próg stosujemy do ŚREDNIEJ stawu, nie do wartości chwilowej.
            //
            // To jest istotne, nie kosmetyczne: dla ruchu wahadłowego |v| jest
            // największe w środku wychylenia, a |a_t| DOKŁADNIE TAM najmniejsze
            // (v ~ cos, a_t ~ sin). Odsiewanie wolnych KLATEK wyrzucało więc
            // punkty zwrotne - czyli jedyne miejsce, gdzie widać różnicę między
            // łukiem a szarpnięciem. Zostawał sam gładki środek i wszystko
            // wyglądało płynnie.
            //
            // Odsiewamy więc nieruchome STAWY (ich kierunek to szum), ale
            // ruchomemu stawowi liczymy WSZYSTKIE klatki, łącznie ze zwrotami.
            if (this._srednieV[i] < PROG_PREDKOSCI) continue;

            // Rozkład przyspieszenia: bierzemy TYLKO składową styczną.
            // Normalna (skręcanie) jest płynna i nie może karać.
            const styczne = Math.abs((d.ax * d.vx + d.ay * d.vy) / predkosc);
            if (!Number.isFinite(styczne)) continue;

            at2Klatki += predkosc * styczne * styczne;
            wagiKlatki += predkosc;
            vKlatki += predkosc;
            nKlatki++;
        }

        this.aktywnychStawow = nKlatki;

        // Wygładzanie w czasie, wykładniczo i zależnie od dt
        const alfa = Math.min(1, dt / TAU_WYGLADZANIA);
        this._sumaAt2 += alfa * (at2Klatki - this._sumaAt2);
        this._sumaWag += alfa * (wagiKlatki - this._sumaWag);
        this._sumaV   += alfa * (vKlatki   - this._sumaV);
        this._liczba  += alfa * (nKlatki   - this._liczba);

        // Za mało ruchu, żeby cokolwiek orzec. Płynność DRYFUJE KU PEŁNEJ,
        // a nie zostaje na ostatniej wartości.
        //
        // To nie jest kosmetyka. Przy staniu w miejscu szum sporadycznie
        // przebija próg prędkości (raz na kilka tysięcy próbek), wstrzykuje
        // ogromne przyspieszenie i zbija płynność do zera. Przytrzymanie
        // ostatniej wartości zostawiało ją tam NA ZAWSZE - gracz stawał na
        // chwilę i wracał do ukaranego stanu bez żadnego powodu.
        // Stanie w miejscu NIE jest szarpaniem, tylko brakiem danych.
        if (this._sumaWag < 1e-6 || this._liczba < 1e-6) {
            this.plynnosc += Math.min(1, dt / TAU_POWROTU) * (1 - this.plynnosc);
            this.szarpniecie = 0;
            return this.plynnosc;
        }

        const rmsStycznego = Math.sqrt(this._sumaAt2 / this._sumaWag);
        const sredniaPredkosc = this._sumaV / this._liczba;

        const s = rmsStycznego / (sredniaPredkosc + 1e-6);
        if (Number.isFinite(s)) this.szarpniecie = s;

        const cel = 1 - Math.min(1, Math.max(0, this.szarpniecie / PROG_SZARPNIECIA));
        this.plynnosc = Number.isFinite(cel) ? cel : this.plynnosc;

        return this.plynnosc;
    }

    /**
     * Pochodne z dopasowania wielomianu 2. stopnia w oknie (Savitzky-Golay).
     *
     * Różnica sąsiednich klatek mnoży szum przez 1/dt przy każdym
     * różniczkowaniu - przy drugiej pochodnej to 3600x przy 60 FPS.
     * Dopasowanie wielomianu do całego okna wykorzystuje wszystkie próbki
     * i tłumi szum nieskorelowany zamiast go wzmacniać.
     */
    _pochodneSG(hist, dt) {
        const pol = (hist.length - 1) / 2;
        let n = 0, k2 = 0, k4 = 0;
        let s0x = 0, s0y = 0, s1x = 0, s1y = 0, s2x = 0, s2y = 0;

        for (let j = 0; j < hist.length; j++) {
            const k = j - pol;
            const y = hist[j];
            n++; k2 += k * k; k4 += k * k * k * k;
            s0x += y.x;         s0y += y.y;
            s1x += k * y.x;     s1y += k * y.y;
            s2x += k * k * y.x; s2y += k * k * y.y;
        }

        const mian = n * k4 - k2 * k2;
        return {
            vx: s1x / k2 / dt,
            vy: s1y / k2 / dt,
            ax: 2 * (n * s2x - k2 * s0x) / mian / (dt * dt),
            ay: 2 * (n * s2y - k2 * s0y) / mian / (dt * dt)
        };
    }

    _zdrowy(p) {
        return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
    }
}
