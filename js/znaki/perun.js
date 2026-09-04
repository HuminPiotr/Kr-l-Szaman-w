/**
 * Błyskawica - Perun: grom, dąb, władca burzy.
 *
 * IGLICA: obie ręce w górę, ŁOKCIE nad linią barków, opuszki złączone
 * w piramidkę nad głową.
 *
 * ================== TRZECIA POZA TEJ PIECZĘCI ==================
 *
 * Dwie poprzednie padły na nagraniach z żywego ciała, i obie z tego samego
 * powodu: opisywały precyzyjny układ kończyn, którego człowiek mający 12 s
 * na ustawienie się i nie widzący ekranu po prostu nie przyjmuje.
 *
 *   1. Zygzak bokiem - z 327 klatek ANI JEDNA nie osiągnęła profilu.
 *      Kąt w łokciu wyszedł PROSTSZY niż w swobodnym tańcu (137 vs 127 st.),
 *      więc warunek "zgięte łokcie" działał w drugą stronę. Pieczęć zapalała
 *      się mocniej w tańcu (0.37) niż we własnej pozie (0.22).
 *   2. Chwyt za łokieć - dłoń zatrzymała się 1.14 szerokości barków od celu
 *      (dla porównania pięść na barku osiąga 0.32). Wada była w PROJEKCIE:
 *      żeby chwycić uniesiony łokieć, druga ręka też musi pójść w górę, więc
 *      towarzyszący warunek "jedna ręka wysoko, druga nisko" był z tą pozą
 *      wewnętrznie sprzeczny.
 *
 * Nieudana próba 2 okazała się rozstrzygająca, bo pokazała, co ciało robi
 * NAPRAWDĘ: unosi łokcie NAD linię barków. Mediany wysokości łokci względem
 * tej linii: błyskawica +0.13, taniec -0.70, ziemia -0.65, powietrze -0.67,
 * woda -0.72, ogień -0.65. Zapas ponad pół szerokości barków.
 *
 * ================== DLACZEGO BEZ STYKU ==================
 *
 * Jedyna pieczęć bez punktu dotyku - i jedyna, która go nie potrzebuje.
 * Cztery pozostałe stoją na styku, bo dotyk jest rzadki i łatwo go zmierzyć,
 * ale tym, co naprawdę rozdziela, jest OŚ, KTÓREJ NIE UŻYWA NIC INNEGO.
 * Wysokość łokci jest taką osią. Styk był drogą do niej, nie warunkiem.
 *
 * ================== PIRAMIDKA JEST MIĘKKA ==================
 *
 * Propozycja właściciela projektu: skoro to iglica, niech gracz złoży opuszki
 * w namiot nad głową. Przyjęta JAKO KWALIFIKATOR, nie jako warunek konieczny -
 * przy rękach nad głową MediaPipe widzi obie dłonie tylko w 31% klatek.
 * Potwierdziło się to eksperymentem, którego nikt nie planował: w nagraniu
 * kontrolnym jedno z trzech powtórzeń miało ZERO klatek z obiema dłońmi,
 * a pieczęć i tak wyszła w 100% klatek, bo stoi na łokciach.
 *
 * ================== OGIEŃ MUSIAŁ DOSTAĆ WARUNEK WYSOKOŚCI ==================
 *
 * Ta piramidka jest DOKŁADNIE tym samym kształtem dłoni co żywioł ognia
 * (swarogDlon.js). Zmierzone na nagraniu: bez warunku wysokości w ogniu,
 * ogień zapalał się na 223 z 333 klatek iglicy - gracz robiący błyskawicę
 * niechcący podpalał ogień. Naprawa siedzi w swarogDlon.js (pasmo wysokości,
 * zadanie 10), nie tutaj - iglica i tak zawsze poprawnie zgłasza SIEBIE,
 * niezależnie od tego, co robi ogień.
 */
import { NADG_L, NADG_P, LOKIEC_L, LOKIEC_P, BARK_L, BARK_P,
         widoczne, skalaCiala, rampa } from './postawa.js';
import { nadBarkami } from './styk.js';
import { pelnaDlon } from './dlon.js';
import { swarogDlon } from './swarogDlon.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, LOKIEC_L, LOKIEC_P];
const P = PROGI.blyskawica;

// Ten sam wzorzec i ta sama wartość co w ziemi i wodzie.
const WAGA_BEZ_DLONI = 0.7;

export const perun = {
    id: 'perun',
    nazwa: 'Perun (błyskawica)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        return Math.min(sk.nadgarstki, sk.lokcie, sk.piramidka);
    },

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
        // Niższy z dwóch nadgarstków decyduje - jedna ręka w górze to nie iglica.
        nadgarstki: rampa(Math.min(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala)),
                          P.WYSNADG_ZERO, P.WYSNADG_PELNY),
        // Warunek nośny. Niższy łokieć decyduje z tego samego powodu.
        lokcie: rampa(Math.min(nadBarkami(wl, LOKIEC_L, skala), nadBarkami(wl, LOKIEC_P, skala)),
                      P.WYSLOK_ZERO, P.WYSLOK_PELNY),
        piramidka: piramidkaNadGlowa(frame)
    };
}

/**
 * Miękki kwalifikator: ten sam namiot z opuszek co w ogniu, oceniony
 * PRZEZ SAM swarogDlon - żeby istniała jedna definicja piramidki, nie dwie.
 *
 * Wywoływana jest funkcja `skladniki`, nie `score`: `score` ognia zawiera
 * od tego zadania warunek WYSOKOŚCI (pasmo na wysokości klatki), który nad
 * głową jest z definicji niespełniony. Tutaj interesuje nas wyłącznie kształt
 * dłoni, bez tego, gdzie się znajduje.
 *
 * PODŁOGA, NIE SUFIT (poprawka względem pierwszej wersji brief-u zadania).
 * Wzór `max(WAGA_BEZ_DLONI * ksztalt, min(WAGA_BEZ_DLONI, ksztalt))` upraszcza
 * się do `min(ksztalt, WAGA_BEZ_DLONI)` - czyli SUFITU 0.7, nie podłogi: przy
 * idealnym kształcie dłoni (ksztalt=1) dawał dokładnie 0.7, więc `score()`
 * (minimum trzech warunków) nigdy nie mógł przekroczyć 0.7, mimo dobrze
 * ułożonych rąk i łokci. Ten sam wzorzec co `piesci()` w weles.js (podłoga
 * WAGA_BEZ_DLONI, rosnąca DO 1.0 wraz z jakością kształtu) naprawia to
 * i pasuje do zdania tuż pod spodem: dłoń widoczna, ale nieułożona, osłabia
 * pieczęć - nigdy BARDZIEJ, niż zrobiłby to jej brak (czyli wynik nigdy
 * poniżej podłogi WAGA_BEZ_DLONI, nie: wynik nigdy powyżej sufitu).
 */
function piramidkaNadGlowa(frame) {
    const dlonie = (frame.hands ?? []).filter(d => pelnaDlon(d.landmarks));
    if (dlonie.length < 2) return WAGA_BEZ_DLONI;
    const sk = swarogDlon.skladniki(frame);
    if (!sk) return WAGA_BEZ_DLONI;
    const ksztalt = Math.min(sk.palce, sk.opuszki, sk.nadgarstki);
    // Ta sama podłoga co w pozostałych kwalifikatorach: dłoń widoczna, ale
    // nieułożona, osłabia pieczęć - nigdy bardziej, niż zrobiłby to jej brak.
    return WAGA_BEZ_DLONI + (1 - WAGA_BEZ_DLONI) * ksztalt;
}
