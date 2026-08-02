/**
 * Przeliczanie koordynatów z klatki wideo na płótno.
 *
 * MediaPipe zwraca wartości znormalizowane (0.0 - 1.0) względem KLATKI WIDEO.
 * Płótno rysuje wideo w trybie "cover" (przeskalowane i przycięte), więc te
 * wartości trzeba przenieść na przestrzeń płótna, zanim cokolwiek narysujemy.
 *
 * Logika wyciągnięta z main.js, żeby dłonie i ciało liczyły to samo tą samą drogą.
 */

/**
 * Parametry dopasowania wideo do płótna w trybie "cover" (jak CSS object-fit: cover).
 * Liczone raz na klatkę i współdzielone przez wszystkich konsumentów.
 */
export function computeCoverFit(video, canvas) {
    const ratio = Math.max(
        canvas.width / video.videoWidth,
        canvas.height / video.videoHeight
    );

    const scaledW = video.videoWidth * ratio;
    const scaledH = video.videoHeight * ratio;

    return {
        ratio,
        scaledW,
        scaledH,
        offsetX: (canvas.width - scaledW) / 2,
        offsetY: (canvas.height - scaledH) / 2,
        canvasW: canvas.width,
        canvasH: canvas.height
    };
}

/** Rysuje klatkę wideo na płótnie zgodnie z wyliczonym dopasowaniem. */
export function drawVideoCover(ctx, video, fit) {
    ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH
    );
}

/**
 * Przenosi listę punktów z przestrzeni wideo do znormalizowanej przestrzeni płótna.
 * Wynik jest nadal w zakresie ~0..1 - mnożenie przez width/height należy do konsumenta.
 *
 * UWAGA: to są koordynaty DO RYSOWANIA. Do pomiarów (kształt, odległość, prędkość)
 * używamy worldLandmarks, które są metryczne i niezależne od odległości od kamery.
 */
export function mapLandmarks(landmarks, fit) {
    return landmarks.map(p => ({
        x: (p.x * fit.scaledW + fit.offsetX) / fit.canvasW,
        y: (p.y * fit.scaledH + fit.offsetY) / fit.canvasH,
        z: p.z,
        visibility: p.visibility // obecne w pose, nieobecne w hands
    }));
}
