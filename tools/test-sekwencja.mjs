/**
 * Pasek sekwencji: zanik pojedynczego slotu, stan slotów/widma (czyste
 * funkcje, bez DOM) i odporność klasy PasekSekwencji przy braku elementów
 * (Node, bez document).
 *
 *   node tools/test-sekwencja.mjs
 */
import { alfaSlotu, obliczSloty, obliczWidmo, PasekSekwencji } from '../js/sekwencja.js';
import { KomboSilnik, OKNO_MS } from '../js/kombosy.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('ALFA SLOTU (czysta funkcja):');
spr('świeży slot (wiek=0) -> pełna alfa', alfaSlotu(0, OKNO_MS) === 1);
spr('w połowie okna nadal pełna alfa (próg zaniku 55%)', alfaSlotu(OKNO_MS * 0.4, OKNO_MS) === 1);
spr('tuż przed końcem okna -> prawie zero', alfaSlotu(OKNO_MS * 0.99, OKNO_MS) < 0.1);
spr('dokładnie na końcu okna -> zero', alfaSlotu(OKNO_MS, OKNO_MS) === 0);
spr('za oknem -> zero, bez wyjątku', alfaSlotu(OKNO_MS * 5, OKNO_MS) === 0);
spr('NaN wiek -> pełna alfa (traktowane jak 0)', alfaSlotu(NaN, OKNO_MS) === 1);
spr('NaN okno -> spada na domyślne OKNO_MS, nie wybucha', Number.isFinite(alfaSlotu(1000, NaN)));

// Monotoniczność: alfa nigdy nie rośnie z wiekiem.
let monotoniczna = true, poprzednia = 2;
for (let w = 0; w <= OKNO_MS; w += 50) {
    const a = alfaSlotu(w, OKNO_MS);
    if (a > poprzednia + 1e-9) monotoniczna = false;
    poprzednia = a;
}
spr('alfa maleje monotonicznie z wiekiem', monotoniczna);

console.log('\nOBLICZ SLOTY (czysta funkcja, bez DOM):');
const wpisy = [{ id: 'swarog', t: 0 }, { id: 'weles', t: 1000 }, { id: 'perun', t: 2000 }];
const sloty = obliczSloty(wpisy, new Set([1000]), 2500, OKNO_MS);
spr('zwraca tyle slotów, ile wpisów', sloty.length === 3);
spr('każdy slot dostaje znak runy', sloty.every(s => typeof s.znak === 'string' && s.znak.length > 0));
spr('slot ze znacznikiem w zwiazaneT jest oznaczony zwiazana=true', sloty[1].zwiazana === true);
spr('pozostałe sloty NIE są związane', sloty[0].zwiazana === false && sloty[2].zwiazana === false);
spr('kolejność slotów zachowana (najstarszy pierwszy)', sloty[0].id === 'swarog' && sloty[2].id === 'perun');

spr('obliczSloty(null, ...) -> pusta lista, bez wyjątku', obliczSloty(null, new Set(), 0).length === 0);
spr('obliczSloty bez zwiazaneT (nie-Set) -> nic nie jest związane', obliczSloty(wpisy, null, 0).every(s => s.zwiazana === false));

console.log('\nOBLICZ WIDMO (czysta funkcja):');
spr('brak składanej pieczęci -> null', obliczWidmo(null, 0.5) === null);
spr('nieznane id -> null', obliczWidmo('nieistnieje', 0.5) === null);
const widmo0 = obliczWidmo('swarog', 0);
spr('postep=0 -> alfa bazowa 0.08', Math.abs(widmo0.opacity - 0.08) < 0.001);
const widmo1 = obliczWidmo('swarog', 1);
spr('postep=1 -> alfa maksymalna 0.43, NIGDY pełna runa', Math.abs(widmo1.opacity - 0.43) < 0.001);
spr('widmo nigdy nie osiąga alfy pełnej runy (1.0)', widmo1.opacity < 0.5);

console.log('\nBUFOR NIE JEST CZYSZCZONY PO COMBO (integracja z KomboSilnik):');
const silnik = new KomboSilnik();
silnik.dodaj('perun', 0);
silnik.dodaj('weles', 500);
const technika = silnik.dodaj('mokosz', 1000);
spr(`perun -> weles -> mokosz trafia Kołowrót (${technika?.id})`, technika?.id === 'kolowrot');

const ogonTechniki = silnik.bufor.slice(-technika.sekwencja.length);
const slotyPoCombo = obliczSloty(silnik.aktywne(1100), new Set(ogonTechniki.map(w => w.t)), 1100, OKNO_MS);
spr('po trafieniu combo WSZYSTKIE trzy sloty nadal widoczne (bufor nieczyszczony)', slotyPoCombo.length === 3);
spr('wszystkie trzy sloty combo oznaczone jako związane', slotyPoCombo.every(s => s.zwiazana));

console.log('\nKLASA PasekSekwencji BEZ DOM (Node, elSloty=null):');
const pasek = new PasekSekwencji(null, null);
let rzucil = false;
try {
    pasek.update(1000, wpisy, 'swarog', 0.5, OKNO_MS);
    pasek.oznaczCombo(ogonTechniki, 'Kołowrót', 1000);
    pasek.update(NaN, null, null, NaN, NaN);
} catch {
    rzucil = true;
}
spr('update()/oznaczCombo() bez elSloty nie rzucają (cicha odmowa jak runa.js bez ctx)', !rzucil);

process.exit(ok ? 0 : 1);
