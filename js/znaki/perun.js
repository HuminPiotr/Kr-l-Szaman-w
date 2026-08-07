/**
 * Pieczęć Peruna - grom.
 *
 * Jedna ręka wyprostowana nad głowę, druga opuszczona wzdłuż ciała.
 * Szaman ściąga błyskawicę.
 *
 * Gest jest zdefiniowany SYMETRYCZNIE. MediaPipe podaje lewo/prawo względem
 * OBRAZU, a płótno ma CSS scaleX(-1) (GEMINI.md:88), więc stronność nie może
 * nieść znaczenia - inaczej gest działałby lustrzanie odwrotnie niż wygląda.
 * Liczymy oba przypisania rąk i bierzemy lepsze.
 */
import {
    BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P,
    widoczne, skalaCiala, rampa, poziom
} from './postawa.js';

const PUNKTY = [BARK_L, BARK_P, LOKIEC_L, LOKIEC_P, NADG_L, NADG_P, BIODRO_L, BIODRO_P];

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele. Stroić z nakładki
// debug (klawisz D), która pokazuje wynik każdej postawy. Jednostka:
// szerokości barków.
const UNIESIENIE_MIN = 0.2;   // nadgarstek tyle nad linią barków -> zaczyna się liczyć
const UNIESIENIE_PELNE = 1.2; // ramię wyciągnięte pionowo w górę
const OPUSZCZENIE_MIN = 0.05; // druga dłoń poniżej linii bioder
const OPUSZCZENIE_PELNE = 0.5;
// Prostota ramienia: |bark->nadgarstek| / (|bark->łokieć| + |łokieć->nadgarstek|).
// 1.0 = idealnie prosta linia, mniej = ramię zgięte.
const PROSTOTA_MIN = 0.85;
const PROSTOTA_PELNA = 0.98;

export const perun = {
    id: 'perun',
    nazwa: 'Perun',
    wymaga: 'pose',

    score(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return 0;

        const skala = skalaCiala(wl);
        const yBarkow = poziom(wl, BARK_L, BARK_P);
        const yBioder = poziom(wl, BIODRO_L, BIODRO_P);

        // Oba przypisania: prawa w górze / lewa w górze.
        return Math.max(
            ocen(wl, skala, yBarkow, yBioder, BARK_P, LOKIEC_P, NADG_P, NADG_L),
            ocen(wl, skala, yBarkow, yBioder, BARK_L, LOKIEC_L, NADG_L, NADG_P)
        );
    }
};

function ocen(wl, skala, yBarkow, yBioder, bark, lokiec, nadgGora, nadgDol) {
    // Oś Y rośnie W DÓŁ, więc "nad barkami" to y MNIEJSZE od linii barków.
    const uniesienie = rampa((yBarkow - wl[nadgGora].y) / skala,
                             UNIESIENIE_MIN, UNIESIENIE_PELNE);
    const opuszczenie = rampa((wl[nadgDol].y - yBioder) / skala,
                              OPUSZCZENIE_MIN, OPUSZCZENIE_PELNE);
    const prostota = rampa(prostotaRamienia(wl[bark], wl[lokiec], wl[nadgGora]),
                           PROSTOTA_MIN, PROSTOTA_PELNA);

    // MINIMUM, nie średnia: wszystkie trzy warunki muszą zachodzić naraz,
    // inaczej ręce opuszczone punktowałyby na 2/3 tylko dlatego, że ramię
    // jest proste. Minimum jest nadal CIĄGŁE - reguła nadrzędna spełniona.
    return Math.min(uniesienie, opuszczenie, prostota);
}

function prostotaRamienia(bark, lokiec, nadg) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const przez = d(bark, lokiec) + d(lokiec, nadg);
    if (!(przez > 1e-6)) return 0;
    return d(bark, nadg) / przez;
}
