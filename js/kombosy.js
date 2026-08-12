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
export const KOMBOSY = [
    // Swaróg -> Perun: ogień, potem piorun. To także najwygodniejsza para do
    // złożenia po sobie - z namiotu (10 palców) do Tygrysa (4) wystarczy
    // złożyć kciuk, serdeczny i mały.
    { id: 'gromWOgniu',   nazwa: 'Grom w Ogniu',   sekwencja: ['swarog', 'perun'], uzbraja: 'ogien' },
    { id: 'zewPodziemia', nazwa: 'Zew Podziemia',  sekwencja: ['weles', 'swarog'], uzbraja: 'ogien' },

    // Weles x2 -> Aard. Pieczęć Szczura (poprzedni wyzwalacz) okazała się
    // niepewna w łapaniu na żywo - odpięta na razie (js/znaki/szczurDlon.js
    // zostaje na dysku). Weles jest już zweryfikowany jako niezawodny, więc
    // Aard uzbraja się jego podwójnym złożeniem zamiast nowego znaku.
    // Podwójne złożenie to PRZYTRZYMANIE jednej postawy przez dwa cykle
    // pierścienia - pieczecie.js po złożeniu zaczyna następny od nowa przy
    // tej samej postawie, więc rytuał nie wymaga nowej mechaniki.
    // UWAGA: trzeci Weles z rzędu odpali TEN kombos PONOWNIE (dopasowanie do
    // końcówki bufora) - to celowe zachowanie łańcuchów; ponowne uzbrojenie
    // uzbrojonej techniki jest no-opem. Weles -> Swaróg dalej odpala Zew
    // Podziemia niezależnie - sekwencje mają się nakładać, nie wykluczać.
    { id: 'aard', nazwa: 'Podmuch Striboga', sekwencja: ['weles', 'weles'], uzbraja: 'aard' },

    // Splot x3 -> Tecza. TRZY złożenia, nie dwie - dłuższy rytuał niż
    // Ogień/Aard, bo nagroda jest darmowa przez 30 s (żaden dalszy koszt),
    // więc próg wejścia jest wyższy. uzbraja: 'tecza' NIE pasuje do wzorca
    // uzbrój-potem-gest (Ogień/Aard czekają na osobny gest gracza) -
    // main.js routuje tę gałąź na natychmiastową aktywację, bez drugiego
    // gestu. Splot to nowy znak z ciała (skrzyżowane ramiona), nie z dłoni -
    // patrz js/znaki/mokoszSplot.js.
    { id: 'tecza', nazwa: 'Wstęga Mokoszy', sekwencja: ['splot', 'splot', 'splot'], uzbraja: 'tecza' }
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
