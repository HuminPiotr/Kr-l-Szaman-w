/**
 * Nakładka diagnostyczna. Przełącznik: klawisz D.
 *
 * Nie ma tu testów jednostkowych do napisania - wejściem jest strumień z kamery,
 * a wyjściem wrażenie wzrokowe. Ta nakładka JEST narzędziem weryfikacji.
 * Bez niej "działa" znaczy tylko "nie wyrzuciło wyjątku".
 *
 * Cały DOM i style tworzy sama, żeby dało się ją usunąć jednym importem mniej.
 */

const PANEL_ID = 'debug-hud';
const UPDATE_HZ = 10; // DOM aktualizowany 10x/s, nie 60x/s - zapis do DOM w pętli klatek to marnotrawstwo

export class DebugHud {
    constructor() {
        this.visible = false;
        this.frameTimes = [];   // znaczniki czasu ostatnich klatek (okno 1s)
        this.lastPanelUpdate = 0;
        this.panel = this._createPanel();

        // Podtrzymanie min/max prędkości. Surowa wartość skacze za bardzo,
        // żeby dało się ją odczytać z ekranu - a to właśnie te liczby są
        // potrzebne do strojenia. Reset klawiszem R.
        this.vMin = Infinity;
        this.vMax = 0;

        window.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') this.toggle();
            if (e.key === 'r' || e.key === 'R') this.resetujZakres();
        });
    }

    resetujZakres() {
        this.vMin = Infinity;
        this.vMax = 0;
    }

    _createPanel() {
        const el = document.createElement('div');
        el.id = PANEL_ID;
        el.style.cssText = `
            position: fixed; top: 12px; left: 12px; z-index: 999;
            font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
            color: #b8f5e4; background: rgba(5, 5, 16, 0.82);
            border: 1px solid rgba(0, 255, 204, 0.25); border-radius: 8px;
            padding: 10px 14px; white-space: pre; pointer-events: none;
            display: none; backdrop-filter: blur(4px);
        `;
        document.body.appendChild(el);
        return el;
    }

    toggle() {
        this.visible = !this.visible;
        this.panel.style.display = this.visible ? 'block' : 'none';
    }

    /** Wywoływane raz na klatkę, ZAWSZE - licznik FPS musi zbierać dane także gdy panel jest schowany. */
    tick(now) {
        this.frameTimes.push(now);
        while (this.frameTimes.length && now - this.frameTimes[0] > 1000) {
            this.frameTimes.shift();
        }
    }

    get fps() {
        if (this.frameTimes.length < 2) return 0;
        const span = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
        if (span <= 0) return 0;
        return (this.frameTimes.length - 1) * 1000 / span;
    }

    /**
     * @param {object} frame  kontrakt klatki (hands, pose, dt, ...)
     * @param {object} stats  { ruch, moc, znaki: {id: wynik}, stan }
     */
    updatePanel(frame, stats = {}) {
        // Min/max zbieramy CO KLATKĘ, przed odcięciem przez próg odświeżania -
        // panel rysuje się 10x/s, więc inaczej gubiłby szczyty.
        if (Number.isFinite(stats.predkosc) && frame.pose) {
            if (stats.predkosc < this.vMin) this.vMin = stats.predkosc;
            if (stats.predkosc > this.vMax) this.vMax = stats.predkosc;
        }

        if (!this.visible) return;

        const now = performance.now();
        if (now - this.lastPanelUpdate < 1000 / UPDATE_HZ) return;
        this.lastPanelUpdate = now;

        const fps = this.fps;
        const hands = frame.hands || [];
        const pose = frame.pose;

        // Skąd wiadomo, że handednesses i worldLandmarks faktycznie docierają,
        // a nie są po cichu gubione po drodze (jak przed refaktorem).
        const rece = hands.length
            ? hands.map(h => `${h.handedness ?? '?'}${h.worldLandmarks ? '+w' : '-w'}`).join(' ')
            : '—';

        const lines = [];
        // Błąd w pętli jest GŁOŚNY. Wcześniej wyjątek zabijał całą pętlę
        // w ciszy i wyglądało to jak zwis aplikacji.
        if (stats.bledyPetli) {
            lines.push(`⚠ BŁĄD PĘTLI x${stats.bledyPetli}: ${stats.ostatniBladPetli}`);
            lines.push('');
        }
        lines.push(
            `FPS   ${fps.toFixed(1).padStart(5)}   ${this._bar(fps / 60)}${fps < 24 ? '  ⚠ PONIŻEJ 24' : ''}`,
            `pose  ${pose ? 'TAK' : 'NIE '}${pose?.worldLandmarks ? ' +world' : ' -world'}    dłonie ${hands.length}`,
            `ręce  ${rece}`,
            ''
        );

        // Prędkość wygładzona jest tym, co naprawdę steruje grą - surowa tylko
        // podglądowo. Min/max podtrzymane, bo z chwilowej wartości nic się nie
        // odczyta. Zatańcz, przeczytaj zakres, zresetuj klawiszem R.
        if (stats.predkosc !== undefined) {
            lines.push(`v     ${this._num(stats.predkosc)} m/s zmierzone (surowa ${this._num(stats.predkoscSurowa)})`);
            // Po odjęciu podłogi szumu. TA wartość steruje grą - jeśli przy
            // nieruchomym staniu nie schodzi do 0.00, podłoga jest za niska.
            lines.push(`      ${this._num(stats.predkoscEfektywna)} m/s efektywne  <- to steruje grą`);
            const min = this.vMin === Infinity ? 0 : this.vMin;
            lines.push(`      zakres zmierzonej ${this._num(min)} – ${this._num(this.vMax)}   [R = reset]`);
        }
        // Rozbicie na kończyny: gdy przy bezruchu któraś wystaje ponad resztę,
        // to ona generuje szum (typowo kostki - stopy poza kadrem albo zasłonięte).
        if (stats.szumPunktow && Object.keys(stats.szumPunktow).length) {
            const czesci = Object.entries(stats.szumPunktow)
                .map(([k, v]) => `${k} ${this._num(v)}`).join('  ');
            lines.push(`      ${czesci}`);
        }
        if (stats.ruch !== undefined) lines.push(`ruch  ${this._num(stats.ruch)}   ${this._bar(stats.ruch)}`);

        // Płynność i jej surowe źródło. PROG_SZARPNIECIA w js/plynnosc.js
        // jest wyprowadzony z sygnałów syntetycznych i wymaga potwierdzenia
        // na żywym ciele - dlatego SKALA ODNIESIENIA jest wypisana obok
        // wartości. Sama liczba "9.2" nic nikomu nie mówi.
        if (stats.plynnosc !== undefined) {
            lines.push(`płyn. ${this._num(stats.plynnosc)}   ${this._bar(stats.plynnosc)}`);
            lines.push(`      szarpnięcie ${this._num(stats.szarpniecie)} /s     stawów ${stats.aktywnychStawow ?? 0}/6`);
            lines.push(`      skala: okrąg 1.5 · gładko 7 · szarpanie 56`);
            // Miara jest DRUGĄ pochodną pozycji, więc skaluje się jak 1/dt.
            // Przy załamaniu klatkażu nie szumi - po cichu maleje kilkadziesiąt
            // razy i udaje "bardzo płynny ruch". Dlatego to ostrzeżenie.
            if (stats.zaWolno) {
                lines.push(`      ⚠ KLATKAŻ ZA NISKI - pomiar wstrzymany`);
            } else if (stats.dt) {
                lines.push(`      okno ${stats.oknoKlatek} kl. = ${(stats.oknoKlatek * stats.dt * 1000).toFixed(0)} ms`);
            }
            lines.push(`      tempo ładowania x${this._num(stats.wspPlynnosci)}`);
        }

        if (stats.moc !== undefined)  lines.push(`moc   ${this._num(stats.moc)}   ${this._bar(stats.moc)}`);
        // Wyniki postaw i stan pierścienia. Progi w pieczecie.js są ZGADNIĘTE
        // i stroi się je właśnie stąd - liczba "0.62" przy konkretnej pozycji
        // ciała jest jedynym sposobem, żeby ustawić PROG_POSTAWY sensownie.
        if (stats.postawy) {
            const p = Object.entries(stats.postawy)
                .map(([k, v]) => `${k.slice(0, 3)} ${this._num(v)}`).join('  ');
            lines.push(`znak  ${p}`);
            const cel = stats.skladana ?? '—';
            lines.push(`pieczęć ${cel}  ${this._num(stats.postep ?? 0)}  ${this._bar(stats.postep ?? 0)}${stats.brakMocy ? '  ⏳ brak mocy' : ''}`);
            lines.push(`kombo ${stats.bufor ?? '—'}`);

            // KTÓRY warunek blokuje. Wynik pieczęci to minimum tych wartości,
            // więc najniższa liczba w tej linijce mówi, co poprawić.
            // Bez tego zostaje zgadywanie ułożenia palców.
            if (stats.rozbicie) {
                const s = stats.rozbicie.sk;
                const naj = Math.min(...Object.values(s));
                const opis = Object.entries(s)
                    .map(([k, v]) => `${k} ${this._num(v)}${v === naj ? '<' : ' '}`).join(' ');
                lines.push(`  ${stats.rozbicie.id}: ${opis}`);
            }
        }

        // Sylwetka dłoni. Wzór palców w kolejności kciuk-wskazujący-środkowy-
        // serdeczny-mały: 1 = wyprostowany, ~ = w połowie, 0 = złożony.
        // Z tych liczb stroi się progi pieczęci.
        if (stats.dlonie) {
            lines.push('');
            lines.push('dłonie  (KWŚSM)');
            for (const l of stats.dlonie) lines.push(`  ${l}`);
        }

        // Stan techniki kanałowanej i liczba cząsteczek - ta druga pilnuje
        // klatkażu, bo ogień jest pierwszą rzeczą w tej grze, która może go zjeść.
        if (stats.ogien) {
            // Dwa RÓŻNE sygnały: "wskazanie" decyduje o ZAPŁONIE (dokładnie
            // jeden palec), "utrzym." o tym, czy ogień PŁONIE DALEJ (sam palec
            // nadal wyprostowany). Rozdzielenie ich było naprawą tego, że
            // płomień gasł za łatwo - iloczyn w ocenie zapłonu jest bezlitosny.
            lines.push(`ogień ${stats.ogien.stan}  cząstek ${stats.ogien.czastki}`);
            lines.push(`      zapłon ${this._num(stats.ogien.wskazanie)} (prog 0.40)` +
                       `   utrzym. ${this._num(stats.ogien.utrzymanie)} (prog 0.30)` +
                       `${stats.ogien.barkiNiepewne ? '   ⚠ barki niepewne' : ''}`);
            // Zwłoka pokazuje, że technika PRZECZEKUJE przeskok trackingu,
            // zamiast się kończyć. Bez tego nie widać, że osłona działa.
            if (stats.ogien.powodZwloki) {
                lines.push(`      przeczekuje: ${stats.ogien.powodZwloki} ${stats.ogien.zwloka.toFixed(2)} s`);
            }
        }

        // Stan Podmuchu i jego fali. `diagnostyka` to NAJLEPSZY kandydat
        // w tej klatce, nawet gdy nic się nie odpaliło - bez tego nie da
        // się wystroić PROG_PREDKOSCI/PROG_OTWARCIA (patrz podmuch.js).
        if (stats.podmuch) {
            const d = stats.podmuch.diagnostyka;
            lines.push(`podmuch ${stats.podmuch.stan}  cząstek fali ${stats.podmuch.czastkiFali}`);
            lines.push(`      prędkość ${this._num(d.predkosc)} sk/s (prog ${this._num(stats.podmuch.progPredkosci)})` +
                       `   otwarcie ${this._num(d.otwarcie)} (prog ${this._num(stats.podmuch.progOtwarcia)})`);
            if (d.kierunek) {
                lines.push(`      kierunek (${d.kierunek.x.toFixed(2)}, ${d.kierunek.y.toFixed(2)}, ${d.kierunek.z.toFixed(2)})`);
            }
        }

        if (stats.maska) lines.push(`maska ${stats.maska}`);
        if (stats.stan) lines.push(`stan  ${stats.stan}`);

        if (stats.znaki && Object.keys(stats.znaki).length) {
            lines.push('');
            lines.push('znaki:');
            for (const [id, wynik] of Object.entries(stats.znaki)) {
                lines.push(`  ${id.padEnd(9)} ${this._num(wynik)} ${this._bar(wynik)}`);
            }
        }

        this.panel.textContent = lines.join('\n');
    }

    _num(v) {
        return (Number.isFinite(v) ? v : 0).toFixed(2);
    }

    _bar(v, width = 14) {
        const filled = Math.max(0, Math.min(width, Math.round((v || 0) * width)));
        return '▓'.repeat(filled) + '░'.repeat(width - filled);
    }

    /**
     * Znaczniki punktów ciała rysowane wprost na płótnie.
     *
     * Służy do EMPIRYCZNEGO rozstrzygnięcia sprawy lustra: płótno ma CSS
     * transform: scaleX(-1), więc przemapowany x żyje w przestrzeni NIEODBITEJ,
     * a gracz widzi odbitą. Podnieś lewą rękę i zobacz, po której stronie
     * ekranu pojawi się "L". Nie zgaduj - sprawdź.
     */
    drawOverlay(ctx, frame) {
        if (!this.visible || !frame.pose) return;

        const { landmarks } = frame.pose;
        if (!landmarks) return;

        const punkty = [
            { i: 15, etykieta: 'L-nadgarstek' },
            { i: 16, etykieta: 'P-nadgarstek' },
            { i: 11, etykieta: 'L-bark' },
            { i: 12, etykieta: 'P-bark' }
        ];

        ctx.save();
        for (const { i, etykieta } of punkty) {
            const p = landmarks[i];
            if (!p) continue;

            const x = p.x * frame.width;
            const y = p.y * frame.height;

            ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();

            // Płótno jest odbite przez CSS, więc tekst wyszedłby lustrzany
            // i nieczytelny. Odkręcamy odbicie lokalnie, tylko dla glifów.
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(etykieta, 0, -14);
            ctx.restore();
        }
        ctx.restore();
    }
}
