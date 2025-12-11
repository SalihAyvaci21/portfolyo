// --- NAVİGASYON ---
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id !== 'games') stopCurrentGame(); 
}

// --- GITHUB REPO ÇEKME (API) ---
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    
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
            const lang = repo.language ? repo.language : 'Diğer';
            const desc = ozelAciklamalar[repo.name] || repo.description || 'Bu proje için henüz detaylı açıklama eklenmedi.';
            const cardHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-code-branch"></i> ${repo.name}</h3><a href="${repo.html_url}" target="_blank" class="repo-link"><i class="fas fa-external-link-alt"></i></a></div><p>${desc}</p><div class="tech-stack"><span class="tech-tag">${lang}</span><span class="tech-tag"><i class="far fa-star"></i> ${repo.stargazers_count}</span></div></div>`;
            container.innerHTML += cardHTML;
        });
    } catch (error) { console.error(error); }
}
window.onload = fetchGithubRepos;

// ==========================================
// WEB SERIAL API (IOT LAB)
// ==========================================
let port;
let writer;

async function connectSerial() {
    if (!("serial" in navigator)) {
        logConsole("⚠️ Tarayıcınız Web Serial API desteklemiyor (Chrome kullanın).");
        return;
    }

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        logConsole("✅ Cihaz bağlandı! Port açık (115200 baud).");
        document.getElementById('btnConnect').innerText = "Bağlandı";
        document.getElementById('btnConnect').disabled = true;
        document.getElementById('btnLedOn').disabled = false;
        document.getElementById('btnLedOff').disabled = false;

    } catch (err) {
        logConsole("❌ Bağlantı hatası: " + err);
    }
}

async function sendSerial(data) {
    if (writer) {
        await writer.write(data);
        logConsole("📤 Gönderildi: " + (data === '1' ? "LED AÇ" : "LED KAPAT"));
    }
}

function logConsole(msg) {
    const consoleDiv = document.getElementById('serialConsole');
    const time = new Date().toLocaleTimeString();
    consoleDiv.innerHTML += `<div><span style="color:#666">[${time}]</span> ${msg}</div>`;
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// ==========================================
// OYUN MOTORU
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

// --- 1. CYBER SNAKE ---
function initSnake() {
    currentGame = 'snake';
    document.getElementById('gameControls').innerText = "Yön Tuşları ile Oyna";
    let gridSize = 20;
    let tileCount = 20; // 400px / 20 = 20
    let snake = [{x: 10, y: 10}];
    let apple = {x: 15, y: 15};
    let xv = 0, yv = 0;

    document.onkeydown = function(e) {
        if(currentGame !== 'snake') return;
        switch(e.keyCode) {
            case 37: if(xv!==1) {xv=-1; yv=0;} break; // Sol
            case 38: if(yv!==1) {xv=0; yv=-1;} break; // Yukarı
            case 39: if(xv!==-1) {xv=1; yv=0;} break; // Sağ
            case 40: if(yv!==-1) {xv=0; yv=1;} break; // Aşağı
        }
        if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
    };

    gameInterval = setInterval(() => {
        let head = {x: snake[0].x + xv, y: snake[0].y + yv};
        if(head.x < 0) head.x = tileCount-1;
        if(head.x >= tileCount) head.x = 0;
        if(head.y < 0) head.y = tileCount-1;
        if(head.y >= tileCount) head.y = 0;

        for(let i=0; i<snake.length; i++) {
            if(snake[i].x === head.x && snake[i].y === head.y) {
                score = 0;
                snake = [{x:10,y:10}];
                xv=0; yv=0;
            }
        }

        snake.unshift(head);
        if(head.x === apple.x && head.y === apple.y) {
            score += 10;
            document.getElementById('scoreBoard').innerText = "SKOR: " + score;
            apple.x = Math.floor(Math.random()*tileCount);
            apple.y = Math.floor(Math.random()*tileCount);
        } else {
            snake.pop();
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#ff0055'; 
        ctx.fillRect(apple.x*gridSize, apple.y*gridSize, gridSize-2, gridSize-2);
        ctx.fillStyle = '#00ff88'; 
        for(let i=0; i<snake.length; i++) {
            ctx.fillRect(snake[i].x*gridSize, snake[i].y*gridSize, gridSize-2, gridSize-2);
        }
    }, 100);
}

// --- 2. NEON BLOCKS ---
function initTetris() {
    currentGame = 'tetris';
    document.getElementById('gameControls').innerText = "Yön Tuşları: Hareket/Döndür | Aşağı: Hızlandır";
    
    const COLS = 10, ROWS = 20, BLOCK_SIZE = 20;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
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

    function merge(board, piece) {
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) board[y + piece.y][x + piece.x] = 1;
            });
        });
    }

    function collide(board, piece) {
        const m = piece.matrix;
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0) return true;
            }
        }
        return false;
    }

    function resetPiece() {
        piece.matrix = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        piece.y = 0; piece.x = 3;
        piece.color = ['#00ff88', '#ff0055', '#7000ff'][Math.floor(Math.random()*3)];
        if (collide(board, piece)) {
            board.forEach(row => row.fill(0));
            score = 0;
            document.getElementById('scoreBoard').innerText = "Oyun Bitti! Skor: " + score;
        }
    }

    function arenaSweep() {
        outer: for (let y = board.length - 1; y > 0; --y) {
            for (let x = 0; x < board[y].length; ++x) if (board[y][x] === 0) continue outer;
            const row = board.splice(y, 1)[0].fill(0);
            board.unshift(row);
            ++y;
            score += 100;
            document.getElementById('scoreBoard').innerText = "SKOR: " + score;
        }
    }

    function rotate(matrix) {
        for (let y = 0; y < matrix.length; ++y) for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        matrix.forEach(row => row.reverse());
    }

    function update() {
        piece.y++;
        if (collide(board, piece)) {
            piece.y--;
            merge(board, piece);
            resetPiece();
            arenaSweep();
        }
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        drawMatrix(board, {x:0, y:0, color:'#333'});
        drawMatrix(piece.matrix, piece);
    }

    gameInterval = setInterval(update, 500);

    document.onkeydown = function(e) {
        if(currentGame !== 'tetris') return;
        if(e.keyCode === 37) { piece.x--; if(collide(board, piece)) piece.x++; }
        else if(e.keyCode === 39) { piece.x++; if(collide(board, piece)) piece.x--; }
        else if(e.keyCode === 40) { piece.y++; if(collide(board, piece)) { piece.y--; merge(board, piece); resetPiece(); arenaSweep(); } }
        else if(e.keyCode === 38) { rotate(piece.matrix); if(collide(board, piece)) { rotate(piece.matrix); rotate(piece.matrix); rotate(piece.matrix); } }
        if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        drawMatrix(board, {x:0, y:0, color:'#333'});
        drawMatrix(piece.matrix, piece);
    };
}

// --- 3. MAZE CHASE ---
function initMaze() {
    currentGame = 'maze';
    document.getElementById('gameControls').innerText = "Yön Tuşları ile noktaları topla. Kırmızıdan kaç!";
    let map = [
        [1,1,1,1,1,1,1,1,1,1], [1,0,0,0,1,0,0,0,0,1], [1,0,1,0,1,0,1,1,0,1],
        [1,0,1,0,0,0,0,0,0,1], [1,0,0,0,1,1,1,1,0,1], [1,0,1,0,0,0,0,0,0,1],
        [1,0,1,1,1,0,1,1,0,1], [1,0,0,0,0,0,0,0,0,1], [1,1,1,1,1,1,1,1,1,1]
    ];
    let tileSize = 40;
    let player = {x: 1, y: 1};
    let ghost = {x: 8, y: 7};

    function drawMap() {
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width, canvas.height);
        for(let y=0; y<map.length; y++) {
            for(let x=0; x<map[y].length; x++) {
                if(map[y][x] === 1) { ctx.fillStyle = '#0033cc'; ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize); }
                else if(map[y][x] === 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x*tileSize + tileSize/2, y*tileSize + tileSize/2, 4, 0, Math.PI*2); ctx.fill(); }
            }
        }
        ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(player.x*tileSize + tileSize/2, player.y*tileSize + tileSize/2, 15, 0.2 * Math.PI, 1.8 * Math.PI); ctx.lineTo(player.x*tileSize + tileSize/2, player.y*tileSize + tileSize/2); ctx.fill();
        ctx.fillStyle = '#ff0000'; ctx.fillRect(ghost.x*tileSize + 5, ghost.y*tileSize + 5, tileSize-10, tileSize-10);
    }

    function moveGhost() {
        let dx = player.x - ghost.x;
        let dy = player.y - ghost.y;
        let possibleMoves = [];
        if(map[ghost.y][ghost.x+1] !== 1) possibleMoves.push({x:1, y:0});
        if(map[ghost.y][ghost.x-1] !== 1) possibleMoves.push({x:-1, y:0});
        if(map[ghost.y+1] && map[ghost.y+1][ghost.x] !== 1) possibleMoves.push({x:0, y:1});
        if(map[ghost.y-1] && map[ghost.y-1][ghost.x] !== 1) possibleMoves.push({x:0, y:-1});
        if(possibleMoves.length > 0) {
            let move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            ghost.x += move.x; ghost.y += move.y;
        }
        if(ghost.x === player.x && ghost.y === player.y) {
            alert("Yakaladın! Skor: " + score); score = 0; player = {x:1, y:1}; ghost = {x:8, y:7};
            for(let y=0; y<map.length; y++) for(let x=0; x<map[y].length; x++) if(map[y][x]===2) map[y][x]=0;
        }
    }

    gameInterval = setInterval(() => { moveGhost(); drawMap(); }, 500);

    document.onkeydown = function(e) {
        if(currentGame !== 'maze') return;
        let nextX = player.x; let nextY = player.y;
        if(e.keyCode === 37) nextX--; if(e.keyCode === 39) nextX++; if(e.keyCode === 38) nextY--; if(e.keyCode === 40) nextY++;
        if(map[nextY][nextX] !== 1) {
            player.x = nextX; player.y = nextY;
            if(map[nextY][nextX] === 0) { map[nextY][nextX] = 2; score += 10; document.getElementById('scoreBoard').innerText = "SKOR: " + score; }
        }
        drawMap();
        if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
    };
    drawMap();
}
