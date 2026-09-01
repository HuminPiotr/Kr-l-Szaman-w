/**
 * Ślad nadgarstka - bufor pozycji, z których dopasowuje się kształt runy.
 *
 * DWIE RÓWNOLEGŁE POZYCJE NA PUNKT, świadomie, nie nadmiarowo (ten sam wzorzec
 * co ZnakRegistry.surowe/wygladzone). `pozycja` (worldLandmarks pozy, metry,
 * względem bioder) idzie do POMIARU - dopasowania kształtu. `pozycja2D`
 * (landmarks pozy, znormalizowane do płótna) idzie WYŁĄCZNIE do RYSOWANIA
 * świecącej wstęgi za nadgarstkiem (rysujSlad.js) - to jest ta sama zasada
 * co GEMINI.md:49 ("landmarks tylko do rysowania, worldLandmarks do pomiarów"),
 * zastosowana też tutaj, bo world-space nie ma odwrotnego rzutu na piksele.
 *
 * OKNO LICZONE DŁUGOŚCIĄ DROGI, NIE CZASEM. Okno w sekundach robiłoby dwie
 * sprzeczne rzeczy naraz: "ile śladu dopasowujemy" i "jak długo trzeba
 * kreślić". Tancerz rysujący koło w 3 s miałby w buforze kawałek łuku (wynik
 * nigdy nie szczytuje), tancerz rysujący je w 0,6 s miałby cztery koła (też
 * nie jedno) - runa byłaby osiągalna tylko w wąskim, nienazwanym paśmie
 * tempa. To jest dokładnie ta ukryta kara, której zabrania reguła nadrzędna
 * (GEMINI.md §2): wolny tancerz nie robi nic źle.
 *
 * SUFIT WIEKU PUNKTU osobno od długości drogi. Bez niego gracz, który
 * przestał się ruszać, ma zamrożony bufor z ostatnim kształtem na zawsze -
 * stanie w miejscu ma wygaszać ślad, nie utrwalać go.
 *
 * KAŻDY PUNKT NIESIE TEŻ ODCZYT DŁONI (otwarcie i zwinięcie w pięść) Z TEJ
 * SAMEJ KLATKI. To nie jest wygoda - to jedyny sposób, żeby kwalifikator
 * (pieczecie.js:pokrycie) uśredniał się po CAŁYM śladzie, a nie po jednej
 * klatce. Pojedyncza zła klatka trackingu dłoni wypłukuje się w średniej,
 * zamiast zbijać wynik do zera - dokładnie ta sama logika, dla której
 * plynnosc.js liczy RMS po oknie, a nie odczytuje jednej próbki.
 *
 * ŹRÓDŁO POZYCJI: worldLandmarks POZY (punkty 15/16 - nadgarstki), NIE
 * landmarks 2D dłoni (zniekształcone przez cover-fit) i NIE worldLandmarks
 * dłoni (metryczne, ale względem środka DŁONI - nie widać w nich ruchu
 * dłoni w przestrzeni). Patrz dopisek w spec docs/superpowers/specs/
 * 2026-09-01-runy-i-kwalifikatory-design.md.
 *
 * AKTUALIZACJA RAZ NA KLATKĘ, NIE W score(). Sześć znaków-run czyta dwa
 * takie bufory (lewy/prawy nadgarstek). Gdyby każdy znak dopisywał punkt
 * przy własnym wywołaniu score(), ten sam ruch trafiłby do bufora sześć
 * razy na klatkę.
 */

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka D pokazuje
// długość bieżącego śladu). Jednostka: metry (worldLandmarks).
//
// MAX_DLUGOSC_M CELOWO NIECO PONIŻEJ JEDNEGO OKRĄŻENIA, NIGDY POWYŻEJ.
// Zmierzone na syntetycznym kole (promień 0.15 m, obwód ~0.94 m) w STANIE
// USTALONYM ciągłego kreślenia (wiele okrążeń pod rząd, jak w decyzji "runa
// przez powtarzanie"):
//
//   ułamek obwodu   wynik dopasowania w stanie ustalonym
//   0.5             0.62
//   0.7             0.87
//   0.8 - 1.05      1.00  <- płaskie plateau, tu celujemy
//   1.2             0.86
//   1.3             0.63
//
// ASYMETRIA JEST KLUCZOWA: okno NIEDOPEŁNIONE (gracz rysuje kolo WIĘKSZE niż
// założone) daje ARC - fragment pętli - i degraduje ŁAGODNIE (ciągłość
// zachowana, patrz plateau 0.5-0.8). Okno PRZEPEŁNIONE (gracz rysuje kolo
// MNIEJSZE) daje PRZERZEDZONĄ, KANCIASTĄ pętlę - resampling do stałej liczby
// punktów musi wtedy pokryć >360° zamiast 360°, próbki lądują co grubiej niż
// szablon i błąd rośnie STROMO (0.63 przy zaledwie 1.3x). Bezpieczniej więc
// celować NIŻEJ założonego obwodu niż wyżej - stąd 0.8 obwodu 0.15 m koła,
// zaokrąglone.
export const MAX_DLUGOSC_M = 0.75;
export const MAX_WIEK_S = 4.0;

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export class SladNadgarstka {
    constructor({ maxDlugosc = MAX_DLUGOSC_M, maxWiek = MAX_WIEK_S } = {}) {
        this.maxDlugosc = maxDlugosc;
        this.maxWiek = maxWiek;
        this._punkty = [];   // [{x, y, czas, otwartosc: 0..1|null, piesc: 0..1|null}]
        this._dlugosc = 0;   // suma odcinków w buforze - trzymana bieżąco, nie przeliczana
        this._zegar = 0;

        // Rośnie przy KAŻDEJ zmianie zawartości bufora (dodaj()/wyczysc()).
        // Nie jest tu do niczego używana - to hak dla definicje.js, żeby
        // mogło pamiętać "znormalizowany kształt liczony dla wersji N" i nie
        // przeliczać go po sześć razy na klatkę (raz na każdą z sześciu run
        // dzielących te same dwa bufory) tylko dlatego, że sam bufor się
        // nie zmienił od ostatniego razu.
        this.wersja = 0;
    }

    /**
     * @param {object} wejscie
     * @param {{x:number,y:number}|null} wejscie.pozycja    nadgarstek, worldLandmarks (metry) - do POMIARU
     * @param {{x:number,y:number}|null} [wejscie.pozycja2D] nadgarstek, landmarks znorm. do płótna - WYŁĄCZNIE do rysowania
     * @param {number|null} [wejscie.otwartosc]  ileWyprostowanych()/5 sparowanej dłoni, 0..1
     * @param {number|null} [wejscie.piesc]      zwinieta() sparowanej dłoni, 0..1
     * @param {number} dt  sekundy
     */
    dodaj({ pozycja = null, pozycja2D = null, otwartosc = null, piesc = null } = {}, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._zegar += krok;

        if (pozycja && Number.isFinite(pozycja.x) && Number.isFinite(pozycja.y)) {
            const ostatni = this._punkty[this._punkty.length - 1];
            if (ostatni) {
                const d = Math.hypot(pozycja.x - ostatni.x, pozycja.y - ostatni.y);
                if (Number.isFinite(d)) this._dlugosc += d;
            }
            const ma2D = pozycja2D && Number.isFinite(pozycja2D.x) && Number.isFinite(pozycja2D.y);
            this._punkty.push({
                x: pozycja.x, y: pozycja.y, czas: this._zegar,
                x2d: ma2D ? pozycja2D.x : null, y2d: ma2D ? pozycja2D.y : null,
                otwartosc: Number.isFinite(otwartosc) ? clamp01(otwartosc) : null,
                piesc: Number.isFinite(piesc) ? clamp01(piesc) : null
            });
        }

        this._przytnij();
        this.wersja++;
    }

    /** Trafienie - runa się złożyła. Bez tego pierścień natychmiast zaczynałby
     *  napełniać się TĄ SAMĄ runą, bo bufor dalej trzyma ten sam kształt. */
    wyczysc() {
        this._punkty = [];
        this._dlugosc = 0;
        this.wersja++;
    }

    /** Surowe punkty do dopasowania kształtu (bez metadanych dłoni). */
    punkty() {
        return this._punkty.map(p => ({ x: p.x, y: p.y }));
    }

    /**
     * Punkty 2D DO RYSOWANIA (wstęga śladu) - TA SAMA DŁUGOŚĆ co punkty(),
     * z `null` tam, gdzie ta konkretna próbka nie miała odczytu 2D.
     *
     * CELOWO nie kompaktujemy (nie pomijamy nulli). Gdyby renderer dostał
     * skróconą listę, dwa punkty odległe w czasie o lukę wyglądałyby jak
     * SĄSIADUJĄCE i wstęga rysowałaby prostą linię PRZEZ lukę zamiast ją
     * przerwać - myląca sylwetka śladu przy tym jedynym kanale sprzężenia
     * zwrotnego, jaki gracz ma do nauki kreślenia (rysujSlad.js).
     */
    punkty2D() {
        return this._punkty.map(p => p.x2d !== null ? { x: p.x2d, y: p.y2d } : null);
    }

    dlugoscDrogi() {
        return this._dlugosc;
    }

    /** Ułamek punktów bufora z ważnym odczytem dłoni - 0 gdy dłoń poza kadrem cały czas. */
    pokrycieDloni() {
        if (!this._punkty.length) return 0;
        let n = 0;
        for (const p of this._punkty) if (p.otwartosc !== null) n++;
        return n / this._punkty.length;
    }

    sredniaOtwartosc() {
        return this._srednia(p => p.otwartosc);
    }

    sredniaPiesc() {
        return this._srednia(p => p.piesc);
    }

    _srednia(wybierz) {
        let suma = 0, n = 0;
        for (const p of this._punkty) {
            const v = wybierz(p);
            if (v !== null) { suma += v; n++; }
        }
        return n > 0 ? suma / n : 0;
    }

    _przytnij() {
        // Wiek - niezależnie od tego, czy ta klatka dopisała punkt. Dozwolone
        // zejście do ZERA punktów: długie bezruch ma WYGASZAĆ ślad całkowicie
        // (decyzja projektu), nie zostawiać wiecznie jeden martwy punkt.
        while (this._punkty.length > 0
               && this._zegar - this._punkty[0].czas > this.maxWiek) {
            this._usunPierwszy();
        }
        // Długość drogi.
        while (this._punkty.length > 2 && this._dlugosc > this.maxDlugosc) {
            this._usunPierwszy();
        }
    }

    _usunPierwszy() {
        const a = this._punkty[0], b = this._punkty[1];
        if (a && b) {
            const d = Math.hypot(b.x - a.x, b.y - a.y);
            if (Number.isFinite(d)) this._dlugosc = Math.max(0, this._dlugosc - d);
        }
        this._punkty.shift();
    }
}
