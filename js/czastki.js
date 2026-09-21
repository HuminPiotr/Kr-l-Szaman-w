/**
 * Wspólne narzędzia cząstek - trzy funkcje wydzielone z iskry.js/ogien.js/
 * fala.js/kolowrot.js/dym.js/runa.js, gdzie były skopiowane (obwiednia
 * alfy) albo policzone przybliżeniem (opór liniowy).
 *
 * ================== DOKŁADNE TŁUMIENIE, NIE PRZYBLIŻONE ==================
 * Każdy stepper w grze liczył opór jako `v *= (1 - k*dt)` - przybliżenie
 * Eulera w przód, poprawne tylko w granicy małego dt (i to jest właśnie
 * powód, dla którego KAŻDY stepper miał osobny clamp dt<=0.05 - przy
 * większym kroku `1 - k*dt` potrafi zejść poniżej zera i tłumienie
 * ODWRACA ZNAK zamiast gasnąć). Prawdziwe równanie różniczkowe czystego
 * oporu `dv/dt = -k*v` ma DOKŁADNE rozwiązanie `v(t) = v0*exp(-k*t)` -
 * `krokTlumienia(k, dt)` liczy dokładny czynnik na krok zamiast przybliżenia,
 * WIĘC JEST STABILNE dla dowolnego dt>=0 (nigdy nie zmienia znaku prędkości).
 *
 * Drugi zwracany składnik `s` to całka pozycji przy tej prędkości w tym
 * kroku: `x(dt) - x(0) = v0*(1-exp(-k*dt))/k` (dokładnie ta sama całka,
 * której używa fala.js:polozenieCzola() jako formy zamkniętej na CAŁY
 * lot cząstki). Konwencja w każdym stepperze: najpierw przyspieszenia
 * (siły wymuszone - wyporność, turbulencja, pole przepływu), POTEM
 * `x += v*s`, POTEM `v *= e` - dokładne dla czystego oporu, przybliżenie
 * dla części wymuszonej (semi-implicit Euler na sile, dokładne na tłumieniu).
 *
 * @param {number} k   1/s - współczynnik oporu (OPOR_* w każdym module)
 * @param {number} dt  s - krok tego wywołania
 * @returns {{e:number, s:number}}  e = mnożnik prędkości (exp(-k*dt)),
 *   s = efektywny czas dla całkowania pozycji ((1-e)/k, lub dt gdy k≈0)
 */
export function krokTlumienia(k, dt) {
    const kk = Number.isFinite(k) ? k : 0;
    const t = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (t <= 0) return { e: 1, s: 0 };
    if (Math.abs(kk) < 1e-9) return { e: 1, s: t };   // brak oporu - ruch jednostajny, granica k->0 w (1-e)/k
    const e = Math.exp(-kk * t);
    return { e, s: (1 - e) / kk };
}

/**
 * Obwiednia alfy cząstki: szybki narost (p*6 do sin szczytu), powolne
 * kwadratowe wygaszanie. SKOPIOWANA VERBATIM w iskry.js:220, fala.js:599,
 * ogien.js:203, kolowrot.js:414 - jeden wzór, cztery miejsca. Tu jedno
 * źródło prawdy; cztery moduły importują zamiast powtarzać wyrażenie.
 *
 * @param {number} p  0..1 (wiek/życie cząstki)
 * @returns {number} 0..1
 */
export function obwiedniaCzastki(p) {
    const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
    return Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * (1 - t) * (1 - t);
}

/**
 * Sprite wypalony RAZ: gradient promieniowy barwa->przezroczyste, ten sam
 * wzorzec co iskry.js/ogien.js/fala.js `sprite()`/`zrobSprites()`, tu
 * wydzielony, żeby runa.js (jedyny moduł, który dotąd liczył gradient PER
 * CZĄSTKA PER KLATKĘ - _rysujIskry) mógł skorzystać z tego samego wzorca
 * bez duplikowania kodu tworzenia płótna.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} px  rozmiar kwadratowego sprite'a
 * @param {number} [alfaSrodek]  alfa przystanku 35% gradientu (0..1) - "miękkość" rdzenia
 * @returns {HTMLCanvasElement}
 */
export function spriteRadialny(r, g, b, px, alfaSrodek = 0.5) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    grd.addColorStop(0.0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.35, `rgba(${r},${g},${b},${alfaSrodek})`);
    grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, px, px);
    return c;
}
