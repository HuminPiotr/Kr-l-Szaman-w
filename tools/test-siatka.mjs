/**
 * Siatka uderzeń pieśni - faza w takcie i najbliższe uderzenie.
 *
 *   node tools/test-siatka.mjs
 */
import { SiatkaUderzen } from '../js/rytm/siatka.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };
const blisko = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

console.log('RÓWNA SIATKA:');
{
    const s = SiatkaUderzen.z({ bpm: 120, pierwszeUderzenieS: 0.3, uderzenia: null });
    spr('okres 0.5 s', blisko(s.okresS, 0.5));
    const f = s.faza(1.55);
    spr(`1.55 s -> uderzenie 2, faza 0.5 (${f.indeks}, ${f.faza01})`, f.indeks === 2 && blisko(f.faza01, 0.5));
    spr('przed pierwszym uderzeniem - indeks ujemny, faza poprawna', s.faza(0.05).indeks === -1 && blisko(s.faza(0.05).faza01, 0.5));
    spr('następne uderzenie z 1.55 -> 1.8', blisko(s.nastepneUderzenieS(1.55), 1.8));
}
console.log('\nLISTA UDERZEŃ:');
{
    const s = SiatkaUderzen.z({ bpm: 120, pierwszeUderzenieS: 0.3, uderzenia: [0.3, 0.8, 1.4, 1.9] });
    const f = s.faza(1.1);
    spr(`1.1 s -> uderzenie 1, faza 0.5 przy lokalnym okresie 0.6 (${f.indeks}, ${f.faza01.toFixed(3)}, ${f.okresS.toFixed(2)})`,
        f.indeks === 1 && blisko(f.faza01, 0.5) && blisko(f.okresS, 0.6));
    spr('za listą siatka przedłuża się średnim okresem', blisko(s.czasUderzenia(5), 2.9) && s.faza(2.5).indeks === 4 && s.faza(3.0).indeks === 5);
    spr('przed listą też', s.faza(0.0).indeks === -1);
}
console.log('\nWOLNE UDERZENIA (> 0.5 s):');
{
    const s = SiatkaUderzen.z({ bpm: 60, pierwszeUderzenieS: 0, uderzenia: null });
    spr('następne uderzenie za 0.9 s -> pół uderzenia (0.5)', blisko(s.nastepneUderzenieS(0.1), 0.5));
    spr('tuż po połowie, następne za 0.4 s -> uderzenie', blisko(s.nastepneUderzenieS(0.6), 1));
}
console.log('\nODPORNOŚĆ:');
spr('brak rytmu / złe bpm -> null', SiatkaUderzen.z(null) === null && SiatkaUderzen.z({ bpm: 0, pierwszeUderzenieS: 0 }) === null);
spr('NaN czasu -> null', SiatkaUderzen.z({ bpm: 120, pierwszeUderzenieS: 0 }).faza(NaN) === null);
process.exit(ok ? 0 : 1);
