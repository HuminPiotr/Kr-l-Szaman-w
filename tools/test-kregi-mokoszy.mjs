/**
 * Kręgi Mokoszy - tafla wody po pas, kręgi rozchodzące się od ciała, krople;
 * bez document.
 *   node tools/test-kregi-mokoszy.mjs
 */
import { KregiMokoszy, obwiednia, poziomWody, stanKregu, punktyKregu, CZAS_TRWANIA, NASTAWY } from '../js/kregiMokoszy.js';
import { klatka, kontekst, przepusc, atrapaCtx, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const ZACZEP = { x: 960, y: 400, skala: 200 };

console.log('POZIOM WODY:');
spr('tafla na wysokości pasa (pod barkami)', poziomWody(ZACZEP, H) === 400 + 200 * NASTAWY.POZIOM_MNOZNIK);
spr('nigdy niżej niż dół kadru', poziomWody({ x: 960, y: 0.85 * H, skala: 200 }, H) <= H * NASTAWY.DOL_EKRANU + 1e-9);

console.log('\nKRĄG (stan w czasie):');
const s0 = stanKregu(0.01), s1 = stanKregu(NASTAWY.ZYCIE_KREGU * 0.5), s2 = stanKregu(NASTAWY.ZYCIE_KREGU * 0.99);
spr('krąg rośnie od ciała na zewnątrz', s0.promien < s1.promien && s1.promien < s2.promien);
spr('startuje blisko ciała, kończy daleko', s0.promien < NASTAWY.PROMIEN_OD + 0.1 && s2.promien > NASTAWY.PROMIEN_DO * 0.95);
spr('cienieje', s0.grubosc > s2.grubosc);
spr('blednie do zera na końcu życia', s2.alfa < 0.01 && s1.alfa > 0.2);
spr('przed narodzinami i po śmierci - null', stanKregu(-0.1) === null && stanKregu(NASTAWY.ZYCIE_KREGU) === null && stanKregu(NaN) === null);

console.log('\nPUNKTY KRĘGU:');
const pk = punktyKregu(960, 660, 300, 1.0, 7);
spr(`${NASTAWY.PUNKTOW_KREGU + 1} punktów (zamknięta elipsa)`, pk.length === NASTAWY.PUNKTOW_KREGU + 1 && Math.hypot(pk[0].x - pk[pk.length - 1].x, pk[0].y - pk[pk.length - 1].y) < 1e-6);
spr('część kręgu PRZED i część ZA graczem', pk.some(p => p.przod) && pk.some(p => !p.przod));
spr('płaska elipsa (spłaszczona w pionie)', Math.max(...pk.map(p => Math.abs(p.y - 660))) < 300 * NASTAWY.SQUASH * 1.2);
const odl = pk.map(p => Math.hypot((p.x - 960) / 300, (p.y - 660) / (300 * NASTAWY.SQUASH)));
spr('lekko faluje (nie idealna elipsa), ale blisko', Math.max(...odl) - Math.min(...odl) > 1e-3 && odl.every(d => Math.abs(d - 1) <= NASTAWY.FALOWANIE + 1e-9));

console.log('\nOBWIEDNIA I CYKL ŻYCIA:');
spr('obwiednia zero na końcach, NaN -> 0', obwiednia(0) === 0 && obwiednia(CZAS_TRWANIA) === 0 && obwiednia(NaN) === 0);
const k = new KregiMokoszy();
spr('bezczynne na starcie', k.aktywny === false);
k.zapal(1); k.zapal(1);
przepusc(k, klatka(), 1.0);
const ile = k._kregi.length;
spr(`kręgi rodzą się w odstępach (${ile} po 1 s)`, ile >= 2 && ile <= Math.ceil(1.0 / NASTAWY.ODSTEP_KREGOW) + 1);
spr('przy narodzinach kręgu tryskają krople', k._krople.length > 0);
const vyPrzed = k._krople.map(d => d.vy);
przepusc(k, klatka(), 0.1);
spr('krople spadają (grawitacja zwiększa vy)', k._krople.length === 0 || k._krople.some(d => d.vy > Math.min(...vyPrzed)));
przepusc(k, klatka(), NASTAWY.EMISJA_S);   // t ~ 5.6 s: emisja dawno stoi
const poEmisji = k._kregi.length;
przepusc(k, klatka(), 0.3);
spr('po EMISJA_S nowe kręgi już nie powstają', k._kregi.length <= poEmisji);
przepusc(k, klatka(), CZAS_TRWANIA);
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
spr('rysowanie bez assetów i bez document nie rzuca', rzucil === false);

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
    const kd = new KregiMokoszy();
    kd.zapal(1);
    for (let i = 0; i < 120; i++) kd.updateAndDraw(rejestrator, kontekst(klatka()), 1 / 60);
    spr('coś się rysuje (kręgi, krople)', kreski > 0);
    spr('bez blendowania addytywnego "lighter" (woda, nie energia)', !ops.has('lighter'));
    spr(`linie cienkie (maks. ${maxGrubosc} px <= 3)`, maxGrubosc <= 3);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
