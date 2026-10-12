/**
 * Pamięć Plemienia - co tancerze tej przeglądarki już odkryli.
 * Spec: docs/superpowers/specs/2026-10-12-pamiec-plemienia-design.md
 *
 * CZYSTA LOGIKA, BEZ DOM. Pamięć wstrzykiwana (localStorage albo atrapa), jak
 * w js/ksiega.js. BRAK PAMIĘCI NIE JEST BŁĘDEM: odkrycia żyją wtedy do
 * zamknięcia karty, a `trwala` mówi UI, że ma o tym powiedzieć.
 *
 * WSPÓLNA DLA PRZEGLĄDARKI I LICZONA WSZĘDZIE - także w swobodnym tańcu, gdzie
 * Punktacja jest wyłączona. Dlatego Pamięć NIE czyta niczego z Punktacji: trzyma
 * własną historię pieczęci, a splot liczy tą samą funkcją (ogonyNakladajaSie).
 *
 * ZAPIS TYLKO PRZY ZMIANIE. Nowe odblokowanie zapisuje się od razu; same liczniki
 * użyć (reakcje strzelają co 60-150 ms!) czekają na zapiszJesliTrzeba() - koniec
 * rundy, Esc na Polanę, schowanie karty.
 *
 * TRWAŁA MIĘDZY RUNDAMI - celowo NIE w js/swiezeModuly.js.
 */
import { PIECZECIE, NAZWY_PIECZECI, TECHNIKI, WEZLY } from './katalog.js';
import { KAMIENIE, OKNO_HISTORII_MS } from './osiagniecia.js';
import { ogonPieczeci, ogonyNakladajaSie } from './punkty.js';
import { bogZNicku, BOGOWIE } from './jaja.js';

export const KLUCZ_ODKRYC = 'krolSzamanow.odkrycia.v1';
const MAX_HISTORII = 400;
const MAX_PIESNI = 64;
const MAX_N = 1e9;
// Węzeł strzela co klatkę, póki trwa. Nowy PRZEJAW = przerwa dłuższa niż ta
// (jak przerwaMs serii w REAKCJE); do historii mitów wpis najwyżej co ODSTEP.
const PRZERWA_WEZLA_MS = 1500;
const ODSTEP_WEZLA_MS = 250;

const ID = {
    pieczec: new Set(PIECZECIE),
    technika: new Set(TECHNIKI.map(t => t.id)),
    wezel: new Set(WEZLY.map(w => w.id)),
    kamien: new Set(KAMIENIE.map(k => k.id))
};
const SEKCJA = { pieczec: 'pieczecie', technika: 'techniki', wezel: 'wezly', kamien: 'kamienie' };
const NAZWY = {
    pieczec: NAZWY_PIECZECI,
    technika: Object.fromEntries(TECHNIKI.map(t => [t.id, t.nazwa])),
    wezel: Object.fromEntries(WEZLY.map(w => [w.id, w.nazwa])),
    kamien: Object.fromEntries(KAMIENIE.map(k => [k.id, k.nazwa]))
};

/** Czytelna nazwa odkrycia albo '' dla nieznanego. */
export function nazwaOdkrycia(rodzaj, id) {
    return (Object.hasOwn(NAZWY, rodzaj) && Object.hasOwn(NAZWY[rodzaj], id)) ? NAZWY[rodzaj][id] : '';
}

const liczbaOk = (v) => typeof v === 'number' && Number.isFinite(v);

function walidujSekcje(obj, dozwolone, zLicznikiem) {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    // Iterujemy po ZNANYCH id - `__proto__` ani usunięta technika nie mają jak wejść.
    for (const id of dozwolone) {
        const w = Object.hasOwn(obj, id) ? obj[id] : null;
        if (!w || typeof w !== 'object' || !liczbaOk(w.t)) continue;
        if (!zLicznikiem) { out[id] = { t: w.t }; continue; }
        if (!liczbaOk(w.n) || w.n < 0) continue;
        out[id] = { n: Math.min(MAX_N, Math.floor(w.n)), t: w.t };
    }
    return out;
}

const napisy = (a, max, filtr = () => true) => (Array.isArray(a)
    ? [...new Set(a.filter(s => typeof s === 'string' && s.length > 0 && s.length <= 200 && filtr(s)))].slice(0, max)
    : []);

/** @returns {object|null} oczyszczony stan albo null, gdy to w ogóle nie obiekt */
export function walidujOdkrycia(dane) {
    if (!dane || typeof dane !== 'object' || Array.isArray(dane)) return null;
    const l = dane.liczniki && typeof dane.liczniki === 'object' ? dane.liczniki : {};
    return {
        pieczecie: walidujSekcje(dane.pieczecie, ID.pieczec, true),
        techniki: walidujSekcje(dane.techniki, ID.technika, true),
        wezly: walidujSekcje(dane.wezly, ID.wezel, true),
        kamienie: walidujSekcje(dane.kamienie, ID.kamien, false),
        liczniki: {
            rundy: liczbaOk(l.rundy) && l.rundy >= 0 ? Math.min(MAX_N, Math.floor(l.rundy)) : 0,
            piesni: napisy(l.piesni, MAX_PIESNI),
            bogowie: napisy(l.bogowie, BOGOWIE.length, s => BOGOWIE.includes(s))
        },
        obejrzane: napisy(dane.obejrzane, 200, (s) => {
            const [r, id] = s.split(':');
            return Object.hasOwn(ID, r) && ID[r].has(id);
        })
    };
}

const pusty = () => walidujOdkrycia({});

export class Odkrycia {
    /**
     * @param {{getItem:Function, setItem:Function}|null} [pamiec]
     * @param {{zegar?: () => Date}} [opcje]  zegar wstrzykiwany do testów pór dnia
     */
    constructor(pamiec = null, { zegar = () => new Date() } = {}) {
        this._pamiec = pamiec ?? null;
        this._zegar = zegar;
        this.trwala = false;
        this._brudne = false;
        this.manifest = [];
        this.historia = [];            // [{rodzaj, id, t}] - zdarzenia na żywo do mitów (performance.now)
        this.splotSeria = 0;           // ile spleceń pod rząd (Trójsplot = 2)
        this._historiaPieczeci = [];   // [{id, t}] - do ogonów technik
        this._poprzedniOgon = null;    // {id, t:Set}
        this._wezelOstatnio = {};
        this._wezelWpis = {};
        this._ustaw(pusty());
        this._wczytaj();
    }

    _ustaw(d) {
        this.pieczecie = d.pieczecie;
        this.techniki = d.techniki;
        this.wezly = d.wezly;
        this.kamienie = d.kamienie;
        this.liczniki = d.liczniki;
        this.obejrzane = new Set(d.obejrzane);
    }

    _wczytaj() {
        if (!this._pamiec) return;
        let surowe;
        try {
            surowe = this._pamiec.getItem(KLUCZ_ODKRYC);
            this.trwala = true;
        } catch {
            return;   // pamięć niedostępna: Pamięć działa w procesie
        }
        if (!surowe) return;
        let d = null;
        try { d = walidujOdkrycia(JSON.parse(surowe)); } catch { d = null; }
        if (d) this._ustaw(d);   // zepsuty JSON: od zera, kolejny zapis go nadpisze
    }

    _dane() {
        return {
            wersja: 1, pieczecie: this.pieczecie, techniki: this.techniki, wezly: this.wezly,
            kamienie: this.kamienie, liczniki: this.liczniki, obejrzane: [...this.obejrzane]
        };
    }

    zapiszJesliTrzeba() {
        if (!this._brudne) return;
        this._brudne = false;
        if (!this._pamiec || !this.trwala) return;   // po pierwszej awarii nie męczymy pamięci
        try {
            this._pamiec.setItem(KLUCZ_ODKRYC, JSON.stringify(this._dane()));
        } catch {
            this.trwala = false;
        }
    }

    _teraz() {
        const d = this._zegar();
        return d instanceof Date && Number.isFinite(d.getTime()) ? d : new Date(0);
    }

    _odkryj(rodzaj, id, nowe) {
        const s = this[SEKCJA[rodzaj]];
        this._brudne = true;
        if (s[id]) { s[id].n = Math.min(MAX_N, s[id].n + 1); return; }
        s[id] = { n: 1, t: this._teraz().getTime() };
        nowe.push({ rodzaj, id });
    }

    _wHistorii(rodzaj, id, now) {
        this.historia.push({ rodzaj, id, t: now });
        const od = now - OKNO_HISTORII_MS;
        while (this.historia.length && (this.historia[0].t < od || this.historia.length > MAX_HISTORII)) this.historia.shift();
    }

    /** Sprawdza kamienie dla danego zdarzenia; nowe odblokowanie = zapis od razu. */
    _zamknij(nowe, kiedy, now, extra = {}) {
        const ctx = { teraz: this._teraz(), now, ...extra };
        for (const k of KAMIENIE) {
            if (this.kamienie[k.id] || (k.kiedy !== kiedy && k.kiedy !== 'zawsze')) continue;
            let tak = false;
            try { tak = k.warunek(this, ctx) === true; } catch { tak = false; }
            if (!tak) continue;
            this.kamienie[k.id] = { t: ctx.teraz.getTime() };
            nowe.push({ rodzaj: 'kamien', id: k.id });
        }
        if (nowe.length) { this._brudne = true; this.zapiszJesliTrzeba(); }
        return nowe;
    }

    pieczec(id, now) {
        if (!ID.pieczec.has(id) || !liczbaOk(now)) return [];
        const nowe = [];
        this._historiaPieczeci.push({ id, t: now });
        if (this._historiaPieczeci.length > 16) this._historiaPieczeci.shift();
        this._odkryj('pieczec', id, nowe);
        this._wHistorii('pieczec', id, now);
        return this._zamknij(nowe, 'zywo', now);
    }

    /** Wołać PO pieczec() tej samej pieczęci (ogon musi ją już zawierać) - jak w punkty.js. */
    technika(kombo, now) {
        const id = kombo?.id;
        if (!ID.technika.has(id) || !liczbaOk(now) || !Array.isArray(kombo.sekwencja)) return [];
        const ogon = ogonPieczeci(this._historiaPieczeci, kombo.sekwencja.length);
        const naklada = ogonyNakladajaSie(ogon, this._poprzedniOgon?.t);
        const trzymanie = naklada && this._poprzedniOgon.id === id;
        this._poprzedniOgon = { id, t: ogon };
        // TRZYMANIE JEDNEJ POZY: ta sama technika z ogonem dzielącym pieczęć z poprzednią
        // to to samo wejście, nie nowe użycie (ta sama reguła co w punkty.js).
        if (trzymanie) return [];
        this.splotSeria = naklada ? this.splotSeria + 1 : 0;
        const nowe = [];
        this._odkryj('technika', id, nowe);
        this._wHistorii('technika', id, now);
        return this._zamknij(nowe, 'zywo', now);
    }

    /** n = jednostki reakcji z tej klatki (te same liczby, które dostaje punkty.reakcja). */
    reakcja(id, n, now) {
        if (!ID.wezel.has(id) || !liczbaOk(n) || n <= 0 || !liczbaOk(now)) return [];
        const ost = this._wezelOstatnio[id];
        const wpis = this._wezelWpis[id];
        this._wezelOstatnio[id] = now;
        const nowe = [];
        if (ost === undefined || now - ost > PRZERWA_WEZLA_MS) this._odkryj('wezel', id, nowe);
        else if (wpis !== undefined && now - wpis < ODSTEP_WEZLA_MS) return [];
        this._wezelWpis[id] = now;
        this._wHistorii('wezel', id, now);
        return this._zamknij(nowe, 'zywo', now);
    }

    ustawManifest(pliki) {
        this.manifest = Array.isArray(pliki) ? pliki.filter(p => typeof p === 'string' && p.length > 0) : [];
    }

    /**
     * Runda dokończona do Kroniki (NIE Esc). `piesn` = plik pieśni Obrzędu albo null;
     * liczy się tylko pieśń z manifestu (własne i YouTube nie przesuwają celu).
     */
    koniecRundy(pods, { wynikKsiegi = null, piesn = null } = {}) {
        if (!pods || typeof pods !== 'object') return [];
        this.liczniki.rundy = Math.min(MAX_N, this.liczniki.rundy + 1);
        if (typeof piesn === 'string' && this.manifest.includes(piesn)
            && !this.liczniki.piesni.includes(piesn) && this.liczniki.piesni.length < MAX_PIESNI) {
            this.liczniki.piesni.push(piesn);
        }
        this._brudne = true;
        const nowe = this._zamknij([], 'runda', null, { pods, wynikKsiegi });
        this.zapiszJesliTrzeba();
        return nowe;
    }

    nick(nick) {
        const bog = bogZNicku(nick);
        if (!bog) return [];
        if (!this.liczniki.bogowie.includes(bog)) { this.liczniki.bogowie.push(bog); this._brudne = true; }
        const nowe = this._zamknij([], 'nick', null);
        this.zapiszJesliTrzeba();
        return nowe;
    }

    ma(rodzaj, id) { return Object.hasOwn(SEKCJA, rodzaj) && !!this[SEKCJA[rodzaj]][id]; }
    czyNowe(rodzaj, id) { return this.ma(rodzaj, id) && !this.obejrzane.has(`${rodzaj}:${id}`); }
    ileNowych(rodzaj) {
        if (!Object.hasOwn(SEKCJA, rodzaj)) return 0;
        return Object.keys(this[SEKCJA[rodzaj]]).filter(id => this.czyNowe(rodzaj, id)).length;
    }
    oznaczObejrzane(rodzaj, id) {
        if (!this.czyNowe(rodzaj, id)) return;
        this.obejrzane.add(`${rodzaj}:${id}`);
        this._brudne = true;
        this.zapiszJesliTrzeba();
    }

    postep() {
        const p = (rodzaj) => ({ ile: Object.keys(this[SEKCJA[rodzaj]]).length, z: ID[rodzaj].size });
        return { pieczecie: p('pieczec'), techniki: p('technika'), wezly: p('wezel'), kamienie: p('kamien') };
    }

    eksportFragment() { return JSON.parse(JSON.stringify(this._dane())); }

    /** Import SCALA: suma zbiorów, max liczników, najwcześniejsza data. Nigdy nie nadpisuje. */
    scal(dane) {
        const d = walidujOdkrycia(dane);
        if (!d) return { ok: false, dodano: 0 };
        let dodano = 0;
        for (const s of ['pieczecie', 'techniki', 'wezly', 'kamienie']) {
            for (const [id, w] of Object.entries(d[s])) {
                const m = this[s][id];
                if (!m) { this[s][id] = { ...w }; dodano++; continue; }
                if ('n' in w) m.n = Math.max(m.n, w.n);
                m.t = Math.min(m.t, w.t);
            }
        }
        this.liczniki.rundy = Math.max(this.liczniki.rundy, d.liczniki.rundy);
        this.liczniki.piesni = [...new Set([...this.liczniki.piesni, ...d.liczniki.piesni])].slice(0, MAX_PIESNI);
        this.liczniki.bogowie = [...new Set([...this.liczniki.bogowie, ...d.liczniki.bogowie])];
        for (const o of d.obejrzane) this.obejrzane.add(o);
        this._brudne = true;
        this.zapiszJesliTrzeba();
        return { ok: true, dodano };
    }
}
