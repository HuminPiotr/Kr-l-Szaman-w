/**
 * Kolejność źródeł rytmu: plik -> nauczona pieśń YouTube -> słuch na żywo.
 *
 *   node tools/test-zrodla-rytmu.mjs
 */
import { wybierzRytm } from '../js/rytm/zrodlaRytmu.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const S = { faza: () => null };
const plik = { siatka: S, czasS: 10 }, nauczona = { siatka: S, czasS: 20 }, sluch = { siatka: S, czasS: 30, pewny: true };

spr('wszystko -> plik', wybierzRytm({ plik, nauczona, sluch })?.zrodlo === 'plik');
spr('bez pliku -> nauczona', wybierzRytm({ nauczona, sluch })?.zrodlo === 'nauczona');
spr('tylko słuch -> słuch z jego czasem', wybierzRytm({ sluch })?.zrodlo === 'sluch' && wybierzRytm({ sluch }).czasS === 30);
spr('słuch niepewny -> null', wybierzRytm({ sluch: { ...sluch, pewny: false } }) === null);
spr('pieśń w pauzie (czas null) -> następne źródło', wybierzRytm({ plik: { siatka: S, czasS: null }, sluch })?.zrodlo === 'sluch');
spr('nic / undefined -> null', wybierzRytm({}) === null && wybierzRytm() === null);
process.exit(ok ? 0 : 1);
