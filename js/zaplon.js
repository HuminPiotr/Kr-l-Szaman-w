/**
 * Zapłon sylwetki - sylwetka tancerza na chwilę STAJE SIĘ efektem.
 *
 * Bierze tę samą maskę segmentacji, którą main.js już czyta dla aura.js
 * (maskaDane/maskaSzer/maskaWys) - koszt obliczeniowy jest już zapłacony,
 * żadna technika dotąd z niej nie korzystała. NIE dotyka aura.js: to
 * NIEZALEŻNA warstwa, rysowana bezpośrednio po niej, tym samym wzorcem
 * (płótno w rozdzielczości maski, blur tani bo małe, potem jedno
 * przeskalowanie przez `fit` na ekran - patrz poseTracker.js:14).
 *
 * JEDNORAZOWY IMPULS jak fala.js/iskry.js: zapal() startuje obwiednię
 * czasu (CZAS_TRWANIA), updateAndDraw() ją przesuwa i rysuje, dopóki trwa.
 *
 * TRZY WARSTWY, WSPÓLNA obwiednia p = 0..1 (patrz obwiednia()):
 *   1. WYPEŁNIENIE - sylwetka zalana barwą, gaśnie NAJSZYBCIEJ.
 *      "rozbłysk od środka" - moment uderzenia.
 *   2. OBRYS - krawędź sylwetki, jasny prawie-biały wariant barwy, wycięta
 *      ostrą maską (ten sam trik co aura.js "wytnijWnetrze"), z rosnącym
 *      promieniem rozmycia -> im dalej w obwiedni, tym szerszy, bledszy
 *      halo TUŻ POZA konturem ciała. To JEDYNA warstwa w całej grze z
 *      czytelną krawędzią - reszta efektów to miękkie gradienty radialne
 *      (fala.js/iskry.js/ogien.js/powerBall.js), stąd zgłoszenie gracza
 *      "efekt nie powala".
 *   3. POŚWIATA - pełna sylwetka, BEZ wycięcia wnętrza, z rosnącym promieniem
 *      rozmycia (znacznie szerszym niż obrys) - poświata wychodzi z ciała
 *      i rozpływa się. Narasta i gaśnie NAJWOLNIEJ z trzech warstw, więc
 *      DOTRWA po tym, jak wypełnienie i obrys już zgasły.
 *
 * Wszystkie trzy warstwy używają JEDNEGO przebiegu blur/rysowanie na klatkę
 * (nie kilku jednoczesnych przebiegów) - obwiednia czasu p sama przesuwa
 * promień rozmycia z klatki na klatkę, więc rosnący/gasnący halo wychodzi
 * z animacji w czasie, bez potrzeby wielu warstw naraz.
 */

/**
 * Nastawy strojeniowe - eksportowane i MUTOWALNE dla tools/scena.html.
 * ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (klawisz D), jak OGNISKO
 * w fala.js i TAU_SLADU w aura.js. CZAS_TRWANIA to czas trwania efektu
 * WIZUALNEGO, nie próg rozpoznawania pieczęci - nie podlega metodologii
 * pomiaru z js/znaki/progi-zmierzone.js.
 */
export const NASTAWY = {
    CZAS_TRWANIA: 1.2,   // s

    // Promień rozmycia warstwy = BAZA + ROSNIE*p (patrz updateAndDraw).
    OBRYS_BLUR_BAZA: 2, OBRYS_BLUR_ROSNIE: 30,
    POSWIATA_BLUR_BAZA: 10, POSWIATA_BLUR_ROSNIE: 60,

    ALFA_WYPELNIENIE: 0.8,
    ALFA_POSWIATA: 0.7,
    JASNOSC_OBRYSU: 120,   // dodane do RGB - kontur ma być jasny, prawie-biały wariant barwy
};

/**
 * Obwiednie trzech warstw w funkcji postępu p (0..1). Wydzielona jako
 * czysta funkcja - testowalna bez document, ten sam wzorzec co barwaAury
 * w aura.js i rzutPerspektywiczny w fala.js.
 *
 * @param {number} p  0..1
 * @returns {{wypelnienie:number, obrys:number, poswiata:number}}
 */
export function obwiednia(p) {
    const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 1;
    return {
        // Najszybszy narost i najszybsze wygaszanie - "rozbłysk od środka"
        // ma się wypalić, zanim obrys/poświata zdążą urosnąć.
        wypelnienie: (1 - t) * (1 - t),
        // Krótki narost (szczyt przy t≈0.33), potem spadek do zera.
        obrys: Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) * (1 - t),
        // Najwolniejszy narost (szczyt przy t=0.5) i wygaszanie z wykładnikiem
        // >1 - poświata ma DOTRWAĆ najdłużej z trzech warstw.
        poswiata: Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) * Math.pow(1 - t, 1.5)
    };
}

export class Zaplon {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._barwa = [255, 255, 255];
        this._sila = 0;

        this._maska = null;     // płótno w rozdzielczości maski, jak aura._maska
        this._maskaCtx = null;
        this._praca = null;     // płótno robocze do rozmycia/barwienia
        this._pracaCtx = null;
        this._obraz = null;
    }

    /** Czy warstwa ma coś do narysowania w tej klatce - dla HUD i bramki ekran.js. */
    get aktywny() { return this._trwa; }

    /** No-op - płótna pomocnicze resize'ują się same w _przygotujPlotna(). Patrz ekran.js dla tego samego wzorca. */
    wyczyscCache() {}

    /**
     * Zapala sylwetkę. Ponowne wywołanie w trakcie trwania efektu RESTARTUJE
     * obwiednię od zera z nowymi parametrami - ten sam wzorzec co
     * tecza.aktywuj() (main.js): (re)start bezwarunkowy, bez sumowania.
     *
     * @param {[number,number,number]} barwa  RGB żywiołu
     * @param {number} [sila]  0..1
     */
    zapal(barwa, sila = 1) {
        const b = (Array.isArray(barwa) && barwa.length === 3 && barwa.every(Number.isFinite))
            ? barwa : [255, 255, 255];
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;
        this._barwa = b;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx  płótno główne
     * @param {Uint8Array|null} maska  alfa sylwetki 0..255 z segmentationMasks
     * @param {number} szer  szerokość maski
     * @param {number} wys  wysokość maski
     * @param {object} fit  z computeCoverFit() - TA SAMA transformacja co wideo/aura
     * @param {number} dt
     */
    updateAndDraw(ctx, maska, szer, wys, fit, dt) {
        if (!this._trwa) return;

        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= NASTAWY.CZAS_TRWANIA) { this._trwa = false; return; }

        // Bez maski w TEJ klatce po prostu nic nie rysujemy - efekt jest
        // krótki (≈1.2 s) i czas płynie dalej niezależnie od chwilowego
        // braku danych, ten sam wybór co przy braku pozy gdzie indziej
        // w main.js (brak danych nigdy nie zamraża czasu na stałe).
        if (!maska || !szer || !wys || !fit) return;

        this._przygotujPlotna(szer, wys);
        this._wypelnijMaske(maska, szer, wys);

        const p = this._t / NASTAWY.CZAS_TRWANIA;
        const { wypelnienie, obrys, poswiata } = obwiednia(p);
        const [r, g, b] = this._barwa;
        const pc = this._pracaCtx;
        const pw = this._praca.width, ph = this._praca.height;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // --- 1. WYPEŁNIENIE: sylwetka zalana barwą ---
        if (wypelnienie > 0.005) {
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.drawImage(this._maska, 0, 0);
            pc.globalCompositeOperation = 'source-in';
            pc.fillStyle = `rgb(${r},${g},${b})`;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.max(0, Math.min(1, wypelnienie * this._sila * NASTAWY.ALFA_WYPELNIENIE));
            ctx.drawImage(this._praca, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
        }

        // --- 2. OBRYS: rosnąca rozmyta krawędź, wnętrze wycięte ostrą maską ---
        if (obrys > 0.005) {
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.filter = `blur(${(NASTAWY.OBRYS_BLUR_BAZA + NASTAWY.OBRYS_BLUR_ROSNIE * p).toFixed(1)}px)`;
            pc.drawImage(this._maska, 0, 0);
            pc.filter = 'none';
            // Wycięcie ostrej sylwetki - jak aura.js "wytnijWnetrze" - zostaje
            // sam halo TUŻ POZA konturem, nie świecące wnętrze ciała.
            pc.globalCompositeOperation = 'destination-out';
            pc.drawImage(this._maska, 0, 0);
            pc.globalCompositeOperation = 'source-in';
            // Jasny, prawie-biały wariant barwy - kontur ma PRZYPALAĆ,
            // nie tylko dogrywać ten sam odcień co wypełnienie.
            pc.fillStyle = `rgb(${Math.min(255, r + NASTAWY.JASNOSC_OBRYSU)},${Math.min(255, g + NASTAWY.JASNOSC_OBRYSU)},${Math.min(255, b + NASTAWY.JASNOSC_OBRYSU)})`;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.max(0, Math.min(1, obrys * this._sila));
            ctx.drawImage(this._praca, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
        }

        // --- 3. POŚWIATA: pełna sylwetka, szeroki rosnący blur, bez wycięcia ---
        if (poswiata > 0.005) {
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.filter = `blur(${(NASTAWY.POSWIATA_BLUR_BAZA + NASTAWY.POSWIATA_BLUR_ROSNIE * p).toFixed(1)}px)`;
            pc.drawImage(this._maska, 0, 0);
            pc.filter = 'none';
            pc.globalCompositeOperation = 'source-in';
            pc.fillStyle = `rgb(${r},${g},${b})`;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.max(0, Math.min(1, poswiata * this._sila * NASTAWY.ALFA_POSWIATA));
            ctx.drawImage(this._praca, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    /** Płótna pomocnicze - leniwie utworzone i przeskalowane, jak aura.js. */
    _przygotujPlotna(szer, wys) {
        if (!this._maska) {
            this._maska = document.createElement('canvas');
            this._maskaCtx = this._maska.getContext('2d');
            this._praca = document.createElement('canvas');
            this._pracaCtx = this._praca.getContext('2d');
        }
        if (this._maska.width !== szer || this._maska.height !== wys) {
            this._maska.width = this._praca.width = szer;
            this._maska.height = this._praca.height = wys;
            this._obraz = this._maskaCtx.createImageData(szer, wys);
        }
    }

    /** Maska ma jeden kanał (pewność 0..255); przenosimy ją w kanał alfa - jak aura.js. */
    _wypelnijMaske(maska, szer, wys) {
        const d = this._obraz.data;
        const n = szer * wys;
        for (let i = 0; i < n; i++) {
            const v = maska[i];
            const j = i * 4;
            d[j] = 255; d[j + 1] = 255; d[j + 2] = 255;
            d[j + 3] = v;
        }
        this._maskaCtx.putImageData(this._obraz, 0, 0);
    }
}
