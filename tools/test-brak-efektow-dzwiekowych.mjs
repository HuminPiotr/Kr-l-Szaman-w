/**
 * Strażnik: gra NIE MA efektów dźwiękowych - tylko pieśni rund (decyzja właściciela 2026-10-01).
 *
 *   node tools/test-brak-efektow-dzwiekowych.mjs
 *
 * Skanuje źródła w js/ i szuka śladów syntezy dźwięku albo starego interfejsu efektów. Wyjątki:
 *   - js/audioEngine.js: cienka magistrala (kompresor, gain, wyciszenie, pieśń przez MediaElementSource),
 *   - js/debugHud.js: osobny AudioContext narzędzia deweloperskiego (sygnały sesji nagraniowej Z/1-8),
 *     to nie jest dźwięk GRY - patrz nagłówek tamtego pliku,
 *   - js/dzwiekGrzmotu.js: JEDYNY efekt dźwiękowy gry (2026-10-08, życzenie właściciela) - Grzmot.
 *     Dostaje wyjątek wyłącznie jako ten jeden plik; main.js nadal nie może syntezować ani wołać starych efektów.
 * Nowy dźwięk w grze = świadoma zmiana tej decyzji, a nie przypadkowy powrót efektu.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

function pliki(dir) {
    const out = [];
    for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) { if (n !== 'vendor') out.push(...pliki(p)); }
        else if (n.endsWith('.js')) out.push(p);
    }
    return out;
}

const korzen = new URL('../js/', import.meta.url).pathname;
const WYJATKI = new Set(['audioEngine.js', 'debugHud.js', 'dzwiekGrzmotu.js']);
const ZAKAZANE = [
    ['createOscillator', 'synteza: oscylator'],
    ['createBufferSource', 'synteza: źródło buforowe (szum, wybuchy)'],
    ['createBiquadFilter', 'synteza: filtr barwiący efekt'],
    ['grajPieczecZlozona', 'stary efekt: dzwonek pieczęci'], ['grajTechnike', 'stary efekt: dźwięk techniki'],
    ['grajZaplonPalca', 'stary efekt: zapłon palca'], ['grajZgaszenie', 'stary efekt: zgaszenie palca'],
    ['playGromSFX', 'stary efekt: grzmot'], ['playKolowrotSFX', 'stary efekt: Kołowrót'],
    ['playWybuchSFX', 'stary efekt: wybuch dymu'], ['playAardSFX', 'stary efekt: Aard'],
    ['ustawPalec', 'stary efekt: trzask palca'], ['ustawSkladanie', 'stary efekt: składanie pieczęci'],
    ['ustawTecze', 'stary efekt: tęcza'], ['audioEngine.update', 'stary efekt: szum bazowy od mocy'],
    ['audio: audioEngine', 'worek zależności z audio (efekty nie dostają już audio)']
];

console.log('ŹRÓDŁA W js/:');
for (const f of pliki(korzen)) {
    const nazwa = f.slice(korzen.length);
    if (WYJATKI.has(nazwa)) continue;
    const tekst = readFileSync(f, 'utf8');
    // komentarze nie liczą się: usuwamy // i /* */, żeby historia w komentarzach nie psuła testu
    const kod = tekst.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const trafienia = ZAKAZANE.filter(([fragment]) => kod.includes(fragment));
    spr(`${nazwa}: bez śladów efektów dźwiękowych${trafienia.length ? ' (znaleziono: ' + trafienia.map(t => `${t[0]} = ${t[1]}`).join('; ') + ')' : ''}`, trafienia.length === 0);
}

console.log('\nWYJĄTEK GRZMOTU:');
{
    const dzw = readFileSync(new URL('../js/dzwiekGrzmotu.js', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    spr('dźwięk Grzmotu istnieje i idzie przez magistralę gry (wyjscie), nie własny AudioContext', dzw.includes('mag.wyjscie') && !dzw.includes('new AudioContext'));
    spr('jedyny wyjątek: tylko dzwiekGrzmotu.js poza silnikiem i narzędziem', [...WYJATKI].sort().join() === 'audioEngine.js,debugHud.js,dzwiekGrzmotu.js');
    spr('main.js woła dźwięk wyłącznie dla Grzmotu', main.includes("technika.uzbraja === 'grzmot') zagrajGrzmot("));
}

console.log('\nSILNIK:');
{
    const kod = readFileSync(new URL('../js/audioEngine.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const [fragment, opis] of ZAKAZANE.filter(z => z[0] !== 'audio: audioEngine')) {
        spr(`audioEngine.js: bez '${fragment}' (${opis})`, !kod.includes(fragment));
    }
    spr('audioEngine.js zachowuje magistralę i pieśń', kod.includes('createDynamicsCompressor') && kod.includes('podlaczPiesn') && kod.includes('przelaczWyciszenie'));
}

process.exit(ok ? 0 : 1);
