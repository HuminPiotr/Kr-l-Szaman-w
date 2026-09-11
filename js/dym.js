/**
 * Dym Okadzenia - kłęby, fizyka, front ognia, rysowanie.
 *
 * Nie wie nic o pieczęciach, kombosach ani mocy - dostaje pozycję/kierunek/
 * siłę z js/dmuchanie.js i punkty zarzewia z main.js (dziś: Płonący Palec,
 * jutro: dowolna inna technika ognia - patrz podpal()). Ten sam podział
 * odpowiedzialności co ogien.js/plonacyPalec.js.
 *
 * ================== ZMIANA FIZYKI W TRAKCIE IMPLEMENTACJI (2026-09-11) =====
 * Pierwsza wersja specu (docs/superpowers/specs/2026-09-11-okadzenie-dym-
 * design.md) zakładała, że kłąb opuszcza górę ekranu w ~50-70 s. Życzenie
 * właściciela gry po drodze: dym ma się KŁĘBIĆ PO CAŁYM EKRANIE, głównie
 * pod sufitem, i blednąć dopiero BLISKO KOŃCA swojego ~4-minutowego życia,
 * nie wylatywać wcześniej. Stąd `_wyporność()` niżej: unoszenie SŁABNIE, gdy
 * kłąb zbliża się do górnej krawędzi, więc zamiast uciekać poza kadr - zwalnia
 * i rozlewa się na boki, jak prawdziwy dym uderzający o sufit.
 *
 * ================== TRZY STANY KŁĘBU ==================
 *   DYM     - unosi się, rośnie, dłonie mogą go rozgarniać (rozgarnij()).
 *   ZAPLON  - podpalony (podpal()); po krótkim opóźnieniu zaraża sąsiadów
 *             w zasięgu (FRONT biegnie kłąb po kłębie), potem wybucha.
 *   WYBUCH  - kula ognia, krótko, potem kłąb znika NA ZAWSZE (nie wraca do DYM).
 *
 * ================== RYSOWANIE: DWA TRYBY MIESZANIA ==================
 * DYM rysowany 'source-over' w jasnej szarości - reszta gry rysuje
 * WYŁĄCZNIE 'lighter' (ogien.js/fala.js/iskry.js/kolowrot.js), a addytywne
 * mieszanie zjada szary dym do niewidzialności (ta sama pułapka co w
 * efekty.js:206-216 i nagłówku ogien.js). ZAPLON/WYBUCH przełączają na
 * 'lighter' z ciepłym tintem - to WŁAŚNIE JEST "dym zmienia zachowanie po
 * podpaleniu", bez dodatkowego kosztu.
 *
 * Ciepły tint ZAPLON jest WSTĘPNIE WYPALONY w kilku stopniach (nie liczony
 * co klatkę) - assety.js:wypalTintowany cache'uje po `barwa`, a ciągle
 * zmieniająca się barwa (np. interpolowana klatka po klatce) rozsadziłaby
 * ten cache w nieograniczony Map.
 */
import { MANIFEST, obraz, wypalTintowany } from './assety.js';

// --- Emisja i sufit bezpieczeństwa ---
export const NA_SEKUNDE = 1.3;         // kłębów/s przy pełnej sile - kłęby żyją długo, nie trzeba ich dużo
export const MAX_KLEBOW = 180;         // "sufit wypycha najstarsze" - patrz _dodaj()

// --- Życie kłębu: rząd wielkości zegara potencjału (~4 min), NIE 50-70 s ---
export const ZYCIE_MIN_S = 200, ZYCIE_MAX_S = 260;
// Zanik alfy zaczyna się dopiero w OSTATNIEJ ĆWIARTCE życia - kłąb ma trwać
// pełną jasnością prawie do końca, nie dogasać od razu.
export const ZANIK_OD = 0.75;

// --- Wznoszenie, słabnące blisko sufitu (patrz nagłówek "ZMIANA FIZYKI") ---
// Wyrażone jako UŁAMEK WYSOKOŚCI EKRANU na sekundę, nie px - ten sam powód
// co efekty.js (mglaIMrok): efekt ma wyglądać tak samo niezależnie od
// rozdzielczości płótna.
const WZNOSZENIE_H_S = 0.045;        // pełna prędkość wznoszenia (ułamek H / s)
export const SUFIT_Y_H = 0.12;              // górna granica - tu wznoszenie prawie zanika
export const SPADEK_OD_Y_H = 0.55;          // poniżej tego Y (w dół ekranu) pełne wznoszenie
const SUFIT_MIN_CZYNNIK = 0.12;      // wznoszenie NIGDY nie spada do zera - lekkie mrowienie zostaje
const ROZLEW_BOK_H_S = 0.020;        // dodatkowy dryf w bok, rosnący blisko sufitu - "rozlewa się"

// --- Turbulencja i wzrost ---
const TURBULENCJA_W_S2 = 0.010;      // ułamek W/s^2 bocznego chwiania
const ROZMIAR_START_W = 0.018;       // promień startowy, ułamek W
const ROZMIAR_KONIEC_W = 0.075;      // promień docelowy (dojrzały kłąb), ułamek W
const ROZROST_DO_P = 0.5;            // kłąb dorasta do pełnego rozmiaru w połowie życia, potem plateau

// --- Rozgarnianie dłońmi ---
const ROZGARNIJ_PROMIEN_W = 0.13;    // zasięg wpływu dłoni, ułamek W
const ROZGARNIJ_SILA = 0.55;         // ile prędkości dłoni przejmuje kłąb w zasięgu

// --- Zapłon i front ognia ---
const ZAPLON_KONTAKT_MNOZNIK = 1.5;  // promień kontaktu z zarzewiem = kłąb.r * to + zarzewie.r - hojny, nie pikselowy
const FRONT_PROMIEN_MNOZNIK = 1.5;   // promień zarażania sąsiadów = (r1+r2) * to
export const OPOZNIENIE_FRONTU_S = 0.09;    // ile czeka podpalony kłąb, zanim zarazi sąsiadów
export const CZAS_DO_WYBUCHU_S = 0.35;      // ile płonie (ZAPLON), zanim przejdzie w WYBUCH
export const CZAS_WYBUCHU_S = 0.4;          // jak długo trwa sama kula ognia (WYBUCH), potem kłąb znika

// --- Barwy ---
const BARWA_DYMU = [205, 205, 212];              // jasna, chłodna szarość - source-over
// Stopnie ciepłego tintu ZAPLONU - WSTĘPNIE WYPALONE (patrz nagłówek pliku),
// od szarości przez pomarańcz do czerwieni, snapowane do najbliższego indeksu
// wg postępu p = tZaplonu / CZAS_DO_WYBUCHU_S.
const BARWA_ZAPLONU_STOPNIE = [
    [205, 205, 212],
    [255, 210, 150],
    [255, 160, 70],
    [255, 100, 30],
    [220, 40, 10]
];
const BARWA_RDZENIA = [255, 238, 200];
const BARWA_ROZBLYSKU = [255, 225, 170];

export class Dym {
    constructor() {
        this._kleby = [];
        this._nadwyzka = 0;   // ułamki kłębów przeniesione na następną klatkę (jak ogien.js)
    }

    get liczba() { return this._kleby.length; }
    get plonacych() { return this._kleby.filter(c => c.stan === 'ZAPLON').length; }

    /**
     * Ciągła emisja z ust - wywoływać co klatkę, TYLKO gdy dmuchanie.stan
     * === 'DMUCHA'. Ułamkowe przeniesienie nadwyżki jak ogien.js:_emituj -
     * inaczej przy niskim NA_SEKUNDE x sila kłęby wychodziłyby skokowo.
     *
     * @param {{x,y}} zaczepPx  usta, w PIKSELACH płótna
     * @param {{x,y}} kierunek  jednostkowy, OD dłoni w stronę ust i dalej
     * @param {number} sila     0..1 - grubość strumienia
     * @param {number} dt
     * @param {number} W  szerokość płótna (px) - do rozmiaru startowego
     */
    emituj(zaczepPx, kierunek, sila, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (!zaczepPx || !Number.isFinite(zaczepPx.x) || !Number.isFinite(zaczepPx.y) || s <= 0.01 || krok <= 0) return;

        const kx = Number.isFinite(kierunek?.x) ? kierunek.x : 0;
        const ky = Number.isFinite(kierunek?.y) ? kierunek.y : -1;

        const ile = NA_SEKUNDE * s * krok + this._nadwyzka;
        const n = Math.floor(ile);
        this._nadwyzka = ile - n;

        // Rozmiar startowy (c.r) NIE jest liczony tutaj - emituj() nie
        // dostaje szerokości płótna. _ruszaj() przelicza c.r z ułamka
        // wzrostu x ROZMIAR_*_W x W dopiero przy pierwszym tick'u (r: 1
        // niżej to tylko wartość tymczasowa na czas między emituj() a
        // najbliższym updateAndDraw() w tej samej klatce).
        for (let i = 0; i < n; i++) {
            const roznica = (Math.random() - 0.5) * 0.5;   // lekki rozrzut kierunku
            const predkoscPoczatkowa = 40 + Math.random() * 40;   // px/s - impuls "wydechu"
            this._dodaj({
                x: zaczepPx.x + (Math.random() - 0.5) * 10,
                y: zaczepPx.y + (Math.random() - 0.5) * 10,
                vx: (kx + roznica) * predkoscPoczatkowa,
                vy: (ky + roznica) * predkoscPoczatkowa,
                wiek: 0,
                zycie: ZYCIE_MIN_S + Math.random() * (ZYCIE_MAX_S - ZYCIE_MIN_S),
                faza: Math.random() * Math.PI * 2,
                obrot: Math.random() * Math.PI * 2,
                wobrot: (Math.random() - 0.5) * 0.15,
                r: 1,   // przeliczane w _ruszaj() z ułamka wzrostu i W
                stan: 'DYM',
                tZaplonu: 0,
                tWybuch: 0,
                rozprzestrzenil: false,
                wariantMgla: losowyIndeks(MANIFEST.mgla),
                wariantPlomien: losowyIndeks(MANIFEST.plomien),
                wariantOgien: losowyIndeks(MANIFEST.ogienRdzen),
                wariantRozblysk: losowyIndeks(MANIFEST.rozblyskUderzenia)
            });
        }
    }

    _dodaj(cz) {
        this._kleby.push(cz);
        // Sufit wypycha NAJSTARSZE - kolejność wstawiania jest kolejnością
        // wieku (nic nie przestawia tablicy poza tym), więc shift() z przodu
        // usuwa faktycznie najdłużej żyjące kłęby.
        while (this._kleby.length > MAX_KLEBOW) this._kleby.shift();
    }

    /**
     * Dłonie rozgarniają dym - nadgarstki z prędkością, w PIKSELACH.
     * @param {Array<{x,y,vx,vy}>} nadgarstkiPx
     * @param {number} W  szerokość płótna (px) - promień wpływu jest jej ułamkiem
     */
    rozgarnij(nadgarstkiPx, W) {
        if (!nadgarstkiPx?.length || !Number.isFinite(W) || W <= 0) return;
        const promien = W * ROZGARNIJ_PROMIEN_W;
        for (const c of this._kleby) {
            if (c.stan === 'WYBUCH') continue;
            for (const d of nadgarstkiPx) {
                if (!Number.isFinite(d?.x) || !Number.isFinite(d?.y)) continue;
                const dist = Math.hypot(c.x - d.x, c.y - d.y);
                if (dist >= promien) continue;
                const wplyw = (1 - dist / promien) * ROZGARNIJ_SILA;
                c.vx += (Number.isFinite(d.vx) ? d.vx : 0) * wplyw;
                c.vy += (Number.isFinite(d.vy) ? d.vy : 0) * wplyw;
            }
        }
    }

    /**
     * Podpal kłęby DYM w zasięgu zarzewi. Front (zarażanie sąsiadów) biegnie
     * w _ruszaj() - tu wyłącznie PIERWSZY kontakt z zewnętrznym źródłem ognia.
     *
     * @param {Array<{x,y,r,sila}>} zarzewiaPx  punkty ognia w PIKSELACH (dowolna technika ognia - main.js zbiera je co klatkę)
     */
    podpal(zarzewiaPx) {
        if (!zarzewiaPx?.length) return;
        for (const c of this._kleby) {
            if (c.stan !== 'DYM') continue;
            for (const z of zarzewiaPx) {
                if (!Number.isFinite(z?.x) || !Number.isFinite(z?.y)) continue;
                const promienKontaktu = c.r * ZAPLON_KONTAKT_MNOZNIK + (Number.isFinite(z.r) ? z.r : 0);
                if (Math.hypot(c.x - z.x, c.y - z.y) < promienKontaktu) {
                    c.stan = 'ZAPLON';
                    c.tZaplonu = 0;
                    c.rozprzestrzenil = false;
                    break;
                }
            }
        }
    }

    /**
     * Fizyka WSZYSTKICH kłębów - czysta (bez document), jak kolowrot.js
     * _ruszaj(). Zwraca, ile kłębów przeszło w WYBUCH W TEJ KLATCE - main.js
     * tym skaluje wstrząs ekranu i dźwięk.
     */
    _ruszaj(dt, W, H) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        if (krok <= 0) return 0;

        const wRef = Number.isFinite(W) && W > 0 ? W : 1920;
        const hRef = Number.isFinite(H) && H > 0 ? H : 1080;
        let nowychWybuchow = 0;

        const zywe = [];
        for (const c of this._kleby) {
            c.wiek += krok;

            if (c.stan === 'WYBUCH') {
                c.tWybuch += krok;
                if (c.tWybuch >= CZAS_WYBUCHU_S) continue;   // kłąb znika NA ZAWSZE
                zywe.push(c);
                continue;
            }

            if (c.wiek >= c.zycie) continue;   // DYM/ZAPLON gasną też z wieku (bezpiecznik)

            if (c.stan === 'ZAPLON') {
                c.tZaplonu += krok;
                if (!c.rozprzestrzenil && c.tZaplonu >= OPOZNIENIE_FRONTU_S) {
                    c.rozprzestrzenil = true;
                    for (const inny of this._kleby) {
                        if (inny === c || inny.stan !== 'DYM') continue;
                        const promien = (c.r + inny.r) * FRONT_PROMIEN_MNOZNIK;
                        if (Math.hypot(c.x - inny.x, c.y - inny.y) < promien) {
                            inny.stan = 'ZAPLON';
                            inny.tZaplonu = 0;
                            inny.rozprzestrzenil = false;
                        }
                    }
                }
                if (c.tZaplonu >= CZAS_DO_WYBUCHU_S) {
                    c.stan = 'WYBUCH';
                    c.tWybuch = 0;
                    nowychWybuchow++;
                }
            }

            // --- Wspólna fizyka ruchu DYM i ZAPLON (płonący kłąb dalej dryfuje) ---
            const wznoszeniePelne = wznoszenieCzynnik(c.y, hRef);
            const celVy = -WZNOSZENIE_H_S * hRef * wznoszeniePelne;
            // Miękkie dojście do docelowej prędkości pionowej - unika skoku,
            // gdy kłąb właśnie przekracza próg SPADEK_OD_Y_H.
            c.vy += (celVy - c.vy) * Math.min(1, krok * 2);

            const p = c.wiek / c.zycie;
            c.vx += Math.sin(c.faza + c.wiek * 0.7) * TURBULENCJA_W_S2 * wRef * krok;
            // Rozlew w bok rośnie blisko sufitu - "dym uderza o sufit i się rozlewa".
            c.vx += Math.sign(Math.sin(c.faza)) * ROZLEW_BOK_H_S * hRef * (1 - wznoszeniePelne) * krok;

            const opor = 1 - 0.6 * krok;
            c.vx *= opor;
            c.x += c.vx * krok;
            c.y += c.vy * krok;

            c.obrot += c.wobrot * krok;

            const wzrost = Math.min(1, p / ROZROST_DO_P);
            c.r = wRef * (ROZMIAR_START_W + (ROZMIAR_KONIEC_W - ROZMIAR_START_W) * wzrost);

            if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)) zywe.push(c);
        }
        this._kleby = zywe;
        return nowychWybuchow;
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx  null = tylko fizyka (testy, jak kolowrot.js)
     * @param {number} W  szerokość płótna (px)
     * @param {number} H  wysokość płótna (px)
     * @param {number} dt
     * @returns {number} liczba kłębów, które w tej klatce weszły w WYBUCH
     */
    updateAndDraw(ctx, W, H, dt) {
        const nowychWybuchow = this._ruszaj(dt, W, H);
        if (ctx) this._rysuj(ctx);
        return nowychWybuchow;
    }

    _rysuj(ctx) {
        if (!this._kleby.length) return;
        ctx.save();

        // --- DYM: source-over, INACZEJ NIŻ CAŁA RESZTA GRY (patrz nagłówek) ---
        ctx.globalCompositeOperation = 'source-over';
        for (const c of this._kleby) {
            if (c.stan !== 'DYM') continue;
            const img = obraz(MANIFEST.mgla[c.wariantMgla]);
            if (!img) continue;
            const alfa = obwiedniaAlfy(c.wiek / c.zycie) * 0.5;
            if (alfa <= 0.01) continue;
            const sprite = wypalTintowany(img, BARWA_DYMU, 220);
            ctx.globalAlpha = alfa;
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.obrot);
            ctx.drawImage(sprite, -c.r, -c.r, c.r * 2, c.r * 2);
            ctx.restore();
        }

        // --- ZAPLON i WYBUCH: 'lighter', ciepłe - dym "zmienia zachowanie" ---
        ctx.globalCompositeOperation = 'lighter';
        for (const c of this._kleby) {
            if (c.stan === 'ZAPLON') {
                const img = obraz(MANIFEST.mgla[c.wariantMgla]);
                if (!img) continue;
                const p = Math.max(0, Math.min(1, c.tZaplonu / CZAS_DO_WYBUCHU_S));
                const idx = Math.min(BARWA_ZAPLONU_STOPNIE.length - 1,
                                      Math.floor(p * BARWA_ZAPLONU_STOPNIE.length));
                const sprite = wypalTintowany(img, BARWA_ZAPLONU_STOPNIE[idx], 220);
                ctx.globalAlpha = Math.max(0.2, 1 - p * 0.3);
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.obrot);
                const r = c.r * (1 + p * 0.3);   // lekko pęcznieje przed wybuchem
                ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
                ctx.restore();
            } else if (c.stan === 'WYBUCH') {
                const p = Math.max(0, Math.min(1, c.tWybuch / CZAS_WYBUCHU_S));
                const zanik = 1 - p;
                const rdzen = obraz(MANIFEST.ogienRdzen[c.wariantOgien]);
                const plomien = obraz(MANIFEST.plomien[c.wariantPlomien]);
                const rozblysk = obraz(MANIFEST.rozblyskUderzenia[c.wariantRozblysk]);
                // Kula rośnie SZYBKO na starcie, potem gaśnie - narost/wygaszanie
                // tym samym wzorcem co reszta gry (sin narostu x kwadrat zaniku).
                const skala = 0.6 + 0.8 * Math.min(1, p * 4);
                const r = c.r * (1.4 + 0.6 * skala);

                if (rozblysk && p < 0.35) {
                    const sprite = wypalTintowany(rozblysk, BARWA_ROZBLYSKU, 320);
                    ctx.globalAlpha = Math.max(0, (1 - p / 0.35)) * 0.9;
                    ctx.drawImage(sprite, c.x - r * 1.3, c.y - r * 1.3, r * 2.6, r * 2.6);
                }
                if (plomien) {
                    const sprite = wypalTintowany(plomien, BARWA_ZAPLONU_STOPNIE[3], 220);
                    ctx.globalAlpha = Math.max(0, zanik * zanik);
                    ctx.drawImage(sprite, c.x - r, c.y - r, r * 2, r * 2);
                }
                if (rdzen) {
                    const sprite = wypalTintowany(rdzen, BARWA_RDZENIA, 160);
                    ctx.globalAlpha = Math.max(0, zanik);
                    const rr = r * 0.6;
                    ctx.drawImage(sprite, c.x - rr, c.y - rr, rr * 2, rr * 2);
                }
            }
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

/**
 * Czynnik wznoszenia 0..SUFIT_MIN_CZYNNIK..1 wg pozycji Y (px). 1 daleko od
 * sufitu (pełne wznoszenie), opada do SUFIT_MIN_CZYNNIK blisko górnej
 * krawędzi - NIGDY do zera, żeby kłęby pod sufitem dalej lekko "mrowiły",
 * zamiast zamarznąć w miejscu.
 */
export function wznoszenieCzynnik(y, H) {
    const sufit = H * SUFIT_Y_H, start = H * SPADEK_OD_Y_H;
    if (y >= start) return 1;
    if (y <= sufit) return SUFIT_MIN_CZYNNIK;
    const t = (y - sufit) / (start - sufit);
    return SUFIT_MIN_CZYNNIK + (1 - SUFIT_MIN_CZYNNIK) * t;
}

/**
 * Obwiednia alfy: narost na starcie (jak wszędzie w grze - unika skokowego
 * pojawienia się), pełna jasność aż do ZANIK_OD, potem opada do zera na
 * końcu życia. Zanik BLISKO KOŃCA, nie od połowy - patrz nagłówek pliku.
 */
export function obwiedniaAlfy(p) {
    const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 1;
    const narost = Math.sin(Math.min(1, t * 8) * Math.PI * 0.5);
    const zanik = t > ZANIK_OD ? Math.max(0, 1 - (t - ZANIK_OD) / (1 - ZANIK_OD)) : 1;
    return narost * zanik;
}

function losowyIndeks(tablica) {
    return Array.isArray(tablica) && tablica.length ? Math.floor(Math.random() * tablica.length) : 0;
}
