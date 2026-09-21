/**
 * Iskry Gromu w Ziemię - układ cząstek, TYLKO rysowanie.
 *
 * Dostaje zaczep i siłę przez wystrzel(); nie wie nic o pieczęciach,
 * kombosach ani o mocy - ten sam podział co ogien.js/fala.js.
 *
 * JEDNORAZOWY IMPULS, nie ciągła emisja: wystrzel() dodaje N cząstek naraz,
 * potem tylko żyją i gasną - jak fala.js, w przeciwieństwie do ogien.js,
 * który emituje co klatkę.
 *
 * ================== 2D WSZECHKIERUNKOWE, NIE 3D KIERUNKOWE ==================
 * fala.js emituje pierścień wzdłuż jednej osi z rzutem perspektywicznym -
 * dobre dla fali uderzeniowej, złe dla "energii tryskającej z pęknięcia
 * ziemi we wszystkie strony". Iskry startują pod losowym kątem na PEŁNYM
 * okręgu (0..2π) w płaszczyźnie ekranu, bez trzeciego wymiaru - prostszy
 * model, bo tu nie chodzi o ścianę powietrza, tylko o fontannę światła.
 *
 * ================== DWUSKŁADNIKOWA FIZYKA WIRU ==================
 * Mirror rozdzielenia vx/vpx z fala.js (ruch wzdłuż vs promieniowy), tu jako
 * składowa STYCZNA (wir wokół zaczepu) i PROMIENIOWA (wybuch na zewnątrz),
 * każda z WŁASNYM tłumieniem:
 *   - styczna gaśnie SZYBKO (OPOR_STYCZNY) - wir jest tylko początkowym
 *     zawirowaniem, nie ma trwać cały czas życia cząstki,
 *   - promieniowa gaśnie WOLNO (OPOR_PROMIENIOWY) - rozproszenie ma trwać
 *     przez większość życia iskry.
 * Bez tego rozdziału iskry albo kręciłyby się w kółko bez końca, albo
 * wybuch wyglądałby jak zwykła eksplozja bez charakterystycznego zawirowania.
 *
 * JEDEN LOSOWY KIERUNEK WIRU NA CAŁY WYSTRZAŁ (nie per cząstka) - inaczej
 * wiry poszczególnych cząstek znosiłyby się wizualnie i czytały jako chaos
 * zamiast spójnego zawirowania całego pierścienia.
 *
 * KOLOR PRZYPISANY DO KĄTA STARTOWEGO, nie losowy - sąsiadujące iskry
 * dostają sąsiadujące barwy tęczy, co daje spójny, czytelny gradient wokół
 * pierścienia zamiast szumu losowych kolorów.
 *
 * Plus rzeczy wspólne z ogien.js/fala.js: SPRITE WYPALONY RAZ (gradient na
 * cząstkę na klatkę zabija FPS) i lekka WYPORNOŚĆ (jak żar w ogien.js, tu
 * słabsza - to iskry, nie dym).
 *
 * ================== DLACZEGO START NA PIERŚCIENIU, NIE W PUNKCIE ==================
 * Naprawa po zmierzeniu na żywo: pierwsza wersja startowała WSZYSTKIE 260
 * cząstek dokładnie w zaczepie. Przy `globalCompositeOperation='lighter'`
 * (addytywne mieszanie) gęsto nałożone piksele różnych barw SUMUJĄ SIĘ do
 * bieli - dokładnie tak, jak czerwony+zielony+niebieski daje biel - a to
 * dzieje się właśnie w pierwszej chwili życia cząstki, gdy obwiednia alfy
 * jest najjaśniejsza. Efekt: biała chmura zamiast tęczy, bo rozjazd barw
 * (kolor zależny od kąta) ujawnia się dopiero, gdy cząstki się rozejdą - a
 * wtedy już przygasają. fala.js miał to rozwiązane od początku (PROMIEN_START,
 * "czoło ma szerokość już w chwili emisji") - tu brakowało tego samego kroku.
 */

/**
 * Nastawy strojeniowe - eksportowane i MUTOWALNE (obiekt, nie const per
 * wartość), żeby tools/scena.html mogło podpiąć suwaki bez importowania
 * całego modułu na nowo. Po zmianie wartości wpływających na wypalone
 * sprite'y (SPRITE_PX, LICZBA_BARW_RAMPY) wywołaj wyczyscCache().
 */
export const NASTAWY = {
    NA_WYSTRZAL: 480,            // cząstek przy pełnej sile (jednorazowo) - podniesione po pierwszym strojeniu na żywo, efekt miał być mocniejszy
    PREDKOSC_PROMIENIOWA: 260,   // px/s - wybuch na zewnątrz, przy pełnej sile
    PREDKOSC_STYCZNA: 340,       // px/s - początkowy wir, przy pełnej sile
    ROZRZUT_PREDKOSCI: 80,       // px/s losowego rozrzutu
    OPOR_STYCZNY: 3.2,           // 1/s - wir gaśnie SZYBKO
    OPOR_PROMIENIOWY: 0.9,       // 1/s - rozproszenie trwa DŁUŻEJ
    WYPORNOSC: 60,               // px/s^2 w górę - lekki unos jak żar (ogien.js ma silniejszy, bo tam to dym)
    ZYCIE_MIN: 0.9, ZYCIE_MAX: 1.9,   // s - dłużej niż fala (0.75-1.15): iskry mają DOTRWAĆ po fali
    ROZMIAR_OD: 0.5, ROZMIAR_DO: 1.4,
    SPRITE_PX: 20,                // mniejsze niż ogień (48) i fala (64) - punkty iskier, nie ściana
    PROMIEN_START: 34,            // px - pierścień ma szerokość już w chwili emisji (patrz nagłówek)

    MAX_CZASTECZEK: 700,         // sufit bezpieczeństwa dla klatkażu - z zapasem nad NA_WYSTRZAL, żeby nowy wystrzał nie obcinał się o dogasające stare cząstki
    LICZBA_BARW_RAMPY: 8,        // sprite'y wypalone raz, po jednym na próbkę tęczy
};

/**
 * Tęczowa paleta energii - PRZENIESIONA z js/powerBall.js (plik odpięty od
 * gry, ale to jedyny gotowy przepis na "tęczową energię" w repo). Zwraca
 * [r,g,b] jako liczby, NIE string: sprite'y wypalone raz potrzebują
 * surowych składowych do budowy gradientu, nie tekstu do parsowania
 * z powrotem.
 *
 * @param {number} t  0..1
 * @returns {[number,number,number]}
 */
export function barwaEnergii(t) {
    const energy = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
    let r, g, b;
    if (energy < 0.4) {
        // Ciemnoniebieski -> Cyjan
        const k = energy / 0.4;
        r = Math.floor(k * 100);
        g = Math.floor(100 + k * 155);
        b = 255;
    } else if (energy < 0.8) {
        // Cyjan -> Magenta/Fiolet
        const k = (energy - 0.4) / 0.4;
        r = Math.floor(100 + k * 155);
        g = Math.floor(255 - k * 255);
        b = 255;
    } else {
        // Magenta -> Żółty/Ognisty
        const k = (energy - 0.8) / 0.2;
        r = 255;
        g = Math.floor(k * 200);
        b = Math.floor(255 - k * 255);
    }
    return [r, g, b];
}

/**
 * Zaczep "pęknięcia ziemi": X z centroidu dłoni, Y na stałe nisko na ekranie.
 *
 * DLACZEGO NIE BIODRA/STOPY. Repo już dwukrotnie odnotowuje (efekty.js:14-19,
 * znaki/styk.js, znaki/mokoszSplot.js), że kamera laptopa na typowym
 * dystansie tańca nie mieści kostek/bioder w kadrze - poleganie na nich
 * dałoby fallback częściej niż realną pozycję. X liczony z tego samego
 * landmarka (9 - nasada środkowego palca), którego już używają
 * efekty.js:srodekDloni i podmuch.js - najbardziej niezawodne źródło
 * w całej grze. Y jest stały: stylizowane "pęknięcie pod tancerzem", nie
 * dosłowne śledzenie stóp.
 *
 * @param {object} frame  kontrakt klatki (hands, width, height)
 * @param {number} W  szerokość płótna w px
 * @param {number} H  wysokość płótna w px
 * @returns {{x:number,y:number}}
 */
export function pekniecieZiemi(frame, W, H) {
    const h = (frame.hands ?? []).filter(d => d.landmarks?.[9] && Number.isFinite(d.landmarks[9].x));
    const yStala = H * 0.86;
    if (!h.length) return { x: W * 0.5, y: yStala };
    let x = 0;
    for (const d of h) x += d.landmarks[9].x;
    return { x: (x / h.length) * W, y: yStala };
}

export class Iskry {
    constructor() {
        this.czastki = [];
        this._sprites = null;
        this.odrzucone = 0;   // licznik cząstek odrzuconych przez sufit MAX_CZASTECZEK - do panelu kontroli stanowiska (tools/scena.html)
    }

    get liczba() { return this.czastki.length; }

    /** Wywołać po zmianie NASTAWY.SPRITE_PX/LICZBA_BARW_RAMPY - inaczej stare sprite'y zostają wypalone ze starymi wymiarami/barwami. */
    wyczyscCache() { this._sprites = null; }

    /**
     * @param {{x,y}} zaczep  źródło w PIKSELACH płótna
     * @param {number} sila  0..1
     */
    wystrzel(zaczep, sila) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;

        // Jeden losowy kierunek wiru na CAŁY wystrzał - patrz nagłówek pliku.
        const spinSign = Math.random() < 0.5 ? -1 : 1;

        const n = Math.round(NASTAWY.NA_WYSTRZAL * (0.4 + 0.6 * s));
        for (let i = 0; i < n; i++) {
            const kat = Math.random() * Math.PI * 2;
            const promX = Math.cos(kat), promY = Math.sin(kat);
            // Styczna: prostopadła do promienia, obrócona zgodnie ze spinSign.
            const stycX = -promY * spinSign, stycY = promX * spinSign;

            const vProm = (NASTAWY.PREDKOSC_PROMIENIOWA * s) * (0.8 + Math.random() * 0.4)
                        + (Math.random() - 0.5) * NASTAWY.ROZRZUT_PREDKOSCI * s;
            const vStyc = (NASTAWY.PREDKOSC_STYCZNA * s) * (0.7 + Math.random() * 0.5);

            // Kolor przypisany do kąta startowego, nie losowo - patrz nagłówek.
            const t = kat / (Math.PI * 2);

            // Start NA PIERŚCIENIU o promieniu NASTAWY.PROMIEN_START, z losowym
            // rozrzutem promienia (0.4..1.0), żeby czoło miało GRUBOŚĆ - ten
            // sam wzorzec co fala.js. To rozdziela barwy PRZESTRZENNIE od
            // pierwszej klatki, zamiast liczyć na to, że zdążą się rozejść,
            // zanim addytywne mieszanie zdąży je zbielić.
            const rStart = NASTAWY.PROMIEN_START * (0.4 + Math.random() * 0.6);
            this._dodaj({
                x: zaczep.x + promX * rStart, y: zaczep.y + promY * rStart,
                vrx: promX * vProm, vry: promY * vProm,
                vtx: stycX * vStyc, vty: stycY * vStyc,
                zycie: NASTAWY.ZYCIE_MIN + Math.random() * (NASTAWY.ZYCIE_MAX - NASTAWY.ZYCIE_MIN),
                skala: NASTAWY.ROZMIAR_OD + Math.random() * (NASTAWY.ROZMIAR_DO - NASTAWY.ROZMIAR_OD),
                wiek: 0,
                barwaT: t
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
        const zywe = [];
        for (const c of this.czastki) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;

            // DWA RÓŻNE TŁUMIENIA - styczna (wir) gaśnie szybko, promieniowa
            // (wybuch) trwa dłużej. To one dają charakter zawirowania.
            const oporT = 1 - NASTAWY.OPOR_STYCZNY * krok;
            const oporR = 1 - NASTAWY.OPOR_PROMIENIOWY * krok;
            c.vtx *= oporT; c.vty *= oporT;
            c.vrx *= oporR; c.vry *= oporR;
            c.vry -= NASTAWY.WYPORNOSC * krok;   // lekki unos w górę, jak żar w ogien.js

            c.x += (c.vtx + c.vrx) * krok;
            c.y += (c.vty + c.vry) * krok;

            if (Number.isFinite(c.x) && Number.isFinite(c.y)) zywe.push(c);
        }
        this.czastki = zywe;
    }

    _rysuj(ctx) {
        if (!this.czastki.length) return;
        if (!this._sprites) this._sprites = zrobSprites();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const c of this.czastki) {
            const p = c.wiek / c.zycie;
            // Szybki narost, powolne wygaszanie - ten sam kształt obwiedni
            // co w ogien.js/fala.js.
            const alfa = Math.sin(Math.min(1, p * 6) * Math.PI * 0.5) * (1 - p) * (1 - p);
            const r = NASTAWY.SPRITE_PX * c.skala * (0.6 + 0.8 * p);

            const idx = Math.min(NASTAWY.LICZBA_BARW_RAMPY - 1, Math.floor(c.barwaT * NASTAWY.LICZBA_BARW_RAMPY));
            ctx.globalAlpha = Math.max(0, Math.min(1, alfa));
            ctx.drawImage(this._sprites[idx], c.x - r / 2, c.y - r / 2, r, r);
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

/** Sprite'y wypalone RAZ - patrz ogien.js/fala.js dla tego samego wzorca. */
function zrobSprites() {
    const sprites = [];
    for (let i = 0; i < NASTAWY.LICZBA_BARW_RAMPY; i++) {
        const [r, g, b] = barwaEnergii(i / (NASTAWY.LICZBA_BARW_RAMPY - 1));
        sprites.push(sprite(r, g, b));
    }
    return sprites;
}

function sprite(r, g, b) {
    const c = document.createElement('canvas');
    c.width = c.height = NASTAWY.SPRITE_PX;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2, 0,
                                       NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2, NASTAWY.SPRITE_PX / 2);
    grd.addColorStop(0.0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`);
    grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, NASTAWY.SPRITE_PX, NASTAWY.SPRITE_PX);
    return c;
}
