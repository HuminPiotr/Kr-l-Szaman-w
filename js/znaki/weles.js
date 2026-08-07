/**
 * Pieczęć Welesa - podziemie, bydło, brama.
 *
 * Ręce skrzyżowane na piersi.
 *
 * SKRZYŻOWANIE liczone jako ZNAK iloczynu, nie jako kolejność x. MediaPipe
 * podaje lewo/prawo względem OBRAZU, a płótno ma scaleX(-1) (GEMINI.md:88).
 * Przy odbiciu lustrzanym NEGUJĄ SIĘ oba czynniki - różnica nadgarstków
 * i różnica barków - więc iloczyn zostaje bez zmian. Sprawdzenie samej
 * kolejności x dawałoby wynik odwrotny w lustrze.
 *
 * Wysokość piersi odcina Mokosz (dłonie poniżej bioder) i Peruna
 * (dłoń nad barkami), więc trójka jest rozdzielna.
 */
import {
    BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P,
    widoczne, skalaCiala, rampa, poziom
} from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka debug, D).
const KRZYZ_MIN = 0.05;    // nadgarstki ledwo minęły się w poprzek tułowia
const KRZYZ_PELNY = 0.5;   // wyraźnie po przeciwnych stronach, w szerokościach barków

// Wysokość piersi jako ułamek odcinka barki -> biodra. 0 = linia barków,
// 1 = linia bioder.
const PIERS_IDEALNA = 0.45;
const PIERS_TOLERANCJA = 0.5;

export const weles = {
    id: 'weles',
    nazwa: 'Weles',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;

        const skala = skalaCiala(wl);
        const yBarkow = poziom(wl, BARK_L, BARK_P);
        const yBioder = poziom(wl, BIODRO_L, BIODRO_P);
        const rozpietosc = yBioder - yBarkow;
        if (!(Math.abs(rozpietosc) > 1e-6)) return 0;

        // Dodatnie, gdy nadgarstki leżą po stronach PRZECIWNYCH niż barki.
        const roznicaNadg = wl[NADG_L].x - wl[NADG_P].x;
        const roznicaBark = wl[BARK_L].x - wl[BARK_P].x;
        const krzyz = rampa(-(roznicaNadg * Math.sign(roznicaBark)) / skala,
                            KRZYZ_MIN, KRZYZ_PELNY);

        const wysL = wysokoscPiersi(wl[NADG_L].y, yBarkow, rozpietosc);
        const wysP = wysokoscPiersi(wl[NADG_P].y, yBarkow, rozpietosc);

        // Minimum, nie średnia - patrz komentarz w perun.js.
        return Math.min(krzyz, wysL, wysP);
    }
};

function wysokoscPiersi(y, yBarkow, rozpietosc) {
    const t = (y - yBarkow) / rozpietosc;
    if (!Number.isFinite(t)) return 0;
    // Trójkątna rampa wokół wysokości piersi: ciągła w obie strony,
    // więc dłoń wędrująca w górę albo w dół gaśnie płynnie, nie skokiem.
    return Math.max(0, 1 - Math.abs(t - PIERS_IDEALNA) / PIERS_TOLERANCJA);
}
