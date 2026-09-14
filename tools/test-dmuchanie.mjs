/**
 * Dmuchanie - gest Okadzenia (technika dymu).
 *
 *   node tools/test-dmuchanie.mjs
 *
 * Pilnuje trzech rzeczy, które łatwo zepsuć przy późniejszych zmianach i
 * które są tu CELOWO INNE niż w Płonącym Palcu (js/plonacyPalec.js):
 * że odsunięcie dłoni WSTRZYMUJE technikę, a nie ją kończy; że wyczerpana
 * moc NIGDY nie kończy potencjału; i że jeden zegar 4-minutowy jest
 * jedynym samoistnym sposobem wygaśnięcia.
 */
import { Dmuchanie, CZAS_POTENCJALU_MS, PELNY_SKALI, ZERO_SKALI, WAGA_GLOWY,
         PAMIEC_KOLKA_S, INTENSYWNOSC_PODLOGA, SZCZYT_OKNO_MS } from '../js/dmuchanie.js';
import { resetSkali } from '../js/znaki/postawa.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const DT = 1 / 60;

/**
 * Ciało z barkami o rozstawie 0.30 m (origin w biodrach, Y w dół - patrz
 * znaki/postawa.js). `nadgarstek` i `usta` to przesunięcia [x,y,z] w metrach
 * od wspólnego punktu głowy (żeby "blisko"/"daleko" było czytelne w metrach
 * skali ciała, nie w surowych współrzędnych).
 */
function cialo({ nadgL = [-0.25, 0.05, 0], nadgP = [0.25, 0.05, 0],
                  usta = [0, -0.78, 0.05], ustaWidoczne = true, brakPozy = false,
                  skretGlowy = 0, pochylGlowy = 0, oczyWidoczne = true } = {}) {
    if (brakPozy) return null;
    const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
    wl[11] = { x: -0.15, y: -0.55, z: 0, visibility: 0.9 };   // BARK_L
    wl[12] = { x: 0.15, y: -0.55, z: 0, visibility: 0.9 };    // BARK_P
    wl[15] = { x: nadgL[0], y: nadgL[1], z: nadgL[2], visibility: 0.9 };
    wl[16] = { x: nadgP[0], y: nadgP[1], z: nadgP[2], visibility: 0.9 };
    wl[9] = { x: usta[0] - 0.02, y: usta[1], z: usta[2], visibility: ustaWidoczne ? 0.9 : 0.1 };
    wl[10] = { x: usta[0] + 0.02, y: usta[1], z: usta[2], visibility: ustaWidoczne ? 0.9 : 0.1 };
    // Głowa: oczy 2/5 w rozstawie 0.063 m nad ustami, nos 0 - 0.7 rozstawu
    // poniżej linii oczu (twarz na wprost, NOS_POD_OCZAMI) i przesunięty
    // o `skretGlowy` (ułamek rozstawu; dodatni = ku oku P).
    const rozstaw = 0.063, oczyY = usta[1] - 0.08;
    wl[2] = { x: usta[0] - rozstaw / 2, y: oczyY, z: usta[2], visibility: oczyWidoczne ? 0.9 : 0.1 };
    wl[5] = { x: usta[0] + rozstaw / 2, y: oczyY, z: usta[2], visibility: oczyWidoczne ? 0.9 : 0.1 };
    // `pochylGlowy` dodatni = głowa UNIESIONA (nos wyżej względem oczu).
    wl[0] = { x: usta[0] + skretGlowy * rozstaw,
              y: oczyY + (0.7 - pochylGlowy) * rozstaw, z: usta[2], visibility: 0.9 };
    return wl;
}

/**
 * Dłoń ułożona w kółko, zaczepiona przy podanym nadgarstku (v8).
 *
 * Kółko budujemy WPROST - opuszki kciuka i wskazującego w jednym punkcie,
 * stawy na okręgu o promieniu `promien` skali dłoni. Dłoń syntetyczna
 * z tools/_dlon-syntetyczna.mjs się tu nie nadaje (jej kciuk jest prostym
 * łańcuchem równoległym do palców) - powód opisany w tools/test-kolko.mjs.
 * `rozchyl` odsuwa kciuk, czyli ROZPINA kółko.
 */
function dlonZKolkiem(nadgarstek, { promien = 0.3, rozchyl = 0, skala = 0.09 } = {}) {
    const [ox, oy] = nadgarstek;
    const lm = Array.from({ length: 21 }, () => ({ x: ox, y: oy, z: 0 }));
    lm[0] = { x: ox, y: oy, z: 0 };
    lm[9] = { x: ox, y: oy - skala, z: 0 };
    lm[5] = { x: ox - 0.3 * skala, y: oy - 0.95 * skala, z: 0 };
    lm[13] = { x: ox + 0.3 * skala, y: oy - 0.95 * skala, z: 0 };
    lm[17] = { x: ox + 0.6 * skala, y: oy - 0.85 * skala, z: 0 };
    lm[1] = { x: ox - 0.5 * skala, y: oy - 0.2 * skala, z: 0 };

    const R = promien * skala;
    const srodek = { x: ox - 0.1 * skala, y: oy - (0.95 * skala + R) };
    const naOkregu = (kat) => ({ x: srodek.x + R * Math.sin(kat), y: srodek.y - R * Math.cos(kat), z: 0 });
    const styk = naOkregu(0);
    lm[4] = { x: styk.x - rozchyl * skala, y: styk.y + rozchyl * skala, z: 0 };
    lm[3] = naOkregu(-2.0);
    lm[2] = naOkregu(-2.9);
    lm[8] = { ...styk };
    lm[7] = naOkregu(2.0);
    lm[6] = naOkregu(2.9);
    lm[5] = naOkregu(3.6);
    for (const [m, p2, d2, t2] of [[9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]) {
        lm[p2] = { x: lm[m].x, y: lm[m].y - 0.3 * skala, z: 0 };
        lm[d2] = { x: lm[m].x, y: lm[m].y - 0.55 * skala, z: 0 };
        lm[t2] = { x: lm[m].x, y: lm[m].y - 0.75 * skala, z: 0 };
    }
    return lm;
}

/**
 * Klatka. `kolko: false` = dłonie w kadrze, ale BEZ kółka; `kolko: null` =
 * dłoni nie widać wcale (tracking zgubiony) - to dwa różne sygnały.
 */
function klatka(opts = {}) {
    const wl = cialo(opts);
    const hands = [];
    if (wl && opts.kolko !== null) {
        // Kółko układa ta ręka, która jest bliżej ust.
        const nadg = opts.nadgP ?? [0.25, 0.05, 0];
        const nadgL = opts.nadgL ?? [-0.25, 0.05, 0];
        const usta = opts.usta ?? [0, -0.78, 0.05];
        const d = (n) => Math.hypot(n[0] - usta[0], n[1] - usta[1]);
        const bliższa = d(nadg) <= d(nadgL) ? nadg : nadgL;
        hands.push({
            landmarks: dlonZKolkiem(bliższa, {
                promien: opts.promienKolka ?? 0.3,
                rozchyl: opts.kolko === false ? 0.7 : (opts.rozchylKolka ?? 0)
            }),
            worldLandmarks: null, handedness: null
        });
    }
    return { hands, pose: wl ? { landmarks: wl, worldLandmarks: wl } : null,
             width: 1920, height: 1080, dt: DT, now: opts.now ?? 0 };
}

/** Dmucha `n` klatek pod rząd (żeby histereza/wygładzenie zdążyły zadziałać). */
function dmuchajNKlatek(d, n, opts, mocFn = () => 1) {
    let out;
    for (let i = 0; i < n; i++) {
        out = d.update(klatka(opts), mocFn(i), DT, opts.now ?? 0);
    }
    return out;
}
console.log('BEZ COMBO:');
{
    const d = new Dmuchanie();
    resetSkali();
    const pobor = d.update(klatka({ nadgL: [0, -0.78, 0] }), 1, DT, 0);
    spr('bez uzbrojenia stan zostaje BEZCZYNNY', d.stan === 'BEZCZYNNY');
    spr('bez uzbrojenia sila = 0', d.sila === 0);
    spr('bez uzbrojenia pobór = 0', pobor === 0);
}

console.log('\nUZBROJENIE:');
{
    const d = new Dmuchanie();
    d.uzbrój(1000);
    spr('uzbrój() przechodzi w GOTOWY', d.stan === 'GOTOWY');
    spr('pozostaloS liczy się od CZAS_POTENCJALU_MS', CZAS_POTENCJALU_MS === 240_000);
}

console.log('\nGEST - DŁOŃ DALEKO OD UST:');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 10, { nadgL: [-0.25, 0.05, 0], nadgP: [0.25, 0.05, 0], now: 0 });
    spr('dłoń daleko - stan zostaje GOTOWY, nie DMUCHA', d.stan === 'GOTOWY');
    spr('dłoń daleko - sila = 0', d.sila === 0);
}

console.log('\nGEST - DŁOŃ PRZY USTACH:');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    // Nadgarstek P realistycznie blisko ust (~10 cm - dłoń przy twarzy,
    // NIE dotyka dosłownie zero cm, bo palce/dłoń są MIĘDZY nadgarstkiem
    // a wargami). Skala ciała w cialo() to 0.30 m, więc 0.10 m = 0.33
    // szerokości barków - poniżej PELNY_SKALI=0.45, czyli pełny wynik.
    dmuchajNKlatek(d, 20, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr(`dłoń przy ustach - stan przechodzi w DMUCHA (${d.stan})`, d.stan === 'DMUCHA');
    spr(`sila > 0 (${d.sila.toFixed(2)})`, d.sila > 0);
    spr('zaczep jest ustawiony', d.zaczep && Number.isFinite(d.zaczep.x) && Number.isFinite(d.zaczep.y));
    spr('kierunek jest jednostkowy',
        Math.abs(Math.hypot(d.kierunek.x, d.kierunek.y) - 1) < 1e-6);
}

console.log('\nPAUZA, NIE KONIEC (odsunięcie dłoni):');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 20, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr('faza 1: DMUCHA', d.stan === 'DMUCHA');
    dmuchajNKlatek(d, 20, { nadgP: [0.25, 0.05, 0], now: 0 });
    spr(`odsunięcie dłoni wraca do GOTOWY, NIE BEZCZYNNY (${d.stan})`, d.stan === 'GOTOWY');
    // I gracz może wrócić dłonią - technika nie jest skończona.
    dmuchajNKlatek(d, 20, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr(`powrót dłoni wznawia DMUCHA (${d.stan})`, d.stan === 'DMUCHA');
}

console.log('\nINNE COMBO ANULUJE POTENCJAŁ:');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 20, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr('przed anulowaniem: DMUCHA', d.stan === 'DMUCHA');
    d.anuluj();
    spr('anuluj() wraca do BEZCZYNNY', d.stan === 'BEZCZYNNY');
    spr('anuluj() zeruje siłę', d.sila === 0);
}

console.log('\nJEDEN ZEGAR - WYGAŚNIĘCIE PO 4 MIN:');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 5, { nadgP: [0.10, -0.78, 0.05], now: 1000 });
    spr('tuż po uzbrojeniu: nie BEZCZYNNY', d.stan !== 'BEZCZYNNY');
    d.update(klatka({ nadgP: [0.10, -0.78, 0.05], now: CZAS_POTENCJALU_MS + 1 }), 1, DT, CZAS_POTENCJALU_MS + 1);
    spr('po 4 minutach - BEZCZYNNY, nawet w trakcie DMUCHA', d.stan === 'BEZCZYNNY');
}
{
    // Potencjał NIE wygasa przedwcześnie - tuż PRZED zegarem wciąż aktywny.
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    d.update(klatka({ nadgP: [0.25, 0.05, 0], now: CZAS_POTENCJALU_MS - 1000 }), 1, DT, CZAS_POTENCJALU_MS - 1000);
    spr('tuż przed upływem 4 min - potencjał wciąż żywy', d.stan !== 'BEZCZYNNY');
}

console.log('\nWYCZERPANA MOC NIGDY NIE KOŃCZY POTENCJAŁU:');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    const pobor = dmuchajNKlatek(d, 20, { nadgP: [0.10, -0.78, 0.05], now: 0 }, () => 0);
    spr(`moc=0 przez cały czas - stan nadal DMUCHA (${d.stan})`, d.stan === 'DMUCHA');
    spr(`moc=0 - sila ma podłogę, nie jest zerem (${d.sila.toFixed(2)})`, d.sila > 0);
    spr('moc=0 - pobór wynosi 0 (nic nie ma do pobrania)', pobor === 0);
}

console.log('\nODPORNOŚĆ:');
{
    const d = new Dmuchanie();
    resetSkali();
    spr('update() bez uzbrojenia i bez pozy nie wywala wyjątku',
        d.update(klatka({ brakPozy: true }), 1, DT, 0) === 0);
    d.uzbrój(0);
    spr('update() z brakiem pozy po uzbrojeniu nie wywala wyjątku i zostaje w GOTOWY',
        d.update(klatka({ brakPozy: true }), 1, DT, 0) === 0 && d.stan === 'GOTOWY');
    spr('NaN jako dt nie wywala wyjątku', Number.isFinite(d.update(klatka({ now: 0 }), 1, NaN, 0)));
    spr('NaN jako moc nie wywala wyjątku', Number.isFinite(d.update(klatka({ now: 0 }), NaN, DT, 0)));
}

console.log('\nKOTWICA UST PRZEŻYWA ZASŁONIĘCIE:');
{
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    // Usta widoczne i dłoń blisko - łapiemy kotwicę i wchodzimy w DMUCHA.
    dmuchajNKlatek(d, 20, { nadgP: [0.10, -0.78, 0.05], usta: [0, -0.78, 0.05], now: 0 });
    spr('kotwica złapana, DMUCHA', d.stan === 'DMUCHA');
    // Teraz usta "zasłonięte" (niska widoczność) - ale dłoń tam gdzie była
    // kotwica: gest MUSI nadal działać na starej, pewnej pozycji.
    dmuchajNKlatek(d, 20, {
        nadgP: [0.10, -0.78, 0.05], usta: [0, -0.78, 0.05], ustaWidoczne: false, now: 0
    });
    spr(`usta zasłonięte przez dłoń - DMUCHA trwa dalej (${d.stan})`, d.stan === 'DMUCHA');
}

console.log('\nKIERUNEK WYDECHU (v4: cztery strony świata, głowa + dłoń, EMA):');
{
    // Głowa na wprost, dłoń P przy ustach z prawej strony -> dym leci w lewo
    // (OD dłoni) i lekko w górę (dłoń jest poniżej ust).
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr('wynik jest jednostkowy', Math.abs(Math.hypot(d.kierunek.x, d.kierunek.y) - 1) < 1e-6);
    // v4: ŻADNEGO wbudowanego skosu w górę - dłoń na wysokości ust daje
    // kierunek poziomy. W v3 SKOS_W_GORE wymuszał tu y < 0 zawsze.
    spr(`dłoń na wysokości ust -> kierunek poziomy (${d.kierunek.y.toFixed(2)})`, Math.abs(d.kierunek.y) < 0.05);
    spr(`dłoń z prawej -> składowa X w lewo, OD dłoni (${d.kierunek.x.toFixed(2)})`, d.kierunek.x < 0);

    // Dłoń PONIŻEJ ust (naturalne ułożenie) -> dym leci w górę.
    const g = new Dmuchanie();
    resetSkali();
    g.uzbrój(0);
    dmuchajNKlatek(g, 40, { nadgP: [0.10, -0.70, 0.05], now: 0 });
    spr(`dłoń poniżej ust -> składowa Y ujemna, w górę (${g.kierunek.y.toFixed(2)})`, g.kierunek.y < 0);
}
{
    // Skręt głowy w stronę ucha P przeważa nad dłonią z tej samej strony.
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], skretGlowy: 0.4, now: 0 });
    spr(`nos ku oku P -> kierunek.x > 0 mimo dłoni z prawej (${d.kierunek.x.toFixed(2)})`, d.kierunek.x > 0);
    spr('głowa na wprost w pionie -> surowe pochylenie ~0', d.glowa && Math.abs(d.glowa.pochylenie) < 1e-6);
    const e = new Dmuchanie();
    resetSkali();
    e.uzbrój(0);
    dmuchajNKlatek(e, 40, { nadgL: [-0.10, -0.78, 0.05], skretGlowy: -0.4, now: 0 });
    spr(`nos ku oku L -> kierunek.x < 0 (${e.kierunek.x.toFixed(2)})`, e.kierunek.x < 0);
}
{
    // Bez oczu (niepewne) - fallback na samą dłoń, nadal jednostkowy, w górę.
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], oczyWidoczne: false, now: 0 });
    spr('bez oczu: fallback na dłoń - X od dłoni', d.kierunek.x < 0);
    spr('bez oczu: nadal jednostkowy', Math.abs(Math.hypot(d.kierunek.x, d.kierunek.y) - 1) < 1e-6);
    spr('bez oczu: glowa === null (HUD wie, że sygnału nie ma)', d.glowa === null);
}
{
    // EMA: nagły skręt głowy nie przerzuca kierunku w jednej klatce.
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], skretGlowy: -0.4, now: 0 });
    const przed = { ...d.kierunek };
    dmuchajNKlatek(d, 1, { nadgP: [0.10, -0.78, 0.05], skretGlowy: 0.4, now: 0 });
    const skok = Math.hypot(d.kierunek.x - przed.x, d.kierunek.y - przed.y);
    spr(`EMA: skok kierunku w jednej klatce mały (${skok.toFixed(3)} < 0.2)`, skok < 0.2);
    dmuchajNKlatek(d, 60, { nadgP: [0.10, -0.78, 0.05], skretGlowy: 0.4, now: 0 });
    spr('...ale po sekundzie kierunek dochodzi do nowego skrętu', d.kierunek.x > 0);
}

console.log('\nCZTERY STRONY ŚWIATA (v4 - regresja na SKOS_W_GORE):');
{
    // Głowa OPUSZCZONA (nos niżej względem oczu) -> dym leci W DÓŁ. W v3 było
    // to niemożliwe: stały skos -0.3 trzymał składową Y zawsze ujemną.
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 60, { nadgP: [0.10, -0.78, 0.05], pochylGlowy: -0.6, now: 0 });
    spr(`głowa opuszczona -> kierunek.y > 0, dym w DÓŁ (${d.kierunek.y.toFixed(2)})`, d.kierunek.y > 0);
    spr('surowe pochylenie ujemne (HUD)', d.glowa.pochylenie < 0);

    const e = new Dmuchanie();
    resetSkali();
    e.uzbrój(0);
    dmuchajNKlatek(e, 60, { nadgP: [0.10, -0.78, 0.05], pochylGlowy: 0.6, now: 0 });
    spr(`głowa uniesiona -> kierunek.y < 0, dym w GÓRĘ (${e.kierunek.y.toFixed(2)})`, e.kierunek.y < 0);

    const f = new Dmuchanie();
    resetSkali();
    f.uzbrój(0);
    dmuchajNKlatek(f, 60, { nadgP: [0.10, -0.78, 0.05], skretGlowy: 1.0, now: 0 });
    spr(`głowa skręcona mocno w bok -> kierunek prawie poziomy (y ${f.kierunek.y.toFixed(2)})`,
        Math.abs(f.kierunek.y) < 0.5 && f.kierunek.x > 0.5);
}

console.log('\nWYRAZISTOŚĆ USTAWIENIA (siła wypchnięcia):');
{
    // Zdecydowana poza: mocny skręt głowy + dłoń wskazująca ten sam kierunek.
    const zdecydowany = new Dmuchanie();
    resetSkali();
    zdecydowany.uzbrój(0);
    dmuchajNKlatek(zdecydowany, 60, { nadgL: [-0.10, -0.78, 0.05], skretGlowy: 1.0, now: 0 });
    spr(`zgodne, wyraźne sygnały -> wyrazistość wysoka (${zdecydowany.wyrazistosc.toFixed(2)})`,
        zdecydowany.wyrazistosc > 0.7);

    // Głowa na wprost (wektor zerowy) - zostaje sama dłoń z wagą 1-WAGA_GLOWY.
    const nijaki = new Dmuchanie();
    resetSkali();
    nijaki.uzbrój(0);
    dmuchajNKlatek(nijaki, 60, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr(`głowa na wprost -> wyrazistość ~${(1 - WAGA_GLOWY).toFixed(1)} (${nijaki.wyrazistosc.toFixed(2)})`,
        Math.abs(nijaki.wyrazistosc - (1 - WAGA_GLOWY)) < 0.1);
    spr('wyrazistość zawsze w 0..1', zdecydowany.wyrazistosc <= 1 && nijaki.wyrazistosc >= 0);

    // Sprzeczne sygnały: głowa skręcona w PRAWO, dłoń pcha w LEWO - wektory
    // się znoszą, więc siła wypchnięcia spada (poza jest niejednoznaczna).
    const sprzeczny = new Dmuchanie();
    resetSkali();
    sprzeczny.uzbrój(0);
    dmuchajNKlatek(sprzeczny, 60, { nadgP: [0.10, -0.78, 0.05], skretGlowy: 1.0, now: 0 });
    spr(`sprzeczne sygnały -> wyrazistość niższa niż przy zgodnych (${sprzeczny.wyrazistosc.toFixed(2)})`,
        sprzeczny.wyrazistosc < zdecydowany.wyrazistosc);

    const zgaszony = new Dmuchanie();
    resetSkali();
    zgaszony.uzbrój(0);
    dmuchajNKlatek(zgaszony, 10, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    zgaszony.anuluj();
    zgaszony.update(klatka({ now: 0 }), 1, DT, 0);
    spr('po wygaszeniu wyrazistość zeruje się', zgaszony.wyrazistosc === 0);
}

console.log('\nKÓŁKO Z PALCÓW - BONUS DO INTENSYWNOŚCI, NIE WARUNEK (v8.5):');
{
    // UPROSZCZONE (v8.5): sama dłoń przy ustach WYSTARCZA do dmuchania,
    // niezależnie od tego, czy palce układają kółko - pięć rund strojenia
    // (v8-v8.4) nie dało gestu niezawodnego w realnej grze. To jest
    // regresja na STARE zachowanie v8 (gdzie ten sam test oczekiwał GOTOWY).
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], kolko: false, now: 0 });
    spr(`dłoń przy ustach BEZ kółka -> i tak DMUCHA (${d.stan})`, d.stan === 'DMUCHA');
    spr(`...a wskaźnik kółka jest niski (${d.kolko.toFixed(2)}) - tylko telemetria, nic nie blokuje`,
        d.kolko < 0.3);
}
{
    // Wielkość kółka steruje intensywnością - jako BONUS, gdy się złapie.
    const bezKolka = new Dmuchanie(); resetSkali(); bezKolka.uzbrój(0);
    dmuchajNKlatek(bezKolka, 40, { nadgP: [0.10, -0.78, 0.05], kolko: false, now: 0 });
    const male = new Dmuchanie(); resetSkali(); male.uzbrój(0);
    dmuchajNKlatek(male, 40, { nadgP: [0.10, -0.78, 0.05], promienKolka: 0.16, now: 0 });
    const duze = new Dmuchanie(); resetSkali(); duze.uzbrój(0);
    dmuchajNKlatek(duze, 40, { nadgP: [0.10, -0.78, 0.05], promienKolka: 0.5, now: 0 });
    spr(`większe kółko -> większa intensywność (${male.intensywnosc.toFixed(2)} < ${duze.intensywnosc.toFixed(2)})`,
        duze.intensywnosc > male.intensywnosc + 0.2);
    spr(`brak kółka -> intensywność na PODŁODZE, nie zero (${bezKolka.intensywnosc.toFixed(2)})`,
        Math.abs(bezKolka.intensywnosc - INTENSYWNOSC_PODLOGA) < 1e-9);
    spr(`najmniejsze kółko i tak coś wypuszcza (podłoga ${INTENSYWNOSC_PODLOGA})`,
        male.intensywnosc >= INTENSYWNOSC_PODLOGA);
    spr('intensywność zawsze w 0..1', male.intensywnosc <= 1 && duze.intensywnosc <= 1);
    spr('wszystkie trzy dmuchają - kółko NIGDZIE nie jest warunkiem',
        bezKolka.stan === 'DMUCHA' && male.stan === 'DMUCHA' && duze.stan === 'DMUCHA');
}
{
    // PAMIĘĆ: zgubiona dłoń nie przerywa dymienia (i tak już nie przerywała,
    // skoro kółko nie jest warunkiem - ale intensywność dalej powinna płynnie
    // spadać do podłogi, nie do zera).
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    const intensywnoscPrzed = d.intensywnosc;
    dmuchajNKlatek(d, Math.round(0.4 / DT), { nadgP: [0.10, -0.78, 0.05], kolko: null, now: 0 });
    spr(`dłoń zgubiona na 0.4 s - dalej DMUCHA (${d.stan})`, d.stan === 'DMUCHA');
    spr(`...a intensywność spadła tylko częściowo (${intensywnoscPrzed.toFixed(2)} -> ${d.intensywnosc.toFixed(2)})`,
        d.intensywnosc >= INTENSYWNOSC_PODLOGA && d.intensywnosc < intensywnoscPrzed);
    dmuchajNKlatek(d, Math.round((PAMIEC_KOLKA_S + 0.3) / DT), { nadgP: [0.10, -0.78, 0.05], kolko: null, now: 0 });
    // v8.5: po wygaśnięciu pamięci intensywność wraca do PODŁOGI (dym dalej
    // leci, tylko bez bonusu) - kółko przestało być warunkiem "wszystko albo
    // nic", jest czystym regulatorem w górę.
    spr(`po ${PAMIEC_KOLKA_S} s pamięć wygasa - intensywność na PODŁODZE (${d.intensywnosc.toFixed(2)})`,
        Math.abs(d.intensywnosc - INTENSYWNOSC_PODLOGA) < 1e-9);
    spr('...i technika DALEJ DMUCHA (kółko nigdy nie gasiło dymu)', d.stan === 'DMUCHA');
}
{
    // Sama dłoń przy ustach, bez żadnej dłoni robiącej kółko w kadrze -
    // dalej dmucha (kółko: null = tracking dłoni w ogóle zgubiony).
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], kolko: null, now: 0 });
    spr('brak jakiejkolwiek dłoni w kadrze - dmuchanie i tak rusza (styk wystarcza)',
        d.stan === 'DMUCHA');
}


console.log('\nSZCZYT (v8.3 - odczyt HUD po opuszczeniu ręki):');
{
    // Gest wymaga obu rąk zajętych, więc żywy HUD nie da się zrzucić w tej
    // samej chwili co gest - SZCZYT trzyma najlepszy wynik przez kilka sekund.
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    const szczytPrzy = d.szczyt.gest;
    spr(`szczyt złapał dobry gest (${szczytPrzy.toFixed(2)})`, szczytPrzy > 0.5);

    // Ręka opuszczona - gest spada, ale SZCZYT ZOSTAJE (to jest cały sens).
    dmuchajNKlatek(d, 20, { nadgP: [0.25, 0.05, 0], now: 0 });
    spr(`po opuszczeniu ręki bieżący gest spadł (${d._gest.toFixed(2)} < ${szczytPrzy.toFixed(2)})`,
        d._gest < szczytPrzy);
    spr(`...ale szczyt wciąż pokazuje najlepszy wynik (${d.szczyt.gest.toFixed(2)})`,
        Math.abs(d.szczyt.gest - szczytPrzy) < 1e-9);

    // Po SZCZYT_OKNO_MS bez nowego, lepszego wyniku - szczyt "wygasa" (spada
    // do bieżącego), zamiast pokazywać dane sprzed minuty jako aktualne.
    const out = d.update(klatka({ nadgP: [0.25, 0.05, 0], now: SZCZYT_OKNO_MS + 100 }),
                          1, DT, SZCZYT_OKNO_MS + 100);
    spr('po SZCZYT_OKNO_MS szczyt wygasa do bieżącego (niskiego) wyniku',
        d.szczyt.gest < szczytPrzy);
}

console.log('\nSTAŁE PROGÓW (dokumentacja - duża tolerancja na życzenie):');
spr('PELNY_SKALI < ZERO_SKALI (rampa ma sens)', PELNY_SKALI < ZERO_SKALI);
// v8.1: ZWĘŻONE 1.2 -> 0.7 (patrz nagłówek dmuchanie.js "ZERO_SKALI ZWĘŻONE") -
// dwa niezależne, ciasne warunki (gest x kółko) są odporniejsze na fałszywe
// uruchomienia niż jeden ciasny i jeden luźny.
spr('ZERO_SKALI zwężone w v8.1, ale wciąż wybacza (0.6-0.9 szerokości barków)',
    ZERO_SKALI >= 0.6 && ZERO_SKALI <= 0.9);

process.exit(ok ? 0 : 1);
