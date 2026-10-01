/**
 * HUD rundy - odliczanie, czas, Zew, "Teraz tańczy".
 *
 * DOM, NIE PŁÓTNO (lustro, webfont - jak js/sekwencja.js i js/wynikHud.js).
 * Funkcje CZYSTE liczą widok (testy w node), klasa tylko aplikuje go do
 * elementów; brak elementów = cicho nic nie robi.
 *
 * TON (§2): ostatnie 10 s to rozpalająca się łuna, nie zagrożenie. Podsumowanie rundy
 * to już nie baner tutaj, tylko Kronika obrzędu (js/kronika.js + js/polanaUi.js).
 */
import { NAZWY_ZYWIOLOW } from './tryby.js';

/** 65 -> '1:05'. Zaokrąglane W GÓRĘ: 0:00 pokazujemy dopiero, gdy czas naprawdę minął. */
export function formatCzasu(s) {
    if (!Number.isFinite(s) || s <= 0) return '0:00';
    const c = Math.ceil(s);
    return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`;
}

export function tekstZewu(zywiol) {
    const nazwa = NAZWY_ZYWIOLOW[zywiol];
    return nazwa ? `Duchy proszą: ${nazwa} ×2` : '';
}

/** @param {import('./przebieg.js').Przebieg|null} przebieg  null = tryb swobodny */
export function widokRundy(przebieg) {
    const pusty = { zapowiedz: '', odliczanie: 0, czas: '', ostatnie: false, zew: '' };
    if (!przebieg) return pusty;
    if (przebieg.stan !== 'RUNDA') return pusty;
    const r = przebieg.runda;
    return {
        zapowiedz: r.stan === 'ZAPOWIEDZ' && przebieg.nick ? `Teraz tańczy: ${przebieg.nick}` : '',
        odliczanie: r.odliczanie,
        czas: r.stan === 'TRWA' || r.stan === 'WYBRZMIENIE' ? formatCzasu(r.pozostaloS) : '',
        ostatnie: r.ostatnieSekundy,
        zew: r.stan === 'TRWA' ? tekstZewu(przebieg.zew?.zywiol) : ''
    };
}

export class RundaHud {
    constructor(root) {
        this.root = root ?? null;
        const q = (s) => root?.querySelector(s) ?? null;
        this.zapowiedz = q('#runda-zapowiedz');
        this.odliczanie = q('#runda-odliczanie');
        this.czas = q('#runda-czas');
        this.zew = q('#runda-zew');
        this._ost = {};
    }

    _tekst(klucz, el, tekst) {
        if (!el || this._ost[klucz] === tekst) return;
        el.textContent = tekst;
        this._ost[klucz] = tekst;
    }

    update(w) {
        if (!this.root) return;
        const cokolwiek = w.zapowiedz || w.odliczanie || w.czas || w.zew;
        this.root.classList.toggle('hidden', !cokolwiek);
        this._tekst('zapowiedz', this.zapowiedz, w.zapowiedz);
        this._tekst('odliczanie', this.odliczanie, w.odliczanie ? String(w.odliczanie) : '');
        this._tekst('czas', this.czas, w.czas);
        this._tekst('zew', this.zew, w.zew);
        this.root.classList.toggle('ostatnie', !!w.ostatnie);
    }
}
