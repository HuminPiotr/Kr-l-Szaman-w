// Progi wejścia i wyjścia z gotowości. Rozstęp między nimi to histereza -
// bez niej stan migotałby tam i z powrotem przy najlżejszym drgnięciu na granicy.
const PROG_GOTOWOSCI = 0.9;     // wejście w READY
const PROG_PODTRZYMANIA = 0.65; // spadek poniżej wraca do CHARGING

export class PowerBall {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.currentEnergy = 0; // Wartość 0.0 do 1.0 (Akumulator Mocy)
        this.szczytEnergii = 0; // najwyższa energia osiągnięta w gotowości - to nią strzelamy
        
        // Stany kuli: 'CHARGING', 'READY', 'FIRING', 'COOLDOWN'
        this.state = 'CHARGING';
        this.positionHistory = []; // Śledzenie ostatnich pozycji do wyznaczenia wektora zamachu
        this.lastNormalizedDistance = null;
        this.lastHandsCount = 0;
        this.shockwaves = [];
        this.flyingBall = null;
        this.cooldownStartTime = 0;
        this.cooldownDuration = 1000; // 1 sekunda cooldownu

        // Inicjalizacja cząsteczek
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: 0, y: 0,
                vx: 0, vy: 0,
                life: Math.random(),
                size: Math.random() * 3 + 1,
            });
        }

        // Historia palców dla "trails"
        this.fingerHistory = [];
        this.maxHistory = 15; // Długość świetlistego "ogona"
    }

    /**
     * @param {Array} hands       listy punktów dłoni (do rysowania i geometrii gestu wystrzału)
     * @param {number} width
     * @param {number} height
     * @param {number} moc        moc z MotionMeter 0..1 - ładowana TAŃCEM
     * @param {number} efficiency wynik znaku Swaroga 0..1 z ZnakRegistry - FORMA, jaką moc przybiera
     */
    updateAndDraw(hands, width, height, moc, efficiency) {
        // Tańczysz -> ładujesz moc. Rzucasz znak -> moc przybiera formę.
        // Oba czynniki są ciągłe, więc kula pojawia się i znika płynnie -
        // nie ma progu, migotania ani momentu "nie udało się".
        //
        // Po wystrzale energia jest zużyta: lecąca kula ma własną, zapamiętaną
        // w chwili strzału, a licznik wraca do zera aż do końca przeładowania.
        if (this.state === 'CHARGING' || this.state === 'READY') {
            this.currentEnergy = moc * efficiency;
        } else {
            this.currentEnergy = 0;
        }

        // Szczyt energii osiągnięty w gotowości. Wystrzał używa TEJ wartości,
        // nie chwilowej: gest rozsunięcia dłoni psuje wynik znaku, więc
        // odczyt w momencie strzału daje wartość bliską zeru i gracz wypuszcza
        // niewidzialną kulę zamiast tej, którą przed chwilą trzymał.
        // Moc zebrana tańcem należy mu się w pełni.
        if (this.state === 'READY') {
            this.szczytEnergii = Math.max(this.szczytEnergii, this.currentEnergy);
        } else if (this.state === 'CHARGING') {
            this.szczytEnergii = 0;
        }

        // Maszyna Stanów Logiki
        // (rozpoznawanie gestu wyprowadzone do js/znaki/swarog.js, a ładowanie
        //  do js/motionMeter.js - ta klasa zajmuje się już tylko stanem
        //  i renderowaniem. currentEnergy ma dokładnie JEDNEGO pisarza: linijkę wyżej.)
        if (this.state === 'CHARGING') {
            if (this.currentEnergy >= PROG_GOTOWOSCI) {
                this.state = 'READY';
            }
        } else if (this.state === 'READY') {
            // W gotowości sprawdzamy gest rozłączenia dłoni i buforujemy położenie kuli
        } else if (this.state === 'FIRING') {
            if (this.flyingBall) {
                this.flyingBall.x += this.flyingBall.vx;
                this.flyingBall.y += this.flyingBall.vy;
                this.flyingBall.size *= 0.93; // Kurczenie (lot w głąb)
                this.flyingBall.alpha -= 0.025; // Stopniowe zanikanie

                if (this.flyingBall.alpha <= 0 || this.flyingBall.size < 5) {
                    this.flyingBall = null;
                    this.state = 'COOLDOWN';
                    this.cooldownStartTime = performance.now();
                }
            } else {
                this.state = 'COOLDOWN';
                this.cooldownStartTime = performance.now();
            }
        } else if (this.state === 'COOLDOWN') {
            const elapsed = performance.now() - this.cooldownStartTime;
            if (elapsed >= this.cooldownDuration) {
                this.state = 'CHARGING';
                // Bez zerowania - od następnej klatki currentEnergy liczy się
                // znowu jako moc x znak. Zapas mocy w ciele zużył wystrzał.
            }
        }

        // 3. Rysowanie fal uderzeniowych (pod kulą)
        this.updateAndDrawShockwaves();

        // 4. Rysowanie śladów palców (tylko w fazie ładowania i gotowości)
        if (this.state === 'CHARGING' || this.state === 'READY') {
            this.updateFingerHistory(hands, width, height);
            this.drawFingerTrails();
        }

        // Jeśli poziom naładowania jest bliski zera i nie strzelamy, nie rysujemy kuli
        if (this.state === 'CHARGING' && this.currentEnergy < 0.01) return;

        // Obliczamy środek geometryczny dla kuli
        let centerX = width / 2;
        let centerY = height / 2;

        if (this.state === 'CHARGING' || this.state === 'READY') {
            if (hands.length === 2) {
                const h1 = hands[0][9];
                const h2 = hands[1][9];
                centerX = ((h1.x + h2.x) / 2) * width;
                centerY = ((h1.y + h2.y) / 2) * height;
            } else if (hands.length === 1) {
                const h = hands[0];
                const fingers = [4, 8, 12, 16];
                let cx = 0;
                let cy = 0;
                for (let idx of fingers) {
                    cx += h[idx].x * width;
                    cy += h[idx].y * height;
                }
                centerX = cx / fingers.length;
                centerY = cy / fingers.length;
            }

            // --- Logika READY ---
            if (this.state === 'READY') {
                this.positionHistory.push({ x: centerX, y: centerY });
                if (this.positionHistory.length > 5) {
                    this.positionHistory.shift();
                }

                if (hands.length === 2) {
                    const h1 = hands[0];
                    const h2 = hands[1];
                    const dx = (h1[9].x - h2[9].x) * width;
                    const dy = (h1[9].y - h2[9].y) * height;
                    const distance = Math.sqrt(dx*dx + dy*dy);
                    
                    const size_dx = (h1[0].x - h1[9].x) * width;
                    const size_dy = (h1[0].y - h1[9].y) * height;
                    const handSize = Math.max(10, Math.sqrt(size_dx*size_dx + size_dy*size_dy));
                    
                    const normalizedDistance = distance / handSize;

                    // Gest Release: nagłe rozszerzenie dłoni (np. zmiana odległości > 1.2 w klatce lub odległość > 6.0)
                    if (this.lastNormalizedDistance && (normalizedDistance - this.lastNormalizedDistance > 1.2 || normalizedDistance > 6.0)) {
                        this.fire(centerX, centerY);
                    }
                    this.lastNormalizedDistance = normalizedDistance;
                } else if (hands.length < 2 && this.lastHandsCount === 2) {
                    // Nagła utrata rąk z wizji w stanie READY (efekt szybkiego wyrzutu rąk poza kadr)
                    this.fire(centerX, centerY);
                }

                // Wyjście z gotowości: energia (moc x znak) spadła poniżej progu
                // podtrzymania. Próg jest WYRAŹNIE niżej niż próg wejścia -
                // histereza, żeby stan nie migotał na granicy.
                //
                // Bez tej reguły READY byłby pułapką: energii nie liczy się już
                // wewnątrz tej klasy, więc jedynym wyjściem zostałby wystrzał.
                //
                // Warunek na stan jest KONIECZNY: gest wystrzału to rozsunięcie
                // dłoni, które jednocześnie psuje wynik znaku Swaroga. Energia
                // spada więc poniżej progu w tej samej klatce, w której padł
                // strzał - bez tej osłony degradacja nadpisywała świeżo
                // ustawione FIRING i wystrzał w ogóle się nie odbywał.
                if (this.state === 'READY' && this.currentEnergy < PROG_PODTRZYMANIA) {
                    this.state = 'CHARGING';
                }
            }
            this.lastHandsCount = hands.length;
        }

        // 5. Renderowanie kuli
        if (this.state === 'FIRING' && this.flyingBall) {
            this.drawBall(this.flyingBall.x, this.flyingBall.y, this.flyingBall.energy, this.flyingBall.size, this.flyingBall.alpha);
        } else if (this.state === 'CHARGING' || this.state === 'READY') {
            this.drawBall(centerX, centerY, this.currentEnergy);
        }
    }

    fire(centerX, centerY) {
        this.state = 'FIRING';

        // Strzelamy szczytem osiągniętym w gotowości, nie wartością chwilową -
        // gest rozsunięcia dłoni zdążył już zepsuć wynik znaku.
        const energiaStrzalu = Math.max(this.szczytEnergii, this.currentEnergy);

        // Wyznaczenie wektora prędkości zamachu
        let vx = 0;
        let vy = 0;
        if (this.positionHistory.length >= 2) {
            const first = this.positionHistory[0];
            const last = this.positionHistory[this.positionHistory.length - 1];
            vx = last.x - first.x;
            vy = last.y - first.y;
        }

        const velocityMag = Math.sqrt(vx*vx + vy*vy);

        // Fallback: jeśli ruch był zbyt powolny lub pionowy, leci prosto w głąb (pionowo w górę ekranu)
        if (velocityMag < 7) {
            this.fireDirection = { x: 0, y: -1 };
            this.fireSpeed = 15;
        } else {
            this.fireDirection = { x: vx / velocityMag, y: vy / velocityMag };
            this.fireSpeed = Math.min(50, Math.max(12, velocityMag * 1.8));
        }

        // Parametry lecącej kuli
        this.flyingBall = {
            x: centerX,
            y: centerY,
            vx: this.fireDirection.x * this.fireSpeed,
            vy: this.fireDirection.y * this.fireSpeed,
            size: energiaStrzalu * 350,
            energy: energiaStrzalu,
            alpha: 1.0
        };

        // Shockwave wybuchowy
        this.shockwaves.push({
            x: centerX,
            y: centerY,
            radius: 40,
            maxRadius: 380,
            alpha: 1.0,
            color: this.getColorForEnergy(energiaStrzalu)
        });

        // Reset pomocniczych zmiennych
        this.positionHistory = [];
        this.lastNormalizedDistance = null;
        this.szczytEnergii = 0;
    }

    updateAndDrawShockwaves() {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += 14;
            sw.alpha -= 0.035;
            
            if (sw.alpha <= 0) {
                this.shockwaves.splice(i, 1);
                continue;
            }

            const ctx = this.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            
            // Parsowanie koloru rgb
            const rgbMatches = sw.color.match(/\d+/g);
            if (rgbMatches && rgbMatches.length >= 3) {
                ctx.strokeStyle = `rgba(${rgbMatches[0]}, ${rgbMatches[1]}, ${rgbMatches[2]}, ${sw.alpha * 0.75})`;
            } else {
                ctx.strokeStyle = `rgba(0, 255, 204, ${sw.alpha * 0.75})`;
            }
            
            ctx.lineWidth = 10 * sw.alpha;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    getColorForEnergy(energy, alpha = 1) {
        let r, g, b;
        if (energy < 0.4) {
            // Przejście Ciemnoniebieski -> Cyjan
            const t = energy / 0.4;
            r = Math.floor(t * 100);
            g = Math.floor(100 + t * 155);
            b = 255;
        } else if (energy < 0.8) {
            // Przejście Cyjan -> Magenta/Fiolet
            const t = (energy - 0.4) / 0.4;
            r = Math.floor(100 + t * 155);
            g = Math.floor(255 - t * 255);
            b = 255;
        } else {
            // Przejście Magenta -> Żółty/Ognisty Czerwony
            const t = (energy - 0.8) / 0.2;
            r = 255;
            g = Math.floor(t * 200);
            b = Math.floor(255 - t * 255);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    updateFingerHistory(hands, width, height) {
        const currentPoints = [];
        const fingerIndices = [4, 8, 12, 16, 20];
        
        for (const hand of hands) {
            for (const idx of fingerIndices) {
                currentPoints.push({
                    x: hand[idx].x * width,
                    y: hand[idx].y * height
                });
            }
        }

        this.fingerHistory.unshift(currentPoints);
        if (this.fingerHistory.length > this.maxHistory) {
            this.fingerHistory.pop();
        }
    }

    drawFingerTrails() {
        if (this.fingerHistory.length < 2) return;

        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const numFingers = this.fingerHistory[0].length;
        
        for (let f = 0; f < numFingers; f++) {
            ctx.beginPath();
            let started = false;
            
            for (let i = 0; i < this.fingerHistory.length; i++) {
                const points = this.fingerHistory[i];
                if (!points[f]) continue;
                
                if (!started) {
                    ctx.moveTo(points[f].x, points[f].y);
                    started = true;
                } else {
                    ctx.lineTo(points[f].x, points[f].y);
                }
            }
            
            const baseEnergy = Math.max(0.1, this.currentEnergy);
            
            ctx.strokeStyle = this.getColorForEnergy(baseEnergy, 0.1);
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.stroke();
        }
        ctx.restore();
    }

    drawBall(x, y, energy, customRadius = null, customAlpha = null) {
        const radius = customRadius !== null ? customRadius : (energy * 350);
        if (radius < 1) return;

        const alpha = customAlpha !== null ? customAlpha : 1.0;

        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${energy * alpha})`);
        
        const coreColor = this.getColorForEnergy(energy, energy * 0.8 * alpha);
        gradient.addColorStop(0.2, coreColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Renderowanie wirujących cząsteczek
        for (let p of this.particles) {
            p.life -= 0.02;
            
            if (p.life <= 0) {
                p.life = 1;
                const angle = Math.random() * Math.PI * 2;
                
                if (this.state === 'FIRING' && this.flyingBall) {
                    // Ogon komety lecący przeciwnie do wektora ruchu kuli z małym rozrzutem
                    const flyAngle = Math.atan2(this.flyingBall.vy, this.flyingBall.vx);
                    const emitAngle = flyAngle + Math.PI + (Math.random() - 0.5) * 0.6;
                    p.x = x;
                    p.y = y;
                    const speed = Math.random() * 9 + 3;
                    p.vx = Math.cos(emitAngle) * speed;
                    p.vy = Math.sin(emitAngle) * speed;
                } else {
                    const dist = Math.random() * radius * 0.4;
                    p.x = x + Math.cos(angle) * dist;
                    p.y = y + Math.sin(angle) * dist;
                    const speed = Math.random() * 12 * energy + 2;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;
                }
            }
            
            if (this.state === 'FIRING') {
                p.vx *= 0.98; // Mniejsza tarcie w locie dla długiego ogona
                p.vy *= 0.98;
            } else {
                p.vx *= 0.95;
                p.vy *= 0.95;
            }
            p.x += p.vx;
            p.y += p.vy;

            ctx.fillStyle = this.getColorForEnergy(energy, p.life * energy * alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 + energy), 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}
