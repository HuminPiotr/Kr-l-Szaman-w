/**
 * AudioEngine (js/audioEngine.js) - atrapa Web Audio API, ten sam wzorzec
 * co reszta narzędzi w tools/ (globalThis.document w test-dym.mjs), tu
 * globalThis.window.AudioContext.
 *
 *   node tools/test-audio.mjs
 *
 * OD 2026-10-01 gra NIE MA efektów dźwiękowych - tylko pieśni rund. Silnik zostaje
 * jako CIENKA MAGISTRALA: masterGain -> compressor -> destination, wyciszenie (M)
 * i podłączenie pieśni (podlaczPiesn). Ten test pilnuje, że:
 *   - silnik niczego nie syntezuje (zero oscylatorów, zero źródeł buforowych),
 *   - stary interfejs efektów (metody graj..., play...SFX, ustaw..., update) nie wrócił,
 *   - magistrala, wyciszenie i pieśń działają.
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

// --- 1. Brak syntezy: gra nie ma efektów dźwiękowych (tylko pieśni) ---
console.log('BRAK EFEKTÓW DŹWIĘKOWYCH:');
{
    const e = nowyEngine();
    const typy = new Set(WEZLY.map(w => w._typ));
    spr(`init() tworzy WYŁĄCZNIE magistralę (węzły: ${[...typy].join(', ')})`, [...typy].every(x => x === 'compressor' || x === 'gain'));
    spr('zero oscylatorów (bez szumu bazowego "hum")', !WEZLY.some(w => w._typ === 'oscillator'));
    spr('zero źródeł buforowych (bez wybuchów/szumów)', !WEZLY.some(w => w._typ === 'bufferSource'));
    spr('bufor szumu nie jest tworzony', LICZNIK_CREATE_BUFFER === 0);
    spr('zero filtrów (bez barwienia efektów)', !WEZLY.some(w => w._typ === 'biquad'));
    const STARE = ['update', 'ustawSkladanie', 'ustawTecze', 'ustawPalec', 'grajZaplonPalca', 'grajZgaszenie',
                   'grajPieczecZlozona', 'grajTechnike', 'playGromSFX', 'playKolowrotSFX', 'playWybuchSFX', 'playAardSFX'];
    for (const m of STARE) spr(`interfejs efektu '${m}' nie istnieje`, typeof e[m] === 'undefined');
    spr('brak głosów hum w stanie silnika', e.humGain === undefined && e.humOsc === undefined && e.hum2Osc === undefined && e._buforSzumu === undefined);
}

// --- 2. Przed init() metody magistrali są no-opami ---
console.log('\nPRZED init():');
{
    const e = new AudioEngine();
    let rzucil = false;
    // Wyciszenie jest TRWAŁE (localStorage), więc przełączamy dwa razy - żeby nie skazić kolejnych sekcji.
    try { e.resume(); e.przelaczWyciszenie(); e.przelaczWyciszenie(); e.podlaczPiesn({}); } catch { rzucil = true; }
    spr('żadna metoda nie rzuca przed init()', !rzucil);
    spr('audioCtx wciąż null (init() nigdy nie wywołane)', e.audioCtx === null);
    spr('podlaczPiesn przed init() = null', e.podlaczPiesn({}) === null);
}

// --- 3. Magistrala: masterGain -> compressor -> destination ---
console.log('\nMAGISTRALA:');
{
    const e = nowyEngine();
    const doDestination = POLACZENIA.filter(p => p.do === 'destination');
    spr(`TYLKO compressor łączy się bezpośrednio z destination (${doDestination.length} połączeń)`,
        doDestination.length >= 1 && doDestination.every(p => p.od === e.compressor));
    spr('masterGain łączy się z compressor (nie z destination wprost)',
        POLACZENIA.some(p => p.od === e.masterGain && p.do === e.compressor));
    spr('init() jest idempotentne (drugi init nie dubluje węzłów)', (() => { const n = WEZLY.length; e.init(); return WEZLY.length === n; })());
}

// --- 4. Wyciszenie (klawisz M wycisza pieśń, bo ta idzie przez masterGain) ---
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
