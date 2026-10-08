/**
 * Własne pieśni - pamięć (IndexedDB + localStorage na atrapach).
 *   node tools/test-wlasne-piesni.mjs
 */
import { WlasnePiesni } from '../js/wlasnePiesni.js';
import { utworYoutube } from '../js/piesni.js';
import { Menu } from '../js/menu.js';
import { nazwaTablicy } from '../js/ksiega.js';

let ok = true;
const spr = (opis, w) => { console.log(`  ${w ? '✓' : '✗'} ${opis}`); if (!w) ok = false; };

function atrapaIdb() {
    const dane = new Map();
    const zadanie = (f) => { const r = {}; queueMicrotask(() => { r.result = f(); r.onsuccess?.(); }); return r; };
    const sklep = {
        put: (w) => dane.set(w.plik, w), delete: (k) => dane.delete(k),
        getAll: () => { const r = { get result() { return [...dane.values()]; } }; return r; }
    };
    const baza = { transaction() { const t = { objectStore: () => sklep }; queueMicrotask(() => queueMicrotask(() => t.oncomplete?.())); return t; } };
    return { open() { const r = {}; queueMicrotask(() => { r.result = { ...baza, createObjectStore() {} }; r.onupgradeneeded?.(); r.onsuccess?.(); }); return r; } };
}
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const deps = (o = {}) => ({ tworzUrl: () => 'blob:' + Math.random(), zwalniaUrl() {}, ...o });

console.log('PAMIĘĆ:');
{
    const idb = atrapaIdb(), st = storage();
    const a = new WlasnePiesni(deps({ indexedDB: idb, storage: st }));
    await a.wczytaj();
    const z = await a.dodajPlik({ plik: 'wlasna:a.mp3', tytul: 'a', zrodlo: 'plik', dlugoscS: 100 }, { size: 1 });
    a.dodajYt(utworYoutube('dQw4w9WgXcQ', 'Film', 200));
    spr('dodany plik ma url', z.url.startsWith('blob:'));
    const b = new WlasnePiesni(deps({ indexedDB: idb, storage: st }));
    const l = await b.wczytaj();
    spr('po "odświeżeniu" wracają plik i YouTube', l.length === 2 && l[0].plik === 'wlasna:a.mp3' && l[1].ytId === 'dQw4w9WgXcQ');
    await b.dodajPlik({ plik: 'wlasna:a.mp3', tytul: 'a2', zrodlo: 'plik' }, { size: 2 });
    spr('ta sama nazwa nadpisuje, bez duplikatu', b.lista().length === 2);
    await b.usun('wlasna:a.mp3'); b.dodajYt(utworYoutube('dQw4w9WgXcQ', 'X', 1));
    spr('usunięcie pliku i brak duplikatu YT', b.lista().length === 1);
    await b.usun('yt:dQw4w9WgXcQ');
    const c = new WlasnePiesni(deps({ indexedDB: idb, storage: st }));
    spr('usunięte nie wracają', (await c.wczytaj()).length === 0);
}
console.log('\nBEZ PAMIĘCI:');
{
    const w = new WlasnePiesni(deps());
    spr('wczytaj bez IndexedDB i storage nie rzuca', (await w.wczytaj()).length === 0 && w.trwala === false);
    await w.dodajPlik({ plik: 'wlasna:a.mp3', zrodlo: 'plik' }, {});
    spr('pieśń żyje do zamknięcia karty', w.lista().length === 1);
    const zly = storage(); zly.setItem('krolSzamanow.piesniYt', '{śmieci');
    spr('zepsuty JSON -> pusta lista', (await new WlasnePiesni(deps({ storage: zly })).wczytaj()).length === 0);
    const limit = new WlasnePiesni(deps());
    for (let i = 0; i < 20; i++) await limit.dodajPlik({ plik: 'wlasna:' + i, zrodlo: 'plik' }, {});
    spr('limit 20 własnych', (await limit.dodajPlik({ plik: 'wlasna:x', zrodlo: 'plik' }, {})) === null);
}
console.log('\nMENU I KSIĘGA:');
{
    const m = new Menu({ piesni: [{ plik: 'a.m4a', tytul: 'A' }] });
    m.dodajPiesn({ plik: 'wlasna:b.mp3', tytul: 'B', zrodlo: 'plik' });
    spr('dodana pieśń jest wybrana', m.piesn === 1 && m.piesni.length === 2);
    spr('ta sama podmienia, nie dubluje', (m.dodajPiesn({ plik: 'wlasna:b.mp3', tytul: 'B2', zrodlo: 'plik' }), m.piesni.length === 2));
    spr('pieśni z manifestu nie da się usunąć', m.usunPiesn(0) === false);
    spr('własną da się usunąć, wybór wraca na 0', m.usunPiesn(1) && m.piesn === 0 && m.piesni.length === 1);
    spr('nazwa tablicy własnej i YT', nazwaTablicy('obrzed:wlasna:Mój hit.mp3') === 'Obrzęd: Mój hit' && nazwaTablicy('obrzed:yt:abc+zew') === 'Obrzęd: pieśń z YouTube ze Zewem');
}
process.exit(ok ? 0 : 1);
