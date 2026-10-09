/**
 * Dodola - zaklinanie deszczu (combo mokosz -> mokosz -> stribog, spec
 * docs/superpowers/specs/2026-10-09-dodola-zaklinanie-design.md). Nazwa od
 * słowiańskiego obrzędu: tancerka przybrana zielenią tańczy, żeby spadł deszcz.
 *
 * STEROWANIE: zapal() otwiera stan zaklinania (js/zaklinanie.js). Gracz
 * rozpościera ramiona i faluje; jakość fali (js/ruchy/falowanieRamion.js)
 * steruje NATĘŻENIEM 0.08..1: mżawka -> ulewa. Trwa, dopóki gracz faluje.
 *
 * WYGLĄD:
 *   - Krople = KRESKI (pamięć projektu: efekt ciągły = kreska, nie sprite),
 *     przez cały kadr od pierwszej kropli (decyzja właściciela). Rośnie liczba,
 *     prędkość, długość i skos. Materia, nie energia: source-over, nic nie świeci.
 *   - ~70% kropel spada ZA sylwetką (js/warstwaZaSylwetka.js). Taka kropla,
 *     której tor przetnie maskę segmentacji, ginie na ciele i robi ROZPRYSK:
 *     kilka kropelek po paraboli, rysowanych PRZED ciałem. Głowa, barki
 *     i rozpostarte ramiona same są powierzchniami, o które się rozbija.
 *   - Przy dolnej krawędzi kadru drobne pluski (podłogi zwykle nie widać).
 *   - Ulewa lekko przyciemnia kadr. Bez dźwięku (gra nie ma SFX).
 *
 * Skala z barków (js/sledzenie.js), nie ze stałych px - jak każda technika
 * podążająca za ciałem.
 */
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';
import { Zaklinanie } from './zaklinanie.js';
import { FalowanieRamion, jakoscFali } from './ruchy/falowanieRamion.js';

export const NASTAWY = {
    KROPLI_MIN: 12, KROPLI_MAX: 420,   // liczba ∝ natężenie^WYKLADNIK
    WYKLADNIK: 1.5,
    UDZIAL_TYLU: 0.7,                  // tyle kropel spada za sylwetką (i może się o nią rozbić)
    PREDKOSC_OD: 1.3, PREDKOSC_DO: 2.5, // H/s, mżawka -> ulewa
    ROZRZUT_PREDKOSCI: 0.3,
    SMUGA_S: 0.03,                     // długość kreski = prędkość × to (rozmycie ruchu)
    SKOS_OD: 8, SKOS_DO: 15,           // stopnie od pionu
    GRUBOSC_OD: 0.006, GRUBOSC_DO: 0.011, // skala × to
    ALFA_OD: 0.22, ALFA_DO: 0.5,
    BARWA: [200, 222, 240],
    KROK_PROBKOWANIA: 12,              // px - tor kropli sprawdzany co tyle (ramię ma ~40 px)
    PROG_MASKI: 140,                   // 0..255 - pewność sylwetki, od której kropla trafia
    ROZPRYSKOW_NA_KLATKE: 40,
    MAX_KROPELEK: 600,
    KROPELEK_OD: 2, KROPELEK_DO: 5,
    WYRZUT_OD: 0.8, WYRZUT_DO: 2.2,    // skala/s w górę
    ROZRZUT_BOCZNY: 1.2,               // skala/s
    GRAWITACJA: 9,                     // skala/s²
    ZYCIE_KROPELKI_OD: 0.25, ZYCIE_KROPELKI_DO: 0.5,
    SMUGA_KROPELKI_S: 0.035,
    DOL_KADRU: 0.985,                  // H × to - tu pluska ułamek kropel
    UDZIAL_PLUSKOW_DOLU: 0.3,
    PRZYCIEMNIENIE: 0.16,              // alfa przy pełnej ulewie (∝ natężenie²)
    BARWA_PRZYCIEMNIENIA: [15, 25, 40]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const lerp = (a, b, t) => a + (b - a) * t;

/** Docelowa liczba kropel przy natężeniu n. Czysta funkcja. */
export function liczbaKropel(n) {
    const N = NASTAWY;
    return Math.round(N.KROPLI_MIN + (N.KROPLI_MAX - N.KROPLI_MIN) * Math.pow(clamp01(n), N.WYKLADNIK));
}

/**
 * Czy punkt (px płótna gry) leży na sylwetce. Mapowanie jak zaplon.js:
 * maska rysowana przez fit.offsetX/offsetY/scaledW/scaledH. Czysta funkcja.
 */
export function trafienieWMaske(x, y, maska, szer, wys, fit, prog = NASTAWY.PROG_MASKI) {
    if (!maska || !fit || !(szer > 0) || !(wys > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (!(fit.scaledW > 0) || !(fit.scaledH > 0)) return false;
    const mx = Math.floor((x - fit.offsetX) * szer / fit.scaledW);
    const my = Math.floor((y - fit.offsetY) * wys / fit.scaledH);
    if (mx < 0 || my < 0 || mx >= szer || my >= wys) return false;
    return (maska[my * szer + mx] ?? 0) >= prog;
}

/**
 * Pierwszy punkt odcinka (x0,y0)->(x1,y1) na sylwetce - kropla przelatuje
 * w klatce kilkadziesiąt px, a ramię ma kilka razy mniej. Czysta funkcja.
 * @returns {{x, y}|null}
 */
export function pierwszeTrafienie(x0, y0, x1, y1, maska, szer, wys, fit) {
    if (!maska || !fit) return null;
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (!Number.isFinite(d)) return null;
    const kroki = Math.max(1, Math.ceil(d / NASTAWY.KROK_PROBKOWANIA));
    for (let i = 1; i <= kroki; i++) {
        const t = i / kroki;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (trafienieWMaske(x, y, maska, szer, wys, fit)) return { x, y };
    }
    return null;
}

export class Dodola {
    constructor() {
        this.zaklinanie = new Zaklinanie({ miara: new FalowanieRamion(), jakosc: jakoscFali });
        this.wymusNatezenie = null;   // tylko stanowisko VFX (tools/scena.html) - suwak zamiast fali
        this._krople = [];
        this._kropelki = [];
        this._kotwica = new Kotwica(8);
        this._warstwa = new WarstwaZaSylwetka();
        this.rozpryskiKlatki = 0;     // diagnostyka
    }

    get natezenie() {
        if (this.wymusNatezenie !== null && Number.isFinite(this.wymusNatezenie)) {
            return this.zaklinanie.aktywny ? clamp01(this.wymusNatezenie) : 0;
        }
        return this.zaklinanie.natezenie;
    }

    /** Pada albo jeszcze dopadają ostatnie krople. */
    get aktywny() { return this.zaklinanie.aktywny || this._krople.length > 0 || this._kropelki.length > 0; }
    /** Gracz jest w stanie zaklinania (do reakcji i punktów). */
    get pada() { return this.zaklinanie.aktywny; }

    get diagnostyka() {
        const z = this.zaklinanie;
        return { stan: z.stan, natezenie: this.natezenie, jakosc: z.jakosc, skladniki: z.skladniki,
                 powodKonca: z.powodKonca, krople: this._krople.length, kropelki: this._kropelki.length };
    }

    wyczyscCache() {}

    zapal() { this.zaklinanie.zapal(); }

    /**
     * Stan zaklinania - z main.js co klatkę, obok Płonącego Palca.
     * @returns {number} pobór mocy (do motionMeter.zuzyj)
     */
    update(frame, moc, dt) {
        return this.zaklinanie.update(frame?.pose?.worldLandmarks ?? null, moc, dt);
    }

    updateAndDraw(ctx, k, dt) {
        if (!this.aktywny) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const sk = zaczep.skala;
        const n = this.natezenie;

        this._dosyp(n, krok, W, H, sk);
        this.rozpryskiKlatki = this._spadaj(k, krok, W, H, sk, n);
        this._kropelkiKrok(krok, sk);

        if (!ctx) return;
        this._rysuj(ctx, k, W, H, sk, n);
    }

    /** Uzupełnia pulę u góry kadru - tempo tak, żeby utrzymać docelową gęstość. */
    _dosyp(n, krok, W, H, sk) {
        if (!this.zaklinanie.aktywny) return;
        const N = NASTAWY;
        const cel = liczbaKropel(n);
        if (this._krople.length >= cel) return;
        const v = H * lerp(N.PREDKOSC_OD, N.PREDKOSC_DO, n);
        // Kropla przelatuje kadr w H/v s, więc pula odnawia się z tempem cel·v/H na sekundę.
        // Zapas ×1.5: po zapaleniu deszcz wypełnia kadr od góry w ~pół sekundy, nie ścianą.
        let ile = Math.min(cel - this._krople.length, Math.ceil(cel * v / H * krok * 1.5));
        const skos = (lerp(N.SKOS_OD, N.SKOS_DO, n) * Math.PI) / 180;
        while (ile-- > 0) {
            const vv = v * (1 - N.ROZRZUT_PREDKOSCI / 2 + Math.random() * N.ROZRZUT_PREDKOSCI);
            const vx = vv * Math.sin(skos), vy = vv * Math.cos(skos);
            const dl = vv * N.SMUGA_S * (0.8 + Math.random() * 0.4);
            // Start nad kadrem, przesunięty pod wiatr - przy skosie kropla dolatuje dalej w x.
            this._krople.push({
                x: Math.random() * (W + H * Math.tan(skos)) - H * Math.tan(skos),
                y: -dl - Math.random() * vv * krok * 2,
                vx, vy, dl,
                grubosc: Math.max(1, sk * lerp(N.GRUBOSC_OD, N.GRUBOSC_DO, n)),
                alfa: lerp(N.ALFA_OD, N.ALFA_DO, n) * (0.7 + Math.random() * 0.3),
                tyl: Math.random() < N.UDZIAL_TYLU
            });
        }
    }

    /** Ruch kropel, trafienia w sylwetkę i w dół kadru. @returns {number} rozprysków w klatce */
    _spadaj(k, krok, W, H, sk, n) {
        const N = NASTAWY;
        const maska = k?.maska ?? null;
        let rozpryskow = 0;
        const zostaja = [];
        for (const c of this._krople) {
            const x1 = c.x + c.vx * krok, y1 = c.y + c.vy * krok;
            if (c.tyl && maska && y1 > 0) {
                const p = pierwszeTrafienie(c.x, c.y, x1, y1, maska, k.maskaSzer, k.maskaWys, k.fit);
                if (p) {
                    if (rozpryskow < N.ROZPRYSKOW_NA_KLATKE) { this._rozprysk(p.x, p.y, sk, n, 1); rozpryskow++; }
                    continue;   // ponad limit kropla po prostu znika na ciele (i tak jest za nim)
                }
            }
            c.x = x1; c.y = y1;
            if (c.y >= H * N.DOL_KADRU && c.y - c.vy * krok < H * N.DOL_KADRU) {
                if (Math.random() < N.UDZIAL_PLUSKOW_DOLU && rozpryskow < N.ROZPRYSKOW_NA_KLATKE) {
                    this._rozprysk(c.x, H * N.DOL_KADRU, sk, n, 0.6);
                    rozpryskow++;
                }
            }
            if (c.y - c.dl > H || c.x > W + sk) continue;
            zostaja.push(c);
        }
        this._krople = zostaja;
        return rozpryskow;
    }

    _rozprysk(x, y, sk, n, sila) {
        const N = NASTAWY;
        const wolne = N.MAX_KROPELEK - this._kropelki.length;
        if (wolne <= 0) return;
        const ile = Math.min(wolne, Math.round(lerp(N.KROPELEK_OD, N.KROPELEK_DO, Math.random() * (0.5 + 0.5 * n))));
        for (let i = 0; i < ile; i++) {
            const zycie = lerp(N.ZYCIE_KROPELKI_OD, N.ZYCIE_KROPELKI_DO, Math.random());
            this._kropelki.push({
                x, y: y - 1,
                vx: (Math.random() * 2 - 1) * N.ROZRZUT_BOCZNY * sk * sila,
                vy: -lerp(N.WYRZUT_OD, N.WYRZUT_DO, Math.random()) * sk * (0.6 + 0.4 * n) * sila,
                wiek: 0, zycie,
                grubosc: Math.max(1, sk * N.GRUBOSC_OD * 0.9)
            });
        }
    }

    _kropelkiKrok(krok, sk) {
        const g = NASTAWY.GRAWITACJA * sk;
        const zostaja = [];
        for (const p of this._kropelki) {
            p.wiek += krok;
            if (p.wiek >= p.zycie) continue;
            p.vy += g * krok;
            p.x += p.vx * krok;
            p.y += p.vy * krok;
            zostaja.push(p);
        }
        this._kropelki = zostaja;
    }

    _rysuj(ctx, k, W, H, sk, n) {
        const N = NASTAWY;
        const [r, g, b] = N.BARWA;
        if (this.zaklinanie.aktywny && n > 0.05) {
            const [pr, pg, pb] = N.BARWA_PRZYCIEMNIENIA;
            ctx.save();
            ctx.fillStyle = `rgba(${pr},${pg},${pb},${(N.PRZYCIEMNIENIE * n * n).toFixed(3)})`;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        // Tył: krople za sylwetką - ciało je przesłania (wycięcie maską).
        const tyl = this._krople.filter(c => c.tyl);
        if (tyl.length) {
            const warstwa = this._warstwa.zacznij(W, H);
            if (warstwa) {
                rysujKreski(warstwa, tyl, r, g, b);
                this._warstwa.zakoncz(ctx, k?.maska, k?.maskaSzer, k?.maskaWys, k?.fit);
            }
        }
        // Przód: reszta kropel i wszystkie rozpryski.
        rysujKreski(ctx, this._krople.filter(c => !c.tyl), r, g, b);
        if (this._kropelki.length) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineCap = 'round';
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            for (const p of this._kropelki) {
                const u = 1 - p.wiek / p.zycie;
                ctx.globalAlpha = clamp01(0.75 * u);
                ctx.lineWidth = p.grubosc;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * N.SMUGA_KROPELKI_S, p.y - p.vy * N.SMUGA_KROPELKI_S);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}

/** Kreski kropel wsadowo: jedna ścieżka na kubeł alfy, nie stroke() na kroplę. */
function rysujKreski(c, krople, r, g, b) {
    if (!krople.length) return;
    const KUBLY = 4;
    const kubly = Array.from({ length: KUBLY }, () => []);
    for (const k of krople) kubly[Math.min(KUBLY - 1, Math.floor(clamp01(k.alfa / NASTAWY.ALFA_DO) * KUBLY))].push(k);
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.lineCap = 'round';
    c.strokeStyle = `rgb(${r},${g},${b})`;
    for (let i = 0; i < KUBLY; i++) {
        const kubel = kubly[i];
        if (!kubel.length) continue;
        c.globalAlpha = ((i + 0.5) / KUBLY) * NASTAWY.ALFA_DO;
        c.lineWidth = kubel[0].grubosc;
        c.beginPath();
        for (const k of kubel) {
            const v = Math.hypot(k.vx, k.vy) || 1;
            c.moveTo(k.x, k.y);
            c.lineTo(k.x - (k.vx / v) * k.dl, k.y - (k.vy / v) * k.dl);
        }
        c.stroke();
    }
    c.restore();
}
