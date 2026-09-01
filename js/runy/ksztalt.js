/**
 * Dopasowanie kształtu śladu do szablonu runy.
 *
 * CZYSTA MATEMATYKA - żadnego stanu, żadnego MediaPipe. Powstało PRZED
 * pierwszą runą z tego samego powodu co postawa.js i dlon.js: bez wspólnego
 * miejsca na resampling i normalizację, trzy runy rozjechałyby się na trzy
 * kopie tej samej arytmetyki.
 *
 * ================== DLACZEGO AKURAT TAK ==================
 *
 * 1. SKALOWANIE JEDNORODNE, nie osobno w X i Y. Naiwny wariant $1 Recognizer
 *    rozciąga kształt do kwadratu jednostkowego osobno w każdej osi. To
 *    zamieniłoby pionowy zygzak i poziomą falę w TEN SAM kształt - a to
 *    właśnie ich proporcja (wysoki+wąski vs szeroki+płaski) jest tym, co je
 *    rozdziela. Skalujemy jednym współczynnikiem: RMS promienia = 1.
 *
 * 2. ROTACJA NIE JEST NORMALIZOWANA. Pion i poziom muszą się różnić - gdyby
 *    dopasowanie obracało ślad do najlepszego kąta (jak w oryginalnym $1),
 *    zygzak i fala znów by się zlały.
 *
 * 3. PUNKT STARTU jest dopasowywany, nie zakładany. Koło narysowane od
 *    dowolnego miejsca ma dawać ten sam wynik (cykliczne przesunięcia).
 *    Zygzak narysowany od góry i od dołu to ta sama runa (odwrócenie
 *    kolejności). Świadomie NIE łączymy obu naraz - krąg to pętla, zygzak
 *    i fala to otwarte ścieżki; przesuwanie punktu startu na ścieżce, która
 *    nie jest pętlą, nie ma sensu geometrycznego.
 *
 * 4. WYNIK JEST CIĄGŁY (reguła nadrzędna, GEMINI.md §2). Błąd dopasowania
 *    idzie przez tę samą `rampa()`, której używają postawy i pieczęcie z
 *    dłoni - niedbale nakreślone koło ma dać wynik pośredni, nie zero.
 */
import { rampa } from '../znaki/dlon.js';

export const PUNKTY_SZABLONU = 32;

// ZGADNIĘTE - wymagają potwierdzenia na żywym ciele (nakładka D pokazuje
// błąd dopasowania lidera). Jednostka: błąd średniokwadratowy PO normalizacji
// (promień RMS = 1), więc bezwymiarowy i niezależny od odległości od kamery.
const BLAD_ZERO = 0.28;   // poniżej - pełne dopasowanie
const BLAD_PELNY = 1.05;  // powyżej - to już inny kształt

function zdrowyPunkt(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function dlugoscSciezki(pkt) {
    let suma = 0;
    for (let i = 1; i < pkt.length; i++) {
        suma += Math.hypot(pkt[i].x - pkt[i - 1].x, pkt[i].y - pkt[i - 1].y);
    }
    return suma;
}

/**
 * Resampling do N punktów równo rozłożonych WZDŁUŻ DŁUGOŚCI ścieżki (nie
 * co N-ty punkt wejściowy - wejście ma nierówny odstęp czasowy między
 * próbkami, bo tempo kreślenia gracza nie jest stałe).
 *
 * Ścieżka krótsza niż dwa różne punkty nie ma kształtu - zwraca null,
 * a nie tablicę zer, żeby wywołujący jawnie obsłużył "jeszcze nic nie
 * narysowano" zamiast po cichu dopasowywać punkt do szablonu.
 */
export function resampluj(pkt, n = PUNKTY_SZABLONU) {
    const zdrowe = (pkt ?? []).filter(zdrowyPunkt);
    if (zdrowe.length < 2) return null;

    const dlugosc = dlugoscSciezki(zdrowe);
    if (!(dlugosc > 1e-6)) return null;

    const krok = dlugosc / (n - 1);
    const wynik = [zdrowe[0]];
    let pozostalo = krok;
    let i = 1;
    let poprzedni = zdrowe[0];

    while (i < zdrowe.length && wynik.length < n) {
        const biezacy = zdrowe[i];
        const odcinek = Math.hypot(biezacy.x - poprzedni.x, biezacy.y - poprzedni.y);

        if (odcinek < pozostalo) {
            pozostalo -= odcinek;
            poprzedni = biezacy;
            i++;
            continue;
        }

        const t = odcinek > 1e-9 ? pozostalo / odcinek : 0;
        const nowy = {
            x: poprzedni.x + t * (biezacy.x - poprzedni.x),
            y: poprzedni.y + t * (biezacy.y - poprzedni.y)
        };
        wynik.push(nowy);
        poprzedni = nowy;
        pozostalo = krok;
    }

    while (wynik.length < n) wynik.push(zdrowe[zdrowe.length - 1]);
    return wynik;
}

/** Środek ciężkości. */
function centroid(pkt) {
    let x = 0, y = 0;
    for (const p of pkt) { x += p.x; y += p.y; }
    return { x: x / pkt.length, y: y / pkt.length };
}

/**
 * Wyśrodkowanie + skalowanie JEDNORODNE (RMS promienia = 1). Rotacja
 * celowo nietknięta - patrz nagłówek pliku, punkt 2.
 */
export function znormalizuj(pkt) {
    const c = centroid(pkt);
    const wysrodkowane = pkt.map(p => ({ x: p.x - c.x, y: p.y - c.y }));

    let sumaKw = 0;
    for (const p of wysrodkowane) sumaKw += p.x * p.x + p.y * p.y;
    const rms = Math.sqrt(sumaKw / wysrodkowane.length);
    if (!(rms > 1e-6)) return null; // punkt, nie kształt

    return wysrodkowane.map(p => ({ x: p.x / rms, y: p.y / rms }));
}

/** Błąd średniokwadratowy między dwiema listami punktów TEJ SAMEJ długości. */
function bladSredniokwadratowy(a, b) {
    let suma = 0;
    for (let i = 0; i < a.length; i++) {
        const dx = a[i].x - b[i].x, dy = a[i].y - b[i].y;
        suma += dx * dx + dy * dy;
    }
    return Math.sqrt(suma / a.length);
}

/** Wszystkie N cyklicznych przesunięć listy punktów (dla kształtów zamkniętych). */
function przesuniecia(pkt) {
    const warianty = [];
    for (let s = 0; s < pkt.length; s++) {
        warianty.push(pkt.slice(s).concat(pkt.slice(0, s)));
    }
    return warianty;
}

/**
 * Warianty punktu startu / kierunku, jakie szablon dopuszcza jako "ten sam
 * znak" - patrz nagłówek pliku, punkt 3. Cykliczność i odwracalność są
 * rozłączne z założenia (pętla kontra otwarta ścieżka).
 */
function wariantySzablonu(szablon) {
    if (szablon.cykliczny) return przesuniecia(szablon.punkty);
    if (szablon.odwracalny) return [szablon.punkty, [...szablon.punkty].reverse()];
    return [szablon.punkty];
}

/**
 * Dopasowanie znormalizowanego śladu do jednego szablonu, 0..1.
 *
 * @param {Array|null} sladZnormalizowany  wynik znormalizuj(resampluj(...))
 * @param {{punkty: Array, cykliczny?: boolean, odwracalny?: boolean}} szablon
 */
export function dopasuj(sladZnormalizowany, szablon) {
    if (!sladZnormalizowany || !szablon?.punkty?.length) return 0;

    let najlepszyBlad = Infinity;
    for (const wariant of wariantySzablonu(szablon)) {
        if (wariant.length !== sladZnormalizowany.length) continue;
        const b = bladSredniokwadratowy(sladZnormalizowany, wariant);
        if (Number.isFinite(b) && b < najlepszyBlad) najlepszyBlad = b;
    }
    if (!Number.isFinite(najlepszyBlad)) return 0;

    // Malejąco: mały błąd -> wynik bliski 1. rampa() obsługuje "od > doPelni"
    // (patrz jej własny komentarz w znaki/postawa.js).
    return rampa(najlepszyBlad, BLAD_PELNY, BLAD_ZERO);
}

/** Wygodne połączenie resamplingu i normalizacji - to jest to, co karmi się dopasuj(). */
export function znormalizujSlad(surowePunkty, n = PUNKTY_SZABLONU) {
    const r = resampluj(surowePunkty, n);
    return r ? znormalizuj(r) : null;
}
