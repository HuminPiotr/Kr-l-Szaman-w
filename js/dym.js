/**
 * Dym Okadzenia - kłęby, fizyka, front ognia, rysowanie.
 *
 * Nie wie nic o pieczęciach, kombosach ani mocy - dostaje pozycję/kierunek/
 * siłę z js/dmuchanie.js i punkty zarzewia z main.js (dziś: Płonący Palec,
 * jutro: dowolna inna technika ognia - patrz podpal()). Ten sam podział
 * odpowiedzialności co ogien.js/plonacyPalec.js.
 *
 * ================== V3 (2026-09-11, drugi test na kamerze) ==================
 * Zgłoszenie: "nie kółka wypuszczane, tylko JEDNOLITY strumień dymu wypychany
 * z płuc CIĄGIEM, dopóki dłoń jest przy ustach; wystrzeliwany już z ust, po
 * ~1/4 ekranu siła wypchnięcia rozpuszcza się i dym zaczyna się kłębić i
 * lecieć w górę; gracz ma móc MALOWAĆ wzory linią dymu" (wzór ulotny: ~10 s).
 * Diagnoza v2 - dlaczego "kółka" (nazwane przyczyny, nie zgadywanie stałych):
 *   1. emisja PULSOWANA (sin² 0.5 s co 1.35 s) - kolejne wystrzały to
 *      z definicji osobne obłoczki, między nimi nic nie wylatuje;
 *   2. dwie populacje rodziły się w RÓŻNYCH miejscach: strumień przy ustach,
 *      kłąb z ujemnym wiekiem 0.11-0.18 W dalej - kłąb "pojawiał się" jako
 *      osobne koło, nie wyrastał ze strumienia;
 *   3. za rzadko i za szeroko: 90 sprite'ów/s tylko w szczycie obwiedni
 *      (średnio ~17/s) w stożku ±14° - odstęp rzędu promienia = paciorki;
 *   4. brak interpolacji między klatkami: przy ruchu ust wszystkie sprite'y
 *      klatki rodziły się w jednym punkcie - malowanie linii niemożliwe.
 *
 * Odpowiedź - JEDNA FIZYKA, DWA CZASY ŻYCIA. Każda cząstka rodzi się W USTACH
 * z tą samą prędkością wylotu (W/s, nie px/s - płótno bywa 1280 i 1920) i tą
 * samą fizyką; `typ` decyduje tylko o życiu, docelowym promieniu i alfie:
 *   'strumien'  wstęga: ~97% cząstek, życie 6-12 s - to jest ciągła kolumna
 *               od ust i namalowana linia; rozpływa się w ~10 s (życzenie).
 *   'klab'      trwały: co KLAB_CO-ta cząstka (deterministycznie, nie losowo -
 *               równe odstępy wzdłuż linii), życie 200-260 s, rozrasta się w
 *               chmurę (τ 9 s: gdy wstęga gaśnie po ~10 s, kłąb ma już ~2/3
 *               rozmiaru - przekazanie ciągłe, W TYM SAMYM MIEJSCU, bo leciał
 *               razem ze wstęgą). Alfa CIENIEJE z rozrostem (zachowanie masy).
 * Opór jest JEDEN wektor prędkości z DWOMA współczynnikami zmieszanymi wagą
 * wylotu exp(-wiek/TAU_WYLOTU): świeża cząstka hamuje mocno (kolumna staje po
 * ~1/4 W), stara - słabo (dryf w polu przepływu). Bez osobnego wektora
 * wylotu: rozgarnij() i pole piszą do tego samego vx/vy i ZAWSZE mają opór -
 * inaczej machnięcie dłonią wstrzykiwałoby prędkość, która nigdy nie gaśnie.
 * Emisja jest CIĄGŁA (tempo stałe x powolny oddech, nigdy do zera) i
 * INTERPOLOWANA wzdłuż ruchu ust między klatkami - tak powstaje linia.
 * Oba typy są `stan: 'DYM'` i mogą płonąć - front i wybuch bez specjalnych
 * przypadków; małe r wstęgi samo ogranicza skok frontu.
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

// --- Emisja ciągła ---
// ZGADNIĘTE - do strojenia na kamerze. Tempo NIGDY nie spada do zera przy
// dmuchaniu; oddech to powolna modulacja ±15% ("wypychany z płuc"), nie pulsy.
export const STRUMIEN_NA_S = 90;         // sprite'ów / s przy pełnej sile
export const ODDECH_AMPLITUDA = 0.15;
export const ODDECH_HZ = 0.3;
export const KLAB_CO = 32;               // co tyle-ta cząstka jest trwałym kłębem (~2.8/s)

// --- Sufity: osobne FIFO na każdą populację, oba "wypychają najstarsze" ---
// Fill-rate tego samego rzędu co v2 (które przeszło test): 600 x box (0.18 W)²
// ≈ 19 W² + 900 x box (0.09 W)² ≈ 7 W². Przy FPS < ~40 na nakładce (klawisz D)
// pierwszy ruch to MAX_KLEBOW w dół (pokrycie ekranu nasyca się dużo
// wcześniej), potem MAX_STRUMIENIA.
export const MAX_KLEBOW = 600;
export const MAX_STRUMIENIA = 900;

// --- Wylot z ust (wspólny dla obu typów) ---
// Droga wylotu ≈ 0.17-0.29 W (sila 0.35..1, v0 losowe) - życzenie "po ~1/4
// ekranu siła wypchnięcia się rozpuszcza". Opór NIE jest stały (miesza się
// z OPOR_KLAB wagą exp(-wiek/τ)), więc droga to NIE v0/opór - stałe dobrane
// numerycznie (tools/test-dym.mjs pilnuje zasięgu). 90% drogi po ~1 s.
export const WYLOT_PREDKOSC_MIN_W_S = 0.60, WYLOT_PREDKOSC_MAX_W_S = 0.80;   // W/s przy pełnej sile
export const OPOR_WYLOTU = 4.0;          // 1/s - hamowanie świeżej cząstki
export const TAU_WYLOTU_S = 0.8;         // waga wylotu exp(-wiek/τ): miesza OPOR_WYLOTU -> OPOR_KLAB
const STOZEK_RAD = 0.087;                // ±5° - jednolita kolumna, nie wachlarz
const ROZRZUT_UST_PX = 6;
// Ciągłość kolumny: odstęp sprite'ów wzdłuż lotu = v0 / tempo musi być mniejszy
// niż promień startowy, inaczej wracają paciorki (test pilnuje tej relacji).
export const R_START_W = 0.015;

// --- Wstęga (strumien): krótkie życie - linia rozpływa się w ~10 s ---
export const STRUMIEN_ZYCIE_MIN_S = 6, STRUMIEN_ZYCIE_MAX_S = 12;
const STRUMIEN_R_KONIEC_MIN_W = 0.035, STRUMIEN_R_KONIEC_MAX_W = 0.045;
const STRUMIEN_ALFA = 0.55;
const STRUMIEN_NAROST_S = 0.1;
const STRUMIEN_ZANIK_OD = 0.6;           // ułamek życia, od którego alfa opada

// --- Kłąb (trwały): życie rzędu zegara potencjału (~4 min) ---
export const ZYCIE_MIN_S = 200, ZYCIE_MAX_S = 260;
export const ZANIK_OD = 0.75;            // zanik alfy dopiero w OSTATNIEJ ĆWIARTCE życia
export const NAROST_S = 0.1;             // widoczny od narodzin - jest częścią kolumny
const KLAB_R_KONIEC_MIN_W = 0.075, KLAB_R_KONIEC_MAX_W = 0.10;
// Rozrost ODSPRZĘŻONY od życia: ease-out 1-exp(-t/τ), 90% po ~21 s (wspólny dla obu typów).
export const KLAB_ROZROST_TAU_S = 9;
// Alfa cienieje z rozrostem: gęsta w kolumnie, rzadka jako chmura.
export const KLAB_ALFA_START = 0.55, KLAB_ALFA_KONIEC = 0.30;

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
        this._ile = { strumien: 0, klab: 0 };   // liczniki per typ - _dodaj nie skanuje tablicy
        this._nadwyzka = 0;          // ułamki sprite'ów przeniesione na następną klatkę
        this._t = 0;                 // zegar pola przepływu
        this._tEmisji = 0;           // zegar oddechu (płynie tylko podczas dmuchania)
        this._emitowal = false;      // czy emituj() zawołano w tej klatce (przerwa = brak interpolacji)
        this._poprzZaczep = null;    // usta z poprzedniej klatki emisji - interpolacja (malowanie)
        this._licznik = 0;           // co KLAB_CO-ta cząstka trwała; parzystość -> kierunek obrotu
    }

    get liczba() { return this._kleby.length; }
    get klebow() { return this._ile.klab; }
    get strumienia() { return this._ile.strumien; }
    get plonacych() { return this._kleby.filter(c => c.stan === 'ZAPLON').length; }

    /**
     * Oddech 1±ODDECH_AMPLITUDA - powolna modulacja tempa i prędkości wylotu
     * ("wypychany z płuc"), NIGDY do zera. Czysta - testowalna.
     */
    static oddech(t) {
        return 1 + ODDECH_AMPLITUDA * Math.sin(2 * Math.PI * ODDECH_HZ * (Number.isFinite(t) ? t : 0));
    }

    /**
     * Wydech z ust - wywoływać co klatkę, TYLKO gdy dmuchanie.stan === 'DMUCHA'.
     * Emisja CIĄGŁA: cząstki tej klatki rodzą się rozłożone wzdłuż odcinka
     * usta(poprzednia klatka) -> usta(teraz), więc ruch głowy ciągnie wstęgę
     * (malowanie). Po przerwie (updateAndDraw bez emituj) odcinka nie ma -
     * pierwsza cząstka rodzi się w nowym miejscu, nie na drodze do starego.
     * Prędkość ust NIE jest dziedziczona: dym zostaje tam, gdzie wydmuchany.
     *
     * @param {{x,y}} zaczepPx  usta, w PIKSELACH płótna
     * @param {{x,y}} kierunek  jednostkowy - w którą stronę gracz dmucha (dmuchanie.js)
     * @param {number} sila     0..1 - tempo i prędkość wylotu
     * @param {number} dt
     * @param {number} W        szerokość płótna (px) - rozmiary, prędkości i dystanse są jej ułamkami
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
        this._tEmisji += krok;
        const oddech = Dym.oddech(this._tEmisji);
        const silaCzynnik = 0.7 + 0.3 * s;

        const ile = STRUMIEN_NA_S * silaCzynnik * oddech * krok + this._nadwyzka;
        const n = Math.floor(ile);
        this._nadwyzka = ile - n;

        const od = this._poprzZaczep ?? zaczepPx;
        this._poprzZaczep = { x: zaczepPx.x, y: zaczepPx.y };

        for (let i = 0; i < n; i++) {
            const f = (i + 1) / n;
            const ux = od.x + (zaczepPx.x - od.x) * f;
            const uy = od.y + (zaczepPx.y - od.y) * f;

            const kat = (Math.random() - 0.5) * 2 * STOZEK_RAD;
            const cos = Math.cos(kat), sin = Math.sin(kat);
            const dx = kx * cos - ky * sin, dy = kx * sin + ky * cos;
            const v = wRef * (WYLOT_PREDKOSC_MIN_W_S + Math.random() * (WYLOT_PREDKOSC_MAX_W_S - WYLOT_PREDKOSC_MIN_W_S))
                    * silaCzynnik * oddech;

            const trwaly = (this._licznik % KLAB_CO) === 0;
            const typ = trwaly ? 'klab' : 'strumien';
            const rCelW = trwaly
                ? KLAB_R_KONIEC_MIN_W + Math.random() * (KLAB_R_KONIEC_MAX_W - KLAB_R_KONIEC_MIN_W)
                : STRUMIEN_R_KONIEC_MIN_W + Math.random() * (STRUMIEN_R_KONIEC_MAX_W - STRUMIEN_R_KONIEC_MIN_W);
            const zycie = trwaly
                ? ZYCIE_MIN_S + Math.random() * (ZYCIE_MAX_S - ZYCIE_MIN_S)
                : STRUMIEN_ZYCIE_MIN_S + Math.random() * (STRUMIEN_ZYCIE_MAX_S - STRUMIEN_ZYCIE_MIN_S);

            this._dodaj({
                typ,
                x: ux + (Math.random() - 0.5) * ROZRZUT_UST_PX,
                y: uy + (Math.random() - 0.5) * ROZRZUT_UST_PX,
                vx: dx * v,
                vy: dy * v,
                wiek: 0,
                zycie,
                faza: Math.random() * Math.PI * 2,
                obrot: Math.random() * Math.PI * 2,
                wobrot: (OBROT_MIN + Math.random() * (OBROT_MAX - OBROT_MIN)) * ((this._licznik & 1) ? 1 : -1),
                r: wRef * R_START_W,
                rStart: wRef * R_START_W,
                rCel: wRef * rCelW,
                stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
                ...warianty()
            });
            this._licznik++;
        }
    }

    _dodaj(cz) {
        this._kleby.push(cz);
        this._ile[cz.typ]++;
        // Sufit PER POPULACJA wypycha NAJSTARSZE tej populacji - kolejność
        // wstawiania jest kolejnością wieku, więc pierwszy znaleziony tego typu
        // jest najdłużej żyjącym. Skan tylko PO przekroczeniu sufitu.
        const max = cz.typ === 'klab' ? MAX_KLEBOW : MAX_STRUMIENIA;
        while (this._ile[cz.typ] > max) {
            const i = this._kleby.findIndex(c => c.typ === cz.typ);
            if (i < 0) break;
            this._kleby.splice(i, 1);
            this._ile[cz.typ]--;
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
     * Podpal kłęby DYM w zasięgu zarzewi. Front (zarażanie sąsiadów) biegnie
     * w _ruszaj() - tu wyłącznie PIERWSZY kontakt z zewnętrznym źródłem ognia.
     *
     * @param {Array<{x,y,r,sila}>} zarzewiaPx  punkty ognia w PIKSELACH (dowolna technika ognia - main.js zbiera je co klatkę)
     */
    podpal(zarzewiaPx) {
        if (!zarzewiaPx?.length) return;
        for (const c of this._kleby) {
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
        const ile = { strumien: 0, klab: 0 };
        for (const c of this._kleby) {
            c.wiek += krok;

            if (c.stan === 'WYBUCH') {
                c.tWybuch += krok;
                if (c.tWybuch >= CZAS_WYBUCHU_S) continue;   // kłąb znika NA ZAWSZE
                zywe.push(c);
                ile[c.typ]++;
                continue;
            }

            if (c.wiek >= c.zycie) continue;   // DYM/ZAPLON gasną też z wieku

            if (c.stan === 'ZAPLON') {
                c.tZaplonu += krok;
                if (!c.rozprzestrzenil && c.tZaplonu >= OPOZNIENIE_FRONTU_S) {
                    c.rozprzestrzenil = true;
                    for (const inny of this._kleby) {
                        if (inny === c || inny.stan !== 'DYM') continue;
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

            // JEDNA fizyka dla obu typów (nagłówek "V3"). Waga wylotu gaśnie
            // z wiekiem: świeża cząstka to wystrzelona kolumna (silny opór,
            // wznoszenie jeszcze nie dominuje), stara - kłąb w polu przepływu.
            const wylot = Math.exp(-c.wiek / TAU_WYLOTU_S);
            const wznoszenie = wznoszenieCzynnik(c.y, hRef);
            const celVy = -WZNOSZENIE_H_S * hRef * wznoszenie;
            c.vy += (celVy - c.vy) * Math.min(1, krok * 2) * (1 - wylot);

            const ax = A * Math.sin(c.y * k + this._t * POLE_OMEGA_1 + c.faza * 0.3);
            const ay = A * Math.cos(c.x * k * 0.8 + this._t * POLE_OMEGA_2);
            c.vx += ax * krok;
            c.vy += ay * krok;
            c.vx += Math.sign(Math.sin(c.faza)) * ROZLEW_BOK_H_S * hRef * (1 - wznoszenie) * krok;

            // Opór zmieszany wagą wylotu - jeden wektor, więc rozgarnij() i pole
            // ZAWSZE mają opór (machnięcie dłonią nie wstrzykuje prędkości na zawsze).
            const oporWsp = OPOR_WYLOTU * wylot + OPOR_KLAB * (1 - wylot);
            const opor = Math.max(0, 1 - oporWsp * krok);
            c.vx *= opor;
            c.vy *= opor;
            c.x += c.vx * krok;
            c.y += c.vy * krok;
            c.obrot += c.wobrot * krok;

            const wzrost = 1 - Math.exp(-c.wiek / KLAB_ROZROST_TAU_S);
            c.r = c.rStart + (c.rCel - c.rStart) * wzrost;

            if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)) {
                zywe.push(c);
                ile[c.typ]++;
            }
        }
        this._ile = ile;
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
        // Przerwa w dmuchaniu urywa odcinek interpolacji - po powrocie dłoni
        // pierwsza cząstka rodzi się w NOWYM miejscu, nie na drodze do starego.
        if (!this._emitowal) this._poprzZaczep = null;
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
                if (c.typ !== typ || c.stan !== 'DYM') continue;
                const img = obraz(MANIFEST.mgla[c.wariantMgla]);
                if (!img) continue;
                let alfa, r;
                if (typ === 'klab') {
                    alfa = obwiedniaAlfy(c.wiek, c.zycie) * alfaKlebu(c.r, c.rStart, c.rCel)
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

                // Wstęga wybucha bez rozbłysku: przy zapłonie świeżej kolumny
                // (setki cząstek naraz) trzeci sprite na każdą to skok fill-rate,
                // a małe r i tak nie daje czytelnego błysku. Kłęby - pełny zestaw.
                if (rozblysk && c.typ === 'klab' && p < 0.35) {
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

/**
 * Alfa trwałego kłębu cienieje z rozrostem (zachowanie "masy"): w kolumnie
 * jest tak gęsty jak wstęga, jako dojrzała chmura - rzadki. Liniowo po
 * postępie rozrostu; NIGDY poniżej KLAB_ALFA_KONIEC (zanik końcowy to
 * osobno obwiedniaAlfy).
 */
export function alfaKlebu(r, rStart, rCel) {
    const zakres = rCel - rStart;
    if (!Number.isFinite(zakres) || zakres <= 1e-6) return KLAB_ALFA_START;
    const p = Math.max(0, Math.min(1, ((Number.isFinite(r) ? r : rStart) - rStart) / zakres));
    return KLAB_ALFA_START + (KLAB_ALFA_KONIEC - KLAB_ALFA_START) * p;
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
