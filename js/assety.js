/**
 * Ładowarka assetów zewnętrznych (CC0, Kenney Particle Pack - patrz
 * assets/czastki/LICENSE.txt) - jedyne miejsce w grze, które dotyka
 * `new Image()`.
 *
 * RÓŻNICA WZGLĘDEM KAŻDEGO INNEGO MODUŁU EFEKTÓW: ogien.js/fala.js/iskry.js
 * wypalają sprite SYNCHRONICZNIE przy pierwszym rysowaniu (gradient liczony
 * w locie, więc "istnieje" natychmiast). Obrazek z dysku ładuje się
 * ASYNCHRONICZNIE - jest okno czasu (od startu gry do zakończenia
 * pobierania), w którym obrazu jeszcze nie ma. GEMINI.md §2 (nic nigdy nie
 * mówi źle): brak assetu w tym oknie NIE JEST błędem - obraz() zwraca
 * null, a wywołujący (kolowrot.js) po prostu nie rysuje tej warstwy w tej
 * klatce. Combo dalej gra dźwiękiem, błyskiem aktywacji i zapłonem
 * sylwetki - gracz nie widzi wyjątku, co najwyżej (na wolnym łączu) combo
 * bez jednej warstwy przez pierwsze kilka klatek.
 *
 * Import tego pliku NIE DOTYKA document na poziomie modułu - inaczej
 * tools/test-assety.mjs (Node, brak DOM) wybuchłoby na starcie. Ładowanie
 * zaczyna się dopiero w zaladuj(), wołanym raz z main.js.
 */

export const MANIFEST = {
    pierscienZewnetrzny: 'assets/czastki/magic_01.png',
    pierscienWewnetrzny: 'assets/czastki/magic_02.png',
    mgla: ['assets/czastki/smoke_01.png', 'assets/czastki/smoke_05.png',
           'assets/czastki/smoke_08.png', 'assets/czastki/smoke_10.png'],
    drobina: ['assets/czastki/star_02.png', 'assets/czastki/star_04.png',
              'assets/czastki/star_07.png'],
    rozblysk: 'assets/czastki/light_01.png',
    // Okadzenie (2026-09-11): rdzeń wybuchu podpalonego kłębu dymu.
    plomien: ['assets/czastki/flame_01.png', 'assets/czastki/flame_02.png',
              'assets/czastki/flame_03.png', 'assets/czastki/flame_04.png',
              'assets/czastki/flame_05.png', 'assets/czastki/flame_06.png'],
    ogienRdzen: ['assets/czastki/fire_01.png', 'assets/czastki/fire_02.png'],
    rozblyskUderzenia: ['assets/czastki/scorch_01.png', 'assets/czastki/scorch_02.png',
                         'assets/czastki/scorch_03.png'],
    // Aard v2 (2026-09-14): smugi wiatru na czole fali (miękkie półksiężyce
    // zamachu - 01/02 z ogonem, 04 szeroka wstęga; 03 pominięta, bo to
    // cienka ostra szabla i czyta się jak cięcie, nie jak podmuch) i wir
    // w dłoni w chwili rzutu (otwarty zawijas C).
    smugaWiatru: ['assets/czastki/slash_01.png', 'assets/czastki/slash_02.png',
                  'assets/czastki/slash_04.png'],
    wir: 'assets/czastki/twirl_01.png',
    // Proste combo (2026-10-02, docs/superpowers/specs/2026-10-02-proste-
    // -kombosy-design.md). dirt_* to JEDYNA prawdziwa faktura ziemi w paczce -
    // Weles dotad nie mial zadnej (Kamienna Tarcza, Kurzawa). spark_* to NIE
    // iskry, tylko rozgalezione pekniecia elektryczne - patrz spec 2026-09-09-assety.
    odlamek: ['assets/czastki/dirt_01.png', 'assets/czastki/dirt_02.png', 'assets/czastki/dirt_03.png'],
    wyladowanie: ['assets/czastki/spark_01.png', 'assets/czastki/spark_02.png', 'assets/czastki/spark_03.png'],
    // Kręgi Mokoszy (2026-10-03): circle_03 to podwójny pierścień (jasna poświata
    // na zewnątrz, ciemniejszy środek) - główny krąg fali; circle_01 to miękki
    // dysk - błyskawiczny dysk uderzeniowy przy narodzinach kręgu; trace_01/07
    // to proste świetliste smugi - promienie rozbiegające się z kręgiem.
    kragFali: 'assets/czastki/circle_03.png',
    dyskUderzenia: 'assets/czastki/circle_01.png',
    promien: ['assets/czastki/trace_01.png', 'assets/czastki/trace_07.png']
};

const _obrazy = new Map();   // ścieżka -> HTMLImageElement, WPISYWANY dopiero po onload
let _zaladowane = false;
let _promise = null;

function _wszystkieSciezki() {
    const s = [];
    for (const v of Object.values(MANIFEST)) {
        if (Array.isArray(v)) s.push(...v); else s.push(v);
    }
    return s;
}

function _zaladujJeden(sciezka) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { _obrazy.set(sciezka, img); resolve(); };
        // BŁĄD ŁADOWANIA NIE JEST WYJĄTKIEM (GEMINI.md §2) - resolve(), nie
        // reject(). Ścieżka po prostu zostaje bez wpisu w _obrazy, więc
        // obraz() zwróci null tak samo jak "jeszcze się ładuje".
        img.onerror = () => resolve();
        img.src = sciezka;
    });
}

/**
 * Startuje ładowanie WSZYSTKICH plików z manifestu. Idempotentne - drugie
 * wywołanie (np. z hot-restartu gry) zwraca tę samą obietnicę, nie
 * uruchamia drugiego kompletu żądań sieciowych.
 */
export function zaladuj() {
    if (_promise) return _promise;
    _promise = Promise.all(_wszystkieSciezki().map(_zaladujJeden)).then(() => { _zaladowane = true; });
    return _promise;
}

/** Czy WSZYSTKIE pliki z manifestu zdążyły się załadować (próba nieudana też się liczy jako "zakończona"). */
export function gotowe() { return _zaladowane; }

/**
 * @param {string} sciezka  jedna z wartości MANIFEST (albo element tablicy wariantów)
 * @returns {HTMLImageElement|null}  null, gdy jeszcze nie załadowany albo nieprawidłowa ścieżka
 */
export function obraz(sciezka) {
    return _obrazy.get(sciezka) ?? null;
}

/**
 * Losowy WŚRÓD JUŻ ZAŁADOWANYCH wariantów z tablicy (np. MANIFEST.mgla).
 * Null tylko gdy ŻADEN wariant jeszcze nie gotowy - wywołujący nie musi
 * czekać na komplet, byle jeden był gotowy.
 */
export function losowyWariant(sciezki) {
    if (!Array.isArray(sciezki) || !sciezki.length) return null;
    const dostepne = sciezki.filter(s => _obrazy.has(s));
    if (!dostepne.length) return null;
    return obraz(dostepne[Math.floor(Math.random() * dostepne.length)]);
}

const _tintCache = new Map();   // "src|r,g,b|px" -> canvas

/**
 * Tintuje obraz jedną barwą przez 'source-in' (wzorzec z aura.js:202/236/256
 * i zaplon.js:137/156/173) i CACHE'UJE wynik - budowa tintowanego sprite'a
 * na cząstkę na klatkę zabiłaby FPS, ten sam powód co wszędzie indziej
 * w repo (ogien.js/fala.js/iskry.js wypalają swoje sprite'y raz).
 *
 * @param {HTMLImageElement} img
 * @param {[number,number,number]} barwa
 * @param {number} px  docelowy rozmiar kwadratowego sprite'a (źródło to 512px - dużo więcej niż potrzeba)
 * @returns {HTMLCanvasElement}
 */
export function wypalTintowany(img, barwa, px) {
    const [r, g, b] = barwa;
    const klucz = `${img.src}|${r},${g},${b}|${px}`;
    let c = _tintCache.get(klucz);
    if (c) return c;

    c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, px, px);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, px, px);
    _tintCache.set(klucz, c);
    return c;
}

/**
 * Czyści cache tintowanych sprite'ów. Zmiana barwy (np. suwak NASTAWY.BARWA_*
 * na tools/scena.html) i tak trafia pod NOWY klucz cache'a (barwa jest
 * częścią klucza), więc to NIE jest wymagane do poprawności - jest tu,
 * żeby stanowisko VFX mogło zwolnić pamięć po serii eksperymentów z barwą,
 * zamiast bez końca dopisywać do Mapy.
 */
export function wyczyscCache() { _tintCache.clear(); }
