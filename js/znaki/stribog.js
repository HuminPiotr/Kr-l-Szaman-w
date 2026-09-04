/**
 * Powietrze - Stribog: wiatr, dziad wiatrów.
 *
 * Łokcie stykają się przed mostkiem, przedramiona idą pionowo w górę,
 * dłonie rozchylają się na zewnątrz jak dwie gałęzie z jednego pnia.
 * Punkt styku: łokieć o łokieć.
 *
 * ORTOGONALNY DO OGNIA Z KONSTRUKCJI: piramidka Swaroga to NADGARSTKI
 * ROZSUNIĘTE przy opuszkach razem, powietrze to ŁOKCIE RAZEM przy
 * nadgarstkach rozsuniętych. Te same dwie osie w odwrotnych rolach,
 * więc dwie pieczęcie nie mogą jednocześnie siedzieć wysoko.
 *
 * ================== POPRAWKA PO POMIARZE ==================
 *
 * Pierwotny projekt miał trzeci warunek: "nadgarstki dalej od siebie niż
 * łokcie" (rozchylone dłonie). USUNIĘTY po nagraniu. Zmierzona wartość jest
 * UJEMNA (-0.43): gracz trzyma nadgarstki BLIŻEJ siebie niż łokcie, czyli
 * dokładnie odwrotnie, niż zakładał projekt. Wykonanie na żywym ciele to
 * raczej "dłonie razem przed sobą, łokcie na zewnątrz" niż "gałęzie".
 *
 * Zostają dwa warunki i wystarczają: 0.75 wyniku we własnym kroku, ZERO
 * z 763 klatek tańca nad progiem, maksimum w tańcu 0.12.
 */
import { NADG_L, NADG_P, LOKIEC_L, LOKIEC_P, BARK_L, BARK_P,
         widoczne, skalaCiala, rampa } from './postawa.js';
import { styk, nadBarkami } from './styk.js';
import { PROGI } from './progi-zmierzone.js';

const PUNKTY = [BARK_L, BARK_P, NADG_L, NADG_P, LOKIEC_L, LOKIEC_P];
const P = PROGI.powietrze;

export const stribog = {
    id: 'stribog',
    nazwa: 'Stribog (powietrze)',
    wymaga: 'pose',

    score(frame) {
        const sk = skladnikiZ(frame);
        if (!sk) return 0;
        return Math.min(sk.lokcie, sk.wysokosc);
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
            lokcie: styk(wl, LOKIEC_L, LOKIEC_P, skala, P.STYK_PELNY, P.STYK_ZERO),
            // Najniższy z dwóch nadgarstków decyduje - jedna ręka w górze
            // to nie jest ta poza.
            wysokosc: rampa(Math.min(nadBarkami(wl, NADG_L, skala), nadBarkami(wl, NADG_P, skala)),
                            P.WYSOKOSC_ZERO, P.WYSOKOSC_PELNY),
        };
}
