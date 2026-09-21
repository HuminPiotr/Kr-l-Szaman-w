// --- Syntezator Web Audio API ---
//
// ================== P3 (2026-09-21): MAGISTRALA, SPRZĄTANIE, NOWE GŁOSY ==================
// Audyt (docs/superpowers - plan "cztery pakiety") znalazł cztery realne
// luki, nie tylko brakujące dźwięki:
//   1. KAŻDY głos łączył się WPROST do audioCtx.destination, bez sufitu -
//      Grom w Ziemię (fire+grom naraz) czy detonacja dymu w środku Gromu
//      mogły się zsumować powyżej 1.0 i przesterować. Teraz WSZYSTKO
//      przechodzi przez masterGain -> DynamicsCompressor -> destination.
//   2. init() był wołany PO await (getUserMedia, model MediaPipe) w main.js
//      - poza oknem gestu użytkownika, przeglądarka mogła odmówić
//      AudioContext. Teraz init()+resume() są PIERWSZYMI instrukcjami
//      handlera kliknięcia (main.js), przed jakimkolwiek await.
//   3. Bufor białego szumu (playWybuchSFX/playAardSFX) był generowany OD
//      NOWA przy KAŻDYM wywołaniu (createBuffer + wypełnienie
//      Math.random() w pętli) - teraz jeden bufor cache'owany w init(),
//      granych z losowego przesunięcia dla różnorodności.
//   4. Żaden węzeł nigdy nie był disconnect()owany - GC i tak je zbiera po
//      wygaśnięciu referencji, ale sprzatnij() jawnie odcina graf audio
//      na onended, więc martwe węzły nie wiszą w grafie między klatką
//      stop() a faktycznym GC.
//
// Gałąź READY/FIRING w update() była martwa (main.js woła TYLKO 'CHARGING'
// - patrz komentarz przy jedynym wywołaniu w main.js) - usunięta razem
// z readyOsc/readyGain/vibrato. Sygnatura update() straciła parametr
// `state` (był zawsze 'CHARGING'), efficiency (płynność) dostał REALNE
// brzmienie zamiast być ignorowany: drugi, cichszy głos hum, dostrojony
// o +7 centów, którego głośność rośnie z płynnością - "pełniej gdy
// tańczysz płynnie, chudziej gdy szarpiesz", NIGDY cisza (GEMINI.md §2).
export class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.compressor = null;

        // Oscylator buczenia bazowego (sawtooth) + drugi głos (płynność)
        this.humOsc = null;
        this.humGain = null;
        this.lpFilter = null;
        this.hum2Osc = null;
        this.hum2Gain = null;

        // Głos ciągły wypełniania pieczęci (js/pieczecie.js postep).
        this.skladanieOsc = null;
        this.skladanieGain = null;

        // Głos ciągły Tęczy (aktywna, ślad).
        this.teczaOsc1 = null;
        this.teczaOsc2 = null;
        this.teczaGain = null;
        this.teczaFilter = null;

        // Głos ciągły Płonącego Palca (trzask ognia).
        this.palecZrodlo = null;
        this.palecFilter = null;
        this.palecGain = null;

        this._buforSzumu = null;   // cache'owany, patrz init()

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

            // --- Magistrala: WSZYSTKO przez masterGain -> compressor -> destination ---
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

            // --- Bufor szumu, wypełniony RAZ (patrz nagłówek pliku, punkt 3) ---
            const dlugoscBufora = Math.floor(this.audioCtx.sampleRate * 2);
            this._buforSzumu = this.audioCtx.createBuffer(1, dlugoscBufora, this.audioCtx.sampleRate);
            const daneSzumu = this._buforSzumu.getChannelData(0);
            for (let i = 0; i < dlugoscBufora; i++) daneSzumu[i] = Math.random() * 2 - 1;

            // 1. Bazowy hum (ładowanie kuli)
            this.humOsc = this.audioCtx.createOscillator();
            this.humOsc.type = 'sawtooth';
            this.humOsc.frequency.setValueAtTime(55, this.audioCtx.currentTime);

            this.lpFilter = this.audioCtx.createBiquadFilter();
            this.lpFilter.type = 'lowpass';
            this.lpFilter.frequency.setValueAtTime(140, this.audioCtx.currentTime);

            this.humGain = this.audioCtx.createGain();
            this.humGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

            this.humOsc.connect(this.lpFilter);
            this.lpFilter.connect(this.humGain);
            this.humGain.connect(this.masterGain);
            this.humOsc.start();

            // 2. Drugi głos hum - odstrojony +7 centów, głośność = f(płynność).
            // Nigdy nie zastępuje pierwszego (GEMINI.md §2 - szarpany ruch nie
            // wycisza dźwięku do zera, tylko robi go CIEŃSZYM: ten głos znika).
            this.hum2Osc = this.audioCtx.createOscillator();
            this.hum2Osc.type = 'sawtooth';
            this.hum2Osc.frequency.setValueAtTime(55 * Math.pow(2, 7 / 1200), this.audioCtx.currentTime);
            this.hum2Gain = this.audioCtx.createGain();
            this.hum2Gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            this.hum2Osc.connect(this.hum2Gain);
            this.hum2Gain.connect(this.masterGain);
            this.hum2Osc.start();

            this.initialized = true;
        } catch (err) {
            console.error("Audio Engine error:", err);
        }
    }

    /** Wznawia zawieszony AudioContext - wołać w handlerze gestu (patrz nagłówek pliku, punkt 2). */
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
     * Odcina graf audio jednego głosu, gdy `zrodlo` (oscylator/BufferSource)
     * kończy grać - GC i tak by je zebrał po straceniu referencji, ale to
     * jawnie zwalnia węzły z grafu Web Audio od razu (patrz nagłówek pliku,
     * punkt 4), zamiast czekać na przypadkowy moment odśmiecania.
     * @param {AudioScheduledSourceNode} zrodlo
     * @param {AudioNode[]} wezly
     */
    _sprzatnij(zrodlo, wezly) {
        zrodlo.onended = () => { for (const w of wezly) { try { w.disconnect(); } catch { /* już odłączony */ } } };
    }

    /**
     * Ciągły stan gry: energia (moc, 0..1) i płynność ruchu (0..1).
     * Wołane RAZ NA KLATKĘ z main.js, niezależnie od tego, czy gracz coś
     * odpalił - to jest "oddech" gry w tle.
     */
    update(moc, plynnosc) {
        if (!this.initialized || !this.audioCtx) return;
        this.resume();
        const now = this.audioCtx.currentTime;
        const energy = Number.isFinite(moc) ? Math.max(0, Math.min(1, moc)) : 0;
        const plyn = Number.isFinite(plynnosc) ? Math.max(0, Math.min(1, plynnosc)) : 1;

        const targetFreq = 55 + energy * 110;
        this.humOsc.frequency.setTargetAtTime(targetFreq, now, 0.15);

        // Filtr się otwiera z energią I z płynnością - taniec płynny brzmi
        // JAŚNIEJ (więcej góry), szarpany ciemniej, ale NIGDY nie milknie.
        const filterFreq = 140 + energy * 400 + plyn * 120;
        this.lpFilter.frequency.setTargetAtTime(filterFreq, now, 0.15);

        const targetVol = energy > 0.01 ? (0.02 + energy * 0.1) : 0;
        this.humGain.gain.setTargetAtTime(targetVol, now, 0.15);

        // Drugi głos: ta sama obwiednia energii co pierwszy, ale skalowana
        // płynnością - przy szarpanym ruchu praktycznie znika (nie zeruje
        // się całkiem, "informuje, nie karze"), przy płynnym dogrywa pełnię.
        this.hum2Osc.frequency.setTargetAtTime(targetFreq * Math.pow(2, 7 / 1200), now, 0.15);
        const vol2 = energy > 0.01 ? (0.04 * (0.15 + 0.85 * plyn)) : 0;
        this.hum2Gain.gain.setTargetAtTime(vol2, now, 0.3);
    }

    /**
     * Wypełnianie pieczęci (js/pieczecie.js postep, 0..1) - CIĄGŁY głos,
     * nie one-shot: ton rośnie z postępem, jak napinana cięciwa. Wołane co
     * klatkę; `skladana` (id pieczęci albo null) mówi, czy w ogóle coś się
     * składa - bez tego głos żyłby wiecznie na 0 Hz/0 gain, co jest
     * niepotrzebne, ale nieszkodliwe (gain=0 i tak nic nie gra).
     *
     * @param {number} postep    0..1
     * @param {string|null} skladana
     */
    ustawSkladanie(postep, skladana) {
        if (!this.initialized || !this.audioCtx) return;
        if (!this.skladanieOsc) {
            this.skladanieOsc = this.audioCtx.createOscillator();
            this.skladanieOsc.type = 'sine';
            this.skladanieGain = this.audioCtx.createGain();
            this.skladanieGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            this.skladanieOsc.connect(this.skladanieGain);
            this.skladanieGain.connect(this.masterGain);
            this.skladanieOsc.start();
        }
        const now = this.audioCtx.currentTime;
        const p = Number.isFinite(postep) ? Math.max(0, Math.min(1, postep)) : 0;
        const aktywna = !!skladana && p > 0.01;
        this.skladanieOsc.frequency.setTargetAtTime(220 + 220 * p, now, 0.08);
        this.skladanieGain.gain.setTargetAtTime(aktywna ? 0.06 * p : 0, now, 0.08);
    }

    /**
     * Tęcza (js/tecza.js silaSladu) - CIĄGŁY szmer, narost/wygaszanie
     * przychodzi ZA DARMO z silaSladu (aktywacja na pełną siłę, ostatnie
     * 3 s liniowo do zera - patrz tecza.js). Dwa rozstrojone trójkąty przez
     * highpass, z powolnym tremolo (0.4 Hz) - migotliwy, "cała paleta naraz"
     * charakter, spójny z tym, jak tecza.js opisuje samą siebie.
     * @param {number} silaSladu  0..1
     */
    ustawTecze(silaSladu) {
        if (!this.initialized || !this.audioCtx) return;
        const s = Number.isFinite(silaSladu) ? Math.max(0, Math.min(1, silaSladu)) : 0;
        if (!this.teczaOsc1 && s <= 0.001) return;   // nie buduj grafu, dopóki Tęcza nigdy nie była aktywna
        if (!this.teczaOsc1) {
            this.teczaOsc1 = this.audioCtx.createOscillator();
            this.teczaOsc2 = this.audioCtx.createOscillator();
            this.teczaOsc1.type = 'triangle'; this.teczaOsc2.type = 'triangle';
            this.teczaOsc1.frequency.setValueAtTime(660, this.audioCtx.currentTime);
            this.teczaOsc2.frequency.setValueAtTime(667, this.audioCtx.currentTime);   // rozstrojenie -> dudnienie
            const tremolo = this.audioCtx.createOscillator();
            tremolo.type = 'sine'; tremolo.frequency.value = 0.4;
            const tremoloGain = this.audioCtx.createGain();
            tremoloGain.gain.value = 0.4;
            this.teczaFilter = this.audioCtx.createBiquadFilter();
            this.teczaFilter.type = 'highpass';
            this.teczaFilter.frequency.setValueAtTime(500, this.audioCtx.currentTime);
            this.teczaGain = this.audioCtx.createGain();
            this.teczaGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            tremolo.connect(tremoloGain);
            tremoloGain.connect(this.teczaGain.gain);
            this.teczaOsc1.connect(this.teczaFilter);
            this.teczaOsc2.connect(this.teczaFilter);
            this.teczaFilter.connect(this.teczaGain);
            this.teczaGain.connect(this.masterGain);
            this.teczaOsc1.start(); this.teczaOsc2.start(); tremolo.start();
        }
        this.teczaGain.gain.setTargetAtTime(0.05 * s, this.audioCtx.currentTime, 0.2);
    }

    /**
     * Płonący Palec, ciągły trzask ognia - szum zapętlony przez bandpass,
     * którego środkowa częstotliwość rośnie z siłą (js/plonacyPalec.js
     * sila). Wołane co klatkę, TYLKO gdy stan==='PLONIE' (main.js) - hak
     * na krawędzie stanu (zapłon/zgaszenie) to osobne one-shoty niżej.
     * @param {number} sila  0..1
     */
    ustawPalec(sila) {
        if (!this.initialized || !this.audioCtx) return;
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (!this.palecZrodlo) {
            this.palecZrodlo = this.audioCtx.createBufferSource();
            this.palecZrodlo.buffer = this._buforSzumu;
            this.palecZrodlo.loop = true;
            this.palecFilter = this.audioCtx.createBiquadFilter();
            this.palecFilter.type = 'bandpass';
            this.palecFilter.Q.value = 1.1;
            this.palecGain = this.audioCtx.createGain();
            this.palecGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            this.palecZrodlo.connect(this.palecFilter);
            this.palecFilter.connect(this.palecGain);
            this.palecGain.connect(this.masterGain);
            this.palecZrodlo.start();
        }
        const now = this.audioCtx.currentTime;
        this.palecFilter.frequency.setTargetAtTime(800 + 1200 * s, now, 0.1);
        this.palecGain.gain.setTargetAtTime(0.08 * s, now, 0.08);
    }

    /** Zapłon palca - pop krótkiego szumu + opadający sinus. One-shot na krawędzi BEZCZYNNY/GOTOWY -> PLONIE. */
    grajZaplonPalca() {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        const pop = this.audioCtx.createBufferSource();
        pop.buffer = this._buforSzumu;
        const popFilter = this.audioCtx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.setValueAtTime(1800, now);
        popFilter.Q.value = 0.8;
        const popGain = this.audioCtx.createGain();
        popGain.gain.setValueAtTime(0.0001, now);
        popGain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
        popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        pop.connect(popFilter); popFilter.connect(popGain); popGain.connect(this.masterGain);

        const sub = this.audioCtx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(300, now);
        sub.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        const subGain = this.audioCtx.createGain();
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        sub.connect(subGain); subGain.connect(this.masterGain);

        pop.start(); sub.start();
        pop.stop(now + 0.1); sub.stop(now + 0.1);
        this._sprzatnij(pop, [popFilter, popGain]);
        this._sprzatnij(sub, [subGain]);
    }

    /** Zgaszenie palca - łagodniejszy, odwrócony pop (opada zamiast pękać). One-shot na krawędzi PLONIE -> BEZCZYNNY. */
    grajZgaszenie() {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const zrodlo = this.audioCtx.createBufferSource();
        zrodlo.buffer = this._buforSzumu;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + 0.25);
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        zrodlo.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        zrodlo.start(); zrodlo.stop(now + 0.32);
        this._sprzatnij(zrodlo, [filter, gain]);
    }

    /**
     * Pieczęć złożona - dzwonek E5+B5, ODRĘBNY od technik (grajTechnike) -
     * pieczęć jest krokiem pośrednim, ma brzmieć lżej. Zastępuje dawne
     * playFireSFX(0.3) (patrz js/techniki.js odpalPieczec).
     */
    grajPieczecZlozona() {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        for (const [freq, opoznienie] of [[659.25, 0], [987.77, 0.04]]) {   // E5, B5
            const osc = this.audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.0001, now + opoznienie);
            gain.gain.exponentialRampToValueAtTime(0.12, now + opoznienie + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + opoznienie + 0.5);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(now + opoznienie);
            osc.stop(now + opoznienie + 0.52);
            this._sprzatnij(osc, [gain]);
        }
    }

    /**
     * Technika dopełniona - wspólny whoosh (ciało dawnego playFireSFX(1.0),
     * teraz przy niższym gain, bo to jest BAZA na którą wchodzą warstwy) +
     * warstwa specyficzna dla `uzbraja`. gromWZiemie/kolowrot mają WŁASNE,
     * dedykowane warstwy (playGromSFX/playKolowrotSFX, main.js woła je
     * OBOK tej metody) - tu dostają tylko bazę, jak reszta.
     * @param {string} uzbraja  pole technika.uzbraja z kombosy.js
     */
    grajTechnike(uzbraja) {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        // --- baza: whoosh (dawne playFireSFX(1.0), teraz cichszy - jest bazą) ---
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        const startFreq = 300 + 1 * 400;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(startFreq * 1.5, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(now + 0.65);
        this._sprzatnij(osc, [filter, gain]);

        if (uzbraja === 'tecza') {
            // Wznoszące arpeggio pięciu sinusów - "rozkwit" tęczy w chwili aktywacji.
            const nuty = [523.25, 587.33, 659.25, 783.99, 880.00];   // C5 D5 E5 G5 A5
            nuty.forEach((freq, i) => {
                const t = now + i * 0.04;
                const o = this.audioCtx.createOscillator();
                o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
                const g = this.audioCtx.createGain();
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.10, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
                o.connect(g); g.connect(this.masterGain);
                o.start(t); o.stop(t + 0.37);
                this._sprzatnij(o, [g]);
            });
        } else if (uzbraja === 'ogien') {
            const zrodlo = this.audioCtx.createBufferSource();
            zrodlo.buffer = this._buforSzumu;
            const bp = this.audioCtx.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.setValueAtTime(1200, now); bp.Q.value = 1.4;
            const g = this.audioCtx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            zrodlo.connect(bp); bp.connect(g); g.connect(this.masterGain);
            zrodlo.start(); zrodlo.stop(now + 0.32);
            this._sprzatnij(zrodlo, [bp, g]);
        } else if (uzbraja === 'aard' || uzbraja === 'dym') {
            const o = this.audioCtx.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(520, now);
            const g = this.audioCtx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
            o.connect(g); g.connect(this.masterGain);
            o.start(); o.stop(now + 0.14);
            this._sprzatnij(o, [g]);
        }
        // gromWZiemie/kolowrot: brak dodatkowej warstwy tutaj - main.js woła
        // OSOBNO playGromSFX()/playKolowrotSFX() dla nich (dedykowane,
        // dłuższe efekty, patrz komentarze przy tych metodach niżej).
    }

    /**
     * Warstwa DODATKOWA do grajTechnike(), wyłącznie dla Gromu w Ziemię -
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
        gromGain.connect(this.masterGain);

        gromOsc.start();
        gromOsc.stop(now + 1.15);
        this._sprzatnij(gromOsc, [filter, gromGain]);
    }

    /**
     * Kołowrót - domknięcie mitu Gromu w Ziemię. Świadomie NIE trzask
     * (playGromSFX) ani whoosh (grajTechnike): dwa lekko ROZSTROJONE
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
        gain.connect(this.masterGain);

        osc1.start(); osc2.start();
        osc1.stop(now + czasTrwania + 0.05);
        osc2.stop(now + czasTrwania + 0.05);
        this._sprzatnij(osc1, [filter, gain]);
        this._sprzatnij(osc2, []);
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
     * Szum biały (bufor cache'owany w init(), losowe przesunięcie startu za
     * każdym razem dla różnorodności - patrz nagłówek pliku, punkt 3) +
     * szybko zamykający się filtr - trzask, nie ton.
     */
    playWybuchSFX(sila = 1) {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const s = Number.isFinite(sila) ? Math.max(0.3, Math.min(3, sila)) : 1;

        const zrodlo = this.audioCtx.createBufferSource();
        zrodlo.buffer = this._buforSzumu;
        const losowyOffset = Math.random() * (this._buforSzumu.duration - 0.4);

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
        gain.connect(this.masterGain);

        zrodlo.start(0, losowyOffset);
        zrodlo.stop(now + 0.35);
        this._sprzatnij(zrodlo, [filter, gain]);
    }

    /**
     * Wystrzał Aarda (Podmuch, js/podmuch.js) - "whoomp": pchnięcie
     * powietrza, nie trzask i nie whoosh.
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

        // --- warstwa 1: szum sprężonego powietrza (bufor cache'owany) ---
        const szum = this.audioCtx.createBufferSource();
        szum.buffer = this._buforSzumu;
        const losowyOffset = Math.random() * (this._buforSzumu.duration - czas);

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
        szumGain.connect(this.masterGain);

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
        subGain.connect(this.masterGain);

        szum.start(0, losowyOffset); sub.start();
        szum.stop(now + czas + 0.05);
        sub.stop(now + 0.35);
        this._sprzatnij(szum, [lowpass, szumGain]);
        this._sprzatnij(sub, [subGain]);
    }
}
