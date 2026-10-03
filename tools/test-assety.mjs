/**
 * Ładowarka assetów (js/assety.js) - manifest i odporność, BEZ ładowania
 * prawdziwych obrazów (Node nie ma DOM/Image).
 *
 *   node tools/test-assety.mjs
 *
 * KLUCZOWA ASERCJA TEGO PLIKU: sam IMPORT modułu nie wywala wyjątku w
 * Node. js/assety.js jest jedynym miejscem w grze dotykającym `new
 * Image()` - gdyby zrobił to na poziomie modułu (zamiast dopiero
 * w zaladuj()), ten test by w ogóle nie wystartował.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MANIFEST, gotowe, obraz, losowyWariant, zaladuj } from '../js/assety.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

console.log('IMPORT (bez DOM):');
spr('import modułu nie wywalił wyjątku (ten log w ogóle się wykonuje)', true);

console.log('\nMANIFEST - KSZTAŁT:');
spr('MANIFEST ma pierścień zewnętrzny i wewnętrzny (stringi)',
    typeof MANIFEST.pierscienZewnetrzny === 'string' && typeof MANIFEST.pierscienWewnetrzny === 'string');
spr('MANIFEST.mgla to tablica wariantów', Array.isArray(MANIFEST.mgla) && MANIFEST.mgla.length > 1);
spr('MANIFEST.drobina to tablica wariantów', Array.isArray(MANIFEST.drobina) && MANIFEST.drobina.length > 1);
spr('MANIFEST ma rozbłysk (string)', typeof MANIFEST.rozblysk === 'string');
spr('MANIFEST.smugaWiatru to tablica wariantów (Aard v2)', Array.isArray(MANIFEST.smugaWiatru) && MANIFEST.smugaWiatru.length > 1);
spr('MANIFEST ma wir (string, Aard v2)', typeof MANIFEST.wir === 'string');
spr('MANIFEST.odlamek - trzy warianty ziemi (Kamienna Tarcza, Kurzawa)', Array.isArray(MANIFEST.odlamek) && MANIFEST.odlamek.length === 3);
spr('wiryKurzawy usunięte (Kurzawa v2 nie używa zawijasów)', MANIFEST.wiryKurzawy === undefined);
spr('MANIFEST.kragFali i dyskUderzenia - pierścienie Kręgów Mokoszy (stringi)', typeof MANIFEST.kragFali === 'string' && typeof MANIFEST.dyskUderzenia === 'string');
spr('MANIFEST.promien - smugi promieni Kręgów Mokoszy (2 warianty)', Array.isArray(MANIFEST.promien) && MANIFEST.promien.length === 2);
spr('MANIFEST.wyladowanie - trzy pęknięcia elektryczne (Łuk Peruna)', Array.isArray(MANIFEST.wyladowanie) && MANIFEST.wyladowanie.length === 3);

console.log('\nMANIFEST - PLIKI FAKTYCZNIE ISTNIEJĄ NA DYSKU:');
// Łapie literówkę w nazwie pliku ZANIM zobaczy ją gracz (w przeglądarce
// błędny path po prostu cicho nie załaduje się - onerror, żaden wyjątek).
const wszystkieSciezki = [];
for (const v of Object.values(MANIFEST)) {
    if (Array.isArray(v)) wszystkieSciezki.push(...v); else wszystkieSciezki.push(v);
}
spr(`manifest wymienia ${wszystkieSciezki.length} plików`, wszystkieSciezki.length >= 8);
for (const sciezka of wszystkieSciezki) {
    spr(`  ${sciezka} istnieje na dysku`, existsSync(join(REPO_ROOT, sciezka)));
}

console.log('\nLICENSE.txt:');
spr('assets/czastki/LICENSE.txt istnieje', existsSync(join(REPO_ROOT, 'assets/czastki/LICENSE.txt')));
const licencja = readFileSync(join(REPO_ROOT, 'assets/czastki/LICENSE.txt'), 'utf8');
spr('LICENSE.txt wymienia CC0', licencja.includes('CC0'));

console.log('\nSTAN PRZED zaladuj() - odporność na brak DOM:');
spr('gotowe() jest false, dopóki nikt nie wywołał zaladuj()', gotowe() === false);
spr('obraz() dla nieznanej ścieżki zwraca null, bez wyjątku', obraz('nieistnieje.png') === null);
spr('obraz() dla ścieżki z manifestu (jeszcze niezaładowanej) zwraca null, bez wyjątku',
    obraz(MANIFEST.rozblysk) === null);
spr('losowyWariant() na tablicy BEZ załadowanych obrazów zwraca null, bez wyjątku',
    losowyWariant(MANIFEST.mgla) === null);
spr('losowyWariant() na pustej tablicy zwraca null, bez wyjątku', losowyWariant([]) === null);
spr('losowyWariant() na nie-tablicy zwraca null, bez wyjątku', losowyWariant(null) === null);

console.log('\nzaladuj() W NODE (brak `Image` global):');
// W przeglądarce zaladuj() startuje `new Image()` na każdą ścieżkę. W
// Node globalnego `Image` nie ma. WAŻNE: `new Image()` rzucony WEWNĄTRZ
// `new Promise(executor)` (patrz _zaladujJeden w assety.js) nie wychodzi
// jako synchroniczny wyjątek z zaladuj() - konstruktor Promise łapie
// rzut z executora i zamienia go w ODRZUCENIE obietnicy. To jest zwykła
// semantyka JS, nie błąd w assety.js - test sprawdza WŁAŚCIWĄ granicę:
// zaladuj() zwraca thenable i bez `Image` ta obietnica ODRZUCA SIĘ
// (zamiast cicho wisieć w nieskończoność, gdyby ktoś przez pomyłkę
// połknął błąd np. przez `.catch(() => {})` bez rezygnacji).
const wynikZaladuj = zaladuj();
spr('zaladuj() zwraca Promise (nie rzuca synchronicznie - to normalna semantyka executora Promise)',
    wynikZaladuj instanceof Promise);

let odrzucona = false;
try {
    await wynikZaladuj;
} catch {
    odrzucona = true;
}
spr('...i w środowisku bez `Image` (Node) ta obietnica faktycznie ODRZUCA się, zamiast cicho "rozwiązać się" z pustymi rękami',
    odrzucona);

process.exit(ok ? 0 : 1);
