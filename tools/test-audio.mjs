/**
 * AudioEngine (js/audioEngine.js) - atrapa Web Audio API, ten sam wzorzec
 * co reszta narzędzi w tools/ (globalThis.document w test-dym.mjs), tu
 * globalThis.window.AudioContext.
 *
 *   node tools/test-audio.mjs
 *
 * Pilnuje CZTERECH luk z audytu P3 (patrz nagłówek js/audioEngine.js):
 * magistrala (żaden głos nie łączy się z destination z pominięciem
 * masterGain->compressor), bezpieczeństwo obwiedni (setValueAtTime PRZED
 * jakąkolwiek rampą, exponentialRamp nigdy do zera), sprzątanie węzłów
 * (onended odłącza cały graf głosu), cache bufora szumu (createBuffer
 * wołane RAZ, nie przy każdym playWybuchSFX/playAardSFX).
 */

// --- Atrapa Web Audio API ---
const WEZLY = [];              // wszystkie stworzone węzły, do inspekcji
const POLACZENIA = [];         // {od, do} - do = obiekt węzła albo 'destination'
let LICZNIK_CREATE_BUFFER = 0;

function nowyParam(nazwa, wartoscPoczatkowa) {
    const zdarzenia = [];      // [{metoda, wartosc, czas}]
    let wartosc = wartoscPoczatkowa;
    return {
        get value() { return wartosc; },
        set value(v) { wartosc = v; },
        _nazwa: nazwa,
        _zdarzenia: zdarzenia,
        setValueAtTime(v, t) { wartosc = v; zdarzenia.push({ metoda: 'setValueAtTime', wartosc: v, czas: t }); return this; },
        linearRampToValueAtTime(v, t) { wartosc = v; zdarzenia.push({ metoda: 'linearRampToValueAtTime', wartosc: v, czas: t }); return this; },
        exponentialRampToValueAtTime(v, t) { wartosc = v; zdarzenia.push({ metoda: 'exponentialRampToValueAtTime', wartosc: v, czas: t }); return this; },
        setTargetAtTime(v, t, tau) { wartosc = v; zdarzenia.push({ metoda: 'setTargetAtTime', wartosc: v, czas: t, tau }); return this; },
    };
}

function bazowyWezel(typ, params = []) {
    const w = { _typ: typ, _polaczoneDo: [], onended: null };
    for (const p of params) w[p] = nowyParam(p, 0);
    w.connect = (cel) => {
        POLACZENIA.push({ od: w, do: cel === 'destination-sentinel' ? 'destination' : cel });
        w._polaczoneDo.push(cel);
        return cel;
    };
    w.disconnect = () => { w._rozlaczony = true; };
    WEZLY.push(w);
    return w;
}

class AtrapaAudioContext {
    constructor() {
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.state = 'suspended';
        this.destination = 'destination-sentinel';
    }
    resume() { this.state = 'running'; }
    createOscillator() {
        const o = bazowyWezel('oscillator', ['frequency', 'detune']);
        o.type = 'sine';
        o.start = (t) => { o._start = t ?? 0; };
        // W prawdziwym Web Audio onended odpala się ASYNCHRONICZNIE, długo po
        // stop() (dopiero gdy zegar audio dojdzie do zaplanowanego czasu) -
        // kod w audioEngine.js woła _sprzatnij(zrodlo, ...) PO stop(), co jest
        // poprawne. Atrapa NIE odpala onended synchronicznie w stop() (to był
        // błąd wcześniejszej wersji testu, nie audioEngine.js) - test wywołuje
        // je jawnie, gdy chce zasymulować koniec odtwarzania.
        o.stop = (t) => { o._stop = t; };
        return o;
    }
    createGain() { return bazowyWezel('gain', ['gain']); }
    createBiquadFilter() {
        const f = bazowyWezel('biquad', ['frequency', 'Q', 'gain', 'detune']);
        f.type = 'lowpass';
        return f;
    }
    createDynamicsCompressor() {
        return bazowyWezel('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release', 'reduction']);
    }
    createBuffer(kanaly, dlugosc, sampleRate) {
        LICZNIK_CREATE_BUFFER++;
        const dane = new Float32Array(dlugosc);
        return { duration: dlugosc / sampleRate, getChannelData: () => dane, length: dlugosc, sampleRate };
    }
    createBufferSource() {
        const s = bazowyWezel('bufferSource', []);
        s.buffer = null; s.loop = false;
        s.start = (when, offset) => { s._start = when ?? 0; s._offset = offset ?? 0; };
        s.stop = (t) => { s._stop = t; };   // onended asynchroniczny - patrz komentarz w createOscillator()
        return s;
    }
}

globalThis.window = { AudioContext: AtrapaAudioContext };
try { globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; } }; } catch { /* ignore */ }

const { AudioEngine } = await import('../js/audioEngine.js');

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

function nowyEngine() {
    WEZLY.length = 0; POLACZENIA.length = 0; LICZNIK_CREATE_BUFFER = 0;
    const e = new AudioEngine();
    e.init();
    return e;
}

// --- 1. Wywołania przed init() są no-opami, bez wyjątku ---
console.log('PRZED init():');
{
    const e = new AudioEngine();
    let rzucil = false;
    try {
        e.update(0.5, 0.5); e.playGromSFX(); e.playKolowrotSFX();
        e.playWybuchSFX(1); e.playAardSFX(1); e.ustawSkladanie(0.5, 'swarog');
        e.ustawTecze(0.5); e.ustawPalec(0.5); e.grajZaplonPalca(); e.grajZgaszenie();
        e.grajPieczecZlozona(); e.grajTechnike('ogien');
    } catch { rzucil = true; }
    spr('żadna metoda nie rzuca przed init()', !rzucil);
    spr('audioCtx wciąż null (init() nigdy nie wywołane)', e.audioCtx === null);
}

// --- 2. Magistrala: WSZYSTKO przez masterGain -> compressor -> destination ---
console.log('\nMAGISTRALA (żaden głos nie omija masterGain/compressor):');
{
    const e = nowyEngine();
    e.update(0.7, 0.8);
    e.grajPieczecZlozona();
    e.grajTechnike('gromWZiemie');
    e.playGromSFX();
    e.playKolowrotSFX();
    e.playWybuchSFX(2);
    e.playAardSFX(0.6);
    e.ustawSkladanie(0.5, 'swarog');
    e.ustawTecze(0.7);
    e.ustawPalec(0.5);
    e.grajZaplonPalca();

    const doDestination = POLACZENIA.filter(p => p.do === 'destination');
    spr(`TYLKO compressor łączy się bezpośrednio z destination (${doDestination.length} połączeń, wszystkie od compressor)`,
        doDestination.length >= 1 && doDestination.every(p => p.od === e.compressor));
    spr('compressor łączy się z destination', POLACZENIA.some(p => p.od === e.compressor && p.do === 'destination'));
    spr('masterGain łączy się z compressor (nie z destination wprost)',
        POLACZENIA.some(p => p.od === e.masterGain && p.do === e.compressor));
}

// --- 3. Bezpieczeństwo obwiedni: setValueAtTime PRZED rampą, brak rampy do zera ---
console.log('\nBEZPIECZEŃSTWO OBWIEDNI (audio-rules skilla ui-sound-design):');
{
    const e = nowyEngine();
    e.update(0.7, 0.8);
    e.grajPieczecZlozona();
    e.grajTechnike('gromWZiemie');
    e.playGromSFX();
    e.playKolowrotSFX();
    e.playWybuchSFX(2);
    e.playAardSFX(0.6);
    e.ustawSkladanie(0.5, 'swarog');
    e.ustawTecze(0.7);
    e.ustawPalec(0.5);
    e.grajZaplonPalca();
    e.grajZgaszenie();

    let zeroTarget = 0, brakSetPrzedRampa = 0, sprawdzoneParamy = 0;
    for (const w of WEZLY) {
        for (const klucz of Object.keys(w)) {
            const p = w[klucz];
            if (!p || !Array.isArray(p._zdarzenia) || p._zdarzenia.length === 0) continue;
            sprawdzoneParamy++;
            const rampy = p._zdarzenia.filter(z => z.metoda === 'exponentialRampToValueAtTime');
            for (const r of rampy) if (r.wartosc <= 0) zeroTarget++;
            if (rampy.length > 0) {
                const pierwsza = p._zdarzenia[0];
                if (pierwsza.metoda !== 'setValueAtTime') brakSetPrzedRampa++;
            }
        }
    }
    spr(`sprawdzono ${sprawdzoneParamy} parametrów z automatyzacją`, sprawdzoneParamy > 10);
    spr('żadna exponentialRampToValueAtTime nie celuje w <= 0', zeroTarget === 0);
    spr('każdy param z rampą ma setValueAtTime JAKO PIERWSZE zdarzenie', brakSetPrzedRampa === 0);
}

// --- 4. Sprzątanie: onended odłącza wszystkie węzły głosu ---
console.log('\nSPRZĄTANIE (onended -> disconnect):');
{
    const e = nowyEngine();
    // init() już stworzył węzły TRWAŁE (masterGain/humGain/hum2Gain -
    // nigdy nie są disconnect()owane, żyją przez całą grę) - zapamiętujemy
    // granicę PRZED graniem dzwonka, żeby sprawdzić TYLKO nowe węzły głosu.
    const przedDzwonkiem = WEZLY.length;
    e.grajPieczecZlozona();
    const noweWezly = WEZLY.slice(przedDzwonkiem);
    const zrodla = noweWezly.filter(w => (w._typ === 'oscillator' || w._typ === 'bufferSource') && typeof w.onended === 'function');
    spr(`grajPieczecZlozona() ma ${zrodla.length} źródło/a z onended`, zrodla.length >= 1);
    // Symulujemy asynchroniczne zakończenie odtwarzania (patrz komentarz
    // w AtrapaAudioContext.createOscillator) - dopiero TERAZ, po tym jak
    // grajPieczecZlozona() zdążyła wywołać _sprzatnij() i ustawić onended.
    for (const z of zrodla) { if (z.onended) z.onended(); }
    // Każdy węzeł głosu (tu: gainy dzwonka, _sprzatnij dostaje [gain]) -
    // NOWE, nie węzły trwałe silnika - ma być disconnect()owany po zakończeniu.
    const gainyPoDzwonku = noweWezly.filter(w => w._typ === 'gain');
    spr(`${gainyPoDzwonku.length} nowe gainy dzwonka są disconnect() po onended`,
        gainyPoDzwonku.length >= 1 && gainyPoDzwonku.every(g => g._rozlaczony === true));
}

// --- 5. Cache bufora szumu: createBuffer RAZ, nie przy każdym wywołaniu ---
console.log('\nCACHE BUFORA SZUMU:');
{
    const e = nowyEngine();
    spr('createBuffer wołane RAZ w init()', LICZNIK_CREATE_BUFFER === 1);
    for (let i = 0; i < 5; i++) e.playWybuchSFX(1);
    for (let i = 0; i < 5; i++) e.playAardSFX(1);
    for (let i = 0; i < 3; i++) e.grajZaplonPalca();
    spr('5x playWybuchSFX + 5x playAardSFX + 3x grajZaplonPalca -> createBuffer WCIĄŻ RAZ (bufor dzielony)',
        LICZNIK_CREATE_BUFFER === 1);
}

// --- 6. Wyciszenie ---
console.log('\nWYCISZENIE:');
{
    const e = nowyEngine();
    spr('domyślnie odciszony', e.wyciszony === false);
    spr('masterGain startuje na 0.8', e.masterGain.gain.value === 0.8);
    e.przelaczWyciszenie();
    spr('przelaczWyciszenie() -> wyciszony=true', e.wyciszony === true);
    spr('masterGain.gain celuje w 0 (setTargetAtTime)', e.masterGain.gain.value === 0);
    e.przelaczWyciszenie();
    spr('drugie przełączenie wraca do odciszonego', e.wyciszony === false);
    spr('masterGain.gain wraca do 0.8', e.masterGain.gain.value === 0.8);
}

// --- 7. Odporność na NaN ---
console.log('\nODPORNOŚĆ:');
{
    const e = nowyEngine();
    let rzucil = false;
    try {
        e.update(NaN, NaN);
        e.ustawSkladanie(NaN, 'swarog');
        e.ustawTecze(NaN);
        e.ustawPalec(NaN);
        e.playWybuchSFX(NaN);
        e.playAardSFX(NaN);
    } catch { rzucil = true; }
    spr('NaN we wszystkich wejściach nie rzuca wyjątku', !rzucil);
    spr('hum gain skończony po update(NaN,NaN)', Number.isFinite(e.humGain.gain.value));
    spr('skladanieGain skończony po ustawSkladanie(NaN,...)', Number.isFinite(e.skladanieGain.gain.value));
}

// --- 8. update() straciło parametr state (sygnatura P3) ---
console.log('\nSYGNATURA update() (P3 - bez martwej gałęzi READY/FIRING):');
{
    const e = nowyEngine();
    e.update(1, 1);   // (moc, plynnosc) - NIE (state, moc, plynnosc)
    spr('update(moc, plynnosc) ustawia hum na pełną moc', e.humGain.gain.value > 0.1);
    spr('readyOsc nie istnieje (martwa gałąź usunięta)', e.readyOsc === undefined);
}

// --- Pieśń przez magistralę (tryby, 2026-10-01) ---
console.log('\nPIEŚŃ PRZEZ MAGISTRALĘ:');
{
    const PROTO = AtrapaAudioContext.prototype;
    PROTO.createMediaElementSource = function (el) {
        const w = bazowyWezel('mediaElementSource', []);
        w._element = el;
        return w;
    };
    const e = new AudioEngine();
    spr('podlaczPiesn przed init() = null, bez wyjątku', e.podlaczPiesn({}) === null);
    const e2 = nowyEngine();
    const audio = {};
    const przed = WEZLY.length;
    const uchwyt = e2.podlaczPiesn(audio);
    spr('podlaczPiesn po init() zwraca uchwyt', uchwyt && typeof uchwyt.glosnosc === 'function' && typeof uchwyt.odlacz === 'function');
    const zrodlo = WEZLY.slice(przed).find(w => w._typ === 'mediaElementSource');
    const gain = WEZLY.slice(przed).find(w => w._typ === 'gain');
    spr('źródło pieśni -> gain pieśni', zrodlo && gain && zrodlo._polaczoneDo.includes(gain));
    spr('gain pieśni -> masterGain (NIE destination: M wycisza także pieśń)', gain._polaczoneDo.includes(e2.masterGain) && !gain._polaczoneDo.includes('destination-sentinel'));
    uchwyt.glosnosc(0, 2);
    const ev = gain.gain._zdarzenia;
    const idxSet = ev.findIndex(x => x.metoda === 'setValueAtTime');
    const idxRamp = ev.findIndex(x => x.metoda === 'linearRampToValueAtTime');
    spr('zanik: setValueAtTime PRZED rampą (ta sama zasada co reszta engine)', idxSet >= 0 && idxRamp > idxSet);
    spr('zanik schodzi do 0 w zadanym czasie', ev[idxRamp].wartosc === 0 && ev[idxRamp].czas >= 2);
    uchwyt.glosnosc(NaN, NaN);
    spr('głośność NaN nie psuje obwiedni', ev.every(x => Number.isFinite(x.wartosc)));
    uchwyt.odlacz();
    spr('odlacz rozłącza graf pieśni', zrodlo._rozlaczony === true && gain._rozlaczony === true);
    uchwyt.odlacz();
    spr('odlacz jest idempotentne', true);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
