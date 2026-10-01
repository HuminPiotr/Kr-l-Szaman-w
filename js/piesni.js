/**
 * Pieśni - manifest, ścieżki, odtwarzanie przez magistralę audio.
 * Spec: docs/superpowers/specs/2026-10-01-tryby-design.md
 *
 * PIEŚŃ NIGDY NIE JEST BŁĘDEM (GEMINI.md §2). Brak pliku, zły JSON, autoplay
 * odrzucony, brak metadanych - każda awaria kończy się { ok:false } albo
 * pustą listą, a main.js mówi "Duchy zgubiły pieśń" i gra dalej jak próba.
 * Żadna funkcja tego modułu nie odrzuca obietnicy i nie rzuca do wołającego.
 */
export const KATALOG_MUZYKI = 'assets/muzyka/';
const LIMIT_ZALADOWANIA_MS = 8000;

/** Nazwy plików mają spacje i polskie znaki ("Ogien w zyłach.m4a") - kodujemy. */
export function sciezkaPliku(plik) {
    return KATALOG_MUZYKI + encodeURIComponent(plik);
}

const tekst = (v, domyslny = '') => (typeof v === 'string' && v.trim() ? v.trim() : domyslny);

/**
 * Manifest to dane z dysku, nie kod - odrzucamy wszystko, co nie wygląda jak
 * plik z TEGO katalogu (bez ../, bez podkatalogów) i uzupełniamy brakujące pola.
 * @returns {{plik:string, tytul:string, autor:string, licencja:string}[]}
 */
export function walidujManifest(dane) {
    if (!Array.isArray(dane)) return [];
    const out = [];
    for (const w of dane) {
        const plik = tekst(w?.plik);
        if (!plik || /[\\/]/.test(plik) || plik.includes('..')) continue;
        out.push({
            plik,
            tytul: tekst(w.tytul, plik.replace(/\.[^.]+$/, '')),
            autor: tekst(w.autor),
            licencja: tekst(w.licencja),
            // Długość z manifestu tylko do WYŚWIETLENIA w menu; prawdziwą, autorytatywną
            // długość rundy daje audio.duration po załadowaniu (Piesn.zaladuj).
            dlugoscS: typeof w.dlugoscS === 'number' && Number.isFinite(w.dlugoscS) && w.dlugoscS > 0 ? w.dlugoscS : 0
        });
    }
    return out;
}

/** @returns {Promise<ReturnType<typeof walidujManifest>>} pusta lista przy każdej awarii */
export async function wczytajManifest(fetchFn = (...a) => fetch(...a)) {
    try {
        const r = await fetchFn(KATALOG_MUZYKI + 'utwory.json');
        if (!r?.ok) return [];
        return walidujManifest(await r.json());
    } catch {
        return [];
    }
}

export class Piesn {
    /**
     * @param {{plik:string}} utwor
     * @param {{audioFabryka?:()=>HTMLAudioElement, magistrala?:(audio)=>({glosnosc,odlacz}|null), limitMs?:number}} [opcje]
     *   audioFabryka / magistrala wstrzykiwane w testach; magistrala w grze = audioEngine.podlaczPiesn
     */
    constructor(utwor, { audioFabryka = () => new Audio(), magistrala = null, limitMs = LIMIT_ZALADOWANIA_MS } = {}) {
        this.utwor = utwor;
        this._fabryka = audioFabryka;
        this._magistrala = magistrala;
        this._limitMs = limitMs;
        this._audio = null;
        this._uchwyt = null;
        this._naKoniec = null;
        this._zaladowana = false;
    }

    /** @returns {Promise<{ok:boolean, dlugoscS:number}>} nigdy nie odrzuca */
    zaladuj() {
        return new Promise((resolve) => {
            let audio;
            try {
                audio = this._fabryka();
                this._audio = audio;
            } catch {
                resolve({ ok: false, dlugoscS: 0 });
                return;
            }
            let koniec = false;
            const zakoncz = (wynik) => {
                if (koniec) return;
                koniec = true;
                clearTimeout(timer);
                audio.removeEventListener?.('loadedmetadata', naMeta);
                audio.removeEventListener?.('error', naBlad);
                resolve(wynik);
            };
            const naMeta = () => {
                const d = audio.duration;
                // Strumień/uszkodzony plik: duration = Infinity/NaN - nie da się zaplanować rundy.
                if (Number.isFinite(d) && d > 0) { this._zaladowana = true; zakoncz({ ok: true, dlugoscS: d }); }
                else zakoncz({ ok: false, dlugoscS: 0 });
            };
            const naBlad = () => zakoncz({ ok: false, dlugoscS: 0 });
            const timer = setTimeout(() => zakoncz({ ok: false, dlugoscS: 0 }), this._limitMs);
            try {
                audio.addEventListener('loadedmetadata', naMeta);
                audio.addEventListener('error', naBlad);
                audio.addEventListener('ended', () => this._koniecPiesni());
                audio.preload = 'auto';
                audio.src = sciezkaPliku(this.utwor.plik);
                audio.load?.();
            } catch {
                zakoncz({ ok: false, dlugoscS: 0 });
            }
        });
    }

    /** @returns {Promise<boolean>} false = autoplay odrzucony / niezaładowana - runda gra dalej bez pieśni */
    async graj() {
        if (!this._audio || !this._zaladowana) return false;
        try {
            // Magistrala (Web Audio) dopiero przy graniu: createMediaElementSource
            // można wywołać raz na element, a przed init() audioEngine zwraca null.
            this._uchwyt ??= this._magistrala?.(this._audio) ?? null;
            await this._audio.play();
            return true;
        } catch {
            return false;
        }
    }

    /** Jednorazowe wywołanie przy `ended` (podwójne zdarzenie nie dubluje końca rundy). */
    naKoniec(cb) { this._naKoniec = typeof cb === 'function' ? cb : null; }

    _koniecPiesni() {
        const cb = this._naKoniec;
        this._naKoniec = null;
        cb?.();
    }

    /** Zanik głośności - przez gain magistrali, a gdy jej nie ma, przez audio.volume. */
    zanik(sekundy) {
        const t = Number.isFinite(sekundy) && sekundy > 0 ? sekundy : 0;
        if (this._uchwyt) this._uchwyt.glosnosc(0, t);
        else if (this._audio) this._audio.volume = 0;
    }

    zatrzymaj() {
        try { this._audio?.pause(); } catch { /* element mógł zniknąć - nic do zatrzymania */ }
        this._uchwyt?.odlacz();
        this._uchwyt = null;
        this._naKoniec = null;
    }
}
