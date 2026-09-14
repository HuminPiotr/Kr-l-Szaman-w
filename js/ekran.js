/**
 * Odpowiedź ekranu - wstrząs, winieta, bramkowany bloom przy uderzeniu.
 *
 * Wszystkie efekty w grze dotąd działy się NA płótnie, obok tancerza; ekran
 * sam nigdy nie reagował. Ta warstwa daje "soczystość" (game feel), która
 * w VFX gier bierze się w dużej mierze właśnie stąd, nie z liczby cząstek -
 * patrz docs/superpowers/plans (research "skąd czerpać efekty").
 *
 * JEDNORAZOWY IMPULS jak fala.js/iskry.js/zaplon.js: uderz() startuje
 * obwiednię czasu (CZAS_TRWANIA), reszta metod ją czyta.
 *
 * ====================== WSTRZĄS: translate(), NIE CSS ======================
 * Płótno ma `style.css transform: scaleX(-1)` (lustro). Wstrząs dołożony
 * jako transformacja CSS na elemencie odwróciłby kierunek przesunięcia
 * w osi X i biłby się z lustrem - stąd przesun()/dokoncz() opakowują
 * WYŁĄCZNIE rysowanie wewnątrz ctx (ctx.translate + ctx.scale), NIGDY
 * styl elementu <canvas>. Wywołujący (main.js) musi:
 *   1. wyczyścić i narysować wideo w układzie NIEPRZESUNIĘTYM,
 *   2. ctx.save(); ekran.przesun(ctx); - dopiero PO tym rysować resztę,
 *   3. ctx.restore(); ekran.dokoncz(ctx, W, H, dt); - winieta/bloom w
 *      układzie NIEPRZESUNIĘTYM, żeby nie drgały razem z wstrząsem.
 *
 * ====================== BLOOM: BRAMKOWANY, NIE CIĄGŁY ======================
 * aura.js może sobie pozwolić na filter:blur() co klatkę, bo blurruje
 * płótno W ROZDZIELCZOŚCI MASKI (tanie - poseTracker.js:14). Pełnoekranowy
 * blur to inny koszt na tym samym budżecie 33 ms. dokoncz() dlatego liczy
 * bloom TYLKO gdy sila > 0 (czyli przez ~CZAS_TRWANIA po uderzeniu), nie
 * na każdej klatce gry - koszt tylko w chwili efektu, i jako efekt uboczny
 * DRAMATURGIA: świat rozjarza się przy uderzeniu i wraca do normy.
 *
 * ====================== FALA POWIETRZA: REFRAKCJA, NIE CZĄSTKI ======================
 * Sygnatura Aarda z Wiedźmina 3 to ZAGIĘCIE POWIETRZA - soczewka lecąca
 * od dłoni, przez którą świat za nią się wybrzusza - a nie jaśniejsze
 * cząstki. fala.js daje cząstki i (od Aarda v2) kreskę czoła; ta warstwa
 * daje samo zagięcie. Mechanika w canvas 2D bez odczytu pikseli: kopia
 * prostokąta sceny pod czołem na płótno pomocnicze, potem narysowana
 * Z POWROTEM przeskalowana o kilka procent WOKÓŁ ŚRODKA CZOŁA, przycięta
 * do pierścienia (clip evenodd: zewnętrzna krawędź czoła minus wewnętrzna).
 * Wewnątrz pierścienia obraz jest więc "rozepchnięty" na zewnątrz - to
 * czyta się jak sprężone powietrze, bo tak właśnie wygląda soczewka
 * uderzeniowa w grach 3D (tam robi to shader zniekształcenia ekranu).
 *
 * GEOMETRIA CZOŁA NIE JEST TU LICZONA - pochodzi z fala.js (punktyCzola:
 * ten sam rzut perspektywiczny i ta sama kinematyka, co cząstki), więc
 * soczewka leży dokładnie na czole cząstek i nigdy się z nimi nie
 * rozjedzie po strojeniu stałych fali.
 *
 * Rysowane w dokoncz(), w układzie NIEPRZESUNIĘTYM (jak winieta/bloom) -
 * płótno pomocnicze kopiuje już-narysowaną scenę, więc musi widzieć
 * finalne piksele klatki. Bramkowane czasem jak bloom: koszt (jedna kopia
 * fragmentu płótna) tylko przez CZAS_FALI po wystrzale. Zegar fali jest
 * OSOBNY od zegara wstrząsu - main.js woła uderz() i falaPowietrza()
 * obok siebie przy wystrzale, ale wstrząs gaśnie w 0.45 s, a czoło
 * potrzebuje 0.6 s, żeby dolecieć do brzegu kadru.
 */

import { punktyCzola } from './fala.js';

// ZGADNIĘTE - wymaga potwierdzenia na żywym ciele (klawisz D), jak inne
// stałe wizualne w tym repo (OGNISKO w fala.js, CZAS_TRWANIA w zaplon.js).
const CZAS_TRWANIA = 0.45;      // s
const AMPLITUDA_PRZESUNIECIA = 0.015;  // ułamek szerokości płótna
const SKALA_ZAPASOWA = 1.03;    // >1, żeby przesunięcie nie odsłoniło krawędzi pod wideo
const ALFA_WINIETY = 0.55;
const PROMIEN_BLUR_BLOOM = 6;   // px, na pomniejszonej kopii (1/4 rozmiaru)
const DZIELNIK_BLOOM = 4;       // pomniejszenie płótna pomocniczego bloomu
const ALFA_BLOOM = 0.35;

// --- fala powietrza (refrakcja Aarda) ---
const CZAS_FALI = 0.6;          // s - dłużej niż wstrząs: czoło musi dolecieć do brzegu
const WYBRZUSZENIE = 0.07;      // maks. mnożnik skali kopii sceny - 1 (7 % "rozepchnięcia")
const GRUBOSC_OD = 0.45, GRUBOSC_DO = 0.18;  // ułamek promienia czoła: soczewka cienieje w locie
const PUNKTOW_CZOLA = 48;
const MARGINES_PX = 8;          // zapas wokół prostokąta kopii - skala rozpycha piksele poza obrys

/**
 * Obwiednia jednego wstrząsu: szybki narost, szybkie tłumione wygaszanie -
 * czysta funkcja, testowalna bez document (ten sam wzorzec co obwiednia()
 * w zaplon.js).
 *
 * @param {number} p  0..1 (t / CZAS_TRWANIA)
 * @returns {number} 0..1
 */
export function obwiedniaUderzenia(p) {
    const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 1;
    // Szybki narost (szczyt blisko startu), potem tłumione, oscylujące
    // wygaszanie - wstrząs ma "odbić" kilka razy, nie zgasnąć liniowo.
    return Math.exp(-t * 5.5) * Math.abs(Math.cos(t * Math.PI * 3.2));
}

/**
 * Obwiednia fali powietrza: MONOTONICZNE gaśnięcie, bez odbić - soczewka
 * ma wystrzelić i rozpłynąć się, nie drgać jak wstrząs. Potęga > 1, żeby
 * najsilniejsze zagięcie było w pierwszej chwili (moment uderzenia), a
 * długi ogon czytał się jako "powietrze się uspokaja".
 *
 * @param {number} p  0..1 (t / CZAS_FALI)
 * @returns {number} 0..1
 */
export function obwiedniaFali(p) {
    const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 1;
    return Math.pow(1 - t, 1.6);
}

export class Ekran {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;

        // Fala powietrza - null, gdy nic nie leci. Własny zegar (patrz nagłówek).
        this._fala = null;
        this._falaPlotno = null;
        this._falaCtx = null;

        // Ziarno losowe wstrząsu - JEDNO na całe uderzenie (przeliczane co
        // klatkę z fazą t, nie losowane co klatkę), inaczej przesunięcie
        // migotałoby losowo zamiast płynnie drgać.
        this._fazaX = Math.random() * Math.PI * 2;
        this._fazaY = Math.random() * Math.PI * 2;

        this._bloomPlotno = null;
        this._bloomCtx = null;
    }

    /** Siła bieżącego wstrząsu 0..1 - bramka dla bloomu w dokoncz(). */
    get sila() { return this._trwa ? this._sila * obwiedniaUderzenia(this._t / CZAS_TRWANIA) : 0; }

    /**
     * Uderzenie. Ponowne wywołanie w trakcie trwania RESTARTUJE obwiednię -
     * ten sam wzorzec co zaplon.js zapal() i tecza.aktywuj().
     *
     * @param {number} [sila]  0..1
     */
    uderz(sila = 1) {
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._fazaX = Math.random() * Math.PI * 2;
        this._fazaY = Math.random() * Math.PI * 2;
    }

    /** Czy soczewka Aarda jeszcze leci - bramka kosztu w dokoncz(). */
    get falaAktywna() { return this._fala !== null; }

    /**
     * Wystrzał fali powietrza - soczewka refrakcyjna od `zaczep` wzdłuż
     * `kierunek`. NIE uruchamia wstrząsu; main.js woła uderz() osobno -
     * to dwa zdarzenia o różnych zegarach (nagłówek). Ponowne wywołanie
     * w trakcie RESTARTUJE falę - ten sam wzorzec co uderz().
     *
     * Odporność jak fala.wystrzel(): zły zaczep/kierunek/siła -> cicho nic,
     * nigdy wyjątek (GEMINI.md §2).
     *
     * @param {{x,y}} zaczep      px płótna (ten sam punkt, co do fala.wystrzel)
     * @param {{x,y,z}} kierunek  wektor 3D
     * @param {number} sila       0..1
     */
    falaPowietrza(zaczep, kierunek, sila) {
        if (!zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;
        if (!kierunek || !(Math.hypot(kierunek.x, kierunek.y, kierunek.z) > 1e-6)) return;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01) return;
        this._fala = {
            t: 0,
            zaczep: { x: zaczep.x, y: zaczep.y },
            kierunek: { x: kierunek.x, y: kierunek.y, z: kierunek.z },
            sila: s
        };
    }

    /**
     * Wywołać PRZED rysowaniem sceny (po narysowaniu wideo w układzie
     * nieprzesuniętym - patrz nagłówek pliku). Musi być sparowane z
     * ctx.save() przed i ctx.restore() po całym bloku, który ma drgać.
     *
     * Guard na `!ctx` MUSI być pierwszy i przed jakimkolwiek użyciem ctx -
     * to jedyny powód, dla którego test-ekran.mjs może wywołać tę metodę
     * bez prawdziwego CanvasRenderingContext2D (którego nie ma w Node).
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} W  szerokość płótna w px
     * @param {number} H  wysokość płótna w px
     */
    przesun(ctx, W, H) {
        const s = this.sila;
        if (!ctx || s <= 0.001 || !Number.isFinite(W) || !Number.isFinite(H)) return;
        const p = this._t / CZAS_TRWANIA;
        const amp = W * AMPLITUDA_PRZESUNIECIA * s;
        const dx = Math.sin(p * Math.PI * 9 + this._fazaX) * amp;
        const dy = Math.sin(p * Math.PI * 11 + this._fazaY) * amp * 0.6;
        // Skala > 1 wokół środka, żeby przesunięcie nie odsłoniło krawędzi
        // pod wideo (płótno jest wypełnione cover-fit, nie ma zapasu poza brzegiem).
        const skala = 1 + (SKALA_ZAPASOWA - 1) * s;
        ctx.translate(W / 2, H / 2);
        ctx.scale(skala, skala);
        ctx.translate(-W / 2 + dx, -H / 2 + dy);
    }

    /**
     * Wywołać PO narysowaniu sceny, w układzie NIEPRZESUNIĘTYM (po
     * ctx.restore() od przesun()) - winieta i bloom nie mają drgać razem
     * z resztą, mają być stabilną ramką wokół drgającego wnętrza.
     *
     * Przesuwa też zegar tej samej obwiedni, co przesun() czyta - MUSI być
     * wołana raz na klatkę nawet gdy sila===0, inaczej zegar zamiera.
     * Doliczenie czasu zostaje PRZED guardem na `ctx`/`s`, żeby test-ekran.mjs
     * mógł napędzać zegar wołaniem z ctx=null, bez dotykania document -
     * ten sam wzorzec co zaplon.js updateAndDraw().
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} W
     * @param {number} H
     * @param {number} dt
     */
    dokoncz(ctx, W, H, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        if (this._trwa) {
            this._t += krok;
            if (this._t >= CZAS_TRWANIA) this._trwa = false;
        }
        if (this._fala) {
            this._fala.t += krok;
            if (this._fala.t >= CZAS_FALI) this._fala = null;
        }

        const wymiaryOk = Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0;

        // --- FALA POWIETRZA: PRZED winietą i bloomem - to zniekształcenie
        // sceny, a winieta/bloom mają leżeć na wierzchu wszystkiego. Własna
        // bramka (this._fala), niezależna od siły wstrząsu.
        if (ctx && wymiaryOk && this._fala) this._falaPowietrza(ctx, W, H);

        const s = this.sila;
        if (!ctx || s <= 0.001 || !wymiaryOk) return;

        // --- WINIETA: gradient radialny, ciemniejsze brzegi, siła uderzenia steruje alfą ---
        const g = ctx.createRadialGradient(
            W / 2, H / 2, Math.min(W, H) * 0.25,
            W / 2, H / 2, Math.max(W, H) * 0.75
        );
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${(ALFA_WINIETY * s).toFixed(3)})`);
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // --- BLOOM: BRAMKOWANY przez s>0, downscale -> blur -> upscale 'lighter' ---
        this._bloom(ctx, W, H, s);
    }

    _falaPowietrza(ctx, W, H) {
        const f = this._fala;
        const p = f.t / CZAS_FALI;
        const obw = obwiedniaFali(p);
        const wybrzuszenie = WYBRZUSZENIE * f.sila * obw;
        if (wybrzuszenie < 0.002) return;   // niewidoczne - nie płać za kopię płótna

        // Zewnętrzna i wewnętrzna krawędź czoła - z fala.js, żeby soczewka
        // leżała dokładnie na cząstkach (nagłówek). Grubość maleje w locie.
        const grubosc = GRUBOSC_OD + (GRUBOSC_DO - GRUBOSC_OD) * p;
        const zewn = punktyCzola(f.zaczep, f.kierunek, f.sila, f.t, PUNKTOW_CZOLA, 1);
        const wewn = punktyCzola(f.zaczep, f.kierunek, f.sila, f.t, PUNKTOW_CZOLA, 1 - grubosc);
        if (zewn.punkty.length < 3 || wewn.punkty.length < 3) return;

        // Prostokąt kopii: obrys zewnętrznej krawędzi, przycięty do płótna.
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of zewn.punkty) {
            if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x;
            if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
        }
        x0 = Math.max(0, Math.floor(x0 - MARGINES_PX)); y0 = Math.max(0, Math.floor(y0 - MARGINES_PX));
        x1 = Math.min(W, Math.ceil(x1 + MARGINES_PX));  y1 = Math.min(H, Math.ceil(y1 + MARGINES_PX));
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 2 || bh < 2) return;   // czoło całe poza kadrem

        if (!this._falaPlotno) {
            this._falaPlotno = document.createElement('canvas');
            this._falaCtx = this._falaPlotno.getContext('2d');
        }
        // Płótno pomocnicze rośnie do potrzeb, nigdy nie maleje - zmiana
        // rozmiaru kasuje bufor GPU, a fala co klatkę ma inny obrys.
        if (this._falaPlotno.width < bw || this._falaPlotno.height < bh) {
            this._falaPlotno.width = Math.max(this._falaPlotno.width, bw);
            this._falaPlotno.height = Math.max(this._falaPlotno.height, bh);
        }
        // Kopia sceny pod czołem. drawImage(ctx.canvas) na SAMYM SOBIE jest
        // formalnie dozwolone, ale rysowanie z płótna pomocniczego jest
        // przewidywalne w każdej przeglądarce - stąd dwa kroki, nie jeden.
        this._falaCtx.clearRect(0, 0, bw, bh);
        this._falaCtx.drawImage(ctx.canvas, x0, y0, bw, bh, 0, 0, bw, bh);

        const sc = zewn.srodek;
        const k = 1 + wybrzuszenie;
        ctx.save();
        // Pierścień: zewnętrzna krawędź minus wewnętrzna (evenodd).
        ctx.beginPath();
        ctx.moveTo(zewn.punkty[0].x, zewn.punkty[0].y);
        for (let i = 1; i < zewn.punkty.length; i++) ctx.lineTo(zewn.punkty[i].x, zewn.punkty[i].y);
        ctx.closePath();
        ctx.moveTo(wewn.punkty[0].x, wewn.punkty[0].y);
        for (let i = 1; i < wewn.punkty.length; i++) ctx.lineTo(wewn.punkty[i].x, wewn.punkty[i].y);
        ctx.closePath();
        ctx.clip('evenodd');
        // Kopia z powrotem, przeskalowana o k WOKÓŁ ŚRODKA CZOŁA: piksel
        // w odległości d od środka ląduje w d*k - obraz "rozpycha się".
        ctx.drawImage(this._falaPlotno, 0, 0, bw, bh,
                      sc.x + (x0 - sc.x) * k, sc.y + (y0 - sc.y) * k, bw * k, bh * k);
        ctx.restore();
    }

    _bloom(ctx, W, H, s) {
        const bw = Math.max(1, Math.round(W / DZIELNIK_BLOOM));
        const bh = Math.max(1, Math.round(H / DZIELNIK_BLOOM));
        if (!this._bloomPlotno) {
            this._bloomPlotno = document.createElement('canvas');
            this._bloomCtx = this._bloomPlotno.getContext('2d');
        }
        if (this._bloomPlotno.width !== bw || this._bloomPlotno.height !== bh) {
            this._bloomPlotno.width = bw;
            this._bloomPlotno.height = bh;
        }
        const bc = this._bloomCtx;
        bc.clearRect(0, 0, bw, bh);
        bc.drawImage(ctx.canvas, 0, 0, bw, bh);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, Math.min(1, ALFA_BLOOM * s));
        ctx.filter = `blur(${PROMIEN_BLUR_BLOOM}px)`;
        ctx.drawImage(this._bloomPlotno, 0, 0, bw, bh, 0, 0, W, H);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
