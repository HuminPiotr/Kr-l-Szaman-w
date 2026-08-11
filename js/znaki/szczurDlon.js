/**
 * Pieczęć Szczura (Nezumi) - wiatr.
 *
 * DWIE ASYMETRYCZNE DŁONIE, JEDNA NAD DRUGĄ: dolna zaciśnięta w pięść,
 * górna z wysuniętymi wskazującym i środkowym palcem (ta sama para co
 * w Tygrysie Peruna, ale tu tylko na JEDNEJ dłoni - druga jest pięścią).
 * Pierwsza pieczęć w tym zestawie z ról ASYMETRYCZNYMI - Wąż, Tygrys i Koń
 * są zbudowane symetrycznie (obie dłonie robią to samo).
 *
 * Kciuki w prawdziwym geście wskazują w stronę kamery (pięści "bokiem").
 * ŚWIADOMIE NIE MIERZYMY tej rotacji - kciuk jest najmniej pewnym punktem
 * dłoni (ten sam powód, dla którego perunDlon.js go pomija), a naturalne
 * ułożenie jednej pięści nad drugą i tak zwykle obraca nadgarstek w tę
 * stronę samo z siebie. Wymaganie tego wprost dodałoby fałszywych odrzuceń
 * bez zysku dla rozdzielności - pion + liczba palców już wystarczają.
 *
 * ROZDZIELNOŚĆ: `piesc` (dolna) i `dwaPalce` (górna) razem odcinają tę
 * pieczęć od reszty trójki - Tygrys wymaga DWÓCH palców na OBU dłoniach
 * (dolna-pięść zbija jego wynik), Wąż i Koń wymagają otwartych dłoni
 * (obie zbite przez pięść), a same "dwa palce + pięść" bez wymogu pionu
 * myliłyby się z niedokładnie złożonym Tygrysem - stąd `pion`.
 *
 * KTÓRA DŁOŃ JEST GÓRNA nie jest ustalone z góry - `najlepszaPara()` nie
 * gwarantuje kolejności dłoni względem pozycji w kadrze, więc liczymy WYNIK
 * DLA OBU PRZYPISAŃ i bierzemy lepszy (patrz ocenWariant/skladnikiPary).
 */
import { wzorPalcow, zwinieta, skalaDloni, rampa, najlepszaPara, NADGARSTEK } from './dlon.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D). Jednostka: skala dłoni.

// Ile górna dłoń musi być WYŻEJ od dolnej (mniejsze y = wyżej, oś Y rośnie
// w dół). "Troche nad" - MIN jest celowo niski, żeby nie wymuszać dużego
// rozstawu pionowego.
const PION_MIN = 0.3;
const PION_PELNE = 1.0;

// Jak daleko w POZIOMIE dłonie mogą się rozjechać, zanim to już nie jest
// "jedna nad drugą", tylko dwie osobne ręce.
const WYROWNANIE_OD = 0.6;
const WYROWNANIE_DO = 1.3;

// Ile złożenia kciuka/serdecznego/małego wymagamy na GÓRNEJ dłoni - ten sam
// tolerancyjny wzorzec co w Perunie (perunDlon.js:47-48) i z tego samego
// powodu: MediaPipe zgaduje częściowe wyprostowanie przy splecionych/bliskich
// palcach, więc liczy się "nie w pełni wyprostowane", nie "idealnie zaciśnięte".
const ZLOZONE_OD = 0.85;
const ZLOZONE_DO = 0.35;

export const szczurDlon = {
    id: 'szczur',
    nazwa: 'Szczur (Wiatr)',
    wymaga: 'hands',

    score(frame) {
        return najlepszaPara(frame, skladnikiPary).wynik;
    },

    /** Rozbicie na warunki - do nakładki, żeby było widać KTÓRY blokuje. */
    skladniki(frame) {
        return najlepszaPara(frame, skladnikiPary).skladniki;
    }
};

/** Ocena przy założeniu, że `gorna` jest dłonią z dwoma palcami, a `dolna` pięścią. */
function ocenWariant(gorna, dolna) {
    const wg = wzorPalcow(gorna);
    const skala = (skalaDloni(gorna) + skalaDloni(dolna)) / 2;

    // Oś Y rośnie W DÓŁ, więc "gorna faktycznie wyżej" = dolna.y > gorna.y.
    const przesuniecie = (dolna[NADGARSTEK].y - gorna[NADGARSTEK].y) / skala;
    const rozjazd = Math.abs(gorna[NADGARSTEK].x - dolna[NADGARSTEK].x) / skala;

    return {
        piesc: zwinieta(dolna),
        dwaPalce: Math.min(wg[1], wg[2]),
        tylne: rampa(Math.max(wg[0], wg[3], wg[4]), ZLOZONE_OD, ZLOZONE_DO),
        pion: rampa(przesuniecie, PION_MIN, PION_PELNE),
        wyrownanie: 1 - rampa(rozjazd, WYROWNANIE_OD, WYROWNANIE_DO)
    };
}

// MINIMUM po składnikach (liczone w najlepszaPara) - reguła nadrzędna:
// każdy warunek osobno ciągły, ale WSZYSTKIE muszą być spełnione naraz.
function skladnikiPary(a, b) {
    const aGorna = ocenWariant(a, b);
    const bGorna = ocenWariant(b, a);
    const minA = Math.min(...Object.values(aGorna));
    const minB = Math.min(...Object.values(bGorna));
    return minA >= minB ? aGorna : bGorna;
}
