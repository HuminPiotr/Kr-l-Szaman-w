/**
 * Dispatch pieczęci/technik (js/techniki.js) - wyciągnięty z main.js (P1.2),
 * żeby stanowisko VFX (tools/scena.html) mogło odpalać dokładnie te same
 * efekty co prawdziwa gra.
 *
 *   node tools/test-techniki.mjs
 *
 * Worek zależności `s` to SZPIEDZY - każda metoda tylko zapisuje swoje
 * wywołanie do wspólnego dziennika `log`, zamiast robić cokolwiek
 * prawdziwego (bez document, jak reszta narzędzi w tools/). Test przypina
 * DOKŁADNY zbiór wywołań na każdą gałąź `uzbraja` - jeśli ktoś przy okazji
 * innej zmiany doda/usunie efekt z jednej techniki, test to złapie.
 */
import { odpalPieczec, odpalTechnike, BARWA_GROMU, BARWA_ZAPLONU } from '../js/techniki.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

/** Tworzy worek szpiegów - każda wywołana metoda dopisuje "klucz.metoda" do log. */
function zrobWorek(log) {
    const szpieg = (klucz) => new Proxy({}, {
        get(_, metoda) {
            return (...args) => { log.push({ wolanie: `${klucz}.${String(metoda)}`, args }); };
        }
    });
    return {
        efekty: szpieg('efekty'),
        runy: szpieg('runy'),
        aura: szpieg('aura'),
        // BRAK `audio` w worku: gra nie ma efektów dźwiękowych (2026-10-01). Szpieg tu NIE istnieje,
        // więc każda próba `s.audio.coś()` w kodzie rzuci TypeError i test padnie.
        sekwencja: szpieg('sekwencja'),
        kombosy: { bufor: [{ id: 'swarog', t: 0 }, { id: 'weles', t: 1 }, { id: 'perun', t: 2 }] },
        zaplon: szpieg('zaplon'),
        ekran: szpieg('ekran'),
        plonacyPalec: szpieg('plonacyPalec'),
        podmuch: szpieg('podmuch'),
        tecza: szpieg('tecza'),
        piorun: szpieg('piorun'),
        fala: szpieg('fala'),
        iskry: szpieg('iskry'),
        kolowrot: szpieg('kolowrot'),
        dmuchanie: szpieg('dmuchanie'),
        kamiennaTarcza: szpieg('kamiennaTarcza'),
        mglaMokoszy: szpieg('mglaMokoszy'),
        kregiMokoszy: szpieg('kregiMokoszy'),
        lukPeruna: szpieg('lukPeruna'),
        kurzawa: szpieg('kurzawa'),
        bania: szpieg('bania'),
    };
}

const FRAME = { hands: [], pose: null, width: 1920, height: 1080 };
const W = 1920, H = 1080, NOW = 1000;
const wolania = (log) => log.map(w => w.wolanie);
const zawiera = (log, nazwa) => wolania(log).includes(nazwa);

// --- 1. odpalPieczec() ---
console.log('ODPAL PIECZEĆ:');
{
    const log = [];
    const s = zrobWorek(log);
    odpalPieczec('swarog', FRAME, W, H, s);
    spr('efekty.odpal wywołane', zawiera(log, 'efekty.odpal'));
    spr('runy.odpal wywołane', zawiera(log, 'runy.odpal'));
    spr('aura.rozblysk wywołane', zawiera(log, 'aura.rozblysk'));
    spr('żadnych wywołań audio (gra nie ma efektów dźwiękowych)', !wolania(log).some(w => w.startsWith('audio.')));
    spr('dokładnie 3 wywołania, nic więcej', log.length === 3);
}

// --- 2. odpalTechnike() per gałąź uzbraja ---
console.log('\nODPAL TECHNIKĘ (per gałąź uzbraja):');

function testTechnika(uzbraja, sekwencja, oczekiwane, opis) {
    const log = [];
    const s = zrobWorek(log);
    const technika = { id: uzbraja + 'Test', nazwa: opis, uzbraja, sekwencja };
    odpalTechnike(technika, FRAME, W, H, NOW, s);
    const w = wolania(log);
    // Warstwa WSPÓLNA dla wszystkich sześciu technik.
    const wspolne = ['efekty.odpal', 'sekwencja.oznaczCombo', 'aura.rozblysk',
                      'zaplon.zapal', 'ekran.uderz'];
    for (const m of wspolne) spr(`${opis}: warstwa wspólna zawiera ${m}`, w.includes(m));
    spr(`${opis}: bez żadnych wywołań audio`, !w.some(m => m.startsWith('audio.')));
    for (const m of oczekiwane) spr(`${opis}: zawiera ${m}`, w.includes(m));
    // dmuchanie.anuluj wywoływane dla KAŻDEJ techniki OPRÓCZ 'dym'.
    if (uzbraja === 'dym') {
        spr(`${opis}: NIE woła dmuchanie.anuluj (dym anuluje sam siebie)`, !w.includes('dmuchanie.anuluj'));
    } else {
        spr(`${opis}: woła dmuchanie.anuluj (każde inne combo gasi potencjał Okadzenia)`,
            w.includes('dmuchanie.anuluj'));
    }
    return log;
}

testTechnika('gromWZiemie', ['swarog', 'weles', 'perun'],
    ['piorun.uderz', 'fala.wystrzel', 'iskry.wystrzel'], 'Grom w Ziemię');

testTechnika('kolowrot', ['perun', 'weles', 'mokosz'],
    ['kolowrot.zapal'], 'Kołowrót');

testTechnika('tecza', ['swarog', 'mokosz', 'stribog'], ['tecza.aktywuj'], 'Tęcza');

testTechnika('ogien', ['swarog', 'perun'], ['plonacyPalec.uzbrój'], 'Grom w Ogniu');

testTechnika('aard', ['stribog', 'stribog'], ['podmuch.uzbrój'], 'Podmuch Striboga');

testTechnika('dym', ['swarog', 'stribog', 'swarog'], ['dmuchanie.uzbrój'], 'Okadzenie');

testTechnika('kamiennaTarcza', ['weles', 'weles', 'weles'], ['kamiennaTarcza.zapal'], 'Kamienna Tarcza');

testTechnika('mglaMokoszy', ['stribog', 'mokosz'], ['mglaMokoszy.zapal'], 'Mgła Mokoszy');

testTechnika('kregiMokoszy', ['mokosz', 'weles'], ['kregiMokoszy.zapal'], 'Kręgi Mokoszy');

testTechnika('lukPeruna', ['mokosz', 'perun'], ['lukPeruna.zapal'], 'Łuk Peruna');

testTechnika('bania', ['mokosz', 'swarog'], ['bania.zapal'], 'Bania');

testTechnika('kurzawa', ['stribog', 'weles'], ['kurzawa.zapal'], 'Kurzawa');

// --- 3. Zaplon dostaje właściwą barwę per technika ---
console.log('\nBARWA ZAPŁONU PER TECHNIKA:');
{
    const log = [];
    const s = zrobWorek(log);
    odpalTechnike({ id: 'x', nazwa: 'x', uzbraja: 'ogien', sekwencja: ['swarog', 'perun'] }, FRAME, W, H, NOW, s);
    const zapal = log.find(w => w.wolanie === 'zaplon.zapal');
    spr(`ogien -> BARWA_ZAPLONU.ogien (${zapal.args[0]})`,
        JSON.stringify(zapal.args[0]) === JSON.stringify(BARWA_ZAPLONU.ogien));
    spr('siła zapłonu = 1.0 (technika jest gratis, nie karą za niski pasek mocy)', zapal.args[1] === 1.0);
}

// --- 4. Piorun i fala dostają BARWA_GROMU, nie domyślną barwę fali ---
console.log('\nBARWA GROMU:');
{
    const log = [];
    const s = zrobWorek(log);
    odpalTechnike({ id: 'x', nazwa: 'x', uzbraja: 'gromWZiemie', sekwencja: ['swarog', 'weles', 'perun'] },
                  FRAME, W, H, NOW, s);
    const piorun = log.find(w => w.wolanie === 'piorun.uderz');
    const fala = log.find(w => w.wolanie === 'fala.wystrzel');
    spr('piorun.uderz dostaje BARWA_GROMU', JSON.stringify(piorun.args[1]) === JSON.stringify(BARWA_GROMU));
    spr('fala.wystrzel dostaje BARWA_GROMU (nie domyślną bladoniebieską)',
        JSON.stringify(fala.args[3]) === JSON.stringify(BARWA_GROMU));
    spr('fala.wystrzel kierunek {0,-1,0} - pierścień POZIOMY, nie fontanna',
        fala.args[1].x === 0 && fala.args[1].y === -1 && fala.args[1].z === 0);
}

// --- 5. Nieznana gałąź uzbraja - warstwa wspólna, bez wyjątku ---
console.log('\nODPORNOŚĆ:');
{
    const log = [];
    const s = zrobWorek(log);
    let rzucil = false;
    try {
        odpalTechnike({ id: 'x', nazwa: 'x', uzbraja: 'nieznana', sekwencja: [] }, FRAME, W, H, NOW, s);
    } catch { rzucil = true; }
    spr('nieznana gałąź uzbraja nie rzuca wyjątku', !rzucil);
    spr('...i nadal odpala warstwę wspólną', zawiera(log, 'zaplon.zapal') && zawiera(log, 'ekran.uderz'));
}

// --- 6. Stanowisko VFX (tools/scena.html) ma w worku KAŻDĄ z prostych technik ---
// scena.html nie da się uruchomić w Node, a brak modułu w jego `worekTechnik`
// wychodzi dopiero jako TypeError po kliknięciu przycisku.
console.log('\nWOREK STANOWISKA VFX (tools/scena.html):');
{
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('./scena.html', import.meta.url), 'utf8');
    const worek = html.match(/const worekTechnik = \{([^}]*)\}/)?.[1] ?? '';
    const wBworku = new Set(worek.split(',').map(x => x.trim()).filter(Boolean));
    for (const id of ['kamiennaTarcza', 'kurzawa', 'lukPeruna', 'kregiMokoszy', 'mglaMokoszy', 'bania']) {
        spr(`worekTechnik w scena.html zawiera '${id}'`, wBworku.has(id));
    }
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
