/**
 * Łuk Peruna - nagroda za combo mokosz -> perun (proste combo 2026-10-02).
 * Woda przewodzi piorun (a w części rekonstrukcji mitu Mokosz jest żoną
 * Peruna): między dłońmi trzaska wyładowanie, które rozciąga się razem
 * z rękami.
 *
 * HISTORIA STYLU (wszystko po testach na kamerze właściciela):
 *  - v1: piorun z piorun.js (gruby biały rdzeń + poświata) - "za bardzo błyskawica";
 *  - v2: cienka nitka płynnie falująca szumem - "za subtelne, nie wygląda jak
 *    fajne błyskawice";
 *  - v3 (2026-10-03): OSTRY ZYGZAK - kanciasta ścieżka z segmentuj() (piorun.js,
 *    rekurencyjne przesunięcie punktu środkowego), losowana na nowo co 60-90 ms
 *    (12-16x/s, wyraźny "trzask"), a między odświeżeniami lekko drgająca.
 *    Niebieska linia 2 px z bladym rdzeniem 1 px, druga cieńsza nitka, iskry
 *    z rozwidleniem. Nadal cienko i source-over - bez grubej białej belki v1.
 *
 * Ścieżka liczona w układzie ZNORMALIZOWANYM (0,0)->(1,0) i mapowana na
 * bieżące położenie dłoni (mapujZygzak), więc łuk trzyma się dłoni co klatkę,
 * choć kształt zmienia się tylko przy odświeżeniu.
 *
 * DŁONIE - PROSTA LOGIKA (powrót do v1 na życzenie właściciela; płynny dryf
 * zgubionego końca z v2 wyglądał nienaturalnie): dwie dłonie - łuk między
 * nimi; jedna - piorun wyskakuje z niej W GÓRĘ; żadnej - łuk stoi w ostatnim
 * miejscu. Przejście między trybami natychmiastowe, tylko wygładzone Kotwicą.
 */
import { segmentuj } from './piorun.js';
import { simplex3 } from './szum.js';
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { dlonieKlatki, barkiKlatki, Kotwica } from './sledzenie.js';

export const CZAS_TRWANIA = 6.0;   // s - po testach: 6 s za krótko przy subtelnej v2, 12 s za długo, 4 s za mało przy wyraźnej v3

export const NASTAWY = {
    ITERACJE: 5,                  // 2^5+1 = 33 punkty - dużo ostrych załamań
    WYGIECIE_BLISKO: 0.08, WYGIECIE_DALEKO: 0.16,           // pierwszy podział: ogólne wygięcie łuku
    CHROPOWATOSC_BLISKO: 0.28, CHROPOWATOSC_DALEKO: 0.42,   // kolejne: lokalne załamania (bez zaniku)
    DYSTANS_DALEKO_MNOZNIK: 4,    // skala * to = dłonie "maksymalnie rozsunięte"
    ODSWIEZANIE_MIN: 0.06, ODSWIEZANIE_MAX: 0.09,   // s - nowy kształt zygzaka (trzask)
    DRGNIECIE: 0.02,              // skala * to - drganie punktów MIĘDZY odświeżeniami
    PREDKOSC_DRGNIEC: 9,
    ALFA_LUKU: 0.9, ALFA_RDZENIA: 0.85, ALFA_DRUGIEJ_NITKI: 0.45,
    GRUBOSC_LUKU: 2, GRUBOSC_RDZENIA: 1, GRUBOSC_DRUGIEJ: 1.2,   // px - cienko (test: <= 2)
    WYSOKOSC_JEDNEJ_DLONI: 2.2,   // skala * to - piorun w górę z jedynej widocznej dłoni
    SZYBKOSC_KONCOW: 22,          // 1/s - wygładzenie końców (przejście trybów ~0.1 s)
    // Iskry (2026-10-03): dłuższe, grubsze, z rozwidleniem, błyskiem u nasady i życiem >= 5 klatek.
    ISKRY_SERIA_MIN: 4, ISKRY_SERIA_MAX: 7,
    ISKRY_ODSTEP_MIN: 0.08, ISKRY_ODSTEP_MAX: 0.2,    // s między seriami
    ISKRA_ZYCIE_MIN: 0.08, ISKRA_ZYCIE_MAX: 0.16,     // s
    ISKRA_DLUGOSC_OD: 0.15, ISKRA_DLUGOSC_DO: 0.4,    // skala * to
    ISKRA_ODNOGA: 0.45,                               // długość odnogi / długość iskry
    GRUBOSC_ISKRY: 2, GRUBOSC_ODNOGI: 1.2,            // px
    ALFA_ISKRY: 0.95,
    ISKRA_BLYSK_PROMIEN: 0.08, ISKRA_BLYSK_ALFA: 0.5, // skala * to; mały błysk u nasady iskry
    MGIELKA_PROMIEN: 0.6, MGIELKA_ALFA: 0.32,         // skala * to; alfa środka
    ROZBLYSK_MNOZNIK: 0.55, ROZBLYSK_ALFA: 0.4,       // spark_* przy dłoniach
    NAROST: 0.15, WYGASZENIE: 0.8,   // s
    BARWA: [90, 160, 255],           // elektryczny niebieski - główna linia, druga nitka, mgiełka
    BARWA_RDZENIA: [200, 225, 255],  // blady rdzeń - jasność bez grubej białej belki
    BARWA_ISKRY: [190, 215, 255]     // iskry lekko niebieskie
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const losuj = (min, max, los = Math.random) => min + los() * (max - min);

export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/**
 * Końce łuku z widocznych dłoni (dlonieKlatki) - czysta funkcja.
 * @returns {{a:{x,y}, b:{x,y}}|null}  dwie: między nimi; jedna: w górę z niej; żadnej: null
 */
export function koncowkiLuku(dlonie, skala) {
    if (!Array.isArray(dlonie) || !dlonie.length) return null;
    if (dlonie.length >= 2) return { a: dlonie[0], b: dlonie[1] };
    const d = dlonie[0];
    return { a: d, b: { x: d.x, y: d.y - skala * NASTAWY.WYSOKOSC_JEDNEJ_DLONI } };
}

/**
 * Nowy kształt zygzaka w układzie znormalizowanym (0,0)->(1,0) - przesunięcie
 * punktu środkowego, ale BEZ zaniku poszarpania na drobnych poziomach (inaczej
 * niż segmentuj() z piorun.js, gdzie SPADEK_CHROPOWATOSCI 0.55 wygładza
 * drobne odcinki - zmierzone: mediana największego załamania tylko 23-43°).
 * Pierwszy podział ma małe WYGIĘCIE (łuk nie puchnie), kolejne stałe, duże
 * ZAŁAMANIA - ostre kąty w każdej skali, jak błyskawica.
 * Losowy - wołany tylko przy odświeżeniu.
 * @param {number} rozpietosc  0..1 - im szerzej dłonie, tym bardziej poszarpany
 */
export function nowyZygzak(rozpietosc, los = Math.random) {
    const N = NASTAWY;
    const r = clamp01(rozpietosc);
    const wygiecie = N.WYGIECIE_BLISKO + (N.WYGIECIE_DALEKO - N.WYGIECIE_BLISKO) * r;
    const zalamanie = N.CHROPOWATOSC_BLISKO + (N.CHROPOWATOSC_DALEKO - N.CHROPOWATOSC_BLISKO) * r;
    let pkt = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    for (let it = 0; it < N.ITERACJE; it++) {
        const ch = it === 0 ? wygiecie : zalamanie;
        const nowe = [pkt[0]];
        for (let i = 0; i < pkt.length - 1; i++) {
            const a = pkt[i], b = pkt[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy);
            const w = (los() * 2 - 1) * dl * ch;
            nowe.push({ x: (a.x + b.x) / 2 - (dl > 1e-12 ? dy / dl : 0) * w,
                        y: (a.y + b.y) / 2 + (dl > 1e-12 ? dx / dl : 0) * w });
            nowe.push(b);
        }
        pkt = nowe;
    }
    return pkt;
}

/**
 * Zygzak na odcinku a->b w pikselach, z lekkim drganiem punktów między
 * odświeżeniami - czysta funkcja czasu (bez losowania). Końce dokładnie w dłoniach.
 * @param {number} seed  ziarno drgania (zmieniane przy odświeżeniu)
 */
export function mapujZygzak(pkt, a, b, skala, t, seed) {
    const N = NASTAWY;
    const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy);
    const nx = dl > 1e-9 ? -dy / dl : 0, ny = dl > 1e-9 ? dx / dl : 1;
    const amp = skala * N.DRGNIECIE;
    return pkt.map((p, i) => {
        const drg = i === 0 || i === pkt.length - 1 ? 0 : amp * simplex3(i * 0.7, t * N.PREDKOSC_DRGNIEC, seed);
        return { x: a.x + p.x * dx - p.y * dy + nx * drg, y: a.y + p.x * dy + p.y * dx + ny * drg };
    });
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
        this._zygzak = null;
        this._zygzak2 = null;
        this._seed = 0;
        this._doOdswiezenia = 0;
        this._doSerii = 0;
        this._iskry = [];
        this._rozblyski = [0, 0];
        this._a = new Kotwica(NASTAWY.SZYBKOSC_KONCOW);
        this._b = new Kotwica(NASTAWY.SZYBKOSC_KONCOW);
        this._skala = new Kotwica(6);
        this.konce = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._zygzak = null;
        this._zygzak2 = null;
        this._doOdswiezenia = 0;
        this._doSerii = 0;
        this._iskry = [];
        this._rozblyski = [Math.floor(Math.random() * MANIFEST.wyladowanie.length),
                           Math.floor(Math.random() * MANIFEST.wyladowanie.length)];
        this._a.reset(); this._b.reset(); this._skala.reset();
        this.konce = null;
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
        const cel = koncowkiLuku(dlonieKlatki(k?.frame, W, H), sk);
        const a = this._a.prowadz(cel?.a ?? null, krok) ?? { x: W * 0.4, y: H * 0.45 };
        const b = this._b.prowadz(cel?.b ?? null, krok) ?? { x: W * 0.6, y: H * 0.45 };
        this.konce = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
        const rozpietosc = clamp01(Math.hypot(b.x - a.x, b.y - a.y) / (sk * N.DYSTANS_DALEKO_MNOZNIK));

        // Trzask: nowy kształt obu nitek co ODSWIEZANIE_* s.
        this._doOdswiezenia -= krok;
        if (this._doOdswiezenia <= 0 || !this._zygzak) {
            this._zygzak = nowyZygzak(rozpietosc);
            this._zygzak2 = nowyZygzak(rozpietosc);
            this._seed = Math.random() * 100;
            this._doOdswiezenia = losuj(N.ODSWIEZANIE_MIN, N.ODSWIEZANIE_MAX);
        }

        // Iskry: serie odskoków (ISKRY_SERIA_*) co ISKRY_ODSTEP_* s.
        this._doSerii -= krok;
        if (this._doSerii <= 0) {
            const ile = Math.floor(losuj(N.ISKRY_SERIA_MIN, N.ISKRY_SERIA_MAX + 1));
            for (let i = 0; i < ile; i++) this._iskry.push(nowaIskra());
            this._doSerii = losuj(N.ISKRY_ODSTEP_MIN, N.ISKRY_ODSTEP_MAX);
        }
        for (const i of this._iskry) i.wiek += krok;
        this._iskry = this._iskry.filter(i => i.wiek < i.zycie);
        if (!ctx) return;   // guard PO zegarze, końcach, zygzaku i iskrach - patrz kolowrot.js

        const obw = obwiednia(this._t) * this._sila;
        if (obw < 0.01) return;
        const luk = mapujZygzak(this._zygzak, a, b, sk, this._t, this._seed);
        const luk2 = mapujZygzak(this._zygzak2, a, b, sk, this._t, this._seed + 31);
        const [ri, gi, bi] = N.BARWA_ISKRY;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';   // bez blendowania addytywnego
        ctx.lineJoin = 'miter';                          // ostre załamania zostają ostre
        ctx.lineCap = 'round';
        this._mgielkaIRozblysk(ctx, a, 0, sk, obw);
        this._mgielkaIRozblysk(ctx, b, 1, sk, obw);
        const nitki = [
            [luk2, N.BARWA, N.ALFA_DRUGIEJ_NITKI, N.GRUBOSC_DRUGIEJ],
            [luk, N.BARWA, N.ALFA_LUKU, N.GRUBOSC_LUKU],
            [luk, N.BARWA_RDZENIA, N.ALFA_RDZENIA, N.GRUBOSC_RDZENIA]
        ];
        for (const [pkt, [r, g, bb], alfa, grubosc] of nitki) {
            ctx.strokeStyle = `rgba(${r},${g},${bb},${(alfa * obw).toFixed(3)})`;
            ctx.lineWidth = grubosc;
            ctx.beginPath();
            pkt.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.stroke();
        }
        ctx.lineJoin = 'round';
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
