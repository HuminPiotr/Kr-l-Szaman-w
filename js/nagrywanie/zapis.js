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
 */

export const WERSJA_FORMATU = 1;
const MIEJSC = 3;

const okr = (v) => Number.isFinite(v) ? Number(v.toFixed(MIEJSC)) : 0;
const spakujPunkt = (p) => [okr(p?.x), okr(p?.y), okr(p?.z), okr(p?.visibility ?? 1)];
const rozpakujPunkt = ([x, y, z, visibility]) => ({ x, y, z, visibility });

export class ZapisProbek {
    constructor() {
        this.kroki = {};        // etykieta -> tablica spakowanych klatek
        this.liczbaKlatek = 0;
    }

    /**
     * @param {string} etykieta  z SesjaNagraniowa (`${id}#${powtorzenie}`)
     * @param {object} frame     kontrakt klatki z main.js:buildFrame
     */
    dodaj(etykieta, frame) {
        if (!etykieta) return;
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
 * `width`/`height` są stałe i nieużywane przez znaki z pozy; są w kontrakcie,
 * bo `frame` jest tym samym obiektem, który w grze dostaje rysowanie.
 */
export function odtworzKlatke(zapisana) {
    return {
        hands: (zapisana.dlonie ?? []).map(d => ({
            handedness: d.h,
            landmarks: (d.l ?? []).map(rozpakujPunkt)
        })),
        pose: zapisana.poza ? {
            worldLandmarks: (zapisana.poza.w ?? []).map(rozpakujPunkt),
            landmarks: (zapisana.poza.l ?? []).map(rozpakujPunkt)
        } : null,
        width: 1920,
        height: 1080,
        dt: Number.isFinite(zapisana.dt) ? zapisana.dt : 1 / 60,
        now: 0
    };
}
