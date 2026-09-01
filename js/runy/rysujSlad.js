/**
 * Świecąca wstęga za nadgarstkiem kreślącym runę.
 *
 * TO NIE JEST DEBUG - to jedyne sprzężenie zwrotne, dzięki któremu kreślenia
 * da się w ogóle nauczyć. Bez widocznego śladu gracz nie ma pojęcia, czy
 * to, co rysuje w powietrzu, przypomina koło, czy jest bezkształtną smugą.
 *
 * Rysuje z `punkty2D()` (landmarks 2D, znormalizowane do płótna) - to są
 * współrzędne DO RYSOWANIA, nigdy do pomiaru (ten idzie z worldLandmarks,
 * patrz slad.js). Mnożenie przez W/H jest konieczne z tego samego powodu co
 * w efekty.js: mapLandmarks() zwraca wartości znormalizowane 0..1.
 *
 * LUKI (punkt = null) PRZERYWAJĄ WSTĘGĘ, nie łączą się linią prostą. Ślad
 * jest budowany z worldLandmarks (do pomiaru), a rysowany z landmarks 2D -
 * pojedyncza próbka może mieć jedno bez drugiego. Połączenie dwóch punktów
 * odległych w czasie prostą linią wyglądałoby jak część kształtu, którego
 * gracz nie narysował - myląca informacja zwrotna w jedynym kanale, jaki ma.
 */

const BARWA = '150, 220, 255'; // ten sam odcień co szkielet dłoni w main.js

export function rysujSlad(ctx, slad, W, H) {
    const pkt = slad.punkty2D();
    const zdrowych = pkt.filter(Boolean).length;
    if (zdrowych < 2) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Segment po segmencie, żeby przezroczystość rosła ku najnowszemu
    // końcowi - świeży ślad jaśniejszy niż ten, który zaraz wypadnie z okna.
    // Indeks liczony po PEŁNEJ (niekompaktowanej) tablicy, żeby luka nie
    // zaburzała gradientu - "jak dawno temu" nie zależy od tego, czy akurat
    // mieliśmy odczyt 2D.
    for (let i = 1; i < pkt.length; i++) {
        const a = pkt[i - 1], b = pkt[i];
        if (!a || !b) continue; // luka - nowy odcinek zaczyna się dalej, nie łączymy przez nią

        const t = i / (pkt.length - 1); // 0 = najstarszy, 1 = najnowszy
        ctx.strokeStyle = `rgba(${BARWA}, ${(0.08 + 0.55 * t).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, H * 0.006 * (0.4 + 0.6 * t));
        ctx.beginPath();
        ctx.moveTo(a.x * W, a.y * H);
        ctx.lineTo(b.x * W, b.y * H);
        ctx.stroke();
    }

    // Grot na końcu śladu - ostatni punkt z odczytem 2D, nie ostatni w ogóle
    // (mógłby być luką).
    for (let i = pkt.length - 1; i >= 0; i--) {
        if (!pkt[i]) continue;
        ctx.fillStyle = `rgba(${BARWA}, 0.9)`;
        ctx.beginPath();
        ctx.arc(pkt[i].x * W, pkt[i].y * H, H * 0.01, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
}

export function rysujSlady(ctx, sladLewy, sladPrawy, W, H) {
    rysujSlad(ctx, sladLewy, W, H);
    rysujSlad(ctx, sladPrawy, W, H);
}
