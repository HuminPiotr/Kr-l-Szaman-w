/**
 * Fala przez ciało - czy ruch PRZEPŁYWA (spec 2026-10-14-jakosc-tanca-design.md).
 *
 * Uogólnienie wężowości z deszczu (js/ruchy/falowanieRamion.js) na trzy łańcuchy:
 *   ramieL / ramieP  - kąt ramienia -> kąt przedramienia (fala od barku do dłoni),
 *   biodraDlonie     - kołysanie bioder (2D) -> x dłoni (fala od bioder w ręce).
 * Wynik = najsilniejszy łańcuch: jedna fala wystarczy.
 *
 * Opóźnienie liczone jako UŁAMEK OKRESU (js/jakosc/okres.js), nie w sekundach:
 * wolna fala ma dłuższe opóźnienie, szybka krótsze, a obie są "wężem". Bez tego
 * szybka pieśń (etap 3) karałaby szybki taniec.
 * Sztywne skrzydło: opóźnienie 0 -> fala 0. Okres niepewny -> null (neutralnie).
 */
import { korelacjaZOpoznieniem, rampa, odchylenie, widoczny } from './pochodne.js';
import { PROG_PEWNOSCI } from './okres.js';

export const LANCUCHY = ['ramieL', 'ramieP', 'biodraDlonie'];

// ZGADNIĘTE poza OPOZN_* (z nagrania deszczu: wąż ~5-10% cyklu, skrzydło 0).
export const NASTAWY_FALI = {
    OKRESOW_W_OKNIE: 2.5, MIN_OKNO_S: 2.0, MAX_OKNO_S: 5.0,
    CO_ILE_S: 0.1,
    MIN_PROBEK: 20,
    MIN_AMPL: { ramie: 0.08, biodra: 0.05, dlonie: 0.10 },   // rad / szer. barków
    KORELACJA_OD: 0.45, KORELACJA_DO: 0.80,
    OPOZN_OD: 0.02, OPOZN_PELNE: 0.06,                      // ułamek cyklu
    OPOZN_SPADEK_OD: 0.25, OPOZN_SPADEK_DO: 0.35,           // dalej to dwa niezależne ruchy, nie fala
    MAX_OPOZNIENIA_ULAMEK: 0.4,
    TAU_S: 0.8
};
const N = NASTAWY_FALI;

const RAMIONA = { ramieL: [11, 13, 15, 12], ramieP: [12, 14, 16, 11] };

export class FalaCiala {
    constructor() {
        this.fala = null;
        this.diagnostyka = { lancuch: null, opoznienieUlamek: null, korelacja: null };
        this._bufory = Object.fromEntries(LANCUCHY.map(l => [l, []]));   // [{t, a, b}]
        this._t = 0;
        this._doPrzeliczenia = 0;
    }

    update(world, c2d, okres, dt) {
        if (!Number.isFinite(dt) || dt <= 0) return this.fala;
        const krok = Math.min(dt, 0.1);
        this._t += krok;

        for (const [l, [bark, lok, nad, drugi]] of Object.entries(RAMIONA)) {
            const B = world?.[bark], E = world?.[lok], W = world?.[nad], B2 = world?.[drugi];
            if (!widoczny(B) || !widoczny(E) || !widoczny(W) || !widoczny(B2)) { this._bufory[l].length = 0; continue; }
            // Ta sama konwencja kątów co falowanieRamion.js: 0 = poziomo w bok, + = w górę (y w dół).
            const kier = Math.sign(B.x - B2.x) || 1;
            const ku = Math.atan2(-(E.y - B.y), kier * (E.x - B.x));
            const kf = Math.atan2(-(W.y - E.y), kier * (W.x - E.x));
            if (Number.isFinite(ku) && Number.isFinite(kf)) this._bufory[l].push({ t: this._t, a: ku, b: kf });
        }
        const bio = c2d?.biodra, dl = c2d?.dlonieX;
        if (bio && Number.isFinite(bio.x) && Number.isFinite(dl)) this._bufory.biodraDlonie.push({ t: this._t, a: bio.x, b: dl });
        else this._bufory.biodraDlonie.length = 0;

        const T = Number.isFinite(okres?.okresS) && okres.okresS > 0 ? okres.okresS : 1;
        const oknoS = Math.max(N.MIN_OKNO_S, Math.min(N.MAX_OKNO_S, N.OKRESOW_W_OKNIE * T));
        for (const b of Object.values(this._bufory)) while (b.length && this._t - b[0].t > oknoS) b.shift();

        this._doPrzeliczenia -= krok;
        if (this._doPrzeliczenia > 0) return this.fala;
        this._doPrzeliczenia = N.CO_ILE_S;

        if (!(okres?.pewnosc >= PROG_PEWNOSCI)) return this._brak();

        let naj = null;
        for (const l of LANCUCHY) {
            const [minA, minB] = l === 'biodraDlonie' ? [N.MIN_AMPL.biodra, N.MIN_AMPL.dlonie] : [N.MIN_AMPL.ramie, N.MIN_AMPL.ramie];
            const r = ocen(this._bufory[l], T, minA, minB);
            if (r && (!naj || r.q > naj.q)) naj = { ...r, l };
        }
        if (!naj) return this._brak();

        this.diagnostyka = { lancuch: naj.l, opoznienieUlamek: naj.ul, korelacja: naj.k };
        const a = Math.min(1, N.CO_ILE_S / N.TAU_S);
        this.fala = this.fala === null ? naj.q : this.fala + a * (naj.q - this.fala);
        if (!Number.isFinite(this.fala)) this.fala = null;
        return this.fala;
    }

    _brak() {
        this.fala = null;
        this.diagnostyka = { lancuch: null, opoznienieUlamek: null, korelacja: null };
        return null;
    }
}

function ocen(buf, T, minA, minB) {
    const n = buf.length;
    if (n < N.MIN_PROBEK) return null;
    const dtSr = (buf[n - 1].t - buf[0].t) / (n - 1);
    if (!(dtSr > 0)) return null;
    const a = buf.map(p => p.a), b = buf.map(p => p.b);
    if (odchylenie(a) < minA || odchylenie(b) < minB) return null;
    const maxLag = Math.max(1, Math.min(Math.floor(N.MAX_OPOZNIENIA_ULAMEK * T / dtSr), Math.floor(n / 3)));
    const { k, lagDokladny } = korelacjaZOpoznieniem(a, b, maxLag);
    // Opóźnienie podpróbkowe: jedna próbka przy 30 FPS to 2.7% cyklu 0.8 Hz,
    // czyli więcej niż OPOZN_OD - samo całkowite lag dawało fałszywą falę na sztywnym skrzydle.
    const ul = (lagDokladny * dtSr) / T;
    const q = rampa(k, N.KORELACJA_OD, N.KORELACJA_DO) *
              rampa(ul, N.OPOZN_OD, N.OPOZN_PELNE) *
              (1 - rampa(ul, N.OPOZN_SPADEK_OD, N.OPOZN_SPADEK_DO));
    return Number.isFinite(q) ? { q, ul, k } : null;
}
