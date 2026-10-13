/**
 * Kruki - nagroda za combo weles -> stribog -> perun (2026-10-13, spec
 * docs/superpowers/specs/2026-10-13-fala-i-kruki-design.md).
 * Ziemia (Weles, pan zaświatów) otwiera cień, wiatr (Stribog) go podrywa,
 * grom (Perun) płoszy: z ciemności za tancerzem zrywa się stado kruków.
 * Prefiks weles -> stribog to Zawierucha - odpala się PO DRODZE (łańcuch,
 * js/kombosy.js nagłówek), więc kruki wylatują w pył Zawieruchy.
 *
 * TRZY WARSTWY CZASU:
 *  1. CIEŃ (0..~0.6 s): ciemna mgiełka wzbiera ZA sylwetką na wysokości
 *     barków (js/warstwaZaSylwetka.js) - efekty przy barkach działają,
 *     przy dłoniach zawodzą (lekcja z Łuku Peruna).
 *  2. STADO: LICZBA_STADA kruków wyrywa się z cienia, rozlatuje na boki
 *     i w górę poza kadr; pierwsze chwile lotu - jeszcze za sylwetką;
 *     każdy gubi pióra, które opadają kołysząc się.
 *  3. KRUK NA EKRAN (decyzja właściciela): jeden kruk wylatuje przez namiot
 *     palców Iglicy Peruna (pieczęć błyskawicy nad głową) i leci wprost na
 *     kamerę - rośnie, aż zasłoni kadr, i rozpada się w pióra z krótkim
 *     przyciemnieniem. Zaczep: NADGARSTKI POZY (15, 16), nie dłonie - przy
 *     rękach nad głową MediaPipe widzi obie dłonie tylko w 31% klatek
 *     (js/znaki/perun.js). Fallback: punkt nad głową z barków.
 *
 * KRUK = PROCEDURALNA SYLWETKA (brak assetu): tułów, głowa z dziobem, ogon
 * i dwa skrzydła z palcami lotek; skrzydła machają fazą. Prawie czerń
 * z chłodnym połyskiem, source-over - to cień i pióra, nie energia.
 *
 * Bez reakcji z polami (decyzja właściciela 2026-10-13: najpierw test na kamerze).
 */
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

// ZGADNIĘTE - strojenie na nakładce D (pole kruki) i w tools/scena.html.
export const NASTAWY = {
    CIEN_NAROST: 0.5,          // s
    CIEN_ZYCIE: 2.4,           // s
    CIEN_PROMIEN: 1.3,         // skala * to
    CIEN_KLEBOW: 9,
    CIEN_ALFA: 0.55,
    LICZBA_STADA: 15,
    STADO_OD: 0.3,             // s - pierwszy kruk
    STADO_DO: 1.1,             // s - ostatni kruk
    PREDKOSC: 3.6,             // skala / s (± 30%)
    ROZPIETOSC: 0.42,          // skala * to (± 30%)
    ZA_SYLWETKA_S: 0.22,       // s - początek lotu za graczem
    MACHANIE_HZ: 7,
    ZYCIE_KRUKA: 2.2,          // s - i tak wylatuje poza kadr
    PIOR_NA_KRUKA: 2,
    ZYCIE_PIORA: 2.4,
    OPADANIE: 0.45,            // skala / s
    EKRAN_START: 0.45,         // s - kruk na ekran rusza po złożeniu cienia
    EKRAN_CZAS: 1.5,           // s - od namiotu palców do zasłonięcia kadru
    EKRAN_ROZP_OD: 0.35,       // skala * to
    EKRAN_ROZP_DO: 1.15,       // W * to - na końcu skrzydła poza kadrem
    EKRAN_MACHANIE_HZ: 3.2,
    EKRAN_PIOR: 14,
    PRZYCIEMNIENIE: 0.4,       // alfa czerni kadru w chwili zasłonięcia
    PRZYCIEMNIENIE_S: 0.5,
    NAD_GLOWA: 1.3,            // skala * to - fallback zaczepu nad barkami
    PROG_WIDOCZNOSCI: 0.5,
    BARWA: [24, 21, 34],
    BARWA_POLYSKU: [95, 100, 135],
    BARWA_CIENIA: [12, 8, 20]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const gladko = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
const losuj = (a, b) => a + Math.random() * (b - a);

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

/** Alfa cienia 0..1 w chwili t. Czysta funkcja. */
export function obwiedniaCienia(t) {
    const N = NASTAWY;
    if (!Number.isFinite(t) || t <= 0 || t >= N.CIEN_ZYCIE) return 0;
    return gladko(t / N.CIEN_NAROST) * Math.min(1, (N.CIEN_ZYCIE - t) / 0.8);
}

/**
 * Sylwetka kruka. (x, y) - środek, R - rozpiętość px, faza - machanie
 * (radiany), kat - kierunek lotu (oś tułowia), alfa.
 */
export function rysujKruka(c, x, y, R, faza, kat, alfa) {
    const N = NASTAWY;
    if (!(R > 0.5) || !(alfa > 0.005)) return;
    c.save();
    c.translate(x, y);
    c.rotate(kat + Math.PI / 2);          // lokalnie: przód = -y, skrzydła wzdłuż x
    c.globalAlpha = clamp01(alfa);
    c.fillStyle = `rgb(${N.BARWA.join(',')})`;
    const mach = Math.sin(faza);          // -1 dół .. 1 góra
    const h = R / 2;
    // Skrzydła: od barku przez łokieć do końca lotek; koniec idzie góra-dół.
    for (const s of [-1, 1]) {
        const tipY = -mach * h * 0.55 + h * 0.15;
        const lokX = s * h * 0.5, lokY = -mach * h * 0.25 - h * 0.05;
        c.beginPath();
        c.moveTo(s * h * 0.08, -h * 0.12);
        c.quadraticCurveTo(lokX, lokY - h * 0.12, s * h, tipY);
        // Palce lotek - trzy ząbki na krawędzi spływu.
        for (let k = 1; k <= 3; k++) {
            const u = 1 - k * 0.12;
            c.lineTo(s * h * (u + 0.04), tipY + h * 0.05 * k + h * 0.1);
            c.lineTo(s * h * (u - 0.02), tipY + h * 0.04 * k + h * 0.02);
        }
        c.quadraticCurveTo(lokX, lokY + h * 0.18, s * h * 0.08, h * 0.12);
        c.closePath();
        c.fill();
    }
    // Tułów, głowa, dziób, ogon klinowy.
    c.beginPath();
    c.ellipse(0, 0, h * 0.1, h * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(0, -h * 0.32, h * 0.085, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-h * 0.04, -h * 0.36); c.lineTo(0, -h * 0.5); c.lineTo(h * 0.04, -h * 0.36);
    c.fill();
    c.beginPath();
    c.moveTo(-h * 0.06, h * 0.22); c.lineTo(-h * 0.13, h * 0.5); c.lineTo(h * 0.13, h * 0.5); c.lineTo(h * 0.06, h * 0.22);
    c.fill();
    // Chłodny połysk na krawędzi natarcia skrzydeł - kreska.
    c.strokeStyle = `rgb(${N.BARWA_POLYSKU.join(',')})`;
    c.globalAlpha = clamp01(alfa * 0.45);
    c.lineWidth = Math.max(1, R * 0.012);
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * h * 0.1, -h * 0.13);
        c.quadraticCurveTo(s * h * 0.5, -mach * h * 0.25 - h * 0.18, s * h * 0.92, -mach * h * 0.55 + h * 0.12);
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
    c.fillStyle = `rgb(${N.BARWA.join(',')})`;
    c.beginPath();
    c.moveTo(0, -d);
    c.quadraticCurveTo(d * 0.45, -d * 0.1, 0, d);
    c.quadraticCurveTo(-d * 0.45, -d * 0.1, 0, -d);
    c.fill();
    c.strokeStyle = `rgb(${N.BARWA_POLYSKU.join(',')})`;
    c.globalAlpha = clamp01(alfa * 0.5);
    c.lineWidth = Math.max(1, d * 0.04);
    c.beginPath(); c.moveTo(0, -d); c.lineTo(0, d * 1.15); c.stroke();
    c.restore();
}

export class Kruki {
    constructor() {
        this._t = -1;
        this._sila = 0;
        this._stado = [];
        this._piora = [];
        this._klebY = [];
        this._naEkran = null;      // {x0, y0, wiek, rozbity}
        this._iglica = null;
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._zaczep = null;
        this._W = 1920; this._H = 1080;
    }

    get aktywny() { return this._t >= 0; }
    get diagnostyka() {
        return { t: this._t, stado: this._stado.length, piora: this._piora.length, naEkran: !!this._naEkran };
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
            const kat = -Math.PI / 2 + strona * losuj(0.25, 1.3);   // w górę i na boki
            return {
                start: N.STADO_OD + (N.STADO_DO - N.STADO_OD) * (i / Math.max(1, N.LICZBA_STADA - 1)) + losuj(-0.05, 0.05),
                kat, skret: losuj(-0.4, 0.4),
                v: N.PREDKOSC * losuj(0.7, 1.3),
                rozp: N.ROZPIETOSC * losuj(0.7, 1.3),
                dx: losuj(-0.6, 0.6), dy: losuj(-0.25, 0.35),
                faza: losuj(0, Math.PI * 2),
                wylecial: false, x: 0, y: 0, wiek: 0
            };
        });
        this._klebY = Array.from({ length: N.CIEN_KLEBOW }, () => ({ dx: losuj(-1, 1), dy: losuj(-0.5, 0.6), r: losuj(0.4, 0.8), faza: losuj(0, 6) }));
    }

    _pioro(x, y, rozmiar, vx = losuj(-0.3, 0.3), vy = losuj(-0.2, 0.2)) {
        this._piora.push({ x, y, vx, vy, wiek: 0, rozmiar, kat: losuj(0, Math.PI * 2), wir: losuj(-3, 3), faza: losuj(0, 6) });
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

        // Stado: start z cienia wokół barków, potem lot z lekkim skrętem.
        for (const kr of this._stado) {
            if (t < kr.start) continue;
            if (!kr.wylecial) {
                kr.wylecial = true;
                kr.x = z.x + kr.dx * sk; kr.y = z.y + kr.dy * sk;
                for (let i = 0; i < N.PIOR_NA_KRUKA; i++) this._pioro(kr.x, kr.y, losuj(0.05, 0.08));
            }
            kr.wiek += krok;
            kr.kat += kr.skret * krok;
            const v = kr.v * sk * (0.6 + 0.4 * Math.min(1, kr.wiek / 0.4));
            kr.x += Math.cos(kr.kat) * v * krok;
            kr.y += Math.sin(kr.kat) * v * krok;
        }
        this._stado = this._stado.filter(kr => !kr.wylecial || (kr.wiek < N.ZYCIE_KRUKA
            && kr.x > -sk * 2 && kr.x < W + sk * 2 && kr.y > -sk * 2));

        // Kruk na ekran.
        if (!this._naEkran && t >= N.EKRAN_START) {
            const s = this._iglica ?? { x: z.x, y: z.y - sk * N.NAD_GLOWA };
            this._naEkran = { x0: s.x, y0: s.y, wiek: 0, rozbity: false };
        }
        const e = this._naEkran;
        if (e) {
            e.wiek += krok;
            if (!e.rozbity && e.wiek >= N.EKRAN_CZAS) {
                e.rozbity = true;
                for (let i = 0; i < N.EKRAN_PIOR; i++) {
                    this._pioro(W / 2 + losuj(-0.35, 0.35) * W, H / 2 + losuj(-0.35, 0.35) * H, losuj(0.15, 0.3),
                        losuj(-2, 2), losuj(-1.5, 0.5));
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

        const ekranKoniec = e ? (e.wiek < N.EKRAN_CZAS + N.PRZYCIEMNIENIE_S) : t < N.EKRAN_START + 0.1;
        if (t >= N.CIEN_ZYCIE && !this._stado.length && !this._piora.length && !ekranKoniec) {
            this._t = -1;
            this._naEkran = null;
            return;
        }
        if (!ctx) return;

        // Cień i kruki w pierwszych chwilach lotu - ZA sylwetką.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._rysujCien(tyl, t);
            for (const kr of this._stado) {
                if (kr.wylecial && kr.wiek < N.ZA_SYLWETKA_S) this._rysujZeStada(tyl, kr);
            }
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        for (const kr of this._stado) {
            if (kr.wylecial && kr.wiek >= N.ZA_SYLWETKA_S) this._rysujZeStada(ctx, kr);
        }
        for (const p of this._piora) {
            rysujPioro(ctx, p, sk, this._sila * Math.min(1, (N.ZYCIE_PIORA - p.wiek) / 0.6) * 0.9);
        }
        if (e) this._rysujNaEkran(ctx, e);
        ctx.restore();
    }

    _rysujZeStada(c, kr) {
        const N = NASTAWY, sk = this._zaczep.skala;
        const alfa = this._sila * Math.min(1, kr.wiek / 0.15) * Math.min(1, (N.ZYCIE_KRUKA - kr.wiek) / 0.3);
        rysujKruka(c, kr.x, kr.y, kr.rozp * sk, kr.faza + kr.wiek * N.MACHANIE_HZ * Math.PI * 2, kr.kat, alfa);
    }

    _rysujCien(c, t) {
        const N = NASTAWY, z = this._zaczep, sk = z.skala;
        const a = obwiedniaCienia(t) * this._sila * N.CIEN_ALFA;
        if (a < 0.005) return;
        c.save();
        c.globalCompositeOperation = 'source-over';
        for (const kl of this._klebY) {
            const x = z.x + kl.dx * sk * N.CIEN_PROMIEN * 0.6 + Math.sin(t * 1.3 + kl.faza) * sk * 0.08;
            const y = z.y + kl.dy * sk * N.CIEN_PROMIEN * 0.6 - t * sk * 0.12;
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

    _rysujNaEkran(c, e) {
        const N = NASTAWY, W = this._W, H = this._H, sk = this._zaczep.skala;
        if (e.wiek < N.EKRAN_CZAS) {
            const u = postepNaEkran(e.wiek);
            // Leci na kamerę: z namiotu palców ku środkowi kadru.
            const x = e.x0 + (W / 2 - e.x0) * u;
            const y = e.y0 + (H * 0.45 - e.y0) * u - Math.sin(Math.min(1, e.wiek / N.EKRAN_CZAS) * Math.PI) * sk * 0.4;
            const R = rozpietoscNaEkran(e.wiek, sk, W);
            const alfa = this._sila * Math.min(1, e.wiek / 0.12);
            rysujKruka(c, x, y, R, e.wiek * N.EKRAN_MACHANIE_HZ * Math.PI * 2, -Math.PI / 2, alfa);
        }
        const po = e.wiek - N.EKRAN_CZAS;
        if (po > -0.15 && po < N.PRZYCIEMNIENIE_S) {
            const a = po < 0 ? (po + 0.15) / 0.15 : 1 - po / N.PRZYCIEMNIENIE_S;
            c.globalAlpha = clamp01(a * N.PRZYCIEMNIENIE * this._sila);
            c.fillStyle = `rgb(${N.BARWA_CIENIA.join(',')})`;
            c.fillRect(0, 0, W, H);
            c.globalAlpha = 1;
        }
    }
}
