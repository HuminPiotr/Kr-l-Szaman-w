/**
 * Trans - stopnie, mnożniki, łagodne gaśnięcie.
 *
 *   node tools/test-trans.mjs
 */
import { Trans, NASTAWY_TRANSU as N } from '../js/rytm/trans.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };
const DT = 1 / 30;
const tancz = (t, zgodnosc, sekund) => { for (let i = 0; i < sekund / DT; i++) t.update(zgodnosc, DT); return t; };

{
    const t = new Trans();
    spr('start: stopień 0, mnożniki 1', t.stopien === 0 && t.mnoznikMany === 1 && t.mnoznikTechniki === 1);
    tancz(t, 1, N.CZAS_STOPNIA_S[0] + 0.1);
    spr(`po ${N.CZAS_STOPNIA_S[0]} s w rytmie: stopień 1 (mana ×${t.mnoznikMany.toFixed(2)}, technika ×${t.mnoznikTechniki})`, t.stopien === 1 && t.mnoznikTechniki === 1.25);
    tancz(t, 1, N.CZAS_STOPNIA_S[1] + N.CZAS_STOPNIA_S[2]);
    spr(`dalej w rytmie: stopień 3 (mana ×${t.mnoznikMany.toFixed(2)}, technika ×${t.mnoznikTechniki})`, t.stopien === 3 && Math.abs(t.mnoznikMany - 1.6) < 1e-9 && t.mnoznikTechniki === 2);
    tancz(t, 1, 30);
    spr('nie rośnie ponad 3', t.poziom === 3);
    tancz(t, 0.3, 10);
    spr('strefa pośrednia trzyma stopień', t.stopien === 3);
    tancz(t, 0, 0.5);
    spr(`zgubiony rytm: po 0.5 s nadal blisko 3 (poziom ${t.poziom.toFixed(2)}) - gaśnie łagodnie, bez skoku`, t.poziom > 2.8);
    tancz(t, 0, N.GASNIECIE_S - 0.6);
    spr(`po ~${N.GASNIECIE_S} s od zgubienia rytmu jeden stopień niżej (${t.stopien})`, t.stopien === 2);
    spr('najwyższy stopień zapamiętany do Kroniki', t.najwyzszyStopien === 3);
    tancz(t, null, 20);
    spr('brak pieśni: gaśnie do zera, mnożnik 1 (nigdy poniżej)', t.poziom === 0 && t.mnoznikMany === 1);
}
{
    const t = new Trans();
    tancz(t, 1, N.CZAS_STOPNIA_S[0] * 0.5);
    spr(`efekt stopnia 1 wchodzi płynnie (siła ${t.sila(1).toFixed(2)} w połowie drogi)`, t.sila(1) > 0.4 && t.sila(1) < 0.6 && t.sila(2) === 0);
}
{
    const t = new Trans();
    t.update(NaN, DT); t.update(1, NaN); t.update(1, -1); t.update(Infinity, DT);
    spr('NaN / złe dt nie zatruwają', Number.isFinite(t.poziom) && t.poziom >= 0 && t.poziom <= 3);
}
process.exit(ok ? 0 : 1);
