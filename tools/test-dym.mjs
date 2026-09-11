/**
 * Dym Okadzenia - fizyka kłębów, front ognia, BEZ document/Image.
 *
 *   node tools/test-dym.mjs
 *
 * Rysowanie (drawImage, wypalTintowany) NIE JEST tu testowane - ten sam
 * powód co test-kolowrot.mjs. Fizyka idzie przez updateAndDraw(null, W, H,
 * dt) - guard na `!ctx` jest PO doliczeniu czasu i fizyki (patrz js/dym.js),
 * więc zegar, ruch, front ognia i wybuchy i tak się liczą.
 */
import { Dym, wznoszenieCzynnik, obwiedniaAlfy, MAX_KLEBOW, ZYCIE_MIN_S,
         OPOZNIENIE_FRONTU_S, CZAS_DO_WYBUCHU_S, CZAS_WYBUCHU_S, SUFIT_Y_H, SPADEK_OD_Y_H }
    from '../js/dym.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const W = 1920, H = 1080;
const przepusc = (d, sekundy) => {
    let ostatni = 0;
    for (let i = 0; i < Math.round(sekundy / DT); i++) ostatni += d.updateAndDraw(null, W, H, DT);
    return ostatni;
};

/**
 * emituj() klatka po klatce przez `sekundy` sekund REALNEGO czasu (DT na
 * wywołanie, jak w prawdziwej pętli main.js). emituj() clampuje dt do 0.1 s
 * (ten sam strażnik co reszta gry) - podanie dużego dt w jednym wywołaniu
 * NIE oznacza "jedna sekunda emisji", tylko jedną (przyciętą) klatkę.
 */
function emitujSekundy(d, zaczep, kierunek, sila, sekundy) {
    for (let i = 0; i < Math.round(sekundy / DT); i++) d.emituj(zaczep, kierunek, sila, DT);
}

// --- 1. wznoszenieCzynnik(): czysta funkcja ---
console.log('WZNOSZENIE CZYNNIK (funkcja czysta):');
spr('daleko od sufitu - pełne wznoszenie (~1)', wznoszenieCzynnik(H * SPADEK_OD_Y_H - 1, H) > 0.99);
spr('poniżej progu spadku - dalej pełne (bezpiecznik od dołu)',
    wznoszenieCzynnik(H * 0.95, H) === 1);
spr('przy samym suficie - czynnik minimalny, ale NIE zero',
    wznoszenieCzynnik(H * SUFIT_Y_H, H) > 0 && wznoszenieCzynnik(H * SUFIT_Y_H, H) < 0.2);
spr('powyżej sufitu (poza ekranem) - dalej nie spada poniżej minimum',
    wznoszenieCzynnik(H * 0.01, H) === wznoszenieCzynnik(H * SUFIT_Y_H, H));
const posrodku = wznoszenieCzynnik(H * (SUFIT_Y_H + SPADEK_OD_Y_H) / 2, H);
spr(`w połowie pasma - między minimum a pełnią (${posrodku.toFixed(2)})`, posrodku > 0.2 && posrodku < 0.9);

// --- 2. obwiedniaAlfy(wiek, zycie): czysta funkcja ---
// DWA argumenty (wiek w sekundach, zycie w sekundach), NIE jeden ułamek -
// błąd znaleziony w przeglądzie: narost liczony z UŁAMKA życia dawał ~29 s
// ataku przy zyciu rzędu 230 s (kłąb byłby niewidoczny przez pierwsze pół
// minuty). Testy niżej sprawdzają WPROST, że narost jest ABSOLUTNY.
console.log('\nOBWIEDNIA ALFY (narost absolutny w sekundach, zanik dopiero blisko końca):');
const ZYCIE_TESTOWE = ZYCIE_MIN_S;   // 200 s - reprezentatywne życie kłębu
spr('na starcie (wiek=0) alfa niska (narost)', obwiedniaAlfy(0, ZYCIE_TESTOWE) < 0.1);
spr('REGRESJA: po 2 s (ułamek życia ~1%) alfa JUŻ prawie pełna - narost liczy się w SEKUNDACH, nie w ułamku ~230 s życia',
    obwiedniaAlfy(2, ZYCIE_TESTOWE) > 0.9);
spr('w połowie życia alfa pełna', obwiedniaAlfy(ZYCIE_TESTOWE * 0.5, ZYCIE_TESTOWE) > 0.95);
spr('blisko ZANIK_OD (0.9 życia) alfa już opada',
    obwiedniaAlfy(ZYCIE_TESTOWE * 0.9, ZYCIE_TESTOWE) < obwiedniaAlfy(ZYCIE_TESTOWE * 0.5, ZYCIE_TESTOWE));
spr('na końcu życia alfa = 0', obwiedniaAlfy(ZYCIE_TESTOWE, ZYCIE_TESTOWE) === 0);
spr('poza zakresem (wiek > zycie) nie ujemna, nie NaN',
    Number.isFinite(obwiedniaAlfy(ZYCIE_TESTOWE * 1.5, ZYCIE_TESTOWE)) && obwiedniaAlfy(ZYCIE_TESTOWE * 1.5, ZYCIE_TESTOWE) >= 0);
spr('brak zycie (undefined) nie wywala wyjątku, nie NaN',
    Number.isFinite(obwiedniaAlfy(1, undefined)));

// --- 3. Emisja ---
console.log('\nEMISJA:');
{
    const d = new Dym();
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    spr(`po sekundzie emisji jest kilka kłębów (${d.liczba})`, d.liczba >= 1);
    spr('sila=0 nic nie emituje', (() => {
        const d2 = new Dym();
        emitujSekundy(d2, { x: 960, y: 700 }, { x: 0, y: -1 }, 0, 1);
        return d2.liczba === 0;
    })());
    spr('brak zaczepu nic nie emituje, bez wyjątku', (() => {
        const d2 = new Dym();
        emitujSekundy(d2, null, { x: 0, y: -1 }, 1, 1);
        return d2.liczba === 0;
    })());
}

// --- 4. Sufit wypycha najstarsze ---
console.log('\nSUFIT (MAX_KLEBOW wypycha najstarsze):');
{
    const d = new Dym();
    // MAX_KLEBOW / NA_SEKUNDE sekund emisji ledwo wypełnia sufit - z zapasem,
    // żeby na pewno go przebić.
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 170);
    spr(`liczba kłębów nie przekracza sufitu (${d.liczba} <= ${MAX_KLEBOW})`, d.liczba <= MAX_KLEBOW);
    spr('sufit faktycznie zadziałał (osiągnięty, nie przypadkiem niżej)', d.liczba === MAX_KLEBOW);
}

// --- 5. Życie i wygasanie ---
console.log('\nŻYCIE KŁĘBU (rząd wielkości ~4 min, NIE 50-70 s):');
{
    const d = new Dym();
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    spr('kłąb powstał', d.liczba >= 1);
    przepusc(d, 70);   // dawna granica "wylatuje górą" - dziś NIE ma tu znikać
    spr(`po 70 s kłąb WCIĄŻ ŻYJE (${d.liczba}) - nie wylatuje już w tym oknie`, d.liczba >= 1);
    przepusc(d, ZYCIE_MIN_S + 20);   // z zapasem poza najkrótsze możliwe życie
    spr(`po ~${Math.round(ZYCIE_MIN_S / 60)}+ min kłąb wreszcie zgasł z wieku (${d.liczba})`, d.liczba === 0);
}

// --- 6. Rozgarnianie dłońmi ---
console.log('\nROZGARNIANIE DŁOŃMI:');
{
    const d = new Dym();
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    d.updateAndDraw(null, W, H, DT);   // jeden tick, żeby kłąb miał promień > 0
    const przed = { x: d._kleby[0].x, y: d._kleby[0].y };
    d.rozgarnij([{ x: przed.x, y: przed.y, vx: 500, vy: 0 }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('dłoń BLISKO kłębu popycha go (x rośnie)', d._kleby[0].x > przed.x);
}
{
    const d = new Dym();
    emitujSekundy(d, { x: 100, y: 700 }, { x: 0, y: -1 }, 1, 1);
    d.updateAndDraw(null, W, H, DT);
    const przed = { x: d._kleby[0].x, y: d._kleby[0].y };
    d.rozgarnij([{ x: 1800, y: 700, vx: 500, vy: 0 }], W);   // daleko
    d.updateAndDraw(null, W, H, DT);
    spr('dłoń DALEKO od kłębu prawie go nie rusza',
        Math.abs(d._kleby[0].x - przed.x) < 20);
}
spr('rozgarnij() bez dłoni nie wywala wyjątku', (() => {
    const d = new Dym();
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    d.rozgarnij([], W);
    d.rozgarnij(null, W);
    return true;
})());

// --- 7. Podpalenie: kontakt z zarzewiem ---
console.log('\nPODPALENIE (kontakt z zarzewiem):');
{
    const d = new Dym();
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    d.updateAndDraw(null, W, H, DT);
    const c = d._kleby[0];
    spr('przed kontaktem: DYM', c.stan === 'DYM');
    d.podpal([{ x: c.x, y: c.y, r: 5, sila: 1 }]);
    spr('kontakt z zarzewiem zapala kłąb (ZAPLON)', c.stan === 'ZAPLON');
}
{
    const d = new Dym();
    emitujSekundy(d, { x: 100, y: 700 }, { x: 0, y: -1 }, 1, 1);
    d.updateAndDraw(null, W, H, DT);
    const c = d._kleby[0];
    d.podpal([{ x: 1800, y: 700, r: 5, sila: 1 }]);   // zarzewie daleko
    spr('zarzewie daleko nie zapala kłębu', c.stan === 'DYM');
}
spr('podpal() z pustą/brakującą listą nic nie robi, bez wyjątku', (() => {
    const d = new Dym();
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    d.podpal([]);
    d.podpal(null);
    return d._kleby[0].stan === 'DYM';
})());

// --- 8. Front ognia: zapala POŁĄCZONY łańcuch, omija oderwane skupisko ---
console.log('\nFRONT OGNIA (kłąb po kłębie, z opóźnieniem):');
{
    const d = new Dym();
    // Geometria dobrana tak, żeby ODRÓŻNIĆ bezpośredni kontakt z zarzewiem
    // (promień = r*ZAPLON_KONTAKT_MNOZNIK + zarzewie.r = 60*1.5+5 = 95 px)
    // od zasięgu FRONTU między dwoma kłębami ((60+60)*1.5 = 180 px): `dalej`
    // leży w odległości 140 px od `sasiad` - POZA bezpośrednim kontaktem
    // z zarzewiem (które siedzi w tym samym miejscu co `sasiad`), ale
    // W ZASIĘGU frontu, gdy `sasiad` już płonie.
    d._kleby.push(
        { x: 900, y: 700, vx: 0, vy: 0, wiek: 100, zycie: 240, faza: 0, obrot: 0, wobrot: 0,
          r: 60, stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
          wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 },
        { x: 1040, y: 700, vx: 0, vy: 0, wiek: 100, zycie: 240, faza: 0, obrot: 0, wobrot: 0,
          r: 60, stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
          wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 },
        // Trzeci kłąb OSOBNO, daleko - front NIE MA prawa go dosięgnąć.
        { x: 1800, y: 700, vx: 0, vy: 0, wiek: 100, zycie: 240, faza: 0, obrot: 0, wobrot: 0,
          r: 60, stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
          wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 }
    );
    const [sasiad, dalej, oderwany] = d._kleby;
    d.podpal([{ x: sasiad.x, y: sasiad.y, r: 5, sila: 1 }]);
    spr('pierwszy kłąb zapłonął', sasiad.stan === 'ZAPLON');
    spr('sąsiad w zasięgu FRONTU, ale POZA bezpośrednim kontaktem z zarzewiem - jeszcze NIE płonie',
        dalej.stan === 'DYM');

    for (let i = 0; i < Math.round((OPOZNIENIE_FRONTU_S + 0.02) / DT); i++) {
        d.updateAndDraw(null, W, H, DT);
    }
    spr(`po opóźnieniu frontu sąsiad też płonie (${dalej.stan})`, dalej.stan === 'ZAPLON');
    spr('oderwane skupisko NIE zapłonęło - front biegnie tylko po połączonym łańcuchu',
        oderwany.stan === 'DYM');
}

// --- 9. Detonacja: ZAPLON -> WYBUCH -> zniknięcie, liczone przez updateAndDraw ---
console.log('\nDETONACJA (ZAPLON -> WYBUCH -> zniknięcie):');
{
    const d = new Dym();
    d._kleby.push({ x: 960, y: 700, vx: 0, vy: 0, wiek: 0, zycie: 240, faza: 0, obrot: 0, wobrot: 0,
                     r: 40, stan: 'ZAPLON', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: true,
                     wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 });
    let wybuchy = 0;
    for (let i = 0; i < Math.round((CZAS_DO_WYBUCHU_S + 0.02) / DT); i++) {
        wybuchy += d.updateAndDraw(null, W, H, DT);
    }
    spr(`updateAndDraw zwrócił dokładnie jeden nowy wybuch w tej klatce (${wybuchy})`, wybuchy === 1);
    spr('kłąb jest teraz w stanie WYBUCH', d._kleby[0].stan === 'WYBUCH');

    for (let i = 0; i < Math.round((CZAS_WYBUCHU_S + 0.05) / DT); i++) d.updateAndDraw(null, W, H, DT);
    spr('po czasie wybuchu kłąb znika NA ZAWSZE (nie wraca do DYM)', d.liczba === 0);
}

// --- 10. Diagnostyka: plonacych ---
console.log('\nDIAGNOSTYKA:');
{
    const d = new Dym();
    d._kleby.push(
        { x: 0, y: 0, vx: 0, vy: 0, wiek: 0, zycie: 240, faza: 0, obrot: 0, wobrot: 0, r: 10,
          stan: 'ZAPLON', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: true, wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 },
        { x: 0, y: 0, vx: 0, vy: 0, wiek: 0, zycie: 240, faza: 0, obrot: 0, wobrot: 0, r: 10,
          stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false, wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0 }
    );
    spr('plonacych liczy tylko ZAPLON, nie DYM', d.plonacych === 1);
}

// --- 11. Odporność ---
console.log('\nODPORNOŚĆ:');
{
    const d = new Dym();
    spr('updateAndDraw z pustą listą kłębów nic nie psuje', d.updateAndDraw(null, W, H, DT) === 0);
    spr('updateAndDraw z NaN dt nie wywala wyjątku', d.updateAndDraw(null, W, H, NaN) === 0);
    emitujSekundy(d, { x: 960, y: 700 }, { x: 0, y: -1 }, 1, 1);
    spr('updateAndDraw bez W/H (undefined) używa domyślnej skali, bez wyjątku',
        Number.isFinite(d.updateAndDraw(null, undefined, undefined, DT)));
    // Zarzewie/dłoń z NaN nie zatruwa kłębów.
    d.podpal([{ x: NaN, y: NaN, r: 5 }]);
    d.rozgarnij([{ x: NaN, y: NaN, vx: NaN, vy: NaN }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('NaN w zarzewiu/dłoni nie zatruwa pozycji kłębów',
        d._kleby.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
}

process.exit(ok ? 0 : 1);
