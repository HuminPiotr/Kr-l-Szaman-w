/**
 * Łuk Peruna v3 - ostry niebieski zygzak odświeżany 12-16x/s, iskry,
 * prosta logika dłoni (dwie: między nimi, jedna: w górę); bez document.
 *   node tools/test-luk-peruna.mjs
 */
import { LukPeruna, obwiednia, koncowkiLuku, nowyZygzak, mapujZygzak, nowaIskra, punktyIskry, punktyOdnogi,
         CZAS_TRWANIA, NASTAWY } from '../js/lukPeruna.js';
import { klatka, kontekst, przepusc, atrapaCtx } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const SK = 200;

console.log('OBWIEDNIA:');
spr('zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);

console.log('\nKOŃCÓWKI ŁUKU (prosta logika dłoni):');
const dwa = koncowkiLuku([{ x: 100, y: 500 }, { x: 900, y: 500 }], SK);
spr('dwie dłonie -> łuk dokładnie między nimi', dwa.a.x === 100 && dwa.b.x === 900 && dwa.b.y === 500);
const jedna = koncowkiLuku([{ x: 700, y: 500 }], SK);
spr('jedna dłoń -> piorun z tej dłoni prosto W GÓRĘ',
    jedna.a.x === 700 && jedna.a.y === 500 && jedna.b.x === 700 && jedna.b.y === 500 - SK * NASTAWY.WYSOKOSC_JEDNEJ_DLONI);
spr('brak dłoni -> null (klasa trzyma wtedy ostatnie położenie)', koncowkiLuku([], SK) === null);

console.log('\nZYGZAK (ostre załamania jak błyskawica):');
let n = 0; const los = () => [0.5, 0.2, 0.9, 0.35, 0.7, 0.1, 0.8, 0.45, 0.6, 0.25][n++ % 10];
const zyg = nowyZygzak(0.5);
spr('ścieżka znormalizowana od (0,0) do (1,0)', zyg[0].x === 0 && zyg[0].y === 0 && zyg[zyg.length - 1].x === 1 && zyg[zyg.length - 1].y === 0);
spr(`dużo załamań (${zyg.length} punktów)`, zyg.length >= 17);
const katy = [];
for (let i = 1; i < zyg.length - 1; i++) {
    const a1 = Math.atan2(zyg[i].y - zyg[i - 1].y, zyg[i].x - zyg[i - 1].x);
    const a2 = Math.atan2(zyg[i + 1].y - zyg[i].y, zyg[i + 1].x - zyg[i].x);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    katy.push(d);
}
// Zmierzone na 500 losowaniach: najmniejsze maks. załamanie 64° (r=0.5) - próg 50° nie jest loterią.
spr(`OSTRE kąty, nie płynna fala (maks. zmiana kierunku ${(Math.max(...katy) * 180 / Math.PI).toFixed(0)}° > 50°)`, Math.max(...katy) > 50 * Math.PI / 180);
const wych = (z) => Math.max(...z.map(p => Math.abs(p.y)));
const srednioWych = (r) => { let s = 0; for (let i = 0; i < 40; i++) s += wych(nowyZygzak(r)); return s / 40; };
spr('rozsunięte dłonie -> bardziej poszarpany zygzak', srednioWych(1) > srednioWych(0));

const A = { x: 400, y: 600 }, B = { x: 1000, y: 600 };
const luk = mapujZygzak(zyg, A, B, SK, 1.0, 5);
spr('po zmapowaniu końce dokładnie w dłoniach', luk[0].x === A.x && luk[0].y === A.y && luk[luk.length - 1].x === B.x && luk[luk.length - 1].y === B.y);
const luk2 = mapujZygzak(zyg, A, B, SK, 1.016, 5);
const drgniecie = Math.max(...luk.map((p, i) => Math.hypot(p.x - luk2[i].x, p.y - luk2[i].y)));
spr(`między odświeżeniami ten sam kształt, tylko drgnięcie (${drgniecie.toFixed(1)} px)`, drgniecie > 0 && drgniecie < SK * 0.05);
spr('dłonie w tym samym punkcie -> bez NaN', mapujZygzak(zyg, A, A, SK, 1, 5).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));

console.log('\nKOLOR:');
const [r, g, b] = NASTAWY.BARWA;
spr('główna linia NIEBIESKA (b wyraźnie > r)', b > r + 100 && b >= g);

console.log('\nIŚKRY:');
const iskra = nowaIskra(los);
spr('iskra trwa co najmniej 5 klatek przy 60 FPS', NASTAWY.ISKRA_ZYCIE_MIN * 60 >= 4.8 && iskra.zycie <= NASTAWY.ISKRA_ZYCIE_MAX);
const pi = punktyIskry(iskra, luk, SK);
const dlIskry = Math.hypot(pi[pi.length - 1].x - pi[0].x, pi[pi.length - 1].y - pi[0].y);
spr('iskra zaczyna się NA łuku i jest wyraźnie długa', luk.some(p => Math.hypot(p.x - pi[0].x, p.y - pi[0].y) < 1e-6) && dlIskry >= SK * NASTAWY.ISKRA_DLUGOSC_OD * 0.99);
const odn = punktyOdnogi(iskra, luk, SK);
spr('odnoga wyrasta z iskry', pi.some(p => Math.hypot(p.x - odn[0].x, p.y - odn[0].y) < 1e-6));

console.log('\nKLASA: ODŚWIEŻANIE I DŁONIE:');
const l = new LukPeruna();
l.zapal(1); l.zapal(1);
spr('aktywny po zapal()', l.aktywny);
const dwieF = klatka({ dlonie: [[0.4, 0.5], [0.6, 0.5]] });
przepusc(l, dwieF, 0.5);
spr('dwie dłonie -> końce w dłoniach', Math.abs(l.konce.a.x - 0.4 * 1920) < 2 && Math.abs(l.konce.b.x - 0.6 * 1920) < 2);
l._doOdswiezenia = 0.05;
const zygPrzed = l._zygzak;
l.updateAndDraw(null, kontekst(dwieF), 1 / 60);
spr('w trakcie interwału ten sam zygzak', l._zygzak === zygPrzed);
przepusc(l, dwieF, 0.06);
spr('po interwale nowy kształt (trzask)', l._zygzak !== zygPrzed);
let odswiezen = 0, ostatni = l._zygzak;
for (let i = 0; i < 60; i++) { l.updateAndDraw(null, kontekst(dwieF), 1 / 60); if (l._zygzak !== ostatni) { odswiezen++; ostatni = l._zygzak; } }
spr(`odświeżany ${odswiezen}x na sekundę (11-17)`, odswiezen >= 11 && odswiezen <= 17);

przepusc(l, klatka({ dlonie: [[0.6, 0.5]] }), 0.4);
const sk = l._skala.stan.s;
spr('jedna dłoń -> piorun przeskakuje W GÓRĘ od tej dłoni',
    Math.abs(l.konce.a.x - 0.6 * 1920) < 3 && Math.abs(l.konce.b.x - 0.6 * 1920) < 3 && l.konce.b.y < l.konce.a.y - sk);
przepusc(l, dwieF, 0.4);
spr('znów dwie dłonie -> łuk między nimi', Math.abs(l.konce.a.x - 0.4 * 1920) < 3 && Math.abs(l.konce.b.x - 0.6 * 1920) < 3);
const przed = { ...l.konce.a };
przepusc(l, klatka({ dlonie: [] }), 0.3);
spr('dłonie znikają -> łuk stoi w ostatnim miejscu', Math.abs(l.konce.a.x - przed.x) < 1e-6);

const bez = new LukPeruna();
bez.zapal(1);
let rzucil = false;
try { bez.updateAndDraw(atrapaCtx(), kontekst(klatka({ barki: null })), 1 / 60); } catch (e) { rzucil = e; }
spr('bez dłoni i pozy od początku - zastępcze końce, bez wyjątku', rzucil === false);

console.log('\nSTYLISTYKA:');
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
    for (let i = 0; i < 120; i++) lk.updateAndDraw(rejestrator, kontekst(dwieF), 1 / 60);
    spr('coś się rysuje', kreski > 0);
    spr('bez blendowania addytywnego "lighter"', !ops.has('lighter'));
    spr(`linie cienkie (maks. ${maxGrubosc} px <= 2)`, maxGrubosc <= 2);
    spr('iskry nie mnożą się bez końca', lk._iskry.length <= 30);
}

przepusc(l, klatka(), CZAS_TRWANIA);
spr('gaśnie po CZAS_TRWANIA', l.aktywny === false);

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
