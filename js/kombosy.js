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
//
// Eksportowane: js/sekwencja.js (pasek run u dołu ekranu) liczy z NIEGO
// zanik pojedynczego slotu, żeby slot gasł DOKŁADNIE wtedy, gdy wpis
// wypada z bufora kombosów - kopia lokalna rozjechałaby się po cichu przy
// każdej przyszłej zmianie tutaj, ten sam powód co eksport PROG_POSTAWY
// z pieczecie.js.
export const OKNO_MS = 6500;

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
    // WARIANTY TĘCZY Z PRZYTRZYMANĄ WODĄ (2026-10-09, Dodola). Trzymana dłużej
    // miska składa się ponownie (js/pieczecie.js - pierścień zeruje się i
    // zaczyna od nowa), a ogon mokosz->mokosz->stribog to Dodola. Bez tych
    // wpisów Tęcza z odrobinę za długo trzymaną wodą dawałaby deszcz. Zasada:
    // ogień na początku -> Tęcza, bez ognia -> deszcz. MUSZĄ stać przed Dodolą
    // (_dopasuj bierze pierwszy pasujący); `wariant` zwalnia je ze strażnika
    // prefiksów/sufiksów w test-kombosy.mjs, który pilnuje za to kolejności.
    // `sekwencjaPunktow`: wariant jest WART tyle co zwykła Tęcza (js/punkty.js
    // wartoscTechniki) - przytrzymana miska nie może płacić więcej.
    { id: 'tecza', nazwa: 'Wstęga Mokoszy', wariant: true,
      sekwencja: ['swarog', 'mokosz', 'mokosz', 'stribog'], uzbraja: 'tecza',
      sekwencjaPunktow: ['swarog', 'mokosz', 'stribog'] },
    { id: 'tecza', nazwa: 'Wstęga Mokoszy', wariant: true,
      sekwencja: ['swarog', 'mokosz', 'mokosz', 'mokosz', 'stribog'], uzbraja: 'tecza',
      sekwencjaPunktow: ['swarog', 'mokosz', 'stribog'] },

    // Ogień -> błyskawica. Nazwa mówi to, co robi sekwencja.
    { id: 'gromWOgniu', nazwa: 'Grom w Ogniu',
      sekwencja: ['swarog', 'perun'], uzbraja: 'ogien' },

    // Powietrze x2 -> Aard. Wiatr złożony dwa razy pod rząd.
    { id: 'aard', nazwa: 'Podmuch Striboga',
      sekwencja: ['stribog', 'stribog'], uzbraja: 'aard' },

    // GROM W ZIEMIĘ (2026-09-08): pierwsza technika ziemi. Kuźnia (Swaróg)
    // rozgrzewa skorupę, piorun (Perun) bije w rozgrzaną ziemię (Weles) -
    // mit Peruna kontra Welesa, centralny konflikt słowiańskiej mitologii.
    // Trzy pieczęcie, aktywacja NATYCHMIASTOWA jak Tęcza - `uzbraja`
    // wskazuje na WŁASNE id (nie na osobną technikę czekającą na gest),
    // main.js routuje tę gałąź osobno, tak samo jak dla 'tecza'.
    { id: 'gromWZiemie', nazwa: 'Grom w Ziemię',
      sekwencja: ['swarog', 'weles', 'perun'], uzbraja: 'gromWZiemie' },

    // KOŁOWRÓT (2026-09-09): domknięcie mitu Gromu w Ziemię. Piorun (Perun)
    // uderzył w ziemię (Weles) - centralny konflikt słowiańskiej mitologii -
    // a Mokosz, prządka losu, zamyka krąg wodą i koło toczy się dalej.
    // Sekwencja CELOWO omija ognia i powietrze - z tools/test-rozdzielnosc.mjs
    // na prawdziwych nagraniach: woda 0.97-1.00, ziemia 0.95-1.00, błyskawica
    // 0.70-1.00, a ogień 0.21-0.59 i powietrze 0.40-0.93. Każde wcześniejsze
    // combo poza Aardem zaczynało się od ognia, czyli od najsłabiej
    // rozpoznawanej pieczęci - to combo ma być pierwszym, które da się
    // odpalić powtarzalnie. `weles` nadal NIGDY nie rozpoczyna żadnej
    // sekwencji (zaczyna się od peruna) - ten sam inwariant, na którym
    // opiera się komentarz przy teście k2 niżej w tools/test-kombosy.mjs.
    // Pierwsza technika w grze zbudowana na gotowych teksturach (Kenney
    // Particle Pack, CC0) - patrz js/kolowrot.js.
    { id: 'kolowrot', nazwa: 'Kołowrót',
      sekwencja: ['perun', 'weles', 'mokosz'], uzbraja: 'kolowrot' },

    // OKADZENIE (2026-09-11, spec docs/superpowers/specs/2026-09-11-okadzenie
    // -dym-design.md): pierwsza technika KANAŁOWANA uzbrajana kombosem
    // trójelementowym. Ogień -> wiatr -> ogień - dym to żar niesiony
    // wiatrem, powtórzony dwa razy dla wagi tego combo (życzenie właściciela
    // gry). Jak Płonący Palec, `uzbraja` wskazuje na osobną technikę
    // czekającą na GEST (dłoń przy ustach), nie odpala się natychmiastowo -
    // main.js routuje tę gałąź razem z 'ogien'/'aard'.
    //
    // CELOWA KOLIZJA OGONA z Gromem w Ogniu: swarog->stribog->swarog->perun
    // dopasowuje NAJPIERW Okadzenie (ogon długości 3 w chwili trzeciej
    // pieczęci), a zaraz potem, bez czyszczenia bufora, Grom w Ogniu (ogon
    // [swarog, perun] w chwili czwartej pieczęci) - dokładnie łańcuch "dym,
    // potem zapałka", jakiego wymaga podpalenie dymu. Patrz test-kombosy.mjs.
    { id: 'dym', nazwa: 'Okadzenie',
      sekwencja: ['swarog', 'stribog', 'swarog'], uzbraja: 'dym' },

    // KAMIENNA TARCZA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // ziemia złożona trzy razy - odłamki krążą wokół tułowia. Jedyne nowe
    // POWTÓRZENIE w tej partii (wybór właściciela gry). Weles po raz pierwszy
    // ZACZYNA sekwencję - test k2 w test-kombosy.mjs startuje teraz od mokosz.
    // Natychmiastowa jak Kołowrót (`uzbraja` = własne id).
    { id: 'kamiennaTarcza', nazwa: 'Kamienna Tarcza',
      sekwencja: ['weles', 'weles', 'weles'], uzbraja: 'kamiennaTarcza' },

    // KURZAWA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md): wiatr
    // (Stribog) podrywa ziemię (Weles) - lej pyłu wokół tancerza. Para
    // stribog->weles nie jest prefiksem/sufiksem żadnej trójki. Łańcuch:
    // stribog->weles->weles->weles daje Kurzawę, potem Kamienną Tarczę.
    { id: 'kurzawa', nazwa: 'Kurzawa',
      sekwencja: ['stribog', 'weles'], uzbraja: 'kurzawa' },

    // ŁUK PERUNA (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // woda przewodzi piorun - łuk elektryczny między dłońmi. Obie pieczęcie
    // należą do najpewniej rozpoznawanych. Łańcuch: Kołowrót kończy się na
    // mokosz, więc dołożony po nim perun odpala Łuk.
    { id: 'lukPeruna', nazwa: 'Łuk Peruna',
      sekwencja: ['mokosz', 'perun'], uzbraja: 'lukPeruna' },

    // KRĘGI MOKOSZY (2026-10-03, zastąpiły Wodną Kulę z 2026-10-02):
    // Mokosz - "Mać Ziemia Wilgotna" - gracz stoi po pas w wodzie, od ciała
    // rozchodzą się kręgi fal. Mokosz zaczyna Łuk i Kręgi: druga pieczęć
    // rozstrzyga, jak rozgałęzienie w bijatyce. Łańcuch: mokosz->weles×3
    // daje Kręgi, potem Kamienną Tarczę.
    { id: 'kregiMokoszy', nazwa: 'Kręgi Mokoszy',
      sekwencja: ['mokosz', 'weles'], uzbraja: 'kregiMokoszy' },

    // MGŁA MOKOSZY (2026-10-02, spec 2026-10-02-proste-kombosy-design.md):
    // wiatr (Stribog) niesie wilgoć (Mokosz) - mgła przetacza się przez
    // kadr, gracz wynurza się z niej. Para stribog->mokosz nie koliduje
    // z Tęczą (ta kończy się mokosz->stribog, odwrotnie).
    { id: 'mglaMokoszy', nazwa: 'Mgła Mokoszy',
      sekwencja: ['stribog', 'mokosz'], uzbraja: 'mglaMokoszy' },

    // BANIA (2026-10-06): woda (Mokosz) na rozgrzane ciało (Swaróg) - para
    // bucha z głowy, barków i łokci. Dwójka, więc skromna i krótka (~1.4 s).
    // Para mokosz->swarog nie jest prefiksem/sufiksem żadnej trójki (Tęcza
    // zaczyna się swarog->mokosz, odwrotnie). Łańcuch: Kołowrót kończy się
    // na mokosz, więc dołożony po nim swarog odpala Banię.
    { id: 'bania', nazwa: 'Bania',
      sekwencja: ['mokosz', 'swarog'], uzbraja: 'bania' },

    // GRZMOT (2026-10-08, spec 2026-10-08-grzmot-i-zawierucha-design.md):
    // błyskawica (Perun) rozdziera powietrze (Stribog) - fala uderzeniowa
    // z klatki piersiowej. Pierwsza dwójka OTWIERANA przez Peruna. Dwójka
    // "działająca na pole": dziura w Mgle, szarpnięcie Kurzawy, rozrzucony
    // dym (js/reakcjeTechnik.js). Para perun->stribog nie jest prefiksem/
    // sufiksem żadnej trójki. Łańcuch: Grzmot + stribog = Podmuch Striboga.
    { id: 'grzmot', nazwa: 'Grzmot',
      sekwencja: ['perun', 'stribog'], uzbraja: 'grzmot' },

    // ZAWIERUCHA (2026-10-08, ten sam spec): ziemia (Weles) oddaje pył
    // wiatrowi (Stribog) - poryw w poprzek kadru, odwrotność Kurzawy
    // (stribog->weles). Pierwsza dwójka OTWIERANA przez Welesa. Kanałowana
    // lekko: okno 1.5 s na machnięcia ręką (js/machniecie.js), bez machnięcia
    // poryw rusza sam. Para weles->stribog nie jest prefiksem/sufiksem żadnej
    // trójki. Łańcuchy: Zawierucha + weles = Kurzawa, + mokosz = Mgła Mokoszy.
    { id: 'zawierucha', nazwa: 'Zawierucha',
      sekwencja: ['weles', 'stribog'], uzbraja: 'zawierucha' },

    // BŁĘDNE OGNIKI (2026-10-08, ten sam spec): Weles - władca zaświatów
    // i pasterz dusz - wypuszcza duszyczki z ziemi, Swaróg je rozpala.
    // Kończy się ogniem (najsłabiej rozpoznawanym) - świadomy wybór
    // właściciela gry. Para weles->swarog nie jest prefiksem/sufiksem żadnej
    // trójki. Łańcuchy: + perun = Grom w Ogniu; + stribog + swarog =
    // Okadzenie, którego dym ogniki od razu podpalą.
    { id: 'bledneOgniki', nazwa: 'Błędne Ogniki',
      sekwencja: ['weles', 'swarog'], uzbraja: 'bledneOgniki' },

    // DODOLA (2026-10-09, spec 2026-10-09-dodola-zaklinanie-design.md):
    // nabierasz wody do miski (woda trzymana dłużej = druga woda), wiatr ją
    // unosi - pierwsza technika ZAKLINANIA: natężenie deszczu steruje jakość
    // falowania rozpostartych ramion (js/deszcz.js). Para mokosz->mokosz nie
    // jest żadną dwójką, mokosz->stribog też - po drodze nic nie odpala.
    // Kolizja z Tęczą rozwiązana wariantami wyżej.
    { id: 'dodola', nazwa: 'Dodola',
      sekwencja: ['mokosz', 'mokosz', 'stribog'], uzbraja: 'dodola' }
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

    /**
     * Kopia bufora wciąż w oknie, NAJSTARSZE Z PRZODU - do odczytu przez
     * pasek sekwencji (js/sekwencja.js). NIE MUTUJE bufora (w przeciwieństwie
     * do dodaj(), który przycina go przy okazji): odczyt HUD/UI nie może
     * mieć efektów ubocznych na silniku kombosów.
     *
     * @param {number} now  performance.now() w ms
     * @returns {{id: string, t: number}[]}
     */
    aktywne(now) {
        if (!Number.isFinite(now)) return [];
        return this.bufor.filter(w => now - w.t <= this.okno);
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
