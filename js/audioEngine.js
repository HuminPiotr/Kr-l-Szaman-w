// --- Magistrala audio gry ---
//
// GRA NIE MA EFEKTÓW DŹWIĘKOWYCH (decyzja właściciela, 2026-10-01): jedyny dźwięk to
// PIEŚNI rund (js/piesni.js). Dawny syntezator - szum bazowy zależny od mocy i płynności,
// dzwonki pieczęci, dźwięki technik, wybuchy dymu, tęcza, trzask Płonącego Palca - został
// usunięty razem z całym interfejsem (graj*/play*SFX/ustaw*/update) i wszystkimi miejscami,
// które go wołały. tools/test-brak-efektow-dzwiekowych.mjs pilnuje, żeby nie wrócił po cichu.
//
// Zostaje CIENKA MAGISTRALA, bo pieśń jej potrzebuje:
//   źródło pieśni -> gain pieśni -> masterGain -> DynamicsCompressor -> destination
//   * masterGain niesie WYCISZENIE (klawisz M, wskaźnik ♪ w rogu) - wycisza pieśń,
//   * kompresor daje sufit głośności (nie pozwala sumie przesterować),
//   * AudioContext tworzymy w geście użytkownika (kliknięcie "Rozpal ogień" w main.js,
//     przed jakimkolwiek await) - inaczej przeglądarka może odmówić.
//
// Osobny AudioContext ma jeszcze js/debugHud.js (sygnały sesji nagraniowej) - to narzędzie
// dewelopera, nie dźwięk gry.
export class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.compressor = null;

        // Wyciszenie - trwałe (localStorage), przeżywa przeładowanie strony.
        this._wyciszony = false;
        try { this._wyciszony = localStorage.getItem('krolSzamanow.wyciszony') === '1'; } catch { /* prywatne okno itp. - domyślnie odciszone */ }

        this.initialized = false;
    }

    get wyciszony() { return this._wyciszony; }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            // --- Magistrala: masterGain -> compressor -> destination ---
            this.compressor = this.audioCtx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-18, this.audioCtx.currentTime);
            this.compressor.knee.setValueAtTime(12, this.audioCtx.currentTime);
            this.compressor.ratio.setValueAtTime(4, this.audioCtx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime);
            this.compressor.connect(this.audioCtx.destination);

            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(this._wyciszony ? 0 : 0.8, this.audioCtx.currentTime);
            this.masterGain.connect(this.compressor);

            this.initialized = true;
        } catch (err) {
            console.error("Audio Engine error:", err);
        }
    }

    /** Wznawia zawieszony AudioContext - wołać w handlerze gestu użytkownika. */
    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    /** Wyciszenie magistrali (nie samego AudioContext) - trwałe, klawisz M w main.js. */
    przelaczWyciszenie() {
        this._wyciszony = !this._wyciszony;
        try { localStorage.setItem('krolSzamanow.wyciszony', this._wyciszony ? '1' : '0'); } catch { /* prywatne okno - nietrwałe, ale działa w tej sesji */ }
        if (this.masterGain && this.audioCtx) {
            this.masterGain.gain.setTargetAtTime(this._wyciszony ? 0 : 0.8, this.audioCtx.currentTime, 0.05);
        }
        return this._wyciszony;
    }

    /**
     * Pieśń rundy (js/piesni.js) przez magistralę:
     * źródło -> gain pieśni -> masterGain -> compressor -> destination.
     * Dzięki temu klawisz M wycisza pieśń, a kompresor pilnuje sufitu głośności.
     * createMediaElementSource wolno wywołać RAZ na element - Piesn tworzy nowy
     * <audio> na każdą rundę.
     *
     * @param {HTMLAudioElement} audioEl
     * @returns {{glosnosc:(v:number, czasS?:number)=>void, odlacz:()=>void}|null}
     *          null przed init() (brak kontekstu) - Piesn schodzi wtedy na audio.volume
     */
    podlaczPiesn(audioEl) {
        if (!this.initialized || !this.audioCtx || !this.masterGain) return null;
        let zrodlo, gain;
        try {
            zrodlo = this.audioCtx.createMediaElementSource(audioEl);
            gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(1, this.audioCtx.currentTime);
            zrodlo.connect(gain);
            gain.connect(this.masterGain);
        } catch (err) {
            console.error('Pieśń nie podłączona do magistrali:', err);
            return null;
        }
        let odlaczona = false;
        return {
            // setValueAtTime PRZED rampą - gain.value jest wartością bieżącą, rampa startuje od niej.
            glosnosc: (v, czasS = 0.05) => {
                if (odlaczona || !Number.isFinite(v)) return;
                const t = this.audioCtx.currentTime;
                const dl = Number.isFinite(czasS) && czasS > 0 ? czasS : 0.05;
                gain.gain.setValueAtTime(gain.gain.value, t);
                gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), t + dl);
            },
            odlacz: () => {
                if (odlaczona) return;
                odlaczona = true;
                try { zrodlo.disconnect(); gain.disconnect(); } catch { /* już rozłączone */ }
            }
        };
    }
}
