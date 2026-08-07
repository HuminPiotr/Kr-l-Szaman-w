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

// Rampa barw od rdzenia do wygaśnięcia. Ostatnia jest ciemnoczerwona, nie
// szara - patrz punkt 1 wyżej.
const RAMPA = [
    [255, 250, 230],  // biel żaru
    [255, 226, 150],
    [255, 176, 60],
    [255, 108, 20],
    [190, 40, 10]     // dogasająca czerwień
];

const SPRITE_PX = 48;

// --- płomień ---
const NA_SEKUNDE = 260;        // cząsteczek na sekundę przy pełnej sile
const ZYCIE_MIN = 0.35, ZYCIE_MAX = 0.75;   // s
const WYPORNOSC = 900;         // px/s^2 w górę
const DZIEDZICZENIE = 0.45;    // ile prędkości palca przejmuje cząsteczka
const ROZRZUT = 90;            // px/s losowego rozrzutu
const TURBULENCJA = 220;       // px/s^2 bocznego chwiania
const OPOR = 1.6;              // 1/s
const ROZMIAR_OD = 0.55, ROZMIAR_DO = 1.5;  // mnożnik sprite'a w cyklu życia

// --- żar wiszący w powietrzu ---
const ZAR_NA_SEKUNDE = 90;
const ZAR_ZYCIE = 1.5;         // s - tyle dopala się smuga
const ZAR_WYPORNOSC = 120;     // znacznie mniej: żar ma WISIEĆ, nie ulatywać
const ZAR_DZIEDZICZENIE = 0.15;
const ZAR_ROZRZUT = 30;

const MAX_CZASTECZEK = 900;    // sufit bezpieczeństwa dla klatkażu

export class Ogien {
    constructor() {
        this.czastki = [];
        this._sprites = null;
        this._poprzZaczep = null;
        this._nadwyzka = 0;      // ułamki cząsteczek przeniesione na następną klatkę
        this._nadwyzkaZaru = 0;
    }

    get liczba() { return this.czastki.length; }

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
        const ile = NA_SEKUNDE * sila * dt + this._nadwyzka;
        const n = Math.floor(ile);
        this._nadwyzka = ile - n;

        const ileZaru = ZAR_NA_SEKUNDE * sila * dt + this._nadwyzkaZaru;
        const nz = Math.floor(ileZaru);
        this._nadwyzkaZaru = ileZaru - nz;

        for (let i = 0; i < n; i++) {
            // Rozłożenie WZDŁUŻ TORU - bez tego szybki ruch palca robi dziury.
            const t = n > 1 ? i / n : 1;
            this._dodaj({
                x: przed.x + (teraz.x - przed.x) * t,
                y: przed.y + (teraz.y - przed.y) * t,
                vx: vx * DZIEDZICZENIE + (Math.random() - 0.5) * ROZRZUT,
                vy: vy * DZIEDZICZENIE + (Math.random() - 0.5) * ROZRZUT,
                zycie: ZYCIE_MIN + Math.random() * (ZYCIE_MAX - ZYCIE_MIN),
                wyporn: WYPORNOSC * (0.75 + Math.random() * 0.5),
                turb: TURBULENCJA * (Math.random() < 0.5 ? -1 : 1),
                skala: 0.7 + Math.random() * 0.6,
                zar: false
            });
        }

        for (let i = 0; i < nz; i++) {
            const t = nz > 1 ? i / nz : 1;
            this._dodaj({
                x: przed.x + (teraz.x - przed.x) * t,
                y: przed.y + (teraz.y - przed.y) * t,
                vx: vx * ZAR_DZIEDZICZENIE + (Math.random() - 0.5) * ZAR_ROZRZUT,
                vy: vy * ZAR_DZIEDZICZENIE + (Math.random() - 0.5) * ZAR_ROZRZUT,
                zycie: ZAR_ZYCIE * (0.7 + Math.random() * 0.6),
                wyporn: ZAR_WYPORNOSC * (0.6 + Math.random() * 0.8),
                turb: TURBULENCJA * 0.4 * (Math.random() < 0.5 ? -1 : 1),
                skala: 0.35 + Math.random() * 0.4,
                zar: true
            });
        }
    }

    _dodaj(cz) {
        if (this.czastki.length >= MAX_CZASTECZEK) return;
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
            // wyżej rozchodzi się i chwieje.
            c.vx += c.turb * Math.sin(c.faza + c.wiek * 9) * p * dt;
            c.vy -= c.wyporn * dt;

            const opor = 1 - OPOR * dt;
            c.vx *= opor; c.vy *= opor;
            c.x += c.vx * dt; c.y += c.vy * dt;

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
            const poz = c.zar ? 0.45 + p * 0.55 : p;
            const sprite = this._sprites[Math.min(RAMPA.length - 1,
                                        Math.floor(poz * RAMPA.length))];

            // Szybki narost, powolne wygaszanie - bez tego cząsteczki
            // pojawiają się skokowo i widać emisję.
            const alfa = Math.sin(Math.min(1, p * 6) * Math.PI * 0.5) * (1 - p) * (1 - p);
            const r = SPRITE_PX * c.skala * (ROZMIAR_OD + (ROZMIAR_DO - ROZMIAR_OD) * p);

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
    return RAMPA.map(([r, g, b]) => {
        const c = document.createElement('canvas');
        c.width = c.height = SPRITE_PX;
        const x = c.getContext('2d');
        const grd = x.createRadialGradient(SPRITE_PX / 2, SPRITE_PX / 2, 0,
                                           SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX / 2);
        grd.addColorStop(0.0, `rgba(${r},${g},${b},1)`);
        grd.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
        grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
        x.fillStyle = grd;
        x.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
        return c;
    });
}
