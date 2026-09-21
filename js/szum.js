/**
 * Szum proceduralny - generator liczb pseudolosowych z ziarnem (mulberry32),
 * pole szumu 2D/3D (gradient noise a'la Perlin, własna implementacja bez
 * zależności) i curl noise (rotacja pola szumu przez różnice skończone -
 * bezdywergencyjne, więc nie ma źródeł/ujść, tylko wirowanie).
 *
 * Po co własny generator zamiast biblioteki: cała gra jest bez bundlera i
 * bez zależności (poza smoke.js w js/vendor/) - jeden plik ES module, zero
 * npm install. Determinizm jest tu WYMAGANY (nie tylko miły) - stanowisko
 * VFX (tools/scena.html) potrzebuje tej samej klatki dla tego samego ziarna,
 * żeby zrzuty ekranu dało się porównywać.
 *
 * KONWENCJA NaN: każda funkcja na złych danych wejściowych zwraca 0 (GEMINI
 * §4 - jedna klatka z NaN z trackera nie może wywalić pętli gry).
 */

// ================== PRNG: mulberry32 ==================
// Deterministyczny, szybki, wystarczająco dobry rozkład na potrzeby VFX
// (nie kryptografia). Zwraca funkcję generatora (domknięcie na stanie).

/**
 * @param {number} ziarno liczba całkowita (dowolna, będzie wymuszona na >>>0)
 * @returns {() => number} generator zwracający kolejne liczby w [0, 1)
 */
export function mulberry32(ziarno) {
    let a = (Number.isFinite(ziarno) ? ziarno : 0) >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ================== Pole szumu: permutacja zasiewana ziarnem ==================
// Tablica permutacji 0..255 potasowana generatorem mulberry32(ziarno) -
// Fisher-Yates. Domyślne ziarno przy starcie modułu (import) też jest stałe,
// więc gra bez wywołania ustawZiarnoSzumu() nadal jest deterministyczna
// klatka-po-klatce (tylko nie odtwarzalna między uruchomieniami inaczej niż
// przez to samo ziarno).

let _perm = nowaPermutacja(1);
let _grad2 = noweGradienty2D(1);

function nowaPermutacja(ziarno) {
    const rnd = mulberry32(ziarno);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    // Podwojona (512), żeby indeksowanie (a+b) & 511 nie zawijało się źle.
    const pp = new Uint8Array(512);
    for (let i = 0; i < 512; i++) pp[i] = p[i & 255];
    return pp;
}

function noweGradienty2D(ziarno) {
    // 12 kierunków jednostkowych na okręgu, po jednym na wartość permutacji
    // mod 12 - klasyczna sztuczka Perlina, tu z własnym generatorem kątów.
    const rnd = mulberry32(ziarno ^ 0x9e3779b9);
    const g = new Float32Array(24);
    for (let i = 0; i < 12; i++) {
        const kat = rnd() * Math.PI * 2;
        g[i * 2] = Math.cos(kat);
        g[i * 2 + 1] = Math.sin(kat);
    }
    return g;
}

/**
 * Ustawia globalne ziarno pola szumu - simplex2/simplex3/fbm2/curl2 zaczną
 * zwracać inną, ale nadal deterministyczną sekwencję. Wołać RAZ na starcie
 * (main.js) albo na starcie stanowiska (tools/scena.html?seed=N), nie co
 * klatkę - przebudowa permutacji nie jest darmowa.
 * @param {number} ziarno
 */
export function ustawZiarnoSzumu(ziarno) {
    const z = Number.isFinite(ziarno) ? ziarno : 1;
    _perm = nowaPermutacja(z);
    _grad2 = noweGradienty2D(z);
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad2(hash, x, y) {
    const i = (hash % 12) * 2;
    return _grad2[i] * x + _grad2[i + 1] * y;
}

/**
 * Gradient noise 2D (a'la Perlin), zakres ok. [-1, 1] (nie ściśle
 * matematycznie ograniczony, ale w praktyce dla siatki 12 gradientów mieści
 * się z dużym zapasem - potwierdzone testem na próbkach).
 */
export function simplex2(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const p = _perm;
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 1.4142135623730951; // normalizacja do ~[-1,1]
}

function grad3(hash, x, y, z) {
    // 12 krawędzi sześcianu - standardowy zestaw gradientów 3D Perlina.
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * Gradient noise 3D, zakres ok. [-1, 1].
 */
export function simplex3(x, y, z) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 0;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z);
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const p = _perm;
    const a = p[X] + Y, aa = p[a] + Z, ab = p[a + 1] + Z;
    const b = p[X + 1] + Y, ba = p[b] + Z, bb = p[b + 1] + Z;
    const x1 = lerp(grad3(p[aa], xf, yf, zf), grad3(p[ba], xf - 1, yf, zf), u);
    const x2 = lerp(grad3(p[ab], xf, yf - 1, zf), grad3(p[bb], xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);
    const x3 = lerp(grad3(p[aa + 1], xf, yf, zf - 1), grad3(p[ba + 1], xf - 1, yf, zf - 1), u);
    const x4 = lerp(grad3(p[ab + 1], xf, yf - 1, zf - 1), grad3(p[bb + 1], xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);
    return lerp(y1, y2, w);
}

/**
 * Fractional Brownian Motion - suma oktaw simplex2 o malejącej amplitudzie
 * i rosnącej częstotliwości. Bardziej "organiczny" szum niż pojedyncza
 * oktawa, kosztem oktawy razy więcej wywołań simplex2.
 * @param {number} oktawy liczba warstw (domyślnie 3)
 * @param {number} lakunarnosc mnożnik częstotliwości między oktawami
 * @param {number} trwalosc mnożnik amplitudy między oktawami
 */
export function fbm2(x, y, oktawy = 3, lakunarnosc = 2, trwalosc = 0.5) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const n = Number.isFinite(oktawy) && oktawy > 0 ? Math.floor(oktawy) : 3;
    let suma = 0, amplituda = 1, czestotliwosc = 1, maxAmp = 0;
    for (let i = 0; i < n; i++) {
        suma += simplex2(x * czestotliwosc, y * czestotliwosc) * amplituda;
        maxAmp += amplituda;
        amplituda *= trwalosc;
        czestotliwosc *= lakunarnosc;
    }
    return maxAmp > 0 ? suma / maxAmp : 0;
}

/**
 * Curl noise 2D - rotacja pola skalarnego (domyślnie simplex2) przez różnice
 * skończone: curl(n) = (dn/dy, -dn/dx). Bezdywergencyjne (divergence-free) -
 * cząstki płyną WOKÓŁ źródeł zamiast z nich wytryskiwać/w nie wsysać, co daje
 * organiczny, "dymny" ruch bez sztucznych zagęszczeń.
 * @param {number} eps krok różnicy skończonej (mniejszy = dokładniej, ale bliżej szumu numerycznego)
 * @param {(x:number,y:number)=>number} pole pole skalarne do zwirowania (domyślnie simplex2)
 * @returns {{x:number, y:number}}
 */
export function curl2(x, y, eps = 1e-3, pole = simplex2) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    const e = Number.isFinite(eps) && eps > 0 ? eps : 1e-3;
    const n1 = pole(x, y + e), n2 = pole(x, y - e);
    const n3 = pole(x + e, y), n4 = pole(x - e, y);
    return {
        x: (n1 - n2) / (2 * e),
        y: -(n3 - n4) / (2 * e),
    };
}
