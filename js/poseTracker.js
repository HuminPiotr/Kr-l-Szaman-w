import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Detekcja NIE dostaje pełnej klatki wideo.
//
// Maska segmentacji wraca jako tekstura WebGL, a nasze płótno jest 2D, więc
// trzeba ją ściągnąć na CPU - i to ten odczyt, nie sama detekcja, jest kosztem.
// Skaluje się z liczbą pikseli. Zmierzone w Chrome na tym laptopie:
//
//   1280x720  detekcja 11.8 + odczyt 21.4 = 33.1 ms  <- CAŁY budżet 30 FPS
//    640x360  detekcja 15.3 + odczyt 12.4 = 27.7 ms
//    480x270  detekcja ~14  + odczyt ~2   = 14.1 ms  <- tu pracujemy
//    320x180  detekcja 11.0 + odczyt 1.2  = 12.1 ms
//
// Aura jest rozmyta, więc niska rozdzielczość maski jest niewidoczna jako
// ograniczenie. Landmarki są znormalizowane 0..1, więc mapują się bez zmian.
const SZEROKOSC_DETEKCJI = 480;

export class PoseTracker {
    constructor() {
        this.poseLandmarker = null;
        this._plotno = null;   // pomniejszona kopia klatki podawana detektorowi
        this._ctx = null;
    }

    async initialize() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                // Wariant "lite" - najtańszy z trzech. Ciało napędza całą rozgrywkę,
                // więc liczy się płynność, nie precyzja pojedynczego stawu.
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1, // Gra jednoosobowa
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: true // sylwetka do aury
        });

        return true;
    }

    detect(videoElement, timestamp) {
        if (!this.poseLandmarker) return null;
        if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

        // Proporcje bierzemy z RZECZYWISTYCH wymiarów wideo, nie z zaszytej
        // liczby. getUserMedia prosi o rozdzielczość przez "ideal", więc może
        // oddać 4:3 zamiast 16:9 - a niezgodność proporcji przekrzywiłaby
        // każdy landmark. Płynność liczy drugą pochodną pozycji, więc jest
        // na to wrażliwsza niż cokolwiek innego w tej grze.
        const skala = Math.min(1, SZEROKOSC_DETEKCJI / videoElement.videoWidth);
        const w = Math.max(1, Math.round(videoElement.videoWidth * skala));
        const h = Math.max(1, Math.round(videoElement.videoHeight * skala));

        if (!this._plotno) {
            this._plotno = document.createElement('canvas');
            this._ctx = this._plotno.getContext('2d', { willReadFrequently: false });
        }
        if (this._plotno.width !== w || this._plotno.height !== h) {
            this._plotno.width = w;
            this._plotno.height = h;
        }

        this._ctx.drawImage(videoElement, 0, 0, w, h);
        return this.poseLandmarker.detectForVideo(this._plotno, timestamp);
    }
}
