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

    /**
     * Warstwa DODATKOWA do playFireSFX, wyłącznie dla Gromu w Ziemię -
     * main.js woła obie metody naraz przy aktywacji. Dziś pojedyncza pieczęć
     * i najtrudniejszy combo w grze brzmią identycznie (ten sam playFireSFX
     * o innej wysokości) - to warstwuje głęboki, długi grzmot NA WIERZCHU
     * istniejącego dźwięku, zamiast go zastępować, żeby rodzina brzmieniowa
     * została spójna, a ten combo dostał coś więcej.
     *
     * Niższa częstotliwość startowa i wolniejszy spadek niż playFireSFX
     * (300-700→40 Hz w 0.6 s) - ma brzmieć jak uderzenie pioruna w ziemię,
     * nie kolejny "whoosh" o innej wysokości.
     */
    playGromSFX() {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        const gromOsc = this.audioCtx.createOscillator();
        const gromGain = this.audioCtx.createGain();

        gromOsc.type = 'square';
        gromOsc.frequency.setValueAtTime(90, now);
        gromOsc.frequency.exponentialRampToValueAtTime(28, now + 1.1);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, now);
        // Filtr otwiera się w pierwszej chwili (moment uderzenia), potem
        // przymyka - rumble po grzmocie, nie ostry trzask przez cały czas.
        filter.frequency.linearRampToValueAtTime(700, now + 0.05);
        filter.frequency.exponentialRampToValueAtTime(80, now + 1.1);

        gromGain.gain.setValueAtTime(0.001, now);
        gromGain.gain.exponentialRampToValueAtTime(0.3, now + 0.03);
        gromGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

        gromOsc.connect(filter);
        filter.connect(gromGain);
        gromGain.connect(this.audioCtx.destination);

        gromOsc.start();
        gromOsc.stop(now + 1.15);
    }

    /**
     * Kołowrót - domknięcie mitu Gromu w Ziemię. Świadomie NIE trzask
     * (playGromSFX) ani whoosh (playFireSFX): dwa lekko ROZSTROJONE
     * oscylatory sinusoidalne dają DUDNIENIE ("beating") jak prawdziwy
     * gong, ton WZNOSI SIĘ w czasie (odwrotność playGromSFX, który OPADA -
     * tam grzmot bije w dół, tu koło "nabiera obrotów"), a obwiednia trwa
     * ~2.6 s, dopasowana do CZAS_TRWANIA_PIERSCIEN w js/kolowrot.js.
     */
    playKolowrotSFX() {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const czasTrwania = 2.6;

        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(70, now);
        osc1.frequency.linearRampToValueAtTime(130, now + czasTrwania);
        // Rozstrojony o kilka Hz względem osc1 - RÓŻNICA częstotliwości
        // słyszalna jest jako powolne dudnienie, nie jako dwa czyste tony.
        osc2.frequency.setValueAtTime(74, now);
        osc2.frequency.linearRampToValueAtTime(136, now + czasTrwania);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.linearRampToValueAtTime(900, now + czasTrwania * 0.6);
        filter.frequency.exponentialRampToValueAtTime(150, now + czasTrwania);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.4);
        gain.gain.setValueAtTime(0.22, now + czasTrwania * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, now + czasTrwania);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(); osc2.start();
        osc1.stop(now + czasTrwania + 0.05);
        osc2.stop(now + czasTrwania + 0.05);
    }

    /**
     * Wybuch podpalonego dymu (Okadzenie, js/dym.js) - KRÓTKI trzask, w
     * przeciwieństwie do długiego grzmotu playGromSFX (1.1 s) i dudnienia
     * playKolowrotSFX (2.6 s). Front ognia może zapalić kilka kłębów w jednej
     * klatce (main.js sumuje `wybuchy` z Dym.updateAndDraw), więc `sila`
     * (zwykle liczba świeżych wybuchów, nie tylko 0..1) skaluje GŁOŚNOŚĆ
     * i odrobinę wysokość - kilka kłębów naraz ma brzmieć grubiej, nie tylko
     * głośniej, inaczej seria eksplozji zlewa się w nieodróżnialny szum.
     *
     * Szum biały (nie oscylator) + szybko zamykający się filtr - trzask, nie
     * ton. To jedyny dźwięk w grze budowany z szumu, nie z oscylatora,
     * celowo: eksplozja ma brzmieć chropowato, reszta gry (whoosh/grzmot/
     * gong) jest tonalna.
     */
    playWybuchSFX(sila = 1) {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const s = Number.isFinite(sila) ? Math.max(0.3, Math.min(3, sila)) : 1;

        const dlugoscBufora = Math.floor(this.audioCtx.sampleRate * 0.35);
        const buforSzumu = this.audioCtx.createBuffer(1, dlugoscBufora, this.audioCtx.sampleRate);
        const dane = buforSzumu.getChannelData(0);
        for (let i = 0; i < dlugoscBufora; i++) dane[i] = Math.random() * 2 - 1;

        const zrodlo = this.audioCtx.createBufferSource();
        zrodlo.buffer = buforSzumu;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400 + s * 200, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + 0.3);
        filter.Q.value = 0.7;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.min(0.4, 0.16 * s), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

        zrodlo.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        zrodlo.start();
        zrodlo.stop(now + 0.35);
    }

    /**
     * Wystrzał Aarda (Podmuch, js/podmuch.js) - "whoomp": pchnięcie
     * powietrza, nie trzask i nie whoosh. Do tej pory Podmuch odpalał
     * BEZ ŻADNEGO dźwięku - jedyna technika w grze, która milczała.
     *
     * Dwie warstwy: SZUM przez lowpass opadający z góry w dół (sprężone
     * powietrze, które ucieka - to samo tworzywo co playWybuchSFX, ale
     * szeroki lowpass zamiast wąskiego bandpassu, więc "dmuchnięcie", nie
     * "pęknięcie") plus SUB-TĄPNIĘCIE sinusem 60->35 Hz (masa uderzenia,
     * czuć bardziej niż słychać). Krótsze od grzmotu (1.1 s), dłuższe od
     * wybuchu (0.35 s) - w rytmie CZAS_FALI z js/ekran.js (0.6 s).
     *
     * @param {number} [sila] 0..1 - głośność i odrobinę wysokość (słaby podmuch = cichszy, nie wyższy)
     */
    playAardSFX(sila = 1) {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const s = Number.isFinite(sila) ? Math.max(0.15, Math.min(1, sila)) : 1;
        const czas = 0.55;

        // --- warstwa 1: szum sprężonego powietrza ---
        const dlugoscBufora = Math.floor(this.audioCtx.sampleRate * czas);
        const buforSzumu = this.audioCtx.createBuffer(1, dlugoscBufora, this.audioCtx.sampleRate);
        const dane = buforSzumu.getChannelData(0);
        for (let i = 0; i < dlugoscBufora; i++) dane[i] = Math.random() * 2 - 1;
        const szum = this.audioCtx.createBufferSource();
        szum.buffer = buforSzumu;

        const lowpass = this.audioCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.Q.value = 0.9;
        lowpass.frequency.setValueAtTime(500 + 500 * s, now);
        lowpass.frequency.exponentialRampToValueAtTime(70, now + czas * 0.7);

        const szumGain = this.audioCtx.createGain();
        szumGain.gain.setValueAtTime(0.0001, now);
        szumGain.gain.exponentialRampToValueAtTime(0.32 * s, now + 0.03);
        szumGain.gain.exponentialRampToValueAtTime(0.0001, now + czas);

        szum.connect(lowpass);
        lowpass.connect(szumGain);
        szumGain.connect(this.audioCtx.destination);

        // --- warstwa 2: sub-tąpnięcie ---
        const sub = this.audioCtx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(60, now);
        sub.frequency.exponentialRampToValueAtTime(35, now + 0.25);
        const subGain = this.audioCtx.createGain();
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.exponentialRampToValueAtTime(0.35 * s, now + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        sub.connect(subGain);
        subGain.connect(this.audioCtx.destination);

        szum.start(); sub.start();
        szum.stop(now + czas + 0.05);
        sub.stop(now + 0.35);
    }
}
