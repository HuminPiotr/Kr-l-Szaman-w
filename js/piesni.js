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
                audio.src = this.utwor.url ?? sciezkaPliku(this.utwor.plik);
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

const ID_YT = /^[A-Za-z0-9_-]{11}$/;

/** Link (watch, youtu.be, shorts, embed, music) albo gołe ID -> ID filmu; null = nie wygląda na YouTube. */
export function wyciagnijIdYoutube(tekst) {
    const t = typeof tekst === 'string' ? tekst.trim() : '';
    if (!t) return null;
    if (ID_YT.test(t)) return t;
    let u;
    try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch { return null; }
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/);
        id = m ? m[1] : u.searchParams.get('v');
    }
    return id && ID_YT.test(id) ? id : null;
}

/** Plik własny gracza (File) -> utwór; null = to nie jest dźwięk. Bez url - ten dodaje pamięć. */
export function utworZPliku(file) {
    if (!file || typeof file.name !== 'string' || !file.name) return null;
    const typ = typeof file.type === 'string' ? file.type : '';
    const rozszerzenie = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|mp4|weba)$/i.test(file.name);
    if (!/^(audio|video)\//.test(typ) && !rozszerzenie) return null;
    return {
        plik: 'wlasna:' + file.name.slice(0, 80),
        tytul: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
        autor: 'Własna pieśń gracza', licencja: '', dlugoscS: 0, zrodlo: 'plik'
    };
}

export function utworYoutube(ytId, tytul = '', dlugoscS = 0) {
    return {
        plik: 'yt:' + ytId, ytId, tytul: tytul || 'Pieśń z YouTube',
        autor: 'YouTube', licencja: '', dlugoscS: dlugoscS > 0 ? dlugoscS : 0, zrodlo: 'yt'
    };
}

let obietnicaApiYt = null;
/** Skrypt IFrame API wczytujemy raz na sesję; błąd sieci = null (nigdy odrzucenie). */
function wczytajApiYoutube(limitMs) {
    if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
    obietnicaApiYt ??= new Promise((resolve) => {
        const timer = setTimeout(() => { obietnicaApiYt = null; resolve(null); }, limitMs);
        const poprzedni = globalThis.onYouTubeIframeAPIReady;
        globalThis.onYouTubeIframeAPIReady = () => { clearTimeout(timer); try { poprzedni?.(); } catch { /* cudzy callback */ } resolve(globalThis.YT ?? null); };
        try {
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            s.onerror = () => { clearTimeout(timer); obietnicaApiYt = null; resolve(null); };
            document.head.appendChild(s);
        } catch { clearTimeout(timer); obietnicaApiYt = null; resolve(null); }
    });
    return obietnicaApiYt;
}

/**
 * Pieśń z YouTube - ten sam interfejs co Piesn. Odtwarzacz jest WIDOCZNY w rogu
 * (regulamin YouTube); dźwięk nie przechodzi przez magistralę audio gry, więc
 * wyciszenie (M) i zanik idą przez setVolume. Nigdy nie rzuca ani nie odrzuca.
 */
export class PiesnYoutube {
    constructor(utwor, { limitMs = LIMIT_ZALADOWANIA_MS, kontener = () => document.getElementById('yt-piesn'), wyciszona = () => false } = {}) {
        this.utwor = utwor;
        this._limitMs = limitMs;
        this._kontener = kontener;
        this._wyciszona = wyciszona;
        this._gracz = null;
        this._naKoniec = null;
        this._zaladowana = false;
        this._zanik = null;
        this.tytul = '';
    }

    async zaladuj() {
        try {
            const YT = await wczytajApiYoutube(this._limitMs);
            const kont = this._kontener();
            if (!YT?.Player || !kont) return { ok: false, dlugoscS: 0 };
            return await new Promise((resolve) => {
                let koniec = false;
                const zakoncz = (w) => { if (koniec) return; koniec = true; clearTimeout(timer); resolve(w); };
                const timer = setTimeout(() => zakoncz({ ok: false, dlugoscS: 0 }), this._limitMs);
                const cel = kont.ownerDocument.createElement('div');
                kont.replaceChildren(cel);
                try {
                    this._gracz = new YT.Player(cel, {
                        videoId: this.utwor.ytId, width: 200, height: 200,
                        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
                        events: {
                            onReady: (e) => {
                                try {
                                    const d = e.target.getDuration();
                                    this.tytul = e.target.getVideoData?.().title ?? '';
                                    if (Number.isFinite(d) && d > 0) { this._zaladowana = true; zakoncz({ ok: true, dlugoscS: d }); }
                                    else zakoncz({ ok: false, dlugoscS: 0 });
                                } catch { zakoncz({ ok: false, dlugoscS: 0 }); }
                            },
                            onError: () => zakoncz({ ok: false, dlugoscS: 0 }),
                            onStateChange: (e) => { if (e.data === 0) this._koniecPiesni(); }
                        }
                    });
                } catch { zakoncz({ ok: false, dlugoscS: 0 }); }
            });
        } catch {
            return { ok: false, dlugoscS: 0 };
        }
    }

    async graj() {
        if (!this._gracz || !this._zaladowana) return false;
        try {
            this._gracz.setVolume(this._wyciszona() ? 0 : 100);
            this._kontener()?.classList.remove('hidden');
            this._gracz.playVideo();
            return true;
        } catch { return false; }
    }

    wycisz(tak) { try { this._gracz?.setVolume(tak ? 0 : 100); } catch { /* gracz zniknął */ } }

    naKoniec(cb) { this._naKoniec = typeof cb === 'function' ? cb : null; }

    _koniecPiesni() {
        const cb = this._naKoniec;
        this._naKoniec = null;
        cb?.();
    }

    zanik(sekundy) {
        const t = Number.isFinite(sekundy) && sekundy > 0 ? sekundy : 0;
        clearInterval(this._zanik);
        if (!this._gracz) return;
        if (t === 0) { this.wycisz(true); return; }
        const kroki = 10; let i = 0;
        this._zanik = setInterval(() => {
            i++;
            try { this._gracz.setVolume(Math.round(100 * (1 - i / kroki))); } catch { /* gracz zniknął */ }
            if (i >= kroki) clearInterval(this._zanik);
        }, (t * 1000) / kroki);
    }

    zatrzymaj() {
        clearInterval(this._zanik);
        try { this._gracz?.destroy(); } catch { /* już zniszczony */ }
        this._gracz = null;
        this._naKoniec = null;
        try { const k = this._kontener(); k?.replaceChildren(); k?.classList.add('hidden'); } catch { /* brak DOM */ }
    }
}

/** Fabryka: właściwa klasa pieśni dla źródła utworu. */
export function utworzPiesn(utwor, opcje = {}) {
    return utwor?.zrodlo === 'yt' ? new PiesnYoutube(utwor, opcje.yt) : new Piesn(utwor, opcje);
}
