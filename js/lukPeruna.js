/**
 * Łuk Peruna - nagroda za combo mokosz -> perun (proste combo 2026-10-02).
 * Woda przewodzi piorun (a w części rekonstrukcji mitu Mokosz jest żoną
 * Peruna): między dłońmi iskrzy elektryczność, która rozciąga się razem
 * z rękami.
 *
 * v2 (2026-10-03, po teście na kamerze): pierwsza wersja używała pioruna z
 * piorun.js (twardy biały rdzeń + gruba poświata) i wyglądała jak BŁYSKAWICA.
 * Teraz to ELEKTRYCZNOŚĆ - subtelna: jedna cienka (2 px) nitka w bladym
 * błękicie (2 px), drgająca w poprzek linii dłoń-dłoń płynnym szumem (simplex3, nie
 * regeneracja ścieżki co klatkę), druga jeszcze cieńsza nitka w innej fazie,
 * rzadkie "zacięcie" (zmiana ziarna szumu co 0.3-0.6 s) i drobne iskry -
 * krótkie, poszarpane odskoki od łuku żyjące 40-80 ms. Wszystko source-over,
 * nic nie jest addytywne ani grube. Przy dłoniach miękka mgiełka ładunku
 * i mały spark_*.
 *
 * KOŃCE ŁUKU PO TOŻSAMOŚCI DŁONI, nie po kolejności od lewej
 * (js/sledzenie.js TozsamoscDloni): kamera często gubi dłoń, a poprzednia
 * wersja przerzucała wtedy łuk na drugą dłoń i skakała z powrotem. Teraz
 * zgubiony koniec stoi (okres łaski), potem płynnie wędruje nad widoczną
 * dłoń, a po powrocie dłoni leci do niej z ograniczoną prędkością.
 * Żadnej dłoni od początku: końce w zastępczym miejscu - nigdy brak efektu
 * (GEMINI.md §2).
 */
import { segmentuj } from './piorun.js';
import { simplex3 } from './szum.js';
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { dlonieKlatki, barkiKlatki, Kotwica, TozsamoscDloni, TOZSAMOSC } from './sledzenie.js';

export const CZAS_TRWANIA = 12.0;   // s - x2 (2026-10-03, po teście: 6 s było za krótko)

export const NASTAWY = {
    PUNKTOW_LUKU: 28,
    DRGANIE_BLISKO: 0.06, DRGANIE_DALEKO: 0.28,   // skala * to = amplituda drgania w poprzek łuku
    DYSTANS_DALEKO_MNOZNIK: 4,    // skala * to = dłonie "maksymalnie rozsunięte"
    SZUM_SKALA: 3.2,              // gęstość falowania wzdłuż łuku
    PREDKOSC_SZUMU: 1.6,          // jak szybko łuk faluje w czasie
    ZACIECIE_MIN: 0.3, ZACIECIE_MAX: 0.6,   // s - co ile zmienia się ziarno szumu (subtelne "zacięcie")
    ALFA_LUKU: 0.85, ALFA_DRUGIEJ_NITKI: 0.5,   // 0.55/0.3 było za subtelne
    GRUBOSC_LUKU: 2, GRUBOSC_DRUGIEJ: 1.2,   // px - stałe: to nitka, nie belka (test: <= 2)
    PRZYGASZENIE_ODPIECIA: 0.35,  // o tyle łuk blednie, gdy jedna dłoń jest odpięta
    // Iskry (2026-10-03): samo zwiększenie LICZBY nie dało widoczności - były
    // za krótkie (15-40 px), za cienkie i żyły 2-5 klatek. Teraz mniej, ale
    // dłuższe, grubsze, z rozwidleniem, błyskiem u nasady i życiem >= 5 klatek.
    ISKRY_SERIA_MIN: 4, ISKRY_SERIA_MAX: 7,
    ISKRY_ODSTEP_MIN: 0.08, ISKRY_ODSTEP_MAX: 0.2,    // s między seriami
    ISKRA_ZYCIE_MIN: 0.08, ISKRA_ZYCIE_MAX: 0.16,     // s
    ISKRA_DLUGOSC_OD: 0.15, ISKRA_DLUGOSC_DO: 0.4,    // skala * to
    ISKRA_ODNOGA: 0.45,                               // długość odnogi / długość iskry
    GRUBOSC_ISKRY: 2, GRUBOSC_ODNOGI: 1.2,            // px
    ALFA_ISKRY: 0.95,
    ISKRA_BLYSK_PROMIEN: 0.08, ISKRA_BLYSK_ALFA: 0.5, // skala * to; mały błysk u nasady iskry
    MGIELKA_PROMIEN: 0.6, MGIELKA_ALFA: 0.32,          // skala * to; alfa środka
    ROZBLYSK_MNOZNIK: 0.55, ROZBLYSK_ALFA: 0.4,      // spark_* przy dłoniach
    NAROST: 0.15, WYGASZENIE: 0.8,   // s
    WYSOKOSC_JEDNEJ_DLONI: TOZSAMOSC.GORA_MNOZNIK,
    BARWA: [170, 205, 255],          // blady błękit
    BARWA_ISKRY: [235, 245, 255]   // prawie biały - iskra ma być jaśniejsza od nitki
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const losuj = (min, max, los = Math.random) => min + los() * (max - min);

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/**
 * Końce łuku ze slotów TozsamoscDloni - czysta funkcja. Sloty niosą już
 * pozycje po dryfie/łasce, więc tu tylko uzupełniamy slot NIGDY niewidziany
 * (jedna dłoń od początku): koniec wyładowuje się W GÓRĘ nad znaną dłonią.
 * @returns {{a:{x,y}, b:{x,y}}|null}  null, gdy nie widziano żadnej dłoni
 */
export function koncowkiLuku(sloty, skala) {
    const { a, b } = sloty ?? {};
    if (!a && !b) return null;
    const gora = skala * NASTAWY.WYSOKOSC_JEDNEJ_DLONI;
    return {
        a: a ? { x: a.x, y: a.y } : { x: b.x, y: b.y - gora },
        b: b ? { x: b.x, y: b.y } : { x: a.x, y: a.y - gora }
    };
}

/**
 * Punkty nitki łuku między a i b - czysta funkcja czasu (bez losowania, więc
 * łuk PŁYNIE, zamiast migotać). Końce dokładnie w dłoniach; wychylenie
 * w poprzek znika na końcach (sin(pi*s)) i rośnie z rozpiętością dłoni.
 * @param {number} seed  ziarno szumu - jego zmiana robi "zacięcie"
 * @param {number} rozpietosc  0..1
 * @param {number} faza  przesunięcie szumu (druga nitka = inna faza)
 */
export function punktyLuku(a, b, skala, t, seed, rozpietosc, faza = 0) {
    const N = NASTAWY;
    const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy);
    const nx = dl > 1e-9 ? -dy / dl : 0, ny = dl > 1e-9 ? dx / dl : 1;
    const amp = skala * (N.DRGANIE_BLISKO + (N.DRGANIE_DALEKO - N.DRGANIE_BLISKO) * clamp01(rozpietosc));
    const pkt = [];
    for (let k = 0; k < N.PUNKTOW_LUKU; k++) {
        const s = k / (N.PUNKTOW_LUKU - 1);
        const wych = k === 0 || k === N.PUNKTOW_LUKU - 1 ? 0
            : amp * Math.sin(Math.PI * s) * simplex3(s * N.SZUM_SKALA + faza * 7.3, t * N.PREDKOSC_SZUMU, seed);
        pkt.push({ x: a.x + dx * s + nx * wych, y: a.y + dy * s + ny * wych });
    }
    return pkt;
}

/**
 * Nowa iskra - czysta funkcja losowania (`los` wstrzykiwany do testów). Kształt
 * w układzie lokalnym (jednostki skali): lx wzdłuż łuku, ly w poprzek; poszarpany
 * przez segmentuj() z piorun.js (ta sama geometria, ale krótko i cienko).
 */
export function nowaIskra(los = Math.random) {
    const N = NASTAWY;
    const dl = losuj(N.ISKRA_DLUGOSC_OD, N.ISKRA_DLUGOSC_DO, los);
    // Głównie w poprzek łuku (+-60..120 deg od stycznej), na obie strony.
    const kat = (Math.PI / 3 + los() * Math.PI / 3) * (los() < 0.5 ? 1 : -1);
    const lokalne = segmentuj({ x: 0, y: 0 }, { x: Math.cos(kat) * dl, y: Math.sin(kat) * dl }, 2, 0.3);
    // Rozwidlenie: z środka iskry odchodzi krótsza odnoga pod +-35..55 deg.
    const zrodlo = lokalne[Math.floor(lokalne.length / 2)];
    const katOdn = kat + (0.6 + los() * 0.4) * (los() < 0.5 ? 1 : -1);
    const dlOdn = dl * N.ISKRA_ODNOGA;
    const odnoga = segmentuj(zrodlo, { x: zrodlo.x + Math.cos(katOdn) * dlOdn, y: zrodlo.y + Math.sin(katOdn) * dlOdn }, 1, 0.3);
    return {
        s: 0.1 + los() * 0.8,
        wiek: 0,
        zycie: losuj(N.ISKRA_ZYCIE_MIN, N.ISKRA_ZYCIE_MAX, los),
        lokalne,
        odnoga
    };
}

/** Układ lokalny iskry (lx wzdłuż stycznej łuku, ly w poprzek, w skali) -> piksele, zaczepiony na łuku. */
function mapujLokalne(lok, iskra, luk, skala) {
    const n = luk.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round(iskra.s * (n - 1))));
    const p = luk[idx], przed = luk[Math.max(0, idx - 1)], po = luk[Math.min(n - 1, idx + 1)];
    let tx = po.x - przed.x, ty = po.y - przed.y;
    const dl = Math.hypot(tx, ty);
    if (dl > 1e-9) { tx /= dl; ty /= dl; } else { tx = 1; ty = 0; }
    return lok.map(q => ({
        x: p.x + tx * q.x * skala - ty * q.y * skala,
        y: p.y + ty * q.x * skala + tx * q.y * skala
    }));
}

/** Iskra w pikselach: zaczepiona w punkcie łuku `luk` o względnej pozycji `s`, wzdłuż jego stycznej. */
export function punktyIskry(iskra, luk, skala) { return mapujLokalne(iskra.lokalne, iskra, luk, skala); }

/** Odnoga iskry w pikselach (zaczyna się w środku iskry). */
export function punktyOdnogi(iskra, luk, skala) { return mapujLokalne(iskra.odnoga, iskra, luk, skala); }

export class LukPeruna {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._seed = 0;
        this._doZaciecia = 0;
        this._doSerii = 0;
        this._iskry = [];
        this._rozblyski = [0, 0];
        this._dlonie = new TozsamoscDloni();
        this._skala = new Kotwica(6);
        this.konce = null;
        this._odpiecie = 0;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._seed = Math.random() * 100;
        this._doZaciecia = 0;
        this._doSerii = 0;
        this._iskry = [];
        this._rozblyski = [Math.floor(Math.random() * MANIFEST.wyladowanie.length),
                           Math.floor(Math.random() * MANIFEST.wyladowanie.length)];
        this._dlonie.reset();
        this._skala.reset();
        this.konce = null;
        this._odpiecie = 0;
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        const barki = barkiKlatki(k?.frame, W, H);
        const sk = this._skala.prowadz(barki ? { s: barki.skala } : null, krok)?.s ?? W * 0.12;
        const sloty = this._dlonie.prowadz(dlonieKlatki(k?.frame, W, H), sk, krok);
        this.konce = koncowkiLuku(sloty, sk)
            ?? this.konce
            ?? { a: { x: W * 0.4, y: H * 0.45 }, b: { x: W * 0.6, y: H * 0.45 } };
        this._odpiecie = Math.max(sloty.a?.odpiecie ?? 0, sloty.b?.odpiecie ?? 0);
        const { a, b } = this.konce;
        const rozpietosc = clamp01(Math.hypot(b.x - a.x, b.y - a.y) / (sk * N.DYSTANS_DALEKO_MNOZNIK));

        // "Zacięcie": rzadka zmiana ziarna szumu - łuk subtelnie zmienia kształt.
        this._doZaciecia -= krok;
        if (this._doZaciecia <= 0) { this._seed = Math.random() * 100; this._doZaciecia = losuj(N.ZACIECIE_MIN, N.ZACIECIE_MAX); }

        // Iskry: serie odskoków (ISKRY_SERIA_*) co ISKRY_ODSTEP_* s.
        this._doSerii -= krok;
        if (this._doSerii <= 0) {
            const ile = Math.floor(losuj(N.ISKRY_SERIA_MIN, N.ISKRY_SERIA_MAX + 1));
            for (let i = 0; i < ile; i++) this._iskry.push(nowaIskra());
            this._doSerii = losuj(N.ISKRY_ODSTEP_MIN, N.ISKRY_ODSTEP_MAX);
        }
        for (const i of this._iskry) i.wiek += krok;
        this._iskry = this._iskry.filter(i => i.wiek < i.zycie);
        if (!ctx) return;   // guard PO zegarze, końcach i iskrach - patrz kolowrot.js

        const obw = obwiednia(this._t) * this._sila * (1 - N.PRZYGASZENIE_ODPIECIA * this._odpiecie);
        if (obw < 0.01) return;
        const luk = punktyLuku(a, b, sk, this._t, this._seed, rozpietosc, 0);
        const luk2 = punktyLuku(a, b, sk, this._t, this._seed, rozpietosc, 1);
        const [r, g, bb] = N.BARWA, [ri, gi, bi] = N.BARWA_ISKRY;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';   // elektryczność subtelna: nic nie świeci addytywnie
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        this._mgielkaIRozblysk(ctx, a, 0, sk, obw);
        this._mgielkaIRozblysk(ctx, b, 1, sk, obw);
        for (const [pkt, alfa, grubosc] of [[luk2, N.ALFA_DRUGIEJ_NITKI, N.GRUBOSC_DRUGIEJ], [luk, N.ALFA_LUKU, N.GRUBOSC_LUKU]]) {
            ctx.strokeStyle = `rgba(${r},${g},${bb},${(alfa * obw).toFixed(3)})`;
            ctx.lineWidth = grubosc;
            ctx.beginPath();
            pkt.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.stroke();
        }
        for (const iskra of this._iskry) {
            // Jasna przez pierwszą połowę życia, potem gaśnie - iskra ma być WIDOCZNA, nie mignięcie.
            const jas = Math.min(1, (1 - iskra.wiek / iskra.zycie) * 1.6) * obw;
            const pkt = punktyIskry(iskra, luk, sk);
            this._blyskNasady(ctx, pkt[0], sk, jas);
            for (const [linia, grubosc, mnoz] of [[pkt, N.GRUBOSC_ISKRY, 1], [punktyOdnogi(iskra, luk, sk), N.GRUBOSC_ODNOGI, 0.7]]) {
                ctx.strokeStyle = `rgba(${ri},${gi},${bi},${(N.ALFA_ISKRY * jas * mnoz).toFixed(3)})`;
                ctx.lineWidth = grubosc;
                ctx.beginPath();
                linia.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    /** Mały błysk u nasady iskry - to on sprawia, że iskra jest widoczna jako wyładowanie. */
    _blyskNasady(ctx, p, sk, jas) {
        const N = NASTAWY;
        const [r, g, b] = N.BARWA_ISKRY;
        const R = sk * N.ISKRA_BLYSK_PROMIEN;
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        gr.addColorStop(0, `rgba(${r},${g},${b},${(N.ISKRA_BLYSK_ALFA * jas).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        ctx.fill();
    }

    /** Miękka mgiełka ładunku przy dłoni i mały spark_* - bez blendowania addytywnego. */
    _mgielkaIRozblysk(ctx, p, i, sk, obw) {
        const N = NASTAWY;
        const [r, g, b] = N.BARWA;
        const R = sk * N.MGIELKA_PROMIEN;
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        gr.addColorStop(0, `rgba(${r},${g},${b},${(N.MGIELKA_ALFA * obw).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        ctx.fill();
        const img = obraz(MANIFEST.wyladowanie[this._rozblyski[i]]);
        if (!img) return;   // asset jeszcze się ładuje - GEMINI.md §2
        const d = sk * N.ROZBLYSK_MNOZNIK;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this._t * 0.8 + i * Math.PI);
        ctx.globalAlpha = clamp01(N.ROZBLYSK_ALFA * obw);
        ctx.drawImage(wypalTintowany(img, N.BARWA_ISKRY, 128), -d / 2, -d / 2, d, d);
        ctx.restore();
    }
}
