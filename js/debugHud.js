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

        const lines = [
            `FPS   ${fps.toFixed(1).padStart(5)}   ${this._bar(fps / 60)}${fps < 24 ? '  ⚠ PONIŻEJ 24' : ''}`,
            `pose  ${pose ? 'TAK' : 'NIE '}${pose?.worldLandmarks ? ' +world' : ' -world'}    dłonie ${hands.length}`,
            `ręce  ${rece}`,
            ''
        ];

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
        if (stats.moc !== undefined)  lines.push(`moc   ${this._num(stats.moc)}   ${this._bar(stats.moc)}`);
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
