/**
 * Znak Swaroga - ogień, kuźnia.
 *
 * Dłonie ułożone w miseczkę naprzeciw siebie, jak przy rozdmuchiwaniu żaru.
 * To jest gest, który aplikacja rozpoznawała od początku - tutaj przeniesiony
 * 1:1 z PowerBall.calculateEfficiency(), BEZ zmiany zachowania.
 *
 * Celowo nadal na landmarks 2D, mimo że worldLandmarks byłyby odporniejsze.
 * Refaktor i zmiana zachowania w jednym kroku uniemożliwiają stwierdzenie,
 * co się zepsuło. Przepisanie na worldLandmarks to osobny krok - i wymaga
 * najpierw sprawdzenia, czy hand worldLandmarks są faktycznie znormalizowane
 * względem obrotu (metryczna skala - tak; niezmienniczość obrotowa - do sprawdzenia).
 *
 * Punkty MediaPipe: 0 = nadgarstek, 4 = kciuk, 8/12/16 = wskazujący/środkowy/serdeczny,
 *                   9 = nasada środkowego palca (stabilny środek dłoni)
 */
export const swarog = {
    id: 'swarog',
    nazwa: 'Swaróg',
    wymaga: 'hands',

    score(frame) {
        const hands = frame.hands;
        const width = frame.width;
        const height = frame.height;

        if (hands.length === 0) return 0;

        if (hands.length === 2) {
            const h1 = hands[0].landmarks;
            const h2 = hands[1].landmarks;

            const dx = (h1[9].x - h2[9].x) * width;
            const dy = (h1[9].y - h2[9].y) * height;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Normalizacja przez rozmiar dłoni na ekranie - dzięki temu gest
            // działa tak samo blisko i daleko od kamery.
            const size_dx = (h1[0].x - h1[9].x) * width;
            const size_dy = (h1[0].y - h1[9].y) * height;
            const handSize = Math.max(10, Math.sqrt(size_dx * size_dx + size_dy * size_dy));

            const normalizedDistance = distance / handSize;

            // "Miseczka" jest najlepsza przy odległości od 1.2 do 5 rozmiarów dłoni
            if (normalizedDistance > 1.2 && normalizedDistance < 5.0) {
                const diff = Math.abs(normalizedDistance - 2.5);
                return Math.max(0, 1.0 - (diff / 2.5));
            }
        } else if (hands.length === 1) {
            // Mechanika jednoręczna - palce ułożone "w koszyczek" blisko kciuka (ale nie zaciśnięte)
            const h = hands[0].landmarks;

            const size_dx = (h[0].x - h[9].x) * width;
            const size_dy = (h[0].y - h[9].y) * height;
            const handSize = Math.max(10, Math.sqrt(size_dx * size_dx + size_dy * size_dy));

            const thumb = h[4];
            const fingers = [8, 12, 16]; // wskazujący, środkowy, serdeczny
            let totalDist = 0;

            for (let idx of fingers) {
                const dx = (h[idx].x - thumb.x) * width;
                const dy = (h[idx].y - thumb.y) * height;
                totalDist += Math.sqrt(dx * dx + dy * dy);
            }

            const avgDist = totalDist / fingers.length;
            const normalizedDist = avgDist / handSize;

            if (normalizedDist > 0.5 && normalizedDist < 1.3) {
                const diff = Math.abs(normalizedDist - 0.9);
                return Math.max(0, 1.0 - (diff / 0.4));
            }
        }

        return 0;
    }
};
