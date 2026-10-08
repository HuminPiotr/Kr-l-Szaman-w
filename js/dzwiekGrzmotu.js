/**
 * Dźwięk Grzmotu - JEDYNY efekt dźwiękowy gry (2026-10-08, życzenie właściciela;
 * świadomy wyjątek od decyzji z 2026-10-01 "gra nie ma efektów dźwiękowych" -
 * dopisany do WYJATKI w tools/test-brak-efektow-dzwiekowych.mjs i do GEMINI.md).
 * Reszta gry dalej milczy: pieśni rund i nic więcej.
 *
 * Synteza zamiast pliku: zero pobierania i licencji. Dwie warstwy z jednego
 * bufora szumu brązowego (całkowany biały - głęboki, "okrągły"):
 *  - TRZASK: ~80 ms szumu przez filtr górnoprzepustowy, ostry atak - uderzenie
 *    pioruna,
 *  - DUDNIENIE: ~2.2 s przez dolnoprzepustowy opadający z ~700 do ~80 Hz,
 *    z falującą głośnością (kilka garbów) - przetaczający się grzmot.
 * Wszystko idzie przez magistralę gry (audioEngine.magistrala()): klawisz M
 * wycisza, kompresor pilnuje sufitu. Bez kontekstu audio (przed init, testy)
 * zagrajGrzmot() cicho nic nie robi - dźwięk nigdy nie psuje gry (§2).
 */

export const NASTAWY = {
    TRZASK_S: 0.08,
    DUDNIENIE_S: 2.2,
    TRZASK_HP_HZ: 1800,
    DUDNIENIE_LP_START_HZ: 700,
    DUDNIENIE_LP_KONIEC_HZ: 80,
    GLOSNOSC_TRZASKU: 0.55,
    GLOSNOSC_DUDNIENIA: 0.9,
    // Garby głośności dudnienia: [czas s od startu, poziom 0..1]
    GARBY: [[0, 0], [0.03, 1], [0.25, 0.45], [0.5, 0.8], [0.9, 0.35], [1.4, 0.3], [2.2, 0]]
};

/**
 * Szum brązowy (całkowany biały) znormalizowany do -1..1 - czysta funkcja.
 * @param {number} dlugosc  liczba próbek
 * @param {() => number} [los]  0..1, wstrzykiwany do testów
 * @returns {Float32Array}
 */
export function szumBrazowy(dlugosc, los = Math.random) {
    const n = Number.isFinite(dlugosc) ? Math.max(0, Math.floor(dlugosc)) : 0;
    const out = new Float32Array(n);
    let ostatnia = 0, maks = 1e-9;
    for (let i = 0; i < n; i++) {
        ostatnia = (ostatnia + 0.02 * (los() * 2 - 1)) / 1.02;   // wyciek trzyma średnią przy zerze
        out[i] = ostatnia;
        if (Math.abs(ostatnia) > maks) maks = Math.abs(ostatnia);
    }
    for (let i = 0; i < n; i++) out[i] /= maks;
    return out;
}

/**
 * @param {{ctx: AudioContext, wyjscie: AudioNode}|null} mag  z audioEngine.magistrala()
 * @param {number} [sila] 0..1
 * @param {() => number} [los]
 * @returns {boolean}  czy dźwięk został zaplanowany
 */
export function zagrajGrzmot(mag, sila = 1, los = Math.random) {
    const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
    if (!mag?.ctx || !mag.wyjscie || s <= 0.01) return false;
    try {
        const N = NASTAWY, ctx = mag.ctx, t0 = ctx.currentTime;
        const dl = Math.ceil(ctx.sampleRate * N.DUDNIENIE_S);
        const bufor = ctx.createBuffer(1, dl, ctx.sampleRate);
        bufor.getChannelData(0).set(szumBrazowy(dl, los));

        // --- TRZASK ---
        const trzask = ctx.createBufferSource();
        trzask.buffer = bufor;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(N.TRZASK_HP_HZ, t0);
        const gTrzask = ctx.createGain();
        gTrzask.gain.setValueAtTime(0, t0);
        gTrzask.gain.linearRampToValueAtTime(N.GLOSNOSC_TRZASKU * s, t0 + 0.003);
        gTrzask.gain.exponentialRampToValueAtTime(0.0001, t0 + N.TRZASK_S);
        trzask.connect(hp); hp.connect(gTrzask); gTrzask.connect(mag.wyjscie);
        trzask.start(t0);
        trzask.stop(t0 + N.TRZASK_S + 0.05);

        // --- DUDNIENIE ---
        const dud = ctx.createBufferSource();
        dud.buffer = bufor;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.7;
        lp.frequency.setValueAtTime(N.DUDNIENIE_LP_START_HZ, t0);
        lp.frequency.exponentialRampToValueAtTime(N.DUDNIENIE_LP_KONIEC_HZ, t0 + N.DUDNIENIE_S);
        const gDud = ctx.createGain();
        gDud.gain.setValueAtTime(0, t0);
        for (const [t, poziom] of N.GARBY) gDud.gain.linearRampToValueAtTime(N.GLOSNOSC_DUDNIENIA * s * poziom, t0 + t);
        dud.connect(lp); lp.connect(gDud); gDud.connect(mag.wyjscie);
        dud.start(t0);
        dud.stop(t0 + N.DUDNIENIE_S + 0.05);
        return true;
    } catch {
        return false;   // brak dźwięku nie jest błędem gry
    }
}
