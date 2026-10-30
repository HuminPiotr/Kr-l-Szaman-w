/**
 * Nauka rytmu pieśni z YouTube - mapowanie na czas odtwarzacza, pokrycie, dziury,
 * reklama/przewinięcie, łączenie wersji, magazyn.
 *
 *   node tools/test-nauka.mjs
 */
import { NaukaRytmu, NauczonePiesni, KLUCZ_NAUCZONYCH } from '../js/rytm/nauka.js';
import { SiatkaNaZywo } from '../js/rytm/sledzenieNaZywo.js';
import { SiatkaUderzen } from '../js/rytm/siatka.js';

let ok = true;
const spr = (o, w) => { console.log(`  ${w ? '✓' : '✗'} ${o}`); if (!w) ok = false; };
const DT = 1 / 60, T = 60 / 128, PIERWSZE_YT = 0.4, DLUG = 120;

/** Gra pieśń: zegar słuchu startuje w 1000 s, odtwarzacz od 0; słuch pewny w [pewnyOd, pewnyDo). */
function graj(n, { pewnyOd = 5, pewnyDo = DLUG, reklama = null, sekund = DLUG } = {}) {
    // Uderzenia słuchu leżą dokładnie na uderzeniach pieśni (w zegarze słuchu: 1000 + tYt).
    const siatka = new SiatkaNaZywo(1000 + PIERWSZE_YT, T, 0);
    let yt = 0;
    for (let t = 0; t < sekund; t += DT) {
        if (reklama && t >= reklama[0] && t < reklama[1]) { n.update({ siatka, pewny: true, czasS: 1000 + t }, null); continue; }
        if (reklama && t >= reklama[1] && yt < t - (reklama[1] - reklama[0]) - 1) yt = t - (reklama[1] - reklama[0]);
        yt = reklama && t >= reklama[1] ? t - (reklama[1] - reklama[0]) : t;
        const czasSluchu = 1000 + t;
        const s = reklama && t >= reklama[1] ? new SiatkaNaZywo(1000 + (reklama[1] - reklama[0]) + PIERWSZE_YT, T, 0) : siatka;
        n.update({ siatka: s, pewny: t >= pewnyOd && t < pewnyDo, czasS: czasSluchu }, yt);
    }
    return n;
}
const blad = (rytm) => {
    const s = SiatkaUderzen.z(rytm);
    const b = [];
    for (let i = 20; i < 200; i++) { const t = PIERWSZE_YT + i * T; if (t > DLUG - 1) break; const f = s.faza(t + 1e-6); b.push(Math.min(f.faza01, 1 - f.faza01) * f.okresS); }
    return Math.max(...b);
};

{
    const w = graj(new NaukaRytmu()).wynik(DLUG);
    spr(`pełna pieśń: rytm ${w?.rytm.bpm} BPM (128), pokrycie ${(w?.pokrycie * 100).toFixed(0)}%, błąd uderzeń max ${(blad(w.rytm) * 1000).toFixed(1)} ms`, w && Math.abs(w.rytm.bpm - 128) < 0.5 && blad(w.rytm) < 0.01);
}
{
    const w = graj(new NaukaRytmu(), { pewnyOd: 5, pewnyDo: 40 }).wynik(DLUG);
    spr('usłyszane tylko 30% pieśni -> nic nie zapisujemy', w === null);
}
{
    const pierwsza = graj(new NaukaRytmu(), { pewnyOd: 5, pewnyDo: 85 }).wynik(DLUG);
    const druga = graj(new NaukaRytmu(), { pewnyOd: 40, pewnyDo: DLUG });
    const w = druga.wynik(DLUG, pierwsza?.rytm ?? null);
    spr(`druga runda łączy się z zapamiętaną (pokrycie ${(pierwsza?.pokrycie * 100).toFixed(0)}% -> ${(w?.pokrycie * 100).toFixed(0)}%)`, pierwsza && w && w.pokrycie > 0.9 && w.pokrycie > pierwsza.pokrycie && blad(w.rytm) < 0.01);
}
{
    const w = graj(new NaukaRytmu(), { reklama: [50, 65], sekund: DLUG + 15 }).wynik(DLUG);
    spr(`reklama w środku (15 s): rytm dalej trafny (błąd ${(blad(w.rytm) * 1000).toFixed(1)} ms)`, w && blad(w.rytm) < 0.02);
}
{
    const m = new Map();
    const mag = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    const np = new NauczonePiesni(mag);
    const w = graj(new NaukaRytmu()).wynik(DLUG);
    spr('zapis i odczyt per film', np.zapisz('dQw4w9WgXcQ', w.rytm, w.pokrycie) && np.rytm('dQw4w9WgXcQ')?.bpm === w.rytm.bpm && np.rytm('innyFilm123') === null);
    m.set(KLUCZ_NAUCZONYCH, '{zepsute');
    spr('uszkodzony magazyn -> brak rytmu, bez wyjątku', np.rytm('dQw4w9WgXcQ') === null);
    const ile = np.importuj({ dQw4w9WgXcQ: { rytm: w.rytm }, 'zly/id': { rytm: w.rytm }, abcdefghijk: { rytm: { bpm: 'x' } } });
    spr(`import przyjmuje tylko poprawne (${ile})`, ile === 1 && np.rytm('dQw4w9WgXcQ') !== null);
    const rzuca = new NauczonePiesni({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } });
    spr('magazyn rzuca -> null / false', rzuca.rytm('dQw4w9WgXcQ') === null && rzuca.zapisz('dQw4w9WgXcQ', w.rytm, 1) === false);
}
{
    const n = new NaukaRytmu();
    n.update(null, 5); n.update({ siatka: null, pewny: true, czasS: 1 }, 5); n.update({ siatka: new SiatkaNaZywo(0, 0.5), pewny: true, czasS: NaN }, NaN);
    spr('złe dane nie rzucają i nic nie zbierają', n.liczba === 0 && n.wynik(100) === null);
}
process.exit(ok ? 0 : 1);
