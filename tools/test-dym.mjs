/**
 * Dym Okadzenia v6 - KÓŁKA wypuszczane po naładowaniu, rozkłębiające się
 * w chmurę; front ognia wokół obwodu. BEZ document.
 *
 *   node tools/test-dym.mjs
 *
 * Rysowanie (stroke, Path2D, tekstury, płótno pomocnicze) NIE JEST tu
 * testowane - ten sam powód co test-kolowrot.mjs. Fizyka idzie przez
 * updateAndDraw(null, W, H, dt) - guard na `!ctx` jest PO doliczeniu czasu
 * i fizyki (patrz js/dym.js), więc test nigdy nie dotyka document.
 *
 * v6 (2026-09-11): "chcę, żeby wypuszczane były kółka i w zależności jak długo
 * przytrzyma się rękę przy ustach, tym większe kółko wychodzi (max 3 s = 1/3
 * ekranu); kółka i tak dalej kłębią się po wypuszczeniu".
 */
import { Dym, wznoszenieCzynnik, obwiedniaAlfy, alfaOdSzerokosci, spojnosc,
         KOLUMNA_S, TAU_ROZPADU_S, MAX_WEZLOW, MAX_WEZLOW_WSTEGI,
         ZYCIE_MIN_S, ZYCIE_MAX_S, ZYCIE_SMUGI_S, WEZLY_SMUGI_NA_S,
         KOLKO_R_MIN_W, KOLKO_R_MAX_W, KOLKO_WEZLY_MIN, KOLKO_WEZLY_MAX,
         ODDECH_AMPLITUDA, R_START_W, ROZROST_TAU_S, WYRAZISTOSC_PODLOGA,
         TAU_WYPORU_S, PRZERZEDZ_PO_S, ALFA_START, ALFA_KONIEC,
         OPOZNIENIE_FRONTU_S, CZAS_DO_WYBUCHU_S, CZAS_WYBUCHU_S,
         SUFIT_Y_H, SPADEK_OD_Y_H }
    from '../js/dym.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const DT = 1 / 60;
const W = 1920, H = 1080;
const USTA = { x: 960, y: 600 };
const W_PRAWO = { x: 1, y: 0 };
const W_DOL = { x: 0, y: 1 };

const przepusc = (d, sekundy) => {
    let suma = 0;
    for (let i = 0; i < Math.round(sekundy / DT); i++) suma += d.updateAndDraw(null, W, H, DT);
    return suma;
};
/** Ładuje smużką przez `sekundy` i wypuszcza kółko - dokładnie jak main.js. */
function kolko(d, { kierunek = W_PRAWO, ladunek = 0.5, wyrazistosc = 1, usta = USTA, smuga = 0 } = {}) {
    for (let i = 0; i < Math.round(smuga / DT); i++) {
        d.smuz(usta, kierunek, ladunek, DT, W);
        d.updateAndDraw(null, W, H, DT);
    }
    const R = d.wypusc(usta, kierunek, ladunek, wyrazistosc, W);
    return { R, wstega: d._wstegi[d._wstegi.length - 1] };
}
/** Środek i średni promień zbioru węzłów - do oceny kształtu kółka. */
function ksztalt(wezly) {
    const n = wezly.length;
    const sx = wezly.reduce((a, c) => a + c.x, 0) / n;
    const sy = wezly.reduce((a, c) => a + c.y, 0) / n;
    const promienie = wezly.map(c => Math.hypot(c.x - sx, c.y - sy));
    return { sx, sy, r: promienie.reduce((a, b) => a + b, 0) / n,
             min: Math.min(...promienie), max: Math.max(...promienie) };
}
const wszystkie = (d) => [...d.wezly()];
/** Gotowy węzeł do wstawienia wprost do wstęgi (testy fizyki/ognia). */
const wezel = (over = {}) => ({
    x: 900, y: 600, vx: 0, vy: 0, wiek: 30, zycie: 120, faza: 0, fazaWlasna: 0,
    rozbieznoscX: 0, rozbieznoscY: 0, szum: 1,
    r: 60, rStart: 8, rCel: 80, przerwa: false,
    stan: 'DYM', tZaplonu: 0, tWybuch: 0, rozprzestrzenil: false,
    wariantMgla: 0, wariantPlomien: 0, wariantOgien: 0, wariantRozblysk: 0, ...over
});
/** Wstawia gotowe węzły jako jedną wstęgę (z pominięciem emisji). */
function wstaw(d, wezly, zamknieta = false) {
    wezly[0].przerwa = !zamknieta;
    d._wstegi.push({ id: -d._wstegi.length - 1, wezly, przerzedzen: 0, zamknieta });
    d._ile += wezly.length;
    return d._wstegi[d._wstegi.length - 1];
}

// --- 1. wznoszenieCzynnik(): czysta funkcja ---
console.log('WZNOSZENIE CZYNNIK (funkcja czysta):');
spr('daleko od sufitu - pełne wznoszenie (~1)', wznoszenieCzynnik(H * SPADEK_OD_Y_H - 1, H) > 0.99);
spr('poniżej progu spadku - dalej pełne', wznoszenieCzynnik(H * 0.95, H) === 1);
spr('przy samym suficie - czynnik minimalny, ale NIE zero',
    wznoszenieCzynnik(H * SUFIT_Y_H, H) > 0 && wznoszenieCzynnik(H * SUFIT_Y_H, H) < 0.2);
spr('powyżej sufitu - nie spada poniżej minimum',
    wznoszenieCzynnik(H * 0.01, H) === wznoszenieCzynnik(H * SUFIT_Y_H, H));

// --- 2. obwiednie alfy ---
console.log('\nOBWIEDNIE ALFY:');
spr('wiek=0 -> alfa niska', obwiedniaAlfy(0, ZYCIE_MIN_S) < 0.1);
spr('po 1 s (ułamek życia ~1%) już pełna - narost w SEKUNDACH', obwiedniaAlfy(1, ZYCIE_MIN_S) > 0.9);
spr('w połowie życia pełna', obwiedniaAlfy(ZYCIE_MIN_S * 0.5, ZYCIE_MIN_S) > 0.95);
spr('przy 0.9 życia opada', obwiedniaAlfy(ZYCIE_MIN_S * 0.9, ZYCIE_MIN_S) < 0.6);
spr('na końcu życia 0', obwiedniaAlfy(ZYCIE_MIN_S, ZYCIE_MIN_S) === 0);
spr('brak zycie nie wywala', Number.isFinite(obwiedniaAlfy(1, undefined)));
spr(`alfaOdSzerokosci: świeża kreska gęsta (${ALFA_START})`, alfaOdSzerokosci(8, 8, 80) === ALFA_START);
spr(`alfaOdSzerokosci: rozdęta rzadka (${ALFA_KONIEC})`, Math.abs(alfaOdSzerokosci(80, 8, 80) - ALFA_KONIEC) < 1e-9);
spr('alfaOdSzerokosci: maleje z r', alfaOdSzerokosci(40, 8, 80) < alfaOdSzerokosci(20, 8, 80));
spr('alfaOdSzerokosci: zerowy zakres nie dzieli przez 0', Number.isFinite(alfaOdSzerokosci(8, 8, 8)));

// --- 3. Kółko: kształt, rozmiar z ładunku ---
console.log('\nKÓŁKO (kształt i rozmiar z ładunku):');
{
    let minO = Infinity, maxO = -Infinity;
    for (let t = 0; t < 10; t += 0.01) { const o = Dym.oddech(t); minO = Math.min(minO, o); maxO = Math.max(maxO, o); }
    spr(`oddech nigdy do zera (min ${minO.toFixed(2)})`, minO >= 1 - ODDECH_AMPLITUDA - 1e-9 && minO > 0.5);
    spr('oddech NaN -> liczba', Number.isFinite(Dym.oddech(NaN)));

    const d = new Dym();
    const { R, wstega } = kolko(d, { ladunek: 0.5 });
    spr(`wypusc() tworzy JEDNĄ zamkniętą wstęgę (${d.wsteg})`, d.wsteg === 1 && wstega.zamknieta === true);
    const k = ksztalt(wstega.wezly);
    spr(`węzły leżą na okręgu (${k.min.toFixed(0)}-${k.max.toFixed(0)} px wobec R=${R.toFixed(0)})`,
        k.max - k.min < 0.08 * R && Math.abs(k.r - R) < 0.05 * R);
    spr(`środek kółka LEŻY PRZED USTAMI o R (${(k.sx - USTA.x).toFixed(0)} px)`,
        Math.abs((k.sx - USTA.x) - R) < 0.1 * R && Math.abs(k.sy - USTA.y) < 0.1 * R);
    spr(`liczba węzłów w granicach ${KOLKO_WEZLY_MIN}-${KOLKO_WEZLY_MAX} (${d.liczba})`,
        d.liczba >= KOLKO_WEZLY_MIN && d.liczba <= KOLKO_WEZLY_MAX);
    spr('żaden węzeł nie czeka (brak ujemnego wieku)', wszystkie(d).every(c => c.wiek === 0));
}
{
    const male = new Dym(), duze = new Dym();
    const rm = kolko(male, { ladunek: 0 }).R;
    const rd = kolko(duze, { ladunek: 1 }).R;
    spr(`ładunek 0 -> małe kółko (${(rm / W).toFixed(3)} W ≈ ${KOLKO_R_MIN_W})`, Math.abs(rm / W - KOLKO_R_MIN_W) < 1e-6);
    spr(`ładunek 1 -> średnica ~1/3 ekranu (${(2 * rd / W).toFixed(2)} W)`,
        Math.abs(rd / W - KOLKO_R_MAX_W) < 1e-6 && Math.abs(2 * rd / W - 0.33) < 0.02);
    spr('większe kółko ma więcej węzłów', duze.liczba > male.liczba);
    const srednie = new Dym();
    const rs = kolko(srednie, { ladunek: 0.5 }).R;
    spr('promień rośnie liniowo z ładunkiem', rs > rm && rs < rd);
    spr('brak ładunku (undefined) nie wywala', (() => {
        const x = new Dym();
        return x.wypusc(USTA, W_PRAWO, undefined, 1, W) > 0;
    })());
}

// --- 4. Lot kółka: pół ekranu, większe wolniej ---
console.log('\nLOT KÓŁKA:');
{
    const male = new Dym(), duze = new Dym();
    const rm = kolko(male, { ladunek: 0 }).R;
    const rd = kolko(duze, { ladunek: 1 }).R;
    const sxM0 = ksztalt(wszystkie(male)).sx, sxD0 = ksztalt(wszystkie(duze)).sx;
    przepusc(male, 3); przepusc(duze, 3);
    const drogaM = (ksztalt(wszystkie(male)).sx - sxM0) / W;
    const drogaD = (ksztalt(wszystkie(duze)).sx - sxD0) / W;
    spr(`małe kółko leci ~pół ekranu (${drogaM.toFixed(2)} W w 0.25-0.7)`, drogaM > 0.25 && drogaM < 0.7);
    spr(`duże leci WOLNIEJ (${drogaD.toFixed(2)} W < ${drogaM.toFixed(2)} W)`, drogaD < drogaM * 0.8);
    spr(`kółko puchnie w locie, ale nie rozdyma się (${(ksztalt(wszystkie(male)).r / rm).toFixed(2)}x)`,
        ksztalt(wszystkie(male)).r > rm && ksztalt(wszystkie(male)).r < 1.8 * rm);
}

// --- 5. Rozkłębienie kółka (spójność z v5) ---
console.log('\nROZKŁĘBIENIE KÓŁKA:');
spr('świeży węzeł w pełni spójny', spojnosc(0) === 1);
spr(`spójność trzyma przez KOLUMNA_S (${KOLUMNA_S} s)`, spojnosc(KOLUMNA_S) === 1);
spr('po trzech tau kółka praktycznie nie ma', spojnosc(KOLUMNA_S + 3 * TAU_ROZPADU_S) < 0.06);
spr('spójność maleje monotonicznie', (() => {
    let poprz = 2;
    for (let t = 0; t < 20; t += 0.1) { const v = spojnosc(t); if (v > poprz + 1e-9) return false; poprz = v; }
    return true;
})());
spr('spójność odporna na NaN', spojnosc(NaN) === 1);
{
    const d = new Dym();
    kolko(d, { ladunek: 0.6 });
    const kat = (c) => Math.atan2(c.vy, c.vx);
    const rozrzut = () => {
        const katy = wszystkie(d).map(kat);
        return Math.max(...katy) - Math.min(...katy);
    };
    przepusc(d, 0.5);
    const wKolku = rozrzut();
    spr(`świeże kółko leci SPÓJNIE (rozrzut ${(wKolku * 180 / Math.PI).toFixed(0)}° < 45°)`,
        wKolku < 45 * Math.PI / 180);
    przepusc(d, KOLUMNA_S + 3 * TAU_ROZPADU_S);
    const wChmurze = rozrzut();
    spr(`po rozpadzie kierunki się rozjeżdżają (${(wChmurze * 180 / Math.PI).toFixed(0)}° > 90°)`,
        wChmurze > 90 * Math.PI / 180);
    const k = ksztalt(wszystkie(d));
    spr(`...a obwód przestaje być okręgiem (${k.min.toFixed(0)}-${k.max.toFixed(0)} px)`,
        k.max - k.min > 0.3 * k.r);
}

// --- 6. Cztery strony świata ---
console.log('\nCZTERY STRONY ŚWIATA:');
{
    const d = new Dym();
    kolko(d, { kierunek: W_DOL, ladunek: 0.3 });
    przepusc(d, 2.5);
    const k = ksztalt(wszystkie(d));
    spr(`REGRESJA v3 (SKOS_W_GORE): kółko w DÓŁ jest NIŻEJ ust (${(k.sy - USTA.y).toFixed(0)} px)`, k.sy > USTA.y);
    spr(`...i sięga w dół ${((k.sy - USTA.y) / W).toFixed(2)} W`, (k.sy - USTA.y) / W > 0.15);

    const e = new Dym();
    kolko(e, { kierunek: W_PRAWO, ladunek: 0.3 });
    przepusc(e, 2.5);
    const ke = ksztalt(wszystkie(e));
    spr(`kółko w BOK sięga ${((ke.sx - USTA.x) / W).toFixed(2)} W`, (ke.sx - USTA.x) / W > 0.15);
    spr('w bok trzyma poziom (|dy| < 0.08 W)', Math.abs(ke.sy - USTA.y) < 0.08 * W);

    przepusc(d, TAU_WYPORU_S * 3);
    spr('po trzech stałych czasowych wyporu dym płynie W GÓRĘ', wszystkie(d).every(c => c.vy < 0));
}

// --- 7. Wyrazistość, szerokość kreski, smużka ---
console.log('\nWYRAZISTOŚĆ, SZEROKOŚĆ, SMUŻKA:');
{
    const mocno = new Dym(), slabo = new Dym();
    kolko(mocno, { wyrazistosc: 1, ladunek: 0.2 });
    kolko(slabo, { wyrazistosc: 0, ladunek: 0.2 });
    const s0 = ksztalt(wszystkie(mocno)).sx, w0 = ksztalt(wszystkie(slabo)).sx;
    przepusc(mocno, 2.5); przepusc(slabo, 2.5);
    const dm = ksztalt(wszystkie(mocno)).sx - s0, ds = ksztalt(wszystkie(slabo)).sx - w0;
    spr(`wyrazista poza posyła kółko dalej (${(dm / W).toFixed(2)} W vs ${(ds / W).toFixed(2)} W)`, dm > 2 * ds);
    spr(`...a nijaka i tak coś posyła (podłoga ${WYRAZISTOSC_PODLOGA})`, ds > 0.05 * W);
}
{
    const d = new Dym();
    kolko(d, { ladunek: 0.4 });
    const c = wszystkie(d)[0];
    spr(`kreska startuje cienka (${c.r.toFixed(0)} px = ${R_START_W} W)`, Math.abs(c.r - W * R_START_W) < 1);
    przepusc(d, 10);
    spr(`po ~10 s >= 90% docelowej szerokości (${(c.r / c.rCel * 100).toFixed(0)}%)`, c.r >= 0.9 * c.rCel);
    spr(`docelowa szerokość kłębu duża (${(c.rCel / W).toFixed(3)} W >= 0.05)`, c.rCel / W >= 0.05);
}
{
    // Smużka ładowania: kilka węzłów na sekundę, KRÓTKIE życie, cieńsza kreska.
    const d = new Dym();
    for (let i = 0; i < 60; i++) { d.smuz(USTA, W_PRAWO, 0.5, DT, W); d.updateAndDraw(null, W, H, DT); }
    spr(`1 s ładowania -> kilka węzłów smużki (${d.liczba})`, d.liczba >= 3 && d.liczba <= WEZLY_SMUGI_NA_S * 1.5);
    spr(`smużka żyje krótko (${ZYCIE_SMUGI_S} s)`, wszystkie(d).every(c => c.zycie === ZYCIE_SMUGI_S));
    spr('smużka jest cieńsza niż kółko', wszystkie(d).every(c => c.rStart < W * R_START_W));
    przepusc(d, ZYCIE_SMUGI_S + 0.5);
    spr('...i znika sama', d.liczba === 0);
    spr('smuz() bez W/dt nie wywala', (() => { d.smuz(USTA, W_PRAWO, 1, 0, undefined); return true; })());
}

// --- 8. Budżet: sufity, przerzedzanie ---
console.log('\nBUDŻET (sufity, przerzedzanie):');
{
    const d = new Dym();
    for (let i = 0; i < 12; i++) kolko(d, { ladunek: 1, usta: { x: 200 + i * 120, y: 600 } });
    const przed = d.liczba;
    spr(`12 dużych kółek -> ${przed} węzłów, wstęg ${d.wsteg}`, przed > 400 && przed <= MAX_WEZLOW);
    spr(`wstęga nie rośnie w nieskończoność (max ${MAX_WEZLOW_WSTEGI})`,
        d._wstegi.every(w => w.wezly.length <= MAX_WEZLOW_WSTEGI));

    // Przerzedzanie dopiero po PRZERZEDZ_PO_S i tylko dla NIEAKTYWNEJ wstęgi.
    przepusc(d, 0.1);
    const w = d._wstegi[0];
    const pierwszy = w.wezly[0], ostatni = w.wezly[w.wezly.length - 1];
    const ile = w.wezly.length;
    przepusc(d, PRZERZEDZ_PO_S[0] + 1);
    spr(`dojrzała wstęga przerzedzona (${ile} -> ${w.wezly.length})`, w.wezly.length < ile * 0.75);
    spr('przerzedzanie zachowuje pierwszy i ostatni węzeł (kształt bez zmian)',
        w.wezly[0] === pierwszy && w.wezly[w.wezly.length - 1] === ostatni);
    spr('licznik węzłów zgodny z tablicami', d.liczba === wszystkie(d).length);
    przepusc(d, PRZERZEDZ_PO_S[1] + 1);
    spr(`przerzedzanie ma limit (${w.przerzedzen} <= ${PRZERZEDZ_PO_S.length})`, w.przerzedzen <= PRZERZEDZ_PO_S.length);
}
{
    // Sufit FIFO wypycha NAJSTARSZE.
    const d = new Dym();
    for (let i = 0; i < 60; i++) kolko(d, { ladunek: 1, usta: { x: 100 + (i % 500), y: 600 } });
    spr(`sufit ${MAX_WEZLOW} nie jest przekroczony (${d.liczba})`, d.liczba === MAX_WEZLOW);
    spr('licznik = rzeczywista liczba węzłów', d.liczba === wszystkie(d).length);
}

// --- 9. Życie ---
console.log('\nŻYCIE WĘZŁA:');
{
    const d = new Dym();
    kolko(d, { ladunek: 0.3 });
    spr(`życie ${ZYCIE_MIN_S}-${ZYCIE_MAX_S} s`,
        wszystkie(d).every(c => c.zycie >= ZYCIE_MIN_S && c.zycie <= ZYCIE_MAX_S));
    przepusc(d, 70);
    spr('po 70 s dym WCIĄŻ JEST (zegar potencjału to 4 min)', d.liczba > 0);
    przepusc(d, ZYCIE_MAX_S);
    spr('po upływie życia znika, wstęgi też', d.liczba === 0 && d.wsteg === 0);
}

// --- 10. Rozgarnianie dłońmi ---
console.log('\nROZGARNIANIE DŁOŃMI:');
{
    const d = new Dym();
    wstaw(d, [wezel({ x: 900, y: 600 })]);
    const przed = wszystkie(d)[0].x;
    d.rozgarnij([{ x: 900, y: 600, vx: 500, vy: 0 }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('dłoń BLISKO kreski popycha ją', wszystkie(d)[0].x > przed + 2);
    const e = new Dym();
    wstaw(e, [wezel({ x: 100, y: 600 })]);
    e.rozgarnij([{ x: 1800, y: 600, vx: 500, vy: 0 }], W);
    e.updateAndDraw(null, W, H, DT);
    spr('dłoń DALEKO prawie nie rusza', Math.abs(wszystkie(e)[0].x - 100) < 5);
    spr('rozgarnij() bez dłoni nie wywala', (() => { e.rozgarnij([], W); e.rozgarnij(null, W); return true; })());
}

// --- 11. Ogień: zapłon, front wzdłuż kreski, detonacja ---
console.log('\nPODPALENIE I FRONT OGNIA:');
{
    const d = new Dym();
    // Kreska: 5 węzłów co 100 px. r=60 -> kontakt = 60*2.5 = 150 px.
    const kreska = [0, 1, 2, 3, 4].map(i => wezel({ x: 500 + i * 100, y: 600, r: 60, rStart: 60, rCel: 60 }));
    wstaw(d, kreska);
    const oderwana = wezel({ x: 1800, y: 200, r: 60, rStart: 60, rCel: 60 });
    wstaw(d, [oderwana]);

    d.podpal([{ x: 5000, y: 600, r: 5 }]);
    spr('zarzewie daleko nie zapala', wszystkie(d).every(c => c.stan === 'DYM'));
    d.podpal([{ x: kreska[0].x, y: kreska[0].y, r: 5 }]);
    spr('kontakt z zarzewiem zapala koniec kreski', kreska[0].stan === 'ZAPLON');
    spr('dalsze węzły jeszcze NIE płoną', kreska[4].stan === 'DYM');
    przepusc(d, OPOZNIENIE_FRONTU_S + 0.03);
    spr('front ruszył WZDŁUŻ kreski (sąsiad płonie)', kreska[1].stan !== 'DYM');
    przepusc(d, OPOZNIENIE_FRONTU_S * 4);
    spr('front dobiegł do końca kreski', kreska[4].stan !== 'DYM');
    spr('oderwana wstęga NIE zapłonęła', oderwana.stan === 'DYM');
    spr('podpal() z pustą listą nie wywala', (() => { d.podpal([]); d.podpal(null); return true; })());
}
{
    // KÓŁKO: front musi obiec CAŁY obwód, także przez domknięcie pętli
    // (sąsiadem zerowego węzła jest ostatni).
    const d = new Dym();
    kolko(d, { ladunek: 0.2 });
    const obwod = wszystkie(d);
    obwod[0].stan = 'ZAPLON';
    przepusc(d, OPOZNIENIE_FRONTU_S * obwod.length);
    spr(`front obiegł cały obwód kółka (${obwod.filter(c => c.stan !== 'DYM').length}/${obwod.length})`,
        obwod.every(c => c.stan !== 'DYM'));
}
{
    const d = new Dym();
    // Dwie RÓWNOLEGŁE kreski blisko siebie - front przeskakuje przez siatkę.
    // Odstęp 80 px < (60+60)*0.8 = 96 px promienia zarażania (FRONT_PROMIEN_MNOZNIK).
    const a = [0, 1, 2].map(i => wezel({ x: 500 + i * 100, y: 600, r: 60, rStart: 60, rCel: 60 }));
    const b = [0, 1, 2].map(i => wezel({ x: 500 + i * 100, y: 680, r: 60, rStart: 60, rCel: 60 }));
    wstaw(d, a); wstaw(d, b);
    a[0].stan = 'ZAPLON';
    przepusc(d, OPOZNIENIE_FRONTU_S + 0.03);
    spr('front przeskakuje na sąsiednią wstęgę w zasięgu', b.some(c => c.stan !== 'DYM'));
}
{
    const d = new Dym();
    const kreska = [0, 1, 2].map(i => wezel({ x: 500 + i * 100, y: 600, stan: 'ZAPLON', rozprzestrzenil: true }));
    wstaw(d, kreska);
    let wybuchy = 0;
    for (let i = 0; i < Math.round((CZAS_DO_WYBUCHU_S + 0.02) / DT); i++) wybuchy += d.updateAndDraw(null, W, H, DT);
    spr(`updateAndDraw zwrócił liczbę nowych wybuchów (${wybuchy})`, wybuchy === 3);
    spr('węzły w stanie WYBUCH', wszystkie(d).every(c => c.stan === 'WYBUCH'));
    przepusc(d, CZAS_WYBUCHU_S + 0.05);
    spr('po wybuchu węzły znikają NA ZAWSZE', d.liczba === 0);
}
{
    // Ogień PRZEPALA kreskę: po wybuchu środkowego węzła następny ma przerwę.
    const d = new Dym();
    const kreska = [0, 1, 2].map(i => wezel({ x: 500 + i * 100, y: 600 }));
    wstaw(d, kreska);
    kreska[1].stan = 'WYBUCH';
    kreska[1].tWybuch = CZAS_WYBUCHU_S;
    przepusc(d, DT * 2);
    spr('węzeł za przepalonym ma przerwę (kreska urwana)', kreska[2].przerwa === true);
    spr('licznik po przepaleniu zgodny', d.liczba === wszystkie(d).length);
}

// --- 12. Odporność ---
console.log('\nODPORNOŚĆ:');
{
    const d = new Dym();
    spr('updateAndDraw na pusto = 0', d.updateAndDraw(null, W, H, DT) === 0);
    spr('NaN dt nie wywala', d.updateAndDraw(null, W, H, NaN) === 0);
    kolko(d, { ladunek: 0.3 });
    spr('updateAndDraw bez W/H używa domyślnej skali', Number.isFinite(d.updateAndDraw(null, undefined, undefined, DT)));
    spr('wypusc bez W nie wywala', (() => { d.wypusc(USTA, W_PRAWO, 0.5, 1, undefined); return true; })());
    spr('kierunek zerowy -> fallback w górę, bez NaN', (() => {
        const x = new Dym();
        x.wypusc(USTA, { x: 0, y: 0 }, 0.5, 1, W);
        przepusc(x, 0.5);
        return wszystkie(x).every(c => Number.isFinite(c.vx) && Number.isFinite(c.vy));
    })());
    d.podpal([{ x: NaN, y: NaN, r: 5 }]);
    d.rozgarnij([{ x: NaN, y: NaN, vx: NaN, vy: NaN }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('NaN w zarzewiu/dłoni nie zatruwa pozycji', wszystkie(d).every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
    spr('zaczep NaN nie tworzy węzłów', (() => {
        const x = new Dym();
        x.wypusc({ x: NaN, y: 1 }, W_PRAWO, 0.5, 1, W);
        x.smuz({ x: NaN, y: 1 }, W_PRAWO, 0.5, DT, W);
        return x.liczba === 0;
    })());
}

process.exit(ok ? 0 : 1);
