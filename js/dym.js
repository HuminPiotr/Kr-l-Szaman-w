/**
 * Dym Okadzenia - WSTĘGA dymu, fizyka, front ognia, rysowanie.
 *
 * Nie wie nic o pieczęciach, kombosach ani mocy - dostaje pozycję/kierunek/
 * siłę/wyrazistość z js/dmuchanie.js i punkty zarzewia z main.js (dziś:
 * Płonący Palec, jutro: dowolna inna technika ognia - patrz podpal()). Ten sam
 * podział odpowiedzialności co ogien.js/plonacyPalec.js.
 *
 * ================== V4 (2026-09-11, trzeci test na kamerze) ================
 * Zgłoszenie: "ciągle wykorzystujesz tę teksturę kółka. Wypuszczana linia
 * powinna być STAŁA i dopiero przez umiejętne zataczanie okręgów tworzyć
 * kółka. Musisz odejść od tej tekstury. Ponadto dym powinien móc być
 * wypuszczony w CZTERY STRONY ŚWIATA, mocno w boki i w DÓŁ, a nie jak teraz
 * od razu lecieć w górę. Początkowa siła kierunku powinna zależeć od
 * ustawienia gracza."
 *
 * Diagnoza v3 (nazwane przyczyny, nie strojenie stałych):
 *   1. RYSOWANIE. `drawImage(MANIFEST.mgla[...])` na każdą cząstkę - okrągła
 *      tekstura. Cząstki sąsiadowały w czasie, ale NIC ich nie łączyło:
 *      rzadziej = paciorki, gęściej = pasmo nachodzących kółek. Żadna liczba
 *      ani rozmiar sprite'ów tego nie zmieni - trzeba rysować KRESKĘ.
 *   2. KIERUNEK. dmuchanie.js miało stały skos w górę (SKOS_W_GORE = -0.3)
 *      i pół wagi na pochylenie głowy - składowa Y nigdy nie była dodatnia,
 *      więc w dół dmuchnąć się NIE DAŁO.
 *   3. WYPORNOŚĆ. Waga wyporu 1-exp(-wiek/0.8 s): po ~1 s wszystko płynęło
 *      w górę, nawet gdyby kierunek był w dół.
 *   4. SIŁA. `gest x moc` - nie miała nic wspólnego z ustawieniem gracza.
 *
 * Odpowiedź - WĘZŁY WSTĘGI zamiast cząstek:
 *   - węzeł ma to, co miała cząstka (pozycja, prędkość, wiek, promień, stan),
 *     ale należy do WSTĘGI i ma w niej sąsiadów; rysowane są ODCINKI między
 *     kolejnymi węzłami (`stroke`, lineCap/lineJoin 'round'), nie sprite'y;
 *   - `r` to POŁOWA szerokości kreski: 0.004 W przy ustach -> 0.035-0.050 W
 *     dalej (stożek "jak z papierosa" - życzenie "cienka przy ustach,
 *     grubsza dalej"); kreska jest ciągła z definicji, więc tempo emisji może
 *     być NISKIE (45/s) - to jest cały budżet, który v3 przepalało na gęstość;
 *   - miękkość bez blura: dwa przebiegi (szerokie halo o niskiej alfie +
 *     węższy rdzeń) na płótnie pomocniczym 1/3 rozdzielczości, skalowanym
 *     3x przy kompozycji (wzorzec ekran.js:_bloom; skalowanie samo wygładza);
 *   - JEDNA populacja: wstęga starzeje się, tyje i blednie, aż zostaje mgła.
 *
 * Sprite'y Kenney zostają WYŁĄCZNIE przy zapłonie i wybuchu - to jest ta
 * część, którą właściciel gry lubi ("podoba mi się wybuch").
 *
 * ================== KIERUNEK: CZTERY STRONY ŚWIATA ==================
 * Wyporność wchodzi z wagą 1-exp(-wiek/TAU_WYPORU_S), TAU = 6 s (v3: 0.8 s) -
 * namalowany kształt trzyma pozycję ~8 s, a dym wypuszczony w dół NAPRAWDĘ
 * leci w dół i tam zostaje. Dopiero potem płynie w górę i kłębi się pod
 * sufitem (wznoszenieCzynnik, patrz niżej).
 *
 * ================== ZMIANA FIZYKI W TRAKCIE IMPLEMENTACJI (2026-09-11) =====
 * Pierwsza wersja specu zakładała, że dym opuszcza górę ekranu w ~50-70 s.
 * Życzenie właściciela gry: ma się KŁĘBIĆ PO CAŁYM EKRANIE, głównie pod
 * sufitem, i blednąć dopiero BLISKO KOŃCA życia. Stąd wznoszenieCzynnik():
 * unoszenie SŁABNIE przy górnej krawędzi - dym zwalnia i rozlewa się na boki,
 * jak dym uderzający o sufit.
 *
 * ================== TRZY STANY WĘZŁA ==================
 *   DYM     - płynie, tyje, dłonie mogą go rozgarniać (rozgarnij()).
 *   ZAPLON  - podpalony (podpal()); po krótkim opóźnieniu zaraża sąsiadów
 *             (FRONT biegnie WZDŁUŻ WSTĘGI i przeskakuje na sąsiednie),
 *             potem wybucha.
 *   WYBUCH  - kula ognia, krótko, potem węzeł znika NA ZAWSZE. Wstęga zostaje
 *             PRZERWANA w tym miejscu (`przerwa` na następnym węźle) - ogień
 *             faktycznie przepala kreskę.
 *
 * ================== RYSOWANIE: DWA TRYBY MIESZANIA ==================
 * DYM rysowany 'source-over' w jasnej szarości - reszta gry rysuje WYŁĄCZNIE
 * 'lighter' (ogien.js/fala.js/iskry.js/kolowrot.js), a addytywne mieszanie
 * zjada szary dym do niewidzialności (ta sama pułapka co w efekty.js:206-216
 * i nagłówku ogien.js). ZAPLON/WYBUCH przełączają na 'lighter' z ciepłym
 * tintem - to WŁAŚNIE JEST "dym zmienia zachowanie po podpaleniu".
 *
 * Ciepły tint jest WSTĘPNIE WYPALONY w kilku stopniach (nie liczony co
 * klatkę) - assety.js:wypalTintowany cache'uje po `barwa`, a ciągle
 * zmieniająca się barwa rozsadziłaby ten cache w nieograniczony Map.
 */
import { MANIFEST, obraz, wypalTintowany } from './assety.js';

// --- Emisja ---
// ZGADNIĘTE - do strojenia na kamerze. Tempo jest NIŻSZE niż w v3 (90/s), bo
// ciągłość daje KRESKA, nie gęstość sprite'ów; wystarczy tyle, żeby odstęp
// węzłów wzdłuż lotu nie ścinał zakrętów. Oddech to powolna modulacja ±15%,
// nigdy do zera.
export const WEZLY_NA_S = 60;
export const ODDECH_AMPLITUDA = 0.15;
export const ODDECH_HZ = 0.3;

// --- Sufity ---
// 5000 węzłów przy 60/s to ~80 s ciągłego dmuchania, zanim FIFO zacznie
// wypychać najstarsze; przerzedzanie dojrzałych wstęg (PRZERZEDZ_PO_S)
// obniża liczbę RYSOWANYCH odcinków jeszcze bardziej.
export const MAX_WEZLOW = 5000;
export const MAX_WEZLOW_WSTEGI = 700;

// --- Wylot z ust ---
// Prędkość w W/s (płótno bywa 1280 i 1920). Zasięg wychodzi z oporu mieszanego
// (OPOR_WYLOTU -> OPOR_DYMU wagą exp(-wiek/TAU_WYLOTU_S)) - dobrany
// numerycznie: ~0.32 W po sekundzie przy pełnej wyrazistości, ~0.19 W przy
// nijakiej pozie (test pilnuje przedziału). Strumień MA strzelać, ale nie za
// ekran: przy 1.3 W/s dmuchnięcie w dół z wysokości głowy lądowało pod dolną
// krawędzią.
export const WYLOT_PREDKOSC_W_S = 0.95;
// Wyrazistość ustawienia gracza skaluje PRĘDKOŚĆ (życzenie: "początkowa siła
// kierunku zależna od ustawienia gracza"). Podłoga: poza nijaka = dym sączy
// się tuż przy ustach, ale technika NIGDY nie staje (reguła "nic nie mówi źle").
export const WYRAZISTOSC_PODLOGA = 0.35;
export const OPOR_WYLOTU = 3.2;          // 1/s - hamowanie świeżego węzła
export const TAU_WYLOTU_S = 1.0;         // waga wylotu exp(-wiek/τ): miesza OPOR_WYLOTU -> OPOR_DYMU
const ROZRZUT_UST_PX = 2;                // mikro-rozrzut punktu narodzin (kreska nie jest linijką)

// --- Szerokość kreski (r = POŁOWA szerokości) ---
export const R_START_W = 0.008;          // ~15 px przy ustach na 1920 (kreska ma być WIDOCZNA)
// Kreska ma zostać KRESKĄ: przy 0.035-0.050 W (v4 pierwsze podejście) linia
// była szersza niż długa i czytała się jako placek. Rozrost jest powolny -
// przez pierwsze sekundy kształt jest czytelny, mgła robi się z niego dopiero
// po ~minucie.
const R_KONIEC_MIN_W = 0.030, R_KONIEC_MAX_W = 0.042;
export const ROZROST_TAU_S = 15;         // 90% szerokości po ~35 s

// --- Życie węzła ---
export const ZYCIE_MIN_S = 100, ZYCIE_MAX_S = 140;
export const NAROST_S = 0.3;             // narost alfy w SEKUNDACH, nie w ułamku życia
export const ZANIK_OD = 0.75;            // zanik alfy w OSTATNIEJ ĆWIARTCE życia
// Alfa cienieje z szerokością (zachowanie "masy"): świeża kreska gęsta,
// rozdęta w mgłę - rzadka.
export const ALFA_START = 0.42, ALFA_KONIEC = 0.14;

// --- Przerzedzanie dojrzałych wstęg ---
// Gdy kreska jest już dużo szersza niż odstęp węzłów, co drugi węzeł nic nie
// wnosi do KSZTAŁTU, a kosztuje odcinek na klatkę. Pierwszy i ostatni zostają.
export const PRZERZEDZ_PO_S = [12, 30];  // wiek najmłodszego węzła wstęgi

// --- Wyporność: OPÓŹNIONA, żeby dało się malować w dół i w bok ---
export const TAU_WYPORU_S = 8;

// --- Ruch wewnętrzny ("żyje") ---
// Pole przepływu zależne od POZYCJI i czasu (nie per-węzeł szum): sąsiednie
// fragmenty wstęgi płyną spójnie, jak wiry, więc kreska faluje, zamiast się
// rozpryskiwać.
const POLE_AMPLITUDA_W_S2 = 0.006;       // ułamek W/s²
const POLE_DLUGOSC_FALI_W = 0.35;        // ułamek W - rozmiar wiru
const POLE_OMEGA_1 = 0.35, POLE_OMEGA_2 = 0.27;   // rad/s - jak szybko wiry wędrują
const OPOR_DYMU = 0.6;                   // 1/s
const ODDECH_SZEROKOSCI = 0.05, ODDECH_OMEGA = 1.9;
const MIGOTANIE_ALFY = 0.08, MIGOTANIE_OMEGA = 1.3;

// --- Wznoszenie, słabnące blisko sufitu (patrz nagłówek "ZMIANA FIZYKI") ---
const WZNOSZENIE_H_S = 0.045;
export const SUFIT_Y_H = 0.12;           // górna granica - tu wznoszenie prawie zanika
export const SPADEK_OD_Y_H = 0.55;       // poniżej tego Y (w dół ekranu) pełne wznoszenie
const SUFIT_MIN_CZYNNIK = 0.12;          // NIGDY do zera - lekkie mrowienie zostaje
const ROZLEW_BOK_H_S = 0.020;            // dryf w bok rosnący blisko sufitu - "rozlewa się"

// --- Rozgarnianie dłońmi ---
const ROZGARNIJ_PROMIEN_W = 0.13;
const ROZGARNIJ_SILA = 0.55;

// --- Zapłon i front ognia ---
// Kreska jest CIENKA u wylotu, więc kontakt musi być hojniejszy niż przy
// kłębach v3 (tam 1.5) - inaczej płonący palec mijałby świeżą linię.
const ZAPLON_KONTAKT_MNOZNIK = 2.5;
const FRONT_PROMIEN_MNOZNIK = 2.0;       // zarażanie SĄSIEDNICH WSTĘG (wzdłuż własnej front idzie zawsze)
export const OPOZNIENIE_FRONTU_S = 0.15;
export const CZAS_DO_WYBUCHU_S = 0.35;
export const CZAS_WYBUCHU_S = 0.4;
export const SPRITE_CO_ILE = 6;          // co ile-ty wybuchający węzeł dostaje sprite

// --- Rysowanie ---
// Miękkość bez tekstury: TRZY przebiegi tej samej kreski - szeroka, ledwie
// widoczna aura, węższe halo i wąski rdzeń. Razem dają gradient poprzeczny
// (gęsto w środku, mgliście na brzegu), czyli to, co w v3 robił sprite mgły.
const DZIELNIK_PLOTNA = 3;               // płótno pomocnicze 1/3 - skalowanie 3x samo wygładza krawędź
// PIĘĆ stopni, nie trzy: przy trzech widać koncentryczne obwódki zamiast
// gradientu (każdy przebieg to stroke o stałej alfie).
const PRZEBIEGI = [
    { szerokosc: 3.6, alfa: 0.12 },
    { szerokosc: 2.8, alfa: 0.18 },
    { szerokosc: 2.1, alfa: 0.28 },
    { szerokosc: 1.5, alfa: 0.45 },
    { szerokosc: 1.0, alfa: 1.00 }
];
const PRZEBIEGI_OGNIA = [
    { szerokosc: 3.0, alfa: 0.10 },
    { szerokosc: 1.8, alfa: 0.22 },
    { szerokosc: 1.0, alfa: 0.55 }
];
const ROZMYCIE_PX = 4;                   // jeden blur na klatkę przy kompozycji (nie na sprite)
const SZUM_SZEROKOSCI = 0.25;            // per-węzeł, TYLKO szerokość - kreska nie ma być rurką
const KWANT_SZEROKOSCI_PX = 3;           // kubełki szerokości na płótnie pomocniczym
const KWANT_ALFY = 0.05;

// --- Barwy ---
const BARWA_DYMU = '215, 215, 222';      // jasna, chłodna szarość - source-over
// Pierwszy stopień jest CIEMNY i ciepły, nie biały: te kreski idą w trybie
// 'lighter', więc jasna szarość dodana do rozświetlonego dymu robiła białe
// rury zamiast pełznącego ognia.
const BARWA_ZAPLONU_STOPNIE = [
    [90, 70, 55],
    [200, 140, 70],
    [255, 150, 50],
    [255, 95, 25],
    [215, 40, 10]
];
const BARWA_RDZENIA = [255, 238, 200];
const BARWA_ROZBLYSKU = [255, 225, 170];

export class Dym {
    constructor() {
        this._wstegi = [];           // [{ id, wezly: [], przerzedzen }] - kolejność = kolejność powstania
        this._aktywna = null;        // wstęga, do której dopisuje emituj()
        this._nastepneId = 1;
        this._ile = 0;               // liczba węzłów - licznik przyrostowy, bez skanu
        this._odcinkow = 0;          // odcinki narysowane w ostatniej klatce (HUD/budżet)
        this._nadwyzka = 0;          // ułamki węzłów przeniesione na następną klatkę
        this._t = 0;                 // zegar pola przepływu
        this._tEmisji = 0;           // zegar oddechu (płynie tylko podczas dmuchania)
        this._emitowal = false;      // czy emituj() zawołano w tej klatce
        this._poprzZaczep = null;    // usta z poprzedniej klatki emisji - interpolacja (malowanie)
        this._plotnoPom = null;
        this._ctxPom = null;
    }

    get liczba() { return this._ile; }
    get wsteg() { return this._wstegi.length; }
    get odcinkow() { return this._odcinkow; }
    get plonacych() {
        let n = 0;
        for (const c of this.wezly()) if (c.stan === 'ZAPLON') n++;
        return n;
    }

    /**
     * Oddech 1±ODDECH_AMPLITUDA - powolna modulacja tempa i prędkości wylotu
     * ("wypychany z płuc"), NIGDY do zera. Czysta - testowalna.
     */
    static oddech(t) {
        return 1 + ODDECH_AMPLITUDA * Math.sin(2 * Math.PI * ODDECH_HZ * (Number.isFinite(t) ? t : 0));
    }

    /** Wszystkie węzły - jeden punkt iteracji dla rozgarnij/podpal/testów. */
    *wezly() {
        for (const w of this._wstegi) for (const c of w.wezly) yield c;
    }

    /**
     * Wydech z ust - wywoływać co klatkę, TYLKO gdy dmuchanie.stan === 'DMUCHA'.
     * Węzły tej klatki rodzą się rozłożone wzdłuż odcinka usta(poprzednia
     * klatka) -> usta(teraz), więc ruch głowy ciągnie kreskę (malowanie).
     * Po przerwie zaczyna się NOWA wstęga - kreska nie przeskakuje przez pół
     * ekranu. Prędkość ust NIE jest dziedziczona: dym zostaje tam, gdzie
     * wydmuchany, i dlatego zataczanie okręgów rysuje okrąg.
     *
     * @param {{x,y}} zaczepPx     usta, w PIKSELACH płótna
     * @param {{x,y}} kierunek     jednostkowy - w którą stronę gracz dmucha (dmuchanie.js)
     * @param {number} sila        0..1 - tempo i szerokość kreski
     * @param {number} wyrazistosc 0..1 - jak zdecydowanie gracz celuje; skaluje PRĘDKOŚĆ wylotu
     * @param {number} dt
     * @param {number} W           szerokość płótna (px) - rozmiary i prędkości są jej ułamkami
     */
    emituj(zaczepPx, kierunek, sila, wyrazistosc, dt, W) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        const wyr = Number.isFinite(wyrazistosc) ? Math.max(0, Math.min(1, wyrazistosc)) : 0;
        if (!zaczepPx || !Number.isFinite(zaczepPx.x) || !Number.isFinite(zaczepPx.y) || s <= 0.01 || krok <= 0) return;
        const wRef = Number.isFinite(W) && W > 0 ? W : 1920;

        let kx = Number.isFinite(kierunek?.x) ? kierunek.x : 0;
        let ky = Number.isFinite(kierunek?.y) ? kierunek.y : -1;
        const dl = Math.hypot(kx, ky);
        if (dl < 1e-6) { kx = 0; ky = -1; } else { kx /= dl; ky /= dl; }

        this._emitowal = true;
        this._tEmisji += krok;
        const oddech = Dym.oddech(this._tEmisji);
        const silaCzynnik = 0.7 + 0.3 * s;

        // CO NAJMNIEJ jeden węzeł na klatkę emisji: klatka bez węzła podwaja
        // odstęp wzdłuż lotu i kreska zaczyna ścinać zakręty. Nadwyżka bywa
        // przez to UJEMNA - i dobrze, bo średnie tempo zostaje WEZLY_NA_S
        // także przy 120 Hz.
        const ile = WEZLY_NA_S * silaCzynnik * oddech * krok + this._nadwyzka;
        const n = Math.max(1, Math.floor(ile));
        this._nadwyzka = Math.max(-WEZLY_NA_S * krok, ile - n);

        const od = this._poprzZaczep ?? zaczepPx;
        this._poprzZaczep = { x: zaczepPx.x, y: zaczepPx.y };

        // Prędkość wylotu z WYRAZISTOŚCI ustawienia gracza - patrz nagłówek.
        const vBazowa = wRef * WYLOT_PREDKOSC_W_S
                      * (WYRAZISTOSC_PODLOGA + (1 - WYRAZISTOSC_PODLOGA) * wyr) * oddech;

        for (let i = 0; i < n; i++) {
            const f = (i + 1) / n;
            const ux = od.x + (zaczepPx.x - od.x) * f;
            const uy = od.y + (zaczepPx.y - od.y) * f;

            // ŻADNEGO losowania prędkości ani stożka PER WĘZEŁ: sąsiedzi w
            // kresce muszą lecieć tak samo, inaczej po sekundzie szybszy
            // wyprzedza wolniejszego, kolejność w kresce się odwraca i wstęga
            // zygzakuje. Wariancja jest PER WSTĘGA (szerokość, faza) i z
            // oddechu; "życie" zostaje per węzeł - rozkłada gaśnięcie w czasie.
            const wstega = this._wstegaDoPisania(wRef);
            wstega.wezly.push({
                x: ux + (Math.random() - 0.5) * ROZRZUT_UST_PX,
                y: uy + (Math.random() - 0.5) * ROZRZUT_UST_PX,
                vx: kx * vBazowa,
                vy: ky * vBazowa,
                wiek: 0,
                zycie: ZYCIE_MIN_S + Math.random() * (ZYCIE_MAX_S - ZYCIE_MIN_S),
                faza: wstega.faza,
                szum: 1 + (Math.random() - 0.5) * 2 * SZUM_SZEROKOSCI,
                r: wRef * R_START_W,
                rStart: wRef * R_START_W,
                rCel: wstega.rCel,
                przerwa: wstega.wezly.length === 0,
                stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
                ...warianty()
            });
            this._ile++;
        }
        this._pilnujSufitu();
    }

    /**
     * Wstęga, do której dopisujemy: nowa po przerwie albo po MAX_WEZLOW_WSTEGI.
     * Szerokość docelowa i faza są WŁASNOŚCIĄ WSTĘGI, nie węzła - patrz emituj().
     */
    _wstegaDoPisania(wRef) {
        if (!this._aktywna || this._aktywna.wezly.length >= MAX_WEZLOW_WSTEGI) {
            this._aktywna = {
                id: this._nastepneId++,
                wezly: [],
                przerzedzen: 0,
                faza: Math.random() * Math.PI * 2,
                rCel: wRef * (R_KONIEC_MIN_W + Math.random() * (R_KONIEC_MAX_W - R_KONIEC_MIN_W))
            };
            this._wstegi.push(this._aktywna);
        }
        return this._aktywna;
    }

    /** FIFO: sufit wypycha NAJSTARSZE węzły (od początku najstarszej wstęgi). */
    _pilnujSufitu() {
        while (this._ile > MAX_WEZLOW && this._wstegi.length) {
            const w = this._wstegi[0];
            const zdejmij = Math.min(this._ile - MAX_WEZLOW, w.wezly.length);
            w.wezly.splice(0, zdejmij);
            this._ile -= zdejmij;
            if (w.wezly.length === 0) {
                this._wstegi.shift();
                if (this._aktywna === w) this._aktywna = null;
            } else {
                w.wezly[0].przerwa = true;
            }
        }
    }

    /**
     * Dłonie rozgarniają dym - nadgarstki z prędkością, w PIKSELACH.
     * @param {Array<{x,y,vx,vy}>} nadgarstkiPx
     * @param {number} W  szerokość płótna (px) - promień wpływu jest jej ułamkiem
     */
    rozgarnij(nadgarstkiPx, W) {
        if (!nadgarstkiPx?.length || !Number.isFinite(W) || W <= 0) return;
        const promien = W * ROZGARNIJ_PROMIEN_W;
        for (const c of this.wezly()) {
            if (c.stan === 'WYBUCH') continue;
            for (const d of nadgarstkiPx) {
                if (!Number.isFinite(d?.x) || !Number.isFinite(d?.y)) continue;
                const dist = Math.hypot(c.x - d.x, c.y - d.y);
                if (dist >= promien) continue;
                const wplyw = (1 - dist / promien) * ROZGARNIJ_SILA;
                c.vx += (Number.isFinite(d.vx) ? d.vx : 0) * wplyw;
                c.vy += (Number.isFinite(d.vy) ? d.vy : 0) * wplyw;
            }
        }
    }

    /**
     * Podpal węzły DYM w zasięgu zarzewi. Front (zarażanie sąsiadów) biegnie
     * w _ruszaj() - tu wyłącznie PIERWSZY kontakt z zewnętrznym źródłem ognia.
     *
     * @param {Array<{x,y,r,sila}>} zarzewiaPx  punkty ognia w PIKSELACH (dowolna technika ognia)
     */
    podpal(zarzewiaPx) {
        if (!zarzewiaPx?.length) return;
        for (const c of this.wezly()) {
            if (c.stan !== 'DYM') continue;
            for (const z of zarzewiaPx) {
                if (!Number.isFinite(z?.x) || !Number.isFinite(z?.y)) continue;
                const promienKontaktu = c.r * ZAPLON_KONTAKT_MNOZNIK + (Number.isFinite(z.r) ? z.r : 0);
                if (Math.hypot(c.x - z.x, c.y - z.y) < promienKontaktu) {
                    c.stan = 'ZAPLON';
                    c.tZaplonu = 0;
                    c.rozprzestrzenil = false;
                    break;
                }
            }
        }
    }

    /**
     * Fizyka WSZYSTKICH węzłów - czysta (bez document), jak kolowrot.js
     * _ruszaj(). Zwraca, ile węzłów przeszło w WYBUCH W TEJ KLATCE - main.js
     * tym skaluje wstrząs ekranu i dźwięk.
     */
    _ruszaj(dt, W, H) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        if (krok <= 0) return 0;
        this._t += krok;

        const wRef = Number.isFinite(W) && W > 0 ? W : 1920;
        const hRef = Number.isFinite(H) && H > 0 ? H : 1080;
        const k = 2 * Math.PI / (wRef * POLE_DLUGOSC_FALI_W);
        const A = POLE_AMPLITUDA_W_S2 * wRef;
        let nowychWybuchow = 0;
        let doFrontu = null;   // węzły, które W TEJ KLATCE zarażają sąsiednie wstęgi

        for (const w of this._wstegi) {
            const zywe = [];
            for (let idx = 0; idx < w.wezly.length; idx++) {
                const c = w.wezly[idx];
                c.wiek += krok;

                if (c.stan === 'WYBUCH') {
                    c.tWybuch += krok;
                    if (c.tWybuch >= CZAS_WYBUCHU_S) { this._usun(w, idx); continue; }
                    zywe.push(c);
                    continue;
                }
                if (c.wiek >= c.zycie) { this._usun(w, idx); continue; }

                if (c.stan === 'ZAPLON') {
                    c.tZaplonu += krok;
                    if (!c.rozprzestrzenil && c.tZaplonu >= OPOZNIENIE_FRONTU_S) {
                        c.rozprzestrzenil = true;
                        // Wzdłuż WŁASNEJ wstęgi front idzie zawsze (sąsiedzi w
                        // kresce), na inne wstęgi - przez siatkę, patrz _front().
                        for (const sasiad of [w.wezly[idx - 1], w.wezly[idx + 1]]) {
                            if (sasiad && sasiad.stan === 'DYM') {
                                sasiad.stan = 'ZAPLON';
                                sasiad.tZaplonu = 0;
                                sasiad.rozprzestrzenil = false;
                            }
                        }
                        (doFrontu ??= []).push(c);
                    }
                    if (c.tZaplonu >= CZAS_DO_WYBUCHU_S) {
                        c.stan = 'WYBUCH';
                        c.tWybuch = 0;
                        nowychWybuchow++;
                    }
                }

                // Wylot gaśnie z wiekiem: świeży węzeł to wystrzelona kreska
                // (silny opór), stary - dym w polu przepływu. Wyporność i pole
                // wchodzą DOPIERO z wagą wyporu, żeby dało się malować w dół.
                const wylot = Math.exp(-c.wiek / TAU_WYLOTU_S);
                const wypor = 1 - Math.exp(-c.wiek / TAU_WYPORU_S);
                const wznoszenie = wznoszenieCzynnik(c.y, hRef);
                const celVy = -WZNOSZENIE_H_S * hRef * wznoszenie;
                c.vy += (celVy - c.vy) * Math.min(1, krok * 2) * wypor;

                const ax = A * Math.sin(c.y * k + this._t * POLE_OMEGA_1 + c.faza * 0.3);
                const ay = A * Math.cos(c.x * k * 0.8 + this._t * POLE_OMEGA_2);
                c.vx += ax * krok * wypor;
                c.vy += ay * krok * wypor;
                c.vx += Math.sign(Math.sin(c.faza)) * ROZLEW_BOK_H_S * hRef * (1 - wznoszenie) * wypor * krok;

                // Opór zmieszany wagą wylotu - JEDEN wektor prędkości, więc
                // rozgarnij() i pole ZAWSZE mają opór (machnięcie dłonią nie
                // wstrzykuje prędkości, która nigdy nie gaśnie).
                const oporWsp = OPOR_WYLOTU * wylot + OPOR_DYMU * (1 - wylot);
                const opor = Math.max(0, 1 - oporWsp * krok);
                c.vx *= opor;
                c.vy *= opor;
                c.x += c.vx * krok;
                c.y += c.vy * krok;

                c.r = c.rStart + (c.rCel - c.rStart) * (1 - Math.exp(-c.wiek / ROZROST_TAU_S));

                if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)) zywe.push(c);
                else this._usun(w, idx);
            }
            w.wezly = zywe;
        }

        this._wstegi = this._wstegi.filter(w => {
            if (w.wezly.length) return true;
            if (this._aktywna === w) this._aktywna = null;
            return false;
        });

        if (doFrontu) this._front(doFrontu);
        this._przerzedz();
        return nowychWybuchow;
    }

    /** Węzeł znika -> kreska jest w tym miejscu PRZERWANA (ogień ją przepala). */
    _usun(w, idx) {
        this._ile--;
        const nast = w.wezly[idx + 1];
        if (nast) nast.przerwa = true;
    }

    /**
     * Front między WSTĘGAMI przez siatkę kubełkową - budowaną tylko w klatkach,
     * w których coś się rozprzestrzenia. Bez niej byłoby O(płonących x
     * wszystkich), a węzłów bywa 4000.
     */
    _front(zrodla) {
        let maxR = 0;
        for (const c of this.wezly()) if (c.r > maxR) maxR = c.r;
        const bok = Math.max(1, maxR * 2 * FRONT_PROMIEN_MNOZNIK);
        const siatka = new Map();
        for (const c of this.wezly()) {
            if (c.stan !== 'DYM') continue;
            const klucz = `${Math.floor(c.x / bok)},${Math.floor(c.y / bok)}`;
            let kubelek = siatka.get(klucz);
            if (!kubelek) siatka.set(klucz, kubelek = []);
            kubelek.push(c);
        }
        for (const c of zrodla) {
            const cx = Math.floor(c.x / bok), cy = Math.floor(c.y / bok);
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
                for (let gy = cy - 1; gy <= cy + 1; gy++) {
                    const kubelek = siatka.get(`${gx},${gy}`);
                    if (!kubelek) continue;
                    for (const inny of kubelek) {
                        if (inny.stan !== 'DYM') continue;
                        const promien = (c.r + inny.r) * FRONT_PROMIEN_MNOZNIK;
                        if (Math.hypot(c.x - inny.x, c.y - inny.y) < promien) {
                            inny.stan = 'ZAPLON';
                            inny.tZaplonu = 0;
                            inny.rozprzestrzenil = false;
                        }
                    }
                }
            }
        }
    }

    /**
     * Dojrzała wstęga: kreska jest już dużo szersza niż odstęp węzłów, więc co
     * drugi węzeł nic nie wnosi do KSZTAŁTU, a kosztuje odcinek na klatkę.
     * Pierwszy i ostatni zostają, `przerwa` przechodzi na zachowanego sąsiada.
     */
    _przerzedz() {
        for (const w of this._wstegi) {
            if (w === this._aktywna || w.przerzedzen >= PRZERZEDZ_PO_S.length) continue;
            const najmlodszy = w.wezly[w.wezly.length - 1];
            if (!najmlodszy || najmlodszy.wiek < PRZERZEDZ_PO_S[w.przerzedzen]) continue;
            const zostaw = [];
            for (let i = 0; i < w.wezly.length; i++) {
                const c = w.wezly[i];
                // Płonący węzeł NIGDY nie znika po cichu - front i wybuch mają
                // dobiec do końca (inaczej detonacja gubiłaby co drugą kulę).
                if (i % 2 === 0 || i === w.wezly.length - 1 || c.stan !== 'DYM') zostaw.push(c);
                else if (c.przerwa && w.wezly[i + 1]) w.wezly[i + 1].przerwa = true;
            }
            this._ile -= w.wezly.length - zostaw.length;
            w.wezly = zostaw;
            w.przerzedzen++;
        }
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx  null = tylko fizyka (testy, jak kolowrot.js)
     * @param {number} W  szerokość płótna (px)
     * @param {number} H  wysokość płótna (px)
     * @param {number} dt
     * @returns {number} liczba węzłów, które w tej klatce weszły w WYBUCH
     */
    updateAndDraw(ctx, W, H, dt) {
        // Przerwa w dmuchaniu urywa wstęgę - po powrocie dłoni zaczyna się nowa,
        // zamiast łączyć kreską dwa odległe miejsca.
        if (!this._emitowal) { this._poprzZaczep = null; this._aktywna = null; }
        this._emitowal = false;

        const nowychWybuchow = this._ruszaj(dt, W, H);
        if (ctx) this._rysuj(ctx, W, H);
        return nowychWybuchow;
    }

    /** Płótno pomocnicze 1/3 - leniwe, jak ekran.js:_bloom (testy nie mają document). */
    _plotno(W, H) {
        const bw = Math.max(1, Math.round(W / DZIELNIK_PLOTNA));
        const bh = Math.max(1, Math.round(H / DZIELNIK_PLOTNA));
        if (!this._plotnoPom) {
            this._plotnoPom = document.createElement('canvas');
            this._ctxPom = this._plotnoPom.getContext('2d');
        }
        if (this._plotnoPom.width !== bw || this._plotnoPom.height !== bh) {
            this._plotnoPom.width = bw;
            this._plotnoPom.height = bh;
        }
        return this._ctxPom;
    }

    _rysuj(ctx, W, H) {
        this._odcinkow = 0;
        if (!this._ile) return;
        const wRef = Number.isFinite(W) && W > 0 ? W : ctx.canvas.width;
        const hRef = Number.isFinite(H) && H > 0 ? H : ctx.canvas.height;
        const skala = 1 / DZIELNIK_PLOTNA;

        // --- DYM: kreska na płótnie pomocniczym, potem JEDNO drawImage ---
        const pc = this._plotno(wRef, hRef);
        pc.clearRect(0, 0, this._plotnoPom.width, this._plotnoPom.height);
        pc.lineCap = 'round';
        pc.lineJoin = 'round';

        // Odcinki zbierane w kubełkach (szerokość x alfa): jeden stroke() na
        // kubełek zamiast jednego na odcinek - przy 2000 odcinków to różnica
        // rzędu wielkości w liczbie wywołań rysujących.
        const kubelki = new Map();
        for (const w of this._wstegi) {
            for (let i = 1; i < w.wezly.length; i++) {
                const a = w.wezly[i - 1], b = w.wezly[i];
                if (b.przerwa || a.stan !== 'DYM' || b.stan !== 'DYM') continue;
                const oddech = 1 + ODDECH_SZEROKOSCI * Math.sin(this._t * ODDECH_OMEGA + a.faza);
                const szer = (a.r + b.r) * skala * oddech * (a.szum ?? 1);
                const alfa = obwiedniaAlfy(a.wiek, a.zycie) * alfaOdSzerokosci(a.r, a.rStart, a.rCel)
                           * (1 + MIGOTANIE_ALFY * Math.sin(this._t * MIGOTANIE_OMEGA + a.faza * 2));
                if (alfa <= 0.01 || szer <= 0.2) continue;
                const kszer = Math.max(KWANT_SZEROKOSCI_PX,
                                        Math.round(szer / KWANT_SZEROKOSCI_PX) * KWANT_SZEROKOSCI_PX);
                const kalfa = Math.max(KWANT_ALFY, Math.round(alfa / KWANT_ALFY) * KWANT_ALFY);
                const klucz = kszer * 1000 + Math.round(kalfa * 100);
                let wpis = kubelki.get(klucz);
                if (!wpis) kubelki.set(klucz, wpis = { szer: kszer, alfa: kalfa, p: new Path2D() });
                wpis.p.moveTo(a.x * skala, a.y * skala);
                wpis.p.lineTo(b.x * skala, b.y * skala);
                this._odcinkow++;
            }
        }

        for (const przebieg of PRZEBIEGI) {
            for (const { szer, alfa, p } of kubelki.values()) {
                pc.strokeStyle = `rgba(${BARWA_DYMU}, ${Math.min(1, alfa * przebieg.alfa).toFixed(3)})`;
                pc.lineWidth = szer * przebieg.szerokosc;
                pc.stroke(p);
            }
        }

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Jeden blur na CAŁY dym (nie na sprite): dopiero to odkleja kreskę od
        // "gumowej rurki". Płótno pomocnicze jest 1/3, więc blur jest liczony
        // na 1/9 pikseli pełnego ekranu.
        ctx.filter = `blur(${ROZMYCIE_PX}px)`;
        ctx.drawImage(this._plotnoPom, 0, 0, this._plotnoPom.width, this._plotnoPom.height, 0, 0, wRef, hRef);
        ctx.filter = 'none';

        // --- ZAPLON i WYBUCH: 'lighter', ciepłe, na PEŁNEJ rozdzielczości ---
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        // Płonąca kreska: te same wielokrotne przebiegi co dym (szeroka poświata
        // -> wąski rdzeń), inaczej ogień czyta się jak pomarańczowe rury.
        // Kubełki po STOPNIU barwy i szerokości - stroke'ów są dziesiątki, nie tysiące.
        const ogien = new Map();
        for (const w of this._wstegi) {
            for (let i = 0; i < w.wezly.length; i++) {
                const c = w.wezly[i];
                if (c.stan !== 'ZAPLON') continue;
                const p = Math.max(0, Math.min(1, c.tZaplonu / CZAS_DO_WYBUCHU_S));
                const stopien = Math.min(BARWA_ZAPLONU_STOPNIE.length - 1,
                                          Math.floor(p * BARWA_ZAPLONU_STOPNIE.length));
                const szer = Math.max(KWANT_SZEROKOSCI_PX,
                                       Math.round(c.r * (1 + p * 0.4) / KWANT_SZEROKOSCI_PX) * KWANT_SZEROKOSCI_PX);
                const klucz = stopien * 10000 + szer;
                let wpis = ogien.get(klucz);
                if (!wpis) ogien.set(klucz, wpis = { stopien, szer, p: new Path2D() });
                const poprz = w.wezly[i - 1];
                if (poprz && !c.przerwa) wpis.p.moveTo(poprz.x, poprz.y);
                else wpis.p.moveTo(c.x - 0.01, c.y);
                wpis.p.lineTo(c.x, c.y);
            }
        }
        for (const przebieg of PRZEBIEGI_OGNIA) {
            for (const { stopien, szer, p } of ogien.values()) {
                const [cr, cg, cb] = BARWA_ZAPLONU_STOPNIE[stopien];
                ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${przebieg.alfa})`;
                ctx.lineWidth = szer * przebieg.szerokosc;
                ctx.stroke(p);
            }
        }

        let licznikSprite = 0;
        for (const w of this._wstegi) {
            for (const c of w.wezly) {
                if (c.stan === 'WYBUCH') {
                    // Sprite co SPRITE_CO_ILE-ty wybuchający węzeł - detonacja ma
                    // wyglądać jak dotąd, a nie jak tysiąc nakładek na kresce.
                    if ((licznikSprite++ % SPRITE_CO_ILE) !== 0) continue;
                    const p = Math.max(0, Math.min(1, c.tWybuch / CZAS_WYBUCHU_S));
                    const zanik = 1 - p;
                    const rdzen = obraz(MANIFEST.ogienRdzen[c.wariantOgien]);
                    const plomien = obraz(MANIFEST.plomien[c.wariantPlomien]);
                    const rozblysk = obraz(MANIFEST.rozblyskUderzenia[c.wariantRozblysk]);
                    const skalaOgnia = 0.6 + 0.8 * Math.min(1, p * 4);
                    // Kreska jest cieńsza niż kłąb v3 - podłoga promienia, żeby
                    // kula ognia została kulą ognia, a nie iskierką.
                    const r = Math.max(c.r * 2, wRef * 0.035) * (0.7 + 0.3 * skalaOgnia);

                    if (rozblysk && p < 0.35) {
                        const sprite = wypalTintowany(rozblysk, BARWA_ROZBLYSKU, 320);
                        ctx.globalAlpha = Math.max(0, (1 - p / 0.35)) * 0.9;
                        ctx.drawImage(sprite, c.x - r * 1.3, c.y - r * 1.3, r * 2.6, r * 2.6);
                    }
                    if (plomien) {
                        const sprite = wypalTintowany(plomien, BARWA_ZAPLONU_STOPNIE[3], 220);
                        ctx.globalAlpha = Math.max(0, zanik * zanik);
                        ctx.drawImage(sprite, c.x - r, c.y - r, r * 2, r * 2);
                    }
                    if (rdzen) {
                        const sprite = wypalTintowany(rdzen, BARWA_RDZENIA, 160);
                        ctx.globalAlpha = Math.max(0, zanik);
                        const rr = r * 0.6;
                        ctx.drawImage(sprite, c.x - rr, c.y - rr, rr * 2, rr * 2);
                    }
                    ctx.globalAlpha = 1;
                }
            }
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

/**
 * Czynnik wznoszenia SUFIT_MIN_CZYNNIK..1 wg pozycji Y (px). 1 daleko od
 * sufitu, opada do minimum blisko górnej krawędzi - NIGDY do zera, żeby dym
 * pod sufitem dalej lekko "mrowił", zamiast zamarznąć w miejscu.
 */
export function wznoszenieCzynnik(y, H) {
    const sufit = H * SUFIT_Y_H, start = H * SPADEK_OD_Y_H;
    if (y >= start) return 1;
    if (y <= sufit) return SUFIT_MIN_CZYNNIK;
    const t = (y - sufit) / (start - sufit);
    return SUFIT_MIN_CZYNNIK + (1 - SUFIT_MIN_CZYNNIK) * t;
}

/**
 * Obwiednia alfy węzła: narost ABSOLUTNY w sekundach (NAROST_S), pełna
 * jasność aż do ZANIK_OD, potem opada do zera na końcu życia. Zanik BLISKO
 * KOŃCA, nie od połowy - stąd DWA ARGUMENTY, nie jeden ułamek: przy życiu
 * ponad 100 s ułamek dawałby atak liczony w dziesiątkach sekund.
 *
 * @param {number} wiek   wiek węzła w sekundach
 * @param {number} zycie  całkowite życie węzła w sekundach
 */
export function obwiedniaAlfy(wiek, zycie) {
    const z = Number.isFinite(zycie) && zycie > 0 ? zycie : 1;
    const w = Number.isFinite(wiek) ? Math.max(0, wiek) : 0;
    const t = Math.min(1, w / z);
    const narost = Math.sin(Math.min(1, w / NAROST_S) * Math.PI * 0.5);
    const zanik = t > ZANIK_OD ? Math.max(0, 1 - (t - ZANIK_OD) / (1 - ZANIK_OD)) : 1;
    return narost * zanik;
}

/**
 * Alfa cienieje z szerokością kreski (zachowanie "masy"): świeża, wąska
 * kreska jest gęsta, rozdęta w mgłę - rzadka. NIGDY poniżej ALFA_KONIEC;
 * zanik końcowy to osobno obwiedniaAlfy.
 */
export function alfaOdSzerokosci(r, rStart, rCel) {
    const zakres = rCel - rStart;
    if (!Number.isFinite(zakres) || zakres <= 1e-6) return ALFA_START;
    const p = Math.max(0, Math.min(1, ((Number.isFinite(r) ? r : rStart) - rStart) / zakres));
    return ALFA_START + (ALFA_KONIEC - ALFA_START) * p;
}

function warianty() {
    return {
        wariantPlomien: losowyIndeks(MANIFEST.plomien),
        wariantOgien: losowyIndeks(MANIFEST.ogienRdzen),
        wariantRozblysk: losowyIndeks(MANIFEST.rozblyskUderzenia)
    };
}

function losowyIndeks(tablica) {
    return Array.isArray(tablica) && tablica.length ? Math.floor(Math.random() * tablica.length) : 0;
}
