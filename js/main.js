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
import { Efekty } from './efekty.js';
import { Ogien } from './ogien.js';
import { PlonacyPalec } from './plonacyPalec.js';
import { Dmuchanie } from './dmuchanie.js';
import { Dym } from './dym.js';
import { Podmuch, PROG_PREDKOSCI, PROG_OTWARCIA } from './podmuch.js';
import { Fala } from './fala.js';
import { Tecza } from './tecza.js';
import { Iskry, pekniecieZiemi } from './iskry.js';
import { Zaplon } from './zaplon.js';
import { Ekran } from './ekran.js';
import { Piorun } from './piorun.js';
import { Kolowrot, BARWA_MGLA as BARWA_KOLOWROTU, kregSylwetki } from './kolowrot.js';
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

// Barwa czoła fali Gromu w Ziemię - fiolet Welesa (efekty.js weles: 280°),
// PODBITY do pełnego nasycenia (nie dosłowna konwersja HSL->RGB), bo
// fala.js rysuje przez 'lighter': muszony fiolet, który dobrze czyta się
// jako pieczęć, gaśnie do bladego różu pod addytywnym blendowaniem, jeśli
// nie jest wystarczająco nasycony na starcie.
const BARWA_GROMU = [190, 100, 255];

// Barwy zapłonu sylwetki (js/zaplon.js) per TECHNIKA (pole `uzbraja`
// z js/kombosy.js) - jeden wpis na każdą z czterech technik, nie na
// pojedynczą pieczęć: zapłon jest nagrodą za COMBO, tak samo jak
// fala/iskry przy Gromie w Ziemię. Barwy dobrane z tego samego rejestru
// co efekty.js TABELA (przybliżone RGB odpowiedniej barwy HSL, podbite do
// pełnego nasycenia z tego samego powodu co BARWA_GROMU wyżej).
const BARWA_ZAPLONU = {
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
    dym: [210, 210, 220]
};

const uiStartScreen = document.getElementById('start-screen');
const uiLoadingScreen = document.getElementById('loading-screen');
const uiInstructionHud = document.getElementById('instruction-hud');
const uiInstructionIcon = document.getElementById('instruction-icon');
const uiInstructionText = document.getElementById('instruction-text');
const uiEnergyHud = document.getElementById('energy-hud');
const uiEnergyFill = document.getElementById('energy-fill');
const uiEnergyPercentage = document.getElementById('energy-percentage');

const startBtn = document.getElementById('start-btn');
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
let efekty = new Efekty();
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

startBtn.addEventListener('click', async () => {
    // 1. Ukryj start i pokaż ładowanie
    uiStartScreen.classList.add('hidden');
    uiLoadingScreen.classList.remove('hidden');

    try {
        // 2. Inicjalizacja kamery (WebRTC)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;

        // Czekamy na załadowanie metadanych, żeby znać oryginalne wymiary wideo
        await new Promise(resolve => {
            video.onloadedmetadata = () => resolve();
        });
        video.play();

        // 3. Inicjalizacja AI (MediaPipe)
        await Promise.all([
            poseTracker.initialize(),
            handTracker.initialize()
        ]);

        // 3a. Assety Kołowrotu (js/assety.js) - CELOWO NIE await. Pobieranie
        // 10 obrazków nie ma blokować startu gry - to jest cały sens
        // asynchronicznego ładowania (patrz nagłówek assety.js). Kołowrót
        // po prostu nie narysuje którejś warstwy przez pierwsze kilka
        // sekund gry, jeśli gracz złoży combo zanim pobieranie się skończy -
        // GEMINI.md §2, brak assetu nigdy nie jest błędem.
        zaladujAssety().catch(() => {});   // per-obraz błędy już łapie assety.js; catch tu to tylko siatka bezpieczeństwa

        // 4. Aura tancerza
        aura = new Aura(canvas, ctx);

        // 5. Inicjalizacja syntezatora audio
        audioEngine.init();

        uiLoadingScreen.classList.add('hidden');
        uiInstructionHud.classList.remove('hidden');
        uiEnergyHud.classList.remove('hidden');

        isRunning = true;
        requestAnimationFrame(renderLoop);

    } catch (e) {
        alert("Błąd dostępu do kamery lub inicjalizacji AI: " + e.message);
        console.error(e);
        uiStartScreen.classList.remove('hidden');
        uiLoadingScreen.classList.add('hidden');
    }
});

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

        ctx.strokeStyle = 'rgba(150, 220, 255, 0.30)';
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
            ctx.fillStyle = opuszek ? 'rgba(200, 240, 255, 0.85)' : 'rgba(150, 220, 255, 0.45)';
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

function klatka(now) {

    // Bez wymiarów wideo computeCoverFit dzieli przez zero, ratio robi się
    // Infinity i WSZYSTKIE przemapowane punkty stają się NaN.
    if (!video.videoWidth || !video.videoHeight) return;

    const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
    lastFrameTime = now;
    debugHud.tick(now);

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

    // Przyciemnienie dla kontrastu - aura ma się na czym odcinać
    ctx.fillStyle = 'rgba(5, 5, 16, 0.55)';
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

    // --- 6a. Pieczęć się złożyła ---
    if (skl.zlozona) {
        motionMeter.zuzyj(skl.zlozona.koszt);
        efekty.odpal(skl.zlozona.id);
        aura.rozblysk(1);
        // playFireSFX, NIE update('FIRING'): 'FIRING' tylko WYCISZA hum
        // (audioEngine.js:100-103), a klatkę później update('CHARGING') na
        // dole pętli i tak go przywraca - pieczęć wyszłaby bezgłośna.
        // Argument steruje wysokością startową, więc pieczęć brzmi lżej
        // niż technika.
        audioEngine.playFireSFX(0.3);

        const technika = kombosy.dodaj(skl.zlozona.id, now);
        if (technika) {
            efekty.odpal(technika.id);
            aura.rozblysk(1);
            // Zapłon sylwetki (js/zaplon.js) i wstrząs ekranu (js/ekran.js) -
            // WARSTWA WSPÓLNA dla WSZYSTKICH czterech technik, nie tylko
            // Gromu w Ziemię (ten dostaje DODATKOWO falę+iskry+grzmot
            // w gałęzi niżej). Siła stała (1.0) z tego samego powodu co
            // przy Gromie w Ziemię - technika jest gratis, efekt nie może
            // być karą za niski pasek mocy.
            zaplon.zapal(BARWA_ZAPLONU[technika.uzbraja] ?? [255, 255, 255], 1.0);
            ekran.uderz(1.0);
            // Kombos uzbraja technikę WSKAZANĄ POLEM `uzbraja` - dopóki
            // technika była jedna, bezwarunkowe uzbrajanie ognia było
            // w porządku; przy dwóch trzeba routować.
            // Bez licznika ważności - licznik byłby presją ("szybciej!"),
            // a to ma być relaks.
            if (technika.uzbraja === 'ogien') {
                plonacyPalec.uzbrój();
            } else if (technika.uzbraja === 'aard') {
                podmuch.uzbrój();
            } else if (technika.uzbraja === 'tecza') {
                // Nagroda odpala się NATYCHMIAST, bez drugiego gestu -
                // inaczej niż 'ogien'/'aard', które tylko UZBRAJAJĄ technikę
                // czekającą na osobny gest gracza. aktywuj() (re)startuje
                // licznik do pełnych 30 s bezwarunkowo.
                tecza.aktywuj();
            } else if (technika.uzbraja === 'gromWZiemie') {
                // Aktywacja NATYCHMIASTOWA jak Tęcza. Siła STAŁA (1.0), NIE
                // pochodna motionMeter.moc - combo jest gratis, efekt nie
                // może być karą za niski pasek mocy. Bez motionMeter.zuzyj()
                // z tego samego powodu - w przeciwieństwie do gałęzi
                // podmuchu niżej, tu nic nie jest "kupowane" z paska mocy.
                const zaczepPx = pekniecieZiemi(frame, canvas.width, canvas.height);
                // Piorun UDERZA PIERWSZY (js/piorun.js) - dopiero w niego
                // pęka ziemia i tryskają iskry. To jedyny efekt w grze
                // z prawdziwą, twardą krawędzią zamiast kolejnej miękkiej
                // plamy - patrz nagłówek piorun.js. Ta sama barwa co fala,
                // żeby cała sekwencja czytała się jako JEDNO zdarzenie.
                piorun.uderz(zaczepPx, BARWA_GROMU, 1.0);
                // Kierunek {0,-1,0} daje w fala.js pierścień w płaszczyźnie
                // POZIOMEJ (prostopadłej do "w górę") - "pęknięcie ziemi,
                // energia wybucha na boki i w głąb", nie fontanna.
                //
                // BARWA_GROMU: fiolet Welesa, jasny wariant jego pieczęci
                // (efekty.js weles: 280°) - fala.js domyślnie jest blada
                // niebieska (barwa Aarda), a ta sama fala niosła oba combosy
                // nie do odróżnienia dopóki wystrzel() nie przyjął barwy.
                fala.wystrzel(zaczepPx, { x: 0, y: -1, z: 0 }, 1.0, BARWA_GROMU);
                iskry.wystrzel(zaczepPx, 1.0);
                audioEngine.playGromSFX();
            } else if (technika.uzbraja === 'kolowrot') {
                // Aktywacja NATYCHMIASTOWA jak Tęcza i Grom w Ziemię. Siła
                // STAŁA (1.0) z tego samego powodu - combo jest gratis.
                // Zaczep na TUŁOWIU (kregSylwetki, nie pekniecieZiemi) -
                // krąg rośnie WOKÓŁ tancerza (pas -> nad głowę), nie leży
                // na niewidocznej podłodze. Patrz nagłówek kolowrot.js.
                const kolko = kregSylwetki(frame, canvas.width, canvas.height);
                kolowrot.zapal(kolko, kolko.skala, canvas.height, 1.0);
                audioEngine.playKolowrotSFX();
            } else if (technika.uzbraja === 'dym') {
                // Trzecia technika KANAŁOWANA (jak 'ogien'/'aard') - uzbraja,
                // nie odpala natychmiast. Gest aktywacji: js/dmuchanie.js.
                dmuchanie.uzbrój(now);
            }
            // KAŻDE inne combo gasi POTENCJAŁ Okadzenia (produkcję), ale NIE
            // kasuje już wydmuchane kłęby - js/dmuchanie.js nagłówek "PAUZA,
            // NIE KONIEC". Bez tego nie byłoby drogi do podpalenia dymu:
            // podpalenie wymaga Gromu w Ogniu, czyli WŁAŚNIE "innego combo".
            if (technika.uzbraja !== 'dym') dmuchanie.anuluj();
            audioEngine.playFireSFX(1.0);
            ostatniKomunikat = `${technika.nazwa} ✨`;
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
            dt,
            canvas.width
        );
    }

    // Dłonie rozgarniają dym - nadgarstki POZY (bardziej stabilne niż
    // landmarki dłoni przy geście przy ustach), w PIKSELACH, z prędkością
    // liczoną z różnicy względem poprzedniej klatki (ten sam wzorzec co
    // ogien.js: prędkość źródła, nie tylko pozycja).
    if (frame.pose?.landmarks) {
        const lm = frame.pose.landmarks;
        const nadgarstkiPx = [];
        const nowePoprzNadgarstki = {};
        for (const i of [15, 16]) {
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
        dym.rozgarnij(nadgarstkiPx, canvas.width);
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
    if (zarzewia.length) dym.podpal(zarzewia);

    const wybuchyDymu = dym.updateAndDraw(ctx, canvas.width, canvas.height, dt);
    if (wybuchyDymu > 0) {
        ekran.uderz(Math.min(1, 0.35 + 0.12 * wybuchyDymu));
        audioEngine.playWybuchSFX(wybuchyDymu);
    }

    // --- 7a. Efekty pieczęci i technik ---
    efekty.updateAndDraw(ctx, frame, dt);

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
        fala.wystrzel(
            { x: wystrzal.zaczep.x * canvas.width, y: wystrzal.zaczep.y * canvas.height },
            wystrzal.kierunek,
            wystrzal.sila
        );
    }
    // Piorun PRZED falą/iskrami - uderza z góry, dopiero potem pęka ziemia.
    piorun.updateAndDraw(ctx, dt);
    fala.updateAndDraw(ctx, dt);
    iskry.updateAndDraw(ctx, dt);
    kolowrot.updateAndDraw(ctx, dt);

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
    uiEnergyFill.classList.toggle('charged-glow', moc >= 0.95);
    document.body.className = moc >= 0.95 ? 'ready-pulse' : '';

    // Komunikaty mówią, co jest dostępne DALEJ, nigdy co gracz robi ŹLE.
    let text, icon;
    if (ostatniKomunikat && now < ostatniKomunikatDo) {
        text = ostatniKomunikat;
        icon = "✨";
    } else if (!frame.pose) {
        text = "Odsuń się, żeby kamera widziała całą sylwetkę 🕺";
        icon = "🕺";
    } else if (skl.brakMocy) {
        // ZAPROSZENIE, nie odmowa. Nigdy "za mało mocy" ani "nie stać cię".
        text = "Pieczęć czeka — tańcz jeszcze chwilę 🔥";
        icon = "🔥";
    } else if (skl.skladana) {
        text = "Trzymaj — pieczęć się składa 🌀";
        icon = "🌀";
    } else if (moc >= 0.95) {
        text = "Moc wypełniła cię po brzegi — układaj pieczęcie ✨";
        icon = "✨";
    } else if (plynnoscMiara.aktywnychStawow === 0) {
        text = "Zacznij się poruszać — moc budzi się w ruchu 🔥";
        icon = "🔥";
    } else if (plynnosc > 0.6) {
        text = "Płyniesz. Moc rośnie 🌀";
        icon = "🌀";
    } else {
        // Zaproszenie, nie poprawka. Nadal ładuje, tylko wolniej.
        text = "Rozpuść ruch w łagodne łuki, a moc popłynie szybciej 〰️";
        icon = "〰️";
    }
    uiInstructionText.textContent = text;
    uiInstructionIcon.textContent = icon;

    audioEngine.update('CHARGING', moc, plynnosc);

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
                   progPredkosci: PROG_PREDKOSCI, progOtwarcia: PROG_OTWARCIA },
        tecza: { aktywna: tecza.aktywna, pozostaloS: tecza.pozostaloS,
                 barwaHue: tecza.barwaHue, silaSladu: tecza.silaSladu },
        iskry: { czastki: iskry.liczba },
        zaplon: { aktywny: zaplon.aktywny },
        piorun: { aktywny: piorun.aktywny },
        kolowrot: { aktywny: kolowrot.aktywny, mgla: kolowrot._mgla.length, drobiny: kolowrot._drobiny.length },
        // _gest to pole prywatne (podkreślnik) - ten sam wzorzec co
        // plonacyPalec._utrzymanie parę linijek wyżej: diagnostyka do
        // strojenia progu na żywo, patrz debugHud.js.
        dmuchanie: { stan: dmuchanie.stan, sila: dmuchanie.sila, pozostaloS: dmuchanie.pozostaloS, gest: dmuchanie._gest,
                     kierunek: dmuchanie.kierunek, glowa: dmuchanie.glowa },
        dym: { kleby: dym.klebow, strumien: dym.strumienia, plonacych: dym.plonacych },
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
