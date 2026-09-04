/**
 * Silnik kombosów - sekwencja pieczęci odpala technikę.
 *
 * BUFOR WYGASA Z CZASEM, ALE NIGDY NIE JEST CZYSZCZONY ZA POMYŁKĘ.
 * Każda konwencjonalna gra walki kasuje bufor przy złym wejściu; to jest
 * stan porażki i łamie regułę nadrzędną (GEMINI.md §2). Tutaj żadna pieczęć
 * nie jest "zła": każda zapłaciła swój koszt i dała własny efekt, więc
 * nieudana próba kombo to po prostu kilka ładnych błysków.
 *
 * Technika odpala się GRATIS - składowe już zapłaciły. To nagroda za
 * ułożenie, nie kolejny rachunek.
 *
 * ŁAŃCUCHY SĄ CELOWE. swarog -> perun -> stribog -> stribog daje oba kombosy
 * po kolei (Grom w Ogniu, potem Aard), bo dopasowujemy KOŃCÓWKĘ bufora i nie
 * czyścimy go po trafieniu. Gracz nie może zmarnować pieczęci, więc
 * nakładające się sekwencje mają się nakładać.
 */

// ZGADNIĘTE - wymaga potwierdzenia na żywym ciele. Za krótkie okno karze
// wolniejszych, za długie łączy pieczęcie złożone bez związku.
//
// PODNIESIONE z 4000 na 6500 (finalny przegląd Splotu/Tęczy): przy
// trójelementowej sekwencji splot x3 matematyka składania (pieczecie.js:
// czas rośnie do 2.5s przy wyniku tuż nad progiem) sprawiała, że wynik
// Splotu poniżej ~62% nigdy nie mieścił dwóch kolejnych złożeń w oknie -
// pieczęć się składała, kosztowała moc, ale Tęcza nigdy nie odpalała, bez
// żadnego sygnału dlaczego. Szersze okno dotyczy WSZYSTKICH kombosów w tej
// tabeli, nie tylko Tęczy - świadoma decyzja, żeby nie różnicować progów
// wybaczania między technikami.
const OKNO_MS = 6500;

// Pole `uzbraja` mówi, KTÓRĄ technikę kombos przygotowuje - main.js routuje
// po nim zamiast bezwarunkowo uzbrajać płonący palec.
//
// PIĄTA GENERACJA ZNAKÓW (docs/superpowers/specs/2026-09-02-piec-pieczeci-
// -styku-design.md): runy kreślone w powietrzu i Splot Mokoszy odeszły,
// zastąpione pięcioma pieczęciami STYKU - ogień (piramidka, bez zmian),
// ziemia (pięści na barkach), błyskawica (zygzak bokiem), powietrze
// (łokcie razem), woda (miska).
//
// BUDŻET CZASOWY. Pieczęć na styku trafia wynik ~0.9, a wtedy pieczecie.js
// składa ją w ~0.9 s. Trzy złożenia to ~2.7 s plus przejścia - mieści się
// w OKNO_MS z zapasem. Runy trafiały ~0.7, czyli 1.7 s na złożenie, i stąd
// brało się zmierzone ograniczenie Wstęgi w poprzedniej generacji.
export const KOMBOSY = [
    // Ogień -> woda -> powietrze. Sekwencja wybrana przez właściciela
    // projektu. Aktywacja NATYCHMIASTOWA, bez drugiego gestu - main.js
    // routuje tę gałąź osobno.
    { id: 'tecza', nazwa: 'Wstęga Mokoszy',
      sekwencja: ['swarog', 'mokosz', 'stribog'], uzbraja: 'tecza' },

    // Ogień -> błyskawica. Nazwa mówi to, co robi sekwencja.
    { id: 'gromWOgniu', nazwa: 'Grom w Ogniu',
      sekwencja: ['swarog', 'perun'], uzbraja: 'ogien' },

    // Powietrze x2 -> Aard. Wiatr złożony dwa razy pod rząd.
    { id: 'aard', nazwa: 'Podmuch Striboga',
      sekwencja: ['stribog', 'stribog'], uzbraja: 'aard' }
];

// ZIEMIA nie wchodzi na razie w żaden kombos - zostaje pieczęcią
// samodzielną, dającą swój błysk. Kombos bez techniki, którą miałby
// uzbrajać, byłby wymyślaniem na zapas; ziemia wejdzie, gdy powstanie
// technika ziemi.

export class KomboSilnik {
    constructor({ okno = OKNO_MS, kombosy = KOMBOSY } = {}) {
        this.okno = okno;
        this.kombosy = kombosy;
        this.bufor = [];   // [{ id, t }] - najstarsze z przodu
    }

    /**
     * @param {string} idPieczeci  id właśnie złożonej pieczęci
     * @param {number} now         performance.now() w ms
     * @returns {object|null} definicja techniki albo null
     */
    dodaj(idPieczeci, now) {
        if (typeof idPieczeci !== 'string' || !idPieczeci) return null;
        if (!Number.isFinite(now)) return null;

        this.bufor.push({ id: idPieczeci, t: now });

        // Wygaszanie po CZASIE. To jedyny sposób, w jaki wpis znika z bufora.
        while (this.bufor.length && now - this.bufor[0].t > this.okno) {
            this.bufor.shift();
        }

        return this._dopasuj();
    }

    /** Dopasowanie do KOŃCÓWKI bufora - patrz komentarz o łańcuchach. */
    _dopasuj() {
        for (const kombo of this.kombosy) {
            const s = kombo.sekwencja;
            if (this.bufor.length < s.length) continue;
            const ogon = this.bufor.slice(-s.length);
            if (ogon.every((w, i) => w.id === s[i])) return kombo;
        }
        return null;
    }
}
