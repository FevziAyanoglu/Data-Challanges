/**
 * Modern Flappy Bird Game
 * Canvas-based, Procedural graphics, Web Audio API Sound Effects & Parallax
 */

// --- Web Audio API Ses Sentezleyicisi ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playJump() {
        if (this.isMuted || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
            
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            // Sessizce yut
        }
    }

    playScore() {
        if (this.isMuted || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            // 2 tonlu melodi (coin/ding sesi)
            [659.25, 880].forEach((freq, index) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                
                const time = now + index * 0.08;
                osc.frequency.setValueAtTime(freq, time);
                
                gain.gain.setValueAtTime(0.2, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.start(time);
                osc.stop(time + 0.2);
            });
        } catch (e) {
            // Sessizce yut
        }
    }

    playHit() {
        if (this.isMuted || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
            
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.26);
        } catch (e) {
            // Sessizce yut
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
}

// --- Ana Oyun Sınıfı ---
class FlappyBirdGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Mantıksal çözünürlük
        this.width = 400;
        this.height = 600;
        this.setupHiDPI();

        // UI Elemanları
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.liveScoreEl = document.getElementById('liveScore');
        this.finalScoreEl = document.getElementById('finalScore');
        this.bestScoreEl = document.getElementById('bestScore');
        this.newBestBadge = document.getElementById('newBestBadge');
        this.medalContainer = document.getElementById('medalContainer');
        this.medalIcon = document.getElementById('medalIcon');
        this.medalName = document.getElementById('medalName');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.soundBtn = document.getElementById('soundBtn');
        this.soundIcon = document.getElementById('soundIcon');

        // Ses Yöneticisi
        this.sound = new SoundManager();

        // Durumlar: 'START', 'PLAYING', 'GAMEOVER'
        this.state = 'START';

        // Oyun Değişkenleri (Dengeli Fizik Değerleri)
        this.gravity = 0.28;        // Yumuşak ve dengeli yerçekimi ivmesi
        this.jumpForce = -6.2;      // Doğal ve kontrollü zıplama kuvveti
        this.maxFallSpeed = 7.8;    // Terminal düşüş hızı (kontrolsüz hızlanmayı engeller)
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('flappy_best_score') || '0', 10);

        // Kuş
        this.bird = {
            x: 100,
            y: 280,
            radius: 17,
            velocity: 0,
            rotation: 0,
            wingFrame: 0,
            flapTimer: 0
        };

        // Borular & Çevre
        this.pipes = [];
        this.pipeSpawnTimer = 0;
        this.pipeGap = 145; // Geçiş genişliği
        this.pipeSpeed = 2.4;
        this.pipeInterval = 110; // Frame aralığı

        // Zemin
        this.groundHeight = 85;
        this.groundOffset = 0;

        // Bulutlar & Arka Plan Parallax
        this.clouds = [
            { x: 30, y: 80, scale: 0.9, speed: 0.4 },
            { x: 220, y: 130, scale: 1.2, speed: 0.6 },
            { x: 340, y: 60, scale: 0.7, speed: 0.3 }
        ];

        this.hills = [
            { x: 0, height: 90, color: '#38bdf822' },
            { x: 180, height: 70, color: '#38bdf822' },
            { x: 320, height: 80, color: '#38bdf822' }
        ];

        // Parçacıklar
        this.particles = [];
        
        // Ekran sallantısı
        this.screenShake = 0;

        this.initEventListeners();
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.fixedStep = 1000 / 60; // 60 FPS sabit fizik güncelleme adımı
        requestAnimationFrame((t) => this.loop(t));
    }

    setupHiDPI() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    initEventListeners() {
        // Kontrol tetikleyicileri
        const triggerJump = (e) => {
            if (e) {
                if (e.target.closest('#soundBtn')) return;
                if (e.type === 'keydown' && e.code !== 'Space' && e.code !== 'ArrowUp') return;
                if (e.type === 'keydown') e.preventDefault();
            }

            this.sound.init();

            if (this.state === 'START') {
                this.startGame();
            } else if (this.state === 'PLAYING') {
                this.jump();
            } else if (this.state === 'GAMEOVER') {
                if (!this.gameOverScreen.classList.contains('hidden')) {
                    this.resetGame();
                    this.startGame();
                }
            }
        };

        window.addEventListener('keydown', triggerJump);
        this.canvas.addEventListener('pointerdown', triggerJump);

        this.startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sound.init();
            this.startGame();
        });

        this.restartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sound.init();
            this.resetGame();
            this.startGame();
        });

        // Ses butonu
        this.soundBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sound.init();
            const muted = this.sound.toggleMute();
            this.soundIcon.textContent = muted ? '🔇' : '🔊';
        });

        window.addEventListener('resize', () => {
            this.setupHiDPI();
        });
    }

    startGame() {
        this.state = 'PLAYING';
        this.startScreen.classList.remove('active');
        this.startScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.gameOverScreen.classList.remove('active');
        this.jump();
    }

    resetGame() {
        this.bird.x = 100;
        this.bird.y = 280;
        this.bird.velocity = 0;
        this.bird.rotation = 0;
        this.pipes = [];
        this.particles = [];
        this.score = 0;
        this.pipeSpawnTimer = 0;
        this.screenShake = 0;
        this.liveScoreEl.textContent = '0';
        this.newBestBadge.classList.add('hidden');
        this.medalContainer.classList.add('hidden');
    }

    jump() {
        this.bird.velocity = this.jumpForce;
        this.bird.rotation = -0.42; // Zıplama anında yukarı bakış açısı
        this.sound.playJump();
        
        // Zıplama puf parçacıkları
        for (let i = 0; i < 4; i++) {
            this.particles.push({
                x: this.bird.x - 12 + (Math.random() * 6 - 3),
                y: this.bird.y + (Math.random() * 10 - 5),
                vx: -2 - Math.random() * 2,
                vy: Math.random() * 2 - 1,
                radius: Math.random() * 4 + 2,
                color: 'rgba(255, 255, 255, 0.8)',
                life: 1
            });
        }
    }

    spawnPipe() {
        const minTop = 60;
        const maxTop = this.height - this.groundHeight - this.pipeGap - 60;
        const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
        const bottomHeight = this.height - this.groundHeight - topHeight - this.pipeGap;

        this.pipes.push({
            x: this.width,
            top: topHeight,
            bottom: bottomHeight,
            width: 62,
            passed: false
        });
    }

    gameOver() {
        if (this.state === 'GAMEOVER') return;
        this.state = 'GAMEOVER';
        this.sound.playHit();
        this.screenShake = 12;

        // Çarpışma tüy patlaması
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x: this.bird.x,
                y: this.bird.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 4 + 2,
                color: Math.random() > 0.4 ? '#fbbf24' : '#f97316',
                life: 1
            });
        }

        // Skor kontrolleri
        const isNewBest = this.score > this.bestScore;
        if (isNewBest) {
            this.bestScore = this.score;
            localStorage.setItem('flappy_best_score', this.bestScore.toString());
            this.newBestBadge.classList.remove('hidden');
        } else {
            this.newBestBadge.classList.add('hidden');
        }

        this.finalScoreEl.textContent = this.score;
        this.bestScoreEl.textContent = this.bestScore;

        // Madalya ödülü
        this.evaluateMedal();

        setTimeout(() => {
            this.gameOverScreen.classList.remove('hidden');
            this.gameOverScreen.classList.add('active');
        }, 400);
    }

    evaluateMedal() {
        if (this.score >= 40) {
            this.medalIcon.textContent = '💎';
            this.medalName.textContent = 'Elmas Usta';
            this.medalContainer.classList.remove('hidden');
        } else if (this.score >= 25) {
            this.medalIcon.textContent = '🥇';
            this.medalName.textContent = 'Altın Madalya';
            this.medalContainer.classList.remove('hidden');
        } else if (this.score >= 15) {
            this.medalIcon.textContent = '🥈';
            this.medalName.textContent = 'Gümüş Madalya';
            this.medalContainer.classList.remove('hidden');
        } else if (this.score >= 5) {
            this.medalIcon.textContent = '🥉';
            this.medalName.textContent = 'Bronz Madalya';
            this.medalContainer.classList.remove('hidden');
        } else {
            this.medalContainer.classList.add('hidden');
        }
    }

    // --- Güncelleme & Çizim Döngüsü ---
    loop(timestamp) {
        if (!timestamp) timestamp = performance.now();
        let dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Sekme arka planda kaldığında veya ani takılmalarda 'spiral of death' engelleme
        if (dt > 100) dt = 100;
        this.accumulator += dt;

        // Sabit 60 FPS adımlarıyla fizik simülasyonu
        while (this.accumulator >= this.fixedStep) {
            this.update();
            this.accumulator -= this.fixedStep;
        }

        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update() {
        // Ekran sarsıntısı sönümleme
        if (this.screenShake > 0) {
            this.screenShake *= 0.88;
            if (this.screenShake < 0.2) this.screenShake = 0;
        }

        // Bulutların hareketi
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed;
            if (cloud.x < -120) {
                cloud.x = this.width + 50;
                cloud.y = 40 + Math.random() * 120;
            }
        });

        // Parçacık güncelleme
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.035;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Başlangıç ekranında kuş hafifçe havada süzülür
        if (this.state === 'START') {
            this.bird.flapTimer += 0.08;
            this.bird.y = 280 + Math.sin(this.bird.flapTimer) * 7;
            this.groundOffset = (this.groundOffset + 2) % 24;
            return;
        }

        // Kuş fiziği ve dengeli ivmelenme
        this.bird.velocity += this.gravity;
        if (this.bird.velocity > this.maxFallSpeed) {
            this.bird.velocity = this.maxFallSpeed;
        }
        this.bird.y += this.bird.velocity;

        // Dönüş açısı yumuşatma (Doğal süzülme ve dalış eğrisi)
        if (this.bird.velocity < 0) {
            const targetRotation = Math.max(-0.45, this.bird.velocity * 0.07);
            this.bird.rotation += (targetRotation - this.bird.rotation) * 0.2;
        } else {
            const targetRotation = Math.min(1.2, (this.bird.velocity / this.maxFallSpeed) * 1.25);
            this.bird.rotation += (targetRotation - this.bird.rotation) * 0.16;
        }

        // Zemin hareketi
        if (this.state === 'PLAYING') {
            this.groundOffset = (this.groundOffset + this.pipeSpeed) % 24;

            // Boru üretimi
            this.pipeSpawnTimer++;
            if (this.pipeSpawnTimer >= this.pipeInterval) {
                this.spawnPipe();
                this.pipeSpawnTimer = 0;
            }

            // Boruları hareket ettir ve çarpışma kontrolü
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const pipe = this.pipes[i];
                pipe.x -= this.pipeSpeed;

                // Skor artışı
                if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
                    pipe.passed = true;
                    this.score++;
                    this.sound.playScore();
                    this.liveScoreEl.textContent = this.score;
                    
                    // Skoru kutlama efekti
                    this.liveScoreEl.classList.add('bump');
                    setTimeout(() => this.liveScoreEl.classList.remove('bump'), 150);

                    // Parıltı parçacıkları
                    for (let k = 0; k < 8; k++) {
                        this.particles.push({
                            x: this.bird.x + 10,
                            y: this.bird.y,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4,
                            radius: Math.random() * 3 + 2,
                            color: '#38bdf8',
                            life: 1
                        });
                    }
                }

                // Çarpışma Kontrolü (AABB vs Circle)
                if (this.checkCollision(pipe)) {
                    this.gameOver();
                }

                // Ekrandan çıkan boruyu sil
                if (pipe.x + pipe.width < -10) {
                    this.pipes.splice(i, 1);
                }
            }
        }

        // Zemin veya Tavan Çarpışması
        const playableBottom = this.height - this.groundHeight - this.bird.radius;
        if (this.bird.y >= playableBottom) {
            this.bird.y = playableBottom;
            this.gameOver();
        }

        if (this.bird.y - this.bird.radius <= 0) {
            this.bird.y = this.bird.radius;
            this.bird.velocity = 0;
        }
    }

    checkCollision(pipe) {
        const bx = this.bird.x;
        const by = this.bird.y;
        const r = this.bird.radius - 3; // Hassas vuruş kutusu

        // Üst Boru
        const topPipeRect = { x: pipe.x, y: 0, width: pipe.width, height: pipe.top };
        // Alt Boru
        const bottomPipeRect = { 
            x: pipe.x, 
            y: this.height - this.groundHeight - pipe.bottom, 
            width: pipe.width, 
            height: pipe.bottom 
        };

        return this.circleRectCollision(bx, by, r, topPipeRect) || 
               this.circleRectCollision(bx, by, r, bottomPipeRect);
    }

    circleRectCollision(cx, cy, r, rect) {
        const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));

        const distanceX = cx - closestX;
        const distanceY = cy - closestY;

        return (distanceX * distanceX + distanceY * distanceY) < (r * r);
    }

    draw() {
        this.ctx.save();

        // Ekran Sarsıntısı
        if (this.screenShake > 0) {
            const ox = (Math.random() - 0.5) * this.screenShake;
            const oy = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(ox, oy);
        }

        // Gökyüzü Temizle
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Arka Plan Tepeleri
        this.drawHills();

        // Bulutlar
        this.drawClouds();

        // Borular
        this.drawPipes();

        // Zemin
        this.drawGround();

        // Parçacıklar
        this.drawParticles();

        // Kuş
        this.drawBird();

        this.ctx.restore();
    }

    drawClouds() {
        this.clouds.forEach(cloud => {
            this.ctx.save();
            this.ctx.translate(cloud.x, cloud.y);
            this.ctx.scale(cloud.scale, cloud.scale);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';

            this.ctx.beginPath();
            this.ctx.arc(0, 0, 18, 0, Math.PI * 2);
            this.ctx.arc(15, -6, 22, 0, Math.PI * 2);
            this.ctx.arc(38, -2, 16, 0, Math.PI * 2);
            this.ctx.arc(24, 10, 16, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    drawHills() {
        const baseH = this.height - this.groundHeight;
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, baseH);
        this.ctx.bezierCurveTo(80, baseH - 70, 160, baseH - 30, 240, baseH - 60);
        this.ctx.bezierCurveTo(300, baseH - 85, 360, baseH - 40, 400, baseH - 55);
        this.ctx.lineTo(this.width, baseH);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawPipes() {
        const capHeight = 24;
        const capOverhang = 5;

        this.pipes.forEach(pipe => {
            // Üst boru gövdesi
            const topBodyGrad = this.ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
            topBodyGrad.addColorStop(0, '#15803d');
            topBodyGrad.addColorStop(0.3, '#4ade80');
            topBodyGrad.addColorStop(0.85, '#22c55e');
            topBodyGrad.addColorStop(1, '#166534');

            this.ctx.fillStyle = topBodyGrad;
            this.ctx.fillRect(pipe.x, 0, pipe.width, pipe.top - capHeight);

            // Üst boru kapağı
            this.ctx.fillRect(pipe.x - capOverhang, pipe.top - capHeight, pipe.width + capOverhang * 2, capHeight);
            
            // Üst boru detay konturu
            this.ctx.strokeStyle = '#14532d';
            this.ctx.lineWidth = 2.5;
            this.ctx.strokeRect(pipe.x - capOverhang, pipe.top - capHeight, pipe.width + capOverhang * 2, capHeight);
            this.ctx.strokeRect(pipe.x, -2, pipe.width, pipe.top - capHeight + 2);

            // Alt Boru
            const bottomY = this.height - this.groundHeight - pipe.bottom;
            this.ctx.fillStyle = topBodyGrad;
            this.ctx.fillRect(pipe.x, bottomY + capHeight, pipe.width, pipe.bottom - capHeight);

            // Alt boru kapağı
            this.ctx.fillRect(pipe.x - capOverhang, bottomY, pipe.width + capOverhang * 2, capHeight);
            
            // Alt boru konturu
            this.ctx.strokeRect(pipe.x - capOverhang, bottomY, pipe.width + capOverhang * 2, capHeight);
            this.ctx.strokeRect(pipe.x, bottomY + capHeight, pipe.width, pipe.bottom - capHeight + 2);
        });
    }

    drawGround() {
        const y = this.height - this.groundHeight;

        // Üst çim katmanı
        const grassGrad = this.ctx.createLinearGradient(0, y, 0, y + 14);
        grassGrad.addColorStop(0, '#84cc16');
        grassGrad.addColorStop(1, '#65a30d');
        this.ctx.fillStyle = grassGrad;
        this.ctx.fillRect(0, y, this.width, 14);

        // Toprak katmanı
        const dirtGrad = this.ctx.createLinearGradient(0, y + 14, 0, this.height);
        dirtGrad.addColorStop(0, '#e2ad58');
        dirtGrad.addColorStop(1, '#c28833');
        this.ctx.fillStyle = dirtGrad;
        this.ctx.fillRect(0, y + 14, this.width, this.groundHeight - 14);

        // Çim/zemin şerit deseni
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (let i = -24; i < this.width + 24; i += 24) {
            this.ctx.beginPath();
            this.ctx.moveTo(i - this.groundOffset, y + 14);
            this.ctx.lineTo(i - this.groundOffset + 12, y + 14);
            this.ctx.lineTo(i - this.groundOffset + 2, this.height);
            this.ctx.lineTo(i - this.groundOffset - 10, this.height);
            this.ctx.fill();
        }

        // Zemin üst çizgi
        this.ctx.strokeStyle = '#4d7c0f';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.width, y);
        this.ctx.stroke();
    }

    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    drawBird() {
        this.ctx.save();
        this.ctx.translate(this.bird.x, this.bird.y);
        this.ctx.rotate(this.bird.rotation);

        // Gövde Gradyanı (Sarı & Turuncu)
        const bodyGrad = this.ctx.createRadialGradient(-2, -4, 4, 0, 0, 18);
        bodyGrad.addColorStop(0, '#fef08a');
        bodyGrad.addColorStop(0.6, '#facc15');
        bodyGrad.addColorStop(1, '#eab308');

        // Kuş gövdesi
        this.ctx.fillStyle = bodyGrad;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#a16207';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Karın bölgesi
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(-2, 4, 12, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Göz (Büyük Çizgi Film Gözü)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(7, -5, 6.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#475569';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Gözbebeği ve Parlama
        this.ctx.fillStyle = '#0f172a';
        this.ctx.beginPath();
        this.ctx.arc(8.5, -5, 3.2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(9.5, -6.5, 1.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Gaga
        this.ctx.fillStyle = '#f97316';
        this.ctx.beginPath();
        this.ctx.moveTo(13, -2);
        this.ctx.lineTo(24, 2);
        this.ctx.lineTo(13, 7);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.strokeStyle = '#c2410c';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Kanat (Hıza göre çırpma açısı)
        const wingYOffset = Math.sin(Date.now() * 0.015) * 3;
        this.ctx.save();
        this.ctx.translate(-7, 1 + wingYOffset);
        this.ctx.rotate(wingYOffset * 0.08);

        this.ctx.fillStyle = '#ca8a04';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 9, 6, -0.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#854d0e';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.ctx.restore();

        this.ctx.restore();
    }
}

// Oyunu Başlat
window.addEventListener('DOMContentLoaded', () => {
    new FlappyBirdGame();
});
