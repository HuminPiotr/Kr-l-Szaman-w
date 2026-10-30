/**
 * Efekty stopni transu (spec 2026-10-30-trans-design.md). Dokładają się:
 *   stopień 1: świat przygasa (winieta oddychająca w takt, tancerz w świetle)
 *              + kręgi od stóp na każde uderzenie pieśni,
 *   stopień 2: echa sylwetki - co dwa uderzenia złoty odcisk aury odpływa i gaśnie,
 *   stopień 3: krąg przodków - dymne sylwetki po bokach tańczą taniec gracza
 *              z opóźnieniem jednego taktu (4 uderzeń).
 * Każdy efekt wchodzi i gaśnie płynnie z `trans.sila(stopien)` - bez przeskoków.
 * Subtelnie: właściciel odrzucił świetliste punkty po stawach jako nachalne.
 *
 * Dwie metody, bo warstwy: rysujPrzed() idzie POD aurą (winieta przyciemnia świat,
 * przodkowie stoją "za" graczem), rysujPo() NAD aurą (kręgi, echa - 'lighter').
 * Pozycje z frame.pose.landmarks (x·width, y·height - jak js/blaskTanca.js),
 * maska sylwetki ta sama co aury (TA SAMA transformacja `fit`).
 */

// ZGADNIĘTE - stroić na kamerze.
export const NASTAWY_EFEKTOW = {
    WINIETA_ALFA: 0.45, WINIETA_ODDECH: 0.15,
    KRAG_ZYCIE_S: 1.1, KRAG_ZASIEG_BW: 3.2, KRAG_SPLASZCZENIE: 0.22, KRAG_ALFA: 0.5,
    KRAG_BARWA: '255, 200, 120',
    ECHO_CO_UDERZEN: 2, ECHO_ZYCIE_S: 1.2, ECHO_ROZROST: 0.25, ECHO_ALFA: 0.35, ECHO_ROZMYCIE: 4,
    ECHO_BARWA: 'rgb(255, 196, 90)', MAX_ECH: 4,
    PRZODEK_OPOZNIENIE_UDERZEN: 4, PRZODEK_SKALA: 0.8, PRZODEK_ODSTEP_BW: 2.6, PRZODEK_ALFA: 0.3,
    PRZODEK_BARWA: 'rgb(150, 140, 175)', PRZODEK_ROZMYCIE: 3,
    HISTORIA_HZ: 12, HISTORIA_S: 3.0
};
const N = NASTAWY_EFEKTOW;

const ok = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= 0.5);

/** Środek barków, stóp i szerokość barków w pikselach płótna; null, gdy poza niepełna. */
export function geometriaCiala(frame) {
    const l = frame?.pose?.landmarks, W = frame?.width, H = frame?.height;
    if (!l || !(W > 0) || !(H > 0) || !ok(l[11]) || !ok(l[12])) return null;
    const bw = Math.hypot((l[11].x - l[12].x) * W, (l[11].y - l[12].y) * H);
    if (!(bw > 5)) return null;
    const barki = { x: (l[11].x + l[12].x) / 2 * W, y: (l[11].y + l[12].y) / 2 * H };
    const stopy = ok(l[27]) && ok(l[28])
        ? { x: (l[27].x + l[28].x) / 2 * W, y: Math.max(l[27].y, l[28].y) * H }
        : { x: barki.x, y: barki.y + 3.2 * bw };   // stopy poza kadrem - szacunek z barków
    return { bw, barki, stopy };
}

export class TransEfekty {
    /** @param {{plotno?: () => HTMLCanvasElement}} [opcje]  fabryka płócien - w testach atrapa */
    constructor({ plotno = () => document.createElement('canvas') } = {}) {
        this._plotno = plotno;
        this._kregi = [];          // {t, x, y, bw}
        this._echa = [];           // {t, c (płótno), sx, sy}
        this._historia = [];       // {t, c} - maski do przodków
        this._pula = [];           // wolne płótna masek
        this._ostatniIndeks = null;
        this._czas = 0;
        this._doZrzutu = 0;
        this._maska = null; this._maskaCtx = null; this._obraz = null;
        this._praca = null; this._pracaCtx = null;
    }

    _nowePlotno(w, h) {
        const c = this._pula.pop() ?? this._plotno();
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        return c;
    }

    /** Maska segmentacji -> płótno (alfa = sylwetka). Ten sam wzorzec co aura._wypelnijMaske. */
    _wczytajMaske(m) {
        if (!m?.dane || !(m.szer > 0) || !(m.wys > 0)) return false;
        if (!this._maska) {
            this._maska = this._plotno(); this._maskaCtx = this._maska.getContext('2d');
            this._praca = this._plotno(); this._pracaCtx = this._praca.getContext('2d');
        }
        if (this._maska.width !== m.szer || this._maska.height !== m.wys) {
            this._maska.width = this._praca.width = m.szer;
            this._maska.height = this._praca.height = m.wys;
            this._obraz = this._maskaCtx.createImageData(m.szer, m.wys);
        }
        const d = this._obraz.data, n = m.szer * m.wys;
        for (let i = 0; i < n; i++) { const j = i * 4; d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = m.dane[i]; }
        this._maskaCtx.putImageData(this._obraz, 0, 0);
        return true;
    }

    /** Kopia maski zabarwiona i rozmyta - echo albo przodek. */
    _barwnaKopia(barwa, rozmycie) {
        const c = this._nowePlotno(this._maska.width, this._maska.height);
        const g = c.getContext('2d');
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, c.width, c.height);
        g.filter = `blur(${rozmycie}px)`;
        g.drawImage(this._maska, 0, 0);
        g.filter = 'none';
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = barwa;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'source-over';
        return c;
    }

    /**
     * POD aurą: winieta i przodkowie. Tu też krok czasu, nowe uderzenia i zrzuty masek.
     * @param {{indeks:number, faza01:number, okresS:number}|null} takt  z SiatkaUderzen.faza(); null = bez pieśni
     * @param {{dane:Uint8Array|null, szer:number, wys:number}} maska
     */
    rysujPrzed(ctx, frame, trans, takt, maska, fit, dt) {
        const krok = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
        this._czas += krok;
        for (const k of this._kregi) k.t += krok;
        for (const e of this._echa) e.t += krok;
        this._kregi = this._kregi.filter(k => k.t < N.KRAG_ZYCIE_S);
        this._echa = this._echa.filter(e => { if (e.t < N.ECHO_ZYCIE_S) return true; this._pula.push(e.c); return false; });

        const s1 = trans?.sila?.(1) ?? 0, s2 = trans?.sila?.(2) ?? 0, s3 = trans?.sila?.(3) ?? 0;
        const geo = geometriaCiala(frame);
        const maskaJest = (s2 > 0 || s3 > 0) && geo ? this._wczytajMaske(maska) : false;

        // Nowe uderzenie: krąg od stóp (stopień 1), co ECHO_CO_UDERZEN echo (stopień 2).
        const nowe = takt && Number.isFinite(takt.indeks) && takt.indeks !== this._ostatniIndeks;
        if (takt && Number.isFinite(takt.indeks)) this._ostatniIndeks = takt.indeks;
        if (nowe && geo) {
            if (s1 > 0.02) this._kregi.push({ t: 0, x: geo.stopy.x, y: geo.stopy.y, bw: geo.bw });
            if (s2 > 0.02 && maskaJest && takt.indeks % N.ECHO_CO_UDERZEN === 0 && this._echa.length < N.MAX_ECH) {
                this._echa.push({ t: 0, c: this._barwnaKopia(N.ECHO_BARWA, N.ECHO_ROZMYCIE), sx: geo.barki.x, sy: geo.barki.y + geo.bw, bw: geo.bw });
            }
        }

        // Historia masek do przodków - zbierana już od stopnia 2, żeby przodek miał takt wstecz od razu.
        this._doZrzutu -= krok;
        if (maskaJest && (s2 > 0.5 || s3 > 0) && this._doZrzutu <= 0) {
            this._doZrzutu = 1 / N.HISTORIA_HZ;
            this._historia.push({ t: this._czas, c: this._barwnaKopia(N.PRZODEK_BARWA, N.PRZODEK_ROZMYCIE) });
        }
        while (this._historia.length && this._czas - this._historia[0].t > N.HISTORIA_S) this._pula.push(this._historia.shift().c);
        if (!(s2 > 0) && this._historia.length) { for (const h of this._historia) this._pula.push(h.c); this._historia.length = 0; }

        if (!ctx) return;
        const W = frame?.width, H = frame?.height;

        // Winieta: świat przygasa, tancerz zostaje w świetle. Oddycha w takt pieśni.
        if (s1 > 0.01 && W > 0 && H > 0) {
            const c = geo?.barki ?? { x: W / 2, y: H / 2 };
            const oddech = takt ? Math.cos(2 * Math.PI * takt.faza01) * 0.5 + 0.5 : 0.5;
            const alfa = N.WINIETA_ALFA * s1 * (1 - N.WINIETA_ODDECH + N.WINIETA_ODDECH * oddech);
            const r0 = (geo ? geo.bw * 2.2 : Math.min(W, H) * 0.25), r1 = Math.hypot(W, H) * 0.7;
            const g = ctx.createRadialGradient(c.x, c.y, r0, c.x, c.y, r1);
            g.addColorStop(0, 'rgba(0, 0, 0, 0)');
            g.addColorStop(1, `rgba(0, 0, 0, ${alfa.toFixed(3)})`);
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        // Przodkowie: maska sprzed jednego taktu, dwie dymne sylwetki po bokach, dalej w głąb.
        if (s3 > 0.01 && geo && fit && this._historia.length && takt?.okresS > 0) {
            const cel = this._czas - N.PRZODEK_OPOZNIENIE_UDERZEN * takt.okresS;
            let h = this._historia[0];
            for (const x of this._historia) if (Math.abs(x.t - cel) < Math.abs(h.t - cel)) h = x;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const strona of [-1, 1]) {
                const migot = 0.85 + 0.15 * Math.sin(this._czas * 2.3 + strona);
                ctx.globalAlpha = Math.max(0, Math.min(1, N.PRZODEK_ALFA * s3 * migot));
                ctx.save();
                ctx.translate(geo.stopy.x + strona * N.PRZODEK_ODSTEP_BW * geo.bw, geo.stopy.y - 0.3 * geo.bw);
                ctx.scale(N.PRZODEK_SKALA, N.PRZODEK_SKALA);
                ctx.translate(-geo.stopy.x, -geo.stopy.y);
                ctx.drawImage(h.c, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
                ctx.restore();
            }
            ctx.restore();
        }
    }

    /** NAD aurą: kręgi od stóp i echa sylwetki. */
    rysujPo(ctx, frame, trans, fit) {
        if (!ctx) return;
        const s1 = trans?.sila?.(1) ?? 0, s2 = trans?.sila?.(2) ?? 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (s1 > 0.01) {
            for (const k of this._kregi) {
                const u = k.t / N.KRAG_ZYCIE_S;
                const rx = k.bw * (0.5 + N.KRAG_ZASIEG_BW * u);
                ctx.strokeStyle = `rgba(${N.KRAG_BARWA}, ${(N.KRAG_ALFA * s1 * (1 - u) ** 1.3).toFixed(3)})`;
                ctx.lineWidth = Math.max(1, k.bw * 0.06 * (1 - u));
                ctx.beginPath();
                ctx.ellipse(k.x, k.y, rx, rx * N.KRAG_SPLASZCZENIE, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        if (s2 > 0.01 && fit) {
            for (const e of this._echa) {
                const u = e.t / N.ECHO_ZYCIE_S;
                const sk = 1 + N.ECHO_ROZROST * u;
                ctx.globalAlpha = Math.max(0, Math.min(1, N.ECHO_ALFA * s2 * (1 - u) ** 1.5));
                ctx.save();
                ctx.translate(e.sx, e.sy - 0.4 * e.bw * u);
                ctx.scale(sk, sk);
                ctx.translate(-e.sx, -e.sy);
                ctx.drawImage(e.c, fit.offsetX, fit.offsetY, fit.scaledW, fit.scaledH);
                ctx.restore();
            }
        }
        ctx.restore();
    }
}
