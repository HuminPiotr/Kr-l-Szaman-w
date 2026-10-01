/**
 * Punktacja - system punktowy trybów arcade.
 * Spec: docs/superpowers/specs/2026-10-01-punktacja-design.md
 *
 * PUNKTY TYLKO PRZYBYWAJĄ. GEMINI.md §2 przepisane 2026-10-01: z reguły
 * nadrzędnej zniknął "brak punktów/timera", ale rdzeń zostaje - nic nie
 * mówi "źle", nic nie zabiera. Żadna metoda tej klasy nie zmniejsza
 * `wynik`; malejący przyrost za powtarzanie DAJE MNIEJ, nigdy nie odejmuje.
 *
 * CZYSTA LOGIKA, BEZ DOM - jak kombosy.js. main.js zgłasza zdarzenia
 * (PUSH) w miejscach, które już istnieją w pętli; HUD (js/wynikHud.js)
 * odczytuje stan co klatkę (PULL), wzorzec paska sekwencji.
 *
 * Cztery warstwy: taniec (strumień), pieczęć (stała), technika (z tabeli),
 * reakcje (premie za łączenie technik - rejestr REAKCJE niżej).
 */

// Trudność pieczęci - Z POMIARU, nie zgadnięta: rozpoznawalność z
// tools/test-rozdzielnosc.mjs na prawdziwych nagraniach (komentarz przy
// Kołowrocie w js/kombosy.js): woda/ziemia ~1.0, błyskawica 0.70-1.00,
// powietrze 0.40-0.93, ogień 0.21-0.59. Im trudniej złożyć, tym więcej
// pieczęć wnosi do wartości techniki. NOWA PIECZĘĆ = nowy wpis tutaj,
// inaczej tools/test-punkty.mjs (strażnik) wywali się na czerwono.
export const TRUDNOSC = { mokosz: 1.0, weles: 1.0, perun: 1.2, stribog: 1.4, swarog: 1.6 };

// ZGADNIĘTE - do strojenia na żywym ciele. Proporcja jest celowa: 2 min
// samego tańca (~500) to mniej więcej dwie techniki - ktoś, komu nie
// wychodzą pieczęcie, dalej punktuje, ale combo wyraźnie się opłaca.
export const PUNKTY_TANCA_NA_S = 4;
export const PUNKTY_PIECZECI = 25;
export const BAZA_TECHNIKI = 100;
export const SPADEK_POWTORZENIA = 0.25;   // ta sama technika pod rząd: -25% za każde powtórzenie
export const PODLOGA_POWTORZENIA = 0.5;   // ...ale nigdy mniej niż połowa
export const PREMIA_SPLECENIA = 0.5;      // +50% wartości drugiej techniki (Task 2)

// Przycięcie dt tańca. Po powrocie na uśpioną kartę dt bywa sekundami -
// bez sufitu jedna klatka dopisałaby gratis punkty za czas, w którym
// nikt nie tańczył (i nikt nie widział).
const MAX_DT_TANCA_S = 0.1;

// REJESTR REAKCJI - premie za łączenie technik. Nowa reakcja to JEDEN
// wpis tutaj plus jedno punkty.reakcja(id, n, now) tam, gdzie zachodzi
// (tools/test-punkty.mjs sprawdza, że każde id wołane z main.js tu jest).
//
// SERIA: jednostki (kłęby) w odstępach < przerwaMs to jedno zdarzenie
// ("jeden pożar"). Pełne punkty do `pelneDo` jednostek w serii, potem
// punkty × pelneDo/k - suma rośnie logarytmicznie. Kolumna dymu to SETKI
// cząstek; bez tego jedna detonacja przebijałaby kilka technik.
// ZGADNIĘTE - cel balansu w specu (pełna Pożoga ≈ 1.5-2× Okadzenia),
// potwierdzany pomiarem: node tools/pomiar-reakcji.mjs.
export const REAKCJE = {
    // Wybuchnięty kłąb podpalonego dymu (js/dym.js - updateAndDraw).
    pozoga: { nazwa: 'Pożoga', punkty: 8, pelneDo: 50, przerwaMs: 1500 },
    // Kłąb dymu pchnięty falą Aarda/Gromu PO RAZ PIERWSZY W ŻYCIU (dym.ostatnioRozwiane).
    rozwianie: { nazwa: 'Rozwianie', punkty: 3, pelneDo: 40, przerwaMs: 1500 }
};

// Sufit jednostek na JEDNO wywołanie reakcja(). Fuzz w tools/test-punkty.mjs
// wyłapał zawieszenie: reakcja('pozoga', 1e9) liczyła pętlę miliard razy.
// Jedna klatka nie może mieć więcej jednostek niż cała chmura - MAX_CZASTEK
// w js/dym.js to 1100, z zapasem bierzemy 2000.
export const MAX_JEDNOSTEK_NA_WYWOLANIE = 2000;

/** Punkty za k-tą (od 1) jednostkę serii reakcji. */
export function punktyJednostki(def, k) {
    return def.punkty * Math.min(1, def.pelneDo / k);
}

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/**
 * Wartość techniki = BAZA × suma trudności jej pieczęci. Nowe combo
 * w KOMBOSY dostaje punkty automatycznie z tej formuły.
 * @returns {number} 0, gdy sekwencja zawiera pieczęć bez wpisu w TRUDNOSC
 *                   (w grze - zero zamiast NaN; w teście - czerwony strażnik)
 */
export function wartoscTechniki(kombo) {
    const s = kombo?.sekwencja;
    if (!Array.isArray(s) || !s.length) return 0;
    let suma = 0;
    for (const id of s) {
        const t = TRUDNOSC[id];
        if (!Number.isFinite(t)) return 0;
        suma += t;
    }
    return Math.round(BAZA_TECHNIKI * suma);
}

export class Punktacja {
    constructor() {
        this.aktywna = true;
        // Hak trybu Zew żywiołów (podprojekt 2): (rodzaj, arg) -> mnożnik.
        // Wartości < 1 i nieskończone są ignorowane - zew nigdy nie zabiera.
        this.mnoznikZewu = () => 1;
        this.reset();
    }

    /** Równy start rundy. Nie rusza `aktywna` ani `mnoznikZewu` - to ustawia tryb. */
    reset() {
        this.wynik = 0;
        this.rozbicie = { taniec: 0, pieczecie: 0, techniki: 0, reakcje: 0 };
        this.momenty = { serie: {}, techniki: {}, splecenia: 0 };
        this._zdarzenia = [];
        this._historia = [];          // [{id, t}] złożonych pieczęci - do splecenia (Task 2)
        this._poprzedniOgon = null;   // {id, t:Set} ogona poprzedniej techniki
        this._ostatniaTechnika = null;
        this._powtorzen = 0;
        this._serie = {};             // reakcje (Task 3)
    }

    /** Jedyne miejsce, które zwiększa wynik. Odrzuca wszystko, co nie jest skończone i dodatnie. */
    _dodaj(warstwa, p) {
        if (!Number.isFinite(p) || p <= 0) return 0;
        this.wynik += p;
        this.rozbicie[warstwa] += p;
        return p;
    }

    _zew(rodzaj, arg) {
        const m = this.mnoznikZewu(rodzaj, arg);
        return Number.isFinite(m) && m >= 1 ? m : 1;
    }

    taniec(plynnosc, responsywnosc, dt) {
        if (!this.aktywna || !Number.isFinite(dt) || dt <= 0) return 0;
        return this._dodaj('taniec',
            PUNKTY_TANCA_NA_S * clamp01(plynnosc) * clamp01(responsywnosc) * Math.min(dt, MAX_DT_TANCA_S));
    }

    pieczec(id, now, miejsce = null) {
        if (!this.aktywna || typeof id !== 'string' || !id || !Number.isFinite(now)) return 0;
        this._historia.push({ id, t: now });
        if (this._historia.length > 16) this._historia.shift();   // najdłuższa sekwencja to 3
        const p = this._dodaj('pieczecie', PUNKTY_PIECZECI * this._zew('pieczec', id));
        if (p > 0) this._zdarzenia.push({ rodzaj: 'pieczec', tekst: '', punkty: p, t: now, miejsce });
        return p;
    }

    technika(kombo, now, miejsce = null) {
        if (!this.aktywna || !kombo || !Number.isFinite(now)) return 0;
        const baza = wartoscTechniki(kombo);
        if (baza <= 0) return 0;

        // Malejący przyrost: nagradza różnorodność, nie karze - punkty nie znikają.
        this._powtorzen = kombo.id === this._ostatniaTechnika ? this._powtorzen + 1 : 0;
        this._ostatniaTechnika = kombo.id;
        const czynnik = Math.max(PODLOGA_POWTORZENIA, 1 - SPADEK_POWTORZENIA * this._powtorzen);
        const p = this._dodaj('techniki', baza * czynnik * this._zew('technika', kombo));

        // SPLECENIE - po NAKŁADANIU OGONÓW, nie po czasie. Bufor kombosów nie
        // jest czyszczony po trafieniu (kombosy.js, "łańcuchy są celowe"), więc
        // pieczęć dzieląca ogony dwóch technik to naturalny sygnał "połączyłeś".
        // Ogon = ostatnie N pieczęci z WŁASNEJ historii (main.js woła pieczec()
        // przed technika()), identyfikowane znacznikiem czasu, nie pozycją.
        // Ta sama technika ze sobą NIE splata się - inaczej stribog x N
        // (każdy kolejny odpala Aarda) byłby najlepszą strategią.
        const n = kombo.sekwencja.length;
        const ogon = new Set(this._historia.slice(-n).map(w => w.t));
        let premia = 0;
        if (this._poprzedniOgon && this._poprzedniOgon.id !== kombo.id
            && [...ogon].some(t => this._poprzedniOgon.t.has(t))) {
            premia = this._dodaj('reakcje', p * PREMIA_SPLECENIA);
            if (premia > 0) this.momenty.splecenia++;
        }
        this._poprzedniOgon = { id: kombo.id, t: ogon };

        this.momenty.techniki[kombo.id] = (this.momenty.techniki[kombo.id] ?? 0) + 1;
        if (p > 0) this._zdarzenia.push({ rodzaj: 'technika', tekst: kombo.nazwa, punkty: p, t: now, miejsce });
        if (premia > 0) this._zdarzenia.push({ rodzaj: 'splecenie', tekst: 'Splecenie', punkty: premia, t: now, miejsce });
        return p + premia;
    }

    /**
     * @param {string} id   klucz REAKCJE
     * @param {number} n    jednostek w tej klatce (ułamek w dół, <= 0 nic)
     * @param {number} now  ms
     */
    reakcja(id, n, now) {
        const def = REAKCJE[id];
        if (!this.aktywna || !def || !Number.isFinite(n) || !Number.isFinite(now)) return 0;
        const ile = Math.min(MAX_JEDNOSTEK_NA_WYWOLANIE, Math.floor(n));
        if (ile <= 0) return 0;

        let s = this._serie[id];
        if (!s || now - s.ostatnieT > def.przerwaMs) {
            s = this._serie[id] = { n: 0, punkty: 0, ostatnieT: now };
        }
        let p = 0;
        for (let i = 0; i < ile; i++) p += punktyJednostki(def, ++s.n);
        s.ostatnieT = now;
        p = this._dodaj('reakcje', p);
        s.punkty += p;
        this.momenty.serie[id] = Math.max(this.momenty.serie[id] ?? 0, s.n);
        // CELOWO bez zdarzenia w kolejce - reakcje przychodzą co klatkę
        // i zalałyby ekran napisami; HUD czyta serieAktywne().
        return p;
    }

    /** Serie reakcji wciąż trwające - HUD pokazuje je jako "Pożoga ×23 +184". */
    serieAktywne(now) {
        const out = [];
        for (const [id, s] of Object.entries(this._serie)) {
            if (Number.isFinite(now) && now - s.ostatnieT <= REAKCJE[id].przerwaMs) {
                out.push({ id, nazwa: REAKCJE[id].nazwa, n: s.n, punkty: s.punkty });
            }
        }
        return out;
    }

    /** Kolejka do unoszących się napisów. PULL: HUD odbiera i kolejka pustoszeje. */
    odbierzZdarzenia() {
        const z = this._zdarzenia;
        this._zdarzenia = [];
        return z;
    }
}
