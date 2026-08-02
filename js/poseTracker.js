import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export class PoseTracker {
    constructor() {
        this.poseLandmarker = null;
    }

    async initialize() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                // Wariant "lite" - najtańszy z trzech. Ciało napędza 90% rozgrywki,
                // więc liczy się płynność, nie precyzja pojedynczego stawu.
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1, // Gra jednoosobowa
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: false // Niepotrzebne, a kosztuje
        });

        return true;
    }

    detect(videoElement, timestamp) {
        if (!this.poseLandmarker) return null;
        return this.poseLandmarker.detectForVideo(videoElement, timestamp);
    }
}
