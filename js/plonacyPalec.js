/**
 * Płonący palec - pierwsza technika KANAŁOWANA.
 *
 * Wszystkie dotychczasowe efekty są typu "odpal i zapomnij": mają stały czas
 * i nikt nimi nie steruje. Ta żyje tak długo, jak gracz ją prowadzi, i zjada
 * moc - dzięki temu taniec ma sens także po odblokowaniu techniki.
 *
 * Pętla: taniec -> moc -> kombos -> malowanie ogniem -> taniec.
 *
 * Nie rysuje. Rysowaniem zajmuje się js/ogien.js, który nie wie nic
 * o pieczęciach ani o mocy.
 *
 * ================== STANY ==================
 *
 *   BEZCZYNNY   brak kombosa
 *      |  kombos (uzbrojenie, BEZ licznika - licznik to presja)
 *      v
 *   GOTOWY
 *      |  jeden palec wysunięty, opuszek NAD LINIĄ BARKÓW
 *      v
 *   PLONIE  --- palec schowany ------> BEZCZYNNY
 *           --- moc wyczerpana ------> BEZCZYNNY
 *
 * SCHOWANIE PALCA KOŃCZY TECHNIKĘ, nie wstrzymuje. Decyzja właściciela gry
 * i słuszna: zakończenie techniki własnym ruchem to nie kara, to KONTROLA.
 * Pauza odbierałaby graczowi możliwość zgaszenia ognia, kiedy chce.
 *
 * ALE: "palec schowany" i "tracking się zgubił" to DWA RÓŻNE SYGNAŁY i nie
 * wolno ich mylić. Zgłoszone z testu: przy słabym świetle wykrywanie dłoni
 * przeskakuje - dłoń znika na moment i wraca. Traktowanie tego jak schowania
 * palca kończyło technikę bez woli gracza, po kilku sekundach ognia.
 *
 *   dłoń widoczna, palec zwinięty  ->  gracz CHCIAŁ skończyć  -> krótka zwłoka
 *   dłoni nie ma wcale             ->  tracking się ZGUBIŁ    -> długa zwłoka
 *
 * Krótka zwłoka istnieje tylko po to, żeby jedna zaszumiona klatka nie gasiła
 * ognia; jest na tyle mała, że zgaszenie nadal czuje się natychmiastowe.
 *
 * PŁOMIEŃ TRZYMA SIĘ RĘKI, KTÓRA GO ZAPALIŁA. Zgłoszone z testu: przy dwóch
 * dłoniach w kadrze ogień przeskakiwał na palec drugiej, opuszczonej ręki.
 * Powód: zaczep był wybierany OD NOWA w każdej klatce jako najlepiej oceniona
 * dłoń, więc gdy druga ręka choćby na moment wypadła lepiej, płomień do niej
 * skakał. Teraz kandydat musi być BLISKO ostatniego zaczepu - dopuszczalny
 * przeskok rośnie z czasem zwłoki, bo po dłuższym zaniku dłoń mogła się
 * naprawdę przesunąć. Stronność (lewa/prawa) jest miękką preferencją, nie
 * twardym filtrem, bo MediaPipe potrafi ją pomylić przy zbliżonych dłoniach.
 *
 * "Nad barkiem" to warunek ZAPŁONU, nie trzymania. Po zapaleniu można wodzić
 * palcem gdziekolwiek, także nisko - trzymanie ręki w górze przez pół minuty
 * bolałoby, a to ma być relaks.
 */
import { pelnaDlon, wzorPalcow, OPUSZKI, rampa } from './znaki/dlon.js';
import { BARK_L, BARK_P } from './znaki/postawa.js';

// ZGADNIĘTE - potwierdzić z nakładki (klawisz D).
//
// ZAPŁON i UTRZYMANIE mają RÓŻNE kryteria, i to jest istotne.
//
// Zapłon pyta "czy wystawiasz DOKŁADNIE JEDEN palec" - iloczyn wyprostowania
// najwyższego palca i złożenia pozostałych. To surowe, bo zapłon ma być
// świadomym gestem.
//
// Utrzymanie pyta tylko "czy ten palec NADAL jest wyprostowany". Zgłoszone
// z testu: płomień gasł za łatwo nawet bez szybkiego ruchu. Powód - iloczyn
// jest bezlitosny. Przy palcu 0.9 i niedokładnie zwiniętym środkowym 0.6
// wynik to 0.36, czyli tuż nad starym progiem 0.35; wystarczyło drgnięcie
// oświetlenia. A prawdziwa dłoń nigdy nie zwija palców idealnie.
//
// Raz zapalony ogień gasi więc dopiero ZŁOŻENIE PALCA - nie rozluźnienie
// pozostałych. Zaciśnięcie dłoni w pięść zbija wyprostowanie do zera i
// kończy technikę, tak jak ma być.
// OBNIŻONY z 0.55. Iloczyn "jeden palec x złożenie pozostałych" jest surowy:
// przy wskazującym 1.0 i środkowym niedokładnie zwiniętym na 0.5 wynik to
// tylko 0.50. Podniesiona, CELOWO wystawiona ręka nie przebijała więc progu,
// a rozluźniona opuszczona - owszem, bo jej palce układały się czyściej.
// To prawdopodobnie główna przyczyna zgłoszenia "zapala się palec opuszczonej
// ręki". Ten sam błąd co przy progu utrzymania.
//
// Rozróżnianie przeniosło się na WYSOKOŚĆ (nad barkiem + najwyżej podniesiona
// dłoń), więc warunek kształtu może być łagodniejszy bez utraty pewności:
// kształt mówi "wskazujesz", wysokość mówi "chcesz tego".
const PROG_WSKAZANIA = 0.40;      // zapłon: "dokładnie jeden palec"

// Jak surowo drugi palec WETUJE zapłon.
//
// Pierwotny wzór v1 * (1 - v2) był bezlitosny: przy wskazującym 1.00 i tylko
// NA WPÓŁ wyprostowanym środkowym (0.66) ocena spadała do 0.34. A prawdziwa
// dłoń przy wskazywaniu prawie zawsze trzyma środkowy na wpół wyprostowany.
//
// Nie można tu użyć ŚREDNIEJ pozostałych palców zamiast maksimum, bo wtedy
// DWA palce w górę też zapalałyby ogień - a to pieczęć Peruna i konflikt
// byłby gwarantowany. Dlatego zostaje maksimum, ale z pasmem tolerancji:
// weto działa dopiero, gdy drugi palec jest WYRAŹNIE wyprostowany.
//
//   drugi palec 0.50 lub mniej -> brak weta      (wskazywanie, luźna dłoń)
//   drugi palec 0.66           -> ocena x 0.54   (przechodzi)
//   drugi palec 0.85 lub więcej -> weto pełne    (dwa palce, otwarta dłoń)
const WETO_DRUGIEGO_OD = 0.85;
const WETO_DRUGIEGO_DO = 0.50;
const PROG_UTRZYMANIA = 0.30;     // utrzymanie: sam palec nadal wyprostowany
const ALFA_UTRZYMANIA = 0.35;     // wygładzanie, żeby jedna klatka szumu nie liczyła się
const NAD_BARKIEM = 0.02;      // ile ponad linią barków, w wysokościach kadru

// Barki muszą być WIDOCZNE, żeby linia barków cokolwiek znaczyła.
//
// Zgłoszone z testu: zapalał się palec opuszczonej ręki, mimo że warunek
// "nad barkiem" był w kodzie i się wykonywał. Powód: przy kamerze laptopa
// i graczu blisko obiektywu MediaPipe ZGADUJE pozycję barków. Gdy umieści je
// nisko albo poza kadrem, opuszczona ręka faktycznie jest "nad linią barków"
// i warunek przestaje cokolwiek odsiewać.
const PROG_WIDOCZNOSCI_BARKU = 0.5;

// Zapas na wypadek niepewnych barków: opuszek musi być w GÓRNEJ części kadru.
// Warunek bezwzględny, niezależny od jakości pozy.
const GORNA_CZESC_KADRU = 0.45;

// O ile wyżej musi być ręka zapalająca od każdej innej widocznej dłoni.
// To jest odpowiedź na sedno zgłoszenia: zapala się ta ręka, którą PODNOSISZ.
const PRZEWAGA_WYSOKOSCI = 0.08;

// Pobór MUSI być pokonywalny tańcem, inaczej moc stoi w miejscu i pętla gry
// się nie zamyka.
//
// Zgłoszone z testu: przy ruchu moc się nie odnawiała. Rachunek: przy 1/30
// pobór to 0.033/s, a przyrost przy tańcu z JEDNĄ RĘKĄ TRZYMANĄ W GÓRZE
// wychodzi około tyle samo - MotionMeter uśrednia nadgarstki i łokcie, a ręka
// wskazująca jest z konieczności nieruchoma i obniża średnią o połowę.
// Wychodził remis, który wygląda jak zastój.
//
// 1/50 daje 50 s ognia z pełnego paska i zostawia wyraźny zapas: przy
// umiarkowanym tańcu przyrost ~0.05/s bije pobór 0.02/s, więc pasek rośnie
// nawet w trakcie płonięcia.
const KOSZT_NA_SEKUNDE = 1 / 50;

// Zwłoki przed zakończeniem techniki. Rozdzielone, bo rozdzielone są przyczyny.
const ZWLOKA_BRAK_DLONI = 0.7;   // s - tracking zgubiony, czekamy na powrót
// 0.16 s było za krótkie: każde drgnięcie odczytu gasiło ogień. Ale samo
// wygładzanie sygnału utrzymania daje już ~0.15 s odporności, więc zwłoka
// nie musi być długa - razem wychodzi ~0.4 s od zaciśnięcia pięści do
// zgaszenia, co nadal czyta się jako reakcja na gest, nie jako opóźnienie.
const ZWLOKA_ZLOZENIA = 0.25;    // s - świadome schowanie palca

// Jak szybko zaczep może się przemieszczać, w znormalizowanych jednostkach
// kadru na sekundę. Ogranicznik NIE jest po to, żeby spowolnić płomień -
// jest po to, żeby nie MÓGŁ przeskoczyć na drugą rękę.
//
// Dlatego jest HOJNY. Przy 3.0 (pierwsza wersja) szybkie machnięcie palcem
// wypadało poza limit i płomień gasł - a wodzenie palcem to sedno tej techniki.
// 10 kadrów na sekundę to ~0.17 kadru na klatkę przy 60 FPS: przepuszcza
// najszybszy realny zamach, a druga ręka jest zwykle 0.3-0.5 kadru dalej,
// więc nadal jej nie dosięgnie.
//
// Dopuszczalny skok rośnie WYŁĄCZNIE z czasem, w którym nie było widać ŻADNEJ
// dłoni. To rozróżnienie jest konieczne: przy zaniku trackingu dłoń mogła się
// niezauważenie przesunąć, więc limit musi rosnąć. Ale gdy dłonie SĄ widoczne
// i żadna nie pasuje, palec został schowany - rosnący limit pozwalał wtedy
// płomieniowi przeskoczyć na drugą, opuszczoną rękę po ułamku sekundy.
const MAX_PREDKOSC_ZACZEPU = 10.0;
// Kara za inną stronność - używana tylko jako rozstrzygnięcie ostateczne,
// gdy stronność jest nieznana. Przy znanej stronności filtrujemy TWARDO
// (patrz _kontynuacja), bo kara 0.06 była zbyt słaba: przy rękach trzymanych
// blisko siebie druga dłoń mieściła się w limicie przeskoku i płomień
// przeskakiwał, dając efekt "wystrzeliwanego ognia".
const KARA_ZA_INNA_REKE = 0.5;

// Palce liczone bez kciuka - jak we wszystkich pieczęciach. Kciuk jest
// najmniej pewnym punktem dłoni, a wskazywanie z odstawionym kciukiem
// jest całkowicie naturalne.
const BEZ_KCIUKA = [1, 2, 3, 4];

export class PlonacyPalec {
    constructor() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;      // {x, y} w znormalizowanych koordynatach płótna
        this.sila = 0;           // 0..1 - do sterowania ogniem
        this.wskazanie = 0;      // diagnostyka: jak wyraźnie jeden palec wystaje
        this.zwloka = 0;         // ile już czekamy na powrót palca [s]
        this.powodZwloki = null; // 'brak dłoni' | 'palec złożony' - do nakładki
        this._reka = null;       // stronność ręki, która zapaliła ogień
        this._czasNiewidzenia = 0; // ile trwa brak JAKIEJKOLWIEK dłoni [s]
        this._utrzymanie = 0;      // wygładzone wyprostowanie płonącego palca
        this.barkiNiepewne = false; // diagnostyka: czy poza dała pewne barki
    }

    /** Kombos złożony - technika uzbrojona. Bez licznika ważności. */
    uzbrój() {
        if (this.stan === 'BEZCZYNNY') this.stan = 'GOTOWY';
    }

    /**
     * @param {object} frame
     * @param {number} moc  0..1
     * @param {number} dt
     * @returns {number} ile mocy pobrać w tej klatce (0, jeśli nic)
     */
    update(frame, moc, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const kandydaci = this._kandydaci(frame);
        this.wskazanie = kandydaci.length
            ? Math.max(...kandydaci.map(k => k.wynik)) : 0;

        // Czas bez ŻADNEJ dłoni w kadrze - tylko on rozluźnia ogranicznik skoku.
        const maDlonie = (frame.hands ?? []).some(d => pelnaDlon(d.landmarks));
        this._czasNiewidzenia = maDlonie ? 0 : this._czasNiewidzenia + krok;

        if (this.stan === 'BEZCZYNNY') {
            this.zaczep = null;
            this.sila = 0;
            return 0;
        }

        if (this.stan === 'GOTOWY') {
            this.sila = 0;
            this.zaczep = null;
            // Zapłon: NAJWYŻEJ PODNIESIONY kandydat nad linią barków.
            //
            // Wybieramy po WYSOKOŚCI, nie po ocenie gestu. Wcześniej brany był
            // najlepiej oceniony kandydat, więc opuszczona ręka z przypadkowo
            // lepszym układem palców wygrywała z ręką celowo podniesioną.
            // Gracz podnosi rękę, żeby zapalić - to podniesienie ma decydować.
            let zapalny = null;
            for (const k of kandydaci) {
                if (k.wynik < PROG_WSKAZANIA) continue;
                if (!this._nadBarkiem(frame, k.opuszek)) continue;
                // Oś Y rośnie w dół, więc niższe y = wyżej na ekranie.
                if (!zapalny || k.opuszek.y < zapalny.opuszek.y) zapalny = k;
            }

            // I musi być WYRAŹNIE wyżej niż każda inna widoczna dłoń.
            if (zapalny && !this._najwyzejPodniesiona(frame, zapalny)) zapalny = null;
            if (zapalny) {
                this.stan = 'PLONIE';
                this.zaczep = zapalny.opuszek;
                this._reka = zapalny.reka;
                this.sila = 1;
                this.zwloka = 0;
                this.powodZwloki = null;
                this._utrzymanie = zapalny.wyprost;
            }
            return 0;
        }

        // PLONIE
        if (!(moc > 0)) {
            this._zgas();
            return 0;
        }

        const dalszy = this._kontynuacja(kandydaci, krok);

        // Wygładzenie: jedna zaszumiona klatka nie może decydować o zgaszeniu.
        const alfa = Math.min(1, krok / 0.05) * ALFA_UTRZYMANIA;
        this._utrzymanie += alfa * ((dalszy ? dalszy.wyprost : 0) - this._utrzymanie);

        if (dalszy || this._utrzymanie >= PROG_UTRZYMANIA) {
            // Palec na miejscu - zerujemy zwłokę i przesuwamy zaczep.
            this.zwloka = 0;
            this.powodZwloki = null;
            if (dalszy) {
                this.zaczep = dalszy.opuszek;
                if (dalszy.reka) this._reka = dalszy.reka;
            }
            // Bez kandydata zaczep zostaje na ostatniej pozycji - wygładzony
            // sygnał utrzymania niesie technikę przez pojedyncze przeskoki.
        } else {
            // Palca nie widać. ROZRÓŻNIAMY, dlaczego.
            this.powodZwloki = maDlonie ? 'palec złożony' : 'brak dłoni';
            this.zwloka += krok;

            if (this.zwloka > (maDlonie ? ZWLOKA_ZLOZENIA : ZWLOKA_BRAK_DLONI)) {
                this._zgas();
                return 0;
            }
            // Zaczep zostaje na ostatniej znanej pozycji - płomień czeka
            // w miejscu, zamiast skakać albo gasnąć na czas przeskoku trackingu.
        }
        // Siła słabnie razem z resztką mocy - płomień dopala się, zamiast
        // zniknąć w jednej klatce.
        this.sila = Math.max(0.25, Math.min(1, moc * 3));

        return Math.min(moc, KOSZT_NA_SEKUNDE * krok);
    }

    _zgas() {
        this.stan = 'BEZCZYNNY';
        this.zaczep = null;
        this.sila = 0;
        this.zwloka = 0;
        this.powodZwloki = null;
        this._reka = null;
        this._czasNiewidzenia = 0;
        this._utrzymanie = 0;
    }

    /**
     * Który kandydat jest KONTYNUACJĄ płonącego palca.
     *
     * Nie "najlepiej oceniony", bo to właśnie powodowało przeskakiwanie ognia
     * na drugą rękę. Wybieramy najbliższego ostatniemu zaczepowi, i tylko
     * jeśli mieści się w dopuszczalnym skoku - inaczej wolimy uznać palec za
     * chwilowo zgubiony i przeczekać, niż teleportować płomień.
     */
    _kontynuacja(kandydaci, krok) {
        if (!this.zaczep) return null;

        const zdatni = kandydaci.filter(k => k.wyprost >= PROG_UTRZYMANIA);
        if (!zdatni.length) return null;

        // STRONNOŚĆ NAJPIERW, i to twardo.
        //
        // Jeśli wśród kandydatów jest ręka o tej samej stronności co ta, która
        // zapaliła ogień, rozpatrujemy TYLKO ją. Sama odległość nie wystarczała:
        // przy rękach trzymanych blisko siebie druga dłoń mieściła się
        // w limicie przeskoku i płomień na nią przeskakiwał.
        //
        // MediaPipe podaje stronność pewnie, dopóki dłonie są rozdzielone,
        // a gdy ją pomyli albo nie poda - schodzimy na samą odległość.
        const tejSamejReki = this._reka
            ? zdatni.filter(k => k.reka === this._reka)
            : [];
        const pula = tejSamejReki.length ? tejSamejReki : zdatni;

        const limit = MAX_PREDKOSC_ZACZEPU * (krok + this._czasNiewidzenia);
        let wybrany = null, najlepszaKara = Infinity;

        for (const k of pula) {
            const d = Math.hypot(k.opuszek.x - this.zaczep.x, k.opuszek.y - this.zaczep.y);
            if (d > limit) continue;   // za daleko - to nie ta sama ręka

            const kara = d + (this._reka && k.reka && k.reka !== this._reka
                              ? KARA_ZA_INNA_REKE : 0);
            if (kara < najlepszaKara) { najlepszaKara = kara; wybrany = k; }
        }
        return wybrany;
    }

    /**
     * WSZYSTKIE dłonie z oceną "dokładnie jeden wyprostowany palec".
     *
     * Zwracamy listę, nie zwycięzcę. Wybieranie zwycięzcy tutaj było błędem:
     * przy dwóch dłoniach w kadrze ogień przeskakiwał na tę, która w danej
     * klatce wypadła lepiej, nawet jeśli była opuszczona przy ciele.
     * Kto jest kontynuacją płomienia, decyduje _kontynuacja() na podstawie
     * odległości od ostatniego zaczepu.
     *
     * Ocena jest ciągła: najwyższy palec razy (1 - drugi najwyższy). Wysoka
     * tylko wtedy, gdy jeden wystaje, a pozostałe są złożone.
     */
    _kandydaci(frame) {
        const out = [];
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            const wzor = wzorPalcow(d.landmarks);

            let i1 = -1, v1 = -1, v2 = -1;
            for (const i of BEZ_KCIUKA) {
                const v = wzor[i];
                if (v > v1) { v2 = v1; v1 = v; i1 = i; }
                else if (v > v2) { v2 = v; }
            }
            if (i1 < 0) continue;

            const idx = OPUSZKI[i1];
            out.push({
                // Do ZAPŁONU: czy wystawiony jest dokładnie jeden palec.
                wynik: v1 * rampa(v2, WETO_DRUGIEGO_OD, WETO_DRUGIEGO_DO),
                // Do UTRZYMANIA: czy ten palec jest nadal wyprostowany.
                wyprost: v1,
                opuszek: { x: d.landmarks[idx].x, y: d.landmarks[idx].y },
                reka: d.handedness ?? null
            });
        }
        return out;
    }

    /**
     * Oś Y rośnie W DÓŁ, więc "nad barkami" to y MNIEJSZE od linii barków.
     *
     * Linia barków liczy się tylko wtedy, gdy barki są WIDOCZNE. Przy graczu
     * blisko kamery laptopa MediaPipe je zgaduje, a zgadnięte nisko barki
     * przepuszczały opuszczoną rękę. Gdy nie są pewne, schodzimy na warunek
     * bezwzględny: opuszek w górnej części kadru.
     */
    _nadBarkiem(frame, opuszek) {
        if (!Number.isFinite(opuszek.y)) return false;

        // Bez pozy NIE MA zapłonu. Zapas "górna część kadru" jest po to, żeby
        // ratować niepewne barki, a nie po to, żeby całkiem znieść warunek -
        // gracz zgłasza, że zapala się ZA ŁATWO, więc rozluźnianie tu byłoby
        // krokiem w złą stronę.
        const lm = frame.pose?.landmarks;
        if (!lm) return false;

        const bl = lm[BARK_L], bp = lm[BARK_P];
        const pewneBarki = bl && bp
            && (bl.visibility ?? 1) >= PROG_WIDOCZNOSCI_BARKU
            && (bp.visibility ?? 1) >= PROG_WIDOCZNOSCI_BARKU;

        if (pewneBarki) {
            const yBarkow = (bl.y + bp.y) / 2;
            if (Number.isFinite(yBarkow)) return opuszek.y < yBarkow - NAD_BARKIEM;
        }
        this.barkiNiepewne = true;
        return opuszek.y < GORNA_CZESC_KADRU;
    }

    /**
     * Czy to NAJWYŻEJ PODNIESIONA dłoń w kadrze.
     *
     * Sedno zgłoszenia: gracz podnosi prawą rękę, a zapala się palec
     * opuszczonej lewej. Porównanie z KAŻDĄ widoczną dłonią (nie tylko
     * z kandydatami na wskazywanie) rozstrzyga to bez oglądania się na jakość
     * pozy - opuszczona ręka jest po prostu niżej.
     */
    _najwyzejPodniesiona(frame, kandydat) {
        for (const d of (frame.hands ?? [])) {
            if (!pelnaDlon(d.landmarks)) continue;
            // Nadgarstek jako reprezentant dłoni - stabilniejszy niż opuszki,
            // które przy wskazywaniu mocno się przemieszczają.
            const y = d.landmarks[0].y;
            if (!Number.isFinite(y)) continue;
            if (y < kandydat.opuszek.y + PRZEWAGA_WYSOKOSCI) {
                // Ta dłoń jest wyżej albo na podobnej wysokości. Jeśli to nie
                // jest dłoń kandydata, zapłon jest niejednoznaczny.
                const toKandydat = Math.hypot(d.landmarks[0].x - kandydat.opuszek.x,
                                              d.landmarks[0].y - kandydat.opuszek.y) < 0.25;
                if (!toKandydat) return false;
            }
        }
        return true;
    }
}
