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

export class Aura {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        this._maska = null;     // płótno w rozdzielczości maski
        this._maskaCtx = null;
        this._praca = null;     // płótno robocze do rozmycia
        this._pracaCtx = null;

        this._moc = 0;
        this._plynnosc = 1;
        this._faza = 0;
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
    updateAndDraw(maska, szer, wys, moc, plynnosc, fit, dt) {
        // Wygładzanie sterowania. Bez tego aura drga razem z trackingiem.
        const a = Math.min(1, dt / TAU_WYGLADZANIA);
        this._moc += a * ((Number.isFinite(moc) ? moc : 0) - this._moc);
        this._plynnosc += a * ((Number.isFinite(plynnosc) ? plynnosc : 1) - this._plynnosc);

        this._faza = (this._faza + dt / OKRES_TETNA_S) % 1;

        if (!maska || !szer || !wys || this._moc < 0.01) return;

        this._przygotujPlotna(szer, wys);
        this._wypelnijMaske(maska, szer, wys);

        // Tętno: płynny ruch oddycha spokojnie, szarpany drży szybciej i nierówno.
        const drzenie = 1 - this._plynnosc;
        const tetnoWolne = Math.sin(this._faza * Math.PI * 2);
        const tetnoSzybkie = Math.sin(this._faza * Math.PI * 2 * 5.5);
        const tetno = 1 + GLEBIA_TETNA * (tetnoWolne * this._plynnosc + tetnoSzybkie * drzenie);

        const { h, s } = this._barwa();
        const ctx = this.ctx;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const jasnosc = 40 + this._moc * 18;
        const kolor = `hsl(${h}, ${s}%, ${jasnosc}%)`;
        const pc = this._pracaCtx;
        const pw = this._praca.width, ph = this._praca.height;

        for (const p of PRZEBIEGI) {
            // Rozmycie robimy na MAŁYM płótnie - jest wtedy tanie, a późniejsze
            // przeskalowanie na pełny ekran dogładza wynik za darmo.
            pc.globalCompositeOperation = 'source-over';
            pc.clearRect(0, 0, pw, ph);
            pc.filter = `blur(${(p.rozmycie * (0.45 + this._moc * 0.55)).toFixed(1)}px)`;
            pc.drawImage(this._maska, 0, 0);
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
            pc.globalCompositeOperation = 'source-in';
            pc.fillStyle = kolor;
            pc.fillRect(0, 0, pw, ph);
            pc.globalCompositeOperation = 'source-over';

            // TA SAMA transformacja co wideo (computeCoverFit). Rysowanie maski
            // przez zwykłe drawImage(0, 0, canvas.width, canvas.height)
            // rozciągnęłoby ją na całe płótno i aura usiadłaby OBOK ciała -
            // subtelnie przy 16:9, fatalnie przy każdym innym kształcie okna.
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alfa * this._moc * tetno));
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
        ctx.globalAlpha = Math.max(0, Math.min(1, ALFA_WNETRZA * this._moc * tetno));
        ctx.drawImage(this._praca, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);

        ctx.globalAlpha = 1;

        ctx.restore();
    }

    _barwa() {
        const t = Math.max(0, Math.min(1, this._plynnosc));
        return {
            h: BARWA_SZARPANA.h + (BARWA_PLYNNA.h - BARWA_SZARPANA.h) * t,
            s: BARWA_SZARPANA.s + (BARWA_PLYNNA.s - BARWA_SZARPANA.s) * t
        };
    }

    _przygotujPlotna(szer, wys) {
        if (!this._maska) {
            this._maska = document.createElement('canvas');
            this._maskaCtx = this._maska.getContext('2d');
            this._praca = document.createElement('canvas');
            this._pracaCtx = this._praca.getContext('2d');
        }
        if (this._maska.width !== szer || this._maska.height !== wys) {
            this._maska.width = this._praca.width = szer;
            this._maska.height = this._praca.height = wys;
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
