/**
 * Ogień - układ cząsteczek, TYLKO rysowanie.
 *
 * Dostaje pozycję, prędkość i siłę. Nie wie nic o pieczęciach ani o mocy,
 * więc nadaje się także pod ognisko i inne efekty ognia.
 *
 * ================== CO PRZESĄDZA O TYM, ŻE TO WYGLĄDA JAK OGIEŃ ==================
 *
 * Nie liczba cząsteczek. Pięć rzeczy:
 *
 * 1. RAMPA BARW. Ogień jest emisyjny: rdzeń prawie biały -> nasycony żółty ->
 *    pomarańcz -> głęboka czerwień -> ZANIK DO ZERA. Nie do szarości: szarzenie
 *    to najczęstszy powód, dla którego ogień wygląda jak plama, a w trybie
 *    'lighter' szary dym i tak jest niewidoczny.
 *
 * 2. DZIEDZICZENIE PRĘDKOŚCI ŹRÓDŁA. Cząsteczki dostają wyporność w górę PLUS
 *    ułamek prędkości opuszka. Bez tego płomień SKACZE za palcem, zamiast za
 *    nim płynąć - a to było sedno pomysłu.
 *
 * 3. EMISJA WZDŁUŻ TORU, nie w punkcie. Przy szybkim ruchu rozkładamy
 *    cząsteczki między poprzednią i obecną pozycją, inaczej w płomieniu
 *    pojawiają się dziury.
 *
 * 4. TURBULENCJA. Sam ruch w górę daje fontannę, nie ogień. Boczne chwianie
 *    o amplitudzie rosnącej z wiekiem cząsteczki.
 *
 * 5. SPRITE WYPALONY RAZ. Gradient promieniowy na barwę, do pomocniczego
 *    płótna przy starcie, potem drawImage ze skalą. Tworzenie gradientu na
 *    cząsteczkę na klatkę to różnica między 60 a kilkoma FPS.
 */

/**
 * Nastawy strojeniowe - eksportowane i MUTOWALNE, żeby tools/scena.html
 * mogło podpiąć suwaki. Po zmianie RAMPA/KRZYWA_BARWY/SPRITE_PX wywołaj
 * wyczyscCache() (sprite'y są wypalone raz przy starcie).
 */
import { krokTlumienia, obwiedniaCzastki } from './czastki.js';
import { simplex2 } from './szum.js';

export const NASTAWY = {
    // Rampa barw od rdzenia do wygaśnięcia. Ostatnia jest ciemnoczerwona, nie
    // szara - patrz punkt 1 w nagłówku. Pierwsza barwa jest CIEPŁĄ bielą, nie
    // czystą - w prawdziwym płomieniu punkt przegrzania jest mały.
    RAMPA: [
        [255, 243, 214],  // ciepła biel - tylko sam rdzeń
        [255, 216, 132],
        [255, 168, 56],
        [252, 104, 18],
        [176, 36, 8]      // dogasająca czerwień
    ],

    // Pozycja na rampie rośnie SZYBCIEJ niż wiek cząsteczki: dzięki temu biel
    // zajmuje tylko początek życia, a nie jego pierwszą piątą część.
    KRZYWA_BARWY: 0.6,

    SPRITE_PX: 48,

    // --- płomień ---
    NA_SEKUNDE: 260,        // cząsteczek na sekundę przy pełnej sile
    ZYCIE_MIN: 0.5, ZYCIE_MAX: 1.05,   // s - dłuższe życie = wyższy, smuklejszy płomień
    WYPORNOSC: 900,         // px/s^2 w górę
    DZIEDZICZENIE: 0.45,    // ile prędkości palca przejmuje cząsteczka
    ROZRZUT: 90,            // px/s losowego rozrzutu
    TURBULENCJA: 300,       // px/s^2 bocznego chwiania (jęzory płomienia)
    OPOR: 1.15,             // 1/s - mniejszy opór pozwala płomieniowi się wyciągnąć
    ROZMIAR_OD: 0.38, ROZMIAR_DO: 1.6,  // ciasny rdzeń, szeroki wierzch

    // --- żar wiszący w powietrzu ---
    ZAR_NA_SEKUNDE: 90,
    ZAR_ZYCIE: 1.5,         // s - tyle dopala się smuga
    ZAR_WYPORNOSC: 120,     // znacznie mniej: żar ma WISIEĆ, nie ulatywać
    ZAR_DZIEDZICZENIE: 0.15,
    ZAR_ROZRZUT: 30,

    MAX_CZASTECZEK: 900,    // sufit bezpieczeństwa dla klatkażu
};

export class Ogien {
    constructor() {
        this.czastki = [];
        this._sprites = null;
        this._poprzZaczep = null;
        this._nadwyzka = 0;      // ułamki cząsteczek przeniesione na następną klatkę
        this._nadwyzkaZaru = 0;
        this.odrzucone = 0;      // licznik cząstek odrzuconych przez sufit MAX_CZASTECZEK - panel kontroli tools/scena.html
    }

    get liczba() { return this.czastki.length; }

    /** Wywołać po zmianie NASTAWY.RAMPA/KRZYWA_BARWY/SPRITE_PX - stare sprite'y zostały wypalone ze starymi wartościami. */
    wyczyscCache() { this._sprites = null; }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x,y}|null} zaczep  pozycja źródła w PIKSELACH płótna
     * @param {number} sila  0..1 - intensywność; 0 wygasza bez emisji
     * @param {number} dt
     */
    updateAndDraw(ctx, zaczep, sila, dt) {
        if (!this._sprites) this._sprites = zrobSprites();
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;

        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        const zdrowy = zaczep && Number.isFinite(zaczep.x) && Number.isFinite(zaczep.y);

        // Prędkość opuszka z różnicy pozycji. To ona sprawia, że płomień
        // płynie za palcem, a nie skacze.
        let vx = 0, vy = 0;
        if (zdrowy && this._poprzZaczep && krok > 0) {
            vx = (zaczep.x - this._poprzZaczep.x) / krok;
            vy = (zaczep.y - this._poprzZaczep.y) / krok;
        }

        if (zdrowy && s > 0.01) {
            this._emituj(zaczep, this._poprzZaczep ?? zaczep, vx, vy, s, krok);
        }
        this._poprzZaczep = zdrowy ? { x: zaczep.x, y: zaczep.y } : null;

        this._ruszaj(krok);
        this._rysuj(ctx);
    }

    /** Wygaszenie bez emisji - cząsteczki dopalają się w miejscu. */
    wygas() {
        this._poprzZaczep = null;
    }

    _emituj(teraz, przed, vx, vy, sila, dt) {
        const ile = NASTAWY.NA_SEKUNDE * sila * dt + this._nadwyzka;
        const n = Math.floor(ile);
        this._nadwyzka = ile - n;

        const ileZaru = NASTAWY.ZAR_NA_SEKUNDE * sila * dt + this._nadwyzkaZaru;
        const nz = Math.floor(ileZaru);
        this._nadwyzkaZaru = ileZaru - nz;

        for (let i = 0; i < n; i++) {
            // Rozłożenie WZDŁUŻ TORU - bez tego szybki ruch palca robi dziury.
            const t = n > 1 ? i / n : 1;
            this._dodaj({
                x: przed.x + (teraz.x - przed.x) * t,
                y: przed.y + (teraz.y - przed.y) * t,
                vx: vx * NASTAWY.DZIEDZICZENIE + (Math.random() - 0.5) * NASTAWY.ROZRZUT,
                vy: vy * NASTAWY.DZIEDZICZENIE + (Math.random() - 0.5) * NASTAWY.ROZRZUT,
                zycie: NASTAWY.ZYCIE_MIN + Math.random() * (NASTAWY.ZYCIE_MAX - NASTAWY.ZYCIE_MIN),
                wyporn: NASTAWY.WYPORNOSC * (0.75 + Math.random() * 0.5),
                turb: NASTAWY.TURBULENCJA * (Math.random() < 0.5 ? -1 : 1),
                skala: 0.7 + Math.random() * 0.6,
                zar: false
            });
        }

        for (let i = 0; i < nz; i++) {
            const t = nz > 1 ? i / nz : 1;
            this._dodaj({
                x: przed.x + (teraz.x - przed.x) * t,
                y: przed.y + (teraz.y - przed.y) * t,
                vx: vx * NASTAWY.ZAR_DZIEDZICZENIE + (Math.random() - 0.5) * NASTAWY.ZAR_ROZRZUT,
                vy: vy * NASTAWY.ZAR_DZIEDZICZENIE + (Math.random() - 0.5) * NASTAWY.ZAR_ROZRZUT,
                zycie: NASTAWY.ZAR_ZYCIE * (0.7 + Math.random() * 0.6),
                wyporn: NASTAWY.ZAR_WYPORNOSC * (0.6 + Math.random() * 0.8),
                turb: NASTAWY.TURBULENCJA * 0.4 * (Math.random() < 0.5 ? -1 : 1),
                skala: 0.35 + Math.random() * 0.4,
                zar: true
            });
        }
    }

    _dodaj(cz) {
        if (this.czastki.length >= NASTAWY.MAX_CZASTECZEK) { this.odrzucone++; return; }
        cz.wiek = 0;
        cz.faza = Math.random() * Math.PI * 2;
        this.czastki.push(cz);
    }

    _ruszaj(dt) {
        if (dt <= 0) return;
        const zywe = [];
        for (const c of this.czastki) {
            c.wiek += dt;
            if (c.wiek >= c.zycie) continue;

            const p = c.wiek / c.zycie;

            // Turbulencja rośnie z wiekiem - u dołu płomień jest wąski,
            // wyżej rozchodzi się i chwieje. simplex2 zamiast sin (P2c,
            // 2026-09-21): sin daje jedną globalną, WIDOCZNIE OKRESOWĄ falę
            // (wszystkie cząstki chwieją się w tym samym rytmie, przesunięte
            // tylko fazą startu); simplex2(c.faza, c.wiek*9) próbkuje
            // NIEOKRESOWY szum wzdłuż osi czasu (wiek*9), z c.faza jako
            // "ziarnem" per cząstka (różne cząstki próbkują różne krzywe
            // szumu zamiast tej samej sinusoidy przesuniętej w fazie) -
            // organiczne chwianie, nie miarowe wahadło. Zakres ~2x szerszy
            // niż sin ([-1,1] vs ~[-1.6,1.6] empirycznie) - amplituda do
            // dostrojenia na stanowisku (tools/scena.html).
            // Siła wymuszona NAJPIERW (Euler w przód - przybliżenie, patrz
            // nagłówek czastki.js), potem dokładna całka pozycji + zanik
            // prędkości (krokTlumienia).
            c.vx += c.turb * simplex2(c.faza, c.wiek * 9) * p * dt;
            c.vy -= c.wyporn * dt;

            const t = krokTlumienia(NASTAWY.OPOR, dt);
            c.x += c.vx * t.s; c.y += c.vy * t.s;
            c.vx *= t.e; c.vy *= t.e;

            if (Number.isFinite(c.x) && Number.isFinite(c.y)) zywe.push(c);
        }
        this.czastki = zywe;
    }

    _rysuj(ctx) {
        if (!this.czastki.length) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (const c of this.czastki) {
            const p = c.wiek / c.zycie;

            // Żar startuje niżej na rampie - już ostygł, gdy się oderwał.
            const poz = c.zar ? 0.45 + p * 0.55 : Math.pow(p, NASTAWY.KRZYWA_BARWY);
            const sprite = this._sprites[Math.min(NASTAWY.RAMPA.length - 1,
                                        Math.floor(poz * NASTAWY.RAMPA.length))];

            // Szybki narost, powolne wygaszanie - bez tego cząsteczki
            // pojawiają się skokowo i widać emisję.
            const alfa = obwiedniaCzastki(p);
            const r = NASTAWY.SPRITE_PX * c.skala * (NASTAWY.ROZMIAR_OD + (NASTAWY.ROZMIAR_DO - NASTAWY.ROZMIAR_OD) * p);

            ctx.globalAlpha = Math.max(0, Math.min(1, alfa * (c.zar ? 0.55 : 0.9)));
            ctx.drawImage(sprite, c.x - r / 2, c.y - r / 2, r, r);
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

/**
 * Sprite'y wypalone RAZ, po jednym na stopień rampy.
 *
 * Gradient promieniowy z miękkim zanikiem. Tworzenie gradientu na cząsteczkę
 * na klatkę zabiłoby klatkaż przy kilkuset cząsteczkach - to jest ten sam
 * błąd co liczenie gradientu w pętli rysowania kuli.
 */
function zrobSprites() {
    return NASTAWY.RAMPA.map(([r, g, b]) => {
        const c = document.createElement('canvas');
        c.width = c.height = NASTAWY.SPRITE_PX;
        const x = c.getContext('2d');
        const grd = x.createRadialGradient(NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2, 0,
                                           NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2);
        grd.addColorStop(0.0, `rgba(${r},${g},${b},1)`);
        grd.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
        grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
        x.fillStyle = grd;
        x.fillRect(0, 0, NASTAWY.SPRITE_PX, NASTAWY.SPRITE_PX);
        return c;
    });
}
