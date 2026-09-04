/**
 * ================== ODPIĘTE OD GRY (2026-09-02) ==================
 *
 * Ten moduł NIE jest zarejestrowany w main.js. Runy kreślone w powietrzu
 * przegrały jako PIECZĘCIE - kształt kreślony rzadko wychodzi daleko
 * powyżej progu, więc składa się wolno i nie mieści kombosów w oknie
 * czasowym. Silnik jest jednak sprawny i został ŚWIADOMIE ZACHOWANY jako
 * materiał na przyszłe TECHNIKI (kreślony kształt jako sposób RZUCANIA,
 * nie składania). tools/test-runy.mjs nadal go pilnuje.
 *
 * Zastąpiony przez pięć pieczęci styku:
 * docs/superpowers/specs/2026-09-02-piec-pieczeci-styku-design.md
 */

/**
 * Szablony run - trzy kształty kreślone nadgarstkiem w powietrzu.
 *
 * SYNTETYCZNE, NIE NAGRANE - i to jest ZNANY DŁUG, nie przeoczenie.
 *
 * Precedens tego repo (GEMINI.md §6, PROG_SZARPNIECIA w plynnosc.js) jest
 * jednoznaczny: stała wyprowadzona z sygnału syntetycznego jest dopuszczalnym
 * PUNKTEM STARTOWYM, ale wymaga potwierdzenia na żywym ciele, zanim komukolwiek
 * powie się, że jest gotowa. Amplituda, okres i liczba oscylacji zygzaka i
 * fali poniżej są ZGADNIĘTE z wyobraźni - żywe ramię prawie na pewno rysuje
 * inaczej.
 *
 * ŚCIEŻKA DO POPRAWY (Krok 0b planu): dodać w debugHud.js klawisz zrzucający
 * znormalizowany ślad lidera do konsoli, nagrać po kilka przejść każdego
 * kształtu na żywym ciele, wkleić wybrany przebieg tutaj w miejsce
 * generatora. Kształt sekcji (punkty/cykliczny/odwracalny) się nie zmieni -
 * zmieni się tylko to, skąd biorą się `punkty`.
 */
import { resampluj, znormalizuj, PUNKTY_SZABLONU } from './ksztalt.js';

function znormalizowanySzablon(surowePunkty, opcje) {
    const r = resampluj(surowePunkty, PUNKTY_SZABLONU);
    const n = r ? znormalizuj(r) : null;
    if (!n) throw new Error('Szablon runy zdegenerowany - popraw punkty kontrolne.');
    return { punkty: n, ...opcje };
}

// --- Koło (Mokosz, żywioł wody) ---
// Cykliczny: brak kanonicznego punktu startu, dopasowanie szuka najlepszego
// cyklicznego przesunięcia (ksztalt.js).
function generujKolo() {
    const pkt = [];
    for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        pkt.push({ x: Math.cos(t), y: Math.sin(t) });
    }
    return pkt;
}

// --- Pionowy zygzak (Perun, żywioł błyskawicy) ---
// Odwracalny: narysowany od góry i od dołu to ta sama runa. Wysoki i wąski -
// to ta proporcja (nie rotacja, która nie jest normalizowana) rozdziela go
// od poziomej fali.
function generujZygzak() {
    const kontrolne = [
        { x: 0, y: -1.0 }, { x: 0.3, y: -0.5 }, { x: -0.3, y: 0 },
        { x: 0.3, y: 0.5 }, { x: 0, y: 1.0 }
    ];
    return zageszczony(kontrolne);
}

// --- Pozioma fala (Stribog, żywioł wiatru) ---
// Odwracalny, jak zygzak. Szeroki i płaski.
function generujFale() {
    const kontrolne = [];
    for (let i = 0; i <= 16; i++) {
        const x = -1.0 + (i / 16) * 2.0;
        const y = 0.35 * Math.sin((i / 16) * Math.PI * 2);
        kontrolne.push({ x, y });
    }
    return kontrolne;
}

/** Gęste próbkowanie odcinkami - resampluj() i tak sprowadzi to do stałej
 *  liczby punktów, ale potrzebuje wejścia gęstszego niż same węzły. */
function zageszczony(kontrolne, naOdcinek = 24) {
    const wynik = [];
    for (let i = 0; i < kontrolne.length - 1; i++) {
        const a = kontrolne[i], b = kontrolne[i + 1];
        for (let j = 0; j < naOdcinek; j++) {
            const t = j / naOdcinek;
            wynik.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        }
    }
    wynik.push(kontrolne[kontrolne.length - 1]);
    return wynik;
}

export const SZABLONY = {
    kolo: znormalizowanySzablon(generujKolo(), { cykliczny: true, odwracalny: false }),
    zygzak: znormalizowanySzablon(generujZygzak(), { cykliczny: false, odwracalny: true }),
    fala: znormalizowanySzablon(generujFale(), { cykliczny: false, odwracalny: true })
};
