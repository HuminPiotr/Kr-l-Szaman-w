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
 * v3 (2026-10-08, "okręgi zbyt proste, zbyt jednolite - ma przypominać
 * realistyczną falę uderzeniową"): idealny arc() o równej grubości czytał się
 * jak grafika, nie zjawisko. Prawdziwa fala ma trzy cechy, których brakowało:
 *  - ZAGINA OBRAZ za sobą - soczewka (_soczewka, trik Aarda z ekran.js),
 *  - POSZARPANE CZOŁO - promień i jasność zmieniają się wzdłuż obwodu
 *    (losowe harmoniczne per Grzmot, powoli się przelewają), z przerwami,
 *  - PĘD - promieniste smugi tuż za czołem i mgiełka sprężonego powietrza.
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
    BARWA_BLYSKU: [200, 220, 255],

    // --- v3: realistyczna fala uderzeniowa (nagłówek "v3") ---
    SEGMENTOW: 120,              // obwód rysowany odcinkami - każdy z własną jasnością/grubością
    NIEREGULARNOSC: 0.07,        // ułamek promienia - poszarpanie czoła
    HARMONICZNE: [3, 5, 8, 13],  // fale wzdłuż obwodu (losowe fazy per Grzmot)
    PRZERWA_PROG: 0.2,           // jasność odcinka poniżej = przerwa w czole
    // Soczewka: obraz pod pierścieniem rozepchnięty na zewnątrz (jak Aard w ekran.js).
    WYBRZUSZENIE: 0.06,          // maks. mnożnik skali kopii sceny - 1
    GRUBOSC_SOCZEWKI_OD: 0.16, GRUBOSC_SOCZEWKI_DO: 0.05,   // ułamek promienia: cienieje w locie
    // Mgiełka sprężonego powietrza tuż ZA czołem (cień kondensacji).
    MGIELKA_ZA: 0.9,             // promień mgiełki = R * to
    MGIELKA_SZER: 0.9,           // skala * to
    MGIELKA_ALFA: 0.12,
    // Smugi pędu: promieniste kreski za czołem - "coś pędzi na zewnątrz".
    SMUG_PEDU: 56,
    SMUGA_DLUGOSC_OD: 0.05, SMUGA_DLUGOSC_DO: 0.16,   // ułamek promienia
    SMUGA_ALFA: 0.55
};

export const CZAS_CALKOWITY = NASTAWY.ECHO_OPOZNIENIE_S + NASTAWY.CZAS_PIERSCIENIA;

/**
 * Losowy profil kształtu czoła - fazy i amplitudy harmonicznych. Losowany RAZ
 * na Grzmot (nie co klatkę - migotałby), żeby żadne dwa nie były identyczne.
 * @param {() => number} [los]
 */
export function losujProfil(los = Math.random) {
    return NASTAWY.HARMONICZNE.map((k) => ({
        k,
        faza: los() * Math.PI * 2,
        amp: 0.4 + los() * 0.6,
        dryf: (los() * 2 - 1) * 2.5   // rad/s - kształt powoli się przelewa
    }));
}

/**
 * Wartość profilu w kącie `kat` i chwili `t` - gładka, -1..1. Czysta funkcja.
 */
export function wartoscProfilu(profil, kat, t) {
    if (!Array.isArray(profil) || !profil.length || !Number.isFinite(kat)) return 0;
    const tt = Number.isFinite(t) ? t : 0;
    let suma = 0, norma = 0;
    for (const h of profil) {
        suma += h.amp * Math.sin(h.k * kat + h.faza + h.dryf * tt);
        norma += h.amp;
    }
    return norma > 0 ? suma / norma : 0;
}

/** Promień poszarpanego czoła w kącie `kat`: R·(1 + NIEREGULARNOSC·profil). Czysta funkcja. */
export function promienCzola(R, profil, kat, t) {
    if (!Number.isFinite(R) || R <= 0) return 0;
    return R * (1 + NASTAWY.NIEREGULARNOSC * wartoscProfilu(profil, kat, t));
}

/** Jasność odcinka czoła 0..1 - nierówna, z przerwami (poniżej PRZERWA_PROG = 0). Czysta funkcja. */
export function jasnoscOdcinka(profil, kat, t) {
    const v = 0.5 + 0.75 * wartoscProfilu(profil, kat, t);
    return v < NASTAWY.PRZERWA_PROG ? 0 : clamp01(v);
}

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
export function katIglicy(i) {
    return (i / NASTAWY.IGLIC) * Math.PI * 2 + (los01(i, 1) - 0.5) * 0.9;
}

export function zygzak(i, krok, cx, cy, promien, skala) {
    const N = NASTAWY;
    const kat = katIglicy(i);
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
        this._ksztalt = [];      // profil promienia czoła (losujProfil)
        this._jasnosc = [];      // profil jasności odcinków - osobny, żeby przerwy nie szły w parze z wybrzuszeniami
        this._smugi = [];        // smugi pędu: { kat, dlugosc, opoznienie, faza }
        this._plotnoSoczewki = null;
        this._ctxSoczewki = null;
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
        this._ksztalt = losujProfil();
        this._jasnosc = losujProfil();
        const N = NASTAWY;
        this._smugi = Array.from({ length: N.SMUG_PEDU }, () => ({
            kat: Math.random() * Math.PI * 2,
            dlugosc: N.SMUGA_DLUGOSC_OD + Math.random() * (N.SMUGA_DLUGOSC_DO - N.SMUGA_DLUGOSC_OD),
            opoznienie: Math.random() * 0.08,    // nie wszystkie startują naraz
            faza: Math.random() * 10
        }));
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
        // Soczewka PIERWSZA - kopiuje scenę bez naszych kresek, inaczej rozepchnęłaby własne czoło.
        this._soczewka(ctx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const blysk = jasnoscBlysku(this._t) * this._sila;
        if (blysk > 0.005) {
            ctx.globalAlpha = clamp01(blysk * N.BLYSK_ALFA);
            ctx.fillStyle = `rgb(${N.BARWA_BLYSKU.join(',')})`;
            ctx.fillRect(-W * 0.1, -H * 0.1, W * 1.2, H * 1.2);   // zapas na wstrząs ekranu
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const aGl = alfaPierscienia(this._t) * this._sila;
        const RGl = promienPierscienia(this._t, this._promienMax());

        // Mgiełka sprężonego powietrza tuż ZA czołem - tylko pierścień główny.
        if (aGl > 0.01 && RGl > 2) {
            ctx.strokeStyle = `rgb(${N.BARWA.join(',')})`;
            ctx.lineWidth = Math.max(8, sk * N.MGIELKA_SZER);
            ctx.globalAlpha = clamp01(aGl * N.MGIELKA_ALFA);
            this._sciezkaCzola(ctx, RGl * N.MGIELKA_ZA, this._t, 0, 0);
            ctx.stroke();
        }

        // Czoło główne i echo - odcinkami, każdy z własną jasnością i grubością.
        this._czolo(ctx, this._t, 1);
        this._czolo(ctx, this._t - N.ECHO_OPOZNIENIE_S, N.ECHO_ALFA);

        // Smugi pędu - promieniste kreski tuż za czołem, migoczące.
        if (aGl > 0.02 && RGl > 2) {
            ctx.strokeStyle = `rgb(${N.BARWA_RDZENIA.join(',')})`;
            ctx.lineWidth = 1.5;
            for (const s of this._smugi) {
                const ts = this._t - s.opoznienie;
                const a = alfaPierscienia(ts) * this._sila * N.SMUGA_ALFA * (0.55 + 0.45 * Math.sin(s.faza + this._t * 40));
                if (a < 0.01) continue;
                const koniec = promienCzola(promienPierscienia(ts, this._promienMax()), this._ksztalt, s.kat, this._t) * 0.985;
                const poczatek = koniec * (1 - s.dlugosc);
                const c = Math.cos(s.kat), sn = Math.sin(s.kat);
                ctx.globalAlpha = clamp01(a);
                ctx.beginPath();
                ctx.moveTo(z.x + c * poczatek, z.y + sn * poczatek);
                ctx.lineTo(z.x + c * koniec, z.y + sn * koniec);
                ctx.stroke();
            }
        }

        // Iglice tylko na pierścieniu głównym, dopóki jest wyraźny - na POSZARPANYM czole.
        if (aGl > 0.05 && RGl > 2) {
            const krokIglic = Math.floor(this._t / N.IGLICA_KROK_S);
            ctx.strokeStyle = `rgb(${N.BARWA_RDZENIA.join(',')})`;
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = clamp01(aGl);
            for (let i = 0; i < N.IGLIC; i++) {
                const R = promienCzola(RGl, this._ksztalt, katIglicy(i), this._t);
                const pkt = zygzak(i, krokIglic, z.x, z.y, R, sk);
                ctx.beginPath();
                ctx.moveTo(pkt[0].x, pkt[0].y);
                for (let s = 1; s < pkt.length; s++) ctx.lineTo(pkt[s].x, pkt[s].y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    /** Zamknięta ścieżka poszarpanego czoła o bazowym promieniu R, przesunięta o (dx, dy). */
    _sciezkaCzola(ctx, R, t, dx, dy) {
        const N = NASTAWY, z = this._zaczep;
        ctx.beginPath();
        for (let i = 0; i <= N.SEGMENTOW; i++) {
            const kat = (i / N.SEGMENTOW) * Math.PI * 2;
            const r = promienCzola(R, this._ksztalt, kat, t);
            const x = z.x + dx + Math.cos(kat) * r, y = z.y + dy + Math.sin(kat) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    /** Czoło w chwili `t` pierścienia: najpierw poświata, potem rdzeń - odcinkami, z przerwami. */
    _czolo(ctx, t, mnoznik) {
        const N = NASTAWY, z = this._zaczep, sk = z.skala;
        const a = alfaPierscienia(t) * mnoznik * this._sila;
        const R = promienPierscienia(t, this._promienMax());
        if (a < 0.01 || R < 2) return;
        const pkt = [];
        for (let i = 0; i <= N.SEGMENTOW; i++) {
            const kat = (i / N.SEGMENTOW) * Math.PI * 2;
            const r = promienCzola(R, this._ksztalt, kat, this._t);
            pkt.push({ x: z.x + Math.cos(kat) * r, y: z.y + Math.sin(kat) * r,
                       b: jasnoscOdcinka(this._jasnosc, kat + Math.PI / N.SEGMENTOW, this._t) });
        }
        const przebiegi = [
            { barwa: N.BARWA, szer: (b) => Math.max(6, sk * N.POSWIATA_SZER) * (0.5 + b), alfa: (b) => N.POSWIATA_ALFA * (0.4 + 0.6 * b) },
            { barwa: N.BARWA_RDZENIA, szer: (b) => N.RDZEN_PX * (0.5 + 1.5 * b), alfa: (b) => 0.95 * b }
        ];
        for (const p of przebiegi) {
            ctx.strokeStyle = `rgb(${p.barwa.join(',')})`;
            for (let i = 0; i < N.SEGMENTOW; i++) {
                const b = pkt[i].b;
                if (b <= 0) continue;   // przerwa w czole
                ctx.globalAlpha = clamp01(a * p.alfa(b));
                ctx.lineWidth = p.szer(b);
                ctx.beginPath();
                ctx.moveTo(pkt[i].x, pkt[i].y);
                ctx.lineTo(pkt[i + 1].x, pkt[i + 1].y);
                ctx.stroke();
            }
        }
    }

    /**
     * Soczewka sprężonego powietrza: scena pod pierścieniem skopiowana i narysowana
     * z powrotem rozepchnięta o kilka % wokół środka (ten sam trik co Aard,
     * js/ekran.js _falaPowietrza), przycięta do POSZARPANEGO pierścienia.
     * W układzie URZĄDZENIA (setTransform) - kopia pikseli płótna nie zna
     * przesunięcia wstrząsu, więc geometrię przesuwamy o nie ręcznie.
     */
    _soczewka(ctx) {
        const N = NASTAWY, z = this._zaczep;
        const p = clamp01(this._t / N.CZAS_PIERSCIENIA);
        const k = 1 + N.WYBRZUSZENIE * alfaPierscienia(this._t) * this._sila;
        const R = promienPierscienia(this._t, this._promienMax());
        if (k < 1.002 || R < 4 || typeof document === 'undefined' || !ctx.canvas) return;
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        if (!(cw > 0 && ch > 0)) return;
        const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
        const dx = Number.isFinite(m?.e) ? m.e : 0, dy = Number.isFinite(m?.f) ? m.f : 0;
        const cx = z.x + dx, cy = z.y + dy;
        const Rz = R * (1 + N.NIEREGULARNOSC) + 8;
        const x0 = Math.max(0, Math.floor(cx - Rz)), y0 = Math.max(0, Math.floor(cy - Rz));
        const x1 = Math.min(cw, Math.ceil(cx + Rz)), y1 = Math.min(ch, Math.ceil(cy + Rz));
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 2 || bh < 2) return;
        if (!this._plotnoSoczewki) {
            this._plotnoSoczewki = document.createElement('canvas');
            this._ctxSoczewki = this._plotnoSoczewki.getContext('2d');
        }
        if (this._plotnoSoczewki.width < bw || this._plotnoSoczewki.height < bh) {
            this._plotnoSoczewki.width = Math.max(this._plotnoSoczewki.width, bw);
            this._plotnoSoczewki.height = Math.max(this._plotnoSoczewki.height, bh);
        }
        this._ctxSoczewki.clearRect(0, 0, bw, bh);
        this._ctxSoczewki.drawImage(ctx.canvas, x0, y0, bw, bh, 0, 0, bw, bh);

        const grubosc = N.GRUBOSC_SOCZEWKI_OD + (N.GRUBOSC_SOCZEWKI_DO - N.GRUBOSC_SOCZEWKI_OD) * p;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        this._sciezkaCzola(ctx, R, this._t, dx, dy);
        // Druga pętla (wewnętrzna krawędź) w TEJ SAMEJ ścieżce - evenodd wycina środek.
        for (let i = 0; i <= N.SEGMENTOW; i++) {
            const kat = (i / N.SEGMENTOW) * Math.PI * 2;
            const r = promienCzola(R, this._ksztalt, kat, this._t) * (1 - grubosc);
            const x = cx + Math.cos(kat) * r, y = cy + Math.sin(kat) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.clip('evenodd');
        ctx.drawImage(this._plotnoSoczewki, 0, 0, bw, bh,
                      cx + (x0 - cx) * k, cy + (y0 - cy) * k, bw * k, bh * k);
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
