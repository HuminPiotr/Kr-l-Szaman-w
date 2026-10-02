/**
 * Kurzawa - nagroda za combo stribog -> weles (proste combo 2026-10-02).
 * Wiatr (Stribog) podrywa ziemię (Weles).
 *
 * v2 (2026-10-03, po teście na kamerze): pierwsza wersja była lejem pyłu
 * startującym od brzucha - "rodzi się z brzucha" i nie czytała się jako
 * wiatr. Teraz to PAS WIATRU: cztery podmuchy wylatują SPOD DOLNEJ KRAWĘDZI
 * EKRANU (kamera nie widzi podłogi, więc dół kadru robi za ziemię), na
 * zmianę z lewej i prawej, wspinają się łukiem i wchodzą w poziome pasy
 * wokół tułowia na różnych wysokościach. Sąsiednie pasy kręcą się
 * przeciwnie.
 *
 * WIATR = SMUGA, nie drobiny (pamięć projektu: "efekt ciągły = kreska, nie
 * sprite"). Ogon smugi to czysta funkcja: punkty toru głowy z ostatnich
 * DLUGOSC_OGONA_S sekund (punktyOgona), liczone od BIEŻĄCEGO zaczepu - smuga
 * sama podąża za ciałem, bez bufora historii. Odcinki za ciałem (górna połowa
 * elipsy, sin(kąt) < 0) idą na warstwę ZA sylwetką (js/warstwaZaSylwetka.js),
 * przednie przed nią - widać, że wiatr OWIJA gracza.
 *
 * v2.1 (2026-10-03, drugi test): smugi 'lighter' w miętowej barwie z białym
 * rdzeniem wyglądały jak KULE MOCY - tak gra rysuje energię. Piasek i kurz to
 * MATERIA: ciepła ochra, zwykłe blendowanie (source-over), nic nie świeci.
 * Wiatr składa się z (1) miękkiej mgiełki kurzu - kłęby smoke_* na ogonie,
 * (2) ziaren piasku - krótkich kresek wzdłuż ruchu, rozrzucanych coraz szerzej
 * ku końcowi ogona i migoczących, (3) grudek ziemi dirt_* i (4) bardzo cienkiej,
 * bladej linii prądu jako wskazówki kierunku. Wariant "lekki": sylwetka gracza
 * i obraz z kamery zostają wyraźne.
 *
 * GŁADKIE WEJŚCIE W ORBITĘ: podmuch wchodzi w skrajny lewy/prawy punkt
 * elipsy, gdzie styczna jest PIONOWA - ruch w górę od dołu ekranu przechodzi
 * w orbitę bez załamania. Stąd kierunek obrotu wynika ze strony wejścia
 * (lewa: kąt rośnie, prawa: maleje), a naprzemienne strony dają naprzemienne
 * kierunki pasów.
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';

export const CZAS_TRWANIA = 5.0;   // s

export const NASTAWY = {
    LICZBA_PODMUCHOW: 4,
    PASY: [1.3, 0.7, 0.1, -0.5],   // skala * to pod barkami: biodra, brzuch, pierś, barki (pas 0 najniżej)
    DOL_EKRANU: 0.92,              // pas nigdy niżej niż H * to - biodra bywają poza kadrem
    START_CO: 0.25,                // s między startami kolejnych podmuchów (od najniższego)
    T_WZNOSZENIA: 0.6,             // s - lot od dołu ekranu do pasa
    MARGINES_STARTU: 0.25,         // skala * to pod dolną krawędzią ekranu
    ODCHYLENIE_STARTU: 0.8,        // R * to na zewnątrz od punktu wejścia - łuk zamiast pionu
    PROMIEN: 1.45,                 // skala * to = promień pasa
    SQUASH: 0.28,                  // płaska elipsa - pas poziomy wokół ciała
    PREDKOSC_KATOWA: 3.6,          // rad/s
    DLUGOSC_OGONA_S: 0.45,         // s toru głowy w ogonie (~1/4 okrążenia)
    PUNKTOW_OGONA: 18,
    LICZBA_PYLU: 40,               // grudki ziemi (dirt_*)
    ROZMIAR_PYLU_OD: 0.06, ROZMIAR_PYLU_DO: 0.14,   // skala * to
    ROZRZUT_PYLU: 0.15,            // skala * to - grudki obok toru, nie na nim
    LICZBA_ZIAREN: 80,             // ziarna piasku (kreski), po 20 na podmuch
    ROZRZUT_ZIARNA: 0.35,          // skala * to - rozrzut na końcu ogona (przy głowie ~0)
    DLUGOSC_ZIARNA: 0.05,          // skala * to - długość kreski
    GRUBOSC_ZIARNA: 1.6,           // px (stała - to ziarno, nie skaluje się z postacią)
    ALFA_ZIARNA: 0.75,
    MIGOTANIE: 14,                 // zmian/s - ziarno co jakiś czas znika
    MGLA_CO: 3,                    // kłąb kurzu co tyle punktów ogona
    MGLA_ROZMIAR_OD: 0.5, MGLA_ROZMIAR_DO: 1.1,   // skala * to, rośnie ku końcowi ogona
    MGLA_ALFA: 0.16,
    GRUBOSC_LINII: 0.008,          // skala * to - cienka linia prądu
    ALFA_LINII: 0.2,
    NAROST: 0.3, WYGASZENIE: 1.0,  // s
    BARWA_KURZU: [200, 172, 125],  // piaskowa ochra - kłęby mgiełki
    BARWA_ZIARNA: [225, 205, 165], // jasny piasek
    BARWA_LINII: [215, 195, 160],  // blady beż
    BARWA_PYLU: [150, 118, 82]     // ciemna ziemia - grudki
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

/** Alfa całości - narost NAROST, gaśnie przez ostatnie WYGASZENIE sekund. */
export function obwiednia(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= CZAS_TRWANIA) return 0;
    return Math.min(1, t / NASTAWY.NAROST) * Math.min(1, (CZAS_TRWANIA - t) / NASTAWY.WYGASZENIE);
}

/**
 * Pas podmuchu `i` - czysta funkcja.
 * @returns {{cx, cy, R, strona:-1|1, katWejscia, kierunek:-1|1}}  px; strona -1 = wejście z lewej
 */
export function geometriaPasa(i, zaczep, H) {
    const N = NASTAWY;
    const sk = zaczep.skala;
    const strona = i % 2 === 0 ? -1 : 1;
    return {
        cx: zaczep.x,
        cy: Math.min(zaczep.y + sk * (N.PASY[i] ?? 0), H * N.DOL_EKRANU),
        R: sk * N.PROMIEN,
        strona,
        katWejscia: strona < 0 ? Math.PI : 0,   // skrajny punkt elipsy po swojej stronie
        kierunek: strona < 0 ? 1 : -1           // ruch w GÓRĘ z punktu wejścia - patrz nagłówek
    };
}

/**
 * Głowa podmuchu `i` w chwili `tPodmuchu` (s od JEGO startu) - czysta funkcja.
 * @returns {{x, y, przod:boolean}|null}  null przed startem
 */
export function glowaPodmuchu(i, tPodmuchu, zaczep, H) {
    if (!Number.isFinite(tPodmuchu) || tPodmuchu < 0) return null;
    const N = NASTAWY;
    const g = geometriaPasa(i, zaczep, H);
    const E = { x: g.cx + Math.cos(g.katWejscia) * g.R, y: g.cy };
    if (tPodmuchu < N.T_WZNOSZENIA) {
        // Krzywa kwadratowa S -> C -> E: start pod dołem ekranu, odsunięty na
        // zewnątrz; C nad S na osi punktu wejścia, więc styczna w E jest pionowa.
        const u = tPodmuchu / N.T_WZNOSZENIA;
        const S = { x: E.x + g.strona * g.R * N.ODCHYLENIE_STARTU, y: H + zaczep.skala * N.MARGINES_STARTU };
        const C = { x: E.x, y: (S.y + E.y) / 2 };
        const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        return { x: a * S.x + b * C.x + c * E.x, y: a * S.y + b * C.y + c * E.y, przod: true };
    }
    const kat = g.katWejscia + g.kierunek * N.PREDKOSC_KATOWA * (tPodmuchu - N.T_WZNOSZENIA);
    return { x: g.cx + Math.cos(kat) * g.R, y: g.cy + Math.sin(kat) * g.R * N.SQUASH, przod: Math.sin(kat) > 0 };
}

/**
 * Smuga podmuchu `i` w chwili `t` (s od zapal()): głowa + punkty toru z
 * ostatnich DLUGOSC_OGONA_S sekund - czysta funkcja.
 * @returns {{x, y, przod, zwezenie:number}[]}  zwezenie 1 przy głowie -> 0 na końcu; [] przed startem
 */
export function punktyOgona(i, t, zaczep, H) {
    const N = NASTAWY;
    const tPodmuchu = t - i * N.START_CO;
    const pkt = [];
    for (let k = 0; k <= N.PUNKTOW_OGONA; k++) {
        const p = glowaPodmuchu(i, tPodmuchu - k * N.DLUGOSC_OGONA_S / N.PUNKTOW_OGONA, zaczep, H);
        if (!p) break;
        pkt.push({ ...p, zwezenie: 1 - k / N.PUNKTOW_OGONA });
    }
    return pkt;
}

/**
 * Kłęby mgiełki kurzu na ogonie podmuchu `i`: co MGLA_CO-ty punkt toru.
 * @returns {{x, y, przod, wiek:number}[]}  wiek 0 przy głowie -> 1 na końcu ogona; [] przed startem
 */
export function punktyMgielki(i, t, zaczep, H) {
    const N = NASTAWY;
    const wynik = [];
    for (let k = 0; k <= N.PUNKTOW_OGONA; k += N.MGLA_CO) {
        const p = glowaPodmuchu(i, t - i * N.START_CO - k * N.DLUGOSC_OGONA_S / N.PUNKTOW_OGONA, zaczep, H);
        if (!p) break;
        wynik.push({ x: p.x, y: p.y, przod: p.przod, wiek: k / N.PUNKTOW_OGONA });
    }
    return wynik;
}

/**
 * Ziarno piasku w chwili `t` - czysta funkcja. Leży na torze głowy podmuchu
 * sprzed `opoznienie` sekund, odsunięte o (dx,dy)·rozrzut, gdzie rozrzut rośnie
 * liniowo z opóźnieniem (przy głowie ~0, na końcu ogona ROZRZUT_ZIARNA skali).
 * @param {{podmuch, opoznienie, dx, dy}} z  dx,dy w -1..1
 * @returns {{x, y, przod, kierunek:{x,y}}|null}  kierunek = wektor jednostkowy ruchu; null przed startem
 */
export function ziarnoNaTorze(z, t, zaczep, H) {
    const N = NASTAWY;
    const tz = t - z.podmuch * N.START_CO - z.opoznienie;
    const p = glowaPodmuchu(z.podmuch, tz, zaczep, H);
    if (!p) return null;
    const wstecz = glowaPodmuchu(z.podmuch, tz - 0.03, zaczep, H) ?? p;
    let kx = p.x - wstecz.x, ky = p.y - wstecz.y;
    const dl = Math.hypot(kx, ky);
    if (dl > 1e-9) { kx /= dl; ky /= dl; } else { kx = 0; ky = -1; }
    const rozrzut = zaczep.skala * N.ROZRZUT_ZIARNA * clamp01(z.opoznienie / N.DLUGOSC_OGONA_S);
    return { x: p.x + z.dx * rozrzut, y: p.y + z.dy * rozrzut, przod: p.przod, kierunek: { x: kx, y: ky } };
}

export class Kurzawa {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._pyl = [];
        this._ziarna = [];
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this.zaczep = null;
    }

    get aktywny() { return this._trwa; }

    wyczyscCache() { wyczyscCacheAssetow(); }

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        const N = NASTAWY;
        this._sila = s;
        this._t = 0;
        this._trwa = true;
        this._kotwica.reset();
        // Grudki i ziarna przypisane do podmuchów, z opóźnieniem względem głowy (lecą w smudze).
        this._pyl = Array.from({ length: N.LICZBA_PYLU }, (_, i) => ({
            podmuch: i % N.LICZBA_PODMUCHOW,
            opoznienie: Math.random() * N.DLUGOSC_OGONA_S,
            dx: (Math.random() * 2 - 1) * N.ROZRZUT_PYLU,
            dy: (Math.random() * 2 - 1) * N.ROZRZUT_PYLU * 0.5,
            rozmiar: N.ROZMIAR_PYLU_OD + Math.random() * (N.ROZMIAR_PYLU_DO - N.ROZMIAR_PYLU_OD),
            obrot: Math.random() * Math.PI * 2,
            vObrot: (Math.random() * 2 - 1) * 6,
            wariant: Math.floor(Math.random() * MANIFEST.odlamek.length)
        }));
        this._ziarna = Array.from({ length: N.LICZBA_ZIAREN }, (_, i) => ({
            podmuch: i % N.LICZBA_PODMUCHOW,
            opoznienie: Math.random() * N.DLUGOSC_OGONA_S,
            dx: Math.random() * 2 - 1,
            dy: Math.random() * 2 - 1,
            faza: Math.random() * 4,        // przesunięcie migotania
            jasnosc: 0.6 + Math.random() * 0.4
        }));
    }

    _pozycjaPylu(c, H) {
        const p = glowaPodmuchu(c.podmuch, this._t - c.podmuch * NASTAWY.START_CO - c.opoznienie, this.zaczep, H);
        if (!p) return null;
        const sk = this.zaczep.skala;
        return { x: p.x + c.dx * sk, y: p.y + c.dy * sk, przod: p.przod,
                 alfa: 1 - c.opoznienie / NASTAWY.DLUGOSC_OGONA_S };
    }

    updateAndDraw(ctx, k, dt) {
        if (!this._trwa) return;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        if (this._t >= CZAS_TRWANIA) { this._trwa = false; return; }

        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this.zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        if (!ctx) return;   // guard PO zegarze i zaczepie - patrz kolowrot.js

        const alfa = obwiednia(this._t) * this._sila;
        if (alfa < 0.01) return;
        const N = NASTAWY;
        const ogony = [], mgly = [];
        for (let i = 0; i < N.LICZBA_PODMUCHOW; i++) {
            ogony.push(punktyOgona(i, this._t, this.zaczep, H));
            mgly.push(punktyMgielki(i, this._t, this.zaczep, H));
        }
        const pyl = this._pyl.map(c => [c, this._pozycjaPylu(c, H)]).filter(([, p]) => p);
        const ziarna = this._ziarna.map(z => [z, ziarnoNaTorze(z, this._t, this.zaczep, H)]).filter(([, p]) => p);

        // Najpierw TYŁ (za ciałem), potem PRZÓD - kolejność rysowania = głębia.
        const tyl = this._warstwa.zacznij(W, H);
        if (tyl) {
            this._rysujStrone(tyl, false, ogony, mgly, pyl, ziarna, alfa);
            this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
        }
        this._rysujStrone(ctx, true, ogony, mgly, pyl, ziarna, alfa);
    }

    /** Warstwy jednej strony ciała od spodu: mgiełka, linia prądu, grudki, ziarna. */
    _rysujStrone(c, przod, ogony, mgly, pyl, ziarna, alfa) {
        c.save();
        c.globalCompositeOperation = 'source-over';   // piasek to materia, nic nie świeci
        mgly.forEach((m, i) => this._rysujMgielke(c, m, i, przod, alfa));
        ogony.forEach(o => this._rysujLinie(c, o, przod, alfa));
        for (const [d, p] of pyl) if (p.przod === przod) this._rysujPyl(c, d, p, alfa);
        for (const [z, p] of ziarna) if (p.przod === przod) this._rysujZiarno(c, z, p, alfa);
        c.restore();
    }

    _rysujMgielke(c, punkty, i, przod, alfa) {
        const N = NASTAWY;
        punkty.forEach((m, j) => {
            if (m.przod !== przod) return;
            const img = obraz(MANIFEST.mgla[(i * 7 + j) % MANIFEST.mgla.length]);
            if (!img) return;   // asset jeszcze się ładuje - GEMINI.md §2
            const rozmiar = this.zaczep.skala * (N.MGLA_ROZMIAR_OD + (N.MGLA_ROZMIAR_DO - N.MGLA_ROZMIAR_OD) * m.wiek);
            c.save();
            c.translate(m.x, m.y);
            c.rotate(i * 1.7 + j * 0.9 + this._t * 0.15);   // stałe ziarno + powolny obrót, nie drżenie
            c.globalAlpha = clamp01(alfa * N.MGLA_ALFA * (1 - 0.8 * m.wiek));
            c.drawImage(wypalTintowany(img, N.BARWA_KURZU, 128), -rozmiar / 2, -rozmiar / 2, rozmiar, rozmiar);
            c.restore();
        });
    }

    /** Bardzo cienka, blada linia prądu po torze ogona - tylko wskazówka kierunku. */
    _rysujLinie(c, pkt, przod, alfa) {
        if (pkt.length < 2) return;
        const N = NASTAWY;
        const [r, g, b] = N.BARWA_LINII;
        c.lineCap = 'round';
        c.lineWidth = Math.max(1, this.zaczep.skala * N.GRUBOSC_LINII);
        for (let i = 0; i < pkt.length - 1; i++) {
            const a = pkt[i], z = pkt[i + 1];
            if (a.przod !== przod) continue;
            c.strokeStyle = `rgba(${r},${g},${b},${(N.ALFA_LINII * alfa * a.zwezenie).toFixed(3)})`;
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(z.x, z.y);
            c.stroke();
        }
    }

    _rysujPyl(c, d, p, alfa) {
        const img = obraz(MANIFEST.odlamek[d.wariant]);
        if (!img) return;
        const r = this.zaczep.skala * d.rozmiar;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(d.obrot + d.vObrot * this._t);
        c.globalAlpha = clamp01(p.alfa * alfa * 0.85);
        c.drawImage(wypalTintowany(img, NASTAWY.BARWA_PYLU, 64), -r / 2, -r / 2, r, r);
        c.restore();
    }

    /** Ziarno piasku: krótka kreska wzdłuż ruchu; co jakiś czas znika (sypkość). */
    _rysujZiarno(c, z, p, alfa) {
        const N = NASTAWY;
        if (Math.floor(this._t * N.MIGOTANIE + z.faza * 7) % 4 === 0) return;
        const dl = this.zaczep.skala * N.DLUGOSC_ZIARNA;
        const [r, g, b] = N.BARWA_ZIARNA;
        c.lineCap = 'round';
        c.lineWidth = N.GRUBOSC_ZIARNA;
        c.strokeStyle = `rgba(${r},${g},${b},${(N.ALFA_ZIARNA * z.jasnosc * alfa).toFixed(3)})`;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.kierunek.x * dl, p.y - p.kierunek.y * dl);
        c.stroke();
    }
}
