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
 * ================== KÓŁKO Z PALCÓW (v8) ==================
 * Do gestu doszedł DRUGI warunek (życzenie właściciela gry): palce muszą być
 * ułożone w kółko - kciuk styka się z dowolnym opuszkiem - a WIELKOŚĆ tego
 * kółka steruje intensywnością chmur. Wykrywa to `kolkoPalcow()` z dlon.js.
 *
 * To jest świadome cofnięcie decyzji "żadnego rozpoznawania palców" niżej,
 * więc ryzyko zostaje takie samo: kamera z jednego oka gubi palce przy dłoni
 * na twarzy. Stąd PAMIĘĆ OSTATNIEGO DOBREGO ODCZYTU (PAMIEC_KOLKA_S) - przez
 * sekundę od zgubienia dłoni używamy poprzedniego kółka z malejącą wagą,
 * zamiast nagle przerywać dym. Po tej sekundzie intensywność schodzi do
 * podłogi, ale technika NIE GAŚNIE (reguła "nic nigdy nie mówi źle").
 *
 * GEST: "dłoń przy ustach" x "kółko z palców". Odległość NADGARSTEK-USTA w SZEROKOŚCIACH
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
import { kolkoPalcow, NADGARSTEK } from './znaki/dlon.js';

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
// nimi a nadgarstkiem).
//
// ZERO_SKALI ZWĘŻONE w v8.1 (1.2 -> 0.7, czyli ~36 cm -> ~21 cm): przy 1.2
// "dłoń przy ustach" obejmowało praktycznie CAŁĄ przestrzeń przed twarzą, co
// samo w sobie nie szkodziło (kółko z palców miało to domykać) - ale gdy
// warunek kółka miał błąd (patrz kolkoPalcow), luźny gest dłoni był drugim
// czynnikiem, który pozwalał zwykłemu machnięciu przejść. Kółko jest teraz
// naprawione, ale dwa niezależne, ciasne warunki są odporniejsze niż jeden
// ciasny i jeden luźny - stąd zwężenie zostaje, nie tylko łatka na kółku.
export const PELNY_SKALI = 0.45;   // odległość (szer. barków), przy której gest = 1
export const ZERO_SKALI = 0.7;     // odległość (szer. barków), przy której gest = 0

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

// --- Kółko z palców (v8) - ZGADNIĘTE, do strojenia z nakładki (klawisz D) ---
// v8.4: 1.0 -> 1.8 s. Podczas tańca krótkie zgubienie precyzyjnego śledzenia
// palców (ręka w ruchu, chwilowe zasłonięcie) jest częstsze niż w bezruchu,
// w którym mierzyliśmy próg. Dłuższa pamięć daje więcej luzu, zanim
// intensywność spadnie do zera - bez podnoszenia ryzyka fałszywych
// uruchomień (pamięć trzyma WYŁĄCZNIE ostatni dobry odczyt, nic nie tworzy).
export const PAMIEC_KOLKA_S = 1.8;         // jak długo żyje ostatni dobry odczyt
// Najmniejsze kółko daje cienką strużkę, nie zero - technika nigdy nie mówi "źle".
export const INTENSYWNOSC_PODLOGA = 0.25;
// Dopasowanie dłoni do ręki przy ustach: nadgarstek dłoni musi być bliżej niż
// tyle SZEROKOŚCI EKRANU od nadgarstka pozy (landmarki są znormalizowane).
const DOPASOWANIE_DLONI = 0.18;

// SZCZYT DO STROJENIA (v8.3) - gest wymaga DWÓCH rąk zajętych (jedna trzyma
// kółko przy ustach, głowa/ciało w pozie) i JEDNOCZEŚNIE zrzutu ekranu -
// fizycznie niewykonalne w jednej chwili. Zamiast żywego odczytu HUD trzyma
// NAJLEPSZY wynik z ostatnich SZCZYT_OKNO_MS - gracz robi gest, opuszcza
// rękę, i DOPIERO WTEDY, mając obie ręce wolne, robi zrzut.
export const SZCZYT_OKNO_MS = 4000;

// --- Kierunek wydechu (v4) - ZGADNIĘTE, do strojenia na kamerze ---
// v4: CZTERY STRONY ŚWIATA. Zniknął stały skos w górę (SKOS_W_GORE = -0.3),
// przez który składowa Y nigdy nie była dodatnia i w dół dmuchnąć się NIE
// DAŁO; pochylenie głowy dostało pełną wagę zamiast połowy.
export const WAGA_GLOWY = 0.6;          // reszta to dłoń (usta - nadgarstek)
const WZMOCNIENIE_SKRETU = 2.5;         // (nos - środek oczu)/rozstaw oczu x to -> [-1,1]
const WZMOCNIENIE_POCHYLENIA = 2.5;     // to samo dla osi Y (nos względem linii oczu)
// Nos w twarzy na wprost leży ~0.7 rozstawu oczu PONIŻEJ ich linii (rozstaw
// źrenic ~63 mm, czubek nosa ~45 mm pod linią oczu). ZGADNIĘTE z anatomii,
// nie zmierzone - HUD (klawisz D) pokazuje surowe pochylenie, żeby to
// sprawdzić: przy głowie na wprost ma czytać ~0.
const NOS_POD_OCZAMI = 0.7;
const TAU_KIERUNKU_S = 0.25;            // EMA - kreska nie drga klatka po klatce
// WYRAZISTOŚĆ ustawienia gracza = długość zblendowanego wektora PRZED
// normalizacją. Zgodne, zdecydowane sygnały (wyraźny skręt głowy + dłoń
// wskazująca to samo) -> ~1; poza nijaka albo sprzeczne sygnały -> bliskie 0.
// Steruje prędkością wylotu w dym.js (życzenie: "początkowa siła kierunku
// zależna od ustawienia gracza"), NIGDY nie kończy techniki. Wygładzana tą
// samą EMA co kierunek - to po prostu jej długość.

export class Dmuchanie {
    constructor() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;       // {x,y} znormalizowane - usta, do rysowania (jak plonacyPalec.zaczep)
        this.kierunek = { x: 0, y: -1 };   // jednostkowy, OD dłoni w stronę ust i dalej
        this.sila = 0;             // 0..1 - tempo i szerokość kreski dla dym.emituj
        this.wyrazistosc = 0;      // 0..1 - jak zdecydowanie gracz celuje (prędkość wylotu)
        this.kolko = 0;            // 0..1 - jak domknięte jest kółko z palców
        this.wielkoscKolka = 0;    // 0..1 - jak duże
        this.intensywnosc = 0;     // 0..1 - ile dymu (z wielkości kółka, v8.1: 0 bez kółka)
        this._kolkoOdczyt = null;  // ostatni PEWNY odczyt {domkniecie, wielkosc, odleglosc, zgiecie}
        this.kolkoOdleglosc = null; // surowe - do HUD/strojenia (odległość opuszek w skalach dłoni)
        this.kolkoZgiecie = null;   // surowe - do HUD/strojenia (zgięcie palca/kciuka)
        this.styk = 0;              // surowe - dłoń-przy-ustach PRZED pomnożeniem przez kółko
        this.szczyt = null;         // {styk, kolko, wielkosc, intensywnosc, gest, odleglosc, zgiecie, czas} - patrz SZCZYT_OKNO_MS
        this._kolkoWiek = Infinity;// ile sekund temu (pamięć, patrz nagłówek V8)
        this.pozostaloS = 0;       // diagnostyka: ile jeszcze żyje potencjał
        this._wygasaO = 0;         // performance.now() + CZAS_POTENCJALU_MS
        this._gest = 0;            // wygładzony wynik gestu, do histerezy
        this._ustaSwiat = null;    // ostatnia PEWNA pozycja ust w metrach (worldLandmarks)
        this._ustaEkran = null;    // ostatnia PEWNA pozycja ust znormalizowana (do rysowania)
        this._kierunekEma = null;  // wygładzony kierunek wydechu (patrz _kierunek)
        this.glowa = null;         // surowy {skret, pochylenie} z ostatniej klatki (HUD)
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności GOTOWY. */
    uzbrój(now) {
        this.stan = 'GOTOWY';
        this._wygasaO = (Number.isFinite(now) ? now : 0) + CZAS_POTENCJALU_MS;
    }

    /** Inne combo złożone - potencjał gaśnie. PRODUKCJA się kończy, dym już wydmuchany NIE. */
    anuluj() {
        this._zgas();
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1 - TYLKO skaluje gęstość wydechu, nigdy nie kończy techniki
     * @param {number} dt
     * @param {number} now  performance.now(), do zegara 4 min
     * @returns {number} ile mocy pobrać w tej klatce (0, jeśli nic)
     */
    update(frame, moc, dt, now) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;

        if (this.stan === 'BEZCZYNNY') {
            this.sila = 0;
            this.wyrazistosc = 0;
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

        // KÓŁKO Z PALCÓW - drugi warunek gestu (v8). Iloczyn dwóch CIĄGŁYCH
        // wyników: dłoń przy ustach x domknięte kółko. Zero kółka = zero gestu,
        // ale połowa kółka to połowa wyniku, nie odmowa (reguła nadrzędna).
        const kolko = this._ocenKolko(frame?.hands, wl, lm, krok);
        this.kolko = kolko.domkniecie;
        this.wielkoscKolka = kolko.wielkosc;
        this.kolkoOdleglosc = kolko.odleglosc ?? null;
        this.kolkoZgiecie = kolko.zgiecie ?? null;
        // v8.1 "ostro": BEZ kółka (domkniecie ~0, w tym po wygaśnięciu pamięci)
        // intensywność spada do ZERA, nie do podłogi - "nie widać kółka = nie
        // ma dymu". Podłoga zostaje tylko dla kółka, które JEST, choć małe.
        this.intensywnosc = kolko.domkniecie > 1e-3
            ? INTENSYWNOSC_PODLOGA + (1 - INTENSYWNOSC_PODLOGA) * kolko.wielkosc
            : 0;

        this.styk = this._ocenGest(wl);
        const g = this.styk * kolko.domkniecie;
        // Wygładzenie: jedna zaszumiona klatka nie ma przełączać stanu.
        const alfa = Math.min(1, krok / 0.05) * ALFA_GESTU;
        this._gest += alfa * (g - this._gest);

        // SZCZYT (patrz nagłówek SZCZYT_OKNO_MS): trzyma NAJLEPSZY gest z
        // ostatnich kilku sekund, żeby dało się go odczytać PO opuszczeniu
        // ręki, gdy obie dłonie są znów wolne do zrzutu ekranu.
        const now_ = Number.isFinite(now) ? now : this.szczyt?.czas ?? 0;
        if (!this.szczyt || this._gest >= this.szczyt.gest || now_ - this.szczyt.czas > SZCZYT_OKNO_MS) {
            this.szczyt = {
                styk: this.styk, kolko: this.kolko, wielkosc: this.wielkoscKolka,
                intensywnosc: this.intensywnosc, gest: this._gest,
                odleglosc: this.kolkoOdleglosc, zgiecie: this.kolkoZgiecie, czas: now_
            };
        }

        if (this.stan === 'GOTOWY' && this._gest >= PROG_WEJSCIA) this.stan = 'DMUCHA';
        else if (this.stan === 'DMUCHA' && this._gest < PROG_WYJSCIA) this.stan = 'GOTOWY';

        if (this.stan !== 'DMUCHA') {
            this.sila = 0;
            return 0;
        }

        // Siła wydechu: gest x moc, obie z podłogą, żeby technika gratis nigdy
        // nie stanęła w miejscu - patrz nagłówek SILA_PODLOGA.
        const mocCzynnik = SILA_PODLOGA + (1 - SILA_PODLOGA) * (Number.isFinite(moc) ? Math.max(0, Math.min(1, moc)) : 0);
        this.sila = Math.max(SILA_PODLOGA, Math.min(1, this._gest)) * mocCzynnik;

        this.zaczep = this._ustaEkran;
        this.kierunek = this._kierunek(wl, lm, krok);

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
        this.wyrazistosc = 0;
        this.kolko = 0;
        this.wielkoscKolka = 0;
        this.kolkoOdleglosc = null;
        this.kolkoZgiecie = null;
        this.intensywnosc = 0;
        this._kolkoOdczyt = null;
        this._kolkoWiek = Infinity;
        this.pozostaloS = 0;
        this._gest = 0;
        this._ustaSwiat = null;
        this._ustaEkran = null;
        this._kierunekEma = null;
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

    /**
     * Kółko z palców tej dłoni, która jest przy ustach - z PAMIĘCIĄ.
     *
     * Kamera z jednego oka gubi palce dokładnie wtedy, gdy dłoń jest przy
     * twarzy (GEMINI.md §4), więc pojedyncza klatka bez dłoni NIE MOŻE gasić
     * dymu. Ostatni pewny odczyt żyje PAMIEC_KOLKA_S z liniowo malejącą wagą;
     * dopiero potem kółko schodzi do zera i gest przestaje się utrzymywać.
     *
     * @returns {{domkniecie:number, wielkosc:number}}
     */
    _ocenKolko(hands, wl, lm, krok) {
        const swiezy = this._kolkoZDloni(hands, lm);
        if (swiezy) {
            this._kolkoOdczyt = swiezy;
            this._kolkoWiek = 0;
            return swiezy;
        }
        this._kolkoWiek += Number.isFinite(krok) ? krok : 0;
        if (!this._kolkoOdczyt || this._kolkoWiek >= PAMIEC_KOLKA_S) {
            return { domkniecie: 0, wielkosc: 0 };
        }
        const waga = 1 - this._kolkoWiek / PAMIEC_KOLKA_S;
        return {
            domkniecie: this._kolkoOdczyt.domkniecie * waga,
            wielkosc: this._kolkoOdczyt.wielkosc * waga,
            odleglosc: this._kolkoOdczyt.odleglosc,
            zgiecie: this._kolkoOdczyt.zgiecie
        };
    }

    /**
     * Dłoń dopasowana do ręki przy ustach: po odległości nadgarstka dłoni
     * (punkt 0) od nadgarstków POZY (15/16) w koordynatach ekranu. Bez tego
     * kółko ułożone drugą, opuszczoną ręką sterowałoby techniką.
     */
    _kolkoZDloni(hands, lm) {
        if (!Array.isArray(hands) || !hands.length || !lm) return null;
        let najlepsze = null;
        for (const dlon of hands) {
            const punkty = dlon?.landmarks;
            if (!punkty?.[NADGARSTEK]) continue;
            for (const i of [15, 16]) {
                const nadg = lm[i];
                if (!nadg || !Number.isFinite(nadg.x) || !Number.isFinite(nadg.y)) continue;
                const d = Math.hypot(punkty[NADGARSTEK].x - nadg.x, punkty[NADGARSTEK].y - nadg.y);
                if (d < DOPASOWANIE_DLONI && (!najlepsze || d < najlepsze.d)) {
                    najlepsze = { d, punkty };
                }
            }
        }
        if (!najlepsze) return null;
        const k = kolkoPalcow(najlepsze.punkty);
        return k ? { domkniecie: k.domkniecie, wielkosc: k.wielkosc,
                     odleglosc: k.odleglosc, zgiecie: k.zgiecie } : null;
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
     * Jednostkowy kierunek WYDECHU - "gracz dmucha w stronę zależną od
     * ustawienia głowy i ręki" (v2, po teście na kamerze; v1 brała sam wektor
     * nadgarstek->usta, który przy dłoni PRZY ustach jest krótki i zaszumiony,
     * więc kłęby rozpryskiwały się losowo).
     *
     * Blend dwóch sygnałów, wszystko z landmarks 2D (to kierunek na ekranie,
     * nie pomiar - GEMINI.md:49):
     *   GŁOWA (WAGA_GLOWY): skręt = (nos - środek oczu) / rozstaw oczu -> X;
     *          Y = -pochylenie głowy (nos względem linii oczu). Głowa
     *          opuszczona = dym leci W DÓŁ, uniesiona = w górę, skręcona =
     *          w bok: CZTERY STRONY ŚWIATA (v4).
     *          OCZY (2/5), nie uszy (7/8): przy skręcie głowy dalsze ucho
     *          znika za twarzą i jego visibility spada - sygnał gasłby
     *          dokładnie wtedy, gdy gracz celuje. Oczy przy umiarkowanym
     *          skręcie zostają oba widoczne, a nos (wystaje) przesuwa się
     *          względem ich środka - to jest skręt.
     *   DŁOŃ  (1 - WAGA_GLOWY): usta - nadgarstek (kłąb leci OD dłoni), nadgarstek
     *          bliższy ustom w świecie (ta sama ręka, którą oceniał _ocenGest).
     * Palce CELOWO nie: kamera z jednego oka gubi je przy twarzy (GEMINI.md §4).
     * Wynik wygładzony EMA (TAU_KIERUNKU_S), żeby plume nie drgał klatka po
     * klatce. Fallbacki: bez oczu - sama dłoń; bez niczego - {0,-1}.
     */
    _kierunek(wl, lm, krok = 0) {
        const glowa = this._kierunekGlowy(lm);
        const dlon = this._kierunekDloni(wl, lm);
        // Suma ważona BEZ renormalizacji brakujących sygnałów: głowa na wprost
        // daje wektor zerowy, brak głowy - tylko 0.4 długości dłoni. Długość
        // TEJ sumy to wyrazistość (patrz TAU_WYRAZISTOSCI_S).
        const cel = {
            x: (glowa ? glowa.x * WAGA_GLOWY : 0) + (dlon ? dlon.x * (1 - WAGA_GLOWY) : 0),
            y: (glowa ? glowa.y * WAGA_GLOWY : 0) + (dlon ? dlon.y * (1 - WAGA_GLOWY) : 0)
        };
        // EMA na wektorze NIEZNORMALIZOWANYM, normalizacja dopiero na wyjściu.
        // Normalizowanie co klatkę zacinało obrót o 180°: przy odwróceniu
        // kierunku dokładnie wzdłuż osi wektor po każdym kroku wracał do
        // długości 1 i nigdy nie przechodził przez zero.
        if (!this._kierunekEma) {
            this._kierunekEma = { x: cel.x, y: cel.y };
        } else {
            const a = Math.min(1, (Number.isFinite(krok) ? krok : 0) / TAU_KIERUNKU_S);
            this._kierunekEma = {
                x: this._kierunekEma.x + a * (cel.x - this._kierunekEma.x),
                y: this._kierunekEma.y + a * (cel.y - this._kierunekEma.y)
            };
        }
        // Ta sama wygładzona długość jest WYRAZISTOŚCIĄ ustawienia gracza.
        const dl = Math.hypot(this._kierunekEma.x, this._kierunekEma.y);
        this.wyrazistosc = Math.max(0, Math.min(1, dl));
        return dl > 1e-6
            ? { x: this._kierunekEma.x / dl, y: this._kierunekEma.y / dl }
            : { x: 0, y: -1 };
    }

    /** Skręt i pochylenie głowy z nosa (0) i oczu (2/5), 2D. null bez pewnych oczu. */
    _kierunekGlowy(lm) {
        const nos = lm?.[0], oL = lm?.[2], oP = lm?.[5];
        const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
            && (p.visibility === undefined || p.visibility >= PROG_WIDOCZNOSCI_TWARZY);
        if (!ok(nos) || !ok(oL) || !ok(oP)) { this.glowa = null; return null; }
        const rozstaw = Math.hypot(oL.x - oP.x, oL.y - oP.y);
        if (rozstaw < 1e-4) { this.glowa = null; return null; }
        const sx = (oL.x + oP.x) / 2, sy = (oL.y + oP.y) / 2;
        const skret = Math.max(-1, Math.min(1, (nos.x - sx) / rozstaw * WZMOCNIENIE_SKRETU));
        // Uniesienie głowy podnosi nos względem oczu -> dodatnie pochylenie;
        // opuszczenie -> ujemne, czyli składowa Y DODATNIA = dym leci w DÓŁ.
        const pochylenie = Math.max(-1, Math.min(1,
            (sy + NOS_POD_OCZAMI * rozstaw - nos.y) / rozstaw * WZMOCNIENIE_POCHYLENIA));
        this.glowa = { skret, pochylenie };
        return { x: skret, y: -pochylenie };
    }

    /** usta - nadgarstek bliższy ustom, 2D. null bez danych. */
    _kierunekDloni(wl, lm) {
        if (!lm || !this._ustaEkran) return null;
        let reka = null;
        if (wl && wl[15] && wl[16] && this._ustaSwiat) {
            const dL = Math.hypot(wl[15].x - this._ustaSwiat.x, wl[15].y - this._ustaSwiat.y, (wl[15].z ?? 0) - this._ustaSwiat.z);
            const dP = Math.hypot(wl[16].x - this._ustaSwiat.x, wl[16].y - this._ustaSwiat.y, (wl[16].z ?? 0) - this._ustaSwiat.z);
            reka = dP < dL ? lm[16] : lm[15];
        } else {
            reka = lm[15] ?? lm[16];
        }
        if (!reka || !Number.isFinite(reka.x) || !Number.isFinite(reka.y)) return null;
        const dx = this._ustaEkran.x - reka.x, dy = this._ustaEkran.y - reka.y;
        const dl = Math.hypot(dx, dy);
        return dl > 1e-6 ? { x: dx / dl, y: dy / dl } : null;
    }
}
