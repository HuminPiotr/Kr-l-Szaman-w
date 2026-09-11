/**
 * Dym Okadzenia - cząstki na silniku smoke.js, fizyka gry, front ognia.
 *
 * Nie wie nic o pieczęciach, kombosach ani mocy - dostaje pozycję/kierunek/
 * siłę/wyrazistość z js/dmuchanie.js i punkty zarzewia z main.js (dziś:
 * Płonący Palec, jutro: dowolna inna technika ognia - patrz podpal()). Ten sam
 * podział odpowiedzialności co ogien.js/plonacyPalec.js.
 *
 * ================== V7 (2026-09-11): SILNIK smoke.js ==================
 * Sześć podejść (v2-v6: sprite'y, dwie populacje, wstęga rysowana kreską,
 * kółka) i za każdym razem "efekt mnie nie zachwyca". Właściciel gry wskazał
 * gotową bibliotekę: smoke.js (MIT, 5.5 KB, bez zależności) - i ma rację, bo
 * cały jej urok siedzi w liczbach, których ANI RAZU nie wypróbowałem:
 *
 *   alfa cząstki   smoke.js: max 0.125   moje v2-v6: 0.30-0.55
 *   rozmiar        sprite 20 px x skala 25-30 = 500-600 px   |   70-290 px
 *   wzrost         sqrt(wiek/życie) - gwałtowny na starcie   |   1-exp(-t/tau)
 *   życie          2-8 s                                     |   100-260 s
 *   tekstura       jeden ręcznie zrobiony, SZUMIĄCY sprite 20x20
 *
 * Czyli: OGROMNE, LEDWO WIDOCZNE kłęby, których dużo się nakłada. Moje wersje
 * były za małe, za gęste i za długowieczne - stąd "plastikowość".
 *
 * Podział pracy (biblioteka jest KOPIĄ 1:1, patrz js/vendor/smoke.js):
 *   smoke.js  - sprite, cykl życia cząstki (wzrost sqrt, alfa w szpic),
 *               rysowanie, zarządzanie tablicą cząstek;
 *   ten plik  - wszystko, co jest GRĄ: kierunek i siła wydechu (addsmoke
 *               przyjmuje minVx/maxVx/minVy/maxVy per wywołanie), opór,
 *               wyporność słabnąca pod sufitem, REAKCJA NA RĘCE I TANIEC,
 *               stany ognia (ZAPLON/WYBUCH), front, detonacja, sufit cząstek.
 * Wpięcie idzie przez publiczne API: setPreDrawCallback(dt, czastki) daje
 * tablicę cząstek co klatkę - tam dopisuję własne pola i własną fizykę.
 *
 * ================== DLACZEGO WŁASNE PŁÓTNO ==================
 * Biblioteka robi clearRect na CAŁYM swoim kontekście, więc nie może dostać
 * płótna gry. Dostaje własne, w połowie rozdzielczości (wzorzec ekran.js:
 * _bloom), a my składamy je jednym drawImage - skalowanie 2x samo wygładza,
 * a fill-rate spada czterokrotnie.
 *
 * ================== TRZY STANY CZĄSTKI ==================
 *   DYM     - płynie, rośnie, dłonie mogą ją rozgarniać (rozgarnij()).
 *   ZAPLON  - podpalona (podpal()); po krótkim opóźnieniu zaraża sąsiadki
 *             w zasięgu (front kłąb po kłębie), potem wybucha.
 *   WYBUCH  - kula ognia, krótko, potem cząstka znika NA ZAWSZE.
 * Dym rysuje biblioteka (source-over), ogień rysujemy sami na płótnie gry
 * w trybie 'lighter' - reszta gry rysuje WYŁĄCZNIE addytywnie, a szary dym
 * w tym trybie zniknąłby (ta sama pułapka co w efekty.js:206-216).
 */
import { MANIFEST, obraz, wypalTintowany } from './assety.js';
import smokemachine from './vendor/smoke.js';

// --- Emisja (jednostki biblioteki: px na MILISEKUNDĘ) ---
// ZGADNIĘTE - do strojenia na kamerze. Tempo jest duże, bo alfa cząstki to
// 0.125: gęstość dymu robi LICZBA nakładających się kłębów, nie krycie.
export const CZASTEK_NA_S = 45;
// Początkowa siła kierunku: ułamek szerokości płótna na sekundę. Stożek jest
// wąski - to ma być wydech w konkretną stronę, nie wachlarz.
export const WYLOT_W_S = 0.55;
export const WYRAZISTOSC_PODLOGA = 0.35;   // poza nijaka nadal coś wypuszcza
const STOZEK_RAD = 0.14;                   // ±8°
const ROZRZUT_UST_W = 0.008;

// --- Życie i rozmiar ---
// 20-40 s: kompromis (życzenie) między naturalnym rozwiewaniem smoke.js (2-8 s)
// a dawnym okadzaniem ekranu na minuty - gracz ma zdążyć złożyć combo ognia.
export const ZYCIE_MIN_S = 20, ZYCIE_MAX_S = 40;
// Skala liczona względem sprite'a 20 px: 9-15 x sqrt(0.5) daje na plateau kłąb
// ~130-210 px promienia na płótnie gry. WIĘCEJ MNIEJSZYCH kłębów czyta się jak
// dym; kilka wielkich - jak mleko.
const SKALA_MIN = 9, SKALA_MAX = 15;
const SKALA_STARTOWA = 0.5;

// --- Obwiednia: STEROWANIE CZASEM BIBLIOTEKI ---
// smoke.js liczy i alfę, i skalę z `age/lifetime`: alfa to trójkąt ze szczytem
// w połowie życia, skala rośnie jak sqrt. Przy życiu 20-40 s dawałoby to dym
// prawie niewidoczny przez pierwsze kilkanaście sekund (alfa 0.008 po sekundzie
// - zmierzone). Zamiast przerabiać bibliotekę, STERUJEMY JEJ CZASEM: `lifetime`
// zostaje krótki i stały, a `age` wyliczamy z prawdziwego wieku cząstki tak,
// żeby szybko dojść do szczytu (NAROST_S), trzymać się go przez większość życia
// i zejść na końcu (ZANIK_S). Biblioteka usuwa cząstkę dokładnie wtedy, gdy
// kończy się nasze życie - bo wtedy age dobija do lifetime.
const ZYCIE_BIBLIOTEKI_MS = 6000;
export const NAROST_S = 0.8;
export const ZANIK_S = 3;

// --- Sufit cząstek (biblioteka nie ogranicza niczego) ---
export const MAX_CZASTEK = 700;

// --- Fizyka dokładana w setPreDrawCallback ---
const OPOR = 0.9;                        // 1/s - smoke.js hamuje tylko vy, i to nie do końca
const WZNOSZENIE_W_S = 0.022;             // ułamek SZEROKOŚCI płótna na sekundę
export const SUFIT_Y_H = 0.12;           // górna granica - tu wznoszenie prawie zanika
export const SPADEK_OD_Y_H = 0.55;       // poniżej tego Y (w dół ekranu) pełne wznoszenie
const SUFIT_MIN_CZYNNIK = 0.12;          // NIGDY do zera - lekkie mrowienie zostaje
const TAU_WYPORU_S = 2.5;                // wyporność wchodzi z opóźnieniem: da się dmuchnąć W DÓŁ
const POLE_AMPLITUDA_W_S2 = 0.004;       // pole przepływu - spójne wiry, nie per-cząstka szum
const POLE_DLUGOSC_FALI_W = 0.35;
const POLE_OMEGA_1 = 0.35, POLE_OMEGA_2 = 0.27;

// --- Reakcja na ręce i taniec (życzenie: "dym reaguje na ręce") ---
export const ROZGARNIJ_PROMIEN_W = 0.12;
// STROJONE na renderach: przy 0.65/0.55 machnięcie ręką wywiewało CAŁY obłok
// poza ekran (dłoń jedzie 1500-2000 px/s, a opór to tylko 0.9/s). Dym ma się
// rozstąpić i zawirować, nie odlecieć.
const ROZGARNIJ_SILA = 0.15;             // ile prędkości dłoni przechodzi na cząstkę
const WIR_SILA = 0.22;                   // składowa STYCZNA - za ręką zostaje wir
const ROZGARNIJ_MAX_V = 4000;            // px/s - zasłonięta dłoń potrafi "skoczyć"

// --- Zapłon, front, detonacja (bez zmian od v5/v6 - tę część właściciel lubi) ---
const ZAPLON_KONTAKT_MNOZNIK = 0.55;     // promień kontaktu = promień kłębu * to (kłąb bywa 300 px)
const FRONT_PROMIEN_MNOZNIK = 0.45;      // zarażanie sąsiadek
export const OPOZNIENIE_FRONTU_S = 0.25;
export const CZAS_DO_WYBUCHU_S = 0.35;
export const CZAS_WYBUCHU_S = 0.4;
export const SPRITE_CO_ILE = 4;
export const MAX_SPRITE_WYBUCHU = 110;   // sufit kul ognia na klatkę - inaczej detonacja wybiela ekran
const R_WYBUCHU_MIN_W = 0.035, R_WYBUCHU_MAX_W = 0.07;

// --- Rysowanie ---
const DZIELNIK_PLOTNA = 2;               // płótno biblioteki w połowie rozdzielczości
const KLAB_SPRITE_PX = 128;
const BARWA_DYMU = [205, 205, 214];      // jasna, chłodna szarość
const BARWA_ZAPLONU_STOPNIE = [
    [130, 100, 75],
    [225, 155, 75],
    [255, 150, 50],
    [255, 95, 25],
    [205, 35, 10]
];
const BARWA_RDZENIA = [255, 238, 200];
const BARWA_ROZBLYSKU = [255, 225, 170];

export class Dym {
    constructor() {
        this._maszyna = null;        // smokemachine - tworzona leniwie (potrzebuje płótna)
        this._czastki = [];          // referencja do tablicy biblioteki (z setPreDrawCallback)
        this._plotno = null;
        this._ctxPom = null;
        this._W = 0; this._H = 0;
        this._nadwyzka = 0;          // ułamki cząstek przeniesione na następną klatkę
        this._t = 0;                 // zegar pola przepływu
        this._dlonie = [];           // nadgarstki i łokcie z prędkościami (rozgarnij)
        this._nowychWybuchow = 0;    // liczone w callbacku, zwracane z updateAndDraw
        this._wybuchajacych = 0;
    }

    get liczba() { return this._czastki.length; }
    get plonacych() {
        let n = 0;
        for (const c of this._czastki) if (c.stan === 'ZAPLON') n++;
        return n;
    }

    /**
     * Wydech z ust - wywoływać co klatkę, gdy dmuchanie.stan === 'DMUCHA'.
     * Kierunek i POCZĄTKOWA SIŁA idą do biblioteki jako zakresy prędkości
     * (addsmoke przyjmuje min/maxVx i min/maxVy per wywołanie), więc dym
     * wychodzi ciągiem w stronę, w którą gracz jest zwrócony.
     *
     * @param {{x,y}} zaczepPx     usta, w PIKSELACH płótna GRY
     * @param {{x,y}} kierunek     jednostkowy (dmuchanie.js)
     * @param {number} sila        0..1 - ile cząstek na sekundę
     * @param {number} wyrazistosc 0..1 - jak zdecydowanie gracz celuje; skaluje siłę wylotu
     * @param {number} dt
     * @param {number} W           szerokość płótna gry (px)
     * @param {number} H           wysokość płótna gry (px)
     */
    emituj(zaczepPx, kierunek, sila, wyrazistosc, dt, W, H) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        const wyr = Number.isFinite(wyrazistosc) ? Math.max(0, Math.min(1, wyrazistosc)) : 0;
        if (!zaczepPx || !Number.isFinite(zaczepPx.x) || !Number.isFinite(zaczepPx.y)
            || s <= 0.01 || krok <= 0) return;

        const maszyna = this._maszynaDla(W, H);
        if (!maszyna) return;
        const skala = 1 / DZIELNIK_PLOTNA;
        const wRef = this._W;

        const ile = CZASTEK_NA_S * (0.5 + 0.5 * s) * krok + this._nadwyzka;
        const n = Math.floor(ile);
        this._nadwyzka = ile - n;
        if (n <= 0) return;

        const { kx, ky } = kierunekJednostkowy(kierunek);
        // px na MILISEKUNDĘ - jednostki smoke.js. Prędkość liczona na płótnie
        // biblioteki (połowa rozdzielczości), stąd `skala`.
        const v = wRef * WYLOT_W_S * skala / 1000
                * (WYRAZISTOSC_PODLOGA + (1 - WYRAZISTOSC_PODLOGA) * wyr);
        const bokX = -ky * Math.tan(STOZEK_RAD) * v, bokY = kx * Math.tan(STOZEK_RAD) * v;
        const rozrzut = wRef * ROZRZUT_UST_W * skala;

        // UWAGA: minScale/maxScale przekazane do biblioteki ustawiają NARAZ
        // skalę startową i docelową (patrz createParticle w vendor/smoke.js),
        // czyli kłąb rodziłby się od razu wielki. Docelową skalę ustawiamy
        // więc sami, po dodaniu - wtedy zostaje wzrost sqrt(wiek/życie).
        maszyna.addsmoke(zaczepPx.x * skala, zaczepPx.y * skala, n, {
            minVx: kx * v - Math.abs(bokX) - 1e-6, maxVx: kx * v + Math.abs(bokX) + 1e-6,
            minVy: ky * v - Math.abs(bokY) - 1e-6, maxVy: ky * v + Math.abs(bokY) + 1e-6,
            minLifetime: ZYCIE_BIBLIOTEKI_MS, maxLifetime: ZYCIE_BIBLIOTEKI_MS
        });

        for (let i = Math.max(0, this._czastki.length - n); i < this._czastki.length; i++) {
            this._przygotuj(this._czastki[i], rozrzut);
        }
        this._pilnujSufitu();
    }

    /**
     * Pola GRY dokładane świeżej cząstce biblioteki. Prędkość przejmujemy na
     * własne pola (`vxGry/vyGry`), bo updateParticle() w smoke.js NADPISUJE
     * `vy` co klatkę z `startvy` - nasza wyporność i rozgarnianie inaczej
     * znikałyby w tej samej klatce, w której je dodaliśmy.
     */
    _przygotuj(c, rozrzut = 0) {
        if (!c) return;
        c.x += (Math.random() - 0.5) * rozrzut;
        c.y += (Math.random() - 0.5) * rozrzut;
        c.scale = SKALA_STARTOWA;
        c.finalScale = SKALA_MIN + Math.random() * (SKALA_MAX - SKALA_MIN);
        c.vxGry = c.vx;
        c.vyGry = c.startvy;
        c.startvy = 0;               // biblioteka przestaje mieszać w vy
        c.wiekGry = 0;
        c.zycieGry = ZYCIE_MIN_S + Math.random() * (ZYCIE_MAX_S - ZYCIE_MIN_S);
        c.age = 0;
        c.stan = 'DYM';
        c.tZaplonu = 0;
        c.tWybuch = 0;
        c.rozprzestrzenil = false;
        c.faza = Math.random() * Math.PI * 2;
        Object.assign(c, warianty());
    }

    /**
     * Dłonie i łokcie rozgarniają dym - w PIKSELACH płótna GRY, z prędkością.
     * Oprócz pchnięcia wzdłuż ruchu cząstka dostaje składową STYCZNĄ, więc za
     * przelatującą ręką zostaje wir (życzenie: "dym reaguje na ręce i taniec").
     *
     * @param {Array<{x,y,vx,vy}>} punktyPx
     */
    rozgarnij(punktyPx) {
        this._dlonie = Array.isArray(punktyPx) ? punktyPx.filter(
            d => d && Number.isFinite(d.x) && Number.isFinite(d.y)) : [];
    }

    /**
     * Podpal cząstki DYM w zasięgu zarzewi. Front (zarażanie sąsiadek) biegnie
     * w fizyce - tu wyłącznie PIERWSZY kontakt z zewnętrznym źródłem ognia.
     *
     * @param {Array<{x,y,r}>} zarzewiaPx  punkty ognia w PIKSELACH płótna GRY
     */
    podpal(zarzewiaPx) {
        if (!zarzewiaPx?.length || !this._czastki.length) return;
        const skala = 1 / DZIELNIK_PLOTNA;
        for (const c of this._czastki) {
            if (c.stan !== 'DYM') continue;
            const promien = promienCzastki(c) * ZAPLON_KONTAKT_MNOZNIK;
            for (const z of zarzewiaPx) {
                if (!Number.isFinite(z?.x) || !Number.isFinite(z?.y)) continue;
                const kontakt = promien + (Number.isFinite(z.r) ? z.r : 0) * skala;
                if (Math.hypot(c.x - z.x * skala, c.y - z.y * skala) < kontakt) {
                    c.stan = 'ZAPLON';
                    c.tZaplonu = 0;
                    c.rozprzestrzenil = false;
                    break;
                }
            }
        }
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx  null = tylko fizyka (testy)
     * @param {number} W  szerokość płótna gry (px)
     * @param {number} H  wysokość płótna gry (px)
     * @param {number} dt
     * @returns {number} liczba cząstek, które w tej klatce weszły w WYBUCH
     */
    updateAndDraw(ctx, W, H, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        const maszyna = this._maszynaDla(W, H);
        if (!maszyna || krok <= 0) return 0;

        this._nowychWybuchow = 0;
        // step() aktualizuje i RYSUJE na płótnie biblioteki; nasza fizyka
        // wpina się w środku, przez setPreDrawCallback (patrz konstruktor).
        maszyna.step(krok * 1000);
        this._dlonie = [];

        if (ctx && this._plotno) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(this._plotno, 0, 0, this._plotno.width, this._plotno.height,
                           0, 0, this._W, this._H);
            this._rysujOgien(ctx);
            ctx.restore();
        }
        return this._nowychWybuchow;
    }

    /** Leniwa budowa płótna i maszyny - jak ekran.js:_bloom (testy dostają atrapę). */
    _maszynaDla(W, H) {
        const wRef = Number.isFinite(W) && W > 0 ? W : this._W || 1920;
        const hRef = Number.isFinite(H) && H > 0 ? H : this._H || 1080;
        if (this._maszyna && this._W === wRef && this._H === hRef) return this._maszyna;

        this._W = wRef;
        this._H = hRef;
        const bw = Math.max(1, Math.round(wRef / DZIELNIK_PLOTNA));
        const bh = Math.max(1, Math.round(hRef / DZIELNIK_PLOTNA));
        if (typeof document === 'undefined') return this._maszyna;   // brak DOM: nic nie zbudujemy

        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._ctxPom = this._plotno.getContext('2d');
        }
        this._plotno.width = bw;
        this._plotno.height = bh;

        if (!this._maszyna) {
            this._maszyna = smokemachine(this._ctxPom, BARWA_DYMU);
            this._maszyna.setPreDrawCallback((dtMs, czastki) => {
                this._czastki = czastki;
                this._fizyka(Math.max(0, Math.min(50, dtMs)) / 1000);
            });
            // Jeden pusty krok, żeby od razu mieć referencję do tablicy cząstek
            // biblioteki (emituj() dopisuje pola świeżym cząstkom zaraz po
            // addsmoke, więc nie może czekać na pierwszą klatkę rysowania).
            this._maszyna.step(1);
        }
        return this._maszyna;
    }

    /**
     * Cała fizyka GRY, dokładana do cząstek biblioteki: opór, wyporność
     * słabnąca pod sufitem, pole przepływu, reakcja na ręce, ogień.
     * Wołana przez setPreDrawCallback, czyli PO update biblioteki, a PRZED
     * rysowaniem - zmiany widać w tej samej klatce.
     */
    _fizyka(dt) {
        const czastki = this._czastki;
        if (!czastki.length || dt <= 0) return;
        this._t += dt;

        const wRef = this._W / DZIELNIK_PLOTNA;      // wymiary PŁÓTNA BIBLIOTEKI
        const hRef = this._H / DZIELNIK_PLOTNA;
        const k = 2 * Math.PI / (wRef * POLE_DLUGOSC_FALI_W);
        const A = POLE_AMPLITUDA_W_S2 * wRef / 1e6;  // px/ms² (jednostki biblioteki)
        const opor = Math.max(0, 1 - OPOR * dt);
        const promienDloni = wRef * ROZGARNIJ_PROMIEN_W;
        const skalaDloni = 1 / DZIELNIK_PLOTNA;

        let plonace = null;
        let wybuchajacych = 0;

        for (const c of czastki) {
            if (c.stan === undefined) this._przygotuj(c);   // cząstka spoza emituj() (nie powinno się zdarzyć)

            if (c.stan === 'WYBUCH') {
                c.tWybuch += dt;
                wybuchajacych++;
                if (c.tWybuch >= CZAS_WYBUCHU_S) { c.age = c.lifetime + 1; }   // biblioteka ją usunie
                continue;
            }
            if (c.stan === 'ZAPLON') {
                c.tZaplonu += dt;
                if (!c.rozprzestrzenil && c.tZaplonu >= OPOZNIENIE_FRONTU_S) {
                    c.rozprzestrzenil = true;
                    (plonace ??= []).push(c);
                }
                if (c.tZaplonu >= CZAS_DO_WYBUCHU_S) {
                    c.stan = 'WYBUCH';
                    c.tWybuch = 0;
                    this._nowychWybuchow++;
                }
            }

            // Sterowanie czasem biblioteki (patrz stała ZYCIE_BIBLIOTEKI_MS).
            c.wiekGry = (c.wiekGry ?? 0) + dt;
            c.age = wiekBiblioteki(c.wiekGry, c.zycieGry ?? ZYCIE_MIN_S, c.lifetime);

            // smoke.js hamuje TYLKO vy i tylko przez obwiednię wieku - kierunkowy
            // wydech bez oporu na vx leciałby przez ekran bez końca.
            c.vxGry *= opor;
            c.vyGry *= opor;

            // Wyporność z opóźnieniem (TAU_WYPORU_S): dym wypuszczony w DÓŁ
            // naprawdę leci w dół, zanim zacznie się unosić.
            const wiekS = c.wiekGry;
            const wypor = 1 - Math.exp(-wiekS / TAU_WYPORU_S);
            const wznoszenie = wznoszenieCzynnik(c.y, hRef);
            c.vyGry -= WZNOSZENIE_W_S * wRef / 1000 * wznoszenie * wypor * dt;

            const faza = Number.isFinite(c.faza) ? c.faza : 0;
            c.vxGry += A * Math.sin(c.y * k + this._t * POLE_OMEGA_1 + faza) * dt * 1000 * wypor;
            c.vyGry += A * Math.cos(c.x * k * 0.8 + this._t * POLE_OMEGA_2 + faza * 0.5) * dt * 1000 * wypor;

            // --- Reakcja na ręce i taniec ---
            for (const d of this._dlonie) {
                const dx = c.x - d.x * skalaDloni, dy = c.y - d.y * skalaDloni;
                const dist = Math.hypot(dx, dy);
                if (dist >= promienDloni) continue;
                const wplyw = (1 - dist / promienDloni);
                const vx = ograniczV(d.vx) * skalaDloni / 1000;
                const vy = ograniczV(d.vy) * skalaDloni / 1000;
                c.vxGry += vx * wplyw * ROZGARNIJ_SILA;
                c.vyGry += vy * wplyw * ROZGARNIJ_SILA;
                // Składowa STYCZNA (prostopadła do ruchu ręki, znak z tego, po
                // której stronie toru leży cząstka) - za ręką zostaje wir.
                const strona = Math.sign(vx * dy - vy * dx) || 1;
                c.vxGry += -vy * strona * wplyw * WIR_SILA;
                c.vyGry += vx * strona * wplyw * WIR_SILA;
            }

            if (!Number.isFinite(c.x) || !Number.isFinite(c.y)
                || !Number.isFinite(c.vxGry) || !Number.isFinite(c.vyGry)) {
                c.x = 0; c.y = 0; c.vxGry = 0; c.vyGry = 0;
                c.age = c.lifetime + 1;   // biblioteka usunie zepsutą cząstkę
            }

            // Nasze prędkości są ŹRÓDŁEM PRAWDY - biblioteka całkuje pozycję
            // z c.vx/c.vy w następnej klatce.
            c.vx = c.vxGry;
            c.vy = c.vyGry;
        }

        this._wybuchajacych = wybuchajacych;
        if (plonace) this._front(plonace);
    }

    /**
     * Front ognia przez siatkę kubełkową - budowaną tylko w klatkach, w których
     * coś się rozprzestrzenia. Bez niej byłoby O(płonących x wszystkich).
     */
    _front(zrodla) {
        let maxR = 0;
        for (const c of this._czastki) {
            const r = promienCzastki(c);
            if (r > maxR) maxR = r;
        }
        const bok = Math.max(1, maxR * 2 * FRONT_PROMIEN_MNOZNIK);
        const siatka = new Map();
        for (const c of this._czastki) {
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
                        const zasieg = (promienCzastki(c) + promienCzastki(inny)) * FRONT_PROMIEN_MNOZNIK;
                        if (Math.hypot(c.x - inny.x, c.y - inny.y) < zasieg) {
                            inny.stan = 'ZAPLON';
                            inny.tZaplonu = 0;
                            inny.rozprzestrzenil = false;
                        }
                    }
                }
            }
        }
    }

    /** Sufit: biblioteka nie ogranicza niczego, a 500-pikselowe kłęby kosztują. */
    _pilnujSufitu() {
        const nadmiar = this._czastki.length - MAX_CZASTEK;
        if (nadmiar > 0) this._czastki.splice(0, nadmiar);   // najstarsze są na początku
    }

    /**
     * Ogień na płótnie GRY, w trybie 'lighter' - dym zostaje w bibliotece,
     * bo szara chmura w trybie addytywnym zniknęłaby (nagłówek).
     */
    _rysujOgien(ctx) {
        if (!this._czastki.length) return;
        const wRef = this._W;
        const mnoznik = DZIELNIK_PLOTNA;   // z płótna biblioteki na płótno gry
        ctx.globalCompositeOperation = 'lighter';

        // Płonące: ta sama tekstura mgły, tyle że w ciepłym tincie.
        for (const c of this._czastki) {
            if (c.stan !== 'ZAPLON') continue;
            const p = Math.max(0, Math.min(1, c.tZaplonu / CZAS_DO_WYBUCHU_S));
            const stopien = Math.min(BARWA_ZAPLONU_STOPNIE.length - 1,
                                      Math.floor(p * BARWA_ZAPLONU_STOPNIE.length));
            const img = obraz(MANIFEST.mgla[c.wariantMgla ?? 0]);
            if (!img) continue;
            const r = promienCzastki(c) * mnoznik * 0.8;
            ctx.globalAlpha = Math.min(1, 0.25 + 0.35 * p);
            ctx.drawImage(wypalTintowany(img, BARWA_ZAPLONU_STOPNIE[stopien], KLAB_SPRITE_PX),
                           c.x * mnoznik - r, c.y * mnoznik - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;

        // Wybuchy: kule ognia Kenney, co SPRITE_CO_ILE-ta cząstka, z sufitem -
        // przy detonacji całej chmury inaczej wybiela ekran.
        const krok = Math.max(SPRITE_CO_ILE, Math.ceil(this._wybuchajacych / MAX_SPRITE_WYBUCHU));
        let licznik = 0;
        for (const c of this._czastki) {
            if (c.stan !== 'WYBUCH') continue;
            if ((licznik++ % krok) !== 0) continue;
            const p = Math.max(0, Math.min(1, c.tWybuch / CZAS_WYBUCHU_S));
            const zanik = 1 - p;
            const rdzen = obraz(MANIFEST.ogienRdzen[c.wariantOgien ?? 0]);
            const plomien = obraz(MANIFEST.plomien[c.wariantPlomien ?? 0]);
            const rozblysk = obraz(MANIFEST.rozblyskUderzenia[c.wariantRozblysk ?? 0]);
            const skalaOgnia = 0.6 + 0.8 * Math.min(1, p * 4);
            const r = Math.min(wRef * R_WYBUCHU_MAX_W,
                                Math.max(wRef * R_WYBUCHU_MIN_W, promienCzastki(c) * mnoznik * 0.5))
                    * (0.7 + 0.3 * skalaOgnia);
            const x = c.x * mnoznik, y = c.y * mnoznik;

            if (rozblysk && p < 0.35) {
                ctx.globalAlpha = Math.max(0, (1 - p / 0.35)) * 0.9;
                ctx.drawImage(wypalTintowany(rozblysk, BARWA_ROZBLYSKU, 320),
                               x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
            }
            if (plomien) {
                ctx.globalAlpha = Math.max(0, zanik * zanik);
                ctx.drawImage(wypalTintowany(plomien, BARWA_ZAPLONU_STOPNIE[3], 220),
                               x - r, y - r, r * 2, r * 2);
            }
            if (rdzen) {
                ctx.globalAlpha = Math.max(0, zanik);
                const rr = r * 0.6;
                ctx.drawImage(wypalTintowany(rdzen, BARWA_RDZENIA, 160), x - rr, y - rr, rr * 2, rr * 2);
            }
        }
        ctx.globalAlpha = 1;
    }
}

/**
 * Wiek podawany bibliotece: 0 -> szczyt (połowa jej `lifetime`) w NAROST_S,
 * plateau przez większość życia, zejście do `lifetime` przez ostatnie ZANIK_S.
 * Czysta funkcja - testowalna bez cząstek.
 *
 * @param {number} wiekGry   prawdziwy wiek cząstki (s)
 * @param {number} zycieGry  prawdziwe życie cząstki (s)
 * @param {number} lifetime  `lifetime` cząstki w bibliotece (ms)
 */
export function wiekBiblioteki(wiekGry, zycieGry, lifetime) {
    const L = Number.isFinite(lifetime) && lifetime > 0 ? lifetime : ZYCIE_BIBLIOTEKI_MS;
    const zycie = Number.isFinite(zycieGry) && zycieGry > 0 ? zycieGry : ZYCIE_MIN_S;
    const w = Number.isFinite(wiekGry) ? Math.max(0, wiekGry) : 0;
    if (w >= zycie) return L;
    if (w <= NAROST_S) return L * 0.5 * (w / NAROST_S);
    const doKonca = zycie - w;
    if (doKonca <= ZANIK_S) return L * (1 - 0.5 * doKonca / ZANIK_S);
    return L * 0.5;
}

/** Promień cząstki biblioteki (jej `scale` jest w jednostkach sprite'a 20 px). */
export function promienCzastki(c) {
    return (Number.isFinite(c?.scale) ? c.scale : 0) * 20 / 2;
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

/** Kierunek jednostkowy z fallbackiem "w górę". */
function kierunekJednostkowy(kierunek) {
    let kx = Number.isFinite(kierunek?.x) ? kierunek.x : 0;
    let ky = Number.isFinite(kierunek?.y) ? kierunek.y : -1;
    const dl = Math.hypot(kx, ky);
    if (dl < 1e-6) return { kx: 0, ky: -1 };
    return { kx: kx / dl, ky: ky / dl };
}

/** Prędkość dłoni bywa skokowa przy zgubionym landmarku - ucinamy szarpnięcia. */
function ograniczV(v) {
    if (!Number.isFinite(v)) return 0;
    return Math.max(-ROZGARNIJ_MAX_V, Math.min(ROZGARNIJ_MAX_V, v));
}

function warianty() {
    return {
        wariantMgla: losowyIndeks(MANIFEST.mgla),
        wariantPlomien: losowyIndeks(MANIFEST.plomien),
        wariantOgien: losowyIndeks(MANIFEST.ogienRdzen),
        wariantRozblysk: losowyIndeks(MANIFEST.rozblyskUderzenia)
    };
}

function losowyIndeks(tablica) {
    return Array.isArray(tablica) && tablica.length ? Math.floor(Math.random() * tablica.length) : 0;
}
