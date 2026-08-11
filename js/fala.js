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
 * Rzut na płótno: s = OGNISKO / (OGNISKO + z) - mniejsze z (bliżej) daje
 * większe s, dalsze cząstki kurczą się i bledną. OGNISKO jest ZGADNIĘTE
 * (jak każda inna stała w tej grze) i wymaga potwierdzenia z nakładki (D).
 *
 * ================= DLACZEGO WYGLĄDA JAK WIATR =================
 * 1. STOŻEK ROSNĄCY Z WIEKIEM. Cząstki startują w wąskim stożku wokół
 *    kierunku i z czasem rozjeżdżają się na boki (pole `roz`, rosnące
 *    w _ruszaj) - to jest "rozpływa się, rozszerzając coraz bardziej".
 * 2. OPÓR. Cząstki zwalniają, więc fala nie leci w nieskończoność.
 * 3. SORTOWANIE PO Z przed rysowaniem - dalsze cząstki pod bliższymi.
 * 4. SPRITE WYPALONY RAZ - ten sam powód co w ogien.js: gradient na
 *    cząstkę na klatkę zabija FPS przy setkach cząstek.
 * 5. JEDNA BARWA. Wiatr sam w sobie jest niewidzialny - widać zaburzenie,
 *    nie powietrze, więc bez rampy barw jak w ogniu (który jest emisyjny).
 */

const OGNISKO_DOMYSLNE = 900;      // px - ZGADNIĘTE, stroić klawiszem D
export const OGNISKO = OGNISKO_DOMYSLNE;

const SPRITE_PX = 40;
const BARWA = [214, 240, 255];     // blady błękit - patrz efekty.js (aard)

const NA_WYSTRZAL = 220;           // cząstek przy pełnej sile (nie na sekundę - jednorazowo)
const PREDKOSC_BAZOWA = 640;       // px/s wzdłuż kierunku, przy pełnej sile
const ROZRZUT_PREDKOSCI = 220;     // px/s losowego rozrzutu długości wektora
const ROZWARCIE_START = 0.12;      // rad - stożek WĄSKI w chwili emisji
const ROZPRASZANIE = 260;          // px/s^2 bocznego rozjeżdżania, rośnie z wiekiem
const OPOR = 0.9;                  // 1/s - hamowanie, fala zwalnia zamiast lecieć bez końca
const ZYCIE_MIN = 0.9, ZYCIE_MAX = 1.4;      // s
const ROZMIAR_OD = 0.5, ROZMIAR_DO = 1.4;
const MAX_CZASTECZEK = 500;        // sufit bezpieczeństwa dla klatkażu

/**
 * Rzut perspektywiczny: mniejsze z (bliżej kamery) -> większe s.
 *
 * KLAMROWANE z obu stron: z ucieczką w -OGNISKO (cząstka "za kamerą")
 * mianownik dążyłby do zera i s eksplodowałoby - stąd dolna granica na z.
 * Górna granica na s (3) chroni przed jednym gigantycznym sprite'em, gdyby
 * cząstka poleciała wprost na widza.
 */
export function rzutPerspektywiczny(z, ognisko = OGNISKO) {
    const zc = Number.isFinite(z) ? Math.max(z, -ognisko * 0.6) : 0;
    return Math.min(3, ognisko / (ognisko + zc));
}

function krzyz(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function normalizuj(v) {
    const d = Math.hypot(v.x, v.y, v.z);
    return d > 1e-9 ? { x: v.x / d, y: v.y / d, z: v.z / d } : { x: 1, y: 0, z: 0 };
}
/** Dwa jednostkowe wektory prostopadłe do `os` i do siebie - baza stożka. */
function prostopadleDo(os) {
    const pom = Math.abs(os.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const p1 = normalizuj(krzyz(os, pom));
    const p2 = krzyz(os, p1);   // już znormalizowany: os i p1 są jednostkowe i prostopadłe
    return [p1, p2];
}

export class Fala {
    constructor() {
        this.czastki = [];
        this._sprite = null;
    }

    get liczba() { return this.czastki.length; }

    /**
     * @param {{x,y}} zaczep  źródło w PIKSELACH płótna
     * @param {{x,y,z}} kierunek  wektor 3D (nie musi być jednostkowy)
     * @param {number} sila  0..1
     */
    wystrzel(zaczep, kierunek, sila) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        if (!kierunek) return;
        const dl = Math.hypot(kierunek.x, kierunek.y, kierunek.z);
        if (!(dl > 1e-6)) return;
        const os = { x: kierunek.x / dl, y: kierunek.y / dl, z: kierunek.z / dl };
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;

        const [p1, p2] = prostopadleDo(os);
        const n = Math.round(NA_WYSTRZAL * (0.4 + 0.6 * s));   // słabsza fala = mniej, nie zero
        for (let i = 0; i < n; i++) {
            const kat = ROZWARCIE_START * Math.sqrt(Math.random());
            const phi = Math.random() * Math.PI * 2;
            const kier = {
                x: os.x * Math.cos(kat) + (p1.x * Math.cos(phi) + p2.x * Math.sin(phi)) * Math.sin(kat),
                y: os.y * Math.cos(kat) + (p1.y * Math.cos(phi) + p2.y * Math.sin(phi)) * Math.sin(kat),
                z: os.z * Math.cos(kat) + (p1.z * Math.cos(phi) + p2.z * Math.sin(phi)) * Math.sin(kat),
            };
            const predkosc = (PREDKOSC_BAZOWA * s) * (0.7 + Math.random() * 0.5)
                            + (Math.random() - 0.5) * ROZRZUT_PREDKOSCI;
            // Kierunek bocznego rozpraszania - LOSOWY per cząstka, żeby
            // stożek rozjeżdżał się na wszystkie strony, nie w jedną.
            const rozPhi = Math.random() * Math.PI * 2;
            const roz = {
                x: p1.x * Math.cos(rozPhi) + p2.x * Math.sin(rozPhi),
                y: p1.y * Math.cos(rozPhi) + p2.y * Math.sin(rozPhi),
                z: p1.z * Math.cos(rozPhi) + p2.z * Math.sin(rozPhi),
            };
            this._dodaj({
                x: zaczep.x, y: zaczep.y, z: 0,
                vx: kier.x * predkosc, vy: kier.y * predkosc, vz: kier.z * predkosc,
                roz,
                zycie: ZYCIE_MIN + Math.random() * (ZYCIE_MAX - ZYCIE_MIN),
                skala: ROZMIAR_OD + Math.random() * (ROZMIAR_DO - ROZMIAR_OD),
                wiek: 0
            });
        }
    }

    _dodaj(cz) {
        if (this.czastki.length >= MAX_CZASTECZEK) return;
        this.czastki.push(cz);
    }

    _ruszaj(dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        if (krok <= 0) return;
        const zywe = [];
        for (const c of this.czastki) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;

            const p = c.wiek / c.zycie;
            // Rozwarcie stożka ROŚNIE z wiekiem - fala rozpływa się,
            // rozszerzając coraz bardziej, zamiast lecieć wąskim pękiem.
            c.vx += c.roz.x * ROZPRASZANIE * p * krok;
            c.vy += c.roz.y * ROZPRASZANIE * p * krok;
            c.vz += c.roz.z * ROZPRASZANIE * p * krok;

            const opor = 1 - OPOR * krok;
            c.vx *= opor; c.vy *= opor; c.vz *= opor;
            c.x += c.vx * krok; c.y += c.vy * krok; c.z += c.vz * krok;

            if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)) zywe.push(c);
        }
        this.czastki = zywe;
    }

    _rysuj(ctx) {
        if (!this.czastki.length) return;
        if (!this._sprite) this._sprite = zrobSprite();

        // DALSZE POD BLIŻSZYMI: sortujemy malejąco po z, więc cząstki
        // z najmniejszym z (najbliższe) rysują się na końcu, na wierzchu.
        const posortowane = [...this.czastki].sort((a, b) => b.z - a.z);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const c of posortowane) {
            const p = c.wiek / c.zycie;
            const s = rzutPerspektywiczny(c.z);
            // Szybki narost, powolne wygaszanie - ten sam kształt obwiedni
            // co w ogien.js, żeby cząstki nie pojawiały się skokowo.
            const alfa = Math.sin(Math.min(1, p * 6) * Math.PI * 0.5) * (1 - p) * (1 - p);
            const r = SPRITE_PX * c.skala * s;

            ctx.globalAlpha = Math.max(0, Math.min(1, alfa * s * 0.85));
            ctx.drawImage(this._sprite, c.x - r / 2, c.y - r / 2, r, r);
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

/** Sprite wypalony RAZ - patrz ogien.js:215-236 dla tego samego wzorca. */
function zrobSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_PX;
    const x = c.getContext('2d');
    const [r, g, b] = BARWA;
    const grd = x.createRadialGradient(SPRITE_PX / 2, SPRITE_PX / 2, 0,
                                       SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX / 2);
    grd.addColorStop(0.0, `rgba(${r},${g},${b},0.9)`);
    grd.addColorStop(0.4, `rgba(${r},${g},${b},0.4)`);
    grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    return c;
}
