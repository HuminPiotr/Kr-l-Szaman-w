/**
 * Fala Mokoszy - okno zamachów w górę, głuchy czas, limit 4, strona = strona ręki,
 * samoczynna fala, profil i przejazd; bez document.
 *   node tools/test-falaMokoszy.mjs
 */
import { FalaMokoszy, NASTAWY, czoloFali, wysokoscFali, obwiedniaFali, profilFali, powierzchnia, wysokoscGejzeru, poziomWody, kolumnyWody, srodekGejzeru } from '../js/falaMokoszy.js';
import { KOLUMN } from '../js/wodaShader.js';
import { klatka, kontekst, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;
const SKALA = 0.1 * W;
const ZACZEP = { x: 960, y: 430, skala: 190 };

/** Klatka z nadgarstkami: lewy w x=0.4, prawy w x=0.6 (w obrazie), wysokości yL, yP. */
const zRekami = (yL, yP) => {
    const f = klatka();
    f.pose.landmarks[15] = { x: 0.4, y: yL };
    f.pose.landmarks[16] = { x: 0.6, y: yP };
    return f;
};
/** Zamach ręką `reka` od bioder w górę przez 0.15 s, potem ręka opada i stoi `odpoczynek` s. */
function zamach(f, reka, odpoczynek = 0) {
    let y = 0.75;
    for (let i = 0; i < Math.round(0.15 / DT); i++) {
        y -= 8 * SKALA * DT / H;
        f.updateAndDraw(null, kontekst(reka === 'L' ? zRekami(y, 0.75) : zRekami(0.75, y)), DT);
    }
    stoj(f, odpoczynek);
}
const stoj = (f, sek) => { for (let i = 0; i < Math.round(sek / DT); i++) f.updateAndDraw(null, kontekst(zRekami(0.75, 0.75)), DT); };

console.log('CZYSTE FUNKCJE:');
spr('fala z prawej startuje przy prawej krawędzi i kończy za lewą',
    czoloFali(0, 1, W, 190) > W * 0.8 && czoloFali(NASTAWY.CZAS_PRZEJAZDU, 1, W, 190) < 0);
spr('fala z lewej - odwrotnie', czoloFali(0, -1, W, 190) < W * 0.2 && czoloFali(NASTAWY.CZAS_PRZEJAZDU, -1, W, 190) > W);
spr('wysokość: 0 na końcach, NaN -> 0, wzbiera', wysokoscFali(0) === 0 && wysokoscFali(NASTAWY.ZYCIE_FALI) === 0
    && wysokoscFali(NaN) === 0 && wysokoscFali(NASTAWY.NAROST) > 0.9);
spr('fala się łamie: pod koniec przejazdu niższa niż na początku',
    wysokoscFali(NASTAWY.CZAS_PRZEJAZDU) < wysokoscFali(NASTAWY.NAROST) * 0.6);
spr('obwiednia zero na końcach', obwiedniaFali(0) === 0 && obwiedniaFali(NASTAWY.ZYCIE_FALI) === 0 && obwiedniaFali(0.5) === 1);
spr('profil: przed czołem nic, szczyt 1, długi zanik', profilFali(-0.1) === 0 && Math.abs(profilFali(NASTAWY.WZNIOS) - 1) < 1e-9
    && profilFali(NASTAWY.WZNIOS + 1) > 0.5 && profilFali(NASTAWY.WZNIOS + 1) < 1);
{
    const pow = powierzchnia({ strona: 1, wiek: 0.5, faza: 0 }, ZACZEP, W, H);
    spr('szczyt fali nad linią barków (sięga do piersi i wyżej)', pow && pow.szczyt.y < ZACZEP.y);
    spr('fala z prawej płynie w lewo (kier -1), węzły od prawej krawędzi', pow.kier === -1 && pow.pkt[0].x > W);
    spr('powierzchnia skończona', pow.pkt.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    spr('przed narodzinami - brak powierzchni', powierzchnia({ strona: 1, wiek: 0, faza: 0 }, ZACZEP, W, H) === null);
}

console.log('\nGEJZER:');
spr('gejzer: 0 na starcie, pełny po narastaniu, opada do reszty, NaN -> 0',
    wysokoscGejzeru(0) === 0 && wysokoscGejzeru(NASTAWY.GEJZER_NAROST) === 1
    && Math.abs(wysokoscGejzeru(NASTAWY.GEJZER_OPADA_DO) - NASTAWY.GEJZER_RESZTA) < 1e-9 && wysokoscGejzeru(NaN) === 0);
{
    const f = { strona: 1, wiek: NASTAWY.GEJZER_NAROST, faza: 0 };
    const xg = srodekGejzeru(f, W, ZACZEP.skala);
    const slup = poziomWody(f, xg, ZACZEP, W, H);
    spr(`słup gejzeru sięga nad głowę (${Math.round(slup.y)} px < barki ${ZACZEP.y})`, slup.y < ZACZEP.y - ZACZEP.skala * 0.8);
    spr('słup widać w kadrze przy krawędzi źródłowej', xg > W * 0.75 && xg < W);
    const pozniej = poziomWody({ ...f, wiek: NASTAWY.GEJZER_OPADA_DO }, srodekGejzeru({ ...f, wiek: NASTAWY.GEJZER_OPADA_DO }, W, ZACZEP.skala), ZACZEP, W, H);
    spr('po opadnięciu słupa woda niższa niż w wystrzale', pozniej.y > slup.y);
    // Bez wcięcia: od szczytu w stronę źródła powierzchnia tylko opada (y rośnie).
    let ciagla = true, prev = -Infinity;
    for (let x = xg; x <= W; x += 10) { const y = poziomWody(f, x, ZACZEP, W, H).y; if (y < prev - 2) ciagla = false; prev = y; }
    spr('słup przechodzi w falę bez wcięcia (monotonnie od szczytu do krawędzi)', ciagla);
}
{
    const kol = kolumnyWody([{ strona: 1, wiek: 0.5, faza: 0 }], ZACZEP, W, H, 1);
    spr(`kolumny dla shadera: ${KOLUMN} × vec4`, kol.length === KOLUMN * 4 && [...kol].every(Number.isFinite));
    spr('fala z prawej: woda po prawej, pusto po lewej', kol[(KOLUMN - 1) * 4 + 2] > 0 && kol[2] === 0 && kol[0] > 1);
    spr('bez fal - same zera alfy', kolumnyWody([], ZACZEP, W, H).every((v, i) => i % 4 !== 2 || v === 0));
}

console.log('\nOKNO I ZAMACHY:');
{
    const f = new FalaMokoszy();
    spr('bezczynna na starcie', !f.aktywny);
    f.zapal(0);
    spr('zapal(0) nic nie robi', !f.aktywny);
    f.zapal(1);
    spr('zapal() otwiera okno', f.aktywny && f.okno);
    zamach(f, 'P');
    spr('zamach w głuchym czasie - bez fali', f._fale.length === 0);
    stoj(f, 0.3);
    zamach(f, 'P');
    spr(`zamach PRAWĄ (prawa strona obrazu) -> fala z prawej (${f._fale.map(x => x.strona)})`, f._fale.length === 1 && f._fale[0].strona === 1);
    zamach(f, 'L');
    spr(`zamach LEWĄ -> fala z lewej (${f._fale.map(x => x.strona)})`, f._fale.length === 2 && f._fale[1].strona === -1);
}
{
    const f = new FalaMokoszy();
    f.zapal(1);
    stoj(f, NASTAWY.GLUCHE_S + 0.05);
    // Na zmianę, bez czekania - szybki gracz: 6 zamachów po 0.15 s mieści się w oknie.
    for (let i = 0; i < 6; i++) zamach(f, i % 2 ? 'L' : 'P');
    spr(`najwyżej ${NASTAWY.MAX_FAL} fale w oknie (${f._wypuszczone})`, f._wypuszczone === NASTAWY.MAX_FAL);
    stoj(f, NASTAWY.OKNO_S);
    spr('po oknie - bez samoczynnej fali, bo gracz machał', f._wypuszczone === NASTAWY.MAX_FAL && !f.okno);
}
{
    const f = new FalaMokoszy();
    f.zapal(1);
    stoj(f, NASTAWY.GLUCHE_S + 0.05);
    // Jedna ręka: zamach + opadnięcie (przerwa ręki) - wolniejszy gracz nie zdąży z czterema.
    for (let i = 0; i < 6; i++) zamach(f, 'P', 0.4);
    spr(`jedną ręką z przerwami - mniej niż ${NASTAWY.MAX_FAL} (${f._wypuszczone})`, f._wypuszczone > 0 && f._wypuszczone < NASTAWY.MAX_FAL);
}

console.log('\nSAMOCZYNNA FALA:');
{
    const f = new FalaMokoszy();
    f.zapal(1);
    stoj(f, NASTAWY.OKNO_S + 0.05);
    spr('nikt nie machnął -> po oknie dokładnie jedna fala', f._wypuszczone === 1 && f._fale.length === 1 && !f.okno);
    const pierwsza = f._fale[0].strona;
    const g = new FalaMokoszy();
    g.zapal(1);
    stoj(g, NASTAWY.OKNO_S + 0.05);
    spr('kolejna samoczynna - z drugiej strony', g._fale[0].strona === -pierwsza);
}

console.log('\nŻYCIE I RYSOWANIE:');
{
    const f = new FalaMokoszy();
    f.zapal(1);
    stoj(f, NASTAWY.OKNO_S + 0.05);
    let rzucil = false;
    try {
        const ctx = atrapaCtx();
        for (let i = 0; i < 30; i++) f.updateAndDraw(ctx, kontekst(zRekami(0.75, 0.75)), DT);
    } catch (e) { rzucil = e; }
    spr(`rysowanie na atrapie bez wyjątku ${rzucil ? rzucil.message : ''}`, !rzucil);
    stoj(f, NASTAWY.CZAS_PRZEJAZDU);
    spr('fala minęła tancerza -> rozprysk kropli', f._fale[0]?.rozbita === true);
    stoj(f, NASTAWY.ZYCIE_FALI + NASTAWY.ZYCIE_KROPLI);
    spr('po życiu fali i kropli - nieaktywna', !f.aktywny);
}
{
    const f = new FalaMokoszy();
    f.zapal(1);
    let rzucil = false;
    try {
        for (let i = 0; i < 200; i++) f.updateAndDraw(atrapaCtx(), kontekst(klatka({ barki: null })), DT);
        f.updateAndDraw(null, null, NaN);
    } catch (e) { rzucil = e; }
    spr('bez pozy / null / NaN - bez wyjątku, fala i tak rusza', !rzucil && f._wypuszczone === 1);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
