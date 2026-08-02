// --- Syntezator Web Audio API ---
// Przeniesione z main.js bez zmian w logice.
export class AudioEngine {
    constructor() {
        this.audioCtx = null;

        // Oscylator buczenia bazowego (sawtooth)
        this.humOsc = null;
        this.humGain = null;
        this.lpFilter = null;

        // Zmienne do efektu gotowości (niezrównoważony, wysoki dźwięk)
        this.readyOsc = null;
        this.readyGain = null;

        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            // 1. Bazowy hum (ładowanie kuli)
            this.humOsc = this.audioCtx.createOscillator();
            this.humOsc.type = 'sawtooth';
            this.humOsc.frequency.setValueAtTime(55, this.audioCtx.currentTime); // Bas A (55Hz)

            this.lpFilter = this.audioCtx.createBiquadFilter();
            this.lpFilter.type = 'lowpass';
            this.lpFilter.frequency.setValueAtTime(140, this.audioCtx.currentTime);

            this.humGain = this.audioCtx.createGain();
            this.humGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

            this.humOsc.connect(this.lpFilter);
            this.lpFilter.connect(this.humGain);
            this.humGain.connect(this.audioCtx.destination);
            this.humOsc.start();

            // 2. Oscylator READY (wysoki i lekko wibrujący)
            this.readyOsc = this.audioCtx.createOscillator();
            this.readyOsc.type = 'sine';
            this.readyOsc.frequency.setValueAtTime(440, this.audioCtx.currentTime);

            this.readyGain = this.audioCtx.createGain();
            this.readyGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

            // Modulator wibracji (Vibrato) dla stanu gotowości
            const vibrato = this.audioCtx.createOscillator();
            vibrato.frequency.value = 8; // 8Hz
            const vibratoGain = this.audioCtx.createGain();
            vibratoGain.gain.value = 15;

            vibrato.connect(vibratoGain);
            vibratoGain.connect(this.readyOsc.frequency);
            vibrato.start();

            this.readyOsc.connect(this.readyGain);
            this.readyGain.connect(this.audioCtx.destination);
            this.readyOsc.start();

            this.initialized = true;
        } catch (err) {
            console.error("Audio Engine error:", err);
        }
    }

    update(state, energy, efficiency) {
        if (!this.initialized || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        if (state === 'CHARGING') {
            // Hum rośnie z poziomem energii
            const targetFreq = 55 + energy * 110; // Przejście 55Hz -> 165Hz
            this.humOsc.frequency.setTargetAtTime(targetFreq, now, 0.15);

            const filterFreq = 140 + energy * 400; // Otwieranie filtra
            this.lpFilter.frequency.setTargetAtTime(filterFreq, now, 0.15);

            const targetVol = energy > 0.01 ? (0.02 + energy * 0.1) : 0;
            this.humGain.gain.setTargetAtTime(targetVol, now, 0.15);

            // Gotowość wyciszona
            this.readyGain.gain.setTargetAtTime(0, now, 0.1);
        } else if (state === 'READY') {
            // Basowy hum jest głośny i stabilny
            this.humOsc.frequency.setTargetAtTime(165, now, 0.1);
            this.lpFilter.frequency.setTargetAtTime(600, now, 0.1);
            this.humGain.gain.setTargetAtTime(0.12, now, 0.1);

            // Włączamy pulsujący dźwięk gotowości
            this.readyGain.gain.setTargetAtTime(0.04, now, 0.2);
            this.readyOsc.frequency.setTargetAtTime(440 + Math.sin(now * 10) * 10, now, 0.05);
        } else {
            // FIRING lub COOLDOWN - wyciszamy humm i gotowość
            this.humGain.gain.setTargetAtTime(0, now, 0.2);
            this.readyGain.gain.setTargetAtTime(0, now, 0.1);
        }
    }

    playFireSFX(energy) {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        // Dynamiczne wyładowanie za pomocą szybkiego spadku częstotliwości (laser/whoosh)
        const fireOsc = this.audioCtx.createOscillator();
        const fireGain = this.audioCtx.createGain();

        fireOsc.type = 'sawtooth';
        // Częstotliwość startowa zależy od zebranej energii
        const startFreq = 300 + energy * 400;
        fireOsc.frequency.setValueAtTime(startFreq, now);
        fireOsc.frequency.exponentialRampToValueAtTime(40, now + 0.6);

        // Filtr do zmatowienia dźwięku
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(startFreq * 1.5, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);

        fireGain.gain.setValueAtTime(0.25, now);
        fireGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        fireOsc.connect(filter);
        filter.connect(fireGain);
        fireGain.connect(this.audioCtx.destination);

        fireOsc.start();
        fireOsc.stop(now + 0.65);
    }
}
