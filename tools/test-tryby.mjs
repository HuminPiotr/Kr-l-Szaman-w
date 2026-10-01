/**
 * Tryby gry - silnik rundy, konfiguracja z adresu.
 *   node tools/test-tryby.mjs
 * Spec: docs/superpowers/specs/2026-10-01-tryby-design.md
 */
import {
    Runda, parsujKonfiguracje, ODLICZANIE_S, WYBRZMIENIE_S, ZAPOWIEDZ_S,
    PROBA_DLUGOSCI, PIESN_AWARYJNA_S, OSTATNIE_S, MAX_DT_RUNDY_S
} from '../js/tryby.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

/** Przesuwa rundę o `sekundy` w krokach 1/60 s, zwraca nowy "now" (ms). */
function przesun(r, now, sekundy) {
    const kroki = Math.round(sekundy * 60);
    for (let i = 0; i < kroki; i++) { now += 1000 / 60; r.update(now); }
    return now;
}

console.log('STANY RUNDY:');
{
    // 30 s, nie 10: przy rundzie <= OSTATNIE_S "ostatnie sekundy" trwałyby od początku.
    const r = new Runda({ dlugoscS: 30 });
    spr('przed startem NIEZACZETA', r.stan === 'NIEZACZETA');
    let now = 1000;
    r.start(now);
    spr('start bez zapowiedzi -> ODLICZANIE', r.stan === 'ODLICZANIE');
    spr('odliczanie pokazuje 3', r.odliczanie === 3);
    spr('ODLICZANIE nie punktuje', r.punktuje === false);
    now = przesun(r, now, ODLICZANIE_S - 0.2);
    spr(`po ${ODLICZANIE_S - 0.2} s nadal ODLICZANIE`, r.stan === 'ODLICZANIE');
    spr('odliczanie pokazuje 1 tuż przed końcem', r.odliczanie === 1);
    now = przesun(r, now, 0.4);
    spr('po ODLICZANIU -> TRWA', r.stan === 'TRWA');
    spr('TRWA punktuje', r.punktuje === true);
    spr(`pozostało ~30 s (${r.pozostaloS.toFixed(2)})`, r.pozostaloS > 29.5 && r.pozostaloS <= 30);
    now = przesun(r, now, 5);
    spr(`po 5 s: postęp ~0.17 (${r.postep.toFixed(2)})`, r.postep > 0.1 && r.postep < 0.3);
    spr('ostatnieSekundy false, gdy zostało > OSTATNIE_S', r.ostatnieSekundy === false);
    now = przesun(r, now, 16);
    spr(`zostało < ${OSTATNIE_S} s -> ostatnieSekundy`, r.ostatnieSekundy === true);
    now = przesun(r, now, 9.5);
    spr('po czasie -> WYBRZMIENIE', r.stan === 'WYBRZMIENIE');
    spr('WYBRZMIENIE nadal punktuje (reakcje kończą się naturalnie)', r.punktuje === true);
    now = przesun(r, now, WYBRZMIENIE_S + 0.2);
    spr('po wybrzmieniu -> KONIEC', r.stan === 'KONIEC');
    spr('KONIEC nie punktuje', r.punktuje === false);
    spr('KONIEC: postęp 1', r.postep === 1);
    const stan = r.stan;
    przesun(r, now, 5);
    spr('KONIEC jest końcowy', r.stan === stan);
}

console.log('\nZAPOWIEDZ (Krąg):');
{
    const r = new Runda({ dlugoscS: 10, zapowiedz: true });
    let now = 0;
    r.start(now);
    spr('start z zapowiedzią -> ZAPOWIEDZ', r.stan === 'ZAPOWIEDZ');
    spr('ZAPOWIEDZ nie punktuje', r.punktuje === false);
    now = przesun(r, now, ZAPOWIEDZ_S + 0.2);
    spr('po ZAPOWIEDZI -> ODLICZANIE', r.stan === 'ODLICZANIE');
}

console.log('\nCZAS NIEZALEŻNY OD FPS:');
{
    const dlaFps = (fps) => {
        const r = new Runda({ dlugoscS: 20 });
        let now = 0; r.start(now);
        const krok = 1000 / fps;
        for (let t = 0; t < (ODLICZANIE_S + 5) * 1000; t += krok) { now += krok; r.update(now); }
        return r.czasRundyS;
    };
    const a = dlaFps(60), b = dlaFps(20);
    spr(`60 FPS (${a.toFixed(2)}) ~ 20 FPS (${b.toFixed(2)}) po tym samym czasie`, Math.abs(a - b) < 0.3);
}

console.log('\nREVIEW FOCUS 1 - zawieszona karta:');
{
    const r = new Runda({ dlugoscS: 60 });
    let now = 0; r.start(now);
    now = przesun(r, now, ODLICZANIE_S + 1);
    const przed = r.czasRundyS;
    r.update(now + 10 * 60 * 1000);   // 10 minut w jednej klatce
    const skok = r.czasRundyS - przed;
    spr(`skok o 10 min przesuwa rundę o <= ${MAX_DT_RUNDY_S} s (${skok.toFixed(3)})`, skok <= MAX_DT_RUNDY_S + 1e-9);
    spr('runda nadal TRWA', r.stan === 'TRWA');
}

console.log('\nPIEŚŃ KOŃCZY WCZEŚNIEJ:');
{
    const r = new Runda({ dlugoscS: 200 });
    let now = 0; r.start(now);
    now = przesun(r, now, ODLICZANIE_S + 2);
    r.zakonczPiesn();
    spr('zakonczPiesn w TRWA -> WYBRZMIENIE', r.stan === 'WYBRZMIENIE');
    r.zakonczPiesn();
    spr('drugie zakonczPiesn nic nie robi', r.stan === 'WYBRZMIENIE');
    const r2 = new Runda({ dlugoscS: 200 });
    r2.start(0);
    r2.zakonczPiesn();
    spr('zakonczPiesn w ODLICZANIU jest ignorowane', r2.stan === 'ODLICZANIE');
}

console.log('\nPRZERWANIE:');
{
    const r = new Runda({ dlugoscS: 10 });
    r.start(0); r.update(100);
    r.przerwij();
    spr('przerwij -> PRZERWANA', r.stan === 'PRZERWANA');
    spr('PRZERWANA nie punktuje', r.punktuje === false);
    r.update(5000);
    spr('PRZERWANA jest końcowa', r.stan === 'PRZERWANA');
    const k = new Runda({ dlugoscS: 1 });
    k.start(0);
    let n = 0; for (let i = 0; i < 600; i++) { n += 17; k.update(n); }
    k.przerwij();
    spr('przerwij po KONIEC nic nie zmienia', k.stan === 'KONIEC');
    const nz = new Runda({ dlugoscS: 10 });
    nz.przerwij();
    spr('przerwij przed startem nic nie zmienia', nz.stan === 'NIEZACZETA');
}

console.log('\nZŁE WEJŚCIA:');
{
    spr(`dlugoscS NaN -> ${PIESN_AWARYJNA_S} s`, new Runda({ dlugoscS: NaN }).dlugoscS === PIESN_AWARYJNA_S);
    spr('dlugoscS ujemna -> awaryjna', new Runda({ dlugoscS: -5 }).dlugoscS === PIESN_AWARYJNA_S);
    spr('brak opcji nie rzuca', new Runda().dlugoscS === PIESN_AWARYJNA_S);
    const r = new Runda({ dlugoscS: 10 });
    r.start(NaN);
    spr('start(NaN) ignorowany', r.stan === 'NIEZACZETA');
    r.start(0); r.update(NaN); r.update(Infinity);
    spr('update(NaN/Infinity) nie psuje', Number.isFinite(r.czasRundyS) && r.czasRundyS >= 0);
    r.update(-5000);
    spr('czas wstecz nie cofa rundy', r.czasRundyS >= 0);
}

console.log('\nKONFIGURACJA Z ADRESU:');
{
    const k0 = parsujKonfiguracje('');
    spr('pusty adres = swobodny', k0.tryb === 'swobodny' && k0.zew === false && k0.krag === null);
    spr('nieznany tryb = swobodny', parsujKonfiguracje('?tryb=hack').tryb === 'swobodny');
    const p = parsujKonfiguracje('?tryb=proba&czas=60');
    spr('próba 60 s', p.tryb === 'proba' && p.dlugoscS === 60);
    spr('czas spoza listy -> 90', parsujKonfiguracje('?tryb=proba&czas=45').dlugoscS === 90);
    spr('czas bez wartości -> 90', parsujKonfiguracje('?tryb=proba').dlugoscS === 90);
    spr('czas NaN -> 90', parsujKonfiguracje('?tryb=proba&czas=abc').dlugoscS === 90);
    for (const c of PROBA_DLUGOSCI) spr(`czas ${c} dozwolony`, parsujKonfiguracje(`?tryb=proba&czas=${c}`).dlugoscS === c);
    const o = parsujKonfiguracje('?tryb=obrzed&piesn=1');
    spr('obrzęd: indeks pieśni', o.tryb === 'obrzed' && o.piesn === 1);
    spr('piesn ujemna/NaN -> 0', parsujKonfiguracje('?tryb=obrzed&piesn=-3').piesn === 0 && parsujKonfiguracje('?tryb=obrzed&piesn=x').piesn === 0);
    spr('zew=1', parsujKonfiguracje('?tryb=proba&zew=1').zew === true);
    spr('zew=true', parsujKonfiguracje('?tryb=proba&zew=true').zew === true);
    spr('zew=0', parsujKonfiguracje('?tryb=proba&zew=0').zew === false);
    const kr = parsujKonfiguracje('?tryb=proba&krag=Ola,%20Bartek');
    spr('krąg: nicki przycięte', Array.isArray(kr.krag) && kr.krag[0] === 'Ola' && kr.krag[1] === 'Bartek');
    spr('krąg z jednym graczem = null', parsujKonfiguracje('?tryb=proba&krag=Ola').krag === null);
    spr('krąg: puste odpadają', parsujKonfiguracje('?tryb=proba&krag=Ola,,,Jan').krag.length === 2);
    spr('krąg: nick przycięty do 16 znaków', parsujKonfiguracje('?tryb=proba&krag=' + 'x'.repeat(40) + ',Jan').krag[0].length === 16);
    spr('krąg: maks. 6 graczy', parsujKonfiguracje('?tryb=proba&krag=a,b,c,d,e,f,g,h').krag.length === 6);
    spr('swobodny ignoruje krąg i zew', (() => { const s = parsujKonfiguracje('?krag=a,b&zew=1'); return s.krag === null && s.zew === false; })());
    spr('NIE używa location (czysta funkcja)', typeof parsujKonfiguracje('?tryb=proba') === 'object');
}

process.exit(ok ? 0 : 1);
