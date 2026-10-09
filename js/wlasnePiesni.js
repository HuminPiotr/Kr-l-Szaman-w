/**
 * Własne pieśni gracza - pamięć w przeglądarce (nic nie wychodzi z komputera).
 * Pliki: IndexedDB (bloby). Linki YouTube: localStorage. Wszystko w try/catch -
 * brak pamięci (prywatne okno) to nie błąd: pieśni żyją do zamknięcia karty
 * (`trwala = false`). Żadna metoda nie odrzuca obietnicy.
 */
import { utworYoutube } from './piesni.js';

const BAZA = 'krolSzamanow', SKLEP = 'piesni', KLUCZ_YT = 'krolSzamanow.piesniYt';
export const MAX_WLASNYCH = 20;

export class WlasnePiesni {
    /** @param {{indexedDB?:IDBFactory|null, storage?:Storage|null, tworzUrl?:(b:Blob)=>string, zwalniaUrl?:(u:string)=>void}} deps */
    constructor({ indexedDB = null, storage = null, tworzUrl = (b) => URL.createObjectURL(b), zwalniaUrl = (u) => URL.revokeObjectURL(u) } = {}) {
        this._idb = indexedDB;
        this._storage = storage;
        this._tworzUrl = tworzUrl;
        this._zwalniaUrl = zwalniaUrl;
        this._baza = null;
        this.trwala = !!indexedDB;
        this._pliki = new Map();   // plik -> {utwor, blob} (także gdy IndexedDB niedostępne)
        this._yt = [];
    }

    _otworz() {
        if (!this._idb) return Promise.resolve(null);
        this._baza ??= new Promise((resolve) => {
            try {
                const r = this._idb.open(BAZA, 1);
                r.onupgradeneeded = () => r.result.createObjectStore(SKLEP, { keyPath: 'plik' });
                r.onsuccess = () => resolve(r.result);
                r.onerror = r.onblocked = () => { this.trwala = false; resolve(null); };
            } catch { this.trwala = false; resolve(null); }
        });
        return this._baza;
    }

    async _tx(tryb, f) {
        const db = await this._otworz();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const t = db.transaction(SKLEP, tryb);
                const wynik = f(t.objectStore(SKLEP));
                t.oncomplete = () => resolve(wynik?.result ?? true);
                t.onerror = t.onabort = () => { this.trwala = false; resolve(null); };
            } catch { this.trwala = false; resolve(null); }
        });
    }

    _zapiszYt() {
        try { this._storage?.setItem(KLUCZ_YT, JSON.stringify(this._yt)); } catch { this.trwala = false; }
    }

    /** @returns {Promise<object[]>} utwory własne (pliki, potem YouTube) */
    async wczytaj() {
        try {
            const surowe = JSON.parse(this._storage?.getItem(KLUCZ_YT) ?? '[]');
            this._yt = (Array.isArray(surowe) ? surowe : []).filter(w => w && /^[A-Za-z0-9_-]{11}$/.test(w.ytId)).slice(0, MAX_WLASNYCH)
                .map(w => utworYoutube(w.ytId, typeof w.tytul === 'string' ? w.tytul.slice(0, 80) : '', Number(w.dlugoscS) || 0));
        } catch { this._yt = []; }
        const wpisy = await this._tx('readonly', (s) => s.getAll()) ;
        if (Array.isArray(wpisy)) {
            for (const w of wpisy) {
                if (!w?.blob || typeof w.plik !== 'string' || this._pliki.has(w.plik)) continue;
                this._pliki.set(w.plik, { utwor: { ...w.utwor, url: this._tworzUrl(w.blob) }, blob: w.blob });
            }
        }
        return this.lista();
    }

    lista() { return [...[...this._pliki.values()].map(p => p.utwor), ...this._yt]; }

    /** @returns {Promise<object|null>} utwór z url; null = limit własnych pieśni */
    async dodajPlik(utwor, blob) {
        if (!this._pliki.has(utwor.plik) && this.lista().length >= MAX_WLASNYCH) return null;
        const stary = this._pliki.get(utwor.plik);
        if (stary) this._zwalniaUrl(stary.utwor.url);
        const z = { ...utwor, url: this._tworzUrl(blob) };
        this._pliki.set(utwor.plik, { utwor: z, blob });
        const { url, ...doZapisu } = z;
        await this._tx('readwrite', (s) => s.put({ plik: z.plik, utwor: doZapisu, blob }));
        return z;
    }

    dodajYt(utwor) {
        if (!this._yt.some(u => u.ytId === utwor.ytId) && this.lista().length >= MAX_WLASNYCH) return null;
        this._yt = [...this._yt.filter(u => u.ytId !== utwor.ytId), utwor];
        this._zapiszYt();
        return utwor;
    }

    async usun(plik) {
        const p = this._pliki.get(plik);
        if (p) {
            this._zwalniaUrl(p.utwor.url);
            this._pliki.delete(plik);
            await this._tx('readwrite', (s) => s.delete(plik));
        } else if (this._yt.some(u => u.plik === plik)) {
            this._yt = this._yt.filter(u => u.plik !== plik);
            this._zapiszYt();
        }
    }
}
