/**
 * Piorun - prawdziwy, kanciasty błysk bijący z góry ekranu w zaczep, zamiast
 * kolejnej miękkiej plamy światła.
 *
 * DIAGNOZA, KTÓRA UZASADNIA TEN PLIK: zapłon sylwetki (zaplon.js), wstrząs
 * ekranu (ekran.js), aura, fala i iskry - wszystkie to gradienty blendowane
 * przez 'lighter'. Sześć takich warstw naraz daje WIĘCEJ JASNOŚCI, nie
 * WIĘCEJ KSZTAŁTU - stąd gracz zgłosił "jest lepiej, ale niewiele się
 * zmieniło" mimo już wdrożonych A+B. W CAŁEJ GRZE NIE MA ŻADNEJ TWARDEJ
 * KRAWĘDZI. Ten plik to naprawia: RDZEŃ pioruna jest rysowany
 * 'source-over', w pełni nieprzezroczystą prawie-bielą - jedyne miejsce
 * w całej grze, gdzie coś jest NARYSOWANE, nie rozjarzone.
 *
 * ================== REKURENCYJNE PRZESUNIĘCIE PUNKTU ŚRODKOWEGO ==================
 * Klasyczny algorytm fraktalny (midpoint displacement), przeniesiony z
 * shaderowych przepisów na piorun (Shadertoy "FBM Lightning Bolt") na zwykłe
 * ctx.lineTo - nie wymaga WebGL. Segment dzielony na pół, punkt środkowy
 * przesunięty PROSTOPADLE do segmentu o losową wartość, potem rekurencja na
 * obu połówkach z MALEJĄCĄ amplitudą wychylenia (parametr `skala` w
 * segmentuj()) - to jest źródło charakterystycznej, samopodobnej
 * "kanciastości" prawdziwego pioruna, bez niej wyszłaby gładka krzywa.
 *
 * ================== ODGAŁĘZIENIA ==================
 * Kilka krótszych, cieńszych kopii tego samego algorytmu, startujących ze
 * ŚRODKOWEJ części głównej ścieżki (nie z końców - prawdziwe rozgałęzienia
 * nie wychodzą tuż przy uderzeniu ani tuż przy chmurze).
 *
 * ================== TRZY BŁYSKI, KAŻDY Z PLATO PEŁNEJ JASNOŚCI ==================
 * Prawdziwy piorun migocze - kilka rozbłysków, każdy z LEKKO INNYM kształtem
 * (ścieżka losowana OSOBNO na błysk, RAZ, w uderz() - nie regenerowana
 * klatka po klatce), potem krótka poświata. Patrz stanPioruna().
 *
 * PIERWSZA WERSJA MIAŁA BŁĄD: rdzeń dostawał pełną jasność tylko w JEDNEJ
 * chwili na błysk i gasł wykładniczo w ~17 ms - poniżej jednej klatki przy
 * 60 FPS, więc na żywej kamerze efekt czytał się jako "ledwie zauważalny"
 * (zgłoszenie gracza), mimo że logicznie "działał". Naprawa: rdzeń trzyma
 * PEŁNĄ jasność przez CAŁY CZAS_PELNI (plato, nie punkt), dopiero potem
 * krótka PRZERWA z przygaszoną (nie zerową) poświatą. Migotanie ma być
 * WIDOCZNYM cyklem jasno-ciemno, nie serią klatek poniżej progu percepcji.
 *
 * ================== ZERO DOM POZA RYSOWANIEM ==================
 * segmentuj()/generujPiorun()/stanPioruna() to czyste funkcje - w
 * przeciwieństwie do fala.js/iskry.js/zaplon.js, ten moduł nie potrzebuje
 * document.createElement NAWET DO SPRITE'ÓW (piorun to linie, nie plamy),
 * więc tools/test-piorun.mjs testuje więcej niż jakikolwiek inny moduł
 * efektów w tym repo - jedyna bramka na document jest w samym rysowaniu
 * (ctx.stroke), zagrodzona `if (!ctx) return`.
 */

const ITERACJE_GLOWNEJ = 6;         // 2^6+1 = 65 punktów głównej ścieżki
const CHROPOWATOSC_GLOWNEJ = 0.42;  // startowe wychylenie jako ułamek dł. odcinka
const SPADEK_CHROPOWATOSCI = 0.55;  // wychylenie MALEJE o tyle na każdą iterację

// PIERWSZA WERSJA MIAŁA BŁĄD: rdzeń dostawał pełny blask tylko na starcie
// każdego z 3 błysków i gasł w 1/3.2 okna błysku (0.16s/3 ≈ 53ms) - czyli
// PEŁNA jasność trwała ~17ms, poniżej JEDNEJ klatki przy 60 FPS. Gracz
// zgłosił "ledwie zauważalny" - to była PRZYCZYNA, nie za mało jasności czy
// za cienka linia. Poprawka: PLATO. Rdzeń trzyma PEŁNĄ jasność przez cały
// CZAS_PELNI (nie tylko w jednej chwili), dopiero potem krótka PRZERWA -
// prawdziwy błysk migawki, nie eksponencjalne gaśnięcie.
// Eksportowane (nie tylko `const`), żeby tools/test-piorun.mjs liczyło
// punkty czasowe testów Z TYCH SAMYCH stałych, zamiast duplikować magiczne
// liczby, które przy następnym strojeniu cichaczem rozjadą się z kodem.
export const LICZBA_BLYSKOW = 3;
export const CZAS_PELNI = 0.09;        // s - rdzeń w PEŁNEJ jasności (≈5-6 klatek przy 60 FPS)
export const CZAS_PRZERWY = 0.045;     // s - przygaszona przerwa między błyskami
export const T_BLYSKI = LICZBA_BLYSKOW * (CZAS_PELNI + CZAS_PRZERWY);   // s - cała faza migotania
export const T_POSWIATA = 0.35;        // s - dogasająca łuna PO migotaniu
export const T_CALKOWITY = T_BLYSKI + T_POSWIATA;   // s - migotanie + poświata

/**
 * Rekurencyjne przesunięcie punktu środkowego - czysta funkcja geometrii,
 * ZERO document. Punkty początku/końca są ZAWSZE zachowane dokładnie;
 * losowość dotyczy WYŁĄCZNIE punktów wewnętrznych.
 *
 * @param {{x,y}} p1
 * @param {{x,y}} p2
 * @param {number} iteracje  liczba podziałów (wynik ma 2^iteracje+1 punktów)
 * @param {number} chropowatosc  amplituda wychylenia jako ułamek długości odcinka
 * @returns {{x,y}[]}
 */
export function segmentuj(p1, p2, iteracje, chropowatosc) {
    const it = Number.isFinite(iteracje) ? Math.max(0, Math.round(iteracje)) : 0;
    const ch = Number.isFinite(chropowatosc) ? Math.max(0, chropowatosc) : 0;
    let punkty = [p1, p2];
    let skala = 1;
    for (let k = 0; k < it; k++) {
        const nowe = [punkty[0]];
        for (let i = 0; i < punkty.length - 1; i++) {
            const a = punkty[i], b = punkty[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dl = Math.hypot(dx, dy);
            // Wektor PROSTOPADŁY do segmentu, znormalizowany - wychylenie
            // idzie w bok, nie wzdłuż, inaczej ścieżka by się nie kanciła.
            const nx = dl > 1e-6 ? -dy / dl : 0;
            const ny = dl > 1e-6 ? dx / dl : 0;
            const wychylenie = (Math.random() * 2 - 1) * dl * ch * skala;
            nowe.push({ x: (a.x + b.x) / 2 + nx * wychylenie, y: (a.y + b.y) / 2 + ny * wychylenie });
            nowe.push(b);
        }
        punkty = nowe;
        skala *= SPADEK_CHROPOWATOSCI;
    }
    return punkty;
}

/**
 * Cała figura jednego błysku: główna ścieżka + kilka odgałęzień.
 *
 * @param {{x,y}} start  źródło (zwykle powyżej ekranu)
 * @param {{x,y}} koniec  zaczep uderzenia
 * @param {object} [opcje]
 * @returns {{glowna:{x,y}[], galezie:{x,y}[][]}}
 */
export function generujPiorun(start, koniec, opcje = {}) {
    if (!start || !koniec || ![start.x, start.y, koniec.x, koniec.y].every(Number.isFinite)) {
        return { glowna: [], galezie: [] };
    }
    const iteracje = Number.isFinite(opcje.iteracje) ? opcje.iteracje : ITERACJE_GLOWNEJ;
    const chropowatosc = Number.isFinite(opcje.chropowatosc) ? opcje.chropowatosc : CHROPOWATOSC_GLOWNEJ;
    const liczbaGalezi = Number.isFinite(opcje.liczbaGalezi) ? Math.max(0, Math.round(opcje.liczbaGalezi)) : 3;

    const glowna = segmentuj(start, koniec, iteracje, chropowatosc);
    const galezie = [];
    for (let i = 0; i < liczbaGalezi; i++) {
        // Odgałęzienie startuje ZE ŚRODKOWEJ CZĘŚCI głównej ścieżki (30-75%),
        // nigdy blisko końców - patrz nagłówek pliku.
        const idx = Math.min(glowna.length - 1, Math.floor(glowna.length * (0.3 + Math.random() * 0.45)));
        const p0 = glowna[idx];
        const dlCalej = Math.hypot(koniec.x - start.x, koniec.y - start.y);
        const dlOdnogi = dlCalej * (0.15 + Math.random() * 0.2);
        // Kąt w PRZYBLIŻENIU wzdłuż kierunku głównej ścieżki (w dół), z
        // rozrzutem ±45° - odnoga ma iść "w tę samą stronę", nie donikąd.
        const os = Math.atan2(koniec.y - start.y, koniec.x - start.x);
        const kat = os + (Math.random() * 2 - 1) * (Math.PI / 4);
        const cel = { x: p0.x + Math.cos(kat) * dlOdnogi, y: p0.y + Math.sin(kat) * dlOdnogi };
        galezie.push(segmentuj(p0, cel, Math.max(1, iteracje - 3), chropowatosc * 1.15));
    }
    return { glowna, galezie };
}

/**
 * Stan w chwili t (s od uderz()): który z LICZBA_BLYSKOW zestawów
 * wygenerowanych ścieżek pokazać, i jak jasny ma być rdzeń/poświata.
 * Czysta funkcja - testowalna bez document, ten sam wzorzec co obwiednia()
 * w zaplon.js i obwiedniaUderzenia() w ekran.js.
 *
 * @param {number} t
 * @returns {{indeks:number, rdzen:number, poswiata:number}} indeks=-1 gdy efekt się skończył
 */
export function stanPioruna(t) {
    const tt = Number.isFinite(t) ? Math.max(0, t) : Infinity;
    if (tt >= T_CALKOWITY) return { indeks: -1, rdzen: 0, poswiata: 0 };

    if (tt < T_BLYSKI) {
        const cykl = CZAS_PELNI + CZAS_PRZERWY;
        const indeks = Math.min(LICZBA_BLYSKOW - 1, Math.floor(tt / cykl));
        const lokalne = tt - indeks * cykl;   // sekundy w obrębie TEGO cyklu (pełnia+przerwa)

        if (lokalne < CZAS_PELNI) {
            // PLATO: rdzeń w PEŁNEJ jasności przez cały CZAS_PELNI, z lekkim
            // wygaszeniem tylko w OSTATNICH 20% - to jest naprawa błędu, przez
            // który pierwsza wersja świeciła pełną mocą krócej niż jedną
            // klatkę (patrz komentarz przy stałych wyżej).
            const f = lokalne / CZAS_PELNI;
            const rdzen = f > 0.8 ? Math.max(0, 1 - (f - 0.8) / 0.2) : 1;
            return { indeks, rdzen, poswiata: 1 };
        }
        // PRZERWA między błyskami: rdzeń zgaszony, poświata przygaszona,
        // ale WCIĄŻ OBECNA (nie czarna dziura między migotaniami).
        const p = (lokalne - CZAS_PELNI) / CZAS_PRZERWY;
        return { indeks, rdzen: 0, poswiata: 0.4 * (1 - p) + 0.15 };
    }

    // Faza poświaty: bez rdzenia, tylko dogasająca kolorowa łuna wzdłuż
    // ścieżki OSTATNIEGO błysku.
    const p = (tt - T_BLYSKI) / T_POSWIATA;
    return { indeks: LICZBA_BLYSKOW - 1, rdzen: 0, poswiata: (1 - p) * (1 - p) * 0.6 };
}

/** Rysuje jedną ścieżkę: kolorowa poświata (kilka przebiegów 'lighter') + twardy biały rdzeń ('source-over'). */
// Eksportowana (2026-10-02) dla js/lukPeruna.js - ten sam rdzeń source-over i ta
// sama poświata, żeby łuk czytał się jako piorun Peruna.
export function rysujSciezke(ctx, punkty, barwa, alfaRdzen, alfaPoswiata, grubosc) {
    if (punkty.length < 2) return;
    const [r, g, b] = barwa;

    if (alfaPoswiata > 0.003) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Grubsze i jaśniejsze niż pierwsza wersja - na pełnoekranowym wideo
        // 4-16px ginęło. Wartości dobrane tak, żeby poświata sama w sobie
        // była widoczna nawet BEZ rdzenia (w PRZERWIE między błyskami).
        const przebiegi = [
            { szer: 26 * grubosc, alfa: 0.16 },
            { szer: 13 * grubosc, alfa: 0.32 },
            { szer: 6 * grubosc, alfa: 0.55 }
        ];
        for (const pp of przebiegi) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${(pp.alfa * alfaPoswiata).toFixed(3)})`;
            ctx.lineWidth = pp.szer;
            ctx.beginPath();
            punkty.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
            ctx.stroke();
        }
    }

    if (alfaRdzen > 0.003) {
        // RDZEŃ: source-over, prawie biały, W PEŁNI NIEPRZEZROCZYSTY przy
        // alfaRdzen≈1 - JEDYNA warstwa w całej grze, która faktycznie
        // RYSUJE zamiast rozjarzać. Patrz nagłówek pliku.
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, alfaRdzen).toFixed(3)})`;
        // 4.5px, nie 2.2px pierwszej wersji - na pełnym płótnie wideo cienka
        // linia jest praktycznie niewidoczna nawet w pełnej jasności.
        ctx.lineWidth = 4.5 * grubosc;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        punkty.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
    }
}

export class Piorun {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._barwa = [190, 100, 255];
        this._blyski = [];   // [{glowna, galezie}] - po jednym na błysk, generowane RAZ w uderz()
    }

    get aktywny() { return this._trwa; }

    /**
     * Punkt uderzenia bieżącego błysku (koniec głównej ścieżki) - dla reakcji
     * Burza w mgle (js/reakcjeTechnik.js). null, gdy piorun nie trwa.
     */
    get punktUderzenia() {
        if (!this._trwa || !this._blyski.length) return null;
        const glowna = this._blyski[0].glowna;
        const p = glowna?.[glowna.length - 1];
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
    }

    /**
     * Uderzenie. Ścieżki WSZYSTKICH błysków generowane TERAZ, raz - patrz
     * nagłówek pliku ("nie regenerowana klatka po klatce").
     *
     * @param {{x,y}} punkt  zaczep uderzenia w PIKSELACH płótna
     * @param {[number,number,number]} [barwa]  RGB poświaty (rdzeń jest zawsze biały)
     * @param {number} [sila]  0..1
     */
    uderz(punkt, barwa, sila = 1) {
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01 || !punkt || !Number.isFinite(punkt.x) || !Number.isFinite(punkt.y)) return;
        const b = (Array.isArray(barwa) && barwa.length === 3 && barwa.every(Number.isFinite))
            ? barwa : [190, 100, 255];

        // Start POWYŻEJ ekranu (y ujemne), z losowym bocznym odchyleniem od
        // celu - naturalny piorun nie leci idealnie prosto z zenitu.
        const start = { x: punkt.x + (Math.random() * 2 - 1) * 260, y: -140 };

        this._barwa = b;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._blyski = [];
        for (let i = 0; i < LICZBA_BLYSKOW; i++) {
            this._blyski.push(generujPiorun(start, punkt, {
                chropowatosc: CHROPOWATOSC_GLOWNEJ * (0.85 + Math.random() * 0.4),
                liczbaGalezi: 2 + Math.round(Math.random() * 2)
            }));
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} dt
     */
    updateAndDraw(ctx, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;

        const stan = stanPioruna(this._t);
        if (stan.indeks < 0) { this._trwa = false; return; }
        if (!ctx) return;   // guard PO doliczeniu czasu - patrz nagłówek pliku

        const blysk = this._blyski[Math.min(stan.indeks, this._blyski.length - 1)];
        if (!blysk) return;

        ctx.save();
        rysujSciezke(ctx, blysk.glowna, this._barwa, stan.rdzen * this._sila, stan.poswiata * this._sila, 1);
        for (const galaz of blysk.galezie) {
            rysujSciezke(ctx, galaz, this._barwa, stan.rdzen * this._sila * 0.6, stan.poswiata * this._sila * 0.6, 0.55);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}
