/**
 * Dźwięk Grzmotu - szum brązowy i planowanie grafu audio na atrapie kontekstu.
 *   node tools/test-dzwiek-grzmotu.mjs
 */
import { szumBrazowy, zagrajGrzmot, NASTAWY } from '../js/dzwiekGrzmotu.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

console.log('SZUM BRĄZOWY:');
{
    const s = szumBrazowy(5000, (() => { let x = 0.37; return () => (x = (x * 9301 + 49297) % 233280 / 233280); })());
    spr('długość i typ', s.length === 5000 && s instanceof Float32Array);
    spr('znormalizowany do -1..1, skończony', Math.max(...s) <= 1 + 1e-6 && Math.min(...s) >= -1 - 1e-6 && s.every(Number.isFinite));
    const rozn = s.reduce((a, v, i) => i ? a + Math.abs(v - s[i - 1]) : 0, 0) / s.length;
    spr(`gładszy niż biały (średnia różnica sąsiadów ${rozn.toFixed(3)} < 0.2)`, rozn < 0.2);
    spr('zła długość -> pusty, bez wyjątku', szumBrazowy(NaN).length === 0 && szumBrazowy(-5).length === 0);
}

console.log('\nGRAF AUDIO:');
function atrapa() {
    const log = [];
    const param = (nazwa) => ({ value: 0, setValueAtTime: (...a) => log.push([nazwa + '.set', ...a]), linearRampToValueAtTime: (...a) => log.push([nazwa + '.lin', ...a]), exponentialRampToValueAtTime: (...a) => log.push([nazwa + '.exp', ...a]) });
    const wezel = (typ, extra = {}) => ({ typ, connect: (cel) => log.push(['connect', typ, cel.typ ?? 'wyjscie']), ...extra });
    const ctx = {
        currentTime: 5, sampleRate: 8000,
        createBuffer: (k, n) => ({ n, getChannelData: () => new Float32Array(n) }),
        createBufferSource: () => wezel('src', { start: (t) => log.push(['start', t]), stop: (t) => log.push(['stop', t]) }),
        createBiquadFilter: () => wezel('filtr', { frequency: param('f'), Q: { value: 0 } }),
        createGain: () => wezel('gain', { gain: param('g') })
    };
    return { ctx, log };
}
{
    const { ctx, log } = atrapa();
    const wyjscie = { typ: 'wyjscie' };
    spr('zagrajGrzmot() planuje dźwięk', zagrajGrzmot({ ctx, wyjscie }, 1) === true);
    spr('dwa źródła startują od currentTime (trzask + dudnienie)', log.filter(l => l[0] === 'start').length === 2 && log.filter(l => l[0] === 'start').every(l => l[1] === 5));
    spr('oba źródła się kończą (bez wycieku)', log.filter(l => l[0] === 'stop').length === 2);
    spr('obie gałęzie kończą się na wyjściu magistrali', log.filter(l => l[0] === 'connect' && l[2] === 'wyjscie').length === 2);
    spr('filtr dudnienia opada ku niskim częstotliwościom', log.some(l => l[0] === 'f.exp' && l[1] === NASTAWY.DUDNIENIE_LP_KONIEC_HZ));
    const szczyty = log.filter(l => l[0] === 'g.lin').map(l => l[1]);
    spr('głośność w rozsądnych granicach (<= 1)', szczyty.length > 0 && szczyty.every(v => v >= 0 && v <= 1));
}
{
    const { ctx, log } = atrapa();
    spr('cichy Grzmot (sila 0) nic nie planuje', zagrajGrzmot({ ctx, wyjscie: {} }, 0) === false && log.length === 0);
    spr('brak magistrali (przed init) - false, bez wyjątku', zagrajGrzmot(null, 1) === false && zagrajGrzmot({}, 1) === false);
    const zepsuty = { ctx: { currentTime: 0, sampleRate: 8000, createBuffer() { throw new Error('boom'); } }, wyjscie: {} };
    spr('wyjątek audio nie psuje gry', zagrajGrzmot(zepsuty, 1) === false);
}

process.exit(ok ? 0 : 1);
