/**
 * Składanie pieczęci - ciągły wynik postawy zamieniony na zdarzenie binarne.
 *
 * Pieczęć albo wychodzi, albo nie. Ale binarność dotyczy WYNIKU, nie OCENY:
 * ciągły wynik postawy steruje TEMPEM napełniania pierścienia, dokładnie tak
 * jak płynność steruje tempem ładowania mocy (motionMeter.js:118). Postawa
 * niedokładna składa się WOLNIEJ, nigdy nie zostaje odrzucona i nigdy nie
 * dostaje komunikatu o porażce. Reguła nadrzędna (GEMINI.md §2) obowiązuje.
 *
 * Trzy zachowania, które wyglądają na detale, a są wymogami tej reguły:
 *
 *   1. Poniżej progu jest CISZA, nie odmowa. Żadnego wskaźnika, żadnego
 *      komunikatu - gra po prostu nie reaguje.
 *   2. Sufit czasu składania. Postawa tuż nad progiem nie może trzymać
 *      gracza w nieskończonym zawieszeniu.
 *   3. Przy braku mocy zanik NIE jest zamrażany. Zamrożenie przy pustym
 *      zbiorniku dałoby zakleszczenie: moc nie rośnie (gracz stoi
 *      w postawie), nie spada (zamrożona), pieczęć nigdy nieosiągalna.
 *
 * ================== ZANIK ZAMIAST ZEROWANIA ==================
 *
 * Dodane przy przebudowie na runy (docs/superpowers/specs/2026-09-01-runy-i-
 * -kwalifikatory-design.md). Poprzednia wersja zerowała `postep` NATYCHMIAST,
 * gdy wynik spadł poniżej progu - dla postaw statycznych to nie szkodziło
 * (trzymana postawa albo jest nad progiem, albo nie), ale dla RUN jest
 * zabójcze z definicji: wynik dopasowania kształtu naturalnie dołkuje
 * dokładnie w chwili zamykania jednego obrotu i zaczynania następnego (bufor
 * śladu zawiera wtedy ~1,5 kształtu, nie jeden czysty). Jedna drgnięta
 * klatka kasowała 2 s trzymania. Teraz `postep` WYGASA (~1,5 s do zera),
 * zamiast się zerować - krótki dołek nie niszczy postępu.
 *
 * ================== LEPKI ARGMAX ==================
 *
 * Nowy lider (inny znak niż aktualnie składany) przejmuje pierścień dopiero,
 * gdy przebije URZĘDUJĄCEGO o wyraźny margines I utrzyma tę przewagę przez
 * chwilę - nie przy pierwszej klatce, w której chwilowo wygrywa. To UOGÓLNIA
 * (i zastępuje) dawny hack preferencji Splotu przy remisie z Welesem: tamten
 * hack powstał dokładnie dlatego, że pierścień migał między dwoma liderami
 * i żadna pieczęć nigdy się nie składała (retargetowanie zeruje postęp).
 * Ogólna reguła obejmuje KAŻDĄ taką kolizję, nie tylko tę jedną zaszytą parę.
 *
 * Margines liczony jest na RÓŻNICY BEZWZGLĘDNEJ wyników, a REMIS WYGRYWA
 * URZĘDUJĄCEGO (różnica musi być ŚCIŚLE większa od marginesu, nie >=) - bez
 * tego, przy dokładnym remisie (np. dwa warianty runy z tym samym `pokrycie`
 * dłoni - patrz js/runy/definicje.js), lider skakałby przy najmniejszym
 * drgnięciu trackingu. To ta sama klasa błędu, którą łatał dawny hack.
 */

// WSZYSTKIE TE LICZBY SĄ ZGADNIĘTE i wymagają potwierdzenia na żywym ciele.
// Stroić z nakładki debug (klawisz D), która pokazuje wynik każdej postawy
// i stan napełnienia pierścienia. Precedens: PROG_SZARPNIECIA w plynnosc.js
// też został wyprowadzony z sygnałów syntetycznych i nadal czeka na
// potwierdzenie (GEMINI.md §6).

const PROG_POSTAWY = 0.5;   // poniżej - cisza
const CZAS_MIN_S = 0.5;     // postawa idealna
const CZAS_MAX_S = 2.5;     // postawa tuż nad progiem - TO JEST SUFIT
export const KOSZT_PODSTAWOWY = 0.10;  // ułamek pełnego paska

const CZAS_ZANIKU_S = 1.5;      // ile trwa zejście postępu do zera przy dołku
const MARGINES_LIDERA = 0.12;   // o ile rywal musi przebić urzędującego
const CZAS_PRZEJECIA_S = 0.25;  // jak długo musi utrzymać tę przewagę

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export class SkladaniePieczeci {
    constructor({ prog = PROG_POSTAWY, czasMin = CZAS_MIN_S,
                  czasMax = CZAS_MAX_S, koszty = {} } = {}) {
        this.prog = prog;
        this.czasMin = czasMin;
        this.czasMax = czasMax;
        this.koszty = koszty;

        this.skladana = null;   // id znaku, w który celuje pierścień
        this.postep = 0;        // 0..1 - napełnienie pierścienia
        this.zamrazaZanik = false;

        this._kandydat = null;      // id rywala aktualnie budującego przewagę nad urzędującym
        this._kandydatCzas = 0;     // ile sekund rywal trzyma tę przewagę
    }

    koszt(id) {
        const k = this.koszty[id];
        return Number.isFinite(k) ? k : KOSZT_PODSTAWOWY;
    }

    /**
     * @param {object} wyniki  mapa id -> 0..1 z ZnakRegistry.ocen()
     * @param {number} moc     0..1 z MotionMeter
     * @param {number} dt      sekundy
     */
    update(wyniki, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const zapas = clamp01(moc);

        const { id: idNajlepszy, wynik: wynikNajlepszy } = this._najlepszy(wyniki);

        // Nic nie przebija progu wcale - to nie jest sygnał przejęcia.
        if (!idNajlepszy || wynikNajlepszy < this.prog) {
            this._kandydat = null;
            this._kandydatCzas = 0;
            return this._zanikaj(krok);
        }

        if (!this.skladana) {
            // Brak urzędującego - nie ma kogo bronić, obejmujemy najlepszego od razu.
            this.skladana = idNajlepszy;
            this.postep = 0;
        } else if (idNajlepszy !== this.skladana) {
            this._rozpatrzPrzejecie(idNajlepszy, wynikNajlepszy, wyniki, krok);
        } else {
            this._kandydat = null;
            this._kandydatCzas = 0;
        }

        // Wynik URZĘDUJĄCEGO celu napędza pierścień - nie chwilowego lidera,
        // dopóki przejęcie się formalnie nie dokona (patrz wyżej).
        const wynik = clamp01(wyniki[this.skladana] ?? 0);

        if (wynik < this.prog) {
            // Urzędujący sam właśnie spadł poniżej progu (typowo w trakcie
            // przegrywania z rywalem, zanim ten przejmie) - zanik, nie reset.
            return this._zanikaj(krok);
        }

        const koszt = this.koszt(this.skladana);
        if (zapas < koszt) {
            // Pierścień stoi, ale zanik NIE jest zamrożony - patrz nagłówek,
            // punkt 3. Gracz musi móc dotańczyć brakującą moc.
            this.zamrazaZanik = false;
            return { skladana: this.skladana, postep: this.postep, zlozona: null, brakMocy: true };
        }

        // Tempo proporcjonalne do dokładności. t=1 -> czasMin, t=0 -> czasMax.
        const t = (wynik - this.prog) / (1 - this.prog);
        const czas = this.czasMax + (this.czasMin - this.czasMax) * clamp01(t);
        this.postep += krok / Math.max(1e-3, czas);
        this.zamrazaZanik = true;

        if (this.postep >= 1) {
            // Pieczęć SKACZE w istnienie. Pierścień wraca do zera, cel
            // zwolniony - trzymanie tej samej postawy nie produkuje pieczęci
            // co klatkę, tylko zaczyna następną od nowa.
            const zlozonyId = this.skladana, zlozonyKoszt = koszt;
            this.postep = 0;
            this.skladana = null;
            this.zamrazaZanik = false;
            this._kandydat = null;
            this._kandydatCzas = 0;
            return { skladana: null, postep: 0, zlozona: { id: zlozonyId, koszt: zlozonyKoszt }, brakMocy: false };
        }

        return { skladana: this.skladana, postep: this.postep, zlozona: null, brakMocy: false };
    }

    /** Czy rywal przebił urzędującego dość mocno i dość długo, żeby przejąć pierścień. */
    _rozpatrzPrzejecie(idRywala, wynikRywala, wyniki, krok) {
        const wynikUrzedujacego = clamp01(wyniki[this.skladana] ?? 0);

        // Remis wygrywa urzędujący - różnica musi być ŚCIŚLE większa od marginesu.
        if (wynikRywala - wynikUrzedujacego <= MARGINES_LIDERA) {
            this._kandydat = null;
            this._kandydatCzas = 0;
            return;
        }

        if (this._kandydat === idRywala) {
            this._kandydatCzas += krok;
        } else {
            this._kandydat = idRywala;
            this._kandydatCzas = krok;
        }

        if (this._kandydatCzas >= CZAS_PRZEJECIA_S) {
            this.skladana = idRywala;
            this.postep = 0;
            this._kandydat = null;
            this._kandydatCzas = 0;
        }
    }

    /**
     * Zanik: postęp schodzi do zera w CZAS_ZANIKU_S, zamiast się zerować
     * natychmiast. Gdy dojdzie do zera, cel się zwalnia - to jest ten sam
     * stan "cisza", do którego dawniej prowadził natychmiastowy reset.
     */
    _zanikaj(krok) {
        this.postep = Math.max(0, this.postep - krok / CZAS_ZANIKU_S);
        this.zamrazaZanik = false;

        if (this.postep <= 0) {
            this.postep = 0;
            this.skladana = null;
            return { skladana: null, postep: 0, zlozona: null, brakMocy: false };
        }
        return { skladana: this.skladana, postep: this.postep, zlozona: null, brakMocy: false };
    }

    /** Zwykły argmax - żadnych preferencji przy remisie, to teraz robi lepki argmax w update(). */
    _najlepszy(wyniki) {
        let id = null, wynik = 0;
        for (const k of Object.keys(wyniki || {})) {
            const v = clamp01(wyniki[k]);
            if (v > wynik) { wynik = v; id = k; }
        }
        return { id, wynik };
    }
}
