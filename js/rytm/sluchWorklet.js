/**
 * AudioWorklet słuchu (js/rytm/sluch.js): zbiera próbki mikrofonu w paczki po
 * PACZKA próbek i oddaje je wątkowi głównemu z czasem pierwszej próbki
 * (AudioContext.currentTime). Nic nie przetwarza i nic nie wysyła na wyjście -
 * wyjście zostaje ciszą (słuch tylko słucha, mikrofon NIGDY do głośników).
 */
const PACZKA = 2048;   // ~43 ms przy 48 kHz - ~23 wiadomości/s zamiast 375

class SluchProcesor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buf = new Float32Array(PACZKA);
        this._n = 0;
        this._t0 = 0;
    }

    process(inputs) {
        const ch = inputs[0]?.[0];
        if (ch?.length) {
            if (this._n === 0) this._t0 = currentTime;
            const ile = Math.min(ch.length, PACZKA - this._n);
            this._buf.set(ch.subarray(0, ile), this._n);
            this._n += ile;
            if (this._n >= PACZKA) {
                this.port.postMessage({ pcm: this._buf.slice(0), t: this._t0, sr: sampleRate });
                this._n = 0;
            }
        }
        return true;
    }
}

registerProcessor('sluch-procesor', SluchProcesor);
