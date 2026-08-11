/**
 * Podmuch (Aard) - technika JEDNORAZOWA: uzbrojona kombosem, wyzwalana
 * machnięciem otwartej dłoni. Kierunek fali czyta js/fala.js z tego,
 * co zwraca update() - ten plik NIE RYSUJE.
 *
 * Ten sam podział co przy płonącym palcu (plonacyPalec.js / ogien.js), ale
 * prostszy: brak stanu odpowiadającego PŁONIE - podmuch nie trwa, odpala
 * się i wraca do BEZCZYNNY w tej samej klatce.
 *
 * KIERUNEK: oś z normalnej dłoni (worldLandmarks, znak niejednoznaczny),
 * zwrot z wektora machnięcia (landmarks + zmiana skali dłoni na oś głębi).
 * Zobacz docs/superpowers/specs/2026-08-11-szczur-i-podmuch-design.md §3.
 *
 * KONWENCJA OSI Z: z ROŚNIE W GŁĄB EKRANU (dalej od gracza), UJEMNE z jest
 * BLIŻEJ gracza/kamery. To ta sama konwencja, w której liczy rzut
 * perspektywiczny w js/fala.js (`s = OGNISKO/(OGNISKO+z)` - rosnące z daje
 * MNIEJSZE s, czyli dalszą/mniejszą cząstkę). Obie strony MUSZĄ się zgadzać -
 * były niezgodne we wcześniejszej wersji (rosnąca dłoń dawała dodatnie z tu,
 * a fala.js traktowała dodatnie z jako "dalej", więc pchnięcie w kamerę
 * wizualnie uciekało w głąb ekranu). Zmiana znaku przy `dSkala` w
 * `_kandydaci` jest jedynym miejscem, gdzie ta konwencja się ustala.
 */
import { pelnaDlon, wzorPalcow, skalaDloni, normalnaDloni } from './znaki/dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
export const PROG_OTWARCIA = 0.55;      // średnie wyprostowanie 4 palców bez kciuka
export const PROG_PREDKOSCI = 4.0;      // skale dłoni na sekundę
const KOSZT_PODMUCHU = 0.25;     // ułamek paska mocy za jedno pchnięcie

// Ile KOLEJNYCH klatek z rzędu kandydat musi spełniać oba progi, zanim
// odpali. Chroni przed jednoklatkowym artefaktem trackingu (przeskok
// pozycji, zamiana stronności) - prawdziwe machnięcie z natury trwa więcej
// niż jedną klatkę, artefakt trwa dokładnie jedną. Ten sam problem, który
// plonacyPalec.js rozwiązuje ogranicznikiem skoku (MAX_PREDKOSC_ZACZEPU) -
// tu wystarczy prostsze rozwiązanie, bo podmuch nie musi śledzić tożsamości
// dłoni długoterminowo (jest jednorazowy).
const POTWIERDZENIE_KLATEK = 2;

// Próg niejednoznaczności iloczynu skalarnego (znormalizowanego względem
// długości wektora machnięcia - inaczej silne machnięcie zawsze "wygrywałoby"
// próg niezależnie od kąta). Poniżej tej wartości dłoń jest praktycznie
// PROSTOPADŁA do kierunku machnięcia (naturalny gest: dłoń frontem do
// kamery, machnięcie w bok) i znak iloczynu jest szumem numerycznym, nie
// gestem - używamy wtedy bezpiecznego kierunku domyślnego zamiast surowego
// znaku.
const PROG_NIEJEDNOZNACZNOSCI = 0.15;

export class Podmuch {
    constructor() {
        this.stan = 'BEZCZYNNY';
        // reka -> { x, y, skala, czasAkumulowany, predkosc, ruch }
        // `czasAkumulowany`/`predkosc`/`ruch` obsługują to, że main.js
        // odświeża frame.hands WOLNIEJ niż klatki renderowania (detekcja
        // idzie na video.currentTime !== lastVideoTime) - patrz komentarz
        // w _kandydaci.
        this._poprzednie = {};
        this._klatekPowyzejProgu = {};   // reka -> licznik z POTWIERDZENIE_KLATEK
        // Diagnostyka do nakładki - NAJLEPSZY kandydat w tej klatce, nawet
        // gdy nic się nie odpaliło. Bez tego nie da się wystroić progów.
        this.diagnostyka = { predkosc: 0, otwarcie: 0, kierunek: null };
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
        const kandydaci = this._kandydaci(frame, krok);

        let najlepszy = null;
        for (const k of kandydaci) if (!najlepszy || k.waga > najlepszy.waga) najlepszy = k;
        this.diagnostyka = najlepszy
            ? { predkosc: najlepszy.predkosc, otwarcie: najlepszy.otwarcie, kierunek: najlepszy.kierunek }
            : { predkosc: 0, otwarcie: 0, kierunek: null };

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
            const spelnia = k.predkosc >= PROG_PREDKOSCI && k.otwarcie >= PROG_OTWARCIA && !!k.kierunek;
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
     * Kandydaci na machnięcie: dla każdej widocznej dłoni liczymy otwartość,
     * prędkość nadgarstka w skalach dłoni na sekundę, i kierunek 3D. Przy
     * okazji aktualizuje `this._poprzednie` na potrzeby następnej klatki.
     *
     * `waga` (otwartość x prędkość) decyduje, KTÓRA dłoń wygrywa, gdy obie
     * spełniają warunki naraz - ta sama zasada co przy wyborze pieczęci.
     */
    _kandydaci(frame, dt) {
        const out = [];
        const nowePoprzednie = {};
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            const lm = d.landmarks;
            const reka = d.handedness ?? 'brak';
            const poprz = this._poprzednie[reka];

            const w = wzorPalcow(lm);
            const otwarcie = (w[1] + w[2] + w[3] + w[4]) / 4;

            const skala = skalaDloni(lm);
            // Nasada środkowego palca - stabilniejszy zaczep niż opuszek,
            // ten sam punkt, którego używa efekty.js:27 do środka dłoni.
            const zaczep = { x: lm[9].x, y: lm[9].y };

            let predkosc = 0, ruch = null, czasAkumulowany = 0;
            // `swiezy` = ta klatka niesie FAKTYCZNIE NOWY pomiar ruchu, nie
            // trzymaną wartość z poprzedniej detekcji. Licznik potwierdzeń
            // w update() (POTWIERDZENIE_KLATEK) awansuje TYLKO na świeżych
            // próbkach - inaczej jeden prawdziwy skok pozycji (artefakt)
            // "potwierdzałby się" sam, powtarzany na kolejnych nieruchomych
            // klatkach dzięki trzymaniu wartości poniżej.
            let swiezy = false;

            if (poprz) {
                const dx = zaczep.x - poprz.x, dy = zaczep.y - poprz.y;

                if (dx === 0 && dy === 0) {
                    // BRAK NOWEJ DETEKCJI w tej klatce renderowania - main.js
                    // odświeża frame.hands tylko gdy video.currentTime się
                    // zmieni (tempo faktycznej detekcji), a ta funkcja jest
                    // wołana co klatkę requestAnimationFrame (szybciej).
                    // Licząc prędkość z zerowego przesunięcia dostalibyśmy 0,
                    // choć dłoń naprawdę się rusza - zamiast tego TRZYMAMY
                    // ostatni dobry odczyt i akumulujemy czas do następnej
                    // faktycznej zmiany pozycji.
                    predkosc = poprz.predkosc ?? 0;
                    ruch = poprz.ruch ?? null;
                    czasAkumulowany = poprz.czasAkumulowany + dt;
                } else {
                    swiezy = true;
                    // Faktyczna zmiana pozycji - dzielimy przez CAŁY czas od
                    // OSTATNIEJ faktycznej detekcji (poprz.czasAkumulowany +
                    // dt tej klatki), nie tylko przez dt tej klatki. Bez tego,
                    // gdy detekcja idzie wolniej niż renderowanie, jeden pełny
                    // skok dzielony przez pojedynczy krótki dt zawyżałby
                    // prędkość kilkukrotnie - i odczyt migałby między zerem
                    // (klatki bez nowej detekcji) a zawyżoną wartością.
                    const czasCalkowity = poprz.czasAkumulowany + dt;
                    if (czasCalkowity > 0) {
                        const dSkala = skala - poprz.skala;
                        predkosc = Math.hypot(dx, dy) / skala / czasCalkowity;
                        // Głębia z ZMIANY SKALI DŁONI: rosnąca dłoń = ruch ku
                        // kamerze = UJEMNE z (patrz komentarz o konwencji osi
                        // Z na górze pliku). Wektor NIE jest metrycznie
                        // dokładny - służy wyłącznie do ustalenia ZNAKU osi
                        // normalnej, więc przybliżenie wystarcza.
                        ruch = { x: dx, y: dy, z: -dSkala };
                    }
                    czasAkumulowany = 0;
                }
            }

            const os = normalnaDloni(d.worldLandmarks);
            let kierunek = null;
            if (os && ruch) {
                const zgodnosc = os.x * ruch.x + os.y * ruch.y + os.z * ruch.z;
                const dlRuch = Math.hypot(ruch.x, ruch.y, ruch.z);
                // Znormalizowane WZGLĘDEM DŁUGOŚCI RUCHU - inaczej silne
                // machnięcie zawsze "wygrywałoby" próg niejednoznaczności
                // niezależnie od kąta między dłonią a kierunkiem ruchu.
                const zgodnoscZnorm = dlRuch > 1e-9 ? zgodnosc / dlRuch : 0;
                if (Math.abs(zgodnoscZnorm) < PROG_NIEJEDNOZNACZNOSCI) {
                    // Dłoń niemal PROSTOPADŁA do kierunku machnięcia - znak
                    // iloczynu skalarnego byłby szumem numerycznym, nie
                    // gestem. Bezpieczny wybór domyślny: zwrot OD gracza
                    // (dodatnie z - patrz konwencja osi Z na górze pliku),
                    // nigdy w jego stronę.
                    kierunek = os.z >= 0 ? os : { x: -os.x, y: -os.y, z: -os.z };
                } else {
                    kierunek = zgodnosc >= 0 ? os : { x: -os.x, y: -os.y, z: -os.z };
                }
            }

            out.push({ reka, predkosc, otwarcie, kierunek, zaczep, swiezy, waga: otwarcie * predkosc });
            nowePoprzednie[reka] = { x: zaczep.x, y: zaczep.y, skala, czasAkumulowany, predkosc, ruch };
        }
        this._poprzednie = nowePoprzednie;
        return out;
    }
}
