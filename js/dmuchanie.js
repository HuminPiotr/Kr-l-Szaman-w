/**
 * Dmuchanie - gest technik Okadzenia. Druga technika KANAŁOWANA po Płonącym
 * Palcu, ale z INNĄ filozofią sterowania - patrz "PAUZA, NIE KONIEC" niżej.
 *
 * Nie rysuje ani nie tworzy kłębów. Rysowaniem i fizyką dymu zajmuje się
 * js/dym.js, który nie wie nic o pieczęciach ani o combo.
 *
 * ================== STANY ==================
 *
 *   BEZCZYNNY   brak kombosa
 *      |  kombos (uzbrojenie 'dym', BEZ licznika aktywacji - licznik to presja)
 *      v
 *   GOTOWY  ⇄  DMUCHA     (dłoń przy ustach / dłoń odsunięta)
 *      |
 *      | 4 min od uzbrojenia ALBO inne combo (anuluj())
 *      v
 *   BEZCZYNNY
 *
 * JEDEN ZEGAR: potencjał żyje 4 min OD COMBO, niezależnie czy gracz już
 * dmucha, czy dopiero podniesie dłoń - spójne z Płonącym Palcem ("licznik
 * w GOTOWY to presja"), bez osobnego okna aktywacji.
 *
 * PAUZA, NIE KONIEC. Płonący Palec (plonacyPalec.js) kończy technikę, gdy
 * palec się chowa - "to nie kara, to kontrola". Tu jest CELOWO odwrotnie:
 * odsunięcie dłoni od ust WSTRZYMUJE strumień (GOTOWY), a nie kasuje
 * potencjału - gracz wraca dłonią i dmucha dalej, aż wygaśnie 4-minutowy
 * zegar albo złoży inne combo. Decyzja właściciela gry (burza mózgów
 * 2026-09-11): dym ma dawać czas na złożenie DRUGIEGO combo (Grom w Ogniu),
 * więc jedna przerwa w geście nie może zamykać okna na podpalenie.
 *
 * WYCZERPANIE MOCY NIGDY NIE KOŃCZY POTENCJAŁU. Inaczej niż Płonący Palec
 * (który gaśnie przy moc<=0), dmuchanie NIE sprawdza mocy jako warunku
 * kontynuacji - gracz potrzebuje mocy na Grom w Ogniu, więc głodzenie
 * najdłuższego zegara w grze byłoby ukrytym stanem porażki (GEMINI.md §2).
 * Pobór jest bliski zeru i tylko SKALUJE grubość strumienia (z podłogą,
 * żeby nigdy nie spadł do zera - patrz KOSZT_NA_SEKUNDE niżej).
 *
 * GEST: "sama dłoń przy ustach" (decyzja właściciela gry - żadnego
 * rozpoznawania zgięcia palca, kamera z jednego oka słabo widzi palce
 * zasłonięte dłonią/twarzą). Odległość NADGARSTEK-USTA w SZEROKOŚCIACH
 * BARKÓW (stykPunktow dzieli przez skalaCiala(wl), TEN SAM niezmiennik
 * odległości od kamery co pięć pieczęci styku - PELNY_SKALI/ZERO_SKALI są
 * WIELOKROTNOŚCIAMI skali ciała, NIE metrami, mimo że pierwsza wersja tego
 * pliku była tak nazwana i wartościowana - naprawione po przeglądzie: stara
 * "PELNY_M = 0.14" czytana jako 0.14 szerokości barków (~4 cm) była
 * NIEOSIĄGALNA dla nadgarstka - dłoń przy ustach trzyma nadgarstek
 * 10-20 cm od warg, nie kilka centymetrów), z DUŻĄ tolerancją - usta leżą
 * inaczej u każdego gracza, więc precyzja tu byłaby egzaminem, nie
 * pomiarem. Lepsza z dwóch rąk.
 *
 * KOTWICA UST PRZEŻYWA ZASŁONIĘCIE. Dłoń przy ustach z konieczności
 * zasłania punkty 9/10 (kąciki ust) - MediaPipe wtedy albo obniża
 * `visibility`, albo zgaduje. Zamiast nieufać pomiarowi akurat w chwili,
 * gdy ma się liczyć najbardziej, kotwica ust trzyma OSTATNIĄ PEWNĄ pozycję
 * (2D do rysowania, 3D world do pomiaru) i używa jej także wtedy, gdy usta
 * są w tej klatce niepewne. Fallback: nos (landmark 0), potem środek kadru.
 */
import { BARK_L, BARK_P, skalaCiala } from './znaki/postawa.js';
import { stykPunktow } from './znaki/styk.js';

// Potencjał żyje 4 minuty OD COMBO (nie od pierwszego dmuchnięcia) - patrz
// nagłówek "JEDEN ZEGAR" wyżej.
export const CZAS_POTENCJALU_MS = 240_000;

// ZGADNIĘTE - do strojenia z nakładki (klawisz D) po teście na kamerze,
// tak jak progi pięciu pieczęci (docs/superpowers/specs/2026-09-02-piec-
// -pieczeci-styku-design.md). Duża tolerancja NA ŻYCZENIE: usta leżą
// inaczej u każdego gracza, więc próg ma wybaczać, nie egzaminować.
//
// JEDNOSTKA: SZEROKOŚCI BARKÓW, nie metry - patrz nagłówek pliku. Przy
// typowej skali ~0.30 m: PELNY_SKALI=0.45 to ~13,5 cm (nadgarstek naprawdę
// przy twarzy, z zapasem na to, że dłoń zasłania usta i wciska się między
// nimi a nadgarstkiem), ZERO_SKALI=1.2 to ~36 cm (ręka wyraźnie opuszczona).
export const PELNY_SKALI = 0.45;   // odległość (szer. barków), przy której gest = 1
export const ZERO_SKALI = 1.2;     // odległość (szer. barków), przy której gest = 0

// Histereza wejścia/wyjścia w stan DMUCHA - "nic nie migocze na granicy"
// (GEMINI.md §2). Pasmo WEJŚCIE > WYJŚCIE: dłoń musi podejść wyraźnie
// bliżej niż próg, przy którym strumień gaśnie.
const PROG_WEJSCIA = 0.55;
const PROG_WYJSCIA = 0.35;

// Wygładzanie gestu - jedna zaszumiona klatka nie ma przełączać stanu,
// ten sam wzorzec co ALFA_UTRZYMANIA w plonacyPalec.js.
const ALFA_GESTU = 0.30;

// Pobór PRAWIE zerowy i NIGDY nie warunkuje kontynuacji (patrz nagłówek).
// 1/900 = pełny pasek wystarczyłby na 15 minut SAMEGO dmuchania - to
// celowo dużo więcej niż 4-minutowy zegar potencjału, żeby moc nigdy nie
// była wąskim gardłem tej techniki.
const KOSZT_NA_SEKUNDE = 1 / 900;

// Grubość strumienia (sila przekazywana do dym.emituj) ma PODŁOGĘ, żeby
// nigdy nie spadła do zera przy niskiej mocy - ten sam wzorzec co
// Math.max(0.25, ...) w plonacyPalec.js, z tego samego powodu: technika
// uzbrojona gratis nie może stanąć w miejscu z powodu pustego paska.
const SILA_PODLOGA = 0.35;

const PROG_WIDOCZNOSCI_TWARZY = 0.5;

export class Dmuchanie {
    constructor() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;       // {x,y} znormalizowane - usta, do rysowania (jak plonacyPalec.zaczep)
        this.kierunek = { x: 0, y: -1 };   // jednostkowy, OD dłoni w stronę ust i dalej
        this.sila = 0;             // 0..1 - grubość strumienia dla dym.emituj
        this.pozostaloS = 0;       // diagnostyka: ile jeszcze żyje potencjał
        this._wygasaO = 0;         // performance.now() + CZAS_POTENCJALU_MS
        this._gest = 0;            // wygładzony wynik gestu, do histerezy
        this._ustaSwiat = null;    // ostatnia PEWNA pozycja ust w metrach (worldLandmarks)
        this._ustaEkran = null;    // ostatnia PEWNA pozycja ust znormalizowana (do rysowania)
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności GOTOWY. */
    uzbrój(now) {
        this.stan = 'GOTOWY';
        this._wygasaO = (Number.isFinite(now) ? now : 0) + CZAS_POTENCJALU_MS;
    }

    /** Inne combo złożone - potencjał gaśnie. PRODUKCJA się kończy, kłęby już wydmuchane NIE. */
    anuluj() {
        this._zgas();
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1 - TYLKO skaluje grubość strumienia, nigdy nie kończy techniki
     * @param {number} dt
     * @param {number} now  performance.now(), do zegara 4 min
     * @returns {number} ile mocy pobrać w tej klatce (0, jeśli nic)
     */
    update(frame, moc, dt, now) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;

        if (this.stan === 'BEZCZYNNY') {
            this.sila = 0;
            return 0;
        }

        // Zegar 4 min - JEDYNY sposób, w jaki potencjał wygasa sam z siebie.
        if (Number.isFinite(now) && now >= this._wygasaO) {
            this._zgas();
            return 0;
        }
        this.pozostaloS = Number.isFinite(now) ? Math.max(0, (this._wygasaO - now) / 1000) : 0;

        const wl = frame?.pose?.worldLandmarks ?? null;
        const lm = frame?.pose?.landmarks ?? null;
        this._aktualizujUsta(wl, lm);

        const g = this._ocenGest(wl);
        // Wygładzenie: jedna zaszumiona klatka nie ma przełączać stanu.
        const alfa = Math.min(1, krok / 0.05) * ALFA_GESTU;
        this._gest += alfa * (g - this._gest);

        if (this.stan === 'GOTOWY' && this._gest >= PROG_WEJSCIA) this.stan = 'DMUCHA';
        else if (this.stan === 'DMUCHA' && this._gest < PROG_WYJSCIA) this.stan = 'GOTOWY';

        if (this.stan !== 'DMUCHA') {
            this.sila = 0;
            return 0;
        }

        // Grubość strumienia: gest x moc, obie z podłogą, żeby technika
        // gratis nigdy nie stanęła w miejscu - patrz nagłówek SILA_PODLOGA.
        const mocCzynnik = SILA_PODLOGA + (1 - SILA_PODLOGA) * (Number.isFinite(moc) ? Math.max(0, Math.min(1, moc)) : 0);
        this.sila = Math.max(SILA_PODLOGA, Math.min(1, this._gest)) * mocCzynnik;

        this.zaczep = this._ustaEkran;
        this.kierunek = this._kierunek(wl, lm);

        // Pobór jest bliski zeru i NIGDY nie warunkuje kontynuacji (frame nie
        // sprawdza moc > 0, w przeciwieństwie do plonacyPalec.js) - jeśli moc
        // jest już wyczerpana, po prostu nie pobieramy nic więcej.
        return Number.isFinite(moc) && moc > 0
            ? Math.min(moc, KOSZT_NA_SEKUNDE * krok)
            : 0;
    }

    _zgas() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;
        this.sila = 0;
        this.pozostaloS = 0;
        this._gest = 0;
        this._ustaSwiat = null;
        this._ustaEkran = null;
    }

    /**
     * Środek ust (9/10) w metrach i znormalizowanych koordynatach ekranu.
     * Aktualizuje kotwicę TYLKO gdy oba punkty są pewne - inaczej zostaje
     * przy ostatniej znanej pozycji (patrz nagłówek "KOTWICA PRZEŻYWA
     * ZASŁONIĘCIE"). Fallback na nos (landmark 0), gdy usta nigdy nie były
     * jeszcze pewne.
     */
    _aktualizujUsta(wl, lm) {
        const pewny = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
            && (p.visibility === undefined || p.visibility >= PROG_WIDOCZNOSCI_TWARZY);

        if (wl && pewny(wl[9]) && pewny(wl[10])) {
            this._ustaSwiat = {
                x: (wl[9].x + wl[10].x) / 2,
                y: (wl[9].y + wl[10].y) / 2,
                z: ((wl[9].z ?? 0) + (wl[10].z ?? 0)) / 2
            };
        } else if (!this._ustaSwiat && wl && pewny(wl[0])) {
            // Fallback na nos TYLKO dopóki usta nigdy nie były widoczne -
            // raz złapana kotwica ust nie ma się przeskakiwać na nos.
            this._ustaSwiat = { x: wl[0].x, y: wl[0].y, z: wl[0].z ?? 0 };
        }

        if (lm && pewny(lm[9]) && pewny(lm[10])) {
            this._ustaEkran = { x: (lm[9].x + lm[10].x) / 2, y: (lm[9].y + lm[10].y) / 2 };
        } else if (!this._ustaEkran && lm && pewny(lm[0])) {
            this._ustaEkran = { x: lm[0].x, y: lm[0].y };
        }
    }

    /** Lepsza z dwóch dłoni (nadgarstki 15/16 pozy) - ciągły wynik, brak danych = 0. */
    _ocenGest(wl) {
        if (!wl || !this._ustaSwiat) return 0;
        const skala = skalaCiala(wl);
        const lewa = stykPunktow(wl[15], this._ustaSwiat, skala, PELNY_SKALI, ZERO_SKALI);
        const prawa = stykPunktow(wl[16], this._ustaSwiat, skala, PELNY_SKALI, ZERO_SKALI);
        return Math.max(lewa, prawa);
    }

    /**
     * Jednostkowy kierunek OD dłoni w stronę ust i dalej - "dym wylatuje
     * z ust w stronę od dłoni" (życzenie właściciela gry). Licznik z
     * landmarks 2D (rysowanie, nie pomiar - GEMINI.md:49): wybieramy
     * nadgarstek BLIŻSZY ustom w świecie (ta sama ręka, którą oceniał
     * _ocenGest), a wektor liczymy w przestrzeni ekranu, bo tam ma służyć.
     */
    _kierunek(wl, lm) {
        if (!lm || !lm[15] || !lm[16] || !this._ustaEkran) return { x: 0, y: -1 };
        let reka = lm[15];
        if (wl && wl[15] && wl[16] && this._ustaSwiat) {
            const dL = Math.hypot(wl[15].x - this._ustaSwiat.x, wl[15].y - this._ustaSwiat.y, (wl[15].z ?? 0) - this._ustaSwiat.z);
            const dP = Math.hypot(wl[16].x - this._ustaSwiat.x, wl[16].y - this._ustaSwiat.y, (wl[16].z ?? 0) - this._ustaSwiat.z);
            reka = dP < dL ? lm[16] : lm[15];
        }
        if (!Number.isFinite(reka.x) || !Number.isFinite(reka.y)) return { x: 0, y: -1 };
        const dx = this._ustaEkran.x - reka.x, dy = this._ustaEkran.y - reka.y;
        const dl = Math.hypot(dx, dy);
        return dl > 1e-6 ? { x: dx / dl, y: dy / dl } : { x: 0, y: -1 };
    }
}
