import { HandTracker } from './handTracker.js';
import { PowerBall } from './powerBall.js';

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

// --- Syntezator Web Audio API ---
class AudioEngine {
    constructor() {
        this.audioCtx = null;
        
        // Oscylator buczenia bazowego (sawtooth)
        this.humOsc = null;
        this.humGain = null;
        this.lpFilter = null;
        
        // Zmienne do efektu gotowości (niezrównoważony, wysoki dźwięk)
        this.readyOsc = null;
        this.readyGain = null;
        
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            // 1. Bazowy hum (ładowanie kuli)
            this.humOsc = this.audioCtx.createOscillator();
            this.humOsc.type = 'sawtooth';
            this.humOsc.frequency.setValueAtTime(55, this.audioCtx.currentTime); // Bas A (55Hz)

            this.lpFilter = this.audioCtx.createBiquadFilter();
            this.lpFilter.type = 'lowpass';
            this.lpFilter.frequency.setValueAtTime(140, this.audioCtx.currentTime);

            this.humGain = this.audioCtx.createGain();
            this.humGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

            this.humOsc.connect(this.lpFilter);
            this.lpFilter.connect(this.humGain);
            this.humGain.connect(this.audioCtx.destination);
            this.humOsc.start();

            // 2. Oscylator READY (wysoki i lekko wibrujący)
            this.readyOsc = this.audioCtx.createOscillator();
            this.readyOsc.type = 'sine';
            this.readyOsc.frequency.setValueAtTime(440, this.audioCtx.currentTime);

            this.readyGain = this.audioCtx.createGain();
            this.readyGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

            // Modulator wibracji (Vibrato) dla stanu gotowości
            const vibrato = this.audioCtx.createOscillator();
            vibrato.frequency.value = 8; // 8Hz
            const vibratoGain = this.audioCtx.createGain();
            vibratoGain.gain.value = 15;

            vibrato.connect(vibratoGain);
            vibratoGain.connect(this.readyOsc.frequency);
            vibrato.start();

            this.readyOsc.connect(this.readyGain);
            this.readyGain.connect(this.audioCtx.destination);
            this.readyOsc.start();

            this.initialized = true;
        } catch (err) {
            console.error("Audio Engine error:", err);
        }
    }

    update(state, energy, efficiency) {
        if (!this.initialized || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        if (state === 'CHARGING') {
            // Hum rośnie z poziomem energii
            const targetFreq = 55 + energy * 110; // Przejście 55Hz -> 165Hz
            this.humOsc.frequency.setTargetAtTime(targetFreq, now, 0.15);

            const filterFreq = 140 + energy * 400; // Otwieranie filtra
            this.lpFilter.frequency.setTargetAtTime(filterFreq, now, 0.15);

            const targetVol = energy > 0.01 ? (0.02 + energy * 0.1) : 0;
            this.humGain.gain.setTargetAtTime(targetVol, now, 0.15);

            // Gotowość wyciszona
            this.readyGain.gain.setTargetAtTime(0, now, 0.1);
        } else if (state === 'READY') {
            // Basowy hum jest głośny i stabilny
            this.humOsc.frequency.setTargetAtTime(165, now, 0.1);
            this.lpFilter.frequency.setTargetAtTime(600, now, 0.1);
            this.humGain.gain.setTargetAtTime(0.12, now, 0.1);

            // Włączamy pulsujący dźwięk gotowości
            this.readyGain.gain.setTargetAtTime(0.04, now, 0.2);
            this.readyOsc.frequency.setTargetAtTime(440 + Math.sin(now * 10) * 10, now, 0.05);
        } else {
            // FIRING lub COOLDOWN - wyciszamy humm i gotowość
            this.humGain.gain.setTargetAtTime(0, now, 0.2);
            this.readyGain.gain.setTargetAtTime(0, now, 0.1);
        }
    }

    playFireSFX(energy) {
        if (!this.initialized || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        // Dynamiczne wyładowanie za pomocą szybkiego spadku częstotliwości (laser/whoosh)
        const fireOsc = this.audioCtx.createOscillator();
        const fireGain = this.audioCtx.createGain();
        
        fireOsc.type = 'sawtooth';
        // Częstotliwość startowa zależy od zebranej energii
        const startFreq = 300 + energy * 400;
        fireOsc.frequency.setValueAtTime(startFreq, now);
        fireOsc.frequency.exponentialRampToValueAtTime(40, now + 0.6);

        // Filtr do zmatowienia dźwięku
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(startFreq * 1.5, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);

        fireGain.gain.setValueAtTime(0.25, now);
        fireGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        fireOsc.connect(filter);
        filter.connect(fireGain);
        fireGain.connect(this.audioCtx.destination);
        
        fireOsc.start();
        fireOsc.stop(now + 0.65);
    }
}

let handTracker = new HandTracker();
let powerBall = null;
let audioEngine = new AudioEngine();
let lastVideoTime = -1;
let isRunning = false;
let lastResults = null;
let lastState = 'CHARGING';

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

    // --- 5. Aktualizacja Interaktywnego HUD oraz Audio ---
    if (powerBall) {
        const state = powerBall.state;
        const energy = powerBall.currentEnergy;
        const efficiency = powerBall.lastEfficiency;

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
            if (powerBall.lastHandsLength === 0) {
                text = "Pokaż obie dłonie kamerze ✋";
                icon = "✋";
            } else if (powerBall.lastHandsLength === 1) {
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

    // Zapętlenie
    requestAnimationFrame(renderLoop);
}
