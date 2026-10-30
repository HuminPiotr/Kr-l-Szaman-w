/**
 * Słuch - mikrofon -> obwiednia -> śledzenie uderzeń (spec 2026-10-30-sluch-design.md).
 * Cienka warstwa Web Audio nad czystą logiką (obwiedniaNaZywo.js, sledzenieNaZywo.js).
 *
 * ZASADY (anty-cele specu):
 *  - mikrofon NIGDY do głośników: worklet podłączony do wyjścia tylko przez węzeł
 *    `_cisza` o głośności 0 (bez podłączenia przeglądarka nie przetwarza węzła),
 *  - dźwięk nie jest nigdzie zapisywany ani wysyłany - tylko liczby obwiedni w pamięci,
 *  - tłumienie echa / szumu / automatyczne wzmocnienie WYŁĄCZONE: tłumienie echa
 *    usuwa właśnie muzykę z głośników,
 *  - odmowa zgody, brak mikrofonu, brak AudioWorklet - słuch po prostu nie działa,
 *    bez wyjątku i bez komunikatu (GEMINI.md §2).
 *
 * Opóźnienie: próbka ma w AudioContext czas późniejszy niż chwila, w której dźwięk
 * dotarł do pokoju (bufor wejścia). czasS() = currentTime + opoznienieS, żeby uderzenia
 * słuchu i tyk aury trafiały w bęben, który gracz słyszy. Poprawka ręczna w nakładce D.
 */
import { ObwiedniaNaZywo } from './obwiedniaNaZywo.js';
import { SledzenieNaZywo } from './sledzenieNaZywo.js';

export const KLUCZ_OPOZNIENIA = 'krolSzamanow.sluchOpoznienieS';
export const OPOZNIENIE_DOMYSLNE_S = 0.03;   // ZGADNIĘTE - zmierzyć sesją S
export const WAGA_BASU_MIKROFONU = 0.5;      // ZGADNIĘTE - głośniki laptopa mają mało basu; stroić z sesji S

export class Sluch {
    /**
     * @param {{mediaDevices?: MediaDevices, magazyn?: Storage|null}} [opcje]  wstrzykiwane w testach
     */
    constructor({ mediaDevices = globalThis.navigator?.mediaDevices, magazyn = globalThis.localStorage ?? null } = {}) {
        this._media = mediaDevices;
        this._magazyn = magazyn;
        this.stan = 'wyłączony';      // 'wyłączony' | 'brak zgody' | 'brak mikrofonu' | 'słucha'
        this.sledzenie = new SledzenieNaZywo();
        this._obwiednia = null;
        this._ctx = null;
        this.opoznienieS = this._wczytajOpoznienie();
    }

    _wczytajOpoznienie() {
        try {
            const v = Number.parseFloat(this._magazyn?.getItem(KLUCZ_OPOZNIENIA));
            return Number.isFinite(v) && Math.abs(v) < 1 ? v : OPOZNIENIE_DOMYSLNE_S;
        } catch { return OPOZNIENIE_DOMYSLNE_S; }
    }

    /** Ręczna poprawka opóźnienia (nakładka D), zapamiętana. */
    przesunOpoznienie(o) {
        if (!Number.isFinite(o)) return;
        this.opoznienieS = Math.max(-0.5, Math.min(0.5, Math.round((this.opoznienieS + o) * 1000) / 1000));
        try { this._magazyn?.setItem(KLUCZ_OPOZNIENIA, String(this.opoznienieS)); } catch { /* prywatne okno */ }
    }

    /** @param {AudioContext} ctx  @returns {Promise<string>} stan - nigdy nie odrzuca */
    async start(ctx) {
        if (this.stan === 'słucha') return this.stan;
        if (!ctx || !this._media?.getUserMedia) { this.stan = 'brak mikrofonu'; return this.stan; }
        try {
            const strumien = await this._media.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
            await ctx.audioWorklet.addModule(new URL('./sluchWorklet.js?v=2026-10-30', import.meta.url));
            const zrodlo = ctx.createMediaStreamSource(strumien);
            const wezel = new AudioWorkletNode(ctx, 'sluch-procesor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
            this._cisza = ctx.createGain();
            this._cisza.gain.value = 0;              // wyjście workletu = cisza; mikrofon nigdy nie słychać
            zrodlo.connect(wezel);
            wezel.connect(this._cisza);
            this._cisza.connect(ctx.destination);    // tylko po to, żeby przeglądarka pchała dźwięk przez worklet
            const opoznWejscia = strumien.getAudioTracks?.()[0]?.getSettings?.().latency;
            if (Number.isFinite(opoznWejscia) && this._magazyn?.getItem?.(KLUCZ_OPOZNIENIA) == null) this.opoznienieS = opoznWejscia + 0.01;
            wezel.port.onmessage = (e) => this.przyjmij(e.data);
            this._ctx = ctx;
            this._strumien = strumien;
            this.stan = 'słucha';
        } catch (e) {
            this.stan = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'brak zgody' : 'brak mikrofonu';
        }
        return this.stan;
    }

    /** Paczka próbek z workletu (wydzielone - testowalne bez Web Audio). */
    przyjmij(d) {
        if (!d?.pcm || !(d.sr > 0)) return;
        if (!this._obwiednia || this._obwiednia.sr * this._obwiednia.dziel !== d.sr) {
            this._obwiednia = new ObwiedniaNaZywo(d.sr, { wagaBasu: WAGA_BASU_MIKROFONU });
        }
        const ramki = this._obwiednia.dodaj(d.pcm, d.t);
        this.ostatnieRamki = ramki;        // sesja nagraniowa S zapisuje obwiednię (liczby, nie dźwięk)
        this.sledzenie.dodaj(ramki);
    }

    /** Nowa pieśń / nowa runda - słuch uczy się rytmu od nowa. */
    zeruj() { this.sledzenie.zeruj(); }

    /** Czas słuchu "teraz" w zegarze uderzeń (AudioContext + opóźnienie wejścia). */
    czasS() {
        const t = this._ctx?.currentTime;
        return Number.isFinite(t) ? t + this.opoznienieS : null;
    }

    /** Źródło rytmu dla js/rytm/zrodlaRytmu.js. */
    get rytm() {
        if (this.stan !== 'słucha') return null;
        return { siatka: this.sledzenie.siatka, czasS: this.czasS(), pewny: this.sledzenie.pewny };
    }

    /** Krótki opis do nakładki D. */
    get opis() {
        if (this.stan !== 'słucha') return this.stan;
        const s = this.sledzenie;
        return `${s.pewny ? 'słyszy rytm' : 'słucha'} ${s.bpm ? s.bpm.toFixed(1) + ' BPM' : ''} pewność ${s.pewnosc.toFixed(2)} okresowość ${(s.okresowosc ?? 0).toFixed(2)} opóźn. ${(this.opoznienieS * 1000).toFixed(0)} ms`;
    }
}
