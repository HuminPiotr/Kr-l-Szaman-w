/**
 * Błędne Ogniki - nagroda za combo weles -> swarog (2026-10-08, spec
 * docs/superpowers/specs/2026-10-08-grzmot-i-zawierucha-design.md).
 * Weles - władca zaświatów i pasterz dusz - wypuszcza duszyczki z ziemi,
 * Swaróg je rozpala: kilka zielono-złotych ogników wynurza się z dołu
 * tułowia, unosi się chwiejnie i odpływa na boki, migocząc, aż zgaśnie.
 *
 * DWÓJKA = SKROMNA I KRÓTKA: bez wstrząsu, bez błysku kadru, bez dźwięku.
 * Ciekawa w polach (model A, js/reakcjeTechnik.js):
 *  - DYM Okadzenia: ogniki to zarzewia (zarzewia() -> main.js -> dym.podpal),
 *  - MGŁA Mokoszy: latarnie - aureola rośnie (oznaczMgle), kłęby wokół się
 *    ciepło podświetlają (mgla.podswietl),
 *  - KURZAWA: wir porywa ogniki na orbitę (porwij(kurzawa.orbita())).
 * Reakcje ustawiają stan w klatce N, ogniki go zużywają w klatce N+1 -
 * techniki się nie znają, a każdą da się wyjąć jednym commitem.
 *
 * Duch/energia, więc 'lighter' (inaczej niż materia Kurzawy/Zawieruchy).
 * Barwa celowo NIE pomarańcz Płonącego Palca - blada zieleń ze złotem,
 * tak jak maluje się błędne ogniki. Ogon kreską po węzłach (pamięć projektu
 * "efekt ciągły = kreska, nie sprite"); sam płomyk to tintowany flame_*.
 *
 * Zaczep z POZY (barki), nie dłoni - lekcja z Łuku Peruna. Pas narodzin
 * jak u Zawieruchy: pod barkami, nigdy niżej niż DOL_EKRANU (kamera
 * laptopa rzadko widzi biodra).
 */
import { MANIFEST, obraz, wypalTintowany } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { curl2 } from './szum.js';

export const NASTAWY = {
    LICZBA: 5,
    CO_S: 0.08,                    // s między narodzinami kolejnych ogników
    ZYCIE_OD: 2.0, ZYCIE_DO: 2.4,  // s
    NAROST: 0.25, WYGASZENIE: 0.6, // s
    PAS_OD: 1.0, PAS_DO: 1.8,      // skala * to pod barkami
    DOL_EKRANU: 0.92,
    MIN_WYSOKOSC_PASA: 0.35,       // skala * to
    ROZRZUT: 1.2,                  // skala * to - w poziomie od środka ciała
    UNOSZENIE_OD: 0.6, UNOSZENIE_DO: 1.0,   // skala/s
    ODPLYW: 0.35,                  // skala/s - na boki, od ciała
    CHWIANIE: 0.5,                 // skala/s - amplituda dryfu curl2
    SKALA_SZUMU: 0.8,              // skala * to
    AUREOLA: 0.45,                 // skala * to - promień aureoli
    AUREOLA_W_MGLE: 2.5,           // mnożnik aureoli w Mgle (latarnia)
    ALFA_AUREOLI: 0.5,
    PLOMYK: 0.25,                  // skala * to
    RDZEN: 0.035,                  // skala * to
    OGON_S: 0.3,
    KROK_OGONA: 0.03,              // s
    SZEROKOSC_OGONA: 0.06,         // skala * to
    ALFA_OGONA: 0.35,
    PROMIEN_ZARZEWIA: 0.15,        // skala * to - kontakt z dymem
    PROG_ZARZEWIA: 0.3,            // jasność, od której ognik pali dym
    PORWANIE_TAU: 0.4,             // s - jak szybko wir ściąga ognik na orbitę
    BARWA_AUREOLI: [190, 235, 140],
    BARWA_PLOMYKA: [210, 245, 150],
    BARWA_RDZENIA: [255, 250, 210]
};

export const CZAS_TRWANIA = (NASTAWY.LICZBA - 1) * NASTAWY.CO_S + NASTAWY.ZYCIE_DO + 0.05;

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const punktOk = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Pionowe granice pasa narodzin {gora, dol} w px. Czysta funkcja. */
export function pasNarodzin(zaczep, H) {
    const N = NASTAWY, sk = zaczep.skala;
    const dol = Math.min(zaczep.y + sk * N.PAS_DO, H * N.DOL_EKRANU);
    const gora = Math.min(zaczep.y + sk * N.PAS_OD, dol - sk * N.MIN_WYSOKOSC_PASA);
    return { gora, dol };
}

/** Jasność ognika 0..1 w chwili `wiek` życia `zycie`. Czysta funkcja. */
export function obwiedniaOgnika(wiek, zycie) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || !(zycie > 0) || wiek <= 0 || wiek >= zycie) return 0;
    return Math.min(1, wiek / N.NAROST) * Math.min(1, (zycie - wiek) / N.WYGASZENIE);
}

/** Migotanie płomyka 0.5..1. Czysta funkcja. */
export function migotanie(t, faza) {
    if (!Number.isFinite(t)) return 1;
    const f = Number.isFinite(faza) ? faza : 0;
    return 0.75 + 0.25 * (0.6 * Math.sin(t * 13 + f) + 0.4 * Math.sin(t * 29 + f * 1.7));
}

/** Punkt na eliptycznej orbicie `{cx, cy, R, squash}` w kącie `kat`. Czysta funkcja. */
export function punktNaOrbicie(orbita, kat) {
    return { x: orbita.cx + Math.cos(kat) * orbita.R, y: orbita.cy + Math.sin(kat) * orbita.R * orbita.squash };
}

const orbitaOk = (o) => !!o && [o.cx, o.cy, o.R, o.squash, o.predkosc].every(Number.isFinite) && o.R > 0 && o.squash > 0;

export class BledneOgniki {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 1;
        this._ogniki = [];
        this._kotwica = new Kotwica(10);
        this._sk = 230;
        this._orbita = null;   // ustawiane przez reakcje w klatce N, zużywane w N+1
        this.wMgle = false;    // j.w.
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        const N = NASTAWY;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        // Ogniki rodzą się przy pierwszej klatce (dopiero updateAndDraw zna zaczep) -
        // tu tylko ich los: opóźnienie, życie, faza, wariant sprite'a.
        this._ogniki = Array.from({ length: N.LICZBA }, (_, i) => ({
            x: NaN, y: NaN, kierunek: 0,
            wiek: -i * N.CO_S,
            zycie: N.ZYCIE_OD + Math.random() * (N.ZYCIE_DO - N.ZYCIE_OD),
            unoszenie: N.UNOSZENIE_OD + Math.random() * (N.UNOSZENIE_DO - N.UNOSZENIE_OD),
            faza: Math.random() * 100,
            u: Math.random(), v: Math.random() * 2 - 1,   // miejsce w pasie narodzin
            wariant: Math.floor(Math.random() * MANIFEST.plomien.length),
            ogon: [], doWezla: 0,
            byloWMgle: false, porwany: false
        }));
    }

    /** Widoczne ogniki - dla reakcji (latarnie w Mgle). @returns {{x, y, skala, jasnosc}[]} */
    punkty() {
        const out = [];
        for (const o of this._ogniki) {
            const j = this._jasnosc(o);
            if (j > 0.05 && punktOk(o)) out.push({ x: o.x, y: o.y, skala: this._sk, jasnosc: j });
        }
        return out;
    }

    /** Ogniki dość jasne, żeby podpalić dym. @returns {{x, y, r}[]}  px */
    zarzewia() {
        const r = this._sk * NASTAWY.PROMIEN_ZARZEWIA;
        return this.punkty().filter(p => p.jasnosc > NASTAWY.PROG_ZARZEWIA).map(p => ({ x: p.x, y: p.y, r }));
    }

    /**
     * Reakcja Latarnie: ogniki są w Mgle (aureola rośnie w następnej klatce).
     * @returns {number}  ile widocznych ogników weszło w Mgłę PIERWSZY raz
     */
    oznaczMgle() {
        if (!this._trwa) return 0;
        this.wMgle = true;
        let nowe = 0;
        for (const o of this._ogniki) {
            if (!o.byloWMgle && this._jasnosc(o) > 0.05) { o.byloWMgle = true; nowe++; }
        }
        return nowe;
    }

    /**
     * Reakcja Wir ogników: wir Kurzawy porywa ogniki na swoją orbitę.
     * @param {{cx, cy, R, squash, kierunek, predkosc}|null} orbita  z kurzawa.orbita()
     * @returns {number}  ile widocznych ogników porwało PIERWSZY raz
     */
    porwij(orbita) {
        if (!this._trwa || !orbitaOk(orbita)) return 0;
        this._orbita = orbita;
        let nowe = 0;
        for (const o of this._ogniki) {
            if (!o.porwany && this._jasnosc(o) > 0.05) { o.porwany = true; nowe++; }
        }
        return nowe;
    }

    _jasnosc(o) {
        return obwiedniaOgnika(o.wiek, o.zycie) * migotanie(this._t, o.faza) * this._sila;
    }

    _narodziny(o, zaczep, H) {
        const N = NASTAWY, sk = zaczep.skala;
        const pas = pasNarodzin(zaczep, H);
        o.x = zaczep.x + o.v * N.ROZRZUT * sk;
        o.y = pas.gora + o.u * (pas.dol - pas.gora);
        o.kierunek = o.v >= 0 ? 1 : -1;   // odpływa OD ciała
    }

    _ruch(o, krok, orbita) {
        const N = NASTAWY, sk = this._sk;
        if (orbita && o.porwany) {
            // Na orbicie: kąt względem środka elipsy, przesunięty z prędkością wiru,
            // ognik płynnie ściągany na ten punkt (nie skacze).
            const kat = Math.atan2((o.y - orbita.cy) / orbita.squash, o.x - orbita.cx)
                + (orbita.kierunek < 0 ? -1 : 1) * orbita.predkosc * krok;
            const cel = punktNaOrbicie(orbita, kat);
            const a = 1 - Math.exp(-krok / N.PORWANIE_TAU);
            o.x += (cel.x - o.x) * a;
            o.y += (cel.y - o.y) * a;
            return;
        }
        const dl = sk * N.SKALA_SZUMU;
        const c = curl2(o.x / dl + o.faza, o.y / dl + this._t * 0.3);
        o.x += (o.kierunek * N.ODPLYW + c.x * N.CHWIANIE) * sk * krok;
        o.y += (-o.unoszenie + c.y * N.CHWIANIE * 0.5) * sk * krok;
    }

    updateAndDraw(ctx, k, dt) {
        const orbita = this._orbita, wMgle = this.wMgle;
        this._orbita = null;
        this.wMgle = false;
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; this._ogniki = []; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        this._sk = zaczep.skala;

        for (const o of this._ogniki) {
            const przed = o.wiek;
            o.wiek += krok;
            if (o.wiek < 0) continue;
            if (przed < 0 || !punktOk(o)) { this._narodziny(o, zaczep, H); continue; }
            this._ruch(o, krok, orbita);
            if (!punktOk(o)) { this._narodziny(o, zaczep, H); continue; }   // NaN z zewnątrz - odrodź, nie znikaj
            o.doWezla -= krok;
            if (o.doWezla <= 0) {
                o.ogon.push({ x: o.x, y: o.y });
                if (o.ogon.length > Math.round(N.OGON_S / N.KROK_OGONA)) o.ogon.shift();
                o.doWezla += N.KROK_OGONA;
            }
        }
        if (ctx) this._rysuj(ctx, wMgle);
    }

    _rysuj(ctx, wMgle) {
        const N = NASTAWY, sk = this._sk;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const o of this._ogniki) {
            const j = this._jasnosc(o);
            if (j < 0.01 || !punktOk(o)) continue;

            // Ogon - kreska po węzłach, gaśnie ku końcowi.
            if (o.ogon.length > 1) {
                ctx.strokeStyle = `rgb(${N.BARWA_AUREOLI.join(',')})`;
                for (let i = 1; i < o.ogon.length; i++) {
                    const u = i / o.ogon.length;
                    ctx.globalAlpha = clamp01(j * N.ALFA_OGONA * u);
                    ctx.lineWidth = Math.max(1, sk * N.SZEROKOSC_OGONA * u);
                    ctx.beginPath();
                    ctx.moveTo(o.ogon[i - 1].x, o.ogon[i - 1].y);
                    ctx.lineTo(i === o.ogon.length - 1 ? o.x : o.ogon[i].x, i === o.ogon.length - 1 ? o.y : o.ogon[i].y);
                    ctx.stroke();
                }
            }

            // Aureola - w Mgle rośnie jak latarnia.
            const R = sk * N.AUREOLA * (wMgle ? N.AUREOLA_W_MGLE : 1);
            const [r, g, b] = N.BARWA_AUREOLI;
            const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
            grad.addColorStop(0, `rgba(${r},${g},${b},${(N.ALFA_AUREOLI * j).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(o.x, o.y, R, 0, Math.PI * 2);
            ctx.fill();

            // Płomyk - tintowany flame_*, w górę, kołysze się. Brak assetu = tylko aureola i rdzeń.
            const img = obraz(MANIFEST.plomien[o.wariant]);
            if (img) {
                const s = sk * N.PLOMYK;
                ctx.save();
                ctx.translate(o.x, o.y);
                ctx.rotate(0.25 * Math.sin(this._t * 3 + o.faza));
                ctx.globalAlpha = clamp01(j);
                ctx.drawImage(wypalTintowany(img, N.BARWA_PLOMYKA, 128), -s / 2, -s * 0.8, s, s);
                ctx.restore();
            }

            // Rdzeń - jasny punkt.
            ctx.globalAlpha = clamp01(j);
            ctx.fillStyle = `rgb(${N.BARWA_RDZENIA.join(',')})`;
            ctx.beginPath();
            ctx.arc(o.x, o.y, Math.max(1.5, sk * N.RDZEN), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
