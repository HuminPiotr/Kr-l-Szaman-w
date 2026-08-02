/**
 * Znak Striboga - wiatr, podmuch.
 *
 * Nasz odpowiednik znaku Aard: otwarta dłoń, palce szeroko rozstawione,
 * jakby gracz łapał wiatr.
 *
 * Celowo KSZTAŁT STATYCZNY, nie ruch. Rozpoznawanie trajektorii (zamach,
 * przeciągnięcie) to osobny mechanizm i osobny kawałek pracy - tutaj chodzi
 * o udowodnienie, że rejestr obsługuje więcej niż jeden znak.
 *
 * Kształt jest geometrycznie przeciwny do "miseczki" Swaroga: tam palce
 * zbiegają się do kciuka, tu rozchodzą się maksymalnie. Dzięki temu oba znaki
 * nie zapalają się nawzajem.
 *
 * Punkty MediaPipe: 0 = nadgarstek, 9 = nasada środkowego palca,
 *                   4/8/12/16/20 = końce kciuka/wskazującego/środkowego/serdecznego/małego
 */

const KONCE_PALCOW = [4, 8, 12, 16, 20];

// Rozstaw palców (znormalizowany rozmiarem dłoni), przy którym dłoń jest
// uznana za w pełni rozłożoną. Poniżej wynik spada płynnie do zera -
// nigdy skokowo, bo częściowy układ ma dawać częściowy efekt.
const ROZSTAW_PELNY = 1.5;
const ROZSTAW_MINIMALNY = 0.6;

export const stribog = {
    id: 'stribog',
    nazwa: 'Stribog',
    wymaga: 'hands',

    score(frame) {
        const { hands, width, height } = frame;
        if (hands.length === 0) return 0;

        // Wystarczy JEDNA rozłożona dłoń. Bierzemy najlepszą z widocznych,
        // żeby druga dłoń zajęta czym innym nie psuła wyniku.
        let najlepszy = 0;
        for (const dlon of hands) {
            const wynik = oceanDlon(dlon.landmarks, width, height);
            if (wynik > najlepszy) najlepszy = wynik;
        }
        return najlepszy;
    }
};

function oceanDlon(h, width, height) {
    // Skala dłoni na ekranie - bez tego gest działałby tylko z jednej odległości
    const size_dx = (h[0].x - h[9].x) * width;
    const size_dy = (h[0].y - h[9].y) * height;
    const handSize = Math.max(10, Math.sqrt(size_dx * size_dx + size_dy * size_dy));

    // Średni rozstaw sąsiednich końców palców. Rozłożona dłoń ma je daleko
    // od siebie, zaciśnięta albo złożona w miseczkę - blisko.
    let suma = 0;
    for (let i = 0; i < KONCE_PALCOW.length - 1; i++) {
        const a = h[KONCE_PALCOW[i]];
        const b = h[KONCE_PALCOW[i + 1]];
        const dx = (a.x - b.x) * width;
        const dy = (a.y - b.y) * height;
        suma += Math.sqrt(dx * dx + dy * dy);
    }
    const rozstaw = (suma / (KONCE_PALCOW.length - 1)) / handSize;

    // Ciągła rampa zamiast progu - reguła "nic nie mówi źle" obowiązuje
    // także tutaj: dłoń rozłożona w połowie daje pół wyniku, nie zero.
    if (rozstaw <= ROZSTAW_MINIMALNY) return 0;
    return Math.min(1, (rozstaw - ROZSTAW_MINIMALNY) / (ROZSTAW_PELNY - ROZSTAW_MINIMALNY));
}
