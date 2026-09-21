// Test js/czastki.js: dokładne tłumienie, wspólna obwiednia, wspólny sprite.
// Uruchom: node tools/test-czastki.mjs

import { krokTlumienia, obwiedniaCzastki, spriteRadialny } from '../js/czastki.js';

let ok = true;
const spr = (opis, warunek) => { console.log(`  ${warunek ? '✓' : '✗'} ${opis}`); if (!warunek) ok = false; };

console.log('1. krokTlumienia - granica k->0 (brak oporu):');
{
    const { e, s } = krokTlumienia(0, 0.1);
    spr('e=1 (prędkość nie gaśnie)', e === 1);
    spr('s=dt (ruch jednostajny)', Math.abs(s - 0.1) < 1e-12);
    const b = krokTlumienia(1e-12, 0.1);
    spr('k bardzo bliskie zeru zachowuje się jak k=0', Math.abs(b.s - 0.1) < 1e-6);
}

console.log('\n2. krokTlumienia - zgodność z formą zamkniętą v0*(1-exp(-k*t))/k:');
{
    const k = 2.4, dt = 0.5;
    const { e, s } = krokTlumienia(k, dt);
    spr(`e = exp(-k*dt) dokładnie (${e.toFixed(6)})`, Math.abs(e - Math.exp(-k * dt)) < 1e-12);
    spr(`s = (1-e)/k dokładnie (${s.toFixed(6)})`, Math.abs(s - (1 - e) / k) < 1e-12);
    // Całkowita droga cząstki startującej z v0 przez N kroków musi zbiegać
    // do formy zamkniętej v0*(1-exp(-k*T))/k, T = suma kroków.
    const v0 = 100, T = 2.0, N = 400, krok = T / N;
    let x = 0, v = v0;
    for (let i = 0; i < N; i++) {
        const { e: ei, s: si } = krokTlumienia(k, krok);
        x += v * si;
        v *= ei;
    }
    const oczekiwane = v0 * (1 - Math.exp(-k * T)) / k;
    spr(`suma N=400 kroków zgadza się z formą zamkniętą (x=${x.toFixed(4)}, oczek=${oczekiwane.toFixed(4)})`,
        Math.abs(x - oczekiwane) < 1e-6);
}

console.log('\n3. krokTlumienia - stabilność przy DUŻYM dt (dawny błąd 1-k*dt<0):');
{
    // Stary wzór 1 - k*dt przy k=3.2, dt=1 dawałby -2.2 - ODWRÓCONY ZNAK
    // prędkości. Dokładny wzór exp(-k*dt) NIGDY nie schodzi poniżej 0.
    const { e } = krokTlumienia(3.2, 1);
    spr(`e dodatnie i < 1 nawet przy k*dt>1 (e=${e.toFixed(6)})`, e > 0 && e < 1);
    const duze = krokTlumienia(3.2, 100);
    spr('e praktycznie zero przy bardzo dużym dt (bez przekroczenia w drugą stronę)', duze.e >= 0 && duze.e < 1e-100);
}

console.log('\n4. krokTlumienia - odporność na NaN/ujemne:');
{
    spr('NaN k -> e=1 (brak oporu), nie NaN', krokTlumienia(NaN, 0.1).e === 1);
    spr('NaN dt -> {e:1,s:0}', krokTlumienia(2, NaN).e === 1 && krokTlumienia(2, NaN).s === 0);
    spr('ujemne dt -> {e:1,s:0} (jak brak kroku)', krokTlumienia(2, -1).e === 1 && krokTlumienia(2, -1).s === 0);
    spr('dt=0 -> {e:1,s:0}', krokTlumienia(2, 0).e === 1 && krokTlumienia(2, 0).s === 0);
}

console.log('\n5. obwiedniaCzastki - kształt:');
{
    spr('p=0 daje 0', obwiedniaCzastki(0) === 0);
    spr('p=1 daje 0', obwiedniaCzastki(1) === 0);
    // Szczyt jest KOMPROMISEM dwóch czynników rosnących/malejących naraz
    // (sin narasta do 1 przy p=1/6, (1-p)^2 opada od startu) - numerycznie
    // wypada przy p≈0.14, wartość≈0.72, NIE blisko 1 (sprawdzone osobno,
    // nie założone). Test pilnuje tylko "szybki narost": szczyt wypada
    // wyraźnie przed połową zakresu i jest wyraźnie wyższy niż start.
    spr('szybki narost - szczyt w pierwszej ćwiartce zakresu', obwiedniaCzastki(0.2) > 0.6);
    spr('szczyt wyraźnie wyższy niż w połowie życia', obwiedniaCzastki(0.15) > obwiedniaCzastki(0.5));
    let monotonicznaPoSzczycie = true;
    let poprzednia = obwiedniaCzastki(0.2);
    for (let p = 0.25; p <= 1; p += 0.05) {
        const w = obwiedniaCzastki(p);
        if (w > poprzednia + 1e-9) monotonicznaPoSzczycie = false;
        poprzednia = w;
    }
    spr('monotoniczna (maleje) po szczycie', monotonicznaPoSzczycie);
    spr('poza zakresem (p=-1) klamrowane, nie NaN', Number.isFinite(obwiedniaCzastki(-1)));
    spr('poza zakresem (p=2) klamrowane, nie NaN', Number.isFinite(obwiedniaCzastki(2)));
    spr('NaN -> 0, bez wyjątku', obwiedniaCzastki(NaN) === 0);
}

console.log('\n6. spriteRadialny - tworzy canvas o żądanym rozmiarze:');
{
    // Wymaga document - dostępny tylko w przeglądarce, więc test warunkowy
    // (ten sam wzorzec co reszta narzędzi w tools/, patrz test-dym.mjs).
    if (typeof document === 'undefined') {
        console.log('  (pominięto - brak document w Node, sprawdzane wizualnie na stanowisku VFX)');
    } else {
        const c = spriteRadialny(255, 128, 0, 32);
        spr('rozmiar zgodny z argumentem', c.width === 32 && c.height === 32);
    }
}

console.log(ok ? '\nWSZYSTKO OK ✓' : '\nSĄ BŁĘDY ✗');
process.exit(ok ? 0 : 1);
