/**
 * ================== ODPIĘTE OD GRY (2026-09-02) ==================
 *
 * Ten moduł NIE jest zarejestrowany w main.js. Runy kreślone w powietrzu
 * przegrały jako PIECZĘCIE - kształt kreślony rzadko wychodzi daleko
 * powyżej progu, więc składa się wolno i nie mieści kombosów w oknie
 * czasowym. Silnik jest jednak sprawny i został ŚWIADOMIE ZACHOWANY jako
 * materiał na przyszłe TECHNIKI (kreślony kształt jako sposób RZUCANIA,
 * nie składania). tools/test-runy.mjs nadal go pilnuje.
 *
 * Zastąpiony przez pięć pieczęci styku:
 * docs/superpowers/specs/2026-09-02-piec-pieczeci-styku-design.md
 */

/**
 * Splot Mokoszy - ramiona skrzyżowane na piersi, czytane WYŁĄCZNIE z barków
 * i nadgarstków. Żadnych bioder - to jest cały powód tego znaku.
 *
 * Stare postawy ciała (mokosz.js, weles.js - oba odpięte) wymagały kadru
 * z barkami I biodrami plus zapasem, czego kamera laptopa nie daje.
 * js/znaki/weles.js już implementował skrzyżowane ramiona, ale liczył
 * wysokość jako ułamek odcinka bark->biodro. Tu wysokość liczy się
 * w szerokościach barków OD LINII BARKÓW - stąd biodra nie są potrzebne.
 *
 * SKRZYŻOWANIE liczone jako ZNAK iloczynu, nie kolejność x - dokładnie
 * formuła z weles.js. MediaPipe podaje lewo/prawo względem OBRAZU, a płótno
 * ma scaleX(-1) (GEMINI.md:88). Przy odbiciu lustrzanym NEGUJĄ SIĘ oba
 * czynniki - różnica nadgarstków i różnica barków - więc iloczyn zostaje
 * bez zmian. Sprawdzenie samej kolejności x dawałoby wynik odwrotny w lustrze.
 */
import { BARK_L, BARK_P, NADG_L, NADG_P, widoczne, skalaCiala, rampa, poziom } from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka debug, D).
// KRZYZ_MIN/PELNY przeniesione WPROST z weles.js (js/znaki/weles.js) -
// ta sama fizyczna wielkość (skrzyżowanie w szerokościach barków), już
// sprawdzona testami tamtej postawy.
const KRZYZ_MIN = 0.05;    // nadgarstki ledwo minęły się w poprzek tułowia
const KRZYZ_PELNY = 0.5;   // wyraźnie po przeciwnych stronach

// Wysokość jako odległość OD LINII BARKÓW, w szerokościach barków (NIE ułamek
// odcinka bark->biodro jak w starym weles.js - stąd brak zależności od bioder).
const WYSOKOSC_IDEALNA = 0.5;   // nadgarstek pół szerokości barków POD barkami
const WYSOKOSC_TOLERANCJA = 0.6;

export const splot = {
    id: 'splot',
    nazwa: 'Splot Mokoszy',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;
        const sk = skladnikiZ(wl);
        return Math.min(sk.krzyzowanie, sk.wysokoscL, sk.wysokoscP);
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        return skladnikiZ(wl);
    }
};

function skladnikiZ(wl) {
    const skala = skalaCiala(wl);
    const yBarkow = poziom(wl, BARK_L, BARK_P);

    // Dodatnie, gdy nadgarstki leżą po stronach PRZECIWNYCH niż barki.
    const roznicaNadg = wl[NADG_L].x - wl[NADG_P].x;
    const roznicaBark = wl[BARK_L].x - wl[BARK_P].x;
    const krzyzowanie = rampa(-(roznicaNadg * Math.sign(roznicaBark)) / skala,
                              KRZYZ_MIN, KRZYZ_PELNY);

    return {
        krzyzowanie,
        wysokoscL: wysokoscKlatki(wl[NADG_L].y, yBarkow, skala),
        wysokoscP: wysokoscKlatki(wl[NADG_P].y, yBarkow, skala)
    };
}

/**
 * Trójkątna rampa wokół idealnej wysokości klatki piersiowej - ciągła
 * w OBIE strony, więc nadgarstek wędrujący w górę albo w dół gaśnie
 * płynnie, nie skokiem. Ten sam kształt co wysokoscPiersi w weles.js,
 * inna jednostka odniesienia (szerokości barków, nie odcinek do bioder).
 */
function wysokoscKlatki(y, yBarkow, skala) {
    const t = (y - yBarkow) / skala;
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, 1 - Math.abs(t - WYSOKOSC_IDEALNA) / WYSOKOSC_TOLERANCJA);
}
