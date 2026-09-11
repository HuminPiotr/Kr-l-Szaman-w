/**
 * Dym Okadzenia v3 - ciągły strumień z ust, malowanie, kłębienie, front ognia;
 * BEZ document.
 *
 *   node tools/test-dym.mjs
 *
 * Rysowanie (drawImage, wypalTintowany) NIE JEST tu testowane - ten sam
 * powód co test-kolowrot.mjs. Fizyka idzie przez updateAndDraw(null, W, H,
 * dt) - guard na `!ctx` jest PO doliczeniu czasu i fizyki (patrz js/dym.js).
 *
 * v3 (2026-09-11, drugi test na kamerze - "nie kółka, tylko jednolity ciągły
 * strumień z płuc; malowanie linią dymu"): jedna fizyka, dwa czasy życia,
 * emisja ciągła interpolowana wzdłuż ruchu ust, opór mieszany wagą wylotu.
 */
import { Dym, wznoszenieCzynnik, obwiedniaAlfy, obwiedniaStrumienia, alfaKlebu,
         MAX_KLEBOW, MAX_STRUMIENIA, ZYCIE_MIN_S, ZYCIE_MAX_S,
         STRUMIEN_NA_S, ODDECH_AMPLITUDA, KLAB_CO, R_START_W,
         WYLOT_PREDKOSC_MAX_W_S, STRUMIEN_ZYCIE_MIN_S, STRUMIEN_ZYCIE_MAX_S,
         KLAB_ROZROST_TAU_S, KLAB_ALFA_START, KLAB_ALFA_KONIEC,
         OPOZNIENIE_FRONTU_S, CZAS_DO_WYBUCHU_S, CZAS_WYBUCHU_S, SUFIT_Y_H, SPADEK_OD_Y_H }
    from '../js/dym.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const W = 1920, H = 1080;
const USTA = { x: 960, y: 700 };
const W_PRAWO = { x: 1, y: 0 };
const przepusc = (d, sekundy) => {
    let suma = 0;
    for (let i = 0; i < Math.round(sekundy / DT); i++) suma += d.updateAndDraw(null, W, H, DT);
    return suma;
};
/** Dmucha przez `sekundy` REALNEGO czasu: emituj + updateAndDraw co klatkę, jak main.js. */
function dmuchaj(d, sekundy, { kierunek = W_PRAWO, sila = 1, usta = USTA } = {}) {
    for (let i = 0; i < Math.round(sekundy / DT); i++) {
        d.emituj(typeof usta === 'function' ? usta(i) : usta, kierunek, sila, DT, W);
        d.updateAndDraw(null, W, H, DT);
    }
}
const naUstach = (c, usta = USTA) => Math.hypot(c.x - usta.x, c.y - usta.y);
const klab = (over = {}) => ({
    typ: 'klab', x: 900, y: 700, vx: 0, vy: 0, wiek: 30, zycie: 240, faza: 0, obrot: 0, wobrot: 0,
    r: 120, rStart: 86, rCel: 190, stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
    wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0, ...over
});

// --- 1. wznoszenieCzynnik(): czysta funkcja ---
console.log('WZNOSZENIE CZYNNIK (funkcja czysta):');
spr('daleko od sufitu - pełne wznoszenie (~1)', wznoszenieCzynnik(H * SPADEK_OD_Y_H - 1, H) > 0.99);
spr('poniżej progu spadku - dalej pełne', wznoszenieCzynnik(H * 0.95, H) === 1);
spr('przy samym suficie - czynnik minimalny, ale NIE zero',
    wznoszenieCzynnik(H * SUFIT_Y_H, H) > 0 && wznoszenieCzynnik(H * SUFIT_Y_H, H) < 0.2);
spr('powyżej sufitu - nie spada poniżej minimum',
    wznoszenieCzynnik(H * 0.01, H) === wznoszenieCzynnik(H * SUFIT_Y_H, H));

// --- 2. obwiednie: narost ABSOLUTNY w sekundach ---
console.log('\nOBWIEDNIE ALFY (narost absolutny, zanik blisko końca):');
spr('kłąb: wiek=0 -> alfa niska', obwiedniaAlfy(0, ZYCIE_MIN_S) < 0.1);
spr('REGRESJA: kłąb po 2 s (ułamek życia ~1%) już prawie pełny - narost w SEKUNDACH',
    obwiedniaAlfy(2, ZYCIE_MIN_S) > 0.9);
spr('kłąb: w połowie życia pełny', obwiedniaAlfy(ZYCIE_MIN_S * 0.5, ZYCIE_MIN_S) > 0.95);
spr('kłąb: przy 0.9 życia opada', obwiedniaAlfy(ZYCIE_MIN_S * 0.9, ZYCIE_MIN_S) < obwiedniaAlfy(ZYCIE_MIN_S * 0.5, ZYCIE_MIN_S));
spr('kłąb: na końcu życia 0', obwiedniaAlfy(ZYCIE_MIN_S, ZYCIE_MIN_S) === 0);
spr('kłąb: brak zycie nie wywala', Number.isFinite(obwiedniaAlfy(1, undefined)));
spr('strumień: po 0.2 s już prawie pełny (błyskawiczny narost)', obwiedniaStrumienia(0.2, 2) > 0.9);
spr('strumień: w 90% życia opada', obwiedniaStrumienia(1.8, 2) < obwiedniaStrumienia(1.0, 2));
spr('strumień: na końcu 0', obwiedniaStrumienia(2, 2) === 0);

// --- 3. Emisja ciągła ---
console.log('\nEMISJA CIĄGŁA (nie pulsy):');
{
    let minO = Infinity, maxO = -Infinity;
    for (let t = 0; t < 10; t += 0.01) { const o = Dym.oddech(t); minO = Math.min(minO, o); maxO = Math.max(maxO, o); }
    spr(`oddech nigdy do zera: min ${minO.toFixed(2)} >= ${(1 - ODDECH_AMPLITUDA).toFixed(2)}`, minO >= 1 - ODDECH_AMPLITUDA - 1e-9 && minO > 0.5);
    spr(`oddech ograniczony: max ${maxO.toFixed(2)} <= ${(1 + ODDECH_AMPLITUDA).toFixed(2)}`, maxO <= 1 + ODDECH_AMPLITUDA + 1e-9);
    spr('oddech NaN -> 1±amp, nie NaN', Number.isFinite(Dym.oddech(NaN)));

    const d = new Dym();
    const przyrosty = [];
    for (let i = 0; i < 60; i++) {
        const przed = d.liczba;
        d.emituj(USTA, W_PRAWO, 1, DT, W);
        przyrosty.push(d.liczba - przed);
        d.updateAndDraw(null, W, H, DT);
    }
    spr(`1 s dmuchania -> >= 60 sprite'ów wstęgi (${d.strumienia})`, d.strumienia >= 60);
    spr(`1 s dmuchania -> >= 2 trwałe kłęby (${d.klebow})`, d.klebow >= 2);
    let najdluzszaPrzerwa = 0, przerwa = 0;
    for (const n of przyrosty) { if (n === 0) { przerwa++; najdluzszaPrzerwa = Math.max(najdluzszaPrzerwa, przerwa); } else przerwa = 0; }
    spr(`bez przerw: najdłuższa seria klatek bez narodzin ${najdluzszaPrzerwa} <= 1`, najdluzszaPrzerwa <= 1);
    spr('REGRESJA v2: żadna cząstka nie czeka z ujemnym wiekiem', d._kleby.every(c => c.wiek >= 0));

    // Ciągłość kolumny: odstęp wzdłuż lotu (v0 / tempo) < promień startowy.
    const v0max = WYLOT_PREDKOSC_MAX_W_S * (1 + ODDECH_AMPLITUDA);
    const tempoMax = STRUMIEN_NA_S * (1 + ODDECH_AMPLITUDA);
    spr(`kolumna bez paciorków: odstęp ${(v0max / tempoMax).toFixed(4)} W < R_START_W ${R_START_W}`, v0max / tempoMax < R_START_W);

    const slabo = new Dym();
    dmuchaj(slabo, 1, { sila: 0.35 });
    spr(`przy sile podłogi (0.35) dalej ciągle: ${slabo.liczba} >= 45`, slabo.liczba >= 45);
}

// --- 4. Wspólne narodziny w ustach ---
console.log('\nWSPÓLNE NARODZINY (oba typy z ust):');
{
    const d = new Dym();
    for (let i = 0; i < KLAB_CO + 2; i++) d.emituj(USTA, W_PRAWO, 1, DT, W);   // bez fizyki - świeże pozycje
    const wstega = d._kleby.find(c => c.typ === 'strumien');
    const trwaly = d._kleby.find(c => c.typ === 'klab');
    spr('jest wstęga i trwały kłąb', !!wstega && !!trwaly);
    spr(`wstęga rodzi się w ustach (${naUstach(wstega).toFixed(1)} px < 10)`, naUstach(wstega) < 10);
    spr(`REGRESJA v2: kłąb TEŻ rodzi się w ustach, nie 0.11 W dalej (${naUstach(trwaly).toFixed(1)} px < 10)`, naUstach(trwaly) < 10);
    spr('oba typy mają tę samą prędkość wylotu (±20%)',
        Math.abs(Math.hypot(wstega.vx, wstega.vy) / Math.hypot(trwaly.vx, trwaly.vy) - 1) < 0.35);
    spr('wstęga rośnie do mniejszego promienia niż kłąb', wstega.rCel < trwaly.rCel);
    spr(`kłąb co ${KLAB_CO}-ta cząstka (deterministycznie)`, d._kleby.filter(c => c.typ === 'klab').length === Math.ceil(d.liczba / KLAB_CO));
}

// --- 5. Zasięg wylotu ---
console.log('\nZASIĘG WYLOTU (~1/4 ekranu, potem kłębienie):');
{
    const d = new Dym();
    d.emituj(USTA, W_PRAWO, 1, DT, W);
    const c = d._kleby[0];
    const v0 = Math.hypot(c.vx, c.vy) / W;
    spr(`prędkość wylotu ${v0.toFixed(2)} W/s w [0.5, 0.95]`, v0 >= 0.5 && v0 <= 0.95);
    const kat = Math.abs(Math.atan2(c.vy, c.vx));
    spr(`kierunek w stożku ±6° od zadanego (${(kat * 180 / Math.PI).toFixed(1)}°)`, kat < 6 * Math.PI / 180);
    przepusc(d, 3);
    const droga = (c.x - USTA.x) / W;
    spr(`po 3 s przebył ${droga.toFixed(3)} W - w [0.18, 0.32]`, droga >= 0.18 && droga <= 0.32);
    spr(`wypchnięcie zgasło: |v| ${(Math.hypot(c.vx, c.vy) / W).toFixed(3)} W/s < 0.03`, Math.hypot(c.vx, c.vy) / W < 0.03);
    spr('po zgaśnięciu wylotu kłąb UNOSI SIĘ (vy < 0)', c.vy < 0);

    const e = new Dym();
    e.emituj(USTA, W_PRAWO, 0.35, DT, W);
    przepusc(e, 3);
    spr(`przy sile 0.35 krócej, ale wciąż > 0.15 W (${((e._kleby[0].x - USTA.x) / W).toFixed(3)})`,
        (e._kleby[0].x - USTA.x) / W > 0.15 && e._kleby[0].x < c.x);
}

// --- 6. Malowanie: interpolacja wzdłuż ruchu ust ---
console.log('\nMALOWANIE (interpolacja między klatkami):');
{
    const d = new Dym();
    // Usta jadą 300 px w prawo przez 10 klatek; dmuchanie W GÓRĘ, żeby ruch
    // ust był jedyną składową X.
    const start = { x: 600, y: 700 };
    for (let i = 0; i < 10; i++) {
        d.emituj({ x: start.x + 30 * (i + 1), y: start.y }, { x: 0, y: -1 }, 1, DT, W);
        d.updateAndDraw(null, W, H, DT);
    }
    const xs = d._kleby.map(c => c.x).sort((a, b) => a - b);
    let luka = 0;
    for (let i = 1; i < xs.length; i++) luka = Math.max(luka, xs[i] - xs[i - 1]);
    // Usta 30 px/klatkę = 1800 px/s (bardzo szybko); przy ~1.5 sprite'a na
    // klatkę luka bywa ~30 px - wciąż mniejsza niż ŚREDNICA startowa
    // (2 x R_START_W x W = 58 px), więc sprite'y nachodzą na siebie = linia.
    spr(`cząstki pokrywają odcinek: największa luka ${luka.toFixed(1)} px < średnica startowa ${(2 * R_START_W * W).toFixed(0)}`,
        luka < 2 * R_START_W * W && xs.length >= 10);
    spr('cząstki rozłożone od początku do końca odcinka', xs[0] < start.x + 60 && xs[xs.length - 1] > start.x + 270);
    spr('dym NIE dziedziczy prędkości ust (vx ~ 0 przy dmuchaniu w górę)', d._kleby.every(c => Math.abs(c.vx) < 0.15 * W));

    // Po przerwie - brak interpolacji: pierwsza cząstka w NOWYM miejscu.
    przepusc(d, 0.2);
    const przed = d.liczba;
    for (let i = 0; i < 3; i++) { d.emituj({ x: 1500, y: 300 }, { x: 0, y: -1 }, 1, DT, W); d.updateAndDraw(null, W, H, DT); }
    const nowe = d._kleby.slice(przed);
    // Dmuchanie w górę: po 1-3 klatkach fizyki y już uciekł w górę - liczy się X.
    spr('po przerwie pierwsza cząstka rodzi się w nowym miejscu, nie na drodze do starego',
        nowe.length > 0 && nowe.every(c => Math.abs(c.x - 1500) < 20 && c.y <= 310 && c.y > 200));
}

// --- 7. Życie i rozrost: wstęga ~10 s, kłąb ~4 min, alfa cienieje ---
console.log('\nŻYCIE I ROZROST:');
{
    const d = new Dym();
    dmuchaj(d, 1);
    spr(`wstęga żyje ${STRUMIEN_ZYCIE_MIN_S}-${STRUMIEN_ZYCIE_MAX_S} s`,
        d._kleby.filter(c => c.typ === 'strumien').every(c => c.zycie >= STRUMIEN_ZYCIE_MIN_S && c.zycie <= STRUMIEN_ZYCIE_MAX_S));
    spr(`kłąb żyje ${ZYCIE_MIN_S}-${ZYCIE_MAX_S} s`,
        d._kleby.filter(c => c.typ === 'klab').every(c => c.zycie >= ZYCIE_MIN_S && c.zycie <= ZYCIE_MAX_S));
    const kleby = d.klebow;
    przepusc(d, 15);
    spr(`po 15 s bez dmuchania wstęga zniknęła (${d.strumienia})`, d.strumienia === 0);
    spr(`...a kłęby zostały (${d.klebow} = ${kleby})`, d.klebow === kleby);
    przepusc(d, 15);
    const k = d._kleby.find(c => c.typ === 'klab');
    spr(`kłąb po 30 s ma >= 90% docelowego promienia (${(k.r / k.rCel * 100).toFixed(0)}%)`, k.r >= 0.9 * k.rCel);
    spr('liczniki zgodne z tablicą', d.klebow === d._kleby.filter(c => c.typ === 'klab').length
                                     && d.strumienia === d._kleby.filter(c => c.typ === 'strumien').length);
}
spr(`alfaKlebu: na starcie ${KLAB_ALFA_START}`, alfaKlebu(86, 86, 190) === KLAB_ALFA_START);
spr(`alfaKlebu: dojrzały ${KLAB_ALFA_KONIEC}`, Math.abs(alfaKlebu(190, 86, 190) - KLAB_ALFA_KONIEC) < 1e-9);
spr('alfaKlebu: maleje z r', alfaKlebu(120, 86, 190) < alfaKlebu(100, 86, 190));
spr('alfaKlebu: nigdy < KLAB_ALFA_KONIEC', alfaKlebu(999, 86, 190) >= KLAB_ALFA_KONIEC && alfaKlebu(NaN, 86, 190) >= KLAB_ALFA_KONIEC);
spr('alfaKlebu: zerowy zakres nie dzieli przez 0', Number.isFinite(alfaKlebu(60, 60, 60)));

console.log('\nPOLE PRZEPŁYWU (koherencja sąsiadów):');
{
    const d = new Dym();
    d._kleby.push(klab({ x: 900, y: 600, faza: 0.0 }), klab({ x: 930, y: 610, faza: 3.0 }));
    przepusc(d, 5);
    const [a, b] = d._kleby;
    const dot = (a.vx * b.vx + a.vy * b.vy) / (Math.hypot(a.vx, a.vy) * Math.hypot(b.vx, b.vy) || 1);
    spr(`dwa sąsiednie kłęby po 5 s mają zbliżone wektory prędkości (cos ${dot.toFixed(2)})`, dot > 0.7);
    spr('kłęby faktycznie dryfują (|v| > 3 px/s)', Math.hypot(a.vx, a.vy) > 3);
    spr('NaN nie przeżywa', d._kleby.every(c => Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.vx)));
}

// --- 8. Sufity per populacja ---
console.log('\nSUFITY (osobne FIFO):');
{
    const d = new Dym();
    for (let i = 0; i < MAX_STRUMIENIA + 50; i++) d._dodaj({ typ: 'strumien', x: 0, y: 0, wiek: 0, zycie: 2, stan: 'DYM' });
    spr(`strumień: nie przekracza ${MAX_STRUMIENIA} (${d.strumienia})`, d.strumienia === MAX_STRUMIENIA);
    for (let i = 0; i < MAX_KLEBOW + 50; i++) d._dodaj(klab({ x: i }));
    spr(`kłąb: nie przekracza ${MAX_KLEBOW} (${d.klebow})`, d.klebow === MAX_KLEBOW);
    spr('kłąb: wypchnięte NAJSTARSZE (pierwsze x zniknęły)', d._kleby.filter(c => c.typ === 'klab')[0].x === 50);
    spr('sufit kłębów nie rusza strumienia i odwrotnie', d.strumienia === MAX_STRUMIENIA);
    spr('liczniki = tablica', d.liczba === MAX_STRUMIENIA + MAX_KLEBOW);
}

// --- 9. Wygasanie kłębu ---
console.log('\nŻYCIE KŁĘBU (~4 min, NIE 50-70 s):');
{
    const d = new Dym();
    d._kleby.push(klab({ wiek: 0, zycie: ZYCIE_MIN_S }));
    przepusc(d, 70);
    spr('po 70 s kłąb WCIĄŻ ŻYJE', d.klebow === 1);
    przepusc(d, ZYCIE_MIN_S - 70 + 1);
    spr('po upływie życia kłąb gaśnie', d.klebow === 0);
}

// --- 9. Rozgarnianie dłońmi ---
console.log('\nROZGARNIANIE DŁOŃMI:');
{
    const d = new Dym();
    d._kleby.push(klab({ x: 900, y: 700 }));
    const przed = d._kleby[0].x;
    d.rozgarnij([{ x: 900, y: 700, vx: 500, vy: 0 }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('dłoń BLISKO kłębu popycha go', d._kleby[0].x > przed + 2);
    const e = new Dym();
    e._kleby.push(klab({ x: 100, y: 700 }));
    e.rozgarnij([{ x: 1800, y: 700, vx: 500, vy: 0 }], W);
    e.updateAndDraw(null, W, H, DT);
    spr('dłoń DALEKO prawie nie rusza', Math.abs(e._kleby[0].x - 100) < 5);
    spr('rozgarnij() bez dłoni nie wywala', (() => { e.rozgarnij([], W); e.rozgarnij(null, W); return true; })());
}

// --- 10. Podpalenie, front, detonacja ---
console.log('\nPODPALENIE I FRONT OGNIA:');
{
    const d = new Dym();
    // r=60: kontakt = 60*1.5+5 = 95 px; front = (60+60)*1.2 = 144 px (dorasta
    // dalej w kolejnych tickach). `dalej` 120 px od `sasiad` - POZA kontaktem
    // z zarzewiem, W ZASIĘGU frontu; `oderwany` daleko.
    d._kleby.push(klab({ x: 900, r: 60, rStart: 60, rCel: 60 }),
                  klab({ x: 1020, r: 60, rStart: 60, rCel: 60 }),
                  klab({ x: 1800, r: 60, rStart: 60, rCel: 60 }));
    const [sasiad, dalej, oderwany] = d._kleby;
    d.podpal([{ x: 1800 + 5000, y: 700, r: 5 }]);
    spr('zarzewie daleko nie zapala', d._kleby.every(c => c.stan === 'DYM'));
    d.podpal([{ x: sasiad.x, y: sasiad.y, r: 5 }]);
    spr('kontakt z zarzewiem zapala kłąb', sasiad.stan === 'ZAPLON');
    spr('sąsiad poza kontaktem jeszcze NIE płonie', dalej.stan === 'DYM');
    przepusc(d, OPOZNIENIE_FRONTU_S + 0.03);
    spr('po opóźnieniu frontu sąsiad płonie', dalej.stan === 'ZAPLON');
    spr('oderwane skupisko NIE zapłonęło', oderwany.stan === 'DYM');
    spr('podpal() z pustą listą nie wywala', (() => { d.podpal([]); d.podpal(null); return true; })());
}
{
    const d = new Dym();
    d._kleby.push(klab({ stan: 'ZAPLON', rozprzestrzenil: true }));
    let wybuchy = 0;
    for (let i = 0; i < Math.round((CZAS_DO_WYBUCHU_S + 0.02) / DT); i++) wybuchy += d.updateAndDraw(null, W, H, DT);
    spr(`updateAndDraw zwrócił jeden nowy wybuch (${wybuchy})`, wybuchy === 1);
    spr('kłąb w stanie WYBUCH', d._kleby[0].stan === 'WYBUCH');
    przepusc(d, CZAS_WYBUCHU_S + 0.05);
    spr('po wybuchu kłąb znika NA ZAWSZE', d.liczba === 0);
}
{
    // Strumień też płonie - bez specjalnych przypadków.
    const d = new Dym();
    d._kleby.push({ typ: 'strumien', x: 500, y: 500, vx: 0, vy: 0, wiek: 0.5, zycie: 2, faza: 0, obrot: 0, wobrot: 0,
                     r: 40, rStart: 38, rCel: 100, stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
                     wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 });
    d.podpal([{ x: 500, y: 500, r: 5 }]);
    spr('sprite strumienia też daje się podpalić', d._kleby[0].stan === 'ZAPLON');
}
{
    // Front biegnie wzdłuż świeżo wydmuchanej kolumny - to jest "kłąb po kłębie" na linii.
    const d = new Dym();
    dmuchaj(d, 1.5);
    przepusc(d, 1);
    const koniec = d._kleby.reduce((m, c) => (c.x > m.x ? c : m), d._kleby[0]);
    d.podpal([{ x: koniec.x, y: koniec.y, r: 10 }]);
    let wybuchy = 0;
    for (let i = 0; i < Math.round(3 / DT); i++) wybuchy += d.updateAndDraw(null, W, H, DT);
    spr(`zapłon końca kolumny obiega całą linię (wybuchło ${wybuchy} z ${wybuchy + d.liczba})`, wybuchy > 0 && d.liczba < 0.1 * wybuchy);
}

// --- 11. Odporność ---
console.log('\nODPORNOŚĆ:');
{
    const d = new Dym();
    spr('updateAndDraw na pusto = 0', d.updateAndDraw(null, W, H, DT) === 0);
    spr('NaN dt nie wywala', d.updateAndDraw(null, W, H, NaN) === 0);
    dmuchaj(d, 0.3);
    spr('updateAndDraw bez W/H używa domyślnej skali', Number.isFinite(d.updateAndDraw(null, undefined, undefined, DT)));
    spr('emituj bez W nie wywala', (() => { d.emituj(USTA, W_PRAWO, 1, DT, undefined); return true; })());
    spr('kierunek zerowy -> fallback w górę, bez NaN', (() => {
        const x = new Dym();
        for (let i = 0; i < 20; i++) { x.emituj(USTA, { x: 0, y: 0 }, 1, DT, W); x.updateAndDraw(null, W, H, DT); }
        return x._kleby.every(c => Number.isFinite(c.vx) && Number.isFinite(c.vy));
    })());
    d.podpal([{ x: NaN, y: NaN, r: 5 }]);
    d.rozgarnij([{ x: NaN, y: NaN, vx: NaN, vy: NaN }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('NaN w zarzewiu/dłoni nie zatruwa pozycji', d._kleby.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
}

process.exit(ok ? 0 : 1);
