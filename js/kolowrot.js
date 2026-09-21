/**
 * Kołowrót - nagroda za combo `perun -> weles -> mokosz`. Pierwszy efekt
 * w grze zbudowany na GOTOWYCH TEKSTURACH (Kenney Particle Pack, CC0 -
 * patrz assets/czastki/LICENSE.txt) zamiast wyłącznie na wypalanych
 * gradientach radialnych, których używa reszta gry (ogien.js/fala.js/
 * iskry.js). Dwa przeciwbieżne kręgi run (magic_01/magic_02) rosną WOKÓŁ
 * TUŁOWIA tancerza, od pasa aż nad głowę, z kolumną PRAWDZIWEJ,
 * teksturowanej mgły (smoke_*) i spiralnie lecącymi w górę iskierkami
 * (star_*).
 *
 * MITOLOGIA: Grom w Ziemię (js/kombosy.js) to Perun uderzający w Welesa -
 * centralny konflikt słowiańskiej mitologii. Kołowrót to ten sam konflikt
 * DOMKNIĘTY: piorun uderzył w ziemię, Mokosz (prządka losu) zamyka krąg
 * wodą i koło toczy się dalej. Stąd dwa przeciwbieżne pierścienie i
 * rozbłysk w chwili "domknięcia się" koła (patrz obwiednia().rozblysk).
 *
 * ================== NAPRAWA: ZACZEP PRZENIESIONY Z ZIEMI NA TUŁÓW ==================
 * PIERWSZA WERSJA kotwiła krąg na "ziemi" (pekniecieZiemi() z iskry.js,
 * Y = H*0.86) i rysowała go jako spłaszczony dysk leżący płasko. Zgłoszenie
 * gracza: "na ekranie rzadko widać podłogę, w ogóle stopy nie są widoczne
 * (...) widzę chyba tylko końcowy etap okręgów". Dokładnie ten sam problem,
 * który GEMINI.md/efekty.js (srodekDloni)/iskry.js (pekniecieZiemi) już
 * DWUKROTNIE odnotowują dla stóp/bioder - kamera laptopa na typowym
 * dystansie tańca po prostu nie mieści podłogi w kadrze. Y=H*0.86 leżał
 * tuż przy dolnej krawędzi albo POZA nią, więc krąg był w większości poza
 * kadrem - gracz widział wyłącznie górny łuk już dużego, gasnącego
 * pierścienia, stąd "tylko końcowy etap".
 *
 * NAPRAWA: `kregSylwetki()` niżej kotwiczy krąg na ŚRODKU BARKÓW (landmarki
 * 11/12 z `pose.landmarks`) - ta sama para punktów, którą znaki/postawa.js
 * już używa jako `skalaCiala` (jedyna miara ciała w całej grze, o której
 * GEMINI.md wprost mówi "nigdy bioder - kamera laptopa ich nie mieści").
 * Krąg ROŚNIE wokół tego punktu do średnicy WIELOKROTNOŚCI szerokości
 * barków, więc naturalnie rozciąga się od pasa (poniżej barków) aż nad
 * głowę (powyżej barków) - bez znajomości rzeczywistej pozycji pasa/głowy,
 * z samych proporcji ciała. PIERSCIEN_SQUASH poszedł z 0.30 (płaski dysk
 * na ziemi) do 0.88 (niemal koło) - to już nie leżący dekal, tylko stojący,
 * obrócony ku kamerze krąg, jak mandala otaczająca tancerza.
 *
 * Wszystkie rozmiary/promienie (pierścienie, start mgły/drobin, prędkość
 * wznoszenia) są teraz MNOŻNIKAMI `skala` (szerokość barków w pikselach),
 * nie stałymi w px ani ułamkami W - dzięki temu efekt ma ten sam
 * WZGLĘDNY rozmiar niezależnie od tego, jak blisko/daleko kamery stoi
 * gracz, dokładnie jak reszta gry mierzy przez skalę barków.
 *
 * ================== DWA ZEGARY, NIE JEDEN ==================
 * Pierścienie/rozbłysk mają WŁASNY zegar (CZAS_TRWANIA_PIERSCIEN, napędza
 * obwiednia()) - kręgi mają się wyraźnie DOMKNĄĆ, nie dogasać bez końca.
 * Mgła i drobiny są PRAWDZIWYM UKŁADEM CZĄSTECZEK (mirror fizyki iskry.js:
 * składowa STYCZNA + PROMIENIOWA z RÓŻNYM tłumieniem, plus stały ciąg
 * w górę) z WŁASNYM `wiek`/`zycie` na cząstkę - NIEZALEŻNYM od zegara
 * pierścieni. `aktywny` gaśnie dopiero, gdy OBA zegary się skończyły.
 *
 * ICH WZGLĘDNA DŁUGOŚĆ NIE JEST ZAGWARANTOWANA W KODZIE, tylko dobierana
 * ręcznie przy strojeniu - test-kolowrot.mjs sprawdza FAKTYCZNY stan przy
 * zamknięciu pierścieni, nie zakłada z góry, która warstwa gaśnie pierwsza.
 * PRZY DOMYŚLNYCH STAŁYCH (2026-09-09: CZAS_TRWANIA_PIERSCIEN=4.4s i
 * MGLA/DROBINY_ZYCIE/OPOZNIENIE_MAX x2 na żądanie, RAZEM - pierwsze
 * podwojenie samych pierścieni zostawiło cząstki gasnące PRZED
 * zamknięciem, bo tylko zegar pierścieni urósł) maksymalny czas życia
 * pojedynczej cząstki (opóźnienie+życie) to ~7,4 s (mgła) / ~7,6 s
 * (drobiny) - z powrotem DŁUŻSZY niż zegar pierścieni (4,4 s), więc
 * mgła/iskry znów dogasają PO zamknięciu kręgów, w tej samej proporcji co
 * przed podwojeniem. Kolejna zmiana CZAS_TRWANIA_PIERSCIEN bez
 * proporcjonalnej zmiany tych stałych znów rozjedzie tę relację.
 *
 * ================== OPÓŹNIONY START CZĄSTKI ==================
 * Żeby kolumna mgły/iskier wyglądała na CIĄGŁĄ emisję zamiast jednego
 * wybuchu w t=0 (`wystrzel()` w iskry.js/fala.js rodzi wszystko naraz),
 * każda cząstka dostaje `wiek` startujący UJEMNIE (= -opóźnienie).
 * `_ruszaj()` dolicza dt do wieku jak zawsze; cząstka jest "żywa" wizualnie
 * i fizycznie dopiero gdy `wiek >= 0`, martwa gdy `wiek >= zycie`. Jeden
 * mechanizm (wiek/zycie), zero nowych pojęć.
 *
 * ================== ODPORNOŚĆ NA BRAK ASSETÓW ==================
 * GEMINI.md §2: brak assetu NIE JEST błędem. Jeśli obraz(sciezka) zwróci
 * null (jeszcze się ładuje / zawiódł fetch), dana cząstka/pierścień/
 * rozbłysk PO PROSTU NIE JEST RYSOWANY w tej klatce - fizyka i tak się
 * liczy, więc gdy obraz doładuje się kilka klatek później, cząstka
 * pojawi się we właściwym miejscu, nie skacze.
 */
import { MANIFEST, obraz, wypalTintowany, wyczyscCache as wyczyscCacheAssetow } from './assety.js';
import { krokTlumienia, obwiedniaCzastki } from './czastki.js';

// x2 (2026-09-09, na żądanie po teście na żywo). Obwiednia() liczy we
// FRAKCJACH p=t/CZAS_TRWANIA_PIERSCIEN, więc kształt narostu/gaśnięcia
// pierścienia skaluje się automatycznie - nic więcej nie trzeba dotykać.
// Eksportowana (nie tylko `const`), żeby tools/test-kolowrot.mjs liczyło
// punkty czasowe testów Z TEJ SAMEJ stałej, zamiast duplikować magiczną
// liczbę, która przy następnym strojeniu cichaczem rozjedzie się z kodem -
// dokładnie to się stało przy poprzednim strojeniu (test sprawdzał stan
// przy zaszytym na sztywno "2.25 s = tuż po zamknięciu", co przestało być
// prawdą, gdy CZAS_TRWANIA_PIERSCIEN urosło do 4.4 s).
export const CZAS_TRWANIA_PIERSCIEN = 4.4;   // s - kręgi mają się WYRAŹNIE domknąć

/**
 * Nastawy strojeniowe PRYWATNE (fizyka/emisja mgły i drobin, geometria
 * pierścieni) - eksportowane i MUTOWALNE dla tools/scena.html. Stałe, które
 * test-kolowrot.mjs liczy jako WSPÓLNE ŹRÓDŁO PRAWDY z kodem
 * (CZAS_TRWANIA_PIERSCIEN, *_OPOZNIENIE_MAX) oraz barwy zostają zwykłymi
 * `export const` - patrz komentarze przy nich wyżej/niżej.
 */
export const NASTAWY = {
    // Domyślna szerokość barków w pikselach, gdy poza nie ma (pose.landmarks
    // puste) - użyta zarówno przez kregSylwetki() (zaczep) jak i przez
    // wywołującego jako fallback skali. Rząd wielkości typowego kadru 1920px.
    SKALA_DOMYSLNA_PX: 230,
};

/**
 * Zaczep i skala Kołowrotu: ŚRODEK BARKÓW, NIE ziemia - patrz nagłówek
 * pliku ("NAPRAWA"). Ten sam punkt odniesienia co znaki/postawa.js
 * (`skalaCiala`), tu liczony wprost z `pose.landmarks` (2D, do rysowania -
 * zgodnie z konwencją GEMINI.md: landmarks tylko do rysowania, worldLandmarks
 * do pomiarów; tu rysujemy, więc landmarks jest właściwym źródłem).
 *
 * @param {object} frame  kontrakt klatki (frame.pose.landmarks, width, height)
 * @param {number} W  szerokość płótna w px
 * @param {number} H  wysokość płótna w px
 * @returns {{x:number, y:number, skala:number}}  skala = szerokość barków w PIKSELACH
 */
export function kregSylwetki(frame, W, H) {
    const lm = frame?.pose?.landmarks;
    if (lm && lm[11] && lm[12]
            && Number.isFinite(lm[11].x) && Number.isFinite(lm[11].y)
            && Number.isFinite(lm[12].x) && Number.isFinite(lm[12].y)) {
        const dx = (lm[11].x - lm[12].x) * W;
        const dy = (lm[11].y - lm[12].y) * H;
        return {
            x: ((lm[11].x + lm[12].x) / 2) * W,
            y: ((lm[11].y + lm[12].y) / 2) * H,
            skala: Math.hypot(dx, dy)
        };
    }
    // Fallback bez pozy - ten sam domyślny punkt co efekty.js srodekDloni
    // (wysokość klatki piersiowej), nie środek ekranu.
    return { x: W * 0.5, y: H * 0.45, skala: (Number.isFinite(W) ? W * 0.12 : NASTAWY.SKALA_DOMYSLNA_PX) };
}

// --- Pierścienie: MNOŻNIKI skali barków (rysowane, nie symulowane) ---
// x3 (2026-09-09, na żądanie po teście na żywo - pierwsza wersja po
// naprawie zaczepu była wciąż za mała).
Object.assign(NASTAWY, {
    PIERSCIEN_MNOZNIK_ZEWNETRZNY: 7.8,   // skala * to = docelowa średnica - sięga od pasa nad głowę
    PIERSCIEN_MNOZNIK_WEWNETRZNY: 4.65,
    PIERSCIEN_SQUASH: 0.88,              // niemal koło - krąg STOJĄCY wokół ciała, nie leżący na ziemi
    PIERSCIEN_PREDKOSC_ZEWNETRZNY: 0.55,    // rad/s
    PIERSCIEN_PREDKOSC_WEWNETRZNY: -0.95,   // rad/s, PRZECIWNY kierunek - czyta się jako mechanizm
    ROZBLYSK_MNOZNIK: 4.4,               // skala * to = docelowa średnica rozbłysku - x2 (2026-09-09)

    // --- Mgła: MNOŻNIKI skali barków, mirror iskry.js/fala.js w reszcie fizyki ---
    MGLA_LICZBA: 16,
    MGLA_PROMIEN_START_MNOZNIK: 0.22,         // skala * to = promień startowy
    MGLA_PREDKOSC_WZNOSZENIA_MNOZNIK: 0.55,   // skala * to = px/s w górę
    MGLA_DRYF_BOK_MNOZNIK: 0.06,              // skala * to = px/s losowy dryf w bok
    // x2 (2026-09-09, razem z CZAS_TRWANIA_PIERSCIEN) - ten sam mnożnik na
    // wszystkie stałe czasowe cząstek, żeby zachować DOKŁADNIE tę samą
    // proporcję "mgła/iskry dogasają PO zamknięciu pierścieni", jaką miały
    // przed podwojeniem (patrz komentarz "DWA ZEGARY" wyżej).
    MGLA_ZYCIE_MIN: 2.2, MGLA_ZYCIE_MAX: 3.8,
    MGLA_ROZMIAR_OD_MNOZNIK: 1.10, MGLA_ROZMIAR_DO_MNOZNIK: 2.6,   // skala * to = rozmiar sprite'a, rośnie z wiekiem - x2 (2026-09-09)
});
// Eksportowane (nie tylko `const`) - test-kolowrot.mjs próbkuje "część
// cząstek już żyje, część jeszcze nie" PROPORCJONALNIE do tej stałej,
// zamiast w stałym punkcie czasu. Sztywny punkt czasu (np. "0,5 s") stał
// się statystycznie niepewny (~10% szans na fałszywy alarm), gdy to okno
// urosło x2 razem z resztą stałych czasowych.
export const MGLA_OPOZNIENIE_MAX = 3.6;       // s - rozłożone starty, żeby kolumna wyglądała na ciągłą

// --- Drobiny: MNOŻNIKI skali barków, mirror iskry.js (styczna+promieniowa) ---
Object.assign(NASTAWY, {
    DROBINY_LICZBA: 70,
    DROBINY_PROMIEN_START_MNOZNIK: 0.10,         // skala * to = promień startowy
    DROBINY_PREDKOSC_STYCZNA_MNOZNIK: 0.9,       // skala * to = px/s
    DROBINY_PREDKOSC_PROMIENIOWA_MNOZNIK: 0.15,  // skala * to = px/s - słaby, mają spiralnie WSTAWAĆ
    DROBINY_OPOR_STYCZNY: 0.55,             // 1/s, WOLNO gasnący wir (iskry.js: 3.2) - ma się długo kręcić
    DROBINY_OPOR_PROMIENIOWY: 0.25,
    DROBINY_WZNOSZENIE_MNOZNIK: 1.0,             // skala * to = px/s^2 w górę - to KOLUMNA, ma dolecieć nad głowę
    DROBINY_ZYCIE_MIN: 2.8, DROBINY_ZYCIE_MAX: 5.2,   // x2 (2026-09-09) - patrz komentarz przy MGLA_ZYCIE_MIN
    DROBINY_ROZMIAR_OD_MNOZNIK: 0.10, DROBINY_ROZMIAR_DO_MNOZNIK: 0.20,   // skala * to = rozmiar sprite'a - x2 (2026-09-09)
});
export const DROBINY_OPOZNIENIE_MAX = 2.4;    // s - x2 (2026-09-09) - eksportowana, patrz komentarz przy MGLA_OPOZNIENIE_MAX

// --- Barwy: ciepłe złoto (pierścienie/rozbłysk) na zimnej turkusowej mgle/
// iskierkach (Mokosz-adjacent, ale WYRAŹNIE odróżnialne od jej azurowego
// błękitu (efekty.js mokosz: 200°) i od mięty Aarda (main.js BARWA_ZAPLONU.
// aard: [140,235,195]) - kontrast ciepłe/zimne jest tym, czego żadna inna
// technika w grze nie robi, więc Kołowrót nie zlewa się z niczym istniejącym.
export const BARWA_PIERSCIEN = [225, 185, 95];
export const BARWA_MGLA = [70, 205, 195];
export const BARWA_DROBINY = [120, 235, 220];
export const BARWA_ROZBLYSK = [255, 235, 180];

/**
 * Obwiednia DWÓCH warstw obrazkowych (pierścienie, rozbłysk domknięcia) -
 * czysta funkcja, testowalna bez document, ten sam wzorzec co obwiednia()
 * w zaplon.js i stanPioruna() w piorun.js. Mgła/drobiny mają WŁASNĄ
 * obwiednię per-cząstka (patrz _ruszaj) - nie są tu, bo nie są jedną
 * warstwą tylko układem cząstek.
 *
 * @param {number} p  0..1 (t / CZAS_TRWANIA_PIERSCIEN)
 * @returns {{pierscien:number, rozblysk:number}}
 */
export function obwiednia(p) {
    const t = Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 1;

    // Szybki narost (10%), trzyma do 82%, gasi w ostatnich 18%.
    const pierscienIn = Math.min(1, t / 0.10);
    const pierscienOut = t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1;
    const pierscien = pierscienIn * pierscienOut;

    // Krótki impuls TUŻ PRZED końcem pierścienia - moment "domknięcia się"
    // koła, szczyt przy p≈0.80.
    const rozblysk = Math.max(0, 1 - Math.abs(t - 0.80) / 0.08);

    return { pierscien, rozblysk };
}

export class Kolowrot {
    constructor() {
        this._t = 0;
        this._trwa = false;
        this._sila = 0;
        this._zaczep = { x: 0, y: 0 };
        this._skala = NASTAWY.SKALA_DOMYSLNA_PX;
        this._mgla = [];
        this._drobiny = [];
    }

    get aktywny() { return this._trwa; }

    /**
     * Sprite'y kołowrotu są tintowane w assety.js (wypalTintowany), kluczowane
     * m.in. barwą - zmiana NASTAWY nie robi ich nieaktualnymi (nowa barwa =
     * nowy klucz), ale czyści Mapę po serii eksperymentów na stanowisku.
     */
    wyczyscCache() { wyczyscCacheAssetow(); }

    /**
     * @param {{x,y}} zaczep  źródło pierścieni/drobin w PIKSELACH płótna (np. kregSylwetki())
     * @param {number} skala  szerokość barków w PIKSELACH (np. kregSylwetki().skala) - jednostka rozmiaru całego efektu
     * @param {number} wysokoscEkranu  wysokość płótna w PIKSELACH (canvas.height) - TYLKO żeby mgła wiedziała, gdzie jest "dół ekranu"
     * @param {number} [sila]  0..1
     */
    zapal(zaczep, skala, wysokoscEkranu, sila = 1) {
        const s = Number.isFinite(sila) ? Math.max(0, Math.min(1, sila)) : 0;
        if (s <= 0.01 || !zaczep || !Number.isFinite(zaczep.x) || !Number.isFinite(zaczep.y)) return;

        const sk = Number.isFinite(skala) && skala > 1 ? skala : NASTAWY.SKALA_DOMYSLNA_PX;

        this._zaczep = { x: zaczep.x, y: zaczep.y };
        this._skala = sk;
        this._sila = s;
        this._t = 0;
        this._trwa = true;

        // MGŁA WYDOBYWA SIĘ Z DOŁU EKRANU, NIE Z CENTRUM (2026-09-09, na
        // żądanie): pierścienie/drobiny zostają zaczepione na tułowiu jak
        // dotąd, ale start mgły liczymy jako PRZESUNIĘCIE od zaczepu takie,
        // żeby wylądować blisko dolnej krawędzi płótna (H*0.98) niezależnie
        // od tego, gdzie na ekranie są akurat barki gracza. Cząstki mgły
        // przechowują pozycję jako offset od `this._zaczep` (tak samo jak
        // drobiny) - to przesunięcie jest jedyną różnicą, cała reszta
        // fizyki (_ruszaj) zostaje nietknięta. Bez poprawnej wysokoscEkranu
        // (np. stare wywołanie bez tego argumentu) offset wynosi 0 - mgła
        // wraca do starego zachowania (start przy zaczepie), nigdy wyjątku.
        const H = Number.isFinite(wysokoscEkranu) && wysokoscEkranu > 0 ? wysokoscEkranu : null;
        const mglaOffsetY = H !== null ? (H * 0.98 - zaczep.y) : 0;

        const promienMgla = sk * NASTAWY.MGLA_PROMIEN_START_MNOZNIK;
        const predkoscWznoszeniaMgla = sk * NASTAWY.MGLA_PREDKOSC_WZNOSZENIA_MNOZNIK;
        const dryfBok = sk * NASTAWY.MGLA_DRYF_BOK_MNOZNIK;

        this._mgla = [];
        const nMgla = Math.round(NASTAWY.MGLA_LICZBA * (0.4 + 0.6 * s));
        for (let i = 0; i < nMgla; i++) {
            const kat = Math.random() * Math.PI * 2;
            const opoznienie = Math.random() * MGLA_OPOZNIENIE_MAX;
            this._mgla.push({
                x: Math.cos(kat) * promienMgla,
                y: mglaOffsetY + Math.sin(kat) * promienMgla * 0.3,
                dryf: (Math.random() * 2 - 1) * dryfBok,
                wznoszenie: predkoscWznoszeniaMgla,
                zycie: NASTAWY.MGLA_ZYCIE_MIN + Math.random() * (NASTAWY.MGLA_ZYCIE_MAX - NASTAWY.MGLA_ZYCIE_MIN),
                wiek: -opoznienie,
                rozmiarOd: sk * NASTAWY.MGLA_ROZMIAR_OD_MNOZNIK,
                rozmiarDo: sk * NASTAWY.MGLA_ROZMIAR_DO_MNOZNIK,
                wariant: Math.floor(Math.random() * MANIFEST.mgla.length)
            });
        }

        const promienDrobiny = sk * NASTAWY.DROBINY_PROMIEN_START_MNOZNIK;
        const predkoscStyczna = sk * NASTAWY.DROBINY_PREDKOSC_STYCZNA_MNOZNIK;
        const predkoscPromieniowa = sk * NASTAWY.DROBINY_PREDKOSC_PROMIENIOWA_MNOZNIK;
        const wznoszenieDrobiny = sk * NASTAWY.DROBINY_WZNOSZENIE_MNOZNIK;

        // Jeden losowy kierunek wiru na CAŁY wystrzał - patrz iskry.js:
        // inaczej wiry poszczególnych cząstek znoszą się wizualnie.
        const spinSign = Math.random() < 0.5 ? -1 : 1;
        this._drobiny = [];
        const nDrobiny = Math.round(NASTAWY.DROBINY_LICZBA * (0.4 + 0.6 * s));
        for (let i = 0; i < nDrobiny; i++) {
            const kat = Math.random() * Math.PI * 2;
            const promX = Math.cos(kat), promY = Math.sin(kat);
            const stycX = -promY * spinSign, stycY = promX * spinSign;
            const vProm = predkoscPromieniowa * (0.7 + Math.random() * 0.6);
            const vStyc = predkoscStyczna * (0.7 + Math.random() * 0.6);
            const opoznienie = Math.random() * DROBINY_OPOZNIENIE_MAX;
            this._drobiny.push({
                x: promX * promienDrobiny,
                y: promY * promienDrobiny,
                vrx: promX * vProm, vry: promY * vProm,
                vtx: stycX * vStyc, vty: stycY * vStyc,
                wznoszenie: wznoszenieDrobiny,
                zycie: NASTAWY.DROBINY_ZYCIE_MIN + Math.random() * (NASTAWY.DROBINY_ZYCIE_MAX - NASTAWY.DROBINY_ZYCIE_MIN),
                wiek: -opoznienie,
                skala: sk * (NASTAWY.DROBINY_ROZMIAR_OD_MNOZNIK + Math.random() * (NASTAWY.DROBINY_ROZMIAR_DO_MNOZNIK - NASTAWY.DROBINY_ROZMIAR_OD_MNOZNIK)),
                wariant: Math.floor(Math.random() * MANIFEST.drobina.length)
            });
        }
    }

    /** Fizyka WSZYSTKICH cząstek - czysta (bez document), jak iskry.js _ruszaj(). */
    _ruszaj(dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
        if (krok <= 0) return;

        const mglaZywe = [];
        for (const c of this._mgla) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;
            if (c.wiek >= 0) {
                c.x += c.dryf * krok;
                c.y -= c.wznoszenie * krok;
            }
            if (Number.isFinite(c.x) && Number.isFinite(c.y)) mglaZywe.push(c);
        }
        this._mgla = mglaZywe;

        const drobinyZywe = [];
        for (const c of this._drobiny) {
            c.wiek += krok;
            if (c.wiek >= c.zycie) continue;
            if (c.wiek >= 0) {
                // Siła wymuszona (wznoszenie) najpierw, potem dokładna
                // całka pozycji + zanik prędkości (krokTlumienia, patrz
                // js/czastki.js) - mirror iskry.js.
                c.vry -= c.wznoszenie * krok;
                const t = krokTlumienia(NASTAWY.DROBINY_OPOR_STYCZNY, krok);
                const r = krokTlumienia(NASTAWY.DROBINY_OPOR_PROMIENIOWY, krok);
                c.x += c.vtx * t.s + c.vrx * r.s;
                c.y += c.vty * t.s + c.vry * r.s;
                c.vtx *= t.e; c.vty *= t.e;
                c.vrx *= r.e; c.vry *= r.e;
            }
            if (Number.isFinite(c.x) && Number.isFinite(c.y)) drobinyZywe.push(c);
        }
        this._drobiny = drobinyZywe;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} dt
     */
    updateAndDraw(ctx, dt) {
        if (!this._trwa) return;

        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._t += krok;
        this._ruszaj(dt);   // własny wewnętrzny clamp - patrz _ruszaj()

        // Efekt kończy się dopiero, gdy OBA zegary (pierścienie ORAZ
        // wszystkie cząstki) się skończyły - patrz nagłówek pliku.
        if (this._t >= CZAS_TRWANIA_PIERSCIEN && !this._mgla.length && !this._drobiny.length) {
            this._trwa = false;
            return;
        }
        if (!ctx) return;   // guard PO doliczeniu czasu/fizyki - patrz piorun.js/zaplon.js

        const p = Math.min(1, this._t / CZAS_TRWANIA_PIERSCIEN);
        const { pierscien, rozblysk } = obwiednia(p);
        const zx = this._zaczep.x, zy = this._zaczep.y;
        const sk = this._skala;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // --- Mgła: POD pierścieniami, żeby te leżały na wierzchu ---
        for (const c of this._mgla) {
            if (c.wiek < 0 || c.wiek >= c.zycie) continue;
            const img = obraz(MANIFEST.mgla[c.wariant]);
            if (!img) continue;   // asset jeszcze się ładuje - GEMINI.md §2, nie wyjątek
            const lp = c.wiek / c.zycie;
            const alfa = Math.sin(Math.min(1, lp * 4) * Math.PI * 0.5) * (1 - lp);
            const sprite = wypalTintowany(img, BARWA_MGLA, 200);
            const rozmiar = c.rozmiarOd + (c.rozmiarDo - c.rozmiarOd) * lp;
            ctx.globalAlpha = Math.max(0, Math.min(1, alfa * this._sila * 0.5));
            ctx.drawImage(sprite, zx + c.x - rozmiar / 2, zy + c.y - rozmiar / 2, rozmiar, rozmiar);
        }

        // --- Dwa przeciwbieżne pierścienie run ---
        if (pierscien > 0.01) {
            const katZewn = this._t * NASTAWY.PIERSCIEN_PREDKOSC_ZEWNETRZNY;
            const katWewn = this._t * NASTAWY.PIERSCIEN_PREDKOSC_WEWNETRZNY;
            const zewn = obraz(MANIFEST.pierscienZewnetrzny);
            const wewn = obraz(MANIFEST.pierscienWewnetrzny);

            if (zewn) {
                const sprite = wypalTintowany(zewn, BARWA_PIERSCIEN, 320);
                const d = sk * NASTAWY.PIERSCIEN_MNOZNIK_ZEWNETRZNY * pierscien;
                ctx.save();
                ctx.translate(zx, zy);
                ctx.scale(1, NASTAWY.PIERSCIEN_SQUASH);
                ctx.rotate(katZewn);
                ctx.globalAlpha = Math.max(0, Math.min(1, pierscien * this._sila * 0.8));
                ctx.drawImage(sprite, -d / 2, -d / 2, d, d);
                ctx.restore();
            }
            if (wewn) {
                const sprite = wypalTintowany(wewn, BARWA_PIERSCIEN, 320);
                const d = sk * NASTAWY.PIERSCIEN_MNOZNIK_WEWNETRZNY * pierscien;
                ctx.save();
                ctx.translate(zx, zy);
                ctx.scale(1, NASTAWY.PIERSCIEN_SQUASH);
                ctx.rotate(katWewn);
                ctx.globalAlpha = Math.max(0, Math.min(1, pierscien * this._sila * 0.8));
                ctx.drawImage(sprite, -d / 2, -d / 2, d, d);
                ctx.restore();
            }
        }

        // --- Spiralne drobiny ---
        for (const c of this._drobiny) {
            if (c.wiek < 0 || c.wiek >= c.zycie) continue;
            const img = obraz(MANIFEST.drobina[c.wariant]);
            if (!img) continue;
            const lp = c.wiek / c.zycie;
            const alfa = obwiedniaCzastki(lp);
            const sprite = wypalTintowany(img, BARWA_DROBINY, 64);
            ctx.globalAlpha = Math.max(0, Math.min(1, alfa * this._sila));
            ctx.drawImage(sprite, zx + c.x - c.skala / 2, zy + c.y - c.skala / 2, c.skala, c.skala);
        }

        // --- Rozbłysk domknięcia ---
        if (rozblysk > 0.01) {
            const img = obraz(MANIFEST.rozblysk);
            if (img) {
                const sprite = wypalTintowany(img, BARWA_ROZBLYSK, 320);
                const d = sk * NASTAWY.ROZBLYSK_MNOZNIK;
                ctx.globalAlpha = Math.max(0, Math.min(1, rozblysk * this._sila));
                ctx.drawImage(sprite, zx - d / 2, zy - d / 2, d, d);
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}
