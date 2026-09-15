/**
 * Podmuch (Aard) - technika JEDNORAZOWA: uzbrojona kombosem, wyzwalana
 * machnięciem otwartej dłoni. Kierunek fali czyta js/fala.js z tego,
 * co zwraca update() - ten plik NIE RYSUJE.
 *
 * Ten sam podział co przy płonącym palcu (plonacyPalec.js / ogien.js), ale
 * prostszy: brak stanu odpowiadającego PŁONIE - podmuch nie trwa, odpala
 * się i wraca do BEZCZYNNY w tej samej klatce.
 *
 * ====================== KIERUNEK = WEKTOR MACHNIĘCIA ======================
 * Fala leci tam, gdzie RĘKA SIĘ RUSZYŁA - jak Aard w Wiedźminie: pchasz,
 * fala leci tam, gdzie pchnąłeś. Wcześniejsza wersja brała oś z NORMALNEJ
 * DŁONI (normalnaDloni z worldLandmarks), a ruch ustalał tylko znak; przy
 * dłoni zwróconej do kamery i machnięciu w bok iloczyn skalarny był ~0,
 * "bezpieczny fallback" wymuszał +z i machnięcie w lewo i w prawo dawały
 * IDENTYCZNĄ falę w głąb ekranu. Normalna została wyłącznie w diagnostyce
 * (HUD) - nie doważa kierunku nawet trochę, bo w tym właśnie przypadku jej
 * znak byłby losowany z szumu i dokładał losowe ±z do czysto bocznej fali.
 *
 * Wszystkie trzy osie ruchu liczone w JEDNEJ jednostce - "szerokościach
 * dłoni" (odległość nadgarstek -> nasada środkowego palca na ekranie):
 *   x, y: przesunięcie na ekranie / skala dłoni (x poprawione o proporcje
 *         płótna - landmarki są normalizowane osobno w x i y, więc bez tego
 *         0.1 w poziomie na 16:9 to 1.78x więcej pikseli niż 0.1 w pionie);
 *   z:    z KAMERY OTWORKOWEJ. Odległość D = f·Hw/s (Hw - prawdziwa
 *         szerokość dłoni, s - jej skala na ekranie), więc
 *         ΔD/Hw = f·(1/s_nowa − 1/s_stara). Dłoń ROŚNIE -> ujemne -> KU
 *         KAMERZE. To jest jedyne miejsce, gdzie ustala się znak osi Z.
 *
 * Ruch bierze się z BUFORA ostatnich świeżych detekcji (OKNO_MACHNIECIA_S),
 * nie z jednej różnicy klatek: main.js woła update() co klatkę rysowania,
 * a frame.hands odświeża się w tempie kamery, więc pojedyncza różnica raz
 * jest zerem, raz skokiem. Bufor jest jednocześnie "trzymaniem ostatniej
 * wartości" - klatki bez nowej detekcji go nie tykają. Prędkość i kierunek
 * liczą się z TEGO SAMEGO okna w klatce odpalenia - nie da się odpalić na
 * skoku z jednego przedziału, a kierunek wziąć z innego.
 *
 * BRAMKA GŁĘBI: surowe z mnoży drżenie skali przez f/s ≈ 10-17x, więc
 * 3 % szumu w spoczynku dawałoby kilkanaście szerokości dłoni na sekundę
 * "pchnięcia w kamerę". Względna zmiana skali w oknie przechodzi przez
 * rampa() (ciągłą, nie skokową - GEMINI.md §2): poniżej PROG_GLEBI_OD to
 * drżenie i z=0, powyżej PROG_GLEBI_PELNY to prawdziwe pchnięcie.
 *
 * KONWENCJA OSI Z: z ROŚNIE W GŁĄB EKRANU (dalej od gracza), UJEMNE z jest
 * BLIŻEJ gracza/kamery. To ta sama konwencja, w której liczy rzut
 * perspektywiczny w js/fala.js (`s = OGNISKO/(OGNISKO+z)` - rosnące z daje
 * MNIEJSZE s, czyli dalszą/mniejszą cząstkę). Obie strony MUSZĄ się zgadzać.
 */
import { pelnaDlon, wzorPalcow, normalnaDloni, rampa } from './znaki/dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
export const PROG_OTWARCIA = 0.55;      // średnie wyprostowanie 4 palców bez kciuka
// Szerokości dłoni na sekundę. Było 4.0 przy pomiarze bez poprawki proporcji
// płótna - poprawka podnosi odczyty ruchu poziomego ~1.78x na 16:9.
export const PROG_PREDKOSCI = 7.0;
const KOSZT_PODMUCHU = 0.25;     // ułamek paska mocy za jedno pchnięcie

// Ile KOLEJNYCH świeżych detekcji z rzędu kandydat musi spełniać oba progi,
// zanim odpali. Chroni przed jednoklatkowym artefaktem trackingu (przeskok
// pozycji, zamiana stronności) - prawdziwe machnięcie z natury trwa więcej
// niż jedną klatkę, artefakt trwa dokładnie jedną. Ten sam problem, który
// plonacyPalec.js rozwiązuje ogranicznikiem skoku (MAX_PREDKOSC_ZACZEPU) -
// tu wystarczy prostsze rozwiązanie, bo podmuch nie musi śledzić tożsamości
// dłoni długoterminowo (jest jednorazowy).
const POTWIERDZENIE_KLATEK = 2;

// --- bufor machnięcia ---
const OKNO_MACHNIECIA_S = 0.12;  // s - przy 30 Hz detekcji 3-4 próbki, tyle co potwierdzenie
const MIN_PROBEK = 2;            // poniżej nie ma ruchu do policzenia
const MAX_PROBEK = 6;            // sufit przy szybkiej detekcji

// Ogniskowa kamery w jednostkach WYSOKOŚCI płótna: f/H = 1/(2·tan(FOVv/2)).
// Typowa webcam 60° w poziomie na 16:9 -> FOVv ≈ 36° -> ~1.5. ZGADNIĘTE.
// Wynik jest normalizowany, więc ta stała ustawia tylko PROPORCJĘ x:z -
// za mała spłaszcza pchnięcia w kamerę do ruchu bocznego, za duża każdą
// zmianę skali robi pchnięciem. NIE mylić z OGNISKO z js/fala.js - tamto
// jest artystyczną stałą RZUTU cząstek, nie modelem kamery.
export const OGNISKO_KAMERY = 1.5;
// Bramka głębi - względna zmiana skali dłoni |Δs/s| w oknie machnięcia.
const PROG_GLEBI_OD = 0.06;      // poniżej: drżenie trackingu, z = 0
const PROG_GLEBI_PELNY = 0.15;   // powyżej: pełna głębia

/**
 * Skala dłoni NA EKRANIE z poprawką proporcji płótna: nadgarstek -> nasada
 * środkowego palca, w jednostkach wysokości płótna. Lokalna, NIE skalaDloni
 * z dlon.js - na tamtej wiszą progi pieczęci (ZGADNIĘTE względem niej) i
 * miesza jednostki x/y, co tu psułoby proporcję x:z.
 */
function skalaEkranowa(lm, prop) {
    return Math.max(1e-6, Math.hypot((lm[9].x - lm[0].x) * prop, lm[9].y - lm[0].y));
}

export class Podmuch {
    constructor() {
        this.stan = 'BEZCZYNNY';
        // reka -> [{ x, y, skala, t }] - świeże detekcje z ostatnich
        // OKNO_MACHNIECIA_S (nagłówek "KIERUNEK = WEKTOR MACHNIĘCIA").
        this._bufory = {};
        this._klatekPowyzejProgu = {};   // reka -> licznik z POTWIERDZENIE_KLATEK
        // Lokalny zegar próbek (suma klamrowanych dt) - frame.now nie jest
        // częścią kontraktu klatki w testach, a dt już jest klamrowane.
        this._zegar = 0;
        // Diagnostyka do nakładki - NAJLEPSZY kandydat w tej klatce, nawet
        // gdy nic się nie odpaliło. Bez tego nie da się wystroić progów.
        // `normalna` to TYLKO podgląd - nie wpływa na kierunek (nagłówek).
        this.diagnostyka = this._pustaDiagnostyka();
    }

    _pustaDiagnostyka() {
        return { predkosc: 0, otwarcie: 0, kierunek: null, ruch: null, zmianaSkali: 0, normalna: null };
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności. */
    uzbrój() {
        if (this.stan === 'BEZCZYNNY') this.stan = 'UZBROJONY';
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1
     * @param {number} dt
     * @returns {{zaczep:{x,y}, kierunek:{x,y,z}, sila:number, pobor:number}|null}
     */
    update(frame, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._zegar += krok;
        const kandydaci = this._kandydaci(frame);

        let najlepszy = null;
        for (const k of kandydaci) if (!najlepszy || k.waga > najlepszy.waga) najlepszy = k;
        this.diagnostyka = najlepszy
            ? { predkosc: najlepszy.predkosc, otwarcie: najlepszy.otwarcie, kierunek: najlepszy.kierunek,
                ruch: najlepszy.ruch, zmianaSkali: najlepszy.zmianaSkali, normalna: najlepszy.normalna }
            : this._pustaDiagnostyka();

        const noweLiczniki = {};
        for (const k of kandydaci) {
            if (!k.swiezy) {
                // Klatka BEZ nowej detekcji (throttling - patrz komentarz
                // w _kandydaci) albo pierwsze pojawienie się dłoni: nie mamy
                // nowej informacji o ruchu, więc licznik ZOSTAJE - inaczej
                // trzymana (powtórzona) prędkość z JEDNEGO prawdziwego
                // pomiaru mogłaby "potwierdzić" sama siebie na kolejnych
                // nieruchomych klatkach i obejść całą ochronę.
                noweLiczniki[k.reka] = this._klatekPowyzejProgu[k.reka] ?? 0;
                continue;
            }
            // Niezerowa prędkość gwarantuje kierunek (oba z tego samego wektora
            // ruchu) - normalna dłoni nie jest już warunkiem.
            const spelnia = k.predkosc >= PROG_PREDKOSCI && k.otwarcie >= PROG_OTWARCIA;
            noweLiczniki[k.reka] = spelnia ? (this._klatekPowyzejProgu[k.reka] ?? 0) + 1 : 0;
        }
        this._klatekPowyzejProgu = noweLiczniki;

        if (this.stan !== 'UZBROJONY') return null;
        if (!najlepszy) return null;
        if (najlepszy.predkosc < PROG_PREDKOSCI) return null;
        if (najlepszy.otwarcie < PROG_OTWARCIA) return null;
        if (!najlepszy.kierunek) return null;
        if ((this._klatekPowyzejProgu[najlepszy.reka] ?? 0) < POTWIERDZENIE_KLATEK) return null;

        this.stan = 'BEZCZYNNY';
        const mocBezpieczna = Number.isFinite(moc) ? Math.max(0, moc) : 0;
        const pobor = Math.min(mocBezpieczna, KOSZT_PODMUCHU);
        // Dolna granica na `sila`: czysty stosunek (pobor/KOSZT_PODMUCHU)
        // przy mocy bliskiej zeru dawałby falę tak słabą, że fala.js w ogóle
        // jej nie wyemituje (próg s<=0.01 w wystrzel()) - a niewidoczny
        // efekt wygląda dokładnie jak odmowa, czego reguła nadrzędna
        // zabrania. Podmuch ma być ZAWSZE widoczny, choćby ledwo.
        const sila = 0.15 + 0.85 * (pobor / KOSZT_PODMUCHU);
        return { zaczep: najlepszy.zaczep, kierunek: najlepszy.kierunek, sila, pobor };
    }

    /**
     * Kandydaci na machnięcie: dla każdej widocznej dłoni otwartość, wektor
     * ruchu z bufora świeżych detekcji (w szerokościach dłoni), prędkość
     * i kierunek. Przy okazji aktualizuje `this._bufory`.
     *
     * `waga` (otwartość x prędkość) decyduje, KTÓRA dłoń wygrywa, gdy obie
     * spełniają warunki naraz - ta sama zasada co przy wyborze pieczęci.
     */
    _kandydaci(frame) {
        const out = [];
        const noweBufory = {};
        const prop = (Number.isFinite(frame.width) && Number.isFinite(frame.height) && frame.height > 0)
            ? frame.width / frame.height : 1;

        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            const lm = d.landmarks;
            // Klucz bufora = stronność. Dwie dłonie pod tym samym kluczem
            // (np. obie bez stronności) dostają osobne klucze ('brak', 'brak+'),
            // żeby jeden bufor nie mieszał pozycji dwóch dłoni. Zamiana
            // kolejności między klatkami to ten sam rodzaj zakłócenia, co
            // zamiana stronności - pochłania go licznik potwierdzeń.
            let reka = d.handedness ?? 'brak';
            while (noweBufory[reka]) reka += '+';

            const w = wzorPalcow(lm);
            const otwarcie = (w[1] + w[2] + w[3] + w[4]) / 4;
            const skala = skalaEkranowa(lm, prop);
            // Nasada środkowego palca - stabilniejszy zaczep niż opuszek,
            // ten sam punkt, którego używa efekty.js do środka dłoni.
            const zaczep = { x: lm[9].x, y: lm[9].y };

            const buf = (this._bufory[reka] ?? []).slice();
            const ostatnia = buf.length ? buf[buf.length - 1] : null;

            // `swiezy` = ta klatka niesie FAKTYCZNIE NOWY pomiar. main.js
            // odświeża frame.hands tylko gdy video.currentTime się zmieni,
            // a ta funkcja jest wołana co klatkę rysowania - identyczna
            // pozycja to brak nowej detekcji, nie bezruch. Licznik potwierdzeń
            // w update() awansuje TYLKO na świeżych próbkach - inaczej jeden
            // skok pozycji (artefakt) "potwierdzałby się" sam na kolejnych
            // nieruchomych klatkach. Pierwsze pojawienie się dłoni też nie
            // jest świeże - nie ma jeszcze ruchu do zmierzenia.
            let swiezy = false;
            if (!ostatnia) {
                buf.push({ x: zaczep.x, y: zaczep.y, skala, t: this._zegar });
            } else if (zaczep.x !== ostatnia.x || zaczep.y !== ostatnia.y) {
                swiezy = true;
                buf.push({ x: zaczep.x, y: zaczep.y, skala, t: this._zegar });
                // Wiek liczony względem NAJNOWSZEJ próbki; zostaje co najmniej
                // MIN_PROBEK, żeby po pauzie pierwsza świeża próbka miała
                // z czym się porównać (da małą prędkość - dokładnie tak, jak
                // wcześniej robił czas akumulowany od ostatniej detekcji).
                while (buf.length > MIN_PROBEK && this._zegar - buf[0].t > OKNO_MACHNIECIA_S) buf.shift();
                while (buf.length > MAX_PROBEK) buf.shift();
            }

            let ruch = null, predkosc = 0, kierunek = null, zmianaSkali = 0;
            if (buf.length >= MIN_PROBEK) {
                const stara = buf[0], nowa = buf[buf.length - 1];
                const dtOkna = nowa.t - stara.t;
                zmianaSkali = (nowa.skala - stara.skala) / nowa.skala;
                const bramka = rampa(Math.abs(zmianaSkali), PROG_GLEBI_OD, PROG_GLEBI_PELNY);
                ruch = {
                    x: (nowa.x - stara.x) * prop / nowa.skala,
                    y: (nowa.y - stara.y) / nowa.skala,
                    // Kamera otworkowa (nagłówek): rosnąca dłoń -> ujemne z -> ku kamerze.
                    z: OGNISKO_KAMERY * (1 / nowa.skala - 1 / stara.skala) * bramka
                };
                const dl = Math.hypot(ruch.x, ruch.y, ruch.z);
                if (Number.isFinite(dl) && dl > 1e-9 && dtOkna > 0) {
                    predkosc = dl / dtOkna;
                    kierunek = { x: ruch.x / dl, y: ruch.y / dl, z: ruch.z / dl };
                } else {
                    ruch = null;
                }
            }

            const normalna = normalnaDloni(d.worldLandmarks);   // TYLKO diagnostyka
            out.push({ reka, predkosc, otwarcie, kierunek, ruch, zmianaSkali, normalna,
                       zaczep, swiezy, waga: otwarcie * predkosc });
            noweBufory[reka] = buf;
        }
        // Tylko dłonie obecne w tej klatce - zniknięcie dłoni czyści jej bufor.
        this._bufory = noweBufory;
        return out;
    }
}
