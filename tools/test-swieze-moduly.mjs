/**
 * swiezeModuly - równy start rundy: KAŻDY moduł ze stanem rundy jest bezczynny.
 *   node tools/test-swieze-moduly.mjs
 *
 * W Kręgu następny gracz nie może odziedziczyć cudzej uzbrojonej techniki, chmury
 * dymu ani paska mocy. Większość modułów nie ma reset(), więc fabryka zwraca NOWE
 * instancje; ten test pilnuje, że żadna nie jest "brudna" i że zbiór kluczy
 * zgadza się z modułami, których main.js faktycznie używa.
 */
import { readFileSync } from 'node:fs';

// Atrapa DOM jak w tools/test-dym.mjs - dym.js i spółka tworzą płótna.
function atrapaCtx() {
    return {
        canvas: { width: 960, height: 540 }, globalAlpha: 1,
        clearRect() {}, drawImage() {}, save() {}, restore() {},
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}, fillRect() {}, stroke() {}, beginPath() {},
        moveTo() {}, lineTo() {}, translate() {}, rotate() {}
    };
}
globalThis.document = {
    createElement() {
        const plotno = { width: 1, height: 1, _ctx: null };
        plotno.getContext = () => (plotno._ctx ??= atrapaCtx());
        return plotno;
    },
    fonts: { load: async () => [], ready: Promise.resolve() }
};

const { swiezeModuly, KLUCZE_MODULOW } = await import('../js/swiezeModuly.js');

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('ZBIÓR KLUCZY:');
{
    const m = swiezeModuly();
    spr('fabryka zwraca dokładnie KLUCZE_MODULOW', Object.keys(m).sort().join() === [...KLUCZE_MODULOW].sort().join());
    for (const k of KLUCZE_MODULOW) spr(`'${k}' jest obiektem`, m[k] && typeof m[k] === 'object');
    // Strażnik od strony main.js: każdy moduł rundy, który main.js przepina po
    // restarcie, musi być na liście. Nowy `let x = new Klasa()` w main.js bez wpisu
    // tutaj = dziedziczenie stanu między graczami.
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    const zMaina = [...main.matchAll(/^let (\w+) = new (\w+)\(/gm)].map(x => x[1]);
    // Moduły, których stan NIE należy do rundy (trackery, aura, audio, debug, rejestr znaków, HUD, punkty, przebieg):
    const POZA_RUNDA = new Set(['handTracker', 'poseTracker', 'audioEngine', 'debugHud', 'znaki', 'punkty', 'aura']);
    for (const nazwa of zMaina) {
        if (POZA_RUNDA.has(nazwa)) continue;
        spr(`main.js: '${nazwa}' jest w fabryce albo świadomie poza rundą`, KLUCZE_MODULOW.includes(nazwa));
    }
    // Drugi strażnik (2026-10-02): moduł JEST w fabryce, ale resetujModuly() w main.js
    // musi go jeszcze PRZYPIĄĆ z powrotem do zmiennej - inaczej po restarcie rundy
    // main.js dalej rysuje STARĄ instancję (efekt poprzedniego gracza w Kręgu).
    const reset = main.match(/function resetujModuly\(\) \{\s*\(\{([^}]*)\}\s*=\s*swiezeModuly\(/);
    spr('main.js: resetujModuly() destrukturyzuje wynik swiezeModuly()', !!reset);
    const przypiete = new Set((reset?.[1] ?? '').split(',').map(x => x.trim()).filter(Boolean));
    for (const klucz of KLUCZE_MODULOW) {
        spr(`resetujModuly() przypina '${klucz}' z powrotem do main.js`, przypiete.has(klucz));
    }
}

console.log('\nBEZCZYNNOŚĆ (REVIEW FOCUS 5):');
{
    const m = swiezeModuly();
    spr('płonący palec BEZCZYNNY', m.plonacyPalec.stan === 'BEZCZYNNY');
    spr('podmuch BEZCZYNNY', m.podmuch.stan === 'BEZCZYNNY');
    spr('okadzenie BEZCZYNNE', m.dmuchanie.stan === 'BEZCZYNNY');
    spr('dym bez kłębów', m.dym.liczba === 0);
    spr('fala bez cząstek, czół i wirów', m.fala.czastki.length === 0 && m.fala.czola.length === 0 && m.fala.wiry.length === 0);
    spr('ogień bez cząstek', m.ogien.czastki.length === 0);
    spr('iskry bez cząstek', m.iskry.czastki.length === 0);
    spr('tęcza nieaktywna', m.tecza.aktywna === false && m.tecza.silaSladu === 0);
    spr('efekty puste', m.efekty.aktywne.length === 0);
    spr('runy puste', m.runy.aktywne.length === 0);
    spr('kołowrót nie trwa', m.kolowrot._trwa === false);
    spr('kamienna tarcza nie trwa', m.kamiennaTarcza.aktywny === false);
    spr('mgła mokoszy nie trwa', m.mglaMokoszy.aktywny === false);
    spr('wodna kula nie trwa', m.wodnaKula.aktywny === false);
    spr('łuk peruna nie trwa', m.lukPeruna.aktywny === false);
    spr('kurzawa nie trwa', m.kurzawa.aktywny === false);
    spr('zapłon nie trwa', m.zaplon._trwa === false);
    spr('ekran nie drży', m.ekran._trwa === false);
    spr('piorun nie bije', m.piorun._trwa === false);
    spr('bufor kombosów pusty', m.kombosy.bufor.length === 0);
    spr('pasek mocy pusty', m.motionMeter.moc === 0);
}

console.log('\nNOWE INSTANCJE (nie te same obiekty):');
{
    const a = swiezeModuly(), b = swiezeModuly();
    for (const k of KLUCZE_MODULOW) spr(`'${k}' to nowa instancja przy każdym wywołaniu`, a[k] !== b[k]);
    a.motionMeter.moc = 0.9;
    a.kombosy.dodaj('swarog', 0);
    a.plonacyPalec.uzbroj?.();
    spr('brudzenie jednego zestawu nie rusza drugiego', b.motionMeter.moc === 0 && b.kombosy.bufor.length === 0);
}

console.log('\nDOM PASKA SEKWENCJI:');
{
    const dzieci = [];
    const elSloty = { replaceChildren() { dzieci.length = 0; }, appendChild(x) { dzieci.push(x); }, children: dzieci, childElementCount: 0 };
    swiezeModuly({ slotySekwencji: elSloty, nazwaSekwencji: { textContent: 'x' } });
    spr('stare sloty paska sekwencji wyczyszczone', dzieci.length === 0);
}

process.exit(ok ? 0 : 1);
