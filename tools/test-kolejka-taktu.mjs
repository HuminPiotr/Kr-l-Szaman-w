/**
 * Kolejka taktu - technika w transie startuje na najbliższe uderzenie.
 *
 *   node tools/test-kolejka-taktu.mjs
 */
import { KolejkaTaktu } from '../js/rytm/kolejkaTaktu.js';
import { SiatkaUderzen } from '../js/rytm/siatka.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const siatka = SiatkaUderzen.z({ bpm: 131.31, pierwszeUderzenieS: 0.3, uderzenia: null });
{
    const k = new KolejkaTaktu();
    const rzut = 10.1;
    const start = siatka.nastepneUderzenieS(rzut, 0.5);
    k.odloz('Kruki', start);
    spr(`opóźnienie ${((start - rzut) * 1000).toFixed(0)} ms (<= 500) i start na uderzeniu`, start - rzut <= 0.5 && start > rzut && siatka.faza(start + 1e-9).faza01 < 0.01);
    spr('przed uderzeniem nic nie odpala', k.dojrzale(start - 0.01).length === 0 && k.dlugosc === 1);
    const d = k.dojrzale(start + 0.01);
    spr('na uderzeniu odpala dokładnie raz', d.length === 1 && d[0] === 'Kruki' && k.dojrzale(start + 0.1).length === 0);
}
{
    const k = new KolejkaTaktu();
    k.odloz('A', 5); k.odloz('B', 5.2);
    spr('koniec pieśni (null) -> wszystko od razu, w kolejności', k.dojrzale(null).join() === 'A,B' && k.dlugosc === 0);
    k.odloz('C', 50);
    spr('pieśń przewinięta wstecz -> nie wisi', k.dojrzale(3).join() === 'C');
    spr('zły czas startu nie wchodzi do kolejki', k.odloz('X', NaN) === false && k.dlugosc === 0);
}
process.exit(ok ? 0 : 1);
