// ============================================================
// 1. GLOBAL DEĞİŞKENLER VE NAVİGASYON
// ============================================================
let serialPort = null;
let serialWriter = null;
let keepReading = false;

function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (id !== 'games') stopCurrentGame();
}

// Konsola Yazdırma Yardımcısı
function logConsole(msg, isError = false) {
    const c = document.getElementById('serialConsole');
    if (c) {
        const color = isError ? '#ff5252' : '#00e676';
        c.innerHTML += `<div><span style="color:${color}">></span> ${msg}</div>`;
        c.scrollTop = c.scrollHeight;
    } else {
        console.log(msg);
    }
}

// ============================================================
// 2. GITHUB VERİLERİNİ ÇEKME
// ============================================================
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    if(!container) return;
    const gizlenecekler = ["SalihAyvaci21", "portfolyo"];

    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&direction=desc`);
        const repos = await response.json();
        container.innerHTML = '';
        repos.forEach(repo => {
            if (gizlenecekler.includes(repo.name)) return;
            const lang = repo.language || 'Diğer';
            const desc = repo.description || 'Proje detayı yükleniyor...';
            container.innerHTML += `<div class="card"><div class="card-header"><h3><i class="fas fa-code-branch"></i> ${repo.name}</h3><a href="${repo.html_url}" target="_blank" class="repo-link"><i class="fas fa-external-link-alt"></i></a></div><p>${desc}</p><div class="tech-stack"><span class="tech-tag">${lang}</span><span class="tech-tag"><i class="far fa-star"></i> ${repo.stargazers_count}</span></div></div>`;
        });
    } catch (e) { console.error(e); }
}
window.onload = fetchGithubRepos;

// ============================================================
// 3. FİRMWARE YÜKLEME (HEX DOSYASINI OKUYUP YÜKLER)
// ============================================================
async function flashFirmware() {
    const btn = document.getElementById('btnFlash');
    
    // Bağlantı açıksa uyar
    if (serialPort) {
        alert("Yükleme yapmadan önce 'Bağlantıyı Kes' butonuna basmalısınız.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İndiriliyor...';
    }
    logConsole("Dosya: 'firmware.hex' sunucudan isteniyor...");

    try {
        // 1. firmware.hex dosyasını oku
        const response = await fetch('firmware.hex');
        if (!response.ok) throw new Error("firmware.hex dosyası bulunamadı!");
        
        // Avrgirl arrayBuffer ister
        const fileBuffer = await response.arrayBuffer();

        // 2. Yüklemeyi Başlat
        logConsole("Port seçin ve yüklemeyi onaylayın...");
        if(btn) btn.innerHTML = '<i class="fas fa-microchip"></i> Yükleniyor...';

        const avrgirl = new AvrgirlArduino({
            board: 'uno',
            debug: true
        });

        avrgirl.flash(fileBuffer, (error) => {
            if (error) {
                logConsole("Hata: " + error.message, true);
                alert("Yükleme Başarısız: " + error.message);
            } else {
                logConsole("BAŞARILI: Firmware yüklendi!");
                alert("Kod başarıyla yüklendi. Şimdi 'Bağlan' diyerek LED'i kontrol edebilirsiniz.");
            }
            
            // Butonu sıfırla
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-microchip"></i> Firmware Yükle (Hex)';
            }
        });

    } catch (err) {
        logConsole("Hata: " + err.message, true);
        alert("İşlem Hatası: " + err.message);
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-microchip"></i> Firmware Yükle (Hex)';
        }
    }
}

// ============================================================
// 4. SERİ PORT BAĞLANTISI VE KONTROL
// ============================================================

// BAĞLAN
async function connectSerial() {
    if (!navigator.serial) {
        alert("Tarayıcınız Web Serial API desteklemiyor. (Chrome/Edge kullanın)");
        return;
    }

    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        // Yazıcıyı ayarla
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();

        // UI Güncelle
        document.getElementById('btnConnect').style.display = 'none';
        document.getElementById('btnDisconnect').style.display = 'inline-flex';
        
        const badge = document.getElementById('statusBadge');
        badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.6rem;"></i> Bağlandı';
        badge.classList.add('connected');
        badge.style.color = "#00e676";

        logConsole("Seri port bağlantısı kuruldu.");

    } catch (err) {
        console.error(err);
        logConsole("Bağlantı hatası: " + err.message, true);
        alert("Bağlanılamadı: " + err.message);
    }
}

// BAĞLANTIYI KES
async function disconnectSerial() {
    if (!serialPort) return;

    try {
        if (serialWriter) {
            await serialWriter.releaseLock();
            serialWriter = null;
        }
        await serialPort.close();
        serialPort = null;

        // UI Güncelle
        document.getElementById('btnConnect').style.display = 'inline-flex';
        document.getElementById('btnDisconnect').style.display = 'none';

        const badge = document.getElementById('statusBadge');
        badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.6rem;"></i> Bağlantı Yok';
        badge.classList.remove('connected');
        badge.style.color = "#aaa";

        logConsole("Bağlantı kesildi.");

    } catch (err) {
        console.error(err);
        alert("Keserken hata oluştu: " + err.message);
    }
}

// KOMUT GÖNDER (LED Kontrolü için)
async function sendSerialCommand(charToSend) {
    if (!serialWriter) {
        alert("Lütfen önce 'Bağlan' butonuna basın.");
        return;
    }

    try {
        await serialWriter.write(charToSend);
        let action = (charToSend === '1') ? "LED YAKILDI" : "LED SÖNDÜRÜLDÜ";
        logConsole(`Gönderildi: ${charToSend} -> ${action}`);
    } catch (err) {
        logConsole("Gönderme Hatası: " + err.message, true);
        // Bağlantı kopmuş olabilir
        disconnectSerial(); 
    }
}

// ============================================================
// 5. OYUNLAR (SNAKE, TETRIS, MAZE)
// ============================================================
let canvas = document.getElementById('gameCanvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let gameInterval, currentGame, score = 0;

function stopCurrentGame() {
    if(!ctx) return;
    clearInterval(gameInterval);
    ctx.clearRect(0, 0, 400, 400);
    currentGame = null;
    document.getElementById('gameControls').innerText = "Oynamak için bir oyun seçin";
}

function startGame(t, b) {
    if(!ctx) return;
    stopCurrentGame();
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active-game'));
    if(b) b.classList.add('active-game');
    score = 0;
    const sb = document.getElementById('scoreBoard');
    if(sb) sb.innerText = "SKOR: 0";
    
    if (t === 'snake') { initSnake(); document.getElementById('gameControls').innerText = "Yön Tuşları ile Yılanı Yönet"; }
    if (t === 'tetris') { initTetris(); document.getElementById('gameControls').innerText = "Yön Tuşları ile Blokları Yönet"; }
    if (t === 'maze') { initMaze(); document.getElementById('gameControls').innerText = "Mavi Bloklardan Kaç, Sarı Hedefe Git"; }
}

// 1. SNAKE OYUNU
function initSnake() {
    currentGame = 'snake';
    let snake = [{ x: 10, y: 10 }], apple = { x: 15, y: 15 }, xv = 0, yv = 0;
    document.onkeydown = e => {
        if (currentGame !== 'snake') return;
        if (e.keyCode == 37 && xv != 1) { xv = -1; yv = 0 }
        if (e.keyCode == 38 && yv != 1) { xv = 0; yv = -1 }
        if (e.keyCode == 39 && xv != -1) { xv = 1; yv = 0 }
        if (e.keyCode == 40 && yv != -1) { xv = 0; yv = 1 }
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
    gameInterval = setInterval(() => {
        let h = { x: snake[0].x + xv, y: snake[0].y + yv };
        if (h.x < 0) h.x = 19; if (h.x > 19) h.x = 0; if (h.y < 0) h.y = 19; if (h.y > 19) h.y = 0;
        for (let i = 0; i < snake.length; i++) if (snake[i].x == h.x && snake[i].y == h.y) { score = 0; snake = [{ x: 10, y: 10 }]; xv = 0; yv = 0; }
        snake.unshift(h);
        if (h.x == apple.x && h.y == apple.y) {
            score += 10;
            document.getElementById('scoreBoard').innerText = "SKOR: " + score;
            apple = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
        } else snake.pop();
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(apple.x * 20, apple.y * 20, 18, 18);
        ctx.fillStyle = '#00ff88'; for (let p of snake) ctx.fillRect(p.x * 20, p.y * 20, 18, 18);
    }, 100);
}

// 2. TETRIS OYUNU
function initTetris() {
    currentGame = 'tetris';
    let board = Array(20).fill().map(() => Array(10).fill(0)), piece = { m: [[[1]]], x: 3, y: 0, c: '#fff' };
    const SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 1]]];
    function newPiece() { piece = { m: SHAPES[Math.floor(Math.random() * 5)], x: 3, y: 0, c: ['#0f8', '#f05', '#70f'][Math.floor(Math.random() * 3)] }; if (collide()) board.forEach(r => r.fill(0)); }
    function collide() { return piece.m.some((r, y) => r.some((v, x) => v && (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0)); }
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400); ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        board.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = '#333'; ctx.fillRect(x * 20 + 100, y * 20, 19, 19); } }));
        piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = piece.c; ctx.fillRect((x + piece.x) * 20 + 100, (y + piece.y) * 20, 19, 19); } }));
    }
    function update() {
        piece.y++;
        if (collide()) {
            piece.y--; piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) board[y + piece.y][x + piece.x] = 1; }));
            for (let y = 19; y > 0; y--) if (board[y].every(x => x)) { board.splice(y, 1); board.unshift(Array(10).fill(0)); score += 100; y++; } newPiece();
        } draw();
    }
    newPiece(); gameInterval = setInterval(update, 500);
    document.onkeydown = e => {
        if (currentGame !== 'tetris') return;
        if (e.keyCode == 37) { piece.x--; if (collide()) piece.x++ }
        if (e.keyCode == 39) { piece.x++; if (collide()) piece.x-- }
        if (e.keyCode == 40) update();
        if (e.keyCode == 38) { let old = piece.m; piece.m = piece.m[0].map((_, i) => piece.m.map(r => r[i]).reverse()); if (collide()) piece.m = old; } draw();
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
}

// 3. MAZE OYUNU
function initMaze() {
    currentGame = 'maze';
    let map = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 0, 0, 0, 1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 0, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], [1, 0, 1, 1, 1, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]];
    let p = { x: 1, y: 1 }, g = { x: 8, y: 5 };
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) { if (map[y][x] == 1) { ctx.fillStyle = '#03c'; ctx.fillRect(x * 40, y * 40, 40, 40); } else if (map[y][x] == 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x * 40 + 20, y * 40 + 20, 4, 0, 6.28); ctx.fill(); } }
        ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(p.x * 40 + 20, p.y * 40 + 20, 15, 0.6, 5.6); ctx.fill(); ctx.fillStyle = '#f00'; ctx.fillRect(g.x * 40 + 5, g.y * 40 + 5, 30, 30);
    }
    gameInterval = setInterval(() => {
        if (Math.random() > 0.5) {
            let m = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(d => map[g.y + d.y][g.x + d.x] != 1);
            if (m.length) { let nm = m[Math.floor(Math.random() * m.length)]; g.x += nm.x; g.y += nm.y; }
        }
        if (p.x == g.x && p.y == g.y) { score = 0; p = { x: 1, y: 1 }; g = { x: 8, y: 5 }; alert("Yakaladın!"); } draw();
    }, 500);
    document.onkeydown = e => {
        if (currentGame !== 'maze') return;
        let nx = p.x, ny = p.y;
        if (e.keyCode == 37) nx--; if (e.keyCode == 39) nx++; if (e.keyCode == 38) ny--; if (e.keyCode == 40) ny++;
        if (map[ny][nx] != 1) { p.x = nx; p.y = ny; if (map[ny][nx] == 0) { score += 10; map[ny][nx] = 2; document.getElementById('scoreBoard').innerText = "SKOR: " + score; } } draw();
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
    draw();
}
