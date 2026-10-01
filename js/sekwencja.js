/**
 * Pasek sekwencji - subtelny rząd run u dołu ekranu, pokazujący ostatnio
 * złożone pieczęcie i reagujący na combo.
 *
 * DOM, NIE PŁÓTNO. Trzy powody: płótno ma scaleX(-1) (tekst wychodziłby
 * lustrzany - GEMINI.md §4), webfont na canvas ładuje się po cichu
 * i zawodzi bez ostrzeżenia (patrz js/glify.js), a CSS `opacity`/`transition`
 * daje zanik "za darmo", bez własnej pętli animacji. js/runa.js (duża runa
 * przy dłoniach) ma odwrotny zestaw powodów i dlatego zostaje na canvasie -
 * to nie jest niekonsekwencja, to dwa różne kontrakty dla dwóch różnych
 * powierzchni.
 *
 * ================== PODZIAŁ: LICZENIE vs RYSOWANIE ==================
 * Jak w efekty.js/ekran.js: funkcje CZYSTE (alfaSlotu, obliczSloty,
 * obliczWidmo) liczą stan bez dotykania DOM i są testowalne w Node.
 * Klasa PasekSekwencji WYŁĄCZNIE aplikuje ten stan do elementów - jeśli
 * `el` nie istnieje (test w Node, albo strona bez tego markupu), update()
 * cicho nic nie robi, tym samym wzorcem co guard `!ctx` w runa.js/ekran.js.
 *
 * ================== BUFOR NIGDY NIE JEST CZYSZCZONY ==================
 * kombosy.js (nagłówek): łańcuchy są celowe, bufor wygasa tylko czasem.
 * Ten pasek MUSI to respektować - po trafieniu combo sloty ZOSTAJĄ
 * i dalej się starzeją (alfaSlotu), tylko dostają złotą "więź" (klasa
 * .zwiazana, identyfikowaną po znaczniku czasu wpisu, nie po pozycji -
 * kolejne wpisy dodane PO combo nie dziedziczą więzi).
 *
 * ================== SLOT-WIDMO ==================
 * Cichy zamiennik dawnego pierścienia postępu składania (ten sam pomiar,
 * `postep` z pieczecie.js, ale bez okręgu na ekranie - patrz decyzja
 * właściciela gry przy tym zadaniu). Bardzo niska alfa bazowa (0.08),
 * rosnąca z postępem do maksymalnie 0.43 - nigdy nie dorównuje pełnej
 * runie, bo pieczęć jeszcze się NIE złożyła.
 */
import { glif } from './glify.js';
import { OKNO_MS } from './kombosy.js';

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

// Slot trzyma pełną alfę do 55% okna, potem gaśnie do zera na jego końcu -
// gracz widzi WYRAŹNIE, że okno się kończy, zamiast liniowego, ledwo
// zauważalnego zanikania od pierwszej klatki.
const PROG_ZANIKU = 0.55;

/**
 * Alfa pojedynczego slotu w pasku - CZYSTA FUNKCJA.
 *
 * @param {number} wiekMs  ile ms temu złożono tę pieczęć
 * @param {number} oknoMs  okno kombosów (kombosy.js OKNO_MS)
 * @returns {number} 0..1
 */
export function alfaSlotu(wiekMs, oknoMs) {
    const wiek = Number.isFinite(wiekMs) ? Math.max(0, wiekMs) : 0;
    const okno = Number.isFinite(oknoMs) && oknoMs > 0 ? oknoMs : OKNO_MS;
    if (wiek >= okno) return 0;
    const progCzas = okno * PROG_ZANIKU;
    if (wiek <= progCzas) return 1;
    return clamp01(1 - (wiek - progCzas) / (okno - progCzas));
}

/**
 * Stan wszystkich slotów do wyrenderowania - CZYSTA FUNKCJA, bez DOM.
 *
 * @param {{id:string,t:number}[]} aktywneWpisy  z KomboSilnik.aktywne(now), najstarsze z przodu
 * @param {Set<number>} zwiazaneT  znaczniki czasu wpisów należących do ostatniego trafionego combo
 * @param {number} now
 * @param {number} oknoMs
 * @returns {{id:string, znak:string, t:number, opacity:number, zwiazana:boolean}[]}
 */
export function obliczSloty(aktywneWpisy, zwiazaneT, now, oknoMs = OKNO_MS) {
    if (!Array.isArray(aktywneWpisy)) return [];
    const chwilaTeraz = Number.isFinite(now) ? now : 0;
    return aktywneWpisy.map(w => ({
        id: w.id,
        znak: glif(w.id) ?? '?',
        t: w.t,
        opacity: alfaSlotu(chwilaTeraz - w.t, oknoMs),
        zwiazana: zwiazaneT instanceof Set && zwiazaneT.has(w.t)
    }));
}

/**
 * Stan slotu-widma (pieczęć w trakcie składania) - CZYSTA FUNKCJA.
 *
 * @param {string|null} skladanaId
 * @param {number} postep  0..1 z pieczecie.js
 * @returns {{znak:string, opacity:number}|null}
 */
export function obliczWidmo(skladanaId, postep) {
    if (!skladanaId) return null;
    const znak = glif(skladanaId);
    if (!znak) return null;
    return { znak, opacity: 0.08 + 0.35 * clamp01(postep) };
}

const CZAS_NAZWY_MS = 2000;

export class PasekSekwencji {
    /**
     * @param {HTMLElement|null} elSloty  kontener na sloty run
     * @param {HTMLElement|null} elNazwa  etykieta nazwy techniki nad paskiem
     */
    constructor(elSloty, elNazwa) {
        this.elSloty = elSloty ?? null;
        this.elNazwa = elNazwa ?? null;

        this._zwiazaneT = new Set();
        this._nazwaTechniki = '';
        this._nazwaTechnikiDo = 0;

        this._sygnatura = '';
        this._nodySlotow = [];   // równoległa do ostatniego obliczSloty()
        this._nodaWidmo = null;
    }

    /**
     * Wywołane, gdy bufor kombosów właśnie trafił technikę - oznacza
     * ogon bufora jako "związany" (złota poświata + wspólna kreska).
     *
     * @param {{id:string,t:number}[]} wpisyTechniki  ogon bufora odpowiadający sekwencji (kombosy.bufor.slice(-dlugosc))
     * @param {string} nazwa  nazwa techniki do pokazania nad paskiem
     * @param {number} now
     */
    oznaczCombo(wpisyTechniki, nazwa, now) {
        this._zwiazaneT = new Set((wpisyTechniki ?? []).map(w => w.t));
        this._nazwaTechniki = nazwa ?? '';
        this._nazwaTechnikiDo = (Number.isFinite(now) ? now : 0) + CZAS_NAZWY_MS;
    }

    /**
     * @param {number} now
     * @param {{id:string,t:number}[]} aktywneWpisy  z KomboSilnik.aktywne(now)
     * @param {string|null} skladanaId
     * @param {number} postep
     * @param {number} oknoMs
     */
    update(now, aktywneWpisy, skladanaId, postep, oknoMs = OKNO_MS) {
        // Brak DOM (test w Node, albo strona bez tego markupu) - cisza.
        if (!this.elSloty) return;

        const stanSlotow = obliczSloty(aktywneWpisy, this._zwiazaneT, now, oknoMs);
        this._renderujSloty(stanSlotow);
        this._renderujWidmo(obliczWidmo(skladanaId, postep));
        this._renderujNazwe(now);
    }

    _renderujSloty(stan) {
        const sygnatura = stan.map(s => s.t).join(',');
        if (sygnatura !== this._sygnatura) {
            this._sygnatura = sygnatura;
            this.elSloty.querySelectorAll('.runa-slot').forEach(n => n.remove());
            this._nodySlotow = stan.map(s => {
                const span = document.createElement('span');
                span.className = 'runa-slot';
                span.textContent = s.znak;
                // Widmo musi zostać OSTATNIE dziecko - wstawiamy sloty PRZED nim.
                this.elSloty.insertBefore(span, this._nodaWidmo);
                return span;
            });
        }
        for (let i = 0; i < stan.length; i++) {
            const el = this._nodySlotow[i];
            if (!el) continue;
            el.style.opacity = stan[i].opacity.toFixed(3);
            el.classList.toggle('zwiazana', stan[i].zwiazana);
        }
    }

    _renderujWidmo(widmo) {
        if (!widmo) {
            if (this._nodaWidmo) {
                this._nodaWidmo.remove();
                this._nodaWidmo = null;
            }
            return;
        }
        if (!this._nodaWidmo) {
            this._nodaWidmo = document.createElement('span');
            this._nodaWidmo.className = 'runa-slot widmo';
            this.elSloty.appendChild(this._nodaWidmo);
        }
        this._nodaWidmo.textContent = widmo.znak;
        this._nodaWidmo.style.opacity = widmo.opacity.toFixed(3);
    }

    _renderujNazwe(now) {
        if (!this.elNazwa) return;
        const pokaz = Number.isFinite(now) && now < this._nazwaTechnikiDo;
        this.elNazwa.classList.toggle('widoczna', pokaz);
        if (pokaz) this.elNazwa.textContent = this._nazwaTechniki;
    }
}
