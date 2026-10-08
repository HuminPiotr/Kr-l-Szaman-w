import { HandTracker } from './handTracker.js';
import { PoseTracker } from './poseTracker.js';
import { AudioEngine } from './audioEngine.js';
import { DebugHud } from './debugHud.js';
import { MotionMeter } from './motionMeter.js';
import { Plynnosc } from './plynnosc.js';
import { Aura } from './aura.js';
import { ZnakRegistry } from './znaki/registry.js';
import { swarogDlon } from './znaki/swarogDlon.js';
import { weles } from './znaki/weles.js';
import { perun } from './znaki/perun.js';
import { stribog } from './znaki/stribog.js';
import { mokosz } from './znaki/mokosz.js';
import { aktualizujSkale } from './znaki/postawa.js';
import { SkladaniePieczeci } from './pieczecie.js';
import { KomboSilnik } from './kombosy.js';
import { Punktacja } from './punkty.js';
import { WynikHud } from './wynikHud.js';
import { Przebieg, decyzjaKlawisza } from './przebieg.js';
import { parsujKonfiguracje, WYBRZMIENIE_S, PIESN_AWARYJNA_S } from './tryby.js';
import { swiezeModuly } from './swiezeModuly.js';
import { wczytajManifest, Piesn, PiesnYoutube, utworzPiesn, utworZPliku, utworYoutube, wyciagnijIdYoutube } from './piesni.js';
import { WlasnePiesni } from './wlasnePiesni.js';
import { RundaHud, widokRundy } from './rundaHud.js';
import { Menu } from './menu.js';
import { PolanaUi } from './polanaUi.js';
import { Ksiega, kluczKsiegi } from './ksiega.js';
import { zbudujKronike } from './kronika.js';
import { bogZNicku } from './jaja.js';
import { losoweImie } from './imiona.js';
import { czyPoleTekstowe } from './klawisze.js';
import { ZetonStartu } from './zeton.js';
import { Efekty, srodekDloni } from './efekty.js';
import { zaladujFont } from './glify.js';
import { Runy } from './runa.js';
import { PasekSekwencji } from './sekwencja.js';
import { Ogien } from './ogien.js';
import { PlonacyPalec } from './plonacyPalec.js';
import { Dmuchanie } from './dmuchanie.js';
import { Dym } from './dym.js';
import { Podmuch, PROG_PREDKOSCI, PROG_OTWARCIA, OGNISKO_KAMERY } from './podmuch.js';
import { Fala, pchniecieCzola } from './fala.js';
import { Tecza } from './tecza.js';
import { Iskry } from './iskry.js';
import { Zaplon } from './zaplon.js';
import { Ekran } from './ekran.js';
import { Piorun } from './piorun.js';
import { Kolowrot } from './kolowrot.js';
import { KamiennaTarcza } from './kamiennaTarcza.js';
import { MglaMokoszy } from './mglaMokoszy.js';
import { KregiMokoszy } from './kregiMokoszy.js';
import { LukPeruna } from './lukPeruna.js';
import { Kurzawa } from './kurzawa.js';
import { Bania } from './bania.js';
import { Grzmot } from './grzmot.js';
import { Zawierucha } from './zawierucha.js';
import { BledneOgniki } from './bledneOgniki.js';
import { zagrajGrzmot } from './dzwiekGrzmotu.js';
import { ReakcjeTechnik } from './reakcjeTechnik.js';
import { odpalPieczec, odpalTechnike, odpalJajo, BARWA_ZAPLONU } from './techniki.js';
import { Histereza } from './histereza.js';
import { zaladuj as zaladujAssety } from './assety.js';
import { computeCoverFit, drawVideoCover, mapLandmarks } from './frameMapper.js';
import { wzorPalcow, pelnaDlon, odlegloscNadgarstkow, zbieznoscOpuszek,
         skierowanaWGore, rownolegle, NAZWY_PALCOW } from './znaki/dlon.js';

// ODPIĘTE, NIE USUNIĘTE: powerBall.js, wiatr.js, znaki/szczurDlon.js,
// znaki/welesDlon.js, znaki/perunDlon.js, znaki/mokoszSplot.js, js/runy/*
// (definicje.js/slad.js/ksztalt.js/szablony.js/rysujSlad.js).
//
// PIĘĆ PIECZĘCI STYKU (2026-09-02, docs/superpowers/specs/2026-09-02-piec-
// -pieczeci-styku-design.md): runy kreślone nadgarstkiem w powietrzu (koło/
// Mokosz, zygzak/Perun, fala/Stribog) x stan dłoni odchodzą razem ze Splotem
// Mokoszy - kształt kreślony rzadko wychodzi daleko powyżej progu, więc
// kombosy nie mieściły się w oknie czasowym (patrz js/kombosy.js). W ich
// miejsce piątka znaków czytanych ze STYKU części ciała: Weles (ziemia,
// pięści na barkach), Stribog (powietrze, łokcie razem), Mokosz (woda,
// miska), Perun (błyskawica, iglica) - wszystkie cztery z pozy. Piramidka
// Swaroga (ogień) zostaje jedynym znakiem dłoniowym i od zadania 10 CZYTA
// TAKŻE POZĘ (`wymaga: 'both'`) - warunek wysokości odróżnia ją od iglicy
// Peruna, patrz znaki/swarogDlon.js.
//
// Dłonie są WPIĘTE - piramidka Swaroga ich potrzebuje. Zmierzone na żywym
// tańcu: ~60 FPS z ciałem i maską, więc 8 ms na dłonie mieści się z ogromnym
// zapasem.

// Ikony HUD instrukcji - runy zamiast emoji (Król Szamanów, 2026-09-14).
// CELOWO OSOBNY zestaw od GLIFY w js/glify.js (ᚲ ᚦ ᚢ ᚨ ᛚ - pięć pieczęci):
// HUD mówi o STANIE GRY (czekanie, ruch, pełnia mocy), nie o konkretnej
// pieczęci, więc dostaje własne, tematyczne runy. ᚲ i ᛚ są reużyte z GLIFY
// (ogień/przepływ pasują też tutaj), ᛞ (Dagaz - świt, przełom) i ᛗ (Mannaz -
// człowiek) są nowe. Żaden z zestawu ZAKAZANE (js/glify.js) tu nie wchodzi.
const IKONA = {
    ogien: 'ᚲ',       // czekanie na moc / ładowanie - żar
    plynie: 'ᛚ',       // ruch/przepływ - dzielona z Laguz (woda/przepływ)
    swit: 'ᛞ',         // pełna moc, technika, pieczęć złożona - przełom
    czlowiek: 'ᛗ'      // "pokaż się kamerze" - sylwetka człowieka
};

// BARWA_GROMU i BARWA_ZAPLONU przeniesione do js/techniki.js (P1.2,
// 2026-09-21) razem z dispatchem pieczęci/technik, który ich używa - tak
// samo importuje je tools/scena.html (stanowisko VFX), żeby odpalać
// DOKŁADNIE te same efekty co main.js. main.js importuje z powrotem tylko
// BARWA_ZAPLONU (BARWA_GROMU nie jest tu już potrzebne) - używane przy
// właściwym STRZALE Aarda (niżej, poza dispatchem uzbrojenia).

const uiLoadingScreen = document.getElementById('loading-screen');
const uiInstructionHud = document.getElementById('instruction-hud');
// Crossfade dwuwarstwowy (P4, 2026-09-21, patrz index.html) - dwie warstwy
// .komunikat w tej samej komórce grida; ustawKomunikat() niżej pisze do
// NIEAKTYWNEJ i przełącza .aktywny, więc opacity się krzyżuje zamiast
// twardo podmieniać textContent.
const uiKomunikatWarstwy = [...uiInstructionHud.querySelectorAll('.komunikat')];
let uiKomunikatAktywnaTresc = null;   // ostatni ustawiony tekst - po nim wykrywamy "nic się nie zmieniło"

/** Ustawia komunikat HUD z crossfade - no-op, gdy tekst jest identyczny z bieżącym. */
function ustawKomunikat(tekst, ikona) {
    if (tekst === uiKomunikatAktywnaTresc) return;
    uiKomunikatAktywnaTresc = tekst;
    const aktywna = uiKomunikatWarstwy.find(w => w.classList.contains('aktywny'));
    const nieaktywna = uiKomunikatWarstwy.find(w => w !== aktywna) ?? uiKomunikatWarstwy[0];
    nieaktywna.querySelector('.instruction-icon').textContent = ikona;
    nieaktywna.querySelector('.instruction-text').textContent = tekst;
    nieaktywna.classList.add('aktywny');
    aktywna?.classList.remove('aktywny');
}
const uiEnergyHud = document.getElementById('energy-hud');
const uiEnergyFill = document.getElementById('energy-fill');
const uiEnergyPercentage = document.getElementById('energy-percentage');
const uiSekwencjaRun = document.getElementById('sekwencja-run');
const uiSekwencjaSloty = document.getElementById('sekwencja-sloty');
const uiSekwencjaNazwa = document.getElementById('sekwencja-nazwa');
const uiAudioWskaznik = document.getElementById('audio-wskaznik');

const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

let handTracker = new HandTracker();
let poseTracker = new PoseTracker();
let audioEngine = new AudioEngine();
let debugHud = new DebugHud();
let motionMeter = new MotionMeter();
let plynnoscMiara = new Plynnosc();
let aura = null;

let znaki = new ZnakRegistry();
// Pięć pieczęci STYKU. Ogień czyta dłonie I pozę (piramidka - jedyna
// dłoniowa pieczęć, która działała pewnie, bo jej kształt sam wymusza
// prześwit między dłońmi; od zadania 10 dorzuca warunek wysokości z pozy,
// więc NIE JEST już "bez zmian" - patrz znaki/swarogDlon.js), pozostałe
// cztery czytają wyłącznie pozę.
znaki.zarejestruj(swarogDlon);   // ogień
znaki.zarejestruj(weles);        // ziemia
znaki.zarejestruj(perun);        // błyskawica
znaki.zarejestruj(stribog);      // powietrze
znaki.zarejestruj(mokosz);       // woda
let skladanie = new SkladaniePieczeci();
let kombosy = new KomboSilnik();
// Punktacja (2026-10-01, spec docs/superpowers/specs/2026-10-01-punktacja-design.md).
// PUSH zdarzeń w istniejących miejscach pętli, HUD czyta PULL co klatkę.
let punkty = new Punktacja();
const wynikHud = new WynikHud(document.getElementById('wynik-hud'));
// TRYBY (2026-10-01, spec docs/superpowers/specs/2026-10-01-tryby-design.md).
// `przebieg === null` = tryb SWOBODNY: bez punktów, bez końca, jak dawna gra.
// Brak parametrów w adresie = swobodny, więc licznik punktów już się nie pokazuje
// w jedynym trybie (konflikt z końcowego przeglądu podprojektu 1 zamknięty).
let przebieg = null;
let piesn = null;                 // Piesn bieżącej rundy (Obrzęd) albo null
let utworRundy = null;            // wpis z manifestu wybrany do Obrzędu
const rundaHud = new RundaHud(document.getElementById('runda-hud'));
punkty.aktywna = false;           // do pierwszej rundy
punkty.mnoznikZewu = (rodzaj, arg) => przebieg ? przebieg.mnoznikZewu(rodzaj, arg) : 1;
// MENU "Polana" (2026-10-01, podprojekt 3, spec 2026-10-01-polana-ksiega-design.md).
// Model Menu trzyma ekran i konfigurację, PolanaUi renderuje, main.js spina z grą.
// Księga na localStorage (try/catch w Ksiega - brak pamięci nie jest błędem).
const ksiega = new Ksiega((() => { try { return window.localStorage; } catch { return null; } })());
const menu = new Menu({ ostatniNick: ksiega.ostatniNick() });
let efektKroniki = null;   // {bog, korona} - odpalany w klatce, gdy istnieje `frame`
const zetonStartu = new ZetonStartu();
const wlasne = new WlasnePiesni({
    indexedDB: (() => { try { return window.indexedDB ?? null; } catch { return null; } })(),
    storage: (() => { try { return window.localStorage; } catch { return null; } })()
});
const BRAK_PIESNI = 'Ta pieśń nie chce zabrzmieć — spróbuj innego pliku.';
const polanaUi = new PolanaUi(document, {
    menu, ksiega, losoweImie,
    // Własne pieśni zwracają ciepłe zdanie zwrotne (pusty tekst = sukces bez komentarza).
    naPlik: async (file) => {
        try {
            const u = utworZPliku(file);
            if (!u) return 'To nie wygląda na plik dźwiękowy — spróbuj mp3, m4a albo wav.';
            const url = URL.createObjectURL(file);
            const probny = new Piesn({ ...u, url });
            const { ok, dlugoscS } = await probny.zaladuj();
            probny.zatrzymaj();
            URL.revokeObjectURL(url);
            if (!ok) return BRAK_PIESNI;
            const z = await wlasne.dodajPlik({ ...u, dlugoscS }, file);
            if (!z) return 'Plemię zna już dość pieśni — usuń którąś, żeby dopisać nową.';
            menu.dodajPiesn(z);
            return wlasne.trwala ? '' : 'Ta przeglądarka nie zapamięta pieśni po zamknięciu karty.';
        } catch { return BRAK_PIESNI; }
    },
    naLinkYt: async (tekst) => {
        try {
            const id = wyciagnijIdYoutube(tekst);
            if (!id) return 'To nie wygląda na link z YouTube.';
            const probny = new PiesnYoutube(utworYoutube(id));
            const { ok, dlugoscS } = await probny.zaladuj();
            const tytul = probny.tytul;
            probny.zatrzymaj();
            if (!ok) return 'Ten film nie chce grać poza YouTube — spróbuj innego (albo sprawdź internet).';
            const z = wlasne.dodajYt(utworYoutube(id, tytul, dlugoscS));
            if (!z) return 'Plemię zna już dość pieśni — usuń którąś, żeby dopisać nową.';
            menu.dodajPiesn(z);
            return '';
        } catch { return BRAK_PIESNI; }
    },
    naUsunPiesn: async (i) => {
        const u = menu.piesni[i];
        if (u && menu.usunPiesn(i)) await wlasne.usun(u.plik);
    },
    onStart: (konf) => rozpalOgien(konf),
    onJeszczeRaz: () => dalejZKroniki(),
    onDoPolany: () => doPolany()
});
// Manifest pieśni wczytuje się w tle - Obrzęd odblokowuje się, gdy dotrze.
Promise.all([wczytajManifest(), wlasne.wczytaj().catch(() => [])]).then(([lista, moje]) => {
    menu.ustawPiesni([...lista, ...moje]);
    // Skrót dewelopera: ?tryb=... wypełnia konfigurację (kamera i tak startuje z kliknięcia).
    menu.zUrl(parsujKonfiguracje(window.location.search));
    polanaUi.render();
});
polanaUi.render();
let efekty = new Efekty();
// Wielka runa przy dłoniach (js/runa.js) zastępuje dawny pierścień składania
// pieczęci; pasek sekwencji (js/sekwencja.js) czyta TEN SAM bufor kombosów
// przez kombosy.aktywne(now) co klatkę - PULL, nie zdarzenia, ten sam
// wzorzec co zarzewia dymu (main.js:625 nagłówek "pull-based").
let runy = new Runy();
let sekwencja = new PasekSekwencji(uiSekwencjaSloty, uiSekwencjaNazwa);
let ogien = new Ogien();
let plonacyPalec = new PlonacyPalec();
let dmuchanie = new Dmuchanie();
let dym = new Dym();
let podmuch = new Podmuch();
let fala = new Fala();
let tecza = new Tecza();
let iskry = new Iskry();
let zaplon = new Zaplon();
let ekran = new Ekran();
let piorun = new Piorun();
let kolowrot = new Kolowrot();
let kamiennaTarcza = new KamiennaTarcza();
let mglaMokoszy = new MglaMokoszy();
let kregiMokoszy = new KregiMokoszy();
let lukPeruna = new LukPeruna();
let kurzawa = new Kurzawa();
let bania = new Bania();
let grzmot = new Grzmot();
let zawierucha = new Zawierucha();
let bledneOgniki = new BledneOgniki();
let reakcjeTechnik = new ReakcjeTechnik();

// Ostatnia rzecz, którą gracz zrobił - HUD ma o niej mówić przez chwilę,
// zamiast natychmiast wracać do zaproszenia do tańca.
let ostatniKomunikat = null, ostatniKomunikatDo = 0;

let lastVideoTime = -1;
let isRunning = false;
let lastPoseResults = null;   // wynik PoseLandmarker z ostatniej klatki wideo
let lastHandResults = null;   // wynik HandLandmarker z ostatniej klatki wideo
let lastFrameTime = 0;

// Poprzednie pozycje nadgarstków (px) - do prędkości dłoni przy rozgarnianiu
// dymu (js/dym.js:rozgarnij()). { 15: {x,y}|undefined, 16: {x,y}|undefined }.
let poprzNadgarstkiPx = null;

// Histereza "moc pełna" (P4, 2026-09-21) - zastępuje gołe `moc >= 0.95`
// przy .charged-glow/.ready-pulse/komunikacie HUD. Wejście przy 0.95,
// wyjście przy 0.90 - GEMINI.md §2 "progi mają histerezę; nic nie miga
// na granicy", którego ten jeden punkt w kodzie dotąd nie przestrzegał
// (moc jest wygładzonym integratorem, więc w praktyce rzadko migało, ale
// bez pasma nic tego nie gwarantowało).
const pelnaMoc = new Histereza(0.95, 0.90);

// Maska sylwetki, przepisana na CPU. Trzymamy poza wynikiem detekcji, bo
// obiekt maski trzeba zwolnić od razu po odczycie (patrz pobierzMaske).
let maskaDane = null, maskaSzer = 0, maskaWys = 0;

// Skalowanie płótna do rozmiarów okna
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/** Wskaźnik dźwięku (P3, 2026-09-21) - odzwierciedla audioEngine.wyciszony w DOM. */
function odswiezWskaznikAudio() {
    const wyciszony = audioEngine.wyciszony;
    uiAudioWskaznik.textContent = wyciszony ? '♪̸' : '♪';
    uiAudioWskaznik.classList.toggle('wyciszony', wyciszony);
    uiAudioWskaznik.setAttribute('aria-pressed', String(wyciszony));
}
function przelaczDzwiek() {
    audioEngine.przelaczWyciszenie();
    piesn?.wycisz?.(audioEngine.wyciszony);   // pieśń z YouTube nie przechodzi przez magistralę
    odswiezWskaznikAudio();
}
uiAudioWskaznik.addEventListener('click', przelaczDzwiek);
// Klawisz M - własny listener, niezależny od debugHud.js (D/R/N/Z/1-8/Esc) -
// ten sam wzorzec rozdzielenia co osobny AudioContext debugHud.js dla
// dźwięków sesji nagrywania (nie chcemy jednego miejsca odpowiedzialnego
// za wszystkie skróty klawiszowe w grze, patrz debugHud.js nagłówek).
window.addEventListener('keydown', (e) => {
    // Nick w menu: litera 'm' to część imienia, nie wyciszenie (js/klawisze.js).
    if (czyPoleTekstowe(e.target)) return;
    if (e.key === 'm' || e.key === 'M') przelaczDzwiek();
});

// Strażnik przed podwójnym startem kamery: "Rozpal ogień" można kliknąć dwa razy
// podczas ładowania modeli - druga kamera, drugi model, druga pętla klatek.
// Menu dodatkowo blokuje przycisk (menu.zajety), a tu jest ostatnia linia obrony.
let startowano = false;

/** Kamera + modele + pętla klatek - RAZ na życie strony. @returns {Promise<boolean>} czy gra działa */
async function uruchomGre() {
    if (isRunning) return true;
    if (startowano) return false;
    startowano = true;
    uiLoadingScreen.classList.remove('hidden');
    try {
        // 2. Inicjalizacja kamery (WebRTC)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        video.srcObject = stream;
        // Czekamy na załadowanie metadanych, żeby znać oryginalne wymiary wideo
        await new Promise(resolve => { video.onloadedmetadata = () => resolve(); });
        video.play();
        // 3. Inicjalizacja AI (MediaPipe) + font run (js/glify.js: 3 s limit, NIGDY nie odrzuca).
        await Promise.all([poseTracker.initialize(), handTracker.initialize(), zaladujFont()]);
        // 3a. Assety Kołowrotu - CELOWO NIE await (brak assetu nigdy nie jest błędem, §2).
        zaladujAssety().catch(() => {});
        // 4. Aura tancerza
        aura = new Aura(canvas, ctx);
        uiLoadingScreen.classList.add('hidden');
        uiInstructionHud.classList.remove('hidden');
        uiEnergyHud.classList.remove('hidden');
        uiSekwencjaRun.classList.remove('hidden');
        document.getElementById('wynik-hud').classList.remove('hidden');
        uiAudioWskaznik.classList.remove('hidden');
        odswiezWskaznikAudio();
        isRunning = true;
        requestAnimationFrame(renderLoop);
        return true;
    } catch (e) {
        startowano = false;           // błąd kamery/modelu: wolno spróbować ponownie
        alert("Błąd dostępu do kamery lub inicjalizacji AI: " + e.message);
        console.error(e);
        uiLoadingScreen.classList.add('hidden');
        return false;
    }
}

/** "Rozpal ogień" z menu - to jedyny gest użytkownika, więc audio startuje TU, przed jakimkolwiek await. */
async function rozpalOgien(konfig) {
    if (menu.zajety) return;
    audioEngine.init();
    audioEngine.resume();
    menu.zajety = true; polanaUi.render();
    const dziala = await uruchomGre();
    menu.zajety = false;
    if (!dziala) { polanaUi.render(); return; }
    menu.naGre(); polanaUi.render();
    // Obrzęd: długość z metadanych i pieśń; swobodny: nic (przebieg === null, punkty wyłączone).
    uruchomZKonfiguracji({ ...konfig }).catch((e) => console.error('Tryb:', e));
}

/**
 * Przepisuje maskę segmentacji z GPU do zwykłej tablicy i ZWALNIA obiekt maski.
 *
 * Bez close() tekstury GPU zostają przy życiu klatka po klatce - to wyciek,
 * który przy 30 klatkach na sekundę widać po kilkunastu sekundach.
 */
function pobierzMaske(wynik) {
    const maski = wynik?.segmentationMasks;
    if (!maski || !maski.length) return;
    const m = maski[0];
    try {
        const dane = m.getAsUint8Array();
        if (!maskaDane || maskaDane.length !== dane.length) {
            maskaDane = new Uint8Array(dane.length);
        }
        maskaDane.set(dane);
        maskaSzer = m.width;
        maskaWys = m.height;
    } finally {
        m.close();
    }
}

/**
 * Kontrakt klatki - jedyny interfejs między trackingiem a resztą gry.
 *
 * hands zostaje pustą listą, żeby kontrakt się nie zmieniał, gdy dłonie
 * wrócą razem ze znakami.
 */
function buildFrame(fit, dt, now) {
    // W tasks-vision 0.10.3 pole nazywa się handednesses (liczba mnoga).
    const hands = [];
    if (lastHandResults?.landmarks) {
        for (let i = 0; i < lastHandResults.landmarks.length; i++) {
            hands.push({
                landmarks: mapLandmarks(lastHandResults.landmarks[i], fit),
                worldLandmarks: lastHandResults.worldLandmarks?.[i] ?? null,
                handedness: lastHandResults.handednesses?.[i]?.[0]?.categoryName ?? null
            });
        }
    }

    let pose = null;
    if (lastPoseResults?.landmarks?.length) {
        pose = {
            landmarks: mapLandmarks(lastPoseResults.landmarks[0], fit),
            worldLandmarks: lastPoseResults.worldLandmarks?.[0] ?? null
        };
    }
    return { hands, pose, width: canvas.width, height: canvas.height, dt, now };
}

// Połączenia między punktami dłoni - pięć łańcuchów palców plus poprzeczka
// przez nasady, żeby dłoń czytała się jako dłoń, a nie chmura kropek.
const SZKIELET = [
    [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]
];

function rysujDlonie(frame) {
    if (!frame.hands.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const dlon of frame.hands) {
        const lm = dlon.landmarks;
        if (!lm || lm.length < 21) continue;
        const px = (i) => ({ x: lm[i].x * frame.width, y: lm[i].y * frame.height });

        // Kość/żar zamiast dawnego cyjanu - Król Szamanów.
        ctx.strokeStyle = 'rgba(239, 227, 200, 0.28)';
        ctx.lineWidth = 3;
        for (const lancuch of SZKIELET) {
            ctx.beginPath();
            lancuch.forEach((i, k) => {
                const p = px(i);
                k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }

        // Opuszki jaśniej - to one niosą znaczenie pieczęci
        for (let i = 0; i < 21; i++) {
            const p = px(i);
            const opuszek = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
            ctx.fillStyle = opuszek ? 'rgba(255, 178, 71, 0.85)' : 'rgba(239, 227, 200, 0.40)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, opuszek ? 5 : 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

/**
 * Podpis sylwetki dłoni do nakładki.
 *
 * To NIE jest ozdoba - progi pieczęci są zgadywane, a to jedyne liczby,
 * z których da się je wystroić. Precedens: PROG_SZARPNIECIA i PROG_POSTAWY
 * oba były zgadnięte i oba wymagały odczytu z ekranu (GEMINI.md §6).
 */
function opiszDlonie(frame) {
    const h = frame.hands.filter(d => pelnaDlon(d.landmarks));
    if (!h.length) return null;

    const linie = h.map(d => {
        const w = wzorPalcow(d.landmarks);
        const wzor = w.map(v => v > 0.6 ? '1' : (v > 0.25 ? '~' : '0')).join('');
        const suma = w.reduce((a, b) => a + b, 0);
        return `${(d.handedness ?? '?').slice(0, 1)} ${wzor} ${suma.toFixed(1)} palc.` +
               `  góra ${skierowanaWGore(d.landmarks).toFixed(2)}`;
    });

    if (h.length === 2) {
        const [a, b] = [h[0].landmarks, h[1].landmarks];
        linie.push(`nadgarstki ${odlegloscNadgarstkow(a, b).toFixed(2)}` +
                   `  opuszki ${zbieznoscOpuszek(a, b).toFixed(2)}` +
                   `  równol. ${rownolegle(a, b).toFixed(2)}`);
    }
    return linie;
}

let bledyPetli = 0, ostatniBladPetli = null;

/**
 * Pętla renderowania jest ODPORNA na wyjątki i to nie jest ostrożnościowa
 * ozdoba.
 *
 * Wyjątek w dowolnym podsystemie leciał wcześniej przed requestAnimationFrame
 * na końcu funkcji, więc pętla przestawała się przeplanowywać i CAŁA GRA
 * zamierała na ostatniej klatce - bez komunikatu, bez śladu na ekranie.
 * Zdarzyło się to naprawdę: literówka w nazwie metody (motionMeter.pobierz,
 * której nigdy nie było) zawieszała grę w chwili zapalenia ognia i wyglądało
 * to jak zwis, a nie jak błąd.
 *
 * Teraz błąd jest GŁOŚNY (konsola + nakładka), ale gra żyje dalej.
 * Przeplanowanie idzie przez finally, więc żadna ścieżka wyjścia go nie omija.
 */
function renderLoop(now) {
    if (!isRunning) return;
    try {
        klatka(now);
    } catch (e) {
        bledyPetli++;
        ostatniBladPetli = e?.message ?? String(e);
        if (bledyPetli === 1) console.error('Błąd w pętli renderowania:', e);
    } finally {
        if (isRunning) requestAnimationFrame(renderLoop);
    }
}

/**
 * Równy start: NOWE instancje wszystkich modułów ze stanem rundy (js/swiezeModuly.js)
 * + zerowanie stanu pętli, który żyje w main.js. W Kręgu następny gracz nie może
 * odziedziczyć uzbrojonego Aarda, chmury dymu ani paska mocy poprzednika.
 */
function resetujModuly() {
    ({ motionMeter, plynnoscMiara, skladanie, kombosy, efekty, runy, sekwencja, ogien,
       plonacyPalec, dmuchanie, dym, podmuch, fala, tecza, iskry, zaplon, ekran, piorun,
       kolowrot, kamiennaTarcza, kurzawa, lukPeruna, kregiMokoszy, mglaMokoszy, bania, grzmot, zawierucha, bledneOgniki, reakcjeTechnik } = swiezeModuly({ slotySekwencji: uiSekwencjaSloty, nazwaSekwencji: uiSekwencjaNazwa }));
    poprzNadgarstkiPx = null;
    ostatniKomunikat = null;
    ostatniKomunikatDo = 0;
}

/** Nowa pieśń na rundę (Obrzęd): nowy <audio> na gracza, ładuje się podczas zapowiedzi/odliczania. */
function przygotujPiesn() {
    piesn?.zatrzymaj();
    piesn = null;
    if (!utworRundy || przebieg?.konfig.tryb !== 'obrzed') return;
    piesn = utworzPiesn(utworRundy, { magistrala: (el) => audioEngine.podlaczPiesn(el), yt: { wyciszona: () => audioEngine.wyciszony } });
    piesn.naKoniec(() => przebieg?.zakonczPiesn());
    piesn.zaladuj();   // nie czekamy - runda ma >= 3 s odliczania; graj() sprawdza gotowość
}

function zakonczPrzebieg() {
    piesn?.zatrzymaj();
    piesn = null;
    przebieg = null;
    punkty.reset();
    punkty.aktywna = false;
    resetujModuly();
}

/** Esc w grze / "Do Polany" z Kroniki: bez zapisu, czysty start, menu na żywym obrazie. */
function doPolany() {
    zetonStartu.uniewaznij();   // oczekujący asynchroniczny start nie ma już prawa dokończyć
    zakonczPrzebieg();      // pieśń stop, moduły i punkty czyste
    efektKroniki = null;
    menu.doPolany();
    polanaUi.render();
}

/** Enter / "Jeszcze raz" na Kronice: następny gracz Kręgu albo ta sama runda od nowa. */
function dalejZKroniki() {
    if (!przebieg || !przebieg.dalej(performance.now())) return;
    resetujModuly();
    punkty.reset();
    przygotujPiesn();
    efektKroniki = null;
    menu.naGre();
    polanaUi.render();
}

/** Koniec rundy: zapis do Księgi, Kronika, jaja. Wołane raz, z obsluzZdarzeniaRundy('koniecRundy'). */
function pokazKronike(pods) {
    const klucz = kluczKsiegi(przebieg.konfig, utworRundy);
    const nick = pods.nick ?? String(przebieg.konfig.nick ?? '').trim();
    const wk = klucz && nick ? ksiega.dodaj(klucz, nick, pods.wynik, Date.now()) : null;
    if (!pods.nick && nick) ksiega.zapamietajNick(nick);
    if (wk?.wpisano) polanaUi.pokazSwiezy(klucz, nick.slice(0, 16), Math.floor(pods.wynik));
    menu.naKronike(zbudujKronike(pods, { wynikKsiegi: wk }));
    polanaUi.render();
    efektKroniki = { bog: bogZNicku(nick), korona: !!wk?.nowyRekord };
}

/** Zdarzenia rundy z tej klatki (Przebieg.update) -> reakcje gry. */
function obsluzZdarzeniaRundy(zdarzenia, now) {
    for (const z of zdarzenia) {
        if (z.typ === 'trwa') {
            // Równy start: pasek mocy, dym i uzbrojone techniki z odliczania nie liczą się.
            resetujModuly();
            punkty.reset();
            piesn?.graj().then((gra) => {
                if (!gra && piesn) {
                    ostatniKomunikat = `Duchy zgubiły pieśń ${IKONA.ogien}`;
                    ostatniKomunikatDo = performance.now() + 5000;
                }
            });
        } else if (z.typ === 'wybrzmienie') {
            piesn?.zanik(WYBRZMIENIE_S);
        } else if (z.typ === 'koniecRundy') {
            piesn?.zatrzymaj();
            piesn = null;
            // Zapis RAZ - Przebieg odrzuca drugie wywołanie. Kopie, bo punkty.reset() je wyczyści.
            const pods = przebieg.zapiszWynik(punkty.wynik, { ...punkty.rozbicie }, JSON.parse(JSON.stringify(punkty.momenty)));
            if (pods) pokazKronike(pods);
        }
    }
}

/** Uruchamia tryb z konfiguracji (adres teraz, menu w podprojekcie 3 - ta sama funkcja). */
async function uruchomZKonfiguracji(konfig) {
    if (konfig.tryb === 'swobodny') return;
    // Żeton: ten start trwa do kilku sekund (manifest z sieci, metadane audio). Esc na Polanę albo
    // wybór innego trybu w tym czasie unieważnia go - po każdym await sprawdzamy, czy jeszcze mamy prawo
    // dokończyć (inaczej spóźniona runda startuje pod menu i zapisuje wynik do Księgi).
    const zeton = zetonStartu.nowy();
    let konf = konfig;
    let utwor = null;
    if (konf.tryb === 'obrzed') {
        utwor = menu.piesni[konf.piesn] ?? null;   // manifest + własne (menu je już wczytało)
        if (!utwor) {
            // Brak pieśni nie jest błędem (§2) - Obrzęd zamienia się w próbę.
            konf = { ...konf, tryb: 'proba', dlugoscS: 90 };
            ostatniKomunikat = `Duchy zgubiły pieśń ${IKONA.ogien}`;
            ostatniKomunikatDo = performance.now() + 5000;
        } else {
            // YouTube: długość zapisana przy dodaniu, bez ponownego ładowania odtwarzacza.
            const probny = utwor.zrodlo === 'yt' ? null : new Piesn(utwor);
            const { ok, dlugoscS } = probny ? await probny.zaladuj() : { ok: utwor.dlugoscS > 0, dlugoscS: utwor.dlugoscS };
            probny?.zatrzymaj();
            if (!zetonStartu.aktualny(zeton)) return;
            // Długość z metadanych; niepoprawna -> awaryjna (tryb nadal obrzed, gra jak próba).
            konf = { ...konf, dlugoscS: ok ? dlugoscS : PIESN_AWARYJNA_S };
            if (!ok) {
                ostatniKomunikat = `Duchy zgubiły pieśń ${IKONA.ogien}`;
                ostatniKomunikatDo = performance.now() + 5000;
                utwor = null;
            }
        }
    }
    if (!zetonStartu.aktualny(zeton)) return;
    // utworRundy ustawiamy DOPIERO tu, po sprawdzeniach żetonu: moduł-wide zmienna nie może zdradzić
    // pieśni z przerwanego startu A rundzie B.
    utworRundy = utwor;
    przebieg = new Przebieg(konf);
    przygotujPiesn();
    przebieg.start(performance.now());
}

// Faza CAPTURE (trzeci argument true): ten handler musi przeczytać stan sesji
// nagraniowej debugHud PRZED jego własnym listenerem (DebugHud rejestruje go
// w konstruktorze, wcześniej niż my) - ten na Esc zeruje sesję, więc w fazie
// bubble `sesja.aktywna` byłoby już false i Esc przerywałby też rundę.
// preventDefault: Enter na podsumowaniu inaczej aktywowałby sfokusowany
// przycisk startu (kliknięty myszą zachowuje fokus) i uruchomił grę od nowa.
window.addEventListener('keydown', (e) => {
    const decyzja = decyzjaKlawisza(e.key, {
        stan: przebieg?.stan ?? null, sesjaAktywna: debugHud.sesja.aktywna, ekran: menu.ekran,
        fokusNaPrzycisku: document.activeElement?.tagName === 'BUTTON'
    });
    if (!decyzja) return;
    e.preventDefault();
    if (decyzja === 'polana') doPolany();
    else dalejZKroniki();
}, true);

function klatka(now) {

    // Bez wymiarów wideo computeCoverFit dzieli przez zero, ratio robi się
    // Infinity i WSZYSTKIE przemapowane punkty stają się NaN.
    if (!video.videoWidth || !video.videoHeight) return;

    // Klamrowane do 0.1 s (P2, 2026-09-21) - zakładka przeglądarki
    // uśpiona na kilka sekund (tab w tle, laptop wznowiony ze snu) dawałaby
    // JEDNĄ klatkę z gigantycznym dt: cząstki skaczą w jednej klatce
    // o setki pikseli, zegary technik przeskakują całe fazy naraz. Każdy
    // moduł VFX i tak klamrował dt LOKALNIE (0.05 w stepperach fizyki,
    // 0.1 w zegarach) jako osłonę - to jest ta sama osłona u ŹRÓDŁA, więc
    // wszystkie moduły (łącznie z aura.js, które NIE miało własnego
    // clampu) dostają rozsądny dt od samego początku, nie tylko te, które
    // pamiętały o obronie.
    const dt = lastFrameTime ? Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000)) : 0;
    lastFrameTime = now;
    debugHud.tick(now);

    // --- Rundy (tryby) ---
    // Przebieg liczy czas ze SKUMULOWANYCH przyciętych dt, więc zawieszona karta nie
    // przeskoczy rundy do końca. Punkty płyną tylko w TRWA i WYBRZMIENIU.
    if (przebieg) obsluzZdarzeniaRundy(przebieg.update(now), now);
    punkty.aktywna = !!przebieg && przebieg.stan === 'RUNDA' && przebieg.runda.punktuje;

    // --- 1. Podgląd z kamery ---
    const fit = computeCoverFit(video, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Wstrząs ekranu (js/ekran.js) opakowuje CAŁĄ resztę rysowania tej
    // klatki - translate/scale WEWNĄTRZ ctx, NIGDY jako CSS na elemencie
    // <canvas> (ten ma już scaleX(-1) na lustro - patrz style.css - drugi
    // transform by się z nim pobił, patrz nagłówek ekran.js). Sparowany
    // ctx.restore() jest niżej, tuż przed iskry.updateAndDraw() kończącym
    // rysowanie sceny; ekran.dokoncz() (winieta/bloom) idzie PO restore,
    // w układzie nieprzesuniętym - ma być stabilną ramką, nie drgać.
    ctx.save();
    ekran.przesun(ctx, canvas.width, canvas.height);

    // Płótno jest odwrócone przez CSS (scaleX(-1)), więc wideo działa jak lustro
    drawVideoCover(ctx, video, fit);

    // Przyciemnienie dla kontrastu - aura ma się na czym odcinać. Ciepły,
    // węglowy odcień (Król Szamanów) zamiast dawnego zimnego granatu -
    // paleta ognia/węgla z GEMINI.md §7.3.
    ctx.fillStyle = 'rgba(10, 5, 2, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- 2. Wykrywanie ciała (detekcja idzie na pomniejszonej klatce) ---
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const ts = performance.now();
        lastPoseResults = poseTracker.detect(video, ts);
        pobierzMaske(lastPoseResults);
        lastHandResults = handTracker.detect(video, ts);
    }

    // --- 3. Kontrakt klatki ---
    const frame = buildFrame(fit, dt, now);

    // --- 3a. Sesja nagraniowa (klawisz Z) ---
    // Zaraz po zbudowaniu klatki, przed jakąkolwiek interpretacją: nagranie
    // ma zawierać SUROWE landmarki, niezależne od tego, jak gra je dziś czyta.
    debugHud.aktualizujSesje(frame, dt);

    // --- 4. Płynność ruchu ---
    // Liczona z SUROWYCH worldLandmarks - filtr Savitzky'ego-Golaya robi
    // własne wygładzanie. Podanie tu pozycji już wygładzonych przez
    // MotionMeter zabiłoby sygnał, którego szukamy.
    const plynnosc = plynnoscMiara.update(frame.pose?.worldLandmarks ?? null, dt);

    // --- 4a. Skala ciała ---
    // RAZ NA KLATKĘ, PRZED znaki.ocen() - pięć znaków dzieli jedną wygładzoną
    // skalę barków; gdyby każdy liczył ją we własnym score(), wygładzanie
    // biegłoby pięć razy szybciej niż zakłada jego stała czasowa.
    aktualizujSkale(frame.pose?.worldLandmarks ?? null, dt);

    // --- 5. Postawy i składanie pieczęci ---
    // KOLEJNOŚĆ MA ZNACZENIE: składanie musi policzyć się PRZED mocą, bo
    // to ono decyduje, czy zanik jest w tej klatce zamrożony.
    const postawy = znaki.ocen(frame);

    // Rozbicie NAJLEPSZEJ pieczęci na warunki składowe.
    //
    // Wynik pieczęci to MINIMUM kilku warunków, więc samo "0.31" nie mówi,
    // KTÓRY z nich blokuje. Gracz odkrywał metodą prób, jak ułożyć palce,
    // żeby Perun zadziałał - to znaczy, że diagnostyka była za skąpa,
    // nie że gracz źle próbował.
    let rozbicie = null;
    {
        let najlepszaNazwa = null, najlepszy = -1;
        for (const [id, w] of Object.entries(postawy)) {
            if (w > najlepszy) { najlepszy = w; najlepszaNazwa = id; }
        }
        const znak = znaki.znaki.find(z => z.id === najlepszaNazwa);
        if (znak?.skladniki) {
            const sk = znak.skladniki(frame);
            if (sk) rozbicie = { id: najlepszaNazwa, sk };
        }
    }
    const skl = skladanie.update(postawy, motionMeter.moc, dt);

    // --- 6. Ciągłość ruchu razy płynność -> moc ---
    const moc = motionMeter.update(frame, plynnosc, skladanie.zamrazaZanik);

    // Jajo z nickiem-bogiem i koronacja za nowy rekord (Kronika): odpalane tu, bo dopiero
    // w tym miejscu klatki istnieje `frame` (zaczep efektów). Koronacja ostatnia - złoto wygrywa z zapłonem jaja.
    if (efektKroniki) {
        const e = efektKroniki; efektKroniki = null;
        odpalJajo(e.bog, frame, canvas.width, canvas.height, { piorun, ekran, zaplon, fala, tecza, iskry, efekty });
        if (e.korona) { zaplon.zapal([255, 200, 80], 1.0); ekran.uderz(0.6); }
    }

    // --- 6a. Pieczęć się złożyła ---
    // Dispatch efektów pieczęci/technik przeniesiony do js/techniki.js
    // (P1.2, 2026-09-21) - jedno źródło prawdy dzielone z tools/scena.html
    // (stanowisko VFX), żeby to, co odpala bench, było DOKŁADNIE tym, co
    // odpala prawdziwa gra, nie równoległą reimplementacją.
    // Pod menu (Polana/konfiguracja/Księga) pieczęcie i techniki są wyłączone: gracz stoi przed kamerą i
    // pisze nick, a Gromy z dźwiękiem za półprzezroczystym panelem byłyby zaskoczeniem (menu.graAktywna).
    if (skl.zlozona && menu.graAktywna) {
        motionMeter.zuzyj(skl.zlozona.koszt);
        // Punkty: pieczec() PRZED technika() - splecenie czyta ogon z własnej
        // historii pieczęci (js/punkty.js), więc ta pieczęć musi już w niej być.
        const miejscePunktow = srodekDloni(frame, canvas.width, canvas.height);
        punkty.pieczec(skl.zlozona.id, now, miejscePunktow);
        odpalPieczec(skl.zlozona.id, frame, canvas.width, canvas.height,
                     { efekty, runy, aura });

        const technika = kombosy.dodaj(skl.zlozona.id, now);
        if (technika) {
            punkty.technika(technika, now, miejscePunktow);
            odpalTechnike(technika, frame, canvas.width, canvas.height, now, {
                efekty, sekwencja, kombosy, aura, zaplon, ekran, plonacyPalec,
                podmuch, tecza, piorun, fala, iskry, kolowrot, dmuchanie, kamiennaTarcza, kurzawa, lukPeruna, kregiMokoszy, mglaMokoszy, bania, grzmot, zawierucha, bledneOgniki
            });
            if (technika.uzbraja === 'grzmot') zagrajGrzmot(audioEngine.magistrala());
            ostatniKomunikat = `${technika.nazwa} ${IKONA.swit}`;
        } else {
            const znak = znaki.znaki.find(z => z.id === skl.zlozona.id);
            ostatniKomunikat = `${znak?.nazwa ?? 'Pieczęć'} złożona`;
        }
        ostatniKomunikatDo = now + 1600;
    }

    // --- 7. Aura ---
    // tecza.update() PRZED aura.updateAndDraw(), żeby aura czytała stan
    // z tej samej klatki (tempo obrotu barwy zależy od motionMeter.responsywnosc -
    // "stoisz, tęcza płynie leniwie; tańczysz, wiruje" ze spec).
    tecza.update(motionMeter.responsywnosc, dt);
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt, tecza);

    // --- 7a0. Zapłon sylwetki (Kierunek A) ---
    // TA SAMA maska co aura, zero kosztu dodatkowego liczenia - patrz
    // nagłówek zaplon.js. Rysowany PO aurze: sylwetka jest tłem dla
    // cząstek techniki, nie odwrotnie.
    zaplon.updateAndDraw(ctx, frame.pose ? maskaDane : null, maskaSzer, maskaWys, fit, dt);

    // --- 7a1. Okadzenie (dmuchanie + dym) ---
    // Druga technika kanałowana. Pobór idzie przez motionMeter.zuzyj() jak
    // Płonący Palec, ale jest prawie zerowy i NIGDY nie warunkuje
    // kontynuacji (js/dmuchanie.js nagłówek) - stąd brak strażnika
    // "if (pobor2 > 0)" na coś więcej niż samo pobranie.
    //
    // Rysowany PRZED efektami i ogniem (spec: dym w warstwie source-over,
    // ogień/piorun bloomują NAD nim) - przy 450 kłębach gracz musi widzieć
    // swój płonący palec, żeby go w dym wcelować. Konsekwencja: zarzewia
    // (plonacyPalec.zaczep, ogien.czastki) są z POPRZEDNIEJ klatki - jedna
    // klatka spóźnienia zapłonu jest niezauważalna, rozdzielanie
    // updateAndDraw na tick i rysowanie nie jest tego warte.
    const pobor2 = dmuchanie.update(frame, motionMeter.moc, dt, now);
    if (pobor2 > 0) motionMeter.zuzyj(pobor2);

    if (dmuchanie.stan === 'DMUCHA' && dmuchanie.zaczep) {
        dym.emituj(
            { x: dmuchanie.zaczep.x * canvas.width, y: dmuchanie.zaczep.y * canvas.height },
            dmuchanie.kierunek,
            dmuchanie.sila,
            dmuchanie.wyrazistosc,
            dt,
            canvas.width,
            canvas.height
        );
    }

    // Dłonie i ŁOKCIE rozgarniają dym (v7: "dym reaguje na ręce i taniec") -
    // punkty POZY (bardziej stabilne niż landmarki dłoni przy geście przy
    // ustach), w PIKSELACH, z prędkością
    // liczoną z różnicy względem poprzedniej klatki (ten sam wzorzec co
    // ogien.js: prędkość źródła, nie tylko pozycja).
    if (frame.pose?.landmarks) {
        const lm = frame.pose.landmarks;
        const nadgarstkiPx = [];
        const nowePoprzNadgarstki = {};
        for (const i of [15, 16, 13, 14]) {
            const p = lm[i];
            if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
            const x = p.x * canvas.width, y = p.y * canvas.height;
            const poprz = poprzNadgarstkiPx?.[i];
            // Brak poprzedniej pozycji (dłoń dopiero się pojawiła) -> vx/vy=0,
            // NIGDY zgadywany skok - ten sam ostrożny domysł co wszędzie
            // indziej w grze (GEMINI.md §2, brak danych ≠ fałszywy sygnał).
            nadgarstkiPx.push({
                x, y,
                vx: poprz && dt > 0 ? (x - poprz.x) / dt : 0,
                vy: poprz && dt > 0 ? (y - poprz.y) / dt : 0
            });
            nowePoprzNadgarstki[i] = { x, y };
        }
        poprzNadgarstkiPx = nowePoprzNadgarstki;
        dym.rozgarnij(nadgarstkiPx);
    }

    // Zarzewia: punkty ognia dowolnej techniki ognia z poprzedniej klatki (patrz wyżej) - DZIŚ
    // Płonący Palec (czubek + próbka jego cząstek, już w px). PULL-BASED,
    // nie subskrypcje: repo nie ma systemu zdarzeń nigdzie indziej (kombosy
    // to zwykłe wartości zwrotne), więc kolejna technika ognia w przyszłości
    // dokłada tu swoje punkty tą samą metodą, zero nowej architektury.
    const zarzewia = [];
    if (plonacyPalec.zaczep) {
        zarzewia.push({
            x: plonacyPalec.zaczep.x * canvas.width,
            y: plonacyPalec.zaczep.y * canvas.height,
            r: 14 * plonacyPalec.sila
        });
        // Co ósma cząstka ognia - kontakt ma być HOJNY (patrz dym.js
        // ZAPLON_KONTAKT_MNOZNIK), nie każda z do 900 cząstek osobno.
        for (let i = 0; i < ogien.czastki.length; i += 8) {
            const c = ogien.czastki[i];
            zarzewia.push({ x: c.x, y: c.y, r: 6 });
        }
    }
    // Błędne Ogniki (js/bledneOgniki.js) - druga technika ognia: każdy jasny
    // ognik to zarzewie, więc przelatując przez chmurę Okadzenia, podpala ją.
    if (bledneOgniki.aktywny) zarzewia.push(...bledneOgniki.zarzewia());
    if (zarzewia.length) dym.podpal(zarzewia);

    // Aard rozdmuchuje dym: czoła fali z POPRZEDNIEJ klatki (fala.czola -
    // wystrzał w tej klatce dzieje się niżej, w 7c) zamienione na punkty
    // z prędkością przez pchniecieCzola(). Jedna klatka spóźnienia jak przy
    // zarzewiach wyżej, ten sam PULL - dym.js nie zna fala.js. Grom w Ziemię
    // dzieli Fala, więc jego fala też rozdmucha dym - jedna fizyka fali.
    // Guard na dym.liczba: bez kłębów nie ma czego pchać, a 72 rzuty na czoło
    // co klatkę przez 0.7 s po każdym Aardzie/Gromie byłyby pracą na darmo.
    // Zawierucha dokłada głowy swoich smug - ten sam kontrakt punktów, ale
    // ze słabą `sila` (js/zawierucha.js SILA_PCHNIECIA): znosi dym, nie rozwiewa.
    if (dym.liczba > 0) {
        const podmuchy = [];
        for (const c of fala.czola) {
            podmuchy.push(...pchniecieCzola(c.zaczep, c.kierunek, c.sila, c.wiek, dt, 24));
        }
        if (zawierucha.aktywny) podmuchy.push(...zawierucha.punktyPchniecia());
        if (grzmot.aktywny) podmuchy.push(...grzmot.punktyPchniecia());
        if (podmuchy.length) dym.pchnij(podmuchy);
    }

    const wybuchyDymu = dym.updateAndDraw(ctx, canvas.width, canvas.height, dt);
    // Reakcje - premie za łączenie technik (rejestr REAKCJE w js/punkty.js).
    punkty.reakcja('pozoga', wybuchyDymu, now);
    punkty.reakcja('rozwianie', dym.ostatnioRozwiane, now);
    if (wybuchyDymu > 0) {
        ekran.uderz(Math.min(1, 0.35 + 0.12 * wybuchyDymu));
    }

    // --- 7a. Efekty pieczęci i technik ---
    efekty.updateAndDraw(ctx, frame, dt);

    // --- 7a2. Wielka runa przy dłoniach (zastępuje dawny pierścień) ---
    runy.updateAndDraw(ctx, canvas.width, canvas.height, dt);

    // --- 7b. Płonący palec ---
    // Technika kanałowana: zjada moc tak długo, jak gracz ją prowadzi.
    // Pobranie idzie przez motionMeter.zuzyj(), żeby moc miała JEDNEGO
    // właściciela. zuzyj() przyjmuje koszt częściowy, więc nie trzeba tu
    // osobnej metody - technika zwraca, ile chce pobrać, i nie sięga do
    // this.moc sama.
    const pobor = plonacyPalec.update(frame, motionMeter.moc, dt);
    if (pobor > 0) motionMeter.zuzyj(pobor);

    ogien.updateAndDraw(
        ctx,
        plonacyPalec.zaczep
            ? { x: plonacyPalec.zaczep.x * canvas.width, y: plonacyPalec.zaczep.y * canvas.height }
            : null,
        plonacyPalec.sila,
        dt
    );

    // --- 7c. Podmuch (Aard) ---
    // Jednorazowe zdarzenie: update() zwraca coś TYLKO w klatce wystrzału.
    // W przeciwieństwie do płonącego palca, podmuch nie pobiera mocy przez
    // motionMeter.zuzyj() co klatkę - robi to raz, w momencie odpalenia.
    const wystrzal = podmuch.update(frame, motionMeter.moc, dt);
    if (wystrzal) {
        motionMeter.zuzyj(wystrzal.pobor);
        const zaczepPx = { x: wystrzal.zaczep.x * canvas.width, y: wystrzal.zaczep.y * canvas.height };
        // BARWA_ZAPLONU.aard, nie domyślny błękit fala.js: zapłon sylwetki
        // przy uzbrojeniu i fala przy wystrzale to JEDNO zdarzenie i mają
        // grać jedną barwą - ten sam powód, dla którego Grom w Ziemię
        // podaje BARWA_GROMU zamiast polegać na domyślnej.
        fala.wystrzel(zaczepPx, wystrzal.kierunek, wystrzal.sila, BARWA_ZAPLONU.aard);
        // Wir w dłoni TYLKO tu, nie w wystrzel(): Grom w Ziemię dzieli falę,
        // ale wybucha z ziemi - wir z dłoni nie miałby tam sensu.
        fala.wir(zaczepPx, wystrzal.sila, BARWA_ZAPLONU.aard);
        // Odpowiedź ekranu W CHWILI WYSTRZAŁU, nie tylko przy uzbrojeniu
        // combo (blok 6b wyżej): wstrząs+bloom i soczewka refrakcyjna to
        // dwa osobne zdarzenia o różnych zegarach (ekran.js nagłówek).
        // Siła z wystrzału (0.15..1, patrz podmuch.js) - słaby podmuch
        // słabiej trzęsie, ale ZAWSZE coś się dzieje (GEMINI.md §2).
        ekran.uderz(wystrzal.sila);
        ekran.falaPowietrza(zaczepPx, wystrzal.kierunek, wystrzal.sila);
    }
    // Kontekst technik, które PODĄŻAJĄ za ciałem (proste combo 2026-10-02) -
    // każda czyta z niego zaczep co klatkę (js/sledzenie.js), a Mgła/Tarcza/
    // Kurzawa także maskę, żeby rysować ZA sylwetką (js/warstwaZaSylwetka.js).
    const kontekstTechnik = { frame, W: canvas.width, H: canvas.height,
                              maska: frame.pose ? maskaDane : null, maskaSzer, maskaWys, fit };
    // Piorun PRZED falą/iskrami - uderza z góry, dopiero potem pęka ziemia.
    piorun.updateAndDraw(ctx, dt);
    fala.updateAndDraw(ctx, dt);
    iskry.updateAndDraw(ctx, dt);
    kolowrot.updateAndDraw(ctx, dt);
    kamiennaTarcza.updateAndDraw(ctx, kontekstTechnik, dt);
    mglaMokoszy.updateAndDraw(ctx, kontekstTechnik, dt);
    kregiMokoszy.updateAndDraw(ctx, kontekstTechnik, dt);
    lukPeruna.updateAndDraw(ctx, kontekstTechnik, dt);
    kurzawa.updateAndDraw(ctx, kontekstTechnik, dt);
    bania.updateAndDraw(ctx, kontekstTechnik, dt);
    grzmot.updateAndDraw(ctx, kontekstTechnik, dt);
    for (const sila of grzmot.dudnienia) ekran.uderz(sila);   // przetaczające się uderzenia po pierwszym
    zawierucha.updateAndDraw(ctx, kontekstTechnik, dt);
    bledneOgniki.updateAndDraw(ctx, kontekstTechnik, dt);
    // Reakcje między technikami (js/reakcjeTechnik.js) - efekty rysują same
    // techniki w następnej klatce; tu tylko warunki i punkty.
    const reakcjeKlatki = reakcjeTechnik.klatka({ lukPeruna, kregiMokoszy, mglaMokoszy, piorun, grzmot, kurzawa, zawierucha, bledneOgniki }, dt);
    punkty.reakcja('przewodzenie', reakcjeKlatki.przewodzenie, now);
    punkty.reakcja('burzaWMgle', reakcjeKlatki.burzaWMgle, now);
    punkty.reakcja('rozdarcie', reakcjeKlatki.rozdarcie, now);
    punkty.reakcja('zawianie', reakcjeKlatki.zawianie, now);
    punkty.reakcja('latarnie', reakcjeKlatki.latarnie, now);

    // Koniec bloku wstrząsu ekranu - patrz ctx.save()/ekran.przesun() na
    // początku klatki. dokoncz() rysuje winietę i bramkowany bloom w
    // układzie NIEPRZESUNIĘTYM (stabilna ramka wokół drgającego wnętrza)
    // i przesuwa zegar obwiedni uderzenia - MUSI być wołane co klatkę.
    ctx.restore();
    ekran.dokoncz(ctx, canvas.width, canvas.height, dt);

    // --- 7. HUD i audio ---
    const mocPct = Math.round(moc * 100);
    uiEnergyPercentage.textContent = `${mocPct}%`;
    uiEnergyFill.style.width = `${mocPct}%`;
    // JEDNO wywołanie update() na klatkę - obie klasy CZYTAJĄ ten sam stan.
    const jestPelna = pelnaMoc.update(moc);
    uiEnergyFill.classList.toggle('charged-glow', jestPelna);
    // toggle(), NIE className = ... - przypisanie kasowało CAŁĄ listę klas
    // elementu co klatkę, więc każda inna klasa dołożona do <body> ginęłaby
    // najdalej za jedną klatkę.
    document.body.classList.toggle('ready-pulse', jestPelna);

    // --- 7d. Pasek sekwencji (js/sekwencja.js) ---
    // PULL z bufora kombosów co klatkę - ten sam wzorzec co zarzewia dymu.
    sekwencja.update(now, kombosy.aktywne(now), skl.skladana, skl.postep);
    punkty.taniec(plynnosc, motionMeter.responsywnosc, dt);
    wynikHud.update(punkty, now, canvas.width, canvas.height);
    rundaHud.update(widokRundy(przebieg));

    // Komunikaty mówią, co jest dostępne DALEJ, nigdy co gracz robi ŹLE.
    let text, icon;
    if (ostatniKomunikat && now < ostatniKomunikatDo) {
        text = ostatniKomunikat;
        icon = IKONA.swit;
    } else if (!frame.pose) {
        text = `Odsuń się, żeby kamera widziała całą sylwetkę ${IKONA.czlowiek}`;
        icon = IKONA.czlowiek;
    } else if (skl.brakMocy) {
        // ZAPROSZENIE, nie odmowa. Nigdy "za mało mocy" ani "nie stać cię".
        text = `Pieczęć czeka — tańcz jeszcze chwilę ${IKONA.ogien}`;
        icon = IKONA.ogien;
    } else if (skl.skladana) {
        text = `Trzymaj — pieczęć się składa ${IKONA.plynie}`;
        icon = IKONA.plynie;
    } else if (jestPelna) {
        text = `Moc wypełniła cię po brzegi — układaj pieczęcie ${IKONA.swit}`;
        icon = IKONA.swit;
    } else if (plynnoscMiara.aktywnychStawow === 0) {
        text = `Zacznij się poruszać — moc budzi się w ruchu ${IKONA.ogien}`;
        icon = IKONA.ogien;
    } else if (plynnosc > 0.6) {
        text = `Płyniesz. Moc rośnie ${IKONA.plynie}`;
        icon = IKONA.plynie;
    } else {
        // Zaproszenie, nie poprawka. Nadal ładuje, tylko wolniej.
        text = `Rozpuść ruch w łagodne łuki, a moc popłynie szybciej ${IKONA.plynie}`;
        icon = IKONA.plynie;
    }
    ustawKomunikat(text, icon);

    // --- 7b. Szkielet dłoni ---
    rysujDlonie(frame);

    // --- 8. Nakładka diagnostyczna (klawisz D) ---
    debugHud.drawOverlay(ctx, frame);
    debugHud.updatePanel(frame, {
        ruch: motionMeter.responsywnosc,
        predkosc: motionMeter.predkosc,
        predkoscSurowa: motionMeter.predkoscSurowa,
        predkoscEfektywna: motionMeter.predkoscEfektywna,
        szumPunktow: motionMeter.szumPunktow,
        moc,
        plynnosc,
        szarpniecie: plynnoscMiara.szarpniecie,
        aktywnychStawow: plynnoscMiara.aktywnychStawow,
        zaWolno: plynnoscMiara.zaWolno,
        bledyPetli, ostatniBladPetli,
        ogien: { stan: plonacyPalec.stan, wskazanie: plonacyPalec.wskazanie,
                 czastki: ogien.liczba, zwloka: plonacyPalec.zwloka,
                 powodZwloki: plonacyPalec.powodZwloki,
                 utrzymanie: plonacyPalec._utrzymanie,
                 barkiNiepewne: plonacyPalec.barkiNiepewne },
        podmuch: { stan: podmuch.stan, diagnostyka: podmuch.diagnostyka,
                   czastkiFali: fala.liczba,
                   progPredkosci: PROG_PREDKOSCI, progOtwarcia: PROG_OTWARCIA,
                   ogniskoKamery: OGNISKO_KAMERY },
        tecza: { aktywna: tecza.aktywna, pozostaloS: tecza.pozostaloS,
                 barwaHue: tecza.barwaHue, silaSladu: tecza.silaSladu },
        iskry: { czastki: iskry.liczba },
        zaplon: { aktywny: zaplon.aktywny },
        piorun: { aktywny: piorun.aktywny },
        kamiennaTarcza: { aktywny: kamiennaTarcza.aktywny },
        mglaMokoszy: { aktywny: mglaMokoszy.aktywny },
        kregiMokoszy: { aktywny: kregiMokoszy.aktywny },
        lukPeruna: { aktywny: lukPeruna.aktywny },
        kurzawa: { aktywny: kurzawa.aktywny },
        bania: { aktywny: bania.aktywny },
        grzmot: { aktywny: grzmot.aktywny },
        zawierucha: { aktywny: zawierucha.aktywny, ...zawierucha.diagnostyka },
        bledneOgniki: { aktywny: bledneOgniki.aktywny, widocznych: bledneOgniki.punkty().length },
        kolowrot: { aktywny: kolowrot.aktywny, mgla: kolowrot._mgla.length, drobiny: kolowrot._drobiny.length },
        // _gest to pole prywatne (podkreślnik) - ten sam wzorzec co
        // plonacyPalec._utrzymanie parę linijek wyżej: diagnostyka do
        // strojenia progu na żywo, patrz debugHud.js.
        dmuchanie: { stan: dmuchanie.stan, sila: dmuchanie.sila, pozostaloS: dmuchanie.pozostaloS, gest: dmuchanie._gest,
                     kierunek: dmuchanie.kierunek, glowa: dmuchanie.glowa,
                     wyrazistosc: dmuchanie.wyrazistosc },
        dym: { czastek: dym.liczba, plonacych: dym.plonacych },
        ekran: { sila: ekran.sila },
        oknoKlatek: plynnoscMiara._polOkna * 2 + 1,
        dt,
        wspPlynnosci: motionMeter.wspolczynnikPlynnosci,
        maska: maskaDane ? `${maskaSzer}x${maskaWys}` : 'brak',
        dlonie: opiszDlonie(frame),
        postawy,
        rozbicie,
        skladana: skl.skladana,
        postep: skl.postep,
        brakMocy: skl.brakMocy,
        bufor: kombosy.bufor.map(w => w.id).join(' → ') || '—'
    });

}
