/**
 * Fala Mokoszy - nagroda za combo mokosz -> stribog -> mokosz (2026-10-13,
 * spec docs/superpowers/specs/2026-10-13-fala-i-kruki-design.md).
 * Woda, wiatr ją podnosi, woda wraca: z boku kadru wzbiera fala,
 * zawija się i przetacza przez tancerza.
 *
 * STEROWANIE (wzorzec Zawieruchy): zapal() otwiera OKNO_S. Pierwsze
 * GLUCHE_S jest głuche - wyjście z pieczęci wody samo rusza rękami. Potem
 * każdy zamach ręką OD DOŁU DO GÓRY (js/machniecie.js, oś 'gora') przywołuje
 * JEDNĄ falę z TEJ SAMEJ strony ekranu, po której jest ręka (decyzja
 * właściciela; strona z położenia nadgarstka, nie z etykiety ręki - odporne
 * na lustro obrazu). Najwyżej MAX_FAL - okno jest krótkie celowo: cztery
 * fale zdąży przywołać tylko szybki gracz machający na zmianę. Nikt nie
 * machnął -> po oknie jedna samoczynna fala, strona na zmianę (GEMINI.md §2).
 *
 * MATERIA, NIE ENERGIA (lekcja z Kurzawy v2.1): woda source-over, nic nie
 * świeci. POWIERZCHNIA = KRESKA (pamięć projektu "efekt ciągły = kreska,
 * nie sprite"): profil wody to czysta funkcja czasu (powierzchnia), bryła
 * to wielokąt pod nią z gradientem, piana to kreska po grzbiecie. Zaczep:
 * BARKI (fala sięga do piersi), nie dłonie. Smuga piany za grzbietem idzie
 * na warstwę ZA sylwetką - woda opływa gracza, a nie tylko go zasłania.
 *
 * Bez reakcji z polami (decyzja właściciela 2026-10-13: najpierw test na kamerze).
 */
import { barkiKlatki, Kotwica } from './sledzenie.js';
import { WarstwaZaSylwetka } from './warstwaZaSylwetka.js';
import { DetektorMachniec } from './machniecie.js';

// ZGADNIĘTE - strojenie na nakładce D (pole falaMokoszy) i w tools/scena.html.
export const NASTAWY = {
    OKNO_S: 1.8,               // krótkie celowo - 4 fale tylko na zmianę obiema rękami
    GLUCHE_S: 0.25,
    MAX_FAL: 4,
    CZAS_PRZEJAZDU: 1.3,      // s - czoło fali przez całe W (ease-in-out)
    ZYCIE_FALI: 1.9,          // s
    NAROST: 0.3,              // s - fala wzbiera przy krawędzi
    LAMANIE_OD: 0.55,         // ułamek przejazdu - od tego miejsca grzbiet opada (fala się łamie)
    WYGASZENIE: 0.45,         // s na końcu życia
    GRZBIET_NAD_BARKAMI: -0.3, // skala * to - szczyt fali względem linii barków (minus = nad)
    MARGINES: 1.2,            // skala * to - start/koniec poza krawędzią
    WZNIOS: 0.8,              // skala * to - od czoła do szczytu (wklęsła ściana fali)
    OGON: 1.4,                // skala * to - zanik wody za grzbietem
    POZIOM_ZA: 0.22,          // ułamek wysokości - woda, która zostaje za grzbietem (falowanie, nie rampa)
    ZAWINIECIE: 0.8,          // skala * to - długość wysuniętej wargi grzbietu
    PUNKTOW: 48,              // węzły powierzchni
    FALOWANIE: 0.05,          // skala * to - drobne fale na powierzchni
    ALFA: 0.62,
    PIANA_SZER: 0.07,         // skala * to
    KROPEL_ROZBICIA: 40,      // rozprysk, gdy czoło mija tancerza
    KROPEL_NA_S: 40,          // z wargi grzbietu
    ZYCIE_KROPLI: 0.9,
    GRAWITACJA: 4.0,          // skala / s^2
    PROMIEN_KROPLI: 0.035,    // skala * to
    BARWA_GLEBI: [20, 70, 120],
    BARWA_GRZBIETU: [70, 165, 200],
    BARWA_PIANY: [225, 240, 245]
};

const clamp01 = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const gladko = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

// Strona ostatniej fali - samoczynna przychodzi z przeciwnej (jak poryw Zawieruchy).
let ostatniaStrona = 1;

/**
 * Pozycja x czoła fali w chwili `wiek`. `strona` = krawędź, z której fala
 * przychodzi (+1 prawa, -1 lewa); płynie w stronę przeciwną. Czysta funkcja.
 */
export function czoloFali(wiek, strona, W, sk) {
    const m = sk * NASTAWY.MARGINES;
    const u = gladko(wiek / NASTAWY.CZAS_PRZEJAZDU);
    return strona > 0 ? W + m - (W + 2 * m) * u : -m + (W + 2 * m) * u;
}

/** Wysokość fali 0..1 (wzbieranie, łamanie po LAMANIE_OD przejazdu). Czysta funkcja. */
export function wysokoscFali(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek <= 0 || wiek >= N.ZYCIE_FALI) return 0;
    const narost = gladko(wiek / N.NAROST);
    const przejazd = wiek / N.CZAS_PRZEJAZDU;
    const lamanie = 1 - 0.65 * gladko((przejazd - N.LAMANIE_OD) / (1 - N.LAMANIE_OD));
    return narost * lamanie;
}

/** Alfa fali 0..1 - wygaszenie na końcu życia. Czysta funkcja. */
export function obwiedniaFali(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek <= 0 || wiek >= N.ZYCIE_FALI) return 0;
    return Math.min(1, wiek / 0.08) * Math.min(1, (N.ZYCIE_FALI - wiek) / N.WYGASZENIE);
}

/**
 * Profil wody 0..1 w odległości `u` (w skalach) ZA czołem: stromy wznios,
 * potem długi zanik. Przed czołem (u < 0) - nic. Czysta funkcja.
 */
export function profilFali(u) {
    const N = NASTAWY;
    if (!Number.isFinite(u) || u < 0) return 0;
    // Ściana wklęsła (u^2.2): stroma pod wargą, łagodna u podstawy.
    if (u < N.WZNIOS) return Math.pow(u / N.WZNIOS, 2.2);
    return N.POZIOM_ZA + (1 - N.POZIOM_ZA) * Math.exp(-(u - N.WZNIOS) / N.OGON);
}

/**
 * Węzły powierzchni wody (od krawędzi źródłowej do czoła) + szczyt.
 * @returns {{pkt: {x, y}[], szczyt: {x, y}, podstawa: number}|null}
 */
export function powierzchnia(fala, zaczep, W, H) {
    const N = NASTAWY, sk = zaczep.skala;
    const h = wysokoscFali(fala.wiek);
    if (h <= 0) return null;
    const xc = czoloFali(fala.wiek, fala.strona, W, sk);
    const kier = -fala.strona;                       // kierunek ruchu
    const podstawa = H + 4;
    const yGrzbietu = Math.min(zaczep.y + sk * N.GRZBIET_NAD_BARKAMI, H * 0.75);
    const amp = (podstawa - yGrzbietu) * h;
    const xKonca = fala.strona > 0 ? W + sk * N.MARGINES : -sk * N.MARGINES;   // krawędź źródłowa
    const pkt = [];
    for (let i = 0; i <= N.PUNKTOW; i++) {
        const x = xKonca + (xc - xKonca) * (i / N.PUNKTOW);
        const u = (xc - x) * kier / sk;
        const drobne = Math.sin(x / (sk * 0.7) + fala.faza + fala.wiek * 5) * sk * N.FALOWANIE * h;
        pkt.push({ x, y: podstawa - amp * profilFali(u) + drobne, grzbiet: u >= N.WZNIOS * 0.85 ? profilFali(u) : 0 });
    }
    const xSzczytu = xc - kier * sk * N.WZNIOS;
    return { pkt, szczyt: { x: xSzczytu, y: podstawa - amp }, podstawa, kier, h };
}

export class FalaMokoszy {
    constructor() {
        this._sila = 0;
        this._okno = false;
        this._tOkna = 0;
        this._wypuszczone = 0;
        this._fale = [];
        this._krople = [];
        this._detektor = new DetektorMachniec({ os: 'gora' });
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._zaczep = null;
        this._W = 1920; this._H = 1080;
        this.faleSwieze = [];   // fale narodzone w tej klatce - pod przyszłe reakcje
    }

    get aktywny() { return this._okno || this._fale.length > 0 || this._krople.length > 0; }
    get okno() { return this._okno; }
    get diagnostyka() { return { okno: this._okno, fale: this._fale.length, wypuszczone: this._wypuszczone, ...this._detektor.diagnostyka }; }

    wyczyscCache() {}

    zapal(sila = 1) {
        const s = clamp01(sila);
        if (s <= 0.01) return;
        this._sila = s;
        this._okno = true;
        this._tOkna = 0;
        this._wypuszczone = 0;
        this._detektor = new DetektorMachniec({ os: 'gora' });   // bufory od zera - bez ruchu sprzed combo
    }

    _wypusc(strona) {
        const fala = { strona, wiek: 0, faza: Math.random() * Math.PI * 2, rozbita: false };
        this._fale.push(fala);
        this.faleSwieze.push(fala);
        this._wypuszczone++;
        ostatniaStrona = strona;
    }

    _kropla(x, y, vx, vy) {
        const N = NASTAWY;
        this._krople.push({ x, y, vx, vy, wiek: 0, r: (0.5 + Math.random()) * N.PROMIEN_KROPLI });
    }

    updateAndDraw(ctx, k, dt) {
        this.faleSwieze = [];
        if (!this.aktywny) return;
        const N = NASTAWY;
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        const W = k?.W ?? 1920, H = k?.H ?? 1080;
        this._W = W; this._H = H;
        this._zaczep = this._kotwica.prowadz(barkiKlatki(k?.frame, W, H), krok)
            ?? { x: W * 0.5, y: H * 0.4, skala: W * 0.12 };
        const sk = this._zaczep.skala;

        if (this._okno) {
            this._tOkna += krok;
            const zdarzenia = this._detektor.update(k?.frame, W, H, krok);
            if (this._tOkna >= N.GLUCHE_S) {
                for (const z of zdarzenia) {
                    if (this._wypuszczone >= N.MAX_FAL) break;
                    this._wypusc(z.x >= this._zaczep.x ? 1 : -1);
                }
            }
            if (this._tOkna >= N.OKNO_S) {
                this._okno = false;
                if (this._wypuszczone === 0) this._wypusc(-ostatniaStrona);
            }
        }

        for (const f of this._fale) {
            const przed = czoloFali(f.wiek, f.strona, W, sk);
            f.wiek += krok;
            const po = czoloFali(f.wiek, f.strona, W, sk);
            const pow = powierzchnia(f, this._zaczep, W, H);
            if (!pow) continue;
            // Rozbicie o tancerza: czoło właśnie minęło środek barków.
            if (!f.rozbita && (przed - this._zaczep.x) * (po - this._zaczep.x) <= 0) {
                f.rozbita = true;
                for (let i = 0; i < N.KROPEL_ROZBICIA; i++) {
                    const kat = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
                    const v = sk * (2 + Math.random() * 3);
                    this._kropla(this._zaczep.x + (Math.random() - 0.5) * sk, pow.szczyt.y + Math.random() * sk * 0.6,
                        Math.cos(kat) * v + pow.kier * sk * 1.5, Math.sin(kat) * v);
                }
            }
            // Warga grzbietu sypie kroplami.
            const ile = N.KROPEL_NA_S * krok * pow.h;
            for (let i = 0; i < Math.floor(ile) + (Math.random() < ile % 1 ? 1 : 0); i++) {
                this._kropla(pow.szczyt.x + pow.kier * sk * N.ZAWINIECIE * Math.random(), pow.szczyt.y,
                    pow.kier * sk * (1 + Math.random() * 2), -sk * Math.random() * 1.5);
            }
        }
        this._fale = this._fale.filter(f => f.wiek < N.ZYCIE_FALI);
        for (const q of this._krople) {
            q.wiek += krok;
            q.vy += N.GRAWITACJA * sk * krok;
            q.x += q.vx * krok; q.y += q.vy * krok;
        }
        this._krople = this._krople.filter(q => q.wiek < N.ZYCIE_KROPLI && q.y < H + sk);
        if (!ctx) return;

        if (this._fale.length) {
            const tyl = this._warstwa.zacznij(W, H);
            if (tyl) {
                this._rysujPianeZa(tyl);
                this._warstwa.zakoncz(ctx, k.maska, k.maskaSzer, k.maskaWys, k.fit);
            }
        }
        this._rysuj(ctx);
    }

    /** Smuga piany nad wodą ZA grzbietem - przechodzi za tancerzem. */
    _rysujPianeZa(c) {
        const N = NASTAWY, sk = this._zaczep.skala;
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.lineCap = 'round';
        c.strokeStyle = `rgb(${N.BARWA_PIANY.join(',')})`;
        for (const f of this._fale) {
            const pow = powierzchnia(f, this._zaczep, this._W, this._H);
            if (!pow) continue;
            const alfa = obwiedniaFali(f.wiek) * this._sila;
            c.lineWidth = Math.max(1, sk * N.PIANA_SZER * 0.6);
            for (let i = 1; i < pow.pkt.length; i++) {
                const a = pow.pkt[i - 1], b = pow.pkt[i];
                c.globalAlpha = clamp01(alfa * 0.3 * b.grzbiet * b.grzbiet);
                c.beginPath();
                c.moveTo(a.x, a.y - sk * 0.1);
                c.lineTo(b.x, b.y - sk * 0.1);
                c.stroke();
            }
        }
        c.restore();
    }

    _rysuj(c) {
        const N = NASTAWY, sk = this._zaczep.skala;
        c.save();
        c.globalCompositeOperation = 'source-over';
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const f of this._fale) {
            const pow = powierzchnia(f, this._zaczep, this._W, this._H);
            if (!pow) continue;
            const alfa = obwiedniaFali(f.wiek) * this._sila;
            if (alfa < 0.005) continue;
            const { pkt, szczyt, podstawa, kier, h } = pow;

            // Bryła wody: wielokąt pod powierzchnią, gradient grzbiet -> głębia.
            const g = c.createLinearGradient(0, szczyt.y, 0, podstawa);
            g.addColorStop(0, `rgb(${N.BARWA_GRZBIETU.join(',')})`);
            g.addColorStop(1, `rgb(${N.BARWA_GLEBI.join(',')})`);
            c.fillStyle = g;
            c.globalAlpha = clamp01(alfa * N.ALFA);
            c.beginPath();
            c.moveTo(pkt[0].x, podstawa);
            for (const p of pkt) c.lineTo(p.x, p.y);
            c.lineTo(pkt[pkt.length - 1].x, podstawa);
            c.closePath();
            c.fill();

            // Warga: grzbiet wysuwa się przed czoło i zawija w dół.
            const dl = sk * N.ZAWINIECIE * h;
            const czubek = { x: szczyt.x + kier * dl, y: szczyt.y + dl * 0.55 };
            c.beginPath();
            c.moveTo(szczyt.x - kier * sk * 0.25, szczyt.y + sk * 0.05);
            c.quadraticCurveTo(szczyt.x + kier * dl * 0.7, szczyt.y - dl * 0.35, czubek.x, czubek.y);
            c.quadraticCurveTo(szczyt.x + kier * dl * 0.3, szczyt.y + dl * 0.2, szczyt.x, szczyt.y + dl * 0.6);
            c.closePath();
            c.fill();

            // Piana: kreska po GRZBIECIE (nie po ścianie czoła), gruba przy
            // szczycie, cienka w ogonie - waga = wysokość wody za grzbietem.
            c.strokeStyle = `rgb(${N.BARWA_PIANY.join(',')})`;
            const n = pkt.length;
            for (let i = 1; i < n; i++) {
                const w = Math.pow(pkt[i].grzbiet, 3);
                if (w < 0.02) continue;
                c.globalAlpha = clamp01(alfa * 0.85 * w);
                c.lineWidth = Math.max(1, sk * N.PIANA_SZER * (0.2 + 0.8 * w));
                c.beginPath();
                c.moveTo(pkt[i - 1].x, pkt[i - 1].y);
                c.lineTo(pkt[i].x, pkt[i].y);
                c.stroke();
            }
            c.globalAlpha = clamp01(alfa * 0.9);
            c.lineWidth = Math.max(1, sk * N.PIANA_SZER);
            c.beginPath();
            c.moveTo(szczyt.x - kier * sk * 0.25, szczyt.y + sk * 0.05);
            c.quadraticCurveTo(szczyt.x + kier * dl * 0.7, szczyt.y - dl * 0.35, czubek.x, czubek.y);
            c.stroke();
        }

        // Krople: drobne, jasne, source-over.
        c.fillStyle = `rgb(${N.BARWA_PIANY.join(',')})`;
        for (const q of this._krople) {
            c.globalAlpha = clamp01(0.8 * this._sila * (1 - q.wiek / N.ZYCIE_KROPLI));
            c.beginPath();
            c.arc(q.x, q.y, Math.max(1, q.r * sk), 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
    }
}
