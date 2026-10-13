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
import { WodaShader, KOLUMN } from './wodaShader.js';
import { MANIFEST, losowyWariant, wypalTintowany } from './assety.js';

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
    MARGINES: 1.2,            // skala * to - koniec poza krawędzią
    MARGINES_START: 0.1,      // skala * to - start TUŻ za krawędzią: gejzer wybija przy niej, widać go
    // GEJZER (VFX v2, prośba właściciela): u czoła woda wystrzeliwuje słupem
    // z dołu kadru, potem słup opada i zostaje z niego grzbiet płynącej fali.
    GEJZER_NAROST: 0.22,      // s - słup od dołu do szczytu
    GEJZER_TRWA: 0.4,         // s - do tej chwili słup stoi w pełni
    GEJZER_OPADA_DO: 1.15,    // s - do tej chwili opada do GEJZER_RESZTA
    GEJZER_RESZTA: 0.22,      // ułamek - spieniony garb, który płynie dalej z falą
    GEJZER_NAD_BARKAMI: -1.15, // skala * to - szczyt słupa (nad głową)
    GEJZER_SZER_PRZOD: 0.3,   // skala * to - strona ruchu (stroma)
    GEJZER_SZER_TYL: 0.6,     // skala * to - strona źródła (łagodna, przechodzi w falę)
    KROPEL_GEJZERU_NA_S: 220,
    MGIELKI_NA_S: 16,
    ZYCIE_MGIELKI: 1.1,
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
    PROMIEN_KROPLI: 0.02,     // skala * to
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
    const m = sk * NASTAWY.MARGINES, ms = sk * NASTAWY.MARGINES_START;
    const u = gladko(wiek / NASTAWY.CZAS_PRZEJAZDU);
    const x0 = strona > 0 ? W + ms : -ms, x1 = strona > 0 ? -m : W + m;
    return x0 + (x1 - x0) * u;
}

/** Wysokość słupa gejzeru 0..1: wystrzał, chwila w pełni, opadanie do reszty. Czysta funkcja. */
export function wysokoscGejzeru(wiek) {
    const N = NASTAWY;
    if (!Number.isFinite(wiek) || wiek <= 0 || wiek >= N.ZYCIE_FALI) return 0;
    if (wiek < N.GEJZER_TRWA) return gladko(wiek / N.GEJZER_NAROST);
    const u = gladko((wiek - N.GEJZER_TRWA) / (N.GEJZER_OPADA_DO - N.GEJZER_TRWA));
    return 1 - (1 - N.GEJZER_RESZTA) * u;
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

/** Środek słupa gejzeru w px - NA grzbiecie fali, żeby słup wyrastał z niej, nie obok. Czysta funkcja. */
export function srodekGejzeru(fala, W, sk) {
    return czoloFali(fala.wiek, fala.strona, W, sk) + fala.strona * sk * NASTAWY.WZNIOS;
}

/**
 * Woda fali w kolumnie x: powierzchnia = wyżej z (profil fali, słup gejzeru).
 * Słup jest asymetryczny - stromy od strony ruchu, łagodnie przechodzi
 * w falę od strony źródła, więc wystrzał NIE odrywa się od flow.
 * @returns {{y, piana, gejzer}|null}  y px; piana i gejzer 0..1; null = fala nie żyje
 */
export function poziomWody(fala, x, zaczep, W, H) {
    const N = NASTAWY, sk = zaczep.skala;
    const h = wysokoscFali(fala.wiek);
    if (h <= 0) return null;
    const xc = czoloFali(fala.wiek, fala.strona, W, sk);
    const kier = -fala.strona;                       // kierunek ruchu
    const podstawa = H + 4;
    const yGrzbietu = Math.min(zaczep.y + sk * N.GRZBIET_NAD_BARKAMI, H * 0.75);
    const u = (xc - x) * kier / sk;
    const drobne = Math.sin(x / (sk * 0.7) + fala.faza + fala.wiek * 5) * sk * N.FALOWANIE * h;
    const yFali = podstawa - (podstawa - yGrzbietu) * h * profilFali(u) + drobne;
    const dx = (x - srodekGejzeru(fala, W, sk)) * kier / sk;   // > 0 = przed słupem
    const szer = dx > 0 ? N.GEJZER_SZER_PRZOD : N.GEJZER_SZER_TYL;
    const ksztalt = Math.exp(-(dx / szer) * (dx / szer));
    const g = wysokoscGejzeru(fala.wiek) * ksztalt;
    const ySlupa = Math.max(H * 0.04, zaczep.y + sk * N.GEJZER_NAD_BARKAMI);
    const yGejzeru = podstawa - (podstawa - ySlupa) * g;
    // Miękka suma (smooth min) zamiast twardego min - bez wcięcia na styku słupa i fali.
    const k = sk * 0.25;
    const m = Math.min(yFali, yGejzeru);
    const y = m - k * Math.log(Math.exp((m - yFali) / k) + Math.exp((m - yGejzeru) / k)) + k * Math.LN2 * Math.exp(-Math.abs(yFali - yGejzeru) / k);
    return {
        y,
        piana: Math.max(u >= N.WZNIOS * 0.85 ? profilFali(u) : 0, g),
        gejzer: g
    };
}

/**
 * Węzły powierzchni wody (od krawędzi źródłowej do czoła i trochę za nie) + szczyt.
 * @returns {{pkt: {x, y, grzbiet}[], szczyt: {x, y}, podstawa: number, kier, h}|null}
 */
export function powierzchnia(fala, zaczep, W, H) {
    const N = NASTAWY, sk = zaczep.skala;
    const h = wysokoscFali(fala.wiek);
    if (h <= 0) return null;
    const xc = czoloFali(fala.wiek, fala.strona, W, sk);
    const kier = -fala.strona;
    const xKonca = fala.strona > 0 ? W + sk * N.MARGINES : -sk * N.MARGINES;   // krawędź źródłowa
    const xDo = xc + kier * sk * N.GEJZER_SZER_PRZOD * 2;                       // stopa słupa przed czołem
    const pkt = [];
    let szczyt = null;
    for (let i = 0; i <= N.PUNKTOW; i++) {
        const x = xKonca + (xDo - xKonca) * (i / N.PUNKTOW);
        const w = poziomWody(fala, x, zaczep, W, H);
        pkt.push({ x, y: w.y, grzbiet: w.piana });
        if (!szczyt || w.y < szczyt.y) szczyt = { x, y: w.y };
    }
    return { pkt, szczyt, podstawa: H + 4, kier, h };
}

/**
 * Kolumny dla shadera: KOLUMN × [y 0..1, piana, alfa, gejzer]. Z kilku fal
 * w kolumnie wygrywa najwyższa woda (min y); alfa i gejzer - maksimum.
 * Czysta funkcja (poza zapisem do `wy`).
 */
export function kolumnyWody(fale, zaczep, W, H, sila = 1, wy = new Float32Array(KOLUMN * 4)) {
    for (let i = 0; i < KOLUMN; i++) {
        const x = (i / (KOLUMN - 1)) * W;
        let y = 1.02, piana = 0, alfa = 0, gejzer = 0;
        for (const f of fale) {
            const w = poziomWody(f, x, zaczep, W, H);
            if (!w || w.y >= H) continue;
            const yn = w.y / H;
            if (yn > 0.985) continue;            // woda przy samej krawędzi - bez paska na dole kadru
            if (yn < y) { y = yn; piana = w.piana; }
            alfa = Math.max(alfa, obwiedniaFali(f.wiek) * sila);
            gejzer = Math.max(gejzer, w.gejzer);
        }
        wy[i * 4] = y; wy[i * 4 + 1] = piana; wy[i * 4 + 2] = alfa; wy[i * 4 + 3] = gejzer;
    }
    return wy;
}

export class FalaMokoszy {
    constructor() {
        this._sila = 0;
        this._okno = false;
        this._tOkna = 0;
        this._wypuszczone = 0;
        this._fale = [];
        this._krople = [];
        this._mgielki = [];
        this._czas = 0;
        this._shader = new WodaShader();
        this._kolumny = new Float32Array(KOLUMN * 4);
        this._detektor = new DetektorMachniec({ os: 'gora' });
        this._kotwica = new Kotwica(10);
        this._warstwa = new WarstwaZaSylwetka();
        this._zaczep = null;
        this._W = 1920; this._H = 1080;
        this.faleSwieze = [];   // fale narodzone w tej klatce - pod przyszłe reakcje
    }

    get aktywny() { return this._okno || this._fale.length > 0 || this._krople.length > 0 || this._mgielki.length > 0; }
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
        this._czas += krok;

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
            // Grzbiet sypie kroplami; słup gejzeru tryska nimi w górę i łukiem
            // W STRONĘ RUCHU fali (flow), a jego szczyt dymi mgiełką.
            const ile = N.KROPEL_NA_S * krok * pow.h;
            for (let i = 0; i < Math.floor(ile) + (Math.random() < ile % 1 ? 1 : 0); i++) {
                this._kropla(pow.szczyt.x + pow.kier * sk * 0.3 * Math.random(), pow.szczyt.y,
                    pow.kier * sk * (1 + Math.random() * 2), -sk * Math.random() * 1.5);
            }
            const g = wysokoscGejzeru(f.wiek);
            const xg = srodekGejzeru(f, W, sk);
            const wg = poziomWody(f, xg, this._zaczep, W, H);
            if (wg && g > 0.3) {
                const ileG = N.KROPEL_GEJZERU_NA_S * krok * g;
                for (let i = 0; i < Math.floor(ileG) + (Math.random() < ileG % 1 ? 1 : 0); i++) {
                    this._kropla(xg + (Math.random() - 0.5) * sk * 0.35, wg.y + Math.random() * sk * 0.3,
                        pow.kier * sk * (0.3 + Math.random() * 1.8), -sk * (2.5 + Math.random() * 3.5) * g);
                }
                const ileM = N.MGIELKI_NA_S * krok * g;
                for (let i = 0; i < Math.floor(ileM) + (Math.random() < ileM % 1 ? 1 : 0); i++) {
                    this._mgielki.push({ x: xg + (Math.random() - 0.5) * sk * 0.4, y: wg.y,
                        vx: pow.kier * sk * (0.3 + Math.random() * 0.6), vy: -sk * (0.4 + Math.random() * 0.8),
                        r: sk * (0.25 + Math.random() * 0.25), kat: Math.random() * 6.28, wiek: 0 });
                }
            }
        }
        this._fale = this._fale.filter(f => f.wiek < N.ZYCIE_FALI);
        for (const q of this._krople) {
            q.wiek += krok;
            q.vy += N.GRAWITACJA * sk * krok;
            q.x += q.vx * krok; q.y += q.vy * krok;
        }
        this._krople = this._krople.filter(q => q.wiek < N.ZYCIE_KROPLI && q.y < H + sk);
        for (const m of this._mgielki) {
            m.wiek += krok;
            m.x += m.vx * krok; m.y += m.vy * krok;
            m.r += sk * 0.5 * krok;
        }
        this._mgielki = this._mgielki.filter(m => m.wiek < N.ZYCIE_MGIELKI);
        if (!ctx) return;

        if (this._fale.length && !this._shader.gotowa()) {
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
        // GPU (js/wodaShader.js): bryła, piana, refrakcja i słup gejzeru w
        // jednym shaderze. Bez WebGL2 - dawna woda Canvas2D poniżej.
        const N = NASTAWY;
        let gpu = false;
        if (this._fale.length && typeof c.canvas?.getContext === 'function') {
            kolumnyWody(this._fale, this._zaczep, this._W, this._H, this._sila * 0.95, this._kolumny);
            gpu = this._shader.rysuj(c, this._kolumny, {
                czas: this._czas, glebia: N.BARWA_GLEBI, grzbiet: N.BARWA_GRZBIETU, piana: N.BARWA_PIANY
            });
        }
        if (!gpu) this._rysujCanvas2D(c);
        this._rysujCzastki(c);
    }

    /** Mgiełka (smoke CC0, tint piany) i krople (miękki dysk CC0) - z fallbackiem na koła. */
    _rysujCzastki(c) {
        const N = NASTAWY, sk = this._zaczep.skala;
        c.save();
        c.globalCompositeOperation = 'source-over';
        const dym = losowyWariant(MANIFEST.mgla);
        for (const m of this._mgielki) {
            const a = 0.14 * this._sila * Math.sin(Math.PI * m.wiek / N.ZYCIE_MGIELKI);
            if (a < 0.005) continue;
            c.globalAlpha = clamp01(a);
            if (dym) {
                const spr = wypalTintowany(m.obraz ??= dym, N.BARWA_PIANY, 128);
                c.save(); c.translate(m.x, m.y); c.rotate(m.kat);
                c.drawImage(spr, -m.r, -m.r, m.r * 2, m.r * 2);
                c.restore();
            }
        }
        // Krople: pełne, wydłużone wzdłuż prędkości (smuga lotu) - nie puste kółka.
        c.fillStyle = `rgb(${N.BARWA_PIANY.join(',')})`;
        for (const q of this._krople) {
            c.globalAlpha = clamp01(0.6 * this._sila * (1 - q.wiek / N.ZYCIE_KROPLI) * (0.5 + q.r / N.PROMIEN_KROPLI * 0.35));
            const r = Math.max(0.8, q.r * sk);
            const v = Math.hypot(q.vx, q.vy);
            c.beginPath();
            c.ellipse(q.x, q.y, r * (1 + Math.min(2, v / (sk * 3))), r, Math.atan2(q.vy, q.vx), 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
    }

    _rysujCanvas2D(c) {
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

        c.restore();
    }
}
