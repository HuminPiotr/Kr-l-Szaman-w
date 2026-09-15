/**
 * Dym Okadzenia v7 - cząstki na silniku smoke.js: emisja kierunkowa, opór
 * i wyporność, reakcja na ręce (taniec), front ognia i detonacja.
 *
 *   node tools/test-dym.mjs
 *
 * Rysowanie NIE JEST tu testowane (ten sam powód co test-kolowrot.mjs), ale
 * biblioteka POTRZEBUJE `document` już przy tworzeniu maszyny (buduje sprite
 * dymu na płótnie). Podstawiamy więc ATRAPĘ płótna - dzięki temu fizyka dalej
 * jest testowana bez przeglądarki, a `updateAndDraw(null, ...)` nie rysuje nic
 * na płótnie gry.
 */

// --- Atrapa DOM: musi stać PRZED importem js/dym.js, stąd dynamiczny import ---
function atrapaCtx() {
    return {
        canvas: { width: 960, height: 540 },
        globalAlpha: 1,
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
    }
};

const { Dym, wznoszenieCzynnik, promienCzastki, wiekBiblioteki, skalaCzastki,
        NAROST_S, ZANIK_S, KOLUMNA_S, SKALA_KOLUMNY, TAU_ROZROSTU_S,
        CZASTEK_NA_S, ZYCIE_MIN_S, ZYCIE_MAX_S, MAX_CZASTEK,
        WYRAZISTOSC_PODLOGA, ROZGARNIJ_PROMIEN_W,
        OPOZNIENIE_FRONTU_S, CZAS_WYBUCHU_S,
        SUFIT_Y_H, SPADEK_OD_Y_H } = await import('../js/dym.js');

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const W = 1920, H = 1080;
const USTA = { x: 960, y: 600 };
const W_PRAWO = { x: 1, y: 0 };
const W_DOL = { x: 0, y: 1 };
/** Cząstki biblioteki żyją w PÓŁ rozdzielczości - tu przeliczamy z płótna gry. */
const POL = 0.5;

const przepusc = (d, sekundy) => {
    let suma = 0;
    for (let i = 0; i < Math.round(sekundy / DT); i++) suma += d.updateAndDraw(null, W, H, DT);
    return suma;
};
/** Dmucha przez `sekundy`: emituj + updateAndDraw co klatkę, dokładnie jak main.js. */
function dmuchaj(d, sekundy, { kierunek = W_PRAWO, sila = 1, wyrazistosc = 1, usta = USTA } = {}) {
    for (let i = 0; i < Math.round(sekundy / DT); i++) {
        d.emituj(usta, kierunek, sila, wyrazistosc, DT, W, H);
        d.updateAndDraw(null, W, H, DT);
    }
}
const wszystkie = (d) => d._czastki;
/**
 * Dmucha tyle klatek, ile trzeba, żeby powstała pierwsza cząstka, i ją zwraca.
 * Przy 26 cząstkach/s jedna klatka (1/60 s) to 0.43 cząstki - pojedyncze
 * emituj() często nie tworzy jeszcze nic (nadwyżka przechodzi dalej).
 */
function pierwszaCzastka(d, opts = {}) {
    for (let i = 0; i < 30 && d.liczba === 0; i++) {
        d.emituj(opts.usta ?? USTA, opts.kierunek ?? W_PRAWO,
                  opts.sila ?? 1, opts.wyrazistosc ?? 1, DT, W, H);
    }
    return wszystkie(d)[wszystkie(d).length - 1];
}
const srodek = (cz) => ({
    x: cz.reduce((a, c) => a + c.x, 0) / cz.length,
    y: cz.reduce((a, c) => a + c.y, 0) / cz.length
});

// --- 1. wznoszenieCzynnik(): czysta funkcja ---
console.log('WZNOSZENIE CZYNNIK (funkcja czysta):');
spr('daleko od sufitu - pełne wznoszenie (~1)', wznoszenieCzynnik(H * SPADEK_OD_Y_H - 1, H) > 0.99);
spr('poniżej progu spadku - dalej pełne', wznoszenieCzynnik(H * 0.95, H) === 1);
spr('przy samym suficie - czynnik minimalny, ale NIE zero',
    wznoszenieCzynnik(H * SUFIT_Y_H, H) > 0 && wznoszenieCzynnik(H * SUFIT_Y_H, H) < 0.2);
spr('powyżej sufitu - nie spada poniżej minimum',
    wznoszenieCzynnik(H * 0.01, H) === wznoszenieCzynnik(H * SUFIT_Y_H, H));

// --- 2. Emisja ciągła ---
console.log('\nEMISJA CIĄGŁA:');
{
    const d = new Dym();
    const przyrosty = [];
    for (let i = 0; i < 60; i++) {
        const przed = d.liczba;
        d.emituj(USTA, W_PRAWO, 1, 1, DT, W, H);
        przyrosty.push(d.liczba - przed);
        d.updateAndDraw(null, W, H, DT);
    }
    spr(`1 s dmuchania -> >= 12 cząstek (${d.liczba})`, d.liczba >= 12 && d.liczba <= CZASTEK_NA_S * 1.5);
    let przerwa = 0, najdluzsza = 0;
    for (const n of przyrosty) { if (n === 0) najdluzsza = Math.max(najdluzsza, ++przerwa); else przerwa = 0; }
    spr(`emisja bez dziur (najdłuższa przerwa ${najdluzsza} klatek <= 4)`, najdluzsza <= 4);
    spr('każda cząstka ma pola gry (stan, prędkość gry)',
        wszystkie(d).every(c => c.stan === 'DYM' && Number.isFinite(c.vxGry) && Number.isFinite(c.vyGry)));
    spr('cząstki rosną od małej skali (nie rodzą się wielkie)',
        wszystkie(d).some(c => promienCzastki(c) < 40));

    const cisza = new Dym();
    dmuchaj(cisza, 0.5, { sila: 0 });
    spr('siła 0 -> brak emisji', cisza.liczba === 0);
}

// --- 3. Początkowa siła kierunku ---
console.log('\nPOCZĄTKOWA SIŁA KIERUNKU:');
{
    const d = new Dym();
    pierwszaCzastka(d);
    const katy = wszystkie(d).map(c => Math.abs(Math.atan2(c.vyGry, c.vxGry)));
    spr(`cząstki lecą w stożku ±10° wokół kierunku (max ${(Math.max(...katy) * 180 / Math.PI).toFixed(1)}°)`,
        Math.max(...katy) < 10 * Math.PI / 180);

    // Porównujemy ŚREDNIE z wielu cząstek: prędkość ma rozrzut 0.55-1.35x
    // (ROZRZUT_PREDKOSCI), więc pojedyncza para potrafi się minąć.
    const mocno = new Dym(), slabo = new Dym();
    for (let i = 0; i < 20; i++) {
        mocno.emituj(USTA, W_PRAWO, 1, 1, DT, W, H);
        slabo.emituj(USTA, W_PRAWO, 1, 0, DT, W, H);
    }
    const srednieV = (d) => wszystkie(d).reduce((a, c) => a + Math.hypot(c.vxGry, c.vyGry), 0) / d.liczba;
    const vM = srednieV(mocno), vS = srednieV(slabo);
    spr(`wyrazista poza wypycha mocniej (${vM.toFixed(3)} vs ${vS.toFixed(3)} px/ms)`, vM > 2 * vS);
    spr(`...a nijaka i tak wypycha (podłoga ${WYRAZISTOSC_PODLOGA})`, vS > 0);

    przepusc(mocno, 2);
    const s = srodek(wszystkie(mocno));
    spr(`po 2 s obłok przesunął się w PRAWO (${((s.x / POL - USTA.x) / W).toFixed(2)} W)`,
        s.x / POL - USTA.x > 0.05 * W);
}

// --- 4. Cztery strony świata i wyporność ---
console.log('\nCZTERY STRONY ŚWIATA:');
{
    const d = new Dym();
    dmuchaj(d, 0.4, { kierunek: W_DOL });
    przepusc(d, 1.6);
    const s = srodek(wszystkie(d));
    spr(`REGRESJA: dmuchanie w DÓŁ - obłok NIŻEJ ust (${(s.y / POL - USTA.y).toFixed(0)} px)`,
        s.y / POL > USTA.y);
    przepusc(d, 12);
    spr('...ale po kilkunastu sekundach dym się unosi', wszystkie(d).every(c => c.vyGry < 0));
}

// --- 5. Życie: naturalne rozwiewanie ---
console.log('\nŻYCIE CZĄSTKI:');
{
    const d = new Dym();
    dmuchaj(d, 0.5);
    spr(`życie ${ZYCIE_MIN_S}-${ZYCIE_MAX_S} s (pole gry, nie lifetime biblioteki)`,
        wszystkie(d).every(c => c.zycieGry >= ZYCIE_MIN_S && c.zycieGry <= ZYCIE_MAX_S));
    przepusc(d, ZYCIE_MIN_S - 2);
    spr(`po ${ZYCIE_MIN_S - 2} s dym WCIĄŻ JEST (zdążysz złożyć combo ognia)`, d.liczba > 0);
    przepusc(d, ZYCIE_MAX_S + 2);
    spr('po upływie życia rozwiewa się do zera', d.liczba === 0);
}

// --- 5b. Obwiednia: sterowanie czasem biblioteki ---
console.log('\nOBWIEDNIA (sterowanie czasem biblioteki):');
{
    const L = 6000, Z = 30;
    const alfa = (w) => (1 - Math.abs(1 - 2 * wiekBiblioteki(w, Z, L) / L)) / 8;
    spr('świeża cząstka prawie przezroczysta', alfa(0) < 0.01);
    spr(`po NAROST_S (${NAROST_S} s) alfa na SZCZYCIE (${alfa(NAROST_S).toFixed(3)})`,
        Math.abs(alfa(NAROST_S) - 0.125) < 1e-6);
    spr('REGRESJA: po 1 s dym jest już widoczny (bez sterowania czasem byłoby 0.008)',
        alfa(1) > 0.1);
    spr('plateau trzyma się przez większość życia', Math.abs(alfa(Z / 2) - 0.125) < 1e-6);
    spr(`w ostatnich ${ZANIK_S} s zanika`, alfa(Z - 0.1) < 0.02);
    spr('na końcu życia age dobija do lifetime (biblioteka usuwa cząstkę)',
        wiekBiblioteki(Z, Z, L) === L);
    spr('obwiednia odporna na NaN', Number.isFinite(wiekBiblioteki(NaN, NaN, NaN)));
}

// --- 5c. Kolumna -> kłębienie (v7.1) ---
console.log('\nKOLUMNA -> KŁĘBIENIE:');
spr(`świeża cząstka jest WĄSKA (${SKALA_KOLUMNY} skali)`, skalaCzastki(0, 15) === SKALA_KOLUMNY);
spr('...i taka zostaje przez całą fazę kolumny', skalaCzastki(KOLUMNA_S, 15) === SKALA_KOLUMNY);
spr('po kolumnie rośnie monotonicznie', (() => {
    let poprz = -1;
    for (let t = KOLUMNA_S; t < 30; t += 0.2) { const v = skalaCzastki(t, 15); if (v < poprz - 1e-9) return false; poprz = v; }
    return true;
})());
spr(`po ~11 s >= 90% docelowej (${skalaCzastki(KOLUMNA_S + 11, 15).toFixed(1)}/15)`,
    skalaCzastki(KOLUMNA_S + 11, 15) >= 0.9 * 15);
spr('nigdy nie przekracza docelowej', skalaCzastki(120, 15) <= 15);
spr('odporna na NaN', Number.isFinite(skalaCzastki(NaN, NaN)));
{
    // Struga: 1 s dmuchania w bok - wąski pas, małe cząstki.
    const d = new Dym();
    dmuchaj(d, 1, { kierunek: W_PRAWO });
    const cz = wszystkie(d);
    const wPoprzek = Math.max(...cz.map(c => Math.abs(c.y / POL - USTA.y)));
    spr(`kolumna jest WĄSKA (rozrzut w poprzek ${(wPoprzek / W).toFixed(3)} W < 0.03)`, wPoprzek < 0.03 * W);
    const maxR = Math.max(...cz.map(c => promienCzastki(c) / POL));
    spr(`...i zbudowana z małych kłębów (max promień ${(maxR / W).toFixed(3)} W < 0.05)`, maxR < 0.05 * W);

    przepusc(d, 0.5);
    const czolo = Math.max(...wszystkie(d).map(c => c.x / POL)) - USTA.x;
    // Górna granica z zapasem na ROZRZUT_PREDKOSCI_MAX: najszybsza cząstka
    // zajeżdża 1.35x dalej niż nominalne WYLOT_W_S / OPOR = 0.30 W.
    spr(`zasięg kolumny ${(czolo / W).toFixed(2)} W (0.15-0.50 - "na 1/4 ekranu")`,
        czolo / W > 0.15 && czolo / W < 0.50);

    // Rozejście: po kilkunastu sekundach dym jest DUŻO szerszy niż struga.
    przepusc(d, 14);
    const poRozejsciu = Math.max(...wszystkie(d).map(c => Math.abs(c.y / POL - USTA.y)));
    spr(`po 15 s dym rozchodzi się na boki (${(wPoprzek).toFixed(0)} -> ${poRozejsciu.toFixed(0)} px)`,
        poRozejsciu > 4 * wPoprzek);
    const maxR2 = Math.max(...wszystkie(d).map(c => promienCzastki(c) / POL));
    spr(`...i kłęby urosły (${(maxR / W).toFixed(3)} -> ${(maxR2 / W).toFixed(3)} W)`, maxR2 > 2 * maxR);
}

// --- 6. Reakcja na ręce i taniec ---
console.log('\nREAKCJA NA RĘCE (taniec):');
{
    const d = new Dym();
    dmuchaj(d, 0.5, { kierunek: { x: 0, y: -1 } });
    przepusc(d, 0.5);
    const przed = srodek(wszystkie(d));
    for (let i = 0; i < 10; i++) {
        d.rozgarnij([{ x: przed.x / POL, y: przed.y / POL, vx: 1500, vy: 0 }]);
        d.updateAndDraw(null, W, H, DT);
    }
    const po = srodek(wszystkie(d));
    spr(`dłoń przelatująca przez dym pcha go w swoją stronę (${((po.x - przed.x) / POL).toFixed(0)} px)`,
        po.x > przed.x + 2);

    // Wir: cząstki po przeciwnych stronach toru dostają PRZECIWNE pchnięcia
    // w pionie (dłoń leci poziomo, więc znak bierze się ze strony toru).
    const e = new Dym();
    dmuchaj(e, 0.5, { kierunek: { x: 0, y: -1 }, wyrazistosc: 0 });
    const cz = wszystkie(e);
    const nad = cz[0], pod = cz[cz.length - 1];
    spr('...(test wiru ma dwie różne cząstki)', nad !== pod);
    nad.x = USTA.x * POL; nad.y = (USTA.y - 60) * POL;
    pod.x = USTA.x * POL; pod.y = (USTA.y + 60) * POL;
    nad.vxGry = nad.vyGry = pod.vxGry = pod.vyGry = 0;
    e.rozgarnij([{ x: USTA.x, y: USTA.y, vx: 1500, vy: 0 }]);
    e.updateAndDraw(null, W, H, DT);
    spr(`za ręką zostaje WIR - przeciwne strony dostają przeciwny obrót (${nad.vyGry.toFixed(2)} / ${pod.vyGry.toFixed(2)})`,
        Math.sign(nad.vyGry) !== Math.sign(pod.vyGry) && nad.vyGry !== 0);

    // Dłoń daleko: porównujemy PRZYROST prędkości, nie pozycję - cząstki i tak
    // lecą własnym pędem, więc sama pozycja niczego by nie dowodziła.
    const f = new Dym();
    dmuchaj(f, 0.3, { wyrazistosc: 0 });
    const przedV = wszystkie(f).map(c => c.vxGry);
    f.rozgarnij([{ x: USTA.x + ROZGARNIJ_PROMIEN_W * W * 4, y: USTA.y, vx: 1500, vy: 0 }]);
    f.updateAndDraw(null, W, H, DT);
    const dalekoMax = Math.max(...wszystkie(f).map((c, i) => Math.abs(c.vxGry - przedV[i])));
    const g = new Dym();
    dmuchaj(g, 0.3, { wyrazistosc: 0 });
    const przedG = wszystkie(g).map(c => c.vxGry);
    g.rozgarnij([{ x: USTA.x, y: USTA.y, vx: 1500, vy: 0 }]);
    g.updateAndDraw(null, W, H, DT);
    const bliskoMax = Math.max(...wszystkie(g).map((c, i) => Math.abs(c.vxGry - przedG[i])));
    spr(`dłoń DALEKO rusza dym ${(dalekoMax / (bliskoMax || 1) * 100).toFixed(0)}x słabiej niż BLISKO`,
        dalekoMax < 0.1 * bliskoMax);
    spr('rozgarnij() bez dłoni / z NaN nie wywala',
        (() => { f.rozgarnij([]); f.rozgarnij(null); f.rozgarnij([{ x: NaN, y: NaN, vx: NaN, vy: NaN }]);
                  f.updateAndDraw(null, W, H, DT);
                  return wszystkie(f).every(c => Number.isFinite(c.x) && Number.isFinite(c.y)); })());
}

// --- 6b. Podmuch (Aard) rozdmuchuje dym: odrzut + rozrzedzenie ---
console.log('\nPODMUCH AARDA (odrzut + rozrzedzenie):');
{
    // Kłąb, potem punkt czoła fali (px gry, px/s) PRZY kłębie: cząstki
    // w zasięgu dostają pęd W KIERUNKU fali i starzeją się szybciej niż dt.
    const d = new Dym();
    dmuchaj(d, 0.3, { wyrazistosc: 0 });
    const cz = wszystkie(d);
    const cel = cz[Math.floor(cz.length / 2)];
    const przedV = cz.map(c => c.vxGry);
    const przedWiek = cz.map(c => c.wiekGry);
    d.pchnij([{ x: cel.x / POL, y: cel.y / POL, r: 120, vx: 2000, vy: 0, sila: 1 }]);
    d.updateAndDraw(null, W, H, DT);
    const dV = cz.map((c, i) => c.vxGry - przedV[i]);
    const dWiek = cz.map((c, i) => c.wiekGry - przedWiek[i]);
    const wZasiegu = cz.map(c => Math.hypot(c.x - cel.x, c.y - cel.y) < 120 * POL * 0.5);
    spr(`cząstki w zasięgu czoła dostają pęd w kierunku fali (max Δvx ${Math.max(...dV).toFixed(3)})`,
        cz.some((c, i) => wZasiegu[i] && dV[i] > 0));
    spr('  ...i starzeją się SZYBCIEJ niż dt (rozrzedzenie)',
        cz.some((c, i) => wZasiegu[i] && dWiek[i] > DT * 1.5));
    // Punkt czoła daleko: przyrost prędkości jak bez pchnięcia (opór i pole
    // przepływu i tak zmieniają v co klatkę - porównujemy WZGLĘDEM bliskiego,
    // jak w teście rąk wyżej), wiek rośnie dokładnie o dt.
    const e = new Dym();
    dmuchaj(e, 0.3, { wyrazistosc: 0 });
    const czE = wszystkie(e);
    const przedVE = czE.map(c => c.vxGry), przedWiekE = czE.map(c => c.wiekGry);
    e.pchnij([{ x: USTA.x + 3000, y: USTA.y, r: 120, vx: 2000, vy: 0, sila: 1 }]);
    e.updateAndDraw(null, W, H, DT);
    const dalekoMax = Math.max(...czE.map((c, i) => Math.abs(c.vxGry - przedVE[i])));
    spr(`czoło DALEKO rusza dym ${(dalekoMax / Math.max(...dV) * 100).toFixed(0)}x słabiej niż blisko i nie postarza go`,
        dalekoMax < 0.1 * Math.max(...dV) && czE.every((c, i) => c.wiekGry - przedWiekE[i] <= DT + 1e-9));
    // Lista jest jednorazowa - kolejna klatka bez pchnij() już nie pcha.
    const przedV2 = cz.map(c => c.vxGry);
    d.updateAndDraw(null, W, H, DT);
    // Opór tylko ZMNIEJSZA |v|; wzrost vx bez nowego pchnij() oznaczałby,
    // że lista nie została wyczyszczona.
    spr('pchnięcie jest konsumowane raz - następna klatka bez pchnij() nie dokłada pędu',
        cz.every((c, i) => c.vxGry <= przedV2[i] + 1e-9 || przedV2[i] < 0));
    spr('pchnij() z pustą listą / null / NaN nie wywala',
        (() => { d.pchnij([]); d.pchnij(null); d.pchnij([{ x: NaN, y: NaN, r: NaN, vx: NaN, vy: NaN, sila: NaN }]);
                  d.updateAndDraw(null, W, H, DT);
                  return wszystkie(d).every(c => Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.vxGry)); })());
}

// --- 7. Ogień: zapłon, front, detonacja ---
console.log('\nPODPALENIE I FRONT OGNIA:');
{
    const d = new Dym();
    dmuchaj(d, 1);
    przepusc(d, 1);
    const cz = wszystkie(d);
    const ile = cz.length;
    d.podpal([{ x: 1e6, y: 1e6, r: 5 }]);
    spr('zarzewie daleko nie zapala', cz.every(c => c.stan === 'DYM'));

    const cel = cz[Math.floor(cz.length / 2)];
    d.podpal([{ x: cel.x / POL, y: cel.y / POL, r: 10 }]);
    spr('kontakt z zarzewiem zapala dym', d.plonacych > 0);
    const pierwsze = d.plonacych;
    przepusc(d, OPOZNIENIE_FRONTU_S + 0.05);
    spr(`front zaraża sąsiadki (${pierwsze} -> ${d.plonacych})`, d.plonacych > pierwsze);

    let wybuchy = 0;
    for (let i = 0; i < Math.round(3 / DT); i++) wybuchy += d.updateAndDraw(null, W, H, DT);
    spr(`updateAndDraw zwraca liczbę nowych wybuchów (${wybuchy})`, wybuchy > 0);
    przepusc(d, CZAS_WYBUCHU_S + 0.2);
    spr(`po wybuchu cząstki znikają (${ile} -> ${d.liczba})`, d.liczba < ile);
    spr('podpal() z pustą listą / NaN nie wywala',
        (() => { d.podpal([]); d.podpal(null); d.podpal([{ x: NaN, y: NaN, r: 5 }]); return true; })());
}

// --- 8. Sufit cząstek ---
console.log('\nSUFIT CZĄSTEK:');
{
    const d = new Dym();
    dmuchaj(d, MAX_CZASTEK / CZASTEK_NA_S + 10);
    spr(`nie przekracza ${MAX_CZASTEK} (${d.liczba})`, d.liczba <= MAX_CZASTEK);
    spr('...i nadal coś jest (sufit nie kasuje wszystkiego)', d.liczba > MAX_CZASTEK / 2);
}
{
    // Sufit wyrzuca cząstkę NAJBLIŻSZĄ KOŃCA ŻYCIA, nie po prostu najstarszą:
    // stare, rozeszłe kłęby są tym, co ma zasnuć ekran.
    const d = new Dym();
    dmuchaj(d, 2);
    const cz = wszystkie(d);
    const skazana = cz[Math.floor(cz.length / 2)];
    skazana.wiekGry = skazana.zycieGry * 0.99;          // tuż przed końcem
    const swiezaStara = cz[0];
    swiezaStara.wiekGry = 1; swiezaStara.zycieGry = 200; // najstarsza, ale daleko jej do końca
    // Dosypujemy, aż sufit zacznie ciąć (sama emisja, bez fizyki - inaczej
    // pętla byłaby nieskończona: po przycięciu długość zawsze == MAX_CZASTEK).
    for (let i = 0; i < MAX_CZASTEK * 3 && wszystkie(d).length < MAX_CZASTEK; i++) {
        d.emituj(USTA, W_PRAWO, 1, 1, DT, W, H);
    }
    d.emituj(USTA, W_PRAWO, 1, 1, DT, W, H);
    spr('sufit wyrzucił cząstkę najbliższą końca życia', !wszystkie(d).includes(skazana));
    spr('...a nie tę najstarszą, której daleko do końca', wszystkie(d).includes(swiezaStara));
}

// --- 9. Odporność ---
console.log('\nODPORNOŚĆ:');
{
    const d = new Dym();
    spr('updateAndDraw na pusto = 0', d.updateAndDraw(null, W, H, DT) === 0);
    spr('NaN dt nie wywala', d.updateAndDraw(null, W, H, NaN) === 0);
    spr('emituj z NaN w zaczepie nie tworzy cząstek',
        (() => { d.emituj({ x: NaN, y: 1 }, W_PRAWO, 1, 1, DT, W, H); return d.liczba === 0; })());
    spr('kierunek zerowy -> fallback w górę, bez NaN', (() => {
        const x = new Dym();
        dmuchaj(x, 0.3, { kierunek: { x: 0, y: 0 } });
        return wszystkie(x).length > 0
            && wszystkie(x).every(c => Number.isFinite(c.vxGry) && Number.isFinite(c.vyGry) && c.vyGry <= 0);
    })());
    spr('brak W/H używa domyślnej skali', Number.isFinite(d.updateAndDraw(null, undefined, undefined, DT)));
}

process.exit(ok ? 0 : 1);
