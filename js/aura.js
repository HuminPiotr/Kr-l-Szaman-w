/**
 * Aura tancerza - świetlista otoczka obrysowująca sylwetkę.
 *
 * Bierze maskę segmentacji z MediaPipe, barwi ją, rozmywa i dokłada do obrazu
 * przez 'lighter'. Nie jest ozdobnikiem: to jedyny sposób, w jaki gracz widzi
 * swoją moc, nie patrząc na pasek.
 *
 * CO KODUJE:
 *   moc      -> ILE:  zasięg poświaty, jasność, nasycenie
 *   płynność -> JAK:  barwa i spokój tętna
 *
 * To rozdzielenie jest sednem efektu. Gracz widzi różnicę między "mam dużo
 * mocy" a "płynę", zanim ktokolwiek mu to wytłumaczy.
 *
 * Wszystko idzie przez wygładzanie, a tętno ma okres liczony w sekundach.
 * To ma wprowadzać w trans, nie migotać.
 */

// Barwy w HSL. Płynny ruch -> ciepły bursztyn (ognisko), szarpany -> zimniejszy
// i bardziej sinawy. Przejście jest ciągłe, więc nie ma momentu "przełączenia".
const BARWA_PLYNNA = { h: 35, s: 95 };   // bursztyn / żar
const BARWA_SZARPANA = { h: 265, s: 70 }; // chłodny fiolet

const OKRES_TETNA_S = 3.6;      // oddech, nie stroboskop
const GLEBIA_TETNA = 0.13;      // jak mocno tętno zmienia jasność

const TAU_WYGLADZANIA = 0.5;    // s - wszystkie wielkości sterujące

// IMPULS WYŁADOWANIA. Bez niego każda pieczęć PRZYGASZAŁABY aurę o swój
// koszt - czyli zabierała dokładnie to, co taniec zarobił, a wielokrotne
// rzucanie dawałoby coraz ciemniejszego szamana. Aura jest deklarowaną
// nagrodą całej gry (GEMINI.md:7, 37), więc odwracamy odczyt: wydatek ma
// wyglądać jak WYŁADOWANIE, po którym aura wraca, nie jak strata.
//
// Stała musi być KRÓTSZA niż odbudowa mocy tańcem (~8 s), inaczej impuls
// przestaje się czytać jako impuls i zlewa się z ładowaniem.
const TAU_IMPULSU = 0.45;

// Trzy przebiegi. Rozmycie samo w sobie wypuszcza poświatę poza obrys ciała,
// więc nie trzeba rysować maski powiększonej.
//
// wytnijWnetrze: po rozmyciu wycinamy OSTRĄ sylwetkę, więc zostaje sama
// krawędź. Bez tego wnętrze ciała wypala się do bieli i zamiast aury wychodzi
// świecąca kukła - sprawdzone, wyglądało jak żarówka.
const PRZEBIEGI = [
    { rozmycie: 34, alfa: 0.30, wytnijWnetrze: false }, // daleka, ledwo widoczna otoczka
    { rozmycie: 14, alfa: 0.34, wytnijWnetrze: true  }, // miękki halo tuż przy ciele
    { rozmycie: 4,  alfa: 0.30, wytnijWnetrze: true  }  // wąski, wyraźny obrys
];

// Wnętrze sylwetki tylko lekko rozświetlone - ciało ma prześwitywać,
// a nie znikać pod poświatą.
const ALFA_WNETRZA = 0.13;

// Stała czasowa zaniku śladu - przy TAU=0.5 s ślad dogasa do ~5% po 1.5 s
// (3 tau), zgodnie ze spec ("dogasające po ~1,5 s"). ZGADNIĘTE - D.
const TAU_SLADU = 0.5;

// Nasycenie tęczy - dobrane do żywości istniejących barw (70-95).
// ZGADNIĘTE - potwierdzić z nakładki (D).
const TECZA_NASYCENIE = 88;

/**
 * Barwa aury: normalnie interpoluje bursztyn<->fiolet po płynności ruchu.
 * Gdy `tecza.aktywna`, PRZYKRYWA to i idzie z tecza.barwaHue - to jest
 * warstwa nagrody z docs/superpowers/specs/2026-08-12-splot-i-tecza-design.md.
 *
 * Wydzielona jako czysta funkcja (nie metoda klasy) - żeby dało się ją
 * przetestować bez document (updateAndDraw() tworzy płótna, których nie
 * ma w Node), tym samym wzorcem co rzutPerspektywiczny w fala.js.
 */
export function barwaAury(plynnosc, tecza) {
    if (tecza && tecza.aktywna) {
        return { h: tecza.barwaHue, s: TECZA_NASYCENIE };
    }
    const t = Math.max(0, Math.min(1, Number.isFinite(plynnosc) ? plynnosc : 1));
    return {
        h: BARWA_SZARPANA.h + (BARWA_PLYNNA.h - BARWA_SZARPANA.h) * t,
        s: BARWA_SZARPANA.s + (BARWA_PLYNNA.s - BARWA_SZARPANA.s) * t
    };
}

export class Aura {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        this._maska = null;     // płótno w rozdzielczości maski
        this._maskaCtx = null;
        this._praca = null;     // płótno robocze do rozmycia
        this._pracaCtx = null;
        this._slad = null;      // bufor akumulacyjny tęczowego śladu
        this._sladCtx = null;

        this._moc = 0;
        this._impuls = 0;
        this._plynnosc = 1;
        this._faza = 0;
    }

    /** Pieczęć się złożyła - aura wylewa się w efekt i wraca. */
    rozblysk(sila = 1) {
        const s = Number.isFinite(sila) ? Math.max(0, sila) : 0;
        this._impuls = Math.min(1, this._impuls + s);
    }

    /**
     * @param {Uint8Array|null} maska  alfa sylwetki 0..255 z segmentationMasks
     * @param {number} szer  szerokość maski
     * @param {number} wys   wysokość maski
     * @param {number} moc       0..1
     * @param {number} plynnosc  0..1
     * @param {object} fit   z computeCoverFit() - TA SAMA transformacja co wideo
     * @param {number} dt
     */
    updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt, tecza = null) {
        // Wygładzanie sterowania. Bez tego aura drga razem z trackingiem.
        const a = Math.min(1, dt / TAU_WYGLADZANIA);
        this._moc += a * ((Number.isFinite(moc) ? moc : 0) - this._moc);
        this._plynnosc += a * ((Number.isFinite(plynnosc) ? plynnosc : 1) - this._plynnosc);

        this._faza = (this._faza + dt / OKRES_TETNA_S) % 1;

        // Rozpad MUSI być przed wczesnym powrotem niżej - inaczej impuls
        // zamarza, gdy maski chwilowo nie ma, i wraca jako przebłysk.
        this._impuls *= Math.max(0, 1 - dt / TAU_IMPULSU);
        if (!Number.isFinite(this._impuls)) this._impuls = 0;

        // Jasnością steruje moc POWIĘKSZONA o impuls, nie moc surowa.
        //
        // BEZ CLAMPU DO 1, i to jest celowe. Przy pełnym pasku _moc ≈ 1, więc
        // Math.min(1, ...) zjadałby CAŁY impuls: pieczęć rzucona z pełnej mocy
        // dawałaby zmianę jasności o 0.2%, a potem zejście do 0.9. Dokładnie ta
        // inwersja, przed którą broni impuls - i to w najczęstszym momencie
        // rzucania, bo HUD wprost zaprasza wtedy do układania pieczęci.
        //
        // Sprawdzone przy skrajnej wartości 2.0: jasność HSL 76% (poprawna),
        // mnożnik rozmycia 1.55 (szersza poświata - o to chodzi), globalAlpha
        // 0.77 i 0.29 (obie pod 1 i tak już clampowane niżej). Nic nie przepełnia.
        const mocEfektywna = this._moc + this._impuls;

        if (!maska || !szer || !wys || mocEfektywna < 0.01) return;

        this._przygotujPlotna(szer, wys);
        this._wypelnijMaske(maska, szer, wys);

        // Tętno: płynny ruch oddycha spokojnie, szarpany drży szybciej i nierówno.
        const drzenie = 1 - this._plynnosc;
        const tetnoWolne = Math.sin(this._faza * Math.PI * 2);
        const tetnoSzybkie = Math.sin(this._faza * Math.PI * 2 * 5.5);
        const tetno = 1 + GLEBIA_TETNA * (tetnoWolne * this._plynnosc + tetnoSzybkie * drzenie);

        const { h, s } = barwaAury(this._plynnosc, tecza);
        const ctx = this.ctx;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const jasnosc = 40 + mocEfektywna * 18;
        const kolor = `hsl(${h}, ${s}%, ${jasnosc}%)`;
        const pc = this._pracaCtx;
        const pw = this._praca.width, ph = this._praca.height;

        // --- Bufor śladu: przygasza się ZAWSZE (nawet po wygaśnięciu tęczy,
        // żeby stary ślad dogasł, a nie zamarzł), dopisuje nową sylwetkę
        // TYLKO gdy tecza aktywna. Koszt stały: jeden fillRect na przygaszenie
        // plus jeden drawImage+fillRect na dopisanie - ZERO dodatkowych
        // przebiegów rozmycia ponad te trzy z PRZEBIEGI, bo blur niżej i tak
        // już się wykonywał; zmienia się tylko to, JAKIE płótno rozmywa.
        const zanik = 1 - Math.exp(-dt / TAU_SLADU);
        this._sladCtx.globalCompositeOperation = 'destination-out';
        this._sladCtx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, zanik)).toFixed(3)})`;
        this._sladCtx.fillRect(0, 0, pw, ph);
        this._sladCtx.globalCompositeOperation = 'source-over';

        if (tecza && tecza.aktywna) {
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.drawImage(this._maska, 0, 0);
            pc.globalCompositeOperation = 'source-in';
            pc.fillStyle = `hsla(${tecza.barwaHue}, ${TECZA_NASYCENIE}%, 55%, ${Math.max(0, Math.min(1, tecza.silaSladu))})`;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';
            this._sladCtx.drawImage(this._praca, 0, 0);
        }

        const zrodloRozmycia = (tecza && tecza.silaSladu > 0.001) ? this._slad : this._maska;

        for (const p of PRZEBIEGI) {
            // Rozmycie robimy na MAŁYM płótnie - jest wtedy tanie, a późniejsze
            // przeskalowanie na pełny ekran dogładza wynik za darmo.
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.filter = `blur(${(p.rozmycie * (0.45 + mocEfektywna * 0.55)).toFixed(1)}px)`;
            pc.drawImage(zrodloRozmycia, 0, 0);
            pc.filter = 'none';

            // Wycięcie ostrej sylwetki zostawia samą krawędź - to ona daje
            // wrażenie AURY, a nie świecącego ciała.
            if (p.wytnijWnetrze) {
                pc.globalCompositeOperation = 'destination-out';
                pc.drawImage(this._maska, 0, 0);
            }

            // Barwienie MUSI się odbyć tutaj, na płótnie pomocniczym, gdzie
            // kanał alfa niesie kształt sylwetki. Próba tintowania wprost na
            // płótnie głównym przez 'source-atop' zalewała CAŁY ekran, bo tło
            // gry jest w pełni nieprzezroczyste i "atop" trafiało wszędzie.
            //
            // Tylko gdy źródłem jest surowa maska - _slad już niesie kolor
            // per piksel (dopisaliśmy go wyżej), więc kolorowanie płaskim
            // `kolor` nadpisałoby tęczowy gradient jednym odcieniem.
            if (zrodloRozmycia === this._maska) {
                pc.globalCompositeOperation = 'source-in';
                pc.fillStyle = kolor;
                pc.fillRect(0, 0, pw, ph);
                pc.globalCompositeOperation = 'source-over';
            }

            // TA SAMA transformacja co wideo (computeCoverFit). Rysowanie maski
            // przez zwykłe drawImage(0, 0, canvas.width, canvas.height)
            // rozciągnęłoby ją na całe płótno i aura usiadłaby OBOK ciała -
            // subtelnie przy 16:9, fatalnie przy każdym innym kształcie okna.
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alfa * mocEfektywna * tetno));
            ctx.drawImage(this._praca, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
        }

        // Delikatne rozświetlenie samego ciała - ma prześwitywać, nie znikać.
        pc.globalCompositeOperation = 'source-over';
        pc.clearRect(0, 0, pw, ph);
        pc.filter = 'blur(2px)';
        pc.drawImage(this._maska, 0, 0);
        pc.filter = 'none';
        pc.globalCompositeOperation = 'source-in';
        pc.fillStyle = kolor;
        pc.fillRect(0, 0, pw, ph);
        pc.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.max(0, Math.min(1, ALFA_WNETRZA * mocEfektywna * tetno));
        ctx.drawImage(this._praca, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);

        ctx.globalAlpha = 1;

        ctx.restore();
    }

    _przygotujPlotna(szer, wys) {
        if (!this._maska) {
            this._maska = document.createElement('canvas');
            this._maskaCtx = this._maska.getContext('2d');
            this._praca = document.createElement('canvas');
            this._pracaCtx = this._praca.getContext('2d');
            this._slad = document.createElement('canvas');
            this._sladCtx = this._slad.getContext('2d');
        }
        if (this._maska.width !== szer || this._maska.height !== wys) {
            this._maska.width = this._praca.width = this._slad.width = szer;
            this._maska.height = this._praca.height = this._slad.height = wys;
            this._obraz = this._maskaCtx.createImageData(szer, wys);
        }
    }

    /** Maska ma jeden kanał (pewność 0..255); przenosimy ją w kanał alfa. */
    _wypelnijMaske(maska, szer, wys) {
        const d = this._obraz.data;
        const n = szer * wys;
        for (let i = 0; i < n; i++) {
            const v = maska[i];
            const j = i * 4;
            d[j] = 255; d[j + 1] = 255; d[j + 2] = 255;
            d[j + 3] = v;
        }
        this._maskaCtx.putImageData(this._obraz, 0, 0);
    }
}
