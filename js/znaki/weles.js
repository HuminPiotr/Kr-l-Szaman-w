/**
 * Ziemia - Weles: podziemie, bydło, brama.
 *
 * Ramiona skrzyżowane na krzyż, każda ZACIŚNIĘTA PIĘŚĆ dotyka PRZECIWNEGO
 * barku. Punkt styku: nadgarstek o bark.
 *
 * DLACZEGO BEZ FORMUŁY ZE ZNAKIEM ILOCZYNU. Poprzednia wersja tego pliku
 * liczyła skrzyżowanie jako znak iloczynu różnic x, bo sprawdzanie samej
 * kolejności x dawało wynik odwrotny w lustrze płótna (scaleX(-1),
 * GEMINI.md:88). Ta ostrożność jest tu niepotrzebna: ODLEGŁOŚĆ między dwoma
 * landmarkami jest niezmiennikiem odbicia, a MediaPipe etykietuje strony
 * CIAŁA, nie strony obrazu. Dwa warunki styku (lewy nadgarstek przy prawym
 * barku i odwrotnie) IMPLIKUJĄ skrzyżowanie i robią to bez ani jednej
 * operacji wrażliwej na lustro. Cała klasa błędów znika razem z formułą.
 *
 * ================== POPRAWKA PO POMIARZE ==================
 *
 * Pierwotny projekt miał trzeci warunek: "oba nadgarstki na wysokości linii
 * barków lub wyżej". USUNIĘTY po nagraniu z żywego ciała. Zmierzono, że przy
 * pięściach na barkach nadgarstki leżą 0.5 szerokości barków PONIŻEJ linii
 * barków (landmark nadgarstka siedzi w stawie, więc przy pięści na barku
 * wypada nisko), a swobodny taniec sięga wyżej - p90 wynosi -0.21. Warunek
 * mierzył więc odwrotność tego, co miał mierzyć.
 *
 * Sam styk wystarcza z zapasem: 0.99 wyniku we własnym kroku i ZERO z 763
 * klatek tańca nad progiem składania.
 */
import { NADG_L, NADG_P, BARK_L, BARK_P, widoczne, skalaCiala } from './postawa.js';
import { styk } from './styk.js';
import { zwinieta, pelnaDlon } from './dlon.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P];
const P = PROGI.ziemia;

// Brak dłoni w kadrze NIE KARZE (GEMINI.md §2). Ciało prowadzi, dłonie
// doprecyzowują - ten sam wzorzec i ta sama wartość co w dawnym
// runy/definicje.js:25, gdzie sprawdził się w praktyce.
const WAGA_BEZ_DLONI = 0.7;

export const weles = {
    id: 'weles',
    nazwa: 'Weles (ziemia)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        // Minimum, nie średnia: pieczęć jest AND-em warunków, a najsłabszy
        // z nich ma widocznie hamować - inaczej dwa dobre warunki maskują
        // trzeci zupełnie niespełniony.
        return Math.min(sk.stykL, sk.stykP, sk.piesci);
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return skladnikiZ(frame);
    }
};

/**
 * Warunki liczone przez FUNKCJĘ MODUŁOWĄ, nie przez `this` w score().
 * Ten sam wzorzec co mokoszSplot.js:53 - dzięki niemu `score` i `skladniki`
 * działają także wtedy, gdy ktoś je zdestrukturyzuje z obiektu znaku.
 */
function skladnikiZ(frame) {
        const wl = frame.pose?.worldLandmarks;
        if (!widoczne(wl, PUNKTY)) return null;
        const skala = skalaCiala(wl);

        return {
            // Lewy nadgarstek przy PRAWYM barku i odwrotnie - to jest samo
            // skrzyżowanie, wyrażone odległościami.
            stykL: styk(wl, NADG_L, BARK_P, skala, P.STYK_PELNY, P.STYK_ZERO),
            stykP: styk(wl, NADG_P, BARK_L, skala, P.STYK_PELNY, P.STYK_ZERO),
            piesci: piesci(frame)
        };
}

/** Miękki kwalifikator: średnie zwinięcie widocznych dłoni, bez kary za brak. */
function piesci(frame) {
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (!dlonie.length) return WAGA_BEZ_DLONI;
    const suma = dlonie.reduce((acc, d) => acc + zwinieta(d.landmarks), 0);
    const srednia = suma / dlonie.length;
    // Podłoga na WAGA_BEZ_DLONI, ROSNĄCA do 1.0: dłoń widoczna, ale otwarta
    // (srednia = 0), daje dokładnie tyle, ile dałby brak dłoni w kadrze -
    // NIGDY mniej, inaczej wejście dłoni w kadr byłoby KARĄ względem stania
    // poza nim (patrz test "dłonie otwarte -> nie gorzej niż brak dłoni").
    // Dłoń w pełni zaciśnięta (srednia = 1) podnosi wynik do 1.0. Liniowa
    // interpolacja między tymi dwoma punktami jest ciągła w całym zakresie -
    // reguła nadrzędna: pięść zaciśnięta w połowie ma dawać wynik w połowie
    // między podłogą a pełnią, nie skok.
    return WAGA_BEZ_DLONI + (1 - WAGA_BEZ_DLONI) * srednia;
}
