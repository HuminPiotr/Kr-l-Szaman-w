/**
 * Łuk Peruna - nagroda za combo mokosz -> perun (proste combo 2026-10-02).
 * Woda przewodzi piorun (a w części rekonstrukcji mitu Mokosz jest żoną
 * Peruna): między dłońmi trzaska łuk elektryczny, który rozciąga się
 * razem z rękami. Rozsuwasz dłonie - łuk cienieje i bardziej się szarpie.
 *
 * Ścieżki generuje TEN SAM kod co piorun Gromu w Ziemię (piorun.js
 * generujPiorun/rysujSciezke - twardy rdzeń source-over), ale w układzie
 * ZNORMALIZOWANYM (od (0,0) do (1,0)) i dopiero przy rysowaniu mapowane
 * na bieżące położenie dłoni (mapujSciezke). Dzięki temu łuk podąża za
 * dłońmi płynnie co klatkę, a regenerujemy go tylko co 60-90 ms - to
 * "trzask", nie migotanie co klatkę.
 *
 * Jedna dłoń w kadrze: łuk wyładowuje się z niej W GÓRĘ. Żadnej dłoni:
 * końce stoją tam, gdzie były (Kotwica) - nigdy brak efektu (GEMINI.md §2).
 */
import { generujPiorun, rysujSciezke } from './piorun.js';
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { dlonieKlatki, barkiKlatki, Kotwica } from './sledzenie.js';

export const CZAS_TRWANIA = 6.0;   // s

export const NASTAWY = {
    LICZBA_LUKOW: 3,              // równoległe ścieżki; pierwsza najjaśniejsza
    ODSTEP_MIN: 0.06, ODSTEP_MAX: 0.09,   // s między regeneracjami (trzask)
    ITERACJE: 6,
    CHROPOWATOSC_BLISKO: 0.16, CHROPOWATOSC_DALEKO: 0.30,
    DYSTANS_DALEKO_MNOZNIK: 4,    // skala * to = dłonie "maksymalnie rozsunięte"
    WYSOKOSC_JEDNEJ_DLONI: 2.2,   // skala * to - wyładowanie w górę z jednej dłoni
    ROZBLYSK_MNOZNIK: 1.1,        // skala * to = rozmiar spark_* przy dłoni
    NAROST: 0.15, WYGASZENIE: 0.8,   // s
    BARWA: [150, 200, 255]        // błękit-biel Peruna
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/** Ścieżka z układu (0,0)->(1,0) na odcinek a->b; y znormalizowane idzie prostopadle. */
export function mapujSciezke(punkty, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    return punkty.map(p => ({ x: a.x + p.x * dx - p.y * dy, y: a.y + p.x * dy + p.y * dx }));
}

/** @returns {{a:{x,y}, b:{x,y}}|null} */
export function koncowkiLuku(dlonie, skala) {
    if (!Array.isArray(dlonie) || !dlonie.length) return null;
    if (dlonie.length >= 2) return { a: dlonie[0], b: dlonie[1] };
    const d = dlonie[0];
    return { a: d, b: { x: d.x, y: d.y - skala * NASTAWY.WYSOKOSC_JEDNEJ_DLONI } };
}

export class LukPeruna {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._luki = [];
        this._doNastepnej = 0;
        this._jasnosc = 1;
        this._iskry = [0, 0];
        this._katIskry = 0;
        this._a = new Kotwica(22);   // ciaśniej niż tułów - łuk ma siedzieć W dłoni
        this._b = new Kotwica(22);
        this._skala = new Kotwica(6);
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._luki = [];
        this._doNastepnej = 0;
        this._a.reset(); this._b.reset(); this._skala.reset();
    }

    _regeneruj(rozpietosc) {
        const N = NASTAWY;
        const ch = N.CHROPOWATOSC_BLISKO + (N.CHROPOWATOSC_DALEKO - N.CHROPOWATOSC_BLISKO) * rozpietosc;
        this._luki = Array.from({ length: N.LICZBA_LUKOW }, () =>
            generujPiorun({ x: 0, y: 0 }, { x: 1, y: 0 },
                          { iteracje: N.ITERACJE, chropowatosc: ch * (0.85 + Math.random() * 0.3), liczbaGalezi: 1 }));
        this._jasnosc = 0.7 + Math.random() * 0.3;
        this._iskry = [Math.floor(Math.random() * MANIFEST.wyladowanie.length),
                       Math.floor(Math.random() * MANIFEST.wyladowanie.length)];
        this._katIskry = Math.random() * Math.PI * 2;
        this._doNastepnej = N.ODSTEP_MIN + Math.random() * (N.ODSTEP_MAX - N.ODSTEP_MIN);
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const barki = barkiKlatki(k?.frame, W, H);
        const sk = this._skala.prowadz(barki ? { s: barki.skala } : null, krok)?.s ?? W * 0.12;
        const konce = koncowkiLuku(dlonieKlatki(k?.frame, W, H), sk);
        const a = this._a.prowadz(konce?.a ?? null, krok) ?? { x: W * 0.4, y: H * 0.45 };
        const b = this._b.prowadz(konce?.b ?? null, krok) ?? { x: W * 0.6, y: H * 0.45 };
        const rozpietosc = clamp01(Math.hypot(b.x - a.x, b.y - a.y) / (sk * NASTAWY.DYSTANS_DALEKO_MNOZNIK));

        this._doNastepnej -= krok;
        if (this._doNastepnej <= 0 || !this._luki.length) this._regeneruj(rozpietosc);
        if (!ctx) return;

        const obw = obwiednia(this._t) * this._sila;
        if (obw < 0.01) return;
        const grubosc = 1.2 - 0.7 * rozpietosc;
        ctx.save();
        this._luki.forEach((luk, i) => {
            const waga = i === 0 ? 1 : 0.55;
            rysujSciezke(ctx, mapujSciezke(luk.glowna, a, b), NASTAWY.BARWA,
                         obw * this._jasnosc * waga, obw * waga, grubosc * (i === 0 ? 1 : 0.6));
            for (const galaz of luk.galezie) {
                rysujSciezke(ctx, mapujSciezke(galaz, a, b), NASTAWY.BARWA,
                             obw * this._jasnosc * waga * 0.5, obw * waga * 0.5, grubosc * 0.45);
            }
        });
        // Rozbłysk pęknięcia elektrycznego (spark_*) w KAŻDEJ końcówce.
        ctx.globalCompositeOperation = 'lighter';
        [a, b].forEach((p, i) => {
            const img = obraz(MANIFEST.wyladowanie[this._iskry[i]]);
            if (!img) return;
            const d = sk * NASTAWY.ROZBLYSK_MNOZNIK;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(this._katIskry + i * Math.PI);
            ctx.globalAlpha = clamp01(obw * this._jasnosc);
            ctx.drawImage(wypalTintowany(img, NASTAWY.BARWA, 256), -d / 2, -d / 2, d, d);
            ctx.restore();
        });
        ctx.restore();
    }
}
