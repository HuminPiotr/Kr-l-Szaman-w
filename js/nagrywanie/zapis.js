// js/nagrywanie/zapis.js
/**
 * Format próbek: bufor klatek w przeglądarce -> JSON -> z powrotem klatka
 * gotowa dla znak.score().
 *
 * Zapis i odczyt mieszkają w JEDNYM pliku celowo. Nagrania są nieodtwarzalne
 * bez ponownej sesji z żywym ciałem, więc rozjechanie się serializacji
 * z deserializacją byłoby najdroższym możliwym błędem w tej zmianie.
 *
 * Punkty lądują jako krotki [x, y, z, visibility], nie obiekty. Klatek jest
 * ~3300 (110 s użytecznego materiału x 30 fps) po 33 punkty pozy i do 42
 * punktów dłoni - w obiektach z nazwami pól nazwy pól byłyby większością
 * pliku. Zaokrąglenie do 3 miejsc po przecinku to około milimetra przy
 * metrycznych worldLandmarks, czyli poniżej realnej dokładności trackera.
 *
 * Współrzędna, która nie jest skończona (NaN, brak punktu) zapisuje się
 * jako `null`, NIE jako 0 - zero to legalna, zmierzona współrzędna (środek
 * układu), więc nadpisanie nią braku danych ukryłoby śmieciową geometrię
 * przed bramką widoczne() w postawa.js (patrz jej komentarz o pomiarze
 * kontra zgadywaniu). Przy odczycie `null` wraca jako NaN, żeby ta sama
 * bramka odrzuciła punkt tak samo, jak odrzuciłaby go na żywo. Nagranie
 * jest nieodtwarzalne bez powtórnej sesji, więc to rozróżnienie musi
 * przetrwać cały obieg zapis -> JSON -> odczyt.
 *
 * `width`/`height` są stałe przez całą sesję (rozmiar okna przeglądarki,
 * main.js:102-103), więc lądują RAZ na poziomie pliku, nie w każdej klatce.
 * Nie są dziś używane przez znaki liczone z pozy, ale są realnie konsumowane
 * przez swarog.js (normalizacja odległości dłoni w pikselach) - dziś nie
 * podłączony w main.js, ale format próbek nie może zakładać, że tak zostanie.
 * Nagranie jest nieodtwarzalne, więc symulowanie tego pola stałą zamiast
 * zapisania go naprawdę byłoby cichą utratą informacji.
 */

export const WERSJA_FORMATU = 2;
const MIEJSC = 3;

const okr = (v) => Number.isFinite(v) ? Number(v.toFixed(MIEJSC)) : 0;
// Dla współrzędnych - w odróżnieniu od okr() powyżej - brak danych zostaje
// brakiem danych (null), nie zerem.
const okrWspolrzedna = (v) => Number.isFinite(v) ? Number(v.toFixed(MIEJSC)) : null;
const spakujPunkt = (p) => [okrWspolrzedna(p?.x), okrWspolrzedna(p?.y), okrWspolrzedna(p?.z), okr(p?.visibility ?? 1)];
const rozpakujPunkt = ([x, y, z, visibility]) => ({
    x: x === null ? NaN : x,
    y: y === null ? NaN : y,
    z: z === null ? NaN : z,
    visibility
});

export class ZapisProbek {
    constructor() {
        this.kroki = {};        // etykieta -> tablica spakowanych klatek
        this.liczbaKlatek = 0;
        // Rozmiar okna jest stały przez całą sesję - zapamiętany raz,
        // przy pierwszej klatce, zamiast powtarzany w każdej.
        this.width = null;
        this.height = null;
    }

    /**
     * @param {string} etykieta  z SesjaNagraniowa (`${id}#${powtorzenie}`)
     * @param {object} frame     kontrakt klatki z main.js:buildFrame
     */
    dodaj(etykieta, frame) {
        if (!etykieta) return;
        if (this.width === null) {
            this.width = frame.width ?? null;
            this.height = frame.height ?? null;
        }
        (this.kroki[etykieta] ??= []).push({
            dt: okr(frame.dt),
            // null, nie pusta tablica: "poza nie została wykryta" to inna
            // informacja niż "wykryta i pusta", a bramka widoczności
            // w postawa.js rozróżnia te przypadki.
            poza: frame.pose ? {
                w: (frame.pose.worldLandmarks ?? []).map(spakujPunkt),
                l: (frame.pose.landmarks ?? []).map(spakujPunkt)
            } : null,
            dlonie: (frame.hands ?? []).map(d => ({
                h: d.handedness ?? null,
                l: (d.landmarks ?? []).map(spakujPunkt)
            }))
        });
        this.liczbaKlatek += 1;
    }

    doJson() {
        return {
            wersja: WERSJA_FORMATU,
            utworzono: new Date().toISOString(),
            liczbaKlatek: this.liczbaKlatek,
            width: this.width,
            height: this.height,
            kroki: this.kroki
        };
    }

    nazwaPliku() {
        const t = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        return `probki-${t}.json`;
    }
}

/**
 * Spakowana klatka -> kontrakt klatki, jakiego oczekuje znak.score().
 *
 * `wymiary` to `{ width, height }` zapisane raz na poziomie pliku
 * (`doJson().width/height`) - podaj je tutaj, żeby odtworzona klatka niosła
 * PRAWDZIWY rozmiar okna z sesji nagrania, nie zgadywany. Bez tego argumentu
 * zostaje awaryjne 1920x1080, żeby nie wywrócić wywołań, które go nie znają.
 *
 * @param {object} zapisana
 * @param {{width: number, height: number}} [wymiary]
 */
export function odtworzKlatke(zapisana, wymiary) {
    return {
        hands: (zapisana.dlonie ?? []).map(d => ({
            handedness: d.h,
            landmarks: (d.l ?? []).map(rozpakujPunkt)
        })),
        pose: zapisana.poza ? {
            worldLandmarks: (zapisana.poza.w ?? []).map(rozpakujPunkt),
            landmarks: (zapisana.poza.l ?? []).map(rozpakujPunkt)
        } : null,
        width: wymiary?.width ?? 1920,
        height: wymiary?.height ?? 1080,
        dt: Number.isFinite(zapisana.dt) ? zapisana.dt : 1 / 60,
        now: 0
    };
}
