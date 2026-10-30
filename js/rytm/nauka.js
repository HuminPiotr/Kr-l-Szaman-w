/**
 * Nauka rytmu pieśni z YouTube (spec 2026-10-30-sluch-design.md). Czysta logika.
 *
 * Gdy pieśń z YouTube gra w rundzie, słuch (mikrofon) słyszy jej uderzenia w zegarze
 * pokoju. Odtwarzacz podaje swój czas (getCurrentTime). W chwili każdego nowego
 * uderzenia słuchu zapisujemy, gdzie było w czasie ODTWARZACZA:
 *     tYt(uderzenia) = tYt(teraz) - (tSłuchu(teraz) - tSłuchu(uderzenia))
 * Po rundzie z uderzeń powstaje rytm w formacie manifestu (bpm, pierwszeUderzenieS,
 * uderzenia) - przy następnym graniu gra zna go jak pieśni z pliku, bez mikrofonu,
 * także na słuchawkach.
 *
 * Reklamy / przewijanie: różnica zegarów (odtwarzacz - słuch) jest stała, gdy pieśń
 * gra normalnie. Skok różnicy = coś przerwało pieśń; uderzenia z niespójnego
 * fragmentu odrzucamy.
 */
import { walidujRytm } from '../piesni.js';

// ZGADNIĘTE - stroić po pierwszych nauczonych pieśniach.
export const NASTAWY_NAUKI = {
    MIN_POKRYCIE: 0.6,          // tyle pieśni musi być usłyszane z pewnym rytmem, żeby zapisać
    SKOK_ZEGARA_S: 0.25,        // większa zmiana różnicy zegarów = przewinięcie / reklama
    SKLEJ_DO: 0.3,              // uderzenia bliżej niż 0.3 okresu to te same (łączenie wersji)
    MAX_DZIURA_OKRESOW: 16      // dłuższej dziury nie zgadujemy - siatka przedłuży średnim okresem
};
const N = NASTAWY_NAUKI;

const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

export class NaukaRytmu {
    constructor() {
        this._uderzenia = [];   // czasy w zegarze odtwarzacza
        this._roznica = null;   // tYt - tSłuchu, wygładzona
        this._ostatniIndeks = null;
    }

    get liczba() { return this._uderzenia.length; }

    /**
     * Co klatkę podczas rundy z pieśnią YouTube.
     * @param {{siatka:object, pewny:boolean, czasS:number|null}|null} sluch  Sluch.rytm
     * @param {number|null} czasYt  getCurrentTime() odtwarzacza (null w pauzie / reklamie)
     */
    update(sluch, czasYt) {
        const tS = sluch?.czasS;
        if (!sluch?.pewny || !sluch.siatka || !Number.isFinite(tS) || !Number.isFinite(czasYt)) { this._ostatniIndeks = null; return; }
        const roznica = czasYt - tS;
        if (this._roznica !== null && Math.abs(roznica - this._roznica) > N.SKOK_ZEGARA_S) {
            // Przewinięcie albo reklama - od tej chwili nowa różnica; bieżące uderzenie pomijamy.
            this._roznica = roznica; this._ostatniIndeks = null; return;
        }
        this._roznica = this._roznica === null ? roznica : this._roznica + 0.05 * (roznica - this._roznica);
        const f = sluch.siatka.faza(tS);
        if (!f) return;
        if (this._ostatniIndeks !== null && f.indeks !== this._ostatniIndeks) {
            const tUderzeniaSluch = tS - f.faza01 * f.okresS;
            this._uderzenia.push(tUderzeniaSluch + this._roznica);
        }
        this._ostatniIndeks = f.indeks;
    }

    /**
     * @param {number} dlugoscS  długość pieśni
     * @param {object|null} poprzedni  wcześniej nauczony rytm tej pieśni (łączymy)
     * @returns {{rytm:object, pokrycie:number} | null}  null = za mało usłyszane (nic nie zapisujemy)
     */
    wynik(dlugoscS, poprzedni = null) {
        const nowe = uporzadkuj(this._uderzenia);
        const stare = walidujRytm(poprzedni)?.uderzenia ?? [];
        const razem = sklej(nowe, stare);
        if (razem.length < 8 || !(dlugoscS > 0)) return null;
        const okres = mediana(razem.slice(1).map((t, i) => t - razem[i]));
        const pelne = uzupelnij(razem, okres);
        const pokrycie = Math.min(1, (pelne[pelne.length - 1] - pelne[0]) / dlugoscS);
        if (pokrycie < N.MIN_POKRYCIE) return null;
        const r3 = (v) => Math.round(v * 1000) / 1000;
        const rytm = walidujRytm({ wersja: 1, bpm: r3(60 / okres), pierwszeUderzenieS: r3(pelne[0]), uderzenia: pelne.map(r3) });
        return rytm ? { rytm, pokrycie } : null;
    }
}

/** Rosnąco, bez ujemnych i bez dubli (bliżej niż 0.1 s). */
function uporzadkuj(t) {
    const s = t.filter(x => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
    return s.filter((x, i) => i === 0 || x - s[i - 1] > 0.1);
}

/** Łączy dwie listy: bliskie uderzenia uśrednione, reszta dołożona. */
function sklej(a, b) {
    if (!b.length) return a;
    if (!a.length) return b;
    const wszystkie = [...a, ...b].sort((x, y) => x - y);
    const okres = mediana(wszystkie.slice(1).map((t, i) => t - wszystkie[i]).filter(d => d > 0.15)) || 0.5;
    const out = [];
    for (const t of wszystkie) {
        const ost = out[out.length - 1];
        if (ost && t - ost.t < N.SKLEJ_DO * okres) { ost.t = (ost.t * ost.n + t) / (ost.n + 1); ost.n++; }
        else out.push({ t, n: 1 });
    }
    return out.map(o => o.t);
}

/** Dziury (słuch chwilę nie był pewny) wypełnione równo; bardzo długich nie zgadujemy. */
function uzupelnij(t, okres) {
    const out = [t[0]];
    for (let i = 1; i < t.length; i++) {
        const d = t[i] - t[i - 1];
        const ile = Math.round(d / okres);
        if (ile > 1 && ile <= N.MAX_DZIURA_OKRESOW) for (let k = 1; k < ile; k++) out.push(t[i - 1] + (d * k) / ile);
        out.push(t[i]);
    }
    return out;
}

// --- Magazyn nauczonych rytmów (localStorage, per film) ---

export const KLUCZ_NAUCZONYCH = 'krolSzamanow.nauczoneRytmy';

export class NauczonePiesni {
    /** @param {Storage|null} [magazyn] */
    constructor(magazyn = globalThis.localStorage ?? null) { this._m = magazyn; }

    _wszystkie() {
        try {
            const d = JSON.parse(this._m?.getItem(KLUCZ_NAUCZONYCH) ?? '{}');
            return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
        } catch { return {}; }
    }

    /** @returns {object|null} zwalidowany rytm albo null */
    rytm(ytId) {
        if (typeof ytId !== 'string' || !ytId) return null;
        return walidujRytm(this._wszystkie()[ytId]?.rytm);
    }

    zapisz(ytId, rytm, pokrycie) {
        if (typeof ytId !== 'string' || !ytId || !walidujRytm(rytm)) return false;
        const d = this._wszystkie();
        d[ytId] = { rytm, pokrycie, nauczono: new Date().toISOString() };
        try { this._m?.setItem(KLUCZ_NAUCZONYCH, JSON.stringify(d)); return true; } catch { return false; }
    }

    /** Wszystkie (do eksportu Księgi). */
    eksport() { return this._wszystkie(); }

    /** Import: tylko poprawne rytmy, istniejące wpisy nadpisane importem. @returns {number} ile przyjęto */
    importuj(dane) {
        if (!dane || typeof dane !== 'object') return 0;
        const d = this._wszystkie();
        let ile = 0;
        for (const [id, w] of Object.entries(dane)) {
            const r = walidujRytm(w?.rytm);
            if (typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id) && r) { d[id] = { ...w, rytm: r }; ile++; }
        }
        try { this._m?.setItem(KLUCZ_NAUCZONYCH, JSON.stringify(d)); } catch { return 0; }
        return ile;
    }
}
