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

        const { id, wynik } = this._najlepszy(wyniki);

        // Poniżej progu: cisza. Pierścień gaśnie, nic nie miga.
        if (!id || wynik < this.prog) {
            this.skladana = null;
            this.postep = 0;
            this.zamrazaZanik = false;
            return { skladana: null, postep: 0, zlozona: null, brakMocy: false };
        }

        // Zmiana celu to RETARGETOWANIE, nie porażka. Nowy znak, nowy pierścień.
        if (id !== this.skladana) {
            this.skladana = id;
            this.postep = 0;
        }

        const koszt = this.koszt(id);
        if (zapas < koszt) {
            // Pierścień stoi, ale zanik NIE jest zamrożony - patrz nagłówek,
            // punkt 3. Gracz musi móc dotańczyć brakującą moc.
            this.zamrazaZanik = false;
            return { skladana: id, postep: this.postep, zlozona: null, brakMocy: true };
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
            this.postep = 0;
            this.skladana = null;
            this.zamrazaZanik = false;
            return { skladana: null, postep: 0, zlozona: { id, koszt }, brakMocy: false };
        }

        return { skladana: id, postep: this.postep, zlozona: null, brakMocy: false };
    }

    _najlepszy(wyniki) {
        let id = null, wynik = 0;
        for (const k of Object.keys(wyniki || {})) {
            const v = clamp01(wyniki[k]);
            if (v > wynik) { wynik = v; id = k; }
        }
        return { id, wynik };
    }
}
