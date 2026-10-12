/**
 * Falowanie ramion - miara pod zaklinanie deszczu (Dodola, spec
 * docs/superpowers/specs/2026-10-09-dodola-zaklinanie-design.md).
 *
 * Postawa: ramiona rozpostarte na boki - leżą w płaszczyźnie obrazu, więc
 * mierzymy tylko x/y worldLandmarks (z z jednej kamery to zgadywanie).
 * Wyłącznie punkty POZY (bark/łokieć/nadgarstek), nie modelu dłoni.
 *
 * Składniki, per ramię, w oknie OKNO_S:
 *   rozpostarcie  0..1  nadgarstek daleko w bok i mniej więcej na wysokości barku
 *   amplituda     [rad] odchylenie standardowe kąta ramienia/przedramienia - czy ramię faluje
 *   zgiecie       0..   std(kąt w łokciu) / std(kąt ramienia) - sztywne skrzydło ~0.35,
 *                       fala przez ramię wyraźnie więcej
 *   opoznienie    [s]   o ile przedramię SPÓŹNIA SIĘ za ramieniem (szczyt korelacji);
 *                       skrzydło dokładnie 0, wąż > 0 - fala biegnie od barku na zewnątrz
 *   korelacja     -1..1 wartość tego szczytu = RYTM: niedbałe ruchy go nie mają
 *
 * ZMIERZONE na nagraniu właściciela (tools/probki/probki-2026-10-09-14-18-46.json,
 * node tools/pomiar-falowania.mjs): zgięcie wąż 0.66-0.96 / skrzydło 0.32-0.41,
 * opóźnienie wąż 0.04-0.13 s / skrzydło 0, korelacja skrzydło 0.98 / wąż 0.85 /
 * niedbale 0.5-0.68. Była też "gładkość" (reszta po średniej kroczącej) -
 * usunięta, bo nie rozdzielała NICZEGO (wąż 0.77-0.85, skrzydło 0.79-0.86).
 * Wężowość to fala biegnąca wzdłuż ramienia, nie brak drgań.
 *
 * Konwencja worldLandmarks: y rośnie W DÓŁ (sprawdzone na nagraniu błyskawicy:
 * nadgarstek nad głową ma y mniejsze niż bark), stąd minus przy kątach.
 */

const OKNO_S = 2.0;            // ~2 cykle fali przy 1 Hz
const MIN_PROBEK = 20;
const MAX_OPOZNIENIA_S = 0.4;
const PROG_WIDOCZNOSCI = 0.5;

// Progi jakoscFali(). Dobrane na JEDNYM nagraniu jednej osoby - stroić
// z nakładki D (debugHud pokazuje składniki), nie z wyobraźni.
export const NASTAWY = {
    AMPLITUDA_OD: 0.08, AMPLITUDA_DO: 0.30,   // rad - poniżej to drgania, nie fala
    KORELACJA_OD: 0.45, KORELACJA_DO: 0.80,   // rytm
    ZGIECIE_OD: 0.45, ZGIECIE_DO: 0.75,
    OPOZNIENIE_OD: 0.02, OPOZNIENIE_DO: 0.10, // s
    PODLOGA_WEZA: 0.25                        // sztywne skrzydło też coś daje
};

const RAMIONA = [
    { nazwa: 'L', bark: 11, lokiec: 13, nadgarstek: 15, drugiBark: 12 },
    { nazwa: 'P', bark: 12, lokiec: 14, nadgarstek: 16, drugiBark: 11 }
];

const rampa = (v, a, b) => Number.isFinite(v) ? Math.max(0, Math.min(1, (v - a) / (b - a))) : 0;

/** Wężowość 0..1 ze składników - zgięcie i opóźnienie po równo. Czysta funkcja. */
export function wezowosc(m) {
    const N = NASTAWY;
    return 0.5 * rampa(m?.zgiecie, N.ZGIECIE_OD, N.ZGIECIE_DO) +
           0.5 * rampa(m?.opoznienie, N.OPOZNIENIE_OD, N.OPOZNIENIE_DO);
}

/**
 * Jakość fali 0..1 - to, co steruje natężeniem zaklinania. Iloczyn, bo każdy
 * czynnik jest WARUNKIEM: bez postawy, bez ruchu albo bez rytmu wężowość
 * z szumu nic nie znaczy (zmierzone: bez ruchu daje "węża" 0.5 z samego szumu).
 * Czysta funkcja; null/NaN -> 0.
 *
 * Na nagraniu: wąż 0.63-0.97, skrzydło 0.14-0.25, niedbale 0-0.28, bez ruchu i taniec 0.
 */
export function jakoscFali(m) {
    if (!m) return 0;
    const N = NASTAWY;
    const q = rampa(m.rozpostarcie, 0, 1) *
              rampa(m.amplituda, N.AMPLITUDA_OD, N.AMPLITUDA_DO) *
              rampa(m.korelacja, N.KORELACJA_OD, N.KORELACJA_DO) *
              (N.PODLOGA_WEZA + (1 - N.PODLOGA_WEZA) * wezowosc(m));
    return Number.isFinite(q) ? q : 0;
}

function widoczny(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
           (p.visibility === undefined || p.visibility >= PROG_WIDOCZNOSCI);
}

function srednia(a) { let s = 0; for (const v of a) s += v; return s / a.length; }
function odchylenie(a) {
    const m = srednia(a); let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    return Math.sqrt(s / a.length);
}

export class FalowanieRamion {
    constructor({ oknoS = OKNO_S } = {}) {
        this.oknoS = oknoS;
        this._bufor = RAMIONA.map(() => []);   // [{t, ku, kf, zasieg, wysokosc}]
        this._t = 0;
    }

    /** Czyste okno - nowe zaklinanie nie dziedziczy fali sprzed kilkunastu sekund. */
    reset() {
        for (const b of this._bufor) b.length = 0;
    }

    /**
     * @param {Array|null} worldLandmarks
     * @param {number} dt [s]
     * @returns {{ramiona: object[], laczne: object|null}}
     */
    update(worldLandmarks, dt) {
        // Bez postępu czasu nie ma z czego liczyć opóźnienia - klatka pominięta.
        if (!Number.isFinite(dt) || dt <= 0) return { ramiona: [null, null], laczne: null };
        this._t += dt;
        const ramiona = RAMIONA.map((r, i) => this._ramie(r, i, worldLandmarks));
        const wazne = ramiona.filter(Boolean);
        return { ramiona, laczne: wazne.length ? polacz(wazne) : null };
    }

    _ramie(r, i, w) {
        const buf = this._bufor[i];
        const B = w?.[r.bark], E = w?.[r.lokiec], W = w?.[r.nadgarstek], B2 = w?.[r.drugiBark];
        if (!widoczny(B) || !widoczny(E) || !widoczny(W) || !widoczny(B2)) {
            buf.length = 0;   // przerwa w danych - okno od nowa
            return null;
        }
        const dl = Math.hypot(E.x - B.x, E.y - B.y) + Math.hypot(W.x - E.x, W.y - E.y);
        if (!(dl > 1e-3)) return null;

        // "Na zewnątrz" = od drugiego barku. NIE |dx|: przy skrzyżowanych
        // rękach (pieczęć Welesa) nadgarstek jest daleko od barku, tylko po
        // złej stronie ciała - |dx| brał to za rozpostarcie (zmierzone: 0.5).
        // Kąty elewacji w tej samej konwencji dla obu ramion: 0 = poziomo w bok, + = w górę.
        const kier = Math.sign(B.x - B2.x) || 1;
        const ku = Math.atan2(-(E.y - B.y), kier * (E.x - B.x));
        const kf = Math.atan2(-(W.y - E.y), kier * (W.x - E.x));
        const zasieg = Math.max(0, kier * (W.x - B.x)) / dl;   // 1 = ramię w pełni w bok
        const wysokosc = -(W.y - B.y) / dl;           // 0 = nadgarstek na wysokości barku

        buf.push({ t: this._t, ku, kf, zasieg, wysokosc });
        while (buf.length && this._t - buf[0].t > this.oknoS) buf.shift();
        if (buf.length < MIN_PROBEK) return null;

        return zmierz(buf);
    }
}

function zmierz(buf) {
    const n = buf.length;
    const dtSr = (buf[n - 1].t - buf[0].t) / (n - 1);
    if (!(dtSr > 0)) return null;
    const ku = buf.map(p => p.ku), kf = buf.map(p => p.kf);
    const zgiecieKat = buf.map(p => p.kf - p.ku);

    // Postawa ze ŚREDNIEJ okna, nie z klatki - fala sama w sobie unosi
    // i opuszcza nadgarstek, chwilowa wysokość nie mówi nic o postawie.
    const zasieg = srednia(buf.map(p => p.zasieg));
    const wysokosc = srednia(buf.map(p => p.wysokosc));
    const rozpostarcie = rampa(zasieg, 0.5, 0.8) * (1 - rampa(Math.abs(wysokosc), 0.35, 0.7));

    const sU = odchylenie(ku), sF = odchylenie(kf);
    const amplituda = Math.max(sU, sF);
    const zgiecie = odchylenie(zgiecieKat) / (Math.max(sU, sF) + 1e-3);

    // Korelacja wzajemna kąta ramienia i przedramienia; szukamy przesunięcia,
    // przy którym przedramię (spóźnione o `lag`) najlepiej pasuje do ramienia.
    const mU = srednia(ku), mF = srednia(kf);
    const maxLag = Math.min(Math.floor(MAX_OPOZNIENIA_S / dtSr), Math.floor(n / 3));
    let najK = -Infinity, najLag = 0;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        let s = 0, su = 0, sf = 0;
        for (let j = Math.max(0, -lag); j < n - Math.max(0, lag); j++) {
            const a = ku[j] - mU, b = kf[j + lag] - mF;
            s += a * b; su += a * a; sf += b * b;
        }
        const k = s / (Math.sqrt(su * sf) + 1e-9);
        if (k > najK) { najK = k; najLag = lag; }
    }

    return {
        rozpostarcie, zasieg, wysokosc,
        amplituda,
        zgiecie,
        opoznienie: najLag * dtSr,
        korelacja: najK
    };
}

function polacz(r) {
    const k = Object.keys(r[0]);
    const o = {};
    for (const klucz of k) o[klucz] = srednia(r.map(x => x[klucz]));
    return o;
}
