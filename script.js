// ==========================================
// GLOBAL DEĞİŞKENLER
// ==========================================
let compiledHexCode = null;
let serialPort = null;
let serialWriter = null;
let serialReader = null;
let isReading = false; 
let blinkInterval = null;
let portClosing = false; // Port kapanıyor mu kontrolü

// ==========================================
// 1. NAVİGASYON
// ==========================================
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (id !== 'games') stopCurrentGame();
    if (id === 'blockcoding') {
        setTimeout(() => { initBlockly(); if(workspace) Blockly.svgResize(workspace); }, 200);
    }
}

// ==========================================
// 2. GITHUB REPO
// ==========================================
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    if (!container) return;
    const hiddenRepos = [
        "SalihAyvaci21",    // Profil reposu
        "portfolyo",        // Bu sitenin kendisi
        "arduino-backend"   // Arka plan sunucu kodları
    ];
    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&direction=desc`);
        const repos = await response.json();
        container.innerHTML = '';
        repos.forEach(repo => {
            if (repo.name === "SalihAyvaci21") return;
            const lang = repo.language || 'Diğer';
            const desc = repo.description || 'Proje detayı yükleniyor...';
            container.innerHTML += `<div class="card"><div class="card-header"><h3><i class="fas fa-code-branch"></i> ${repo.name}</h3><a href="${repo.html_url}" target="_blank" class="repo-link"><i class="fas fa-external-link-alt"></i></a></div><p>${desc}</p><div class="tech-stack"><span class="tech-tag">${lang}</span><span class="tech-tag"><i class="far fa-star"></i> ${repo.stargazers_count}</span></div></div>`;
        });
    } catch (e) { console.error(e); }
}
window.onload = fetchGithubRepos;

// ==========================================
// 3. IOT: DERLEME
// ==========================================
async function compileCode() {
    const editorVal = document.getElementById('cppEditor').value;
    const boardType = document.getElementById('boardSelect').value;
    const statusLbl = document.getElementById('statusLabelNew');
    const btnUpload = document.getElementById('btnUploadNew');
    
    statusLbl.innerText = `Durum: ${boardType.toUpperCase()} için derleniyor...`;
    statusLbl.style.color = "#40c4ff";

    try {
        const response = await fetch('https://arduino-backend-et1z.onrender.com/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: editorVal, board: boardType })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.stderr || "Derleme Hatası");
        }
        
        const data = await response.json();

        if (data.hex) {
            compiledHexCode = data.hex;
            statusLbl.innerText = "Durum: BAŞARILI! Yüklemeye hazır.";
            statusLbl.style.color = "#00e676";
            btnUpload.disabled = false;
            btnUpload.style.background = "#ff9800";
            btnUpload.style.cursor = "pointer";
            btnUpload.classList.remove('off');
        } else {
            throw new Error("Hex kodu oluşmadı.");
        }
    } catch (err) {
        console.error(err);
        statusLbl.innerText = "Hata: " + err.message;
        statusLbl.style.color = "#ff5252";
    }
}

// ==========================================
// 4. IOT: YÜKLEME (OTOMATİK KESME VE TEMİZLEME)
// ==========================================
async function runUploader(hexDataToUse = null) {
    const hexToFlash = hexDataToUse || compiledHexCode;
    const boardType = document.getElementById('boardSelect').value;

    if (!hexToFlash) return alert("Önce kodu derlemelisiniz!");

    // --- ÖNEMLİ: Bağlantıyı KESMEDEN Yükleme Yapılamaz ---
    if (serialPort) {
        console.log("Yükleme için port kapatılıyor...");
        await disconnectSerial(true);
        // Portun kapanması için kısa bir süre tanı
        await new Promise(r => setTimeout(r, 500));
    }

    const statusLbl = document.getElementById('statusLabelNew');
    statusLbl.innerText = `Yükleniyor... Lütfen USB Portunu Seçin.`;
    statusLbl.style.color = "orange";

    try {
        const blob = new Blob([hexToFlash], { type: 'application/octet-stream' });
        const reader = new FileReader();

        reader.onload = function(event) {
            const fileBuffer = event.target.result;
            
            const avrgirl = new AvrgirlArduino({ 
                board: boardType === 'nano-old' ? 'nano' : boardType, 
                debug: true 
            });

            avrgirl.flash(fileBuffer, (error) => {
                if (error) {
                    console.error(error);
                    alert("Yükleme Hatası: " + error.message);
                    statusLbl.innerText = "Durum: Başarısız.";
                    statusLbl.style.color = "red";
                } else {
                    alert(`BAŞARILI! Kod yüklendi.`);
                    statusLbl.innerText = "Durum: Yüklendi - Bağlantı Bekleniyor.";
                    statusLbl.style.color = "#00e676";
                    updateUIIDisconnected();
                }
            });
        };
        reader.readAsArrayBuffer(blob);
    } catch (err) {
        alert("Hata: " + err);
    }
}

async function runQuickTest() {
    const btn = document.getElementById('btnQuickTest');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İndiriliyor...';
    try {
        const response = await fetch('firmware.hex');
        if (!response.ok) throw new Error("firmware.hex bulunamadı");
        const hexText = await response.text();
        btn.innerHTML = '<i class="fas fa-microchip"></i> Yükleniyor...';
        await runUploader(hexText);
        btn.innerHTML = originalText;
    } catch (err) {
        alert("Hata: " + err.message);
        btn.innerHTML = originalText;
    }
}

// ==========================================
// 6. SERİ PORT (GÜÇLÜ KİLİT YÖNETİMİ)
// ==========================================
async function connectSerial() {
    if (!navigator.serial) return alert("Tarayıcı desteklemiyor.");
    if (serialPort) return alert("Zaten bağlı!");

    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        // WRITER KURULUMU
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();

        // READER KURULUMU
        startReading();

        // UI GÜNCELLEME
        const badge = document.getElementById('statusBadge');
        if(badge) {
            badge.innerHTML = '<i class="fas fa-circle" style="color:#00e676; font-size:0.6rem;"></i> Bağlandı';
            badge.style.color = "#00e676";
        }
        document.getElementById('serialConsole').innerHTML += "<br>> <span style='color:#0f0'>Bağlantı Kuruldu!</span>";
        document.getElementById('btnConnect').style.display = 'none';
        document.getElementById('btnDisconnect').style.display = 'inline-flex';
        portClosing = false;

    } catch (err) { 
        console.error(err);
        alert("Bağlantı Hatası: " + err); 
        serialPort = null;
    }
}

async function startReading() {
    isReading = true;
    const textDecoder = new TextDecoderStream();
    // Portun okunabilir akışını decoder'a yönlendiriyoruz.
    // DİKKAT: readableStreamClosed promise'ini saklamıyoruz çünkü
    // reader.cancel() çağrıldığında zincirleme kapanacak.
    try {
        const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
        serialReader = textDecoder.readable.getReader();

        while (true) {
            const { value, done } = await serialReader.read();
            if (done) {
                // Okuyucu serbest bırakıldı
                break;
            }
            if (value) {
                // Gelen veriyi buraya yazabilirsin
                // console.log(value); 
            }
        }
    } catch (error) {
        // Port kapandığında buraya düşmesi normaldir.
        console.log("Okuma sonlandı:", error);
    } finally {
        if(serialReader) serialReader.releaseLock();
    }
}

// --- KRİTİK FONKSİYON: BAĞLANTI KESME ---
async function disconnectSerial(silent = false) {
    if (portClosing) return; // Zaten kapanıyorsa tekrar tetikleme
    portClosing = true;

    if(blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }

    try {
        // 1. Önce Okuyucuyu (Reader) İptal Et
        if (serialReader) {
            await serialReader.cancel(); 
            // cancel() işlemi startReading döngüsünü bitirir ve releaseLock() orada çağrılır.
            serialReader = null;
        }

        // 2. Yazıcıyı (Writer) Serbest Bırak
        if (serialWriter) {
            await serialWriter.releaseLock();
            serialWriter = null;
        }

        // 3. Portu Kapat
        if (serialPort) {
            await serialPort.close();
            serialPort = null;
        }
    } catch (e) {
        console.error("Port kapatma hatası (Zorla sıfırlanıyor):", e);
        // Hata olsa bile değişkenleri sıfırla ki kilitli kalmasın
        serialPort = null;
        serialWriter = null;
        serialReader = null;
    }

    portClosing = false;

    if(!silent) {
        updateUIIDisconnected();
        document.getElementById('serialConsole').innerHTML += "<br>> <span style='color:orange'>Bağlantı Kesildi.</span>";
    }
}

function updateUIIDisconnected() {
    const badge = document.getElementById('statusBadge');
    if(badge) {
        badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.6rem;"></i> Bağlantı Yok';
        badge.style.color = "#aaa";
    }
    document.getElementById('btnConnect').style.display = 'inline-flex';
    document.getElementById('btnDisconnect').style.display = 'none';
}

async function runBlock(command) {
    if (!serialWriter) return alert("Lütfen önce 'Bağlan' butonuna basın!");
    try {
        if(blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
        
        if (command === 'ON') {
            await serialWriter.write("1");
            document.getElementById('serialConsole').innerHTML += "<br>> LED AÇIK (1)";
        }
        else if (command === 'OFF') {
            await serialWriter.write("0");
            document.getElementById('serialConsole').innerHTML += "<br>> LED KAPALI (0)";
        }
        else if (command === 'BLINK') {
            document.getElementById('serialConsole').innerHTML += "<br>> BLINK MODU...";
            let toggle = false;
            blinkInterval = setInterval(async () => {
                if(!serialWriter) { clearInterval(blinkInterval); return; }
                toggle = !toggle;
                try { await serialWriter.write(toggle ? "1" : "0"); } catch(e){}
            }, 500); 
        }
    } catch (err) { alert("Gönderme Hatası: " + err); }
}

// ==========================================
// 7. OYUNLAR (DEĞİŞİKLİK YOK)
// ==========================================
let canvas = document.getElementById('gameCanvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let gameInterval, currentGame, score = 0;

window.addEventListener("keydown", function(e) {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        if (currentGame) e.preventDefault();
    }
}, false);

function stopCurrentGame() {
    if(!ctx) return;
    clearInterval(gameInterval);
    ctx.clearRect(0, 0, 400, 400);
    ctx.fillStyle = "#333";
    ctx.font = "20px Courier New";
    ctx.fillText("OYUN SEÇİNİZ", 130, 200);
    currentGame = null;
}
stopCurrentGame();

function startGame(t, b) {
    if(!ctx) return;
    stopCurrentGame();
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active-game'));
    if(b) b.classList.add('active-game');
    score = 0; updateScore(0);
    if (t === 'snake') initSnake();
    if (t === 'tetris') initTetris();
    if (t === 'maze') initMaze();
    if (t === 'pong') initPong();
    if (t === 'breakout') initBreakout();
}
function updateScore(val) {
    const sb = document.getElementById('scoreBoard');
    if(sb) sb.innerText = "SKOR: " + String(val).padStart(4, '0');
}
function handleControl(keyCode) {
    const event = new KeyboardEvent('keydown', {'keyCode': keyCode});
    document.onkeydown(event);
}
function handleControlRelease() {}

function initSnake() {
    currentGame = 'snake';
    let snake = [{ x: 10, y: 10 }], apple = { x: 15, y: 15 }, xv = 0, yv = 0;
    document.onkeydown = e => {
        if (currentGame !== 'snake') return;
        if (e.keyCode == 37 && xv != 1) { xv = -1; yv = 0 }
        if (e.keyCode == 38 && yv != 1) { xv = 0; yv = -1 }
        if (e.keyCode == 39 && xv != -1) { xv = 1; yv = 0 }
        if (e.keyCode == 40 && yv != -1) { xv = 0; yv = 1 }
    };
    gameInterval = setInterval(() => {
        let h = { x: snake[0].x + xv, y: snake[0].y + yv };
        if (h.x < 0) h.x = 19; if (h.x > 19) h.x = 0; if (h.y < 0) h.y = 19; if (h.y > 19) h.y = 0;
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x == h.x && snake[i].y == h.y) { score = 0; updateScore(0); snake = [{ x: 10, y: 10 }]; xv = 0; yv = 0; }
        }
        snake.unshift(h);
        if (h.x == apple.x && h.y == apple.y) {
            score += 10; updateScore(score);
            apple = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
        } else snake.pop();
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(apple.x * 20, apple.y * 20, 18, 18);
        ctx.fillStyle = '#00ff88'; for (let p of snake) ctx.fillRect(p.x * 20, p.y * 20, 18, 18);
        ctx.strokeStyle = '#111'; ctx.beginPath();
        for(let i=0; i<400; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.moveTo(0,i); ctx.lineTo(400,i); }
        ctx.stroke();
    }, 100);
}
function initTetris() {
    currentGame = 'tetris';
    let board = Array(20).fill().map(() => Array(10).fill(0));
    let piece = { m: [[[1]]], x: 3, y: 0, c: '#fff' };
    const SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 1]]];
    function newPiece() { piece = { m: SHAPES[Math.floor(Math.random() * 5)], x: 3, y: 0, c: ['#0f8', '#f05', '#70f', '#ff0'][Math.floor(Math.random() * 4)] }; if (collide()) board.forEach(r => r.fill(0)); }
    function collide() { return piece.m.some((r, y) => r.some((v, x) => v && (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0)); }
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400); ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        board.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = '#555'; ctx.fillRect(x * 20 + 100, y * 20, 19, 19); } }));
        piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = piece.c; ctx.fillRect((x + piece.x) * 20 + 100, (y + piece.y) * 20, 19, 19); } }));
    }
    function update() {
        piece.y++; if (collide()) { piece.y--; piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) board[y + piece.y][x + piece.x] = 1; })); for (let y = 19; y > 0; y--) if (board[y].every(x => x)) { board.splice(y, 1); board.unshift(Array(10).fill(0)); score += 100; updateScore(score); y++; } newPiece(); } draw();
    }
    newPiece(); gameInterval = setInterval(update, 500);
    document.onkeydown = e => { if (currentGame !== 'tetris') return; if (e.keyCode == 37) { piece.x--; if (collide()) piece.x++ } if (e.keyCode == 39) { piece.x++; if (collide()) piece.x-- } if (e.keyCode == 40) update(); if (e.keyCode == 38) { let old = piece.m; piece.m = piece.m[0].map((_, i) => piece.m.map(r => r[i]).reverse()); if (collide()) piece.m = old; } draw(); };
}
function initMaze() {
    currentGame = 'maze';
    let map = [[1,1,1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,0,0,1],[1,0,1,0,1,0,1,1,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,1,1,1,1,1,1,0,1],[1,0,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1]];
    let p = { x: 1, y: 1 }, g = { x: 8, y: 5 };
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) { if (map[y][x] == 1) { ctx.fillStyle = '#222'; ctx.strokeStyle='#00ff88'; ctx.lineWidth=2; ctx.fillRect(x * 40, y * 40, 40, 40); ctx.strokeRect(x * 40, y * 40, 40, 40); } else if (map[y][x] == 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x * 40 + 20, y * 40 + 20, 3, 0, 6.28); ctx.fill(); } }
        ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(p.x * 40 + 20, p.y * 40 + 20, 15, 0, 6.28); ctx.fill(); ctx.fillStyle = '#f00'; ctx.fillRect(g.x * 40 + 10, g.y * 40 + 10, 20, 20);
    }
    gameInterval = setInterval(() => { if (Math.random() > 0.7) { let m = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(d => map[g.y + d.y] && map[g.y + d.y][g.x + d.x] != 1); if (m.length) { let nm = m[Math.floor(Math.random() * m.length)]; g.x += nm.x; g.y += nm.y; } } if (p.x == g.x && p.y == g.y) { score = 0; updateScore(0); p = { x: 1, y: 1 }; g = { x: 8, y: 5 }; alert("Yakaladın!"); } draw(); }, 500);
    document.onkeydown = e => { if (currentGame !== 'maze') return; let nx = p.x, ny = p.y; if (e.keyCode == 37) nx--; if (e.keyCode == 39) nx++; if (e.keyCode == 38) ny--; if (e.keyCode == 40) ny++; if (map[ny] && map[ny][nx] != 1) { p.x = nx; p.y = ny; if (map[ny][nx] == 0) { score += 10; updateScore(score); map[ny][nx] = 2; } } draw(); }; draw();
}
function initPong() {
    currentGame = 'pong'; let playerY = 150, aiY = 150; let ball = { x: 200, y: 200, dx: 4, dy: 4, size: 8 }; const paddleH = 60, paddleW = 10;
    gameInterval = setInterval(() => { ball.x += ball.dx; ball.y += ball.dy; if (ball.y < 0 || ball.y > 400) ball.dy *= -1; if (ball.x < 20 && ball.y > playerY && ball.y < playerY + paddleH) { ball.dx *= -1.1; score += 10; updateScore(score); } if (ball.x > 380 && ball.y > aiY && ball.y < aiY + paddleH) { ball.dx *= -1.1; } if (ball.x < 0) { score = 0; updateScore(0); ball = {x:200, y:200, dx:4, dy:4, size:8}; } if (ball.x > 400) { score += 100; updateScore(score); ball = {x:200, y:200, dx:-4, dy:4, size:8}; } if (aiY + paddleH/2 < ball.y) aiY += 3; else aiY -= 3; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400); ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(200,0); ctx.lineTo(200,400); ctx.stroke(); ctx.fillStyle = '#00ff88'; ctx.fillRect(10, playerY, paddleW, paddleH); ctx.fillStyle = '#ff0055'; ctx.fillRect(380, aiY, paddleW, paddleH); ctx.fillStyle = '#fff'; ctx.fillRect(ball.x, ball.y, ball.size, ball.size); }, 1000/60);
    document.onkeydown = e => { if (currentGame !== 'pong') return; if (e.keyCode == 38) playerY -= 20; if (e.keyCode == 40) playerY += 20; if (playerY < 0) playerY = 0; if (playerY > 340) playerY = 340; };
}
function initBreakout() {
    currentGame = 'breakout'; let paddleX = 160; let ball = { x: 200, y: 300, dx: 3, dy: -3, size: 8 }; let bricks = []; for(let c=0; c<8; c++) { for(let r=0; r<5; r++) { bricks.push({ x: c*(400/8)+5, y: r*20+30, status: 1 }); } }
    gameInterval = setInterval(() => { ball.x += ball.dx; ball.y += ball.dy; if(ball.x < 0 || ball.x > 400) ball.dx *= -1; if(ball.y < 0) ball.dy *= -1; if(ball.y > 380 && ball.x > paddleX && ball.x < paddleX + 80) { ball.dy *= -1; ball.dx = 6 * ((ball.x-(paddleX+40))/40); } if(ball.y > 400) { score = 0; updateScore(0); ball = { x: 200, y: 300, dx: 3, dy: -3, size: 8 }; bricks.forEach(b => b.status = 1); } bricks.forEach(b => { if(b.status == 1) { if(ball.x > b.x && ball.x < b.x+45 && ball.y > b.y && ball.y < b.y+15) { ball.dy *= -1; b.status = 0; score += 10; updateScore(score); } } }); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400); ctx.fillStyle = '#00bcd4'; ctx.fillRect(paddleX, 385, 80, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 5, 0, Math.PI*2); ctx.fill(); bricks.forEach(b => { if(b.status == 1) { ctx.fillStyle = `hsl(${b.y}, 70%, 50%)`; ctx.fillRect(b.x, b.y, 45, 15); } }); }, 1000/60);
    document.onkeydown = e => { if (currentGame !== 'breakout') return; if (e.keyCode == 37) paddleX -= 25; if (e.keyCode == 39) paddleX += 25; if (paddleX < 0) paddleX = 0; if (paddleX > 320) paddleX = 320; };
}

// ==========================================
// 8. BLOCKLY ENTEGRASYONU (MEGA BAŞLANGIÇ KİTİ VERSİYONU)
// ==========================================
let workspace = null;

function initBlockly() {
    if (workspace) return; 

    // ---------------------------------------------------------
    // A. BLOK TANIMLARI (JSON)
    // ---------------------------------------------------------
    Blockly.defineBlocksWithJsonArray([
        // --- TEMEL ---
        {
            "type": "arduino_base",
            "message0": "Arduino Başlat %1 Kurulum (Setup) %2 %3 Ana Döngü (Loop) %4 %5",
            "args0": [
                { "type": "input_dummy" },
                { "type": "input_statement", "name": "SETUP" },
                { "type": "input_dummy" },
                { "type": "input_statement", "name": "LOOP" },
                { "type": "input_dummy" }
            ],
            "colour": 120, "tooltip": "Ana yapı"
        },
        {
            "type": "delay_ms",
            "message0": "%1 ms bekle",
            "args0": [{ "type": "field_number", "name": "MS", "value": 1000 }],
            "previousStatement": null, "nextStatement": null, "colour": 160
        },
        {
            "type": "serial_print",
            "message0": "Seri Port Yaz (Satır Atla: %1) Mesaj: %2",
            "args0": [
                { "type": "field_checkbox", "name": "NEWLINE", "checked": true },
                { "type": "input_value", "name": "MSG" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 160
        },
        {
            "type": "text_string",
            "message0": "\"%1\"",
            "args0": [{ "type": "field_input", "name": "TXT", "text": "Merhaba" }],
            "output": "String", "colour": 160
        },

        // --- ÇIKIŞLAR (LED, RÖLE, BUZZER) ---
        {
            "type": "digital_write",
            "message0": "Dijital Yaz (Pin %1) Durum: %2",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"],["10","10"],["11","11"],["12","12"],["13","13"]] },
                { "type": "field_dropdown", "name": "STATE", "options": [["YAK (HIGH)", "HIGH"], ["SÖNDÜR (LOW)", "LOW"]] }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 230
        },
        {
            "type": "analog_write",
            "message0": "PWM/Analog Yaz (Pin %1) Değer (0-255): %2",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["3","3"],["5","5"],["6","6"],["9","9"],["10","10"],["11","11"]] },
                { "type": "input_value", "name": "VAL", "check": "Number" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 230
        },
        {
            "type": "rgb_led",
            "message0": "RGB LED Renk Ayarla Kırmızı Pin: %1 Yeşil Pin: %2 Mavi Pin: %3",
            "args0": [
                { "type": "field_dropdown", "name": "PIN_R", "options": [["9","9"],["3","3"]] },
                { "type": "field_dropdown", "name": "PIN_G", "options": [["10","10"],["5","5"]] },
                { "type": "field_dropdown", "name": "PIN_B", "options": [["11","11"],["6","6"]] }
            ],
            "message1": "R: %1 G: %2 B: %3",
            "args1": [
                { "type": "input_value", "name": "VAL_R", "check": "Number" },
                { "type": "input_value", "name": "VAL_G", "check": "Number" },
                { "type": "input_value", "name": "VAL_B", "check": "Number" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 230
        },
        {
            "type": "buzzer_tone",
            "message0": "Buzzer Çal (Pin %1) Frekans: %2 Hz Süre: %3 ms",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["8","8"],["2","2"],["3","3"]] },
                { "type": "input_value", "name": "FREQ", "check": "Number" },
                { "type": "input_value", "name": "DUR", "check": "Number" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 230
        },

        // --- MOTORLAR ---
        {
            "type": "servo_move",
            "message0": "Servo Motor (Pin %1) Açı (0-180): %2",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["9","9"],["10","10"],["3","3"],["5","5"]] },
                { "type": "input_value", "name": "DEGREE", "check": "Number" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 300
        },

        // --- GİRİŞLER (BUTON, POT, SENSÖRLER) ---
        {
            "type": "digital_read",
            "message0": "Dijital Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["2","2"],["3","3"],["4","4"],["7","7"],["8","8"]] }],
            "output": "Number", "colour": 180
        },
        {
            "type": "analog_read",
            "message0": "Analog Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["A0","A0"],["A1","A1"],["A2","A2"],["A3","A3"],["A4","A4"],["A5","A5"]] }],
            "output": "Number", "colour": 180
        },
        
        // --- GELİŞMİŞ SENSÖRLER (Kütüphaneli) ---
        {
            "type": "sensor_ultrasonic",
            "message0": "Mesafe Sensörü (HC-SR04) Trig: %1 Echo: %2",
            "args0": [
                { "type": "field_dropdown", "name": "TRIG", "options": [["2","2"],["3","3"],["4","4"],["7","7"]] },
                { "type": "field_dropdown", "name": "ECHO", "options": [["3","3"],["2","2"],["5","5"],["8","8"]] }
            ],
            "output": "Number", "colour": 180, "tooltip": "Mesafeyi cm cinsinden ölçer"
        },
        {
            "type": "sensor_dht11",
            "message0": "DHT11 Sensörü (Pin %1) %2 Oku",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["2","2"],["3","3"],["4","4"],["7","7"]] },
                { "type": "field_dropdown", "name": "TYPE", "options": [["Sıcaklık (C)","temp"],["Nem (%)","hum"]] }
            ],
            "output": "Number", "colour": 180
        },
        {
            "type": "sensor_pir",
            "message0": "PIR Hareket Sensörü (Pin %1) Hareket Var mı?",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["2","2"],["3","3"],["4","4"],["7","7"]] }],
            "output": "Boolean", "colour": 180
        },
        
        // --- BASİT SENSÖRLER (Analog/Dijital Sarmalayıcılar) ---
        {
            "type": "sensor_ldr",
            "message0": "LDR Işık Sensörü Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["A0","A0"],["A1","A1"]] }],
            "output": "Number", "colour": 180
        },
        {
            "type": "sensor_soil",
            "message0": "Toprak Nem Sensörü Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["A0","A0"],["A1","A1"],["A2","A2"]] }],
            "output": "Number", "colour": 180
        },
        {
            "type": "sensor_rain",
            "message0": "Yağmur Sensörü Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["A0","A0"],["A1","A1"]] }],
            "output": "Number", "colour": 180
        },
        {
            "type": "sensor_sound",
            "message0": "Ses Sensörü Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["A0","A0"],["A1","A1"]] }],
            "output": "Number", "colour": 180
        },
        {
            "type": "sensor_gas",
            "message0": "Gaz Sensörü (MQ-2) Oku (Pin %1)",
            "args0": [{ "type": "field_dropdown", "name": "PIN", "options": [["A0","A0"],["A1","A1"]] }],
            "output": "Number", "colour": 180
        },

        // --- EKRAN ---
        {
            "type": "lcd_i2c_init",
            "message0": "LCD Ekranı (I2C) Başlat",
            "previousStatement": null, "nextStatement": null, "colour": 60, "tooltip": "Setup içine koyun. Adres: 0x27"
        },
        {
            "type": "lcd_i2c_print",
            "message0": "LCD Yaz (Satır: %1, Sütun: %2) Mesaj: %3",
            "args0": [
                { "type": "field_dropdown", "name": "ROW", "options": [["0 (Üst)","0"],["1 (Alt)","1"]] },
                { "type": "field_number", "name": "COL", "value": 0, "min": 0, "max": 15 },
                { "type": "input_value", "name": "MSG" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 60
        },
        {
            "type": "lcd_i2c_clear",
            "message0": "LCD Ekranı Temizle",
            "previousStatement": null, "nextStatement": null, "colour": 60
        },

        // --- MATEMATİK & MANTIK ---
        {
            "type": "math_number",
            "message0": "%1",
            "args0": [{ "type": "field_number", "name": "NUM", "value": 0 }],
            "output": "Number", "colour": 210
        },
        {
            "type": "logic_compare_custom",
            "message0": "%1 %2 %3",
            "args0": [
                { "type": "input_value", "name": "A" },
                { "type": "field_dropdown", "name": "OP", "options": [["=","=="],["≠","!="],["<","<"],[">",">"]] },
                { "type": "input_value", "name": "B" }
            ],
            "output": "Boolean", "colour": 210
        },
        {
            "type": "controls_if_custom",
            "message0": "Eğer %1 ise",
            "args0": [{ "type": "input_value", "name": "IF0", "check": "Boolean" }],
            "message1": "Yap %1",
            "args1": [{ "type": "input_statement", "name": "DO0" }],
            "previousStatement": null, "nextStatement": null, "colour": 210
        }
    ]);

    // ---------------------------------------------------------
    // B. C++ GENERATOR MANTIĞI
    // ---------------------------------------------------------
    const generator = new Blockly.Generator('ARDUINO');
    
    // Global depolar (Kütüphaneler ve Setup kodları için)
    generator.definitions_ = {};
    generator.setups_ = {};

    // Blok bağlama mantığı
    generator.scrub_ = function(block, code) {
        const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
        const nextCode = generator.blockToCode(nextBlock);
        return code + nextCode;
    };

    // --- TEMEL ---
    generator.forBlock['arduino_base'] = function(block, generator) {
        var setupCode = generator.statementToCode(block, 'SETUP');
        var loopCode = generator.statementToCode(block, 'LOOP');
        
        var autoSetup = "";
        for (var key in generator.setups_) autoSetup += generator.setups_[key] + "\n";
        var definitions = "";
        for (var key in generator.definitions_) definitions += generator.definitions_[key] + "\n";

        return `${definitions}\nvoid setup() {\n  Serial.begin(115200);\n${autoSetup}${setupCode}}\n\nvoid loop() {\n${loopCode}}\n`;
    };
    generator.forBlock['delay_ms'] = function(block) {
        return `  delay(${block.getFieldValue('MS')});\n`;
    };
    generator.forBlock['serial_print'] = function(block, generator) {
        var msg = generator.valueToCode(block, 'MSG', 0) || '""';
        var nl = block.getFieldValue('NEWLINE') === 'TRUE';
        return `  Serial.print${nl ? 'ln' : ''}(${msg});\n`;
    };
    generator.forBlock['text_string'] = function(block) {
        return [`"${block.getFieldValue('TXT')}"`, 0];
    };

    // --- ÇIKIŞLAR ---
    generator.forBlock['digital_write'] = function(block) {
        var pin = block.getFieldValue('PIN');
        generator.setups_['pin_'+pin] = `  pinMode(${pin}, OUTPUT);`;
        return `  digitalWrite(${pin}, ${block.getFieldValue('STATE')});\n`;
    };
    generator.forBlock['analog_write'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        var val = generator.valueToCode(block, 'VAL', 0) || '0';
        generator.setups_['pin_'+pin] = `  pinMode(${pin}, OUTPUT);`;
        return `  analogWrite(${pin}, ${val});\n`;
    };
    generator.forBlock['rgb_led'] = function(block, generator) {
        var r = block.getFieldValue('PIN_R'); var g = block.getFieldValue('PIN_G'); var b = block.getFieldValue('PIN_B');
        var vr = generator.valueToCode(block, 'VAL_R', 0) || '0';
        var vg = generator.valueToCode(block, 'VAL_G', 0) || '0';
        var vb = generator.valueToCode(block, 'VAL_B', 0) || '0';
        generator.setups_['pin_'+r] = `  pinMode(${r}, OUTPUT);`;
        generator.setups_['pin_'+g] = `  pinMode(${g}, OUTPUT);`;
        generator.setups_['pin_'+b] = `  pinMode(${b}, OUTPUT);`;
        return `  analogWrite(${r}, ${vr}); analogWrite(${g}, ${vg}); analogWrite(${b}, ${vb});\n`;
    };
    generator.forBlock['buzzer_tone'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        var freq = generator.valueToCode(block, 'FREQ', 0) || '1000';
        var dur = generator.valueToCode(block, 'DUR', 0) || '500';
        generator.setups_['pin_'+pin] = `  pinMode(${pin}, OUTPUT);`;
        return `  tone(${pin}, ${freq}, ${dur});\n`;
    };

    // --- MOTORLAR ---
    generator.forBlock['servo_move'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        var deg = generator.valueToCode(block, 'DEGREE', 0) || '90';
        generator.definitions_['inc_servo'] = '#include <Servo.h>';
        generator.definitions_['var_servo'+pin] = `Servo servo_${pin};`;
        generator.setups_['setup_servo'+pin] = `  servo_${pin}.attach(${pin});`;
        return `  servo_${pin}.write(${deg});\n`;
    };

    // --- GİRİŞLER ---
    generator.forBlock['digital_read'] = function(block) {
        var pin = block.getFieldValue('PIN');
        generator.setups_['pin_'+pin] = `  pinMode(${pin}, INPUT);`;
        return [`digitalRead(${pin})`, 0];
    };
    generator.forBlock['analog_read'] = function(block) {
        return [`analogRead(${block.getFieldValue('PIN')})`, 0];
    };

    // --- GELİŞMİŞ SENSÖRLER (KÜTÜPHANELİ) ---
    generator.forBlock['sensor_ultrasonic'] = function(block) {
        var trig = block.getFieldValue('TRIG');
        var echo = block.getFieldValue('ECHO');
        // NewPing Kütüphanesi Kullanımı
        generator.definitions_['inc_newping'] = '#include <NewPing.h>';
        // Tekil değişken adı oluşturmak lazım
        var varName = `sonar_${trig}_${echo}`;
        generator.definitions_['var_'+varName] = `NewPing ${varName}(${trig}, ${echo}, 200);`; // Max 200cm
        return [`${varName}.ping_cm()`, 0];
    };
    
    generator.forBlock['sensor_dht11'] = function(block) {
        var pin = block.getFieldValue('PIN');
        var type = block.getFieldValue('TYPE'); // temp or hum
        generator.definitions_['inc_dht'] = '#include <DHT.h>';
        generator.definitions_['var_dht'+pin] = `DHT dht_${pin}(${pin}, DHT11);`;
        generator.setups_['setup_dht'+pin] = `  dht_${pin}.begin();`;
        var func = type === 'temp' ? 'readTemperature()' : 'readHumidity()';
        return [`dht_${pin}.${func}`, 0];
    };

    generator.forBlock['sensor_pir'] = function(block) {
        var pin = block.getFieldValue('PIN');
        generator.setups_['pin_'+pin] = `  pinMode(${pin}, INPUT);`;
        return [`digitalRead(${pin})`, 0]; // Boolean döner
    };

    // --- BASİT SENSÖRLER (Sarmalayıcılar) ---
    // Hepsi aslında analogRead'dir, sadece kullanıcı için isimlendirdik
    var simpleAnalogSensors = ['sensor_ldr', 'sensor_soil', 'sensor_rain', 'sensor_sound', 'sensor_gas'];
    simpleAnalogSensors.forEach(s => {
        generator.forBlock[s] = function(block) {
            return [`analogRead(${block.getFieldValue('PIN')})`, 0];
        };
    });

    // --- EKRAN (LCD I2C) ---
    generator.forBlock['lcd_i2c_init'] = function(block) {
        generator.definitions_['inc_lcd'] = '#include <LiquidCrystal_I2C.h>';
        generator.definitions_['var_lcd'] = 'LiquidCrystal_I2C lcd(0x27, 16, 2);';
        return `  lcd.init();\n  lcd.backlight();\n`;
    };
    generator.forBlock['lcd_i2c_print'] = function(block, generator) {
        var row = block.getFieldValue('ROW');
        var col = block.getFieldValue('COL');
        var msg = generator.valueToCode(block, 'MSG', 0) || '""';
        return `  lcd.setCursor(${col}, ${row});\n  lcd.print(${msg});\n`;
    };
    generator.forBlock['lcd_i2c_clear'] = function() { return `  lcd.clear();\n`; };

    // --- MATEMATİK & MANTIK ---
    generator.forBlock['math_number'] = function(block) { return [String(block.getFieldValue('NUM')), 0]; };
    generator.forBlock['logic_compare_custom'] = function(block, generator) {
        var a = generator.valueToCode(block, 'A', 0) || '0';
        var b = generator.valueToCode(block, 'B', 0) || '0';
        var op = block.getFieldValue('OP');
        return [`(${a} ${op} ${b})`, 0];
    };
    generator.forBlock['controls_if_custom'] = function(block, generator) {
        var condition = generator.valueToCode(block, 'IF0', 0) || 'false';
        var branch = generator.statementToCode(block, 'DO0');
        return `  if (${condition}) {\n${branch}  }\n`;
    };

    // ---------------------------------------------------------
    // C. TOOLBOX (KATEGORİLİ MENÜ)
    // ---------------------------------------------------------
    var toolboxXml = `
    <xml>
        <category name="🚀 Temel" colour="120">
            <block type="arduino_base"></block>
            <block type="delay_ms"></block>
            <block type="serial_print">
                <value name="MSG"><block type="text_string"></block></value>
            </block>
            <block type="text_string"></block>
        </category>
        
        <category name="⚡ Çıkışlar" colour="230">
            <block type="digital_write"></block>
            <block type="analog_write"></block>
            <block type="rgb_led"></block>
            <block type="buzzer_tone"></block>
        </category>

        <category name="👀 Girişler" colour="180">
            <block type="digital_read"></block>
            <block type="analog_read"></block>
        </category>

        <category name="🌡️ Sensörler" colour="180">
            <block type="sensor_ultrasonic"></block>
            <block type="sensor_dht11"></block>
            <block type="sensor_pir"></block>
            <block type="sensor_ldr"></block>
            <block type="sensor_soil"></block>
            <block type="sensor_rain"></block>
            <block type="sensor_sound"></block>
            <block type="sensor_gas"></block>
        </category>

        <category name="📺 Ekran" colour="60">
            <block type="lcd_i2c_init"></block>
            <block type="lcd_i2c_print">
                <value name="MSG"><block type="text_string"><field name="TXT">Merhaba</field></block></value>
            </block>
            <block type="lcd_i2c_clear"></block>
        </category>

        <category name="⚙️ Motorlar" colour="300">
            <block type="servo_move"></block>
        </category>

        <category name="🧠 Mantık" colour="210">
            <block type="controls_if_custom"></block>
            <block type="logic_compare_custom"></block>
            <block type="math_number"></block>
        </category>
    </xml>`;

    // ---------------------------------------------------------
    // D. WORKSPACE OLUŞTURMA
    // ---------------------------------------------------------
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: toolboxXml,
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
        theme: Blockly.Themes.Dark 
    });

    const startBlock = workspace.newBlock('arduino_base');
    startBlock.initSvg();
    startBlock.render();
    startBlock.moveBy(50, 50);

    workspace.addChangeListener(() => {
        generator.definitions_ = {}; // Sıfırla
        generator.setups_ = {}; // Sıfırla
        const code = generator.workspaceToCode(workspace);
        document.getElementById('generatedCode').value = code;
    });
}
function transferAndCompile() {
    const code = document.getElementById('generatedCode').value;
    const cppEditor = document.getElementById('cppEditor');
    if(cppEditor) cppEditor.value = code;
    const iotBtn = document.querySelector('.nav-btn[onclick*="iot"]');
    if(iotBtn) showSection('iot', iotBtn);
    setTimeout(() => { compileCode(); }, 600);
}
