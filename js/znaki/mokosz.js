/**
 * Woda - Mokosz: wilgoć, los, przędza.
 *
 * Dłonie złożone w miskę na wysokości pępka: nadgarstki stykają się bokami,
 * przedramiona poziomo, palce rozwarte w stronę kamery. Łokcie szerzej niż
 * nadgarstki - to one nadają kształt misce, nie samo obniżenie rąk.
 *
 * ================== TRZY MIARY Z POZY, JEDNA Z DŁONI ==================
 *
 * Woda jest jedyną z pięciu pieczęci, w której żaden pojedynczy warunek nie
 * rozdziela pozy od tańca - dopiero KONIUNKCJA (minimum) wszystkich czterech:
 *
 *   - GŁĘBOKOŚĆ (poza): jak nisko leżą nadgarstki nad linią barków.
 *   - MISKA (poza): łokcie szerzej niż nadgarstki - RÓŻNICA dwóch odległości,
 *     czyli w istocie DWIE miary geometrii ramion (rozstaw łokci i rozstaw
 *     nadgarstków) ściśnięte w jeden próg.
 *   - KIERUNEK PALCÓW (dłoń): czy dłonie leżą poziomo, palcami w stronę
 *     kamery, zamiast pionowo.
 *
 * ================== DLACZEGO NADGARSTKI Z POZY, A NIE Z DŁONI ==============
 *
 * Rozstaw nadgarstków (część formuły MISKI) czytany z landmarków DŁONI miałby
 * znany tryb awarii: swarogDlon.js:8-11 notuje pomiar na żywej dłoni, że
 * MediaPipe GUBI JEDNĄ DŁOŃ przy maksymalnym ścisku - a miska wymaga
 * nadgarstków blisko siebie, czyli dokładnie tego, co gubi detektor.
 * Nadgarstek POZY (15/16) nie znika, gdy dłonie się stykają.
 *
 * ================== BEZ ODDZIELNEGO PROGU STYKU NADGARSTKÓW ================
 *
 * Pierwotny projekt miał czwartą, niezależną miarę: "nadgarstki blisko
 * siebie" (STYK), czytaną wprost jak w ziemi/powietrzu. USUNIĘTA po pomiarze:
 * w tańcu nadgarstki bywają BLIŻEJ siebie niż w samej misce (landmark
 * nadgarstka siedzi w stawie, nie w dłoni, więc "styk nadgarstków" mierzył
 * coś innego niż zamierzony dotyk dłoni - ta sama klasa błędu co wysokość
 * w ziemi i rozchylenie w powietrzu, patrz ich docstringi). Rozstaw
 * nadgarstków ZOSTAJE w formule - jako część RÓŻNICY w warunku MISKA, gdzie
 * dyskryminuje poprawnie (zmierzone: zmniejsza wyciek do tańca z 37 do 14
 * klatek) - tylko bez własnego, osobnego progu, który mierzył odwrotność
 * zamierzonego kierunku.
 *
 * ================== KIERUNEK PALCÓW: SUROWY, NIE PRZYCIĘTY =================
 *
 * `dlon.js` ma gotową `skierowanaWGore()`, ale ona liczy `Math.max(0, -y)` -
 * PRZYCIĘTY sygnał, w którym każda dłoń niezwrócona w górę ląduje na tej
 * samej wartości 0. Woda potrzebuje przeciwnego kierunku (palce W DÓŁ obrazu,
 * nie w górę), a przycięcie zdegenerowałoby próg do PELNY===ZERO - dlatego
 * tu używany jest surowy `kierunekDloni(lm).y` wprost. Dodatni = palce w dół
 * obrazu; woda jest jedyną z pięciu pieczęci po DODATNIEJ stronie tej osi
 * (zmierzone mediany: woda +0.71, ogień -0.97, ziemia -0.95, powietrze
 * -0.99 - patrz progi.mjs).
 *
 * Ten warunek NIE JEST floor-blendowany jak piesci() w weles.js. Ma WŁASNY,
 * zmierzony próg i jest jednym z warunków, które KONIUNKCJA potrzebuje, żeby
 * odróżnić wodę od tańca (progi.mjs liczy MISKA_ZERO z "tańca warunkowego:
 * spełnia glebokosc i kierunekPalcow") - floor-blendowanie zniweczyłoby jego
 * rolę dyskryminatora, pozwalając dłoniom skierowanym PIONOWO wciąż dawać
 * podłogę WAGA_BEZ_DLONI. Miękka jest WYŁĄCZNIE nieobecność dłoni w kadrze.
 *
 * Wysokość liczona od LINII BARKÓW, nie od bioder (mokoszSplot.js:5-11):
 * kamera laptopa nie daje kadru z biodrami i zapasem.
 */
import { NADG_L, NADG_P, LOKIEC_L, LOKIEC_P, BARK_L, BARK_P,
         widoczne, skalaCiala, rampa } from './postawa.js';
import { nadBarkami, odleglosc } from './styk.js';
import { pelnaDlon, kierunekDloni } from './dlon.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, LOKIEC_L, LOKIEC_P];
const P = PROGI.woda;

// Brak dłoni w kadrze NIE KARZE (GEMINI.md §2) - ten sam wzorzec i ta sama
// wartość co w weles.js i stribog.js. Ciało prowadzi (głębokość + miska),
// dłonie doprecyzowują (kierunek palców).
const WAGA_BEZ_DLONI = 0.7;

export const mokosz = {
    id: 'mokosz',
    nazwa: 'Mokosz (woda)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        // Minimum, nie średnia - patrz komentarz w weles.js. Żaden z trzech
        // warunków osobno nie rozdziela pozy od tańca, więc dopiero
        // najsłabszy z nich smie decydować.
        return Math.min(sk.glebokosc, sk.miska, sk.kierunekPalcow);
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return skladnikiZ(frame);
    }
};

/** Warunki w funkcji modułowej, nie przez `this` - wzorzec mokoszSplot.js:53. */
function skladnikiZ(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        const skala = skalaCiala(wl);

        return {
            // Głębokość = jak nisko. nadBarkami jest dodatnie W GÓRĘ, więc
            // miska (ręce W DÓŁ) ma je ujemne - stąd minus na zewnątrz.
            // Najwyższy z dwóch nadgarstków decyduje: jedna ręka nisko to
            // nie jest jeszcze miska.
            glebokosc: rampa(
                -Math.max(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala)),
                P.GLEBOKOSC_ZERO, P.GLEBOKOSC_PELNY),
            // Łokcie szerzej niż nadgarstki - różnica między MISKĄ a rękami
            // po prostu splecionymi przy brzuchu.
            miska: rampa(
                (odleglosc(wl, LOKIEC_L, LOKIEC_P) - odleglosc(wl, NADG_L, NADG_P)) / skala,
                P.MISKA_ZERO, P.MISKA_PELNY),
            kierunekPalcow: kierunekPalcow(frame)
        };
}

/**
 * Miękki kwalifikator z dłoni: minimum surowego `kierunekDloni(lm).y` po
 * widocznych PEŁNYCH dłoniach, ramowane progiem KIERUNEKPALCOW. Brak dłoni
 * w kadrze nie karze - podłoga WAGA_BEZ_DLONI, ten sam wzorzec co piesci()
 * w weles.js. Gdy dłonie SĄ widoczne, wynik jest SUROWY (nie floor-
 * blendowany) - patrz docstring modułu, sekcja KIERUNEK PALCÓW.
 *
 * Minimum, nie średnia: konserwatywnie wymaga, żeby OBIE widoczne dłonie
 * leżały poziomo, nie tylko jedna (ten sam powód co MIN nadgarstków
 * w głębokości).
 */
function kierunekPalcow(frame) {
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (!dlonie.length) return WAGA_BEZ_DLONI;
    const v = Math.min(...dlonie.map(d => kierunekDloni(d.landmarks).y));
    return rampa(v, P.KIERUNEKPALCOW_ZERO, P.KIERUNEKPALCOW_PELNY);
}
