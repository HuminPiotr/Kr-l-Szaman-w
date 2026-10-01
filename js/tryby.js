/**
 * Tryby gry - silnik rundy i konfiguracja.
 * Spec: docs/superpowers/specs/2026-10-01-tryby-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM i bez performance.now() - czas przychodzi z
 * zewnątrz (`now`, ms), więc testy w node używają fałszywego zegara.
 *
 * KONIEC RUNDY TO PODSUMOWANIE, NIE PORAŻKA (GEMINI.md §2). Runda nigdy nie
 * kończy się "za błąd" - tylko czasem albo końcem pieśni. Wybrzmienie
 * (punkty jeszcze przyrastają) pozwala dymowi dopalić się do końca zamiast
 * urwać wybuch w pół kłęba.
 */
export const ODLICZANIE_S = 3;
export const WYBRZMIENIE_S = 2;
export const ZAPOWIEDZ_S = 4;           // "Teraz tańczy: X" - tylko Krąg
export const PROBA_DLUGOSCI = [60, 90, 120];
export const PIESN_AWARYJNA_S = 90;     // gdy pieśń się nie wczyta - runda jak próba
export const OSTATNIE_S = 10;
export const MAX_DT_RUNDY_S = 0.25;     // ten sam powód co clamp dt w main.js

export const MAX_NICK = 16;
export const MIN_KRAG = 2;
export const MAX_KRAG = 6;

const NASTEPNY = { ZAPOWIEDZ: 'ODLICZANIE', ODLICZANIE: 'TRWA', TRWA: 'WYBRZMIENIE', WYBRZMIENIE: 'KONIEC' };

export class Runda {
    /**
     * @param {{dlugoscS?:number, zapowiedz?:boolean}} [opcje]
     *   dlugoscS  - czas fazy TRWA (próba: wybór gracza; obrzęd: długość pieśni)
     *   zapowiedz - Krąg: najpierw 4 s "Teraz tańczy: X"
     */
    constructor({ dlugoscS, zapowiedz = false } = {}) {
        this.dlugoscS = Number.isFinite(dlugoscS) && dlugoscS > 0 ? dlugoscS : PIESN_AWARYJNA_S;
        this.zapowiedz = !!zapowiedz;
        this.stan = 'NIEZACZETA';
        this._wStanie = 0;       // sekundy w bieżącym stanie
        this._czasTrwania = 0;   // sekundy fazy TRWA (zamrożone po jej końcu)
        this._ostatnieNow = NaN;
    }

    start(now) {
        if (!Number.isFinite(now)) return;
        this._ostatnieNow = now;
        this._wStanie = 0;
        this._czasTrwania = 0;
        this.stan = this.zapowiedz ? 'ZAPOWIEDZ' : 'ODLICZANIE';
    }

    /** @returns {string} stan po aktualizacji */
    update(now) {
        const s = this.stan;
        if (s === 'NIEZACZETA' || s === 'KONIEC' || s === 'PRZERWANA') return s;
        if (!Number.isFinite(now)) return s;
        // Zawieszona karta: now skacze o minuty. Przycinamy dt jak main.js, więc
        // runda przesuwa się najwyżej o MAX_DT_RUNDY_S na klatkę. O końcu rundy po
        // uśpieniu rozstrzyga wtedy `ended` pieśni (zakonczPiesn), nie zegar.
        const dt = Math.min(MAX_DT_RUNDY_S, Math.max(0, (now - this._ostatnieNow) / 1000));
        this._ostatnieNow = now;
        this._wStanie += dt;
        if (s === 'TRWA') this._czasTrwania = this._wStanie;

        const limit = { ZAPOWIEDZ: ZAPOWIEDZ_S, ODLICZANIE: ODLICZANIE_S, TRWA: this.dlugoscS, WYBRZMIENIE: WYBRZMIENIE_S }[s];
        if (this._wStanie >= limit) {
            if (s === 'TRWA') this._czasTrwania = this.dlugoscS;
            this._wStanie -= limit;
            this.stan = NASTEPNY[s];
        }
        return this.stan;
    }

    /** Pieśń skończyła się przed upływem czasu - przejdź do wybrzmienia. Tylko z TRWA. */
    zakonczPiesn() {
        if (this.stan !== 'TRWA') return;
        this._czasTrwania = this._wStanie;
        this._wStanie = 0;
        this.stan = 'WYBRZMIENIE';
    }

    /** Esc - bez wyniku do zapisu. Nic nie robi przed startem i po końcu. */
    przerwij() {
        if (this.stan === 'NIEZACZETA' || this.stan === 'KONIEC' || this.stan === 'PRZERWANA') return;
        this.stan = 'PRZERWANA';
    }

    get czasRundyS() { return this._czasTrwania; }

    get pozostaloS() {
        if (this.stan === 'TRWA') return Math.max(0, this.dlugoscS - this._wStanie);
        if (this.stan === 'ZAPOWIEDZ' || this.stan === 'ODLICZANIE') return this.dlugoscS;
        return 0;
    }

    get postep() {
        if (this.stan === 'TRWA') return Math.min(1, this._wStanie / this.dlugoscS);
        if (this.stan === 'ZAPOWIEDZ' || this.stan === 'ODLICZANIE' || this.stan === 'NIEZACZETA') return 0;
        return 1;
    }

    /** 3, 2, 1 do wyświetlenia w ODLICZANIU; 0 poza nim. */
    get odliczanie() {
        if (this.stan !== 'ODLICZANIE') return 0;
        return Math.max(1, Math.min(ODLICZANIE_S, Math.ceil(ODLICZANIE_S - this._wStanie)));
    }

    get ostatnieSekundy() { return this.stan === 'TRWA' && this.pozostaloS <= OSTATNIE_S; }

    /** Czy w tym stanie punkty przyrastają. WYBRZMIENIE - tak (dym dopala się do końca). */
    get punktuje() { return this.stan === 'TRWA' || this.stan === 'WYBRZMIENIE'; }
}

const przytnijNick = (s) => String(s).trim().slice(0, MAX_NICK);

/**
 * Konfiguracja rundy z adresu - CZYSTA funkcja (nie czyta `location`).
 * Do czasu menu (podprojekt 3) to jedyne wejście: `?tryb=proba&czas=60&zew=1&krag=Ola,Bartek`.
 * Brak/niepoprawny tryb = swobodny: bez punktów, bez końca, jak dawna gra.
 * @param {string} search  np. location.search
 */
export function parsujKonfiguracje(search) {
    const p = new URLSearchParams(typeof search === 'string' ? search : '');
    const tryb = p.get('tryb');
    if (tryb !== 'proba' && tryb !== 'obrzed') {
        return { tryb: 'swobodny', dlugoscS: 0, piesn: 0, zew: false, krag: null };
    }
    const czas = Number(p.get('czas'));
    const dlugoscS = tryb === 'proba' ? (PROBA_DLUGOSCI.includes(czas) ? czas : 90) : PIESN_AWARYJNA_S;
    const idx = Number.parseInt(p.get('piesn'), 10);
    const zew = ['1', 'true'].includes(p.get('zew'));
    let krag = (p.get('krag') ?? '').split(',').map(przytnijNick).filter(Boolean).slice(0, MAX_KRAG);
    if (krag.length < MIN_KRAG) krag = null;
    return { tryb, dlugoscS, piesn: Number.isFinite(idx) && idx > 0 ? idx : 0, zew, krag };
}
// --- ZEW ŻYWIOŁÓW ---

// Id pieczęci - te same co w KOMBOSY i TRUDNOSC (js/punkty.js). Test w
// tools/test-tryby.mjs pilnuje, że każdy ma trudność, nazwę i występuje
// w jakimś combo - żywioł, którego nie da się złożyć, byłby martwą prośbą.
export const ZYWIOLY = ['swarog', 'weles', 'perun', 'stribog', 'mokosz'];
export const NAZWY_ZYWIOLOW = { swarog: 'ogień', weles: 'ziemia', perun: 'błyskawica', stribog: 'powietrze', mokosz: 'woda' };

// ZGADNIĘTE - do strojenia na żywym ciele. Pierwsza prośba po chwili tańca
// (gracz musi się rozgrzać), potem co 20 s - dość długo na złożenie pieczęci
// (~0,9 s) i jedno combo, za krótko na nudę.
export const ZEW_START_S = 5;
export const ZEW_CO_S = 20;

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/**
 * Zew żywiołów: co ZEW_CO_S duch prosi o inny żywioł - pieczęć tego żywiołu
 * i technika, która go zawiera, dają ×2. NIE JEST ZADANIEM: zignorowanie prośby
 * nic nie kosztuje (§2), zmiana żywiołu to tylko nowa zachęta.
 * Mnożnik dotyczy pieczęci i techniki, NIE reakcji i NIE tańca - inaczej Zew ×2
 * na Pożodze wyprowadziłby zmierzony balans (podprojekt 1) poza cel.
 */
export class Zew {
    constructor(losowa = Math.random) {
        this._losowa = losowa;
        this.zywiol = null;
        this._nastepnyS = ZEW_START_S;
    }

    update(czasRundyS) {
        if (!Number.isFinite(czasRundyS) || czasRundyS < this._nastepnyS) return;
        // Zawsze inny niż poprzedni; clamp01 + min() dla losowej zwracającej NaN/1.0.
        const kandydaci = ZYWIOLY.filter(z => z !== this.zywiol);
        const idx = Math.min(kandydaci.length - 1, Math.floor(clamp01(this._losowa()) * kandydaci.length));
        this.zywiol = kandydaci[idx];
        // JEDEN żywioł na update, nawet po skoku czasu - nie przewijamy zaległych okien.
        this._nastepnyS = czasRundyS + ZEW_CO_S;
    }

    /**
     * @param {'pieczec'|'technika'|string} rodzaj
     * @param {string|{sekwencja:string[]}} arg  id pieczęci albo definicja techniki
     * @returns {1|2}
     */
    mnoznik(rodzaj, arg) {
        if (!this.zywiol) return 1;
        if (rodzaj === 'pieczec') return arg === this.zywiol ? 2 : 1;
        if (rodzaj === 'technika') return Array.isArray(arg?.sekwencja) && arg.sekwencja.includes(this.zywiol) ? 2 : 1;
        return 1;
    }
}

// --- KRĄG ---

/**
 * Krąg - 2-6 graczy po kolei przy jednym komputerze. Wynik każdego gracza trafi
 * do Księgi (podprojekt 3) osobno, jakby zagrał własną rundę.
 */
export class Krag {
    /** @param {string[]} nicki  rzuca Error poza 2-6 graczami po oczyszczeniu */
    constructor(nicki) {
        if (!Array.isArray(nicki)) throw new Error('Krąg wymaga listy nicków');
        const widziane = new Map();   // nick małymi literami -> ile razy
        this.nicki = [];
        for (const surowy of nicki) {
            const nick = przytnijNick(surowy ?? '');
            if (!nick) continue;
            const klucz = nick.toLowerCase();
            const n = (widziane.get(klucz) ?? 0) + 1;
            widziane.set(klucz, n);
            // Dubel dostaje sufiks, żeby w Księdze i na podium dwie Ole się nie zlały.
            this.nicki.push(n === 1 ? nick : `${nick} ${n}`.slice(0, MAX_NICK + 2));
        }
        if (this.nicki.length < MIN_KRAG || this.nicki.length > MAX_KRAG) {
            throw new Error(`Krąg wymaga ${MIN_KRAG}-${MAX_KRAG} graczy`);
        }
        this.wyniki = [];
    }

    get biezacy() { return this.nicki[this.wyniki.length] ?? null; }
    get czyKoniec() { return this.wyniki.length >= this.nicki.length; }

    zapiszWynik(wynik, rozbicie, momenty) {
        if (this.czyKoniec) return false;
        this.wyniki.push({
            nick: this.biezacy,
            wynik: Number.isFinite(wynik) && wynik > 0 ? wynik : 0,
            rozbicie: rozbicie && typeof rozbicie === 'object' ? rozbicie : {},
            momenty: momenty && typeof momenty === 'object' ? momenty : {}
        });
        return true;
    }

    /** Malejąco po wyniku; remis zostaje w kolejności wejścia do Kręgu (sort jest stabilny). */
    get podium() { return [...this.wyniki].sort((a, b) => b.wynik - a.wynik); }
}
