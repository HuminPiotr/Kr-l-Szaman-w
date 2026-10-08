/**
 * Pieśni - manifest, ścieżki, Piesn z atrapą <audio>.
 *   node tools/test-piesni.mjs
 * Pieśń NIGDY nie jest błędem (GEMINI.md §2): każda awaria kończy się
 * { ok:false } i komunikatem "Duchy zgubiły pieśń", nie wyjątkiem.
 */
import { readFileSync } from 'node:fs';
import { sciezkaPliku, walidujManifest, wczytajManifest, Piesn, KATALOG_MUZYKI } from '../js/piesni.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Atrapa <audio>: wydarzenia wywołujemy ręcznie. */
function atrapaAudio({ duration = 200, play = () => Promise.resolve() } = {}) {
    const sluchacze = {};
    return {
        duration, volume: 1, src: '', paused: true, preload: '',
        addEventListener(n, f) { (sluchacze[n] ??= []).push(f); },
        removeEventListener(n, f) { sluchacze[n] = (sluchacze[n] ?? []).filter(x => x !== f); },
        emit(n) { for (const f of sluchacze[n] ?? []) f({ type: n }); },
        load() {},
        play() { this.paused = false; return play(); },
        pause() { this.paused = true; }
    };
}

console.log('ŚCIEŻKI:');
{
    spr('katalog', KATALOG_MUZYKI === 'assets/muzyka/');
    spr('spacje i polskie znaki zakodowane', sciezkaPliku('Ogien w zyłach.m4a') === 'assets/muzyka/' + encodeURIComponent('Ogien w zyłach.m4a'));
    spr('zakodowana ścieżka nie ma surowej spacji', !sciezkaPliku('a b.m4a').includes(' '));
}

console.log('\nMANIFEST - WALIDACJA:');
{
    const dobry = walidujManifest([{ plik: 'a.m4a', tytul: 'A', autor: 'x', licencja: 'y' }]);
    spr('poprawny wpis przechodzi', dobry.length === 1 && dobry[0].tytul === 'A');
    spr('brak tytułu -> tytuł z nazwy pliku', walidujManifest([{ plik: 'Piesn.m4a' }])[0].tytul === 'Piesn');
    spr('nie-tablica -> pusta lista', walidujManifest({}).length === 0 && walidujManifest(null).length === 0 && walidujManifest('x').length === 0);
    spr('wpis bez pliku odrzucony', walidujManifest([{ tytul: 'x' }, null, 5, { plik: '' }]).length === 0);
    spr('dlugoscS z manifestu zachowana', walidujManifest([{ plik: 'a.m4a', dlugoscS: 216.4 }])[0].dlugoscS === 216.4);
    spr('brak/zła dlugoscS = 0', [undefined, NaN, -5, 'x', 0, Infinity].every(d => walidujManifest([{ plik: 'a.m4a', dlugoscS: d }])[0].dlugoscS === 0));
    spr('ścieżka z ../ odrzucona (nie wychodzimy z katalogu)', walidujManifest([{ plik: '../../etc/passwd' }, { plik: 'a/b.m4a' }, { plik: 'a\\b.m4a' }]).length === 0);
    spr('pola nie-tekstowe nie rzucają', walidujManifest([{ plik: 'a.m4a', tytul: 5, autor: {}, licencja: null }]).length === 1);
}

console.log('\nMANIFEST - WCZYTANIE:');
{
    const fetchOk = async () => ({ ok: true, json: async () => [{ plik: 'a.m4a', tytul: 'A' }] });
    spr('poprawny JSON', (await wczytajManifest(fetchOk)).length === 1);
    spr('HTTP 404 -> pusta lista', (await wczytajManifest(async () => ({ ok: false }))).length === 0);
    spr('wyjątek sieci -> pusta lista', (await wczytajManifest(async () => { throw new Error('offline'); })).length === 0);
    spr('zły JSON -> pusta lista', (await wczytajManifest(async () => ({ ok: true, json: async () => { throw new Error('x'); } }))).length === 0);
}

console.log('\nMANIFEST NA DYSKU:');
{
    const dane = JSON.parse(readFileSync(new URL('../assets/muzyka/utwory.json', import.meta.url), 'utf8'));
    const m = walidujManifest(dane);
    spr(`manifest ma wpisy (${m.length})`, m.length >= 1);
    spr('wszystkie wpisy przeszły walidację', m.length === dane.length);
    for (const u of m) {
        let istnieje = true;
        try { readFileSync(new URL('../' + KATALOG_MUZYKI + u.plik, import.meta.url)); } catch { istnieje = false; }
        spr(`plik '${u.plik}' istnieje`, istnieje);
        spr(`'${u.plik}' ma autora i licencję do uzupełnienia/wyjaśnienia`, u.autor.length > 0 && u.licencja.length > 0);
        spr(`'${u.plik}' ma dlugoscS z manifestu (menu pokazuje czas pieśni)`, u.dlugoscS > 0);
    }
}

console.log('\nPIESN - ŁADOWANIE:');
{
    const audio = atrapaAudio({ duration: 215.5 });
    const p = new Piesn({ plik: 'a b.m4a' }, { audioFabryka: () => audio, limitMs: 50 });
    const wynik = p.zaladuj();
    audio.emit('loadedmetadata');
    const r = await wynik;
    spr(`długość z audio.duration (${r.dlugoscS})`, r.ok === true && r.dlugoscS === 215.5);
    spr('src ustawione na zakodowaną ścieżkę', audio.src === sciezkaPliku('a b.m4a'));
}
{
    const audio = atrapaAudio({ duration: Infinity });
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => audio, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('loadedmetadata');
    spr('duration Infinity -> ok:false (awaryjna długość robi main.js)', (await w).ok === false);
}
{
    const audio = atrapaAudio({ duration: NaN });
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => audio, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('loadedmetadata');
    spr('duration NaN -> ok:false', (await w).ok === false);
}
{
    const audio = atrapaAudio();
    const p = new Piesn({ plik: 'brak.m4a' }, { audioFabryka: () => audio, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('error');
    spr('błąd wczytania -> ok:false, bez wyjątku', (await w).ok === false);
}
{
    const audio = atrapaAudio();
    const p = new Piesn({ plik: 'wolny.m4a' }, { audioFabryka: () => audio, limitMs: 20 });
    const t0 = Date.now();
    const r = await p.zaladuj();   // żadne zdarzenie nie nadejdzie
    spr(`brak odpowiedzi -> limit czasu, ok:false (${Date.now() - t0} ms)`, r.ok === false && Date.now() - t0 < 500);
}
{
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => { throw new Error('brak Audio'); }, limitMs: 20 });
    spr('fabryka rzucająca (środowisko bez Audio) -> ok:false', (await p.zaladuj()).ok === false);
}

console.log('\nPIESN - GRANIE:');
{
    const audio = atrapaAudio();
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => audio, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('loadedmetadata'); await w;
    spr('graj() = true, gdy play() się powiodło', (await p.graj()) === true && audio.paused === false);
    let koniec = 0;
    p.naKoniec(() => koniec++);
    audio.emit('ended');
    spr('ended wywołuje naKoniec raz', koniec === 1);
    audio.emit('ended');
    spr('drugie ended nie dubluje (naKoniec jednorazowy)', koniec === 1);
    p.zatrzymaj();
    spr('zatrzymaj pauzuje', audio.paused === true);
    p.zatrzymaj();
    spr('zatrzymaj jest idempotentne', audio.paused === true);
}
{
    const audio = atrapaAudio({ play: () => Promise.reject(new Error('NotAllowedError')) });
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => audio, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('loadedmetadata'); await w;
    spr('autoplay zablokowany -> graj() = false, bez wyjątku', (await p.graj()) === false);
    const bezZaladowania = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => atrapaAudio(), limitMs: 50 });
    spr('graj() przed zaladuj() = false', (await bezZaladowania.graj()) === false);
}

console.log('\nPIESN - GŁOŚNOŚĆ I MAGISTRALA:');
{
    const audio = atrapaAudio();
    const wywolania = [];
    const magistrala = { glosnosc: (v, t) => wywolania.push([v, t]), odlacz: () => wywolania.push(['odlacz']) };
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => audio, magistrala: () => magistrala, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('loadedmetadata'); await w;
    await p.graj();   // uchwyt magistrali powstaje przy graniu (po gestach; createMediaElementSource raz na element)
    p.zanik(2);
    spr('zanik idzie przez magistralę (gain), nie audio.volume', wywolania.some(x => x[0] === 0 && x[1] === 2) && audio.volume === 1);
    p.zatrzymaj();
    spr('zatrzymaj odłącza od magistrali', wywolania.some(x => x[0] === 'odlacz'));
    spr('zanik(NaN) nie rzuca', (() => { try { p.zanik(NaN); return true; } catch { return false; } })());
}
{
    const audio = atrapaAudio();
    const p = new Piesn({ plik: 'a.m4a' }, { audioFabryka: () => audio, magistrala: () => null, limitMs: 50 });
    const w = p.zaladuj(); audio.emit('loadedmetadata'); await w;
    p.zanik(2);
    spr('bez magistrali (audio jeszcze nie zainicjowane) zanik schodzi na audio.volume', audio.volume === 0);
}

process.exit(ok ? 0 : 1);

{
    const { wyciagnijIdYoutube, utworZPliku, utworzPiesn, PiesnYoutube } = await import('../js/piesni.js');
    console.log('\nWŁASNE PIEŚNI:');
    const id = 'dQw4w9WgXcQ';
    spr('linki YouTube (watch, youtu.be, shorts, music, goły ID)', [
        `https://www.youtube.com/watch?v=${id}&t=3`, `youtu.be/${id}?si=x`, `https://youtube.com/shorts/${id}`,
        `https://music.youtube.com/watch?v=${id}`, id].every(t => wyciagnijIdYoutube(t) === id));
    spr('obce domeny i śmieci -> null', [`https://evil.com/?v=${id}`, 'x', '', null, 5].every(t => wyciagnijIdYoutube(t) === null));
    spr('plik audio przechodzi, tytuł z nazwy', utworZPliku({ name: 'Moja pieśń.mp3', type: 'audio/mpeg' })?.tytul === 'Moja pieśń');
    spr('plik tekstowy odrzucony', utworZPliku({ name: 'a.txt', type: 'text/plain' }) === null);
    spr('klucz własnej pieśni ma prefiks wlasna:', utworZPliku({ name: 'a.mp3', type: 'audio/mpeg' }).plik === 'wlasna:a.mp3');
    const a = atrapaAudio();
    const p = new Piesn({ plik: 'wlasna:a.mp3', url: 'blob:x' }, { audioFabryka: () => a });
    p.zaladuj(); a.emit('loadedmetadata');
    spr('url wygrywa nad ścieżką z katalogu', a.src === 'blob:x');
    spr('fabryka wybiera klasę po źródle', utworzPiesn({ zrodlo: 'yt', ytId: id }) instanceof PiesnYoutube && utworzPiesn({ plik: 'a' }) instanceof Piesn);
    const yt = new PiesnYoutube({ ytId: id }, { limitMs: 50, kontener: () => null });
    spr('YouTube bez API/kontenera -> ok:false, bez wyjątku', (await yt.zaladuj()).ok === false);
    spr('YouTube: graj/zanik/zatrzymaj bez playera nie rzucają', (await yt.graj()) === false && (yt.zanik(1), yt.zatrzymaj(), true));
}
