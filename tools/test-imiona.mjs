/**
 * Losowe szamańskie imię (przycisk 🎲).
 *   node tools/test-imiona.mjs
 */
import { IMIONA, losoweImie, wszystkieImiona } from '../js/imiona.js';
import { MAX_NICK } from '../js/tryby.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('WSZYSTKIE KOMBINACJE:');
{
    const wszystkie = wszystkieImiona();
    spr(`jest co losować (${wszystkie.length} imion)`, wszystkie.length >= 50);
    const za = wszystkie.filter(i => i.length > MAX_NICK);
    spr(`KAŻDE imię mieści się w ${MAX_NICK} znakach (za długie: ${za.join(', ') || 'brak'})`, za.length === 0);
    spr('imiona dwuczłonowe, bez podwójnych spacji', wszystkie.every(i => /^\S+ \S+$/.test(i)));
    spr('imiona unikalne', new Set(wszystkie).size === wszystkie.length);
}

console.log('\nZGODA RODZAJOWA:');
{
    spr('przymiotniki męskie kończą się na -y', IMIONA.meskie.przymiotniki.every(p => p.endsWith('y')));
    spr('przymiotniki żeńskie kończą się na -a', IMIONA.zenskie.przymiotniki.every(p => p.endsWith('a')));
    spr('listy liczą tyle samo przymiotników (żadna płeć nie ma mniej)', IMIONA.meskie.przymiotniki.length === IMIONA.zenskie.przymiotniki.length);
    const m = new Set(IMIONA.meskie.przymiotniki), z = new Set(IMIONA.zenskie.przymiotniki);
    spr('żadne imię nie łączy męskiego przymiotnika z żeńskim rzeczownikiem', wszystkieImiona().every(i => {
        const [p, r] = i.split(' ');
        return (m.has(p) && IMIONA.meskie.rzeczowniki.includes(r)) || (z.has(p) && IMIONA.zenskie.rzeczowniki.includes(r));
    }));
}

console.log('\nLOSOWANIE:');
{
    const najnizsza = losoweImie(() => 0), najwyzsza = losoweImie(() => 0.9999999);
    spr(`losowa=0 daje poprawne imię (${najnizsza})`, wszystkieImiona().includes(najnizsza));
    spr(`losowa≈1 daje poprawne imię (${najwyzsza})`, wszystkieImiona().includes(najwyzsza));
    spr('losowa=1 (granica) nie wychodzi poza listę', wszystkieImiona().includes(losoweImie(() => 1)));
    spr('losowa NaN/ujemna nie psuje', wszystkieImiona().includes(losoweImie(() => NaN)) && wszystkieImiona().includes(losoweImie(() => -3)));
    spr('losowa zwracająca śmieci nie psuje', wszystkieImiona().includes(losoweImie(() => 'x')) && wszystkieImiona().includes(losoweImie(() => undefined)));
    const widziane = new Set(); for (let i = 0; i < 400; i++) widziane.add(losoweImie());
    spr(`prawdziwe Math.random daje różnorodność (${widziane.size} różnych w 400 losowaniach)`, widziane.size > 15);
    spr('każde wylosowane imię mieści się w nicku', [...widziane].every(i => i.length <= MAX_NICK));
}

process.exit(ok ? 0 : 1);
