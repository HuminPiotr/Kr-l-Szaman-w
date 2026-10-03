/**
 * Kamienna Tarcza - nagroda za combo weles × 3 (proste combo 2026-10-02,
 * docs/superpowers/specs/2026-10-02-proste-kombosy-design.md). Pierwsza
 * technika z WŁASNĄ fakturą Welesa (dirt_* z paczki Kenney, CC0).
 *
 * Odłamki ziemi wylatują z barków na eliptyczną orbitę wokół tułowia, krążą
 * i na koniec opadają. Tylna połowa orbity (sin(kąt) < 0, "dalej od kamery")
 * rysuje się ZA sylwetką (js/warstwaZaSylwetka.js), przednia przed nią -
 * dzięki temu kamienie naprawdę OKRĄŻAJĄ ciało, nie wiszą przed nim.
 *
 * KUMULOWANIE (2026-10-02, po teście na kamerze): każde KOLEJNE odpalenie
 * (weles×3 złożone ponownie albo trzymana poza Welesa) DOKŁADA nowy krąg
 * kamieni, aż do MAKS_PIERSCIENI. Kręgi nie nachodzą na siebie, bo:
 *   - promienie różnią się o ODSTEP_PIERSCIENI >= największy kamień,
 *   - leżą na różnych wysokościach tułowia (PRZESUNIECIE_PIONOWE),
 *   - obracają się NAPRZEMIENNIE w przeciwne strony (jak dwa kręgi
 *     Kołowrotu - czyta się jak mechanizm) ze STAŁĄ prędkością liniową,
 *   - liczba kamieni rośnie z obwodem (równy odstęp łukowy).
 * Każde odpalenie przedłuża życie CAŁEJ tarczy do pełnego CZAS_TRWANIA
 * (opadanie jest wspólne, w ostatniej sekundzie). Odpalenie, gdy kamienie
 * już opadają, zaczyna tarczę od nowa - inaczej spadające kamienie
 * wskoczyłyby z powrotem na orbitę.
 *
 * Zaczep: środek barków co klatkę (js/sledzenie.js), NIE zamrożony w zapal()
 * jak w Kołowrocie - tarcza ma iść za tancerzem. Rozmiary to mnożniki skali
 * barków (wzorzec kolowrot.js).
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 6.0;   // s - od OSTATNIEGO odpalenia

export const NASTAWY = {
    LICZBA: 10,               // kamieni w pierwszym kręgu
    MAKS_PIERSCIENI: 4,       // kolejne odpalenia ponad to tylko przedłużają życie
    T_FORMOWANIA: 0.6,        // s - wylot z barków na orbitę (osobno dla każdego kręgu)
    T_OPADANIA: 5.0,          // s od odpalenia - w ostatniej sekundzie (CZAS_TRWANIA - to) kamienie spadają
    PROMIEN_MNOZNIK: 1.25,    // skala * to = promień pierwszego kręgu
    // >= ROZMIAR_DO: kamienie sąsiednich kręgów się nie stykają. Rozrzut
    // promienia kamienia (PROMIEN_ROZRZUT) jest celowo mały - przy dużym
    // sąsiednie kręgi i tak by się przecinały.
    ODSTEP_PIERSCIENI: 0.6,   // skala * to - różnica promieni sąsiednich kręgów
    PROMIEN_ROZRZUT: 0.05,    // +-5% promienia kręgu na kamień
    // Wysokość kręgu względem środka tułowia (skala * to): środek, pierś,
    // biodra, barki - elipsy nie leżą w jednej płaszczyźnie.
    PRZESUNIECIE_PIONOWE: [0, -0.45, 0.45, -0.9],
    WYSOKOSC_ROZRZUT: 0.3,    // kamień +-0.15 skali w pionie od linii kręgu
    SQUASH: 0.38,             // spłaszczenie elipsy - orbita pozioma, widziana lekko z góry
    OBNIZENIE_MNOZNIK: 0.6,   // środek orbity = barki + skala * to w dół (środek tułowia)
    PREDKOSC_KATOWA: 2.2,     // rad/s - na pierwszym kręgu; dalsze mają tę samą prędkość LINIOWĄ
    ROZMIAR_OD: 0.32, ROZMIAR_DO: 0.55,   // skala * to
    GRAWITACJA_MNOZNIK: 9,    // skala * to = px/s^2
    BARWA_KAMIENIA: [110, 90, 135],    // ciemny kamień z nutą fioletu Welesa
    BARWA_POSWIATY: [190, 100, 255]    // fiolet Welesa (techniki.js BARWA_GROMU)
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** Ile sekund przed końcem tarczy kamienie zaczynają opadać. */
const czasOpadu = () => CZAS_TRWANIA - NASTAWY.T_OPADANIA;

/**
 * Alfa kręgu - czysta funkcja.
 * @param {number} tOdStartu  s od dołożenia TEGO kręgu (narost)
 * @param {number} doKonca    s do końca całej tarczy (wygaszanie przy opadaniu)
 */
export function obwiednia(tOdStartu, doKonca) {
    if (!Number.isFinite(tOdStartu) || !Number.isFinite(doKonca) || tOdStartu <= 0 || doKonca <= 0) return 0;
    const narost = Math.min(1, tOdStartu / NASTAWY.T_FORMOWANIA);
    const opad = doKonca < czasOpadu() ? doKonca / czasOpadu() : 1;
    return narost * opad;
}

/**
 * Geometria kręgu o danym indeksie (0 = wewnętrzny) - czysta funkcja.
 * @returns {{promien:number, przesuniecie:number, omega:number, liczba:number}}
 *   promien w mnożnikach skali, omega w rad/s, liczba kamieni w kręgu
 */
export function geometriaKregu(indeks) {
    const N = NASTAWY;
    const i = Math.max(0, Math.min(N.MAKS_PIERSCIENI - 1, Math.floor(indeks) || 0));
    const promien = N.PROMIEN_MNOZNIK + i * N.ODSTEP_PIERSCIENI;
    return {
        promien,
        przesuniecie: N.PRZESUNIECIE_PIONOWE[i] ?? 0,
        omega: N.PREDKOSC_KATOWA * N.PROMIEN_MNOZNIK / promien,   // stała prędkość liniowa
        liczba: Math.round(N.LICZBA * promien / N.PROMIEN_MNOZNIK)
    };
}

/**
 * Położenie jednego odłamka - czysta funkcja.
 * @param {object} o  odłamek ({kat0, kierunek, promienWsp, wysokosc, obrot0, vObrot, opoznienieOpadu})
 * @param {number} tKregu  s od dołożenia kręgu - napędza wylot i kąt
 * @param {number} doKonca  s do końca tarczy - napędza opadanie
 * @param {{x,y}} srodek  środek barków w px
 * @param {number} skala  szerokość barków w px
 * @param {{promien, przesuniecie, omega}} krag  z geometriaKregu()
 * @returns {{x:number, y:number, przod:boolean, obrot:number}}
 */
export function pozycjaOdlamka(o, tKregu, doKonca, srodek, skala, krag) {
    const N = NASTAWY;
    const wylot = clamp01(tKregu / N.T_FORMOWANIA);
    const r = skala * krag.promien * (1 - Math.pow(1 - wylot, 3)) * o.promienWsp;
    const kat = o.kat0 + o.kierunek * krag.omega * tKregu;
    const tOpad = Math.max(0, czasOpadu() - doKonca - o.opoznienieOpadu);
    const spad = 0.5 * skala * N.GRAWITACJA_MNOZNIK * tOpad * tOpad;
    return {
        x: srodek.x + Math.cos(kat) * r,
        y: srodek.y + skala * (N.OBNIZENIE_MNOZNIK + krag.przesuniecie)
            + Math.sin(kat) * r * N.SQUASH + o.wysokosc * skala + spad,
        przod: Math.sin(kat) > 0,
        obrot: o.obrot0 + o.vObrot * tKregu
    };
}

export class KamiennaTarcza {
    constructor() {
        this._doKonca = 0;
        this._trwa = false;
        this._sila = 0;
        this._pierscienie = [];   // [{ indeks, t, kierunek, krag, odlamki }]
        this._kotwica = new Kotwica(12);
        this._warstwa = new WarstwaZaSylwetka();
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }
    get liczbaPierscieni() { return this._pierscienie.length; }
    get liczbaOdlamkow() { return this._pierscienie.reduce((s, p) => s + p.odlamki.length, 0); }

    wyczyscCache() { wyczyscCacheAssetow(); }

    /** Nowy krąg kamieni o indeksie `indeks`, obracający się przeciwnie do `poprzedniKierunek`. */
    _nowyPierscien(indeks, poprzedniKierunek) {
        const N = NASTAWY;
        const krag = geometriaKregu(indeks);
        // Pierwszy krąg w losową stronę, każdy kolejny przeciwnie - patrz nagłówek.
        const kierunek = poprzedniKierunek ? -poprzedniKierunek : (Math.random() < 0.5 ? -1 : 1);
        const odlamki = Array.from({ length: krag.liczba }, (_, i) => ({
            kat0: (i / krag.liczba) * Math.PI * 2 + (Math.random() - 0.5) * 0.4 * (N.LICZBA / krag.liczba),
            kierunek,
            promienWsp: 1 + (Math.random() * 2 - 1) * N.PROMIEN_ROZRZUT,
            wysokosc: (Math.random() - 0.5) * N.WYSOKOSC_ROZRZUT,
            rozmiar: N.ROZMIAR_OD + Math.random() * (N.ROZMIAR_DO - N.ROZMIAR_OD),
            obrot0: Math.random() * Math.PI * 2,
            vObrot: (Math.random() * 2 - 1) * 3,
            opoznienieOpadu: Math.random() * 0.4,
            wariant: Math.floor(Math.random() * MANIFEST.odlamek.length)
        }));
        return { indeks, t: 0, kierunek, krag, odlamki };
    }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        const opada = this._trwa && this._doKonca < czasOpadu();
        if (!this._trwa || opada) {
            // Świeży start (albo kamienie już spadają - nie wracają na orbitę).
            this._pierscienie = [];
            this._kotwica.reset();
        }
        if (this._pierscienie.length < NASTAWY.MAKS_PIERSCIENI) {
            const ostatni = this._pierscienie[this._pierscienie.length - 1];
            this._pierscienie.push(this._nowyPierscien(this._pierscienie.length, ostatni?.kierunek ?? 0));
        }
        // Powyżej MAKS_PIERSCIENI odpalenie tylko przedłuża życie tarczy.
        this._sila = (this._trwa && !opada) ? Math.max(this._sila, s) : s;
        this._doKonca = CZAS_TRWANIA;
        this._trwa = true;
    }

    /**
     * @param {CanvasRenderingContext2D|null} ctx
     * @param {{frame, W, H, maska, maskaSzer, maskaWys, fit}} k  main.js kontekstTechnik
     * @param {number} dt
     */
    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._doKonca -= krok;
        for (const p of this._pierscienie) p.t += krok;
        if (this._doKonca <= 0) { this._trwa = false; this._pierscienie = []; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };   // ten sam zastępczy rząd wielkości co kregSylwetki
        if (!ctx) return;   // guard PO zegarze i zaczepie - patrz kolowrot.js

        const sk = this.zaczep.skala;
        const pozycje = [];
        for (const p of this._pierscienie) {
            const alfa = obwiednia(p.t, this._doKonca) * this._sila;
            if (alfa < 0.01) continue;
            for (const o of p.odlamki) {
                pozycje.push([o, pozycjaOdlamka(o, p.t, this._doKonca, this.zaczep, sk, p.krag), alfa]);
            }
        }

        // Najpierw TYŁ (za ciałem), potem PRZÓD - kolejność rysowania = głębia.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            for (const [o, p, a] of pozycje) if (!p.przod) this._rysuj(tyl, o, p, a);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        for (const [o, p, a] of pozycje) if (p.przod) this._rysuj(ctx, o, p, a);
    }

    _rysuj(c, o, p, alfa) {
        const img = obraz(MANIFEST.odlamek[o.wariant]);
        if (!img) return;   // asset jeszcze się ładuje - GEMINI.md §2
        const d = this.zaczep.skala * o.rozmiar;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.obrot);
        // Fioletowa poświata pod spodem ('lighter'), kamień na wierzchu
        // ('source-over') - kamień ma być MATERIĄ, nie kolejną świecącą plamą.
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = clamp01(alfa * 0.5);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_POSWIATY, 128), -d * 0.65, -d * 0.65, d * 1.3, d * 1.3);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = clamp01(alfa);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_KAMIENIA, 128), -d / 2, -d / 2, d, d);
        c.restore();
    }
}
