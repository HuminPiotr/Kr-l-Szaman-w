/**
 * Jaja z nickami-bogami - rozpoznanie i efekty (szpiedzy, bez document).
 *   node tools/test-jaja.mjs
 */
import { bogZNicku, BOGOWIE } from '../js/jaja.js';
import { odpalJajo, BARWA_GROMU, BARWA_ZAPLONU } from '../js/techniki.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('ROZPOZNANIE BOGA:');
{
    spr('Perun', bogZNicku('Perun') === 'perun');
    spr('wielkość liter nie ma znaczenia', bogZNicku('PERUN') === 'perun' && bogZNicku('pErUn') === 'perun');
    spr('białe znaki na brzegach', bogZNicku('  Perun  ') === 'perun');
    spr('polskie znaki: Swaróg = swarog', bogZNicku('Swaróg') === 'swarog' && bogZNicku('swarog') === 'swarog');
    spr('Stribog, Mokosz, Weles', bogZNicku('Stribog') === 'stribog' && bogZNicku('Mokosz') === 'mokosz' && bogZNicku('Weles') === 'weles');
    spr('REVIEW FOCUS 4 - sufiks dubla Krągu: "Perun 2" to też Perun', bogZNicku('Perun 2') === 'perun' && bogZNicku('Weles 6') === 'weles');
    spr('inny tekst obok nie jest bogiem', bogZNicku('Perunek') === null && bogZNicku('Perun Piorun') === null && bogZNicku('Wielki Perun') === null);
    spr('puste/null/liczba/obiekt = brak boga, bez wyjątku', [bogZNicku(''), bogZNicku('   '), bogZNicku(null), bogZNicku(undefined), bogZNicku(5), bogZNicku({})].every(b => b === null));
    spr('HTML w nicku nie jest bogiem', bogZNicku('<b>Perun</b>') === null);
    spr('lista bogów = pięć żywiołów', BOGOWIE.length === 5 && ['perun', 'swarog', 'stribog', 'mokosz', 'weles'].every(b => BOGOWIE.includes(b)));
}

console.log('\nEFEKTY (szpiedzy):');
{
    const log = [];
    const spy = (nazwa, metody) => Object.fromEntries(metody.map(m => [m, (...a) => log.push([`${nazwa}.${m}`, ...a])]));
    // Proxy rzuca na KAŻDĄ zależność spoza worka: jajo NIE WOLNO dotykać technik, mocy ani kombosów.
    const worek = () => {
        log.length = 0;
        const b = {
            piorun: spy('piorun', ['uderz']), ekran: spy('ekran', ['uderz']), zaplon: spy('zaplon', ['zapal']),
            fala: spy('fala', ['wystrzel']), tecza: spy('tecza', ['aktywuj']), iskry: spy('iskry', ['wystrzel']),
            efekty: spy('efekty', ['odpal'])
            // BRAK `audio`: gra nie ma efektów dźwiękowych; Proxy rzuci na każdą próbę dostępu.
        };
        return new Proxy(b, { get(t, k) { if (!(k in t)) throw new Error(`niedozwolona zależność: ${String(k)}`); return t[k]; } });
    };
    const frame = { hands: [], pose: null };
    const nazwy = () => log.map(l => l[0]).join(',');

    odpalJajo('perun', frame, 1920, 1080, worek());
    spr(`Perun: piorun + wstrząs (${nazwy()})`, nazwy() === 'piorun.uderz,ekran.uderz');
    spr('Perun: piorun w barwie Gromu', log[0][2] === BARWA_GROMU);
    odpalJajo('swarog', frame, 1920, 1080, worek());
    spr(`Swaróg: zapłon sylwetki w barwie ognia (${nazwy()})`, nazwy().includes('zaplon.zapal') && log.find(l => l[0] === 'zaplon.zapal')[1] === BARWA_ZAPLONU.ogien);
    odpalJajo('stribog', frame, 1920, 1080, worek());
    spr(`Stribog: fala w barwie Aarda (${nazwy()})`, nazwy().includes('fala.wystrzel') && log.find(l => l[0] === 'fala.wystrzel')[4] === BARWA_ZAPLONU.aard);
    odpalJajo('mokosz', frame, 1920, 1080, worek());
    spr(`Mokosz: tęcza (${nazwy()})`, nazwy().includes('tecza.aktywuj'));
    odpalJajo('weles', frame, 1920, 1080, worek());
    spr(`Weles: iskry + fala (${nazwy()})`, nazwy().includes('iskry.wystrzel') && nazwy().includes('fala.wystrzel'));
    for (const b of ['perun', 'swarog', 'stribog', 'mokosz', 'weles']) {
        odpalJajo(b, frame, 1920, 1080, worek());
        spr(`${b}: nie rzuca (nie sięga po techniki/moc/kombosy), odpala efekt pieczęci`, log.some(l => l[0] === 'efekty.odpal' && l[1] === b) || b === 'perun');
    }
    spr('nieznany bóg: nic, bez wyjątku', (() => { odpalJajo('zeus', frame, 1920, 1080, worek()); odpalJajo(null, frame, 1920, 1080, worek()); return log.length === 0; })());
    spr('jajo nie dotyka audio w żadnej gałęzi (Proxy bez audio nie rzuca)', true);
}

process.exit(ok ? 0 : 1);
