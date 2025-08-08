document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameContainer = document.getElementById('game-container');
    
    const healthBar = document.getElementById('health-bar');
    const ammoCountEl = document.getElementById('ammo-count');
    const waveCounterEl = document.getElementById('wave-counter');
    const scoreCounterEl = document.getElementById('score-counter');
    const weapon1Slot = document.getElementById('weapon-1');
    const weapon2Slot = document.getElementById('weapon-2');

    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const resumeButton = document.getElementById('resume-button');
    const finalScoreEl = document.getElementById('final-score');
    const tauntTextEl = document.getElementById('taunt-text');
    
    const pauseButton = document.getElementById('pause-button');
    const pauseIcon = document.getElementById('pause-icon');
    const playIcon = document.getElementById('play-icon');

    let animationFrameId, healthPackInterval, ragePackInterval;

    // --- Game State ---
    let player, zombies, bullets, obstacles, bloodSplatters, bombs, healthPacks, ragePacks, mousePos;
    let keys = {};
    let wave, score, gameRunning, isPaused;
    
    const TAUNTS = [
        "Are you playing on a microwave touchpad?",
        "That was a bold strategy. Let me know when you're going to start using a good one.",
        "I've seen loading screens with a better thought process.",
        "Did you spill something on your keyboard? Like, your talent?",
        "Your monitor must be off. It's the only logical explanation.",
        "You're not a player. You're a stress test for my patience.",
        "That was a statistical anomaly of failure.",
        "My AI-generated teammate is better than you.",
        "You are a loot drop for the other team.",
        "You are the tutorial's final boss.",
        "The universe watched you play tonight and collectively sighed.",
        "Was that your final form? Please say no.",
        "Human traffic cone.",
        "That was a waste of bandwidth.",
        "Brain went AFK.",
        "A walking error message.",
        "Weaponized incompetence.",
        "A bot would be an upgrade.",
        "All focus, zero impact.",
        "Just a glorified speedbump.",
        "Go to bed. You're done.",
        "Truly a master of none."
    ];

    // --- Game Configuration ---
    const PLAYER_CONFIG = {
        width: 30,
        height: 30,
        speed: 3,
        maxHealth: 100,
    };

    const ZOMBIE_CONFIG = {
        width: 30,
        height: 30,
        speed: 1.5,
        health: 50,
        damage: 20,
        color: '#28a745',
        attackCooldown: 1000,
    };

    const GUN_CONFIG = {
        damage: 25,
        fireRate: 250,
        bulletSpeed: 10,
        maxAmmo: 15,
        reloadTime: 2000,
    };

    const MELEE_CONFIG = {
        damage: 50,
        range: 50,
        swingRate: 600,
        arc: Math.PI / 2,
    };

    const BOMB_CONFIG = {
        radius: 12,
        damage: 50,
        color: '#000000'
    };

    const HEALTH_PACK_CONFIG = {
        width: 25,
        height: 25,
        duration: 3000,
        color: '#198754'
    };
    
    const RAGE_PACK_CONFIG = {
        width: 10,
        height: 25,
        duration: 3000,
        rageDuration: 5000, // 5 seconds of rage
        rageFireRate: 50, // very fast
        color: '#ffc107'
    };
    
    // --- Setup Functions ---
    function resizeCanvas() {
        canvas.width = gameContainer.clientWidth;
        canvas.height = gameContainer.clientHeight;
    }

    function init() {
        resizeCanvas();
        
        player = {
            ...PLAYER_CONFIG,
            x: canvas.width / 2,
            y: canvas.height / 2,
            health: PLAYER_CONFIG.maxHealth,
            angle: 0,
            weapons: [
                { ...GUN_CONFIG, ammo: GUN_CONFIG.maxAmmo, lastShot: 0, reloading: false },
                { ...MELEE_CONFIG, lastSwing: 0, swinging: false }
            ],
            currentWeapon: 0,
            rageModeActive: false,
            rageEndTime: 0,
        };

        zombies = [];
        bullets = [];
        bloodSplatters = [];
        bombs = [];
        healthPacks = [];
        ragePacks = [];
        obstacles = [
            { x: 200, y: 200, width: 150, height: 40, color: '#6c757d' },
            { x: canvas.width - 350, y: 200, width: 150, height: 40, color: '#6c757d' },
            { x: canvas.width / 2 - 75, y: canvas.height - 240, width: 150, height: 40, color: '#6c757d' },
            { x: 200, y: canvas.height - 240, width: 40, height: 100, color: '#6c757d' },
            { x: canvas.width - 240, y: canvas.height - 300, width: 40, height: 100, color: '#6c757d' },
        ];
        mousePos = { x: 0, y: 0 };
        keys = {};
        wave = 0;
        score = 0;
        gameRunning = true;
        isPaused = false;
        
        if (healthPackInterval) clearInterval(healthPackInterval);
        if (ragePackInterval) clearInterval(ragePackInterval);
        healthPackInterval = setInterval(trySpawnHealthPack, 15000);
        ragePackInterval = setInterval(trySpawnRagePack, 20000);

        startNewWave();
        updateUI();
        
        if(animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoop();
    }
    
    function getValidSpawnPosition(itemWidth, itemHeight) {
        let position, valid = false;
        let attempts = 0;
        while (!valid && attempts < 50) {
            position = {
                x: Math.random() * (canvas.width - itemWidth - 60) + 30,
                y: Math.random() * (canvas.height - itemHeight - 60) + 30,
                width: itemWidth,
                height: itemHeight
            };
            valid = true;
            for (const obstacle of obstacles) {
                if (isColliding(position, obstacle)) {
                    valid = false;
                    break;
                }
            }
            attempts++;
        }
        return position;
    }

    function startNewWave() {
        wave++;
        const numZombies = 8 + wave * 2;
        zombies = [];
        for (let i = 0; i < numZombies; i++) spawnZombie();
        if (wave >= 2) spawnBombs();
        updateUI();
    }

    function spawnZombie() {
        let x, y;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = Math.random() * canvas.width; y = -ZOMBIE_CONFIG.height; } 
        else if (side === 1) { x = canvas.width + ZOMBIE_CONFIG.width; y = Math.random() * canvas.height; }
        else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + ZOMBIE_CONFIG.height; }
        else { x = -ZOMBIE_CONFIG.width; y = Math.random() * canvas.height; }
        zombies.push({ ...ZOMBIE_CONFIG, x, y, lastAttack: 0 });
    }

    function spawnBombs() {
        bombs = [];
        const numBombs = Math.min(5, 3 + Math.floor((wave - 2) / 2));
        for (let i = 0; i < numBombs; i++) {
            const pos = getValidSpawnPosition(BOMB_CONFIG.radius * 2, BOMB_CONFIG.radius * 2);
            bombs.push({ x: pos.x + BOMB_CONFIG.radius, y: pos.y + BOMB_CONFIG.radius, radius: BOMB_CONFIG.radius });
        }
    }
    
    function trySpawnHealthPack() {
        if (isPaused || !gameRunning || healthPacks.length > 0) return;
        const pos = getValidSpawnPosition(HEALTH_PACK_CONFIG.width, HEALTH_PACK_CONFIG.height);
        healthPacks.push({ ...pos, createdAt: Date.now() });
    }
    
    function trySpawnRagePack() {
        if (isPaused || !gameRunning || ragePacks.length > 0) return;
        const pos = getValidSpawnPosition(RAGE_PACK_CONFIG.width, RAGE_PACK_CONFIG.height);
        ragePacks.push({ ...pos, createdAt: Date.now() });
    }

    // --- Event Listeners ---
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (!gameRunning) return;
        if (e.code === 'KeyP') togglePause();
        if (isPaused) return;
        if(e.code === 'Digit1') switchWeapon(0, true);
        if(e.code === 'Digit2') switchWeapon(1, true);
        if(e.code === 'KeyR' && player.currentWeapon === 0 && !player.rageModeActive) startReload();
    });
    document.addEventListener('keyup', e => { delete keys[e.code]; });
    canvas.addEventListener('mousemove', e => { const rect = canvas.getBoundingClientRect(); mousePos.x = e.clientX - rect.left; mousePos.y = e.clientY - rect.top; });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) handleAttack(); });
    document.addEventListener('wheel', e => { if (!gameRunning || isPaused) return; switchWeapon(e.deltaY > 0 ? 1 : -1); });
    startButton.addEventListener('click', () => { startScreen.classList.add('hidden'); init(); });
    restartButton.addEventListener('click', () => { gameOverScreen.classList.add('hidden'); init(); });
    pauseButton.addEventListener('click', togglePause);
    resumeButton.addEventListener('click', togglePause);

    // --- Update Functions ---
    function update() {
        updatePlayer();
        updateBullets();
        updateZombies();
        updatePowerups();
        checkCollisions();
        if (zombies.length === 0 && gameRunning) startNewWave();
    }

    function updatePlayer() {
        // Rage mode check
        if (player.rageModeActive && Date.now() > player.rageEndTime) {
            player.rageModeActive = false;
        }
        // Movement
        let dx = 0, dy = 0;
        if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            const moveX = (dx / magnitude) * player.speed, moveY = (dy / magnitude) * player.speed;
            const nextX = player.x + moveX, nextY = player.y + moveY;
            let canMoveX = true, canMoveY = true;
            for(const obstacle of obstacles) {
                if (isColliding({ ...player, x: nextX }, obstacle)) canMoveX = false;
                if (isColliding({ ...player, y: nextY }, obstacle)) canMoveY = false;
            }
            if(canMoveX) player.x = nextX;
            if(canMoveY) player.y = nextY;
        }
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
        player.angle = Math.atan2(mousePos.y - (player.y + player.height / 2), mousePos.x - (player.x + player.width / 2));
    }

    function updateBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx; b.y += b.vy;
            if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) bullets.splice(i, 1);
        }
    }

    function updateZombies() {
        zombies.forEach(z => {
            const angle = Math.atan2(player.y - z.y, player.x - z.x);
            const speed = ZOMBIE_CONFIG.speed;
            const dx = Math.cos(angle) * speed, dy = Math.sin(angle) * speed;
            const nextX = z.x + dx, nextY = z.y + dy;
            let collision = false;
            for(const ob of obstacles) { if (isColliding({ ...z, x: nextX, y: nextY }, ob)) { collision = true; break; } }
            if(!collision) { z.x = nextX; z.y = nextY; }
            else {
                let cX = false; for(const ob of obstacles) { if (isColliding({ ...z, x: nextX }, ob)) { cX = true; break; } } if (!cX) z.x = nextX;
                let cY = false; for(const ob of obstacles) { if (isColliding({ ...z, y: nextY }, ob)) { cY = true; break; } } if (!cY) z.y = nextY;
            }
        });
    }
    
    function updatePowerups() {
        const now = Date.now();
        for (let i = healthPacks.length - 1; i >= 0; i--) if (now - healthPacks[i].createdAt > HEALTH_PACK_CONFIG.duration) healthPacks.splice(i, 1);
        for (let i = ragePacks.length - 1; i >= 0; i--) if (now - ragePacks[i].createdAt > RAGE_PACK_CONFIG.duration) ragePacks.splice(i, 1);
    }

    // --- Collision Detection ---
    function isColliding(r1, r2) { return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y; }
    function isCollidingCircle(c, r) {
        const dX = Math.abs(c.x - r.x - r.width / 2), dY = Math.abs(c.y - r.y - r.height / 2);
        if (dX > (r.width / 2 + c.radius) || dY > (r.height / 2 + c.radius)) return false;
        if (dX <= (r.width / 2) || dY <= (r.height / 2)) return true;
        const cornerDistSq = (dX - r.width / 2)**2 + (dY - r.height / 2)**2;
        return (cornerDistSq <= (c.radius**2));
    }

    function checkCollisions() {
        // Bullets -> Zombies
        for (let i = bullets.length - 1; i >= 0; i--) {
            for (let j = zombies.length - 1; j >= 0; j--) {
                if (isColliding(bullets[i], zombies[j])) {
                    zombies[j].health -= bullets[i].damage;
                    bullets.splice(i, 1);
                    if (zombies[j].health <= 0) {
                        bloodSplatters.push({ x: zombies[j].x + zombies[j].width / 2, y: zombies[j].y + zombies[j].height / 2, radius: Math.random() * 10 + 10, color: `rgba(150, 0, 0, ${Math.random() * 0.3 + 0.4})` });
                        score += 10;
                        zombies.splice(j, 1);
                        updateUI();
                    }
                    break; 
                }
            }
        }

        // Melee -> Zombies
        const melee = player.weapons[1];
        if (melee.swinging) {
            const swingCenterX = player.x + player.width / 2, swingCenterY = player.y + player.height / 2;
            for (let i = zombies.length - 1; i >= 0; i--) {
                const z = zombies[i];
                const dx = (z.x + z.width / 2) - swingCenterX, dy = (z.y + z.height / 2) - swingCenterY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MELEE_CONFIG.range + z.width / 2) {
                    const angleToZombie = Math.atan2(dy, dx);
                    let angleDiff = Math.abs(player.angle - angleToZombie);
                    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                    if (angleDiff < MELEE_CONFIG.arc / 2) {
                        z.health -= MELEE_CONFIG.damage;
                        melee.swinging = false;
                        if (z.health <= 0) {
                            bloodSplatters.push({ x: z.x + z.width / 2, y: z.y + z.height / 2, radius: Math.random() * 15 + 15, color: `rgba(180, 0, 0, ${Math.random() * 0.4 + 0.5})` });
                            score += 10;
                            zombies.splice(i, 1);
                            updateUI();
                        }
                    }
                }
            }
        }

        // Zombies -> Player
        zombies.forEach(z => { if (isColliding(player, z)) { const now = Date.now(); if (now - z.lastAttack > ZOMBIE_CONFIG.attackCooldown) { player.health -= ZOMBIE_CONFIG.damage; z.lastAttack = now; updateUI(); if (player.health <= 0) gameOver(); } } });
        
        // Player -> Bombs
        for (let i = bombs.length - 1; i >= 0; i--) { if (isCollidingCircle(bombs[i], player)) { player.health -= BOMB_CONFIG.damage; bombs.splice(i, 1); updateUI(); if (player.health <= 0) gameOver(); } }

        // Player -> Health Packs
        for (let i = healthPacks.length - 1; i >= 0; i--) { if (isColliding(player, healthPacks[i])) { player.health = PLAYER_CONFIG.maxHealth; healthPacks.splice(i, 1); updateUI(); } }
        
        // Player -> Rage Packs
        for (let i = ragePacks.length - 1; i >= 0; i--) { if (isColliding(player, ragePacks[i])) { player.rageModeActive = true; player.rageEndTime = Date.now() + RAGE_PACK_CONFIG.rageDuration; ragePacks.splice(i, 1); } }
    }

    // --- Attack & Weapon Logic ---
    function handleAttack() {
        if (!gameRunning || isPaused) return;
        const now = Date.now();
        if (player.currentWeapon === 0) { // Gun
            const gun = player.weapons[0];
            const isRage = player.rageModeActive;
            const currentFireRate = isRage ? RAGE_PACK_CONFIG.rageFireRate : gun.fireRate;

            if (gun.reloading || now - gun.lastShot < currentFireRate) return;
            if (!isRage && gun.ammo <= 0) return;

            gun.lastShot = now;
            if (!isRage) {
                gun.ammo--;
            }
            
            bullets.push({ x: player.x + player.width / 2, y: player.y + player.height / 2, width: 5, height: 5, vx: Math.cos(player.angle) * GUN_CONFIG.bulletSpeed, vy: Math.sin(player.angle) * GUN_CONFIG.bulletSpeed, damage: GUN_CONFIG.damage, color: '#ffc107' });
            
            if (!isRage && gun.ammo === 0) {
                startReload();
            }
        } else { // Melee
            const melee = player.weapons[1];
            if (melee.swinging || now - melee.lastSwing < melee.swingRate) return;
            melee.lastSwing = now;
            melee.swinging = true;
            setTimeout(() => { melee.swinging = false; }, 200);
        }
        updateUI();
    }

    function startReload() {
        const gun = player.weapons[0];
        if (gun.reloading || gun.ammo === gun.maxAmmo) return;
        gun.reloading = true;
        ammoCountEl.textContent = 'Reloading...';
        setTimeout(() => { if(!gun.reloading) return; gun.ammo = gun.maxAmmo; gun.reloading = false; updateUI(); }, gun.reloadTime);
    }

    function switchWeapon(val, isAbsolute = false) {
        if (player.weapons[0].reloading) return;
        player.currentWeapon = isAbsolute ? val : (player.currentWeapon + val + player.weapons.length) % player.weapons.length;
        updateUI();
    }

    // --- Drawing Functions ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bloodSplatters.forEach(s => { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill(); });
        obstacles.forEach(ob => { ctx.fillStyle = ob.color; ctx.fillRect(ob.x, ob.y, ob.width, ob.height); });
        bombs.forEach(bomb => { ctx.fillStyle = BOMB_CONFIG.color; ctx.beginPath(); ctx.arc(bomb.x, bomb.y, bomb.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(Date.now() * 0.01))})`; ctx.beginPath(); ctx.arc(bomb.x, bomb.y, bomb.radius * 0.4, 0, Math.PI * 2); ctx.fill(); });
        healthPacks.forEach(p => { ctx.fillStyle = HEALTH_PACK_CONFIG.color; ctx.fillRect(p.x, p.y, p.width, p.height); ctx.fillStyle = '#fff'; ctx.fillRect(p.x + p.width/2 - 2, p.y + 5, 4, p.height - 10); ctx.fillRect(p.x + 5, p.y + p.height/2 - 2, p.width - 10, 4); });
        ragePacks.forEach(p => { ctx.fillStyle = RAGE_PACK_CONFIG.color; ctx.fillRect(p.x, p.y, p.width, p.height); });
        bullets.forEach(b => { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.width, 0, Math.PI * 2); ctx.fill(); });
        zombies.forEach(z => { ctx.fillStyle = z.color; ctx.fillRect(z.x, z.y, z.width, z.height); ctx.fillStyle = '#dc3545'; ctx.fillRect(z.x, z.y - 10, z.width, 5); ctx.fillStyle = '#28a745'; ctx.fillRect(z.x, z.y - 10, z.width * (z.health / ZOMBIE_CONFIG.health), 5); });
        if (player) {
            ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2); ctx.rotate(player.angle);
            ctx.fillStyle = player.rageModeActive ? RAGE_PACK_CONFIG.color : '#007bff';
            ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(player.width / 2 + 10, 0); ctx.stroke();
            ctx.restore();
            if (player.weapons[1].swinging) {
                ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2); ctx.rotate(player.angle);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, MELEE_CONFIG.range, -MELEE_CONFIG.arc / 2, MELEE_CONFIG.arc / 2); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }
    }

    // --- UI & Game Flow ---
    function togglePause() {
        if (!gameRunning) return;
        isPaused = !isPaused;
        pauseScreen.classList.toggle('hidden');
        if (isPaused) {
            pauseIcon.classList.add('hidden');
            playIcon.classList.remove('hidden');
        } else {
            pauseIcon.classList.remove('hidden');
            playIcon.classList.add('hidden');
        }
    }

    function updateUI() {
        if (!player) return;
        healthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
        if (player.currentWeapon === 0) {
            const gun = player.weapons[0];
            if (player.rageModeActive) {
                ammoCountEl.textContent = '∞';
            } else if (!gun.reloading) {
                ammoCountEl.textContent = `${gun.ammo} / ${gun.maxAmmo}`;
            }
            ammoCountEl.style.display = 'flex';
            weapon1Slot.classList.add('active');
            weapon2Slot.classList.remove('active');
        } else {
            ammoCountEl.style.display = 'none';
            weapon1Slot.classList.remove('active');
            weapon2Slot.classList.add('active');
        }
        waveCounterEl.textContent = `Wave: ${wave}`;
        scoreCounterEl.textContent = `Score: ${score}`;
    }
    
    function gameOver() {
        gameRunning = false;
        if (healthPackInterval) clearInterval(healthPackInterval);
        if (ragePackInterval) clearInterval(ragePackInterval);
        cancelAnimationFrame(animationFrameId);
        finalScoreEl.textContent = `Your Score: ${score}`;
        tauntTextEl.textContent = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
        gameOverScreen.classList.remove('hidden');
    }

    function gameLoop() {
        if (!isPaused && gameRunning) update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- Initial call ---
    resizeCanvas();
    // Show only pause icon initially
    pauseIcon.classList.remove('hidden');
    playIcon.classList.add('hidden');
});
