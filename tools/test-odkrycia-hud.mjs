/**
 * Kolejka powiadomień o odkryciach (czysta część HUD).
 *   node tools/test-odkrycia-hud.mjs
 */
import { KolejkaPowiadomien, CZAS_POWIADOMIENIA_MS, MAX_KOLEJKI } from '../js/odkryciaHud.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

const k = new KolejkaPowiadomien();
spr('pusta = null', k.aktualny(0) === null);
k.dodaj([{ rodzaj: 'pieczec', id: 'a' }, { rodzaj: 'technika', id: 'b' }, { rodzaj: 'kamien', id: 'c' }]);
spr('pierwsze od razu', k.aktualny(100).id === 'a');
spr('trzyma się przez czas powiadomienia', k.aktualny(100 + CZAS_POWIADOMIENIA_MS - 1).id === 'a');
spr('potem następne (nic nie ginie)', k.aktualny(100 + CZAS_POWIADOMIENIA_MS).id === 'b');
spr('i kolejne', k.aktualny(100 + 2 * CZAS_POWIADOMIENIA_MS).id === 'c');
spr('na końcu pusto', k.aktualny(100 + 3 * CZAS_POWIADOMIENIA_MS) === null);
const k2 = new KolejkaPowiadomien();
k2.dodaj(Array.from({ length: 20 }, (_, i) => ({ rodzaj: 'wezel', id: `w${i}` })));
let ile = 0;
for (let t = 0; k2.aktualny(t); t += CZAS_POWIADOMIENIA_MS) ile++;
spr(`kolejka ograniczona do ${MAX_KOLEJKI}`, ile === MAX_KOLEJKI);
const k3 = new KolejkaPowiadomien();
k3.dodaj([null, { rodzaj: 'x' }, undefined]); k3.dodaj(null);
spr('śmieci odpadają', k3.aktualny(0) === null);

process.exit(ok ? 0 : 1);
