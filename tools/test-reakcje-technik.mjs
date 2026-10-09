/**
 * js/reakcjeTechnik.js - warunki, rytm i jednostki reakcji Przewodzenie i
 * Burza w mgle; techniki zastąpione szpiegami.
 *   node tools/test-reakcje-technik.mjs
 */
import { ReakcjeTechnik, punktNaKregu, NASTAWY } from '../js/reakcjeTechnik.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;

function szpiedzy({ luk = false, kregi = false, mgla = false, piorun = false,
                    geom = { cx: 960, cy: 700, squash: 0.28, promienie: [300] }, uderzenie = { x: 900, y: 950 } } = {}) {
    const log = [];
    return {
        log,
        t: {
            lukPeruna: { aktywny: luk, srodek: () => ({ x: 960, y: 500 }), wyladowanieDo: (p) => { log.push(['luk.wyladowanieDo', p]); return true; } },
            kregiMokoszy: { aktywny: kregi, geometria: () => geom, naelektryzuj: () => { log.push(['kregi.naelektryzuj']); return true; } },
            mglaMokoszy: { aktywny: mgla, rozblysk: (z, s) => { log.push(['mgla.rozblysk', z, s]); return true; } },
            piorun: { aktywny: piorun, punktUderzenia: uderzenie }
        }
    };
}
const biegnij = (r, t, sek, los) => {
    const s = { przewodzenie: 0, burzaWMgle: 0 };
    for (let i = 0; i < Math.round(sek / DT); i++) { const w = r.klatka(t, DT, los); s.przewodzenie += w.przewodzenie; s.burzaWMgle += w.burzaWMgle; }
    return s;
};

console.log('PUNKT NA KRĘGU:');
const geom = { cx: 960, cy: 700, squash: 0.28, promienie: [300, 500] };
const p = punktNaKregu(geom, { x: 960, y: 200 }, 1);
spr('leży na elipsie wskazanego kręgu', Math.abs(Math.hypot((p.x - 960) / 500, (p.y - 700) / (500 * 0.28)) - 1) < 1e-9);
spr('po stronie celu (cel nad środkiem -> punkt nad środkiem)', p.y < 700);
spr('zła geometria/cel -> null', punktNaKregu(null, { x: 1, y: 1 }, 0) === null && punktNaKregu(geom, null, 0) === null && punktNaKregu(geom, { x: 1, y: 1 }, 9) === null);

console.log('\nPRZEWODZENIE:');
{
    const { t, log } = szpiedzy({ luk: true, kregi: true });
    const s = biegnij(new ReakcjeTechnik(), t, 3, () => 0.5);
    const oczek = Math.floor(3 / NASTAWY.ODSTEP_PRZEWODZENIA) + 1;
    spr(`wyładowanie co ${NASTAWY.ODSTEP_PRZEWODZENIA} s, pierwsze od razu (${s.przewodzenie} ~ ${oczek})`, Math.abs(s.przewodzenie - oczek) <= 1);
    spr('każde wyładowanie: łuk sięga do kręgu i kręgi się elektryzują',
        log.filter(w => w[0] === 'luk.wyladowanieDo').length === s.przewodzenie && log.filter(w => w[0] === 'kregi.naelektryzuj').length === s.przewodzenie);
    for (const [opis, o] of [['bez Łuku', { kregi: true }], ['bez Kręgów', { luk: true }], ['Kręgi bez żyjącego kręgu', { luk: true, kregi: true, geom: null }]]) {
        const sp = szpiedzy(o);
        const w = biegnij(new ReakcjeTechnik(), sp.t, 1);
        spr(`${opis}: zero jednostek i zero wywołań`, w.przewodzenie === 0 && !sp.log.some(x => x[0] !== 'mgla.rozblysk'));
    }
}

console.log('\nBURZA W MGLE:');
{
    const { t, log } = szpiedzy({ luk: true, mgla: true });
    const s = biegnij(new ReakcjeTechnik(), t, 2, () => 0.5);
    const odstep = NASTAWY.BLYSK_ODSTEP_MIN + 0.5 * (NASTAWY.BLYSK_ODSTEP_MAX - NASTAWY.BLYSK_ODSTEP_MIN);
    // Odstęp ~0.105 s to ~6.3 klatki - kwantyzacja do pełnych klatek daje kilka błysków mniej, stąd tolerancja 3.
    spr(`błyski w rytmie (${s.burzaWMgle} ~ ${Math.floor(2 / odstep) + 1})`, Math.abs(s.burzaWMgle - (Math.floor(2 / odstep) + 1)) <= 3);
    spr('źródło: środek Łuku, gdy Łuk trwa', log.filter(w => w[0] === 'mgla.rozblysk').every(w => w[1].x === 960 && w[1].y === 500));
    const g = szpiedzy({ piorun: true, mgla: true });
    biegnij(new ReakcjeTechnik(), g.t, 0.5, () => 0.5);
    spr('bez Łuku źródłem jest punkt uderzenia pioruna', g.log.length > 0 && g.log.every(w => w[1].x === 900 && w[1].y === 950));
    const brak = szpiedzy({ piorun: true, mgla: true, uderzenie: null });
    const wb = biegnij(new ReakcjeTechnik(), brak.t, 0.5);
    spr('punkt uderzenia null -> nic nie liczone ani wołane', wb.burzaWMgle === 0 && brak.log.length === 0);
    const bezMgly = szpiedzy({ luk: true, piorun: true });
    spr('bez Mgły: zero', biegnij(new ReakcjeTechnik(), bezMgly.t, 1).burzaWMgle === 0);
}

console.log('\nODPORNOŚĆ:');
{
    const { t } = szpiedzy({ luk: true, kregi: true, mgla: true });
    const w = new ReakcjeTechnik().klatka(t, 5);   // karta wróciła po 5 s
    spr('ogromne dt -> najwyżej 1 jednostka na reakcję', w.przewodzenie <= 1 && w.burzaWMgle <= 1);
    let rzucil = false;
    try { new ReakcjeTechnik().klatka({}, DT); new ReakcjeTechnik().klatka(null, NaN); } catch { rzucil = true; }
    spr('brak technik / zepsute dt - bez wyjątku', !rzucil);
    const r = new ReakcjeTechnik();
    spr('nowa instancja bezczynna', r._doPrzewodzenia === 0 && r._doBlysku === 0);
}

console.log('\nROZDARCIE (Grzmot w polu):');
{
    const pola = ({ mgla = false, kurzawa = false, wybuch = { x: 960, y: 550, skala: 200, sila: 1 } } = {}) => {
        const log = [];
        return { log, t: {
            grzmot: { wybuch },
            mglaMokoszy: { aktywny: mgla, rozepchnij: (z, s) => { log.push(['mgla.rozepchnij', z, s]); return true; }, rozblysk: () => true },
            kurzawa: { aktywny: kurzawa, szarpnij: (s) => { log.push(['kurzawa.szarpnij', s]); return true; } }
        } };
    };
    const a = pola({ mgla: true });
    spr('Grzmot + Mgła: dziura od punktu wybuchu, 1 jednostka',
        new ReakcjeTechnik().klatka(a.t, DT).rozdarcie === 1 && a.log.length === 1 && a.log[0][0] === 'mgla.rozepchnij' && a.log[0][1].x === 960);
    const b = pola({ kurzawa: true });
    spr('Grzmot + Kurzawa: szarpnięcie, 1 jednostka', new ReakcjeTechnik().klatka(b.t, DT).rozdarcie === 1 && b.log[0][0] === 'kurzawa.szarpnij');
    spr('Grzmot w obu polach: 2 jednostki', new ReakcjeTechnik().klatka(pola({ mgla: true, kurzawa: true }).t, DT).rozdarcie === 2);
    const c = pola();
    spr('bez pola: zero i nic nie wołane', new ReakcjeTechnik().klatka(c.t, DT).rozdarcie === 0 && c.log.length === 0);
    const d = pola({ mgla: true, kurzawa: true, wybuch: null });
    spr('bez wybuchu (inna klatka): zero', new ReakcjeTechnik().klatka(d.t, DT).rozdarcie === 0 && d.log.length === 0);
}

console.log('\nZAWIANIE (poryw Zawieruchy w polu):');
{
    const pola = ({ mgla = false, kurzawa = false, porywy = [{ kierunek: 1, yPasa: 700 }] } = {}) => {
        const log = [];
        return { log, t: {
            zawierucha: { porywySwieze: porywy },
            mglaMokoszy: { aktywny: mgla, znies: (k, s, y) => { log.push(['mgla.znies', k, y]); return true; }, rozblysk: () => true },
            kurzawa: { aktywny: kurzawa, znies: (k) => { log.push(['kurzawa.znies', k]); return true; } }
        } };
    };
    const a = pola({ mgla: true });
    spr('poryw + Mgła: znosi w stronę porywu na wysokości pasa, 1 jednostka',
        new ReakcjeTechnik().klatka(a.t, DT).zawianie === 1 && a.log[0][1] === 1 && a.log[0][2] === 700);
    const b = pola({ mgla: true, kurzawa: true, porywy: [{ kierunek: -1, yPasa: 700 }, { kierunek: 1, yPasa: 700 }] });
    spr('2 porywy w obu polach: 4 jednostki', new ReakcjeTechnik().klatka(b.t, DT).zawianie === 4);
    const c = pola({ porywy: [{ kierunek: 1 }] });
    spr('bez pola: zero', new ReakcjeTechnik().klatka(c.t, DT).zawianie === 0 && c.log.length === 0);
    const d = pola({ mgla: true, porywy: [{ kierunek: NaN }, null] });
    spr('zepsuty poryw: zero, bez wyjątku', new ReakcjeTechnik().klatka(d.t, DT).zawianie === 0);
}

console.log('\nLATARNIE (Błędne Ogniki w Mgle):');
{
    const zestaw = ({ mgla = false, ogniki = true, nowe = 3 } = {}) => {
        const log = [];
        let doOznaczenia = nowe;
        return { log, t: {
            bledneOgniki: { aktywny: ogniki, punkty: () => [{ x: 900, y: 600, skala: 200, jasnosc: 0.8 }],
                            oznaczMgle: () => { log.push(['ogniki.oznaczMgle']); const n = doOznaczenia; doOznaczenia = 0; return n; } },
            mglaMokoszy: { aktywny: mgla, podswietl: (p) => { log.push(['mgla.podswietl', p]); return true; }, rozblysk: () => true }
        } };
    };
    const a = zestaw({ mgla: true });
    const r = new ReakcjeTechnik();
    const w1 = r.klatka(a.t, DT), w2 = r.klatka(a.t, DT);
    spr('Ogniki + Mgła: podświetlenie od punktów ogników', a.log.some(l => l[0] === 'mgla.podswietl' && l[1][0].x === 900));
    spr('jednostki tylko za pierwsze wejście (3, potem 0)', w1.latarnie === 3 && w2.latarnie === 0);
    spr('podświetlenie trwa co klatkę (nie tylko przy pierwszym wejściu)', a.log.filter(l => l[0] === 'mgla.podswietl').length === 2);
    const b = zestaw();
    spr('bez Mgły: zero i nic nie wołane', new ReakcjeTechnik().klatka(b.t, DT).latarnie === 0 && b.log.length === 0);
    const c = zestaw({ mgla: true, ogniki: false });
    spr('bez ogników: zero', new ReakcjeTechnik().klatka(c.t, DT).latarnie === 0 && c.log.length === 0);
}

console.log('\nWIR OGNIKÓW (Kurzawa porywa Błędne Ogniki):');
{
    const ORB = { cx: 960, cy: 600, R: 280, squash: 0.28, kierunek: 1, predkosc: 3.6 };
    const zestaw = ({ kurzawa = true, ogniki = true, orbita = ORB } = {}) => {
        const log = [];
        let nowe = 4;
        return { log, t: {
            bledneOgniki: { aktywny: ogniki, punkty: () => [], oznaczMgle: () => 0,
                            porwij: (o) => { log.push(['ogniki.porwij', o]); const n = nowe; nowe = 0; return n; } },
            kurzawa: { aktywny: kurzawa, orbita: () => orbita }
        } };
    };
    const a = zestaw();
    const r = new ReakcjeTechnik();
    const w1 = r.klatka(a.t, DT), w2 = r.klatka(a.t, DT);
    spr('Ogniki + Kurzawa: porwanie orbitą Kurzawy', a.log[0]?.[0] === 'ogniki.porwij' && a.log[0][1] === ORB);
    spr('jednostki tylko za pierwsze porwanie (4, potem 0)', w1.wirOgnikow === 4 && w2.wirOgnikow === 0);
    const b = zestaw({ kurzawa: false });
    spr('bez Kurzawy: zero i nic nie wołane', new ReakcjeTechnik().klatka(b.t, DT).wirOgnikow === 0 && b.log.length === 0);
    const c = zestaw({ orbita: null });
    spr('Kurzawa bez orbity: zero, porwij nie wołane', new ReakcjeTechnik().klatka(c.t, DT).wirOgnikow === 0 && c.log.length === 0);
}

console.log('\nTĘCZA PO DESZCZU:');
{
    const zab = [];
    const tecza = { aktywna: false, pozostaloS: 0, barwaHue: 120 };
    const dodola = { pada: true, zabarw: (h) => { zab.push(h); return true; } };
    const r = new ReakcjeTechnik();
    const t = { tecza, dodola };
    spr('bez tęczy - nic', r.klatka(t, DT).teczaPoDeszczu === 0 && zab.length === 0);
    tecza.aktywna = true; tecza.pozostaloS = 30;
    spr('zapalenie tęczy w deszczu = 1 jednostka', r.klatka(t, DT).teczaPoDeszczu === 1);
    let suma = 0;
    for (let i = 0; i < 120; i++) { tecza.pozostaloS -= DT; suma += r.klatka(t, DT).teczaPoDeszczu; }
    spr('trwanie tęczy nie dokłada jednostek', suma === 0);
    spr('przez wspólne trwanie krople są barwione co klatkę', zab.length === 121 && zab.every(h => h === 120));
    tecza.pozostaloS = 30;
    spr('ponowne zapalenie (restart licznika) = kolejna jednostka', r.klatka(t, DT).teczaPoDeszczu === 1);
    const r2 = new ReakcjeTechnik();
    const sucho = { tecza: { aktywna: false, pozostaloS: 0, barwaHue: 0 }, dodola: { pada: false, zabarw: () => { throw new Error('nie wolno'); } } };
    r2.klatka(sucho, DT);
    sucho.tecza.aktywna = true; sucho.tecza.pozostaloS = 30;
    spr('tęcza bez deszczu - nic i bez barwienia', r2.klatka(sucho, DT).teczaPoDeszczu === 0);
    spr('brak tęczy/dodoli w worku nie rzuca', r2.klatka({}, DT).teczaPoDeszczu === 0);
}

console.log('\nBURZA W DESZCZU:');
{
    const bl = [];
    const dodola = { pada: true, rozblysk: (z, s) => { bl.push([z, s]); return true; } };
    const luk = { aktywny: true, srodek: () => ({ x: 960, y: 500 }), wyladowanieDo: () => true };
    const r = new ReakcjeTechnik();
    let suma = 0;
    for (let i = 0; i < 60; i++) suma += r.klatka({ lukPeruna: luk, dodola }, DT, () => 0.5).burzaWDeszczu;
    spr(`Łuk w deszczu błyska rytmicznie (${suma} w 1 s, ~7-17)`, suma >= 6 && suma <= 17);
    spr('błysk od środka Łuku, siła SILA_BLYSKU_LUK', bl.every(([z, s]) => z.x === 960 && s === NASTAWY.SILA_BLYSKU_LUK));
    const r2 = new ReakcjeTechnik();
    const piorun = { aktywny: true, punktUderzenia: { x: 900, y: 950 } };
    spr('piorun Gromu w deszczu błyska', r2.klatka({ piorun, dodola }, DT).burzaWDeszczu === 1);
    const r3 = new ReakcjeTechnik();
    const grzmot = { wybuch: { x: 800, y: 600, sila: 0.7 } };
    spr('wybuch Grzmotu w deszczu = 1 błysk', r3.klatka({ grzmot, dodola }, DT).burzaWDeszczu === 1);
    const sucho = { pada: false, rozblysk: () => { throw new Error('nie wolno'); } };
    spr('bez deszczu - nic', new ReakcjeTechnik().klatka({ lukPeruna: luk, piorun, grzmot, dodola: sucho }, DT).burzaWDeszczu === 0);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
