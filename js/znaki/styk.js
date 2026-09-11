/**
 * Prymitywy geometrii STYKU - wspólne dla czterech pieczęci z pozy.
 *
 * Teza całej piątej generacji znaków: pieczęć to PUNKT DOTYKU, nie układ
 * kończyn. Styk jest rzadki w tańcu, gracz czuje go bez patrzenia na ekran
 * i trafia wysoko powyżej progu, więc składa się szybko - a to ostatnie jest
 * mechanizmem, dzięki któremu kombosy mieszczą się w oknie czasowym.
 *
 * STYK NIE JEST WARUNKIEM BINARNYM, mimo że fizycznie na to wygląda.
 * Reguła nadrzędna (GEMINI.md §2) obowiązuje: pięść BLISKO barku daje
 * słabszy, ale niezerowy wynik. Binarny styk zamieniłby pieczęć w egzamin
 * na precyzję, czyli dokładnie w to, czego ten projekt się pozbywa.
 *
 * ODLEGŁOŚCI SĄ ODPORNE NA LUSTRO. Płótno ma scaleX(-1) (GEMINI.md:88),
 * przez co każdy warunek czytający KOLEJNOŚĆ x daje wynik odwrotny w odbiciu -
 * stąd formuła ze znakiem iloczynu w starym weles.js. Odległość między dwoma
 * landmarkami jest niezmiennikiem odbicia, a MediaPipe etykietuje strony
 * CIAŁA, nie strony obrazu, więc "nadgarstek przy przeciwnym barku" nie
 * potrzebuje żadnej ostrożności lustrzanej.
 *
 * BEZ katWLokciu(). Brief do tego zadania ją opisywał jako warunek pozy
 * błyskawicy ("oba łokcie zgięte"), ale ta poza przeszła od tego czasu dwie
 * iteracje na nagraniach z żywego ciała i w obecnej postaci nie mierzy kąta
 * w ogóle. Po przeliczeniu wszystkich pięciu znaków żaden nie ma konsumenta
 * dla tej funkcji - ziemia to dwa styki plus pięść, powietrze styk łokci
 * plus wysokość, woda styk nadgarstków plus głębokość plus miska, błyskawica
 * dwie wysokości, ogień piramidka plus pasmo wysokości. Kod bez konsumenta
 * to ta sama decyzja co przy obrotBokiem w poprzednim zadaniu.
 */
import { BARK_L, BARK_P, poziom, rampa } from './postawa.js';

/** Odległość dwóch punktów pozy w metrach, w pełnym 3D. */
export function odleglosc(wl, i, j) {
    const a = wl?.[i], b = wl?.[j];
    if (!a || !b) return Infinity;
    const d = Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
    return Number.isFinite(d) ? d : Infinity;
}

/**
 * Ciągła miara styku: 1 przy dotyku, 0 przy odległości `zero`.
 *
 * @param {number} pelny  odległość (w szerokościach barków), przy której wynik = 1
 * @param {number} zero   odległość, przy której wynik = 0. Musi być > pelny.
 */
export function styk(wl, i, j, skala, pelny, zero) {
    // Skala niedodatnia, NaN albo nieskończona to brak sensownej jednostki
    // odniesienia - nie da się nią zmierzyć dotyku. Wynik to "brak danych"
    // (0), NIGDY przypadkowy pełny dotyk. Bez tego strażnika skala ujemna
    // dawałaby d < 0, rampa przycinałaby to do 0, a styk() zwracałby 1 -
    // czyli fałszywe trafienie z braku sensownych danych (znalezione
    // mutation testingiem, patrz task-5-report.md).
    if (!Number.isFinite(skala) || skala <= 0) return 0;
    const d = odleglosc(wl, i, j) / skala;
    if (!Number.isFinite(d)) return 0;
    return 1 - rampa(d, pelny, zero);
}

/**
 * Ten sam pomiar co styk(), ale między dwoma PUNKTAMI zamiast indeksami
 * landmarków - potrzebny, gdy jeden z punktów nie jest pojedynczym
 * landmarkiem (np. "usta" = środek landmarków 9/10, patrz js/dmuchanie.js).
 *
 * @param {{x,y,z?}|null} a
 * @param {{x,y,z?}|null} b
 * @param {number} skala  jednostka odniesienia (metry), np. skalaCiala(wl)
 * @param {number} pelny  odległość (w jednostkach skali), przy której wynik = 1
 * @param {number} zero   odległość, przy której wynik = 0
 */
export function stykPunktow(a, b, skala, pelny, zero) {
    if (!Number.isFinite(skala) || skala <= 0) return 0;
    if (!a || !b) return 0;
    const d = Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) / skala;
    if (!Number.isFinite(d)) return 0;
    return 1 - rampa(d, pelny, zero);
}

/**
 * Wysokość punktu NAD linią barków, w szerokościach barków.
 * Dodatnia w górę, mimo że oś Y worldLandmarks rośnie w dół - znak jest
 * odwrócony tutaj, raz, żeby cztery znaki nie musiały o tym pamiętać.
 *
 * Odniesieniem są BARKI, nigdy biodra: kamera laptopa nie daje kadru
 * z biodrami i zapasem (mokoszSplot.js:5-11).
 */
export function nadBarkami(wl, i, skala) {
    const p = wl?.[i];
    if (!p || !Number.isFinite(p.y)) return 0;
    const yBarkow = poziom(wl, BARK_L, BARK_P);
    const v = (yBarkow - p.y) / (skala > 1e-6 ? skala : 1e-6);
    return Number.isFinite(v) ? v : 0;
}
