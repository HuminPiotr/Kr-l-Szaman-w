/**
 * Grzmot - nagroda za combo perun -> stribog (2026-10-08, spec
 * docs/superpowers/specs/2026-10-08-grzmot-i-zawierucha-design.md).
 * Błyskawica (Perun) rozdziera powietrze (Stribog).
 *
 * v2 (2026-10-08, życzenie właściciela): ma przypominać GRZMOT, a fala ma
 * rozchodzić się OKRĘGIEM WE WSZYSTKIE STRONY OD ŚRODKA CIAŁA. v1 używało
 * wspólnej Fali Aarda z osią ku kamerze - czytało się jak dmuchnięcie wiatru.
 * Teraz Grzmot rysuje się sam:
 *  1. BŁYSK - cały kadr na chwilę rozbłyska (błyskawica PRZED grzmotem),
 *  2. PIERŚCIEŃ - płaski okrąg w płaszczyźnie ekranu rośnie ze środka tułowia
 *     aż za krawędź kadru; ostra kreska + poświata, a ~ECHO_OPOZNIENIE_S za
 *     nim słabsze ECHO (przetaczający się grzmot),
 *  3. IGLICE - kilka krótkich zygzaków migocze na krawędzi (akcent Peruna,
 *     nie pełne wyładowania - dwójka ma być skromna),
 *  4. DUDNIENIE - słabnące uderzenia ekranu co ~0,15 s (`dudnienia` -> main.js
 *     woła ekran.uderz) zamiast jednego szarpnięcia,
 *  5. dźwięk: js/dzwiekGrzmotu.js (jedyny efekt dźwiękowy gry - wyjątek
 *     świadomie dopisany do strażnika, GEMINI.md).
 *
 * Energia (Perun), więc pierścień i błysk idą 'lighter' - inaczej niż materia
 * (Kurzawa, Zawierucha) rysowana source-over.
 *
 * DWÓJKA DZIAŁAJĄCA NA POLE: pierścień pcha dym (punktyPchniecia -> dym.pchnij
 * w main.js, ten sam kontrakt co fala Aarda), a `wybuch` (jedna klatka) czytają
 * reakcje - dziura w Mgle, szarpnięcie Kurzawy (js/reakcjeTechnik.js).
 * `wybuch` jest widoczny przez DOKŁADNIE JEDNĄ klatkę: zapal() dzieje się
 * w kroku pieczęci (przed updateAndDraw), updateAndDraw go publikuje,
 * a kolejne wywołanie czyści - reakcje (po updateAndDraw) widzą go raz.
 */
import { barkiKlatki } from './sledzenie.js';

export const NASTAWY = {
    POD_BARKAMI: 0.6,            // skala * to - klatka piersiowa pod środkiem barków
    CZAS_PIERSCIENIA: 0.65,      // s - od środka do rogu kadru
    ECHO_OPOZNIENIE_S: 0.12,
    ECHO_ALFA: 0.5,              // ułamek jasności pierścienia głównego
    WYKLADNIK_ROZCHODZENIA: 2.2, // ease-out: szybki start, potem zwalnia
    BLYSK_CZAS: 0.4,             // s
    BLYSK_NAROST: 0.03,          // s
    BLYSK_PLATO: 0.1,            // s - pełna jasność do tej chwili
    BLYSK_ALFA: 0.5,             // maks. alfa zalewu 'lighter'
    // Uderzenia ekranu po pierwszym (to dokłada wspólna warstwa techniki.js):
    // czas od zapal() i siła 0..1.
    DUDNIENIE: [{ t: 0.15, sila: 0.5 }, { t: 0.30, sila: 0.35 }, { t: 0.45, sila: 0.2 }],
    IGLIC: 6,
    IGLICA_KROK_S: 1 / 16,       // s - zygzak odświeża się, nie płynie
    IGLICA_DLUGOSC: 0.55,        // skala * to
    IGLICA_ZYGZAK: 0.14,         // skala * to - amplituda w poprzek
    IGLICA_SEGMENTOW: 6,
    POSWIATA_SZER: 0.35,         // skala * to
    POSWIATA_ALFA: 0.22,
    RDZEN_PX: 3,
    SILA_PCHNIECIA: 0.7,         // dym.pchnij: odpowiednik dawnej siły fali
    PUNKTOW_PCHNIECIA: 40,
    BARWA: [170, 205, 255],      // błękit Peruna
    BARWA_RDZENIA: [235, 245, 255],
    BARWA_BLYSKU: [200, 220, 255]
};

export const CZAS_CALKOWITY = NASTAWY.ECHO_OPOZNIENIE_S + NASTAWY.CZAS_PIERSCIENIA;

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Zaczep fali - klatka piersiowa. Bez pozy umowny środek kadru (GEMINI.md §2). */
export function zaczepKlatki(frame, W, H) {
    const b = barkiKlatki(frame, W, H);
    if (!b) return { x: W * 0.5, y: H * 0.5, skala: W * 0.12 };
    return { x: b.x, y: b.y + b.skala * NASTAWY.POD_BARKAMI, skala: b.skala };
}

/** Promień pierścienia w chwili `t` (s od jego startu), 0 przed startem i NaN. Czysta funkcja. */
export function promienPierscienia(t, promienMax) {
    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(promienMax) || promienMax <= 0) return 0;
    const u = clamp01(t / NASTAWY.CZAS_PIERSCIENIA);
    return promienMax * (1 - Math.pow(1 - u, NASTAWY.WYKLADNIK_ROZCHODZENIA));
}

/** Alfa pierścienia 0..1: szybki narost, gaśnięcie w miarę rozchodzenia. Czysta funkcja. */
export function alfaPierscienia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= NASTAWY.CZAS_PIERSCIENIA) return 0;
    const u = t / NASTAWY.CZAS_PIERSCIENIA;
    return Math.min(1, t / 0.03) * Math.pow(1 - u, 0.9);
}

/** Jasność błysku 0..1 w chwili `t` od zapal(): narost, plato, wygaszanie kwadratowe. Czysta funkcja. */
export function jasnoscBlysku(t) {
    const N = NASTAWY;
    if (!Number.isFinite(t) || t <= 0 || t >= N.BLYSK_CZAS) return 0;
    if (t < N.BLYSK_NAROST) return t / N.BLYSK_NAROST;
    if (t < N.BLYSK_PLATO) return 1;
    const u = (N.BLYSK_CZAS - t) / (N.BLYSK_CZAS - N.BLYSK_PLATO);
    return u * u;
}

const los01 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * Zygzak-iglica `i` na pierścieniu w kroku odświeżania `krok` - czysta funkcja
 * (deterministyczna: te same argumenty, ten sam kształt).
 * @returns {{x:number, y:number}[]}  IGLICA_SEGMENTOW + 1 punktów w px; leży na obwodzie pierścienia
 */
export function zygzak(i, krok, cx, cy, promien, skala) {
    const N = NASTAWY;
    const kat = (i / N.IGLIC) * Math.PI * 2 + (los01(i, 1) - 0.5) * 0.9;
    const dl = skala * N.IGLICA_DLUGOSC;
    const tx = -Math.sin(kat), ty = Math.cos(kat);   // styczna do okręgu
    const nx = Math.cos(kat), ny = Math.sin(kat);    // promień
    const px = cx + nx * promien, py = cy + ny * promien;
    const pkt = [];
    for (let s = 0; s <= N.IGLICA_SEGMENTOW; s++) {
        const u = s / N.IGLICA_SEGMENTOW - 0.5;
        const odch = s === 0 || s === N.IGLICA_SEGMENTOW ? 0 : (los01(i * 7 + s, krok) - 0.5) * 2 * skala * N.IGLICA_ZYGZAK;
        pkt.push({ x: px + tx * u * dl + nx * odch, y: py + ty * u * dl + ny * odch });
    }
    return pkt;
}

export class Grzmot {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 1;
        this._doWybuchu = null;
        this._zaczep = null;
        this._W = 1920; this._H = 1080;
        this._nastepneDudnienie = 0;
        this.wybuch = null;      // {x, y, skala, sila} - jedna klatka po zapal()
        this.dudnienia = [];     // siły uderzeń ekranu do wykonania w TEJ klatce
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    /** @param {{x,y,skala}} zaczep  px, z zaczepKlatki() */
    zapal(zaczep, sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        if (!zaczep || !punktOk(zaczep) || !(zaczep.skala > 0)) return;
        this._t = 0;
        this._trwa = true;
        this._sila = s;
        this._zaczep = { x: zaczep.x, y: zaczep.y, skala: zaczep.skala };
        this._nastepneDudnienie = 0;
        this._doWybuchu = { x: zaczep.x, y: zaczep.y, skala: zaczep.skala, sila: s };
    }

    updateAndDraw(ctx, k, dt) {
        this.wybuch = this._doWybuchu;
        this._doWybuchu = null;
        this.dudnienia = [];
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        this._W = k?.W ?? 1920; this._H = k?.H ?? 1080;
        while (this._nastepneDudnienie < N.DUDNIENIE.length && this._t >= N.DUDNIENIE[this._nastepneDudnienie].t) {
            this.dudnienia.push(N.DUDNIENIE[this._nastepneDudnienie].sila * this._sila);
            this._nastepneDudnienie++;
        }
        if (this._t >= CZAS_CALKOWITY) { this._trwa = false; return; }
        if (ctx) this._rysuj(ctx);
    }

    _promienMax() { return Math.hypot(this._W, this._H); }

    _rysuj(ctx) {
        const N = NASTAWY, z = this._zaczep, sk = z.skala;
        const W = this._W, H = this._H;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const blysk = jasnoscBlysku(this._t) * this._sila;
        if (blysk > 0.005) {
            ctx.globalAlpha = clamp01(blysk * N.BLYSK_ALFA);
            ctx.fillStyle = `rgb(${N.BARWA_BLYSKU.join(',')})`;
            ctx.fillRect(-W * 0.1, -H * 0.1, W * 1.2, H * 1.2);   // zapas na wstrząs ekranu
        }

        ctx.lineCap = 'round';
        const pierscienie = [
            { t: this._t, mnoznik: 1 },
            { t: this._t - N.ECHO_OPOZNIENIE_S, mnoznik: N.ECHO_ALFA }
        ];
        for (const p of pierscienie) {
            const a = alfaPierscienia(p.t) * p.mnoznik * this._sila;
            const R = promienPierscienia(p.t, this._promienMax());
            if (a < 0.01 || R < 2) continue;
            ctx.beginPath();
            ctx.arc(z.x, z.y, R, 0, Math.PI * 2);
            ctx.strokeStyle = `rgb(${N.BARWA.join(',')})`;
            ctx.lineWidth = Math.max(6, sk * N.POSWIATA_SZER);
            ctx.globalAlpha = clamp01(a * N.POSWIATA_ALFA);
            ctx.stroke();
            ctx.strokeStyle = `rgb(${N.BARWA_RDZENIA.join(',')})`;
            ctx.lineWidth = N.RDZEN_PX;
            ctx.globalAlpha = clamp01(a * 0.95);
            ctx.stroke();
        }

        // Iglice tylko na pierścieniu głównym, dopóki jest wyraźny.
        const aGl = alfaPierscienia(this._t) * this._sila;
        const RGl = promienPierscienia(this._t, this._promienMax());
        if (aGl > 0.05 && RGl > 2) {
            const krokIglic = Math.floor(this._t / N.IGLICA_KROK_S);
            ctx.strokeStyle = `rgb(${N.BARWA_RDZENIA.join(',')})`;
            ctx.lineWidth = 2.2;
            ctx.lineJoin = 'round';
            ctx.globalAlpha = clamp01(aGl);
            for (let i = 0; i < N.IGLIC; i++) {
                const pkt = zygzak(i, krokIglic, z.x, z.y, RGl, sk);
                ctx.beginPath();
                ctx.moveTo(pkt[0].x, pkt[0].y);
                for (let s = 1; s < pkt.length; s++) ctx.lineTo(pkt[s].x, pkt[s].y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    /**
     * Punkty czoła pierścienia dla dym.pchnij() - promieniście na zewnątrz.
     * Ten sam kontrakt co pchniecieCzola (js/fala.js). PULL z poprzedniej klatki.
     * @returns {{x, y, r, vx, vy, sila}[]}  px, px/s
     */
    punktyPchniecia() {
        const N = NASTAWY;
        if (!this._trwa || !this._zaczep) return [];
        const R = promienPierscienia(this._t, this._promienMax());
        const a = alfaPierscienia(this._t);
        if (R < 2 || a <= 0.01) return [];
        const dR = (R - promienPierscienia(this._t - 0.02, this._promienMax())) / 0.02;
        const z = this._zaczep;
        const r = Math.max(z.skala * 0.5, (2 * Math.PI * R / N.PUNKTOW_PCHNIECIA) * 0.6);
        const out = [];
        for (let i = 0; i < N.PUNKTOW_PCHNIECIA; i++) {
            const kat = (i / N.PUNKTOW_PCHNIECIA) * Math.PI * 2;
            const c = Math.cos(kat), s = Math.sin(kat);
            out.push({ x: z.x + c * R, y: z.y + s * R, r, vx: c * dR, vy: s * dR, sila: N.SILA_PCHNIECIA * a * this._sila });
        }
        return out.filter(q => [q.x, q.y, q.r, q.vx, q.vy, q.sila].every(Number.isFinite));
    }
}
