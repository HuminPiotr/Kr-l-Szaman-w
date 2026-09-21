/**
 * Fala Podmuchu (Aard) - układ cząstek, TYLKO rysowanie.
 *
 * Dostaje zaczep, kierunek 3D i siłę przez wystrzel(); nie wie nic
 * o pieczęciach, kombosach ani o mocy - ten sam podział co ogien.js.
 *
 * JEDNORAZOWY IMPULS, nie ciągła emisja: wystrzel() dodaje N cząstek
 * naraz, potem tylko żyją i gasną. Inaczej niż ogien.js, który emituje
 * co klatkę, dopóki trwa płomień.
 *
 * ================= RZUT PERSPEKTYWICZNY =================
 * Cząstki żyją w przestrzeni PIKSELOWEJ (x,y,z), z=0 w miejscu zaczepu.
 * `s = OGNISKO / (OGNISKO + z)` - mniejsze/UJEMNE z (bliżej) daje większe s,
 * większe z (dalej, w głąb ekranu) daje mniejsze s. OGNISKO jest ZGADNIĘTE
 * (jak każda inna stała w tej grze) i wymaga potwierdzenia z nakładki (D).
 *
 * KONWENCJA OSI Z JEST WSPÓLNA Z js/podmuch.js: z rośnie W GŁĄB ekranu,
 * ujemne z jest BLIŻEJ gracza/kamery. `podmuch.js` musi budować `kierunek.z`
 * zgodnie z tą konwencją (rosnąca dłoń = ruch ku kamerze = ujemne z) -
 * niezgodność między tymi dwoma plikami sprawiała wcześniej, że pchnięcie
 * w stronę kamery wizualnie leciało w głąb ekranu.
 *
 * Rzut skaluje NIE TYLKO rozmiar/alfę sprite'a, ale i POZYCJĘ na ekranie
 * (patrz rzutujPozycje): dalsze cząstki są ściągane bliżej zaczepu, dając
 * prawdziwą zbieżność perspektywiczną, a nie tylko kurczenie się w miejscu.
 *
 * ================= DLACZEGO WYGLĄDA JAK FALA UDERZENIOWA =================
 * Pierwsza wersja emitowała WĄSKI STOŻEK wzdłuż kierunku i wyglądała biednie:
 * rzadka smuga kropek lecąca w bok, bez ciężaru. Aard z Wiedźmina czyta się
 * jako ŚCIANA POWIETRZA, i biorą się na to cztery rzeczy:
 *
 * 1. PIERŚCIEŃ, NIE STOŻEK. Cząstki startują na OKRĘGU prostopadłym do
 *    kierunku (promień rośnie z czasem), a nie w punkcie. To jest sedno -
 *    fala ma czoło o określonym kształcie, które się rozszerza, zamiast
 *    być chmurką rozlatującą się z jednego miejsca.
 * 2. CZOŁO ZWALNIA, PIERŚCIEŃ ROŚNIE. Ruch do przodu jest silnie tłumiony
 *    (OPOR_WZDLUZ), a rozszerzanie na boki prawie wcale (OPOR_PROMIEN) -
 *    dzięki temu fala wytraca pęd, ale nie przestaje się rozchodzić.
 * 3. ROZBŁYSK RDZENIA. Osobna, krótka warstwa jasnych cząstek w punkcie
 *    zaczepu (`rdzen: true`), gasnąca ~3x szybciej niż sama fala. Bez niej
 *    brakuje momentu uderzenia - fala po prostu "pojawia się".
 * 4. WARSTWY O RÓŻNYM PROMIENIU. Cząstki dostają losowy mnożnik promienia
 *    (0.55..1.0), więc czoło ma GRUBOŚĆ zamiast być nieskończenie cienką
 *    obręczą - to daje wrażenie objętości.
 *
 * Plus dwie rzeczy wspólne z ogniem: SPRITE WYPALONY RAZ (gradient na
 * cząstkę na klatkę zabija FPS) i SORTOWANIE PO Z (dalsze pod bliższymi).
 *
 * ================= AARD v2: TWARDE CZOŁO, SMUGI, WIR =================
 * Same cząstki-plamki dawały czoło MIĘKKIE - chmurę bez krawędzi. Aard
 * z Wiedźmina ma krawędź. Trzy warstwy dołożone NAD cząstkami:
 *
 * 1. KRESKA CZOŁA - proceduralna, nie sprite. Zewnętrzna krawędź pierścienia
 *    (punktyCzola, ten sam rzut co cząstki) rysowana stroke'iem: szeroki
 *    miękki ślad pod spodem i cienka jasna linia na wierzchu. Lekcja
 *    z Okadzenia: dla efektu, który ma KSZTAŁT, kreska po węzłach czyta się
 *    lepiej niż dowolna liczba sprite'ów. Gaśnie szybciej niż cząstki -
 *    krawędź ma być ostra w chwili uderzenia, potem rozmyć się w chmurę.
 * 2. SMUGI WIATRU - kilka półksiężyców zamachu (assety.js smugaWiatru,
 *    tintowane barwą fali) rozstawionych po obwodzie czoła, STYCZNIE, wypukłą
 *    stroną na zewnątrz, dryfujących wzdłuż obwodu. To są "cięcia
 *    powietrza", których gradientowa plamka nie umie udać. Brak assetu
 *    (jeszcze się ładuje) = smuga się nie rysuje, nic więcej (GEMINI.md §2).
 * 3. WIR W DŁONI - jeden sprite wiru (assety.js wir) w punkcie zaczepu,
 *    obraca się i puchnie przez ćwierć sekundy. Zamienia moment "fala się
 *    pojawia" w "coś wystrzeliło z dłoni". Osobna metoda wir(), NIE część
 *    wystrzel() - main.js woła ją tylko przy Aardzie; Grom w Ziemię
 *    współdzieli falę, ale wybucha z ziemi, nie z dłoni.
 *
 * Cząstek jest przez to mniej (NA_WYSTRZAL 420 -> 260): robią za objętość,
 * kształt daje kreska i smugi.
 */
import { MANIFEST, obraz, losowyWariant, wypalTintowany } from './assety.js';

/**
 * Nastawy strojeniowe - eksportowane i MUTOWALNE, żeby tools/scena.html
 * mogło podpiąć suwaki. polozenieCzola()/rzutPerspektywiczny() czytają
 * NASTAWY.* na żywo - jedna prawda dla suwaków i formy zamkniętej (patrz
 * nagłówek polozenieCzola). Po zmianie SPRITE_PX/BARWA_RDZEN wywołaj
 * wyczyscCache() (sprite'y wypalone raz).
 */
export const NASTAWY = {
    OGNISKO: 900,      // px - ZGADNIĘTE, stroić klawiszem D

    SPRITE_PX: 64,              // większy niż w ogniu - fala to ściana, nie iskry
    // BARWA JEST PARAMETREM wystrzel(), NIE STAŁĄ - Fala jest współdzielona
    // między Aardem (Stribog) i Gromem w Ziemię (Weles), i oba muszą się dać
    // odróżnić na pierwszy rzut oka. BARWA_DOMYSLNA to dawna jedyna barwa
    // (blady błękit Aarda) - zostaje jako fallback, gdy wystrzel() dostanie
    // argument pominięty albo nieprawidłowy.
    BARWA_DOMYSLNA: [214, 240, 255],     // blady błękit - patrz efekty.js (aard)
    BARWA_RDZEN: [255, 255, 255],  // rozbłysk uderzenia - czysta biel, WSPÓLNA dla wszystkich barw

    // --- czoło fali ---
    NA_WYSTRZAL: 260,           // cząstek przy pełnej sile (jednorazowo) - było 420, patrz nagłówek "AARD v2"
    PREDKOSC_BAZOWA: 900,       // px/s wzdłuż kierunku, przy pełnej sile
    ROZRZUT_PREDKOSCI: 260,     // px/s losowego rozrzutu, PRZY PEŁNEJ SILE
    PROMIEN_START: 26,          // px - czoło ma szerokość już w chwili emisji
    PROMIEN_PREDKOSC: 720,      // px/s rozszerzania pierścienia
    GRUBOSC_MIN: 0.55,          // mnożnik promienia - czoło ma GRUBOŚĆ
    OPOR_WZDLUZ: 2.4,           // 1/s - ruch do przodu wytraca się szybko
    OPOR_PROMIEN: 0.35,         // 1/s - ale rozchodzenie się trwa
    ZYCIE_MIN: 0.75, ZYCIE_MAX: 1.15,    // s
    ROZMIAR_OD: 0.9, ROZMIAR_DO: 2.2,    // cząstki PUCHNĄ z wiekiem

    // --- rozbłysk rdzenia (moment uderzenia) ---
    RDZEN_NA_WYSTRZAL: 90,
    RDZEN_PREDKOSC: 420,        // px/s - rozlatuje się na wszystkie strony
    RDZEN_ZYCIE: 0.32,          // s - gaśnie ~3x szybciej niż fala
    RDZEN_ROZMIAR: 1.5,

    MAX_CZASTECZEK: 900,        // sufit bezpieczeństwa dla klatkażu

    // --- czoło: kreska + smugi wiatru (Aard v2) ---
    CZOLO_ZYCIE: 0.7,           // s - krócej niż cząstki: krawędź ostra na starcie, potem chmura
    KRESKA_PUNKTOW: 72,
    KRESKA_SZEROKA_PX: 14,      // miękki ślad pod cienką linią
    KRESKA_CIENKA_PX: 2.5,
    SMUG_NA_CZOLO: 8,
    SMUGA_ROZMIAR: 0.62,        // ułamek promienia czoła - długość półksiężyca
    SMUGA_DRYF_MAX: 0.9,        // rad/s - smugi ślizgają się po obwodzie
    SMUGA_SPRITE_PX: 160,
    MAX_CZOL: 6,
    GRUBOSC_PCHNIECIA: 0.35,    // ułamek promienia czoła, w którym fala pcha dym
    PCHNIECIE_R_MIN_PX: 24,     // px ekranu - tuż po wystrzale czoło jest małe, ale ma pchać

    // --- wir w dłoni (Aard v2) ---
    WIR_ZYCIE: 0.28,            // s
    WIR_ROZMIAR_OD: 70, WIR_ROZMIAR_DO: 300,   // px przy pełnej sile
    WIR_OBROTY: 1.4,            // pełnych obrotów przez całe życie
    WIR_SPRITE_PX: 256,
    MAX_WIROW: 3,
};

// Snapshot dla importujących { OGNISKO } (dziś tylko tools/test-fala.mjs) -
// NIE jest live: zmiana NASTAWY.OGNISKO w locie (stanowisko) nie zaktualizuje
// tego eksportu, ale rzutPerspektywiczny() poniżej czyta NASTAWY.OGNISKO na
// żywo przez domyślny parametr, więc gra i tak reaguje na suwak.
export const OGNISKO = NASTAWY.OGNISKO;

/**
 * Rzut perspektywiczny: mniejsze/ujemne z (bliżej kamery) -> większe s.
 *
 * KLAMROWANE OD DOŁU: z ucieczką w -OGNISKO (cząstka "za kamerą") mianownik
 * dążyłby do zera i s eksplodowałoby - stąd dolna granica na z. Przy
 * `zc_min = -ognisko*0.6` daje to `s_max = 1/0.4 = 2.5` - to i tak jest
 * jedyna górna granica na s, więc osobny klamr na s byłby martwy kod.
 */
export function rzutPerspektywiczny(z, ognisko = NASTAWY.OGNISKO) {
    const zc = Number.isFinite(z) ? Math.max(z, -ognisko * 0.6) : 0;
    return ognisko / (ognisko + zc);
}

/**
 * Rzutuje pozycję cząstki na ekran: przy s→0 (daleko) zbiega do `zaczep`,
 * przy s→1 (blisko/w miejscu emisji) zostaje przy prawdziwej pozycji.
 *
 * Wydzielona jako czysta funkcja - bez niej test nie mógłby sprawdzić
 * matematyki rzutu (_rysuj tworzy sprite przez document.createElement,
 * którego nie ma w Node).
 */
export function rzutujPozycje(zaczep, pozycja, s) {
    return {
        x: zaczep.x + (pozycja.x - zaczep.x) * s,
        y: zaczep.y + (pozycja.y - zaczep.y) * s
    };
}

function krzyz(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function normalizuj(v) {
    const d = Math.hypot(v.x, v.y, v.z);
    return d > 1e-9 ? { x: v.x / d, y: v.y / d, z: v.z / d } : { x: 1, y: 0, z: 0 };
}
/** Dwa jednostkowe wektory prostopadłe do `os` i do siebie - płaszczyzna pierścienia. */
function prostopadleDo(os) {
    const pom = Math.abs(os.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const p1 = normalizuj(krzyz(os, pom));
    const p2 = krzyz(os, p1);   // już znormalizowany: os i p1 są jednostkowe i prostopadłe
    return [p1, p2];
}

/**
 * ANALITYCZNA kinematyka czoła fali: gdzie (średnio) jest pierścień po
 * czasie t od wystrzału o sile s. To zamknięta postać tego, co _ruszaj()
 * liczy cząstka po cząstce (tłumienie wykładnicze, patrz OPOR_*), przy
 * warstwa=1 i bez losowego rozrzutu - czyli ZEWNĘTRZNA krawędź czoła.
 *
 * JEDNO ŹRÓDŁO PRAWDY dla wszystkiego, co ma "jechać razem z falą", a nie
 * jest cząstką: soczewka refrakcyjna w ekran.js i kreska czoła niżej.
 * KIERUNEK ZALEŻNOŚCI JEST NOŚNY: ekran.js importuje fala.js, więc fala.js
 * NIE MOŻE importować ekran.js (cykl modułów ES) - geometria zostaje liściem.
 * Gdyby każdy z tych efektów miał własne stałe, po pierwszej zmianie
 * strojenia rozjechałyby się z cząstkami. Czysta funkcja - testowana
 * w tools/test-fala.mjs względem symulacji.
 *
 * @param {number} sila 0..1
 * @param {number} t    s od wystrzału
 * @returns {{wzdluz:number, promien:number}}  px: przesunięcie wzdłuż kierunku i promień pierścienia
 */
export function polozenieCzola(sila, t) {
    const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
    const tt = Number.isFinite(t) ? Math.max(0, t) : 0;
    // Całka z v0*exp(-k*t) = v0*(1-exp(-k*t))/k - droga przy tłumieniu wykładniczym.
    const wzdluz = NASTAWY.PREDKOSC_BAZOWA * s * (1 - Math.exp(-NASTAWY.OPOR_WZDLUZ * tt)) / NASTAWY.OPOR_WZDLUZ;
    const promien = NASTAWY.PROMIEN_START + NASTAWY.PROMIEN_PREDKOSC * s * (1 - Math.exp(-NASTAWY.OPOR_PROMIEN * tt)) / NASTAWY.OPOR_PROMIEN;
    return { wzdluz, promien };
}

/**
 * Wspólna geometria czoła dla punktyCzola()/punktCzolaPodKatem(): oś, baza
 * płaszczyzny pierścienia, środek 3D i rzutowany, promień. Null, gdy
 * zaczep/kierunek są nieprawidłowe.
 */
function geometriaCzola(zaczep, kierunek, sila, t, mnoznikPromienia) {
    if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y) || !kierunek) return null;
    const dl = Math.hypot(kierunek.x, kierunek.y, kierunek.z);
    if (!(dl > 1e-6)) return null;
    const os = { x: kierunek.x / dl, y: kierunek.y / dl, z: kierunek.z / dl };
    const { wzdluz, promien } = polozenieCzola(sila, t);
    const r = promien * (Number.isFinite(mnoznikPromienia) ? Math.max(0, mnoznikPromienia) : 1);
    const [p1, p2] = prostopadleDo(os);
    const cx = zaczep.x + os.x * wzdluz, cy = zaczep.y + os.y * wzdluz, cz = os.z * wzdluz;
    const srodek = rzutujPozycje(zaczep, { x: cx, y: cy }, rzutPerspektywiczny(cz));
    return { p1, p2, cx, cy, cz, r, srodek };
}

function rzutPunktuCzola(zaczep, g, kat) {
    const c = Math.cos(kat), sn = Math.sin(kat);
    const x = g.cx + (g.p1.x * c + g.p2.x * sn) * g.r;
    const y = g.cy + (g.p1.y * c + g.p2.y * sn) * g.r;
    const z = g.cz + (g.p1.z * c + g.p2.z * sn) * g.r;
    return rzutujPozycje(zaczep, { x, y }, rzutPerspektywiczny(z));
}

/**
 * Rzut pierścienia czoła na ekran: n punktów (w px płótna) po obwodzie
 * plus rzutowany środek. Ta sama geometria i ten sam rzut perspektywiczny,
 * co przy cząstkach (pierścień prostopadły do `kierunek`, przesunięty
 * wzdłuż niego, każdy punkt przez rzutPerspektywiczny/rzutujPozycje) -
 * dzięki temu soczewka (ekran.js) i kreska leżą DOKŁADNIE na czole cząstek.
 *
 * @param {{x,y}} zaczep     px płótna
 * @param {{x,y,z}} kierunek  wektor 3D, nie musi być jednostkowy
 * @param {number} sila       0..1
 * @param {number} t          s od wystrzału
 * @param {number} [n]        liczba punktów po obwodzie
 * @param {number} [mnoznikPromienia]  1 = zewnętrzna krawędź; <1 = wewnętrzna (grubość soczewki)
 * @returns {{srodek:{x,y}, punkty:{x,y}[]}}  punkty puste, gdy kierunek/zaczep są nieprawidłowe
 */
export function punktyCzola(zaczep, kierunek, sila, t, n = 48, mnoznikPromienia = 1) {
    const g = geometriaCzola(zaczep, kierunek, sila, t, mnoznikPromienia);
    if (!g) return { srodek: { x: zaczep?.x ?? 0, y: zaczep?.y ?? 0 }, punkty: [] };
    const punkty = [];
    const liczba = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    for (let i = 0; i < liczba; i++) punkty.push(rzutPunktuCzola(zaczep, g, (i / liczba) * Math.PI * 2));
    return { srodek: g.srodek, punkty };
}

/**
 * Jeden punkt czoła pod zadanym kątem po obwodzie (dla smug wiatru, które
 * mają WŁASNY, dryfujący kąt - nie siatkę z punktyCzola). Null przy złych
 * argumentach.
 */
export function punktCzolaPodKatem(zaczep, kierunek, sila, t, mnoznikPromienia, kat) {
    const g = geometriaCzola(zaczep, kierunek, sila, t, mnoznikPromienia);
    if (!g || !Number.isFinite(kat)) return null;
    return { srodek: g.srodek, punkt: rzutPunktuCzola(zaczep, g, kat) };
}

/**
 * Czoło fali jako lista PUNKTÓW Z PRĘDKOŚCIĄ na ekranie - wejście dla
 * dym.pchnij() (Aard rozdmuchuje dym Okadzenia). Prędkość każdego punktu to
 * różnica skończona jego rzutowanej pozycji między t-dt a t, więc obejmuje
 * rozszerzanie pierścienia, ruch wzdłuż kierunku I perspektywę: fala w
 * kamerę rośnie na ekranie i pcha promieniście od środka, fala w głąb
 * ekranu kurczy się. `r` to grubość czoła W PIKSELACH EKRANU (odległość
 * zewnętrznej krawędzi od wewnętrznej pod tym samym kątem), nie stała.
 *
 * dym.js NIE importuje fala.js (geometria zostaje liściem) - main.js
 * mapuje fala.czola przez tę funkcję i podaje wynik do dym.pchnij(),
 * tym samym wzorcem PULL co zarzewia dla dym.podpal().
 *
 * @param {{x,y}} zaczep      px płótna
 * @param {{x,y,z}} kierunek  wektor 3D
 * @param {number} sila       0..1
 * @param {number} t          s od wystrzału
 * @param {number} dt         s - krok, z którego liczona jest prędkość
 * @param {number} [n]        punktów po obwodzie
 * @returns {{x:number,y:number,vx:number,vy:number,r:number,sila:number}[]}  pusta lista przy złych argumentach
 */
export function pchniecieCzola(zaczep, kierunek, sila, t, dt, n = 24) {
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(t)) return [];
    // Przy t < dt cofamy okno do przodu (różnica w przód), żeby pierwsza
    // klatka po wystrzale też dawała prędkość, a nie dzielenie ujemnego czasu.
    const tA = Math.max(0, t - dt), tB = tA + dt;
    const teraz = punktyCzola(zaczep, kierunek, sila, tB, n, 1);
    const przed = punktyCzola(zaczep, kierunek, sila, tA, n, 1);
    const wewn = punktyCzola(zaczep, kierunek, sila, tB, n, 1 - NASTAWY.GRUBOSC_PCHNIECIA);
    if (!teraz.punkty.length || przed.punkty.length !== teraz.punkty.length) return [];
    const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
    const out = [];
    for (let i = 0; i < teraz.punkty.length; i++) {
        const a = przed.punkty[i], b = teraz.punkty[i], w = wewn.punkty[i];
        const r = Math.max(NASTAWY.PCHNIECIE_R_MIN_PX, Math.hypot(b.x - w.x, b.y - w.y));
        out.push({ x: b.x, y: b.y, vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt, r, sila: s });
    }
    return out;
}

export class Fala {
    constructor() {
        this.czastki = [];
        // Sprite'y RDZENIA są zawsze białe, więc jeden wystarcza. Sprite'y
        // CZOŁA FALI zależą od barwy przekazanej do wystrzel() - Mapa
        // kluczowana stringiem "r,g,b", budowana LENIWIE w _rysuj() (nie tu -
        // document.createElement nie istnieje w Node, patrz tools/test-fala.mjs).
        this._spriteRdzen = null;
        this._spriteFala = new Map();
        // Aard v2: czoła (kreska + smugi) i wiry - osobne od cząstek, bo
        // żyją innym rytmem i nie są "cząstkami" w sensie _ruszaj/_rysuj.
        this.czola = [];
        this.wiry = [];
        this.odrzucone = 0;   // licznik cząstek odrzuconych przez sufit MAX_CZASTECZEK - panel kontroli tools/scena.html
    }

    get liczba() { return this.czastki.length; }

    /** Wywołać po zmianie NASTAWY.SPRITE_PX/BARWA_RDZEN - stare sprite'y zostały wypalone ze starymi wartościami. */
    wyczyscCache() { this._spriteRdzen = null; this._spriteFala.clear(); }

    /**
     * Wir w dłoni w chwili rzutu - patrz nagłówek "AARD v2". Wołany przez
     * main.js OBOK wystrzel(), tylko dla Aarda.
     *
     * @param {{x,y}} zaczep  px płótna
     * @param {number} sila   0..1
     * @param {[number,number,number]} [barwa]
     */
    wir(zaczep, sila, barwa = NASTAWY.BARWA_DOMYSLNA) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;
        const b = (Array.isArray(barwa) && barwa.length === 3 && barwa.every(Number.isFinite))
            ? barwa : NASTAWY.BARWA_DOMYSLNA;
        if (this.wiry.length >= NASTAWY.MAX_WIROW) this.wiry.shift();
        this.wiry.push({
            zaczep: { x: zaczep.x, y: zaczep.y }, sila: s, barwa: b, wiek: 0,
            // Losowy zwrot obrotu - dwa rzuty pod rząd nie mają wyglądać identycznie.
            zwrot: Math.random() < 0.5 ? -1 : 1,
            kat0: Math.random() * Math.PI * 2
        });
    }

    /**
     * @param {{x,y}} zaczep  źródło w PIKSELACH płótna
     * @param {{x,y,z}} kierunek  wektor 3D (nie musi być jednostkowy)
     * @param {number} sila  0..1
     * @param {[number,number,number]} [barwa]  RGB czoła fali; domyślnie blady błękit Aarda
     */
    wystrzel(zaczep, kierunek, sila, barwa = NASTAWY.BARWA_DOMYSLNA) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        if (!kierunek) return;
        const dl = Math.hypot(kierunek.x, kierunek.y, kierunek.z);
        if (!(dl > 1e-6)) return;
        const os = { x: kierunek.x / dl, y: kierunek.y / dl, z: kierunek.z / dl };
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;

        // Barwa nieprawidłowa (spoza kontraktu) -> fallback, NIE wyjątek -
        // ten sam wzorzec odporności co przy zaczepie/kierunku/sile wyżej.
        const b = (Array.isArray(barwa) && barwa.length === 3 && barwa.every(Number.isFinite))
            ? barwa : NASTAWY.BARWA_DOMYSLNA;

        const [p1, p2] = prostopadleDo(os);

        // --- CZOŁO v2: kreska + smugi (nagłówek "AARD v2") ---
        if (this.czola.length >= NASTAWY.MAX_CZOL) this.czola.shift();
        const smugi = [];
        for (let i = 0; i < NASTAWY.SMUG_NA_CZOLO; i++) {
            smugi.push({
                kat: (i / NASTAWY.SMUG_NA_CZOLO) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
                dryf: (Math.random() - 0.5) * 2 * NASTAWY.SMUGA_DRYF_MAX,
                promien: 0.86 + Math.random() * 0.14,   // tuż pod zewnętrzną krawędzią
                skala: 0.8 + Math.random() * 0.5,
                // Obraz wybrany RAZ (nie co klatkę - losowanie per klatka migałoby).
                // null, gdy asset jeszcze się ładuje - _rysuj spróbuje raz jeszcze.
                obraz: losowyWariant(MANIFEST.smugaWiatru)
            });
        }
        this.czola.push({ zaczep: { x: zaczep.x, y: zaczep.y }, kierunek: os, sila: s, barwa: b, wiek: 0, smugi });

        // --- CZOŁO FALI: pierścień prostopadły do kierunku ---
        const n = Math.round(NASTAWY.NA_WYSTRZAL * (0.4 + 0.6 * s));
        for (let i = 0; i < n; i++) {
            // Kąt rozłożony RÓWNOMIERNIE po obwodzie plus drobny jitter -
            // czysto losowy kąt zostawiałby widoczne dziury w pierścieniu.
            const kat = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
            // Mnożnik promienia daje czołu GRUBOŚĆ zamiast cienkiej obręczy.
            const warstwa = NASTAWY.GRUBOSC_MIN + Math.random() * (1 - NASTAWY.GRUBOSC_MIN);
            // Wektor "na zewnątrz" w płaszczyźnie pierścienia.
            const promX = p1.x * Math.cos(kat) + p2.x * Math.sin(kat);
            const promY = p1.y * Math.cos(kat) + p2.y * Math.sin(kat);
            const promZ = p1.z * Math.cos(kat) + p2.z * Math.sin(kat);

            const predkosc = (NASTAWY.PREDKOSC_BAZOWA * s) * (0.8 + Math.random() * 0.4)
                            + (Math.random() - 0.5) * NASTAWY.ROZRZUT_PREDKOSCI * s;
            const vProm = NASTAWY.PROMIEN_PREDKOSC * warstwa * (0.75 + Math.random() * 0.5) * s;

            this._dodaj({
                // Start NA pierścieniu, nie w punkcie - fala ma czoło od razu.
                x: zaczep.x + promX * NASTAWY.PROMIEN_START * warstwa,
                y: zaczep.y + promY * NASTAWY.PROMIEN_START * warstwa,
                z: promZ * NASTAWY.PROMIEN_START * warstwa,
                zx0: zaczep.x, zy0: zaczep.y,
                // Prędkość = ruch DO PRZODU + rozchodzenie się NA ZEWNĄTRZ.
                // Rozdzielone, bo tłumią się z różną siłą (patrz _ruszaj).
                vx: os.x * predkosc, vy: os.y * predkosc, vz: os.z * predkosc,
                vpx: promX * vProm, vpy: promY * vProm, vpz: promZ * vProm,
                zycie: NASTAWY.ZYCIE_MIN + Math.random() * (NASTAWY.ZYCIE_MAX - NASTAWY.ZYCIE_MIN),
                skala: NASTAWY.ROZMIAR_OD + Math.random() * (NASTAWY.ROZMIAR_DO - NASTAWY.ROZMIAR_OD),
                wiek: 0,
                rdzen: false,
                barwa: b
            });
        }

        // --- ROZBŁYSK RDZENIA: moment uderzenia w punkcie zaczepu ---
        const nr = Math.round(NASTAWY.RDZEN_NA_WYSTRZAL * (0.4 + 0.6 * s));
        for (let i = 0; i < nr; i++) {
            // Kierunek losowy na pełnej sferze - rozbłysk nie ma kształtu,
            // ma być błyskiem, nie falą.
            const u = Math.random() * 2 - 1;
            const fi = Math.random() * Math.PI * 2;
            const r = Math.sqrt(1 - u * u);
            const dir = { x: r * Math.cos(fi), y: r * Math.sin(fi), z: u };
            const predkosc = NASTAWY.RDZEN_PREDKOSC * s * (0.4 + Math.random() * 0.9);
            this._dodaj({
                x: zaczep.x, y: zaczep.y, z: 0,
                zx0: zaczep.x, zy0: zaczep.y,
                vx: dir.x * predkosc, vy: dir.y * predkosc, vz: dir.z * predkosc,
                vpx: 0, vpy: 0, vpz: 0,
                zycie: NASTAWY.RDZEN_ZYCIE * (0.7 + Math.random() * 0.6),
                skala: NASTAWY.RDZEN_ROZMIAR * (0.6 + Math.random() * 0.8),
                wiek: 0,
                rdzen: true
            });
        }
    }

    _dodaj(cz) {
        if (this.czastki.length >= NASTAWY.MAX_CZASTECZEK) { this.odrzucone++; return; }
        this.czastki.push(cz);
    }

    _ruszaj(dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        if (krok <= 0) return;

        // Czoła i wiry: tylko zegar, geometria liczy się w chwili rysowania
        // z polozenieCzola/punktyCzola (jedno źródło prawdy z soczewką w ekran.js).
        for (const c of this.czola) {
            c.wiek += krok;
            for (const m of c.smugi) m.kat += m.dryf * krok;
        }
        this.czola = this.czola.filter(c => c.wiek < NASTAWY.CZOLO_ZYCIE);
        for (const w of this.wiry) w.wiek += krok;
        this.wiry = this.wiry.filter(w => w.wiek < NASTAWY.WIR_ZYCIE);

        const zywe = [];
        for (const c of this.czastki) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;

            // DWA RÓŻNE TŁUMIENIA - to one dają kształt fali uderzeniowej:
            // czoło wytraca pęd do przodu, ale nie przestaje się rozchodzić.
            const oporWzdluz = 1 - NASTAWY.OPOR_WZDLUZ * krok;
            const oporProm = 1 - NASTAWY.OPOR_PROMIEN * krok;
            c.vx *= oporWzdluz; c.vy *= oporWzdluz; c.vz *= oporWzdluz;
            c.vpx *= oporProm; c.vpy *= oporProm; c.vpz *= oporProm;

            c.x += (c.vx + c.vpx) * krok;
            c.y += (c.vy + c.vpy) * krok;
            c.z += (c.vz + c.vpz) * krok;

            if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)) zywe.push(c);
        }
        this.czastki = zywe;
    }

    /** Sprite czoła fali dla danej barwy - budowany raz, potem z Mapy. */
    _spriteDlaBarwy(b) {
        const klucz = `${b[0]},${b[1]},${b[2]}`;
        let s = this._spriteFala.get(klucz);
        if (!s) { s = sprite(b, 0.85); this._spriteFala.set(klucz, s); }
        return s;
    }

    _rysuj(ctx) {
        this._rysujCzastki(ctx);
        this._rysujCzola(ctx);
        this._rysujWiry(ctx);
    }

    /** Kreska czoła + smugi wiatru - NAD cząstkami (krawędź ma być czytelna). */
    _rysujCzola(ctx) {
        if (!this.czola.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const c of this.czola) {
            const p = c.wiek / NASTAWY.CZOLO_ZYCIE;
            const gasniecie = Math.pow(1 - p, 1.5);
            const { srodek, punkty } = punktyCzola(c.zaczep, c.kierunek, c.sila, c.wiek, NASTAWY.KRESKA_PUNKTOW, 1);
            if (punkty.length < 3) continue;
            const [r, g, b] = c.barwa;

            // --- smugi wiatru: POD kreską, żeby krawędź została najjaśniejsza ---
            const promienNominalny = polozenieCzola(c.sila, c.wiek).promien;
            for (const m of c.smugi) {
                if (!m.obraz) m.obraz = losowyWariant(MANIFEST.smugaWiatru);   // asset mógł doładować się w locie
                if (!m.obraz) continue;
                // Punkt na obwodzie pod kątem smugi - ten sam rzut co kreska,
                // więc smuga siedzi na czole także przy rzucie w bok.
                const pc = punktCzolaPodKatem(c.zaczep, c.kierunek, c.sila, c.wiek, m.promien, m.kat);
                if (!pc) continue;
                const pkt = pc.punkt;
                const naZewn = { x: pkt.x - srodek.x, y: pkt.y - srodek.y };
                const odl = Math.hypot(naZewn.x, naZewn.y);
                if (odl < 1e-3) continue;
                // Rozmiar w px EKRANU: odległość rzutowana / nominalna = skala
                // perspektywy w tym punkcie (bliższy brzeg czoła = większa smuga).
                const rozmiar = promienNominalny * NASTAWY.SMUGA_ROZMIAR * m.skala
                              * (odl / Math.max(1, promienNominalny * m.promien));
                if (rozmiar < 4) continue;
                // Sprite: półksiężyc wypukły w +y obrazu -> +y ma wskazywać NA ZEWNĄTRZ.
                // LUSTRO (CSS scaleX(-1), GEMINI.md §4) NIE psuje tego: odbicie
                // odbija środek, punkt i sprite RAZEM, więc "wypukłością od
                // środka" zostaje prawdą po obu stronach. Półksiężyc nie ma
                // strony "właściwej" jak glif w runa.js - nie odkręcamy lustra.
                const kat = Math.atan2(naZewn.y, naZewn.x) - Math.PI / 2;
                const spr = wypalTintowany(m.obraz, c.barwa, NASTAWY.SMUGA_SPRITE_PX);
                // save/restore per sprite (idiom z runa.js), nie rotate(-kat):
                // odwracanie transformacji dryfuje numerycznie po 8 smugach x N klatek.
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, 0.85 * gasniecie * c.sila));
                ctx.translate(pkt.x, pkt.y);
                ctx.rotate(kat);
                ctx.drawImage(spr, -rozmiar / 2, -rozmiar / 2, rozmiar, rozmiar);
                ctx.restore();
            }

            // --- kreska: szeroki miękki ślad + cienka jasna linia ---
            ctx.beginPath();
            ctx.moveTo(punkty[0].x, punkty[0].y);
            for (let i = 1; i < punkty.length; i++) ctx.lineTo(punkty[i].x, punkty[i].y);
            ctx.closePath();
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            ctx.lineWidth = NASTAWY.KRESKA_SZEROKA_PX * (1 - 0.5 * p);
            ctx.globalAlpha = 0.28 * gasniecie * c.sila;
            ctx.stroke();
            ctx.strokeStyle = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`;
            ctx.lineWidth = NASTAWY.KRESKA_CIENKA_PX;
            ctx.globalAlpha = 0.95 * gasniecie * c.sila;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    /** Wir w dłoni - obrót + puchnięcie, najkrótsza warstwa całego efektu. */
    _rysujWiry(ctx) {
        if (!this.wiry.length) return;
        const img = obraz(MANIFEST.wir);
        if (!img) return;   // asset jeszcze się ładuje - warstwa po prostu nie rysuje się (GEMINI.md §2)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const w of this.wiry) {
            const p = w.wiek / NASTAWY.WIR_ZYCIE;
            const wyjscie = 1 - Math.pow(1 - p, 3);   // ease-out: szybki start, dobieg
            const rozmiar = (NASTAWY.WIR_ROZMIAR_OD + (NASTAWY.WIR_ROZMIAR_DO - NASTAWY.WIR_ROZMIAR_OD) * wyjscie) * (0.5 + 0.5 * w.sila);
            const kat = w.kat0 + w.zwrot * NASTAWY.WIR_OBROTY * Math.PI * 2 * wyjscie;
            const spr = wypalTintowany(img, w.barwa, NASTAWY.WIR_SPRITE_PX);
            // Wir jest CHIRALNY - lustro (CSS scaleX(-1)) odwraca zwrot
            // spirali. Zwrot obrotu i tak losujemy (`zwrot`), więc żaden
            // z dwóch nie jest "zły" - decyzja świadoma, lustra nie odkręcamy.
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, (1 - p) * (0.6 + 0.4 * w.sila)));
            ctx.translate(w.zaczep.x, w.zaczep.y);
            ctx.rotate(kat);
            ctx.drawImage(spr, -rozmiar / 2, -rozmiar / 2, rozmiar, rozmiar);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _rysujCzastki(ctx) {
        if (!this.czastki.length) return;
        if (!this._spriteRdzen) this._spriteRdzen = sprite(NASTAWY.BARWA_RDZEN, 1.0);

        // DALSZE POD BLIŻSZYMI: sortujemy W MIEJSCU malejąco po z (kolejność
        // w this.czastki nie ma znaczenia dla niczego innego, więc kopiowanie
        // tablicy co klatkę byłoby niepotrzebne) - cząstki z najmniejszym z
        // (najbliższe) rysują się na końcu, na wierzchu.
        this.czastki.sort((a, b) => b.z - a.z);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const c of this.czastki) {
            const p = c.wiek / c.zycie;
            const s = rzutPerspektywiczny(c.z);
            // Szybki narost, powolne wygaszanie - ten sam kształt obwiedni
            // co w ogien.js, żeby cząstki nie pojawiały się skokowo.
            const alfa = Math.sin(Math.min(1, p * 6) * Math.PI * 0.5) * (1 - p) * (1 - p);
            // Cząstki czoła PUCHNĄ z wiekiem (fala się rozrzedza); rdzeń nie -
            // ma być ostrym błyskiem, nie rozmywającą się chmurą.
            const rosniecie = c.rdzen ? 1 : (0.6 + 0.8 * p);
            const r = NASTAWY.SPRITE_PX * c.skala * s * rosniecie;
            const poz = rzutujPozycje({ x: c.zx0, y: c.zy0 }, { x: c.x, y: c.y }, s);

            ctx.globalAlpha = Math.max(0, Math.min(1, alfa * s * (c.rdzen ? 1 : 0.7)));
            ctx.drawImage(c.rdzen ? this._spriteRdzen : this._spriteDlaBarwy(c.barwa),
                          poz.x - r / 2, poz.y - r / 2, r, r);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    /** @param {CanvasRenderingContext2D} ctx  @param {number} dt */
    updateAndDraw(ctx, dt) {
        this._ruszaj(dt);
        this._rysuj(ctx);
    }
}

/** Sprite wypalony RAZ na barwę - patrz ogien.js:215-236 dla tego samego wzorca. */
function sprite([r, g, b], moc) {
    const c = document.createElement('canvas');
    c.width = c.height = NASTAWY.SPRITE_PX;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2, 0,
                                       NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2);
    grd.addColorStop(0.0, `rgba(${r},${g},${b},${moc})`);
    grd.addColorStop(0.35, `rgba(${r},${g},${b},${moc * 0.45})`);
    grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, NASTAWY.SPRITE_PX, NASTAWY.SPRITE_PX);
    return c;
}
