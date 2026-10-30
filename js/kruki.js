/**
 * Kruki - nagroda za combo weles -> stribog -> perun (2026-10-13, spec
 * docs/superpowers/specs/2026-10-13-fala-i-kruki-design.md).
 * Ziemia (Weles, pan zaświatów) otwiera cień, wiatr (Stribog) go podrywa,
 * grom (Perun) płoszy: z ciemności za tancerzem zrywa się stado kruków.
 * Prefiks weles -> stribog to Zawierucha - odpala się PO DRODZE (łańcuch,
 * js/kombosy.js nagłówek), więc kruki wylatują w pył Zawieruchy.
 *
 * TRZY WARSTWY CZASU:
 *  1. CIEŃ: ciemna mgiełka wzbiera ZA sylwetką na wysokości barków
 *     (js/warstwaZaSylwetka.js) - efekty przy barkach działają, przy
 *     dłoniach zawodzą (lekcja z Łuku Peruna).
 *  2. STADO: kruki wyrywają się z cienia, krążą łukami w górę i na boki;
 *     pierwsze chwile lotu - jeszcze za sylwetką; gubią pióra. Kruk, który
 *     nie zdążył wylecieć z kadru, ROZWIEWA SIĘ w czarny dym i pióra.
 *  3. KRUK NA EKRAN (decyzja właściciela): jeden kruk wylatuje przez namiot
 *     palców Iglicy Peruna i leci wprost na kamerę - rośnie i ROZMYWA SIĘ
 *     jak w obiektywie z małą głębią ostrości, aż zasłoni kadr i rozpadnie
 *     się w dym i pióra z krótkim przyciemnieniem. Zaczep: NADGARSTKI POZY
 *     (15, 16), nie dłonie - przy rękach nad głową MediaPipe widzi obie
 *     dłonie tylko w 31% klatek (js/znaki/perun.js).
 *
 * VFX v2 (2026-10-13, po teście właściciela: "dłużej, lepszy wygląd, rozmycie"):
 *  - SYLWETKA: kontur z punktów (widok z dołu) - masywny dziób, klinowy
 *    ogon, rozcapierzone lotki, ząbkowana krawędź spływu; pozy skrzydeł
 *    (góra / poziomo / dół) wyliczane z fazy machania; gradient od
 *    czarnego tułowia do chłodnej szarości lotek + połysk krawędzi natarcia.
 *  - SMUGI RUCHU: "duchy" na poprzednich pozycjach, rysowane na osobnej
 *    warstwie i rozmyte JEDNYM ctx.filter na klatkę (nie filtr na kruka).
 *  - GŁĘBIA OSTROŚCI: każdy kruk ma plan (glab) - dalsze mniejsze i lekko
 *    rozmyte; kruk na ekran rozmywa się tym mocniej, im bliżej kamery.
 *  - ROZPAD: dym z tekstur CC0 (smoke_*, tint BARWA_CIENIA, source-over).
 * Bez document (testy w Node) - wszystko rysuje się ostro wprost na ctx.
 *
 * Bez reakcji z polami (decyzja właściciela 2026-10-13: najpierw test na kamerze).
 */
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';
import { MANIFEST, losowyWariant, wypalTintowany } from './assety.js';

// ZGADNIĘTE - strojenie na nakładce D (pole kruki) i w tools/scena.html.
export const NASTAWY = {
    CIEN_NAROST: 0.6,          // s
    CIEN_ZYCIE: 3.6,           // s
    CIEN_PROMIEN: 1.3,         // skala * to
    CIEN_KLEBOW: 9,
    CIEN_ALFA: 0.55,
    LICZBA_STADA: 15,
    STADO_OD: 0.35,            // s - pierwszy kruk
    STADO_DO: 1.6,             // s - ostatni kruk
    PREDKOSC: 2.5,             // skala / s (± 30%)
    SKRET: 0.9,                // rad / s (±) - łuki zamiast prostej ucieczki z kadru
    // KRĄŻENIE (v2: "widoczne dłużej"): do KRAZENIE_DO_S kruk, który oddalił
    // się od tancerza dalej niż ORBITA, skręca na styczną okręgu wokół
    // głowy - stado kołuje nad graczem, zamiast w sekundę uciec z kadru.
    KRAZENIE_DO_S: 2.6,
    ORBITA: 1.6,               // skala * to - promień od punktu nad głową
    ORBITA_NAD: 0.9,           // skala * to - środek orbity nad barkami
    MAX_SKRETU: 2.6,           // rad / s
    ROZPIETOSC: 0.5,           // skala * to (± 25%, × plan)
    ZA_SYLWETKA_S: 0.25,       // s - początek lotu za graczem
    MACHANIE_HZ: 5.5,
    ZYCIE_KRUKA: 3.6,          // s
    ROZPAD_S: 0.8,             // s - końcówka życia: kruk rozwiewa się w dym
    DYMU_NA_ROZPAD: 5,
    ZYCIE_DYMU: 1.1,
    DUCHY: [3, 6, 9],          // klatki wstecz (historia pozycji) - smuga ruchu
    ALFA_DUCHA: 0.32,
    ROZMYCIE_DUCHOW: 4,        // px
    ROZMYCIE_DALEKICH: 2.2,    // px - plan dalszy (glab > PROG_DALEKI)
    PROG_DALEKI: 0.6,
    PIOR_NA_KRUKA: 2,
    ZYCIE_PIORA: 3.2,
    OPADANIE: 0.4,             // skala / s
    EKRAN_START: 0.6,          // s - kruk na ekran rusza po złożeniu cienia
    EKRAN_CZAS: 2.0,           // s - od namiotu palców do zasłonięcia kadru
    EKRAN_ROZP_OD: 0.35,       // skala * to
    EKRAN_ROZP_DO: 1.15,       // W * to - na końcu skrzydła poza kadrem
    EKRAN_MACHANIE_HZ: 2.6,
    EKRAN_ROZMYCIE: 16,        // px przy samej kamerze (głębia ostrości)
    EKRAN_PIOR: 14,
    EKRAN_DYMU: 8,
    PRZYCIEMNIENIE: 0.4,       // alfa czerni kadru w chwili zasłonięcia
    PRZYCIEMNIENIE_S: 0.6,
    NAD_GLOWA: 1.3,            // skala * to - fallback zaczepu nad barkami
    PROG_WIDOCZNOSCI: 0.5,
    BARWA: [16, 14, 24],
    BARWA_LOTEK: [52, 54, 72],
    BARWA_POLYSKU: [120, 130, 170],
    BARWA_CIENIA: [12, 8, 20]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const gladko = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
const losuj = (a, b) => a + Math.random() * (b - a);
const rgb = (c) => `rgb(${c.join(',')})`;
const MAMY_DOM = typeof document !== 'undefined';

/**
 * Namiot palców Iglicy: środek nadgarstków pozy, gdy oba widać i są NAD
 * linią barków; inaczej punkt nad głową z barków; bez pozy - null.
 * Czysta funkcja. @returns {{x, y, skala}|null}  px
 */
export function zaczepIglicy(frame, W, H) {
    const N = NASTAWY;
    const barki = barkiKlatki(frame, W, H);
    if (!barki) return null;
    const lm = frame?.pose?.landmarks;
    const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
        && !(Number.isFinite(p.visibility) && p.visibility < N.PROG_WIDOCZNOSCI);
    const a = lm?.[15], b = lm?.[16];
    if (ok(a) && ok(b)) {
        const x = (a.x + b.x) / 2 * W, y = (a.y + b.y) / 2 * H;
        if (y < barki.y) return { x, y, skala: barki.skala };
    }
    return { x: barki.x, y: barki.y - barki.skala * N.NAD_GLOWA, skala: barki.skala };
}

/** Postęp kruka na ekran 0..1 (przyspiesza - perspektywa). Czysta funkcja. */
export function postepNaEkran(t) {
    const u = clamp01(t / NASTAWY.EKRAN_CZAS);
    return u * u;
}

/** Rozpiętość kruka na ekran w px w chwili t (od jego startu). Czysta funkcja. */
export function rozpietoscNaEkran(t, sk, W) {
    const N = NASTAWY;
    const od = sk * N.EKRAN_ROZP_OD, d = W * N.EKRAN_ROZP_DO;
    return od * Math.pow(d / od, postepNaEkran(t));
}

/** Rozmycie kruka na ekran w px - rośnie z bliskością kamery. Czysta funkcja. */
export function rozmycieNaEkran(t) {
    return NASTAWY.EKRAN_ROZMYCIE * Math.pow(postepNaEkran(t), 1.6);
}

/** Alfa cienia 0..1 w chwili t. Czysta funkcja. */
export function obwiedniaCienia(t) {
    const N = NASTAWY;
    if (!Number.isFinite(t) || t <= 0 || t >= N.CIEN_ZYCIE) return 0;
    return gladko(t / N.CIEN_NAROST) * Math.min(1, (N.CIEN_ZYCIE - t) / 0.9);
}

/** Alfa kruka ze stada 0..1: pojawienie i rozpad na końcu życia. Czysta funkcja. */
export function alfaKruka(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek <= 0 || wiek >= N.ZYCIE_KRUKA) return 0;
    return Math.min(1, wiek / 0.15) * (1 - gladko((wiek - (N.ZYCIE_KRUKA - N.ROZPAD_S)) / N.ROZPAD_S));
}

// Kontur PRAWEJ połowy kruka widzianego od dołu (x w prawo = skrzydło,
// y w dół = ogon, dziób na -y), skrzydła poziomo, rozpiętość 2 (x -1..1).
// Trzecia liczba: 1 = ostry węzeł (lotka, dziób) - bez wygładzania.
const KONTUR = [
    [0, -0.66, 1], [0.03, -0.55, 0], [0.065, -0.47, 0], [0.06, -0.38, 0], [0.085, -0.28, 0],
    [0.3, -0.31, 0], [0.52, -0.29, 0], [0.72, -0.22, 0], [0.84, -0.16, 1],
    [1.0, -0.09, 1], [0.9, -0.06, 1], [0.99, -0.01, 1], [0.87, 0.01, 1], [0.94, 0.07, 1], [0.81, 0.07, 1],
    [0.85, 0.13, 1], [0.71, 0.11, 1],
    [0.62, 0.16, 1], [0.54, 0.12, 1], [0.45, 0.17, 1], [0.36, 0.13, 1], [0.27, 0.17, 1], [0.17, 0.13, 0],
    [0.09, 0.14, 0], [0.065, 0.26, 0], [0.17, 0.56, 1], [0.08, 0.52, 1], [0, 0.58, 1]
];
const BAREK = 0.085;

/**
 * Kontur kruka w pozie `mach` (-1 skrzydła w dole .. 1 w górze), lokalnie
 * (rozpiętość 2). `front` - widok "na kamerę": skrzydła idą też w pionie.
 * Czysta funkcja. @returns {{x, y, o}[]}  pełny kontur (prawa + lustro lewej)
 */
export function konturKruka(mach, front = false) {
    const gora = Math.max(0, mach), dol = Math.max(0, -mach);
    const zasieg = 1 - 0.42 * gora - 0.18 * dol;         // skrót perspektywy uniesionego skrzydła
    const skos = -0.18 * gora + 0.12 * dol;              // końce do przodu (góra) / do tyłu (dół)
    const pion = front ? -0.55 * mach : 0;
    const prawa = KONTUR.map(([x, y, o]) => {
        if (x <= BAREK) return { x, y, o };
        const w = (x - BAREK) / (1 - BAREK);              // 0 przy barku, 1 na końcu
        return { x: BAREK + (x - BAREK) * zasieg, y: y + skos * w + pion * w * w, o };
    });
    const lewa = prawa.slice(1, -1).reverse().map(p => ({ x: -p.x, y: p.y, o: p.o }));
    return [...prawa, ...lewa];
}

/** Kontur jako ścieżka: ostre węzły prosto, reszta wygładzona przez środki. */
function sciezka(c, pkt, R) {
    const h = R / 2;
    c.beginPath();
    c.moveTo(pkt[0].x * h, pkt[0].y * h);
    for (let i = 1; i < pkt.length; i++) {
        const p = pkt[i], n = pkt[(i + 1) % pkt.length];
        if (p.o) c.lineTo(p.x * h, p.y * h);
        else c.quadraticCurveTo(p.x * h, p.y * h, (p.x + n.x) / 2 * h, (p.y + n.y) / 2 * h);
    }
    c.closePath();
}

/**
 * Sylwetka kruka. (x, y) - środek, R - rozpiętość px, faza - machanie
 * (radiany), kat - kierunek lotu (oś tułowia), alfa, front - widok na kamerę.
 */
export function rysujKruka(c, x, y, R, faza, kat, alfa, front = false) {
    const N = NASTAWY;
    if (!(R > 0.5) || !(alfa > 0.005) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const mach = Math.sin(faza);
    const pkt = konturKruka(mach, front);
    c.save();
    c.translate(x, y);
    c.rotate(kat + Math.PI / 2);          // lokalnie: przód = -y, skrzydła wzdłuż x
    c.globalAlpha = clamp01(alfa);
    const h = R / 2;
    if (typeof c.createRadialGradient === 'function') {
        const g = c.createRadialGradient(0, 0, h * 0.08, 0, 0, h);
        g.addColorStop(0, rgb(N.BARWA));
        g.addColorStop(0.45, rgb(N.BARWA));
        g.addColorStop(1, rgb(N.BARWA_LOTEK));
        c.fillStyle = g;
    } else c.fillStyle = rgb(N.BARWA);
    sciezka(c, pkt, R);
    c.fill();
    // Połysk: krawędź natarcia obu skrzydeł (węzły 4..8) - chłodna kreska.
    c.strokeStyle = rgb(N.BARWA_POLYSKU);
    c.globalAlpha = clamp01(alfa * (0.35 + 0.25 * Math.max(0, mach)));
    c.lineWidth = Math.max(1, R * 0.01);
    c.lineCap = 'round';
    for (const s of [1, -1]) {
        c.beginPath();
        for (let i = 4; i <= 8; i++) {
            const p = pkt[i];
            if (i === 4) c.moveTo(s * p.x * h, p.y * h + R * 0.004); else c.lineTo(s * p.x * h, p.y * h + R * 0.004);
        }
        c.stroke();
    }
    c.restore();
}

/** Pióro: wąski liść z dutką. */
function rysujPioro(c, p, sk, alfa) {
    const N = NASTAWY, d = p.rozmiar * sk;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.kat);
    c.globalAlpha = clamp01(alfa);
    c.fillStyle = rgb(N.BARWA);
    c.beginPath();
    c.moveTo(0, -d);
    c.quadraticCurveTo(d * 0.75, -d * 0.2, 0, d);
    c.quadraticCurveTo(-d * 0.6, -d * 0.1, 0, -d);
    c.fill();
    c.strokeStyle = rgb(N.BARWA_POLYSKU);
    c.globalAlpha = clamp01(alfa * 0.45);
    c.lineWidth = Math.max(1, d * 0.04);
    c.beginPath(); c.moveTo(0, -d); c.lineTo(0, d * 1.15); c.stroke();
    c.restore();
}

/** Offscreen warstwa do rozmycia (jeden filtr na warstwę) - null bez DOM. */
class WarstwaRozmycia {
    constructor() { this._cv = null; this._c = null; }
    zacznij(W, H) {
        if (!MAMY_DOM) return null;
        if (!this._cv) { this._cv = document.createElement('canvas'); this._c = this._cv.getContext('2d'); }
        if (!this._c) return null;
        if (this._cv.width !== W || this._cv.height !== H) { this._cv.width = W; this._cv.height = H; }
        this._c.setTransform(1, 0, 0, 1, 0, 0);
        this._c.clearRect(0, 0, W, H);
        return this._c;
    }
    zakoncz(ctx, px) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        if (px > 0.3) ctx.filter = `blur(${px.toFixed(1)}px)`;
        ctx.drawImage(this._cv, 0, 0);
        ctx.restore();
    }
}

export class Kruki {
    constructor() {
        this._t = -1;
        this._sila = 0;
        this._stado = [];
        this._piora = [];
        this._dym = [];
        this._klebY = [];
        this._naEkran = null;      // {x0, y0, wiek, rozbity, x, y}
        this._iglica = null;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._duchy = new WarstwaRozmycia();
        this._dalekie = new WarstwaRozmycia();
        this._bliski = new WarstwaRozmycia();
        this._zaczep = null;
        this._W = 1920; this._H = 1080;
    }

    get aktywny() { return this._t >= 0; }
    get diagnostyka() {
        return { t: this._t, stado: this._stado.length, piora: this._piora.length, dym: this._dym.length, naEkran: !!this._naEkran };
    }

    wyczyscCache() {}

    /**
     * @param {number} sila
     * @param {{x, y}|null} [iglica]  namiot palców w chwili combo (zaczepIglicy) - px
     */
    zapal(sila = 1, iglica = null) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        const N = NASTAWY;
        this._sila = s;
        this._t = 0;
        this._iglica = iglica && Number.isFinite(iglica.x) && Number.isFinite(iglica.y) ? { x: iglica.x, y: iglica.y } : null;
        this._naEkran = null;
        this._stado = Array.from({ length: N.LICZBA_STADA }, (_, i) => {
            const strona = i % 2 ? 1 : -1;
            const glab = Math.random();                              // 0 blisko .. 1 daleko
            return {
                start: N.STADO_OD + (N.STADO_DO - N.STADO_OD) * (i / Math.max(1, N.LICZBA_STADA - 1)) + losuj(-0.05, 0.05),
                kat: -Math.PI / 2 + strona * losuj(0.2, 1.2),        // w górę i na boki
                skret: strona * losuj(-0.3, 1) * N.SKRET,            // łuk najczęściej "na zewnątrz"
                v: N.PREDKOSC * losuj(0.7, 1.3) * (1.15 - 0.3 * glab),
                rozp: N.ROZPIETOSC * losuj(0.75, 1.25) * (1.25 - 0.55 * glab),
                glab,
                dx: losuj(-0.6, 0.6), dy: losuj(-0.25, 0.35),
                faza: losuj(0, Math.PI * 2), hz: N.MACHANIE_HZ * losuj(0.85, 1.15),
                kierunekOrbity: strona,
                wylecial: false, x: 0, y: 0, wiek: 0, dymu: 0, hist: []
            };
        });
        this._klebY = Array.from({ length: N.CIEN_KLEBOW }, () => ({ dx: losuj(-1, 1), dy: losuj(-0.5, 0.6), r: losuj(0.4, 0.8), faza: losuj(0, 6) }));
    }

    _pioro(x, y, rozmiar, vx = losuj(-0.3, 0.3), vy = losuj(-0.2, 0.2)) {
        this._piora.push({ x, y, vx, vy, wiek: 0, rozmiar, kat: losuj(0, Math.PI * 2), wir: losuj(-3, 3), faza: losuj(0, 6) });
    }

    _klab(x, y, r, vx = 0, vy = 0) {
        this._dym.push({ x, y, r, vx, vy, wiek: 0, kat: losuj(0, 6.28), wir: losuj(-0.8, 0.8) });
    }

    updateAndDraw(ctx, k, dt) {
        if (!this.aktywny) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this._W = W; this._H = H;
        this._zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const z = this._zaczep, sk = z.skala;
        this._t += krok;
        const t = this._t;

        // Stado: start z cienia wokół barków, potem lot łukiem; końcówka życia - rozpad w dym.
        for (const kr of this._stado) {
            if (t < kr.start) continue;
            if (!kr.wylecial) {
                kr.wylecial = true;
                kr.x = z.x + kr.dx * sk; kr.y = z.y + kr.dy * sk;
                for (let i = 0; i < N.PIOR_NA_KRUKA; i++) this._pioro(kr.x, kr.y, losuj(0.05, 0.08));
            }
            kr.wiek += krok;
            kr.kat += kr.skret * krok;
            if (kr.wiek < N.KRAZENIE_DO_S) {
                const ox = z.x, oy = z.y - sk * N.ORBITA_NAD;
                const odl = Math.hypot(kr.x - ox, kr.y - oy) / sk;
                if (odl > N.ORBITA * 0.7) {
                    const cel = Math.atan2(kr.y - oy, kr.x - ox) + kr.kierunekOrbity * Math.PI / 2
                        - kr.kierunekOrbity * 0.6 * clamp01(odl / N.ORBITA - 1);   // poza orbitą - do środka
                    let roz = cel - kr.kat;
                    roz = Math.atan2(Math.sin(roz), Math.cos(roz));
                    const maks = N.MAX_SKRETU * krok * clamp01((odl / N.ORBITA - 0.7) / 0.5);
                    kr.kat += Math.max(-maks, Math.min(maks, roz));
                }
            }
            const v = kr.v * sk * (0.55 + 0.45 * Math.min(1, kr.wiek / 0.5));
            kr.x += Math.cos(kr.kat) * v * krok;
            kr.y += Math.sin(kr.kat) * v * krok;
            kr.hist.unshift({ x: kr.x, y: kr.y, kat: kr.kat, faza: kr.faza + kr.wiek * kr.hz * Math.PI * 2 });
            if (kr.hist.length > 12) kr.hist.length = 12;
            const odRozpadu = kr.wiek - (N.ZYCIE_KRUKA - N.ROZPAD_S);
            if (odRozpadu > 0) {
                const nalezne = Math.min(N.DYMU_NA_ROZPAD, Math.ceil(N.DYMU_NA_ROZPAD * odRozpadu / N.ROZPAD_S));
                while (kr.dymu < nalezne) {
                    kr.dymu++;
                    const r = kr.rozp * sk * losuj(0.25, 0.45);
                    this._klab(kr.x + losuj(-0.3, 0.3) * r, kr.y + losuj(-0.3, 0.3) * r, r,
                        Math.cos(kr.kat) * v * 0.3, Math.sin(kr.kat) * v * 0.3);
                    if (kr.dymu === 2) this._pioro(kr.x, kr.y, losuj(0.05, 0.08));
                }
            }
        }
        this._stado = this._stado.filter(kr => !kr.wylecial || (kr.wiek < N.ZYCIE_KRUKA
            && kr.x > -sk * 2 && kr.x < W + sk * 2 && kr.y > -sk * 2));

        // Kruk na ekran.
        if (!this._naEkran && t >= N.EKRAN_START) {
            const s = this._iglica ?? { x: z.x, y: z.y - sk * N.NAD_GLOWA };
            this._naEkran = { x0: s.x, y0: s.y, wiek: 0, rozbity: false, x: s.x, y: s.y };
        }
        const e = this._naEkran;
        if (e) {
            e.wiek += krok;
            const u = postepNaEkran(e.wiek);
            e.x = e.x0 + (W / 2 - e.x0) * u;
            e.y = e.y0 + (H * 0.45 - e.y0) * u - Math.sin(Math.min(1, e.wiek / N.EKRAN_CZAS) * Math.PI) * sk * 0.4;
            if (!e.rozbity && e.wiek >= N.EKRAN_CZAS) {
                e.rozbity = true;
                for (let i = 0; i < N.EKRAN_PIOR; i++) {
                    this._pioro(W / 2 + losuj(-0.35, 0.35) * W, H / 2 + losuj(-0.35, 0.35) * H, losuj(0.1, 0.18),
                        losuj(-2, 2), losuj(-1.5, 0.5));
                }
                for (let i = 0; i < N.EKRAN_DYMU; i++) {
                    this._klab(W / 2 + losuj(-0.4, 0.4) * W, H / 2 + losuj(-0.3, 0.3) * H, losuj(0.12, 0.25) * H,
                        losuj(-1, 1) * sk, losuj(-1, 0.5) * sk);
                }
            }
        }

        for (const p of this._piora) {
            p.wiek += krok;
            p.x += (p.vx + Math.sin(p.wiek * 2.5 + p.faza) * 0.5) * sk * krok;
            p.y += (p.vy + N.OPADANIE) * sk * krok;
            p.vx *= Math.exp(-2 * krok); p.vy *= Math.exp(-2 * krok);
            p.kat += p.wir * krok * 0.5;
        }
        this._piora = this._piora.filter(p => p.wiek < N.ZYCIE_PIORA && p.y < H + sk);
        for (const d of this._dym) {
            d.wiek += krok;
            d.x += d.vx * krok; d.y += d.vy * krok - sk * 0.15 * krok;
            d.vx *= Math.exp(-1.5 * krok); d.vy *= Math.exp(-1.5 * krok);
            d.r *= 1 + 0.6 * krok;
            d.kat += d.wir * krok;
        }
        this._dym = this._dym.filter(d => d.wiek < N.ZYCIE_DYMU);

        const ekranTrwa = e ? (e.wiek < N.EKRAN_CZAS + N.PRZYCIEMNIENIE_S) : t < N.EKRAN_START + 0.1;
        if (t >= N.CIEN_ZYCIE && !this._stado.length && !this._piora.length && !this._dym.length && !ekranTrwa) {
            this._t = -1;
            this._naEkran = null;
            return;
        }
        if (!ctx) return;
        this._rysuj(ctx, k, t, e);
    }

    _rysuj(ctx, k, t, e) {
        const N = NASTAWY, W = this._W, H = this._H, sk = this._zaczep.skala;

        // Cień i kruki w pierwszych chwilach lotu - ZA sylwetką.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._rysujCien(tyl, t);
            for (const kr of this._stado) {
                if (kr.wylecial && kr.wiek < N.ZA_SYLWETKA_S) this._rysujZeStada(tyl, kr);
            }
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }

        // Smugi ruchu: duchy wszystkich kruków na jednej warstwie, jedno rozmycie.
        const duchy = this._duchy.zacznij(W, H) ?? ctx;
        for (const kr of this._stado) {
            if (!kr.wylecial || kr.wiek < N.ZA_SYLWETKA_S) continue;
            const a0 = alfaKruka(kr.wiek) * this._sila;
            N.DUCHY.forEach((wstecz, i) => {
                const h = kr.hist[wstecz];
                if (h) rysujKruka(duchy, h.x, h.y, kr.rozp * sk, h.faza, h.kat, a0 * N.ALFA_DUCHA * (1 - i / N.DUCHY.length));
            });
        }
        if (duchy !== ctx) this._duchy.zakoncz(ctx, N.ROZMYCIE_DUCHOW);

        // Plan dalszy - lekko rozmyty; bliższy - ostry.
        const dalekie = this._dalekie.zacznij(W, H) ?? ctx;
        for (const kr of this._stado) {
            if (!kr.wylecial || kr.wiek < N.ZA_SYLWETKA_S || kr.glab <= N.PROG_DALEKI) continue;
            this._rysujZeStada(dalekie, kr);
        }
        if (dalekie !== ctx) this._dalekie.zakoncz(ctx, N.ROZMYCIE_DALEKICH);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        for (const kr of this._stado) {
            if (!kr.wylecial || kr.wiek < N.ZA_SYLWETKA_S || kr.glab > N.PROG_DALEKI) continue;
            this._rysujZeStada(ctx, kr);
        }
        this._rysujDym(ctx);
        for (const p of this._piora) {
            rysujPioro(ctx, p, sk, this._sila * Math.min(1, (N.ZYCIE_PIORA - p.wiek) / 0.6) * 0.9);
        }
        ctx.restore();

        if (e) this._rysujNaEkran(ctx, e);
    }

    _rysujZeStada(c, kr) {
        const sk = this._zaczep.skala;
        const h = kr.hist[0];
        if (!h) return;
        rysujKruka(c, h.x, h.y, kr.rozp * sk, h.faza, h.kat, alfaKruka(kr.wiek) * this._sila);
    }

    _rysujDym(c) {
        const N = NASTAWY;
        const tex = losowyWariant(MANIFEST.mgla);
        for (const d of this._dym) {
            const a = 0.45 * this._sila * Math.sin(Math.PI * Math.min(1, d.wiek / N.ZYCIE_DYMU)) ** 0.7;
            if (!(a > 0.005)) continue;
            c.globalAlpha = clamp01(a);
            if (tex) {
                c.save(); c.translate(d.x, d.y); c.rotate(d.kat);
                c.drawImage(wypalTintowany(d.tex ??= tex, N.BARWA_CIENIA, 128), -d.r, -d.r, d.r * 2, d.r * 2);
                c.restore();
            } else if (typeof c.createRadialGradient === 'function') {
                const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
                g.addColorStop(0, `rgba(${N.BARWA_CIENIA.join(',')},0.9)`);
                g.addColorStop(1, `rgba(${N.BARWA_CIENIA.join(',')},0)`);
                c.fillStyle = g;
                c.beginPath(); c.arc(d.x, d.y, d.r, 0, Math.PI * 2); c.fill();
            }
        }
        c.globalAlpha = 1;
    }

    _rysujCien(c, t) {
        const N = NASTAWY, z = this._zaczep, sk = z.skala;
        const a = obwiedniaCienia(t) * this._sila * N.CIEN_ALFA;
        if (a < 0.005) return;
        c.save();
        c.globalCompositeOperation = 'source-over';
        for (const kl of this._klebY) {
            const x = z.x + kl.dx * sk * N.CIEN_PROMIEN * 0.6 + Math.sin(t * 1.3 + kl.faza) * sk * 0.08;
            const y = z.y + kl.dy * sk * N.CIEN_PROMIEN * 0.6 - t * sk * 0.1;
            const r = kl.r * sk * N.CIEN_PROMIEN * (0.7 + 0.3 * gladko(t / N.CIEN_NAROST));
            const g = c.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(${N.BARWA_CIENIA.join(',')},1)`);
            g.addColorStop(1, `rgba(${N.BARWA_CIENIA.join(',')},0)`);
            c.globalAlpha = clamp01(a);
            c.fillStyle = g;
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
    }

    _rysujNaEkran(ctx, e) {
        const N = NASTAWY, W = this._W, H = this._H, sk = this._zaczep.skala;
        if (e.wiek < N.EKRAN_CZAS) {
            const R = rozpietoscNaEkran(e.wiek, sk, W);
            const blisko = postepNaEkran(e.wiek);
            // Tuż przed kamerą kruk "przenika" przez obiektyw - blednie w rozmyciu.
            const alfa = this._sila * Math.min(1, e.wiek / 0.12) * (1 - 0.35 * gladko((blisko - 0.75) / 0.25));
            const faza = e.wiek * N.EKRAN_MACHANIE_HZ * Math.PI * 2;
            const c = this._bliski.zacznij(W, H) ?? ctx;
            c.save();
            c.globalCompositeOperation = 'source-over';
            rysujKruka(c, e.x, e.y, R, faza, -Math.PI / 2, alfa, true);
            c.restore();
            if (c !== ctx) this._bliski.zakoncz(ctx, rozmycieNaEkran(e.wiek));
        }
        const po = e.wiek - N.EKRAN_CZAS;
        if (po > -0.15 && po < N.PRZYCIEMNIENIE_S) {
            const a = po < 0 ? (po + 0.15) / 0.15 : 1 - po / N.PRZYCIEMNIENIE_S;
            ctx.save();
            ctx.globalAlpha = clamp01(a * N.PRZYCIEMNIENIE * this._sila);
            ctx.fillStyle = rgb(N.BARWA_CIENIA);
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }
}
