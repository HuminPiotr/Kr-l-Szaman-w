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
import { pelnaDlon, wzorPalcow, OPUSZKI } from './znaki/dlon.js';
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
const PROG_WSKAZANIA = 0.55;      // zapłon: "dokładnie jeden palec"
const PROG_UTRZYMANIA = 0.30;     // utrzymanie: sam palec nadal wyprostowany
const ALFA_UTRZYMANIA = 0.35;     // wygładzanie, żeby jedna klatka szumu nie liczyła się
const NAD_BARKIEM = 0.02;      // ile ponad linią barków, w wysokościach kadru

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
            // Zapłon: NAJLEPSZY kandydat, który jest nad linią barków.
            // Sprawdzanie tego tylko na najwyżej ocenionej dłoni powodowało,
            // że opuszczona ręka z lepszym wynikiem blokowała zapłon.
            let zapalny = null;
            for (const k of kandydaci) {
                if (k.wynik < PROG_WSKAZANIA) continue;
                if (!this._nadBarkiem(frame, k.opuszek)) continue;
                if (!zapalny || k.wynik > zapalny.wynik) zapalny = k;
            }
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
                wynik: v1 * (1 - v2),
                // Do UTRZYMANIA: czy ten palec jest nadal wyprostowany.
                wyprost: v1,
                opuszek: { x: d.landmarks[idx].x, y: d.landmarks[idx].y },
                reka: d.handedness ?? null
            });
        }
        return out;
    }

    /** Oś Y rośnie W DÓŁ, więc "nad barkami" to y MNIEJSZE od linii barków. */
    _nadBarkiem(frame, opuszek) {
        const lm = frame.pose?.landmarks;
        if (!lm || !lm[BARK_L] || !lm[BARK_P]) return false;
        const yBarkow = (lm[BARK_L].y + lm[BARK_P].y) / 2;
        if (!Number.isFinite(yBarkow) || !Number.isFinite(opuszek.y)) return false;
        return opuszek.y < yBarkow - NAD_BARKIEM;
    }
}
