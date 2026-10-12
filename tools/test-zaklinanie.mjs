/**
 * Zaklinanie - cykl stanu, podłoga, narastanie, koniec po ciszy/czasie/mocy, cichnięcie.
 *   node tools/test-zaklinanie.mjs
 * Miara i jakość są atrapami - tu testujemy wyłącznie stan (js/zaklinanie.js).
 */
import { Zaklinanie, NASTAWY as N } from '../js/zaklinanie.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 30;

/** Atrapa: jakość ustawiana z zewnątrz, miara liczy resety. */
function zrob() {
    const st = { q: 0, resety: 0 };
    const z = new Zaklinanie({
        miara: { update: () => ({ laczne: { x: 1 } }), reset: () => { st.resety++; } },
        jakosc: () => st.q
    });
    return { z, st };
}
const krec = (z, sek, moc = 1) => {
    let pobor = 0;
    for (let i = 0; i < Math.round(sek / DT); i++) pobor += z.update([], moc, DT);
    return pobor;
};

console.log('CYKL:');
{
    const { z, st } = zrob();
    spr('bezczynny: natężenie 0, pobór 0', z.update([], 1, DT) === 0 && z.natezenie === 0 && !z.aktywny);
    z.zapal();
    spr('zapal(): od razu mżawka (podłoga)', z.aktywny && z.natezenie >= N.PODLOGA);
    spr('zapal() z bezczynnego resetuje miarę', st.resety === 1);
    st.q = 1;
    krec(z, N.GLUCHE_S * 0.9);
    spr('w czasie głuchym jakość nie liczy się', z.jakosc === 0 && z.natezenie < 0.1);
    krec(z, 4);
    spr(`dobra fala -> ulewa po ~4 s (${z.natezenie.toFixed(2)})`, z.natezenie > 0.8);
    st.q = 0;
    krec(z, 1);
    spr(`chwila zawahania (1 s) nie zabiera ulewy (${z.natezenie.toFixed(2)})`, z.natezenie > 0.5 && z.zaklina);
    krec(z, N.CISZA_S + 0.2);
    spr('po CISZA_S bez fali -> cichnie, powód "cisza"', z.stan === 'CICHNIE' && z.powodKonca === 'cisza');
    const przed = z.natezenie;
    krec(z, N.CICHNIECIE_S / 2);
    spr('cichnięcie jest płynne (w połowie ~połowa)', z.natezenie > 0 && z.natezenie < przed * 0.7);
    krec(z, N.CICHNIECIE_S);
    spr('po cichnięciu bezczynny, natężenie 0', z.stan === 'BEZCZYNNY' && z.natezenie === 0);
}

console.log('\nPODŁOGA I GWARANCJA:');
{
    const { z } = zrob();
    z.zapal();
    krec(z, N.GWARANCJA_S - 0.1);
    spr('zły ruch: przez GWARANCJA_S dalej zaklina', z.zaklina);
    spr('zły ruch: natężenie nie spada pod podłogę', z.natezenie >= N.PODLOGA - 1e-9);
    krec(z, N.CISZA_S + 0.2);
    spr('zły ruch: kończy się po gwarancji + ciszy', z.stan === 'CICHNIE');
}

console.log('\nSUFIT CZASU, MOC, RESTART:');
{
    const { z, st } = zrob();
    z.zapal(); st.q = 1;
    krec(z, N.MAX_S + 0.1);
    spr('dobra fala bez końca -> sufit MAX_S, powód "czas"', z.stan === 'CICHNIE' && z.powodKonca === 'czas');
    z.zapal();
    spr('zapal() w trakcie cichnięcia wraca do zaklinania bez resetu miary', z.zaklina && st.resety === 1);
}
{
    const { z, st } = zrob();
    z.zapal(); st.q = 1;
    let moc = 0.01;
    for (let i = 0; i < 300 && z.zaklina; i++) moc -= z.update([], moc, DT);
    spr('pobór nie przekracza mocy (moc nie spada pod 0)', moc >= -1e-12);
    spr('brak mocy -> cichnie, powód "moc"', z.stan === 'CICHNIE' && z.powodKonca === 'moc');
}
{
    const { z, st } = zrob();
    z.zapal(); st.q = 1;
    const p = krec(z, 5);
    spr(`pobór 5 s ulewy jest mały (${p.toFixed(3)} paska)`, p > 0 && p < 0.15);
    z.zapal();
    spr('restart w trakcie zaklinania zeruje licznik sufitu', z._t === 0 && z.natezenie > 0.5);
    const nieogr = krec(z, 1, undefined);
    spr('moc nieokreślona (stanowisko VFX) = bez limitu, nie koniec', z.zaklina && nieogr > 0);
}

console.log('\nODPORNOŚĆ:');
{
    const { z, st } = zrob();
    z.zapal(); st.q = NaN;
    const p = z.update(null, NaN, NaN);
    spr('NaN wszędzie: pobór 0, natężenie skończone', p === 0 && Number.isFinite(z.natezenie));
    const zl = new Zaklinanie({ miara: { update: () => { throw new Error('x'); } }, jakosc: () => { throw new Error('y'); } });
    zl.zapal();
    let rzucil = false;
    try { for (let i = 0; i < 60; i++) zl.update([], 1, DT); } catch { rzucil = true; }
    spr('wyjątek w mierze/jakości nie wywraca gry', !rzucil && zl.natezenie >= N.PODLOGA - 1e-9);
    const bez = new Zaklinanie();
    bez.zapal();
    spr('bez miary i jakości: mżawka, bez wyjątku', bez.update([], 1, DT) >= 0 && bez.natezenie >= N.PODLOGA - 1e-9);
    st.q = 5;
    krec(z, 6);
    spr('jakość > 1 przycięta - natężenie <= 1', z.natezenie <= 1);
}

process.exit(ok ? 0 : 1);
