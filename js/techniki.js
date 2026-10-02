/**
 * Dispatch pieczęci i technik - WYCIĄGNIĘTY z main.js (2026-09-21), żeby
 * stanowisko VFX bez kamery (tools/scena.html) mogło odpalać DOKŁADNIE to,
 * co main.js odpala przy prawdziwej grze, zamiast trzymać równoległą,
 * łatwo rozjeżdżającą się reimplementację.
 *
 * Dwie funkcje, jeden worek zależności `s` (moduły gry - main.js przekazuje
 * swoje żywe instancje, tools/scena.html może przekazać te same klasy,
 * uruchomione na syntetycznej klatce). Żadna z funkcji nie mutuje HUD
 * (`ostatniKomunikat`) ani `motionMeter` - to zostaje w main.js, bo dotyczy
 * stanu gry (pasek mocy, komunikat), nie samego efektu.
 *
 * Komentarze przeniesione VERBATIM z main.js - to jest najgęściej
 * skomentowany blok w całej grze, tłumaczący DLACZEGO każda technika robi
 * to, co robi (barwy, kolejność, siła stała vs. z paska mocy).
 */
import { TABELA as EFEKTY_TABELA, srodekDloni } from './efekty.js';
import { pekniecieZiemi } from './iskry.js';
import { kregSylwetki, BARWA_MGLA as BARWA_KOLOWROTU } from './kolowrot.js';
import { BOGOWIE } from './jaja.js';

// Barwa czoła fali Gromu w Ziemię - fiolet Welesa (efekty.js weles: 280°),
// PODBITY do pełnego nasycenia (nie dosłowna konwersja HSL->RGB), bo
// fala.js rysuje przez 'lighter': muszony fiolet, który dobrze czyta się
// jako pieczęć, gaśnie do bladego różu pod addytywnym blendowaniem, jeśli
// nie jest wystarczająco nasycony na starcie.
export const BARWA_GROMU = [190, 100, 255];

/**
 * Barwy zapłonu sylwetki (js/zaplon.js) per TECHNIKA (pole `uzbraja`
 * z js/kombosy.js) - jeden wpis na każdą z czterech technik, nie na
 * pojedynczą pieczęć: zapłon jest nagrodą za COMBO, tak samo jak
 * fala/iskry przy Gromie w Ziemię. Barwy dobrane z tego samego rejestru
 * co efekty.js TABELA (przybliżone RGB odpowiedniej barwy HSL, podbite do
 * pełnego nasycenia z tego samego powodu co BARWA_GROMU wyżej).
 */
export const BARWA_ZAPLONU = {
    ogien: [255, 140, 40],        // pomarańcz Swaroga (efekty.js swarog: 25°)
    aard: [140, 235, 195],        // mięta Striboga (efekty.js stribog: 160°)
    // Tęcza nie ma JEDNEJ barwy z definicji - biel czyta się jako "cała
    // paleta naraz", zamiast fałszywie wybierać jeden odcień z siedmiu.
    tecza: [255, 255, 255],
    gromWZiemie: BARWA_GROMU,
    // Turkus mgły Kołowrotu (js/kolowrot.js) - JEDNO ŹRÓDŁO PRAWDY (import,
    // nie powielona wartość), żeby zapłon sylwetki i sam efekt zawsze grały
    // tą samą barwą.
    kolowrot: BARWA_KOLOWROTU,
    // Jasna, chłodna szarość - dym jeszcze nie płonie w chwili uzbrojenia
    // combo (patrz efekty.js TABELA.dym - ten sam powód, ta sama barwa).
    dym: [210, 210, 220],
    kamiennaTarcza: [170, 120, 230]   // fiolet-kamień Welesa
};

/**
 * Pieczęć się złożyła - efekt WSPÓLNY dla każdej złożonej pieczęci,
 * niezależnie od tego, czy dopełniła combo. Runa (js/runa.js) zastępuje
 * dawną animację okręgu; zaczep TEN SAM, którego używa efekty.js dla
 * wszystkich efektów pieczęci (środek dłoni), barwa z TEJ SAMEJ tabeli -
 * jedno źródło prawdy.
 *
 * @param {string} id  id złożonej pieczęci
 * @param {object} frame  kontrakt klatki
 * @param {number} W  szerokość płótna w px
 * @param {number} H  wysokość płótna w px
 * @param {{efekty, runy, aura}} s
 */
export function odpalPieczec(id, frame, W, H, s) {
    s.efekty.odpal(id);
    s.runy.odpal(id, srodekDloni(frame, W, H), EFEKTY_TABELA[id]?.barwa);
    s.aura.rozblysk(1);
    // Bez dźwięku: gra nie ma efektów dźwiękowych (decyzja 2026-10-01), tylko pieśni rund.
}

/**
 * Combo się dopełniło - uzbraja/odpala WŁAŚCIWĄ technikę i odpala warstwę
 * wspólną (zapłon sylwetki + wstrząs ekranu) dla wszystkich czterech.
 *
 * @param {{id, nazwa, uzbraja, sekwencja}} technika  z kombosy.js
 * @param {object} frame  kontrakt klatki
 * @param {number} W  szerokość płótna w px
 * @param {number} H  wysokość płótna w px
 * @param {number} now
 * @param {{efekty, sekwencja, kombosy, aura, zaplon, ekran, plonacyPalec,
 *          podmuch, tecza, piorun, fala, iskry, kolowrot, dmuchanie, kamiennaTarcza}} s
 */
export function odpalTechnike(technika, frame, W, H, now, s) {
    s.efekty.odpal(technika.id);
    // Pasek sekwencji "wiąże" ogon bufora, który właśnie trafił -
    // po t (znacznik czasu), NIE po pozycji, więc kolejne pieczęcie
    // dodane PO tym combo nie dziedziczą więzi (js/sekwencja.js
    // nagłówek). Bufor sam NIE jest czyszczony - kombosy.js
    // nagłówek, łańcuchy są celowe.
    s.sekwencja.oznaczCombo(s.kombosy.bufor.slice(-technika.sekwencja.length), technika.nazwa, now);
    s.aura.rozblysk(1);
    // Zapłon sylwetki (js/zaplon.js) i wstrząs ekranu (js/ekran.js) -
    // WARSTWA WSPÓLNA dla WSZYSTKICH czterech technik, nie tylko
    // Gromu w Ziemię (ten dostaje DODATKOWO falę+iskry+grzmot
    // w gałęzi niżej). Siła stała (1.0) z tego samego powodu co
    // przy Gromie w Ziemię - technika jest gratis, efekt nie może
    // być karą za niski pasek mocy.
    s.zaplon.zapal(BARWA_ZAPLONU[technika.uzbraja] ?? [255, 255, 255], 1.0);
    s.ekran.uderz(1.0);
    // Kombos uzbraja technikę WSKAZANĄ POLEM `uzbraja` - dopóki
    // technika była jedna, bezwarunkowe uzbrajanie ognia było
    // w porządku; przy dwóch trzeba routować.
    // Bez licznika ważności - licznik byłby presją ("szybciej!"),
    // a to ma być relaks.
    if (technika.uzbraja === 'ogien') {
        s.plonacyPalec.uzbrój();
    } else if (technika.uzbraja === 'aard') {
        s.podmuch.uzbrój();
    } else if (technika.uzbraja === 'tecza') {
        // Nagroda odpala się NATYCHMIAST, bez drugiego gestu -
        // inaczej niż 'ogien'/'aard', które tylko UZBRAJAJĄ technikę
        // czekającą na osobny gest gracza. aktywuj() (re)startuje
        // licznik do pełnych 30 s bezwarunkowo.
        s.tecza.aktywuj();
    } else if (technika.uzbraja === 'gromWZiemie') {
        // Aktywacja NATYCHMIASTOWA jak Tęcza. Siła STAŁA (1.0), NIE
        // pochodna motionMeter.moc - combo jest gratis, efekt nie
        // może być karą za niski pasek mocy. Bez motionMeter.zuzyj()
        // z tego samego powodu - w przeciwieństwie do gałęzi
        // podmuchu niżej, tu nic nie jest "kupowane" z paska mocy.
        const zaczepPx = pekniecieZiemi(frame, W, H);
        // Piorun UDERZA PIERWSZY (js/piorun.js) - dopiero w niego
        // pęka ziemia i tryskają iskry. To jedyny efekt w grze
        // z prawdziwą, twardą krawędzią zamiast kolejnej miękkiej
        // plamy - patrz nagłówek piorun.js. Ta sama barwa co fala,
        // żeby cała sekwencja czytała się jako JEDNO zdarzenie.
        s.piorun.uderz(zaczepPx, BARWA_GROMU, 1.0);
        // Kierunek {0,-1,0} daje w fala.js pierścień w płaszczyźnie
        // POZIOMEJ (prostopadłej do "w górę") - "pęknięcie ziemi,
        // energia wybucha na boki i w głąb", nie fontanna.
        //
        // BARWA_GROMU: fiolet Welesa, jasny wariant jego pieczęci
        // (efekty.js weles: 280°) - fala.js domyślnie jest blada
        // niebieska (barwa Aarda), a ta sama fala niosła oba combosy
        // nie do odróżnienia dopóki wystrzel() nie przyjął barwy.
        s.fala.wystrzel(zaczepPx, { x: 0, y: -1, z: 0 }, 1.0, BARWA_GROMU);
        s.iskry.wystrzel(zaczepPx, 1.0);
    } else if (technika.uzbraja === 'kolowrot') {
        // Aktywacja NATYCHMIASTOWA jak Tęcza i Grom w Ziemię. Siła
        // STAŁA (1.0) z tego samego powodu - combo jest gratis.
        // Zaczep na TUŁOWIU (kregSylwetki, nie pekniecieZiemi) -
        // krąg rośnie WOKÓŁ tancerza (pas -> nad głowę), nie leży
        // na niewidocznej podłodze. Patrz nagłówek kolowrot.js.
        const kolko = kregSylwetki(frame, W, H);
        s.kolowrot.zapal(kolko, kolko.skala, H, 1.0);
    } else if (technika.uzbraja === 'dym') {
        // Trzecia technika KANAŁOWANA (jak 'ogien'/'aard') - uzbraja,
        // nie odpala natychmiast. Gest aktywacji: js/dmuchanie.js.
        s.dmuchanie.uzbrój(now);
    } else if (technika.uzbraja === 'kamiennaTarcza') {
        // Natychmiastowa jak Kołowrót, siła STAŁA (combo jest gratis). Zaczep
        // (barki) moduł liczy SAM co klatkę - patrz js/sledzenie.js.
        s.kamiennaTarcza.zapal(1.0);
    }
    // KAŻDE inne combo gasi POTENCJAŁ Okadzenia (produkcję), ale NIE
    // kasuje już wydmuchane kłęby - js/dmuchanie.js nagłówek "PAUZA,
    // NIE KONIEC". Bez tego nie byłoby drogi do podpalenia dymu:
    // podpalenie wymaga Gromu w Ogniu, czyli WŁAŚNIE "innego combo".
    if (technika.uzbraja !== 'dym') s.dmuchanie.anuluj();
}

/**
 * Jajo z nickiem-bogiem (js/jaja.js): krótki, bezpieczny efekt na ekranie Kroniki.
 * NIE uzbraja technik, NIE pobiera mocy, NIE dotyka kombosów - to tylko widowisko,
 * dlatego worek `s` jest węższy niż w odpalTechnike (test używa Proxy, które rzuca
 * na każdą zależność spoza listy).
 *
 * @param {string|null} bog  z bogZNicku()
 * @param {object} frame  kontrakt klatki
 * @param {number} W
 * @param {number} H
 * @param {{piorun, ekran, zaplon, fala, tecza, iskry, efekty}} s
 */
export function odpalJajo(bog, frame, W, H, s) {
    if (!BOGOWIE.includes(bog)) return;   // nieznany bóg/null: nic - i bez efekty.odpal(nieznane id)
    const ziemia = pekniecieZiemi(frame, W, H);
    if (bog === 'perun') {
        s.piorun.uderz(ziemia, BARWA_GROMU, 1.0);
        s.ekran.uderz(1.0);
        return;
    }
    s.efekty?.odpal(bog);   // ta sama animacja co przy złożeniu pieczęci tego żywiołu
    if (bog === 'swarog') {
        s.zaplon.zapal(BARWA_ZAPLONU.ogien, 1.0);
    } else if (bog === 'stribog') {
        s.fala.wystrzel(ziemia, { x: 0, y: -1, z: 0 }, 1.0, BARWA_ZAPLONU.aard);
    } else if (bog === 'mokosz') {
        s.tecza.aktywuj();
    } else if (bog === 'weles') {
        s.iskry.wystrzel(ziemia, 1.0);
        s.fala.wystrzel(ziemia, { x: 0, y: -1, z: 0 }, 1.0, BARWA_GROMU);
    }
}
