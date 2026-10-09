/**
 * Punktacja - punkty tylko PRZYBYWAJĄ (GEMINI.md §2 po przepisaniu 2026-10-01).
 *
 *   node tools/test-punkty.mjs
 *
 * Spec: docs/superpowers/specs/2026-10-01-punktacja-design.md
 */
import {
    Punktacja, wartoscTechniki, TRUDNOSC, PUNKTY_PIECZECI, PUNKTY_ULEWY_NA_S
} from '../js/punkty.js';
import { KOMBOSY } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };
const kombo = (id) => KOMBOSY.find(k => k.id === id);

console.log('STRAŻNIK ROZSZERZALNOŚCI:');
// Nowe combo dodane do KOMBOSY bez wpisu w TRUDNOSC wywala ten test -
// technika nie może wejść do gry "za darmo" (ani za NaN).
for (const k of KOMBOSY) {
    for (const id of k.sekwencja) {
        spr(`pieczęć '${id}' (z ${k.id}) ma trudność`, Number.isFinite(TRUDNOSC[id]) && TRUDNOSC[id] > 0);
    }
    const w = wartoscTechniki(k);
    spr(`${k.id} ma skończoną dodatnią wartość (${w})`, Number.isFinite(w) && w > 0);
}
spr('nieznana pieczęć w sekwencji daje 0, nie NaN',
    wartoscTechniki({ id: 'x', sekwencja: ['swarog', 'nieznana'] }) === 0);
spr('brak sekwencji daje 0', wartoscTechniki(null) === 0 && wartoscTechniki({}) === 0);

console.log('\nWARTOŚCI Z SPECU:');
spr(`Kołowrót = 320 (${wartoscTechniki(kombo('kolowrot'))})`, wartoscTechniki(kombo('kolowrot')) === 320);
spr(`Okadzenie = 460 (${wartoscTechniki(kombo('dym'))})`, wartoscTechniki(kombo('dym')) === 460);
spr(`Grom w Ogniu = 280 (${wartoscTechniki(kombo('gromWOgniu'))})`, wartoscTechniki(kombo('gromWOgniu')) === 280);

console.log('\nTANIEC:');
const t = new Punktacja();
for (let i = 0; i < 60; i++) t.taniec(1, 1, 1 / 60);
spr(`sekunda pełnego tańca = ~4 pkt (${t.wynik.toFixed(2)})`, Math.abs(t.wynik - 4) < 1e-6);
const t2 = new Punktacja();
t2.taniec(1, 0, 1);
spr('bezruch (responsywność 0) nie punktuje', t2.wynik === 0);
const t3 = new Punktacja();
t3.taniec(1, 1, 5);   // powrót z uśpionej karty
spr(`dt przycięte do 0,1 s (${t3.wynik.toFixed(2)})`, Math.abs(t3.wynik - 0.4) < 1e-6);
const t4 = new Punktacja();
t4.taniec(NaN, 1, 0.1); t4.taniec(1, Infinity, 0.1); t4.taniec(1, 1, NaN); t4.taniec(1, 1, -1);
spr('NaN/Infinity/ujemne dt nie zatruwają wyniku', t4.wynik === 0);
spr('rozbicie.taniec = wynik', t.rozbicie.taniec === t.wynik);

console.log('\nZAKLINANIE (Dodola):');
{
    const u = new Punktacja();
    for (let i = 0; i < 60; i++) u.zaklinanie(1, 1 / 60);
    spr(`sekunda pełnej ulewy = PUNKTY_ULEWY_NA_S (${u.wynik.toFixed(2)})`, Math.abs(u.wynik - PUNKTY_ULEWY_NA_S) < 1e-6);
    spr('trafia do warstwy technik', u.rozbicie.techniki === u.wynik && u.rozbicie.taniec === 0);
    const m = new Punktacja(), s = new Punktacja();
    for (let i = 0; i < 60; i++) { m.zaklinanie(0.9, 1 / 60); s.zaklinanie(0.2, 1 / 60); }
    spr(`wąż (0.9) opłaca się >10× bardziej niż skrzydło (0.2): ${m.wynik.toFixed(1)} vs ${s.wynik.toFixed(1)}`, m.wynik > 10 * s.wynik);
    const z = new Punktacja();
    z.zaklinanie(NaN, 0.1); z.zaklinanie(1, NaN); z.zaklinanie(1, -1); z.zaklinanie(-3, 0.1); z.zaklinanie(0, 0.1);
    spr('NaN/ujemne/zero nie punktują', z.wynik === 0);
    const d = new Punktacja();
    d.zaklinanie(1, 5);
    spr('dt przycięte jak przy tańcu', Math.abs(d.wynik - PUNKTY_ULEWY_NA_S * 0.1) < 1e-6);
    const n = new Punktacja();
    n.aktywna = false; n.zaklinanie(1, 0.1);
    spr('tryb swobodny (aktywna=false) nie punktuje', n.wynik === 0);
}

console.log('\nPIECZĘĆ:');
const p = new Punktacja();
spr(`pieczęć daje ${PUNKTY_PIECZECI}`, p.pieczec('swarog', 0) === PUNKTY_PIECZECI);
spr('zła pieczęć (pusty id / NaN czas) nic nie daje', p.pieczec('', 1) === 0 && p.pieczec('swarog', NaN) === 0);

console.log('\nTECHNIKA I MALEJĄCY PRZYROST:');
const m = new Punktacja();
const k = kombo('kolowrot');
const a = m.technika(k, 0), b = m.technika(k, 1), c = m.technika(k, 2), d = m.technika(k, 3);
spr(`100% → 75% → 50% → 50% (${[a, b, c, d].join(', ')})`, a === 320 && b === 240 && c === 160 && d === 160);
const e = m.technika(kombo('gromWOgniu'), 4);
const f = m.technika(k, 5);
spr(`inna technika przywraca 100% (${e}, potem kołowrót ${f})`, e === 280 && f === 320);
spr('momenty liczą techniki', m.momenty.techniki.kolowrot === 5 && m.momenty.techniki.gromWOgniu === 1);

console.log('\nZDARZENIA (do unoszących się napisów):');
const z = new Punktacja();
z.pieczec('perun', 0, { x: 10, y: 20 });
z.technika(kombo('kolowrot'), 1, { x: 30, y: 40 });
const zd = z.odbierzZdarzenia();
spr(`dwa zdarzenia (${zd.length})`, zd.length === 2);
spr('technika niesie nazwę i miejsce', zd[1].tekst === 'Kołowrót' && zd[1].miejsce?.x === 30 && zd[1].punkty === 320);
spr('odbierzZdarzenia czyści kolejkę', z.odbierzZdarzenia().length === 0);

console.log('\nNIEAKTYWNA (tryb swobodny):');
const n = new Punktacja();
n.aktywna = false;
n.taniec(1, 1, 0.1); n.pieczec('swarog', 0); n.technika(kombo('kolowrot'), 1);
spr('zero punktów i zdarzeń', n.wynik === 0 && n.odbierzZdarzenia().length === 0);

console.log('\nZEW (hak):');
const zw = new Punktacja();
zw.mnoznikZewu = (rodzaj) => rodzaj === 'pieczec' ? 2 : 1;
spr('mnożnik zewu podwaja pieczęć', zw.pieczec('swarog', 0) === 2 * PUNKTY_PIECZECI);
zw.mnoznikZewu = () => NaN;
spr('zepsuty mnożnik (NaN) traktowany jak 1', zw.pieczec('swarog', 1) === PUNKTY_PIECZECI);
zw.mnoznikZewu = () => 0.1;
spr('mnożnik < 1 traktowany jak 1 (zew nigdy nie zabiera)', zw.pieczec('swarog', 2) === PUNKTY_PIECZECI);

console.log('\nRESET:');
m.reset();
spr('reset zeruje wynik, rozbicie i momenty', m.wynik === 0 && m.rozbicie.techniki === 0 && !m.momenty.techniki.kolowrot);

console.log('\nSPLECENIE (nakładanie ogonów, nie czas):');
// Ten sam łańcuch co w test-kombosy.mjs: swarog->stribog->swarog daje
// Okadzenie, a ZARAZ potem (bez czyszczenia bufora) perun domyka Grom
// w Ogniu ogonem [swarog, perun] - swarog jest WSPÓLNY. Czwarta pieczęć
// składa się >= 0.9 s po trzeciej, więc próg czasowy by tu nie zadziałał.
const s = new Punktacja();
s.pieczec('swarog', 0); s.pieczec('stribog', 1000); s.pieczec('swarog', 2000);
const okadzenie = s.technika(kombo('dym'), 2000);
s.pieczec('perun', 3500);   // 1.5 s później
const grom = s.technika(kombo('gromWOgniu'), 3500);
spr(`Okadzenie bez premii (${okadzenie})`, okadzenie === 460);
spr(`Grom w Ogniu z premią +50% (${grom})`, grom === 280 + 140);
spr('rozbicie: premia w reakcjach', s.rozbicie.reakcje === 140 && s.rozbicie.techniki === 740);
spr('momenty.splecenia = 1', s.momenty.splecenia === 1);
spr('zdarzenie Splecenie w kolejce', s.odbierzZdarzenia().some(z => z.rodzaj === 'splecenie' && z.punkty === 140));

const bez = new Punktacja();
bez.pieczec('perun', 0); bez.pieczec('weles', 1000); bez.pieczec('mokosz', 2000);
bez.technika(kombo('kolowrot'), 2000);
bez.pieczec('swarog', 3000); bez.pieczec('perun', 4000);
bez.technika(kombo('gromWOgniu'), 4000);
spr(`ogony bez wspólnej pieczęci - brak premii (${bez.rozbicie.reakcje})`, bez.rozbicie.reakcje === 0);

// REVIEW FOCUS 1: stribog x3 odpala Aarda dwa razy z nakładającymi się
// ogonami. Splecenie TEJ SAMEJ techniki ze sobą nagradzałoby spam.
const spam = new Punktacja();
spam.pieczec('stribog', 0); spam.pieczec('stribog', 1000);
spam.technika(kombo('aard'), 1000);
spam.pieczec('stribog', 2000);
spam.technika(kombo('aard'), 2000);
spr(`ta sama technika nie splata się sama ze sobą (${spam.rozbicie.reakcje})`, spam.rozbicie.reakcje === 0);

console.log('\nTRZYMANIE JEDNEJ PIECZĘCI (final review, Important #1):');
{
    // Bufor kombosów nie jest czyszczony, więc przy trzymanej pozie każdy kolejny
    // stribog odpala Aarda OGONEM, który dzieli pieczęć z poprzednim Aardem.
    // Przed poprawką: 25 + 280×0.5 = 165 pkt na pieczęć w nieskończoność.
    // Technika odpalona ogonem nakładającym się na WŁASNY poprzedni ogon
    // płaci tylko pieczęć (25) - to samo wejście, nie nowe złożenie.
    const h = new Punktacja();
    h.pieczec('stribog', 0); h.pieczec('stribog', 1000);
    const pierwszy = h.technika(kombo('aard'), 1000);
    let reszta = 0;
    for (let i = 2; i < 12; i++) {
        h.pieczec('stribog', i * 1000);
        reszta += h.technika(kombo('aard'), i * 1000);
    }
    spr(`pierwszy Aard płaci (${pierwszy})`, pierwszy === 280);
    spr(`10 kolejnych odpaleń z nakładającym się ogonem = 0 pkt techniki (${reszta})`, reszta === 0);
    spr(`10 pieczęci po 25 + pierwszy Aard (${h.wynik})`, h.wynik === 12 * 25 + 280);
    spr('momenty liczą tylko płacące odpalenia', h.momenty.techniki.aard === 1);
    // Przerwa: ogon który NIE dzieli pieczęci z poprzednim to nowe złożenie - płaci.
    h.pieczec('stribog', 20000); h.pieczec('stribog', 21000);
    spr('świeża para po przerwie płaci znowu', h.technika(kombo('aard'), 21000) > 0);
    // Splecenie z INNĄ techniką działa po serii samopowtórzeń.
    const m = new Punktacja();
    m.pieczec('stribog', 0); m.pieczec('stribog', 1000); m.technika(kombo('aard'), 1000);
    m.pieczec('stribog', 2000); m.technika(kombo('aard'), 2000);   // samopowtórzenie = 0
    m.pieczec('swarog', 3000); m.pieczec('stribog', 4000); m.pieczec('swarog', 5000);
    spr('inna technika po serii dalej płaci', m.technika(kombo('dym'), 5000) === 460);
}

console.log('\nREAKCJE:');
const { REAKCJE, punktyJednostki } = await import('../js/punkty.js');
spr('pozoga i rozwianie w rejestrze', !!REAKCJE.pozoga && !!REAKCJE.rozwianie);
// Oczekiwania liczone ZE STAŁYCH rejestru - strojenie (tools/pomiar-reakcji.mjs)
// zmienia liczby, nie ten test.
const PZ = REAKCJE.pozoga;
spr('jednostka pełna do progu', punktyJednostki(PZ, PZ.pelneDo) === PZ.punkty);
spr('za progiem maleje (2× próg = połowa)', punktyJednostki(PZ, 2 * PZ.pelneDo) === PZ.punkty / 2);

const r = new Punktacja();
spr(`10 kłębów = 10 × punkty (${r.reakcja('pozoga', 10, 0)})`, r.wynik === 10 * PZ.punkty);
r.reakcja('pozoga', PZ.pelneDo - 10, 500);   // ta sama seria (przerwa < przerwaMs)
spr(`pełny próg w jednym pożarze = próg × punkty (${r.wynik})`, r.wynik === PZ.pelneDo * PZ.punkty);
const przed = r.wynik;
r.reakcja('pozoga', 100 - PZ.pelneDo, 1000);  // kłęby za progiem - malejąco
const dorzut = r.wynik - przed;
spr(`kłęby za progiem dają mniej za sztukę (${dorzut.toFixed(0)})`, dorzut > 0 && dorzut < (100 - PZ.pelneDo) * PZ.punkty);
spr('momenty.serie.pozoga = 100', r.momenty.serie.pozoga === 100);

const nowy = new Punktacja();
nowy.reakcja('pozoga', 60, 0);
nowy.reakcja('pozoga', 10, 60 + PZ.przerwaMs + 1);   // przerwa > przerwaMs - NOWY pożar, pełne punkty
spr('nowy pożar po przerwie zaczyna od pełnych punktów', Math.abs(nowy.rozbicie.reakcje - (punktyJednostkiSuma(60) + 10 * PZ.punkty)) < 1e-6);
function punktyJednostkiSuma(n) { let s = 0; for (let k = 1; k <= n; k++) s += punktyJednostki(REAKCJE.pozoga, k); return s; }

// REVIEW FOCUS 3
const zle = new Punktacja();
zle.reakcja('pozoga', 0, 0); zle.reakcja('pozoga', -5, 0); zle.reakcja('pozoga', NaN, 0);
zle.reakcja('pozoga', 3, NaN); zle.reakcja('nieznana', 5, 0);
spr('n <= 0, NaN, zły czas i nieznana reakcja nic nie dają', zle.wynik === 0);
zle.reakcja('pozoga', 2.9, 0);
spr('ułamek zaokrąglany w dół (2.9 -> 2 kłęby)', zle.wynik === 2 * PZ.punkty);

// REVIEW FOCUS 5: reakcje NIE idą do kolejki unoszących się napisów (co
// klatkę by zalały ekran) - HUD pokazuje je jako zagregowaną serię.
spr('reakcja nie tworzy zdarzeń', zle.odbierzZdarzenia().length === 0);
const aktywne = r.serieAktywne(1000);
spr(`seria aktywna: Pożoga ×100 (${aktywne.map(s => s.nazwa + '×' + s.n).join()})`,
    aktywne.length === 1 && aktywne[0].nazwa === 'Pożoga' && aktywne[0].n === 100);
spr('seria wygasa po przerwie', r.serieAktywne(1000 + PZ.przerwaMs + 1).length === 0);

console.log('\nSUFIT JEDNOSTEK NA WYWOŁANIE:');
{
    // Fuzz wyłapał: reakcja('pozoga', 1e9) kręciła pętlę miliard razy (zawieszenie
    // gry). Jedna klatka nie może mieć więcej jednostek niż cała chmura dymu.
    const { MAX_JEDNOSTEK_NA_WYWOLANIE } = await import('../js/punkty.js');
    spr('sufit istnieje', Number.isFinite(MAX_JEDNOSTEK_NA_WYWOLANIE) && MAX_JEDNOSTEK_NA_WYWOLANIE > 0);
    const duzo = new Punktacja(), sufit = new Punktacja();
    const t0 = Date.now();
    duzo.reakcja('pozoga', 1e9, 0);
    sufit.reakcja('pozoga', MAX_JEDNOSTEK_NA_WYWOLANIE, 0);
    spr(`1e9 jednostek kończy się szybko (${Date.now() - t0} ms)`, Date.now() - t0 < 200);
    spr('1e9 liczone jak sufit', duzo.wynik === sufit.wynik && duzo.momenty.serie.pozoga === MAX_JEDNOSTEK_NA_WYWOLANIE);
}

console.log('\nNIGDY NIE MALEJE (losowe wywołania):');
const los = new Punktacja();
const smieci = [NaN, Infinity, -Infinity, -1, 0, 0.5, 1, 1e9, undefined, null];
const wez = () => smieci[Math.floor(Math.random() * smieci.length)];
let poprz = 0, monot = true;
for (let i = 0; i < 2000; i++) {
    const t = i * 37;
    switch (i % 5) {
        case 0: los.taniec(wez(), wez(), wez()); break;
        case 1: los.pieczec(['swarog', 'perun', '', null][i % 4], wez() ?? t); break;
        case 2: los.technika(KOMBOSY[i % KOMBOSY.length], t); break;
        case 3: los.reakcja(['pozoga', 'rozwianie', 'x'][i % 3], wez(), t); break;
        case 4: los.reakcja('pozoga', 5, t); break;
    }
    if (!(los.wynik >= poprz) || !Number.isFinite(los.wynik)) monot = false;
    poprz = los.wynik;
}
spr(`wynik monotoniczny i skończony (${los.wynik.toFixed(0)})`, monot);

console.log('\nSTRAŻNIK: reakcje wołane z main.js istnieją w REAKCJE:');
{
    const { readFileSync } = await import('node:fs');
    const zrodlo = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    const wolane = [...zrodlo.matchAll(/punkty\.reakcja\(\s*'(\w+)'/g)].map(m => m[1]);
    spr(`main.js woła reakcje (${wolane.join(', ')})`, wolane.length >= 2);
    for (const id of wolane) spr(`'${id}' jest w REAKCJE`, !!REAKCJE[id]);
}

process.exit(ok ? 0 : 1);
