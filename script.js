// --- NAVİGASYON ---
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id !== 'games') stopCurrentGame(); 
}

// --- GITHUB API ---
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    
    // GİZLENECEK PROJELER LİSTESİ (Buraya istemediklerini yazabilirsin)
    const gizlenecekProjeler = [
        "SalihAyvaci21",  // Profil repon
        "portfolyo"       // Sitenin kendisi
    ];

    const ozelAciklamalar = {
        "PixelJump": "Unity ve C# ile geliştirilmiş; prosedürel platform üretimi ve animasyon durum makinesi içeren 2D sonsuz koşu oyunu.",
        "fpga-verilog-examples": "Yosys ve Cologne Chip toolchain kullanılarak geliştirilmiş temel Verilog FPGA uygulamaları (LED chase, clock divider).",
        "USB-Hub-PD-Controller": "USB-C PD desteği sunan; TUSB8044 kontrolcüsü ile 4 portlu (USB-A/C, FTDI, ST-Link) PCB tasarımı.",
        "Verilog-Full-Adder-8bit": "Verilog HDL ile tasarlanmış; clock sinyaliyle senkronize bit-bit toplama yapan öğretici 8-bit tam toplayıcı modülü.",
        "STM32F405-Flight-Controller": "STM32F405 MCU tabanlı; dahili ST-LINK, MPU9250 IMU ve GPS entegrasyonuna sahip uçuş kontrol kartı.",
        "AC-DC-Power-Supply": "115-250V AC girişten 24V 5A izole DC çıkış sağlayan Half-Bridge topolojili güç kaynağı tasarımı.",
        "Drone-Power-Distribution": "Drone ve atölye için LM2595 ve LM7805 regülatörlü, asit baskı üretimine uygun güç dağıtım kartı.",
        "ESCTasarim": "ATmega328P ve IR2103 tabanlı, sandviç PCB yapısına (2x2 katman) sahip, 6S 40A test edilmiş BLDC motor sürücüsü.",
        "button_led_toggle": "FPGA üzerinde buton gürültüsünü filtreleyen Debounce IP Core ile geliştirilmiş LED toggle uygulaması."
    };

    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&direction=desc`);
        const repos = await response.json();
        container.innerHTML = ''; 
        
        repos.forEach(repo => {
            // FİLTRELEME: Eğer repo ismi gizlenecekler listesindeyse, bunu atla (return)
            if (gizlenecekProjeler.includes(repo.name)) return;

            const lang = repo.language ? repo.language : 'Diğer';
            const desc = ozelAciklamalar[repo.name] || repo.description || 'Proje detayı yükleniyor...';
            
            const cardHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-code-branch"></i> ${repo.name}</h3><a href="${repo.html_url}" target="_blank" class="repo-link"><i class="fas fa-external-link-alt"></i></a></div><p>${desc}</p><div class="tech-stack"><span class="tech-tag">${lang}</span><span class="tech-tag"><i class="far fa-star"></i> ${repo.stargazers_count}</span></div></div>`;
            container.innerHTML += cardHTML;
        });
    } catch (error) { console.error(error); }
}
window.onload = fetchGithubRepos;

// ==========================================
// WEB SERIAL API (DÜZELTİLMİŞ & EĞİTİM MODU)
// ==========================================
let port;
let writer;
let blinkInterval;

async function connectSerial() {
    if (!("serial" in navigator)) {
        logConsole("⚠️ Tarayıcınız desteklemiyor (Chrome kullanın).");
        // Rozeti Güncelle
const badge = document.getElementById('statusBadge');
badge.innerHTML = '<i class="fas fa-check-circle" style="font-size:0.6rem;"></i> Bağlandı';
badge.classList.add('connected');
        return;
    }
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();
        
        logConsole("✅ Arduino Bağlandı! Blokları kullanabilirsiniz.");
        document.getElementById('btnConnect').style.display = 'none'; 
        document.getElementById('btnDisconnect').style.display = 'inline-block'; 
        
    } catch (err) {
        logConsole("❌ Hata: " + err);
        document.getElementById('btnConnect').style.display = 'inline-block';
        document.getElementById('btnDisconnect').style.display = 'none';
    }
}

async function disconnectSerial() {
    try {
        if (writer) { await writer.releaseLock(); writer = null; }
        if (port) { await port.close(); port = null; }
        logConsole("🔌 Bağlantı Kesildi.");
        // Rozeti Eski Haline Getir
const badge = document.getElementById('statusBadge');
badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.6rem;"></i> Bağlantı Yok';
badge.classList.remove('connected');
    } catch (err) { logConsole("⚠️ Hata oluştu, sayfayı yenileyin."); }
    
    document.getElementById('btnConnect').style.display = 'inline-block';
    document.getElementById('btnDisconnect').style.display = 'none';
    
    if(blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
}

async function sendCommand(cmd) {
    if (!writer) { logConsole("⚠️ Önce cihazı bağlayın!"); return; }
    try { await writer.write(cmd + "\n"); logConsole("📤 Gönderildi: " + cmd); } 
    catch (err) { logConsole("❌ Hata: " + err); disconnectSerial(); }
}

function runBlock(action) {
    if (action === 'ON') { let pin = document.getElementById('pinSelectOn').value; sendCommand(`PIN:${pin}:1`); } 
    else if (action === 'OFF') { let pin = document.getElementById('pinSelectOff').value; sendCommand(`PIN:${pin}:0`); }
}

function toggleBlink() {
    if (blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; logConsole("⏹️ Blink Durduruldu."); } 
    else {
        if(!writer) { logConsole("⚠️ Önce Arduino'yu bağlayın!"); return; }
        let pin = document.getElementById('pinSelectBlink').value; let state = 1;
        logConsole("▶️ Blink Başlatıldı (Pin " + pin + ")");
        blinkInterval = setInterval(() => { sendCommand(`PIN:${pin}:${state}`); state = (state === 1) ? 0 : 1; }, 1000);
    }
}

function logConsole(msg) {
    const consoleDiv = document.getElementById('serialConsole');
    consoleDiv.innerHTML = `<div>> ${msg}</div>` + consoleDiv.innerHTML;
}

// ==========================================
// OYUNLAR
// ==========================================
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
let gameInterval;
let currentGame = null;
let score = 0;

function stopCurrentGame() {
    clearInterval(gameInterval);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentGame = null;
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active-game'));
}

function startGame(type, btnElement) {
    stopCurrentGame();
    btnElement.classList.add('active-game');
    score = 0;
    document.getElementById('scoreBoard').innerText = "SKOR: 0";
    
    if (type === 'snake') initSnake();
    else if (type === 'tetris') initTetris();
    else if (type === 'maze') initMaze();
}

// 1. CYBER SNAKE
function initSnake() {
    currentGame = 'snake';
    document.getElementById('gameControls').innerText = "Yön Tuşları ile Oyna";
    let gridSize = 20; let tileCount = 20; 
    let snake = [{x: 10, y: 10}]; let apple = {x: 15, y: 15};
    let xv = 0, yv = 0;

    document.onkeydown = function(e) {
        if(currentGame !== 'snake') return;
        switch(e.keyCode) {
            case 37: if(xv!==1) {xv=-1; yv=0;} break;
            case 38: if(yv!==1) {xv=0; yv=-1;} break;
            case 39: if(xv!==-1) {xv=1; yv=0;} break;
            case 40: if(yv!==-1) {xv=0; yv=1;} break;
        }
        if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
    };

    gameInterval = setInterval(() => {
        let head = {x: snake[0].x + xv, y: snake[0].y + yv};
        if(head.x < 0) head.x = tileCount-1; if(head.x >= tileCount) head.x = 0;
        if(head.y < 0) head.y = tileCount-1; if(head.y >= tileCount) head.y = 0;

        for(let i=0; i<snake.length; i++) if(snake[i].x === head.x && snake[i].y === head.y) { score=0; snake=[{x:10,y:10}]; xv=0; yv=0; }
        snake.unshift(head);
        if(head.x === apple.x && head.y === apple.y) { score+=10; document.getElementById('scoreBoard').innerText = "SKOR: "+score; apple.x = Math.floor(Math.random()*tileCount); apple.y = Math.floor(Math.random()*tileCount); } 
        else snake.pop();

        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(apple.x*gridSize, apple.y*gridSize, gridSize-2, gridSize-2);
        ctx.fillStyle = '#00ff88'; for(let i=0; i<snake.length; i++) ctx.fillRect(snake[i].x*gridSize, snake[i].y*gridSize, gridSize-2, gridSize-2);
    }, 100);
}

// 2. NEON BLOCKS
function initTetris() {
    currentGame = 'tetris';
    document.getElementById('gameControls').innerText = "Yön Tuşları ile Oyna";
    const COLS = 10, ROWS = 20, BLOCK_SIZE = 20;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    let board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
    const SHAPES = [[[1,1,1,1]], [[1,1],[1,1]], [[1,1,1],[0,1,0]], [[1,1,1],[1,0,0]], [[1,1,0],[0,1,1]]];
    let piece = { matrix: SHAPES[0], x: 3, y: 0, color: '#7000ff' };

    function drawMatrix(matrix, offset) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = offset.color || '#00ff88';
                    ctx.fillRect((x + offset.x) * BLOCK_SIZE + 100, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                    ctx.strokeStyle = '#fff';
                    ctx.strokeRect((x + offset.x) * BLOCK_SIZE + 100, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                }
            });
        });
    }
    function collide(board, piece) {
        const m = piece.matrix;
        for (let y = 0; y < m.length; ++y) for (let x = 0; x < m[y].length; ++x) 
            if (m[y][x] !== 0 && (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0) return true;
        return false;
    }
    function resetPiece() {
        piece.matrix = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        piece.y = 0; piece.x = 3; piece.color = ['#00ff88', '#ff0055', '#7000ff'][Math.floor(Math.random()*3)];
        if (collide(board, piece)) { board.forEach(row => row.fill(0)); score = 0; }
    }
    function arenaSweep() {
        outer: for (let y = board.length - 1; y > 0; --y) {
            for (let x = 0; x < board[y].length; ++x) if (board[y][x] === 0) continue outer;
            const row = board.splice(y, 1)[0].fill(0); board.unshift(row); ++y; score += 100;
            document.getElementById('scoreBoard').innerText = "SKOR: " + score;
        }
    }
    function update() {
        piece.y++;
        if (collide(board, piece)) { piece.y--; 
            piece.matrix.forEach((row, y) => row.forEach((value, x) => { if(value!==0) board[y + piece.y][x + piece.x] = 1; }));
            resetPiece(); arenaSweep(); 
        }
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        drawMatrix(board, {x:0, y:0, color:'#333'}); drawMatrix(piece.matrix, piece);
    }
    gameInterval = setInterval(update, 500);
    document.onkeydown = function(e) {
        if(currentGame !== 'tetris') return;
        if(e.keyCode === 37) { piece.x--; if(collide(board, piece)) piece.x++; }
        if(e.keyCode === 39) { piece.x++; if(collide(board, piece)) piece.x--; }
        if(e.keyCode === 40) update();
        if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        drawMatrix(board, {x:0, y:0, color:'#333'}); drawMatrix(piece.matrix, piece);
    };
}

// 3. MAZE CHASE
function initMaze() {
    currentGame = 'maze';
    document.getElementById('gameControls').innerText = "Yön Tuşları ile oyna, Kırmızıdan kaç!";
    let map = [[1,1,1,1,1,1,1,1,1,1], [1,0,0,0,1,0,0,0,0,1], [1,0,1,0,1,0,1,1,0,1], [1,0,1,0,0,0,0,0,0,1], [1,0,0,0,1,1,1,1,0,1], [1,0,1,0,0,0,0,0,0,1], [1,0,1,1,1,0,1,1,0,1], [1,0,0,0,0,0,0,0,0,1], [1,1,1,1,1,1,1,1,1,1]];
    let tileSize = 40; let player = {x: 1, y: 1}; let ghost = {x: 8, y: 7};

    function drawMap() {
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width, canvas.height);
        for(let y=0; y<map.length; y++) for(let x=0; x<map[y].length; x++) {
            if(map[y][x] === 1) { ctx.fillStyle = '#0033cc'; ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize); }
            else if(map[y][x] === 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x*tileSize+20, y*tileSize+20, 4, 0, Math.PI*2); ctx.fill(); }
        }
        ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(player.x*tileSize+20, player.y*tileSize+20, 15, 0.2*Math.PI, 1.8*Math.PI); ctx.lineTo(player.x*tileSize+20, player.y*tileSize+20); ctx.fill();
        ctx.fillStyle = '#ff0000'; ctx.fillRect(ghost.x*tileSize+5, ghost.y*tileSize+5, 30, 30);
    }
    function moveGhost() {
        let dx = player.x - ghost.x; let dy = player.y - ghost.y;
        let moves = [];
        if(map[ghost.y][ghost.x+1] !== 1) moves.push({x:1, y:0});
        if(map[ghost.y][ghost.x-1] !== 1) moves.push({x:-1, y:0});
        if(map[ghost.y+1][ghost.x] !== 1) moves.push({x:0, y:1});
        if(map[ghost.y-1][ghost.x] !== 1) moves.push({x:0, y:-1});
        if(moves.length>0) { let m = moves[Math.floor(Math.random()*moves.length)]; ghost.x+=m.x; ghost.y+=m.y; }
        if(ghost.x===player.x && ghost.y===player.y) { alert("Yakaladın!"); score=0; player={x:1,y:1}; ghost={x:8,y:7}; }
    }
    gameInterval = setInterval(() => { moveGhost(); drawMap(); }, 500);
    document.onkeydown = function(e) {
        if(currentGame!=='maze') return;
        let nx=player.x; let ny=player.y;
        if(e.keyCode===37) nx--; if(e.keyCode===39) nx++; if(e.keyCode===38) ny--; if(e.keyCode===40) ny++;
        if(map[ny][nx]!==1) { player.x=nx; player.y=ny; if(map[ny][nx]===0) { map[ny][nx]=2; score+=10; document.getElementById('scoreBoard').innerText="SKOR: "+score; } }
        drawMap(); if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
    };
    drawMap();
}
