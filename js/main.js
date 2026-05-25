import { HandTracker } from './handTracker.js';
import { PowerBall } from './powerBall.js';

const uiStartScreen = document.getElementById('start-screen');
const uiLoadingScreen = document.getElementById('loading-screen');

const startBtn = document.getElementById('start-btn');
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

let handTracker = new HandTracker();
let powerBall = null;
let lastVideoTime = -1;
let isRunning = false;
let lastResults = null;

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
        await handTracker.initialize();
        
        // 4. Inicjalizacja renderingu Kuli Mocy
        powerBall = new PowerBall(canvas, ctx);

        // Zakończenie ładowania
        uiLoadingScreen.classList.add('hidden');


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

function renderLoop() {
    if (!isRunning) return;

    // --- 1. Rysowanie podglądu z kamery ---
    // Obliczamy odpowiednią skalę, żeby wideo przykryło całe płótno (object-fit: cover)
    const vRatio = canvas.width / video.videoWidth;
    const hRatio = canvas.height / video.videoHeight;
    const ratio = Math.max(vRatio, hRatio);
    const centerShift_x = (canvas.width - video.videoWidth * ratio) / 2;
    const centerShift_y = (canvas.height - video.videoHeight * ratio) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Zauważ: canvas jest odwrócony przez CSS (scaleX(-1)), 
    // więc wideo naturalnie działa jak lustro
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
        centerShift_x, centerShift_y, video.videoWidth * ratio, video.videoHeight * ratio);

    // Nakładamy przyciemniającą nakładkę (overlay) dla kinowego efektu i kontrastu
    ctx.fillStyle = 'rgba(5, 5, 16, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- 2. Wykrywanie dłoni ---
    let startTimeMs = performance.now();
    // Sprawdzamy nową klatkę wideo
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        // Synchroniczna detekcja na ramce wideo
        lastResults = handTracker.detect(video, startTimeMs);
    }

    // --- 3. Przeliczanie pozycji AI na koordynaty płótna ---
    let mappedLandmarks = [];
    if (lastResults && lastResults.landmarks) {
        // MediaPipe zwraca znormalizowane wartości (0.0 - 1.0) względem klatki wideo.
        // My musimy je przenieść na naszą rozciągniętą i uciętą klatkę na canvasie.
        mappedLandmarks = lastResults.landmarks.map(hand => {
            return hand.map(point => {
                return {
                    x: (point.x * video.videoWidth * ratio + centerShift_x) / canvas.width,
                    y: (point.y * video.videoHeight * ratio + centerShift_y) / canvas.height,
                    z: point.z
                };
            });
        });
    }

    // --- 4. Renderowanie Kuli Mocy ---
    powerBall.updateAndDraw(mappedLandmarks, canvas.width, canvas.height);

    // Zapętlenie
    requestAnimationFrame(renderLoop);
}
