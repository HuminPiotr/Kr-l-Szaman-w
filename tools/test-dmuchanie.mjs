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
import { Dmuchanie, CZAS_POTENCJALU_MS, PELNY_SKALI, ZERO_SKALI, SKOS_W_GORE } from '../js/dmuchanie.js';
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
                  skretGlowy = 0, oczyWidoczne = true } = {}) {
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
    wl[0] = { x: usta[0] + skretGlowy * rozstaw, y: oczyY + 0.7 * rozstaw, z: usta[2], visibility: 0.9 };
    return wl;
}

function klatka(opts = {}) {
    const wl = cialo(opts);
    return { hands: [], pose: wl ? { landmarks: wl, worldLandmarks: wl } : null,
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
    spr('NaN jako dt nie wywala wyjątku', d.update(klatka({ now: 0 }), 1, NaN, 0) === 0 || true);
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

console.log('\nKIERUNEK WYDECHU (v2: głowa + dłoń, EMA):');
{
    // Głowa na wprost, dłoń P przy ustach z prawej strony -> kłąb leci w lewo
    // (od dłoni) i w górę (SKOS_W_GORE).
    const d = new Dmuchanie();
    resetSkali();
    d.uzbrój(0);
    dmuchajNKlatek(d, 40, { nadgP: [0.10, -0.78, 0.05], now: 0 });
    spr('wynik jest jednostkowy', Math.abs(Math.hypot(d.kierunek.x, d.kierunek.y) - 1) < 1e-6);
    spr(`składowa Y ujemna - w górę ekranu (${d.kierunek.y.toFixed(2)})`, d.kierunek.y < 0);
    spr(`dłoń z prawej -> składowa X w lewo, OD dłoni (${d.kierunek.x.toFixed(2)})`, d.kierunek.x < 0);
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
spr('SKOS_W_GORE ujemny (w górę ekranu)', SKOS_W_GORE < 0);

console.log('\nSTAŁE PROGÓW (dokumentacja - duża tolerancja na życzenie):');
spr('PELNY_SKALI < ZERO_SKALI (rampa ma sens)', PELNY_SKALI < ZERO_SKALI);
spr('ZERO_SKALI daje spory zapas tolerancji (>= 1.0 szerokości barków)', ZERO_SKALI >= 1.0);

process.exit(ok ? 0 : 1);
