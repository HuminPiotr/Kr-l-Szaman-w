/**
 * Pieczęć Mokoszy - ziemia, wilgoć, matka.
 *
 * Obie dłonie nisko, rozstawione szerzej niż barki - jakby gracz kładł je
 * na ziemi. Geometrycznie przeciwna do Peruna (tam JEDNA dłoń wysoko),
 * więc obie postawy nie zapalają się nawzajem.
 *
 * Naturalnie symetryczna: liczy się |rozstaw| i obie dłonie na równi,
 * więc odbicie lustrzane niczego nie zmienia.
 */
import {
    BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P,
    widoczne, skalaCiala, rampa, poziom
} from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka debug, D).
// Jednostka: szerokości barków.
const NISKO_MIN = 0.05;    // nadgarstek tyle poniżej linii bioder
const NISKO_PELNE = 0.35;
const ROZSTAW_MIN = 1.0;   // dłonie dokładnie pod barkami - jeszcze nie gest
const ROZSTAW_PELNY = 1.6; // wyraźnie szerzej niż barki

export const mokosz = {
    id: 'mokosz',
    nazwa: 'Mokosz',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;

        const skala = skalaCiala(wl);
        const yBioder = poziom(wl, BIODRO_L, BIODRO_P);

        // Oś Y rośnie W DÓŁ: "poniżej bioder" to y WIĘKSZE od linii bioder.
        const niskoL = rampa((wl[NADG_L].y - yBioder) / skala, NISKO_MIN, NISKO_PELNE);
        const niskoP = rampa((wl[NADG_P].y - yBioder) / skala, NISKO_MIN, NISKO_PELNE);

        const rozstaw = rampa(Math.abs(wl[NADG_L].x - wl[NADG_P].x) / skala,
                              ROZSTAW_MIN, ROZSTAW_PELNY);

        // Minimum, nie średnia - patrz komentarz w perun.js.
        return Math.min(niskoL, niskoP, rozstaw);
    }
};
