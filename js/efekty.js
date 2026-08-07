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
import { NADG_L, NADG_P, BARK_L, BARK_P, BIODRO_L, BIODRO_P } from './znaki/postawa.js';

// Punkty MediaPipe używane wyłącznie do zaczepienia efektu.
const KOSTKA_L = 27, KOSTKA_P = 28;

export const TABELA = {
    // Pieczęcie - LEKKIE. Mają być przyjemne, nie efektowne; efektowność
    // jest nagrodą za kombo.
    perun:  { barwa: '50, 100%, 92%', ksztalt: 'promien',       czas: 0.7 },
    mokosz: { barwa: '120, 60%, 62%', ksztalt: 'pierscienStop', czas: 0.9 },
    weles:  { barwa: '280, 70%, 58%', ksztalt: 'sciagniecie',   czas: 0.9 },

    // Techniki - MOCNE. Odpalają się gratis, jako nagroda za ułożenie.
    gromWZiemie:  { barwa: '50, 100%, 95%', ksztalt: 'blyskIFala', czas: 1.4 },
    zewPodziemia: { barwa: '285, 75%, 48%', ksztalt: 'mglaIMrok',  czas: 1.8 }
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
            rysuj(ctx, def, p, alfa, lm, frame.width, frame.height);
        }
        ctx.restore();
    }
}

function rysuj(ctx, def, p, alfa, lm, W, H) {
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
    const sr = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    switch (def.ksztalt) {
        case 'promien': {
            // Pionowa smuga wzdłuż WYŻEJ uniesionej dłoni.
            const a = p2(NADG_L, W * 0.35, H * 0.3);
            const b = p2(NADG_P, W * 0.65, H * 0.3);
            const dlon = a.y < b.y ? a : b;
            const g = ctx.createLinearGradient(dlon.x, 0, dlon.x, dlon.y);
            g.addColorStop(0, kolor(0));
            g.addColorStop(1, kolor(alfa * 0.85));
            ctx.fillStyle = g;
            ctx.fillRect(dlon.x - W * 0.012, 0, W * 0.024, dlon.y);
            break;
        }
        case 'pierscienStop': {
            // Elipsa rozchodząca się od linii kostek.
            const s = sr(p2(KOSTKA_L, W * 0.45, H * 0.9), p2(KOSTKA_P, W * 0.55, H * 0.9));
            const r = W * (0.05 + 0.20 * p);
            ctx.strokeStyle = kolor(alfa * 0.7);
            ctx.lineWidth = Math.max(1, H * 0.008 * (1 - p * 0.6));
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, r, r * 0.30, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'sciagniecie': {
            // Pierścień ZBIEGAJĄCY się do środka tułowia - odwrotność Mokoszy.
            const s = sr(sr(p2(BARK_L, W * 0.45, H * 0.35), p2(BARK_P, W * 0.55, H * 0.35)),
                         sr(p2(BIODRO_L, W * 0.46, H * 0.6), p2(BIODRO_P, W * 0.54, H * 0.6)));
            const r = W * (0.28 * (1 - p) + 0.02);
            ctx.strokeStyle = kolor(alfa * 0.8);
            ctx.lineWidth = Math.max(1, H * 0.012 * p);
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'blyskIFala': {
            // Błysk całego kadru gaśnie szybko, fala idzie dalej od stóp.
            ctx.fillStyle = kolor(alfa * 0.28 * Math.max(0, 1 - p * 3));
            ctx.fillRect(0, 0, W, H);
            const s = sr(p2(KOSTKA_L, W * 0.45, H * 0.9), p2(KOSTKA_P, W * 0.55, H * 0.9));
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
