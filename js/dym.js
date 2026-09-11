/**
 * Dym Okadzenia - kłęby, fizyka, front ognia, rysowanie.
 *
 * Nie wie nic o pieczęciach, kombosach ani mocy - dostaje pozycję/kierunek/
 * siłę z js/dmuchanie.js i punkty zarzewia z main.js (dziś: Płonący Palec,
 * jutro: dowolna inna technika ognia - patrz podpal()). Ten sam podział
 * odpowiedzialności co ogien.js/plonacyPalec.js.
 *
 * ================== V2 (2026-09-11, po teście na kamerze) ==================
 * Zgłoszenie: "nieżywe tekstury dymu, zdecydowanie za mało, gracz ma
 * WYSTRZELIWAĆ kłęby z ust jak przy vapowaniu". Diagnoza v1 (nazwane
 * przyczyny, nie zgadywanie stałych):
 *   1. jeden sprite na kłąb, obrót ±0.075 rad/s (niewidoczny), turbulencja
 *      ~19 px/s² - bilbord sunący w górę; żywy dym to RUCH WEWNĘTRZNY;
 *   2. emisja to kapanie 6/s z prędkością 40-80 px/s - nie było WYDECHU
 *      (szybki, gęsty, stożkowy strumień), tylko balon nadmuchiwany w miejscu;
 *   3. rozrost sprzężony z ~4-minutowym życiem (pełny rozmiar po 2 MINUTACH) -
 *      przez pierwszą minutę każdy kłąb to plamka, stąd "za mało";
 *   4. sufit 180 - za mało, żeby okadzić ekran, i za mała alfa łączna.
 *
 * Odpowiedź - DWIE POPULACJE w jednej tablicy (pole `typ`):
 *   'strumien'  wydech: wystrzelony z ust setki px/s w stożku wzdłuż `kierunek`,
 *               silny opór (zatrzymuje się po ~250 px), żyje ~2 s, gęsty.
 *   'klab'      kłębienie: rodzi się RAZEM z wydechem, ale z UJEMNYM wiekiem
 *               (opóźniony start, wzorzec kolowrot.js) i tam, gdzie strumień
 *               zwolni - gdy strumień gaśnie, kłąb właśnie się pojawia, więc
 *               plume "rozkłębia się" w chmurę. Żyje 200-260 s, rozrasta się do
 *               pełni w ~25 s (NIE w połowie życia), płynie w POLU PRZEPŁYWU
 *               (sąsiedzi wirują spójnie), obraca się widocznie, oddycha skalą.
 * Wydech jest PULSOWANY (OKRES_WYDECHU_S / WYDECH_AKTYWNY_S) - kolejne
 * wystrzały, nie ciągły wąż. Oba typy są `stan: 'DYM'` i mogą płonąć - front
 * i wybuch nie mają specjalnych przypadków; mały `r` strumienia sam ogranicza
 * skok frontu przez świeży wydech.
 *
 * ================== ZMIANA FIZYKI W TRAKCIE IMPLEMENTACJI (2026-09-11) =====
 * Pierwsza wersja specu zakładała, że kłąb opuszcza górę ekranu w ~50-70 s.
 * Życzenie właściciela gry: dym ma się KŁĘBIĆ PO CAŁYM EKRANIE, głównie pod
 * sufitem, i blednąć dopiero BLISKO KOŃCA ~4-minutowego życia. Stąd
 * wznoszenieCzynnik(): unoszenie SŁABNIE przy górnej krawędzi - kłąb zwalnia
 * i rozlewa się na boki, jak dym uderzający o sufit.
 *
 * ================== TRZY STANY KŁĘBU ==================
 *   DYM     - unosi się, rośnie, dłonie mogą go rozgarniać (rozgarnij()).
 *   ZAPLON  - podpalony (podpal()); po krótkim opóźnieniu zaraża sąsiadów
 *             w zasięgu (FRONT biegnie kłąb po kłębie), potem wybucha.
 *   WYBUCH  - kula ognia, krótko, potem kłąb znika NA ZAWSZE (nie wraca do DYM).
 *
 * ================== RYSOWANIE: DWA TRYBY MIESZANIA ==================
 * DYM rysowany 'source-over' w jasnej szarości - reszta gry rysuje
 * WYŁĄCZNIE 'lighter' (ogien.js/fala.js/iskry.js/kolowrot.js), a addytywne
 * mieszanie zjada szary dym do niewidzialności (ta sama pułapka co w
 * efekty.js:206-216 i nagłówku ogien.js). ZAPLON/WYBUCH przełączają na
 * 'lighter' z ciepłym tintem - to WŁAŚNIE JEST "dym zmienia zachowanie po
 * podpaleniu", bez dodatkowego kosztu.
 *
 * Ciepły tint ZAPLON jest WSTĘPNIE WYPALONY w kilku stopniach (nie liczony
 * co klatkę) - assety.js:wypalTintowany cache'uje po `barwa`, a ciągle
 * zmieniająca się barwa rozsadziłaby ten cache w nieograniczony Map.
 */
import { MANIFEST, obraz, wypalTintowany } from './assety.js';

// --- Wydech pulsowany ---
// ZGADNIĘTE - do strojenia na kamerze. Okres ≈ spokojny oddech; faza aktywna
// to sam wystrzał, potem przerwa, żeby kolejne kłęby czytały się OSOBNO.
export const OKRES_WYDECHU_S = 1.35;
export const WYDECH_AKTYWNY_S = 0.5;
export const STRUMIEN_NA_S = 90;         // sprite'ów strumienia / s w szczycie wydechu przy pełnej sile
export const KLAB_NA_WYDECH = 4;         // trwałych kłębów na jeden wydech

// --- Sufity: osobne FIFO na każdą populację, oba "wypychają najstarsze" ---
// 450 dużych sprite'ów source-over to ~50 M px/klatkę w najgorszym razie -
// sprawdzić FPS na nakładce (klawisz D); przy spadku poniżej ~40 pierwszy
// ruch to sufit w dół, nie mniejsze sprite'y (pokrycie ekranu nasyca się
// dużo wcześniej niż 450, więc jest z czego zejść).
export const MAX_KLEBOW = 450;
export const MAX_STRUMIENIA = 300;

// --- Strumień (wydech) ---
const STRUMIEN_PREDKOSC_MIN = 550, STRUMIEN_PREDKOSC_MAX = 900;   // px/s przy pełnej sile
const STRUMIEN_STOZEK_RAD = 0.245;       // ±14°
const STRUMIEN_OPOR = 2.6;               // 1/s - droga ≈ v/opór: 210-350 px przy pełnej sile
const STRUMIEN_ZYCIE_MIN_S = 1.6, STRUMIEN_ZYCIE_MAX_S = 2.6;
const STRUMIEN_R_START_W = 0.020, STRUMIEN_R_KONIEC_W = 0.055;   // ułamek W; dorasta w ~1 s lotu
const STRUMIEN_ROZROST_S = 1.0;
const STRUMIEN_ALFA = 0.65;
const STRUMIEN_NAROST_S = 0.15;
const STRUMIEN_ZANIK_OD = 0.6;           // ułamek życia, od którego alfa opada

// --- Kłąb (kłębienie): życie rzędu zegara potencjału (~4 min), NIE 50-70 s ---
export const ZYCIE_MIN_S = 200, ZYCIE_MAX_S = 260;
export const ZANIK_OD = 0.75;            // zanik alfy dopiero w OSTATNIEJ ĆWIARTCE życia
// Narost NA STARCIE jest ABSOLUTNY (sekundy), NIE ułamek życia - przy
// zyciu≈230 s ułamek dawał pełną jasność dopiero po ~29 s.
export const NAROST_S = 1.2;
// Opóźniony start: kłąb pojawia się, gdy strumień właśnie gaśnie.
export const KLAB_OPOZNIENIE_MIN_S = 0.6, KLAB_OPOZNIENIE_MAX_S = 1.2;
// Miejsce narodzin: tam, gdzie strumień zwolni (ułamek W wzdłuż kierunku).
const KLAB_DYSTANS_MIN_W = 0.11, KLAB_DYSTANS_MAX_W = 0.18;
const KLAB_ROZRZUT_W = 0.035;
const KLAB_PREDKOSC_START = 40;          // px/s wzdłuż kierunku - resztka pędu wydechu
// Rozrost ODSPRZĘŻONY od życia: ease-out 1-exp(-t/τ), 90% po ~21 s.
const KLAB_R_START_W = 0.045;
const KLAB_R_KONIEC_MIN_W = 0.085, KLAB_R_KONIEC_MAX_W = 0.115;
export const KLAB_ROZROST_TAU_S = 9;
const KLAB_ALFA = 0.32;

// --- Ruch wewnętrzny kłębu ("żyje") ---
// Pole przepływu zależne od POZYCJI i czasu (nie per-sprite szum): sąsiednie
// kłęby płyną spójnie, jak wiry. Amplituda dobrana tak, żeby przy oporze
// OPOR_KLAB równowagowy dryf wychodził ~20 px/s (A / opór).
const POLE_AMPLITUDA_W_S2 = 0.006;       // ułamek W/s²
const POLE_DLUGOSC_FALI_W = 0.35;        // ułamek W - rozmiar wiru
const POLE_OMEGA_1 = 0.35, POLE_OMEGA_2 = 0.27;   // rad/s - jak szybko wiry wędrują
const OPOR_KLAB = 0.6;                   // 1/s
const OBROT_MIN = 0.15, OBROT_MAX = 0.35;   // rad/s - WIDOCZNY (v1: ±0.075 - niewidoczny)
const ODDECH_SKALI = 0.05, ODDECH_OMEGA = 1.9;
const MIGOTANIE_ALFY = 0.08, MIGOTANIE_OMEGA = 1.3;

// --- Wznoszenie, słabnące blisko sufitu (patrz nagłówek "ZMIANA FIZYKI") ---
// Ułamek WYSOKOŚCI EKRANU na sekundę - ten sam powód co efekty.js (mglaIMrok).
const WZNOSZENIE_H_S = 0.045;
export const SUFIT_Y_H = 0.12;           // górna granica - tu wznoszenie prawie zanika
export const SPADEK_OD_Y_H = 0.55;       // poniżej tego Y (w dół ekranu) pełne wznoszenie
const SUFIT_MIN_CZYNNIK = 0.12;          // NIGDY do zera - lekkie mrowienie zostaje
const ROZLEW_BOK_H_S = 0.020;            // dryf w bok rosnący blisko sufitu - "rozlewa się"

// --- Rozgarnianie dłońmi ---
const ROZGARNIJ_PROMIEN_W = 0.13;
const ROZGARNIJ_SILA = 0.55;

// --- Zapłon i front ognia ---
const ZAPLON_KONTAKT_MNOZNIK = 1.5;      // promień kontaktu = kłąb.r * to + zarzewie.r - hojny, nie pikselowy
// STROJONE (przegląd v1): przy dojrzałym kłębie i mnożniku 1.5 fala biegła
// przez CAŁY ekran w mniej niż sekundę - bliżej "cały dym naraz" niż wybranej
// opcji "front kłąb po kłębie".
const FRONT_PROMIEN_MNOZNIK = 1.2;       // promień zarażania sąsiadów = (r1+r2) * to
export const OPOZNIENIE_FRONTU_S = 0.15;
export const CZAS_DO_WYBUCHU_S = 0.35;
export const CZAS_WYBUCHU_S = 0.4;

// --- Barwy ---
const BARWA_DYMU = [205, 205, 212];      // jasna, chłodna szarość - source-over
const BARWA_ZAPLONU_STOPNIE = [          // wstępnie wypalone stopnie, snap po postępie
    [205, 205, 212],
    [255, 210, 150],
    [255, 160, 70],
    [255, 100, 30],
    [220, 40, 10]
];
const BARWA_RDZENIA = [255, 238, 200];
const BARWA_ROZBLYSKU = [255, 225, 170];

export class Dym {
    constructor() {
        this._kleby = [];
        this._nadwyzka = 0;          // ułamki sprite'ów strumienia przeniesione na następną klatkę
        this._t = 0;                 // zegar pola przepływu
        this._tWydechu = 0;          // faza obwiedni wydechu
        this._wAktywnej = false;     // czy poprzednia klatka emisji była w fazie aktywnej
        this._emitowal = false;      // czy emituj() zawołano w tej klatce (reset fazy przy przerwie)
        this._licznik = 0;           // parzystość -> kierunek obrotu sąsiadów
    }

    get liczba() { return this._kleby.length; }
    get klebow() { return this._kleby.filter(c => c.typ === 'klab').length; }
    get strumienia() { return this._kleby.filter(c => c.typ === 'strumien').length; }
    get plonacych() { return this._kleby.filter(c => c.stan === 'ZAPLON').length; }

    /**
     * Obwiednia wydechu 0..1 dla fazy t (s) w okresie: sin² przez
     * WYDECH_AKTYWNY_S, potem 0 do końca okresu. Czysta - testowalna.
     */
    static wydech(t) {
        const faza = ((t % OKRES_WYDECHU_S) + OKRES_WYDECHU_S) % OKRES_WYDECHU_S;
        if (faza >= WYDECH_AKTYWNY_S) return 0;
        const s = Math.sin(Math.PI * faza / WYDECH_AKTYWNY_S);
        return s * s;
    }

    /**
     * Wydech z ust - wywoływać co klatkę, TYLKO gdy dmuchanie.stan === 'DMUCHA'.
     * Faza wydechu zeruje się, gdy przez klatkę nie było wywołania
     * (updateAndDraw), więc po przerwie pierwszy wystrzał idzie od razu.
     *
     * @param {{x,y}} zaczepPx  usta, w PIKSELACH płótna
     * @param {{x,y}} kierunek  jednostkowy - w którą stronę gracz dmucha (dmuchanie.js)
     * @param {number} sila     0..1 - grubość strumienia
     * @param {number} dt
     * @param {number} W        szerokość płótna (px) - rozmiary i dystanse są jej ułamkami
     */
    emituj(zaczepPx, kierunek, sila, dt, W) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (!zaczepPx || !Number.isFinite(zaczepPx.x) || !Number.isFinite(zaczepPx.y) || s <= 0.01 || krok <= 0) return;
        const wRef = Number.isFinite(W) && W > 0 ? W : 1920;

        let kx = Number.isFinite(kierunek?.x) ? kierunek.x : 0;
        let ky = Number.isFinite(kierunek?.y) ? kierunek.y : -1;
        const dl = Math.hypot(kx, ky);
        if (dl < 1e-6) { kx = 0; ky = -1; } else { kx /= dl; ky /= dl; }

        this._emitowal = true;
        this._tWydechu += krok;
        const env = Dym.wydech(this._tWydechu);
        const aktywna = env > 0;

        // Trwałe kłęby rodzą się RAZ, na początku każdego wydechu - tam, gdzie
        // strumień zaraz zwolni, z opóźnionym startem (ujemny wiek).
        if (aktywna && !this._wAktywnej) {
            for (let i = 0; i < KLAB_NA_WYDECH; i++) {
                const dyst = wRef * (KLAB_DYSTANS_MIN_W + Math.random() * (KLAB_DYSTANS_MAX_W - KLAB_DYSTANS_MIN_W));
                const bok = (Math.random() - 0.5) * 2 * wRef * KLAB_ROZRZUT_W;
                this._dodaj({
                    typ: 'klab',
                    x: zaczepPx.x + kx * dyst - ky * bok,
                    y: zaczepPx.y + ky * dyst + kx * bok,
                    vx: kx * KLAB_PREDKOSC_START,
                    vy: ky * KLAB_PREDKOSC_START,
                    wiek: -(KLAB_OPOZNIENIE_MIN_S + Math.random() * (KLAB_OPOZNIENIE_MAX_S - KLAB_OPOZNIENIE_MIN_S)),
                    zycie: ZYCIE_MIN_S + Math.random() * (ZYCIE_MAX_S - ZYCIE_MIN_S),
                    faza: Math.random() * Math.PI * 2,
                    obrot: Math.random() * Math.PI * 2,
                    wobrot: (OBROT_MIN + Math.random() * (OBROT_MAX - OBROT_MIN)) * ((this._licznik++ & 1) ? 1 : -1),
                    r: 0,
                    rStart: wRef * KLAB_R_START_W,
                    rCel: wRef * (KLAB_R_KONIEC_MIN_W + Math.random() * (KLAB_R_KONIEC_MAX_W - KLAB_R_KONIEC_MIN_W)),
                    stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
                    ...warianty()
                });
            }
        }
        this._wAktywnej = aktywna;
        if (!aktywna) return;

        // Strumień: gęsty stożek wzdłuż kierunku, prędkość skalowana obwiednią i siłą.
        const ile = STRUMIEN_NA_S * env * s * krok + this._nadwyzka;
        const n = Math.floor(ile);
        this._nadwyzka = ile - n;
        const mnoznikPredkosci = (0.6 + 0.4 * s) * Math.sqrt(env);

        for (let i = 0; i < n; i++) {
            const kat = (Math.random() - 0.5) * 2 * STRUMIEN_STOZEK_RAD;
            const cos = Math.cos(kat), sin = Math.sin(kat);
            const dx = kx * cos - ky * sin, dy = kx * sin + ky * cos;
            const v = (STRUMIEN_PREDKOSC_MIN + Math.random() * (STRUMIEN_PREDKOSC_MAX - STRUMIEN_PREDKOSC_MIN)) * mnoznikPredkosci;
            this._dodaj({
                typ: 'strumien',
                x: zaczepPx.x + (Math.random() - 0.5) * 8,
                y: zaczepPx.y + (Math.random() - 0.5) * 8,
                vx: dx * v,
                vy: dy * v,
                wiek: 0,
                zycie: STRUMIEN_ZYCIE_MIN_S + Math.random() * (STRUMIEN_ZYCIE_MAX_S - STRUMIEN_ZYCIE_MIN_S),
                faza: Math.random() * Math.PI * 2,
                obrot: Math.random() * Math.PI * 2,
                wobrot: (Math.random() - 0.5) * 0.8,
                r: wRef * STRUMIEN_R_START_W,
                rStart: wRef * STRUMIEN_R_START_W,
                rCel: wRef * STRUMIEN_R_KONIEC_W * (0.8 + Math.random() * 0.4),
                stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
                ...warianty()
            });
        }
    }

    _dodaj(cz) {
        this._kleby.push(cz);
        // Sufit PER POPULACJA wypycha NAJSTARSZE tej populacji - kolejność
        // wstawiania jest kolejnością wieku, więc pierwszy znaleziony tego typu
        // jest najdłużej żyjącym.
        const max = cz.typ === 'klab' ? MAX_KLEBOW : MAX_STRUMIENIA;
        let ile = 0;
        for (const c of this._kleby) if (c.typ === cz.typ) ile++;
        while (ile > max) {
            const i = this._kleby.findIndex(c => c.typ === cz.typ);
            if (i < 0) break;
            this._kleby.splice(i, 1);
            ile--;
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
        for (const c of this._kleby) {
            if (c.stan === 'WYBUCH' || c.wiek < 0) continue;
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
     * Podpal kłęby DYM w zasięgu zarzewi. Front (zarażanie sąsiadów) biegnie
     * w _ruszaj() - tu wyłącznie PIERWSZY kontakt z zewnętrznym źródłem ognia.
     *
     * @param {Array<{x,y,r,sila}>} zarzewiaPx  punkty ognia w PIKSELACH (dowolna technika ognia - main.js zbiera je co klatkę)
     */
    podpal(zarzewiaPx) {
        if (!zarzewiaPx?.length) return;
        for (const c of this._kleby) {
            if (c.stan !== 'DYM' || c.wiek < 0) continue;
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
     * Fizyka WSZYSTKICH cząstek - czysta (bez document), jak kolowrot.js
     * _ruszaj(). Zwraca, ile kłębów przeszło w WYBUCH W TEJ KLATCE - main.js
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

        const zywe = [];
        for (const c of this._kleby) {
            c.wiek += krok;

            // Opóźniony start (kłąb czeka, aż strumień zwolni) - tylko starzeje się.
            if (c.wiek < 0) { zywe.push(c); continue; }

            if (c.stan === 'WYBUCH') {
                c.tWybuch += krok;
                if (c.tWybuch >= CZAS_WYBUCHU_S) continue;   // kłąb znika NA ZAWSZE
                zywe.push(c);
                continue;
            }

            if (c.wiek >= c.zycie) continue;   // DYM/ZAPLON gasną też z wieku

            if (c.stan === 'ZAPLON') {
                c.tZaplonu += krok;
                if (!c.rozprzestrzenil && c.tZaplonu >= OPOZNIENIE_FRONTU_S) {
                    c.rozprzestrzenil = true;
                    for (const inny of this._kleby) {
                        if (inny === c || inny.stan !== 'DYM' || inny.wiek < 0) continue;
                        const promien = (c.r + inny.r) * FRONT_PROMIEN_MNOZNIK;
                        if (Math.hypot(c.x - inny.x, c.y - inny.y) < promien) {
                            inny.stan = 'ZAPLON';
                            inny.tZaplonu = 0;
                            inny.rozprzestrzenil = false;
                        }
                    }
                }
                if (c.tZaplonu >= CZAS_DO_WYBUCHU_S) {
                    c.stan = 'WYBUCH';
                    c.tWybuch = 0;
                    nowychWybuchow++;
                }
            }

            if (c.typ === 'strumien') {
                // Wystrzał: silny opór hamuje lot, potem lekkie unoszenie.
                const opor = Math.max(0, 1 - STRUMIEN_OPOR * krok);
                c.vx *= opor;
                c.vy = c.vy * opor - WZNOSZENIE_H_S * hRef * 0.5 * krok;
                c.x += c.vx * krok;
                c.y += c.vy * krok;
                c.obrot += c.wobrot * krok;
                const wzrost = Math.min(1, c.wiek / STRUMIEN_ROZROST_S);
                c.r = c.rStart + (c.rCel - c.rStart) * wzrost;
            } else {
                // Kłąb: wznoszenie słabnące pod sufitem + pole przepływu + rozlew.
                const wznoszenie = wznoszenieCzynnik(c.y, hRef);
                const celVy = -WZNOSZENIE_H_S * hRef * wznoszenie;
                c.vy += (celVy - c.vy) * Math.min(1, krok * 2);

                const ax = A * Math.sin(c.y * k + this._t * POLE_OMEGA_1 + c.faza * 0.3);
                const ay = A * Math.cos(c.x * k * 0.8 + this._t * POLE_OMEGA_2);
                c.vx += ax * krok;
                c.vy += ay * krok;
                c.vx += Math.sign(Math.sin(c.faza)) * ROZLEW_BOK_H_S * hRef * (1 - wznoszenie) * krok;

                const opor = Math.max(0, 1 - OPOR_KLAB * krok);
                c.vx *= opor;
                c.x += c.vx * krok;
                c.y += c.vy * krok;
                c.obrot += c.wobrot * krok;

                const wzrost = 1 - Math.exp(-c.wiek / KLAB_ROZROST_TAU_S);
                c.r = c.rStart + (c.rCel - c.rStart) * wzrost;
            }

            if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)) zywe.push(c);
        }
        this._kleby = zywe;
        return nowychWybuchow;
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx  null = tylko fizyka (testy, jak kolowrot.js)
     * @param {number} W  szerokość płótna (px)
     * @param {number} H  wysokość płótna (px)
     * @param {number} dt
     * @returns {number} liczba kłębów, które w tej klatce weszły w WYBUCH
     */
    updateAndDraw(ctx, W, H, dt) {
        // Przerwa w dmuchaniu zeruje fazę wydechu - po powrocie dłoni
        // pierwszy wystrzał idzie natychmiast, nie po resztce przerwy.
        if (!this._emitowal) { this._tWydechu = 0; this._wAktywnej = false; }
        this._emitowal = false;

        const nowychWybuchow = this._ruszaj(dt, W, H);
        if (ctx) this._rysuj(ctx);
        return nowychWybuchow;
    }

    _rysuj(ctx) {
        if (!this._kleby.length) return;
        ctx.save();

        // --- DYM: source-over, INACZEJ NIŻ CAŁA RESZTA GRY (patrz nagłówek).
        // Najpierw kłęby, potem strumień NA WIERZCHU (świeży wydech jest gęstszy).
        ctx.globalCompositeOperation = 'source-over';
        for (const typ of ['klab', 'strumien']) {
            for (const c of this._kleby) {
                if (c.typ !== typ || c.stan !== 'DYM' || c.wiek < 0) continue;
                const img = obraz(MANIFEST.mgla[c.wariantMgla]);
                if (!img) continue;
                let alfa, r;
                if (typ === 'klab') {
                    alfa = obwiedniaAlfy(c.wiek, c.zycie) * KLAB_ALFA
                         * (1 + MIGOTANIE_ALFY * Math.sin(this._t * MIGOTANIE_OMEGA + c.faza * 2));
                    r = c.r * (1 + ODDECH_SKALI * Math.sin(this._t * ODDECH_OMEGA + c.faza));
                } else {
                    alfa = obwiedniaStrumienia(c.wiek, c.zycie) * STRUMIEN_ALFA;
                    r = c.r;
                }
                if (alfa <= 0.01) continue;
                const sprite = wypalTintowany(img, BARWA_DYMU, 220);
                ctx.globalAlpha = Math.max(0, Math.min(1, alfa));
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.obrot);
                ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
                ctx.restore();
            }
        }

        // --- ZAPLON i WYBUCH: 'lighter', ciepłe - dym "zmienia zachowanie" ---
        ctx.globalCompositeOperation = 'lighter';
        for (const c of this._kleby) {
            if (c.wiek < 0) continue;
            if (c.stan === 'ZAPLON') {
                const img = obraz(MANIFEST.mgla[c.wariantMgla]);
                if (!img) continue;
                const p = Math.max(0, Math.min(1, c.tZaplonu / CZAS_DO_WYBUCHU_S));
                const idx = Math.min(BARWA_ZAPLONU_STOPNIE.length - 1,
                                      Math.floor(p * BARWA_ZAPLONU_STOPNIE.length));
                const sprite = wypalTintowany(img, BARWA_ZAPLONU_STOPNIE[idx], 220);
                ctx.globalAlpha = Math.max(0.2, 1 - p * 0.3);
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.obrot);
                const r = c.r * (1 + p * 0.3);   // lekko pęcznieje przed wybuchem
                ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
                ctx.restore();
            } else if (c.stan === 'WYBUCH') {
                const p = Math.max(0, Math.min(1, c.tWybuch / CZAS_WYBUCHU_S));
                const zanik = 1 - p;
                const rdzen = obraz(MANIFEST.ogienRdzen[c.wariantOgien]);
                const plomien = obraz(MANIFEST.plomien[c.wariantPlomien]);
                const rozblysk = obraz(MANIFEST.rozblyskUderzenia[c.wariantRozblysk]);
                const skala = 0.6 + 0.8 * Math.min(1, p * 4);
                const r = c.r * (1.4 + 0.6 * skala);

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
            }
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

/**
 * Czynnik wznoszenia SUFIT_MIN_CZYNNIK..1 wg pozycji Y (px). 1 daleko od
 * sufitu, opada do minimum blisko górnej krawędzi - NIGDY do zera, żeby kłęby
 * pod sufitem dalej lekko "mrowiły", zamiast zamarznąć w miejscu.
 */
export function wznoszenieCzynnik(y, H) {
    const sufit = H * SUFIT_Y_H, start = H * SPADEK_OD_Y_H;
    if (y >= start) return 1;
    if (y <= sufit) return SUFIT_MIN_CZYNNIK;
    const t = (y - sufit) / (start - sufit);
    return SUFIT_MIN_CZYNNIK + (1 - SUFIT_MIN_CZYNNIK) * t;
}

/**
 * Obwiednia alfy kłębu: narost ABSOLUTNY w sekundach (NAROST_S), pełna
 * jasność aż do ZANIK_OD, potem opada do zera na końcu życia. Zanik BLISKO
 * KOŃCA, nie od połowy - stąd DWA ARGUMENTY, nie jeden ułamek: przy życiu
 * 200-260 s ułamek dawałby atak liczony w dziesiątkach sekund.
 *
 * @param {number} wiek   wiek kłębu w sekundach
 * @param {number} zycie  całkowite życie kłębu w sekundach
 */
export function obwiedniaAlfy(wiek, zycie) {
    const z = Number.isFinite(zycie) && zycie > 0 ? zycie : 1;
    const w = Number.isFinite(wiek) ? Math.max(0, wiek) : 0;
    const t = Math.min(1, w / z);
    const narost = Math.sin(Math.min(1, w / NAROST_S) * Math.PI * 0.5);
    const zanik = t > ZANIK_OD ? Math.max(0, 1 - (t - ZANIK_OD) / (1 - ZANIK_OD)) : 1;
    return narost * zanik;
}

/** Obwiednia alfy strumienia: błyskawiczny narost, zanik w ostatnich 40% życia. */
export function obwiedniaStrumienia(wiek, zycie) {
    const z = Number.isFinite(zycie) && zycie > 0 ? zycie : 1;
    const w = Number.isFinite(wiek) ? Math.max(0, wiek) : 0;
    const t = Math.min(1, w / z);
    const narost = Math.sin(Math.min(1, w / STRUMIEN_NAROST_S) * Math.PI * 0.5);
    const zanik = t > STRUMIEN_ZANIK_OD ? Math.max(0, 1 - (t - STRUMIEN_ZANIK_OD) / (1 - STRUMIEN_ZANIK_OD)) : 1;
    return narost * zanik;
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
