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
 * ŁAŃCUCHY SĄ CELOWE. perun -> mokosz -> weles daje oba kombosy po kolei,
 * bo dopasowujemy KOŃCÓWKĘ bufora i nie czyścimy go po trafieniu. Gracz nie
 * może zmarnować pieczęci, więc nakładające się sekwencje mają się nakładać.
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
// po nim zamiast bezwarunkowo uzbrajać płonący palec (co było w porządku,
// dopóki technika była jedna).
//
// PRZEBUDOWA NA RUNY (docs/superpowers/specs/2026-09-01-runy-i-kwalifikatory-
// -design.md): pieczęcie dłoniowe (weles/perun/szczur) i Splot z pozy
// (mokoszSplot.js) odeszły - zastąpione trzema runami kreślonymi w powietrzu
// (koło/Mokosz, zygzak/Perun, fala/Stribog) x stanem dłoni (otwarta/pięść).
// Piramidka Swaroga (żywioł ognia) ZOSTAJE bez zmian - jedyna dłoniowa
// pieczęć, która działała pewnie, bo jej kształt sam wymusza rozsunięcie
// nadgarstków, czyli prześwit, którego potrzebuje detektor.
export const KOMBOSY = [
    // Swaróg -> Perun (dający): ogień, potem piorun. Sekwencja wraca do
    // swojego PIERWOTNEGO znaczenia sprzed przebudowy - piramidka zostaje,
    // więc znowu mówi to, co jej nazwa.
    { id: 'gromWOgniu',   nazwa: 'Grom w Ogniu',   sekwencja: ['swarog', 'perun-otwarta'], uzbraja: 'ogien' },

    // Mokosz (biorąca) x2 -> Zew Podziemia. Zbieranie mocy w pięść, dwa razy
    // pod rząd - czyta się jako rytuał "branie", nie jako lista wejść.
    { id: 'zewPodziemia', nazwa: 'Zew Podziemia',  sekwencja: ['mokosz-piesc', 'mokosz-piesc'], uzbraja: 'ogien' },

    // Stribog (dający) x2 -> Aard. Wiatr kreślony dwa razy pod rząd otwartą
    // dłonią - "wypuszczenie" pasuje do podmuchu bardziej niż do pięści.
    { id: 'aard', nazwa: 'Podmuch Striboga', sekwencja: ['stribog-otwarta', 'stribog-otwarta'], uzbraja: 'aard' },

    // Mokosz (dająca) x3 -> Tecza. TRZY złożenia, nie dwie - dłuższy rytuał
    // niż Ogień/Aard, bo nagroda jest darmowa przez 30 s (żaden dalszy
    // koszt), więc próg wejścia jest wyższy. uzbraja: 'tecza' NIE pasuje do
    // wzorca uzbrój-potem-gest (Ogień/Aard czekają na osobny gest gracza) -
    // main.js routuje tę gałąź na natychmiastową aktywację, bez drugiego
    // gestu.
    { id: 'tecza', nazwa: 'Wstęga Mokoszy', sekwencja: ['mokosz-otwarta', 'mokosz-otwarta', 'mokosz-otwarta'], uzbraja: 'tecza' }
];

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
