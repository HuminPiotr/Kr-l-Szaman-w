/**
 * Efekty pieczęci i technik.
 *
 * TABELA DANYCH, nie plik na efekt. Każdy efekt to wiersz (barwa, kształt,
 * czas trwania) rysowany JEDNĄ funkcją. To jest część najbardziej narażona
 * na rozrost - ma nim nie być.
 *
 * Rysuje z landmarks 2D (przemapowanych), bo to RYSOWANIE, nie pomiar.
 * Pomiary idą z worldLandmarks (GEMINI.md:49).
 *
 * Płótno ma CSS scaleX(-1), więc kształty wychodzą poprawnie, a tekstu
 * tutaj nie rysujemy (wyszedłby lustrzany - GEMINI.md:88).
 */
// ZACZEPIENIE W DŁONIACH, nie w kostkach.
//
// Kostki na kamerze laptopa po prostu nie ma w kadrze, więc efekty spadały na
// pozycje zastępcze i gracz zgłosił, że "efekt nie powala". Dłonie są zawsze
// w kadrze, zawsze w centrum uwagi i to z nich składa się pieczęć - efekt
// wychodzący z palców czyta się nieporównanie lepiej niż elipsa u stóp.
function srodekDloni(frame, W, H) {
    const h = (frame.hands ?? []).filter(d => d.landmarks?.[0] && Number.isFinite(d.landmarks[0].x));
    if (!h.length) return { x: W * 0.5, y: H * 0.45 };
    let x = 0, y = 0, n = 0;
    for (const d of h) {
        // Środek między nadgarstkiem a nasadą środkowego palca - stabilniejszy
        // niż opuszki, które przy składaniu pieczęci mocno się przemieszczają.
        x += (d.landmarks[0].x + d.landmarks[9].x) / 2;
        y += (d.landmarks[0].y + d.landmarks[9].y) / 2;
        n++;
    }
    return { x: (x / n) * W, y: (y / n) * H };
}

export const TABELA = {
    // Pieczęcie - LEKKIE. Mają być przyjemne, nie efektowne; efektowność
    // jest nagrodą za kombo.
    //
    // PIĘĆ PIECZĘCI STYKU (2026-09-02, docs/superpowers/specs/2026-09-02-
    // -piec-pieczeci-styku-design.md) - jedna barwa na ŻYWIOŁ, wiersz na
    // id znaku ze znaki/*.js (weles/perun/stribog/mokosz czytają teraz
    // POZĘ, nie mają już wariantu otwarta/pięść).
    swarog:  { barwa: '25, 100%, 62%',  ksztalt: 'pierscien',   czas: 0.9 },  // ogień
    weles:   { barwa: '280, 70%, 58%',  ksztalt: 'sciagniecie', czas: 0.9 },  // ziemia
    perun:   { barwa: '50, 100%, 92%',  ksztalt: 'pierscien',   czas: 0.7 },  // błyskawica
    stribog: { barwa: '160, 55%, 75%',  ksztalt: 'pierscien',   czas: 0.8 },  // powietrze
    mokosz:  { barwa: '200, 70%, 70%',  ksztalt: 'pierscien',   czas: 0.9 },  // woda
    // szczur, splot celowo NIEOBECNE - znaki odpięte (js/main.js), pliki
    // zostają na dysku i mogłyby dostać te wpisy z powrotem, gdyby wróciły.
    //
    // Sześć wierszy RUNOWYCH niżej ZOSTAJĄ, mimo że runy są odpięte od
    // main.js (js/runy/*, ODPIĘTE OD GRY): tools/test-runy.mjs importuje tę
    // tabelę wprost i sprawdza jej KOMPLETNOŚĆ względem DEFINICJE run - ten
    // test ma dalej świecić zielono, bo silnik run żyje jako materiał na
    // przyszłe TECHNIKI. Usunięcie tych wierszy zdjęłoby mu siatkę regresji.
    'mokosz-otwarta':  { barwa: '200, 70%, 70%', ksztalt: 'pierscien',   czas: 0.9 },
    'mokosz-piesc':    { barwa: '200, 70%, 70%', ksztalt: 'sciagniecie', czas: 0.9 },
    'perun-otwarta':   { barwa: '50, 100%, 92%', ksztalt: 'pierscien',   czas: 0.7 },
    'perun-piesc':     { barwa: '50, 100%, 92%', ksztalt: 'sciagniecie', czas: 0.7 },
    'stribog-otwarta': { barwa: '160, 55%, 75%', ksztalt: 'pierscien',   czas: 0.8 },
    'stribog-piesc':   { barwa: '160, 55%, 75%', ksztalt: 'sciagniecie', czas: 0.8 },

    // Techniki - MOCNE. Odpalają się gratis, jako nagroda za ułożenie.
    // zewPodziemia CELOWO NIEOBECNA - ten kombos odszedł razem z runami
    // z tabeli js/kombosy.js, więc nie odpala się już nigdy; wiersz TABELA
    // dla niego byłby martwym kodem, nie zabezpieczeniem.
    gromWOgniu:   { barwa: '35, 100%, 92%', ksztalt: 'blyskIFala', czas: 1.4 },
    // Zapowiedź uzbrojenia Aard - rozbłysk w chwili złożenia kombosa.
    // Sama fala jest interaktywna i rysuje ją js/fala.js, nie tabela.
    aard:         { barwa: '200, 70%, 88%', ksztalt: 'pierscien',  czas: 0.8 },
    // Błysk AKTYWACJI nagrody - jednorazowy, jedna barwa (TABELA nie umie
    // prawdziwej tęczy). Sama tęczowa wstęga żyje w aura.js/tecza.js i
    // trwa 30 s niezależnie od tego krótkiego błysku.
    tecza:        { barwa: '0, 0%, 100%',   ksztalt: 'blyskIFala', czas: 1.2 }
};

export class Efekty {
    constructor() {
        this.aktywne = [];   // [{ id, t, czas }]
    }

    odpal(id) {
        const def = TABELA[id];
        if (!def) return;
        this.aktywne.push({ id, t: 0, czas: def.czas });
    }

    updateAndDraw(ctx, frame, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;

        for (const e of this.aktywne) e.t += krok;
        this.aktywne = this.aktywne.filter(e => e.t < e.czas);
        if (!this.aktywne.length) return;

        const lm = frame.pose?.landmarks;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const e of this.aktywne) {
            const def = TABELA[e.id];
            // Postęp 0..1 i obwiednia: szybki narost, powolne wygasanie.
            const p = Math.min(1, e.t / e.czas);
            const alfa = Math.sin(Math.pow(1 - p, 0.6) * Math.PI * 0.5);
            rysuj(ctx, def, p, alfa, lm, frame.width, frame.height,
                  srodekDloni(frame, frame.width, frame.height));
        }
        ctx.restore();
    }
}

function rysuj(ctx, def, p, alfa, lm, W, H, zaczep) {
    const kolor = (a) => `hsla(${def.barwa}, ${a.toFixed(3)})`;

    // Zaczepienia. Bez pozy efekt trafia w środek kadru - lepszy efekt
    // nie na miejscu niż brak efektu i wrażenie, że gest nie zadziałał.
    //
    // MNOŻENIE PRZEZ W I H JEST KONIECZNE. mapLandmarks() zwraca wartości
    // ZNORMALIZOWANE (0..1) względem płótna, nie piksele. Bez tego ctx.arc()
    // dostawał x=0.5, czyli pół piksela od krawędzi - a przy CSS scaleX(-1)
    // wszystkie efekty zaczepione w ciele zbierały się w prawym górnym rogu.
    // Zmyliło to, że fallbacki poniżej są już w pikselach (W * 0.35), więc
    // kod wyglądał spójnie.
    const p2 = (i, zx, zy) => (lm && lm[i] && Number.isFinite(lm[i].x))
        ? { x: lm[i].x * W, y: lm[i].y * H } : { x: zx, y: zy };

    switch (def.ksztalt) {
        case 'promien': {
            // Pionowa smuga w górę od dłoni.
            const g = ctx.createLinearGradient(zaczep.x, 0, zaczep.x, zaczep.y);
            g.addColorStop(0, kolor(0));
            g.addColorStop(1, kolor(alfa * 0.85));
            ctx.fillStyle = g;
            ctx.fillRect(zaczep.x - W * 0.012, 0, W * 0.024, zaczep.y);
            break;
        }
        case 'pierscien': {
            // Pierścień rozchodzący się od dłoni.
            const s = zaczep;
            const r = W * (0.05 + 0.20 * p);
            ctx.strokeStyle = kolor(alfa * 0.7);
            ctx.lineWidth = Math.max(1, H * 0.008 * (1 - p * 0.6));
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, r, r * 0.30, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'sciagniecie': {
            // Pierścień ZBIEGAJĄCY się do dłoni - odwrotność Swaroga.
            const s = zaczep;
            const r = W * (0.28 * (1 - p) + 0.02);
            ctx.strokeStyle = kolor(alfa * 0.8);
            ctx.lineWidth = Math.max(1, H * 0.012 * p);
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'blyskIFala': {
            // Błysk całego kadru gaśnie szybko, fala rozchodzi się od dłoni.
            ctx.fillStyle = kolor(alfa * 0.28 * Math.max(0, 1 - p * 3));
            ctx.fillRect(0, 0, W, H);
            const s = zaczep;
            const r = W * (0.05 + 0.85 * p);
            ctx.strokeStyle = kolor(alfa * 0.9);
            ctx.lineWidth = Math.max(1, H * 0.02 * (1 - p));
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, r, r * 0.32, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'mglaIMrok': {
            // Mgła wznosząca się od dołu kadru. Rysowana przez 'lighter',
            // więc mrok robimy niskim, ciemnym fioletem, nie czernią -
            // czerń w tym trybie jest niewidoczna.
            const wys = H * (0.15 + 0.5 * Math.sin(p * Math.PI));
            const g = ctx.createLinearGradient(0, H, 0, H - wys);
            g.addColorStop(0, kolor(alfa * 0.55));
            g.addColorStop(1, kolor(0));
            ctx.fillStyle = g;
            ctx.fillRect(0, H - wys, W, wys);
            break;
        }
    }
}
