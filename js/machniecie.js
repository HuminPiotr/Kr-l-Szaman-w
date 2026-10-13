/**
 * Detektor machnięć ręką - dla Zawieruchy (spec 2026-10-08-grzmot-i-
 * zawierucha-design.md). Zwraca ZDARZENIA "ta ręka machnęła w lewo/prawo".
 *
 * Wejście: NADGARSTKI POZY (15, 16), nie landmarki dłoni. Kształt dłoni nie
 * ma tu znaczenia (życzenie właściciela gry: "nie otwarta dłoń, tylko
 * machnięcie"), a pozę MediaPipe trzyma przy szybkim ruchu dużo lepiej niż
 * dłonie (lekcja z Łuku Peruna). Stałe indeksy = stała tożsamość ręki,
 * bez kluczy stronności, które w js/podmuch.js potrafią się zamienić.
 *
 * Wzorce wprost z js/podmuch.js (tam opisane szczegółowo):
 *  - prędkość z BUFORA świeżych próbek z OKNO_S, nie z jednej różnicy klatek;
 *  - "świeży" = pozycja się zmieniła (main.js woła co klatkę rysowania,
 *    poza odświeża się w tempie kamery);
 *  - POTWIERDZENIE świeżych próbek nad progiem - artefakt trwa jedną.
 *
 * Jednostka prędkości: SZEROKOŚCI BARKÓW na sekundę (barkiKlatki().skala) -
 * ta sama miara ciała co w całej grze, niezależna od odległości od kamery.
 * Liczy się tylko składowa POZIOMA (ekranowa) - Zawierucha wieje w lewo albo
 * w prawo; warunek KIERUNKOWOSC odsiewa ruchy głównie pionowe.
 *
 * PRZERWA_REKI_S po zdarzeniu ręki: połyka POWRÓT ręki po machnięciu
 * (inaczej szybki powrót byłby fałszywym machnięciem w przeciwną stronę).
 * Druga ręka nie czeka - lewa, prawa, lewa w szybkim tempie to 3 zdarzenia.
 *
 * OŚ 'gora' (Fala Mokoszy, spec 2026-10-13-fala-i-kruki-design.md): zamach
 * od dołu do góry. Liczy się składowa PIONOWA w górę (vy < 0 na ekranie),
 * a ruch musi ZACZĄĆ się poniżej linii barków - bez tego ręka uniesiona
 * do pieczęci i opadająca z powrotem dawałaby zdarzenia przy samym
 * ruszaniu się nad głową. Zdarzenie niesie `x` - strona fali to strona
 * ekranu, po której jest ręka (odporne na lustro obrazu).
 */
import { barkiKlatki } from './sledzenie.js';

// ZGADNIĘTE - potwierdzić na nakładce (klawisz D), pole zawierucha.detektor.
export const NASTAWY = {
    PROG_PREDKOSCI: 5.0,       // szerokości barków / s w poziomie
    KIERUNKOWOSC: 0.6,         // |vx| >= to * |v| - machnięcie głównie poziome
    POTWIERDZENIE: 2,          // świeże próbki z rzędu nad progiem
    PRZERWA_REKI_S: 0.35,
    OKNO_S: 0.12,              // s - bufor próbek (jak OKNO_MACHNIECIA_S w podmuch.js)
    MIN_PROBEK: 2,
    MAX_PROBEK: 6,
    PROG_WIDOCZNOSCI: 0.5,     // visibility nadgarstka poniżej = poza kadrem (zgadywany)
    // Oś 'gora' - ZGADNIĘTE, pole falaMokoszy.detektor na nakładce D.
    PROG_PREDKOSCI_GORA: 4.0,  // szerokości barków / s w górę
    START_PONIZEJ_BARKOW: 0.2  // najniższa próbka bufora co najmniej tyle * skala pod barkami
};

const REKI = [['L', 15], ['P', 16]];

export class DetektorMachniec {
    /** @param {{os?: 'poziom'|'gora'}} [opcje]  domyślnie poziom (Zawierucha) */
    constructor({ os = 'poziom' } = {}) {
        this._os = os;
        this._zegar = 0;
        this._bufory = { L: [], P: [] };
        this._licznik = { L: 0, P: 0 };
        this._przerwa = { L: 0, P: 0 };
        this.diagnostyka = { predkosc: 0, prog: this._prog() };
    }

    _prog() { return this._os === 'gora' ? NASTAWY.PROG_PREDKOSCI_GORA : NASTAWY.PROG_PREDKOSCI; }

    /**
     * @returns {{reka:'L'|'P', kierunek:-1|1, x:number, y:number}[]}  zdarzenia z tej klatki, px
     *          (oś 'gora': kierunek zawsze -1 = w górę)
     */
    update(frame, W, H, dt) {
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._zegar += krok;
        const zdarzenia = [];
        let najszybciej = 0;
        const barki = Number.isFinite(W) && Number.isFinite(H) ? barkiKlatki(frame, W, H) : null;
        const lm = frame?.pose?.landmarks;

        for (const [reka, idx] of REKI) {
            this._przerwa[reka] = Math.max(0, this._przerwa[reka] - krok);
            const p = lm?.[idx];
            const widac = barki && p && Number.isFinite(p.x) && Number.isFinite(p.y)
                && !(Number.isFinite(p.visibility) && p.visibility < N.PROG_WIDOCZNOSCI);
            if (!widac) {
                // Brak danych to nie bezruch - bufor od nowa, bez zgadywanego skoku po powrocie.
                this._bufory[reka] = [];
                this._licznik[reka] = 0;
                continue;
            }
            const x = p.x * W, y = p.y * H;
            const buf = this._bufory[reka];
            const ostatnia = buf[buf.length - 1];
            if (!ostatnia) { buf.push({ x, y, t: this._zegar }); continue; }
            if (x === ostatnia.x && y === ostatnia.y) continue;   // brak nowej detekcji - licznik zostaje

            buf.push({ x, y, t: this._zegar });
            while (buf.length > N.MIN_PROBEK && this._zegar - buf[0].t > N.OKNO_S) buf.shift();
            while (buf.length > N.MAX_PROBEK) buf.shift();
            const a = buf[0], b = buf[buf.length - 1];
            const czas = b.t - a.t;
            if (!(czas > 1e-6)) continue;
            const vx = (b.x - a.x) / czas / barki.skala;
            const vy = (b.y - a.y) / czas / barki.skala;
            let spelnia;
            if (this._os === 'gora') {
                najszybciej = Math.max(najszybciej, -vy);
                const najnizej = Math.max(...buf.map(q => q.y));
                spelnia = -vy >= N.PROG_PREDKOSCI_GORA && -vy >= N.KIERUNKOWOSC * Math.hypot(vx, vy)
                    && najnizej >= barki.y + N.START_PONIZEJ_BARKOW * barki.skala;
            } else {
                najszybciej = Math.max(najszybciej, Math.abs(vx));
                spelnia = Math.abs(vx) >= N.PROG_PREDKOSCI && Math.abs(vx) >= N.KIERUNKOWOSC * Math.hypot(vx, vy);
            }
            this._licznik[reka] = spelnia ? this._licznik[reka] + 1 : 0;
            if (this._licznik[reka] >= N.POTWIERDZENIE && this._przerwa[reka] <= 0) {
                zdarzenia.push({ reka, kierunek: this._os === 'gora' ? -1 : (vx > 0 ? 1 : -1), x, y });
                this._przerwa[reka] = N.PRZERWA_REKI_S;
                this._licznik[reka] = 0;
            }
        }
        this.diagnostyka = { predkosc: najszybciej, prog: this._prog() };
        return zdarzenia;
    }
}
