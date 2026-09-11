/**
 * Dym Okadzenia v4 - WSTĘGA: ciągła kreska z ust, malowanie, cztery strony
 * świata, front ognia wzdłuż kreski; BEZ document.
 *
 *   node tools/test-dym.mjs
 *
 * Rysowanie (stroke, Path2D, płótno pomocnicze) NIE JEST tu testowane - ten
 * sam powód co test-kolowrot.mjs. Fizyka idzie przez updateAndDraw(null, W, H,
 * dt) - guard na `!ctx` jest PO doliczeniu czasu i fizyki (patrz js/dym.js),
 * więc test nigdy nie dotyka document.createElement.
 *
 * v4 (2026-09-11, trzeci test na kamerze - "ciągle ta tekstura kółka; linia ma
 * być stała, a kółka mają powstawać z zataczania okręgów; dym w cztery strony
 * świata, mocno w boki i w dół; siła z ustawienia gracza").
 */
import { Dym, wznoszenieCzynnik, obwiedniaAlfy, alfaOdSzerokosci, spojnosc,
         KOLUMNA_S, TAU_ROZPADU_S,
         MAX_WEZLOW, MAX_WEZLOW_WSTEGI, ZYCIE_MIN_S, ZYCIE_MAX_S,
         WEZLY_NA_S, ODDECH_AMPLITUDA, R_START_W, ROZROST_TAU_S,
         WYRAZISTOSC_PODLOGA, TAU_WYPORU_S, PRZERZEDZ_PO_S,
         ALFA_START, ALFA_KONIEC, OPOZNIENIE_FRONTU_S, CZAS_DO_WYBUCHU_S,
         CZAS_WYBUCHU_S, SUFIT_Y_H, SPADEK_OD_Y_H }
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
/** Dmucha przez `sekundy` REALNEGO czasu: emituj + updateAndDraw co klatkę, jak main.js. */
function dmuchaj(d, sekundy, { kierunek = W_PRAWO, sila = 1, wyrazistosc = 1, usta = USTA } = {}) {
    for (let i = 0; i < Math.round(sekundy / DT); i++) {
        d.emituj(typeof usta === 'function' ? usta(i) : usta, kierunek, sila, wyrazistosc, DT, W);
        d.updateAndDraw(null, W, H, DT);
    }
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
function wstaw(d, wezly) {
    wezly[0].przerwa = true;
    d._wstegi.push({ id: -d._wstegi.length - 1, wezly, przerzedzen: 0 });
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

// --- 3. Wstęga: kreska, nie cząstki ---
console.log('\nWSTĘGA (kreska ciągła):');
{
    let minO = Infinity, maxO = -Infinity;
    for (let t = 0; t < 10; t += 0.01) { const o = Dym.oddech(t); minO = Math.min(minO, o); maxO = Math.max(maxO, o); }
    spr(`oddech nigdy do zera (min ${minO.toFixed(2)})`, minO >= 1 - ODDECH_AMPLITUDA - 1e-9 && minO > 0.5);
    spr(`oddech ograniczony (max ${maxO.toFixed(2)})`, maxO <= 1 + ODDECH_AMPLITUDA + 1e-9);
    spr('oddech NaN -> liczba', Number.isFinite(Dym.oddech(NaN)));

    const d = new Dym();
    dmuchaj(d, 1);
    spr(`1 s dmuchania -> jedna wstęga (${d.wsteg})`, d.wsteg === 1);
    spr(`...o >= 50 węzłach (${d.liczba})`, d.liczba >= 50 && d.liczba <= WEZLY_NA_S * 1.3);
    const w = d._wstegi[0];
    spr('tylko PIERWSZY węzeł ma przerwę (kreska jest ciągła)',
        w.wezly[0].przerwa === true && w.wezly.slice(1).every(c => !c.przerwa));
    // Ciągłość daje STROKE między węzłami, nie ich gęstość - ale odstęp musi
    // być na tyle mały, żeby kreska nie ścinała zakrętów (malowanie).
    let maxLuka = 0;
    for (let i = 1; i < w.wezly.length; i++) {
        const a = w.wezly[i - 1], b = w.wezly[i];
        maxLuka = Math.max(maxLuka, Math.hypot(a.x - b.x, a.y - b.y));
    }
    spr(`odstęp sąsiadów mały (${maxLuka.toFixed(1)} px < 0.06 W = ${(0.06 * W).toFixed(0)})`, maxLuka < 0.06 * W);

    przepusc(d, 0.5);
    dmuchaj(d, 0.3);
    spr(`po przerwie zaczyna się NOWA wstęga (${d.wsteg})`, d.wsteg === 2);

    const e = new Dym();
    dmuchaj(e, 1, { sila: 0.35 });
    spr(`przy sile podłogi kreska nadal ciągła (${e.liczba} węzłów)`, e.liczba >= 30);
}

// --- 4. Malowanie: zataczanie okręgu rysuje okrąg ---
console.log('\nMALOWANIE (okrąg zatoczony ustami):');
{
    const R = 220, SR = { x: 900, y: 500 };
    const naOkregu = (i) => ({ x: SR.x + R * Math.cos(i / 90 * 2 * Math.PI),
                                y: SR.y + R * Math.sin(i / 90 * 2 * Math.PI) });
    const promienie = (d) => wszystkie(d).map(c => Math.hypot(c.x - SR.x, c.y - SR.y));
    const srodek = (d) => {
        const n = d.liczba;
        return wszystkie(d).reduce((a, c) => ({ x: a.x + c.x / n, y: a.y + c.y / n }), { x: 0, y: 0 });
    };

    // Sam ŚLAD ust: emisja bez fizyki - węzły rodzą się dokładnie tam, gdzie
    // były usta, więc zatoczony okrąg jest okręgiem.
    const slad = new Dym();
    for (let i = 0; i < 90; i++) slad.emituj(naOkregu(i), { x: 0, y: -1 }, 1, 0, DT, W);
    const rs = promienie(slad);
    const sredni = rs.reduce((a, b) => a + b, 0) / rs.length;
    const odchyl = Math.max(...rs.map(r => Math.abs(r - sredni)));
    spr(`ślad ust to okrąg (odchylenie ${(odchyl / R * 100).toFixed(1)}% < 5%)`, odchyl < 0.05 * R);
    spr(`...o zadanym promieniu (${sredni.toFixed(0)} px ≈ ${R})`, Math.abs(sredni - R) < 0.1 * R);

    // v5: kształt ma być czytelny TYLKO tak długo, jak trwa kolumna - potem
    // celowo rozpada się w chmurę (życzenie: "naturalny dym ważniejszy").
    const wzglednySrodka = (d) => {
        const c0 = srodek(d);
        return wszystkie(d).map(c => Math.hypot(c.x - c0.x, c.y - c0.y));
    };
    const sredniaZ = (t) => t.reduce((a, b) => a + b, 0) / t.length;
    const d = new Dym();
    dmuchaj(d, 1.5, { wyrazistosc: 0, kierunek: { x: 0, y: -1 }, usta: naOkregu });
    const wKolumnie = sredniaZ(wzglednySrodka(d));
    przepusc(d, 12);
    const wChmurze = sredniaZ(wzglednySrodka(d));
    spr(`kształt rozlewa się po rozpadzie (${wKolumnie.toFixed(0)} -> ${wChmurze.toFixed(0)} px)`,
        wChmurze > 1.2 * wKolumnie);
}

// --- 4b. Rozpad kolumny w chmurę (v5) ---
console.log('\nROZPAD KOLUMNY W CHMURĘ:');
spr('świeży węzeł w pełni spójny', spojnosc(0) === 1);
spr(`spójność trzyma przez KOLUMNA_S (${KOLUMNA_S} s)`, spojnosc(KOLUMNA_S) === 1);
spr('po jednym tau spójność wyraźnie spada', spojnosc(KOLUMNA_S + TAU_ROZPADU_S) < 0.4);
spr('po trzech tau kreski praktycznie nie ma', spojnosc(KOLUMNA_S + 3 * TAU_ROZPADU_S) < 0.06);
spr('spójność maleje monotonicznie', (() => {
    let poprz = 2;
    for (let t = 0; t < 20; t += 0.1) { const v = spojnosc(t); if (v > poprz + 1e-9) return false; poprz = v; }
    return true;
})());
spr('spójność odporna na NaN', spojnosc(NaN) === 1);
{
    // Kolumna: przez pierwsze sekundy sąsiedzi lecą RÓWNOLEGLE (kreska jest kreską).
    const d = new Dym();
    dmuchaj(d, 0.5, { kierunek: W_PRAWO });
    const kat = (c) => Math.atan2(c.vy, c.vx);
    const w = () => d._wstegi[0].wezly;
    const rozrzut = () => {
        const katy = w().map(kat);
        return Math.max(...katy) - Math.min(...katy);
    };
    const odstep = () => {
        const l = w();
        let suma = 0;
        for (let i = 1; i < l.length; i++) suma += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y);
        return suma / (l.length - 1);
    };
    const rozrzutKolumny = rozrzut(), odstepKolumny = odstep();
    spr(`w kolumnie kierunki sąsiadów prawie równoległe (${(rozrzutKolumny * 180 / Math.PI).toFixed(1)}° < 10°)`,
        rozrzutKolumny < 10 * Math.PI / 180);

    // Rozpad: po kilku sekundach sąsiedzi rozchodzą się i wstęga pęka.
    przepusc(d, 8);
    const rozrzutChmury = rozrzut(), odstepChmury = odstep();
    spr(`w chmurze kierunki się rozjeżdżają (${(rozrzutChmury * 180 / Math.PI).toFixed(0)}° > 40°)`,
        rozrzutChmury > 40 * Math.PI / 180);
    spr(`...a odstęp sąsiadów rośnie (${odstepKolumny.toFixed(0)} -> ${odstepChmury.toFixed(0)} px)`,
        odstepChmury > 1.5 * odstepKolumny);
}

// --- 5. Cztery strony świata ---
console.log('\nCZTERY STRONY ŚWIATA:');
{
    const d = new Dym();
    dmuchaj(d, 0.5, { kierunek: W_DOL });
    przepusc(d, 2.5);
    const nizej = wszystkie(d).filter(c => c.y > USTA.y).length;
    spr(`REGRESJA v3 (SKOS_W_GORE): dmuchanie w DÓŁ - wszystkie węzły NIŻEJ ust (${nizej}/${d.liczba})`,
        nizej === d.liczba);
    const zasiegDol = Math.max(...wszystkie(d).map(c => c.y)) - USTA.y;
    spr(`...i sięga w dół ${(zasiegDol / W).toFixed(2)} W (0.3-0.8 - "mocno w dół")`,
        zasiegDol / W > 0.3 && zasiegDol / W < 0.8);

    const e = new Dym();
    dmuchaj(e, 0.5, { kierunek: W_PRAWO });
    przepusc(e, 2.5);
    const wBok = Math.max(...wszystkie(e).map(c => c.x)) - USTA.x;
    spr(`dmuchanie w BOK sięga ${(wBok / W).toFixed(2)} W (0.3-0.8 - "mocno w boki")`,
        wBok / W > 0.3 && wBok / W < 0.8);
    spr('w bok kreska trzyma się poziomu (|dy| < 0.08 W)',
        wszystkie(e).every(c => Math.abs(c.y - USTA.y) < 0.08 * W));

    // Dopiero PO TAU_WYPORU_S dym rusza w górę - to jest "trzyma pozycję ~8 s".
    przepusc(d, TAU_WYPORU_S * 3);
    spr('po trzech stałych czasowych wyporu dym płynie W GÓRĘ', wszystkie(d).every(c => c.vy < 0));
}

// --- 6. Wyrazistość steruje prędkością wylotu ---
console.log('\nWYRAZISTOŚĆ USTAWIENIA GRACZA:');
{
    const mocno = new Dym(); dmuchaj(mocno, 0.3, { wyrazistosc: 1 }); przepusc(mocno, 2.7);
    const slabo = new Dym(); dmuchaj(slabo, 0.3, { wyrazistosc: 0 }); przepusc(slabo, 2.7);
    const zasieg = (d) => Math.max(...wszystkie(d).map(c => c.x)) - USTA.x;
    const zm = zasieg(mocno), zs = zasieg(slabo);
    spr(`wyrazista poza strzela dalej (${(zm / W).toFixed(2)} W vs ${(zs / W).toFixed(2)} W)`, zm > 2 * zs);
    spr(`...a nijaka i tak coś wypuszcza (podłoga ${WYRAZISTOSC_PODLOGA})`, zs > 0.03 * W);
    spr('brak wyrazistości (undefined) nie wywala', (() => {
        const x = new Dym();
        x.emituj(USTA, W_PRAWO, 1, undefined, DT, W);
        return wszystkie(x).every(c => Number.isFinite(c.vx));
    })());
}

// --- 7. Szerokość kreski: cienka przy ustach, grubsza dalej ---
console.log('\nSZEROKOŚĆ KRESKI:');
{
    const d = new Dym();
    // 45 węzłów/s przy dt=1/60 to 0.75 na klatkę - potrzeba kilku klatek.
    for (let i = 0; i < 3; i++) d.emituj(USTA, W_PRAWO, 1, 1, DT, W);
    const c = wszystkie(d)[0];
    spr(`przy ustach r = ${c.r.toFixed(0)} px (${R_START_W} W)`, Math.abs(c.r - W * R_START_W) < 1);
    przepusc(d, ROZROST_TAU_S);
    spr('po jednej stałej czasowej kreska wyraźnie szersza', c.r > 3 * W * R_START_W);
    przepusc(d, 10);
    spr(`po ~10 s >= 90% docelowej szerokości - kłąb ma być GRUBY (${(c.r / c.rCel * 100).toFixed(0)}%)`,
        c.r >= 0.9 * c.rCel);
    spr(`docelowa szerokość kłębu duża (${(c.rCel / W).toFixed(3)} W >= 0.05)`, c.rCel / W >= 0.05);
    spr('szerokość nigdy nie przekracza celu', c.r <= c.rCel + 1e-6);
}

// --- 8. Budżet: sufity, przerzedzanie ---
console.log('\nBUDŻET (sufity, przerzedzanie):');
{
    const d = new Dym();
    dmuchaj(d, 20);
    const przed = d.liczba;
    spr(`20 s dmuchania -> ${przed} węzłów, wstęg ${d.wsteg}`, przed > 400 && przed <= MAX_WEZLOW);
    spr(`wstęga nie rośnie w nieskończoność (max ${MAX_WEZLOW_WSTEGI})`,
        d._wstegi.every(w => w.wezly.length <= MAX_WEZLOW_WSTEGI));

    // Przerzedzanie dopiero po PRZERZEDZ_PO_S i tylko dla NIEAKTYWNEJ wstęgi.
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
    for (let i = 0; i < MAX_WEZLOW + 200; i++) {
        d.emituj({ x: 100 + (i % 500), y: 600 }, W_PRAWO, 1, 1, 1 / WEZLY_NA_S, W);
    }
    spr(`sufit ${MAX_WEZLOW} nie jest przekroczony (${d.liczba})`, d.liczba === MAX_WEZLOW);
    spr('licznik = rzeczywista liczba węzłów', d.liczba === wszystkie(d).length);
}

// --- 9. Życie ---
console.log('\nŻYCIE WĘZŁA:');
{
    const d = new Dym();
    dmuchaj(d, 0.5);
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
    dmuchaj(d, 0.3);
    spr('updateAndDraw bez W/H używa domyślnej skali', Number.isFinite(d.updateAndDraw(null, undefined, undefined, DT)));
    spr('emituj bez W nie wywala', (() => { d.emituj(USTA, W_PRAWO, 1, 1, DT, undefined); return true; })());
    spr('kierunek zerowy -> fallback w górę, bez NaN', (() => {
        const x = new Dym();
        for (let i = 0; i < 20; i++) { x.emituj(USTA, { x: 0, y: 0 }, 1, 1, DT, W); x.updateAndDraw(null, W, H, DT); }
        return wszystkie(x).every(c => Number.isFinite(c.vx) && Number.isFinite(c.vy));
    })());
    d.podpal([{ x: NaN, y: NaN, r: 5 }]);
    d.rozgarnij([{ x: NaN, y: NaN, vx: NaN, vy: NaN }], W);
    d.updateAndDraw(null, W, H, DT);
    spr('NaN w zarzewiu/dłoni nie zatruwa pozycji', wszystkie(d).every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
    spr('zaczep NaN nie tworzy węzłów', (() => {
        const x = new Dym();
        x.emituj({ x: NaN, y: 1 }, W_PRAWO, 1, 1, DT, W);
        return x.liczba === 0;
    })());
}

process.exit(ok ? 0 : 1);
