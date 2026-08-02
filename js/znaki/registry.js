/**
 * Rejestr Znaków.
 *
 * Znak to deklaratywny obiekt:
 *   { id, nazwa, wymaga: 'hands'|'pose'|'both', score(frame) -> 0..1 }
 *
 * REGUŁA NADRZĘDNA CAŁEJ GRY: nic nigdy nie mówi "źle".
 * Dlatego score() zwraca CIĄGŁĄ wartość 0..1, nigdy boolean. Częściowe ułożenie
 * dłoni daje słabszy, ale nadal ładny efekt. Nie ma progu, nie ma odrzucenia,
 * nie ma momentu porażki. To techniczna realizacja celu emocjonalnego (relaks),
 * a nie detal implementacyjny - nie zamieniać na klasyfikację tak/nie.
 *
 * Rejestr nie wyłania "zwycięzcy" i nie odcina progiem. Publikuje wyniki
 * wszystkich znaków naraz; co z nimi zrobić, decyduje konsument.
 */

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;

export class ZnakRegistry {
    /** @param {number} alpha  współczynnik wygładzania EMA (mniejszy = gładziej) */
    constructor({ alpha = 0.25 } = {}) {
        this.znaki = [];
        this.alpha = alpha;

        // Dwa równoległe zestawy wyników - to nie jest nadmiarowość:
        //
        //   surowe      - wartość z tej klatki, bez historii.
        //   wygladzone  - EMA, odporne na drgania trackingu.
        //
        // Kula z commita A czyta SUROWE, bo tak zachowywał się kod przed
        // refaktorem i tylko wtedy test regresji cokolwiek dowodzi. Wygładzone
        // są docelowe (relaks = gładko) i włączają się przy zmianie mechaniki.
        this.surowe = {};
        this.wygladzone = {};
    }

    zarejestruj(znak) {
        this.znaki.push(znak);
        this.surowe[znak.id] = 0;
        this.wygladzone[znak.id] = 0;
    }

    /** Ocenia wszystkie znaki na tej klatce. Wywoływane raz na klatkę. */
    ocen(frame) {
        for (const znak of this.znaki) {
            const wynik = this._ocenJeden(znak, frame);
            this.surowe[znak.id] = wynik;
            this.wygladzone[znak.id] += this.alpha * (wynik - this.wygladzone[znak.id]);
        }
        return this.surowe;
    }

    _ocenJeden(znak, frame) {
        // Brak wymaganego wejścia to nie błąd - to po prostu wynik zero.
        // Gracz poza kadrem nie dostaje komunikatu o porażce.
        const maDlonie = frame.hands && frame.hands.length > 0;
        const maCialo = !!frame.pose;

        if (znak.wymaga === 'hands' && !maDlonie) return 0;
        if (znak.wymaga === 'pose' && !maCialo) return 0;
        if (znak.wymaga === 'both' && !(maDlonie && maCialo)) return 0;

        return clamp01(znak.score(frame));
    }
}
