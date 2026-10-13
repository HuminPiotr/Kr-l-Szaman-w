/**
 * Kruki - zaczep namiotu palców (nadgarstki pozy / fallback), kruk na ekran rośnie
 * do zasłonięcia kadru, stado wylatuje, cień, wygasanie; bez document.
 *   node tools/test-kruki.mjs
 */
import { Kruki, NASTAWY, zaczepIglicy, postepNaEkran, rozpietoscNaEkran, obwiedniaCienia } from '../js/kruki.js';
import { klatka, kontekst, przepusc, atrapaCtx, W, H } from './_klatka-techniki.mjs';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60;

/** Klatka z nadgarstkami (znorm.) - domyślnie nad głową, jak w Iglicy. */
const zRekami = (l = [0.48, 0.15], p = [0.52, 0.15]) => {
    const f = klatka();
    f.pose.landmarks[15] = { x: l[0], y: l[1] };
    f.pose.landmarks[16] = { x: p[0], y: p[1] };
    return f;
};

console.log('ZACZEP IGLICY:');
{
    const z = zaczepIglicy(zRekami(), W, H);
    spr('ręce nad głową -> środek nadgarstków', Math.abs(z.x - 0.5 * W) < 1 && Math.abs(z.y - 0.15 * H) < 1);
    const n = zaczepIglicy(zRekami([0.4, 0.7], [0.6, 0.7]), W, H);
    spr('ręce opuszczone -> fallback nad głową (nad barkami)', n.y < 0.4 * H && Math.abs(n.x - 0.5 * W) < 1);
    const f = zRekami(); f.pose.landmarks[16].visibility = 0.1;
    spr('nadgarstek zgadywany (niska widoczność) -> fallback', Math.abs(zaczepIglicy(f, W, H).y - n.y) < 1);
    spr('bez pozy -> null', zaczepIglicy(klatka({ barki: null }), W, H) === null && zaczepIglicy(null, W, H) === null);
}

console.log('\nCZYSTE FUNKCJE:');
spr('postęp na ekran 0 -> 1, przyspiesza', postepNaEkran(0) === 0 && postepNaEkran(NASTAWY.EKRAN_CZAS) === 1
    && postepNaEkran(NASTAWY.EKRAN_CZAS / 2) < 0.5);
spr('kruk na ekran rośnie od małego do szerszego niż kadr',
    rozpietoscNaEkran(0, 190, W) < 100 && rozpietoscNaEkran(NASTAWY.EKRAN_CZAS, 190, W) >= W);
spr('cień: zero na końcach, NaN -> 0', obwiedniaCienia(0) === 0 && obwiedniaCienia(NASTAWY.CIEN_ZYCIE) === 0
    && obwiedniaCienia(NaN) === 0 && obwiedniaCienia(1) > 0.5);

console.log('\nPRZEBIEG:');
{
    const k = new Kruki();
    spr('bezczynne na starcie', !k.aktywny);
    k.zapal(0);
    spr('zapal(0) nic nie robi', !k.aktywny);
    k.zapal(1, { x: 900, y: 150 });
    spr('zapal() aktywuje', k.aktywny);
    przepusc(k, zRekami(), NASTAWY.STADO_DO + 0.1);
    spr(`całe stado wyleciało (${k._stado.filter(x => x.wylecial).length})`, k._stado.length > 0 && k._stado.every(x => x.wylecial));
    spr('kruki gubią pióra', k._piora.length > 0);
    spr('kruk na ekran wystartował z namiotu palców', k._naEkran && k._naEkran.x0 === 900 && k._naEkran.y0 === 150);
    const yStada = k._stado.map(x => x.y);
    przepusc(k, zRekami(), 0.3);
    spr('stado leci w górę', k._stado.every((x, i) => x.y < yStada[i] || !Number.isFinite(yStada[i])));
    przepusc(k, zRekami(), NASTAWY.EKRAN_CZAS);
    spr('kruk na ekran zasłonił kadr i rozsypał się w pióra', k._naEkran?.rozbity === true && k._piora.length >= NASTAWY.EKRAN_PIOR);
    przepusc(k, zRekami(), NASTAWY.CIEN_ZYCIE + NASTAWY.ZYCIE_PIORA + 1);
    spr('po wszystkim - nieaktywne, czysto', !k.aktywny && k._naEkran === null);
}
{
    const k = new Kruki();
    k.zapal(1, null);
    przepusc(k, zRekami([0.4, 0.7], [0.6, 0.7]), NASTAWY.EKRAN_START + 0.05);
    spr('bez zaczepu z combo -> kruk na ekran z punktu nad głową', k._naEkran && k._naEkran.y0 < 0.4 * H);
}
{
    const k = new Kruki();
    k.zapal(1, { x: NaN, y: 5 });
    let rzucil = false;
    try {
        const ctx = atrapaCtx();
        for (let i = 0; i < 300; i++) k.updateAndDraw(ctx, kontekst(i % 3 ? zRekami() : klatka({ barki: null })), DT);
        k.updateAndDraw(ctx, null, NaN);
    } catch (e) { rzucil = e; }
    spr(`rysowanie na atrapie, brak pozy, NaN - bez wyjątku ${rzucil ? rzucil.message : ''}`, !rzucil);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
