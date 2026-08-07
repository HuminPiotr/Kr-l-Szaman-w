import { PoseTracker } from './poseTracker.js';
import { AudioEngine } from './audioEngine.js';
import { DebugHud } from './debugHud.js';
import { MotionMeter } from './motionMeter.js';
import { Plynnosc } from './plynnosc.js';
import { Aura } from './aura.js';
import { ZnakRegistry } from './znaki/registry.js';
import { perun } from './znaki/perun.js';
import { mokosz } from './znaki/mokosz.js';
import { weles } from './znaki/weles.js';
import { SkladaniePieczeci } from './pieczecie.js';
import { KomboSilnik } from './kombosy.js';
import { Efekty } from './efekty.js';
import { computeCoverFit, drawVideoCover, mapLandmarks } from './frameMapper.js';

// ODPIĘTE, NIE USUNIĘTE: powerBall.js, wiatr.js, handTracker.js.
// swarog.js i stribog.js też czekają - są dowodem, że rejestr obsługuje
// wymaga:'hands', i ożyją same, gdy śledzenie dłoni wróci. Dłonie są
// wyłączone, bo zwolnione ~8 ms płaci za maskę sylwetki do aury.

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

let poseTracker = new PoseTracker();
let audioEngine = new AudioEngine();
let debugHud = new DebugHud();
let motionMeter = new MotionMeter();
let plynnoscMiara = new Plynnosc();
let aura = null;

let znaki = new ZnakRegistry();
znaki.zarejestruj(perun);
znaki.zarejestruj(mokosz);
znaki.zarejestruj(weles);
let skladanie = new SkladaniePieczeci();
let kombosy = new KomboSilnik();
let efekty = new Efekty();

// Ostatnia rzecz, którą gracz zrobił - HUD ma o niej mówić przez chwilę,
// zamiast natychmiast wracać do zaproszenia do tańca.
let ostatniKomunikat = null, ostatniKomunikatDo = 0;

let lastVideoTime = -1;
let isRunning = false;
let lastPoseResults = null;   // wynik PoseLandmarker z ostatniej klatki wideo
let lastFrameTime = 0;

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
        await poseTracker.initialize();

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
    let pose = null;
    if (lastPoseResults?.landmarks?.length) {
        pose = {
            landmarks: mapLandmarks(lastPoseResults.landmarks[0], fit),
            worldLandmarks: lastPoseResults.worldLandmarks?.[0] ?? null
        };
    }
    return { hands: [], pose, width: canvas.width, height: canvas.height, dt, now };
}

function renderLoop(now) {
    if (!isRunning) return;

    // Bez wymiarów wideo computeCoverFit dzieli przez zero, ratio robi się
    // Infinity i WSZYSTKIE przemapowane punkty stają się NaN.
    if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(renderLoop);
        return;
    }

    const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
    lastFrameTime = now;
    debugHud.tick(now);

    // --- 1. Podgląd z kamery ---
    const fit = computeCoverFit(video, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Płótno jest odwrócone przez CSS (scaleX(-1)), więc wideo działa jak lustro
    drawVideoCover(ctx, video, fit);

    // Przyciemnienie dla kontrastu - aura ma się na czym odcinać
    ctx.fillStyle = 'rgba(5, 5, 16, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- 2. Wykrywanie ciała (detekcja idzie na pomniejszonej klatce) ---
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastPoseResults = poseTracker.detect(video, performance.now());
        pobierzMaske(lastPoseResults);
    }

    // --- 3. Kontrakt klatki ---
    const frame = buildFrame(fit, dt, now);

    // --- 4. Płynność ruchu ---
    // Liczona z SUROWYCH worldLandmarks - filtr Savitzky'ego-Golaya robi
    // własne wygładzanie. Podanie tu pozycji już wygładzonych przez
    // MotionMeter zabiłoby sygnał, którego szukamy.
    const plynnosc = plynnoscMiara.update(frame.pose?.worldLandmarks ?? null, dt);

    // --- 5. Postawy i składanie pieczęci ---
    // KOLEJNOŚĆ MA ZNACZENIE: składanie musi policzyć się PRZED mocą, bo
    // to ono decyduje, czy zanik jest w tej klatce zamrożony.
    const postawy = znaki.ocen(frame);
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
            audioEngine.playFireSFX(1.0);
            ostatniKomunikat = `${technika.nazwa} ✨`;
        } else {
            const znak = znaki.znaki.find(z => z.id === skl.zlozona.id);
            ostatniKomunikat = `${znak?.nazwa ?? 'Pieczęć'} złożona`;
        }
        ostatniKomunikatDo = now + 1600;
    }

    // --- 7. Aura ---
    aura.updateAndDraw(frame.pose ? maskaDane : null, maskaSzer, maskaWys,
                       moc, plynnosc, fit, dt);

    // --- 7a. Efekty pieczęci i technik ---
    efekty.updateAndDraw(ctx, frame, dt);

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
        oknoKlatek: plynnoscMiara._polOkna * 2 + 1,
        dt,
        wspPlynnosci: motionMeter.wspolczynnikPlynnosci,
        maska: maskaDane ? `${maskaSzer}x${maskaWys}` : 'brak',
        postawy,
        skladana: skl.skladana,
        postep: skl.postep,
        brakMocy: skl.brakMocy,
        bufor: kombosy.bufor.map(w => w.id).join(' → ') || '—'
    });

    requestAnimationFrame(renderLoop);
}
