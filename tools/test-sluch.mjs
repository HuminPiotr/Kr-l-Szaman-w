/**
 * Słuch (mikrofon) - stany bez zgody/urządzenia, droga paczek workletu do śledzenia,
 * strażnik: mikrofon nigdy do głośników, dźwięk nigdy nie zapisywany.
 *
 *   node tools/test-sluch.mjs
 */
import { readFileSync } from 'node:fs';
import { Sluch, KLUCZ_OPOZNIENIA, OPOZNIENIE_DOMYSLNE_S } from '../js/rytm/sluch.js';

let ziarno = 3;
const losowa = () => {
    ziarno = (ziarno + 0x6D2B79F5) | 0;
    let t = Math.imul(ziarno ^ (ziarno >>> 15), 1 | ziarno);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const magazyn = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

console.log('STANY:');
{
    const odmowa = new Sluch({ mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); } }, magazyn: magazyn() });
    spr('odmowa zgody -> "brak zgody", bez wyjątku, bez rytmu', (await odmowa.start({ audioWorklet: {} })) === 'brak zgody' && odmowa.rytm === null);
    const brak = new Sluch({ mediaDevices: undefined, magazyn: magazyn() });
    spr('brak mediaDevices -> "brak mikrofonu"', (await brak.start({})) === 'brak mikrofonu');
    const bezCtx = new Sluch({ mediaDevices: { getUserMedia: async () => ({}) }, magazyn: magazyn() });
    spr('brak AudioContext -> "brak mikrofonu"', (await bezCtx.start(null)) === 'brak mikrofonu');
}
console.log('\nOPÓŹNIENIE:');
{
    const m = magazyn();
    const s = new Sluch({ mediaDevices: undefined, magazyn: m });
    spr(`domyślne ${OPOZNIENIE_DOMYSLNE_S * 1000} ms`, s.opoznienieS === OPOZNIENIE_DOMYSLNE_S);
    s.przesunOpoznienie(0.01); s.przesunOpoznienie(0.01);
    spr('poprawka ręczna zapamiętana', Math.abs(new Sluch({ mediaDevices: undefined, magazyn: m }).opoznienieS - (OPOZNIENIE_DOMYSLNE_S + 0.02)) < 1e-9 && m.getItem(KLUCZ_OPOZNIENIA) !== null);
    const zepsuty = new Sluch({ mediaDevices: undefined, magazyn: { getItem: () => { throw new Error('prywatne'); }, setItem: () => { throw new Error('x'); } } });
    zepsuty.przesunOpoznienie(0.01);
    spr('magazyn rzuca -> domyślne, bez wyjątku', Math.abs(zepsuty.opoznienieS - OPOZNIENIE_DOMYSLNE_S - 0.01) < 1e-9);
}
console.log('\nPACZKI Z WORKLETU -> RYTM:');
{
    const s = new Sluch({ mediaDevices: undefined, magazyn: magazyn() });
    s.stan = 'słucha';
    let teraz = 0;
    s._ctx = { get currentTime() { return teraz; } };
    const SR = 48000, PACZKA = 2048, T = 60 / 124;
    const sek = 16, pcm = new Float32Array(sek * SR);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (losowa() - 0.5) * 0.02;
    for (let t = 0.2; t < sek; t += T) { const p = Math.round(t * SR); for (let k = 0; k < 0.15 * SR && p + k < pcm.length; k++) pcm[p + k] += 0.8 * Math.exp(-k / (0.03 * SR)) * Math.sin(2 * Math.PI * 60 * k / SR); }
    for (let i = 0; i < pcm.length; i += PACZKA) { s.przyjmij({ pcm: pcm.slice(i, i + PACZKA), t: i / SR, sr: SR }); teraz = (i + PACZKA) / SR; }
    const r = s.rytm;
    spr(`po ${sek} s muzyki: rytm pewny, ${s.sledzenie.bpm?.toFixed(1)} BPM (cel 124)`, r?.pewny === true && Math.abs(s.sledzenie.bpm - 124) < 1.5);
    spr('czas rytmu = zegar + opóźnienie', Math.abs(r.czasS - (teraz + s.opoznienieS)) < 1e-9);
    s.zeruj();
    spr('zeruj() - nowa pieśń, słuch od nowa', !s.rytm.pewny);
    s.przyjmij(null); s.przyjmij({ pcm: new Float32Array(10), t: 0, sr: 0 });
    spr('złe paczki nie rzucają', true);
}
console.log('\nSTRAŻNIK (spec: mikrofon nigdy do głośników, dźwięk nigdy zapisywany):');
{
    const src = readFileSync(new URL('../js/rytm/sluch.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const doWyjscia = [...src.matchAll(/(\w+(?:\.\w+)*)\.connect\(\s*ctx\.destination\s*\)/g)].map(m => m[1]);
    spr(`do wyjścia podłączony wyłącznie węzeł ciszy (${doWyjscia.join(', ')})`, doWyjscia.length === 1 && doWyjscia[0] === 'this._cisza');
    spr('węzeł ciszy ma głośność 0', /this\._cisza\.gain\.value\s*=\s*0\s*;/.test(src));
    spr('brak nagrywania dźwięku (MediaRecorder, Blob, fetch)', !/MediaRecorder|new Blob|fetch\(|XMLHttpRequest|sendBeacon/.test(src));
    spr('tłumienie echa wyłączone (inaczej słuch nie słyszy głośników)', /echoCancellation:\s*false/.test(src));
}
process.exit(ok ? 0 : 1);
