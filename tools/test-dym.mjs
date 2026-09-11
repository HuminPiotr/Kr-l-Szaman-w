/**
 * Dym Okadzenia v2 - wydech strumieniem, kłębienie, front ognia; BEZ document.
 *
 *   node tools/test-dym.mjs
 *
 * Rysowanie (drawImage, wypalTintowany) NIE JEST tu testowane - ten sam
 * powód co test-kolowrot.mjs. Fizyka idzie przez updateAndDraw(null, W, H,
 * dt) - guard na `!ctx` jest PO doliczeniu czasu i fizyki (patrz js/dym.js).
 *
 * v2 (2026-09-11, po teście na kamerze - "nieżywe tekstury, za mało, ma
 * wystrzeliwać kłęby"): dwie populacje (strumien/klab), wydech pulsowany,
 * opóźniony start kłębu, rozrost odsprzężony od życia, pole przepływu.
 */
import { Dym, wznoszenieCzynnik, obwiedniaAlfy, obwiedniaStrumienia,
         MAX_KLEBOW, MAX_STRUMIENIA, ZYCIE_MIN_S, ZYCIE_MAX_S, NAROST_S,
         OKRES_WYDECHU_S, WYDECH_AKTYWNY_S, KLAB_NA_WYDECH,
         KLAB_OPOZNIENIE_MIN_S, KLAB_OPOZNIENIE_MAX_S, KLAB_ROZROST_TAU_S,
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
function dmuchaj(d, sekundy, { kierunek = W_PRAWO, sila = 1 } = {}) {
    for (let i = 0; i < Math.round(sekundy / DT); i++) {
        d.emituj(USTA, kierunek, sila, DT, W);
        d.updateAndDraw(null, W, H, DT);
    }
}
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

// --- 3. Wydech pulsowany ---
console.log('\nWYDECH PULSOWANY (Dym.wydech - obwiednia okresu):');
spr('start okresu: obwiednia 0 (sin² od zera)', Dym.wydech(0) === 0);
spr('środek fazy aktywnej: obwiednia 1', Math.abs(Dym.wydech(WYDECH_AKTYWNY_S / 2) - 1) < 1e-9);
spr('tuż po fazie aktywnej: 0 (przerwa)', Dym.wydech(WYDECH_AKTYWNY_S + 0.01) === 0);
spr('koniec okresu: nadal 0', Dym.wydech(OKRES_WYDECHU_S - 0.01) === 0);
spr('kolejny okres: znowu aktywny', Dym.wydech(OKRES_WYDECHU_S + WYDECH_AKTYWNY_S / 2) > 0.99);
{
    const d = new Dym();
    dmuchaj(d, OKRES_WYDECHU_S);
    const strumien = d.strumienia, kleby = d.klebow;
    spr(`jeden okres dmuchania: >= 20 sprite'ów strumienia (${strumien})`, strumien >= 20);
    spr(`jeden okres dmuchania: dokładnie ${KLAB_NA_WYDECH} trwałe kłęby (${kleby})`, kleby === KLAB_NA_WYDECH);
    // Przerwa: w drugiej połowie okresu NIC nie przybywa.
    const d2 = new Dym();
    dmuchaj(d2, WYDECH_AKTYWNY_S + 0.05);
    const poAktywnej = d2.liczba;
    dmuchaj(d2, OKRES_WYDECHU_S - WYDECH_AKTYWNY_S - 0.1);
    spr('w przerwie między wydechami nic nie przybywa', d2.liczba <= poAktywnej);
    // Drugi wydech rodzi kolejne kłęby.
    dmuchaj(d2, WYDECH_AKTYWNY_S);
    spr(`drugi wydech dokłada kolejne ${KLAB_NA_WYDECH} kłęby (${d2.klebow})`, d2.klebow === 2 * KLAB_NA_WYDECH);
}
{
    // Przerwa w dmuchaniu (dłoń odsunięta) zeruje fazę - po powrocie
    // pierwszy wystrzał idzie od razu, nie po resztce przerwy.
    const d = new Dym();
    dmuchaj(d, WYDECH_AKTYWNY_S + 0.2);    // jesteśmy w przerwie
    przepusc(d, 0.5);                       // klatki BEZ emituj()
    const przed = d.strumienia;
    d.emituj(USTA, W_PRAWO, 1, DT, W); d.updateAndDraw(null, W, H, DT);
    d.emituj(USTA, W_PRAWO, 1, DT, W); d.updateAndDraw(null, W, H, DT);
    d.emituj(USTA, W_PRAWO, 1, DT, W); d.updateAndDraw(null, W, H, DT);
    spr('po przerwie w dmuchaniu wydech startuje od nowa (nowe kłęby od razu)', d.klebow === 2 * KLAB_NA_WYDECH);
    spr('sila=0 nic nie emituje', (() => { const x = new Dym(); dmuchaj(x, 1, { sila: 0 }); return x.liczba === 0; })());
    spr('brak zaczepu nic nie emituje, bez wyjątku', (() => { const x = new Dym(); x.emituj(null, W_PRAWO, 1, DT, W); return x.liczba === 0; })());
    void przed;
}

// --- 4. Strumień: wystrzał, hamowanie, krótkie życie, kierunek ---
console.log('\nSTRUMIEŃ (wystrzał z ust):');
{
    const d = new Dym();
    // Dojście do SZCZYTU wydechu (z tickami, żeby wcześniejsze sprite'y
    // miały wiek > 0), potem jedna klatka emisji bez ticku - jej sprite'y
    // (wiek === 0) są świeże i wystrzelone w pełni obwiedni.
    dmuchaj(d, WYDECH_AKTYWNY_S / 2 - DT);
    d.emituj(USTA, W_PRAWO, 1, DT, W);
    const swieze = d._kleby.filter(c => c.typ === 'strumien' && c.wiek === 0);
    spr(`świeże sprite'y strumienia istnieją (${swieze.length})`, swieze.length > 0);
    const v = swieze.map(c => Math.hypot(c.vx, c.vy));
    spr(`startują z |v| >= 500 px/s (min ${Math.min(...v).toFixed(0)})`, Math.min(...v) >= 500);
    spr('lecą W KIERUNKU dmuchania (vx > 0 przy kierunku w prawo)', swieze.every(c => c.vx > 0));
    spr('stożek: |vy| < |vx| dla każdego (±14°)', swieze.every(c => Math.abs(c.vy) < Math.abs(c.vx)));
    const jeden = swieze[0];
    przepusc(d, 1.4);
    spr(`po 1.4 s hamowanie poniżej 60 px/s (${Math.hypot(jeden.vx, jeden.vy).toFixed(0)})`,
        Math.hypot(jeden.vx, jeden.vy) < 60);
    spr('przeleciał w prawo od ust (>= 150 px)', jeden.x - USTA.x >= 150);
    przepusc(d, 2.0);
    spr('po ~3.4 s strumień zgasł (życie < 3 s)', d.strumienia === 0);
}

// --- 5. Kłąb: opóźniony start, narodziny tam, gdzie strumień zwalnia, rozrost ---
console.log('\nKŁĄB (kłębienie):');
{
    const d = new Dym();
    d.emituj(USTA, W_PRAWO, 1, DT, W);   // pierwsza klatka wydechu rodzi kłęby
    const kleby = d._kleby.filter(c => c.typ === 'klab');
    spr(`kłęby rodzą się na starcie wydechu (${kleby.length})`, kleby.length === KLAB_NA_WYDECH);
    spr('kłąb ma UJEMNY wiek (opóźniony start)',
        kleby.every(c => c.wiek <= -KLAB_OPOZNIENIE_MIN_S && c.wiek >= -KLAB_OPOZNIENIE_MAX_S));
    spr('kłąb rodzi się PRZED ustami w kierunku dmuchania (x > usta + 150)', kleby.every(c => c.x > USTA.x + 150));
    spr('kłąb ma życie 200-260 s', kleby.every(c => c.zycie >= ZYCIE_MIN_S && c.zycie <= ZYCIE_MAX_S));
    const k = kleby[0];
    d.updateAndDraw(null, W, H, DT);
    spr('przed startem kłąb nie ma promienia (nie da się go podpalić)', k.r === 0);
    spr('przed startem alfa = 0 (niewidoczny)', obwiedniaAlfy(k.wiek, k.zycie) === 0);
    przepusc(d, KLAB_OPOZNIENIE_MAX_S + NAROST_S + 0.1);
    spr('po opóźnieniu + naroście kłąb widoczny', obwiedniaAlfy(k.wiek, k.zycie) > 0.9);
    spr(`i ma promień > 0 (${k.r.toFixed(0)} px)`, k.r > 0);
    przepusc(d, 30);
    spr(`rozrost: >= 90% docelowego po ~30 s (${(k.r / k.rCel * 100).toFixed(0)}%) - nie po 2 min`,
        k.r >= 0.9 * k.rCel);
    spr('rozrost jest ease-out: tau ~9 s (90% po ~21 s)', KLAB_ROZROST_TAU_S >= 6 && KLAB_ROZROST_TAU_S <= 12);
    spr('kłąb obraca się widocznie (>= 0.15 rad/s)', Math.abs(k.wobrot) >= 0.15);
    spr('sąsiednie kłęby obracają się PRZECIWBIEŻNIE', Math.sign(kleby[0].wobrot) !== Math.sign(kleby[1].wobrot));
}

// --- 6. Pole przepływu: sąsiedzi płyną SPÓJNIE ---
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

// --- 7. Sufity per populacja ---
console.log('\nSUFITY (osobne FIFO):');
{
    const d = new Dym();
    for (let i = 0; i < MAX_STRUMIENIA + 50; i++) d._dodaj({ typ: 'strumien', x: 0, y: 0, wiek: 0, zycie: 2, stan: 'DYM' });
    spr(`strumień: nie przekracza ${MAX_STRUMIENIA} (${d.strumienia})`, d.strumienia === MAX_STRUMIENIA);
    for (let i = 0; i < MAX_KLEBOW + 50; i++) d._dodaj(klab({ x: i }));
    spr(`kłąb: nie przekracza ${MAX_KLEBOW} (${d.klebow})`, d.klebow === MAX_KLEBOW);
    spr('kłąb: wypchnięte NAJSTARSZE (pierwsze x zniknęły)', d._kleby.filter(c => c.typ === 'klab')[0].x === 50);
    spr('sufit kłębów nie rusza strumienia i odwrotnie', d.strumienia === MAX_STRUMIENIA);
}

// --- 8. Życie i wygasanie ---
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
    d._kleby.push(klab({ x: 900, wiek: -0.5, r: 0 }));
    d.podpal([{ x: 900, y: 700, r: 30 }]);
    spr('kłąb PRZED opóźnionym startem nie daje się podpalić', d._kleby[0].stan === 'DYM');
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
