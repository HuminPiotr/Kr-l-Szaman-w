/**
 * Kręgi Mokoszy v2 - fala uderzeniowa: świetliste kręgi co ~1 s, soczewka
 * zniekształcająca obraz pod kręgiem, rozbłysk przy narodzinach; bez document.
 *   node tools/test-kregi-mokoszy.mjs
 */
import { KregiMokoszy, obwiednia, poziomWody, stanKregu, stanDysku, punktyKregu, prostokatSoczewki,
         barwaKregu, nowePromienie, stanPromienia, pozycjaPromienia, punktyPradu, CZAS_TRWANIA, NASTAWY } from '../js/kregiMokoszy.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const ZACZEP = { x: 960, y: 400, skala: 200 };

console.log('POZIOM:');
spr('kręgi na wysokości pasa (pod barkami)', poziomWody(ZACZEP, H) === 400 + 200 * NASTAWY.POZIOM_MNOZNIK);
spr('nigdy niżej niż dół kadru', poziomWody({ x: 960, y: 0.85 * H, skala: 200 }, H) <= H * NASTAWY.DOL_EKRANU + 1e-9);

console.log('\nKRĄG (stan w czasie):');
const s0 = stanKregu(0.02), s1 = stanKregu(NASTAWY.ZYCIE_KREGU * 0.5), s2 = stanKregu(NASTAWY.ZYCIE_KREGU * 0.99);
spr('krąg rośnie od ciała na zewnątrz', s0.promien < s1.promien && s1.promien < s2.promien);
spr('startuje blisko ciała, kończy daleko', s0.promien < NASTAWY.PROMIEN_OD + 0.3 && s2.promien > NASTAWY.PROMIEN_DO * 0.95);
spr('rośnie szybko na starcie, potem zwalnia', (s1.promien - s0.promien) > (s2.promien - s1.promien));
spr('cienieje', s0.grubosc > s2.grubosc && s2.grubosc > 0);
spr('blednie do zera na końcu życia', s2.alfa < 0.02 && s1.alfa > 0.2);
spr('zniekształcenie najmocniejsze na starcie, słabnie', s0.soczewka > s1.soczewka && s1.soczewka > s2.soczewka);
spr('przed narodzinami i po śmierci - null', stanKregu(-0.1) === null && stanKregu(NASTAWY.ZYCIE_KREGU) === null && stanKregu(NaN) === null);

console.log('\nDYSK UDERZENIOWY PRZY NARODZINACH:');
const d0 = stanDysku(0.01), d1 = stanDysku(NASTAWY.DYSK_ZYCIE * 0.5);
spr('rozszerza się błyskawicznie', d1.promien > d0.promien * 3);
spr('pełny na starcie, gaśnie, znika po DYSK_ZYCIE', d0.alfa > 0.9 && d1.alfa < d0.alfa && stanDysku(NASTAWY.DYSK_ZYCIE) === null);

console.log('\nKOLOR KRĘGU:');
const b0 = barwaKregu(0), b1 = barwaKregu(1);
spr('na starcie turkus, na końcu głęboki błękit', b0.every((v, i) => v === NASTAWY.BARWA[i]) && b1.every((v, i) => v === NASTAWY.BARWA_KONCOWA[i]));
spr('w miarę rozchodzenia czerwieni i zieleni ubywa (z turkusu w błękit)', barwaKregu(0.5)[1] < b0[1] && barwaKregu(0.5)[1] > b1[1]);

console.log('\nPROMIENIE (smugi na zewnątrz kręgu):');
let n = 0; const los = () => [0.5, 0.2, 0.9, 0.35, 0.7, 0.1, 0.8][n++ % 7];
const pr0 = nowePromienie(los);
spr(`${NASTAWY.PROMIENIE_OD}-${NASTAWY.PROMIENIE_DO} promieni na krąg (${pr0.length})`, pr0.length >= NASTAWY.PROMIENIE_OD && pr0.length <= NASTAWY.PROMIENIE_DO);
const katy = pr0.map(p => ((p.kat % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
const luki = katy.map((k, i) => (i === 0 ? katy[0] + 2 * Math.PI - katy[katy.length - 1] : k - katy[i - 1]));
spr('rozstawione dookoła (żadna dziura większa niż 1.5 odstępu)', Math.max(...luki) < 2 * Math.PI / pr0.length * 1.5);
const sp0 = stanPromienia(0.05), sp1 = stanPromienia(NASTAWY.PROMIEN_ZYCIE * 0.6);
spr('promień zaczyna się PRZED krawędzią kręgu (biegnie przed falą)', sp0.r0 > stanKregu(0.05).promien && sp1.r0 > stanKregu(NASTAWY.PROMIEN_ZYCIE * 0.6).promien);
spr('wydłuża się i gaśnie', sp1.dlugosc > sp0.dlugosc && stanPromienia(NASTAWY.PROMIEN_ZYCIE * 0.99).alfa < 0.03);
spr('krótko żyje (null po PROMIEN_ZYCIE)', stanPromienia(NASTAWY.PROMIEN_ZYCIE) === null && NASTAWY.PROMIEN_ZYCIE < NASTAWY.ZYCIE_KREGU);
const poz = pr0.map(p => pozycjaPromienia(p, sp1, 960, 600, 200));
spr('każdy promień skierowany NA ZEWNĄTRZ od środka', poz.every(q => Math.hypot((q.x1 - 960), (q.y1 - 600) / NASTAWY.SQUASH) > Math.hypot((q.x0 - 960), (q.y0 - 600) / NASTAWY.SQUASH)));
spr('część promieni przed, część za graczem', poz.some(q => q.przod) && poz.some(q => !q.przod));

console.log('\nPUNKTY KRĘGU:');
const pk = punktyKregu(960, 660, 300, 1.0, 7);
spr(`${NASTAWY.PUNKTOW_KREGU + 1} punktów (zamknięta elipsa)`, pk.length === NASTAWY.PUNKTOW_KREGU + 1 && Math.hypot(pk[0].x - pk[pk.length - 1].x, pk[0].y - pk[pk.length - 1].y) < 1e-6);
spr('część kręgu PRZED i część ZA graczem', pk.some(p => p.przod) && pk.some(p => !p.przod));
spr('płaska elipsa (spłaszczona w pionie)', Math.max(...pk.map(p => Math.abs(p.y - 660))) < 300 * NASTAWY.SQUASH * 1.1);

console.log('\nSOCZEWKA (zniekształcenie pod kręgiem):');
const pr = prostokatSoczewki(960, 600, 300, 60, W, H);
spr('prostokąt kopii obejmuje cały pierścień', pr.x0 <= 960 - 330 && pr.x0 + pr.w >= 960 + 330 && pr.y0 <= 600 - 330 * NASTAWY.SQUASH);
const wielki = prostokatSoczewki(960, 600, 5000, 60, W, H);
spr('przycięty do kadru', wielki.x0 >= 0 && wielki.y0 >= 0 && wielki.x0 + wielki.w <= W && wielki.y0 + wielki.h <= H);
spr('pierścień całkiem poza kadrem -> null (nic nie kopiujemy)', prostokatSoczewki(-5000, 600, 100, 20, W, H) === null);

console.log('\nOBWIEDNIA I CYKL ŻYCIA:');
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);
const k = new KregiMokoszy();
spr('bezczynne na starcie', k.aktywny === false);
k.zapal(1); k.zapal(1);
let urodzone = 0, poprzednio = 0, maksBlyskow = 0, maksPromieni = 0;
for (let i = 0; i < Math.round(CZAS_TRWANIA * 60); i++) {
    k.updateAndDraw(null, kontekst(klatka()), 1 / 60);
    if (k._urodzone > poprzednio) { urodzone += k._urodzone - poprzednio; poprzednio = k._urodzone; }
    maksBlyskow = Math.max(maksBlyskow, k._dyski.length);
    maksPromieni = Math.max(maksPromieni, k._promienie.length);
}
spr(`kręgi co ~${NASTAWY.ODSTEP_KREGOW} s przez ${NASTAWY.EMISJA_S} s (urodzone: ${urodzone})`, urodzone === Math.ceil(NASTAWY.EMISJA_S / NASTAWY.ODSTEP_KREGOW));
spr('każdy krąg ma dysk uderzeniowy (krótki, nie kumulują się)', maksBlyskow >= 1 && maksBlyskow <= 2);
spr(`promienie rodzą się z kręgiem i krótko żyją (maks. naraz ${maksPromieni})`, maksPromieni >= NASTAWY.PROMIENIE_OD && maksPromieni <= NASTAWY.PROMIENIE_DO);
przepusc(k, klatka(), 0.1);   // suma 360 kroków po 1/60 s wypada tuż POD 6.0 (zaokrąglenie)
spr('gaśnie po CZAS_TRWANIA', k.aktywny === false);

console.log('\nŚLEDZENIE I ODPORNOŚĆ:');
const s = new KregiMokoszy();
s.zapal(1);
przepusc(s, klatka({ barki: [0.3, 0.4, 0.4, 0.4] }), 0.5);
const x1 = s.zaczep.x;
przepusc(s, klatka({ barki: [0.6, 0.4, 0.7, 0.4] }), 0.5);
spr('zaczep podąża za barkami', s.zaczep.x > x1 + 100);
const x2 = s.zaczep.x;
przepusc(s, klatka({ barki: null }), 0.3);
spr('poza znika -> zaczep stoi', s.zaczep.x === x2);
let rzucil = false;
try { s.updateAndDraw(atrapaCtx(), kontekst(klatka()), 1 / 60); } catch (e) { rzucil = e; }
spr('rysowanie (soczewka, tekstury, promienie) bez assetów i bez document nie rzuca', rzucil === false);

console.log('\nPRĄD NA KRĘGACH (reakcja Przewodzenie):');
{
    const g = new KregiMokoszy();
    spr('nieaktywne: geometria() null, naelektryzuj() false', g.geometria() === null && g.naelektryzuj() === false);
    g.zapal(1);
    przepusc(g, klatka(), 0.2);
    const geo = g.geometria();
    spr('geometria: środek na pasie, promień każdego żyjącego kręgu', !!geo && geo.cy === poziomWody(g.zaczep, H) && geo.promienie.length === g._kregi.length && geo.squash === NASTAWY.SQUASH);
    spr('naelektryzuj() -> true', g.naelektryzuj() === true && g._elektryzacja > 0);
    przepusc(g, klatka(), NASTAWY.ELEKTRYZACJA_S + 0.02);
    spr('elektryzacja gaśnie po ELEKTRYZACJA_S bez odświeżenia', g._elektryzacja === 0);
    const pp = punktyPradu(960, 600, 300, 0, 1);
    spr('prąd: poszarpana linia (więcej punktów niż próbek łuku)', pp.length > NASTAWY.PRAD_PROBEK + 1);
    spr('prąd leży przy elipsie kręgu (do 15% promienia)', pp.every(q => Math.abs(Math.hypot((q.x - 960) / 300, (q.y - 600) / (300 * NASTAWY.SQUASH)) - 1) < 0.15 / NASTAWY.SQUASH));
    const g2 = new KregiMokoszy();
    g2.zapal(1);
    przepusc(g2, klatka(), CZAS_TRWANIA - 0.2);   // emisja stoi od 4.5 s, ostatni krąg ginie ~6.1 s
    spr('trwają, ale bez żyjącego kręgu -> geometria() null', g2.aktywny && g2._kregi.length === 0 && g2.geometria() === null);
}

console.log('\nRYSOWANIE:');
{
    const ops = new Set(); let kreski = 0;
    const nic = () => {};
    const rejestrator = new Proxy({ canvas: { width: W, height: H } }, {
        get(cel, klucz) {
            if (klucz in cel) return cel[klucz];
            if (klucz === 'stroke') return () => { kreski++; };
            if (klucz === 'createRadialGradient' || klucz === 'createLinearGradient') return () => ({ addColorStop: nic });
            return nic;
        },
        set(cel, klucz, wartosc) { if (klucz === 'globalCompositeOperation') ops.add(wartosc); cel[klucz] = wartosc; return true; }
    });
    const kd = new KregiMokoszy();
    kd.zapal(1);
    for (let i = 0; i < 60; i++) {
        if (i % 10 === 0) kd.naelektryzuj();   // prąd na kręgach też się rysuje
        kd.updateAndDraw(rejestrator, kontekst(klatka()), 1 / 60);
    }
    spr('kręgi się rysują', kreski > 0);
    spr('świecą (\'lighter\') - eteryczna energia, nie woda', ops.has('lighter'));
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
