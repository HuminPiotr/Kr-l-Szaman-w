export class PowerBall {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.currentEnergy = 0; // Wartość 0.0 do 1.0 (Akumulator Mocy)
        
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

    updateAndDraw(hands, width, height) {
        // 1. Obliczanie efektywności obecnego ułożenia dłoni
        const efficiency = this.calculateEfficiency(hands, width, height);

        // 2. Maszyna Stanów Logiki
        if (this.state === 'CHARGING') {
            if (efficiency > 0.5) {
                const chargeRate = (efficiency - 0.5) * 0.02;
                if (this.currentEnergy < 1.0) {
                    this.currentEnergy = Math.min(1.0, this.currentEnergy + chargeRate);
                }
                // Wejście w gotowość do strzału przy 95% naładowania
                if (this.currentEnergy >= 0.95) {
                    this.state = 'READY';
                }
            } else {
                const dischargeRate = hands.length > 0 ? 0.005 : 0.05;
                this.currentEnergy = Math.max(0.0, this.currentEnergy - dischargeRate);
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
                this.currentEnergy = 0;
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

                // Jeżeli użytkownik trzyma ręce za mało stabilnie, energia powoli uchodzi
                if (efficiency < 0.3) {
                    this.currentEnergy = Math.max(0.0, this.currentEnergy - 0.006);
                    if (this.currentEnergy < 0.9) {
                        this.state = 'CHARGING';
                    }
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
            size: this.currentEnergy * 350,
            energy: this.currentEnergy,
            alpha: 1.0
        };

        // Shockwave wybuchowy
        this.shockwaves.push({
            x: centerX,
            y: centerY,
            radius: 40,
            maxRadius: 380,
            alpha: 1.0,
            color: this.getColorForEnergy(this.currentEnergy)
        });

        // Reset pomocniczych zmiennych
        this.positionHistory = [];
        this.lastNormalizedDistance = null;
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

    calculateEfficiency(hands, width, height) {
        if (hands.length === 0) return 0;

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

            // "Miseczka" jest najlepsza przy odległości od 1.2 do 5 rozmiarów dłoni
            if (normalizedDistance > 1.2 && normalizedDistance < 5.0) {
                const diff = Math.abs(normalizedDistance - 2.5);
                return Math.max(0, 1.0 - (diff / 2.5));
            }
        } else if (hands.length === 1) {
            // Mechanika jednoręczna - palce ułożone "w koszyczek" blisko kciuka (ale nie zaciśnięte)
            const h = hands[0];
            
            const size_dx = (h[0].x - h[9].x) * width;
            const size_dy = (h[0].y - h[9].y) * height;
            const handSize = Math.max(10, Math.sqrt(size_dx*size_dx + size_dy*size_dy));

            const thumb = h[4];
            const fingers = [8, 12, 16]; // wskazujący, środkowy, serdeczny
            let totalDist = 0;
            
            for (let idx of fingers) {
                const dx = (h[idx].x - thumb.x) * width;
                const dy = (h[idx].y - thumb.y) * height;
                totalDist += Math.sqrt(dx*dx + dy*dy);
            }
            
            const avgDist = totalDist / fingers.length;
            const normalizedDist = avgDist / handSize;

            if (normalizedDist > 0.5 && normalizedDist < 1.3) {
                const diff = Math.abs(normalizedDist - 0.9);
                return Math.max(0, 1.0 - (diff / 0.4));
            }
        }
        
        return 0;
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
