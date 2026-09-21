/**
 * Wielka runa pieczęci - zastępuje dawną animację okręgu (efekty.js
 * 'pierscien'/'sciagniecie') przy KAŻDEJ złożonej pieczęci.
 *
 * Trzy fazy jednego impulsu, jedna czysta funkcja obwiedni (fazaRuny, patrz
 * niżej - testowalna bez DOM, ten sam wzorzec co obwiedniaUderzenia()
 * w ekran.js):
 *
 *   1. NARODZINY (0..CZAS_NARODZINY_S)  - glif wjeżdża ze skali 1.6->1.0,
 *      rozmycie opada, PODCZAS TEJ FAZY (i tylko wtedy) błyska bardzo
 *      subtelny pierścień pod glifem - użytkownik wprost dopuścił "chyba że
 *      bardzo subtelny", to jest ten wyjątek, ograniczony do jednej fazy.
 *   2. ŻAR (do CZAS_ZAR_DO_S)           - glif trzyma pełną alfę, poświata
 *      (shadowBlur) delikatnie pulsuje - "żarzenie", nie miganie.
 *   3. ROZSYPANIE (do CZAS_CALKOWITY_S) - z PIKSELI GLIFU (nie z losowych
 *      punktów) odrywają się żarowe iskry i unoszą się w górę; sam glif
 *      gaśnie w tym samym tempie. To odróżnia runę od zwykłego "fade out" -
 *      runa dosłownie rozpada się w żar, tak jak dogasający węgiel.
 *
 * ====================== LUSTRO ======================
 * Płótno ma CSS scaleX(-1) (GEMINI.md §4) - fillText() rysowany wprost
 * wyszedłby lustrzany i nieczytelny. Wzorzec z debugHud.js:600-608:
 * ctx.translate(x,y); ctx.scale(-1,1); fillText(..., 0, 0); ctx.restore() -
 * odkręcamy odbicie LOKALNIE, tylko dla glifu, nie dla całej sceny.
 *
 * ====================== WEBFONT NA CANVASIE ======================
 * ctx.fillText() z fontem, który jeszcze się nie załadował, renderuje się
 * po cichu jako fallback/tofu - zero błędu (patrz js/glify.js nagłówek).
 * updateAndDraw() dlatego sprawdza fontGotowy() PRZED rysowaniem czegokolwiek
 * w tej klatce - brak fontu = ta klatka nie rysuje runy, jak assety.js
 * pomija brakujący obrazek (GEMINI.md §2: brak assetu nigdy nie jest błędem).
 * Upływ czasu (i tym samym wygasanie aktywnych run) NIE jest bramkowany
 * fontem - inaczej runa czekająca na font nigdy by nie wygasła.
 *
 * ====================== RASTERYZACJA GLIFU ======================
 * Iskry rozsypania startują z PUNKTÓW SAMEGO GLIFU: glif jest raz
 * wypalony na małe płótno pomocnicze (offscreen), a piksele o alfa>128
 * (co 3 px) stają się punktami startowymi - ten sam "wypal raz" wzorzec co
 * sprite'y w iskry.js/ogien.js/fala.js, tu zastosowany do tekstu zamiast
 * gradientu. Cache per znak (Map) - rasteryzacja nie powtarza się przy
 * każdym odpaleniu tej samej pieczęci.
 */
import { glif, fontGotowy } from './glify.js';
import { spriteRadialny } from './czastki.js';

export const CZAS_NARODZINY_S = 0.25;
export const CZAS_ZAR_DO_S = 0.9;
export const CZAS_CALKOWITY_S = 1.7;

/**
 * Nastawy strojeniowe PRYWATNE - eksportowane i MUTOWALNE dla
 * tools/scena.html. CZAS_* zostają zwykłym export const (kontrakt
 * fazaRuny()/testów). Po zmianie RASTER_PX wywołaj wyczyscCache() - rastry
 * glifów są wypalone raz per znak.
 */
export const NASTAWY = {
    ROZMIAR_WZGL_H: 0.22,    // wysokość glifu jako ułamek wysokości płótna
    MAX_ISKIER_NA_RUNE: 90,  // próbka z rasteryzacji, nie wszystkie punkty
    MAX_ISKIER_LACZNIE: 300, // sufit bezpieczeństwa na klatkę (kilka run naraz)
    RASTER_PX: 220,          // rozmiar płótna pomocniczego rasteryzacji

    // --- iskry rozsypania (patrz _odpalIskryJesliCzas/_ruszajIskry/_rysujIskry) ---
    ISKRY_VX_ROZRZUT: 50,       // px/s - boczny rozrzut prędkości startowej
    ISKRY_VY_BAZA: 40, ISKRY_VY_ROZRZUT: 70,   // px/s w górę - vy = -(BAZA + losowe*ROZRZUT)
    ISKRY_ZYCIE_MIN: 0.45, ISKRY_ZYCIE_ROZRZUT: 0.55,
    ISKRY_UNOS: 30,             // px/s^2 w górę, jak żar w ogien.js/iskry.js
    ISKRY_PROMIEN: 2.5,
    ISKRY_POSWIATA_MNOZNIK: 2.2,   // promień gradientu poświaty = ISKRY_PROMIEN * to
    ISKRY_SPRITE_PX: 24,        // rozmiar wypalonego sprite'a (P2d) - iskry są małe, zapas nad typowym promieniem ~11px
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/**
 * "H, S%, L%" (format efekty.js TABELA, taki sam jak r.barwa) -> [r,g,b]
 * 0..255. Potrzebne WYŁĄCZNIE do wypalenia sprite'a iskier (P2d,
 * 2026-09-21) - spriteRadialny() z czastki.js bierze surowe RGB, jak
 * sprite() w iskry.js/ogien.js/fala.js. Reszta modułu (glif, pierścień,
 * poświata) dalej rysuje wprost przez hsla() - nie ma tam per-klatka
 * gradientu do wypalenia, więc nie ma powodu, żeby i one przechodziły
 * przez RGB.
 */
export function hslNaRgb(hslString) {
    const czesci = String(hslString).split(',').map(s => parseFloat(s));
    const h = Number.isFinite(czesci[0]) ? czesci[0] : 0;
    const s = (Number.isFinite(czesci[1]) ? czesci[1] : 0) / 100;
    const l = (Number.isFinite(czesci[2]) ? czesci[2] : 50) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs(hp % 2 - 1));
    let r1, g1, b1;
    if (hp < 1) [r1, g1, b1] = [c, x, 0];
    else if (hp < 2) [r1, g1, b1] = [x, c, 0];
    else if (hp < 3) [r1, g1, b1] = [0, c, x];
    else if (hp < 4) [r1, g1, b1] = [0, x, c];
    else if (hp < 5) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];
    const m = l - c / 2;
    return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

/**
 * Obwiednia jednej runy - CZYSTA FUNKCJA, testowalna bez document.
 *
 * @param {number} t  sekundy od odpalenia
 * @returns {{zywa:boolean, faza:'narodziny'|'zar'|'rozsypanie', p:number,
 *            skala:number, alfaGlif:number, poswiata:number,
 *            rozmyciePx:number, subtelnyPierscien:number, rozsypanieP:number}}
 */
export function fazaRuny(t) {
    const czas = Number.isFinite(t) ? Math.max(0, t) : 0;

    if (czas >= CZAS_CALKOWITY_S) {
        return { zywa: false, faza: 'rozsypanie', p: 1, skala: 1, alfaGlif: 0,
                 poswiata: 0, rozmyciePx: 0, subtelnyPierscien: 0, rozsypanieP: 1 };
    }

    if (czas < CZAS_NARODZINY_S) {
        const p = czas / CZAS_NARODZINY_S;
        return {
            zywa: true, faza: 'narodziny', p,
            skala: 1.6 - 0.6 * p,
            alfaGlif: p,
            poswiata: 0.5 * p,
            rozmyciePx: 8 * (1 - p),
            // Jedyny "okrąg" w całej animacji - bardzo słaby, tylko tu.
            subtelnyPierscien: 0.10 * Math.sin(p * Math.PI),
            rozsypanieP: 0
        };
    }

    if (czas < CZAS_ZAR_DO_S) {
        const p = (czas - CZAS_NARODZINY_S) / (CZAS_ZAR_DO_S - CZAS_NARODZINY_S);
        return {
            zywa: true, faza: 'zar', p,
            skala: 1,
            alfaGlif: 1,
            poswiata: 0.65 + 0.35 * Math.sin(p * Math.PI * 3),
            rozmyciePx: 0,
            subtelnyPierscien: 0,
            rozsypanieP: 0
        };
    }

    const p = (czas - CZAS_ZAR_DO_S) / (CZAS_CALKOWITY_S - CZAS_ZAR_DO_S);
    return {
        zywa: true, faza: 'rozsypanie', p,
        skala: 1,
        alfaGlif: 1 - p,
        poswiata: Math.max(0, 0.5 * (1 - p)),
        rozmyciePx: 0,
        subtelnyPierscien: 0,
        rozsypanieP: p
    };
}

export class Runy {
    constructor() {
        this.aktywne = [];        // [{ id, znak, x, y, t, barwa, iskryOdpalone, iskry }]
        this._punktyGlifu = new Map();   // znak -> [{x,y}] znormalizowane -0.5..0.5
        this._spriteIskier = new Map();  // "H, S%, L%" -> canvas, wypalony RAZ (P2d)
    }

    get liczba() {
        return this.aktywne.reduce((n, r) => n + (r.iskry?.length ?? 0), 0);
    }

    /**
     * Wywołać po zmianie NASTAWY.RASTER_PX (stare rastry glifów mają stary
     * rozmiar/próbkowanie) albo NASTAWY.ISKRY_PROMIEN/ISKRY_POSWIATA_MNOZNIK
     * (stary sprite iskier ma stary rozmiar/gradient).
     */
    wyczyscCache() { this._punktyGlifu.clear(); this._spriteIskier.clear(); }

    /**
     * @param {string} id       id pieczęci (swarog/weles/perun/stribog/mokosz)
     * @param {{x:number,y:number}} zaczep  środek dłoni w PIKSELACH płótna
     * @param {string} barwaHSL  "H, S%, L%" - ta sama string co efekty.js TABELA[id].barwa
     */
    odpal(id, zaczep, barwaHSL) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        const znak = glif(id);
        if (!znak) return;   // pieczęć bez przypisanej runy - cicho, bez wyjątku
        this.aktywne.push({
            id, znak, x: zaczep.x, y: zaczep.y, t: 0,
            barwa: barwaHSL || '40, 90%, 70%',
            iskryOdpalone: false, iskry: []
        });
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx
     * @param {number} W  szerokość płótna w px
     * @param {number} H  wysokość płótna w px
     * @param {number} dt sekundy
     */
    updateAndDraw(ctx, W, H, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;

        for (const r of this.aktywne) {
            r.t += krok;
            this._ruszajIskry(r, krok);
        }
        this.aktywne = this.aktywne.filter(r => r.t < CZAS_CALKOWITY_S || r.iskry.length);

        // Guard PO doliczeniu czasu - patrz nagłówek ekran.js/piorun.js:
        // upływ czasu i wygasanie muszą działać bez document (testy w Node).
        if (!ctx) return;
        if (!this.aktywne.length) return;
        // Brak fontu = ta klatka nie rysuje NIC z tego modułu (GEMINI.md §2).
        if (!fontGotowy()) return;

        const rozmiar = H * NASTAWY.ROZMIAR_WZGL_H;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const r of this.aktywne) {
            this._odpalIskryJesliCzas(r, rozmiar);
            this._rysujJedna(ctx, r, rozmiar);
        }
        ctx.restore();
    }

    _rysujJedna(ctx, r, rozmiar) {
        const faza = fazaRuny(r.t);
        const kolor = (a) => `hsla(${r.barwa}, ${clamp01(a).toFixed(3)})`;

        // Bardzo subtelny pierścień - WYŁĄCZNIE w fazie narodzin (patrz
        // fazaRuny). To jedyny okrąg, jaki ta pieczęć jeszcze rysuje.
        if (faza.subtelnyPierscien > 0) {
            ctx.strokeStyle = kolor(faza.subtelnyPierscien);
            ctx.lineWidth = Math.max(1, rozmiar * 0.03);
            ctx.beginPath();
            ctx.arc(r.x, r.y, rozmiar * (0.35 + 0.25 * faza.p), 0, Math.PI * 2);
            ctx.stroke();
        }

        if (faza.alfaGlif > 0.003) {
            ctx.save();
            // Lustro: odkręcamy odbicie LOKALNIE, tylko dla glifu - patrz
            // nagłówek pliku i debugHud.js:600-608.
            ctx.translate(r.x, r.y);
            ctx.scale(-1, 1);

            if (faza.poswiata > 0) {
                ctx.shadowColor = kolor(Math.min(1, faza.poswiata));
                ctx.shadowBlur = rozmiar * 0.35;
            }
            if (faza.rozmyciePx > 0) ctx.filter = `blur(${faza.rozmyciePx.toFixed(1)}px)`;

            ctx.font = `${Math.round(rozmiar * faza.skala)}px "Noto Sans Runic"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = kolor(faza.alfaGlif);
            ctx.fillText(r.znak, 0, 0);

            ctx.filter = 'none';
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        this._rysujIskry(ctx, r);
    }

    /** Iskry rozsypania - odrywają się z pikseli glifu, unoszą i gasną. */
    _odpalIskryJesliCzas(r, rozmiar) {
        if (r.iskryOdpalone || r.t < CZAS_ZAR_DO_S) return;
        r.iskryOdpalone = true;

        const wolnyBudzet = NASTAWY.MAX_ISKIER_LACZNIE - this.liczba;
        if (wolnyBudzet <= 0) return;

        const punkty = this._punktyGlifu.get(r.znak) ?? this._rasteryzujIZapamietaj(r.znak);
        if (!punkty.length) return;

        const n = Math.min(NASTAWY.MAX_ISKIER_NA_RUNE, wolnyBudzet, punkty.length);
        // Próbka BEZ powtórzeń z permutacji indeksów - punkty rozłożone
        // równomiernie po całym glifie, nie skupione w jednym rogu.
        const idx = losowaProbka(punkty.length, n);
        for (const i of idx) {
            const pkt = punkty[i];
            r.iskry.push({
                x: r.x + pkt.x * rozmiar,
                y: r.y + pkt.y * rozmiar,
                vx: (Math.random() - 0.5) * NASTAWY.ISKRY_VX_ROZRZUT,
                vy: -NASTAWY.ISKRY_VY_BAZA - Math.random() * NASTAWY.ISKRY_VY_ROZRZUT,
                wiek: 0,
                zycie: NASTAWY.ISKRY_ZYCIE_MIN + Math.random() * NASTAWY.ISKRY_ZYCIE_ROZRZUT
            });
        }
    }

    _ruszajIskry(r, krok) {
        if (!r.iskry.length || krok <= 0) return;
        const zywe = [];
        for (const c of r.iskry) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;
            c.vy -= NASTAWY.ISKRY_UNOS * krok;   // lekki unos, jak żar w ogien.js/iskry.js
            c.x += c.vx * krok;
            c.y += c.vy * krok;
            if (Number.isFinite(c.x) && Number.isFinite(c.y)) zywe.push(c);
        }
        r.iskry = zywe;
    }

    /**
     * Sprite WYPALONY RAZ per barwa (P2d, 2026-09-21) - poprzednia wersja
     * budowała createRadialGradient PER CZĄSTKA PER KLATKĘ, jedyne takie
     * miejsce w całej grze (reszta modułów VFX piecze gradient raz przy
     * starcie - patrz iskry.js/ogien.js/fala.js "sprite wypalony raz").
     * Cache kluczowany r.barwa (Map, per instancję Runy - różne pieczęcie
     * mają różne barwy, każda dostaje własny wpis).
     */
    _rysujIskry(ctx, r) {
        if (!r.iskry.length) return;
        let sprite = this._spriteIskier.get(r.barwa);
        if (!sprite) {
            const [red, green, blue] = hslNaRgb(r.barwa);
            sprite = spriteRadialny(red, green, blue, NASTAWY.ISKRY_SPRITE_PX);
            this._spriteIskier.set(r.barwa, sprite);
        }
        for (const c of r.iskry) {
            const p = c.wiek / c.zycie;
            const alfa = (1 - p) * (1 - p);
            const rad = NASTAWY.ISKRY_PROMIEN * (1 - p * 0.5) * NASTAWY.ISKRY_POSWIATA_MNOZNIK;
            ctx.globalAlpha = Math.max(0, Math.min(1, alfa));
            ctx.drawImage(sprite, c.x - rad, c.y - rad, rad * 2, rad * 2);
        }
        ctx.globalAlpha = 1;
    }

    /** Wypala glif na płótno pomocnicze RAZ, próbkuje piksele > próg alfy. */
    _rasteryzujIZapamietaj(znak) {
        const punkty = rasteryzujGlif(znak);
        this._punktyGlifu.set(znak, punkty);
        return punkty;
    }
}

/** Próbka n unikalnych indeksów z [0, n) bez tworzenia całej permutacji. */
function losowaProbka(z, n) {
    const wybrane = new Set();
    // n zwykle << z (90 z kilkuset punktów) - odrzucanie kolizji jest tanie.
    while (wybrane.size < n) wybrane.add(Math.floor(Math.random() * z));
    return wybrane;
}

/**
 * Rasteryzuje jeden glif na offscreen canvas i zwraca punkty (znormalizowane
 * do -0.5..0.5 względem rozmiaru wypalenia) tam, gdzie alfa > próg.
 *
 * Wołane WYŁĄCZNIE z wnętrza updateAndDraw() (a więc tylko gdy ctx istnieje
 * i font jest gotowy) - nigdy przy imporcie modułu, ten sam kontrakt co
 * zrobSprites() w iskry.js.
 */
function rasteryzujGlif(znak) {
    const c = document.createElement('canvas');
    c.width = c.height = NASTAWY.RASTER_PX;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.font = `${Math.round(NASTAWY.RASTER_PX * 0.72)}px "Noto Sans Runic"`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(znak, NASTAWY.RASTER_PX / 2, NASTAWY.RASTER_PX / 2);

    const dane = x.getImageData(0, 0, NASTAWY.RASTER_PX, NASTAWY.RASTER_PX).data;
    const pkt = [];
    const krok = 3;
    for (let y = 0; y < NASTAWY.RASTER_PX; y += krok) {
        for (let px = 0; px < NASTAWY.RASTER_PX; px += krok) {
            const a = dane[(y * NASTAWY.RASTER_PX + px) * 4 + 3];
            if (a > 128) {
                pkt.push({ x: (px - NASTAWY.RASTER_PX / 2) / NASTAWY.RASTER_PX, y: (y - NASTAWY.RASTER_PX / 2) / NASTAWY.RASTER_PX });
            }
        }
    }
    // Font niezaładowany naprawdę (mimo fontGotowy()==true, granica) dałby
    // pustą rasteryzację - fallback jeden punkt w środku, żeby _odpalIskryJesliCzas
    // nie próbowało próbki z zerowej tablicy w nieskończoność.
    return pkt.length ? pkt : [{ x: 0, y: 0 }];
}
