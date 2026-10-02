/**
 * Kręgi Mokoszy v2 - fala uderzeniowa: świetliste kręgi co ~1 s, soczewka
 * zniekształcająca obraz pod kręgiem, rozbłysk przy narodzinach; bez document.
 *   node tools/test-kregi-mokoszy.mjs
 */
import { KregiMokoszy, obwiednia, poziomWody, stanKregu, stanBlysku, punktyKregu, prostokatSoczewki,
         CZAS_TRWANIA, NASTAWY } from '../js/kregiMokoszy.js';
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

console.log('\nROZBŁYSK PRZY NARODZINACH:');
spr('krótki: pełny na starcie, znika po BLYSK_ZYCIE', stanBlysku(0.001).alfa > 0.9 && stanBlysku(NASTAWY.BLYSK_ZYCIE) === null);

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
let urodzone = 0, poprzednio = 0, maksBlyskow = 0;
for (let i = 0; i < Math.round(CZAS_TRWANIA * 60); i++) {
    k.updateAndDraw(null, kontekst(klatka()), 1 / 60);
    if (k._urodzone > poprzednio) { urodzone += k._urodzone - poprzednio; poprzednio = k._urodzone; }
    maksBlyskow = Math.max(maksBlyskow, k._blyski.length);
}
spr(`kręgi co ~${NASTAWY.ODSTEP_KREGOW} s przez ${NASTAWY.EMISJA_S} s (urodzone: ${urodzone})`, urodzone === Math.ceil(NASTAWY.EMISJA_S / NASTAWY.ODSTEP_KREGOW));
spr('każdy krąg ma rozbłysk przy narodzinach (krótki, nie kumulują się)', maksBlyskow >= 1 && maksBlyskow <= 2);
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
spr('rysowanie (z soczewką) bez assetów i bez document nie rzuca', rzucil === false);

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
    for (let i = 0; i < 60; i++) kd.updateAndDraw(rejestrator, kontekst(klatka()), 1 / 60);
    spr('kręgi się rysują', kreski > 0);
    spr('świecą (\'lighter\') - eteryczna energia, nie woda', ops.has('lighter'));
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
