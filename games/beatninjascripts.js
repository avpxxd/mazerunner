        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const gameContainer = document.getElementById('game-container');

        const hud = document.getElementById('hud');
        const scoreEl = document.getElementById('score');
        const lifeBarContainer = document.getElementById('lifeBarContainer');
        const lifeSegments = document.querySelectorAll('#lifeBarContainer .life-segment');
        const multiplierEl = document.getElementById('multiplier');
        const startMenu = document.getElementById('startMenu');
        const gameOverMenu = document.getElementById('gameOverMenu');
        const startButton = document.getElementById('startButton');
        const restartButton = document.getElementById('restartButton');
        const finalScoreEl = document.getElementById('finalScore');
        const highScoreMenuEl = document.getElementById('highScoreMenu');
        
        const pauseButton = document.getElementById('pauseButton');
        const pauseMenu = document.getElementById('pauseMenu');
        const resumeButton = document.getElementById('resumeButton');
        const restartFromPauseButton = document.getElementById('restartFromPauseButton');
        const backgroundMusic = document.getElementById('backgroundMusic');
        const volumeSlider = document.getElementById('volumeSlider');
        const autoSliceSwitch = document.getElementById('autoSliceSwitch');
        
        const musicPlaylist = [
            "https://games.damvan.ca/fun/Demo_1.mp3",
            "https://games.damvan.ca/fun/Demo_2.mp3",
            "https://games.damvan.ca/fun/Demo_3.mp3",
            "https://games.damvan.ca/fun/Demo_4.mp3",
            "https://games.damvan.ca/fun/Demo_5.mp3"
        ];

        let score = 0, highScore = localStorage.getItem('sliceFusionHighScore') || 0;
        let lives = 3, maxLives = 4, startingLives = 3;
        let gameState = 'menu';

        let multiplier = 1, comboCounter = 0;
        const maxMultiplier = 8, comboThreshold = 20;

        let blocks = [], particles = [], swipeTrail = [];
        let shakeDuration = 0, shakeMagnitude = 0, shakeStartTime = 0;
        let isSwiping = false, lastSpawnTime = 0, spawnInterval = 1500, baseSpeed = 2;
        let pausedTime = 0;
        let isAutoSliceEnabled = false;

        const BLOCK_SIZE = 80;
        const DIRECTIONS = ['up', 'down', 'left', 'right'];
        const DIRECTION_ANGLES = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
        const COLORS = ['#ef4444', '#3b82f6'];
        const EDGE_BUFFER = 60;

        function resizeCanvas() { canvas.width = gameContainer.clientWidth; canvas.height = gameContainer.clientHeight; }

        class Block {
            constructor(x, y, type) { this.x = x; this.y = y; this.size = BLOCK_SIZE; this.type = type; this.speed = baseSpeed + Math.random() * 1.5; this.direction = this.type === 'normal' ? DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)] : null; this.sliced = false; this.angle = Math.random() * 0.2 - 0.1; switch (this.type) { case 'normal': this.color = COLORS[Math.floor(Math.random() * COLORS.length)]; break; case 'bomb': this.color = '#facc15'; break; case 'heart': this.color = '#f472b6'; break; } }
            update() { this.y += this.speed; }
            draw() { ctx.save(); ctx.translate(this.x + this.size / 2, this.y + this.size / 2); ctx.rotate(this.angle); ctx.fillStyle = this.color; ctx.strokeStyle = (this.type === 'bomb' || this.type === 'heart') ? '#4b5563' : '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-this.size / 2, -this.size / 2, this.size, this.size, 12); ctx.fill(); ctx.stroke(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (this.type === 'normal') { ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.beginPath(); const arrowSize = this.size * 0.3; switch (this.direction) { case 'up': ctx.moveTo(0, -arrowSize); ctx.lineTo(arrowSize, 0); ctx.lineTo(-arrowSize, 0); break; case 'down': ctx.moveTo(0, arrowSize); ctx.lineTo(arrowSize, 0); ctx.lineTo(-arrowSize, 0); break; case 'left': ctx.moveTo(-arrowSize, 0); ctx.lineTo(0, -arrowSize); ctx.lineTo(0, arrowSize); break; case 'right': ctx.moveTo(arrowSize, 0); ctx.lineTo(0, -arrowSize); ctx.lineTo(0, arrowSize); break; } ctx.closePath(); ctx.fill(); } else if (this.type === 'bomb') { ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2); ctx.fill(); } else if (this.type === 'heart') { ctx.font = `${this.size * 0.6}px Poppins`; ctx.fillStyle = '#ffffff'; ctx.fillText('❤️', 0, 0); } ctx.restore(); }
        }

        class Particle {
            constructor(x, y, color) { this.x = x; this.y = y; this.color = color; this.size = Math.random() * 10 + 5; this.vx = (Math.random() - 0.5) * 8; this.vy = (Math.random() - 0.5) * 8; this.alpha = 1; this.gravity = 0.2; }
            update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.alpha -= 0.02; }
            draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        }

        function spawnBlock() { const spawnableWidth = Math.max(0, canvas.width - BLOCK_SIZE - (EDGE_BUFFER * 2)); const x = EDGE_BUFFER + Math.random() * spawnableWidth; const y = -BLOCK_SIZE; const rand = Math.random(); let type; if (rand < 0.02) { type = 'heart'; } else if (rand < 0.10) { type = 'bomb'; } else { type = 'normal'; } blocks.push(new Block(x, y, type)); }
        function createParticles(x, y, color) { for (let i = 0; i < 20; i++) particles.push(new Particle(x, y, color)); }
        function triggerScreenShake(magnitude, duration) { shakeMagnitude = magnitude; shakeDuration = duration; shakeStartTime = Date.now(); }

        function update() {
            if (gameState !== 'playing') return;
            if (Date.now() - lastSpawnTime > spawnInterval) { spawnBlock(); lastSpawnTime = Date.now(); if (spawnInterval > 350) spawnInterval *= 0.992; if (baseSpeed < 10) baseSpeed += 0.018; }
            for (let i = blocks.length - 1; i >= 0; i--) { const block = blocks[i]; block.speed = baseSpeed + (block.speed - Math.floor(block.speed)); block.update(); if (block.y > canvas.height) { if (block.type === 'normal' && !block.sliced) { lives--; updateLivesDisplay(); comboCounter = 0; if (multiplier > 1) { multiplier = 1; updateMultiplierDisplay(); } createParticles(block.x + block.size/2, canvas.height - 20, '#9ca3af'); if (lives <= 0) { gameOver(); return; } } blocks.splice(i, 1); } }
            particles.forEach((p, i) => { p.update(); if (p.alpha <= 0) particles.splice(i, 1); });
            if (swipeTrail.length > 20) swipeTrail.shift();
        }

        function draw() {
            update();
            ctx.save();
            if (shakeDuration > 0 && Date.now() - shakeStartTime < shakeDuration) { const p = (Date.now() - shakeStartTime) / shakeDuration; const m = shakeMagnitude * (1 - p); const x = (Math.random() - 0.5) * m * 2; const y = (Math.random() - 0.5) * m * 2; ctx.translate(x, y); } else { shakeDuration = 0; }
            ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (gameState !== 'menu') { blocks.forEach(b => b.draw()); particles.forEach(p => p.draw()); if (swipeTrail.length > 1) { ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for(let i = 1; i < swipeTrail.length; i++) { ctx.lineWidth = i / swipeTrail.length * 15; ctx.beginPath(); ctx.moveTo(swipeTrail[i-1].x, swipeTrail[i-1].y); ctx.lineTo(swipeTrail[i].x, swipeTrail[i].y); ctx.stroke(); } } }
            ctx.restore();
            requestAnimationFrame(draw);
        }

        function addScore(points) { score += points; scoreEl.textContent = score; }
        
        function updateLivesDisplay() { lifeSegments.forEach((s, i) => { if (i < lives) { s.classList.remove('bg-gray-600'); s.classList.add('bg-cyan-400'); } else { s.classList.remove('bg-cyan-400'); s.classList.add('bg-gray-600'); } }); }

        function updateMultiplierDisplay() { multiplierEl.textContent = `x${multiplier}`; if (multiplier > 1) { multiplierEl.classList.remove('text-gray-500'); multiplierEl.classList.add('text-yellow-400'); } else { multiplierEl.classList.remove('text-yellow-400'); multiplierEl.classList.add('text-gray-500'); } }

        function checkSlice(x, y) {
            if (swipeTrail.length < 2 || gameState !== 'playing') return;
            for (let i = blocks.length - 1; i >= 0; i--) {
                const block = blocks[i];
                if (block.sliced) continue;
                if (x > block.x && x < block.x + block.size && y > block.y && y < block.y + block.size) {
                    if (block.type === 'bomb') { lives--; updateLivesDisplay(); comboCounter = 0; if (multiplier > 1) { multiplier = 1; updateMultiplierDisplay(); } block.sliced = true; triggerScreenShake(15, 200); createParticles(block.x + block.size / 2, block.y + block.size / 2, '#ef4444'); setTimeout(() => { const index = blocks.indexOf(block); if (index > -1) blocks.splice(index, 1); }, 100); if (lives <= 0) { gameOver(); } return; }
                    if (block.type === 'heart') { if (lives >= maxLives) { lifeBarContainer.classList.add('shake'); setTimeout(() => lifeBarContainer.classList.remove('shake'), 500); } else { lives++; updateLivesDisplay(); } block.sliced = true; createParticles(block.x + block.size / 2, block.y + block.size / 2, block.color); setTimeout(() => { const index = blocks.indexOf(block); if (index > -1) blocks.splice(index, 1); }, 100); return; }
                    const p1 = swipeTrail[swipeTrail.length - 2], p2 = swipeTrail[swipeTrail.length - 1]; const dx = p2.x - p1.x, dy = p2.y - p1.y; if (Math.hypot(dx, dy) < 10) continue; const angle = Math.atan2(dy, dx); const requiredAngle = DIRECTION_ANGLES[block.direction]; const angleDiff = Math.abs(angle - requiredAngle); const tolerance = Math.PI / 2.5;
                    if (Math.min(angleDiff, Math.abs(angleDiff - 2 * Math.PI)) < tolerance) { block.sliced = true; addScore(10 * multiplier); comboCounter++; if (comboCounter % comboThreshold === 0 && multiplier < maxMultiplier) { multiplier++; multiplierEl.classList.add('multiplier-bounce'); setTimeout(() => multiplierEl.classList.remove('multiplier-bounce'), 600); } updateMultiplierDisplay(); createParticles(block.x + block.size / 2, block.y + block.size / 2, block.color); setTimeout(() => { const index = blocks.indexOf(block); if (index > -1) blocks.splice(index, 1); }, 100); }
                }
            }
        }
        
        function getEventCoords(e) { let x, y; if (e.touches && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; } else { x = e.clientX; y = e.clientY; } return { x, y }; }
        
        function handleStartSwipe(e) { if (gameState !== 'playing' || isAutoSliceEnabled) return; isSwiping = true; swipeTrail = [getEventCoords(e)]; }
        
        function handleMoveSwipe(e) {
            if (gameState !== 'playing') return;
            if (isAutoSliceEnabled || isSwiping) {
                e.preventDefault();
                const { x, y } = getEventCoords(e);
                swipeTrail.push({ x, y });
                checkSlice(x, y);
            }
        }
        
        function handleEndSwipe(e) { if (gameState !== 'playing' || isAutoSliceEnabled) return; isSwiping = false; swipeTrail = []; }
        
        function setVolume(level) {
            backgroundMusic.volume = level;
            localStorage.setItem('beatNinjaVolume', level);
        }

        function startGame() { 
            score = 0; lives = startingLives; blocks = []; particles = []; 
            multiplier = 1; comboCounter = 0;
            scoreEl.textContent = score; 
            updateLivesDisplay(); 
            updateMultiplierDisplay();
            baseSpeed = canvas.height / 400; spawnInterval = 1500; 
            lastSpawnTime = Date.now(); 
            gameState = 'playing'; 
            isSwiping = isAutoSliceEnabled;
            swipeTrail = [];
            startMenu.classList.add('hidden'); 
            gameOverMenu.classList.add('hidden');
            pauseMenu.classList.add('hidden');
            pauseMenu.classList.remove('flex');
            hud.classList.remove('hidden'); 
            
            const randomSong = musicPlaylist[Math.floor(Math.random() * musicPlaylist.length)];
            backgroundMusic.src = randomSong;
            backgroundMusic.currentTime = 0;
            backgroundMusic.play().catch(error => console.log("User needs to interact with the document first to play audio."));
        }

        function gameOver() { 
            if (gameState === 'gameOver') return; 
            gameState = 'gameOver'; 
            finalScoreEl.textContent = score; 
            if (score > highScore) { highScore = score; localStorage.setItem('sliceFusionHighScore', highScore); } 
            highScoreMenuEl.textContent = highScore; 
            hud.classList.add('hidden'); 
            gameOverMenu.classList.remove('hidden'); 
            backgroundMusic.pause();
        }
        
        function pauseGame() {
            if (gameState !== 'playing') return;
            pausedTime = Date.now();
            gameState = 'paused';
            swipeTrail = [];
            hud.classList.add('hidden');
            pauseMenu.classList.remove('hidden');
            pauseMenu.classList.add('flex');
            backgroundMusic.pause();
        }

        function resumeGame() {
            if (gameState !== 'paused') return;
            const elapsed = Date.now() - pausedTime;
            lastSpawnTime += elapsed;
            gameState = 'playing';
            isSwiping = isAutoSliceEnabled;
            swipeTrail = [];
            hud.classList.remove('hidden');
            pauseMenu.classList.add('hidden');
            pauseMenu.classList.remove('flex');
            backgroundMusic.play().catch(error => console.log("Audio play failed on resume:", error));
        }

        // Initial setup
        window.addEventListener('resize', resizeCanvas);
        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', startGame);
        pauseButton.addEventListener('click', pauseGame);
        resumeButton.addEventListener('click', resumeGame);
        restartFromPauseButton.addEventListener('click', startGame);
        
        volumeSlider.addEventListener('input', (e) => {
            setVolume(e.target.value / 100);
        });

        autoSliceSwitch.addEventListener('change', (e) => {
            isAutoSliceEnabled = e.target.checked;
            isSwiping = isAutoSliceEnabled;
            swipeTrail = [];
        });

        // Load saved volume or set a default
        const savedVolume = localStorage.getItem('beatNinjaVolume');
        if (savedVolume !== null) {
            volumeSlider.value = savedVolume * 100;
            setVolume(savedVolume);
        } else {
            volumeSlider.value = 50; // Default 50%
            setVolume(0.5);
        }

        canvas.addEventListener('mousedown', handleStartSwipe); canvas.addEventListener('mousemove', handleMoveSwipe); canvas.addEventListener('mouseup', handleEndSwipe);
        // Clear trail if mouse leaves canvas to prevent ugly lines
        canvas.addEventListener('mouseleave', () => { if (isAutoSliceEnabled) { swipeTrail = []; } else { handleEndSwipe(); }});
        canvas.addEventListener('touchstart', handleStartSwipe, { passive: false }); canvas.addEventListener('touchmove', handleMoveSwipe, { passive: false }); canvas.addEventListener('touchend', handleEndSwipe); canvas.addEventListener('touchcancel', handleEndSwipe);
        
        resizeCanvas();
        highScoreMenuEl.textContent = highScore;
        requestAnimationFrame(draw);
