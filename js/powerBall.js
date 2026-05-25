export class PowerBall {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.currentEnergy = 0; // Wartość 0.0 do 1.0 (Akumulator Mocy)
        
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
        const isOneHanded = hands.length === 1;
        const maxEnergy = isOneHanded ? 0.5 : 1.0; // Jedna ręka może osiągnąć tylko 50% mocy

        // 2. Akumulacja lub rozładowywanie energii
        if (efficiency > 0.5) {
            const chargeRate = (efficiency - 0.5) * 0.02;
            
            if (this.currentEnergy < maxEnergy) {
                this.currentEnergy = Math.min(maxEnergy, this.currentEnergy + chargeRate);
            } else if (this.currentEnergy > maxEnergy) {
                // Jeżeli mieliśmy moc z dwóch rąk i nagle użyliśmy jednej - energia szybko spada do 50%
                this.currentEnergy = Math.max(maxEnergy, this.currentEnergy - 0.05);
            }
        } else {
            // Rozładowywanie - szybsze jeśli dłoni nie ma
            const dischargeRate = hands.length > 0 ? 0.005 : 0.05;
            this.currentEnergy = Math.max(0.0, this.currentEnergy - dischargeRate);
        }

        // 3. Aktualizacja i rysowanie Trails (Śladów Palców)
        this.updateFingerHistory(hands, width, height);
        this.drawFingerTrails();

        // Jeżeli energia jest prawie zerowa, wygaszamy kulę i błyskawice
        if (this.currentEnergy < 0.01) return;

        let centerX = width / 2;
        let centerY = height / 2;
        
        if (hands.length === 2) {
            const h1 = hands[0][9];
            const h2 = hands[1][9];
            centerX = ((h1.x + h2.x) / 2) * width;
            centerY = ((h1.y + h2.y) / 2) * height;


        } else if (hands.length === 1) {
            // W przypadku jednej ręki rysujemy kulę wewnątrz "koszyczka" tworzonego przez palce
            const h = hands[0];
            const fingers = [4, 8, 12, 16]; // kciuk, wskazujący, środkowy, serdeczny
            let cx = 0;
            let cy = 0;
            for (let idx of fingers) {
                cx += h[idx].x * width;
                cy += h[idx].y * height;
            }
            centerX = cx / fingers.length;
            centerY = cy / fingers.length;
        }

        // 4. Renderowanie Głównej Kuli i cząsteczek
        this.drawBall(centerX, centerY, this.currentEnergy);
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

            // Mierzymy średnią odległość od czubków głównych palców do czubka kciuka (landmark 4)
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

            // Zaciśnięta pięść: ok 0.2 - 0.4
            // Całkowicie otwarta dłoń: ok 1.5 - 2.0
            // Koszyczek/Pazury: ok 0.6 - 1.2
            if (normalizedDist > 0.5 && normalizedDist < 1.3) {
                // Optymalne ściśnięcie to około 0.9
                const diff = Math.abs(normalizedDist - 0.9);
                return Math.max(0, 1.0 - (diff / 0.4));
            }
        }
        
        return 0;
    }

    // Funkcja obliczająca kolor w zależności od energii
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
            g = Math.floor(t * 200); // Dochodzi do jasnego żółtego
            b = Math.floor(255 - t * 255);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    updateFingerHistory(hands, width, height) {
        const currentPoints = [];
        // Landmarki końcówek palców: 4(Kciuk), 8(Wskazujący), 12(Środkowy), 16(Serdeczny), 20(Mały)
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
            
            // Kolor powiązany z główną energią kuli
            const baseEnergy = Math.max(0.1, this.currentEnergy);
            
            // Subtelniejsza obwódka (glow) - niemal przezroczysta
            ctx.strokeStyle = this.getColorForEnergy(baseEnergy, 0.1);
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            // Bardzo cienki, lekko widoczny rdzeń linii
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.stroke();
        }
        ctx.restore();
    }

    drawBall(x, y, energy) {
        // Zwiększono maksymalny promień kuli
        const radius = energy * 350;
        if (radius < 1) return;

        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${energy})`);
        
        // Dynamiczne kolory kuli
        const coreColor = this.getColorForEnergy(energy, energy * 0.8);
        gradient.addColorStop(0.2, coreColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Renderowanie wirujących wokół cząsteczek
        for (let p of this.particles) {
            p.life -= 0.02;
            
            if (p.life <= 0) {
                p.life = 1;
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius * 0.4;
                p.x = x + Math.cos(angle) * dist;
                p.y = y + Math.sin(angle) * dist;
                
                // Prędkość wypuszczania cząsteczek zależy od zebranej energii
                const speed = Math.random() * 12 * energy + 2;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
            }
            
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.x += p.vx;
            p.y += p.vy;

            // Kolor cząsteczek także podlega pod Color Shifting
            ctx.fillStyle = this.getColorForEnergy(energy, p.life * energy);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 + energy), 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}
