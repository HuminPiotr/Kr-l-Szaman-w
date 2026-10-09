/**
 * Księga Plemienia - najlepsze wyniki (nick + punkty), lokalnie.
 * Spec: docs/superpowers/specs/2026-10-01-polana-ksiega-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. `localStorage` wstrzykiwany (pamiec = {getItem,setItem}
 * albo null), więc testy w node używają atrapy. BRAK PAMIĘCI NIE JEST BŁĘDEM
 * (tryb prywatny, zablokowane dane, pełny dysk): Księga działa wtedy w pamięci
 * procesu do zamknięcia karty, a `trwala` mówi UI, że ma o tym powiedzieć.
 *
 * Tablice osobno per tryb i wariant. Zew podwaja punkty, więc rundy ze Zewem
 * mają WŁASNE tablice (sufiks `+zew`) - inaczej wyniki z Zewem wypychałyby
 * zwykłe z listy.
 *
 * To jedyne miejsce, w którym do gry wchodzą dane z zewnątrz (import pliku),
 * więc WSZYSTKO przechodzi walidację: klucze po wzorcu (nie `__proto__`),
 * wpisy po polach, limity liczby tablic/wpisów/rozmiaru pliku.
 */
import { PROBA_DLUGOSCI, MAX_NICK } from './tryby.js';

export const MAX_WPISOW = 10;
export const MAX_TABLIC = 64;
export const MAX_PLIK_ZNAKOW = 262144;
export const KLUCZ_PAMIECI = 'krolSzamanow.ksiega.v1';
export const KLUCZ_NICKU = 'krolSzamanow.nick';

// Klucz musi pasować do wzorca - to także obrona przed `__proto__`/`constructor`
// jako nazwą tablicy w zaimportowanym pliku.
const KLUCZ_RE = /^(obrzed:[^\n]{1,120}|proba:\d{1,3})(\+zew)?$/;

/**
 * Klucz tablicy dla rundy. Obrzęd bez pieśni (awaria wczytania - gra poszła jak
 * próba 90 s) ląduje w tablicy próby, nie w nieistniejącej tablicy pieśni.
 * @returns {string|null} null = ta runda nie trafia do Księgi (swobodny)
 */
export function kluczKsiegi(konfig, utwor) {
    const zew = konfig?.zew ? '+zew' : '';
    if (konfig?.tryb === 'obrzed' && utwor?.plik) return `obrzed:${utwor.plik}${zew}`;
    if ((konfig?.tryb === 'proba' || konfig?.tryb === 'obrzed') && PROBA_DLUGOSCI.includes(konfig.dlugoscS)) {
        return `proba:${konfig.dlugoscS}${zew}`;
    }
    return null;
}

/** Czytelna nazwa tablicy dla zakładek Księgi. */
export function nazwaTablicy(klucz, piesni = []) {
    const zew = klucz.endsWith('+zew') ? ' ze Zewem' : '';
    const baza = klucz.replace(/\+zew$/, '');
    if (baza.startsWith('proba:')) return `Próba ${baza.slice(6)} s${zew}`;
    if (baza.startsWith('obrzed:')) {
        const plik = baza.slice(7);
        const u = piesni.find(p => p.plik === plik);
        const reszta = plik.startsWith('yt:') ? 'pieśń z YouTube' : plik.replace(/^wlasna:/, '').replace(/\.[^.]+$/, '');
        return `Obrzęd: ${u?.tytul ?? reszta}${zew}`;
    }
    return klucz;
}

/** @returns {{nick:string, wynik:number, t:number}|null} */
export function walidujWpis(w) {
    if (!w || typeof w !== 'object' || typeof w.nick !== 'string') return null;
    const nick = w.nick.trim().slice(0, MAX_NICK);
    if (!nick) return null;
    if (typeof w.wynik !== 'number' || !Number.isFinite(w.wynik) || w.wynik < 0) return null;
    if (typeof w.t !== 'number' || !Number.isFinite(w.t)) return null;
    return { nick, wynik: Math.floor(w.wynik), t: w.t };
}

// Malejąco po wyniku; remis - starszy wpis wyżej (kto pierwszy, ten wyżej).
const porownaj = (a, b) => (b.wynik - a.wynik) || (a.t - b.t);

/** @returns {{tablice: Object<string, Array>}|null} null = zła struktura */
export function walidujKsiege(dane) {
    if (!dane || typeof dane !== 'object' || Array.isArray(dane)) return null;
    if (!dane.tablice || typeof dane.tablice !== 'object' || Array.isArray(dane.tablice)) return null;
    const tablice = {};
    let ile = 0;
    for (const [klucz, wpisy] of Object.entries(dane.tablice)) {
        if (!KLUCZ_RE.test(klucz) || !Array.isArray(wpisy)) continue;
        const dobre = wpisy.map(walidujWpis).filter(Boolean).sort(porownaj).slice(0, MAX_WPISOW);
        if (!dobre.length) continue;
        if (++ile > MAX_TABLIC) break;
        tablice[klucz] = dobre;
    }
    return { tablice };
}

export class Ksiega {
    /** @param {{getItem:Function, setItem:Function}|null} [pamiec]  localStorage albo atrapa */
    constructor(pamiec = null) {
        this._pamiec = pamiec ?? null;
        this.tablice = {};
        this.trwala = false;   // czy pamięć działa - UI mówi, gdy nie
        this._wczytaj();
    }

    _wczytaj() {
        if (!this._pamiec) return;
        let surowe;
        try {
            surowe = this._pamiec.getItem(KLUCZ_PAMIECI);
            this.trwala = true;
        } catch {
            return;   // pamięć niedostępna: Księga działa w procesie
        }
        if (!surowe) return;
        try {
            this.tablice = walidujKsiege(JSON.parse(surowe))?.tablice ?? {};
        } catch {
            this.tablice = {};   // zepsuty JSON: zaczynamy od pustej, kolejny zapis go nadpisze
        }
    }

    _zapisz() {
        if (!this._pamiec || !this.trwala) return;   // po pierwszej awarii nie męczymy pamięci
        try {
            this._pamiec.setItem(KLUCZ_PAMIECI, JSON.stringify({ wersja: 1, tablice: this.tablice }));
        } catch {
            this.trwala = false;   // pełna/zablokowana: dalej w pamięci procesu
        }
    }

    /** @returns {{wpisano:boolean, miejsce:number|null, nowyRekord:boolean, pierwszyWpis:boolean}} */
    dodaj(klucz, nick, wynik, t) {
        const odmowa = { wpisano: false, miejsce: null, nowyRekord: false, pierwszyWpis: false };
        if (typeof klucz !== 'string' || !KLUCZ_RE.test(klucz)) return odmowa;
        const w = walidujWpis({ nick, wynik, t });
        if (!w) return odmowa;
        const stara = this.tablice[klucz] ?? [];
        if (!stara.length && Object.keys(this.tablice).length >= MAX_TABLIC) return odmowa;

        const nowa = [...stara, w].sort(porownaj);
        const idx = nowa.indexOf(w);
        if (idx >= MAX_WPISOW) return odmowa;   // poza dziesiątką: Księga pamięta najlepszych

        const poprzedniNajlepszy = stara.length ? stara[0].wynik : null;
        this.tablice[klucz] = nowa.slice(0, MAX_WPISOW);
        this._zapisz();
        return {
            wpisano: true,
            miejsce: idx + 1,
            // Koronacja tylko za POBICIE istniejącego rekordu - pierwszy wpis w pustej
            // tablicy to "pierwszy zapis", inaczej każdy pierwszy gracz byłby koronowany.
            nowyRekord: poprzedniNajlepszy !== null && w.wynik > poprzedniNajlepszy,
            pierwszyWpis: stara.length === 0
        };
    }

    tablica(klucz) { return (this.tablice[klucz] ?? []).map(w => ({ ...w })); }
    klucze() { return Object.keys(this.tablice).sort(); }

    eksportuj() { return JSON.stringify({ wersja: 1, tablice: this.tablice }, null, 2); }

    /**
     * Import SCALA z istniejącą Księgą (nigdy nie nadpisuje). Ten sam plik wczytany
     * drugi raz niczego nie dubluje.
     * @returns {{ok:boolean, dodano?:number, powod?:'rozmiar'|'plik'}}
     */
    importuj(tekst) {
        if (typeof tekst !== 'string') return { ok: false, powod: 'plik' };
        if (tekst.length > MAX_PLIK_ZNAKOW) return { ok: false, powod: 'rozmiar' };
        let dane;
        try { dane = JSON.parse(tekst); } catch { return { ok: false, powod: 'plik' }; }
        const wal = walidujKsiege(dane);
        if (!wal) return { ok: false, powod: 'plik' };

        let dodano = 0;
        for (const [klucz, wpisy] of Object.entries(wal.tablice)) {
            const istn = this.tablice[klucz] ?? [];
            if (!istn.length && Object.keys(this.tablice).length >= MAX_TABLIC) continue;
            const znane = new Set(istn.map(w => `${w.nick}|${w.wynik}|${w.t}`));
            const nowe = wpisy.filter(w => !znane.has(`${w.nick}|${w.wynik}|${w.t}`));
            const polaczone = [...istn, ...nowe].sort(porownaj).slice(0, MAX_WPISOW);
            dodano += polaczone.filter(w => nowe.includes(w)).length;
            this.tablice[klucz] = polaczone;
        }
        this._zapisz();
        return { ok: true, dodano };
    }

    wyczysc() {
        this.tablice = {};
        this._zapisz();
    }

    zapamietajNick(nick) {
        const n = typeof nick === 'string' ? nick.trim().slice(0, MAX_NICK) : '';
        if (!n) return;   // pusty nie nadpisuje poprzedniego
        try { this._pamiec?.setItem(KLUCZ_NICKU, n); } catch { /* nick to wygoda, nie dane gry */ }
    }

    ostatniNick() {
        try {
            const n = this._pamiec?.getItem(KLUCZ_NICKU);
            return typeof n === 'string' ? n.trim().slice(0, MAX_NICK) : '';
        } catch {
            return '';
        }
    }
}
