/**
 * Łuk Peruna - elektryczność (cienka drgająca nitka + iskry), końce łuku
 * trzymane po TOŻSAMOŚCI dłoni, cykl życia; bez document.
 *   node tools/test-luk-peruna.mjs
 */
import { LukPeruna, obwiednia, koncowkiLuku, punktyLuku, nowaIskra, punktyIskry, CZAS_TRWANIA, NASTAWY } from '../js/lukPeruna.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const SK = 200;

console.log('OBWIEDNIA:');
spr('zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nKOŃCÓWKI ŁUKU (z tożsamości dłoni):');
const sl = (x, y, o = {}) => ({ x, y, widoczna: true, brak: 0, odpiecie: 0, ...o });
const dwa = koncowkiLuku({ a: sl(100, 500), b: sl(900, 500) }, SK);
spr('dwie widoczne dłonie -> łuk dokładnie między nimi', dwa.a.x === 100 && dwa.b.x === 900 && dwa.b.y === 500);
const nieznany = koncowkiLuku({ a: sl(900, 500), b: null }, SK);
spr('drugi koniec nigdy nie widziany -> nad jedyną dłonią (wyładowanie w górę)', nieznany.b.x === 900 && nieznany.b.y === 500 - SK * 2.2);
spr('brak jakiejkolwiek dłoni -> null', koncowkiLuku({ a: null, b: null }, SK) === null);

console.log('\nŁUK - CIENKA DRGAJĄCA NITKA:');
const A = { x: 400, y: 600 }, B = { x: 1000, y: 600 };
const luk = punktyLuku(A, B, SK, 1.0, 5, 0.5, 0);
spr(`${NASTAWY.PUNKTOW_LUKU} punktów, końce dokładnie w dłoniach`, luk.length === NASTAWY.PUNKTOW_LUKU && luk[0].x === A.x && luk[0].y === A.y && luk[luk.length - 1].x === B.x && luk[luk.length - 1].y === B.y);
const odchylenie = (pts) => Math.max(...pts.map(p => Math.abs(p.y - 600)));
spr('drga w poprzek linii dłoń-dłoń', odchylenie(luk) > 1);
spr('amplituda rośnie, gdy dłonie rozsunięte', odchylenie(punktyLuku(A, B, SK, 1.0, 5, 1, 0)) > odchylenie(punktyLuku(A, B, SK, 1.0, 5, 0, 0)));
spr('amplituda jest subtelna (nie wiecej niż 0.3 skali)', odchylenie(punktyLuku(A, B, SK, 1.0, 5, 1, 0)) <= SK * 0.3);
spr('ten sam czas i ziarno -> identyczny łuk (deterministyczny, bez losowania co klatkę)', JSON.stringify(punktyLuku(A, B, SK, 1.0, 5, 0.5, 0)) === JSON.stringify(luk));
spr('płynie w czasie (kolejny moment inny, ale blisko)', (() => { const l2 = punktyLuku(A, B, SK, 1.02, 5, 0.5, 0); return JSON.stringify(l2) !== JSON.stringify(luk) && l2.every((p, i) => Math.hypot(p.x - luk[i].x, p.y - luk[i].y) < SK * 0.2); })());
spr('druga nitka (inna faza) różni się od pierwszej', JSON.stringify(punktyLuku(A, B, SK, 1.0, 5, 0.5, 1)) !== JSON.stringify(luk));
spr('dłonie w tym samym punkcie -> bez NaN', punktyLuku(A, A, SK, 1, 5, 0, 0).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));

console.log('\nIŚKRY (drobne wyładowania):');
let i = 0; const los = () => [0.5, 0.2, 0.9, 0.35, 0.7, 0.1][i++ % 6];
const iskra = nowaIskra(los);
spr(`żyje ${NASTAWY.ISKRA_ZYCIE_MIN}-${NASTAWY.ISKRA_ZYCIE_MAX} s (krótko)`, iskra.zycie >= NASTAWY.ISKRA_ZYCIE_MIN && iskra.zycie <= NASTAWY.ISKRA_ZYCIE_MAX);
spr('wyrasta z punktu na łuku (s w 0..1)', iskra.s >= 0 && iskra.s <= 1);
const pi = punktyIskry(iskra, luk, SK);
spr('iskra jest krótka (nie dłuższa niż ISKRA_DLUGOSC_DO skali)', pi.length > 1 && Math.hypot(pi[pi.length - 1].x - pi[0].x, pi[pi.length - 1].y - pi[0].y) <= SK * NASTAWY.ISKRA_DLUGOSC_DO * 1.01);
spr('iskra zaczyna się NA łuku', luk.some(p => Math.hypot(p.x - pi[0].x, p.y - pi[0].y) < 1e-6));

console.log('\nCYKL ŻYCIA I TOŻSAMOŚĆ W KLASIE:');
const l = new LukPeruna();
l.zapal(1); l.zapal(1);
spr('aktywny po zapal()', l.aktywny);
przepusc(l, klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] }), 0.5);
const a1 = { ...l.konce.a }, b1 = { ...l.konce.b };
spr('końce łuku w dłoniach', Math.abs(a1.x - 0.4 * 1920) < 2 && Math.abs(b1.x - 0.6 * 1920) < 2);

// Lewa dłoń znika na 2 s, potem wraca w innym miejscu. Śledzimy skoki obu końców klatka po klatce.
let maxSkok = 0, poprzA = { ...l.konce.a }, poprzB = { ...l.konce.b };
const krokuj = (f, sek) => { for (let k = 0; k < Math.round(sek * 60); k++) {
    l.updateAndDraw(null, kontekst(f), 1 / 60);
    maxSkok = Math.max(maxSkok, Math.hypot(l.konce.a.x - poprzA.x, l.konce.a.y - poprzA.y), Math.hypot(l.konce.b.x - poprzB.x, l.konce.b.y - poprzB.y));
    poprzA = { ...l.konce.a }; poprzB = { ...l.konce.b };
} };
krokuj(klatka({ dlonie: [[0.6, 0.5]] }), 2);
const sk = l._skala.stan.s;
spr('po zgubieniu LEWEJ dłoni prawy koniec NIE zmienia się (zamiana kolejności nic nie przerzuca)', Math.abs(l.konce.b.x - b1.x) < 2);
spr('...a lewy koniec po okresie łaski płynnie wędruje nad prawą dłoń', Math.abs(l.konce.a.x - b1.x) < 2 && l.konce.a.y < b1.y - sk);
krokuj(klatka({ dlonie: [[0.3, 0.4], [0.6, 0.5]] }), 3);
spr('po powrocie lewy koniec dojeżdża do dłoni', Math.abs(l.konce.a.x - 0.3 * 1920) < 3);
spr(`w całym przebiegu żaden koniec nie skoczył o więcej niż 0.15 skali na klatkę (maks. ${maxSkok.toFixed(1)} px)`, maxSkok < sk * 0.15);

krokuj(klatka({ dlonie: [] }), 0.3);
spr('dłonie znikają -> końce skończone', [l.konce.a.x, l.konce.a.y, l.konce.b.x, l.konce.b.y].every(Number.isFinite));
const bez = new LukPeruna();
bez.zapal(1);
let rzucil2 = false;
try { bez.updateAndDraw(atrapaCtx(), kontekst(klatka({ barki: null })), 1 / 60); } catch (e) { rzucil2 = e; }
spr('bez dłoni i pozy od początku - zastępcze końce, bez wyjątku', rzucil2 === false);

console.log('\nSTYLISTYKA (elektryczność, nie błyskawica):');
{
    const ops = new Set(); let maxGrubosc = 0, kreski = 0;
    const nic = () => {};
    const rejestrator = new Proxy({ canvas: { width: 1920, height: 1080 } }, {
        get(cel, klucz) {
            if (klucz in cel) return cel[klucz];
            if (klucz === 'stroke') return () => { kreski++; };
            if (klucz === 'createRadialGradient' || klucz === 'createLinearGradient') return () => ({ addColorStop: nic });
            return nic;
        },
        set(cel, klucz, wartosc) {
            if (klucz === 'globalCompositeOperation') ops.add(wartosc);
            if (klucz === 'lineWidth') maxGrubosc = Math.max(maxGrubosc, wartosc);
            cel[klucz] = wartosc; return true;
        }
    });
    const lk = new LukPeruna();
    lk.zapal(1);
    for (let n = 0; n < 120; n++) lk.updateAndDraw(rejestrator, kontekst(klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] })), 1 / 60);
    spr('coś się rysuje (nitki + iskry)', kreski > 0);
    spr('bez blendowania addytywnego "lighter" (nic nie świeci jak błyskawica)', !ops.has('lighter'));
    spr(`linie cienkie (maks. ${maxGrubosc} px <= 2)`, maxGrubosc <= 2);
    spr('iskry żyją krótko - nigdy więcej niż kilkanaście naraz', lk._iskry.length <= 15 && lk._iskry.every(x => x.zycie <= NASTAWY.ISKRA_ZYCIE_MAX));
}

przepusc(l, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', l.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
