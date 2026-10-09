/**
 * Detektor machnięć (nadgarstki pozy) - kierunek, próg, przerwa ręki, artefakty.
 *   node tools/test-machniecie.mjs
 */
import { DetektorMachniec, NASTAWY } from '../js/machniecie.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const W = 1920, H = 1080, DT = 1 / 60;
const SKALA = 0.1 * W;   // barki 0.45..0.55

/** Klatka z nadgarstkami (współrzędne znormalizowane); null = ręki nie widać. */
function klatka(lewy, prawy, { poza = true } = {}) {
    if (!poza) return { hands: [], pose: null };
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
    lm[12] = { x: 0.45, y: 0.4 }; lm[11] = { x: 0.55, y: 0.4 };
    lm[15] = lewy ? { x: lewy[0], y: lewy[1] } : { x: NaN, y: NaN };
    lm[16] = prawy ? { x: prawy[0], y: prawy[1] } : { x: NaN, y: NaN };
    return { hands: [], pose: { landmarks: lm } };
}

/** Ruch ręki w poziomie z prędkością v (szer. barków/s) przez `sek`; zwraca zdarzenia. */
function machnij(d, reka, v, sek, start = 0.5, druga = [0.6, 0.6]) {
    const zd = [];
    let x = start;
    for (let i = 0; i < Math.round(sek / DT); i++) {
        x += v * SKALA * DT / W;
        const f = reka === 'L' ? klatka([x, 0.6], druga) : klatka(druga, [x, 0.6]);
        zd.push(...d.update(f, W, H, DT));
    }
    return { zd, x };
}
const stoj = (d, sek) => { for (let i = 0; i < Math.round(sek / DT); i++) d.update(klatka([0.4, 0.6], [0.6, 0.6]), W, H, DT); };

console.log('KIERUNEK I PRÓG:');
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const { zd } = machnij(d, 'P', 8, 0.2, 0.6, [0.4, 0.6]);
    spr(`szybko w prawo -> jedno zdarzenie +1 (${zd.map(z => z.kierunek)})`, zd.length === 1 && zd[0].kierunek === 1 && zd[0].reka === 'P');
    spr('zdarzenie ma pozycję w px', Number.isFinite(zd[0]?.x) && zd[0].x > 1);
}
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const { zd } = machnij(d, 'L', -8, 0.2, 0.4);
    spr('szybko w lewo -> -1', zd.length === 1 && zd[0].kierunek === -1 && zd[0].reka === 'L');
}
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const { zd } = machnij(d, 'P', NASTAWY.PROG_PREDKOSCI * 0.6, 1, 0.5, [0.4, 0.6]);
    spr('wolny ruch (taniec) -> nic', zd.length === 0);
    spr('diagnostyka widzi prędkość', d.diagnostyka.predkosc > 0 && d.diagnostyka.prog === NASTAWY.PROG_PREDKOSCI);
}
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const zd = [];
    let y = 0.3;
    for (let i = 0; i < 12; i++) { y += 8 * SKALA * DT / H; zd.push(...d.update(klatka([0.4, 0.6], [0.6, y]), W, H, DT)); }
    spr('szybki ruch PIONOWY -> nic', zd.length === 0);
}

console.log('\nPRZERWA RĘKI:');
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const tam = machnij(d, 'P', 8, 0.2, 0.5, [0.4, 0.6]);
    const powrot = machnij(d, 'P', -8, 0.12, tam.x, [0.4, 0.6]);
    spr(`szybki powrót w przerwie ignorowany (${tam.zd.length}+${powrot.zd.length})`, tam.zd.length === 1 && powrot.zd.length === 0);
}
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    // L w prawo, P w lewo, L w lewo - każda ruchem 0.15 s; ta sama ręka wraca po > 0.35 s.
    const zd = [];
    let L = 0.4, P = 0.6;
    const krok = (reka, v, sek) => {
        for (let i = 0; i < Math.round(sek / DT); i++) {
            if (reka === 'L') L += v * SKALA * DT / W; else P += v * SKALA * DT / W;
            zd.push(...d.update(klatka([L, 0.6], [P, 0.6]), W, H, DT));
        }
    };
    krok('L', 8, 0.15); krok('P', -8, 0.15); krok('L', 0, 0.1); krok('L', -8, 0.15);
    spr(`lewa, prawa, lewa -> 3 zdarzenia (${zd.map(z => z.reka + z.kierunek).join(' ')})`,
        zd.length === 3 && zd[0].reka === 'L' && zd[1].reka === 'P' && zd[2].reka === 'L' && zd[2].kierunek === -1);
}

console.log('\nARTEFAKTY I ODPORNOŚĆ:');
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const zd = [...d.update(klatka([0.4, 0.6], [0.9, 0.6]), W, H, DT)];   // jeden skok
    for (let i = 0; i < 10; i++) zd.push(...d.update(klatka([0.4, 0.6], [0.9, 0.6]), W, H, DT));   // potem stoi
    spr('pojedynczy skok pozycji -> nic (potwierdzenie)', zd.length === 0);
}
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    let rzucil = false, zd = [];
    try {
        zd.push(...d.update(klatka(null, null, { poza: false }), W, H, DT));
        zd.push(...d.update(klatka(null, null), W, H, DT));
        zd.push(...d.update(null, W, H, NaN));
        zd.push(...d.update(klatka([0.4, 0.6], [0.6, 0.6]), NaN, H, DT));
        zd.push(...d.update(klatka([0.4, 0.6], [0.95, 0.6]), W, H, DT));   // wraca daleko - bez zgadywanego skoku
        zd.push(...d.update(klatka([0.4, 0.6], [0.95, 0.6]), W, H, DT));
    } catch { rzucil = true; }
    spr('brak pozy / NaN / powrót ręki po zniknięciu - bez wyjątku i bez zdarzeń', !rzucil && zd.length === 0);
}
{
    const d = new DetektorMachniec(); stoj(d, 0.2);
    const f = klatka([0.4, 0.6], [0.6, 0.6]);
    const zd = [];
    let x = 0.6;
    for (let i = 0; i < 12; i++) {
        x += 8 * SKALA * DT / W;
        const fr = klatka([0.4, 0.6], [x, 0.6]);
        fr.pose.landmarks[16].visibility = 0.1;
        zd.push(...d.update(fr, W, H, DT));
    }
    spr('nadgarstek z niską widocznością (zgadywany) -> nic', zd.length === 0 && !!f);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
