import { HandTracker } from './handTracker.js';
import { PoseTracker } from './poseTracker.js';
import { PowerBall } from './powerBall.js';
import { AudioEngine } from './audioEngine.js';
import { DebugHud } from './debugHud.js';
import { MotionMeter } from './motionMeter.js';
import { ZnakRegistry } from './znaki/registry.js';
import { swarog } from './znaki/swarog.js';
import { computeCoverFit, drawVideoCover, mapLandmarks } from './frameMapper.js';

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
let powerBall = null;
let audioEngine = new AudioEngine();
let debugHud = new DebugHud();
let motionMeter = new MotionMeter();
let znaki = new ZnakRegistry();
let lastVideoTime = -1;
let isRunning = false;
let lastResults = null;      // wynik HandLandmarker z ostatniej klatki wideo
let lastPoseResults = null;  // wynik PoseLandmarker z ostatniej klatki wideo
let lastState = 'CHARGING';
let lastFrameTime = 0;

znaki.zarejestruj(swarog);

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

        // 3. Inicjalizacja AI (MediaPipe) - dłonie i ciało równolegle,
        //    bo to dwa niezależne pobrania modeli
        await Promise.all([
            handTracker.initialize(),
            poseTracker.initialize()
        ]);

        // 4. Inicjalizacja renderingu Kuli Mocy
        powerBall = new PowerBall(canvas, ctx);

        // 5. Inicjalizacja syntezatora audio
        audioEngine.init();

        // Zakończenie ładowania i wyświetlenie HUD-a
        uiLoadingScreen.classList.add('hidden');
        uiInstructionHud.classList.remove('hidden');
        uiEnergyHud.classList.remove('hidden');

        isRunning = true;
        
        // Startujemy pętlę renderowania (ok. 60 FPS)
        requestAnimationFrame(renderLoop);

    } catch (e) {
        alert("Błąd dostępu do kamery lub inicjalizacji AI: " + e.message);
        console.error(e);
        uiStartScreen.classList.remove('hidden');
        uiLoadingScreen.classList.add('hidden');
    }
});

/**
 * Buduje kontrakt klatki - jedyny interfejs między trackingiem a resztą gry.
 *
 * landmarks     -> przemapowane na płótno, DO RYSOWANIA
 * worldLandmarks-> metryczne 3D, DO WSZYSTKICH POMIARÓW (kształt, prędkość)
 * handedness    -> która to dłoń; dziś nieużywane, ale bez tego lewa i prawa
 *                  nie da się rozróżnić w momencie, gdy zaczną robić różne znaki
 */
function buildFrame(fit, dt, now) {
    const hands = [];
    if (lastResults && lastResults.landmarks) {
        for (let i = 0; i < lastResults.landmarks.length; i++) {
            hands.push({
                landmarks: mapLandmarks(lastResults.landmarks[i], fit),
                worldLandmarks: lastResults.worldLandmarks?.[i] ?? null,
                // UWAGA: w tasks-vision 0.10.3 pole nazywa się handednesses (liczba mnoga)
                handedness: lastResults.handednesses?.[i]?.[0]?.categoryName ?? null
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

function renderLoop(now) {
    if (!isRunning) return;

    // Bez wymiarów wideo computeCoverFit dzieli przez zero, ratio robi się
    // Infinity i WSZYSTKIE przemapowane punkty stają się NaN. Zdarza się zanim
    // ścieżka kamery się ustabilizuje albo gdy zostanie przerwana.
    if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(renderLoop);
        return;
    }

    // Krok czasu w sekundach - MotionMeter liczy prędkość, więc potrzebuje dt,
    // a nie założenia o stałych 60 FPS.
    const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
    lastFrameTime = now;
    debugHud.tick(now);

    // --- 1. Rysowanie podglądu z kamery ---
    const fit = computeCoverFit(video, canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zauważ: canvas jest odwrócony przez CSS (scaleX(-1)),
    // więc wideo naturalnie działa jak lustro
    drawVideoCover(ctx, video, fit);

    // Nakładamy przyciemniającą nakładkę (overlay) dla kinowego efektu i kontrastu
    ctx.fillStyle = 'rgba(5, 5, 16, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- 2. Wykrywanie dłoni i ciała ---
    const startTimeMs = performance.now();
    // Sprawdzamy nową klatkę wideo
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        // Synchroniczna detekcja na ramce wideo.
        // Obie detekcje co klatkę - jeśli pomiar FPS pokaże < 24, dłonie
        // przechodzą na co 2-3 klatkę (ciało musi zostać co klatkę).
        lastResults = handTracker.detect(video, startTimeMs);
        lastPoseResults = poseTracker.detect(video, startTimeMs);
    }

    // --- 3. Kontrakt klatki ---
    const frame = buildFrame(fit, dt, now);

    // --- 4. Ocena znaków ---
    // Kula czyta wynik SUROWY, bo tak zachowywał się kod przed refaktorem.
    const wynikiZnakow = znaki.ocen(frame);

    // --- 5. Ciągłość ruchu ---
    // Na razie tylko mierzy i pokazuje w nakładce - nic jeszcze nie steruje.
    // Przełączenie energii na ten wskaźnik to osobna, następna zmiana.
    motionMeter.update(frame);

    // --- 6. Renderowanie Kuli Mocy ---
    const mappedLandmarks = frame.hands.map(h => h.landmarks);
    powerBall.updateAndDraw(mappedLandmarks, canvas.width, canvas.height, wynikiZnakow.swarog);

    // --- 7. Aktualizacja Interaktywnego HUD oraz Audio ---
    if (powerBall) {
        const state = powerBall.state;
        const energy = powerBall.currentEnergy;
        // Wynik znaku i liczba dłoni pochodzą teraz wprost z kontraktu klatki
        // i z rejestru. Wcześniej czytano powerBall.lastEfficiency (nigdy nie
        // przypisywane) i powerBall.lastHandsLength (właściwość o tej nazwie
        // nie istnieje - jest lastHandsCount), więc oba były undefined
        // i trzy komunikaty poniżej były nieosiągalne.
        const efficiency = wynikiZnakow.swarog;
        const liczbaDloni = frame.hands.length;

        // Aktualizacja paska postępu
        const energyPct = Math.round(energy * 100);
        uiEnergyPercentage.textContent = `${energyPct}%`;
        uiEnergyFill.style.width = `${energyPct}%`;

        // Kolory i animacje paska
        if (state === 'READY' || energyPct >= 95) {
            uiEnergyFill.classList.add('charged-glow');
        } else {
            uiEnergyFill.classList.remove('charged-glow');
        }

        // Efekty tła i winiety
        if (state === 'READY') {
            document.body.className = 'ready-pulse';
        } else if (state === 'COOLDOWN') {
            document.body.className = 'cooldown-state';
        } else {
            document.body.className = '';
        }

        // Dynamiczne komunikaty instruktażowe
        let text = "Złóż dłonie w miseczkę naprzeciw siebie 🙌";
        let icon = "🙌";

        if (state === 'CHARGING') {
            if (liczbaDloni === 0) {
                text = "Pokaż obie dłonie kamerze ✋";
                icon = "✋";
            } else if (liczbaDloni === 1) {
                text = "Jedna dłoń wykryta! Pokaż drugą dla 100% mocy 🙌";
                icon = "⚡";
            } else {
                text = efficiency > 0.5 ? "Moc rośnie! Utrzymaj pozycję 🔥" : "Ułóż dłonie optymalnie naprzeciw siebie 🫱 🫲";
                icon = efficiency > 0.5 ? "🔥" : "↔️";
            }
        } else if (state === 'READY') {
            text = "KULA GOTOWA! Wykonaj zamach i rozszerz dłonie! 💥";
            icon = "💥";
        } else if (state === 'FIRING') {
            text = "WYSTRZAŁ ENERGII! ☄️";
            icon = "☄️";
        } else if (state === 'COOLDOWN') {
            text = "Przeładowanie systemu... Bądź gotów! ⏳";
            icon = "⏳";
        }

        uiInstructionText.textContent = text;
        uiInstructionIcon.textContent = icon;

        // Jednorazowe odtworzenie dźwięku wystrzału
        if (state === 'FIRING' && lastState !== 'FIRING') {
            audioEngine.playFireSFX(energy);
        }
        lastState = state;

        // Aktualizacja dźwięków ciągłych
        audioEngine.update(state, energy, efficiency);
    }

    // --- 8. Nakładka diagnostyczna (klawisz D) ---
    debugHud.drawOverlay(ctx, frame);
    debugHud.updatePanel(frame, {
        ruch: motionMeter.responsywnosc,
        predkosc: motionMeter.predkosc,
        predkoscSurowa: motionMeter.predkoscSurowa,
        moc: motionMeter.moc,
        stan: powerBall ? powerBall.state : '—',
        znaki: wynikiZnakow
    });

    // Zapętlenie
    requestAnimationFrame(renderLoop);
}
