/**
 * Zawierucha - nagroda za combo weles -> stribog (2026-10-08, spec
 * docs/superpowers/specs/2026-10-08-grzmot-i-zawierucha-design.md).
 * Ziemia (Weles) oddaje pył wiatrowi (Stribog): poryw przechodzi W POPRZEK
 * kadru przy jego dole. Odwrotność Kurzawy (stribog -> weles), która owija
 * wiatr wokół ciała - tu ruch jest LINIOWY, z jednego boku na drugi.
 *
 * STEROWANIE: zapal() otwiera OKNO_S. Pierwsze GLUCHE_S jest głuche -
 * wyjście z pieczęci powietrza (łokcie razem) samo rozrzuca ręce. Potem
 * każde machnięcie ręką (js/machniecie.js, nadgarstki pozy) wypuszcza JEDEN
 * poryw w stronę ruchu, najwyżej MAX_PORYWOW. Nikt nie machnął -> po
 * zamknięciu okna jeden samoczynny poryw, strona na zmianę (GEMINI.md §2:
 * nic nie mówi źle - combo zawsze coś daje).
 *
 * DWÓJKA DZIAŁAJĄCA NA POLE, ALE SŁABA: dym dostaje punkty pchnięcia
 * z SILA_PCHNIECIA (main.js -> dym.pchnij), Mgła i Kurzawa - znies()
 * (js/reakcjeTechnik.js). Wszystko wyraźnie słabiej niż Aard.
 *
 * MATERIA, NIE ENERGIA (lekcja z Kurzawy v2.1): ochra, source-over, nic
 * nie świeci. WIATR = KRESKA (pamięć projektu "efekt ciągły = kreska, nie
 * sprite"): smuga to głowa + ogień toru z ostatnich DLUGOSC_OGONA_S - czysta
 * funkcja czasu (punktySmugi), bez bufora historii. Co druga smuga idzie na
 * warstwę ZA sylwetką (js/warstwaZaSylwetka.js) - wiatr przechodzi częściowo
 * za graczem, częściowo przed nim.
 */
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';
import { DetektorMachniec } from './machniecie.js';

export const NASTAWY = {
    OKNO_S: 1.5,
    GLUCHE_S: 0.3,
    MAX_PORYWOW: 3,
    CZAS_PRZEJAZDU: 0.8,       // s - czoło smugi przez całe W (ease-out)
    ZYCIE_PORYWU: 1.1,         // s
    WYGASZENIE: 0.35,          // s na końcu życia porywu
    NAROST: 0.08,              // s
    SMUG: 7,
    OPOZNIENIE_MAX: 0.15,      // s - smugi porywu ruszają falą, nie ścianą
    PAS_OD: 1.0, PAS_DO: 1.8,  // skala * to pod barkami - biodra..uda
    DOL_EKRANU: 0.92,          // pas nigdy niżej niż H * to (jak Kurzawa)
    MIN_WYSOKOSC_PASA: 0.35,   // skala * to - gdy gracz blisko kamery i pas ściśnięty dołem
    MARGINES: 0.6,             // skala * to - start/koniec poza krawędzią
    DLUGOSC_OGONA_S: 0.22,
    PUNKTOW_OGONA: 12,
    FALOWANIE: 0.08,           // skala * to - amplituda falowania smugi w pionie
    DLUGOSC_FALI: 1.6,         // skala * to
    UNOSZENIE: 0.25,           // skala * to - pył unosi się pod koniec życia
    SZEROKOSC: 0.05,           // skala * to - przy głowie
    ZIAREN_NA_SMUGE: 5,
    DLUGOSC_ZIARNA: 0.05,      // skala * to
    ROZRZUT_ZIARNA: 0.12,      // skala * to
    ALFA: 0.55,
    SILA_PCHNIECIA: 0.25,      // dym: efektywnie ~0.15 wobec 0.6 Aarda (dym.js PODMUCH_SILA)
    PROMIEN_PCHNIECIA: 0.7,    // skala * to
    BARWA_KURZU: [200, 172, 125],
    BARWA_ZIARNA: [225, 205, 165]
};

// Przebiegi kreski: szeroka blada mgiełka kurzu -> węższy, gęstszy rdzeń.
const PRZEBIEGI = [
    { szer: 3.0, alfa: 0.18, barwa: 'BARWA_KURZU' },
    { szer: 1.0, alfa: 0.45, barwa: 'BARWA_ZIARNA' }
];

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

// Strona ostatniego porywu - samoczynny poryw wieje z przeciwnej (jak strona wjazdu Mgły).
let ostatniKierunek = -1;

/** Ease-out postępu przejazdu 0..1. Czysta funkcja. */
export function postepPrzejazdu(t) {
    const u = clamp01(t / NASTAWY.CZAS_PRZEJAZDU);
    return 1 - (1 - u) * (1 - u);
}

/** Alfa porywu 0..1 w chwili `wiek`. Czysta funkcja. */
export function obwiedniaPorywu(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek <= 0 || wiek >= N.ZYCIE_PORYWU) return 0;
    return Math.min(1, wiek / N.NAROST) * Math.min(1, (N.ZYCIE_PORYWU - wiek) / N.WYGASZENIE);
}

/** Pionowe granice pasa {gora, dol} w px. Czysta funkcja. */
export function pasPorywu(zaczep, H) {
    const N = NASTAWY, sk = zaczep.skala;
    const dol = Math.min(zaczep.y + sk * N.PAS_DO, H * N.DOL_EKRANU);
    const gora = Math.min(zaczep.y + sk * N.PAS_OD, dol - sk * N.MIN_WYSOKOSC_PASA);
    return { gora, dol };
}

/**
 * Głowa smugi w chwili `t` (s od JEJ startu) - czysta funkcja.
 * @returns {{x, y}|null}  null przed startem
 */
export function glowaSmugi(s, kierunek, t, zaczep, W, H) {
    if (!Number.isFinite(t) || t < 0) return null;
    const N = NASTAWY, sk = zaczep.skala;
    const m = sk * N.MARGINES;
    const x0 = kierunek > 0 ? -m : W + m;
    const x = x0 + kierunek * (W + 2 * m) * postepPrzejazdu(t);
    const pas = pasPorywu(zaczep, H);
    const y = pas.gora + s.u * (pas.dol - pas.gora)
        + Math.sin(x / (sk * N.DLUGOSC_FALI) + s.faza) * sk * N.FALOWANIE
        - sk * N.UNOSZENIE * clamp01(t / N.ZYCIE_PORYWU);
    return { x, y };
}

/** Głowa + tor z ostatnich DLUGOSC_OGONA_S; zwezenie 1 przy głowie -> 0. Czysta funkcja. */
export function punktySmugi(s, kierunek, t, zaczep, W, H) {
    const N = NASTAWY, pkt = [];
    for (let k = 0; k <= N.PUNKTOW_OGONA; k++) {
        const p = glowaSmugi(s, kierunek, t - k * N.DLUGOSC_OGONA_S / N.PUNKTOW_OGONA, zaczep, W, H);
        if (!p) break;
        pkt.push({ ...p, zwezenie: 1 - k / N.PUNKTOW_OGONA });
    }
    return pkt;
}

export class Zawierucha {
    constructor() {
        this._sila = 0;
        this._okno = false;
        this._tOkna = 0;
        this._wypuszczone = 0;
        this._porywy = [];
        this._detektor = new DetektorMachniec();
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._zaczep = null;
        this._W = 1920; this._H = 1080;
        this.porywySwieze = [];   // porywy narodzone w tej klatce - pod reakcje
    }

    get aktywny() { return this._okno || this._porywy.length > 0; }
    get okno() { return this._okno; }
    get diagnostyka() { return { okno: this._okno, porywy: this._porywy.length, ...this._detektor.diagnostyka }; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._okno = true;
        this._tOkna = 0;
        this._wypuszczone = 0;
        this._detektor = new DetektorMachniec();   // bufory od zera - bez ruchu sprzed combo
    }

    _wypusc(kierunek) {
        const N = NASTAWY;
        const poryw = {
            kierunek, wiek: 0,
            smugi: Array.from({ length: N.SMUG }, (_, i) => ({
                u: (i + 0.5) / N.SMUG + (Math.random() - 0.5) / N.SMUG,
                opoznienie: Math.random() * N.OPOZNIENIE_MAX,
                faza: Math.random() * Math.PI * 2,
                szer: 0.7 + Math.random() * 0.6,
                za: i % 2 === 1,
                ziarna: Array.from({ length: N.ZIAREN_NA_SMUGE }, () => ({
                    wstecz: Math.random() * N.DLUGOSC_OGONA_S,
                    dy: Math.random() * 2 - 1,
                    faza: Math.random() * 4
                }))
            }))
        };
        this._porywy.push(poryw);
        this.porywySwieze.push(poryw);
        this._wypuszczone++;
        ostatniKierunek = kierunek;
    }

    updateAndDraw(ctx, k, dt) {
        this.porywySwieze = [];
        if (!this.aktywny) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this._W = W; this._H = H;
        this._zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };

        if (this._okno) {
            this._tOkna += krok;
            const zdarzenia = this._detektor.update(k?.frame, W, H, krok);
            if (this._tOkna >= N.GLUCHE_S) {
                for (const z of zdarzenia) {
                    if (this._wypuszczone >= N.MAX_PORYWOW) break;
                    this._wypusc(z.kierunek);
                }
            }
            if (this._tOkna >= N.OKNO_S) {
                this._okno = false;
                if (this._wypuszczone === 0) this._wypusc(-ostatniKierunek);
            }
        }

        for (const p of this._porywy) p.wiek += krok;
        this._porywy = this._porywy.filter(p => p.wiek < N.ZYCIE_PORYWU);
        if (!ctx || !this._porywy.length) return;

        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._rysuj(tyl, true);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        this._rysuj(ctx, false);
    }

    /** @param {boolean} za  true = smugi przechodzące ZA graczem */
    _rysuj(c, za) {
        const N = NASTAWY, sk = this._zaczep.skala;
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const p of this._porywy) {
            const alfa = obwiedniaPorywu(p.wiek) * this._sila * N.ALFA;
            if (alfa < 0.005) continue;
            for (const s of p.smugi) {
                if (s.za !== za) continue;
                const pkt = punktySmugi(s, p.kierunek, p.wiek - s.opoznienie, this._zaczep, this._W, this._H);
                if (pkt.length < 2) continue;
                for (const prz of PRZEBIEGI) {
                    c.strokeStyle = `rgb(${N[prz.barwa].join(',')})`;
                    for (let i = 1; i < pkt.length; i++) {
                        const z = pkt[i].zwezenie;
                        c.globalAlpha = clamp01(alfa * prz.alfa * z);
                        c.lineWidth = Math.max(1, sk * N.SZEROKOSC * s.szer * prz.szer * (0.3 + 0.7 * z));
                        c.beginPath();
                        c.moveTo(pkt[i - 1].x, pkt[i - 1].y);
                        c.lineTo(pkt[i].x, pkt[i].y);
                        c.stroke();
                    }
                }
                // Ziarna piasku: krótkie kreski wzdłuż ruchu, rozrzucone wokół toru i migoczące.
                c.strokeStyle = `rgb(${N.BARWA_ZIARNA.join(',')})`;
                c.lineWidth = 1.6;
                for (const z of s.ziarna) {
                    const g = glowaSmugi(s, p.kierunek, p.wiek - s.opoznienie - z.wstecz, this._zaczep, this._W, this._H);
                    if (!g) continue;
                    if (Math.sin((p.wiek + z.faza) * 14) < -0.3) continue;
                    const y = g.y + z.dy * sk * N.ROZRZUT_ZIARNA;
                    c.globalAlpha = clamp01(alfa * 1.2 * (1 - z.wstecz / N.DLUGOSC_OGONA_S));
                    c.beginPath();
                    c.moveTo(g.x, y);
                    c.lineTo(g.x - p.kierunek * sk * N.DLUGOSC_ZIARNA, y);
                    c.stroke();
                }
            }
        }
        c.restore();
    }

    /**
     * Punkty czoła porywów dla dym.pchnij() - głowy smug z prędkością, SŁABE
     * (SILA_PCHNIECIA). Pozycje z ostatniego updateAndDraw (PULL z poprzedniej
     * klatki, jak fala.czola).
     * @returns {{x, y, r, vx, vy, sila}[]}  px, px/s
     */
    punktyPchniecia() {
        const N = NASTAWY, out = [];
        if (!this._zaczep) return out;
        const sk = this._zaczep.skala, W = this._W, H = this._H;
        for (const p of this._porywy) {
            const s0 = obwiedniaPorywu(p.wiek) * this._sila;
            if (s0 <= 0.01) continue;
            for (const s of p.smugi) {
                const t = p.wiek - s.opoznienie;
                const a = glowaSmugi(s, p.kierunek, t, this._zaczep, W, H);
                const b = glowaSmugi(s, p.kierunek, t - 0.02, this._zaczep, W, H);
                if (!a || !b) continue;
                out.push({ x: a.x, y: a.y, r: sk * N.PROMIEN_PCHNIECIA,
                           vx: (a.x - b.x) / 0.02, vy: (a.y - b.y) / 0.02, sila: N.SILA_PCHNIECIA * s0 });
            }
        }
        return out.filter(q => [q.x, q.y, q.r, q.vx, q.vy, q.sila].every(Number.isFinite));
    }
}
