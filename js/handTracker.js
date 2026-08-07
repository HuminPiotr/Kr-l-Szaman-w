import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export class HandTracker {
    constructor() {
        this.handLandmarker = null;
    }

    async initialize() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU" // Wykorzystanie akceleracji sprzętowej
            },
            runningMode: "VIDEO",
            numHands: 2, // Potrzebujemy dwóch dłoni do wygenerowania kuli
            // Progi OBNIŻONE względem pierwotnych 0.6.
            //
            // Zgłoszone z testu: przy słabym świetle wykrywanie dłoni
            // przeskakuje - dłoń znika na moment i wraca. Niższy próg
            // utrzymania każe trackerowi trzymać się dłoni dłużej, zamiast
            // porzucać ją przy pierwszym gorszym odczycie.
            //
            // Kosztem jest więcej drgań i sporadyczne fałszywe wykrycia, ale
            // dla tej gry CIĄGŁOŚĆ jest ważniejsza od precyzji: pieczęcie
            // rozdziela liczba palców (0/4/10), więc drgania ich nie pomylą,
            // a przeskok trackingu gasił technikę w środku zabawy.
            minHandDetectionConfidence: 0.45,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.35
        });
        
        return true;
    }

    detect(videoElement, timestamp) {
        if (!this.handLandmarker) return null;
        return this.handLandmarker.detectForVideo(videoElement, timestamp);
    }
}
