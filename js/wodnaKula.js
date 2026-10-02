/**
 * Wodna Kula - nagroda za combo mokosz -> weles (proste combo 2026-10-02).
 * Mokosz to "Mać Ziemia Wilgotna" - woda wydobyta z ziemi zbiera się
 * w kulę między dłońmi gracza. Kula faluje (brzeg = zamknięta KRESKA
 * z promieniem modulowanym szumem - patrz pamięć "efekt ciągły = kreska,
 * nie sprite"), załamuje obraz pod sobą (soczewka) i gubi krople-kreski;
 * na koniec pęka w chmurę kropel.
 *
 * SOCZEWKA WŁASNA, nie w ekran.js (zmiana względem spec): technika ma być
 * wyjmowalna jednym commitem - soczewka w ekran.js zostałaby po odrzuceniu
 * Kuli jako martwy kod. Mechanizm ten sam co ekran.js _falaPowietrza: kopia
 * sceny pod kulą rysowana z powrotem przeskalowana wokół środka, przycięta
 * do koła.
 */
import { simplex3 } from './szum.js';
import { dlonieKlatki, barkiKlatki, Kotwica } from './sledzenie.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    NAROST: 0.4,              // s
    PEKNIECIE: 0.6,           // s - ostatnie tyle sekund: kula się rozdyma i pęka
    PROMIEN_MIN: 0.45, PROMIEN_MAX: 1.4,   // skala * to
    WSP_ROZPIETOSCI: 0.8,     // promień = połowa rozpiętości dłoni * to
    UNIESIENIE_JEDNEJ: 0.6,   // skala * to - kula nad pojedynczą dłonią
    PROMIEN_JEDNEJ: 0.7,      // skala * to
    FALOWANIE: 0.07,          // amplituda falowania brzegu (ułamek R)
    PUNKTOW_BRZEGU: 64,
    SOCZEWKA: 0.14,           // powiększenie obrazu pod kulą
    KROPLE_NA_S: 7,
    KROPLE_PEKNIECIA: 26,
    PREDKOSC_KROPLI: 1.6,     // skala * to = px/s
    GRAWITACJA_KROPLI: 4,     // skala * to = px/s^2
    ZYCIE_KROPLI: 0.7,        // s
    BARWA: [90, 200, 255],
    BARWA_RDZENIA: [220, 245, 255]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** @returns {{kula:number, rozdecie:number}} */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return { kula: 0, rozdecie: 1 };
    const doKonca = CZAS_TRWANIA - t;
    const pek = doKonca < NASTAWY.PEKNIECIE ? 1 - doKonca / NASTAWY.PEKNIECIE : 0;
    return { kula: Math.min(1, t / NASTAWY.NAROST) * (1 - pek), rozdecie: 1 + 0.2 * pek };
}

/** @returns {{x,y,r}|null} */
export function celKuli(dlonie, skala) {
    const N = NASTAWY;
    if (!Array.isArray(dlonie) || !dlonie.length) return null;
    if (dlonie.length >= 2) {
        const [a, b] = dlonie;
        const r = Math.hypot(b.x - a.x, b.y - a.y) / 2 * N.WSP_ROZPIETOSCI;
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                 r: Math.max(skala * N.PROMIEN_MIN, Math.min(skala * N.PROMIEN_MAX, r)) };
    }
    return { x: dlonie[0].x, y: dlonie[0].y - skala * N.UNIESIENIE_JEDNEJ, r: skala * N.PROMIEN_JEDNEJ };
}

export function promienBrzegu(R, kat, t) {
    return R * (1 + NASTAWY.FALOWANIE * simplex3(Math.cos(kat) * 1.3, Math.sin(kat) * 1.3, t * 0.9));
}

export class WodnaKula {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._krople = [];
        this._akumulator = 0;
        this._peklo = false;
        this._srodek = new Kotwica(16);
        this._skala = new Kotwica(6);
        this._plotno = null;
        this._plotnoCtx = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._krople = [];
        this._akumulator = 0;
        this._peklo = false;
        this._srodek.reset(); this._skala.reset();
    }

    _kropla(c, R, sk, kat, styczna) {
        const v = sk * NASTAWY.PREDKOSC_KROPLI * (0.7 + Math.random() * 0.6);
        const rx = Math.cos(kat), ry = Math.sin(kat);
        const wt = styczna ? 0.6 : 0, wr = styczna ? 0.4 : 1;
        this._krople.push({
            x: c.x + rx * R, y: c.y + ry * R,
            vx: (-ry * wt + rx * wr) * v, vy: (rx * wt + ry * wr) * v,
            wiek: 0, zycie: NASTAWY.ZYCIE_KROPLI * (0.7 + Math.random() * 0.6)
        });
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const barki = barkiKlatki(k?.frame, W, H);
        const sk = this._skala.prowadz(barki ? { s: barki.skala } : null, krok)?.s ?? W * 0.12;
        const c = this._srodek.prowadz(celKuli(dlonieKlatki(k?.frame, W, H), sk), krok)
            ?? { x: W * 0.5, y: H * 0.45, r: sk * N.PROMIEN_JEDNEJ };
        const { kula, rozdecie } = obwiednia(this._t);
        const R = c.r * rozdecie;

        // Krople: emisja w trakcie, chmura przy pęknięciu, fizyka zawsze.
        if (this._t < CZAS_TRWANIA - N.PEKNIECIE) {
            this._akumulator += krok * N.KROPLE_NA_S;
            while (this._akumulator >= 1) { this._akumulator -= 1; this._kropla(c, R, sk, Math.random() * Math.PI * 2, true); }
        } else if (!this._peklo && this._t >= CZAS_TRWANIA - N.PEKNIECIE / 2) {
            this._peklo = true;
            for (let i = 0; i < N.KROPLE_PEKNIECIA; i++) this._kropla(c, R, sk, (i / N.KROPLE_PEKNIECIA) * Math.PI * 2, false);
        }
        const g = sk * N.GRAWITACJA_KROPLI;
        this._krople = this._krople.filter(d => {
            d.wiek += krok;
            d.vy += g * krok;
            d.x += d.vx * krok; d.y += d.vy * krok;
            return d.wiek < d.zycie && Number.isFinite(d.x) && Number.isFinite(d.y);
        });
        if (this._t >= CZAS_TRWANIA && !this._krople.length) { this._trwa = false; return; }
        if (!ctx) return;

        if (kula * this._sila > 0.01) {
            this._soczewka(ctx, c, R, kula);
            this._brzeg(ctx, c, R, kula);
        }
        this._rysujKrople(ctx, sk);
    }

    _soczewka(ctx, c, R, kula) {
        if (typeof document === 'undefined' || !ctx.canvas) return;
        const x0 = Math.max(0, Math.floor(c.x - R)), y0 = Math.max(0, Math.floor(c.y - R));
        const x1 = Math.min(ctx.canvas.width, Math.ceil(c.x + R)), y1 = Math.min(ctx.canvas.height, Math.ceil(c.y + R));
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 2 || bh < 2) return;
        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._plotnoCtx = this._plotno.getContext('2d');
        }
        if (this._plotno.width < bw || this._plotno.height < bh) {
            this._plotno.width = Math.max(this._plotno.width, bw);
            this._plotno.height = Math.max(this._plotno.height, bh);
        }
        this._plotnoCtx.clearRect(0, 0, bw, bh);
        this._plotnoCtx.drawImage(ctx.canvas, x0, y0, bw, bh, 0, 0, bw, bh);
        const kk = 1 + NASTAWY.SOCZEWKA * kula * this._sila;
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this._plotno, 0, 0, bw, bh, c.x + (x0 - c.x) * kk, c.y + (y0 - c.y) * kk, bw * kk, bh * kk);
        ctx.restore();
    }

    _brzeg(ctx, c, R, kula) {
        const N = NASTAWY;
        const a = kula * this._sila;
        const [r, g, b] = N.BARWA, [rr, gr, br] = N.BARWA_RDZENIA;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr0 = ctx.createRadialGradient(c.x, c.y, R * 0.1, c.x, c.y, R);
        gr0.addColorStop(0, `rgba(${r},${g},${b},0)`);
        gr0.addColorStop(1, `rgba(${r},${g},${b},${(0.28 * a).toFixed(3)})`);
        ctx.fillStyle = gr0;
        ctx.beginPath();
        for (let i = 0; i <= N.PUNKTOW_BRZEGU; i++) {
            const kat = (i / N.PUNKTOW_BRZEGU) * Math.PI * 2;
            const rb = promienBrzegu(R, kat, this._t);
            const x = c.x + Math.cos(kat) * rb, y = c.y + Math.sin(kat) * rb;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(${r},${g},${b},${(0.35 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, R * 0.12);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${rr},${gr},${br},${(0.9 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, R * 0.03);
        ctx.stroke();
        ctx.restore();
    }

    _rysujKrople(ctx, sk) {
        if (!this._krople.length) return;
        const [r, g, b] = NASTAWY.BARWA_RDZENIA;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.5, sk * 0.035);
        for (const d of this._krople) {
            const alfa = clamp01(1 - d.wiek / d.zycie) * this._sila;
            ctx.strokeStyle = `rgba(${r},${g},${b},${alfa.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.vx * 0.04, d.y - d.vy * 0.04);
            ctx.stroke();
        }
        ctx.restore();
    }
}
