/**
 * js/warstwaZaSylwetka.js - kolejność operacji na atrapie DOM.
 *   node tools/test-warstwa-za-sylwetka.mjs
 */
let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const { WarstwaZaSylwetka } = await import('../js/warstwaZaSylwetka.js');
spr('bez document zacznij() zwraca null (Node, testy technik)', new WarstwaZaSylwetka().zacznij(100, 50) === null);

const dziennik = [];
function atrapaCtx(nazwa) {
    const c = { globalCompositeOperation: 'source-over', globalAlpha: 1 };
    for (const m of ['clearRect', 'save', 'restore', 'setTransform', 'putImageData', 'drawImage'])
        c[m] = () => dziennik.push(`${nazwa}.${m}:${m === 'drawImage' ? c.globalCompositeOperation : ''}`);
    c.createImageData = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return c;
}
let licznik = 0;
globalThis.document = {
    createElement() {
        const p = { width: 1, height: 1 };
        const nazwa = `p${licznik++}`;
        p.getContext = () => (p._c ??= atrapaCtx(nazwa));
        return p;
    }
};
const ekranCtx = atrapaCtx('ekran');

console.log('Z MASKĄ:');
{
    const w = new WarstwaZaSylwetka();
    const warstwa = w.zacznij(100, 50);
    spr('zacznij() zwraca kontekst warstwy', !!warstwa);
    dziennik.length = 0;
    w.zakoncz(ekranCtx, new Uint8Array(4 * 2), 4, 2, { offsetX: 0, offsetY: 0, scaledW: 100, scaledH: 50 });
    const wyciecie = dziennik.findIndex(z => z.endsWith('drawImage:destination-out'));
    const nalozenie = dziennik.findIndex(z => z.startsWith('ekran.drawImage'));
    spr('sylwetka wycięta z warstwy (destination-out)', wyciecie >= 0);
    spr('...ZANIM warstwa trafi na ekran', nalozenie > wyciecie);
}
console.log('\nBEZ MASKI:');
{
    const w = new WarstwaZaSylwetka();
    w.zacznij(100, 50);
    dziennik.length = 0;
    w.zakoncz(ekranCtx, null, 0, 0, null);
    spr('bez maski nic nie jest wycinane', !dziennik.some(z => z.endsWith('destination-out')));
    spr('...a warstwa i tak trafia na ekran', dziennik.some(z => z.startsWith('ekran.drawImage')));
    let rzucil = false;
    try { w.zakoncz(null, null, 0, 0, null); new WarstwaZaSylwetka().zakoncz(ekranCtx, null, 0, 0, null); } catch { rzucil = true; }
    spr('ctx null / zakoncz bez zacznij - bez wyjątku', !rzucil);
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
